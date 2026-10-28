/**
 * Wire protocol shared by server and clients.
 *
 * Clients only ever send intents (which slot, which cell). They never send
 * scores, boards or outcomes; the server computes all of those.
 */
import type { EliminationReason, MatchOutcome, OutcomeReason, SurgeWindow } from '@pulse/engine';

export const PROTOCOL_VERSION = 1;

/** Room codes avoid easily confused characters (0/O, 1/I/L). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;
export const NICKNAME_MAX = 16;

export type RoomPhase = 'lobby' | 'countdown' | 'playing' | 'results';

export interface MemberView {
  id: string;
  nickname: string;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
  seat: number;
  /** True for members who are part of the current or most recent match. */
  inMatch: boolean;
}

export interface RoomView {
  code: string;
  phase: RoomPhase;
  quickPlay: boolean;
  hostId: string;
  members: MemberView[];
  durationSec: number;
  maxPlayers: number;
  minPlayers: number;
  matchId: string | null;
}

export interface MatchPlayerInfo {
  id: string;
  nickname: string;
  seat: number;
}

export interface MatchStartPayload {
  matchId: string;
  /** Server epoch ms when play begins (after the countdown). */
  startAt: number;
  durationMs: number;
  surges: SurgeWindow[];
  players: MatchPlayerInfo[];
}

/** What the last action on a board looked like, for opponent presentation. */
export interface ActivitySummary {
  kind: 'place' | 'clear' | 'swap' | 'static' | 'eliminated';
  /** Lines cleared by this action (clear only). */
  lines?: number;
  points?: number;
  chain?: number;
  surge?: boolean;
  /** Cells written by the action, for placement highlights. */
  cells?: number[];
  rows?: number[];
  cols?: number[];
  at: number;
}

/** Board and stats visible to every member of the room. */
export interface PublicPlayerState {
  id: string;
  board: string;
  score: number;
  lines: number;
  chain: number;
  bestChain: number;
  pulse: number;
  cycle: number;
  alive: boolean;
  connected: boolean;
  danger: 0 | 1 | 2;
  rank: number;
  eliminatedAt: number | null;
  eliminationReason: EliminationReason | null;
  activity: ActivitySummary | null;
  /** Monotonic version so clients can drop stale updates. */
  version: number;
}

/** Private state for the owning player, including the offered pieces. */
export interface SelfState {
  board: string;
  tray: (string | null)[];
  cycle: number;
  placedThisCycle: number;
  swapsThisCycle: number;
  score: number;
  lines: number;
  chain: number;
  misses: number;
  pulse: number;
  alive: boolean;
  lastChanceUntil: number | null;
  /** Elapsed ms when the next Static cell drops if the player stays idle. */
  nextStaticAt: number;
  /** Highest client sequence number the server has processed. */
  ackSeq: number;
}

export interface SelfUpdate {
  state: SelfState;
  /** Engine events produced by the acknowledged action or tick, for local effects. */
  events: SelfEventSummary[];
  /** Present when a client intent was rejected. */
  rejected?: { seq: number; error: string };
}

export type SelfEventSummary =
  | { kind: 'place'; piece: string; col: number; row: number; rows: number[]; cols: number[]; points: number; multiplier: number; chain: number; surge: boolean; pulseGain: number; sweep: boolean; cross: boolean; cycleAdvanced: boolean; discarded: string | null }
  | { kind: 'swap'; slot: number; from: string; to: string }
  | { kind: 'static'; cell: number }
  | { kind: 'eliminated'; reason: EliminationReason };

export interface MatchSyncPayload {
  start: MatchStartPayload;
  players: PublicPlayerState[];
  self: SelfState | null;
  outcome: MatchResults | null;
}

export interface ResultRow {
  id: string;
  nickname: string;
  rank: number;
  score: number;
  lines: number;
  bestChain: number;
  alive: boolean;
  eliminatedAt: number | null;
  eliminationReason: EliminationReason | null;
}

export interface MatchResults {
  matchId: string;
  reason: OutcomeReason;
  winnerId: string;
  endedAt: number;
  durationMs: number;
  rows: ResultRow[];
}

export interface QueueState {
  status: 'idle' | 'searching' | 'filling' | 'matched' | 'timeout';
  /** Real number of players currently waiting in the queue, including you. */
  waiting: number;
  /** Server epoch ms when the fill window closes, if one is open. */
  fillEndsAt: number | null;
  /** Server epoch ms when the search gives up. */
  searchEndsAt: number | null;
  roomCode?: string;
}

export interface SessionInfo {
  playerId: string;
  token: string;
}

export type ErrorCode =
  | 'room-not-found'
  | 'room-full'
  | 'room-in-progress'
  | 'invalid-code'
  | 'invalid-nickname'
  | 'not-host'
  | 'not-enough-players'
  | 'not-in-room'
  | 'already-in-room'
  | 'rate-limited'
  | 'bad-request'
  | 'server-error'
  | 'version-mismatch';

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: ErrorCode; message?: string };

/** Client to server events. */
export interface ClientToServer {
  'time:ping': (payload: { t: number }, ack: (r: { t: number; server: number }) => void) => void;
  'profile:set': (payload: { nickname: string }, ack: (r: Ack<{ nickname: string }>) => void) => void;
  'room:create': (payload: { nickname: string }, ack: (r: Ack<{ room: RoomView }>) => void) => void;
  'room:join': (payload: { code: string; nickname: string }, ack: (r: Ack<{ room: RoomView }>) => void) => void;
  'room:leave': (payload: object, ack: (r: Ack) => void) => void;
  'room:ready': (payload: { ready: boolean }, ack: (r: Ack) => void) => void;
  'room:settings': (payload: { durationSec: number }, ack: (r: Ack) => void) => void;
  'room:start': (payload: object, ack: (r: Ack) => void) => void;
  'room:rematch': (payload: object, ack: (r: Ack) => void) => void;
  'queue:join': (payload: { nickname: string }, ack: (r: Ack<{ queue: QueueState }>) => void) => void;
  'queue:leave': (payload: object, ack: (r: Ack) => void) => void;
  'game:place': (payload: { seq: number; slot: number; col: number; row: number }) => void;
  'game:swap': (payload: { seq: number; slot: number }) => void;
  'game:sync': (payload: object, ack: (r: Ack<{ sync: MatchSyncPayload | null }>) => void) => void;
}

/** Server to client events. */
export interface ServerToClient {
  session: (info: SessionInfo & { protocol: number }) => void;
  'session:replaced': () => void;
  'room:state': (room: RoomView) => void;
  'room:closed': (payload: { reason: 'left' | 'expired' }) => void;
  'queue:state': (q: QueueState) => void;
  'match:start': (m: MatchStartPayload) => void;
  'match:player': (p: PublicPlayerState) => void;
  'match:self': (u: SelfUpdate) => void;
  'match:end': (r: MatchResults) => void;
  notice: (n: { code: string; message: string }) => void;
}

export interface SocketAuth {
  token?: string;
  protocol?: number;
}

/* ---------- Input validation helpers (used by the server) ---------- */

export function isInt(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

export function normalizeCode(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const code = v.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== ROOM_CODE_LENGTH) return null;
  for (const ch of code) if (!ROOM_CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/**
 * Trim, collapse whitespace and strip control or unusual characters.
 * Returns null when nothing usable remains.
 */
export function sanitizeNickname(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const cleaned = v
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N} _.\-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NICKNAME_MAX)
    .trim();
  return cleaned.length >= 1 ? cleaned : null;
}

export type { EliminationReason, MatchOutcome, OutcomeReason, SurgeWindow };
