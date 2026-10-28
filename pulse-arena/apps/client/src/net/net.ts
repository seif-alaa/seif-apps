import { io, type Socket } from 'socket.io-client';
import { PROTOCOL_VERSION, type AckOf, type PayloadOf, type ClientToServer, type ErrorCode, type SelfUpdate, type ServerToClient } from '@pulse/protocol';
import { app, go, matchStore, toast } from '../lib/app';
import { ensureNickname } from '../lib/settings';
import { offlineDemo, serverUrl } from '../native/platform';

type ClientSocket = Socket<ServerToClient, ClientToServer>;

const TOKEN_KEY = 'pulse.session.v1';

function loadToken(): string | undefined {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Without storage the guest identity lasts for this tab only.
  }
}

export const ERROR_TEXT: Record<ErrorCode | 'timeout' | 'offline', string> = {
  'room-not-found': 'No room with that code. Check the code and try again.',
  'room-full': 'That room is full. Rooms hold up to five players.',
  'room-in-progress': 'That match has already started. Ask the host to invite you to the next one.',
  'invalid-code': 'Room codes are five letters or numbers.',
  'invalid-nickname': 'Choose a nickname using letters or numbers.',
  'not-host': 'Only the host can do that.',
  'not-enough-players': 'At least two ready players are needed to start.',
  'not-in-room': 'You are no longer in that room.',
  'already-in-room': 'You are already in a room.',
  'rate-limited': 'Too many requests. Wait a moment and try again.',
  'bad-request': 'That request was not valid.',
  'server-error': 'The server hit a problem. Try again.',
  'version-mismatch': 'A newer version of the game is available. Refresh to update.',
  timeout: 'The server did not respond in time.',
  offline: 'You are offline. Reconnecting.',
};

type SelfListener = (u: SelfUpdate) => void;

/**
 * Network client: one Socket.IO connection, server clock estimation and
 * typed request helpers. Server pushes update the app and match stores.
 */
class Net {
  socket: ClientSocket | null = null;
  /** serverTime ~= Date.now() + offset */
  offset = 0;
  rtt = 0;
  private selfListeners = new Set<SelfListener>();
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private failures = 0;

  serverNow(): number {
    return Date.now() + this.offset;
  }

  onSelf(l: SelfListener): () => void {
    this.selfListeners.add(l);
    return () => this.selfListeners.delete(l);
  }

