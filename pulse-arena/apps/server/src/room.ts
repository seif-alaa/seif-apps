import { MAX_DURATION_SEC, MAX_PLAYERS, MIN_DURATION_SEC, MIN_PLAYERS, type PlayerEvent } from '@pulse/engine';
import type { ErrorCode, MemberView, RoomPhase, RoomView } from '@pulse/protocol';
import type { ServerConfig } from './config.js';
import type { Logger } from './log.js';
import { MatchRuntime } from './matchRuntime.js';
import type { Persistence } from './persistence.js';
import type { GameIO } from './types.js';

export interface Member {
  id: string;
  nickname: string;
  ready: boolean;
  connected: boolean;
  socketId: string | null;
  seat: number;
  disconnectedAt: number | null;
}

export interface RoomDeps {
  io: GameIO;
  config: ServerConfig;
  persistence: Persistence;
  log: Logger;
  now: () => number;
}

type Result = { ok: true } | { ok: false; error: ErrorCode };

/**
 * One room: lobby membership, readiness, and the lifecycle of its matches.
 * All mutations happen on the Node event loop, so no locking is needed.
 */
export class Room {
  readonly members = new Map<string, Member>();
  hostId = '';
  phase: RoomPhase = 'lobby';
  durationSec: number;
  match: MatchRuntime | null = null;
  private nextSeat = 0;
  /** Epoch ms since which no member has been connected (null while someone is). */
  emptySince: number | null = null;

  constructor(
    readonly code: string,
    readonly quickPlay: boolean,
    private readonly deps: RoomDeps,
  ) {
    this.durationSec = deps.config.defaultDurationSec;
  }

  get channel(): string {
    return `room:${this.code}`;
  }

  view(): RoomView {
    const members: MemberView[] = [...this.members.values()]
      .sort((a, b) => a.seat - b.seat)
      .map((m) => ({
        id: m.id,
        nickname: m.nickname,
        ready: m.ready,
        connected: m.connected,
        isHost: m.id === this.hostId,
        seat: m.seat,
        inMatch: this.match?.has(m.id) ?? false,
      }));
    return {
      code: this.code,
      phase: this.phase,
      quickPlay: this.quickPlay,
      hostId: this.hostId,
      members,
      durationSec: this.durationSec,
      maxPlayers: MAX_PLAYERS,
      minPlayers: MIN_PLAYERS,
      matchId: this.match?.id ?? null,
    };
  }

  broadcastState(): void {
    this.deps.io.to(this.channel).emit('room:state', this.view());
  }

  private emitTo(memberId: string, fn: (socket: ReturnType<GameIO['to']>) => void): void {
    const m = this.members.get(memberId);
    if (m?.socketId && m.connected) fn(this.deps.io.to(m.socketId));
  }

  /** Attach a socket to the room channel and send it everything it needs. */
  private attachSocket(member: Member, socketId: string): void {
    member.socketId = socketId;
    member.connected = true;
    member.disconnectedAt = null;
    this.emptySince = null;
    this.deps.io.in(socketId).socketsJoin(this.channel);
  }

  add(id: string, nickname: string, socketId: string): Result {
    const existing = this.members.get(id);
    if (existing) {
      existing.nickname = nickname;
      this.attachSocket(existing, socketId);
      this.afterReconnect(existing);
      return { ok: true };
    }
    if (this.phase === 'countdown' || this.phase === 'playing') return { ok: false, error: 'room-in-progress' };
    if (this.members.size >= MAX_PLAYERS) return { ok: false, error: 'room-full' };
    const member: Member = {
      id,
      nickname,
      ready: this.quickPlay,
      connected: true,
      socketId,
      seat: this.nextSeat++,
      disconnectedAt: null,
    };
    this.members.set(id, member);
    if (!this.hostId) this.hostId = id;
    this.attachSocket(member, socketId);
    this.broadcastState();
    return { ok: true };
  }

  private afterReconnect(member: Member): void {
    if (this.match && this.match.has(member.id) && !this.match.ended) {
      this.match.bump(member.id);
      this.broadcastPlayer(member.id);
    }
    this.broadcastState();
    this.deps.log.info('member.reconnected', { room: this.code, player: member.id });
  }

  /** Leave voluntarily. During a match this is a forfeit. */
  remove(id: string, reason: 'left' | 'expired'): void {
    const member = this.members.get(id);
    if (!member) return;
    if (member.socketId) this.deps.io.in(member.socketId).socketsLeave(this.channel);
    this.members.delete(id);
    if (this.match && !this.match.ended && this.match.has(id) && (this.phase === 'playing' || this.phase === 'countdown')) {
      const events = this.match.forfeit(id, this.deps.now(), reason === 'left' ? 'left' : 'disconnected');
      this.afterEvents(groupEvents(events));
    }
    if (this.hostId === id) this.reassignHost();
    this.deps.log.info('member.removed', { room: this.code, player: id, reason });
    this.broadcastState();
  }

