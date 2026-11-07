import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

export function BrandHeader() {
  return (
    <View accessibilityRole="header" style={styles.container}>
      <View style={styles.mark}>
        <Ionicons color={theme.colors.surface} name="leaf" size={24} />
      </View>
      <Text style={styles.wordmark}>PESTPRINT</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    minHeight: 64,
  },
  mark: {
    alignItems: 'center',
    backgroundColor: theme.colors.forest,
    borderRadius: theme.radius.control,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  wordmark: {
    color: theme.colors.forestDark,
    fontSize: 23,
    fontWeight: theme.type.weight.black,
    letterSpacing: -0.7,
  },
});
