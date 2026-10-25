import React, { useEffect, useState } from 'react';
import { X, Download, Copy, Check, Terminal, FileCode2, ShieldCheck, Cpu } from 'lucide-react';
import { ElectronExportFile } from '../types/iptv';

interface ElectronExporterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ElectronExporterModal: React.FC<ElectronExporterModalProps> = ({ isOpen, onClose }) => {
  const [files, setFiles] = useState<ElectronExportFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('src/main/main.js');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [proxyPingStatus, setProxyPingStatus] = useState<string>('جاري الفحص...');

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/electron/files')
      .then((r) => r.json())
      .then((data) => {
        if (data.files?.length) {
          setFiles(data.files);
        }
      })
      .catch(() => {});

    fetch('/api/ping')
      .then((r) => r.json())
      .then((data) => {
        if (data.status === 'pong') {
          setProxyPingStatus(`نشط (${data.engine})`);
        }
      })
      .catch(() => setProxyPingStatus('غير متصل'));
  }, [isOpen]);

  if (!isOpen) return null;

  const currentFile = files.find((f) => f.path === selectedPath) || files[0];

  const handleCopyContent = (file: ElectronExportFile) => {
    navigator.clipboard.writeText(file.content);
    setCopiedPath(file.path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const handleDownloadSingleFile = (file: ElectronExportFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.path.split('/').pop() || 'file.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadFullProjectScript = () => {
    // Generates a single PowerShell scaffolder script that creates the entire ARN-IPTV-Electron directory tree and files automatically
    const psLines: string[] = [
      '# ============================================================================',
      '# ARN IPTV Desktop (Electron Edition) — Automated Project Scaffolder',
      '# Developer & Owner: Abdo Ragab Nassar — ARN Technology © 2026',
      '# Usage: Right-click -> Run with PowerShell (or powershell -ExecutionPolicy Bypass -File Build-ARN-Electron.ps1)',
      '# ============================================================================',
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
      '$TargetRoot = Join-Path $PSScriptRoot "ARN-IPTV-Electron"',
      'New-Item -ItemType Directory -Force -Path $TargetRoot | Out-Null',
      'New-Item -ItemType Directory -Force -Path (Join-Path $TargetRoot "src/main") | Out-Null',
      'New-Item -ItemType Directory -Force -Path (Join-Path $TargetRoot "src/preload") | Out-Null',
      'New-Item -ItemType Directory -Force -Path (Join-Path $TargetRoot "src/renderer/css") | Out-Null',
      'New-Item -ItemType Directory -Force -Path (Join-Path $TargetRoot "src/renderer/js") | Out-Null',
      'New-Item -ItemType Directory -Force -Path (Join-Path $TargetRoot "build") | Out-Null',
      '',
    ];

    for (const f of files) {
      const safeHereString = f.content;
      psLines.push(`$FilePath = Join-Path $TargetRoot "${f.path}"`);
      psLines.push(`$FileContent = @'\n${safeHereString}\n'@`);
      psLines.push(`[System.IO.File]::WriteAllText($FilePath, $FileContent, [System.Text.Encoding]::UTF8)`);
      psLines.push(`Write-Host "[+] Created: ${f.path}" -ForegroundColor Green`);
      psLines.push('');
    }

    psLines.push('Write-Host "=====================================================" -ForegroundColor Cyan');
    psLines.push('Write-Host "ARN IPTV Electron Project generated successfully!" -ForegroundColor Green');
    psLines.push('Write-Host "Run: cd ARN-IPTV-Electron && npm install && npm start" -ForegroundColor Yellow');

    const blob = new Blob([psLines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Generate-ARN-IPTV-Electron.ps1';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-5xl bg-[#0f172a] border border-white/12 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[86vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#070b14] border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                مركز تصدير حزمة سطح المكتب — ARN IPTV Desktop (Electron.js + Inno Setup)
              </h3>
              <p className="text-xs text-slate-400">
                حالة محرك البروكسي المحلي: <span className="text-emerald-400 font-mono">{proxyPingStatus}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadFullProjectScript}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors whitespace-nowrap"
            >
              <Terminal className="w-4 h-4" />
              تحميل مولد المشروع الكامل (PowerShell Builder)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Split Content */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* File Sidebar */}
          <aside className="w-72 bg-[#070b14]/90 border-l border-white/8 p-3 overflow-y-auto space-y-1.5 shrink-0">
            <div className="px-2 py-1.5 text-[11px] font-bold text-slate-400">
              ملفات المشروع القياسية ({files.length})
            </div>
            {files.map((file) => {
              const active = currentFile?.path === file.path;
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedPath(file.path)}
                  className={`w-full text-right p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                    active
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                      : 'bg-transparent border-transparent text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <FileCode2 className={`w-4 h-4 mt-0.5 shrink-0 ${active ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-mono font-bold truncate" dir="ltr">
                      {file.path}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{file.title.split('—')[1] || file.title}</div>
                  </div>
                </button>
              );
            })}

            {/* ARN Signing Standards Notice */}
            <div className="mt-4 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                <ShieldCheck className="w-4 h-4" />
                معايير ARN Technology
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                جميع ملفات التشغيل مجهزة بترميز <code className="text-emerald-400">chcp 65001</code> وتوقيع رقمي بشهادة <code className="text-emerald-400">ARN Technology</code> مع خادم الطابع الزمني <code className="text-sky-300">timestamp.digicert.com</code>.
              </p>
            </div>
          </aside>

          {/* Code Viewer */}
          {currentFile && (
            <div className="flex-1 flex flex-col min-w-0 bg-[#0b1120]">
              <div className="flex items-center justify-between px-5 py-3 bg-[#0f172a] border-b border-white/8">
                <div>
                  <h4 className="text-xs font-bold text-white">{currentFile.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{currentFile.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyContent(currentFile)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-xs font-semibold text-slate-200 transition-colors"
                  >
                    {copiedPath === currentFile.path ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        تم النسخ
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        نسخ الكود
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadSingleFile(currentFile)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-xs font-semibold text-sky-300 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    تنزيل الملف
                  </button>
                </div>
              </div>

              <pre
                dir="ltr"
                className="flex-1 p-5 overflow-auto text-xs font-mono text-slate-200 leading-relaxed selection:bg-emerald-500/30"
              >
                <code>{currentFile.content}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
