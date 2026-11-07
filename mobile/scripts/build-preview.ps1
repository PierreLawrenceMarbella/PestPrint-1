param([string]$Architectures = 'arm64-v8a,x86_64')
$ErrorActionPreference = 'Stop'
$mobileRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location -LiteralPath $mobileRoot
$previousHttpSetting = $env:PESTPRINT_ALLOW_HTTP_API
$previousSigning = $env:PESTPRINT_SIGNING_PROPERTIES
$previousNodeEnv = $env:NODE_ENV
$previousExpoEnv = $env:EXPO_NO_DOTENV
$previousNinja = $env:PESTPRINT_NINJA
$previousWorkers = $env:PESTPRINT_BUILD_WORKERS
try {
  if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
  if (-not (Test-Path (Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'))) {
    throw 'Android SDK not found. Install Android Studio and set ANDROID_HOME to its SDK folder.'
  }
  if (-not $env:JAVA_HOME) {
    $jdk = Get-ChildItem 'C:\Program Files\Eclipse Adoptium\jdk-21*' -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if ($jdk) { $env:JAVA_HOME = $jdk.FullName }
    else { throw 'Install JDK 21 and set JAVA_HOME before building.' }
  }
  $env:PESTPRINT_ALLOW_HTTP_API = '0'
  $env:NODE_ENV = 'production'
  $env:EXPO_NO_DOTENV = '1' # Ignore legacy LAN API settings in .env.local.
  $env:CMAKE_BUILD_PARALLEL_LEVEL = '1'
  $env:PESTPRINT_BUILD_WORKERS = '2'
  $env:PESTPRINT_NINJA = python scripts/prepare-windows-ninja.py
  if ($LASTEXITCODE -ne 0) { throw 'Preparing the Windows native build tool failed.' }
  node scripts/patch-onnx-runtime.cjs
  if ($LASTEXITCODE -ne 0) { throw 'ONNX native compatibility preparation failed.' }
  node scripts/prepare-offline-model.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Prepare the verified Phase 11B model before building.' }
  $env:PESTPRINT_SIGNING_PROPERTIES = & (Join-Path $PSScriptRoot 'prepare-signing.ps1') -JavaHome $env:JAVA_HOME
  $previousAndroidScript = (Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json).scripts.android
  npx.cmd expo prebuild --platform android --no-install --no-clean
  $prebuildExit = $LASTEXITCODE
  # Expo prebuild rewrites this command. Preserve the existing development workflow.
  node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.scripts.android=process.argv[1];fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');" $previousAndroidScript
  if ($prebuildExit -ne 0) { throw 'Expo Android prebuild failed.' }
  Push-Location -LiteralPath (Join-Path $mobileRoot 'android')
  try {
    .\gradlew.bat :app:assembleRelease --no-daemon --max-workers=1 -I ..\scripts\low-memory.gradle -I ..\scripts\standalone-signing.gradle "-PreactNativeArchitectures=$Architectures" '-Dorg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m'
    if ($LASTEXITCODE -ne 0) { throw 'Gradle APK build failed. Review its first error above.' }
  } finally { Pop-Location }
  $artifact = Join-Path $mobileRoot 'android\app\build\outputs\apk\release\app-release.apk'
  if (-not (Test-Path $artifact)) { throw 'Gradle finished without the expected APK artifact.' }
  $output = Join-Path $mobileRoot 'builds'
  New-Item -ItemType Directory -Path $output -Force | Out-Null
  $destination = Join-Path $output 'pestprint-offline.apk'
  Copy-Item -LiteralPath $artifact -Destination $destination
  python scripts/verify_standalone_apk.py $destination
  if ($LASTEXITCODE -ne 0) { throw 'Standalone APK packaging/signature verification failed.' }
  Write-Output "Standalone APK ready: $destination"
} finally {
  $env:PESTPRINT_ALLOW_HTTP_API = $previousHttpSetting
  $env:PESTPRINT_SIGNING_PROPERTIES = $previousSigning
  $env:NODE_ENV = $previousNodeEnv
  $env:EXPO_NO_DOTENV = $previousExpoEnv
  $env:PESTPRINT_NINJA = $previousNinja
  $env:PESTPRINT_BUILD_WORKERS = $previousWorkers
  Pop-Location
}
