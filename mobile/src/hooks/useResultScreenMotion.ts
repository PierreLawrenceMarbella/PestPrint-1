import { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';

import type { ClassificationResult } from '../types/pestResult';
import { useResultReveal } from './useResultReveal';

/** Overlapping entrances share the existing one-shot, accessible reveal lifecycle. */
export function useResultScreenMotion(kind: ClassificationResult['kind']) {
  const { progress, initiallyReduced } = useResultReveal();
  const image = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.65], [0, 1], Extrapolation.CLAMP),
  }));
  const prediction = useAnimatedStyle(() => {
    const visible = interpolate(progress.value, [0.08, 0.85], [0, 1], Extrapolation.CLAMP);
    return { opacity: visible, transform: [{ translateY: (1 - visible) * 6 }] };
  });
  const icon = useAnimatedStyle(() => {
    const visible = interpolate(progress.value, [0.22, 0.9], [0, 1], Extrapolation.CLAMP);
    return { opacity: visible, transform: [{ scale: 1 - (1 - visible) * (kind === 'healthy' ? 0.06 : 0.04) }] };
  });
  const highlight = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.8], [0.045, 0], Extrapolation.CLAMP),
  }));
  const characteristics = useAnimatedStyle(() => {
    const visible = interpolate(progress.value, [0.32, 0.95], [0, 1], Extrapolation.CLAMP);
    return { opacity: visible, transform: [{ translateY: (1 - visible) * 4 }] };
  });
  const actions = useAnimatedStyle(() => ({
    // Actions are visible and interactive immediately; no timer gates navigation.
    opacity: interpolate(progress.value, [0.4, 1], [0.92, 1], Extrapolation.CLAMP),
  }));
  return { image, prediction, icon, highlight, characteristics, actions, initiallyReduced };
}
