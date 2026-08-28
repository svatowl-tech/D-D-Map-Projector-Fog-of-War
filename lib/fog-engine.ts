/**
 * Высокопроизводительный движок Тумана Войны (Fog of War) на HTML5 Canvas 2D.
 * Оптимизирован для слабых GPU (GeForce 320M) и минимального мусора в Garbage Collector.
 */

import { FogAction, FogPoint, FogStroke } from './types';

export class FogEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isDM: boolean;
  private width: number = 0;
  private height: number = 0;
  private fogOpacity: number = 0.55; // Прозрачность тумана для мастера

  constructor(canvas: HTMLCanvasElement, isDM: boolean = false) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) {
      throw new Error('Canvas 2D context not supported');
    }
    this.ctx = context;
    this.isDM = isDM;
  }

  /**
   * Установка размера холста тумана под реальный размер карты
   */
  public resize(width: number, height: number) {
    if (this.width === width && this.height === height) return;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  /**
   * Установка прозрачности тумана в окне мастера
   */
  public setDMOpacity(opacity: number) {
    this.fogOpacity = Math.max(0.1, Math.min(1.0, opacity));
  }

  /**
   * Скрыть всю карту (залить туманом)
   */
  public fillAll() {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = this.isDM ? `rgba(0, 0, 0, ${this.fogOpacity})` : '#000000';
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.restore();
  }

  /**
   * Открыть всю карту (очистить туман полностью)
   */
  public clearAll() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  /**
   * Отрисовка отдельного штриха кисти с интерполяцией
   */
  public drawStroke(stroke: FogStroke) {
    const { mode, points, brushSize } = stroke;
    if (!points || points.length === 0) return;

    this.ctx.save();
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.lineWidth = brushSize;

    if (mode === 'reveal') {
      // Режим открытия: стираем туман через destination-out
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.strokeStyle = '#000000';
      this.ctx.fillStyle = '#000000';
    } else {
      // Режим сокрытия: накладываем непрозрачный/полупрозрачный туман
      this.ctx.globalCompositeOperation = 'source-over';
      const color = this.isDM ? `rgba(0, 0, 0, ${this.fogOpacity})` : '#000000';
      this.ctx.strokeStyle = color;
      this.ctx.fillStyle = color;
    }

    if (points.length === 1) {
      // Одиночный клик - рисуем круг
      this.ctx.beginPath();
      this.ctx.arc(points[0].x, points[0].y, brushSize / 2, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      // Серия точек - плавная кривая Безье
      this.ctx.beginPath();
      this.ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midY = (points[i].y + points[i + 1].y) / 2;
        this.ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
      }

      const lastPoint = points[points.length - 1];
      this.ctx.lineTo(lastPoint.x, lastPoint.y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  /**
   * Полное воспроизведение списка действий тумана
   */
  public replayActions(actions: FogAction[], baseFilled: boolean = true) {
    this.clearAll();
    if (baseFilled) {
      this.fillAll();
    }

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      if (action.type === 'fill') {
        this.fillAll();
      } else if (action.type === 'clear') {
        this.clearAll();
      } else if (action.type === 'stroke') {
        this.drawStroke(action);
      }
    }
  }

  /**
   * Получение контекста для прямого использования
   */
  public getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }
}
