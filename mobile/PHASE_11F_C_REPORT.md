# Phase 11F-C: result screen entrances and interactions

Implemented the result-screen motion refinement. No APK was built.

## Changes

- Replaced the whole-page fade with overlapping image, prediction-card, existing
  classification-icon, characteristics, and action reveals.
- Image opacity fades in first; the prediction card rises 6 px and characteristics
  rise 4 px. Existing Healthy Rice and Unknown icons scale from 0.94/0.96 to 1.
  All transforms settle at the original positions without changing layout dimensions.
- Known-pest cards receive a temporary pink/red tint at no more than 4.5% opacity.
  Healthy and Unknown retain their existing green and amber icon colors.
- Reused `useResultReveal` and its existing one-shot lifecycle. The spatial entrances
  complete during the first part of its 800 ms timeline. Reduced motion settles
  immediately, and navigation/backgrounding does not replay unfinished entrances.
- Actions remain at least 92% opaque and interactive from the first frame. Callbacks
  dispatch immediately without waiting for any entrance, press feedback, or exit.
- Result buttons opt into a 0.75 px press offset, soft opacity feedback, and an 8-degree
  movement of the existing refresh icon. Press timing respects system reduced motion;
  blur and unmount cancel result-button feedback. Other buttons retain their defaults.
- Learn More retains its native fade transition and skips it for reduced motion.
  The modal also observes live preference changes and removes its listener on unmount.

Image sizing, card spacing, typography, educational content, prediction values,
formatting, confidence/probability animation source, model, and inference are preserved.
No dependencies were added.

## Files

- `src/screens/ResultScreen.tsx`
- `src/components/ResultPredictionCard.tsx`
- `src/components/ResultEducationModal.tsx`
- `src/components/AppButton.tsx` (result-only opt-in)
- `src/hooks/useResultScreenMotion.ts` (new)
- `scripts/test-result-screen.cjs` (new)
- `package.json` (`test:result-screen` command)
- This report

Existing uncommitted Phase 11F-A and 11F-B work was retained.

## Verification executed

- `npm.cmd run typecheck`: passed. The new prediction-card motion prop uses
  Reanimated's `AnimatedStyle` type to support the installed animated-style handles.
- `node --test scripts/test-result-screen.cjs scripts/test-results.cjs scripts/test-formatting.cjs scripts/test-processing.cjs scripts/test-offline.cjs`:
  **32 passed, no failures or skips**.
- Seven new tests cover all four validated result fixtures, bounded entrance profiles,
  themed decorations, immediate actions during entrance, repeated analysis, Learn More,
  modal back/request-close, reduced-motion modal transitions, press/blur cleanup,
  ordinary-button defaults, and unavailable-image recovery.
- Existing confidence completion, navigation, reduced-motion, formatting, cleanup,
  and offline-reference tests passed. The 160 saved CPU reference outputs remain within
  1.1920928955078125e-7 maximum probability difference in existing JS postprocessing.
- Production Android Hermes JavaScript export passed (1,733 modules):
  `npx.cmd expo export --platform android --max-workers 2 --output-dir ../.artifacts/phase11fc/android-export`
  with `EXPO_NO_DOTENV=1` and `NODE_ENV=production`.
- `git diff --check`: passed.

## Limits

Component tests execute actual callbacks and state transitions with mocked native
views/animation bindings and explicitly labeled unit result fixtures. They do not
verify physical touch, Android graphics, real model execution, or frame rate.
No emulator or physical-phone animation test was performed. The production export
verifies bundling, not native playback. Device visual checks remain for a future
native preview or APK.

Phase 11F-C is complete; no subsequent phase was started.
