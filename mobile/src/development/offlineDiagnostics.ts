// Native development-build verification only. Never installed into the release global scope.
import { imageTensorModule } from '../../modules/pestprint-image-tensor';
import type { OnDeviceInferenceService } from '../services/OnDeviceInferenceService';

export function installOfflineDiagnostics(client: OnDeviceInferenceService) {
  if (!__DEV__) return;
  const tools = {
    analyzeUri: (uri: string) => client.analyze({
      uri, fileName: uri.split('/').pop() ?? 'crop.jpg', mimeType: uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
      size: 0, width: 0, height: 0,
    }, { signal: new AbortController().signal }),
    prepareTensor: (uri: string) => {
      if (!imageTensorModule) throw new Error('Native image module unavailable');
      return imageTensorModule.preprocessAsync(uri);
    },
    deleteTensor: (uri: string) => imageTensorModule?.deleteTensorAsync(uri),
    releaseModel: () => client.dispose(),
  };
  Object.assign(globalThis, { __pestprintOfflineDiagnostics: tools });
}
