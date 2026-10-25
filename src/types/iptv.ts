export type ContentSection = 'live' | 'radio' | 'movies' | 'series' | 'fav' | 'history';

export type PlaylistType = 'builtin' | 'fg_code' | 'm3u_url' | 'm3u_file' | 'xtream';

export interface PlaylistSource {
  id: string;
  name: string;
  type: PlaylistType;
  codeOrUrl: string;
  channelCount: number;
  updatedAt: string;
  isActive?: boolean;
}

export interface CategoryItem {
  id: string;
  playlistId: string;
  name: string;
  section: 'live' | 'radio' | 'movies' | 'series';
  count: number;
  remoteTopic?: string;
  remoteType?: 'drama_topic' | 'country_m3u';
  icon?: string;
  flag?: string;
}

export interface StreamServerSource {
  id: string;
  name: string;
  url: string;
  serverNumber?: number;
  badge?: string;
  isProxied?: boolean;
  hasK9xSwap?: boolean;
  qualityHint?: string;
  headers?: Record<string, string>;
  swap?: Record<string, string>;
}

export interface ChannelItem {
  id: string;
  playlistId: string;
  categoryId: string;
  name: string;
  groupTitle: string;
  section: 'live' | 'radio' | 'movies' | 'series';
  logo?: string;
  fgLiveId?: string;
  fgCode?: string;
  resolution?: string;
  bitrate?: string;
  epgCurrent?: string;
  year?: string;
  rating?: string;
  duration?: string;
  sources: StreamServerSource[];
}

export interface HlsQualityLevel {
  index: number;
  height: number;
  width: number;
  bitrate: number;
  label: string;
}

export type AspectRatioMode = 'default' | '16:9' | '4:3' | 'fill' | 'cover';

export interface ElectronExportFile {
  path: string;
  title: string;
  category: 'main' | 'preload' | 'renderer' | 'launcher' | 'installer';
  language: 'javascript' | 'json' | 'batch' | 'powershell' | 'ini';
  description: string;
  content: string;
}
