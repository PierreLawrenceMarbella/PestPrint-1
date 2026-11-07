import type { AnalysisFailureCode } from '../types/analysis';

/** Only deliberately user-facing transport/validation messages reach the UI. */
export class AnalysisError extends Error {
  constructor(public readonly code: AnalysisFailureCode, message: string) {
    super(message);
    this.name = 'AnalysisError';
  }
}

export function analysisAbortError(): Error {
  const error = new Error('Analysis canceled');
  error.name = 'AbortError';
  return error;
}
