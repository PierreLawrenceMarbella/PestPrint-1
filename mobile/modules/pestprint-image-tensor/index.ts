import { requireOptionalNativeModule } from 'expo-modules-core';

export type PreparedImage = {
  uri: string;
  bytes: number;
  sourceWidth: number;
  sourceHeight: number;
  orientation: number;
  durationMs: number;
};
export interface ImageTensorModule {
  prepareModelAsync(filename: string, expectedBytes: number, sha256: string): Promise<string>;
  preprocessAsync(uri: string): Promise<PreparedImage>;
  deleteTensorAsync(uri: string): Promise<void>;
}
export const imageTensorModule = requireOptionalNativeModule<ImageTensorModule>('PestPrintImageTensor');
