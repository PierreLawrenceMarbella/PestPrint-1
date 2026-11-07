import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { theme } from '../theme';
import type { GuideCategory } from '../types/pestGuide';

type GuideCategoryCardProps = { category: GuideCategory; index: number; onPress: () => void };

export function GuideCategoryCard({ category, index, onPress }: GuideCategoryCardProps) {
  const [focused, setFocused] = useState(false);
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.2;
  return (
    <Animated.View entering={FadeInDown.duration(260).delay(index * 60).withInitialValues({ transform: [{ translateY: 6 }] }).reduceMotion(ReduceMotion.System)}>
      <Pressable
        accessibilityHint="Opens educational details and photo tips"
        accessibilityLabel={`${category.name}. ${category.description}`}
        accessibilityRole="button"
        onBlur={() => setFocused(false)}
        onFocus={() => setFocused(true)}
        onPress={onPress}
        style={({ pressed }) => [styles.card, (pressed || focused) && styles.active]}
        testID={`guide-card-${category.id}`}
      >
        <Image accessible={false} resizeMethod="resize" resizeMode="cover" source={category.image} style={[styles.image, compact && styles.compactImage]} />
        <View style={styles.copy}>
          <Text style={styles.title}>{category.name}</Text>
          <Text style={styles.description}>{category.description}</Text>
        </View>
        <Ionicons accessible={false} color={theme.colors.forestDark} name="chevron-forward" size={20} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center', backgroundColor: theme.colors.surface, borderColor: theme.colors.border,
    borderRadius: theme.radius.card, borderWidth: 1, flexDirection: 'row', gap: theme.spacing.smMd,
    padding: theme.spacing.smMd, ...theme.shadow.card,
  },
  active: { backgroundColor: theme.colors.mint, borderColor: theme.colors.forest },
  image: { borderRadius: theme.radius.control, height: 96, width: 80 },
  compactImage: { height: 88, width: 64 },
  copy: { flex: 1 },
  title: { color: theme.colors.text, fontSize: theme.type.size.body, fontWeight: theme.type.weight.bold, lineHeight: theme.type.lineHeight.compact },
  description: { color: theme.colors.muted, fontSize: theme.type.size.caption, lineHeight: 18, marginTop: theme.spacing.xs },
});
