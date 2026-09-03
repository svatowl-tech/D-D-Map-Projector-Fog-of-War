/**
 * lib/appSettings.ts - Единый центр управления всеми системными настройками AetherMap VTT
 * Включает:
 * 1. Польза AI и текстовые/графические модели
 * 2. Системные промпты и стиль мастера D&D
 * 3. Второе окно / Проектор игроков (разрешение, цветокоррекция, блэкаут, синхронизация)
 * 4. Системные разрешения браузера (Wake Lock, Fullscreen, Audio, Clipboard, Storage)
 * 5. Рабочая папка AetherMap_Data и резервное копирование
 * 6. Параметры процедурных генераторов карт и 5E модулей
 * 7. Интерфейс, горячие клавиши и расширения
 */

import { getSetting, saveSetting } from './indexedDbStorage';
import { ProjectorSettingsSync } from './types';

export const APP_SETTINGS_KEY = '__aethermap_system_settings_v3__';

export interface PolzaAiSettings {
  apiKey: string;
  apiEndpoint: string;
  defaultTextModel: string;
  defaultImageModel: string;
  temperature: number;
  maxTokens: number;
  autoSaveToDisk: boolean;
  showReasoning: boolean;
  enableCoT: boolean;
  autoGenerateArtPrompt: boolean;
}

export interface SystemPromptSettings {
  masterPrompt: string;
  campaignSetting: string;
  tone: string;
  rulesEdition: '5e_2024' | '5e_2014' | 'osr';
  outputLanguage: 'ru' | 'en' | 'bilingual';
  dmGuidelines: string;
  quickPreset: string;
}

export interface PlayerDisplaySettings {
  resolutionPreset: '1920x1080' | '2560x1440' | '3840x2160' | '1366x768' | '1280x720' | 'custom';
  customWidth: number;
  customHeight: number;
  windowMode: 'popup' | 'tab';
  brightness: number; // 0.5 - 2.0, default 1.0
  contrast: number; // 0.5 - 2.0, default 1.0
  invertColors: boolean;
  blackout: boolean;
  showGridOnPlayer: boolean;
  showPingsOnPlayer: boolean;
  cameraSyncMode: 'free' | 'locked' | 'smooth';
  heartbeatIntervalMs: number;
  showStatusBanner: boolean;
}

export interface PermissionsSettings {
  wakeLockEnabled: boolean;
  fullscreen: boolean;
  audioAutoplayAllowed: boolean;
  clipboardAccessAllowed: boolean;
}

export interface WorkspaceSettings {
  rootDirName: string;
  subfolders: {
    maps: string;
    audio: string;
    campaigns: string;
    bestiary: string;
    exports: string;
  };
  autoSaveInterval: 'immediate' | '30s' | '1m' | '5m' | 'manual';
  backupFormat: 'json' | 'zip' | 'html';
  lastBackupTimestamp?: number;
}

export interface GeneratorsSettings {
  defaultBattlemapWidth: number;
  defaultBattlemapHeight: number;
  defaultCellSize: number;
  dungeonRoomDensity: 'low' | 'medium' | 'high';
  caveCellularSteps: number;
  lootMagicChance: number; // 0 - 100%
  shopPriceMultiplier: number; // 0.5 - 2.0x
  npcIncludeSecrets: boolean;
  crCalculationStandard: 'dmg_5e' | 'xanathar' | 'simplified';
}

export interface UiAndExtensionsSettings {
  theme: 'dark-tactical' | 'obsidian' | 'slate-navy' | 'amber-parchment';
  gridColor: string;
  gridOpacity: number;
  gridLineWidth: number;
  enableSfx: boolean;
  enableDiceRoll3d: boolean;
  showHotkeysOverlay: boolean;
  hotkeys: {
    reveal: string;
    hide: string;
    measure: string;
    pan: string;
    audio: string;
    library: string;
    generators: string;
  };
}

export interface AppSettings {
  version: number;
  polzaAi: PolzaAiSettings;
  systemPrompt: SystemPromptSettings;
  playerDisplay: PlayerDisplaySettings;
  permissions: PermissionsSettings;
  workspace: WorkspaceSettings;
  generators: GeneratorsSettings;
  uiAndExtensions: UiAndExtensionsSettings;
}

