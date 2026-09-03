'use client';

/**
 * PhotoshopMapToolbar — Интегрированная панель инструментов рисования и спецэффектов карты
 * для Мастера Подземелий (встроена в боковую панель).
 * Включает: Огонь/Пожар, Затопление/Вода, Ядовитый газ/Дым, Лазерная указка,
 * Маяк привлечения внимания, Тактический маркер, AOE-зоны заклинаний, туман войны и ластик.
 */

import React, { useState } from 'react';
import { BrushMode } from '@/lib/types';
import {
  GasVariant,
  WaterVariant,
  LaserColor,
  AttentionStyle,
  SpellShapeType,
} from '@/lib/map-canvas-engine/types';
import {
  Flame,
  Droplets,
  CloudFog,
  Crosshair,
  AlertTriangle,
  PenTool,
  CircleDot,
  Eraser,
  Undo2,
  Trash2,
  Eye,
  EyeOff,
  Ruler,
  Move,
  Volume2,
  VolumeX,
  Radio,
  Grid,
} from 'lucide-react';

interface PhotoshopMapToolbarProps {
  brushMode: BrushMode;
  setBrushMode: (mode: BrushMode) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;

  // Параметры эффектов
  gasVariant: GasVariant;
  setGasVariant: (v: GasVariant) => void;
  waterVariant: WaterVariant;
  setWaterVariant: (v: WaterVariant) => void;
  laserColor: LaserColor;
  setLaserColor: (c: LaserColor) => void;
  attentionText: string;
  setAttentionText: (t: string) => void;
  attentionStyle: AttentionStyle;
  setAttentionStyle: (s: AttentionStyle) => void;
  soundAlertEnabled: boolean;
  setSoundAlertEnabled: React.Dispatch<React.SetStateAction<boolean>>;

  // Параметры маркера
  markerColor: string;
  setMarkerColor: (c: string) => void;

  // Параметры AOE зон
  spellShape: SpellShapeType;
  setSpellShape: (s: SpellShapeType) => void;
  spellRadius: number;
  setSpellRadius: (r: number) => void;
  spellLabel: string;
  setSpellLabel: (l: string) => void;
  spellColor: string;
  setSpellColor: (c: string) => void;

  // Быстрые действия
  onUndoLastFx: () => void;
  onClearAllFx: () => void;
  onQuickAttention: (text?: string) => void;
  fxStrokesCount: number;
}

