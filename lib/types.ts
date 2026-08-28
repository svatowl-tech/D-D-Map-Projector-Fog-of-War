/**
 * Типы данных и протоколы синхронизации для D&D Map Projector
 */

export type AppMode = 'dm' | 'player';

export type BrushMode = 'reveal' | 'hide' | 'pan' | 'ping' | 'measure';

export interface ViewportTransform {
  x: number;
  y: number;
  scale: number;
}

export interface GridConfig {
  enabled: boolean;
  size: number; // размер клетки в пикселях
  color: string;
  opacity: number;
  offsetX: number;
  offsetY: number;
}

export interface MediaState {
  type: 'none' | 'image' | 'video';
  url: string | null;
  name: string;
  width: number;
  height: number;
  aspectRatio: number;
}

export interface FogPoint {
  x: number;
  y: number;
}

export interface FogStroke {
  id: string;
  type: 'stroke';
  mode: 'reveal' | 'hide';
  points: FogPoint[];
  brushSize: number;
}

export interface FogFillAction {
  id: string;
  type: 'fill' | 'clear';
}

export type FogAction = FogStroke | FogFillAction;

export interface PingMarker {
  id: string;
  x: number;
  y: number;
  color: string;
  timestamp: number;
}

export interface Measurement {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  active: boolean;
}

// Сообщения межпроцессного взаимодействия через BroadcastChannel
export type SyncMessage =
  | { type: 'PLAYER_READY'; timestamp: number }
  | { type: 'DM_STATE_FULL'; payload: DMFullState; timestamp: number }
  | { type: 'MEDIA_CHANGE'; payload: { media: MediaState; dataUrl?: string }; timestamp: number }
  | { type: 'VIEWPORT_SYNC'; payload: ViewportTransform; timestamp: number }
  | { type: 'FOG_ACTION'; payload: FogAction; timestamp: number }
  | { type: 'FOG_RESET'; payload: { fill: boolean }; timestamp: number }
  | { type: 'GRID_CONFIG'; payload: GridConfig; timestamp: number }
  | { type: 'PING'; payload: PingMarker; timestamp: number }
  | { type: 'HEARTBEAT'; timestamp: number; role: 'dm' | 'player' };

export interface DMFullState {
  media: MediaState;
  mediaDataUrl?: string;
  viewport: ViewportTransform;
  grid: GridConfig;
  fogActions: FogAction[];
  fogBaseFilled: boolean;
}
