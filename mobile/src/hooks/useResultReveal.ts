import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
import {
  cancelAnimation, Easing, ReduceMotion, useReducedMotion, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';

import { createResultRevealController, resultRevealTiming } from '../services/resultRevealController';

/** UI-thread progress only; no inference data is changed and no results are delayed. */
export function useResultReveal(visible = true, delay = 0) {
  const focused = useIsFocused();
  const initiallyReduced = useReducedMotion();
  const [reduced, setReduced] = useState<boolean | null>(initiallyReduced ? true : null);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const progress = useSharedValue(initiallyReduced ? 1 : 0);
  const controller = useRef<ReturnType<typeof createResultRevealController> | null>(null);

  useEffect(() => {
    const reveal = createResultRevealController({
      animate() {
        progress.value = withDelay(delay, withTiming(1, {
          duration: resultRevealTiming.duration,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        }), ReduceMotion.System);
      },
      finish() { cancelAnimation(progress); progress.value = 1; },
      cancel() { cancelAnimation(progress); },
    });
    controller.current = reveal;
    return () => { reveal.dispose(); controller.current = null; };
  }, [delay, progress]);

  useEffect(() => {
    let mounted = true;
    let changed = false;
    const preference = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      changed = true;
      setReduced(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted && !changed) setReduced(value);
    }).catch(() => { if (mounted && !changed) setReduced(true); });
    const visibility = AppState.addEventListener('change', (value) => setForeground(value === 'active'));
    return () => { mounted = false; preference.remove(); visibility.remove(); };
  }, []);

  useEffect(() => {
    controller.current?.update({ visible, focused, foreground, reduced });
  }, [delay, visible, focused, foreground, reduced]);

  return { progress, initiallyReduced };
}
