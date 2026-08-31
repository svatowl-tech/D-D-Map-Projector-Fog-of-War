/**
 * BroadcastChannel Synchronization for Dual-Window DM & Player/Projector View
 * High-performance, zero-latency, local synchronization
 */

export class BattlemapSync {
  constructor(channelName = 'dnd_battlemap_sync', onMessageCallback = null) {
    this.channelName = channelName;
    this.onMessage = onMessageCallback;
    this.channel = null;
    this.isSupported = typeof window !== 'undefined' && 'BroadcastChannel' in window;
    this.initChannel();
  }

  initChannel() {
    if (!this.isSupported) return;
    try {
      this.channel = new BroadcastChannel(this.channelName);
      this.channel.onmessage = (event) => {
        if (event && event.data && this.onMessage) {
          try {
            this.onMessage(event.data);
          } catch (err) {
            console.error('[Sync] Error processing broadcast message:', err);
          }
        }
      };
    } catch (e) {
      console.warn('[Sync] BroadcastChannel init failed:', e);
    }
  }

  send(type, payload = {}) {
    if (!this.channel) return;
    try {
      this.channel.postMessage({
        type,
        payload,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('[Sync] Error sending broadcast message:', err);
    }
  }

  destroy() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }
}
