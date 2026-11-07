# PESTPRINT Android Mobile App

## Overview

PESTPRINT is a native Android app for identifying likely rice crop damage from an image. It runs the trained EfficientNet-B0 model on the phone with ONNX Runtime. Image analysis does not require a server or internet connection.

## Features

- Capture a crop photo or choose one from the gallery.
- View the predicted class, confidence, and model probabilities.
- Browse crop information in the Pest Guide and About screens.
- Analyze images offline using the model bundled in the app.

## Supported Classifications

- Healthy Rice
- Rice Leaffolder
- Stem Borer
- Unknown (Other Damage)

## How It Works

1. Open PESTPRINT.
2. Capture or upload a rice crop image.
3. The trained model processes the image directly on the phone.
4. View the classification and confidence score.

## Development Setup

Use Node.js 24, Python 3, JDK 21, and the Android SDK configured for this project. Obtain the verified ONNX model from team storage before preparing or building the app. From the repository root, run:

```powershell
cd mobile
npm.cmd ci
npm.cmd run prepare:model
npm.cmd run build:dev
npm.cmd start -- --dev-client
```

The native ONNX runtime requires a custom development build. Ordinary Expo Go can preview screens but cannot run offline AI analysis. The development app uses Metro for JavaScript; the standalone APK does not. See [OFFLINE_AI.md](OFFLINE_AI.md) for native setup and model details.

## How to Build the APK

For a local Windows release build, install Node.js 24, Python 3, JDK 21, Android SDK 36, Build Tools 36.0.0, NDK 27.1.12297006, and CMake 3.22.1. Keep the release signing files private. From the repository root:

```powershell
cd mobile
npm.cmd ci
npm.cmd run build:apk
```

The build produces `mobile/builds/pestprint-offline.apk` and a versioned APK such as `mobile/builds/pestprint-offline-1.0.2.apk`. Copy the APK to your Android phone, open it in Files, allow that app to install unknown apps if Android asks, and install PESTPRINT. To update an existing installation, keep the app installed and open the newer signed APK. See [BUILD_ANDROID.md](BUILD_ANDROID.md) for exact build, signing, and installation details.

## Offline AI

The verified ONNX model is bundled in the APK and runs locally through ONNX Runtime. Mobile image analysis does not contact Flask or another backend and does not download the model at runtime. The website's backend remains separate. See [OFFLINE_AI.md](OFFLINE_AI.md) and [PHASE_11F_D_REPORT.md](PHASE_11F_D_REPORT.md) for technical and validation details.

## Troubleshooting

- **Expo Go cannot analyze images:** install and open the custom development build or standalone APK.
- **Model missing during setup/build:** obtain the verified ONNX file from team storage, then run `npm.cmd run prepare:model` from `mobile/`.
- **Android build tools are not found:** install the required JDK and Android SDK versions above, and configure `JAVA_HOME` and `ANDROID_HOME` as described in [BUILD_ANDROID.md](BUILD_ANDROID.md).
- **Android reports a signing conflict:** the installed app and update must use the same release signing key. Keep the original app installed and use the matching project release key; do not generate a replacement key for an update.
