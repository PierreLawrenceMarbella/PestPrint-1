import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { PageHeader } from '../components/PageHeader';
import { ProcessingVisual } from '../components/ProcessingVisual';
import { Screen } from '../components/Screen';
import { theme } from '../theme';
import type { AnalysisState } from '../types/analysis';
import type { CropImage } from '../types/cropImage';

type ProcessingScreenProps = {
  image: CropImage;
  onBack: () => void;
  onCancel: () => void;
  onRetry?: () => void;
  state: AnalysisState;
};

function getCopy(state: AnalysisState) {
  switch (state.status) {
    case 'analyzing':
      return {
        title: 'Analyzing Rice Crop Image...',
        subtitle: 'Identifying crop damage patterns and predicting the likely pest.',
        notice: 'Analyzing rice crop image...',
        message: 'The model is running on your phone. Internet is not required. You can cancel at any time.',
      };
    case 'error':
      return {
        title: state.code === 'unconfigured' ? 'Analysis unavailable' : 'Unable to analyze image',
        subtitle: 'Your selected image is still available.',
        notice: state.code === 'unconfigured' ? 'AI analysis is unavailable in this build' : 'Analysis could not finish',
        message: state.message,
      };
    case 'canceled':
      return {
        title: 'Analysis canceled',
        subtitle: 'Your selected image is still available.',
        notice: 'Analysis canceled',
        message: 'You can return to your image or try again when you are ready.',
      };
    case 'success':
      return {
        title: 'Analysis complete',
        subtitle: 'The analysis request has completed.',
        notice: 'Result ready',
        message: 'The on-device model finished analyzing your selected image.',
      };
    case 'idle':
      return {
        title: 'Ready to analyze',
        subtitle: 'Your rice crop image is ready.',
        notice: 'Image ready',
        message: 'Start on-device analysis of your selected image.',
      };
  }
}

/** Presents request state; it never creates predictions or advances on a timer. */
export function ProcessingScreen({ image, onBack, onCancel, onRetry, state }: ProcessingScreenProps) {
  const copy = getCopy(state);
  const analyzing = state.status === 'analyzing';
  const showRetry = onRetry && ['idle', 'error', 'canceled'].includes(state.status);

  return (
    <Screen
      contentStyle={styles.content}
      header={<PageHeader onBack={onBack} title="Image Analysis" />}
      testID="processing-screen"
    >
      <View style={styles.body}>
        <ProcessingVisual active={analyzing} image={image}>
          <View accessibilityLiveRegion="polite" style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
            <Text style={styles.subtitle}>{copy.subtitle}</Text>
          </View>
        </ProcessingVisual>

        <AppCard style={styles.notice} variant="mint">
          <Ionicons
            color={theme.colors.forestDark}
            name={state.status === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline'}
            size={23}
          />
          <View accessibilityLiveRegion="polite" style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>{copy.notice}</Text>
            <Text style={styles.message}>{copy.message}</Text>
          </View>
        </AppCard>

        {analyzing ? (
          <AppButton label="Cancel Analysis" onPress={onCancel} style={styles.action} testID="cancel-analysis-button" />
        ) : null}
        {showRetry ? (
          <AppButton
            label={state.status === 'idle' ? 'Start Analysis' : 'Try Again'}
            onPress={onRetry}
            style={styles.action}
            testID="retry-analysis-button"
          />
        ) : null}
        <AppButton
          label="Back to Image"
          onPress={onBack}
          testID="processing-back-button"
          variant={analyzing || showRetry ? 'secondary' : 'primary'}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'center', paddingTop: theme.spacing.xl },
  body: { width: '100%' },
  heading: { alignItems: 'center', marginBottom: theme.spacing.lg },
  title: {
    color: theme.colors.text, fontSize: theme.type.size.pageTitle,
    fontWeight: theme.type.weight.bold, lineHeight: theme.type.lineHeight.pageTitle, textAlign: 'center',
  },
  subtitle: {
    color: theme.colors.text, fontSize: theme.type.size.body,
    lineHeight: theme.type.lineHeight.body, marginTop: theme.spacing.smMd, textAlign: 'center',
  },
  notice: { alignItems: 'flex-start', flexDirection: 'row', gap: theme.spacing.smMd, marginBottom: theme.spacing.lg, padding: theme.spacing.md },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: theme.colors.forestDark, fontSize: theme.type.size.label, fontWeight: theme.type.weight.bold },
  message: { color: theme.colors.text, fontSize: theme.type.size.label, lineHeight: theme.type.lineHeight.compact, marginTop: theme.spacing.sm },
  action: { marginBottom: theme.spacing.smMd },
});
