# PESTPRINT Phase 11D — standalone Android APK

## Status

**Standalone APK build and emulator validation: COMPLETE.** Physical-phone
testing was not performed; you selected emulator testing and phone instructions.

- APK: [builds/pestprint-offline.apk](builds/pestprint-offline.apk)
- Size: **140,159,860 bytes (133.67 MiB)**.
- Version **1.0.0**, Android version code **1**, package `com.pestprint.mobile`.
- Privately signed **release APK**, non-debuggable, with embedded production
  Hermes JavaScript (3,475,160 bytes), ARM64 and x86_64 native libraries.
- Declared minimum Android version: 7.0 / API 24; 32-bit-only phones are not included.
- APK SHA-256: `f141de3f3c972c7ba32d2a849725dbeb80424b945e7c5296604d4e9fc3120bf1`.
- Public certificate SHA-256: `048fec7d6c86c040f45f127a743671f6f0033f7acc4d5c9c618125b15cf1c13d`.
- Build metadata: [pestprint-offline.build.json](builds/pestprint-offline.build.json).
- Executed test summary: [pestprint-offline.tests.json](builds/pestprint-offline.tests.json).

The actual APK passed model checksum/size, embedded Hermes bytecode, native
library, app identity, non-debuggable flag, v2 signature, ZIP alignment, and ELF
load-segment checks. All native libraries have at least 16,384-byte load alignment.
The development diagnostic global is absent from the release bundle.
The installed APK's SHA-256 was checked against the delivered file after testing.

## Executed standalone tests

Device: Android Emulator `Medium_Phone_API_36.1`, **Android 16 / API 36, x86_64,
4,096-byte memory pages**, 2 GiB guest RAM, software GPU, Windows host with about
8 GB RAM. Bulk tests used two virtual cores; a restart recheck used four cores.

- Fresh install after removing only the previous emulator development app: passed.
- Launch directly into PESTPRINT Home with its branding, fonts, image and buttons:
  passed. No Expo launcher/developer menu appeared.
- Expo Go was absent. Metro port 8081 had no listener. ADB reverse forwarding was
  empty. Airplane mode was 1, Wi-Fi 0, and mobile data 0 before first analysis.
- JPEG/PNG gallery selection, preview, replacement, removal, and Analyze Another
  Image: passed through the real UI.
- Four real held-out files were classified using the actual Analyze button:

| Original test-file bytes | Actual result | Actual displayed confidence (%) |
| --- | --- | --- |
| 01-healthy-rice.jpg | Healthy Rice | 98.46722483634949 |
| 02-rice-leaffolder.png | Rice Leaffolder | 78.4164309501648 |
| 03-stem-borer.jpg | Stem Borer | 99.91539716720581 |
| 04-unknown.jpg | Unknown (Other Damage) | 74.98895525932312 |

All four classes and confidence values matched their saved Phase 11B references.
The maximum probability difference across the expanded tables was
**2.9802322387695312e-8**. Scores were finite, summed to one, and appeared in the
original model-index order. These are integration checks, not a new accuracy estimate.

- **20/20** consecutive real re-analyses of the selected Unknown image passed.
  Android Back returned to the preview before every new Analyze action.
- Known-pest and Unknown Learn More screens and Back to Result passed.
- Camera permission denial showed useful guidance; retry/allow, cancellation,
  capture, preview, and genuine local inference passed.
- The camera photographed the emulator's virtual room. The model actually returned
  Healthy Rice at 40.35613536834717%. This verifies the camera flow, not crop
  accuracy, and shows an existing model limitation: non-rice images can receive a
  supported label. No threshold or remapping was added to hide this behavior.
- An original PNG mislabeled `.jpg` was correctly rejected while preserving the
  previous selection. The generated test copy was renamed `.png` without changing
  its bytes, checksum, or pixels. Original dataset files were left intact.
- All four Pest Guide details, Android Back, About, the four categories, bottom
  tabs, safe areas, and scrolling were checked. The removed category stays absent.
- After emulator reboot/power cycling, airplane mode/Wi-Fi/data settings persisted.
  PESTPRINT reopened and classified Rice Leaffolder with the same genuine scores.
  Android System UI displayed a boot ANR; choosing Wait allowed it to recover.
  This emulator issue is separate from PESTPRINT. No PESTPRINT crash was recorded
  in the completed test run or package exit history.

## Performance observations

First cold activity launch reported **2,376 ms** with `am start -W`; this includes
activity startup and is not model-only initialization time. The 20 warm UI runs
had a median **2.985 seconds** until UIAutomator verified their results, including
automation/dump overhead. That is not native kernel latency.

Reported whole-app PSS was **130.7 MiB** before first inference, **218.6 MiB** before
the repeated-analysis check, and **227.7 MiB** afterward. The short run is not proof
of leak-free operation or a phone RAM requirement. Exact release-kernel timing was
not instrumented. Phase 11C separately measured a 17.58 ms warm median native
inference time; that remains a development-build measurement.

## Checks and release issues fixed

