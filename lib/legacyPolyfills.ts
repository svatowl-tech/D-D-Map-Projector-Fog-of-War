/**
 * Модуль полной совместимости с macOS 10.13 (High Sierra),
 * включая браузеры Apple Safari 13.1.2 (WebKit 605), Google Chrome 80-103 и Firefox 78-115 ESR.
 * 
 * Предоставляет полифилы и проверки среды для критически важных API:
 * 1. crypto.randomUUID
 * 2. window.structuredClone
 * 3. Array.prototype.at & TypedArray.prototype.at
 * 4. String.prototype.replaceAll
 * 5. Object.hasOwn
 * 6. Promise.allSettled
 * 7. queueMicrotask
 * 8. window.AudioContext (webkitAudioContext)
 * 9. window.ResizeObserver (детекция геометрии)
 * 10. window.BroadcastChannel (надежная эмуляция через localStorage)
 * 11. Детекция поддержки Flexbox Gap с добавлением класса 'no-flex-gap'
 */

export function initLegacyPolyfills(): void {
  if (typeof window === 'undefined') return;

  // 1. crypto.randomUUID polyfill
  if (!window.crypto) {
    (window as any).crypto = {};
  }
  if (!window.crypto.randomUUID) {
    window.crypto.randomUUID = function (): `${string}-${string}-${string}-${string}-${string}` {
      if (typeof window.crypto.getRandomValues === 'function') {
        const buf = new Uint8Array(16);
        window.crypto.getRandomValues(buf);
        buf[6] = (buf[6] & 0x0f) | 0x40; // Version 4
        buf[8] = (buf[8] & 0x3f) | 0x80; // Variant 10
        const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as any;
      }
      // Fallback на псевдослучайную генерацию по стандарту RFC 4122
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }) as any;
    };
  }

  // 2. window.structuredClone polyfill
  if (typeof (window as any).structuredClone !== 'function') {
    (window as any).structuredClone = function <T>(obj: T): T {
      if (obj === undefined) return undefined as unknown as T;
      if (obj === null || typeof obj !== 'object') return obj;

      // Глубокое клонирование стандартных структур данных
      try {
        return JSON.parse(JSON.stringify(obj));
      } catch {
        // Рекурсивный fallback для объектов, содержащих циклические или специальные ссылки
        const clone = (item: any, hash = new WeakMap()): any => {
          if (Object(item) !== item) return item;
          if (hash.has(item)) return hash.get(item);
          if (item instanceof Date) return new Date(item);
          if (item instanceof RegExp) return new RegExp(item.source, item.flags);
          if (item instanceof Map) {
            const mapResult = new Map();
            hash.set(item, mapResult);
            item.forEach((val, key) => mapResult.set(key, clone(val, hash)));
            return mapResult;
          }
          if (item instanceof Set) {
            const setResult = new Set();
            hash.set(item, setResult);
            item.forEach((val) => setResult.add(clone(val, hash)));
            return setResult;
          }
          const result = Array.isArray(item) ? [] : Object.create(Object.getPrototypeOf(item));
          hash.set(item, result);
          for (const key of Object.keys(item)) {
            result[key] = clone(item[key], hash);
          }
          return result;
        };
        return clone(obj);
      }
    };
  }

  // 3. Array.prototype.at polyfill (Safari 13 не поддерживал .at)
  if (!Array.prototype.at) {
    const at = function (this: any, n: number) {
      n = Math.trunc(n) || 0;
      if (n < 0) n += this.length;
      if (n < 0 || n >= this.length) return undefined;
      return this[n];
    };
    Object.defineProperty(Array.prototype, 'at', {
      value: at,
      writable: true,
      configurable: true,
    });
  }

  // TypedArray.prototype.at polyfills
  const typedArrayConstructors = [
    typeof Int8Array !== 'undefined' ? Int8Array : null,
    typeof Uint8Array !== 'undefined' ? Uint8Array : null,
    typeof Uint8ClampedArray !== 'undefined' ? Uint8ClampedArray : null,
    typeof Int16Array !== 'undefined' ? Int16Array : null,
    typeof Uint16Array !== 'undefined' ? Uint16Array : null,
    typeof Int32Array !== 'undefined' ? Int32Array : null,
    typeof Uint32Array !== 'undefined' ? Uint32Array : null,
    typeof Float32Array !== 'undefined' ? Float32Array : null,
    typeof Float64Array !== 'undefined' ? Float64Array : null,
  ].filter(Boolean) as Function[];

  for (const ctor of typedArrayConstructors) {
    if (ctor && ctor.prototype && !ctor.prototype.at) {
      Object.defineProperty(ctor.prototype, 'at', {
        value: function (this: any, n: number) {
          n = Math.trunc(n) || 0;
          if (n < 0) n += this.length;
          if (n < 0 || n >= this.length) return undefined;
          return this[n];
        },
        writable: true,
        configurable: true,
      });
    }
  }

  // 4. String.prototype.replaceAll polyfill
  if (!String.prototype.replaceAll) {
    Object.defineProperty(String.prototype, 'replaceAll', {
      value: function (searchValue: any, replaceValue: any) {
        if (searchValue instanceof RegExp) {
          if (!searchValue.global) {
            throw new TypeError('replaceAll called with a non-global RegExp');
          }
          return this.replace(searchValue, replaceValue);
        }
        return this.split(searchValue).join(replaceValue);
      },
      writable: true,
      configurable: true,
    });
  }

  // 5. Object.hasOwn polyfill
  if (!(Object as any).hasOwn) {
    Object.defineProperty(Object, 'hasOwn', {
      value: function (obj: any, prop: PropertyKey): boolean {
        if (obj === null || obj === undefined) {
          throw new TypeError('Cannot convert undefined or null to object');
        }
        return Object.prototype.hasOwnProperty.call(obj, prop);
      },
      writable: true,
      configurable: true,
    });
  }

  // 6. Promise.allSettled polyfill (для старых движков Safari 12/13.0)
  if (!Promise.allSettled) {
    Promise.allSettled = function <T>(promises: Iterable<T | PromiseLike<T>>): Promise<PromiseSettledResult<Awaited<T>>[]> {
      return Promise.all(
        Array.from(promises).map((item) =>
          Promise.resolve(item).then(
            (value) => ({ status: 'fulfilled', value } as PromiseFulfilledResult<Awaited<T>>),
            (reason) => ({ status: 'rejected', reason } as PromiseRejectedResult)
          )
        )
      );
    };
  }

  // 7. queueMicrotask polyfill
  if (typeof (window as any).queueMicrotask !== 'function') {
    (window as any).queueMicrotask = function (fn: () => void) {
      Promise.resolve().then(fn).catch((err) => {
        setTimeout(() => {
          throw err;
        }, 0);
      });
    };
  }

  // 8. AudioContext fallback для WebKit Safari
  if (!window.AudioContext && (window as any).webkitAudioContext) {
    window.AudioContext = (window as any).webkitAudioContext;
  }

  // 9. ResizeObserver fallback
  if (typeof (window as any).ResizeObserver === 'undefined') {
    (window as any).ResizeObserver = class {
      private callback: Function;
      private handleResize = () => {
        try {
          this.callback([]);
        } catch {
          // ignore
        }
      };
      constructor(cb: Function) {
        this.callback = cb;
        window.addEventListener('resize', this.handleResize);
      }
      observe() {}
      unobserve() {}
      disconnect() {
        window.removeEventListener('resize', this.handleResize);
      }
    };
  }

  // 10. BroadcastChannel polyfill (через localStorage + custom event)
  if (typeof (window as any).BroadcastChannel === 'undefined') {
    const channels = new Map<string, Set<any>>();

    (window as any).BroadcastChannel = class {
      public name: string;
      public onmessage: ((event: MessageEvent) => void) | null = null;
      private isClosed = false;

      constructor(name: string) {
        this.name = name;
        if (!channels.has(name)) {
          channels.set(name, new Set());
        }
        channels.get(name)!.add(this);
      }

      public postMessage(message: any) {
        if (this.isClosed) return;
        const payload = {
          channel: this.name,
          data: message,
          _seq: Date.now() + Math.random(),
        };

        // Отправка в другие вкладки через storage
        try {
          localStorage.setItem(`__bc_${this.name}__`, JSON.stringify(payload));
        } catch {
          // ignore quota
        }

        // Диспетчеризация другим локальным экземплярам в той же вкладке
        const set = channels.get(this.name);
        if (set) {
          set.forEach((ch) => {
            if (ch !== this && !ch.isClosed && typeof ch.onmessage === 'function') {
              try {
                ch.onmessage(new MessageEvent('message', { data: message }));
              } catch {
                // ignore
              }
            }
          });
        }
      }

      public close() {
        this.isClosed = true;
        const set = channels.get(this.name);
        if (set) {
          set.delete(this);
          if (set.size === 0) {
            channels.delete(this.name);
          }
        }
      }
    };

    // Слушатель storage для эмуляции BroadcastChannel
    try {
      window.addEventListener('storage', (e: StorageEvent) => {
        if (!e.key || !e.key.startsWith('__bc_') || !e.newValue) return;
        try {
          const parsed = JSON.parse(e.newValue);
          const channelName = parsed.channel;
          const set = channels.get(channelName);
          if (set) {
            set.forEach((ch) => {
              if (!ch.isClosed && typeof ch.onmessage === 'function') {
                ch.onmessage(new MessageEvent('message', { data: parsed.data }));
              }
            });
          }
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }
  }

  // 11. Проверка поддержки Flexbox Gap (Safari 13 не поддерживает gap во Flexbox)
  try {
    const flex = document.createElement('div');
    flex.style.display = 'flex';
    flex.style.flexDirection = 'column';
    flex.style.rowGap = '1px';
    flex.appendChild(document.createElement('div'));
    flex.appendChild(document.createElement('div'));
    document.body.appendChild(flex);
    const isFlexGapSupported = flex.scrollHeight === 1;
    if (flex.parentNode) {
      flex.parentNode.removeChild(flex);
    }
    if (!isFlexGapSupported) {
      document.documentElement.classList.add('no-flex-gap');
    }
  } catch {
    // ignore
  }
}
