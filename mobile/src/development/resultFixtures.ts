import { Image } from 'react-native';

import type { CropImage } from '../types/cropImage';
import type { ClassificationResult } from '../types/pestResult';

export type ResultFixture = { result: ClassificationResult; image: CropImage };

/** Explicit samples for UI review. Never used by the inference client. */
export function getResultFixture(scenario: unknown): ResultFixture | null {
  if (!__DEV__) return null;
  if (typeof scenario !== 'string' || !['stem-borer', 'rice-leaffolder', 'no-confidence', 'healthy', 'healthy-no-confidence', 'unknown', 'unknown-scored', 'unknown-raw-score'].includes(scenario)) return null;
  const healthy = scenario.startsWith('healthy');
  const unknown = scenario.startsWith('unknown');
  const leaffolder = scenario === 'rice-leaffolder';
  const asset = Image.resolveAssetSource(healthy ? require('../../assets/classes/healthy-rice.jpg')
    : unknown ? require('../../assets/classes/unknown-damage.jpg')
    : leaffolder ? require('../../assets/classes/rice-leaffolder.jpg')
    : require('../../assets/classes/stem-borer.jpg'));
  const result: ClassificationResult = healthy ? {
    kind: 'healthy', source: 'development-fixture', confidencePercent: scenario === 'healthy' ? 95.6 : null,
  } : unknown ? {
    kind: 'unknown', source: 'development-fixture',
    detectionMethod: scenario === 'unknown-raw-score' ? 'development-example' : 'trained_class',
    score: scenario === 'unknown-scored' ? { label: 'Confidence Score', value: 68.7, scale: 'percent' }
      : scenario === 'unknown-raw-score' ? { label: 'Detection score', value: 2.3456, scale: 'raw' } : null,
  } : {
      kind: 'known-pest',
      pest: leaffolder ? 'rice_leaffolder' : 'rice_stem_borer',
      source: 'development-fixture',
      confidencePercent: scenario === 'no-confidence' ? null : leaffolder ? 87.4 : 89.2,
  };
  return {
    result,
    image: {
      uri: asset.uri,
      fileName: 'Development example image',
      mimeType: 'image/jpeg',
      width: asset.width,
      height: asset.height,
      size: healthy ? 60660 : unknown ? 354702 : leaffolder ? 450187 : 70714,
    },
  };
}
