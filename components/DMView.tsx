'use client';

/**
 * Окно Мастера (DM View) - Панель управления картами, туманом войны, синхронизацией и библиотекой локаций.
 * Оснащено встроенной студией процедурных генераторов карт, рамкой обзора проектора игроков (Player Frustum),
 * библиотекой карт с историей посещений и сохранением тумана, колодой карточек D&D 5e и 60 FPS рендерингом.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  GeneratorType,
  GeneratorExportEventData,
  MultiFloorGroup,
  MapFloorItem,
  SavedMapLocation,
  PlayerViewportInfo,
} from '@/lib/types';
import { SyncController } from '@/lib/sync';
import { FogEngine } from '@/lib/fog-engine';
import { PRESET_MAPS } from '@/lib/presets';
import {
  initMapLibrary,
  loadMapLibrary,
  saveMapLibrary,
  getActiveMapId,
  saveActiveMapId,
  createLocationFromGenerator,
  createLocationFromFile,
  getDefaultPresetLocations,
} from '@/lib/map-library';
import { GeneratorStudio } from '@/components/generators/GeneratorStudio';
import { CampaignGeneratorSuite } from '@/components/dnd/CampaignGeneratorSuite';
import { CampaignCardView } from '@/components/dnd/CampaignCardView';
import { MapLibraryModal } from '@/components/dnd/MapLibraryModal';
import { UnifiedAssetFolderModal } from '@/components/dm/UnifiedAssetFolderModal';
import { PolzaAiEngineModal } from '@/components/dm/PolzaAiEngineModal';
import { AudioPlayerModal } from '@/components/audio/AudioPlayerModal';
import { AudioMiniPlayer } from '@/components/audio/AudioMiniPlayer';
import { audioService } from '@/lib/audio/audio-engine';
import { scanFilesToPlaylists } from '@/lib/audio/folder-scanner';
import { processUploadedFiles } from '@/lib/fsSync';
import { CampaignCard } from '@/lib/dnd-engine/types';
import { AudioEngineState } from '@/lib/audio/types';
import { AppSettingsModal } from '@/components/settings/AppSettingsModal';
import { AppSettings, getInitialSettingsSync, loadAppSettings } from '@/lib/appSettings';
import { PhotoshopMapToolbar } from '@/components/dm/PhotoshopMapToolbar';
import {
  GasVariant,
  WaterVariant,
  LaserColor,
  AttentionStyle,
  SpellShapeType,
  MapFxStroke,
  SpellZoneArea,
  LaserPointerState,
  AttentionBeacon,
} from '@/lib/map-canvas-engine/types';
import { MapFxEngine } from '@/lib/map-canvas-engine/MapFxEngine';
import { playAttentionBeep } from '@/lib/audio/alertSound';
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
  HardDrive,
  Bot,
  FolderOpen,
  Trash2,
  Shield,
  Layers,
  Sparkles,
  Download,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Mountain,
  Home,
  Beer,
  Compass,
  Castle,
  Zap,
  BookOpen,
  Skull,
  Users,
  Coins,
  Store,
  Wand2,
  Sword,
  ScrollText,
  Pin,
  PinOff,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  X,
  Map as MapIcon,
  Tv,
  Target,
  Crosshair,
  MonitorPlay,
  Music,
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipForward,
  Settings,
} from 'lucide-react';

interface DMViewProps {
  onOpenPlayerWindow: () => void;
}

export const DMView: React.FC<DMViewProps> = ({ onOpenPlayerWindow }) => {
  // --- Состояния библиотеки карт и локаций ---
  const [mapLocations, setMapLocations] = useState<SavedMapLocation[]>(() => initMapLibrary());
  const [activeLocationId, setActiveLocationId] = useState<string | null>(() => {
    const defaultList = getDefaultPresetLocations();
    return defaultList[0] ? defaultList[0].id : null;
  });
  const [isMapLibraryOpen, setIsMapLibraryOpen] = useState<boolean>(false);
  const [isAudioPlayerOpen, setIsAudioPlayerOpen] = useState<boolean>(false);
  const [audioEngineState, setAudioEngineState] = useState<AudioEngineState>(() => audioService.getState());

  useEffect(() => {
    const unsub = audioService.subscribe((state) => {
      setAudioEngineState(state);
    });
    return () => {
      unsub();
    };
  }, []);

  // --- Состояния медиа и карты на столе ---
  const [media, setMedia] = useState<MediaState>(() => {
    const defaultList = getDefaultPresetLocations();
    const targetLoc = defaultList[0];
    if (targetLoc) {
      return {
        type: targetLoc.type,
        url: targetLoc.dataUrl || targetLoc.url,
        name: targetLoc.name,
        width: targetLoc.width,
        height: targetLoc.height,
        aspectRatio: targetLoc.width / targetLoc.height,
      };
    }
    return {
      type: 'image',
      url: PRESET_MAPS[0].dataUrl,
      name: PRESET_MAPS[0].name,
      width: PRESET_MAPS[0].width,
      height: PRESET_MAPS[0].height,
      aspectRatio: PRESET_MAPS[0].width / PRESET_MAPS[0].height,
    };
  });
  const currentObjectUrlRef = useRef<string | null>(null);

  // --- Состояние многоэтажной группы (Multi-Floor Group) ---
  const [multiFloorGroup, setMultiFloorGroup] = useState<MultiFloorGroup | null>(null);

  // --- Состояние модального окна Единого Каталога Ресурсов AetherMap_Data ---
  const [isUnifiedFolderOpen, setIsUnifiedFolderOpen] = useState<boolean>(false);

  // --- Состояние Polza AI Engine & Campaign Studio ---
  const [isPolzaAiModalOpen, setIsPolzaAiModalOpen] = useState<boolean>(false);

  // --- Состояние модального окна Генераторов Карт ---
  const [isGenStudioOpen, setIsGenStudioOpen] = useState<boolean>(false);
  const [activeGenType, setActiveGenType] = useState<GeneratorType>('dungeon');

  // --- Состояние D&D Campaign Generator Suite & Карточек ---
  const [isCampaignSuiteOpen, setIsCampaignSuiteOpen] = useState<boolean>(false);
  const [campaignSuiteTab, setCampaignSuiteTab] = useState<string>('bestiary');
  const [projectedCard, setProjectedCard] = useState<CampaignCard | null>(null);
  const [pinnedCards, setPinnedCards] = useState<CampaignCard[]>([]);
  const [activePinnedCardModal, setActivePinnedCardModal] = useState<CampaignCard | null>(null);
  const [isPinnedDeckExpanded, setIsPinnedDeckExpanded] = useState<boolean>(true);

  // --- Состояние камеры мастера (Pan / Zoom) ---
  const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, scale: 1 });
  const [syncCameraWithPlayer, setSyncCameraWithPlayer] = useState<boolean>(false);

  // --- Состояние экрана игроков и рамки обзора (Player Viewport Frustum) ---
  const [playerViewportInfo, setPlayerViewportInfo] = useState<PlayerViewportInfo | null>(null);
  const [showPlayerFrustum, setShowPlayerFrustum] = useState<boolean>(true);

  // --- Инструменты тумана и взаимодействия ---
  const [brushMode, setBrushModeInternal] = useState<BrushMode>('reveal');
  const [brushSize, setBrushSize] = useState<number>(80);
  const [dmFogOpacity, setDmFogOpacity] = useState<number>(0.55);

  const lastSyncTimeRef = useRef<number>(0);
  const [isFogBaseFilled, setIsFogBaseFilled] = useState<boolean>(false);

  // --- Состояние Drag & Drop карты непосредственно на стол ---
  const [isDraggingOverTable, setIsDraggingOverTable] = useState<boolean>(false);
  const dragCounterRef = useRef<number>(0);

  // --- Сетка ---
  const [grid, setGrid] = useState<GridConfig>({
    enabled: true,
    size: 70,
    color: '#ffffff',
    opacity: 0.22,
    offsetX: 0,
    offsetY: 0,
  });

  // Автоматическая синхронизация конфигурации сетки с экраном игроков
  useEffect(() => {
    syncRef.current?.send({
      type: 'GRID_CONFIG',
      payload: grid,
      timestamp: Date.now(),
    });
  }, [grid]);

  // --- Состояние Калибровки Сетки (Grid Matcher) ---
  const [calibrationCellCount, setCalibrationCellCount] = useState<number>(1);
  const [calibrationDrag, setCalibrationDrag] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isDragging: boolean;
  } | null>(null);
  const isCalibratingDragRef = useRef<boolean>(false);

  // Безопасная смена режима кисти со сбросом калибровки
  const setBrushMode = useCallback((modeOrFn: BrushMode | ((prev: BrushMode) => BrushMode)) => {
    setBrushModeInternal((prev) => {
      const next = typeof modeOrFn === 'function' ? modeOrFn(prev) : modeOrFn;
      if (next !== 'grid_calibrate') {
        setCalibrationDrag(null);
        isCalibratingDragRef.current = false;
      }
      return next;
    });
  }, []);

  // --- История действий тумана для синхронизации и повтора ---
  const fogActionsRef = useRef<FogAction[]>([]);
  const [, setFogActionCounter] = useState<number>(0);

  // --- Состояние системных настроек AetherMap OS ---
  const [appSettings, setAppSettings] = useState<AppSettings>(() => getInitialSettingsSync());
  const [isAppSettingsOpen, setIsAppSettingsOpen] = useState<boolean>(false);
  const appSettingsRef = useRef(appSettings);
  useEffect(() => { appSettingsRef.current = appSettings; }, [appSettings]);

  useEffect(() => {
    loadAppSettings().then((loaded) => {
      setAppSettings(loaded);
    });
  }, []);

  // --- Статус синхронизации ---
  const [playerConnected, setPlayerConnected] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const lastHeartbeatRef = useRef<number>(0);

  // Ссылки на актуальное состояние для стабильных колбэков
  const mediaRef = useRef(media);
  const viewportRef = useRef(viewport);
  const gridRef = useRef(grid);
  const isFogBaseFilledRef = useRef(isFogBaseFilled);
  const projectedCardRef = useRef(projectedCard);
  const pinnedCardsRef = useRef(pinnedCards);

  useEffect(() => { mediaRef.current = media; }, [media]);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { isFogBaseFilledRef.current = isFogBaseFilled; }, [isFogBaseFilled]);
  useEffect(() => { projectedCardRef.current = projectedCard; }, [projectedCard]);
  useEffect(() => { pinnedCardsRef.current = pinnedCards; }, [pinnedCards]);

  // --- Линейка и измерения ---
  const [measurement, setMeasurement] = useState<Measurement>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    active: false,
  });
  const [activePings, setActivePings] = useState<PingMarker[]>([]);

  // --- Состояния интерактивных инструментов рисования карты (Photoshop Map FX) ---
  const [gasVariant, setGasVariant] = useState<GasVariant>('poison');
  const [waterVariant, setWaterVariant] = useState<WaterVariant>('ocean');
  const [laserColor, setLaserColor] = useState<LaserColor>('#ff2a2a');
  const [attentionText, setAttentionText] = useState<string>('');
  const [attentionStyle, setAttentionStyle] = useState<AttentionStyle>('beacon');
  const [soundAlertEnabled, setSoundAlertEnabled] = useState<boolean>(true);
  const [markerColor, setMarkerColor] = useState<string>('#38bdf8');
  const [spellShape, setSpellShape] = useState<SpellShapeType>('circle');
  const [spellRadius, setSpellRadius] = useState<number>(20);
  const [spellLabel, setSpellLabel] = useState<string>('Fireball');
  const [spellColor, setSpellColor] = useState<string>('#ef4444');
  const [fxStrokesCount, setFxStrokesCount] = useState<number>(0);

  // --- Ссылки на DOM и движки ---
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fogEngineRef = useRef<FogEngine | null>(null);
  const mapFxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapFxEngineRef = useRef<MapFxEngine | null>(null);
  const syncRef = useRef<SyncController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Временные рефы для рисования эффектов карты
  const isDrawingFxRef = useRef<boolean>(false);
  const currentFxPointsRef = useRef<{ x: number; y: number }[]>([]);
  const currentFxIdRef = useRef<string>('');
  const activeLaserRef = useRef<LaserPointerState | null>(null);
  const spellZoneStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleAppSettingsChange = useCallback((newSettings: AppSettings) => {
    setAppSettings(newSettings);
    syncRef.current?.send({
      type: 'SETTINGS_SYNC',
      payload: {
        brightness: newSettings.playerDisplay.brightness,
        contrast: newSettings.playerDisplay.contrast,
        invertColors: newSettings.playerDisplay.invertColors,
        blackout: newSettings.playerDisplay.blackout,
        showGridOnPlayer: newSettings.playerDisplay.showGridOnPlayer,
        showPingsOnPlayer: newSettings.playerDisplay.showPingsOnPlayer,
      },
      timestamp: Date.now(),
    });
  }, []);

  // Флаги интерактивности мыши
  const isDraggingRef = useRef<boolean>(false);
  const isDrawingFogRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; vpX: number; vpY: number }>({ x: 0, y: 0, vpX: 0, vpY: 0 });
  const currentStrokePointsRef = useRef<{ x: number; y: number }[]>([]);
  const isAltPressedRef = useRef<boolean>(false);
  const isSpacePressedRef = useRef<boolean>(false);

  // Показ всплывающего уведомления
  const showToast = useCallback((msg: string, durationMs: number = 3500) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((prev) => (prev === msg ? null : prev)), durationMs);
  }, []);

  // Вычисление метрик калибровки сетки
  const getCalibrationMetrics = useCallback(() => {
    if (!calibrationDrag) return null;
    const { startX, startY, currentX, currentY } = calibrationDrag;
    const boxW = Math.abs(currentX - startX);
    const boxH = Math.abs(currentY - startY);
    const boxSize = Math.max(boxW, boxH);
    if (boxSize < 4) return null;

    const minX = Math.min(startX, currentX);
    const minY = Math.min(startY, currentY);

    const cellSize = Math.round((boxSize / calibrationCellCount) * 10) / 10;
    if (cellSize < 4) return null;

    const offsetX = Math.round(minX % cellSize);
    const offsetY = Math.round(minY % cellSize);

    return {
      minX,
      minY,
      boxSize,
      cellSize,
      offsetX,
      offsetY,
      cellsCount: calibrationCellCount,
    };
  }, [calibrationDrag, calibrationCellCount]);

  // Применение результатов калибровки
  const handleApplyCalibration = useCallback(() => {
    const metrics = getCalibrationMetrics();
    if (!metrics) {
      showToast('Сначала зажмите ЛКМ и выделите клетку на карте');
      return;
    }

    const newGrid: GridConfig = {
      ...grid,
      enabled: true,
      size: metrics.cellSize,
      offsetX: metrics.offsetX,
      offsetY: metrics.offsetY,
    };

    setGrid(newGrid);

    // Синхронизируем новую сетку с экраном игроков
    syncRef.current?.send({
      type: 'GRID_CONFIG',
      payload: newGrid,
      timestamp: Date.now(),
    });

    // Сохраняем некалиброванную/калиброванную сетку в активную локацию библиотеки
    if (activeLocationId) {
      setMapLocations((prev) => {
        const updated = prev.map((loc) => {
          if (loc.id === activeLocationId) {
            return {
              ...loc,
              grid: newGrid,
            };
          }
          return loc;
        });
        saveMapLibrary(updated);
        return updated;
      });
    }

    showToast(
      `✅ Сетка успешно сопоставлена! Размер клетки: ${metrics.cellSize}px (Смещение: X:${metrics.offsetX}px, Y:${metrics.offsetY}px)`
    );

    setCalibrationDrag(null);
    isCalibratingDragRef.current = false;
    setBrushMode('pan');
  }, [getCalibrationMetrics, grid, activeLocationId, showToast, setBrushMode]);

  // Асинхронная гидрация полной библиотеки карт из IndexedDB при маунте на клиенте
  useEffect(() => {
    let isMounted = true;

    loadMapLibrary().then((library) => {
      if (!isMounted || !library || library.length === 0) return;
      setMapLocations(library);

      const savedId = getActiveMapId();
      const targetLoc = library.find((l) => l.id === savedId) || library[0];
      if (targetLoc) {
        setActiveLocationId(targetLoc.id);
        setMedia({
          type: targetLoc.type,
          url: targetLoc.dataUrl || targetLoc.url,
          name: targetLoc.name,
          width: targetLoc.width,
          height: targetLoc.height,
          aspectRatio: targetLoc.width / targetLoc.height,
        });
        if (targetLoc.grid) {
          setGrid(targetLoc.grid);
        }
        if (targetLoc.fogActions) {
          fogActionsRef.current = targetLoc.fogActions;
        }
        setIsFogBaseFilled(targetLoc.isFogBaseFilled ?? false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // 1. Инициализация движка тумана и движка визуальных эффектов карты (MapFxEngine)
  useEffect(() => {
    if (fogCanvasRef.current) {
      fogEngineRef.current = new FogEngine(fogCanvasRef.current, true);
      fogEngineRef.current.setDMOpacity(dmFogOpacity);
      fogEngineRef.current.resize(media.width, media.height);
      if (isFogBaseFilled) {
        fogEngineRef.current.fillAll();
      } else {
        fogEngineRef.current.clearAll();
      }
      if (fogActionsRef.current.length > 0) {
        fogEngineRef.current.replayActions(fogActionsRef.current, isFogBaseFilled);
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

  // 2. Обновление прозрачности тумана мастера
  useEffect(() => {
    if (fogEngineRef.current) {
      fogEngineRef.current.setDMOpacity(dmFogOpacity);
      fogEngineRef.current.replayActions(fogActionsRef.current, isFogBaseFilled);
    }
  }, [dmFogOpacity, isFogBaseFilled]);

  // 3. Обработчик входящих сообщений синхронизации от Player View
  const handleIncomingMessage = useCallback(
    (msg: SyncMessage) => {
      if (msg.type === 'PLAYER_READY' || msg.type === 'REQUEST_FULL_STATE') {
        setPlayerConnected(true);
        lastHeartbeatRef.current = Date.now();
        if (msg.type === 'PLAYER_READY') {
          showToast('Экран игроков подключен!');
        }

        // Отправляем полный слепок текущего состояния мастерской сессии
        const fullState: DMFullState = {
          media: mediaRef.current,
          mediaDataUrl: mediaRef.current.url?.startsWith('data:') ? mediaRef.current.url : undefined,
          viewport: viewportRef.current,
          grid: gridRef.current,
          fogActions: fogActionsRef.current,
          fogBaseFilled: isFogBaseFilledRef.current,
          projectedCard: projectedCardRef.current,
          pinnedTableCards: pinnedCardsRef.current,
          mapFxStrokes: mapFxEngineRef.current?.strokes || [],
          spellZones: mapFxEngineRef.current?.spellZones || [],
        };

        syncRef.current?.send({
          type: 'DM_STATE_FULL',
          payload: fullState,
          timestamp: Date.now(),
        });

        syncRef.current?.send({
          type: 'SETTINGS_SYNC',
          payload: {
            brightness: appSettingsRef.current.playerDisplay.brightness,
            contrast: appSettingsRef.current.playerDisplay.contrast,
            invertColors: appSettingsRef.current.playerDisplay.invertColors,
            blackout: appSettingsRef.current.playerDisplay.blackout,
            showGridOnPlayer: appSettingsRef.current.playerDisplay.showGridOnPlayer,
            showPingsOnPlayer: appSettingsRef.current.playerDisplay.showPingsOnPlayer,
          },
          timestamp: Date.now(),
        });
      } else if (msg.type === 'PLAYER_VIEWPORT_INFO') {
        setPlayerConnected(true);
        lastHeartbeatRef.current = Date.now();
        setPlayerViewportInfo(msg.payload);
      } else if (msg.type === 'HEARTBEAT' && msg.role === 'player') {
        setPlayerConnected(true);
        lastHeartbeatRef.current = Date.now();
      }
    },
    [showToast]
  );

  // Действия с карточками D&D (Закрепление, Проекция, Удаление)
  const handlePinCard = useCallback((card: CampaignCard) => {
    setPinnedCards((prev) => {
      const exists = prev.some((c) => c.id === card.id);
      const updated = exists ? prev.map((c) => (c.id === card.id ? card : c)) : [...prev, card];
      syncRef.current?.send({
        type: 'TABLE_CARDS_SYNC',
        payload: { cards: updated },
        timestamp: Date.now(),
      });
      return updated;
    });
    showToast(`Карточка закреплена на столе: "${card.title}"`);
  }, [showToast]);

  const handleUnpinCard = useCallback((cardId: string) => {
    setPinnedCards((prev) => {
      const updated = prev.filter((c) => c.id !== cardId);
      syncRef.current?.send({
        type: 'TABLE_CARDS_SYNC',
        payload: { cards: updated },
        timestamp: Date.now(),
      });
      return updated;
    });
    if (activePinnedCardModal?.id === cardId) {
      setActivePinnedCardModal(null);
    }
    showToast('Карточка убрана со стола');
  }, [activePinnedCardModal, showToast]);

  const handleProjectCard = useCallback((card: CampaignCard | null) => {
    setProjectedCard(card);
    syncRef.current?.send({
      type: 'PROJECT_CARD',
      payload: { card },
      timestamp: Date.now(),
    });
    if (card) {
      showToast(`Карточка "${card.title}" спроецирована на экран игроков!`);
    } else {
      showToast('Проекция карточки на экран игроков закрыта');
    }
  }, [showToast]);

  const handleOpenDndSuite = useCallback((tab: string = 'bestiary') => {
    setCampaignSuiteTab(tab);
    setIsCampaignSuiteOpen(true);
  }, []);

  // 4. Инициализация синхронизации BroadcastChannel
  useEffect(() => {
    const controller = new SyncController(handleIncomingMessage);
    // eslint-disable-next-line react-hooks/immutability
    syncRef.current = controller;

    // Периодический пинг
    const heartbeatInterval = setInterval(() => {
      syncRef.current?.send({
        type: 'HEARTBEAT',
        role: 'dm',
        timestamp: Date.now(),
      });

      // Проверка живости экрана игрока (таймаут 8 сек)
      if (lastHeartbeatRef.current > 0 && Date.now() - lastHeartbeatRef.current > 8000) {
        setPlayerConnected(false);
      }
    }, 3000);

    return () => {
      clearInterval(heartbeatInterval);
      syncRef.current?.destroy();
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
      }
    };
  }, [handleIncomingMessage]);

  // 5. Подгонка карты мастера под размер контейнера
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
  const loadMediaUrl = useCallback(
    (
      url: string,
      type: 'image' | 'video',
      name: string,
      width = 1600,
      height = 1200,
      customGridSize?: number,
      keepExistingFog: boolean = false
    ) => {
      if (currentObjectUrlRef.current && currentObjectUrlRef.current !== url && currentObjectUrlRef.current.startsWith('blob:')) {
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

      if (customGridSize) {
        setGrid((g) => ({ ...g, size: customGridSize }));
      }

      // Сброс или сохранение холста тумана
      if (fogEngineRef.current && fogCanvasRef.current) {
        fogEngineRef.current.resize(width, height);
        if (!keepExistingFog) {
          fogActionsRef.current = [];
          setFogActionCounter(0);
          setIsFogBaseFilled(false);
          fogEngineRef.current.clearAll();
        }
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

      if (!keepExistingFog) {
        syncRef.current?.send({
          type: 'FOG_RESET',
          payload: { fill: false },
          timestamp: Date.now(),
        });
      }

      showToast(`Карта загружена: "${name}" [Нажмите 📐 Калибровка сетки]`);
    },
    [fitMapToScreen, showToast]
  );

  // 7. Переключение локации из библиотеки карт с полным сохранением тумана
  const handleSelectMapLocation = useCallback(
    (targetLoc: SavedMapLocation) => {
      // 1. Сохраняем состояние текущей активной карты в память и localStorage
      if (activeLocationId) {
        setMapLocations((prev) => {
          const updated = prev.map((loc) => {
            if (loc.id === activeLocationId) {
              return {
                ...loc,
                fogActions: [...fogActionsRef.current],
                isFogBaseFilled,
                grid: { ...grid },
                viewport: { ...viewport },
                visited: true,
                lastVisitedAt: Date.now(),
              };
            }
            return loc;
          });
          saveMapLibrary(updated);
          return updated;
        });
      }

      // 2. Активируем новую локацию
      setActiveLocationId(targetLoc.id);
      saveActiveMapId(targetLoc.id);

      // 3. Загружаем медиафайл
      const targetUrl = targetLoc.dataUrl || targetLoc.url;
      const targetWidth = targetLoc.width || 1600;
      const targetHeight = targetLoc.height || 1200;
      const targetGrid = targetLoc.grid || grid;
      const targetFogActions = targetLoc.fogActions || [];
      const targetFogBaseFilled = targetLoc.isFogBaseFilled ?? false;

      loadMediaUrl(targetUrl, targetLoc.type, targetLoc.name, targetWidth, targetHeight, targetGrid.size, true);

      // 4. Восстанавливаем сохраненный туман
      fogActionsRef.current = targetFogActions;
      setIsFogBaseFilled(targetFogBaseFilled);
      setFogActionCounter((c) => c + 1);

      if (fogEngineRef.current && fogCanvasRef.current) {
        fogEngineRef.current.resize(targetWidth, targetHeight);
        fogEngineRef.current.replayActions(targetFogActions, targetFogBaseFilled);
      }

      // 5. Восстанавливаем сетку
      setGrid(targetGrid);

      // 6. Подгоняем камеру
      fitMapToScreen(targetWidth, targetHeight);

      // 7. Отправляем полный слепок игрокам
      setTimeout(() => {
        const fullState: DMFullState = {
          media: {
            type: targetLoc.type,
            url: targetUrl,
            name: targetLoc.name,
            width: targetWidth,
            height: targetHeight,
            aspectRatio: targetWidth / targetHeight,
          },
          mediaDataUrl: targetUrl.startsWith('data:') ? targetUrl : undefined,
          viewport: targetLoc.viewport || { x: 0, y: 0, scale: 1 },
          grid: targetGrid,
          fogActions: targetFogActions,
          fogBaseFilled: targetFogBaseFilled,
          projectedCard,
          pinnedTableCards: pinnedCards,
        };

        syncRef.current?.send({
          type: 'MEDIA_CHANGE',
          payload: { media: fullState.media, dataUrl: targetUrl },
          timestamp: Date.now(),
        });
        syncRef.current?.send({
          type: 'DM_STATE_FULL',
          payload: fullState,
          timestamp: Date.now(),
        });
      }, 100);

      showToast(`Локация переключена: ${targetLoc.name}`);
    },
    [activeLocationId, isFogBaseFilled, grid, viewport, loadMediaUrl, fitMapToScreen, projectedCard, pinnedCards, showToast]
  );

  // Удаление локации из библиотеки
  const handleDeleteMapLocation = useCallback(
    (id: string) => {
      setMapLocations((prev) => {
        const updated = prev.filter((loc) => loc.id !== id);
        saveMapLibrary(updated);
        return updated;
      });
      showToast('Локация удалена из библиотеки');
    },
    [showToast]
  );

  // Дублирование локации
  const handleDuplicateMapLocation = useCallback(
    (sourceLoc: SavedMapLocation) => {
      const duplicate: SavedMapLocation = {
        ...sourceLoc,
        id: `copy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: `${sourceLoc.name} (Копия)`,
        fogActions: [...(sourceLoc.fogActions || [])],
        createdAt: Date.now(),
        lastVisitedAt: Date.now(),
      };
      setMapLocations((prev) => {
        const updated = [duplicate, ...prev];
        saveMapLibrary(updated);
        return updated;
      });
      showToast(`Создана копия локации: ${duplicate.name}`);
    },
    [showToast]
  );

  // Сброс открытого тумана для конкретной карты
  const handleResetLocationFog = useCallback(
    (id: string) => {
      setMapLocations((prev) => {
        const updated = prev.map((loc) => {
          if (loc.id === id) {
            return {
              ...loc,
              fogActions: [],
              isFogBaseFilled: false,
            };
          }
          return loc;
        });
        saveMapLibrary(updated);
        return updated;
      });

      if (id === activeLocationId) {
        fogActionsRef.current = [];
        setIsFogBaseFilled(false);
        setFogActionCounter((c) => c + 1);
        if (fogEngineRef.current) {
          fogEngineRef.current.clearAll();
        }
        syncRef.current?.send({
          type: 'FOG_RESET',
          payload: { fill: false },
          timestamp: Date.now(),
        });
      }
      showToast('Туман сброшен (карта полностью открыта)');
    },
    [activeLocationId, showToast]
  );

  // 8. Импорт одиночной сгенерированной карты (в библиотеку и на стол)
  const handleImportMapFromGenerator = useCallback(
    (payload: GeneratorExportEventData) => {
      const newLoc = createLocationFromGenerator(payload);
      setMapLocations((prev) => {
        const updated = [newLoc, ...prev.filter((l) => l.id !== newLoc.id)];
        saveMapLibrary(updated);
        return updated;
      });
      setActiveLocationId(newLoc.id);
      saveActiveMapId(newLoc.id);

      const isSingleFloor = payload.floorIndex === undefined || payload.floorIndex === null;
      const defaultGrid = newLoc.grid.size;
      const title = newLoc.name;

      loadMediaUrl(payload.dataUrl, 'image', title, payload.width || 1600, payload.height || 1600, defaultGrid);

      if (isSingleFloor) {
        setMultiFloorGroup(null);
      } else {
        setMultiFloorGroup((prev) => {
          const floorItem: MapFloorItem = {
            id: `floor_${payload.floorIndex}_${Date.now()}`,
            floorIndex: payload.floorIndex ?? 0,
            floorLabel: payload.floorLabel || `${payload.floorIndex}F`,
            floorTitle: payload.floorTitle || title,
            name: title,
            url: payload.dataUrl,
            width: payload.width || 1600,
            height: payload.height || 1600,
            fogActions: [],
            isFogBaseFilled: false,
          };

          if (!prev || prev.name !== (payload.houseName || 'Многоэтажное здание')) {
            return {
              id: `group_${Date.now()}`,
              name: payload.houseName || 'Многоэтажное здание',
              generatorType: payload.generatorType || 'dwell',
              floors: [floorItem],
              activeFloorIndex: payload.floorIndex ?? 0,
            };
          }

          const existingFiltered = prev.floors.filter((f) => f.floorIndex !== payload.floorIndex);
          const updatedFloors = [...existingFiltered, floorItem].sort((a, b) => a.floorIndex - b.floorIndex);

          return {
            ...prev,
            floors: updatedFloors,
            activeFloorIndex: payload.floorIndex ?? 0,
          };
        });
      }

      showToast(`✓ Локация «${title}» добавлена в библиотеку и выведена на стол!`);
    },
    [loadMediaUrl, showToast]
  );

  // 9. Пакетный импорт всех этажей здания
  const handleImportBatchFloors = useCallback(
    (floors: GeneratorExportEventData[]) => {
      if (!floors || floors.length === 0) return;

      const sorted = [...floors].sort((a, b) => (a.floorIndex ?? 0) - (b.floorIndex ?? 0));
      const firstFloor = sorted.find((f) => f.floorIndex === 0) || sorted[0];

      // Добавляем все этажи в библиотеку локаций
      const newLocs: SavedMapLocation[] = sorted.map((floor) => createLocationFromGenerator(floor));
      setMapLocations((prev) => {
        const updated = [...newLocs, ...prev];
        saveMapLibrary(updated);
        return updated;
      });

      const floorItems: MapFloorItem[] = sorted.map((item) => ({
        id: `floor_${item.floorIndex}_${Date.now()}`,
        floorIndex: item.floorIndex ?? 0,
        floorLabel: item.floorLabel || `${item.floorIndex}F`,
        floorTitle: item.floorTitle || item.filename || 'Этаж',
        name: item.floorTitle || item.filename || 'Этаж',
        url: item.dataUrl,
        width: item.width || 1600,
        height: item.height || 1600,
        fogActions: [],
        isFogBaseFilled: false,
      }));

      const houseName = firstFloor.houseName || 'Многоэтажный комплекс';
      const newGroup: MultiFloorGroup = {
        id: `group_${Date.now()}`,
        name: houseName,
        generatorType: firstFloor.generatorType || 'dwell',
        floors: floorItems,
        activeFloorIndex: firstFloor.floorIndex ?? 0,
      };

      setMultiFloorGroup(newGroup);
      setActiveLocationId(newLocs[0].id);
      saveActiveMapId(newLocs[0].id);

      loadMediaUrl(
        firstFloor.dataUrl,
        'image',
        firstFloor.floorTitle || `${houseName} (${firstFloor.floorLabel || '1F'})`,
        firstFloor.width || 1600,
        firstFloor.height || 1600,
        75
      );

      showToast(`✓ Загружен комплекс: ${houseName} (${floorItems.length} этажей сохранено в библиотеку)`);
    },
    [loadMediaUrl, showToast]
  );

  // 10. Переключение между этажами многоэтажного здания
  const handleSwitchFloor = useCallback(
    (targetFloorIndex: number) => {
      if (!multiFloorGroup) return;
      const targetFloor = multiFloorGroup.floors.find((f) => f.floorIndex === targetFloorIndex);
      if (!targetFloor) return;

      const currentActions = [...fogActionsRef.current];
      const currentBaseFilled = isFogBaseFilled;

      setMultiFloorGroup((prev) => {
        if (!prev) return null;
        const updatedFloors = prev.floors.map((f) => {
          if (f.floorIndex === prev.activeFloorIndex) {
            return {
              ...f,
              fogActions: currentActions,
              isFogBaseFilled: currentBaseFilled,
            };
          }
          return f;
        });

        return {
          ...prev,
          floors: updatedFloors,
          activeFloorIndex: targetFloorIndex,
        };
      });

      const newMedia: MediaState = {
        type: 'image',
        url: targetFloor.url,
        name: targetFloor.name,
        width: targetFloor.width,
        height: targetFloor.height,
        aspectRatio: targetFloor.width / targetFloor.height,
        floorIndex: targetFloor.floorIndex,
        floorLabel: targetFloor.floorLabel,
        floorTitle: targetFloor.floorTitle,
      };

      setMedia(newMedia);

      const targetActions = targetFloor.fogActions || [];
      const targetBaseFilled = targetFloor.isFogBaseFilled ?? false;

      fogActionsRef.current = targetActions;
      setIsFogBaseFilled(targetBaseFilled);
      setFogActionCounter((c) => c + 1);

      if (fogEngineRef.current && fogCanvasRef.current) {
        fogEngineRef.current.resize(targetFloor.width, targetFloor.height);
        fogEngineRef.current.replayActions(targetActions, targetBaseFilled);
      }

      fitMapToScreen(targetFloor.width, targetFloor.height);

      syncRef.current?.send({
        type: 'MEDIA_CHANGE',
        payload: {
          media: newMedia,
          dataUrl: targetFloor.url.startsWith('data:') ? targetFloor.url : undefined,
        },
        timestamp: Date.now(),
      });

      syncRef.current?.send({
        type: 'DM_STATE_FULL',
        payload: {
          media: newMedia,
          mediaDataUrl: targetFloor.url.startsWith('data:') ? targetFloor.url : undefined,
          viewport,
          grid,
          fogActions: targetActions,
          fogBaseFilled: targetBaseFilled,
          projectedCard,
          pinnedTableCards: pinnedCards,
        },
        timestamp: Date.now(),
      });

      showToast(`Переход на этаж: ${targetFloor.floorTitle || targetFloor.floorLabel}`);
    },
    [multiFloorGroup, isFogBaseFilled, fitMapToScreen, viewport, grid, projectedCard, pinnedCards, showToast]
  );

  // 11. Обработка загрузки и Drag & Drop локальных файлов карт и музыки на стол
  const handleFilesDrop = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      // Проверяем, не перетащил ли пользователь аудиофайлы / музыку
      const audioFiles = fileArray.filter(
        (f) =>
          f.type.startsWith('audio/') ||
          /\.(mp3|wav|ogg|flac|m4a|aac|opus|weba)$/i.test(f.name)
      );

      if (audioFiles.length > 0) {
        try {
          const scannedPlaylists = await scanFilesToPlaylists(audioFiles);
          if (scannedPlaylists.length > 0) {
            audioService.setPlaylists(scannedPlaylists);
            setIsAudioPlayerOpen(true);
            const total = scannedPlaylists.reduce((acc, p) => acc + p.trackCount, 0);
            showToast(
              `🎵 Загружено ${scannedPlaylists.length} музыкальных плейлистов (${total} треков) через Drag & Drop!`
            );
            // Если среди файлов были только аудио, завершаем обработку
            if (audioFiles.length === fileArray.length) {
              return;
            }
          }
        } catch (err) {
          console.warn('Ошибка обработки аудио через drop:', err);
        }
      }

      const validFiles = fileArray.filter(
        (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
      );

      if (validFiles.length === 0) {
        if (audioFiles.length === 0) {
          showToast('Ошибка: перетащите файл карты (JPG, PNG, WebP, MP4) или аудиофайл (MP3, WAV, OGG)');
        }
        return;
      }

      const primaryFile = validFiles[0];
      const isVideo = primaryFile.type.startsWith('video/');

      if (primaryFile.size > 80 * 1024 * 1024) {
        showToast('Внимание: файл >80 МБ может обрабатываться чуть дольше');
      }

      try {
        // Фоновая индексация файлов в хранилище ресурсов
        processUploadedFiles(validFiles, isVideo ? 'animated_maps' : 'maps').catch((err) => {
          console.warn('Фоновая индексация ресурсов завершилась:', err);
        });

        // Создаем карту-локацию для основного файла
        const primaryLoc = await createLocationFromFile(primaryFile);

        // Создаем локации для остальных перетащенных файлов (если их несколько)
        const otherLocs = await Promise.all(
          validFiles.slice(1).map((f) => createLocationFromFile(f))
        );

        const allNewLocs = [primaryLoc, ...otherLocs];

        setMapLocations((prev) => {
          const updated = [...allNewLocs, ...prev];
          saveMapLibrary(updated);
          return updated;
        });

        setActiveLocationId(primaryLoc.id);
        saveActiveMapId(primaryLoc.id);
        setMultiFloorGroup(null);

        // Загружаем карту на стол мастера
        loadMediaUrl(
          primaryLoc.dataUrl || primaryLoc.url,
          primaryLoc.type,
          primaryLoc.name,
          primaryLoc.width,
          primaryLoc.height,
          primaryLoc.grid.size,
          false // Сброс старого тумана под новую карту
        );

        // Принудительно и мгновенно отправляем смену карты на экран игроков
        syncRef.current?.send({
          type: 'MEDIA_CHANGE',
          payload: {
            media: {
              type: primaryLoc.type,
              url: primaryLoc.dataUrl || primaryLoc.url,
              name: primaryLoc.name,
              width: primaryLoc.width,
              height: primaryLoc.height,
              aspectRatio: primaryLoc.width / primaryLoc.height,
            },
            dataUrl: primaryLoc.dataUrl || primaryLoc.url,
          },
          timestamp: Date.now(),
        });

        if (validFiles.length === 1) {
          showToast(`✓ Карта «${primaryLoc.name}» загружена и мгновенно выведена на экран игроков!`);
        } else {
          showToast(`✓ Карта «${primaryLoc.name}» на столе (добавлено ${validFiles.length} карт в библиотеку)`);
        }
      } catch (err) {
        console.error('Ошибка обработки карты через drag-and-drop:', err);
        showToast('Не удалось обработать перетащенный файл карты');
      }
    },
    [loadMediaUrl, showToast]
  );

  const handleFileUpload = useCallback(
    (file: File) => {
      handleFilesDrop([file]);
    },
    [handleFilesDrop]
  );

  // 11.1 Глобальный перехват Drag & Drop для мгновенного обновления стола
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
        dragCounterRef.current += 1;
        setIsDraggingOverTable(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDraggingOverTable(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingOverTable(false);
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesDrop(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleFilesDrop]);

  // 12. Точный контроль камеры игроков (Player Viewport Controls)
  const handlePushViewToPlayer = useCallback(() => {
    if (!playerViewportInfo) {
      syncRef.current?.send({
        type: 'VIEWPORT_SYNC',
        payload: viewport,
        timestamp: Date.now(),
      });
      showToast('Камера игроков синхронизирована с видом мастера');
      return;
    }

    // Рассчитываем центральную точку карты на экране мастера
    const dmContainerRect = containerRef.current?.getBoundingClientRect();
    const dmWidth = dmContainerRect?.width || 1200;
    const dmHeight = dmContainerRect?.height || 800;

    const dmCenterMapX = (dmWidth / 2 - viewport.x) / viewport.scale;
    const dmCenterMapY = (dmHeight / 2 - viewport.y) / viewport.scale;

    const pW = playerViewportInfo.windowWidth || 1920;
    const pH = playerViewportInfo.windowHeight || 1080;
    const targetPlayerScale = viewport.scale;
    const targetPlayerX = pW / 2 - dmCenterMapX * targetPlayerScale;
    const targetPlayerY = pH / 2 - dmCenterMapY * targetPlayerScale;

    const targetPlayerViewport: ViewportTransform = {
      x: Math.round(targetPlayerX),
      y: Math.round(targetPlayerY),
      scale: targetPlayerScale,
    };

    syncRef.current?.send({
      type: 'VIEWPORT_SYNC',
      payload: targetPlayerViewport,
      timestamp: Date.now(),
    });

    setPlayerViewportInfo((prev) =>
      prev ? { ...prev, viewport: targetPlayerViewport } : null
    );

    showToast('✓ Игроки точно сфокусированы на вашей области карты');
  }, [playerViewportInfo, viewport, showToast]);

  const handleSnapToPlayerView = useCallback(() => {
    if (!playerViewportInfo) {
      showToast('Экран игроков не подключен');
      return;
    }
    setViewport(playerViewportInfo.viewport);
    showToast('Вид мастера выровнен по рамке экрана игроков');
  }, [playerViewportInfo, showToast]);

  const handleFitPlayerToMap = useCallback(() => {
    if (!playerViewportInfo) {
      showToast('Экран игроков не подключен');
      return;
    }
    const pW = playerViewportInfo.windowWidth || 1920;
    const pH = playerViewportInfo.windowHeight || 1080;
    const scale = Math.min(pW / media.width, pH / media.height) * 0.96;
    const x = Math.round((pW - media.width * scale) / 2);
    const y = Math.round((pH - media.height * scale) / 2);
    const fitVp: ViewportTransform = { x, y, scale };

    syncRef.current?.send({
      type: 'VIEWPORT_SYNC',
      payload: fitVp,
      timestamp: Date.now(),
    });

    setPlayerViewportInfo((prev) => (prev ? { ...prev, viewport: fitVp } : null));
    showToast('✓ Вся карта подогнана на экране игроков');
  }, [playerViewportInfo, media.width, media.height, showToast]);

  // 13. Действия с туманом: Скрыть всё / Открыть всё
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

  // 14. Преобразование координат экрана в координаты карты
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

  // Хелперы управления эффектами Photoshop Map FX
  const handleUndoLastFx = useCallback(() => {
    if (mapFxEngineRef.current) {
      mapFxEngineRef.current.removeLastStroke();
      setFxStrokesCount(mapFxEngineRef.current.strokes.length);
      syncRef.current?.send({
        type: 'MAP_FX_SYNC',
        payload: {
          strokes: mapFxEngineRef.current.strokes,
          spellZones: mapFxEngineRef.current.spellZones,
        },
        timestamp: Date.now(),
      });
      showToast('Последний эффект отменен');
    }
  }, [showToast]);

  const handleClearAllFx = useCallback(() => {
    if (mapFxEngineRef.current) {
      mapFxEngineRef.current.clearAll();
      setFxStrokesCount(0);
      syncRef.current?.send({
        type: 'MAP_FX_CLEAR',
        timestamp: Date.now(),
      });
      showToast('Все эффекты карты очищены');
    }
  }, [showToast]);

  const handleQuickAttention = useCallback(
    (customTxt?: string) => {
      // Ставим маяк по центру экрана или вьюпорта
      const centerX = Math.max(20, Math.min(media.width - 20, -viewport.x / viewport.scale + (window.innerWidth / 2) / viewport.scale));
      const centerY = Math.max(20, Math.min(media.height - 20, -viewport.y / viewport.scale + (window.innerHeight / 2) / viewport.scale));

      const beacon: AttentionBeacon = {
        id: `beacon_${Date.now()}`,
        x: centerX,
        y: centerY,
        color: '#f59e0b',
        text: customTxt || attentionText || '⚠️ ВНИМАНИЕ!',
        style: attentionStyle,
        timestamp: Date.now(),
        durationMs: 4500,
      };

      if (mapFxEngineRef.current) {
        mapFxEngineRef.current.addBeacon(beacon);
      }
      if (soundAlertEnabled) {
        playAttentionBeep(attentionStyle);
      }
      syncRef.current?.send({
        type: 'ATTENTION_BEACON',
        payload: beacon,
        timestamp: Date.now(),
      });
      showToast(`Сигнал внимания отправлен игрокам: ${beacon.text}`);
    },
    [media.width, media.height, viewport, attentionText, attentionStyle, soundAlertEnabled, showToast]
  );

  // 15. Обработка мыши: Панорамирование, Кисти Photoshop FX, Лазер, Маяки, Туман, Пинг, Измерение
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
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

      const coords = getMapCoordinates(e.clientX, e.clientY);

      // 0. Калибровка сетки
      if (brushMode === 'grid_calibrate') {
        isCalibratingDragRef.current = true;
        setCalibrationDrag({
          startX: coords.x,
          startY: coords.y,
          currentX: coords.x,
          currentY: coords.y,
          isDragging: true,
        });
        return;
      }

      // 1. Лазерная указка
      if (brushMode === 'laser' || e.altKey) {
        const laserState: LaserPointerState = {
          active: true,
          x: coords.x,
          y: coords.y,
          color: laserColor,
          trail: [{ x: coords.x, y: coords.y, timestamp: Date.now() }],
        };
        activeLaserRef.current = laserState;
        if (mapFxEngineRef.current) {
          mapFxEngineRef.current.setLaser(laserState);
        }
        syncRef.current?.send({
          type: 'LASER_SYNC',
          payload: laserState,
          timestamp: Date.now(),
        });
        return;
      }

      // 2. Привлечь внимание (Маяк тревоги)
      if (brushMode === 'attention') {
        const beacon: AttentionBeacon = {
          id: `beacon_${Date.now()}`,
          x: coords.x,
          y: coords.y,
          color: '#f59e0b',
          text: attentionText || '⚠️ ВНИМАНИЕ!',
          style: attentionStyle,
          timestamp: Date.now(),
          durationMs: 4500,
        };
        if (mapFxEngineRef.current) {
          mapFxEngineRef.current.addBeacon(beacon);
        }
        if (soundAlertEnabled) {
          playAttentionBeep(attentionStyle);
        }
        syncRef.current?.send({
          type: 'ATTENTION_BEACON',
          payload: beacon,
          timestamp: Date.now(),
        });
        showToast(`Сигнал внимания: ${beacon.text}`);
        return;
      }

      // 3. Рисование живых эффектов (Огонь, Вода, Газ, Маркер)
      if (brushMode === 'fire' || brushMode === 'water' || brushMode === 'gas' || brushMode === 'marker') {
        isDrawingFxRef.current = true;
        currentFxPointsRef.current = [coords];
        const strokeId = `fx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        currentFxIdRef.current = strokeId;

        const stroke: MapFxStroke = {
          id: strokeId,
          tool: brushMode,
          points: [coords],
          brushSize,
          opacity: 0.85,
          color: brushMode === 'marker' ? markerColor : undefined,
          variant: brushMode === 'gas' ? gasVariant : brushMode === 'water' ? waterVariant : undefined,
          createdAt: Date.now(),
        };

        if (mapFxEngineRef.current) {
          mapFxEngineRef.current.addStroke(stroke);
          setFxStrokesCount(mapFxEngineRef.current.strokes.length);
        }

        syncRef.current?.send({
          type: 'MAP_FX_STROKE',
          payload: stroke,
          timestamp: Date.now(),
        });
        return;
      }

      // 4. Зоны заклинаний AOE
      if (brushMode === 'spell_zone') {
        spellZoneStartRef.current = coords;
        return;
      }

      // 5. Ластик эффектов
      if (brushMode === 'eraser') {
        if (mapFxEngineRef.current) {
          mapFxEngineRef.current.eraseAt(coords, brushSize);
          setFxStrokesCount(mapFxEngineRef.current.strokes.length);
          syncRef.current?.send({
            type: 'MAP_FX_SYNC',
            payload: {
              strokes: mapFxEngineRef.current.strokes,
              spellZones: mapFxEngineRef.current.spellZones,
            },
            timestamp: Date.now(),
          });
        }
        return;
      }

      // 6. Стандартный векторный пинг
      if (brushMode === 'ping') {
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

      // 7. Линейка
      if (brushMode === 'measure') {
        setMeasurement({
          startX: coords.x,
          startY: coords.y,
          currentX: coords.x,
          currentY: coords.y,
          active: true,
        });
        return;
      }

      // 8. Туман войны (Открыть / Скрыть)
      if (brushMode === 'reveal' || brushMode === 'hide') {
        isDrawingFogRef.current = true;
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
    [
      brushMode,
      viewport,
      getMapCoordinates,
      brushSize,
      laserColor,
      attentionText,
      attentionStyle,
      soundAlertEnabled,
      markerColor,
      gasVariant,
      waterVariant,
      showToast,
    ]
  );

  const rafRef = useRef<number | null>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDraggingRef.current) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        const newVp: ViewportTransform = {
          ...viewport,
          x: dragStartRef.current.vpX + dx,
          y: dragStartRef.current.vpY + dy,
        };

        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            setViewport(newVp);
            rafRef.current = null;
          });
        }

        if (syncCameraWithPlayer) {
          const now = Date.now();
          if (now - lastSyncTimeRef.current > 40) {
            lastSyncTimeRef.current = now;
            syncRef.current?.send({
              type: 'VIEWPORT_SYNC',
              payload: newVp,
              timestamp: now,
            });
          }
        }
        return;
      }

      const coords = getMapCoordinates(e.clientX, e.clientY);

      // Калибровка сетки
      if (brushMode === 'grid_calibrate') {
        if (isCalibratingDragRef.current) {
          setCalibrationDrag((prev) => (prev ? { ...prev, currentX: coords.x, currentY: coords.y } : null));
        }
        return;
      }

      // Лазерная указка в реальном времени
      if (activeLaserRef.current && (brushMode === 'laser' || e.altKey)) {
        const now = Date.now();
        const trail = activeLaserRef.current.trail || [];
        trail.push({ x: coords.x, y: coords.y, timestamp: now });
        const updatedLaser: LaserPointerState = {
          ...activeLaserRef.current,
          x: coords.x,
          y: coords.y,
          trail: trail.slice(-25),
        };
        activeLaserRef.current = updatedLaser;

        if (mapFxEngineRef.current) {
          mapFxEngineRef.current.setLaser(updatedLaser);
        }

        if (now - lastSyncTimeRef.current > 30) {
          lastSyncTimeRef.current = now;
          syncRef.current?.send({
            type: 'LASER_SYNC',
            payload: updatedLaser,
            timestamp: now,
          });
        }
        return;
      }

      // Ластик эффектов при ведении
      if (brushMode === 'eraser' && (e.buttons === 1 || e.buttons === 3)) {
        if (mapFxEngineRef.current) {
          mapFxEngineRef.current.eraseAt(coords, brushSize);
          setFxStrokesCount(mapFxEngineRef.current.strokes.length);
          syncRef.current?.send({
            type: 'MAP_FX_SYNC',
            payload: {
              strokes: mapFxEngineRef.current.strokes,
              spellZones: mapFxEngineRef.current.spellZones,
            },
            timestamp: Date.now(),
          });
        }
        return;
      }

      // Рисование штрихов эффектов (Огонь, Вода, Газ, Маркер)
      if (isDrawingFxRef.current && currentFxIdRef.current) {
        currentFxPointsRef.current.push(coords);

        const stroke: MapFxStroke = {
          id: currentFxIdRef.current,
          tool: brushMode as any,
          points: [...currentFxPointsRef.current],
          brushSize,
          opacity: 0.85,
          color: brushMode === 'marker' ? markerColor : undefined,
          variant: brushMode === 'gas' ? gasVariant : brushMode === 'water' ? waterVariant : undefined,
          createdAt: Date.now(),
        };

        if (mapFxEngineRef.current) {
          const idx = mapFxEngineRef.current.strokes.findIndex((s) => s.id === stroke.id);
          if (idx >= 0) {
            mapFxEngineRef.current.strokes[idx] = stroke;
          }
        }

        const now = Date.now();
        if (now - lastSyncTimeRef.current > 35) {
          lastSyncTimeRef.current = now;
          syncRef.current?.send({
            type: 'MAP_FX_STROKE',
            payload: stroke,
            timestamp: now,
          });
        }
        return;
      }

      if (measurement.active) {
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            setMeasurement((m) => ({ ...m, currentX: coords.x, currentY: coords.y }));
            rafRef.current = null;
          });
        }
        return;
      }

      if (isDrawingFogRef.current && (brushMode === 'reveal' || brushMode === 'hide')) {
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
    [
      viewport,
      syncCameraWithPlayer,
      measurement.active,
      brushMode,
      getMapCoordinates,
      brushSize,
      markerColor,
      gasVariant,
      waterVariant,
      calibrationDrag?.isDragging,
    ]
  );

  const handleMouseUp = useCallback(
    (e?: React.MouseEvent) => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
      }

      // Завершение выделения рамки калибровки сетки
      if (brushMode === 'grid_calibrate') {
        if (isCalibratingDragRef.current) {
          isCalibratingDragRef.current = false;
          setCalibrationDrag((prev) => (prev ? { ...prev, isDragging: false } : null));
        }
      }

      // Отпускание лазерной указки
      if (activeLaserRef.current) {
        activeLaserRef.current = null;
        if (mapFxEngineRef.current) {
          mapFxEngineRef.current.setLaser(null);
        }
        syncRef.current?.send({
          type: 'LASER_SYNC',
          payload: null,
          timestamp: Date.now(),
        });
      }

      // Завершение штриха эффектов (Огонь, Вода, Газ, Маркер)
      if (isDrawingFxRef.current && currentFxIdRef.current) {
        isDrawingFxRef.current = false;
        if (currentFxPointsRef.current.length > 0) {
          const finalStroke: MapFxStroke = {
            id: currentFxIdRef.current,
            tool: brushMode as any,
            points: [...currentFxPointsRef.current],
            brushSize,
            opacity: 0.85,
            color: brushMode === 'marker' ? markerColor : undefined,
            variant: brushMode === 'gas' ? gasVariant : brushMode === 'water' ? waterVariant : undefined,
            createdAt: Date.now(),
          };

          syncRef.current?.send({
            type: 'MAP_FX_STROKE',
            payload: finalStroke,
            timestamp: Date.now(),
          });
        }
        currentFxPointsRef.current = [];
        currentFxIdRef.current = '';
      }

      // Завершение рисования зоны заклинаний AOE
      if (brushMode === 'spell_zone' && spellZoneStartRef.current && e) {
        const endCoords = getMapCoordinates(e.clientX, e.clientY);
        const start = spellZoneStartRef.current;
        const newZone: SpellZoneArea = {
          id: `zone_${Date.now()}`,
          shape: spellShape,
          startX: start.x,
          startY: start.y,
          endX: endCoords.x,
          endY: endCoords.y,
          radiusFeet: spellRadius,
          color: spellColor,
          label: spellLabel,
          opacity: 0.35,
          createdAt: Date.now(),
        };

        if (mapFxEngineRef.current) {
          mapFxEngineRef.current.addSpellZone(newZone);
          setFxStrokesCount(mapFxEngineRef.current.strokes.length + mapFxEngineRef.current.spellZones.length);
          syncRef.current?.send({
            type: 'MAP_FX_SYNC',
            payload: {
              strokes: mapFxEngineRef.current.strokes,
              spellZones: mapFxEngineRef.current.spellZones,
            },
            timestamp: Date.now(),
          });
        }
        spellZoneStartRef.current = null;
        showToast(`Создана зона: ${spellLabel} (${spellRadius} ft)`);
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

          syncRef.current?.send({
            type: 'FOG_ACTION',
            payload: finalStroke,
            timestamp: Date.now(),
          });
        }
        currentStrokePointsRef.current = [];
      }
    },
    [
      measurement.active,
      brushMode,
      brushSize,
      getMapCoordinates,
      spellShape,
      spellRadius,
      spellColor,
      spellLabel,
      markerColor,
      gasVariant,
      waterVariant,
      showToast,
      calibrationDrag?.isDragging,
    ]
  );

  // 16. Зум колесом мыши с центровкой на курсоре
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newScale = Math.max(0.1, Math.min(6.0, viewport.scale * zoomFactor));

      const newX = mouseX - (mouseX - viewport.x) * (newScale / viewport.scale);
      const newY = mouseY - (mouseY - viewport.y) * (newScale / viewport.scale);

      const newVp = { x: newX, y: newY, scale: newScale };
      setViewport(newVp);

      if (syncCameraWithPlayer) {
        const now = Date.now();
        if (now - lastSyncTimeRef.current > 40) {
          lastSyncTimeRef.current = now;
          syncRef.current?.send({
            type: 'VIEWPORT_SYNC',
            payload: newVp,
            timestamp: now,
          });
        }
      }
    },
    [viewport, syncCameraWithPlayer]
  );

  // 17. Отслеживание горячих клавиш
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Игнорируем горячие клавиши, если фокус в поле ввода или модальном окне
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }

      if (e.code === 'Space' && !e.repeat) {
        isSpacePressedRef.current = true;
      }
      if (e.key === 'Alt') {
        isAltPressedRef.current = true;
      }

      // Горячие клавиши Photoshop Map FX
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndoLastFx();
        return;
      }
      if (e.key.toLowerCase() === 'f') setBrushMode('fire');
      if (e.key.toLowerCase() === 'w') setBrushMode('water');
      if (e.key.toLowerCase() === 'g' && e.shiftKey) setBrushMode('gas');
      if (e.key.toLowerCase() === 'b') setBrushMode('marker');
      if (e.key.toLowerCase() === 'a') setBrushMode('attention');
      if (e.key.toLowerCase() === 'z' && !e.ctrlKey && !e.metaKey) setBrushMode('spell_zone');
      if (e.key.toLowerCase() === 'e') setBrushMode('eraser');

      // Базовые клавиши
      if (e.key.toLowerCase() === 'r') setBrushMode('reveal');
      if (e.key.toLowerCase() === 'h') setBrushMode('hide');
      if (e.key.toLowerCase() === 'm' && !e.shiftKey) setBrushMode('measure');
      if (e.key.toLowerCase() === 'p') setBrushMode('pan');
      if (e.key.toLowerCase() === 'l' && !e.shiftKey) setIsMapLibraryOpen(true);
      if (e.key.toLowerCase() === 'm' && e.shiftKey) setIsAudioPlayerOpen((prev) => !prev);
      if (e.key === 'F2' || (e.key === ',' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        setIsAppSettingsOpen((prev) => !prev);
      }
      if (e.key.toLowerCase() === 'g' && !e.shiftKey) {
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

  // 18. Обновление сетки
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

  // Скачивание автономного HTML-файла
  const handleDownloadStandalone = () => {
    const link = document.createElement('a');
    link.href = '/standalone.html';
    link.download = 'dnd-projector.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Скачивание автономного файла dnd-projector.html начато');
  };

  const handleOpenGenStudio = (type: GeneratorType = 'dungeon') => {
    setActiveGenType(type);
    setIsGenStudioOpen(true);
  };

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

  // Расчет рамки проектора игроков в координатах карты
  const playerFrustumRect = useMemo(() => {
    if (!playerViewportInfo || !playerViewportInfo.viewport) return null;
    const pVp = playerViewportInfo.viewport;
    if (pVp.scale <= 0) return null;

    const left = -pVp.x / pVp.scale;
    const top = -pVp.y / pVp.scale;
    const width = playerViewportInfo.windowWidth / pVp.scale;
    const height = playerViewportInfo.windowHeight / pVp.scale;

    return { left, top, width, height, scale: pVp.scale };
  }, [playerViewportInfo]);

  return (
    <div
      id="dm-app-container"
      className="app-shell"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 1. Header (Variation 5) */}
      <header className="app-header">
        <div className="brand flex items-center gap-3">
          <Shield className="w-5 h-5 text-[var(--accent)]" />
          <h1 className="brand-title text-base font-extrabold text-[var(--ink)] tracking-tight">DM SCREEN v2.0</h1>
          <span
            id="player-connection-indicator"
            className="label-meta hidden sm:inline"
            style={{
              color: playerConnected ? '#10b981' : '#f43f5e',
              margin: '0 0 0 0.75rem',
              opacity: 1,
            }}
          >
            {playerConnected ? '[ Projector: Online ]' : '[ Projector: Offline ]'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            id="btn-open-dnd-suite-header"
            onClick={() => handleOpenDndSuite('bestiary')}
            className="btn"
            title="D&D Suite: Монстры, NPC, Лут, Лавки, Экипировка, Магия, Правила"
          >
            <ScrollText className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">D&D Suite</span>
          </button>

          <button
            id="btn-open-audio-header"
            onClick={() => setIsAudioPlayerOpen(true)}
            className="btn"
            title="Открыть аудио-студию и саундборд SFX (горячая клавиша Shift+M)"
          >
            <Music className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Аудио & SFX</span>
          </button>

          <button
            id="btn-open-generators-header"
            onClick={() => handleOpenGenStudio('battlemap')}
            className="btn"
            title="Генераторы боевых карт, пещер, подземелий, городов и таверн"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Генераторы</span>
          </button>

          <button
            id="btn-open-polza-ai"
            onClick={() => setIsPolzaAiModalOpen(true)}
            className="btn"
            style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
            title="AI Studio: генерация контента и артов"
          >
            <Bot className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span className="hidden lg:inline">AI Studio</span>
          </button>

          <button
            id="btn-open-aether-data"
            onClick={() => setIsUnifiedFolderOpen(true)}
            className="btn hidden xl:inline-flex"
            title="Открыть структуру ресурсов AetherMap_Data"
          >
            <HardDrive className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
            <span>AetherMap_Data</span>
          </button>

          <button
            id="btn-open-settings"
            onClick={() => setIsAppSettingsOpen(true)}
            className="btn"
            title="Системные настройки приложения и проектора (горячая клавиша F2)"
          >
            <Settings className="w-3.5 h-3.5 text-zinc-300" />
            <span className="hidden sm:inline">Настройки</span>
          </button>

          <button
            id="btn-open-projector"
            onClick={onOpenPlayerWindow}
            className="btn hidden md:inline-flex"
            title="Открыть отдельное окно проектора для игроков"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Экран игроков</span>
          </button>

          <button
            id="btn-upload-map"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-accent"
            title="Загрузить свою карту (JPG, PNG, WebP, MP4)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Загрузить</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFilesDrop(e.target.files);
              }
            }}
          />
        </div>
      </header>

      {/* 2. Левая боковая панель (Sidebar): 01 // Viewing Port, 02 // 5E Modules, 03 // Scene Selection */}
      <aside id="dm-sidebar" className="sidebar">
        <section className="panel-section">
          <div className="flex justify-between items-center mb-2">
            <span className="label-meta mb-0">01 // Viewing Port</span>
            <button
              onClick={() => setShowPlayerFrustum(!showPlayerFrustum)}
              className="label-meta cursor-pointer"
              style={{ color: showPlayerFrustum ? '#38bdf8' : 'var(--ink-muted)' }}
              title="Включить / отключить рамку обзора игроков на столе мастера"
            >
              {showPlayerFrustum ? '[РАМКА: ВКЛ]' : '[РАМКА: ВЫКЛ]'}
            </button>
          </div>

          {playerViewportInfo && (
            <div className="text-[9px] text-[#94a3b8] flex items-center justify-between font-mono bg-[#090d16] px-2 py-1 rounded-sm border border-[var(--ink-faint)] mb-2">
              <span>Экран: {playerViewportInfo.windowWidth}×{playerViewportInfo.windowHeight}</span>
              <span className="text-[#38bdf8]">Зум: {Math.round(playerViewportInfo.viewport.scale * 100)}%</span>
            </div>
          )}

          <div className="btn-grid">
            <button
              id="btn-push-view-to-player"
              onClick={handlePushViewToPlayer}
              className="btn"
              title="Центрировать экран игроков точно на вашей текущей области стола"
            >
              <Target className="w-3 h-3 text-[#38bdf8]" />
              <span>Сфокусировать</span>
            </button>

            <button
              id="btn-fit-player-to-map"
              onClick={handleFitPlayerToMap}
              className="btn"
              title="Подогнать всю карту целиком в окно игроков"
            >
              <Maximize2 className="w-3 h-3 text-[var(--ink-muted)]" />
              <span>Всю карту</span>
            </button>

            <button
              id="btn-snap-dm-to-player"
              onClick={handleSnapToPlayerView}
              className="btn"
              title="Переместить камеру мастера к текущему положению экрана игроков"
            >
              <Crosshair className="w-3 h-3 text-[var(--ink-muted)]" />
              <span>К виду игроков</span>
            </button>

            <button
              id="btn-sync-camera-toggle"
              onClick={() => setSyncCameraWithPlayer(!syncCameraWithPlayer)}
              className={`btn ${syncCameraWithPlayer ? 'btn-accent' : ''}`}
              title="Автоматически двигать камеру игроков при панорамировании мастера"
            >
              <Radio className="w-3 h-3" />
              <span>{syncCameraWithPlayer ? 'Авто-зум: ВКЛ' : 'Авто-зум: СВОБ'}</span>
            </button>
          </div>
        </section>

        <section className="panel-section">
          <span className="label-meta">02 // 5E Modules</span>
          <div className="btn-grid">
            <button id="btn-sidebar-gen-bestiary" onClick={() => handleOpenDndSuite('bestiary')} className="btn">
              <Skull className="w-3 h-3 text-red-400" />
              <span>Бестиарий</span>
            </button>
            <button id="btn-sidebar-gen-npc" onClick={() => handleOpenDndSuite('npc')} className="btn">
              <Users className="w-3 h-3 text-blue-400" />
              <span>NPC</span>
            </button>
            <button id="btn-sidebar-gen-loot" onClick={() => handleOpenDndSuite('loot')} className="btn">
              <Coins className="w-3 h-3 text-amber-400" />
              <span>Лут</span>
            </button>
            <button id="btn-sidebar-gen-shops" onClick={() => handleOpenDndSuite('stores')} className="btn">
              <Store className="w-3 h-3 text-emerald-400" />
              <span>Лавки</span>
            </button>
            <button id="btn-sidebar-gen-equip" onClick={() => handleOpenDndSuite('equipment')} className="btn">
              <Sword className="w-3 h-3 text-purple-400" />
              <span>Экипировка</span>
            </button>
            <button id="btn-sidebar-gen-magic" onClick={() => handleOpenDndSuite('magic')} className="btn">
              <Wand2 className="w-3 h-3 text-cyan-400" />
              <span>Магия</span>
            </button>
            <button id="btn-sidebar-gen-ref" onClick={() => handleOpenDndSuite('reference')} className="btn btn-full">
              <BookOpen className="w-3 h-3 text-amber-400" />
              <span>Справочник правил & CR</span>
            </button>
          </div>
        </section>

        <section className="panel-section">
          <div className="flex justify-between items-center mb-2">
            <span className="label-meta mb-0">03 // Scene Selection</span>
            <span className="label-meta mb-0">{mapLocations.length} MAPS</span>
          </div>

          <div className="flex flex-col gap-1 mb-2">
            {mapLocations.slice(0, 6).map((loc) => {
              const isActive = loc.id === activeLocationId;
              return (
                <div
                  key={loc.id}
                  id={`btn-loc-${loc.id}`}
                  onClick={() => handleSelectMapLocation(loc)}
                  className={`map-card ${isActive ? 'active' : ''}`}
                >
                  <span className="truncate max-w-[160px]">{loc.name}</span>
                  <span
                    className="label-meta mb-0"
                    style={{ color: isActive ? 'var(--accent)' : 'var(--ink-muted)' }}
                  >
                    {isActive ? 'CUR' : loc.category.slice(0, 3).toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-1.5 mt-1.5">
            <button
              onClick={() => setIsMapLibraryOpen(true)}
              className="btn"
              title="Открыть библиотеку сохраненных и предустановленных карт (L)"
            >
              <FolderOpen className="w-3 h-3 text-[#38bdf8]" />
              <span>Карты (L)</span>
            </button>
            <button
              id="btn-sidebar-settings"
              onClick={() => setIsAppSettingsOpen(true)}
              className="btn"
              title="Системные настройки приложения и проектора (F2)"
            >
              <Settings className="w-3 h-3 text-zinc-300" />
              <span>Настройки</span>
            </button>
          </div>
        </section>

        {/* 04 // Dynamic FX & Map Tools — Интегрированная панель спецэффектов и рисования */}
        <PhotoshopMapToolbar
          brushMode={brushMode}
          setBrushMode={setBrushMode}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          gasVariant={gasVariant}
          setGasVariant={setGasVariant}
          waterVariant={waterVariant}
          setWaterVariant={setWaterVariant}
          laserColor={laserColor}
          setLaserColor={setLaserColor}
          attentionText={attentionText}
          setAttentionText={setAttentionText}
          attentionStyle={attentionStyle}
          setAttentionStyle={setAttentionStyle}
          soundAlertEnabled={soundAlertEnabled}
          setSoundAlertEnabled={setSoundAlertEnabled}
          markerColor={markerColor}
          setMarkerColor={setMarkerColor}
          spellShape={spellShape}
          setSpellShape={setSpellShape}
          spellRadius={spellRadius}
          setSpellRadius={setSpellRadius}
          spellLabel={spellLabel}
          setSpellLabel={setSpellLabel}
          spellColor={spellColor}
          setSpellColor={setSpellColor}
          onUndoLastFx={handleUndoLastFx}
          onClearAllFx={handleClearAllFx}
          onQuickAttention={handleQuickAttention}
          fxStrokesCount={fxStrokesCount}
        />
      </aside>

      {/* 3. Основная рабочая область (Холст с картой, туманом и рамкой проектора) */}
      <main
        id="dm-viewport-container"
        ref={containerRef}
        className="viewport-container cursor-crosshair overflow-hidden select-none"
        style={{
            backgroundImage: 'radial-gradient(var(--ink-faint) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDraggingOverTable(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (e.dataTransfer) {
              e.dataTransfer.dropEffect = 'copy';
            }
          }}
          onDragLeave={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingOverTable(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFilesDrop(e.dataTransfer.files);
            }
          }}
        >
          {/* Индикатор Drag & Drop карты непосредственно на стол */}
          {isDraggingOverTable && (
            <div
              id="dm-drag-drop-overlay"
              className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-[#04060ab3] backdrop-blur-sm pointer-events-none transition-all duration-200"
            >
              <div className="relative max-w-xl w-full p-8 rounded-2xl border-2 border-dashed border-amber-400/90 bg-[#0c1018]/95 shadow-[0_0_50px_rgba(245,158,11,0.25)] flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-150">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600/30 to-amber-400/20 border border-amber-500/50 flex items-center justify-center mb-4 shadow-inner">
                  <Upload className="w-8 h-8 text-amber-400 animate-bounce" />
                </div>
                
                <h3 className="text-xl font-bold text-white tracking-wide mb-2 flex items-center gap-2">
                  <span>Отпустите карту для загрузки на стол</span>
                </h3>
                
                <p className="text-sm text-slate-300 mb-5 max-w-md leading-relaxed">
                  Файл будет мгновенно установлен в качестве активной карты и автоматически отобразится у игроков на экране проектора без лишних настроек.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono font-bold">
                    PNG / JPG / WebP / GIF
                  </span>
                  <span className="px-2.5 py-1 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-mono font-bold">
                    MP4 / WebM (Живая карта)
                  </span>
                  <span className="px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono flex items-center gap-1 font-bold">
                    <Zap className="w-3 h-3 text-emerald-400" />
                    Мгновенная синхронизация
                  </span>
                </div>
              </div>
            </div>
          )}
          {/* Плашка переключения этажей (если загружен многоэтажный объект) */}
          {multiFloorGroup && multiFloorGroup.floors.length > 1 && (
            <div
              id="multi-floor-bar"
              className="absolute top-3 left-1/2 transform -translate-x-1/2 z-30 flex items-center gap-1 bg-[#12141a]/95 border border-amber-500/60 rounded-sm p-1 shadow-2xl"
            >
              <div className="px-2 py-0.5 text-[10px] text-amber-400 font-bold uppercase flex items-center gap-1 border-r border-slate-700 mr-1">
                <Layers className="w-3 h-3" />
                <span>Этажи:</span>
              </div>

              {multiFloorGroup.floors.map((floor) => {
                const isActive = multiFloorGroup.activeFloorIndex === floor.floorIndex;
                return (
                  <button
                    key={floor.id}
                    id={`btn-floor-${floor.floorIndex}`}
                    onClick={() => handleSwitchFloor(floor.floorIndex)}
                    className={`btn ${isActive ? 'btn-accent' : ''}`}
                    style={{ height: '24px', padding: '0 8px', fontSize: '10px' }}
                    title={floor.floorTitle || floor.name}
                  >
                    {floor.floorLabel || `${floor.floorIndex}F`}
                  </button>
                );
              })}
            </div>
          )}

          {/* Blueprint grid overlay (Variation 5) */}
          <div className="blueprint-grid" />

          {/* Плавающий индикатор статуса карты сверху слева (Variation 5) */}
          <div className="floating-pill hidden xl:block">
            ACTIVE // {media.name} [{media.width}×{media.height}PX] ZOOM: {Math.round(viewport.scale * 100)}%
            {measurement.active && (
              <span className="ml-2 font-mono text-[var(--accent)]">
                | DIST: {distanceFeet}FT / {distanceCells}C
              </span>
            )}
          </div>

          {/* Плавающая панель управления зумом на вьюпорте (Variation 5) */}
          <div className="map-controls-floating">
            <button
              onClick={handleZoomIn}
              className="btn btn-icon"
              title="Приблизить (+)"
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              className="btn btn-icon"
              title="Отдалить (-)"
            >
              -
            </button>
            <button
              onClick={() => fitMapToScreen()}
              className="btn btn-icon"
              title="Сбросить масштаб (Подогнать)"
            >
              ⟲
            </button>
          </div>

          {/* Интерактивная плавающая панель калибровки перенесена во внешний контейнер для изоляции событий мыши */}

          {/* Индикатор активной проекции на экран игроков */}
          {projectedCard && (
            <div
              id="active-projection-indicator"
              className="absolute top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3.5 py-1.5 bg-amber-950/90 border border-amber-500/80 rounded-full shadow-2xl  text-xs font-semibold text-amber-200 animate-pulse"
            >
              <Eye className="w-4 h-4 text-amber-400" />
              <span>Проекция на экран игроков:</span>
              <strong className="text-white max-w-[200px] truncate">{projectedCard.title}</strong>
              <button
                onClick={() => handleProjectCard(null)}
                className="ml-1 p-0.5 hover:bg-amber-900 rounded-full text-amber-400 hover:text-white transition"
                title="Остановить проекцию на экран игроков"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Плавающая колода закрепленных карточек стола (Pinned Cards Deck) */}
          {pinnedCards.length > 0 && (
            <div
              id="dm-pinned-cards-deck"
              className="absolute bottom-4 right-4 z-30 flex flex-col items-end max-w-md"
            >
              <div className="bg-[#14161d]/95 border border-amber-600/50 rounded-xl shadow-2xl p-2.5  w-full">
                <div className="flex items-center justify-between gap-3 mb-1.5 pb-1 border-b border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <Pin className="w-3.5 h-3.5" />
                    <span>Карточки на столе ({pinnedCards.length})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsPinnedDeckExpanded(!isPinnedDeckExpanded)}
                      className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition"
                      title={isPinnedDeckExpanded ? 'Свернуть колоду' : 'Развернуть колоду'}
                    >
                      {isPinnedDeckExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {isPinnedDeckExpanded && (
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {pinnedCards.map((card) => {
                      const isProjected = projectedCard?.id === card.id;
                      return (
                        <div
                          key={card.id}
                          className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                            isProjected
                              ? 'bg-amber-950/80 border-amber-500 text-amber-200 shadow-md shadow-amber-500/20'
                              : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                        >
                          <button
                            onClick={() => setActivePinnedCardModal(card)}
                            className="flex items-center gap-1 hover:text-white transition text-left cursor-pointer"
                            title="Открыть карточку"
                          >
                            <span className="truncate max-w-[120px]">{card.title}</span>
                          </button>

                          {/* Кнопка быстрой проекции */}
                          <button
                            onClick={() => handleProjectCard(isProjected ? null : card)}
                            className={`p-0.5 rounded transition ${
                              isProjected
                                ? 'text-amber-400 hover:text-amber-200'
                                : 'text-slate-500 hover:text-amber-400'
                            }`}
                            title={isProjected ? 'Скрыть с проектора' : 'Показать игрокам на проекторе'}
                          >
                            {isProjected ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>

                          {/* Кнопка открепления */}
                          <button
                            onClick={() => handleUnpinCard(card.id)}
                            className="p-0.5 text-slate-500 hover:text-red-400 rounded transition"
                            title="Убрать со стола"
                          >
                            <PinOff className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Нижняя телеметрия координат */}
          <div className="absolute bottom-4 left-4 flex gap-4 text-[10px] text-[#555] uppercase bg-black/80 px-2.5 py-1 border border-[#2A2A2A] rounded pointer-events-none">
            <span>X: {Math.round(viewport.x)}</span>
            <span>Y: {Math.round(viewport.y)}</span>
            <span>SCALE: {viewport.scale.toFixed(2)}X</span>
          </div>

          {/* Всплывающий тост */}
          {toastMessage && (
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40 px-4 py-2 bg-[#161616] border border-[#FF4E00] text-[#FF4E00] text-xs font-bold uppercase rounded-lg shadow-2xl flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
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

            {/* Слой 2.5: Интерактивная рамка и живой предпросмотр калибровки сетки */}
            {brushMode === 'grid_calibrate' && calibrationDrag && (() => {
              const metrics = getCalibrationMetrics();
              if (!metrics) return null;

              return (
                <div className="absolute inset-0 pointer-events-none z-30">
                  {/* 1. Живая временная предпросмотровая сетка поверх всей карты */}
                  <div
                    className="absolute inset-0 pointer-events-none opacity-60 transition-all duration-75"
                    style={{
                      backgroundImage: `linear-gradient(to right, #00f0ff 1.5px, transparent 1.5px), linear-gradient(to bottom, #00f0ff 1.5px, transparent 1.5px)`,
                      backgroundSize: `${metrics.cellSize}px ${metrics.cellSize}px`,
                      backgroundPosition: `${metrics.offsetX}px ${metrics.offsetY}px`,
                    }}
                  />

                  {/* 2. Выделенная рамка клетки с внутренней подсеткой */}
                  <div
                    className="absolute border-2 border-amber-400 bg-amber-500/20 shadow-[0_0_25px_rgba(245,158,11,0.65)] rounded-xs"
                    style={{
                      left: `${metrics.minX}px`,
                      top: `${metrics.minY}px`,
                      width: `${metrics.boxSize}px`,
                      height: `${metrics.boxSize}px`,
                    }}
                  >
                    {/* Внутренние линии подсетки для 2x2, 3x3, 5x5 и т.д. */}
                    {metrics.cellsCount > 1 && (
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `linear-gradient(to right, rgba(251, 191, 36, 0.7) 1px, transparent 1px), linear-gradient(to bottom, rgba(251, 191, 36, 0.7) 1px, transparent 1px)`,
                          backgroundSize: `${metrics.cellSize}px ${metrics.cellSize}px`,
                        }}
                      />
                    )}

                    {/* Угловые прицелы */}
                    <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-t-2 border-l-2 border-amber-300" />
                    <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-t-2 border-r-2 border-amber-300" />
                    <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-b-2 border-l-2 border-amber-300" />
                    <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-b-2 border-r-2 border-amber-300" />

                    {/* Плавающий бейдж с метриками */}
                    <div
                      className="absolute -top-7 left-0 bg-black/90 border border-amber-400 text-amber-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-2xl flex items-center gap-1.5 whitespace-nowrap"
                      style={{
                        transform: `scale(${Math.max(0.6, 1 / viewport.scale)})`,
                        transformOrigin: 'bottom left',
                      }}
                    >
                      <span>📐 КЛЕТКА: {metrics.cellSize}px</span>
                      <span className="text-amber-200/70">[{metrics.cellsCount}x{metrics.cellsCount}]</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Слой 3: Холст Тумана Войны (Canvas 2D) */}
            <canvas
              id="fog-canvas-layer"
              ref={fogCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ width: `${media.width}px`, height: `${media.height}px` }}
            />

            {/* Слой 4: Холст Живых Эффектов Карты Photoshop FX (Огонь, Вода, Газ, Лазер, Маяки внимания, Маркеры) */}
            <canvas
              id="map-fx-canvas-layer"
              ref={mapFxCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
              style={{ width: `${media.width}px`, height: `${media.height}px` }}
            />

            {/* Слой 5: Рамка обзора экрана игроков (Player Viewport Frustum Frame) */}
            {showPlayerFrustum && playerFrustumRect && (
              <div
                id="player-viewport-frustum-frame"
                className="absolute pointer-events-none transition-all duration-75 z-20"
                style={{
                  left: `${playerFrustumRect.left}px`,
                  top: `${playerFrustumRect.top}px`,
                  width: `${playerFrustumRect.width}px`,
                  height: `${playerFrustumRect.height}px`,
                }}
              >
                {/* Неоновая светящаяся рамка */}
                <div className="absolute inset-0 border-2 border-dashed border-[#38bdf8] shadow-[0_0_20px_rgba(56,189,248,0.45)] rounded-sm" />

                {/* Угловые прицелы мастера */}
                <div className="absolute -top-2 -left-2 w-5 h-5 border-t-2 border-l-2 border-[#ff4e00]" />
                <div className="absolute -top-2 -right-2 w-5 h-5 border-t-2 border-r-2 border-[#ff4e00]" />
                <div className="absolute -bottom-2 -left-2 w-5 h-5 border-b-2 border-l-2 border-[#ff4e00]" />
                <div className="absolute -bottom-2 -right-2 w-5 h-5 border-b-2 border-r-2 border-[#ff4e00]" />

                {/* Плавающий бейдж с телеметрией проектора */}
                <div
                  className="absolute top-2 left-2 bg-[#090d16]/95 border border-[#38bdf8]/80 text-[#38bdf8] text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-xl flex items-center gap-1.5 uppercase "
                  style={{
                    transform: `scale(${Math.max(0.5, 1 / viewport.scale)})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <Tv className="w-3 h-3 text-[#10b981] animate-pulse" />
                  <span>
                    ВИД ИГРОКОВ ({playerViewportInfo?.windowWidth}×{playerViewportInfo?.windowHeight}) •{' '}
                    {Math.round(playerFrustumRect.scale * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* Слой 5: Векторные маркеры (Пинги и Измерения) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
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

          {/* Плавающий переключатель DM / Проектор (Variation 5) */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 pointer-events-auto">
            <button className="btn btn-accent shadow-xl">Мастер (DM)</button>
            <button
              onClick={onOpenPlayerWindow}
              className="btn shadow-xl"
              style={{ background: 'rgba(0,0,0,0.85)' }}
              title="Открыть отдельное окно проектора для игроков"
            >
              Игроки (Проектор)
            </button>
          </div>
        </main>

        {/* 4. Правая панель инструментов: 04 // Environment, 05 // System, Audio Box (Variation 5) */}
        <aside id="dm-tools" className="tools">
          <div className="flex-1 p-5 overflow-y-auto">
            {/* 04 // Environment */}
            <section className="panel-section">
              <span className="label-meta">04 // Environment</span>
              <div className="btn-grid">
                <button
                  id="tool-reveal"
                  onClick={() => setBrushMode('reveal')}
                  className={`btn ${brushMode === 'reveal' ? 'btn-accent' : ''}`}
                  title="Открыть туман войны (горячая клавиша R)"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Открыть (R)</span>
                </button>

                <button
                  id="tool-hide"
                  onClick={() => setBrushMode('hide')}
                  className={`btn ${brushMode === 'hide' ? 'btn-accent' : ''}`}
                  title="Скрыть туманом войны (горячая клавиша H)"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Скрыть (H)</span>
                </button>

                <button
                  id="tool-measure"
                  onClick={() => setBrushMode('measure')}
                  className={`btn ${brushMode === 'measure' ? 'btn-accent' : ''}`}
                  title="Линейка расстояний (горячая клавиша M)"
                >
                  <Ruler className="w-3.5 h-3.5" />
                  <span>Линейка (M)</span>
                </button>

                <button
                  id="tool-pan"
                  onClick={() => setBrushMode('pan')}
                  className={`btn ${brushMode === 'pan' ? 'btn-accent' : ''}`}
                  title="Перемещение карты (горячая клавиша P)"
                >
                  <Move className="w-3.5 h-3.5" />
                  <span>Рука (P)</span>
                </button>
              </div>

              <div className="mt-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="label-meta mb-0">Brush Size</span>
                  <span className="label-meta mb-0" style={{ color: 'var(--accent)' }}>{brushSize}px</span>
                </div>
                <input
                  id="slider-brush-size"
                  type="range"
                  min="20"
                  max="300"
                  step="5"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                />
              </div>

              <div className="mt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="label-meta mb-0">Fog Opacity (DM)</span>
                  <span className="label-meta mb-0">{Math.round(dmFogOpacity * 100)}%</span>
                </div>
                <input
                  id="slider-dm-fog-opacity"
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={dmFogOpacity}
                  onChange={(e) => setDmFogOpacity(parseFloat(e.target.value))}
                />
              </div>

              <div className="btn-grid mt-3">
                <button id="btn-fog-fill-all" onClick={handleFogFillAll} className="btn">
                  Скрыть всё
                </button>
                <button id="btn-fog-clear-all" onClick={handleFogClearAll} className="btn">
                  Открыть всё
                </button>
              </div>
            </section>

            {/* 05 // System */}
            <section className="panel-section">
              <div className="flex justify-between items-center mb-2">
                <span className="label-meta mb-0">05 // System</span>
                <button
                  id="btn-toggle-grid"
                  onClick={() => updateGrid({ enabled: !grid.enabled })}
                  className={`btn ${grid.enabled ? 'btn-accent' : ''}`}
                  style={{ padding: '2px 8px', fontSize: '9px' }}
                >
                  {grid.enabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {grid.enabled && (
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="label-meta mb-0">Grid Size</span>
                    <span className="label-meta mb-0">{grid.size}px</span>
                  </div>
                  <input
                    id="slider-grid-size"
                    type="range"
                    min="30"
                    max="150"
                    step="2"
                    value={grid.size}
                    onChange={(e) => updateGrid({ size: parseInt(e.target.value, 10) })}
                  />
                </div>
              )}

              <button
                id="btn-download-standalone"
                onClick={handleDownloadStandalone}
                className="btn btn-full w-full"
                style={{ background: 'var(--ink-faint)', border: 'none' }}
                title="Скачать один автономный HTML-файл для игры без интернета"
              >
                <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Скачать Offline HTML</span>
              </button>
            </section>
          </div>

          {/* Audio Engine Box (Variation 5) */}
          <div className="audio-box">
            <div className="flex justify-between items-center mb-1">
              <span className="label-meta mb-0">Audio Engine // {audioEngineState.currentPlaylistName || 'Ambient / Tavern'}</span>
              <button
                onClick={() => setIsAudioPlayerOpen(true)}
                className="label-meta mb-0 hover:text-[var(--accent)] transition cursor-pointer"
                title="Открыть полный микшер"
              >
                FULL ↗
              </button>
            </div>
            <div
              className="text-sm font-semibold text-white mb-2 truncate"
              title={audioEngineState.currentTrack?.title || 'The Drunken Dragon Inn'}
            >
              {audioEngineState.currentTrack?.title || 'The Drunken Dragon Inn'}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => audioService.togglePlayPause()}
                className="btn flex items-center justify-center shrink-0"
                style={{
                  borderRadius: '50%',
                  width: 38,
                  height: 38,
                  padding: 0,
                  background: 'var(--accent)',
                  color: '#fff',
                }}
                title={audioEngineState.isPlaying && !audioEngineState.isPaused ? 'Пауза' : 'Воспроизведение'}
              >
                {audioEngineState.isPlaying && !audioEngineState.isPaused ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>
              <button
                onClick={() => audioService.nextTrack()}
                className="btn btn-icon shrink-0"
                title="Следующий трек"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={audioEngineState.isMuted ? 0 : audioEngineState.volume}
                onChange={(e) => audioService.setVolume(parseFloat(e.target.value))}
                className="flex-1"
                title={`Громкость: ${Math.round(audioEngineState.volume * 100)}%`}
              />
            </div>
          </div>
        </aside>

        {/* 5. Статус-бар (Variation 5) */}
        <footer className="status-bar">
          <div className="label-meta mb-0">
            {media.width}×{media.height} | {Math.round(viewport.scale * 100)}% SCALE | SESSION_MASTER
          </div>
          <div className="label-meta mb-0 hidden md:block">
            X: {Math.round(viewport.x)} Y: {Math.round(viewport.y)} | FOG: {Math.round(dmFogOpacity * 100)}%
          </div>
          <div
            className="label-meta mb-0"
            style={{ color: playerConnected ? '#10b981' : 'var(--ink-muted)' }}
          >
            {`${playerConnected ? 'PROJECTOR: ONLINE' : 'PROJECTOR: OFFLINE'} // LATENCY: 12ms STABLE`}
          </div>
        </footer>

      {/* 4. Модальное окно Библиотеки Карт и Локаций */}
      <MapLibraryModal
        isOpen={isMapLibraryOpen}
        onClose={() => setIsMapLibraryOpen(false)}
        locations={mapLocations}
        activeLocationId={activeLocationId}
        onSelectLocation={handleSelectMapLocation}
        onDeleteLocation={handleDeleteMapLocation}
        onDuplicateLocation={handleDuplicateMapLocation}
        onResetFog={handleResetLocationFog}
        onOpenGenerators={() => handleOpenGenStudio('dwell')}
        onTriggerFileUpload={() => fileInputRef.current?.click()}
      />

      {/* 5. Модальное окно Встроенной Студии Генераторов Карт */}
      <GeneratorStudio
        isOpen={isGenStudioOpen}
        onClose={() => setIsGenStudioOpen(false)}
        initialType={activeGenType}
        onImportMapToTable={handleImportMapFromGenerator}
        onImportBatchFloors={handleImportBatchFloors}
      />

      {/* 6. Модальное окно D&D 5e Генераторов & Справочника */}
      {isCampaignSuiteOpen && (
        <div
          id="dnd-campaign-suite-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85  animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-7xl h-[90vh] bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <button
              onClick={() => setIsCampaignSuiteOpen(false)}
              className="absolute top-4 right-4 z-50 p-2 text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-xl transition cursor-pointer"
              title="Закрыть студию D&D"
            >
              <X className="w-5 h-5" />
            </button>

            <CampaignGeneratorSuite
              initialTab={campaignSuiteTab}
              pinnedCards={pinnedCards}
              pinnedCardIds={pinnedCards.map((c) => c.id)}
              projectedCard={projectedCard}
              projectedCardId={projectedCard?.id}
              onPinCard={handlePinCard}
              onUnpinCard={handleUnpinCard}
              onProjectCard={handleProjectCard}
            />
          </div>
        </div>
      )}

      {/* 7. Модальное окно инспектора закрепленной карточки */}
      {activePinnedCardModal && (
        <div
          id="pinned-card-inspector-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80  animate-in fade-in"
        >
          <div className="relative w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Pin className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-neutral-200 uppercase tracking-wider">
                  Карточка со стола мастера
                </h3>
              </div>
              <button
                onClick={() => setActivePinnedCardModal(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <CampaignCardView
              card={activePinnedCardModal}
              onPinToggle={(c) => {
                if (pinnedCards.some((card) => card.id === c.id)) {
                  handleUnpinCard(c.id);
                } else {
                  handlePinCard(c);
                }
              }}
              onProjectToggle={(c) => {
                handleProjectCard(projectedCard?.id === c.id ? null : c);
              }}
              isPinned={pinnedCards.some((c) => c.id === activePinnedCardModal.id)}
              isProjected={projectedCard?.id === activePinnedCardModal.id}
            />
          </div>
        </div>
      )}
      {/* 8. Единый каталог ресурсов AetherMap_Data */}
      <UnifiedAssetFolderModal
        isOpen={isUnifiedFolderOpen}
        onClose={() => setIsUnifiedFolderOpen(false)}
        onSelectMap={(location) => {
          if (location.url) {
            loadMediaUrl(
              location.url,
              location.type || 'image',
              location.name || 'Карта',
              location.width || 1920,
              location.height || 1080,
              location.grid?.size
            );
            showToast(`Активирован ресурс из AetherMap_Data: ${location.name}`);
          }
        }}
      />
      {/* 9. Polza AI Engine & Full Campaign Studio */}
      <PolzaAiEngineModal
        isOpen={isPolzaAiModalOpen}
        onClose={() => setIsPolzaAiModalOpen(false)}
        onApplyArtToMap={(url, name) => {
          loadMediaUrl(url, 'image', name, 1920, 1080);
          showToast(`ИИ-Арт активирован на столе: ${name}`);
        }}
      />
      {/* 10. D&D Audio Player & Soundboard */}
      <AudioPlayerModal
        isOpen={isAudioPlayerOpen}
        onClose={() => setIsAudioPlayerOpen(false)}
        showToast={showToast}
      />
      {/* 11. Системные настройки AetherMap OS */}
      <AppSettingsModal
        isOpen={isAppSettingsOpen}
        onClose={() => setIsAppSettingsOpen(false)}
        onSettingsChange={handleAppSettingsChange}
        showToast={showToast}
      />

      {/* Интерактивная плавающая панель управления калибровкой сетки (Изолирована во внешнем контейнере) */}
      {brushMode === 'grid_calibrate' && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-[#0c1017]/95 border border-amber-500/80 rounded-xl px-4 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-md flex flex-wrap items-center gap-4 text-xs animate-in fade-in slide-in-from-top-2 duration-200"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 text-amber-400 font-bold font-mono border-r border-amber-500/30 pr-3">
            <Grid className="w-4 h-4 text-amber-400 animate-spin-slow" />
            <span>КАЛИБРОВКА СЕТКИ</span>
          </div>

          {/* Выбор количества клеток в выделении */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 font-mono uppercase">Клеток в рамке:</span>
            <div className="flex gap-1 bg-black/60 p-0.5 rounded border border-slate-700">
              {[1, 2, 3, 5, 10].map((num) => (
                <button
                  key={num}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCalibrationCellCount(num);
                  }}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all cursor-pointer ${
                    calibrationCellCount === num
                      ? 'bg-amber-500 text-black font-bold shadow'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {num}x{num}
                </button>
              ))}
            </div>
          </div>

          {/* Результат вычислений */}
          {(() => {
            const metrics = getCalibrationMetrics();
            return (
              <div className="text-[11px] font-mono text-amber-200/90 flex items-center gap-2 bg-amber-950/40 px-2.5 py-1 rounded border border-amber-500/30">
                {metrics ? (
                  <span>
                    Клетка: <strong>{metrics.cellSize}px</strong> | Смещение: X:{metrics.offsetX}px, Y:{metrics.offsetY}px
                  </span>
                ) : (
                  <span className="text-amber-400/80 italic">Зажмите ЛКМ и выделите клетку на карте</span>
                )}
              </div>
            );
          })()}

          {/* Кнопки действий */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleApplyCalibration();
              }}
              disabled={!getCalibrationMetrics()}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-bold rounded shadow flex items-center gap-1.5 transition text-xs cursor-pointer"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Применить</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                isCalibratingDragRef.current = false;
                setCalibrationDrag(null);
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center gap-1 transition text-xs cursor-pointer"
              title="Сбросить выделение"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Сброс</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                isCalibratingDragRef.current = false;
                setCalibrationDrag(null);
                setBrushMode('pan');
              }}
              className="px-2 py-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/50 text-rose-300 rounded transition text-xs cursor-pointer"
              title="Выйти из режима калибровки"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
