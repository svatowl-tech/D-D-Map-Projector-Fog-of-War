/**
 * Points of Interest (POI) & Tactical Micro-Locations Module
 * Rich procedural landmark dictionary for D&D 5e Battlemaps
 */

import { dist, lerp } from './prng.js';

export const POI_DICTIONARY = {
  cave_entrance: {
    id: 'cave_entrance',
    name: 'Вход в пещеру',
    category: 'dungeon',
    desc: 'Мрачный скальный грот с деревянными крепями, костями и следами чудовищ',
    icon: '⛰️'
  },
  ancient_altar: {
    id: 'ancient_altar',
    name: 'Древний алтарь',
    category: 'arcane',
    desc: 'Капище с высеченными рунами, жаровнями и ритуальным кругом',
    icon: '🔮'
  },
  smuggler_cache: {
    id: 'smuggler_cache',
    name: 'Схрон контрабандистов',
    category: 'loot',
    desc: 'Потайной тайник с коваными сундуками, бочками рома и припасами',
    icon: '📦'
  },
  forgotten_crypt: {
    id: 'forgotten_crypt',
    name: 'Забытый курган / Склеп',
    category: 'undead',
    desc: 'Древнее каменное надгробие с кованой решеткой и могильными плитами',
    icon: '⚰️'
  },
  treehouse_lookout: {
    id: 'treehouse_lookout',
    name: 'Дозорный помост на древе',
    category: 'tactical',
    desc: 'Укрепленная платформа следопытов с веревочной лестницей и арбалетами',
    icon: '🏹'
  },
  witch_hut: {
    id: 'witch_hut',
    name: 'Хижина травницы / Ведьмы',
    category: 'mystery',
    desc: 'Избушка на сваях с дымящимся котлом, сушеными травами и колбами',
    icon: '🧪'
  },
  stone_henge: {
    id: 'stone_henge',
    name: 'Кромлех / Круг менгиров',
    category: 'arcane',
    desc: 'Кольцо циклопических мегалитов с парящим магическим кристаллом',
    icon: '🗿'
  },
  ruined_watchtower: {
    id: 'ruined_watchtower',
    name: 'Разрушенная дозорная башня',
    category: 'ruins',
    desc: 'Круглая каменная башня с обрушившейся крышей и винтовой лестницей',
    icon: '🏰'
  },
  monster_nest: {
    id: 'monster_nest',
    name: 'Гнездо виверны / Чудовища',
    category: 'hazard',
    desc: 'Огромное логово из ветвей и костей с гигантскими яйцами и доспехами',
    icon: '🦅'
  },
  cursed_statue: {
    id: 'cursed_statue',
    name: 'Проклятый монумент',
    category: 'mystery',
    desc: 'Растрескавшаяся циклопическая статуя с горящими руническими глазами',
    icon: '🗽'
  },
  fairy_spring: {
    id: 'fairy_spring',
    name: 'Светящийся источник фей',
    category: 'fey',
    desc: 'Хрустальный ключ с лазурной водой, светящимися кувшинками и искрами',
    icon: '✨'
  },
  gallows_crossroad: {
    id: 'gallows_crossroad',
    name: 'Виселица на распутье',
    category: 'lore',
    desc: 'Деревянный эшафот с подвешенной железной клеткой и дорожными указателями',
    icon: '⚖️'
  }
};

export class POIGenerator {
  constructor(prng, biomeId = 'forest') {
    this.prng = prng;
    this.biomeId = biomeId;
  }

  /**
   * Generates a Point of Interest instance at specified coordinates
   */
  generatePOI(type, x, y, CS = 48) {
    switch (type) {
      case 'cave_entrance':
        return this.createCaveEntrance(x, y, CS);
      case 'ancient_altar':
        return this.createAncientAltar(x, y, CS);
      case 'smuggler_cache':
        return this.createSmugglerCache(x, y, CS);
      case 'forgotten_crypt':
        return this.createForgottenCrypt(x, y, CS);
      case 'treehouse_lookout':
        return this.createTreehouseLookout(x, y, CS);
      case 'witch_hut':
        return this.createWitchHut(x, y, CS);
      case 'stone_henge':
        return this.createStoneHenge(x, y, CS);
      case 'ruined_watchtower':
        return this.createRuinedWatchtower(x, y, CS);
      case 'monster_nest':
        return this.createMonsterNest(x, y, CS);
      case 'cursed_statue':
        return this.createCursedStatue(x, y, CS);
      case 'fairy_spring':
        return this.createFairySpring(x, y, CS);
      case 'gallows_crossroad':
      default:
        return this.createGallowsCrossroad(x, y, CS);
    }
  }

