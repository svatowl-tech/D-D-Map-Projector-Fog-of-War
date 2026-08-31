import { NextRequest, NextResponse } from 'next/server';
import { callPolzaChatCompletions, saveJsonToDisk } from '@/lib/aiEngineHelper';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title = 'Кровавое Затмение Драговии',
      system = 'D&D 5e',
      setting = 'Готический хоррор',
      tone = 'Мрачная атмосфера и психологическое напряжение',
      partyLevel = '1-3',
      villainHook = 'Древний граф-вампир',
      customWishes = 'Много тайн, секретные ходы в замке, интриги фракций',
      model = 'deepseek/deepseek-chat',
    } = body;

    const campaignPrompt = `
Ты — главный архитектор кампаний D&D 5e ("Lazy DM" метод). Сгенерируй полноценный автономный архив кампании по параметрам:
- Название: "${title}"
- Игровая система: "${system}"
- Сеттинг: "${setting}"
- Тон / Атмосфера: "${tone}"
- Уровень группы: "${partyLevel}"
- Главный антагонист: "${villainHook}"
- Пожелания: "${customWishes}"

Верни СТРОГО чистый JSON формата:
{
  "id": "campaign-ai-${Date.now()}",
  "name": "${title}",
  "system": "${system}",
  "setting": "${setting}",
  "partyLevel": "${partyLevel}",
  "calendarAndWeather": {
    "currentDate": "14-й день Месяца Мрака, 1422 г.",
    "moonPhase": "Кровавое Полнолуние",
    "temperature": "6°C (Холодный промозглый туман)",
    "season": "Поздняя Осень"
  },
  "quests": [
    {
      "id": "main-quest-1",
      "type": "Main",
      "title": "Главная сюжетная линия: Тайна Замка",
      "description": "Описание главного сюжетного конфликта",
      "reward": "1500 зм, Меч Света, +15 к репутации Ордена"
    },
    {
      "id": "side-quest-1",
      "type": "Side",
      "title": "Побочное поручение: Пропавший курьер",
      "description": "Описание побочного задания",
      "reward": "250 зм, Зелье исцеления"
    },
    {
      "id": "side-quest-2",
      "type": "Side",
      "title": "Побочное поручение: Очистка старой шахты",
      "description": "Описание побочного задания",
      "reward": "400 зм"
    }
  ],
  "npcs": [
    {
      "id": "npc-1",
      "name": "Граф Валериан",
      "role": "Главный злодей / Древний вампир",
      "relationship": "Враг",
      "notes": "Управляет замком и держит в страхе провинцию"
    },
    {
      "id": "npc-2",
      "name": "Барон Ольгерд",
      "role": "Староста поселения",
      "relationship": "Союзник / Должник",
      "notes": "Ищет помощи у искателей приключений"
    },
    {
      "id": "npc-3",
      "name": "Леди Изольда",
      "role": "Тайный осведомитель",
      "relationship": "Предатель",
      "notes": "Двойной агент фракции Теней"
    }
  ],
  "factions": [
    {
      "name": "Орден Серебряной Лилии",
      "influence": "Высокое в столице, среднее в провинции",
      "goals": "Искоренение темной магии и защита населения"
    },
    {
      "name": "Культ Кровавого Затмения",
      "influence": "Тайное подполье в замках и подземельях",
      "goals": "Пробуждение Древнего Графа"
    }
  ],
  "sessions": {
    "sessionZero": {
      "title": "Сессия 0: Вводный инструктаж и завязка",
      "lazyDmNotes": {
        "strongStart": "Яркий стартовый эпизод: Нападение волков-оборотней на карету ночью",
        "scenes": [
          "Сцена 1: Засада на дороге в тумане",
          "Сцена 2: Прибытие в мрачную таверну 'Черный Ворон'",
          "Сцена 3: Встреча со старостой и завязка расследования"
        ],
        "secrets": [
          "Секрет 1: Староста скрывает укус на предплечье",
          "Секрет 2: Под таверной есть древний тоннель к замку"
        ]
      }
    }
  },
  "starterParty": [
    { "name": "Элдрин", "race": "Эльф", "class": "Воин", "level": 1, "ac": 16, "hp": 12, "stats": { "str": 16, "dex": 14, "con": 14, "int": 10, "wis": 12, "cha": 8 } },
    { "name": "Лира", "race": "Человек", "class": "Жрец", "level": 1, "ac": 18, "hp": 10, "stats": { "str": 14, "dex": 10, "con": 14, "int": 10, "wis": 16, "cha": 12 } },
    { "name": "Джаррет", "race": "Полурослик", "class": "Плут", "level": 1, "ac": 14, "hp": 9, "stats": { "str": 8, "dex": 17, "con": 12, "int": 13, "wis": 10, "cha": 14 } },
    { "name": "Каэль", "race": "Полуэльф", "class": "Чародей", "level": 1, "ac": 12, "hp": 8, "stats": { "str": 8, "dex": 14, "con": 12, "int": 12, "wis": 10, "cha": 17 } }
  ],
  "partyTreasury": {
    "copper": 120,
    "silver": 45,
    "electrum": 0,
    "gold": 60,
    "platinum": 0
  },
  "safetyTools": {
    "lines": ["Пытки персонажей", "Жестокость к животным"],
    "veils": ["Графические подробности ранений (затемнение)"],
    "houseRules": [
      "Пить зелье исцеления — Бонусное действие",
      "Критический урон: Максимальный урон кости + бросок"
    ]
  }
}
`;

    const polzaResponse = await callPolzaChatCompletions({
      model: model || 'deepseek/deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'Ты — главный архитектор сюжетов D&D 5e на Polza AI. Твой ответ должен быть СТРОГО валидным JSON без вступительного текста.',
        },
        { role: 'user', content: campaignPrompt },
      ],
      temperature: 0.7,
    });

    let jsonString = (polzaResponse.text || '')
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    let campaign: any = {};
    try {
      campaign = JSON.parse(jsonString);
    } catch {
      const firstBrace = jsonString.indexOf('{');
      const lastBrace = jsonString.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        try {
          campaign = JSON.parse(jsonString.substring(firstBrace, lastBrace + 1));
        } catch {
          campaign = { rawText: jsonString, name: title };
        }
      } else {
        campaign = { rawText: jsonString, name: title };
      }
    }

    const campaignFileName = `campaign-ai-${Date.now()}.json`;
    const savedFilePath = saveJsonToDisk('Campaigns', campaignFileName, campaign);

    return NextResponse.json({
      success: true,
      campaign,
      savedFilePath,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Ошибка генерации кампании через Polza AI' },
      { status: 500 }
    );
  }
}
