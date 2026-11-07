import { Ionicons } from '@expo/vector-icons';
import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { AppCard } from '../components/AppCard';
import { BrandHeader } from '../components/BrandHeader';
import { PageHeader } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { SectionTitle } from '../components/SectionTitle';
import { pestGuideCategories } from '../constants/pestGuide';
import { nativeOfflineAvailable } from '../services/nativeOfflineRuntime';
import { theme } from '../theme';

const entrance = FadeIn.duration(260).reduceMotion(ReduceMotion.System);
const analysisSteps = [
  'Choose a clear rice crop image from your gallery or take a photo.',
  'The trained model runs on your phone and compares crop damage patterns with those learned during training. Internet is not required.',
  'Review the returned category, any supplied score, and the educational guide alongside your crop observations.',
];
const limitations = [
  'Image quality, lighting, and how much of the crop is visible can affect interpretation.',
  'A result supports field observations; it is not a definitive diagnosis or treatment recommendation.',
  'Healthy Rice does not guarantee that pests or diseases are absent.',
  'Unknown (Other Damage) does not identify a specific cause. Seek agricultural advice when symptoms persist.',
  'Guide images and development previews are educational examples, not findings in your crop.',
];

type AboutSectionProps = PropsWithChildren<{ title: string; icon: keyof typeof Ionicons.glyphMap }>;

function AboutSection({ title, icon, children }: AboutSectionProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.row}>
        <Ionicons accessible={false} color={theme.colors.forestDark} name={icon} size={22} />
        <SectionTitle style={styles.sectionTitle}>{title}</SectionTitle>
      </View>
      {children}
    </AppCard>
  );
}

export function AboutScreen() {
  const configured = nativeOfflineAvailable();
  const statusTitle = configured ? 'Offline AI included in this build' : 'Native Android build required';
  const statusDescription = configured
    ? 'Analyze a selected image on your phone using the bundled EfficientNet-B0 model. Images are not uploaded for classification. The model is checked when analysis starts.'
    : 'Gallery, camera, and the guide remain available. Offline classification needs a PESTPRINT Android development build or standalone APK; Expo Go cannot run the native model.';
  return (
    <Screen contentStyle={styles.content} header={<PageHeader title="About" />} testID="about-screen">
      <Animated.View entering={entrance}>
        <View style={styles.brand}>
          <BrandHeader />
          <Text style={styles.tagline}>Understand rice crop damage through images.</Text>
        </View>
        <AboutSection icon="leaf-outline" title="Project overview">
          <Text style={styles.description}>
            PESTPRINT is an image-based rice crop damage classification project for farmers
            and agricultural workers. It brings crop image tools and a focused educational
            guide into one native mobile app.
          </Text>
        </AboutSection>
        <AboutSection icon="scan-outline" title="Why crop damage images?">
          <Text style={styles.description}>
            Visible patterns on rice leaves, stems, or grains can help identify the likely
            pest, even when the pest itself is not visible. Classification helps users
            interpret these patterns and decide what to inspect further.
          </Text>
        </AboutSection>
        <AppCard style={styles.status} variant="mint">
          <View style={styles.row}>
            <Ionicons accessible={false} color={theme.colors.forestDark} name="information-circle-outline" size={22} />
            <Text style={styles.statusTitle}>{statusTitle}</Text>
          </View>
          <Text style={styles.description}>
            {statusDescription}
          </Text>
        </AppCard>
        <AboutSection icon="images-outline" title="How image analysis works">
          {analysisSteps.map((step, index) => (
            <View key={step} style={styles.step}>
              <Text style={styles.stepNumber}>{index + 1}.</Text>
              <Text style={[styles.description, styles.stepText]}>{step}</Text>
            </View>
          ))}
        </AboutSection>
        <AboutSection icon="layers-outline" title="Supported categories">
          {pestGuideCategories.map((category) => (
            <View key={category.id} style={styles.category}>
              <Ionicons accessible={false} color={theme.colors.forestDark} name={category.icon} size={20} />
              <Text style={styles.categoryName}>{category.name}</Text>
            </View>
          ))}
        </AboutSection>
        <AboutSection icon="shield-checkmark-outline" title="System limitations">
          {limitations.map((limitation) => (
            <View key={limitation} style={styles.step}>
              <Text accessible={false} style={styles.bullet}>•</Text>
              <Text style={[styles.description, styles.stepText]}>{limitation}</Text>
            </View>
          ))}
        </AboutSection>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: theme.spacing.md },
  brand: { alignItems: 'center', marginBottom: theme.spacing.lg },
  tagline: { color: theme.colors.muted, fontSize: theme.type.size.label, lineHeight: theme.type.lineHeight.compact, marginTop: theme.spacing.xs, textAlign: 'center' },
  card: { marginBottom: theme.spacing.md, padding: theme.spacing.md },
  status: { marginBottom: theme.spacing.md, padding: theme.spacing.md },
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.smMd },
  sectionTitle: { flex: 1 },
  statusTitle: { color: theme.colors.forestDark, flex: 1, fontSize: theme.type.size.body, fontWeight: theme.type.weight.bold, lineHeight: theme.type.lineHeight.compact },
  description: { color: theme.colors.muted, fontSize: theme.type.size.label, lineHeight: theme.type.lineHeight.body },
  step: { alignItems: 'flex-start', flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  stepNumber: { color: theme.colors.forestDark, fontSize: theme.type.size.label, fontWeight: theme.type.weight.bold, lineHeight: theme.type.lineHeight.body },
  stepText: { flex: 1 },
  category: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.smMd, marginVertical: theme.spacing.sm },
  categoryName: { color: theme.colors.text, flex: 1, fontSize: theme.type.size.body, fontWeight: theme.type.weight.medium, lineHeight: theme.type.lineHeight.body },
  bullet: { color: theme.colors.forest, fontSize: 19, lineHeight: theme.type.lineHeight.body },
});
