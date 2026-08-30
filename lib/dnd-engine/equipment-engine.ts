/**
 * Модуль генератора экипировки и оружия (Equipment & Affix System)
 * Генерирует предметы по формуле [Префикс качества/материала] + [Базовый предмет] + [Суффикс зачарования]
 * с точными свойствами материалов (Адамантин, Мифрил, Хладное железо, Древесина темного железа) и аффиксов (Keen, Balanced, Serrated и др.).
 */

import { EquipmentItem } from './types';

interface BaseItemDef {
  name: string;
  category: 'Оружие ближнего боя' | 'Оружие дальнего боя' | 'Доспех' | 'Щит' | 'Аксессуар';
  damageOrAC: string;
  defaultWeight: string;
  basePriceGp: number;
  properties: string[];
}

const BASE_ITEMS: BaseItemDef[] = [
  { name: 'Двуручный меч (Greatsword)', category: 'Оружие ближнего боя', damageOrAC: '2d6 рубящий', defaultWeight: '6 фнт.', basePriceGp: 50, properties: ['Двуручное', 'Тяжелое'] },
  { name: 'Длинный меч (Longsword)', category: 'Оружие ближнего боя', damageOrAC: '1d8 рубящий', defaultWeight: '3 фнт.', basePriceGp: 15, properties: ['Универсальное (1d10)'] },
  { name: 'Рапира (Rapier)', category: 'Оружие ближнего боя', damageOrAC: '1d8 колющий', defaultWeight: '2 фнт.', basePriceGp: 25, properties: ['Фехтовальное'] },
  { name: 'Боевой топор (Battleaxe)', category: 'Оружие ближнего боя', damageOrAC: '1d8 рубящий', defaultWeight: '4 фнт.', basePriceGp: 10, properties: ['Универсальное (1d10)'] },
  { name: 'Кинжал (Dagger)', category: 'Оружие ближнего боя', damageOrAC: '1d4 колющий', defaultWeight: '1 фнт.', basePriceGp: 2, properties: ['Фехтовальное', 'Легкое', 'Метательное (20/60)'] },
  { name: 'Боевой молот (Warhammer)', category: 'Оружие ближнего боя', damageOrAC: '1d8 дробящий', defaultWeight: '2 фнт.', basePriceGp: 15, properties: ['Универсальное (1d10)'] },
  { name: 'Длинный лук (Longbow)', category: 'Оружие дальнего боя', damageOrAC: '1d8 колющий', defaultWeight: '2 фнт.', basePriceGp: 50, properties: ['Боеприпасы (150/600)', 'Тяжелое', 'Двуручное'] },
  { name: 'Тяжелый арбалет (Heavy Crossbow)', category: 'Оружие дальнего боя', damageOrAC: '1d10 колющий', defaultWeight: '18 фнт.', basePriceGp: 50, properties: ['Боеприпасы (100/400)', 'Тяжелое', 'Перезарядка'] },
  { name: 'Латный доспех (Full Plate)', category: 'Доспех', damageOrAC: 'AC 18', defaultWeight: '65 фнт.', basePriceGp: 1500, properties: ['Тяжелый доспех', 'Сил 15', 'Помеха на Скрытность'] },
  { name: 'Кольчуга (Chain Mail)', category: 'Доспех', damageOrAC: 'AC 16', defaultWeight: '55 фнт.', basePriceGp: 75, properties: ['Тяжелый доспех', 'Сил 13', 'Помеха на Скрытность'] },
  { name: 'Кираса (Breastplate)', category: 'Доспех', damageOrAC: 'AC 14 + DEX (макс +2)', defaultWeight: '20 фнт.', basePriceGp: 400, properties: ['Средний доспех', 'Без помехи на Скрытность'] },
  { name: 'Кожаный доспех с шипами (Studded Leather)', category: 'Доспех', damageOrAC: 'AC 12 + DEX', defaultWeight: '13 фнт.', basePriceGp: 45, properties: ['Легкий доспех'] },
  { name: 'Большой каплевидный щит (Kite Shield)', category: 'Щит', damageOrAC: '+2 AC', defaultWeight: '6 фнт.', basePriceGp: 10, properties: ['Щит (+2 к КД)'] },
];

const MATERIALS = [
  {
    name: 'Адамантиновый',
    material: 'Адамантин',
    effect: 'Автоматические критические удары по объектам и конструкциям. Броня полностью блокирует входящие критические удары (превращает их в обычные).',
    priceMultiplier: 3.5,
    rarity: 'Редкий' as const,
  },
  {
    name: 'Мифриловый',
    material: 'Мифрил',
    effect: 'Уменьшает вес вдвое. Снимает штраф и помеху на Скрытность для средних и тяжелых доспехов. Оружие получает свойство «Легкое».',
    priceMultiplier: 2.8,
    rarity: 'Необычный' as const,
  },
  {
    name: 'из Хладного железа',
    material: 'Хладное железо',
    effect: 'Наносит дополнительно 1d6 урона по феям, демонам и нежити. Пробивает их природное сопротивление.',
    priceMultiplier: 2.2,
    rarity: 'Необычный' as const,
  },
  {
    name: 'из Древесины темного железа',
    material: 'Темное железо',
    effect: 'Сверхлегкая древесина. Увеличивает дистанцию стрельбы луков на +30/+60 фт. и дает +1 к урону дальнего боя.',
    priceMultiplier: 2.4,
    rarity: 'Необычный' as const,
  },
  {
    name: 'Закаленный дамасский',
    material: 'Дамасская сталь',
    effect: 'Повышенная прочность лезвия, устойчивость к коррозии и кислоте.',
    priceMultiplier: 1.5,
    rarity: 'Обычный' as const,
  },
];

