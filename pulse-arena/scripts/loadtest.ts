/**
 * Load test: starts an in-process game server, then runs many rooms of five
 * real Socket.IO clients that create/join rooms and play legal moves at a
 * human-like pace. Reports action round-trip latency and server event-loop lag.
 *
 * Usage: npx tsx scripts/loadtest.ts [rooms=20] [seconds=30]
 */
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { io, type Socket } from 'socket.io-client';
import { chooseMove, createPlayerState, decodeBoard } from '@pulse/engine';
import type { ClientToServer, SelfState, ServerToClient } from '@pulse/protocol';
import { loadConfig } from '../apps/server/src/config.js';
import { createLogger } from '../apps/server/src/log.js';
import { MemoryPersistence } from '../apps/server/src/persistence.js';
import { createGameServer } from '../apps/server/src/server.js';

const ROOMS = Number(process.argv[2] ?? 20);
const SECONDS = Number(process.argv[3] ?? 30);
const PER_ROOM = 5;

type S = Socket<ServerToClient, ClientToServer>;

const config = { ...loadConfig({ NODE_ENV: 'test' }), defaultDurationSec: SECONDS, maxSocketsPerIp: 10_000, countdownMs: 1000 };
const server = createGameServer(config, { log: createLogger(false), persistence: new MemoryPersistence() });
const port = await server.listen(0);
const url = `http://127.0.0.1:${port}`;
const lag = monitorEventLoopDelay({ resolution: 10 });
lag.enable();

const latencies: number[] = [];
let ended = 0;
let bytesIn = 0;

function connect(): Promise<S> {
  return new Promise((resolve, reject) => {
    const s: S = io(url, { transports: ['websocket'], forceNew: true, reconnection: false });
    s.once('session', () => resolve(s));
    s.once('connect_error', reject);
    s.onAny((_e, ...args) => {
      bytesIn += JSON.stringify(args).length;
    });
  });
}

function ask<T>(s: S, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => (s.emit as (e: string, p: unknown, cb: (r: T) => void) => void)(event, payload, resolve));
}

async function runRoom(i: number): Promise<void> {
  const sockets = await Promise.all(Array.from({ length: PER_ROOM }, connect));
  const created = await ask<{ ok: boolean; room: { code: string } }>(sockets[0]!, 'room:create', { nickname: `Host${i}` });
  for (const [k, s] of sockets.slice(1).entries()) {
    await ask(s, 'room:join', { code: created.room.code, nickname: `P${i}-${k}` });
    await ask(s, 'room:ready', { ready: true });
  }
  const done = Promise.all(sockets.map((s) => new Promise<void>((r) => s.once('match:end', () => r()))));
  for (const s of sockets) {
    let self: SelfState | null = null;
    let seq = 0;
    const sentAt = new Map<number, number>();
    s.on('match:self', (u) => {
      self = u.state;
      const t = sentAt.get(u.state.ackSeq);
      if (t) {
        latencies.push(performance.now() - t);
        sentAt.delete(u.state.ackSeq);
      }
    });
    const play = () => {
      const st = self as SelfState | null;
      if (st?.alive && !st.tray.every((x) => !x)) {
        const p = createPlayerState(0);
        p.board = decodeBoard(st.board);
        p.tray = st.tray.slice();
        const mv = chooseMove(p, Math.random, 60);
        if (mv) {
          seq = Math.max(seq, st.ackSeq) + 1;
          sentAt.set(seq, performance.now());
          s.emit('game:place', { seq, slot: mv.slot, col: mv.col, row: mv.row });
        }
      }
      // Human pace: one placement every 0.8 to 2.0 seconds.
      timer = setTimeout(play, 800 + Math.random() * 1200);
    };
    let timer = setTimeout(play, 1200 + Math.random() * 500);
    s.once('match:end', () => clearTimeout(timer));
  }
  await ask(sockets[0]!, 'room:start', {});
  await done;
  ended++;
  for (const s of sockets) s.disconnect();
}

const t0 = performance.now();
console.log(`Load test: ${ROOMS} rooms x ${PER_ROOM} players = ${ROOMS * PER_ROOM} concurrent clients, ${SECONDS}s matches`);
await Promise.all(Array.from({ length: ROOMS }, (_, i) => runRoom(i)));
const elapsed = (performance.now() - t0) / 1000;

latencies.sort((a, b) => a - b);
const pct = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))]?.toFixed(1);
console.log(`Matches completed: ${ended}/${ROOMS} in ${elapsed.toFixed(1)}s`);
console.log(`Placements acknowledged: ${latencies.length}`);
console.log(`Action round trip ms: p50 ${pct(0.5)}  p95 ${pct(0.95)}  p99 ${pct(0.99)}  max ${latencies.at(-1)?.toFixed(1)}`);
console.log(`Server event loop delay ms: p50 ${(lag.percentile(50) / 1e6).toFixed(1)}  p99 ${(lag.percentile(99) / 1e6).toFixed(1)}  max ${(lag.max / 1e6).toFixed(1)}`);
console.log(`Downstream per client: ${((bytesIn / (ROOMS * PER_ROOM) / elapsed) / 1024).toFixed(2)} KiB/s (payload JSON, excluding framing)`);
console.log(`Process memory: ${(process.memoryUsage().rss / 1048576).toFixed(0)} MiB RSS`);
await server.close();
process.exit(0);