  createCaveEntrance(x, y, CS) {
    const mouthWidth = this.prng.float(CS * 1.4, CS * 2.2);
    const mouthDepth = this.prng.float(CS * 1.2, CS * 1.8);
    const angle = this.prng.float(-0.2, 0.2);

    // Rock facade surrounding the cavern mouth
    const rockRim = [];
    const numRockPts = 12;
    const rimRadius = mouthWidth * 0.9;
    for (let i = 0; i <= numRockPts; i++) {
      const a = Math.PI + (i / numRockPts) * Math.PI;
      const r = rimRadius + this.prng.float(-8, 12);
      rockRim.push({
        x: Math.cos(a) * r,
        y: Math.sin(a) * (r * 0.65) - 4
      });
    }

    const torches = [
      { x: -mouthWidth * 0.55, y: 4, burning: true },
      { x: mouthWidth * 0.55, y: 4, burning: true }
    ];

    const stalagmites = [];
    const numSpikes = this.prng.int(3, 6);
    for (let i = 0; i < numSpikes; i++) {
      stalagmites.push({
        x: this.prng.float(-mouthWidth * 0.4, mouthWidth * 0.4),
        y: this.prng.float(-mouthDepth * 0.6, -mouthDepth * 0.1),
        r: this.prng.float(3, 7)
      });
    }

    return {
      type: 'cave_entrance',
      name: 'Вход в пещеру',
      x,
      y,
      mouthWidth,
      mouthDepth,
      angle,
      rockRim,
      torches,
      stalagmites,
      hasBones: this.prng.bool(0.7),
      hasCartTracks: this.prng.bool(0.5)
    };
  }

  createAncientAltar(x, y, CS) {
    const radius = CS * 1.6;
    const braziers = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      braziers.push({
        x: Math.cos(a) * (radius * 0.85),
        y: Math.sin(a) * (radius * 0.85),
        r: 6
      });
    }

