import type { PropsWithChildren } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { theme } from '../theme';

type AppCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  variant?: 'surface' | 'mint' | 'outlined';
}>;

export function AppCard({ children, style, variant = 'surface' }: AppCardProps) {
  return (
    <View
      style={[
        styles.card,
        variant === 'mint' && styles.mint,
        variant === 'outlined' && styles.outlined,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    padding: theme.spacing.mdLg,
    ...theme.shadow.card,
  },
  mint: {
    backgroundColor: theme.colors.mint,
    borderColor: theme.colors.forestSoft,
  },
  outlined: {
    elevation: 0,
    shadowOpacity: 0,
  },
});
