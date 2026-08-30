/**
 * СЕРВИС АВТОСИНХРОНИЗАЦИИ И СТРУКТУРЫ ДИРЕКТАТОРИЙ: fsSync.ts
 *
 * Отвечает за бесшовную интеграцию между жестким диском (или браузерным хранилищем)
 * и структурой AetherMap_Data/:
 *
 * AetherMap_Data/
 * ├── maps/               (JPG, PNG, WebP, SVG) + подпапки (/Dungeons, /Cities)
 * ├── animated_maps/      (MP4, WebM) с автозацикливанием
 * ├── audio/              (bgm/, ambience/, sfx/)
 * ├── tokens/             (Круглые аватары)
 * ├── vault_presets/      (Пресеты сцен .json)
 * └── blackout_videos/    (Заставки и видео затемнения)
 *
 * Особенности:
 * - Фоновое сканирование (Polling / File System Access API / Drag-and-Drop)
 * - Определение MIME-типов и автоматическое распределение
 * - Безопасность путей (Path Traversal Protection)
 */

import { AssetCategory, AssetMediaType, AssetRecord, saveAssetRecord, saveSetting, getSetting } from './indexedDbStorage';
import { sanitizePath } from './mediaCache';

export const REQUIRED_DIRECTORIES: AssetCategory[] = [
  'maps',
  'animated_maps',
  'audio/bgm',
  'audio/ambience',
  'audio/sfx',
  'tokens',
  'vault_presets',
  'blackout_videos',
];

export interface FileScanResult {
  assetsAdded: number;
  assetsUpdated: number;
  assetsRemoved: number;
  totalAssets: number;
  errors: string[];
}

/**
 * Расширенная проверка безопасности относительного пути (Path Traversal Protection)
 */
export function validateRelativePath(path: string): boolean {
  if (!path) return false;
  // Не допускаем нулевые байты, протоколы или точки выхода из каталога
  if (path.includes('\0') || path.includes('..') || path.includes('%2e%2e')) {
    return false;
  }
  return true;
}

/**
 * Определение категории и типа медиафайла по расширению и названию (MIME Inspection)
 */
export function categorizeFile(
  fileName: string,
  parentFolderPath: string
): { category: AssetCategory; type: AssetMediaType; mimeType: string; subfolder: string } {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const cleanParent = sanitizePath(parentFolderPath).toLowerCase();

  let type: AssetMediaType = 'image';
  let mimeType = 'application/octet-stream';

  // Определение расширения
  if (['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif'].includes(ext)) {
    type = 'image';
    mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  } else if (['mp4', 'webm', 'm4v', 'mov'].includes(ext)) {
    type = 'video';
    mimeType = ext === 'webm' ? 'video/webm' : 'video/mp4';
  } else if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)) {
    type = 'audio';
    mimeType = ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : `audio/${ext}`;
  } else if (ext === 'json') {
    type = 'preset';
    mimeType = 'application/json';
  }

  // Определение категории AetherMap_Data по родительскому пути
  let category: AssetCategory = 'maps';
  let subfolder = '';

  if (cleanParent.includes('animated_maps')) {
    category = 'animated_maps';
    subfolder = cleanParent.replace(/.*animated_maps\/?/, '');
  } else if (cleanParent.includes('audio/bgm') || cleanParent.includes('audio\\bgm')) {
    category = 'audio/bgm';
    subfolder = cleanParent.replace(/.*audio[\/\\]bgm\/?/, '');
  } else if (cleanParent.includes('audio/ambience') || cleanParent.includes('audio\\ambience')) {
    category = 'audio/ambience';
    subfolder = cleanParent.replace(/.*audio[\/\\]ambience\/?/, '');
  } else if (cleanParent.includes('audio/sfx') || cleanParent.includes('audio\\sfx')) {
    category = 'audio/sfx';
    subfolder = cleanParent.replace(/.*audio[\/\\]sfx\/?/, '');
  } else if (cleanParent.includes('audio')) {
    category = 'audio/bgm';
    subfolder = cleanParent.replace(/.*audio\/?/, '');
  } else if (cleanParent.includes('tokens')) {
    category = 'tokens';
    subfolder = cleanParent.replace(/.*tokens\/?/, '');
  } else if (cleanParent.includes('vault_presets')) {
    category = 'vault_presets';
    subfolder = cleanParent.replace(/.*vault_presets\/?/, '');
  } else if (cleanParent.includes('blackout_videos')) {
    category = 'blackout_videos';
    subfolder = cleanParent.replace(/.*blackout_videos\/?/, '');
  } else {
    // По умолчанию считаем картой
    category = 'maps';
    subfolder = cleanParent.replace(/.*maps\/?/, '');
  }

  // Переопределение типа по категории если это blackout или animated_maps
  if (category === 'animated_maps' || category === 'blackout_videos') {
    if (type !== 'image') type = 'video';
  }

  return { category, type, mimeType, subfolder };
}

/**
 * Генерирует стабильный строковый ID ресурса на основе его пути, размера и имени
 */
