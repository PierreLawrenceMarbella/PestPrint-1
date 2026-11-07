# Build and Install PESTPRINT for Android

## 1. Requirements

On Windows, install:

- Node.js 24
- Python 3
- JDK 21
- Android Studio with Android SDK Platform 36 and Build Tools 36.0.0
- Android NDK 27.1.12297006 and CMake 3.22.1

The Android SDK and JDK must be configured. The build uses `ANDROID_HOME` and `JAVA_HOME`; the script can find the default SDK and JDK install locations. Obtain the verified model `model/onnx/efficientnet_b0_rice_pest.onnx` from team storage if it is missing. The build needs internet access to download dependencies and build tools.

## 2. Install Dependencies

Open PowerShell in the project folder and run:

```powershell
cd mobile
npm.cmd ci
npm.cmd run prepare:model
```

The model preparation command checks and copies the verified model into the mobile app. Do not use a different model file. See [OFFLINE_AI.md](OFFLINE_AI.md) for model details.

## 3. Build the APK

From the `mobile/` folder, run:

```powershell
npm.cmd run build:apk
```

The script builds and verifies a signed standalone release APK. No Expo Go or Metro is needed to run the installed release.

## 4. Find the APK

After a successful build, find the APK here:

```text
mobile/builds/pestprint-offline.apk
```

This build supports 64-bit ARM Android phones and x86_64 emulators (Android 7.0 or newer). It does not support 32-bit-only phones.

## 5. Install on Phone

1. Copy `pestprint-offline.apk` to the phone using USB or another file transfer method.
2. Open the APK in the phone's Files app. If Android asks, allow that app to install unknown apps.
3. Tap **Install**, then open PESTPRINT.

To install using USB debugging from the repository root:

```powershell
adb install -r mobile/builds/pestprint-offline.apk
```

To update an installed PESTPRINT app, keep it installed and use an APK signed with the same signing key and a higher `android.versionCode`. Before distributing a new version, update the version and code in `app.json` and rebuild. The first local build creates the private `mobile/.signing/` folder. Back it up securely and reuse it for later updates. Only authorized builders should access this backup through your team's secure storage; never commit it or send its files or passwords in chat. A newly created signing key cannot update an app signed with a different key; uninstalling first removes the old app's data.

## 6. Test Offline AI

1. Copy a rice crop JPG or PNG onto the phone.
2. Turn on Airplane mode and make sure Wi-Fi and mobile data are off.
3. Open PESTPRINT, choose **Analyze**, and select the image or take a photo.
4. Tap **Analyze Image** and check that a result appears.

The ONNX model is bundled in the APK. Image analysis does not need internet, Expo Go, Metro, a computer, or a Flask server. The app still needs camera permission to take a photo. For detailed validation results, see [PHASE_11F_D_REPORT.md](PHASE_11F_D_REPORT.md).

## 7. Common Problems

- **Model file missing:** Get the verified ONNX model from team storage, then run `npm.cmd run prepare:model` from `mobile/`.
- **SDK or Java not found:** Install the required versions above and set `ANDROID_HOME` to the Android SDK folder and `JAVA_HOME` to the JDK 21 folder.
- **Build fails downloading dependencies:** Check the internet connection, then retry `npm.cmd ci` and `npm.cmd run build:apk`.
- **Android says “App not installed” or reports a signature conflict:** The APK may be signed with a different key or have a lower version code. Use the original `.signing/` backup and a higher `android.versionCode`. Uninstall the existing app only if you accept that its local data will be removed.
- **Phone cannot install the APK:** Confirm it runs Android 7.0 or newer and supports 64-bit ARM apps; allow APK installation in the Files app's Android settings.
