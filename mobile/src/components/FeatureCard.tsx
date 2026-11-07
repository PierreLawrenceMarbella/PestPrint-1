import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';
import { AppCard } from './AppCard';

type FeatureCardProps = {
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
};

export function FeatureCard({ description, icon, title }: FeatureCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.icon}>
        <Ionicons color={theme.colors.forest} name={icon} size={22} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 168,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: theme.colors.mint,
    borderRadius: theme.radius.pill,
    height: 42,
    justifyContent: 'center',
    marginBottom: theme.spacing.smMd,
    width: 42,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.type.size.body,
    fontWeight: theme.type.weight.bold,
    lineHeight: theme.type.lineHeight.compact,
    marginBottom: theme.spacing.sm,
  },
  description: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: theme.type.lineHeight.compact,
  },
});
