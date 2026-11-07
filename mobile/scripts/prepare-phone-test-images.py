"""Copy four genuine held-out files and their saved model outputs for phone testing."""
import hashlib
import json
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[2]
references = [json.loads(line) for line in (root / 'model/onnx/validation-samples.jsonl').read_text().splitlines() if line.strip()]
destination = root / 'mobile/builds/offline-test-images'
destination.mkdir(parents=True, exist_ok=True)
results = []
for index, name in enumerate(['healthy-rice', 'rice-leaffolder', 'stem-borer', 'unknown']):
    row = next(r for r in references if r['label_index'] == index and r['onnx_index'] == index)
    source = root / 'dataset' / row['image']
    data = source.read_bytes()
    assert hashlib.sha256(data).hexdigest() == row['image_sha256']
    extension = '.png' if data.startswith(b'\x89PNG\r\n\x1a\n') else '.jpg'
    assert extension == '.png' or data.startswith(b'\xff\xd8\xff'), 'Phone test files must contain actual PNG/JPEG data'
    target = destination / f'{index + 1:02}-{name}{extension}'
    # Some dataset filenames say .jpg while containing PNG. Correct only the
    # generated copy's name so normal gallery validation accepts identical bytes.
    previous = destination / f'{index + 1:02}-{name}{source.suffix.lower()}'
    if previous != target and previous.exists():
        assert hashlib.sha256(previous.read_bytes()).hexdigest() == row['image_sha256'], 'Refusing to replace an unrelated generated test file'
        previous.unlink()
    shutil.copyfile(source, target)
    results.append({
        'file': target.name, 'original': row['image'], 'sha256': row['image_sha256'],
        'expected_index': index, 'expected_class': row['onnx_class_name'],
        'saved_onnx_probabilities': row['onnx_probabilities'],
        'saved_onnx_confidence_percent': row['onnx_probabilities'][index] * 100,
        'scope': 'Genuine saved Phase 11B prediction, not a generated fixture. Tiny FP32 device differences are possible.',
    })
(destination / 'expected-results.json').write_text(json.dumps(results, indent=2) + '\n')
print(f'Prepared four unchanged held-out images and saved predictions: {destination}')
