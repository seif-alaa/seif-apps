import {
  type PlayerEvent,
  type PlayerState,
  type SurgeWindow,
  BOARD_SIZE,
  canPlace,
  checkEnd,
  createMatch,
  createPlayerState,
  decodeBoard,
  getPiece,
  idx,
  matchPlace,
  matchSwap,
  matchTick,
  placePiece,
  stamp,
  surgeSchedule,
  type MatchState,
} from '@pulse/engine';
import type { SelfState, SelfUpdate } from '@pulse/protocol';
import { net } from '../net/net';

export interface GameView {
  board: number[];
  tray: (string | null)[];
  cycle: number;
  placedThisCycle: number;
  swapsThisCycle: number;
  score: number;
  lines: number;
  chain: number;
  misses: number;
  pulse: number;
  alive: boolean;
  lastChanceUntil: number | null;
  nextStaticAt: number;
  /** Waiting for the server to deal the next cycle. */
  awaitingDeal: boolean;
}

export type FxEvent =
  | {
      kind: 'place';
      piece: string;
      cells: number[];
      color: number;
      before: number[];
      rows: number[];
      cols: number[];
      points: number;
      multiplier: number;
      chain: number;
      surge: boolean;
      sweep: boolean;
      cross: boolean;
      pulseGain: number;
      cycleAdvanced: boolean;
    }
  | { kind: 'rejected' }
  | { kind: 'swap'; slot: number }
  | { kind: 'static'; cell: number }
  | { kind: 'eliminated' };

export interface GameController {
  readonly kind: 'online' | 'practice' | 'tutorial';
  readonly durationMs: number;
  readonly surges: SurgeWindow[];
  view(): GameView;
  /** Elapsed match ms on the authoritative clock (negative during countdown). */
  elapsed(): number;
  subscribe(fn: () => void): () => void;
  onFx(fn: (e: FxEvent) => void): () => void;
  canPlaceAt(slot: number, col: number, row: number): boolean;
  place(slot: number, col: number, row: number): boolean;
  swap(slot: number): void;
  dispose(): void;
}

function toView(s: PlayerState, awaitingDeal = false): GameView {
  return {
    board: s.board,
    tray: s.tray,
    cycle: s.cycle,
    placedThisCycle: s.placedThisCycle,
    swapsThisCycle: s.swapsThisCycle,
    score: s.score,
    lines: s.lines,
    chain: s.chain,
    misses: s.misses,
    pulse: s.pulse,
    alive: s.alive,
    lastChanceUntil: s.lastChanceUntil,
    nextStaticAt: s.nextStaticAt,
    awaitingDeal,
  };
}

/** Convert an engine place event into a presentation event. */
function placeFx(before: PlayerState, e: Extract<PlayerEvent, { kind: 'place' }>): FxEvent {
  const piece = getPiece(e.piece);
  const cells = piece.cells.map(([c, r]) => idx(e.col + c, e.row + r));
  return {
    kind: 'place',
    piece: e.piece,
    cells,
    color: piece.color,
    before: stamp(before.board, piece, e.col, e.row),
    rows: e.rows,
    cols: e.cols,
    points: e.points,
    multiplier: e.multiplier,
    chain: e.chain,
    surge: e.surge,
    sweep: e.sweepBonus > 0,
    cross: e.crossBonus > 0,
    pulseGain: e.pulseGain,
    cycleAdvanced: e.cycleAdvanced,
  };
}

class Emitter {
  private subs = new Set<() => void>();
  private fxSubs = new Set<(e: FxEvent) => void>();
  subscribe(fn: () => void) {
    this.subs.add(fn);
    return () => void this.subs.delete(fn);
  }
  onFx(fn: (e: FxEvent) => void) {
    this.fxSubs.add(fn);
    return () => void this.fxSubs.delete(fn);
  }
  protected changed() {
    for (const f of this.subs) f();
  }
  protected fx(e: FxEvent) {
    for (const f of this.fxSubs) f(e);
  }
}

/* ======================================================================
 * Online: optimistic prediction reconciled against the authoritative server.
 * ==================================================================== */