export function generateStableAssetId(relativePath: string, size: number, modifiedAt: number): string {
  const clean = sanitizePath(relativePath);
  let hash = 0;
  const str = `${clean}_${size}_${modifiedAt}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash).toString(36);
  return `asset_${positiveHash}`;
}

/**
 * Извлекает автоматические теги из пути и имени файла
 */
export function extractAutoTags(relativePath: string, category: AssetCategory): string[] {
  const tagsSet = new Set<string>();

  // Добавляем тег категории
  tagsSet.add(`#${category.replace('/', '_')}`);

  const parts = relativePath.split(/[\/\\]+/);
  parts.forEach((part) => {
    const clean = part.toLowerCase().replace(/\.[^/.]+$/, '');
    if (clean.includes('dungeon')) tagsSet.add('#dungeon');
    if (clean.includes('city') || clean.includes('town')) tagsSet.add('#city');
    if (clean.includes('cave')) tagsSet.add('#cave');
    if (clean.includes('tavern') || clean.includes('inn')) tagsSet.add('#tavern');
    if (clean.includes('forest') || clean.includes('nature')) tagsSet.add('#nature');
    if (clean.includes('night')) tagsSet.add('#night');
    if (clean.includes('boss')) tagsSet.add('#bossfight');
    if (clean.includes('battle')) tagsSet.add('#battle');
    if (clean.includes('bgm')) tagsSet.add('#music');
    if (clean.includes('rain') || clean.includes('wind')) tagsSet.add('#weather');
  });

  return Array.from(tagsSet);
}

/**
 * Вызывает браузерный диалог выбора папки на диске через HTML5 File System Access API
 */
export async function selectWorkspaceDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
    console.warn('File System Access API (showDirectoryPicker) не поддерживается в данном браузере.');
    return null;
  }

  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    });

    if (handle) {
      await saveSetting('workspace_dir_name', handle.name);
      return handle;
    }
    return null;
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.error('Ошибка выбора рабочей директории AetherMap_Data:', err);
    }
    return null;
  }
}

/**
 * Сканирует локальную папку через File System Access API и синхронизирует ее с IndexedDB
 */
export async function scanDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  parentPath = ''
): Promise<AssetRecord[]> {
  const results: AssetRecord[] = [];

  try {
    for await (const entry of (dirHandle as any).values()) {
      const currentRelativePath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

      if (!validateRelativePath(currentRelativePath)) {
        continue;
      }

      if (entry.kind === 'file') {
        try {
          const file: File = await entry.getFile();
          const { category, type, mimeType, subfolder } = categorizeFile(entry.name, parentPath);
          const assetId = generateStableAssetId(currentRelativePath, file.size, file.lastModified);

          // Рассчитываем размеры для картинок
          let dimensions = { width: 1920, height: 1080, aspectRatio: 16 / 9 };
          if (type === 'image') {
            try {
              dimensions = await getImageDimensionsFromFile(file);
            } catch (e) {}
          }

          const assetRecord: AssetRecord = {
            id: assetId,
            name: entry.name,
            relativePath: currentRelativePath,
            category,
            subfolder,
            mimeType,
            type,
            blob: file,
            size: file.size,
            modifiedAt: file.lastModified,
            tags: extractAutoTags(currentRelativePath, category),
            dimensions,
          };

          await saveAssetRecord(assetRecord);
          results.push(assetRecord);
        } catch (fileErr) {
          console.error(`Ошибка чтения файла ${entry.name}:`, fileErr);
        }
      } else if (entry.kind === 'directory') {
        // Рекурсивный обход подпапок (/maps/Dungeons, /audio/bgm и т.д.)
        const subResults = await scanDirectoryHandle(entry, currentRelativePath);
        results.push(...subResults);
      }
    }
  } catch (err) {
    console.error('Ошибка сканирования директории AetherMap_Data:', err);
  }

  return results;
}

/**
 * Обработка пользовательских файлов, загруженных через Drag-and-Drop или обычный input file
 */
export async function processUploadedFiles(
  files: FileList | File[],
  targetCategory: AssetCategory = 'maps'
): Promise<AssetRecord[]> {
  const processed: AssetRecord[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = file.webkitRelativePath || `${targetCategory}/${file.name}`;
    const cleanPath = sanitizePath(path);

    if (!validateRelativePath(cleanPath)) continue;

    const { category, type, mimeType, subfolder } = categorizeFile(file.name, targetCategory);
    const assetId = generateStableAssetId(cleanPath, file.size, file.lastModified);

    let dimensions = { width: 1920, height: 1080, aspectRatio: 16 / 9 };
    if (type === 'image') {
      try {
        dimensions = await getImageDimensionsFromFile(file);
      } catch (e) {}
    }

    const assetRecord: AssetRecord = {
      id: assetId,
      name: file.name,
      relativePath: cleanPath,
      category,
      subfolder,
      mimeType,
      type,
      blob: file,
      size: file.size,
      modifiedAt: file.lastModified || Date.now(),
      tags: extractAutoTags(cleanPath, category),
      dimensions,
    };

    await saveAssetRecord(assetRecord);
    processed.push(assetRecord);
  }

  return processed;
}

/**
 * Вспомогательная функция определения точных размеров изображения из файла
 */
function getImageDimensionsFromFile(file: File): Promise<{ width: number; height: number; aspectRatio: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const width = img.naturalWidth || 1920;
      const height = img.naturalHeight || 1080;
      URL.revokeObjectURL(objectUrl);
      resolve({
        width,
        height,
        aspectRatio: width / height,
      });
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = objectUrl;
  });
}
