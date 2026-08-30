/**
 * Модуль генератора монстров бестиария (Bestiary Monster Engine)
 * Реализует математическую модель D&D 5e Combat Rating Scale от CR 0 (1/8) до CR 30
 * с автоматической балансировкой HP, AC, Attack Bonus, Save DC, DPR и генерацией полного статблока.
 */

import {
  MonsterStatBlock,
  MonsterSize,
  MonsterType,
  MonsterArchetype,
  AbilityScores,
  MonsterAction,
} from './types';

export interface BestiaryGenOptions {
  crValue?: number; // 0, 0.125 (1/8), 0.25 (1/4), 0.5 (1/2), 1..30
  cr?: string | number;
  type?: MonsterType;
  monsterType?: MonsterType;
  archetype?: MonsterArchetype;
  role?: string;
  size?: MonsterSize;
  isBoss?: boolean;
}

// Таблица базовых параметров по DMG для CR 0..30
const CR_TABLE: Record<
  number,
  {
    crStr: string;
    xp: number;
    prof: number;
    ac: number;
    hpMin: number;
    hpMax: number;
    hpAvg: number;
    attackBonus: number;
    dprMin: number;
    dprMax: number;
    saveDC: number;
  }
> = {
  0: { crStr: '0', xp: 10, prof: 2, ac: 12, hpMin: 1, hpMax: 6, hpAvg: 4, attackBonus: 3, dprMin: 0, dprMax: 1, saveDC: 12 },
  0.125: { crStr: '1/8', xp: 25, prof: 2, ac: 13, hpMin: 7, hpMax: 35, hpAvg: 18, attackBonus: 3, dprMin: 2, dprMax: 3, saveDC: 13 },
  0.25: { crStr: '1/4', xp: 50, prof: 2, ac: 13, hpMin: 36, hpMax: 49, hpAvg: 38, attackBonus: 3, dprMin: 4, dprMax: 5, saveDC: 13 },
  0.5: { crStr: '1/2', xp: 100, prof: 2, ac: 13, hpMin: 50, hpMax: 70, hpAvg: 55, attackBonus: 4, dprMin: 6, dprMax: 8, saveDC: 13 },
  1: { crStr: '1', xp: 200, prof: 2, ac: 13, hpMin: 71, hpMax: 85, hpAvg: 75, attackBonus: 4, dprMin: 9, dprMax: 14, saveDC: 13 },
  2: { crStr: '2', xp: 450, prof: 2, ac: 13, hpMin: 86, hpMax: 100, hpAvg: 90, attackBonus: 4, dprMin: 15, dprMax: 20, saveDC: 13 },
  3: { crStr: '3', xp: 700, prof: 2, ac: 13, hpMin: 101, hpMax: 115, hpAvg: 105, attackBonus: 5, dprMin: 21, dprMax: 26, saveDC: 13 },
  4: { crStr: '4', xp: 1100, prof: 2, ac: 14, hpMin: 116, hpMax: 130, hpAvg: 120, attackBonus: 5, dprMin: 27, dprMax: 32, saveDC: 14 },
  5: { crStr: '5', xp: 1800, prof: 3, ac: 15, hpMin: 131, hpMax: 145, hpAvg: 135, attackBonus: 6, dprMin: 33, dprMax: 38, saveDC: 15 },
  6: { crStr: '6', xp: 2300, prof: 3, ac: 15, hpMin: 146, hpMax: 160, hpAvg: 150, attackBonus: 6, dprMin: 39, dprMax: 44, saveDC: 15 },
  7: { crStr: '7', xp: 2900, prof: 3, ac: 15, hpMin: 161, hpMax: 175, hpAvg: 165, attackBonus: 6, dprMin: 45, dprMax: 50, saveDC: 15 },
  8: { crStr: '8', xp: 3900, prof: 3, ac: 16, hpMin: 176, hpMax: 190, hpAvg: 180, attackBonus: 7, dprMin: 51, dprMax: 56, saveDC: 16 },
  9: { crStr: '9', xp: 5000, prof: 4, ac: 16, hpMin: 191, hpMax: 205, hpAvg: 195, attackBonus: 7, dprMin: 57, dprMax: 62, saveDC: 16 },
  10: { crStr: '10', xp: 5900, prof: 4, ac: 17, hpMin: 206, hpMax: 220, hpAvg: 210, attackBonus: 7, dprMin: 63, dprMax: 68, saveDC: 16 },
  11: { crStr: '11', xp: 7200, prof: 4, ac: 17, hpMin: 221, hpMax: 235, hpAvg: 225, attackBonus: 8, dprMin: 69, dprMax: 74, saveDC: 17 },
  12: { crStr: '12', xp: 8400, prof: 4, ac: 17, hpMin: 236, hpMax: 250, hpAvg: 240, attackBonus: 8, dprMin: 75, dprMax: 80, saveDC: 17 },
  13: { crStr: '13', xp: 10000, prof: 5, ac: 18, hpMin: 251, hpMax: 265, hpAvg: 255, attackBonus: 8, dprMin: 81, dprMax: 86, saveDC: 18 },
  14: { crStr: '14', xp: 11500, prof: 5, ac: 18, hpMin: 266, hpMax: 280, hpAvg: 270, attackBonus: 8, dprMin: 87, dprMax: 92, saveDC: 18 },
  15: { crStr: '15', xp: 13000, prof: 5, ac: 18, hpMin: 281, hpMax: 295, hpAvg: 285, attackBonus: 8, dprMin: 93, dprMax: 98, saveDC: 18 },
  16: { crStr: '16', xp: 15000, prof: 5, ac: 18, hpMin: 296, hpMax: 310, hpAvg: 300, attackBonus: 9, dprMin: 99, dprMax: 104, saveDC: 18 },
  17: { crStr: '17', xp: 18000, prof: 6, ac: 19, hpMin: 311, hpMax: 325, hpAvg: 315, attackBonus: 10, dprMin: 105, dprMax: 110, saveDC: 19 },
  18: { crStr: '18', xp: 20000, prof: 6, ac: 19, hpMin: 326, hpMax: 340, hpAvg: 330, attackBonus: 10, dprMin: 111, dprMax: 116, saveDC: 19 },
  19: { crStr: '19', xp: 22000, prof: 6, ac: 19, hpMin: 341, hpMax: 355, hpAvg: 345, attackBonus: 10, dprMin: 117, dprMax: 122, saveDC: 19 },
  20: { crStr: '20', xp: 25000, prof: 6, ac: 19, hpMin: 356, hpMax: 400, hpAvg: 375, attackBonus: 10, dprMin: 123, dprMax: 140, saveDC: 19 },
  21: { crStr: '21', xp: 33000, prof: 7, ac: 19, hpMin: 401, hpMax: 445, hpAvg: 420, attackBonus: 11, dprMin: 141, dprMax: 158, saveDC: 20 },
  22: { crStr: '22', xp: 41000, prof: 7, ac: 19, hpMin: 446, hpMax: 490, hpAvg: 465, attackBonus: 11, dprMin: 159, dprMax: 176, saveDC: 20 },
  23: { crStr: '23', xp: 50000, prof: 7, ac: 19, hpMin: 491, hpMax: 535, hpAvg: 510, attackBonus: 11, dprMin: 177, dprMax: 194, saveDC: 20 },
  24: { crStr: '24', xp: 62000, prof: 7, ac: 19, hpMin: 536, hpMax: 580, hpAvg: 555, attackBonus: 12, dprMin: 195, dprMax: 212, saveDC: 21 },
  25: { crStr: '25', xp: 75000, prof: 8, ac: 19, hpMin: 581, hpMax: 625, hpAvg: 600, attackBonus: 12, dprMin: 213, dprMax: 230, saveDC: 21 },
  26: { crStr: '26', xp: 90000, prof: 8, ac: 19, hpMin: 626, hpMax: 670, hpAvg: 645, attackBonus: 12, dprMin: 231, dprMax: 248, saveDC: 21 },
  27: { crStr: '27', xp: 105000, prof: 8, ac: 19, hpMin: 671, hpMax: 715, hpAvg: 690, attackBonus: 13, dprMin: 249, dprMax: 266, saveDC: 22 },
  28: { crStr: '28', xp: 120000, prof: 8, ac: 19, hpMin: 716, hpMax: 760, hpAvg: 735, attackBonus: 13, dprMin: 267, dprMax: 284, saveDC: 22 },
  29: { crStr: '29', xp: 135000, prof: 9, ac: 19, hpMin: 761, hpMax: 805, hpAvg: 780, attackBonus: 13, dprMin: 285, dprMax: 302, saveDC: 22 },
  30: { crStr: '30', xp: 155000, prof: 9, ac: 22, hpMin: 806, hpMax: 950, hpAvg: 870, attackBonus: 14, dprMin: 303, dprMax: 330, saveDC: 23 },
};

