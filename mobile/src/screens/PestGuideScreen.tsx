import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GuideCategoryCard } from '../components/GuideCategoryCard';
import { PageHeader } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { pestGuideCategories } from '../constants/pestGuide';
import { theme } from '../theme';

export function PestGuideScreen() {
  return (
    <Screen header={<PageHeader title="Pest Guide" />} testID="pest-guide-screen">
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>Common Rice Classes and Their Characteristics</Text>
        <Text style={styles.description}>Learn about the supported classes, their typical damage patterns, and key signs.</Text>
      </View>
      <View style={styles.list}>
        {pestGuideCategories.map((category, index) => (
          <GuideCategoryCard
            category={category}
            index={index}
            key={category.id}
            onPress={() => router.push({ pathname: '/pest-guide/[category]', params: { category: category.id } })}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { marginVertical: theme.spacing.lg },
  title: { color: theme.colors.text, fontSize: 21, fontWeight: theme.type.weight.bold, lineHeight: 27, textAlign: 'center' },
  description: { color: theme.colors.muted, fontSize: theme.type.size.label, lineHeight: theme.type.lineHeight.compact, marginTop: theme.spacing.sm, textAlign: 'center' },
  list: {
    gap: theme.spacing.smMd,
  },
});
