/**
 * Reactive State Manager for D&D 5e Battlemap Generator
 */

import { BIOMES } from './biomes.js';

export class BattlemapState {
  constructor() {
    this.listeners = new Set();

    this.cols = 30; // 30 cells (150 ft)
    this.rows = 20; // 20 cells (100 ft)
    this.cellSize = 48; // 48px per 5ft cell
    this.seed = Math.floor(Math.random() * 900000 + 100000).toString();
    this.biomeId = 'forest';

    this.toggles = {
      // Overland / Natural
      hasHouse: false,
      hasRiver: true,
      hasRoad: true,
      hasFields: false,
      hasRuins: false,
      hasCamp: false,
      hasMountains: false,
      hasPOI: false,
      poiType: 'random',
      poiChance: 0.1,
      treeDensity: 'dense',
      rockDensity: 'normal',
      lighting: 'day',

      // Cave
      cavePool: true,
      caveChasm: true,
      caveStalagmites: true,
      caveCrystals: true,
      caveMushrooms: true,
      caveWebs: true,
      caveElevatedLedge: true,
      caveTorches: true,

      // Dungeon
      dungeonPillars: true,
      dungeonBraziers: true,
      dungeonAltar: true,
      dungeonSarcophagi: true,
      dungeonPrison: true,
      dungeonCanal: true,
      dungeonFurniture: true,
      dungeonDoors: true,

      // Archipelago
      archSandbars: true,
      archRopeBridge: true,
      archShipwreck: true,
      archTentacles: true,
      archPalms: true,
      archCampfire: true,
      archReefs: true,
      archVolcanic: false,

      // Ship
      shipCannons: true,
      shipBoardingPlanks: true,
      shipGrapplingHooks: true,
      shipCargoHatches: true,
      shipClutter: true,
      shipTentacles: true,
      shipMastsSails: true,
      shipHelm: true
    };

    this.grid = {
      visible: true,
      style: 'lines',
      color: '#27272a',
      opacity: 0.35,
      showCoordinates: true
    };

    this.activeTool = 'pan'; // 'pan', 'measure', 'spell', 'token', 'fog_reveal', 'fog_hide'
    this.spellTemplate = {
      type: 'circle',
      radiusFeet: 20,
      angle: 0
    };

    this.tokenConfig = {
      name: 'Герой',
      type: 'pc',
      color: '#3b82f6',
      sizeCells: 1,
      speedFeet: 30,
      hp: 20
    };

    this.fogBrushSize = 48; // in px
    this.viewTransform = { x: 40, y: 40, scale: 1.0 };
    this.map = null;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event, data) {
    for (const listener of this.listeners) {
      try {
        listener(event, data, this);
      } catch (e) {
        console.error('[State] Listener error:', e);
      }
    }
  }

  setBiome(biomeId) {
    if (!BIOMES[biomeId]) return;
    this.biomeId = biomeId;
    const biome = BIOMES[biomeId];
    if (biome.defaultToggles) {
      this.toggles = { ...this.toggles, ...biome.defaultToggles };
    }
    if (biome.atmosphere) {
      this.toggles.lighting = biome.atmosphere;
    }
    this.notify('biome_changed', this.biomeId);
  }

  setSeed(seed) {
    this.seed = String(seed);
    this.notify('seed_changed', this.seed);
  }

  randomizeSeed() {
    this.setSeed(Math.floor(Math.random() * 900000 + 100000).toString());
  }

  setToggle(key, value) {
    this.toggles[key] = value;
    this.notify('toggle_changed', { key, value });
  }

  setGridOption(key, value) {
    this.grid[key] = value;
    this.notify('grid_changed', { key, value });
  }

  setTool(tool) {
    this.activeTool = tool;
    this.notify('tool_changed', tool);
  }

  setDimensions(cols, rows) {
    this.cols = Math.max(10, Math.min(60, cols));
    this.rows = Math.max(10, Math.min(60, rows));
    this.notify('dimensions_changed', { cols: this.cols, rows: this.rows });
  }
}
