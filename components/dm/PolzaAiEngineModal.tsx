'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  Brain,
  Palette,
  Scroll,
  FolderPlus,
  Compass,
  Zap,
  Check,
  RefreshCw,
  Copy,
  Download,
  Image as ImageIcon,
  X,
  ChevronDown,
  Layers,
  Shield,
  Users,
  Coins,
  BookOpen,
  Send,
  Save,
  HardDrive,
} from 'lucide-react';

interface PolzaAiEngineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyArtToMap?: (url: string, name: string) => void;
}

export const PolzaAiEngineModal: React.FC<PolzaAiEngineModalProps> = ({
  isOpen,
  onClose,
  onApplyArtToMap,
}) => {
  const [activeTab, setActiveTab] = useState<'entity' | 'campaign' | 'art'>('entity');

  // Text models state
  const [textModels, setTextModels] = useState<any[]>([]);
  const [selectedTextModel, setSelectedTextModel] = useState<string>('deepseek/deepseek-r1-distill-llama-70b');

  // Image models state
  const [imageModels, setImageModels] = useState<any[]>([]);
  const [selectedImageModel, setSelectedImageModel] = useState<string>('tongyi-mai/z-image');

  // JSON Engine state
  const [entityType, setEntityType] = useState<string>('monster');
  const [userPrompt, setUserPrompt] = useState<string>('Ксеноморф с кислотной кровью и хлыстоподобным хвостом');
  const [cr, setCr] = useState<string>('8');
  const [monsterSize, setMonsterSize] = useState<string>('Большой');
  const [isGeneratingJson, setIsGeneratingJson] = useState<boolean>(false);
  const [jsonResult, setJsonResult] = useState<any>(null);
  const [showReasoning, setShowReasoning] = useState<boolean>(true);

  // Campaign Engine state
  const [campaignTitle, setCampaignTitle] = useState<string>('Кровавое Затмение Драговии');
  const [campaignSetting, setCampaignSetting] = useState<string>('Готический хоррор');
  const [campaignTone, setCampaignTone] = useState<string>('Мрачная атмосфера и психологическое напряжение');
  const [partyLevel, setPartyLevel] = useState<string>('1-3');
  const [villainHook, setVillainHook] = useState<string>('Древний граф-вампир');
  const [customWishes, setCustomWishes] = useState<string>('Много тайн, секретные ходы в замке, интриги фракций');
  const [isGeneratingCampaign, setIsGeneratingCampaign] = useState<boolean>(false);
  const [campaignResult, setCampaignResult] = useState<any>(null);

  // Art Engine state
  const [artStylePreset, setArtStylePreset] = useState<string>('dnd_cinematic');
  const [artPrompt, setArtPrompt] = useState<string>('Masterpiece fantasy character portrait...');
  const [artSize, setArtSize] = useState<string>('1024x1536');
  const [isCompilingPrompt, setIsCompilingPrompt] = useState<boolean>(false);
  const [isGeneratingArt, setIsGeneratingArt] = useState<boolean>(false);
  const [generatedArtUrl, setGeneratedArtUrl] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string>('');

  // Fetch available models on load
  useEffect(() => {
    if (isOpen) {
      fetch('/api/polza/text-models')
        .then((res) => res.json())
        .then((data) => {
          if (data.models) {
            setTextModels(data.models);
            setSelectedTextModel(data.defaultModel || data.models[0].id);
          }
        })
        .catch(() => {});

      fetch('/api/polza/models')
        .then((res) => res.json())
        .then((data) => {
          if (data.models) {
            setImageModels(data.models);
            setSelectedImageModel(data.defaultModel || data.models[0].id);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // 1. Generate JSON Entity
  const handleGenerateJson = async () => {
    setIsGeneratingJson(true);
    try {
      const res = await fetch('/api/polza/generate-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedTextModel,
          options: {
            entityType,
            userPrompt,
            cr,
            monsterSize,
          },
          temperature: 0.7,
          autoSaveToDatabase: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setJsonResult(data);
        if (data.imagePrompt) {
          setArtPrompt(data.imagePrompt);
        }
        showToast(`✓ Сущность «${data.jsonData.name || data.jsonData.fullName || data.jsonData.title || entityType}» сгенерирована и сохранена!`);
      } else {
        showToast(`Ошибка: ${data.error}`);
      }
    } catch (err: any) {
      showToast('Ошибка обращения к API Polza / AI Engine');
    } finally {
      setIsGeneratingJson(false);
    }
  };

  // 2. Generate Full Campaign
  const handleGenerateCampaign = async () => {
    setIsGeneratingCampaign(true);
    try {
      const res = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: campaignTitle,
          system: 'D&D 5e',
          setting: campaignSetting,
          tone: campaignTone,
          partyLevel,
          villainHook,
          customWishes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCampaignResult(data.campaign);
        showToast(`✓ Кампания «${data.campaign.name}» сгенерирована и сохранена на диск!`);
      } else {
        showToast(`Ошибка: ${data.error}`);
      }
    } catch (err) {
      showToast('Ошибка генерации кампании');
    } finally {
      setIsGeneratingCampaign(false);
    }
  };

  // 3. Compile Art Prompt
  const handleCompilePrompt = async () => {
    setIsCompilingPrompt(true);
    try {
      const res = await fetch('/api/polza/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity: jsonResult?.jsonData || { name: userPrompt, entityType },
          stylePreset: artStylePreset,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setArtPrompt(data.prompt);
        setArtSize(data.optimalSize);
        showToast('✓ Промпт арта скомпилирован');
      }
    } catch (err) {
      showToast('Ошибка компиляции промпта');
    } finally {
      setIsCompilingPrompt(false);
    }
  };

  // 4. Generate Art
  const handleGenerateArt = async () => {
    setIsGeneratingArt(true);
    try {
      const res = await fetch('/api/polza/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedImageModel,
          prompt: artPrompt,
          size: artSize,
          saveToDisk: true,
        }),
      });
      const data = await res.json();
      if (data.success && data.data?.[0]?.url) {
        const url = data.data[0].localAssetUrl || data.data[0].url;
        setGeneratedArtUrl(url);
        showToast('✓ Иллюстрация создана и сохранена на диск!');
      } else {
        showToast(`Ошибка генерации: ${data.error}`);
      }
    } catch (err) {
      showToast('Ошибка генерации изображения');
    } finally {
      setIsGeneratingArt(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-black/80  flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-fadeIn">
      <div className="bg-[#120e1a] border border-[#ff4e00]/40 rounded-xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl text-[#e2d9f3] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-[#1a1426] border-b border-[#ff4e00]/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#ff4e00]/20 border border-[#ff4e00]/50 flex items-center justify-center text-[#ff4e00] shadow-sm">
              <Bot className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                JSON AI ENGINE & FULL CAMPAIGN STUDIO
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#ff4e00] text-black font-extrabold uppercase">
                  D&D 5e / d20
                </span>
              </h2>
              <p className="text-xs text-[#a395be]">
                Автономный генератор сущностей, кампаний и концепт-артов через /api/polza/ и /api/campaigns/
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast */}
        {toastMessage && (
          <div className="bg-[#ff4e00] text-black font-semibold text-xs px-4 py-2 text-center shadow-md animate-fadeIn">
            {toastMessage}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-5 pt-3 bg-[#161022] border-b border-white/10 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('entity')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 border-t border-x ${
              activeTab === 'entity'
                ? 'bg-[#120e1a] border-[#ff4e00]/40 text-[#ff4e00]'
                : 'bg-transparent border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Brain className="w-4 h-4" />
            Генератор сущностей (JSON)
          </button>

          <button
            onClick={() => setActiveTab('campaign')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 border-t border-x ${
              activeTab === 'campaign'
                ? 'bg-[#120e1a] border-[#ff4e00]/40 text-[#ff4e00]'
                : 'bg-transparent border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <FolderPlus className="w-4 h-4" />
            Генератор кампаний (Full Campaign)
          </button>

          <button
            onClick={() => setActiveTab('art')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 border-t border-x ${
              activeTab === 'art'
                ? 'bg-[#120e1a] border-[#ff4e00]/40 text-[#ff4e00]'
                : 'bg-transparent border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Palette className="w-4 h-4" />
            ИИ-Генератор Иллюстраций и Артов
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
          {/* TAB 1: JSON ENTITY GENERATOR */}
          {activeTab === 'entity' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Settings Column */}
              <div className="lg:col-span-5 space-y-4 bg-[#1a1426] p-4 rounded-xl border border-white/10">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#ff4e00]" />
                  Параметры ИИ-генерации
                </h3>

                {/* Model Selector */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Текстовая нейросеть</label>
                  <select
                    value={selectedTextModel}
                    onChange={(e) => setSelectedTextModel(e.target.value)}
                    className="w-full bg-[#120e1a] border border-white/20 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff4e00]"
                  >
                    {textModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.supportsReasoning ? '🧠 (<think>)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Entity Type Selector */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Тип сущности D&D 5e</label>
                  <select
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    className="w-full bg-[#120e1a] border border-white/20 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff4e00]"
                  >
                    <option value="monster">Бестиарий и монстры (Monster Statblock)</option>
                    <option value="npc">Персонажи и NPC</option>
                    <option value="location">Локации и атмосферные карты</option>
                    <option value="item">Магические предметы и артефакты</option>
                    <option value="spell">Заклинания (Spells)</option>
                    <option value="quest">Многошаговые квесты</option>
                    <option value="rule">Игровые механики и Домашние правила (Rules)</option>
                    <option value="lore">Энциклопедия и Лор (World Lore)</option>
                  </select>
                </div>

                {/* Options for Monster */}
                {entityType === 'monster' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Опасность (CR)</label>
                      <input
                        type="text"
                        value={cr}
                        onChange={(e) => setCr(e.target.value)}
                        className="w-full bg-[#120e1a] border border-white/20 rounded px-3 py-1.5 text-xs text-white"
                        placeholder="1/2, 5, 12..."
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Размер</label>
                      <select
                        value={monsterSize}
                        onChange={(e) => setMonsterSize(e.target.value)}
                        className="w-full bg-[#120e1a] border border-white/20 rounded px-3 py-1.5 text-xs text-white"
                      >
                        <option value="Крошечный">Крошечный</option>
                        <option value="Маленький">Маленький</option>
                        <option value="Средний">Средний</option>
                        <option value="Большой">Большой</option>
                        <option value="Огромный">Огромный</option>
                        <option value="Громадный">Громадный</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* User Prompt */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Опишите сущность или идею</label>
                  <textarea
                    rows={4}
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    className="w-full bg-[#120e1a] border border-white/20 rounded p-3 text-xs text-white focus:outline-none focus:border-[#ff4e00] resize-none"
                    placeholder="Пример: Древний механизм из затонувшего храма с ядовитыми шипами..."
                  />
                </div>

                {/* Action button */}
                <button
                  onClick={handleGenerateJson}
                  disabled={isGeneratingJson}
                  className="w-full py-2.5 bg-[#ff4e00] hover:bg-[#ff4e00]/80 disabled:opacity-50 text-black font-bold text-xs rounded uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  {isGeneratingJson ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Генерация D&D 5e JSON...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Сгенерировать сущность
                    </>
                  )}
                </button>
              </div>

              {/* Output Column */}
              <div className="lg:col-span-7 space-y-4">
                {jsonResult ? (
                  <div className="bg-[#1a1426] p-4 rounded-xl border border-white/10 space-y-3">
                    {/* Header bar */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="text-xs font-bold text-[#ff4e00] uppercase">
                        Результат: {jsonResult.entityType}
                      </span>
                      {jsonResult.reasoning && (
                        <button
                          onClick={() => setShowReasoning(!showReasoning)}
                          className="text-[11px] text-purple-300 hover:underline flex items-center gap-1"
                        >
                          <Brain className="w-3.5 h-3.5" />
                          {showReasoning ? 'Скрыть блок <think>' : 'Показать <think>'}
                        </button>
                      )}
                    </div>

                    {/* Reasoning Block <think> */}
                    {showReasoning && jsonResult.reasoning && (
                      <div className="bg-[#120e1a] p-3 rounded border border-purple-500/30 text-xs text-purple-200 space-y-1">
                        <div className="text-[10px] uppercase font-bold text-purple-400 flex items-center gap-1">
                          <Brain className="w-3 h-3" />
                          Рассуждения нейросети (&lt;think&gt;):
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed opacity-90">{jsonResult.reasoning}</p>
                      </div>
                    )}

                    {/* JSON Data Viewer */}
                    <div className="bg-[#0e0a14] p-3 rounded border border-white/10 max-h-[350px] overflow-y-auto custom-scrollbar font-mono text-xs text-emerald-300">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(jsonResult.jsonData, null, 2)}
                      </pre>
                    </div>

                    {/* Image prompt trigger */}
                    {jsonResult.imagePrompt && (
                      <div className="p-3 bg-[#ff4e00]/10 border border-[#ff4e00]/30 rounded flex items-center justify-between gap-2">
                        <div className="text-xs text-[#e2d9f3]">
                          <span className="font-bold text-[#ff4e00]">Скомпилирован промпт для арта:</span>
                          <p className="text-[11px] opacity-80 truncate max-w-md">{jsonResult.imagePrompt}</p>
                        </div>
                        <button
                          onClick={() => {
                            setArtPrompt(jsonResult.imagePrompt);
                            setActiveTab('art');
                          }}
                          className="px-3 py-1 bg-[#ff4e00] text-black font-bold text-xs rounded hover:bg-[#ff4e00]/80 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
                        >
                          <Palette className="w-3.5 h-3.5" />
                          Создать арт
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full min-h-[300px] border border-dashed border-white/15 rounded-xl flex flex-col items-center justify-center p-6 text-center text-gray-400">
                    <Bot className="w-12 h-12 text-gray-600 mb-2 animate-bounce" />
                    <p className="text-sm font-semibold text-gray-300">Готов к генерации игрового контента</p>
                    <p className="text-xs opacity-60 max-w-sm mt-1">
                      Выберите тип сущности, укажите вводные данные и нажмите «Сгенерировать сущность».
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: FULL CAMPAIGN ENGINE */}
          {activeTab === 'campaign' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Campaign Inputs */}
              <div className="lg:col-span-5 space-y-4 bg-[#1a1426] p-4 rounded-xl border border-white/10">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FolderPlus className="w-4 h-4 text-[#ff4e00]" />
                  Генератор сюжетных кампаний (Gemini 3.7 / 2.5 Flash)
                </h3>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Название кампании</label>
                  <input
                    type="text"
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    className="w-full bg-[#120e1a] border border-white/20 rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Сеттинг</label>
                    <input
                      type="text"
                      value={campaignSetting}
                      onChange={(e) => setCampaignSetting(e.target.value)}
                      className="w-full bg-[#120e1a] border border-white/20 rounded px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Уровень группы</label>
                    <input
                      type="text"
                      value={partyLevel}
                      onChange={(e) => setPartyLevel(e.target.value)}
                      className="w-full bg-[#120e1a] border border-white/20 rounded px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Тон / Атмосфера</label>
                  <input
                    type="text"
                    value={campaignTone}
                    onChange={(e) => setCampaignTone(e.target.value)}
                    className="w-full bg-[#120e1a] border border-white/20 rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Главный антагонист (Villain Hook)</label>
                  <input
                    type="text"
                    value={villainHook}
                    onChange={(e) => setVillainHook(e.target.value)}
                    className="w-full bg-[#120e1a] border border-white/20 rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Особые пожелания и тайны</label>
                  <textarea
                    rows={3}
                    value={customWishes}
                    onChange={(e) => setCustomWishes(e.target.value)}
                    className="w-full bg-[#120e1a] border border-white/20 rounded p-2 text-xs text-white focus:outline-none focus:border-[#ff4e00] resize-none"
                  />
                </div>

                <button
                  onClick={handleGenerateCampaign}
                  disabled={isGeneratingCampaign}
                  className="w-full py-2.5 bg-[#ff4e00] hover:bg-[#ff4e00]/80 disabled:opacity-50 text-black font-bold text-xs rounded uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  {isGeneratingCampaign ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Сборка кампании в один клик...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Сгенерировать кампанию
                    </>
                  )}
                </button>
              </div>

              {/* Campaign Output Overview */}
              <div className="lg:col-span-7 space-y-4">
                {campaignResult ? (
                  <div className="bg-[#1a1426] p-4 rounded-xl border border-white/10 space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                    <div className="border-b border-white/10 pb-3">
                      <h3 className="text-lg font-bold text-[#ff4e00]">{campaignResult.name}</h3>
                      <p className="text-xs text-gray-300">
                        Сеттинг: {campaignResult.setting} | Уровень: {campaignResult.partyLevel}
                      </p>
                    </div>

                    {/* Weather & Calendar */}
                    {campaignResult.calendarAndWeather && (
                      <div className="p-3 bg-[#120e1a] rounded border border-white/10 space-y-1 text-xs">
                        <div className="font-bold text-purple-300 uppercase">📅 Календарь и погода:</div>
                        <p>Дата: {campaignResult.calendarAndWeather.currentDate}</p>
                        <p>Фаза луны: {campaignResult.calendarAndWeather.moonPhase}</p>
                        <p>Погода: {campaignResult.calendarAndWeather.temperature}</p>
                      </div>
                    )}

                    {/* Quests */}
                    {campaignResult.quests && (
                      <div className="space-y-2">
                        <div className="font-bold text-xs text-[#ff4e00] uppercase">📜 Квесты кампании:</div>
                        {campaignResult.quests.map((q: any, idx: number) => (
                          <div key={idx} className="p-2.5 bg-[#120e1a] rounded border border-white/10 text-xs">
                            <span className="font-bold text-white">{q.title}</span> ({q.type})
                            <p className="text-gray-300 mt-1">{q.description}</p>
                            <p className="text-amber-300 mt-1 font-semibold">Награда: {q.reward}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Starter Party */}
                    {campaignResult.starterParty && (
                      <div className="space-y-2">
                        <div className="font-bold text-xs text-[#ff4e00] uppercase">⚔️ Отряд героев (Starter Party):</div>
                        <div className="grid grid-cols-2 gap-2">
                          {campaignResult.starterParty.map((p: any, idx: number) => (
                            <div key={idx} className="p-2 bg-[#120e1a] rounded border border-white/10 text-xs">
                              <span className="font-bold text-white">{p.name}</span> ({p.race} {p.class})
                              <p className="text-gray-400">КБ: {p.ac} | Хиты: {p.hp}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full min-h-[300px] border border-dashed border-white/15 rounded-xl flex flex-col items-center justify-center p-6 text-center text-gray-400">
                    <FolderPlus className="w-12 h-12 text-gray-600 mb-2" />
                    <p className="text-sm font-semibold text-gray-300">Полный сюжетный архив кампании</p>
                    <p className="text-xs opacity-60 max-w-sm mt-1">
                      Создаст погоду, квесты, граф NPC, фракции, записи Lazy DM, готовый отряд из 4 героев и сохранит на диск.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ART & IMAGE ENGINE */}
          {activeTab === 'art' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 space-y-4 bg-[#1a1426] p-4 rounded-xl border border-white/10">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#ff4e00]" />
                  ИИ-Генератор Иллюстраций (Tongyi Z-Image, Seedream 4, GPT Image)
                </h3>

                {/* Model Selector */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Модель Изображений</label>
                  <select
                    value={selectedImageModel}
                    onChange={(e) => setSelectedImageModel(e.target.value)}
                    className="w-full bg-[#120e1a] border border-white/20 rounded px-3 py-2 text-xs text-white"
                  >
                    {imageModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.supportsTransparency ? '✨ (Прозрачный фон)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Style Preset Selector */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Стилевой пресет (Art Style Presets)</label>
                  <select
                    value={artStylePreset}
                    onChange={(e) => setArtStylePreset(e.target.value)}
                    className="w-full bg-[#120e1a] border border-white/20 rounded px-3 py-2 text-xs text-white"
                  >
                    <option value="dnd_cinematic">dnd_cinematic — Официальный стиль иллюстраций D&D 5e</option>
                    <option value="grimdark">grimdark — Мрачное темное фэнтези (Warhammer)</option>
                    <option value="watercolor_rpg">watercolor_rpg — Книжная акварельная графика</option>
                    <option value="concept_art">concept_art — AAA видеоигровой концепт-арт (Unreal Engine 5)</option>
                    <option value="oil_painting">oil_painting — Масляная живопись и Кьяроскуро</option>
                    <option value="isometric_token">isometric_token — Токен-миниатюра для игрового стола</option>
                    <option value="anime_fantasy">anime_fantasy — Аниме-стиль с динамическими эффектами</option>
                    <option value="retro_pixel">retro_pixel — 16-битный пиксель-арт</option>
                  </select>
                </div>

                {/* Prompt compiler button */}
                <button
                  onClick={handleCompilePrompt}
                  disabled={isCompilingPrompt}
                  className="w-full py-1.5 bg-purple-900/50 hover:bg-purple-800/60 text-purple-200 border border-purple-500/30 text-xs rounded font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Brain className="w-3.5 h-3.5" />
                  Скомпилировать оптимизированный промпт
                </button>

                {/* Art Prompt */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Промпт на английском языке</label>
                  <textarea
                    rows={4}
                    value={artPrompt}
                    onChange={(e) => setArtPrompt(e.target.value)}
                    className="w-full bg-[#120e1a] border border-white/20 rounded p-2.5 text-xs text-white focus:outline-none focus:border-[#ff4e00] resize-none"
                  />
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerateArt}
                  disabled={isGeneratingArt}
                  className="w-full py-2.5 bg-[#ff4e00] hover:bg-[#ff4e00]/80 disabled:opacity-50 text-black font-bold text-xs rounded uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  {isGeneratingArt ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Генерация арта через нейросеть...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-4 h-4" />
                      Сгенерировать иллюстрацию
                    </>
                  )}
                </button>
              </div>

              {/* Generated Image View */}
              <div className="lg:col-span-6 flex flex-col items-center justify-center bg-[#1a1426] p-4 rounded-xl border border-white/10 min-h-[350px]">
                {generatedArtUrl ? (
                  <div className="space-y-3 text-center w-full">
                    <img
                      src={generatedArtUrl}
                      alt="Generated Art"
                      className="max-h-[380px] w-auto mx-auto rounded-lg border border-[#ff4e00]/40 shadow-xl object-contain"
                    />
                    <div className="flex items-center justify-center gap-2">
                      {onApplyArtToMap && (
                        <button
                          onClick={() => {
                            onApplyArtToMap(generatedArtUrl, 'Сгенерированная карта');
                            showToast('Карта активирована на игровом столе!');
                          }}
                          className="px-3 py-1.5 bg-[#ff4e00] text-black font-bold text-xs rounded hover:bg-[#ff4e00]/80 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Активировать на столе
                        </button>
                      )}
                      <a
                        href={generatedArtUrl}
                        download="ai_generated_art.png"
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Скачать
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-400 space-y-2">
                    <ImageIcon className="w-12 h-12 text-gray-600 mx-auto" />
                    <p className="text-sm font-semibold text-gray-300">Превью сгенерированного арта</p>
                    <p className="text-xs opacity-60">
                      Изображение автоматически сохранится в папку assets/data/ai-generated/
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
