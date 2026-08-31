/**
 * Синтезатор звуковых эффектов (SFX) и фонового эмбиента на Web Audio API
 * Работает автономно без необходимости скачивания внешних файлов,
 * а также поддерживает воспроизведение пользовательских звуков.
 */

import { SoundEffect, AmbientLoop } from './types';

// Общий аудио-контекст для SFX
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Встроенные пресеты звуковых эффектов
export const BUILTIN_SFX_PRESETS: SoundEffect[] = [
  {
    id: 'sfx_d20_nat20',
    name: 'D20: Крит 20 (Успех)',
    category: 'd20',
    icon: '✨',
    color: '#fbbf24',
    hotkey: '1',
    synthPreset: 'nat20',
  },
  {
    id: 'sfx_d20_nat1',
    name: 'D20: Крит 1 (Провал)',
    category: 'd20',
    icon: '💀',
    color: '#ef4444',
    hotkey: '2',
    synthPreset: 'nat1',
  },
  {
    id: 'sfx_sword_clash',
    name: 'Удар мечей',
    category: 'combat',
    icon: '⚔️',
    color: '#38bdf8',
    hotkey: '3',
    synthPreset: 'sword',
  },
  {
    id: 'sfx_fireball',
    name: 'Огненный шар',
    category: 'magic',
    icon: '🔥',
    color: '#f97316',
    hotkey: '4',
    synthPreset: 'fireball',
  },
  {
    id: 'sfx_lightning',
    name: 'Удар молнии',
    category: 'magic',
    icon: '⚡',
    color: '#a855f7',
    hotkey: '5',
    synthPreset: 'lightning',
  },
  {
    id: 'sfx_heal',
    name: 'Лечение',
    category: 'magic',
    icon: '💚',
    color: '#10b981',
    hotkey: '6',
    synthPreset: 'heal',
  },
  {
    id: 'sfx_magic_missile',
    name: 'Магическая стрела',
    category: 'magic',
    icon: '🔮',
    color: '#ec4899',
    hotkey: '7',
    synthPreset: 'magic_missile',
  },
  {
    id: 'sfx_monster_roar',
    name: 'Рык чудовища',
    category: 'monster',
    icon: '🐉',
    color: '#e11d48',
    hotkey: '8',
    synthPreset: 'monster_roar',
  },
  {
    id: 'sfx_door_creak',
    name: 'Скрип двери',
    category: 'dungeon',
    icon: '🚪',
    color: '#94a3b8',
    hotkey: '9',
    synthPreset: 'door_creak',
  },
  {
    id: 'sfx_gold_coins',
    name: 'Звон монет',
    category: 'ambient',
    icon: '💰',
    color: '#facc15',
    hotkey: '0',
    synthPreset: 'coins',
  },
  {
    id: 'sfx_victory_fanfare',
    name: 'Фанфары победы',
    category: 'ambient',
    icon: '🎺',
    color: '#34d399',
    synthPreset: 'fanfare',
  },
  {
    id: 'sfx_wolf_howl',
    name: 'Волчий вой',
    category: 'monster',
    icon: '🐺',
    color: '#64748b',
    synthPreset: 'wolf',
  },
  {
    id: 'sfx_trap_trigger',
    name: 'Спуск ловушки',
    category: 'dungeon',
    icon: '🎯',
    color: '#f43f5e',
    synthPreset: 'trap',
  },
  {
    id: 'sfx_secret_discovered',
    name: 'Тайна раскрыта',
    category: 'dungeon',
    icon: '🗝️',
    color: '#60a5fa',
    synthPreset: 'secret',
  },
];

// Встроенные эмбиент-лупы
export const BUILTIN_AMBIENT_LOOPS: AmbientLoop[] = [
  {
    id: 'ambient_campfire',
    name: 'Костёр у лагеря',
    icon: '🪵',
    color: '#f97316',
    synthPreset: 'campfire',
    volume: 0.5,
    isPlaying: false,
  },
  {
    id: 'ambient_rain',
    name: 'Ливень и шторм',
    icon: '🌧️',
    color: '#38bdf8',
    synthPreset: 'rain',
    volume: 0.5,
    isPlaying: false,
  },
  {
    id: 'ambient_tavern',
    name: 'Шум таверны',
    icon: '🍺',
    color: '#eab308',
    synthPreset: 'tavern',
    volume: 0.4,
    isPlaying: false,
  },
  {
    id: 'ambient_dungeon',
    name: 'Гул подземелья',
    icon: '🕯️',
    color: '#a855f7',
    synthPreset: 'dungeon',
    volume: 0.45,
    isPlaying: false,
  },
  {
    id: 'ambient_wind',
    name: 'Холодный ветер',
    icon: '💨',
    color: '#94a3b8',
    synthPreset: 'wind',
    volume: 0.4,
    isPlaying: false,
  },
];

// Хранилище активных генераторов фоновых лупов
const activeAmbientNodes: Map<string, { stop: () => void; gainNode: GainNode }> = new Map();

