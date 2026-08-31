/**
 * Типы данных для аудио-подсистемы, плейлистов и саундборда
 */

export interface AudioTrack {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  folderPath: string;
  playlistId: string;
  playlistName: string;
  file?: File;
  url: string;
  duration: number; // в секундах
  size?: number;
  format?: string;
  isSynthetic?: boolean;
}

export interface AudioPlaylist {
  id: string;
  name: string;
  category?: 'combat' | 'boss' | 'tavern' | 'dungeon' | 'exploration' | 'city' | 'horror' | 'ambient' | 'custom';
  icon?: string;
  color?: string;
  trackCount: number;
  tracks: AudioTrack[];
  shuffledQueue: string[]; // IDs треков в случайном порядке
  currentIndex: number;
}

export type SFXCategory =
  | 'combat'
  | 'magic'
  | 'd20'
  | 'monster'
  | 'dungeon'
  | 'ambient'
  | 'dialogue'
  | 'custom';

export interface SoundEffect {
  id: string;
  name: string;
  category: SFXCategory;
  icon: string;
  color?: string;
  hotkey?: string;
  url?: string;
  synthPreset?: string;
  volume?: number;
  isCustom?: boolean;
}

export interface AmbientLoop {
  id: string;
  name: string;
  icon: string;
  color: string;
  synthPreset: string;
  volume: number;
  isPlaying: boolean;
}

export interface AudioEngineState {
  currentTrack: AudioTrack | null;
  currentPlaylistId: string | null;
  currentPlaylistName: string | null;
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  volume: number; // 0.0 to 1.0
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: 'playlist' | 'track' | 'off';
  crossfadeDuration: number; // секунды (0 to 5)
  sfxVolume: number; // 0.0 to 1.0
}
