import { NativeModules, Platform } from 'react-native';
import { File } from 'expo-file-system';
import type { InferenceSession } from 'onnxruntime-react-native';
import { imageTensorModule } from '../../modules/pestprint-image-tensor';
import manifest from '../../assets/models/model-manifest.json';
import type { OfflineRuntime, OfflineSession } from '../types/offline';
import { AnalysisError } from './analysisErrors';

export function nativeOfflineAvailable(): boolean {
  return Platform.OS === 'android' && !!imageTensorModule && !!NativeModules.Onnxruntime;
}

export const nativeOfflineRuntime: OfflineRuntime = {
  async initialize(): Promise<OfflineSession> {
    if (!nativeOfflineAvailable() || !imageTensorModule) {
      throw new AnalysisError('native_unavailable', 'Offline AI needs the PESTPRINT Android development build or standalone APK. Expo Go cannot run this model.');
    }
    try {
      const path = await imageTensorModule.prepareModelAsync(manifest.filename, manifest.bytes, manifest.sha256);
      // Delay native JSI import so Expo Go can still open Home/Guide and report a useful error.
      const ort: typeof import('onnxruntime-react-native') = require('onnxruntime-react-native');
      const session = await ort.InferenceSession.create(path, {
        executionProviders: ['cpu'], intraOpNumThreads: 2, interOpNumThreads: 1,
        graphOptimizationLevel: 'all',
      });
      try {
        const input = session.inputMetadata[0];
        const output = session.outputMetadata[0];
        if (session.inputNames.length !== 1 || session.inputNames[0] !== 'image'
          || session.outputNames.length !== 1 || session.outputNames[0] !== 'logits'
          || !input?.isTensor || input.type !== 'float32' || input.shape.join(',') !== '1,3,224,224'
          || !output?.isTensor || output.type !== 'float32' || output.shape.join(',') !== '1,4') {
          throw new Error('Invalid model contract');
        }
      } catch {
        await session.release();
        throw new AnalysisError('unsupported_model', 'The bundled model does not match PESTPRINT. Reinstall the correct app build.');
      }
      return {
        async run(inputData) {
          const input = new ort.Tensor('float32', inputData, [1, 3, 224, 224]);
          let outputs: InferenceSession.ReturnType | undefined;
          try {
            outputs = await session.run({ image: input });
            const output = outputs.logits;
            if (!output || output.type !== 'float32' || output.dims.join(',') !== '1,4' || !(output.data instanceof Float32Array)) {
              throw new AnalysisError('invalid_response', 'The on-device model returned unexpected output. Please restart the app.');
            }
            return new Float32Array(output.data);
          } finally {
            input.dispose();
            if (outputs) Object.values(outputs).forEach((tensor) => tensor.dispose());
          }
        },
        release: () => session.release(),
      };
    } catch (reason) {
      if (reason instanceof AnalysisError) throw reason;
      throw new AnalysisError('model_unavailable', 'The bundled AI model could not be loaded. Reinstall the PESTPRINT Android build and try again.');
    }
  },

  async preprocess(uri) {
    if (!imageTensorModule) throw new AnalysisError('native_unavailable', 'Image processing requires the native PESTPRINT Android build.');
    let tensorUri: string | undefined;
    try {
      const prepared = await imageTensorModule.preprocessAsync(uri);
      tensorUri = prepared.uri;
      if (prepared.bytes !== 3 * 224 * 224 * 4) throw new Error('Wrong tensor file size');
      const bytes = await new File(prepared.uri).bytes();
      if (bytes.byteLength !== prepared.bytes) throw new Error('Incomplete tensor file');
      return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    } catch {
      throw new AnalysisError('preprocessing', 'This image could not be processed on your phone. Choose a valid JPG or PNG up to 10 MB and 25 megapixels, or try a smaller image.');
    } finally {
      if (tensorUri) await imageTensorModule.deleteTensorAsync(tensorUri).catch(() => {});
    }
  },
};
