import { randomInt } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { Server } from 'socket.io';
import {
  PROTOCOL_VERSION,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type Ack,
  type ErrorCode,
  normalizeCode,
  sanitizeNickname,
} from '@pulse/protocol';
import type { ServerConfig } from './config.js';
import { Identity } from './identity.js';
import { type Logger, createLogger } from './log.js';
import { Matchmaker } from './matchmaker.js';
import { type Persistence, createPersistence } from './persistence.js';
import { TokenBucket } from './rateLimit.js';
import { Room } from './room.js';
import type { GameIO, GameSocket } from './types.js';

interface Session {
  playerId: string;
  socketId: string | null;
  nickname: string;
  roomCode: string | null;
}

export interface GameServer {
  http: HttpServer;
  io: GameIO;
  rooms: Map<string, Room>;
  matchmaker: Matchmaker;
  persistence: Persistence;
  listen(port?: number): Promise<number>;
  close(): Promise<void>;
}

export interface GameServerOptions {
  log?: Logger;
  now?: () => number;
  persistence?: Persistence;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export function createGameServer(config: ServerConfig, options: GameServerOptions = {}): GameServer {
  const log = options.log ?? createLogger();
  const now = options.now ?? Date.now;
  const persistence = options.persistence ?? createPersistence(config.databaseUrl);
  const identity = new Identity(config.sessionSecret);
  const rooms = new Map<string, Room>();
  const sessions = new Map<string, Session>();
  const socketsPerIp = new Map<string, number>();

  const http = createServer((req, res) => handleHttp(req, res));
  const io: GameIO = new Server(http, {
    cors: { origin: config.corsOrigins === '*' ? true : config.corsOrigins, credentials: false },
    pingInterval: 10_000,
    pingTimeout: 8_000,
    maxHttpBufferSize: 16 * 1024,
    serveClient: false,
  });

  const deps = { io, config, persistence, log, now };

  function newRoomCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      if (!rooms.has(code)) return code;
    }
  }

  const matchmaker = new Matchmaker({
    io,
    config,
    now,
    formMatch(players) {
      const room = new Room(newRoomCode(), true, deps);
      rooms.set(room.code, room);
      for (const p of players) {
        const session = sessions.get(p.playerId);
        if (session) session.roomCode = room.code;
        room.add(p.playerId, p.nickname, p.socketId);
      }
      room.start(null);
      return room.code;
    },
  });

  /* ---------------- HTTP ---------------- */

  const staticRoot = config.staticDir ? resolve(config.staticDir) : null;
  const hasStatic = staticRoot !== null && existsSync(join(staticRoot, 'index.html'));

  function handleHttp(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', 'http://local');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (url.pathname === '/api/stats') {
      // Real counts only. Clients show these as-is.
      let playing = 0;
      for (const r of rooms.values()) if (r.phase === 'playing' || r.phase === 'countdown') playing++;
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ online: io.engine.clientsCount, rooms: rooms.size, matchesInProgress: playing, searching: matchmaker.size }));
      return;
    }
    if (!hasStatic || !staticRoot) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const safePath = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(staticRoot, safePath);
    if (!file.startsWith(staticRoot)) {
      res.writeHead(400);
      res.end();
      return;
    }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(staticRoot, 'index.html');
    // Universal-link association files have no extension but must be served as JSON.
    const type = file.endsWith('apple-app-site-association') ? 'application/json' : (MIME[extname(file)] ?? 'application/octet-stream');
    const immutable = file.includes(`${join(staticRoot, 'assets')}`);
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    createReadStream(file).pipe(res);
  }

  /* ---------------- Sockets ---------------- */

  io.use((socket, next) => {
    const forwarded = config.trustProxy ? String(socket.handshake.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim() : '';
    const ip = forwarded || socket.handshake.address;
    const count = socketsPerIp.get(ip) ?? 0;
    if (count >= config.maxSocketsPerIp) return next(new Error('too-many-connections'));
    const auth = (socket.handshake.auth ?? {}) as { token?: unknown; protocol?: unknown };
    if (auth.protocol !== undefined && auth.protocol !== PROTOCOL_VERSION) return next(new Error('version-mismatch'));
    socket.data.ip = ip;
    const existing = identity.verify(auth.token);
    socket.data.playerId = existing ?? '';
    next();
  });

  io.on('connection', (socket: GameSocket) => {
    const ip = socket.data.ip;
    socketsPerIp.set(ip, (socketsPerIp.get(ip) ?? 0) + 1);

    let token: string;
    if (socket.data.playerId) {
      token = (socket.handshake.auth as { token: string }).token;
    } else {
      const issued = identity.issue();
      socket.data.playerId = issued.playerId;
      token = issued.token;
    }
    const playerId = socket.data.playerId;

    let session = sessions.get(playerId);
    if (session?.socketId && session.socketId !== socket.id) {
      // Same player connected elsewhere: the newest connection wins.
      const old = io.sockets.sockets.get(session.socketId);
      session.socketId = socket.id;
      if (old) {
        old.emit('session:replaced');
        old.disconnect(true);
      }
    }
    if (!session) {
      session = { playerId, socketId: socket.id, nickname: 'Player', roomCode: null };
      sessions.set(playerId, session);
    }
    session.socketId = socket.id;
    socket.emit('session', { playerId, token, protocol: PROTOCOL_VERSION });

    // Restore room membership after a reconnect.
    if (session.roomCode) {
      const room = rooms.get(session.roomCode);
      if (room?.members.has(playerId)) room.add(playerId, session.nickname, socket.id);
      else session.roomCode = null;
    }

    const bucket = new TokenBucket(40, 20, now);

    /** Wrap a handler with rate limiting, validation of the ack and error isolation. */
    function on<A extends unknown[]>(event: string, handler: (...args: A) => void): void {
      (socket as unknown as { on: (e: string, h: (...a: unknown[]) => void) => void }).on(event, (...args: unknown[]) => {
        const ack = typeof args[args.length - 1] === 'function' ? (args[args.length - 1] as (r: unknown) => void) : null;
        if (!bucket.take()) {
          ack?.({ ok: false, error: 'rate-limited' });
          if (bucket.violations > 200) {
            log.warn('socket.rate_limit_disconnect', { player: playerId });
            socket.disconnect(true);
          }
          return;
        }
        try {
          const payload = args[0] !== null && typeof args[0] === 'object' ? args[0] : {};
          handler(...([payload, ack ?? (() => undefined)] as unknown as A));
        } catch (err) {
          log.error('handler.failed', { event, err: String(err), stack: (err as Error).stack });
          ack?.({ ok: false, error: 'server-error' });
        }
      });
    }

    const fail = (ack: (r: { ok: false; error: ErrorCode }) => void, error: ErrorCode) => ack({ ok: false, error });
    const currentRoom = () => (session!.roomCode ? rooms.get(session!.roomCode) ?? null : null);
    const leaveCurrent = () => {
      const room = currentRoom();
      if (room) {
        room.remove(playerId, 'left');
        if (room.members.size === 0) rooms.delete(room.code);
      }
      session!.roomCode = null;
    };

    on('time:ping', (p: { t?: unknown }, ack: (r: { t: number; server: number }) => void) => {
      ack({ t: typeof p.t === 'number' ? p.t : 0, server: now() });
    });

    on('profile:set', (p: { nickname?: unknown }, ack: (r: Ack<{ nickname: string }>) => void) => {
      const nickname = sanitizeNickname(p.nickname);
      if (!nickname) return fail(ack, 'invalid-nickname');
      session!.nickname = nickname;
      const room = currentRoom();
      const member = room?.members.get(playerId);
      if (room && member && room.phase !== 'playing' && room.phase !== 'countdown') {
        member.nickname = nickname;
        room.broadcastState();
      }
      ack({ ok: true, nickname });
    });

    on('room:create', (p: { nickname?: unknown }, ack: (r: Ack<{ room: ReturnType<Room['view']> }>) => void) => {
      const nickname = sanitizeNickname(p.nickname);
      if (!nickname) return fail(ack, 'invalid-nickname');
      matchmaker.leave(playerId);
      leaveCurrent();
      session!.nickname = nickname;
      const room = new Room(newRoomCode(), false, deps);
      rooms.set(room.code, room);
      room.add(playerId, nickname, socket.id);
      session!.roomCode = room.code;
      log.info('room.created', { room: room.code, player: playerId });
      ack({ ok: true, room: room.view() });
    });

    on('room:join', (p: { code?: unknown; nickname?: unknown }, ack: (r: Ack<{ room: ReturnType<Room['view']> }>) => void) => {
      const code = normalizeCode(p.code);
      if (!code) return fail(ack, 'invalid-code');
      const nickname = sanitizeNickname(p.nickname);
      if (!nickname) return fail(ack, 'invalid-nickname');
      const room = rooms.get(code);
      if (!room) return fail(ack, 'room-not-found');
      if (session!.roomCode !== code) {
        matchmaker.leave(playerId);
        leaveCurrent();
      }
      session!.nickname = nickname;
      const r = room.add(playerId, nickname, socket.id);
      if (!r.ok) return fail(ack, r.error);
      session!.roomCode = code;
      ack({ ok: true, room: room.view() });
    });

    on('room:leave', (_p: object, ack: (r: Ack) => void) => {
      leaveCurrent();
      ack({ ok: true });
    });

    on('room:ready', (p: { ready?: unknown }, ack: (r: Ack) => void) => {
      const room = currentRoom();
      if (!room) return fail(ack, 'not-in-room');
      const r = room.setReady(playerId, p.ready === true);
      ack(r.ok ? { ok: true } : r);
    });

    on('room:settings', (p: { durationSec?: unknown }, ack: (r: Ack) => void) => {
      const room = currentRoom();
      if (!room) return fail(ack, 'not-in-room');
      const r = room.setDuration(playerId, Number(p.durationSec));
      ack(r.ok ? { ok: true } : r);
    });

    on('room:start', (_p: object, ack: (r: Ack) => void) => {
      const room = currentRoom();
      if (!room) return fail(ack, 'not-in-room');
      const r = room.start(playerId);
      ack(r.ok ? { ok: true } : r);
    });

    on('room:rematch', (_p: object, ack: (r: Ack) => void) => {
      const room = currentRoom();
      if (!room) return fail(ack, 'not-in-room');
      const r = room.rematch(playerId);
      ack(r.ok ? { ok: true } : r);
    });

    on('queue:join', (p: { nickname?: unknown }, ack: (r: Ack<{ queue: ReturnType<Matchmaker['join']> }>) => void) => {
      const nickname = sanitizeNickname(p.nickname);
      if (!nickname) return fail(ack, 'invalid-nickname');
      leaveCurrent();
      session!.nickname = nickname;
      ack({ ok: true, queue: matchmaker.join(playerId, nickname, socket.id) });
    });

    on('queue:leave', (_p: object, ack: (r: Ack) => void) => {
      matchmaker.leave(playerId);
      ack({ ok: true });
    });

    on('game:place', (p: { seq?: unknown; slot?: unknown; col?: unknown; row?: unknown }) => {
      currentRoom()?.place(playerId, p);
    });

    on('game:swap', (p: { seq?: unknown; slot?: unknown }) => {
      currentRoom()?.swap(playerId, p);
    });

    on('game:sync', (_p: object, ack: (r: Ack<{ sync: ReturnType<Room['syncPayload']> }>) => void) => {
      const room = currentRoom();
      ack({ ok: true, sync: room ? room.syncPayload(playerId) : null });
    });

    socket.on('disconnect', () => {
      const n = (socketsPerIp.get(ip) ?? 1) - 1;
      if (n <= 0) socketsPerIp.delete(ip);
      else socketsPerIp.set(ip, n);
      if (session!.socketId !== socket.id) return; // replaced by a newer connection
      session!.socketId = null;
      matchmaker.leave(playerId);
      currentRoom()?.handleDisconnect(playerId, socket.id);
    });
  });

  /* ---------------- Timers ---------------- */

  const timer = setInterval(() => {
    for (const room of [...rooms.values()]) {
      let keep = true;
      try {
        keep = room.tick();
      } catch (err) {
        log.error('room.tick_failed', { room: room.code, err: String(err), stack: (err as Error).stack });
      }
      if (!keep) {
        io.to(room.channel).emit('room:closed', { reason: 'expired' });
        for (const id of room.members.keys()) {
          const s = sessions.get(id);
          if (s?.roomCode === room.code) s.roomCode = null;
        }
        io.in(room.channel).socketsLeave(room.channel);
        rooms.delete(room.code);
        log.info('room.deleted', { room: room.code });
      }
    }
    matchmaker.tick();
    // Forget sessions that are fully idle so memory stays bounded.
    for (const [id, s] of sessions) if (!s.socketId && !s.roomCode) sessions.delete(id);
  }, config.tickMs);

  return {
    http,
    io,
    rooms,
    matchmaker,
    persistence,
    listen(port = config.port) {
      return new Promise((resolveListen) => {
        http.listen(port, () => {
          const addr = http.address();
          resolveListen(typeof addr === 'object' && addr ? addr.port : port);
        });
      });
    },
    async close() {
      clearInterval(timer);
      io.close();
      await new Promise<void>((r) => http.close(() => r()));
      await persistence.close();
    },
  };
}
