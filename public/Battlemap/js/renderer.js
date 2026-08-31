/**
 * 2D Canvas Battlemap Renderer
 * Implements Watabou-style watercolor/ink organic nature and dungeon precision
 */

import { dist } from './prng.js';

export class BattlemapRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.paperPattern = null;
    this.initPaperPattern();
  }

  initPaperPattern() {
    // Generate subtle procedural parchment grain offscreen
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 128;
    pCanvas.height = 128;
    const pCtx = pCanvas.getContext('2d');
    const imgData = pCtx.createImageData(128, 128);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.floor(Math.random() * 16);
      d[i] = 240 + v;     // R
      d[i + 1] = 236 + v; // G
      d[i + 2] = 224 + v; // B
      d[i + 3] = 255;
    }
    pCtx.putImageData(imgData, 0, 0);
    this.paperPattern = this.ctx.createPattern(pCanvas, 'repeat');
  }

  render(map, viewTransform = { x: 0, y: 0, scale: 1 }, options = {}) {
    const ctx = this.ctx;
    const W = map.grid.totalWidth;
    const H = map.grid.totalHeight;

    ctx.save();
    // Fill full canvas with dark border background
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply pan & zoom transform
    ctx.translate(viewTransform.x, viewTransform.y);
    ctx.scale(viewTransform.scale, viewTransform.scale);

    // Clip to map boundaries with slight margin
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    // 1. Base Terrain & Ground
    this.renderGround(ctx, map, W, H);

    // Special Biome Custom Layer Structures
    if (map.caveNetwork) {
      this.renderCaveNetwork(ctx, map, W, H);
    }
    if (map.dungeonComplex) {
      this.renderDungeonComplex(ctx, map, W, H);
    }
    if (map.archipelagoData) {
      this.renderArchipelago(ctx, map, W, H);
    }
    if (map.shipsData) {
      this.renderShips(ctx, map, W, H);
    }

    // 2. Elevation & Contours & Cliffs & Mountains
    this.renderElevation(ctx, map, W, H);
    if (map.mountains && map.mountains.length) {
      this.renderMountains(ctx, map);
    }
    if (map.cliffs && map.cliffs.length) {
      this.renderCliffs(ctx, map);
    }

    // 3. Farmland & Fields
    if (map.fields && map.fields.length) {
      this.renderFields(ctx, map);
    }

    // 4. Environmental Ground Clutter & Micro-Details (pebbles, grass tufts, flowers, puddles)
    if (map.clutter) {
      this.renderClutter(ctx, map);
    }

    // 5. Waterways & Swamp Pools
    if (map.water.hasRiver && map.water.path.length) {
      this.renderRiver(ctx, map);
    }
    if (map.water.pools && map.water.pools.length) {
      this.renderSwampPools(ctx, map);
    }

    // 6. Roads & Paths
    if (map.roads && map.roads.length) {
      this.renderRoads(ctx, map);
    }
    if (map.faintTrail && map.faintTrail.path.length) {
      this.renderFaintTrail(ctx, map);
    }

    // 7. Bridge or Stepping Stones
    if (map.water.bridge) {
      this.renderBridge(ctx, map.water.bridge, map.biome);
    }
    if (map.water.steppingStones && map.water.steppingStones.length) {
      this.renderSteppingStones(ctx, map.water.steppingStones);
    }

    // 8. Ancient Ruins (Massive Architectural Complex)
    if (map.ruins && map.ruins.length) {
      this.renderRuins(ctx, map);
    }

    // 9. Buildings / Cabins
    if (map.buildings && map.buildings.length) {
      this.renderBuildings(ctx, map);
    }

    // 10. Camp & Tents
    if (map.camp) {
      this.renderCamp(ctx, map.camp, map.biome);
    }

    // 11. Points of Interest (POIs) / Интересные места (Caves, altars, treehouses, crypts, caches)
    if (map.pois && map.pois.length) {
      this.renderPOIs(ctx, map);
    }

    // 12. Rocks & Boulder Formations
    if (map.rocks && map.rocks.length) {
      this.renderRocks(ctx, map);
    }

    // 13. Fallen Logs
    if (map.fallenLogs && map.fallenLogs.length) {
      this.renderFallenLogs(ctx, map.fallenLogs);
    }

    // 14. Trees & Canopies
    if (map.trees && map.trees.length) {
      this.renderTrees(ctx, map);
    }

    // 15. Atmospheric Lighting Overlay
    this.renderAtmosphere(ctx, map, W, H);

    ctx.restore(); // Restore map clip

    // Map Border Frame (Watabou ink double border)
    this.renderMapBorder(ctx, W, H);

    ctx.restore(); // Restore pan/zoom
  }

  renderGround(ctx, map, W, H) {
    const biome = map.biome;
    ctx.fillStyle = biome.ground.base;
    ctx.fillRect(0, 0, W, H);

    // Subtle paper noise overlay
    if (this.paperPattern) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = this.paperPattern;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Organic watercolor patches
    const res = map.elevation.res || 12;
    const data = map.elevation.data;
    if (data && data.length) {
      ctx.save();
      for (let r = 0; r < map.elevation.rows - 1; r += 2) {
        for (let c = 0; c < map.elevation.cols - 1; c += 2) {
          const elev = data[r][c];
          if (elev > 0.55) {
            ctx.fillStyle = biome.ground.grassDark;
            ctx.globalAlpha = (elev - 0.55) * 0.45;
            ctx.beginPath();
            ctx.arc(c * res, r * res, res * 2.2, 0, Math.PI * 2);
            ctx.fill();
          } else if (elev < 0.42) {
            ctx.fillStyle = biome.ground.dirt;
            ctx.globalAlpha = (0.42 - elev) * 0.4;
            ctx.beginPath();
            ctx.arc(c * res, r * res, res * 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();
    }
  }

  renderElevation(ctx, map, W, H) {
    // Render subtle contour lines with slope hatching
    const biome = map.biome;
    ctx.save();
    ctx.strokeStyle = biome.ground.shadow;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;

    const data = map.elevation.data;
    const res = map.elevation.res;
    if (!data) { ctx.restore(); return; }

    const threshold = 0.6;
    ctx.beginPath();
    for (let r = 1; r < map.elevation.rows - 1; r++) {
      for (let c = 1; c < map.elevation.cols - 1; c++) {
        if (data[r][c] > threshold && data[r][c - 1] <= threshold) {
          ctx.moveTo(c * res, r * res);
          ctx.lineTo(c * res + res * 0.5, r * res + res * 0.5);
        }
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  renderFields(ctx, map) {
    const biome = map.biome;
    for (const field of map.fields) {
      ctx.save();
      // Field boundary fill
      ctx.fillStyle = field.cropColor || biome.fields.crop;
      ctx.fillRect(field.x, field.y, field.width, field.height);

      // Furrow hatch lines
      ctx.save();
      ctx.beginPath();
      ctx.rect(field.x, field.y, field.width, field.height);
      ctx.clip();

      ctx.strokeStyle = biome.fields.furrow;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5;

      const spacing = 10;
      const diag = Math.sqrt(field.width * field.width + field.height * field.height);
      const cosA = Math.cos(field.furrowAngle);
      const sinA = Math.sin(field.furrowAngle);
      const perpX = -sinA * spacing;
      const perpY = cosA * spacing;

      ctx.beginPath();
      for (let i = -diag; i < diag * 1.5; i += spacing) {
        const sx = field.x + field.width * 0.5 + cosA * i - sinA * diag;
        const sy = field.y + field.height * 0.5 + sinA * i + cosA * diag;
        const ex = field.x + field.width * 0.5 + cosA * i + sinA * diag;
        const ey = field.y + field.height * 0.5 + sinA * i - cosA * diag;
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
      }
      ctx.stroke();
      ctx.restore();

      // Field Fence / Border
      if (field.hasFence) {
        ctx.strokeStyle = biome.fields.border;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(field.x, field.y, field.width, field.height);

        // Fence posts at corners and intervals
        ctx.fillStyle = '#4a3b2c';
        const postSpacing = 24;
        for (let px = field.x; px <= field.x + field.width; px += postSpacing) {
          ctx.beginPath();
          ctx.arc(px, field.y, 2.5, 0, Math.PI * 2);
          ctx.arc(px, field.y + field.height, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let py = field.y; py <= field.y + field.height; py += postSpacing) {
          ctx.beginPath();
          ctx.arc(field.x, py, 2.5, 0, Math.PI * 2);
          ctx.arc(field.x + field.width, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }
  }

  renderRiver(ctx, map) {
    const pts = map.water.path;
    if (!pts || pts.length < 2) return;
    const biome = map.biome;
    const width = map.water.width;

    ctx.save();

    // 1. River Shoreline Ripples (Watabou outer wave rings)
    for (const offset of [width * 0.75, width * 0.65]) {
      ctx.strokeStyle = biome.water.foam;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      this.drawSmoothSpline(ctx, pts);
      ctx.lineWidth = offset * 2;
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 2. River Bank line
    ctx.strokeStyle = biome.water.bank;
    ctx.lineWidth = width + 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    this.drawSmoothSpline(ctx, pts);
    ctx.stroke();

    // 3. Shallow Water
    ctx.strokeStyle = biome.water.shallow;
    ctx.lineWidth = width;
    ctx.beginPath();
    this.drawSmoothSpline(ctx, pts);
    ctx.stroke();

    // 4. Deep River Center Stream
    ctx.strokeStyle = biome.water.deep;
    ctx.lineWidth = width * 0.55;
    ctx.beginPath();
    this.drawSmoothSpline(ctx, pts);
    ctx.stroke();

    // 5. If Winter: render ice cracks
    if (map.water.isFrozen) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1.2;
      for (let i = 1; i < pts.length - 1; i += 2) {
        const pt = pts[i];
        ctx.beginPath();
        ctx.moveTo(pt.x - 14, pt.y - 10);
        ctx.lineTo(pt.x + 8, pt.y + 4);
        ctx.lineTo(pt.x + 18, pt.y - 6);
        ctx.moveTo(pt.x + 8, pt.y + 4);
        ctx.lineTo(pt.x + 2, pt.y + 16);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  renderSwampPools(ctx, map) {
    const biome = map.biome;
    for (const pool of map.water.pools) {
      ctx.save();
      ctx.translate(pool.cx, pool.cy);
      ctx.rotate(pool.angle);

      // Outer muddy edge
      ctx.fillStyle = biome.water.bank;
      ctx.beginPath();
      ctx.ellipse(0, 0, pool.rx + 8, pool.ry + 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shallow pool
      ctx.fillStyle = biome.water.shallow;
      ctx.beginPath();
      ctx.ellipse(0, 0, pool.rx, pool.ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // Deep center
      ctx.fillStyle = biome.water.deep;
      ctx.beginPath();
      ctx.ellipse(0, 0, pool.rx * 0.6, pool.ry * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Reeds / Lily pads
      ctx.fillStyle = '#495932';
      for (let j = 0; j < 4; j++) {
        const lx = (j - 1.5) * (pool.rx * 0.35);
        const ly = Math.sin(j) * (pool.ry * 0.3);
        ctx.beginPath();
        ctx.arc(lx, ly, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  renderRoads(ctx, map) {
    const biome = map.biome;
    for (const road of map.roads) {
      if (!road.path || road.path.length < 2) continue;

      ctx.save();
      // Main Road Bed
      ctx.strokeStyle = biome.road.fill;
      ctx.lineWidth = road.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      this.drawSmoothSpline(ctx, road.path);
      ctx.stroke();

      // Road Edge Outlines
      ctx.strokeStyle = biome.road.stroke;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.55;

      // Left & right wheel rut tracks (D&D cart tracks)
      if (road.type === 'main') {
        const offset = road.width * 0.28;
        ctx.setLineDash([12, 6]);
        ctx.strokeStyle = biome.road.dash;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        this.drawSmoothSpline(ctx, road.path);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  renderFaintTrail(ctx, map) {
    if (!map.faintTrail || !map.faintTrail.path || map.faintTrail.path.length < 2) return;
    const biome = map.biome;
    ctx.save();
    // Faint trampled earth / mossy trail
    ctx.strokeStyle = biome.ground.patch;
    ctx.lineWidth = map.faintTrail.width || 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    this.drawSmoothSpline(ctx, map.faintTrail.path);
    ctx.stroke();

    // Central narrow foot track
    ctx.strokeStyle = biome.road.fill;
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 6]);
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    this.drawSmoothSpline(ctx, map.faintTrail.path);
    ctx.stroke();
    ctx.restore();
  }

  renderBridge(ctx, bridge, biome) {
    ctx.save();
    ctx.translate(bridge.x, bridge.y);
    ctx.rotate(bridge.angle);

    const hw = bridge.width * 0.5;
    const hl = bridge.length * 0.5;

    // Solid Stone/Wood Abutments on both river banks
    ctx.fillStyle = '#4a463d';
    ctx.fillRect(-hl - 6, -hw - 2, 8, bridge.width + 4);
    ctx.fillRect(hl - 2, -hw - 2, 8, bridge.width + 4);

    // Drop shadow
    ctx.fillStyle = 'rgba(20, 20, 20, 0.35)';
    ctx.fillRect(-hl + 3, -hw + 4, bridge.length, bridge.width);

    // Bridge Deck Planks
    ctx.fillStyle = bridge.material === 'stone' ? '#8a857a' : '#aa8c64';
    ctx.fillRect(-hl, -hw, bridge.length, bridge.width);

    // Wooden / Stone Planks
    ctx.strokeStyle = bridge.material === 'stone' ? '#5a554a' : '#6b5133';
    ctx.lineWidth = 1.5;
    for (let x = -hl; x <= hl; x += 7) {
      ctx.beginPath();
      ctx.moveTo(x, -hw);
      ctx.lineTo(x, hw);
      ctx.stroke();
    }

    // Railings / Beams
    ctx.fillStyle = bridge.material === 'stone' ? '#504c43' : '#573d22';
    ctx.fillRect(-hl - 4, -hw - 3, bridge.length + 8, 5);
    ctx.fillRect(-hl - 4, hw - 2, bridge.length + 8, 5);

    // Railing Posts
    for (let x = -hl; x <= hl; x += bridge.length * 0.33) {
      ctx.fillStyle = '#2b1e11';
      ctx.fillRect(x - 2, -hw - 4, 4, 6);
      ctx.fillRect(x - 2, hw - 2, 4, 6);
    }

    ctx.restore();
  }

  renderSteppingStones(ctx, stones) {
    for (const st of stones) {
      ctx.save();
      // Drop shadow in water
      ctx.fillStyle = 'rgba(20, 40, 40, 0.4)';
      ctx.beginPath();
      ctx.arc(st.x + 2, st.y + 2, st.radius, 0, Math.PI * 2);
      ctx.fill();

      // Stone top
      ctx.fillStyle = '#9e998a';
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.radius, 0, Math.PI * 2);
      ctx.fill();

      // Outline
      ctx.strokeStyle = '#484439';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Highlight
      ctx.fillStyle = '#c7c2b3';
      ctx.beginPath();
      ctx.arc(st.x - st.radius * 0.3, st.y - st.radius * 0.3, st.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  renderBuildings(ctx, map) {
    const biome = map.biome;
    for (const b of map.buildings) {
      ctx.save();

      // 1. Procedural Front Pathway directly connecting doorway to road
      if (b.frontPath && b.frontPath.length >= 2) {
        ctx.save();
        ctx.strokeStyle = biome.road.fill;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        this.drawSmoothSpline(ctx, b.frontPath);
        ctx.stroke();

        // Stepping stone pavers along the front path
        ctx.fillStyle = '#9c9789';
        ctx.strokeStyle = '#47433b';
        ctx.lineWidth = 1;
        for (let i = 0; i < b.frontPath.length; i++) {
          const pt = b.frontPath[i];
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }

      // 2. Front Porch Deck (facing the road)
      if (b.hasPorch && b.door) {
        const doorSide = b.door.side || 'south';
        let px = b.x + b.width * 0.5 - 18;
        let py = b.y + b.height;
        let pw = 36, ph = 12;
        if (doorSide === 'north') { py = b.y - 12; }
        else if (doorSide === 'west') { px = b.x - 12; py = b.y + b.height * 0.5 - 18; pw = 12; ph = 36; }
        else if (doorSide === 'east') { px = b.x + b.width; py = b.y + b.height * 0.5 - 18; pw = 12; ph = 36; }

        ctx.fillStyle = '#91724f';
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeStyle = '#4a331c';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px, py, pw, ph);
      }

      // 3. Outdoor Features (Well, Woodpile)
      if (b.outdoorFeatures) {
        for (const feat of b.outdoorFeatures) {
          if (feat.type === 'well') {
            // Shadow
            ctx.fillStyle = 'rgba(20, 20, 20, 0.3)';
            ctx.beginPath();
            ctx.arc(feat.x + 2, feat.y + 2, feat.r, 0, Math.PI * 2);
            ctx.fill();
            // Stone rim
            ctx.fillStyle = '#8f897c';
            ctx.beginPath();
            ctx.arc(feat.x, feat.y, feat.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#47433b';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Deep water center
            ctx.fillStyle = '#2d4745';
            ctx.beginPath();
            ctx.arc(feat.x, feat.y, feat.r * 0.6, 0, Math.PI * 2);
            ctx.fill();
            // Wooden crossbeam
            ctx.strokeStyle = '#5a3d24';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(feat.x - feat.r - 2, feat.y);
            ctx.lineTo(feat.x + feat.r + 2, feat.y);
            ctx.stroke();
          } else if (feat.type === 'woodpile') {
            ctx.fillStyle = '#7a5a3a';
            ctx.fillRect(feat.x, feat.y, feat.w, feat.h);
            ctx.strokeStyle = '#3e2a16';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(feat.x, feat.y, feat.w, feat.h);
            // Individual log rounds
            ctx.fillStyle = '#9e7951';
            for (let lx = feat.x + 4; lx < feat.x + feat.w - 2; lx += 7) {
              for (let ly = feat.y + 4; ly < feat.y + feat.h - 2; ly += 7) {
                ctx.beginPath();
                ctx.arc(lx, ly, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
              }
            }
          }
        }
      }

      // Building Cast Shadow (D&D tactical style)
      ctx.fillStyle = 'rgba(15, 15, 15, 0.35)';
      ctx.fillRect(b.x + 6, b.y + 6, b.width, b.height);

      // Floor Planks / Interior floor
      ctx.fillStyle = biome.building.floor;
      ctx.fillRect(b.x, b.y, b.width, b.height);

      // Interior wooden floorboards (Watabou Dungeon style)
      ctx.strokeStyle = biome.building.planks;
      ctx.lineWidth = 1;
      const plankW = 12;
      for (let px = b.x; px <= b.x + b.width; px += plankW) {
        ctx.beginPath();
        ctx.moveTo(px, b.y);
        ctx.lineTo(px, b.y + b.height);
        ctx.stroke();
      }

      // Interior Props (Bed, Table, Hearth, Barrels, Crates)
      if (b.props) {
        for (const prop of b.props) {
          if (prop.type === 'bed') {
            ctx.fillStyle = '#c54e4e'; // Blanket
            ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
            ctx.strokeStyle = '#4a2222';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);
            // Pillow
            ctx.fillStyle = '#f0ece0';
            ctx.fillRect(prop.x + 2, prop.y + 2, prop.w - 4, prop.h * 0.28);
          } else if (prop.type === 'table') {
            ctx.fillStyle = '#8f6843';
            ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
            ctx.strokeStyle = '#47301c';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);
            // Benches on sides
            ctx.fillStyle = '#6b4c2d';
            ctx.fillRect(prop.x, prop.y - 7, prop.w, 4);
            ctx.fillRect(prop.x, prop.y + prop.h + 3, prop.w, 4);
          } else if (prop.type === 'hearth') {
            // Stone chimney hearth
            ctx.fillStyle = '#635e55';
            ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
            ctx.strokeStyle = '#2b2925';
            ctx.lineWidth = 2;
            ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);
            // Fire glowing embers
            ctx.fillStyle = '#e86128';
            ctx.beginPath();
            ctx.arc(prop.x + prop.w * 0.5, prop.y + prop.h * 0.5, 4, 0, Math.PI * 2);
            ctx.fill();
          } else if (prop.type === 'crate') {
            ctx.fillStyle = '#8c704f';
            ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
            ctx.strokeStyle = '#423321';
            ctx.lineWidth = 1.2;
            ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);
            // Diagonal brace
            ctx.beginPath();
            ctx.moveTo(prop.x, prop.y);
            ctx.lineTo(prop.x + prop.w, prop.y + prop.h);
            ctx.stroke();
          } else if (prop.type === 'barrel') {
            ctx.fillStyle = '#7a5a3a';
            ctx.beginPath();
            ctx.arc(prop.x, prop.y, prop.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#382615';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      }

      // Exterior Thick Walls (Watabou Dungeon Crosshatch style)
      ctx.strokeStyle = biome.building.wall;
      ctx.lineWidth = b.wallThickness;
      ctx.strokeRect(b.x, b.y, b.width, b.height);

      // Door opening with door swing arc (facing road)
      if (b.door) {
        const doorSide = b.door.side || 'south';
        const doorW = 20;
        let dx = b.x + b.width * 0.5 - doorW * 0.5;
        let dy = b.y + b.height - b.wallThickness * 0.5;
        let clearW = doorW + 2, clearH = b.wallThickness + 4;
        let swingStartX = dx, swingStartY = dy + b.wallThickness;
        let swingEndX = dx + 12, swingEndY = dy + 12;

        if (doorSide === 'north') {
          dy = b.y - b.wallThickness * 0.5;
          swingStartY = dy;
          swingEndY = dy - 12;
        } else if (doorSide === 'west') {
          dx = b.x - b.wallThickness * 0.5;
          dy = b.y + b.height * 0.5 - doorW * 0.5;
          clearW = b.wallThickness + 4;
          clearH = doorW + 2;
          swingStartX = dx;
          swingStartY = dy;
          swingEndX = dx - 12;
          swingEndY = dy + 12;
        } else if (doorSide === 'east') {
          dx = b.x + b.width - b.wallThickness * 0.5;
          dy = b.y + b.height * 0.5 - doorW * 0.5;
          clearW = b.wallThickness + 4;
          clearH = doorW + 2;
          swingStartX = dx + b.wallThickness;
          swingStartY = dy;
          swingEndX = dx + b.wallThickness + 12;
          swingEndY = dy + 12;
        }

        // Clear wall for doorway
        ctx.fillStyle = biome.building.floor;
        ctx.fillRect(dx - 1, dy - 1, clearW, clearH);

        // Door wooden plank swung open
        ctx.strokeStyle = '#805934';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(swingStartX, swingStartY);
        ctx.lineTo(swingEndX, swingEndY);
        ctx.stroke();
      }

      // Windows (Thin blue/light double line slits)
      if (b.windows) {
        ctx.strokeStyle = '#8bc4db';
        ctx.lineWidth = 3;
        for (const win of b.windows) {
          let wx = b.x + b.width * win.offset;
          let wy = b.y;
          if (win.side === 'south') wy = b.y + b.height;
          if (win.side === 'west') { wx = b.x; wy = b.y + b.height * win.offset; }
          if (win.side === 'east') { wx = b.x + b.width; wy = b.y + b.height * win.offset; }

          ctx.beginPath();
          if (win.side === 'north' || win.side === 'south') {
            ctx.moveTo(wx - 8, wy);
            ctx.lineTo(wx + 8, wy);
          } else {
            ctx.moveTo(wx, wy - 8);
            ctx.lineTo(wx, wy + 8);
          }
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  renderRuins(ctx, map) {
    const biome = map.biome;
    for (const r of map.ruins) {
      ctx.save();

      // 1. Paved Courtyard Foundations & Flagstone Slabs
      if (r.plazas) {
        for (const pl of r.plazas) {
          ctx.save();
          // Foundation base shadow / dirt border
          ctx.fillStyle = 'rgba(20, 20, 20, 0.18)';
          ctx.fillRect(pl.x - 4, pl.y - 4, pl.width + 8, pl.height + 8);

          // Weathered stone paving base fill
          ctx.fillStyle = biome.id === 'ruins' ? '#cfc8b6' : '#d8d3c1';
          ctx.fillRect(pl.x, pl.y, pl.width, pl.height);

          // Individual Flagstone Tiles
          const tileW = pl.tileW || 16;
          const tileH = pl.tileH || 16;
          const cols = Math.floor(pl.width / tileW);
          const rows = Math.floor(pl.height / tileH);

          ctx.strokeStyle = '#8a8372';
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.55;

          for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
              const tx = pl.x + col * tileW;
              const ty = pl.y + row * tileH;

              // Occasional missing paver revealing underlying dirt
              const hash = (Math.sin(col * 12.9898 + row * 78.233) * 43758.5453) % 1;
              if (Math.abs(hash) > 0.88) {
                ctx.fillStyle = biome.ground.dirt || '#b9a580';
                ctx.fillRect(tx + 1, ty + 1, tileW - 2, tileH - 2);
                continue;
              }

              ctx.strokeRect(tx + 0.5, ty + 0.5, tileW - 1, tileH - 1);

              // Crack through some slabs
              if (Math.abs(hash) < 0.25) {
                ctx.beginPath();
                ctx.moveTo(tx + 2, ty + 2);
                ctx.lineTo(tx + tileW - 3, ty + tileH - 3);
                ctx.stroke();
              }
            }
          }
          ctx.restore();
        }
      }

      // 2. Stepped Ceremonial Dais (Tiered Stone Platforms)
      if (r.dais) {
        ctx.save();
        // Outer tier shadow & fill
        ctx.fillStyle = 'rgba(20, 20, 20, 0.25)';
        ctx.fillRect(r.dais.x - 3, r.dais.y - 3, r.dais.width + 6, r.dais.height + 6);

        ctx.fillStyle = '#c5bea9';
        ctx.fillRect(r.dais.x, r.dais.y, r.dais.width, r.dais.height);
        ctx.strokeStyle = '#4a4537';
        ctx.lineWidth = 2;
        ctx.strokeRect(r.dais.x, r.dais.y, r.dais.width, r.dais.height);

        // Inner raised tier
        ctx.fillStyle = 'rgba(20, 20, 20, 0.2)';
        ctx.fillRect(r.dais.innerX - 2, r.dais.innerY - 2, r.dais.innerWidth + 4, r.dais.innerHeight + 4);

        ctx.fillStyle = '#ded7c4';
        ctx.fillRect(r.dais.innerX, r.dais.innerY, r.dais.innerWidth, r.dais.innerHeight);
        ctx.strokeStyle = '#3e392d';
        ctx.lineWidth = 2;
        ctx.strokeRect(r.dais.innerX, r.dais.innerY, r.dais.innerWidth, r.dais.innerHeight);
        ctx.restore();
      }

      // 3. Creeping Ivy & Moss Patches on Stones
      if (r.mossPatches) {
        ctx.save();
        for (const m of r.mossPatches) {
          ctx.fillStyle = 'rgba(80, 115, 50, 0.45)';
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(60, 90, 35, 0.55)';
          ctx.beginPath();
          ctx.arc(m.x + 2, m.y + 1, m.radius * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 4. Sunken Crypt Descent Stairs (Darkness underground)
      if (r.cryptStairs) {
        ctx.save();
        const cs = r.cryptStairs;
        // Outer stone railing / parapet
        ctx.fillStyle = '#423d32';
        ctx.fillRect(cs.x - 4, cs.y - cs.width * 0.5 - 4, cs.length + 8, cs.width + 8);

        // Dark underground pit
        ctx.fillStyle = '#11100e';
        ctx.fillRect(cs.x, cs.y - cs.width * 0.5, cs.length, cs.width);

        // Descending stone steps
        const stepW = cs.length / cs.steps;
        for (let s = 0; s < cs.steps; s++) {
          const stepX = cs.x + s * stepW;
          const alpha = 1.0 - (s / cs.steps) * 0.75;
          ctx.fillStyle = `rgba(185, 175, 155, ${alpha})`;
          ctx.fillRect(stepX, cs.y - cs.width * 0.5, stepW - 1, cs.width);
          ctx.strokeStyle = '#28241c';
          ctx.lineWidth = 1;
          ctx.strokeRect(stepX, cs.y - cs.width * 0.5, stepW - 1, cs.width);
        }
        ctx.restore();
      }

      // 5. Ancient Stone Sarcophagi / Tombs
      if (r.sarcophagi) {
        for (const tomb of r.sarcophagi) {
          ctx.save();
          ctx.translate(tomb.x, tomb.y);
          ctx.rotate(tomb.angle);

          // Shadow
          ctx.fillStyle = 'rgba(20, 20, 20, 0.35)';
          ctx.fillRect(-tomb.width * 0.5 + 4, -tomb.height * 0.5 + 4, tomb.width, tomb.height);

          // Stone casket base
          ctx.fillStyle = '#7a7566';
          ctx.fillRect(-tomb.width * 0.5, -tomb.height * 0.5, tomb.width, tomb.height);
          ctx.strokeStyle = '#2b2820';
          ctx.lineWidth = 2;
          ctx.strokeRect(-tomb.width * 0.5, -tomb.height * 0.5, tomb.width, tomb.height);

          // Displaced / Open lid
          const lidOffset = tomb.lidDisplaced ? 8 : 0;
          ctx.fillStyle = '#9e9785';
          ctx.fillRect(-tomb.width * 0.5 + lidOffset, -tomb.height * 0.5 - 2, tomb.width, tomb.height);
          ctx.strokeStyle = '#2b2820';
          ctx.lineWidth = 2;
          ctx.strokeRect(-tomb.width * 0.5 + lidOffset, -tomb.height * 0.5 - 2, tomb.width, tomb.height);

          // Carved cross/sword on lid
          ctx.strokeStyle = '#4a4537';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-tomb.width * 0.3 + lidOffset, 0);
          ctx.lineTo(tomb.width * 0.3 + lidOffset, 0);
          ctx.moveTo(-tomb.width * 0.1 + lidOffset, -tomb.height * 0.25);
          ctx.lineTo(-tomb.width * 0.1 + lidOffset, tomb.height * 0.25);
          ctx.stroke();

          ctx.restore();
        }
      }

      // 6. Massive Ruined Masonry Walls (Thick stone blocks with breaches & crumbles)
      if (r.walls) {
        for (const w of r.walls) {
          ctx.save();
          const dx = w.x2 - w.x1;
          const dy = w.y2 - w.y1;
          const len = Math.hypot(dx, dy);
          const ang = Math.atan2(dy, dx);
          const thick = w.thickness || 14;

          ctx.translate(w.x1, w.y1);
          ctx.rotate(ang);

          // Wall Cast Shadow
          ctx.fillStyle = 'rgba(20, 20, 20, 0.38)';
          ctx.fillRect(0, -thick * 0.5 + 4, len, thick + 4);

          // Solid Masonry Wall Fill
          ctx.fillStyle = '#4c473b';
          ctx.fillRect(0, -thick * 0.5, len, thick);

          // Top Stone Cap Layer
          ctx.fillStyle = '#827d6d';
          ctx.fillRect(0, -thick * 0.35, len, thick * 0.7);

          // Stone block joint lines along wall
          ctx.strokeStyle = '#2c2921';
          ctx.lineWidth = 1.2;
          const blockLen = 22;
          for (let bx = blockLen; bx < len; bx += blockLen) {
            ctx.beginPath();
            ctx.moveTo(bx, -thick * 0.5);
            ctx.lineTo(bx, thick * 0.5);
            ctx.stroke();
          }

          // Dark Ink Outlines
          ctx.strokeStyle = '#1e1c16';
          ctx.lineWidth = 2.2;
          ctx.strokeRect(0, -thick * 0.5, len, thick);

          // Fractured ragged ends at breaks
          ctx.fillStyle = '#3a362b';
          ctx.beginPath();
          ctx.arc(0, 0, thick * 0.45, 0, Math.PI * 2);
          ctx.arc(len, 0, thick * 0.45, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      }

      // 7. Corner Buttresses
      if (r.buttresses) {
        ctx.fillStyle = '#5a5445';
        ctx.strokeStyle = '#23201a';
        ctx.lineWidth = 2;
        for (const but of r.buttresses) {
          ctx.fillRect(but.x, but.y, but.w, but.h);
          ctx.strokeRect(but.x, but.y, but.w, but.h);
        }
      }

      // 8. Colonnades & Monumental Pillars
      if (r.pillars) {
        for (const pil of r.pillars) {
          ctx.save();
          // Square Plinth Shadow & Base
          const plSize = pil.plinthSize || 24;
          ctx.fillStyle = 'rgba(20, 20, 20, 0.32)';
          ctx.fillRect(pil.x - plSize * 0.5 + 3, pil.y - plSize * 0.5 + 3, plSize, plSize);

          ctx.fillStyle = '#8f8978';
          ctx.fillRect(pil.x - plSize * 0.5, pil.y - plSize * 0.5, plSize, plSize);
          ctx.strokeStyle = '#353127';
          ctx.lineWidth = 1.8;
          ctx.strokeRect(pil.x - plSize * 0.5, pil.y - plSize * 0.5, plSize, plSize);

          if (pil.isFallen) {
            // Fallen broken column drum segments
            ctx.save();
            ctx.translate(pil.x, pil.y);
            ctx.rotate(pil.fallenAngle);

            // Shadow
            ctx.fillStyle = 'rgba(20, 20, 20, 0.35)';
            ctx.fillRect(0, -pil.radius + 3, pil.fallenLength, pil.radius * 2);

            // Broken Cylindrical Shaft
            ctx.fillStyle = '#b3ad9c';
            ctx.fillRect(0, -pil.radius, pil.fallenLength, pil.radius * 2);
            ctx.strokeStyle = '#322e24';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, -pil.radius, pil.fallenLength, pil.radius * 2);

            // Drum segment fracture lines
            const drumLen = pil.fallenLength / 3;
            for (let d = 1; d <= 2; d++) {
              ctx.beginPath();
              ctx.moveTo(d * drumLen, -pil.radius);
              ctx.lineTo(d * drumLen, pil.radius);
              ctx.stroke();
            }
            ctx.restore();
          } else {
            // Standing Column: Torus base, fluted shaft, top capital
            // Outer torus ring
            ctx.fillStyle = '#a6a08f';
            ctx.beginPath();
            ctx.arc(pil.x, pil.y, pil.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#2d2920';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Inner fluted column core
            ctx.fillStyle = '#c7c1b0';
            ctx.beginPath();
            ctx.arc(pil.x, pil.y, pil.radius * 0.72, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#433e33';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Radial flute lines
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
              ctx.beginPath();
              ctx.moveTo(pil.x + Math.cos(a) * (pil.radius * 0.4), pil.y + Math.sin(a) * (pil.radius * 0.4));
              ctx.lineTo(pil.x + Math.cos(a) * (pil.radius * 0.72), pil.y + Math.sin(a) * (pil.radius * 0.72));
              ctx.stroke();
            }

            // Center eye
            ctx.fillStyle = '#4a4436';
            ctx.beginPath();
            ctx.arc(pil.x, pil.y, pil.radius * 0.22, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      // 9. Central Arcane Altar & Ritual Braziers
      if (r.altar) {
        ctx.save();
        // Altar Base Shadow
        ctx.fillStyle = 'rgba(20, 20, 20, 0.4)';
        ctx.fillRect(r.altar.x - r.altar.width * 0.5 + 4, r.altar.y - r.altar.height * 0.5 + 4, r.altar.width, r.altar.height);

        // Stone Altar Slab
        ctx.fillStyle = '#655f50';
        ctx.fillRect(r.altar.x - r.altar.width * 0.5, r.altar.y - r.altar.height * 0.5, r.altar.width, r.altar.height);
        ctx.strokeStyle = '#1c1a14';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(r.altar.x - r.altar.width * 0.5, r.altar.y - r.altar.height * 0.5, r.altar.width, r.altar.height);

        // Top polished stone slab
        ctx.fillStyle = '#878170';
        ctx.fillRect(r.altar.x - r.altar.width * 0.42, r.altar.y - r.altar.height * 0.42, r.altar.width * 0.84, r.altar.height * 0.84);
        ctx.strokeRect(r.altar.x - r.altar.width * 0.42, r.altar.y - r.altar.height * 0.42, r.altar.width * 0.84, r.altar.height * 0.84);

        // Glowing Arcane Ritual Glyph / Sigils
        ctx.strokeStyle = '#7ee8fa';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(r.altar.x, r.altar.y, 11, 0, Math.PI * 2);
        ctx.arc(r.altar.x, r.altar.y, 6, 0, Math.PI * 2);
        ctx.moveTo(r.altar.x - 14, r.altar.y);
        ctx.lineTo(r.altar.x + 14, r.altar.y);
        ctx.moveTo(r.altar.x, r.altar.y - 14);
        ctx.lineTo(r.altar.x, r.altar.y + 14);
        ctx.stroke();

        // Corner Braziers
        if (r.altar.braziers) {
          for (const bz of r.altar.braziers) {
            // Brazier glow
            const grad = ctx.createRadialGradient(bz.x, bz.y, 2, bz.x, bz.y, 22);
            grad.addColorStop(0, 'rgba(255, 160, 40, 0.45)');
            grad.addColorStop(1, 'rgba(255, 100, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(bz.x, bz.y, 22, 0, Math.PI * 2);
            ctx.fill();

            // Iron bowl
            ctx.fillStyle = '#302d24';
            ctx.beginPath();
            ctx.arc(bz.x, bz.y, bz.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#15130f';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Fire ember
            ctx.fillStyle = '#fbc531';
            ctx.beginPath();
            ctx.arc(bz.x, bz.y, bz.radius * 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // 10. Rubble Piles & Scattered Ashlar Blocks
      if (r.rubblePiles) {
        for (const rub of r.rubblePiles) {
          ctx.save();
          ctx.fillStyle = '#9b9482';
          ctx.strokeStyle = '#433f34';
          ctx.lineWidth = 1.2;
          for (let p = 0; p < rub.pebbleCount; p++) {
            const px = rub.x + Math.cos(p * 1.3) * (rub.radius * 0.6);
            const py = rub.y + Math.sin(p * 1.3) * (rub.radius * 0.6);
            ctx.beginPath();
            ctx.arc(px, py, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      if (r.ashlarBlocks) {
        for (const blk of r.ashlarBlocks) {
          ctx.save();
          ctx.translate(blk.x, blk.y);
          ctx.rotate(blk.angle);

          // Shadow
          ctx.fillStyle = 'rgba(20, 20, 20, 0.28)';
          ctx.fillRect(-blk.w * 0.5 + 2, -blk.h * 0.5 + 2, blk.w, blk.h);

          // Dressed Stone Block
          ctx.fillStyle = '#aba493';
          ctx.fillRect(-blk.w * 0.5, -blk.h * 0.5, blk.w, blk.h);
          ctx.strokeStyle = '#383329';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-blk.w * 0.5, -blk.h * 0.5, blk.w, blk.h);

          ctx.restore();
        }
      }

      ctx.restore();
    }
  }

  renderCliffs(ctx, map) {
    const biome = map.biome;
    for (const cliff of map.cliffs) {
      ctx.save();
      const pts = cliff.path;
      if (pts.length < 2) { ctx.restore(); continue; }

      // Cliff Edge Line
      ctx.strokeStyle = biome.rocks.stroke || '#4a463a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();

      // Perpendicular Hachure Teeth (indicating steep drop-off)
      ctx.strokeStyle = biome.rocks.hatch || '#666152';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i], p2 = pts[i + 1];
        const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const steps = Math.floor(segLen / 8);
        const nx = -(p2.y - p1.y) / segLen;
        const ny = (p2.x - p1.x) / segLen;

        for (let s = 0; s < steps; s++) {
          const t = s / steps;
          const sx = p1.x + (p2.x - p1.x) * t;
          const sy = p1.y + (p2.y - p1.y) * t;
          const toothLen = (s % 2 === 0) ? cliff.depth : cliff.depth * 0.6;

          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + nx * toothLen, sy + ny * toothLen);
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  renderClutter(ctx, map) {
    const clutter = map.clutter;
    if (!clutter) return;
    const biome = map.biome;

    // 1. Mud Puddles with Water Reflection and Ripple Rings
    if (clutter.puddles && clutter.puddles.length) {
      for (const pud of clutter.puddles) {
        ctx.save();
        ctx.translate(pud.x, pud.y);
        ctx.rotate(pud.angle);

        // Muddy rim
        ctx.fillStyle = biome.ground.dirt || '#bda783';
        ctx.beginPath();
        ctx.ellipse(0, 0, pud.rx + 3, pud.ry + 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Water surface
        ctx.fillStyle = biome.water.shallow || '#9bc8c2';
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.ellipse(0, 0, pud.rx, pud.ry, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ripple Ring
        ctx.strokeStyle = biome.water.foam || '#e6f3f5';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.ellipse(0, 0, pud.rx * 0.55, pud.ry * 0.55, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      }
    }

    // 2. Smooth Natural Pebbles & Gravel
    if (clutter.pebbles && clutter.pebbles.length) {
      ctx.save();
      ctx.fillStyle = biome.rocks.fill || '#b8b4a5';
      ctx.strokeStyle = biome.rocks.stroke || '#524e43';
      ctx.lineWidth = 1;

      for (const peb of clutter.pebbles) {
        for (let k = 0; k < peb.count; k++) {
          const ox = peb.x + Math.cos(k * 1.8) * (peb.radius * 2.2);
          const oy = peb.y + Math.sin(k * 1.8) * (peb.radius * 2.2);
          ctx.beginPath();
          ctx.arc(ox, oy, peb.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 3. Wild Grass Tufts (Stylized fine ink blade clusters)
    if (clutter.grassTufts && clutter.grassTufts.length) {
      ctx.save();
      ctx.strokeStyle = biome.ground.shadow || '#6d854c';
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';

      for (const tuft of clutter.grassTufts) {
        ctx.save();
        ctx.translate(tuft.x, tuft.y);
        ctx.rotate(tuft.angle);

        const h = tuft.height;
        ctx.beginPath();
        // Central blade
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(1, -h * 0.6, 0, -h);
        // Left blade
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-2, -h * 0.5, -4, -h * 0.85);
        // Right blade
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(2, -h * 0.5, 4, -h * 0.85);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    // 4. Wildflower & Herb Blossom Clusters
    if (clutter.flowers && clutter.flowers.length) {
      ctx.save();
      for (const fl of clutter.flowers) {
        ctx.fillStyle = fl.color;
        for (let p = 0; p < fl.count; p++) {
          const fx = fl.x + Math.cos(p * 1.4) * (p * 2.5);
          const fy = fl.y + Math.sin(p * 1.4) * (p * 2.5);
          ctx.beginPath();
          ctx.arc(fx, fy, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // 5. Woodland Mushrooms & Fungi Rings
    if (clutter.mushrooms && clutter.mushrooms.length) {
      ctx.save();
      for (const shroom of clutter.mushrooms) {
        ctx.fillStyle = shroom.capColor;
        ctx.strokeStyle = '#3e2e1e';
        ctx.lineWidth = 0.8;

        if (shroom.isFairyRing) {
          // Circular fairy ring formation
          const rRadius = 14;
          for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
            const mx = shroom.x + Math.cos(a) * rRadius;
            const my = shroom.y + Math.sin(a) * rRadius;
            ctx.beginPath();
            ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        } else {
          for (let c = 0; c < shroom.count; c++) {
            const mx = shroom.x + Math.cos(c * 2) * (c * 3);
            const my = shroom.y + Math.sin(c * 2) * (c * 3);
            ctx.beginPath();
            ctx.arc(mx, my, 2.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    // 6. Fallen Twigs & Forest Floor Sticks
    if (clutter.twigs && clutter.twigs.length) {
      ctx.save();
      ctx.strokeStyle = '#5a432b';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';

      for (const tw of clutter.twigs) {
        ctx.save();
        ctx.translate(tw.x, tw.y);
        ctx.rotate(tw.angle);
        ctx.beginPath();
        ctx.moveTo(-tw.length * 0.5, 0);
        ctx.lineTo(tw.length * 0.5, 0);
        // Small side branch
        ctx.moveTo(tw.length * 0.1, 0);
        ctx.lineTo(tw.length * 0.25, 4);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    // 7. Stone Trail Cairns
    if (clutter.cairns && clutter.cairns.length) {
      for (const crn of clutter.cairns) {
        ctx.save();
        ctx.translate(crn.x, crn.y);
        ctx.fillStyle = biome.rocks.fill || '#b0aba0';
        ctx.strokeStyle = biome.rocks.stroke || '#454137';
        ctx.lineWidth = 1.5;

        // Base stone
        ctx.beginPath();
        ctx.ellipse(0, 0, crn.size, crn.size * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Middle stone
        ctx.beginPath();
        ctx.ellipse(0, -crn.size * 0.4, crn.size * 0.7, crn.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Top stone
        ctx.beginPath();
        ctx.ellipse(0, -crn.size * 0.75, crn.size * 0.4, crn.size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }
    }

    // 8. Waterway Reeds & Water Lily Pads
    if (clutter.waterProps && clutter.waterProps.length) {
      ctx.save();
      for (const wp of clutter.waterProps) {
        if (wp.type === 'lily_pad') {
          // Green circular lily pad with small pie slice notch
          ctx.fillStyle = '#527c3a';
          ctx.strokeStyle = '#274316';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(wp.x, wp.y, wp.size, 0.3, Math.PI * 2);
          ctx.lineTo(wp.x, wp.y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Tiny pink/white blossom
          ctx.fillStyle = '#f8a5c2';
          ctx.beginPath();
          ctx.arc(wp.x + 2, wp.y + 1, wp.size * 0.35, 0, Math.PI * 2);
          ctx.fill();
        } else if (wp.type === 'reeds') {
          ctx.strokeStyle = '#5a7a38';
          ctx.lineWidth = 1.5;
          for (let r = -2; r <= 2; r++) {
            ctx.beginPath();
            ctx.moveTo(wp.x + r * 3, wp.y);
            ctx.lineTo(wp.x + r * 5, wp.y - wp.size * 1.5);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
  }

  renderCamp(ctx, camp, biome) {
    ctx.save();

    // Tents
    for (const tent of camp.tents) {
      ctx.save();
      ctx.translate(tent.x, tent.y);
      ctx.rotate(tent.angle);

      // Tent Shadow
      ctx.fillStyle = 'rgba(20, 20, 20, 0.3)';
      ctx.fillRect(-tent.w * 0.5 + 4, -tent.h * 0.5 + 4, tent.w, tent.h);

      // Canvas fabric
      ctx.fillStyle = '#dcd3be';
      ctx.fillRect(-tent.w * 0.5, -tent.h * 0.5, tent.w, tent.h);
      ctx.strokeStyle = '#5a4f3b';
      ctx.lineWidth = 2;
      ctx.strokeRect(-tent.w * 0.5, -tent.h * 0.5, tent.w, tent.h);

      // Ridge center line
      ctx.strokeStyle = '#3e3525';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-tent.w * 0.5, 0);
      ctx.lineTo(tent.w * 0.5, 0);
      ctx.stroke();

      // Guy ropes
      ctx.strokeStyle = '#8a7d65';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-tent.w * 0.5, -tent.h * 0.5); ctx.lineTo(-tent.w * 0.7, -tent.h * 0.7);
      ctx.moveTo(tent.w * 0.5, -tent.h * 0.5); ctx.lineTo(tent.w * 0.7, -tent.h * 0.7);
      ctx.moveTo(-tent.w * 0.5, tent.h * 0.5); ctx.lineTo(-tent.w * 0.7, tent.h * 0.7);
      ctx.moveTo(tent.w * 0.5, tent.h * 0.5); ctx.lineTo(tent.w * 0.7, tent.h * 0.7);
      ctx.stroke();

      ctx.restore();
    }

    // Props: Log benches
    for (const prop of camp.props) {
      if (prop.type === 'log') {
        ctx.fillStyle = '#7a5a38';
        ctx.fillRect(prop.x - prop.w * 0.5, prop.y - prop.h * 0.5, prop.w, prop.h);
        ctx.strokeStyle = '#3e2b17';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(prop.x - prop.w * 0.5, prop.y - prop.h * 0.5, prop.w, prop.h);
      } else if (prop.type === 'crate_cluster') {
        for (let i = 0; i < prop.count; i++) {
          const cx = prop.x + (i % 2) * 16;
          const cy = prop.y + Math.floor(i / 2) * 16;
          ctx.fillStyle = '#8c704f';
          ctx.fillRect(cx, cy, 14, 14);
          ctx.strokeStyle = '#423321';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(cx, cy, 14, 14);
        }
      }
    }

    // Central Campfire
    const cf = camp.campfire;
    // Outer warm light glow
    const grad = ctx.createRadialGradient(cf.x, cf.y, 4, cf.x, cf.y, cf.lightRadius);
    grad.addColorStop(0, 'rgba(255, 180, 50, 0.5)');
    grad.addColorStop(0.5, 'rgba(255, 120, 20, 0.25)');
    grad.addColorStop(1, 'rgba(255, 80, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cf.x, cf.y, cf.lightRadius, 0, Math.PI * 2);
    ctx.fill();

    // Fire pit stones circle
    ctx.fillStyle = '#6a6459';
    for (let a = 0; a < Math.PI * 2; a += 0.7) {
      const sx = cf.x + Math.cos(a) * cf.radius;
      const sy = cf.y + Math.sin(a) * cf.radius;
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Burning Logs & Fire Core
    ctx.fillStyle = '#e84118';
    ctx.beginPath();
    ctx.arc(cf.x, cf.y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fbc531';
    ctx.beginPath();
    ctx.arc(cf.x, cf.y, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  renderRocks(ctx, map) {
    const biome = map.biome;
    for (const rock of map.rocks) {
      ctx.save();
      ctx.translate(rock.x, rock.y);

      // Ground Shadow
      ctx.fillStyle = 'rgba(20, 20, 20, 0.28)';
      ctx.beginPath();
      ctx.ellipse(3, 4, rock.radius * 1.1, rock.radius * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rock Facet Fill
      ctx.fillStyle = biome.rocks.fill;
      ctx.beginPath();
      const pts = rock.shape;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.closePath();
      ctx.fill();

      // Hatching on shadow half
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = biome.rocks.hatch;
      ctx.lineWidth = 1.2;
      for (let h = -rock.radius; h < rock.radius; h += 4) {
        ctx.beginPath();
        ctx.moveTo(h, 0);
        ctx.lineTo(h + 8, rock.radius);
        ctx.stroke();
      }
      ctx.restore();

      // Outer Ink Stroke
      ctx.strokeStyle = biome.rocks.stroke;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
    }
  }

  renderFallenLogs(ctx, logs) {
    for (const log of logs) {
      ctx.save();
      ctx.translate(log.x, log.y);
      ctx.rotate(log.angle);

      // Shadow
      ctx.fillStyle = 'rgba(20, 20, 20, 0.25)';
      ctx.fillRect(-log.length * 0.5 + 3, -log.thickness * 0.5 + 3, log.length, log.thickness);

      // Bark
      ctx.fillStyle = '#614931';
      ctx.fillRect(-log.length * 0.5, -log.thickness * 0.5, log.length, log.thickness);
      ctx.strokeStyle = '#302213';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-log.length * 0.5, -log.thickness * 0.5, log.length, log.thickness);

      // Moss patch on top
      ctx.fillStyle = '#7a964d';
      ctx.fillRect(-log.length * 0.2, -log.thickness * 0.5, log.length * 0.4, log.thickness * 0.4);

      ctx.restore();
    }
  }

  renderTrees(ctx, map) {
    const biome = map.biome;

    // 0. Render undergrowth bushes & shrubs in forest thickets
    if (map.bushes && map.bushes.length) {
      for (const bush of map.bushes) {
        ctx.save();
        ctx.translate(bush.x, bush.y);

        // Shadow
        ctx.fillStyle = biome.trees.shadow;
        ctx.beginPath();
        ctx.arc(2, 3, bush.radius * 0.9, 0, Math.PI * 2);
        ctx.fill();

        // Bush Foliage
        const bushColor = biome.trees.foliage[bush.colorIndex % biome.trees.foliage.length];
        ctx.fillStyle = bushColor;
        ctx.beginPath();
        ctx.arc(0, 0, bush.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = biome.trees.stroke;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.restore();
      }
    }

    for (const tree of map.trees) {
      ctx.save();
      ctx.translate(tree.x, tree.y);

      // 1. Soft Clustered Shadow on ground (Watabou style offset south)
      ctx.fillStyle = biome.trees.shadow;
      ctx.beginPath();
      ctx.ellipse(tree.radius * 0.25, tree.radius * 0.4, tree.radius * 1.1, tree.radius * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Trunk Anchor
      ctx.fillStyle = biome.trees.trunk;
      ctx.beginPath();
      ctx.arc(0, 0, tree.radius * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1e140d';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 3. Canopy rendering by tree type
      const color = biome.trees.foliage[tree.colorIndex % biome.trees.foliage.length];

      if (tree.type === 'pine') {
        // Pine Tree: Tiered triangular canopy layers
        for (let t = tree.canopyBlobs.length - 1; t >= 0; t--) {
          const blob = tree.canopyBlobs[t];
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(blob.x, blob.y, blob.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = biome.trees.stroke;
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // Snow cap
          if (biome.trees.snowCap) {
            ctx.fillStyle = biome.trees.snowCap;
            ctx.beginPath();
            ctx.arc(blob.x, blob.y - blob.r * 0.3, blob.r * 0.5, Math.PI, Math.PI * 2);
            ctx.fill();
          }
        }
      } else {
        // Watabou Deciduous / Swamp Clump: Overlapping leafy lobes
        ctx.fillStyle = color;

        // Base canopy mass
        ctx.beginPath();
        for (const blob of tree.canopyBlobs) {
          ctx.moveTo(blob.x + blob.r, blob.y);
          ctx.arc(blob.x, blob.y, blob.r, 0, Math.PI * 2);
        }
        ctx.fill();

        // Shaded lower half of canopy
        ctx.save();
        ctx.beginPath();
        for (const blob of tree.canopyBlobs) {
          ctx.moveTo(blob.x + blob.r, blob.y);
          ctx.arc(blob.x, blob.y, blob.r, 0, Math.PI * 2);
        }
        ctx.clip();

        ctx.fillStyle = 'rgba(10, 25, 5, 0.22)';
        ctx.fillRect(-tree.radius * 1.5, 0, tree.radius * 3, tree.radius * 2);
        ctx.restore();

        // Ink outlines for each leafy scallop
        ctx.strokeStyle = biome.trees.stroke;
        ctx.lineWidth = 1.8;
        for (const blob of tree.canopyBlobs) {
          ctx.beginPath();
          ctx.arc(blob.x, blob.y, blob.r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  renderAtmosphere(ctx, map, W, H) {
    const light = map.lighting || 'day';

    if (light === 'dusk') {
      // Golden hour sunset warm amber glow
      ctx.save();
      ctx.fillStyle = 'rgba(255, 140, 40, 0.18)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(140, 40, 80, 0.12)';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    } else if (light === 'night') {
      // Dark moody night overlay with darkness punch-outs
      ctx.save();
      ctx.fillStyle = 'rgba(12, 18, 38, 0.68)';
      ctx.fillRect(0, 0, W, H);

      // Punch out light circles around campfires & houses
      ctx.globalCompositeOperation = 'destination-out';
      if (map.camp) {
        const cf = map.camp.campfire;
        const grad = ctx.createRadialGradient(cf.x, cf.y, 10, cf.x, cf.y, cf.lightRadius * 1.2);
        grad.addColorStop(0, 'rgba(0,0,0,0.85)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cf.x, cf.y, cf.lightRadius * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const b of map.buildings) {
        const grad = ctx.createRadialGradient(b.x + b.width * 0.5, b.y + b.height * 0.5, 20, b.x + b.width * 0.5, b.y + b.height * 0.5, 90);
        grad.addColorStop(0, 'rgba(0,0,0,0.7)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x + b.width * 0.5, b.y + b.height * 0.5, 90, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (light === 'fog') {
      // Thick misty fog
      ctx.save();
      ctx.fillStyle = 'rgba(220, 230, 235, 0.35)';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    } else if (light === 'rain') {
      // Rainy weather streaks
      ctx.save();
      ctx.fillStyle = 'rgba(70, 95, 120, 0.22)';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(200, 225, 255, 0.35)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 180; i++) {
        const rx = (i * 37) % W;
        const ry = (i * 59) % H;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 8, ry + 16);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  renderMountains(ctx, map) {
    const biome = map.biome;
    const isWinter = map.biomeId === 'winter';
    const isDesert = map.biomeId === 'desert';

    for (const m of map.mountains) {
      ctx.save();

      // 1. Soft mountain base elevation shadow
      ctx.beginPath();
      ctx.arc(m.cx, m.cy, m.baseRadius * 1.15, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
      ctx.fill();

      // 2. Mountain Massif Peaks
      for (const peak of m.peaks) {
        if (!peak.ridgePoints || !peak.ridgePoints.length) continue;

        // Base peak polygon fill
        ctx.beginPath();
        ctx.moveTo(peak.ridgePoints[0].x, peak.ridgePoints[0].y);
        for (let i = 1; i < peak.ridgePoints.length; i++) {
          ctx.lineTo(peak.ridgePoints[i].x, peak.ridgePoints[i].y);
        }
        ctx.closePath();

        // Shaded gradient: illuminated facet vs shadow facet
        const grad = ctx.createLinearGradient(peak.x - peak.radius, peak.y - peak.radius, peak.x + peak.radius, peak.y + peak.radius);
        if (isWinter) {
          grad.addColorStop(0, '#e2e8f0');
          grad.addColorStop(0.5, '#cbd5e1');
          grad.addColorStop(1, '#94a3b8');
        } else if (isDesert) {
          grad.addColorStop(0, '#d97706');
          grad.addColorStop(0.5, '#b45309');
          grad.addColorStop(1, '#78350f');
        } else {
          grad.addColorStop(0, '#71717a');
          grad.addColorStop(0.5, '#52525b');
          grad.addColorStop(1, '#27272a');
        }

        ctx.fillStyle = grad;
        ctx.fill();

        // Jagged mountain ridge ink outline
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 2.4;
        ctx.stroke();

        // Shading hachures on shadow side
        ctx.save();
        ctx.clip(); // clip to mountain peak polygon
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 1.4;
        const hatchStep = 8;
        for (let h = -peak.radius; h <= peak.radius; h += hatchStep) {
          ctx.beginPath();
          ctx.moveTo(peak.x + h, peak.y - peak.radius);
          ctx.lineTo(peak.x + h + 24, peak.y + peak.radius);
          ctx.stroke();
        }
        ctx.restore();

        // Mountain Peak Summit symbol (crag crest)
        ctx.beginPath();
        ctx.moveTo(peak.x - 14, peak.y + 6);
        ctx.lineTo(peak.x, peak.y - 12);
        ctx.lineTo(peak.x + 14, peak.y + 6);
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 3. Scree & Talus field stones at foot of mountain
      for (const sc of m.scree) {
        ctx.save();
        ctx.translate(sc.x, sc.y);
        ctx.rotate(sc.angle);

        ctx.fillStyle = isWinter ? '#cbd5e1' : isDesert ? '#b45309' : '#52525b';
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 1.2;

        ctx.beginPath();
        ctx.moveTo(-sc.r, 0);
        ctx.lineTo(0, -sc.r * 0.7);
        ctx.lineTo(sc.r, 0);
        ctx.lineTo(0, sc.r * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }

      ctx.restore();
    }
  }

  renderPOIs(ctx, map) {
    for (const poi of map.pois) {
      switch (poi.type) {
        case 'cave_entrance':
          this.renderCaveEntrance(ctx, poi);
          break;
        case 'ancient_altar':
          this.renderAncientAltar(ctx, poi);
          break;
        case 'smuggler_cache':
          this.renderSmugglerCache(ctx, poi);
          break;
        case 'forgotten_crypt':
          this.renderForgottenCrypt(ctx, poi);
          break;
        case 'treehouse_lookout':
          this.renderTreehouseLookout(ctx, poi);
          break;
        case 'witch_hut':
          this.renderWitchHut(ctx, poi);
          break;
        case 'stone_henge':
          this.renderStoneHenge(ctx, poi);
          break;
        case 'ruined_watchtower':
          this.renderRuinedWatchtower(ctx, poi);
          break;
        case 'monster_nest':
          this.renderMonsterNest(ctx, poi);
          break;
        case 'cursed_statue':
          this.renderCursedStatue(ctx, poi);
          break;
        case 'fairy_spring':
          this.renderFairySpring(ctx, poi);
          break;
        case 'gallows_crossroad':
        default:
          this.renderGallowsCrossroad(ctx, poi);
          break;
      }
    }
  }

  renderCaveEntrance(ctx, poi) {
    ctx.save();
    ctx.translate(poi.x, poi.y);
    ctx.rotate(poi.angle || 0);

    // 1. Rock Facade surrounding cave mouth
    if (poi.rockRim && poi.rockRim.length) {
      ctx.beginPath();
      ctx.moveTo(poi.rockRim[0].x, poi.rockRim[0].y);
      for (let i = 1; i < poi.rockRim.length; i++) {
        ctx.lineTo(poi.rockRim[i].x, poi.rockRim[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = '#3f3f46';
      ctx.fill();
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }

    // 2. Cavern Opening (Pitch black darkness depth gradient)
    const mouthW = poi.mouthWidth;
    const mouthD = poi.mouthDepth;

    ctx.beginPath();
    ctx.ellipse(0, 0, mouthW * 0.5, mouthD * 0.5, 0, Math.PI, Math.PI * 2);
    const darkGrad = ctx.createRadialGradient(0, -mouthD * 0.3, 2, 0, 0, mouthW * 0.6);
    darkGrad.addColorStop(0, '#000000');
    darkGrad.addColorStop(0.7, '#09090b');
    darkGrad.addColorStop(1, '#18181b');
    ctx.fillStyle = darkGrad;
    ctx.fill();
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 3. Stalagmites / Jagged teeth inside entrance
    if (poi.stalagmites) {
      ctx.fillStyle = '#52525b';
      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = 1;
      for (const st of poi.stalagmites) {
        ctx.beginPath();
        ctx.moveTo(st.x - st.r * 0.5, st.y);
        ctx.lineTo(st.x, st.y - st.r * 1.5);
        ctx.lineTo(st.x + st.r * 0.5, st.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // 4. Wooden Support Timbers (Lintel & Posts)
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.4;
    // Left post
    ctx.fillRect(-mouthW * 0.52, -mouthD * 0.4, 6, mouthD * 0.5);
    ctx.strokeRect(-mouthW * 0.52, -mouthD * 0.4, 6, mouthD * 0.5);
    // Right post
    ctx.fillRect(mouthW * 0.52 - 6, -mouthD * 0.4, 6, mouthD * 0.5);
    ctx.strokeRect(mouthW * 0.52 - 6, -mouthD * 0.4, 6, mouthD * 0.5);
    // Crossbeam
    ctx.fillRect(-mouthW * 0.55, -mouthD * 0.45, mouthW * 1.1, 7);
    ctx.strokeRect(-mouthW * 0.55, -mouthD * 0.45, mouthW * 1.1, 7);

    // 5. Flaming Torches on sconces
    if (poi.torches) {
      for (const tc of poi.torches) {
        // Torch bracket
        ctx.fillStyle = '#27272a';
        ctx.fillRect(tc.x - 2, tc.y - 4, 4, 10);

        // Torch light glow
        const fGrad = ctx.createRadialGradient(tc.x, tc.y, 2, tc.x, tc.y, 24);
        fGrad.addColorStop(0, 'rgba(251, 146, 60, 0.9)');
        fGrad.addColorStop(0.4, 'rgba(234, 88, 12, 0.4)');
        fGrad.addColorStop(1, 'rgba(234, 88, 12, 0)');
        ctx.fillStyle = fGrad;
        ctx.beginPath();
        ctx.arc(tc.x, tc.y, 24, 0, Math.PI * 2);
        ctx.fill();

        // Flame core
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(tc.x, tc.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 6. Bones & skull props at entrance
    if (poi.hasBones) {
      ctx.fillStyle = '#f4f4f5';
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 0.8;
      // Skull
      ctx.beginPath();
      ctx.arc(mouthW * 0.35, mouthD * 0.2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Ribs
      ctx.beginPath();
      ctx.moveTo(-mouthW * 0.3, mouthD * 0.25);
      ctx.lineTo(-mouthW * 0.2, mouthD * 0.15);
      ctx.stroke();
    }

    ctx.restore();
  }

  renderAncientAltar(ctx, poi) {
    ctx.save();
    ctx.translate(poi.x, poi.y);

    // 1. Arcane Ground Rune Circle
    ctx.strokeStyle = poi.runeColor || '#8b5cf6';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, poi.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, poi.radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();

    // Radial sigil rays
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (poi.radius * 0.7), Math.sin(a) * (poi.radius * 0.7));
      ctx.lineTo(Math.cos(a) * poi.radius, Math.sin(a) * poi.radius);
      ctx.stroke();
    }

    // 2. Corner Stone Monoliths
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const mx = Math.cos(a) * (poi.radius * 0.9);
      const my = Math.sin(a) * (poi.radius * 0.9);

      ctx.fillStyle = '#52525b';
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 1.5;
      ctx.fillRect(mx - 7, my - 7, 14, 14);
      ctx.strokeRect(mx - 7, my - 7, 14, 14);
    }

    // 3. Central Altar Stone Slab
    ctx.fillStyle = '#3f3f46';
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2;
    ctx.fillRect(-poi.slabWidth * 0.5, -poi.slabHeight * 0.5, poi.slabWidth, poi.slabHeight);
    ctx.strokeRect(-poi.slabWidth * 0.5, -poi.slabHeight * 0.5, poi.slabWidth, poi.slabHeight);

    // Bloodstain on altar
    if (poi.bloodStain) {
      ctx.fillStyle = 'rgba(153, 27, 27, 0.75)';
      ctx.beginPath();
      ctx.ellipse(4, -2, 12, 6, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Burning Braziers
    if (poi.braziers) {
      for (const b of poi.braziers) {
        // Brazier bowl
        ctx.fillStyle = '#27272a';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Fire glow
        const bGrad = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, 20);
        bGrad.addColorStop(0, 'rgba(249, 115, 22, 0.9)');
        bGrad.addColorStop(0.5, 'rgba(234, 88, 12, 0.3)');
        bGrad.addColorStop(1, 'rgba(234, 88, 12, 0)');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  renderSmugglerCache(ctx, poi) {
    ctx.save();
    ctx.translate(poi.x, poi.y);

    // 1. Cache ground tarp
    if (poi.tarp) {
      ctx.fillStyle = 'rgba(63, 63, 70, 0.75)';
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1.2;
      ctx.fillRect(poi.tarp.x, poi.tarp.y, poi.tarp.w, poi.tarp.h);
      ctx.strokeRect(poi.tarp.x, poi.tarp.y, poi.tarp.w, poi.tarp.h);
    }

    // 2. Barrels
    for (const b of poi.barrels) {
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Barrel bung & iron hoops
      ctx.strokeStyle = '#52525b';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3. Crates
    for (const c of poi.crates) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle || 0);

      ctx.fillStyle = '#92400e';
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1.4;
      ctx.fillRect(-c.w * 0.5, -c.h * 0.5, c.w, c.h);
      ctx.strokeRect(-c.w * 0.5, -c.h * 0.5, c.w, c.h);

      // Diagonal crate brace
      ctx.beginPath();
      ctx.moveTo(-c.w * 0.5, -c.h * 0.5);
      ctx.lineTo(c.w * 0.5, c.h * 0.5);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Treasure Chests
    for (const ch of poi.chests) {
      ctx.save();
      ctx.translate(ch.x, ch.y);
      ctx.rotate(ch.angle || 0);

      // Chest body
      ctx.fillStyle = '#713f12';
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 1.6;
      ctx.fillRect(-ch.w * 0.5, -ch.h * 0.5, ch.w, ch.h);
      ctx.strokeRect(-ch.w * 0.5, -ch.h * 0.5, ch.w, ch.h);

      // Golden metal banding & lock clasp
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(-ch.w * 0.5, -ch.h * 0.5, 3, ch.h);
      ctx.fillRect(ch.w * 0.5 - 3, -ch.h * 0.5, 3, ch.h);
      ctx.fillRect(-2, -ch.h * 0.5, 4, 5); // Lock latch

      ctx.restore();
    }

    // 5. Lit Lantern
    if (poi.lantern && poi.lantern.lit) {
      const lx = poi.lantern.x;
      const ly = poi.lantern.y;
      const lGrad = ctx.createRadialGradient(lx, ly, 2, lx, ly, 30);
      lGrad.addColorStop(0, 'rgba(253, 224, 71, 0.9)');
      lGrad.addColorStop(0.4, 'rgba(234, 179, 8, 0.3)');
      lGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
      ctx.fillStyle = lGrad;
      ctx.beginPath();
      ctx.arc(lx, ly, 30, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.fillRect(lx - 2, ly - 3, 4, 6);
    }

    ctx.restore();
  }

  renderForgottenCrypt(ctx, poi) {
    ctx.save();
    ctx.translate(poi.x, poi.y);

    // 1. Grassy / Earth Barrow Mound
    ctx.beginPath();
    ctx.ellipse(0, 0, poi.moundWidth * 0.5, poi.moundHeight * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#3f3f46';
    ctx.fill();
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // 2. Stone Crypt Entrance Facade
    ctx.fillStyle = '#52525b';
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2;
    ctx.fillRect(-poi.cryptWidth * 0.5, -poi.cryptHeight * 0.5, poi.cryptWidth, poi.cryptHeight);
    ctx.strokeRect(-poi.cryptWidth * 0.5, -poi.cryptHeight * 0.5, poi.cryptWidth, poi.cryptHeight);

    // Heavy Iron Portcullis Grating
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2;
    const gateW = poi.cryptWidth * 0.6;
    for (let x = -gateW * 0.5; x <= gateW * 0.5; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, -poi.cryptHeight * 0.5);
      ctx.lineTo(x, poi.cryptHeight * 0.5);
      ctx.stroke();
    }

    // 3. Tombstones
    if (poi.tombstones) {
      for (const ts of poi.tombstones) {
        ctx.fillStyle = '#71717a';
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(ts.x, ts.y, ts.w * 0.5, ts.h * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Carved cross/skull rune
        ctx.beginPath();
        ctx.moveTo(ts.x, ts.y - 4);
        ctx.lineTo(ts.x, ts.y + 4);
        ctx.moveTo(ts.x - 3, ts.y - 1);
        ctx.lineTo(ts.x + 3, ts.y - 1);
        ctx.stroke();
      }
    }

    // 4. Hero's Sword embedded in stone
    if (poi.heroSword) {
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.2;
      // Crossguard
      ctx.fillRect(-6, poi.moundHeight * 0.35 - 2, 12, 3);
      // Blade
      ctx.beginPath();
      ctx.moveTo(0, poi.moundHeight * 0.35);
      ctx.lineTo(0, poi.moundHeight * 0.35 + 18);
      ctx.stroke();
    }

    ctx.restore();
  }

  renderTreehouseLookout(ctx, poi) {
    ctx.save();
    ctx.translate(poi.x, poi.y);

    // 1. Massive Tree Trunk Base
    ctx.beginPath();
    ctx.arc(0, 0, poi.trunkRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#78350f';
    ctx.fill();
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // 2. Wooden Lookout Platform Deck
    ctx.fillStyle = '#b45309';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.fillRect(-poi.platformWidth * 0.5, -poi.platformHeight * 0.5, poi.platformWidth, poi.platformHeight);
    ctx.strokeRect(-poi.platformWidth * 0.5, -poi.platformHeight * 0.5, poi.platformWidth, poi.platformHeight);

    // Deck planks
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1;
    for (let y = -poi.platformHeight * 0.5 + 8; y < poi.platformHeight * 0.5; y += 8) {
      ctx.beginPath();
      ctx.moveTo(-poi.platformWidth * 0.5, y);
      ctx.lineTo(poi.platformWidth * 0.5, y);
      ctx.stroke();
    }

    // Railing perimeter posts
    ctx.fillStyle = '#451a03';
    ctx.fillRect(-poi.platformWidth * 0.5, -poi.platformHeight * 0.5, 6, 6);
    ctx.fillRect(poi.platformWidth * 0.5 - 6, -poi.platformHeight * 0.5, 6, 6);
    ctx.fillRect(-poi.platformWidth * 0.5, poi.platformHeight * 0.5 - 6, 6, 6);
    ctx.fillRect(poi.platformWidth * 0.5 - 6, poi.platformHeight * 0.5 - 6, 6, 6);

    // 3. Rope Ladder dangling down
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.4;
    const ladX = 0;
    const ladY = poi.platformHeight * 0.5;
    ctx.beginPath();
    ctx.moveTo(ladX - 6, ladY);
    ctx.lineTo(ladX - 6, ladY + poi.ropeLadder.length);
    ctx.moveTo(ladX + 6, ladY);
    ctx.lineTo(ladX + 6, ladY + poi.ropeLadder.length);
    ctx.stroke();

    // Ladder rungs
    for (let r = 6; r < poi.ropeLadder.length; r += 6) {
      ctx.beginPath();
      ctx.moveTo(ladX - 6, ladY + r);
      ctx.lineTo(ladX + 6, ladY + r);
      ctx.stroke();
    }

    // 4. Map table on deck
    if (poi.mapTable) {
      ctx.fillStyle = '#fef08a';
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1;
      ctx.fillRect(-10, -10, 20, 14);
      ctx.strokeRect(-10, -10, 20, 14);
    }

    ctx.restore();
  }

  renderWitchHut(ctx, poi) {
    ctx.save();
    ctx.translate(poi.x, poi.y);
    ctx.rotate(poi.angle || 0);

    // 1. Crooked Hut Body
    ctx.fillStyle = '#451a03';
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2.2;
    ctx.fillRect(-poi.width * 0.5, -poi.height * 0.5, poi.width, poi.height);
    ctx.strokeRect(-poi.width * 0.5, -poi.height * 0.5, poi.width, poi.height);

    // Thatch roof ridges
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.2;
    for (let x = -poi.width * 0.5 + 6; x < poi.width * 0.5; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, -poi.height * 0.5);
      ctx.lineTo(x, poi.height * 0.5);
      ctx.stroke();
    }

    // 2. Chimney with purple smoke
    ctx.fillStyle = '#52525b';
    ctx.fillRect(poi.width * 0.25, -poi.height * 0.5 - 4, 8, 8);
    ctx.strokeRect(poi.width * 0.25, -poi.height * 0.5 - 4, 8, 8);

    ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
    ctx.beginPath();
    ctx.arc(poi.width * 0.25 + 4, -poi.height * 0.5 - 14, 8, 0, Math.PI * 2);
    ctx.arc(poi.width * 0.25 + 8, -poi.height * 0.5 - 24, 12, 0, Math.PI * 2);
    ctx.fill();

    // 3. Bubbling Iron Cauldron outside
    if (poi.cauldron) {
      const cx = poi.cauldron.x - poi.x;
      const cy = poi.cauldron.y - poi.y;

      // Cauldron bowl
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.arc(cx, cy, poi.cauldron.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Green bubbling potion glow
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(cx, cy, poi.cauldron.r * 0.7, 0, Math.PI * 2);
      ctx.fill();

      // Bubbles
      ctx.fillStyle = '#86efac';
      ctx.beginPath();
      ctx.arc(cx - 2, cy - 2, 2, 0, Math.PI * 2);
      ctx.arc(cx + 3, cy + 1, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  renderStoneHenge(ctx, poi) {
    ctx.save();
    ctx.translate(poi.x, poi.y);

    // 1. Outer Megalith Circle
    for (const m of poi.monoliths) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.angle);

      ctx.fillStyle = '#52525b';
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 1.8;
      ctx.fillRect(-m.w * 0.5, -m.h * 0.5, m.w, m.h);
      ctx.strokeRect(-m.w * 0.5, -m.h * 0.5, m.w, m.h);

      ctx.restore();
    }

    // 2. Arcane Leyline Spiral
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.2) {
      const r = (a / (Math.PI * 4)) * (poi.radius * 0.65);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 3. Floating Elemental Core Crystal
    if (poi.floatingCrystal) {
      const cGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 32);
      cGrad.addColorStop(0, 'rgba(56, 189, 248, 0.95)');
      cGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.4)');
      cGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.fill();

      // Diamond crystal shape
      ctx.fillStyle = '#e0f2fe';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, -poi.floatingCrystal.r * 1.4);
      ctx.lineTo(poi.floatingCrystal.r, 0);
      ctx.lineTo(0, poi.floatingCrystal.r * 1.4);
      ctx.lineTo(-poi.floatingCrystal.r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  renderRuinedWatchtower(ctx, poi) {
    ctx.save();
    ctx.translate(poi.x, poi.y);

    // 1. Circular Outer Masonry Wall with Breached Arc
    ctx.beginPath();
    ctx.arc(0, 0, poi.radius, poi.breachAngle + poi.breachArc, poi.breachAngle);
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = poi.wallThickness;
    ctx.stroke();

    // Wall fill
    ctx.beginPath();
    ctx.arc(0, 0, poi.radius, poi.breachAngle + poi.breachArc, poi.breachAngle);
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = poi.wallThickness - 2;
    ctx.stroke();

    // 2. Spiral Stone Staircase
    if (poi.spiralStairs) {
      ctx.strokeStyle = '#71717a';
      ctx.lineWidth = 1.6;
      for (let s = 0; s < 6; s++) {
        const a = (s / 6) * Math.PI * 1.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
        ctx.lineTo(Math.cos(a) * (poi.radius - 8), Math.sin(a) * (poi.radius - 8));
        ctx.stroke();
      }
    }

    // 3. Loot Crate / Chest inside
    if (poi.lootCrate) {
      ctx.fillStyle = '#ca8a04';
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.2;
      ctx.fillRect(-6, -6, 12, 12);
      ctx.strokeRect(-6, -6, 12, 12);
    }

    ctx.restore();
  }

  renderMonsterNest(ctx, poi) {
    ctx.save();
    ctx.translate(poi.x, poi.y);

    // 1. Woven Nest Rim
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, poi.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner nest depression
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(0, 0, poi.radius - 4, 0, Math.PI * 2);
    ctx.fill();

    // 2. Giant Speckled Eggs
    for (const egg of poi.eggs) {
      ctx.fillStyle = egg.color || '#fef08a';
      ctx.strokeStyle = '#713f12';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(egg.x, egg.y, egg.r * 0.8, egg.r, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Speckles
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.arc(egg.x - 2, egg.y - 1, 1, 0, Math.PI * 2);
      ctx.arc(egg.x + 1, egg.y + 2, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Bones and Rusty Gear
    ctx.fillStyle = '#f4f4f5';
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(-poi.radius * 0.5, poi.radius * 0.5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  renderCursedStatue(ctx, poi) {
    ctx.save();
    ctx.translate(poi.x, poi.y);

    // 1. Cracked Plinth Base
    ctx.fillStyle = '#52525b';
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2;
    ctx.fillRect(-poi.plinthWidth * 0.5, -poi.plinthHeight * 0.5, poi.plinthWidth, poi.plinthHeight);
    ctx.strokeRect(-poi.plinthWidth * 0.5, -poi.plinthHeight * 0.5, poi.plinthWidth, poi.plinthHeight);

    // Plinth cracks
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-poi.plinthWidth * 0.3, -poi.plinthHeight * 0.3);
    ctx.lineTo(0, 0);
    ctx.lineTo(poi.plinthWidth * 0.3, poi.plinthHeight * 0.2);
    ctx.stroke();

    // 2. Statue Torso & Head
    ctx.fillStyle = '#71717a';
    ctx.beginPath();
    ctx.arc(0, 0, poi.statueRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing Curse Eyes
    ctx.fillStyle = poi.eyeColor || '#a855f7';
    ctx.beginPath();
    ctx.arc(-4, -2, 2.5, 0, Math.PI * 2);
    ctx.arc(4, -2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Eye glow
    const eGrad = ctx.createRadialGradient(0, -2, 2, 0, -2, 16);
    eGrad.addColorStop(0, 'rgba(168, 85, 247, 0.7)');
    eGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
    ctx.fillStyle = eGrad;
    ctx.beginPath();
    ctx.arc(0, -2, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  renderFairySpring(ctx, poi) {
    ctx.save();
    ctx.translate(poi.x, poi.y);

    // 1. Crystal Water Pool
    const wGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, poi.poolRadius);
    wGrad.addColorStop(0, '#38bdf8');
    wGrad.addColorStop(0.7, '#0284c7');
    wGrad.addColorStop(1, '#0369a1');
    ctx.fillStyle = wGrad;
    ctx.beginPath();
    ctx.arc(0, 0, poi.poolRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 2. Magic Water Lilies
    ctx.fillStyle = '#f472b6';
    ctx.strokeStyle = '#db2777';
    ctx.lineWidth = 1;
    for (let i = 0; i < poi.lilies; i++) {
      const a = (i / poi.lilies) * Math.PI * 2;
      const lx = Math.cos(a) * (poi.poolRadius * 0.55);
      const ly = Math.sin(a) * (poi.poolRadius * 0.55);
      ctx.beginPath();
      ctx.arc(lx, ly, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 3. Glowing Fairy Ring of Mushrooms
    for (let m = 0; m < poi.mushroomRing; m++) {
      const ma = (m / poi.mushroomRing) * Math.PI * 2;
      const mx = Math.cos(ma) * (poi.poolRadius + 12);
      const my = Math.sin(ma) * (poi.poolRadius + 12);

      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  renderGallowsCrossroad(ctx, poi) {
    ctx.save();
    ctx.translate(poi.x, poi.y);

    // 1. Wooden Gallows Post & Crossbeam
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.8;
    // Upright post
    ctx.fillRect(-4, -poi.timberLength, 8, poi.timberLength);
    ctx.strokeRect(-4, -poi.timberLength, 8, poi.timberLength);
    // Crossbeam
    ctx.fillRect(-4, -poi.timberLength - 4, poi.timberLength * 0.8, 6);
    ctx.strokeRect(-4, -poi.timberLength - 4, poi.timberLength * 0.8, 6);

    // 2. Hanging Iron Cage (Gibbet)
    const cageX = poi.timberLength * 0.6;
    const cageY = -poi.timberLength + 10;
    // Chain
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cageX, -poi.timberLength);
    ctx.lineTo(cageX, cageY);
    ctx.stroke();

    // Iron Cage
    ctx.fillStyle = 'rgba(24, 24, 27, 0.6)';
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cageX - 6, cageY, 12, 18);
    // Cage bars
    ctx.beginPath();
    ctx.moveTo(cageX - 2, cageY);
    ctx.lineTo(cageX - 2, cageY + 18);
    ctx.moveTo(cageX + 2, cageY);
    ctx.lineTo(cageX + 2, cageY + 18);
    ctx.stroke();

    // 3. Directional Signpost
    if (poi.signpost) {
      const sx = poi.signpost.x - poi.x;
      const sy = poi.signpost.y - poi.y;

      ctx.fillStyle = '#92400e';
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1.2;
      ctx.fillRect(sx - 3, sy - 14, 6, 20);

      // Wooden arrows
      ctx.fillRect(sx - 14, sy - 14, 18, 6);
      ctx.fillRect(sx - 4, sy - 6, 18, 6);
    }

    ctx.restore();
  }

  renderMapBorder(ctx, W, H) {
    // Watabou-style clean double ink border around the map
    ctx.save();
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, W, H);

    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(4, 4, W - 8, H - 8);
    ctx.restore();
  }

  renderCaveNetwork(ctx, map, W, H) {
    const cn = map.caveNetwork;
    if (!cn) return;

    ctx.save();
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, W, H);

    cn.chambers.forEach(ch => {
      ctx.save();
      ctx.fillStyle = '#27272a';
      ctx.beginPath();
      ctx.ellipse(ch.x, ch.y, ch.rx, ch.ry, ch.angle || 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();
    });

    cn.passages.forEach(p => {
      ctx.save();
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = p.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(p.p1.x, p.p1.y);
      ctx.quadraticCurveTo(p.control.x, p.control.y, p.p2.x, p.p2.y);
      ctx.stroke();

      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = p.width + 8;
      ctx.globalCompositeOperation = 'destination-over';
      ctx.beginPath();
      ctx.moveTo(p.p1.x, p.p1.y);
      ctx.quadraticCurveTo(p.control.x, p.control.y, p.p2.x, p.p2.y);
      ctx.stroke();
      ctx.restore();
    });

    if (cn.pool) {
      ctx.save();
      const p = cn.pool;
      ctx.fillStyle = '#0891b2';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx * 0.6, p.ry * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (cn.stalagmites) {
      cn.stalagmites.forEach(st => {
        ctx.save();
        ctx.fillStyle = '#3f3f46';
        ctx.strokeStyle = '#09090b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#71717a';
        ctx.beginPath();
        ctx.arc(st.x - st.radius * 0.2, st.y - st.radius * 0.2, st.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    if (cn.torches) {
      cn.torches.forEach(t => {
        ctx.save();
        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    ctx.restore();
  }

  renderDungeonComplex(ctx, map, W, H) {
    const dc = map.dungeonComplex;
    if (!dc) return;

    ctx.save();
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, W, H);

    dc.corridors.forEach(c => {
      ctx.save();
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = c.width;
      ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(c.x1, c.y1);
      ctx.lineTo(c.x2, c.y2);
      ctx.stroke();

      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = c.width + 10;
      ctx.globalCompositeOperation = 'destination-over';
      ctx.beginPath();
      ctx.moveTo(c.x1, c.y1);
      ctx.lineTo(c.x2, c.y2);
      ctx.stroke();
      ctx.restore();
    });

    dc.rooms.forEach(rm => {
      ctx.save();
      ctx.fillStyle = '#27272a';
      ctx.fillRect(rm.x, rm.y, rm.w, rm.h);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      const cs = map.grid.cellSize;
      for (let x = rm.x; x <= rm.x + rm.w; x += cs) {
        ctx.beginPath(); ctx.moveTo(x, rm.y); ctx.lineTo(x, rm.y + rm.h); ctx.stroke();
      }
      for (let y = rm.y; y <= rm.y + rm.h; y += cs) {
        ctx.beginPath(); ctx.moveTo(rm.x, y); ctx.lineTo(rm.x + rm.w, y); ctx.stroke();
      }

      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = 8;
      ctx.strokeRect(rm.x, rm.y, rm.w, rm.h);
      ctx.restore();
    });

    if (dc.pillars) {
      dc.pillars.forEach(p => {
        ctx.save();
        ctx.fillStyle = '#52525b';
        ctx.strokeStyle = '#09090b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, map.grid.cellSize * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
    }

    if (dc.braziers) {
      dc.braziers.forEach(b => {
        ctx.save();
        ctx.fillStyle = '#f97316';
        ctx.shadowColor = '#ea580c';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    ctx.restore();
  }

  renderArchipelago(ctx, map, W, H) {
    const ad = map.archipelagoData;
    if (!ad) return;

    ctx.save();
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    for (let y = 30; y < H; y += 45) {
      for (let x = 20; x < W; x += 120) {
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 0.6);
        ctx.stroke();
      }
    }

    ad.islands.forEach(isl => {
      ctx.save();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.beginPath();
      isl.points.forEach((p, idx) => {
        const dx = (p.x - isl.cx) * 1.35 + isl.cx;
        const dy = (p.y - isl.cy) * 1.35 + isl.cy;
        if (idx === 0) ctx.moveTo(dx, dy);
        else ctx.lineTo(dx, dy);
      });
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 3;
      ctx.beginPath();
      isl.points.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      isl.points.forEach((p, idx) => {
        const dx = (p.x - isl.cx) * 0.65 + isl.cx;
        const dy = (p.y - isl.cy) * 0.65 + isl.cy;
        if (idx === 0) ctx.moveTo(dx, dy);
        else ctx.lineTo(dx, dy);
      });
      ctx.closePath();
      ctx.fill();

      if (isl.palms) {
        isl.palms.forEach(pl => {
          ctx.save();
          ctx.strokeStyle = '#a16207';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(pl.x, pl.y);
          ctx.lineTo(pl.x + 8, pl.y - 12);
          ctx.stroke();

          ctx.fillStyle = '#15803d';
          const topX = pl.x + 8;
          const topY = pl.y - 12;
          for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
            ctx.beginPath();
            ctx.arc(topX + Math.cos(a) * 10, topY + Math.sin(a) * 10, 8, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        });
      }
      ctx.restore();
    });

    if (ad.shipwreck) {
      const sw = ad.shipwreck;
      ctx.save();
      ctx.translate(sw.x, sw.y);
      ctx.rotate(sw.angle);
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, sw.length * 0.5, sw.width * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-10, 0); ctx.lineTo(sw.length * 0.4, 15);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  renderShips(ctx, map, W, H) {
    const sd = map.shipsData;
    if (!sd) return;

    ctx.save();
    ctx.fillStyle = '#0369a1';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.35;
    for (let y = 20; y < H; y += 40) {
      for (let x = 30; x < W; x += 100) {
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 0.5);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1.0;

    sd.ships.forEach(ship => {
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.angle);

      const L = ship.length;
      const Wd = ship.width;

      ctx.fillStyle = ship.woodColor;
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-L * 0.48, -Wd * 0.35);
      ctx.lineTo(L * 0.2, -Wd * 0.48);
      ctx.lineTo(L * 0.5, 0);
      ctx.lineTo(L * 0.2, Wd * 0.48);
      ctx.lineTo(-L * 0.48, Wd * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = ship.deckColor;
      ctx.beginPath();
      ctx.rect(-L * 0.44, -Wd * 0.38, L * 0.88, Wd * 0.76);
      ctx.fill();

      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1;
      for (let py = -Wd * 0.35; py <= Wd * 0.35; py += 10) {
        ctx.beginPath();
        ctx.moveTo(-L * 0.44, py);
        ctx.lineTo(L * 0.4, py);
        ctx.stroke();
      }

      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-L * 0.2, -Wd * 0.38); ctx.lineTo(-L * 0.2, Wd * 0.38); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(L * 0.25, -Wd * 0.38); ctx.lineTo(L * 0.25, Wd * 0.38); ctx.stroke();

      if (ship.hatches) {
        ship.hatches.forEach(h => {
          ctx.fillStyle = '#451a03';
          ctx.fillRect(h.relX - h.w * 0.5, h.relY - h.h * 0.5, h.w, h.h);
          ctx.strokeStyle = '#b45309';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(h.relX - h.w * 0.5, h.relY - h.h * 0.5, h.w, h.h);
        });
      }

      if (ship.cannons) {
        ship.cannons.forEach(can => {
          ctx.fillStyle = '#18181b';
          const canL = map.grid.cellSize * 0.7;
          const canW = map.grid.cellSize * 0.25;
          const dirY = can.side === 'port' ? -1 : 1;
          ctx.fillRect(can.relX - canW * 0.5, can.relY, canW, canL * dirY);
        });
      }

      if (ship.helm) {
        ctx.fillStyle = '#78350f';
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ship.helm.relX, ship.helm.relY, map.grid.cellSize * 0.35, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (ship.masts) {
        ship.masts.forEach(m => {
          ctx.strokeStyle = '#451a03';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(m.relX, -m.yardarm * 0.5);
          ctx.lineTo(m.relX, m.yardarm * 0.5);
          ctx.stroke();

          if (m.sail) {
            ctx.fillStyle = '#fef3c7';
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.rect(m.relX - 4, -m.yardarm * 0.48, 8, m.yardarm * 0.96);
            ctx.fill();
            ctx.stroke();
          }

          ctx.fillStyle = '#451a03';
          ctx.beginPath();
          ctx.arc(m.relX, m.relY, m.radius * 25, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.restore();
    });

    if (map.boardingPlanks) {
      map.boardingPlanks.forEach(bp => {
        ctx.save();
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = bp.width;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(bp.x1, bp.y1);
        ctx.lineTo(bp.x2, bp.y2);
        ctx.stroke();

        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      });
    }

    ctx.restore();
  }

  drawSmoothSpline(ctx, points) {
    if (points.length < 2) return;
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const midX = (p0.x + p1.x) * 0.5;
      const midY = (p0.y + p1.y) * 0.5;
      ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  }
}
