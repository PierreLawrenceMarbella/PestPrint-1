import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

type PageHeaderProps = {
  onBack?: () => void;
  title: string;
};

export function PageHeader({ onBack, title }: PageHeaderProps) {
  return (
    <View accessibilityRole="header" style={styles.container}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={12}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons color={theme.colors.text} name="arrow-back" size={22} />
          </Pressable>
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={styles.side} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderBottomColor: theme.colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 52,
    paddingHorizontal: theme.spacing.md,
  },
  side: {
    alignItems: 'flex-start',
    width: 40,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  pressed: {
    backgroundColor: theme.colors.mint,
  },
  title: {
    color: theme.colors.text,
    flex: 1,
    fontSize: theme.type.size.body,
    fontWeight: theme.type.weight.bold,
    textAlign: 'center',
  },
});
