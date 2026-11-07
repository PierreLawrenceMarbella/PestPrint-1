import { useEffect } from 'react';
import { ErrorBoundary as RouterErrorBoundary, Slot, type ErrorBoundaryProps } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';

import { LaunchTransition } from '../src/components/LaunchTransition';

// Hold the single native splash only until the matching React surface is ready.
// React owns the motion, including reduced motion; avoid a second native fade.
try { SplashScreen.setOptions({ duration: 0, fade: false }); } catch { /* Optional native control. */ }
void SplashScreen.preventAutoHideAsync().catch(() => { /* The React launch surface still works without native control. */ });

export function ErrorBoundary(props: ErrorBoundaryProps) {
  useEffect(() => {
    try { SplashScreen.hide(); } catch { /* Never cover the router's recovery screen. */ }
  }, []);
  return <RouterErrorBoundary {...props} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="dark" />
      <NavigationBar style="light" />
      <LaunchTransition>
        <Slot />
      </LaunchTransition>
    </SafeAreaProvider>
  );
}
