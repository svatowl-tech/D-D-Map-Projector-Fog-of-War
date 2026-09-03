/**
 * Battlemap App Engine (D&D 5e Battlemap Generator)
 * Standalone JavaScript Application Orchestrator
 */

import { BattlemapState } from './js/state.js';
import { BattlemapGenerator } from './js/generator.js';
import { BattlemapRenderer } from './js/renderer.js';
import { BattlemapGrid } from './js/grid.js';
import { FogOfWar } from './js/fog.js';
import { TokenManager } from './js/tokens.js';
import { VehicleManager } from './js/vehicles.js';
import { BattlemapSync } from './js/sync.js';
import { ExportManager } from './js/export.js';
import { BIOMES } from './js/biomes.js';

export class BattlemapApp {
  constructor(containerId = 'openfl-content', options = {}) {
    this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!this.container) {
      this.container = document.body;
    }

    this.isProjectorView = new URLSearchParams(window.location.search).get('view') === 'projector';

    this.state = new BattlemapState();
    this.generator = null;
    this.renderer = null;
    this.grid = null;
    this.fog = null;
    this.tokens = new TokenManager();
    this.vehicles = new VehicleManager();
    this.sync = null;

    // View & Interaction state
    this.canvas = null;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.mouseWorld = { x: 0, y: 0 };
    this.animFrameId = null;

