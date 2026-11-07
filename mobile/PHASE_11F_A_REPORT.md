# Phase 11F-A: offline image-scanning experience

Implemented the processing-screen enhancement. No updated APK was built.

## Changes

- A prominent, rounded crop preview preserves the selected image with contain sizing.
- Four forest-green corner brackets frame the image during analysis.
- A thin green line and translucent mint highlight scan vertically across the preview.
- A compact indeterminate indicator accompanies “Analyzing Rice Crop Image...”.
- The existing Reanimated UI-thread animation and `useProcessingMotion` hook are reused.
  Motion stops when the screen loses focus, the app enters the background, or reduced
  motion is enabled. Reduced motion retains the image, static brackets, and status text.
- The processing screen appears without an entrance fade. Success continues directly
  through the existing result-screen transition, without waiting for a scan cycle.
- Success, failure, and cancellation remove the scanning overlay and busy indicator.
  Unmounting cancels the animation.

The existing analysis controller already prevents duplicate requests and discards
late canceled results. It was preserved, along with inference, preprocessing,
classification mapping, raw results, and result formatting.

## Verification executed

- `npm.cmd run typecheck`: passed.
- `node --test scripts/test-processing.cjs scripts/test-offline.cjs scripts/test-formatting.cjs`:
  18 tests passed; no failures or skips.
- Six new processing tests exercise pending and terminal UI states, image retention,
  duplicate-request prevention, errors/retry, cancellation/stale results, and immediate
  success without an animation or timer gate.
- Existing offline tests passed, including 160 saved genuine CPU-reference outputs
  for JavaScript postprocessing (maximum probability difference 1.1920928955078125e-7).
  These are reference checks, not a new Android model run or an accuracy measurement.
- Existing one-decimal percentage-formatting tests passed.

## Limits

Processing UI tests render the actual React components with native views and animation
bindings mocked. They do not verify Android graphics, native frame rate, or touch timing.
No new emulator or physical-phone test was performed. Real-device animation smoothness,
reduced-motion behavior, and inference performance remain to be checked in a subsequent
native preview or APK. Very fast inference can finish before a scanning frame is visible;
results are intentionally delivered immediately.

No dependencies, inference changes, APK build, or subsequent phase were introduced.
