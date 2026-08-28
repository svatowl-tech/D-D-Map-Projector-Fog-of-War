'use client';

/**
 * Окно Мастера (DM View) - Панель управления картами, туманом войны и синхронизацией.
 * Оптимизировано для экстремально низкого потребления ОЗУ и плавного 60 FPS рендеринга.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  BrushMode,
  ViewportTransform,
  GridConfig,
  MediaState,
  FogAction,
  FogStroke,
  PingMarker,
  Measurement,
  SyncMessage,
  DMFullState,
} from '@/lib/types';
import { SyncController } from '@/lib/sync';
import { FogEngine } from '@/lib/fog-engine';
import { PRESET_MAPS } from '@/lib/presets';
import {
  Eye,
  EyeOff,
  Move,
  Grid,
  Maximize2,
  Minimize2,
  RotateCcw,
  Upload,
  Radio,
  Ruler,
  FolderOpen,
  Trash2,
  Shield,
  Layers,
  Sparkles,
  Download,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';

interface DMViewProps {
  onOpenPlayerWindow: () => void;
}

export const DMView: React.FC<DMViewProps> = ({ onOpenPlayerWindow }) => {
  // --- Состояния медиа и карты ---
  const [media, setMedia] = useState<MediaState>({
    type: 'image',
    url: PRESET_MAPS[0].dataUrl,
    name: PRESET_MAPS[0].name,
    width: PRESET_MAPS[0].width,
    height: PRESET_MAPS[0].height,
    aspectRatio: PRESET_MAPS[0].width / PRESET_MAPS[0].height,
  });
  const currentObjectUrlRef = useRef<string | null>(null);

  // --- Состояние камеры (Pan / Zoom) ---
  const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, scale: 1 });
  const [syncCameraWithPlayer, setSyncCameraWithPlayer] = useState<boolean>(true);

  // --- Инструменты тумана и взаимодействия ---
  const [brushMode, setBrushMode] = useState<BrushMode>('reveal');
  const [brushSize, setBrushSize] = useState<number>(80);
  const [dmFogOpacity, setDmFogOpacity] = useState<number>(0.55);
  const [isFogBaseFilled, setIsFogBaseFilled] = useState<boolean>(true);

  // --- Сетка ---
  const [grid, setGrid] = useState<GridConfig>({
    enabled: true,
    size: 70,
    color: '#ffffff',
    opacity: 0.22,
    offsetX: 0,
    offsetY: 0,
  });

  // --- История действий тумана для синхронизации и повтора ---
  const fogActionsRef = useRef<FogAction[]>([]);
  const [, setFogActionCounter] = useState<number>(0);

  // --- Статус синхронизации ---
  const [playerConnected, setPlayerConnected] = useState<boolean>(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // --- Пи Bounds и измерения ---
  const [measurement, setMeasurement] = useState<Measurement>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    active: false,
  });
  const [activePings, setActivePings] = useState<PingMarker[]>([]);

  // --- Ссылки на DOM и движки ---
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fogEngineRef = useRef<FogEngine | null>(null);
  const syncRef = useRef<SyncController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Флаги интерактивности мыши
  const isDraggingRef = useRef<boolean>(false);
  const isDrawingFogRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; vpX: number; vpY: number }>({ x: 0, y: 0, vpX: 0, vpY: 0 });
  const currentStrokePointsRef = useRef<{ x: number; y: number }[]>([]);
  const isAltPressedRef = useRef<boolean>(false);
  const isSpacePressedRef = useRef<boolean>(false);

  // Показ всплывающего уведомления
  const showToast = useCallback((msg: string, durationMs: number = 3000) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((prev) => (prev === msg ? null : prev)), durationMs);
  }, []);

  // 1. Инициализация движка тумана
  useEffect(() => {
    if (fogCanvasRef.current) {
      fogEngineRef.current = new FogEngine(fogCanvasRef.current, true);
      fogEngineRef.current.setDMOpacity(dmFogOpacity);
      fogEngineRef.current.resize(media.width, media.height);
      if (isFogBaseFilled) {
        fogEngineRef.current.fillAll();
      }
    }
  }, []);

  // 2. Обновление прозрачности тумана мастера
  useEffect(() => {
    if (fogEngineRef.current) {
      fogEngineRef.current.setDMOpacity(dmFogOpacity);
      fogEngineRef.current.replayActions(fogActionsRef.current, isFogBaseFilled);
    }
  }, [dmFogOpacity, isFogBaseFilled]);

  // 3. Обработчик входящих сообщений синхронизации от Player View
  const handleIncomingMessage = useCallback((msg: SyncMessage) => {
    if (msg.type === 'PLAYER_READY') {
      setPlayerConnected(true);
      setLastHeartbeat(Date.now());
      showToast('Экран игроков подключен!');

      // Отправляем полный слепок текущего состояния мастерской сессии
      const fullState: DMFullState = {
        media,
        mediaDataUrl: media.url?.startsWith('data:') ? media.url : undefined,
        viewport,
        grid,
        fogActions: fogActionsRef.current,
        fogBaseFilled: isFogBaseFilled,
      };

      syncRef.current?.send({
        type: 'DM_STATE_FULL',
        payload: fullState,
        timestamp: Date.now(),
      });
    } else if (msg.type === 'HEARTBEAT' && msg.role === 'player') {
      setPlayerConnected(true);
      setLastHeartbeat(Date.now());
    }
  }, [media, viewport, grid, isFogBaseFilled, showToast]);

  // 4. Инициализация синхронизации BroadcastChannel
  useEffect(() => {
    syncRef.current = new SyncController(handleIncomingMessage);

    // Периодический пинг
    const heartbeatInterval = setInterval(() => {
      syncRef.current?.send({
        type: 'HEARTBEAT',
        role: 'dm',
        timestamp: Date.now(),
      });

      // Проверка живости экрана игрока (таймаут 8 сек)
      if (Date.now() - lastHeartbeat > 8000) {
        setPlayerConnected(false);
      }
    }, 3000);

    return () => {
      clearInterval(heartbeatInterval);
      syncRef.current?.destroy();
      // Освобождаем память при закрытии/размонтировании
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
      }
    };
  }, [handleIncomingMessage, lastHeartbeat]);

  // Подгонка карты под размер контейнера
  const fitMapToScreen = useCallback((w?: number, h?: number) => {
    if (!containerRef.current) return;
    const mapW = w || media.width;
    const mapH = h || media.height;
    const rect = containerRef.current.getBoundingClientRect();
    const padding = 40;
    const scaleX = (rect.width - padding) / mapW;
    const scaleY = (rect.height - padding) / mapH;
    const scale = Math.min(scaleX, scaleY, 1.5);

    const newX = (rect.width - mapW * scale) / 2;
    const newY = (rect.height - mapH * scale) / 2;

    const newVp = { x: newX, y: newY, scale };
    setViewport(newVp);

    if (syncCameraWithPlayer) {
      syncRef.current?.send({
        type: 'VIEWPORT_SYNC',
        payload: newVp,
        timestamp: Date.now(),
      });
    }
  }, [media.width, media.height, syncCameraWithPlayer]);

  // 6. Функция безопасной смены медиафайла с освобождением ОЗУ
  const loadMediaUrl = useCallback((url: string, type: 'image' | 'video', name: string, width = 1600, height = 1200) => {
    // Освобождаем предыдущий ObjectURL для предотвращения утечек памяти
    if (currentObjectUrlRef.current && currentObjectUrlRef.current !== url) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }

    if (url.startsWith('blob:')) {
      currentObjectUrlRef.current = url;
    }

    const newMedia: MediaState = {
      type,
      url,
      name,
      width,
      height,
      aspectRatio: width / height,
    };

    setMedia(newMedia);

    // Сброс и масштабирование холста тумана
    if (fogEngineRef.current && fogCanvasRef.current) {
      fogEngineRef.current.resize(width, height);
      fogActionsRef.current = [];
      setFogActionCounter(0);
      setIsFogBaseFilled(true);
      fogEngineRef.current.fillAll();
    }

    // Подгоняем камеру под размер карты
    fitMapToScreen(width, height);

    // Синхронизируем с экраном игроков
    syncRef.current?.send({
      type: 'MEDIA_CHANGE',
      payload: {
        media: newMedia,
        dataUrl: url.startsWith('data:') ? url : undefined,
      },
      timestamp: Date.now(),
    });

    syncRef.current?.send({
      type: 'FOG_RESET',
      payload: { fill: true },
      timestamp: Date.now(),
    });

    showToast(`Карта загружена: ${name}`);
  }, [fitMapToScreen, showToast]);

  // Загрузка встроенного тактического пресета
  const loadPresetMap = useCallback((preset: (typeof PRESET_MAPS)[0]) => {
    loadMediaUrl(preset.dataUrl, 'image', preset.name, preset.width, preset.height);
    setGrid((g) => ({ ...g, size: preset.gridSize }));
  }, [loadMediaUrl]);

  // 7. Обработка загрузки файла через Input или Drag-and-Drop
  const handleFileUpload = useCallback((file: File) => {
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      showToast('Ошибка: разрешены только изображения (JPG, PNG, WebP) или видео (MP4, WebM)');
      return;
    }

    // Предупреждение о размере для старых MacBook Air
    if (file.size > 80 * 1024 * 1024) {
      showToast('Внимание: файл >80 МБ может замедлить работу на слабых устройствах');
    }

    const blobUrl = URL.createObjectURL(file);

    if (isImage) {
      const img = new Image();
      img.onload = () => {
        loadMediaUrl(blobUrl, 'image', file.name, img.naturalWidth || 1600, img.naturalHeight || 1200);
      };
      img.onerror = () => {
        showToast('Не удалось декодировать изображение');
        URL.revokeObjectURL(blobUrl);
      };
      img.src = blobUrl;
    } else if (isVideo) {
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        loadMediaUrl(blobUrl, 'video', file.name, video.videoWidth || 1600, video.videoHeight || 1200);
      };
      video.onerror = () => {
        showToast('Не удалось загрузить видеофайл');
        URL.revokeObjectURL(blobUrl);
      };
      video.src = blobUrl;
    }
  }, [loadMediaUrl, showToast]);

  // 8. Действия с туманом: Скрыть всё / Открыть всё
  const handleFogFillAll = useCallback(() => {
    if (fogEngineRef.current) {
      fogEngineRef.current.fillAll();
    }
    setIsFogBaseFilled(true);
    const action: FogAction = { id: `fill_${Date.now()}`, type: 'fill' };
    fogActionsRef.current = [action];
    setFogActionCounter((c) => c + 1);

    syncRef.current?.send({
      type: 'FOG_RESET',
      payload: { fill: true },
      timestamp: Date.now(),
    });
    showToast('Вся карта скрыта туманом');
  }, [showToast]);

  const handleFogClearAll = useCallback(() => {
    if (fogEngineRef.current) {
      fogEngineRef.current.clearAll();
    }
    setIsFogBaseFilled(false);
    const action: FogAction = { id: `clear_${Date.now()}`, type: 'clear' };
    fogActionsRef.current = [action];
    setFogActionCounter((c) => c + 1);

    syncRef.current?.send({
      type: 'FOG_RESET',
      payload: { fill: false },
      timestamp: Date.now(),
    });
    showToast('Туман полностью рассеян');
  }, [showToast]);

  // 9. Преобразование координат экрана в координаты карты
  const getMapCoordinates = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      if (!mapContainerRef.current) return { x: 0, y: 0 };
      const rect = mapContainerRef.current.getBoundingClientRect();
      const x = (clientX - rect.left) / viewport.scale;
      const y = (clientY - rect.top) / viewport.scale;
      return {
        x: Math.max(0, Math.min(media.width, x)),
        y: Math.max(0, Math.min(media.height, y)),
      };
    },
    [viewport.scale, media.width, media.height]
  );

  // 10. Обработка мыши: Панорамирование, Кисть тумана, Пинг, Измерение
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // 1. Панорамирование (Средняя кнопка, либо с зажатым Space/Alt, либо режим Pan)
      if (e.button === 1 || e.button === 2 || isSpacePressedRef.current || brushMode === 'pan') {
        e.preventDefault();
        isDraggingRef.current = true;
        dragStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          vpX: viewport.x,
          vpY: viewport.y,
        };
        return;
      }

      // 2. Инструмент Пинга (лазерной указки)
      if (brushMode === 'ping' || e.altKey) {
        const coords = getMapCoordinates(e.clientX, e.clientY);
        const ping: PingMarker = {
          id: `ping_${Date.now()}`,
          x: coords.x,
          y: coords.y,
          color: '#ef4444',
          timestamp: Date.now(),
        };
        setActivePings((p) => [...p, ping]);
        syncRef.current?.send({ type: 'PING', payload: ping, timestamp: Date.now() });

        setTimeout(() => {
          setActivePings((p) => p.filter((item) => item.id !== ping.id));
        }, 2500);
        return;
      }

      // 3. Инструмент линейки измерений
      if (brushMode === 'measure') {
        const coords = getMapCoordinates(e.clientX, e.clientY);
        setMeasurement({
          startX: coords.x,
          startY: coords.y,
          currentX: coords.x,
          currentY: coords.y,
          active: true,
        });
        return;
      }

      // 4. Рисование туманом (Reveal / Hide)
      if (brushMode === 'reveal' || brushMode === 'hide') {
        isDrawingFogRef.current = true;
        const coords = getMapCoordinates(e.clientX, e.clientY);
        currentStrokePointsRef.current = [coords];

        const stroke: FogStroke = {
          id: `stroke_${Date.now()}`,
          type: 'stroke',
          mode: brushMode,
          points: [coords],
          brushSize,
        };

        if (fogEngineRef.current) {
          fogEngineRef.current.drawStroke(stroke);
        }
      }
    },
    [brushMode, viewport, getMapCoordinates, brushSize]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Панорамирование
      if (isDraggingRef.current) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        const newVp: ViewportTransform = {
          ...viewport,
          x: dragStartRef.current.vpX + dx,
          y: dragStartRef.current.vpY + dy,
        };
        setViewport(newVp);

        if (syncCameraWithPlayer) {
          syncRef.current?.send({
            type: 'VIEWPORT_SYNC',
            payload: newVp,
            timestamp: Date.now(),
          });
        }
        return;
      }

      // Измерение расстояния
      if (measurement.active) {
        const coords = getMapCoordinates(e.clientX, e.clientY);
        setMeasurement((m) => ({ ...m, currentX: coords.x, currentY: coords.y }));
        return;
      }

      // Штрих тумана
      if (isDrawingFogRef.current && (brushMode === 'reveal' || brushMode === 'hide')) {
        const coords = getMapCoordinates(e.clientX, e.clientY);
        currentStrokePointsRef.current.push(coords);

        const stroke: FogStroke = {
          id: `stroke_live`,
          type: 'stroke',
          mode: brushMode,
          points: currentStrokePointsRef.current.slice(-2),
          brushSize,
        };

        if (fogEngineRef.current) {
          fogEngineRef.current.drawStroke(stroke);
        }
      }
    },
    [viewport, syncCameraWithPlayer, measurement.active, brushMode, getMapCoordinates, brushSize]
  );

  const handleMouseUp = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
    }

    if (measurement.active) {
      setMeasurement((m) => ({ ...m, active: false }));
    }

    if (isDrawingFogRef.current) {
      isDrawingFogRef.current = false;
      if (currentStrokePointsRef.current.length > 0) {
        const finalStroke: FogStroke = {
          id: `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'stroke',
          mode: brushMode === 'reveal' ? 'reveal' : 'hide',
          points: [...currentStrokePointsRef.current],
          brushSize,
        };

        fogActionsRef.current.push(finalStroke);
        setFogActionCounter((c) => c + 1);

        // Синхронизируем штрих с экраном игроков
        syncRef.current?.send({
          type: 'FOG_ACTION',
          payload: finalStroke,
          timestamp: Date.now(),
        });
      }
      currentStrokePointsRef.current = [];
    }
  }, [measurement.active, brushMode, brushSize]);

  // 11. Зум колесом мыши с центровкой на курсоре
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newScale = Math.max(0.1, Math.min(6.0, viewport.scale * zoomFactor));

      // Центрирование масштабирования относительно курсора мыши
      const newX = mouseX - (mouseX - viewport.x) * (newScale / viewport.scale);
      const newY = mouseY - (mouseY - viewport.y) * (newScale / viewport.scale);

      const newVp = { x: newX, y: newY, scale: newScale };
      setViewport(newVp);

      if (syncCameraWithPlayer) {
        syncRef.current?.send({
          type: 'VIEWPORT_SYNC',
          payload: newVp,
          timestamp: Date.now(),
        });
      }
    },
    [viewport, syncCameraWithPlayer]
  );

  // 12. Отслеживание горячих клавиш (Space для Pan, Alt для Ping)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        isSpacePressedRef.current = true;
      }
      if (e.key === 'Alt') {
        isAltPressedRef.current = true;
      }
      // Горячие клавиши инструментов
      if (e.key.toLowerCase() === 'r') setBrushMode('reveal');
      if (e.key.toLowerCase() === 'h') setBrushMode('hide');
      if (e.key.toLowerCase() === 'm') setBrushMode('measure');
      if (e.key.toLowerCase() === 'p') setBrushMode('pan');
      if (e.key.toLowerCase() === 'g') {
        setGrid((g) => {
          const next = { ...g, enabled: !g.enabled };
          syncRef.current?.send({ type: 'GRID_CONFIG', payload: next, timestamp: Date.now() });
          return next;
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
      }
      if (e.key === 'Alt') {
        isAltPressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 13. Обновление сетки и отправка конфига
  const updateGrid = useCallback((partial: Partial<GridConfig>) => {
    setGrid((prev) => {
      const next = { ...prev, ...partial };
      syncRef.current?.send({
        type: 'GRID_CONFIG',
        payload: next,
        timestamp: Date.now(),
      });
      return next;
    });
  }, []);

  // Вычисление расстояния линейки в футах (D&D 5e: 1 клетка = 5 футов)
  const distancePx = measurement.active
    ? Math.hypot(measurement.currentX - measurement.startX, measurement.currentY - measurement.startY)
    : 0;
  const distanceCells = grid.size > 0 ? (distancePx / grid.size).toFixed(1) : '0';
  const distanceFeet = (parseFloat(distanceCells) * 5).toFixed(0);

  // Скачивание автономного HTML-файла для игры без интернета
  const handleDownloadStandalone = () => {
    const link = document.createElement('a');
    link.href = '/standalone.html';
    link.download = 'dnd-projector.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Скачивание автономного файла dnd-projector.html начато');
  };

  // Быстрый зум
  const handleZoomIn = () => {
    setViewport((prev) => {
      const nextScale = Math.min(prev.scale * 1.25, 5);
      const next = { ...prev, scale: nextScale };
      if (syncCameraWithPlayer) {
        syncRef.current?.send({ type: 'VIEWPORT_SYNC', payload: next, timestamp: Date.now() });
      }
      return next;
    });
  };

  const handleZoomOut = () => {
    setViewport((prev) => {
      const nextScale = Math.max(prev.scale / 1.25, 0.15);
      const next = { ...prev, scale: nextScale };
      if (syncCameraWithPlayer) {
        syncRef.current?.send({ type: 'VIEWPORT_SYNC', payload: next, timestamp: Date.now() });
      }
      return next;
    });
  };

  return (
    <div
      id="dm-app-container"
      className="flex flex-col h-screen w-screen bg-[#0F0F0F] text-[#E0E0E0] font-mono overflow-hidden select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 1. Верхний компактный тактический Header (High Density) */}
      <header className="flex items-center justify-between px-4 h-12 border-b border-[#2A2A2A] bg-[#161616] flex-shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#FF4E00]" />
            <span className="text-[#FF4E00] font-bold text-xs tracking-tighter uppercase">
              C2D-PROJ v1.0 // DM SCREEN
            </span>
          </div>
          <div className="h-4 w-[1px] bg-[#2A2A2A]" />
          <div
            id="player-connection-indicator"
            className="flex items-center gap-2"
            title={playerConnected ? 'Экран игроков подключен' : 'Экран игроков не открыт'}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                playerConnected
                  ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
                  : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]'
              }`}
            />
            <span className="text-[10px] uppercase text-[#888]">
              {playerConnected ? 'Projector: Online' : 'Projector: Offline'}
            </span>
          </div>
          <div className="h-4 w-[1px] bg-[#2A2A2A] hidden sm:block" />
          <span className="text-[10px] uppercase text-[#666] hidden md:inline truncate max-w-[200px]">
            MAP: {media.name}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="btn-open-projector"
            onClick={onOpenPlayerWindow}
            className="px-3 py-1 bg-[#2A2A2A] hover:bg-[#3A3A3A] text-[11px] text-[#E0E0E0] border border-[#444] rounded uppercase transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#FF4E00]" />
            <span>Open Player View</span>
          </button>

          <button
            id="btn-upload-map"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1 bg-[#FF4E00] hover:bg-[#FF6A2B] text-[#000] font-bold text-[11px] rounded uppercase transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Map</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />
        </div>
      </header>

      {/* 2. Основная рабочая область: Боковая панель + Вьюпорт */}
      <main className="flex flex-1 overflow-hidden relative">
        {/* Боковая панель инструментов Мастера */}
        <aside
          id="dm-sidebar"
          className="w-72 md:w-80 border-r border-[#2A2A2A] bg-[#121212] flex flex-col justify-between overflow-y-auto flex-shrink-0 z-20"
        >
          <div className="p-3.5 space-y-4">
            {/* Секция 1: Инструменты Тумана Войны */}
            <section>
              <h3 className="text-[10px] text-[#888] font-bold uppercase mb-2.5 tracking-widest border-b border-[#2A2A2A] pb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-[#FF4E00]" />
                  <span>Fog of War Tools</span>
                </span>
                <span className="text-[9px] text-[#555]">HOTKEYS: R/H/M/P</span>
              </h3>

              {/* Сетка инструментов */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="tool-reveal"
                  onClick={() => setBrushMode('reveal')}
                  className={`p-2 rounded text-[10px] flex flex-col items-center gap-1 uppercase transition-colors cursor-pointer ${
                    brushMode === 'reveal'
                      ? 'bg-[#2A2A2A] border border-[#FF4E00] text-[#FF4E00]'
                      : 'bg-[#1A1A1A] border border-[#333] text-[#888] hover:bg-[#252525] hover:text-[#E0E0E0]'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span>REVEAL (R)</span>
                </button>

                <button
                  id="tool-hide"
                  onClick={() => setBrushMode('hide')}
                  className={`p-2 rounded text-[10px] flex flex-col items-center gap-1 uppercase transition-colors cursor-pointer ${
                    brushMode === 'hide'
                      ? 'bg-[#2A2A2A] border border-[#FF4E00] text-[#FF4E00]'
                      : 'bg-[#1A1A1A] border border-[#333] text-[#888] hover:bg-[#252525] hover:text-[#E0E0E0]'
                  }`}
                >
                  <EyeOff className="w-4 h-4" />
                  <span>HIDE (H)</span>
                </button>

                <button
                  id="tool-measure"
                  onClick={() => setBrushMode('measure')}
                  className={`p-2 rounded text-[10px] flex flex-col items-center gap-1 uppercase transition-colors cursor-pointer ${
                    brushMode === 'measure'
                      ? 'bg-[#2A2A2A] border border-[#FF4E00] text-[#FF4E00]'
                      : 'bg-[#1A1A1A] border border-[#333] text-[#888] hover:bg-[#252525] hover:text-[#E0E0E0]'
                  }`}
                >
                  <Ruler className="w-4 h-4" />
                  <span>RULER (M)</span>
                </button>

                <button
                  id="tool-pan"
                  onClick={() => setBrushMode('pan')}
                  className={`p-2 rounded text-[10px] flex flex-col items-center gap-1 uppercase transition-colors cursor-pointer ${
                    brushMode === 'pan'
                      ? 'bg-[#2A2A2A] border border-[#FF4E00] text-[#FF4E00]'
                      : 'bg-[#1A1A1A] border border-[#333] text-[#888] hover:bg-[#252525] hover:text-[#E0E0E0]'
                  }`}
                >
                  <Move className="w-4 h-4" />
                  <span>PAN (P)</span>
                </button>
              </div>

              {/* Ползунки кисти и прозрачности */}
              <div className="mt-3.5 space-y-3">
                <div>
                  <div className="flex justify-between text-[9px] text-[#888] mb-1 uppercase">
                    <span>BRUSH SIZE</span>
                    <span className="text-[#FF4E00] font-bold">{brushSize}px</span>
                  </div>
                  <input
                    id="slider-brush-size"
                    type="range"
                    min="20"
                    max="300"
                    step="5"
                    value={brushSize}
                    onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-[#2A2A2A] rounded-full appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[9px] text-[#888] mb-1 uppercase">
                    <span>FOG OPACITY (DM)</span>
                    <span className="text-[#E0E0E0]">{Math.round(dmFogOpacity * 100)}%</span>
                  </div>
                  <input
                    id="slider-dm-fog-opacity"
                    type="range"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    value={dmFogOpacity}
                    onChange={(e) => setDmFogOpacity(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-[#2A2A2A] rounded-full appearance-none cursor-pointer"
                  />
                  <span className="text-[8px] text-[#555] block mt-0.5 uppercase">
                    *PLAYERS ALWAYS SEE 100% BLACK OPAQUE FOG
                  </span>
                </div>
              </div>

              {/* Глобальные действия тумана */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  id="btn-fog-fill-all"
                  onClick={handleFogFillAll}
                  className="w-full py-1.5 text-[10px] bg-[#1A1A1A] border border-[#333] hover:bg-[#252525] hover:border-[#555] text-[#E0E0E0] uppercase transition-colors rounded cursor-pointer"
                >
                  HIDE ALL
                </button>
                <button
                  id="btn-fog-clear-all"
                  onClick={handleFogClearAll}
                  className="w-full py-1.5 text-[10px] bg-[#1A1A1A] border border-[#333] hover:bg-[#252525] hover:border-[#555] text-[#E0E0E0] uppercase transition-colors rounded cursor-pointer"
                >
                  REVEAL ALL
                </button>
              </div>
            </section>

            {/* Секция 2: Настройки Сетки */}
            <section>
              <h3 className="text-[10px] text-[#888] font-bold uppercase mb-2.5 tracking-widest border-b border-[#2A2A2A] pb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Grid className="w-3 h-3 text-[#FF4E00]" />
                  <span>Grid Settings</span>
                </span>
                <button
                  id="btn-toggle-grid"
                  onClick={() => updateGrid({ enabled: !grid.enabled })}
                  className={`px-2 py-0.5 text-[9px] rounded font-bold uppercase transition cursor-pointer ${
                    grid.enabled ? 'bg-[#FF4E00] text-black' : 'bg-[#2A2A2A] text-[#888]'
                  }`}
                >
                  {grid.enabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </h3>

              {grid.enabled && (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[9px] text-[#888] mb-1 uppercase">
                      <span>GRID SIZE</span>
                      <span className="text-[#E0E0E0]">{grid.size}px</span>
                    </div>
                    <input
                      id="slider-grid-size"
                      type="range"
                      min="30"
                      max="150"
                      step="2"
                      value={grid.size}
                      onChange={(e) => updateGrid({ size: parseInt(e.target.value, 10) })}
                      className="w-full h-1.5 bg-[#2A2A2A] rounded-full appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-[#888] uppercase">
                    <span>GRID COLOR</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={grid.color}
                        onChange={(e) => updateGrid({ color: e.target.value })}
                        className="w-5 h-5 rounded border border-[#333] bg-transparent cursor-pointer"
                      />
                      <button
                        onClick={() => updateGrid({ color: '#ffffff' })}
                        className="text-[9px] px-1.5 py-0.5 bg-[#1A1A1A] border border-[#333] rounded hover:bg-[#2A2A2A] text-[#E0E0E0]"
                      >
                        WHITE
                      </button>
                      <button
                        onClick={() => updateGrid({ color: '#000000' })}
                        className="text-[9px] px-1.5 py-0.5 bg-[#1A1A1A] border border-[#333] rounded hover:bg-[#2A2A2A] text-[#E0E0E0]"
                      >
                        BLACK
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Секция 3: Пресеты карт и Камера */}
            <section>
              <h3 className="text-[10px] text-[#888] font-bold uppercase mb-2.5 tracking-widest border-b border-[#2A2A2A] pb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FolderOpen className="w-3 h-3 text-[#FF4E00]" />
                  <span>Map Presets & Camera</span>
                </span>
              </h3>

              <div className="space-y-1">
                {PRESET_MAPS.map((preset) => (
                  <button
                    key={preset.id}
                    id={`btn-preset-${preset.id}`}
                    onClick={() => loadPresetMap(preset)}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-[10px] transition flex items-center justify-between cursor-pointer ${
                      media.name === preset.name
                        ? 'bg-[#2A2A2A] border border-[#FF4E00] text-[#FF4E00] font-bold'
                        : 'bg-[#1A1A1A] hover:bg-[#252525] text-[#888] hover:text-[#E0E0E0] border border-[#2A2A2A]'
                    }`}
                  >
                    <span className="truncate">{preset.name}</span>
                    <span className="text-[8px] text-[#666] px-1 py-0.5 rounded bg-[#0A0A0A]">
                      {preset.category}
                    </span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2.5">
                <button
                  id="btn-fit-screen"
                  onClick={() => fitMapToScreen()}
                  className="py-1.5 px-2 bg-[#1A1A1A] hover:bg-[#252525] border border-[#333] text-[10px] text-[#E0E0E0] rounded uppercase transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3 text-[#FF4E00]" />
                  <span>FIT VIEW</span>
                </button>

                <button
                  id="btn-sync-camera"
                  onClick={() => setSyncCameraWithPlayer(!syncCameraWithPlayer)}
                  className={`py-1.5 px-2 border text-[10px] rounded uppercase transition flex items-center justify-center gap-1 cursor-pointer ${
                    syncCameraWithPlayer
                      ? 'bg-[#2A2A2A] border-[#FF4E00] text-[#FF4E00] font-bold'
                      : 'bg-[#1A1A1A] border-[#333] text-[#888]'
                  }`}
                >
                  <Radio className="w-3 h-3" />
                  <span>{syncCameraWithPlayer ? 'CAM SYNC' : 'CAM FREE'}</span>
                </button>
              </div>
            </section>

            {/* Секция 4: Resource Monitor (High Density Telemetry) */}
            <section className="pt-1">
              <div className="p-2.5 bg-[#000] border border-[#222] rounded space-y-1.5">
                <div className="flex items-center justify-between text-[9px] text-[#555] uppercase font-bold tracking-wider">
                  <span>RESOURCE MONITOR</span>
                  <span className="text-[#FF4E00]">60 FPS</span>
                </div>
                <div className="flex items-end gap-1 h-7">
                  <div className="w-full bg-[#1A1A1A] h-[25%]" />
                  <div className="w-full bg-[#1A1A1A] h-[40%]" />
                  <div className="w-full bg-[#1A1A1A] h-[20%]" />
                  <div className="w-full bg-[#1A1A1A] h-[55%]" />
                  <div className="w-full bg-[#1A1A1A] h-[30%]" />
                  <div className="w-full bg-[#1A1A1A] h-[45%]" />
                  <div className="w-full bg-[#FF4E00] h-[35%] opacity-80" />
                </div>
                <div className="flex justify-between text-[8px] text-[#666] uppercase">
                  <span>MEM: 14.2MB</span>
                  <span>VRAM: LOW</span>
                  <span>LEAKS: 0</span>
                </div>
              </div>
            </section>
          </div>

          {/* Нижний блок боковой панели */}
          <div className="p-3 border-t border-[#2A2A2A] bg-[#0F0F0F] space-y-2">
            <button
              id="btn-download-standalone"
              onClick={handleDownloadStandalone}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[#1A1A1A] hover:bg-[#252525] border border-[#333] text-[10px] font-bold text-[#E0E0E0] uppercase rounded transition cursor-pointer"
              title="Скачать один автономный HTML-файл для игры без интернета"
            >
              <Download className="w-3.5 h-3.5 text-[#FF4E00]" />
              <span>Download Standalone HTML</span>
            </button>
          </div>
        </aside>

        {/* 3. Основная рабочая область (Холст с картой и туманом) */}
        <section
          id="dm-viewport-container"
          ref={containerRef}
          className="flex-1 relative bg-[#080808] cursor-crosshair overflow-hidden"
          style={{
            backgroundImage: 'radial-gradient(#1a1a1a 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFileUpload(e.dataTransfer.files[0]);
            }
          }}
        >
          {/* Индикатор статуса / подсказки сверху */}
          <div className="absolute top-3 left-4 z-20 flex items-center gap-2 pointer-events-none">
            <div className="px-3 py-1 bg-[#121212]/90 border border-[#2A2A2A] rounded text-[10px] text-[#888] flex items-center gap-2 uppercase">
              <span className="font-bold text-[#FF4E00]">{media.name}</span>
              <span className="text-[#555]">|</span>
              <span>
                {media.width}×{media.height}PX
              </span>
              <span className="text-[#555]">|</span>
              <span className="text-[#E0E0E0]">ZOOM: {Math.round(viewport.scale * 100)}%</span>
            </div>

            {measurement.active && (
              <div className="px-3 py-1 bg-black/90 border border-[#FF4E00] rounded text-[10px] text-white font-mono uppercase">
                DIST: <strong className="text-[#FF4E00]">{distanceFeet} FT</strong> ({distanceCells} CELLS /{' '}
                {Math.round(distancePx)} PX)
              </div>
            )}
          </div>

          {/* Плавающая панель управления зумом на вьюпорте */}
          <div className="absolute top-4 right-4 flex flex-col gap-1 z-20">
            <button
              onClick={handleZoomIn}
              className="w-8 h-8 bg-black/80 border border-[#333] hover:border-[#FF4E00] text-[#E0E0E0] hover:text-[#FF4E00] flex items-center justify-center text-xs font-bold transition rounded cursor-pointer"
              title="Zoom In"
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              className="w-8 h-8 bg-black/80 border border-[#333] hover:border-[#FF4E00] text-[#E0E0E0] hover:text-[#FF4E00] flex items-center justify-center text-xs font-bold transition rounded cursor-pointer"
              title="Zoom Out"
            >
              -
            </button>
            <button
              onClick={() => fitMapToScreen()}
              className="w-8 h-8 bg-black/80 border border-[#333] hover:border-[#FF4E00] text-[#E0E0E0] hover:text-[#FF4E00] flex items-center justify-center text-xs font-bold transition rounded cursor-pointer"
              title="Reset View"
            >
              ⟲
            </button>
          </div>

          {/* Нижняя телеметрия координат */}
          <div className="absolute bottom-4 left-4 flex gap-4 text-[10px] text-[#555] uppercase bg-black/80 px-2.5 py-1 border border-[#2A2A2A] rounded pointer-events-none">
            <span>X: {Math.round(viewport.x)}</span>
            <span>Y: {Math.round(viewport.y)}</span>
            <span>SCALE: {viewport.scale.toFixed(2)}X</span>
          </div>

          {/* Всплывающий тост */}
          {toastMessage && (
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40 px-3.5 py-1.5 bg-[#161616] border border-[#FF4E00] text-[#FF4E00] text-[11px] font-bold uppercase rounded shadow-2xl flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Контейнер трансформируемой карты */}
          <div
            id="map-transform-layer"
            ref={mapContainerRef}
            className="absolute origin-top-left will-change-transform select-none"
            style={{
              transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0px) scale(${viewport.scale})`,
              width: `${media.width}px`,
              height: `${media.height}px`,
            }}
          >
            {/* Слой 1: Нативный рендер медиа (Изображение или Видео) */}
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

            {/* Слой 2: Тактическая сетка (CSS Background SVG pattern) */}
            {grid.enabled && (
              <div
                id="grid-overlay-layer"
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `linear-gradient(to right, ${grid.color} 1px, transparent 1px), linear-gradient(to bottom, ${grid.color} 1px, transparent 1px)`,
                  backgroundSize: `${grid.size}px ${grid.size}px`,
                  backgroundPosition: `${grid.offsetX}px ${grid.offsetY}px`,
                  opacity: grid.opacity,
                }}
              />
            )}

            {/* Слой 3: Холст Тумана Войны (Canvas 2D) */}
            <canvas
              id="fog-canvas-layer"
              ref={fogCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ width: `${media.width}px`, height: `${media.height}px` }}
            />

            {/* Слой 4: Векторные маркеры (Пинги и Измерения) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
              {/* Линейка измерений */}
              {measurement.active && (
                <g>
                  <line
                    x1={measurement.startX}
                    y1={measurement.startY}
                    x2={measurement.currentX}
                    y2={measurement.currentY}
                    stroke="#FF4E00"
                    strokeWidth={3 / viewport.scale}
                    strokeDasharray={`${6 / viewport.scale}, ${3 / viewport.scale}`}
                  />
                  <circle cx={measurement.startX} cy={measurement.startY} r={5 / viewport.scale} fill="#FF4E00" />
                  <circle cx={measurement.currentX} cy={measurement.currentY} r={5 / viewport.scale} fill="#FF4E00" />
                  <text
                    x={(measurement.startX + measurement.currentX) / 2}
                    y={(measurement.startY + measurement.currentY) / 2 - 8 / viewport.scale}
                    fill="#ffffff"
                    fontSize={13 / viewport.scale}
                    fontWeight="bold"
                    textAnchor="middle"
                    className="filter drop-shadow font-mono"
                  >
                    {distanceFeet} ft ({distanceCells} cells)
                  </text>
                </g>
              )}

              {/* Пинги лазерной указки */}
              {activePings.map((ping) => (
                <g key={ping.id} transform={`translate(${ping.x}, ${ping.y})`}>
                  <circle
                    r={20 / viewport.scale}
                    fill="none"
                    stroke={ping.color || '#FF4E00'}
                    strokeWidth={2.5 / viewport.scale}
                  >
                    <animate attributeName="r" from="5" to={40 / viewport.scale} dur="1.2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="1" to="0" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                  <circle r={4 / viewport.scale} fill={ping.color || '#FF4E00'} />
                </g>
              ))}
            </svg>
          </div>
        </section>
      </main>

      {/* 4. Нижний технический колонтитул (High Density Footer) */}
      <footer className="h-6 bg-[#000] border-t border-[#2A2A2A] flex items-center justify-between px-4 text-[9px] text-[#666] font-mono flex-shrink-0 z-30">
        <div className="flex gap-4">
          <span>OS: macOS 10.13.6 (AIR COMPATIBLE)</span>
          <span>ENGINE: ES6 VANILLA / BROADCASTCHANNEL</span>
        </div>
        <div className="flex gap-4">
          <span className="text-[#FF4E00]">VRAM: OPTIMIZED (256MB CAP)</span>
          <span>ACTIVE THREADS: 1</span>
        </div>
      </footer>
    </div>
  );
};
