/**
 * Original sound design, synthesized at runtime with the Web Audio API.
 * No sample files are used, so every sound is owned outright and the
 * download stays small. Each effect is a short recipe of oscillators,
 * filtered noise and envelopes.
 */
import { settings } from '../lib/settings';

type Wave = OscillatorType;

/** A minor pentatonic ladder used for clears and chains so rewards always sound consonant. */
const LADDER = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27, 29, 31];
const ROOT = 220; // A3

function noteHz(semitones: number, root = ROOT): number {
  return root * Math.pow(2, semitones / 12);
}

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private noiseBuf!: AudioBuffer;
  private unlocked = false;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStep = 0;
  private musicNext = 0;
  private musicOn = false;
  private musicFilter!: BiquadFilterNode;
  intensity = 0;

  constructor() {
    settings.subscribe(() => this.applyVolumes());
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): void {
    if (this.unlocked && this.ctx?.state === 'running') return;
    if (!this.ctx) this.init();
    void this.ctx?.resume();
    this.unlocked = true;
  }

  private init(): void {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    this.master = ctx.createGain();
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 1400;
    this.music = ctx.createGain();
    this.music.connect(this.musicFilter).connect(this.master);
    // One second of white noise, reused by every noise-based effect.
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const s = settings.get();
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : 1, t, 0.02);
    this.sfx.gain.setTargetAtTime(s.sfxVolume * 0.9, t, 0.02);
    this.music.gain.setTargetAtTime(s.musicVolume * 0.32, t, 0.05);
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    if (this.unlocked) void this.ctx?.resume();
  }

  private ready(): AudioContext | null {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || settings.get().muted) return null;
    return ctx;
  }

  /* ---------- building blocks ---------- */

  private tone(
    freq: number,
    opts: { type?: Wave; at?: number; attack?: number; decay?: number; gain?: number; to?: number; detune?: number; lowpass?: number; bus?: GainNode } = {},
  ): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + (opts.at ?? 0);
    const attack = opts.attack ?? 0.004;
    const decay = opts.decay ?? 0.15;
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + attack + decay);
    if (opts.detune) osc.detune.value = opts.detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.2, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    let node: AudioNode = osc;
    if (opts.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.lowpass;
      node.connect(f);
      node = f;
    }
    node.connect(g).connect(opts.bus ?? this.sfx);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
  }

  private noise(opts: { at?: number; dur?: number; gain?: number; type?: BiquadFilterType; freq?: number; to?: number; q?: number; bus?: GainNode } = {}): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + (opts.at ?? 0);
    const dur = opts.dur ?? 0.08;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.freq ?? 2000, t);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain ?? 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(opts.bus ?? this.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  /* ---------- effects ---------- */

  ui(): void {
    if (!this.ready()) return;
    this.tone(1320, { type: 'sine', decay: 0.04, gain: 0.07 });
    this.tone(660, { type: 'triangle', decay: 0.05, gain: 0.05 });
  }

  pickup(): void {
    if (!this.ready()) return;
    this.tone(480, { type: 'triangle', decay: 0.07, gain: 0.09, to: 760 });
    this.noise({ dur: 0.03, gain: 0.03, freq: 5000 });
  }

  place(size: number): void {
    if (!this.ready()) return;
    const base = 200 - Math.min(size, 9) * 9;
    this.tone(base, { type: 'sine', decay: 0.09, gain: 0.32, to: base * 0.6 });
    this.tone(base * 2.02, { type: 'triangle', decay: 0.05, gain: 0.06 });
    this.noise({ dur: 0.025, gain: 0.08, freq: 2600, q: 1.4 });
  }

  invalid(): void {
    if (!this.ready()) return;
    this.tone(240, { type: 'square', decay: 0.07, gain: 0.05, lowpass: 900 });
    this.tone(180, { type: 'square', at: 0.07, decay: 0.1, gain: 0.05, lowpass: 700 });
  }

  /** Line clear. Bigger clears add notes, a low hit and a longer shimmer; chains climb the ladder. */
  clear(lines: number, chain: number, surge: boolean): void {
    if (!this.ready()) return;
    const start = Math.min(Math.max(chain - 1, 0), 6);
    const notes = Math.min(2 + lines, 6);
    for (let i = 0; i < notes; i++) {
      const semi = LADDER[Math.min(start + i, LADDER.length - 1)]! + 12;
      const at = i * 0.045;
      this.tone(noteHz(semi), { type: 'triangle', at, decay: 0.22 + lines * 0.04, gain: 0.11 });
      this.tone(noteHz(semi), { type: 'sine', at, decay: 0.3, gain: 0.06, detune: 7 });
    }
    this.noise({ dur: 0.18 + lines * 0.05, gain: 0.06 + lines * 0.02, type: 'highpass', freq: 1800, to: 7000 });
    if (lines >= 2) {
      this.tone(110, { type: 'sine', decay: 0.35, gain: 0.3, to: 55 });
      this.noise({ dur: 0.3, gain: 0.08, type: 'lowpass', freq: 400 });
    }
    if (lines >= 3) {
      this.tone(noteHz(LADDER[start + notes]! + 24), { type: 'sine', at: notes * 0.045, decay: 0.6, gain: 0.08 });
    }
    if (surge) this.tone(noteHz(31), { type: 'sawtooth', at: 0.02, decay: 0.25, gain: 0.03, lowpass: 3200 });
  }

  /** Extra cue when a chain grows past 1. */
  chain(level: number): void {
    if (!this.ready() || level < 2) return;
    const semi = LADDER[Math.min(level + 3, LADDER.length - 1)]! + 12;
    this.tone(noteHz(semi), { type: 'square', at: 0.16, decay: 0.12, gain: 0.04, lowpass: 2600 });
    this.tone(noteHz(semi + 7), { type: 'square', at: 0.22, decay: 0.16, gain: 0.035, lowpass: 2600 });
  }

  pulseGain(): void {
    if (!this.ready()) return;
    this.tone(880, { type: 'sine', at: 0.12, decay: 0.18, gain: 0.05, to: 1320 });
  }

  pulseReady(): void {
    if (!this.ready()) return;
    this.tone(noteHz(24), { type: 'sine', decay: 0.2, gain: 0.08 });
    this.tone(noteHz(31), { type: 'sine', at: 0.08, decay: 0.3, gain: 0.08 });
  }

  pulseSpend(): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.28);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.28);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    osc.connect(f).connect(g).connect(this.sfx);
    osc.start(t);
    osc.stop(t + 0.4);
    this.tone(noteHz(29), { type: 'sine', at: 0.26, decay: 0.3, gain: 0.08 });
  }

  surgeWarning(): void {
    if (!this.ready()) return;
    for (let i = 0; i < 3; i++) this.tone(noteHz(19), { type: 'triangle', at: i * 0.16, decay: 0.07, gain: 0.07 });
  }

  surgeStart(): void {
    if (!this.ready()) return;
    [0, 7, 12, 19].forEach((s, i) => {
      this.tone(noteHz(s + 12), { type: 'sawtooth', at: i * 0.07, decay: 0.35, gain: 0.05, lowpass: 2400 });
    });
    this.tone(55, { type: 'sine', decay: 0.6, gain: 0.25, to: 110 });
    this.noise({ dur: 0.6, gain: 0.07, type: 'bandpass', freq: 400, to: 6000, q: 2 });
  }

  surgeEnd(): void {
    if (!this.ready()) return;
    this.tone(noteHz(19), { type: 'triangle', decay: 0.2, gain: 0.05, to: noteHz(7) });
  }

  staticDrop(): void {
    if (!this.ready()) return;
    for (let i = 0; i < 3; i++) this.noise({ at: i * 0.03, dur: 0.02, gain: 0.06, type: 'highpass', freq: 3000 + i * 1200 });
    this.tone(90, { type: 'square', decay: 0.06, gain: 0.04, lowpass: 400 });
  }

  danger(): void {
    if (!this.ready()) return;
    this.tone(70, { type: 'sine', decay: 0.12, gain: 0.25 });
    this.tone(64, { type: 'sine', at: 0.18, decay: 0.16, gain: 0.18 });
  }

  opponentOut(): void {
    if (!this.ready()) return;
    this.tone(420, { type: 'triangle', decay: 0.45, gain: 0.08, to: 90, lowpass: 1800 });
    this.noise({ dur: 0.25, gain: 0.04, type: 'lowpass', freq: 900, to: 200 });
  }

  overtake(): void {
    if (!this.ready()) return;
    this.tone(noteHz(12), { type: 'triangle', decay: 0.08, gain: 0.08 });
    this.tone(noteHz(19), { type: 'triangle', at: 0.07, decay: 0.14, gain: 0.08 });
  }

  eliminated(): void {
    if (!this.ready()) return;
    this.tone(330, { type: 'sawtooth', decay: 0.9, gain: 0.08, to: 55, lowpass: 1200 });
    [0, 3, 7].forEach((s) => this.tone(noteHz(s - 12), { type: 'sine', at: 0.3, decay: 1.0, gain: 0.07 }));
  }

  countdown(final: boolean): void {
    if (!this.ready()) return;
    if (final) {
      this.tone(noteHz(24), { type: 'triangle', decay: 0.35, gain: 0.14 });
      this.tone(noteHz(31), { type: 'sine', decay: 0.4, gain: 0.08 });
    } else {
      this.tone(noteHz(12), { type: 'triangle', decay: 0.12, gain: 0.12 });
    }
  }

  tick(urgent: boolean): void {
    if (!this.ready()) return;
    const f = urgent ? 1500 : 1100;
    this.tone(f, { type: 'sine', decay: 0.04, gain: urgent ? 0.11 : 0.07 });
    this.noise({ dur: 0.015, gain: 0.04, freq: 4000 });
  }

  victory(): void {
    if (!this.ready()) return;
    const seq = [0, 4, 7, 12, 16, 19, 24];
    seq.forEach((s, i) => {
      this.tone(noteHz(s + 3, ROOT), { type: 'triangle', at: i * 0.08, decay: 0.5, gain: 0.09 });
      this.tone(noteHz(s + 3, ROOT), { type: 'sine', at: i * 0.08, decay: 0.7, gain: 0.05, detune: 6 });
    });
    this.tone(noteHz(-9), { type: 'sine', at: 0.5, decay: 1.4, gain: 0.18 });
  }

  defeat(): void {
    if (!this.ready()) return;
    [7, 3, 0].forEach((s, i) => this.tone(noteHz(s), { type: 'triangle', at: i * 0.18, decay: 0.6, gain: 0.08 }));
  }

  /* ---------- music ---------- */

  /** Gentle generative backing loop. Intensity 0..1 opens the filter and adds percussion. */
  startMusic(): void {
    if (this.musicOn || !this.ctx) return;
    this.musicOn = true;
    this.musicNext = this.ctx.currentTime + 0.1;
    this.musicStep = 0;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 90);
  }

  stopMusic(): void {
    this.musicOn = false;
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  setIntensity(v: number): void {
    this.intensity = v;
    if (this.ctx) this.musicFilter.frequency.setTargetAtTime(1200 + v * 3200, this.ctx.currentTime, 0.4);
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || settings.get().musicVolume <= 0) {
      if (ctx) this.musicNext = ctx.currentTime + 0.1;
      return;
    }
    const stepDur = 60 / 104 / 2; // eighth notes at 104 bpm
    // i - VI - III - VII in A minor, two bars each.
    const chords = [
      [0, 3, 7],
      [-4, 0, 3],
      [3, 7, 10],
      [-2, 2, 5],
    ];
    while (this.musicNext < ctx.currentTime + 0.25) {
      const at = this.musicNext - ctx.currentTime;
      const step = this.musicStep;
      const chord = chords[Math.floor(step / 16) % chords.length]!;
      const inBar = step % 16;
      if (inBar === 0) {
        for (const s of chord) {
          this.tone(noteHz(s), { type: 'sawtooth', at, attack: 0.6, decay: 3.2, gain: 0.05, lowpass: 900, bus: this.music, detune: -6 });
          this.tone(noteHz(s), { type: 'sawtooth', at, attack: 0.6, decay: 3.2, gain: 0.05, lowpass: 900, bus: this.music, detune: 6 });
        }
      }
      if (inBar % 8 === 0) this.tone(noteHz(chord[0]! - 12), { type: 'triangle', at, decay: 0.5, gain: 0.16, bus: this.music });
      if (inBar % 2 === 0 || this.intensity > 0.5) {
        const pattern = [0, 2, 1, 2, 0, 1, 2, 1];
        const s = chord[pattern[step % 8]!]! + 12 + (step % 16 >= 8 ? 12 : 0);
        this.tone(noteHz(s), { type: 'triangle', at, decay: 0.18, gain: 0.04, bus: this.music });
      }
      if (this.intensity > 0.3 && inBar % 2 === 1) this.noise({ at, dur: 0.03, gain: 0.03 * this.intensity, type: 'highpass', freq: 7000, bus: this.music });
      if (this.intensity > 0.6 && inBar % 4 === 0) this.tone(60, { type: 'sine', at, decay: 0.12, gain: 0.16, to: 40, bus: this.music });
      this.musicStep++;
      this.musicNext += stepDur;
    }
  }
}

export const audio = new AudioEngine();

/** Install one-time listeners that unlock audio on the first user gesture. */
export function installAudioUnlock(): void {
  const unlock = () => {
    audio.unlock();
    audio.startMusic();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}
