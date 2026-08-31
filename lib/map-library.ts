/**
 * Менеджер библиотеки локаций и тактических карт кампании (Campaign Map Library).
 * Сохраняет историю исследованных карт, состояние тумана войны для каждой карты,
 * масштаб и положение камеры, настройки сетки и заметки мастера.
 */

import { SavedMapLocation, ViewportTransform, GridConfig, FogAction, GeneratorExportEventData } from './types';
import { PRESET_MAPS, PresetMap } from './presets';

const STORAGE_KEY = '__dnd_campaign_map_library_v2__';
const ACTIVE_MAP_ID_KEY = '__dnd_active_map_id__';

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
 * Инициализирует библиотеку карт из локального хранилища или встроенных пресетов
 */
export function initMapLibrary(): SavedMapLocation[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved map library, resetting to defaults', e);
    }
  }

  const initial = getDefaultPresetLocations();
  if (typeof window !== 'undefined') {
    saveMapLibrary(initial);
  }
  return initial;
}

/**
 * Сохраняет библиотеку локаций в localStorage
 */
export function saveMapLibrary(locations: SavedMapLocation[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
  } catch (e) {
    console.error('Failed to save map library to localStorage:', e);
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
