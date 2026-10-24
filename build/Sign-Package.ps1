# =============================================================================
# ARN IPTV Desktop Pro — RFC-3161 SHA-256 Digital Code Signing Script
# Copyright © 2026 عبده رجب نصار — شركة ARN Technology
# =============================================================================
param(
    [string]$TargetExe = "$PSScriptRoot\..\dist\ARN-IPTV-Setup-v2.0.0.exe",
    [string]$SubjectFilter = "ARN Technology",
    [string]$TimestampServer = "http://timestamp.digicert.com",
    [switch]$CreateCertificateIfMissing
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$certDir = Join-Path $PSScriptRoot "cert"
if (-not (Test-Path $certDir)) {
    New-Item -ItemType Directory -Path $certDir | Out-Null
}

$cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert |
    Where-Object { $_.Subject -like "*$SubjectFilter*" } |
    Sort-Object NotAfter -Descending |
    Select-Object -First 1

if (-not $cert -and $CreateCertificateIfMissing) {
    Write-Host "[CERT] جاري إنشاء شهادة توقيع رقمي لشركة ARN Technology..." -ForegroundColor Cyan
    $cert = New-SelfSignedCertificate `
        -Type CodeSigningCert `
        -Subject "CN=ARN Technology, O=ARN Technology, C=EG" `
        -KeyAlgorithm RSA `
        -KeyLength 2048 `
        -HashAlgorithm "SHA256" `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -NotAfter (Get-Date).AddYears(5)

    $cerPath = Join-Path $certDir "ARN_Technology_Root.cer"
    Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null
    Write-Host "[CERT] تم تصدير الشهادة العامة إلى: $cerPath" -ForegroundColor Green
}

if (-not $cert) {
    throw "لم يتم العثور على شهادة توقيع رقمي باسم '$SubjectFilter' في Cert:\CurrentUser\My. استخدم الخيار -CreateCertificateIfMissing لإنشائها."
}

if (-not (Test-Path $TargetExe)) {
    throw "الملف التنفيذي المطلوب توقيعه غير موجود: $TargetExe"
}

Write-Host "[SIGN] جاري توقيع الملف بشهادة $($cert.Subject) مع خادم الطابع الزمني DigiCert..." -ForegroundColor Yellow
$signResult = Set-AuthenticodeSignature `
    -FilePath $TargetExe `
    -Certificate $cert `
    -HashAlgorithm SHA256 `
    -TimestampServer $TimestampServer

if ($signResult.Status -ne "Valid" -and $signResult.Status -ne "UnknownError") {
    Write-Warning "حالة التوقيع: $($signResult.Status) — $($signResult.StatusMessage)"
} else {
    Write-Host "✅ اكتمل التوقيع الرقمي بنجاح (SHA256 + RFC-3161 Timestamp)!" -ForegroundColor Green
}
