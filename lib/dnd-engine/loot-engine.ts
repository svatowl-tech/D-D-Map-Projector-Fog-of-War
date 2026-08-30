/**
 * Модуль генератора лута и сокровищ (Loot & Treasure Engine)
 * Ранжируется строго по 4 тирам игры (Tier 1..Tier 4),
 * поддерживает индивидуальный лут и сокровищницы (Loot Hoards),
 * таблицы драгоценных камней (10-5000 GP), предметов искусства и магии A-I.
 */

import { LootTier, LootMode, LootResult, CoinLoot, GemItem, ArtItem, MagicItem } from './types';

// Таблицы самоцветов по стоимости (D&D 5e)
const GEMS_10_GP = ['Агат', 'Лазурит', 'Малахит', 'Обсидиан', 'Розовый кварц', 'Бирюза', 'Тигровый глаз', 'Гематит'];
const GEMS_50_GP = ['Хризопраз', 'Яшма', 'Лунный камень', 'Оникс', 'Циркон', 'Халцедон', 'Сардоникс', 'Кровавик'];
const GEMS_100_GP = ['Янтарь', 'Аметист', 'Хризоберилл', 'Коралл', 'Гранат', 'Нефрит', 'Жемчуг (белый)', 'Шпинель'];
const GEMS_500_GP = ['Александрит', 'Черный жемчуг', 'Топаз', 'Аквамарин', 'Синий шпинель', 'Перидот'];
const GEMS_1000_5000_GP = ['Бриллиант', 'Изумруд', 'Сапфир', 'Рубин', 'Звездчатый сапфир', 'Черный опал', 'Огненный опал'];

// Таблицы предметов искусства
const ART_25_GP = [
  'Серебряный кубок с гравировкой виноградной лозы',
  'Шелковый расшитый платок с серебряной каймой',
  'Резная костяная статуэтка крылатого коня',
  'Маленькое бронзовое зеркальце в оправе из слоновой кости',
  'Медный сосуд для благовоний с тонкой чеканкой',
];

const ART_250_GP = [
  'Золотое кольцо с филигранью и мелким гранатом',
  'Серебряная резная шкатулка с бархатной подкладкой',
  'Шелковый гобелен с гербом древнего рыцарского ордена',
  'Церемониальный кинжал с рукоятью из полированной слоновой кости',
  'Серебряный кувшин для вина с позолоченным орнаментом',
];

const ART_750_GP = [
  'Золотая чаша с инкрустацией из изумрудных осколков',
  'Шелковый парадный гобелен с изображением великой битвы богов',
  'Изящная золотая арфа с серебряными струнами',
  'Драгоценный серебряный кубок на ножке из темного янтаря',
];

const ART_2500_GP = [
  'Золотая корона с рубинами и сапфирами древнего монарха',
  'Драгоценная мантия первосвященника, расшитая золотом и жемчугом',
  'Золотой оклад древней книги с крупными бриллиантами',
  'Платиновый церемониальный скипетр с пылающим топазом',
];

const TRINKETS = [
  'Игральные кости, выточенные из сустава виверны (всегда выпадает череп на шестерке)',
  'Запечатанное сургучом письмо на непонятном древнем наречии',
  'Сломанный латунный компас, стрелка которого всегда указывает на ближайшую нежить',
  'Стеклянный флакон, внутри которого клубится крошечное грозовое облако',
  'Медная монета с двумя одинаковыми сторонами «Орел»',
  'Окаменевшее яйцо неизвестного пернатого ящера',
  'Крошечный механический жук, который иногда шевелит лапками при свете луны',
  'Кусочек ткани от знамени давно забытого легиона',
  'Засушенная лапка черного ворона на серебряной цепочке',
  'Старый железный ключ, покрытый незасыхающей копотью',
];

// Магические предметы по тирам (Tables A-I)
const MAGIC_TIER_1: MagicItem[] = [
  { name: 'Зелье лечения (2d4 + 2)', rarity: 'Обычный', type: 'Зелье', requiresAttunement: false, description: 'Восстанавливает 2d4 + 2 хитов.' },
  { name: 'Свиток заклинания 1 круга', rarity: 'Обычный', type: 'Свиток', requiresAttunement: false, description: 'Содержит случайное заклинание 1 круга.' },
  { name: 'Зелье восхождения', rarity: 'Обычный', type: 'Зелье', requiresAttunement: false, description: 'Дарует скорость лазания, равную скорости ходьбы, на 1 час.' },
  { name: 'Мешок для хранения (Bag of Holding)', rarity: 'Необычный', type: 'Чудесный предмет', requiresAttunement: false, description: 'Вмещает до 500 фунтов объемом до 64 куб. футов.' },
  { name: 'Оружие +1', rarity: 'Необычный', type: 'Оружие', requiresAttunement: false, description: '+1 к броскам атаки и урона этим магическим оружием.' },
  { name: 'Сапоги эльфийского вида', rarity: 'Необычный', type: 'Чудесный предмет', requiresAttunement: false, description: 'Преимущество на проверки Скрытности, связанные с бесшумным передвижением.' },
];

