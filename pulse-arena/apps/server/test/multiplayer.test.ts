import { afterEach, describe, expect, it } from 'vitest';
import { decodeBoard, emptyBoard, idx } from '@pulse/engine';
import type { GameServer } from '../src/server.js';
import { TestClient, client, sleep, startServer, until } from './helpers.js';

let server: GameServer | null = null;
const clients: TestClient[] = [];

async function setup(overrides = {}) {
  const s = await startServer(overrides);
  server = s.server;
  return s.url;
}

async function mk(url: string, token?: string) {
  const c = await client(url, token);
  clients.push(c);
  return c;
}

afterEach(async () => {
  for (const c of clients.splice(0)) c.close();
  await server?.close();
  server = null;
});

/** Create a room with `n` members (first is host). All non-hosts are ready. */
async function roomWith(url: string, n: number) {
  const host = await mk(url);
  const created = await host.request('room:create', { nickname: 'Host' });
  if (!created.ok) throw new Error(created.error);
  const code = created.room.code;
  const others: TestClient[] = [];
  for (let i = 1; i < n; i++) {
    const c = await mk(url);
    const r = await c.request('room:join', { code, nickname: `P${i}` });
    if (!r.ok) throw new Error(r.error);
    await c.request('room:ready', { ready: true });
    others.push(c);
  }
  return { host, others, code, all: [host, ...others] };
}

async function startMatch(all: TestClient[]) {
  const r = await all[0]!.request('room:start', {});
  expect(r.ok).toBe(true);
  await until(() => all.every((c) => c.start !== null && c.self !== null), 3000, 'match start');
  await until(() => all.every((c) => c.room?.phase === 'playing'), 3000, 'playing phase');
}

describe('rooms', () => {
  it('creates a room with a short shareable code and lets a friend join', async () => {
    const url = await setup();
    const { host, others, code } = await roomWith(url, 2);
    expect(code).toMatch(/^[A-HJ-KM-NP-Z2-9]{5}$/);
    await until(() => host.room?.members.length === 2);
    expect(host.room!.members.map((m) => m.nickname)).toEqual(['Host', 'P1']);
    expect(host.room!.hostId).toBe(host.playerId);
    expect(others[0]!.room!.members[1]!.ready).toBe(true);
  });

  it('rejects malformed and unknown room codes', async () => {
    const url = await setup();
    const c = await mk(url);
    expect(await c.request('room:join', { code: '12', nickname: 'A' })).toEqual({ ok: false, error: 'invalid-code' });
    expect(await c.request('room:join', { code: 'OOOOO', nickname: 'A' })).toEqual({ ok: false, error: 'invalid-code' });
    expect(await c.request('room:join', { code: 'ZZZZZ', nickname: 'A' })).toEqual({ ok: false, error: 'room-not-found' });
    expect(await c.request('room:join', { code: 'ZZZZZ', nickname: '   ' })).toEqual({ ok: false, error: 'invalid-nickname' });
  });

  it('accepts five players and rejects a sixth', async () => {
    const url = await setup();
    const { code, host } = await roomWith(url, 5);
    await until(() => host.room?.members.length === 5);
    const sixth = await mk(url);
    expect(await sixth.request('room:join', { code, nickname: 'Six' })).toEqual({ ok: false, error: 'room-full' });
  });

  it('only lets the host start, and only with two players', async () => {
    const url = await setup();
    const host = await mk(url);
    const created = await host.request('room:create', { nickname: 'Host' });
    if (!created.ok) throw new Error();
    expect(await host.request('room:start', {})).toEqual({ ok: false, error: 'not-enough-players' });
    const guest = await mk(url);
    await guest.request('room:join', { code: created.room.code, nickname: 'Guest' });
    expect(await guest.request('room:start', {})).toEqual({ ok: false, error: 'not-host' });
    // Guest is not ready yet, so only the host would play.
    expect(await host.request('room:start', {})).toEqual({ ok: false, error: 'not-enough-players' });
    await guest.request('room:ready', { ready: true });
    expect(await host.request('room:start', {})).toEqual({ ok: true });
  });

  it('refuses joins while a match is running', async () => {
    const url = await setup();
    const { all, code } = await roomWith(url, 2);
    await startMatch(all);
    const late = await mk(url);
    expect(await late.request('room:join', { code, nickname: 'Late' })).toEqual({ ok: false, error: 'room-in-progress' });
  });

  it('hands the host role over when the host leaves', async () => {
    const url = await setup();
    const { host, others } = await roomWith(url, 3);
    await host.request('room:leave', {});
    await until(() => others[0]!.room?.members.length === 2);
    expect(others[0]!.room!.hostId).toBe(others[0]!.playerId);
  });
});

