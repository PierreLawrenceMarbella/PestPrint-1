import type { InferenceClient } from '../types/analysis';
import type { CropImage } from '../types/cropImage';
import type { OfflineRuntime, OfflineSession, OnDeviceClassificationResult } from '../types/offline';
import { AnalysisError, analysisAbortError } from './analysisErrors';
import { resultFromLogits } from './offlineResult';

const checkCanceled = (signal: AbortSignal) => { if (signal.aborted) throw analysisAbortError(); };

/** One lazy session and one native job at a time, including after UI cancellation. */
export class OnDeviceInferenceService implements InferenceClient<OnDeviceClassificationResult> {
  private session: OfflineSession | null = null;
  private busy = false;
  private releaseAfterRun = false;
  private releasing: Promise<void> | null = null;

  constructor(private readonly runtime: OfflineRuntime) {}

  async analyze(image: CropImage, { signal }: { signal: AbortSignal }): Promise<OnDeviceClassificationResult> {
    checkCanceled(signal);
    if (this.busy) throw new AnalysisError('busy', 'The previous analysis is finishing on your phone. Please try again in a moment.');
    this.busy = true;
    const start = performance.now();
    try {
      if (this.releasing) await this.releasing;
      checkCanceled(signal);
      const initializationStart = performance.now();
      if (!this.session) this.session = await this.runtime.initialize();
      const initializationMs = performance.now() - initializationStart;
      checkCanceled(signal);
      const preprocessingStart = performance.now();
      const input = await this.runtime.preprocess(image.uri);
      const preprocessingMs = performance.now() - preprocessingStart;
      checkCanceled(signal);
      if (input.length !== 3 * 224 * 224 || !input.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) {
        throw new AnalysisError('preprocessing', 'The image could not be prepared correctly. Choose another JPG or PNG image.');
      }
      const inferenceStart = performance.now();
      const logits = await this.session.run(input);
      const inferenceMs = performance.now() - inferenceStart;
      checkCanceled(signal);
      return resultFromLogits(logits, { initializationMs, preprocessingMs, inferenceMs, totalMs: performance.now() - start });
    } catch (reason) {
      if (signal.aborted) throw analysisAbortError();
      if (reason instanceof AnalysisError) throw reason;
      throw new AnalysisError('request_failed', 'Offline analysis could not finish. Try a smaller, clear rice crop image or restart the app.');
    } finally {
      this.busy = false;
      if (this.releaseAfterRun) { this.releaseAfterRun = false; await this.dispose().catch(() => {}); }
    }
  }

  async dispose(): Promise<void> {
    if (this.busy) { this.releaseAfterRun = true; return; }
    if (this.releasing) return this.releasing;
    const session = this.session;
    this.session = null;
    if (session) {
      this.releasing = session.release().finally(() => { this.releasing = null; });
      return this.releasing;
    }
  }
}
