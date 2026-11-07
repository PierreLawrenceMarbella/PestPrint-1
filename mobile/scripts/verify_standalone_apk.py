"""Verify the actual standalone APK, not just the prebuild source files."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import struct
import sys
import zipfile


def main():
    apk = Path(sys.argv[1]).resolve()
    mobile = Path(__file__).resolve().parents[1]
    manifest = json.loads((mobile / 'assets/models/model-manifest.json').read_text())
    sdk = Path(os.environ.get('ANDROID_HOME', str(Path(os.environ['LOCALAPPDATA']) / 'Android/Sdk')))
    tools = sdk / 'build-tools/36.0.0'
    with zipfile.ZipFile(apk) as archive:
        entries = archive.namelist()
        model_entries = [name for name in entries if name.endswith('.onnx')]
        assert model_entries == ['assets/' + manifest['filename']], model_entries
        model = archive.read(model_entries[0])
        assert len(model) == manifest['bytes']
        assert hashlib.sha256(model).hexdigest() == manifest['sha256']
        bundle = archive.read('assets/index.android.bundle')
        assert len(bundle) > 100_000, 'Missing embedded application JavaScript'
        assert bundle[:8].hex() == 'c61fbc03c103191f', 'Expected production Hermes bytecode'
        assert b'__pestprintOfflineDiagnostics' not in bundle, 'Development diagnostic global leaked into release'
        abis = sorted({name.split('/')[1] for name in entries if name.startswith('lib/') and name.endswith('/libonnxruntime.so')})
        assert 'arm64-v8a' in abis, 'ARM64 runtime is required for Android phones'
        for abi in abis:
            for library in ['libonnxruntime.so', 'libonnxruntimejsi.so', 'libhermesvm.so', 'libappmodules.so']:
                assert f'lib/{abi}/{library}' in entries, f'Missing {abi}/{library}'
        elf_alignments = []
        for name in entries:
            if not (name.startswith('lib/') and name.endswith('.so')):
                continue
            library = archive.read(name)
            assert library[:6] == b'\x7fELF\x02\x01', f'Expected 64-bit little-endian ELF: {name}'
            offset = struct.unpack_from('<Q', library, 32)[0]
            size, count = struct.unpack_from('<HH', library, 54)
            alignments = [struct.unpack_from('<Q', library, offset + i * size + 48)[0]
                          for i in range(count) if struct.unpack_from('<I', library, offset + i * size)[0] == 1]
            assert alignments and min(alignments) >= 16384, f'Native library lacks 16 KiB ELF alignment: {name}'
            elf_alignments.extend(alignments)
    signed = subprocess.check_output([str(tools / 'apksigner.bat'), 'verify', '--verbose', '--print-certs', str(apk)], text=True)
    assert 'Verified using v2 scheme (APK Signature Scheme v2): true' in signed
    assert 'CN=Android Debug' not in signed, 'A private standalone signing key is required'
    badging = subprocess.check_output([str(tools / 'aapt2.exe'), 'dump', 'badging', str(apk)], text=True, encoding='utf-8')
    assert "package: name='com.pestprint.mobile'" in badging
    assert "application-label:'PESTPRINT'" in badging
    assert 'application-debuggable' not in badging, 'Standalone APK must not be debuggable'
    subprocess.check_output([str(tools / 'zipalign.exe'), '-c', '-P', '16', '4', str(apk)], text=True)
    package = re.search(r"package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'", badging)
    certificate = re.search(r'Signer #1 certificate SHA-256 digest: (\w+)', signed)
    report = {
        'status': 'PACKAGING_AND_SIGNATURE_VERIFIED', 'apk': apk.name,
        'bytes': apk.stat().st_size, 'sha256': hashlib.sha256(apk.read_bytes()).hexdigest(),
        'build_type': 'standalone release APK, privately signed, non-debuggable',
        'package': package.group(1), 'version_code': int(package.group(2)), 'version_name': package.group(3),
        'model_bytes': len(model), 'model_sha256': manifest['sha256'],
        'embedded_hermes_bytes': len(bundle), 'native_abis': abis,
        'signer_certificate_sha256': certificate.group(1),
        'signature_v2_verified': True, 'development_diagnostics_absent': True,
        'zip_alignment_16kb_verified': True,
        'minimum_native_elf_load_alignment': min(elf_alignments),
    }
    apk.with_suffix('.build.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
