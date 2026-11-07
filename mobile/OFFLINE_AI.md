# Offline AI integration — Phase 11C

Phase 11D standalone builds and phone installation are documented in
[BUILD_ANDROID.md](BUILD_ANDROID.md) and [PHASE_11D_REPORT.md](PHASE_11D_REPORT.md).
The results below record the Phase 11C development-build verification.

The Analyze action now uses `OnDeviceInferenceService`, not the Flask API.
The website backend and earlier online preparation remain unchanged. No API URL
selects mobile inference, and there is no automatic online fallback.

## Model and packaging

- Source: `../model/onnx/efficientnet_b0_rice_pest.onnx`, unchanged Phase 11B FP32 model.
- Bundled copy: `assets/models/efficientnet_b0_rice_pest.onnx`, 16,643,470 bytes.
- SHA-256: `213a20863a6e2e1b91d33452a31a0d5764e0a2670b5703cc6a464090f15d9c61`.
- Input `image`: float32 `[1,3,224,224]`; output `logits`: float32 `[1,4]`.
- Class indices: Healthy Rice, Rice Leaffolder, Stem Borer, Unknown (Other Damage).
- Unknown is trained output 3. Stable softmax is applied exactly once; no threshold.

Run `npm.cmd run prepare:model` before prebuild/EAS upload. It copies only the
checksum-verified source artifact and refuses a wrong existing copy. The original
model is never overwritten. If cloning the repository, obtain the Phase 11B
artifact from team storage first; model binaries intentionally remain outside Git.

`withOfflineModel.cjs` copies the verified binary into Android's packaged assets.
The native helper extracts that **local packaged asset** into private app storage
and verifies its checksum before creating a session. No first-launch download is
used. The `.onnx` Metro extension is configured, but the model is embedded once as
a native Android asset, not duplicated through a JavaScript `require`.

The repository-root `.easignore` includes the mobile model in locally uploaded
EAS archives while excluding datasets, environments, dependencies, native build
folders, and `.env.local`. The pre-install hook fails if the archive lacks the
correct binary. GitHub-only remote builds cannot obtain a Git-ignored model from
Git: a CI/artifact provisioning step must put the verified file in the archive
before upload. Do not confuse ignore-rule tests with an actual EAS archive inspection.

## Native runtime

Pinned `onnxruntime-react-native@1.24.3`, matching Phase 11B's CPU validation.
The official Expo plugin enables native linking. A small local plugin pins the
Android CPU AAR to 1.24.3 (the published package requests `latest.integration`)
and replaces its removed Gradle `VersionNumber` check with an equivalent numeric
comparison. A repeatable post-install patch also removes the legacy `unimodule.json`
marker so modern Expo autolinking registers `OnnxruntimePackage` as a React Native
module. Expo 57, React Native 0.86.3, and Gradle 9.3.1 are preserved.

Use a custom development build; Expo Go cannot run these native modules. The
runtime is imported lazily so Expo Go can still display screens and a useful
native-build requirement rather than crashing at app launch.

The service owns one lazy, reusable CPU session. It checks the tensor contracts,
returns genuine on-device results and all four probabilities, and records local
timings. The existing analysis controller drives the processing screen. UI
cancellation discards stale results; it does not pretend to interrupt a running
native kernel. Another native job cannot overlap it. Sessions are released after
backgrounding (after any active job finishes) and during development hot reload.
Tensor files are removed after reading; ONNX input/output tensors are disposed.
The existing result card has optional expandable probability details using the
actual four scores; confidence and category themes retain their existing styling.

## Image preprocessing

`modules/pestprint-image-tensor` is an Android-only local Expo module. Its async
functions perform decoding/resampling off the JS thread. The picker retains
`quality: 1` and no editing; the inspected Expo Android implementation uses its
raw file exporter at that setting, without an additional image recompression.

