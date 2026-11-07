import { File, FileMode } from 'expo-file-system';
import type { ImagePickerAsset } from 'expo-image-picker';

import type { CropImage } from '../types/cropImage';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const formatError = 'Choose a JPG, JPEG, or PNG image.';

export function detectImageType(bytes: Uint8Array): CropImage['mimeType'] | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return pngHeader.every((byte, index) => bytes[index] === byte) ? 'image/png' : null;
}

export function validateImageMetadata(
  asset: Pick<ImagePickerAsset, 'fileName' | 'mimeType' | 'fileSize' | 'width' | 'height'>,
  actualSize: number,
  actualType: CropImage['mimeType'] | null,
): void {
  if (!Number.isFinite(actualSize) || actualSize <= 0) {
    throw new Error('This image is empty or cannot be read. Choose another image.');
  }
  if (actualSize > MAX_IMAGE_BYTES || (asset.fileSize ?? 0) > MAX_IMAGE_BYTES) {
    throw new Error('This image exceeds 10MB. Choose a smaller JPG or PNG image.');
  }
  const extension = asset.fileName?.split('.').pop()?.toLowerCase();
  const declaredType = asset.mimeType?.toLowerCase();
  if (
    !actualType ||
    (extension && !['jpg', 'jpeg', 'png'].includes(extension)) ||
    (declaredType && !['image/jpeg', 'image/jpg', 'image/png'].includes(declaredType)) ||
    (extension === 'png' && actualType !== 'image/png') ||
    (['jpg', 'jpeg'].includes(extension ?? '') && actualType !== 'image/jpeg') ||
    (declaredType === 'image/png' && actualType !== 'image/png') ||
    (['image/jpeg', 'image/jpg'].includes(declaredType ?? '') && actualType !== 'image/jpeg')
  ) {
    throw new Error(formatError);
  }
  if (asset.width <= 0 || asset.height <= 0) {
    throw new Error('This image appears to be damaged. Choose another image.');
  }
}

export function validatePickedImage(asset: ImagePickerAsset): CropImage {
  const file = new File(asset.uri);
  if (!file.exists) throw new Error('This image is no longer available. Please select it again.');
  // Reject oversized files before reading even their header. Never read the full image into JS.
  const size = file.size;
  if (size > MAX_IMAGE_BYTES || (asset.fileSize ?? 0) > MAX_IMAGE_BYTES) {
    throw new Error('This image exceeds 10MB. Choose a smaller JPG or PNG image.');
  }
  const handle = file.open(FileMode.ReadOnly);
  let mimeType: CropImage['mimeType'] | null;
  try {
    mimeType = detectImageType(handle.readBytes(8));
  } finally {
    handle.close();
  }
  validateImageMetadata(asset, size, mimeType);
  return {
    uri: asset.uri,
    fileName: asset.fileName || `rice-crop.${mimeType === 'image/png' ? 'png' : 'jpg'}`,
    mimeType: mimeType!,
    size,
    width: asset.width,
    height: asset.height,
  };
}
