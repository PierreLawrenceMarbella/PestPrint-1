import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { SupportedCategory } from '../types/pest';
import { theme } from '../theme';
import { AppCard } from './AppCard';

type CategoryCardProps = {
  category: SupportedCategory;
  compact?: boolean;
};

const toneColors = {
  amber: { background: '#FFF4D6', foreground: theme.colors.amber },
  green: { background: theme.colors.mint, foreground: theme.colors.forest },
  red: { background: '#FDE8E7', foreground: theme.colors.danger },
} as const;

export function CategoryCard({ category, compact = false }: CategoryCardProps) {
  const colors = toneColors[category.tone];

  return (
    <AppCard style={[styles.card, compact && styles.compactCard]}>
      <View style={[styles.icon, { backgroundColor: colors.background }]}>
        <Ionicons color={colors.foreground} name={category.icon} size={21} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{category.name}</Text>
        {!compact ? <Text style={styles.description}>{category.description}</Text> : null}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.smMd,
    padding: theme.spacing.md,
  },
  compactCard: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 86,
  },
  icon: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.type.size.label,
    fontWeight: theme.type.weight.bold,
    lineHeight: theme.type.lineHeight.compact,
  },
  description: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: theme.type.lineHeight.compact,
    marginTop: theme.spacing.xs,
  },
});
