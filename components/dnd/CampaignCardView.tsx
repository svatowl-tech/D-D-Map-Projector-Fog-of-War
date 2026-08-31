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
} from '../../lib/dnd-engine/types';
import {
  Shield,
  Heart,
  Zap,
  Eye,
  EyeOff,
  Pin,
  PinOff,
  Copy,
  Trash2,
  Sparkles,
  Coins,
  Gem,
  Swords,
  Scroll,
  BookOpen,
  User,
  ShoppingBag,
  ExternalLink,
  Flame,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface CampaignCardViewProps {
  card: CampaignCard;
  isProjected?: boolean;
  isPinned?: boolean;
  onProjectToggle?: (card: CampaignCard) => void;
  onPinToggle?: (card: CampaignCard) => void;
  onDelete?: (cardId: string) => void;
  compact?: boolean;
  isPlayerView?: boolean;
}

export function CampaignCardView({
  card,
  isProjected = false,
  isPinned = false,
  onProjectToggle,
  onPinToggle,
  onDelete,
  compact = false,
  isPlayerView = false,
}: CampaignCardViewProps) {
  const [copied, setCopied] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const copyToClipboard = () => {
    const cardKind = (card.type || card.engineType || 'D&D').toUpperCase();
    const cardDesc = card.summary || card.summaryMarkdown || '';
    const textToCopy = `[${card.title} - ${cardKind}]\n${cardDesc}\n${JSON.stringify(card.data, null, 2)}`;
    
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        fallbackCopyText(textToCopy);
      });
    } else {
      fallbackCopyText(textToCopy);
    }
  };

  const fallbackCopyText = (text: string) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // noop
    }
  };

  // Helper for modifiers
  const formatMod = (val?: number) => {
    if (val === undefined) return '+0';
    return val >= 0 ? `+${val}` : `${val}`;
  };

  return (
    <div
      id={`campaign-card-${card.id}`}
      className={`relative rounded-xl border transition-all duration-200 overflow-hidden flex flex-col ${
        isPlayerView
          ? 'bg-neutral-900/95 border-amber-500/40 text-amber-100 shadow-2xl shadow-black/80 max-w-2xl w-full'
          : 'bg-neutral-900 border-neutral-700/80 text-neutral-200 shadow-lg hover:border-neutral-600'
      } ${compact ? 'p-3 text-xs' : 'p-4 text-sm'}`}
    >
      {/* Top Banner & Category Badge */}
      <div className="flex items-start justify-between gap-2 border-b border-neutral-800 pb-2.5 mb-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
              card.type === 'monster'
                ? 'bg-red-950/80 text-red-400 border border-red-800/60'
                : card.type === 'npc'
                ? 'bg-sky-950/80 text-sky-400 border border-sky-800/60'
                : card.type === 'loot'
                ? 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                : card.type === 'merchant' || card.type === 'store'
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                : card.type === 'equipment'
                ? 'bg-purple-950/80 text-purple-400 border border-purple-800/60'
                : 'bg-indigo-950/80 text-indigo-400 border border-indigo-800/60'
            }`}
          >
            {card.type === 'monster' && 'Бестиарий'}
            {card.type === 'npc' && 'Социальный NPC'}
            {card.type === 'loot' && 'Сокровище'}
            {card.type === 'merchant' && 'Странствующий купец'}
            {card.type === 'store' && 'Городская лавка'}
            {card.type === 'equipment' && 'Экипировка'}
            {card.type === 'spell' && 'Заклинание'}
            {card.type === 'spellbook' && 'Гримуар'}
            {card.type === 'wildmagic' && 'Дикая магия'}
            {card.type === 'reference' && 'Справочник'}
          </span>

          <h3 className="font-bold text-base text-amber-300 truncate">{card.title}</h3>
        </div>

        {/* DM Action Buttons */}
        {!isPlayerView && (
          <div className="flex items-center gap-1 shrink-0">
            {onProjectToggle && (
              <button
                id={`btn-project-${card.id}`}
                onClick={() => onProjectToggle(card)}
                title={isProjected ? 'Скрыть с проектора игроков' : 'Показать игрокам на проекторе'}
                className={`p-1.5 rounded-lg border transition-colors ${
                  isProjected
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/30'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-amber-300 hover:bg-neutral-700'
                }`}
              >
                {isProjected ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            )}

            {onPinToggle && (
              <button
                id={`btn-pin-${card.id}`}
                onClick={() => onPinToggle(card)}
                title={isPinned ? 'Открепить от стола' : 'Закрепить на столе мастера'}
                className={`p-1.5 rounded-lg border transition-colors ${
                  isPinned
                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/50 hover:bg-sky-500/30'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-sky-300 hover:bg-neutral-700'
                }`}
              >
                {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              id={`btn-copy-${card.id}`}
              onClick={copyToClipboard}
              title="Скопировать данные"
              className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 transition-colors"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {onDelete && (
              <button
                id={`btn-del-${card.id}`}
                onClick={() => onDelete(card.id)}
                title="Удалить карточку"
                className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-red-400 hover:bg-red-950/40 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Card Body - Adaptive to card type */}
      <div className="space-y-3 flex-1 overflow-y-auto max-h-[60vh] pr-1 scrollbar-thin">
        {/* 1. MONSTER STATBLOCK */}
        {card.type === 'monster' && (() => {
          const m = card.data as MonsterStatBlock;
          return (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-neutral-400 italic">
                <span>
                  {m.size} {m.type.toLowerCase()}, {m.alignment.toLowerCase()}
                </span>
                <span className="font-semibold text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40">
                  CR {m.cr} ({m.xp.toLocaleString()} XP)
                </span>
              </div>

              {/* Combat Core Bar */}
              <div className="grid grid-cols-3 gap-2 bg-neutral-950/80 p-2 rounded-lg border border-neutral-800">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <div className="text-[10px] text-neutral-400">КД (AC)</div>
                    <div className="font-bold text-neutral-200">{m.ac} {m.acType && `(${m.acType})`}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-red-400 shrink-0" />
                  <div>
                    <div className="text-[10px] text-neutral-400">Хиты (HP)</div>
                    <div className="font-bold text-red-300">{m.hp} <span className="text-[11px] text-neutral-500 font-normal">({m.hitDice || m.hitDiceFormula})</span></div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
                  <div>
                    <div className="text-[10px] text-neutral-400">Скорость</div>
                    <div className="font-bold text-neutral-200">{m.speed}</div>
                  </div>
                </div>
              </div>

              {/* Ability Scores Grid */}
              <div className="grid grid-cols-6 gap-1 text-center bg-neutral-950/60 p-1.5 rounded border border-neutral-800/60">
                {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((stat) => {
                  const score = m.abilities?.[stat] ?? (m as any).stats?.[stat] ?? 10;
                  const mod = Math.floor((score - 10) / 2);
                  return (
                    <div key={stat} className="p-1 rounded bg-neutral-900/60">
                      <div className="text-[9px] uppercase font-bold text-neutral-400">{stat}</div>
                      <div className="font-bold text-xs text-neutral-200">{score}</div>
                      <div className="text-[10px] text-amber-400/90 font-mono">{formatMod(mod)}</div>
                    </div>
                  );
                })}
              </div>

              {/* Traits & Senses */}
              <div className="text-xs space-y-1 text-neutral-300 bg-neutral-950/40 p-2 rounded border border-neutral-800/40">
                {m.savingThrows && (
                  <div><strong className="text-neutral-400">Спасброски:</strong> {Array.isArray(m.savingThrows) ? m.savingThrows.join(', ') : m.savingThrows}</div>
                )}
                {m.skills && (
                  <div><strong className="text-neutral-400">Навыки:</strong> {Array.isArray(m.skills) ? m.skills.join(', ') : m.skills}</div>
                )}
                {m.senses && (
                  <div><strong className="text-neutral-400">Чувства:</strong> {Array.isArray(m.senses) ? m.senses.join(', ') : m.senses}</div>
                )}
                {m.languages && (
                  <div><strong className="text-neutral-400">Языки:</strong> {Array.isArray(m.languages) ? m.languages.join(', ') : m.languages}</div>
                )}
                {m.damageResistances && (
                  <div><strong className="text-neutral-400">Сопротивления:</strong> {Array.isArray(m.damageResistances) ? m.damageResistances.join(', ') : m.damageResistances}</div>
                )}
                {m.damageImmunities && (
                  <div><strong className="text-neutral-400">Иммунитеты к урону:</strong> {Array.isArray(m.damageImmunities) ? m.damageImmunities.join(', ') : m.damageImmunities}</div>
                )}
                {m.conditionImmunities && (
                  <div><strong className="text-neutral-400">Иммунитет к состояниям:</strong> {Array.isArray(m.conditionImmunities) ? m.conditionImmunities.join(', ') : m.conditionImmunities}</div>
                )}
              </div>

              {/* Features & Traits */}
              {m.traits && m.traits.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-xs font-bold text-amber-400 border-b border-neutral-800 pb-0.5">Особенности</div>
                  {m.traits.map((trait, idx) => (
                    <div key={idx} className="text-xs leading-relaxed">
                      <strong className="text-neutral-200">{trait.name}.</strong> <span className="text-neutral-400">{trait.description}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-1.5 pt-1">
                <div className="text-xs font-bold text-amber-400 border-b border-neutral-800 pb-0.5">Действия</div>
                {m.actions.map((act, idx) => (
                  <div key={idx} className="text-xs leading-relaxed bg-neutral-950/30 p-1.5 rounded border border-neutral-800/30">
                    <div className="flex items-center justify-between text-neutral-200 font-semibold">
                      <span>{act.name}</span>
                      {act.attackBonus !== undefined && (
                        <span className="text-amber-400 font-mono text-[11px]">{formatMod(act.attackBonus)} к попаданию</span>
                      )}
                    </div>
                    <div className="text-neutral-400 mt-0.5">{act.description}</div>
                    {(act.damageFormula || (act as any).damage) && (
                      <div className="text-red-400 font-mono text-[11px] mt-0.5">
                        Урон: {act.damageFormula || (act as any).damage}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Legendary Actions */}
              {m.legendaryActions && (
                <div className="space-y-1.5 pt-1 bg-red-950/20 p-2 rounded-lg border border-red-900/40">
                  <div className="text-xs font-bold text-red-400">
                    Легендарные действия {m.legendaryActions.countPerRound ? `(${m.legendaryActions.countPerRound}/раунд)` : ''}
                  </div>
                  {m.legendaryActions.description && (
                    <div className="text-[11px] text-neutral-400 italic mb-1">{m.legendaryActions.description}</div>
                  )}
                  {Array.isArray(m.legendaryActions.actions) && m.legendaryActions.actions.map((leg: any, idx: number) => (
                    <div key={idx} className="text-xs">
                      <strong className="text-red-300">{leg.name} {leg.cost ? `(${leg.cost} д.)` : ''}:</strong> <span className="text-neutral-400">{leg.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* 2. SOCIAL NPC CARD */}
        {card.type === 'npc' && (() => {
          const npc = card.data as SocialNPC;
          return (
            <div className="space-y-3">
              <div className="bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-sky-400">{npc.race} ({npc.gender})</span>
                  <span className="text-xs text-neutral-400">{npc.age}</span>
                </div>
                <div className="text-xs text-neutral-300">
                  <strong className="text-neutral-400">Род занятий:</strong> {npc.occupation} <span className="text-neutral-500">({npc.socialClass})</span>
                </div>
                <div className="text-xs text-neutral-300">
                  <strong className="text-neutral-400">Мировоззрение:</strong> {npc.alignment} | <strong className="text-neutral-400">Отношение:</strong> {npc.disposition}
                </div>
              </div>

              {/* Appearance & Mannerisms */}
              <div className="text-xs space-y-1.5 bg-neutral-950/40 p-2 rounded border border-neutral-800/40">
                <div><strong className="text-amber-400/90">Внешность:</strong> {npc.appearance.features}</div>
                <div><strong className="text-amber-400/90">Одежда:</strong> {npc.appearance.clothing}</div>
                <div><strong className="text-amber-400/90">Привычка:</strong> {npc.appearance.mannerism}</div>
                <div><strong className="text-amber-400/90">Особенность речи:</strong> {npc.appearance.speechQuirk}</div>
              </div>

              {/* Psychology: Ideal, Bond, Flaw */}
              <div className="space-y-1 text-xs">
                <div className="p-1.5 bg-emerald-950/20 border border-emerald-900/30 rounded text-emerald-300">
                  <strong>Идеал:</strong> {npc.ideal}
                </div>
                <div className="p-1.5 bg-sky-950/20 border border-sky-900/30 rounded text-sky-300">
                  <strong>Привязанность:</strong> {npc.bond}
                </div>
                <div className="p-1.5 bg-red-950/20 border border-red-900/30 rounded text-red-300">
                  <strong>Слабость / Порок:</strong> {npc.flaw}
                </div>
              </div>

              {/* Charisma Secret Helper */}
              {npc.charismaCheckSecret && (
                <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-800 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-amber-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Секрет по проверке: {npc.charismaCheckSecret.skill} (DC {npc.charismaCheckSecret.dc})
                    </span>
                    <button
                      onClick={() => setShowSecret(!showSecret)}
                      className="text-[11px] text-sky-400 hover:underline"
                    >
                      {showSecret ? 'Скрыть' : 'Показать'}
                    </button>
                  </div>
                  {showSecret && (
                    <div className="p-1.5 bg-amber-950/30 border border-amber-800/40 rounded text-amber-200 mt-1">
                      {npc.charismaCheckSecret.secret}
                    </div>
                  )}
                </div>
              )}

              {/* Rumor & Hook */}
              {npc.rumorOrHook && (
                <div className="text-xs p-2 bg-neutral-950/60 rounded border border-neutral-800 text-neutral-300 italic">
                  <strong className="not-italic text-amber-400">Слух / Зацепка:</strong> {npc.rumorOrHook}
                </div>
              )}

              {/* Dialogue Quote */}
              {npc.dialogueQuote && (
                <div className="text-xs text-neutral-400 italic text-center border-t border-neutral-800 pt-2">
                  {npc.dialogueQuote}
                </div>
              )}
            </div>
          );
        })()}

        {/* 3. LOOT & TREASURE CARD */}
        {card.type === 'loot' && (() => {
          const loot = card.data as LootResult;
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span className="font-medium text-amber-400">{loot.tier}</span>
                <span>{loot.mode === 'individual' ? 'Индивидуальный лут' : 'Сокровищница / Сундук'}</span>
              </div>

              {/* Coins breakdown */}
              <div className="bg-neutral-950/80 p-2.5 rounded-lg border border-amber-900/40">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                    <Coins className="w-4 h-4 text-amber-400" /> Монеты
                  </span>
                  <span className="text-xs font-bold text-amber-400 font-mono">
                    ≈ {loot.coins.totalGpEquivalent.toLocaleString()} GP
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1 text-center text-xs">
                  <div className="bg-neutral-900/80 p-1 rounded border border-neutral-800">
                    <div className="text-[10px] text-amber-700 font-bold">CP</div>
                    <div className="font-mono">{loot.coins.cp}</div>
                  </div>
                  <div className="bg-neutral-900/80 p-1 rounded border border-neutral-800">
                    <div className="text-[10px] text-slate-400 font-bold">SP</div>
                    <div className="font-mono">{loot.coins.sp}</div>
                  </div>
                  <div className="bg-neutral-900/80 p-1 rounded border border-neutral-800">
                    <div className="text-[10px] text-emerald-500 font-bold">EP</div>
                    <div className="font-mono">{loot.coins.ep}</div>
                  </div>
                  <div className="bg-neutral-900/80 p-1 rounded border border-neutral-800">
                    <div className="text-[10px] text-yellow-400 font-bold">GP</div>
                    <div className="font-mono">{loot.coins.gp}</div>
                  </div>
                  <div className="bg-neutral-900/80 p-1 rounded border border-neutral-800">
                    <div className="text-[10px] text-cyan-300 font-bold">PP</div>
                    <div className="font-mono">{loot.coins.pp}</div>
                  </div>
                </div>
              </div>

              {/* Gems */}
              {loot.gems && loot.gems.length > 0 && (
                <div className="bg-neutral-950/60 p-2 rounded border border-neutral-800 space-y-1">
                  <div className="text-xs font-bold text-sky-400 flex items-center gap-1">
                    <Gem className="w-3.5 h-3.5" /> Самоцветы
                  </div>
                  {loot.gems.map((g, idx) => (
                    <div key={idx} className="text-xs flex justify-between text-neutral-300">
                      <span>{g.name} x{g.count}</span>
                      <span className="text-amber-400 font-mono">{g.valueGp * g.count} GP ({g.valueGp} GP/шт)</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Art objects */}
              {loot.artObjects && loot.artObjects.length > 0 && (
                <div className="bg-neutral-950/60 p-2 rounded border border-neutral-800 space-y-1">
                  <div className="text-xs font-bold text-purple-400">Предметы искусства</div>
                  {loot.artObjects.map((art, idx) => (
                    <div key={idx} className="text-xs flex justify-between text-neutral-300">
                      <span>{art.name} x{art.count}</span>
                      <span className="text-amber-400 font-mono">{art.valueGp * art.count} GP</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Magic Items */}
              {loot.magicItems && loot.magicItems.length > 0 && (
                <div className="bg-neutral-950/60 p-2 rounded border border-neutral-800 space-y-1.5">
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Магические предметы
                  </div>
                  {loot.magicItems.map((item, idx) => (
                    <div key={idx} className="p-1.5 bg-neutral-900/80 rounded border border-neutral-800 text-xs">
                      <div className="flex items-center justify-between text-neutral-200 font-semibold">
                        <span>{item.name}</span>
                        <span className="text-[10px] text-purple-400 border border-purple-900/60 px-1 rounded">{item.rarity}</span>
                      </div>
                      <div className="text-neutral-400 mt-0.5 text-[11px]">{item.description}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Container & Traps */}
              {loot.containerDescription && (
                <div className="text-xs text-neutral-400 bg-neutral-950/40 p-2 rounded border border-neutral-800/40">
                  <strong className="text-neutral-300">Хранилище:</strong> {loot.containerDescription}
                </div>
              )}
              {loot.trapped && (
                <div className="text-xs text-red-300 bg-red-950/30 p-2 rounded border border-red-900/50 flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Ловушка:</strong> {loot.trapped}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* 4. WANDERING MERCHANT CARD */}
        {card.type === 'merchant' && (() => {
          const m = card.data as WanderingMerchant;
          return (
            <div className="space-y-3">
              <div className="bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-400">{m.type} ({m.race})</span>
                  <span className="font-mono text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-900/40">
                    Казна: {m.availableGoldGp} GP
                  </span>
                </div>
                <div className="text-xs text-neutral-400"><strong>Охрана:</strong> {m.escort}</div>
                <div className="text-xs text-neutral-400"><strong>Внешность:</strong> {m.appearance}</div>
              </div>

              {/* Encounter event */}
              <div className="text-xs p-2 bg-emerald-950/20 border border-emerald-900/40 rounded-lg text-emerald-200">
                <strong>Событие встречи:</strong> {m.encounterEvent}
              </div>

              {/* Greeting */}
              <div className="text-xs text-neutral-300 italic bg-neutral-950/40 p-2 rounded">
                {m.dialogueGreeting}
              </div>

              {/* Inventory Table */}
              <div className="space-y-1">
                <div className="text-xs font-bold text-amber-400">Ассортимент товаров:</div>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                  {m.inventory.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-1.5 bg-neutral-950/60 rounded border border-neutral-800">
                      <div>
                        <div className="font-semibold text-neutral-200">{item.name}</div>
                        <div className="text-[10px] text-neutral-500">{item.description}</div>
                      </div>
                      <span className="font-mono text-amber-400 font-bold shrink-0 ml-2">{item.price}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Secret Offer */}
              {m.secretOffer && (
                <div className="text-xs text-sky-300 bg-sky-950/20 p-2 rounded border border-sky-900/40">
                  <strong>Спецпредложение:</strong> {m.secretOffer}
                </div>
              )}
            </div>
          );
        })()}

        {/* 5. CITY STORE CARD */}
        {card.type === 'store' && (() => {
          const store = card.data as CityStore;
          return (
            <div className="space-y-3">
              <div className="bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-400">{store.storeType}</span>
                  <span className="text-neutral-400">{store.settlementSize}</span>
                </div>
                <div className="text-xs text-neutral-300"><strong>Владелец:</strong> {store.ownerName}</div>
                <div className="text-xs text-neutral-400 italic">{store.ownerPersonality}</div>
                <div className="text-xs text-neutral-400"><strong>Атмосфера:</strong> {store.atmosphere}</div>
              </div>

              {/* Goods & Inventory */}
              <div className="space-y-1">
                <div className="text-xs font-bold text-amber-400">Прайс-лист товаров:</div>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {store.inventory.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-1.5 bg-neutral-950/60 rounded border border-neutral-800">
                      <div>
                        <div className="font-semibold text-neutral-200">{item.name}</div>
                        <div className="text-[10px] text-neutral-500">{item.description}</div>
                      </div>
                      <span className="font-mono text-amber-400 font-bold shrink-0 ml-2">{item.price}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Services */}
              {store.services && store.services.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-bold text-sky-400">Услуги лавки:</div>
                  <div className="space-y-1">
                    {store.services.map((srv, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-1.5 bg-sky-950/20 rounded border border-sky-900/30">
                        <div>
                          <div className="font-semibold text-sky-200">{srv.name}</div>
                          <div className="text-[10px] text-neutral-400">{srv.description}</div>
                        </div>
                        <span className="font-mono text-amber-400 font-bold shrink-0 ml-2">{srv.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Local Rumor */}
              {store.rumor && (
                <div className="text-xs p-2 bg-neutral-950/40 rounded border border-neutral-800 text-neutral-400 italic">
                  <strong className="not-italic text-amber-400">Городской слух:</strong> {store.rumor}
                </div>
              )}
            </div>
          );
        })()}

        {/* 6. EQUIPMENT & AFFIX CARD */}
        {card.type === 'equipment' && (() => {
          const eq = card.data as EquipmentItem;
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-purple-400 font-semibold">{eq.itemCategory}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-950/60 text-purple-300 border border-purple-800/60">
                  {eq.rarity}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-neutral-950/80 p-2 rounded-lg border border-neutral-800 text-center text-xs">
                <div>
                  <div className="text-[10px] text-neutral-400">Урон / Защита</div>
                  <div className="font-bold text-amber-300">{eq.damageOrAC}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400">Вес</div>
                  <div className="font-bold text-neutral-200">{eq.weight}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400">Оценка</div>
                  <div className="font-bold text-amber-400 font-mono">{eq.estimatedPriceGp} GP</div>
                </div>
              </div>

              {/* Affix Components */}
              <div className="space-y-1.5 text-xs bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800">
                <div>
                  <strong className="text-sky-400">Материал [{eq.qualityPrefix.material}]:</strong> {eq.qualityPrefix.materialEffect}
                </div>
                <div>
                  <strong className="text-amber-400">Свойство [{eq.qualityPrefix.name}]:</strong> {eq.bonusProperties[1]}
                </div>
                <div>
                  <strong className="text-purple-400">Зачарование [{eq.enchantmentSuffix.name}]:</strong> {eq.enchantmentSuffix.effect}
                </div>
              </div>

              {/* Lore */}
              <div className="text-xs text-neutral-400 italic bg-neutral-950/30 p-2 rounded border border-neutral-800/30">
                {eq.loreDescription}
              </div>
            </div>
          );
        })()}

        {/* 7. CUSTOM SPELL CARD */}
        {card.type === 'spell' && (() => {
          const sp = card.data as CustomSpell;
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-400">Круг {sp.level} • {sp.school}</span>
                <span className="text-neutral-400 italic">Создатель: {sp.ancientCreator}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-neutral-950/80 p-2 rounded-lg border border-neutral-800">
                <div><strong className="text-neutral-400">Время сотворения:</strong> {sp.castingTime}</div>
                <div><strong className="text-neutral-400">Дистанция / Область:</strong> {sp.range}</div>
                <div><strong className="text-neutral-400">Длительность:</strong> {sp.duration}</div>
                <div><strong className="text-neutral-400">Компоненты:</strong> {sp.components}</div>
              </div>

              <div className="text-xs bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800 space-y-1.5">
                <div className="font-semibold text-amber-300">Спасбросок / Атака: {sp.saveOrAttack}</div>
                <div className="font-mono text-red-400 font-bold">Эффект: {sp.damageOrEffect}</div>
                <div className="text-neutral-300 leading-relaxed pt-1">{sp.description}</div>
              </div>

              {sp.higherLevels && (
                <div className="text-xs text-neutral-400 bg-indigo-950/20 p-2 rounded border border-indigo-900/30">
                  <strong className="text-indigo-300">На более высоких кругах:</strong> {sp.higherLevels}
                </div>
              )}
            </div>
          );
        })()}

        {/* 8. WILD MAGIC SURGE CARD */}
        {card.type === 'wildmagic' && (() => {
          const wm = card.data as WildMagicSurge;
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                  d100 = {wm.d100Roll}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-950/60 text-purple-300 border border-purple-800/60">
                  {wm.category}
                </span>
              </div>

              <div className="p-3 bg-neutral-950/80 rounded-lg border border-neutral-800 space-y-2">
                <div className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  {wm.visualTag}
                </div>
                <div className="text-xs text-neutral-200 leading-relaxed">{wm.effect}</div>
              </div>
            </div>
          );
        })()}

        {/* 9. SPELLBOOK CARD */}
        {card.type === 'spellbook' && (() => {
          const book = card.data as SpellbookItem;
          return (
            <div className="space-y-3">
              <div className="bg-neutral-950/60 p-2 rounded border border-neutral-800 text-xs space-y-1">
                <div><strong className="text-amber-400">Обложка:</strong> {book.appearance.cover}</div>
                <div><strong className="text-amber-400">Чернила:</strong> {book.appearance.ink}</div>
                <div><strong className="text-amber-400">Особенность:</strong> {book.appearance.quirk}</div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-bold text-indigo-400">Содержимое заклинаний:</div>
                <div className="space-y-1">
                  {book.spells.map((sp, idx) => (
                    <div key={idx} className="flex justify-between text-xs p-1.5 bg-neutral-950/60 rounded border border-neutral-800">
                      <span className="text-neutral-200">{sp.name}</span>
                      <span className="text-indigo-400 font-mono text-[11px]">Круг {sp.level} ({sp.school})</span>
                    </div>
                  ))}
                </div>
              </div>

              {book.secretTrapOrCurse && (
                <div className="text-xs text-red-300 bg-red-950/30 p-2 rounded border border-red-900/40">
                  <strong>Ловушка гримуара:</strong> {book.secretTrapOrCurse}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
