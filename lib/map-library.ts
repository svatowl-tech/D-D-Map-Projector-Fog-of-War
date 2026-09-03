/**
 * Менеджер библиотеки локаций и тактических карт кампании (Campaign Map Library).
 * Сохраняет историю исследованных карт, состояние тумана войны для каждой карты,
 * масштаб и положение камеры, настройки сетки и заметки мастера.
 */

import { SavedMapLocation, ViewportTransform, GridConfig, FogAction, GeneratorExportEventData } from './types';
import { PRESET_MAPS, PresetMap } from './presets';
import { getSetting, saveSetting } from './indexedDbStorage';

const STORAGE_KEY = '__dnd_campaign_map_library_v2__';
const ACTIVE_MAP_ID_KEY = '__dnd_active_map_id__';
const IDB_MAP_KEY = 'map_library_v2';

/**
 * Возвращает исходный список локаций из встроенных пресетов
 */
export function getDefaultPresetLocations(): SavedMapLocation[] {
  return PRESET_MAPS.map((preset, index) => ({
    id: `preset_${preset.id}`,
    name: preset.name,
    category: (preset.category as any) || 'Пресет',
    type: 'image',
    url: preset.dataUrl,
    dataUrl: preset.dataUrl,
    width: preset.width,
    height: preset.height,
    aspectRatio: preset.width / preset.height,
    grid: {
      enabled: true,
      size: preset.gridSize || 70,
      color: '#ffffff',
      opacity: 0.22,
      offsetX: 0,
      offsetY: 0,
    },
    viewport: { x: 0, y: 0, scale: 1 },
    fogActions: [],
    isFogBaseFilled: false,
    visited: index === 0, // первая карта активна по умолчанию
    tags: preset.tags || [preset.category],
    createdAt: 1700000000000 + index * 60000,
    notes: preset.description || '',
  }));
}

/**
 * Быстро восстанавливает dataUrl для стандартных пресетов, если они были очищены в localStorage
 */
function restorePresetDataUrls(locations: SavedMapLocation[]): SavedMapLocation[] {
  const presets = getDefaultPresetLocations();
  const presetMap = new Map(presets.map((p) => [p.id, p]));
  return locations.map((loc) => {
    if ((!loc.dataUrl || loc.dataUrl === '') && presetMap.has(loc.id)) {
      const p = presetMap.get(loc.id)!;
      return { ...loc, dataUrl: p.dataUrl, url: p.url };
    }
    return loc;
  });
}

/**
 * Инициализирует библиотеку карт синхронно (для мгновенного рендера первого кадра)
 * Чтобы избежать Hydration Mismatch в SSR, на этапе инициализации стейта всегда
 * возвращает дефолтные пресеты. Реальная гидрация происходит в useEffect через loadMapLibrary().
 */
export function initMapLibrary(): SavedMapLocation[] {
  return getDefaultPresetLocations();
}

/**
 * Асинхронно загружает полную библиотеку карт из IndexedDB (включая тяжелые сгенерированные и загруженные карты)
 */
export async function loadMapLibrary(): Promise<SavedMapLocation[]> {
  if (typeof window === 'undefined') return getDefaultPresetLocations();

  // 1. Проверяем хранилище IndexedDB (без ограничения 5MB)
  try {
    const fromIdb = await getSetting<SavedMapLocation[]>(IDB_MAP_KEY);
    if (Array.isArray(fromIdb) && fromIdb.length > 0) {
      return restorePresetDataUrls(fromIdb);
    }
  } catch (err) {
    console.warn('[MapLibrary] Не удалось прочесть из IndexedDB, используем резерв:', err);
  }

  // 2. Если в IndexedDB еще нет записи (первый запуск или миграция), берем из localStorage / defaults
  const fallback = initMapLibrary();
  // Сохраняем в IndexedDB для будущих запусков
  if (fallback.length > 0) {
    saveSetting(IDB_MAP_KEY, fallback).catch(() => {});
  }
  return fallback;
}

/**
 * Сохраняет библиотеку локаций:
 * - Полные бинарные данные и base64 изображения в надежное хранилище IndexedDB (без лимитов квоты)
 * - Легковесную копию метаданных в localStorage (очищая многомегабайтные dataUrl во избежание QuotaExceededError)
 */
