import { backendClassIds, type ApiClassificationResult, type BackendClassId, type BackendPrediction, type ModelHealth } from '../types/api';
import { AnalysisError } from './analysisErrors';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isClass(value: unknown): value is BackendClassId {
  return typeof value === 'string' && backendClassIds.some((id) => id === value);
}

function matchesClasses(value: unknown): value is BackendClassId[] {
  return Array.isArray(value) && value.length === backendClassIds.length
    && new Set(value).size === backendClassIds.length && value.every(isClass);
}

function isProbability(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function invalidResponse(): never {
  throw new AnalysisError('invalid_response', 'The AI service returned an unsupported response. Please ask the project team to check the service.');
}

export function parseModelHealth(value: unknown): ModelHealth {
  if (!isRecord(value) || typeof value.available !== 'boolean' || typeof value.message !== 'string') return invalidResponse();
  if (!matchesClasses(value.classes)) {
    throw new AnalysisError('unsupported_model', 'The connected model’s categories do not match this app. No image was uploaded.');
  }
  return { available: value.available, classes: value.classes, message: value.message };
}

export function parsePrediction(value: unknown): BackendPrediction {
  if (!isRecord(value) || !isClass(value.prediction) || !isProbability(value.confidence)
    || !isRecord(value.probabilities) || !matchesClasses(Object.keys(value.probabilities))
    || typeof value.model !== 'string' || !value.model.trim() || value.unknown_method !== 'trained_class') return invalidResponse();
  const probabilities = value.probabilities;
  if (!backendClassIds.every((id) => isProbability(probabilities[id]))) return invalidResponse();
  const scores = probabilities as Record<BackendClassId, number>;
  const confidence = value.confidence;
  if (Math.abs(backendClassIds.reduce((sum, id) => sum + scores[id], 0) - 1) > 0.01
    || Math.abs(value.confidence - scores[value.prediction]) > 0.000001
    || backendClassIds.some((id) => scores[id] > confidence + 0.000001)) return invalidResponse();
  return {
    prediction: value.prediction, confidence: value.confidence, probabilities: scores,
    model: value.model, unknown_method: value.unknown_method,
  };
}

/** Unit conversion only. The backend owns every classification, including Unknown. */
export function mapPrediction(backend: BackendPrediction): ApiClassificationResult {
  const confidencePercent = backend.confidence * 100;
  switch (backend.prediction) {
    case 'healthy_rice': return { kind: 'healthy', source: 'backend', confidencePercent, backend };
    case 'rice_leaffolder':
    case 'rice_stem_borer': return { kind: 'known-pest', pest: backend.prediction, source: 'backend', confidencePercent, backend };
    case 'unknown': return {
      kind: 'unknown', source: 'backend', detectionMethod: backend.unknown_method,
      score: { value: confidencePercent, scale: 'percent', label: 'Confidence Score' }, backend,
    };
    default: return invalidResponse();
  }
}
