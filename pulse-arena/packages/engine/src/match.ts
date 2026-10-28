import {
  type ActionResult,
  type EliminationReason,
  type PlayerEvent,
  type PlayerState,
  createPlayerState,
  forfeitPlayer,
  placePiece,
  swapPiece,
  tickPlayer,
} from './player.js';
import { type SurgeWindow, surgeSchedule } from './rules.js';

export interface MatchPlayerConfig {
  id: string;
  /** Join order inside the room, used as the final deterministic tie-breaker. */
  seat: number;
}

export interface MatchConfig {
  seed: number;
  durationMs: number;
  players: MatchPlayerConfig[];
}

export type OutcomeReason = 'last-standing' | 'time' | 'all-eliminated';

export interface Standing {
  id: string;
  rank: number;
  score: number;
  lines: number;
  bestChain: number;
  alive: boolean;
  eliminatedAt: number | null;
  eliminationReason: EliminationReason | null;
}

export interface MatchOutcome {
  reason: OutcomeReason;
  winnerId: string;
  endedAt: number;
  standings: Standing[];
}

export interface MatchState {
  seed: number;
  durationMs: number;
  surges: SurgeWindow[];
  seats: Record<string, number>;
  players: Record<string, PlayerState>;
  outcome: MatchOutcome | null;
}

export interface MatchEvent {
  playerId: string;
  event: PlayerEvent;
}

export function createMatch(config: MatchConfig): MatchState {
  const players: Record<string, PlayerState> = {};
  const seats: Record<string, number> = {};
  for (const p of config.players) {
    players[p.id] = createPlayerState(config.seed);
    seats[p.id] = p.seat;
  }
  return {
    seed: config.seed,
    durationMs: config.durationMs,
    surges: surgeSchedule(config.durationMs),
    seats,
    players,
    outcome: null,
  };
}

interface RankRow {
  id: string;
  seat: number;
  s: PlayerState;
}

/**
 * Deterministic ordering used for live ranks and final standings.
 *
 * 1. Players still alive rank above every eliminated player.
 * 2. Alive players: higher score, then more lines cleared, then whoever reached
 *    their score first, then lower seat number.
 * 3. Eliminated players: later elimination ranks higher, then higher score,
 *    then more lines, then lower seat number.
 */
export function compareStanding(a: RankRow, b: RankRow): number {
  if (a.s.alive !== b.s.alive) return a.s.alive ? -1 : 1;
  if (!a.s.alive) {
    const ea = a.s.eliminatedAt ?? 0;
    const eb = b.s.eliminatedAt ?? 0;
    if (ea !== eb) return eb - ea;
  }
  if (a.s.score !== b.s.score) return b.s.score - a.s.score;
  if (a.s.lines !== b.s.lines) return b.s.lines - a.s.lines;
  if (a.s.alive && a.s.scoreReachedAt !== b.s.scoreReachedAt) return a.s.scoreReachedAt - b.s.scoreReachedAt;
  return a.seat - b.seat;
}

export function standings(m: MatchState): Standing[] {
  const rows: RankRow[] = Object.entries(m.players).map(([id, s]) => ({ id, seat: m.seats[id] ?? 0, s }));
  rows.sort(compareStanding);
  return rows.map((r, i) => ({
    id: r.id,
    rank: i + 1,
    score: r.s.score,
    lines: r.s.lines,
    bestChain: r.s.bestChain,
    alive: r.s.alive,
    eliminatedAt: r.s.eliminatedAt,
    eliminationReason: r.s.eliminationReason,
  }));
}

function aliveCount(m: MatchState): number {
  let n = 0;
  for (const s of Object.values(m.players)) if (s.alive) n++;
  return n;
}

/** Decide whether the match has ended at elapsed time `now`. Mutates m.outcome when it has. */
export function checkEnd(m: MatchState, now: number): MatchOutcome | null {
  if (m.outcome) return m.outcome;
  const total = Object.keys(m.players).length;
  const alive = aliveCount(m);
  let reason: OutcomeReason | null = null;
  if (total >= 2 && alive === 1) reason = 'last-standing';
  else if (alive === 0) reason = 'all-eliminated';
  else if (now >= m.durationMs) reason = 'time';
  if (!reason) return null;
  const table = standings(m);
  m.outcome = { reason, winnerId: table[0]!.id, endedAt: Math.min(now, m.durationMs), standings: table };
  return m.outcome;
}

function ctx(m: MatchState, now: number) {
  return { seed: m.seed, now, surges: m.surges };
}

function commit(m: MatchState, id: string, r: ActionResult): ActionResult {
  if (r.ok) m.players[id] = r.state;
  return r;
}

export type MatchActionResult = ActionResult | { ok: false; error: 'not-in-match' | 'match-over' | 'not-started' };

export function matchPlace(m: MatchState, id: string, slot: number, col: number, row: number, now: number): MatchActionResult {
  const s = m.players[id];
  if (!s) return { ok: false, error: 'not-in-match' };
  if (m.outcome || now >= m.durationMs) return { ok: false, error: 'match-over' };
  if (now < 0) return { ok: false, error: 'not-started' };
  return commit(m, id, placePiece(s, ctx(m, now), slot, col, row));
}

export function matchSwap(m: MatchState, id: string, slot: number, now: number): MatchActionResult {
  const s = m.players[id];
  if (!s) return { ok: false, error: 'not-in-match' };
  if (m.outcome || now >= m.durationMs) return { ok: false, error: 'match-over' };
  if (now < 0) return { ok: false, error: 'not-started' };
  return commit(m, id, swapPiece(s, ctx(m, now), slot));
}

/** Advance timers for every player. Returns the events produced. */
export function matchTick(m: MatchState, now: number): MatchEvent[] {
  const out: MatchEvent[] = [];
  if (m.outcome || now < 0) return out;
  const t = Math.min(now, m.durationMs);
  for (const id of Object.keys(m.players)) {
    const r = tickPlayer(m.players[id]!, ctx(m, t));
    m.players[id] = r.state;
    for (const event of r.events) out.push({ playerId: id, event });
  }
  return out;
}

export function matchForfeit(m: MatchState, id: string, now: number, reason: EliminationReason): MatchEvent[] {
  const s = m.players[id];
  if (!s || m.outcome) return [];
  const r = forfeitPlayer(s, Math.max(0, Math.min(now, m.durationMs)), reason);
  m.players[id] = r.state;
  return r.events.map((event) => ({ playerId: id, event }));
}
