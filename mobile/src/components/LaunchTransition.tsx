import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Image, StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import { createLaunchController, launchTiming } from '../services/launchController';
import { theme } from '../theme';

/** A brief continuation of the native logo, never a second navigation route. */
export function LaunchTransition({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const laidOut = useRef(false);
  const assetReady = useRef(false);
  const assetFailed = useRef(false);
  const controller = useRef<ReturnType<typeof createLaunchController> | null>(null);
  const values = useRef({
    // Keep the native logo visible through the handoff rather than fading it out and restarting.
    logoOpacity: new Animated.Value(0.82),
    logoScale: new Animated.Value(0.96),
    wordmark: new Animated.Value(0),
    subtitle: new Animated.Value(0),
    surface: new Animated.Value(1),
  }).current;

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    let preferenceChanged = false;
    const launch = createLaunchController({
      hideNative: () => SplashScreen.hide(),
      onComplete: () => { if (mounted) setVisible(false); },
      animate(done) {
        const timing = (value: Animated.Value, duration: number) => Animated.timing(value, {
          toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        });
        const sequence = Animated.sequence([
          Animated.parallel([
            timing(values.logoOpacity, launchTiming.logo),
            timing(values.logoScale, launchTiming.logo),
            Animated.sequence([Animated.delay(launchTiming.wordmarkDelay), timing(values.wordmark, launchTiming.wordmark)]),
            Animated.sequence([Animated.delay(launchTiming.subtitleDelay), timing(values.subtitle, launchTiming.subtitle)]),
          ]),
          Animated.timing(values.surface, {
            toValue: 0, duration: launchTiming.exit, easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
          }),
        ]);
        sequence.start(({ finished }) => { if (finished) done(); });
        return () => sequence.stop();
      },
    });
    controller.current = launch;
    if (laidOut.current) launch.layoutReady();
    if (assetReady.current) launch.assetReady();

    const preference = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduced) => {
      preferenceChanged = true;
      launch.preferenceReady(reduced);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (mounted && !preferenceChanged) launch.preferenceReady(reduced);
    }).catch(() => { if (mounted) launch.preferenceReady(true); });
    const visibility = AppState.addEventListener('change', (state) => {
      if (state !== 'active') launch.skip();
    });
    if (assetFailed.current || (AppState.currentState && AppState.currentState !== 'active')) launch.skip();

    return () => {
      mounted = false;
      preference.remove();
      visibility.remove();
      launch.dispose();
      controller.current = null;
    };
  }, [visible, values]);

  return (
    <View style={styles.root} onLayout={() => {
      laidOut.current = true;
      controller.current?.layoutReady();
    }}>
      <View style={styles.root} pointerEvents={visible ? 'none' : 'auto'}
        accessibilityElementsHidden={visible} importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>
        {children}
      </View>
      {visible ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.surface, { opacity: values.surface }]} testID="app-launch"
          accessible accessibilityLabel="PESTPRINT. AI-Powered Rice Pest Identification.">
          <Animated.View style={[styles.logo, {
            opacity: values.logoOpacity, transform: [{ scale: values.logoScale }],
          }]}>
            <Image source={require('../../assets/brand/pestprint-icon.png')} style={styles.image}
              accessible={false} resizeMode="contain" resizeMethod="resize"
              onLoadEnd={() => { assetReady.current = true; controller.current?.assetReady(); }}
              onError={() => { assetFailed.current = true; controller.current?.skip(); }} />
          </Animated.View>
          <View style={styles.copy}>
            <Animated.Text style={[styles.wordmark, { opacity: values.wordmark }]} numberOfLines={1}
              adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.4}>PESTPRINT</Animated.Text>
            <Animated.Text style={[styles.subtitle, { opacity: values.subtitle }]} maxFontSizeMultiplier={1.4}>
              AI-Powered Rice Pest Identification
            </Animated.Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  surface: { backgroundColor: theme.colors.background },
  // Match the native splash's 96 dp logo at the center; text does not displace it.
  logo: { position: 'absolute', top: '50%', left: '50%', width: 96, height: 96, marginLeft: -48, marginTop: -48 },
  image: { width: 96, height: 96, borderRadius: theme.radius.navigation },
  copy: { position: 'absolute', top: '50%', width: '100%', marginTop: 72, alignItems: 'center', paddingHorizontal: theme.spacing.lg },
  wordmark: { color: theme.colors.forestDark, fontSize: 32, fontWeight: theme.type.weight.black, letterSpacing: -0.8, textAlign: 'center' },
  subtitle: { color: theme.colors.muted, fontSize: theme.type.size.label, lineHeight: theme.type.lineHeight.compact, marginTop: theme.spacing.sm, maxWidth: 280, textAlign: 'center' },
});
