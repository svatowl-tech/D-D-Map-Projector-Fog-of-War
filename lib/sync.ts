/**
 * Модуль синхронизации окон через BroadcastChannel API с fallback на localStorage.
 * Гарантирует нулевые сетевые задержки и обмен только легковесными скалярами/векторами.
 */

import { SyncMessage } from './types';

const CHANNEL_NAME = 'dnd-projector-channel';
const STORAGE_KEY = '__dnd_projector_sync__';

export class SyncController {
  private channel: BroadcastChannel | null = null;
  private onMessageCallback: (msg: SyncMessage) => void;
  private hasBroadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window;
  private isDestroyed = false;
  private lastProcessedTimestamp = 0;

  constructor(onMessage: (msg: SyncMessage) => void) {
    this.onMessageCallback = onMessage;
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    if (this.hasBroadcastChannel) {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event: MessageEvent<SyncMessage>) => {
          if (this.isDestroyed || !event.data) return;
          this.processMessage(event.data);
        };
      } catch (err) {
        console.warn('[SyncController] BroadcastChannel creation failed, falling back to localStorage:', err);
        this.hasBroadcastChannel = false;
      }
    }

    // Резервный канал через событие storage (критично для Safari 13 на macOS 10.13)
    try {
      window.addEventListener('storage', this.handleStorageEvent);
    } catch (err) {
      console.warn('[SyncController] storage event listener error:', err);
    }
  }

  private processMessage(msg: SyncMessage) {
    if (this.isDestroyed) return;
    // Дедупликация сообщений для предотвращения двойного срабатывания
    if (msg.timestamp && msg.timestamp <= this.lastProcessedTimestamp) {
      // Исключаем HEARTBEAT, PING, LASER_SYNC, ATTENTION_BEACON и MAP_FX_STROKE от дедупликации
      const isHighFrequencyMsg =
        msg.type === 'PING' ||
        msg.type === 'HEARTBEAT' ||
        msg.type === 'LASER_SYNC' ||
        msg.type === 'ATTENTION_BEACON' ||
        msg.type === 'MAP_FX_STROKE';

      if (!isHighFrequencyMsg) {
        return;
      }
    }
    if (msg.timestamp) {
      this.lastProcessedTimestamp = msg.timestamp;
    }
    this.onMessageCallback(msg);
  }

  private handleStorageEvent = (event: StorageEvent) => {
    if (this.isDestroyed) return;
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        const msg: SyncMessage = JSON.parse(event.newValue);
        this.processMessage(msg);
      } catch (err) {
        console.error('[SyncController] Ошибка парсинга сообщения localStorage:', err);
      }
    }
  };

  /**
   * Отправка сообщения в канал проектора
   */
  public send(msg: SyncMessage) {
    if (this.isDestroyed) return;

    const messageWithTime: SyncMessage = {
      ...msg,
      timestamp: msg.timestamp || Date.now(),
    };

    // 1. Отправка через нативный BroadcastChannel (если поддерживается)
    if (this.channel) {
      try {
        this.channel.postMessage(messageWithTime);
      } catch (err) {
        console.error('[SyncController] Ошибка отправки BroadcastChannel:', err);
      }
    }

    // 2. Отправка через localStorage для Safari 13 / старых движков macOS 10.13
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messageWithTime));
    } catch {
      // Игнорируем квоту storage при частых событиях
    }
  }

  /**
   * Корректная очистка слушателей и закрытие каналов при размонтировании
   */
  public destroy() {
    this.isDestroyed = true;
    if (typeof window !== 'undefined') {
      try {
        window.removeEventListener('storage', this.handleStorageEvent);
      } catch {
        // noop
      }
    }
    if (this.channel) {
      try {
        this.channel.close();
      } catch (err) {
        console.error('[SyncController] Ошибка закрытия канала:', err);
      }
      this.channel = null;
    }
  }
}
