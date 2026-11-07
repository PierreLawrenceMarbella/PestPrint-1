param(
  [string]$Architectures = 'arm64-v8a,x86_64',
  [string]$Device = '',
  [switch]$Regenerate
)
$ErrorActionPreference = 'Stop'
$mobileRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location -LiteralPath $mobileRoot
try {
  if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
  if (-not $env:JAVA_HOME) {
    $jdk = Get-ChildItem 'C:\Program Files\Eclipse Adoptium\jdk-21*' -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if (-not $jdk) { throw 'Install JDK 21 and set JAVA_HOME before compiling the native app.' }
    $env:JAVA_HOME = $jdk.FullName
  }
  $env:NODE_ENV = 'development'
  $env:CMAKE_BUILD_PARALLEL_LEVEL = '1'
  node scripts/patch-onnx-runtime.cjs
  if ($LASTEXITCODE -ne 0) { throw 'ONNX package compatibility preparation failed.' }
  node scripts/prepare-offline-model.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Prepare the verified Phase 11B model before building.' }
  $manifest = Get-Content -LiteralPath 'assets/models/model-manifest.json' -Raw | ConvertFrom-Json
  $nativeAsset = Join-Path 'android/app/src/main/assets' $manifest.filename
  $needsNativeAsset = -not (Test-Path -LiteralPath $nativeAsset)
  if (-not $needsNativeAsset) { $needsNativeAsset = (Get-FileHash -LiteralPath $nativeAsset -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.sha256 }
  if ($Regenerate -or $needsNativeAsset -or -not (Test-Path -LiteralPath 'android/gradlew.bat')) {
    $androidScript = (Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json).scripts.android
    npx.cmd expo prebuild --platform android --no-install
    $prebuildExit = $LASTEXITCODE
    node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.scripts.android=process.argv[1];fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');" $androidScript
    if ($prebuildExit -ne 0) { throw 'Android prebuild failed.' }
  }
  Push-Location -LiteralPath (Join-Path $mobileRoot 'android')
  try {
    .\gradlew.bat :app:assembleDebug --no-daemon --max-workers=1 -I ..\scripts\low-memory.gradle "-PreactNativeArchitectures=$Architectures" '-Dorg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m'
    if ($LASTEXITCODE -ne 0) { throw 'Native development build failed. Review the first Gradle error.' }
  } finally { Pop-Location }
  $apk = Join-Path $mobileRoot 'android/app/build/outputs/apk/debug/app-debug.apk'
  if (-not (Test-Path -LiteralPath $apk)) { throw 'Expected development APK is missing.' }
  Write-Output "Development build: $apk"
  if ($Device) {
    & (Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe') -s $Device install -r $apk
    if ($LASTEXITCODE -ne 0) { throw 'Development build installation failed.' }
  }
} finally { Pop-Location }
