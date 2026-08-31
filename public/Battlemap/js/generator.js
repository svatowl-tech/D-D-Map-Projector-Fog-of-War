/**
 * Procedural Map Generation Engine for D&D 5e Battlemaps
 * Generates geometric and tactical encounter layouts adhering to 5ft grid scale
 */

import { PRNG, dist, lerp, clamp } from './prng.js';
import { BIOMES } from './biomes.js';
import { POIGenerator, POI_DICTIONARY } from './poi.js';

function getSegmentIntersection(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-6) return null;
  const u = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const v = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
    return {
      x: p1.x + u * (p2.x - p1.x),
      y: p1.y + u * (p2.y - p1.y),
      u,
      v
    };
  }
  return null;
}

export class BattlemapGenerator {
  constructor(options = {}) {
    this.width = options.width || 30;   // Grid width in 5ft cells
    this.height = options.height || 20; // Grid height in 5ft cells
    this.cellSize = options.cellSize || 48; // Canvas pixels per 5ft cell
    this.seed = options.seed || Math.floor(Math.random() * 1000000).toString();
    this.biomeId = options.biomeId || 'forest';
    this.toggles = {
      hasHouse: false,
      hasRiver: true,
      hasRoad: true,
      hasFields: false,
      hasRuins: false,
      hasCamp: false,
      hasCart: false,
      hasMountains: false,
      hasPOI: false,
      poiChance: 0.35, // 35% chance by default
      poiType: 'random',
      treeDensity: 'dense', // none, sparse, normal, dense, impassable
      rockDensity: 'normal', // none, sparse, normal, dense
      lighting: 'day',      // day, dusk, night, fog, rain
      ...options.toggles
    };
    this.prng = new PRNG(this.seed);
  }

  generate() {
    this.prng.setSeed(this.seed);
    const biome = BIOMES[this.biomeId] || BIOMES.forest;
    const totalCells = this.width * this.height;
    const areaFactor = Math.max(0.4, totalCells / 600); // 1.0 for 30x20

    const map = {
      seed: this.seed,
      biomeId: this.biomeId,
      biome: biome,
      areaFactor,
      grid: {
        cols: this.width,
        rows: this.height,
        cellSize: this.cellSize,
        cellFeet: 5,
        totalWidth: this.width * this.cellSize,
        totalHeight: this.height * this.cellSize
      },
      elevation: [],
      water: {
        hasRiver: this.toggles.hasRiver,
        path: [],
        banks: [],
        width: 0,
        isFrozen: this.biomeId === 'winter',
        bridge: null,
        pools: [],
        steppingStones: []
      },
      roads: [],
      faintTrail: null,
      fields: [],
      buildings: [],
      ruins: [],
      mountains: [],
      pois: [],
      camp: null,
      wagon: null,
      trees: [],
      bushes: [],
      treeClusters: [],
      fallenLogs: [],
      rocks: [],
      cliffs: [],
      clutter: {
        grassTufts: [],
        pebbles: [],
        flowers: [],
        mushrooms: [],
        twigs: [],
        puddles: [],
        cairns: [],
        wheelRuts: [],
        waterProps: []
      },
      decorations: [],
      lighting: this.toggles.lighting || biome.atmosphere || 'day',
      encounterInfo: {
        title: this.generateEncounterTitle(biome),
        description: biome.subtitle,
        dimensions: `${this.width}×${this.height} клеток (${this.width * 5}×${this.height * 5} футов)`
      }
    };

    const W = map.grid.totalWidth;
    const H = map.grid.totalHeight;

    // 1. Elevation field
    this.generateElevation(map, W, H);

    // Special Biome-Specific Structure Generators
    if (this.biomeId === 'cave') {
      this.generateCaveNetwork(map, W, H);
    } else if (this.biomeId === 'dungeon') {
      this.generateDungeonComplex(map, W, H);
    } else if (this.biomeId === 'archipelago') {
      this.generateArchipelago(map, W, H);
    } else if (this.biomeId === 'ship') {
      this.generateShips(map, W, H);
    }

    // 2. Mountains & Rocky Ridges (on large maps or mountainous biomes)
    if (this.biomeId !== 'cave' && this.biomeId !== 'dungeon' && this.biomeId !== 'ship') {
      if (this.toggles.hasMountains || this.biomeId === 'winter' || this.biomeId === 'desert' || (areaFactor >= 1.6 && this.prng.bool(0.65))) {
        this.generateMountains(map, W, H);
      }
    }

    // 3. Water / Rivers / Swamp pools
    if (this.toggles.hasRiver && this.biomeId !== 'cave' && this.biomeId !== 'ship') {
      this.generateRiver(map, W, H);
    } else if (this.biomeId === 'swamp') {
      this.generateSwampPools(map, W, H);
    }

    // 4. Roads & Paths
    if (this.toggles.hasRoad && this.biomeId !== 'cave' && this.biomeId !== 'dungeon' && this.biomeId !== 'ship' && this.biomeId !== 'archipelago') {
      this.generateRoads(map, W, H);
    }

    // 5. Check road & river intersection for bridge or stepping stones
    if (this.toggles.hasRiver && this.toggles.hasRoad && map.water.hasRiver) {
      this.generateBridge(map);
    }

    // 6. Farmland & Fields
    if (this.toggles.hasFields && this.biomeId !== 'cave' && this.biomeId !== 'dungeon' && this.biomeId !== 'ship') {
      this.generateFields(map, W, H);
    }

    // 7. House / Cabin / Settlement
    if ((this.toggles.hasHouse || this.biomeId === 'cabin') && this.biomeId !== 'cave' && this.biomeId !== 'ship') {
      this.generateHouse(map, W, H);
    }

    // 8. Ancient Ruins
    if ((this.toggles.hasRuins || this.biomeId === 'ruins') && this.biomeId !== 'ship') {
      this.generateRuins(map, W, H);
    }

    // 9. Bandit Camp / Outpost
    if ((this.toggles.hasCamp || this.biomeId === 'camp') && this.biomeId !== 'ship') {
      this.generateCamp(map, W, H);
    }

    // 10. Procedural Wagon / Cart on road
    if ((this.toggles.hasCart || this.biomeId === 'road') && this.biomeId !== 'cave' && this.biomeId !== 'dungeon' && this.biomeId !== 'ship') {
      this.generateWagon(map, W, H);
    }

    // 11. Points of Interest (POIs) / Интересные места
    this.generatePOIs(map, W, H);

    // 12. Rocks, Cliffs & Boulder Outcroppings
    if (this.biomeId !== 'ship') {
      this.generateRocks(map, W, H);
      this.generateCliffs(map, W, H);
    }

    // 13. Trees & Foliage
    if (this.biomeId !== 'ship' && this.biomeId !== 'dungeon') {
      this.generateTrees(map, W, H);
    }

    // 14. Environmental Micro-Clutter
    this.generateClutter(map, W, H);

    return map;
  }

  generateEncounterTitle(biome) {
    const prefixes = {
      forest: ['Шепчущая чаща', 'Волчья тропа', 'Вересковая поляна', 'Дубовая роща', 'Сумеречный лес'],
      road: ['Торговый тракт', 'Развилка трех дорог', 'Старый колейный путь', 'Придорожная засада', 'Имперский тракт'],
      river: ['Брод Серебрянки', 'Быстроречье', 'Зеленый перекат', 'Мост Каменщика', 'Речная переправа'],
      meadow: ['Пастбище ветров', 'Холмистые угодья', 'Вспаханный надел', 'Клеверный луг', 'Межевой клин'],
      swamp: ['Гниловодье', 'Трясина Блуждающих Огней', 'Черный зыбун', 'Мшистый ил', 'Топи виверн'],
      winter: ['Ледяной перевал', 'Хладный отрог', 'Заснеженная пустошь', 'Морозный тракт', 'Торосы Севера'],
      desert: ['Знойные барханы', 'Каньон Скорпионов', 'Пески Солнцепека', 'Высохшее русло', 'Красные утесы'],
      ruins: ['Святилище Древних', 'Забытый бастион', 'Разрушенная колоннада', 'Капище утренней звезды', 'Остатки цитадели'],
      cabin: ['Хижина лесничего', 'Одинокий хутор', 'Заимка охотника', 'Охотничья сторожка', 'Поместье на опушке'],
      camp: ['Стоянка разбойников', 'Кочевье наемников', 'Дозорный лагерь', 'Лагерь следопытов', 'Бивуак у костра']
    };
    const list = prefixes[this.biomeId] || prefixes.forest;
    return this.prng.choice(list);
  }

