'use client';

import React from 'react';
import {
  Tv,
  Lock,
  Unlock,
  Maximize2,
  Crosshair,
  Target,
  ZoomIn,
  ZoomOut,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Radio,
  Eye,
  EyeOff,
  RotateCcw,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { PlayerRegion } from './PlayerFrameOverlay';
import { GridConfig, ViewportTransform } from '@/lib/types';

interface PlayerViewportPanelProps {
  region: PlayerRegion;
  onChangeRegion: (newRegion: PlayerRegion, syncToPlayer?: boolean) => void;
  grid: GridConfig;
  playerWindowWidth: number;
  playerWindowHeight: number;
  isPlayerConnected: boolean;
  showPlayerFrustum: boolean;
  onToggleShowFrustum: () => void;
  syncCameraWithPlayer: boolean;
  onToggleSyncCamera: () => void;
  onCenterDMOnPlayer: () => void;
  onCenterPlayerOnDM: () => void;
  onFitPlayerToMap: () => void;
  onResetZoom: () => void;
  onOpenPlayerWindow?: () => void;
}

export const PlayerViewportPanel: React.FC<PlayerViewportPanelProps> = ({
  region,
  onChangeRegion,
  grid,
  playerWindowWidth,
  playerWindowHeight,
  isPlayerConnected,
  showPlayerFrustum,
  onToggleShowFrustum,
  syncCameraWithPlayer,
  onToggleSyncCamera,
  onCenterDMOnPlayer,
  onCenterPlayerOnDM,
  onFitPlayerToMap,
  onResetZoom,
  onOpenPlayerWindow,
}) => {
  const currentScale = playerWindowWidth && region.width ? playerWindowWidth / region.width : 1;
  const currentScalePercent = Math.round(currentScale * 100);

  // Сдвиг рамки по D-Pad (на 1 клетку сетки или 50px)
  const handleNudge = (dxCells: number, dyCells: number) => {
    if (region.isLocked) return;
    const stepX = grid.enabled && grid.size > 0 ? grid.size * dxCells : 50 * dxCells;
    const stepY = grid.enabled && grid.size > 0 ? grid.size * dyCells : 50 * dyCells;

    onChangeRegion(
      {
        ...region,
        x: Math.round(region.x + stepX),
        y: Math.round(region.y + stepY),
      },
      true
    );
  };

  // Установка точного зума в процентах (50%, 100%, 150% и т.д.)
  const handleSetScalePercent = (percent: number) => {
    if (region.isLocked) return;
    const targetScale = Math.max(0.15, Math.min(4, percent / 100));
    const winW = playerWindowWidth || 1920;
    const winH = playerWindowHeight || 1080;

    const newWidth = Math.round(winW / targetScale);
    let newHeight = Math.round(winH / targetScale);

    if (region.aspectMode !== 'auto' && region.aspectMode !== 'free') {
      const ratio =
        region.aspectMode === '16:9'
          ? 16 / 9
          : region.aspectMode === '16:10'
          ? 16 / 10
          : region.aspectMode === '4:3'
          ? 4 / 3
          : 21 / 9;
      newHeight = Math.round(newWidth / ratio);
    }

    const centerX = region.x + region.width / 2;
    const centerY = region.y + region.height / 2;

    onChangeRegion(
      {
        ...region,
        x: Math.round(centerX - newWidth / 2),
        y: Math.round(centerY - newHeight / 2),
        width: newWidth,
        height: newHeight,
      },
      true
    );
  };

  const handleStepZoom = (deltaFactor: number) => {
    if (region.isLocked) return;
    const newWidth = Math.max(120, region.width * deltaFactor);
    const newHeight = Math.max(80, region.height * deltaFactor);
    const centerX = region.x + region.width / 2;
    const centerY = region.y + region.height / 2;

    onChangeRegion(
      {
        ...region,
        x: Math.round(centerX - newWidth / 2),
        y: Math.round(centerY - newHeight / 2),
        width: Math.round(newWidth),
        height: Math.round(newHeight),
      },
      true
    );
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* 1. Статусная плашка проектора и переключатель видимости рамки */}
      <div className="flex items-center justify-between bg-[#090d16] p-2 rounded border border-[var(--ink-faint)]">
        <div className="flex items-center gap-2">
          <Tv className={`w-3.5 h-3.5 ${isPlayerConnected ? 'text-emerald-400 animate-pulse' : 'text-rose-500'}`} />
          <div className="flex flex-col">
            <span className="text-[10px] font-mono font-bold text-[var(--ink)]">
              {isPlayerConnected ? 'ПРОЕКТОР: ОНЛАЙН' : 'ПРОЕКТОР: ОФЛАЙН'}
            </span>
            <span className="text-[9px] text-[var(--ink-muted)] font-mono">
              {playerWindowWidth}×{playerWindowHeight} px • Зум {currentScalePercent}%
            </span>
          </div>
        </div>

        <button
          onClick={onToggleShowFrustum}
          className={`px-2 py-1 rounded text-[9px] font-mono font-bold flex items-center gap-1 transition-all ${
            showPlayerFrustum
              ? 'bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/40 hover:bg-[#38bdf8]/25'
              : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white'
          }`}
          title="Включить или скрыть визуальную рамку экрана игроков на столе мастера"
        >
          {showPlayerFrustum ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          <span>{showPlayerFrustum ? 'РАМКА: ВКЛ' : 'РАМКА: СКРЫТА'}</span>
        </button>
      </div>

      {/* 2. Главная кнопка фиксации положения (Lock / Unlock) */}
      <button
        onClick={() => {
          onChangeRegion({ ...region, isLocked: !region.isLocked }, false);
        }}
        className={`w-full py-2 px-3 rounded flex items-center justify-between text-xs font-mono font-bold transition-all border shadow-lg ${
          region.isLocked
            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 hover:bg-emerald-900/90'
            : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-amber-500/80 hover:text-amber-300'
        }`}
        title={
          region.isLocked
            ? 'Положение зафиксировано. Камера игроков защищена от случайных смещений и зума мастера.'
            : 'Нажмите для фиксации положения рамки игроков на карте.'
        }
      >
        <div className="flex items-center gap-2">
          {region.isLocked ? (
            <Lock className="w-4 h-4 text-emerald-400" />
          ) : (
            <Unlock className="w-4 h-4 text-amber-400" />
          )}
          <span className="text-left">
            {region.isLocked ? 'ПОЛОЖЕНИЕ ЗАФИКСИРОВАНО' : 'СВОБОДНОЕ ПЕРЕМЕЩЕНИЕ'}
          </span>
        </div>
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
            region.isLocked ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
          }`}
        >
          {region.isLocked ? 'БЛОК' : 'РАЗБЛОК'}
        </span>
      </button>

      {/* 3. Кнопки быстрого позиционирования */}
      <div className="grid grid-cols-3 gap-1">
        <button
          onClick={onCenterDMOnPlayer}
          className="btn text-[10px] py-1.5 flex-col gap-0.5 items-center justify-center text-center"
          title="Переместить камеру мастера к текущему положению рамки игроков"
        >
          <Crosshair className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span>К игрокам</span>
        </button>

        <button
          onClick={onCenterPlayerOnDM}
          disabled={region.isLocked}
          className="btn text-[10px] py-1.5 flex-col gap-0.5 items-center justify-center text-center disabled:opacity-40"
          title="Переместить рамку игроков в центр вашего экрана мастера"
        >
          <Target className="w-3.5 h-3.5 text-amber-400" />
          <span>К мастеру</span>
        </button>

        <button
          onClick={onFitPlayerToMap}
          disabled={region.isLocked}
          className="btn text-[10px] py-1.5 flex-col gap-0.5 items-center justify-center text-center disabled:opacity-40"
          title="Подогнать всю карту целиком в окно игроков"
        >
          <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Вся карта</span>
        </button>
      </div>

      {/* 4. Точное масштабирование игроков (Слайдер и Пресеты) */}
      <div className="bg-[#090d16] p-2 rounded border border-[var(--ink-faint)] flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-[10px] font-mono">
          <span className="text-[var(--ink-muted)]">МАСШТАБ ИГРОКОВ:</span>
          <span className="text-[#38bdf8] font-bold">{currentScalePercent}%</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleStepZoom(1.15)} // рамка шире = зум меньше
            disabled={region.isLocked}
            className="p-1 rounded bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40"
            title="Отдалить вид игроков (-15%)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <input
            type="range"
            min="25"
            max="300"
            step="5"
            disabled={region.isLocked}
            value={currentScalePercent}
            onChange={(e) => handleSetScalePercent(Number(e.target.value))}
            className="flex-1 accent-[#38bdf8] cursor-pointer disabled:opacity-40"
          />

          <button
            onClick={() => handleStepZoom(0.87)} // рамка уже = зум больше
            disabled={region.isLocked}
            className="p-1 rounded bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40"
            title="Приблизить вид игроков (+15%)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Чипы пресетов */}
        <div className="grid grid-cols-6 gap-1 mt-1">
          {[50, 75, 100, 125, 150, 200].map((pct) => (
            <button
              key={pct}
              disabled={region.isLocked}
              onClick={() => handleSetScalePercent(pct)}
              className={`py-0.5 rounded text-[9px] font-mono font-bold transition-colors disabled:opacity-40 ${
                Math.abs(currentScalePercent - pct) <= 3
                  ? 'bg-[#38bdf8] text-black font-extrabold'
                  : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* 5. D-Pad Микро-позиционирование (Сдвиг на 1 клетку сетки) */}
      <div className="bg-[#090d16] p-2 rounded border border-[var(--ink-faint)] flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-[10px] font-mono">
          <span className="text-[var(--ink-muted)]">МИКРО-СДВИГ РАМКИ:</span>
          <span className="text-zinc-400 text-[9px]">
            {grid.enabled && grid.size > 0 ? `по 1 кл. (${grid.size}px)` : 'по 50px'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1 max-w-[150px] mx-auto">
          <div />
          <button
            onClick={() => handleNudge(0, -1)}
            disabled={region.isLocked}
            className="p-1.5 rounded bg-zinc-800 text-zinc-200 hover:bg-[#38bdf8] hover:text-black transition-colors flex items-center justify-center disabled:opacity-40 shadow"
            title="Сдвинуть рамку вверх на 1 клетку"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <div />

          <button
            onClick={() => handleNudge(-1, 0)}
            disabled={region.isLocked}
            className="p-1.5 rounded bg-zinc-800 text-zinc-200 hover:bg-[#38bdf8] hover:text-black transition-colors flex items-center justify-center disabled:opacity-40 shadow"
            title="Сдвинуть рамку влево на 1 клетку"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onCenterDMOnPlayer}
            className="p-1 rounded bg-zinc-900 border border-zinc-700 text-[#38bdf8] text-[9px] font-bold flex items-center justify-center hover:bg-zinc-800 shadow"
            title="Центрировать мастера на рамке"
          >
            •
          </button>

          <button
            onClick={() => handleNudge(1, 0)}
            disabled={region.isLocked}
            className="p-1.5 rounded bg-zinc-800 text-zinc-200 hover:bg-[#38bdf8] hover:text-black transition-colors flex items-center justify-center disabled:opacity-40 shadow"
            title="Сдвинуть рамку вправо на 1 клетку"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <div />
          <button
            onClick={() => handleNudge(0, 1)}
            disabled={region.isLocked}
            className="p-1.5 rounded bg-zinc-800 text-zinc-200 hover:bg-[#38bdf8] hover:text-black transition-colors flex items-center justify-center disabled:opacity-40 shadow"
            title="Сдвинуть рамку вниз на 1 клетку"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <div />
        </div>
      </div>

      {/* 6. Соотношение сторон рамки (Aspect Ratio) */}
      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-mono text-[var(--ink-muted)]">ПРОПОРЦИИ РАМКИ:</span>
        <div className="grid grid-cols-5 gap-1">
          {(['auto', '16:9', '16:10', '4:3', 'free'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                const ratio =
                  mode === '16:9'
                    ? 16 / 9
                    : mode === '16:10'
                    ? 16 / 10
                    : mode === '4:3'
                    ? 4 / 3
                    : mode === 'free'
                    ? region.width / (region.height || 1)
                    : (playerWindowWidth || 1920) / (playerWindowHeight || 1080);
                const newHeight = mode === 'free' ? region.height : Math.round(region.width / ratio);
                onChangeRegion(
                  {
                    ...region,
                    aspectMode: mode,
                    height: newHeight,
                  },
                  true
                );
              }}
              className={`py-1 rounded text-[9px] font-mono font-bold transition-all ${
                region.aspectMode === mode
                  ? 'bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
              }`}
            >
              {mode === 'auto' ? 'Авто' : mode === 'free' ? 'Своб.' : mode}
            </button>
          ))}
        </div>
      </div>

      {/* 7. Режим камеры: Независимая рамка vs Зеркало */}
      <button
        onClick={onToggleSyncCamera}
        className={`w-full py-1.5 px-2 rounded text-[10px] font-mono flex items-center justify-between transition-colors border ${
          syncCameraWithPlayer
            ? 'bg-rose-950/60 border-rose-500 text-rose-300'
            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
        }`}
        title={
          syncCameraWithPlayer
            ? 'Включено зеркалирование: любое движение камеры мастера двигает экран игроков. Нажмите для возврата к независимой рамке.'
            : 'Режим независимой рамки активен: вы можете свободно двигать и масштабировать карту мастера, экран игроков останется на месте.'
        }
      >
        <div className="flex items-center gap-1.5">
          <Radio className={`w-3.5 h-3.5 ${syncCameraWithPlayer ? 'text-rose-400 animate-pulse' : 'text-zinc-500'}`} />
          <span>{syncCameraWithPlayer ? 'Зеркало мастера (ВКЛ)' : 'Режим: Независимая рамка'}</span>
        </div>
        <span className="text-[9px] font-bold">{syncCameraWithPlayer ? 'СВЯЗАНЫ' : 'РАЗДЕЛЬНО'}</span>
      </button>
    </div>
  );
};
