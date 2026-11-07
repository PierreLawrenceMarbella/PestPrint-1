"""Prepare a pinned build-only Ninja without replacing the Android SDK's copy."""
import hashlib
import io
from pathlib import Path
import subprocess
import urllib.request
import zipfile

root = Path(__file__).resolve().parents[2]
directory = root / '.artifacts/ninja-1.13.2'
binary = directory / 'ninja.exe'
exe_sha = 'e52a7ad9538d9618c67a0bd777964e2eec8a30f68b810a2f6adce1f2daf847b8'
if not binary.exists():
    archive = urllib.request.urlopen('https://github.com/ninja-build/ninja/releases/download/v1.13.2/ninja-win.zip', timeout=60).read()
    assert hashlib.sha256(archive).hexdigest() == '07fc8261b42b20e71d1720b39068c2e14ffcee6396b76fb7a795fb460b78dc65', 'Ninja archive checksum mismatch'
    executable = zipfile.ZipFile(io.BytesIO(archive)).read('ninja.exe')
    assert hashlib.sha256(executable).hexdigest() == exe_sha
    directory.mkdir(parents=True, exist_ok=True)
    binary.write_bytes(executable)
assert hashlib.sha256(binary.read_bytes()).hexdigest() == exe_sha, 'Cached Ninja checksum mismatch; refusing to execute'
assert subprocess.check_output([str(binary), '--version'], text=True).strip() == '1.13.2'
print(binary)