  connect(): void {
    if (this.socket) return;
    if (offlineDemo) {
      app.set({ conn: 'offline' });
      return;
    }
    const url = serverUrl();
    const socket: ClientSocket = io(url || undefined, {
      transports: ['websocket', 'polling'],
      auth: (cb) => cb({ token: loadToken(), protocol: PROTOCOL_VERSION }),
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      timeout: 6000,
    });
    this.socket = socket;

    socket.on('connect', () => {
      this.failures = 0;
      app.set({ conn: 'online' });
      void this.syncClock();
    });
    socket.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') return;
      app.set({ conn: 'reconnecting' });
    });
    socket.on('connect_error', (err) => {
      this.failures++;
      if (err.message === 'version-mismatch') toast(ERROR_TEXT['version-mismatch'], 'warn', 6000);
      app.set({ conn: this.failures >= 3 ? 'offline' : 'reconnecting' });
    });

    socket.on('session', (s) => {
      saveToken(s.token);
      app.set({ playerId: s.playerId });
      // A room we were in before the drop: restore it.
      if (app.get().room) void this.resync();
    });
    socket.on('session:replaced', () => {
      socket.io.opts.reconnection = false;
      go('replaced');
    });
    socket.on('room:state', (room) => {
      const prev = app.get().room;
      app.set({ room });
      const screen = app.get().screen;
      if ((room.phase === 'countdown' || room.phase === 'playing') && screen !== 'game') {
        const me = room.members.find((m) => m.id === app.get().playerId);
        if (me?.inMatch || matchStore.get().start) go('game');
      }
      if (room.phase === 'lobby' && prev?.phase === 'results' && screen === 'results') {
        // Someone asked for a rematch: everyone returns to the lobby.
        go('lobby');
      }
    });
    socket.on('room:closed', () => {
      app.set({ room: null });
      if (['lobby', 'game', 'results'].includes(app.get().screen)) {
        toast('The room was closed.', 'warn');
        go('home');
      }
    });
    socket.on('queue:state', (q) => {
      app.set({ queue: q });
    });
    socket.on('match:start', (m) => {
      matchStore.set({ start: m, players: {}, self: null, selfVersion: 0 });
      app.set({ results: null });
      go('game');
    });
    socket.on('match:player', (p) => {
      const cur = matchStore.get().players[p.id];
      if (cur && cur.version > p.version) return;
      matchStore.set((s) => ({ players: { ...s.players, [p.id]: p } }));
    });
    socket.on('match:self', (u) => {
      matchStore.set((s) => ({ self: u.state, selfVersion: s.selfVersion + 1 }));
      for (const l of this.selfListeners) l(u);
    });
    socket.on('match:end', (r) => {
      app.set({ results: r });
    });
    socket.on('notice', (n) => toast(n.message, 'info'));

    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = setInterval(() => {
      if (socket.connected) void this.syncClock(3);
    }, 15_000);
  }

  /** Reconnect after the session was taken over by another tab. */
  reclaim(): void {
    if (!this.socket) return this.connect();
    this.socket.io.opts.reconnection = true;
    this.socket.connect();
  }

  /** NTP-style offset estimate using the lowest-latency sample. */
  async syncClock(samples = 5): Promise<void> {
    let best: { rtt: number; offset: number } | null = null;
    for (let i = 0; i < samples; i++) {
      const t0 = Date.now();
      const r = await this.request('time:ping', { t: t0 }, 3000).catch(() => null);
      const t1 = Date.now();
      if (!r) continue;
      const rtt = t1 - t0;
      const offset = r.server - (t0 + rtt / 2);
      if (!best || rtt < best.rtt) best = { rtt, offset };
      await new Promise((res) => setTimeout(res, 60));
    }
    if (best) {
      this.offset = best.offset;
      this.rtt = best.rtt;
    }
  }

  request<E extends keyof ClientToServer>(
    event: E,
    payload: PayloadOf<E>,
    timeoutMs = 6000,
  ): Promise<AckOf<E>> {
    return new Promise((resolve, reject) => {
      const s = this.socket;
      if (!s || !s.connected) {
        reject(new Error('offline'));
        return;
      }
      const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      (s.emit as (e: string, p: unknown, cb: (r: unknown) => void) => void)(event, payload, (r) => {
        clearTimeout(timer);
        resolve(r as never);
      });
    });
  }

  /** Re-fetch match state after a reconnect or when opening the game screen. */
  async resync(): Promise<void> {
    const r = await this.request('game:sync', {}).catch(() => null);
    if (!r || !r.ok || !r.sync) return;
    const sync = r.sync;
    const players = Object.fromEntries(sync.players.map((p) => [p.id, p]));
    matchStore.set((s) => ({
      start: sync.start,
      players,
      self: sync.self,
      selfVersion: s.selfVersion + 1,
    }));
    if (sync.self) for (const l of this.selfListeners) l({ state: sync.self, events: [] });
    if (sync.outcome) app.set({ results: sync.outcome });
  }

  emitPlace(seq: number, slot: number, col: number, row: number): void {
    this.socket?.emit('game:place', { seq, slot, col, row });
  }

  emitSwap(seq: number, slot: number): void {
    this.socket?.emit('game:swap', { seq, slot });
  }
}

export const net = new Net();

/** Turn a failed request into user-facing copy. */
export function describeError(e: unknown): string {
  if (e && typeof e === 'object' && 'error' in e) {
    const code = (e as { error: ErrorCode }).error;
    return ERROR_TEXT[code] ?? ERROR_TEXT['server-error'];
  }
  if (e instanceof Error && (e.message === 'timeout' || e.message === 'offline')) return ERROR_TEXT[e.message];
  return ERROR_TEXT['server-error'];
}

/* ---------- High-level actions used by screens ---------- */

export async function createRoom(): Promise<string | null> {
  try {
    const r = await net.request('room:create', { nickname: ensureNickname() });
    if (!r.ok) return describeError(r);
    matchStore.set({ start: null, players: {}, self: null });
    app.set({ room: r.room, results: null });
    go('lobby');
    return null;
  } catch (e) {
    return describeError(e);
  }
}

export async function joinRoom(code: string): Promise<string | null> {
  try {
    const r = await net.request('room:join', { code, nickname: ensureNickname() });
    if (!r.ok) return describeError(r);
    matchStore.set({ start: null, players: {}, self: null });
    app.set({ room: r.room, results: null, pendingCode: '' });
    go(r.room.phase === 'playing' || r.room.phase === 'countdown' ? 'game' : 'lobby');
    if (r.room.phase !== 'lobby') void net.resync();
    return null;
  } catch (e) {
    return describeError(e);
  }
}

export async function leaveRoom(): Promise<void> {
  await net.request('room:leave', {}).catch(() => null);
  app.set({ room: null, results: null });
  matchStore.set({ start: null, players: {}, self: null });
  go('home');
}

export async function startQuickPlay(): Promise<string | null> {
  try {
    app.set({ queue: { status: 'searching', waiting: 1, fillEndsAt: null, searchEndsAt: null } });
    go('quickplay');
    const r = await net.request('queue:join', { nickname: ensureNickname() });
    if (!r.ok) return describeError(r);
    app.set({ queue: r.queue, room: null });
    return null;
  } catch (e) {
    app.set({ queue: null });
    return describeError(e);
  }
}

export async function cancelQuickPlay(): Promise<void> {
  await net.request('queue:leave', {}).catch(() => null);
  app.set({ queue: null });
  go('home');
}
