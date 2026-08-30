/**
 * ЕДИНЫЙ КАТАЛОГ РЕСУРСОВ: assetCatalog.ts
 *
 * Централизованный реестр всех медиафайлов кампании AetherMap_Data.
 * Присваивает каждому файлу уникальный стабильный строковый ID (asset_...).
 * Позволяет производить полнотекстовый поиск, фильтрацию по категории,
 * вложенным папкам (/Dungeons, /Cities) и хэштегам (#dungeon, #bossfight, #night).
 */

import { AssetCategory, AssetMediaType, AssetRecord, getAllAssetRecords, saveAssetRecord, deleteAssetRecord } from './indexedDbStorage';
import { PRESET_MAPS } from './presets';

export interface AssetFilterOptions {
  searchQuery?: string;
  category?: AssetCategory | 'all';
  type?: AssetMediaType | 'all';
  subfolder?: string;
  selectedTag?: string;
}

/**
 * Преобразует встроенные пресеты в системные записи AssetRecord для единого каталога
 */
export function getPresetAssetRecords(): AssetRecord[] {
  return PRESET_MAPS.map((map) => {
    let category: AssetCategory = 'maps';
    if (map.category === 'Пещера') category = 'maps';
    if (map.category === 'Город') category = 'maps';

    return {
      id: `asset_preset_${map.id}`,
      name: map.name,
      relativePath: `maps/${map.category || 'Preset'}/${map.name}.webp`,
      category,
      subfolder: map.category || 'Пресеты',
      mimeType: 'image/webp',
      type: 'image',
      url: map.dataUrl,
      size: 1500000,
      modifiedAt: 1700000000000,
      tags: map.tags ? map.tags.map((t) => (t.startsWith('#') ? t : `#${t}`)) : ['#preset', '#map'],
      dimensions: {
        width: map.width,
        height: map.height,
        aspectRatio: map.width / map.height,
      },
      gridConfig: {
        enabled: true,
        size: map.gridSize || 70,
        color: '#ffffff',
        opacity: 0.22,
        offsetX: 0,
        offsetY: 0,
      },
    };
  });
}

/**
 * Инициализирует и возвращает единый каталог ресурсов (сочетает встроенные пресеты и хранилище IndexedDB)
 */
export async function loadUnifiedAssetCatalog(): Promise<AssetRecord[]> {
  const presetRecords = getPresetAssetRecords();
  let dbRecords: AssetRecord[] = [];

  try {
    dbRecords = await getAllAssetRecords();
  } catch (err) {
    console.warn('Не удалось загрузить пользовательские ресурсы из IndexedDB:', err);
  }

  // Создаем карту для объединения по уникальному ID без дубликатов
  const assetMap = new Map<string, AssetRecord>();
  presetRecords.forEach((rec) => assetMap.set(rec.id, rec));
  dbRecords.forEach((rec) => assetMap.set(rec.id, rec));

  return Array.from(assetMap.values());
}

/**
 * Фильтрует список ресурсов по заданным критериям
 */
export function filterAssets(assets: AssetRecord[], filter: AssetFilterOptions): AssetRecord[] {
  const { searchQuery, category, type, subfolder, selectedTag } = filter;

  return assets.filter((asset) => {
    // 1. Полнотекстовый поиск по имени, пути и тегам
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const nameMatch = asset.name.toLowerCase().includes(query);
      const pathMatch = asset.relativePath.toLowerCase().includes(query);
      const tagMatch = asset.tags.some((t) => t.toLowerCase().includes(query));
      if (!nameMatch && !pathMatch && !tagMatch) return false;
    }

    // 2. Фильтр по категории
    if (category && category !== 'all') {
      if (asset.category !== category) return false;
    }

    // 3. Фильтр по типу медиа (image / video / audio / preset)
    if (type && type !== 'all') {
      if (asset.type !== type) return false;
    }

    // 4. Фильтр по вложенной папке
    if (subfolder && subfolder.trim()) {
      if (!asset.subfolder.toLowerCase().includes(subfolder.toLowerCase().trim())) {
        return false;
      }
    }

    // 5. Фильтр по выбранному тегу
    if (selectedTag && selectedTag.trim()) {
      if (!asset.tags.includes(selectedTag)) return false;
    }

    return true;
  });
}

/**
 * Форматирует размер файла в удобочитаемую строку (Б, КБ, МБ)
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Собирает уникальный список всех тегов во всей коллекции карт
 */
export function getAllUniqueTags(assets: AssetRecord[]): string[] {
  const tagSet = new Set<string>();
  assets.forEach((a) => {
    a.tags?.forEach((t) => tagSet.add(t));
  });
  return Array.from(tagSet).sort();
}

/**
 * Собирает список всех вложенных папок для выбранной категории
 */
export function getSubfoldersForCategory(assets: AssetRecord[], category: AssetCategory | 'all'): string[] {
  const subSet = new Set<string>();
  assets.forEach((a) => {
    if (category === 'all' || a.category === category) {
      if (a.subfolder) subSet.add(a.subfolder);
    }
  });
  return Array.from(subSet).sort();
}
