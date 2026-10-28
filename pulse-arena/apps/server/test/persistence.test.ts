import { describe, expect, it } from 'vitest';
import { MemoryPersistence, PostgresPersistence, type MatchRecord } from '../src/persistence.js';

const record = (id: string): MatchRecord => ({
  roomCode: 'ABCDE',
  quickPlay: false,
  startedAt: Date.now() - 60_000,
  results: {
    matchId: id,
    reason: 'time',
    winnerId: 'p1',
    endedAt: 60_000,
    durationMs: 60_000,
    rows: [{ id: 'p1', nickname: 'Ana', rank: 1, score: 420, lines: 9, bestChain: 3, alive: true, eliminatedAt: null, eliminationReason: null }],
  },
});

describe('persistence', () => {
  it('keeps recent matches in memory', async () => {
    const p = new MemoryPersistence(2);
    await p.recordMatch(record('a'));
    await p.recordMatch(record('b'));
    await p.recordMatch(record('c'));
    expect((await p.recentMatches(10)).map((r) => r.results.matchId)).toEqual(['c', 'b']);
  });

  // Runs only when a disposable database is provided, e.g.
  // PULSE_TEST_DATABASE_URL=postgres://postgres@localhost:5432/pulse_test npm test
  const url = process.env.PULSE_TEST_DATABASE_URL;
  it.skipIf(!url)('stores and reads matches in PostgreSQL', async () => {
    const p = new PostgresPersistence(url!);
    const id = `test-${Date.now()}`;
    await p.recordMatch(record(id));
    await p.recordMatch(record(id)); // idempotent
    const recent = await p.recentMatches(5);
    const found = recent.find((r) => r.results.matchId === id);
    expect(found?.results.rows[0]?.score).toBe(420);
    expect(found?.roomCode).toBe('ABCDE');
    await p.close();
  });
});
