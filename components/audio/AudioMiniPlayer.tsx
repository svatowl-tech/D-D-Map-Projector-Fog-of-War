'use client';

import React, { useState, useEffect } from 'react';
import {
  Music,
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Radio,
  Zap,
} from 'lucide-react';
import { audioService } from '@/lib/audio/audio-engine';
import { AudioEngineState, AudioPlaylist } from '@/lib/audio/types';

interface AudioMiniPlayerProps {
  onOpenFullPlayer: () => void;
  showToast?: (msg: string) => void;
}

export const AudioMiniPlayer: React.FC<AudioMiniPlayerProps> = ({
  onOpenFullPlayer,
  showToast,
}) => {
  const [engineState, setEngineState] = useState<AudioEngineState>(audioService.getState());
  const [playlists, setPlaylists] = useState<AudioPlaylist[]>(audioService.getPlaylists());
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = audioService.subscribe((state) => {
      setEngineState(state);
      setPlaylists(audioService.getPlaylists());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const isPlaying = engineState.isPlaying && !engineState.isPaused;

  // Быстрое переключение настроения в 1 клик прямо из мини-плеера
  const handleQuickMood = (playlistId: string) => {
    audioService.playPlaylist(playlistId);
    const p = playlists.find((x) => x.id === playlistId);
    if (p && showToast) {
      showToast(`🎵 Настроение: «${p.name}»`);
    }
  };

  // Если свернут в компактную круглую плавающую кнопку
  if (isCollapsed) {
    return (
      <div
        id="audio-mini-player-collapsed"
        className="fixed bottom-4 right-4 z-40 animate-in fade-in zoom-in-90 duration-150"
      >
        <button
          onClick={() => setIsCollapsed(false)}
          className={`relative p-3 rounded-full border shadow-2xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
            isPlaying
              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)] scale-105'
              : 'bg-[#0f172a]/95 text-slate-300 border-slate-700 hover:bg-slate-800'
          }`}
          title="Развернуть аудиопанель D&D (Горячая клавиша M)"
        >
          <Music className="w-5 h-5" />
          {isPlaying && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0f172a] animate-ping" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      id="audio-mini-player-dock"
      className="fixed bottom-4 right-4 z-40 max-w-md w-[380px] bg-[#0c121e]/95 backdrop-blur-md border border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden text-slate-200 animate-in slide-in-from-bottom-3 duration-200 select-none"
    >
      {/* Верхняя строка мини-плеера */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-[#1e293b]/80 bg-[#111724]/90">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
            <Music className="w-3.5 h-3.5" />
          </div>

          <div className="min-w-0">
            <div className="font-bold text-[11px] text-amber-400 truncate">
              {engineState.currentPlaylistName ? `[${engineState.currentPlaylistName}]` : 'D&D AUDIO'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Кнопка открытия полного окна */}
          <button
            onClick={onOpenFullPlayer}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Открыть полную студию плейлистов и саундборд (M)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Кнопка сворачивания */}
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Свернуть в компактную кнопку"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Быстрые кнопки настроений сцены */}
      {playlists.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-1.5 bg-[#090d16] border-b border-[#1e293b]/60 overflow-x-auto custom-scrollbar no-scrollbar">
          {playlists.slice(0, 5).map((pl) => {
            const isThisPlPlaying = engineState.currentPlaylistId === pl.id && isPlaying;
            return (
              <button
                key={pl.id}
                onClick={() => handleQuickMood(pl.id)}
                className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 flex-shrink-0 transition-all cursor-pointer ${
                  isThisPlPlaying
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
                title={`Включить ${pl.name} (случайный трек)`}
              >
                <span>{pl.icon || '🎵'}</span>
                <span className="truncate max-w-[80px]">{pl.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Основной блок управления */}
      <div className="p-3 flex items-center justify-between gap-3">
        {/* Название трека и пульсация */}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-xs text-slate-100 truncate flex items-center gap-1.5">
            {isPlaying && (
              <div className="flex items-end gap-0.5 h-3 flex-shrink-0">
                <span className="w-0.5 bg-amber-400 rounded-full animate-bounce [animation-delay:0.1s] h-2" />
                <span className="w-0.5 bg-amber-400 rounded-full animate-bounce [animation-delay:0.3s] h-3" />
                <span className="w-0.5 bg-amber-400 rounded-full animate-bounce [animation-delay:0.2s] h-1.5" />
              </div>
            )}
            <span className="truncate">
              {engineState.currentTrack?.title || 'Нажмите Play для старта музыки'}
            </span>
          </div>

          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
            {isPlaying ? '● Случайный бесконечный цикл' : 'Пауза'}
          </div>
        </div>

        {/* Кнопки управления */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => audioService.togglePlayPause()}
            className="w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-500/20 transition-transform active:scale-95 cursor-pointer"
            title={isPlaying ? 'Пауза (Пробел)' : 'Воспроизведение (Пробел)'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={() => audioService.nextTrack()}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Следующий случайный трек"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Ползунок громкости */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => audioService.toggleMute()}
              className="text-slate-400 hover:text-white"
              title={engineState.isMuted ? 'Включить звук' : 'Без звука'}
            >
              {engineState.isMuted || engineState.volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-slate-300" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={engineState.isMuted ? 0 : engineState.volume}
              onChange={(e) => audioService.setVolume(parseFloat(e.target.value))}
              className="w-14 accent-amber-400 cursor-pointer h-1 bg-slate-800 rounded-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