describe('synchronized match', () => {
  it('plays a complete two-player match with live opponent boards and a correct winner', async () => {
    const url = await setup({ defaultDurationSec: 3 });
    const { all } = await roomWith(url, 2);
    await startMatch(all);
    const [a, b] = all as [TestClient, TestClient];
    expect(a.start!.matchId).toBe(b.start!.matchId);
    expect(a.start!.startAt).toBe(b.start!.startAt);

    // Both play a few moves.
    for (let i = 0; i < 4; i++) {
      const before = a.self!.ackSeq;
      a.playMove();
      await until(() => a.self!.ackSeq > before, 2000, 'ack a');
      const beforeB = b.self!.ackSeq;
      b.playMove();
      await until(() => b.self!.ackSeq > beforeB, 2000, 'ack b');
    }
    // Each sees the other's board exactly as the server holds it.
    await until(() => b.players.get(a.playerId)?.board === a.self!.board, 2000, 'b sees a');
    await until(() => a.players.get(b.playerId)?.board === b.self!.board, 2000, 'a sees b');
    expect(a.players.get(b.playerId)!.score).toBe(b.self!.score);

    await until(() => a.results !== null && b.results !== null, 6000, 'results');
    const r = a.results!;
    expect(r.reason).toBe('time');
    expect(b.results!.winnerId).toBe(r.winnerId);
    const winner = r.rows[0]!;
    expect(winner.id).toBe(r.winnerId);
    expect(winner.score).toBeGreaterThanOrEqual(r.rows[1]!.score);
    await until(() => a.room?.phase === 'results');
  });

  it('accepts simultaneous actions from different players', async () => {
    const url = await setup({ defaultDurationSec: 5 });
    const { all } = await roomWith(url, 3);
    await startMatch(all);
    for (const c of all) c.playMove();
    await until(() => all.every((c) => c.self!.ackSeq === 1), 2000, 'all acked');
    for (const c of all) expect(c.selfUpdates.some((u) => u.rejected)).toBe(false);
  });

  it('ignores forged scores and rejects impossible and duplicate placements', async () => {
    const url = await setup({ defaultDurationSec: 10 });
    const { all } = await roomWith(url, 2);
    await startMatch(all);
    const [a, b] = all as [TestClient, TestClient];

    // Forged fields are ignored entirely.
    a.socket.emit('game:place', { seq: a.nextSeq(), slot: 0, col: 0, row: 0, score: 999999, board: '1'.repeat(81) } as never);
    await until(() => a.self!.ackSeq === 1);
    expect(a.self!.score).toBeLessThan(20);
    expect(decodeBoard(a.self!.board).filter((v) => v !== 0).length).toBeLessThan(10);

    // Out of bounds.
    a.socket.emit('game:place', { seq: a.nextSeq(), slot: 1, col: 9, row: 9 });
    await until(() => a.self!.ackSeq === 2);
    expect(a.selfUpdates.at(-1)!.rejected?.error).toBe('illegal-position');

    // Replay of an already-used sequence number.
    const scoreBefore = a.self!.score;
    a.socket.emit('game:place', { seq: 1, slot: 1, col: 4, row: 4 });
    await until(() => a.selfUpdates.at(-1)!.rejected?.error === 'duplicate');
    expect(a.self!.score).toBe(scoreBefore);

    // Garbage payloads do not crash the server.
    a.socket.emit('game:place', null as never);
    a.socket.emit('game:place', { seq: 'x', slot: {}, col: [], row: NaN } as never);
    a.socket.emit('game:swap', { seq: a.nextSeq(), slot: 2 });
    await until(() => a.selfUpdates.at(-1)!.rejected?.error === 'no-pulse');
    // The other player is unaffected.
    expect(b.players.get(a.playerId)?.score).toBe(a.self!.score);
  });

  it('eliminates a player with no legal moves and ends the match when one remains', async () => {
    const url = await setup({ defaultDurationSec: 30 });
    const { all, code } = await roomWith(url, 2);
    await startMatch(all);
    const [a, b] = all as [TestClient, TestClient];
    // Arrange a nearly full board for A on the server: single isolated holes only.
    const room = server!.rooms.get(code)!;
    const st = room.match!.state.players[a.playerId]!;
    const board = new Array<number>(81).fill(4);
    for (let r = 0; r < 9; r += 2) for (let c = 0; c < 9; c += 2) board[idx(c, r)] = 0;
    for (let r = 1; r < 9; r += 2) board[idx(r, r)] = 0;
    st.board = board;
    st.tray = ['mote', 'slab4', 'rod3a'];
    st.placedThisCycle = 0;
    a.socket.emit('game:place', { seq: a.nextSeq(), slot: 0, col: 0, row: 0 });
    await until(() => a.results !== null && b.results !== null, 3000, 'results');
    expect(a.self!.alive).toBe(false);
    expect(a.results!.reason).toBe('last-standing');
    expect(a.results!.winnerId).toBe(b.playerId);
    expect(b.players.get(a.playerId)!.alive).toBe(false);
    expect(b.players.get(a.playerId)!.eliminationReason).toBe('no-moves');
  });

  it('runs a five-player match to completion with consistent results on every client', async () => {
    const url = await setup({ defaultDurationSec: 3 });
    const { all } = await roomWith(url, 5);
    await startMatch(all);
    const deadline = Date.now() + 2500;
    while (Date.now() < deadline && all.some((c) => !c.results)) {
      for (const c of all) c.playMove();
      await sleep(60);
    }
    await until(() => all.every((c) => c.results !== null), 6000, 'all results');
    const ids = all[0]!.results!.rows.map((r) => r.id);
    expect(ids).toHaveLength(5);
    for (const c of all) expect(c.results!.rows.map((r) => r.id)).toEqual(ids);
    for (const c of all) {
      expect(c.players.size).toBe(5);
      // Live ranks every client holds are a consistent permutation.
      expect(new Set([...c.players.values()].map((p) => p.rank))).toEqual(new Set([1, 2, 3, 4, 5]));
    }
    // Every board each client holds for an opponent matches the authoritative state.
    const room = [...server!.rooms.values()][0]!;
    for (const c of all) {
      for (const [id, p] of c.players) {
        expect(p.board).toBe(all.find((x) => x.playerId === id)!.self!.board);
        expect(decodeBoard(p.board)).toEqual(room.match!.state.players[id]!.board);
      }
    }
  });
});

