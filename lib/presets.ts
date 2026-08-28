/**
 * Встроенные тактические пресеты карт (легковесные векторные карты для мгновенного старта).
 * Не расходуют оперативную память и работают абсолютно автономно без интернета.
 */

export interface PresetMap {
  id: string;
  name: string;
  category: string;
  width: number;
  height: number;
  gridSize: number;
  dataUrl: string;
}

// Генерация чистого SVG-данных для тактической карты подземелья
function createDungeonSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
    <defs>
      <pattern id="stone" width="80" height="80" patternUnits="userSpaceOnUse">
        <rect width="80" height="80" fill="#1e2430" />
        <path d="M0 0h80v80H0z" fill="none" stroke="#141820" stroke-width="2"/>
        <circle cx="20" cy="20" r="1.5" fill="#334155" opacity="0.4"/>
        <circle cx="60" cy="50" r="2" fill="#334155" opacity="0.4"/>
      </pattern>
      <pattern id="flagstone" width="100" height="100" patternUnits="userSpaceOnUse">
        <rect width="100" height="100" fill="#2d3748" />
        <path d="M0 0h50v50H0zm50 50h50v50H50z" fill="#374151" opacity="0.5"/>
        <path d="M0 0h100v100H0z" fill="none" stroke="#1f2937" stroke-width="2"/>
      </pattern>
    </defs>
    
    <!-- Базовый фон - скальная порода -->
    <rect width="1600" height="1200" fill="url(#stone)"/>
    
    <!-- Главный зал (Тронный зал) -->
    <rect x="200" y="200" width="600" height="800" rx="8" fill="url(#flagstone)" stroke="#0f172a" stroke-width="12"/>
    <circle cx="500" cy="600" r="120" fill="#1e293b" stroke="#475569" stroke-width="4"/>
    <circle cx="500" cy="600" r="40" fill="#3b82f6" opacity="0.3"/>
    <!-- Колонны -->
    <circle cx="300" cy="350" r="24" fill="#0f172a" stroke="#64748b" stroke-width="4"/>
    <circle cx="700" cy="350" r="24" fill="#0f172a" stroke="#64748b" stroke-width="4"/>
    <circle cx="300" cy="850" r="24" fill="#0f172a" stroke="#64748b" stroke-width="4"/>
    <circle cx="700" cy="850" r="24" fill="#0f172a" stroke="#64748b" stroke-width="4"/>

    <!-- Коридор на восток -->
    <rect x="800" y="520" width="300" height="160" fill="url(#flagstone)" stroke="#0f172a" stroke-width="10"/>
    
    <!-- Сокровищница / Лаборатория -->
    <rect x="1100" y="300" width="400" height="600" rx="8" fill="url(#flagstone)" stroke="#0f172a" stroke-width="12"/>
    <rect x="1180" y="380" width="240" height="100" rx="4" fill="#475569" stroke="#0f172a" stroke-width="3"/>
    <circle cx="1300" cy="700" r="70" fill="#7c3aed" opacity="0.25" stroke="#a78bfa" stroke-width="2" stroke-dasharray="8 4"/>

    <!-- Коридор на юг -->
    <rect x="420" y="1000" width="160" height="150" fill="url(#flagstone)" stroke="#0f172a" stroke-width="10"/>

    <!-- Декоративные факелы -->
    <circle cx="215" cy="300" r="6" fill="#f59e0b"/>
    <circle cx="215" cy="900" r="6" fill="#f59e0b"/>
    <circle cx="785" cy="300" r="6" fill="#f59e0b"/>
    <circle cx="785" cy="900" r="6" fill="#f59e0b"/>
    <circle cx="1115" cy="400" r="6" fill="#f59e0b"/>
    <circle cx="1115" cy="800" r="6" fill="#f59e0b"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Генерация лесной засады
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
    
    <!-- Трава / Земля -->
    <rect width="1600" height="1200" fill="url(#grass)"/>
    
    <!-- Извилистая река -->
    <path d="M 0 300 C 400 350, 600 100, 1000 200 C 1300 280, 1450 150, 1600 180 L 1600 380 C 1450 350, 1300 480, 1000 400 C 600 300, 400 550, 0 500 Z" fill="url(#river)"/>
    
    <!-- Грунтовая дорога -->
    <path d="M 500 0 C 520 400, 750 600, 800 1200" fill="none" stroke="url(#road)" stroke-width="140" stroke-linecap="round"/>
    
    <!-- Деревянный мост через реку -->
    <rect x="520" y="320" width="160" height="90" rx="4" fill="#582f0e" stroke="#371d06" stroke-width="4" transform="rotate(-15 600 365)"/>
    
    <!-- Деревья и кустарники -->
    <circle cx="200" cy="150" r="90" fill="#052e16" stroke="#15803d" stroke-width="6"/>
    <circle cx="340" cy="180" r="70" fill="#052e16" stroke="#15803d" stroke-width="6"/>
    <circle cx="250" cy="800" r="110" fill="#052e16" stroke="#15803d" stroke-width="8"/>
    <circle cx="1200" cy="850" r="130" fill="#052e16" stroke="#15803d" stroke-width="8"/>
    <circle cx="1380" cy="720" r="85" fill="#052e16" stroke="#15803d" stroke-width="6"/>
    <circle cx="1300" cy="250" r="100" fill="#052e16" stroke="#15803d" stroke-width="6"/>
    
    <!-- Лагерь у дороги -->
    <circle cx="1050" cy="750" r="20" fill="#ea580c" stroke="#f97316" stroke-width="4"/>
    <rect x="950" y="680" width="60" height="50" fill="#a16207" stroke="#713f12" stroke-width="2"/>
    <rect x="1100" y="800" width="70" height="50" fill="#a16207" stroke="#713f12" stroke-width="2"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Генерация таверны
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
    <rect x="250" y="150" width="1100" height="900" rx="8" fill="url(#woodfloor)" stroke="#292524" stroke-width="20"/>
    
    <!-- Барная стойка -->
    <path d="M 400 300 L 850 300 L 850 450" fill="none" stroke="#451a03" stroke-width="45" stroke-linecap="square"/>
    <!-- Табуреты у бара -->
    <circle cx="430" cy="350" r="14" fill="#9a3412"/>
    <circle cx="530" cy="350" r="14" fill="#9a3412"/>
    <circle cx="630" cy="350" r="14" fill="#9a3412"/>
    <circle cx="730" cy="350" r="14" fill="#9a3412"/>
    <circle cx="830" cy="350" r="14" fill="#9a3412"/>
    <circle cx="890" cy="420" r="14" fill="#9a3412"/>

    <!-- Столы со стульями -->
    <!-- Стол 1 -->
    <circle cx="480" cy="700" r="50" fill="#582f0e" stroke="#292524" stroke-width="4"/>
    <circle cx="410" cy="700" r="14" fill="#9a3412"/>
    <circle cx="550" cy="700" r="14" fill="#9a3412"/>
    <circle cx="480" cy="630" r="14" fill="#9a3412"/>
    <circle cx="480" cy="770" r="14" fill="#9a3412"/>

    <!-- Стол 2 -->
    <circle cx="800" cy="700" r="50" fill="#582f0e" stroke="#292524" stroke-width="4"/>
    <circle cx="730" cy="700" r="14" fill="#9a3412"/>
    <circle cx="870" cy="700" r="14" fill="#9a3412"/>
    <circle cx="800" cy="630" r="14" fill="#9a3412"/>
    <circle cx="800" cy="770" r="14" fill="#9a3412"/>

    <!-- Длинный банкетный стол -->
    <rect x="1000" y="550" width="220" height="90" rx="8" fill="#582f0e" stroke="#292524" stroke-width="4"/>
    <circle cx="1030" cy="510" r="14" fill="#9a3412"/>
    <circle cx="1110" cy="510" r="14" fill="#9a3412"/>
    <circle cx="1190" cy="510" r="14" fill="#9a3412"/>
    <circle cx="1030" cy="680" r="14" fill="#9a3412"/>
    <circle cx="1110" cy="680" r="14" fill="#9a3412"/>
    <circle cx="1190" cy="680" r="14" fill="#9a3412"/>

    <!-- Большой камин -->
    <rect x="1300" y="350" width="60" height="200" fill="#7f1d1d" stroke="#450a0a" stroke-width="6"/>
    <path d="M 1320 400 Q 1340 450 1320 500" fill="none" stroke="#f97316" stroke-width="12" stroke-linecap="round"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PRESET_MAPS: PresetMap[] = [
  {
    id: 'dungeon',
    name: 'Подземелье: Зал Стражей',
    category: 'Подземелье',
    width: 1600,
    height: 1200,
    gridSize: 70,
    dataUrl: createDungeonSvg(),
  },
  {
    id: 'forest',
    name: 'Лесной Перекрёсток и Река',
    category: 'Природа',
    width: 1600,
    height: 1200,
    gridSize: 70,
    dataUrl: createForestSvg(),
  },
  {
    id: 'tavern',
    name: 'Таверна «Пьяный Дракон»',
    category: 'Помещение',
    width: 1600,
    height: 1200,
    gridSize: 70,
    dataUrl: createTavernSvg(),
  },
];
