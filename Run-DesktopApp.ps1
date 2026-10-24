# =============================================================================
# ARN IPTV Desktop Pro — Official PowerShell Launcher (UTF-8 & UAC Ready)
# Copyright © 2026 عبده رجب نصار — شركة ARN Technology
# =============================================================================
param(
    [switch]$Elevate,
    [switch]$DevTools
)

$ErrorActionPreference = "Stop"
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding           = [System.Text.Encoding]::UTF8

Set-Location -LiteralPath $PSScriptRoot

# رفع الصلاحيات عبر UAC RunAs عند الطلب
if ($Elevate) {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Host "[UAC] جاري إعادة التشغيل بصلاحيات المسؤول..." -ForegroundColor Cyan
        $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
        if ($DevTools) { $argList += " -DevTools" }
        Start-Process powershell.exe -Verb RunAs -ArgumentList $argList
        exit 0
    }
}

Write-Host "🚀 جاري تشغيل ARN IPTV Desktop Pro — ARN Technology..." -ForegroundColor Green

$packagedExe = Join-Path $PSScriptRoot "dist\win-unpacked\ARN IPTV Pro.exe"
if (Test-Path $packagedExe) {
    Start-Process -FilePath $packagedExe
    exit 0
}

if (-not (Test-Path (Join-Path $PSScriptRoot "node_modules"))) {
    Write-Host "[NPM] جاري تثبيت الاعتماديات المحلية..." -ForegroundColor Yellow
    npm install
}

node scripts/sync-assets.js

if ($DevTools) {
    npm run dev
} else {
    npm start
}
