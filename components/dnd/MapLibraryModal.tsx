'use client';

/**
 * Модальное окно и менеджер пресетов/истории карт кампании (Campaign Map Library).
 * Позволяет быстро переключаться между локациями, сохраняя туман войны, заметки и настройки.
 */

import React, { useState, useMemo } from 'react';
import { SavedMapLocation } from '@/lib/types';
import {
  Map as MapIcon,
  Check,
  Compass,
  Layers,
  Sparkles,
  Upload,
  Trash2,
  Copy,
  RotateCcw,
  Search,
  Eye,
  X,
  Plus,
  Play,
} from 'lucide-react';

interface MapLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: SavedMapLocation[];
  activeLocationId: string | null;
  onSelectLocation: (location: SavedMapLocation) => void;
  onDeleteLocation: (id: string) => void;
  onDuplicateLocation: (location: SavedMapLocation) => void;
  onResetFog: (id: string) => void;
  onOpenGenerators: () => void;
  onTriggerFileUpload: () => void;
}

export const MapLibraryModal: React.FC<MapLibraryModalProps> = ({
  isOpen,
  onClose,
  locations,
  activeLocationId,
  onSelectLocation,
  onDeleteLocation,
  onDuplicateLocation,
  onResetFog,
  onOpenGenerators,
  onTriggerFileUpload,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Категории для фильтрации
  const categories = useMemo(() => {
    const set = new Set<string>();
    locations.forEach((loc) => {
      if (loc.category) set.add(loc.category);
    });
    return Array.from(set);
  }, [locations]);

  // Фильтрация локаций
  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      const matchesSearch =
        loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        loc.category?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedCategory === 'all') return true;
      if (selectedCategory === 'visited') return loc.visited;
      if (selectedCategory === 'active') return loc.id === activeLocationId;
      if (selectedCategory === 'preset') return loc.id.startsWith('preset_');
      if (selectedCategory === 'generator') return loc.id.startsWith('gen_') || loc.generatorType;
      return loc.category === selectedCategory;
    });
  }, [locations, searchQuery, selectedCategory, activeLocationId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-6xl h-[88vh] bg-[#12141a] border border-[#262c3d] rounded-xl shadow-2xl flex flex-col overflow-hidden font-sans text-[#e2e8f0]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок модального окна */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#262c3d] bg-[#161b26]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#ff4e00]/10 border border-[#ff4e00]/30 flex items-center justify-center text-[#ff4e00]">
              <MapIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-wide text-white flex items-center gap-2">
                БИБЛИОТЕКА КАРТ И ЛОКАЦИЙ
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#222938] text-[#94a3b8] font-normal">
                  {locations.length} локаций
                </span>
              </h2>
              <p className="text-xs text-[#94a3b8]">
                Быстрое переключение боевых сцен с полным сохранением открытого тумана войны и истории посещений
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onTriggerFileUpload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e2638] hover:bg-[#2a364f] text-xs font-semibold text-[#e2e8f0] border border-[#334155] transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>Загрузить файл</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenGenerators();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ff4e00] hover:bg-[#ff6422] text-xs font-bold text-white shadow-lg shadow-[#ff4e00]/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Генератор студия</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#94a3b8] hover:text-white hover:bg-[#222938] transition-all ml-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Панель поиска и фильтров */}
        <div className="px-6 py-3 border-b border-[#1e2638] bg-[#141822] flex flex-wrap items-center justify-between gap-3">
          {/* Поиск */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
            <input
              type="text"
              placeholder="Поиск по названию, тегам или категории..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#0f131c] border border-[#262c3d] rounded-lg text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[#ff4e00]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Фильтры категорий */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-[#ff4e00] text-white font-bold'
                  : 'bg-[#1a202c] text-[#94a3b8] hover:text-white hover:bg-[#262f42]'
              }`}
            >
              Все ({locations.length})
            </button>

            <button
              onClick={() => setSelectedCategory('visited')}
              className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === 'visited'
                  ? 'bg-[#38bdf8] text-[#0f172a] font-bold'
                  : 'bg-[#1a202c] text-[#94a3b8] hover:text-white hover:bg-[#262f42]'
              }`}
            >
              Сыгранные ({locations.filter((l) => l.visited).length})
            </button>

            <button
              onClick={() => setSelectedCategory('preset')}
              className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === 'preset'
                  ? 'bg-[#a855f7] text-white font-bold'
                  : 'bg-[#1a202c] text-[#94a3b8] hover:text-white hover:bg-[#262f42]'
              }`}
            >
              Пресеты ({locations.filter((l) => l.id.startsWith('preset_')).length})
            </button>

            <button
              onClick={() => setSelectedCategory('generator')}
              className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === 'generator'
                  ? 'bg-[#10b981] text-white font-bold'
                  : 'bg-[#1a202c] text-[#94a3b8] hover:text-white hover:bg-[#262f42]'
              }`}
            >
              Сгенерированные ({locations.filter((l) => l.id.startsWith('gen_') || l.generatorType).length})
            </button>

            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-[#e2e8f0] text-[#0f172a] font-bold'
                    : 'bg-[#1a202c] text-[#94a3b8] hover:text-white hover:bg-[#262f42]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Сетка карточек локаций */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 scrollbar-thin">
          {filteredLocations.map((loc) => {
            const isActive = loc.id === activeLocationId;
            const fogRevealsCount = loc.fogActions ? loc.fogActions.length : 0;

            return (
              <div
                key={loc.id}
                className={`group relative rounded-xl bg-[#161b26] border transition-all duration-200 flex flex-col overflow-hidden ${
                  isActive
                    ? 'border-[#ff4e00] ring-2 ring-[#ff4e00]/30 shadow-lg shadow-[#ff4e00]/10'
                    : 'border-[#262c3d] hover:border-[#3b4760] hover:bg-[#1a202e]'
                }`}
              >
                {/* Превью карты */}
                <div
                  className="relative w-full h-36 bg-[#090d16] overflow-hidden cursor-pointer"
                  onClick={() => {
                    onSelectLocation(loc);
                    onClose();
                  }}
                >
                  {loc.type === 'video' ? (
                    <video src={loc.dataUrl || loc.url} className="w-full h-full object-cover opacity-80" muted />
                  ) : (
                    <img
                      src={loc.dataUrl || loc.url}
                      alt={loc.name}
                      className="w-full h-full object-cover object-center opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                    />
                  )}

                  {/* Бейджи статуса */}
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    {isActive ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-[#ff4e00] text-white shadow-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        НА СТОЛЕ
                      </span>
                    ) : loc.visited ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#0284c7]/80 text-white backdrop-blur-sm">
                        Сыграна
                      </span>
                    ) : null}

                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-black/60 text-[#cbd5e1] backdrop-blur-sm">
                      {loc.category}
                    </span>
                  </div>

                  {/* Индикатор тумана */}
                  <div className="absolute bottom-2 left-2 text-[10px] font-mono px-2 py-0.5 rounded bg-black/70 text-[#94a3b8] backdrop-blur-sm flex items-center gap-1">
                    <Eye className="w-3 h-3 text-[#38bdf8]" />
                    <span>
                      {fogRevealsCount > 0
                        ? `Туман: ${fogRevealsCount} действий`
                        : loc.isFogBaseFilled
                        ? '100% Туман'
                        : 'Открыта'}
                    </span>
                  </div>
                </div>

                {/* Метаданные и описание */}
                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-white line-clamp-1 group-hover:text-[#ff4e00] transition-colors">
                      {loc.name}
                    </h3>
                    {loc.notes ? (
                      <p className="text-[11px] text-[#94a3b8] line-clamp-2 mt-1 leading-relaxed">
                        {loc.notes}
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {loc.tags?.slice(0, 3).map((tag, i) => (
                          <span
                            key={i}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-[#1f293d] text-[#94a3b8]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Кнопки управления */}
                  <div className="mt-3 pt-3 border-t border-[#222938] flex items-center justify-between gap-1">
                    <button
                      onClick={() => {
                        onSelectLocation(loc);
                        onClose();
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#222d3d] text-[#38bdf8] border border-[#38bdf8]/30'
                          : 'bg-[#ff4e00] hover:bg-[#ff6422] text-white shadow-md shadow-[#ff4e00]/20'
                      }`}
                    >
                      {isActive ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Выбрана</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>На стол</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1">
                      {fogRevealsCount > 0 && (
                        <button
                          onClick={() => onResetFog(loc.id)}
                          title="Сбросить открытый туман на этой карте"
                          className="p-1.5 rounded-lg text-[#94a3b8] hover:text-[#fbbf24] hover:bg-[#222938] transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => onDuplicateLocation(loc)}
                        title="Создать копию локации"
                        className="p-1.5 rounded-lg text-[#94a3b8] hover:text-white hover:bg-[#222938] transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {!loc.id.startsWith('preset_') && (
                        <button
                          onClick={() => onDeleteLocation(loc.id)}
                          title="Удалить карту из библиотеки"
                          className="p-1.5 rounded-lg text-[#94a3b8] hover:text-[#ef4444] hover:bg-[#222938] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredLocations.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-center text-[#64748b]">
              <Compass className="w-12 h-12 mb-3 text-[#334155] animate-pulse" />
              <p className="text-sm font-medium text-[#94a3b8]">Локации не найдены</p>
              <p className="text-xs mt-1">Попробуйте изменить поисковый запрос или сбросить фильтр</p>
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="px-6 py-3 border-t border-[#262c3d] bg-[#141822] flex items-center justify-between text-xs text-[#64748b]">
          <div className="flex items-center gap-4">
            <span>💡 Подсказка: При переключении карт весь туман войны и положение сетки сохраняются автоматически.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#222938] hover:bg-[#2d374d] text-white text-xs font-semibold transition-all cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
