"""Compare every held-out image against the original CPU PyTorch checkpoint."""
import argparse
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import time

import numpy as np
import onnx
import onnxruntime as ort
from PIL import Image, ImageOps
import torch
from torchvision.datasets.folder import IMG_EXTENSIONS

from common import (CHECKPOINT, CLASS_FOLDERS, CLASS_IDS, CLASS_NAMES, INPUT_NAME,
                    INPUT_SHAPE, ONNX_PATH, OUTPUT_NAME, OUTPUT_SHAPE, ROOT,
                    configure_console, environment, load_classifier, sha256, write_json)

# FP32 convolution/reduction orders differ between engines. These elementwise
# limits allow small accumulation error near zero and scale with logit magnitude.
# They never determine a class; argmax agreement is a separate, strict gate.
RAW_ATOL, RAW_RTOL = 1e-4, 1e-4
PROB_ATOL, PROB_RTOL = 1e-6, 1e-4
RAW_ABSOLUTE_LIMIT, PROB_ABSOLUTE_LIMIT = 1e-4, 1e-5


def softmax(logits):
    shifted = logits - np.max(logits, axis=1, keepdims=True)
    exponentials = np.exp(shifted)
    return exponentials / np.sum(exponentials, axis=1, keepdims=True)


def main():
    configure_console()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkpoint', type=Path, default=CHECKPOINT)
    parser.add_argument('--model', type=Path, default=ONNX_PATH)
    parser.add_argument('--dataset', type=Path, default=ROOT / 'dataset')
    parser.add_argument('--splits', nargs='+', choices=['validation', 'testing'], default=['validation', 'testing'])
    args = parser.parse_args()
    if len(args.splits) != len(set(args.splits)):
        parser.error('Duplicate splits would count images twice.')
    torch.set_num_threads(1)
    classifier = load_classifier(args.checkpoint)
    before_sha = sha256(args.checkpoint)
    model_sha = sha256(args.model)
    metadata = json.loads((args.model.parent / 'metadata.json').read_text(encoding='utf-8'))
    if metadata['onnx']['sha256'] != model_sha or metadata['checkpoint']['sha256'] != before_sha:
        raise ValueError('Model, checkpoint, and metadata checksums must match.')
    if [c['id'] for c in metadata['classes']] != list(CLASS_IDS):
        raise ValueError('Metadata class mapping differs from original model.')
    graph = onnx.load(args.model)
    onnx.checker.check_model(graph, full_check=True)
    properties = {p.key: p.value for p in graph.metadata_props}
    if json.loads(properties['pestprint.class_ids']) != list(CLASS_IDS) or properties['pestprint.unknown_method'] != 'trained_class':
        raise ValueError('Embedded model classification metadata does not match.')
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(args.model), sess_options=options, providers=['CPUExecutionProvider'])
    input_info, = session.get_inputs()
    output_info, = session.get_outputs()
    if (input_info.name, input_info.type, input_info.shape) != (INPUT_NAME, 'tensor(float)', list(INPUT_SHAPE)):
        raise ValueError('Unexpected input name/type/shape.')
    if (output_info.name, output_info.type, output_info.shape) != (OUTPUT_NAME, 'tensor(float)', list(OUTPUT_SHAPE)):
        raise ValueError('Unexpected output name/type/shape.')

    started = time.perf_counter()
    errors, changes, raw_failures, probability_failures = [], [], [], []
    per_class = {c: {'images': 0, 'agreements': 0} for c in CLASS_IDS}
    predicted_class_counts = {c: {'pytorch': 0, 'onnx': 0} for c in CLASS_IDS}
    per_split = {}
    hashes = defaultdict(list)
    fingerprint = hashlib.sha256()
    raw_sum = probability_sum = 0.0
    raw_max = probability_max = 0.0
    max_probability_sum_error = 0.0
    minimum_pytorch_margin = None
    total = agreements = 0
    details_path = args.model.parent / 'validation-samples.jsonl'
    details_temporary = details_path.with_suffix('.jsonl.tmp')
    with details_temporary.open('w', encoding='utf-8') as details:
        for split in args.splits:
            directory = args.dataset / split
            per_split[split] = {c: 0 for c in CLASS_IDS}
            if not directory.is_dir():
                errors.append({'split': split, 'error': 'Held-out directory unavailable; no results invented.'})
                continue
            folders = sorted(p.name for p in directory.iterdir() if p.is_dir())
            if folders != list(CLASS_FOLDERS):
                errors.append({'split': split, 'error': f'Expected class folders {CLASS_FOLDERS}, found {folders}'})
                continue
            for label_index, folder in enumerate(CLASS_FOLDERS):
                paths = sorted(p for p in (directory / folder).rglob('*') if p.is_file() and p.suffix.lower() in IMG_EXTENSIONS)
                if not paths:
                    errors.append({'split': split, 'class': CLASS_IDS[label_index], 'error': 'No supported images found.'})
                for path in paths:
                    relative = path.relative_to(args.dataset).as_posix()
                    try:
                        image_sha = sha256(path)
                        hashes[image_sha].append(relative)
                        fingerprint.update(relative.encode('utf-8') + b'\0' + bytes.fromhex(image_sha))
                        # Match app.py then reuse the backend's actual transform.
                        with Image.open(path) as source:
                            image = ImageOps.exif_transpose(source).convert('RGB')
                        try:
                            tensor = classifier.transform(image).unsqueeze(0)
                        finally:
                            image.close()
                        if tensor.dtype != torch.float32 or tuple(tensor.shape) != INPUT_SHAPE or not torch.isfinite(tensor).all():
                            raise ValueError('Invalid preprocessed input tensor.')
                        if tensor.min().item() < 0 or tensor.max().item() > 1:
                            raise ValueError('Pixel values outside RGB/255 range.')
                        # Feed the identical float32 tensor to both engines.
                        with torch.inference_mode():
                            pytorch_logits = classifier.model(tensor)
                            pytorch_probabilities = torch.softmax(pytorch_logits, dim=1).numpy()
                        reference = pytorch_logits.numpy()
                        converted, = session.run([OUTPUT_NAME], {INPUT_NAME: tensor.numpy()})
                        if converted.shape != OUTPUT_SHAPE or converted.dtype != np.float32 or not np.isfinite(converted).all() or not np.isfinite(reference).all():
                            raise ValueError('Non-finite, incorrectly shaped, or non-FP32 output.')
                        probabilities = softmax(converted)
                        if not np.isfinite(probabilities).all() or not np.isfinite(pytorch_probabilities).all():
                            raise ValueError('Non-finite softmax probabilities.')
                        sum_error = float(np.max(np.abs(probabilities.sum(axis=1) - 1)))
                        if sum_error > 1e-6 or np.any(probabilities < 0) or np.any(probabilities > 1):
                            raise ValueError('Invalid normalized probabilities.')
                        raw_delta = np.abs(reference.astype(np.float64) - converted.astype(np.float64))
                        probability_delta = np.abs(pytorch_probabilities.astype(np.float64) - probabilities.astype(np.float64))
                        raw_ok = bool(np.allclose(converted, reference, atol=RAW_ATOL, rtol=RAW_RTOL) and raw_delta.max() <= RAW_ABSOLUTE_LIMIT)
                        probability_ok = bool(np.allclose(probabilities, pytorch_probabilities, atol=PROB_ATOL, rtol=PROB_RTOL) and probability_delta.max() <= PROB_ABSOLUTE_LIMIT)
                        reference_index = int(np.argmax(pytorch_probabilities[0]))
                        onnx_index = int(np.argmax(probabilities[0]))
                        if int(np.argmax(reference[0])) != reference_index or int(np.argmax(converted[0])) != onnx_index:
                            raise ValueError('Logit and probability argmax disagree.')
                        sorted_reference = np.sort(pytorch_probabilities[0])
                        margin = float(sorted_reference[-1] - sorted_reference[-2])
                        row = {
                            'image': relative, 'image_sha256': image_sha, 'label_index': label_index, 'label': CLASS_IDS[label_index],
                            'pytorch_logits': reference[0].tolist(), 'onnx_logits': converted[0].tolist(),
                            'pytorch_probabilities': pytorch_probabilities[0].tolist(), 'onnx_probabilities': probabilities[0].tolist(),
                            'pytorch_index': reference_index, 'onnx_index': onnx_index,
                            'pytorch_class': CLASS_IDS[reference_index], 'onnx_class': CLASS_IDS[onnx_index],
                            'pytorch_class_name': CLASS_NAMES[reference_index], 'onnx_class_name': CLASS_NAMES[onnx_index],
                            'raw_max_abs_difference': float(raw_delta.max()), 'raw_mean_abs_difference': float(raw_delta.mean()),
                            'probability_max_abs_difference': float(probability_delta.max()), 'probability_mean_abs_difference': float(probability_delta.mean()),
                            'pytorch_top_two_probability_margin': margin,
                            'raw_within_tolerance': raw_ok, 'probabilities_within_tolerance': probability_ok,
                        }
                        details.write(json.dumps(row, allow_nan=False) + '\n')
                        total += 1
                        agreement = reference_index == onnx_index
                        agreements += int(agreement)
                        per_class[CLASS_IDS[label_index]]['images'] += 1
                        per_class[CLASS_IDS[label_index]]['agreements'] += int(agreement)
                        predicted_class_counts[CLASS_IDS[reference_index]]['pytorch'] += 1
                        predicted_class_counts[CLASS_IDS[onnx_index]]['onnx'] += 1
                        per_split[split][CLASS_IDS[label_index]] += 1
                        raw_sum += float(raw_delta.sum())
                        probability_sum += float(probability_delta.sum())
                        raw_max = max(raw_max, float(raw_delta.max()))
                        probability_max = max(probability_max, float(probability_delta.max()))
                        max_probability_sum_error = max(max_probability_sum_error, sum_error)
                        minimum_pytorch_margin = margin if minimum_pytorch_margin is None else min(minimum_pytorch_margin, margin)
                        if not agreement:
                            changes.append(row)
                        if not raw_ok:
                            raw_failures.append(relative)
                        if not probability_ok:
                            probability_failures.append(relative)
                    except Exception as error:
                        errors.append({'image': relative, 'error': f'{type(error).__name__}: {error}'})
            print(f'{split}: {sum(per_split[split].values())} images checked', flush=True)
    details_temporary.replace(details_path)
    source_unchanged = sha256(args.checkpoint) == before_sha
    onnx_unchanged = sha256(args.model) == model_sha
    passed = (total > 0 and agreements == total and not errors and not raw_failures and not probability_failures
              and source_unchanged and onnx_unchanged and all(p['images'] > 0 for p in per_class.values()))
    report = {
        'status': 'SUCCESS' if passed else 'FAILED', 'created_utc': datetime.now(timezone.utc).isoformat(),
        'environment': environment(), 'execution_provider': session.get_providers(),
        'checkpoint_sha256': before_sha, 'checkpoint_unchanged': source_unchanged,
        'onnx_sha256': model_sha, 'onnx_unchanged': onnx_unchanged,
        'onnx_bytes': args.model.stat().st_size, 'opset': metadata['onnx']['opset'], 'ir_version': graph.ir_version,
        'input': metadata['input'], 'output': metadata['output'], 'classes': metadata['classes'],
        'dataset': {'splits': args.splits, 'fingerprint_sha256': fingerprint.hexdigest(), 'per_split': per_split,
                    'unique_image_checksums': len(hashes), 'duplicate_content_groups': [p for p in hashes.values() if len(p) > 1],
                    'scope': 'All supported images in the requested held-out directories; split provenance not independently established.'},
        'images': total, 'per_class': per_class, 'predicted_class_counts': predicted_class_counts, 'agreement_count': agreements,
        'agreement_fraction': agreements / total if total else None, 'changed_predictions': changes,
        'raw_outputs': {'max_absolute_difference': raw_max if total else None, 'mean_absolute_difference': raw_sum / (total * 4) if total else None,
                        'atol': RAW_ATOL, 'rtol': RAW_RTOL, 'absolute_limit': RAW_ABSOLUTE_LIMIT, 'failed_images': raw_failures},
        'softmax_probabilities': {'max_absolute_difference': probability_max if total else None, 'mean_absolute_difference': probability_sum / (total * 4) if total else None,
                                  'atol': PROB_ATOL, 'rtol': PROB_RTOL, 'absolute_limit': PROB_ABSOLUTE_LIMIT, 'failed_images': probability_failures,
                                  'definition': 'PyTorch torch.softmax(dim=1) versus float32 max-subtracted NumPy softmax of ONNX logits'},
        'tolerance_rule': 'Elementwise abs(ONNX - PyTorch) <= atol + rtol * abs(PyTorch), AND global absolute limits; zero class changes required independently.',
        'tolerance_justification': 'FP32 convolution/reduction accumulation differences, also seen with optimizations disabled. A 1e-4 absolute logit budget avoids unstable relative error near zero; a separate 1e-5 absolute probability cap limits score changes to 0.001 percentage point. Initial stricter failures and investigation are disclosed in VALIDATION_NOTES.md. No rounding, clamping, or Unknown threshold.',
        'maximum_probability_sum_error': max_probability_sum_error if total else None,
        'minimum_pytorch_top_two_probability_margin': minimum_pytorch_margin,
        'errors': errors, 'elapsed_seconds': time.perf_counter() - started,
        'per_image_results': details_path.name, 'per_image_results_sha256': sha256(details_path),
        'limitations': ['CPU conversion parity only; Android preprocessing, native build compatibility, and device inference are not validated in Phase 11B.',
                        'Agreement with the original model does not establish model accuracy, confidence calibration, or correctness of ground-truth labels.'],
    }
    write_json(args.model.parent / 'validation-report.json', report)
    print(json.dumps({k: report[k] for k in ['status', 'images', 'agreement_count', 'raw_outputs', 'softmax_probabilities', 'errors']}, indent=2))
    return 0 if passed else 1


if __name__ == '__main__':
    raise SystemExit(main())
