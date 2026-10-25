import React, { useState } from 'react';
import {
  X,
  KeyRound,
  Link2,
  FileUp,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Trash2,
  Lock,
  Server,
  UserCheck,
  Calendar,
  Layers,
  Download,
  Upload,
  Moon,
} from 'lucide-react';
import { CategoryItem, ChannelItem, PlaylistSource } from '../types/iptv';

interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlists: PlaylistSource[];
  activePlaylistId: string;
  onSelectPlaylist: (id: string) => void;
  onDeletePlaylist: (id: string) => void;
  onImportSuccess: (
    playlist: PlaylistSource,
    categories: CategoryItem[],
    channels: ChannelItem[]
  ) => void;
  isDeepBlackMode?: boolean;
  onToggleDeepBlackMode?: () => void;
}

const SAMPLE_M3U_CONTENT = `#EXTM3U
#EXTINF:-1 group-title="القنوات الإخبارية",الجزيرة الإخبارية FHD
https://live-hls-apps-aja-fa.getaj.net/AJA/01.m3u8
#EXTINF:-1 group-title="القنوات الإخبارية",العربية FHD
https://live.alarabiya.net/alarabiapublish/alarabiya.smil/playlist.m3u8
#EXTINF:-1 group-title="القنوات الإخبارية",سكاي نيوز عربية FHD
https://live-stream.skynewsarabia.com/c-horizontal-channel/horizontal-stream/index.m3u8
#EXTINF:-1 group-title="القنوات الرياضية",الكويت الرياضية KTV Sport FHD
https://kwtspta.cdn.mangomolo.com/sp/smil:sp.stream.smil/chunklist.m3u8
#EXTINF:-1 group-title="قنوات الترفيه والأفلام",إم بي سي 1 — MBC 1 FHD
https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-1-na/eec141533c90dd34722c503a296dd0d8/index.m3u8
#EXTINF:-1 group-title="قنوات الترفيه والأفلام",شاهد أفلام — Shahid Aflam FHD
https://shd-amg-fast.edgenextcdn.net/tx001/playlist.m3u8`;

