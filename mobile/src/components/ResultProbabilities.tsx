import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useResultReveal } from '../hooks/useResultReveal';
import { resultRevealTiming } from '../services/resultRevealController';
import type { ModelEvidence } from '../types/pestResult';
import { theme } from '../theme';
import { formatPercentage } from '../utils/formatPercentage';

const categories = [
  ['healthy_rice', 'Healthy Rice'], ['rice_leaffolder', 'Rice Leaffolder'],
  ['rice_stem_borer', 'Stem Borer'], ['unknown', 'Unknown (Other Damage)'],
] as const;

function ProbabilityRow({ name, probability, accent, index, visible }: {
  name: string; probability: number; accent: string; index: number; visible: boolean;
}) {
  const { progress } = useResultReveal(visible, index * resultRevealTiming.stagger);
  const fill = useAnimatedStyle(() => ({ width: `${probability * 100 * progress.value}%` }));
  return (
    <View style={styles.row}>
      <View style={styles.labels}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.value}>{formatPercentage(probability, 'probability')}</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: accent }, fill]} testID={`probability-fill-${index}`} />
      </View>
    </View>
  );
}

/** Optional real model details inside the existing result card; no fixture values. */
export function ResultProbabilities({ probabilities, accent }: { probabilities: ModelEvidence['probabilities']; accent: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)} style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.7 }]}
        testID="prediction-probability-toggle">
        <Text style={[styles.toggleLabel, { color: accent }]}>Prediction probabilities</Text>
        <Ionicons accessible={false} color={accent} name={expanded ? 'chevron-up' : 'chevron-down'} size={16} />
      </Pressable>
      {/* Keep rows mounted so collapsing and reopening never replays the reveal. */}
      <View style={{ display: expanded ? 'flex' : 'none' }} accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}>
        {categories.map(([id, name], index) => (
          <ProbabilityRow key={id} name={name} probability={probabilities[id]} accent={accent} index={index} visible={expanded} />
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { marginTop: theme.spacing.smMd },
  toggle: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 44 },
  toggleLabel: { flex: 1, fontSize: theme.type.size.label, fontWeight: theme.type.weight.bold },
  row: { marginTop: theme.spacing.sm },
  labels: { flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'space-between', marginBottom: 4 },
  name: { color: theme.colors.text, flex: 1, fontSize: theme.type.size.caption },
  value: { color: theme.colors.text, flex: 1, fontSize: theme.type.size.caption, textAlign: 'right' },
  track: { backgroundColor: theme.colors.canvas, borderRadius: 2, height: 4, overflow: 'hidden' },
  fill: { height: '100%' },
});
