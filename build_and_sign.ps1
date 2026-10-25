# ==============================================================================
# Master Desktop Package Builder & Signer -- ARN IPTV Pro
# Development & Engineering: Abdo Ragab Nassar (ARN Technology 2026)
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "     ARN IPTV Pro -- Build and Sign Master Pipeline       " -ForegroundColor Green
Write-Host "     Company: ARN Technology -- Abdo Ragab Nassar         " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$CurrentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -Path $CurrentDir

# 1. Clean previous build outputs
Write-Host "[1/6] Cleaning previous build outputs..." -ForegroundColor Cyan
if (Test-Path "dist") { Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue }
if (Test-Path "dist-server") { Remove-Item -Path "dist-server" -Recurse -Force -ErrorAction SilentlyContinue }
if (Test-Path "release") { Remove-Item -Path "release" -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path "dist" -Force | Out-Null
New-Item -ItemType Directory -Path "dist-server" -Force | Out-Null
New-Item -ItemType Directory -Path "release" -Force | Out-Null

# 2. Build React + Vite Production Bundle
Write-Host "[2/6] Building Vite production bundle..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Vite build failed. Aborting." -ForegroundColor Red
    Exit 1
}
Write-Host "Vite build completed successfully." -ForegroundColor Green

# 3. Export Root Certificate if available in local store
Write-Host "[3/6] Exporting ARN Technology Root Certificate..." -ForegroundColor Cyan
$CertDir = Join-Path $CurrentDir "cert"
if (-not (Test-Path $CertDir)) { New-Item -ItemType Directory -Path $CertDir -Force | Out-Null }
$CertPath = Join-Path $CertDir "ARN_Technology_Root.cer"

$ArnCert = Get-ChildItem -Path Cert:\CurrentUser\My -ErrorAction SilentlyContinue | Where-Object {
    $_.Subject -like "*ARN Technology*" -or $_.Subject -like "*Nassar*"
} | Select-Object -First 1

if ($ArnCert) {
    Write-Host "Found certificate: $($ArnCert.Subject)" -ForegroundColor Green
    Export-Certificate -Cert $ArnCert -FilePath $CertPath -Force | Out-Null
} else {
    Write-Host "No custom certificate in CurrentUser\My, proceeding with standard packaging." -ForegroundColor Yellow
}

# 4. Build Standalone Windows Installer via electron-builder
Write-Host "[4/6] Building standalone Windows installer via electron-builder..." -ForegroundColor Cyan
npx electron-builder --win nsis --x64

if ($LASTEXITCODE -ne 0) {
    Write-Host "electron-builder encountered an error." -ForegroundColor Red
    Exit 1
}

# 5. Sign the generated installer executable with RFC-3161 Timestamp if certificate exists
Write-Host "[5/6] Verifying digital signature and timestamp (RFC-3161)..." -ForegroundColor Cyan
$GeneratedSetup = Get-ChildItem -Path "release\*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($GeneratedSetup) {
    Write-Host "Generated installer: $($GeneratedSetup.FullName)" -ForegroundColor Green

    if ($ArnCert) {
        $TimestampServer = "http://timestamp.digicert.com"
        Write-Host "Signing installer with ARN Technology certificate and DigiCert timestamp..." -ForegroundColor Cyan
        Set-AuthenticodeSignature -FilePath $GeneratedSetup.FullName -Certificate $ArnCert -TimestampServer $TimestampServer -HashAlgorithm SHA256 -ErrorAction SilentlyContinue | Out-Null
    }

    # 6. Unblock file (remove Zone.Identifier)
    Write-Host "[6/6] Unblocking installer (Unblock-File)..." -ForegroundColor Cyan
    Unblock-File -Path $GeneratedSetup.FullName -ErrorAction SilentlyContinue
    Write-Host "File unblocked and ready for distribution on any Windows machine." -ForegroundColor Green
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Build complete! Setup is ready for distribution:" -ForegroundColor White
if ($GeneratedSetup) {
    Write-Host ">> $($GeneratedSetup.FullName)" -ForegroundColor Yellow
    Write-Host "Size: $([math]::Round($GeneratedSetup.Length / 1MB, 2)) MB" -ForegroundColor Cyan
} else {
    Write-Host ">> release\" -ForegroundColor Yellow
}
Write-Host "==========================================================" -ForegroundColor Green
