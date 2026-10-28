import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZE,
  CHAIN_MISS_LIMIT,
  IDLE_GRACE_MS,
  LAST_CHANCE_MS,
  PIECES,
  PULSE_COST,
  STATIC_COLOR,
  STATIC_INTERVAL_MS,
  SURGE_MULT,
  canPlace,
  checkEnd,
  chooseMove,
  clearBasePoints,
  createMatch,
  createPlayerState,
  createRng,
  dealCycle,
  decodeBoard,
  emptyBoard,
  encodeBoard,
  fitsAnywhere,
  getPiece,
  hasLegalMove,
  idx,
  matchForfeit,
  matchPlace,
  matchSwap,
  matchTick,
  pickStaticCell,
  placePiece,
  rerollPiece,
  standings,
  surgeSchedule,
  swapPiece,
  tickPlayer,
  type PlayerState,
  type RuleContext,
} from '../src/index.js';

const SEED = 12345;
const ctx = (now = 1000, surges = surgeSchedule(180_000)): RuleContext => ({ seed: SEED, now, surges });

/** Build a player whose tray holds exactly the given pieces. */
function withTray(tray: (string | null)[], board = emptyBoard()): PlayerState {
  const s = createPlayerState(SEED);
  s.tray = tray;
  s.board = board;
  return s;
}

function fillRow(board: number[], row: number, exceptCols: number[] = []) {
  for (let c = 0; c < BOARD_SIZE; c++) if (!exceptCols.includes(c)) board[idx(c, row)] = 4;
}
function fillCol(board: number[], col: number, exceptRows: number[] = []) {
  for (let r = 0; r < BOARD_SIZE; r++) if (!exceptRows.includes(r)) board[idx(col, r)] = 4;
}

describe('piece catalogue', () => {
  it('has unique ids and normalized shapes', () => {
    const ids = new Set(PIECES.map((p) => p.id));
    expect(ids.size).toBe(PIECES.length);
    for (const p of PIECES) {
      expect(Math.min(...p.cells.map((c) => c[0]))).toBe(0);
      expect(Math.min(...p.cells.map((c) => c[1]))).toBe(0);
      expect(p.size).toBe(p.cells.length);
    }
  });

  it('deals identically for the same seed and cycle', () => {
    for (let c = 0; c < 50; c++) expect(dealCycle(SEED, c)).toEqual(dealCycle(SEED, c));
    const a = Array.from({ length: 20 }, (_, c) => dealCycle(1, c).join());
    const b = Array.from({ length: 20 }, (_, c) => dealCycle(2, c).join());
    expect(a).not.toEqual(b);
  });

  it('caps large pieces per deal and deals none during warm-up', () => {
    for (let seed = 0; seed < 50; seed++) {
      for (let c = 0; c < 40; c++) {
        const sizes = dealCycle(seed, c).map((id) => getPiece(id).size);
        expect(sizes.filter((n) => n >= 5).length).toBeLessThanOrEqual(c >= 20 ? 2 : 1);
        if (c < 2) expect(Math.max(...sizes)).toBeLessThan(5);
      }
    }
  });

  it('rerolls deterministically to a compact, different piece', () => {
    for (let c = 0; c < 30; c++) {
      const from = dealCycle(SEED, c)[0];
      const to = rerollPiece(SEED, c, 0, from);
      expect(to).toBe(rerollPiece(SEED, c, 0, from));
      expect(to).not.toBe(from);
      expect(getPiece(to).size).toBeLessThanOrEqual(4);
    }
  });
});

