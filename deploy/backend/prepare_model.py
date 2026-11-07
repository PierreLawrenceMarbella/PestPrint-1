"""Provision the inspected checkpoint without putting weights or credentials in Git."""
import hashlib
import json
import os
from pathlib import Path
import tempfile
import time
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = json.loads(Path(__file__).with_name('model-manifest.json').read_text())


def require_https(url):
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('The model download must use HTTPS without URL user credentials.')
    return url


class HttpsRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        require_https(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def verify_model(path, manifest=None):
    manifest = manifest or MANIFEST
    if path.stat().st_size != manifest['bytes']:
        raise RuntimeError('Model size does not match the inspected checkpoint.')
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(64 * 1024), b''):
            digest.update(chunk)
    if digest.hexdigest() != manifest['sha256']:
        raise RuntimeError('Model checksum does not match the inspected checkpoint.')


def prepare_model(destination=None, download_url=None):
    destination = destination or ROOT / 'model' / MANIFEST['filename']
    if destination.exists():
        # Never overwrite an existing checkpoint, including one with a wrong hash.
        verify_model(destination)
        return destination
    download_url = download_url or os.environ.get('MODEL_DOWNLOAD_URL')
    if not download_url:
        raise RuntimeError('Model missing. Mount the verified checkpoint or configure MODEL_DOWNLOAD_URL as a server secret.')
    require_https(download_url)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        deadline = time.monotonic() + 120
        request = Request(download_url, headers={'User-Agent': 'PESTPRINT-model-provisioner/1'})
        with build_opener(HttpsRedirects()).open(request, timeout=30) as response:
            with tempfile.NamedTemporaryFile(dir=destination.parent, suffix='.download', delete=False) as output:
                temporary = Path(output.name)
                size = 0
                while True:
                    if time.monotonic() > deadline:
                        raise TimeoutError('Model download deadline exceeded.')
                    chunk = response.read(64 * 1024)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > MANIFEST['bytes']:
                        raise RuntimeError('Model download exceeds the inspected checkpoint size.')
                    output.write(chunk)
        verify_model(temporary)
        os.replace(temporary, destination)
        return destination
    except Exception:
        # A signed URL can contain credentials. Do not log URL-bearing exceptions.
        raise RuntimeError('Model provisioning failed. Check the server secret, HTTPS download access, and checkpoint checksum.') from None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


if __name__ == '__main__':
    prepare_model()
    print('Verified PESTPRINT checkpoint is ready.')
