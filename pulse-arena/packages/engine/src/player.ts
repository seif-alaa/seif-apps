import {
  type Board,
  canPlace,
  clearLines,
  countPlacements,
  emptyBoard,
  filledCount,
  findFullLines,
  fitsAnywhere,
  idx,
  isEmpty,
  stamp,
} from './board.js';
import { STATIC_COLOR, dealCycle, getPiece, rerollPiece } from './pieces.js';
import { Stream, hashKey } from './rng.js';
import {
  BOARD_SIZE,
  CELL_COUNT,
  CHAIN_MISS_LIMIT,
  CROSS_BONUS,
  IDLE_GRACE_MS,
  LAST_CHANCE_MS,
  OFFER_SIZE,
  PLACE_PER_CYCLE,
  PULSE_CHAIN_CAP,
  PULSE_COST,
  PULSE_MAX,
  PULSE_PER_CHAIN,
  PULSE_PER_LINE,
  PULSE_SWAPS_PER_CYCLE,
  STATIC_INTERVAL_MS,
  SURGE_MULT,
  SWEEP_BONUS,
  type SurgeWindow,
  chainMultiplier,
  clearBasePoints,
  surgeActiveAt,
} from './rules.js';

export type EliminationReason = 'no-moves' | 'last-chance' | 'disconnected' | 'left';

export interface PlayerState {
  board: Board;
  /** Offered pieces for the current cycle; null marks a slot already placed. */
  tray: (string | null)[];
  cycle: number;
  placedThisCycle: number;
  swapsThisCycle: number;
  score: number;
  lines: number;
  placements: number;
  chain: number;
  bestChain: number;
  /** Consecutive placements without a clear. */
  misses: number;
  pulse: number;
  pulseSpent: number;
  staticCount: number;
  /** Elapsed match time (ms) of the last placement or swap. */
  lastActionAt: number;
  nextStaticAt: number;
  /** Set while the player is out of moves but can still afford a Pulse swap. */
  lastChanceUntil: number | null;
  alive: boolean;
  eliminatedAt: number | null;
  eliminationReason: EliminationReason | null;
  /** Elapsed time at which the current score was reached (tie-breaker). */
  scoreReachedAt: number;
}

export interface RuleContext {
  seed: number;
  /** Elapsed milliseconds since the match started. */
  now: number;
  surges: readonly SurgeWindow[];
}

export interface PlaceEvent {
  kind: 'place';
  piece: string;
  col: number;
  row: number;
  rows: number[];
  cols: number[];
  points: number;
  placePoints: number;
  clearPoints: number;
  crossBonus: number;
  sweepBonus: number;
  multiplier: number;
  surge: boolean;
  chain: number;
  pulseGain: number;
  cycleAdvanced: boolean;
  /** Piece discarded when the cycle ended, if any. */
  discarded: string | null;
}

export interface SwapEvent {
  kind: 'swap';
  slot: number;
  from: string;
  to: string;
}

export interface StaticEvent {
  kind: 'static';
  cell: number;
}

export interface EliminateEvent {
  kind: 'eliminated';
  reason: EliminationReason;
}

export type PlayerEvent = PlaceEvent | SwapEvent | StaticEvent | EliminateEvent;

export type ActionResult =
  | { ok: true; state: PlayerState; events: PlayerEvent[] }
  | { ok: false; error: ActionError };

export type ActionError =
  | 'eliminated'
  | 'bad-slot'
  | 'slot-empty'
  | 'illegal-position'
  | 'no-pulse'
  | 'swap-limit';

export function createPlayerState(seed: number): PlayerState {
  return {
    board: emptyBoard(),
    tray: [...dealCycle(seed, 0)],
    cycle: 0,
    placedThisCycle: 0,
    swapsThisCycle: 0,
    score: 0,
    lines: 0,
    placements: 0,
    chain: 0,
    bestChain: 0,
    misses: 0,
    pulse: 0,
    pulseSpent: 0,
    staticCount: 0,
    lastActionAt: 0,
    nextStaticAt: IDLE_GRACE_MS,
    lastChanceUntil: null,
    alive: true,
    eliminatedAt: null,
    eliminationReason: null,
    scoreReachedAt: 0,
  };
}

export function clonePlayer(s: PlayerState): PlayerState {
  return { ...s, board: s.board.slice(), tray: s.tray.slice() };
}

function validSlot(slot: unknown): slot is number {
  return typeof slot === 'number' && Number.isInteger(slot) && slot >= 0 && slot < OFFER_SIZE;
}

