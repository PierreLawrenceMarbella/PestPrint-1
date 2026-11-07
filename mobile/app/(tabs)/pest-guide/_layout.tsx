import { Stack } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';

import { theme } from '@/src/theme';

export const unstable_settings = { initialRouteName: 'index' };

export default function PestGuideLayout() {
  const reducedMotion = useReducedMotion();
  return (
    <Stack screenOptions={{
      animation: reducedMotion ? 'none' : 'fade',
      contentStyle: { backgroundColor: theme.colors.background },
      headerShown: false,
    }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[category]" />
    </Stack>
  );
}
