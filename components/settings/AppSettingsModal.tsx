'use client';

/**
 * components/settings/AppSettingsModal.tsx - Единый центр управления всеми настройками приложения
 * Охватывает:
 * - Польза AI и выбор моделей
 * - Системный промпт и стили мастера D&D
 * - Второе окно и проектор игроков (разрешения, блэкаут, цветокоррекция)
 * - Разрешения браузера (Wake Lock, Fullscreen, Clipboard, Storage)
 * - Рабочую папку AetherMap_Data и бэкапы
 * - Процедурные генераторы карт и параметры 5E
 * - Тему оформления, сетку и горячие клавиши
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Bot,
  Scroll,
  Monitor,
  ShieldCheck,
  FolderTree,
  Sparkles,
  Sliders,
  X,
  Check,
  Save,
  RefreshCw,
  Download,
  Upload,
  ExternalLink,
  Eye,
  EyeOff,
  Sun,
  Contrast,
  Moon,
  Zap,
  Volume2,
  Maximize2,
  HardDrive,
  Trash2,
  Key,
  Layers,
  HelpCircle,
} from 'lucide-react';
import {
  AppSettings,
  getDefaultSettings,
  loadAppSettings,
  saveAppSettings,
  requestScreenWakeLock,
  releaseScreenWakeLock,
  estimateStorageQuota,
  DEFAULT_MASTER_SYSTEM_PROMPT,
} from '@/lib/appSettings';
import { SavedMapLocation } from '@/lib/types';
import { loadMapLibrary, saveMapLibrary } from '@/lib/map-library';

interface AppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPlayerWindow?: () => void;
  onOpenUnifiedFolder?: () => void;
  onSettingsChange?: (newSettings: AppSettings) => void;
  showToast?: (msg: string) => void;
}

type TabType = 'ai' | 'prompt' | 'projector' | 'permissions' | 'workspace' | 'generators' | 'ui';

export const AppSettingsModal: React.FC<AppSettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenPlayerWindow,
  onOpenUnifiedFolder,
  onSettingsChange,
  showToast = () => {},
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('ai');
  const [settings, setSettings] = useState<AppSettings>(getDefaultSettings());
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [isTestingApi, setIsTestingApi] = useState<boolean>(false);
  const [apiStatusMessage, setApiStatusMessage] = useState<string | null>(null);

  // Storage info
  const [storageInfo, setStorageInfo] = useState<{
    supported: boolean;
    usedMb: number;
    quotaMb: number;
    percent: number;
  }>({ supported: false, usedMb: 0, quotaMb: 0, percent: 0 });

  // Wake lock status
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);

  // Backup input ref
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);

  // Load settings on open
  useEffect(() => {
    if (isOpen) {
      loadAppSettings().then((loaded) => {
        setSettings(loaded);
      });
      estimateStorageQuota().then((info) => {
        setStorageInfo(info);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle immediate setting update
  const updateSetting = <K extends keyof Omit<AppSettings, 'version'>>(
    category: K,
    key: keyof AppSettings[K],
    value: any
  ) => {
    setSettings((prev) => {
      const currentCategoryObj = (prev[category] as Record<string, any>) || {};
      const updated: AppSettings = {
        ...prev,
        [category]: {
          ...currentCategoryObj,
          [key as string]: value,
        },
      };
      saveAppSettings(updated).catch(() => {});
      onSettingsChange?.(updated);
      return updated;
    });
  };

  // Save all explicitly
  const handleSaveAll = async () => {
    await saveAppSettings(settings);
    onSettingsChange?.(settings);
    showToast('Настройки успешно сохранены!');
    onClose();
  };

  // Reset to defaults
  const handleResetDefaults = async () => {
    if (window.confirm('Сбросить все системные настройки к значениям по умолчанию?')) {
      const defaults = getDefaultSettings();
      setSettings(defaults);
      await saveAppSettings(defaults);
      onSettingsChange?.(defaults);
      showToast('Все настройки сброшены к исходным.');
    }
  };

  // Test Polza AI API Connection
  const handleTestApiConnection = async () => {
    setIsTestingApi(true);
    setApiStatusMessage(null);
    try {
      const res = await fetch('/api/polza/status');
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setApiStatusMessage(`Подключение успешно! ${data.hasKey ? 'Ключ найден в системе.' : 'Внимание: ключ не задан в .env'}`);
      } else {
        setApiStatusMessage(`Ошибка подключения: ${data.error || 'Проверьте настройки API'}`);
      }
    } catch (err: any) {
      setApiStatusMessage(`Сетевая ошибка: ${err.message || 'Сервер недоступен'}`);
    } finally {
      setIsTestingApi(false);
    }
  };

  // Toggle Screen Wake Lock
  const handleToggleWakeLock = async () => {
    if (wakeLockActive) {
      await releaseScreenWakeLock();
      setWakeLockActive(false);
      updateSetting('permissions', 'wakeLockEnabled', false);
      showToast('Блокировка сна экрана отключена.');
    } else {
      const ok = await requestScreenWakeLock();
      if (ok) {
        setWakeLockActive(true);
        updateSetting('permissions', 'wakeLockEnabled', true);
        showToast('Экран останется включенным во время игры.');
      } else {
        showToast('Wake Lock API не поддерживается данным браузером.');
      }
    }
  };

  // Toggle Fullscreen
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      updateSetting('permissions', 'fullscreen', true);
    } else {
      document.exitFullscreen().catch(() => {});
      updateSetting('permissions', 'fullscreen', false);
    }
  };

  // Export full campaign backup JSON
  const handleExportFullBackup = async () => {
    try {
      const maps = await loadMapLibrary();
      const backupData = {
        meta: {
          app: 'AetherMap VTT',
          version: '3.0',
          exportedAt: new Date().toISOString(),
          timestamp: Date.now(),
        },
        settings,
        maps,
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AetherMap_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Резервная копия кампании успешно выгружена!');
    } catch (err: any) {
      showToast(`Ошибка экспорта бэкапа: ${err.message}`);
    }
  };

  // Import full campaign backup JSON
  const handleImportBackupFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);

        if (!data || typeof data !== 'object') {
          throw new Error('Некорректный формат JSON');
        }

        if (data.settings) {
          setSettings(data.settings);
          await saveAppSettings(data.settings);
        }

        if (Array.isArray(data.maps) && data.maps.length > 0) {
          saveMapLibrary(data.maps as SavedMapLocation[]);
        }

        showToast(`Бэкап успешно восстановлен! Загружено карт: ${data.maps?.length || 0}`);
      } catch (err: any) {
        showToast(`Ошибка восстановления бэкапа: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Clear fog on all maps
  const handleClearAllFogs = async () => {
    if (window.confirm('Сбросить весь туман войны на всех сохраненных картах кампании?')) {
      const maps = await loadMapLibrary();
      const updated = maps.map((m) => ({
        ...m,
        fogActions: [],
        isFogBaseFilled: false,
      }));
      saveMapLibrary(updated);
      showToast('Туман войны очищен на всех картах.');
    }
  };

  // System Prompt Presets
  const PROMPT_PRESETS: Record<string, { setting: string; tone: string; guidelines: string }> = {
    gothic_horror: {
      setting: 'Готический хоррор (Ravenloft / Dark Fantasy)',
      tone: 'Мрачная атмосфера, холодный страх, психологическое напряжение',
      guidelines: 'Подчеркивай ограниченность ресурсов, темноту, шорохи, туман и недоверие местных жителей.',
    },
    high_fantasy: {
      setting: 'Эпическое Высокое Фэнтези (Forgotten Realms)',
      tone: 'Героический пафос, древняя магия, яркие контрасты добра и зла',
      guidelines: 'Описывай монументальные артефакты, величие магов и рыцарскую доблесть.',
    },
    magipunk: {
      setting: 'Магопанк & Эберрон (Eberron / Arcane Tech)',
      tone: 'Динамичный нуар, магические технологии, шпионаж и поезда молний',
      guidelines: 'Используй стилистику паропанка и магии кристаллов, тайные организации и продажных чиновников.',
    },
    mystery: {
      setting: 'Мистика и Оккультный Детектив',
      tone: 'Загадочность, скрытые улики, древние культы и шифры',
      guidelines: 'Каждая встреча должна давать зацепку или вызывать подозрение. Не раскрывай монстров сразу.',
    },
    whimsical: {
      setting: 'Сказка & Причудливый D&D (Feywild)',
      tone: 'Волшебство, юмор, эксцентричные персонажи и непредсказуемая фауна',
      guidelines: 'Используй парадоксальные загадки, фейские клятвы и забавные побочные эффекты магии.',
    },
  };

  const applyPromptPreset = (presetKey: string) => {
    const preset = PROMPT_PRESETS[presetKey];
    if (preset) {
      setSettings((prev) => {
        const updated = {
          ...prev,
          systemPrompt: {
            ...prev.systemPrompt,
            quickPreset: presetKey,
            campaignSetting: preset.setting,
            tone: preset.tone,
            dmGuidelines: preset.guidelines,
          },
        };
        saveAppSettings(updated).catch(() => {});
        return updated;
      });
      showToast(`Применен стиль: ${preset.setting}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 animate-fadeIn">
      <div
        id="app-settings-modal"
        className="relative flex flex-col w-full max-w-5xl h-[92vh] max-h-[900px] rounded-xl border border-[var(--ink-faint)] bg-[var(--surface)] text-[var(--ink-bright)] shadow-2xl overflow-hidden"
      >
        {/* Шапка модального окна */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--ink-faint)] bg-[#0c0c0e] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-['Syne'] tracking-wide">
                  Центр Управления Настройками
                </h2>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--ink-faint)] text-[var(--accent)]">
                  System v3.0
                </span>
              </div>
              <p className="text-xs text-[var(--ink-muted)]">
                Конфигурация AI, второго экрана, системных разрешений, рабочей папки и генераторов
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-settings-save-top"
              onClick={handleSaveAll}
              className="btn btn-accent flex items-center gap-1.5 text-xs py-1.5 px-3"
              title="Сохранить и закрыть"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Сохранить</span>
            </button>
            <button
              id="btn-settings-close-top"
              onClick={onClose}
              className="btn flex items-center justify-center w-8 h-8 p-0 text-[var(--ink-muted)] hover:text-white"
              title="Закрыть настройки"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Тело окна: Вкладки слева + Контент справа */}
        <div className="flex flex-1 overflow-hidden">
          {/* Боковая навигация категорий */}
          <nav className="w-56 sm:w-64 border-r border-[var(--ink-faint)] bg-[#0e0e11] p-3 flex flex-col gap-1 shrink-0 overflow-y-auto">
            <span className="label-meta px-3 pt-2 mb-1">Разделы настроек</span>

            <button
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition text-left ${
                activeTab === 'ai'
                  ? 'bg-[var(--accent)] text-white font-semibold shadow-md'
                  : 'text-[var(--ink-muted)] hover:bg-[var(--surface-raised)] hover:text-white'
              }`}
            >
              <Bot className="w-4 h-4 shrink-0" />
              <span>Польза AI & Модели</span>
            </button>

            <button
              onClick={() => setActiveTab('prompt')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition text-left ${
                activeTab === 'prompt'
                  ? 'bg-[var(--accent)] text-white font-semibold shadow-md'
                  : 'text-[var(--ink-muted)] hover:bg-[var(--surface-raised)] hover:text-white'
              }`}
            >
              <Scroll className="w-4 h-4 shrink-0" />
              <span>Системный Промпт & DM</span>
            </button>

            <button
              onClick={() => setActiveTab('projector')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition text-left ${
                activeTab === 'projector'
                  ? 'bg-[var(--accent)] text-white font-semibold shadow-md'
                  : 'text-[var(--ink-muted)] hover:bg-[var(--surface-raised)] hover:text-white'
              }`}
            >
              <Monitor className="w-4 h-4 shrink-0" />
              <span>Второе Окно & Проектор</span>
            </button>

            <button
              onClick={() => setActiveTab('permissions')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition text-left ${
                activeTab === 'permissions'
                  ? 'bg-[var(--accent)] text-white font-semibold shadow-md'
                  : 'text-[var(--ink-muted)] hover:bg-[var(--surface-raised)] hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Разрешения & Браузер</span>
            </button>

            <button
              onClick={() => setActiveTab('workspace')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition text-left ${
                activeTab === 'workspace'
                  ? 'bg-[var(--accent)] text-white font-semibold shadow-md'
                  : 'text-[var(--ink-muted)] hover:bg-[var(--surface-raised)] hover:text-white'
              }`}
            >
              <FolderTree className="w-4 h-4 shrink-0" />
              <span>Рабочая Папка & Бэкап</span>
            </button>

            <button
              onClick={() => setActiveTab('generators')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition text-left ${
                activeTab === 'generators'
                  ? 'bg-[var(--accent)] text-white font-semibold shadow-md'
                  : 'text-[var(--ink-muted)] hover:bg-[var(--surface-raised)] hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Генераторы & Модули 5E</span>
            </button>

            <button
              onClick={() => setActiveTab('ui')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition text-left ${
                activeTab === 'ui'
                  ? 'bg-[var(--accent)] text-white font-semibold shadow-md'
                  : 'text-[var(--ink-muted)] hover:bg-[var(--surface-raised)] hover:text-white'
              }`}
            >
              <Sliders className="w-4 h-4 shrink-0" />
              <span>Интерфейс & Клавиши</span>
            </button>

            <div className="mt-auto pt-4 border-t border-[var(--ink-faint)] flex flex-col gap-2">
              <button
                onClick={handleResetDefaults}
                className="btn text-[11px] py-1.5 text-[var(--ink-muted)] hover:text-red-400 justify-start"
                title="Сбросить все параметры к заводским"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Сброс настроек</span>
              </button>
            </div>
          </nav>

          {/* Содержимое выбранной вкладки */}
          <main className="flex-1 p-6 overflow-y-auto bg-[var(--surface)]">
            {/* 1. ПОЛЬЗА AI & МОДЕЛИ */}
            {activeTab === 'ai' && (
              <div className="space-y-6 max-w-3xl">
                <div>
                  <h3 className="text-base font-bold font-['Syne'] flex items-center gap-2">
                    <Bot className="w-5 h-5 text-[var(--accent)]" />
                    <span>Конфигурация Польза AI</span>
                  </h3>
                  <p className="text-xs text-[var(--ink-muted)] mt-1">
                    Параметры интеграции нейросетей, ключи доступа и модели генерации D&D контента
                  </p>
                </div>

                {/* API Key */}
                <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Персональный API Ключ (Polza AI)</span>
                    </label>
                    <span className="text-[10px] text-[var(--ink-muted)]">
                      Если пусто, используется системный POLZA_API_KEY
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.polzaAi.apiKey}
                        onChange={(e) => updateSetting('polzaAi', 'apiKey', e.target.value)}
                        placeholder="sk-polza-..."
                        className="w-full bg-[#161619] border border-[var(--ink-faint)] rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-[var(--accent)] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] hover:text-white text-xs"
                      >
                        {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <button
                      onClick={handleTestApiConnection}
                      disabled={isTestingApi}
                      className="btn flex items-center gap-1.5 text-xs px-3 shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingApi ? 'animate-spin' : ''}`} />
                      <span>{isTestingApi ? 'Тест...' : 'Проверить'}</span>
                    </button>
                  </div>

                  {apiStatusMessage && (
                    <div className="text-[11px] font-mono px-3 py-1.5 rounded bg-[var(--ink-faint)] text-[#38bdf8]">
                      {apiStatusMessage}
                    </div>
                  )}
                </div>

                {/* Выбор моделей */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-2">
                    <label className="text-xs font-bold text-white block">
                      Основная текстовая модель (D&D 5E Logic)
                    </label>
                    <select
                      value={settings.polzaAi.defaultTextModel}
                      onChange={(e) => updateSetting('polzaAi', 'defaultTextModel', e.target.value)}
                      className="w-full bg-[#161619] border border-[var(--ink-faint)] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[var(--accent)]"
                    >
                      <option value="deepseek/deepseek-r1-distill-llama-70b">
                        DeepSeek R1 Distill Llama 70B (Рекомендуется)
                      </option>
                      <option value="deepseek/deepseek-v3">DeepSeek V3 (Быстрая логика)</option>
                      <option value="qwen/qwen-2.5-72b-instruct">Qwen 2.5 72B Instruct</option>
                      <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B Instruct</option>
                    </select>
                    <p className="text-[10px] text-[var(--ink-muted)]">
                      Используется для генерации сбалансированных статблоков монстров, NPC и кампаний.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-2">
                    <label className="text-xs font-bold text-white block">
                      Графическая модель (Арт и Токены)
                    </label>
                    <select
                      value={settings.polzaAi.defaultImageModel}
                      onChange={(e) => updateSetting('polzaAi', 'defaultImageModel', e.target.value)}
                      className="w-full bg-[#161619] border border-[var(--ink-faint)] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[var(--accent)]"
                    >
                      <option value="tongyi-mai/z-image">Z-Image (Fantasy RPG Portrait)</option>
                      <option value="black-forest-labs/flux-1-schnell">Flux 1 Schnell (Ультра-скорость)</option>
                      <option value="stabilityai/stable-diffusion-3.5-large">SD 3.5 Large (Высокая детализация)</option>
                    </select>
                    <p className="text-[10px] text-[var(--ink-muted)]">
                      Создание атмосферных иллюстраций персонажей, локаций и токенов монстров.
                    </p>
                  </div>
                </div>

                {/* Температура и Токены */}
                <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-white">Креативность (Temperature)</span>
                      <span className="text-xs font-mono text-[var(--accent)]">
                        {settings.polzaAi.temperature}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={settings.polzaAi.temperature}
                      onChange={(e) => updateSetting('polzaAi', 'temperature', parseFloat(e.target.value))}
                    />
                    <div className="flex justify-between text-[10px] text-[var(--ink-muted)] mt-1">
                      <span>0.1 (Строгие правила 5e)</span>
                      <span>0.7 (Баланс сюжета)</span>
                      <span>1.0 (Непредсказуемость)</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--ink-faint)]">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-white">Максимум токенов ответа</span>
                      <span className="text-xs font-mono text-white">
                        {settings.polzaAi.maxTokens} токенов
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {[1024, 2048, 4096, 8192].map((tokens) => (
                        <button
                          key={tokens}
                          onClick={() => updateSetting('polzaAi', 'maxTokens', tokens)}
                          className={`btn text-xs py-1.5 ${
                            settings.polzaAi.maxTokens === tokens ? 'btn-accent' : ''
                          }`}
                        >
                          {tokens}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Дополнительные тумблеры */}
                <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-3">
                  <span className="text-xs font-bold text-white block mb-1">Поведение AI Studio</span>

                  <label className="flex items-center justify-between cursor-pointer py-1">
                    <div>
                      <div className="text-xs font-medium text-white">
                        Автосохранение сущностей в кампанию
                      </div>
                      <div className="text-[10px] text-[var(--ink-muted)]">
                        Сгенерированные монстры и NPC сразу попадают в каталог кампании
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.polzaAi.autoSaveToDisk}
                      onChange={(e) => updateSetting('polzaAi', 'autoSaveToDisk', e.target.checked)}
                      className="w-4 h-4 accent-[var(--accent)]"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer py-1 border-t border-[var(--ink-faint)]">
                    <div>
                      <div className="text-xs font-medium text-white">
                        Отображение хода мыслей модели (Chain of Thought)
                      </div>
                      <div className="text-[10px] text-[var(--ink-muted)]">
                        Показывать блок рассуждений &lt;think&gt; DeepSeek R1
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.polzaAi.showReasoning}
                      onChange={(e) => updateSetting('polzaAi', 'showReasoning', e.target.checked)}
                      className="w-4 h-4 accent-[var(--accent)]"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* 2. СИСТЕМНЫЙ ПРОМПТ & СТИЛЬ DM */}
            {activeTab === 'prompt' && (
              <div className="space-y-6 max-w-3xl">
                <div>
                  <h3 className="text-base font-bold font-['Syne'] flex items-center gap-2">
                    <Scroll className="w-5 h-5 text-[var(--accent)]" />
                    <span>Системный Промпт & Личность Мастера D&D</span>
                  </h3>
                  <p className="text-xs text-[var(--ink-muted)] mt-1">
                    Глобальные инструкции и стиль повествования, внедряемые во все запросы генерации
                  </p>
                </div>

                {/* Быстрые пресеты стиля кампании */}
                <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-2">
                  <label className="text-xs font-bold text-white block">
                    Пресеты стиля и атмосферы кампании
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(PROMPT_PRESETS).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => applyPromptPreset(key)}
                        className={`btn text-xs py-2 text-left flex flex-col items-start ${
                          settings.systemPrompt.quickPreset === key ? 'btn-accent' : ''
                        }`}
                      >
                        <span className="font-semibold truncate w-full">{val.setting.split('(')[0]}</span>
                        <span className="text-[9px] opacity-75 truncate w-full">{val.tone}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Главный системный промпт */}
                <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-white">
                      Мастер-инструкция для AI (System Prompt)
                    </label>
                    <button
                      onClick={() => updateSetting('systemPrompt', 'masterPrompt', DEFAULT_MASTER_SYSTEM_PROMPT)}
                      className="text-[10px] text-[var(--accent)] hover:underline"
                    >
                      Сбросить к эталону D&D 5e
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={settings.systemPrompt.masterPrompt}
                    onChange={(e) => updateSetting('systemPrompt', 'masterPrompt', e.target.value)}
                    className="w-full bg-[#161619] border border-[var(--ink-faint)] rounded-lg p-3 text-xs font-mono text-white outline-none focus:border-[var(--accent)] resize-y leading-relaxed"
                  />
                  <p className="text-[10px] text-[var(--ink-muted)]">
                    Этот промпт задает роль ведущего геймдизайнера и формулирует стандарты математики d20.
                  </p>
                </div>

                {/* Параметры редакции и языка */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-2">
                    <label className="text-xs font-bold text-white block">Редакция правил</label>
                    <select
                      value={settings.systemPrompt.rulesEdition}
                      onChange={(e) => updateSetting('systemPrompt', 'rulesEdition', e.target.value)}
                      className="w-full bg-[#161619] border border-[var(--ink-faint)] rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                    >
                      <option value="5e_2024">D&D 5e (2024 Revised)</option>
                      <option value="5e_2014">D&D 5e (2014 Classic)</option>
                      <option value="osr">OSR / Старая школа</option>
                    </select>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-2">
                    <label className="text-xs font-bold text-white block">Язык генерации</label>
                    <select
                      value={settings.systemPrompt.outputLanguage}
                      onChange={(e) => updateSetting('systemPrompt', 'outputLanguage', e.target.value)}
                      className="w-full bg-[#161619] border border-[var(--ink-faint)] rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                    >
                      <option value="ru">Русский язык</option>
                      <option value="bilingual">Двуязычный (Русский + En термины)</option>
                      <option value="en">English (Original D&D SRD)</option>
                    </select>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-2">
                    <label className="text-xs font-bold text-white block">Сеттинг мира</label>
                    <input
                      type="text"
                      value={settings.systemPrompt.campaignSetting}
                      onChange={(e) => updateSetting('systemPrompt', 'campaignSetting', e.target.value)}
                      className="w-full bg-[#161619] border border-[var(--ink-faint)] rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                      placeholder="Готический хоррор..."
                    />
                  </div>
                </div>

                {/* Домашние правила (House Rules) */}
                <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-2">
                  <label className="text-xs font-bold text-white block">
                    Домашние правила мастера (House Rules & Lore Context)
                  </label>
                  <textarea
                    rows={3}
                    value={settings.systemPrompt.dmGuidelines}
                    onChange={(e) => updateSetting('systemPrompt', 'dmGuidelines', e.target.value)}
                    className="w-full bg-[#161619] border border-[var(--ink-faint)] rounded-lg p-3 text-xs text-white outline-none focus:border-[var(--accent)]"
                    placeholder="Например: Зелья лечения пьются бонусным действием. Воскрешение требует личной жертвы..."
                  />
                </div>
              </div>
            )}

            {/* 3. ВТОРОЕ ОКНО & ПРОЕКТОР */}
            {activeTab === 'projector' && (
              <div className="space-y-6 max-w-3xl">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-bold font-['Syne'] flex items-center gap-2">
                      <Monitor className="w-5 h-5 text-[var(--accent)]" />
                      <span>Второе Окно & Проектор Игроков</span>
                    </h3>
                    <p className="text-xs text-[var(--ink-muted)] mt-1">
                      Управление вторым экраном для проектора на стол или ТВ-панели
                    </p>
                  </div>

                  {onOpenPlayerWindow && (
                    <button
                      onClick={onOpenPlayerWindow}
                      className="btn btn-accent flex items-center gap-1.5 text-xs py-1.5 px-3"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Открыть окно игроков</span>
                    </button>
                  )}
                </div>

                {/* Разрешение проектора */}
                <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-3">
                  <label className="text-xs font-bold text-white block">
                    Целевое разрешение экрана игроков
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: '1920x1080', label: '1920×1080 (Full HD)', w: 1920, h: 1080 },
                      { id: '2560x1440', label: '2560×1440 (2K QHD)', w: 2560, h: 1440 },
                      { id: '3840x2160', label: '3840×2160 (4K UHD)', w: 3840, h: 2160 },
                      { id: '1366x768', label: '1366×768 (Ноутбук)', w: 1366, h: 768 },
                      { id: '1280x720', label: '1280×720 (720p HD)', w: 1280, h: 720 },
                      { id: 'custom', label: 'Пользовательское', w: 0, h: 0 },
                    ].map((res) => (
                      <button
                        key={res.id}
                        onClick={() => {
                          updateSetting('playerDisplay', 'resolutionPreset', res.id);
                          if (res.id !== 'custom') {
                            updateSetting('playerDisplay', 'customWidth', res.w);
                            updateSetting('playerDisplay', 'customHeight', res.h);
                          }
                        }}
                        className={`btn text-xs py-2 ${
                          settings.playerDisplay.resolutionPreset === res.id ? 'btn-accent' : ''
                        }`}
                      >
                        {res.label}
                      </button>
                    ))}
                  </div>

                  {settings.playerDisplay.resolutionPreset === 'custom' && (
                    <div className="flex gap-3 items-center pt-2">
                      <div className="flex-1">
                        <span className="text-[10px] text-[var(--ink-muted)] block mb-1">Ширина (PX)</span>
                        <input
                          type="number"
                          value={settings.playerDisplay.customWidth}
                          onChange={(e) => updateSetting('playerDisplay', 'customWidth', parseInt(e.target.value, 10))}
                          className="w-full bg-[#161619] border border-[var(--ink-faint)] rounded-lg p-2 text-xs text-white"
                        />
                      </div>
                      <span className="text-[var(--ink-muted)] mt-4">×</span>
                      <div className="flex-1">
                        <span className="text-[10px] text-[var(--ink-muted)] block mb-1">Высота (PX)</span>
                        <input
                          type="number"
                          value={settings.playerDisplay.customHeight}
                          onChange={(e) => updateSetting('playerDisplay', 'customHeight', parseInt(e.target.value, 10))}
                          className="w-full bg-[#161619] border border-[var(--ink-faint)] rounded-lg p-2 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Цветокоррекция для проекторов */}
                <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sun className="w-4 h-4 text-amber-400" />
                      <span>Цветокоррекция проектора (Калибровка оптики)</span>
                    </span>
                    <button
                      onClick={() => {
                        updateSetting('playerDisplay', 'brightness', 1.0);
                        updateSetting('playerDisplay', 'contrast', 1.0);
                        updateSetting('playerDisplay', 'invertColors', false);
                      }}
                      className="text-[10px] text-[var(--ink-muted)] hover:text-white"
                    >
                      Сброс калибровки
                    </button>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-[var(--ink-muted)]">Яркость (Brightness)</span>
                      <span className="text-xs font-mono text-white">
                        {Math.round(settings.playerDisplay.brightness * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="1.8"
                      step="0.05"
                      value={settings.playerDisplay.brightness}
                      onChange={(e) => updateSetting('playerDisplay', 'brightness', parseFloat(e.target.value))}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-[var(--ink-muted)]">Контрастность (Contrast)</span>
                      <span className="text-xs font-mono text-white">
                        {Math.round(settings.playerDisplay.contrast * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="1.8"
                      step="0.05"
                      value={settings.playerDisplay.contrast}
                      onChange={(e) => updateSetting('playerDisplay', 'contrast', parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="pt-2 border-t border-[var(--ink-faint)] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-white">Инверсия цветов карты</div>
                      <div className="text-[10px] text-[var(--ink-muted)]">
                        Превращает светлые карты в ночные контурные схемы
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.playerDisplay.invertColors}
                      onChange={(e) => updateSetting('playerDisplay', 'invertColors', e.target.checked)}
                      className="w-4 h-4 accent-[var(--accent)]"
                    />
                  </div>
                </div>

                {/* Блэкаут и отображение сетки */}
                <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-3">
                  <span className="text-xs font-bold text-white block mb-1">Режимы показа</span>

                  <label className="flex items-center justify-between cursor-pointer py-1">
                    <div>
                      <div className="text-xs font-medium text-white">
                        Блэкаут проектора (Черный экран «Театр теней»)
                      </div>
                      <div className="text-[10px] text-[var(--ink-muted)]">
                        Мгновенно скрывает карту от игроков до начала боевой сцены
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.playerDisplay.blackout}
                      onChange={(e) => updateSetting('playerDisplay', 'blackout', e.target.checked)}
                      className="w-4 h-4 accent-[var(--accent)]"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer py-1 border-t border-[var(--ink-faint)]">
                    <div>
                      <div className="text-xs font-medium text-white">Отображать сетку на экране игроков</div>
                      <div className="text-[10px] text-[var(--ink-muted)]">
                        Показывать тактическую сетку дюймов/клеток для миниатюр
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.playerDisplay.showGridOnPlayer}
                      onChange={(e) => updateSetting('playerDisplay', 'showGridOnPlayer', e.target.checked)}
                      className="w-4 h-4 accent-[var(--accent)]"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer py-1 border-t border-[var(--ink-faint)]">
                    <div>
                      <div className="text-xs font-medium text-white">Отображать пинги мастера</div>
                      <div className="text-[10px] text-[var(--ink-muted)]">
                        Показывать анимированные маркеры внимания игроков
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.playerDisplay.showPingsOnPlayer}
                      onChange={(e) => updateSetting('playerDisplay', 'showPingsOnPlayer', e.target.checked)}
                      className="w-4 h-4 accent-[var(--accent)]"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* 4. РАЗРЕШЕНИЯ & БРАУЗЕР */}
            {activeTab === 'permissions' && (
              <div className="space-y-6 max-w-3xl">
                <div>
                  <h3 className="text-base font-bold font-['Syne'] flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[var(--accent)]" />
                    <span>Системные Разрешения & Браузер</span>
                  </h3>
                  <p className="text-xs text-[var(--ink-muted)] mt-1">
                    Управление доступом к системным API операционной системы и хранилищу браузера
                  </p>
                </div>

                {/* Screen Wake Lock API */}
                <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>Блокировка засыпания экрана (Screen Wake Lock API)</span>
                    </div>
                    <div className="text-[11px] text-[var(--ink-muted)] mt-1">
                      Предотвращает отключение экрана и засыпание проектора во время длительных пауз
                    </div>
                    <div className="text-[10px] font-mono mt-1 text-[var(--accent)]">
                      {wakeLockActive ? '● WAKE LOCK АКТИВЕН' : '○ WAKE LOCK НЕ АКТИВЕН'}
                    </div>
                  </div>

                  <button
                    onClick={handleToggleWakeLock}
                    className={`btn text-xs py-1.5 px-3 ${wakeLockActive ? 'btn-accent' : ''}`}
                  >
                    {wakeLockActive ? 'Отключить' : 'Включить'}
                  </button>
                </div>

                {/* Fullscreen API */}
                <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Maximize2 className="w-4 h-4 text-[#38bdf8]" />
                      <span>Полноэкранный режим (Fullscreen API)</span>
                    </div>
                    <div className="text-[11px] text-[var(--ink-muted)] mt-1">
                      Разворачивает интерфейс на весь экран без системных панелей браузера
                    </div>
                  </div>

                  <button onClick={handleToggleFullscreen} className="btn text-xs py-1.5 px-3">
                    Переключить (F11)
                  </button>
                </div>

                {/* Storage Quota & IndexedDB */}
                <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4 text-emerald-400" />
                      <span>Дисковая квота браузера (IndexedDB + Storage)</span>
                    </span>
                    <span className="text-xs font-mono text-emerald-400">
                      {storageInfo.usedMb} MB / {storageInfo.quotaMb} MB ({storageInfo.percent}%)
                    </span>
                  </div>

                  {/* Шкала квоты */}
                  <div className="w-full bg-[#1c1c20] h-2.5 rounded-full overflow-hidden border border-[var(--ink-faint)]">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${Math.max(2, storageInfo.percent)}%` }}
                    />
                  </div>

                  <p className="text-[10px] text-[var(--ink-muted)]">
                    Карты высокого разрешения, токены, многослойные подземелья и треки сохраняются в IndexedDB без ограничения квоты 5MB.
                  </p>

                  <div className="pt-2 border-t border-[var(--ink-faint)] flex items-center justify-between">
                    <span className="text-xs text-[var(--ink-muted)]">Сброс тумана войны всех карт:</span>
                    <button
                      onClick={handleClearAllFogs}
                      className="btn text-xs py-1 px-2.5 text-amber-400"
                    >
                      Очистить все туманы
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 5. РАБОЧАЯ ПАПКА & БЭКАП */}
            {activeTab === 'workspace' && (
              <div className="space-y-6 max-w-3xl">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-bold font-['Syne'] flex items-center gap-2">
                      <FolderTree className="w-5 h-5 text-[var(--accent)]" />
                      <span>Рабочая Папка AetherMap_Data & Резервные Копии</span>
                    </h3>
                    <p className="text-xs text-[var(--ink-muted)] mt-1">
                      Файловая организация материалов кампании, синхронизация и полный бэкап
                    </p>
                  </div>

                  {onOpenUnifiedFolder && (
                    <button
                      onClick={onOpenUnifiedFolder}
                      className="btn flex items-center gap-1.5 text-xs py-1.5 px-3"
                    >
                      <HardDrive className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Открыть проводник</span>
                    </button>
                  )}
                </div>

                {/* Корневая папка */}
                <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-white">
                      Имя корневой папки ресурсов
                    </label>
                    <span className="text-[10px] font-mono text-[var(--accent)]">
                      /{settings.workspace.rootDirName}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={settings.workspace.rootDirName}
                    onChange={(e) => updateSetting('workspace', 'rootDirName', e.target.value)}
                    className="w-full bg-[#161619] border border-[var(--ink-faint)] rounded-lg p-2.5 text-xs font-mono text-white outline-none"
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                    <div className="p-2 rounded bg-[#161619] border border-[var(--ink-faint)] text-[10px] font-mono text-[var(--ink-muted)]">
                      📁 /maps (Боевые карты)
                    </div>
                    <div className="p-2 rounded bg-[#161619] border border-[var(--ink-faint)] text-[10px] font-mono text-[var(--ink-muted)]">
                      🎵 /audio (Саундтреки & SFX)
                    </div>
                    <div className="p-2 rounded bg-[#161619] border border-[var(--ink-faint)] text-[10px] font-mono text-[var(--ink-muted)]">
                      📜 /campaigns (Сюжеты & НПС)
                    </div>
                    <div className="p-2 rounded bg-[#161619] border border-[var(--ink-faint)] text-[10px] font-mono text-[var(--ink-muted)]">
                      🐲 /bestiary (Монстры 5E)
                    </div>
                    <div className="p-2 rounded bg-[#161619] border border-[var(--ink-faint)] text-[10px] font-mono text-[var(--ink-muted)]">
                      📦 /exports (Выгрузки & HTML)
                    </div>
                  </div>
                </div>

                {/* Резервное копирование кампании */}
                <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-3">
                  <label className="text-xs font-bold text-white block">
                    Полный бэкап кампании (Экспорт / Импорт)
                  </label>
                  <p className="text-xs text-[var(--ink-muted)]">
                    Создает автономный архив со всеми сохраненными картами, геометрией тумана, заметками мастера и параметрами системы.
                  </p>

                  <div className="flex flex-wrap gap-3 pt-1">
                    <button
                      onClick={handleExportFullBackup}
                      className="btn btn-accent flex items-center gap-1.5 text-xs py-2 px-3.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Скачать JSON бэкап</span>
                    </button>

                    <button
                      onClick={() => backupFileInputRef.current?.click()}
                      className="btn flex items-center gap-1.5 text-xs py-2 px-3.5"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Восстановить из файла</span>
                    </button>

                    <input
                      ref={backupFileInputRef}
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleImportBackupFile(e.target.files[0]);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 6. ГЕНЕРАТОРЫ & МОДУЛИ 5E */}
            {activeTab === 'generators' && (
              <div className="space-y-6 max-w-3xl">
                <div>
                  <h3 className="text-base font-bold font-['Syne'] flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[var(--accent)]" />
                    <span>Настройка Генераторов & Механик 5E</span>
                  </h3>
                  <p className="text-xs text-[var(--ink-muted)] mt-1">
                    Параметры процедурной генерации подземелий, пещер, городов, лавок и лута
                  </p>
                </div>

                {/* Стандарты сетки генераторов */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-2">
                    <label className="text-xs font-bold text-white block">Ширина карты по умолчанию</label>
                    <input
                      type="number"
                      min="10"
                      max="100"
                      value={settings.generators.defaultBattlemapWidth}
                      onChange={(e) => updateSetting('generators', 'defaultBattlemapWidth', parseInt(e.target.value, 10))}
                      className="w-full bg-[#161619] border border-[var(--ink-faint)] rounded-lg p-2 text-xs text-white"
                    />
                    <span className="text-[10px] text-[var(--ink-muted)]">Клеток в ширину</span>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-2">
                    <label className="text-xs font-bold text-white block">Высота карты по умолчанию</label>
                    <input
                      type="number"
                      min="10"
                      max="100"
                      value={settings.generators.defaultBattlemapHeight}
                      onChange={(e) => updateSetting('generators', 'defaultBattlemapHeight', parseInt(e.target.value, 10))}
                      className="w-full bg-[#161619] border border-[var(--ink-faint)] rounded-lg p-2 text-xs text-white"
                    />
                    <span className="text-[10px] text-[var(--ink-muted)]">Клеток в высоту</span>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-2">
                    <label className="text-xs font-bold text-white block">Размер клетки (Grid Size)</label>
                    <select
                      value={settings.generators.defaultCellSize}
                      onChange={(e) => updateSetting('generators', 'defaultCellSize', parseInt(e.target.value, 10))}
                      className="w-full bg-[#161619] border border-[var(--ink-faint)] rounded-lg p-2 text-xs text-white"
                    >
                      <option value="50">50px (Компактный)</option>
                      <option value="70">70px (Стандарт Roll20)</option>
                      <option value="100">100px (Foundry VTT)</option>
                      <option value="140">140px (High-Res 2K)</option>
                    </select>
                    <span className="text-[10px] text-[var(--ink-muted)]">Пикселей на 5 футов</span>
                  </div>
                </div>

                {/* Баланс лавок и лута */}
                <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-4">
                  <span className="text-xs font-bold text-white block mb-1">
                    Экономика торговцев и выпадение лута
                  </span>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-[var(--ink-muted)]">Множитель цен в лавках</span>
                      <span className="text-xs font-mono text-[var(--accent)]">
                        {settings.generators.shopPriceMultiplier}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.1"
                      value={settings.generators.shopPriceMultiplier}
                      onChange={(e) => updateSetting('generators', 'shopPriceMultiplier', parseFloat(e.target.value))}
                    />
                    <div className="flex justify-between text-[10px] text-[var(--ink-muted)] mt-1">
                      <span>0.5x (Ярмарка / Дешевизна)</span>
                      <span>1.0x (Книга игрока PHB)</span>
                      <span>2.5x (Осажденная крепость)</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--ink-faint)]">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-[var(--ink-muted)]">
                        Базовый шанс магических предметов в луте
                      </span>
                      <span className="text-xs font-mono text-emerald-400">
                        {settings.generators.lootMagicChance}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="90"
                      step="5"
                      value={settings.generators.lootMagicChance}
                      onChange={(e) => updateSetting('generators', 'lootMagicChance', parseInt(e.target.value, 10))}
                    />
                  </div>
                </div>

                {/* NPC и тайны */}
                <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="text-xs font-medium text-white">
                        Генерировать секреты и квестовые зацепки для каждого NPC
                      </div>
                      <div className="text-[10px] text-[var(--ink-muted)]">
                        Добавляет скрытую мотивацию и тайну в карточку персонажа
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.generators.npcIncludeSecrets}
                      onChange={(e) => updateSetting('generators', 'npcIncludeSecrets', e.target.checked)}
                      className="w-4 h-4 accent-[var(--accent)]"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* 7. ИНТЕРФЕЙС & КЛАВИШИ */}
            {activeTab === 'ui' && (
              <div className="space-y-6 max-w-3xl">
                <div>
                  <h3 className="text-base font-bold font-['Syne'] flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-[var(--accent)]" />
                    <span>Интерфейс, Сетка & Горячие Клавиши</span>
                  </h3>
                  <p className="text-xs text-[var(--ink-muted)] mt-1">
                    Визуальная тема, стили тактической сетки и настройка сочетаний клавиш
                  </p>
                </div>

                {/* Темы */}
                <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-2">
                  <label className="text-xs font-bold text-white block">Тема оформления VTT</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'dark-tactical', label: 'Tactical Dark' },
                      { id: 'obsidian', label: 'OLED Obsidian' },
                      { id: 'slate-navy', label: 'Slate Navy' },
                      { id: 'amber-parchment', label: 'Amber Foundry' },
                    ].map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => updateSetting('uiAndExtensions', 'theme', theme.id)}
                        className={`btn text-xs py-2 ${
                          settings.uiAndExtensions.theme === theme.id ? 'btn-accent' : ''
                        }`}
                      >
                        {theme.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Настройка сетки на столе */}
                <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-3">
                  <label className="text-xs font-bold text-white block">Стиль тактической сетки</label>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] text-[var(--ink-muted)] block mb-1">Цвет линий сетки</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings.uiAndExtensions.gridColor}
                          onChange={(e) => updateSetting('uiAndExtensions', 'gridColor', e.target.value)}
                          className="w-8 h-8 rounded border border-[var(--ink-faint)] bg-transparent cursor-pointer"
                        />
                        <span className="text-xs font-mono text-white">
                          {settings.uiAndExtensions.gridColor}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-[var(--ink-muted)] block mb-1">
                        Прозрачность: {Math.round(settings.uiAndExtensions.gridOpacity * 100)}%
                      </span>
                      <input
                        type="range"
                        min="0.05"
                        max="0.8"
                        step="0.05"
                        value={settings.uiAndExtensions.gridOpacity}
                        onChange={(e) => updateSetting('uiAndExtensions', 'gridOpacity', parseFloat(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                {/* Горячие клавиши */}
                <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-2">
                  <label className="text-xs font-bold text-white block mb-2">
                    Быстрые клавиши стола мастера (Hotkeys Cheatsheet)
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="p-2 rounded bg-[#161619] border border-[var(--ink-faint)] flex items-center justify-between text-xs">
                      <span className="text-[var(--ink-muted)]">Открыть туман</span>
                      <kbd className="px-2 py-0.5 rounded bg-[#0d0d10] text-[var(--accent)] font-mono font-bold">R</kbd>
                    </div>
                    <div className="p-2 rounded bg-[#161619] border border-[var(--ink-faint)] flex items-center justify-between text-xs">
                      <span className="text-[var(--ink-muted)]">Скрыть туманом</span>
                      <kbd className="px-2 py-0.5 rounded bg-[#0d0d10] text-[var(--accent)] font-mono font-bold">H</kbd>
                    </div>
                    <div className="p-2 rounded bg-[#161619] border border-[var(--ink-faint)] flex items-center justify-between text-xs">
                      <span className="text-[var(--ink-muted)]">Линейка / Рулетка</span>
                      <kbd className="px-2 py-0.5 rounded bg-[#0d0d10] text-[var(--accent)] font-mono font-bold">M</kbd>
                    </div>
                    <div className="p-2 rounded bg-[#161619] border border-[var(--ink-faint)] flex items-center justify-between text-xs">
                      <span className="text-[var(--ink-muted)]">Рука (Перемещение)</span>
                      <kbd className="px-2 py-0.5 rounded bg-[#0d0d10] text-[var(--accent)] font-mono font-bold">P</kbd>
                    </div>
                    <div className="p-2 rounded bg-[#161619] border border-[var(--ink-faint)] flex items-center justify-between text-xs">
                      <span className="text-[var(--ink-muted)]">Аудиостудия & SFX</span>
                      <kbd className="px-2 py-0.5 rounded bg-[#0d0d10] text-amber-400 font-mono font-bold">Shift+M</kbd>
                    </div>
                    <div className="p-2 rounded bg-[#161619] border border-[var(--ink-faint)] flex items-center justify-between text-xs">
                      <span className="text-[var(--ink-muted)]">Библиотека карт</span>
                      <kbd className="px-2 py-0.5 rounded bg-[#0d0d10] text-[#38bdf8] font-mono font-bold">L</kbd>
                    </div>
                  </div>
                </div>

                {/* Звуковые эффекты */}
                <div className="p-4 rounded-xl border border-[var(--ink-faint)] bg-[#0d0d10] space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="text-xs font-medium text-white">Звуковые эффекты интерфейса (UI SFX)</div>
                      <div className="text-[10px] text-[var(--ink-muted)]">
                        Щелчки кнопок, звуки броска костей и сигналы смены карт
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.uiAndExtensions.enableSfx}
                      onChange={(e) => updateSetting('uiAndExtensions', 'enableSfx', e.target.checked)}
                      className="w-4 h-4 accent-[var(--accent)]"
                    />
                  </label>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Футер окна */}
        <footer className="flex items-center justify-between px-6 py-3 border-t border-[var(--ink-faint)] bg-[#0c0c0e] shrink-0">
          <div className="text-[11px] text-[var(--ink-muted)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Все параметры мгновенно синхронизируются с IndexedDB</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="btn text-xs py-1.5 px-3 text-[var(--ink-muted)] hover:text-white"
            >
              Закрыть
            </button>
            <button
              onClick={handleSaveAll}
              className="btn btn-accent text-xs py-1.5 px-4 font-semibold"
            >
              Применить и сохранить
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
