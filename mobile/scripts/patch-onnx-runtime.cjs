// Deterministic package compatibility fixes, shared with the Expo prebuild plugin.
const path = require('node:path');
require('../plugins/withPinnedOnnxRuntime.cjs').patchOnnxAndroid(path.resolve(__dirname, '..'));
console.log('Patched ONNX 1.24.3 Android Gradle compatibility, pinned CPU AAR, and Expo autolinking marker.');
