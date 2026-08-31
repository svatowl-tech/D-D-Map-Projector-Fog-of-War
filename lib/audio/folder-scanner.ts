/**
 * Сканер локальных папок с музыкой и создание плейлистов
 * Поддерживает webkitdirectory, Drag-and-Drop папок и File System Access API
 */

import { AudioPlaylist, AudioTrack } from './types';

// Поддерживаемые аудиоформаты
const SUPPORTED_AUDIO_EXTS = ['.mp3', '.ogg', '.wav', '.m4a', '.flac', '.aac', '.webm', '.opus'];

function isAudioFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SUPPORTED_AUDIO_EXTS.some((ext) => lower.endsWith(ext));
}

// Определение категории и иконки по имени подпапки
function detectPlaylistMeta(folderName: string): {
  category: AudioPlaylist['category'];
  icon: string;
  color: string;
} {
  const lower = folderName.toLowerCase().trim();

  if (/босс|boss|дракон|dragon|epic combat|final battle/i.test(lower)) {
    return { category: 'boss', icon: '🐉', color: '#dc2626' };
  }
  if (/битв|бой|боев|combat|fight|battle|war|encounter|атака/i.test(lower)) {
    return { category: 'combat', icon: '⚔️', color: '#ef4444' };
  }
  if (/таверн|трактир|tavern|inn|fest|пир|эль|lute|bar/i.test(lower)) {
    return { category: 'tavern', icon: '🍺', color: '#f59e0b' };
  }
  if (/подземел|склеп|пещер|dungeon|crypt|cave|tomb|катакомб/i.test(lower)) {
    return { category: 'dungeon', icon: '🕯️', color: '#8b5cf6' };
  }
  if (/город|рынок|улиц|city|town|market|plaza|замок|castle/i.test(lower)) {
    return { category: 'city', icon: '🏰', color: '#38bdf8' };
  }
  if (/мистик|тьма|мрак|horror|mystery|dark|nightmare|некро/i.test(lower)) {
    return { category: 'horror', icon: '🔮', color: '#a855f7' };
  }
  if (/привал|лагерь|костер|покой|camp|rest|peace|сон/i.test(lower)) {
    return { category: 'ambient', icon: '⛺', color: '#06b6d4' };
  }
  if (/исследован|путешеств|дорог|лес|природ|travel|forest|wilderness|journey|road/i.test(lower)) {
    return { category: 'exploration', icon: '🌲', color: '#10b981' };
  }

  return { category: 'custom', icon: '🎵', color: '#e2e8f0' };
}

// Очистка названия трека от префиксов нумерации ("01 - ", "02_", etc.)
export function cleanTrackTitle(filename: string): string {
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  return withoutExt.replace(/^\d+[\s._-]+/, '').trim() || withoutExt;
}

// Перемешивание массива (Fisher-Yates)
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Сканирование папки из стандартного input[type=file] с webkitdirectory
 */
export async function scanFilesToPlaylists(files: FileList | File[]): Promise<AudioPlaylist[]> {
  const fileArray = Array.from(files);
  const audioFiles = fileArray.filter((f) => isAudioFile(f.name));

  if (audioFiles.length === 0) {
    return [];
  }

  // Группировка файлов по относительным подпапкам
  // webkitRelativePath имеет вид: "Музыка_Кампании/Битва/battle1.mp3"
  const folderGroups: Map<string, File[]> = new Map();

  audioFiles.forEach((file) => {
    let folderName = 'Основной плейлист';

    const relativePath = (file as unknown as { webkitRelativePath?: string }).webkitRelativePath || '';
    if (relativePath) {
      const parts = relativePath.split('/');
      if (parts.length >= 3) {
        // parts[0] - корневая папка, parts[1] - подпапка плейлиста
        folderName = parts[1];
      } else if (parts.length === 2) {
        folderName = parts[0];
      }
    }

    if (!folderGroups.has(folderName)) {
      folderGroups.set(folderName, []);
    }
    folderGroups.get(folderName)!.push(file);
  });

  const playlists: AudioPlaylist[] = [];

  for (const [folderName, filesInFolder] of folderGroups.entries()) {
    const meta = detectPlaylistMeta(folderName);
    const playlistId = `playlist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const tracks: AudioTrack[] = filesInFolder.map((file, idx) => {
      const trackId = `track_${playlistId}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
      const url = URL.createObjectURL(file);
      const title = cleanTrackTitle(file.name);

      return {
        id: trackId,
        title,
        folderPath: folderName,
        playlistId,
        playlistName: folderName,
        file,
        url,
        duration: 180, // Оценка по умолчанию до загрузки метаданных
        size: file.size,
        format: file.name.split('.').pop()?.toUpperCase() || 'AUDIO',
      };
    });

    const trackIds = tracks.map((t) => t.id);

    playlists.push({
      id: playlistId,
      name: folderName,
      category: meta.category,
      icon: meta.icon,
      color: meta.color,
      trackCount: tracks.length,
      tracks,
      shuffledQueue: shuffleArray(trackIds),
      currentIndex: 0,
    });
  }

  // Сортировка: Битвы и боссы первыми, затем Таверны, Города, Исследования, Подземелья
  const categoryPriority: Record<string, number> = {
    boss: 1,
    combat: 2,
    tavern: 3,
    exploration: 4,
    dungeon: 5,
    city: 6,
    horror: 7,
    ambient: 8,
    custom: 9,
  };

  playlists.sort((a, b) => {
    const pA = categoryPriority[a.category || 'custom'] || 10;
    const pB = categoryPriority[b.category || 'custom'] || 10;
    return pA - pB || a.name.localeCompare(b.name);
  });

  return playlists;
}

