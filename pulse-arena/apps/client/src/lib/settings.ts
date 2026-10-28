import { createStore } from './store';

export interface Settings {
  nickname: string;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
  haptics: boolean;
  /** 'system' follows prefers-reduced-motion. */
  motion: 'system' | 'reduced' | 'full';
  tutorialDone: boolean;
  bestPractice: number;
}

const KEY = 'pulse.settings.v1';

const defaults: Settings = {
  nickname: '',
  sfxVolume: 0.8,
  musicVolume: 0.35,
  muted: false,
  haptics: true,
  motion: 'system',
  tutorialDone: false,
  bestPractice: 0,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // Storage unavailable (private mode): fall back to defaults.
  }
  return { ...defaults };
}

export const settings = createStore<Settings>(load());

settings.subscribe(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings.get()));
  } catch {
    // Ignore: preferences simply will not persist.
  }
});

const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export function reducedMotion(): boolean {
  const m = settings.get().motion;
  if (m === 'reduced') return true;
  if (m === 'full') return false;
  return mq?.matches ?? false;
}

const ADJ = ['Swift', 'Quiet', 'Bright', 'Bold', 'Lucky', 'Steady', 'Clever', 'Rapid', 'Calm', 'Keen'];
const NOUN = ['Falcon', 'Comet', 'Otter', 'Lynx', 'Pilot', 'Raven', 'Orbit', 'Fox', 'Atlas', 'Cedar'];

/** Friendly default nickname for first-time guests. */
export function suggestNickname(): string {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)]!;
  const n = NOUN[Math.floor(Math.random() * NOUN.length)]!;
  return `${a} ${n}`;
}

export function ensureNickname(): string {
  let n = settings.get().nickname.trim();
  if (!n) {
    n = suggestNickname();
    settings.set({ nickname: n });
  }
  return n;
}