    this.init();
  }

  init() {
    // Read URL search params for seed & biome
    const params = new URLSearchParams(window.location.search);
    if (params.get('seed')) this.state.seed = params.get('seed');
    if (params.get('biome')) this.state.biomeId = params.get('biome');
    if (params.get('w')) this.state.cols = parseInt(params.get('w'), 10) || 30;
    if (params.get('h')) this.state.rows = parseInt(params.get('h'), 10) || 20;

    // Create Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'battlemap-canvas';
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.cursor = 'grab';
    this.container.appendChild(this.canvas);

    this.renderer = new BattlemapRenderer(this.canvas);
    this.grid = new BattlemapGrid(this.state.grid);
    this.fog = new FogOfWar(this.state.cols * this.state.cellSize, this.state.rows * this.state.cellSize);

    if (this.isProjectorView) {
      this.fog.dmMode = false; // Solid black fog for players
    }

    // Initialize Sync Channel
    this.sync = new BattlemapSync('dnd_battlemap_sync', (msg) => this.handleSyncMessage(msg));

    // Generate initial map
    this.regenerateMap();
    this.centerView();

    // Event listeners
    this.setupResize();
    this.setupMouseEvents();
    this.setupKeyboardEvents();

    if (!this.isProjectorView) {
      this.buildUI();
    } else {
      // In projector mode, request state from DM
      this.sync.send('REQUEST_STATE');
    }

    // Subscribe to state changes
    this.state.subscribe((event, data) => {
      if (['biome_changed', 'seed_changed', 'toggle_changed', 'dimensions_changed'].includes(event)) {
        this.regenerateMap();
        this.broadcastFullState();
      } else if (event === 'grid_changed') {
        this.grid.visible = this.state.grid.visible;
        this.grid.style = this.state.grid.style;
        this.grid.color = this.state.grid.color;
        this.grid.opacity = this.state.grid.opacity;
        this.grid.showCoordinates = this.state.grid.showCoordinates;
        this.requestRender();
      } else if (event === 'tool_changed') {
        this.canvas.style.cursor = data === 'pan' ? 'grab' : 'crosshair';
        this.requestRender();
      }
    });

    // Start render loop
    this.startLoop();
  }

  regenerateMap() {
    this.generator = new BattlemapGenerator({
      width: this.state.cols,
      height: this.state.rows,
      cellSize: this.state.cellSize,
      seed: this.state.seed,
      biomeId: this.state.biomeId,
      toggles: this.state.toggles
    });

    this.state.map = this.generator.generate();
    this.fog.resize(this.state.map.grid.totalWidth, this.state.map.grid.totalHeight);

    // Initialize procedural wagons & carts
    this.vehicles.clear();
    if (this.state.map.wagon) {
      this.vehicles.addVehicle(this.state.map.wagon);
    }

    this.requestRender();
  }

  centerView() {
    if (!this.state.map) return;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const mw = this.state.map.grid.totalWidth;
    const mh = this.state.map.grid.totalHeight;

    const scaleX = (cw * 0.9) / mw;
    const scaleY = (ch * 0.9) / mh;
    const scale = Math.min(scaleX, scaleY, 1.25);

    this.state.viewTransform.scale = Math.max(0.3, scale);
    this.state.viewTransform.x = (cw - mw * this.state.viewTransform.scale) * 0.5;
    this.state.viewTransform.y = (ch - mh * this.state.viewTransform.scale) * 0.5;
  }

  setupResize() {
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = this.container.getBoundingClientRect();
      const w = Math.floor(rect.width || window.innerWidth);
      const h = Math.floor(rect.height || window.innerHeight);

      if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.getContext('2d').scale(dpr, dpr);
      }
      this.requestRender();
    };

    window.addEventListener('resize', resize);
    setTimeout(resize, 50);
  }

  screenToWorld(sx, sy) {
    const vt = this.state.viewTransform;
    return {
      x: (sx - vt.x) / vt.scale,
      y: (sy - vt.y) / vt.scale
    };
  }

  setupMouseEvents() {
    const c = this.canvas;

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const vt = this.state.viewTransform;
      const newScale = Math.max(0.2, Math.min(3.5, vt.scale * zoomFactor));

      vt.x = mx - (mx - vt.x) * (newScale / vt.scale);
      vt.y = my - (my - vt.y) * (newScale / vt.scale);
      vt.scale = newScale;

      this.requestRender();
      if (!this.isProjectorView) {
        this.sync.send('SYNC_VIEW', vt);
      }
    }, { passive: false });

    c.addEventListener('mousedown', (e) => {
      const rect = c.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      this.mouseWorld = this.screenToWorld(sx, sy);
      this.dragStart = { x: sx, y: sy };
      this.isDragging = true;

      const tool = this.state.activeTool;

      if (tool === 'pan') {
        // Check if clicked a token to drag
        const clickedToken = this.tokens.getTokenAt(this.mouseWorld.x, this.mouseWorld.y, this.state.cellSize);
        if (clickedToken) {
          this.tokens.selectedTokenId = clickedToken.id;
          this.tokens.draggedToken = clickedToken;
          this.tokens.dragOffset = {
            x: clickedToken.x - this.mouseWorld.x,
            y: clickedToken.y - this.mouseWorld.y
          };
          c.style.cursor = 'move';
        } else {
          this.tokens.selectedTokenId = null;

          // Check if clicked a vehicle (wagon/cart) to drag
          const clickedVeh = this.vehicles.getVehicleAt(this.mouseWorld.x, this.mouseWorld.y);
          if (clickedVeh) {
            this.vehicles.selectedVehicleId = clickedVeh.id;
            this.vehicles.draggedVehicle = clickedVeh;
            this.vehicles.dragOffset = {
              x: clickedVeh.x - this.mouseWorld.x,
              y: clickedVeh.y - this.mouseWorld.y
            };
            c.style.cursor = 'move';
          } else {
            this.vehicles.selectedVehicleId = null;
            c.style.cursor = 'grabbing';
          }
        }
      } else if (tool === 'measure') {
        this.grid.activeMeasure = {
          x1: this.mouseWorld.x,
          y1: this.mouseWorld.y,
          x2: this.mouseWorld.x,
          y2: this.mouseWorld.y,
          active: true
        };
      } else if (tool === 'spell') {
        this.grid.activeSpellTemplate = {
          type: this.state.spellTemplate.type,
          radiusFeet: this.state.spellTemplate.radiusFeet,
          x: this.mouseWorld.x,
          y: this.mouseWorld.y,
          angle: 0
        };
      } else if (tool === 'token') {
        this.tokens.addToken({
          ...this.state.tokenConfig,
          x: this.mouseWorld.x,
          y: this.mouseWorld.y
        });
        this.broadcastTokens();
      } else if (tool === 'fog_reveal') {
        this.fog.enabled = true;
        this.fog.revealBrush(this.mouseWorld.x, this.mouseWorld.y, this.state.fogBrushSize);
        this.broadcastFog();
      } else if (tool === 'fog_hide') {
        this.fog.enabled = true;
        this.fog.hideBrush(this.mouseWorld.x, this.mouseWorld.y, this.state.fogBrushSize);
        this.broadcastFog();
      }

      this.requestRender();
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const rect = c.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      this.mouseWorld = this.screenToWorld(sx, sy);

      const tool = this.state.activeTool;

      if (tool === 'pan') {
        if (this.tokens.draggedToken) {
          this.tokens.draggedToken.x = this.mouseWorld.x + this.tokens.dragOffset.x;
          this.tokens.draggedToken.y = this.mouseWorld.y + this.tokens.dragOffset.y;
          this.broadcastTokens();
        } else if (this.vehicles.draggedVehicle) {
          const veh = this.vehicles.draggedVehicle;
          veh.x = this.mouseWorld.x + this.vehicles.dragOffset.x;
          veh.y = this.mouseWorld.y + this.vehicles.dragOffset.y;

          // If dragged near a road, orient wagon along road direction
          if (this.state.map && this.state.map.roads && this.state.map.roads.length) {
            for (const rd of this.state.map.roads) {
              const rPts = rd.path;
              for (let i = 0; i < rPts.length - 1; i++) {
                const p1 = rPts[i], p2 = rPts[i + 1];
                const mx = (p1.x + p2.x) * 0.5, my = (p1.y + p2.y) * 0.5;
                if (Math.hypot(veh.x - mx, veh.y - my) < rd.width * 1.2) {
                  veh.angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                  break;
                }
              }
            }
          }
          this.broadcastVehicles();
        } else {
          const dx = sx - this.dragStart.x;
          const dy = sy - this.dragStart.y;
          this.state.viewTransform.x += dx;
          this.state.viewTransform.y += dy;
          this.dragStart = { x: sx, y: sy };
          if (!this.isProjectorView) {
            this.sync.send('SYNC_VIEW', this.state.viewTransform);
          }
        }
      } else if (tool === 'measure' && this.grid.activeMeasure) {
        this.grid.activeMeasure.x2 = this.mouseWorld.x;
        this.grid.activeMeasure.y2 = this.mouseWorld.y;
      } else if (tool === 'spell' && this.grid.activeSpellTemplate) {
        const t = this.grid.activeSpellTemplate;
        if (t.type === 'cone' || t.type === 'line') {
          t.angle = Math.atan2(this.mouseWorld.y - t.y, this.mouseWorld.x - t.x);
        } else {
          t.x = this.mouseWorld.x;
          t.y = this.mouseWorld.y;
        }
      } else if (tool === 'fog_reveal') {
        this.fog.revealBrush(this.mouseWorld.x, this.mouseWorld.y, this.state.fogBrushSize);
        this.broadcastFog();
      } else if (tool === 'fog_hide') {
        this.fog.hideBrush(this.mouseWorld.x, this.mouseWorld.y, this.state.fogBrushSize);
        this.broadcastFog();
      }

      this.requestRender();
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      if (this.tokens.draggedToken) {
        // Snap to grid cell center
        const CS = this.state.cellSize;
        const col = Math.floor(this.tokens.draggedToken.x / CS);
        const row = Math.floor(this.tokens.draggedToken.y / CS);
        this.tokens.draggedToken.x = (col + 0.5) * CS;
        this.tokens.draggedToken.y = (row + 0.5) * CS;
        this.tokens.draggedToken = null;
        this.broadcastTokens();
      }
      if (this.vehicles.draggedVehicle) {
        this.vehicles.draggedVehicle = null;
        this.broadcastVehicles();
      }
      c.style.cursor = this.state.activeTool === 'pan' ? 'grab' : 'crosshair';
      this.requestRender();
    });
  }

  setupKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
      // Ignore if typing in text inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key.toLowerCase();
      if (key === ' ' || key === 'r') {
        e.preventDefault();
        // If a vehicle is selected, rotate it by 45 degrees
        if (this.vehicles.selectedVehicleId) {
          const v = this.vehicles.vehicles.find(veh => veh.id === this.vehicles.selectedVehicleId);
          if (v) {
            v.angle += Math.PI / 4;
            this.broadcastVehicles();
            this.requestRender();
            return;
          }
        }
        this.state.randomizeSeed();
      } else if (key === 'g') {
        this.state.setGridOption('visible', !this.state.grid.visible);
      } else if (key === 'f') {
        this.fog.enabled = !this.fog.enabled;
        this.broadcastFog();
        this.requestRender();
      } else if (key === 'm') {
        this.state.setTool('measure');
      } else if (key === 'p') {
        this.state.setTool('pan');
      } else if (key === 'v') {
        // Spawn an extra merchant wagon on the road / center
        this.vehicles.addVehicle({
          x: this.mouseWorld.x || 200,
          y: this.mouseWorld.y || 200,
          angle: 0
        });
        this.broadcastVehicles();
        this.requestRender();
      } else if (key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        ExportManager.exportImage(this.state.map, this.grid, this.fog, this.tokens);
      }
    });
  }

  broadcastFullState() {
    if (this.isProjectorView) return;
    this.sync.send('SYNC_STATE', {
      seed: this.state.seed,
      biomeId: this.state.biomeId,
      cols: this.state.cols,
      rows: this.state.rows,
      cellSize: this.state.cellSize,
      toggles: this.state.toggles,
      grid: this.state.grid,
      viewTransform: this.state.viewTransform,
      tokens: this.tokens.tokens,
      vehicles: this.vehicles.vehicles,
      fog: this.fog.exportState()
    });
  }

  broadcastFog() {
    if (this.isProjectorView) return;
    this.sync.send('SYNC_FOG', this.fog.exportState());
  }

  broadcastTokens() {
    if (this.isProjectorView) return;
    this.sync.send('SYNC_TOKENS', this.tokens.tokens);
  }

  broadcastVehicles() {
    if (this.isProjectorView) return;
    this.sync.send('SYNC_VEHICLES', this.vehicles.vehicles);
  }

  handleSyncMessage(msg) {
    if (!msg || !msg.type) return;

    if (msg.type === 'REQUEST_STATE') {
      this.broadcastFullState();
    } else if (msg.type === 'SYNC_STATE' && msg.payload) {
      const p = msg.payload;
      this.state.seed = p.seed;
      this.state.biomeId = p.biomeId;
      this.state.cols = p.cols;
      this.state.rows = p.rows;
      this.state.cellSize = p.cellSize;
      this.state.toggles = p.toggles;
      this.state.grid = p.grid;
      if (p.viewTransform) this.state.viewTransform = { ...p.viewTransform };
      if (p.tokens) this.tokens.tokens = p.tokens;
      this.regenerateMap();
      if (p.vehicles) this.vehicles.vehicles = p.vehicles;
      if (p.fog) this.fog.importState(p.fog);
    } else if (msg.type === 'SYNC_FOG' && msg.payload) {
      this.fog.importState(msg.payload);
      this.requestRender();
    } else if (msg.type === 'SYNC_TOKENS' && msg.payload) {
      this.tokens.tokens = msg.payload;
      this.requestRender();
    } else if (msg.type === 'SYNC_VEHICLES' && msg.payload) {
      this.vehicles.vehicles = msg.payload;
      this.requestRender();
    } else if (msg.type === 'SYNC_VIEW' && msg.payload) {
      this.state.viewTransform = { ...msg.payload };
      this.requestRender();
    }
  }

  startLoop() {
    const render = () => {
      if (this.state.map && this.renderer) {
        this.renderer.render(this.state.map, this.state.viewTransform);
        this.vehicles.render(this.renderer.ctx, this.state.map, this.state.viewTransform);
        this.grid.render(this.renderer.ctx, this.state.map, this.state.viewTransform);
        this.tokens.render(this.renderer.ctx, this.state.map, this.state.viewTransform);
        this.fog.render(this.renderer.ctx, this.state.viewTransform);
      }
      this.animFrameId = requestAnimationFrame(render);
    };
    this.animFrameId = requestAnimationFrame(render);
  }

  requestRender() {
    // Canvas loop handles 60fps rendering smoothly
  }

  buildUI() {
    // Inject Watabou-style clean floating panel
    const uiContainer = document.createElement('div');
    uiContainer.id = 'battlemap-ui-overlay';
    uiContainer.innerHTML = `
      <div class="bm-header">
        <div class="bm-title-row">
          <span class="bm-title" id="bm-header-title">Battlemap Generator</span>
          <span class="bm-dimensions" id="bm-header-dim">30×20 (150×100 ft)</span>
        </div>
        <div class="bm-quick-actions">
          <button id="btn-reroll" title="Сгенерировать случайную карту (Пробел / R)">🎲 Случайно (R)</button>
          <button id="btn-export-png" title="Скачать карту PNG">💾 PNG</button>
        </div>
      </div>

      <div class="bm-panel" id="bm-main-panel">
        <div class="bm-section">
          <label class="bm-section-label">Природный биом / Локация</label>
          <div class="bm-biome-grid" id="bm-biomes"></div>
        </div>

        <div class="bm-section">
          <label class="bm-section-label">Природные и тактические объекты</label>
          <div class="bm-toggle-grid">
            <label class="bm-checkbox"><input type="checkbox" id="chk-house"> <span>🏠 Одинокий дом/хижина</span></label>
            <label class="bm-checkbox"><input type="checkbox" id="chk-river"> <span>🌊 Река / Водоем</span></label>
            <label class="bm-checkbox"><input type="checkbox" id="chk-road"> <span>🛤️ Дорога / Тракт</span></label>
            <label class="bm-checkbox"><input type="checkbox" id="chk-fields"> <span>🌾 Вспаханные поля</span></label>
            <label class="bm-checkbox"><input type="checkbox" id="chk-ruins"> <span>🏛️ Древние руины</span></label>
            <label class="bm-checkbox"><input type="checkbox" id="chk-camp"> <span>⛺ Лагерь с костром</span></label>
            <label class="bm-checkbox"><input type="checkbox" id="chk-mountains"> <span>⛰️ Горы и скалы</span></label>
            <label class="bm-checkbox"><input type="checkbox" id="chk-poi"> <span>⭐ Тайник / POI</span></label>
          </div>
        </div>

        <div class="bm-row" id="bm-poi-row">
          <div class="bm-col">
            <label class="bm-label">Тип интересного места (POI)</label>
            <select id="sel-poi-type" class="bm-select">
              <option value="random">🎲 Случайное интересное место</option>
              <option value="cave_entrance">🕳️ Вход в темную пещеру</option>
              <option value="ancient_altar">🔮 Древний рунный алтарь</option>
              <option value="smuggler_cache">📦 Тайник контрабандистов</option>
              <option value="forgotten_crypt">🪦 Забытый склеп героя</option>
              <option value="treehouse_lookout">🌲 Дозорный пункт на дереве</option>
              <option value="witch_hut">🧙‍♀️ Хижина болотной ведьмы</option>
              <option value="stone_henge">🪨 Круг древних менгиров</option>
              <option value="ruined_watchtower">🏰 Разрушенная дозорная башня</option>
              <option value="monster_nest">🥚 Гнездо гигантского монстра</option>
              <option value="cursed_statue">🗿 Проклятый каменный идол</option>
              <option value="fairy_spring">✨ Волшебный источник фей</option>
              <option value="gallows_crossroad">⛓️ Виселица на перекрестке</option>
            </select>
          </div>
        </div>

        <div class="bm-row">
          <div class="bm-col">
            <label class="bm-label">Деревья</label>
            <select id="sel-trees" class="bm-select">
              <option value="none">Без деревьев</option>
              <option value="sparse">Редкие</option>
              <option value="normal">Обычные</option>
              <option value="dense" selected>Густой лес</option>
              <option value="impassable">Непроходимая чаща</option>
            </select>
          </div>
          <div class="bm-col">
            <label class="bm-label">Скалы / Камни</label>
            <select id="sel-rocks" class="bm-select">
              <option value="none">Нет</option>
              <option value="sparse">Мало</option>
              <option value="normal" selected>Умеренно</option>
              <option value="dense">Скалисто</option>
            </select>
          </div>
          <div class="bm-col">
            <label class="bm-label">Освещение</label>
            <select id="sel-light" class="bm-select">
              <option value="day">☀️ День</option>
              <option value="dusk">🌅 Закат / Сумерки</option>
              <option value="night">🌙 Ночь (Костер)</option>
              <option value="fog">🌫️ Туман</option>
              <option value="rain">🌧️ Дождь</option>
            </select>
          </div>
        </div>

        <div class="bm-section">
          <label class="bm-section-label">Инструменты мастера (D&D 5e)</label>
          <div class="bm-tool-bar">
            <button class="bm-tool-btn active" data-tool="pan" id="tool-pan">✋ Панорама</button>
            <button class="bm-tool-btn" data-tool="measure" id="tool-measure">📏 Линейка (5ft)</button>
            <button class="bm-tool-btn" data-tool="spell" id="tool-spell">✨ Заклинание (AoE)</button>
            <button class="bm-tool-btn" data-tool="fog_reveal" id="tool-fog-reveal">👁️ Открыть туман</button>
            <button class="bm-tool-btn" data-tool="fog_hide" id="tool-fog-hide">🌫️ Скрыть в туман</button>
          </div>
        </div>

        <div class="bm-row bm-seed-row">
          <div class="bm-col" style="flex: 2;">
            <label class="bm-label">Сид генерации (Seed)</label>
            <input type="text" id="inp-seed" class="bm-input" placeholder="Seed...">
          </div>
          <div class="bm-col">
            <label class="bm-label">Размер (клетки 5ft)</label>
            <select id="sel-size" class="bm-select">
              <option value="32x18">16:9 Full HD (32×18 - 160×90 ft)</option>
              <option value="48x27">16:9 Full HD (48×27 - 240×135 ft)</option>
              <option value="64x36">16:9 Full HD (64×36 - 320×180 ft)</option>
              <option value="20x15">20×15 (100×75 ft)</option>
              <option value="24x18">24×18 (120×90 ft)</option>
              <option value="30x20" selected>30×20 (150×100 ft)</option>
              <option value="40x30">40×30 (200×150 ft)</option>
              <option value="50x35">50×35 (250×175 ft)</option>
            </select>
          </div>
        </div>

        <div class="bm-footer-row">
          <button id="btn-export-vtt" class="bm-btn-secondary">Export VTT (JSON)</button>
          <button id="btn-share-url" class="bm-btn-secondary">Поделиться ссылкой</button>
          <button id="btn-clear-tokens" class="bm-btn-secondary">Очистить токены</button>
        </div>
      </div>
    `;

    this.container.appendChild(uiContainer);
    this.bindUIEvents();
  }

  bindUIEvents() {
    const biomesList = [
      { id: 'forest', name: '🌲 Лес' },
      { id: 'road', name: '🛤️ Дорога' },
      { id: 'river', name: '🌊 Река' },
      { id: 'meadow', name: '🌾 Поля' },
      { id: 'swamp', name: '🐸 Болото' },
      { id: 'winter', name: '❄️ Зима / Снег' },
      { id: 'desert', name: '🏜️ Пески' },
      { id: 'ruins', name: '🏛️ Руины' },
      { id: 'cabin', name: '🏠 Хижина' },
      { id: 'village', name: '🏡 Деревня' },
      { id: 'city', name: '🏙️ Город' },
      { id: 'camp', name: '⛺ Лагерь' },
      { id: 'cave', name: '🕳️ Пещеры' },
      { id: 'dungeon', name: '🏰 Подземелье' },
      { id: 'archipelago', name: '🏝️ Архипелаг' },
      { id: 'ship', name: '⛵ Корабли' }
    ];

    const bGrid = document.getElementById('bm-biomes');
    biomesList.forEach(b => {
      const btn = document.createElement('button');
      btn.className = `bm-biome-btn ${b.id === this.state.biomeId ? 'active' : ''}`;
      btn.textContent = b.name;
      btn.onclick = () => {
        document.querySelectorAll('.bm-biome-btn').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        this.state.setBiome(b.id);
        this.syncCheckboxesWithState();
      };
      bGrid.appendChild(btn);
    });

    const chkHouse = document.getElementById('chk-house');
    const chkRiver = document.getElementById('chk-river');
    const chkRoad = document.getElementById('chk-road');
    const chkFields = document.getElementById('chk-fields');
    const chkRuins = document.getElementById('chk-ruins');
    const chkCamp = document.getElementById('chk-camp');
    const chkMountains = document.getElementById('chk-mountains');
    const chkPOI = document.getElementById('chk-poi');
    const selPOIType = document.getElementById('sel-poi-type');

    this.syncCheckboxesWithState = () => {
      chkHouse.checked = !!this.state.toggles.hasHouse;
      chkRiver.checked = !!this.state.toggles.hasRiver;
      chkRoad.checked = !!this.state.toggles.hasRoad;
      chkFields.checked = !!this.state.toggles.hasFields;
      chkRuins.checked = !!this.state.toggles.hasRuins;
      chkCamp.checked = !!this.state.toggles.hasCamp;
      if (chkMountains) chkMountains.checked = !!this.state.toggles.hasMountains;
      if (chkPOI) chkPOI.checked = !!this.state.toggles.hasPOI;
      if (selPOIType) selPOIType.value = this.state.toggles.poiType || 'random';
      document.getElementById('sel-trees').value = this.state.toggles.treeDensity;
      document.getElementById('sel-rocks').value = this.state.toggles.rockDensity;
      document.getElementById('sel-light').value = this.state.toggles.lighting;
      document.getElementById('inp-seed').value = this.state.seed;
      if (this.state.map) {
        document.getElementById('bm-header-title').textContent = this.state.map.encounterInfo.title;
        document.getElementById('bm-header-dim').textContent = `${this.state.cols}×${this.state.rows} (${this.state.cols * 5}×${this.state.rows * 5} ft)`;
      }
    };

    chkHouse.onchange = (e) => this.state.setToggle('hasHouse', e.target.checked);
    chkRiver.onchange = (e) => this.state.setToggle('hasRiver', e.target.checked);
    chkRoad.onchange = (e) => this.state.setToggle('hasRoad', e.target.checked);
    chkFields.onchange = (e) => this.state.setToggle('hasFields', e.target.checked);
    chkRuins.onchange = (e) => this.state.setToggle('hasRuins', e.target.checked);
    chkCamp.onchange = (e) => this.state.setToggle('hasCamp', e.target.checked);
    if (chkMountains) chkMountains.onchange = (e) => this.state.setToggle('hasMountains', e.target.checked);
    if (chkPOI) chkPOI.onchange = (e) => this.state.setToggle('hasPOI', e.target.checked);
    if (selPOIType) selPOIType.onchange = (e) => this.state.setToggle('poiType', e.target.value);

    document.getElementById('sel-trees').onchange = (e) => this.state.setToggle('treeDensity', e.target.value);
    document.getElementById('sel-rocks').onchange = (e) => this.state.setToggle('rockDensity', e.target.value);
    document.getElementById('sel-light').onchange = (e) => this.state.setToggle('lighting', e.target.value);

    document.getElementById('inp-seed').onchange = (e) => this.state.setSeed(e.target.value);

    document.getElementById('sel-size').onchange = (e) => {
      const [w, h] = e.target.value.split('x').map(Number);
      this.state.setDimensions(w, h);
      this.centerView();
    };

    document.getElementById('btn-reroll').onclick = () => this.state.randomizeSeed();

    document.getElementById('btn-export-png').onclick = () => {
      ExportManager.exportImage(this.state.map, this.grid, this.fog, this.tokens);
    };

    document.getElementById('btn-export-vtt').onclick = () => {
      ExportManager.exportVTTJson(this.state.map);
    };

    document.getElementById('btn-share-url').onclick = () => {
      const url = ExportManager.getShareUrl(this.state.map);
      navigator.clipboard.writeText(url);
      alert('Ссылка на карту скопирована в буфер обмена!');
    };

    document.getElementById('btn-clear-tokens').onclick = () => {
      this.tokens.clear();
      this.broadcastTokens();
      this.requestRender();
    };

    // Tool switching
    document.querySelectorAll('.bm-tool-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.bm-tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.setTool(btn.dataset.tool);
      };
    });

    this.syncCheckboxesWithState();
  }
}

// Global bootstrap for standalone embedding
if (typeof window !== 'undefined') {
  window.Battlemap = {
    init: (containerId, options) => new BattlemapApp(containerId, options),
    App: BattlemapApp
  };
}
