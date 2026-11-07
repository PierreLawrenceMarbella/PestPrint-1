# Phase 11F-B: animated result confidence and probabilities

Implemented score visualization animations. No updated APK was built.

## Behavior

- Confidence fills from zero to the original percentage over 800 ms with cubic
  ease-out timing. The displayed confidence counts up with the same shared progress.
- The numeric display uses a noninteractive native text input styled as the existing
  label. Reanimated updates its native text property without React renders each frame.
  It cannot open the keyboard or receive touch/focus. The accessibility container
  always reports the actual final score instead of announcing intermediate numbers.
- Probability bars fill for 800 ms each, separated by 50 ms. Labels always show the
  actual supplied probability using the existing formatter. The four rows remain
  mounted behind the existing collapsed details control to preserve reveal state.
- Each score reveals once per mounted result. Navigating away, backgrounding, or
  collapsing the details settles unfinished animations to their exact final values.
  Returning or reopening does not restart them. Unmounting cancels scheduled motion
  and removes preference/app-state listeners.
- Reduced motion displays the final values directly. Live preference changes stop
  active motion. If the preference cannot be read, the reveal is skipped safely.
- Missing scores remain unavailable; raw Unknown scores remain raw. Result palettes,
  card structure, classification order, inference, raw probabilities and ranking are
  preserved. Final bar widths use original numerical values, without rounding.

The percentage utility now has a worklet directive so the same one-decimal,
`<0.1%`, and exact-zero rules execute on the UI thread. Its calculations are unchanged.

## Files

- `src/components/ConfidenceBar.tsx`
- `src/components/ResultProbabilities.tsx`
- `src/hooks/useResultReveal.ts` (new)
- `src/services/resultRevealController.ts` (new)
- `src/utils/formatPercentage.ts`
- `scripts/test-results.cjs` (new)
- `package.json` (`test:results` command)
- This report

Existing Phase 11F-A changes were retained.

## Verification executed

- `npm.cmd run typecheck`: passed.
- `node --test scripts/test-results.cjs scripts/test-formatting.cjs scripts/test-processing.cjs scripts/test-offline.cjs`:
  **25 passed, no failures or skips**.
- Seven new tests verify all four validated UI fixture states, exact final scores
  and widths, formatting, missing/raw scores, animation completion, monotonic timing,
  staggering, navigation, backgrounding, collapsed details, reduced motion, preference
  failure, and unmount cleanup.
- Existing offline reference checks cover 160 saved genuine CPU outputs, with maximum
  probability difference 1.1920928955078125e-7. This checks existing postprocessing;
  it is not a new model accuracy measurement or Android inference run.
- A production Android Hermes JavaScript export succeeded (1,732 modules) using
  `npx.cmd expo export --platform android --max-workers 2 --output-dir ../.artifacts/phase11fb/android-export`
  with `EXPO_NO_DOTENV=1` and `NODE_ENV=production`.
- `git diff --check`: passed.

## Limits

UI tests use native component mocks. Hook tests execute actual lifecycle code with
deterministic animation bindings, not the Android worklet scheduler. No emulator or
physical-phone animation testing was performed. Native count-up rendering, font
scaling, touch navigation, and frame rate should be checked in the next native preview
or APK. The production JavaScript export verifies bundling, not native runtime behavior.

No APK build, dependency installation, inference changes, or subsequent phase was run.

Implementation references: [Reanimated timing](https://docs.swmansion.com/react-native-reanimated/docs/animations/withTiming/)
and [reduced-motion behavior](https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/).
