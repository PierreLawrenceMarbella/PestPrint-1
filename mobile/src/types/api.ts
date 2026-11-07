import type { ClassificationResult } from './pestResult';

export const backendClassIds = ['healthy_rice', 'rice_leaffolder', 'rice_stem_borer', 'unknown'] as const;
export type BackendClassId = typeof backendClassIds[number];

export type ModelHealth = { available: boolean; classes: BackendClassId[]; message: string };
export type BackendPrediction = {
  prediction: BackendClassId;
  confidence: number;
  probabilities: Record<BackendClassId, number>;
  model: string;
  unknown_method: 'trained_class';
};

/** The original validated response remains available without changing its scores. */
export type ApiClassificationResult = ClassificationResult & { backend: BackendPrediction };
