import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { createAnalysisController } from '../services/analysisController';
import type { InferenceClient } from '../types/analysis';

export function useAnalysis<TResult = unknown>(client: InferenceClient<TResult> | null = null) {
  const controller = useMemo(() => createAnalysisController(client), [client]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);

  useEffect(() => () => controller.cancel(), [controller]);

  return {
    state,
    isConfigured: controller.isConfigured,
    start: controller.start,
    cancel: controller.cancel,
    reset: controller.reset,
  };
}
