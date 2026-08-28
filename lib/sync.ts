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
          this.onMessageCallback(event.data);
        };
      } catch (err) {
        console.warn('[SyncController] Ошибка создания BroadcastChannel, переход на localStorage:', err);
        this.hasBroadcastChannel = false;
      }
    }

    // Резервный канал через событие storage для старых браузеров / кросс-оконных вкладок
    window.addEventListener('storage', this.handleStorageEvent);
  }

  private handleStorageEvent = (event: StorageEvent) => {
    if (this.isDestroyed) return;
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        const msg: SyncMessage = JSON.parse(event.newValue);
        this.onMessageCallback(msg);
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

    // 1. Попытка отправки через нативный BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (err) {
        console.error('[SyncController] Ошибка отправки BroadcastChannel:', err);
      }
    }

    // 2. Дублирование/fallback через localStorage для полной совместимости
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...msg, _t: Date.now() }));
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
      window.removeEventListener('storage', this.handleStorageEvent);
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
