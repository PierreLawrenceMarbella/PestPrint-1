export type KnownPestId = 'rice_leaffolder' | 'rice_stem_borer';
export type ResultSource = 'backend' | 'on-device' | 'development-fixture';

/** UI contract for validated API results and labeled fixtures; confidence uses percent units. */
export type KnownPestResult = {
  kind: 'known-pest';
  pest: KnownPestId;
  source: ResultSource;
  /** Actual supplied confidence in [0, 100]. Omit or use null when unavailable. */
  confidencePercent?: number | null;
};

export type HealthyRiceResult = {
  kind: 'healthy';
  source: ResultSource;
  confidencePercent?: number | null;
};

/** Preserve the supplied score's meaning and units; a raw score is not a probability. */
export type UnknownScore = {
  value: number;
  label: string;
  scale: 'percent' | 'raw';
};

export type UnknownResult = {
  kind: 'unknown';
  source: ResultSource;
  /** Actual backend unknown_method, e.g. trained_class. Never inferred from confidence. */
  detectionMethod: string;
  score?: UnknownScore | null;
};

export type ModelEvidence = {
  model: string;
  modelSha256: string;
  logits: readonly [number, number, number, number];
  probabilities: Record<'healthy_rice' | 'rice_leaffolder' | 'rice_stem_borer' | 'unknown', number>;
};
export type ClassificationResult = (KnownPestResult | HealthyRiceResult | UnknownResult) & { inference?: ModelEvidence };
