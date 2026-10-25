@echo off
chcp 65001 >nul
title ARN IPTV Pro - In-Place Hot Patch Updater
cd /d "%~dp0"
PowerShell -NoProfile -ExecutionPolicy Bypass -File ".\Update-InstalledApp.ps1"
if %errorlevel% neq 0 (
    echo.
    echo Updater encountered an issue. Press any key to exit...
    pause >nul
)
