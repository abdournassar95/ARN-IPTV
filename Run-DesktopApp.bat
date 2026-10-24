@echo off
chcp 65001 >nul
title ARN IPTV Pro — ARN Technology Launcher
cd /d "%~dp0"

echo ============================================================
echo   ARN IPTV Desktop Pro v2.0 — شركة ARN Technology (2026)
echo   المطور والمالك: م. عبده رجب نصار
echo ============================================================
echo.

:: إذا كانت النسخة المجمعة موجودة شغّلها مباشرة بدون الحاجة لـ Node.js
if exist "dist\win-unpacked\ARN IPTV Pro.exe" (
    echo [INFO] جاري تشغيل النسخة المكتبية المجمعة...
    start "" "dist\win-unpacked\ARN IPTV Pro.exe"
    exit /b 0
)

:: التحقق من تثبيت حزم التطوير عند التشغيل المصدري
if not exist "node_modules\electron" (
    echo [SETUP] جاري تثبيت حزم المشروع لأول مرة...
    call npm install
    if errorlevel 1 (
        echo [ERROR] تعذر تثبيت الحزم. تأكد من تثبيت Node.js على جهازك.
        pause
        exit /b 1
    )
)

echo [START] جاري إقلاع تطبيق ARN IPTV Pro عبر PowerShell...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Run-DesktopApp.ps1"
if errorlevel 1 (
    pause
)
