# ==============================================================================
# ARN IPTV Pro -- In-Place Hot Patch Updater
# Development & Engineering: Abdo Ragab Nassar (ARN Technology 2026)
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "      ARN IPTV Pro -- Hot Patch Updater (In-Place)       " -ForegroundColor Green
Write-Host "     Company: ARN Technology -- Abdo Ragab Nassar         " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# Check Admin elevation
$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $IsAdmin) {
    Write-Host "[*] Requesting Administrator privileges to update Program Files..." -ForegroundColor Yellow
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Exit
}

$InstallDir = "C:\Program Files\ARN IPTV Pro"
$TargetResources = Join-Path $InstallDir "resources"
$SourceResources = "E:\ARN-IPTV\release\win-unpacked\resources"

if (-not (Test-Path $TargetResources)) {
    Write-Host "[-] Could not find installed ARN IPTV Pro at: $InstallDir" -ForegroundColor Red
    Write-Host "Press any key to exit..."
    [Console]::ReadKey() | Out-Null
    Exit 1
}

Write-Host "[1/3] Closing any running ARN IPTV Pro instances..." -ForegroundColor Cyan
Get-Process -Name "ARN IPTV Pro" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

Write-Host "[2/3] Updating app.asar and unpacked modules..." -ForegroundColor Cyan
Copy-Item -Path (Join-Path $SourceResources "app.asar") -Destination (Join-Path $TargetResources "app.asar") -Force

if (Test-Path (Join-Path $SourceResources "app.asar.unpacked")) {
    Copy-Item -Path (Join-Path $SourceResources "app.asar.unpacked") -Destination $TargetResources -Recurse -Force
}

Write-Host "[OK] Core application files updated successfully!" -ForegroundColor Green

Write-Host "[3/3] Launching updated ARN IPTV Pro..." -ForegroundColor Green
$InstalledExe = Join-Path $InstallDir "ARN IPTV Pro.exe"
if (Test-Path $InstalledExe) {
    Start-Process $InstalledExe
}

Write-Host "Update completed successfully! Enjoy ARN IPTV Pro." -ForegroundColor Green
Start-Sleep -Seconds 2
