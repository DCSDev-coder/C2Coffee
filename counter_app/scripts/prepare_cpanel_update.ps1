param(
    [string]$ApkPath = "build\app\outputs\flutter-apk\app-release.apk",
    [string]$BaseUrl = "https://www.c2coffeeandcandle.com/download/counterdownload",
    [string]$ReleaseNotes = "C2 Store reliability and feature updates."
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PubspecPath = Join-Path $ProjectRoot "pubspec.yaml"
$ResolvedApkPath = if ([System.IO.Path]::IsPathRooted($ApkPath)) {
    $ApkPath
} else {
    Join-Path $ProjectRoot $ApkPath
}

$BaseUri = [System.Uri]$BaseUrl
if ($BaseUri.Scheme -ne "https" -or [string]::IsNullOrWhiteSpace($BaseUri.Host)) {
    throw "BaseUrl must be a valid HTTPS address."
}

if (-not (Test-Path $ResolvedApkPath -PathType Leaf)) {
    throw "Release APK not found: $ResolvedApkPath"
}

$VersionMatch = Select-String -Path $PubspecPath -Pattern '^version:\s*([0-9]+\.[0-9]+\.[0-9]+)\+([0-9]+)\s*$'
if ($null -eq $VersionMatch -or $VersionMatch.Matches.Count -ne 1) {
    throw "pubspec.yaml must contain a version such as version: 1.0.1+2"
}

$VersionName = $VersionMatch.Matches[0].Groups[1].Value
$VersionCode = [int]$VersionMatch.Matches[0].Groups[2].Value
$OutputDirectory = Join-Path $ProjectRoot "build\cpanel-update"
$ApkFileName = "c2-store-$VersionName-$VersionCode.apk"
$OutputApkPath = Join-Path $OutputDirectory $ApkFileName

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
Copy-Item -Force -Path $ResolvedApkPath -Destination $OutputApkPath
$HtaccessTemplate = Join-Path $ProjectRoot "deployment\cpanel-update\.htaccess"
$HtaccessOutput = Join-Path $OutputDirectory ".htaccess"
Copy-Item -Force -Path $HtaccessTemplate -Destination $HtaccessOutput
$Sha256 = (Get-FileHash -Algorithm SHA256 -Path $OutputApkPath).Hash.ToLowerInvariant()

$Manifest = [ordered]@{
    version_name = $VersionName
    version_code = $VersionCode
    apk_url = "$($BaseUrl.TrimEnd('/'))/$ApkFileName"
    sha256 = $Sha256
    release_notes = $ReleaseNotes
}

$ManifestPath = Join-Path $OutputDirectory "latest.json"
$ManifestJson = $Manifest | ConvertTo-Json
$Utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($ManifestPath, $ManifestJson, $Utf8WithoutBom)

Write-Host "Prepared cPanel update package:"
Write-Host "  $OutputApkPath"
Write-Host "  $ManifestPath"
Write-Host "Upload the APK first and latest.json last."
