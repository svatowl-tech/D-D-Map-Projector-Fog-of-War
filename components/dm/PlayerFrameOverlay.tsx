'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Tv,
  Lock,
  Unlock,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Target,
  Move,
  Eye,
  EyeOff,
  Crosshair,
  Sliders,
} from 'lucide-react';
import { ViewportTransform, GridConfig } from '@/lib/types';

export interface PlayerRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  isLocked: boolean;
  aspectMode: 'auto' | '16:9' | '16:10' | '4:3' | '21:9' | 'free';
}

interface PlayerFrameOverlayProps {
  region: PlayerRegion;
  onChangeRegion: (newRegion: PlayerRegion, syncToPlayer?: boolean) => void;
  dmViewport: ViewportTransform;
  mapWidth?: number;
  mapHeight?: number;
  grid: GridConfig;
  playerWindowWidth: number;
  playerWindowHeight: number;
  isPlayerConnected: boolean;
  onCenterDMOnPlayer?: () => void;
  onCenterPlayerOnDM?: () => void;
  onFitPlayerToMap?: () => void;
  onToggleLock?: () => void;
  onResetPlayerZoom?: () => void;
}

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e';

export const PlayerFrameOverlay: React.FC<PlayerFrameOverlayProps> = ({
  region,
  onChangeRegion,
  dmViewport,
  mapWidth,
  mapHeight,
  grid,
  playerWindowWidth,
  playerWindowHeight,
  isPlayerConnected,
  onCenterDMOnPlayer,
  onCenterPlayerOnDM,
  onFitPlayerToMap,
  onToggleLock,
}) => {
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [activeDragMode, setActiveDragMode] = useState<DragMode | null>(null);

  const dragSessionRef = useRef<{
    mode: DragMode;
    startClientX: number;
    startClientY: number;
    startRegion: PlayerRegion;
    aspectRatio: number;
  } | null>(null);

  // Вычисление эффективного соотношения сторон
  const getEffectiveAspectRatio = useCallback(
    (mode: PlayerRegion['aspectMode']) => {
      switch (mode) {
        case '16:9':
          return 16 / 9;
        case '16:10':
          return 16 / 10;
        case '4:3':
          return 4 / 3;
        case '21:9':
          return 21 / 9;
        case 'free':
          return region.width / (region.height || 1);
        case 'auto':
        default:
          return playerWindowWidth && playerWindowHeight
            ? playerWindowWidth / playerWindowHeight
            : 16 / 9;
      }
    },
    [playerWindowWidth, playerWindowHeight, region.width, region.height]
  );

  // Текущий масштаб проектора игроков
  const playerScale = playerWindowWidth && region.width ? playerWindowWidth / region.width : 1;
  const playerScalePercent = Math.round(playerScale * 100);

  // Размеры в клетках и футах (D&D 5e: 1 клетка = 5 футов)
  const cellsW = grid.size > 0 ? (region.width / grid.size).toFixed(1) : '—';
  const cellsH = grid.size > 0 ? (region.height / grid.size).toFixed(1) : '—';
  const feetW = grid.size > 0 ? Math.round((region.width / grid.size) * 5) : 0;
  const feetH = grid.size > 0 ? Math.round((region.height / grid.size) * 5) : 0;

  // Обработчик начала перетаскивания рамки или маркера изменения размера
  const handleStartDrag = (e: React.MouseEvent, mode: DragMode) => {
    if (region.isLocked && mode !== 'move') return;
    if (region.isLocked) return;

    e.preventDefault();
    e.stopPropagation();

    const aspectRatio = getEffectiveAspectRatio(region.aspectMode);

    dragSessionRef.current = {
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startRegion: { ...region },
      aspectRatio,
    };

    setActiveDragMode(mode);
  };

  useEffect(() => {
    if (!activeDragMode) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragSessionRef.current) return;
      const { mode, startClientX, startClientY, startRegion, aspectRatio } = dragSessionRef.current;

      // Дельта в координатах экрана мастера -> перевод в координаты карты
      const deltaScreenX = e.clientX - startClientX;
      const deltaScreenY = e.clientY - startClientY;
      const deltaMapX = deltaScreenX / (dmViewport.scale || 1);
      const deltaMapY = deltaScreenY / (dmViewport.scale || 1);

      let newX = startRegion.x;
      let newY = startRegion.y;
      let newWidth = startRegion.width;
      let newHeight = startRegion.height;

      const minW = Math.max(120, (grid.size || 50) * 2);
      const minH = Math.max(80, (grid.size || 50) * 1.5);

      if (mode === 'move') {
        newX = startRegion.x + deltaMapX;
        newY = startRegion.y + deltaMapY;
      } else if (mode === 'se') {
        newWidth = Math.max(minW, startRegion.width + deltaMapX);
        newHeight = startRegion.aspectMode === 'free' ? Math.max(minH, startRegion.height + deltaMapY) : newWidth / aspectRatio;
      } else if (mode === 'nw') {
        newWidth = Math.max(minW, startRegion.width - deltaMapX);
        newHeight = startRegion.aspectMode === 'free' ? Math.max(minH, startRegion.height - deltaMapY) : newWidth / aspectRatio;
        newX = startRegion.x + (startRegion.width - newWidth);
        newY = startRegion.y + (startRegion.height - newHeight);
      } else if (mode === 'ne') {
        newWidth = Math.max(minW, startRegion.width + deltaMapX);
        newHeight = startRegion.aspectMode === 'free' ? Math.max(minH, startRegion.height - deltaMapY) : newWidth / aspectRatio;
        newY = startRegion.y + (startRegion.height - newHeight);
      } else if (mode === 'sw') {
        newWidth = Math.max(minW, startRegion.width - deltaMapX);
        newHeight = startRegion.aspectMode === 'free' ? Math.max(minH, startRegion.height + deltaMapY) : newWidth / aspectRatio;
        newX = startRegion.x + (startRegion.width - newWidth);
      } else if (mode === 'e') {
        newWidth = Math.max(minW, startRegion.width + deltaMapX);
        if (startRegion.aspectMode !== 'free') {
          newHeight = newWidth / aspectRatio;
          newY = startRegion.y + (startRegion.height - newHeight) / 2;
        }
      } else if (mode === 'w') {
        newWidth = Math.max(minW, startRegion.width - deltaMapX);
        newX = startRegion.x + (startRegion.width - newWidth);
        if (startRegion.aspectMode !== 'free') {
          newHeight = newWidth / aspectRatio;
          newY = startRegion.y + (startRegion.height - newHeight) / 2;
        }
      } else if (mode === 's') {
        newHeight = Math.max(minH, startRegion.height + deltaMapY);
        if (startRegion.aspectMode !== 'free') {
          newWidth = newHeight * aspectRatio;
          newX = startRegion.x + (startRegion.width - newWidth) / 2;
        }
      } else if (mode === 'n') {
        newHeight = Math.max(minH, startRegion.height - deltaMapY);
        newY = startRegion.y + (startRegion.height - newHeight);
        if (startRegion.aspectMode !== 'free') {
          newWidth = newHeight * aspectRatio;
          newX = startRegion.x + (startRegion.width - newWidth) / 2;
        }
      }

      onChangeRegion(
        {
          ...startRegion,
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(newWidth),
          height: Math.round(newHeight),
        },
        true
      );
    };

    const handleMouseUp = () => {
      setActiveDragMode(null);
      dragSessionRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeDragMode, dmViewport.scale, getEffectiveAspectRatio, grid.size, onChangeRegion]);

  // Быстрое масштабирование кнопками +/-
  const handleQuickZoom = (factor: number) => {
    if (region.isLocked) return;
    const aspectRatio = getEffectiveAspectRatio(region.aspectMode);
    const newWidth = Math.max(120, region.width * factor);
    const newHeight = newWidth / aspectRatio;
    const newX = region.x + (region.width - newWidth) / 2;
    const newY = region.y + (region.height - newHeight) / 2;

    onChangeRegion(
      {
        ...region,
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newWidth),
        height: Math.round(newHeight),
      },
      true
    );
  };

  // Вычисляем масштаб UI элементов внутри рамки, чтобы они оставались удобными независимо от зума мастера
  const uiScale = Math.max(0.45, Math.min(2.5, 1 / (dmViewport.scale || 1)));

  return (
    <div
      id="player-viewport-frustum-frame"
      className={`absolute z-30 transition-shadow duration-150 ${
        region.isLocked ? 'pointer-events-auto' : 'pointer-events-auto'
      }`}
      style={{
        left: `${region.x}px`,
        top: `${region.y}px`,
        width: `${region.width}px`,
        height: `${region.height}px`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 1. Неоновая светящаяся рамка с границей */}
      <div
        className={`absolute inset-0 border-2 transition-all duration-200 ${
          region.isLocked
            ? 'border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
            : activeDragMode
            ? 'border-[#ff4e00] shadow-[0_0_30px_rgba(255,78,0,0.6)]'
            : isHovered
            ? 'border-[#38bdf8] shadow-[0_0_25px_rgba(56,189,248,0.5)]'
            : 'border-[#38bdf8]/85 border-dashed shadow-[0_0_18px_rgba(56,189,248,0.35)]'
        }`}
        style={{
          borderRadius: `${4 * uiScale}px`,
        }}
      >
        {/* Затемнение или легкая подсветка активного поля */}
        <div
          className={`absolute inset-0 transition-colors duration-150 ${
            region.isLocked
              ? 'bg-emerald-500/[0.03]'
              : isHovered
              ? 'bg-[#38bdf8]/[0.05]'
              : 'bg-transparent'
          }`}
        />
      </div>

      {/* 2. Угловые тактические прицелы */}
      <div
        className="absolute -top-2 -left-2 w-5 h-5 border-t-2 border-l-2"
        style={{ borderColor: region.isLocked ? '#10b981' : '#ff4e00' }}
      />
      <div
        className="absolute -top-2 -right-2 w-5 h-5 border-t-2 border-r-2"
        style={{ borderColor: region.isLocked ? '#10b981' : '#ff4e00' }}
      />
      <div
        className="absolute -bottom-2 -left-2 w-5 h-5 border-b-2 border-l-2"
        style={{ borderColor: region.isLocked ? '#10b981' : '#ff4e00' }}
      />
      <div
        className="absolute -bottom-2 -right-2 w-5 h-5 border-b-2 border-r-2"
        style={{ borderColor: region.isLocked ? '#10b981' : '#ff4e00' }}
      />

      {/* 3. Центральный прицел-якорь для удобного перетаскивания */}
      {!region.isLocked && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center cursor-move select-none"
          style={{ transform: `translate(-50%, -50%) scale(${uiScale})` }}
          onMouseDown={(e) => handleStartDrag(e, 'move')}
          title="Зажмите и тяните для перемещения экрана игроков по карте"
        >
          <div className="w-8 h-8 rounded-full bg-[#090d16]/90 border border-[#38bdf8]/80 text-[#38bdf8] flex items-center justify-center shadow-2xl hover:bg-[#38bdf8] hover:text-black transition-all hover:scale-110">
            <Crosshair className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* 4. Верхний тулбар и панель статуса рамки (прикреплен к верхнему краю) */}
      <div
        className="absolute top-0 left-0 -translate-y-full pb-2 flex items-center gap-1.5 select-none pointer-events-auto"
        style={{
          transform: `translateY(-100%) scale(${uiScale})`,
          transformOrigin: 'bottom left',
        }}
      >
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-t-md text-xs font-mono font-bold shadow-2xl border ${
            region.isLocked
              ? 'bg-[#061e14]/95 border-emerald-500/80 text-emerald-300'
              : 'bg-[#090d16]/95 border-[#38bdf8]/80 text-[#38bdf8]'
          } ${!region.isLocked ? 'cursor-move' : ''}`}
          onMouseDown={(e) => {
            if (!region.isLocked) {
              handleStartDrag(e, 'move');
            }
          }}
          title={
            region.isLocked
              ? 'Положение зафиксировано. Нажмите на замок для разблокировки.'
              : 'Зажмите и тяните шапку для перемещения экрана игроков'
          }
        >
          <Tv className={`w-3.5 h-3.5 ${isPlayerConnected ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'}`} />
          <span className="tracking-wide">
            ЭКРАН ИГРОКОВ{' '}
            <span className="text-zinc-400 font-normal">
              ({playerWindowWidth}×{playerWindowHeight})
            </span>
          </span>
          <span className="text-zinc-600">|</span>
          <span className="text-amber-300">{playerScalePercent}%</span>

          {/* Кнопка блокировки положения (Lock / Unlock) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleLock?.();
            }}
            className={`ml-1.5 px-2 py-0.5 rounded text-[10px] flex items-center gap-1 font-semibold transition-all ${
              region.isLocked
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500 hover:bg-emerald-500/40'
                : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 hover:text-white'
            }`}
            title={region.isLocked ? 'Разблокировать перемещение и изменение размера' : 'Зафиксировать положение рамки (защита от сдвигов)'}
          >
            {region.isLocked ? (
              <>
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>ЗАФИКСИРОВАНО</span>
              </>
            ) : (
              <>
                <Unlock className="w-3 h-3 text-amber-400" />
                <span>СВОБОДНО</span>
              </>
            )}
          </button>
        </div>

        {/* Быстрые кнопки управления на тулбаре рамки */}
        {!region.isLocked && (
          <div className="flex items-center gap-1 bg-[#090d16]/95 border border-[#38bdf8]/60 p-1 rounded-t-md shadow-2xl">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleQuickZoom(0.85); // Уменьшает рамку = приближает игроков
              }}
              className="p-1 rounded hover:bg-[#38bdf8]/20 text-[#38bdf8] transition-colors"
              title="Приблизить вид игроков (+15% зум)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleQuickZoom(1.18); // Увеличивает рамку = отдаляет игроков
              }}
              className="p-1 rounded hover:bg-[#38bdf8]/20 text-[#38bdf8] transition-colors"
              title="Отдалить вид игроков (-15% зум)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCenterPlayerOnDM?.();
              }}
              className="p-1 rounded hover:bg-[#38bdf8]/20 text-[#38bdf8] transition-colors"
              title="Переместить рамку игроков в центр экрана мастера"
            >
              <Target className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFitPlayerToMap?.();
              }}
              className="p-1 rounded hover:bg-[#38bdf8]/20 text-[#38bdf8] transition-colors"
              title="Вписать всю карту в экран игроков"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 5. Нижний бейдж с тактическими размерами в футах и клетках */}
      <div
        className="absolute bottom-2 right-2 select-none pointer-events-none"
        style={{
          transform: `scale(${uiScale})`,
          transformOrigin: 'bottom right',
        }}
      >
        <div className="bg-[#090d16]/90 border border-zinc-700 text-zinc-300 text-[10px] font-mono px-2 py-0.5 rounded shadow-lg flex items-center gap-2">
          <span>
            {cellsW}×{cellsH} кл.
          </span>
          {feetW > 0 && <span className="text-amber-400">({feetW}×{feetH} ft)</span>}
        </div>
      </div>

      {/* 6. Интерактивные маркеры изменения размера (8 Handles) */}
      {!region.isLocked && (
        <>
          {/* Угловые маркеры (NW, NE, SW, SE) */}
          <div
            className="absolute -top-2 -left-2 w-4 h-4 bg-[#ff4e00] border-2 border-white rounded-full shadow-lg cursor-nwse-resize hover:scale-130 transition-transform"
            style={{ transform: `scale(${uiScale})` }}
            onMouseDown={(e) => handleStartDrag(e, 'nw')}
            title="Тяните за угол для масштабирования"
          />
          <div
            className="absolute -top-2 -right-2 w-4 h-4 bg-[#ff4e00] border-2 border-white rounded-full shadow-lg cursor-nesw-resize hover:scale-130 transition-transform"
            style={{ transform: `scale(${uiScale})` }}
            onMouseDown={(e) => handleStartDrag(e, 'ne')}
            title="Тяните за угол для масштабирования"
          />
          <div
            className="absolute -bottom-2 -left-2 w-4 h-4 bg-[#ff4e00] border-2 border-white rounded-full shadow-lg cursor-nesw-resize hover:scale-130 transition-transform"
            style={{ transform: `scale(${uiScale})` }}
            onMouseDown={(e) => handleStartDrag(e, 'sw')}
            title="Тяните за угол для масштабирования"
          />
          <div
            className="absolute -bottom-2 -right-2 w-4 h-4 bg-[#ff4e00] border-2 border-white rounded-full shadow-lg cursor-nwse-resize hover:scale-130 transition-transform"
            style={{ transform: `scale(${uiScale})` }}
            onMouseDown={(e) => handleStartDrag(e, 'se')}
            title="Тяните за угол для масштабирования"
          />

          {/* Реберные маркеры (N, S, W, E) */}
          <div
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-3 bg-[#38bdf8] border border-white rounded-xs shadow-md cursor-ns-resize hover:scale-120 transition-transform"
            style={{ transform: `translate(-50%, 0) scale(${uiScale})` }}
            onMouseDown={(e) => handleStartDrag(e, 'n')}
            title="Тяните край для изменения размера"
          />
          <div
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-3 bg-[#38bdf8] border border-white rounded-xs shadow-md cursor-ns-resize hover:scale-120 transition-transform"
            style={{ transform: `translate(-50%, 0) scale(${uiScale})` }}
            onMouseDown={(e) => handleStartDrag(e, 's')}
            title="Тяните край для изменения размера"
          />
          <div
            className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-6 bg-[#38bdf8] border border-white rounded-xs shadow-md cursor-ew-resize hover:scale-120 transition-transform"
            style={{ transform: `translate(0, -50%) scale(${uiScale})` }}
            onMouseDown={(e) => handleStartDrag(e, 'w')}
            title="Тяните край для изменения размера"
          />
          <div
            className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-6 bg-[#38bdf8] border border-white rounded-xs shadow-md cursor-ew-resize hover:scale-120 transition-transform"
            style={{ transform: `translate(0, -50%) scale(${uiScale})` }}
            onMouseDown={(e) => handleStartDrag(e, 'e')}
            title="Тяните край для изменения размера"
          />
        </>
      )}
    </div>
  );
};