export const CR_LIST: { value: number; label: string }[] = [
  { value: 0, label: 'CR 0 (10 XP)' },
  { value: 0.125, label: 'CR 1/8 (25 XP)' },
  { value: 0.25, label: 'CR 1/4 (50 XP)' },
  { value: 0.5, label: 'CR 1/2 (100 XP)' },
  { value: 1, label: 'CR 1 (200 XP)' },
  { value: 2, label: 'CR 2 (450 XP)' },
  { value: 3, label: 'CR 3 (700 XP)' },
  { value: 4, label: 'CR 4 (1,100 XP)' },
  { value: 5, label: 'CR 5 (1,800 XP)' },
  { value: 6, label: 'CR 6 (2,300 XP)' },
  { value: 7, label: 'CR 7 (2,900 XP)' },
  { value: 8, label: 'CR 8 (3,900 XP)' },
  { value: 9, label: 'CR 9 (5,000 XP)' },
  { value: 10, label: 'CR 10 (5,900 XP)' },
  { value: 11, label: 'CR 11 (7,200 XP)' },
  { value: 12, label: 'CR 12 (8,400 XP)' },
  { value: 13, label: 'CR 13 (10,000 XP)' },
  { value: 14, label: 'CR 14 (11,500 XP)' },
  { value: 15, label: 'CR 15 (13,000 XP)' },
  { value: 16, label: 'CR 16 (15,000 XP)' },
  { value: 17, label: 'CR 17 (18,000 XP)' },
  { value: 18, label: 'CR 18 (20,000 XP)' },
  { value: 19, label: 'CR 19 (22,000 XP)' },
  { value: 20, label: 'CR 20 (25,000 XP)' },
  { value: 21, label: 'CR 21 (33,000 XP)' },
  { value: 22, label: 'CR 22 (41,000 XP)' },
  { value: 23, label: 'CR 23 (50,000 XP)' },
  { value: 24, label: 'CR 24 (62,000 XP)' },
  { value: 25, label: 'CR 25 (75,000 XP)' },
  { value: 26, label: 'CR 26 (90,000 XP)' },
  { value: 27, label: 'CR 27 (105,000 XP)' },
  { value: 28, label: 'CR 28 (120,000 XP)' },
  { value: 29, label: 'CR 29 (135,000 XP)' },
  { value: 30, label: 'CR 30 (155,000 XP - Архидемоны/Боги)' },
];

