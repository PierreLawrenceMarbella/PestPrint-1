import { useEffect, type ReactNode } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useProcessingMotion } from '../hooks/useProcessingMotion';
import type { CropImage } from '../types/cropImage';
import { theme } from '../theme';

type ProcessingVisualProps = {
  active: boolean;
  children: ReactNode;
  image: CropImage;
};

export function ProcessingVisual({ active, children, image }: ProcessingVisualProps) {
  const { width } = useWindowDimensions();
  const frameWidth = Math.min(360, width - theme.spacing.mdLg * 2);
  const frameHeight = frameWidth * 0.75;
  const animate = useProcessingMotion(active);
  const phase = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(phase);
    phase.value = 0;
    if (animate) {
      phase.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.linear }), -1);
    }
    return () => cancelAnimation(phase);
  }, [animate, phase]);

  const rotation = useAnimatedStyle(() => ({
    transform: [{ rotate: `${phase.value * 360}deg` }],
  }));
  const scan = useAnimatedStyle(() => ({
    opacity: animate ? interpolate(phase.value, [0, 0.1, 0.9, 1], [0, 1, 1, 0]) : 0,
    transform: [{ translateY: phase.value * (frameHeight - 32) }],
  }));

  return (
    <>
      <View style={[styles.cropFrame, { height: frameHeight, width: frameWidth }, active && styles.activeFrame]}>
        <Image
          accessibilityLabel="Selected rice crop image"
          resizeMode="contain"
          resizeMethod="resize"
          source={{ uri: image.uri }}
          style={styles.cropImage}
          testID="processing-crop-image"
        />
        {active ? (
          <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
            <Animated.View style={[styles.scanSweep, scan]} testID="processing-scan-sweep">
              <View style={styles.scanGlow} />
              <View style={styles.scanLine} />
            </Animated.View>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
        ) : null}
      </View>
      {active ? (
        <View
          accessible
          accessibilityLabel="Analyzing rice crop image. Progress is indeterminate."
          accessibilityRole="progressbar"
          accessibilityState={{ busy: true }}
          style={styles.indicator}
          testID="processing-indicator"
        >
          <Animated.View importantForAccessibility="no-hide-descendants" style={[styles.arc, rotation]} />
          <Text style={styles.indicatorLabel}>On-device analysis</Text>
        </View>
      ) : null}
      {children}
      <Text numberOfLines={1} style={styles.fileName}>{image.fileName}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  indicator: {
    alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  arc: {
    borderRadius: 10, borderWidth: 2, borderColor: theme.colors.forestSoft,
    borderTopColor: theme.colors.forest, borderRightColor: theme.colors.forest, height: 20, width: 20,
  },
  indicatorLabel: { color: theme.colors.forestDark, fontSize: theme.type.size.label, fontWeight: theme.type.weight.medium },
  cropFrame: {
    alignSelf: 'center', backgroundColor: theme.colors.canvas, borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.card, borderWidth: 1, overflow: 'hidden', marginBottom: theme.spacing.lg,
  },
  activeFrame: { borderColor: theme.colors.forestSoft },
  cropImage: { height: '100%', width: '100%' },
  fileName: { color: theme.colors.muted, fontSize: theme.type.size.caption, marginBottom: theme.spacing.lg, textAlign: 'center' },
  scanSweep: { height: 20, left: 12, position: 'absolute', right: 12, top: 6 },
  scanGlow: { backgroundColor: 'rgba(109, 211, 140, 0.12)', height: 18 },
  scanLine: {
    backgroundColor: theme.colors.forest, height: 2,
  },
  corner: {
    borderColor: theme.colors.forest, height: 24, position: 'absolute', width: 24,
  },
  topLeft: { borderLeftWidth: 2, borderTopWidth: 2, left: 12, top: 12, borderTopLeftRadius: 5 },
  topRight: { borderRightWidth: 2, borderTopWidth: 2, right: 12, top: 12, borderTopRightRadius: 5 },
  bottomLeft: { borderLeftWidth: 2, borderBottomWidth: 2, left: 12, bottom: 12, borderBottomLeftRadius: 5 },
  bottomRight: { borderRightWidth: 2, borderBottomWidth: 2, right: 12, bottom: 12, borderBottomRightRadius: 5 },
});
