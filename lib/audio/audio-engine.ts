/**
 * Профессиональный аудио-движок для D&D сессий
 * - Поддерживает реальные локальные файлы (Audio element + blob URLs)
 * - Плавный кроссфейд между треками и плейлистами (A/B crossfade)
 * - Бесконечный зацикленный режим (Loop) со случайным порядком (Shuffle)
 * - Процедурный синтез атмосферных демо-саундтреков
 * - Полифонический саундборд для мгновенных звуковых эффектов (SFX)
 */

import { AudioEngineState, AudioPlaylist, AudioTrack, SoundEffect } from './types';
import { playSyntheticSFX } from './sfx-presets';
import { shuffleArray, getBuiltinDemoPlaylists } from './folder-scanner';

type StateListener = (state: AudioEngineState) => void;

class DndAudioEngine {
  private playlists: Map<string, AudioPlaylist> = new Map();
  private state: AudioEngineState = {
    currentTrack: null,
    currentPlaylistId: null,
    currentPlaylistName: null,
    isPlaying: false,
    isPaused: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isMuted: false,
    isShuffle: true,
    repeatMode: 'playlist',
    crossfadeDuration: 1.5,
    sfxVolume: 0.85,
  };

  private listeners: Set<StateListener> = new Set();

  // Dual-channel аудио элементы для плавного кроссфейда
  private audioA: HTMLAudioElement | null = null;
  private audioB: HTMLAudioElement | null = null;
  private activeChannel: 'A' | 'B' = 'A';
  private crossfadeInterval: number | null = null;
  private timeUpdateInterval: number | null = null;

  // Web Audio Context для синтеза музыки и SFX
  private synthCtx: AudioContext | null = null;
  private synthLoopTimer: number | null = null;
  private synthGainNode: GainNode | null = null;
  private isSynthPlaying: boolean = false;

  constructor() {
    const demoPlaylists = getBuiltinDemoPlaylists();
    demoPlaylists.forEach((p) => this.playlists.set(p.id, p));

    if (typeof window !== 'undefined') {
      this.initAudioElements();
    }
  }

  private initAudioElements() {
    this.audioA = new Audio();
    this.audioB = new Audio();

    [this.audioA, this.audioB].forEach((audio, idx) => {
      audio.preload = 'auto';
      audio.volume = this.state.volume;

      audio.addEventListener('ended', () => {
        const channel = idx === 0 ? 'A' : 'B';
        if (this.activeChannel === channel) {
          this.handleTrackEnded();
        }
      });

      audio.addEventListener('error', (e) => {
        console.warn(`Ошибка воспроизведения канала ${idx === 0 ? 'A' : 'B'}:`, e);
      });
    });

    // Регулярное обновление времени прогресс-бара
    this.timeUpdateInterval = window.setInterval(() => {
      if (this.state.isPlaying && !this.state.isPaused) {
        const activeAudio = this.getActiveAudio();
        if (activeAudio && activeAudio.src && !this.state.currentTrack?.isSynthetic) {
          this.state.currentTime = activeAudio.currentTime || 0;
          this.state.duration = activeAudio.duration || this.state.duration || 180;
          this.notify();
        } else if (this.state.currentTrack?.isSynthetic) {
          this.state.currentTime = (this.state.currentTime + 0.25) % (this.state.duration || 180);
          this.notify();
        }
      }
    }, 250);
  }

  private getActiveAudio(): HTMLAudioElement | null {
    return this.activeChannel === 'A' ? this.audioA : this.audioB;
  }

  private getInactiveAudio(): HTMLAudioElement | null {
    return this.activeChannel === 'A' ? this.audioB : this.audioA;
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const snapshot = { ...this.state };
    this.listeners.forEach((listener) => listener(snapshot));
  }

  public getState(): AudioEngineState {
    return { ...this.state };
  }

  public setPlaylists(playlists: AudioPlaylist[]) {
    this.playlists.clear();
    playlists.forEach((p) => this.playlists.set(p.id, p));
    this.notify();
  }

  public getPlaylists(): AudioPlaylist[] {
    return Array.from(this.playlists.values());
  }

