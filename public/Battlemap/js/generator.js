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
      // Overland / Natural biomes toggles
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

      // Cave specific tactical toggles
      cavePool: true,
      caveChasm: true,
      caveStalagmites: true,
      caveCrystals: true,
      caveMushrooms: true,
      caveWebs: true,
      caveElevatedLedge: true,
      caveTorches: true,

      // Dungeon specific tactical toggles
      dungeonPillars: true,
      dungeonBraziers: true,
      dungeonAltar: true,
      dungeonSarcophagi: true,
      dungeonPrison: true,
      dungeonCanal: true,
      dungeonFurniture: true,
      dungeonDoors: true,

      // Archipelago specific tactical toggles
      archSandbars: true,
      archRopeBridge: true,
      archShipwreck: true,
      archTentacles: true,
      archPalms: true,
      archCampfire: true,
      archReefs: true,
      archVolcanic: false,

      // Ship specific tactical toggles
      shipCannons: true,
      shipBoardingPlanks: true,
      shipGrapplingHooks: true,
      shipCargoHatches: true,
      shipClutter: true,
      shipTentacles: true,
      shipMastsSails: true,
      shipHelm: true,

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

    const isSpecialBiome = ['cave', 'dungeon', 'archipelago', 'ship'].includes(this.biomeId);

    // 1. Elevation field (only for overland or natural biomes)
    if (!['ship', 'dungeon'].includes(this.biomeId)) {
      this.generateElevation(map, W, H);
    }

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

    // 2. Mountains & Rocky Ridges (only for overland biomes)
    if (!isSpecialBiome) {
      if (this.toggles.hasMountains || this.biomeId === 'winter' || this.biomeId === 'desert' || (areaFactor >= 1.6 && this.prng.bool(0.65))) {
        this.generateMountains(map, W, H);
      }
    }

    // 3. Water / Rivers / Swamp pools
    if (!isSpecialBiome) {
      if (this.toggles.hasRiver) {
        this.generateRiver(map, W, H);
      } else if (this.biomeId === 'swamp') {
        this.generateSwampPools(map, W, H);
      }
    }

    // 4. Roads & Paths
    if (!isSpecialBiome && this.toggles.hasRoad) {
      this.generateRoads(map, W, H);
    }

    // 5. Check road & river intersection for bridge or stepping stones
    if (!isSpecialBiome && this.toggles.hasRiver && this.toggles.hasRoad && map.water.hasRiver) {
      this.generateBridge(map);
    }

    // 6. Farmland & Fields
    if (!isSpecialBiome && this.toggles.hasFields) {
      this.generateFields(map, W, H);
    }

    // 7. House / Cabin / Settlement / Village / City
    if (this.biomeId === 'village') {
      this.generateVillage(map, W, H);
    } else if (this.biomeId === 'city') {
      this.generateCity(map, W, H);
    } else if (!isSpecialBiome && (this.toggles.hasHouse || this.biomeId === 'cabin')) {
      this.generateHouse(map, W, H);
    }

    // 8. Ancient Ruins
    if (!isSpecialBiome && (this.toggles.hasRuins || this.biomeId === 'ruins')) {
      this.generateRuins(map, W, H);
    }

    // 9. Bandit Camp / Outpost
    if (!isSpecialBiome && (this.toggles.hasCamp || this.biomeId === 'camp')) {
      this.generateCamp(map, W, H);
    }

    // 10. Procedural Wagon / Cart on road
    if (!isSpecialBiome && (this.toggles.hasCart || this.biomeId === 'road')) {
      this.generateWagon(map, W, H);
    }

    // 11. Points of Interest (POIs) / Интересные места
    if (!isSpecialBiome) {
      this.generatePOIs(map, W, H);
    }

    // 12. Rocks, Cliffs & Boulder Outcroppings
    if (!isSpecialBiome) {
      this.generateRocks(map, W, H);
      this.generateCliffs(map, W, H);
    }

    // 13. Trees & Foliage
    if (!isSpecialBiome) {
      this.generateTrees(map, W, H);
    }

    // 14. Environmental Micro-Clutter
    if (!isSpecialBiome) {
      this.generateClutter(map, W, H);
    }

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
      village: ['Деревня «Сосновый Брод»', 'Селение «Каменный Ручей»', 'Деревня «Тихая Заводь»', 'Свободная Сельская Община', 'Деревня «Забытая Мельница»', 'Усадебный Хутор'],
      city: ['Старый Городской Квартал', 'Купеческая Торговая Площадь', 'Королевский Град «Остгард»', 'Ратушная Площадь', 'Вольный Торговый Город', 'Цеховой Переулок'],
      camp: ['Стоянка разбойников', 'Кочевье наемников', 'Дозорный лагерь', 'Лагерь следопытов', 'Бивуак у костра'],
      cave: ['Грот Эха и Шепотов', 'Пещера Слепого Ужаса', 'Развилка Подземных Троп', 'Кристальная Расселина', 'Логово Паучьей Королевы'],
      dungeon: ['Катакомбы Мучеников', 'Темницы Инквизиции', 'Сводчатый Каменный Тракт', 'Зал Забытых Рыцарей', 'Гробница Черного Ордена'],
      archipelago: ['Пиратская Бухта', 'Остров Затонувших Костей', 'Лазурная Отмель', 'Архипелаг Морских Ветров', 'Коралловый Атолл'],
      ship: ['Абордажная Схватка', 'Галеон "Черный Шторм"', 'Каравелла Ветров', 'Морской Бой в Открытом Море', 'Палубы "Морского Волка"']
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

    // Number of buildings to generate: 1 on small, 2-3 on large maps
    const buildingCount = isLargeMap ? this.prng.int(2, 3) : 1;

    // Pool of available archetypes
    const primaryPool = ['tavern', 'manor', 'stable', 'farmstead_house', 'blacksmith', 'hunter_cabin', 'mill_house', 'cottage'];
    const secondaryPool = ['stable', 'blacksmith', 'hunter_cabin', 'cottage', 'mill_house'];

    const chosenTypes = [];
    chosenTypes.push(this.prng.choice(primaryPool));
    if (buildingCount >= 2) {
      chosenTypes.push(this.prng.choice(secondaryPool.filter(t => t !== chosenTypes[0])));
    }
    if (buildingCount >= 3) {
      chosenTypes.push(this.prng.choice(['cottage', 'hunter_cabin', 'blacksmith']));
    }

    for (let bIdx = 0; bIdx < buildingCount; bIdx++) {
      const buildingType = chosenTypes[bIdx];

      // Determine dimensions based on building archetype
      let wCells, hCells;
      switch (buildingType) {
        case 'tavern':
          wCells = this.prng.int(7, 9);
          hCells = this.prng.int(5, 6);
          break;
        case 'manor':
          wCells = this.prng.int(8, 9);
          hCells = this.prng.int(5, 6);
          break;
        case 'stable':
          wCells = this.prng.int(7, 8);
          hCells = this.prng.int(4, 5);
          break;
        case 'farmstead_house':
          wCells = this.prng.int(6, 7);
          hCells = this.prng.int(4, 5);
          break;
        case 'blacksmith':
          wCells = this.prng.int(6, 7);
          hCells = this.prng.int(4, 5);
          break;
        case 'hunter_cabin':
          wCells = this.prng.int(4, 5);
          hCells = this.prng.int(3, 4);
          break;
        case 'mill_house':
          wCells = this.prng.int(6, 7);
          hCells = this.prng.int(4, 5);
          break;
        case 'cottage':
        default:
          wCells = this.prng.int(4, 5);
          hCells = this.prng.int(3, 4);
          break;
      }

      const houseW = wCells * CS;
      const houseH = hCells * CS;

      let bestX = CS * 3;
      let bestY = CS * 3;
      let targetRoadPt = null;
      let doorSide = 'south';

      // 1. Position relative to road or open area
      if (map.roads && map.roads.length && map.roads[0].path.length > 2) {
        const road = map.roads[bIdx % map.roads.length];
        const rPts = road.path;

        let bestScore = -Infinity;

        const segStart = bIdx === 0 ? 2 : Math.floor(rPts.length * 0.35);
        const segEnd = Math.min(rPts.length - 2, segStart + 7);

        for (let i = segStart; i < segEnd; i++) {
          const p1 = rPts[i];
          const p2 = rPts[i + 1] || rPts[i];
          const segAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

          const n1 = { x: -Math.sin(segAngle), y: Math.cos(segAngle) };
          const n2 = { x: Math.sin(segAngle), y: -Math.cos(segAngle) };

          const setback = road.width * 0.5 + Math.max(houseW, houseH) * 0.5 + (bIdx === 0 ? 30 : 45 + bIdx * 20);

          for (const norm of [n1, n2]) {
            const cx = p1.x + norm.x * setback;
            const cy = p1.y + norm.y * setback;
            const hx = cx - houseW * 0.5;
            const hy = cy - houseH * 0.5;

            if (hx < CS || hx + houseW > W - CS || hy < CS || hy + houseH > H - CS) continue;

            let score = 100;

            for (const prevB of map.buildings) {
              const d = dist(cx, cy, prevB.x + prevB.width * 0.5, prevB.y + prevB.height * 0.5);
              if (d < Math.max(houseW, houseH) + Math.max(prevB.width, prevB.height) + 24) {
                score -= 2000;
              }
            }

            if (map.water.path.length) {
              for (const wp of map.water.path) {
                const d = dist(cx, cy, wp.x, wp.y);
                if (d < map.water.width + 70) {
                  score -= 1000;
                }
              }
            }

            const distToRoad = dist(cx, cy, p1.x, p1.y);
            score += (150 - Math.abs(distToRoad - 75));

            if (score > bestScore) {
              bestScore = score;
              bestX = hx;
              bestY = hy;
              targetRoadPt = { x: p1.x, y: p1.y };

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
        bestX = CS * this.prng.int(3 + bIdx * 6, Math.max(4, map.grid.cols - wCells - 4));
        bestY = CS * this.prng.int(3, Math.max(4, map.grid.rows - hCells - 4));
        doorSide = this.prng.choice(['south', 'east']);
      }

      const doorPos = { side: doorSide, offset: 0.5 };

      let doorWorldX = bestX + houseW * 0.5;
      let doorWorldY = bestY + houseH;
      if (doorSide === 'north') doorWorldY = bestY;
      else if (doorSide === 'west') { doorWorldX = bestX; doorWorldY = bestY + houseH * 0.5; }
      else if (doorSide === 'east') { doorWorldX = bestX + houseW; doorWorldY = bestY + houseH * 0.5; }

      const frontPath = [];
      if (targetRoadPt) {
        frontPath.push({ x: doorWorldX, y: doorWorldY });
        const midX = (doorWorldX + targetRoadPt.x) * 0.5 + this.prng.float(-4, 4);
        const midY = (doorWorldY + targetRoadPt.y) * 0.5 + this.prng.float(-4, 4);
        frontPath.push({ x: midX, y: midY });
        frontPath.push({ x: targetRoadPt.x, y: targetRoadPt.y });
      }

      const windows = [];
      if (doorSide !== 'north') windows.push({ side: 'north', offset: 0.3 }, { side: 'north', offset: 0.7 });
      if (doorSide !== 'south') windows.push({ side: 'south', offset: 0.3 }, { side: 'south', offset: 0.7 });
      if (doorSide !== 'east') windows.push({ side: 'east', offset: 0.5 });
      if (doorSide !== 'west') windows.push({ side: 'west', offset: 0.5 });

      // Build Multi-room layout, internal walls, props, paddock and outdoor features
      const houseData = this.buildHouseArchetype(buildingType, bestX, bestY, houseW, houseH, doorSide, CS);

      map.buildings.push({
        x: bestX,
        y: bestY,
        width: houseW,
        height: houseH,
        cellsW: wCells,
        cellsH: hCells,
        wallThickness: 6,
        type: buildingType,
        name: houseData.name,
        door: doorPos,
        doorWorld: { x: doorWorldX, y: doorWorldY },
        frontPath: frontPath,
        windows: windows,
        rooms: houseData.rooms,
        internalWalls: houseData.internalWalls,
        props: houseData.props,
        outdoorFeatures: houseData.outdoorFeatures,
        paddock: houseData.paddock,
        hasPorch: houseData.hasPorch,
        porchStyle: houseData.porchStyle,
        roofStyle: houseData.roofStyle
      });
    }
  }

  buildHouseArchetype(type, bx, by, bw, bh, doorSide, CS) {
    const rooms = [];
    const internalWalls = [];
    const props = [];
    const outdoorFeatures = [];
    let paddock = null;
    let name = '';
    let hasPorch = false;
    let porchStyle = 'wood';
    let roofStyle = 'gabled';

    if (type === 'tavern') {
      const tavernNames = ['Таверна «Пьяный Селезень»', 'Трактир «Золотой Хмель»', 'Придорожная таверна', 'Таверна «Серебряный Кубок»'];
      name = this.prng.choice(tavernNames);
      hasPorch = true;
      porchStyle = 'wood';
      roofStyle = 'gabled';

      const splitX = bw * 0.62;
      const splitY = bh * 0.5;

      rooms.push({
        id: 'taproom',
        name: 'Трактирный зал',
        relX: 0, relY: 0, relW: splitX, relH: bh,
        floorStyle: 'wood_planks'
      });
      rooms.push({
        id: 'kitchen',
        name: 'Кухня',
        relX: splitX, relY: 0, relW: bw - splitX, relH: splitY,
        floorStyle: 'stone_flagstones'
      });
      rooms.push({
        id: 'bedroom',
        name: 'Комната для гостей',
        relX: splitX, relY: splitY, relW: bw - splitX, relH: bh - splitY,
        floorStyle: 'wood_planks'
      });

      internalWalls.push({
        x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh,
        door: { y: by + bh * 0.25, size: 22 }
      });
      internalWalls.push({
        x1: bx + splitX, y1: by + splitY, x2: bx + bw, y2: by + splitY,
        door: { x: bx + splitX + (bw - splitX) * 0.5, size: 20 }
      });

      props.push({ type: 'bar_counter', x: bx + 16, y: by + 16, w: splitX - 32, h: 22 });
      props.push({ type: 'drinking_table', x: bx + 24, y: by + bh * 0.55, w: CS * 1.5, h: CS * 0.8 });
      props.push({ type: 'drinking_table', x: bx + splitX - CS * 1.6, y: by + bh * 0.55, w: CS * 1.5, h: CS * 0.8 });
      props.push({ type: 'hearth', x: bx + splitX * 0.4, y: by + bh - 10, w: CS * 1.2, h: 12 });

      props.push({ type: 'hearth', x: bx + splitX + 8, y: by - 4, w: (bw - splitX) - 16, h: 12 });
      props.push({ type: 'barrel', x: bx + bw - 16, y: by + 24, r: 8 });
      props.push({ type: 'crate', x: bx + bw - 20, y: by + 40, w: 14, h: 14 });

      props.push({ type: 'bed', x: bx + splitX + 8, y: by + splitY + 8, w: CS * 0.9, h: CS * 1.4 });
      props.push({ type: 'bed', x: bx + bw - CS * 0.9 - 8, y: by + splitY + 8, w: CS * 0.9, h: CS * 1.4 });

      outdoorFeatures.push({ type: 'hitching_post', x: bx - 26, y: by + bh * 0.5 });
      outdoorFeatures.push({ type: 'trough', x: bx - 30, y: by + bh * 0.7, w: 14, h: 32 });
      outdoorFeatures.push({ type: 'woodpile', x: bx + bw + 12, y: by + 10, w: CS * 1.1, h: CS * 0.6 });

    } else if (type === 'manor') {
      const manorNames = ['Усадьба графа', 'Дворянское поместье', 'Маниор землевладельца'];
      name = this.prng.choice(manorNames);
      hasPorch = true;
      porchStyle = 'stone';
      roofStyle = 'hipped';

      const splitX = bw * 0.5;
      const splitY = bh * 0.55;

      rooms.push({ id: 'parlor', name: 'Парадная зала', relX: 0, relY: 0, relW: splitX, relH: splitY, floorStyle: 'fancy_carpet' });
      rooms.push({ id: 'dining', name: 'Столовая', relX: splitX, relY: 0, relW: bw - splitX, relH: splitY, floorStyle: 'wood_planks' });
      rooms.push({ id: 'master_bed', name: 'Покои', relX: 0, relY: splitY, relW: splitX, relH: bh - splitY, floorStyle: 'wood_planks' });
      rooms.push({ id: 'study', name: 'Кабинет', relX: splitX, relY: splitY, relW: bw - splitX, relH: bh - splitY, floorStyle: 'wood_planks' });

      internalWalls.push({
        x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh,
        door: { y: by + splitY * 0.5, size: 22 }
      });
      internalWalls.push({
        x1: bx, y1: by + splitY, x2: bx + bw, y2: by + splitY,
        door: { x: bx + splitX * 0.5, size: 20 }
      });

      props.push({ type: 'hearth', x: bx + 10, y: by - 4, w: CS * 1.2, h: 12 });
      props.push({ type: 'dining_table', x: bx + splitX + 12, y: by + 16, w: (bw - splitX) - 24, h: CS * 1.0 });
      props.push({ type: 'double_bed', x: bx + 12, y: by + splitY + 12, w: CS * 1.4, h: CS * 1.5 });
      props.push({ type: 'bookshelf', x: bx + bw - CS * 1.2 - 8, y: by + splitY + 8, w: CS * 1.2, h: 12 });
      props.push({ type: 'desk', x: bx + bw - CS * 1.2 - 8, y: by + bh - CS * 0.9 - 8, w: CS * 1.2, h: CS * 0.8 });

      outdoorFeatures.push({ type: 'well', x: bx + bw + 28, y: by + bh * 0.5, r: 14 });

    } else if (type === 'stable') {
      const stableNames = ['Конюшня с загоном', 'Почтовая станция', 'Извозчичий двор'];
      name = this.prng.choice(stableNames);
      hasPorch = false;
      roofStyle = 'gabled';

      const stall1W = bw * 0.35;
      const stall2W = bw * 0.35;

      rooms.push({ id: 'stall1', name: 'Стойло 1', relX: 0, relY: 0, relW: stall1W, relH: bh, floorStyle: 'straw_timber' });
      rooms.push({ id: 'stall2', name: 'Стойло 2', relX: stall1W, relY: 0, relW: stall2W, relH: bh, floorStyle: 'straw_timber' });
      rooms.push({ id: 'harness', name: 'Сбруйная и сеновал', relX: stall1W + stall2W, relY: 0, relW: bw - (stall1W + stall2W), relH: bh, floorStyle: 'wood_planks' });

      internalWalls.push({
        x1: bx + stall1W, y1: by, x2: bx + stall1W, y2: by + bh,
        door: { y: by + bh * 0.5, size: 24 }
      });
      internalWalls.push({
        x1: bx + stall1W + stall2W, y1: by, x2: bx + stall1W + stall2W, y2: by + bh,
        door: { y: by + bh * 0.5, size: 22 }
      });

      props.push({ type: 'horse_stall', x: bx + 8, y: by + 8, w: stall1W - 16, h: bh - 16 });
      props.push({ type: 'horse_stall', x: bx + stall1W + 8, y: by + 8, w: stall2W - 16, h: bh - 16 });
      props.push({ type: 'hay_bale', x: bx + stall1W + stall2W + 8, y: by + 8, w: 22, h: 16 });
      props.push({ type: 'hay_bale', x: bx + stall1W + stall2W + 8, y: by + 28, w: 22, h: 16 });
      props.push({ type: 'crate', x: bx + bw - 20, y: by + bh - 24, w: 16, h: 16 });

      paddock = {
        x: bx + bw,
        y: by,
        w: CS * 4.5,
        h: bh,
        side: 'east'
      };

      outdoorFeatures.push({ type: 'hitching_post', x: bx - 22, y: by + bh * 0.5 });
      outdoorFeatures.push({ type: 'trough', x: bx - 26, y: by + bh * 0.7, w: 14, h: 30 });

    } else if (type === 'blacksmith') {
      const forgeNames = ['Кузница «Стальной Молот»', 'Деревенская кузница', 'Кузнечный двор'];
      name = this.prng.choice(forgeNames);
      hasPorch = false;
      roofStyle = 'gabled';

      const splitX = bw * 0.65;
      rooms.push({ id: 'forge', name: 'Кузнечный цех', relX: 0, relY: 0, relW: splitX, relH: bh, floorStyle: 'cobblestone' });
      rooms.push({ id: 'living', name: 'Жилая комната', relX: splitX, relY: 0, relW: bw - splitX, relH: bh, floorStyle: 'wood_planks' });

      internalWalls.push({
        x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh,
        door: { y: by + bh * 0.5, size: 20 }
      });

      props.push({ type: 'forge_hearth', x: bx + 12, y: by - 4, w: CS * 1.3, h: 14 });
      props.push({ type: 'anvil', x: bx + splitX * 0.5, y: by + bh * 0.4, r: 10 });
      props.push({ type: 'trough', x: bx + splitX - 22, y: by + 12, w: 14, h: 32 });
      props.push({ type: 'weapons_rack', x: bx + 10, y: by + bh - CS * 0.8, w: CS * 1.1, h: 10 });

      props.push({ type: 'bed', x: bx + splitX + 8, y: by + 8, w: CS * 0.9, h: CS * 1.4 });
      props.push({ type: 'table', x: bx + bw - CS * 1.1 - 8, y: by + bh - CS * 0.8 - 8, w: CS * 1.1, h: CS * 0.7 });

      outdoorFeatures.push({ type: 'scrap_pile', x: bx - 30, y: by + 10, w: 22, h: 22 });

    } else if (type === 'hunter_cabin') {
      const hunterNames = ['Охотничья изба', 'Изба егеря', 'Лесная сторожка'];
      name = this.prng.choice(hunterNames);
      hasPorch = true;
      porchStyle = 'wood';
      roofStyle = 'gabled';

      const splitX = bw * 0.7;
      rooms.push({ id: 'cabin', name: 'Жилая изба', relX: 0, relY: 0, relW: splitX, relH: bh, floorStyle: 'wood_planks' });
      rooms.push({ id: 'trophy', name: 'Кладовая шкур', relX: splitX, relY: 0, relW: bw - splitX, relH: bh, floorStyle: 'wood_planks' });

      internalWalls.push({
        x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh,
        door: { y: by + bh * 0.5, size: 20 }
      });

      props.push({ type: 'hearth', x: bx + 8, y: by - 4, w: CS * 0.9, h: 12 });
      props.push({ type: 'bed', x: bx + 8, y: by + bh - CS * 1.4 - 8, w: CS * 0.9, h: CS * 1.4 });
      props.push({ type: 'pelt_drying_frame', x: bx + splitX + 6, y: by + 8, w: (bw - splitX) - 12, h: CS * 1.2 });
      props.push({ type: 'crate', x: bx + bw - 18, y: by + bh - 20, w: 14, h: 14 });

      outdoorFeatures.push({ type: 'woodpile', x: bx - 32, y: by + 8, w: CS * 1.0, h: CS * 0.6 });

    } else if (type === 'mill_house') {
      name = 'Дом мельника с жерновами';
      hasPorch = false;
      roofStyle = 'gabled';

      const splitX = bw * 0.6;
      rooms.push({ id: 'mill', name: 'Мельничный цех', relX: 0, relY: 0, relW: splitX, relH: bh, floorStyle: 'stone_flagstones' });
      rooms.push({ id: 'living', name: 'Комната мельника', relX: splitX, relY: 0, relW: bw - splitX, relH: bh, floorStyle: 'wood_planks' });

      internalWalls.push({
        x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh,
        door: { y: by + bh * 0.5, size: 20 }
      });

      props.push({ type: 'millstone', x: bx + splitX * 0.5, y: by + bh * 0.5, r: CS * 0.8 });
      props.push({ type: 'grain_sack', x: bx + 8, y: by + 8 });
      props.push({ type: 'grain_sack', x: bx + 22, y: by + 8 });
      props.push({ type: 'grain_sack', x: bx + 8, y: by + 22 });

      props.push({ type: 'bed', x: bx + splitX + 8, y: by + 8, w: CS * 0.9, h: CS * 1.4 });
      props.push({ type: 'table', x: bx + bw - CS * 1.0 - 8, y: by + bh - CS * 0.7 - 8, w: CS * 1.0, h: CS * 0.7 });

    } else if (type === 'farmstead_house') {
      const farmNames = ['Крестьянская усадьба', 'Фермерский дом', 'Деревенская изба'];
      name = this.prng.choice(farmNames);
      hasPorch = true;
      porchStyle = 'wood';
      roofStyle = 'gabled';

      const splitX = bw * 0.6;
      const splitY = bh * 0.5;

      rooms.push({ id: 'main', name: 'Жилая изба', relX: 0, relY: 0, relW: splitX, relH: bh, floorStyle: 'wood_planks' });
      rooms.push({ id: 'bed', name: 'Спальня', relX: splitX, relY: 0, relW: bw - splitX, relH: splitY, floorStyle: 'wood_planks' });
      rooms.push({ id: 'pantry', name: 'Кладовая', relX: splitX, relY: splitY, relW: bw - splitX, relH: bh - splitY, floorStyle: 'straw_timber' });

      internalWalls.push({
        x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh,
        door: { y: by + bh * 0.25, size: 20 }
      });
      internalWalls.push({
        x1: bx + splitX, y1: by + splitY, x2: bx + bw, y2: by + splitY,
        door: { x: bx + splitX + (bw - splitX) * 0.5, size: 18 }
      });

      props.push({ type: 'hearth', x: bx + 8, y: by - 4, w: CS * 0.9, h: 12 });
      props.push({ type: 'table', x: bx + 16, y: by + bh * 0.45, w: CS * 1.2, h: CS * 0.75 });
      props.push({ type: 'bed', x: bx + splitX + 8, y: by + 8, w: CS * 0.9, h: CS * 1.3 });
      props.push({ type: 'crate', x: bx + bw - 18, y: by + splitY + 8, w: 14, h: 14 });
      props.push({ type: 'barrel', x: bx + bw - 14, y: by + bh - 18, r: 8 });

      outdoorFeatures.push({ type: 'well', x: bx - 28, y: by + bh * 0.5, r: 12 });
      outdoorFeatures.push({ type: 'woodpile', x: bx + bw + 10, y: by + 8, w: CS * 1.0, h: CS * 0.6 });

    } else {
      name = 'Уютный коттедж';
      hasPorch = true;
      porchStyle = 'wood';
      roofStyle = 'gabled';

      rooms.push({ id: 'main', name: 'Уютная горница', relX: 0, relY: 0, relW: bw, relH: bh, floorStyle: 'wood_planks' });

      props.push({ type: 'hearth', x: bx + 8, y: by - 4, w: CS * 0.8, h: 12 });
      props.push({ type: 'bed', x: bx + bw - CS * 0.9 - 8, y: by + 8, w: CS * 0.9, h: CS * 1.4 });
      props.push({ type: 'table', x: bx + 12, y: by + bh - CS * 0.7 - 8, w: CS * 1.0, h: CS * 0.7 });

      outdoorFeatures.push({ type: 'woodpile', x: bx - 30, y: by + 8, w: CS * 0.9, h: CS * 0.6 });
    }

    return {
      name,
      rooms,
      internalWalls,
      props,
      outdoorFeatures,
      paddock,
      hasPorch,
      porchStyle,
      roofStyle
    };
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

    // Archetype choices for diverse ancient ruins
    const archetypes = ['temple', 'amphitheater', 'fortress', 'druid_circle', 'manor', 'shrine', 'sunken_crypt', 'observatory'];

    // Number of ruins: 1 main ruin, plus optionally 1 secondary ruin on larger maps or ruins biome
    const numRuins = (this.biomeId === 'ruins' && map.areaFactor >= 1.0) ? (this.prng.bool(0.65) ? 2 : 1) : 1;

    for (let i = 0; i < numRuins; i++) {
      const isMain = (i === 0);
      let archetype;
      let rank;

      if (isMain) {
        archetype = this.prng.choice(archetypes);
        rank = this.prng.choice([2, 3, 4]); // Medium, Large, or Monumental
      } else {
        archetype = this.prng.choice(['shrine', 'druid_circle', 'sunken_crypt']);
        rank = 1; // Small rank for secondary outpost/shrine
      }

      let cx, cy;
      if (isMain) {
        cx = this.prng.float(W * 0.35, W * 0.65);
        cy = this.prng.float(H * 0.35, H * 0.65);
      } else {
        const quadX = this.prng.choice([W * 0.22, W * 0.78]);
        const quadY = this.prng.choice([H * 0.22, H * 0.78]);
        cx = quadX + this.prng.float(-CS * 2, CS * 2);
        cy = quadY + this.prng.float(-CS * 2, CS * 2);
      }

      switch (archetype) {
        case 'amphitheater':
          this.generateAmphitheaterRuin(map, cx, cy, rank);
          break;
        case 'fortress':
          this.generateFortressRuin(map, cx, cy, rank);
          break;
        case 'druid_circle':
          this.generateDruidCircleRuin(map, cx, cy, rank);
          break;
        case 'manor':
          this.generateManorRuin(map, cx, cy, rank);
          break;
        case 'shrine':
          this.generateShrineRuin(map, cx, cy, rank);
          break;
        case 'sunken_crypt':
          this.generateSunkenCryptRuin(map, cx, cy, rank);
          break;
        case 'observatory':
          this.generateObservatoryRuin(map, cx, cy, rank);
          break;
        case 'temple':
        default:
          this.generateTempleRuin(map, cx, cy, rank);
          break;
      }
    }
  }

  generateTempleRuin(map, cx, cy, rank) {
    const CS = map.grid.cellSize;
    const sizeScale = rank === 4 ? 1.3 : rank === 3 ? 1.0 : 0.75;
    const mainW = Math.round(this.prng.int(8, 12) * sizeScale) * CS;
    const mainH = Math.round(this.prng.int(5, 8) * sizeScale) * CS;
    const leftX = cx - mainW * 0.5;
    const topY = cy - mainH * 0.5;

    const rankTitles = {
      2: 'Малое Святилище Забытых Богов',
      3: 'Разрушенный Древний Храм',
      4: 'Великий Храмовый Комплекс'
    };

    const plazas = [{
      x: leftX, y: topY, width: mainW, height: mainH, tileW: 16, tileH: 16, type: 'main_sanctuary'
    }];

    if (rank >= 3 && this.prng.bool(0.7)) {
      const annexSide = this.prng.choice(['north', 'south', 'east', 'west']);
      let ax = leftX, ay = topY, aw = CS * 4, ah = CS * 3;
      if (annexSide === 'north') { ay = topY - ah; ax = cx - aw * 0.5; }
      else if (annexSide === 'south') { ay = topY + mainH; ax = cx - aw * 0.5; }
      else if (annexSide === 'east') { ax = leftX + mainW; ay = cy - ah * 0.5; }
      else { ax = leftX - aw; ay = cy - ah * 0.5; }
      plazas.push({ x: ax, y: ay, width: aw, height: ah, tileW: 16, tileH: 16, type: 'annex' });
    }

    const daisWidth = CS * (2.8 * sizeScale);
    const daisHeight = CS * (2.0 * sizeScale);
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

    const walls = [];
    const wallThick = 14;
    const nBreach = this.prng.float(0.3, 0.7);
    walls.push({ x1: leftX, y1: topY, x2: leftX + mainW * (nBreach - 0.12), y2: topY, thickness: wallThick });
    walls.push({ x1: leftX + mainW * (nBreach + 0.12), y1: topY, x2: leftX + mainW, y2: topY, thickness: wallThick });

    const sGate = 0.5;
    walls.push({ x1: leftX, y1: topY + mainH, x2: leftX + mainW * (sGate - 0.15), y2: topY + mainH, thickness: wallThick });
    walls.push({ x1: leftX + mainW * (sGate + 0.15), y1: topY + mainH, x2: leftX + mainW, y2: topY + mainH, thickness: wallThick });

    const wBreach = this.prng.float(0.4, 0.6);
    walls.push({ x1: leftX, y1: topY, x2: leftX, y2: topY + mainH * (wBreach - 0.1), thickness: wallThick });
    walls.push({ x1: leftX, y1: topY + mainH * (wBreach + 0.1), x2: leftX, y2: topY + mainH, thickness: wallThick });

    const eBreach = this.prng.float(0.3, 0.7);
    walls.push({ x1: leftX + mainW, y1: topY, x2: leftX + mainW, y2: topY + mainH * (eBreach - 0.12), thickness: wallThick });
    walls.push({ x1: leftX + mainW, y1: topY + mainH * (eBreach + 0.12), x2: leftX + mainW, y2: topY + mainH, thickness: wallThick });

    const buttresses = [
      { x: leftX - 4, y: topY - 4, w: 18, h: 18 },
      { x: leftX + mainW - 14, y: topY - 4, w: 18, h: 18 },
      { x: leftX - 4, y: topY + mainH - 14, w: 18, h: 18 },
      { x: leftX + mainW - 14, y: topY + mainH - 14, w: 18, h: 18 }
    ];

    const pillars = [];
    const numPairs = rank >= 4 ? 6 : rank === 3 ? 5 : 3;
    const colSpacing = (mainW - CS * 2.5) / Math.max(1, numPairs - 1);
    const colStartX = leftX + CS * 1.25;
    const colNorthY = cy - daisHeight * 0.75;
    const colSouthY = cy + daisHeight * 0.75;

    for (let i = 0; i < numPairs; i++) {
      const px = colStartX + i * colSpacing;
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

    const altar = {
      x: cx, y: cy, width: CS * 1.4, height: CS * 0.9, runes: true,
      braziers: [
        { x: cx - CS * 1.1, y: cy - CS * 0.6, radius: 6 },
        { x: cx + CS * 1.1, y: cy - CS * 0.6, radius: 6 },
        { x: cx - CS * 1.1, y: cy + CS * 0.6, radius: 6 },
        { x: cx + CS * 1.1, y: cy + CS * 0.6, radius: 6 }
      ]
    };

    const cryptStairs = {
      x: leftX + CS * 1.2, y: cy, width: 28, length: 44, angle: 0, steps: 6
    };

    const sarcophagi = [];
    const numTombs = this.prng.int(1, 3);
    for (let t = 0; t < numTombs; t++) {
      sarcophagi.push({
        x: leftX + mainW - CS * 1.5,
        y: cy + (t - (numTombs - 1) * 0.5) * (CS * 1.4),
        width: 36, height: 20, angle: this.prng.float(-0.15, 0.15), lidDisplaced: this.prng.bool(0.6)
      });
    }

    const rubblePiles = [];
    for (let r = 0; r < this.prng.int(8, 16); r++) {
      rubblePiles.push({
        x: leftX + this.prng.float(0, mainW), y: topY + this.prng.float(0, mainH),
        radius: this.prng.float(12, 28), pebbleCount: this.prng.int(5, 10)
      });
    }

    const ashlarBlocks = [];
    for (let b = 0; b < this.prng.int(14, 28); b++) {
      ashlarBlocks.push({
        x: leftX + this.prng.float(-CS * 0.5, mainW + CS * 0.5),
        y: topY + this.prng.float(-CS * 0.5, mainH + CS * 0.5),
        w: this.prng.float(10, 18), h: this.prng.float(7, 12), angle: this.prng.float(0, Math.PI * 2)
      });
    }

    const mossPatches = [];
    for (let m = 0; m < this.prng.int(10, 20); m++) {
      mossPatches.push({
        x: leftX + this.prng.float(10, mainW - 10), y: topY + this.prng.float(10, mainH - 10), radius: this.prng.float(14, 30)
      });
    }

    map.ruins.push({
      archetype: 'temple',
      rank,
      name: rankTitles[rank] || 'Древний Храм',
      cx, cy, mainW, mainH,
      plazas, dais, walls, buttresses, pillars, altar, cryptStairs, sarcophagi, rubblePiles, ashlarBlocks, mossPatches
    });
  }

  generateAmphitheaterRuin(map, cx, cy, rank) {
    const CS = map.grid.cellSize;
    const outerRx = CS * (3.8 + rank * 0.9);
    const outerRy = CS * (2.8 + rank * 0.7);
    const arenaRx = outerRx * 0.45;
    const arenaRy = outerRy * 0.45;

    const rankTitles = {
      2: 'Разрушенный Колизей',
      3: 'Древняя Гладиаторская Арена',
      4: 'Великий Имперский Амфитеатр'
    };

    const arenaFloor = { cx, cy, rx: arenaRx, ry: arenaRy, dirtStains: true };

    const numRings = rank >= 4 ? 5 : rank === 3 ? 4 : 3;
    const concentricRings = [];
    for (let r = 1; r <= numRings; r++) {
      const ringScale = 0.45 + (r / numRings) * 0.55;
      concentricRings.push({
        rx: outerRx * ringScale, ry: outerRy * ringScale,
        breachAngle: this.prng.float(0, Math.PI * 2), breachArc: this.prng.float(0.4, 0.9)
      });
    }

    const arcades = [];
    const numArcadeSegs = 6;
    for (let a = 0; a < numArcadeSegs; a++) {
      const angStart = (a / numArcadeSegs) * Math.PI * 2;
      const angEnd = angStart + (Math.PI * 2 / numArcadeSegs) * 0.65;
      arcades.push({ cx, cy, rx: outerRx + 8, ry: outerRy + 8, angStart, angEnd });
    }

    const trapdoor = { x: cx, y: cy, width: 28, height: 20 };

    const statues = [];
    for (let s = 0; s < 3; s++) {
      const ang = (s / 3) * Math.PI * 2 + 0.3;
      statues.push({
        x: cx + Math.cos(ang) * (arenaRx + 18), y: cy + Math.sin(ang) * (arenaRy + 14),
        radius: 10, fallenAngle: this.prng.float(0, Math.PI * 2)
      });
    }

    const braziers = [
      { x: cx - arenaRx - 10, y: cy, radius: 6 },
      { x: cx + arenaRx + 10, y: cy, radius: 6 }
    ];

    const rubblePiles = [];
    for (let r = 0; r < 10; r++) {
      const ang = this.prng.float(0, Math.PI * 2);
      const dist = this.prng.float(arenaRx, outerRx);
      rubblePiles.push({
        x: cx + Math.cos(ang) * dist, y: cy + Math.sin(ang) * (dist * (outerRy / outerRx)),
        radius: this.prng.float(10, 22), pebbleCount: this.prng.int(4, 8)
      });
    }

    const mossPatches = [];
    for (let m = 0; m < 8; m++) {
      const ang = this.prng.float(0, Math.PI * 2);
      const dist = this.prng.float(arenaRx, outerRx);
      mossPatches.push({
        x: cx + Math.cos(ang) * dist, y: cy + Math.sin(ang) * (dist * (outerRy / outerRx)),
        radius: this.prng.float(12, 24)
      });
    }

    map.ruins.push({
      archetype: 'amphitheater',
      rank,
      name: rankTitles[rank] || 'Древняя Арена',
      cx, cy, mainW: outerRx * 2, mainH: outerRy * 2, outerRx, outerRy, arenaFloor, concentricRings, arcades, trapdoor, statues, braziers, rubblePiles, mossPatches
    });
  }

  generateFortressRuin(map, cx, cy, rank) {
    const CS = map.grid.cellSize;
    const mainW = Math.round((6 + rank * 1.5)) * CS;
    const mainH = Math.round((4.5 + rank * 1.2)) * CS;
    const leftX = cx - mainW * 0.5;
    const topY = cy - mainH * 0.5;

    const rankTitles = {
      2: 'Заброшенный Пограничный Форт',
      3: 'Руины Древней Цитадели',
      4: 'Великий Разрушенный Бастион'
    };

    const bastions = [
      { x: leftX, y: topY, r: 20 },
      { x: leftX + mainW, y: topY, r: 20 },
      { x: leftX, y: topY + mainH, r: 20 },
      { x: leftX + mainW, y: topY + mainH, r: 20 }
    ];

    const walls = [];
    const thick = 18;
    walls.push({ x1: leftX + 20, y1: topY, x2: leftX + mainW - 20, y2: topY, thickness: thick });
    walls.push({ x1: leftX + 20, y1: topY + mainH, x2: cx - 25, y2: topY + mainH, thickness: thick });
    walls.push({ x1: cx + 25, y1: topY + mainH, x2: leftX + mainW - 20, y2: topY + mainH, thickness: thick });
    walls.push({ x1: leftX, y1: topY + 20, x2: leftX, y2: topY + mainH - 20, thickness: thick });
    walls.push({ x1: leftX + mainW, y1: topY + 20, x2: leftX + mainW, y2: topY + mainH * 0.4, thickness: thick });
    walls.push({ x1: leftX + mainW, y1: topY + mainH * 0.65, x2: leftX + mainW, y2: topY + mainH - 20, thickness: thick });

    const keep = { x: cx - CS * 1.5, y: topY + CS * 1.2, w: CS * 3.0, h: CS * 2.2 };

    const armory = [
      { x: leftX + CS * 1.2, y: topY + CS * 1.5, type: 'weapon_rack' },
      { x: leftX + CS * 1.2, y: topY + CS * 2.5, type: 'crates' }
    ];

    const siegeDebris = [
      { x: cx + CS * 1.8, y: topY + mainH - CS * 1.5, angle: 0.4 }
    ];

    const plazas = [{
      x: leftX, y: topY, width: mainW, height: mainH, tileW: 20, tileH: 20, type: 'fortress_courtyard'
    }];

    const rubblePiles = [];
    for (let r = 0; r < 12; r++) {
      rubblePiles.push({
        x: leftX + this.prng.float(10, mainW - 10), y: topY + this.prng.float(10, mainH - 10),
        radius: this.prng.float(14, 26), pebbleCount: 8
      });
    }

    map.ruins.push({
      archetype: 'fortress',
      rank,
      name: rankTitles[rank] || 'Руины Цитадели',
      cx, cy, mainW, mainH, bastions, walls, keep, armory, siegeDebris, plazas, rubblePiles
    });
  }

  generateDruidCircleRuin(map, cx, cy, rank) {
    const CS = map.grid.cellSize;
    const radius = CS * (2.8 + rank * 0.7);

    const rankTitles = {
      1: 'Малый Круг Дольменов',
      2: 'Круг Древних Менгиров',
      3: 'Величественное Святилище Друидов',
      4: 'Великое Мегалитическое Кольцо'
    };

    const numMonoliths = rank >= 3 ? 12 : 8;
    const monoliths = [];
    for (let i = 0; i < numMonoliths; i++) {
      const ang = (i / numMonoliths) * Math.PI * 2;
      const mx = cx + Math.cos(ang) * radius;
      const my = cy + Math.sin(ang) * radius;
      monoliths.push({
        x: mx, y: my, w: 16, h: 10, angle: ang + Math.PI * 0.5,
        hasLintel: (i % 2 === 0 && this.prng.bool(0.6))
      });
    }

    const sacrificialPit = { x: cx, y: cy, radius: CS * 0.9, glowingRunes: true };

    const treeRoots = [];
    for (let r = 0; r < 6; r++) {
      const ang = (r / 6) * Math.PI * 2 + 0.2;
      treeRoots.push({
        x: cx + Math.cos(ang) * (radius * 0.6), y: cy + Math.sin(ang) * (radius * 0.6),
        len: this.prng.float(25, 45), angle: ang
      });
    }

    const mossPatches = [];
    for (let m = 0; m < 10; m++) {
      const ang = this.prng.float(0, Math.PI * 2);
      const dist = this.prng.float(0, radius + 15);
      mossPatches.push({
        x: cx + Math.cos(ang) * dist, y: cy + Math.sin(ang) * dist, radius: this.prng.float(12, 25)
      });
    }

    map.ruins.push({
      archetype: 'druid_circle',
      rank,
      name: rankTitles[rank] || 'Круг Менгиров',
      cx, cy, mainW: radius * 2, mainH: radius * 2, radius, monoliths, sacrificialPit, treeRoots, mossPatches
    });
  }

  generateManorRuin(map, cx, cy, rank) {
    const CS = map.grid.cellSize;
    const mainW = Math.round((6 + rank * 1.2)) * CS;
    const mainH = Math.round((4.5 + rank * 1.0)) * CS;
    const leftX = cx - mainW * 0.5;
    const topY = cy - mainH * 0.5;

    const rankTitles = {
      2: 'Разрушенная Дворянская Усадьба',
      3: 'Заброшенный Особняк Лорда',
      4: 'Руины Оккультной Академии'
    };

    const rooms = [
      { name: 'Зал', x: leftX, y: topY, w: mainW * 0.6, h: mainH * 0.5 },
      { name: 'Библиотека', x: leftX + mainW * 0.6, y: topY, w: mainW * 0.4, h: mainH * 0.5 },
      { name: 'Двор', x: leftX, y: topY + mainH * 0.5, w: mainW, h: mainH * 0.5 }
    ];

    const walls = [];
    const thick = 12;
    walls.push({ x1: leftX, y1: topY, x2: leftX + mainW * 0.7, y2: topY, thickness: thick });
    walls.push({ x1: leftX, y1: topY + mainH, x2: leftX + mainW * 0.4, y2: topY + mainH, thickness: thick });
    walls.push({ x1: leftX + mainW * 0.6, y1: topY + mainH, x2: leftX + mainW, y2: topY + mainH, thickness: thick });
    walls.push({ x1: leftX, y1: topY, x2: leftX, y2: topY + mainH * 0.7, thickness: thick });
    walls.push({ x1: leftX + mainW, y1: topY, x2: leftX + mainW, y2: topY + mainH * 0.6, thickness: thick });
    walls.push({ x1: leftX + mainW * 0.6, y1: topY, x2: leftX + mainW * 0.6, y2: topY + mainH * 0.5, thickness: thick - 2 });

    const fireplace = { x: leftX + mainW * 0.3, y: topY, width: 32, height: 16 };
    const fountain = { x: leftX + mainW * 0.5, y: topY + mainH * 0.75, radius: CS * 0.9 };

    const libraryDebris = [
      { x: leftX + mainW * 0.75, y: topY + CS * 1.0, type: 'bookcase' },
      { x: leftX + mainW * 0.85, y: topY + CS * 1.8, type: 'desk' }
    ];

    const plazas = [{
      x: leftX, y: topY, width: mainW, height: mainH, tileW: 16, tileH: 16, type: 'manor_tiles'
    }];

    const rubblePiles = [];
    for (let r = 0; r < 8; r++) {
      rubblePiles.push({
        x: leftX + this.prng.float(10, mainW - 10), y: topY + this.prng.float(10, mainH - 10),
        radius: this.prng.float(10, 20), pebbleCount: 6
      });
    }

    map.ruins.push({
      archetype: 'manor',
      rank,
      name: rankTitles[rank] || 'Руины Усадьбы',
      cx, cy, mainW, mainH, rooms, walls, fireplace, fountain, libraryDebris, plazas, rubblePiles
    });
  }

  generateShrineRuin(map, cx, cy, rank) {
    const CS = map.grid.cellSize;
    const size = CS * 4;
    const leftX = cx - size * 0.5;
    const topY = cy - size * 0.5;

    const rankTitles = {
      1: 'Придорожный Алтарь',
      2: 'Малое Святилище Богини',
      3: 'Древнее Святилище Павших'
    };

    const dais = {
      x: leftX, y: topY, width: size, height: size,
      innerX: leftX + CS * 0.5, innerY: topY + CS * 0.5, innerWidth: size - CS, innerHeight: size - CS
    };

    const statueAlcove = { x: cx, y: topY + CS * 0.8, radius: CS * 0.75 };

    const altar = {
      x: cx, y: cy + CS * 0.3, width: CS * 1.2, height: CS * 0.8,
      braziers: [
        { x: cx - CS * 0.9, y: cy + CS * 0.3, radius: 5 },
        { x: cx + CS * 0.9, y: cy + CS * 0.3, radius: 5 }
      ]
    };

    const pillars = [
      { x: leftX + 12, y: topY + 12, radius: 8, plinthSize: 18 },
      { x: leftX + size - 12, y: topY + 12, radius: 8, plinthSize: 18 },
      { x: leftX + 12, y: topY + size - 12, radius: 8, plinthSize: 18 },
      { x: leftX + size - 12, y: topY + size - 12, radius: 8, plinthSize: 18 }
    ];

    const urns = [
      { x: cx - CS * 1.0, y: topY + CS * 1.2, r: 6 },
      { x: cx + CS * 1.1, y: topY + CS * 1.1, r: 7 }
    ];

    const mossPatches = [
      { x: cx - 10, y: cy, radius: 16 },
      { x: cx + 15, y: cy - 10, radius: 20 }
    ];

    map.ruins.push({
      archetype: 'shrine',
      rank,
      name: rankTitles[rank] || 'Придорожный Алтарь',
      cx, cy, mainW: size, mainH: size, dais, statueAlcove, altar, pillars, urns, mossPatches
    });
  }

  generateSunkenCryptRuin(map, cx, cy, rank) {
    const CS = map.grid.cellSize;
    const mainW = Math.round((5 + rank * 1.0)) * CS;
    const mainH = Math.round((4 + rank * 0.8)) * CS;
    const leftX = cx - mainW * 0.5;
    const topY = cy - mainH * 0.5;

    const rankTitles = {
      1: 'Древняя Могила Героя',
      2: 'Открытый Некрополь',
      3: 'Затонувший Подземный Склеп'
    };

    const stairs = { x: cx - 20, y: topY, width: 40, length: CS * 1.5, steps: 6 };

    const burialNiches = [];
    const numNiches = rank >= 3 ? 6 : 4;
    for (let n = 0; n < numNiches; n++) {
      const isLeft = (n % 2 === 0);
      const row = Math.floor(n / 2);
      const nx = isLeft ? leftX + CS * 0.8 : leftX + mainW - CS * 0.8;
      const ny = topY + CS * 1.5 + row * (CS * 1.3);
      burialNiches.push({
        x: nx, y: ny, width: 34, height: 18, angle: isLeft ? 0 : Math.PI, lidDisplaced: (n === 0 || n === 2)
      });
    }

    const walls = [];
    const thick = 16;
    walls.push({ x1: leftX, y1: topY, x2: cx - 20, y2: topY, thickness: thick });
    walls.push({ x1: cx + 20, y1: topY, x2: leftX + mainW, y2: topY, thickness: thick });
    walls.push({ x1: leftX, y1: topY + mainH, x2: leftX + mainW, y2: topY + mainH, thickness: thick });
    walls.push({ x1: leftX, y1: topY, x2: leftX, y2: topY + mainH, thickness: thick });
    walls.push({ x1: leftX + mainW, y1: topY, x2: leftX + mainW, y2: topY + mainH, thickness: thick });

    const plazas = [{
      x: leftX, y: topY, width: mainW, height: mainH, tileW: 16, tileH: 16, type: 'crypt_floor'
    }];

    const rubblePiles = [];
    for (let r = 0; r < 6; r++) {
      rubblePiles.push({
        x: leftX + this.prng.float(10, mainW - 10), y: topY + this.prng.float(10, mainH - 10),
        radius: this.prng.float(10, 20), pebbleCount: 5
      });
    }

    map.ruins.push({
      archetype: 'sunken_crypt',
      rank,
      name: rankTitles[rank] || 'Открытый Склеп',
      cx, cy, mainW, mainH, stairs, burialNiches, walls, plazas, rubblePiles
    });
  }

  generateObservatoryRuin(map, cx, cy, rank) {
    const CS = map.grid.cellSize;
    const radius = CS * (3.0 + rank * 0.7);

    const rankTitles = {
      2: 'Малая Астрономическая Башня',
      3: 'Древняя Небесная Обсерватория',
      4: 'Великая Астролябия Созерцателей'
    };

    const octagonalWalls = [];
    const sides = 8;
    for (let s = 0; s < sides; s++) {
      if (s === 1 || s === 5) continue; // breaches
      const a1 = (s / sides) * Math.PI * 2;
      const a2 = ((s + 1) / sides) * Math.PI * 2;
      octagonalWalls.push({
        x1: cx + Math.cos(a1) * radius, y1: cy + Math.sin(a1) * radius,
        x2: cx + Math.cos(a2) * radius, y2: cy + Math.sin(a2) * radius,
        thickness: 14
      });
    }

    const astrolabeFloor = { cx, cy, radius: radius * 0.75, constellations: true };

    const pillars = [];
    for (let p = 0; p < 4; p++) {
      const ang = (p / 4) * Math.PI * 2 + Math.PI * 0.25;
      pillars.push({
        x: cx + Math.cos(ang) * (radius * 0.55), y: cy + Math.sin(ang) * (radius * 0.55),
        radius: 9, plinthSize: 22
      });
    }

    const rubblePiles = [];
    for (let r = 0; r < 8; r++) {
      const ang = this.prng.float(0, Math.PI * 2);
      const dist = this.prng.float(0, radius);
      rubblePiles.push({
        x: cx + Math.cos(ang) * dist, y: cy + Math.sin(ang) * dist, radius: this.prng.float(10, 22), pebbleCount: 6
      });
    }

    map.ruins.push({
      archetype: 'observatory',
      rank,
      name: rankTitles[rank] || 'Древняя Обсерватория',
      cx, cy, mainW: radius * 2, mainH: radius * 2, radius, octagonalWalls, astrolabeFloor, pillars, rubblePiles
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
    const margin = cs * 2.5;
    const cx = W * 0.5;
    const cy = H * 0.5;

    const archetypes = ['chasm_divide', 'flooded_grotto', 'winding_labyrinth', 'spider_nest', 'crystal_geode'];
    const archetype = this.prng.choice(archetypes);

    const chambers = [];
    const passages = [];
    const stalagmites = [];
    const crystals = [];
    const torches = [];
    let pool = null;
    let chasm = null;
    let elevatedLedge = null;
    let webs = [];
    let mushrooms = [];

    if (archetype === 'chasm_divide') {
      // Archetype 1: Deep Chasm Divide & Bridges
      chambers.push({
        id: 0,
        name: 'Западный Привратный Грот',
        type: 'entrance',
        x: cx - W * 0.28,
        y: cy,
        rx: this.prng.float(cs * 4.5, cs * 6.5),
        ry: this.prng.float(cs * 4.0, cs * 6.0),
        angle: 0
      });
      chambers.push({
        id: 1,
        name: 'Восточное Древнее Святилище',
        type: 'altar',
        x: cx + W * 0.28,
        y: cy,
        rx: this.prng.float(cs * 5.0, cs * 7.0),
        ry: this.prng.float(cs * 4.5, cs * 6.5),
        angle: 0.1
      });
      chambers.push({
        id: 2,
        name: 'Северный Дозорный Уступ',
        type: 'ledge',
        x: cx,
        y: cy - H * 0.3,
        rx: this.prng.float(cs * 3.5, cs * 5.0),
        ry: this.prng.float(cs * 2.8, cs * 4.0),
        angle: 0
      });
      chambers.push({
        id: 3,
        name: 'Южный Скрытый Карст',
        type: 'stalagmites',
        x: cx + W * 0.15,
        y: cy + H * 0.28,
        rx: this.prng.float(cs * 3.5, cs * 5.0),
        ry: this.prng.float(cs * 3.0, cs * 4.2),
        angle: -0.2
      });

      // Connecting Passages
      passages.push({ p1: { x: chambers[0].x, y: chambers[0].y }, p2: { x: chambers[2].x, y: chambers[2].y }, control: { x: cx - cs * 2, y: cy - H * 0.18 }, width: cs * 3.2 });
      passages.push({ p1: { x: chambers[1].x, y: chambers[1].y }, p2: { x: chambers[2].x, y: chambers[2].y }, control: { x: cx + cs * 2, y: cy - H * 0.18 }, width: cs * 3.2 });
      passages.push({ p1: { x: chambers[0].x, y: chambers[0].y }, p2: { x: chambers[3].x, y: chambers[3].y }, control: { x: cx - cs * 1, y: cy + H * 0.18 }, width: cs * 3.0 });
      passages.push({ p1: { x: chambers[1].x, y: chambers[1].y }, p2: { x: chambers[3].x, y: chambers[3].y }, control: { x: cx + cs * 2, y: cy + H * 0.18 }, width: cs * 3.2 });
      passages.push({ p1: { x: chambers[0].x, y: chambers[0].y }, p2: { x: chambers[1].x, y: chambers[1].y }, control: { x: cx, y: cy }, width: cs * 3.8 });

      // Massive Chasm splitting the map
      chasm = {
        x1: cx,
        y1: margin,
        x2: cx,
        y2: H - margin,
        width: cs * 3.2,
        bridges: [
          { type: 'stone', x: cx, y: cy - cs * 1.5, width: cs * 2.0, length: cs * 4.2, angle: 0 },
          { type: 'wood', x: cx, y: cy + cs * 3.5, width: cs * 1.5, length: cs * 3.8, angle: 0.1 }
        ]
      };

      elevatedLedge = {
        chamberId: 2,
        elevationBonus: '+15 футов (Снайперский уступ)',
        stairs: { x: chambers[2].x - cs * 1.5, y: chambers[2].y + cs * 1.5, w: cs * 1.5, h: cs * 2.0 }
      };

    } else if (archetype === 'flooded_grotto') {
      // Archetype 2: Subterranean Lake & Flooded Caverns
      chambers.push({
        id: 0,
        name: 'Большое Подземное Озеро',
        type: 'lake',
        x: cx + W * 0.05,
        y: cy - H * 0.05,
        rx: this.prng.float(cs * 7.5, cs * 10.0),
        ry: this.prng.float(cs * 6.0, cs * 8.5),
        angle: 0.1
      });
      chambers.push({
        id: 1,
        name: 'Сухой Привратный Грот',
        type: 'entrance',
        x: cx - W * 0.32,
        y: cy + H * 0.22,
        rx: this.prng.float(cs * 4.0, cs * 5.5),
        ry: this.prng.float(cs * 3.5, cs * 4.8),
        angle: -0.2
      });
      chambers.push({
        id: 2,
        name: 'Грот Водопада и Тайника',
        type: 'waterfall',
        x: cx + W * 0.30,
        y: cy + H * 0.25,
        rx: this.prng.float(cs * 3.8, cs * 5.2),
        ry: this.prng.float(cs * 3.2, cs * 4.5),
        angle: 0.2
      });

      passages.push({ p1: { x: chambers[1].x, y: chambers[1].y }, p2: { x: chambers[0].x, y: chambers[0].y }, control: { x: cx - W * 0.15, y: cy }, width: cs * 4.2 });
      passages.push({ p1: { x: chambers[2].x, y: chambers[2].y }, p2: { x: chambers[0].x, y: chambers[0].y }, control: { x: cx + W * 0.18, y: cy }, width: cs * 3.8 });
      passages.push({ p1: { x: chambers[1].x, y: chambers[1].y }, p2: { x: chambers[2].x, y: chambers[2].y }, control: { x: cx, y: cy + H * 0.32 }, width: cs * 2.8 });

      // Subterranean glowing pool
      pool = {
        x: chambers[0].x,
        y: chambers[0].y,
        rx: chambers[0].rx * 0.85,
        ry: chambers[0].ry * 0.82,
        waterColor: '#0891b2',
        glowColor: 'rgba(6, 182, 212, 0.55)',
        steppingStones: [
          { x: chambers[0].x - cs * 2.5, y: chambers[0].y + cs * 1.2, r: cs * 0.65 },
          { x: chambers[0].x - cs * 0.8, y: chambers[0].y + cs * 0.4, r: cs * 0.75 },
          { x: chambers[0].x + cs * 1.2, y: chambers[0].y - cs * 0.5, r: cs * 0.7 },
          { x: chambers[0].x + cs * 3.0, y: chambers[0].y - cs * 1.5, r: cs * 0.8 },
          { x: chambers[0].x - cs * 1.0, y: chambers[0].y - cs * 2.2, r: cs * 0.6 }
        ]
      };

    } else if (archetype === 'winding_labyrinth') {
      // Archetype 3: Complex Winding Tunnels & Choke Points
      const numHubs = this.prng.int(5, 7);
      for (let i = 0; i < numHubs; i++) {
        const ang = (i / numHubs) * Math.PI * 2 + this.prng.float(-0.2, 0.2);
        const dist = this.prng.float(cs * 4.5, Math.min(W, H) * 0.35);
        chambers.push({
          id: i,
          name: `Каверна #${i + 1}`,
          type: i === 0 ? 'entrance' : (i % 2 === 0 ? 'stalagmites' : 'alcove'),
          x: clamp(cx + Math.cos(ang) * dist, margin + cs * 3, W - margin - cs * 3),
          y: clamp(cy + Math.sin(ang) * dist, margin + cs * 3, H - margin - cs * 3),
          rx: this.prng.float(cs * 2.8, cs * 4.5),
          ry: this.prng.float(cs * 2.5, cs * 4.0),
          angle: this.prng.float(-0.3, 0.3)
        });
      }

      // Interconnect adjacent hubs and cross links
      for (let i = 0; i < numHubs; i++) {
        const next = (i + 1) % numHubs;
        passages.push({
          p1: { x: chambers[i].x, y: chambers[i].y },
          p2: { x: chambers[next].x, y: chambers[next].y },
          control: {
            x: (chambers[i].x + chambers[next].x) * 0.5 + this.prng.float(-cs * 2.5, cs * 2.5),
            y: (chambers[i].y + chambers[next].y) * 0.5 + this.prng.float(-cs * 2.5, cs * 2.5)
          },
          width: this.prng.choice([cs * 1.8, cs * 2.4, cs * 3.2]) // Mix of narrow crawlways and wide passages
        });
      }
      // Central cross shortcut
      if (numHubs >= 5) {
        passages.push({
          p1: { x: chambers[0].x, y: chambers[0].y },
          p2: { x: chambers[Math.floor(numHubs / 2)].x, y: chambers[Math.floor(numHubs / 2)].y },
          control: { x: cx + this.prng.float(-cs * 2, cs * 2), y: cy + this.prng.float(-cs * 2, cs * 2) },
          width: cs * 2.2
        });
      }

    } else if (archetype === 'spider_nest') {
      // Archetype 4: Giant Spider Nest & Cocoon Hollow
      chambers.push({
        id: 0,
        name: 'Центральное Логово Паучьей Королевы',
        type: 'spider_queen_nest',
        x: cx,
        y: cy,
        rx: this.prng.float(cs * 6.5, cs * 9.0),
        ry: this.prng.float(cs * 5.5, cs * 7.5),
        angle: 0
      });

      const numBurrows = 4;
      for (let i = 0; i < numBurrows; i++) {
        const a = (i / numBurrows) * Math.PI * 2 + Math.PI * 0.25;
        const bx = cx + Math.cos(a) * (W * 0.32);
        const by = cy + Math.sin(a) * (H * 0.32);
        chambers.push({
          id: i + 1,
          name: `Коконный Лаз #${i + 1}`,
          type: 'cocoon_burrow',
          x: clamp(bx, margin + cs * 2.5, W - margin - cs * 2.5),
          y: clamp(by, margin + cs * 2.5, H - margin - cs * 2.5),
          rx: this.prng.float(cs * 2.8, cs * 4.0),
          ry: this.prng.float(cs * 2.5, cs * 3.6),
          angle: a
        });

        passages.push({
          p1: { x: cx, y: cy },
          p2: { x: chambers[i + 1].x, y: chambers[i + 1].y },
          control: {
            x: (cx + chambers[i + 1].x) * 0.5 + this.prng.float(-cs * 1.5, cs * 1.5),
            y: (cy + chambers[i + 1].y) * 0.5 + this.prng.float(-cs * 1.5, cs * 1.5)
          },
          width: cs * 2.5
        });
      }

      // Spiderwebs in central chamber
      for (let w = 0; w < 6; w++) {
        const wa = this.prng.float(0, Math.PI * 2);
        const wr = this.prng.float(cs * 1.5, chambers[0].rx * 0.7);
        webs.push({
          x: cx + Math.cos(wa) * wr,
          y: cy + Math.sin(wa) * wr,
          radius: this.prng.float(cs * 1.2, cs * 2.2)
        });
      }

    } else {
      // Archetype 5: Crystal Geode & Magma Fissures
      chambers.push({
        id: 0,
        name: 'Великая Кристальная Геода',
        type: 'geode',
        x: cx,
        y: cy,
        rx: this.prng.float(cs * 6.5, cs * 8.5),
        ry: this.prng.float(cs * 5.5, cs * 7.5),
        angle: 0.15
      });
      chambers.push({
        id: 1,
        name: 'Расселина Эфирных Кристаллов',
        type: 'crystals',
        x: cx - W * 0.28,
        y: cy - H * 0.22,
        rx: this.prng.float(cs * 3.5, cs * 5.0),
        ry: this.prng.float(cs * 3.0, cs * 4.5),
        angle: -0.3
      });
      chambers.push({
        id: 2,
        name: 'Зал Базальтовых Колонн',
        type: 'basalt',
        x: cx + W * 0.28,
        y: cy + H * 0.22,
        rx: this.prng.float(cs * 4.0, cs * 5.5),
        ry: this.prng.float(cs * 3.5, cs * 4.8),
        angle: 0.3
      });

      passages.push({ p1: { x: chambers[1].x, y: chambers[1].y }, p2: { x: chambers[0].x, y: chambers[0].y }, control: { x: cx - cs * 3, y: cy - cs * 2 }, width: cs * 3.5 });
      passages.push({ p1: { x: chambers[2].x, y: chambers[2].y }, p2: { x: chambers[0].x, y: chambers[0].y }, control: { x: cx + cs * 3, y: cy + cs * 2 }, width: cs * 3.5 });
    }

    // Populate Stalagmites across chambers
    chambers.forEach(ch => {
      const count = ch.type === 'stalagmites' ? this.prng.int(10, 16) : this.prng.int(3, 7);
      for (let k = 0; k < count; k++) {
        const dist = this.prng.float(0.2, 0.75) * Math.min(ch.rx, ch.ry);
        const ang = this.prng.float(0, Math.PI * 2);
        stalagmites.push({
          x: ch.x + Math.cos(ang) * dist,
          y: ch.y + Math.sin(ang) * dist,
          radius: this.prng.float(cs * 0.35, cs * 0.65),
          height: this.prng.float(1.0, 2.5)
        });
      }
    });

    // Populate Bioluminescent Crystals
    chambers.forEach(ch => {
      const numCrys = (archetype === 'crystal_geode' || ch.type === 'geode') ? this.prng.int(8, 14) : this.prng.int(3, 6);
      for (let i = 0; i < numCrys; i++) {
        const ang = this.prng.float(0, Math.PI * 2);
        const dist = this.prng.float(0.65, 0.95) * Math.min(ch.rx, ch.ry);
        crystals.push({
          x: ch.x + Math.cos(ang) * dist,
          y: ch.y + Math.sin(ang) * dist,
          color: this.prng.choice(['#06b6d4', '#a855f7', '#10b981', '#38bdf8', '#ec4899']),
          radius: this.prng.float(cs * 0.3, cs * 0.6)
        });
      }
    });

    // Wall-mounted torches with dynamic light
    chambers.forEach(ch => {
      const torchAngles = [0.4, 2.0, 3.6, 5.2];
      torchAngles.forEach(ang => {
        torches.push({
          x: ch.x + Math.cos(ang) * (ch.rx * 0.88),
          y: ch.y + Math.sin(ang) * (ch.ry * 0.88),
          lightRadius: cs * 4.5
        });
      });
    });

    // Glowing Cave Mushrooms
    for (let m = 0; m < 12; m++) {
      const ch = this.prng.choice(chambers);
      const ma = this.prng.float(0, Math.PI * 2);
      const md = this.prng.float(0.3, 0.8) * Math.min(ch.rx, ch.ry);
      mushrooms.push({
        x: ch.x + Math.cos(ma) * md,
        y: ch.y + Math.sin(ma) * md,
        color: this.prng.choice(['#10b981', '#06b6d4', '#8b5cf6'])
      });
    }

    // Apply Cave Tactical Toggles
    if (this.toggles.cavePool === false) pool = null;
    if (this.toggles.caveChasm === false) chasm = null;
    if (this.toggles.caveElevatedLedge === false) elevatedLedge = null;
    if (this.toggles.caveWebs === false) webs = [];
    if (this.toggles.caveStalagmites === false) stalagmites.length = 0;
    if (this.toggles.caveCrystals === false) crystals.length = 0;
    if (this.toggles.caveMushrooms === false) mushrooms.length = 0;
    if (this.toggles.caveTorches === false) torches.length = 0;

    map.caveNetwork = {
      archetype,
      chambers,
      passages,
      chasm,
      stalagmites,
      pool,
      crystals,
      torches,
      elevatedLedge,
      webs,
      mushrooms
    };
  }

  generateDungeonComplex(map, W, H) {
    const cs = map.grid.cellSize;
    const cols = map.grid.cols;
    const rows = map.grid.rows;

    // Procedural Theme selector
    const themes = [
      { id: 'ancient_catacombs', name: 'Подземный Некрополь и Катакомбы' },
      { id: 'forgotten_bastion', name: 'Забытая Цитадель Темного Ордена' },
      { id: 'dark_sanctuary', name: 'Древнее Оккультное Святилище' },
      { id: 'dungeon_keep', name: 'Подземные Казематы и Пыточные' },
      { id: 'alchemist_laboratory', name: 'Заброшенная Алхимическая Лаборатория' },
      { id: 'sewer_aqueduct', name: 'Затопленный Подземный Коллектор' }
    ];
    const theme = this.prng.choice(themes);

    const rooms = [];
    const corridors = [];
    const doors = [];
    const pillars = [];
    const braziers = [];
    const sarcophagi = [];
    const prisonCells = [];
    const furniture = [];
    const stairs = [];
    let canal = null;

    // 1. Divide map into sector bins for organic, distributed procedural room placement
    const gridCols = cols >= 35 ? 4 : 3;
    const gridRows = rows >= 35 ? 3 : 2;
    const sectorW = Math.floor((cols - 4) / gridCols);
    const sectorH = Math.floor((rows - 4) / gridRows);

    const targetRoomCount = Math.min(gridCols * gridRows, this.prng.nextInt(7, 12));

    const sectors = [];
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        sectors.push({ c, r, x1: 2 + c * sectorW, y1: 2 + r * sectorH, w: sectorW, h: sectorH });
      }
    }
    this.prng.shuffle(sectors);

    const placedRooms = [];

    // Collision check helper with 2-tile gap margin
    const overlaps = (rx, ry, rw, rh) => {
      for (const pr of placedRooms) {
        if (
          rx < pr.tx + pr.tw + 2 &&
          rx + rw + 2 > pr.tx &&
          ry < pr.ty + pr.th + 2 &&
          ry + rh + 2 > pr.ty
        ) {
          return true;
        }
      }
      return false;
    };

    let roomIndex = 0;
    for (const sec of sectors) {
      if (placedRooms.length >= targetRoomCount) break;

      const isBossSector = (sec.c === gridCols - 1 && sec.r === Math.floor(gridRows / 2));
      const isEntranceSector = (sec.c === 0 && sec.r === 0);

      let tw = this.prng.nextInt(5, Math.min(9, sec.w - 1));
      let th = this.prng.nextInt(5, Math.min(8, sec.h - 1));

      if (isBossSector) {
        tw = Math.min(sec.w - 1, this.prng.nextInt(8, 12));
        th = Math.min(sec.h - 1, this.prng.nextInt(7, 10));
      }

      for (let attempt = 0; attempt < 15; attempt++) {
        const tx = sec.x1 + this.prng.nextInt(0, Math.max(0, sec.w - tw));
        const ty = sec.y1 + this.prng.nextInt(0, Math.max(0, sec.h - th));

        if (!overlaps(tx, ty, tw, th)) {
          placedRooms.push({ id: roomIndex++, tx, ty, tw, th, isBoss: isBossSector, isEntrance: isEntranceSector });
          break;
        }
      }
    }

    // Fallback placement if sectors yielded few rooms
    if (placedRooms.length < 5) {
      for (let attempt = 0; attempt < 40; attempt++) {
        if (placedRooms.length >= targetRoomCount) break;
        const tw = this.prng.nextInt(5, 8);
        const th = this.prng.nextInt(4, 7);
        const tx = this.prng.nextInt(2, cols - tw - 2);
        const ty = this.prng.nextInt(2, rows - th - 2);
        if (!overlaps(tx, ty, tw, th)) {
          placedRooms.push({ id: roomIndex++, tx, ty, tw, th, isBoss: false, isEntrance: false });
        }
      }
    }

    // 2. Assign themes, names and internal props to rooms
    const roomNamePools = {
      entrance: ['Входной Сводчатый Вестибюль', 'Притвор и Парадные Ворота', 'Каменный Зал Стражи'],
      boss: ['Тронный Зал Цитадели', 'Великое Святилище', 'Зал Забытого Владыки', 'Центральный Неф Некрополя'],
      armory: ['Арсенал и Оружейный Склад', 'Зал Боевых Трофеев', 'Кузница Забытых Мастеров'],
      library: ['Запретная Библиотека Гримуаров', 'Архив Темных Свитков', 'Кабинет Чернокнижника'],
      crypt: ['Склеп Древней Династии', 'Усыпальница Высших Рыцарей', 'Зал Каменных Саркофагов'],
      torture: ['Пыточная и Казематы', 'Камера Допросов Инквизиции', 'Зал Железных Дев'],
      prison: ['Тюремный Блок №1', 'Одиночные Железные Камеры', 'Сырая Темница'],
      treasury: ['Тайная Сокровищница', 'Кладовая Драгоценностей', 'Секретная Запертая Зала'],
      ritual: ['Зал Ритуального Круга', 'Капище Кровавой Луны', 'Алтарный Оккультный Покой'],
      barracks: ['Казарма Темных Стражников', 'Караульная и Отдыхальня', 'Обитель Гарнизона']
    };

    placedRooms.forEach((pr, idx) => {
      const rx = pr.tx * cs;
      const ry = pr.ty * cs;
      const rw = pr.tw * cs;
      const rh = pr.th * cs;

      let rType = 'generic';
      let rName = `Покой #${idx + 1}`;

      if (pr.isEntrance || idx === 0) {
        rType = 'entrance';
        rName = this.prng.choice(roomNamePools.entrance);
        // Place Staircase UP (Entrance to Surface)
        stairs.push({
          type: 'stair_up',
          x: rx + rw * 0.5 - cs * 1.0,
          y: ry + rh * 0.5 - cs * 1.5,
          w: cs * 2.0,
          h: cs * 3.0,
          label: '▲ На поверхность'
        });
        braziers.push({ x: rx + cs * 1.2, y: ry + cs * 1.2 });
        braziers.push({ x: rx + rw - cs * 1.2, y: ry + cs * 1.2 });
      } else if (pr.isBoss || idx === placedRooms.length - 1) {
        rType = 'boss';
        rName = this.prng.choice(roomNamePools.boss);
        // Place Staircase DOWN (To Deeper Levels)
        stairs.push({
          type: 'stair_down',
          x: rx + rw - cs * 3.0,
          y: ry + rh * 0.5 - cs * 1.5,
          w: cs * 2.2,
          h: cs * 3.0,
          label: '▼ В глубокий ярус'
        });
        // Throne or Altar Dais
        if (this.prng.bool(0.5)) {
          furniture.push({ type: 'throne', x: rx + cs * 2, y: ry + rh * 0.5 - cs * 1.0, w: cs * 2.0, h: cs * 2.0 });
        }
        braziers.push({ x: rx + cs * 1.5, y: ry + cs * 1.5 });
        braziers.push({ x: rx + cs * 1.5, y: ry + rh - cs * 1.5 });
        braziers.push({ x: rx + rw - cs * 1.5, y: ry + cs * 1.5 });
        braziers.push({ x: rx + rw - cs * 1.5, y: ry + rh - cs * 1.5 });
      } else {
        const possibleTypes = ['crypt', 'armory', 'library', 'torture', 'prison', 'treasury', 'ritual', 'barracks'];
        rType = this.prng.choice(possibleTypes);
        rName = this.prng.choice(roomNamePools[rType] || ['Подземная Зала']);

        if (rType === 'crypt') {
          sarcophagi.push({ x: rx + rw * 0.5 - cs * 1.0, y: ry + rh * 0.5 - cs * 0.6, w: cs * 2.0, h: cs * 1.0 });
          if (rw >= cs * 6) {
            sarcophagi.push({ x: rx + cs * 1.0, y: ry + cs * 1.0, w: cs * 1.8, h: cs * 0.9 });
            sarcophagi.push({ x: rx + cs * 1.0, y: ry + rh - cs * 1.9, w: cs * 1.8, h: cs * 0.9 });
          }
        } else if (rType === 'armory') {
          furniture.push({ type: 'table', x: rx + cs * 1.5, y: ry + cs * 1.5, w: cs * 2.5, h: cs * 1.4 });
          furniture.push({ type: 'chest', x: rx + rw - cs * 2.2, y: ry + cs * 1.5, w: cs * 1.2, h: cs * 0.8 });
        } else if (rType === 'library') {
          furniture.push({ type: 'bookshelf', x: rx + cs * 1.0, y: ry + cs * 0.8, w: rw - cs * 2.0, h: cs * 0.8 });
          furniture.push({ type: 'table', x: rx + rw * 0.5 - cs * 1.0, y: ry + rh * 0.5, w: cs * 2.0, h: cs * 1.2 });
        } else if (rType === 'torture') {
          furniture.push({ type: 'rack', x: rx + rw * 0.5 - cs * 1.5, y: ry + rh * 0.5 - cs * 0.8, w: cs * 3.0, h: cs * 1.6 });
          braziers.push({ x: rx + cs * 1.2, y: ry + cs * 1.2 });
        } else if (rType === 'prison') {
          prisonCells.push({ x: rx + cs * 1.0, y: ry + cs * 1.0, w: cs * 3.0, h: cs * 2.5, side: 'north' });
          if (rh >= cs * 6) {
            prisonCells.push({ x: rx + cs * 1.0, y: ry + rh - cs * 3.5, w: cs * 3.0, h: cs * 2.5, side: 'south' });
          }
        } else if (rType === 'treasury') {
          furniture.push({ type: 'chest', x: rx + cs * 1.5, y: ry + cs * 1.5, w: cs * 1.2, h: cs * 0.8 });
          furniture.push({ type: 'chest', x: rx + rw - cs * 2.7, y: ry + cs * 1.5, w: cs * 1.2, h: cs * 0.8 });
          furniture.push({ type: 'chest', x: rx + rw * 0.5 - cs * 0.6, y: ry + rh - cs * 2.0, w: cs * 1.2, h: cs * 0.8 });
        } else if (rType === 'ritual') {
          furniture.push({ type: 'ritual_circle', x: rx + rw * 0.5, y: ry + rh * 0.5, radius: Math.min(rw, rh) * 0.3 });
          braziers.push({ x: rx + cs * 1.2, y: ry + cs * 1.2 });
          braziers.push({ x: rx + rw - cs * 1.2, y: ry + rh - cs * 1.2 });
        } else if (rType === 'barracks') {
          furniture.push({ type: 'table', x: rx + cs * 1.5, y: ry + rh * 0.5 - cs * 0.7, w: cs * 2.5, h: cs * 1.4 });
        }
      }

      // Large rooms get Carved Stone Pillars
      if (pr.tw >= 7 && pr.th >= 6) {
        pillars.push({ x: rx + cs * 2.0, y: ry + cs * 2.0, size: cs * 0.48 });
        pillars.push({ x: rx + rw - cs * 2.0, y: ry + cs * 2.0, size: cs * 0.48 });
        pillars.push({ x: rx + cs * 2.0, y: ry + rh - cs * 2.0, size: cs * 0.48 });
        pillars.push({ x: rx + rw - cs * 2.0, y: ry + rh - cs * 2.0, size: cs * 0.48 });
      }

      rooms.push({
        id: idx,
        name: rName,
        type: rType,
        x: rx,
        y: ry,
        w: rw,
        h: rh,
        cx: rx + rw * 0.5,
        cy: ry + rh * 0.5,
        tx: pr.tx,
        ty: pr.ty,
        tw: pr.tw,
        th: pr.th
      });
    });

    // 3. Connect rooms using Minimum Spanning Tree (MST) + Loop Edges
    const edges = [];
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const dx = rooms[i].cx - rooms[j].cx;
        const dy = rooms[i].cy - rooms[j].cy;
        const dist = Math.hypot(dx, dy);
        edges.push({ u: i, v: j, dist });
      }
    }
    edges.sort((a, b) => a.dist - b.dist);

    const parent = rooms.map((_, idx) => idx);
    const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const union = (i, j) => {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) { parent[rootI] = rootJ; return true; }
      return false;
    };

    const connectedEdges = [];
    const unusedEdges = [];

    edges.forEach(e => {
      if (union(e.u, e.v)) {
        connectedEdges.push(e);
      } else {
        unusedEdges.push(e);
      }
    });

    // Add 25% extra loop edges to create tactical circular corridors
    unusedEdges.forEach(e => {
      if (this.prng.bool(0.25)) {
        connectedEdges.push(e);
      }
    });

    // Generate L-shaped corridors for each connected pair
    connectedEdges.forEach(e => {
      const rA = rooms[e.u];
      const rB = rooms[e.v];

      const corridorWidth = cs * this.prng.choice([1.8, 2.0, 2.2]);

      if (this.prng.bool(0.5)) {
        corridors.push({ x1: rA.cx, y1: rA.cy, x2: rB.cx, y2: rA.cy, width: corridorWidth });
        corridors.push({ x1: rB.cx, y1: rA.cy, x2: rB.cx, y2: rB.cy, width: corridorWidth });
      } else {
        corridors.push({ x1: rA.cx, y1: rA.cy, x2: rA.cx, y2: rB.cy, width: corridorWidth });
        corridors.push({ x1: rA.cx, y1: rB.cy, x2: rB.cx, y2: rB.cy, width: corridorWidth });
      }

      // Place Doors at room entrances
      [rA, rB].forEach((r, rIdx) => {
        const otherR = rIdx === 0 ? rB : rA;
        const doorType = r.type === 'treasury'
          ? 'secret_stone'
          : this.prng.choice(['heavy_oak', 'heavy_oak', 'iron_reinforced', 'iron_portcullis']);

        let dx = r.cx;
        let dy = r.cy;
        if (otherR.cx > r.x + r.w) dx = r.x + r.w;
        else if (otherR.cx < r.x) dx = r.x;

        if (otherR.cy > r.y + r.h) dy = r.y + r.h;
        else if (otherR.cy < r.y) dy = r.y;

        doors.push({
          x: dx,
          y: dy,
          width: cs * 1.6,
          isOpen: doorType === 'secret_stone' ? false : this.prng.bool(0.4),
          type: doorType
        });
      });
    });

    // Subterranean Canal / Sewer option
    if (theme.id === 'sewer_aqueduct' || this.prng.bool(0.3)) {
      const canalY = Math.floor(rows * 0.5) * cs;
      const canalW = cs * 3;
      canal = {
        y: canalY - canalW * 0.5,
        height: canalW,
        waterColor: theme.id === 'sewer_aqueduct' ? '#0e7490' : '#1e3a8a',
        bridges: [
          { x: Math.floor(cols * 0.25) * cs, y: canalY - canalW * 0.5, w: cs * 2.5, h: canalW },
          { x: Math.floor(cols * 0.70) * cs, y: canalY - canalW * 0.5, w: cs * 2.5, h: canalW }
        ]
      };
    }

    // Apply Dungeon Tactical Toggles
    if (this.toggles.dungeonPillars === false) pillars.length = 0;
    if (this.toggles.dungeonBraziers === false) braziers.length = 0;
    if (this.toggles.dungeonAltar === false) rooms.forEach(r => { delete r.altarDais; });
    if (this.toggles.dungeonSarcophagi === false) sarcophagi.length = 0;
    if (this.toggles.dungeonPrison === false) prisonCells.length = 0;
    if (this.toggles.dungeonCanal === false) canal = null;
    if (this.toggles.dungeonFurniture === false) furniture.length = 0;
    if (this.toggles.dungeonDoors === false) doors.length = 0;

    map.dungeonComplex = {
      archetype: theme.id,
      themeName: theme.name,
      rooms,
      corridors,
      doors,
      pillars,
      braziers,
      sarcophagi,
      prisonCells,
      furniture,
      stairs,
      canal
    };
  }

  generateArchipelago(map, W, H) {
    const cs = map.grid.cellSize;
    const cx = W * 0.5;
    const cy = H * 0.5;

    const archetypes = ['coral_atoll', 'twin_pirate_isles', 'kraken_reefs', 'volcanic_isle'];
    const archetype = this.prng.choice(archetypes);

    const islands = [];
    const sandbars = [];
    let ropeBridge = null;
    let shipwreck = null;
    const tentacles = [];
    const reefs = [];

    if (archetype === 'coral_atoll') {
      // Archetype 1: Coral Atoll & Lagoons with high size variance (Large flagship + Medium + Small cays)
      // 1. Large Flagship Island (Main)
      const is0X = cx - W * 0.18, is0Y = cy - H * 0.10;
      const is0Rx = this.prng.float(cs * 10.5, cs * 13.5);
      const is0Ry = this.prng.float(cs * 8.0, cs * 10.5);
      const pts0 = [];
      for (let p = 0; p < 16; p++) {
        const pa = (p / 16) * Math.PI * 2;
        pts0.push({ x: is0X + Math.cos(pa) * is0Rx * this.prng.float(0.85, 1.2), y: is0Y + Math.sin(pa) * is0Ry * this.prng.float(0.85, 1.2) });
      }
      const palms0 = [];
      for (let k = 0; k < 8; k++) {
        palms0.push({ x: is0X + this.prng.float(-is0Rx * 0.55, is0Rx * 0.55), y: is0Y + this.prng.float(-is0Ry * 0.55, is0Ry * 0.55), size: cs * 1.6 });
      }
      islands.push({ id: 0, name: 'Главный Коралловый Остров', cx: is0X, cy: is0Y, rx: is0Rx, ry: is0Ry, points: pts0, palms: palms0, isMain: true, hasCampfire: true });

      // 2. Medium Satellite Island
      const is1X = cx + W * 0.25, is1Y = cy + H * 0.15;
      const is1Rx = this.prng.float(cs * 5.5, cs * 7.5);
      const is1Ry = this.prng.float(cs * 4.5, cs * 6.0);
      const pts1 = [];
      for (let p = 0; p < 12; p++) {
        const pa = (p / 12) * Math.PI * 2;
        pts1.push({ x: is1X + Math.cos(pa) * is1Rx * this.prng.float(0.85, 1.2), y: is1Y + Math.sin(pa) * is1Ry * this.prng.float(0.85, 1.2) });
      }
      const palms1 = [];
      for (let k = 0; k < 4; k++) {
        palms1.push({ x: is1X + this.prng.float(-is1Rx * 0.45, is1Rx * 0.45), y: is1Y + this.prng.float(-is1Ry * 0.45, is1Ry * 0.45), size: cs * 1.4 });
      }
      islands.push({ id: 1, name: 'Восточный Пальмовый Островок', cx: is1X, cy: is1Y, rx: is1Rx, ry: is1Ry, points: pts1, palms: palms1, isMain: false });

      // 3. Small Sandbar Cay
      const is2X = cx + W * 0.18, is2Y = cy - H * 0.28;
      const is2Rx = this.prng.float(cs * 3.0, cs * 4.2);
      const is2Ry = this.prng.float(cs * 2.2, cs * 3.2);
      const pts2 = [];
      for (let p = 0; p < 10; p++) {
        const pa = (p / 10) * Math.PI * 2;
        pts2.push({ x: is2X + Math.cos(pa) * is2Rx * this.prng.float(0.88, 1.15), y: is2Y + Math.sin(pa) * is2Ry * this.prng.float(0.88, 1.15) });
      }
      const palms2 = [{ x: is2X, y: is2Y, size: cs * 1.3 }];
      islands.push({ id: 2, name: 'Северная Песчаная Коса', cx: is2X, cy: is2Y, rx: is2Rx, ry: is2Ry, points: pts2, palms: palms2, isMain: false });

      // 4. Micro Reef Islet
      const is3X = cx - W * 0.28, is3Y = cy + H * 0.28;
      const is3Rx = this.prng.float(cs * 1.8, cs * 2.6);
      const is3Ry = this.prng.float(cs * 1.4, cs * 2.0);
      const pts3 = [];
      for (let p = 0; p < 8; p++) {
        const pa = (p / 8) * Math.PI * 2;
        pts3.push({ x: is3X + Math.cos(pa) * is3Rx * this.prng.float(0.88, 1.15), y: is3Y + Math.sin(pa) * is3Ry * this.prng.float(0.88, 1.15) });
      }
      islands.push({ id: 3, name: 'Южный Рифовый Камень', cx: is3X, cy: is3Y, rx: is3Rx, ry: is3Ry, points: pts3, palms: [], isMain: false });

      // Walkable sandbars across shallow lagoon
      sandbars.push({
        name: 'Песчаная Отмель (Брод)',
        x1: is0X + is0Rx * 0.6,
        y1: is0Y + is0Ry * 0.6,
        x2: is1X - is1Rx * 0.6,
        y2: is1Y - is1Ry * 0.6,
        width: cs * 2.2
      });

    } else if (archetype === 'twin_pirate_isles') {
      // Archetype 2: Pirate Skull Fortress Island + Small Lookout Cay & Suspension Bridge
      const is1X = cx - W * 0.24, is1Y = cy;
      const is2X = cx + W * 0.26, is2Y = cy;
      const is1Rx = this.prng.float(cs * 10.5, cs * 13.5);
      const is1Ry = this.prng.float(cs * 8.5, cs * 11.0);
      const is2Rx = this.prng.float(cs * 5.0, cs * 6.8);
      const is2Ry = this.prng.float(cs * 4.0, cs * 5.5);

      const pts1 = [], pts2 = [];
      for (let p = 0; p < 16; p++) {
        const pa = (p / 16) * Math.PI * 2;
        pts1.push({ x: is1X + Math.cos(pa) * is1Rx * this.prng.float(0.85, 1.2), y: is1Y + Math.sin(pa) * is1Ry * this.prng.float(0.85, 1.2) });
      }
      for (let p = 0; p < 12; p++) {
        const pa = (p / 12) * Math.PI * 2;
        pts2.push({ x: is2X + Math.cos(pa) * is2Rx * this.prng.float(0.85, 1.2), y: is2Y + Math.sin(pa) * is2Ry * this.prng.float(0.85, 1.2) });
      }

      const palms1 = [], palms2 = [];
      for (let k = 0; k < 8; k++) palms1.push({ x: is1X + this.prng.float(-is1Rx * 0.5, is1Rx * 0.5), y: is1Y + this.prng.float(-is1Ry * 0.5, is1Ry * 0.5), size: cs * 1.5 });
      for (let k = 0; k < 3; k++) palms2.push({ x: is2X + this.prng.float(-is2Rx * 0.4, is2Rx * 0.4), y: is2Y + this.prng.float(-is2Ry * 0.4, is2Ry * 0.4), size: cs * 1.4 });

      islands.push({ id: 0, name: 'Пиратский Остров Черепа (Большой)', cx: is1X, cy: is1Y, rx: is1Rx, ry: is1Ry, points: pts1, palms: palms1, isMain: true, hasCampfire: true });
      islands.push({ id: 1, name: 'Дозорный Островок (Малый)', cx: is2X, cy: is2Y, rx: is2Rx, ry: is2Ry, points: pts2, palms: palms2, isMain: false });

      // Micro outpost reef
      const is3X = cx + W * 0.38, is3Y = cy - H * 0.32;
      const is3Rx = cs * 2.2, is3Ry = cs * 1.8;
      const pts3 = [];
      for (let p = 0; p < 8; p++) {
        const pa = (p / 8) * Math.PI * 2;
        pts3.push({ x: is3X + Math.cos(pa) * is3Rx * this.prng.float(0.88, 1.15), y: is3Y + Math.sin(pa) * is3Ry * this.prng.float(0.88, 1.15) });
      }
      islands.push({ id: 2, name: 'Риф Бухты', cx: is3X, cy: is3Y, rx: is3Rx, ry: is3Ry, points: pts3, palms: [], isMain: false });

      ropeBridge = {
        name: 'Висячий Веревочный Мост',
        x1: is1X + is1Rx * 0.7,
        y1: is1Y,
        x2: is2X - is2Rx * 0.7,
        y2: is2Y,
        width: cs * 1.5
      };

    } else if (archetype === 'kraken_reefs') {
      // Archetype 3: Kraken Reefs & Sea Monster Tentacles with High Size Hierarchy
      const mainRx = cs * 11.0, mainRy = cs * 8.5;
      const pts = [];
      for (let p = 0; p < 16; p++) {
        const pa = (p / 16) * Math.PI * 2;
        pts.push({ x: cx - cs * 3 + Math.cos(pa) * mainRx * this.prng.float(0.85, 1.2), y: cy + Math.sin(pa) * mainRy * this.prng.float(0.85, 1.2) });
      }
      const palms = [];
      for (let k = 0; k < 6; k++) palms.push({ x: cx - cs * 3 + this.prng.float(-cs * 3, cs * 3), y: cy + this.prng.float(-cs * 2.5, cs * 2.5), size: cs * 1.6 });
      islands.push({ id: 0, name: 'Риф Морского Чудовища (Главный)', cx: cx - cs * 3, cy: cy, rx: mainRx, ry: mainRy, points: pts, palms, isMain: true });

      // Smashed galleon shipwreck on the reef
      shipwreck = {
        x: cx + W * 0.28,
        y: cy - H * 0.15,
        angle: 0.5,
        length: cs * 9.0,
        width: cs * 3.6,
        ribs: 7
      };

      // 6 Giant Kraken tentacles rising from the waves
      for (let t = 0; t < 6; t++) {
        const ta = (t / 6) * Math.PI * 2 + 0.3;
        const tr = Math.min(W, H) * 0.35;
        tentacles.push({
          x: cx + Math.cos(ta) * tr,
          y: cy + Math.sin(ta) * tr,
          angle: ta + Math.PI * 0.5,
          length: cs * this.prng.float(3.5, 5.5),
          thickness: cs * this.prng.float(0.7, 1.1)
        });
      }

    } else {
      // Archetype 4: Giant Volcanic Basalt Isle + Tiny Outcrops
      const vRx = cs * 13.0, vRy = cs * 10.0;
      const pts = [];
      for (let p = 0; p < 18; p++) {
        const pa = (p / 18) * Math.PI * 2;
        pts.push({ x: cx + Math.cos(pa) * vRx * this.prng.float(0.82, 1.25), y: cy + Math.sin(pa) * vRy * this.prng.float(0.82, 1.25) });
      }
      const palms = [];
      for (let k = 0; k < 8; k++) palms.push({ x: cx + this.prng.float(-cs * 4, cs * 4), y: cy + this.prng.float(-cs * 3, cs * 3), size: cs * 1.6 });
      islands.push({ id: 0, name: 'Вулканический Базальтовый Остров (Массивный)', cx, cy, rx: vRx, ry: vRy, points: pts, palms, isVolcanic: true, isMain: true });

      // Outer sharp reef rocks
      for (let r = 0; r < 5; r++) {
        const ra = (r / 5) * Math.PI * 2 + 0.2;
        const rd = Math.min(W, H) * 0.42;
        reefs.push({ x: cx + Math.cos(ra) * rd, y: cy + Math.sin(ra) * rd, r: cs * this.prng.float(1.2, 2.0) });
      }
    }

    // Apply Archipelago Tactical Toggles
    if (this.toggles.archSandbars === false) sandbars.length = 0;
    if (this.toggles.archRopeBridge === false) ropeBridge = null;
    if (this.toggles.archShipwreck === false) shipwreck = null;
    if (this.toggles.archTentacles === false) tentacles.length = 0;
    if (this.toggles.archPalms === false) islands.forEach(isl => { isl.palms = []; });
    if (this.toggles.archCampfire === false) islands.forEach(isl => { isl.hasCampfire = false; });
    if (this.toggles.archReefs === false) reefs.length = 0;

    map.archipelagoData = {
      archetype,
      islands,
      sandbars,
      ropeBridge,
      shipwreck,
      tentacles,
      reefs
    };
  }

  generateShips(map, W, H) {
    const cs = map.grid.cellSize;
    const archetypes = ['boarding_broadside', 'kraken_attack', 'ramming_action', 'solo_flagship'];
    const archetype = this.prng.choice(archetypes);

    const ships = [];
    const boardingPlanks = [];
    const grapplingHooks = [];
    const tentacles = [];

    if (archetype === 'boarding_broadside') {
      // Archetype 1: Broadside Boarding Action - TWO PARALLEL SHIPS WITH CLEAR NON-OVERLAPPING Y SPACING
      const ship1Width = cs * 7.4;
      const ship2Width = cs * 6.6;
      const waterGap = cs * 2.8; // Guaranteed 14ft open water gap between ship hulls

      const totalSpan = ship1Width + ship2Width + waterGap;
      const startY = (H - totalSpan) * 0.5;

      const ship1Y = startY + ship1Width * 0.5;
      const ship2Y = ship1Y + (ship1Width + ship2Width) * 0.5 + waterGap;

      const ship1 = {
        name: 'Королевский Военный Галеон',
        role: 'Флагманский Галеон',
        x: W * 0.48,
        y: ship1Y,
        length: Math.min(W * 0.72, cs * 23),
        width: ship1Width,
        angle: 0,
        woodColor: '#78350f',
        deckColor: '#b45309',
        isMain: true
      };

      const ship2 = {
        name: 'Пиратская Абордажная Каравелла',
        role: 'Абордажная Каравелла',
        x: W * 0.52,
        y: ship2Y,
        length: Math.min(W * 0.62, cs * 19),
        width: ship2Width,
        angle: 0,
        woodColor: '#451a03',
        deckColor: '#92400e',
        isMain: false
      };
      ships.push(ship1, ship2);

      // Boarding gangplanks across the open water channel
      boardingPlanks.push({
        name: 'Главные абордажные сходни',
        x1: ship1.x - cs * 2.0,
        y1: ship1.y + ship1.width * 0.45,
        x2: ship2.x - cs * 2.0,
        y2: ship2.y - ship2.width * 0.45,
        width: cs * 1.6
      });
      boardingPlanks.push({
        name: 'Кормовой штурмовой трап',
        x1: ship1.x + cs * 4.0,
        y1: ship1.y + ship1.width * 0.45,
        x2: ship2.x + cs * 4.0,
        y2: ship2.y - ship2.width * 0.45,
        width: cs * 1.5
      });

      grapplingHooks.push({ x1: ship1.x - cs * 6, y1: ship1.y + ship1.width * 0.48, x2: ship2.x - cs * 5, y2: ship2.y - ship2.width * 0.48 });
      grapplingHooks.push({ x1: ship1.x + cs * 7, y1: ship1.y + ship1.width * 0.48, x2: ship2.x + cs * 6, y2: ship2.y - ship2.width * 0.48 });

    } else if (archetype === 'kraken_attack') {
      // Archetype 2: Galleon fighting colossal Kraken
      const ship1 = {
        name: 'Имперский Галеон "Неукротимый"',
        role: 'Осажденный Галеон',
        x: W * 0.5,
        y: H * 0.5,
        length: Math.min(W * 0.68, cs * 26),
        width: cs * 9.2,
        angle: 0,
        woodColor: '#78350f',
        deckColor: '#b45309',
        isMain: true
      };
      ships.push(ship1);

      // Kraken tentacles wrapping around hull
      const L = ship1.length;
      const Wd = ship1.width;
      const tentaclePositions = [
        { relX: -L * 0.3, relY: -Wd * 0.55, a: -Math.PI * 0.35, len: cs * 4.5 },
        { relX: 0, relY: -Wd * 0.6, a: -Math.PI * 0.45, len: cs * 5.2 },
        { relX: L * 0.3, relY: -Wd * 0.55, a: -Math.PI * 0.6, len: cs * 4.8 },
        { relX: -L * 0.25, relY: Wd * 0.55, a: Math.PI * 0.35, len: cs * 4.5 },
        { relX: 0.05, relY: Wd * 0.6, a: Math.PI * 0.45, len: cs * 5.5 },
        { relX: L * 0.28, relY: Wd * 0.55, a: Math.PI * 0.6, len: cs * 4.8 }
      ];

      tentaclePositions.forEach(tp => {
        tentacles.push({
          x: ship1.x + tp.relX,
          y: ship1.y + tp.relY,
          angle: tp.a,
          length: tp.len,
          thickness: cs * 0.95
        });
      });

    } else if (archetype === 'ramming_action') {
      // Archetype 3: Collision & T-Bone Ramming without deck overlap
      const ship1 = {
        name: 'Тяжелый Торговый Галеон',
        role: 'Протараненный Галеон',
        x: W * 0.5,
        y: H * 0.65,
        length: Math.min(W * 0.65, cs * 23),
        width: cs * 8.2,
        angle: 0,
        woodColor: '#78350f',
        deckColor: '#b45309',
        isMain: true
      };
      const ship2Length = Math.min(W * 0.42, cs * 15);
      const ship2Width = cs * 6.0;
      // Position ram spur to just touch ship1's top rail
      const ship2 = {
        name: 'Боевая Галера-Таран "Клык"',
        role: 'Штурмовой Таранщик',
        x: W * 0.48,
        y: (ship1.y - ship1.width * 0.48) - ship2Length * 0.48,
        length: ship2Length,
        width: ship2Width,
        angle: Math.PI * 0.52,
        woodColor: '#451a03',
        deckColor: '#78350f',
        isMain: false
      };
      ships.push(ship1, ship2);

      boardingPlanks.push({
        name: 'Место таранного разлома',
        x1: ship1.x - cs * 0.5,
        y1: ship1.y - ship1.width * 0.45,
        x2: ship1.x - cs * 0.5,
        y2: ship1.y - ship1.width * 0.45 - cs * 1.8,
        width: cs * 2.2
      });

    } else {
      // Archetype 4: Solitary Grand Royal Flagship
      const ship1 = {
        name: 'Королевский Трехмачтовый Флагман',
        role: 'Королевский Флагман',
        x: W * 0.5,
        y: H * 0.5,
        length: Math.min(W * 0.74, cs * 27),
        width: cs * 9.6,
        angle: 0,
        woodColor: '#78350f',
        deckColor: '#b45309',
        isMain: true
      };
      ships.push(ship1);
    }

    // Populate each ship with naval architecture respecting toggles
    ships.forEach(ship => {
      const L = ship.length;
      const Wd = ship.width;

      // Authentic Masts with Yardarms and Rigging Shrouds
      ship.masts = (this.toggles.shipMastsSails !== false) ? [
        { name: 'Фок-мачта (Передняя)', relX: -L * 0.28, relY: 0, radius: cs * 0.42, yardarm: Wd * 0.88, sail: true },
        { name: 'Грот-мачта (Главная)', relX: 0, relY: 0, radius: cs * 0.52, yardarm: Wd * 1.1, sail: true },
        { name: 'Бизань-мачта (Кормовая)', relX: L * 0.26, relY: 0, radius: cs * 0.38, yardarm: Wd * 0.78, sail: true }
      ] : [];

      // Broadside naval cannons
      ship.cannons = [];
      if (this.toggles.shipCannons !== false) {
        const numCannons = Math.max(3, Math.floor(L / (cs * 4.2)));
        for (let k = 0; k < numCannons; k++) {
          const posX = -L * 0.24 + k * (L * 0.16);
          ship.cannons.push({ relX: posX, relY: -Wd * 0.44, side: 'port', caliber: '12-фунтовая' });
          ship.cannons.push({ relX: posX, relY: Wd * 0.44, side: 'starboard', caliber: '12-фунтовая' });
        }
      }

      // Quarterdeck Ship's Wheel / Helm
      ship.helm = (this.toggles.shipHelm !== false) ? { relX: L * 0.36, relY: 0, radius: cs * 0.4 } : null;

      // Cargo Hatches with wooden grating
      ship.hatches = (this.toggles.shipCargoHatches !== false) ? [
        { relX: -L * 0.14, relY: 0, w: cs * 2.4, h: cs * 1.8 },
        { relX: L * 0.13, relY: 0, w: cs * 2.0, h: cs * 1.6 }
      ] : [];

      // Anchor Capstan on forecastle
      ship.capstan = (this.toggles.shipHelm !== false) ? { relX: -L * 0.38, relY: 0, radius: cs * 0.45 } : null;

      // Deck Cargo: Barrels & Ammo Crates
      ship.clutter = (this.toggles.shipClutter !== false) ? [
        { type: 'barrel', relX: -L * 0.08, relY: -Wd * 0.28 },
        { type: 'barrel', relX: -L * 0.06, relY: -Wd * 0.30 },
        { type: 'barrel', relX: L * 0.18, relY: Wd * 0.26 },
        { type: 'crate', relX: L * 0.05, relY: -Wd * 0.28, w: cs * 0.8, h: cs * 0.8 },
        { type: 'crate', relX: -L * 0.28, relY: Wd * 0.26, w: cs * 0.9, h: cs * 0.9 }
      ] : [];
    });

    // Apply Ship Tactical Toggles
    if (this.toggles.shipBoardingPlanks === false) boardingPlanks.length = 0;
    if (this.toggles.shipGrapplingHooks === false) grapplingHooks.length = 0;
    if (this.toggles.shipTentacles === false) tentacles.length = 0;

    map.shipsData = {
      archetype,
      ships,
      boardingPlanks,
      grapplingHooks,
      tentacles
    };
  }

  generateVillage(map, W, H) {
    const CS = map.grid.cellSize;
    const isLargeMap = map.areaFactor >= 1.6;

    const hasPalisade = this.toggles.hasPalisade !== undefined ? this.toggles.hasPalisade : this.prng.bool(0.5);

    const mainRoadPts = [];
    const startX = CS * 2;
    const startY = H * (0.35 + this.prng.float(-0.1, 0.1));
    const endX = W - CS * 2;
    const endY = H * (0.55 + this.prng.float(-0.1, 0.1));
    const numSegs = 10;
    for (let i = 0; i <= numSegs; i++) {
      const t = i / numSegs;
      const x = lerp(startX, endX, t);
      const y = lerp(startY, endY, t) + Math.sin(t * Math.PI * 2) * 35 + this.prng.float(-10, 10);
      mainRoadPts.push({ x, y });
    }

    map.roads = map.roads || [];
    map.roads.push({
      path: mainRoadPts,
      width: CS * 1.8,
      type: 'village_main'
    });

    const houseCount = isLargeMap ? this.prng.int(6, 8) : this.prng.int(4, 6);
    const archetypePool = [
      'village_elder', 'blacksmith', 'bakery_mill', 'herbalist_cottage',
      'taverna_inn', 'barn_stable', 'peasant_house', 'hunter_lodge'
    ];
    this.prng.shuffle(archetypePool);

    const slots = [];
    const roadLen = mainRoadPts.length;
    for (let i = 1; i < roadLen - 1; i += 1.2) {
      const idx = Math.floor(i);
      const p1 = mainRoadPts[idx];
      const p2 = mainRoadPts[Math.min(idx + 1, roadLen - 1)];
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);

      slots.push({ x: p1.x + perpX * (CS * 4.5), y: p1.y + perpY * (CS * 4.5), roadPt: p1, side: 'north' });
      slots.push({ x: p1.x - perpX * (CS * 4.5), y: p1.y - perpY * (CS * 4.5), roadPt: p1, side: 'south' });
    }
    this.prng.shuffle(slots);

    let placedCount = 0;
    for (const slot of slots) {
      if (placedCount >= houseCount) break;

      const bType = archetypePool[placedCount % archetypePool.length];
      let wCells = this.prng.int(4, 6);
      let hCells = this.prng.int(3, 5);
      if (bType === 'taverna_inn' || bType === 'village_elder') {
        wCells = this.prng.int(7, 8);
        hCells = this.prng.int(5, 6);
      }
      const houseW = wCells * CS;
      const houseH = hCells * CS;

      const hx = Math.max(CS * 2, Math.min(W - CS * 2 - houseW, slot.x - houseW * 0.5));
      const hy = Math.max(CS * 2, Math.min(H - CS * 2 - houseH, slot.y - houseH * 0.5));

      let overlap = false;
      for (const b of map.buildings) {
        if (dist(hx + houseW * 0.5, hy + houseH * 0.5, b.x + b.width * 0.5, b.y + b.height * 0.5) < Math.max(houseW, houseH) + Math.max(b.width, b.height) + CS * 0.8) {
          overlap = true;
          break;
        }
      }
      if (overlap) continue;

      const doorSide = slot.side === 'north' ? 'south' : 'north';
      let doorWorldX = hx + houseW * 0.5;
      let doorWorldY = doorSide === 'south' ? hy + houseH : hy;

      const branchPath = [
        { x: doorWorldX, y: doorWorldY },
        { x: (doorWorldX + slot.roadPt.x) * 0.5 + this.prng.float(-4, 4), y: (doorWorldY + slot.roadPt.y) * 0.5 + this.prng.float(-4, 4) },
        { x: slot.roadPt.x, y: slot.roadPt.y }
      ];
      map.roads.push({
        path: branchPath,
        width: CS * 0.8,
        type: 'village_branch'
      });

      const houseData = this.buildVillageHouseArchetype(bType, hx, hy, houseW, houseH, doorSide, CS);

      map.buildings.push({
        x: hx,
        y: hy,
        width: houseW,
        height: houseH,
        cellsW: wCells,
        cellsH: hCells,
        wallThickness: 6,
        type: bType,
        name: houseData.name,
        door: { side: doorSide, offset: 0.5 },
        doorWorld: { x: doorWorldX, y: doorWorldY },
        frontPath: branchPath,
        windows: houseData.windows,
        rooms: houseData.rooms,
        internalWalls: houseData.internalWalls,
        props: houseData.props,
        outdoorFeatures: houseData.outdoorFeatures,
        paddock: houseData.paddock,
        hasPorch: houseData.hasPorch,
        porchStyle: 'wood',
        roofStyle: houseData.roofStyle
      });

      placedCount++;
    }

    const midRoadPt = mainRoadPts[Math.floor(mainRoadPts.length * 0.5)];
    map.villageCenter = {
      x: midRoadPt.x + this.prng.float(-15, 15),
      y: midRoadPt.y - CS * 2,
      hasWell: true,
      wellType: 'stone_roofed',
      hasHaystack: true,
      hasNoticeBoard: true
    };

    if (hasPalisade) {
      const marginX = CS * 1.5;
      const marginY = CS * 1.5;
      map.palisade = {
        x1: marginX,
        y1: marginY,
        x2: W - marginX,
        y2: H - marginY,
        gates: [
          { x: mainRoadPts[0].x, y: mainRoadPts[0].y, orientation: 'west' },
          { x: mainRoadPts[mainRoadPts.length - 1].x, y: mainRoadPts[mainRoadPts.length - 1].y, orientation: 'east' }
        ],
        towers: [
          { x: marginX + CS * 0.5, y: marginY + CS * 0.5 },
          { x: W - marginX - CS * 0.5, y: marginY + CS * 0.5 },
          { x: marginX + CS * 0.5, y: H - marginY - CS * 0.5 },
          { x: W - marginX - CS * 0.5, y: H - marginY - CS * 0.5 }
        ]
      };
    } else {
      map.villageFences = [];
      for (const b of map.buildings) {
        if (this.prng.bool(0.6)) {
          map.villageFences.push({
            x: b.x - CS * 0.5,
            y: b.y - CS * 0.5,
            w: b.width + CS,
            h: b.height + CS,
            type: 'wooden_picket'
          });
        }
      }
    }
  }

  buildVillageHouseArchetype(type, bx, by, bw, bh, doorSide, CS) {
    const rooms = [];
    const internalWalls = [];
    const props = [];
    const outdoorFeatures = [];
    let paddock = null;
    let name = '';
    let hasPorch = false;
    let roofStyle = 'gabled';

    if (type === 'village_elder') {
      name = 'Усадьба старосты';
      hasPorch = true;
      roofStyle = 'hipped';

      const splitX = bw * 0.55;
      const splitY = bh * 0.5;

      rooms.push({ id: 'hall', name: 'Приемный зал старосты', relX: 0, relY: 0, relW: splitX, relH: bh, floorStyle: 'wood_planks' });
      rooms.push({ id: 'archive', name: 'Кабинет и архив', relX: splitX, relY: 0, relW: bw - splitX, relH: splitY, floorStyle: 'wood_planks' });
      rooms.push({ id: 'bedroom', name: 'Покои старосты', relX: splitX, relY: splitY, relW: bw - splitX, relH: bh - splitY, floorStyle: 'wood_planks' });

      internalWalls.push({ x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh, door: { y: by + splitY * 0.5, size: 22 } });
      internalWalls.push({ x1: bx + splitX, y1: by + splitY, x2: bx + bw, y2: by + splitY, door: { x: bx + splitX + (bw - splitX) * 0.5, size: 20 } });

      props.push({ type: 'desk', x: bx + 16, y: by + 16, w: CS * 1.5, h: CS * 0.9 });
      props.push({ type: 'hearth', x: bx + splitX * 0.5, y: by + bh - 10, w: CS * 1.2, h: 12 });
      props.push({ type: 'bookshelf', x: bx + bw - CS * 1.2 - 8, y: by + 8, w: CS * 1.2, h: 12 });
      props.push({ type: 'double_bed', x: bx + bw - CS * 1.2 - 8, y: by + splitY + 12, w: CS * 1.2, h: CS * 1.4 });

      outdoorFeatures.push({ type: 'flowerbed', x: bx - 16, y: by + bh * 0.5 });

    } else if (type === 'blacksmith') {
      name = 'Деревенская кузница';
      roofStyle = 'gabled';

      const splitX = bw * 0.6;
      rooms.push({ id: 'forge', name: 'Кузнечный цех', relX: 0, relY: 0, relW: splitX, relH: bh, floorStyle: 'cobblestone' });
      rooms.push({ id: 'living', name: 'Жилая комната', relX: splitX, relY: 0, relW: bw - splitX, relH: bh, floorStyle: 'wood_planks' });

      internalWalls.push({ x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh, door: { y: by + bh * 0.5, size: 20 } });

      props.push({ type: 'forge_hearth', x: bx + 12, y: by - 4, w: CS * 1.3, h: 14 });
      props.push({ type: 'anvil', x: bx + splitX * 0.5, y: by + bh * 0.4, r: 10 });
      props.push({ type: 'trough', x: bx + splitX - 22, y: by + 12, w: 14, h: 32 });
      props.push({ type: 'weapons_rack', x: bx + 10, y: by + bh - CS * 0.8, w: CS * 1.1, h: 10 });
      props.push({ type: 'bed', x: bx + bw - CS * 0.9 - 8, y: by + 12, w: CS * 0.9, h: CS * 1.3 });

    } else if (type === 'bakery_mill') {
      name = 'Пекарня и мельница';
      roofStyle = 'gabled';

      const splitX = bw * 0.55;
      rooms.push({ id: 'bakery', name: 'Пекарня и печь', relX: 0, relY: 0, relW: splitX, relH: bh, floorStyle: 'stone_flagstones' });
      rooms.push({ id: 'flour_store', name: 'Склад муки', relX: splitX, relY: 0, relW: bw - splitX, relH: bh, floorStyle: 'wood_planks' });

      internalWalls.push({ x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh, door: { y: by + bh * 0.5, size: 22 } });

      props.push({ type: 'hearth', x: bx + 12, y: by - 4, w: CS * 1.5, h: 14 });
      props.push({ type: 'crate', x: bx + splitX + 10, y: by + 10, w: 18, h: 18 });
      props.push({ type: 'crate', x: bx + splitX + 30, y: by + 10, w: 18, h: 18 });
      props.push({ type: 'barrel', x: bx + splitX + 10, y: by + 35, r: 9 });

      outdoorFeatures.push({ type: 'millstone', x: bx - 28, y: by + bh * 0.5 });

    } else if (type === 'herbalist_cottage') {
      name = 'Хижина травника';
      roofStyle = 'thatched';

      const splitY = bh * 0.55;
      rooms.push({ id: 'lab', name: 'Алхимическая и сушильня', relX: 0, relY: 0, relW: bw, relH: splitY, floorStyle: 'wood_planks' });
      rooms.push({ id: 'bed', name: 'Спальня травника', relX: 0, relY: splitY, relW: bw, relH: bh - splitY, floorStyle: 'wood_planks' });

      internalWalls.push({ x1: bx, y1: by + splitY, x2: bx + bw, y2: by + splitY, door: { x: bx + bw * 0.5, size: 20 } });

      props.push({ type: 'desk', x: bx + 12, y: by + 12, w: CS * 1.2, h: CS * 0.8 });
      props.push({ type: 'cauldron', x: bx + bw - CS * 0.8, y: by + 14, r: 10 });
      props.push({ type: 'bed', x: bx + 12, y: by + splitY + 8, w: CS * 0.9, h: CS * 1.3 });

      outdoorFeatures.push({ type: 'herb_garden', x: bx + bw + 12, y: by + 6, w: CS * 1.5, h: bh - 12 });

    } else if (type === 'taverna_inn') {
      name = 'Трактир «Золотой Колос»';
      hasPorch = true;
      roofStyle = 'gabled';

      const splitX = bw * 0.6;
      rooms.push({ id: 'taproom', name: 'Трактирный зал', relX: 0, relY: 0, relW: splitX, relH: bh, floorStyle: 'wood_planks' });
      rooms.push({ id: 'kitchen', name: 'Кухня и спальня', relX: splitX, relY: 0, relW: bw - splitX, relH: bh, floorStyle: 'stone_flagstones' });

      internalWalls.push({ x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh, door: { y: by + bh * 0.5, size: 22 } });

      props.push({ type: 'bar_counter', x: bx + 14, y: by + 14, w: splitX - 28, h: 20 });
      props.push({ type: 'drinking_table', x: bx + 20, y: by + bh * 0.55, w: CS * 1.4, h: CS * 0.8 });
      props.push({ type: 'hearth', x: bx + splitX + 8, y: by - 4, w: (bw - splitX) - 16, h: 12 });

    } else if (type === 'barn_stable') {
      name = 'Амбар и скотный двор';
      roofStyle = 'gabled';

      const stallW = bw * 0.5;
      rooms.push({ id: 'stalls', name: 'Стойла для скота', relX: 0, relY: 0, relW: stallW, relH: bh, floorStyle: 'straw_timber' });
      rooms.push({ id: 'hay', name: 'Сеновал и инвентарь', relX: stallW, relY: 0, relW: bw - stallW, relH: bh, floorStyle: 'wood_planks' });

      internalWalls.push({ x1: bx + stallW, y1: by, x2: bx + stallW, y2: by + bh, door: { y: by + bh * 0.5, size: 24 } });

      props.push({ type: 'horse_stall', x: bx + 8, y: by + 8, w: stallW - 16, h: bh - 16 });
      props.push({ type: 'hay_bale', x: bx + stallW + 10, y: by + 10, w: 22, h: 16 });
      props.push({ type: 'hay_bale', x: bx + stallW + 10, y: by + 30, w: 22, h: 16 });

      paddock = { x: bx + bw, y: by, w: CS * 3.5, h: bh, side: 'east' };

    } else {
      name = type === 'hunter_lodge' ? 'Изба охотника' : 'Деревенская изба';
      roofStyle = 'thatched';

      const splitX = bw * 0.55;
      rooms.push({ id: 'main', name: 'Горница', relX: 0, relY: 0, relW: splitX, relH: bh, floorStyle: 'wood_planks' });
      rooms.push({ id: 'bed', name: 'Спальня', relX: splitX, relY: 0, relW: bw - splitX, relH: bh, floorStyle: 'wood_planks' });

      internalWalls.push({ x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh, door: { y: by + bh * 0.5, size: 20 } });

      props.push({ type: 'hearth', x: bx + 10, y: by - 4, w: CS * 1.2, h: 12 });
      props.push({ type: 'drinking_table', x: bx + 16, y: by + bh * 0.5, w: CS * 1.1, h: CS * 0.7 });
      props.push({ type: 'bed', x: bx + bw - CS * 0.9 - 6, y: by + 10, w: CS * 0.9, h: CS * 1.3 });

      outdoorFeatures.push({ type: 'woodpile', x: bx + bw + 10, y: by + 10, w: CS * 1.0, h: CS * 0.6 });
    }

    const windows = [];
    if (doorSide !== 'north') windows.push({ side: 'north', offset: 0.5 });
    if (doorSide !== 'south') windows.push({ side: 'south', offset: 0.5 });
    windows.push({ side: 'east', offset: 0.5 });

    return { name, rooms, internalWalls, props, outdoorFeatures, paddock, hasPorch, windows, roofStyle };
  }

  generateCity(map, W, H) {
    const CS = map.grid.cellSize;

    // 15 Distinct Medieval City Layout Archetypes
    const patterns = [
      'concentric_citadel',
      'river_port_docks',
      'cathedral_cloister',
      'artisan_guild_maze',
      'triangular_crossroads',
      'fortified_gatehouse',
      'canal_district',
      'noble_boulevards',
      'garrison_barracks',
      'twin_squares',
      'hilltop_terraces',
      'thieves_slums',
      'university_campus',
      'executioner_market',
      'star_fortress_corner'
    ];

    const selectedPattern = (this.toggles && this.toggles.cityPattern) || this.prng.choice(patterns);
    map.cityPattern = selectedPattern;

    map.cityStreets = map.cityStreets || [];
    map.citySidewalks = map.citySidewalks || [];
    map.cityLanterns = map.cityLanterns || [];
    map.cityBenches = map.cityBenches || [];
    map.cityPlazas = map.cityPlazas || [];

    switch (selectedPattern) {
      case 'concentric_citadel':
        this.generateCityPattern_ConcentricCitadel(map, W, H, CS);
        break;
      case 'river_port_docks':
        this.generateCityPattern_RiverPortDocks(map, W, H, CS);
        break;
      case 'cathedral_cloister':
        this.generateCityPattern_CathedralCloister(map, W, H, CS);
        break;
      case 'artisan_guild_maze':
        this.generateCityPattern_ArtisanGuildMaze(map, W, H, CS);
        break;
      case 'triangular_crossroads':
        this.generateCityPattern_TriangularCrossroads(map, W, H, CS);
        break;
      case 'fortified_gatehouse':
        this.generateCityPattern_FortifiedGatehouse(map, W, H, CS);
        break;
      case 'canal_district':
        this.generateCityPattern_CanalDistrict(map, W, H, CS);
        break;
      case 'noble_boulevards':
        this.generateCityPattern_NobleBoulevards(map, W, H, CS);
        break;
      case 'garrison_barracks':
        this.generateCityPattern_GarrisonBarracks(map, W, H, CS);
        break;
      case 'twin_squares':
        this.generateCityPattern_TwinSquares(map, W, H, CS);
        break;
      case 'hilltop_terraces':
        this.generateCityPattern_HilltopTerraces(map, W, H, CS);
        break;
      case 'thieves_slums':
        this.generateCityPattern_ThievesSlums(map, W, H, CS);
        break;
      case 'university_campus':
        this.generateCityPattern_UniversityCampus(map, W, H, CS);
        break;
      case 'executioner_market':
        this.generateCityPattern_ExecutionerMarket(map, W, H, CS);
        break;
      case 'star_fortress_corner':
        this.generateCityPattern_StarFortressCorner(map, W, H, CS);
        break;
      default:
        this.generateCityPattern_ConcentricCitadel(map, W, H, CS);
        break;
    }

    // Generate procedural sidewalks and curb boundaries alongside all streets
    this.generateCitySidewalksAndGutters(map, W, H, CS);
  }

  // Helper helper to place a city building with paths and sidewalks
  placeCityBuilding(map, bType, hx, hy, wCells, hCells, doorSide, CS, isMasonry = true) {
    const houseW = wCells * CS;
    const houseH = hCells * CS;

    const doorWorldX = hx + houseW * 0.5;
    const doorWorldY = doorSide === 'south' ? hy + houseH : doorSide === 'north' ? hy : doorSide === 'east' ? hx + houseW : hx;

    const branchPath = [
      { x: doorWorldX, y: doorWorldY },
      {
        x: doorSide === 'east' ? doorWorldX + CS * 1.0 : doorSide === 'west' ? doorWorldX - CS * 1.0 : doorWorldX,
        y: doorSide === 'south' ? doorWorldY + CS * 1.0 : doorSide === 'north' ? doorWorldY - CS * 1.0 : doorWorldY
      }
    ];

    const houseData = this.buildCityHouseArchetype(bType, hx, hy, houseW, houseH, doorSide, CS);

    map.buildings.push({
      x: hx,
      y: hy,
      width: houseW,
      height: houseH,
      cellsW: wCells,
      cellsH: hCells,
      wallThickness: 8,
      type: bType,
      isStoneMasonry: isMasonry,
      name: houseData.name,
      door: { side: doorSide, offset: 0.5 },
      doorWorld: { x: doorWorldX, y: doorWorldY },
      frontPath: branchPath,
      windows: houseData.windows,
      rooms: houseData.rooms,
      internalWalls: houseData.internalWalls,
      props: houseData.props,
      outdoorFeatures: houseData.outdoorFeatures,
      porchStyle: 'stone_steps',
      roofStyle: 'slate_tile'
    });
  }

  // 1. Concentric Citadel Pattern
  generateCityPattern_ConcentricCitadel(map, W, H, CS) {
    map.cityNamePattern = 'Концентрическая Цитадель и Главная Ратуша';
    const cx = W * 0.5;
    const cy = H * 0.5;

    // Central circular/octagonal plaza
    const sqW = CS * 10;
    const sqH = CS * 8;
    map.townSquare = {
      x: cx - sqW * 0.5,
      y: cy - sqH * 0.5,
      w: sqW,
      h: sqH,
      centerFeature: { type: 'fountain', x: cx, y: cy, radius: CS * 1.6 },
      marketStalls: [
        { x: cx - CS * 3.5, y: cy - CS * 2.5, w: CS * 1.8, h: CS * 1.2, color: '#dc2626', goodsType: 'fruit' },
        { x: cx + CS * 1.8, y: cy - CS * 2.5, w: CS * 1.8, h: CS * 1.2, color: '#2563eb', goodsType: 'potions' },
        { x: cx - CS * 3.5, y: cy + CS * 1.5, w: CS * 1.8, h: CS * 1.2, color: '#d97706', goodsType: 'weapons' },
        { x: cx + CS * 1.8, y: cy + CS * 1.5, w: CS * 1.8, h: CS * 1.2, color: '#16a34a', goodsType: 'bread' }
      ]
    };

    // 4 radial spoke avenues (N, S, E, W)
    map.cityStreets.push({ x1: 0, y1: cy, x2: W, y2: cy, width: CS * 2.4, type: 'main_avenue' });
    map.cityStreets.push({ x1: cx, y1: 0, x2: cx, y2: H, width: CS * 2.4, type: 'main_avenue' });

    // Inner ring streets
    map.cityStreets.push({ x1: cx - sqW * 0.6, y1: cy - sqH * 0.8, x2: cx + sqW * 0.6, y2: cy - sqH * 0.8, width: CS * 1.8, type: 'ring_road' });
    map.cityStreets.push({ x1: cx - sqW * 0.6, y1: cy + sqH * 0.8, x2: cx + sqW * 0.6, y2: cy + sqH * 0.8, width: CS * 1.8, type: 'ring_road' });

    // Place buildings facing plaza & avenues
    this.placeCityBuilding(map, 'town_hall', cx - sqW * 0.4, cy - sqH * 0.5 - CS * 4.5, 7, 4, 'south', CS);
    this.placeCityBuilding(map, 'cathedral_chapel', cx + sqW * 0.4 - CS * 6, cy - sqH * 0.5 - CS * 4.5, 6, 4, 'south', CS);
    this.placeCityBuilding(map, 'guildhall', cx - sqW * 0.5 - CS * 6.5, cy - CS * 2, 6, 4, 'east', CS);
    this.placeCityBuilding(map, 'alchemy_shop', cx + sqW * 0.5 + CS * 1, cy - CS * 2, 5, 4, 'west', CS);
    this.placeCityBuilding(map, 'city_tavern', cx - sqW * 0.4, cy + sqH * 0.5 + CS * 1, 6, 4, 'north', CS);
    this.placeCityBuilding(map, 'merchant_manor', cx + sqW * 0.4 - CS * 6, cy + sqH * 0.5 + CS * 1, 6, 4, 'north', CS);

    map.cityLanterns.push(
      { x: cx - sqW * 0.5, y: cy - sqH * 0.5 }, { x: cx + sqW * 0.5, y: cy - sqH * 0.5 },
      { x: cx - sqW * 0.5, y: cy + sqH * 0.5 }, { x: cx + sqW * 0.5, y: cy + sqH * 0.5 }
    );
  }

  // 2. River Port & Docks Pattern
  generateCityPattern_RiverPortDocks(map, W, H, CS) {
    map.cityNamePattern = 'Речной Порт, Набережная и Водные Причалы';
    const riverX = W * 0.28;

    map.water = {
      hasRiver: true,
      path: [{ x: riverX, y: 0 }, { x: riverX + CS * 1.5, y: H * 0.5 }, { x: riverX - CS * 1.0, y: H }],
      width: CS * 4.5,
      pools: [],
      bridge: { x: riverX + CS * 0.8, y: H * 0.5, width: CS * 2.8, length: CS * 6.0, angle: 0, material: 'stone' }
    };

    // Quay Quay promenade street
    map.cityStreets.push({ x1: riverX + CS * 3, y1: 0, x2: riverX + CS * 3, y2: H, width: CS * 2.8, type: 'quay' });
    // Trade avenues extending inland
    map.cityStreets.push({ x1: riverX + CS * 3, y1: H * 0.3, x2: W, y2: H * 0.3, width: CS * 2.2, type: 'trade_street' });
    map.cityStreets.push({ x1: riverX + CS * 3, y1: H * 0.7, x2: W, y2: H * 0.7, width: CS * 2.2, type: 'trade_street' });

    // Port Market Square right along quay
    const pX = riverX + CS * 3.5;
    const pY = H * 0.5 - CS * 4;
    map.townSquare = {
      x: pX,
      y: pY,
      w: CS * 9,
      h: CS * 8,
      centerFeature: { type: 'statue', x: pX + CS * 4.5, y: pY + CS * 4, radius: CS * 1.2 },
      marketStalls: [
        { x: pX + CS * 1, y: pY + CS * 1.5, w: CS * 1.8, h: CS * 1.2, color: '#0284c7', goodsType: 'fruit' },
        { x: pX + CS * 5, y: pY + CS * 1.5, w: CS * 1.8, h: CS * 1.2, color: '#d97706', goodsType: 'cloth' },
        { x: pX + CS * 1, y: pY + CS * 5.2, w: CS * 1.8, h: CS * 1.2, color: '#16a34a', goodsType: 'bread' }
      ]
    };

    this.placeCityBuilding(map, 'harbourmaster', riverX + CS * 3.5, H * 0.1, 6, 4, 'south', CS);
    this.placeCityBuilding(map, 'warehouse', riverX + CS * 3.5, H * 0.75, 7, 4, 'north', CS);
    this.placeCityBuilding(map, 'city_tavern', pX + CS * 10, H * 0.3 - CS * 4.5, 6, 4, 'south', CS);
    this.placeCityBuilding(map, 'merchant_manor', pX + CS * 10, H * 0.7 + CS * 1, 6, 4, 'north', CS);
    this.placeCityBuilding(map, 'guardhouse', riverX - CS * 5.5, H * 0.5 - CS * 2, 5, 4, 'east', CS);
  }

  // 3. Cathedral Cloister Pattern
  generateCityPattern_CathedralCloister(map, W, H, CS) {
    map.cityNamePattern = 'Соборный квартал, Монастырский сад и Паломническая площадь';

    const sqX = W * 0.15;
    const sqY = H * 0.35;
    const sqW = CS * 11;
    const sqH = CS * 8;

    map.townSquare = {
      x: sqX,
      y: sqY,
      w: sqW,
      h: sqH,
      centerFeature: { type: 'statue', x: sqX + sqW * 0.5, y: sqY + sqH * 0.5, radius: CS * 1.5 },
      marketStalls: [
        { x: sqX + CS * 1.5, y: sqY + CS * 2, w: CS * 1.8, h: CS * 1.2, color: '#9333ea', goodsType: 'potions' },
        { x: sqX + sqW - CS * 3.3, y: sqY + CS * 2, w: CS * 1.8, h: CS * 1.2, color: '#d97706', goodsType: 'cloth' }
      ]
    };

    // Pilgrims avenue
    map.cityStreets.push({ x1: 0, y1: sqY + sqH * 0.5, x2: W, y2: sqY + sqH * 0.5, width: CS * 2.5, type: 'pilgrims_avenue' });
    map.cityStreets.push({ x1: sqX + sqW + CS * 4, y1: 0, x2: sqX + sqW + CS * 4, y2: H, width: CS * 2.0, type: 'side_street' });

    // Monumental Cathedral
    this.placeCityBuilding(map, 'cathedral_chapel', sqX + CS * 1, sqY - CS * 5.5, 9, 5, 'south', CS);
    this.placeCityBuilding(map, 'apothecary', sqX + sqW + CS * 1, sqY, 5, 4, 'west', CS);
    this.placeCityBuilding(map, 'library_university', sqX + sqW + CS * 1, sqY + CS * 4.5, 6, 4, 'west', CS);
    this.placeCityBuilding(map, 'bakery_shop', sqX + CS * 1, sqY + sqH + CS * 1.5, 5, 4, 'north', CS);
    this.placeCityBuilding(map, 'city_tavern', sqX + CS * 6.5, sqY + sqH + CS * 1.5, 6, 4, 'north', CS);
  }

  // 4. Artisan Guild Maze Pattern
  generateCityPattern_ArtisanGuildMaze(map, W, H, CS) {
    map.cityNamePattern = 'Цеховой квартал ремесленников и лабиринт переулков';

    // Dense zig-zagging narrow alleyways
    map.cityStreets.push({ x1: CS * 3, y1: H * 0.2, x2: W - CS * 3, y2: H * 0.2, width: CS * 1.6, type: 'alley' });
    map.cityStreets.push({ x1: CS * 3, y1: H * 0.5, x2: W - CS * 3, y2: H * 0.5, width: CS * 1.6, type: 'alley' });
    map.cityStreets.push({ x1: CS * 3, y1: H * 0.8, x2: W - CS * 3, y2: H * 0.8, width: CS * 1.6, type: 'alley' });

    map.cityStreets.push({ x1: W * 0.3, y1: H * 0.1, x2: W * 0.3, y2: H * 0.9, width: CS * 1.6, type: 'alley' });
    map.cityStreets.push({ x1: W * 0.7, y1: H * 0.1, x2: W * 0.7, y2: H * 0.9, width: CS * 1.6, type: 'alley' });

    // Guild Yard in center
    map.townSquare = {
      x: W * 0.4,
      y: H * 0.38,
      w: CS * 7,
      h: CS * 6,
      centerFeature: { type: 'pillory_board', x: W * 0.5, y: H * 0.5, radius: CS * 1.2 },
      marketStalls: [
        { x: W * 0.42, y: H * 0.4, w: CS * 1.8, h: CS * 1.2, color: '#dc2626', goodsType: 'weapons' },
        { x: W * 0.52, y: H * 0.4, w: CS * 1.8, h: CS * 1.2, color: '#d97706', goodsType: 'cloth' }
      ]
    };

    // Dense wall-to-wall artisan shops
    this.placeCityBuilding(map, 'guildhall', W * 0.08, H * 0.2 - CS * 4.2, 6, 4, 'south', CS);
    this.placeCityBuilding(map, 'alchemy_shop', W * 0.35, H * 0.2 - CS * 4.2, 5, 4, 'south', CS);
    this.placeCityBuilding(map, 'bakery_shop', W * 0.75, H * 0.2 - CS * 4.2, 5, 4, 'south', CS);

    this.placeCityBuilding(map, 'pawn_shop', W * 0.08, H * 0.5 + CS * 0.8, 5, 4, 'north', CS);
    this.placeCityBuilding(map, 'city_tavern', W * 0.75, H * 0.5 + CS * 0.8, 6, 4, 'north', CS);

    this.placeCityBuilding(map, 'guardhouse', W * 0.08, H * 0.8 - CS * 4.2, 5, 4, 'south', CS);
    this.placeCityBuilding(map, 'city_residence', W * 0.75, H * 0.8 - CS * 4.2, 5, 4, 'south', CS);
  }

  // 5. Triangular Market Crossroads Pattern
  generateCityPattern_TriangularCrossroads(map, W, H, CS) {
    map.cityNamePattern = 'Купеческий перекресток и Треугольная рыночная площадь';

    const cx = W * 0.5;
    const cy = H * 0.45;

    // 3 converging trade avenues
    map.cityStreets.push({ x1: 0, y1: H * 0.15, x2: cx, y2: cy, width: CS * 2.4, type: 'trade_avenue' });
    map.cityStreets.push({ x1: W, y1: H * 0.15, x2: cx, y2: cy, width: CS * 2.4, type: 'trade_avenue' });
    map.cityStreets.push({ x1: cx, y1: cy, x2: cx, y2: H, width: CS * 2.4, type: 'trade_avenue' });

    // Triangular market plaza
    const sqW = CS * 10;
    const sqH = CS * 7;
    map.townSquare = {
      x: cx - sqW * 0.5,
      y: cy,
      w: sqW,
      h: sqH,
      centerFeature: { type: 'pillory_board', x: cx, y: cy + sqH * 0.45, radius: CS * 1.4 },
      marketStalls: [
        { x: cx - CS * 3.8, y: cy + CS * 1, w: CS * 1.8, h: CS * 1.2, color: '#dc2626', goodsType: 'fruit' },
        { x: cx + CS * 2.0, y: cy + CS * 1, w: CS * 1.8, h: CS * 1.2, color: '#2563eb', goodsType: 'potions' },
        { x: cx - CS * 3.8, y: cy + CS * 4, w: CS * 1.8, h: CS * 1.2, color: '#16a34a', goodsType: 'bread' },
        { x: cx + CS * 2.0, y: cy + CS * 4, w: CS * 1.8, h: CS * 1.2, color: '#d97706', goodsType: 'cloth' }
      ]
    };

    this.placeCityBuilding(map, 'town_hall', cx - CS * 3, H * 0.05, 6, 4, 'south', CS);
    this.placeCityBuilding(map, 'merchant_manor', cx - sqW * 0.5 - CS * 6.5, cy + CS * 1, 6, 4, 'east', CS);
    this.placeCityBuilding(map, 'city_tavern', cx + sqW * 0.5 + CS * 0.8, cy + CS * 1, 6, 4, 'west', CS);
    this.placeCityBuilding(map, 'bakery_shop', cx - CS * 6.5, cy + sqH + CS * 1.5, 5, 4, 'north', CS);
    this.placeCityBuilding(map, 'guardhouse', cx + CS * 1.5, cy + sqH + CS * 1.5, 5, 4, 'north', CS);
  }

  // 6. Fortified Gatehouse Pattern
  generateCityPattern_FortifiedGatehouse(map, W, H, CS) {
    map.cityNamePattern = 'Крепостные ворота, Барбакан и Досмотровая площадь';

    const wallX = W * 0.25;

    // Stone curtain wall
    map.cityWalls = [{ x1: wallX, y1: 0, x2: wallX, y2: H, thickness: CS * 1.2, gateY: H * 0.5, gateW: CS * 3.5 }];

    // Main entrance highway passing through gate
    map.cityStreets.push({ x1: 0, y1: H * 0.5, x2: W, y2: H * 0.5, width: CS * 2.8, type: 'main_avenue' });
    // Wall guard streets
    map.cityStreets.push({ x1: wallX + CS * 2, y1: 0, x2: wallX + CS * 2, y2: H, width: CS * 1.8, type: 'wall_street' });

    // Inspection Plaza
    const sqX = wallX + CS * 2.5;
    const sqY = H * 0.5 - CS * 4;
    map.townSquare = {
      x: sqX,
      y: sqY,
      w: CS * 9,
      h: CS * 8,
      centerFeature: { type: 'statue', x: sqX + CS * 4.5, y: sqY + CS * 4, radius: CS * 1.4 },
      marketStalls: [
        { x: sqX + CS * 1, y: sqY + CS * 1.5, w: CS * 1.8, h: CS * 1.2, color: '#dc2626', goodsType: 'weapons' },
        { x: sqX + CS * 5, y: sqY + CS * 1.5, w: CS * 1.8, h: CS * 1.2, color: '#d97706', goodsType: 'bread' }
      ]
    };

    this.placeCityBuilding(map, 'guardhouse', wallX + CS * 2.5, H * 0.1, 6, 4, 'south', CS);
    this.placeCityBuilding(map, 'barracks', wallX + CS * 2.5, H * 0.75, 7, 4, 'north', CS);
    this.placeCityBuilding(map, 'city_tavern', sqX + CS * 10, H * 0.5 - CS * 2, 6, 4, 'west', CS);
  }

  // 7. Canal District Pattern
  generateCityPattern_CanalDistrict(map, W, H, CS) {
    map.cityNamePattern = 'Квартал городских каналов и мостов';

    const canalX = W * 0.5;

    map.water = {
      hasRiver: true,
      path: [{ x: canalX, y: 0 }, { x: canalX, y: H }],
      width: CS * 3.0,
      pools: [],
      bridge: { x: canalX, y: H * 0.5, width: CS * 2.4, length: CS * 4.5, angle: 0, material: 'stone' }
    };

    map.cityStreets.push({ x1: canalX - CS * 2.2, y1: 0, x2: canalX - CS * 2.2, y2: H, width: CS * 1.8, type: 'canal_promenade' });
    map.cityStreets.push({ x1: canalX + CS * 2.2, y1: 0, x2: canalX + CS * 2.2, y2: H, width: CS * 1.8, type: 'canal_promenade' });
    map.cityStreets.push({ x1: 0, y1: H * 0.5, x2: W, y2: H * 0.5, width: CS * 2.2, type: 'cross_street' });

    map.townSquare = {
      x: canalX + CS * 3.5,
      y: H * 0.5 - CS * 3.5,
      w: CS * 8,
      h: CS * 7,
      centerFeature: { type: 'fountain', x: canalX + CS * 7.5, y: H * 0.5, radius: CS * 1.3 },
      marketStalls: [
        { x: canalX + CS * 4.5, y: H * 0.5 - CS * 2, w: CS * 1.8, h: CS * 1.2, color: '#0284c7', goodsType: 'potions' }
      ]
    };

    this.placeCityBuilding(map, 'alchemy_shop', canalX - CS * 8.5, H * 0.2, 5, 4, 'east', CS);
    this.placeCityBuilding(map, 'pawn_shop', canalX - CS * 8.5, H * 0.65, 5, 4, 'east', CS);
    this.placeCityBuilding(map, 'merchant_manor', canalX + CS * 3.5, H * 0.08, 6, 4, 'south', CS);
    this.placeCityBuilding(map, 'city_tavern', canalX + CS * 3.5, H * 0.72, 6, 4, 'north', CS);
  }

  // 8. Noble Boulevards Pattern
  generateCityPattern_NobleBoulevards(map, W, H, CS) {
    map.cityNamePattern = 'Аристократический квартал, Сады и Дворянские особняки';

    const cy = H * 0.5;

    map.cityStreets.push({ x1: 0, y1: cy - CS * 3, x2: W, y2: cy - CS * 3, width: CS * 2.8, type: 'boulevard' });
    map.cityStreets.push({ x1: 0, y1: cy + CS * 3, x2: W, y2: cy + CS * 3, width: CS * 2.8, type: 'boulevard' });
    map.cityStreets.push({ x1: W * 0.5, y1: 0, x2: W * 0.5, y2: H, width: CS * 2.4, type: 'cross_street' });

    const sqX = W * 0.5 - CS * 4.5;
    const sqY = cy - CS * 2.5;
    map.townSquare = {
      x: sqX,
      y: sqY,
      w: CS * 9,
      h: CS * 5,
      centerFeature: { type: 'fountain', x: W * 0.5, y: cy, radius: CS * 1.5 },
      marketStalls: []
    };

    this.placeCityBuilding(map, 'merchant_manor', W * 0.08, cy - CS * 7.5, 7, 4, 'south', CS);
    this.placeCityBuilding(map, 'merchant_manor', W * 0.62, cy - CS * 7.5, 7, 4, 'south', CS);
    this.placeCityBuilding(map, 'town_hall', W * 0.08, cy + CS * 4.5, 7, 4, 'north', CS);
    this.placeCityBuilding(map, 'guildhall', W * 0.62, cy + CS * 4.5, 7, 4, 'north', CS);
  }

  // 9. Garrison Barracks Pattern
  generateCityPattern_GarrisonBarracks(map, W, H, CS) {
    map.cityNamePattern = 'Военный гарнизон и Строевой плац';

    const pX = W * 0.25;
    const pY = H * 0.25;
    const pW = CS * 12;
    const pH = CS * 8;

    map.townSquare = {
      x: pX,
      y: pY,
      w: pW,
      h: pH,
      centerFeature: { type: 'statue', x: pX + pW * 0.5, y: pY + pH * 0.5, radius: CS * 1.4 },
      marketStalls: []
    };

    map.cityStreets.push({ x1: pX - CS * 2, y1: pY - CS * 1.5, x2: pX + pW + CS * 2, y2: pY - CS * 1.5, width: CS * 2.0, type: 'garrison_road' });
    map.cityStreets.push({ x1: pX - CS * 2, y1: pY + pH + CS * 1.5, x2: pX + pW + CS * 2, y2: pY + pH + CS * 1.5, width: CS * 2.0, type: 'garrison_road' });

    this.placeCityBuilding(map, 'barracks', pX, pY - CS * 5.8, 8, 4, 'south', CS);
    this.placeCityBuilding(map, 'guardhouse', pX + CS * 8.5, pY - CS * 5.8, 5, 4, 'south', CS);
    this.placeCityBuilding(map, 'pawn_shop', pX, pY + pH + CS * 2.5, 6, 4, 'north', CS);
    this.placeCityBuilding(map, 'city_tavern', pX + CS * 7, pY + pH + CS * 2.5, 6, 4, 'north', CS);
  }

  // 10. Twin Squares Pattern
  generateCityPattern_TwinSquares(map, W, H, CS) {
    map.cityNamePattern = 'Квартал двух площадей: Ратушная и Ярмарочная';

    map.cityStreets.push({ x1: 0, y1: H * 0.5, x2: W, y2: H * 0.5, width: CS * 2.5, type: 'main_avenue' });

    // Square 1: Upper Civic Square
    const sq1X = W * 0.15;
    const sq1Y = H * 0.5 - CS * 3.5;
    map.townSquare = {
      x: sq1X,
      y: sq1Y,
      w: CS * 7,
      h: CS * 7,
      centerFeature: { type: 'fountain', x: sq1X + CS * 3.5, y: H * 0.5, radius: CS * 1.3 },
      marketStalls: []
    };

    // Square 2: Lower Market Square
    const sq2X = W * 0.62;
    const sq2Y = H * 0.5 - CS * 3.5;
    map.cityPlazas.push({
      x: sq2X,
      y: sq2Y,
      w: CS * 7,
      h: CS * 7,
      centerFeature: { type: 'pillory_board', x: sq2X + CS * 3.5, y: H * 0.5, radius: CS * 1.3 },
      marketStalls: [
        { x: sq2X + CS * 1, y: sq2Y + CS * 1.5, w: CS * 1.8, h: CS * 1.2, color: '#dc2626', goodsType: 'fruit' },
        { x: sq2X + CS * 4, y: sq2Y + CS * 1.5, w: CS * 1.8, h: CS * 1.2, color: '#d97706', goodsType: 'bread' }
      ]
    });

    this.placeCityBuilding(map, 'town_hall', sq1X + CS * 0.5, sq1Y - CS * 4.8, 6, 4, 'south', CS);
    this.placeCityBuilding(map, 'merchant_manor', sq1X + CS * 0.5, sq1Y + CS * 8.2, 6, 4, 'north', CS);
    this.placeCityBuilding(map, 'bakery_shop', sq2X + CS * 0.5, sq2Y - CS * 4.8, 5, 4, 'south', CS);
    this.placeCityBuilding(map, 'city_tavern', sq2X + CS * 0.5, sq2Y + CS * 8.2, 6, 4, 'north', CS);
  }

  // 11. Hilltop Terraces Pattern
  generateCityPattern_HilltopTerraces(map, W, H, CS) {
    map.cityNamePattern = 'Террасированный город на холме и Верхний замок';

    map.cityStreets.push({ x1: 0, y1: H * 0.25, x2: W, y2: H * 0.25, width: CS * 2.2, type: 'terrace_street' });
    map.cityStreets.push({ x1: 0, y1: H * 0.72, x2: W, y2: H * 0.72, width: CS * 2.2, type: 'terrace_street' });
    map.cityStreets.push({ x1: W * 0.5, y1: H * 0.25, x2: W * 0.5, y2: H * 0.72, width: CS * 2.0, type: 'stairs_road' });

    map.townSquare = {
      x: W * 0.35,
      y: H * 0.25 - CS * 3.5,
      w: CS * 8,
      h: CS * 6,
      centerFeature: { type: 'statue', x: W * 0.5, y: H * 0.25, radius: CS * 1.4 },
      marketStalls: []
    };

    this.placeCityBuilding(map, 'merchant_manor', W * 0.08, H * 0.25 - CS * 7.5, 6, 4, 'south', CS);
    this.placeCityBuilding(map, 'town_hall', W * 0.65, H * 0.25 - CS * 7.5, 6, 4, 'south', CS);
    this.placeCityBuilding(map, 'city_tavern', W * 0.08, H * 0.72 + CS * 1.5, 6, 4, 'north', CS);
    this.placeCityBuilding(map, 'guildhall', W * 0.65, H * 0.72 + CS * 1.5, 6, 4, 'north', CS);
  }

  // 12. Thieves Slums Alley Pattern
  generateCityPattern_ThievesSlums(map, W, H, CS) {
    map.cityNamePattern = 'Теневой квартал, Извилистые тупики и Трущобы';

    map.cityStreets.push({ x1: CS * 2, y1: H * 0.3, x2: W - CS * 2, y2: H * 0.3, width: CS * 1.5, type: 'dark_alley' });
    map.cityStreets.push({ x1: CS * 2, y1: H * 0.7, x2: W - CS * 2, y2: H * 0.7, width: CS * 1.5, type: 'dark_alley' });
    map.cityStreets.push({ x1: W * 0.4, y1: H * 0.15, x2: W * 0.4, y2: H * 0.85, width: CS * 1.5, type: 'dark_alley' });

    map.townSquare = {
      x: W * 0.55,
      y: H * 0.4,
      w: CS * 6,
      h: CS * 5,
      centerFeature: { type: 'pillory_board', x: W * 0.65, y: H * 0.5, radius: CS * 1.1 },
      marketStalls: [
        { x: W * 0.58, y: H * 0.42, w: CS * 1.8, h: CS * 1.2, color: '#334155', goodsType: 'weapons' }
      ]
    };

    this.placeCityBuilding(map, 'pawn_shop', W * 0.08, H * 0.3 - CS * 4.2, 5, 4, 'south', CS);
    this.placeCityBuilding(map, 'city_tavern', W * 0.55, H * 0.3 - CS * 4.2, 6, 4, 'south', CS);
    this.placeCityBuilding(map, 'alchemy_shop', W * 0.08, H * 0.7 + CS * 0.8, 5, 4, 'north', CS);
    this.placeCityBuilding(map, 'guardhouse', W * 0.55, H * 0.7 + CS * 0.8, 5, 4, 'north', CS);
  }

  // 13. University Campus Pattern
  generateCityPattern_UniversityCampus(map, W, H, CS) {
    map.cityNamePattern = 'Академический квартал, Великая библиотека и Университет';

    const sqX = W * 0.28;
    const sqY = H * 0.3;
    const sqW = CS * 10;
    const sqH = CS * 7;

    map.townSquare = {
      x: sqX,
      y: sqY,
      w: sqW,
      h: sqH,
      centerFeature: { type: 'statue', x: sqX + sqW * 0.5, y: sqY + sqH * 0.5, radius: CS * 1.5 },
      marketStalls: []
    };

    map.cityStreets.push({ x1: sqX - CS * 2, y1: sqY - CS * 1.5, x2: sqX + sqW + CS * 2, y2: sqY - CS * 1.5, width: CS * 2.2, type: 'campus_avenue' });
    map.cityStreets.push({ x1: sqX - CS * 2, y1: sqY + sqH + CS * 1.5, x2: sqX + sqW + CS * 2, y2: sqY + sqH + CS * 1.5, width: CS * 2.2, type: 'campus_avenue' });

    this.placeCityBuilding(map, 'library_university', sqX + CS * 1.5, sqY - CS * 5.8, 7, 4, 'south', CS);
    this.placeCityBuilding(map, 'apothecary', sqX + CS * 1.5, sqY + sqH + CS * 2.5, 6, 4, 'north', CS);
    this.placeCityBuilding(map, 'alchemy_shop', sqX - CS * 6.5, sqY, 5, 4, 'east', CS);
    this.placeCityBuilding(map, 'city_tavern', sqX + sqW + CS * 1.5, sqY, 6, 4, 'west', CS);
  }

  // 14. Executioner Market Pattern
  generateCityPattern_ExecutionerMarket(map, W, H, CS) {
    map.cityNamePattern = 'Нижний ярмарочный рынок и Эшафот';

    const sqX = W * 0.25;
    const sqY = H * 0.3;
    const sqW = CS * 11;
    const sqH = CS * 8;

    map.townSquare = {
      x: sqX,
      y: sqY,
      w: sqW,
      h: sqH,
      centerFeature: { type: 'pillory_board', x: sqX + sqW * 0.5, y: sqY + sqH * 0.5, radius: CS * 1.6 },
      marketStalls: [
        { x: sqX + CS * 1.5, y: sqY + CS * 1.5, w: CS * 1.8, h: CS * 1.2, color: '#dc2626', goodsType: 'fruit' },
        { x: sqX + sqW - CS * 3.3, y: sqY + CS * 1.5, w: CS * 1.8, h: CS * 1.2, color: '#d97706', goodsType: 'bread' },
        { x: sqX + CS * 1.5, y: sqY + sqH - CS * 2.7, w: CS * 1.8, h: CS * 1.2, color: '#16a34a', goodsType: 'cloth' },
        { x: sqX + sqW - CS * 3.3, y: sqY + sqH - CS * 2.7, w: CS * 1.8, h: CS * 1.2, color: '#2563eb', goodsType: 'weapons' }
      ]
    };

    map.cityStreets.push({ x1: 0, y1: sqY + sqH * 0.5, x2: W, y2: sqY + sqH * 0.5, width: CS * 2.5, type: 'market_avenue' });

    this.placeCityBuilding(map, 'guardhouse', sqX + CS * 2, sqY - CS * 5.2, 6, 4, 'south', CS);
    this.placeCityBuilding(map, 'city_tavern', sqX + CS * 2, sqY + sqH + CS * 1.8, 6, 4, 'north', CS);
    this.placeCityBuilding(map, 'pawn_shop', sqX - CS * 6.5, sqY + CS * 1.5, 5, 4, 'east', CS);
  }

  // 15. Star Fortress Corner Pattern
  generateCityPattern_StarFortressCorner(map, W, H, CS) {
    map.cityNamePattern = 'Угол звездчатой крепости и Оружейный бастион';

    const bX = CS * 3;
    const bY = CS * 3;

    // Bastion Wall
    map.cityWalls = [{ x1: 0, y1: bY + CS * 4, x2: bX + CS * 6, y2: 0, thickness: CS * 1.4, gateY: bY + CS * 2, gateW: CS * 3.0 }];

    // Fanning avenues radiating into town
    map.cityStreets.push({ x1: bX, y1: bY, x2: W, y2: bY, width: CS * 2.4, type: 'bastion_road' });
    map.cityStreets.push({ x1: bX, y1: bY, x2: W, y2: H, width: CS * 2.4, type: 'bastion_road' });
    map.cityStreets.push({ x1: bX, y1: bY, x2: bX, y2: H, width: CS * 2.4, type: 'bastion_road' });

    map.townSquare = {
      x: bX + CS * 2,
      y: bY + CS * 2,
      w: CS * 8,
      h: CS * 6,
      centerFeature: { type: 'statue', x: bX + CS * 6, y: bY + CS * 5, radius: CS * 1.4 },
      marketStalls: [
        { x: bX + CS * 3, y: bY + CS * 3, w: CS * 1.8, h: CS * 1.2, color: '#dc2626', goodsType: 'weapons' }
      ]
    };

    this.placeCityBuilding(map, 'barracks', bX + CS * 11, bY, 7, 4, 'south', CS);
    this.placeCityBuilding(map, 'guardhouse', bX + CS * 11, bY + CS * 6, 6, 4, 'north', CS);
    this.placeCityBuilding(map, 'pawn_shop', bX, bY + CS * 10, 5, 4, 'east', CS);
  }

  // Generate sidewalks & curb drainage paths for all streets and buildings
  generateCitySidewalksAndGutters(map, W, H, CS) {
    for (const str of map.cityStreets) {
      const isHoriz = Math.abs(str.y1 - str.y2) < 5;
      const isVert = Math.abs(str.x1 - str.x2) < 5;
      const swWidth = CS * 0.7;

      if (isHoriz) {
        const yTop = str.y1 - str.width * 0.5 - swWidth;
        const yBot = str.y1 + str.width * 0.5;
        const minX = Math.min(str.x1, str.x2);
        const maxX = Math.max(str.x1, str.x2);

        map.citySidewalks.push({ x: minX, y: yTop, w: maxX - minX, h: swWidth, side: 'top' });
        map.citySidewalks.push({ x: minX, y: yBot, w: maxX - minX, h: swWidth, side: 'bottom' });
      } else if (isVert) {
        const xLeft = str.x1 - str.width * 0.5 - swWidth;
        const xRight = str.x1 + str.width * 0.5;
        const minY = Math.min(str.y1, str.y2);
        const maxY = Math.max(str.y1, str.y2);

        map.citySidewalks.push({ x: xLeft, y: minY, w: swWidth, h: maxY - minY, side: 'left' });
        map.citySidewalks.push({ x: xRight, y: minY, w: swWidth, h: maxY - minY, side: 'right' });
      }
    }

    // Add sidewalks around buildings
    for (const b of map.buildings) {
      const swMargin = CS * 0.5;
      map.citySidewalks.push({
        x: b.x - swMargin,
        y: b.y - swMargin,
        w: b.width + swMargin * 2,
        h: b.height + swMargin * 2,
        isBuildingPerimeter: true
      });
    }
  }

  buildCityHouseArchetype(type, bx, by, bw, bh, doorSide, CS) {
    const rooms = [];
    const internalWalls = [];
    const props = [];
    const outdoorFeatures = [];
    let name = '';

    if (type === 'town_hall') {
      name = 'Городская Ратуша';
      const splitX = bw * 0.6;
      rooms.push({ id: 'council', name: 'Зал Совета', relX: 0, relY: 0, relW: splitX, relH: bh, floorStyle: 'fancy_carpet' });
      rooms.push({ id: 'archive', name: 'Архив и канцелярия', relX: splitX, relY: 0, relW: bw - splitX, relH: bh, floorStyle: 'stone_flagstones' });

      internalWalls.push({ x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh, door: { y: by + bh * 0.5, size: 24 } });

      props.push({ type: 'dining_table', x: bx + 16, y: by + 16, w: splitX - 32, h: CS * 1.2 });
      props.push({ type: 'desk', x: bx + splitX + 10, y: by + 12, w: CS * 1.2, h: CS * 0.8 });
      props.push({ type: 'bookshelf', x: bx + bw - CS * 1.1 - 6, y: by + bh - 16, w: CS * 1.1, h: 12 });

    } else if (type === 'guildhall') {
      name = 'Гильдия Ремесленников';
      const splitY = bh * 0.55;
      rooms.push({ id: 'hall', name: 'Зал мастеров', relX: 0, relY: 0, relW: bw, relH: splitY, floorStyle: 'stone_flagstones' });
      rooms.push({ id: 'vault', name: 'Казна и хранилище', relX: 0, relY: splitY, relW: bw, relH: bh - splitY, floorStyle: 'cobblestone' });

      internalWalls.push({ x1: bx, y1: by + splitY, x2: bx + bw, y2: by + splitY, door: { x: bx + bw * 0.5, size: 22 } });

      props.push({ type: 'desk', x: bx + 12, y: by + 12, w: CS * 1.4, h: CS * 0.8 });
      props.push({ type: 'chest', x: bx + 14, y: by + splitY + 10, w: 20, h: 14 });
      props.push({ type: 'crate', x: bx + bw - 30, y: by + splitY + 10, w: 18, h: 18 });

    } else if (type === 'cathedral_chapel') {
      name = 'Городская Часовня';
      rooms.push({ id: 'nave', name: 'Молельный зал', relX: 0, relY: 0, relW: bw, relH: bh, floorStyle: 'fancy_carpet' });

      props.push({ type: 'hearth', x: bx + bw * 0.5 - CS * 0.8, y: by + 4, w: CS * 1.6, h: 12 });
      props.push({ type: 'drinking_table', x: bx + 16, y: by + bh * 0.4, w: bw - 32, h: CS * 0.6 });
      props.push({ type: 'drinking_table', x: bx + 16, y: by + bh * 0.65, w: bw - 32, h: CS * 0.6 });

    } else if (type === 'alchemy_shop') {
      name = 'Лавка Алхимика';
      const splitX = bw * 0.55;
      rooms.push({ id: 'shop', name: 'Торговый зал алхимии', relX: 0, relY: 0, relW: splitX, relH: bh, floorStyle: 'wood_planks' });
      rooms.push({ id: 'lab', name: 'Лаборатория', relX: splitX, relY: 0, relW: bw - splitX, relH: bh, floorStyle: 'stone_flagstones' });

      internalWalls.push({ x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh, door: { y: by + bh * 0.5, size: 20 } });

      props.push({ type: 'bar_counter', x: bx + 12, y: by + 12, w: splitX - 24, h: 18 });
      props.push({ type: 'bookshelf', x: bx + splitX + 8, y: by + 8, w: (bw - splitX) - 16, h: 12 });
      props.push({ type: 'cauldron', x: bx + bw - CS * 0.8, y: by + bh - CS * 0.8, r: 10 });

    } else if (type === 'guardhouse') {
      name = 'Городская Караульня';
      const splitX = bw * 0.6;
      rooms.push({ id: 'guard_room', name: 'Дежурная караула', relX: 0, relY: 0, relW: splitX, relH: bh, floorStyle: 'stone_flagstones' });
      rooms.push({ id: 'jail', name: 'Тюремная камера', relX: splitX, relY: 0, relW: bw - splitX, relH: bh, floorStyle: 'cobblestone' });

      internalWalls.push({ x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh, door: { y: by + bh * 0.5, size: 20 } });

      props.push({ type: 'weapons_rack', x: bx + 10, y: by + 8, w: CS * 1.2, h: 10 });
      props.push({ type: 'desk', x: bx + 10, y: by + bh - CS * 0.9 - 6, w: CS * 1.1, h: CS * 0.8 });
      props.push({ type: 'bed', x: bx + bw - CS * 0.9 - 6, y: by + 8, w: CS * 0.9, h: CS * 1.3 });

    } else if (type === 'harbourmaster') {
      name = 'Портовая Канцелярия';
      const splitX = bw * 0.6;
      rooms.push({ id: 'office', name: 'Кабинет капитана порта', relX: 0, relY: 0, relW: splitX, relH: bh, floorStyle: 'wood_planks' });
      rooms.push({ id: 'customs', name: 'Таможенный архив', relX: splitX, relY: 0, relW: bw - splitX, relH: bh, floorStyle: 'stone_flagstones' });

      internalWalls.push({ x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh, door: { y: by + bh * 0.5, size: 20 } });

      props.push({ type: 'desk', x: bx + 12, y: by + 12, w: CS * 1.4, h: CS * 0.8 });
      props.push({ type: 'bookshelf', x: bx + splitX + 8, y: by + 8, w: (bw - splitX) - 16, h: 12 });
      props.push({ type: 'chest', x: bx + 14, y: by + bh - 20, w: 22, h: 14 });

    } else if (type === 'warehouse') {
      name = 'Купеческий Склад';
      rooms.push({ id: 'storage', name: 'Складской ангар', relX: 0, relY: 0, relW: bw, relH: bh, floorStyle: 'cobblestone' });

      props.push({ type: 'crate', x: bx + 12, y: by + 12, w: CS * 1.2, h: CS * 1.2 });
      props.push({ type: 'crate', x: bx + CS * 1.5, y: by + 12, w: CS * 1.0, h: CS * 1.0 });
      props.push({ type: 'barrel', x: bx + bw - CS * 1.5, y: by + 16, r: 10 });
      props.push({ type: 'grain_sack', x: bx + bw - CS * 2.8, y: by + 16, r: 8 });

    } else if (type === 'library_university') {
      name = 'Великая Библиотека';
      rooms.push({ id: 'reading', name: 'Читальный зал', relX: 0, relY: 0, relW: bw, relH: bh, floorStyle: 'fancy_carpet' });

      props.push({ type: 'bookshelf', x: bx + 12, y: by + 8, w: bw - 24, h: 12 });
      props.push({ type: 'bookshelf', x: bx + 12, y: by + bh - 20, w: bw - 24, h: 12 });
      props.push({ type: 'desk', x: bx + bw * 0.5 - CS * 0.8, y: by + bh * 0.5 - CS * 0.4, w: CS * 1.6, h: CS * 0.8 });

    } else if (type === 'barracks') {
      name = 'Военные Казармы';
      const splitX = bw * 0.65;
      rooms.push({ id: 'dorm', name: 'Спальный корпус', relX: 0, relY: 0, relW: splitX, relH: bh, floorStyle: 'wood_planks' });
      rooms.push({ id: 'armory', name: 'Оружейная', relX: splitX, relY: 0, relW: bw - splitX, relH: bh, floorStyle: 'stone_flagstones' });

      internalWalls.push({ x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh, door: { y: by + bh * 0.5, size: 20 } });

      props.push({ type: 'bed', x: bx + 8, y: by + 8, w: CS * 0.8, h: CS * 1.3 });
      props.push({ type: 'bed', x: bx + CS * 1.2, y: by + 8, w: CS * 0.8, h: CS * 1.3 });
      props.push({ type: 'weapons_rack', x: bx + splitX + 8, y: by + 8, w: (bw - splitX) - 16, h: 10 });

    } else if (type === 'pawn_shop') {
      name = 'Скупка и Ломбард';
      const splitX = bw * 0.55;
      rooms.push({ id: 'counter', name: 'Торговый зал', relX: 0, relY: 0, relW: splitX, relH: bh, floorStyle: 'wood_planks' });
      rooms.push({ id: 'pawn_vault', name: 'Склад залогов', relX: splitX, relY: 0, relW: bw - splitX, relH: bh, floorStyle: 'stone_flagstones' });

      internalWalls.push({ x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh, door: { y: by + bh * 0.5, size: 20 } });

      props.push({ type: 'bar_counter', x: bx + 10, y: by + 10, w: splitX - 20, h: 16 });
      props.push({ type: 'chest', x: bx + splitX + 10, y: by + 10, w: 22, h: 14 });

    } else if (type === 'bakery_shop') {
      name = 'Городская Пекарня';
      const splitX = bw * 0.5;
      rooms.push({ id: 'shop', name: 'Лавка хлеба', relX: 0, relY: 0, relW: splitX, relH: bh, floorStyle: 'wood_planks' });
      rooms.push({ id: 'kitchen', name: 'Пекарня и печи', relX: splitX, relY: 0, relW: bw - splitX, relH: bh, floorStyle: 'stone_flagstones' });

      internalWalls.push({ x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh, door: { y: by + bh * 0.5, size: 20 } });

      props.push({ type: 'bar_counter', x: bx + 10, y: by + 10, w: splitX - 20, h: 16 });
      props.push({ type: 'hearth', x: bx + bw - CS * 1.2, y: by + 8, w: CS * 1.0, h: 14 });

    } else if (type === 'apothecary') {
      name = 'Аптека Травника';
      const splitX = bw * 0.55;
      rooms.push({ id: 'shop', name: 'Торговый зал снадобий', relX: 0, relY: 0, relW: splitX, relH: bh, floorStyle: 'wood_planks' });
      rooms.push({ id: 'herbs', name: 'Сушильня трав', relX: splitX, relY: 0, relW: bw - splitX, relH: bh, floorStyle: 'wood_planks' });

      internalWalls.push({ x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh, door: { y: by + bh * 0.5, size: 20 } });

      props.push({ type: 'bar_counter', x: bx + 10, y: by + 10, w: splitX - 20, h: 16 });
      props.push({ type: 'bookshelf', x: bx + splitX + 8, y: by + 8, w: (bw - splitX) - 16, h: 12 });

    } else if (type === 'city_tavern') {
      name = 'Городской Трактир';
      const splitX = bw * 0.65;
      rooms.push({ id: 'hall', name: 'Зал таверны', relX: 0, relY: 0, relW: splitX, relH: bh, floorStyle: 'wood_planks' });
      rooms.push({ id: 'kitchen', name: 'Кухня и погреб', relX: splitX, relY: 0, relW: bw - splitX, relH: bh, floorStyle: 'stone_flagstones' });

      internalWalls.push({ x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh, door: { y: by + bh * 0.5, size: 22 } });

      props.push({ type: 'bar_counter', x: bx + 12, y: by + 12, w: splitX - 24, h: 18 });
      props.push({ type: 'drinking_table', x: bx + 14, y: by + bh * 0.5, w: splitX - 28, h: CS * 0.8 });
      props.push({ type: 'barrel', x: bx + bw - CS * 1.0, y: by + 12, r: 10 });

    } else {
      name = type === 'merchant_manor' ? 'Купеческий особняк' : 'Городской жилой дом';
      const splitX = bw * 0.55;
      rooms.push({ id: 'living', name: 'Жилой зал', relX: 0, relY: 0, relW: splitX, relH: bh, floorStyle: 'wood_planks' });
      rooms.push({ id: 'bed', name: 'Покои', relX: splitX, relY: 0, relW: bw - splitX, relH: bh, floorStyle: 'wood_planks' });

      internalWalls.push({ x1: bx + splitX, y1: by, x2: bx + splitX, y2: by + bh, door: { y: by + bh * 0.5, size: 20 } });

      props.push({ type: 'hearth', x: bx + 10, y: by - 4, w: CS * 1.2, h: 12 });
      props.push({ type: 'drinking_table', x: bx + 16, y: by + bh * 0.5, w: CS * 1.1, h: CS * 0.7 });
      props.push({ type: 'double_bed', x: bx + bw - CS * 1.1 - 6, y: by + 8, w: CS * 1.1, h: CS * 1.4 });
    }

    const windows = [];
    if (doorSide !== 'north') windows.push({ side: 'north', offset: 0.5 });
    if (doorSide !== 'south') windows.push({ side: 'south', offset: 0.5 });

    return { name, rooms, internalWalls, props, outdoorFeatures, windows };
  }
}
