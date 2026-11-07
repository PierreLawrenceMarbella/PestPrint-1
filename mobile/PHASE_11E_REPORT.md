# PESTPRINT Phase 11E-C: updated standalone Android release

Status: **build and emulator verification passed**. Physical-phone verification
of this updated APK has not been performed. The user reported that the earlier
standalone APK works on their phone.

## Deliverable

| Property | Verified value |
| --- | --- |
| APK | `builds/pestprint-offline-1.0.1.apk` |
| Latest alias (identical bytes) | `builds/pestprint-offline.apk` |
| Size | 140,115,066 bytes / 133.62 MiB |
| Version name / Android versionCode | 1.0.1 / 2 |
| Application ID | `com.pestprint.mobile` |
| Build | Signed, non-debuggable standalone release |
| CPU ABIs | ARM64 and x86_64 |
| Android | Declared API 24+; tested on Android 16/API 36 x86_64 emulator |
| SHA-256 | `6ad1466d4354ed8102ffa1f3bbff369ab27f2e519b4e3d38a302369a2335d75f` |

The Phase 11D `npm.cmd run build:apk` procedure completed successfully in
3 minutes 39 seconds. No cloud build or paid service was used. The original
1.0.0 APK and reports were archived locally before building.

## Packaging and update compatibility

- Reused the existing `.signing/pestprint-release.p12`; its checksum is unchanged.
- The public signing certificate matches 1.0.0:
  `048fec7d6c86c040f45f127a743671f6f0033f7acc4d5c9c618125b15cf1c13d`.
- `adb install -r` updated the emulator's installed 1.0.0/code 1 directly to
  1.0.1/code 2, without uninstalling the app.
- Verified APK signature v2, non-debuggable flag, application identity/version,
  embedded production Hermes JavaScript, and absence of development diagnostics.
- The actual APK contains the ONNX model exactly once and the native CPU/JSI
  inference libraries for both ABIs. ZIP and all native ELF alignments pass 16 KiB
  checks. Execution on physical 16 KiB-page hardware remains untested.
- Installed `base.apk` SHA-256 matches the delivered APK.

## Formatting and numerical preservation

Confidence uses 0–100 percentage values; model probabilities remain 0–1 values.
The shared formatter changes text only, with one decimal place, `<0.1%` for
positive percentages below 0.05%, and `0.0%` for exact zero. Confidence bar widths
and probability bar widths still use their original unrounded values.

Four genuine held-out images were selected through Android's photo picker and
classified by the release APK with airplane mode enabled, Wi-Fi/mobile data off,
no ADB reverse connections, no Metro listener, and no Expo Go installed:

| Real result | Confidence text | Probability text: Healthy / Leaffolder / Stem Borer / Unknown |
| --- | --- | --- |
| Healthy Rice | 98.5% | 98.5% / <0.1% / 1.5% / <0.1% |
| Rice Leaffolder | 78.4% | 0.2% / 78.4% / 1.5% / 19.9% |
| Stem Borer | 99.9% | 0.1% / <0.1% / 99.9% / <0.1% |
| Unknown (Other Damage) | 75.0% | 1.3% / 23.0% / 0.7% / 75.0% |

The selected files match the original saved reference-image checksums. All class
names and formatted values match those references. No development fixtures were
used for these release-app classifications.

Raw numerical preservation was checked separately from rounded UI text:

- Original PyTorch checkpoint, source/bundled ONNX files, inference services,
  Java/Kotlin preprocessing, and website `app.py` checksums are unchanged.
- Both packaged ONNX CPU and JSI libraries, for both ABIs, match the 1.0.0 APK
  byte for byte.
- Existing postprocessing tests preserve all 160 saved genuine reference
  predictions; maximum probability difference versus reference is
  `1.1920928955078125e-7`, within the existing FP32 tolerance. This is a JavaScript
  postprocessing check, not a new 160-image native-device accuracy evaluation.
- The ONNX model checksum remains
  `213a20863a6e2e1b91d33452a31a0d5764e0a2670b5703cc6a464090f15d9c61`.

## Launch and navigation verification

- Recorded launch from the Android home-screen icon in the signed release APK.
  Reviewed the leaf-logo handoff, wordmark/tagline reveal and Home transition.
  The React sequence targets 1,260 ms after preparation; total cold startup also
  includes native/JavaScript initialization and varies with device speed.
- Recorded another cold launch with Android animation scales set to zero.
  The optional React branding sequence is skipped and Home appears directly
  after native startup. No blank screen was observed in video samples taken
  every 0.1 seconds; this is not a guarantee about every possible display frame.
- Home action, all four bottom tabs, all four Pest Guide details, Android Back,
  About, Learn More/Back to Result, and Analyze Another Image passed.
- Five additional real offline analyses returned the expected Unknown result
  with `75.0%`, without duplicate screens or crashes.
- Gallery selection/replacement, virtual-camera capture/preview, image removal,
  and camera cancellation passed. The launch overlay did not replay on tabs or
  when returning from camera/gallery. Camera capture used an emulator scene;
  no crop-accuracy claim is made from it.
- No PESTPRINT Java/native crash, ANR, React Native JavaScript error, or Android
  runtime error was found in the collected application/crash/exit records.
- The emulator had a **System UI boot ANR before app testing**, recovered by
  choosing Wait. This was separate from PESTPRINT and is not counted as an app
  failure.

## Automated checks executed

| Check | Result |
| --- | --- |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run test:formatting` | 5/5 passed |
| `npm.cmd run test:launch` | 8/8 passed |
| `npm.cmd run test:offline` | 7/7 passed |
| `npm.cmd run test:api` | 9/9 passed; retained API client unit tests, not live backend calls |
| `npx.cmd expo-doctor` | 21/21 passed |
| Release Gradle build + actual APK verifier | Passed |
| `git diff --check` | Passed |

Ignored local evidence is stored in `.artifacts/phase11ec/`: build log, startup
videos and extracted frames, result screenshots/XML, test summaries, update
installation record, native-library comparisons, and runtime logs. Public build
metadata and test summaries accompany both APK filenames in `builds/`.

## Install or update on your phone

1. Copy `builds/pestprint-offline-1.0.1.apk` to the phone.
2. Open it from Files, permit APK installation for Files if prompted, and choose
   **Update** over the existing 1.0.0 standalone release. Keep the app installed.
3. Open PESTPRINT directly. Confirm the launch branding and Home navigation.
4. Enable airplane mode with Wi-Fi/mobile data off, then select/capture a rice
   image and analyze it. Check the confidence and expanded probability labels.

Optional USB update from the repository root:

```powershell
adb install -r mobile/builds/pestprint-offline-1.0.1.apk
```

Physical checks remaining: actual-phone update compatibility, ARM64 performance,
camera/gallery permissions and photo orientation, all four offline results,
repeated analyses, reduced motion, and launch/classification after a phone
restart with the laptop disconnected. No physical-device testing is claimed.
The existing model's accuracy and handling of non-rice images were not changed.

For future builds, follow [BUILD_ANDROID.md](BUILD_ANDROID.md), retain the private
signing identity, and increase `android.versionCode` again for the next update.
