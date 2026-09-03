/**
 * Biome Definitions & Palettes for D&D 5e Battlemap Generator
 * Handcrafted palettes combining Watabou Village watercolor/ink with Watabou Dungeon clarity
 */

export const BIOMES = {
  forest: {
    id: 'forest',
    name: 'Лес / Чащоба',
    subtitle: 'Густые кроны, мшистые камни, лесные тропы и поляны',
    ground: {
      base: '#e3dfcc',
      baseHex: 0xe3dfcc,
      tint: '#d2ccb2',
      grass: '#b8c793',
      grassDark: '#8fa86b',
      dirt: '#cbb692',
      highlight: '#ece7d8',
      shadow: '#7a8e57'
    },
    water: {
      shallow: '#9bc8c2',
      deep: '#5a9997',
      bank: '#7ba9a4',
      foam: '#d7ece9'
    },
    road: {
      fill: '#d5be9b',
      stroke: '#8a7251',
      dash: '#a8906c'
    },
    trees: {
      type: 'deciduous',
      foliage: ['#6b8e4e', '#527736', '#7e9f59', '#3e6126'],
      stroke: '#283e18',
      shadow: 'rgba(25, 45, 15, 0.28)',
      trunk: '#5a4632'
    },
    fields: {
      crop: '#aebf82',
      furrow: '#7f9353',
      border: '#62753d'
    },
    rocks: {
      fill: '#bfbaab',
      stroke: '#585244',
      hatch: '#766f60'
    },
    building: {
      wall: '#403326',
      floor: '#dfcca8',
      planks: '#bda47d',
      roof: '#7d5236'
    },
    atmosphere: 'day',
    defaultToggles: {
      hasHouse: false,
      hasRiver: true,
      hasRoad: true,
      hasFields: false,
      hasRuins: false,
      hasCamp: false,
      treeDensity: 'dense',
      rockDensity: 'normal'
    }
  },

  road: {
    id: 'road',
    name: 'Проселочная дорога',
    subtitle: 'Колеи телег, придорожные канавы, каменные изгороди, развилки',
    ground: {
      base: '#e6e1d1',
      baseHex: 0xe6e1d1,
      tint: '#dacfb9',
      grass: '#c8cf9a',
      grassDark: '#99a770',
      dirt: '#cbb084',
      highlight: '#f0ece0',
      shadow: '#83915c'
    },
    water: {
      shallow: '#a2c8c6',
      deep: '#629896',
      bank: '#85a8a6',
      foam: '#e2f2f0'
    },
    road: {
      fill: '#cbb085',
      stroke: '#7e6443',
      dash: '#9d8058'
    },
    trees: {
      type: 'deciduous',
      foliage: ['#799856', '#5d7d3d', '#8ba867'],
      stroke: '#30441d',
      shadow: 'rgba(30, 45, 18, 0.22)',
      trunk: '#5e4835'
    },
    fields: {
      crop: '#c1cb89',
      furrow: '#929e5a',
      border: '#748141'
    },
    rocks: {
      fill: '#c5c0b4',
      stroke: '#5c584d',
      hatch: '#7d7768'
    },
    building: {
      wall: '#4a382a',
      floor: '#e5d3b3',
      planks: '#c4ad86',
      roof: '#8c593a'
    },
    atmosphere: 'day',
    defaultToggles: {
      hasHouse: true,
      hasRiver: false,
      hasRoad: true,
      hasFields: true,
      hasRuins: false,
      hasCamp: false,
      treeDensity: 'sparse',
      rockDensity: 'sparse'
    }
  },

  river: {
    id: 'river',
    name: 'Речная переправа',
    subtitle: 'Широкая река, деревянный мост или брод, камыши и речные отмели',
    ground: {
      base: '#ded9c3',
      baseHex: 0xded9c3,
      tint: '#cfc9af',
      grass: '#abc086',
      grassDark: '#7f9c5a',
      dirt: '#c4af87',
      highlight: '#eae5d4',
      shadow: '#6d854c'
    },
    water: {
      shallow: '#8fc5c1',
      deep: '#4d8c8c',
      bank: '#6fa3a1',
      foam: '#d3ebe9'
    },
    road: {
      fill: '#ccaF88',
      stroke: '#785f3f',
      dash: '#967b53'
    },
    trees: {
      type: 'deciduous',
      foliage: ['#628a49', '#4d7134', '#799c5f', '#44662d'],
      stroke: '#243716',
      shadow: 'rgba(20, 40, 15, 0.25)',
      trunk: '#523f2d'
    },
    fields: {
      crop: '#b5c88b',
      furrow: '#889e5c',
      border: '#677d3f'
    },
    rocks: {
      fill: '#b8b4a5',
      stroke: '#524e43',
      hatch: '#6f695b'
    },
    building: {
      wall: '#3d3023',
      floor: '#dbc6a0',
      planks: '#b89d74',
      roof: '#734a31'
    },
    atmosphere: 'day',
    defaultToggles: {
      hasHouse: false,
      hasRiver: true,
      hasRoad: true,
      hasFields: false,
      hasRuins: false,
      hasCamp: false,
      treeDensity: 'normal',
      rockDensity: 'normal'
    }
  },

  meadow: {
    id: 'meadow',
    name: 'Поля и угодья',
    subtitle: 'Вспаханные борозды, сеновалы, плетни, просторные луга',
    ground: {
      base: '#e5e1cc',
      baseHex: 0xe5e1cc,
      tint: '#d8d3b8',
      grass: '#b8c985',
      grassDark: '#8da458',
      dirt: '#cbb689',
      highlight: '#edeae0',
      shadow: '#768c48'
    },
    water: {
      shallow: '#9ecac5',
      deep: '#579694',
      bank: '#7ca8a5',
      foam: '#ddf0ee'
    },
    road: {
      fill: '#d2b98f',
      stroke: '#7f6645',
      dash: '#9e845c'
    },
    trees: {
      type: 'deciduous',
      foliage: ['#749b51', '#597d3a', '#8aab64'],
      stroke: '#2d411b',
      shadow: 'rgba(25, 40, 15, 0.2)',
      trunk: '#594432'
    },
    fields: {
      crop: '#ccbe7a',
      furrow: '#9e8f49',
      border: '#7c6f33'
    },
    rocks: {
      fill: '#c0bbb0',
      stroke: '#575449',
      hatch: '#757063'
    },
    building: {
      wall: '#443527',
      floor: '#dfcaa4',
      planks: '#bea47a',
      roof: '#805336'
    },
    atmosphere: 'day',
    defaultToggles: {
      hasHouse: true,
      hasRiver: false,
      hasRoad: true,
      hasFields: true,
      hasRuins: false,
      hasCamp: false,
      treeDensity: 'sparse',
      rockDensity: 'sparse'
    }
  },

  swamp: {
    id: 'swamp',
    name: 'Трясина и болото',
    subtitle: 'Застойные илистые топи, коряги, камыши, туманные испарения',
    ground: {
      base: '#cfcfb2',
      baseHex: 0xcfcfb2,
      tint: '#b8b898',
      grass: '#8c9c67',
      grassDark: '#60723d',
      dirt: '#8e8460',
      highlight: '#dbdbc0',
      shadow: '#4d5930'
    },
    water: {
      shallow: '#6b7d60',
      deep: '#435439',
      bank: '#57684d',
      foam: '#98aa8d'
    },
    road: {
      fill: '#998d6c',
      stroke: '#584f37',
      dash: '#73684a'
    },
    trees: {
      type: 'swamp',
      foliage: ['#586d44', '#3d4e2c', '#4b5f39', '#2a381c'],
      stroke: '#1e2814',
      shadow: 'rgba(15, 25, 10, 0.35)',
      trunk: '#3f382a'
    },
    fields: {
      crop: '#828e5e',
      furrow: '#5c683b',
      border: '#455029'
    },
    rocks: {
      fill: '#9b9d8e',
      stroke: '#45473d',
      hatch: '#616355'
    },
    building: {
      wall: '#322b22',
      floor: '#a89b7b',
      planks: '#8a7d5d',
      roof: '#544633'
    },
    atmosphere: 'fog',
    defaultToggles: {
      hasHouse: true,
      hasRiver: true,
      hasRoad: false,
      hasFields: false,
      hasRuins: true,
      hasCamp: false,
      treeDensity: 'dense',
      rockDensity: 'normal'
    }
  },

  winter: {
    id: 'winter',
    name: 'Зимняя пустошь / Снег',
    subtitle: 'Сугробы, ледяные торосы, замерзшая река, заснеженные ели',
    ground: {
      base: '#eaf0f5',
      baseHex: 0xeaf0f5,
      tint: '#d5e2ec',
      grass: '#b8ccdb',
      grassDark: '#8aa6bd',
      dirt: '#c1c9cf',
      highlight: '#f6f9fc',
      shadow: '#6d8ba3'
    },
    water: {
      shallow: '#96b8c9',
      deep: '#5a829a',
      bank: '#799fb5',
      foam: '#e6f1f7'
    },
    road: {
      fill: '#cdd7de',
      stroke: '#6b7d8a',
      dash: '#8a9ea8'
    },
    trees: {
      type: 'pine',
      foliage: ['#3e5c5c', '#2c4545', '#4d6f6f', '#203434'],
      stroke: '#152424',
      shadow: 'rgba(20, 35, 45, 0.25)',
      trunk: '#453830',
      snowCap: '#f2f7fa'
    },
    fields: {
      crop: '#c4d4df',
      furrow: '#9bb1bf',
      border: '#7c94a3'
    },
    rocks: {
      fill: '#9eaab3',
      stroke: '#475159',
      hatch: '#66737d'
    },
    building: {
      wall: '#38322c',
      floor: '#d3d7d9',
      planks: '#adb4b8',
      roof: '#524339',
      snowRoof: '#edf3f7'
    },
    atmosphere: 'day',
    defaultToggles: {
      hasHouse: true,
      hasRiver: true,
      hasRoad: true,
      hasFields: false,
      hasRuins: false,
      hasCamp: false,
      treeDensity: 'normal',
      rockDensity: 'normal'
    }
  },

  desert: {
    id: 'desert',
    name: 'Песчаная пустыня / Каньон',
    subtitle: 'Песчаные дюны, ветровая рябь, песчаниковые утесы, сухие русла',
    ground: {
      base: '#ebd9b7',
      baseHex: 0xebd9b7,
      tint: '#dec59b',
      grass: '#cbb07e',
      grassDark: '#a88c59',
      dirt: '#be9e65',
      highlight: '#f7ebd3',
      shadow: '#8c6f3a'
    },
    water: {
      shallow: '#82b9ba',
      deep: '#4b888c',
      bank: '#699fa1',
      foam: '#cdf0ee'
    },
    road: {
      fill: '#deb67e',
      stroke: '#846233',
      dash: '#a57f49'
    },
    trees: {
      type: 'desert',
      foliage: ['#7a8f57', '#5f733e', '#8fa368'],
      stroke: '#34421e',
      shadow: 'rgba(50, 35, 15, 0.25)',
      trunk: '#6a5137'
    },
    fields: {
      crop: '#cca86a',
      furrow: '#9e7939',
      border: '#7a5b23'
    },
    rocks: {
      fill: '#cf9f74',
      stroke: '#6b4629',
      hatch: '#8c5e37'
    },
    building: {
      wall: '#543b27',
      floor: '#e5cca2',
      planks: '#c2a373',
      roof: '#946039'
    },
    atmosphere: 'day',
    defaultToggles: {
      hasHouse: false,
      hasRiver: false,
      hasRoad: true,
      hasFields: false,
      hasRuins: true,
      hasCamp: true,
      treeDensity: 'sparse',
      rockDensity: 'dense'
    }
  },

  ruins: {
    id: 'ruins',
    name: 'Древние руины',
    subtitle: 'Разрушенные колонны, каменные алтари, мощеные плиты, забытая магия',
    ground: {
      base: '#ded8c6',
      baseHex: 0xded8c6,
      tint: '#ccc4ad',
      grass: '#a2b37c',
      grassDark: '#758850',
      dirt: '#b9a580',
      highlight: '#ebe6d7',
      shadow: '#617240'
    },
    water: {
      shallow: '#8bc0b9',
      deep: '#4c8780',
      bank: '#6aa39c',
      foam: '#d2ece8'
    },
    road: {
      fill: '#b8a994',
      stroke: '#6a5b48',
      dash: '#8a7964'
    },
    trees: {
      type: 'deciduous',
      foliage: ['#5e8248', '#466732', '#729559'],
      stroke: '#223616',
      shadow: 'rgba(20, 35, 15, 0.28)',
      trunk: '#503c2b'
    },
    fields: {
      crop: '#9faf78',
      furrow: '#71834a',
      border: '#546333'
    },
    rocks: {
      fill: '#a8a495',
      stroke: '#4a463a',
      hatch: '#666152'
    },
    building: {
      wall: '#3a362f',
      floor: '#c2baa7',
      planks: '#9e9683',
      roof: '#5c5443'
    },
    atmosphere: 'dusk',
    defaultToggles: {
      hasHouse: false,
      hasRiver: false,
      hasRoad: false,
      hasFields: false,
      hasRuins: true,
      hasCamp: false,
      treeDensity: 'normal',
      rockDensity: 'dense'
    }
  },

  cabin: {
    id: 'cabin',
    name: 'Одинокая хижина / Усадьба',
    subtitle: 'Уютный сруб в лесу, камин, дровница, колодец, забор и крыльцо',
    ground: {
      base: '#e3deca',
      baseHex: 0xe3deca,
      tint: '#d1c9ad',
      grass: '#afc086',
      grassDark: '#839b59',
      dirt: '#c9b288',
      highlight: '#eae6d6',
      shadow: '#6e8549'
    },
    water: {
      shallow: '#95c6c0',
      deep: '#53938f',
      bank: '#74a4a0',
      foam: '#d8eee9'
    },
    road: {
      fill: '#ceb68e',
      stroke: '#7b6341',
      dash: '#9a805a'
    },
    trees: {
      type: 'deciduous',
      foliage: ['#698c4d', '#4f7234', '#7d9f5e'],
      stroke: '#273c17',
      shadow: 'rgba(25, 45, 15, 0.25)',
      trunk: '#564230'
    },
    fields: {
      crop: '#b8c983',
      furrow: '#8b9e54',
      border: '#6a7d3c'
    },
    rocks: {
      fill: '#bcbaac',
      stroke: '#545246',
      hatch: '#726f61'
    },
    building: {
      wall: '#3e2f21',
      floor: '#ddcaa6',
      planks: '#ba9e74',
      roof: '#7a4e32'
    },
    atmosphere: 'day',
    defaultToggles: {
      hasHouse: true,
      hasRiver: true,
      hasRoad: true,
      hasFields: true,
      hasRuins: false,
      hasCamp: false,
      treeDensity: 'dense',
      rockDensity: 'sparse'
    }
  },

  camp: {
    id: 'camp',
    name: 'Лагерь разбойников / Стоянка',
    subtitle: 'Палатки, центральный костер, ящики с добычей, дозорная вышка',
    ground: {
      base: '#e0dac3',
      baseHex: 0xe0dac3,
      tint: '#cec7a9',
      grass: '#a9bc7e',
      grassDark: '#7d9451',
      dirt: '#c4ab7e',
      highlight: '#eae5d2',
      shadow: '#697e42'
    },
    water: {
      shallow: '#92c3bd',
      deep: '#508f8c',
      bank: '#71a19d',
      foam: '#d5ece7'
    },
    road: {
      fill: '#c8ad81',
      stroke: '#745936',
      dash: '#93754e'
    },
    trees: {
      type: 'deciduous',
      foliage: ['#668a4a', '#4c6f31', '#7a9e5b'],
      stroke: '#253a16',
      shadow: 'rgba(25, 40, 15, 0.26)',
      trunk: '#54402e'
    },
    fields: {
      crop: '#b0c27b',
      furrow: '#83964c',
      border: '#627434'
    },
    rocks: {
      fill: '#b8b4a5',
      stroke: '#504d41',
      hatch: '#6e695b'
    },
    building: {
      wall: '#403223',
      floor: '#d6c29b',
      planks: '#b3986c',
      roof: '#734b30'
    },
    atmosphere: 'night',
    defaultToggles: {
      hasHouse: false,
      hasRiver: false,
      hasRoad: true,
      hasFields: false,
      hasRuins: false,
      hasCamp: true,
      treeDensity: 'normal',
      rockDensity: 'normal'
    }
  },

  cave: {
    id: 'cave',
    name: 'Пещеры и Грот',
    subtitle: 'Естественные каменные туннели, подземные залы, развилки, извилистые ходы и сталагмиты',
    ground: {
      base: '#1e1e24',
      baseHex: 0x1e1e24,
      tint: '#18181b',
      grass: '#334155',
      grassDark: '#1e293b',
      dirt: '#27272a',
      highlight: '#3f3f46',
      shadow: '#09090b'
    },
    water: {
      shallow: '#0891b2',
      deep: '#0e7490',
      bank: '#155e75',
      foam: '#67e8f9'
    },
    road: {
      fill: '#3f3f46',
      stroke: '#18181b',
      dash: '#27272a'
    },
    trees: {
      type: 'crystal',
      foliage: ['#0284c7', '#0369a1', '#0d9488', '#0f766e'],
      stroke: '#082f49',
      shadow: 'rgba(0, 0, 0, 0.5)',
      trunk: '#334155'
    },
    fields: {
      crop: '#1e293b',
      furrow: '#0f172a',
      border: '#020617'
    },
    rocks: {
      fill: '#3f3f46',
      stroke: '#09090b',
      hatch: '#27272a'
    },
    building: {
      wall: '#09090b',
      floor: '#27272a',
      planks: '#3f3f46',
      roof: '#18181b'
    },
    atmosphere: 'night',
    defaultToggles: {
      hasHouse: false,
      hasRiver: true,
      hasRoad: false,
      hasFields: false,
      hasRuins: false,
      hasCamp: false,
      treeDensity: 'none',
      rockDensity: 'dense'
    }
  },

  dungeon: {
    id: 'dungeon',
    name: 'Подземелье и Замок',
    subtitle: 'Каменные коридоры, кладка, тюремные камеры, развилки ходов и готические арки',
    ground: {
      base: '#27272a',
      baseHex: 0x27272a,
      tint: '#18181b',
      grass: '#3f3f46',
      grassDark: '#27272a',
      dirt: '#18181b',
      highlight: '#52525b',
      shadow: '#09090b'
    },
    water: {
      shallow: '#0284c7',
      deep: '#0369a1',
      bank: '#075985',
      foam: '#7dd3fc'
    },
    road: {
      fill: '#3f3f46',
      stroke: '#09090b',
      dash: '#27272a'
    },
    trees: {
      type: 'statue',
      foliage: ['#52525b', '#3f3f46', '#27272a'],
      stroke: '#09090b',
      shadow: 'rgba(0, 0, 0, 0.6)',
      trunk: '#18181b'
    },
    fields: {
      crop: '#27272a',
      furrow: '#18181b',
      border: '#09090b'
    },
    rocks: {
      fill: '#52525b',
      stroke: '#09090b',
      hatch: '#3f3f46'
    },
    building: {
      wall: '#09090b',
      floor: '#3f3f46',
      planks: '#52525b',
      roof: '#18181b'
    },
    atmosphere: 'dusk',
    defaultToggles: {
      hasHouse: false,
      hasRiver: false,
      hasRoad: false,
      hasFields: false,
      hasRuins: true,
      hasCamp: false,
      treeDensity: 'none',
      rockDensity: 'normal'
    }
  },

  archipelago: {
    id: 'archipelago',
    name: 'Морские острова / Архипелаг',
    subtitle: 'Белоснежные песчаные пляжи, лазурный океан, пальмы, рифы и обломки кораблекрушений',
    ground: {
      base: '#0284c7',
      baseHex: 0x0284c7,
      tint: '#0369a1',
      sand: '#fde047',
      sandDark: '#eab308',
      grass: '#22c55e',
      grassDark: '#15803d',
      dirt: '#ca8a04',
      highlight: '#7dd3fc',
      shadow: '#075985'
    },
    water: {
      shallow: '#38bdf8',
      deep: '#0284c7',
      bank: '#0284c7',
      foam: '#f0f9ff'
    },
    road: {
      fill: '#fef08a',
      stroke: '#ca8a04',
      dash: '#eab308'
    },
    trees: {
      type: 'palm',
      foliage: ['#22c55e', '#16a34a', '#15803d', '#4ade80'],
      stroke: '#14532d',
      shadow: 'rgba(7, 89, 133, 0.3)',
      trunk: '#a16207'
    },
    fields: {
      crop: '#fef08a',
      furrow: '#eab308',
      border: '#ca8a04'
    },
    rocks: {
      fill: '#94a3b8',
      stroke: '#334155',
      hatch: '#64748b'
    },
    building: {
      wall: '#78350f',
      floor: '#fef08a',
      planks: '#b45309',
      roof: '#d97706'
    },
    atmosphere: 'day',
    defaultToggles: {
      hasHouse: false,
      hasRiver: false,
      hasRoad: false,
      hasFields: false,
      hasRuins: false,
      hasCamp: true,
      treeDensity: 'sparse',
      rockDensity: 'normal'
    }
  },

  ship: {
    id: 'ship',
    name: 'Средневековый корабль / Борд',
    subtitle: 'Парусный галеон/каравелла на морских волнах: палуба, мачты, пушки, штурвал и абордажные трапы',
    ground: {
      base: '#0369a1',
      baseHex: 0x0369a1,
      tint: '#075985',
      grass: '#78350f',
      grassDark: '#451a03',
      dirt: '#b45309',
      highlight: '#38bdf8',
      shadow: '#0c4a6e'
    },
    water: {
      shallow: '#0284c7',
      deep: '#0369a1',
      bank: '#075985',
      foam: '#e0f2fe'
    },
    road: {
      fill: '#b45309',
      stroke: '#451a03',
      dash: '#78350f'
    },
    trees: {
      type: 'none',
      foliage: ['#78350f'],
      stroke: '#451a03',
      shadow: 'rgba(0, 0, 0, 0.4)',
      trunk: '#451a03'
    },
    fields: {
      crop: '#78350f',
      furrow: '#451a03',
      border: '#451a03'
    },
    rocks: {
      fill: '#334155',
      stroke: '#0f172a',
      hatch: '#1e293b'
    },
    building: {
      wall: '#451a03',
      floor: '#92400e',
      planks: '#b45309',
      roof: '#78350f'
    },
    atmosphere: 'day',
    defaultToggles: {
      hasHouse: false,
      hasRiver: false,
      hasRoad: false,
      hasFields: false,
      hasRuins: false,
      hasCamp: false,
      treeDensity: 'none',
      rockDensity: 'none'
    }
  },

  village: {
    id: 'village',
    name: 'Деревня / Селение',
    subtitle: 'Деревенские усадьбы, избы, кузницы, мельница, колодец, частокол и проселочные дороги',
    ground: {
      base: '#e3dfcc',
      baseHex: 0xe3dfcc,
      tint: '#d5cfaa',
      grass: '#b0c283',
      grassDark: '#859b57',
      dirt: '#caaf80',
      highlight: '#eee9d8',
      shadow: '#6e8243'
    },
    water: {
      shallow: '#8fc5c1',
      deep: '#4d8c8c',
      bank: '#6fa3a1',
      foam: '#d3ebe9'
    },
    road: {
      fill: '#caa873',
      stroke: '#735732',
      dash: '#94754a'
    },
    trees: {
      type: 'deciduous',
      foliage: ['#698c4d', '#4f7234', '#7d9f5e'],
      stroke: '#273c17',
      shadow: 'rgba(25, 45, 15, 0.25)',
      trunk: '#564230'
    },
    fields: {
      crop: '#b8c983',
      furrow: '#8b9e54',
      border: '#6a7d3c'
    },
    rocks: {
      fill: '#bcbaac',
      stroke: '#545246',
      hatch: '#726f61'
    },
    building: {
      wall: '#423121',
      floor: '#e5d1ac',
      planks: '#c2a87d',
      roof: '#805132'
    },
    atmosphere: 'day',
    defaultToggles: {
      hasHouse: true,
      hasRiver: false,
      hasRoad: true,
      hasFields: true,
      hasRuins: false,
      hasCamp: false,
      treeDensity: 'sparse',
      rockDensity: 'sparse'
    }
  },

  city: {
    id: 'city',
    name: 'Средневековый город',
    subtitle: 'Каменные улицы, торговые площади, ратуша, купеческие дома, мосты и фонтаны',
    ground: {
      base: '#d1ccc0',
      baseHex: 0xd1ccc0,
      tint: '#bebaae',
      grass: '#97a876',
      grassDark: '#6c7d4d',
      dirt: '#a39b8c',
      highlight: '#e3ded3',
      shadow: '#59554b'
    },
    water: {
      shallow: '#38bdf8',
      deep: '#0284c7',
      bank: '#1e293b',
      foam: '#e0f2fe'
    },
    road: {
      fill: '#a19a8a',
      stroke: '#423d33',
      dash: '#6b6354'
    },
    trees: {
      type: 'deciduous',
      foliage: ['#5b7a42', '#415a2e', '#6f9252'],
      stroke: '#203114',
      shadow: 'rgba(20, 30, 15, 0.28)',
      trunk: '#4a3a2a'
    },
    fields: {
      crop: '#a8b87c',
      furrow: '#7a8a53',
      border: '#5b6a38'
    },
    rocks: {
      fill: '#8e8a7e',
      stroke: '#38352e',
      hatch: '#5c584f'
    },
    building: {
      wall: '#27272a',
      floor: '#cbd5e1',
      planks: '#94a3b8',
      roof: '#475569'
    },
    atmosphere: 'day',
    defaultToggles: {
      hasHouse: true,
      hasRiver: false,
      hasRoad: true,
      hasFields: false,
      hasRuins: false,
      hasCamp: false,
      treeDensity: 'sparse',
      rockDensity: 'none'
    }
  }
};
