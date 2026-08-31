/**
 * Interactive Vehicles & Carts System for D&D 5e Battlemaps
 * Procedurally generated merchant carts, wooden wagons, supply drays with cargo
 * Supports Drag & Drop, rotation, and BroadcastChannel synchronization
 */

import { PRNG, dist } from './prng.js';

export class VehicleManager {
  constructor() {
    this.vehicles = [];
    this.selectedVehicleId = null;
    this.draggedVehicle = null;
    this.dragOffset = { x: 0, y: 0 };
  }

  addVehicle(config = {}) {
    const id = config.id || 'veh_' + Math.random().toString(36).substring(2, 9);
    const prng = new PRNG(config.seed || Math.floor(Math.random() * 1000000).toString());

    const type = config.type || prng.choice(['merchant', 'covered', 'farmer', 'adventurer', 'timber']);
    const length = config.length || 72; // ~15 ft (3 cells)
    const width = config.width || 36;   // ~7.5 ft (1.5 cells)

    // Generate procedural cargo
    const cargo = [];
    const cargoTypes = ['barrels', 'crates', 'sacks', 'chest', 'lantern', 'hay', 'canopy'];

    if (type === 'merchant') {
      // Cloth canopy + barrels & crates
      cargo.push({ type: 'canopy', color: prng.choice(['#d97706', '#dc2626', '#2563eb', '#059669', '#d4d4d8']) });
      cargo.push({ type: 'crate', x: -12, y: -6, w: 14, h: 14 });
      cargo.push({ type: 'barrel', x: 10, y: 5, r: 7 });
      cargo.push({ type: 'lantern', x: -length * 0.45, y: -width * 0.45 });
    } else if (type === 'covered') {
      // Full canvas covered wagon (Conestoga style)
      cargo.push({ type: 'full_canopy', color: '#e4d5b7', hoops: 5 });
      cargo.push({ type: 'lantern', x: -length * 0.48, y: -width * 0.45 });
    } else if (type === 'farmer') {
      // Hay + grain sacks + pumpkin/turnip crates
      cargo.push({ type: 'hay', x: -8, y: 0, w: 32, h: 22 });
      cargo.push({ type: 'sack', x: 14, y: -6, r: 6 });
      cargo.push({ type: 'sack', x: 16, y: 5, r: 5.5 });
    } else if (type === 'adventurer') {
      // Adventuring gear: chest, bedrolls, weapon crate, lantern
      cargo.push({ type: 'chest', x: -14, y: 0, w: 16, h: 10 });
      cargo.push({ type: 'bedroll', x: 8, y: -7, w: 18, h: 8 });
      cargo.push({ type: 'barrel', x: 12, y: 6, r: 6.5 });
      cargo.push({ type: 'lantern', x: length * 0.42, y: -width * 0.42 });
    } else if (type === 'timber') {
      // Heavy logs strapped to bed
      cargo.push({ type: 'logs', count: 3 });
    }

    const newVehicle = {
      id,
      name: config.name || this.getVehicleName(type),
      type,
      x: config.x || 150,
      y: config.y || 150,
      angle: config.angle || 0,
      length,
      width,
      woodColor: config.woodColor || '#805934',
      wheelColor: config.wheelColor || '#422f1c',
      ironColor: '#27272a',
      cargo,
      hasDraftAnimals: config.hasDraftAnimals ?? false,
      animalType: config.animalType || 'horses' // 'horses' or 'oxen'
    };

    this.vehicles.push(newVehicle);
    return newVehicle;
  }

  getVehicleName(type) {
    const names = {
      merchant: 'Купеческая повозка',
      covered: 'Крытый дорожный фургон',
      farmer: 'Крестьянская телега',
      adventurer: 'Телега авантюристов',
      timber: 'Дрововоз'
    };
    return names[type] || 'Повозка';
  }

  removeVehicle(id) {
    this.vehicles = this.vehicles.filter(v => v.id !== id);
    if (this.selectedVehicleId === id) this.selectedVehicleId = null;
  }

  clear() {
    this.vehicles = [];
    this.selectedVehicleId = null;
  }

