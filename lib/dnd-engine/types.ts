/**
 * Типы данных для модульной системы процедурной генерации D&D 5e
 * (Bestiary, Social NPCs, Loot, Wandering Merchants, City Stores, Equipment Affixes, Magic Engine, Reference Hub)
 */

export type DndEngineType =
  | 'bestiary'
  | 'npc'
  | 'loot'
  | 'merchants'
  | 'stores'
  | 'equipment'
  | 'magic'
  | 'reference'
  | 'monster'
  | 'merchant'
  | 'store'
  | 'spell'
  | 'spellbook'
  | 'wildmagic'
  | string;

// --- 1. Bestiary Monster Engine ---
export type MonsterSize = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
export type MonsterType =
  | 'Гуманоид'
  | 'Нежить'
  | 'Чудовище'
  | 'Дракон'
  | 'Аберрация'
  | 'Исчадие'
  | 'Фея'
  | 'Элементаль'
  | 'Растение'
  | 'Конструкт'
  | 'Великан'
  | 'Зверь';

export type MonsterArchetype = 'Брут' | 'Застрельщик' | 'Контролер' | 'Танк';

export interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface MonsterAction {
  name: string;
  type: 'action' | 'bonus' | 'reaction' | 'legendary';
  description: string;
  attackBonus?: number;
  damageFormula?: string;
  saveDC?: number;
  saveType?: string;
}

export interface MonsterStatBlock {
  name: string;
  cr: string;
  crValue: number;
  xp: number;
  size: MonsterSize;
  type: MonsterType;
  subtype?: string;
  archetype: MonsterArchetype;
  alignment: string;
  ac: number;
  acType: string;
  hp: number;
  hitDice: string;
  hitDiceFormula?: string;
  speed: string;
  abilities: AbilityScores;
  profBonus: number;
  savingThrows?: string;
  skills?: string;
  damageResistances?: string;
  damageImmunities?: string;
  conditionImmunities?: string;
  senses: string;
  languages: string;
  traits: { name: string; description: string }[];
  actions: MonsterAction[];
  legendaryActions?: {
    countPerRound: number;
    description: string;
    actions: { name: string; cost: number; description: string }[];
  };
  tactics: string;
}

// --- 2. Social NPC Engine ---
export interface SocialNPC {
  name: string;
  gender: 'Мужской' | 'Женский' | 'Андрогинный';
  race: string;
  age: string;
  occupation: string;
  socialClass: string;
  appearance: {
    features: string;
    clothing: string;
    mannerism: string;
    speechQuirk: string;
  };
  alignment: string;
  ideal: string;
  bond: string;
  flaw: string;
  disposition: 'Враждебный' | 'Настороженный' | 'Нейтральный' | 'Дружелюбный';
  charismaCheckSecret: {
    skill: 'Убеждение' | 'Запугивание' | 'Обман';
    dc: number;
    secret: string;
  };
  rumorOrHook: string;
  dialogueQuote: string;
}

// --- 3. Loot & Treasure Engine ---
export type LootTier = 'Tier 1 (1-4 ур.)' | 'Tier 2 (5-10 ур.)' | 'Tier 3 (11-16 ур.)' | 'Tier 4 (17-20 ур.)';
export type LootMode = 'individual' | 'hoard';

export interface CoinLoot {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
  totalGpEquivalent: number;
}

export interface GemItem {
  name: string;
  valueGp: number;
  count: number;
  description?: string;
}

export interface ArtItem {
  name: string;
  valueGp: number;
  count: number;
  description: string;
}

export interface MagicItem {
  name: string;
  rarity: 'Обычный' | 'Необычный' | 'Редкий' | 'Очень редкий' | 'Легендарный' | 'Артефакт';
  type: string;
  tableLetter?: string;
  requiresAttunement: boolean;
  description: string;
}

export interface LootResult {
  tier: LootTier;
  mode: LootMode;
  sourceContext: string;
  coins: CoinLoot;
  trinkets?: string[];
  gems?: GemItem[];
  artObjects?: ArtItem[];
  magicItems?: MagicItem[];
  containerDescription?: string;
  trapped?: string;
}