describe('connections', () => {
  it('restores the board on reconnect within the window', async () => {
    const url = await setup({ defaultDurationSec: 20, reconnectWindowMs: 3000 });
    const { all } = await roomWith(url, 2);
    await startMatch(all);
    const [a, b] = all as [TestClient, TestClient];
    a.playMove();
    await until(() => a.self!.ackSeq === 1);
    const board = a.self!.board;
    a.close();
    await until(() => b.players.get(a.playerId)?.connected === false, 2000, 'disconnect seen');
    const back = await mk(url, a.token);
    expect(back.playerId).toBe(a.playerId);
    const sync = await back.request('game:sync', {});
    if (!sync.ok || !sync.sync) throw new Error('no sync');
    expect(sync.sync.self!.board).toBe(board);
    expect(sync.sync.self!.alive).toBe(true);
    expect(sync.sync.self!.ackSeq).toBe(1);
    await until(() => b.players.get(a.playerId)?.connected === true, 2000, 'reconnect seen');
    // Continue playing with the next sequence number.
    back.self = sync.sync.self;
    back.setSeq(1);
    back.playMove();
    await until(() => back.self!.ackSeq === 2);
  });

  it('forfeits a player who does not return within the reconnect window', async () => {
    const url = await setup({ defaultDurationSec: 20, reconnectWindowMs: 300 });
    const { all } = await roomWith(url, 2);
    await startMatch(all);
    const [a, b] = all as [TestClient, TestClient];
    a.close();
    await until(() => b.results !== null, 3000, 'results');
    expect(b.results!.winnerId).toBe(b.playerId);
    expect(b.results!.rows[1]!.eliminationReason).toBe('disconnected');
  });

  it('keeps the match running when a player leaves mid-game', async () => {
    const url = await setup({ defaultDurationSec: 20 });
    const { all } = await roomWith(url, 3);
    await startMatch(all);
    const [a, b, c] = all as [TestClient, TestClient, TestClient];
    await a.request('room:leave', {});
    await until(() => b.players.get(a.playerId)?.alive === false, 2000, 'forfeit');
    expect(b.results).toBeNull();
    b.playMove();
    c.playMove();
    await until(() => b.self!.ackSeq === 1 && c.self!.ackSeq === 1);
  });

  it('replaces a duplicate connection for the same player', async () => {
    const url = await setup();
    const first = await mk(url);
    await first.request('room:create', { nickname: 'Dup' });
    const second = await mk(url, first.token);
    expect(second.playerId).toBe(first.playerId);
    await until(() => first.replaced, 2000, 'replaced');
    await until(() => second.room !== null, 2000, 'room restored');
    expect(second.room!.members).toHaveLength(1);
  });

  it('issues a fresh identity for a forged token', async () => {
    const url = await setup();
    const real = await mk(url);
    const forged = await mk(url, `${real.playerId}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`);
    expect(forged.playerId).not.toBe(real.playerId);
  });

  it('rate limits floods without disconnecting normal play', async () => {
    const url = await setup();
    const c = await mk(url);
    const results = await Promise.all(Array.from({ length: 80 }, (_, i) => c.request('time:ping', { t: i })));
    const limited = results.filter((r: unknown) => (r as { ok?: boolean }).ok === false);
    expect(limited.length).toBeGreaterThan(0);
    expect(c.socket.connected).toBe(true);
  });
});