const PREFIX_PROPERTIES = [
  { name: 'Острое (Keen)', effect: 'Критический диапазон удара расширен до 19–20 на d20.' },
  { name: 'Балансированное (Balanced)', effect: '+1 к проверкам инициативы владельца при экипировке.' },
  { name: 'Зазубренное (Serrated)', effect: 'Накладывает эффект кровотечения (1d4 рубящего урона в начале каждого хода цели до перевязки).' },
  { name: 'Пронзающее (Piercing)', effect: 'Игнорирует 2 пункта КД от естественной брони или щита цели.' },
  { name: 'Укрепленное (Reinforced Plates)', effect: '+1 к КД против дистанционных немагических атак.' },
];

const SUFFIX_ENCHANTMENTS = [
  { name: 'Вечного Пламени', effect: 'Оружие охвачено ревущим огнем (+1d6 урона огнем при каждом попадании). Освещает 20 фт.', damageBonus: '+1d6 Огонь', rarity: 'Редкий' as const },
  { name: 'Ледяного Могильника', effect: 'Клинок источает морозный пар (+1d6 урона холодом, снижает скорость цели на 10 фт. на 1 раунд).', damageBonus: '+1d6 Холод', rarity: 'Редкий' as const },
  { name: 'Громового Раската', effect: 'При ударе раздается гром (+1d6 урона громом, спасбросок Силы DC 13 или цель отброшена на 10 фт.).', damageBonus: '+1d6 Гром', rarity: 'Редкий' as const },
  { name: 'Вампиризма и Жажды Крови', effect: 'При нанесении критического удара владелец восстанавливает хиты в размере 1d6 + модификатор атаки.', damageBonus: 'Вампиризм', rarity: 'Очень редкий' as const },
  { name: 'Святого Сияния', effect: '+1d8 лучистого урона по нежити и исчадиям. В темноте испускает мягкий золотой свет на 15 фт.', damageBonus: '+1d8 Лучистый', rarity: 'Редкий' as const },
  { name: 'Теневого Шага', effect: 'Дарует носителю способность один раз в день совершить телепортацию на 30 фт. в область тени (Бонусное действие).', rarity: 'Редкий' as const },
  { name: 'Стража Предков', effect: 'Дарует сопротивление урону от яда и преимущество на спасброски против очарования.', rarity: 'Необычный' as const },
];

function getRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateAffixEquipment(): EquipmentItem {
  const base = getRandom(BASE_ITEMS);
  const material = getRandom(MATERIALS);
  const prefixProp = getRandom(PREFIX_PROPERTIES);
  const suffix = getRandom(SUFFIX_ENCHANTMENTS);

  // Формула названия: [Префикс качества/материала] + [Базовый предмет] + [Суффикс зачарования]
  const fullName = `${prefixProp.name.split(' ')[0]} ${material.name} ${base.name.split(' (')[0]} ${suffix.name}`;

  const bonusProperties: string[] = [
    material.effect,
    prefixProp.effect,
    suffix.effect,
  ];

  let calculatedPrice = Math.round(base.basePriceGp * material.priceMultiplier + 350);
  if (suffix.rarity === 'Очень редкий') calculatedPrice += 2000;
  else if (suffix.rarity === 'Редкий') calculatedPrice += 600;

  return {
    fullName,
    baseItem: base.name,
    itemCategory: base.category,
    qualityPrefix: {
      name: prefixProp.name,
      material: material.material,
      materialEffect: material.effect,
    },
    enchantmentSuffix: {
      name: suffix.name,
      effect: suffix.effect,
      damageBonus: suffix.damageBonus,
    },
    bonusProperties,
    rarity: suffix.rarity || material.rarity || 'Редкий',
    damageOrAC: base.damageOrAC + (suffix.damageBonus ? ` (плюс ${suffix.damageBonus})` : ''),
    propertiesList: [...base.properties, prefixProp.name.split(' ')[0]],
    weight: material.material === 'Мифрил' ? `${parseFloat(base.defaultWeight) / 2} фнт.` : base.defaultWeight,
    estimatedPriceGp: calculatedPrice,
    loreDescription: `Создано древними мастерами с использованием редкого сплава [${material.material}]. Предмет пульсирует энергией зачарования [${suffix.name}].`,
  };
}
