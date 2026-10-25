import React, { useEffect, useState } from 'react';
import { Play, Sparkles, CheckCircle2, ShieldCheck, Tv, ArrowLeft, Radio } from 'lucide-react';

interface SplashScreenProps {
  isOpen: boolean;
  onClose: () => void;
  autoCloseDelayMs?: number;
}

const SPLASH_STORAGE_KEY = 'arn_iptv_show_splash_startup';

export const SplashScreen: React.FC<SplashScreenProps> = ({
  isOpen,
  onClose,
  autoCloseDelayMs = 2800,
}) => {
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('جارِ تهيئة النظام ومحرك البث...');
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SPLASH_STORAGE_KEY) === 'false';
    } catch {
      return false;
    }
  });
  const [isClosing, setIsClosing] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setIsClosing(false);
      return;
    }

    setIsClosing(false);
    setProgress(5);
    setStatusText('جارِ تشغيل محرك البث والبروكسي المحلي...');

    const interval = 40;
    const stepIncrement = 100 / (autoCloseDelayMs / interval);

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(100, prev + stepIncrement);

        if (next < 30) {
          setStatusText('جارِ فك التشفير وتأمين تدفق HLS...');
        } else if (next < 65) {
          setStatusText('مزامنة الباقات الفضائية وقنوات مصر وإذاعات الراديو...');
        } else if (next < 95) {
          setStatusText('تحميل واجهة المشغل فائق الجودة WebAudio 200%...');
        } else {
          setStatusText('اكتمل التجهيز بنجاح — أهلاً بك في ARN IPTV Pro!');
        }

        if (next >= 100) {
          clearInterval(timer);
          // Wait slightly then smoothly dismiss
          setTimeout(() => {
            handleDismiss();
          }, 450);
        }
        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isOpen, autoCloseDelayMs]);

  const handleDismiss = () => {
    setIsClosing(true);
    setTimeout(() => {
      try {
        localStorage.setItem(SPLASH_STORAGE_KEY, dontShowAgain ? 'false' : 'true');
      } catch {}
      onClose();
    }, 450);
  };

  const handleCheckboxToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setDontShowAgain(val);
    try {
      localStorage.setItem(SPLASH_STORAGE_KEY, val ? 'false' : 'true');
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-99999 flex items-center justify-center p-4 bg-[#050811]/92 backdrop-blur-md select-none transition-all duration-500 ${
        isClosing ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      dir="rtl"
    >
      {/* Ambient background glowing light orbs */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-emerald-500/15 blur-[90px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-cyan-500/15 blur-[100px] pointer-events-none" />

      {/* Main Glassmorphism Card */}
      <div className="relative w-full max-w-xl bg-linear-to-b from-[#0f172a]/95 via-[#0c1222]/95 to-[#080d19]/95 border border-white/15 rounded-3xl p-7 sm:p-9 shadow-[0_20px_60px_rgba(0,0,0,0.8)] text-center overflow-hidden flex flex-col items-center">
        {/* Subtle decorative top lighting beam */}
        <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-transparent via-cyan-400 to-transparent opacity-80" />

        {/* Top Badges */}
        <div className="flex items-center justify-between w-full mb-4">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>نظام البث الآمن والمعتمد</span>
          </div>
          <span className="text-[11px] font-mono text-cyan-300 font-bold bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full">
            v2.6.0 Pro
          </span>
        </div>

        {/* 3D App Icon Display with Neon Glow Ring */}
        <div className="relative group my-2">
          {/* Pulsing ring around the icon */}
          <div className="absolute -inset-2 rounded-3xl bg-linear-to-tr from-cyan-400/30 to-emerald-400/30 blur-xl opacity-75 group-hover:opacity-100 transition duration-500 animate-pulse" />

          <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl p-1 bg-linear-to-tr from-cyan-500/40 via-white/15 to-emerald-500/40 border-2 border-cyan-400/50 shadow-[0_0_40px_rgba(56,189,248,0.3)] flex items-center justify-center overflow-hidden">
            <img
              src="/assets/icons/app_icon.png"
              alt="ARN IPTV Pro Icon"
              className="w-full h-full object-contain rounded-2xl transform transition-transform duration-300 hover:scale-105"
              onError={(e) => {
                // Fallback in case image takes a moment
                (e.currentTarget as HTMLElement).style.display = 'none';
                const fb = (e.currentTarget.parentElement as HTMLElement)?.querySelector('.icon-fb');
                if (fb) (fb as HTMLElement).style.display = 'flex';
              }}
            />
            <div className="icon-fb hidden flex-col items-center justify-center text-cyan-400">
              <Tv className="w-12 h-12 mb-1" />
              <span className="text-sm font-black font-mono">ARN</span>
            </div>
          </div>
        </div>

        {/* Title & Brand */}
        <div className="space-y-1.5 mt-3">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-linear-to-r from-white via-cyan-200 to-emerald-300">
            ARN IPTV Pro
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-300 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>المنصة الذكية للبث الفضائي العربي الحي</span>
          </p>
        </div>

        {/* Company & Developer Identity Card */}
        <div className="w-full mt-4 p-3.5 rounded-2xl bg-[#070b14]/80 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-200">شركة ARN Technology</span>
            <span className="text-[#10b981] flex items-center gap-1">
              <span>تطوير وبرمجة: عبده رجب نصار</span>
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/5">
            <span>حقوق النشر © 2026 جميع الحقوق محفوظة</span>
            <span className="font-mono text-emerald-300" dir="ltr">
              +20 155 671 0314
            </span>
          </div>
        </div>

        {/* Progress Bar & Real-time Status */}
        <div className="w-full mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium truncate flex-1 text-right">{statusText}</span>
            <span className="text-cyan-400 font-bold font-mono text-xs mr-2">{Math.round(progress)}%</span>
          </div>

          {/* Animated Gradient Progress Track */}
          <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/10">
            <div
              className="h-full rounded-full bg-linear-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-100 shadow-[0_0_12px_rgba(56,189,248,0.5)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Social Contacts Quick Pills (ARN Standard: rounded-25px, hover #1e293b) */}
        <div className="w-full mt-4 pt-3 border-t border-white/10">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <a
              href="https://wa.me/201556710314"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[25px] border border-emerald-500/30 bg-transparent hover:bg-[#1e293b] text-emerald-400 hover:text-white transition-all text-xs font-medium"
              title="تواصل واتساب"
            >
              <span>واتساب</span>
            </a>
            <a
              href="https://t.me/ABDOURNASSAR95"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[25px] border border-sky-500/30 bg-transparent hover:bg-[#1e293b] text-sky-400 hover:text-white transition-all text-xs font-medium"
              title="تواصل تليجرام"
            >
              <span>تليجرام</span>
            </a>
            <a
              href="https://www.facebook.com/abdouragab.nassar"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[25px] border border-blue-500/30 bg-transparent hover:bg-[#1e293b] text-blue-400 hover:text-white transition-all text-xs font-medium"
              title="تواصل فيسبوك"
            >
              <span>فيسبوك</span>
            </a>
          </div>
        </div>

        {/* Action Controls & Skip Button */}
        <div className="w-full mt-5 flex items-center justify-between gap-3 pt-3 border-t border-white/10">
          {/* Checkbox: Don't show again */}
          <label className="flex items-center gap-2 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={handleCheckboxToggle}
              className="rounded border-white/20 text-emerald-500 focus:ring-0 bg-black/40"
            />
            <span>عدم الإظهار تلقائياً عند بدء التشغيل</span>
          </label>

          {/* Quick Enter App Button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/25 hover:scale-102 cursor-pointer"
          >
            <span>دخول فوري</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