export const DEFAULT_MASTER_SYSTEM_PROMPT = `Ты — ведущий системный геймдизайнер и Мастер Подземелий (Dungeon Master) для правил D&D 5-й редакции.
Твоя цель: создавать богатый, кинематографичный и механически сбалансированный игровой контент на русском языке.
При генерации сущностей (монстры, NPC, заклинания, лавки, лут) строго придерживайся структуры JSON, точных математических формул бросков кубиков, DC спасбросков и правил видимости/укрытий.
Описания делай яркими, атмосферными, со звуками, запахами и скрытыми сюжетными крючками (plot hooks).`;

export function getDefaultSettings(): AppSettings {
  return {
    version: 3,
    polzaAi: {
      apiKey: '',
      apiEndpoint: 'https://api.polza.ai/v1',
      defaultTextModel: 'deepseek/deepseek-r1-distill-llama-70b',
      defaultImageModel: 'tongyi-mai/z-image',
      temperature: 0.7,
      maxTokens: 4096,
      autoSaveToDisk: true,
      showReasoning: true,
      enableCoT: true,
      autoGenerateArtPrompt: true,
    },
    systemPrompt: {
      masterPrompt: DEFAULT_MASTER_SYSTEM_PROMPT,
      campaignSetting: 'Готический хоррор',
      tone: 'Мрачная атмосфера и психологическое напряжение',
      rulesEdition: '5e_2024',
      outputLanguage: 'ru',
      dmGuidelines: 'Поощряй креативное использование окружения игроками. Монстры действуют тактически и отступают при падении HP ниже 25%.',
      quickPreset: 'gothic_horror',
    },
    playerDisplay: {
      resolutionPreset: '1920x1080',
      customWidth: 1920,
      customHeight: 1080,
      windowMode: 'popup',
      brightness: 1.0,
      contrast: 1.0,
      invertColors: false,
      blackout: false,
      showGridOnPlayer: true,
      showPingsOnPlayer: true,
      cameraSyncMode: 'free',
      heartbeatIntervalMs: 1500,
      showStatusBanner: false,
    },
    permissions: {
      wakeLockEnabled: true,
      fullscreen: false,
      audioAutoplayAllowed: true,
      clipboardAccessAllowed: true,
    },
    workspace: {
      rootDirName: 'AetherMap_Data',
      subfolders: {
        maps: 'maps',
        audio: 'audio',
        campaigns: 'campaigns',
        bestiary: 'bestiary',
        exports: 'exports',
      },
      autoSaveInterval: 'immediate',
      backupFormat: 'json',
    },
    generators: {
      defaultBattlemapWidth: 25,
      defaultBattlemapHeight: 25,
      defaultCellSize: 70,
      dungeonRoomDensity: 'medium',
      caveCellularSteps: 4,
      lootMagicChance: 35,
      shopPriceMultiplier: 1.0,
      npcIncludeSecrets: true,
      crCalculationStandard: 'dmg_5e',
    },
    uiAndExtensions: {
      theme: 'dark-tactical',
      gridColor: '#ffffff',
      gridOpacity: 0.25,
      gridLineWidth: 1,
      enableSfx: true,
      enableDiceRoll3d: true,
      showHotkeysOverlay: true,
      hotkeys: {
        reveal: 'R',
        hide: 'H',
        measure: 'M',
        pan: 'P',
        audio: 'Shift+M',
        library: 'L',
        generators: 'G',
      },
    },
  };
}

// Слушатели изменений настроек
type SettingsListener = (settings: AppSettings) => void;
const listeners: Set<SettingsListener> = new Set();

let cachedSettings: AppSettings | null = null;

export function subscribeSettings(cb: SettingsListener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notifySettingsChange(settings: AppSettings) {
  cachedSettings = settings;
  listeners.forEach((cb) => {
    try {
      cb(settings);
    } catch (err) {
      console.error('[Settings] Listener error:', err);
    }
  });
}

/**
 * Синхронное быстрое чтение (из памяти или localStorage)
 */
export function getInitialSettingsSync(): AppSettings {
  if (cachedSettings) return cachedSettings;
  const defaults = getDefaultSettings();
  if (typeof window === 'undefined') return defaults;

  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged = deepMerge(defaults, parsed) as AppSettings;
      cachedSettings = merged;
      return merged;
    }
  } catch (err) {
    console.warn('[Settings] Failed to parse local settings:', err);
  }

  cachedSettings = defaults;
  return defaults;
}