const MAGIC_TIER_2: MagicItem[] = [
  { name: 'Большое зелье лечения (4d4 + 4)', rarity: 'Необычный', type: 'Зелье', requiresAttunement: false, description: 'Восстанавливает 4d4 + 4 хитов.' },
  { name: 'Плащ защиты', rarity: 'Необычный', type: 'Чудесный предмет', requiresAttunement: true, description: '+1 к КД и спасброскам.' },
  { name: 'Оружие +2', rarity: 'Редкий', type: 'Оружие', requiresAttunement: false, description: '+2 к атакам и урону.' },
  { name: 'Огненный кинжал (Flame Tongue)', rarity: 'Редкий', type: 'Оружие', requiresAttunement: true, description: 'Бонусным действием вспыхивает пламенем, нанося +2d6 огненного урона.' },
  { name: 'Кольцо защиты от магии', rarity: 'Редкий', type: 'Кольцо', requiresAttunement: true, description: 'Преимущество на спасброски против заклинаний.' },
  { name: 'Жезл огненных шаров', rarity: 'Редкий', type: 'Жезл', requiresAttunement: true, description: 'Имеет 7 зарядов для сотворения Огненного шара (DC 15).' },
];

const MAGIC_TIER_3: MagicItem[] = [
  { name: 'Превосходное зелье лечения (8d4 + 8)', rarity: 'Редкий', type: 'Зелье', requiresAttunement: false, description: 'Восстанавливает 8d4 + 8 хитов.' },
  { name: 'Доспех +2', rarity: 'Очень редкий', type: 'Доспех', requiresAttunement: false, description: '+2 к КД носителя.' },
  { name: 'Меч мороза (Frost Brand)', rarity: 'Очень редкий', type: 'Оружие', requiresAttunement: true, description: '+1d6 урона холодом, сопротивление к огню.' },
  { name: 'Амулет здоровья', rarity: 'Редкий', type: 'Чудесный предмет', requiresAttunement: true, description: 'Устанавливает значение Телосложения носителя равным 19.' },
  { name: 'Пояс силы морозного великана', rarity: 'Очень редкий', type: 'Чудесный предмет', requiresAttunement: true, description: 'Устанавливает значение Силы равным 23.' },
  { name: 'Свиток заклинания 7 круга', rarity: 'Очень редкий', type: 'Свиток', requiresAttunement: false, description: 'Содержит мощное высокоуровневое заклинание.' },
];

const MAGIC_TIER_4: MagicItem[] = [
  { name: 'Высшее зелье лечения (10d4 + 20)', rarity: 'Очень редкий', type: 'Зелье', requiresAttunement: false, description: 'Восстанавливает 10d4 + 20 хитов.' },
  { name: 'Оружие +3 (Легендарное)', rarity: 'Очень редкий', type: 'Оружие', requiresAttunement: false, description: '+3 к атаке и урону.' },
  { name: 'Кольцо исполнения трех желаний (Ring of Three Wishes)', rarity: 'Легендарный', type: 'Кольцо', requiresAttunement: true, description: 'Содержит 3 заряда заклинания Исполнение Желаний (Wish).' },
  { name: 'Святой каратель (Holy Avenger)', rarity: 'Легендарный', type: 'Оружие', requiresAttunement: true, description: '+3 к атаке, +2d10 по нежити/исчадиям, аура преимущества на спасброски.' },
  { name: 'Одеяние архимага', rarity: 'Легендарный', type: 'Чудесный предмет', requiresAttunement: true, description: 'Базовый КД 15 + DEX, +2 к DC заклинаний и броскам атаки заклинаниями.' },
  { name: 'Сфера всевластия стихий', rarity: 'Легендарный', type: 'Артефакт', requiresAttunement: true, description: 'Дарует подчинение элементалям и защиту от стихийного хаоса.' },
];

function rollDice(count: number, sides: number): number {
  let sum = 0;
  for (let i = 0; i < count; i++) {
    sum += Math.floor(Math.random() * sides) + 1;
  }
  return sum;
}

function getRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateLoot(tier: LootTier, mode: LootMode): LootResult {
  const coins: CoinLoot = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, totalGpEquivalent: 0 };
  let trinkets: string[] | undefined;
  let gems: GemItem[] | undefined;
  let artObjects: ArtItem[] | undefined;
  let magicItems: MagicItem[] | undefined;
  let containerDesc: string | undefined;
  let trappedDesc: string | undefined;

  if (mode === 'individual') {
    // Индивидуальный лут (карманы врагов)
    switch (tier) {
      case 'Tier 1 (1-4 ур.)':
        coins.cp = rollDice(4, 6) * 10;
        coins.sp = rollDice(3, 6);
        coins.gp = rollDice(1, 6);
        break;
      case 'Tier 2 (5-10 ур.)':
        coins.sp = rollDice(4, 6) * 10;
        coins.gp = rollDice(2, 6) * 10;
        coins.pp = Math.random() < 0.3 ? rollDice(1, 4) : 0;
        break;
      case 'Tier 3 (11-16 ур.)':
        coins.gp = rollDice(4, 6) * 100;
        coins.pp = rollDice(1, 6) * 10;
        break;
      case 'Tier 4 (17-20 ур.)':
        coins.gp = rollDice(8, 6) * 100;
        coins.pp = rollDice(3, 6) * 100;
        break;
    }

    if (Math.random() < 0.6) {
      trinkets = [getRandom(TRINKETS)];
    }
  } else {
    // Сокровищница (Loot Hoards)
    containerDesc = getRandom([
      'Кованый дубовый сундук с замком из темного железа, украшенный гравировкой драконьих когтей.',
      'Тайная каменная ниша за барельефом горгульи, покрытая слоем древней паутины.',
      'Изящный ларец из красного дерева с латунными уголками и магической печатью.',
      'Груда золота и костей на каменном возвышении в логове чудовища.',
    ]);

    if (Math.random() < 0.35) {
      trappedDesc = getRandom([
        'Ядовитые иглы в замочной скважине (DC 14 Внимательность / Спасбросок Телосложения DC 13 или 3d6 урона ядом).',
        'Магическая руна взрыва (DC 15 Магия / 4d8 урона огнем в радиусе 15 фт., спасбросок Ловкости DC 15 на половину).',
        'Удушающий сонный газ при вскрытии крышки (спасбросок Телосложения DC 14 или усыпление на 1 час).',
      ]);
    }

    switch (tier) {
      case 'Tier 1 (1-4 ур.)':
        coins.cp = rollDice(6, 6) * 100;
        coins.sp = rollDice(3, 6) * 100;
        coins.gp = rollDice(2, 6) * 10;
        gems = [
          { name: getRandom(GEMS_10_GP), valueGp: 10, count: rollDice(2, 4) },
          { name: getRandom(GEMS_50_GP), valueGp: 50, count: rollDice(1, 3) },
        ];
        if (Math.random() < 0.5) {
          artObjects = [{ name: getRandom(ART_25_GP), valueGp: 25, count: rollDice(1, 3), description: 'Изящный предмет работы мастера' }];
        }
        magicItems = [getRandom(MAGIC_TIER_1)];
        if (Math.random() < 0.4) magicItems.push(getRandom(MAGIC_TIER_1));
        break;

      case 'Tier 2 (5-10 ур.)':
        coins.cp = rollDice(2, 6) * 100;
        coins.sp = rollDice(2, 6) * 1000;
        coins.gp = rollDice(6, 6) * 100;
        coins.pp = rollDice(3, 6) * 10;
        gems = [
          { name: getRandom(GEMS_50_GP), valueGp: 50, count: rollDice(3, 6) },
          { name: getRandom(GEMS_100_GP), valueGp: 100, count: rollDice(2, 4) },
        ];
        artObjects = [{ name: getRandom(ART_250_GP), valueGp: 250, count: rollDice(1, 4), description: 'Ценное ремесленное изделие' }];
        magicItems = [getRandom(MAGIC_TIER_2), getRandom(MAGIC_TIER_1)];
        if (Math.random() < 0.5) magicItems.push(getRandom(MAGIC_TIER_2));
        break;

      case 'Tier 3 (11-16 ур.)':
        coins.gp = rollDice(4, 6) * 1000;
        coins.pp = rollDice(5, 6) * 100;
        gems = [
          { name: getRandom(GEMS_500_GP), valueGp: 500, count: rollDice(3, 6) },
          { name: getRandom(GEMS_1000_5000_GP), valueGp: 1000, count: rollDice(1, 4) },
        ];
        artObjects = [{ name: getRandom(ART_750_GP), valueGp: 750, count: rollDice(1, 3), description: 'Великолепное королевское сокровище' }];
        magicItems = [getRandom(MAGIC_TIER_3), getRandom(MAGIC_TIER_2)];
        if (Math.random() < 0.6) magicItems.push(getRandom(MAGIC_TIER_3));
        break;

      case 'Tier 4 (17-20 ур.)':
        coins.gp = rollDice(12, 6) * 1000;
        coins.pp = rollDice(8, 6) * 1000;
        gems = [
          { name: getRandom(GEMS_1000_5000_GP), valueGp: 2500, count: rollDice(4, 6) },
        ];
        artObjects = [{ name: getRandom(ART_2500_GP), valueGp: 2500, count: rollDice(2, 4), description: 'Легендарное произведение ювелирного искусства' }];
        magicItems = [getRandom(MAGIC_TIER_4), getRandom(MAGIC_TIER_3), getRandom(MAGIC_TIER_3)];
        break;
    }
  }

  // Расчет GP эквивалента
  coins.totalGpEquivalent = Math.round(coins.cp * 0.01 + coins.sp * 0.1 + coins.ep * 0.5 + coins.gp + coins.pp * 10);

  return {
    tier,
    mode,
    sourceContext: mode === 'individual' ? `Индивидуальные карманы существа (${tier})` : `Сокровищница подземелья / Логово босса (${tier})`,
    coins,
    trinkets,
    gems,
    artObjects,
    magicItems,
    containerDescription: containerDesc,
    trapped: trappedDesc,
  };
}