describe('rematch and quick play', () => {
  it('resets state for a rematch', async () => {
    const url = await setup({ defaultDurationSec: 1 });
    const { all } = await roomWith(url, 2);
    await startMatch(all);
    const [a, b] = all as [TestClient, TestClient];
    a.playMove();
    await until(() => a.results !== null && b.results !== null, 4000);
    const firstMatch = a.start!.matchId;
    expect(await b.request('room:rematch', {})).toEqual({ ok: true });
    await until(() => a.room?.phase === 'lobby');
    expect(a.room!.members.find((m) => m.id === b.playerId)!.ready).toBe(true);
    expect(await a.request('room:rematch', {})).toEqual({ ok: true });
    a.self = null;
    b.self = null;
    await startMatch(all);
    expect(a.start!.matchId).not.toBe(firstMatch);
    expect(a.self!.score).toBe(0);
    expect(a.self!.board).toBe('0'.repeat(81));
    expect(a.results).toBeNull();
    expect(emptyBoard()).toHaveLength(81);
  });

  it('matches real queued players into a room and starts the match', async () => {
    const url = await setup({ defaultDurationSec: 3 });
    const a = await mk(url);
    const b = await mk(url);
    const qa = await a.request('queue:join', { nickname: 'Ana' });
    expect(qa.ok && qa.queue.status).toBe('searching');
    await b.request('queue:join', { nickname: 'Ben' });
    await until(() => a.queue?.status === 'filling' || a.queue?.status === 'matched');
    expect(a.queue!.waiting).toBe(2);
    await until(() => a.queue?.status === 'matched' && b.queue?.status === 'matched', 3000, 'matched');
    expect(a.queue!.roomCode).toBe(b.queue!.roomCode);
    await until(() => a.start !== null && b.start !== null, 3000, 'start');
    expect(a.start!.players.map((p) => p.nickname).sort()).toEqual(['Ana', 'Ben']);
  });

  it('tells a lone player honestly that no match was found', async () => {
    const url = await setup({ quickPlayTimeoutMs: 300 });
    const a = await mk(url);
    await a.request('queue:join', { nickname: 'Solo' });
    await until(() => a.queue?.status === 'timeout', 3000, 'timeout');
    expect(a.start).toBeNull();
  });
});
