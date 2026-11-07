import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { useIsFocused } from 'expo-router';

/** Pause continuous effects off screen, in the background, or with reduced motion. */
export function useProcessingMotion(active: boolean) {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    let mounted = true;
    let settingChanged = false;
    const preference = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      settingChanged = true;
      setReduced(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted && !settingChanged) setReduced(value);
    }).catch(() => { /* Keep motion disabled if the preference cannot be read. */ });
    const visibility = AppState.addEventListener('change', (value) => setForeground(value === 'active'));
    return () => {
      mounted = false;
      preference.remove();
      visibility.remove();
    };
  }, []);

  return active && focused && foreground && !reduced;
}