  public getPlaylist(id: string): AudioPlaylist | undefined {
    return this.playlists.get(id);
  }

  /**
   * Воспроизведение конкретного плейлиста
   * Начинается со случайного трека (если включен shuffle) и циклически продолжается
   */
  public playPlaylist(playlistId: string, startTrackId?: string) {
    const playlist = this.playlists.get(playlistId);
    if (!playlist || playlist.tracks.length === 0) return;

    // Инициализируем случайную очередь
    if (!playlist.shuffledQueue || playlist.shuffledQueue.length !== playlist.tracks.length) {
      playlist.shuffledQueue = shuffleArray(playlist.tracks.map((t) => t.id));
    }

    let targetTrack: AudioTrack | undefined;

    if (startTrackId) {
      targetTrack = playlist.tracks.find((t) => t.id === startTrackId);
      const foundIdx = playlist.shuffledQueue.indexOf(startTrackId);
      playlist.currentIndex = foundIdx >= 0 ? foundIdx : 0;
    } else if (this.state.isShuffle) {
      // Выбираем случайную стартовую позицию
      playlist.currentIndex = Math.floor(Math.random() * playlist.shuffledQueue.length);
      const trackId = playlist.shuffledQueue[playlist.currentIndex];
      targetTrack = playlist.tracks.find((t) => t.id === trackId);
    } else {
      playlist.currentIndex = 0;
      targetTrack = playlist.tracks[0];
    }

    if (!targetTrack) {
      targetTrack = playlist.tracks[0];
    }

    this.state.currentPlaylistId = playlist.id;
    this.state.currentPlaylistName = playlist.name;
    this.playTrack(targetTrack);
  }

  /**
   * Воспроизведение конкретного трека с плавным кроссфейдом
   */
  public playTrack(track: AudioTrack) {
    this.stopSyntheticMusic();

    this.state.currentTrack = track;
    this.state.isPlaying = true;
    this.state.isPaused = false;
    this.state.currentTime = 0;
    this.state.duration = track.duration || 180;

    if (track.isSynthetic || !track.url) {
      // Запуск процедурного генератора атмосферы
      this.playSyntheticMusic(track);
      this.notify();
      return;
    }

    const nextChannel = this.activeChannel === 'A' ? 'B' : 'A';
    const nextAudio = nextChannel === 'A' ? this.audioA : this.audioB;
    const currentAudio = this.getActiveAudio();

    if (nextAudio) {
      nextAudio.src = track.url;
      nextAudio.currentTime = 0;
      nextAudio.volume = 0;

      const effectiveVolume = this.state.isMuted ? 0 : this.state.volume;

      const playPromise = nextAudio.play();
      if (playPromise) {
        playPromise
          .then(() => {
            this.executeCrossfade(currentAudio, nextAudio, effectiveVolume);
            this.activeChannel = nextChannel;
            this.notify();
          })
          .catch((err) => {
            console.warn('Автовоспроизведение заблокировано браузером (нужен клик):', err);
            // Fallback
            this.activeChannel = nextChannel;
            nextAudio.volume = effectiveVolume;
            this.notify();
          });
      }
    }
  }

  /**
   * Плавный кроссфейд между старым и новым аудиоканалами
   */
  private executeCrossfade(
    fromAudio: HTMLAudioElement | null,
    toAudio: HTMLAudioElement,
    targetVolume: number
  ) {
    if (this.crossfadeInterval) {
      window.clearInterval(this.crossfadeInterval);
      this.crossfadeInterval = null;
    }

    const duration = Math.max(0.2, this.state.crossfadeDuration);
    const steps = 20;
    const stepTime = (duration * 1000) / steps;
    let step = 0;

    const initialFromVol = fromAudio ? fromAudio.volume : 0;

    this.crossfadeInterval = window.setInterval(() => {
      step++;
      const progress = step / steps;

      if (toAudio) {
        toAudio.volume = Math.min(1, Math.max(0, targetVolume * progress));
      }

      if (fromAudio && !fromAudio.paused) {
        fromAudio.volume = Math.max(0, initialFromVol * (1 - progress));
      }

      if (step >= steps) {
        if (this.crossfadeInterval) {
          window.clearInterval(this.crossfadeInterval);
          this.crossfadeInterval = null;
        }
        if (fromAudio) {
          fromAudio.pause();
          fromAudio.currentTime = 0;
        }
        if (toAudio) {
          toAudio.volume = targetVolume;
        }
      }
    }, stepTime);
  }

