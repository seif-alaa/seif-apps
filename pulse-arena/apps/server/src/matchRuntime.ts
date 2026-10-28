import { randomBytes, randomInt } from 'node:crypto';
import {
  type MatchEvent,
  type MatchState,
  type PlayerEvent,
  checkEnd,
  createMatch,
  dangerLevel,
  encodeBoard,
  getPiece,
  idx,
  matchForfeit,
  matchPlace,
  matchSwap,
  matchTick,
  standings,
} from '@pulse/engine';
import type {
  ActivitySummary,
  MatchPlayerInfo,
  MatchResults,
  MatchStartPayload,
  PublicPlayerState,
  SelfEventSummary,
  SelfState,
} from '@pulse/protocol';

export interface ActionOutcome {
  playerId: string;
  accepted: boolean;
  error?: string;
  seq?: number;
  events: PlayerEvent[];
}

/**
 * Server-side wrapper around the pure engine match. Owns the authoritative
 * clock mapping, replay protection (per-player sequence numbers) and the
 * conversion of engine state into wire payloads.
 */
export class MatchRuntime {
  readonly id = randomBytes(8).toString('hex');
  readonly state: MatchState;
  readonly players: MatchPlayerInfo[];
  private readonly lastSeq = new Map<string, number>();
  private readonly versions = new Map<string, number>();
  private readonly activity = new Map<string, ActivitySummary>();
  private readonly ranks = new Map<string, number>();
  results: MatchResults | null = null;

  constructor(
    players: MatchPlayerInfo[],
    readonly durationMs: number,
    /** Server epoch ms when play begins. */
    readonly startAt: number,
    seed: number = randomInt(0, 2 ** 31),
  ) {
    this.players = players;
    this.state = createMatch({ seed, durationMs, players: players.map((p) => ({ id: p.id, seat: p.seat })) });
    for (const p of players) {
      this.lastSeq.set(p.id, 0);
      this.versions.set(p.id, 0);
    }
    this.refreshRanks();
  }

  has(id: string): boolean {
    return id in this.state.players;
  }

  elapsed(now: number): number {
    return now - this.startAt;
  }

  get ended(): boolean {
    return this.state.outcome !== null;
  }

  startPayload(): MatchStartPayload {
    return {
      matchId: this.id,
      startAt: this.startAt,
      durationMs: this.durationMs,
      surges: this.state.surges,
      players: this.players,
    };
  }

  private acceptSeq(id: string, seq: unknown): { ok: true; seq: number } | { ok: false; error: string } {
    if (typeof seq !== 'number' || !Number.isSafeInteger(seq) || seq <= 0) return { ok: false, error: 'bad-seq' };
    const last = this.lastSeq.get(id) ?? 0;
    if (seq <= last) return { ok: false, error: 'duplicate' };
    this.lastSeq.set(id, seq);
    return { ok: true, seq };
  }

  place(id: string, seq: unknown, slot: unknown, col: unknown, row: unknown, now: number): ActionOutcome {
    const s = this.acceptSeq(id, seq);
    if (!s.ok) return { playerId: id, accepted: false, error: s.error, events: [] };
    if (typeof slot !== 'number' || typeof col !== 'number' || typeof row !== 'number') {
      return { playerId: id, accepted: false, error: 'bad-request', seq: s.seq, events: [] };
    }
    const r = matchPlace(this.state, id, slot, col, row, this.elapsed(now));
    if (!r.ok) return { playerId: id, accepted: false, error: r.error, seq: s.seq, events: [] };
    this.touch(id, r.events, now);
    return { playerId: id, accepted: true, seq: s.seq, events: r.events };
  }

  swap(id: string, seq: unknown, slot: unknown, now: number): ActionOutcome {
    const s = this.acceptSeq(id, seq);
    if (!s.ok) return { playerId: id, accepted: false, error: s.error, events: [] };
    if (typeof slot !== 'number') return { playerId: id, accepted: false, error: 'bad-request', seq: s.seq, events: [] };
    const r = matchSwap(this.state, id, slot, this.elapsed(now));
    if (!r.ok) return { playerId: id, accepted: false, error: r.error, seq: s.seq, events: [] };
    this.touch(id, r.events, now);
    return { playerId: id, accepted: true, seq: s.seq, events: r.events };
  }

  tick(now: number): MatchEvent[] {
    const events = matchTick(this.state, this.elapsed(now));
    this.touchAll(events, now);
    return events;
  }

  forfeit(id: string, now: number, reason: 'disconnected' | 'left'): MatchEvent[] {
    const events = matchForfeit(this.state, id, this.elapsed(now), reason);
    this.touchAll(events, now);
    return events;
  }

