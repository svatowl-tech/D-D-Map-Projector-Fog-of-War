/**
 * Interactive Token & Encounter System for D&D 5e Battlemaps
 * Manages PC/Monster tokens, movement range rings, and quick encounter spawns
 */

export class TokenManager {
  constructor() {
    this.tokens = [];
    this.selectedTokenId = null;
    this.draggedToken = null;
    this.dragOffset = { x: 0, y: 0 };
  }

  addToken(token) {
    const id = token.id || 'tok_' + Math.random().toString(36).substring(2, 9);
    const newToken = {
      id,
      name: token.name || 'Токен',
      x: token.x || 100,
      y: token.y || 100,
      sizeCells: token.sizeCells || 1, // 1 = Medium (5ft), 2 = Large (10ft), 3 = Huge (15ft)
      type: token.type || 'hostile',   // 'pc', 'hostile', 'neutral'
      color: token.color || (token.type === 'pc' ? '#3b82f6' : token.type === 'hostile' ? '#ef4444' : '#eab308'),
      label: token.label || (token.name ? token.name.substring(0, 2).toUpperCase() : 'M'),
      hp: token.hp || 10,
      maxHp: token.maxHp || 10,
      speedFeet: token.speedFeet || 30
    };
    this.tokens.push(newToken);
    return newToken;
  }

  removeToken(id) {
    this.tokens = this.tokens.filter(t => t.id !== id);
    if (this.selectedTokenId === id) this.selectedTokenId = null;
  }

  clear() {
    this.tokens = [];
    this.selectedTokenId = null;
  }

  spawnQuickEncounter(biomeId, map) {
    const CS = map.grid.cellSize;
    const encounters = {
      forest: [
        { name: 'Волк', type: 'hostile', color: '#b91c1c', hp: 11, label: 'ВК', count: 3 },
        { name: 'Вожак стаи', type: 'hostile', color: '#991b1b', hp: 22, sizeCells: 2, label: 'ВЖ', count: 1 }
      ],
      road: [
        { name: 'Бандит', type: 'hostile', color: '#dc2626', hp: 11, label: 'БН', count: 4 },
        { name: 'Главарь разбойников', type: 'hostile', color: '#991b1b', hp: 32, label: 'ГЛ', count: 1 }
      ],
      river: [
        { name: 'Речной тролль', type: 'hostile', color: '#047857', hp: 45, sizeCells: 2, label: 'ТР', count: 1 },
        { name: 'Болотный гоблин', type: 'hostile', color: '#15803d', hp: 7, label: 'ГБ', count: 3 }
      ],
      swamp: [
        { name: 'Болотный виверн', type: 'hostile', color: '#4d7c0f', hp: 55, sizeCells: 2, label: 'ВИ', count: 1 },
        { name: 'Трупная мокрота', type: 'hostile', color: '#65a30d', hp: 18, label: 'МК', count: 3 }
      ],
      winter: [
        { name: 'Зимний волк', type: 'hostile', color: '#0284c7', hp: 28, sizeCells: 2, label: 'ЗВ', count: 2 },
        { name: 'Ледяной мертвец', type: 'hostile', color: '#38bdf8', hp: 13, label: 'ЛМ', count: 3 }
      ],
      desert: [
        { name: 'Гигантский скорпион', type: 'hostile', color: '#d97706', hp: 52, sizeCells: 2, label: 'СК', count: 1 },
        { name: 'Песчаный кочевник', type: 'hostile', color: '#b45309', hp: 16, label: 'ПК', count: 3 }
      ],
      ruins: [
        { name: 'Скелет-страж', type: 'hostile', color: '#71717a', hp: 13, label: 'СК', count: 4 },
        { name: 'Культист-маг', type: 'hostile', color: '#7c3aed', hp: 27, label: 'КМ', count: 1 }
      ],
      camp: [
        { name: 'Наемник', type: 'hostile', color: '#ea580c', hp: 15, label: 'НМ', count: 4 },
        { name: 'Командир лагеря', type: 'hostile', color: '#c2410c', hp: 42, label: 'КМ', count: 1 }
      ],
      cave: [
        { name: 'Пещерный паук', type: 'hostile', color: '#7c3aed', hp: 26, sizeCells: 1, label: 'ПП', count: 3 },
        { name: 'Троглодит-охотник', type: 'hostile', color: '#10b981', hp: 13, label: 'ТР', count: 3 },
        { name: 'Ужас Глубин', type: 'hostile', color: '#6366f1', hp: 58, sizeCells: 2, label: 'УЖ', count: 1 }
      ],
      dungeon: [
        { name: 'Скелет-рыцарь', type: 'hostile', color: '#94a3b8', hp: 22, label: 'СР', count: 3 },
        { name: 'Тюремный надзиратель', type: 'hostile', color: '#dc2626', hp: 38, sizeCells: 1, label: 'НД', count: 1 },
        { name: 'Некромант', type: 'hostile', color: '#a855f7', hp: 40, label: 'НК', count: 1 }
      ],
      archipelago: [
        { name: 'Пират-головорез', type: 'hostile', color: '#ea580c', hp: 16, label: 'ПР', count: 4 },
        { name: 'Боцман Крюк', type: 'hostile', color: '#b91c1c', hp: 44, label: 'БК', count: 1 },
        { name: 'Морская сирена', type: 'hostile', color: '#06b6d4', hp: 28, label: 'СР', count: 1 }
      ],
      ship: [
        { name: 'Абордажник', type: 'hostile', color: '#f97316', hp: 18, label: 'АБ', count: 4 },
        { name: 'Канонир', type: 'hostile', color: '#eab308', hp: 15, label: 'КН', count: 2 },
        { name: 'Капитан Галеона', type: 'hostile', color: '#b91c1c', hp: 55, label: 'КП', count: 1 }
      ]
    };

    const template = encounters[biomeId] || encounters.forest;
    const centerX = map.grid.totalWidth * 0.5;
    const centerY = map.grid.totalHeight * 0.5;

    let offset = 0;
    for (const group of template) {
      for (let i = 0; i < group.count; i++) {
        const angle = offset * 0.8 + i * 1.1;
        const radius = CS * (2.5 + (i % 2) * 1.5);
        this.addToken({
          name: `${group.name} #${i + 1}`,
          type: group.type,
          color: group.color,
          label: group.label + (group.count > 1 ? (i + 1) : ''),
          hp: group.hp,
          maxHp: group.hp,
          sizeCells: group.sizeCells || 1,
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius
        });
      }
      offset += 1.5;
    }
  }

