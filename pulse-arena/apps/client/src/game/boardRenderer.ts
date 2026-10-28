import { BOARD_SIZE } from '@pulse/engine';
import { reducedMotion } from '../lib/settings';
import { BLOCK_COLORS, UI, roundRect, sprite } from './theme';

export interface Preview {
  cells: number[];
  color: number;
  valid: boolean;
  rows: number[];
  cols: number[];
}

export interface BoardMode {
  surge: boolean;
  danger: 0 | 1 | 2;
  eliminated: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  born: number;
  life: number;
}

interface FloatText {
  text: string;
  sub: string;
  x: number;
  y: number;
  color: string;
  born: number;
  big: boolean;
}

interface ClearFx {
  cells: { i: number; color: number }[];
  rows: number[];
  cols: number[];
  origin: { x: number; y: number };
  born: number;
  surge: boolean;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/**
 * Imperative canvas renderer for one player board and its effects.
 * Owned by a React component; all drawing happens in a single rAF loop.
 */
export class BoardRenderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  size = 0;
  pad = 0;
  cell = 0;
  board: number[] = new Array(81).fill(0);
  preview: Preview | null = null;
  cursor: { col: number; row: number } | null = null;
  mode: BoardMode = { surge: false, danger: 0, eliminated: false };
  private settle = new Map<number, number>();
  private staticFx = new Map<number, number>();
  private clears: ClearFx[] = [];
  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  private shakeUntil = 0;
  private shakeMag = 0;
  private invalidAt = -1e9;
  private raf = 0;
  private running = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: true })!;
  }

  resize(cssSize: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.size = cssSize;
    this.canvas.width = Math.round(cssSize * this.dpr);
    this.canvas.height = Math.round(cssSize * this.dpr);
    this.canvas.style.width = `${cssSize}px`;
    this.canvas.style.height = `${cssSize}px`;
    this.pad = Math.round(cssSize * 0.024);
    this.cell = (cssSize - this.pad * 2) / BOARD_SIZE;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const loop = (t: number) => {
      if (!this.running) return;
      this.draw(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Client point -> fractional board coordinates (in cells). */
  toBoard(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: (clientX - r.left - this.pad) / this.cell, y: (clientY - r.top - this.pad) / this.cell };
  }

  cellCenterClient(i: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const c = i % BOARD_SIZE;
    const row = Math.floor(i / BOARD_SIZE);
    return { x: r.left + this.pad + (c + 0.5) * this.cell, y: r.top + this.pad + (row + 0.5) * this.cell };
  }

  /* ---------------- Effect triggers ---------------- */

  placed(cells: number[]): void {
    const now = performance.now();
    for (const i of cells) this.settle.set(i, now);
  }

  /**
   * Line clear. `before` is the board after the piece was stamped but before
   * lines were removed, so the cleared cells can be animated in their colors.
   */
  cleared(before: number[], rows: number[], cols: number[], origin: number[], opts: { points: number; label: string; sub: string; surge: boolean; lines: number }): void {
    const now = performance.now();
    const set = new Set<number>();
    for (const r of rows) for (let c = 0; c < BOARD_SIZE; c++) set.add(r * BOARD_SIZE + c);
    for (const c of cols) for (let r = 0; r < BOARD_SIZE; r++) set.add(r * BOARD_SIZE + c);
    const cells = [...set].map((i) => ({ i, color: before[i]! }));
    const ox = origin.reduce((a, i) => a + (i % BOARD_SIZE), 0) / Math.max(1, origin.length);
    const oy = origin.reduce((a, i) => a + Math.floor(i / BOARD_SIZE), 0) / Math.max(1, origin.length);
    this.clears.push({ cells, rows, cols, origin: { x: ox, y: oy }, born: now, surge: opts.surge });
    const reduced = reducedMotion();
    if (!reduced) {
      const budget = Math.max(1, Math.floor(260 / Math.max(1, cells.length)));
      for (const { i, color } of cells) {
        const cx = this.pad + ((i % BOARD_SIZE) + 0.5) * this.cell;
        const cy = this.pad + (Math.floor(i / BOARD_SIZE) + 0.5) * this.cell;
        const n = Math.min(4, budget);
        for (let k = 0; k < n; k++) {
          const a = Math.random() * Math.PI * 2;
          const sp = this.cell * (2 + Math.random() * 5 + opts.lines);
          this.particles.push({
            x: cx,
            y: cy,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - this.cell * 4,
            size: this.cell * (0.12 + Math.random() * 0.16),
            rot: Math.random() * Math.PI,
            vr: (Math.random() - 0.5) * 12,
            color: BLOCK_COLORS[color]?.light ?? '#fff',
            born: now + 90,
            life: 520 + Math.random() * 380,
          });
        }
      }
      if (opts.lines >= 2) {
        this.shakeUntil = now + 220 + opts.lines * 40;
        this.shakeMag = Math.min(7, 1.5 + opts.lines * 1.2);
      }
    }
    const tx = this.pad + (Math.min(Math.max(ox, 1.5), 7.5) + 0.5) * this.cell;
    const ty = this.pad + (Math.min(Math.max(oy, 1), 7.5) + 0.5) * this.cell;
    this.texts.push({ text: opts.label, sub: opts.sub, x: tx, y: ty, color: opts.surge ? UI.surge : UI.text, born: now, big: opts.lines >= 2 });
  }

  floatText(text: string, sub: string, color: string, big = false): void {
    this.texts.push({ text, sub, x: this.size / 2, y: this.size * 0.42, color, born: performance.now(), big });
  }

  staticDrop(cell: number): void {
    this.staticFx.set(cell, performance.now());
  }

  invalid(): void {
    this.invalidAt = performance.now();
  }

  /* ---------------- Drawing ---------------- */

  private draw(now: number): void {
    const ctx = this.ctx;
    const { dpr, size, pad, cell } = this;
    if (!size) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    let sx = 0;
    let sy = 0;
    if (now < this.shakeUntil) {
      const k = (this.shakeUntil - now) / 300;
      sx = (Math.random() - 0.5) * this.shakeMag * k;
      sy = (Math.random() - 0.5) * this.shakeMag * k;
    }
    ctx.save();
    ctx.translate(sx, sy);

    // Board plate.
    roundRect(ctx, 0.5, 0.5, size - 1, size - 1, size * 0.035);
    ctx.fillStyle = UI.boardBg;
    ctx.fill();

    // Frame state: Surge glow, danger pulse or invalid flash.
    let frame = UI.frame;
    let frameAlpha = 1;
    let frameWidth = 1.5;
    if (this.mode.surge) {
      frame = UI.surge;
      frameAlpha = 0.65 + 0.35 * Math.sin(now / 160);
      frameWidth = 2.5;
    }
    if (this.mode.danger === 2 && !this.mode.eliminated) {
      frame = UI.danger;
      frameAlpha = 0.55 + 0.45 * Math.sin(now / 120);
      frameWidth = 2.5;
    }
    if (now - this.invalidAt < 260) {
      frame = UI.danger;
      frameAlpha = 1 - (now - this.invalidAt) / 260;
      frameWidth = 3;
    }
    ctx.globalAlpha = frameAlpha;
    roundRect(ctx, 1, 1, size - 2, size - 2, size * 0.035);
    ctx.strokeStyle = frame;
    ctx.lineWidth = frameWidth;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Lines that the current preview would clear get a lane highlight.
    const pv = this.preview;
    if (pv && pv.valid && (pv.rows.length || pv.cols.length)) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (const r of pv.rows) ctx.fillRect(pad, pad + r * cell, cell * BOARD_SIZE, cell);
      for (const c of pv.cols) ctx.fillRect(pad + c * cell, pad, cell, cell * BOARD_SIZE);
    }

    const slot = sprite(0, cell * dpr);
    const willClear = new Set<number>();
    if (pv && pv.valid) {
      for (const r of pv.rows) for (let c = 0; c < BOARD_SIZE; c++) willClear.add(r * BOARD_SIZE + c);
      for (const c of pv.cols) for (let r = 0; r < BOARD_SIZE; r++) willClear.add(r * BOARD_SIZE + c);
    }
    const reduced = reducedMotion();

    for (let i = 0; i < 81; i++) {
      const x = pad + (i % BOARD_SIZE) * cell;
      const y = pad + Math.floor(i / BOARD_SIZE) * cell;
      ctx.drawImage(slot, x, y, cell, cell);
      const v = this.board[i]!;
      if (!v) continue;
      let scale = 1;
      let glow = 0;
      const st = this.settle.get(i);
      if (st !== undefined) {
        const t = (now - st) / 200;
        if (t >= 1) this.settle.delete(i);
        else if (!reduced) {
          scale = 1.14 - 0.14 * easeOutBack(Math.min(1, t));
          glow = 1 - t;
        } else glow = 1 - t;
      }
      const sf = this.staticFx.get(i);
      let alpha = 1;
      if (sf !== undefined) {
        const t = (now - sf) / 420;
        if (t >= 1) this.staticFx.delete(i);
        else alpha = reduced ? t : Math.random() < 0.35 + t * 0.6 ? 1 : 0.25;
      }
      ctx.globalAlpha = alpha;
      this.blit(v, x, y, scale);
      if (glow > 0) {
        ctx.globalAlpha = glow * 0.35;
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, x + cell * 0.05, y + cell * 0.05, cell * 0.9, cell * 0.9, cell * 0.16);
        ctx.fill();
      }
      if (willClear.has(i)) {
        ctx.globalAlpha = 0.28 + 0.12 * Math.sin(now / 90);
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, x + cell * 0.05, y + cell * 0.05, cell * 0.9, cell * 0.9, cell * 0.16);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Placement preview.
    if (pv) {
      for (const i of pv.cells) {
        const x = pad + (i % BOARD_SIZE) * cell;
        const y = pad + Math.floor(i / BOARD_SIZE) * cell;
        if (pv.valid) {
          ctx.globalAlpha = 0.5;
          this.blit(pv.color, x, y, 1);
          ctx.globalAlpha = 1;
          if (willClear.has(i)) {
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = '#fff';
            roundRect(ctx, x + cell * 0.05, y + cell * 0.05, cell * 0.9, cell * 0.9, cell * 0.16);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        } else {
          ctx.strokeStyle = 'rgba(255,77,94,0.85)';
          ctx.lineWidth = 2;
          roundRect(ctx, x + cell * 0.1, y + cell * 0.1, cell * 0.8, cell * 0.8, cell * 0.14);
          ctx.stroke();
        }
      }
    }

    // Keyboard cursor.
    if (this.cursor && !pv) {
      ctx.strokeStyle = UI.pulse;
      ctx.lineWidth = 2;
      roundRect(ctx, pad + this.cursor.col * cell + 2, pad + this.cursor.row * cell + 2, cell - 4, cell - 4, cell * 0.16);
      ctx.stroke();
    }

    this.drawClears(now, reduced);
    this.drawParticles(now);

    // Surge scan line.
    if (this.mode.surge && !reduced && !this.mode.eliminated) {
      const t = (now % 1400) / 1400;
      const y = pad + t * cell * BOARD_SIZE;
      const g = ctx.createLinearGradient(0, y - cell, 0, y);
      g.addColorStop(0, 'rgba(255,178,62,0)');
      g.addColorStop(1, 'rgba(255,178,62,0.16)');
      ctx.fillStyle = g;
      ctx.fillRect(pad, Math.max(pad, y - cell), cell * BOARD_SIZE, Math.min(cell, y - pad));
    }

    if (this.mode.eliminated) {
      ctx.fillStyle = 'rgba(7,9,13,0.62)';
      roundRect(ctx, 0, 0, size, size, size * 0.035);
      ctx.fill();
    }

    this.drawTexts(now, reduced);
    ctx.restore();
  }

  private blit(color: number, x: number, y: number, scale: number): void {
    const { cell, dpr } = this;
    const spr = sprite(color, cell * scale * dpr);
    const s = cell * scale;
    this.ctx.drawImage(spr, x + (cell - s) / 2, y + (cell - s) / 2, s, s);
  }

  private drawClears(now: number, reduced: boolean): void {
    const ctx = this.ctx;
    const { pad, cell } = this;
    this.clears = this.clears.filter((fx) => now - fx.born < 520);
    for (const fx of this.clears) {
      const t = (now - fx.born) / 520;
      // Beam: a bright band sweeping along each cleared line from the placement point.
      const beamT = Math.min(1, (now - fx.born) / 240);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const beamColor = fx.surge ? '255,178,62' : '170,240,255';
      for (const r of fx.rows) {
        const y = pad + r * cell;
        const reach = easeOut(beamT) * BOARD_SIZE;
        const x0 = pad + Math.max(0, fx.origin.x + 0.5 - reach) * cell;
        const x1 = pad + Math.min(BOARD_SIZE, fx.origin.x + 0.5 + reach) * cell;
        ctx.fillStyle = `rgba(${beamColor},${0.55 * (1 - t)})`;
        ctx.fillRect(x0, y + cell * 0.2, x1 - x0, cell * 0.6);
      }
      for (const c of fx.cols) {
        const x = pad + c * cell;
        const reach = easeOut(beamT) * BOARD_SIZE;
        const y0 = pad + Math.max(0, fx.origin.y + 0.5 - reach) * cell;
        const y1 = pad + Math.min(BOARD_SIZE, fx.origin.y + 0.5 + reach) * cell;
        ctx.fillStyle = `rgba(${beamColor},${0.55 * (1 - t)})`;
        ctx.fillRect(x + cell * 0.2, y0, cell * 0.6, y1 - y0);
      }
      ctx.restore();
      // Cleared cells: flash white, then shrink away.
      for (const { i, color } of fx.cells) {
        if (this.board[i]) continue; // already refilled
        const x = pad + (i % BOARD_SIZE) * cell;
        const y = pad + Math.floor(i / BOARD_SIZE) * cell;
        const flash = t < 0.2;
        const shrink = reduced ? 1 : 1 - easeOut(Math.max(0, (t - 0.15) / 0.85));
        ctx.globalAlpha = Math.max(0, 1 - t);
        if (shrink > 0.02 && color) this.blit(color, x, y, shrink);
        if (flash) {
          ctx.globalAlpha = 0.85 * (1 - t / 0.2);
          ctx.fillStyle = '#fff';
          roundRect(ctx, x + cell * 0.05, y + cell * 0.05, cell * 0.9, cell * 0.9, cell * 0.16);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  private drawParticles(now: number): void {
    const ctx = this.ctx;
    const g = this.cell * 26;
    this.particles = this.particles.filter((p) => now - p.born < p.life);
    for (const p of this.particles) {
      const age = now - p.born;
      if (age < 0) continue;
      const t = age / 1000;
      const x = p.x + p.vx * t;
      const y = p.y + p.vy * t + 0.5 * g * t * t;
      const k = 1 - age / p.life;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.rot + p.vr * t);
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
  }

  private drawTexts(now: number, reduced: boolean): void {
    const ctx = this.ctx;
    this.texts = this.texts.filter((t) => now - t.born < 1100);
    for (const t of this.texts) {
      const age = (now - t.born) / 1100;
      const pop = reduced ? 1 : easeOutBack(Math.min(1, age * 5));
      const rise = reduced ? 0 : easeOut(age) * this.cell * 1.2;
      const alpha = age > 0.7 ? 1 - (age - 0.7) / 0.3 : 1;
      const fs = (t.big ? 0.95 : 0.7) * this.cell * pop;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${fs}px Oxanium Variable, Oxanium, system-ui, sans-serif`;
      ctx.lineWidth = Math.max(3, fs * 0.16);
      ctx.strokeStyle = 'rgba(7,9,13,0.85)';
      ctx.strokeText(t.text, t.x, t.y - rise);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y - rise);
      if (t.sub) {
        ctx.font = `600 ${fs * 0.48}px Manrope Variable, Manrope, system-ui, sans-serif`;
        ctx.lineWidth = Math.max(2, fs * 0.1);
        ctx.strokeText(t.sub, t.x, t.y - rise + fs * 0.75);
        ctx.fillStyle = 'rgba(238,242,248,0.9)';
        ctx.fillText(t.sub, t.x, t.y - rise + fs * 0.75);
      }
      ctx.restore();
    }
  }
}
