# PESTPRINT Phase 11F-D: validated standalone Android update

Status: **COMPLETE — signed APK built and emulator checks passed.**
Physical-phone testing of this update has not been performed.

## Deliverable

| Property | Verified value |
| --- | --- |
| APK | `builds/pestprint-offline-1.0.2.apk` |
| Absolute location | `C:\Users\pierr\OneDrive\Documents\Pestprint\PestPrint\mobile\builds\pestprint-offline-1.0.2.apk` |
| Latest alias, identical bytes | `builds/pestprint-offline.apk` |
| Size | 140,125,894 bytes / 133.63 MiB |
| Version name / Android versionCode | 1.0.2 / 3 |
| Application ID | `com.pestprint.mobile` |
| Build | Signed standalone release, non-debuggable |
| Native ABIs | ARM64 and x86_64 |
| SHA-256 | `3ebfa21e49426e9486f533487078b43077c10fe6a8022e737db58a168fd53830` |

The final `npm.cmd run build:apk` run completed successfully in 2 minutes
36 seconds. The existing local Phase 11D build procedure was reused. No paid
service or cloud build was used. Versions 1.0.0 and 1.0.1 remain preserved.

## Signing and packaging

- Reused the original `.signing/pestprint-release.p12` and `release.properties`.
  Both files retain their original checksums. No new signing key was generated.
- The public certificate matches both previous standalone releases:
  `048fec7d6c86c040f45f127a743671f6f0033f7acc4d5c9c618125b15cf1c13d`.
- Updated the emulator's installed 1.0.1 in place during testing. The corrected
  final APK was also installed with `adb install -r`, without uninstalling the app.
- Verified actual APK signature v2, package/version, application label,
  non-debuggable flag, embedded Hermes bytecode, and absence of development diagnostics.
- The APK includes the exact validated FP32 ONNX model once:
  `assets/efficientnet_b0_rice_pest.onnx`, 16,643,470 bytes,
  SHA-256 `213a20863a6e2e1b91d33452a31a0d5764e0a2670b5703cc6a464090f15d9c61`.
- The embedded production Hermes bundle is 3,494,684 bytes. Native ONNX CPU/JSI,
  Hermes, and application libraries are present for both ABIs. The four ONNX
  CPU/JSI libraries remain byte-identical to version 1.0.1.
- ZIP alignment and every native ELF load-segment alignment passed 16 KiB checks.
- The installed emulator `base.apk` checksum equals the delivered APK checksum.

## Issues found and corrected in release testing

1. **Confidence text reset after expanding probability details.** The original
   native count-up reached the correct score, but a later React/layout commit
   restored the input's initial `0.0%` default. The animated binding now updates
   both native `text` and `defaultValue`, using the installed Reanimated library's
   own text-display pattern. Native expand/collapse and navigation tests confirm
   that the final score remains correct. A focused regression test was added.
