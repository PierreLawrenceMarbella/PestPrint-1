import type { AnalysisState, InferenceClient } from '../types/analysis';
import type { CropImage } from '../types/cropImage';
import { AnalysisError } from './analysisErrors';

/** Request state is independent of animations, route transitions, and timers. */
export function createAnalysisController<TResult = unknown>(client: InferenceClient<TResult> | null) {
  let state: AnalysisState<TResult> = { status: 'idle' };
  let active: AbortController | null = null;
  const listeners = new Set<() => void>();

  function publish(next: AnalysisState<TResult>) {
    state = next;
    listeners.forEach((listener) => listener());
  }

  function cancel() {
    if (!active) return;
    const request = active;
    active = null;
    publish({ status: 'canceled' });
    request.abort();
  }

  function reset() {
    const request = active;
    active = null;
    publish({ status: 'idle' });
    request?.abort();
  }

  async function start(image: CropImage): Promise<void> {
    if (active) return;
    if (!client) {
      publish({
        status: 'error',
        code: 'unconfigured',
        message: 'AI analysis is unavailable in this build. Your selected image is still available.',
      });
      return;
    }

    const request = new AbortController();
    active = request;
    publish({ status: 'analyzing' });
    try {
      const result = await client.analyze(image, { signal: request.signal });
      // Ignore stale responses, including adapters that finish after cancellation.
      if (active !== request || request.signal.aborted) return;
      active = null;
      publish({ status: 'success', result });
    } catch (reason) {
      if (active !== request) return;
      active = null;
      if (request.signal.aborted || (reason instanceof Error && reason.name === 'AbortError')) {
        publish({ status: 'canceled' });
      } else {
        publish({
          status: 'error',
          code: reason instanceof AnalysisError ? reason.code : 'request_failed',
          message: reason instanceof AnalysisError ? reason.message : 'We could not analyze this image. Please try again.',
        });
      }
    }
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    isConfigured: client !== null,
    start,
    cancel,
    reset,
  };
}
