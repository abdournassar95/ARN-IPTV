import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Smartphone,
  Tv,
  Download,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Radio,
  Sliders,
  Layers,
  Sparkles,
  Wifi,
  BatteryCharging,
  Info,
  ExternalLink,
} from 'lucide-react';
import { ChannelItem, CategoryItem } from '../types/iptv';
import { HlsVideoPlayer } from './HlsVideoPlayer';

interface AndroidSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: ChannelItem[];
  categories: CategoryItem[];
}

export const AndroidSimulatorModal: React.FC<AndroidSimulatorModalProps> = ({
  isOpen,
  onClose,
  channels,
  categories,
}) => {
  const [deviceMode, setDeviceMode] = useState<'phone' | 'tv'>('tv');
  const [selectedChannel, setSelectedChannel] = useState<ChannelItem | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [activeSection, setActiveSection] = useState<'live' | 'radio' | 'favorites'>('live');
  const [isDeepBlack, setIsDeepBlack] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dpadFeedback, setDpadFeedback] = useState<string | null>(null);

  // Filter channels based on section and category
  const filteredChannels = channels.filter((ch) => {
    const isRadio = ch.section === 'radio' || ch.groupTitle?.includes('راديو') || ch.groupTitle?.includes('قرآن');
    if (activeSection === 'radio') {
      if (!isRadio) return false;
    } else {
      if (isRadio) return false;
    }
    if (selectedCategory !== 'all' && ch.categoryId !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      return ch.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  useEffect(() => {
    if (filteredChannels.length > 0 && !selectedChannel) {
      setSelectedChannel(filteredChannels[0]);
    }
    setFocusedIndex(0);
  }, [activeSection, selectedCategory, filteredChannels.length]);

  // Handle D-Pad Remote Navigation
  const triggerDpad = (direction: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back') => {
    setDpadFeedback(direction);
    setTimeout(() => setDpadFeedback(null), 250);

    if (direction === 'down') {
      setFocusedIndex((prev) => Math.min(filteredChannels.length - 1, prev + 1));
    } else if (direction === 'up') {
      setFocusedIndex((prev) => Math.max(0, prev - 1));
    } else if (direction === 'ok') {
      if (filteredChannels[focusedIndex]) {
        setSelectedChannel(filteredChannels[focusedIndex]);
      }
    } else if (direction === 'back') {
      // Unselect or go to first channel
      setFocusedIndex(0);
    }
  };

  // Keyboard navigation support when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        triggerDpad('down');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        triggerDpad('up');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        triggerDpad('ok');
      } else if (e.key === 'Escape') {
        triggerDpad('back');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, focusedIndex, filteredChannels]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-6xl bg-[#0d111a] border border-white/10 rounded-3xl shadow-[0_32px_90px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[95vh]">
        {/* Top Management Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-[#06080e] border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">محاكي تجربة أندرويد الحي (Android & Android TV Live Simulator)</h3>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                  Kotlin + Jetpack Compose
                </span>
              </div>
              <p className="text-xs text-slate-400">
                اختبر تجربة الهاتف وريموت التلفاز الذكي مباشرة هنا، وحمّل سورس كود أندرويد الأصلي المكتمل
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Device Mode Switcher */}
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setDeviceMode('phone')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  deviceMode === 'phone'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>هاتف أندرويد</span>
              </button>
              <button
                type="button"
                onClick={() => setDeviceMode('tv')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  deviceMode === 'tv'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>تلفاز Android TV</span>
              </button>
            </div>

            {/* Download Standalone Android Zip Package Button */}
            <a
              href="/api/android/download-zip"
              download="ARN-IPTV-Pro-Android-Kotlin-Project.zip"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow-sm"
              title="تنزيل مجلد كود أندرويد الكامل كملف ZIP للفتح في Android Studio"
            >
              <Download className="w-4 h-4" />
              <span>تحميل سورس أندرويد (.ZIP)</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Simulator Viewport Body */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto flex flex-col lg:flex-row items-center justify-center gap-6 bg-[#04060a]">
          {/* Main Simulated Device Frame */}
          <div
            className={`transition-all duration-300 relative shadow-[0_25px_60px_rgba(0,0,0,0.8)] border border-white/15 overflow-hidden flex flex-col ${
              deviceMode === 'phone'
                ? 'w-[360px] h-[680px] rounded-[42px] ring-8 ring-slate-800/80 bg-[#06080e]'
                : 'w-full max-w-3xl aspect-video rounded-2xl ring-4 ring-slate-700/60 bg-[#06080e]'
            }`}
          >
            {/* Phone Notch & Android Status Bar */}
            {deviceMode === 'phone' && (
              <div className="h-8 w-full bg-[#06080e] flex items-center justify-between px-6 text-[11px] text-slate-400 font-mono select-none z-10 shrink-0 border-b border-white/[0.04]">
                <span>12:45</span>
                {/* Punch-hole camera */}
                <div className="w-3.5 h-3.5 rounded-full bg-black border border-slate-700 mx-auto" />
                <div className="flex items-center gap-1.5">
                  <Wifi className="w-3 h-3 text-slate-300" />
                  <span className="text-[10px]">5G</span>
                  <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              </div>
            )}

            {/* Simulated Android TV Top Bar */}
            {deviceMode === 'tv' && (
              <div className="h-8 w-full bg-[#06080e] flex items-center justify-between px-5 text-[11px] text-slate-400 font-medium select-none z-10 shrink-0 border-b border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-white text-xs">Android TV — ARN IPTV Pro</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[10px]">
                  <span>4K 60FPS</span>
                  <span className="text-slate-600">·</span>
                  <span>D-Pad Active</span>
                  <span className="text-slate-600">·</span>
                  <span>10:30 PM</span>
                </div>
              </div>
            )}

            {/* Inner App Content */}
            <div className="flex-1 flex flex-col min-h-0 bg-[#06080e]">
              {/* Mini Player Area */}
              <div className="w-full aspect-video bg-black relative shrink-0">
                {selectedChannel ? (
                  <HlsVideoPlayer
                    channel={selectedChannel}
                    onSelectChannel={(ch) => setSelectedChannel(ch)}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                    <Tv className="w-8 h-8 mb-2 opacity-50" />
                    <span>اختر قناة لبدء البث</span>
                  </div>
                )}
              </div>

              {/* Android Channel List / Controls */}
              <div className="flex-1 flex flex-col min-h-0 p-3 space-y-2.5">
                {/* Android Native Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-white/[0.04] rounded-xl text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveSection('live')}
                    className={`flex-1 py-1 px-2 rounded-lg font-semibold text-center transition-colors cursor-pointer ${
                      activeSection === 'live' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    القنوات المباشرة
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection('radio')}
                    className={`flex-1 py-1 px-2 rounded-lg font-semibold text-center transition-colors cursor-pointer ${
                      activeSection === 'radio' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    الراديو العربي
                  </button>
                </div>

                {/* Channel List Rows */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                  {filteredChannels.map((ch, idx) => {
                    const isSelected = selectedChannel?.id === ch.id;
                    const isDpadFocused = deviceMode === 'tv' && focusedIndex === idx;

                    return (
                      <div
                        key={ch.id}
                        onClick={() => {
                          setSelectedChannel(ch);
                          setFocusedIndex(idx);
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                          isDpadFocused
                            ? 'bg-white/15 ring-2 ring-emerald-400 scale-[1.01] text-white shadow-md'
                            : isSelected
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-white'
                            : 'bg-white/[0.03] hover:bg-white/[0.06] text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isSelected ? 'bg-emerald-400' : 'bg-slate-600'
                            }`}
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-semibold block truncate">{ch.name}</span>
                            <span className="text-[10px] text-slate-400 block truncate">{ch.groupTitle}</span>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="text-[10px] font-mono text-emerald-400 font-bold shrink-0">
                            LIVE
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Android Phone Virtual Nav Bar */}
            {deviceMode === 'phone' && (
              <div className="h-6 w-full bg-[#06080e] flex items-center justify-center select-none shrink-0 border-t border-white/[0.04]">
                <div className="w-28 h-1 rounded-full bg-slate-600" />
              </div>
            )}
          </div>

          {/* Android TV D-Pad Remote Control & Instructions Panel */}
          {deviceMode === 'tv' && (
            <div className="w-full lg:w-72 bg-[#090d16] border border-white/[0.08] rounded-2xl p-5 flex flex-col items-center text-center space-y-5">
              <div>
                <span className="text-xs font-bold text-white block">ريموت كنترول التلفاز الذكي</span>
                <span className="text-[11px] text-slate-400">تحكم بالأسهم أو استخدم لوحة المفاتيح</span>
              </div>

              {/* D-Pad Remote Circle */}
              <div className="relative w-44 h-44 rounded-full bg-[#121826] border-2 border-white/10 shadow-inner flex items-center justify-center p-2">
                {/* Up */}
                <button
                  type="button"
                  onClick={() => triggerDpad('up')}
                  className={`absolute top-2 w-12 h-10 flex items-center justify-center rounded-t-xl text-slate-300 hover:text-white transition-colors cursor-pointer ${
                    dpadFeedback === 'up' ? 'bg-emerald-500/30 text-emerald-400' : ''
                  }`}
                  title="سهم لأعلى"
                >
                  <ChevronUp className="w-6 h-6" />
                </button>

                {/* Down */}
                <button
                  type="button"
                  onClick={() => triggerDpad('down')}
                  className={`absolute bottom-2 w-12 h-10 flex items-center justify-center rounded-b-xl text-slate-300 hover:text-white transition-colors cursor-pointer ${
                    dpadFeedback === 'down' ? 'bg-emerald-500/30 text-emerald-400' : ''
                  }`}
                  title="سهم لأسفل"
                >
                  <ChevronDown className="w-6 h-6" />
                </button>

                {/* Left */}
                <button
                  type="button"
                  onClick={() => triggerDpad('left')}
                  className={`absolute left-2 w-10 h-12 flex items-center justify-center rounded-l-xl text-slate-300 hover:text-white transition-colors cursor-pointer ${
                    dpadFeedback === 'left' ? 'bg-emerald-500/30 text-emerald-400' : ''
                  }`}
                  title="سهم يسار"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                {/* Right */}
                <button
                  type="button"
                  onClick={() => triggerDpad('right')}
                  className={`absolute right-2 w-10 h-12 flex items-center justify-center rounded-r-xl text-slate-300 hover:text-white transition-colors cursor-pointer ${
                    dpadFeedback === 'right' ? 'bg-emerald-500/30 text-emerald-400' : ''
                  }`}
                  title="سهم يمين"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>

                {/* Center OK Button */}
                <button
                  type="button"
                  onClick={() => triggerDpad('ok')}
                  className={`w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center ${
                    dpadFeedback === 'ok' ? 'scale-90 bg-emerald-300' : ''
                  }`}
                >
                  OK
                </button>
              </div>

              {/* Action Buttons: Back & Home */}
              <div className="flex items-center justify-center gap-3 w-full">
                <button
                  type="button"
                  onClick={() => triggerDpad('back')}
                  className="flex-1 py-2 px-3 rounded-xl bg-white/6 hover:bg-white/12 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  رجوع (Back)
                </button>
                <button
                  type="button"
                  onClick={() => setFocusedIndex(0)}
                  className="flex-1 py-2 px-3 rounded-xl bg-white/6 hover:bg-white/12 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  البداية (Home)
                </button>
              </div>

              {/* Quick Info Box */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-slate-400 text-right w-full space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <Info className="w-3.5 h-3.5" />
                  <span>معلومات البناء:</span>
                </div>
                <p>
                  الكود المصدري الأصلي موجود داخل <code className="text-white font-mono">/android</code> وجاهز للتصدير المباشر كحزمة ZIP لتشغيله في Android Studio وتوليد APK.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
