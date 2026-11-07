import { useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { validatePickedImage } from '../services/imageValidation';
import type { CropImage } from '../types/cropImage';

const options: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  allowsMultipleSelection: false,
  quality: 1,
  exif: false,
  base64: false,
};

export function useCropImage() {
  const [image, setImage] = useState<CropImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const lock = useRef(true);
  const mounted = useRef(false);

  function accept(result: ImagePicker.ImagePickerResult) {
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) throw new Error('No image was returned. Please try again.');
    setImage(validatePickedImage(asset));
    setError(null);
  }

  useEffect(() => {
    mounted.current = true;
    let active = true;
    // Android may destroy the activity while its external picker/camera is open.
    void ImagePicker.getPendingResultAsync()
      .then((result) => {
        if (!active || !result) return;
        if ('code' in result) throw new Error('The image could not be recovered. Please select it again.');
        accept(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Please select your image again.');
      })
      .finally(() => {
        if (active) { lock.current = false; setBusy(false); }
      });
    return () => { active = false; mounted.current = false; };
  }, []);

  async function choose(source: 'gallery' | 'camera') {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!mounted.current) return;
        if (!permission.granted) {
          setError('Camera permission is needed to take a photo. You can also choose an image from your gallery.');
          if (!permission.canAskAgain) {
            Alert.alert('Enable camera access', 'Allow camera access for PESTPRINT in your device settings.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => {
                void Linking.openSettings().catch(() => {
                  if (mounted.current) setError('Open your device settings to enable camera access.');
                });
              } },
            ]);
          }
          return;
        }
      }
      // Android's system photo picker grants access only to the selected image.
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (mounted.current) accept(result);
    } catch (reason) {
      if (mounted.current) {
        setError(reason instanceof Error ? reason.message : 'Unable to open this image. Please try again.');
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function remove() {
    if (lock.current) return;
    setImage(null);
    setError(null);
  }

  function previewFailed() {
    setImage(null);
    setError('This image cannot be displayed. Please choose another JPG or PNG image.');
  }

  return { image, error, busy, choose, remove, previewFailed };
}