/**
 * Создание встроенных атмосферных D&D пресетов музыки (готовность без файлов)
 */
export function getBuiltinDemoPlaylists(): AudioPlaylist[] {
  // Для автономной работы без локальных файлов генерируются зацикленные звуковые полотна
  const presets = [
    {
      name: 'Битва & Сражение',
      category: 'combat' as const,
      icon: '⚔️',
      color: '#ef4444',
      tracks: [
        { title: 'Барабаны ярости варвара', duration: 165 },
        { title: 'Сталь и магия (Бой)', duration: 195 },
        { title: 'Осада крепости гоблинов', duration: 180 },
        { title: 'Шквал стрел и заклинаний', duration: 210 },
      ],
    },
    {
      name: 'Битва с Боссом',
      category: 'boss' as const,
      icon: '🐉',
      color: '#dc2626',
      tracks: [
        { title: 'Пробуждение древнего красного дракона', duration: 240 },
        { title: 'Гнев лича в осквернённом храме', duration: 220 },
        { title: 'Абсолютный хаос бездны', duration: 260 },
      ],
    },
    {
      name: 'Уютная Таверна',
      category: 'tavern' as const,
      icon: '🍺',
      color: '#f59e0b',
      tracks: [
        { title: 'Лютня пьяного барда', duration: 140 },
        { title: 'Песнь у очага трактирщика', duration: 175 },
        { title: 'Кружка доброго медовухи', duration: 155 },
        { title: 'Танцы полуросликов', duration: 130 },
      ],
    },
    {
      name: 'Исследование & Дорога',
      category: 'exploration' as const,
      icon: '🌲',
      color: '#10b981',
      tracks: [
        { title: 'Шёпот древнего эльфийского леса', duration: 210 },
        { title: 'Караван через забытый перевал', duration: 240 },
        { title: 'Рассвет над холмами Королевства', duration: 190 },
      ],
    },
    {
      name: 'Тёмное Подземелье',
      category: 'dungeon' as const,
      icon: '🕯️',
      color: '#8b5cf6',
      tracks: [
        { title: 'Капли и эхо сырого склепа', duration: 230 },
        { title: 'Забытые коридоры подземья', duration: 250 },
        { title: 'Тени за каменной дверью', duration: 215 },
      ],
    },
    {
      name: 'Шумный Город & Рынок',
      category: 'city' as const,
      icon: '🏰',
      color: '#38bdf8',
      tracks: [
        { title: 'Торговая площадь Врат Балдура', duration: 180 },
        { title: 'Стража у королевских ворот', duration: 160 },
        { title: 'Шёпот переулков воров', duration: 195 },
      ],
    },
  ];

  return presets.map((p, pIdx) => {
    const playlistId = `builtin_playlist_${pIdx}`;
    const tracks: AudioTrack[] = p.tracks.map((t, tIdx) => ({
      id: `builtin_track_${pIdx}_${tIdx}`,
      title: t.title,
      folderPath: p.name,
      playlistId,
      playlistName: p.name,
      url: '', // Воспроизводится процедурным атмосферным генератором
      duration: t.duration,
      isSynthetic: true,
    }));

    return {
      id: playlistId,
      name: p.name,
      category: p.category,
      icon: p.icon,
      color: p.color,
      trackCount: tracks.length,
      tracks,
      shuffledQueue: tracks.map((t) => t.id),
      currentIndex: 0,
    };
  });
}