Pipeline: local file/content URI → genuine JPEG/PNG and size checks → EXIF
orientation → RGB → Pillow-compatible 224×224 bilinear/antialiased resize →
float32 RGB/255 → NCHW. No mean/std normalization or center crop is added.
The resampler reproduces Pillow's 22-bit coefficients, byte rounding between
passes, and Pillow 13's vertical-first rule for strongly portrait downsampling.
The source bitmap is recycled; narrow intermediate rows avoid another full-size
rotated bitmap. Limits are 10 MiB, 25 megapixels, and 16,384 pixels per dimension;
low-memory decoding failures have a useful error path.

Host JVM parity tests use the actual Java resampler but start with **Python-decoded
RGB**. Separately, actual Android decoding and preprocessing were tested on all
160 held-out files: their tensors matched the pinned Python pipeline exactly.
Unseen color profiles, transparent images, camera vendors, and physical devices
still require broader coverage; parity on these files is not a universal decoder guarantee.

## Development commands

From `mobile/`, with Node 24, JDK 21, and Android SDK configured:

```powershell
npm.cmd ci
npm.cmd run prepare:model
npm.cmd run build:dev
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
npm.cmd start -- --dev-client
```

`build:dev` compiles a debug development APK for ARM64 and x86_64, using the
Windows path-length and low-memory build settings verified in this checkout.
Pass `-- -Device emulator-5554` to install on that device after compilation.
`android:native` is also available on machines without these Windows build constraints. If invoking
prebuild directly, use `npx.cmd expo prebuild --platform android --no-install`
after preparing the model. Expo may regenerate the ignored native project.
Development JavaScript still uses Metro; this does not imply that local inference
uses the network. A final standalone, embedded-JavaScript APK belongs to Phase 11D.

On the 8 GB validation machine, compile before starting the emulator/Metro. For
lower C++ compilation memory use, the optional Gradle init script limits Ninja
compiler jobs without changing runtime behavior:

```powershell
cd android
.\gradlew.bat :app:assembleDebug --no-daemon --max-workers=1 -I ..\scripts\low-memory.gradle '-Dorg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m'
```

The EAS `development` profile is configured for a native development client;
no cloud build was requested in Phase 11C. Final release APK generation is out
of scope. No Flask process is required to analyze an image in the native app.

## Verification tools

```powershell
npm.cmd run typecheck
npm.cmd run test:offline
npm.cmd run test:api
npx.cmd expo install --check
npx.cmd expo-doctor
npm.cmd run export:android
```

From the repository root, test the Java resize/EXIF arithmetic against Python:

```powershell
.artifacts\venv-onnx\Scripts\python.exe tools/onnx/validate_mobile_preprocessing.py
```

The host test needs the Phase 11B environment/dataset/reference JSONL and a JDK;
it generates only ignored `.artifacts/` files. The offline unit tests explicitly
label mocked runtime fixtures, separately compare JS softmax with genuine saved
reference logits, and never present fixture predictions as native verification.

Development builds expose `globalThis.__pestprintOfflineDiagnostics` only under
`__DEV__`, for native model/tensor verification from the Hermes inspector. It
executes actual selected local files; it does not simulate predictions. It is not
registered in release builds. Use it only with development test images.

With Metro, the installed development build, and `emulator-5554` connected,
run from `mobile/`:

```powershell
node scripts/check-native-offline.cjs --all --cold
```

This runs actual native inference, verifies transported image hashes, blocks
JavaScript `fetch`, disables wireless connectivity during testing, and writes
ignored results and Android tensors under `../.artifacts/phase11c-native/`.
The inspector connection uses USB/ADB loopback for development control only.
Then, from the repository root:

```powershell
.artifacts\venv-onnx\Scripts\python.exe tools/onnx/compare_android_tensors.py
```

The comparator checks the saved Android tensors against Pillow and runs those
same tensors through desktop ONNX Runtime to separate preprocessing differences
from runtime differences. These tools require the held-out dataset and Phase 11B
reference files; they do not substitute generated predictions for missing files.

