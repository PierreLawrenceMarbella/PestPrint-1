"""Export the unchanged EfficientNet-B0 FP32 logits with the supported Dynamo API."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import tempfile

import numpy as np
import onnx
import onnxruntime as ort
import torch

from common import (CHECKPOINT, CLASS_FOLDERS, CLASS_IDS, CLASS_NAMES, INPUT_NAME,
                    INPUT_SHAPE, ONNX_PATH, OUTPUT_NAME, OUTPUT_SHAPE,
                    configure_console, environment, load_classifier, sha256, write_json)


def main():
    configure_console()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkpoint', type=Path, default=CHECKPOINT)
    parser.add_argument('--output', type=Path, default=ONNX_PATH)
    parser.add_argument('--opset', type=int, choices=[18], default=18)
    parser.add_argument('--overwrite', action='store_true')
    args = parser.parse_args()
    if args.output.exists() and not args.overwrite:
        parser.error('Output exists. Review it before using --overwrite.')
    torch.set_num_threads(1)
    classifier = load_classifier(args.checkpoint)
    source_sha = sha256(args.checkpoint)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    example = torch.zeros(INPUT_SHAPE, dtype=torch.float32)
    # No softmax is added to the neural network. Its four raw logits are exported.
    # Application postprocessing must apply softmax exactly once, as the backend does.
    with torch.inference_mode():
        program = torch.onnx.export(
            classifier.model, (example,), dynamo=True, opset_version=args.opset,
            input_names=[INPUT_NAME], output_names=[OUTPUT_NAME],
            report=True, verify=True, artifacts_dir=str(args.output.parent / 'exporter'),
        )
    with tempfile.TemporaryDirectory(dir=args.output.parent) as directory:
        temporary = Path(directory) / args.output.name
        program.save(temporary, external_data=False)
        graph = onnx.load(temporary)
        onnx.helper.set_model_props(graph, {
            'pestprint.class_ids': json.dumps(CLASS_IDS),
            'pestprint.class_names': json.dumps(CLASS_NAMES),
            'pestprint.checkpoint_sha256': source_sha,
            'pestprint.unknown_method': 'trained_class',
            'pestprint.output_semantics': 'raw logits; apply softmax once along axis 1',
            'pestprint.preprocessing': 'EXIF transpose; RGB; Pillow bilinear resize 224x224; float32 RGB/255; NCHW; no mean/std',
        })
        onnx.checker.check_model(graph, full_check=True)
        opsets = {item.domain or 'ai.onnx': item.version for item in graph.opset_import}
        if opsets.get('ai.onnx') != args.opset or set(opsets) != {'ai.onnx'}:
            raise ValueError(f'Unexpected opsets or custom operators: {opsets}')
        if any(x.data_type in [onnx.TensorProto.FLOAT16, onnx.TensorProto.DOUBLE, onnx.TensorProto.BFLOAT16] for x in graph.graph.initializer):
            raise ValueError('Unexpected non-FP32 floating-point weights.')
        onnx.save(graph, temporary)
        session = ort.InferenceSession(str(temporary), providers=['CPUExecutionProvider'])
        input_info, = session.get_inputs()
        output_info, = session.get_outputs()
        if (input_info.name, input_info.type, input_info.shape) != (INPUT_NAME, 'tensor(float)', list(INPUT_SHAPE)):
            raise ValueError('Unexpected ONNX input contract.')
        if (output_info.name, output_info.type, output_info.shape) != (OUTPUT_NAME, 'tensor(float)', list(OUTPUT_SHAPE)):
            raise ValueError('Unexpected ONNX output contract.')
        output, = session.run([OUTPUT_NAME], {INPUT_NAME: example.numpy()})
        if output.shape != OUTPUT_SHAPE or not np.isfinite(output).all():
            raise ValueError('Invalid ONNX smoke-test output.')
        del session
        if sha256(args.checkpoint) != source_sha:
            raise RuntimeError('Source checkpoint changed during conversion.')
        temporary.replace(args.output)
    metadata = {
        'export_status': 'SUCCESS', 'numerical_validation': 'Run validate.py; export smoke test alone is insufficient.',
        'created_utc': datetime.now(timezone.utc).isoformat(), 'environment': environment(),
        'architecture': 'EfficientNet-B0', 'precision': 'FP32',
        'checkpoint': {'filename': args.checkpoint.name, 'bytes': args.checkpoint.stat().st_size, 'sha256': source_sha},
        'onnx': {'filename': args.output.name, 'bytes': args.output.stat().st_size, 'sha256': sha256(args.output),
                 'opset': args.opset, 'ir_version': graph.ir_version, 'external_data': False,
                 'operators': sorted({node.op_type for node in graph.graph.node}), 'custom_operators': False},
        'input': {'name': INPUT_NAME, 'dtype': 'float32', 'shape': list(INPUT_SHAPE), 'layout': 'NCHW', 'channel_order': 'RGB'},
        'preprocessing': {'exif_orientation_correction': True, 'convert': 'RGB', 'resize_hw': [224, 224],
                          'resize': 'Pillow bilinear, antialiased downsampling; stretch, no crop',
                          'scale': 'uint8 / 255.0', 'mean_std_normalization': None, 'included_in_graph': False},
        'output': {'name': OUTPUT_NAME, 'dtype': 'float32', 'shape': list(OUTPUT_SHAPE), 'semantics': 'raw logits',
                   'postprocessing': 'stable float32 softmax along axis 1, then argmax; apply softmax once',
                   'included_in_graph': False, 'unknown_method': 'trained_class'},
        'classes': [{'index': i, 'id': c, 'display_name': CLASS_NAMES[i], 'dataset_folder': CLASS_FOLDERS[i]} for i, c in enumerate(CLASS_IDS)],
        'android_runtime_target': {'package': 'onnxruntime-react-native', 'version': '1.24.3', 'device_validation': 'not performed in Phase 11B'},
    }
    write_json(args.output.parent / 'metadata.json', metadata)
    print(json.dumps({'export': 'SUCCESS', 'file': str(args.output), 'bytes': metadata['onnx']['bytes'], 'sha256': metadata['onnx']['sha256'], 'opset': args.opset, 'ir_version': graph.ir_version}))


if __name__ == '__main__':
    main()
