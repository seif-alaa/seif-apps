import { MAX_PLAYERS, MIN_PLAYERS } from '@pulse/engine';
import type { QueueState } from '@pulse/protocol';
import type { ServerConfig } from './config.js';
import type { GameIO } from './types.js';

interface Waiting {
  playerId: string;
  nickname: string;
  socketId: string;
  joinedAt: number;
}

export interface MatchmakerDeps {
  io: GameIO;
  config: ServerConfig;
  now: () => number;
  /** Creates a quick play room with these players and starts it. Returns the room code. */
  formMatch: (players: Waiting[]) => string;
}

/**
 * Public matchmaking for real players only.
 *
 * - Once two players are waiting, a short fill window opens to collect more.
 * - Five waiting players start a match immediately.
 * - A player left alone past the search timeout is told so honestly and removed.
 */
export class Matchmaker {
  private queue: Waiting[] = [];
  private fillEndsAt: number | null = null;

  constructor(private readonly deps: MatchmakerDeps) {}

  get size(): number {
    return this.queue.length;
  }

  has(playerId: string): boolean {
    return this.queue.some((w) => w.playerId === playerId);
  }

  join(playerId: string, nickname: string, socketId: string): QueueState {
    const now = this.deps.now();
    const existing = this.queue.find((w) => w.playerId === playerId);
    if (existing) {
      existing.socketId = socketId;
      existing.nickname = nickname;
    } else {
      this.queue.push({ playerId, nickname, socketId, joinedAt: now });
    }
    this.evaluate();
    return this.stateFor(playerId);
  }

  leave(playerId: string): void {
    const before = this.queue.length;
    this.queue = this.queue.filter((w) => w.playerId !== playerId);
    if (this.queue.length !== before) {
      if (this.queue.length < MIN_PLAYERS) this.fillEndsAt = null;
      this.broadcast();
    }
  }

  tick(): void {
    const now = this.deps.now();
    // Give up on players who have searched alone for too long.
    if (this.fillEndsAt === null) {
      const expired = this.queue.filter((w) => now - w.joinedAt >= this.deps.config.quickPlayTimeoutMs);
      for (const w of expired) {
        this.queue = this.queue.filter((x) => x !== w);
        this.deps.io.to(w.socketId).emit('queue:state', {
          status: 'timeout',
          waiting: this.queue.length,
          fillEndsAt: null,
          searchEndsAt: null,
        });
      }
      if (expired.length) this.broadcast();
    }
    if (this.fillEndsAt !== null && now >= this.fillEndsAt) this.form();
  }

  private evaluate(): void {
    if (this.queue.length >= MAX_PLAYERS) {
      this.form();
      return;
    }
    if (this.queue.length >= MIN_PLAYERS && this.fillEndsAt === null) {
      this.fillEndsAt = this.deps.now() + this.deps.config.quickPlayFillMs;
    }
    this.broadcast();
  }

  private form(): void {
    this.fillEndsAt = null;
    if (this.queue.length < MIN_PLAYERS) {
      this.broadcast();
      return;
    }
    const group = this.queue.slice(0, MAX_PLAYERS);
    this.queue = this.queue.slice(MAX_PLAYERS);
    const code = this.deps.formMatch(group);
    for (const w of group) {
      this.deps.io.to(w.socketId).emit('queue:state', {
        status: 'matched',
        waiting: group.length,
        fillEndsAt: null,
        searchEndsAt: null,
        roomCode: code,
      });
    }
    if (this.queue.length >= MIN_PLAYERS) this.fillEndsAt = this.deps.now() + this.deps.config.quickPlayFillMs;
    this.broadcast();
  }

  private stateFor(playerId: string): QueueState {
    const w = this.queue.find((x) => x.playerId === playerId);
    if (!w) return { status: 'idle', waiting: this.queue.length, fillEndsAt: null, searchEndsAt: null };
    return {
      status: this.fillEndsAt !== null ? 'filling' : 'searching',
      waiting: this.queue.length,
      fillEndsAt: this.fillEndsAt,
      searchEndsAt: this.fillEndsAt !== null ? null : w.joinedAt + this.deps.config.quickPlayTimeoutMs,
    };
  }

  private broadcast(): void {
    for (const w of this.queue) this.deps.io.to(w.socketId).emit('queue:state', this.stateFor(w.playerId));
  }
}