const MONSTER_TYPES: MonsterType[] = [
  'Гуманоид',
  'Нежить',
  'Чудовище',
  'Дракон',
  'Аберрация',
  'Исчадие',
  'Фея',
  'Элементаль',
  'Растение',
  'Конструкт',
  'Великан',
  'Зверь',
];

const ARCHETYPES: MonsterArchetype[] = ['Брут', 'Застрельщик', 'Контролер', 'Танк'];

const SIZES: MonsterSize[] = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

const HIT_DICE_MAP: Record<MonsterSize, { die: number; dieName: string }> = {
  Tiny: { die: 4, dieName: 'd4' },
  Small: { die: 6, dieName: 'd6' },
  Medium: { die: 8, dieName: 'd8' },
  Large: { die: 10, dieName: 'd10' },
  Huge: { die: 12, dieName: 'd12' },
  Gargantuan: { die: 20, dieName: 'd20' },
};

const NAME_PREFIXES: Record<MonsterType, string[]> = {
  Гуманоид: ['Безжалостный', 'Отверженный', 'Кровавый', 'Теневой', 'Ветеран', 'Культист', 'Бродячий'],
  Нежить: ['Истлевший', 'Ледяной', 'Неупокоенный', 'Костяной', 'Чумной', 'Призрачный', 'Вампирический'],
  Чудовище: ['Клыкастый', 'Чешуйчатый', 'Хищный', 'Мутировавший', 'Пещерный', 'Ядовитый', 'Глубинный'],
  Дракон: ['Древний', 'Пепельный', 'Громовой', 'Обсидиановый', 'Лазурный', 'Изумрудный', 'Инфернальный'],
  Аберрация: ['Искривленный', 'Звездный', 'Щупальцевый', 'Пустотный', 'Безумный', 'Ментальный', 'Потусторонний'],
  Исчадие: ['Адский', 'Бездный', 'Сквернословный', 'Пламенный', 'Клятвопреступный', 'Рогатый', 'Серокрылый'],
  Фея: ['Сумеречный', 'Сияющий', 'Обманчивый', 'Мшистый', 'Лунноликий', 'Игольчатый', 'Шепчущий'],
  Элементаль: ['Раскаленный', 'Тектонический', 'Вихревой', 'Гидромантический', 'Штормовой', 'Магматический'],
  Растение: ['Терновый', 'Гнилостный', 'Хищный', 'Спороносный', 'Удушающий', 'Древесный', 'Ядовитый'],
  Конструкт: ['Рунный', 'Адамантиновый', 'Заводной', 'Грохочущий', 'Охранный', 'Шестеренчатый', 'Титанический'],
  Великан: ['Морозный', 'Холмовой', 'Огненный', 'Каменный', 'Буревой', 'Пещерный', 'Громогласный'],
  Зверь: ['Лютый', 'Пещерный', 'Саблезубый', 'Охотничий', 'Свирепый', 'Бронированный', 'Ночной'],
};