describe('placement', () => {
  it('accepts a valid placement and scores one point per cell', () => {
    const s = withTray(['slab4', 'mote', 'rod3a']);
    const r = placePiece(s, ctx(), 0, 3, 3);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.score).toBe(4);
    expect(r.state.board[idx(3, 3)]).toBe(getPiece('slab4').color);
    expect(r.state.board[idx(4, 4)]).toBe(getPiece('slab4').color);
    expect(r.state.tray[0]).toBeNull();
    // Original state is untouched.
    expect(s.board[idx(3, 3)]).toBe(0);
  });

  it('rejects out-of-bounds, overlapping and non-integer placements', () => {
    const board = emptyBoard();
    board[idx(0, 0)] = 1;
    const s = withTray(['slab4', 'mote', 'rod3a'], board);
    expect(placePiece(s, ctx(), 0, 8, 0)).toEqual({ ok: false, error: 'illegal-position' });
    expect(placePiece(s, ctx(), 0, -1, 0)).toEqual({ ok: false, error: 'illegal-position' });
    expect(placePiece(s, ctx(), 0, 0, 0)).toEqual({ ok: false, error: 'illegal-position' });
    expect(placePiece(s, ctx(), 0, 1.5, 2)).toEqual({ ok: false, error: 'illegal-position' });
    expect(placePiece(s, ctx(), 5, 1, 1)).toEqual({ ok: false, error: 'bad-slot' });
  });

  it('rejects placing the same slot twice', () => {
    const s = withTray(['mote', 'mote', 'rod3a']);
    const r1 = placePiece(s, ctx(), 0, 0, 0);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(placePiece(r1.state, ctx(), 0, 4, 4)).toEqual({ ok: false, error: 'slot-empty' });
  });
});