export function saveMapLibrary(locations: SavedMapLocation[]): void {
  if (typeof window === 'undefined') return;

  // 1. Асинхронно сохраняем полные данные с тяжелыми изображениями в IndexedDB
  saveSetting(IDB_MAP_KEY, locations).catch((err) => {
    console.warn('[MapLibrary] Ошибка сохранения в IndexedDB:', err);
  });

  // 2. Для localStorage подготавливаем компактную версию без тяжелых data:image строк (> 2 КБ)
  try {
    const lightweight = locations.map((loc) => {
      const isHeavyDataUrl = Boolean(loc.dataUrl && loc.dataUrl.length > 2048 && loc.dataUrl.startsWith('data:'));
      const isHeavyUrl = Boolean(loc.url && loc.url.length > 2048 && loc.url.startsWith('data:'));
      if (!isHeavyDataUrl && !isHeavyUrl) return loc;
      return {
        ...loc,
        dataUrl: isHeavyDataUrl ? '' : loc.dataUrl,
        url: isHeavyUrl ? '' : loc.url,
      };
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweight));
  } catch (e: any) {
    // Безопасно перехватываем QuotaExceededError без выброса фатальной ошибки в консоль
    console.warn('[MapLibrary] LocalStorage квота исчерпана, данные сохранены в IndexedDB:', e?.message || e);
    try {
      // Попытка записать только минимальные метаданные
      const minimal = locations.map((l) => ({
        id: l.id,
        name: l.name,
        category: l.category,
        type: l.type,
        width: l.width,
        height: l.height,
        visited: l.visited,
        grid: l.grid,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
    } catch {
      // При критическом переполнении очищаем раздутый ключ, не трогая другие настройки
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }
}

/**
 * Сохраняет ID текущей активной карты
 */
export function saveActiveMapId(mapId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_MAP_ID_KEY, mapId);
  } catch (e) {}
}

/**
 * Получает ID текущей активной карты
 */
export function getActiveMapId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ACTIVE_MAP_ID_KEY);
  } catch (e) {
    return null;
  }
}

/**
 * Создает новую локацию из импорта генератора (Taverns, Cave, Dwellings, Village, City)
 */
export function createLocationFromGenerator(data: GeneratorExportEventData): SavedMapLocation {
  const categoryMap: Record<string, string> = {
    dungeon: 'Подземелье',
    cave: 'Пещера',
    city: 'Город',
    dwell: 'Здание',
    taverns: 'Помещение',
    village: 'Деревня',
    battlemap: 'Дикая местность',
  };

  const genCategory = data.generatorType ? categoryMap[data.generatorType] || 'Генератор' : 'Генератор';
  const title = data.floorTitle
    ? `${data.houseName || 'Локация'} (${data.floorTitle})`
    : data.filename || `Карта ${genCategory}`;

  const width = data.width || 1600;
  const height = data.height || 1200;

  return {
    id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    name: title,
    category: genCategory,
    type: 'image',
    url: data.dataUrl,
    dataUrl: data.dataUrl,
    width,
    height,
    aspectRatio: width / height,
    grid: {
      enabled: true,
      size: data.generatorType === 'taverns' ? 70 : data.generatorType === 'city' ? 50 : 64,
      color: '#ffffff',
      opacity: 0.22,
      offsetX: 0,
      offsetY: 0,
    },
    viewport: { x: 0, y: 0, scale: 1 },
    fogActions: [],
    isFogBaseFilled: false,
    visited: true,
    tags: [genCategory, 'Генератор', data.generatorType || 'watabou'],
    createdAt: Date.now(),
    lastVisitedAt: Date.now(),
    generatorType: data.generatorType,
    floorIndex: data.floorIndex,
    floorLabel: data.floorLabel,
    notes: `Сгенерировано в модуле ${genCategory} (${new Date().toLocaleDateString('ru-RU')})`,
  };
}

/**
 * Создает локацию из загруженного пользователем файла (изображение или видео)
 */
