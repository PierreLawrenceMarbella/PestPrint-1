import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';

import { useResultReveal } from '../hooks/useResultReveal';
import { formatConfidencePercent, getConfidencePercent } from '../services/pestResult';
import { theme } from '../theme';
import { formatPercentage } from '../utils/formatPercentage';

// Keep native text and the input's React default synchronized across layout commits.
const AnimatedScore = Animated.createAnimatedComponent(TextInput);

type ConfidenceBarProps = {
  value?: number | null;
  fixture?: boolean;
  label?: string;
  accentColor?: string;
  trackColor?: string;
};

export function ConfidenceBar({ value, fixture = false, label: suppliedLabel = 'Confidence Score', accentColor = theme.colors.predictionAccent, trackColor = theme.colors.predictionBorder }: ConfidenceBarProps) {
  const confidence = getConfidencePercent(value);
  const label = fixture ? (suppliedLabel === 'Confidence Score' ? 'Sample confidence' : `Sample ${suppliedLabel.toLowerCase()}`) : suppliedLabel;
  const { progress } = useResultReveal(confidence !== null);
  const fill = useAnimatedStyle(() => ({ width: `${(confidence ?? 0) * progress.value}%` }));
  const number = useAnimatedProps<TextInputProps & { text: string }>(() => {
    const text = formatPercentage((confidence ?? 0) * progress.value, 'percent');
    return { text, defaultValue: text };
  });

  return (
    <View
      accessible
      accessibilityLabel={confidence === null ? 'Confidence unavailable' : `${label}: ${formatConfidencePercent(confidence)}`}
      accessibilityRole={confidence === null ? 'text' : 'progressbar'}
      accessibilityValue={confidence === null ? undefined : { min: 0, max: 100, now: confidence }}
      testID="result-confidence"
    >
      <Text style={styles.label}>{confidence === null ? 'Confidence unavailable' : label}</Text>
      {confidence !== null ? (
        <AnimatedScore
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          animatedProps={number}
          caretHidden
          editable={false}
          focusable={false}
          pointerEvents="none"
          selectTextOnFocus={false}
          showSoftInputOnFocus={false}
          style={[styles.value, { color: accentColor }]}
          testID="result-confidence-number"
          underlineColorAndroid="transparent"
        />
      ) : null}
      <View style={[styles.track, { backgroundColor: trackColor }]}>
        {confidence !== null ? (
          <Animated.View style={[styles.fill, { backgroundColor: accentColor }, fill]} testID="result-confidence-fill" />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: theme.colors.muted, fontSize: theme.type.size.caption,
    fontWeight: theme.type.weight.medium, marginBottom: theme.spacing.xs,
  },
  value: { fontSize: 20, fontWeight: theme.type.weight.bold, lineHeight: 28, marginBottom: theme.spacing.sm, padding: 0 },
  track: { backgroundColor: theme.colors.predictionBorder, borderRadius: theme.radius.pill, height: 9, overflow: 'hidden' },
  fill: { backgroundColor: theme.colors.predictionAccent, borderRadius: theme.radius.pill, height: '100%' },
});
