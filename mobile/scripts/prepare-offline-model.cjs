// No model downloads. Copy only the validated Phase 11B artifact, or verify it in place.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const mobile = path.resolve(__dirname, '..');
const manifest = require('../assets/models/model-manifest.json');
const destination = path.join(mobile, 'assets/models', manifest.filename);
const source = path.resolve(mobile, '../model/onnx', manifest.filename);
function verify(filename) {
  if (!fs.existsSync(filename)) throw new Error('Offline model missing. Run npm run prepare:model with the Phase 11B ONNX artifact available before creating the EAS archive.');
  const bytes = fs.readFileSync(filename);
  if (bytes.length !== manifest.bytes || crypto.createHash('sha256').update(bytes).digest('hex') !== manifest.sha256) {
    throw new Error('Offline model size/checksum differs from the validated Phase 11B artifact.');
  }
}
if (!fs.existsSync(destination) && !process.argv.includes('--verify-only')) {
  verify(source);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
}
verify(destination);
console.log(`Verified bundled offline model: ${manifest.filename} (${manifest.bytes} bytes; SHA-256 ${manifest.sha256})`);