interface Pending {
  seq: number;
  slot: number;
  col: number;
  row: number;
}

function fromSelf(s: SelfState): PlayerState {
  const p = createPlayerState(0);
  p.board = decodeBoard(s.board);
  p.tray = s.tray.slice();
  p.cycle = s.cycle;
  p.placedThisCycle = s.placedThisCycle;
  p.swapsThisCycle = s.swapsThisCycle;
  p.score = s.score;
  p.lines = s.lines;
  p.chain = s.chain;
  p.misses = s.misses;
  p.pulse = s.pulse;
  p.alive = s.alive;
  p.lastChanceUntil = s.lastChanceUntil;
  p.nextStaticAt = s.nextStaticAt;
  return p;
}

export class OnlineController extends Emitter implements GameController {
  readonly kind = 'online' as const;
  private base: PlayerState;
  private predicted: PlayerState;
  private awaiting = false;
  private pending: Pending[] = [];
  private seq: number;
  private unsub: () => void;

  constructor(
    private readonly startAt: number,
    readonly durationMs: number,
    readonly surges: SurgeWindow[],
    initial: SelfState,
  ) {
    super();
    this.base = fromSelf(initial);
    this.predicted = this.base;
    this.seq = initial.ackSeq;
    this.unsub = net.onSelf((u) => this.onServer(u));
  }

  elapsed(): number {
    return net.serverNow() - this.startAt;
  }

  view(): GameView {
    return toView(this.predicted, this.awaiting);
  }

  canPlaceAt(slot: number, col: number, row: number): boolean {
    const id = this.predicted.tray[slot];
    if (!id || this.awaiting || !this.base.alive) return false;
    return canPlace(this.predicted.board, getPiece(id), col, row);
  }

  private apply(state: PlayerState, m: Pending, emit: boolean): { state: PlayerState; awaiting: boolean } | null {
    const r = placePiece(state, { seed: 0, now: this.elapsed(), surges: this.surges }, m.slot, m.col, m.row);
    if (!r.ok) return null;
    const next = r.state;
    let awaiting = false;
    const ev = r.events.find((e) => e.kind === 'place');
    if (ev && ev.kind === 'place' && ev.cycleAdvanced) {
      // The next deal comes from the server; we cannot (and must not) know it.
      next.tray = [null, null, null];
      next.cycle = state.cycle + 1;
      awaiting = true;
    }
    // Elimination is only ever shown when the server confirms it.
    next.alive = true;
    next.lastChanceUntil = state.lastChanceUntil;
    if (emit && ev && ev.kind === 'place') this.fx(placeFx(state, ev));
    return { state: next, awaiting };
  }

  place(slot: number, col: number, row: number): boolean {
    if (this.elapsed() < 0 || this.elapsed() >= this.durationMs) return false;
    if (!this.canPlaceAt(slot, col, row)) return false;
    const m: Pending = { seq: ++this.seq, slot, col, row };
    const r = this.apply(this.predicted, m, true);
    if (!r) return false;
    this.predicted = r.state;
    this.awaiting = r.awaiting;
    this.pending.push(m);
    net.emitPlace(m.seq, slot, col, row);
    this.changed();
    return true;
  }

  swap(slot: number): void {
    if (this.awaiting || !this.predicted.tray[slot] || this.pending.length) return;
    net.emitSwap(++this.seq, slot);
  }

  private onServer(u: SelfUpdate): void {
    const s = u.state;
    this.seq = Math.max(this.seq, s.ackSeq);
    this.base = fromSelf(s);
    this.pending = this.pending.filter((p) => p.seq > s.ackSeq);
    if (u.rejected && u.rejected.error !== 'duplicate') {
      this.fx({ kind: 'rejected' });
    }
    // Replay unacknowledged moves on top of the authoritative state.
    let state = this.base;
    let awaiting = false;
    const kept: Pending[] = [];
    for (const p of this.pending) {
      if (awaiting) break;
      const r = this.apply(state, p, false);
      if (!r) break;
      state = r.state;
      awaiting = r.awaiting;
      kept.push(p);
    }
    this.pending = kept;
    this.predicted = state;
    this.awaiting = awaiting;
    for (const e of u.events) {
      if (e.kind === 'static') this.fx({ kind: 'static', cell: e.cell });
      else if (e.kind === 'swap') this.fx({ kind: 'swap', slot: e.slot });
      else if (e.kind === 'eliminated') this.fx({ kind: 'eliminated' });
    }
    this.changed();
  }