export function canSwap(s: PlayerState): boolean {
  return s.alive && s.pulse >= PULSE_COST && s.swapsThisCycle < PULSE_SWAPS_PER_CYCLE;
}

/** Pieces still available to place this cycle. */
export function remainingPieces(s: PlayerState): string[] {
  return s.tray.filter((p): p is string => p !== null);
}

export function hasLegalMove(s: PlayerState): boolean {
  return remainingPieces(s).some((id) => fitsAnywhere(s.board, getPiece(id)));
}

/**
 * Re-evaluate whether the player can continue. Mutates the given state.
 * Out of moves with an affordable swap opens a Last Chance window;
 * out of moves without one eliminates immediately.
 */
function evaluate(s: PlayerState, now: number, events: PlayerEvent[]): void {
  if (!s.alive) return;
  if (hasLegalMove(s)) {
    s.lastChanceUntil = null;
    return;
  }
  if (canSwap(s)) {
    if (s.lastChanceUntil === null) s.lastChanceUntil = now + LAST_CHANCE_MS;
    return;
  }
  eliminate(s, now, 'no-moves', events);
}

function eliminate(s: PlayerState, now: number, reason: EliminationReason, events: PlayerEvent[]): void {
  if (!s.alive) return;
  s.alive = false;
  s.eliminatedAt = now;
  s.eliminationReason = reason;
  s.lastChanceUntil = null;
  events.push({ kind: 'eliminated', reason });
}

export function placePiece(prev: PlayerState, ctx: RuleContext, slot: number, col: number, row: number): ActionResult {
  if (!prev.alive) return { ok: false, error: 'eliminated' };
  if (!validSlot(slot)) return { ok: false, error: 'bad-slot' };
  const pieceId = prev.tray[slot];
  if (!pieceId) return { ok: false, error: 'slot-empty' };
  const piece = getPiece(pieceId);
  if (!canPlace(prev.board, piece, col, row)) return { ok: false, error: 'illegal-position' };

  const s = clonePlayer(prev);
  const events: PlayerEvent[] = [];
  let board = stamp(s.board, piece, col, row);
  const full = findFullLines(board);
  const lineCount = full.rows.length + full.cols.length;
  if (lineCount > 0) board = clearLines(board, full);
  s.board = board;

  const surge = surgeActiveAt(ctx.surges, ctx.now);
  const placePoints = piece.size;
  let clearPoints = 0;
  let crossBonus = 0;
  let sweepBonus = 0;
  let multiplier = 1;
  let pulseGain = 0;

  if (lineCount > 0) {
    s.chain += 1;
    s.misses = 0;
    s.bestChain = Math.max(s.bestChain, s.chain);
    multiplier = chainMultiplier(s.chain) * (surge ? SURGE_MULT : 1);
    crossBonus = full.rows.length > 0 && full.cols.length > 0 ? CROSS_BONUS : 0;
    clearPoints = Math.round(clearBasePoints(lineCount) * multiplier);
    if (isEmpty(board)) sweepBonus = SWEEP_BONUS;
    pulseGain = PULSE_PER_LINE * lineCount + PULSE_PER_CHAIN * Math.min(s.chain - 1, PULSE_CHAIN_CAP);
    if (surge) pulseGain *= SURGE_MULT;
    s.lines += lineCount;
  } else {
    s.misses += 1;
    if (s.misses >= CHAIN_MISS_LIMIT) s.chain = 0;
  }

  const points = placePoints + clearPoints + crossBonus + sweepBonus;
  s.score += points;
  if (points > 0) s.scoreReachedAt = ctx.now;
  s.pulse = Math.min(PULSE_MAX, s.pulse + pulseGain);
  s.placements += 1;

  s.tray[slot] = null;
  s.placedThisCycle += 1;
  let cycleAdvanced = false;
  let discarded: string | null = null;
  if (s.placedThisCycle >= PLACE_PER_CYCLE) {
    discarded = remainingPieces(s)[0] ?? null;
    s.cycle += 1;
    s.tray = [...dealCycle(ctx.seed, s.cycle)];
    s.placedThisCycle = 0;
    s.swapsThisCycle = 0;
    cycleAdvanced = true;
  }

  s.lastActionAt = ctx.now;
  s.nextStaticAt = ctx.now + IDLE_GRACE_MS;

  events.push({
    kind: 'place',
    piece: pieceId,
    col,
    row,
    rows: full.rows,
    cols: full.cols,
    points,
    placePoints,
    clearPoints,
    crossBonus,
    sweepBonus,
    multiplier,
    surge,
    chain: s.chain,
    pulseGain,
    cycleAdvanced,
    discarded,
  });
  evaluate(s, ctx.now, events);
  return { ok: true, state: s, events };
}