/**
 * Проигрывание синтезированного звукового эффекта
 */
export function playSyntheticSFX(preset: string, volume: number = 0.8) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), now);
    masterGain.connect(ctx.destination);

    switch (preset) {
      case 'nat20': {
        // Торжественный золотой аккорд арпеджио (C major 7th -> High C)
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.05);

          noteGain.gain.setValueAtTime(0, now + idx * 0.05);
          noteGain.gain.linearRampToValueAtTime(0.3, now + idx * 0.05 + 0.03);
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 1.2);

          osc.connect(noteGain);
          noteGain.connect(masterGain);
          osc.start(now + idx * 0.05);
          osc.stop(now + idx * 0.05 + 1.3);
        });
        break;
      }

      case 'nat1': {
        // Зловещий низкий удар и нисходящий диссонанс
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const g = ctx.createGain();
        osc1.type = 'sawtooth';
        osc2.type = 'sine';

        osc1.frequency.setValueAtTime(160, now);
        osc1.frequency.exponentialRampToValueAtTime(45, now + 0.9);

        osc2.frequency.setValueAtTime(145, now);
        osc2.frequency.exponentialRampToValueAtTime(40, now + 0.9);

        g.gain.setValueAtTime(0.5, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

        osc1.connect(g);
        osc2.connect(g);
        g.connect(masterGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.2);
        osc2.stop(now + 1.2);
        break;
      }

      case 'sword': {
        // Металлический звон и скрежет
        const bufferSize = ctx.sampleRate * 0.4;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(3200, now);
        filter.Q.setValueAtTime(15, now);

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2400, now);
        osc.frequency.exponentialRampToValueAtTime(1800, now + 0.35);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.7, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        noise.connect(filter);
        filter.connect(g);
        osc.connect(g);
        g.connect(masterGain);

        noise.start(now);
        osc.start(now);
        noise.stop(now + 0.4);
        osc.stop(now + 0.4);
        break;
      }

      case 'fireball': {
        // Глубокий взрыв и шипение пламени
        const bufferSize = ctx.sampleRate * 1.5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(80, now + 1.2);

        const subOsc = ctx.createOscillator();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(120, now);
        subOsc.frequency.exponentialRampToValueAtTime(30, now + 1.0);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.9, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

        noise.connect(filter);
        filter.connect(g);
        subOsc.connect(g);
        g.connect(masterGain);

        noise.start(now);
        subOsc.start(now);
        noise.stop(now + 1.5);
        subOsc.stop(now + 1.5);
        break;
      }

      case 'lightning': {
        // Электрический треск и раскат грома
        const bufferSize = ctx.sampleRate * 1.8;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.5));
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1500, now);
        filter.frequency.linearRampToValueAtTime(200, now + 0.6);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.85, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.7);

        noise.connect(filter);
        filter.connect(g);
        g.connect(masterGain);

        noise.start(now);
        noise.stop(now + 1.8);
        break;
      }

      case 'heal': {
        // Кристальный исцеляющий перелив
        const freqs = [587.33, 739.99, 880.0, 1174.66, 1479.98];
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);

          g.gain.setValueAtTime(0, now + idx * 0.08);
          g.gain.linearRampToValueAtTime(0.35, now + idx * 0.08 + 0.05);
          g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.9);

          osc.connect(g);
          g.connect(masterGain);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 1.0);
        });
        break;
      }

      case 'magic_missile': {
        // Фазовый свист чародейской стрелы
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.exponentialRampToValueAtTime(2200, now + 0.15);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.45);

        g.gain.setValueAtTime(0.6, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.55);
        break;
      }

      case 'monster_roar': {
        // Низкочастотный рык дракона с частотной модуляцией
        const carrier = ctx.createOscillator();
        const modulator = ctx.createOscillator();
        const modGain = ctx.createGain();
        const masterOscGain = ctx.createGain();

        carrier.type = 'sawtooth';
        carrier.frequency.setValueAtTime(110, now);
        carrier.frequency.exponentialRampToValueAtTime(65, now + 1.2);

        modulator.type = 'sine';
        modulator.frequency.setValueAtTime(30, now);
        modulator.frequency.linearRampToValueAtTime(15, now + 1.2);

        modGain.gain.setValueAtTime(70, now);

        modulator.connect(carrier.frequency);

        masterOscGain.gain.setValueAtTime(0.8, now);
        masterOscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

        carrier.connect(masterOscGain);
        masterOscGain.connect(masterGain);

        modulator.start(now);
        carrier.start(now);
        modulator.stop(now + 1.4);
        carrier.stop(now + 1.4);
        break;
      }

      case 'door_creak': {
        // Скрип старой двери склепа
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(380, now + 0.3);
        osc.frequency.linearRampToValueAtTime(180, now + 0.7);

        g.gain.setValueAtTime(0.4, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.8);
        break;
      }

      case 'coins': {
        // Звон золотых монет
        const freqs = [3200, 3900, 4400];
        freqs.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + i * 0.04);

          g.gain.setValueAtTime(0.35, now + i * 0.04);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.3);

          osc.connect(g);
          g.connect(masterGain);
          osc.start(now + i * 0.04);
          osc.stop(now + i * 0.04 + 0.35);
        });
        break;
      }

      case 'fanfare': {
        // Победный мажорный аккорд духовых
        const chord = [392.0, 523.25, 659.25, 783.99];
        chord.forEach((f) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now);

          g.gain.setValueAtTime(0.35, now);
          g.gain.linearRampToValueAtTime(0.4, now + 0.1);
          g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

          osc.connect(g);
          g.connect(masterGain);
          osc.start(now);
          osc.stop(now + 1.3);
        });
        break;
      }

      case 'trap': {
        // Щелчок механизма и свист стрелы
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.2);

        g.gain.setValueAtTime(0.7, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }

      case 'secret': {
        // Таинственный аккорд колокольчиков
        const bells = [659.25, 830.61, 987.77, 1318.51];
        bells.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + i * 0.06);

          g.gain.setValueAtTime(0.3, now + i * 0.06);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 1.1);

          osc.connect(g);
          g.connect(masterGain);
          osc.start(now + i * 0.06);
          osc.stop(now + i * 0.06 + 1.2);
        });
        break;
      }

      default: {
        // Стандартный мелодичный клик
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
        g.gain.setValueAtTime(0.4, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      }
    }
  } catch (err) {
    console.warn('Ошибка воспроизведения синтетического SFX:', err);
  }
}