  dispose(): void {
    this.unsub();
  }
}

/* ======================================================================
 * Local: practice and tutorial run the same engine entirely on-device.
 * ==================================================================== */

export interface LocalOptions {
  kind: 'practice' | 'tutorial';
  durationMs: number;
  seed?: number;
  /** Disable timers (Static, Last Chance) for scripted tutorial steps. */
  timers?: boolean;
}

export class LocalController extends Emitter implements GameController {
  readonly kind: 'practice' | 'tutorial';
  readonly durationMs: number;
  readonly surges: SurgeWindow[];
  readonly match: MatchState;
  private startAt: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private timers: boolean;
  onEnd: (() => void) | null = null;

  constructor(opts: LocalOptions) {
    super();
    this.kind = opts.kind;
    this.durationMs = opts.durationMs;
    this.timers = opts.timers ?? true;
    this.match = createMatch({ seed: opts.seed ?? Math.floor(Math.random() * 2 ** 31), durationMs: opts.durationMs, players: [{ id: 'me', seat: 0 }] });
    this.surges = opts.kind === 'tutorial' ? [] : surgeSchedule(opts.durationMs);
    this.match.surges = this.surges;
    this.startAt = performance.now() + (opts.kind === 'practice' ? 3000 : 0);
    this.timer = setInterval(() => this.tick(), 100);
  }

  get state(): PlayerState {
    return this.match.players.me!;
  }

  /** Replace the board and tray (tutorial scripting). */
  setup(board: number[], tray: (string | null)[], extra: Partial<PlayerState> = {}): void {
    Object.assign(this.match.players.me!, { board: board.slice(), tray: tray.slice(), placedThisCycle: tray.filter((t) => t === null).length, ...extra });
    this.changed();
  }

  elapsed(): number {
    return performance.now() - this.startAt;
  }

  view(): GameView {
    return toView(this.state);
  }

  canPlaceAt(slot: number, col: number, row: number): boolean {
    const id = this.state.tray[slot];
    return !!id && this.state.alive && canPlace(this.state.board, getPiece(id), col, row);
  }

  place(slot: number, col: number, row: number): boolean {
    const now = this.timers ? this.elapsed() : 0;
    if (now < 0 || this.match.outcome) return false;
    const before = this.state;
    const r = matchPlace(this.match, 'me', slot, col, row, now);
    if (!r.ok) return false;
    for (const e of r.events) {
      if (e.kind === 'place') this.fx(placeFx(before, e));
      if (e.kind === 'eliminated') this.fx({ kind: 'eliminated' });
    }
    this.changed();
    this.checkEnd();
    return true;
  }

  swap(slot: number): void {
    const r = matchSwap(this.match, 'me', slot, this.timers ? Math.max(0, this.elapsed()) : 0);
    if (!r.ok) return;
    for (const e of r.events) {
      if (e.kind === 'swap') this.fx({ kind: 'swap', slot });
      if (e.kind === 'eliminated') this.fx({ kind: 'eliminated' });
    }
    this.changed();
    this.checkEnd();
  }

  private tick(): void {
    if (!this.timers || this.match.outcome) return;
    const events = matchTick(this.match, this.elapsed());
    for (const { event } of events) {
      if (event.kind === 'static') this.fx({ kind: 'static', cell: event.cell });
      if (event.kind === 'eliminated') this.fx({ kind: 'eliminated' });
    }
    if (events.length) this.changed();
    this.checkEnd();
  }

  private checkEnd(): void {
    if (this.kind !== 'practice' || this.match.outcome) return;
    const o = checkEnd(this.match, this.elapsed());
    if (o) {
      this.changed();
      this.onEnd?.();
    }
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
  }
}

export const BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;
