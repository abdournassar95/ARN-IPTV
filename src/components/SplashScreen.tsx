import React, { useEffect, useState } from 'react';
import { ShieldCheck, Tv, ArrowLeft } from 'lucide-react';

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
          setStatusText('تحميل واجهة المشغل السينمائي WebAudio 200%...');
        } else {
          setStatusText('اكتمل التجهيز بنجاح — أهلاً بك في ARN IPTV Pro');
        }

        if (next >= 100) {
          clearInterval(timer);
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
      className={`fixed inset-0 z-99999 flex items-center justify-center p-4 bg-[#06080e]/95 backdrop-blur-2xl select-none transition-all duration-500 ${
        isClosing ? 'opacity-0 scale-102 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      dir="rtl"
    >
      {/* Subtle Studio Spotlight */}
      <div className="absolute w-[480px] h-[480px] rounded-full bg-white/[0.02] blur-[120px] pointer-events-none" />

      {/* Main Smoked Glass Card */}
      <div className="relative w-full max-w-xl bg-[#0d111a]/95 border border-white/[0.08] rounded-3xl p-7 sm:p-9 shadow-[0_32px_90px_rgba(0,0,0,0.9)] text-center overflow-hidden flex flex-col items-center">
        {/* Top Metadata Line (Unboxed) */}
        <div className="flex items-center justify-between w-full mb-5 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>نظام البث الآمن والمعتمد</span>
          </div>
          <span className="font-mono text-slate-400 tabular-nums" dir="ltr">
            v2.6.0 · Cinema Studio
          </span>
        </div>

        {/* Anodized App Icon Frame */}
        <div className="relative my-2">
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl p-1.5 bg-white/[0.04] border border-white/[0.1] shadow-[0_16px_40px_rgba(0,0,0,0.65)] flex items-center justify-center overflow-hidden">
            <img
              src="/assets/icons/app_icon.png"
              alt="ARN IPTV Pro Icon"
              className="w-full h-full object-contain rounded-xl"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
                const fb = (e.currentTarget.parentElement as HTMLElement)?.querySelector('.icon-fb');
                if (fb) (fb as HTMLElement).style.display = 'flex';
              }}
            />
            <div className="icon-fb hidden flex-col items-center justify-center text-white">
              <Tv className="w-10 h-10 mb-1" />
              <span className="text-xs font-bold font-mono">ARN</span>
            </div>
          </div>
        </div>

        {/* Title & Brand */}
        <div className="space-y-1 mt-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            ARN IPTV Pro
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            المنصة الاحترافية للبث الفضائي العربي الحي والراديو
          </p>
        </div>

        {/* Company & Developer Identity Card */}
        <div className="w-full mt-5 p-3.5 rounded-2xl bg-[#06080e]/90 border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-200">شركة ARN Technology</span>
            <span className="text-emerald-400">
              تطوير وبرمجة: عبده رجب نصار
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-white/[0.05]">
            <span>حقوق النشر © 2026 جميع الحقوق محفوظة</span>
            <span className="font-mono text-slate-300 tabular-nums" dir="ltr">
              +20 155 671 0314
            </span>
          </div>
        </div>

        {/* Precision Progress Track */}
        <div className="w-full mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium truncate flex-1 text-right">{statusText}</span>
            <span className="text-white font-semibold font-mono text-xs mr-2 tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>

          <div className="w-full h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Direct Developer Links */}
        <div className="w-full mt-4 pt-3 border-t border-white/[0.06]">
          <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
            <a
              href="https://wa.me/201556710314"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-400 transition-colors font-medium"
              title="تواصل واتساب"
            >
              واتساب
            </a>
            <span className="text-slate-700">·</span>
            <a
              href="https://t.me/ABDOURNASSAR95"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors font-medium"
              title="تواصل تليجرام"
            >
              تليجرام
            </a>
            <span className="text-slate-700">·</span>
            <a
              href="https://www.facebook.com/abdouragab.nassar"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors font-medium"
              title="تواصل فيسبوك"
            >
              فيسبوك
            </a>
          </div>
        </div>

        {/* Action Controls & Skip Button */}
        <div className="w-full mt-5 flex items-center justify-between gap-3 pt-3 border-t border-white/[0.06]">
          <label className="flex items-center gap-2 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={handleCheckboxToggle}
              className="rounded border-white/20 text-emerald-500 focus:ring-0 bg-black/40"
            />
            <span>عدم الإظهار تلقائياً عند بدء التشغيل</span>
          </label>

          <button
            type="button"
            onClick={handleDismiss}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-white text-slate-950 hover:bg-slate-200 font-bold text-xs transition-colors cursor-pointer"
          >
            <span>دخول فوري</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