  private reassignHost(): void {
    const candidates = [...this.members.values()].sort((a, b) => Number(b.connected) - Number(a.connected) || a.seat - b.seat);
    this.hostId = candidates[0]?.id ?? '';
  }

  handleDisconnect(id: string, socketId: string): void {
    const member = this.members.get(id);
    if (!member || member.socketId !== socketId) return;
    member.connected = false;
    member.disconnectedAt = this.deps.now();
    if (this.match && this.match.has(id) && !this.match.ended) {
      this.match.bump(id);
      this.broadcastPlayer(id);
    }
    if (this.hostId === id) {
      // Hand the host role to someone present so the room can keep going.
      const next = [...this.members.values()].filter((m) => m.connected).sort((a, b) => a.seat - b.seat)[0];
      if (next) this.hostId = next.id;
    }
    if (![...this.members.values()].some((m) => m.connected)) this.emptySince = this.deps.now();
    this.broadcastState();
  }

  setReady(id: string, ready: boolean): Result {
    const m = this.members.get(id);
    if (!m) return { ok: false, error: 'not-in-room' };
    if (this.phase !== 'lobby') return { ok: false, error: 'room-in-progress' };
    m.ready = ready;
    this.broadcastState();
    return { ok: true };
  }

  setDuration(id: string, durationSec: number): Result {
    if (id !== this.hostId) return { ok: false, error: 'not-host' };
    if (this.phase !== 'lobby') return { ok: false, error: 'room-in-progress' };
    if (!Number.isInteger(durationSec) || durationSec < MIN_DURATION_SEC || durationSec > MAX_DURATION_SEC) {
      return { ok: false, error: 'bad-request' };
    }
    this.durationSec = durationSec;
    this.broadcastState();
    return { ok: true };
  }

  /** Players who would take part if the match started now. */
  participants(): Member[] {
    return [...this.members.values()]
      .filter((m) => m.connected && (m.ready || m.id === this.hostId))
      .sort((a, b) => a.seat - b.seat);
  }

  start(requesterId: string | null): Result {
    if (requesterId !== null && requesterId !== this.hostId) return { ok: false, error: 'not-host' };
    if (this.phase !== 'lobby') return { ok: false, error: 'room-in-progress' };
    const players = this.participants();
    if (players.length < MIN_PLAYERS) return { ok: false, error: 'not-enough-players' };
    const now = this.deps.now();
    this.match = new MatchRuntime(
      players.map((m) => ({ id: m.id, nickname: m.nickname, seat: m.seat })),
      this.durationSec * 1000,
      now + this.deps.config.countdownMs,
    );
    this.phase = 'countdown';
    this.deps.io.to(this.channel).emit('match:start', this.match.startPayload());
    for (const p of players) this.sendSelf(p.id, [], undefined);
    for (const p of players) this.broadcastPlayer(p.id);
    this.broadcastState();
    this.deps.log.info('match.start', { room: this.code, match: this.match.id, players: players.length, quickPlay: this.quickPlay });
    return { ok: true };
  }

  rematch(id: string): Result {
    const m = this.members.get(id);
    if (!m) return { ok: false, error: 'not-in-room' };
    if (this.phase === 'results') {
      this.phase = 'lobby';
      for (const member of this.members.values()) member.ready = false;
      // Drop members who are gone, so the new lobby only shows people present.
      for (const member of [...this.members.values()]) if (!member.connected) this.members.delete(member.id);
      if (!this.members.has(this.hostId)) this.reassignHost();
    }
    if (this.phase !== 'lobby') return { ok: false, error: 'room-in-progress' };
    m.ready = true;
    this.broadcastState();
    return { ok: true };
  }

  /* ---------------- Gameplay ---------------- */

  place(id: string, payload: { seq?: unknown; slot?: unknown; col?: unknown; row?: unknown }): void {
    if (!this.match || this.phase !== 'playing' || !this.match.has(id)) {
      this.rejectIntent(id, payload.seq, this.phase === 'countdown' ? 'not-started' : 'not-playing');
      return;
    }
    const r = this.match.place(id, payload.seq, payload.slot, payload.col, payload.row, this.deps.now());
    this.afterAction(r.playerId, r.accepted, r.events, r.error, r.seq);
  }

  swap(id: string, payload: { seq?: unknown; slot?: unknown }): void {
    if (!this.match || this.phase !== 'playing' || !this.match.has(id)) {
      this.rejectIntent(id, payload.seq, 'not-playing');
      return;
    }
    const r = this.match.swap(id, payload.seq, payload.slot, this.deps.now());
    this.afterAction(r.playerId, r.accepted, r.events, r.error, r.seq);
  }

