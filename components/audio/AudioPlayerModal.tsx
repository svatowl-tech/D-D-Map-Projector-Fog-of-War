'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Music,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  FolderOpen,
  Sliders,
  Sparkles,
  Upload,
  X,
  Search,
  Zap,
  Radio,
  Plus,
  Trash2,
  ListMusic,
  Layers,
  StopCircle,
} from 'lucide-react';
import { audioService } from '@/lib/audio/audio-engine';
import {
  AudioEngineState,
  AudioPlaylist,
  AudioTrack,
  SoundEffect,
  AmbientLoop,
} from '@/lib/audio/types';
import {
  scanFilesToPlaylists,
  getBuiltinDemoPlaylists,
} from '@/lib/audio/folder-scanner';
import {
  BUILTIN_SFX_PRESETS,
  BUILTIN_AMBIENT_LOOPS,
  toggleAmbientLoop,
  setAmbientLoopVolume,
  stopAllAmbientLoops,
} from '@/lib/audio/sfx-presets';

interface AudioPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast?: (msg: string) => void;
}

export const AudioPlayerModal: React.FC<AudioPlayerModalProps> = ({
  isOpen,
  onClose,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'playlists' | 'sfx' | 'ambient'>('playlists');
  const [engineState, setEngineState] = useState<AudioEngineState>(() => audioService.getState());
  const [playlists, setPlaylists] = useState<AudioPlaylist[]>(() => audioService.getPlaylists());
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(() => {
    return audioService.getPlaylists()[0]?.id || null;
  });

  // Саундборд
  const [customSFXList, setCustomSFXList] = useState<SoundEffect[]>([]);
  const [activeSFXCategory, setActiveSFXCategory] = useState<string>('all');
  const [lastTriggeredSFXId, setLastTriggeredSFXId] = useState<string | null>(null);

  // Эмбиент-лупы
  const [ambientLoops, setAmbientLoops] = useState<AmbientLoop[]>(BUILTIN_AMBIENT_LOOPS);

  // Поиск треков
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const sfxInputRef = useRef<HTMLInputElement>(null);

  // Подписка на обновления аудио-движка
  useEffect(() => {
    const unsubscribe = audioService.subscribe((state) => {
      setEngineState(state);
      setPlaylists(audioService.getPlaylists());
      if (state.currentPlaylistId) {
        setSelectedPlaylistId((prev) => prev || state.currentPlaylistId);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Синхронизация выбранного плейлиста
  const activePlaylist = useMemo(() => {
    return (
      playlists.find((p) => p.id === (selectedPlaylistId || engineState.currentPlaylistId)) ||
      playlists[0] ||
      null
    );
  }, [playlists, selectedPlaylistId, engineState.currentPlaylistId]);

  // Фильтрация треков в плейлисте по поисковому запросу
  const filteredTracks = useMemo(() => {
    if (!activePlaylist) return [];
    if (!searchQuery.trim()) return activePlaylist.tracks;
    const q = searchQuery.toLowerCase().trim();
    return activePlaylist.tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.artist && t.artist.toLowerCase().includes(q))
    );
  }, [activePlaylist, searchQuery]);

  // Все доступные SFX (встроенные + пользовательские)
  const allSFX = useMemo(() => {
    const combined = [...BUILTIN_SFX_PRESETS, ...customSFXList];
    if (activeSFXCategory === 'all') return combined;
    return combined.filter((s) => s.category === activeSFXCategory);
  }, [customSFXList, activeSFXCategory]);

  // Обработка выбора папки с музыкой
  const handleFolderSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsScanning(true);

    try {
      const scannedPlaylists = await scanFilesToPlaylists(files);
      if (scannedPlaylists.length === 0) {
        showToast?.('В выбранной папке не найдено подходящих аудиофайлов (MP3, WAV, OGG, FLAC)');
        setIsScanning(false);
        return;
      }

      audioService.setPlaylists(scannedPlaylists);
      setPlaylists(scannedPlaylists);
      setSelectedPlaylistId(scannedPlaylists[0].id);

      const totalTracks = scannedPlaylists.reduce((acc, p) => acc + p.trackCount, 0);
      showToast?.(
        `✓ Загружено: ${scannedPlaylists.length} плейлистов (${totalTracks} треков). Нажмите на любое настроение!`
      );
    } catch (err) {
      console.error('Ошибка сканирования папки:', err);
      showToast?.('Не удалось просканировать папку с музыкой');
    } finally {
      setIsScanning(false);
    }
  };

  // Загрузка демо-пресетов
  const handleLoadDemoPresets = () => {
    const demo = getBuiltinDemoPlaylists();
    audioService.setPlaylists(demo);
    setPlaylists(demo);
    setSelectedPlaylistId(demo[0].id);
    showToast?.('Загружены атмосферные D&D плейлисты (Битва, Босс, Таверна, Подземелье, Город, Дорога)');
  };

  // Обработка клика по карточке настроения / плейлисту
  const handleSelectAndPlayPlaylist = (playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    audioService.playPlaylist(playlistId);
    const p = playlists.find((x) => x.id === playlistId);
    if (p) {
      showToast?.(`🎵 Играет настроение: «${p.name}» (случайный порядок и авто-повтор)`);
    }
  };

  // Обработка триггера SFX
  const handleTriggerSFX = (sfx: SoundEffect) => {
    setLastTriggeredSFXId(sfx.id);
    audioService.triggerSFX(sfx);
    setTimeout(() => {
      setLastTriggeredSFXId((prev) => (prev === sfx.id ? null : prev));
    }, 400);
  };

  // Загрузка пользовательских SFX
  const handleCustomSFXUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const newSFX: SoundEffect[] = fileArray.map((file) => {
      const url = URL.createObjectURL(file);
      const name = file.name.replace(/\.[^/.]+$/, '').replace(/^\d+[\s._-]+/, '');
      return {
        id: `custom_sfx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name,
        category: 'custom',
        icon: '🔊',
        color: '#38bdf8',
        url,
        isCustom: true,
      };
    });

    setCustomSFXList((prev) => [...prev, ...newSFX]);
    showToast?.(`Добавлено ${newSFX.length} пользовательских звуковых эффектов`);
  };

  // Переключение эмбиент-лупа
  const handleToggleAmbient = (loop: AmbientLoop) => {
    const isNowPlaying = toggleAmbientLoop(loop.id, loop.synthPreset, loop.volume);
    setAmbientLoops((prev) =>
      prev.map((item) => (item.id === loop.id ? { ...item, isPlaying: isNowPlaying } : item))
    );
  };

  // Изменение громкости эмбиента
  const handleAmbientVolume = (loopId: string, vol: number) => {
    setAmbientLoopVolume(loopId, vol);
    setAmbientLoops((prev) =>
      prev.map((item) => (item.id === loopId ? { ...item, volume: vol } : item))
    );
  };

  // Остановка всех звуков
  const handleStopAll = () => {
    audioService.pause();
    stopAllAmbientLoops();
    setAmbientLoops((prev) => prev.map((item) => ({ ...item, isPlaying: false })));
    showToast?.('Все звуки, музыка и фоновый эмбиент остановлены');
  };

  // Горячие клавиши для саундборда
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        audioService.togglePlayPause();
        return;
      }

      // 0-9 быстрые звуковые эффекты
      const sfx = BUILTIN_SFX_PRESETS.find((s) => s.hotkey === e.key);
      if (sfx) {
        handleTriggerSFX(sfx);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Форматирование времени (мм:сс)
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isOpen) return null;

  return (
    <div
      id="audio-player-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        id="audio-player-modal-window"
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#0b0f17] border border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Верхняя панель заголовка */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e293b] bg-[#0f172a]/90 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Music className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-extrabold text-sm sm:text-base tracking-wider text-amber-400">
                  D&D AUDIO ENGINE & SOUNDBOARD
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Auto-Shuffle Loop
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Умное воспроизведение локальных папок по настроениям, кроссфейд и боевой саундборд
              </p>
            </div>
          </div>

          {/* Вкладки и кнопка закрытия */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex bg-[#1e293b]/80 p-1 rounded-lg border border-slate-700/60 text-xs">
              <button
                onClick={() => setActiveTab('playlists')}
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'playlists'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span>Плейлисты</span>
              </button>

              <button
                onClick={() => setActiveTab('sfx')}
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'sfx'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Саундборд SFX</span>
              </button>

              <button
                onClick={() => setActiveTab('ambient')}
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'ambient'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Эмбиент-микшер</span>
              </button>
            </div>

            <button
              onClick={handleStopAll}
              className="p-2 rounded-lg bg-red-950/60 border border-red-500/40 text-red-400 hover:bg-red-900/60 hover:text-red-300 transition-colors"
              title="Экстренно остановить все звуки и музыку"
            >
              <StopCircle className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Закрыть окно (плеер продолжит играть в фоне)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Скрытые инпуты для загрузки папок и SFX */}
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is standard for folder picker
          webkitdirectory="true"
          directory="true"
          multiple
          className="hidden"
          onChange={(e) => handleFolderSelected(e.target.files)}
        />

        <input
          ref={sfxInputRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => handleCustomSFXUpload(e.target.files)}
        />

        {/* Главное содержимое в зависимости от вкладки */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar min-h-[420px]">
          {activeTab === 'playlists' && (
            <div className="space-y-5">
              {/* Верхняя плашка управления библиотекой музыки */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#131b2a] border border-slate-800">
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => folderInputRef.current?.click()}
                    disabled={isScanning}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>{isScanning ? 'Сканирование папки...' : '📁 Выбрать папку с музыкой'}</span>
                  </button>

                  <button
                    onClick={handleLoadDemoPresets}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Сбросить на демо-пресеты</span>
                  </button>
                </div>

                <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700/80 text-amber-300">
                    {playlists.length} настроений / плейлистов
                  </span>
                  <span className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700/80 text-cyan-300">
                    {playlists.reduce((acc, p) => acc + p.trackCount, 0)} треков
                  </span>
                </div>
              </div>

              {/* СЕТКА НАСТРОЕНИЙ (MOOD BOARD) — ПЕРЕКЛЮЧЕНИЕ В 1 КЛИК */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-amber-400" />
                    <span>Настроения сцены (Клик для мгновенного старта с рандомом):</span>
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Плавный кроссфейд {engineState.crossfadeDuration}с при смене
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {playlists.map((playlist) => {
                    const isCurrentPlaying =
                      engineState.currentPlaylistId === playlist.id &&
                      engineState.isPlaying &&
                      !engineState.isPaused;
                    const isSelected = selectedPlaylistId === playlist.id;

                    return (
                      <button
                        key={playlist.id}
                        onClick={() => handleSelectAndPlayPlaylist(playlist.id)}
                        className={`relative p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all duration-150 cursor-pointer overflow-hidden group ${
                          isCurrentPlaying
                            ? 'bg-gradient-to-br from-amber-500/20 to-red-500/10 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                            : isSelected
                            ? 'bg-slate-800/90 border-slate-600 shadow-md'
                            : 'bg-[#111724]/90 border-slate-800/90 hover:bg-slate-800/60 hover:border-slate-700'
                        }`}
                      >
                        {/* Активный пульсирующий эквалайзер */}
                        {isCurrentPlaying && (
                          <div className="absolute top-2.5 right-2.5 flex items-end gap-0.5 h-4">
                            <span className="w-1 bg-amber-400 rounded-full animate-bounce [animation-delay:0.1s] h-3" />
                            <span className="w-1 bg-amber-400 rounded-full animate-bounce [animation-delay:0.3s] h-4" />
                            <span className="w-1 bg-amber-400 rounded-full animate-bounce [animation-delay:0.2s] h-2.5" />
                          </div>
                        )}

                        <div className="flex items-center gap-2.5 mb-2">
                          <span className="text-2xl filter drop-shadow-sm group-hover:scale-110 transition-transform">
                            {playlist.icon || '🎵'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div
                              className={`font-bold text-xs sm:text-sm truncate ${
                                isCurrentPlaying ? 'text-amber-300 font-extrabold' : 'text-slate-100'
                              }`}
                            >
                              {playlist.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {playlist.trackCount} {playlist.trackCount === 1 ? 'трек' : 'треков'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-700/40">
                          <span className="text-amber-400/90 flex items-center gap-1">
                            <Shuffle className="w-2.5 h-2.5" />
                            Рандом & Loop
                          </span>
                          <span className="group-hover:text-amber-300 transition-colors font-bold">
                            {isCurrentPlaying ? '▶ Играет' : 'Включить'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* СПИСОК ТРЕКОВ ВЫБРАННОГО ПЛЕЙЛИСТА */}
              {activePlaylist && (
                <div className="p-4 rounded-xl bg-[#0e1420] border border-slate-800/90 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{activePlaylist.icon}</span>
                      <h4 className="font-bold text-sm text-slate-200">
                        Список треков: <span className="text-amber-400">{activePlaylist.name}</span>
                      </h4>
                      <span className="text-xs font-mono text-slate-400">
                        ({activePlaylist.tracks.length})
                      </span>
                    </div>

                    {/* Поиск треков */}
                    <div className="relative w-48 sm:w-64">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Поиск трека..."
                        className="w-full pl-8 pr-3 py-1 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto custom-scrollbar divide-y divide-slate-800/60 border border-slate-800/60 rounded-lg">
                    {filteredTracks.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        Треки не найдены по запросу «{searchQuery}»
                      </div>
                    ) : (
                      filteredTracks.map((track, idx) => {
                        const isThisTrackPlaying =
                          engineState.currentTrack?.id === track.id &&
                          engineState.isPlaying &&
                          !engineState.isPaused;

                        return (
                          <div
                            key={track.id}
                            onClick={() => {
                              audioService.playPlaylist(activePlaylist.id, track.id);
                            }}
                            className={`flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer ${
                              isThisTrackPlaying
                                ? 'bg-amber-500/15 text-amber-300 font-bold'
                                : 'hover:bg-slate-800/50 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-5 text-[11px] font-mono text-slate-500 text-right">
                                {isThisTrackPlaying ? '▶' : idx + 1}
                              </span>
                              <span className="truncate">{track.title}</span>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500">
                              {track.format && (
                                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[9px]">
                                  {track.format}
                                </span>
                              )}
                              <span>{formatTime(track.duration)}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Вкладка 2: САУНДБОРД SFX */}
          {activeTab === 'sfx' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#131b2a] border border-slate-800">
                {/* Категории SFX */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {[
                    { id: 'all', label: 'Все SFX' },
                    { id: 'd20', label: '🎲 D20 Кости' },
                    { id: 'combat', label: '⚔️ Оружие & Бой' },
                    { id: 'magic', label: '✨ Заклинания' },
                    { id: 'monster', label: '🐉 Чудовища' },
                    { id: 'dungeon', label: '🚪 Ловушки & Склеп' },
                    { id: 'ambient', label: '💰 Окружение' },
                    { id: 'custom', label: '⭐ Свои звуки' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveSFXCategory(cat.id)}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        activeSFXCategory === cat.id
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => sfxInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить свои SFX файлы</span>
                </button>
              </div>

              {/* Сетка кнопок саундборда */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {allSFX.map((sfx) => {
                  const isPulsing = lastTriggeredSFXId === sfx.id;

                  return (
                    <button
                      key={sfx.id}
                      onClick={() => handleTriggerSFX(sfx)}
                      className={`relative p-3.5 rounded-xl border flex flex-col items-center justify-center text-center gap-2 transition-all duration-100 cursor-pointer ${
                        isPulsing
                          ? 'scale-95 bg-amber-500/30 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)]'
                          : 'bg-[#121927] border-slate-800 hover:bg-slate-800/80 hover:border-slate-700 active:scale-95'
                      }`}
                    >
                      {sfx.hotkey && (
                        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.2 rounded bg-slate-900/90 text-slate-400 font-mono text-[9px] border border-slate-700">
                          {sfx.hotkey}
                        </span>
                      )}

                      <span className="text-3xl filter drop-shadow">{sfx.icon}</span>

                      <div className="font-bold text-xs text-slate-100 leading-tight">
                        {sfx.name}
                      </div>

                      <span className="text-[9px] text-slate-400 font-mono flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5 text-amber-400" />
                        Воспроизвести
                      </span>
                    </button>
                  );
                })}
              </div>

              {allSFX.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-sm">
                  В этой категории пока нет звуковых эффектов. Нажмите «Добавить свои SFX файлы».
                </div>
              )}
            </div>
          )}

          {/* Вкладка 3: ЭМБИЕНТ-МИКШЕР */}
          {activeTab === 'ambient' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#131b2a] border border-slate-800">
                <h3 className="font-bold text-sm text-slate-200 mb-1 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Многослойный фоновый эмбиент</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Эмбиенты работают параллельно с фоновой музыкой. Вы можете включить треск костра, шум таверны или ливень одновременно с боевым треком!
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {ambientLoops.map((loop) => (
                  <div
                    key={loop.id}
                    className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                      loop.isPlaying
                        ? 'bg-gradient-to-r from-cyan-950/40 to-slate-900 border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                        : 'bg-[#121927] border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{loop.icon}</span>
                      <div>
                        <div className="font-bold text-sm text-slate-100">{loop.name}</div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {loop.isPlaying ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Активен (Зациклен)
                            </span>
                          ) : (
                            'Выключен'
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Слайдер громкости конкретного эмбиента */}
                      {loop.isPlaying && (
                        <div className="flex items-center gap-2 w-24">
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={loop.volume}
                            onChange={(e) => handleAmbientVolume(loop.id, parseFloat(e.target.value))}
                            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                          />
                        </div>
                      )}

                      <button
                        onClick={() => handleToggleAmbient(loop)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          loop.isPlaying
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
                            : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-extrabold shadow-md'
                        }`}
                      >
                        {loop.isPlaying ? 'Выключить' : 'Включить'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* НИЖНЯЯ ПАНЕЛЬ ТЕКУЩЕГО ВОСПРОИЗВЕДЕНИЯ (MASTER NOW PLAYING BAR) */}
        <div className="p-4 border-t border-[#1e293b] bg-[#0c121e] flex flex-col gap-2.5 flex-shrink-0">
          {/* Слайдер прогресса трека */}
          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <span className="w-10 text-right">{formatTime(engineState.currentTime)}</span>
            <div className="flex-1 relative flex items-center">
              <input
                type="range"
                min="0"
                max={engineState.duration || 180}
                value={engineState.currentTime}
                onChange={(e) => audioService.seek(parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg hover:h-2 transition-all"
              />
            </div>
            <span className="w-10">{formatTime(engineState.duration || 180)}</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Информация о текущем треке */}
            <div className="flex items-center gap-3 min-w-[200px] max-w-sm">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                <Music className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs sm:text-sm text-slate-100 truncate">
                  {engineState.currentTrack?.title || 'Выберите плейлист настроения'}
                </div>
                <div className="text-[11px] font-mono text-amber-400/90 truncate flex items-center gap-1.5">
                  <span>{engineState.currentPlaylistName || 'Плеер готов к работе'}</span>
                  {engineState.isPlaying && !engineState.isPaused && (
                    <span className="text-emerald-400">● Играет</span>
                  )}
                </div>
              </div>
            </div>

            {/* Главные кнопки управления (Prev, Play/Pause, Next, Shuffle, Repeat) */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Shuffle */}
              <button
                onClick={() => audioService.setShuffle(!engineState.isShuffle)}
                className={`p-2 rounded-lg transition-colors ${
                  engineState.isShuffle
                    ? 'text-amber-400 bg-amber-500/15 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Случайный порядок треков (Shuffle)"
              >
                <Shuffle className="w-4 h-4" />
              </button>

              {/* Prev */}
              <button
                onClick={() => audioService.prevTrack()}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                title="Предыдущий трек"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {/* Big Play / Pause */}
              <button
                onClick={() => audioService.togglePlayPause()}
                className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30 font-bold transition-transform active:scale-95 cursor-pointer"
                title={engineState.isPlaying && !engineState.isPaused ? 'Пауза (Пробел)' : 'Воспроизведение (Пробел)'}
              >
                {engineState.isPlaying && !engineState.isPaused ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>

              {/* Next */}
              <button
                onClick={() => audioService.nextTrack()}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                title="Следующий трек (случайный из плейлиста)"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              {/* Repeat Mode */}
              <button
                onClick={() => {
                  const nextMode =
                    engineState.repeatMode === 'playlist'
                      ? 'track'
                      : engineState.repeatMode === 'track'
                      ? 'off'
                      : 'playlist';
                  audioService.setRepeatMode(nextMode);
                }}
                className={`p-2 rounded-lg transition-colors flex items-center gap-0.5 ${
                  engineState.repeatMode !== 'off'
                    ? 'text-amber-400 bg-amber-500/15 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={`Повтор: ${
                  engineState.repeatMode === 'playlist'
                    ? 'Весь плейлист (Loop)'
                    : engineState.repeatMode === 'track'
                    ? 'Один трек'
                    : 'Выключен'
                }`}
              >
                <Repeat className="w-4 h-4" />
                {engineState.repeatMode === 'track' && <span className="text-[9px] font-bold">1</span>}
              </button>
            </div>

            {/* Настройки громкости и кроссфейда */}
            <div className="flex items-center gap-4 text-xs">
              {/* Кроссфейд */}
              <div className="hidden md:flex items-center gap-2 text-slate-400">
                <span className="text-[11px] font-mono">Кроссфейд:</span>
                <select
                  value={engineState.crossfadeDuration}
                  onChange={(e) => audioService.setCrossfadeDuration(parseFloat(e.target.value))}
                  className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-amber-300 focus:outline-none"
                >
                  <option value="0">Без фейда</option>
                  <option value="1">1.0 сек</option>
                  <option value="1.5">1.5 сек</option>
                  <option value="2.5">2.5 сек</option>
                  <option value="4">4.0 сек</option>
                </select>
              </div>

              {/* Громкость музыки */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => audioService.toggleMute()}
                  className="text-slate-400 hover:text-white"
                  title={engineState.isMuted ? 'Включить звук' : 'Без звука'}
                >
                  {engineState.isMuted || engineState.volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-red-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-slate-300" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={engineState.isMuted ? 0 : engineState.volume}
                  onChange={(e) => audioService.setVolume(parseFloat(e.target.value))}
                  className="w-20 sm:w-24 accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <span className="w-8 font-mono text-[10px] text-slate-400">
                  {Math.round((engineState.isMuted ? 0 : engineState.volume) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
