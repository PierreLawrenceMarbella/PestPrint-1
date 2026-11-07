import type { ClassificationResult } from './pestResult';

export const offlineClassIds = ['healthy_rice', 'rice_leaffolder', 'rice_stem_borer', 'unknown'] as const;
export type OfflineClassId = typeof offlineClassIds[number];
export type FourScores = readonly [number, number, number, number];
export type OnDeviceClassificationResult = ClassificationResult & {
  source: 'on-device';
  inference: {
    model: 'EfficientNet-B0';
    modelSha256: string;
    logits: FourScores;
    probabilities: Record<OfflineClassId, number>;
    unknownMethod: 'trained_class';
    timings: { initializationMs: number; preprocessingMs: number; inferenceMs: number; totalMs: number };
  };
};

export interface OfflineSession {
  run(input: Float32Array): Promise<Float32Array>;
  release(): Promise<void>;
}
export interface OfflineRuntime {
  initialize(): Promise<OfflineSession>;
  preprocess(uri: string): Promise<Float32Array>;
}