  private rejectIntent(id: string, seq: unknown, error: string): void {
    if (this.match?.has(id)) this.sendSelf(id, [], { seq: typeof seq === 'number' ? seq : 0, error });
  }

  private afterAction(id: string, accepted: boolean, events: PlayerEvent[], error?: string, seq?: number): void {
    if (!accepted) {
      // Duplicates are acknowledged silently: the original was already processed.
      this.sendSelf(id, [], { seq: seq ?? 0, error: error ?? 'rejected' });
      return;
    }
    this.afterEvents(new Map([[id, events]]));
  }

  private afterEvents(byPlayer: Map<string, PlayerEvent[]>): void {
    if (!this.match) return;
    // Ranks first, so every broadcast below carries the current standings.
    const rankChanged = byPlayer.size > 0 ? this.match.refreshRanks() : [];
    for (const [pid, events] of byPlayer) {
      this.sendSelf(pid, events, undefined);
      this.broadcastPlayer(pid);
    }
    for (const pid of rankChanged) if (!byPlayer.has(pid)) this.broadcastPlayer(pid);
    this.maybeFinish();
  }

  private sendSelf(id: string, events: PlayerEvent[], rejected: { seq: number; error: string } | undefined): void {
    if (!this.match) return;
    const update = {
      state: this.match.selfState(id),
      events: MatchRuntime.summarizeSelf(events),
      ...(rejected ? { rejected } : {}),
    };
    this.emitTo(id, (s) => s.emit('match:self', update));
  }

  private broadcastPlayer(id: string): void {
    if (!this.match) return;
    const connected = this.members.get(id)?.connected ?? false;
    this.deps.io.to(this.channel).emit('match:player', this.match.publicState(id, connected));
  }

  syncPayload(id: string) {
    if (!this.match) return null;
    return {
      start: this.match.startPayload(),
      players: this.match.players.map((p) => this.match!.publicState(p.id, this.members.get(p.id)?.connected ?? false)),
      self: this.match.has(id) ? this.match.selfState(id) : null,
      outcome: this.match.results,
    };
  }

  private maybeFinish(): void {
    if (!this.match || this.phase !== 'playing') return;
    const results = this.match.checkEnd(this.deps.now());
    if (!results) return;
    this.phase = 'results';
    for (const m of this.members.values()) m.ready = false;
    this.deps.io.to(this.channel).emit('match:end', results);
    this.broadcastState();
    this.deps.log.info('match.end', { room: this.code, match: results.matchId, reason: results.reason, winner: results.winnerId });
    const startedAt = this.match.startAt;
    this.deps.persistence
      .recordMatch({ results, roomCode: this.code, quickPlay: this.quickPlay, startedAt })
      .catch((err: unknown) => this.deps.log.error('persistence.failed', { err: String(err) }));
  }

  /** Periodic housekeeping. Returns false when the room should be deleted. */
  tick(): boolean {
    const now = this.deps.now();
    if (this.phase === 'countdown' && this.match && now >= this.match.startAt) {
      this.phase = 'playing';
      this.broadcastState();
    }
    if (this.phase === 'playing' && this.match) {
      // Players who stayed away past the reconnect window forfeit.
      // Participants who left the room entirely were already forfeited in remove().
      const events = [];
      for (const m of this.members.values()) {
        if (!m.connected && m.disconnectedAt !== null && now - m.disconnectedAt >= this.deps.config.reconnectWindowMs) {
          if (this.match.state.players[m.id]?.alive) events.push(...this.match.forfeit(m.id, now, 'disconnected'));
        }
      }
      events.push(...this.match.tick(now));
      const grouped = groupEvents(events);
      if (grouped.size > 0) this.afterEvents(grouped);
      else this.maybeFinish();
    }
    if (this.phase !== 'playing' && this.phase !== 'countdown') {
      for (const m of [...this.members.values()]) {
        if (!m.connected && m.disconnectedAt !== null && now - m.disconnectedAt >= this.deps.config.lobbyGraceMs) {
          this.remove(m.id, 'expired');
        }
      }
    }
    if (this.members.size === 0) return false;
    if (this.emptySince !== null && now - this.emptySince >= this.deps.config.idleRoomMs) return false;
    return true;
  }
}

function groupEvents(events: { playerId: string; event: PlayerEvent }[]): Map<string, PlayerEvent[]> {
  const out = new Map<string, PlayerEvent[]>();
  for (const e of events) {
    const list = out.get(e.playerId) ?? [];
    list.push(e.event);
    out.set(e.playerId, list);
  }
  return out;
}