export const PlaylistModal: React.FC<PlaylistModalProps> = ({
  isOpen,
  onClose,
  playlists,
  activePlaylistId,
  onSelectPlaylist,
  onDeletePlaylist,
  onImportSuccess,
  isDeepBlackMode = false,
  onToggleDeepBlackMode,
}) => {
  const [activeTab, setActiveTab] = useState<'fg' | 'xtream' | 'm3u' | 'crypto'>('fg');
  const [fgCode, setFgCode] = useState<string>('202122');
  const [m3uName, setM3uName] = useState<string>('قائمتي المخصصة M3U');
  const [m3uUrl, setM3uUrl] = useState<string>('');
  const [m3uRawText, setM3uRawText] = useState<string>('');

  // Xtream Codes State
  const [xtreamHost, setXtreamHost] = useState<string>('');
  const [xtreamUsername, setXtreamUsername] = useState<string>('');
  const [xtreamPassword, setXtreamPassword] = useState<string>('');
  const [xtreamPlaylistName, setXtreamPlaylistName] = useState<string>('اشتراك Xtream Codes');
  const [xtreamIncludeVod, setXtreamIncludeVod] = useState<boolean>(true);
  const [xtreamIncludeSeries, setXtreamIncludeSeries] = useState<boolean>(true);
  const [xtreamAccountInfo, setXtreamAccountInfo] = useState<{
    username: string;
    status: string;
    expDate: string;
    maxConnections: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Crypto Test State
  const [cryptoCode, setCryptoCode] = useState<string>('202122');
  const [cryptoResult, setCryptoResult] = useState<{
    encrypted: string;
    decryptedBack: unknown;
  } | null>(null);

  const handleTestXtreamAccount = async () => {
    if (!xtreamHost.trim() || !xtreamUsername.trim() || !xtreamPassword.trim()) {
      setErrorMsg('يرجى ملء كافة حقول السيرفر واسم المستخدم وكلمة المرور.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    setStatusMessage('جاري الاتصال بسيرفر Xtream والتحقق من صلاحية الحساب...');

    try {
      const resp = await fetch('/api/xtream/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: xtreamHost.trim(),
          username: xtreamUsername.trim(),
          password: xtreamPassword.trim(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'فشلت المصادقة مع سيرفر Xtream');
      }
      setXtreamAccountInfo(data.userInfo);
      setStatusMessage(`الحساب صالح ونشط! ينتهي في: ${data.userInfo.expDate} · الحد الأقصى للأجهزة: ${data.userInfo.maxConnections}`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'حدث خطأ أثناء فحص الحساب');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncXtream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!xtreamHost.trim() || !xtreamUsername.trim() || !xtreamPassword.trim()) {
      setErrorMsg('يرجى إدخال عنوان السيرفر واسم المستخدم وكلمة المرور.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    setStatusMessage('جاري جلب القنوات المباشرة، الأفلام VOD، والمسلسلات من Xtream...');

    try {
      const resp = await fetch('/api/xtream/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: xtreamHost.trim(),
          username: xtreamUsername.trim(),
          password: xtreamPassword.trim(),
          playlistName: xtreamPlaylistName.trim() || `Xtream (${xtreamUsername.trim()})`,
          includeVod: xtreamIncludeVod,
          includeSeries: xtreamIncludeSeries,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'تعذر استيراد ومزامنة حساب Xtream');
      }
      if (data.accountInfo) {
        setXtreamAccountInfo(data.accountInfo);
      }
      setStatusMessage(`تم بنجاح استيراد ${data.channels.length} قناة ومحتوى من سيرفر Xtream!`);
      onImportSuccess(data.playlist, data.categories, data.channels);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'فشل استيراد قائمة Xtream');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleActivateFgCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fgCode.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);
    setStatusMessage('جاري تشفير الطلب بـ AES-128-CBC والاتصال بمحرك دراما لايف...');

    try {
      const resp = await fetch('/api/fg/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: fgCode.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'فشل تفعيل الكود');
      }
      setStatusMessage(`تم تفعيل الكود ${fgCode} واستيراد ${data.channels.length} قناة حية بنجاح!`);
      onImportSuccess(data.playlist, data.categories, data.channels);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'حدث خطأ أثناء تفعيل الكود');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportM3u = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!m3uUrl.trim() && !m3uRawText.trim()) {
      setErrorMsg('يرجى إدخال رابط M3U8 أو لصق محتوى ملف #EXTM3U.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setStatusMessage('جاري تحليل قائمة M3U واستخراج الفئات والقنوات...');

    try {
      const resp = await fetch('/api/m3u/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: m3uName.trim() || 'قائمة M3U مضافة',
          url: m3uUrl.trim() || undefined,
          content: m3uRawText.trim() || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'تعذر تحليل قائمة M3U');
      }
      setStatusMessage(`تم استيراد ${data.channels.length} قناة في ${data.categories.length} تصنيف!`);
      onImportSuccess(data.playlist, data.categories, data.channels);
      setM3uRawText('');
      setM3uUrl('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'فشل استيراد ملف M3U');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('⚠️ حجم الملف كبير جداً (الحد الأقصى 15 ميجابايت).');
      return;
    }

    setM3uName(file.name.replace(/\.(m3u8?|txt)$/i, ''));
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const text = reader.result.trim();
        if (!text.includes('#EXTM3U')) {
          setErrorMsg('⚠️ تنبيه: الملف المحدد لا يحتوي على ترويسة #EXTM3U القياسية لقوائم البث.');
        } else {
          setErrorMsg(null);
        }
        setM3uRawText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const handleRunCryptoTest = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/fg/crypto-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cryptoCode }),
      });
      const data = await resp.json();
      if (data.success) {
        setCryptoResult({
          encrypted: data.encrypted,
          decryptedBack: data.decryptedBack,
        });
      }
    } catch {
      setErrorMsg('تعذر اختبار محرك التشفير');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportBackupJson = () => {
    try {
      const backupPayload = {
        app: 'ARN IPTV Pro',
        version: '2.6.0',
        exportedAt: new Date().toISOString(),
        playlists,
        favorites: JSON.parse(localStorage.getItem('arn_iptv_clean_v5_favorites') || '[]'),
        history: JSON.parse(localStorage.getItem('arn_iptv_clean_v5_history') || '[]'),
      };
      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ARN_IPTV_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage('تم تصدير النسخة الاحتياطية للقوائم والمفضلة بنجاح.');
    } catch {
      setErrorMsg('تعذر تصدير النسخة الاحتياطية.');
    }
  };

  const handleImportBackupJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (Array.isArray(parsed.favorites)) {
          localStorage.setItem('arn_iptv_clean_v5_favorites', JSON.stringify(parsed.favorites));
        }
        if (Array.isArray(parsed.history)) {
          localStorage.setItem('arn_iptv_clean_v5_history', JSON.stringify(parsed.history));
        }
        setStatusMessage('تم استعادة بيانات النسخة الاحتياطية بنجاح!');
      } catch {
        setErrorMsg('ملف النسخة الاحتياطية غير صالح.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-3xl bg-[#0d111a]/95 border border-white/[0.08] rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#06080e]/90 border-b border-white/[0.06]">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">إدارة قوائم التشغيل وأكواد التفعيل</h3>
            <p className="text-xs text-slate-400">
              تفعيل أكواد دراما لايف (FG Code) أو مزامنة Xtream Codes وملفات M3U / M3U8
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* App Display Settings Card: Deep Black Mode (OLED) Toggle */}
          {onToggleDeepBlackMode && (
            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-[#070b14]/90 border border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                    isDeepBlackMode
                      ? 'bg-black text-emerald-400 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                      : 'bg-[#0f172a] text-slate-400 border-white/10'
                  }`}
                >
                  <Moon className={`w-4 h-4 ${isDeepBlackMode ? 'fill-current' : ''}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      الوضع الليلي الحقيقي (Deep Black Mode)
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">OLED #000000</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    إطفاء البكسلات السوداء بالكامل لتقليل استهلاك الطاقة على شاشات OLED وتحسين راحة العين
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={isDeepBlackMode}
                onClick={onToggleDeepBlackMode}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isDeepBlackMode ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
                title="تفعيل أو إيقاف الوضع الليلي الحقيقي (Deep Black Mode)"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    isDeepBlackMode ? '-translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Active Playlists List */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <h4 className="text-xs font-bold text-slate-300">القوائم المحفوظة حالياً ({playlists.length})</h4>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExportBackupJson}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/6 hover:bg-white/12 border border-white/10 text-[11px] font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="تصدير نسخة احتياطية للقوائم والمفضلة (JSON)"
                >
                  <Download className="w-3 h-3 text-emerald-400" />
                  <span>نسخة احتياطية</span>
                </button>
                <label
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/6 hover:bg-white/12 border border-white/10 text-[11px] font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="استيراد ملف نسخة احتياطية (JSON)"
                >
                  <Upload className="w-3 h-3 text-sky-400" />
                  <span>استعادة</span>
                  <input type="file" accept=".json" onChange={handleImportBackupJson} className="hidden" />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {playlists.map((pl) => {
                const isSelected = pl.id === activePlaylistId;
                return (
                  <div
                    key={pl.id}
                    onClick={() => onSelectPlaylist(pl.id)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white/[0.08] border-white/[0.16] text-white shadow-xs'
                        : 'bg-[#06080e]/70 border-white/[0.06] text-slate-300 hover:bg-white/[0.04] hover:border-white/[0.12]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold truncate">{pl.name}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-400 mt-1 tabular-nums">
                        <span className="text-emerald-400 font-semibold font-mono">
                          {pl.channelCount} قناة
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-300 font-mono uppercase text-[10px]" dir="ltr">
                          {pl.type}
                        </span>
                        {pl.updatedAt && (
                          <>
                            <span className="text-slate-600">·</span>
                            <span className="text-slate-500 font-mono text-[10px]" dir="ltr">
                              {pl.updatedAt}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {pl.type !== 'builtin' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePlaylist(pl.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="حذف القائمة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-[#070b14] rounded-xl border border-white/8">
            <button
              type="button"
              onClick={() => setActiveTab('fg')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'fg'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              تفعيل كود دراما لايف (FG Code)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('xtream')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'xtream'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Server className="w-4 h-4" />
              حساب Xtream Codes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('m3u')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'm3u'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Link2 className="w-4 h-4" />
              إضافة قائمة M3U / M3U8
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('crypto')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'crypto'
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Lock className="w-4 h-4" />
              فحص محرك التشفير AES-128
            </button>
          </div>

          {/* Status / Error Banner */}
          {statusMessage && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-200">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">
              {errorMsg}
            </div>
          )}

          {/* Tab 1: FG Code Activation */}
          {activeTab === 'fg' && (
            <form onSubmit={handleActivateFgCode} className="space-y-4">
              <div className="p-4 rounded-xl bg-[#070b14]/80 border border-white/8 space-y-3">
                <label className="block text-xs font-bold text-slate-200">
                  كود التفعيل الرسمي (KEY_ACTIVATED_TYPE — v187)
                </label>
                <div className="flex items-center gap-2.5">
                  <input
                    type="text"
                    value={fgCode}
                    onChange={(e) => setFgCode(e.target.value)}
                    placeholder="مثال: 202122 أو 202500"
                    className="flex-1 bg-[#0f172a] border border-white/15 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors whitespace-nowrap"
                  >
                    {isLoading ? 'جاري التفعيل...' : 'تفعيل وجلب القنوات'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  يقوم المحرك بتوليد حزمة دراما لايف v187 وتشفيرها بـ AES-128-CBC وتوجيه كافة القنوات عبر البروكسي المحلي لإزالة تشويش <code className="text-emerald-400">k9x_</code>.
                </p>
              </div>
            </form>
          )}

          {/* Tab 2: Xtream Codes Account */}
          {activeTab === 'xtream' && (
            <form onSubmit={handleSyncXtream} className="space-y-4">
              <div className="p-4 rounded-xl bg-[#070b14]/80 border border-white/8 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">إعدادات الاتصال بحساب Xtream API</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-500/20 px-2 py-0.5 rounded">
                    player_api.php
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      عنوان السيرفر والمنفذ (Server URL / Host)
                    </label>
                    <input
                      type="text"
                      value={xtreamHost}
                      onChange={(e) => setXtreamHost(e.target.value)}
                      placeholder="http://iptv-server.com:8080 أو https://..."
                      className="w-full bg-[#0f172a] border border-white/15 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">اسم المستخدم (Username)</label>
                    <input
                      type="text"
                      value={xtreamUsername}
                      onChange={(e) => setXtreamUsername(e.target.value)}
                      placeholder="Username"
                      className="w-full bg-[#0f172a] border border-white/15 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">كلمة المرور (Password)</label>
                    <input
                      type="password"
                      value={xtreamPassword}
                      onChange={(e) => setXtreamPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#0f172a] border border-white/15 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">اسم القائمة في البرنامج</label>
                    <input
                      type="text"
                      value={xtreamPlaylistName}
                      onChange={(e) => setXtreamPlaylistName(e.target.value)}
                      placeholder="اشتراكي الشخصي"
                      className="w-full bg-[#0f172a] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                {/* Section Checkboxes */}
                <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-white/5 text-xs text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={xtreamIncludeVod}
                      onChange={(e) => setXtreamIncludeVod(e.target.checked)}
                      className="rounded border-white/20 text-emerald-500 focus:ring-0"
                    />
                    <span>تضمين باقات الأفلام (VOD)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={xtreamIncludeSeries}
                      onChange={(e) => setXtreamIncludeSeries(e.target.checked)}
                      className="rounded border-white/20 text-emerald-500 focus:ring-0"
                    />
                    <span>تضمين باقات المسلسلات (Series)</span>
                  </label>
                </div>

                {/* Account Details Card if authenticated */}
                {xtreamAccountInfo && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="space-y-0.5">
                      <span className="text-slate-400 block">حالة الحساب</span>
                      <span className="text-emerald-400 font-bold">{xtreamAccountInfo.status}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-slate-400 block">تاريخ الانتهاء</span>
                      <span className="text-white font-mono">{xtreamAccountInfo.expDate}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-slate-400 block">أقصى اتصالات</span>
                      <span className="text-white font-mono">{xtreamAccountInfo.maxConnections} أجهزة</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-slate-400 block">المستخدم</span>
                      <span className="text-sky-300 font-mono truncate block">{xtreamAccountInfo.username}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-white/8">
                  <button
                    type="button"
                    onClick={handleTestXtreamAccount}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/8 hover:bg-white/15 text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    فحص بيانات الحساب والاشتراك
                  </button>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50"
                  >
                    <Layers className="w-4 h-4" />
                    استيراد ومزامنة القنوات الآن
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Tab 3: M3U Import */}
          {activeTab === 'm3u' && (
            <form onSubmit={handleImportM3u} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">اسم القائمة</label>
                  <input
                    type="text"
                    value={m3uName}
                    onChange={(e) => setM3uName(e.target.value)}
                    className="w-full bg-[#070b14] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">رابط M3U / M3U8 مباشر (اختياري)</label>
                  <input
                    type="url"
                    value={m3uUrl}
                    onChange={(e) => setM3uUrl(e.target.value)}
                    placeholder="https://example.com/playlist.m3u8"
                    className="w-full bg-[#070b14] border border-white/15 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    أو الصق محتوى ملف #EXTM3U / ارفع ملفاً من جهازك
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setM3uRawText(SAMPLE_M3U_CONTENT)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      ملء قائمة M3U تجريبية
                    </button>
                    <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-[11px] font-semibold text-slate-200 cursor-pointer">
                      <FileUp className="w-3.5 h-3.5" />
                      رفع ملف .m3u
                      <input type="file" accept=".m3u,.m3u8,.txt" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                </div>
                <textarea
                  rows={5}
                  value={m3uRawText}
                  onChange={(e) => setM3uRawText(e.target.value)}
                  placeholder="#EXTM3U&#10;#EXTINF:-1 group-title=&quot;Sports&quot;,Channel Name&#10;https://..."
                  className="w-full bg-[#070b14] border border-white/15 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-400"
                  dir="ltr"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors"
                >
                  استيراد وتحليل القائمة الآن
                </button>
              </div>
            </form>
          )}

          {/* Tab 3: Live AES-128-CBC Crypto Engine Verifier */}
          {activeTab === 'crypto' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#070b14] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-white">اختبار محرك fg_engine.js (AES-128-CBC PKCS7)</h5>
                    <p className="text-[11px] text-slate-400">
                      تحقق عملياً من تطابق ناتج التشفير وفك التشفير في Node.js مع محرك بايثون الأصلي
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunCryptoTest}
                    className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors whitespace-nowrap"
                  >
                    تشغيل اختبار التشفير الحي
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono text-slate-300 bg-[#0f172a] p-2.5 rounded-lg border border-white/5" dir="ltr">
                  <span>KEY: 0123456789abcdef</span>
                  <span>·</span>
                  <span>IV: fedcba9876543210</span>
                  <span>·</span>
                  <input
                    type="text"
                    value={cryptoCode}
                    onChange={(e) => setCryptoCode(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded px-2 py-0.5 text-emerald-400 w-24"
                  />
                </div>

                {cryptoResult && (
                  <div className="space-y-2 pt-2" dir="ltr">
                    <div>
                      <div className="text-[11px] font-semibold text-emerald-400 mb-1">
                        Encrypted Payload (Base64 Ciphertext : Base64 IV):
                      </div>
                      <pre className="p-2.5 rounded-lg bg-black/60 border border-white/10 text-[11px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">
                        {cryptoResult.encrypted}
                      </pre>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-sky-400 mb-1">
                        Decrypted JSON Verification:
                      </div>
                      <pre className="p-2.5 rounded-lg bg-black/60 border border-white/10 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-40">
                        {JSON.stringify(cryptoResult.decryptedBack, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