/**
 * Запуск/остановка фонового эмбиент-генератора
 */
export function toggleAmbientLoop(ambientId: string, preset: string, volume: number = 0.5): boolean {
  try {
    const ctx = getAudioContext();
    const existing = activeAmbientNodes.get(ambientId);

    if (existing) {
      existing.stop();
      activeAmbientNodes.delete(ambientId);
      return false;
    }

    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume * 0.5, now + 0.8);
    gainNode.connect(ctx.destination);

    let isRunning = true;
    const stopCallbacks: (() => void)[] = [];

    switch (preset) {
      case 'campfire': {
        // Костер: Розовый шум + случайные щелчки углей
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          data[i] = (b0 + b1 + b2) * 0.15;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);

        noise.connect(filter);
        filter.connect(gainNode);
        noise.start(now);
        stopCallbacks.push(() => {
          noise.stop();
          noise.disconnect();
        });
        break;
      }

      case 'rain': {
        // Ливень: фильтрованный белый шум + низкий рокот грома
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.3;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1800, now);
        filter.Q.setValueAtTime(0.5, now);

        noise.connect(filter);
        filter.connect(gainNode);
        noise.start(now);
        stopCallbacks.push(() => {
          noise.stop();
          noise.disconnect();
        });
        break;
      }

      case 'dungeon': {
        // Эхо склепа: ультранизкие синусоиды с легким биением частот
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(55, now); // A1
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(57.5, now); // биение 2.5 Гц

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        osc1.start(now);
        osc2.start(now);

        stopCallbacks.push(() => {
          osc1.stop();
          osc2.stop();
          osc1.disconnect();
          osc2.disconnect();
        });
        break;
      }

      case 'wind': {
        // Ветер: полосовой шум с медленной LFO модуляцией частоты среза
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.25;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(450, now);
        filter.Q.setValueAtTime(3.0, now);

        // LFO для покачивания ветра
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(0.2, now);
        lfoGain.gain.setValueAtTime(250, now);

        lfo.connect(filter.frequency);
        noise.connect(filter);
        filter.connect(gainNode);

        lfo.start(now);
        noise.start(now);

        stopCallbacks.push(() => {
          lfo.stop();
          noise.stop();
          lfo.disconnect();
          noise.disconnect();
        });
        break;
      }

      default: {
        // Общий теплый тон
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(110, now);
        osc.connect(gainNode);
        osc.start(now);
        stopCallbacks.push(() => {
          osc.stop();
          osc.disconnect();
        });
        break;
      }
    }

    activeAmbientNodes.set(ambientId, {
      gainNode,
      stop: () => {
        if (!isRunning) return;
        isRunning = false;
        const stopTime = ctx.currentTime;
        gainNode.gain.linearRampToValueAtTime(0.001, stopTime + 0.6);
        setTimeout(() => {
          stopCallbacks.forEach((cb) => cb());
          gainNode.disconnect();
        }, 700);
      },
    });

    return true;
  } catch (err) {
    console.warn('Ошибка запуска эмбиента:', err);
    return false;
  }
}

/**
 * Изменение громкости активного эмбиента
 */
export function setAmbientLoopVolume(ambientId: string, volume: number) {
  const active = activeAmbientNodes.get(ambientId);
  if (active && audioCtx) {
    active.gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, volume * 0.5)), audioCtx.currentTime);
  }
}

/**
 * Остановка всех звуков и эмбиентов
 */
export function stopAllAmbientLoops() {
  activeAmbientNodes.forEach((node) => {
    node.stop();
  });
  activeAmbientNodes.clear();
}