describe('line clearing and scoring', () => {
  it('clears a completed row', () => {
    const board = emptyBoard();
    fillRow(board, 4, [8]);
    const s = withTray(['mote', 'mote', 'mote'], board);
    const r = placePiece(s, ctx(), 0, 8, 4);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ev = r.events[0]!;
    expect(ev.kind).toBe('place');
    if (ev.kind !== 'place') return;
    expect(ev.rows).toEqual([4]);
    expect(ev.cols).toEqual([]);
    expect(r.state.board.every((v) => v === 0)).toBe(true);
    // 1 cell + 10 line + sweep bonus since board ends empty.
    expect(ev.placePoints).toBe(1);
    expect(ev.clearPoints).toBe(10);
    expect(ev.sweepBonus).toBe(200);
    expect(r.state.lines).toBe(1);
  });

  it('clears a row and column simultaneously with a cross bonus', () => {
    const board = emptyBoard();
    fillRow(board, 2, [5]);
    fillCol(board, 5, [2]);
    board[idx(0, 0)] = 3; // keep board non-empty after clear
    const s = withTray(['mote', 'mote', 'mote'], board);
    const r = placePiece(s, ctx(), 0, 5, 2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ev = r.events[0]!;
    if (ev.kind !== 'place') throw new Error('expected place');
    expect(ev.rows).toEqual([2]);
    expect(ev.cols).toEqual([5]);
    expect(ev.clearPoints).toBe(clearBasePoints(2));
    expect(ev.crossBonus).toBe(20);
    expect(ev.sweepBonus).toBe(0);
    expect(r.state.board[idx(0, 0)]).toBe(3);
    expect(r.state.board[idx(5, 5)]).toBe(0);
  });

  it('builds chain multipliers and breaks after two misses', () => {
    let s = withTray(['mote', 'mote', 'mote']);
    s.board[idx(0, 8)] = 3;
    const clearRow = (state: PlayerState, row: number) => {
      fillRow(state.board, row, [0]);
      state.tray = ['mote', 'mote', 'mote'];
      state.placedThisCycle = 0;
      const r = placePiece(state, ctx(), 0, 0, row);
      if (!r.ok) throw new Error(r.error);
      return r;
    };
    let r = clearRow(s, 0);
    expect(r.state.chain).toBe(1);
    r = clearRow(r.state, 1);
    expect(r.state.chain).toBe(2);
    const ev = r.events[0]!;
    if (ev.kind !== 'place') throw new Error();
    expect(ev.multiplier).toBe(1.5);
    expect(ev.clearPoints).toBe(15);
    s = r.state;
    // Miss once: chain holds.
    s.tray = ['mote', 'mote', 'mote'];
    s.placedThisCycle = 0;
    let m = placePiece(s, ctx(), 0, 4, 4);
    if (!m.ok) throw new Error();
    expect(m.state.chain).toBe(2);
    // Miss twice: chain breaks.
    m = placePiece(m.state, ctx(), 1, 6, 6);
    if (!m.ok) throw new Error();
    expect(CHAIN_MISS_LIMIT).toBe(2);
    expect(m.state.chain).toBe(0);
  });

  it('doubles clear points during a Surge window', () => {
    const surges = surgeSchedule(180_000);
    const w = surges[0]!;
    const board = emptyBoard();
    fillRow(board, 4, [8]);
    board[idx(0, 0)] = 2;
    const s = withTray(['mote', 'mote', 'mote'], board);
    const normal = placePiece(s, ctx(w.start - 1, surges), 0, 8, 4);
    const surged = placePiece(s, ctx(w.start, surges), 0, 8, 4);
    if (!normal.ok || !surged.ok) throw new Error();
    const a = normal.events[0]!;
    const b = surged.events[0]!;
    if (a.kind !== 'place' || b.kind !== 'place') throw new Error();
    expect(b.surge).toBe(true);
    expect(b.clearPoints).toBe(a.clearPoints * SURGE_MULT);
    expect(b.pulseGain).toBe(a.pulseGain * SURGE_MULT);
  });

  it('publishes a predictable Surge schedule inside the match', () => {
    const s = surgeSchedule(180_000);
    expect(s.map((w) => w.start)).toEqual([45_000, 95_000, 146_000]);
    for (const w of s) expect(w.end).toBeLessThanOrEqual(180_000);
    expect(surgeSchedule(60_000)).toEqual([{ start: 30_000, end: 40_000 }]);
  });
});

describe('cycles', () => {
  it('advances after two placements and discards the third piece', () => {
    const s = createPlayerState(SEED);
    const offered = s.tray.slice();
    const m1 = chooseMove(s)!;
    const r1 = placePiece(s, ctx(), m1.slot, m1.col, m1.row);
    if (!r1.ok) throw new Error();
    expect(r1.state.cycle).toBe(0);
    const m2 = chooseMove(r1.state)!;
    const r2 = placePiece(r1.state, ctx(), m2.slot, m2.col, m2.row);
    if (!r2.ok) throw new Error();
    expect(r2.state.cycle).toBe(1);
    expect(r2.state.tray).toEqual(dealCycle(SEED, 1));
    const ev = r2.events.find((e) => e.kind === 'place');
    if (ev?.kind !== 'place') throw new Error();
    expect(ev.cycleAdvanced).toBe(true);
    const unused = offered.filter((_, i) => i !== m1.slot && i !== m2.slot)[0];
    expect(ev.discarded).toBe(unused);
  });
});

describe('Pulse', () => {
  it('accumulates from clears and caps at the maximum', () => {
    let s = withTray(['mote', 'mote', 'mote']);
    s.board[idx(0, 8)] = 3;
    for (let i = 0; i < 12; i++) {
      fillRow(s.board, 0, [0]);
      s.tray = ['mote', 'mote', 'mote'];
      s.placedThisCycle = 0;
      const r = placePiece(s, ctx(), 0, 0, 0);
      if (!r.ok) throw new Error();
      s = r.state;
    }
    expect(s.pulse).toBe(200);
  });

  it('spends Pulse to swap a piece, once per cycle', () => {
    const s = withTray(['slab9', 'rod5a', 'hook5a']);
    expect(swapPiece(s, ctx(), 0)).toEqual({ ok: false, error: 'no-pulse' });
    s.pulse = 200;
    const r = swapPiece(s, ctx(), 0);
    if (!r.ok) throw new Error();
    expect(r.state.pulse).toBe(200 - PULSE_COST);
    expect(r.state.tray[0]).toBe(rerollPiece(SEED, 0, 0, 'slab9'));
    expect(swapPiece(r.state, ctx(), 1)).toEqual({ ok: false, error: 'swap-limit' });
  });
});

describe('elimination', () => {
  /** Board with only isolated single holes and no full line, so only a single cell fits. */
  function checkerHoles(): number[] {
    const b = new Array<number>(81).fill(4);
    for (let r = 0; r < 9; r += 2) for (let c = 0; c < 9; c += 2) b[idx(c, r)] = 0;
    for (let r = 1; r < 9; r += 2) b[idx(r, r)] = 0;
    return b;
  }

  it('detects when no offered piece fits', () => {
    const s = withTray(['slab4', 'rod3a', 'hook3a'], checkerHoles());
    expect(hasLegalMove(s)).toBe(false);
    s.tray = ['slab4', 'mote', null];
    expect(hasLegalMove(s)).toBe(true);
  });

  it('eliminates a player whose placement leaves no legal move and no Pulse', () => {
    const board = checkerHoles();
    const s = withTray(['mote', 'slab4', 'rod2a'], board);
    const r = placePiece(s, ctx(5000), 0, 0, 0);
    if (!r.ok) throw new Error();
    expect(r.state.alive).toBe(false);
    expect(r.state.eliminatedAt).toBe(5000);
    expect(r.events.some((e) => e.kind === 'eliminated')).toBe(true);
    expect(placePiece(r.state, ctx(), 2, 2, 2)).toEqual({ ok: false, error: 'eliminated' });
  });

  it('opens a Last Chance window when a swap is affordable, then eliminates on expiry', () => {
    const s = withTray(['mote', 'slab4', 'rod2a'], checkerHoles());
    s.pulse = PULSE_COST;
    const r = placePiece(s, ctx(5000), 0, 0, 0);
    if (!r.ok) throw new Error();
    expect(r.state.alive).toBe(true);
    expect(r.state.lastChanceUntil).toBe(5000 + LAST_CHANCE_MS);
    const before = tickPlayer(r.state, ctx(5000 + LAST_CHANCE_MS - 1));
    expect(before.state.alive).toBe(true);
    const after = tickPlayer(r.state, ctx(5000 + LAST_CHANCE_MS));
    expect(after.state.alive).toBe(false);
    expect(after.state.eliminationReason).toBe('last-chance');
  });

  it('cannot loop Pulse swaps to avoid elimination indefinitely', () => {
    const s = withTray(['slab9', 'slab6a', 'rod5a'], checkerHoles());
    s.pulse = 200;
    s.lastChanceUntil = 1000 + LAST_CHANCE_MS;
    let r = swapPiece(s, ctx(1000), 0);
    if (!r.ok) throw new Error();
    // Replacement is at most 4 cells; on this board only a single cell could fit.
    if (getPiece(r.state.tray[0]!).size > 1) {
      expect(r.state.alive).toBe(false);
    }
    // A second swap in the same cycle is refused either way.
    if (r.state.alive) {
      expect(swapPiece(r.state, ctx(1000), 1)).toEqual({ ok: false, error: 'swap-limit' });
    }
  });
});

describe('Static', () => {
  it('drops Static on idle boards and never completes a line', () => {
    let s = createPlayerState(SEED);
    fillRow(s.board, 0, [3]);
    let t = IDLE_GRACE_MS;
    for (let i = 0; i < 5; i++) {
      const r = tickPlayer(s, ctx(t));
      expect(r.events.some((e) => e.kind === 'static')).toBe(true);
      s = r.state;
      t += STATIC_INTERVAL_MS;
    }
    expect(s.board.filter((v) => v === STATIC_COLOR).length).toBe(5);
    expect(s.board[idx(3, 0)]).toBe(0);
  });

  it('is deterministic and resets after an action', () => {
    const b = emptyBoard();
    expect(pickStaticCell(b, SEED, 3)).toBe(pickStaticCell(b, SEED, 3));
    const s = createPlayerState(SEED);
    const m = chooseMove(s)!;
    const r = placePiece(s, ctx(9000), m.slot, m.col, m.row);
    if (!r.ok) throw new Error();
    expect(tickPlayer(r.state, ctx(IDLE_GRACE_MS + 1)).events).toEqual([]);
  });
});

describe('board encoding', () => {
  it('round-trips', () => {
    const b = emptyBoard();
    b[0] = 8;
    b[80] = 3;
    expect(decodeBoard(encodeBoard(b))).toEqual(b);
  });
  it('canPlace and fitsAnywhere agree', () => {
    const b = emptyBoard();
    expect(canPlace(b, getPiece('slab9'), 6, 6)).toBe(true);
    expect(canPlace(b, getPiece('slab9'), 7, 6)).toBe(false);
    expect(fitsAnywhere(b, getPiece('slab9'))).toBe(true);
  });
});

describe('match outcome', () => {
  const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, seat: i }));

  it('ends immediately when one player remains', () => {
    const m = createMatch({ seed: SEED, durationMs: 180_000, players: players(3) });
    matchForfeit(m, 'p0', 1000, 'left');
    expect(checkEnd(m, 1000)).toBeNull();
    matchForfeit(m, 'p1', 2000, 'no-moves');
    const o = checkEnd(m, 2000)!;
    expect(o.reason).toBe('last-standing');
    expect(o.winnerId).toBe('p2');
    expect(o.standings.map((s) => s.id)).toEqual(['p2', 'p1', 'p0']);
  });

  it('awards the highest surviving score at time expiry, ahead of eliminated players', () => {
    const m = createMatch({ seed: SEED, durationMs: 60_000, players: players(3) });
    m.players.p0!.score = 900;
    matchForfeit(m, 'p0', 10_000, 'no-moves');
    m.players.p1!.score = 100;
    m.players.p2!.score = 150;
    expect(checkEnd(m, 59_999)).toBeNull();
    const o = checkEnd(m, 60_000)!;
    expect(o.reason).toBe('time');
    expect(o.winnerId).toBe('p2');
    expect(o.standings.map((s) => s.id)).toEqual(['p2', 'p1', 'p0']);
  });

  it('awards the last eliminated player when everyone is eliminated', () => {
    const m = createMatch({ seed: SEED, durationMs: 60_000, players: players(2) });
    m.players.p0!.score = 500;
    m.players.p1!.score = 10;
    // Simultaneous resolution in one tick: both eliminated, p1 later.
    matchForfeit(m, 'p0', 1000, 'no-moves');
    matchForfeit(m, 'p1', 1200, 'no-moves');
    const o = checkEnd(m, 1200)!;
    expect(o.reason).toBe('all-eliminated');
    expect(o.winnerId).toBe('p1');
  });

  it('breaks exact ties deterministically', () => {
    const m = createMatch({ seed: SEED, durationMs: 60_000, players: players(3) });
    for (const id of ['p0', 'p1', 'p2']) m.players[id]!.score = 100;
    m.players.p0!.lines = 3;
    m.players.p1!.lines = 5;
    m.players.p2!.lines = 5;
    m.players.p1!.scoreReachedAt = 20_000;
    m.players.p2!.scoreReachedAt = 15_000;
    expect(standings(m).map((s) => s.id)).toEqual(['p2', 'p1', 'p0']);
    m.players.p1!.scoreReachedAt = 15_000;
    expect(standings(m).map((s) => s.id)).toEqual(['p1', 'p2', 'p0']);
  });

  it('rejects actions before start, after expiry and from non-members', () => {
    const m = createMatch({ seed: SEED, durationMs: 60_000, players: players(2) });
    expect(matchPlace(m, 'p0', 0, 0, 0, -5)).toEqual({ ok: false, error: 'not-started' });
    expect(matchPlace(m, 'zz', 0, 0, 0, 5)).toEqual({ ok: false, error: 'not-in-match' });
    expect(matchPlace(m, 'p0', 0, 0, 0, 60_000)).toEqual({ ok: false, error: 'match-over' });
    expect(matchSwap(m, 'p0', 0, 60_001)).toEqual({ ok: false, error: 'match-over' });
  });

  it('gives every player the same piece sequence regardless of pace', () => {
    const m = createMatch({ seed: 99, durationMs: 180_000, players: players(2) });
    const seen: Record<string, string[]> = { p0: [], p1: [] };
    // p0 plays fast, p1 plays slow; compare the offers at each cycle.
    for (let t = 0; t < 60; t++) {
      for (const id of ['p0', 'p1']) {
        if (id === 'p1' && t % 3) continue;
        const s = m.players[id]!;
        if (!s.alive) continue;
        if (s.placedThisCycle === 0) seen[id]![s.cycle] = s.tray.join();
        const mv = chooseMove(s);
        if (mv) matchPlace(m, id, mv.slot, mv.col, mv.row, t * 100);
      }
    }
    const shared = Math.min(seen.p0!.length, seen.p1!.length);
    expect(shared).toBeGreaterThan(5);
    for (let c = 0; c < shared; c++) expect(seen.p1![c]).toBe(seen.p0![c]);
  });

  it('runs a full five-player simulated match to a valid outcome', () => {
    const m = createMatch({ seed: 7, durationMs: 180_000, players: players(5) });
    const rand = createRng(1);
    let now = 0;
    while (!checkEnd(m, now)) {
      now += 250;
      matchTick(m, now);
      for (const id of Object.keys(m.players)) {
        const s = m.players[id]!;
        if (!s.alive || rand() < 0.4) continue;
        const mv = chooseMove(s, rand, 30);
        if (mv) matchPlace(m, id, mv.slot, mv.col, mv.row, now);
      }
    }
    const o = m.outcome!;
    expect(o.standings).toHaveLength(5);
    expect(new Set(o.standings.map((s) => s.rank))).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(o.standings[0]!.id).toBe(o.winnerId);
  });
});
