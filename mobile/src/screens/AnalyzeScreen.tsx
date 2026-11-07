import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, BackHandler, Image, Pressable, StyleSheet, Text, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { PageHeader } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { SectionTitle } from '../components/SectionTitle';
import { supportedCategories } from '../constants/categories';
import { getResultFixture } from '../development/resultFixtures';
import { useCropImage } from '../hooks/useCropImage';
import { useAnalysis } from '../hooks/useAnalysis';
import { inferenceClient } from '../services/inference';
import { isClassificationResult } from '../services/pestResult';
import { theme } from '../theme';
import { ProcessingScreen } from './ProcessingScreen';
import { ResultScreen } from './ResultScreen';

const uploadEntrance = FadeIn.duration(320).reduceMotion(ReduceMotion.System);
const previewEntrance = FadeInDown.duration(320)
  .withInitialValues({ transform: [{ translateY: 8 }] })
  .reduceMotion(ReduceMotion.System);

const classImages: Record<string, ImageSourcePropType> = {
  'Healthy Rice': require('../../assets/classes/healthy-rice.jpg'),
  'Stem Borer': require('../../assets/classes/stem-borer.jpg'),
  'Rice Leaffolder': require('../../assets/classes/rice-leaffolder.jpg'),
  'Unknown (Other Damage)': require('../../assets/classes/unknown-damage.jpg'),
};
const imageTips = [
  'Use clear, well-lit images.',
  'Focus on the damaged part of the rice plant.',
  'Avoid blurry or distant photos.',
  'Make sure the rice crop is visible.',
];

