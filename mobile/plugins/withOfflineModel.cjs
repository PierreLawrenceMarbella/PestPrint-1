const { withDangerousMod, createRunOncePlugin } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// expo-asset's plugin does not accept .onnx. Embed one raw Android asset explicitly.
function withOfflineModel(config) {
  return withDangerousMod(config, ['android', async (mod) => {
    const root = mod.modRequest.projectRoot;
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/models/model-manifest.json'), 'utf8'));
    const bytes = fs.readFileSync(path.join(root, 'assets/models', manifest.filename));
    if (bytes.length !== manifest.bytes || crypto.createHash('sha256').update(bytes).digest('hex') !== manifest.sha256) {
      throw new Error('The Android model asset must match the validated Phase 11B checksum.');
    }
    const destination = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/assets', manifest.filename);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
    return mod;
  }]);
}
module.exports = createRunOncePlugin(withOfflineModel, 'pestprint-offline-model', '1.0.0');