  /**
   * Обработчик завершения трека — переход к следующему в очереди
   */
  private handleTrackEnded() {
    if (this.state.repeatMode === 'track' && this.state.currentTrack) {
      // Повтор текущего трека
      const audio = this.getActiveAudio();
      if (audio) {
        audio.currentTime = 0;
        audio.play();
      }
      return;
    }

    this.nextTrack();
  }

  /**
   * Переход к следующему треку в текущем плейлисте
   */
  public nextTrack() {
    if (!this.state.currentPlaylistId) return;
    const playlist = this.playlists.get(this.state.currentPlaylistId);
    if (!playlist || playlist.tracks.length === 0) return;

    if (playlist.tracks.length === 1) {
      if (this.state.repeatMode !== 'off') {
        this.playTrack(playlist.tracks[0]);
      } else {
        this.pause();
      }
      return;
    }

    playlist.currentIndex += 1;

    // Если дошли до конца очереди — создаем свежее случайное перемешивание и начинаем сначала
    if (playlist.currentIndex >= playlist.shuffledQueue.length) {
      if (this.state.repeatMode === 'off') {
        this.pause();
        return;
      }
      playlist.shuffledQueue = shuffleArray(playlist.tracks.map((t) => t.id));
      playlist.currentIndex = 0;
    }

    const nextTrackId = playlist.shuffledQueue[playlist.currentIndex];
    const nextTrack = playlist.tracks.find((t) => t.id === nextTrackId) || playlist.tracks[0];
    this.playTrack(nextTrack);
  }

  /**
   * Переход к предыдущему треку
   */
  public prevTrack() {
    if (!this.state.currentPlaylistId) return;
    const playlist = this.playlists.get(this.state.currentPlaylistId);
    if (!playlist || playlist.tracks.length === 0) return;

    // Если прошло больше 3 секунд, просто возвращаем в начало трека
    const activeAudio = this.getActiveAudio();
    if (activeAudio && activeAudio.currentTime > 3) {
      activeAudio.currentTime = 0;
      this.state.currentTime = 0;
      this.notify();
      return;
    }

    playlist.currentIndex -= 1;
    if (playlist.currentIndex < 0) {
      playlist.currentIndex = playlist.shuffledQueue.length - 1;
    }

    const prevTrackId = playlist.shuffledQueue[playlist.currentIndex];
    const prevTrack = playlist.tracks.find((t) => t.id === prevTrackId) || playlist.tracks[0];
    this.playTrack(prevTrack);
  }

  /**
   * Пауза
   */
  public pause() {
    const audio = this.getActiveAudio();
    if (audio) {
      audio.pause();
    }
    this.pauseSyntheticMusic();
    this.state.isPlaying = false;
    this.state.isPaused = true;
    this.notify();
  }

  /**
   * Возобновление воспроизведения
   */
  public resume() {
    if (!this.state.currentTrack) {
      // Если ничего не выбрано — запускаем первый доступный плейлист
      const firstPlaylist = Array.from(this.playlists.values())[0];
      if (firstPlaylist) {
        this.playPlaylist(firstPlaylist.id);
      }
      return;
    }

    if (this.state.currentTrack.isSynthetic) {
      this.resumeSyntheticMusic();
      this.state.isPlaying = true;
      this.state.isPaused = false;
      this.notify();
      return;
    }

    const audio = this.getActiveAudio();
    if (audio && audio.src) {
      audio.play().then(() => {
        this.state.isPlaying = true;
        this.state.isPaused = false;
        this.notify();
      });
    }
  }

  public togglePlayPause() {
    if (this.state.isPlaying && !this.state.isPaused) {
      this.pause();
    } else {
      this.resume();
    }
  }

