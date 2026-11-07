param([Parameter(Mandatory = $true)][string]$JavaHome)
$ErrorActionPreference = 'Stop'
$mobileRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$signingRoot = Join-Path $mobileRoot '.signing'
$propertiesPath = Join-Path $signingRoot 'release.properties'
$keyPath = Join-Path $signingRoot 'pestprint-release.p12'
if ((Test-Path -LiteralPath $propertiesPath) -and (Test-Path -LiteralPath $keyPath)) {
  return $propertiesPath
}
if ((Test-Path -LiteralPath $propertiesPath) -or (Test-Path -LiteralPath $keyPath)) {
  throw 'Signing files are incomplete. Restore the matching .signing backup; do not replace an existing key.'
}
New-Item -ItemType Directory -Path $signingRoot -Force | Out-Null
$randomBytes = New-Object byte[] 32
$generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $generator.GetBytes($randomBytes) } finally { $generator.Dispose() }
$password = [Convert]::ToBase64String($randomBytes)
$previousPassword = $env:PESTPRINT_KEYSTORE_PASSWORD
try {
  $env:PESTPRINT_KEYSTORE_PASSWORD = $password
  $keytool = Start-Process -FilePath (Join-Path $JavaHome 'bin/keytool.exe') -ArgumentList @('-genkeypair', '-noprompt', '-storetype', 'PKCS12', '-keystore', "`"$keyPath`"", '-storepass:env', 'PESTPRINT_KEYSTORE_PASSWORD', '-keypass:env', 'PESTPRINT_KEYSTORE_PASSWORD', '-alias', 'pestprint', '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-dname', '"CN=PESTPRINT, OU=Mobile, O=PESTPRINT"') -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput (Join-Path $signingRoot 'keytool-out.log') -RedirectStandardError (Join-Path $signingRoot 'keytool-error.log')
  if ($keytool.ExitCode -ne 0) { throw 'Could not create standalone signing identity. Review .signing/keytool-error.log.' }
  $properties = "storeFile=$($keyPath.Replace('\', '/'))`nstorePassword=$password`nkeyAlias=pestprint`nkeyPassword=$password`n"
  [System.IO.File]::WriteAllText($propertiesPath, $properties, [System.Text.UTF8Encoding]::new($false))
} finally { $env:PESTPRINT_KEYSTORE_PASSWORD = $previousPassword; $password = $null }
Write-Host 'Created the private .signing identity. Back up this folder privately to preserve future APK updates.'
return $propertiesPath
