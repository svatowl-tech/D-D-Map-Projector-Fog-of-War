/**
 * Типы данных для интерактивных инструментов работы с картой (Photoshop Map FX Engine)
 * Пожар, затопление, токсичные газы, лазерная указка, маяки внимания, тактические маркеры и зоны заклинаний.
 */

export type MapFxToolType =
  | 'laser'        // Лазерная указка (Laser Pointer)
  | 'attention'    // Привлечение внимания / Маяк (Attention Beacon)
  | 'fire'         // Пожар / Огонь (Fire / Burning)
  | 'water'        // Вода / Затопление (Water / Flood)
  | 'gas'          // Туман / Задымление / Ядовитый газ (Gas / Smoke / Poison)
  | 'marker'       // Тактический маркер / Карандаш (Tactical Pen / Marker)
  | 'spell_zone'   // Зоны заклинаний и радиусов D&D (AOE Spell Templates)
  | 'eraser';      // Ластик эффектов (Eraser)

export type GasVariant = 'poison' | 'smoke' | 'acid' | 'magic' | 'ash';
export type WaterVariant = 'ocean' | 'swamp' | 'blood' | 'acid' | 'holy';
export type LaserColor = '#ff2a2a' | '#00ff88' | '#00d0ff' | '#ffcc00' | '#e056fd';
export type AttentionStyle = 'radar' | 'beacon' | 'shockwave' | 'spotlight';
export type SpellShapeType = 'circle' | 'cone' | 'cube' | 'line';

export interface MapPoint {
  x: number;
  y: number;
}

export interface MapFxStroke {
  id: string;
  tool: 'fire' | 'water' | 'gas' | 'marker';
  points: MapPoint[];
  brushSize: number;
  opacity: number;
  color?: string;
  variant?: string;
  createdAt: number;
}

export interface SpellZoneArea {
  id: string;
  shape: SpellShapeType;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  radiusFeet: number;
  color: string;
  label: string;
  opacity: number;
  createdAt: number;
}

export interface LaserPointerState {
  active: boolean;
  x: number;
  y: number;
  color: LaserColor;
  trail: { x: number; y: number; timestamp: number }[];
}

export interface AttentionBeacon {
  id: string;
  x: number;
  y: number;
  color: string;
  text?: string;
  icon?: 'alert' | 'skull' | 'eye' | 'target' | 'star' | 'sword';
  style: AttentionStyle;
  timestamp: number;
  durationMs: number;
}

export interface MapFxState {
  strokes: MapFxStroke[];
  spellZones: SpellZoneArea[];
  activeLaser: LaserPointerState | null;
  attentionBeacons: AttentionBeacon[];
}

export interface MapFxSyncPayload {
  strokes?: MapFxStroke[];
  spellZones?: SpellZoneArea[];
  laser?: LaserPointerState | null;
  beacon?: AttentionBeacon;
  clearAll?: boolean;
}
