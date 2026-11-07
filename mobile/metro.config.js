const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
if (process.env.PESTPRINT_BUILD_WORKERS === '2') config.maxWorkers = 2;
config.resolver.assetExts = [...new Set([...config.resolver.assetExts, 'onnx'])];
module.exports = config;
