/**
 * АРХИТЕКТУРА ДАННЫХ: Браузерное хранилище IndexedDB для AetherMap Studio
 * Обеспечивает автономное сохранение тяжелых бинарных медиафайлов (Blob/ArrayBuffer),
 * карт, токенов, пресетов и видео без прямой привязки к локальному серверу.
 *
 * Каждому сохраненному ресурсу присваивается уникальный виртуальный URI вида idb://<asset_id>
 */

import { GridConfig, FogAction } from './types';

export type AssetCategory =
  | 'maps'
  | 'animated_maps'
  | 'audio/bgm'
  | 'audio/ambience'
  | 'audio/sfx'
  | 'tokens'
  | 'vault_presets'
  | 'blackout_videos';

export type AssetMediaType = 'image' | 'video' | 'audio' | 'preset';

export interface AssetRecord {
  id: string; // Уникальный идентификатор asset_<hash>
  name: string; // Имя файла (например, Ancient_Dungeon.webp)
  relativePath: string; // Относительный путь (например, maps/Dungeons/Ancient_Dungeon.webp)
  category: AssetCategory; // Категория поддиректории AetherMap_Data
  subfolder: string; // Вложенная подпапка (например, Dungeons)
  mimeType: string; // MIME тип (например, image/webp)
  type: AssetMediaType; // Тип медиа (image | video | audio | preset)
  blob?: Blob; // Бинарный Blob файла
  url?: string; // Локальный путь или внешняя ссылка если blob не используется
  size: number; // Размер файла в байтах
  modifiedAt: number; // Время последней модификации (timestamp)
  tags: string[]; // Автоматические и пользовательские теги (#dungeon, #bossfight, #night)
  dimensions?: {
    width: number;
    height: number;
    aspectRatio: number;
  };
  gridConfig?: GridConfig; // Координаты и параметры сетки по умолчанию
  presetData?: any; // Экспортированные данные пресета сцены (.json)
}

export interface VaultPreset {
  id: string;
  name: string;
  description?: string;
  mapAssetId?: string;
  mapUrl?: string;
  grid: GridConfig;
  fogActions: FogAction[];
  isFogBaseFilled: boolean;
  createdAt: number;
  updatedAt: number;
  tags: string[];
}

const DB_NAME = 'AetherMap_Data_DB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Инициализирует и возвращает экземпляр базы данных IndexedDB
 */
export function getDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB доступна только в среде браузера'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;

        // Хранилище медиаресурсов AetherMap_Data
        if (!db.objectStoreNames.contains('assets')) {
          const assetStore = db.createObjectStore('assets', { keyPath: 'id' });
          assetStore.createIndex('category', 'category', { unique: false });
          assetStore.createIndex('type', 'type', { unique: false });
          assetStore.createIndex('relativePath', 'relativePath', { unique: true });
        }

        // Хранилище пресетов сцен (.json)
        if (!db.objectStoreNames.contains('vault_presets')) {
          db.createObjectStore('vault_presets', { keyPath: 'id' });
        }

        // Хранилище системных настроек и конфигурации рабочей папки
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('Ошибка открытия IndexedDB AetherMap_Data:', request.error);
        reject(request.error);
      };
    } catch (err) {
      reject(err);
    }
  });

  return dbPromise;
}

/**
 * Сохраняет бинарный ресурс в IndexedDB и возвращает виртуальный URI idb://<id>
 */
export async function saveAssetRecord(asset: AssetRecord): Promise<string> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['assets'], 'readwrite');
    const store = transaction.objectStore('assets');
    const request = store.put(asset);

    request.onsuccess = () => {
      resolve(`idb://${asset.id}`);
    };

    request.onerror = () => {
      console.error(`Ошибка записи asset ${asset.id} в IndexedDB:`, request.error);
      reject(request.error);
    };
  });
}

/**
 * Извлекает запись ресурса по его строковому ID
 */
export async function getAssetRecord(id: string): Promise<AssetRecord | null> {
  const db = await getDb();
  const cleanId = id.replace(/^idb:\/\//, '');

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['assets'], 'readonly');
    const store = transaction.objectStore('assets');
    const request = store.get(cleanId);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      console.error(`Ошибка чтения asset ${cleanId} из IndexedDB:`, request.error);
      reject(request.error);
    };
  });
}

/**
 * Извлекает бинарный Blob ресурса для формирования blob: URL в mediaCache
 */
export async function getAssetBlob(id: string): Promise<Blob | null> {
  const record = await getAssetRecord(id);
  if (!record) return null;
  if (record.blob) return record.blob;
  return null;
}

/**
 * Возвращает реестр всех сохраненных ресурсов без загрузки тяжелых бинарных Blobs
 */
export async function getAllAssetRecords(): Promise<AssetRecord[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['assets'], 'readonly');
    const store = transaction.objectStore('assets');
    const request = store.getAll();

    request.onsuccess = () => {
      const results: AssetRecord[] = request.result || [];
      resolve(results);
    };

    request.onerror = () => {
      console.error('Ошибка получения всех asset из IndexedDB:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Удаляет ресурс из IndexedDB по ID
 */
export async function deleteAssetRecord(id: string): Promise<void> {
  const db = await getDb();
  const cleanId = id.replace(/^idb:\/\//, '');

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['assets'], 'readwrite');
    const store = transaction.objectStore('assets');
    const request = store.delete(cleanId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Сохраняет пресет сцены vault_presets (.json)
 */
export async function saveVaultPreset(preset: VaultPreset): Promise<string> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['vault_presets'], 'readwrite');
    const store = transaction.objectStore('vault_presets');
    const request = store.put(preset);

    request.onsuccess = () => resolve(preset.id);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Получает список всех пресетов сцен
 */
export async function getAllVaultPresets(): Promise<VaultPreset[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['vault_presets'], 'readonly');
    const store = transaction.objectStore('vault_presets');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Сохраняет системное свойство настроек
 */
export async function saveSetting(key: string, value: any): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['settings'], 'readwrite');
    const store = transaction.objectStore('settings');
    const request = store.put({ key, value });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Читает системное свойство настроек
 */
export async function getSetting<T = any>(key: string): Promise<T | null> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result ? request.result.value : null);
    request.onerror = () => reject(request.error);
  });
}
