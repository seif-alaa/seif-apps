import { io as connectClient, type Socket } from 'socket.io-client';
import { chooseMove, decodeBoard, type PlayerState, createPlayerState } from '@pulse/engine';
import type {
  AckOf,
  PayloadOf,
  ClientToServer,
  MatchResults,
  MatchStartPayload,
  PublicPlayerState,
  QueueState,
  RoomView,
  SelfState,
  SelfUpdate,
  ServerToClient,
} from '@pulse/protocol';
import { loadConfig, type ServerConfig } from '../src/config.js';
import { createLogger } from '../src/log.js';
import { MemoryPersistence } from '../src/persistence.js';
import { createGameServer, type GameServer } from '../src/server.js';

export type TestSocket = Socket<ServerToClient, ClientToServer>;

export async function startServer(overrides: Partial<ServerConfig> = {}): Promise<{ server: GameServer; url: string }> {
  const config: ServerConfig = {
    ...loadConfig({ NODE_ENV: 'test' }),
    countdownMs: 150,
    tickMs: 20,
    defaultDurationSec: 4,
    quickPlayFillMs: 300,
    quickPlayTimeoutMs: 800,
    reconnectWindowMs: 600,
    lobbyGraceMs: 400,
    ...overrides,
  };
  const server = createGameServer(config, { log: createLogger(false), persistence: new MemoryPersistence() });
  const port = await server.listen(0);
  return { server, url: `http://127.0.0.1:${port}` };
}

/** A real Socket.IO client that records everything the server sends it. */
export class TestClient {
  socket: TestSocket;
  playerId = '';
  token = '';
  room: RoomView | null = null;
  start: MatchStartPayload | null = null;
  self: SelfState | null = null;
  selfUpdates: SelfUpdate[] = [];
  players = new Map<string, PublicPlayerState>();
  results: MatchResults | null = null;
  queue: QueueState | null = null;
  replaced = false;
  private seq = 0;
  private ready: Promise<void>;

  constructor(url: string, token?: string) {
    this.socket = connectClient(url, { transports: ['websocket'], auth: { token, protocol: 1 }, forceNew: true, reconnection: false });
    this.ready = new Promise((resolve, reject) => {
      this.socket.once('session', (s) => {
        this.playerId = s.playerId;
        this.token = s.token;
        resolve();
      });
      this.socket.once('connect_error', reject);
    });
    this.socket.on('room:state', (r) => (this.room = r));
    this.socket.on('match:start', (m) => {
      this.start = m;
      this.results = null;
      this.players.clear();
      this.selfUpdates = [];
    });
    this.socket.on('match:self', (u) => {
      this.self = u.state;
      this.selfUpdates.push(u);
    });
    this.socket.on('match:player', (p) => {
      const prev = this.players.get(p.id);
      if (!prev || prev.version <= p.version) this.players.set(p.id, p);
    });
    this.socket.on('match:end', (r) => (this.results = r));
    this.socket.on('queue:state', (q) => (this.queue = q));
    this.socket.on('session:replaced', () => (this.replaced = true));
  }

  connected(): Promise<void> {
    return this.ready;
  }

  request<E extends keyof ClientToServer>(event: E, payload: PayloadOf<E>): Promise<AckOf<E>> {
    return new Promise((resolve) => {
      (this.socket.emit as (e: string, p: unknown, cb: (r: unknown) => void) => void)(event, payload, (r) => resolve(r as never));
    });
  }

  nextSeq(): number {
    return ++this.seq;
  }

  setSeq(n: number) {
    this.seq = n;
  }

  /** Local engine view of our own state, for choosing legal moves. */
  engineState(): PlayerState {
    const s = createPlayerState(0);
    s.board = decodeBoard(this.self!.board);
    s.tray = this.self!.tray.slice();
    return s;
  }

  /** Send the best legal move. Returns false when no move exists. */
  playMove(): boolean {
    if (!this.self?.alive) return false;
    const mv = chooseMove(this.engineState());
    if (!mv) return false;
    this.socket.emit('game:place', { seq: this.nextSeq(), slot: mv.slot, col: mv.col, row: mv.row });
    return true;
  }

  close() {
    this.socket.disconnect();
  }
}

export async function client(url: string, token?: string): Promise<TestClient> {
  const c = new TestClient(url, token);
  await c.connected();
  return c;
}

export async function until(cond: () => boolean, timeout = 5000, label = 'condition'): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > timeout) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