  /**
   * Перемотка на позицию (в секундах)
   */
  public seek(seconds: number) {
    const audio = this.getActiveAudio();
    if (audio && audio.src && !this.state.currentTrack?.isSynthetic) {
      audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || 180));
      this.state.currentTime = audio.currentTime;
      this.notify();
    } else if (this.state.currentTrack?.isSynthetic) {
      this.state.currentTime = seconds;
      this.notify();
    }
  }

  /**
   * Установка громкости (0.0 - 1.0)
   */
  public setVolume(volume: number) {
    const clamped = Math.max(0, Math.min(1, volume));
    this.state.volume = clamped;
    this.state.isMuted = clamped === 0;

    const effVol = this.state.isMuted ? 0 : clamped;
    const active = this.getActiveAudio();
    if (active) {
      active.volume = effVol;
    }
    if (this.synthGainNode && this.synthCtx) {
      this.synthGainNode.gain.setValueAtTime(effVol * 0.4, this.synthCtx.currentTime);
    }
    this.notify();
  }

  public toggleMute() {
    this.state.isMuted = !this.state.isMuted;
    const effVol = this.state.isMuted ? 0 : this.state.volume;
    const active = this.getActiveAudio();
    if (active) {
      active.volume = effVol;
    }
    if (this.synthGainNode && this.synthCtx) {
      this.synthGainNode.gain.setValueAtTime(effVol * 0.4, this.synthCtx.currentTime);
    }
    this.notify();
  }

  public setShuffle(shuffle: boolean) {
    this.state.isShuffle = shuffle;
    if (shuffle && this.state.currentPlaylistId) {
      const playlist = this.playlists.get(this.state.currentPlaylistId);
      if (playlist) {
        playlist.shuffledQueue = shuffleArray(playlist.tracks.map((t) => t.id));
        if (this.state.currentTrack) {
          playlist.currentIndex = playlist.shuffledQueue.indexOf(this.state.currentTrack.id);
          if (playlist.currentIndex < 0) playlist.currentIndex = 0;
        }
      }
    }
    this.notify();
  }

  public setRepeatMode(mode: AudioEngineState['repeatMode']) {
    this.state.repeatMode = mode;
    this.notify();
  }

  public setCrossfadeDuration(seconds: number) {
    this.state.crossfadeDuration = Math.max(0, Math.min(5, seconds));
    this.notify();
  }

  public setSFXVolume(volume: number) {
    this.state.sfxVolume = Math.max(0, Math.min(1, volume));
    this.notify();
  }

  /**
   * Запуск звукового эффекта из саундборда
   */
  public triggerSFX(sfx: SoundEffect) {
    const volume = (sfx.volume !== undefined ? sfx.volume : 1.0) * this.state.sfxVolume;

    if (sfx.url) {
      // Воспроизведение пользовательского аудиофайла
      try {
        const audio = new Audio(sfx.url);
        audio.volume = Math.max(0, Math.min(1, volume));
        audio.play().catch((err) => console.warn('Ошибка SFX audio play:', err));
      } catch (err) {
        console.warn('Ошибка загрузки SFX файла:', err);
      }
    } else if (sfx.synthPreset) {
      // Воспроизведение встроенного синтезированного звука
      playSyntheticSFX(sfx.synthPreset, volume);
    }
  }

  // --- Процедурный генератор атмосферной музыки для демо-треков ---

  private getSynthContext(): AudioContext {
    if (!this.synthCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.synthCtx = new AudioContextClass();
      this.synthGainNode = this.synthCtx.createGain();
      this.synthGainNode.gain.setValueAtTime(this.state.volume * 0.35, this.synthCtx.currentTime);
      this.synthGainNode.connect(this.synthCtx.destination);
    }
    if (this.synthCtx.state === 'suspended') {
      this.synthCtx.resume();
    }
    return this.synthCtx;
  }

  private playSyntheticMusic(track: AudioTrack) {
    this.isSynthPlaying = true;
    const ctx = this.getSynthContext();
    if (this.synthGainNode) {
      this.synthGainNode.gain.setValueAtTime(this.state.volume * 0.35, ctx.currentTime);
    }

    const isCombat = /битв|бой|босс|combat|boss/i.test(track.playlistName || track.title);
    const isTavern = /таверн|tavern/i.test(track.playlistName || track.title);
    const isDungeon = /подземел|dungeon|склеп/i.test(track.playlistName || track.title);

    let step = 0;
    const intervalMs = isCombat ? 320 : isTavern ? 400 : 800;

    const notesCombat = [110, 110, 146.83, 110, 130.81, 164.81, 110, 220]; // A minor боевой рифф
    const notesTavern = [261.63, 329.63, 392.0, 523.25, 440.0, 349.23, 392.0, 329.63]; // C Major веселая мелодия
    const notesDungeon = [73.42, 87.31, 110.0, 65.41]; // D low drone

    const playStep = () => {
      if (!this.isSynthPlaying || !this.synthCtx || !this.synthGainNode) return;
      const now = this.synthCtx.currentTime;

      if (isCombat) {
        // Барабанный бит + низкий бас
        const freq = notesCombat[step % notesCombat.length];
        const osc = this.synthCtx.createOscillator();
        const noteGain = this.synthCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        noteGain.gain.setValueAtTime(0.2, now);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(noteGain);
        noteGain.connect(this.synthGainNode);
        osc.start(now);
        osc.stop(now + 0.3);

        // Удар бочки на каждом 1 и 5 шаге
        if (step % 2 === 0) {
          const kick = this.synthCtx.createOscillator();
          const kickGain = this.synthCtx.createGain();
          kick.frequency.setValueAtTime(140, now);
          kick.frequency.exponentialRampToValueAtTime(35, now + 0.2);
          kickGain.gain.setValueAtTime(0.4, now);
          kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          kick.connect(kickGain);
          kickGain.connect(this.synthGainNode);
          kick.start(now);
          kick.stop(now + 0.25);
        }
      } else if (isTavern) {
        // Щипковый звук лютни
        const freq = notesTavern[step % notesTavern.length];
        const osc = this.synthCtx.createOscillator();
        const noteGain = this.synthCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        noteGain.gain.setValueAtTime(0.3, now);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(noteGain);
        noteGain.connect(this.synthGainNode);
        osc.start(now);
        osc.stop(now + 0.5);
      } else {
        // Подземелье: медленный резонансный пад
        const freq = notesDungeon[step % notesDungeon.length];
        const osc = this.synthCtx.createOscillator();
        const noteGain = this.synthCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        noteGain.gain.setValueAtTime(0, now);
        noteGain.gain.linearRampToValueAtTime(0.25, now + 0.3);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

        osc.connect(noteGain);
        noteGain.connect(this.synthGainNode);
        osc.start(now);
        osc.stop(now + 2.0);
      }

      step++;
    };

    if (this.synthLoopTimer) {
      window.clearInterval(this.synthLoopTimer);
    }
    this.synthLoopTimer = window.setInterval(playStep, intervalMs);
    playStep();
  }

  private pauseSyntheticMusic() {
    this.isSynthPlaying = false;
    if (this.synthLoopTimer) {
      window.clearInterval(this.synthLoopTimer);
      this.synthLoopTimer = null;
    }
  }

  private resumeSyntheticMusic() {
    if (this.state.currentTrack && this.state.currentTrack.isSynthetic) {
      this.playSyntheticMusic(this.state.currentTrack);
    }
  }

  private stopSyntheticMusic() {
    this.isSynthPlaying = false;
    if (this.synthLoopTimer) {
      window.clearInterval(this.synthLoopTimer);
      this.synthLoopTimer = null;
    }
  }

  public destroy() {
    if (this.crossfadeInterval) window.clearInterval(this.crossfadeInterval);
    if (this.timeUpdateInterval) window.clearInterval(this.timeUpdateInterval);
    if (this.synthLoopTimer) window.clearInterval(this.synthLoopTimer);

    if (this.audioA) {
      this.audioA.pause();
      this.audioA.src = '';
    }
    if (this.audioB) {
      this.audioB.pause();
      this.audioB.src = '';
    }
    if (this.synthCtx) {
      this.synthCtx.close();
    }
    this.listeners.clear();
  }
}

// Singleton экземпляр аудио-движка для всего приложения
export const audioService = new DndAudioEngine();
