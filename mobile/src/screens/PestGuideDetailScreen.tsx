import { router } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { PageHeader } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { SectionTitle } from '../components/SectionTitle';
import { getGuideCategory } from '../constants/pestGuide';
import { theme } from '../theme';

const entrance = FadeIn.duration(240).reduceMotion(ReduceMotion.System);

export function PestGuideDetailScreen({ categoryId }: { categoryId: unknown }) {
  const category = getGuideCategory(categoryId);
  const backToGuide = () => router.replace('/pest-guide');
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else backToGuide();
  };

  if (!category) {
    return (
      <Screen contentStyle={styles.content} header={<PageHeader onBack={backToGuide} title="Pest Guide" />} testID="guide-not-found-screen">
        <SectionTitle>Category not found</SectionTitle>
        <Text style={styles.description}>Choose one of the four categories in the Pest Guide.</Text>
        <AppButton label="Back to Pest Guide" onPress={backToGuide} testID="back-to-guide-button" />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content} header={<PageHeader onBack={goBack} title="Category Details" />} testID={`guide-detail-${category.id}`}>
      <Animated.View entering={entrance}>
        <Image accessibilityLabel={`${category.name} educational example`} resizeMethod="resize" resizeMode="contain" source={category.image} style={styles.image} />
        <Text style={styles.caption}>Example image for education, not an analysis of your crop.</Text>
        <Text accessibilityRole="header" style={styles.title}>{category.name}</Text>
        <Text style={styles.description}>{category.overview}</Text>
        <AppCard style={styles.card} variant="mint">
          <SectionTitle>{category.id === 'healthy-rice' ? 'Typical healthy appearance' : category.id === 'unknown-damage' ? 'Understanding Unknown' : 'Typical damage characteristics'}</SectionTitle>
          {category.characteristics.map((characteristic) => (
            <View key={characteristic} style={styles.row}>
              <Text accessible={false} style={styles.bullet}>•</Text>
              <Text style={styles.item}>{characteristic}</Text>
            </View>
          ))}
        </AppCard>
        <SectionTitle>What to observe and photograph</SectionTitle>
        <Text style={styles.description}>{category.observation}</Text>
        <AppCard style={styles.card}>
          <SectionTitle>Keep in mind</SectionTitle>
          <Text style={styles.caution}>{category.caution}</Text>
        </AppCard>
        <AppButton allowLabelWrap label="Back to Pest Guide" onPress={goBack} testID="back-to-guide-button" variant="secondary" />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: theme.spacing.md },
  image: { backgroundColor: theme.colors.canvas, borderRadius: theme.radius.card, height: 210, width: '100%' },
  caption: { color: theme.colors.muted, fontSize: theme.type.size.caption, lineHeight: 18, marginTop: theme.spacing.sm },
  title: { color: theme.colors.text, fontSize: theme.type.size.pageTitle, fontWeight: theme.type.weight.bold, lineHeight: theme.type.lineHeight.pageTitle, marginTop: theme.spacing.md },
  description: { color: theme.colors.text, fontSize: theme.type.size.body, lineHeight: theme.type.lineHeight.body, marginBottom: theme.spacing.lg, marginTop: theme.spacing.smMd },
  card: { marginBottom: theme.spacing.lg, padding: theme.spacing.md },
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  bullet: { color: theme.colors.forest, fontSize: 19, lineHeight: theme.type.lineHeight.body },
  item: { color: theme.colors.text, flex: 1, fontSize: theme.type.size.body, lineHeight: theme.type.lineHeight.body },
  caution: { color: theme.colors.muted, fontSize: theme.type.size.label, lineHeight: theme.type.lineHeight.compact, marginTop: theme.spacing.sm },
});
