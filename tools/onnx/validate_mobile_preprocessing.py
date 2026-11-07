"""Compare the Android module's pure Java orientation/resizer against Pillow.

This host test starts from Pillow-decoded RGB. Android JPEG/PNG decoding is NOT
covered; validate that separately on an emulator/device before claiming parity.
"""
import argparse
from pathlib import Path
import json
import os
import struct
import subprocess

import numpy as np
from PIL import Image, ImageOps
import onnxruntime as ort

from common import ROOT, ONNX_PATH, configure_console, write_json


def main():
    configure_console()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jdk', type=Path, default=Path(os.environ.get('JAVA_HOME', 'C:/Program Files/Eclipse Adoptium/jdk-21.0.8.9-hotspot')))
    args = parser.parse_args()
    directory = ROOT / '.artifacts/phase11c-preprocessing'
    directory.mkdir(parents=True, exist_ok=True)
    classes = directory / 'classes'
    classes.mkdir(exist_ok=True)
    java = ROOT / 'mobile/modules/pestprint-image-tensor/android/src/main/java/expo/modules/pestprintimage/PillowPreprocessor.java'
    harness = ROOT / 'mobile/scripts/PreprocessHarness.java'
    subprocess.run([str(args.jdk / 'bin/javac.exe'), '-d', str(classes), str(java), str(harness)], check=True)
    references = [json.loads(line) for line in (ROOT / 'model/onnx/validation-samples.jsonl').read_text().splitlines()]
    cases = []
    for row in references:
        with Image.open(ROOT / 'dataset' / row['image']) as source:
            orientation = int(source.getexif().get(274, 1))
            rgb = source.convert('RGB')
            expected = np.asarray(ImageOps.exif_transpose(source).convert('RGB').resize((224, 224), Image.Resampling.BILINEAR), dtype=np.float32).transpose(2, 0, 1) / np.float32(255)
            cases.append((row['image'], rgb, orientation, expected, row))
    random = np.random.default_rng(1103)
    sizes = [(1, 1), (1, 1001), (1001, 1), (3, 5), (224, 224), (333, 257), (1001, 733)]
    for width, height in sizes:
        array = random.integers(0, 256, (height, width, 3), dtype=np.uint8)
        rgb = Image.fromarray(array)
        expected = np.asarray(rgb.resize((224, 224), Image.Resampling.BILINEAR), dtype=np.float32).transpose(2, 0, 1) / np.float32(255)
        cases.append((f'synthetic-resize-{width}x{height}', rgb, 1, expected, None))
    for orientation in range(1, 9):
        rgb = Image.fromarray(random.integers(0, 256, (37, 29, 3), dtype=np.uint8))
        rgb.getexif()[274] = orientation
        expected = np.asarray(ImageOps.exif_transpose(rgb).resize((224, 224), Image.Resampling.BILINEAR), dtype=np.float32).transpose(2, 0, 1) / np.float32(255)
        cases.append((f'synthetic-exif-{orientation}', rgb, orientation, expected, None))
    lines = []
    for i, (_, rgb, orientation, _, _) in enumerate(cases):
        source = directory / f'{i}.rgb'
        source.write_bytes(struct.pack('>iii', rgb.width, rgb.height, orientation) + rgb.tobytes())
        lines.append(f'{source}\t{directory / f"{i}.f32"}')
    manifest = directory / 'cases.tsv'
    manifest.write_text('\n'.join(lines), encoding='utf-8')
    subprocess.run([str(args.jdk / 'bin/java.exe'), '-cp', str(classes), 'PreprocessHarness', str(manifest)], check=True)
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    session = ort.InferenceSession(str(ONNX_PATH), sess_options=options, providers=['CPUExecutionProvider'])
    max_tensor = max_logit = 0.0
    changes, failures = [], []
    for i, (name, _, _, expected, reference) in enumerate(cases):
        actual = np.fromfile(directory / f'{i}.f32', dtype='<f4').reshape(3, 224, 224)
        delta = float(np.abs(actual.astype(np.float64) - expected.astype(np.float64)).max())
        max_tensor = max(max_tensor, delta)
        if delta != 0:
            failures.append({'image': name, 'tensor_max_absolute_difference': delta})
        if reference:
            logits = session.run(['logits'], {'image': actual[np.newaxis]})[0][0]
            difference = float(np.abs(logits.astype(np.float64) - np.asarray(reference['onnx_logits'])).max())
            max_logit = max(max_logit, difference)
            if int(np.argmax(logits)) != reference['onnx_index']:
                changes.append(name)
    report = {
        'status': 'SUCCESS' if not failures and not changes and max_logit <= 1e-4 else 'FAILED',
        'scope': 'Host JVM test of actual Java resizer/EXIF permutation, starting from Python-decoded RGB. NOT Android image decode or on-device inference.',
        'cases': len(cases), 'held_out_images': len(references), 'synthetic_resize_and_exif_cases': len(cases) - len(references),
        'max_tensor_absolute_difference': max_tensor, 'max_onnx_logit_difference_from_phase11b': max_logit,
        'changed_classes': changes, 'tensor_failures': failures,
    }
    write_json(ROOT / '.artifacts/phase11c-preprocessing-report.json', report)
    print(json.dumps(report, indent=2))
    return 0 if report['status'] == 'SUCCESS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