2. **Gray shadow halos during card fades on Android.** Enabled grouped alpha
   compositing on the prediction and characteristics reveal containers, following
   [React Native's guidance for overlapping children](https://reactnative.dev/docs/view.html#needsoffscreenalphacompositing).
   Final release recordings confirm clean fades. No persistent hardware-texture
   cache or continuous shadow effect was added.

The earlier internal candidates and their recordings were retained in the ignored
local test-artifact folder. The deliverable above contains both corrections.

## Automated verification executed

- TypeScript: `npm.cmd run typecheck` — passed.
- **50 automated tests passed, no failures or skips:** 9 retained API unit tests,
  7 offline tests, 5 formatting tests, 8 launch tests, 6 processing tests,
  8 result-score tests, and 7 result-screen tests.
- Coverage includes immediate success without an animation/timer gate, errors,
  cancellation, duplicate/stale requests, one-decimal/tiny/zero formatting,
  all four validated UI fixtures, animation completion, bounded easing,
  navigation, reduced motion, subscriptions, and animation cleanup.
- Existing JS postprocessing checks cover 160 saved genuine CPU-reference outputs.
  Maximum probability difference remains 1.1920928955078125e-7. These are existing
  reference checks, not a new 160-image Android run or an accuracy measurement.
- Expo Doctor: **21/21 checks passed**. No dependency changes were required.
- Actual signed APK packaging/signature verification: passed.
- `git diff --check`: passed.

## Actual final-APK emulator verification

Environment: `Medium_Phone_API_36.1`, Android 16/API 36, x86_64,
1080×2400 at 420 dpi, 4 KiB memory pages, software GPU, configured with 2 GiB RAM.

Classification ran with airplane mode enabled, Wi-Fi/mobile data disabled,
**no active default network**, no ADB reverse tunnel, no Metro listener on port
8081, and no Expo Go installation. Images came through the actual Android photo
picker; their original file checksums match the saved held-out references.

| Genuine held-out image | Class index | Actual result | Displayed confidence |
| --- | --- | --- | --- |
| `01-healthy-rice.jpg` | 0 | Healthy Rice | 98.5% |
| `02-rice-leaffolder.png` | 1 | Rice Leaffolder | 78.4% |
| `03-stem-borer.jpg` | 2 | Stem Borer | 99.9% |
| `04-unknown.jpg` | 3 | Unknown (Other Damage) | 75.0% |

Expanded probability labels, in the same class-index order:

| Result | Healthy Rice | Rice Leaffolder | Stem Borer | Unknown |
| --- | --- | --- | --- | --- |
| Healthy Rice | 98.5% | <0.1% | 1.5% | <0.1% |
| Rice Leaffolder | 0.2% | 78.4% | 1.5% | 19.9% |
| Stem Borer | 0.1% | <0.1% | 99.9% | <0.1% |
| Unknown | 1.3% | 23.0% | 0.7% | 75.0% |

Additional final-APK checks passed:

- Normal cold launch from the Android Home icon and branded startup sequence.
- Selected-image scanner with moving line, four brackets, subtle highlight and
  indeterminate status; result transition ends scanning without waiting for a cycle.
- Result image/card/icon/characteristics entrances, native confidence count-up,
  final values and sequential probability-bar fills.
- Probability expand/collapse for every class without resetting the score.
- Home/Analyze return, Learn More, Back to Result, and Android Back.
- Five consecutive genuine Unknown reanalyses without a crash or stale result.
- Analyze Another Image clears the previous selection.
- Camera capture, preview, image removal and camera cancellation using the
  emulator's virtual camera. No crop-accuracy claim is made for its virtual scene.
- All four Pest Guide details, About, and return navigation.
- Reduced-motion cold launch and real offline Unknown analysis with animation
  scales set to zero; final confidence/probabilities display directly.
- Application crash buffer empty, no crash/ANR exit reason, and no
  ReactNativeJS/ReactNative/AndroidRuntime error-tag output.

Release videos and sampled frames were reviewed for the normal/reduced startup,
scanner, all result states, and probability fills. Native rendering was checked
in addition to mocked unit tests. Emulator settings were restored and the
emulator was stopped after testing.

Model weights, preprocessing, offline inference/softmax, class mapping, result
formatting calculations, website/backend and original signing identity remain
unchanged. Unknown remains a genuine trained fourth class; no threshold was added.

## Install or update on a phone

1. Copy `builds/pestprint-offline-1.0.2.apk` to the Android phone using USB or
   another file-transfer method.
2. Open it in Files. Allow installation from that Files app if Android asks.
3. Choose **Update** over the existing 1.0.0 or 1.0.1 standalone PESTPRINT app.
   Keep the existing app installed; the signing identity is compatible.
4. Open PESTPRINT directly, enable airplane mode, choose a local rice image or
   take a photo, and analyze it. Internet, Expo Go, Metro and a laptop are not
   required during normal use.
5. Check confidence/probability formatting after expanding details, navigating
   away/back and opening Learn More. Try all four original test images and repeat
   analysis. Restart the phone and repeat the offline check.

Optional USB update from the repository root:

```powershell
adb install -r mobile/builds/pestprint-offline-1.0.2.apk
```

## Rebuild and remaining limits

Use `npm.cmd run build:apk` from `mobile/`, as documented in
[BUILD_ANDROID.md](BUILD_ANDROID.md). Retain the private `.signing/` folder, bundle
the verified model, increase versionCode for a future distributed release, and
preserve each previous versioned APK before replacing the latest alias.

- **Physical-phone testing was unavailable.** Actual ARM64 execution, camera-vendor
  behavior, reboot, thermal behavior, frame rate and device-specific memory use
  remain phone acceptance checks. A 16 KiB-page device was not tested physically.
- The APK includes ARM64 and x86_64, not 32-bit-only device support. Its declared
  minimum Android version remains API 24/Android 7.
- The emulator is not a phone-performance benchmark. The previously reported
  57 ms inference figure was not remeasured as a native-kernel timing in this
  production APK. The application adds no artificial processing minimum; results
  are not held until a scan or result animation finishes.
- Cold emulator starts included several seconds of native initialization before
  the optional branding sequence. Its 1.26-second animation target is not a claim
  about total cold-launch time. Check startup performance on the actual phone.
- Four selected held-out images verify integration and agreement with their saved
  predictions. They do not establish broad model accuracy or confidence calibration.

Build/test metadata accompanies the APK locally as
`builds/pestprint-offline-1.0.2.build.json` and
`builds/pestprint-offline-1.0.2.tests.json`. APKs, signing credentials, recordings and
local evidence in `.artifacts/phase11fd/` remain excluded from Git.
