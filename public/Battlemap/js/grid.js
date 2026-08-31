/**
 * Grid & Measurement Overlay Module for D&D 5e Battlemaps
 * Renders 5-foot squares, coordinates, measurement lines, and spell AoE templates
 */

export class BattlemapGrid {
  constructor(options = {}) {
    this.visible = options.visible !== false;
    this.style = options.style || 'lines'; // 'lines', 'crosses', 'dots', 'subtle'
    this.color = options.color || '#2d3748';
    this.opacity = options.opacity || 0.35;
    this.showCoordinates = options.showCoordinates !== false;
    this.showFootLabels = options.showFootLabels || false;
    this.activeMeasure = null; // { x1, y1, x2, y2, active: bool }
    this.activeSpellTemplate = null; // { type: 'circle'|'cone'|'cube'|'line', x, y, radiusFeet, angle }
  }

  render(ctx, map, viewTransform = { x: 0, y: 0, scale: 1 }) {
    if (!this.visible) return;

    const cols = map.grid.cols;
    const rows = map.grid.rows;
    const CS = map.grid.cellSize;
    const W = cols * CS;
    const H = rows * CS;

    ctx.save();
    ctx.translate(viewTransform.x, viewTransform.y);
    ctx.scale(viewTransform.scale, viewTransform.scale);

    // 1. Grid Cells
    ctx.strokeStyle = this.color;
    ctx.fillStyle = this.color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = this.opacity;

    if (this.style === 'lines') {
      ctx.beginPath();
      // Vertical lines
      for (let c = 0; c <= cols; c++) {
        const x = c * CS;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
      }
      // Horizontal lines
      for (let r = 0; r <= rows; r++) {
        const y = r * CS;
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();
    } else if (this.style === 'crosses') {
      const arm = 5;
      ctx.beginPath();
      for (let c = 0; c <= cols; c++) {
        for (let r = 0; r <= rows; r++) {
          const x = c * CS;
          const y = r * CS;
          ctx.moveTo(x - arm, y); ctx.lineTo(x + arm, y);
          ctx.moveTo(x, y - arm); ctx.lineTo(x, y + arm);
        }
      }
      ctx.stroke();
    } else if (this.style === 'dots') {
      const dotR = 1.8;
      for (let c = 0; c <= cols; c++) {
        for (let r = 0; r <= rows; r++) {
          ctx.beginPath();
          ctx.arc(c * CS, r * CS, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (this.style === 'subtle') {
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      for (let c = 0; c <= cols; c++) {
        ctx.moveTo(c * CS, 0); ctx.lineTo(c * CS, H);
      }
      for (let r = 0; r <= rows; r++) {
        ctx.moveTo(0, r * CS); ctx.lineTo(W, r * CS);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Coordinate Badges along edges
    if (this.showCoordinates) {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#f4f4f5';
      ctx.font = 'bold 11px "Share Tech Mono", monospace, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Column Letters on top & bottom (A, B, C...)
      for (let c = 0; c < cols; c++) {
        const x = c * CS + CS * 0.5;
        const letter = this.getColumnLabel(c);
        // Top badge
        this.drawBadge(ctx, x, -12, letter);
      }

      // Row Numbers on left & right (1, 2, 3...)
      for (let r = 0; r < rows; r++) {
        const y = r * CS + CS * 0.5;
        const num = String(r + 1);
        this.drawBadge(ctx, -14, y, num);
      }
    }

    // 3. Active Measurement Line
    if (this.activeMeasure && this.activeMeasure.active) {
      this.renderMeasurement(ctx, this.activeMeasure, CS);
    }

    // 4. Active Spell AoE Template
    if (this.activeSpellTemplate) {
      this.renderSpellTemplate(ctx, this.activeSpellTemplate, CS);
    }

    ctx.restore();
  }

  drawBadge(ctx, x, y, text) {
    ctx.save();
    ctx.fillStyle = 'rgba(24, 24, 27, 0.85)';
    ctx.fillRect(x - 9, y - 8, 18, 16);
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 9, y - 8, 18, 16);

    ctx.fillStyle = '#e4e4e7';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  getColumnLabel(index) {
    let label = '';
    let num = index;
    while (num >= 0) {
      label = String.fromCharCode(65 + (num % 26)) + label;
      num = Math.floor(num / 26) - 1;
    }
    return label;
  }

  renderMeasurement(ctx, m, CS) {
    ctx.save();
    const dx = m.x2 - m.x1;
    const dy = m.y2 - m.y1;
    const distPx = Math.sqrt(dx * dx + dy * dy);

    // Calculate D&D 5e distance (5 feet per cell)
    const cellDist = distPx / CS;
    const feetStandard = Math.round(cellDist * 5);

    // Diagonal counting (5-10-5 rule)
    const dCellsX = Math.abs(dx) / CS;
    const dCellsY = Math.abs(dy) / CS;
    const maxDelta = Math.max(dCellsX, dCellsY);
    const minDelta = Math.min(dCellsX, dCellsY);
    const feet5eOptional = Math.floor(minDelta * 1.5 + (maxDelta - minDelta)) * 5;

    // Measurement Line
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(m.x1, m.y1);
    ctx.lineTo(m.x2, m.y2);
    ctx.stroke();

    // Start & End points
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.arc(m.x1, m.y1, 6, 0, Math.PI * 2);
    ctx.arc(m.x2, m.y2, 6, 0, Math.PI * 2);
    ctx.fill();

    // Distance Label in Center
    const midX = (m.x1 + m.x2) * 0.5;
    const midY = (m.y1 + m.y2) * 0.5;
    const text = `${feetStandard} ft (${Math.round(cellDist)} клеток)`;

    ctx.font = 'bold 13px "Share Tech Regular", sans-serif';
    const tWidth = ctx.measureText(text).width;

    ctx.fillStyle = 'rgba(15, 15, 18, 0.9)';
    ctx.fillRect(midX - tWidth * 0.5 - 8, midY - 14, tWidth + 16, 24);
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(midX - tWidth * 0.5 - 8, midY - 14, tWidth + 16, 24);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, midX, midY - 2);

    ctx.restore();
  }

  renderSpellTemplate(ctx, t, CS) {
    ctx.save();
    const radiusPx = (t.radiusFeet / 5) * CS;

    if (t.type === 'circle') {
      // Radius circle (e.g. Fireball 20ft)
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.x, t.y, radiusPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Center point & radius line
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.font = 'bold 12px "Share Tech Regular", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${t.radiusFeet} ft радиус`, t.x, t.y - radiusPx - 8);
    } else if (t.type === 'cone') {
      // 53.13 degree D&D cone
      const halfAngle = 0.4636; // ~26.5 degrees each side
      ctx.fillStyle = 'rgba(245, 158, 11, 0.28)';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.arc(t.x, t.y, radiusPx, t.angle - halfAngle, t.angle + halfAngle);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (t.type === 'cube') {
      // Cube / Square AoE
      const size = radiusPx * 2;
      ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.fillRect(t.x - size * 0.5, t.y - size * 0.5, size, size);
      ctx.strokeRect(t.x - size * 0.5, t.y - size * 0.5, size, size);
    } else if (t.type === 'line') {
      // 5ft wide line (e.g. Lightning Bolt)
      const lineLen = (t.radiusFeet / 5) * CS;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.angle);
      ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.fillRect(0, -CS * 0.5, lineLen, CS);
      ctx.strokeRect(0, -CS * 0.5, lineLen, CS);
      ctx.restore();
    }

    ctx.restore();
  }
}
