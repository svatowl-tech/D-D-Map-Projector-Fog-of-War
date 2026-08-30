/**
 * СЕРВИС РАЗРЕШЕНИЯ ПУТЕЙ И ОПТИМИЗАЦИИ ПАМЯТИ: mediaCache.ts
 * Управление тяжелыми медиафайлами (карты 8K, 4K видео, аудиофайлы) для системы
 * с высокими требованиями к энергоэффективности (macOS 10.13, 2 GB RAM).
 *
 * ГЛАВНЫЙ ПРИНЦИП: LAZY LOADING + ОГРАНИЧЕННЫЙ LRU-КЭШ (LEAST RECENTLY USED).
 * В памяти держится максимум 40 активных URL-ссылок типа blob:http://...
 * При добавлении 41-го файла самый старый неиспользуемый объект немедленно
 * освобождается через вызов URL.revokeObjectURL(oldUrl).
 */

import { getAssetBlob } from './indexedDbStorage';

interface CacheEntry {
  assetId: string;
  blobUrl: string;
  lastUsed: number;
}

// Максимальное количество одновременно удерживаемых blob: URL в оперативной памяти (адаптировано под 2GB RAM)
const MAX_LRU_CAPACITY = 5;

// Реестр LRU-кэша: assetId -> CacheEntry
const lruCache = new Map<string, CacheEntry>();

/**
 * Проверяет и защищает путь от уязвимостей Path Traversal (выход за пределы корневой папки)
 */
export function sanitizePath(inputPath: string): string {
  if (!inputPath) return '';

  // Удаляем варианты выхода из каталога типа ../ или ..\
  let sanitized = inputPath.replace(/(\.\.[\/\\])+/g, '');

  // Заменяем повторные слэши и непечатаемые символы
  sanitized = sanitized.replace(/[\/\\]+/g, '/').trim();

  // Удаляем ведущие слэши для формирования чистого относительного пути
  sanitized = sanitized.replace(/^\/+/, '');

  return sanitized;
}

/**
 * Единый прозрачный шлюз разрешения ссылок медиафайлов (resolveMediaUrl)
 *
 * Поддерживаемые форматы URI:
 * 1. http://... или https://... -> Возвращаются напрямую
 * 2. data:image/... или data:video/... -> Возвращаются напрямую
 * 3. idb://<asset_id> -> Читается из IndexedDB, превращается в blob: URL с LRU-кэшированием
 * 4. AetherMap_Data/... или /assets/... -> Преобразуется в безопасный локальный веб-путь
 */
export async function resolveMediaUrl(uri: string | null | undefined): Promise<string> {
  if (!uri || typeof uri !== 'string') {
    return '';
  }

  const trimmedUri = uri.trim();

  // 1. Прямые веб-ссылки и Base64 Data URL
  if (
    trimmedUri.startsWith('http://') ||
    trimmedUri.startsWith('https://') ||
    trimmedUri.startsWith('data:') ||
    trimmedUri.startsWith('blob:')
  ) {
    return trimmedUri;
  }

  // 2. Обработка виртуального протокола idb://<asset_id>
  if (trimmedUri.startsWith('idb://')) {
    const assetId = trimmedUri.replace(/^idb:\/\//, '');

    // Проверяем, находится ли ресурс уже в горячем LRU-кэше
    if (lruCache.has(assetId)) {
      const entry = lruCache.get(assetId)!;
      entry.lastUsed = Date.now();
      return entry.blobUrl;
    }

    // Извлекаем бинарный Blob из IndexedDB
    try {
      const blob = await getAssetBlob(assetId);
      if (!blob) {
        console.warn(`[mediaCache] Blob для asset ${assetId} не найден в IndexedDB`);
        return '';
      }

      // Если достигнут лимит 40 активных ссылок в RAM, удаляем самый старый ресурс (OOM Protection)
      if (lruCache.size >= MAX_LRU_CAPACITY) {
        evictOldestBlob();
      }

      // Создаем новый временный blob: URL
      const blobUrl = URL.createObjectURL(blob);
      lruCache.set(assetId, {
        assetId,
        blobUrl,
        lastUsed: Date.now(),
      });

      return blobUrl;
    } catch (err) {
      console.error(`[mediaCache] Ошибка извлечения blob для ${assetId}:`, err);
      return '';
    }
  }

  // 3. Локальные пути диска / рабочей директории AetherMap_Data
  const cleanPath = sanitizePath(trimmedUri);
  if (cleanPath.startsWith('assets/') || cleanPath.startsWith('public/')) {
    return `/${cleanPath.replace(/^public\//, '')}`;
  }

  // По умолчанию возвращаем очищенный относительный путь
  return `/${cleanPath}`;
}

/**
 * Освобождает память самого давно неиспользуемого blob: URL (LRU Eviction)
 */
function evictOldestBlob(): void {
  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  for (const [key, entry] of lruCache.entries()) {
    if (entry.lastUsed < oldestTime) {
      oldestTime = entry.lastUsed;
      oldestKey = key;
    }
  }

  if (oldestKey && lruCache.has(oldestKey)) {
    const entry = lruCache.get(oldestKey)!;
    try {
      URL.revokeObjectURL(entry.blobUrl);
    } catch (e) {
      console.warn(`[mediaCache] Ошибка вызова revokeObjectURL для ${entry.blobUrl}:`, e);
    }
    lruCache.delete(oldestKey);
    console.info(`[mediaCache LRU] Освобожден неиспользуемый blob URL для assetId: ${oldestKey}`);
  }
}

/**
 * Явное удаление ссылки из кэша для конкретного ресурса
 */
export function revokeBlobForAsset(assetId: string): void {
  const cleanId = assetId.replace(/^idb:\/\//, '');
  if (lruCache.has(cleanId)) {
    const entry = lruCache.get(cleanId)!;
    try {
      URL.revokeObjectURL(entry.blobUrl);
    } catch (e) {}
    lruCache.delete(cleanId);
  }
}

/**
 * Полная очистка LRU-кэша медиафайлов при смене сессии или по запросу пользователя
 */
export function clearMediaCache(): void {
  for (const entry of lruCache.values()) {
    try {
      URL.revokeObjectURL(entry.blobUrl);
    } catch (e) {}
  }
  lruCache.clear();
  console.info('[mediaCache] LRU-кэш медиафайлов полностью очищен.');
}

/**
 * Получить текущие метрики использования оперативной памяти и LRU-кэша
 */
export function getMediaCacheStats(): { activeBlobsCount: number; maxCapacity: number; cachedAssetIds: string[] } {
  return {
    activeBlobsCount: lruCache.size,
    maxCapacity: MAX_LRU_CAPACITY,
    cachedAssetIds: Array.from(lruCache.keys()),
  };
}
