"""Shared Phase 11B contracts; never imports training or changes backend files."""
import hashlib
from importlib.metadata import version
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

CLASS_IDS = ('healthy_rice', 'rice_leaffolder', 'rice_stem_borer', 'unknown')
CLASS_NAMES = ('Healthy Rice', 'Rice Leaffolder', 'Stem Borer', 'Unknown (Other Damage)')
CLASS_FOLDERS = ('healthy', 'leaffolder', 'stemborer', 'unknown')
INPUT_NAME = 'image'
OUTPUT_NAME = 'logits'
INPUT_SHAPE = (1, 3, 224, 224)
OUTPUT_SHAPE = (1, 4)
CHECKPOINT = ROOT / 'model/efficientnet_b0_rice_pest.pth'
ONNX_PATH = ROOT / 'model/onnx/efficientnet_b0_rice_pest.onnx'
SOURCE_SHA256 = '41c048b34844319902c5a3c36fce86254a7eccb1cf463eec7662a331c511734f'


def configure_console():
    # PyTorch's exporter prints Unicode status symbols even in Windows pipes.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8')


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def load_classifier(checkpoint):
    if sha256(checkpoint) != SOURCE_SHA256:
        raise ValueError('Checkpoint differs from the inspected Phase 11A weights; refusing to convert/validate another model.')
    from inference import RiceClassifier
    classifier = RiceClassifier(checkpoint)
    if not classifier.available:
        raise RuntimeError('Original checkpoint could not be loaded.')
    if tuple(classifier.classes) != CLASS_IDS:
        raise ValueError('Backend class order has changed.')
    if classifier.device.type != 'cpu':
        raise ValueError('Use the documented CPU-only conversion environment.')
    classifier.model.eval()
    if tuple(classifier.model.classifier[1].weight.shape) != (4, 1280):
        raise ValueError('Unexpected EfficientNet-B0 classifier head.')
    return classifier


def environment():
    import platform
    return {
        'python': platform.python_version(), 'platform': platform.platform(),
        'packages': {p: version(p) for p in ['torch', 'torchvision', 'onnx', 'onnxscript', 'onnxruntime', 'numpy', 'Pillow']},
    }


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    temporary.replace(path)
