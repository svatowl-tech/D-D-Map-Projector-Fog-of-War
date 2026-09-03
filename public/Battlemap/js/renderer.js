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

    // 6. Roads & Paths & City Infrastructure
    if (map.cityStreets && map.cityStreets.length) {
      this.renderCityStreets(ctx, map);
    }
    if (map.citySidewalks && map.citySidewalks.length) {
      this.renderCitySidewalks(ctx, map);
    }
    if (map.townSquare) {
      this.renderTownSquare(ctx, map);
    }
    if (map.cityPlazas && map.cityPlazas.length) {
      for (const pl of map.cityPlazas) {
        this.renderTownSquare(ctx, { townSquare: pl });
      }
    }
    if (map.villageCenter) {
      this.renderVillageCenter(ctx, map);
    }
    if (map.villageFences && map.villageFences.length) {
      this.renderVillageFences(ctx, map);
    }

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

    // Palisade Wall & Watchtowers
    if (map.palisade) {
      this.renderPalisade(ctx, map);
    }
    // City Lanterns
    if (map.cityLanterns && map.cityLanterns.length) {
      this.renderCityLanterns(ctx, map);
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
    if ((biome && biome.id === 'city') || map.biomeId === 'city') {
      this.renderCityCobblestoneGround(ctx, map, W, H);
      return;
    }

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

  renderCityCobblestoneGround(ctx, map, W, H) {
    ctx.save();

    // Base limestone ground color
    ctx.fillStyle = '#b3ac9f';
    ctx.fillRect(0, 0, W, H);

    // Staggered Cobblestone Texture Grid
    const stoneW = 18;
    const stoneH = 10;
    const colors = ['#c2baa9', '#b5aca0', '#a8a092', '#9b9284', '#8e8677', '#817a6c'];

    ctx.strokeStyle = '#38332b';
    ctx.lineWidth = 0.7;

    for (let y = 0; y < H; y += stoneH) {
      const isOdd = Math.floor(y / stoneH) % 2 === 1;
      const xOffset = isOdd ? stoneW * 0.5 : 0;

      for (let x = -stoneW; x < W + stoneW; x += stoneW) {
        const sx = x + xOffset;
        const hash = Math.abs(Math.sin(sx * 12.9898 + y * 78.233) * 43758.5453);
        const colorIdx = Math.floor(hash * colors.length) % colors.length;

        ctx.fillStyle = colors[colorIdx];
        ctx.fillRect(sx + 0.5, y + 0.5, stoneW - 1, stoneH - 1);
        ctx.strokeRect(sx + 0.5, y + 0.5, stoneW - 1, stoneH - 1);
      }
    }

    if (this.paperPattern) {
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = this.paperPattern;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    ctx.restore();
  }

  renderCitySidewalks(ctx, map) {
    if (!map.citySidewalks || !map.citySidewalks.length) return;

    ctx.save();
    for (const sw of map.citySidewalks) {
      ctx.save();

      // Raised sidewalk flagstone base (Тротуар из брусчатки/плит)
      ctx.fillStyle = '#d6cebf';
      ctx.fillRect(sw.x, sw.y, sw.w, sw.h);

      // Flagstone grid joints
      ctx.strokeStyle = '#8c8474';
      ctx.lineWidth = 0.8;
      const step = 16;
      for (let x = sw.x; x < sw.x + sw.w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, sw.y);
        ctx.lineTo(x, sw.y + sw.h);
        ctx.stroke();
      }

      // Granite curb line (Каменный бордюр)
      ctx.strokeStyle = '#2b2721';
      ctx.lineWidth = 2.0;
      ctx.strokeRect(sw.x, sw.y, sw.w, sw.h);

      // Gutter drainage (Сточная канавка)
      ctx.strokeStyle = '#1c1915';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(sw.x + 1, sw.y + 1, sw.w - 2, sw.h - 2);

      ctx.restore();
    }
    ctx.restore();
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

      // 2. Outdoor Horse Paddock / Fence Enclosure (e.g. for Stables or Farmsteads)
      if (b.paddock) {
        const pad = b.paddock;
        ctx.save();

        // Paddock Ground Patch
        ctx.fillStyle = '#7a674d'; // Dirt/straw paddock ground
        ctx.fillRect(pad.x, pad.y, pad.w, pad.h);

        // Fence Posts and Rails
        ctx.strokeStyle = '#5a3f24';
        ctx.lineWidth = 3;
        ctx.strokeRect(pad.x, pad.y, pad.w, pad.h);

        // Fence corner posts
        ctx.fillStyle = '#3a2614';
        const postR = 4;
        ctx.beginPath();
        ctx.arc(pad.x, pad.y, postR, 0, Math.PI * 2);
        ctx.arc(pad.x + pad.w, pad.y, postR, 0, Math.PI * 2);
        ctx.arc(pad.x + pad.w, pad.y + pad.h, postR, 0, Math.PI * 2);
        ctx.arc(pad.x, pad.y + pad.h, postR, 0, Math.PI * 2);
        ctx.fill();

        // Mid fence posts along perimeter
        for (let fx = pad.x + 30; fx < pad.x + pad.w - 10; fx += 30) {
          ctx.beginPath();
          ctx.arc(fx, pad.y, 3, 0, Math.PI * 2);
          ctx.arc(fx, pad.y + pad.h, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let fy = pad.y + 30; fy < pad.y + pad.h - 10; fy += 30) {
          ctx.beginPath();
          ctx.arc(pad.x + pad.w, fy, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Paddock props: Water Trough + Hay Bale inside pen
        ctx.fillStyle = '#4a6360'; // Water in trough
        ctx.fillRect(pad.x + 12, pad.y + 12, 16, 28);
        ctx.strokeStyle = '#382615';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(pad.x + 12, pad.y + 12, 16, 28);

        ctx.fillStyle = '#c9a84d'; // Hay bale
        ctx.fillRect(pad.x + pad.w - 32, pad.y + 12, 22, 16);
        ctx.strokeRect(pad.x + pad.w - 32, pad.y + 12, 22, 16);

        // Horse silhouette inside paddock
        ctx.fillStyle = '#59381e'; // Brown horse body
        ctx.beginPath();
        ctx.ellipse(pad.x + pad.w * 0.5, pad.y + pad.h * 0.5, 14, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pad.x + pad.w * 0.5 + 12, pad.y + pad.h * 0.5 - 4, 5, 0, Math.PI * 2); // Horse head
        ctx.fill();

        ctx.restore();
      }

      // 3. Front Porch Deck (facing the road)
      if (b.hasPorch && b.door) {
        const doorSide = b.door.side || 'south';
        let px = b.x + b.width * 0.5 - 20;
        let py = b.y + b.height;
        let pw = 40, ph = 14;
        if (doorSide === 'north') { py = b.y - 14; }
        else if (doorSide === 'west') { px = b.x - 14; py = b.y + b.height * 0.5 - 20; pw = 14; ph = 40; }
        else if (doorSide === 'east') { px = b.x + b.width; py = b.y + b.height * 0.5 - 20; pw = 14; ph = 40; }

        if (b.porchStyle === 'stone') {
          ctx.fillStyle = '#807b71';
          ctx.fillRect(px, py, pw, ph);
          ctx.strokeStyle = '#3b3833';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(px, py, pw, ph);
          // Pillars
          ctx.fillStyle = '#a19b8f';
          ctx.beginPath();
          ctx.arc(px + 4, py + 4, 3, 0, Math.PI * 2);
          ctx.arc(px + pw - 4, py + 4, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillStyle = '#91724f';
          ctx.fillRect(px, py, pw, ph);
          ctx.strokeStyle = '#4a331c';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(px, py, pw, ph);
          // Wooden posts
          ctx.fillStyle = '#3a2614';
          ctx.beginPath();
          ctx.arc(px + 4, py + 4, 2.5, 0, Math.PI * 2);
          ctx.arc(px + pw - 4, py + 4, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4. Outdoor Features (Well, Woodpile, Hitching Post, Scrap Pile)
      if (b.outdoorFeatures) {
        for (const feat of b.outdoorFeatures) {
          if (feat.type === 'well') {
            ctx.fillStyle = 'rgba(20, 20, 20, 0.3)';
            ctx.beginPath();
            ctx.arc(feat.x + 2, feat.y + 2, feat.r, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#8f897c';
            ctx.beginPath();
            ctx.arc(feat.x, feat.y, feat.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#47433b';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#2d4745';
            ctx.beginPath();
            ctx.arc(feat.x, feat.y, feat.r * 0.6, 0, Math.PI * 2);
            ctx.fill();

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

            ctx.fillStyle = '#9e7951';
            for (let lx = feat.x + 4; lx < feat.x + feat.w - 2; lx += 7) {
              for (let ly = feat.y + 4; ly < feat.y + feat.h - 2; ly += 7) {
                ctx.beginPath();
                ctx.arc(lx, ly, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
              }
            }
          } else if (feat.type === 'hitching_post') {
            ctx.strokeStyle = '#4a331c';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(feat.x, feat.y - 12);
            ctx.lineTo(feat.x, feat.y + 12);
            ctx.stroke();

            ctx.fillStyle = '#2d1b0d';
            ctx.beginPath();
            ctx.arc(feat.x, feat.y - 12, 3, 0, Math.PI * 2);
            ctx.arc(feat.x, feat.y + 12, 3, 0, Math.PI * 2);
            ctx.fill();
          } else if (feat.type === 'scrap_pile') {
            ctx.fillStyle = '#524f4b';
            ctx.beginPath();
            ctx.arc(feat.x + feat.w * 0.5, feat.y + feat.h * 0.5, feat.w * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#2b2927';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      }

      // 5. Building Cast Shadow
      ctx.fillStyle = 'rgba(15, 15, 15, 0.35)';
      ctx.fillRect(b.x + 6, b.y + 6, b.width, b.height);

      // 6. Multi-Room Interior Floors
      if (b.rooms && b.rooms.length > 0) {
        for (const rm of b.rooms) {
          const rx = b.x + rm.relX;
          const ry = b.y + rm.relY;
          const rw = rm.relW;
          const rh = rm.relH;

          ctx.save();
          if (rm.floorStyle === 'stone_flagstones') {
            ctx.fillStyle = '#7a766d';
            ctx.fillRect(rx, ry, rw, rh);
            ctx.strokeStyle = '#545048';
            ctx.lineWidth = 1;
            for (let gx = rx; gx < rx + rw; gx += 16) {
              ctx.beginPath(); ctx.moveTo(gx, ry); ctx.lineTo(gx, ry + rh); ctx.stroke();
            }
            for (let gy = ry; gy < ry + rh; gy += 16) {
              ctx.beginPath(); ctx.moveTo(rx, gy); ctx.lineTo(rx + rw, gy); ctx.stroke();
            }
          } else if (rm.floorStyle === 'cobblestone') {
            ctx.fillStyle = '#57544e';
            ctx.fillRect(rx, ry, rw, rh);
            ctx.strokeStyle = '#383632';
            ctx.lineWidth = 1;
            for (let cx = rx + 6; cx < rx + rw - 4; cx += 12) {
              for (let cy = ry + 6; cy < ry + rh - 4; cy += 12) {
                ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.stroke();
              }
            }
          } else if (rm.floorStyle === 'straw_timber') {
            ctx.fillStyle = '#a68b58';
            ctx.fillRect(rx, ry, rw, rh);
            ctx.strokeStyle = '#d4b76e';
            ctx.lineWidth = 1;
            for (let sx = rx + 4; sx < rx + rw - 4; sx += 8) {
              ctx.beginPath(); ctx.moveTo(sx, ry + 4); ctx.lineTo(sx + 6, ry + rh - 4); ctx.stroke();
            }
          } else if (rm.floorStyle === 'fancy_carpet') {
            ctx.fillStyle = '#8a2b2b';
            ctx.fillRect(rx, ry, rw, rh);
            ctx.strokeStyle = '#d4a837';
            ctx.lineWidth = 2;
            ctx.strokeRect(rx + 6, ry + 6, rw - 12, rh - 12);
          } else {
            ctx.fillStyle = biome.building.floor;
            ctx.fillRect(rx, ry, rw, rh);
            ctx.strokeStyle = biome.building.planks;
            ctx.lineWidth = 1;
            const plankW = 12;
            for (let px = rx; px <= rx + rw; px += plankW) {
              ctx.beginPath(); ctx.moveTo(px, ry); ctx.lineTo(px, ry + rh); ctx.stroke();
            }
          }
          ctx.restore();
        }
      } else {
        ctx.fillStyle = biome.building.floor;
        ctx.fillRect(b.x, b.y, b.width, b.height);
      }

      // 7. Interior Props Rendering
      if (b.props) {
        for (const prop of b.props) {
          this.renderBuildingProp(ctx, prop);
        }
      }

      // 8. Internal Wall Partitions
      if (b.internalWalls) {
        ctx.strokeStyle = biome.building.wall;
        ctx.lineWidth = 5;
        for (const wall of b.internalWalls) {
          ctx.beginPath();
          ctx.moveTo(wall.x1, wall.y1);
          ctx.lineTo(wall.x2, wall.y2);
          ctx.stroke();

          if (wall.door) {
            const doorSize = wall.door.size || 20;
            let cx = wall.door.x || (wall.x1 + wall.x2) * 0.5;
            let cy = wall.door.y || (wall.y1 + wall.y2) * 0.5;

            ctx.fillStyle = '#8f7a5b';
            if (Math.abs(wall.x1 - wall.x2) < 2) {
              ctx.fillRect(cx - 3, cy - doorSize * 0.5, 6, doorSize);
              ctx.strokeStyle = '#634424';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(cx, cy - doorSize * 0.5);
              ctx.lineTo(cx + 10, cy);
              ctx.stroke();
            } else {
              ctx.fillRect(cx - doorSize * 0.5, cy - 3, doorSize, 6);
              ctx.strokeStyle = '#634424';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(cx - doorSize * 0.5, cy);
              ctx.lineTo(cx, cy + 10);
              ctx.stroke();
            }
          }
        }
      }

      // 9. Exterior Thick Wall Shell
      ctx.strokeStyle = biome.building.wall;
      ctx.lineWidth = b.wallThickness;
      ctx.strokeRect(b.x, b.y, b.width, b.height);

      // 10. Door opening with door swing arc (facing road)
      if (b.door) {
        const doorSide = b.door.side || 'south';
        const doorW = 22;
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

        ctx.fillStyle = biome.building.floor;
        ctx.fillRect(dx - 1, dy - 1, clearW, clearH);

        ctx.strokeStyle = '#805934';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(swingStartX, swingStartY);
        ctx.lineTo(swingEndX, swingEndY);
        ctx.stroke();
      }

      // 11. Windows
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

      // 12. Tactical Building Name Tag Banner
      if (b.name) {
        ctx.save();
        ctx.font = 'bold 12px "Cinzel", "Georgia", serif';
        const nameText = b.name;
        const textMetrics = ctx.measureText(nameText);
        const padX = 10, padY = 5;
        const boxW = textMetrics.width + padX * 2;
        const boxH = 20;
        const tagX = b.x + b.width * 0.5 - boxW * 0.5;
        const tagY = b.y - 18;

        ctx.fillStyle = 'rgba(28, 24, 20, 0.88)';
        ctx.fillRect(tagX, tagY, boxW, boxH);
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 1;
        ctx.strokeRect(tagX, tagY, boxW, boxH);

        ctx.fillStyle = '#f0e6d2';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(nameText, b.x + b.width * 0.5, tagY + boxH * 0.5);
        ctx.restore();
      }

      ctx.restore();
    }
  }

  renderBuildingProp(ctx, prop) {
    ctx.save();
    if (prop.type === 'bar_counter') {
      ctx.fillStyle = '#573a21';
      ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
      ctx.strokeStyle = '#2b1c0e';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);

      ctx.fillStyle = '#d4af37';
      ctx.fillRect(prop.x + prop.w * 0.2, prop.y + 2, 4, 6);
      ctx.fillRect(prop.x + prop.w * 0.4, prop.y + 2, 4, 6);

      ctx.fillStyle = '#8f5d34';
      for (let sx = prop.x + 12; sx < prop.x + prop.w - 10; sx += 20) {
        ctx.beginPath();
        ctx.arc(sx, prop.y + prop.h + 6, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (prop.type === 'drinking_table') {
      ctx.fillStyle = '#8f6843';
      ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
      ctx.strokeStyle = '#47301c';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);

      ctx.fillStyle = '#6b4c2d';
      ctx.fillRect(prop.x, prop.y - 6, prop.w, 4);
      ctx.fillRect(prop.x, prop.y + prop.h + 2, prop.w, 4);

      ctx.fillStyle = '#a1a8b0';
      ctx.beginPath();
      ctx.arc(prop.x + 8, prop.y + prop.h * 0.5, 3, 0, Math.PI * 2);
      ctx.arc(prop.x + prop.w - 8, prop.y + prop.h * 0.5, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.type === 'double_bed') {
      ctx.fillStyle = '#9e3333';
      ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
      ctx.strokeStyle = '#4a1717';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);

      ctx.fillStyle = '#f2efe9';
      ctx.fillRect(prop.x + 3, prop.y + 3, prop.w * 0.45 - 2, prop.h * 0.26);
      ctx.fillRect(prop.x + prop.w * 0.55 - 1, prop.y + 3, prop.w * 0.45 - 2, prop.h * 0.26);
    } else if (prop.type === 'bed') {
      ctx.fillStyle = '#c54e4e';
      ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
      ctx.strokeStyle = '#4a2222';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);
      ctx.fillStyle = '#f0ece0';
      ctx.fillRect(prop.x + 2, prop.y + 2, prop.w - 4, prop.h * 0.28);
    } else if (prop.type === 'dining_table') {
      ctx.fillStyle = '#7a5433';
      ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
      ctx.strokeStyle = '#3d2817';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);
    } else if (prop.type === 'hearth' || prop.type === 'forge_hearth') {
      ctx.fillStyle = '#635e55';
      ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
      ctx.strokeStyle = '#2b2925';
      ctx.lineWidth = 2;
      ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);

      ctx.fillStyle = prop.type === 'forge_hearth' ? '#ff3300' : '#e86128';
      ctx.beginPath();
      ctx.arc(prop.x + prop.w * 0.5, prop.y + prop.h * 0.5, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.type === 'anvil') {
      ctx.fillStyle = '#3a3d40';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, prop.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#18191a';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#616870';
      ctx.fillRect(prop.x - prop.r * 0.8, prop.y - 2, prop.r * 1.6, 4);
    } else if (prop.type === 'horse_stall') {
      ctx.strokeStyle = '#5e432a';
      ctx.lineWidth = 2;
      ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);

      ctx.fillStyle = 'rgba(212, 183, 110, 0.4)';
      ctx.fillRect(prop.x + 2, prop.y + 2, prop.w - 4, prop.h - 4);

      ctx.fillStyle = '#382615';
      ctx.fillRect(prop.x + 4, prop.y + 4, prop.w - 8, 8);
    } else if (prop.type === 'millstone') {
      ctx.fillStyle = '#827f79';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, prop.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3d3b38';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#2b1b0e';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, prop.r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.type === 'pelt_drying_frame') {
      ctx.strokeStyle = '#614327';
      ctx.lineWidth = 2;
      ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);

      ctx.fillStyle = '#875d38';
      ctx.beginPath();
      ctx.ellipse(prop.x + prop.w * 0.5, prop.y + prop.h * 0.5, prop.w * 0.35, prop.h * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.type === 'bookshelf') {
      ctx.fillStyle = '#543922';
      ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
      ctx.strokeStyle = '#2b1b0e';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);

      const colors = ['#8a2b2b', '#2b548a', '#2b8a43', '#d4af37'];
      let bx = prop.x + 4;
      let ci = 0;
      while (bx < prop.x + prop.w - 6) {
        ctx.fillStyle = colors[ci % colors.length];
        ctx.fillRect(bx, prop.y + 2, 4, prop.h - 4);
        bx += 5;
        ci++;
      }
    } else if (prop.type === 'desk') {
      ctx.fillStyle = '#785233';
      ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
      ctx.strokeStyle = '#3d2817';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);

      ctx.fillStyle = '#f5e8c4';
      ctx.fillRect(prop.x + 6, prop.y + 4, 10, 8);
    } else if (prop.type === 'weapons_rack') {
      ctx.fillStyle = '#5e432a';
      ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
      ctx.strokeStyle = '#2b1b0e';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);

      ctx.strokeStyle = '#bdc5cc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(prop.x + 6, prop.y + 2); ctx.lineTo(prop.x + prop.w - 6, prop.y + 2);
      ctx.moveTo(prop.x + 6, prop.y + prop.h - 2); ctx.lineTo(prop.x + prop.w - 6, prop.y + prop.h - 2);
      ctx.stroke();
    } else if (prop.type === 'grain_sack') {
      ctx.fillStyle = '#c7b38d';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#615339';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (prop.type === 'crate') {
      ctx.fillStyle = '#8c704f';
      ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
      ctx.strokeStyle = '#423321';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);
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
    ctx.restore();
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

      // 2. Amphitheater Arena Floor & Concentric Seating Tiers & Arcades
      if (r.arenaFloor) {
        ctx.save();
        const af = r.arenaFloor;
        // Sand arena floor
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.ellipse(af.cx, af.cy, af.rx, af.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Blood/dirt combat stains
        ctx.fillStyle = 'rgba(120, 30, 20, 0.35)';
        ctx.beginPath();
        ctx.ellipse(af.cx - af.rx * 0.2, af.cy + af.ry * 0.1, af.rx * 0.35, af.ry * 0.25, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (r.concentricRings) {
        ctx.save();
        for (const ring of r.concentricRings) {
          ctx.strokeStyle = '#52525b';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.ellipse(r.cx, r.cy, ring.rx, ring.ry, 0, ring.breachAngle + ring.breachArc, ring.breachAngle);
          ctx.stroke();

          // Inner tier step line
          ctx.strokeStyle = '#71717a';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.ellipse(r.cx, r.cy, ring.rx - 2, ring.ry - 2, 0, ring.breachAngle + ring.breachArc, ring.breachAngle);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (r.arcades) {
        ctx.save();
        for (const arc of r.arcades) {
          ctx.strokeStyle = '#3f3f46';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.ellipse(arc.cx, arc.cy, arc.rx, arc.ry, 0, arc.angStart, arc.angEnd);
          ctx.stroke();
          ctx.strokeStyle = '#18181b';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();
      }

      if (r.trapdoor) {
        ctx.save();
        ctx.fillStyle = '#18181b';
        ctx.fillRect(r.trapdoor.x - r.trapdoor.width * 0.5, r.trapdoor.y - r.trapdoor.height * 0.5, r.trapdoor.width, r.trapdoor.height);
        ctx.strokeStyle = '#71717a';
        ctx.lineWidth = 1.5;
        // Grate bars
        for (let gx = -r.trapdoor.width * 0.5 + 4; gx < r.trapdoor.width * 0.5; gx += 6) {
          ctx.beginPath();
          ctx.moveTo(r.trapdoor.x + gx, r.trapdoor.y - r.trapdoor.height * 0.5);
          ctx.lineTo(r.trapdoor.x + gx, r.trapdoor.y + r.trapdoor.height * 0.5);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (r.statues) {
        for (const st of r.statues) {
          ctx.save();
          ctx.translate(st.x, st.y);
          ctx.rotate(st.fallenAngle);
          // Base plinth
          ctx.fillStyle = '#52525b';
          ctx.strokeStyle = '#18181b';
          ctx.lineWidth = 1.5;
          ctx.fillRect(-10, -10, 20, 20);
          ctx.strokeRect(-10, -10, 20, 20);
          // Fallen broken torso
          ctx.fillStyle = '#71717a';
          ctx.fillRect(8, -6, 22, 12);
          ctx.strokeRect(8, -6, 22, 12);
          // Broken head
          ctx.beginPath();
          ctx.arc(36, 0, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      // 3. Fortress Bastions & Keep & Armory & Siege Debris
      if (r.bastions) {
        ctx.save();
        for (const bas of r.bastions) {
          ctx.fillStyle = '#52525b';
          ctx.strokeStyle = '#18181b';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(bas.x, bas.y, bas.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Arrow slits
          ctx.strokeStyle = '#09090b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bas.x - 6, bas.y); ctx.lineTo(bas.x + 6, bas.y);
          ctx.moveTo(bas.x, bas.y - 6); ctx.lineTo(bas.x, bas.y + 6);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (r.keep) {
        ctx.save();
        ctx.fillStyle = '#3f3f46';
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 2.5;
        ctx.fillRect(r.keep.x, r.keep.y, r.keep.w, r.keep.h);
        ctx.strokeRect(r.keep.x, r.keep.y, r.keep.w, r.keep.h);
        // Throne dais
        ctx.fillStyle = '#71717a';
        ctx.fillRect(r.keep.x + r.keep.w * 0.3, r.keep.y + 6, r.keep.w * 0.4, 20);
        ctx.strokeRect(r.keep.x + r.keep.w * 0.3, r.keep.y + 6, r.keep.w * 0.4, 20);
        ctx.restore();
      }

      if (r.armory) {
        for (const arm of r.armory) {
          ctx.save();
          if (arm.type === 'weapon_rack') {
            ctx.fillStyle = '#78350f';
            ctx.fillRect(arm.x - 12, arm.y - 4, 24, 8);
            ctx.strokeStyle = '#e4e4e7';
            ctx.lineWidth = 1.2;
            for (let i = -8; i <= 8; i += 4) {
              ctx.beginPath();
              ctx.moveTo(arm.x + i, arm.y - 10);
              ctx.lineTo(arm.x + i, arm.y + 10);
              ctx.stroke();
            }
          } else {
            // Supply crates
            ctx.fillStyle = '#92400e';
            ctx.strokeStyle = '#451a03';
            ctx.lineWidth = 1.5;
            ctx.fillRect(arm.x - 8, arm.y - 8, 16, 16);
            ctx.strokeRect(arm.x - 8, arm.y - 8, 16, 16);
          }
          ctx.restore();
        }
      }

      if (r.siegeDebris) {
        for (const sd of r.siegeDebris) {
          ctx.save();
          ctx.translate(sd.x, sd.y);
          ctx.rotate(sd.angle);
          // Broken wooden beam frame
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(-18, -10); ctx.lineTo(18, 10);
          ctx.moveTo(-10, 14); ctx.lineTo(12, -14);
          ctx.stroke();
          // Catapult iron wheel
          ctx.fillStyle = '#27272a';
          ctx.beginPath();
          ctx.arc(10, 10, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 4. Druid Circle Monoliths, Sacrificial Pit & Tree Roots
      if (r.monoliths) {
        for (const m of r.monoliths) {
          ctx.save();
          ctx.translate(m.x, m.y);
          ctx.rotate(m.angle);
          // Drop shadow
          ctx.fillStyle = 'rgba(20, 20, 20, 0.4)';
          ctx.fillRect(-m.w * 0.5 + 3, -m.h * 0.5 + 3, m.w, m.h);
          // Standing stone
          ctx.fillStyle = '#52525b';
          ctx.strokeStyle = '#18181b';
          ctx.lineWidth = 2;
          ctx.fillRect(-m.w * 0.5, -m.h * 0.5, m.w, m.h);
          ctx.strokeRect(-m.w * 0.5, -m.h * 0.5, m.w, m.h);
          // Moss highlight
          ctx.fillStyle = '#166534';
          ctx.fillRect(-m.w * 0.3, -m.h * 0.5, m.w * 0.6, 3);
          ctx.restore();
        }
      }

      if (r.sacrificialPit) {
        ctx.save();
        const sp = r.sacrificialPit;
        ctx.fillStyle = '#27272a';
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Glowing celestial runes
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.radius * 0.6, 0, Math.PI * 2);
        ctx.moveTo(sp.x - sp.radius * 0.5, sp.y); ctx.lineTo(sp.x + sp.radius * 0.5, sp.y);
        ctx.moveTo(sp.x, sp.y - sp.radius * 0.5); ctx.lineTo(sp.x, sp.y + sp.radius * 0.5);
        ctx.stroke();
        ctx.restore();
      }

      if (r.treeRoots) {
        for (const tr of r.treeRoots) {
          ctx.save();
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(tr.x, tr.y);
          ctx.quadraticCurveTo(tr.x + Math.cos(tr.angle + 0.4) * (tr.len * 0.5), tr.y + Math.sin(tr.angle + 0.4) * (tr.len * 0.5), tr.x + Math.cos(tr.angle) * tr.len, tr.y + Math.sin(tr.angle) * tr.len);
          ctx.stroke();
          ctx.restore();
        }
      }

      // 5. Manor Fireplace, Fountain & Library Debris
      if (r.fireplace) {
        ctx.save();
        const fp = r.fireplace;
        ctx.fillStyle = '#27272a';
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 2;
        ctx.fillRect(fp.x - fp.width * 0.5, fp.y, fp.width, fp.height);
        ctx.strokeRect(fp.x - fp.width * 0.5, fp.y, fp.width, fp.height);
        // Soot & embers
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(fp.x, fp.y + fp.height * 0.5, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (r.fountain) {
        ctx.save();
        const ft = r.fountain;
        ctx.fillStyle = '#0284c7';
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(ft.x, ft.y, ft.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Central pedestal
        ctx.fillStyle = '#71717a';
        ctx.beginPath();
        ctx.arc(ft.x, ft.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (r.libraryDebris) {
        for (const ld of r.libraryDebris) {
          ctx.save();
          if (ld.type === 'bookcase') {
            ctx.fillStyle = '#78350f';
            ctx.strokeStyle = '#451a03';
            ctx.lineWidth = 1.5;
            ctx.fillRect(ld.x - 14, ld.y - 6, 28, 12);
            ctx.strokeRect(ld.x - 14, ld.y - 6, 28, 12);
          } else {
            ctx.fillStyle = '#a16207';
            ctx.fillRect(ld.x - 8, ld.y - 8, 16, 16);
          }
          ctx.restore();
        }
      }

      // 6. Shrine Statue Alcove & Urns
      if (r.statueAlcove) {
        ctx.save();
        const sa = r.statueAlcove;
        ctx.fillStyle = '#3f3f46';
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sa.x, sa.y, sa.radius, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Deity statue
        ctx.fillStyle = '#a1a1aa';
        ctx.beginPath();
        ctx.arc(sa.x, sa.y - sa.radius * 0.3, 7, 0, Math.PI * 2);
        ctx.fill();
        // Glowing eyes/halo
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(sa.x, sa.y - sa.radius * 0.3, 10, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (r.urns) {
        for (const u of r.urns) {
          ctx.save();
          ctx.fillStyle = '#ea580c';
          ctx.strokeStyle = '#7c2d12';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(u.x, u.y, u.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Coin glint
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(u.x - 1, u.y - 1, 2, 2);
          ctx.restore();
        }
      }

      // 7. Sunken Crypt Stairs & Burial Niches
      if (r.stairs) {
        ctx.save();
        const st = r.stairs;
        ctx.fillStyle = '#18181b';
        ctx.fillRect(st.x, st.y, st.width, st.length);
        const stepH = st.length / st.steps;
        for (let s = 0; s < st.steps; s++) {
          const alpha = 1.0 - (s / st.steps) * 0.7;
          ctx.fillStyle = `rgba(161, 161, 170, ${alpha})`;
          ctx.fillRect(st.x, st.y + s * stepH, st.width, stepH - 1);
        }
        ctx.restore();
      }

      if (r.burialNiches) {
        for (const bn of r.burialNiches) {
          ctx.save();
          ctx.translate(bn.x, bn.y);
          ctx.rotate(bn.angle);
          ctx.fillStyle = '#52525b';
          ctx.strokeStyle = '#18181b';
          ctx.lineWidth = 1.5;
          ctx.fillRect(-bn.width * 0.5, -bn.height * 0.5, bn.width, bn.height);
          ctx.strokeRect(-bn.width * 0.5, -bn.height * 0.5, bn.width, bn.height);
          // Lid
          const off = bn.lidDisplaced ? 6 : 0;
          ctx.fillStyle = '#71717a';
          ctx.fillRect(-bn.width * 0.5 + off, -bn.height * 0.5 - 1, bn.width, bn.height);
          ctx.strokeRect(-bn.width * 0.5 + off, -bn.height * 0.5 - 1, bn.width, bn.height);
          ctx.restore();
        }
      }

      // 8. Observatory Octagonal Walls & Astrolabe Floor
      if (r.octagonalWalls) {
        ctx.save();
        for (const w of r.octagonalWalls) {
          ctx.strokeStyle = '#52525b';
          ctx.lineWidth = w.thickness || 14;
          ctx.beginPath();
          ctx.moveTo(w.x1, w.y1);
          ctx.lineTo(w.x2, w.y2);
          ctx.stroke();
          ctx.strokeStyle = '#18181b';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();
      }

      if (r.astrolabeFloor) {
        ctx.save();
        const af = r.astrolabeFloor;
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(af.cx, af.cy, af.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Celestial constellation lines
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.65)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(af.cx, af.cy, af.radius * 0.6, 0, Math.PI * 2);
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          ctx.moveTo(af.cx, af.cy);
          ctx.lineTo(af.cx + Math.cos(a) * af.radius, af.cy + Math.sin(a) * af.radius);
        }
        ctx.stroke();

        // Central sun sigil
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(af.cx, af.cy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 9. Dais, Moss, Crypt Stairs, Sarcophagi, Walls, Buttresses, Pillars, Altar, Rubble
      if (r.dais) {
        ctx.save();
        ctx.fillStyle = 'rgba(20, 20, 20, 0.25)';
        ctx.fillRect(r.dais.x - 3, r.dais.y - 3, r.dais.width + 6, r.dais.height + 6);

        ctx.fillStyle = '#c5bea9';
        ctx.fillRect(r.dais.x, r.dais.y, r.dais.width, r.dais.height);
        ctx.strokeStyle = '#4a4537';
        ctx.lineWidth = 2;
        ctx.strokeRect(r.dais.x, r.dais.y, r.dais.width, r.dais.height);

        ctx.fillStyle = 'rgba(20, 20, 20, 0.2)';
        ctx.fillRect(r.dais.innerX - 2, r.dais.innerY - 2, r.dais.innerWidth + 4, r.dais.innerHeight + 4);

        ctx.fillStyle = '#ded7c4';
        ctx.fillRect(r.dais.innerX, r.dais.innerY, r.dais.innerWidth, r.dais.innerHeight);
        ctx.strokeStyle = '#3e392d';
        ctx.lineWidth = 2;
        ctx.strokeRect(r.dais.innerX, r.dais.innerY, r.dais.innerWidth, r.dais.innerHeight);
        ctx.restore();
      }

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

      if (r.cryptStairs) {
        ctx.save();
        const cs = r.cryptStairs;
        ctx.fillStyle = '#423d32';
        ctx.fillRect(cs.x - 4, cs.y - cs.width * 0.5 - 4, cs.length + 8, cs.width + 8);

        ctx.fillStyle = '#11100e';
        ctx.fillRect(cs.x, cs.y - cs.width * 0.5, cs.length, cs.width);

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

      if (r.sarcophagi) {
        for (const tomb of r.sarcophagi) {
          ctx.save();
          ctx.translate(tomb.x, tomb.y);
          ctx.rotate(tomb.angle);

          ctx.fillStyle = 'rgba(20, 20, 20, 0.35)';
          ctx.fillRect(-tomb.width * 0.5 + 4, -tomb.height * 0.5 + 4, tomb.width, tomb.height);

          ctx.fillStyle = '#7a7566';
          ctx.fillRect(-tomb.width * 0.5, -tomb.height * 0.5, tomb.width, tomb.height);
          ctx.strokeStyle = '#2b2820';
          ctx.lineWidth = 2;
          ctx.strokeRect(-tomb.width * 0.5, -tomb.height * 0.5, tomb.width, tomb.height);

          const lidOffset = tomb.lidDisplaced ? 8 : 0;
          ctx.fillStyle = '#9e9785';
          ctx.fillRect(-tomb.width * 0.5 + lidOffset, -tomb.height * 0.5 - 2, tomb.width, tomb.height);
          ctx.strokeStyle = '#2b2820';
          ctx.lineWidth = 2;
          ctx.strokeRect(-tomb.width * 0.5 + lidOffset, -tomb.height * 0.5 - 2, tomb.width, tomb.height);

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

          ctx.fillStyle = 'rgba(20, 20, 20, 0.38)';
          ctx.fillRect(0, -thick * 0.5 + 4, len, thick + 4);

          ctx.fillStyle = '#4c473b';
          ctx.fillRect(0, -thick * 0.5, len, thick);

          ctx.fillStyle = '#827d6d';
          ctx.fillRect(0, -thick * 0.35, len, thick * 0.7);

          ctx.strokeStyle = '#2c2921';
          ctx.lineWidth = 1.2;
          const blockLen = 22;
          for (let bx = blockLen; bx < len; bx += blockLen) {
            ctx.beginPath();
            ctx.moveTo(bx, -thick * 0.5);
            ctx.lineTo(bx, thick * 0.5);
            ctx.stroke();
          }

          ctx.strokeStyle = '#1e1c16';
          ctx.lineWidth = 2.2;
          ctx.strokeRect(0, -thick * 0.5, len, thick);

          ctx.fillStyle = '#3a362b';
          ctx.beginPath();
          ctx.arc(0, 0, thick * 0.45, 0, Math.PI * 2);
          ctx.arc(len, 0, thick * 0.45, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      }

      if (r.buttresses) {
        ctx.fillStyle = '#5a5445';
        ctx.strokeStyle = '#23201a';
        ctx.lineWidth = 2;
        for (const but of r.buttresses) {
          ctx.fillRect(but.x, but.y, but.w, but.h);
          ctx.strokeRect(but.x, but.y, but.w, but.h);
        }
      }

      if (r.pillars) {
        for (const pil of r.pillars) {
          ctx.save();
          const plSize = pil.plinthSize || 24;
          ctx.fillStyle = 'rgba(20, 20, 20, 0.32)';
          ctx.fillRect(pil.x - plSize * 0.5 + 3, pil.y - plSize * 0.5 + 3, plSize, plSize);

          ctx.fillStyle = '#8f8978';
          ctx.fillRect(pil.x - plSize * 0.5, pil.y - plSize * 0.5, plSize, plSize);
          ctx.strokeStyle = '#353127';
          ctx.lineWidth = 1.8;
          ctx.strokeRect(pil.x - plSize * 0.5, pil.y - plSize * 0.5, plSize, plSize);

          if (pil.isFallen) {
            ctx.save();
            ctx.translate(pil.x, pil.y);
            ctx.rotate(pil.fallenAngle);

            ctx.fillStyle = 'rgba(20, 20, 20, 0.35)';
            ctx.fillRect(0, -pil.radius + 3, pil.fallenLength, pil.radius * 2);

            ctx.fillStyle = '#b3ad9c';
            ctx.fillRect(0, -pil.radius, pil.fallenLength, pil.radius * 2);
            ctx.strokeStyle = '#322e24';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, -pil.radius, pil.fallenLength, pil.radius * 2);

            const drumLen = pil.fallenLength / 3;
            for (let d = 1; d <= 2; d++) {
              ctx.beginPath();
              ctx.moveTo(d * drumLen, -pil.radius);
              ctx.lineTo(d * drumLen, pil.radius);
              ctx.stroke();
            }
            ctx.restore();
          } else {
            ctx.fillStyle = '#a6a08f';
            ctx.beginPath();
            ctx.arc(pil.x, pil.y, pil.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#2d2920';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#c7c1b0';
            ctx.beginPath();
            ctx.arc(pil.x, pil.y, pil.radius * 0.72, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#433e33';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
              ctx.beginPath();
              ctx.moveTo(pil.x + Math.cos(a) * (pil.radius * 0.4), pil.y + Math.sin(a) * (pil.radius * 0.4));
              ctx.lineTo(pil.x + Math.cos(a) * (pil.radius * 0.72), pil.y + Math.sin(a) * (pil.radius * 0.72));
              ctx.stroke();
            }

            ctx.fillStyle = '#4a4537';
            ctx.beginPath();
            ctx.arc(pil.x, pil.y, pil.radius * 0.22, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      if (r.altar) {
        ctx.save();
        ctx.fillStyle = 'rgba(20, 20, 20, 0.4)';
        ctx.fillRect(r.altar.x - r.altar.width * 0.5 + 4, r.altar.y - r.altar.height * 0.5 + 4, r.altar.width, r.altar.height);

        ctx.fillStyle = '#655f50';
        ctx.fillRect(r.altar.x - r.altar.width * 0.5, r.altar.y - r.altar.height * 0.5, r.altar.width, r.altar.height);
        ctx.strokeStyle = '#1c1a14';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(r.altar.x - r.altar.width * 0.5, r.altar.y - r.altar.height * 0.5, r.altar.width, r.altar.height);

        ctx.fillStyle = '#878170';
        ctx.fillRect(r.altar.x - r.altar.width * 0.42, r.altar.y - r.altar.height * 0.42, r.altar.width * 0.84, r.altar.height * 0.84);
        ctx.strokeRect(r.altar.x - r.altar.width * 0.42, r.altar.y - r.altar.height * 0.42, r.altar.width * 0.84, r.altar.height * 0.84);

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

        if (r.altar.braziers) {
          for (const bz of r.altar.braziers) {
            const grad = ctx.createRadialGradient(bz.x, bz.y, 2, bz.x, bz.y, 22);
            grad.addColorStop(0, 'rgba(255, 160, 40, 0.45)');
            grad.addColorStop(1, 'rgba(255, 100, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(bz.x, bz.y, 22, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#302d24';
            ctx.beginPath();
            ctx.arc(bz.x, bz.y, bz.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#15130f';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = '#fbc531';
            ctx.beginPath();
            ctx.arc(bz.x, bz.y, bz.radius * 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

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

          ctx.fillStyle = 'rgba(20, 20, 20, 0.28)';
          ctx.fillRect(-blk.w * 0.5 + 2, -blk.h * 0.5 + 2, blk.w, blk.h);

          ctx.fillStyle = '#aba493';
          ctx.fillRect(-blk.w * 0.5, -blk.h * 0.5, blk.w, blk.h);
          ctx.strokeStyle = '#383329';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-blk.w * 0.5, -blk.h * 0.5, blk.w, blk.h);

          ctx.restore();
        }
      }

      // 10. Ruin Name Tag Banner
      if (r.name) {
        ctx.save();
        ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
        const textWidth = ctx.measureText(r.name).width;
        const tagY = r.cy - (r.mainH || (r.radius ? r.radius * 2 : 100)) * 0.5 - 14;

        ctx.fillStyle = 'rgba(24, 24, 27, 0.75)';
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 1;
        ctx.fillRect(r.cx - textWidth * 0.5 - 8, tagY - 12, textWidth + 16, 20);
        ctx.strokeRect(r.cx - textWidth * 0.5 - 8, tagY - 12, textWidth + 16, 20);

        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'center';
        ctx.fillText(r.name, r.cx, tagY + 2);
        ctx.restore();
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
    const cs = map.grid.cellSize;

    ctx.save();
    // 1. Bedrock cavern void background (illuminated charcoal slate)
    ctx.fillStyle = '#1e222b';
    ctx.fillRect(0, 0, W, H);

    // 2. Cavern Floor Passages & Chambers Fill (Clear, readable natural slate stone)
    const baseFloorColor = '#475161';
    const walkwayColor = '#5e6b7e';
    const wallShadow = '#141820';

    // Outer rock wall shadow buffer
    cn.passages.forEach(p => {
      ctx.save();
      ctx.strokeStyle = wallShadow;
      ctx.lineWidth = p.width + 14;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(p.p1.x, p.p1.y);
      ctx.quadraticCurveTo(p.control.x, p.control.y, p.p2.x, p.p2.y);
      ctx.stroke();
      ctx.restore();
    });

    cn.chambers.forEach(ch => {
      ctx.save();
      ctx.fillStyle = wallShadow;
      ctx.beginPath();
      ctx.ellipse(ch.x, ch.y, ch.rx + 7, ch.ry + 7, ch.angle || 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Passages Inner Walkway
    cn.passages.forEach(p => {
      ctx.save();
      ctx.strokeStyle = baseFloorColor;
      ctx.lineWidth = p.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(p.p1.x, p.p1.y);
      ctx.quadraticCurveTo(p.control.x, p.control.y, p.p2.x, p.p2.y);
      ctx.stroke();

      // Footpath dirt/gravel wear highlight
      ctx.strokeStyle = walkwayColor;
      ctx.lineWidth = p.width * 0.55;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = p.width * 0.25;
      ctx.stroke();
      ctx.restore();
    });

    // Chambers Inner Floor
    cn.chambers.forEach(ch => {
      ctx.save();
      ctx.fillStyle = baseFloorColor;
      ctx.beginPath();
      ctx.ellipse(ch.x, ch.y, ch.rx, ch.ry, ch.angle || 0, 0, Math.PI * 2);
      ctx.fill();

      // Stone floor tactile concentric rings
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(ch.x, ch.y, ch.rx * 0.72, ch.ry * 0.72, ch.angle || 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(ch.x, ch.y, ch.rx * 0.42, ch.ry * 0.42, ch.angle || 0, 0, Math.PI * 2);
      ctx.stroke();

      // Subtle light center wash
      const cGrad = ctx.createRadialGradient(ch.x, ch.y, 4, ch.x, ch.y, Math.min(ch.rx, ch.ry));
      cGrad.addColorStop(0, 'rgba(255, 255, 255, 0.09)');
      cGrad.addColorStop(1, 'rgba(0, 0, 0, 0.04)');
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.ellipse(ch.x, ch.y, ch.rx, ch.ry, ch.angle || 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 3. Subterranean Chasm / Void
    if (cn.chasm) {
      const chm = cn.chasm;
      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = chm.width;
      ctx.beginPath();
      ctx.moveTo(chm.x1, chm.y1);
      ctx.lineTo(chm.x2, chm.y2);
      ctx.stroke();

      // Jagged abyss edge cracks
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 2;
      for (let y = chm.y1; y <= chm.y2; y += 30) {
        ctx.beginPath();
        ctx.moveTo(chm.x1 - chm.width * 0.5, y);
        ctx.lineTo(chm.x1 - chm.width * 0.5 - 12, y + 8);
        ctx.moveTo(chm.x1 + chm.width * 0.5, y + 15);
        ctx.lineTo(chm.x1 + chm.width * 0.5 + 12, y + 22);
        ctx.stroke();
      }

      // Chasm Bridges
      if (chm.bridges) {
        chm.bridges.forEach(br => {
          ctx.save();
          ctx.translate(br.x, br.y);
          ctx.rotate(br.angle || 0);

          if (br.type === 'stone') {
            ctx.fillStyle = '#52525b';
            ctx.strokeStyle = '#18181b';
            ctx.lineWidth = 2;
            ctx.fillRect(-br.length * 0.5, -br.width * 0.5, br.length, br.width);
            ctx.strokeRect(-br.length * 0.5, -br.width * 0.5, br.length, br.width);
            // Parapet railings
            ctx.fillStyle = '#3f3f46';
            ctx.fillRect(-br.length * 0.5, -br.width * 0.5 - 2, br.length, 3);
            ctx.fillRect(-br.length * 0.5, br.width * 0.5 - 1, br.length, 3);
          } else {
            // Suspended Wooden Plank Bridge
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-br.length * 0.5, -br.width * 0.5);
            ctx.lineTo(br.length * 0.5, -br.width * 0.5);
            ctx.moveTo(-br.length * 0.5, br.width * 0.5);
            ctx.lineTo(br.length * 0.5, br.width * 0.5);
            ctx.stroke();

            // Planks
            for (let px = -br.length * 0.5 + 4; px <= br.length * 0.5 - 4; px += 8) {
              ctx.fillStyle = '#92400e';
              ctx.fillRect(px - 3, -br.width * 0.5, 6, br.width);
              ctx.strokeStyle = '#451a03';
              ctx.lineWidth = 1;
              ctx.strokeRect(px - 3, -br.width * 0.5, 6, br.width);
            }
          }
          ctx.restore();
        });
      }
      ctx.restore();
    }

    // 4. Subterranean Bioluminescent Pool
    if (cn.pool) {
      const p = cn.pool;
      ctx.save();

      // Deep water pool
      const wGrad = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, p.rx);
      wGrad.addColorStop(0, '#06b6d4');
      wGrad.addColorStop(0.65, '#0891b2');
      wGrad.addColorStop(1, '#0e7490');
      ctx.fillStyle = wGrad;
      ctx.shadowColor = p.glowColor || 'rgba(6, 182, 212, 0.6)';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ripples
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx * 0.6, p.ry * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Stepping stones
      if (p.steppingStones) {
        p.steppingStones.forEach(st => {
          ctx.fillStyle = '#52525b';
          ctx.strokeStyle = '#18181b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Moss highlight
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(st.x - 2, st.y - 2, st.r * 0.45, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.restore();
    }

    // 5. Spiderwebs
    if (cn.webs) {
      cn.webs.forEach(w => {
        ctx.save();
        ctx.strokeStyle = 'rgba(244, 244, 245, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        const spokes = 8;
        for (let i = 0; i < spokes; i++) {
          const a = (i / spokes) * Math.PI * 2;
          ctx.moveTo(w.x, w.y);
          ctx.lineTo(w.x + Math.cos(a) * w.radius, w.y + Math.sin(a) * w.radius);
        }
        for (let ring = 0.3; ring <= 1.0; ring += 0.3) {
          ctx.moveTo(w.x + w.radius * ring, w.y);
          ctx.arc(w.x, w.y, w.radius * ring, 0, Math.PI * 2);
        }
        ctx.stroke();
        ctx.restore();
      });
    }

    // 6. Stalagmites with 3D Conical Shading
    if (cn.stalagmites) {
      cn.stalagmites.forEach(st => {
        ctx.save();
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(st.x + 3, st.y + 4, st.radius * 1.1, st.radius * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Base Rock
        ctx.fillStyle = '#52525b';
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Conical Peak / Top highlight
        ctx.fillStyle = '#a1a1aa';
        ctx.beginPath();
        ctx.arc(st.x - st.radius * 0.25, st.y - st.radius * 0.25, st.radius * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    // 7. Glowing Crystals
    if (cn.crystals) {
      cn.crystals.forEach(cr => {
        ctx.save();
        // Glow aura
        const cGrad = ctx.createRadialGradient(cr.x, cr.y, 2, cr.x, cr.y, cs * 1.8);
        cGrad.addColorStop(0, cr.color);
        cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = cGrad;
        ctx.beginPath();
        ctx.arc(cr.x, cr.y, cs * 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Crystal Facet Diamond
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = cr.color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cr.x, cr.y - cr.radius * 1.3);
        ctx.lineTo(cr.x + cr.radius, cr.y);
        ctx.lineTo(cr.x, cr.y + cr.radius * 1.3);
        ctx.lineTo(cr.x - cr.radius, cr.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
    }

    // 8. Glowing Cave Mushrooms
    if (cn.mushrooms) {
      cn.mushrooms.forEach(m => {
        ctx.save();
        ctx.fillStyle = m.color;
        ctx.shadowColor = m.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    // 9. Elevated Ledge Stairs
    if (cn.elevatedLedge) {
      const el = cn.elevatedLedge;
      const st = el.stairs;
      ctx.save();
      ctx.fillStyle = '#71717a';
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 1.8;
      ctx.fillRect(st.x, st.y, st.w, st.h);
      ctx.strokeRect(st.x, st.y, st.w, st.h);

      // Steps
      const numSteps = 5;
      for (let s = 1; s < numSteps; s++) {
        const sy = st.y + (s / numSteps) * st.h;
        ctx.beginPath();
        ctx.moveTo(st.x, sy);
        ctx.lineTo(st.x + st.w, sy);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 10. Wall Torches
    if (cn.torches) {
      cn.torches.forEach(t => {
        ctx.save();
        const tGrad = ctx.createRadialGradient(t.x, t.y, 3, t.x, t.y, t.lightRadius || cs * 4);
        tGrad.addColorStop(0, 'rgba(251, 146, 60, 0.7)');
        tGrad.addColorStop(0.4, 'rgba(249, 115, 22, 0.25)');
        tGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = tGrad;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.lightRadius || cs * 4, 0, Math.PI * 2);
        ctx.fill();

        // Torch Sconce & Flame
        ctx.fillStyle = '#78350f';
        ctx.fillRect(t.x - 2, t.y - 2, 4, 8);
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(t.x, t.y - 3, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(t.x, t.y - 3, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    // Chamber Tactical Name Labels
    cn.chambers.forEach(ch => {
      if (ch.name) {
        ctx.save();
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = 'rgba(244, 244, 245, 0.75)';
        ctx.textAlign = 'center';
        ctx.fillText(ch.name, ch.x, ch.y - ch.ry * 0.6);
        ctx.restore();
      }
    });

    ctx.restore();
  }

  renderDungeonComplex(ctx, map, W, H) {
    const dc = map.dungeonComplex;
    if (!dc) return;
    const cs = map.grid.cellSize;

    ctx.save();
    // 1. Solid Stone Bedrock Fill
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, W, H);

    // 2. Corridors
    dc.corridors.forEach(c => {
      ctx.save();
      // Bedrock Wall outline
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = c.width + 12;
      ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(c.x1, c.y1);
      ctx.lineTo(c.x2, c.y2);
      ctx.stroke();

      // Flagstone floor
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = c.width;
      ctx.beginPath();
      ctx.moveTo(c.x1, c.y1);
      ctx.lineTo(c.x2, c.y2);
      ctx.stroke();
      ctx.restore();
    });

    // 3. Rooms
    dc.rooms.forEach(rm => {
      ctx.save();
      // Outer thick stone walls
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 10;
      ctx.strokeRect(rm.x, rm.y, rm.w, rm.h);

      // Room Floor with stone flagstones
      ctx.fillStyle = '#27272a';
      ctx.fillRect(rm.x, rm.y, rm.w, rm.h);

      // Flagstone mortar lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let x = rm.x; x <= rm.x + rm.w; x += cs) {
        ctx.beginPath(); ctx.moveTo(x, rm.y); ctx.lineTo(x, rm.y + rm.h); ctx.stroke();
      }
      for (let y = rm.y; y <= rm.y + rm.h; y += cs) {
        ctx.beginPath(); ctx.moveTo(rm.x, y); ctx.lineTo(rm.x + rm.w, y); ctx.stroke();
      }

      // Altar Dais if present
      if (rm.altarDais) {
        const ad = rm.altarDais;
        ctx.fillStyle = '#3f3f46';
        ctx.strokeStyle = '#71717a';
        ctx.lineWidth = 2;
        ctx.fillRect(ad.x, ad.y, ad.w, ad.h);
        ctx.strokeRect(ad.x, ad.y, ad.w, ad.h);

        // Bloodstone Altar Table
        ctx.fillStyle = '#7f1d1d';
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2;
        ctx.fillRect(ad.x + ad.w * 0.25, ad.y + ad.h * 0.25, ad.w * 0.5, ad.h * 0.5);
        ctx.strokeRect(ad.x + ad.w * 0.25, ad.y + ad.h * 0.25, ad.w * 0.5, ad.h * 0.5);
      }
      ctx.restore();
    });

    // 4. Subterranean Canal / Sewer
    if (dc.canal) {
      const cn = dc.canal;
      ctx.save();
      ctx.fillStyle = cn.waterColor || '#0e7490';
      ctx.fillRect(0, cn.y, W, cn.height);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      for (let x = 20; x < W; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, cn.y + cn.height * 0.3);
        ctx.lineTo(x + 25, cn.y + cn.height * 0.3);
        ctx.moveTo(x + 30, cn.y + cn.height * 0.7);
        ctx.lineTo(x + 55, cn.y + cn.height * 0.7);
        ctx.stroke();
      }

      // Canal Bridges
      if (cn.bridges) {
        cn.bridges.forEach(br => {
          ctx.fillStyle = '#52525b';
          ctx.strokeStyle = '#18181b';
          ctx.lineWidth = 2;
          ctx.fillRect(br.x, br.y, br.w, br.h);
          ctx.strokeRect(br.x, br.y, br.w, br.h);
        });
      }
      ctx.restore();
    }

    // 5. Massive Carved Pillars
    if (dc.pillars) {
      dc.pillars.forEach(p => {
        ctx.save();
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(p.x + 3, p.y + 3, cs * 0.48, 0, Math.PI * 2);
        ctx.fill();

        // Pillar Base
        ctx.fillStyle = '#52525b';
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, cs * 0.48, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner Fluting Ring
        ctx.fillStyle = '#71717a';
        ctx.beginPath();
        ctx.arc(p.x, p.y, cs * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    // 6. Stone Sarcophagi
    if (dc.sarcophagi) {
      dc.sarcophagi.forEach(s => {
        ctx.save();
        ctx.fillStyle = s.isMaster ? '#78350f' : '#3f3f46';
        ctx.strokeStyle = s.isMaster ? '#eab308' : '#18181b';
        ctx.lineWidth = s.isMaster ? 2.5 : 1.8;
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.strokeRect(s.x, s.y, s.w, s.h);

        // Carved relief on lid
        ctx.strokeStyle = s.isMaster ? '#fde047' : '#71717a';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(s.x + 3, s.y + 3, s.w - 6, s.h - 6);
        ctx.beginPath();
        ctx.moveTo(s.x + s.w * 0.3, s.y + s.h * 0.5);
        ctx.lineTo(s.x + s.w * 0.7, s.y + s.h * 0.5);
        ctx.stroke();
        ctx.restore();
      });
    }

    // 7. Iron Prison Cells
    if (dc.prisonCells) {
      dc.prisonCells.forEach(cell => {
        ctx.save();
        // Straw bedding
        ctx.fillStyle = '#ca8a04';
        ctx.fillRect(cell.x + 4, cell.y + 4, cell.w * 0.45, cell.h * 0.4);

        // Cell Iron Bars
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 2;
        const barY = cell.side === 'north' ? cell.y + cell.h : cell.y;
        for (let bx = cell.x; bx <= cell.x + cell.w; bx += 8) {
          ctx.beginPath();
          ctx.arc(bx, barY, 2, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      });
    }

    // 8. Furniture & Props
    if (dc.furniture) {
      dc.furniture.forEach(f => {
        ctx.save();
        if (f.type === 'table') {
          ctx.fillStyle = '#78350f';
          ctx.strokeStyle = '#451a03';
          ctx.lineWidth = 1.8;
          ctx.fillRect(f.x, f.y, f.w, f.h);
          ctx.strokeRect(f.x, f.y, f.w, f.h);
          // Parchment map on table
          ctx.fillStyle = '#fef3c7';
          ctx.fillRect(f.x + 4, f.y + 4, f.w * 0.4, f.h * 0.6);
        } else if (f.type === 'rack') {
          // Torture Rack
          ctx.fillStyle = '#52525b';
          ctx.strokeStyle = '#18181b';
          ctx.lineWidth = 1.8;
          ctx.fillRect(f.x, f.y, f.w, f.h);
          ctx.strokeRect(f.x, f.y, f.w, f.h);
          // Chains
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(f.x + 4, f.y + 4, f.w - 8, f.h - 8);
        } else if (f.type === 'chest') {
          // Gold Trimmed Loot Chest
          ctx.fillStyle = '#ca8a04';
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 1.8;
          ctx.fillRect(f.x, f.y, f.w, f.h);
          ctx.strokeRect(f.x, f.y, f.w, f.h);
        } else if (f.type === 'throne') {
          // Majestic Throne
          ctx.fillStyle = '#7f1d1d';
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 2;
          ctx.fillRect(f.x, f.y, f.w, f.h);
          ctx.strokeRect(f.x, f.y, f.w, f.h);
          ctx.fillStyle = '#3f3f46';
          ctx.fillRect(f.x, f.y, f.w, f.h * 0.3);
        } else if (f.type === 'bookshelf') {
          // Bookshelf
          ctx.fillStyle = '#451a03';
          ctx.strokeStyle = '#18181b';
          ctx.lineWidth = 1.5;
          ctx.fillRect(f.x, f.y, f.w, f.h);
          ctx.strokeRect(f.x, f.y, f.w, f.h);
          const colors = ['#dc2626', '#2563eb', '#16a34a', '#eab308', '#9333ea'];
          for (let bx = f.x + 3; bx < f.x + f.w - 4; bx += 5) {
            ctx.fillStyle = colors[Math.floor(bx) % colors.length];
            ctx.fillRect(bx, f.y + 2, 3, f.h - 4);
          }
        } else if (f.type === 'ritual_circle') {
          // Runic Ritual Circle
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.radius || 20, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
          ctx.lineWidth = 1.2;
          const rad = f.radius || 20;
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const ang = (i * 4 * Math.PI) / 5 - Math.PI * 0.5;
            const px = f.x + Math.cos(ang) * rad;
            const py = f.y + Math.sin(ang) * rad;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
        ctx.restore();
      });
    }

    // 8.5 Staircases & Level Transitions
    if (dc.stairs) {
      dc.stairs.forEach(st => {
        ctx.save();
        const numSteps = 6;
        const stepH = st.h / numSteps;

        if (st.type === 'stair_up') {
          ctx.fillStyle = '#3f3f46';
          ctx.fillRect(st.x, st.y, st.w, st.h);
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 2;
          ctx.strokeRect(st.x, st.y, st.w, st.h);

          for (let i = 0; i < numSteps; i++) {
            const sy = st.y + i * stepH;
            ctx.fillStyle = i % 2 === 0 ? '#52525b' : '#3f3f46';
            ctx.fillRect(st.x + 2, sy, st.w - 4, stepH);
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(st.x + 2, sy);
            ctx.lineTo(st.x + st.w - 2, sy);
            ctx.stroke();
          }

          ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
          ctx.fillStyle = '#fef08a';
          ctx.textAlign = 'center';
          ctx.fillText(st.label || '▲ На поверхность', st.x + st.w * 0.5, st.y - 4);

        } else if (st.type === 'stair_down') {
          ctx.fillStyle = '#09090b';
          ctx.fillRect(st.x, st.y, st.w, st.h);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.strokeRect(st.x, st.y, st.w, st.h);

          for (let i = 0; i < numSteps; i++) {
            const sy = st.y + i * stepH;
            const alpha = 1 - (i / numSteps) * 0.85;
            ctx.fillStyle = `rgba(39, 39, 42, ${alpha})`;
            ctx.fillRect(st.x + 2, sy, st.w - 4, stepH);
            ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(st.x + 2, sy + stepH);
            ctx.lineTo(st.x + st.w - 2, sy + stepH);
            ctx.stroke();
          }

          ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
          ctx.fillStyle = '#fca5a5';
          ctx.textAlign = 'center';
          ctx.fillText(st.label || '▼ В глубокий ярус', st.x + st.w * 0.5, st.y + st.h + 12);
        }
        ctx.restore();
      });
    }

    // 9. Doors & Portcullises & Secret Stone Passages
    if (dc.doors) {
      dc.doors.forEach(d => {
        ctx.save();
        ctx.translate(d.x, d.y);
        if (d.type === 'secret_stone') {
          ctx.fillStyle = '#3f3f46';
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 1.5;
          ctx.fillRect(-4, -d.width * 0.5, 8, d.width);
          ctx.strokeRect(-4, -d.width * 0.5, 8, d.width);
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 9px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText('✦', 0, 3);
        } else if (d.type === 'iron_portcullis' || d.type === 'iron_grate') {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, -d.width * 0.5);
          ctx.lineTo(0, d.width * 0.5);
          ctx.stroke();
        } else {
          ctx.fillStyle = d.isOpen ? '#92400e' : '#451a03';
          ctx.strokeStyle = '#18181b';
          ctx.lineWidth = 2;
          ctx.fillRect(-3, -d.width * 0.5, 6, d.width);
          ctx.strokeRect(-3, -d.width * 0.5, 6, d.width);
        }
        ctx.restore();
      });
    }

    // 10. Fiery Dungeon Braziers
    if (dc.braziers) {
      dc.braziers.forEach(b => {
        ctx.save();
        // Warm ambient light
        const bGrad = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, cs * 4.5);
        bGrad.addColorStop(0, 'rgba(251, 146, 60, 0.7)');
        bGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.25)');
        bGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, cs * 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Iron Bowl
        ctx.fillStyle = '#18181b';
        ctx.beginPath();
        ctx.arc(b.x, b.y, cs * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Burning Fire
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(b.x, b.y, cs * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(b.x, b.y, cs * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    // Room Tactical Name Labels
    dc.rooms.forEach(rm => {
      if (rm.name) {
        ctx.save();
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = 'rgba(244, 244, 245, 0.75)';
        ctx.textAlign = 'center';
        ctx.fillText(rm.name, rm.x + rm.w * 0.5, rm.y + 16);
        ctx.restore();
      }
    });

    ctx.restore();
  }

  renderArchipelago(ctx, map, W, H) {
    const ad = map.archipelagoData;
    if (!ad) return;
    const cs = map.grid.cellSize;

    ctx.save();
    // 1. Deep tropical ocean water
    const oGrad = ctx.createLinearGradient(0, 0, W, H);
    oGrad.addColorStop(0, '#0284c7');
    oGrad.addColorStop(1, '#0369a1');
    ctx.fillStyle = oGrad;
    ctx.fillRect(0, 0, W, H);

    // Ocean Waves
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.5;
    for (let y = 30; y < H; y += 50) {
      for (let x = 20; x < W; x += 110) {
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 0.5);
        ctx.stroke();
      }
    }

    // 2. Walkable Shallow Sandbars (Отмели / Броды)
    if (ad.sandbars) {
      ad.sandbars.forEach(sb => {
        ctx.save();
        // Turquoise shallows
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
        ctx.lineWidth = sb.width + 16;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sb.x1, sb.y1);
        ctx.lineTo(sb.x2, sb.y2);
        ctx.stroke();

        // Sandy bar
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = sb.width;
        ctx.stroke();

        // Sandbar label
        ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#78350f';
        ctx.textAlign = 'center';
        ctx.fillText(sb.name || 'Брод', (sb.x1 + sb.x2) * 0.5, (sb.y1 + sb.y2) * 0.5 - 6);
        ctx.restore();
      });
    }

    // 3. Islands
    ad.islands.forEach(isl => {
      ctx.save();
      // Shallow Turquoise Water Ring (Fresnel edge)
      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.beginPath();
      isl.points.forEach((p, idx) => {
        const dx = (p.x - isl.cx) * 1.35 + isl.cx;
        const dy = (p.y - isl.cy) * 1.35 + isl.cy;
        if (idx === 0) ctx.moveTo(dx, dy);
        else ctx.lineTo(dx, dy);
      });
      ctx.closePath();
      ctx.fill();

      // Golden Sand Beach
      ctx.fillStyle = isl.isVolcanic ? '#475569' : '#fde047';
      ctx.strokeStyle = isl.isVolcanic ? '#1e293b' : '#ca8a04';
      ctx.lineWidth = 3;
      ctx.beginPath();
      isl.points.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Lush Interior Tropical Jungle
      ctx.fillStyle = isl.isVolcanic ? '#334155' : '#15803d';
      ctx.beginPath();
      isl.points.forEach((p, idx) => {
        const dx = (p.x - isl.cx) * 0.65 + isl.cx;
        const dy = (p.y - isl.cy) * 0.65 + isl.cy;
        if (idx === 0) ctx.moveTo(dx, dy);
        else ctx.lineTo(dx, dy);
      });
      ctx.closePath();
      ctx.fill();

      // Palm Trees
      if (isl.palms) {
        isl.palms.forEach(pl => {
          ctx.save();
          // Palm trunk
          ctx.strokeStyle = '#a16207';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(pl.x, pl.y);
          ctx.quadraticCurveTo(pl.x + 4, pl.y - 6, pl.x + 8, pl.y - 14);
          ctx.stroke();

          // Palm fronds
          const topX = pl.x + 8;
          const topY = pl.y - 14;
          ctx.fillStyle = '#22c55e';
          for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
            ctx.beginPath();
            ctx.arc(topX + Math.cos(a) * (pl.size * 0.45), topY + Math.sin(a) * (pl.size * 0.45), pl.size * 0.35, 0, Math.PI * 2);
            ctx.fill();
          }
          // Palm heart
          ctx.fillStyle = '#166534';
          ctx.beginPath();
          ctx.arc(topX, topY, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      }

      // Campfire on Main Island
      if (isl.hasCampfire) {
        ctx.save();
        const cfX = isl.cx - cs * 0.5;
        const cfY = isl.cy;
        const cfGrad = ctx.createRadialGradient(cfX, cfY, 3, cfX, cfY, cs * 2.5);
        cfGrad.addColorStop(0, 'rgba(251, 146, 60, 0.8)');
        cfGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
        ctx.fillStyle = cfGrad;
        ctx.beginPath();
        ctx.arc(cfX, cfY, cs * 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(cfX, cfY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Island Name
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.textAlign = 'center';
      ctx.fillText(isl.name, isl.cx, isl.cy - isl.ry * 0.8);
      ctx.restore();
    });

    // 4. Hanging Rope Suspension Bridge
    if (ad.ropeBridge) {
      const rb = ad.ropeBridge;
      ctx.save();
      // Main support ropes
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(rb.x1, rb.y1 - 6);
      ctx.lineTo(rb.x2, rb.y2 - 6);
      ctx.moveTo(rb.x1, rb.y1 + 6);
      ctx.lineTo(rb.x2, rb.y2 + 6);
      ctx.stroke();

      // Wooden bridge treads
      const dist = Math.hypot(rb.x2 - rb.x1, rb.y2 - rb.y1);
      const numPlanks = Math.floor(dist / 8);
      for (let i = 0; i <= numPlanks; i++) {
        const t = i / numPlanks;
        const px = rb.x1 + (rb.x2 - rb.x1) * t;
        const py = rb.y1 + (rb.y2 - rb.y1) * t;
        ctx.fillStyle = '#b45309';
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1;
        ctx.fillRect(px - 2, py - 7, 4, 14);
        ctx.strokeRect(px - 2, py - 7, 4, 14);
      }
      ctx.restore();
    }

    // 5. Reefs
    if (ad.reefs) {
      ad.reefs.forEach(rf => {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(rf.x, rf.y, rf.r * 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rf.x, rf.y, rf.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
    }

    // 6. Smashed Shipwreck
    if (ad.shipwreck) {
      const sw = ad.shipwreck;
      ctx.save();
      ctx.translate(sw.x, sw.y);
      ctx.rotate(sw.angle);

      // Broken wooden hull
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, sw.length * 0.5, sw.width * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Shattered ribs
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 2.5;
      for (let r = -sw.length * 0.4; r <= sw.length * 0.4; r += 14) {
        ctx.beginPath();
        ctx.moveTo(r, -sw.width * 0.55);
        ctx.lineTo(r, sw.width * 0.55);
        ctx.stroke();
      }

      // Snapped mast
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(sw.length * 0.4, 20);
      ctx.stroke();
      ctx.restore();
    }

    // 7. Giant Kraken Tentacles
    if (ad.tentacles) {
      ad.tentacles.forEach(t => {
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate(t.angle);

        // Foaming water whirlpool
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(0, 0, t.thickness * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Writhing purple tentacle
        ctx.fillStyle = '#86198f';
        ctx.strokeStyle = '#4a044e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-t.thickness * 0.5, 0);
        ctx.quadraticCurveTo(t.thickness * 0.8, -t.length * 0.5, 0, -t.length);
        ctx.quadraticCurveTo(-t.thickness * 0.3, -t.length * 0.5, t.thickness * 0.5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // White sucker cups
        ctx.fillStyle = '#fdf4ff';
        for (let s = 10; s < t.length - 10; s += 12) {
          ctx.beginPath();
          ctx.arc(t.thickness * 0.35, -s, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
    }

    ctx.restore();
  }

  renderShips(ctx, map, W, H) {
    const sd = map.shipsData;
    if (!sd) return;
    const cs = map.grid.cellSize;

    ctx.save();
    // 1. Deep Ocean Background
    ctx.fillStyle = '#0369a1';
    ctx.fillRect(0, 0, W, H);

    // Dynamic wave ripples & foam
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1.5;
    for (let y = 20; y < H; y += 45) {
      for (let x = 20; x < W; x += 110) {
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 0.5);
        ctx.stroke();
      }
    }

    // 2. Render each ship
    sd.ships.forEach(ship => {
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.angle);

      const L = ship.length;
      const Wd = ship.width;

      // Foaming water wake around hull
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 0, L * 0.54, Wd * 0.56, 0, 0, Math.PI * 2);
      ctx.fill();

      // Outer Wooden Hull
      ctx.fillStyle = ship.woodColor || '#78350f';
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 4;
      ctx.beginPath();
      // Bow
      ctx.moveTo(-L * 0.5, 0);
      ctx.bezierCurveTo(-L * 0.45, -Wd * 0.46, -L * 0.1, -Wd * 0.5, L * 0.38, -Wd * 0.44);
      // Stern
      ctx.lineTo(L * 0.48, -Wd * 0.32);
      ctx.lineTo(L * 0.48, Wd * 0.32);
      // Port side
      ctx.lineTo(L * 0.38, Wd * 0.44);
      ctx.bezierCurveTo(-L * 0.1, Wd * 0.5, -L * 0.45, Wd * 0.46, -L * 0.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Bowsprit pole at front
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-L * 0.48, 0);
      ctx.lineTo(-L * 0.65, 0);
      ctx.stroke();

      // Inner Wooden Deck
      ctx.fillStyle = ship.deckColor || '#b45309';
      ctx.beginPath();
      ctx.ellipse(0, 0, L * 0.44, Wd * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();

      // Deck Planking lines
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.lineWidth = 1;
      for (let py = -Wd * 0.32; py <= Wd * 0.32; py += 10) {
        ctx.beginPath();
        ctx.moveTo(-L * 0.4, py);
        ctx.lineTo(L * 0.4, py);
        ctx.stroke();
      }

      // Forecastle & Quarterdeck Bulkhead Dividers
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-L * 0.22, -Wd * 0.36); ctx.lineTo(-L * 0.22, Wd * 0.36);
      ctx.moveTo(L * 0.22, -Wd * 0.36); ctx.lineTo(L * 0.22, Wd * 0.36);
      ctx.stroke();

      // Cargo Hatches
      if (ship.hatches) {
        ship.hatches.forEach(h => {
          ctx.fillStyle = '#451a03';
          ctx.fillRect(h.relX - h.w * 0.5, h.relY - h.h * 0.5, h.w, h.h);
          // Grating mesh
          ctx.strokeStyle = '#ca8a04';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(h.relX - h.w * 0.5, h.relY - h.h * 0.5, h.w, h.h);
          for (let gx = h.relX - h.w * 0.5 + 4; gx < h.relX + h.w * 0.5; gx += 6) {
            ctx.beginPath(); ctx.moveTo(gx, h.relY - h.h * 0.5); ctx.lineTo(gx, h.relY + h.h * 0.5); ctx.stroke();
          }
        });
      }

      // Broadside Cannons
      if (ship.cannons) {
        ship.cannons.forEach(can => {
          ctx.save();
          // Cannon Carriage (Wooden 4-wheel base)
          ctx.fillStyle = '#78350f';
          ctx.fillRect(can.relX - 6, can.relY - (can.side === 'port' ? 0 : 8), 12, 8);

          // Black Iron Barrel
          ctx.fillStyle = '#18181b';
          const canLen = cs * 0.75;
          const canW = cs * 0.25;
          const dirY = can.side === 'port' ? -1 : 1;
          ctx.fillRect(can.relX - canW * 0.5, can.relY, canW, canLen * dirY);
          ctx.restore();
        });
      }

      // Capstan & Ship's Helm
      if (ship.capstan) {
        ctx.fillStyle = '#78350f';
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ship.capstan.relX, ship.capstan.relY, ship.capstan.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      if (ship.helm) {
        ctx.fillStyle = '#78350f';
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ship.helm.relX, ship.helm.relY, ship.helm.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Deck Cargo (Barrels & Ammo Crates)
      if (ship.clutter) {
        ship.clutter.forEach(cl => {
          if (cl.type === 'barrel') {
            ctx.fillStyle = '#92400e';
            ctx.strokeStyle = '#451a03';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cl.relX, cl.relY, cs * 0.28, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          } else if (cl.type === 'crate') {
            ctx.fillStyle = '#ca8a04';
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 1.5;
            ctx.fillRect(cl.relX - cl.w * 0.5, cl.relY - cl.h * 0.5, cl.w, cl.h);
            ctx.strokeRect(cl.relX - cl.w * 0.5, cl.relY - cl.h * 0.5, cl.w, cl.h);
          }
        });
      }

      // Masts & Rigging
      if (ship.masts) {
        ship.masts.forEach(m => {
          ctx.save();
          // Cross Yardarm
          ctx.strokeStyle = '#451a03';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(m.relX, -m.yardarm * 0.5);
          ctx.lineTo(m.relX, m.yardarm * 0.5);
          ctx.stroke();

          // Furled White Canvas Sail
          if (m.sail) {
            ctx.fillStyle = '#fef3c7';
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.rect(m.relX - 4, -m.yardarm * 0.45, 8, m.yardarm * 0.9);
            ctx.fill();
            ctx.stroke();
          }

          // Mast Center Top
          ctx.fillStyle = '#451a03';
          ctx.strokeStyle = '#18181b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(m.relX, m.relY, m.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        });
      }

      // Ship Name Banner
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#fef3c7';
      ctx.textAlign = 'center';
      ctx.fillText(ship.name, 0, -Wd * 0.55);

      ctx.restore();
    });

    // 3. Boarding Planks & Gangways
    if (sd.boardingPlanks) {
      sd.boardingPlanks.forEach(bp => {
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

        // Treads
        const dist = Math.hypot(bp.x2 - bp.x1, bp.y2 - bp.y1);
        const steps = Math.floor(dist / 6);
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const px = bp.x1 + (bp.x2 - bp.x1) * t;
          const py = bp.y1 + (bp.y2 - bp.y1) * t;
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(px - 3, py - 4);
          ctx.lineTo(px + 3, py + 4);
          ctx.stroke();
        }
        ctx.restore();
      });
    }

    // 4. Grappling Hooks & Taut Lines
    if (sd.grapplingHooks) {
      sd.grapplingHooks.forEach(gh => {
        ctx.save();
        ctx.strokeStyle = '#fef3c7';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(gh.x1, gh.y1);
        ctx.lineTo(gh.x2, gh.y2);
        ctx.stroke();

        // Iron hook
        ctx.fillStyle = '#18181b';
        ctx.beginPath();
        ctx.arc(gh.x2, gh.y2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    // 5. Kraken Tentacles Wrapping Around Ship
    if (sd.tentacles) {
      sd.tentacles.forEach(t => {
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate(t.angle);

        // Foaming water
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(0, 0, t.thickness * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Writhing purple tentacle
        ctx.fillStyle = '#86198f';
        ctx.strokeStyle = '#4a044e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-t.thickness * 0.5, 0);
        ctx.quadraticCurveTo(t.thickness * 0.8, -t.length * 0.5, 0, -t.length);
        ctx.quadraticCurveTo(-t.thickness * 0.3, -t.length * 0.5, t.thickness * 0.5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // White sucker cups
        ctx.fillStyle = '#fdf4ff';
        for (let s = 10; s < t.length - 10; s += 12) {
          ctx.beginPath();
          ctx.arc(t.thickness * 0.35, -s, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
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

  renderTownSquare(ctx, map) {
    const sq = map.townSquare;
    ctx.save();

    ctx.fillStyle = '#6b7280';
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    ctx.fillRect(sq.x, sq.y, sq.w, sq.h);
    ctx.strokeRect(sq.x, sq.y, sq.w, sq.h);

    const tileSize = 20;
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 0.8;
    for (let x = sq.x; x < sq.x + sq.w; x += tileSize) {
      for (let y = sq.y; y < sq.y + sq.h; y += tileSize) {
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 4;
    ctx.strokeRect(sq.x, sq.y, sq.w, sq.h);

    const feat = sq.centerFeature;
    if (feat) {
      if (feat.type === 'fountain') {
        ctx.fillStyle = '#71717a';
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(feat.x, feat.y, feat.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(feat.x, feat.y, feat.radius * 0.75, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#a1a1aa';
        ctx.beginPath();
        ctx.arc(feat.x, feat.y, feat.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(224, 242, 254, 0.75)';
        ctx.beginPath();
        ctx.arc(feat.x, feat.y, feat.radius * 0.18, 0, Math.PI * 2);
        ctx.fill();

      } else if (feat.type === 'statue') {
        ctx.fillStyle = '#52525b';
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 2;
        ctx.fillRect(feat.x - 20, feat.y - 20, 40, 40);
        ctx.strokeRect(feat.x - 20, feat.y - 20, 40, 40);

        ctx.fillStyle = '#a1a1aa';
        ctx.beginPath();
        ctx.arc(feat.x, feat.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

      } else if (feat.type === 'pillory_board') {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(feat.x - 24, feat.y - 16, 48, 32);
        ctx.fillStyle = '#451a03';
        ctx.fillRect(feat.x - 18, feat.y - 4, 36, 8);
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(feat.x - 8, feat.y - 14, 16, 10);
      }
    }

    if (sq.marketStalls && sq.marketStalls.length) {
      for (const st of sq.marketStalls) {
        ctx.fillStyle = '#78350f';
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1.5;
        ctx.fillRect(st.x, st.y, st.w, st.h);
        ctx.strokeRect(st.x, st.y, st.w, st.h);

        ctx.fillStyle = st.goodsType === 'fruit' ? '#ef4444' : st.goodsType === 'potions' ? '#3b82f6' : '#d97706';
        ctx.fillRect(st.x + 4, st.y + 4, st.w - 8, st.h - 8);

        ctx.fillStyle = st.color;
        ctx.fillRect(st.x - 3, st.y - 3, st.w + 6, st.h * 0.5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(st.x + st.w * 0.25, st.y - 3, st.w * 0.2, st.h * 0.5);
        ctx.fillRect(st.x + st.w * 0.65, st.y - 3, st.w * 0.2, st.h * 0.5);
      }
    }

    ctx.restore();
  }

  renderCityStreets(ctx, map) {
    ctx.save();
    for (const str of map.cityStreets) {
      ctx.strokeStyle = '#57534e';
      ctx.lineWidth = str.width;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(str.x1, str.y1);
      ctx.lineTo(str.x2, str.y2);
      ctx.stroke();

      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(str.x1, str.y1);
      ctx.lineTo(str.x2, str.y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderPalisade(ctx, map) {
    const p = map.palisade;
    if (!p) return;
    ctx.save();

    const stakeR = 4;
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1;

    const drawStakeWall = (x1, y1, x2, y2) => {
      const d = Math.hypot(x2 - x1, y2 - y1);
      const count = Math.floor(d / (stakeR * 2));
      for (let i = 0; i <= count; i++) {
        const t = i / count;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;
        ctx.beginPath();
        ctx.arc(x, y, stakeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    };

    drawStakeWall(p.x1, p.y1, p.x2, p.y1);
    drawStakeWall(p.x1, p.y2, p.x2, p.y2);
    drawStakeWall(p.x1, p.y1, p.x1, p.y2);
    drawStakeWall(p.x2, p.y1, p.x2, p.y2);

    if (p.towers) {
      for (const tw of p.towers) {
        ctx.fillStyle = '#8f5d22';
        ctx.strokeStyle = '#3f2206';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tw.x, tw.y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.arc(tw.x, tw.y, 11, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (p.gates) {
      for (const gt of p.gates) {
        ctx.fillStyle = '#451a03';
        ctx.fillRect(gt.x - 18, gt.y - 18, 36, 36);
        ctx.fillStyle = '#b45309';
        ctx.fillRect(gt.x - 14, gt.y - 14, 28, 28);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(gt.x - 10, gt.y - 4, 20, 8);
      }
    }

    ctx.restore();
  }

  renderVillageCenter(ctx, map) {
    const vc = map.villageCenter;
    if (!vc) return;
    ctx.save();

    if (vc.hasWell) {
      ctx.fillStyle = '#6b7280';
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(vc.x, vc.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(vc.x, vc.y, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#78350f';
      ctx.fillRect(vc.x - 12, vc.y - 3, 24, 6);
    }

    if (vc.hasHaystack) {
      ctx.fillStyle = '#eab308';
      ctx.strokeStyle = '#854d0e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(vc.x + 30, vc.y + 10, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    if (vc.hasNoticeBoard) {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(vc.x - 30, vc.y - 10, 16, 6);
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(vc.x - 28, vc.y - 16, 12, 6);
    }

    ctx.restore();
  }

  renderVillageFences(ctx, map) {
    if (!map.villageFences) return;
    ctx.save();

    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.5;
    for (const f of map.villageFences) {
      ctx.strokeRect(f.x, f.y, f.w, f.h);
    }

    ctx.restore();
  }

  renderCityLanterns(ctx, map) {
    if (!map.cityLanterns) return;
    ctx.save();

    for (const l of map.cityLanterns) {
      const grad = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 28);
      grad.addColorStop(0, 'rgba(253, 224, 71, 0.6)');
      grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.25)');
      grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(l.x, l.y, 28, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.arc(l.x, l.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(l.x, l.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