export const PhotoshopMapToolbar: React.FC<PhotoshopMapToolbarProps> = ({
  brushMode,
  setBrushMode,
  brushSize,
  setBrushSize,
  gasVariant,
  setGasVariant,
  waterVariant,
  setWaterVariant,
  laserColor,
  setLaserColor,
  attentionText,
  setAttentionText,
  attentionStyle,
  setAttentionStyle,
  soundAlertEnabled,
  setSoundAlertEnabled,
  markerColor,
  setMarkerColor,
  spellShape,
  setSpellShape,
  spellRadius,
  setSpellRadius,
  spellLabel,
  setSpellLabel,
  spellColor,
  setSpellColor,
  onUndoLastFx,
  onClearAllFx,
  onQuickAttention,
  fxStrokesCount,
}) => {
  const [activeCategory, setActiveCategory] = useState<'fx' | 'tools' | 'fog'>('fx');

  // Быстрые пресеты заклинаний D&D 5e
  const spellPresets = [
    { label: 'Fireball', radius: 20, shape: 'circle' as SpellShapeType, color: '#ef4444' },
    { label: 'Spirit Guard', radius: 15, shape: 'circle' as SpellShapeType, color: '#eab308' },
    { label: 'Cone of Cold', radius: 60, shape: 'cone' as SpellShapeType, color: '#06b6d4' },
    { label: 'Burning Hands', radius: 15, shape: 'cone' as SpellShapeType, color: '#f97316' },
    { label: 'Hypnotic Pat.', radius: 30, shape: 'cube' as SpellShapeType, color: '#a855f7' },
    { label: 'Lightning Bolt', radius: 100, shape: 'line' as SpellShapeType, color: '#38bdf8' },
  ];

  // Быстрые фразы для сигнала внимания
  const attentionPresets = [
    '⚠️ ВНИМАНИЕ!',
    '🎯 СЮДА!',
    '💀 ОПАСНОСТЬ!',
    '⚡ ЛОВУШКА!',
    '⚔️ БОЙ!',
  ];

  const markerColors = [
    '#ef4444',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#38bdf8',
    '#a855f7',
    '#ffffff',
    '#000000',
  ];

  const laserColors: { label: string; value: LaserColor; bg: string }[] = [
    { label: 'Красный', value: '#ff2a2a', bg: '#ef4444' },
    { label: 'Лазурный', value: '#00d0ff', bg: '#06b6d4' },
    { label: 'Зеленый', value: '#00ff88', bg: '#22c55e' },
    { label: 'Фиолетовый', value: '#e056fd', bg: '#d946ef' },
    { label: 'Золотой', value: '#ffcc00', bg: '#f59e0b' },
  ];

  return (
    <section className="panel-section" id="dm-sidebar-fx-tools">
      <div className="flex justify-between items-center mb-2">
        <span className="label-meta mb-0">04 // Map Tools & FX</span>
        {fxStrokesCount > 0 ? (
          <span className="label-meta mb-0 font-mono" style={{ color: 'var(--accent)' }}>
            {fxStrokesCount} FX
          </span>
        ) : (
          <span className="label-meta mb-0">PRO</span>
        )}
      </div>

      {/* Переключатель групп инструментов */}
      <div className="grid grid-cols-3 gap-1 mb-2 bg-[#090d16] p-0.5 rounded border border-[var(--ink-faint)]">
        <button
          type="button"
          onClick={() => setActiveCategory('fx')}
          className={`py-1 text-[9px] font-mono uppercase font-bold rounded-sm transition-all ${
            activeCategory === 'fx'
              ? 'bg-[var(--accent)] text-white shadow-sm'
              : 'text-[var(--ink-muted)] hover:text-white'
          }`}
        >
          Спецэффекты
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory('tools')}
          className={`py-1 text-[9px] font-mono uppercase font-bold rounded-sm transition-all ${
            activeCategory === 'tools'
              ? 'bg-[var(--accent)] text-white shadow-sm'
              : 'text-[var(--ink-muted)] hover:text-white'
          }`}
        >
          Разметка & AOE
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory('fog')}
          className={`py-1 text-[9px] font-mono uppercase font-bold rounded-sm transition-all ${
            activeCategory === 'fog'
              ? 'bg-[var(--accent)] text-white shadow-sm'
              : 'text-[var(--ink-muted)] hover:text-white'
          }`}
        >
          Туман & Зум
        </button>
      </div>

      {/* Сетка кнопок в зависимости от выбранной вкладки */}
      {activeCategory === 'fx' && (
        <div className="grid grid-cols-3 gap-1 mb-2.5">
          <button
            type="button"
            onClick={() => setBrushMode('laser')}
            className={`btn ${brushMode === 'laser' ? 'btn-accent' : ''} justify-center`}
            title="Лазерная указка для подсветки на экране игроков (L / Alt)"
          >
            <Crosshair className="w-3 h-3 text-rose-400" />
            <span>Лазер</span>
          </button>

          <button
            type="button"
            onClick={() => setBrushMode('attention')}
            className={`btn ${brushMode === 'attention' ? 'btn-accent' : ''} justify-center`}
            title="Маяк тревоги и привлечения внимания (A)"
          >
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Маяк</span>
          </button>

          <button
            type="button"
            onClick={() => setBrushMode('fire')}
            className={`btn ${brushMode === 'fire' ? 'btn-accent' : ''} justify-center`}
            title="Огонь и пожар (F)"
          >
            <Flame className="w-3 h-3 text-orange-400" />
            <span>Огонь</span>
          </button>

          <button
            type="button"
            onClick={() => setBrushMode('water')}
            className={`btn ${brushMode === 'water' ? 'btn-accent' : ''} justify-center`}
            title="Вода, кровь, кислота и затопление (W)"
          >
            <Droplets className="w-3 h-3 text-cyan-400" />
            <span>Вода</span>
          </button>

          <button
            type="button"
            onClick={() => setBrushMode('gas')}
            className={`btn ${brushMode === 'gas' ? 'btn-accent' : ''} justify-center`}
            title="Ядовитый газ, дым и туман (Shift+G)"
          >
            <CloudFog className="w-3 h-3 text-emerald-400" />
            <span>Газ</span>
          </button>

          <button
            type="button"
            onClick={() => setBrushMode('eraser')}
            className={`btn ${brushMode === 'eraser' ? 'btn-accent' : ''} justify-center`}
            title="Ластик нарисованных эффектов карты (E)"
          >
            <Eraser className="w-3 h-3 text-rose-300" />
            <span>Ластик</span>
          </button>
        </div>
      )}

      {activeCategory === 'tools' && (
        <div className="grid grid-cols-2 gap-1 mb-2.5">
          <button
            type="button"
            onClick={() => setBrushMode('marker')}
            className={`btn ${brushMode === 'marker' ? 'btn-accent' : ''}`}
            title="Тактический карандаш и маркер заметок на карте (B)"
          >
            <PenTool className="w-3 h-3 text-sky-400" />
            <span>Маркер (B)</span>
          </button>

          <button
            type="button"
            onClick={() => setBrushMode('spell_zone')}
            className={`btn ${brushMode === 'spell_zone' ? 'btn-accent' : ''}`}
            title="Разметка зон действия заклинаний D&D 5e (Z)"
          >
            <CircleDot className="w-3 h-3 text-purple-400" />
            <span>AOE Зоны (Z)</span>
          </button>

          <button
            type="button"
            onClick={() => setBrushMode('measure')}
            className={`btn ${brushMode === 'measure' ? 'btn-accent' : ''}`}
            title="Линейка расстояния (M)"
          >
            <Ruler className="w-3 h-3 text-indigo-300" />
            <span>Линейка (M)</span>
          </button>

          <button
            type="button"
            onClick={() => setBrushMode('eraser')}
            className={`btn ${brushMode === 'eraser' ? 'btn-accent' : ''}`}
            title="Ластик эффектов (E)"
          >
            <Eraser className="w-3 h-3 text-rose-300" />
            <span>Ластик (E)</span>
          </button>

          <button
            type="button"
            onClick={() => setBrushMode(brushMode === 'grid_calibrate' ? 'pan' : 'grid_calibrate')}
            className={`btn col-span-2 py-1.5 transition-all ${
              brushMode === 'grid_calibrate'
                ? 'bg-amber-500 text-black font-bold shadow-lg shadow-amber-500/30 border-amber-400'
                : 'bg-amber-950/40 hover:bg-amber-900/60 border-amber-600/50 text-amber-300'
            }`}
            title="Калибровка сетки: Выделите рамкой клетку на карте для авто-сопоставления с сеткой приложения"
          >
            <Grid className={`w-3.5 h-3.5 ${brushMode === 'grid_calibrate' ? 'text-black animate-spin-slow' : 'text-amber-400'}`} />
            <span>📐 Калибровка сетки</span>
          </button>
        </div>
      )}

      {activeCategory === 'fog' && (
        <div className="grid grid-cols-2 gap-1 mb-2.5">
          <button
            type="button"
            onClick={() => setBrushMode('reveal')}
            className={`btn ${brushMode === 'reveal' ? 'btn-accent' : ''}`}
            title="Открыть туман войны (R)"
          >
            <Eye className="w-3 h-3 text-amber-300" />
            <span>Открыть (R)</span>
          </button>

          <button
            type="button"
            onClick={() => setBrushMode('hide')}
            className={`btn ${brushMode === 'hide' ? 'btn-accent' : ''}`}
            title="Скрыть туманом войны (H)"
          >
            <EyeOff className="w-3 h-3 text-slate-300" />
            <span>Скрыть (H)</span>
          </button>

          <button
            type="button"
            onClick={() => setBrushMode('measure')}
            className={`btn ${brushMode === 'measure' ? 'btn-accent' : ''}`}
            title="Линейка расстояний (M)"
          >
            <Ruler className="w-3 h-3 text-indigo-300" />
            <span>Линейка (M)</span>
          </button>

          <button
            type="button"
            onClick={() => setBrushMode('pan')}
            className={`btn ${brushMode === 'pan' ? 'btn-accent' : ''}`}
            title="Панорамирование стола (P)"
          >
            <Move className="w-3 h-3 text-slate-300" />
            <span>Рука (P)</span>
          </button>
        </div>
      )}

      {/* Инспектор параметров текущего выбранного инструмента */}
      <div className="bg-[#090d16] p-2.5 rounded border border-[var(--ink-faint)] mb-2.5 text-xs">
        {/* 1. Лазерная указка */}
        {brushMode === 'laser' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="label-meta mb-0">Цвет луча лазера</span>
              <span className="text-[10px] text-rose-400 font-mono font-bold">L / Alt</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {laserColors.map((col) => (
                <button
                  key={col.value}
                  type="button"
                  onClick={() => setLaserColor(col.value)}
                  className={`h-6 rounded flex items-center justify-center border transition-all ${
                    laserColor === col.value
                      ? 'border-white scale-105 shadow-md shadow-rose-500/20'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: col.bg }}
                  title={col.label}
                />
              ))}
            </div>
            <p className="text-[10px] text-[var(--ink-muted)] leading-tight pt-1">
              Зажмите ЛКМ на карте или держите Alt для подсветки точки игрокам со шлейфом.
            </p>
          </div>
        )}

        {/* 2. Привлечь внимание (Маяк тревоги) */}
        {brushMode === 'attention' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="label-meta mb-0">Сигнал тревоги</span>
              <button
                type="button"
                onClick={() => setSoundAlertEnabled((v) => !v)}
                className={`p-1 rounded flex items-center gap-1 text-[10px] font-mono ${
                  soundAlertEnabled ? 'text-amber-400' : 'text-slate-500'
                }`}
                title={soundAlertEnabled ? 'Звуковой сигнал включен' : 'Звуковой сигнал отключен'}
              >
                {soundAlertEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                <span>{soundAlertEnabled ? 'ЗВУК: ВКЛ' : 'ЗВУК: ВЫКЛ'}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1">
              {attentionPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setAttentionText(preset);
                    onQuickAttention(preset);
                  }}
                  className="px-1.5 py-0.5 rounded bg-[#161a24] hover:bg-amber-500/20 text-[10px] text-amber-300 border border-amber-500/30 font-mono transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="flex gap-1 pt-1">
              <input
                type="text"
                value={attentionText}
                onChange={(e) => setAttentionText(e.target.value)}
                placeholder="Свой текст маяка..."
                className="flex-1 bg-[#12151e] border border-[var(--ink-faint)] rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={() => onQuickAttention()}
                className="btn btn-accent px-2 py-1 text-[10px]"
                title="Подать сигнал по центру экрана"
              >
                <Radio className="w-3 h-3" />
                <span>Сигнал</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Огонь и пожар */}
        {brushMode === 'fire' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="label-meta mb-0 text-orange-400">🔥 Пожар & Огонь</span>
              <span className="text-[10px] text-orange-300 font-mono">60 FPS FX</span>
            </div>
            <p className="text-[10px] text-[var(--ink-muted)] leading-tight">
              Рисуйте пламя по карте. Движок создает процедурные языки огня, раскаленные частицы и динамический жар.
            </p>
          </div>
        )}

        {/* 4. Вода и затопление */}
        {brushMode === 'water' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="label-meta mb-0 text-cyan-400">💧 Тип жидкости</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: 'ocean' as WaterVariant, label: 'Океан' },
                { id: 'swamp' as WaterVariant, label: 'Болото' },
                { id: 'blood' as WaterVariant, label: 'Кровь' },
                { id: 'acid' as WaterVariant, label: 'Кислота' },
                { id: 'holy' as WaterVariant, label: 'Святая вода' },
              ].map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setWaterVariant(v.id)}
                  className={`py-1 text-[10px] font-mono rounded border transition-colors ${
                    waterVariant === v.id
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                      : 'bg-[#12151e] border-transparent text-[var(--ink-muted)] hover:text-white'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 5. Задымление и ядовитый газ */}
        {brushMode === 'gas' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="label-meta mb-0 text-emerald-400">☁️ Тип газа / дыма</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: 'poison' as GasVariant, label: 'Яд / Токсин' },
                { id: 'smoke' as GasVariant, label: 'Густой дым' },
                { id: 'acid' as GasVariant, label: 'Кислотный' },
                { id: 'magic' as GasVariant, label: 'Мистика' },
                { id: 'ash' as GasVariant, label: 'Пепел & Мороз' },
              ].map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setGasVariant(v.id)}
                  className={`py-1 text-[10px] font-mono rounded border transition-colors ${
                    gasVariant === v.id
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                      : 'bg-[#12151e] border-transparent text-[var(--ink-muted)] hover:text-white'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 6. Тактический маркер */}
        {brushMode === 'marker' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="label-meta mb-0 text-sky-400">Цвет маркера</span>
            </div>
            <div className="grid grid-cols-8 gap-1">
              {markerColors.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setMarkerColor(col)}
                  className={`h-5 rounded-sm border transition-all ${
                    markerColor === col ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </div>
        )}

        {/* 7. AOE Зоны заклинаний */}
        {brushMode === 'spell_zone' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="label-meta mb-0 text-purple-400">Форма заклинания</span>
              <span className="text-[10px] text-purple-300 font-mono font-bold">{spellRadius} ft</span>
            </div>

            <div className="grid grid-cols-4 gap-1">
              {[
                { id: 'circle' as SpellShapeType, label: 'Круг' },
                { id: 'cone' as SpellShapeType, label: 'Конус' },
                { id: 'cube' as SpellShapeType, label: 'Куб' },
                { id: 'line' as SpellShapeType, label: 'Линия' },
              ].map((sh) => (
                <button
                  key={sh.id}
                  type="button"
                  onClick={() => setSpellShape(sh.id)}
                  className={`py-1 text-[10px] font-mono rounded border transition-colors ${
                    spellShape === sh.id
                      ? 'bg-purple-500/20 border-purple-400 text-purple-300 font-bold'
                      : 'bg-[#12151e] border-transparent text-[var(--ink-muted)] hover:text-white'
                  }`}
                >
                  {sh.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1 pt-1">
              {spellPresets.map((sp) => (
                <button
                  key={sp.label}
                  type="button"
                  onClick={() => {
                    setSpellLabel(sp.label);
                    setSpellRadius(sp.radius);
                    setSpellShape(sp.shape);
                    setSpellColor(sp.color);
                  }}
                  className="px-1.5 py-0.5 rounded bg-[#161a24] hover:bg-purple-500/20 text-[9px] text-purple-300 border border-purple-500/30 font-mono transition-colors"
                >
                  {sp.label} ({sp.radius}ft)
                </button>
              ))}
            </div>

            <div className="pt-1">
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={spellRadius}
                onChange={(e) => setSpellRadius(parseInt(e.target.value, 10))}
              />
            </div>
          </div>
        )}

        {/* 8. Ластик эффектов */}
        {brushMode === 'eraser' && (
          <div className="space-y-1">
            <span className="label-meta mb-0 text-rose-300">Ластик эффектов</span>
            <p className="text-[10px] text-[var(--ink-muted)] leading-tight">
              Зажмите ЛКМ и проводите по нарисованным эффектам (огню, воде, газу, маркерам), чтобы удалить их.
            </p>
          </div>
        )}

        {/* 9. Другие режимы */}
        {['reveal', 'hide', 'measure', 'pan'].includes(brushMode) && (
          <div className="space-y-1">
            <span className="label-meta mb-0 text-slate-300">
              {brushMode === 'reveal' && '👁️ Открытие тумана (R)'}
              {brushMode === 'hide' && '🕶️ Сокрытие туманом (H)'}
              {brushMode === 'measure' && '📏 Линейка расстояний (M)'}
              {brushMode === 'pan' && '✋ Перемещение карты (P)'}
            </span>
            <p className="text-[10px] text-[var(--ink-muted)] leading-tight">
              {brushMode === 'reveal' && 'Проводите кистью по карте, чтобы открыть исследованную зону игрокам.'}
              {brushMode === 'hide' && 'Проводите кистью, чтобы скрыть область черным туманом.'}
              {brushMode === 'measure' && 'Зажмите ЛКМ и тяните линию, чтобы измерить дистанцию в футах и клетках.'}
              {brushMode === 'pan' && 'Зажмите ЛКМ и двигайте мышь для перемещения стола.'}
            </p>
          </div>
        )}
      </div>

      {/* Размер кисти рисования */}
      <div className="mb-2">
        <div className="flex justify-between items-center mb-1">
          <span className="label-meta mb-0">Размер кисти</span>
          <span className="label-meta mb-0" style={{ color: 'var(--accent)' }}>
            {brushSize}px
          </span>
        </div>
        <input
          id="slider-sidebar-brush-size"
          type="range"
          min="15"
          max="250"
          step="5"
          value={brushSize}
          onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
        />
      </div>

      {/* Кнопки отмены и очистки эффектов */}
      <div className="btn-grid">
        <button
          type="button"
          onClick={onUndoLastFx}
          disabled={fxStrokesCount === 0}
          className="btn"
          title="Отменить последний нарисованный штрих или эффект (Ctrl+Z)"
        >
          <Undo2 className="w-3 h-3 text-[var(--ink-muted)]" />
          <span>Отменить</span>
        </button>

        <button
          type="button"
          onClick={onClearAllFx}
          disabled={fxStrokesCount === 0}
          className="btn"
          title="Очистить все нарисованные спецэффекты карты"
        >
          <Trash2 className="w-3 h-3 text-red-400" />
          <span>Очистить FX</span>
        </button>
      </div>
    </section>
  );
};
