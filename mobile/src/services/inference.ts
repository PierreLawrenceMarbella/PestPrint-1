import { AppState } from 'react-native';
import { OnDeviceInferenceService } from './OnDeviceInferenceService';
import { nativeOfflineRuntime } from './nativeOfflineRuntime';

declare const module: { hot?: { dispose(callback: () => void): void } };

// No API URL, HTTP request, or network fallback participates in mobile classification.
export const inferenceClient = new OnDeviceInferenceService(nativeOfflineRuntime);
if (__DEV__) void import('../development/offlineDiagnostics').then(({ installOfflineDiagnostics }) => installOfflineDiagnostics(inferenceClient));
const subscription = AppState.addEventListener('change', (state) => {
  if (state === 'background') void inferenceClient.dispose().catch(() => {});
});
if (typeof module !== 'undefined' && module.hot) module.hot.dispose(() => {
  subscription.remove();
  void inferenceClient.dispose().catch(() => {});
});
