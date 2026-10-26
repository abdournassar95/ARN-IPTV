import React from 'react';
import { X, ShieldCheck, Cpu, Keyboard, Layers, Award } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-[#0d111a]/95 border border-white/[0.08] rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.85)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#06080e]/90 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl p-1 bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0">
              <img
                src="/assets/icons/app_icon.png"
                alt="ARN"
                className="w-full h-full object-contain rounded-lg"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">ARN IPTV Pro — Desktop & Web</h3>
              <p className="text-xs text-slate-400">
                المطور والمالك: <span className="text-emerald-400 font-semibold">عبده رجب نصار</span> · شركة ARN Technology © 2026
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs text-slate-300 leading-relaxed">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-[#070b14]/80 border border-white/8 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-white">
                <Cpu className="w-4 h-4 text-emerald-400" />
                محرك نقي بدون اعتماديات خارجية
              </div>
              <p className="text-slate-400">
                يعمل بالكامل عبر Node.js + hls.js مع تسريع عتادي GPU دون الحاجة لتثبيت VLC أو بيئة Python خارجية.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#070b14]/80 border border-white/8 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-white">
                <ShieldCheck className="w-4 h-4 text-sky-400" />
                فك تشفير AES-128-CBC وبروكسي محلي
              </div>
              <p className="text-slate-400">
                فك تشفير حزم دراما لايف v187، دعم حسابات Xtream Codes، وإزالة بادئات التشويش <code className="text-emerald-400">k9x_</code> تلقائياً عبر البروكسي المدمج.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#070b14]/80 border border-white/8 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-white">
                <Layers className="w-4 h-4 text-emerald-400" />
                تعدد السيرفرات والجودات و WebAudio 200%
              </div>
              <p className="text-slate-400">
                انتقال تلقائي للسيرفر الاحتياطي عند الأعطال (Auto-Failover)، اختيار دقة الفيديو، ومضاعفة الصوت حتى 200%.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#070b14]/80 border border-white/8 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-white">
                <Award className="w-4 h-4 text-sky-400" />
                التوقيع الرقمي المعتمد (RFC-3161)
              </div>
              <p className="text-slate-400">
                مجهز للتوقيع بشهادة ARN Technology مع خادم الوقت DigiCert SHA256 وسكريبت Inno Setup لتثبيت الشهادة تلقائياً.
              </p>
            </div>
          </div>

          {/* Android Native Edition Card */}
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">نسخة أندرويد الأصلية المكتملة (Native Android App)</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                  Kotlin + Compose + Media3
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                كود أندرويد أصلي متكامل ومبني في المجلد <code className="text-emerald-400 font-mono">/android</code> جاهز للفتح في Android Studio وبناء ملف الـ APK للهواتف وشاشات التلفاز Android TV.
              </p>
            </div>
          </div>

          {/* Keyboard Shortcuts Table */}
          <div className="p-4 rounded-xl bg-[#070b14] border border-white/8 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-white">
              <Keyboard className="w-4 h-4 text-emerald-400" />
              اختصارات لوحة المفاتيح وإيماءات الماوس
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="flex items-center justify-between bg-[#0f172a] px-3 py-1.5 rounded-lg">
                <span>تشغيل / إيقاف</span>
                <kbd className="font-mono text-emerald-400">Space</kbd>
              </div>
              <div className="flex items-center justify-between bg-[#0f172a] px-3 py-1.5 rounded-lg">
                <span>ملء الشاشة</span>
                <kbd className="font-mono text-emerald-400">F / نقر مزدوج</kbd>
              </div>
              <div className="flex items-center justify-between bg-[#0f172a] px-3 py-1.5 rounded-lg">
                <span>كتم الصوت</span>
                <kbd className="font-mono text-emerald-400">M</kbd>
              </div>
              <div className="flex items-center justify-between bg-[#0f172a] px-3 py-1.5 rounded-lg">
                <span>رفع/خفض الصوت 200%</span>
                <kbd className="font-mono text-sky-400">Wheel / ↑↓</kbd>
              </div>
              <div className="flex items-center justify-between bg-[#0f172a] px-3 py-1.5 rounded-lg">
                <span>تقديم / تأخير 10ث</span>
                <kbd className="font-mono text-emerald-400">← / →</kbd>
              </div>
              <div className="flex items-center justify-between bg-[#0f172a] px-3 py-1.5 rounded-lg">
                <span>تبديل السيرفر</span>
                <kbd className="font-mono text-emerald-400">قائمة السيرفر</kbd>
              </div>
            </div>
          </div>

          {/* Social Media & Direct Contact Section */}
          <div className="p-4 rounded-xl bg-[#070b14] border border-white/8 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-xs">قنوات التواصل المباشر مع المطور:</span>
              <span className="text-[#10b981] font-semibold text-xs font-mono">ARN Technology</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <a
                href="https://wa.me/201556710314"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-[25px] border border-emerald-500/30 bg-transparent hover:bg-[#1e293b] text-emerald-400 hover:text-white transition-all text-xs font-medium shadow-sm hover:shadow-emerald-500/10 hover:border-emerald-500"
                title="تواصل عبر واتساب"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.07-2.158-.535-1.748-.722-2.873-2.484-2.96-2.6-.086-.115-.708-.942-.708-1.798 0-.855.449-1.277.61-1.45.161-.173.351-.216.468-.216.117 0 .234.002.336.007.108.005.252-.041.394.3.144.347.491 1.2.534 1.288.043.088.072.19.014.305-.058.115-.087.187-.173.289l-.26.309c-.087.086-.177.18-.076.353.101.174.45 1.015 1.157 1.644.912.812 1.681 1.063 1.918 1.18.237.118.376.101.517-.061.14-.163.606-.707.768-.949.162-.243.324-.202.544-.121.22.081 1.395.658 1.636.779.24.12.4.18.46.283.059.104.059.605-.085 1.01z" />
                </svg>
                <span>WhatsApp</span>
              </a>

              <a
                href="https://t.me/ABDOURNASSAR95"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-[25px] border border-sky-500/30 bg-transparent hover:bg-[#1e293b] text-sky-400 hover:text-white transition-all text-xs font-medium shadow-sm hover:shadow-sky-500/10 hover:border-sky-500"
                title="تواصل عبر تليجرام"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                </svg>
                <span>Telegram</span>
              </a>

              <a
                href="https://www.facebook.com/abdouragab.nassar"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-[25px] border border-blue-500/30 bg-transparent hover:bg-[#1e293b] text-blue-400 hover:text-white transition-all text-xs font-medium shadow-sm hover:shadow-blue-500/10 hover:border-blue-500"
                title="تواصل عبر فيسبوك"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                <span>Facebook</span>
              </a>

              <a
                href="https://m.me/abdouragab.nassar"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-[25px] border border-indigo-500/30 bg-transparent hover:bg-[#1e293b] text-indigo-400 hover:text-white transition-all text-xs font-medium shadow-sm hover:shadow-indigo-500/10 hover:border-indigo-500"
                title="تواصل عبر ماسنجر"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.908 1.455 5.503 3.734 7.172V22l3.411-1.872c.904.25 1.864.385 2.855.385 5.523 0 10-4.145 10-9.255C22 6.145 17.523 2 12 2zm1.047 12.445l-2.68-2.859-5.234 2.859 5.758-6.11 2.747 2.859 5.166-2.859-5.757 6.11z" />
                </svg>
                <span>Messenger</span>
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between pt-2 border-t border-white/8 gap-2 text-[11px] text-slate-400">
            <div>
              <span>حقوق النشر (c) 2026 لشركة ARN Technology. جميع الحقوق محفوظة.</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#10b981] font-semibold">تطوير وبرمجة: عبده رجب نصار</span>
              <span className="font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">v2.6.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
