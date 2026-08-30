/**
 * Типы данных и протоколы синхронизации для D&D Map Projector & Generator Studio
 */

import { CampaignCard } from './dnd-engine/types';

export type AppMode = 'dm' | 'player';

export type BrushMode = 'reveal' | 'hide' | 'pan' | 'ping' | 'measure';

export type GeneratorType = 'cave' | 'city' | 'dwell' | 'taverns' | 'village';

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
  generatorType?: GeneratorType | 'custom';
  floorIndex?: number;
  floorLabel?: string;
  floorTitle?: string;
  totalFloors?: number;
}

export interface MapFloorItem {
  id: string;
  floorIndex: number;
  floorLabel: string;
  floorTitle: string;
  name: string;
  url: string;
  width: number;
  height: number;
  fogActions: FogAction[];
  isFogBaseFilled: boolean;
}

export interface MultiFloorGroup {
  id: string;
  name: string;
  generatorType: GeneratorType | 'custom';
  floors: MapFloorItem[];
  activeFloorIndex: number;
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

export interface PlayerViewportInfo {
  windowWidth: number;
  windowHeight: number;
  viewport: ViewportTransform;
  mapWidth: number;
  mapHeight: number;
  aspectRatio: number;
}

export interface SavedMapLocation {
  id: string;
  name: string;
  category: 'Подземелье' | 'Природа' | 'Помещение' | 'Город' | 'Пещера' | 'Здание' | 'Генератор' | 'Пользовательская' | string;
  type: 'image' | 'video';
  url: string;
  dataUrl?: string;
  width: number;
  height: number;
  aspectRatio: number;
  grid: GridConfig;
  viewport: ViewportTransform;
  fogActions: FogAction[];
  isFogBaseFilled: boolean;
  visited: boolean; // "Сыгранная / Посещенная"
  tags: string[];
  lastVisitedAt?: number;
  createdAt: number;
  notes?: string;
  floorIndex?: number;
  floorLabel?: string;
  generatorType?: GeneratorType | 'custom';
}

// Сообщения межпроцессного взаимодействия через BroadcastChannel
export type SyncMessage =
  | { type: 'PLAYER_READY'; timestamp: number }
  | { type: 'REQUEST_FULL_STATE'; timestamp: number }
  | { type: 'PLAYER_VIEWPORT_INFO'; payload: PlayerViewportInfo; timestamp: number }
  | { type: 'DM_STATE_FULL'; payload: DMFullState; timestamp: number }
  | { type: 'MEDIA_CHANGE'; payload: { media: MediaState; dataUrl?: string }; timestamp: number }
  | { type: 'VIEWPORT_SYNC'; payload: ViewportTransform; timestamp: number }
  | { type: 'FOG_ACTION'; payload: FogAction; timestamp: number }
  | { type: 'FOG_RESET'; payload: { fill: boolean }; timestamp: number }
  | { type: 'GRID_CONFIG'; payload: GridConfig; timestamp: number }
  | { type: 'PING'; payload: PingMarker; timestamp: number }
  | { type: 'PROJECT_CARD'; payload: { card: CampaignCard | null }; timestamp: number }
  | { type: 'TABLE_CARDS_SYNC'; payload: { cards: CampaignCard[] }; timestamp: number }
  | { type: 'HEARTBEAT'; timestamp: number; role: 'dm' | 'player' };

export interface DMFullState {
  media: MediaState;
  mediaDataUrl?: string;
  viewport: ViewportTransform;
  grid: GridConfig;
  fogActions: FogAction[];
  fogBaseFilled: boolean;
  projectedCard?: CampaignCard | null;
  pinnedTableCards?: CampaignCard[];
}

export interface GeneratorExportEventData {
  type: string;
  generatorType?: GeneratorType;
  dataUrl: string;
  filename?: string;
  width?: number;
  height?: number;
  format?: string;
  houseName?: string;
  floorIndex?: number;
  floorLabel?: string;
  floorTitle?: string;
  isBatch?: boolean;
  batchIndex?: number;
  batchTotal?: number;
  isMultiSheet?: boolean;
  timestamp?: number;
}
