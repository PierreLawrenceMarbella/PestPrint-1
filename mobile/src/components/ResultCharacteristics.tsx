import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { healthyCharacteristics, unknownCharacteristics } from '../constants/resultContent';
import { theme } from '../theme';
import { resultPalette } from '../theme/resultPalette';
import type { ClassificationResult } from '../types/pestResult';
import { AppCard } from './AppCard';
import { PestDamageCharacteristics } from './PestDamageCharacteristics';
import { SectionTitle } from './SectionTitle';

export function ResultCharacteristics({ result }: { result: ClassificationResult }) {
  if (result.kind === 'known-pest') return <PestDamageCharacteristics pest={result.pest} />;
  const healthy = result.kind === 'healthy';
  const content = healthy ? healthyCharacteristics : unknownCharacteristics;
  const palette = resultPalette[result.kind];
  return (
    <AppCard style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.heading}>
        <Ionicons accessible={false} color={palette.accent} name={healthy ? 'checkmark-circle' : 'information-circle-outline'} size={24} />
        <SectionTitle style={styles.title}>{content.title}</SectionTitle>
      </View>
      <Text style={styles.description}>{content.description}</Text>
      {content.characteristics.map((characteristic) => (
        <View key={characteristic} style={styles.row}>
          <Text accessible={false} style={[styles.bullet, { color: palette.accent }]}>•</Text>
          <Text style={styles.characteristic}>{characteristic}</Text>
        </View>
      ))}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: theme.spacing.lg, padding: theme.spacing.md },
  heading: { alignItems: 'flex-start', flexDirection: 'row', gap: theme.spacing.sm },
  title: { flex: 1, fontSize: theme.type.size.sectionTitle },
  description: { color: theme.colors.text, fontSize: theme.type.size.label, lineHeight: theme.type.lineHeight.compact, marginVertical: theme.spacing.smMd },
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  bullet: { fontSize: 19, lineHeight: theme.type.lineHeight.body },
  characteristic: { color: theme.colors.text, flex: 1, fontSize: theme.type.size.label, lineHeight: theme.type.lineHeight.compact },
});
