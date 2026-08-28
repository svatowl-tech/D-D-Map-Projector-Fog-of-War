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
} from '@/lib/types';
import { SyncController } from '@/lib/sync';
import { FogEngine } from '@/lib/fog-engine';
import { PRESET_MAPS } from '@/lib/presets';
import { Maximize, RefreshCw, EyeOff } from 'lucide-react';

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

  // Ссылки на DOM и движок тумана
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fogEngineRef = useRef<FogEngine | null>(null);
  const syncRef = useRef<SyncController | null>(null);
  const isFogBaseFilledRef = useRef<boolean>(true);
  const fogActionsHistoryRef = useRef<FogAction[]>([]);

  // 1. Инициализация движка 100% непрозрачного тумана
  useEffect(() => {
    if (fogCanvasRef.current) {
      // isDM = false -> непрозрачный туман
      fogEngineRef.current = new FogEngine(fogCanvasRef.current, false);
      fogEngineRef.current.resize(media.width, media.height);
      if (isFogBaseFilledRef.current) {
        fogEngineRef.current.fillAll();
      }
    }
  }, []);

  // Функция применения медиафайла
  const applyMedia = useCallback((
    url: string,
    type: 'image' | 'video',
    name: string,
    width: number = 1600,
    height: number = 1200
  ) => {
    if (currentObjectUrlRef.current && currentObjectUrlRef.current !== url && currentObjectUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }
    if (url.startsWith('blob:')) {
      currentObjectUrlRef.current = url;
    }

    setMedia({
      type,
      url,
      name,
      width,
      height,
      aspectRatio: width / height,
    });

    if (fogEngineRef.current && fogCanvasRef.current) {
      fogEngineRef.current.resize(width, height);
      if (isFogBaseFilledRef.current) {
        fogEngineRef.current.fillAll();
      }
    }
  }, []);

  // 2. Обработчик сообщений от Мастера
  const handleIncomingMessage = useCallback((msg: SyncMessage) => {
    if (msg.type === 'DM_STATE_FULL') {
      const state: DMFullState = msg.payload;
      setIsSyncConnected(true);

      // Применяем медиа
      if (state.media && state.media.type !== 'none') {
        const targetUrl = state.mediaDataUrl || state.media.url;
        if (targetUrl) {
          applyMedia(targetUrl, state.media.type, state.media.name, state.media.width, state.media.height);
        }
      }

      // Применяем камеру и сетку
      if (state.viewport) setViewport(state.viewport);
      if (state.grid) setGrid(state.grid);

      // Применяем туман
      isFogBaseFilledRef.current = state.fogBaseFilled;
      fogActionsHistoryRef.current = state.fogActions || [];
      if (fogEngineRef.current) {
        fogEngineRef.current.replayActions(fogActionsHistoryRef.current, state.fogBaseFilled);
      }
    } else if (msg.type === 'MEDIA_CHANGE') {
      const { media: newMedia, dataUrl } = msg.payload;
      const targetUrl = dataUrl || newMedia.url;
      if (targetUrl && newMedia.type !== 'none') {
        applyMedia(targetUrl, newMedia.type, newMedia.name, newMedia.width, newMedia.height);
      }
    } else if (msg.type === 'VIEWPORT_SYNC') {
      setViewport(msg.payload);
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
  }, [applyMedia]);

  // 3. Инициализация синхронизации и отправка приветствия PLAYER_READY
  useEffect(() => {
    syncRef.current = new SyncController(handleIncomingMessage);

    // Уведомляем Мастера о готовности окна игроков
    syncRef.current.send({
      type: 'PLAYER_READY',
      timestamp: Date.now(),
    });

    // Регулярный heartbeat
    const interval = setInterval(() => {
      syncRef.current?.send({
        type: 'HEARTBEAT',
        role: 'player',
        timestamp: Date.now(),
      });
    }, 3000);

    // Скрываем подсказку через 6 секунд
    const hintTimer = setTimeout(() => setShowHint(false), 6000);

    return () => {
      clearInterval(interval);
      clearTimeout(hintTimer);
      syncRef.current?.destroy();
      if (currentObjectUrlRef.current && currentObjectUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
      }
    };
  }, [handleIncomingMessage]);

  // Переключение в полноэкранный режим
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
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
      className="relative w-screen h-screen overflow-hidden bg-[#000] text-[#E0E0E0] font-mono select-none cursor-default"
      onDoubleClick={toggleFullScreen}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Временная подсказка управления для проектора (High Density Badge) */}
      {showHint && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#121212]/90 text-[#888] text-[11px] px-3.5 py-1.5 rounded border border-[#2A2A2A] shadow-2xl flex items-center gap-2 pointer-events-none transition-opacity duration-1000 uppercase font-mono">
          <Maximize className="w-3.5 h-3.5 text-[#FF4E00]" />
          <span>
            PLAYER VIEW ACTIVE // PRESS <strong className="text-[#FF4E00]">F</strong> OR DOUBLE-CLICK FOR FULLSCREEN
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
            alt="Map"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            draggable={false}
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
          />
        )}

        {/* Слой 2: Тактическая сетка */}
        {grid.enabled && (
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

        {/* Слой 4: Векторные пинги мастера */}
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
      </div>
    </div>
  );
};