- TypeScript: passed. Offline tests: **7 passed**, including credential exclusion.
- Expo Doctor: **21/21 passed**. Release-helper syntax checks: passed.
- Native `assembleRelease`: passed; actual APK verifier: passed.
- Private signing configured with Android Gradle's `finalizeDsl` lifecycle.
- Windows Ninja/path failures resolved with short generated C++ output paths and
  checksum-pinned project-local Ninja 1.13.2; no SDK binary or registry edits.
- SDK 57 prebuild uses `--no-clean` to retain generated work and build caches.
- Metro build workers bounded at two for the 8 GB build machine.
- APK verifier corrected for React Native 0.86's `libhermesvm.so` filename.
- ONNX JSI bridge's 4 KiB ELF alignment corrected with Android's recommended
  16 KiB linker settings. The runtime version, CPU model and prediction math stay intact.

Guidance: [Expo Windows builds](https://docs.expo.dev/troubleshooting/windows-long-paths/),
[Android native page sizes](https://developer.android.com/guide/practices/page-sizes).

## Preserved model and application

EfficientNet-B0 FP32 ONNX opset 18, 16,643,470 bytes, SHA-256
`213a20863a6e2e1b91d33452a31a0d5764e0a2670b5703cc6a464090f15d9c61`.
Input `image`: float32 `[1,3,224,224]`; output `logits`: float32 `[1,4]`.
The original preprocessing, weights, one softmax, and class indices are unchanged:
Healthy Rice, Rice Leaffolder, Stem Borer, Unknown (Other Damage). Unknown is
trained output 3; there is no confidence-threshold rule.

Existing mobile layouts, camera/gallery logic, animations, navigation, website,
Flask backend, and source `.pth`/ONNX artifacts are preserved.

## Changes for standalone delivery

- `scripts/build-preview.ps1`: reuses the native integration, production bundling,
  offline configuration, private signing, low-memory settings, and actual APK verification.
- `scripts/prepare-signing.ps1`: creates/reuses a private local PKCS12 identity;
  never overwrites an incomplete existing identity or prints passwords.
- `scripts/standalone-signing.gradle`: applies local release signing in Android
  Gradle's `finalizeDsl` lifecycle. EAS managed signing remains separate.
- `scripts/low-memory.gradle` and `prepare-windows-ninja.py`: short C++ output
  paths for app/libraries, bounded compiler/Metro workers, and checksum-pinned
  [Ninja 1.13.2](https://github.com/ninja-build/ninja/releases/tag/v1.13.2) for
  Windows app codegen. No SDK binary replacement or registry edits.
- `scripts/verify_standalone_apk.py`: checks the APK's model bytes/SHA, embedded
  Hermes code, ARM64/runtime libraries, non-debuggable flag, app identity,
  APK signature, and 16 KiB ZIP/ELF alignment; writes public build metadata.
- `plugins/withPinnedOnnxRuntime.cjs`: adds Android's recommended 16 KiB linker
  settings to the existing ONNX 1.24.3 JSI bridge. The CPU runtime/model and
  inference behavior are unchanged; static ELF inspection checks every library.
- `eas.json`: preview is explicitly a standalone APK with HTTP disabled.
- `metro.config.js`: optional bounded Metro workers during local APK builds.
- `scripts/prepare-phone-test-images.py`: copies genuine held-out images and
  saved model outputs for repeatable phone acceptance tests.
- `.gitignore`, repository `.easignore`, and packaging test: exclude private
  signing properties/keys from source control and cloud build uploads.
- `BUILD_ANDROID.md`, `README.md`, `OFFLINE_AI.md`, and this report: current setup,
  phone installation, signing backup, rebuild commands, and acceptance checklist.

## Installation and rebuilding

See [BUILD_ANDROID.md](BUILD_ANDROID.md) for phone installation, exact build
commands, and the physical-phone checklist. Local build: `npm.cmd run build:apk`
from `mobile/`. No EAS/cloud deployment, payment, or subscription is used.

The private `.signing/` folder must be backed up separately. Future APK updates
need the same key and an incremented `android.versionCode`. APKs and model binaries
remain outside Git. Remote builds must provision the exact model into their
archive; local presence alone is not sufficient. No EAS upload was performed.

## Known test boundaries

Phase 11C's 160-image numerical parity remains recorded in [OFFLINE_AI.md](OFFLINE_AI.md).
The standalone tests above separately exercise this final release APK.

Physical ARM64 phones and camera vendors, actual 16 KiB-page execution, low-RAM
devices, thermal/battery use, long sessions, other Android versions/screen sizes,
and real field-image behavior remain subject to the phone acceptance checklist.
Powering off the development computer/closing VS Code while running on an actual
phone was not claimed as an executed test. The final APK embeds the code and
model and completed inference with no Metro, backend, or network connection.

Model accuracy and out-of-domain behavior remain limitations of the existing
trained model. Existing dependency advisories recorded in Phase 11C were not
addressed by a forced SDK upgrade. No website, backend, model, or mobile UI rebuild
was performed. No cloud service, paid infrastructure, final store publication,
or later phase was started.
