# ==============================================================================
# ARN IPTV Pro -- Desktop Application Launcher
# Development & Engineering: Abdo Ragab Nassar (ARN Technology 2026)
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         ARN IPTV Pro -- Desktop Edition (2026)           " -ForegroundColor Green
Write-Host "     Company: ARN Technology -- Abdo Ragab Nassar         " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$CurrentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -Path $CurrentDir

# 1. Check if production dist and dist-server exist, if not build them
$DistPath = Join-Path $CurrentDir "dist"
$ServerDist = Join-Path $CurrentDir "dist-server\server.cjs"
if (-not (Test-Path $DistPath) -or -not (Test-Path $ServerDist)) {
    Write-Host "[1/3] Building Dark Glassmorphism UI & Embedded Server..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed. Please inspect build errors." -ForegroundColor Red
        Exit $LASTEXITCODE
    }
} else {
    Write-Host "[1/3] UI and embedded server are ready." -ForegroundColor Green
}

# 2. Check dependencies
$NodeModulesPath = Join-Path $CurrentDir "node_modules"
if (-not (Test-Path $NodeModulesPath)) {
    Write-Host "[2/3] Installing essential runtime dependencies..." -ForegroundColor Cyan
    npm install --legacy-peer-deps
} else {
    Write-Host "[2/3] Runtime packages are ready." -ForegroundColor Green
}

# 3. Launch the Electron Desktop Window
Write-Host "[3/3] Launching ARN IPTV Pro Desktop Window..." -ForegroundColor Green
Write-Host "Close the main window to exit." -ForegroundColor Gray
Write-Host ""

$ElectronExe = Join-Path $CurrentDir "node_modules\electron\dist\electron.exe"
if (Test-Path $ElectronExe) {
    & $ElectronExe ".\electron-main.cjs"
} else {
    $ElectronCmd = Join-Path $CurrentDir "node_modules\.bin\electron.cmd"
    if (Test-Path $ElectronCmd) {
        & $ElectronCmd ".\electron-main.cjs"
    } else {
        npx electron ".\electron-main.cjs"
    }
}

Write-Host "Application closed." -ForegroundColor Gray
