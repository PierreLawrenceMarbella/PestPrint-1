import type { ClassificationResult, KnownPestId, KnownPestResult } from '../types/pestResult';
import { formatPercentage } from '../utils/formatPercentage';

export function isKnownPestId(value: unknown): value is KnownPestId {
  return value === 'rice_leaffolder' || value === 'rice_stem_borer';
}

/** Invalid/missing scores are unavailable, never clamped or replaced with a guess. */
export function getConfidencePercent(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;
}

export function formatConfidencePercent(value: unknown): string {
  const confidence = getConfidencePercent(value);
  return confidence === null ? 'Confidence unavailable' : formatPercentage(confidence, 'percent');
}

/** Accept only this explicit UI contract, without guessing the backend's shape or units. */
export function isKnownPestResult(value: unknown): value is KnownPestResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  return result.kind === 'known-pest'
    && isKnownPestId(result.pest)
    && (result.source === 'backend' || result.source === 'on-device' || result.source === 'development-fixture')
    && (result.confidencePercent == null || getConfidencePercent(result.confidencePercent) !== null);
}

/** Only validates an explicit result. This UI never classifies or applies thresholds. */
export function isClassificationResult(value: unknown): value is ClassificationResult {
  if (isKnownPestResult(value)) return true;
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  if (result.source !== 'backend' && result.source !== 'on-device' && result.source !== 'development-fixture') return false;
  if (result.kind === 'healthy') {
    return result.confidencePercent == null || getConfidencePercent(result.confidencePercent) !== null;
  }
  if (result.kind !== 'unknown' || typeof result.detectionMethod !== 'string' || !result.detectionMethod.trim()) return false;
  if (result.score == null) return true;
  if (typeof result.score !== 'object') return false;
  const score = result.score as Record<string, unknown>;
  return typeof score.label === 'string' && score.label.trim().length > 0
    && typeof score.value === 'number' && Number.isFinite(score.value)
    && (score.scale === 'raw' || (score.scale === 'percent' && getConfidencePercent(score.value) !== null));
}