// --- 4. Wandering Merchants ---
export type MerchantType =
  | 'Караванщик-кочевник'
  | 'Скупщик краденого / Контрабандист'
  | 'Таинственный бродячий алхимик'
  | 'Гоблин-старьевщик';

export interface MerchantGoodsItem {
  name: string;
  category: string;
  price: string;
  priceRawGp: number;
  rarity?: string;
  description: string;
  isSpecial?: boolean;
}

export interface WanderingMerchant {
  name: string;
  type: MerchantType;
  race: string;
  appearance: string;
  disposition: string;
  escort: string;
  availableGoldGp: number;
  priceMultiplier: number;
  encounterEvent: string;
  dialogueGreeting: string;
  inventory: MerchantGoodsItem[];
  secretOffer?: string;
}

// --- 5. City Stores & Markets ---
export type SettlementSize = 'Деревня / Село' | 'Городок' | 'Торговый мегаполис';
export type StoreType =
  | 'Кузница и Оружейная'
  | 'Алхимическая лавка и Травник'
  | 'Магическая лавка / Башня чародея'
  | 'Храм и Часовня'
  | 'Таверна и Лавка провизии';

export interface StoreService {
  name: string;
  price: string;
  description: string;
}

export interface CityStore {
  name: string;
  storeType: StoreType;
  settlementSize: SettlementSize;
  ownerName: string;
  ownerPersonality: string;
  atmosphere: string;
  priceModifierPercent: number; // -20% до +50%
  inventory: MerchantGoodsItem[];
  services: StoreService[];
  rumor: string;
}

// --- 6. Equipment & Affix System ---
export interface EquipmentItem {
  fullName: string;
  baseItem: string;
  itemCategory: 'Оружие ближнего боя' | 'Оружие дальнего боя' | 'Доспех' | 'Щит' | 'Аксессуар';
  qualityPrefix: {
    name: string;
    material: string;
    materialEffect: string;
  };
  enchantmentSuffix: {
    name: string;
    effect: string;
    damageBonus?: string;
  };
  bonusProperties: string[];
  rarity: 'Обычный' | 'Необычный' | 'Редкий' | 'Очень редкий' | 'Легендарный';
  damageOrAC: string;
  propertiesList: string[];
  weight: string;
  estimatedPriceGp: number;
  loreDescription: string;
}

// --- 7. Magic, Spells & Wild Magic ---
export type SpellSchool =
  | 'Воплощение (Evocation)'
  | 'Ограждение (Abjuration)'
  | 'Иллюзия (Illusion)'
  | 'Некромантия (Necromancy)'
  | 'Очарование (Enchantment)'
  | 'Преобразование (Transmutation)'
  | 'Прорицание (Divination)'
  | 'Вызов (Conjuration)';

export interface CustomSpell {
  name: string;
  level: number;
  school: SpellSchool;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  targetArea: string;
  saveOrAttack: string;
  damageOrEffect: string;
  description: string;
  higherLevels?: string;
  ancientCreator: string;
}

export interface SpellbookItem {
  title: string;
  appearance: {
    cover: string;
    binding: string;
    ink: string;
    quirk: string;
  };
  valueGp: number;
  spells: {
    level: number;
    name: string;
    school: string;
  }[];
  secretTrapOrCurse?: string;
}

export interface WildMagicSurge {
  d100Roll: number;
  effect: string;
  visualTag: string;
  category: 'Хаос' | 'Бафф' | 'Дебафф' | 'Юмор' | 'Трансформация' | 'Стихия';
}

// --- Карточка кампании (Campaign Card) ---
export interface CampaignCard {
  id: string;
  type?: DndEngineType;
  engineType?: DndEngineType;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string; // hex or tailwind class
  summary?: string;
  summaryMarkdown?: string;
  data:
    | MonsterStatBlock
    | SocialNPC
    | LootResult
    | WanderingMerchant
    | CityStore
    | EquipmentItem
    | CustomSpell
    | SpellbookItem
    | WildMagicSurge
    | any;
  pinnedOnTable?: boolean;
  tablePos?: { x: number; y: number };
  isMinimized?: boolean;
  isPublicToPlayers?: boolean;
  createdAt?: number;
  timestamp?: number;
}