/**
 * Полная асинхронная загрузка из IndexedDB
 */
export async function loadAppSettings(): Promise<AppSettings> {
  const syncDefaults = getInitialSettingsSync();
  if (typeof window === 'undefined') return syncDefaults;

  try {
    const fromIdb = await getSetting<AppSettings>('app_settings_v3');
    if (fromIdb && typeof fromIdb === 'object') {
      const merged = deepMerge(getDefaultSettings(), fromIdb);
      cachedSettings = merged;
      // Дублируем в localStorage
      try {
        localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(merged));
      } catch {}
      return merged;
    }
  } catch (err) {
    console.warn('[Settings] Error loading from IndexedDB:', err);
  }

  return syncDefaults;
}

/**
 * Сохранение настроек в IndexedDB + localStorage + оповещение компонентов
 */
export async function saveAppSettings(settings: AppSettings): Promise<void> {
  cachedSettings = settings;
  notifySettingsChange(settings);

  if (typeof window === 'undefined') return;

  // 1. Сохранение в IndexedDB
  try {
    await saveSetting('app_settings_v3', settings);
  } catch (err) {
    console.warn('[Settings] Failed to save to IndexedDB:', err);
  }

  // 2. Сохранение в localStorage
  try {
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('[Settings] LocalStorage quota exceeded when saving settings:', err);
  }
}

/**
 * Создает объект синхронизации для окна проектора
 */
export function extractProjectorSync(settings: AppSettings): ProjectorSettingsSync {
  return {
    brightness: settings.playerDisplay.brightness,
    contrast: settings.playerDisplay.contrast,
    invertColors: settings.playerDisplay.invertColors,
    blackout: settings.playerDisplay.blackout,
    showGridOnPlayer: settings.playerDisplay.showGridOnPlayer,
    showPingsOnPlayer: settings.playerDisplay.showPingsOnPlayer,
  };
}

/**
 * Управление Wake Lock API (предотвращение засыпания экрана)
 */
let wakeLockSentinel: any = null;

export async function requestScreenWakeLock(): Promise<boolean> {
  if (typeof window === 'undefined' || !('wakeLock' in navigator)) {
    return false;
  }
  try {
    wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
    });
    return true;
  } catch (err) {
    console.warn('[WakeLock] Не удалось запросить блокировку экрана:', err);
    return false;
  }
}

export async function releaseScreenWakeLock(): Promise<void> {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch {}
    wakeLockSentinel = null;
  }
}

/**
 * Оценка свободного места в хранилище браузера
 */
export async function estimateStorageQuota(): Promise<{
  supported: boolean;
  usedBytes: number;
  quotaBytes: number;
  usedMb: number;
  quotaMb: number;
  percent: number;
}> {
  if (typeof window === 'undefined' || !navigator.storage || !navigator.storage.estimate) {
    return {
      supported: false,
      usedBytes: 0,
      quotaBytes: 0,
      usedMb: 0,
      quotaMb: 0,
      percent: 0,
    };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const used = estimate.usage || 0;
    const quota = estimate.quota || 1;
    return {
      supported: true,
      usedBytes: used,
      quotaBytes: quota,
      usedMb: Math.round(used / (1024 * 1024)),
      quotaMb: Math.round(quota / (1024 * 1024)),
      percent: Math.min(100, Math.round((used / quota) * 100)),
    };
  } catch {
    return {
      supported: false,
      usedBytes: 0,
      quotaBytes: 0,
      usedMb: 0,
      quotaMb: 0,
      percent: 0,
    };
  }
}

/**
 * Рекурсивное слияние объектов настроек
 */
function deepMerge(target: any, source: any): any {
  if (!source || typeof source !== 'object') return target;
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] !== undefined && source[key] !== null) {
      if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }
  return result;
}