export function AnalyzeScreen() {
  const { resultFixture } = useLocalSearchParams<{ resultFixture?: string }>();
  const fixture = __DEV__ ? getResultFixture(resultFixture) : null;
  const showingFixture = fixture !== null;
  const { width, fontScale } = useWindowDimensions();
  const { image, error, busy, choose, remove, previewFailed } = useCropImage();
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const analysis = useAnalysis(inferenceClient);

  const backToImage = useCallback(() => {
    analysis.reset();
    setProcessing(false);
  }, [analysis.reset]);

  const analyzeAnother = useCallback(() => {
    analysis.reset();
    remove();
    setLoadedUri(null);
    setProcessing(false);
  }, [analysis.reset, remove]);

  const closeFixture = useCallback(() => {
    router.setParams({ resultFixture: undefined });
  }, []);

  useFocusEffect(useCallback(() => {
    if (!processing && !showingFixture) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showingFixture) closeFixture();
      else backToImage();
      return true;
    });
    return () => {
      subscription.remove();
      analysis.cancel();
    };
  }, [processing, showingFixture, closeFixture, backToImage, analysis.cancel]));

  if (fixture) {
    return (
      <ResultScreen
        key={resultFixture}
        image={fixture.image}
        onAnalyzeAnother={() => { analyzeAnother(); closeFixture(); }}
        onBack={closeFixture}
        result={fixture.result}
      />
    );
  }

  if (processing && image) {
    if (analysis.state.status === 'success' && isClassificationResult(analysis.state.result)) {
      return (
        <ResultScreen
          image={image}
          onAnalyzeAnother={analyzeAnother}
          onBack={backToImage}
          result={analysis.state.result}
        />
      );
    }
    return (
      <ProcessingScreen
        image={image}
        onBack={backToImage}
        onCancel={analysis.cancel}
        onRetry={analysis.isConfigured ? () => { void analysis.start(image); } : undefined}
        state={analysis.state}
      />
    );
  }

  return (
    <Screen
      header={<PageHeader onBack={() => router.navigate('/')} title="Analyze Image" />}
      testID="analyze-screen"
    >
      <Animated.View entering={uploadEntrance} style={styles.introduction}>
        {!image ? (
          <View
            accessibilityLabel="Upload a crop image"
            accessibilityRole="image"
            style={styles.illustration}
          >
            <Ionicons color={theme.colors.forest} name="image-outline" size={76} />
            <View style={styles.uploadBadge}>
              <Ionicons color={theme.colors.surface} name="arrow-up" size={25} />
            </View>
          </View>
        ) : null}
        <Text accessibilityRole="header" style={styles.title}>
          Upload or Capture a Rice Crop Image
        </Text>
        <Text style={styles.description}>
          Upload a clear image of a rice plant (leaves, stem, or grains) with visible
          damage for pest identification.
        </Text>
      </Animated.View>

      {error ? (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error} testID="image-error">
          {error}
        </Text>
      ) : null}

      {image ? (
        <Animated.View entering={previewEntrance} key={image.uri} style={styles.preview}>
          <Image
            accessibilityLabel="Selected rice crop image preview"
            onError={previewFailed}
            onLoad={() => setLoadedUri(image.uri)}
            resizeMode="contain"
            resizeMethod="resize"
            source={{ uri: image.uri }}
            style={styles.previewImage}
            testID="crop-image-preview"
          />
          <Text numberOfLines={1} style={styles.fileName}>{image.fileName}</Text>
          <Text style={[styles.fileSize, styles.fileMetadata]}>
            {image.mimeType === 'image/png' ? 'PNG' : 'JPEG'} · {(image.size / (1024 * 1024)).toFixed(2)}MB
          </Text>
          <View style={styles.previewActions}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void choose('gallery')}
              style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
              testID="replace-image-button"
            >
              <Text style={styles.replaceLabel}>Replace Image</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => { setLoadedUri(null); remove(); }}
              style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
              testID="remove-image-button"
            >
              <Text style={styles.removeLabel}>Remove Image</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : (
        <AppButton
          disabled={busy}
          label={'Choose Image\nfrom Gallery'}
          leadingIcon="images-outline"
          onPress={() => void choose('gallery')}
          style={styles.sourceButton}
          testID="choose-image-button"
          trailingIcon="chevron-forward"
        />
      )}

      <AppButton
        disabled={busy}
        label="Take a Photo"
        leadingIcon="camera-outline"
        onPress={() => void choose('camera')}
        style={styles.sourceButton}
        testID="take-photo-button"
        trailingIcon="chevron-forward"
        variant="secondary"
      />

      {busy ? (
        <View accessibilityLiveRegion="polite" style={styles.busy}>
          <ActivityIndicator color={theme.colors.forest} size="small" />
          <Text style={styles.fileSize}>Opening image tools…</Text>
        </View>
      ) : null}

      {image ? (
        <AppButton
          disabled={busy || loadedUri !== image.uri}
          label="Analyze Image"
          leadingIcon="scan-outline"
          onPress={() => {
            if (busy || loadedUri !== image.uri) return;
            setProcessing(true);
            void analysis.start(image);
          }}
          style={styles.sourceButton}
          testID="analyze-image-button"
        />
      ) : null}

      <Text style={styles.formats}>JPG, JPEG or PNG · Maximum 10MB</Text>

      <AppCard style={styles.tips} variant="mint">
        <Ionicons color={theme.colors.forest} name="information-circle" size={24} />
        <View style={styles.tipCopy}>
          <Text style={styles.tipTitle}>Tips for Better Results</Text>
          {imageTips.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <Ionicons color={theme.colors.forest} name="checkmark" size={16} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </AppCard>

      <SectionTitle style={styles.sectionTitle}>Supported Classes</SectionTitle>
      <View style={styles.classes}>
        {supportedCategories.map((category) => (
          <View key={category.name} style={[styles.classItem, (width < 340 || fontScale > 1.2) && styles.singleClass]}>
            <Image
              accessibilityLabel={`${category.name} example`}
              resizeMode="cover"
              resizeMethod="resize"
              source={classImages[category.name]}
              style={styles.classImage}
            />
            <View style={styles.className}>
              <Text style={styles.classLabel}>{category.name}</Text>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  introduction: { alignItems: 'center', paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.lg },
  illustration: {
    alignItems: 'center', backgroundColor: theme.colors.mint, borderRadius: theme.radius.pill,
    height: 118, justifyContent: 'center', marginBottom: theme.spacing.md, width: 118,
  },
  uploadBadge: {
    alignItems: 'center', backgroundColor: theme.colors.forest, borderColor: theme.colors.surface,
    borderRadius: theme.radius.pill, borderWidth: 3, bottom: 4, height: 40,
    justifyContent: 'center', position: 'absolute', right: 0, width: 40,
  },
  title: {
    color: theme.colors.text, fontSize: 24, fontWeight: theme.type.weight.bold,
    lineHeight: 29, textAlign: 'center',
  },
  description: {
    color: theme.colors.text, fontSize: theme.type.size.label,
    lineHeight: theme.type.lineHeight.compact, marginTop: theme.spacing.smMd, textAlign: 'center',
  },
  sourceButton: { marginBottom: theme.spacing.smMd, paddingHorizontal: theme.spacing.smMd, paddingVertical: theme.spacing.sm },
  preview: {
    backgroundColor: theme.colors.canvas, borderColor: theme.colors.border,
    borderRadius: theme.radius.card, borderWidth: 1, marginBottom: theme.spacing.md, overflow: 'hidden',
  },
  previewImage: { height: 210, width: '100%' },
  fileName: { color: theme.colors.text, fontSize: theme.type.size.label, marginHorizontal: theme.spacing.md, marginTop: theme.spacing.smMd },
  fileSize: { color: theme.colors.muted, fontSize: theme.type.size.caption },
  fileMetadata: { marginHorizontal: theme.spacing.md, marginTop: theme.spacing.xs },
  previewActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: theme.spacing.sm },
  textButton: { borderRadius: theme.radius.control, minHeight: 44, justifyContent: 'center', padding: theme.spacing.sm },
  replaceLabel: { color: theme.colors.forestDark, fontSize: theme.type.size.label, fontWeight: theme.type.weight.medium },
  removeLabel: { color: theme.colors.danger, fontSize: theme.type.size.label, fontWeight: theme.type.weight.medium },
  pressed: { backgroundColor: theme.colors.mint, opacity: 0.8 },
  busy: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'center', marginBottom: theme.spacing.md },
  formats: { color: theme.colors.muted, fontSize: theme.type.size.caption, marginVertical: theme.spacing.sm, textAlign: 'center' },
  error: { color: theme.colors.danger, fontSize: theme.type.size.label, lineHeight: theme.type.lineHeight.compact, marginBottom: theme.spacing.md },
  tips: { alignItems: 'flex-start', flexDirection: 'row', gap: theme.spacing.smMd, marginTop: theme.spacing.sm, padding: theme.spacing.md },
  tipCopy: { flex: 1 },
  tipTitle: { color: theme.colors.forestDark, fontSize: theme.type.size.label, fontWeight: theme.type.weight.bold, marginBottom: theme.spacing.xs },
  tipRow: { alignItems: 'flex-start', flexDirection: 'row', gap: theme.spacing.xs, marginTop: theme.spacing.xs },
  tipText: { color: theme.colors.text, flex: 1, fontSize: theme.type.size.caption, lineHeight: 18 },
  sectionTitle: { fontSize: theme.type.size.body, marginBottom: theme.spacing.smMd, marginTop: theme.spacing.lg },
  classes: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  classItem: {
    backgroundColor: theme.colors.canvas, borderColor: theme.colors.border,
    borderRadius: theme.radius.control, borderWidth: 1, flexBasis: '47%', flexDirection: 'row',
    flexGrow: 1, flexWrap: 'wrap', overflow: 'hidden',
  },
  singleClass: { flexBasis: '100%' },
  classImage: { height: 80, width: '100%' },
  className: { alignItems: 'center', justifyContent: 'center', minHeight: 54, padding: theme.spacing.sm, width: '100%' },
  classLabel: { color: theme.colors.text, fontSize: theme.type.size.caption, fontWeight: theme.type.weight.medium, lineHeight: 18, textAlign: 'center' },
});
