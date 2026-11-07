import { useEffect, useState } from 'react';
import { AccessibilityInfo, Modal, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { knownPests } from '../constants/knownPests';
import { getResultName } from '../constants/resultContent';
import { theme } from '../theme';
import type { ClassificationResult } from '../types/pestResult';
import { AppButton } from './AppButton';
import { PageHeader } from './PageHeader';
import { ResultCharacteristics } from './ResultCharacteristics';
import { Screen } from './Screen';

type ResultEducationModalProps = { result: ClassificationResult; visible: boolean; onClose: () => void; reduceMotion?: boolean };

export function ResultEducationModal({ result, visible, onClose, reduceMotion = false }: ResultEducationModalProps) {
  const [reduced, setReduced] = useState(reduceMotion);
  useEffect(() => {
    let mounted = true;
    let changed = false;
    const preference = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      changed = true;
      setReduced(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted && !changed) setReduced(value);
    }).catch(() => { if (mounted && !changed) setReduced(true); });
    return () => { mounted = false; preference.remove(); };
  }, []);
  return (
    <Modal animationType={reduced ? 'none' : 'fade'} onRequestClose={onClose} visible={visible}>
      <SafeAreaView edges={['bottom']} style={styles.container}>
        <Screen
          contentStyle={styles.content}
          header={<PageHeader onBack={onClose} title={getResultName(result)} />}
          testID="pest-education-screen"
        >
          {result.kind === 'known-pest' ? <Text style={styles.description}>{knownPests[result.pest].description}</Text> : null}
          {result.kind === 'unknown' ? (
            <Text style={styles.description}>
              For further inspection, photograph the affected leaves, stems, or grains clearly.
              Note when symptoms appeared and share these details with a local agricultural expert.
              This result alone cannot establish the cause.
            </Text>
          ) : null}
          <ResultCharacteristics result={result} />
          <AppButton label="Back to Result" onPress={onClose} testID="close-pest-education-button" />
        </Screen>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: theme.colors.background, flex: 1 },
  content: { paddingTop: theme.spacing.lg },
  description: { color: theme.colors.text, fontSize: theme.type.size.body, lineHeight: theme.type.lineHeight.body, marginBottom: theme.spacing.lg },
});