    return {
      type: 'ancient_altar',
      name: 'Древний алтарь',
      x,
      y,
      radius,
      slabWidth: CS * 1.3,
      slabHeight: CS * 0.8,
      runeColor: this.prng.choice(['#ef4444', '#8b5cf6', '#06b6d4', '#10b981']),
      braziers,
      monoliths: 4,
      bloodStain: this.prng.bool(0.7)
    };
  }

  createSmugglerCache(x, y, CS) {
    const chests = [
      { x: -14, y: -8, w: 22, h: 14, angle: this.prng.float(-0.2, 0.2), locked: true },
      { x: 12, y: 10, w: 18, h: 12, angle: this.prng.float(0.1, 0.5), locked: false }
    ];
    const barrels = [
      { x: -16, y: 12, r: 8 },
      { x: -2, y: 16, r: 7.5 },
      { x: 18, y: -10, r: 8 }
    ];
    const crates = [
      { x: 0, y: -14, w: 16, h: 16, angle: 0.1 },
      { x: 16, y: 2, w: 14, h: 14, angle: -0.3 }
    ];

    return {
      type: 'smuggler_cache',
      name: 'Схрон контрабандистов',
      x,
      y,
      chests,
      barrels,
      crates,
      tarp: { x: -8, y: -4, w: 32, h: 26, color: '#3f3f46' },
      lantern: { x: 0, y: -14, lit: true }
    };
  }

  createForgottenCrypt(x, y, CS) {
    return {
      type: 'forgotten_crypt',
      name: 'Забытый курган / Склеп',
      x,
      y,
      moundWidth: CS * 2.2,
      moundHeight: CS * 1.6,
      cryptWidth: CS * 1.2,
      cryptHeight: CS * 0.9,
      ironGate: true,
      tombstones: [
        { x: -CS * 0.8, y: CS * 0.4, w: 10, h: 18, broken: false },
        { x: CS * 0.85, y: CS * 0.35, w: 9, h: 16, broken: true }
      ],
      heroSword: this.prng.bool(0.65)
    };
  }

  createTreehouseLookout(x, y, CS) {
    return {
      type: 'treehouse_lookout',
      name: 'Дозорный помост на древе',
      x,
      y,
      trunkRadius: 18,
      platformWidth: CS * 2.2,
      platformHeight: CS * 2.2,
      canopyRadius: CS * 2.8,
      ropeLadder: { side: 'south', length: CS * 1.5 },
      crossbowRack: true,
      mapTable: true
    };
  }

  createWitchHut(x, y, CS) {
    return {
      type: 'witch_hut',
      name: 'Хижина ведьмы / Травницы',
      x,
      y,
      width: CS * 1.8,
      height: CS * 1.5,
      angle: this.prng.float(-0.15, 0.15),
      cauldron: { x: x + CS * 1.2, y: y + CS * 0.6, r: 8, bubbling: true },
      herbRacks: [
        { x: x - CS * 0.8, y: y - CS * 0.5, length: 24 },
        { x: x - CS * 0.8, y: y + CS * 0.5, length: 24 }
      ],
      chimneySmoke: true
    };
  }

  createStoneHenge(x, y, CS) {
    const radius = CS * 1.8;
    const monoliths = [];
    const count = 7;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      monoliths.push({
        x: Math.cos(a) * radius,
        y: Math.sin(a) * radius,
        w: 16,
        h: 10,
        angle: a + Math.PI / 2
      });
    }

    return {
      type: 'stone_henge',
      name: 'Кромлех / Круг менгиров',
      x,
      y,
      radius,
      monoliths,
      floatingCrystal: { color: '#38bdf8', r: 8 },
      spiralRunes: true
    };
  }

  createRuinedWatchtower(x, y, CS) {
    return {
      type: 'ruined_watchtower',
      name: 'Разрушенная дозорная башня',
      x,
      y,
      radius: CS * 1.4,
      wallThickness: 8,
      breachAngle: this.prng.float(0, Math.PI * 2),
      breachArc: 1.2,
      spiralStairs: true,
      rubbleCount: 8,
      lootCrate: true
    };
  }

  createMonsterNest(x, y, CS) {
    return {
      type: 'monster_nest',
      name: 'Гнездо чудовища',
      x,
      y,
      radius: CS * 1.5,
      eggs: [
        { x: -5, y: -4, r: 6, color: '#fef08a' },
        { x: 6, y: -2, r: 6.5, color: '#fef08a' },
        { x: 0, y: 7, r: 5.5, color: '#fef08a' }
      ],
      mangledBones: 6,
      rustyGear: true
    };
  }

  createCursedStatue(x, y, CS) {
    return {
      type: 'cursed_statue',
      name: 'Проклятый монумент',
      x,
      y,
      plinthWidth: CS * 1.2,
      plinthHeight: CS * 1.2,
      statueRadius: 18,
      eyeColor: '#a855f7',
      cracks: 4,
      fallenHead: { x: x + CS * 0.8, y: y + CS * 0.6, r: 8 }
    };
  }

  createFairySpring(x, y, CS) {
    return {
      type: 'fairy_spring',
      name: 'Светящийся источник фей',
      x,
      y,
      poolRadius: CS * 1.4,
      glowColor: '#38bdf8',
      lilies: 4,
      mushroomRing: 8,
      magicWisps: 5
    };
  }

  createGallowsCrossroad(x, y, CS) {
    return {
      type: 'gallows_crossroad',
      name: 'Виселица на распутье',
      x,
      y,
      timberLength: 32,
      ironCage: true,
      signpost: {
        x: x + 24,
        y: y + 16,
        signs: ['Тракт', 'Северный форпост', 'Ведьмин лог']
      }
    };
  }
}
