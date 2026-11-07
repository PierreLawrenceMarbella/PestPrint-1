"""Deployment safety tests. Downloads use local fixtures; no cloud requests."""
import hashlib
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from deploy.backend import prepare_model as provision

INSPECTED_MANIFEST = provision.MANIFEST

class PreparationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / 'checkpoint.pth'
        self.content = b'checkpoint download fixture, never used for inference'
        manifest = {'bytes': len(self.content), 'sha256': hashlib.sha256(self.content).hexdigest()}
        self.manifest = manifest
        self.patch = patch.object(provision, 'MANIFEST', manifest)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def test_inspected_local_model_is_unchanged(self):
        path = provision.ROOT / 'model' / 'efficientnet_b0_rice_pest.pth'
        if not path.exists():
            self.skipTest('Local checkpoint not available')
        provision.verify_model(path, INSPECTED_MANIFEST)

    def test_existing_checkpoint_is_verified_without_network(self):
        self.path.write_bytes(self.content)
        with patch.object(provision, 'build_opener') as network:
            self.assertEqual(provision.prepare_model(self.path), self.path)
            network.assert_not_called()

    def test_wrong_existing_checkpoint_is_not_overwritten(self):
        self.path.write_bytes(b'wrong checkpoint')
        with self.assertRaises(RuntimeError):
            provision.prepare_model(self.path, 'https://example.invalid/model')
        self.assertEqual(self.path.read_bytes(), b'wrong checkpoint')

    def test_missing_model_requires_configuration(self):
        with patch.dict('os.environ', {}, clear=True), self.assertRaisesRegex(RuntimeError, 'Model missing'):
            provision.prepare_model(self.path)

    def test_http_and_insecure_redirects_are_rejected(self):
        for url in ['http://example.invalid/model', 'file:///checkpoint', 'https://user:pass@example.invalid/model']:
            with self.assertRaises(ValueError):
                provision.require_https(url)
        with self.assertRaises(ValueError):
            provision.HttpsRedirects().redirect_request(None, None, 302, '', {}, 'http://example.invalid/model')

    def download(self, content):
        with patch.object(provision, 'build_opener') as network:
            network.return_value.open.return_value = io.BytesIO(content)
            return provision.prepare_model(self.path, 'https://example.invalid/model?secret=hidden')

    def test_verified_download_is_installed_atomically(self):
        self.assertEqual(self.download(self.content), self.path)
        self.assertEqual(self.path.read_bytes(), self.content)
        self.assertEqual(list(self.path.parent.glob('*.download')), [])

    def test_failed_downloads_are_cleaned_and_secrets_not_exposed(self):
        for content in [b'x' * len(self.content), self.content + b'oversized', b'short']:
            with self.assertRaises(RuntimeError) as failure:
                self.download(content)
            self.assertNotIn('hidden', str(failure.exception))
            self.assertFalse(self.path.exists())
            self.assertEqual(list(self.path.parent.glob('*.download')), [])


class ReadinessTests(unittest.TestCase):
    def test_readiness_uses_model_availability_without_changing_client_health(self):
        from deploy.backend.wsgi import app, classifier
        client = app.test_client()
        for available, status in [(False, 503), (True, 200)]:
            with patch.object(classifier, 'available', available):
                response = client.get('/api/ready')
                self.assertEqual(response.status_code, status)
                self.assertEqual(response.json, {'available': available})
                self.assertEqual(client.get('/api/health').status_code, 200)


if __name__ == '__main__':
    unittest.main()