  generateElevation(map, W, H) {
    const res = 12;
    const cols = Math.ceil(W / res) + 1;
    const rows = Math.ceil(H / res) + 1;
    const grid = [];
    const scale = 0.0035;

    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        const x = c * res;
        const y = r * res;
        const elev = (this.prng.fbm2D(x * scale, y * scale, 3, 0.5, 2.0) + 1) * 0.5;
        grid[r][c] = elev;
      }
    }
    map.elevation = { res, cols, rows, data: grid };
  }

  generateRiver(map, W, H) {
    const isHorizontal = this.prng.bool(0.4);
    const riverWidth = this.prng.float(48, 84); // 1 to 2 cells wide
    map.water.width = riverWidth;

    const points = [];
    const numPoints = 16;

    let startX, startY, endX, endY;
    if (isHorizontal) {
      startX = -20;
      startY = this.prng.float(H * 0.25, H * 0.75);
      endX = W + 20;
      endY = this.prng.float(H * 0.25, H * 0.75);
    } else {
      startX = this.prng.float(W * 0.25, W * 0.75);
      startY = -20;
      endX = this.prng.float(W * 0.25, W * 0.75);
      endY = H + 20;
    }

    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      let x = lerp(startX, endX, t);
      let y = lerp(startY, endY, t);

      // Meander with noise
      const meander = Math.sin(t * Math.PI * 2.5) * 60 + this.prng.float(-20, 20);
      if (isHorizontal) {
        y += meander;
      } else {
        x += meander;
      }
      points.push({ x, y });
    }

    map.water.path = points;

    // Stepping stones if shallow
    if (this.prng.bool(0.4) && !map.water.isFrozen) {
      const midIdx = Math.floor(points.length * 0.4);
      const center = points[midIdx];
      const count = 5;
      for (let s = -2; s <= 2; s++) {
        const offset = (s / 2.5) * (riverWidth * 0.55);
        map.water.steppingStones.push({
          x: center.x + (isHorizontal ? 0 : offset),
          y: center.y + (isHorizontal ? offset : 0),
          radius: this.prng.float(6, 11)
        });
      }
    }
  }

  generateSwampPools(map, W, H) {
    const numPools = this.prng.int(4, 9);
    for (let i = 0; i < numPools; i++) {
      const cx = this.prng.float(W * 0.1, W * 0.9);
      const cy = this.prng.float(H * 0.1, H * 0.9);
      const rx = this.prng.float(35, 90);
      const ry = this.prng.float(25, 70);
      const angle = this.prng.float(0, Math.PI);
      map.water.pools.push({ cx, cy, rx, ry, angle });
    }
  }

  generateMountains(map, W, H) {
    const CS = map.grid.cellSize;
    const count = this.prng.int(1, map.areaFactor >= 2 ? 3 : 2);
    const mountains = [];

    for (let m = 0; m < count; m++) {
      // Pick a map corner or side edge for the mountain massif
      const corner = this.prng.choice(['top_left', 'top_right', 'bottom_left', 'bottom_right', 'top_edge', 'left_edge']);
      let cx = W * 0.2, cy = H * 0.2;
      if (corner === 'top_right') { cx = W * 0.8; cy = H * 0.2; }
      else if (corner === 'bottom_left') { cx = W * 0.2; cy = H * 0.8; }
      else if (corner === 'bottom_right') { cx = W * 0.8; cy = H * 0.8; }
      else if (corner === 'top_edge') { cx = W * 0.5; cy = H * 0.15; }
      else if (corner === 'left_edge') { cx = W * 0.15; cy = H * 0.5; }

      const baseRadius = this.prng.float(CS * 3.5, CS * 6.5) * Math.min(1.4, Math.sqrt(map.areaFactor));
      
      // Ridge peaks
      const peaks = [];
      const numPeaks = this.prng.int(2, 4);
      for (let p = 0; p < numPeaks; p++) {
        const ang = (p / numPeaks) * Math.PI * 1.5 + this.prng.float(-0.3, 0.3);
        const distToPeak = this.prng.float(baseRadius * 0.2, baseRadius * 0.6);
        const px = cx + Math.cos(ang) * distToPeak;
        const py = cy + Math.sin(ang) * distToPeak;

        // Faceted jagged mountain boundary
        const ridgePoints = [];
        const numPts = 10;
        for (let i = 0; i < numPts; i++) {
          const a = (i / numPts) * Math.PI * 2;
          const r = this.prng.float(baseRadius * 0.6, baseRadius * 1.15);
          ridgePoints.push({
            x: px + Math.cos(a) * r,
            y: py + Math.sin(a) * (r * 0.75)
          });
        }

        peaks.push({
          x: px,
          y: py,
          radius: baseRadius * 0.7,
          elevationHeight: this.prng.float(15, 35),
          ridgePoints
        });
      }

      // Scree and talus rocks around the foot of the mountain
      const scree = [];
      const screeCount = Math.floor(18 * map.areaFactor);
      for (let s = 0; s < screeCount; s++) {
        const sa = this.prng.float(0, Math.PI * 2);
        const sr = this.prng.float(baseRadius * 0.7, baseRadius * 1.35);
        scree.push({
          x: cx + Math.cos(sa) * sr,
          y: cy + Math.sin(sa) * sr,
          r: this.prng.float(4, 9),
          angle: this.prng.float(0, Math.PI)
        });
      }

      mountains.push({
        cx,
        cy,
        baseRadius,
        peaks,
        scree
      });
    }

    map.mountains = mountains;
  }

  generatePOIs(map, W, H) {
    const CS = map.grid.cellSize;
    const poiGen = new POIGenerator(this.prng, this.biomeId);

    // Determine how many POIs to spawn
    let spawnCount = 0;
    const chance = this.toggles.hasPOI ? 1.0 : (this.toggles.poiChance || 0.35);

    if (this.prng.bool(chance)) {
      spawnCount = 1;
      if (map.areaFactor >= 1.8 && this.prng.bool(0.6)) spawnCount = 2;
      if (map.areaFactor >= 3.0 && this.prng.bool(0.5)) spawnCount = 3;
    }

    if (spawnCount === 0) return;

    // Available POI keys
    const allPoiKeys = Object.keys(POI_DICTIONARY);
    const usedKeys = new Set();

    for (let i = 0; i < spawnCount; i++) {
      let chosenType = this.toggles.poiType && this.toggles.poiType !== 'random'
        ? this.toggles.poiType
        : null;

      if (!chosenType || usedKeys.has(chosenType)) {
        // Filter contextually suitable POIs
        let candidates = allPoiKeys.filter(k => !usedKeys.has(k));
        if (map.mountains.length > 0 && !usedKeys.has('cave_entrance')) {
          candidates = ['cave_entrance', ...candidates];
        }
        chosenType = this.prng.choice(candidates);
      }
      usedKeys.add(chosenType);

      // Find suitable position
      let px = W * 0.5, py = H * 0.5;
      let placed = false;

      // Special placement for cave entrance: place at base of mountain if mountains exist
      if (chosenType === 'cave_entrance' && map.mountains.length > 0) {
        const m = map.mountains[0];
        const ang = this.prng.float(Math.PI * 0.2, Math.PI * 0.8);
        px = clamp(m.cx + Math.cos(ang) * (m.baseRadius * 0.8), CS * 2, W - CS * 2);
        py = clamp(m.cy + Math.sin(ang) * (m.baseRadius * 0.8), CS * 2, H - CS * 2);
        placed = true;
      } else {
        // Search clear candidate space away from water, houses, camps
        for (let attempt = 0; attempt < 25; attempt++) {
          const testX = this.prng.float(CS * 2.5, W - CS * 2.5);
          const testY = this.prng.float(CS * 2.5, H - CS * 2.5);

          let conflict = false;
          // Check river
          if (map.water.path.length) {
            for (const wp of map.water.path) {
              if (dist(testX, testY, wp.x, wp.y) < map.water.width + 60) {
                conflict = true;
                break;
              }
            }
          }
          // Check buildings
          for (const b of map.buildings) {
            if (dist(testX, testY, b.x + b.width * 0.5, b.y + b.height * 0.5) < 140) {
              conflict = true;
              break;
            }
          }
          // Check camp
          if (map.camp && dist(testX, testY, map.camp.campfire.x, map.camp.campfire.y) < 140) {
            conflict = true;
          }
          // Check other POIs
          for (const existing of map.pois) {
            if (dist(testX, testY, existing.x, existing.y) < 160) {
              conflict = true;
              break;
            }
          }

          if (!conflict) {
            px = testX;
            py = testY;
            placed = true;
            break;
          }
        }
      }

      if (placed) {
        const poiInstance = poiGen.generatePOI(chosenType, px, py, CS);
        map.pois.push(poiInstance);
      }
    }
  }

  generateRoads(map, W, H) {
    const roads = [];
    const isLargeMap = map.areaFactor >= 1.6;

    // Primary road orientation
    let isHorizontal = this.prng.bool(0.6);
    if (this.toggles.hasRiver && map.water.path.length > 1) {
      const riverDx = Math.abs(map.water.path[map.water.path.length - 1].x - map.water.path[0].x);
      const riverDy = Math.abs(map.water.path[map.water.path.length - 1].y - map.water.path[0].y);
      isHorizontal = riverDx < riverDy;
    }

    // Main primary road
    const mainPoints = [];
    const numPts = isLargeMap ? 18 : 12;
    let sX, sY, eX, eY;

    if (isHorizontal) {
      sX = -20;
      sY = this.prng.float(H * 0.3, H * 0.7);
      eX = W + 20;
      eY = this.prng.float(H * 0.3, H * 0.7);
    } else {
      sX = this.prng.float(W * 0.3, W * 0.7);
      sY = -20;
      eX = this.prng.float(W * 0.3, W * 0.7);
      eY = H + 20;
    }

    for (let i = 0; i <= numPts; i++) {
      const t = i / numPts;
      let x = lerp(sX, eX, t);
      let y = lerp(sY, eY, t);
      const curve = Math.sin(t * Math.PI * 2) * (isLargeMap ? 48 : 35) + this.prng.float(-10, 10);
      if (isHorizontal) y += curve;
      else x += curve;
      mainPoints.push({ x, y });
    }

    roads.push({
      path: mainPoints,
      width: this.prng.float(28, 38), // ~6-8 feet wide
      type: 'main'
    });

    // On large maps (16:9 Full HD, 40x30, 48x27, 64x36): generate Grand Crossroads or secondary highways
    if (isLargeMap && this.prng.bool(0.7)) {
      const crossPoints = [];
      const numCrossPts = 14;
      let csX, csY, ceX, ceY;

      if (isHorizontal) {
        // Vertical crossing road
        csX = this.prng.float(W * 0.35, W * 0.65);
        csY = -20;
        ceX = this.prng.float(W * 0.35, W * 0.65);
        ceY = H + 20;
      } else {
        // Horizontal crossing road
        csX = -20;
        csY = this.prng.float(H * 0.35, H * 0.65);
        ceX = W + 20;
        ceY = this.prng.float(H * 0.35, H * 0.65);
      }

      // Ensure it meets main road in the middle
      const midMain = mainPoints[Math.floor(mainPoints.length / 2)];

      for (let j = 0; j <= numCrossPts; j++) {
        const t = j / numCrossPts;
        let cx = lerp(csX, ceX, t);
        let cy = lerp(csY, ceY, t);
        
        // Attract toward junction
        const junctionWeight = Math.sin(t * Math.PI);
        cx = lerp(cx, midMain.x, junctionWeight * 0.45) + this.prng.float(-8, 8);
        cy = lerp(cy, midMain.y, junctionWeight * 0.45) + this.prng.float(-8, 8);
        crossPoints.push({ x: cx, y: cy });
      }

      roads.push({
        path: crossPoints,
        width: this.prng.float(24, 32),
        type: 'secondary'
      });
    }

    // Secondary trail / fork
    const numBranches = isLargeMap ? this.prng.int(1, 3) : (this.prng.bool(0.4) ? 1 : 0);
    for (let b = 0; b < numBranches; b++) {
      const branchIdx = this.prng.int(2, mainPoints.length - 3);
      const branchOrigin = mainPoints[branchIdx];
      const branchPts = [{ x: branchOrigin.x, y: branchOrigin.y }];
      const endSide = this.prng.choice(['top', 'bottom', 'left', 'right']);
      let bEndX = W * 0.5, bEndY = H * 0.5;

      if (endSide === 'top') { bEndX = this.prng.float(W * 0.15, W * 0.85); bEndY = -20; }
      else if (endSide === 'bottom') { bEndX = this.prng.float(W * 0.15, W * 0.85); bEndY = H + 20; }
      else if (endSide === 'left') { bEndX = -20; bEndY = this.prng.float(H * 0.15, H * 0.85); }
      else { bEndX = W + 20; bEndY = this.prng.float(H * 0.15, H * 0.85); }

      for (let j = 1; j <= 6; j++) {
        const t = j / 6;
        let bx = lerp(branchOrigin.x, bEndX, t) + this.prng.float(-15, 15);
        let by = lerp(branchOrigin.y, bEndY, t) + this.prng.float(-15, 15);
        branchPts.push({ x: bx, y: by });
      }

      roads.push({
        path: branchPts,
        width: this.prng.float(16, 24),
        type: 'trail'
      });
    }

    map.roads = roads;
  }

  generateBridge(map) {
    if (!map.water.path || map.water.path.length < 2 || !map.roads || !map.roads.length) return;
    const road = map.roads[0];
    const rPts = road.path;
    const wPts = map.water.path;

    let intersectPt = null;
    let roadAngle = 0;
    let riverAngle = 0;

    // Strict segment-by-segment intersection
    for (let i = 0; i < rPts.length - 1; i++) {
      for (let j = 0; j < wPts.length - 1; j++) {
        const inter = getSegmentIntersection(rPts[i], rPts[i + 1], wPts[j], wPts[j + 1]);
        if (inter) {
          intersectPt = { x: inter.x, y: inter.y };
          roadAngle = Math.atan2(rPts[i + 1].y - rPts[i].y, rPts[i + 1].x - rPts[i].x);
          riverAngle = Math.atan2(wPts[j + 1].y - wPts[j].y, wPts[j + 1].x - wPts[j].x);
          break;
        }
      }
      if (intersectPt) break;
    }

    // Fallback: find closest approach if curves barely missed
    if (!intersectPt) {
      let minD = Infinity;
      for (let i = 0; i < rPts.length - 1; i++) {
        for (let j = 0; j < wPts.length - 1; j++) {
          const d = dist(rPts[i].x, rPts[i].y, wPts[j].x, wPts[j].y);
          if (d < minD) {
            minD = d;
            intersectPt = {
              x: (rPts[i].x + wPts[j].x) * 0.5,
              y: (rPts[i].y + wPts[j].y) * 0.5
            };
            roadAngle = Math.atan2(rPts[i + 1].y - rPts[i].y, rPts[i + 1].x - rPts[i].x);
            riverAngle = Math.atan2(wPts[j + 1].y - wPts[j].y, wPts[j + 1].x - wPts[j].x);
          }
        }
      }
      if (minD > 140) intersectPt = null;
    }

    if (intersectPt) {
      // Calculate angle between road and river to ensure bridge spans the entire water channel
      const angleDiff = Math.abs(roadAngle - riverAngle);
      const angleFactor = Math.max(0.45, Math.abs(Math.sin(angleDiff)));
      const baseSpan = (map.water.width / angleFactor);
      const bridgeLength = Math.max(map.water.width + 36, baseSpan + 32);
      const bridgeWidth = road.width + 12;

      map.water.bridge = {
        x: intersectPt.x,
        y: intersectPt.y,
        angle: roadAngle,
        length: bridgeLength,
        width: bridgeWidth,
        material: this.biomeId === 'ruins' ? 'stone' : 'wood'
      };
    }
  }

  generateFields(map, W, H) {
    const count = this.prng.int(2, 4);
    const CS = map.grid.cellSize;

    for (let i = 0; i < count; i++) {
      const cols = this.prng.int(4, 8);
      const rows = this.prng.int(4, 7);
      const startCol = this.prng.int(1, map.grid.cols - cols - 1);
      const startRow = this.prng.int(1, map.grid.rows - rows - 1);

      const fx = startCol * CS;
      const fy = startRow * CS;
      const fw = cols * CS;
      const fh = rows * CS;

      // Avoid placing completely over river
      if (map.water.path.length) {
        const center = { x: fx + fw * 0.5, y: fy + fh * 0.5 };
        let hitRiver = false;
        for (const wp of map.water.path) {
          if (dist(center.x, center.y, wp.x, wp.y) < map.water.width * 0.8) {
            hitRiver = true;
            break;
          }
        }
        if (hitRiver) continue;
      }

      const furrowAngle = this.prng.choice([0, Math.PI * 0.25, Math.PI * 0.5, Math.PI * 0.75]);
      map.fields.push({
        x: fx,
        y: fy,
        width: fw,
        height: fh,
        furrowAngle,
        hasFence: this.prng.bool(0.7),
        cropColor: this.biomeId === 'meadow' ? '#c4be7a' : '#b2c482'
      });
    }
  }

  generateHouse(map, W, H) {
    const CS = map.grid.cellSize;
    const isLargeMap = map.areaFactor >= 1.6;

    // Number of buildings to generate: 1 on small, 2-3 on large maps (Hamlet/Farmstead)
    const buildingCount = isLargeMap ? this.prng.int(2, 3) : 1;

    for (let bIdx = 0; bIdx < buildingCount; bIdx++) {
      let wCells, hCells, buildingType;
      if (bIdx === 0) {
        // Main Farmhouse / Manor
        wCells = this.prng.int(4, 6);
        hCells = this.prng.int(3, 5);
        buildingType = 'main_house';
      } else if (bIdx === 1) {
        // Barn / Stable
        wCells = this.prng.int(4, 5);
        hCells = this.prng.int(3, 4);
        buildingType = 'barn';
      } else {
        // Storehouse / Workshop / Shed
        wCells = this.prng.int(3, 4);
        hCells = this.prng.int(2, 3);
        buildingType = 'shed';
      }

      const houseW = wCells * CS;
      const houseH = hCells * CS;

      let bestX = CS * 3;
      let bestY = CS * 3;
      let targetRoadPt = null;
      let doorSide = 'south';

      // 1. If road exists: place house adjacent to road, facing directly toward road
      if (map.roads && map.roads.length && map.roads[0].path.length > 2) {
        const road = map.roads[bIdx % map.roads.length];
        const rPts = road.path;

        let bestScore = -Infinity;

        // Search candidates along the road
        const segStart = bIdx === 0 ? 2 : Math.floor(rPts.length * 0.4);
        const segEnd = Math.min(rPts.length - 2, segStart + 6);

        for (let i = segStart; i < segEnd; i++) {
          const p1 = rPts[i];
          const p2 = rPts[i + 1] || rPts[i];
          const segAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

          // Perpendicular normal vectors to road
          const n1 = { x: -Math.sin(segAngle), y: Math.cos(segAngle) };
          const n2 = { x: Math.sin(segAngle), y: -Math.cos(segAngle) };

          const setback = road.width * 0.5 + Math.max(houseW, houseH) * 0.5 + (bIdx === 0 ? 24 : 36 + bIdx * 20);

          for (const norm of [n1, n2]) {
            const cx = p1.x + norm.x * setback;
            const cy = p1.y + norm.y * setback;
            const hx = cx - houseW * 0.5;
            const hy = cy - houseH * 0.5;

            // Check canvas boundary margins
            if (hx < CS || hx + houseW > W - CS || hy < CS || hy + houseH > H - CS) continue;

            let score = 100;

            // Check collision with existing buildings
            for (const prevB of map.buildings) {
              const d = dist(cx, cy, prevB.x + prevB.width * 0.5, prevB.y + prevB.height * 0.5);
              if (d < Math.max(houseW, houseH) + Math.max(prevB.width, prevB.height) + 16) {
                score -= 2000;
              }
            }

            // River conflict check
            if (map.water.path.length) {
              for (const wp of map.water.path) {
                const d = dist(cx, cy, wp.x, wp.y);
                if (d < map.water.width + 70) {
                  score -= 1000;
                }
              }
            }

            // Distance from road check: optimal is 60-90px
            const distToRoad = dist(cx, cy, p1.x, p1.y);
            score += (150 - Math.abs(distToRoad - 75));

            if (score > bestScore) {
              bestScore = score;
              bestX = hx;
              bestY = hy;
              targetRoadPt = { x: p1.x, y: p1.y };

              // Determine door side facing the road
              const dx = p1.x - cx;
              const dy = p1.y - cy;
              if (Math.abs(dx) > Math.abs(dy)) {
                doorSide = dx > 0 ? 'east' : 'west';
              } else {
                doorSide = dy > 0 ? 'south' : 'north';
              }
            }
          }
        }
      } else {
        // No road: place in balanced open clearing
        bestX = CS * this.prng.int(3 + bIdx * 6, Math.max(4, map.grid.cols - wCells - 4));
        bestY = CS * this.prng.int(3, Math.max(4, map.grid.rows - hCells - 4));
        doorSide = this.prng.choice(['south', 'east']);
      }

      const doorPos = {
        side: doorSide,
        offset: 0.5
      };

      // Calculate door world coordinates
      let doorWorldX = bestX + houseW * 0.5;
      let doorWorldY = bestY + houseH;
      if (doorSide === 'north') doorWorldY = bestY;
      else if (doorSide === 'west') { doorWorldX = bestX; doorWorldY = bestY + houseH * 0.5; }
      else if (doorSide === 'east') { doorWorldX = bestX + houseW; doorWorldY = bestY + houseH * 0.5; }

      // Procedural front pathway from door directly to road
      const frontPath = [];
      if (targetRoadPt) {
        frontPath.push({ x: doorWorldX, y: doorWorldY });
        const midX = (doorWorldX + targetRoadPt.x) * 0.5 + this.prng.float(-4, 4);
        const midY = (doorWorldY + targetRoadPt.y) * 0.5 + this.prng.float(-4, 4);
        frontPath.push({ x: midX, y: midY });
        frontPath.push({ x: targetRoadPt.x, y: targetRoadPt.y });
      }

      // Windows on non-door walls
      const windows = [];
      if (doorSide !== 'north') windows.push({ side: 'north', offset: 0.5 });
      if (doorSide !== 'south') windows.push({ side: 'south', offset: 0.5 });
      if (doorSide !== 'east') windows.push({ side: 'east', offset: 0.5 });
      if (doorSide !== 'west') windows.push({ side: 'west', offset: 0.5 });

      // Interior props arranged by building type
      const props = [];
      if (buildingType === 'main_house') {
        let bedX = bestX + 8, bedY = bestY + 8;
        if (doorSide === 'north') bedY = bestY + houseH - CS * 1.5 - 8;
        if (doorSide === 'west') bedX = bestX + houseW - CS * 0.9 - 8;
        props.push({ type: 'bed', x: bedX, y: bedY, w: CS * 0.9, h: CS * 1.5 });

        let hearthX = bestX + houseW * 0.6, hearthY = bestY - 4;
        if (doorSide === 'north') hearthY = bestY + houseH - 10;
        props.push({ type: 'hearth', x: hearthX, y: hearthY, w: CS * 0.8, h: 14 });

        props.push({
          type: 'table',
          x: bestX + houseW * 0.4,
          y: bestY + houseH * (doorSide === 'north' ? 0.55 : 0.35),
          w: CS * 1.2,
          h: CS * 0.75
        });

        props.push({ type: 'crate', x: bestX + houseW - 20, y: bestY + houseH - 22, w: 14, h: 14 });
        props.push({ type: 'barrel', x: bestX + houseW - 14, y: bestY + houseH - 38, r: 8 });
      } else if (buildingType === 'barn') {
        // Stalls and hay bales
        props.push({ type: 'hay_bale', x: bestX + 10, y: bestY + 10, w: 20, h: 14 });
        props.push({ type: 'hay_bale', x: bestX + 10, y: bestY + 28, w: 20, h: 14 });
        props.push({ type: 'trough', x: bestX + houseW - 28, y: bestY + 12, w: 18, h: 36 });
      } else {
        // Workshop / Shed
        props.push({ type: 'workbench', x: bestX + 10, y: bestY + 8, w: CS * 1.1, h: 12 });
        props.push({ type: 'crate', x: bestX + houseW - 18, y: bestY + 10, w: 14, h: 14 });
        props.push({ type: 'barrel', x: bestX + houseW - 14, y: bestY + houseH - 20, r: 8 });
      }

      // Outdoor features
      const outdoorFeatures = [];
      if (bIdx === 0) {
        const wellOffset = doorSide === 'east' ? -40 : 40;
        outdoorFeatures.push({
          type: 'well',
          x: bestX + houseW * 0.5 + wellOffset,
          y: doorSide === 'north' ? bestY + houseH + 28 : bestY - 28,
          r: 12
        });
        outdoorFeatures.push({
          type: 'woodpile',
          x: doorSide === 'west' ? bestX + houseW + 12 : bestX - 35,
          y: bestY + 10,
          w: CS * 1.1,
          h: CS * 0.6
        });
      }

      map.buildings.push({
        x: bestX,
        y: bestY,
        width: houseW,
        height: houseH,
        cellsW: wCells,
        cellsH: hCells,
        wallThickness: 6,
        type: buildingType,
        door: doorPos,
        doorWorld: { x: doorWorldX, y: doorWorldY },
        frontPath: frontPath,
        windows: windows,
        props: props,
        outdoorFeatures: outdoorFeatures,
        hasPorch: buildingType === 'main_house',
        roofStyle: buildingType === 'barn' ? 'hipped' : 'gabled'
      });
    }
  }

  generateWagon(map, W, H) {
    if (!map.roads || !map.roads.length || !map.roads[0].path.length) return;
    const road = map.roads[0];
    const rPts = road.path;

    // Pick a point along the middle 40%-70% of the road
    const segIdx = this.prng.int(Math.floor(rPts.length * 0.35), Math.floor(rPts.length * 0.65));
    const p1 = rPts[segIdx];
    const p2 = rPts[segIdx + 1] || rPts[segIdx];

    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const wagonType = this.prng.choice(['merchant', 'covered', 'farmer', 'adventurer']);

    map.wagon = {
      id: 'procedural_wagon',
      name: wagonType === 'merchant' ? 'Купеческий фургон' : wagonType === 'covered' ? 'Крытая повозка' : 'Дорожная телега',
      type: wagonType,
      x: (p1.x + p2.x) * 0.5,
      y: (p1.y + p2.y) * 0.5,
      angle: angle,
      length: 72,
      width: 36
    };
  }

  generateRuins(map, W, H) {
    const CS = map.grid.cellSize;
    // Central placement within active bounds
    const cx = this.prng.float(W * 0.35, W * 0.65);
    const cy = this.prng.float(H * 0.35, H * 0.65);

    // Dimensions of the massive sanctuary / basilica ruins complex
    const mainW = this.prng.int(7, 11) * CS;
    const mainH = this.prng.int(5, 8) * CS;
    const leftX = cx - mainW * 0.5;
    const topY = cy - mainH * 0.5;

    // 1. Paved Courtyards & Stepped Daises
    const plazas = [];
    // Main Temple Courtyard
    plazas.push({
      x: leftX,
      y: topY,
      width: mainW,
      height: mainH,
      tileW: 16,
      tileH: 16,
      type: 'main_sanctuary'
    });

    // Secondary Annex Room / Sunken Cloister
    if (this.prng.bool(0.75)) {
      const annexSide = this.prng.choice(['north', 'south', 'east', 'west']);
      let ax = leftX, ay = topY, aw = CS * 4, ah = CS * 3;
      if (annexSide === 'north') { ay = topY - ah; ax = cx - aw * 0.5; }
      else if (annexSide === 'south') { ay = topY + mainH; ax = cx - aw * 0.5; }
      else if (annexSide === 'east') { ax = leftX + mainW; ay = cy - ah * 0.5; }
      else { ax = leftX - aw; ay = cy - ah * 0.5; }
      plazas.push({
        x: ax,
        y: ay,
        width: aw,
        height: ah,
        tileW: 16,
        tileH: 16,
        type: 'annex'
      });
    }

    // Stepped Ceremonial Dais (2 concentric raised platforms)
    const daisWidth = CS * 3.6;
    const daisHeight = CS * 2.4;
    const dais = {
      x: cx - daisWidth * 0.5,
      y: cy - daisHeight * 0.5,
      width: daisWidth,
      height: daisHeight,
      innerX: cx - daisWidth * 0.35,
      innerY: cy - daisHeight * 0.35,
      innerWidth: daisWidth * 0.7,
      innerHeight: daisHeight * 0.7
    };

    // 2. Massive Ruined Walls (Thick stone masonry with breaches, buttresses and crumbles)
    const walls = [];
    const wallThick = 14;

    // Outer perimeter segments with realistic breaches (collapsed sections)
    const addPerimeterWalls = (px, py, pw, ph) => {
      // North Wall with potential breach
      const nBreach = this.prng.float(0.3, 0.7);
      walls.push({ x1: px, y1: py, x2: px + pw * (nBreach - 0.12), y2: py, thickness: wallThick });
      walls.push({ x1: px + pw * (nBreach + 0.12), y1: py, x2: px + pw, y2: py, thickness: wallThick });

      // South Wall with grand entrance breach / archway
      const sGate = 0.5;
      walls.push({ x1: px, y1: py + ph, x2: px + pw * (sGate - 0.15), y2: py + ph, thickness: wallThick });
      walls.push({ x1: px + pw * (sGate + 0.15), y1: py + ph, x2: px + pw, y2: py + ph, thickness: wallThick });

      // West Wall with crumbled gap
      const wBreach = this.prng.float(0.4, 0.6);
      walls.push({ x1: px, y1: py, x2: px, y2: py + ph * (wBreach - 0.1), thickness: wallThick });
      walls.push({ x1: px, y1: py + ph * (wBreach + 0.1), x2: px, y2: py + ph, thickness: wallThick });

      // East Wall
      const eBreach = this.prng.float(0.3, 0.7);
      walls.push({ x1: px + pw, y1: py, x2: px + pw, y2: py + ph * (eBreach - 0.12), thickness: wallThick });
      walls.push({ x1: px + pw, y1: py + ph * (eBreach + 0.12), x2: px + pw, y2: py + ph, thickness: wallThick });
    };

    addPerimeterWalls(leftX, topY, mainW, mainH);

    // Inner Sanctuary Partition Walls / Apse / Alcoves
    const innerNaveX1 = leftX + CS * 2;
    const innerNaveX2 = leftX + mainW - CS * 2;
    walls.push({ x1: innerNaveX1, y1: topY + CS * 1.2, x2: innerNaveX1, y2: topY + CS * 2.8, thickness: wallThick - 2 });
    walls.push({ x1: innerNaveX2, y1: topY + CS * 1.2, x2: innerNaveX2, y2: topY + CS * 2.8, thickness: wallThick - 2 });

    // Corner Buttresses
    const buttresses = [
      { x: leftX - 4, y: topY - 4, w: 18, h: 18 },
      { x: leftX + mainW - 14, y: topY - 4, w: 18, h: 18 },
      { x: leftX - 4, y: topY + mainH - 14, w: 18, h: 18 },
      { x: leftX + mainW - 14, y: topY + mainH - 14, w: 18, h: 18 }
    ];

    // 3. Colonnades & Monumental Pillars
    const pillars = [];
    const numPairs = this.prng.int(4, 6);
    const colSpacing = (mainW - CS * 3.5) / (numPairs - 1);
    const colStartX = leftX + CS * 1.75;
    const colNorthY = cy - daisHeight * 0.75;
    const colSouthY = cy + daisHeight * 0.75;

    for (let i = 0; i < numPairs; i++) {
      const px = colStartX + i * colSpacing;
      // North column
      const isNorthFallen = this.prng.bool(0.35);
      pillars.push({
        x: px + this.prng.float(-3, 3),
        y: colNorthY + this.prng.float(-2, 2),
        radius: this.prng.float(9, 13),
        isFallen: isNorthFallen,
        fallenAngle: isNorthFallen ? this.prng.float(Math.PI * 0.1, Math.PI * 0.9) : 0,
        fallenLength: isNorthFallen ? this.prng.float(26, 42) : 0,
        plinthSize: 24
      });

      // South column
      const isSouthFallen = this.prng.bool(0.35);
      pillars.push({
        x: px + this.prng.float(-3, 3),
        y: colSouthY + this.prng.float(-2, 2),
        radius: this.prng.float(9, 13),
        isFallen: isSouthFallen,
        fallenAngle: isSouthFallen ? this.prng.float(-Math.PI * 0.9, -Math.PI * 0.1) : 0,
        fallenLength: isSouthFallen ? this.prng.float(26, 42) : 0,
        plinthSize: 24
      });
    }

    // 4. Central Arcane Altar & Ritual Focus
    const altar = {
      x: cx,
      y: cy,
      width: CS * 1.4,
      height: CS * 0.9,
      runes: true,
      braziers: [
        { x: cx - CS * 1.1, y: cy - CS * 0.6, radius: 6 },
        { x: cx + CS * 1.1, y: cy - CS * 0.6, radius: 6 },
        { x: cx - CS * 1.1, y: cy + CS * 0.6, radius: 6 },
        { x: cx + CS * 1.1, y: cy + CS * 0.6, radius: 6 }
      ]
    };

    // 5. Sunken Crypt Descent Stairs
    const cryptStairs = {
      x: leftX + CS * 1.2,
      y: cy,
      width: 28,
      length: 44,
      angle: 0,
      steps: 6
    };

    // 6. Ancient Stone Sarcophagi / Tombs
    const sarcophagi = [];
    const numTombs = this.prng.int(1, 3);
    for (let t = 0; t < numTombs; t++) {
      const tx = leftX + mainW - CS * 1.5;
      const ty = cy + (t - (numTombs - 1) * 0.5) * (CS * 1.4);
      sarcophagi.push({
        x: tx,
        y: ty,
        width: 36,
        height: 20,
        angle: this.prng.float(-0.15, 0.15),
        lidDisplaced: this.prng.bool(0.6)
      });
    }

    // 7. Heavy Rubble Piles, Scattered Ashlar Blocks & Moss Patches
    const rubblePiles = [];
    const numRubble = this.prng.int(8, 16);
    for (let r = 0; r < numRubble; r++) {
      const rx = leftX + this.prng.float(0, mainW);
      const ry = topY + this.prng.float(0, mainH);
      rubblePiles.push({
        x: rx,
        y: ry,
        radius: this.prng.float(12, 28),
        pebbleCount: this.prng.int(5, 10)
      });
    }

    const ashlarBlocks = [];
    const numBlocks = this.prng.int(14, 28);
    for (let b = 0; b < numBlocks; b++) {
      const bx = leftX + this.prng.float(-CS * 0.5, mainW + CS * 0.5);
      const by = topY + this.prng.float(-CS * 0.5, mainH + CS * 0.5);
      ashlarBlocks.push({
        x: bx,
        y: by,
        w: this.prng.float(10, 18),
        h: this.prng.float(7, 12),
        angle: this.prng.float(0, Math.PI * 2)
      });
    }

    const mossPatches = [];
    const numMoss = this.prng.int(10, 20);
    for (let m = 0; m < numMoss; m++) {
      mossPatches.push({
        x: leftX + this.prng.float(10, mainW - 10),
        y: topY + this.prng.float(10, mainH - 10),
        radius: this.prng.float(14, 30)
      });
    }

    map.ruins.push({
      cx,
      cy,
      mainW,
      mainH,
      plazas,
      dais,
      walls,
      buttresses,
      pillars,
      altar,
      cryptStairs,
      sarcophagi,
      rubblePiles,
      ashlarBlocks,
      mossPatches
    });
  }

  generateCamp(map, W, H) {
    const CS = map.grid.cellSize;
    const cx = this.prng.float(W * 0.35, W * 0.65);
    const cy = this.prng.float(H * 0.35, H * 0.65);

    const campfire = {
      x: cx,
      y: cy,
      radius: 10,
      lightRadius: CS * 4 // 20ft bright light
    };

    const tents = [];
    const numTents = this.prng.int(3, 5);
    for (let i = 0; i < numTents; i++) {
      const angle = (i / numTents) * Math.PI * 2 + this.prng.float(-0.3, 0.3);
      const d = this.prng.float(CS * 1.8, CS * 3.0);
      const tx = cx + Math.cos(angle) * d;
      const ty = cy + Math.sin(angle) * d;
      tents.push({
        x: tx,
        y: ty,
        w: CS * 1.4,
        h: CS * 0.9,
        angle: angle + Math.PI * 0.5,
        type: this.prng.choice(['a-frame', 'round'])
      });
    }

    const props = [];
    // Log benches around campfire
    props.push({ type: 'log', x: cx, y: cy - 24, w: 32, h: 8, angle: 0 });
    props.push({ type: 'log', x: cx, y: cy + 24, w: 32, h: 8, angle: 0 });
    // Crates and supply sacks
    props.push({ type: 'crate_cluster', x: cx + CS * 2, y: cy + CS * 0.8, count: 4 });

    map.camp = { campfire, tents, props };
  }

  generateRocks(map, W, H) {
    const densityMap = { none: 0, sparse: 12, normal: 28, dense: 54 };
    const count = densityMap[this.toggles.rockDensity] || 28;

    // Generate rock clusters (main anchor boulder + smaller satellite rocks)
    const numClusters = Math.max(3, Math.floor(count / 4));
    const clusters = [];
    for (let c = 0; c < numClusters; c++) {
      clusters.push({
        x: this.prng.float(W * 0.08, W * 0.92),
        y: this.prng.float(H * 0.08, H * 0.92),
        spread: this.prng.float(25, 60)
      });
    }

    for (let i = 0; i < count; i++) {
      const cl = this.prng.choice(clusters);
      const angle = this.prng.float(0, Math.PI * 2);
      const distC = this.prng.float(0, cl.spread);
      const x = cl.x + Math.cos(angle) * distC;
      const y = cl.y + Math.sin(angle) * distC;

      if (x < 15 || x > W - 15 || y < 15 || y > H - 15) continue;

      // Check not inside buildings
      let insideBuilding = false;
      for (const b of map.buildings) {
        if (x >= b.x - 10 && x <= b.x + b.width + 10 && y >= b.y - 10 && y <= b.y + b.height + 10) {
          insideBuilding = true;
          break;
        }
      }
      if (insideBuilding) continue;

      const radius = this.prng.float(7, 24);
      map.rocks.push({
        x,
        y,
        radius,
        shape: this.generateRockShape(radius),
        hatchAngle: this.prng.float(Math.PI * 0.2, Math.PI * 0.4)
      });
    }
  }

  generateCliffs(map, W, H) {
    // Generate natural rocky ridges / cliff escarpments on steep elevation gradients
    if (this.biomeId === 'desert' || this.biomeId === 'winter' || this.biomeId === 'ruins' || this.prng.bool(0.65)) {
      const numCliffs = this.prng.int(1, 3);
      for (let c = 0; c < numCliffs; c++) {
        const pts = [];
        const numPts = 8;
        const startX = this.prng.float(W * 0.1, W * 0.3);
        const startY = this.prng.float(H * 0.2, H * 0.8);
        const endX = this.prng.float(W * 0.7, W * 0.9);
        const endY = startY + this.prng.float(-60, 60);

        for (let p = 0; p <= numPts; p++) {
          const t = p / numPts;
          const px = lerp(startX, endX, t) + this.prng.float(-10, 10);
          const py = lerp(startY, endY, t) + Math.sin(t * Math.PI * 2) * 20 + this.prng.float(-8, 8);
          pts.push({ x: px, y: py });
        }

        map.cliffs.push({
          path: pts,
          depth: this.prng.float(12, 22),
          hachureAngle: this.prng.float(Math.PI * 0.4, Math.PI * 0.6)
        });
      }
    }
  }

  generateClutter(map, W, H) {
    const biome = BIOMES[this.biomeId] || BIOMES.forest;

    // 1. Wild Grass Tufts & Foliage Blades (100 - 200 clusters)
    const numTufts = this.prng.int(100, 200);
    for (let i = 0; i < numTufts; i++) {
      const x = this.prng.float(10, W - 10);
      const y = this.prng.float(10, H - 10);
      map.clutter.grassTufts.push({
        x,
        y,
        blades: this.prng.int(3, 5),
        height: this.prng.float(5, 10),
        angle: this.prng.float(-0.2, 0.2)
      });
    }

    // 2. Gravel & Smooth Pebble Clusters (50 - 100 clusters)
    const numPebbles = this.prng.int(50, 100);
    for (let i = 0; i < numPebbles; i++) {
      const x = this.prng.float(10, W - 10);
      const y = this.prng.float(10, H - 10);
      map.clutter.pebbles.push({
        x,
        y,
        count: this.prng.int(3, 7),
        radius: this.prng.float(1.5, 3.5)
      });
    }

    // 3. Wildflowers & Herb Blooms (35 - 80 clusters in meadows/forests)
    if (this.biomeId === 'meadow' || this.biomeId === 'forest' || this.biomeId === 'road' || this.biomeId === 'river') {
      const flowerColors = ['#e84118', '#00a8ff', '#9c88ff', '#fbc531', '#f5f6fa', '#e056fd'];
      const numFlowers = this.prng.int(40, 90);
      for (let i = 0; i < numFlowers; i++) {
        map.clutter.flowers.push({
          x: this.prng.float(15, W - 15),
          y: this.prng.float(15, H - 15),
          count: this.prng.int(4, 9),
          color: this.prng.choice(flowerColors)
        });
      }
    }

    // 4. Woodland Mushrooms & Fungi (12 - 30 clusters in forest/swamp)
    if (this.biomeId === 'forest' || this.biomeId === 'swamp' || this.biomeId === 'ruins') {
      const numMushrooms = this.prng.int(15, 35);
      for (let i = 0; i < numMushrooms; i++) {
        map.clutter.mushrooms.push({
          x: this.prng.float(15, W - 15),
          y: this.prng.float(15, H - 15),
          count: this.prng.int(3, 6),
          isFairyRing: this.prng.bool(0.25),
          capColor: this.prng.choice(['#c23616', '#e1b12c', '#718093', '#7ed6df'])
        });
      }
    }

    // 5. Fallen Twigs & Deadwood Scraps (20 - 45 in wooded areas)
    const numTwigs = this.prng.int(20, 45);
    for (let i = 0; i < numTwigs; i++) {
      map.clutter.twigs.push({
        x: this.prng.float(15, W - 15),
        y: this.prng.float(15, H - 15),
        length: this.prng.float(10, 22),
        angle: this.prng.float(0, Math.PI * 2)
      });
    }

    // 6. Mud Puddles with Ripple Rings (8 - 18 puddles)
    const numPuddles = this.prng.int(8, 18);
    for (let i = 0; i < numPuddles; i++) {
      map.clutter.puddles.push({
        x: this.prng.float(25, W - 25),
        y: this.prng.float(25, H - 25),
        rx: this.prng.float(8, 20),
        ry: this.prng.float(5, 12),
        angle: this.prng.float(0, Math.PI)
      });
    }

    // 7. Stone Trail Cairns & Road Milestones (2 - 5 cairns)
    const numCairns = this.prng.int(2, 5);
    for (let i = 0; i < numCairns; i++) {
      map.clutter.cairns.push({
        x: this.prng.float(30, W - 30),
        y: this.prng.float(30, H - 30),
        stones: this.prng.int(3, 5),
        size: this.prng.float(7, 12)
      });
    }

    // 8. Waterway Reeds & Water Lily Pads
    if (map.water.hasRiver || map.water.pools.length) {
      const numWaterProps = this.prng.int(15, 30);
      for (let i = 0; i < numWaterProps; i++) {
        let wx, wy;
        if (map.water.path.length) {
          const wp = this.prng.choice(map.water.path);
          wx = wp.x + this.prng.float(-map.water.width * 0.45, map.water.width * 0.45);
          wy = wp.y + this.prng.float(-map.water.width * 0.45, map.water.width * 0.45);
        } else {
          wx = this.prng.float(20, W - 20);
          wy = this.prng.float(20, H - 20);
        }
        map.clutter.waterProps.push({
          x: wx,
          y: wy,
          type: this.prng.choice(['lily_pad', 'reeds', 'driftwood']),
          size: this.prng.float(6, 14)
        });
      }
    }
  }

  generateRockShape(radius) {
    const points = [];
    const numVerts = this.prng.int(5, 8);
    for (let v = 0; v < numVerts; v++) {
      const ang = (v / numVerts) * Math.PI * 2;
      const r = radius * this.prng.float(0.7, 1.25);
      points.push({
        x: Math.cos(ang) * r,
        y: Math.sin(ang) * r
      });
    }
    return points;
  }

  generateTrees(map, W, H) {
    // 4x increased density for impassable thicket and dense forests
    const densityMap = { none: 0, sparse: 25, normal: 65, dense: 160, impassable: 420 };
    const targetCount = densityMap[this.toggles.treeDensity] || 65;
    if (targetCount === 0) return;

    const biome = BIOMES[this.biomeId] || BIOMES.forest;
    const treeType = biome.trees.type || 'deciduous';

    // 1. If dense thicket / impassable, generate a faint winding trail through the forest
    if (this.toggles.treeDensity === 'impassable' || (this.biomeId === 'forest' && this.toggles.treeDensity === 'dense')) {
      const trailPts = [];
      const numPts = 10;
      const startX = -10;
      const startY = this.prng.float(H * 0.2, H * 0.8);
      const endX = W + 10;
      const endY = this.prng.float(H * 0.2, H * 0.8);

      for (let i = 0; i <= numPts; i++) {
        const t = i / numPts;
        const x = lerp(startX, endX, t);
        const y = lerp(startY, endY, t) + Math.sin(t * Math.PI * 3) * 45 + this.prng.float(-12, 12);
        trailPts.push({ x, y });
      }

      map.faintTrail = {
        path: trailPts,
        width: 14 // narrow walking track
      };
    }

    // Poisson-style placement with noise clustering
    const candidates = [];
    const clusterCenters = [];
    const numClusters = Math.max(3, Math.floor(targetCount / 12));

    for (let c = 0; c < numClusters; c++) {
      clusterCenters.push({
        x: this.prng.float(W * 0.05, W * 0.95),
        y: this.prng.float(H * 0.05, H * 0.95),
        radius: this.prng.float(70, 190)
      });
    }

    const maxAttempts = targetCount * 3.5;
    for (let i = 0; i < maxAttempts; i++) {
      if (candidates.length >= targetCount) break;

      const cluster = this.prng.choice(clusterCenters);
      const angle = this.prng.float(0, Math.PI * 2);
      const distFromClust = this.prng.float(0, cluster.radius);

      const x = cluster.x + Math.cos(angle) * distFromClust;
      const y = cluster.y + Math.sin(angle) * distFromClust;

      if (x < 12 || x > W - 12 || y < 12 || y > H - 12) continue;

      // Avoid water
      let inWater = false;
      if (map.water.path.length) {
        for (const wp of map.water.path) {
          if (dist(x, y, wp.x, wp.y) < map.water.width * 0.62) {
            inWater = true;
            break;
          }
        }
      }
      if (inWater) continue;

      // Avoid main roads
      let onRoad = false;
      for (const rd of map.roads) {
        for (const rp of rd.path) {
          if (dist(x, y, rp.x, rp.y) < rd.width * 0.72) {
            onRoad = true;
            break;
          }
        }
        if (onRoad) break;
      }
      if (onRoad) continue;

      // Avoid faint trail path corridor
      let onTrail = false;
      if (map.faintTrail) {
        for (const tp of map.faintTrail.path) {
          if (dist(x, y, tp.x, tp.y) < 18) {
            onTrail = true;
            break;
          }
        }
      }
      if (onTrail) continue;

      // Avoid buildings, porches & front paths
      let inStructure = false;
      for (const b of map.buildings) {
        if (x >= b.x - 24 && x <= b.x + b.width + 24 && y >= b.y - 24 && y <= b.y + b.height + 24) {
          inStructure = true;
          break;
        }
        if (b.frontPath && b.frontPath.length) {
          for (const fp of b.frontPath) {
            if (dist(x, y, fp.x, fp.y) < 22) {
              inStructure = true;
              break;
            }
          }
        }
      }
      if (inStructure) continue;

      if (map.camp && dist(x, y, map.camp.campfire.x, map.camp.campfire.y) < 70) continue;

      const radius = treeType === 'pine' ? this.prng.float(13, 23) : this.prng.float(16, 34);
      candidates.push({
        x,
        y,
        radius,
        type: treeType,
        colorIndex: this.prng.int(0, biome.trees.foliage.length - 1),
        canopyBlobs: this.generateCanopyBlobs(radius, treeType)
      });
    }

    // Sort trees by Y for isometric depth sorting
    candidates.sort((a, b) => a.y - b.y);
    map.trees = candidates;

    // Undergrowth bushes & shrubs in forest thickets (30-70 bushes)
    const numBushes = Math.floor(targetCount * 0.35);
    for (let b = 0; b < numBushes; b++) {
      const bx = this.prng.float(20, W - 20);
      const by = this.prng.float(20, H - 20);
      map.bushes.push({
        x: bx,
        y: by,
        radius: this.prng.float(7, 14),
        colorIndex: this.prng.int(0, biome.trees.foliage.length - 1)
      });
    }

    // Generate occasional fallen mossy logs (1-5)
    if (this.toggles.treeDensity !== 'none' && this.prng.bool(0.75)) {
      const numLogs = this.prng.int(2, 5);
      for (let l = 0; l < numLogs; l++) {
        const lx = this.prng.float(W * 0.15, W * 0.85);
        const ly = this.prng.float(H * 0.15, H * 0.85);
        map.fallenLogs.push({
          x: lx,
          y: ly,
          length: this.prng.float(32, 60),
          thickness: this.prng.float(6, 11),
          angle: this.prng.float(0, Math.PI)
        });
      }
    }
  }

  generateCanopyBlobs(radius, type) {
    const blobs = [];
    if (type === 'pine') {
      // Tiered triangular/spiky layers
      const tiers = 3;
      for (let t = 0; t < tiers; t++) {
        const r = radius * (1 - t * 0.28);
        const yOffset = -t * (radius * 0.35);
        blobs.push({ x: 0, y: yOffset, r });
      }
    } else if (type === 'swamp') {
      // Gnarled sparse snags with hanging moss
      const num = this.prng.int(3, 5);
      for (let i = 0; i < num; i++) {
        const ang = (i / num) * Math.PI * 2;
        const d = radius * this.prng.float(0.4, 0.7);
        blobs.push({
          x: Math.cos(ang) * d,
          y: Math.sin(ang) * d,
          r: radius * this.prng.float(0.4, 0.65)
        });
      }
    } else {
      // Standard lush Watabou cluster
      const num = this.prng.int(5, 8);
      for (let i = 0; i < num; i++) {
        const ang = (i / num) * Math.PI * 2 + this.prng.float(-0.2, 0.2);
        const d = radius * this.prng.float(0.35, 0.65);
        blobs.push({
          x: Math.cos(ang) * d,
          y: Math.sin(ang) * d,
          r: radius * this.prng.float(0.45, 0.75)
        });
      }
    }
    return blobs;
  }

  generateCaveNetwork(map, W, H) {
    const cs = map.grid.cellSize;
    const numChambers = Math.max(3, Math.floor(4 * map.areaFactor));
    const chambers = [];
    const margin = cs * 3;

    for (let i = 0; i < numChambers; i++) {
      const cx = this.prng.float(margin, W - margin);
      const cy = this.prng.float(margin, H - margin);
      const rx = this.prng.float(cs * 2.8, cs * 5.5);
      const ry = this.prng.float(cs * 2.8, cs * 5.5);
      const angle = this.prng.float(0, Math.PI);
      chambers.push({ id: i, x: cx, y: cy, rx, ry, angle });
    }

    const passages = [];
    for (let i = 0; i < chambers.length; i++) {
      const nextIdx = (i + 1) % chambers.length;
      const c1 = chambers[i];
      const c2 = chambers[nextIdx];
      const midX = (c1.x + c2.x) / 2 + this.prng.float(-cs * 4, cs * 4);
      const midY = (c1.y + c2.y) / 2 + this.prng.float(-cs * 4, cs * 4);
      const width = this.prng.float(cs * 2, cs * 3.5);
      passages.push({ p1: { x: c1.x, y: c1.y }, p2: { x: c2.x, y: c2.y }, control: { x: midX, y: midY }, width });
    }

    if (chambers.length >= 3) {
      const c1 = chambers[0];
      const c3 = chambers[2];
      const midX = (c1.x + c3.x) / 2 + this.prng.float(-cs * 3, cs * 3);
      const midY = (c1.y + c3.y) / 2 + this.prng.float(-cs * 3, cs * 3);
      passages.push({ p1: { x: c1.x, y: c1.y }, p2: { x: c3.x, y: c3.y }, control: { x: midX, y: midY }, width: cs * 2.5 });
    }

    const stalagmites = [];
    chambers.forEach(ch => {
      const numStal = this.prng.int(3, 6);
      for (let k = 0; k < numStal; k++) {
        const distR = this.prng.float(0.2, 0.7) * Math.min(ch.rx, ch.ry);
        const ang = this.prng.float(0, Math.PI * 2);
        stalagmites.push({
          x: ch.x + Math.cos(ang) * distR,
          y: ch.y + Math.sin(ang) * distR,
          radius: this.prng.float(cs * 0.3, cs * 0.7)
        });
      }
    });

    const poolChamber = chambers[this.prng.int(0, chambers.length - 1)];
    const pool = {
      x: poolChamber.x + this.prng.float(-cs, cs),
      y: poolChamber.y + this.prng.float(-cs, cs),
      rx: poolChamber.rx * 0.65,
      ry: poolChamber.ry * 0.65
    };

    const torches = [];
    chambers.forEach(ch => {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
        torches.push({
          x: ch.x + Math.cos(a) * (ch.rx * 0.85),
          y: ch.y + Math.sin(a) * (ch.ry * 0.85)
        });
      }
    });

    map.caveNetwork = {
      chambers,
      passages,
      stalagmites,
      pool,
      torches
    };
  }

  generateDungeonComplex(map, W, H) {
    const cs = map.grid.cellSize;
    const cols = map.grid.cols;
    const rows = map.grid.rows;
    const rooms = [];
    const corridors = [];

    const roomCount = Math.max(3, Math.floor(4 * map.areaFactor));
    const margin = 2;

    for (let i = 0; i < roomCount; i++) {
      const rw = this.prng.int(4, 8) * cs;
      const rh = this.prng.int(4, 7) * cs;
      const rx = Math.floor(this.prng.float(margin, cols - Math.floor(rw / cs) - margin)) * cs;
      const ry = Math.floor(this.prng.float(margin, rows - Math.floor(rh / cs) - margin)) * cs;

      let overlap = false;
      for (const existing of rooms) {
        if (rx < existing.x + existing.w + cs * 2 && rx + rw > existing.x - cs * 2 &&
            ry < existing.y + existing.h + cs * 2 && ry + rh > existing.y - cs * 2) {
          overlap = true;
          break;
        }
      }
      if (!overlap || rooms.length < 2) {
        rooms.push({ id: i, x: rx, y: ry, w: rw, h: rh });
      }
    }

    for (let i = 0; i < rooms.length - 1; i++) {
      const r1 = rooms[i];
      const r2 = rooms[i + 1];
      const c1x = r1.x + Math.floor(r1.w / (2 * cs)) * cs;
      const c1y = r1.y + Math.floor(r1.h / (2 * cs)) * cs;
      const c2x = r2.x + Math.floor(r2.w / (2 * cs)) * cs;
      const c2y = r2.y + Math.floor(r2.h / (2 * cs)) * cs;

      corridors.push({ x1: c1x, y1: c1y, x2: c2x, y2: c1y, width: cs * 2 });
      corridors.push({ x1: c2x, y1: c1y, x2: c2x, y2: c2y, width: cs * 2 });
    }

    const pillars = [];
    rooms.forEach(rm => {
      if (rm.w >= cs * 6 && rm.h >= cs * 5) {
        pillars.push({ x: rm.x + cs * 1.8, y: rm.y + cs * 1.8 });
        pillars.push({ x: rm.x + rm.w - cs * 1.8, y: rm.y + cs * 1.8 });
        pillars.push({ x: rm.x + cs * 1.8, y: rm.y + rm.h - cs * 1.8 });
        pillars.push({ x: rm.x + rm.w - cs * 1.8, y: rm.y + rm.h - cs * 1.8 });
      }
    });

    const braziers = [];
    rooms.forEach(rm => {
      braziers.push({ x: rm.x + cs * 0.8, y: rm.y + cs * 0.8 });
      braziers.push({ x: rm.x + rm.w - cs * 0.8, y: rm.y + rm.h - cs * 0.8 });
    });

    map.dungeonComplex = {
      rooms,
      corridors,
      pillars,
      braziers
    };
  }

  generateArchipelago(map, W, H) {
    const cs = map.grid.cellSize;
    const numIslands = Math.max(2, Math.floor(3 * map.areaFactor));
    const islands = [];

    for (let i = 0; i < numIslands; i++) {
      const isMain = i === 0;
      const cx = isMain ? W * 0.45 + this.prng.float(-cs * 3, cs * 3) : this.prng.float(W * 0.18, W * 0.82);
      const cy = isMain ? H * 0.5 + this.prng.float(-cs * 3, cs * 3) : this.prng.float(H * 0.18, H * 0.82);
      const rx = isMain ? this.prng.float(cs * 7.5, cs * 12.5) : this.prng.float(cs * 3.5, cs * 6.5);
      const ry = isMain ? this.prng.float(cs * 5.5, cs * 9.5) : this.prng.float(cs * 3, cs * 5.5);

      const points = [];
      const numPts = 12;
      for (let p = 0; p < numPts; p++) {
        const ang = (p / numPts) * Math.PI * 2;
        const noise = this.prng.float(0.75, 1.25);
        points.push({
          x: cx + Math.cos(ang) * rx * noise,
          y: cy + Math.sin(ang) * ry * noise
        });
      }

      const palms = [];
      const palmCount = isMain ? this.prng.int(6, 11) : this.prng.int(2, 5);
      for (let k = 0; k < palmCount; k++) {
        const ang = this.prng.float(0, Math.PI * 2);
        const distR = this.prng.float(0.2, 0.7) * Math.min(rx, ry);
        palms.push({ x: cx + Math.cos(ang) * distR, y: cy + Math.sin(ang) * distR, size: cs * this.prng.float(1.2, 1.8) });
      }

      islands.push({ cx, cy, rx, ry, points, palms, isMain });
    }

    const shipwreck = {
      x: W * 0.75,
      y: H * 0.32,
      angle: 0.35,
      length: cs * 6,
      width: cs * 2.5
    };

    map.archipelagoData = {
      islands,
      shipwreck
    };
  }

  generateShips(map, W, H) {
    const cs = map.grid.cellSize;
    const ships = [];
    const isDoubleShip = map.areaFactor >= 1.0 || this.prng.bool(0.65);

    if (isDoubleShip) {
      const ship1 = {
        name: 'Парусный Галеон "Черный Шторм"',
        x: W * 0.38,
        y: H * 0.5,
        length: Math.min(W * 0.55, cs * 22),
        width: cs * 8.5,
        angle: -0.08,
        woodColor: '#78350f',
        deckColor: '#b45309',
        isMain: true
      };
      const ship2 = {
        name: 'Торговая Каравелла "Морской Орел"',
        x: W * 0.65,
        y: H * 0.48,
        length: Math.min(W * 0.48, cs * 18),
        width: cs * 7,
        angle: 0.12,
        woodColor: '#451a03',
        deckColor: '#92400e',
        isMain: false
      };
      ships.push(ship1, ship2);

      map.boardingPlanks = [
        { x1: ship1.x + cs * 4, y1: ship1.y - cs * 1.5, x2: ship2.x - cs * 3, y2: ship2.y - cs * 1, width: cs * 1.2 },
        { x1: ship1.x + cs * 4, y1: ship1.y + cs * 1.5, x2: ship2.x - cs * 3, y2: ship2.y + cs * 1, width: cs * 1.2 }
      ];
    } else {
      const ship1 = {
        name: 'Парусный Галеон "Фортуна"',
        x: W * 0.5,
        y: H * 0.5,
        length: Math.min(W * 0.65, cs * 24),
        width: cs * 9.5,
        angle: 0,
        woodColor: '#78350f',
        deckColor: '#b45309',
        isMain: true
      };
      ships.push(ship1);
    }

    ships.forEach(ship => {
      const L = ship.length;
      const Wd = ship.width;

      ship.masts = [
        { relX: -L * 0.28, relY: 0, radius: cs * 0.4, yardarm: Wd * 0.85, sail: true },
        { relX: 0, relY: 0, radius: cs * 0.5, yardarm: Wd * 1.05, sail: true },
        { relX: L * 0.25, relY: 0, radius: cs * 0.38, yardarm: Wd * 0.75, sail: true }
      ];

      ship.cannons = [];
      const numCannons = 4;
      for (let k = 0; k < numCannons; k++) {
        const posX = -L * 0.22 + k * (L * 0.14);
        ship.cannons.push({ relX: posX, relY: -Wd * 0.42, side: 'port' });
        ship.cannons.push({ relX: posX, relY: Wd * 0.42, side: 'starboard' });
      }

      ship.helm = { relX: L * 0.35, relY: 0 };
      ship.hatches = [
        { relX: -L * 0.12, relY: 0, w: cs * 2.2, h: cs * 1.6 },
        { relX: L * 0.12, relY: 0, w: cs * 2, h: cs * 1.5 }
      ];
      ship.capstan = { relX: -L * 0.36, relY: 0 };
    });

    map.shipsData = { ships };
  }
}