## Current verification

- TypeScript, Expo dependency check, and Expo Doctor (21/21): passed.
- Offline unit/postprocessing/packaging tests: 7 passed; retained API tests: 9 passed.
- Existing Flask/backend tests: 6 passed; original checkpoint/model checksums unchanged.
- JS softmax versus 160 genuine ONNX reference outputs: maximum probability
  difference `1.1920928955078125e-7`; no class changes.
- Host Java resize/EXIF test: 160 held-out images plus 15 synthetic cases;
  exact tensor equality and zero ONNX logit differences for Python-decoded RGB.
- Android JavaScript/Hermes export: passed. This is not an Android APK test.
- Native debug build: **passed**, ARM64 and x86_64, JDK 21 / Gradle 9.3.1.
  The APK contains the exact model checksum and both native runtime libraries.
  Development APK size: 225,723,607 bytes (multi-ABI debug build, not release size).
- Actual Android API 36 x86_64 emulator: **160/160 predictions matched** the
  saved ONNX/PyTorch reference class indices. Each ground-truth category supplied
  40 held-out images (20 validation, 20 testing; 159 unique image contents overall).
  This measures conversion/integration agreement, not 100% classification accuracy.
- Android tensors: **exact equality**, maximum absolute difference `0.0`.
  Android versus desktop ONNX raw logits: maximum difference `0.0`.
  Maximum softmax probability difference: `1.1920928955078125e-7`.
- Native model cache was removed before the full test, proving extraction from
  the packaged asset. Airplane mode was enabled, Wi-Fi/mobile data disabled,
  and `fetch` blocked: **zero attempted fetch calls** during classification.
- Invalid image returned a typed preprocessing error. All 160 sequential native
  analyses completed; no inference crash occurred. Cancellation and duplicate
  job prevention also passed the explicitly mocked lifecycle unit tests.
- Emulator UI checks passed: gallery selection, genuine Healthy Rice result,
  actual probability expansion, Analyze Another Image, camera permission/capture,
  camera-image inference, replacement, and removal. The virtual camera scene was
  not a rice sample; that check establishes camera-flow operation only.
- Emulator timings: first initialization 533.75 ms; first total analysis 662.63 ms.
  Warm medians: preprocessing 21.98 ms, inference 17.58 ms, total 56.59 ms.
  These are development-emulator observations, not physical-phone guarantees.
- Whole-app `dumpsys meminfo` PSS (including swap) was approximately 568.6 MiB
  before and 559.7 MiB after the 160-image run. Native heap PSS was approximately
  103.9 / 99.9 MiB. Debug/Metro/graphics overhead and substantial emulator swap
  make these unsuitable as model-only RAM figures or production memory budgets.

## Files and Phase 11D boundary

The integration adds `src/services/OnDeviceInferenceService.ts`,
`nativeOfflineRuntime.ts`, `offlineResult.ts`, `src/types/offline.ts`, the local
`modules/pestprint-image-tensor/` module, model manifest, packaging/runtime config
plugins, build/validation scripts, and `ResultProbabilities.tsx`. It updates the
existing inference selector, result types/guards, lifecycle error text, About and
Processing copy, package/config files, and mobile documentation. Existing camera,
gallery, navigation, page layouts, website, backend, and original model are preserved.

**Phase 11C: COMPLETE with native emulator verification.** Phase 11D must build
the final standalone APK with embedded JavaScript, check clean-install/offline
launch without Metro or a laptop, and test physical ARM64 farmer devices: camera
vendors, permissions/cancellation, low-memory behavior, thermal/battery use,
accessibility, and broader image-format coverage. ARM64 compiled successfully but
was not executed on a physical phone. A real EAS upload/archive was not tested.
No final release APK, online deployment, or model changes were made in this phase.

The original known dependency audit still reports seven inherited advisories
(four moderate, three high). No forced Expo/React Native downgrade or major
upgrade was applied to address unrelated dependency changes.
