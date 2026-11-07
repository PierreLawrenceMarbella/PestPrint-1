import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppButton } from '../components/AppButton';
import { PageHeader } from '../components/PageHeader';
import { ResultCharacteristics } from '../components/ResultCharacteristics';
import { ResultEducationModal } from '../components/ResultEducationModal';
import { ResultPredictionCard } from '../components/ResultPredictionCard';
import { Screen } from '../components/Screen';
import { getResultName } from '../constants/resultContent';
import { useResultScreenMotion } from '../hooks/useResultScreenMotion';
import { theme } from '../theme';
import type { CropImage } from '../types/cropImage';
import type { ClassificationResult } from '../types/pestResult';

type ResultScreenProps = {
  image: CropImage;
  result: ClassificationResult;
  onBack: () => void;
  onAnalyzeAnother: () => void;
};

export function ResultScreen({ image, result, onBack, onAnalyzeAnother }: ResultScreenProps) {
  const [educationVisible, setEducationVisible] = useState(false);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const fixture = result.source === 'development-fixture';
  const motion = useResultScreenMotion(result.kind);

  return (
    <>
      <Screen
        contentStyle={styles.content}
        header={<PageHeader onBack={onBack} title="Analysis Result" />}
        testID={`${result.kind}-result-screen`}
      >
        <View>
          {fixture ? (
            <View accessibilityRole="alert" style={styles.fixture} testID="result-fixture-notice">
              <Text style={styles.fixtureTitle}>DEVELOPMENT FIXTURE</Text>
              <Text style={styles.fixtureText}>Example image and sample scores. No AI analysis was run.</Text>
            </View>
          ) : null}
          <Animated.View style={[styles.imageFrame, motion.image]}>
            {failedUri === image.uri ? (
              <Text style={styles.imageError}>This image is no longer available. You can analyze another image.</Text>
            ) : (
              <Image
                accessibilityLabel={fixture ? `${getResultName(result)} development example image` : 'Selected rice crop image'}
                onError={() => setFailedUri(image.uri)}
                resizeMode="contain"
                resizeMethod="resize"
                source={{ uri: image.uri }}
                style={styles.image}
                testID="result-crop-image"
              />
            )}
          </Animated.View>
          <Animated.View needsOffscreenAlphaCompositing style={motion.prediction} testID="result-prediction-reveal">
            <ResultPredictionCard result={result} motion={motion} />
          </Animated.View>
          <Animated.View needsOffscreenAlphaCompositing style={motion.characteristics} testID="result-characteristics-reveal">
            <ResultCharacteristics result={result} />
          </Animated.View>
          <Animated.View style={motion.actions} testID="result-actions-reveal">
            <AppButton
              allowLabelWrap
              label="Analyze Another Image"
              leadingIcon="refresh-outline"
              onPress={onAnalyzeAnother}
              resultFeedback
              style={styles.action}
              testID="analyze-another-image-button"
            />
            {result.kind !== 'healthy' ? <AppButton
              allowLabelWrap
              label={result.kind === 'known-pest' ? 'Learn More About This Pest' : 'Learn More'}
              onPress={() => setEducationVisible(true)}
              resultFeedback
              style={styles.action}
              testID="learn-more-pest-button"
              variant="secondary"
            /> : null}
          </Animated.View>
        </View>
      </Screen>
      <ResultEducationModal onClose={() => setEducationVisible(false)} reduceMotion={motion.initiallyReduced}
        result={result} visible={educationVisible} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: theme.spacing.md },
  imageFrame: {
    alignItems: 'center', backgroundColor: theme.colors.canvas, borderRadius: theme.radius.card,
    justifyContent: 'center', marginBottom: theme.spacing.smMd, overflow: 'hidden', width: '100%',
  },
  image: { height: 210, width: '100%' },
  imageError: { color: theme.colors.muted, lineHeight: theme.type.lineHeight.body, padding: theme.spacing.lg },
  action: { marginBottom: theme.spacing.smMd, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.sm },
  fixture: { backgroundColor: theme.colors.mint, borderRadius: theme.radius.control, marginBottom: theme.spacing.md, padding: theme.spacing.smMd },
  fixtureTitle: { color: theme.colors.forestDark, fontSize: theme.type.size.caption, fontWeight: theme.type.weight.bold },
  fixtureText: { color: theme.colors.text, fontSize: theme.type.size.caption, lineHeight: 18, marginTop: theme.spacing.xs },
});
