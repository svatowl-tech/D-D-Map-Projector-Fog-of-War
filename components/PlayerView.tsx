'use client';

/**
 * Окно Игроков / Проектора (Player View)
 * Полностью изолированный полноэкранный вьюпорт без элементов управления мастера.
 * 100% непрозрачный черный туман войны, мгновенная синхронизация, аппаратное ускорение.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ViewportTransform,
  GridConfig,
  MediaState,
  FogAction,
  PingMarker,
  SyncMessage,
  DMFullState,
  PlayerViewportInfo,
  ProjectorSettingsSync,
} from '@/lib/types';
import { CampaignCard } from '@/lib/dnd-engine/types';
import {
  MapFxStroke,
  SpellZoneArea,
  LaserPointerState,
  AttentionBeacon,
} from '@/lib/map-canvas-engine/types';
import { MapFxEngine } from '@/lib/map-canvas-engine/MapFxEngine';
import { playAttentionBeep } from '@/lib/audio/alertSound';
import { SyncController } from '@/lib/sync';
import { FogEngine } from '@/lib/fog-engine';
import { PRESET_MAPS } from '@/lib/presets';
import { PlayerCardOverlay } from '@/components/dnd/PlayerCardOverlay';
import { resolveMediaUrl } from '@/lib/mediaCache';
import { Maximize, RefreshCw, EyeOff, Radio } from 'lucide-react';

export const PlayerView: React.FC = () => {
  // Состояние медиа карты
  const [media, setMedia] = useState<MediaState>({
    type: 'image',
    url: PRESET_MAPS[0].dataUrl,
    name: PRESET_MAPS[0].name,
    width: PRESET_MAPS[0].width,
    height: PRESET_MAPS[0].height,
    aspectRatio: PRESET_MAPS[0].width / PRESET_MAPS[0].height,
  });
  const currentObjectUrlRef = useRef<string | null>(null);

  // Настройки проектора
  const [projectorSettings, setProjectorSettings] = useState<ProjectorSettingsSync>({
    brightness: 1.0,
    contrast: 1.0,
    invertColors: false,
    blackout: false,
    showGridOnPlayer: true,
    showPingsOnPlayer: true,
  });

  // Состояние спроецированной карточки от Мастера
  const [projectedCard, setProjectedCard] = useState<CampaignCard | null>(null);
  const [pinnedCards, setPinnedCards] = useState<CampaignCard[]>([]);

  // Состояние камеры
  const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, scale: 1 });

  // Сетка
  const [grid, setGrid] = useState<GridConfig>({
    enabled: true,
    size: 70,
    color: '#ffffff',
    opacity: 0.22,
    offsetX: 0,
    offsetY: 0,
  });

  // Векторные пинги мастера
  const [activePings, setActivePings] = useState<PingMarker[]>([]);

  // Статус связи
  const [isSyncConnected, setIsSyncConnected] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(true);

  // Ссылки на DOM и движки тумана и визуальных эффектов
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fogEngineRef = useRef<FogEngine | null>(null);
  const mapFxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapFxEngineRef = useRef<MapFxEngine | null>(null);
  const syncRef = useRef<SyncController | null>(null);
  const isFogBaseFilledRef = useRef<boolean>(false);
  const fogActionsHistoryRef = useRef<FogAction[]>([]);
  const hasReceivedInitialDMStateRef = useRef<boolean>(false);

  // Актуальные refs для стабильных колбэков
  const viewportRef = useRef(viewport);
  const mediaRef = useRef(media);

  useEffect(() => { viewportRef.current = viewport; }, [viewport]);
  useEffect(() => { mediaRef.current = media; }, [media]);

  // Функция расчета вписывания карты в окно проектора (Initial auto-fit)
  const calculateAutoFit = useCallback((w: number, h: number): ViewportTransform => {
    if (typeof window === 'undefined') return { x: 0, y: 0, scale: 1 };
    const winW = window.innerWidth || 1920;
    const winH = window.innerHeight || 1080;
    const scale = Math.min(winW / w, winH / h) * 0.98;
    const x = Math.round((winW - w * scale) / 2);
    const y = Math.round((winH - h * scale) / 2);
    return { x, y, scale };
  }, []);

  // Отправка информации о размерах окна проектора Мастеру (для отображения рамки на столе DM)
  const reportViewportToDM = useCallback((vp: ViewportTransform, med: MediaState) => {
    if (typeof window === 'undefined' || !med || med.type === 'none') return;
    const info: PlayerViewportInfo = {
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      viewport: vp,
      mapWidth: med.width,
      mapHeight: med.height,
      aspectRatio: med.width / med.height,
    };
    syncRef.current?.send({
      type: 'PLAYER_VIEWPORT_INFO',
      payload: info,
      timestamp: Date.now(),
    });
  }, []);

  // 1. Инициализация движка 100% непрозрачного тумана и движка эффектов карты (MapFxEngine)
  useEffect(() => {
    if (fogCanvasRef.current) {
      fogEngineRef.current = new FogEngine(fogCanvasRef.current, false);
      fogEngineRef.current.resize(media.width, media.height);
      if (isFogBaseFilledRef.current) {
        fogEngineRef.current.fillAll();
      } else {
        fogEngineRef.current.clearAll();
      }
    }

    if (mapFxCanvasRef.current) {
      mapFxEngineRef.current = new MapFxEngine(mapFxCanvasRef.current);
      mapFxEngineRef.current.resize(media.width, media.height);
    }

    return () => {
      mapFxEngineRef.current?.destroy();
    };
  }, []);

  // Начальная авто-подгонка вьюпорта
  useEffect(() => {
    if (!hasReceivedInitialDMStateRef.current) {
      const initVp = calculateAutoFit(media.width, media.height);
      setViewport(initVp);
      reportViewportToDM(initVp, media);
    }
  }, [calculateAutoFit, media, reportViewportToDM]);

  // Функция применения медиафайла
  const applyMedia = useCallback(async (
    url: string,
    type: 'image' | 'video',
    name: string,
    width: number = 1600,
    height: number = 1200
  ) => {
    const resolvedUrl = await resolveMediaUrl(url);
    if (currentObjectUrlRef.current && currentObjectUrlRef.current !== resolvedUrl && currentObjectUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }
    if (resolvedUrl.startsWith('blob:')) {
      currentObjectUrlRef.current = resolvedUrl;
    }

    const newMedia: MediaState = {
      type,
      url: resolvedUrl,
      name,
      width,
      height,
      aspectRatio: width / height,
    };

    setMedia(newMedia);

    if (fogEngineRef.current && fogCanvasRef.current) {
      fogEngineRef.current.resize(width, height);
      if (isFogBaseFilledRef.current) {
        fogEngineRef.current.fillAll();
      } else {
        fogEngineRef.current.clearAll();
      }
    }

    if (mapFxEngineRef.current && mapFxCanvasRef.current) {
      mapFxEngineRef.current.resize(width, height);
    }
  }, []);

  // 2. Обработчик сообщений от Мастера
  const handleIncomingMessage = useCallback((msg: SyncMessage) => {
    if (msg.type === 'DM_STATE_FULL') {
      const state: DMFullState = msg.payload;
      setIsSyncConnected(true);
      hasReceivedInitialDMStateRef.current = true;

      // Применяем медиа
      if (state.media && state.media.type !== 'none') {
        const targetUrl = state.mediaDataUrl || state.media.url;
        if (targetUrl) {
          applyMedia(targetUrl, state.media.type, state.media.name, state.media.width, state.media.height);
          const autoVp = calculateAutoFit(state.media.width, state.media.height);
          setViewport(autoVp);
          reportViewportToDM(autoVp, state.media);
        }
      }

      // Применяем сетку
      if (state.grid) {
        setGrid(state.grid);
      }

      // Применяем туман
      isFogBaseFilledRef.current = state.fogBaseFilled;
      fogActionsHistoryRef.current = state.fogActions || [];
      if (fogEngineRef.current) {
        fogEngineRef.current.replayActions(fogActionsHistoryRef.current, state.fogBaseFilled);
      }

      // Применяем эффекты карты (Огонь, Вода, Газ, Зоны заклинаний)
      if (mapFxEngineRef.current) {
        if (state.mapFxStrokes) {
          mapFxEngineRef.current.setStrokes(state.mapFxStrokes);
        }
        if (state.spellZones) {
          mapFxEngineRef.current.setSpellZones(state.spellZones);
        }
      }

      // Применяем спроецированную карточку и карточки стола
      if (state.projectedCard !== undefined) {
        setProjectedCard(state.projectedCard);
      }
      if (state.pinnedTableCards) {
        setPinnedCards(state.pinnedTableCards);
      }
    } else if (msg.type === 'MAP_FX_STROKE') {
      const stroke = msg.payload;
      if (mapFxEngineRef.current) {
        const existingIdx = mapFxEngineRef.current.strokes.findIndex((s) => s.id === stroke.id);
        if (existingIdx >= 0) {
          mapFxEngineRef.current.strokes[existingIdx] = stroke;
        } else {
          mapFxEngineRef.current.addStroke(stroke);
        }
      }
    } else if (msg.type === 'MAP_FX_SYNC') {
      if (mapFxEngineRef.current) {
        mapFxEngineRef.current.setStrokes(msg.payload.strokes || []);
        mapFxEngineRef.current.setSpellZones(msg.payload.spellZones || []);
      }
    } else if (msg.type === 'MAP_FX_CLEAR') {
      if (mapFxEngineRef.current) {
        mapFxEngineRef.current.clearAll();
      }
    } else if (msg.type === 'LASER_SYNC') {
      if (mapFxEngineRef.current) {
        mapFxEngineRef.current.setLaser(msg.payload);
      }
    } else if (msg.type === 'ATTENTION_BEACON') {
      if (mapFxEngineRef.current) {
        mapFxEngineRef.current.addBeacon(msg.payload);
        playAttentionBeep(msg.payload.style || 'radar');
      }
    } else if (msg.type === 'PROJECT_CARD') {
      setProjectedCard(msg.payload.card);
    } else if (msg.type === 'TABLE_CARDS_SYNC') {
      setPinnedCards(msg.payload.cards);
    } else if (msg.type === 'SETTINGS_SYNC') {
      setProjectorSettings(msg.payload);
    } else if (msg.type === 'MEDIA_CHANGE') {
      const { media: newMedia, dataUrl } = msg.payload;
      const targetUrl = dataUrl || newMedia.url;
      if (targetUrl && newMedia.type !== 'none') {
        applyMedia(targetUrl, newMedia.type, newMedia.name, newMedia.width, newMedia.height);
        const autoVp = calculateAutoFit(newMedia.width, newMedia.height);
        setViewport(autoVp);
        reportViewportToDM(autoVp, newMedia);
      }
    } else if (msg.type === 'VIEWPORT_SYNC') {
      setViewport(msg.payload);
      reportViewportToDM(msg.payload, mediaRef.current);
    } else if (msg.type === 'FOG_ACTION') {
      const action = msg.payload;
      fogActionsHistoryRef.current.push(action);
      if (fogEngineRef.current) {
        if (action.type === 'stroke') {
          fogEngineRef.current.drawStroke(action);
        }
      }
    } else if (msg.type === 'FOG_RESET') {
      const { fill } = msg.payload;
      isFogBaseFilledRef.current = fill;
      fogActionsHistoryRef.current = [];
      if (fogEngineRef.current) {
        if (fill) {
          fogEngineRef.current.fillAll();
        } else {
          fogEngineRef.current.clearAll();
        }
      }
    } else if (msg.type === 'GRID_CONFIG') {
      setGrid(msg.payload);
    } else if (msg.type === 'PING') {
      const ping = msg.payload;
      setActivePings((p) => [...p, ping]);
      setTimeout(() => {
        setActivePings((p) => p.filter((item) => item.id !== ping.id));
      }, 2500);
    } else if (msg.type === 'HEARTBEAT') {
      setIsSyncConnected(true);
    }
  }, [applyMedia, calculateAutoFit, reportViewportToDM]);

  // 3. Инициализация синхронизации и отправка приветствия PLAYER_READY & REQUEST_FULL_STATE
  useEffect(() => {
    syncRef.current = new SyncController(handleIncomingMessage);

    // Уведомляем Мастера о готовности окна игроков и запрашиваем актуальное состояние
    syncRef.current.send({
      type: 'PLAYER_READY',
      timestamp: Date.now(),
    });
    syncRef.current.send({
      type: 'REQUEST_FULL_STATE',
      timestamp: Date.now(),
    });

    // Регулярный heartbeat
    const interval = setInterval(() => {
      syncRef.current?.send({
        type: 'HEARTBEAT',
        role: 'player',
        timestamp: Date.now(),
      });
      // Периодически подтверждаем размеры окна Мастеру
      reportViewportToDM(viewportRef.current, mediaRef.current);
    }, 3000);

    // Скрываем подсказку через 6 секунд
    const hintTimer = setTimeout(() => setShowHint(false), 6000);

    // Слушатель изменения размера окна
    const handleResize = () => {
      reportViewportToDM(viewportRef.current, mediaRef.current);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(interval);
      clearTimeout(hintTimer);
      window.removeEventListener('resize', handleResize);
      syncRef.current?.destroy();
      if (currentObjectUrlRef.current && currentObjectUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
      }
    };
  }, [handleIncomingMessage, reportViewportToDM]);

  // Переключение в полноэкранный режим с поддержкой Safari 13 / macOS 10.13
  const toggleFullScreen = () => {
    try {
      const doc = document as any;
      const docEl = document.documentElement as any;
      const isFullscreen =
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement;

      if (!isFullscreen) {
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen().catch(() => {});
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        } else if (docEl.webkitRequestFullScreen) {
          docEl.webkitRequestFullScreen();
        } else if (docEl.mozRequestFullScreen) {
          docEl.mozRequestFullScreen();
        }
      } else {
        if (doc.exitFullscreen) {
          doc.exitFullscreen().catch(() => {});
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        } else if (doc.webkitCancelFullScreen) {
          doc.webkitCancelFullScreen();
        } else if (doc.mozCancelFullScreen) {
          doc.mozCancelFullScreen();
        }
      }
    } catch {
      // Игнорируем ошибки ограничений политики безопасности iFrame/браузера
    }
  };

  // Горячая клавиша 'F' для Fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'f') {
        toggleFullScreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      id="player-app-container"
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden bg-[#090b10] text-[#E0E0E0] font-mono select-none cursor-default"
      onDoubleClick={toggleFullScreen}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Временная подсказка управления для проектора (High Density Badge) */}
      {showHint && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#12141a]/95 text-[#94a3b8] text-[11px] px-4 py-2 rounded-lg border border-[#262c3d] shadow-2xl flex items-center gap-3 pointer-events-none transition-opacity duration-1000 uppercase font-mono">
          <div className="flex items-center gap-1.5 text-[#38bdf8]">
            <Radio className="w-3.5 h-3.5 animate-pulse text-[#10b981]" />
            <span className="font-bold text-white">ПРОЕКТОР АКТИВЕН</span>
          </div>
          <span className="text-[#64748b]">|</span>
          <span className="flex items-center gap-1">
            <Maximize className="w-3.5 h-3.5 text-[#ff4e00]" />
            НАЖМИТЕ <strong className="text-white">F</strong> ДЛЯ FULLSCREEN
          </span>
        </div>
      )}

      {/* Трансформируемый слой проекции */}
      <div
        id="player-transform-layer"
        className="absolute origin-top-left will-change-transform"
        style={{
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0px) scale(${viewport.scale})`,
          width: `${media.width}px`,
          height: `${media.height}px`,
        }}
      >
        {/* Слой 1: Медиафайл (Изображение / Видео) */}
        {media.type === 'image' && media.url && (
          <img
            src={media.url}
            alt={media.name || 'Battle Map'}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            draggable={false}
            style={{
              filter: `brightness(${projectorSettings.brightness}) contrast(${projectorSettings.contrast}) ${
                projectorSettings.invertColors ? 'invert(1) hue-rotate(180deg)' : ''
              }`,
            }}
          />
        )}

        {media.type === 'video' && media.url && (
          <video
            src={media.url}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            style={{
              filter: `brightness(${projectorSettings.brightness}) contrast(${projectorSettings.contrast}) ${
                projectorSettings.invertColors ? 'invert(1) hue-rotate(180deg)' : ''
              }`,
            }}
          />
        )}

        {/* Слой 2: Тактическая сетка */}
        {grid.enabled && projectorSettings.showGridOnPlayer && (
          <div
            id="player-grid-overlay"
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(to right, ${grid.color} 1px, transparent 1px), linear-gradient(to bottom, ${grid.color} 1px, transparent 1px)`,
              backgroundSize: `${grid.size}px ${grid.size}px`,
              backgroundPosition: `${grid.offsetX}px ${grid.offsetY}px`,
              opacity: grid.opacity,
            }}
          />
        )}

        {/* Слой 3: Непрозрачный Туман Войны (100% Solid Black) */}
        <canvas
          id="player-fog-canvas"
          ref={fogCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ width: `${media.width}px`, height: `${media.height}px` }}
        />

        {/* Слой 4: Живые Эффекты Карты (Пожар, Вода, Газ, Лазер, Маяки внимания, Маркеры) */}
        <canvas
          id="player-map-fx-canvas"
          ref={mapFxCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          style={{ width: `${media.width}px`, height: `${media.height}px` }}
        />

        {/* Слой 5: Векторные пинги мастера */}
        {projectorSettings.showPingsOnPlayer && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
            {activePings.map((ping) => (
              <g key={ping.id} transform={`translate(${ping.x}, ${ping.y})`}>
                <circle r={24 / viewport.scale} fill="none" stroke={ping.color} strokeWidth={3.5 / viewport.scale}>
                  <animate attributeName="r" from="6" to={48 / viewport.scale} dur="1.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="1" to="0" dur="1.2s" repeatCount="indefinite" />
                </circle>
                <circle r={6 / viewport.scale} fill={ping.color} />
              </g>
            ))}
          </svg>
        )}
      </div>

      {/* Оверлей Блэкаута (Черный экран "Театр теней") */}
      {projectorSettings.blackout && (
        <div
          id="player-blackout-curtain"
          className="absolute inset-0 z-40 bg-black flex flex-col items-center justify-center text-zinc-600 transition-opacity duration-500"
        >
          <EyeOff className="w-12 h-12 mb-3 text-zinc-700 animate-pulse" />
          <span className="text-xs uppercase tracking-widest font-mono text-zinc-500">
            Сцена скрыта Мастером
          </span>
        </div>
      )}

      {/* Оверлей спроецированной карточки монстра/предмета/NPC/заклинания */}
      <PlayerCardOverlay card={projectedCard} onDismiss={() => setProjectedCard(null)} />
    </div>
  );
};
