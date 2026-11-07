import { File } from 'expo-file-system';

import type { InferenceClient } from '../types/analysis';
import type { ApiClassificationResult, ModelHealth } from '../types/api';
import type { CropImage } from '../types/cropImage';
import { analysisAbortError, AnalysisError } from './analysisErrors';
import type { ApiConfiguration } from './apiConfiguration';
import { mapPrediction, parseModelHealth, parsePrediction } from './apiResponse';

type RequestOptions = { signal: AbortSignal };
export type PestPrintApiClient = InferenceClient<ApiClassificationResult> & {
  getHealth(options: RequestOptions): Promise<ModelHealth>;
};

export function createPestPrintClient(configuration: ApiConfiguration, timeoutMs = 60_000): PestPrintApiClient {
  async function requestJson(path: string, init: RequestInit, { signal }: RequestOptions, limitMs: number): Promise<unknown> {
    if (signal.aborted) throw analysisAbortError();
    if (!configuration.baseUrl || configuration.error) {
      throw new AnalysisError('configuration', configuration.error ?? 'The AI service address has not been configured.');
    }
    const request = new AbortController();
    let timedOut = false;
    const abort = () => request.abort();
    signal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => { timedOut = true; request.abort(); }, limitMs);
    try {
      const response = await fetch(`${configuration.baseUrl}${path}`, {
        ...init, headers: { Accept: 'application/json' }, signal: request.signal,
      });
      // Do not set multipart Content-Type: native fetch supplies its boundary.
      if (!response.ok) {
        let detail: unknown;
        try { detail = await response.json(); } catch { /* HTTP status remains useful without JSON. */ }
        const supplied = detail && typeof detail === 'object' && 'error' in detail ? detail.error : null;
        const message = typeof supplied === 'string' && supplied.trim() && supplied.length <= 250 ? supplied : null;
        if (response.status === 503) throw new AnalysisError('model_unavailable', 'The trained model is unavailable on the server. Please try again after the project team restores it.');
        if (response.status === 400 || response.status === 413) throw new AnalysisError('server', message ?? 'The server could not accept this image. Choose a JPG or PNG image up to 10MB.');
        throw new AnalysisError('server', 'The AI service could not complete the request. Please try again later.');
      }
      try { return await response.json(); }
      catch { throw new AnalysisError('invalid_response', 'The AI service returned unreadable data. Please try again or contact the project team.'); }
    } catch (reason) {
      if (signal.aborted) throw analysisAbortError();
      if (timedOut) throw new AnalysisError('timeout', 'The AI service took too long to respond. Check your connection and try again.');
      if (reason instanceof AnalysisError) throw reason;
      throw new AnalysisError('network', 'Could not reach the AI service. Check that the server is running and your phone can reach it on the same Wi-Fi network.');
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
    }
  }

  async function getHealth(options: RequestOptions): Promise<ModelHealth> {
    return parseModelHealth(await requestJson('/api/health', { method: 'GET' }, options, Math.min(timeoutMs, 10_000)));
  }

  async function analyze(image: CropImage, options: RequestOptions): Promise<ApiClassificationResult> {
    const health = await getHealth(options);
    if (!health.available) throw new AnalysisError('model_unavailable', 'The trained model is not ready on the server. Your image has not been uploaded.');
    if (options.signal.aborted) throw analysisAbortError();
    const form = new FormData();
    // Expo SDK 57 fetch accepts File/Blob multipart parts, not legacy URI objects.
    // The picker has already copied and validated this local image file.
    form.append('image', new File(image.uri));
    const response = await requestJson('/api/analyze', { method: 'POST', body: form }, options, timeoutMs);
    return mapPrediction(parsePrediction(response));
  }

  return { analyze, getHealth };
}
