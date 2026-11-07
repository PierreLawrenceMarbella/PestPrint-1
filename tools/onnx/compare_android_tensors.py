"""Inspect actual Android tensors/results saved by check-native-offline.cjs.

Separates decoder/preprocessing differences from ONNX engine differences by also
running the Android tensor through desktop ORT. Does not fabricate device data.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps

from common import ROOT, ONNX_PATH, configure_console, write_json


def main():
    configure_console()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--results', type=Path, default=ROOT / '.artifacts/phase11c-native')
    args = parser.parse_args()
    rows = json.loads((args.results / 'results.json').read_text())
    originals = {row['image']: row for row in (
        json.loads(line) for line in (ROOT / 'model/onnx/validation-samples.jsonl').read_text().splitlines() if line.strip()
    )}
    if not rows:
        raise ValueError('Actual Android results are required.')
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    session = ort.InferenceSession(str(ONNX_PATH), sess_options=options, providers=['CPUExecutionProvider'])
    details = []
    for row in rows:
        image_path = ROOT / 'dataset' / row['reference_image']
        if hashlib.sha256(image_path.read_bytes()).hexdigest() != originals[row['reference_image']]['image_sha256']:
            raise ValueError(f'Image changed since Phase 11B: {image_path}')
        with Image.open(image_path) as source:
            image_format = source.format
            rgb = ImageOps.exif_transpose(source).convert('RGB').resize((224, 224), Image.Resampling.BILINEAR)
            reference = np.asarray(rgb, dtype=np.float32).transpose(2, 0, 1)[None] / np.float32(255)
        native = np.fromfile(args.results / row['tensor_file'], dtype='<f4').reshape(1, 3, 224, 224)
        if not np.isfinite(native).all():
            raise ValueError('Non-finite actual Android tensor')
        tensor_delta = np.abs(reference.astype(np.float64) - native.astype(np.float64))
        desktop_logits = session.run(['logits'], {'image': native})[0][0]
        android_logits = np.asarray(row['native']['inference']['logits'], dtype=np.float32)
        runtime_delta = np.abs(desktop_logits.astype(np.float64) - android_logits.astype(np.float64))
        details.append({
            'image': row['reference_image'], 'format': image_format,
            'tensor_max_absolute_difference': float(tensor_delta.max()), 'tensor_mean_absolute_difference': float(tensor_delta.mean()),
            'unequal_tensor_elements': int(np.count_nonzero(tensor_delta)),
            'native_vs_desktop_same_tensor_logit_max_difference': float(runtime_delta.max()),
            'original_class_agreement': row['class_agreement'],
        })
    exact = all(d['unequal_tensor_elements'] == 0 for d in details)
    same_input_runtime_close = all(d['native_vs_desktop_same_tensor_logit_max_difference'] <= 1e-4 for d in details)
    report = {
        'scope': 'Actual saved Android preprocessing tensors and native predictions; comparison against pinned Pillow and desktop ORT.',
        'images': len(details), 'exact_preprocessing_parity': exact,
        'native_desktop_same_tensor_within_1e_minus4': same_input_runtime_close,
        'original_class_agreements': sum(d['original_class_agreement'] for d in details),
        'maximum_tensor_difference': max(d['tensor_max_absolute_difference'] for d in details),
        'maximum_native_desktop_same_tensor_logit_difference': max(d['native_vs_desktop_same_tensor_logit_max_difference'] for d in details),
        'details': details,
    }
    write_json(args.results / 'tensor-comparison.json', report)
    print(json.dumps({k: v for k, v in report.items() if k != 'details'}, indent=2))
    return 0 if exact and same_input_runtime_close and all(d['original_class_agreement'] for d in details) else 1


if __name__ == '__main__':
    raise SystemExit(main())
