# build-and-upload.ps1
# Builds Android AAB via EAS, downloads it, and pushes to GitHub (garage-configurator repo)

$RepoPath   = "C:\Users\ola\garage-configurator"
$OutputDir  = "$RepoPath\Google PLAY app"
$AppJson    = "$PSScriptRoot\app.json"

# Read version from app.json
$version = (Get-Content $AppJson | ConvertFrom-Json).expo.version

Write-Host "==> Building Android (production)..." -ForegroundColor Cyan

# Run EAS build and capture output
$buildOutput = npx eas-cli build --platform android --profile production --non-interactive 2>&1
$buildOutput | Write-Host

# Extract AAB download URL from output
$aabUrl = ($buildOutput | Select-String -Pattern "https://expo\.dev/artifacts/eas/\S+\.aab").Matches.Value

if (-not $aabUrl) {
    Write-Host "ERROR: Could not find AAB URL in build output." -ForegroundColor Red
    exit 1
}

Write-Host "==> AAB URL: $aabUrl" -ForegroundColor Green

# Build filename: GarasjeProffen-v1.0.0-vc5.aab (version + versionCode auto-incremented by EAS)
$timestamp  = Get-Date -Format "yyyyMMdd-HHmm"
$fileName   = "GarasjeProffen-v$version-$timestamp.aab"
$destPath   = "$OutputDir\$fileName"

Write-Host "==> Downloading to: $destPath" -ForegroundColor Cyan
Invoke-WebRequest -Uri $aabUrl -OutFile $destPath

Write-Host "==> Committing and pushing to GitHub..." -ForegroundColor Cyan

Push-Location $RepoPath
    git add "Google PLAY app/$fileName"
    git commit -m "Android build: $fileName"
    git push
Pop-Location

Write-Host "==> Done! $fileName er lastet opp til GitHub." -ForegroundColor Green
Write-Host "    Husk å laste den opp i Google Play Console (Intern testing -> Opprett utgivelse)." -ForegroundColor Yellow
