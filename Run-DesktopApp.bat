@echo off
chcp 65001 >nul
title ARN IPTV Pro - Desktop Edition
cd /d "%~dp0"
PowerShell -NoProfile -ExecutionPolicy Bypass -File ".\Run-DesktopApp.ps1"
if %errorlevel% neq 0 (
    echo.
    echo Application exited. Press any key to close this window...
    pause >nul
)
