import type { ClassificationResult } from '../types/pestResult';
import { knownPests } from './knownPests';

export function getResultName(result: ClassificationResult): string {
  if (result.kind === 'known-pest') return knownPests[result.pest].name;
  return result.kind === 'healthy' ? 'Healthy Rice' : 'Unknown (Other Damage)';
}

export const healthyCharacteristics = {
  title: 'Healthy appearance',
  description: 'A Healthy Rice result suggests a healthy-looking crop in this image. It does not guarantee that pests or diseases are absent.',
  characteristics: [
    'Healthy rice commonly has green leaves and normal-looking stems and grains.',
    'Continue checking your crop for new or persistent symptoms.',
  ],
};

export const unknownCharacteristics = {
  title: 'Unrecognized or unsupported damage',
  description: 'This result does not identify a supported pest. Damage may be caused by another pest, a disease, or a non-insect factor.',
  characteristics: [
    'Unknown does not identify the cause of the damage.',
    'Try a clear, close-up image of the affected rice plant.',
    'Consult a local agricultural expert if symptoms persist.',
  ],
};