const NAME_NOUNS: Record<MonsterType, string[]> = {
  Гуманоид: ['Головорез', 'Ассасин', 'Мародер', 'Еретик', 'Гладиатор', 'Наемник', 'Застрельщик'],
  Нежить: ['Лич', 'Вурдалак', 'Скелет-рыцарь', 'Упырь', 'Мститель', 'Банши', 'Костяной голем'],
  Чудовище: ['Василиск', 'Химера', 'Мантикора', 'Грифон', 'Гидра', 'Бегемот', 'Пожиратель'],
  Дракон: ['Дракон', 'Виверна', 'Дрейк', 'Драколич', 'Змей Глубин', 'Вирм', 'Огнекрыл'],
  Аберрация: ['Наблюдатель', 'Истязатель разума', 'Осквернитель', 'Глаз пустоты', 'Щупальценосец', 'Ткач снов'],
  Исчадие: ['Демон', 'Дьявол', 'Балор', 'Инкуб', 'Костолом', 'Гончая преисподней', 'Повелитель мук'],
  Фея: ['Сатир', 'Дриада', 'Пикси-чародей', 'Страж дубравы', 'Зимний рыцарь', 'Эльфийский дух'],
  Элементаль: ['Мирмидонец', 'Элементаль', 'Аватар стихии', 'Пепельный дух', 'Громовой вождь'],
  Растение: ['Шамблинг маунд', 'Энт-скверноносец', 'Терновник', 'Плотоядный плющ', 'Грибной титан'],
  Конструкт: ['Голем', 'Автоматон', 'Железный страж', 'Хранитель склепа', 'Рунный колосс'],
  Великан: ['Джаггернаут', 'Крушитель скал', 'Буревестник', 'Дробитель костей', 'Титанид'],
  Зверь: ['Медведеволк', 'Лютоволк', 'Пещерный медведь', 'Исполинский паук', 'Грозный вепрь'],
};

