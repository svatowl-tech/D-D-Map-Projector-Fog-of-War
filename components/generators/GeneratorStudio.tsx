'use client';

/**
 * GeneratorStudio - Встроенная студия процедурных генераторов карт
 * (Пещеры, Города, Здания/Особняки, Таверны, Деревни).
 * Обеспечивает прямое двустороннее управление через postMessage и
 * мгновенный импорт сгенерированных карт на игровой стол мастера и проектор.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  GeneratorType,
  GeneratorExportEventData,
} from '@/lib/types';
import {
  Sparkles,
  X,
  Maximize2,
  Minimize2,
  Download,
  Upload,
  RefreshCw,
  Castle,
  Home,
  Compass,
  Beer,
  Mountain,
  Layers,
  Palette,
  Eye,
  Sliders,
  ChevronUp,
  ChevronDown,
  Check,
  Zap,
  LucideIcon,
} from 'lucide-react';

interface GeneratorStudioProps {
  isOpen: boolean;
  onClose: () => void;
  onImportMapToTable: (payload: GeneratorExportEventData, autoFillFog?: boolean) => void;
  onImportBatchFloors?: (floors: GeneratorExportEventData[]) => void;
  initialType?: GeneratorType;
}

interface GeneratorTabInfo {
  id: GeneratorType;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  src: string;
  accentColor: string;
  defaultGridSize: number;
}

const GENERATOR_TABS: GeneratorTabInfo[] = [
  {
    id: 'cave',
    title: 'Пещера',
    subtitle: 'Подземелья и гроты',
    icon: Mountain,
    src: '/cave/index.html',
    accentColor: '#10b981', // emerald
    defaultGridSize: 70,
  },
  {
    id: 'dwell',
    title: 'Здание / Особняк',
    subtitle: 'Многоэтажные дома и поместья',
    icon: Home,
    src: '/dwell/index.html',
    accentColor: '#3b82f6', // blue
    defaultGridSize: 75,
  },
  {
    id: 'taverns',
    title: 'Таверна',
    subtitle: 'Постоялые дворы и залы',
    icon: Beer,
    accentColor: '#f59e0b', // amber
    src: '/taverns/index.html',
    defaultGridSize: 70,
  },
  {
    id: 'village',
    title: 'Деревня',
    subtitle: 'Поселения, фермы и дороги',
    icon: Compass,
    accentColor: '#84cc16', // lime
    src: '/village/index.html',
    defaultGridSize: 60,
  },
  {
    id: 'city',
    title: 'Город',
    subtitle: 'Средневековый мегаполис',
    icon: Castle,
    accentColor: '#ec4899', // pink
    src: '/city/index.html',
    defaultGridSize: 50,
  },
];

export const GeneratorStudio: React.FC<GeneratorStudioProps> = ({
  isOpen,
  onClose,
  onImportMapToTable,
  onImportBatchFloors,
  initialType = 'dwell',
}) => {
  const [activeType, setActiveType] = useState<GeneratorType>(initialType);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [batchFloorsQueue, setBatchFloorsQueue] = useState<GeneratorExportEventData[]>([]);
  const [lastExported, setLastExported] = useState<GeneratorExportEventData | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Ссылки на iframe
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const showToast = useCallback((msg: string, durationMs: number = 3000) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((prev) => (prev === msg ? null : prev)), durationMs);
  }, []);

  // Отправка команды в iframe генератора
  const sendToGenerator = useCallback((action: string, data: Record<string, unknown> = {}) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ action, ...data }, '*');
    }
  }, []);

  // Обработчик входящих сообщений перехвата экспорта
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      const data = event.data;

      if (
        data.type === 'CAVE_MAP_EXPORT' ||
        data.type === 'CITY_MAP_EXPORT' ||
        data.type === 'DWELLINGS_MAP_EXPORT' ||
        data.type === 'TAVERN_MAP_EXPORT' ||
        data.type === 'VILLAGE_MAP_EXPORT'
      ) {
        const payload: GeneratorExportEventData = {
          type: data.type,
          generatorType: activeType,
          dataUrl: data.dataUrl,
          filename: data.filename || `${activeType}_map.png`,
          width: data.width || 1600,
          height: data.height || 1600,
          format: data.format || 'png',
          houseName: data.houseName,
          floorIndex: data.floorIndex,
          floorLabel: data.floorLabel,
          floorTitle: data.floorTitle,
          isBatch: data.isBatch,
          batchIndex: data.batchIndex,
          batchTotal: data.batchTotal,
          isMultiSheet: data.isMultiSheet,
          timestamp: Date.now(),
        };

        setLastExported(payload);
        setIsExporting(false);

        // Если это часть пакетного экспорта всех этажей
        if (payload.isBatch && typeof payload.batchIndex === 'number' && typeof payload.batchTotal === 'number') {
          setBatchFloorsQueue((prev) => {
            const next = [...prev.filter((item) => item.floorIndex !== payload.floorIndex), payload];
            if (next.length >= (payload.batchTotal || 1)) {
              showToast(`Все ${next.length} этажей здания готовы к импорту!`);
              if (onImportBatchFloors) {
                onImportBatchFloors(next);
              }
              return [];
            }
            return next;
          });
        } else {
          showToast(`Карта готова: ${payload.filename || 'Сгенерированная карта'}`);
          // Автоматически импортируем на стол
          onImportMapToTable(payload);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeType, onImportMapToTable, onImportBatchFloors, showToast]);

  if (!isOpen) return null;

  const currentTab = GENERATOR_TABS.find((t) => t.id === activeType) || GENERATOR_TABS[0];

  // Триггер экспорта на стол
  const handleTriggerExport = (downloadFile: boolean = false) => {
    setIsExporting(true);
    showToast(downloadFile ? 'Экспорт и скачивание...' : 'Перенос карты на стол...');

    // 1. Вызываем нативный экспорт генератора через postMessage
    if (activeType === 'cave') {
      sendToGenerator('EXPORT_PNG', { download: downloadFile });
    } else if (activeType === 'dwell') {
      sendToGenerator('EXPORT_PNG', { download: downloadFile });
    } else if (activeType === 'taverns') {
      sendToGenerator('EXPORT_FLOOR', { download: downloadFile });
    } else if (activeType === 'village') {
      sendToGenerator('EXPORT_PNG', { download: downloadFile });
    } else if (activeType === 'city') {
      sendToGenerator('EXPORT_PNG', { download: downloadFile });
    }

    // 2. Failsafe: Прямой захват Canvas/SVG из iframe (работает мгновенно и надежно без сбоев)
    setTimeout(() => {
      try {
        const iframe = iframeRef.current;
        const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
        if (doc) {
          const canvas = doc.querySelector('canvas');
          if (canvas && canvas.width > 0 && canvas.height > 0) {
            const dataUrl = canvas.toDataURL('image/png');
            if (dataUrl && dataUrl.length > 200) {
              const payload: GeneratorExportEventData = {
                type: `${activeType.toUpperCase()}_MAP_EXPORT`,
                generatorType: activeType,
                dataUrl,
                filename: `${currentTab.title}_${new Date().toLocaleTimeString('ru-RU').replace(/:/g, '-')}.png`,
                width: canvas.width || 1600,
                height: canvas.height || 1200,
                format: 'png',
                timestamp: Date.now(),
              };
              onImportMapToTable(payload);
              showToast(`✓ Карта «${currentTab.title}» перенесена на стол!`);
              setIsExporting(false);
              return;
            }
          }
          const svg = doc.querySelector('svg');
          if (svg) {
            const serializer = new XMLSerializer();
            const svgStr = serializer.serializeToString(svg);
            const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
            const rect = svg.getBoundingClientRect();
            const payload: GeneratorExportEventData = {
              type: `${activeType.toUpperCase()}_MAP_EXPORT`,
              generatorType: activeType,
              dataUrl,
              filename: `${currentTab.title}_${new Date().toLocaleTimeString('ru-RU').replace(/:/g, '-')}.svg`,
              width: rect.width || 1600,
              height: rect.height || 1200,
              format: 'svg',
              timestamp: Date.now(),
            };
            onImportMapToTable(payload);
            showToast(`✓ Векторная карта «${currentTab.title}» перенесена на стол!`);
            setIsExporting(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Canvas extraction fallback note:', err);
      }
    }, 280);
  };

  // Пакетный экспорт всех этажей для особняков и таверн
  const handleExportAllFloors = () => {
    setIsExporting(true);
    setBatchFloorsQueue([]);
    showToast('Генерация и перенос всех этажей на стол...');

    if (activeType === 'dwell') {
      sendToGenerator('EXPORT_ALL_FLOORS', { download: false });
    } else if (activeType === 'taverns') {
      sendToGenerator('EXPORT_FULL', { download: false });
    }
  };

  return (
    <div
      id="generator-studio-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85  p-2 sm:p-4 select-none"
    >
      <div
        className={`flex flex-col bg-[#12141a] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden transition-all duration-200 ${
          isFullscreen ? 'w-screen h-screen rounded-none' : 'w-[98vw] max-w-[1400px] h-[92vh]'
        }`}
      >
        {/* 1. Верхний заголовок и переключатель генераторов */}
        <header className="flex flex-wrap items-center justify-between px-3 sm:px-5 py-2.5 bg-[#181b24] border-b border-slate-700/70 gap-2 flex-shrink-0">
          {/* Вкладки выбора генератора */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <div className="flex items-center gap-1.5 mr-2 text-amber-400 font-bold text-xs uppercase tracking-wider hidden md:flex">
              <Sparkles className="w-4 h-4" />
              <span>Генераторы карт:</span>
            </div>

            {GENERATOR_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeType === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-gen-${tab.id}`}
                  onClick={() => {
                    setActiveType(tab.id);
                    setLastExported(null);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-800 text-white border border-amber-500/60 shadow-md shadow-amber-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                  style={{
                    borderLeftColor: isActive ? tab.accentColor : undefined,
                    borderLeftWidth: isActive ? '3px' : undefined,
                  }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: tab.accentColor }} />
                  <span>{tab.title}</span>
                </button>
              );
            })}
          </div>

          {/* Кнопки действий: Импорт на стол, Скачивание, Окно */}
          <div className="flex items-center gap-2">
            <button
              id="btn-import-gen-to-table"
              onClick={() => handleTriggerExport(false)}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-lg shadow-amber-600/30 cursor-pointer disabled:opacity-50"
              title="Перенести карту прямо на стол мастера и синхронизировать с экраном игроков"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Импорт...' : 'Импортировать на стол'}</span>
            </button>

            {(activeType === 'dwell' || activeType === 'taverns') && (
              <button
                id="btn-import-all-floors"
                onClick={handleExportAllFloors}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/80 hover:bg-blue-500 text-white font-medium text-xs rounded-lg transition-all cursor-pointer disabled:opacity-50 hidden sm:flex"
                title="Сгенерировать и импортировать все этажи (подвал, 1-й, 2-й этаж, крышу)"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Все этажи</span>
              </button>
            )}

            <button
              id="btn-download-gen-image"
              onClick={() => handleTriggerExport(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition cursor-pointer"
              title="Скачать изображение PNG на диск"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Скачать</span>
            </button>

            <button
              id="btn-toggle-fullscreen-gen"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition cursor-pointer"
              title={isFullscreen ? 'Свернуть' : 'На весь экран'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              id="btn-close-gen-studio"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition cursor-pointer"
              title="Закрыть генератор"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* 2. Быстрая контекстная панель инструментов генератора (1-Click Controls) */}
        <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-[#141720] border-b border-slate-800 text-xs gap-2 flex-shrink-0">
          {/* Левый блок: кнопки генерации и пресетов */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-gen-reroll"
              onClick={() => sendToGenerator('GENERATE')}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold border border-slate-700 rounded transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Перегенерировать (Enter)</span>
            </button>

            {/* Специфичные контролы для каждого генератора */}
            {activeType === 'cave' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => sendToGenerator('TOGGLE_TUNNELS')}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60"
                  title="Переключить ширину тоннелей (N)"
                >
                  Тоннели (N)
                </button>
                <button
                  onClick={() => sendToGenerator('TOGGLE_SMOOTH')}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60"
                  title="Сглаживание стен (M)"
                >
                  Сглаживание (M)
                </button>
                <button
                  onClick={() => sendToGenerator('TOGGLE_GRID')}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60"
                  title="Сетка (G)"
                >
                  Сетка (G)
                </button>
                <button
                  onClick={() => sendToGenerator('WATER_UP')}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-emerald-400 rounded border border-slate-700/60"
                  title="Поднять уровень воды (])"
                >
                  Вода +
                </button>
                <button
                  onClick={() => sendToGenerator('WATER_DOWN')}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-emerald-400 rounded border border-slate-700/60"
                  title="Опустить уровень воды ([)"
                >
                  Вода -
                </button>
              </div>
            )}

            {activeType === 'dwell' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded p-0.5">
                  <span className="text-[10px] text-slate-400 px-1 font-bold">ЭТАЖ:</span>
                  <button
                    onClick={() => sendToGenerator('FLOOR_DOWN')}
                    className="p-1 hover:bg-slate-800 text-slate-300 rounded"
                    title="Этаж ниже"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => sendToGenerator('FLOOR_UP')}
                    className="p-1 hover:bg-slate-800 text-slate-300 rounded"
                    title="Этаж выше"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                </div>

                <button
                  onClick={() => sendToGenerator('TOGGLE_PROPS')}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60"
                  title="Включить/выключить мебель и декор (P)"
                >
                  Мебель (P)
                </button>
                <button
                  onClick={() => sendToGenerator('TOGGLE_SHADOWS')}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60"
                  title="Включить/выключить тени (S)"
                >
                  Тени (S)
                </button>
                <button
                  onClick={() => sendToGenerator('TOGGLE_BW')}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60"
                  title="Черно-белый режим (B)"
                >
                  Ч/Б (B)
                </button>
                <button
                  onClick={() => sendToGenerator('RANDOM_STYLE')}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-amber-300 rounded border border-slate-700/60"
                  title="Случайный стиль стен и пола (C)"
                >
                  Стиль (C)
                </button>
              </div>
            )}

            {activeType === 'taverns' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded p-0.5">
                  <span className="text-[10px] text-slate-400 px-1 font-bold">ЭТАЖ:</span>
                  <button
                    onClick={() => sendToGenerator('FLOOR_DOWN')}
                    className="p-1 hover:bg-slate-800 text-slate-300 rounded"
                    title="Этаж ниже"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => sendToGenerator('FLOOR_UP')}
                    className="p-1 hover:bg-slate-800 text-slate-300 rounded"
                    title="Этаж выше"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                </div>

                <button
                  onClick={() => sendToGenerator('TOGGLE_PROPS')}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60"
                  title="Мебель (P)"
                >
                  Мебель (P)
                </button>
                <button
                  onClick={() => sendToGenerator('TOGGLE_SHADOWS')}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60"
                  title="Тени (S)"
                >
                  Тени (S)
                </button>
                <button
                  onClick={() => sendToGenerator('TOGGLE_BW')}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60"
                  title="Ч/Б (B)"
                >
                  Ч/Б (B)
                </button>
                <button
                  onClick={() => sendToGenerator('RANDOM_STYLE')}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-amber-300 rounded border border-slate-700/60"
                  title="Случайный стиль (C)"
                >
                  Стиль (C)
                </button>
              </div>
            )}

            {activeType === 'village' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => sendToGenerator('SET_PRESET', { preset: 'default' })}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60"
                >
                  Классика
                </button>
                <button
                  onClick={() => sendToGenerator('SET_PRESET', { preset: 'sand' })}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-amber-300 rounded border border-slate-700/60"
                >
                  Песок
                </button>
                <button
                  onClick={() => sendToGenerator('SET_PRESET', { preset: 'night' })}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-indigo-300 rounded border border-slate-700/60"
                >
                  Ночь
                </button>
                <button
                  onClick={() => sendToGenerator('SET_PRESET', { preset: 'cold' })}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-cyan-300 rounded border border-slate-700/60"
                >
                  Зима
                </button>
                <button
                  onClick={() => sendToGenerator('TOGGLE_FIELDS')}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60"
                >
                  Поля
                </button>
                <button
                  onClick={() => sendToGenerator('TOGGLE_ORCHARDS')}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60"
                >
                  Сады
                </button>
              </div>
            )}

            {activeType === 'city' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => sendToGenerator('SET_SIZE', { size: 'small' })}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60"
                >
                  Малый
                </button>
                <button
                  onClick={() => sendToGenerator('SET_SIZE', { size: 'medium' })}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60"
                >
                  Средний
                </button>
                <button
                  onClick={() => sendToGenerator('SET_SIZE', { size: 'large' })}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60"
                >
                  Большой
                </button>
                <button
                  onClick={() => sendToGenerator('SET_PRESET', { preset: 'ink' })}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-amber-300 rounded border border-slate-700/60"
                >
                  Чернила
                </button>
                <button
                  onClick={() => sendToGenerator('SET_PRESET', { preset: 'bw' })}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded border border-slate-700/60"
                >
                  Ч/Б
                </button>
                <button
                  onClick={() => sendToGenerator('REROLL_DISTRICTS')}
                  className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60"
                >
                  Районы
                </button>
              </div>
            )}
          </div>

          {/* Правый блок: статус и подсказки */}
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            {toastMessage && (
              <span className="text-amber-400 font-semibold animate-pulse">{toastMessage}</span>
            )}
            <span className="hidden lg:inline text-slate-500">
              *Все кнопки и меню внутри генератора также активны
            </span>
          </div>
        </div>

        {/* 3. Основная область: IFrame генератора */}
        <div className="flex-1 relative bg-black overflow-hidden">
          <iframe
            ref={iframeRef}
            key={activeType}
            src={currentTab.src}
            title={currentTab.title}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-downloads allow-forms allow-popups"
          />

          {/* Индикатор загрузки / экспорта */}
          {isExporting && (
            <div className="absolute inset-0 bg-black/60  flex items-center justify-center z-20">
              <div className="flex items-center gap-3 px-5 py-3 bg-slate-900 border border-amber-500/60 rounded-xl text-slate-200 shadow-2xl">
                <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
                <span className="text-sm font-semibold">Рендеринг и перенос карты на стол...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