  getVehicleAt(x, y) {
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      const dx = x - v.x;
      const dy = y - v.y;
      // Rotate query point into vehicle local coordinates
      const cos = Math.cos(-v.angle);
      const sin = Math.sin(-v.angle);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;

      const halfL = v.length * 0.6; // slightly generous hit zone
      const halfW = v.width * 0.65;

      if (Math.abs(lx) <= halfL && Math.abs(ly) <= halfW) {
        return v;
      }
    }
    return null;
  }

  render(ctx, map, viewTransform = { x: 0, y: 0, scale: 1 }) {
    if (!this.vehicles.length) return;

    ctx.save();
    ctx.translate(viewTransform.x, viewTransform.y);
    ctx.scale(viewTransform.scale, viewTransform.scale);

    for (const v of this.vehicles) {
      const isSelected = v.id === this.selectedVehicleId;
      const hl = v.length * 0.5;
      const hw = v.width * 0.5;

      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.rotate(v.angle);

      // 1. Soft Ground Shadow
      ctx.fillStyle = 'rgba(15, 15, 20, 0.38)';
      ctx.beginPath();
      ctx.roundRect(-hl + 3, -hw + 4, v.length, v.width, 4);
      ctx.fill();

      // Shadow under tongue / shaft
      ctx.fillRect(hl, -2, 28, 6);

      // 2. Draft Shaft / Tongue (оглобли спереди)
      ctx.strokeStyle = '#5a3d24';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(hl - 4, -hw * 0.4);
      ctx.lineTo(hl + 26, 0);
      ctx.moveTo(hl - 4, hw * 0.4);
      ctx.lineTo(hl + 26, 0);
      ctx.moveTo(hl + 26, 0);
      ctx.lineTo(hl + 34, 0);
      ctx.stroke();

      // Crossbar for harness
      ctx.strokeStyle = '#3d2817';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hl + 22, -hw * 0.55);
      ctx.lineTo(hl + 22, hw * 0.55);
      ctx.stroke();

      // 3. Four Wooden Wheels with Iron Rims (колеса со спицами)
      const wheelL = 20;
      const wheelW = 5;
      const wheelPositions = [
        { x: -hl * 0.55, y: -hw - 3 },
        { x: hl * 0.55, y: -hw - 3 },
        { x: -hl * 0.55, y: hw + 3 },
        { x: hl * 0.55, y: hw + 3 }
      ];

      for (const wp of wheelPositions) {
        // Wheel hub shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(wp.x - wheelL * 0.5 + 1, wp.y - wheelW * 0.5 + 2, wheelL, wheelW);

        // Wheel rim (iron)
        ctx.fillStyle = v.ironColor;
        ctx.fillRect(wp.x - wheelL * 0.5, wp.y - wheelW * 0.5, wheelL, wheelW);

        // Wheel wood center
        ctx.fillStyle = v.wheelColor;
        ctx.fillRect(wp.x - wheelL * 0.35, wp.y - wheelW * 0.3, wheelL * 0.7, wheelW * 0.6);

        // Axle pin
        ctx.fillStyle = '#d4d4d8';
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Cart Wooden Bed (дощатый пол телеги)
      ctx.fillStyle = v.woodColor;
      ctx.fillRect(-hl, -hw, v.length, v.width);

      // Wooden planks across bed
      ctx.strokeStyle = '#4e331c';
      ctx.lineWidth = 1;
      for (let x = -hl + 8; x < hl; x += 9) {
        ctx.beginPath();
        ctx.moveTo(x, -hw);
        ctx.lineTo(x, hw);
        ctx.stroke();
      }

      // 5. Wooden Siderails (борта телеги с железными уголками)
      ctx.strokeStyle = '#36210f';
      ctx.lineWidth = 3;
      ctx.strokeRect(-hl, -hw, v.length, v.width);

      // Siderail Stakes / Posts
      ctx.fillStyle = '#2b1a0c';
      for (let x = -hl; x <= hl; x += v.length * 0.25) {
        ctx.fillRect(x - 2, -hw - 1.5, 4, 3);
        ctx.fillRect(x - 2, hw - 1.5, 4, 3);
      }

      // 6. Render Cargo
      this.renderCargo(ctx, v, hl, hw);

      // 7. Selection Ring if selected
      if (isSelected) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(-hl - 6, -hw - 8, v.length + 12, v.width + 16);
        ctx.setLineDash([]);

        // Front direction indicator arrow
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(hl + 38, 0);
        ctx.lineTo(hl + 28, -6);
        ctx.lineTo(hl + 28, 6);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    ctx.restore();
  }

  renderCargo(ctx, v, hl, hw) {
    for (const item of v.cargo) {
      if (item.type === 'canopy') {
        // Striped / solid cloth canopy
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.roundRect(-hl * 0.8, -hw * 0.9, v.length * 0.8, v.width * 1.8, 3);
        ctx.fill();
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Canopy ridges
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1.2;
        for (let x = -hl * 0.7; x < hl * 0.7; x += 14) {
          ctx.beginPath();
          ctx.moveTo(x, -hw * 0.9);
          ctx.lineTo(x, hw * 0.9);
          ctx.stroke();
        }
      } else if (item.type === 'full_canopy') {
        // Conestoga arched canvas cover
        ctx.fillStyle = item.color;
        ctx.fillRect(-hl + 4, -hw + 2, v.length - 8, v.width - 4);

        ctx.strokeStyle = '#4a3b2c';
        ctx.lineWidth = 2;
        ctx.strokeRect(-hl + 4, -hw + 2, v.length - 8, v.width - 4);

        // Arched Rib Hoops
        ctx.strokeStyle = '#8a6e4d';
        ctx.lineWidth = 2.5;
        const step = (v.length - 12) / (item.hoops || 4);
        for (let i = 0; i <= (item.hoops || 4); i++) {
          const x = -hl + 6 + i * step;
          ctx.beginPath();
          ctx.moveTo(x, -hw + 2);
          ctx.lineTo(x, hw - 2);
          ctx.stroke();
        }
      } else if (item.type === 'crate') {
        ctx.fillStyle = '#9e7951';
        ctx.fillRect(item.x - item.w * 0.5, item.y - item.h * 0.5, item.w, item.h);
        ctx.strokeStyle = '#42311f';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(item.x - item.w * 0.5, item.y - item.h * 0.5, item.w, item.h);
        ctx.beginPath();
        ctx.moveTo(item.x - item.w * 0.5, item.y - item.h * 0.5);
        ctx.lineTo(item.x + item.w * 0.5, item.y + item.h * 0.5);
        ctx.stroke();
      } else if (item.type === 'barrel') {
        ctx.fillStyle = '#7a5433';
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#382413';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Inner bung ring
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.r * 0.4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (item.type === 'sack') {
        ctx.fillStyle = '#c4b595';
        ctx.beginPath();
        ctx.ellipse(item.x, item.y, item.r * 1.2, item.r * 0.85, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#5a4f3b';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        // Sack tie
        ctx.fillStyle = '#3a2d1d';
        ctx.fillRect(item.x + item.r * 0.8, item.y - 2, 3, 4);
      } else if (item.type === 'chest') {
        ctx.fillStyle = '#5c3a21';
        ctx.fillRect(item.x - item.w * 0.5, item.y - item.h * 0.5, item.w, item.h);
        ctx.strokeStyle = '#241408';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(item.x - item.w * 0.5, item.y - item.h * 0.5, item.w, item.h);
        // Iron bands & lock
        ctx.strokeStyle = '#d4d4d8';
        ctx.lineWidth = 1;
        ctx.strokeRect(item.x - item.w * 0.35, item.y - item.h * 0.5, item.w * 0.7, item.h);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(item.x - 1.5, item.y - 1.5, 3, 3);
      } else if (item.type === 'hay') {
        ctx.fillStyle = '#d4c26a';
        ctx.beginPath();
        ctx.roundRect(item.x - item.w * 0.5, item.y - item.h * 0.5, item.w, item.h, 4);
        ctx.fill();
        ctx.strokeStyle = '#8a7d35';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else if (item.type === 'logs') {
        // Three cut logs stacked
        ctx.fillStyle = '#6b4f32';
        for (let l = -hw * 0.6; l <= hw * 0.6; l += hw * 0.6) {
          ctx.fillRect(-hl + 6, l - 5, v.length - 12, 10);
          ctx.strokeStyle = '#302011';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(-hl + 6, l - 5, v.length - 12, 10);
        }
      } else if (item.type === 'lantern') {
        // Brass hanging lantern with glow
        ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
        ctx.beginPath();
        ctx.arc(item.x, item.y, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(item.x, item.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }
}