/** Spend Pulse to replace an offered piece with a server-determined one. */
export function swapPiece(prev: PlayerState, ctx: RuleContext, slot: number): ActionResult {
  if (!prev.alive) return { ok: false, error: 'eliminated' };
  if (!validSlot(slot)) return { ok: false, error: 'bad-slot' };
  const from = prev.tray[slot];
  if (!from) return { ok: false, error: 'slot-empty' };
  if (prev.pulse < PULSE_COST) return { ok: false, error: 'no-pulse' };
  if (prev.swapsThisCycle >= PULSE_SWAPS_PER_CYCLE) return { ok: false, error: 'swap-limit' };

  const s = clonePlayer(prev);
  const events: PlayerEvent[] = [];
  const to = rerollPiece(ctx.seed, s.cycle, s.swapsThisCycle, from);
  s.tray[slot] = to;
  s.pulse -= PULSE_COST;
  s.pulseSpent += PULSE_COST;
  s.swapsThisCycle += 1;
  s.lastActionAt = ctx.now;
  s.nextStaticAt = ctx.now + IDLE_GRACE_MS;
  s.lastChanceUntil = null;
  events.push({ kind: 'swap', slot, from, to });
  evaluate(s, ctx.now, events);
  return { ok: true, state: s, events };
}

/**
 * Choose the cell for the next Static drop. Static never completes a line,
 * so idling can never award a free clear. Deterministic per match seed.
 */
export function pickStaticCell(board: Board, seed: number, staticIndex: number): number | null {
  const candidates: number[] = [];
  const rowFill = new Array<number>(BOARD_SIZE).fill(0);
  const colFill = new Array<number>(BOARD_SIZE).fill(0);
  for (let i = 0; i < CELL_COUNT; i++) {
    if (board[i] !== 0) {
      rowFill[Math.floor(i / BOARD_SIZE)]! += 1;
      colFill[i % BOARD_SIZE]! += 1;
    }
  }
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const i = idx(c, r);
      if (board[i] !== 0) continue;
      if (rowFill[r] === BOARD_SIZE - 1 || colFill[c] === BOARD_SIZE - 1) continue;
      candidates.push(i);
    }
  }
  if (candidates.length === 0) return null;
  return candidates[hashKey(seed, Stream.Static, staticIndex) % candidates.length]!;
}

/** Advance time-based rules for one player: Last Chance expiry and Static drops. */
export function tickPlayer(prev: PlayerState, ctx: RuleContext): { state: PlayerState; events: PlayerEvent[] } {
  if (!prev.alive) return { state: prev, events: [] };
  const needsLastChance = prev.lastChanceUntil !== null && ctx.now >= prev.lastChanceUntil;
  const needsStatic = ctx.now >= prev.nextStaticAt;
  if (!needsLastChance && !needsStatic) return { state: prev, events: [] };

  const s = clonePlayer(prev);
  const events: PlayerEvent[] = [];
  if (needsLastChance) {
    eliminate(s, ctx.now, 'last-chance', events);
    return { state: s, events };
  }
  // Drop at most one Static cell per tick so catch-up after a stall stays gradual.
  const cell = pickStaticCell(s.board, ctx.seed, s.staticCount);
  s.staticCount += 1;
  s.nextStaticAt = Math.max(ctx.now, prev.nextStaticAt) + STATIC_INTERVAL_MS;
  if (cell !== null) {
    s.board[cell] = STATIC_COLOR;
    events.push({ kind: 'static', cell });
  }
  evaluate(s, ctx.now, events);
  return { state: s, events };
}

export function forfeitPlayer(prev: PlayerState, now: number, reason: EliminationReason): { state: PlayerState; events: PlayerEvent[] } {
  if (!prev.alive) return { state: prev, events: [] };
  const s = clonePlayer(prev);
  const events: PlayerEvent[] = [];
  eliminate(s, now, reason, events);
  return { state: s, events };
}

/**
 * Danger level for presentation: 0 safe, 1 tight, 2 critical.
 * Based on how many legal positions remain for the offered pieces.
 */
export function dangerLevel(s: PlayerState): 0 | 1 | 2 {
  if (!s.alive) return 0;
  if (s.lastChanceUntil !== null) return 2;
  let positions = 0;
  for (const id of remainingPieces(s)) positions += countPlacements(s.board, getPiece(id));
  if (positions <= 3) return 2;
  if (positions <= 10 || filledCount(s.board) >= CELL_COUNT * 0.6) return 1;
  return 0;
}
