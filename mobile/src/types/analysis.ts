import type { CropImage } from './cropImage';

export type AnalysisFailureCode = 'request_failed' | 'configuration' | 'network' | 'timeout'
  | 'server' | 'model_unavailable' | 'unsupported_model' | 'invalid_response'
  | 'native_unavailable' | 'preprocessing' | 'busy';

export type AnalysisState<TResult = unknown> =
  | { status: 'idle' }
  | { status: 'analyzing' }
  | { status: 'success'; result: TResult }
  | { status: 'error'; code: 'unconfigured' | AnalysisFailureCode; message: string }
  | { status: 'canceled' };

/** Online and on-device adapters validate genuine results before resolving. */
export interface InferenceClient<TResult = unknown> {
  analyze(image: CropImage, options: { signal: AbortSignal }): Promise<TResult>;
}
