import manifest from '../../assets/models/model-manifest.json';
import { AnalysisError } from './analysisErrors';
import { offlineClassIds, type FourScores, type OnDeviceClassificationResult } from '../types/offline';

/** Stable softmax ONCE over the four genuine logits; no Unknown threshold. */
export function resultFromLogits(logits: Float32Array, timings: OnDeviceClassificationResult['inference']['timings']): OnDeviceClassificationResult {
  if (logits.length !== 4 || !Array.from(logits).every(Number.isFinite)) {
    throw new AnalysisError('invalid_response', 'The on-device model returned invalid scores. Please restart the app and try again.');
  }
  const maximum = Math.max(...logits);
  const exponents = Array.from(logits, (value) => Math.fround(Math.exp(Math.fround(value - maximum))));
  const total = exponents.reduce((sum, value) => Math.fround(sum + value), 0);
  const scores = exponents.map((value) => Math.fround(value / total)) as unknown as FourScores;
  if (!scores.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
    || Math.abs(scores.reduce((sum, value) => sum + value, 0) - 1) > 1e-6) {
    throw new AnalysisError('invalid_response', 'The on-device model returned invalid probabilities. Please try again.');
  }
  // First maximum wins ties, as in the existing backend's softmax/argmax path.
  let best = 0;
  for (let i = 1; i < 4; i++) if (scores[i] > scores[best]) best = i;
  const predicted = offlineClassIds[best];
  const confidencePercent = scores[best] * 100;
  const inference: OnDeviceClassificationResult['inference'] = {
    model: 'EfficientNet-B0', modelSha256: manifest.sha256, logits: Array.from(logits) as unknown as FourScores,
    probabilities: Object.fromEntries(offlineClassIds.map((id, i) => [id, scores[i]])) as OnDeviceClassificationResult['inference']['probabilities'],
    unknownMethod: 'trained_class', timings,
  };
  if (predicted === 'healthy_rice') return { kind: 'healthy', source: 'on-device', confidencePercent, inference };
  if (predicted === 'unknown') return {
    kind: 'unknown', source: 'on-device', detectionMethod: 'trained_class',
    score: { value: confidencePercent, scale: 'percent', label: 'Confidence Score' }, inference,
  };
  return { kind: 'known-pest', pest: predicted, source: 'on-device', confidencePercent, inference };
}
