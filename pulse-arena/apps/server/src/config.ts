import { randomBytes } from 'node:crypto';
import { DEFAULT_DURATION_SEC, MAX_DURATION_SEC, MIN_DURATION_SEC } from '@pulse/engine';

export interface ServerConfig {
  port: number;
  sessionSecret: string;
  corsOrigins: string[] | '*';
  databaseUrl: string | null;
  staticDir: string | null;
  defaultDurationSec: number;
  reconnectWindowMs: number;
  /** Lobby/results members who stay disconnected this long are removed. */
  lobbyGraceMs: number;
  /** Rooms with nobody connected for this long are deleted. */
  idleRoomMs: number;
  quickPlayFillMs: number;
  quickPlayTimeoutMs: number;
  /** Delay between "match:start" and the first playable moment (countdown). */
  countdownMs: number;
  tickMs: number;
  trustProxy: boolean;
  maxSocketsPerIp: number;
  production: boolean;
}

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== '' ? n : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const production = env.NODE_ENV === 'production';
  let sessionSecret = env.SESSION_SECRET ?? '';
  if (!sessionSecret) {
    if (production) throw new Error('SESSION_SECRET must be set in production.');
    // Development: an ephemeral secret. Guest sessions reset when the server restarts.
    sessionSecret = randomBytes(32).toString('hex');
  }
  const origins = (env.CORS_ORIGINS ?? '').trim();
  return {
    port: num(env.PORT, 8787),
    sessionSecret,
    corsOrigins: !origins || origins === '*' ? (production ? [] : '*') : origins.split(',').map((s) => s.trim()).filter(Boolean),
    databaseUrl: env.DATABASE_URL || null,
    staticDir: env.STATIC_DIR || null,
    defaultDurationSec: Math.min(MAX_DURATION_SEC, Math.max(MIN_DURATION_SEC, num(env.MATCH_DURATION_SEC, DEFAULT_DURATION_SEC))),
    reconnectWindowMs: num(env.RECONNECT_WINDOW_SEC, 30) * 1000,
    lobbyGraceMs: 20_000,
    idleRoomMs: 120_000,
    quickPlayFillMs: num(env.QUICKPLAY_FILL_SEC, 8) * 1000,
    quickPlayTimeoutMs: num(env.QUICKPLAY_TIMEOUT_SEC, 45) * 1000,
    countdownMs: 3_500,
    tickMs: 100,
    trustProxy: env.TRUST_PROXY === 'true',
    maxSocketsPerIp: num(env.MAX_SOCKETS_PER_IP, 24),
    production,
  };
}