function getRandom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function formatMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function generateMonsterStatBlock(options: BestiaryGenOptions = {}): MonsterStatBlock {
  // 1. Определение CR
  const crKeys = Object.keys(CR_TABLE).map(Number).sort((a, b) => a - b);
  let crValue: number;
  if (options.crValue !== undefined) {
    crValue = options.crValue;
  } else if (options.cr !== undefined) {
    if (typeof options.cr === 'string') {
      if (options.cr === '1/8') crValue = 0.125;
      else if (options.cr === '1/4') crValue = 0.25;
      else if (options.cr === '1/2') crValue = 0.5;
      else crValue = parseFloat(options.cr) || 1;
    } else {
      crValue = options.cr;
    }
  } else {
    crValue = getRandom(crKeys);
  }
  const crData = CR_TABLE[crValue] || CR_TABLE[1] || {
    crStr: `${crValue}`,
    xp: Math.round(crValue * 200),
    prof: Math.min(9, 2 + Math.floor(crValue / 4)),
    ac: Math.min(22, 13 + Math.floor(crValue / 3)),
    hpMin: 50,
    hpMax: 100,
    hpAvg: Math.max(10, Math.round(crValue * 30)),
    attackBonus: Math.min(14, 3 + Math.floor(crValue / 3)),
    dprMin: 10,
    dprMax: 20,
    saveDC: Math.min(23, 12 + Math.floor(crValue / 3)),
  };

  // 2. Тип, Архетип, Размер
  const type = options.type || options.monsterType || getRandom(MONSTER_TYPES);
  let archetype = options.archetype;
  if (!archetype && options.role) {
    if (options.role.includes('Танк') || options.role.includes('Громила')) archetype = 'Брут';
    else if (options.role.includes('Застрельщик') || options.role.includes('Ловкач')) archetype = 'Застрельщик';
    else if (options.role.includes('Заклинатель') || options.role.includes('Контролер')) archetype = 'Контролер';
    else archetype = 'Брут';
  }
  if (!archetype) archetype = getRandom(ARCHETYPES);
  
  let defaultSize: MonsterSize = 'Medium';
  if (type === 'Великан' || type === 'Дракон') {
    defaultSize = crValue >= 17 ? 'Gargantuan' : crValue >= 8 ? 'Huge' : 'Large';
  } else if (type === 'Конструкт' || type === 'Чудовище') {
    defaultSize = crValue >= 10 ? 'Huge' : crValue >= 4 ? 'Large' : 'Medium';
  } else if (type === 'Зверь') {
    defaultSize = crValue >= 6 ? 'Huge' : crValue >= 2 ? 'Large' : 'Medium';
  }
  const size = options.size || defaultSize;

  const isBoss = options.isBoss !== undefined ? options.isBoss : (crValue >= 10 || (crValue >= 5 && Math.random() < 0.35));

  // 3. Балансировка характеристик (STR, DEX, CON, INT, WIS, CHA) с учетом Архетипа и CR
  let baseScore = Math.min(30, 10 + Math.floor(crValue * 0.5));
  let str = 10;
  let dex = 10;
  let con = 10 + Math.floor(crValue * 0.4);
  let int = 8 + Math.floor(crValue * 0.2);
  let wis = 10 + Math.floor(crValue * 0.3);
  let cha = 8 + Math.floor(crValue * 0.3);

  switch (archetype) {
    case 'Брут':
      str = Math.min(30, baseScore + 4);
      dex = Math.max(8, 10 + Math.floor(crValue * 0.2));
      con = Math.min(30, con + 4);
      int = Math.max(6, int - 2);
      break;
    case 'Застрельщик':
      dex = Math.min(30, baseScore + 5);
      str = Math.max(8, 10 + Math.floor(crValue * 0.2));
      con = Math.min(24, con + 1);
      wis = Math.min(26, wis + 2);
      break;
    case 'Контролер':
      int = Math.min(30, baseScore + 4);
      wis = Math.min(30, baseScore + 3);
      cha = Math.min(30, baseScore + 2);
      str = Math.max(8, 10);
      dex = Math.min(20, 12 + Math.floor(crValue * 0.2));
      break;
    case 'Танк':
      con = Math.min(30, baseScore + 5);
      str = Math.min(28, baseScore + 2);
      dex = Math.max(8, 10);
      break;
  }

  const abilities: AbilityScores = {
    str: Math.max(1, str),
    dex: Math.max(1, dex),
    con: Math.max(1, con),
    int: Math.max(1, int),
    wis: Math.max(1, wis),
    cha: Math.max(1, cha),
  };

  const conMod = getMod(abilities.con);
  const strMod = getMod(abilities.str);
  const dexMod = getMod(abilities.dex);

  // 4. Оборонительный CR: Расчет AC и HP
  let ac = crData.ac;
  let acType = 'природный доспех';

  if (archetype === 'Танк') {
    ac += 2;
    acType = 'утяжеленный панцирь и щит';
  } else if (archetype === 'Застрельщик') {
    ac = Math.max(ac, 10 + dexMod + (crValue > 5 ? 2 : 1));
    acType = 'ловкость и легкая броня';
  } else if (archetype === 'Брут') {
    ac = Math.max(11, ac - 1);
  }

  // Расчет HP по размеру кости хитов
  const dieInfo = HIT_DICE_MAP[size];
  const avgDieVal = (dieInfo.die + 1) / 2;

  let targetHp = crData.hpAvg;
  if (archetype === 'Брут') targetHp = Math.round(targetHp * 1.25);
  if (archetype === 'Застрельщик') targetHp = Math.round(targetHp * 0.85);
  if (isBoss) targetHp = Math.round(targetHp * 1.2);

  // Количество костей хитов: numDice * (avgDieVal + conMod) ≈ targetHp
  const effectivePerDie = Math.max(1, avgDieVal + conMod);
  const numDice = Math.max(1, Math.round(targetHp / effectivePerDie));
  const hp = Math.max(1, Math.floor(numDice * avgDieVal + numDice * conMod));
  const hitDice = `${numDice}${dieInfo.dieName}${conMod !== 0 ? ` + ${numDice * conMod}` : ''}`;

  // 5. Скорость
  let speed = '30 фт.';
  if (archetype === 'Застрельщик') speed = '40 фт., лазание 30 фт.';
  if (type === 'Дракон') speed = '40 фт., полет 80 фт., плавание 40 фт.';
  if (type === 'Исчадие' && crValue >= 8) speed = '30 фт., полет 60 фт.';
  if (type === 'Элементаль') speed = '30 фт., полет 60 фт. (парение) или рытье 30 фт.';
  if (type === 'Аберрация') speed = '30 фт., левитация 30 фт.';

  // 6. Имя монстра
  const prefix = getRandom(NAME_PREFIXES[type] || ['Древний', 'Теневой', 'Свирепый']);
  const noun = getRandom(NAME_NOUNS[type] || ['Страж', 'Хищник', 'Владыка']);
  const bossSuffix = isBoss && crValue >= 10 ? ' (Легендарный Босс)' : '';
  const name = `${prefix} ${noun}${bossSuffix}`;

  // 7. Спасброски и Навыки
  const prof = crData.prof;
  const savingThrowsList: string[] = [];
  if (archetype === 'Брут' || archetype === 'Танк') {
    savingThrowsList.push(`Сил ${formatMod(strMod + prof)}`, `Тел ${formatMod(conMod + prof)}`);
  }
  if (archetype === 'Застрельщик') {
    savingThrowsList.push(`Лов ${formatMod(dexMod + prof)}`, `Муд ${formatMod(getMod(abilities.wis) + prof)}`);
  }
  if (archetype === 'Контролер') {
    savingThrowsList.push(`Инт ${formatMod(getMod(abilities.int) + prof)}`, `Муд ${formatMod(getMod(abilities.wis) + prof)}`);
  }
  if (crValue >= 15) {
    savingThrowsList.push(`Хар ${formatMod(getMod(abilities.cha) + prof)}`);
  }

  // 8. Черты (Traits)
  const traits: { name: string; description: string }[] = [];

  if (isBoss) {
    traits.push({
      name: 'Легендарное сопротивление (3/день)',
      description: 'Если существо проваливает спасбросок, оно может вместо этого выбрать успех.',
    });
  }

  if (archetype === 'Брут') {
    traits.push({
      name: 'Неистовая сила',
      description: 'Атаки оружием ближнего боя наносят одну дополнительную кость урона (уже учтено). При критическом ударе цель сбивается с ног.',
    });
  } else if (archetype === 'Застрельщик') {
    traits.push({
      name: 'Юркое ускользание',
      description: 'Существо может в каждый свой ход бонусным действием совершать Засаду или Отход. Перемещение не провоцирует атак, если цель атакована.',
    });
  } else if (archetype === 'Контролер') {
    traits.push({
      name: 'Искажение разума (Аура 15 фт.)',
      description: `Враги в радиусе 15 фт. совершают броски атаки с помехой, если не преуспеют в спасброске Мудрости DC ${crData.saveDC}.`,
    });
  } else if (archetype === 'Танк') {
    traits.push({
      name: 'Непоколебимая стойка',
      description: 'Существо имеет преимущество на спасброски против сбивания с ног, захвата и эффектов выталкивания.',
    });
  }

  // 9. Атакующий CR: Действия (Actions) и Мультиатака
  const actions: MonsterAction[] = [];
  const targetDpr = Math.max(1, Math.round((crData.dprMin + crData.dprMax) / 2));
  const atkBonus = crData.attackBonus;
  const saveDC = crData.saveDC;

  let attacksCount = 1;
  if (crValue >= 17) attacksCount = 4;
  else if (crValue >= 11) attacksCount = 3;
  else if (crValue >= 5) attacksCount = 2;

  const dprPerAttack = Math.max(2, Math.round(targetDpr / attacksCount));

  // Вычисление формулы костей урона
  const mainStatMod = archetype === 'Застрельщик' ? dexMod : strMod;
  const rawDiceDamage = Math.max(1, dprPerAttack - mainStatMod);
  const d6Count = Math.max(1, Math.round(rawDiceDamage / 3.5));

  if (attacksCount > 1) {
    actions.push({
      name: 'Мультиатака',
      type: 'action',
      description: `Существо совершает ${attacksCount} атаки: ${attacksCount >= 3 ? 'две когтями и одну укусом/оружием' : 'две атаки оружием или когтями'}.`,
    });
  }

  // Основная атака ближнего боя
  const meleeName = type === 'Зверь' || type === 'Дракон' || type === 'Чудовище' ? 'Укус и рассекающие когти' : 'Сокрушительный удар';
  actions.push({
    name: meleeName,
    type: 'action',
    attackBonus: atkBonus,
    damageFormula: `${d6Count}d6 + ${mainStatMod}`,
    description: `Рукопашная атака оружием: ${formatMod(atkBonus)} к попаданию, досягаемость ${size === 'Huge' || size === 'Gargantuan' ? '15' : '5'} фт., одна цель. Попадание: ${Math.max(1, Math.round(d6Count * 3.5 + mainStatMod))} (${d6Count}d6 + ${mainStatMod}) дробящего/колющего урона.`,
  });

  // Вторичное действие (Захват, Яд или Дистанционная атака)
  if (archetype === 'Застрельщик' || type === 'Гуманоид') {
    actions.push({
      name: 'Выстрел из зачарованного лука / Метательные шипы',
      type: 'action',
      attackBonus: atkBonus,
      damageFormula: `${d6Count}d8 + ${dexMod}`,
      description: `Дальнобойная атака оружием: ${formatMod(atkBonus)} к попаданию, дистанция 80/320 фт., одна цель. Попадание: ${Math.max(1, Math.round(d6Count * 4.5 + dexMod))} (${d6Count}d8 + ${dexMod}) колющего урона плюс 2d6 урона ядом.`,
    });
  } else if (type === 'Дракон' || type === 'Исчадие' || type === 'Элементаль' || crValue >= 5) {
    const breathDice = Math.max(3, Math.round(crValue * 1.5));
    const breathDamageAvg = Math.round(breathDice * 3.5);
    actions.push({
      name: 'Разрушительное дыхание / Стихийный взрыв (Перезарядка 5–6)',
      type: 'action',
      saveDC: saveDC,
      saveType: 'Ловкость или Телосложение',
      description: `Существо извергает стихийную волну в конусе 30 фт. или линии 60 фт. Каждое существо в зоне должно совершить спасбросок Ловкости DC ${saveDC}, получая ${breathDamageAvg} (${breathDice}d6) урона огнем/холодом/кислотой при провале, или половину этого урона при успехе.`,
    });
  } else if (archetype === 'Брут' || type === 'Чудовище') {
    actions.push({
      name: 'Удушающий захват и сокрушение',
      type: 'action',
      saveDC: saveDC,
      saveType: 'Сила',
      description: `При успешном попадании цель становится схваченной (DC высвобождения ${saveDC}). Пока цель схвачена, она опутана, и существо не может захватывать другую цель. В начале каждого своего хода цель получает ${d6Count}d6 дробящего урона.`,
    });
  }

  // 10. Легендарные действия (Legendary Actions)
  let legendaryActions;
  if (isBoss) {
    legendaryActions = {
      countPerRound: 3,
      description: 'Существо может совершить 3 легендарных действия на выбор в конце хода другого существа. Восстанавливается 3 очка в начале каждого своего хода.',
      actions: [
        {
          name: 'Смещение без провокации (1 очко)',
          cost: 1,
          description: 'Существо перемещается на расстояние до своей половины скорости, не провоцируя атак.',
        },
        {
          name: 'Внезапный удар когтем/хвостом (1 очко)',
          cost: 1,
          description: `Существо совершает одну базовую атаку ближнего боя (${formatMod(atkBonus)} к попаданию).`,
        },
        {
          name: 'Устрашающее присутствие / Рев владыки (2 очка)',
          cost: 2,
          description: `Каждое существо по выбору в пределах 60 фт. должно преуспеть в спасброске Мудрости DC ${saveDC}, иначе станет испуганным на 1 минуту.`,
        },
      ],
    };
  }

  return {
    name,
    cr: crData.crStr,
    crValue,
    xp: crData.xp,
    size,
    type,
    archetype,
    alignment: getRandom(['Законопослушный злой', 'Хаотичный злой', 'Нейтральный злой', 'Неитральный', 'Хаотичный нейтральный']),
    ac,
    acType,
    hp,
    hitDice,
    speed,
    abilities,
    profBonus: prof,
    savingThrows: savingThrowsList.join(', ') || undefined,
    skills: `Внимательность +${getMod(abilities.wis) + prof}, Скрытность +${dexMod + prof}`,
    damageResistances: crValue >= 5 ? 'дробящий, колющий и рубящий от немагических атак' : undefined,
    damageImmunities: crValue >= 13 ? 'яд, огонь или холод' : undefined,
    conditionImmunities: crValue >= 10 ? 'очарование, испуг, отравление' : undefined,
    senses: 'темное зрение 120 фт., пассивная Внимательность ' + (10 + getMod(abilities.wis) + prof),
    languages: type === 'Зверь' ? '—' : 'Общий, Бездны, Драконий или Инфернальный',
    traits,
    actions,
    legendaryActions,
    tactics: `В бою держится согласно роли [${archetype}]: фокусит уязвимых заклинателей, использует окружение и контрольные дебаффы DC ${saveDC}.`,
  };
}
