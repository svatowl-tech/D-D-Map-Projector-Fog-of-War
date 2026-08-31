import { NextRequest, NextResponse } from 'next/server';
import { callPolzaChatCompletions, saveJsonToDisk, compileArtPrompt } from '@/lib/aiEngineHelper';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      model = 'deepseek/deepseek-r1-distill-llama-70b',
      options = {},
      temperature = 0.7,
      autoSaveToDatabase = true,
    } = body;

    const entityType = options.entityType || 'monster';
    const userPrompt = options.userPrompt || 'Фэнтезийная сущность';
    const cr = options.cr || '1';
    const monsterSize = options.monsterSize || 'Средний';

    // System prompt describing exact JSON structures required by D&D 5e / d20 mechanics
    let promptInstructions = '';

    switch (entityType) {
      case 'monster':
        promptInstructions = `
Ты — ведущий системный дизайнер D&D 5e / d20. Сгенерируй статблок монстра по описанию: "${userPrompt}", Опасность (CR): ${cr}, Размер: ${monsterSize}.
Возвращай строго JSON следующей структуры:
{
  "name": "Название монстра (на русском)",
  "nameEn": "English Name",
  "size": "${monsterSize}",
  "type": "Тип монстра (Аберрация, Нежить, Дракон и т.д.)",
  "alignment": "Мировоззрение",
  "ac": 15,
  "acType": "Естественный доспех / Кожаный доспех",
  "hp": 45,
  "hpFormula": "6d8 + 18",
  "speed": "30 футов, плавая 40 футов",
  "cr": "${cr}",
  "xp": 450,
  "stats": { "str": 16, "dex": 14, "con": 16, "int": 10, "wis": 12, "cha": 8 },
  "savingThrows": "Спасброски (например: Сил +5, Тел +5)",
  "skills": "Навыки (например: Внимательность +3, Скрытность +4)",
  "damageResistances": "Сопротивление урону (например: Огонь, Холод)",
  "damageImmunities": "Иммунитет к урону",
  "conditionImmunities": "Иммунитет к состояниям (Испуг, Очарование)",
  "senses": "Слепое зрение 30 футов, Темное зрение 60 футов, Пассивная Внимательность 13",
  "languages": "Языки",
  "traits": [
    { "name": "Название свойства", "description": "Описание механики свойств D&D 5e" }
  ],
  "actions": [
    { "name": "Мультиатака", "description": "Делает две атаки..." },
    { "name": "Удар клыками", "description": "Рукопашная атака оружием: +5 к попаданию, досягаемость 5 фт., одна цель. Урон: 10 (2d6 + 3) колющего урона." }
  ],
  "legendaryActions": [
    { "name": "Название легендарного действия", "description": "Описание" }
  ],
  "tactics": {
    "ambush": "Засада и скрытое нападение...",
    "combatStrategy": "Тактика поведения в бою и условия отступления..."
  }
}`;
        break;

      case 'npc':
        promptInstructions = `
Сгенерируй детальную карточку NPC для D&D 5e по запросу: "${userPrompt}".
Возвращай строго JSON структуры:
{
  "fullName": "Полное имя NPC",
  "originalNameEn": "English Full Name",
  "race": "Раса",
  "class": "Класс / Род занятий",
  "gender": "Пол",
  "age": 35,
  "alignment": "Мировоззрение",
  "appearance": "Подробное описание внешности, одежды и осанки",
  "personalityTraits": "Черты характера, манера речи",
  "secrets": "Главный секрет персонажа, который игроки могут узнать",
  "nicknames": "Приметы, клички и особые внешние знаки (монокль, шрам)",
  "equipment": ["Монокль с синей линзой", "Серебряный кинжал", "Кошель с 25 зм"],
  "plotHooks": [
    "Первый сюжетный крючок для игроков",
    "Второй сюжетный крючок"
  ]
}`;
        break;

      case 'location':
        promptInstructions = `
Сгенерируй атмосферную локацию/карту для D&D 5e по запросу: "${userPrompt}".
Возвращай строго JSON структуры:
{
  "name": "Название локации",
  "nameEn": "English Location Name",
  "atmosphere": "Общее описание атмосферы и освещения",
  "sensoryDetails": {
    "sight": "Визуальные детали, туман, свечение",
    "sound": "Эхо, капли воды, отдаленный шепот",
    "smell": "Запах озона, сырости и древней пыли"
  },
  "secretRooms": [
    { "name": "Потайная комната", "perceptionDc": 15, "description": "Описание и содержимое тайника" }
  ],
  "hazardsAndTraps": [
    { "name": "Ловушка с ядовитыми шипами", "trigger": "Нажатие на плиту", "dc": 14, "damage": "2d10 колющего + 1d8 ядом" }
  ],
  "keyInhabitants": ["Охрана культа", "Древний призрак"],
  "pointsOfInterest": [
    { "name": "Затонувший алтарь", "description": "Описание точки интереса" }
  ],
  "questHooks": ["Квест на поиск утраченного реликта"]
}`;
        break;

      case 'item':
        promptInstructions = `
Сгенерируй магический предмет или артефакт D&D 5e по запросу: "${userPrompt}".
Возвращай строго JSON структуры:
{
  "name": "Название предмета",
  "nameEn": "English Item Name",
  "category": "Оружие / Доспех / Кольцо / Посох / Амулет",
  "rarity": "Обычный / Необычный / Редкий / Очень редкий / Легендарный",
  "attunement": true,
  "attunementRequirement": "Требуется настройка заклинателем",
  "activeAbilities": [
    { "name": "Вспышка астрального огня", "cost": "1 заряд", "description": "Описание активации" }
  ],
  "passiveBonuses": ["+1 к КБ", "Сопротивление урону холодом"],
  "damageFormulas": "1d8 + 2 силовым уроном",
  "charges": { "max": 5, "recharge": "Восстанавливает 1d4+1 зарядов на рассвете" },
  "curse": "Описание проклятия (если есть, иначе null)"
}`;
        break;

      case 'spell':
        promptInstructions = `
Сгенерируй заклинание D&D 5e по запросу: "${userPrompt}".
Возвращай строго JSON структуры:
{
  "name": "Название заклинания",
  "nameEn": "English Spell Name",
  "level": 3,
  "school": "Воплощение / Некромантия / Вызов и т.д.",
  "castingTime": "1 действие",
  "range": "60 футов",
  "components": { "v": true, "s": true, "m": "Порошок черного оникса ценой 50 зм" },
  "duration": "Концентрация, до 1 минуты",
  "description": "Полный текст действия заклинания и проверок",
  "higherLevels": "При сотворении с использованием ячейки 4 уровня или выше урон увеличивается на 1d6..."
}`;
        break;

      case 'quest':
        promptInstructions = `
Сгенерируй многошаговый квест по запросу: "${userPrompt}".
Возвращай строго JSON структуры:
{
  "title": "Название квеста",
  "summary": "Краткая фабула задания",
  "objectives": [
    { "id": "obj-1", "description": "Расследовать исчезновение купца", "type": "Active" },
    { "id": "obj-2", "description": "Найти тайную записку в подвале", "type": "Optional" }
  ],
  "rewards": {
    "gold": 300,
    "xp": 1200,
    "item": "Перстень защиты",
    "reputation": "+10 к репутации в Гильдии Торговцев"
  },
  "plotTwists": ["Заказчик квеста сам является предателем"],
  "consequences": "В случае успеха Гильдия откроет доступ к редким товарам..."
}`;
        break;

      case 'rule':
        promptInstructions = `
Сгенерируй домашнее правило или игровую механику (Homebrew Rule) по запросу: "${userPrompt}".
Возвращай строго JSON структуры:
{
  "title": "Название механики / правила",
  "summary": "Краткая суть правила",
  "checkFormulas": "Проверка Мудрости (Внимательность) против КС 15",
  "triggers": "Срабатывает при входе в зоны хаоса или при падении хитов ниже 1/4",
  "multiStageEffects": [
    { "stage": 1, "name": "Легкая тревога", "effect": "Помеха на проверки Внимательности" },
    { "stage": 2, "name": "Паника", "effect": "Персонаж обязан тратить действие на Бег" }
  ],
  "recovery": "Отдых в безопасном месте восстанавливает 1 стадию",
  "dmTips": "Советы Мастеру по внедрению механики в сессию"
}`;
        break;

      case 'lore':
      default:
        promptInstructions = `
Сгенерируй статью энциклопедии / лора мира по запросу: "${userPrompt}".
Возвращай строго JSON структуры:
{
  "title": "Название статьи лора",
  "category": "История / Фракция / География / Древнее божество",
  "markdownContent": "# Заголовок\\n\\nПолный текст энциклопедии в формате Markdown с разделами, списками и выделениями...",
  "timeline": [
    { "year": "1240 год Эры Дракона", "event": "Основание ордена" }
  ],
  "secretLore": "Засекреченные сведения, известные только Мастеру",
  "factionConnections": ["Вражда с Культом Теней", "Союз с Серебряной Коллегией"]
}`;
        break;
    }

    const systemPrompt = `
Ты — AI Engine на базе Polza AI для D&D 5e и d20 настольных систем.
ВАЖНО:
1. Если модель поддерживает рассуждения, сформируй блок рассуждений в тегах <think>...</think> (логика балансировки, распределение статов и нюансы механик D&D 5e).
2. Выведи СТРОГО чистый JSON сущности без лишних markdown оберток и постороннего вводного текста.
`;

    // Вызов Polza AI API
    const polzaResponse = await callPolzaChatCompletions({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${promptInstructions}\n\nПользовательский запрос: ${userPrompt}` },
      ],
      temperature,
    });

    let jsonString = polzaResponse.text || '';
    let reasoning = polzaResponse.reasoning || '';

    if (!reasoning) {
      reasoning = `Анализ запроса: "${userPrompt}". Применена математика и баланс D&D 5e для типа ${entityType} через Polza AI (${model}).`;
    }

    // Clean JSON markdown code blocks
    jsonString = jsonString.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

    let jsonData: any = {};
    try {
      jsonData = JSON.parse(jsonString);
    } catch {
      // Пытаемся извлечь JSON подстроку
      const firstBrace = jsonString.indexOf('{');
      const lastBrace = jsonString.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        try {
          jsonData = JSON.parse(jsonString.substring(firstBrace, lastBrace + 1));
        } catch {
          jsonData = { rawText: jsonString, parseError: true };
        }
      } else {
        jsonData = { rawText: jsonString, parseError: true };
      }
    }

    // Compile auto image prompt
    const { prompt: imagePrompt } = compileArtPrompt(
      { name: jsonData.name || jsonData.fullName || jsonData.title, entityType, description: userPrompt },
      'dnd_cinematic'
    );

    let savedFilePath = '';
    if (autoSaveToDatabase) {
      const filename = `generated_${entityType}_${Date.now()}.json`;
      savedFilePath = saveJsonToDisk('ai-generated', filename, {
        entityType,
        jsonData,
        reasoning,
        imagePrompt,
        model,
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      entityType,
      jsonData,
      reasoning,
      imagePrompt,
      savedFilePath,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Ошибка генерации JSON через Polza AI' },
      { status: 500 }
    );
  }
}
