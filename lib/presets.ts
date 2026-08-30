/**
 * Встроенные тактические пресеты карт (легковесные векторные карты для мгновенного старта).
 * Не расходуют оперативную память, не требуют интернета и масштабируются без потери качества.
 */

export interface PresetMap {
  id: string;
  name: string;
  category: string;
  width: number;
  height: number;
  gridSize: number;
  dataUrl: string;
  description?: string;
  tags?: string[];
}

// 1. Подземелье: Зал Стражей и Алтарь
function createDungeonSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
    <defs>
      <pattern id="stone" width="80" height="80" patternUnits="userSpaceOnUse">
        <rect width="80" height="80" fill="#141923" />
        <path d="M0 0h80v80H0z" fill="none" stroke="#0e121a" stroke-width="2"/>
        <circle cx="20" cy="20" r="1.5" fill="#334155" opacity="0.4"/>
        <circle cx="60" cy="50" r="2" fill="#334155" opacity="0.4"/>
      </pattern>
      <pattern id="flagstone" width="100" height="100" patternUnits="userSpaceOnUse">
        <rect width="100" height="100" fill="#242e3f" />
        <path d="M0 0h50v50H0zm50 50h50v50H50z" fill="#1e2634" opacity="0.6"/>
        <path d="M0 0h100v100H0z" fill="none" stroke="#161c28" stroke-width="2"/>
      </pattern>
    </defs>
    
    <!-- Базовый фон - скальная порода -->
    <rect width="1600" height="1200" fill="url(#stone)"/>
    
    <!-- Главный зал (Тронный зал) -->
    <rect x="200" y="180" width="640" height="840" rx="8" fill="url(#flagstone)" stroke="#0f172a" stroke-width="14"/>
    <circle cx="520" cy="600" r="130" fill="#1e293b" stroke="#475569" stroke-width="4"/>
    <circle cx="520" cy="600" r="50" fill="#3b82f6" opacity="0.3"/>
    
    <!-- Алтарь в северной части -->
    <rect x="440" y="240" width="160" height="70" rx="6" fill="#475569" stroke="#94a3b8" stroke-width="3"/>
    <circle cx="520" cy="275" r="14" fill="#dc2626" opacity="0.7"/>

    <!-- Колонны -->
    <circle cx="320" cy="360" r="26" fill="#0f172a" stroke="#64748b" stroke-width="5"/>
    <circle cx="720" cy="360" r="26" fill="#0f172a" stroke="#64748b" stroke-width="5"/>
    <circle cx="320" cy="840" r="26" fill="#0f172a" stroke="#64748b" stroke-width="5"/>
    <circle cx="720" cy="840" r="26" fill="#0f172a" stroke="#64748b" stroke-width="5"/>

    <!-- Коридор на восток -->
    <rect x="840" y="520" width="280" height="160" fill="url(#flagstone)" stroke="#0f172a" stroke-width="10"/>
    
    <!-- Сокровищница / Лаборатория -->
    <rect x="1120" y="260" width="400" height="680" rx="8" fill="url(#flagstone)" stroke="#0f172a" stroke-width="14"/>
    <rect x="1200" y="340" width="240" height="100" rx="4" fill="#475569" stroke="#0f172a" stroke-width="3"/>
    <!-- Магический круг призыва -->
    <circle cx="1320" cy="680" r="90" fill="#7c3aed" opacity="0.25" stroke="#a78bfa" stroke-width="3" stroke-dasharray="8 6"/>
    <polygon points="1320,610 1390,730 1250,730" fill="none" stroke="#c084fc" stroke-width="2"/>
    <polygon points="1320,750 1390,630 1250,630" fill="none" stroke="#c084fc" stroke-width="2"/>

    <!-- Коридор на юг -->
    <rect x="440" y="1020" width="160" height="180" fill="url(#flagstone)" stroke="#0f172a" stroke-width="10"/>

    <!-- Декоративные факелы (освещение) -->
    <circle cx="215" cy="300" r="8" fill="#f59e0b"/>
    <circle cx="215" cy="900" r="8" fill="#f59e0b"/>
    <circle cx="825" cy="300" r="8" fill="#f59e0b"/>
    <circle cx="825" cy="900" r="8" fill="#f59e0b"/>
    <circle cx="1135" cy="360" r="8" fill="#f59e0b"/>
    <circle cx="1135" cy="840" r="8" fill="#f59e0b"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// 2. Лесной Перекрёсток и Река
function createForestSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
    <defs>
      <linearGradient id="grass" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#14532d" />
        <stop offset="100%" stop-color="#166534" />
      </linearGradient>
      <linearGradient id="road" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#78350f" stop-opacity="0.9"/>
        <stop offset="50%" stop-color="#92400e" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="#78350f" stop-opacity="0.9"/>
      </linearGradient>
      <linearGradient id="river" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0369a1" />
        <stop offset="100%" stop-color="#0284c7" />
      </linearGradient>
    </defs>
    
    <!-- Трава / Почва -->
    <rect width="1600" height="1200" fill="url(#grass)"/>
    
    <!-- Извилистая река -->
    <path d="M 0 300 C 400 350, 600 100, 1000 200 C 1300 280, 1450 150, 1600 180 L 1600 400 C 1450 370, 1300 500, 1000 420 C 600 320, 400 570, 0 520 Z" fill="url(#river)"/>
    
    <!-- Грунтовая дорога -->
    <path d="M 500 0 C 520 400, 750 600, 800 1200" fill="none" stroke="url(#road)" stroke-width="140" stroke-linecap="round"/>
    
    <!-- Боковое ответвление дороги -->
    <path d="M 640 450 C 900 480, 1150 600, 1600 650" fill="none" stroke="url(#road)" stroke-width="90" stroke-linecap="round"/>

    <!-- Деревянный мост через реку -->
    <rect x="510" y="310" width="180" height="110" rx="4" fill="#582f0e" stroke="#371d06" stroke-width="5" transform="rotate(-15 600 365)"/>
    
    <!-- Деревья и кустарники -->
    <circle cx="180" cy="140" r="95" fill="#052e16" stroke="#15803d" stroke-width="6"/>
    <circle cx="340" cy="180" r="75" fill="#052e16" stroke="#15803d" stroke-width="6"/>
    <circle cx="240" cy="820" r="115" fill="#052e16" stroke="#15803d" stroke-width="8"/>
    <circle cx="1220" cy="870" r="135" fill="#052e16" stroke="#15803d" stroke-width="8"/>
    <circle cx="1400" cy="740" r="90" fill="#052e16" stroke="#15803d" stroke-width="6"/>
    <circle cx="1320" cy="240" r="105" fill="#052e16" stroke="#15803d" stroke-width="6"/>
    <circle cx="950" cy="980" r="90" fill="#052e16" stroke="#15803d" stroke-width="6"/>

    <!-- Засада / Лагерь разбойников -->
    <circle cx="1060" cy="750" r="22" fill="#ea580c" stroke="#f97316" stroke-width="4"/>
    <rect x="960" y="680" width="65" height="55" fill="#a16207" stroke="#713f12" stroke-width="3"/>
    <rect x="1110" y="800" width="75" height="55" fill="#a16207" stroke="#713f12" stroke-width="3"/>
    <rect x="1150" y="700" width="40" height="40" fill="#78350f" stroke="#451a03" stroke-width="2"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// 3. Таверна «Пьяный Дракон»
function createTavernSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
    <defs>
      <pattern id="woodfloor" width="120" height="40" patternUnits="userSpaceOnUse">
        <rect width="120" height="40" fill="#78350f"/>
        <path d="M0 0h120v40H0z" fill="none" stroke="#451a03" stroke-width="2"/>
        <line x1="60" y1="0" x2="60" y2="40" stroke="#451a03" stroke-width="1.5"/>
      </pattern>
    </defs>
    <rect width="1600" height="1200" fill="#1c1917"/>
    
    <!-- Стены таверны -->
    <rect x="220" y="140" width="1160" height="920" rx="8" fill="url(#woodfloor)" stroke="#292524" stroke-width="22"/>
    
    <!-- Барная стойка -->
    <path d="M 380 280 L 880 280 L 880 440" fill="none" stroke="#451a03" stroke-width="48" stroke-linecap="square"/>
    <!-- Табуреты у бара -->
    <circle cx="410" cy="340" r="15" fill="#9a3412"/>
    <circle cx="510" cy="340" r="15" fill="#9a3412"/>
    <circle cx="610" cy="340" r="15" fill="#9a3412"/>
    <circle cx="710" cy="340" r="15" fill="#9a3412"/>
    <circle cx="810" cy="340" r="15" fill="#9a3412"/>
    <circle cx="920" cy="390" r="15" fill="#9a3412"/>

    <!-- Бочки за стойкой -->
    <circle cx="420" cy="220" r="22" fill="#78350f" stroke="#451a03" stroke-width="3"/>
    <circle cx="480" cy="220" r="22" fill="#78350f" stroke="#451a03" stroke-width="3"/>
    <circle cx="540" cy="220" r="22" fill="#78350f" stroke="#451a03" stroke-width="3"/>

    <!-- Столы со стульями -->
    <circle cx="460" cy="700" r="55" fill="#582f0e" stroke="#292524" stroke-width="4"/>
    <circle cx="390" cy="700" r="15" fill="#9a3412"/>
    <circle cx="530" cy="700" r="15" fill="#9a3412"/>
    <circle cx="460" cy="630" r="15" fill="#9a3412"/>
    <circle cx="460" cy="770" r="15" fill="#9a3412"/>

    <circle cx="800" cy="700" r="55" fill="#582f0e" stroke="#292524" stroke-width="4"/>
    <circle cx="730" cy="700" r="15" fill="#9a3412"/>
    <circle cx="870" cy="700" r="15" fill="#9a3412"/>
    <circle cx="800" cy="630" r="15" fill="#9a3412"/>
    <circle cx="800" cy="770" r="15" fill="#9a3412"/>

    <!-- Длинный банкетный стол -->
    <rect x="1000" y="540" width="240" height="100" rx="8" fill="#582f0e" stroke="#292524" stroke-width="4"/>
    <circle cx="1030" cy="500" r="15" fill="#9a3412"/>
    <circle cx="1120" cy="500" r="15" fill="#9a3412"/>
    <circle cx="1210" cy="500" r="15" fill="#9a3412"/>
    <circle cx="1030" cy="680" r="15" fill="#9a3412"/>
    <circle cx="1120" cy="680" r="15" fill="#9a3412"/>
    <circle cx="1210" cy="680" r="15" fill="#9a3412"/>

    <!-- Большой камин -->
    <rect x="1310" y="340" width="70" height="220" fill="#7f1d1d" stroke="#450a0a" stroke-width="6"/>
    <path d="M 1335 390 Q 1355 450 1335 510" fill="none" stroke="#f97316" stroke-width="14" stroke-linecap="round"/>

    <!-- Лестница на второй этаж -->
    <rect x="1220" y="850" width="140" height="180" fill="#451a03" stroke="#292524" stroke-width="4"/>
    <line x1="1220" y1="880" x2="1360" y2="880" stroke="#78350f" stroke-width="4"/>
    <line x1="1220" y1="910" x2="1360" y2="910" stroke="#78350f" stroke-width="4"/>
    <line x1="1220" y1="940" x2="1360" y2="940" stroke="#78350f" stroke-width="4"/>
    <line x1="1220" y1="970" x2="1360" y2="970" stroke="#78350f" stroke-width="4"/>
    <line x1="1220" y1="1000" x2="1360" y2="1000" stroke="#78350f" stroke-width="4"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// 4. Пещеры Контрабандистов и Подземное Озеро
function createCaveSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
    <defs>
      <linearGradient id="rock" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#1e293b" />
      </linearGradient>
      <linearGradient id="deepwater" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#082f49" />
        <stop offset="100%" stop-color="#0369a1" />
      </linearGradient>
    </defs>
    <!-- Базовый черный грот -->
    <rect width="1600" height="1200" fill="#090d16"/>
    
    <!-- Главная пещера -->
    <path d="M 250 200 C 500 100, 900 150, 1100 250 C 1350 350, 1450 650, 1300 900 C 1150 1100, 700 1050, 450 950 C 200 850, 150 500, 250 200 Z" fill="url(#rock)" stroke="#334155" stroke-width="8"/>
    
    <!-- Подземное озеро -->
    <path d="M 600 450 C 850 400, 1100 500, 1150 700 C 1200 850, 950 950, 750 900 C 550 850, 500 600, 600 450 Z" fill="url(#deepwater)" stroke="#0284c7" stroke-width="4"/>
    
    <!-- Тоннели и проходы -->
    <path d="M 200 550 C 50 550, 50 700, 200 700" fill="none" stroke="url(#rock)" stroke-width="120"/>
    <path d="M 1200 300 C 1500 250, 1550 400, 1350 450" fill="none" stroke="url(#rock)" stroke-width="100"/>
    
    <!-- Лодка контрабандистов и сундуки -->
    <ellipse cx="680" cy="520" rx="35" ry="18" fill="#78350f" stroke="#451a03" stroke-width="3" transform="rotate(25 680 520)"/>
    <rect x="420" y="750" width="45" height="30" fill="#a16207" stroke="#451a03" stroke-width="2"/>
    <rect x="480" y="770" width="40" height="30" fill="#a16207" stroke="#451a03" stroke-width="2"/>
    <circle cx="380" cy="400" r="18" fill="#1e293b" stroke="#64748b" stroke-width="4"/>
    <circle cx="450" cy="350" r="22" fill="#1e293b" stroke="#64748b" stroke-width="4"/>
    <circle cx="1000" cy="300" r="26" fill="#1e293b" stroke="#64748b" stroke-width="4"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// 5. Руины Древней Крепости
function createCastleRuinsSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
    <defs>
      <linearGradient id="ground" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#334155" />
        <stop offset="100%" stop-color="#1e293b" />
      </linearGradient>
    </defs>
    <rect width="1600" height="1200" fill="url(#ground)"/>
    
    <!-- Замковый двор -->
    <rect x="250" y="150" width="1100" height="900" fill="#475569" stroke="#0f172a" stroke-width="16"/>
    
    <!-- Разрушенные башни по углам -->
    <circle cx="250" cy="150" r="80" fill="#334155" stroke="#0f172a" stroke-width="12"/>
    <circle cx="1350" cy="150" r="80" fill="#334155" stroke="#0f172a" stroke-width="12"/>
    <circle cx="250" cy="1050" r="80" fill="#334155" stroke="#0f172a" stroke-width="12"/>
    <!-- Разрушенная башня (пролом) -->
    <path d="M 1300 1000 A 70 70 0 1 1 1400 1100" fill="none" stroke="#0f172a" stroke-width="12"/>

    <!-- Разрушенный тронный зал -->
    <rect x="500" y="300" width="600" height="400" fill="#1e293b" stroke="#0f172a" stroke-width="8"/>
    <!-- Проломы в стенах -->
    <circle cx="800" cy="500" r="90" fill="#0f172a" opacity="0.4"/>
    <rect x="740" y="340" width="120" height="50" fill="#64748b" stroke="#0f172a" stroke-width="3"/>
    
    <!-- Упавшие колонны -->
    <rect x="580" y="420" width="140" height="30" rx="6" fill="#94a3b8" stroke="#0f172a" stroke-width="3" transform="rotate(30 580 420)"/>
    <rect x="880" y="580" width="120" height="30" rx="6" fill="#94a3b8" stroke="#0f172a" stroke-width="3" transform="rotate(-15 880 580)"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// 6. Городской Рынок и Ратушная Площадь
function createCityMarketSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
    <defs>
      <pattern id="cobble" width="60" height="60" patternUnits="userSpaceOnUse">
        <rect width="60" height="60" fill="#57534e"/>
        <circle cx="15" cy="15" r="12" fill="#44403c" stroke="#292524" stroke-width="2"/>
        <circle cx="45" cy="45" r="12" fill="#44403c" stroke="#292524" stroke-width="2"/>
        <circle cx="45" cy="15" r="10" fill="#3f3f46" stroke="#292524" stroke-width="2"/>
        <circle cx="15" cy="45" r="10" fill="#3f3f46" stroke="#292524" stroke-width="2"/>
      </pattern>
    </defs>
    <rect width="1600" height="1200" fill="url(#cobble)"/>
    
    <!-- Центральный фонтан / колодец -->
    <circle cx="800" cy="600" r="110" fill="#0284c7" stroke="#292524" stroke-width="12"/>
    <circle cx="800" cy="600" r="60" fill="#38bdf8" stroke="#0369a1" stroke-width="4"/>
    
    <!-- Торговые палатки -->
    <!-- Палатка 1 (Красная) -->
    <rect x="350" y="300" width="160" height="100" rx="4" fill="#dc2626" stroke="#991b1b" stroke-width="4"/>
    <rect x="370" y="410" width="120" height="30" fill="#78350f" stroke="#451a03" stroke-width="2"/>
    <!-- Палатка 2 (Синяя) -->
    <rect x="1090" y="300" width="160" height="100" rx="4" fill="#2563eb" stroke="#1d4ed8" stroke-width="4"/>
    <rect x="1110" y="410" width="120" height="30" fill="#78350f" stroke="#451a03" stroke-width="2"/>
    <!-- Палатка 3 (Зеленая) -->
    <rect x="350" y="800" width="160" height="100" rx="4" fill="#16a34a" stroke="#15803d" stroke-width="4"/>
    <rect x="370" y="760" width="120" height="30" fill="#78350f" stroke="#451a03" stroke-width="2"/>
    <!-- Палатка 4 (Желтая) -->
    <rect x="1090" y="800" width="160" height="100" rx="4" fill="#ca8a04" stroke="#a16207" stroke-width="4"/>
    <rect x="1110" y="760" width="120" height="30" fill="#78350f" stroke="#451a03" stroke-width="2"/>

    <!-- Здания вокруг площади -->
    <rect x="0" y="0" width="1600" height="160" fill="#292524" stroke="#1c1917" stroke-width="10"/>
    <rect x="0" y="1040" width="1600" height="160" fill="#292524" stroke="#1c1917" stroke-width="10"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// 7. Святилище Подземья (Underdark Chasm)
function createUnderdarkSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
    <defs>
      <radialGradient id="bioglow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="#3b0764" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <!-- Бездна -->
    <rect width="1600" height="1200" fill="#030712"/>
    
    <!-- Бездонный разлом по диагонали -->
    <path d="M 0 800 C 500 700, 900 400, 1600 300 L 1600 600 C 1000 700, 600 1000, 0 1100 Z" fill="#000000" stroke="#581c87" stroke-width="4"/>
    
    <!-- Скальные платформы -->
    <path d="M 0 0 L 1600 0 L 1600 280 C 1000 380, 500 680, 0 780 Z" fill="#1e1b4b" stroke="#312e81" stroke-width="8"/>
    <path d="M 0 1120 C 600 1020, 1000 720, 1600 620 L 1600 1200 L 0 1200 Z" fill="#1e1b4b" stroke="#312e81" stroke-width="8"/>

    <!-- Древний обсидиановый мост через пропасть -->
    <rect x="750" y="320" width="100" height="420" rx="4" fill="#0f172a" stroke="#a855f7" stroke-width="4" transform="rotate(-35 800 530)"/>

    <!-- Биолюминесцентные гигантские грибы -->
    <circle cx="350" cy="300" r="70" fill="url(#bioglow)"/>
    <circle cx="350" cy="300" r="35" fill="#a855f7" stroke="#e9d5ff" stroke-width="3"/>
    <circle cx="1250" cy="200" r="80" fill="url(#bioglow)"/>
    <circle cx="1250" cy="200" r="40" fill="#06b6d4" stroke="#cffafe" stroke-width="3"/>
    <circle cx="450" cy="1050" r="90" fill="url(#bioglow)"/>
    <circle cx="450" cy="1050" r="45" fill="#10b981" stroke="#a7f3d0" stroke-width="3"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// 8. Деревенская Усадьба и Мельница
function createVillageManorSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
    <defs>
      <linearGradient id="fields" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3f6212" />
        <stop offset="100%" stop-color="#4d7c0f" />
      </linearGradient>
    </defs>
    <rect width="1600" height="1200" fill="url(#fields)"/>
    
    <!-- Мельничный ручей -->
    <path d="M 1200 0 C 1150 400, 1300 800, 1100 1200" fill="none" stroke="#0284c7" stroke-width="120"/>

    <!-- Водяная мельница -->
    <rect x="1000" y="450" width="220" height="160" rx="6" fill="#78350f" stroke="#451a03" stroke-width="6"/>
    <!-- Лопасти мельничного колеса -->
    <circle cx="1230" cy="530" r="45" fill="#451a03" stroke="#9a3412" stroke-width="6"/>

    <!-- Главный дом поместья -->
    <rect x="250" y="200" width="400" height="300" rx="8" fill="#854d0e" stroke="#422006" stroke-width="8"/>
    <rect x="350" y="200" width="200" height="80" fill="#a16207" stroke="#422006" stroke-width="4"/>

    <!-- Амбар / Конюшня -->
    <rect x="250" y="650" width="300" height="220" rx="6" fill="#713f12" stroke="#422006" stroke-width="6"/>

    <!-- Огороды и поля пшеницы -->
    <rect x="650" y="700" width="350" height="350" fill="#ca8a04" stroke="#854d0e" stroke-width="4" stroke-dasharray="10 5"/>
    <line x1="650" y1="770" x2="1000" y2="770" stroke="#854d0e" stroke-width="2"/>
    <line x1="650" y1="840" x2="1000" y2="840" stroke="#854d0e" stroke-width="2"/>
    <line x1="650" y1="910" x2="1000" y2="910" stroke="#854d0e" stroke-width="2"/>
    <line x1="650" y1="980" x2="1000" y2="980" stroke="#854d0e" stroke-width="2"/>

    <!-- Заборы вокруг двора -->
    <rect x="180" y="140" width="900" height="920" fill="none" stroke="#582f0e" stroke-width="4" stroke-dasharray="12 6"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PRESET_MAPS: PresetMap[] = [
  {
    id: 'tavern',
    name: 'Таверна «Пьяный Дракон»',
    category: 'Помещение',
    width: 1600,
    height: 1200,
    gridSize: 70,
    dataUrl: createTavernSvg(),
    description: 'Уютный постоялый двор с барной стойкой, камином, банкетным залом и лестницей на второй этаж.',
    tags: ['Таверна', 'Город', 'Помещение', 'Социал'],
  },
  {
    id: 'dungeon',
    name: 'Подземелье: Зал Стражей и Алтарь',
    category: 'Подземелье',
    width: 1600,
    height: 1200,
    gridSize: 70,
    dataUrl: createDungeonSvg(),
    description: 'Классическое каменное подземелье с тронным залом, колоннадой, алтарем и магическим кругом.',
    tags: ['Подземелье', 'Босс', 'Алтарь', 'Магия'],
  },
  {
    id: 'forest',
    name: 'Лесной Перекрёсток и Засада у Реки',
    category: 'Природа',
    width: 1600,
    height: 1200,
    gridSize: 70,
    dataUrl: createForestSvg(),
    description: 'Лесная дорога, река с мостом, густые заросли и замаскированный лагерь разбойников.',
    tags: ['Лес', 'Река', 'Засада', 'Дорога'],
  },
  {
    id: 'cave',
    name: 'Пещеры Контрабандистов и Подземное Озеро',
    category: 'Пещера',
    width: 1600,
    height: 1200,
    gridSize: 70,
    dataUrl: createCaveSvg(),
    description: 'Глубокий грот с естественным подземным озером, лодкой и спрятанными сундуками с добычей.',
    tags: ['Пещера', 'Озеро', 'Тайник', 'Контрабанда'],
  },
  {
    id: 'castle_ruins',
    name: 'Руины Древней Крепости (Замковый Двор)',
    category: 'Подземелье',
    width: 1600,
    height: 1200,
    gridSize: 70,
    dataUrl: createCastleRuinsSvg(),
    description: 'Обрушенные замковые стены, полуразрушенные башни и упавшие колонны в тронном зале.',
    tags: ['Руины', 'Замок', 'Крепость', 'Битва'],
  },
  {
    id: 'city_market',
    name: 'Городской Рынок и Ратушная Площадь',
    category: 'Город',
    width: 1600,
    height: 1200,
    gridSize: 60,
    dataUrl: createCityMarketSvg(),
    description: 'Мощеная рыночная площадь со старинным фонтаном, разноцветными торговыми палатками и лавками.',
    tags: ['Город', 'Рынок', 'Торговля', 'Площадь'],
  },
  {
    id: 'underdark',
    name: 'Святилище Подземья (Underdark Chasm)',
    category: 'Пещера',
    width: 1600,
    height: 1200,
    gridSize: 70,
    dataUrl: createUnderdarkSvg(),
    description: 'Мрачные глубины Подземья: бездонная пропасть, обсидиановый мост и гигантские светящиеся грибы.',
    tags: ['Подземье', 'Underdark', 'Грибы', 'Пропасть'],
  },
  {
    id: 'village_manor',
    name: 'Деревенская Усадьба и Мельница',
    category: 'Природа',
    width: 1600,
    height: 1200,
    gridSize: 65,
    dataUrl: createVillageManorSvg(),
    description: 'Сельское поместье с водяной мельницей на ручье, конюшней, огородами и деревянными изгородями.',
    tags: ['Деревня', 'Мельница', 'Поместье', 'Ферма'],
  },
];

