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
import { processUploadedFiles } from '@/lib/fsSync';
import { CampaignCard } from '@/lib/dnd-engine/types';
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
  X,
  Map as MapIcon,
  Tv,
  Target,
  Crosshair,
  MonitorPlay,
} from 'lucide-react';

interface DMViewProps {
  onOpenPlayerWindow: () => void;
}

export const DMView: React.FC<DMViewProps> = ({ onOpenPlayerWindow }) => {
  // --- Состояния библиотеки карт и локаций ---
  const [mapLocations, setMapLocations] = useState<SavedMapLocation[]>(() => getDefaultPresetLocations());
  const [activeLocationId, setActiveLocationId] = useState<string | null>(() => {
    const defaultList = getDefaultPresetLocations();
    return defaultList[0] ? defaultList[0].id : null;
  });
  const [isMapLibraryOpen, setIsMapLibraryOpen] = useState<boolean>(false);

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
  const [activeGenType, setActiveGenType] = useState<GeneratorType>('dwell');

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
  const [brushMode, setBrushMode] = useState<BrushMode>('reveal');
  const [brushSize, setBrushSize] = useState<number>(80);
  const [dmFogOpacity, setDmFogOpacity] = useState<number>(0.55);

  const lastSyncTimeRef = useRef<number>(0);
  const [isFogBaseFilled, setIsFogBaseFilled] = useState<boolean>(false);

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
  const showToast = useCallback((msg: string, durationMs: number = 3500) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((prev) => (prev === msg ? null : prev)), durationMs);
  }, []);

  // Инициализация библиотеки карт и восстановление состояния из localStorage при маунте на клиенте
  useEffect(() => {
    const timer = setTimeout(() => {
      const library = initMapLibrary();
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
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // 1. Инициализация движка тумана
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
        };

        syncRef.current?.send({
          type: 'DM_STATE_FULL',
          payload: fullState,
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
    syncRef.current = new SyncController(handleIncomingMessage);

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

      showToast(`Карта загружена: ${name}`);
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

  // 11. Обработка загрузки локального файла
  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file) return;

      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        showToast('Ошибка: разрешены только изображения (JPG, PNG, WebP) или видео (MP4, WebM)');
        return;
      }

      if (file.size > 80 * 1024 * 1024) {
        showToast('Внимание: файл >80 МБ может замедлить работу на слабых устройствах');
      }

      try {
        await processUploadedFiles([file], isVideo ? 'animated_maps' : 'maps');
        const newLoc = await createLocationFromFile(file);
        setMapLocations((prev) => {
          const updated = [newLoc, ...prev];
          saveMapLibrary(updated);
          return updated;
        });
        setActiveLocationId(newLoc.id);
        saveActiveMapId(newLoc.id);

        setMultiFloorGroup(null);
        loadMediaUrl(newLoc.dataUrl || newLoc.url, newLoc.type, newLoc.name, newLoc.width, newLoc.height, newLoc.grid.size);
        showToast(`✓ Локация «${newLoc.name}» загружена и индексирована в AetherMap_Data`);
      } catch (err) {
        showToast('Не удалось обработать файл карты');
      }
    },
    [loadMediaUrl, showToast]
  );

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

  // 15. Обработка мыши: Панорамирование, Кисть тумана, Пинг, Измерение
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

      if (measurement.active) {
        const coords = getMapCoordinates(e.clientX, e.clientY);
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            setMeasurement((m) => ({ ...m, currentX: coords.x, currentY: coords.y }));
            rafRef.current = null;
          });
        }
        return;
      }

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

        syncRef.current?.send({
          type: 'FOG_ACTION',
          payload: finalStroke,
          timestamp: Date.now(),
        });
      }
      currentStrokePointsRef.current = [];
    }
  }, [measurement.active, brushMode, brushSize]);

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
      if (e.code === 'Space' && !e.repeat) {
        isSpacePressedRef.current = true;
      }
      if (e.key === 'Alt') {
        isAltPressedRef.current = true;
      }
      if (e.key.toLowerCase() === 'r') setBrushMode('reveal');
      if (e.key.toLowerCase() === 'h') setBrushMode('hide');
      if (e.key.toLowerCase() === 'm') setBrushMode('measure');
      if (e.key.toLowerCase() === 'p') setBrushMode('pan');
      if (e.key.toLowerCase() === 'l') setIsMapLibraryOpen(true);
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

  const handleOpenGenStudio = (type: GeneratorType = 'dwell') => {
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
      className="flex flex-col h-screen w-screen bg-[#0F0F0F] text-[#E0E0E0] font-mono overflow-hidden select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 1. Верхний компактный тактический Header */}
      <header className="flex items-center justify-between px-3 sm:px-4 h-12 border-b border-[#2A2A2A] bg-[#161616] flex-shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#FF4E00]" />
            <span className="text-[#FF4E00] font-bold text-xs tracking-tighter uppercase hidden sm:inline">
              C2D-PROJ v2.0 // DM SCREEN
            </span>
          </div>

          <div className="h-4 w-[1px] bg-[#2A2A2A] hidden sm:block" />

          {/* Индикатор связи с проектором */}
          <div
            id="player-connection-indicator"
            className="flex items-center gap-2"
            title={playerConnected ? 'Экран игроков подключен' : 'Экран игроков не открыт'}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                playerConnected
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse'
                  : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]'
              }`}
            />
            <span className="text-[10px] uppercase text-[#888]">
              {playerConnected ? 'Projector: Online' : 'Projector: Offline'}
            </span>
          </div>

          <div className="h-4 w-[1px] bg-[#2A2A2A] hidden md:block" />

          {/* Кнопка быстрого вызова библиотеки карт с активной картой */}
          <button
            onClick={() => setIsMapLibraryOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1e2433] hover:bg-[#283247] border border-[#3b4866] text-[#93c5fd] hover:text-white text-[11px] font-semibold transition cursor-pointer"
            title="Открыть библиотеку карт и пресетов (горячая клавиша L)"
          >
            <MapIcon className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span className="truncate max-w-[160px]">{media.name || 'Библиотека карт'}</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-black/40 text-[#94a3b8]">
              {mapLocations.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Главная кнопка D&D генераторов карточек и справочника */}
          <button
            id="btn-open-dnd-suite-header"
            onClick={() => handleOpenDndSuite('bestiary')}
            className="px-3 py-1 bg-gradient-to-r from-red-700 via-red-600 to-amber-600 hover:from-red-600 hover:to-amber-500 text-white font-bold text-[11px] rounded uppercase transition-all shadow-md shadow-red-900/30 flex items-center gap-1.5 cursor-pointer border border-red-500/40"
            title="Генератор монстров (CR 0-30), NPC, лута, магазинов, экипировки, магии и быстрый справочник правил"
          >
            <ScrollText className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">D&D Генераторы & Справочник</span>
            <span className="sm:hidden">D&D 5e</span>
          </button>

          {/* Главная кнопка генераторов карт */}
          <button
            id="btn-open-generators-header"
            onClick={() => handleOpenGenStudio('dwell')}
            className="px-3 py-1 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-[11px] rounded uppercase transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
            title="Открыть генератор пещер, городов, особняков, таверн или деревень"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Генераторы карт</span>
            <span className="sm:hidden">Генератор</span>
          </button>

          {/* Кнопка открытия Polza AI Engine & Campaign Studio */}
          <button
            id="btn-open-polza-ai"
            onClick={() => setIsPolzaAiModalOpen(true)}
            className="px-2.5 py-1 bg-gradient-to-r from-purple-700 via-indigo-600 to-[#ff4e00] hover:opacity-90 text-white font-bold text-[11px] rounded uppercase transition-all shadow-md flex items-center gap-1.5 cursor-pointer border border-purple-400/40"
            title="Открыть JSON AI Engine, Full Campaign Engine и ИИ-Генератор иллюстраций (/api/polza)"
          >
            <Bot className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span className="hidden lg:inline">JSON AI & Campaign Engine</span>
            <span className="lg:hidden">AI Studio</span>
          </button>

          {/* Кнопка открытия единого каталога AetherMap_Data */}
          <button
            id="btn-open-aether-data"
            onClick={() => setIsUnifiedFolderOpen(true)}
            className="px-2.5 py-1 bg-[#ff4e00]/10 hover:bg-[#ff4e00]/20 text-[#ff4e00] border border-[#ff4e00]/40 text-[11px] font-semibold rounded uppercase transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Открыть структуру и реестр локальных ресурсов AetherMap_Data"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">AetherMap_Data</span>
          </button>

          {/* Кнопка открытия окна игроков */}
          <button
            id="btn-open-projector"
            onClick={onOpenPlayerWindow}
            className="px-3 py-1 bg-[#2A2A2A] hover:bg-[#3A3A3A] text-[11px] text-[#E0E0E0] border border-[#444] rounded uppercase transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Открыть второе окно проектора для игроков"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#FF4E00]" />
            <span className="hidden sm:inline">Экран игроков</span>
          </button>

          {/* Кнопка загрузки своего файла карты */}
          <button
            id="btn-upload-map"
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1 bg-[#2A2A2A] hover:bg-[#3A3A3A] text-[#E0E0E0] border border-[#444] text-[11px] rounded uppercase transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Загрузить свою карту с диска (JPG, PNG, WebP, MP4)"
          >
            <Upload className="w-3.5 h-3.5 text-[#FF4E00]" />
            <span className="hidden md:inline">Загрузить</span>
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
            {/* Секция 0: Контроль вида игроков и рамка (Player Viewport Controls) */}
            <section className="bg-[#111722] border border-[#233554] rounded-lg p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#38bdf8] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Tv className="w-3.5 h-3.5" />
                  <span>Вид игроков (Проектор)</span>
                </span>
                <button
                  onClick={() => setShowPlayerFrustum(!showPlayerFrustum)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase transition ${
                    showPlayerFrustum ? 'bg-[#38bdf8] text-[#0f172a]' : 'bg-[#1e293b] text-[#64748b]'
                  }`}
                  title="Включить / отключить рамку обзора игроков на столе мастера"
                >
                  {showPlayerFrustum ? 'Рамка: ВКЛ' : 'Рамка: ВЫКЛ'}
                </button>
              </div>

              {/* Статус разрешения проектора */}
              {playerViewportInfo && (
                <div className="text-[9px] text-[#94a3b8] flex items-center justify-between font-mono bg-[#090d16] px-2 py-1 rounded border border-[#1e293b]">
                  <span>Экран: {playerViewportInfo.windowWidth}×{playerViewportInfo.windowHeight}px</span>
                  <span className="text-[#38bdf8]">
                    Зум: {Math.round(playerViewportInfo.viewport.scale * 100)}%
                  </span>
                </div>
              )}

              {/* Кнопки управления синхронизацией камеры */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  id="btn-push-view-to-player"
                  onClick={handlePushViewToPlayer}
                  className="px-2 py-1.5 bg-[#0284c7]/20 hover:bg-[#0284c7]/40 border border-[#0284c7]/60 text-[#38bdf8] hover:text-white text-[10px] font-bold rounded flex items-center justify-center gap-1 transition cursor-pointer"
                  title="Центрировать экран игроков точно на вашей текущей области стола"
                >
                  <Target className="w-3 h-3 text-[#38bdf8]" />
                  <span>Сфокусировать игроков</span>
                </button>

                <button
                  id="btn-fit-player-to-map"
                  onClick={handleFitPlayerToMap}
                  className="px-2 py-1.5 bg-[#1e293b] hover:bg-[#334155] border border-[#475569] text-[#cbd5e1] text-[10px] rounded flex items-center justify-center gap-1 transition cursor-pointer"
                  title="Подогнать всю карту целиком в окно игроков"
                >
                  <Maximize2 className="w-3 h-3 text-[#cbd5e1]" />
                  <span>Всю карту игрокам</span>
                </button>

                <button
                  id="btn-snap-dm-to-player"
                  onClick={handleSnapToPlayerView}
                  className="px-2 py-1.5 bg-[#1e293b] hover:bg-[#334155] border border-[#475569] text-[#cbd5e1] text-[10px] rounded flex items-center justify-center gap-1 transition cursor-pointer"
                  title="Переместить камеру мастера к текущему положению экрана игроков"
                >
                  <Crosshair className="w-3 h-3 text-[#cbd5e1]" />
                  <span>К виду игроков</span>
                </button>

                <button
                  id="btn-sync-camera-toggle"
                  onClick={() => setSyncCameraWithPlayer(!syncCameraWithPlayer)}
                  className={`px-2 py-1.5 border text-[10px] rounded flex items-center justify-center gap-1 transition cursor-pointer ${
                    syncCameraWithPlayer
                      ? 'bg-[#15342a] border-[#10b981] text-[#34d399] font-bold'
                      : 'bg-[#1e293b] border-[#475569] text-[#94a3b8]'
                  }`}
                  title="Автоматически двигать камеру игроков при панорамировании мастера"
                >
                  <Radio className="w-3 h-3" />
                  <span>{syncCameraWithPlayer ? 'Авто-зум: ВКЛ' : 'Авто-зум: СВОБ'}</span>
                </button>
              </div>
            </section>

            {/* Секция 0A: Быстрый запуск D&D 5e генераторов */}
            <section className="bg-gradient-to-br from-red-950/40 via-neutral-900 to-amber-950/30 border border-red-800/40 rounded-lg p-2.5 space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <ScrollText className="w-3 h-3 text-amber-400" />
                  <span>D&D 5e Генераторы & Карточки</span>
                </span>
                <span className="text-[9px] text-amber-400/80 font-mono">8 модулей</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  id="btn-sidebar-gen-bestiary"
                  onClick={() => handleOpenDndSuite('bestiary')}
                  className="px-2 py-1.5 bg-[#1f1616] hover:bg-[#2e1d1d] border border-red-600/40 hover:border-red-500 text-red-200 text-[10px] rounded flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Skull className="w-3 h-3 text-red-400" />
                  <span>Бестиарий CR</span>
                </button>

                <button
                  id="btn-sidebar-gen-npc"
                  onClick={() => handleOpenDndSuite('npc')}
                  className="px-2 py-1.5 bg-[#171b26] hover:bg-[#20273a] border border-blue-600/40 hover:border-blue-500 text-blue-200 text-[10px] rounded flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Users className="w-3 h-3 text-blue-400" />
                  <span>NPC & Соц.</span>
                </button>

                <button
                  id="btn-sidebar-gen-loot"
                  onClick={() => handleOpenDndSuite('loot')}
                  className="px-2 py-1.5 bg-[#251f14] hover:bg-[#382e1b] border border-amber-600/40 hover:border-amber-500 text-amber-200 text-[10px] rounded flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Coins className="w-3 h-3 text-amber-400" />
                  <span>Лут & Клады</span>
                </button>

                <button
                  id="btn-sidebar-gen-shops"
                  onClick={() => handleOpenDndSuite('stores')}
                  className="px-2 py-1.5 bg-[#15241b] hover:bg-[#1c3325] border border-emerald-600/40 hover:border-emerald-500 text-emerald-200 text-[10px] rounded flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Store className="w-3 h-3 text-emerald-400" />
                  <span>Лавки & Торги</span>
                </button>

                <button
                  id="btn-sidebar-gen-equip"
                  onClick={() => handleOpenDndSuite('equipment')}
                  className="px-2 py-1.5 bg-[#201726] hover:bg-[#2d1e38] border border-purple-600/40 hover:border-purple-500 text-purple-200 text-[10px] rounded flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Sword className="w-3 h-3 text-purple-400" />
                  <span>Экипировка</span>
                </button>

                <button
                  id="btn-sidebar-gen-magic"
                  onClick={() => handleOpenDndSuite('magic')}
                  className="px-2 py-1.5 bg-[#142327] hover:bg-[#1a333a] border border-cyan-600/40 hover:border-cyan-500 text-cyan-200 text-[10px] rounded flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Wand2 className="w-3 h-3 text-cyan-400" />
                  <span>Магия & Свитки</span>
                </button>

                <button
                  id="btn-sidebar-gen-ref"
                  onClick={() => handleOpenDndSuite('reference')}
                  className="col-span-2 px-2 py-1.5 bg-[#24211a] hover:bg-[#363124] border border-amber-500/50 hover:border-amber-400 text-amber-300 text-[10px] rounded flex items-center justify-center gap-1.5 transition cursor-pointer font-semibold"
                >
                  <BookOpen className="w-3 h-3 text-amber-400" />
                  <span>Справочник правил, состояний & Таблица CR</span>
                </button>
              </div>
            </section>

            {/* Секция 0B: Библиотека карт & Пресеты */}
            <section className="bg-[#181818] border border-[#333] rounded-lg p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <MapIcon className="w-3 h-3" />
                  <span>Библиотека & Пресеты</span>
                </span>
                <button
                  onClick={() => setIsMapLibraryOpen(true)}
                  className="text-[9px] text-[#38bdf8] hover:underline font-bold"
                >
                  Все ({mapLocations.length})
                </button>
              </div>

              {/* Список пресетов карт */}
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                {mapLocations.slice(0, 8).map((loc) => {
                  const isActive = loc.id === activeLocationId;
                  return (
                    <button
                      key={loc.id}
                      id={`btn-loc-${loc.id}`}
                      onClick={() => handleSelectMapLocation(loc)}
                      className={`w-full text-left px-2 py-1.5 rounded text-[10px] transition flex items-center justify-between cursor-pointer ${
                        isActive
                          ? 'bg-[#2a2318] border border-[#ff4e00] text-[#ff4e00] font-bold shadow-sm'
                          : 'bg-[#1a1a1a] hover:bg-[#252525] text-[#94a3b8] hover:text-[#e2e8f0] border border-[#262626]'
                      }`}
                    >
                      <span className="truncate max-w-[150px]">{loc.name}</span>
                      <div className="flex items-center gap-1">
                        {loc.visited && (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-sky-950 text-sky-400 font-normal">
                            сыграна
                          </span>
                        )}
                        <span className="text-[8px] text-[#666] px-1 py-0.2 rounded bg-[#0A0A0A]">
                          {loc.category}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setIsMapLibraryOpen(true)}
                className="w-full py-1.5 bg-[#222938] hover:bg-[#2c374d] text-white text-[10px] font-bold rounded flex items-center justify-center gap-1 transition cursor-pointer"
              >
                <FolderOpen className="w-3 h-3 text-[#38bdf8]" />
                <span>Открыть Библиотеку Карт (L)</span>
              </button>
            </section>

            {/* Секция 1: Инструменты Тумана Войны */}
            <section>
              <h3 className="text-[10px] text-[#888] font-bold uppercase mb-2.5 tracking-widest border-b border-[#2A2A2A] pb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-[#FF4E00]" />
                  <span>Туман войны (Fog of War)</span>
                </span>
                <span className="text-[9px] text-[#555]">R / H / M / P</span>
              </h3>

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
                  <span>ОТКРЫТЬ (R)</span>
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
                  <span>СКРЫТЬ (H)</span>
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
                  <span>ЛИНЕЙКА (M)</span>
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
                  <span>РУКА (P)</span>
                </button>
              </div>

              {/* Ползунки кисти и прозрачности */}
              <div className="mt-3.5 space-y-3">
                <div>
                  <div className="flex justify-between text-[9px] text-[#888] mb-1 uppercase">
                    <span>РАЗМЕР КИСТИ</span>
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
                    <span>ПРОЗРАЧНОСТЬ ТУМАНА ДЛЯ МАСТЕРА</span>
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
                  <span className="text-[8px] text-[#64748b] block mt-0.5 uppercase">
                    *ИГРОКИ ВСЕГДА ВИДЯТ 100% НЕПРОЗРАЧНЫЙ ЧЕРНЫЙ ТУМАН
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
                  СКРЫТЬ ВСЁ
                </button>
                <button
                  id="btn-fog-clear-all"
                  onClick={handleFogClearAll}
                  className="w-full py-1.5 text-[10px] bg-[#1A1A1A] border border-[#333] hover:bg-[#252525] hover:border-[#555] text-[#E0E0E0] uppercase transition-colors rounded cursor-pointer"
                >
                  ОТКРЫТЬ ВСЁ
                </button>
              </div>
            </section>

            {/* Секция 2: Настройки Сетки */}
            <section>
              <h3 className="text-[10px] text-[#888] font-bold uppercase mb-2.5 tracking-widest border-b border-[#2A2A2A] pb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Grid className="w-3 h-3 text-[#FF4E00]" />
                  <span>Тактическая Сетка</span>
                </span>
                <button
                  id="btn-toggle-grid"
                  onClick={() => updateGrid({ enabled: !grid.enabled })}
                  className={`px-2 py-0.5 text-[9px] rounded font-bold uppercase transition cursor-pointer ${
                    grid.enabled ? 'bg-[#FF4E00] text-black' : 'bg-[#2A2A2A] text-[#888]'
                  }`}
                >
                  {grid.enabled ? 'ВКЛ' : 'ВЫКЛ'}
                </button>
              </h3>

              {grid.enabled && (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[9px] text-[#888] mb-1 uppercase">
                      <span>РАЗМЕР КЛЕТКИ</span>
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
                    <span>ЦВЕТ СЕТКИ</span>
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
                        БЕЛ
                      </button>
                      <button
                        onClick={() => updateGrid({ color: '#000000' })}
                        className="text-[9px] px-1.5 py-0.5 bg-[#1A1A1A] border border-[#333] rounded hover:bg-[#2A2A2A] text-[#E0E0E0]"
                      >
                        ЧЕРН
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
              <span>Скачать Offline HTML</span>
            </button>
          </div>
        </aside>

        {/* 3. Основная рабочая область (Холст с картой, туманом и рамкой проектора) */}
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
          {/* Плашка переключения этажей (если загружен многоэтажный объект) */}
          {multiFloorGroup && multiFloorGroup.floors.length > 1 && (
            <div
              id="multi-floor-bar"
              className="absolute top-3 left-1/2 transform -translate-x-1/2 z-30 flex items-center gap-1 bg-[#12141a]/95 border border-amber-500/60 rounded-xl p-1 shadow-2xl "
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
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-amber-600 text-slate-950 shadow-md'
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
                    }`}
                    title={floor.floorTitle || floor.name}
                  >
                    {floor.floorLabel || `${floor.floorIndex}F`}
                  </button>
                );
              })}
            </div>
          )}

          {/* Индикатор статуса / подсказки сверху слева */}
          <div className="absolute top-3 left-4 z-20 flex items-center gap-2 pointer-events-none">
            <div className="px-3 py-1 bg-[#121212]/90 border border-[#2A2A2A] rounded text-[10px] text-[#888] flex items-center gap-2 uppercase">
              <span className="font-bold text-[#FF4E00] truncate max-w-[180px]">{media.name}</span>
              <span className="text-[#555]">|</span>
              <span>
                {media.width}×{media.height}PX
              </span>
              <span className="text-[#555]">|</span>
              <span className="text-[#E0E0E0]">ZOOM: {Math.round(viewport.scale * 100)}%</span>
            </div>

            {measurement.active && (
              <div className="px-3 py-1 bg-black/90 border border-[#FF4E00] rounded text-[10px] text-white font-mono uppercase">
                ДИСТАНЦИЯ: <strong className="text-[#FF4E00]">{distanceFeet} FT</strong> ({distanceCells} КЛЕТОК /{' '}
                {Math.round(distancePx)} PX)
              </div>
            )}
          </div>

          {/* Плавающая панель управления зумом на вьюпорте */}
          <div className="absolute top-4 right-4 flex flex-col gap-1 z-20">
            <button
              onClick={handleZoomIn}
              className="w-8 h-8 bg-black/80 border border-[#333] hover:border-[#FF4E00] text-[#E0E0E0] hover:text-[#FF4E00] flex items-center justify-center text-xs font-bold transition rounded cursor-pointer"
              title="Приблизить (+)"
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              className="w-8 h-8 bg-black/80 border border-[#333] hover:border-[#FF4E00] text-[#E0E0E0] hover:text-[#FF4E00] flex items-center justify-center text-xs font-bold transition rounded cursor-pointer"
              title="Отдалить (-)"
            >
              -
            </button>
            <button
              onClick={() => fitMapToScreen()}
              className="w-8 h-8 bg-black/80 border border-[#333] hover:border-[#FF4E00] text-[#E0E0E0] hover:text-[#FF4E00] flex items-center justify-center text-xs font-bold transition rounded cursor-pointer"
              title="Сбросить масштаб (Подогнать)"
            >
              ⟲
            </button>
          </div>

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

            {/* Слой 3: Холст Тумана Войны (Canvas 2D) */}
            <canvas
              id="fog-canvas-layer"
              ref={fogCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ width: `${media.width}px`, height: `${media.height}px` }}
            />

            {/* Слой 4: Рамка обзора экрана игроков (Player Viewport Frustum Frame) */}
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
        </section>
      </main>

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
    </div>
  );
};
