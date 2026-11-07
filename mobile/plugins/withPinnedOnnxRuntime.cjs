const { withDangerousMod, createRunOncePlugin } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

function patchOnnxAndroid(projectRoot) {
    const packageFile = require.resolve('onnxruntime-react-native/package.json', { paths: [projectRoot] });
    const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    if (pkg.version !== '1.24.3') throw new Error('Review native ONNX compatibility before changing the pinned runtime.');
    const gradle = path.join(path.dirname(packageFile), 'android/build.gradle');
    let source = fs.readFileSync(gradle, 'utf8');
    // The published package requests latest.integration for its AAR. Pin the
    // CPU AAR to the exact version used for Phase 11B validation and JS bindings.
    source = source.replaceAll('onnxruntime-android:latest.integration', 'onnxruntime-android:1.24.3');
    // Gradle 9 removed the implicit VersionNumber utility used by this release.
    // Preserve the original pre-0.71 branch without downgrading Expo or Gradle.
    source = source.replaceAll('VersionNumber.parse(REACT_NATIVE_VERSION) < VersionNumber.parse("0.71")',
      '(REACT_NATIVE_VERSION.tokenize(".")[0].toInteger() == 0 && REACT_NATIVE_VERSION.tokenize(".")[1].toInteger() < 71)');
    if (source.includes('VersionNumber.parse')) throw new Error('Unexpected ONNX Gradle version check; review compatibility.');
    if (!source.includes('onnxruntime-android:1.24.3')) throw new Error('Unexpected ONNX Android dependency configuration.');
    fs.writeFileSync(gradle, source);
    // NDK 27 needs explicit page-aligned linking for modern Android devices.
    // The CPU AAR is already aligned; this applies only to the local JSI bridge.
    const cmake = path.join(path.dirname(packageFile), 'android/CMakeLists.txt');
    let nativeSource = fs.readFileSync(cmake, 'utf8');
    if (!nativeSource.includes('# PESTPRINT 16 KiB bridge alignment')) {
      nativeSource += '\n# PESTPRINT 16 KiB bridge alignment\ntarget_link_options(onnxruntimejsi PRIVATE "-Wl,-z,max-page-size=16384" "-Wl,-z,common-page-size=16384")\n';
      fs.writeFileSync(cmake, nativeSource);
    }
    // This ReactPackage is not an Expo module. Its legacy marker otherwise
    // excludes OnnxruntimePackage from modern Expo's React Native autolinking.
    const legacyMarker = path.join(path.dirname(packageFile), 'unimodule.json');
    if (fs.existsSync(legacyMarker)) fs.unlinkSync(legacyMarker);
}

function withPinnedOnnxRuntime(config) {
  return withDangerousMod(config, ['android', async (mod) => {
    patchOnnxAndroid(mod.modRequest.projectRoot);
    return mod;
  }]);
}
module.exports = createRunOncePlugin(withPinnedOnnxRuntime, 'pestprint-pinned-onnx-runtime', '1.0.0');
module.exports.patchOnnxAndroid = patchOnnxAndroid;
