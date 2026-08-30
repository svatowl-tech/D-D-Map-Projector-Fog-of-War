'use client';

import React, { useState } from 'react';
import {
  CampaignCard,
  MonsterStatBlock,
  SocialNPC,
  LootResult,
  WanderingMerchant,
  CityStore,
  EquipmentItem,
  CustomSpell,
  SpellbookItem,
  WildMagicSurge,
  LootTier,
  LootMode,
  MerchantType,
  StoreType,
  SettlementSize,
} from '../../lib/dnd-engine/types';
import { generateMonsterStatBlock, CR_LIST } from '../../lib/dnd-engine/bestiary-engine';
import { generateSocialNPC } from '../../lib/dnd-engine/npc-engine';
import { generateLoot } from '../../lib/dnd-engine/loot-engine';
import { generateWanderingMerchant } from '../../lib/dnd-engine/merchant-engine';
import { generateCityStore } from '../../lib/dnd-engine/store-engine';
import { generateAffixEquipment } from '../../lib/dnd-engine/equipment-engine';
import { generateCustomSpell, generateSpellbook, rollWildMagicSurge } from '../../lib/dnd-engine/magic-engine';
import { QUICK_REFERENCE_ITEMS, ReferenceItem } from '../../lib/dnd-engine/quick-reference-data';
import { CampaignCardView } from './CampaignCardView';
import {
  Skull,
  Users,
  Coins,
  Compass,
  Store,
  Swords,
  Wand2,
  BookOpen,
  Sparkles,
  Pin,
  Eye,
  RefreshCw,
  Search,
  Check,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface CampaignGeneratorSuiteProps {
  initialTab?: string;
  pinnedCards?: CampaignCard[];
  pinnedCardIds?: string[];
  projectedCard?: CampaignCard | null;
  projectedCardId?: string;
  onPinCard: (card: CampaignCard) => void;
  onUnpinCard: (cardId: string) => void;
  onProjectCard: (card: CampaignCard | null) => void;
  onExportCardToTable?: (card: CampaignCard) => void;
}

type GeneratorTab =
  | 'bestiary'
  | 'npc'
  | 'loot'
  | 'merchants'
  | 'stores'
  | 'equipment'
  | 'magic'
  | 'reference';

export function CampaignGeneratorSuite({
  initialTab = 'bestiary',
  pinnedCards = [],
  pinnedCardIds = [],
  projectedCard = null,
  projectedCardId,
  onPinCard,
  onUnpinCard,
  onProjectCard,
}: CampaignGeneratorSuiteProps) {
  const [activeTab, setActiveTab] = useState<GeneratorTab>(
    (initialTab as GeneratorTab) || 'bestiary'
  );

  // Generator history & active preview
  const [activeCard, setActiveCard] = useState<CampaignCard | null>(null);
  const [recentCards, setRecentCards] = useState<CampaignCard[]>([]);

  // Bestiary filters
  const [bestiaryCr, setBestiaryCr] = useState<string>('3');
  const [bestiaryType, setBestiaryType] = useState<string>('Любой');
  const [bestiaryRole, setBestiaryRole] = useState<'Громила / Танк' | 'Застрельщик / Ловкач' | 'Заклинатель' | 'Лидер / Босс'>('Громила / Танк');

  // NPC filters
  const [npcClass, setNpcClass] = useState<string>('Случайный');

  // Loot filters
  const [lootTier, setLootTier] = useState<LootTier>('Tier 2 (5-10 ур.)');
  const [lootMode, setLootMode] = useState<LootMode>('hoard');

  // Merchant filters
  const [merchantType, setMerchantType] = useState<MerchantType | 'Случайный'>('Случайный');

  // Store filters
  const [storeType, setStoreType] = useState<StoreType | 'Случайный'>('Кузница и Оружейная');
  const [storeSettlement, setStoreSettlement] = useState<SettlementSize>('Городок');

  // Magic filters
  const [spellLevel, setSpellLevel] = useState<number>(3);

  // Quick Reference search filter
  const [refSearch, setRefSearch] = useState<string>('');
  const [refCategory, setRefCategory] = useState<string>('Все');

  // Helper to push card to active & recent
  const registerCard = (card: CampaignCard) => {
    setActiveCard(card);
    setRecentCards((prev) => [card, ...prev.filter((c) => c.id !== card.id)].slice(0, 20));
  };

  // --- Handlers ---
  const handleGenerateMonster = () => {
    const statBlock = generateMonsterStatBlock({
      cr: bestiaryCr,
      monsterType: bestiaryType === 'Любой' ? undefined : (bestiaryType as any),
      role: bestiaryRole,
    });
    const card: CampaignCard = {
      id: `card-monster-${Date.now()}`,
      type: 'monster',
      title: statBlock.name,
      summary: `CR ${statBlock.cr} • HP ${statBlock.hp} • AC ${statBlock.ac}`,
      data: statBlock,
      timestamp: Date.now(),
    };
    registerCard(card);
  };

  const handleGenerateNPC = () => {
    const npc = generateSocialNPC(npcClass === 'Случайный' ? undefined : npcClass);
    const card: CampaignCard = {
      id: `card-npc-${Date.now()}`,
      type: 'npc',
      title: npc.name,
      summary: `${npc.race} • ${npc.occupation} (${npc.alignment})`,
      data: npc,
      timestamp: Date.now(),
    };
    registerCard(card);
  };

  const handleGenerateLoot = () => {
    const loot = generateLoot(lootTier, lootMode);
    const card: CampaignCard = {
      id: `card-loot-${Date.now()}`,
      type: 'loot',
      title: lootMode === 'individual' ? `Карманный лут (${lootTier})` : `Сокровищница (${lootTier})`,
      summary: `Всего: ≈ ${loot.coins.totalGpEquivalent} GP • ${loot.magicItems?.length || 0} маг. предметов`,
      data: loot,
      timestamp: Date.now(),
    };
    registerCard(card);
  };

  const handleGenerateMerchant = () => {
    const merchant = generateWanderingMerchant(merchantType === 'Случайный' ? undefined : merchantType);
    const card: CampaignCard = {
      id: `card-merchant-${Date.now()}`,
      type: 'merchant',
      title: `${merchant.name} (${merchant.type})`,
      summary: `Казна: ${merchant.availableGoldGp} GP • Товаров: ${merchant.inventory.length}`,
      data: merchant,
      timestamp: Date.now(),
    };
    registerCard(card);
  };

  const handleGenerateStore = () => {
    const store = generateCityStore(storeType === 'Случайный' ? undefined : storeType, storeSettlement);
    const card: CampaignCard = {
      id: `card-store-${Date.now()}`,
      type: 'store',
      title: `${store.name} — ${store.storeType}`,
      summary: `${store.settlementSize} • Владелец: ${store.ownerName}`,
      data: store,
      timestamp: Date.now(),
    };
    registerCard(card);
  };

  const handleGenerateEquipment = () => {
    const eq = generateAffixEquipment();
    const card: CampaignCard = {
      id: `card-eq-${Date.now()}`,
      type: 'equipment',
      title: eq.fullName,
      summary: `${eq.damageOrAC} • ${eq.rarity} (${eq.estimatedPriceGp} GP)`,
      data: eq,
      timestamp: Date.now(),
    };
    registerCard(card);
  };

  const handleGenerateSpell = () => {
    const spell = generateCustomSpell(spellLevel);
    const card: CampaignCard = {
      id: `card-spell-${Date.now()}`,
      type: 'spell',
      title: spell.name,
      summary: `Круг ${spell.level} • ${spell.school} • ${spell.damageOrEffect}`,
      data: spell,
      timestamp: Date.now(),
    };
    registerCard(card);
  };

  const handleGenerateSpellbook = () => {
    const book = generateSpellbook();
    const card: CampaignCard = {
      id: `card-book-${Date.now()}`,
      type: 'spellbook',
      title: book.title,
      summary: `${book.spells.length} заклинаний • Ценность: ${book.valueGp} GP`,
      data: book,
      timestamp: Date.now(),
    };
    registerCard(card);
  };

  const handleRollWildMagic = () => {
    const wm = rollWildMagicSurge();
    const card: CampaignCard = {
      id: `card-wm-${Date.now()}`,
      type: 'wildmagic',
      title: `Дикая Магия [d100 = ${wm.d100Roll}]`,
      summary: `${wm.visualTag} (${wm.category})`,
      data: wm,
      timestamp: Date.now(),
    };
    registerCard(card);
  };

  const handleTogglePin = (card: CampaignCard) => {
    const isPinned = pinnedCards.some((c) => c.id === card.id);
    if (isPinned) {
      onUnpinCard(card.id);
    } else {
      onPinCard(card);
    }
  };

  const handleToggleProject = (card: CampaignCard) => {
    if (projectedCard && projectedCard.id === card.id) {
      onProjectCard(null);
    } else {
      onProjectCard(card);
    }
  };

  const handleDeleteCard = (cardId: string) => {
    setRecentCards((prev) => prev.filter((c) => c.id !== cardId));
    if (activeCard && activeCard.id === cardId) {
      setActiveCard(null);
    }
    onUnpinCard(cardId);
    if (projectedCard && projectedCard.id === cardId) {
      onProjectCard(null);
    }
  };

  // Filtered reference items
  const filteredRefItems = QUICK_REFERENCE_ITEMS.filter((item) => {
    const matchesCategory = refCategory === 'Все' || item.category === refCategory;
    const matchesSearch =
      !refSearch ||
      item.title.toLowerCase().includes(refSearch.toLowerCase()) ||
      item.summary.toLowerCase().includes(refSearch.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(refSearch.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-200 overflow-hidden select-none">
      {/* Top Generator Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-2 bg-neutral-900 border-b border-neutral-800 overflow-x-auto scrollbar-none shrink-0">
        <button
          onClick={() => setActiveTab('bestiary')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'bestiary'
              ? 'bg-red-950/80 text-red-300 border border-red-800/80 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
          }`}
        >
          <Skull className="w-3.5 h-3.5 text-red-400" />
          Монстры (CR 0-30)
        </button>

        <button
          onClick={() => setActiveTab('npc')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'npc'
              ? 'bg-sky-950/80 text-sky-300 border border-sky-800/80 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-sky-400" />
          Социальные NPC
        </button>

        <button
          onClick={() => setActiveTab('loot')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'loot'
              ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
          }`}
        >
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          Лут и Сокровища
        </button>

        <button
          onClick={() => setActiveTab('merchants')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'merchants'
              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
          }`}
        >
          <Compass className="w-3.5 h-3.5 text-emerald-400" />
          Странствующие купцы
        </button>

        <button
          onClick={() => setActiveTab('stores')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'stores'
              ? 'bg-teal-950/80 text-teal-300 border border-teal-800/80 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
          }`}
        >
          <Store className="w-3.5 h-3.5 text-teal-400" />
          Городские лавки
        </button>

        <button
          onClick={() => setActiveTab('equipment')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'equipment'
              ? 'bg-purple-950/80 text-purple-300 border border-purple-800/80 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
          }`}
        >
          <Swords className="w-3.5 h-3.5 text-purple-400" />
          Экипировка
        </button>

        <button
          onClick={() => setActiveTab('magic')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'magic'
              ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/80 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
          }`}
        >
          <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
          Магия и Хаос
        </button>

        <button
          onClick={() => setActiveTab('reference')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'reference'
              ? 'bg-neutral-800 text-amber-300 border border-amber-500/60 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
          Справочник мастера
        </button>
      </div>

      {/* Main Split Layout: Left Controls / Center Card Preview / Right Pinned & History */}
      <div className="grid grid-cols-12 gap-0 flex-1 overflow-hidden">
        {/* Left Column: Generator Controls (4 cols) */}
        <div className="col-span-12 md:col-span-4 bg-neutral-900/60 border-r border-neutral-800 p-3 overflow-y-auto flex flex-col justify-between">
          <div className="space-y-3.5">
            {/* BESTIARY TAB */}
            {activeTab === 'bestiary' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                  <Skull className="w-4 h-4" /> Генератор Бестиария (CR 0–30)
                </div>

                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Уровень Опасности (CR):</label>
                  <select
                    value={bestiaryCr}
                    onChange={(e) => setBestiaryCr(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-red-500 font-mono"
                  >
                    {CR_LIST.map((cr) => (
                      <option key={cr.value} value={cr.value}>
                        {cr.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Тип существа:</label>
                  <select
                    value={bestiaryType}
                    onChange={(e) => setBestiaryType(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-red-500"
                  >
                    <option value="Любой">Случайный (любой тип)</option>
                    <option value="Гуманоид">Гуманоид (Бандит, Варвар, Страж)</option>
                    <option value="Нежить">Нежить (Скелет, Упырь, Лич)</option>
                    <option value="Исчадие">Исчадие (Демон, Дьявол)</option>
                    <option value="Дракон">Дракон (Хроматический / Металлический)</option>
                    <option value="Чудовище">Чудовище (Мантикора, Василиск)</option>
                    <option value="Элементаль">Элементаль (Огонь, Вода, Земля, Воздух)</option>
                    <option value="Аберрация">Аберрация (Пожиратель разума, Злобоглаз)</option>
                    <option value="Конструкция">Конструкция (Голем, Автоматон)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Боевой архетип:</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['Громила / Танк', 'Застрельщик / Ловкач', 'Заклинатель', 'Лидер / Босс'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setBestiaryRole(r)}
                        className={`px-2 py-1.5 rounded text-[11px] border font-medium text-left transition-colors ${
                          bestiaryRole === r
                            ? 'bg-red-950/80 border-red-700 text-red-300'
                            : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  id="btn-gen-monster"
                  onClick={handleGenerateMonster}
                  className="w-full mt-2 py-2 px-3 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.98]"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Сгенерировать Монстра
                </button>
              </div>
            )}

            {/* NPC TAB */}
            {activeTab === 'npc' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> Генератор Социальных NPC
                </div>

                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Социальный класс / Роль:</label>
                  <select
                    value={npcClass}
                    onChange={(e) => setNpcClass(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="Случайный">Случайный класс</option>
                    <option value="Нищий">Нищий / Информатор</option>
                    <option value="Ремесленник">Ремесленник / Мастер</option>
                    <option value="Стражник">Стражник / Дозорный</option>
                    <option value="Дворянин">Дворянин / Аристократ</option>
                    <option value="Наемник">Наемник / Охотник за головами</option>
                    <option value="Ученый">Ученый / Архивариус</option>
                    <option value="Культист">Культист / Послушник</option>
                    <option value="Трактирщик">Трактирщик / Бармен</option>
                  </select>
                </div>

                <div className="text-xs text-neutral-400 bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-800 leading-relaxed">
                  Генерирует: расу, внешность, привычки, манеру речи, психологический профиль (Идеал, Привязанность, Порок), секрет по проверке Харизмы (DC) и квестовую зацепку.
                </div>

                <button
                  id="btn-gen-npc"
                  onClick={handleGenerateNPC}
                  className="w-full mt-2 py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.98]"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Сгенерировать Персонажа
                </button>
              </div>
            )}

            {/* LOOT TAB */}
            {activeTab === 'loot' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Coins className="w-4 h-4" /> Генератор Лута и Сокровищ (Tier 1–4)
                </div>

                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Уровень группы (Tier):</label>
                  <select
                    value={lootTier}
                    onChange={(e) => setLootTier(e.target.value as LootTier)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="Tier 1 (1-4 ур.)">Tier 1 (1–4 уровень)</option>
                    <option value="Tier 2 (5-10 ур.)">Tier 2 (5–10 уровень)</option>
                    <option value="Tier 3 (11-16 ур.)">Tier 3 (11–16 уровень)</option>
                    <option value="Tier 4 (17-20 ур.)">Tier 4 (17–20 уровень)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Режим сокровищ:</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setLootMode('individual')}
                      className={`px-2 py-1.5 rounded text-[11px] border font-medium text-center transition-colors ${
                        lootMode === 'individual'
                          ? 'bg-amber-950/80 border-amber-700 text-amber-300'
                          : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Карманы врага
                    </button>
                    <button
                      onClick={() => setLootMode('hoard')}
                      className={`px-2 py-1.5 rounded text-[11px] border font-medium text-center transition-colors ${
                        lootMode === 'hoard'
                          ? 'bg-amber-950/80 border-amber-700 text-amber-300'
                          : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Сокровищница / Сундук
                    </button>
                  </div>
                </div>

                <button
                  id="btn-gen-loot"
                  onClick={handleGenerateLoot}
                  className="w-full mt-2 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-neutral-950 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.98]"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Сгенерировать Лут
                </button>
              </div>
            )}

            {/* MERCHANTS TAB */}
            {activeTab === 'merchants' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Compass className="w-4 h-4" /> Странствующие купцы и караваны
                </div>

                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Тип торговца:</label>
                  <select
                    value={merchantType}
                    onChange={(e) => setMerchantType(e.target.value as any)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Случайный">Случайный купец</option>
                    <option value="Караванщик-кочевник">Караванщик-кочевник (Ткани, вьючные животные)</option>
                    <option value="Скупщик краденого / Контрабандист">Скупщик краденого (Яды, отмычки +175%)</option>
                    <option value="Таинственный бродячий алхимик">Бродячий алхимик (Нестабильные зелья, кислоты)</option>
                    <option value="Гоблин-старьевщик">Гоблин-старьевщик (Хлам, шанс на тайный артефакт)</option>
                  </select>
                </div>

                <div className="text-xs text-neutral-400 bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-800 leading-relaxed">
                  Включает: пул золота для выкупа трофеев, охрану, событие дорожной встречи, ассортимент товаров и секретное предложение.
                </div>

                <button
                  id="btn-gen-merchant"
                  onClick={handleGenerateMerchant}
                  className="w-full mt-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.98]"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Сгенерировать Купца
                </button>
              </div>
            )}

            {/* STORES TAB */}
            {activeTab === 'stores' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                  <Store className="w-4 h-4" /> Городские лавки и рынки
                </div>

                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Специализация лавки:</label>
                  <select
                    value={storeType}
                    onChange={(e) => setStoreType(e.target.value as any)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-teal-500"
                  >
                    <option value="Кузница и Оружейная">Кузница и Оружейная (Заточка, доспехи)</option>
                    <option value="Алхимическая лавка и Травник">Алхимия и Травник (Зелья, противоядия)</option>
                    <option value="Магическая лавка / Башня чародея">Магическая лавка (Свитки, компоненты)</option>
                    <option value="Храм и Часовня">Храм и Часовня (Святая вода, воскрешения)</option>
                    <option value="Таверна и Лавка провизии">Таверна и Провизия (Еда, эль, комнаты)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Масштаб поселения:</label>
                  <select
                    value={storeSettlement}
                    onChange={(e) => setStoreSettlement(e.target.value as SettlementSize)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-teal-500"
                  >
                    <option value="Деревня / Село">Деревня / Село (+20% наценка за дефицит)</option>
                    <option value="Городок">Городок (Стандартные цены DMG)</option>
                    <option value="Торговый мегаполис">Торговый мегаполис (Широкий выбор, скидки)</option>
                  </select>
                </div>

                <button
                  id="btn-gen-store"
                  onClick={handleGenerateStore}
                  className="w-full mt-2 py-2 px-3 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.98]"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Сгенерировать Лавку
                </button>
              </div>
            )}

            {/* EQUIPMENT TAB */}
            {activeTab === 'equipment' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                  <Swords className="w-4 h-4" /> Система Экипировки и Аффиксов
                </div>

                <div className="text-xs text-neutral-400 bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-800 leading-relaxed">
                  Формула: <strong>[Префикс качества/материала] + [Базовый предмет] + [Суффикс зачарования]</strong>
                  <ul className="list-disc list-inside mt-1.5 space-y-1 text-neutral-300">
                    <li>Материалы: Адамантин, Мифрил, Хладное железо, Темное железо.</li>
                    <li>Свойства: Keen (криты 19-20), Balanced, Serrated, Piercing.</li>
                    <li>Стихийные зачарования и оценка в GP.</li>
                  </ul>
                </div>

                <button
                  id="btn-gen-equipment"
                  onClick={handleGenerateEquipment}
                  className="w-full mt-2 py-2 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.98]"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Создать Магический Предмет
                </button>
              </div>
            )}

            {/* MAGIC TAB */}
            {activeTab === 'magic' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Wand2 className="w-4 h-4" /> Магия, Заклинания и Дикий Хаос
                </div>

                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Круг процедурного заклинания (0–9):</label>
                  <input
                    type="range"
                    min={0}
                    max={9}
                    value={spellLevel}
                    onChange={(e) => setSpellLevel(parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-neutral-400 font-mono">
                    <span>Заговор (0)</span>
                    <span className="font-bold text-indigo-400">Круг: {spellLevel}</span>
                    <span>9 круг</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleGenerateSpell}
                    className="py-2 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> Заклинание
                  </button>
                  <button
                    onClick={handleGenerateSpellbook}
                    className="py-2 px-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-amber-400" /> Гримуар
                  </button>
                </div>

                <div className="pt-2 border-t border-neutral-800">
                  <div className="text-[11px] text-neutral-400 mb-1">Колесо Дикой Магии (d100 Surge):</div>
                  <button
                    id="btn-roll-wild-magic"
                    onClick={handleRollWildMagic}
                    className="w-full py-2 px-3 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.98]"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-yellow-300" /> Бросить d100 Дикой Магии!
                  </button>
                </div>
              </div>
            )}

            {/* REFERENCE TAB */}
            {activeTab === 'reference' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" /> Быстрый справочник мастера
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-500" />
                  <input
                    type="text"
                    value={refSearch}
                    onChange={(e) => setRefSearch(e.target.value)}
                    placeholder="Поиск по правилам, состояниям..."
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                  {['Все', 'Состояния', 'Действия в бою', 'Правила и Механики', 'Таблица CR и Опыта'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setRefCategory(cat)}
                      className={`px-2 py-1 rounded text-[10px] whitespace-nowrap font-medium transition-colors ${
                        refCategory === cat
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                          : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* List of reference items */}
                <div className="space-y-1.5 max-h-[42vh] overflow-y-auto pr-1">
                  {filteredRefItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        const card: CampaignCard = {
                          id: `card-ref-${item.id}`,
                          type: 'reference',
                          title: item.title,
                          summary: item.summary,
                          data: item,
                          timestamp: Date.now(),
                        };
                        registerCard(card);
                      }}
                      className="p-2 rounded-lg bg-neutral-950/60 border border-neutral-800 hover:border-amber-700/60 hover:bg-neutral-900 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
                        <span>{item.title}</span>
                        <span className="text-[10px] text-neutral-500">{item.category}</span>
                      </div>
                      <div className="text-[11px] text-neutral-400 line-clamp-2 mt-0.5">{item.summary}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Quick Status */}
          <div className="mt-4 pt-2.5 border-t border-neutral-800 text-[11px] text-neutral-500 flex items-center justify-between">
            <span>Закреплено на столе: {pinnedCards.length}</span>
            {projectedCard ? (
              <span className="text-amber-400 flex items-center gap-1 font-semibold">
                <Eye className="w-3 h-3" /> На проекторе
              </span>
            ) : (
              <span>Проектор свободен</span>
            )}
          </div>
        </div>

        {/* Center Column: Active Generated Card Preview (5 cols) */}
        <div className="col-span-12 md:col-span-5 bg-neutral-950 p-3 overflow-y-auto flex flex-col justify-start border-r border-neutral-800">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Текущая Карточка Генерации
            </h4>
            {activeCard && (activeCard.timestamp || activeCard.createdAt) && (
              <div className="text-[11px] text-neutral-500">
                {new Date(activeCard.timestamp || activeCard.createdAt || 0).toLocaleTimeString()}
              </div>
            )}
          </div>

          {activeCard ? (
            <CampaignCardView
              card={activeCard}
              isPinned={pinnedCards.some((c) => c.id === activeCard.id)}
              isProjected={projectedCard?.id === activeCard.id}
              onPinToggle={handleTogglePin}
              onProjectToggle={handleToggleProject}
              onDelete={handleDeleteCard}
            />
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-neutral-800 rounded-xl text-neutral-500 space-y-2">
              <Sparkles className="w-8 h-8 text-neutral-600" />
              <div className="text-xs font-semibold text-neutral-400">Выберите тип генератора слева</div>
              <div className="text-[11px] text-neutral-500 max-w-xs">
                Нажмите «Сгенерировать», чтобы мгновенно получить карточку монстра, NPC, лута, лавки или заклинания.
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Pinned Cards on Table & History (3 cols) */}
        <div className="col-span-12 md:col-span-3 bg-neutral-900/40 p-3 overflow-y-auto space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            {/* Pinned Cards Section */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-sky-400 mb-2">
                <span className="flex items-center gap-1.5">
                  <Pin className="w-3.5 h-3.5" /> На столе мастера ({pinnedCards.length})
                </span>
              </div>

              {pinnedCards.length === 0 ? (
                <div className="text-[11px] text-neutral-500 italic p-2 bg-neutral-950/40 rounded border border-neutral-800/60 text-center">
                  Нет закрепленных карточек. Нажмите иконку булавки на любой карточке.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {pinnedCards.map((card) => (
                    <div
                      key={card.id}
                      onClick={() => setActiveCard(card)}
                      className={`p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                        activeCard?.id === card.id
                          ? 'bg-neutral-800 border-sky-500 text-sky-200'
                          : 'bg-neutral-950/80 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="truncate">{card.title}</span>
                        {projectedCard?.id === card.id && (
                          <Eye className="w-3 h-3 text-amber-400 shrink-0 ml-1" />
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-500 truncate mt-0.5">{card.summary}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Generation History */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-neutral-400 mb-2">
                <span>Недавние генерации ({recentCards.length})</span>
              </div>

              {recentCards.length === 0 ? (
                <div className="text-[11px] text-neutral-500 italic p-2 bg-neutral-950/40 rounded border border-neutral-800/60 text-center">
                  История пуста
                </div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {recentCards.map((card) => (
                    <div
                      key={card.id}
                      onClick={() => setActiveCard(card)}
                      className={`p-1.5 rounded border text-xs cursor-pointer flex items-center justify-between transition-colors ${
                        activeCard?.id === card.id
                          ? 'bg-neutral-800 border-amber-500/80 text-amber-200'
                          : 'bg-neutral-950/40 border-neutral-800/80 hover:bg-neutral-900 text-neutral-400'
                      }`}
                    >
                      <span className="truncate">{card.title}</span>
                      <ChevronRight className="w-3 h-3 text-neutral-600 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Active Projected Card Bar */}
          {projectedCard && (
            <div className="p-2.5 bg-amber-950/30 border border-amber-800/60 rounded-lg text-xs space-y-1">
              <div className="text-[10px] text-amber-400 font-bold flex items-center justify-between">
                <span>СЕЙЧАС НА ПРОЕКТОРЕ:</span>
                <button
                  onClick={() => onProjectCard(null)}
                  className="text-neutral-400 hover:text-red-400"
                >
                  Снять
                </button>
              </div>
              <div className="font-semibold text-amber-200 truncate">{projectedCard.title}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