export async function createLocationFromFile(
  fileOrName: File | string,
  urlOrUndefined?: string,
  dataUrlOrUndefined?: string,
  typeOrUndefined?: 'image' | 'video',
  width: number = 1600,
  height: number = 1200
): Promise<SavedMapLocation> {
  if (fileOrName instanceof File) {
    const file = fileOrName;
    const isVideo = file.type.startsWith('video/');
    const type: 'image' | 'video' = isVideo ? 'video' : 'image';
    const blobUrl = URL.createObjectURL(file);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = (reader.result as string) || blobUrl;
        if (!isVideo) {
          const img = new Image();
          img.onload = () => {
            const w = img.naturalWidth || 1600;
            const h = img.naturalHeight || 1200;
            resolve({
              id: `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
              name: file.name.replace(/\.[^/.]+$/, ''),
              category: 'Пользовательская',
              type: 'image',
              url: blobUrl,
              dataUrl,
              width: w,
              height: h,
              aspectRatio: w / h,
              grid: {
                enabled: true,
                size: 70,
                color: '#ffffff',
                opacity: 0.22,
                offsetX: 0,
                offsetY: 0,
              },
              viewport: { x: 0, y: 0, scale: 1 },
              fogActions: [],
              isFogBaseFilled: false,
              visited: true,
              tags: ['Загруженная', 'Статическая'],
              createdAt: Date.now(),
              lastVisitedAt: Date.now(),
            });
          };
          img.onerror = () => {
            resolve({
              id: `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
              name: file.name.replace(/\.[^/.]+$/, ''),
              category: 'Пользовательская',
              type: 'image',
              url: blobUrl,
              dataUrl,
              width: 1600,
              height: 1200,
              aspectRatio: 1600 / 1200,
              grid: {
                enabled: true,
                size: 70,
                color: '#ffffff',
                opacity: 0.22,
                offsetX: 0,
                offsetY: 0,
              },
              viewport: { x: 0, y: 0, scale: 1 },
              fogActions: [],
              isFogBaseFilled: false,
              visited: true,
              tags: ['Загруженная'],
              createdAt: Date.now(),
              lastVisitedAt: Date.now(),
            });
          };
          img.src = dataUrl;
        } else {
          // Определяем реальные габариты видеофайла
          const vid = document.createElement('video');
          vid.preload = 'metadata';
          vid.onloadedmetadata = () => {
            const w = vid.videoWidth || 1920;
            const h = vid.videoHeight || 1080;
            resolve({
              id: `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
              name: file.name.replace(/\.[^/.]+$/, ''),
              category: 'Пользовательская',
              type: 'video',
              url: blobUrl,
              dataUrl,
              width: w,
              height: h,
              aspectRatio: w / h,
              grid: {
                enabled: true,
                size: 70,
                color: '#ffffff',
                opacity: 0.22,
                offsetX: 0,
                offsetY: 0,
              },
              viewport: { x: 0, y: 0, scale: 1 },
              fogActions: [],
              isFogBaseFilled: false,
              visited: true,
              tags: ['Загруженная', 'Анимированная'],
              createdAt: Date.now(),
              lastVisitedAt: Date.now(),
            });
          };
          vid.onerror = () => {
            resolve({
              id: `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
              name: file.name.replace(/\.[^/.]+$/, ''),
              category: 'Пользовательская',
              type: 'video',
              url: blobUrl,
              dataUrl,
              width: 1920,
              height: 1080,
              aspectRatio: 1920 / 1080,
              grid: {
                enabled: true,
                size: 70,
                color: '#ffffff',
                opacity: 0.22,
                offsetX: 0,
                offsetY: 0,
              },
              viewport: { x: 0, y: 0, scale: 1 },
              fogActions: [],
              isFogBaseFilled: false,
              visited: true,
              tags: ['Загруженная', 'Анимированная'],
              createdAt: Date.now(),
              lastVisitedAt: Date.now(),
            });
          };
          vid.src = blobUrl;
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  const name = typeof fileOrName === 'string' ? fileOrName : 'Загруженная карта';
  const url = urlOrUndefined || '';
  const dataUrl = dataUrlOrUndefined || url;
  const type = typeOrUndefined || 'image';

  return {
    id: `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    name: name.replace(/\.[^/.]+$/, ''),
    category: 'Пользовательская',
    type,
    url,
    dataUrl,
    width,
    height,
    aspectRatio: width / height,
    grid: {
      enabled: true,
      size: 70,
      color: '#ffffff',
      opacity: 0.22,
      offsetX: 0,
      offsetY: 0,
    },
    viewport: { x: 0, y: 0, scale: 1 },
    fogActions: [],
    isFogBaseFilled: false,
    visited: true,
    tags: ['Загруженная', type === 'video' ? 'Анимированная' : 'Статическая'],
    createdAt: Date.now(),
    lastVisitedAt: Date.now(),
  };
}