  /** Bump a player's version so clients know their public state changed. */
  bump(id: string): void {
    this.versions.set(id, (this.versions.get(id) ?? 0) + 1);
  }

  private touchAll(events: MatchEvent[], now: number): void {
    const byPlayer = new Map<string, PlayerEvent[]>();
    for (const e of events) {
      const list = byPlayer.get(e.playerId) ?? [];
      list.push(e.event);
      byPlayer.set(e.playerId, list);
    }
    for (const [id, list] of byPlayer) this.touch(id, list, now);
  }

  private touch(id: string, events: PlayerEvent[], now: number): void {
    this.bump(id);
    const last = events[events.length - 1];
    // Prefer the most significant event for the opponent activity feed.
    const main = events.find((e) => e.kind === 'eliminated') ?? events.find((e) => e.kind === 'place') ?? last;
    if (main) this.activity.set(id, this.summarize(main, this.elapsed(now)));
  }

  private summarize(e: PlayerEvent, at: number): ActivitySummary {
    switch (e.kind) {
      case 'place': {
        const piece = getPiece(e.piece);
        const cells = piece.cells.map(([c, r]) => idx(e.col + c, e.row + r));
        const lines = e.rows.length + e.cols.length;
        return lines > 0
          ? { kind: 'clear', lines, points: e.points, chain: e.chain, surge: e.surge, cells, rows: e.rows, cols: e.cols, at }
          : { kind: 'place', points: e.points, cells, at };
      }
      case 'swap':
        return { kind: 'swap', at };
      case 'static':
        return { kind: 'static', cells: [e.cell], at };
      case 'eliminated':
        return { kind: 'eliminated', at };
    }
  }

  /** Recompute live ranks. Returns ids whose rank changed. */
  refreshRanks(): string[] {
    const changed: string[] = [];
    for (const row of standings(this.state)) {
      if (this.ranks.get(row.id) !== row.rank) {
        this.ranks.set(row.id, row.rank);
        changed.push(row.id);
      }
    }
    for (const id of changed) this.bump(id);
    return changed;
  }

  publicState(id: string, connected: boolean): PublicPlayerState {
    const s = this.state.players[id]!;
    return {
      id,
      board: encodeBoard(s.board),
      score: s.score,
      lines: s.lines,
      chain: s.chain,
      bestChain: s.bestChain,
      pulse: s.pulse,
      cycle: s.cycle,
      alive: s.alive,
      connected,
      danger: dangerLevel(s),
      rank: this.ranks.get(id) ?? 0,
      eliminatedAt: s.eliminatedAt,
      eliminationReason: s.eliminationReason,
      activity: this.activity.get(id) ?? null,
      version: this.versions.get(id) ?? 0,
    };
  }

  selfState(id: string): SelfState {
    const s = this.state.players[id]!;
    return {
      board: encodeBoard(s.board),
      tray: s.tray.slice(),
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
      ackSeq: this.lastSeq.get(id) ?? 0,
    };
  }

  static summarizeSelf(events: PlayerEvent[]): SelfEventSummary[] {
    return events.map((e): SelfEventSummary => {
      if (e.kind === 'place') {
        return {
          kind: 'place',
          piece: e.piece,
          col: e.col,
          row: e.row,
          rows: e.rows,
          cols: e.cols,
          points: e.points,
          multiplier: e.multiplier,
          chain: e.chain,
          surge: e.surge,
          pulseGain: e.pulseGain,
          sweep: e.sweepBonus > 0,
          cross: e.crossBonus > 0,
          cycleAdvanced: e.cycleAdvanced,
          discarded: e.discarded,
        };
      }
      return e;
    });
  }

  /** Evaluate end conditions; builds results once. */
  checkEnd(now: number): MatchResults | null {
    if (this.results) return this.results;
    const outcome = checkEnd(this.state, this.elapsed(now));
    if (!outcome) return null;
    const names = new Map(this.players.map((p) => [p.id, p.nickname]));
    this.results = {
      matchId: this.id,
      reason: outcome.reason,
      winnerId: outcome.winnerId,
      endedAt: outcome.endedAt,
      durationMs: this.durationMs,
      rows: outcome.standings.map((s) => ({
        id: s.id,
        nickname: names.get(s.id) ?? 'Player',
        rank: s.rank,
        score: s.score,
        lines: s.lines,
        bestChain: s.bestChain,
        alive: s.alive,
        eliminatedAt: s.eliminatedAt,
        eliminationReason: s.eliminationReason,
      })),
    };
    return this.results;
  }
}
