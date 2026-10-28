import type { MatchResults, MatchStartPayload, PublicPlayerState, QueueState, RoomView, SelfState } from '@pulse/protocol';
import { createStore } from './store';

export type Screen =
  | 'loading'
  | 'home'
  | 'quickplay'
  | 'create'
  | 'join'
  | 'lobby'
  | 'game'
  | 'results'
  | 'tutorial'
  | 'practice'
  | 'unreachable'
  | 'replaced';

export type ConnState = 'connecting' | 'online' | 'reconnecting' | 'offline';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'warn' | 'bad';
}

export interface AppState {
  screen: Screen;
  settingsOpen: boolean;
  conn: ConnState;
  playerId: string | null;
  room: RoomView | null;
  queue: QueueState | null;
  results: MatchResults | null;
  /** Room code from a deep link or the join form. */
  pendingCode: string;
  toasts: Toast[];
}

export const app = createStore<AppState>({
  screen: 'loading',
  settingsOpen: false,
  conn: 'connecting',
  playerId: null,
  room: null,
  queue: null,
  results: null,
  pendingCode: '',
  toasts: [],
});

/** Live match data, kept separate so frequent updates do not re-render menus. */
export interface MatchStoreState {
  start: MatchStartPayload | null;
  players: Record<string, PublicPlayerState>;
  self: SelfState | null;
  /** Bumped whenever the server sends a self update. */
  selfVersion: number;
}

export const matchStore = createStore<MatchStoreState>({ start: null, players: {}, self: null, selfVersion: 0 });

let toastId = 0;
export function toast(text: string, tone: Toast['tone'] = 'info', ms = 2600): void {
  const id = ++toastId;
  app.set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }));
  setTimeout(() => app.set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ms);
}

export function go(screen: Screen): void {
  app.set({ screen });
}