  render(ctx, map, viewTransform = { x: 0, y: 0, scale: 1 }) {
    if (!this.tokens.length) return;
    const CS = map.grid.cellSize;

    ctx.save();
    ctx.translate(viewTransform.x, viewTransform.y);
    ctx.scale(viewTransform.scale, viewTransform.scale);

    for (const token of this.tokens) {
      const radius = (token.sizeCells * CS) * 0.45;
      const isSelected = token.id === this.selectedTokenId;

      // 1. Movement Range Ring if Selected (e.g. 30ft radius)
      if (isSelected) {
        const speedPx = (token.speedFeet / 5) * CS;
        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(token.x, token.y, speedPx, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 2. Token Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.arc(token.x + 3, token.y + 4, radius, 0, Math.PI * 2);
      ctx.fill();

      // 3. Token Base Disc
      ctx.fillStyle = token.color;
      ctx.beginPath();
      ctx.arc(token.x, token.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // 4. Token Outer Ring (Gold if selected)
      ctx.strokeStyle = isSelected ? '#fbbf24' : '#18181b';
      ctx.lineWidth = isSelected ? 3.5 : 2;
      ctx.stroke();

      // 5. Token Inner Highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(token.x, token.y, radius * 0.8, 0, Math.PI * 2);
      ctx.stroke();

      // 6. Token Label
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(radius * 0.9)}px "Share Tech Bold", "Share Tech Regular", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(token.label, token.x, token.y);

      // 7. Token Health Bar (if damaged)
      if (token.hp < token.maxHp) {
        const barW = radius * 1.6;
        const barH = 5;
        const barX = token.x - barW * 0.5;
        const barY = token.y - radius - 10;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

        const hpRatio = Math.max(0, token.hp / token.maxHp);
        ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.2 ? '#eab308' : '#ef4444';
        ctx.fillRect(barX, barY, barW * hpRatio, barH);
      }
    }

    ctx.restore();
  }

  getTokenAt(x, y, CS) {
    for (let i = this.tokens.length - 1; i >= 0; i--) {
      const t = this.tokens[i];
      const radius = (t.sizeCells * CS) * 0.5;
      const dx = x - t.x;
      const dy = y - t.y;
      if (dx * dx + dy * dy <= radius * radius) {
        return t;
      }
    }
    return null;
  }
}
