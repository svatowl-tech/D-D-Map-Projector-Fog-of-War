/**
 * MapFxEngine — Высокопроизводительный движок процедурных динамических эффектов для карты D&D.
 * Обеспечивает живую симуляцию огня, воды, ядовитого газа, лазерной указки, маяков внимания и тактических линий.
 */

import {
  MapFxStroke,
  SpellZoneArea,
  LaserPointerState,
  AttentionBeacon,
  MapPoint,
} from './types';

interface EmberParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxLife: number;
  life: number;
  color: string;
}

interface GasParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxLife: number;
  life: number;
  color: string;
  angle: number;
  va: number;
}

export class MapFxEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private width: number = 1920;
  private height: number = 1080;

  // Состояние
  public strokes: MapFxStroke[] = [];
  public spellZones: SpellZoneArea[] = [];
  public laser: LaserPointerState | null = null;
  public beacons: AttentionBeacon[] = [];

  // Частицы
  private embers: EmberParticle[] = [];
  private gasParticles: GasParticle[] = [];

  // Анимационный цикл
  private animFrameId: number | null = null;
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private timeOffset: number = 0;
  private lastParticleUpdate: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx =
      canvas.getContext('2d', { alpha: true, desynchronized: true }) ||
      canvas.getContext('2d', { alpha: true }) ||
      canvas.getContext('2d');
    this.requestFrame();
  }

  public resize(width: number, height: number) {
    // Ограничение максимального разрешения буфера для предотвращения переполнения VRAM на слабых GPU
    const MAX_DIM = 2560;
    let targetW = Math.max(100, Math.floor(width));
    let targetH = Math.max(100, Math.floor(height));
    if (targetW > MAX_DIM || targetH > MAX_DIM) {
      const scale = Math.min(MAX_DIM / targetW, MAX_DIM / targetH);
      targetW = Math.round(targetW * scale);
      targetH = Math.round(targetH * scale);
    }
    if (this.width !== targetW || this.height !== targetH) {
      this.width = targetW;
      this.height = targetH;
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.requestFrame();
    }
  }

  /**
   * Проверка, есть ли в текущий момент эффекты, требующие непрерывной 60 FPS анимации.
   * Если эффектов нет — движок засыпает (0% CPU/GPU нагрузки).
   */
  public hasAnimatedEffects(): boolean {
    if (this.laser !== null && this.laser.active) return true;
    if (this.beacons.length > 0) return true;
    if (this.embers.length > 0) return true;
    if (this.gasParticles.length > 0) return true;
    for (let i = 0; i < this.strokes.length; i++) {
      const tool = this.strokes[i].tool;
      if (tool === 'fire' || tool === 'water' || tool === 'gas') return true;
    }
    return false;
  }

  public requestFrame() {
    if (this.hasAnimatedEffects()) {
      this.start();
    } else {
      this.render();
    }
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.lastParticleUpdate = performance.now();
    this.loop();
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public destroy() {
    this.stop();
    this.strokes = [];
    this.spellZones = [];
    this.laser = null;
    this.beacons = [];
    this.embers = [];
    this.gasParticles = [];
  }

  // --- Управление состоянием ---

  public setStrokes(strokes: MapFxStroke[]) {
    this.strokes = [...strokes];
    this.requestFrame();
  }

  public addStroke(stroke: MapFxStroke) {
    this.strokes.push(stroke);
    this.requestFrame();
  }

  public removeLastStroke() {
    const popped = this.strokes.pop();
    this.requestFrame();
    return popped;
  }

  public clearAll() {
    this.strokes = [];
    this.spellZones = [];
    this.beacons = [];
    this.embers = [];
    this.gasParticles = [];
    this.laser = null;
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
    this.stop();
  }

  public setSpellZones(zones: SpellZoneArea[]) {
    this.spellZones = [...zones];
    this.requestFrame();
  }

  public addSpellZone(zone: SpellZoneArea) {
    this.spellZones.push(zone);
    this.requestFrame();
  }

  public removeSpellZone(id: string) {
    this.spellZones = this.spellZones.filter((z) => z.id !== id);
    this.requestFrame();
  }

  public setLaser(laser: LaserPointerState | null) {
    this.laser = laser;
    if (laser && laser.active) {
      this.start();
    } else {
      this.requestFrame();
    }
  }

  public addBeacon(beacon: AttentionBeacon) {
    this.beacons.push(beacon);
    this.start();
  }

  // Ластик в заданной точке
  public eraseAt(point: MapPoint, radius: number) {
    const rSq = radius * radius;
    // Фильтруем штрихи: удаляем точки или разбиваем
    this.strokes = this.strokes.filter((stroke) => {
      const remainingPoints = stroke.points.filter((pt) => {
        const dx = pt.x - point.x;
        const dy = pt.y - point.y;
        return dx * dx + dy * dy > rSq;
      });
      if (remainingPoints.length < 2) return false;
      stroke.points = remainingPoints;
      return true;
    });

    // Удаляем зоны заклинаний при клике ластиком
    this.spellZones = this.spellZones.filter((zone) => {
      const centerX = (zone.startX + zone.endX) / 2;
      const centerY = (zone.startY + zone.endY) / 2;
      const dx = centerX - point.x;
      const dy = centerY - point.y;
      return dx * dx + dy * dy > rSq * 2;
    });
    this.requestFrame();
  }

  // --- Основной цикл рендеринга ---

  private loop = () => {
    if (!this.isRunning) return;

    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.timeOffset += dt;

    if (now - this.lastParticleUpdate > 28) {
      this.updateParticles(dt);
      this.lastParticleUpdate = now;
    }
    this.render();

    // Интеллектуальный сон: если на холсте больше нет динамических анимированных эффектов
    if (!this.hasAnimatedEffects()) {
      this.render(); // финальный чистый статический проход
      this.stop();
      return;
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private updateParticles(dt: number) {
    const now = Date.now();

    // Очистка устаревших маяков внимания
    this.beacons = this.beacons.filter((b) => now - b.timestamp < b.durationMs);

    // Очистка старых точек шлейфа лазера (> 1.2 сек)
    if (this.laser && this.laser.trail) {
      this.laser.trail = this.laser.trail.filter((t) => now - t.timestamp < 1200);
    }

    // Спавн частиц огня (Embers) из штрихов огня (оптимизировано под слабый CPU)
    const fireStrokes = this.strokes.filter((s) => s.tool === 'fire');
    if (fireStrokes.length > 0 && this.embers.length < 35) {
      for (const stroke of fireStrokes) {
        if (Math.random() < 0.2 && stroke.points.length > 0) {
          const pt = stroke.points[Math.floor(Math.random() * stroke.points.length)];
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * (stroke.brushSize * 0.4);
          const colors = ['#ff3b00', '#ff7700', '#ffcc00', '#ffffff', '#ff1a00'];
          this.embers.push({
            x: pt.x + Math.cos(angle) * dist,
            y: pt.y + Math.sin(angle) * dist,
            vx: (Math.random() - 0.5) * 20,
            vy: -Math.random() * 45 - 15,
            size: Math.random() * 3 + 1.5,
            alpha: 1.0,
            maxLife: Math.random() * 1.5 + 0.8,
            life: 0,
            color: colors[Math.floor(Math.random() * colors.length)],
          });
        }
      }
    }

    // Обновление искр
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const p = this.embers[i];
      p.life += dt;
      p.x += p.vx * dt + Math.sin(this.timeOffset * 4 + p.y * 0.05) * 0.5;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.life >= p.maxLife) {
        this.embers.splice(i, 1);
      }
    }

    // Спавн частиц газа/дыма (оптимизировано под слабый CPU)
    const gasStrokes = this.strokes.filter((s) => s.tool === 'gas');
    if (gasStrokes.length > 0 && this.gasParticles.length < 25) {
      for (const stroke of gasStrokes) {
        if (Math.random() < 0.18 && stroke.points.length > 0) {
          const pt = stroke.points[Math.floor(Math.random() * stroke.points.length)];
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * (stroke.brushSize * 0.45);
          let gasColor = '#10b981'; // poison green default
          if (stroke.variant === 'smoke') gasColor = '#94a3b8';
          if (stroke.variant === 'acid') gasColor = '#84cc16';
          if (stroke.variant === 'magic') gasColor = '#c084fc';
          if (stroke.variant === 'ash') gasColor = '#475569';

          this.gasParticles.push({
            x: pt.x + Math.cos(angle) * dist,
            y: pt.y + Math.sin(angle) * dist,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15 - 5,
            size: (Math.random() * 0.5 + 0.5) * stroke.brushSize * 0.5,
            alpha: Math.random() * 0.35 + 0.15,
            maxLife: Math.random() * 3.0 + 2.0,
            life: 0,
            color: gasColor,
            angle: Math.random() * Math.PI * 2,
            va: (Math.random() - 0.5) * 0.8,
          });
        }
      }
    }

    // Обновление газа
    for (let i = this.gasParticles.length - 1; i >= 0; i--) {
      const g = this.gasParticles[i];
      g.life += dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.angle += g.va * dt;
      g.size += dt * 4;
      const progress = g.life / g.maxLife;
      g.alpha = Math.sin(progress * Math.PI) * 0.35;
      if (g.life >= g.maxLife) {
        this.gasParticles.splice(i, 1);
      }
    }
  }

  private render() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Рендеринг эффектов воды (Затопление)
    this.renderWaterStrokes(ctx);

    // 2. Рендеринг эффектов огня (Пожар)
    this.renderFireStrokes(ctx);

    // 3. Рендеринг эффектов газа (Задымление, Токсичный туман)
    this.renderGasStrokes(ctx);

    // 4. Рендеринг тактических маркеров
    this.renderMarkerStrokes(ctx);

    // 5. Рендеринг зон заклинаний (AOE Templates)
    this.renderSpellZones(ctx);

    // 6. Рендеринг искр и частиц дыма
    this.renderParticles(ctx);

    // 7. Рендеринг маяков внимания (Attention Beacons)
    this.renderAttentionBeacons(ctx);

    // 8. Рендеринг лазерной указки (Laser Pointer)
    this.renderLaserPointer(ctx);
  }

  // --- Рендеринг Воды ---
  private renderWaterStrokes(ctx: CanvasRenderingContext2D) {
    const waterStrokes = this.strokes.filter((s) => s.tool === 'water');
    if (waterStrokes.length === 0) return;

    ctx.save();
    for (const stroke of waterStrokes) {
      if (stroke.points.length === 0) continue;

      let baseColor = 'rgba(14, 116, 144, 0.55)';
      let rippleColor = 'rgba(56, 189, 248, 0.7)';
      if (stroke.variant === 'swamp') {
        baseColor = 'rgba(47, 79, 79, 0.65)';
        rippleColor = 'rgba(101, 163, 13, 0.5)';
      } else if (stroke.variant === 'blood') {
        baseColor = 'rgba(136, 19, 55, 0.7)';
        rippleColor = 'rgba(225, 29, 72, 0.8)';
      } else if (stroke.variant === 'acid') {
        baseColor = 'rgba(74, 222, 128, 0.6)';
        rippleColor = 'rgba(163, 230, 53, 0.8)';
      }

      // Базовый слой заливки воды
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = stroke.brushSize;

      ctx.beginPath();
      const pts = stroke.points;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const midX = (pts[i - 1].x + pts[i].x) / 2;
        const midY = (pts[i - 1].y + pts[i].y) / 2;
        ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, midX, midY);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();

      // Живая волнообразная рябь на воде
      ctx.strokeStyle = rippleColor;
      ctx.lineWidth = Math.max(2, stroke.brushSize * 0.25);
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const wave = Math.sin(this.timeOffset * 2.5 + i * 0.8) * (stroke.brushSize * 0.12);
        const pt = pts[i];
        if (i === 0) {
          ctx.moveTo(pt.x + wave, pt.y + wave);
        } else {
          ctx.lineTo(pt.x + wave, pt.y + wave);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- Рендеринг Огня ---
  private renderFireStrokes(ctx: CanvasRenderingContext2D) {
    const fireStrokes = this.strokes.filter((s) => s.tool === 'fire');
    if (fireStrokes.length === 0) return;

    ctx.save();
    for (const stroke of fireStrokes) {
      if (stroke.points.length === 0) continue;
      const pts = stroke.points;

      // Внешнее пламенное зарево (тлеющие угли)
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#ff3300';
      ctx.shadowBlur = stroke.brushSize * 0.6;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
      ctx.lineWidth = stroke.brushSize * 1.25;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const midX = (pts[i - 1].x + pts[i].x) / 2;
        const midY = (pts[i - 1].y + pts[i].y) / 2;
        ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, midX, midY);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();

      // Средний слой: яркое оранжевое пламя
      ctx.shadowColor = '#ff9900';
      ctx.shadowBlur = stroke.brushSize * 0.4;
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.75)';
      ctx.lineWidth = stroke.brushSize * 0.75;
      ctx.stroke();

      // Ядро пламени: беловато-желтый жар с колебаниями
      ctx.shadowColor = '#ffff00';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.9)';
      ctx.lineWidth = stroke.brushSize * 0.35;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const flicker = Math.sin(this.timeOffset * 6 + i * 1.5) * (stroke.brushSize * 0.08);
        const pt = pts[i];
        if (i === 0) ctx.moveTo(pt.x + flicker, pt.y + flicker);
        else ctx.lineTo(pt.x + flicker, pt.y + flicker);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- Рендеринг Газа / Задымления ---
  private renderGasStrokes(ctx: CanvasRenderingContext2D) {
    const gasStrokes = this.strokes.filter((s) => s.tool === 'gas');
    if (gasStrokes.length === 0) return;

    ctx.save();
    for (const stroke of gasStrokes) {
      if (stroke.points.length === 0) continue;
      const pts = stroke.points;

      let gasColor = 'rgba(16, 185, 129, 0.45)'; // ядовитый
      let glowColor = '#10b981';
      if (stroke.variant === 'smoke') {
        gasColor = 'rgba(148, 163, 184, 0.5)';
        glowColor = '#64748b';
      } else if (stroke.variant === 'acid') {
        gasColor = 'rgba(132, 204, 22, 0.5)';
        glowColor = '#84cc16';
      } else if (stroke.variant === 'magic') {
        gasColor = 'rgba(192, 132, 252, 0.5)';
        glowColor = '#c084fc';
      } else if (stroke.variant === 'ash') {
        gasColor = 'rgba(71, 85, 105, 0.55)';
        glowColor = '#334155';
      }

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = stroke.brushSize * 0.5;
      ctx.strokeStyle = gasColor;
      ctx.lineWidth = stroke.brushSize;

      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const wave = Math.sin(this.timeOffset * 1.8 + i * 0.6) * (stroke.brushSize * 0.15);
        const pt = pts[i];
        if (i === 0) ctx.moveTo(pt.x + wave, pt.y + wave);
        else ctx.lineTo(pt.x + wave, pt.y + wave);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- Рендеринг Тактического Маркера ---
  private renderMarkerStrokes(ctx: CanvasRenderingContext2D) {
    const markerStrokes = this.strokes.filter((s) => s.tool === 'marker');
    if (markerStrokes.length === 0) return;

    ctx.save();
    for (const stroke of markerStrokes) {
      if (stroke.points.length === 0) continue;
      const pts = stroke.points;

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke.color || '#38bdf8';
      ctx.lineWidth = stroke.brushSize;
      ctx.globalAlpha = stroke.opacity || 0.9;
      ctx.shadowColor = stroke.color || '#38bdf8';
      ctx.shadowBlur = 4;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const midX = (pts[i - 1].x + pts[i].x) / 2;
        const midY = (pts[i - 1].y + pts[i].y) / 2;
        ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, midX, midY);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- Рендеринг Зон Заклинаний (AOE Templates) ---
  private renderSpellZones(ctx: CanvasRenderingContext2D) {
    if (this.spellZones.length === 0) return;

    ctx.save();
    for (const zone of this.spellZones) {
      const dx = zone.endX - zone.startX;
      const dy = zone.endY - zone.startY;
      const radius = Math.sqrt(dx * dx + dy * dy);

      ctx.strokeStyle = zone.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = zone.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = `${zone.color}33`; // 20% alpha

      if (zone.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(zone.startX, zone.startY, Math.max(10, radius), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Центр и подпись радиуса
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${zone.label || 'AOE'} (${zone.radiusFeet} ft)`, zone.startX, zone.startY - radius - 8);
      } else if (zone.shape === 'cone') {
        const angle = Math.atan2(dy, dx);
        const coneSpread = Math.PI / 3; // 60 градусов стандартный конус D&D
        ctx.beginPath();
        ctx.moveTo(zone.startX, zone.startY);
        ctx.arc(zone.startX, zone.startY, Math.max(10, radius), angle - coneSpread / 2, angle + coneSpread / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${zone.label || 'Конус'} (${zone.radiusFeet} ft)`, zone.endX, zone.endY - 8);
      } else if (zone.shape === 'cube') {
        const left = Math.min(zone.startX, zone.endX);
        const top = Math.min(zone.startY, zone.endY);
        const w = Math.abs(dx);
        const h = Math.abs(dy);
        ctx.beginPath();
        ctx.rect(left, top, w, h);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${zone.label || 'Куб'} (${zone.radiusFeet} ft)`, left + w / 2, top - 8);
      } else if (zone.shape === 'line') {
        ctx.beginPath();
        ctx.moveTo(zone.startX, zone.startY);
        ctx.lineTo(zone.endX, zone.endY);
        ctx.lineWidth = 8;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${zone.label || 'Линия'} (${zone.radiusFeet} ft)`, (zone.startX + zone.endX) / 2, (zone.startY + zone.endY) / 2 - 10);
      }
    }
    ctx.restore();
  }

  // --- Рендеринг Частиц ---
  private renderParticles(ctx: CanvasRenderingContext2D) {
    // Искры огня
    if (this.embers.length > 0) {
      ctx.save();
      for (const p of this.embers) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Клубы дыма
    if (this.gasParticles.length > 0) {
      ctx.save();
      for (const g of this.gasParticles) {
        ctx.fillStyle = g.color;
        ctx.globalAlpha = g.alpha;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // --- Рендеринг Маяков Внимания ---
  private renderAttentionBeacons(ctx: CanvasRenderingContext2D) {
    if (this.beacons.length === 0) return;
    const now = Date.now();

    ctx.save();
    for (const b of this.beacons) {
      const elapsed = now - b.timestamp;
      const progress = elapsed / b.durationMs;
      const waveCycle = (elapsed % 1200) / 1200;

      // Расширяющиеся концентрические кольца радара / тревоги
      const maxRadius = 90;
      const ring1 = waveCycle * maxRadius;
      const ring2 = ((waveCycle + 0.5) % 1) * maxRadius;

      ctx.lineWidth = 3;
      ctx.strokeStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;

      // Кольцо 1
      ctx.globalAlpha = (1 - waveCycle) * (1 - progress * 0.5);
      ctx.beginPath();
      ctx.arc(b.x, b.y, ring1, 0, Math.PI * 2);
      ctx.stroke();

      // Кольцо 2
      ctx.globalAlpha = (1 - ((waveCycle + 0.5) % 1)) * (1 - progress * 0.5);
      ctx.beginPath();
      ctx.arc(b.x, b.y, ring2, 0, Math.PI * 2);
      ctx.stroke();

      // Центральное пульсирующее ядро
      const pulseSize = 10 + Math.sin(this.timeOffset * 10) * 4;
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, pulseSize, 0, Math.PI * 2);
      ctx.fill();

      // Белая центральная точка
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Текстовая плашка над маяком
      if (b.text) {
        ctx.font = 'bold 14px sans-serif';
        const textWidth = ctx.measureText(b.text).width;
        const badgePadding = 8;
        const badgeW = textWidth + badgePadding * 2;
        const badgeH = 26;
        const badgeY = b.y - pulseSize - 32;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(b.x - badgeW / 2, badgeY, badgeW, badgeH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.text, b.x, badgeY + badgeH / 2);
      }
    }
    ctx.restore();
  }

  // --- Рендеринг Лазерной Указки ---
  private renderLaserPointer(ctx: CanvasRenderingContext2D) {
    if (!this.laser || !this.laser.active) return;
    const now = Date.now();
    const { x, y, color, trail } = this.laser;

    ctx.save();

    // Шлейф лазера
    if (trail && trail.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < trail.length; i++) {
        const age = now - trail[i].timestamp;
        const alpha = Math.max(0, 1 - age / 1000);
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha * 0.8;
        ctx.lineWidth = Math.max(2, (1 - age / 1000) * 6);
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.stroke();
      }
    }

    // Внешнее свечение точки
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();

    // Среднее ядро
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();

    // Сверхяркая белая точка в центре лазера
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
