'use client';

/**
 * ЕДИНЫЙ КАТАЛОГ РЕСУРСОВ AetherMap_Data (Unified Asset Folder Modal)
 *
 * Предоставляет полный древовидный и категориальный интерфейс для управления рабочей папкой:
 * 📁 AetherMap_Data/
 * ├── 📁 maps/               (JPG, PNG, WebP, SVG) + подпапки (/Dungeons, /Cities)
 * ├── 📁 animated_maps/      (MP4, WebM) с автозацикливанием
 * ├── 📁 audio/              (bgm/, ambience/, sfx/)
 * ├── 📁 tokens/             (Круглые аватары)
 * ├── 📁 vault_presets/      (Пресеты сцен .json)
 * └── 📁 blackout_videos/    (Видео затемнения)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Folder,
  FolderPlus,
  Image as ImageIcon,
  Film,
  Music,
  User,
  FileJson,
  Eye,
  Search,
  Tag,
  Upload,
  Trash2,
  HardDrive,
  Cpu,
  RefreshCw,
  X,
  Play,
  Volume2,
  Sliders,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { AssetCategory, AssetRecord, deleteAssetRecord } from '@/lib/indexedDbStorage';
import {
  loadUnifiedAssetCatalog,
  filterAssets,
  formatBytes,
  getAllUniqueTags,
  getSubfoldersForCategory,
} from '@/lib/assetCatalog';
import { resolveMediaUrl, getMediaCacheStats, clearMediaCache } from '@/lib/mediaCache';
import { selectWorkspaceDirectory, scanDirectoryHandle, processUploadedFiles } from '@/lib/fsSync';
import { SavedMapLocation } from '@/lib/types';

interface UnifiedAssetFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMap: (location: Partial<SavedMapLocation>) => void;
  onSelectAudio?: (asset: AssetRecord) => void;
  onSelectBlackoutVideo?: (url: string) => void;
  onLoadVaultPreset?: (presetData: any) => void;
}

export const UnifiedAssetFolderModal: React.FC<UnifiedAssetFolderModalProps> = ({
  isOpen,
  onClose,
  onSelectMap,
  onSelectAudio,
  onSelectBlackoutVideo,
  onLoadVaultPreset,
}) => {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [activeTab, setActiveTab] = useState<AssetCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [selectedSubfolder, setSelectedSubfolder] = useState<string>('');
  const [workspaceDirName, setWorkspaceDirName] = useState<string>('assets/ (Встроенная)');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [cacheStats, setCacheStats] = useState(getMediaCacheStats());
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});

  // Обновление списка ресурсов и статистики LRU-кэша
  const refreshCatalog = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await loadUnifiedAssetCatalog();
      setAssets(list);
      setCacheStats(getMediaCacheStats());
    } catch (e) {
      console.error('Ошибка при обновлении каталога ресурса:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      let isSubscribed = true;
      loadUnifiedAssetCatalog()
        .then((list) => {
          if (isSubscribed) {
            setAssets(list);
            setCacheStats(getMediaCacheStats());
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (isSubscribed) setIsLoading(false);
        });
      return () => {
        isSubscribed = false;
      };
    }
  }, [isOpen]);

  // Разрешение медиассылок через mediaCache LRU для карточек
  useEffect(() => {
    let isMounted = true;
    const resolveThumbnails = async () => {
      const urlMap: Record<string, string> = {};
      const visibleAssets = assets.slice(0, 30); // Ограничиваем мгновенную порцию для перформанса
      for (const asset of visibleAssets) {
        if (asset.blob) {
          const url = await resolveMediaUrl(`idb://${asset.id}`);
          if (isMounted) urlMap[asset.id] = url;
        } else if (asset.url) {
          const url = await resolveMediaUrl(asset.url);
          if (isMounted) urlMap[asset.id] = url;
        }
      }
      if (isMounted) {
        setResolvedUrls((prev) => ({ ...prev, ...urlMap }));
        setCacheStats(getMediaCacheStats());
      }
    };

    if (assets.length > 0) {
      resolveThumbnails();
    }

    return () => {
      isMounted = false;
    };
  }, [assets]);

  // Выбор рабочей папки на диске через HTML5 File System Access API
  const handleSelectDirectory = async () => {
    const handle = await selectWorkspaceDirectory();
    if (handle) {
      setWorkspaceDirName(handle.name);
      setIsLoading(true);
      try {
        await scanDirectoryHandle(handle);
        await refreshCatalog();
      } catch (err) {
        console.error('Ошибка сканирования выбранной папки:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Ручная очистка LRU памяти
  const handleClearMemoryCache = () => {
    clearMediaCache();
    setCacheStats(getMediaCacheStats());
    setResolvedUrls({});
  };

  // Удаление ресурса из реестра
  const handleDeleteAsset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteAssetRecord(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      setCacheStats(getMediaCacheStats());
    } catch (err) {
      console.error('Ошибка удаления ресурса:', err);
    }
  };

  // Drag-and-Drop загрузка файлов в каталог AetherMap_Data
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setIsLoading(true);
      try {
        const targetCategory: AssetCategory = activeTab === 'all' ? 'maps' : activeTab;
        await processUploadedFiles(e.dataTransfer.files, targetCategory);
        await refreshCatalog();
      } catch (err) {
        console.error('Ошибка обработки загруженных файлов:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Выбор карты/ресурса
  const handleActivateAsset = async (asset: AssetRecord) => {
    const resolvedUrl = await resolveMediaUrl(
      asset.blob ? `idb://${asset.id}` : asset.url || asset.relativePath
    );

    if (asset.category === 'maps' || asset.category === 'animated_maps' || asset.type === 'image' || asset.type === 'video') {
      const location: Partial<SavedMapLocation> = {
        id: asset.id,
        name: asset.name,
        category: asset.subfolder || asset.category,
        type: asset.type === 'video' ? 'video' : 'image',
        url: resolvedUrl,
        dataUrl: resolvedUrl,
        width: asset.dimensions?.width || 1920,
        height: asset.dimensions?.height || 1080,
        aspectRatio: asset.dimensions?.aspectRatio || 16 / 9,
        grid: asset.gridConfig || {
          enabled: true,
          size: 70,
          color: '#ffffff',
          opacity: 0.22,
          offsetX: 0,
          offsetY: 0,
        },
        tags: asset.tags,
      };
      onSelectMap(location);
      onClose();
    } else if (asset.category.startsWith('audio') && onSelectAudio) {
      onSelectAudio(asset);
    } else if (asset.category === 'blackout_videos' && onSelectBlackoutVideo) {
      onSelectBlackoutVideo(resolvedUrl);
      onClose();
    } else if (asset.category === 'vault_presets' && onLoadVaultPreset && asset.presetData) {
      onLoadVaultPreset(asset.presetData);
      onClose();
    }
  };

  // Фильтрация ресурсов
  const filteredAssets = useMemo(() => {
    return filterAssets(assets, {
      searchQuery,
      category: activeTab,
      subfolder: selectedSubfolder,
      selectedTag,
    });
  }, [assets, searchQuery, activeTab, selectedSubfolder, selectedTag]);

  // Уникальные теги и подпапки
  const allTags = useMemo(() => getAllUniqueTags(assets), [assets]);
  const subfolders = useMemo(() => getSubfoldersForCategory(assets, activeTab), [assets, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80  p-3 sm:p-6 animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-7xl h-[90vh] bg-[#101216] border border-[#232936] rounded-xl shadow-2xl flex flex-col overflow-hidden font-sans text-[#e2e8f0] ${
          isDragOver ? 'ring-2 ring-[#ff4e00] bg-[#161a22]' : ''
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Шапка рабочей папки AetherMap_Data */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[#232936] bg-[#141822]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#ff4e00]/10 border border-[#ff4e00]/30 flex items-center justify-center text-[#ff4e00]">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                СТРУКТУРА ДАННЫХ AETHERMAP_DATA
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#202636] text-[#ff4e00] font-medium border border-[#ff4e00]/20">
                  {assets.length} Ресурсов
                </span>
              </h2>
              <p className="text-xs text-[#94a3b8] flex items-center gap-2 mt-0.5 font-mono">
                <span>Рабочая директория:</span>
                <span className="text-[#e2e8f0] bg-[#1b202e] px-2 py-0.5 rounded font-medium border border-[#2d364a]">
                  📁 {workspaceDirName}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Статус LRU-кэша оперативной памяти */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181d2a] border border-[#273042] text-xs font-mono text-[#94a3b8]">
              <Cpu className="w-4 h-4 text-[#ff4e00]" />
              <span>
                LRU Кэш: <strong className="text-white">{cacheStats.activeBlobsCount}</strong> / {cacheStats.maxCapacity} blob:
              </span>
              <button
                onClick={handleClearMemoryCache}
                title="Освободить память (revokeObjectURL)"
                className="ml-1 p-1 hover:bg-[#252e40] rounded text-[#94a3b8] hover:text-white transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Кнопка указания папки на диске */}
            <button
              onClick={handleSelectDirectory}
              className="px-3.5 py-2 rounded-lg bg-[#ff4e00] hover:bg-[#e04500] text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-[#ff4e00]/20"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Указать папку на ПК</span>
            </button>

            {/* Закрыть */}
            <button
              onClick={onClose}
              className="p-2 text-[#94a3b8] hover:text-white hover:bg-[#202636] rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Панель категорий поддиректорий AetherMap_Data */}
        <div className="flex items-center gap-1.5 px-6 py-2.5 bg-[#12151e] border-b border-[#232936] overflow-x-auto text-xs font-medium scrollbar-none">
          <button
            onClick={() => {
              setActiveTab('all');
              setSelectedSubfolder('');
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 font-mono transition-all whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-[#ff4e00] text-white font-bold shadow-md shadow-[#ff4e00]/20'
                : 'text-[#94a3b8] hover:bg-[#1a202c] hover:text-white'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Все директории</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('maps');
              setSelectedSubfolder('');
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 font-mono transition-all whitespace-nowrap ${
              activeTab === 'maps'
                ? 'bg-[#ff4e00] text-white font-bold shadow-md shadow-[#ff4e00]/20'
                : 'text-[#94a3b8] hover:bg-[#1a202c] hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>📁 maps/</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('animated_maps');
              setSelectedSubfolder('');
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 font-mono transition-all whitespace-nowrap ${
              activeTab === 'animated_maps'
                ? 'bg-[#ff4e00] text-white font-bold shadow-md shadow-[#ff4e00]/20'
                : 'text-[#94a3b8] hover:bg-[#1a202c] hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-amber-400" />
            <span>🎬 animated_maps/</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('audio/bgm');
              setSelectedSubfolder('');
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 font-mono transition-all whitespace-nowrap ${
              activeTab.startsWith('audio')
                ? 'bg-[#ff4e00] text-white font-bold shadow-md shadow-[#ff4e00]/20'
                : 'text-[#94a3b8] hover:bg-[#1a202c] hover:text-white'
            }`}
          >
            <Music className="w-3.5 h-3.5 text-emerald-400" />
            <span>🎵 audio/ (bgm/ambience/sfx)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('tokens');
              setSelectedSubfolder('');
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 font-mono transition-all whitespace-nowrap ${
              activeTab === 'tokens'
                ? 'bg-[#ff4e00] text-white font-bold shadow-md shadow-[#ff4e00]/20'
                : 'text-[#94a3b8] hover:bg-[#1a202c] hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5 text-cyan-400" />
            <span>👾 tokens/</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('vault_presets');
              setSelectedSubfolder('');
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 font-mono transition-all whitespace-nowrap ${
              activeTab === 'vault_presets'
                ? 'bg-[#ff4e00] text-white font-bold shadow-md shadow-[#ff4e00]/20'
                : 'text-[#94a3b8] hover:bg-[#1a202c] hover:text-white'
            }`}
          >
            <FileJson className="w-3.5 h-3.5 text-purple-400" />
            <span>💾 vault_presets/</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('blackout_videos');
              setSelectedSubfolder('');
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 font-mono transition-all whitespace-nowrap ${
              activeTab === 'blackout_videos'
                ? 'bg-[#ff4e00] text-white font-bold shadow-md shadow-[#ff4e00]/20'
                : 'text-[#94a3b8] hover:bg-[#1a202c] hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#ff4e00]" />
            <span>⬛ blackout_videos/</span>
          </button>
        </div>

        {/* Панель поиска, фильтрации подпапок и тегов */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-[#10131b] border-b border-[#202636]">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            {/* Поиск */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск файла по названию, пути или #тегу..."
                className="w-full bg-[#181d29] border border-[#293245] rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[#ff4e00] transition-colors"
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

            {/* Фильтр по подпапкам (/Dungeons, /Cities) */}
            {subfolders.length > 0 && (
              <select
                value={selectedSubfolder}
                onChange={(e) => setSelectedSubfolder(e.target.value)}
                className="bg-[#181d29] border border-[#293245] rounded-lg px-3 py-1.5 text-xs text-[#e2e8f0] font-mono focus:outline-none focus:border-[#ff4e00]"
              >
                <option value="">Все подпапки</option>
                {subfolders.map((sf) => (
                  <option key={sf} value={sf}>
                    📁 /{sf}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Теги */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full sm:max-w-md py-1 scrollbar-none">
              <span className="text-xs font-mono text-[#64748b] flex items-center gap-1">
                <Tag className="w-3 h-3" /> Теги:
              </span>
              <button
                onClick={() => setSelectedTag('')}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                  selectedTag === '' ? 'bg-[#ff4e00]/20 text-[#ff4e00] border border-[#ff4e00]/40' : 'bg-[#181d29] text-[#94a3b8] hover:text-white'
                }`}
              >
                Все
              </button>
              {allTags.slice(0, 8).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors whitespace-nowrap ${
                    selectedTag === tag ? 'bg-[#ff4e00] text-white font-semibold' : 'bg-[#181d29] text-[#94a3b8] hover:text-white border border-[#273042]'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Сетка ресурсов AetherMap_Data */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-[#262c3d]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-[#94a3b8]">
              <RefreshCw className="w-8 h-8 animate-spin text-[#ff4e00]" />
              <p className="text-xs font-mono">Сканирование и индексация структуры AetherMap_Data...</p>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-[#181d29] border border-[#273042] flex items-center justify-center text-[#64748b]">
                <Folder className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-mono">ФАЙЛЫ В ДИРЕКТОРИИ НЕ НАЙДЕНЫ</h3>
                <p className="text-xs text-[#94a3b8] max-w-md mt-1">
                  Перетащите файлы с ПК прямо в это окно (Drag-and-Drop) или укажите рабочую папку на диске.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredAssets.map((asset) => {
                const resolvedUrl = resolvedUrls[asset.id] || asset.url || '';
                return (
                  <div
                    key={asset.id}
                    onClick={() => handleActivateAsset(asset)}
                    className="group relative bg-[#141822] border border-[#232936] hover:border-[#ff4e00]/50 rounded-xl overflow-hidden shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between hover:shadow-[#ff4e00]/10"
                  >
                    {/* Превью медиафайла */}
                    <div className="relative w-full aspect-video bg-[#0b0d12] overflow-hidden flex items-center justify-center">
                      {asset.type === 'image' && resolvedUrl ? (
                        <img
                          src={resolvedUrl}
                          alt={asset.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : asset.type === 'video' && resolvedUrl ? (
                        <video
                          src={resolvedUrl}
                          className="w-full h-full object-cover"
                          autoPlay
                          loop
                          muted
                          playsInline
                        />
                      ) : asset.type === 'audio' ? (
                        <div className="flex flex-col items-center gap-2 text-emerald-400">
                          <Music className="w-10 h-10 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-mono text-[#94a3b8] uppercase tracking-wider">
                            {asset.category}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-purple-400">
                          <FileJson className="w-10 h-10 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-mono text-[#94a3b8] uppercase tracking-wider">
                            Пресет Сцены
                          </span>
                        </div>
                      )}

                      {/* Категория плашка */}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75  text-[10px] font-mono text-white border border-white/10">
                        📁 {asset.category}
                      </span>

                      {/* Удаление */}
                      <button
                        onClick={(e) => handleDeleteAsset(asset.id, e)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-red-600/80 text-[#94a3b8] hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                        title="Удалить файл из каталога"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Информация о файле */}
                    <div className="p-3 bg-[#141822] flex-1 flex flex-col justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-semibold text-white truncate font-sans group-hover:text-[#ff4e00] transition-colors">
                          {asset.name}
                        </h4>
                        <p className="text-[10px] font-mono text-[#64748b] truncate mt-0.5">
                          {asset.relativePath}
                        </p>
                      </div>

                      {/* Теги и Размер */}
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#94a3b8] border-t border-[#1e2433] pt-2">
                        <span>{formatBytes(asset.size)}</span>
                        {asset.dimensions && (
                          <span className="text-[#64748b]">
                            {asset.dimensions.width}×{asset.dimensions.height}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Подвал с подсказками по перетаскиванию */}
        <div className="px-6 py-3 border-t border-[#232936] bg-[#12151e] flex items-center justify-between text-xs text-[#94a3b8] font-mono">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#ff4e00]" />
            <span>Поддерживается перетаскивание папок и файлов (Drag-and-Drop)</span>
          </div>
          <span className="text-[#64748b]">Автокэширование IndexedDB (idb://) с защитой от OOM (2 GB RAM)</span>
        </div>
      </div>
    </div>
  );
};
