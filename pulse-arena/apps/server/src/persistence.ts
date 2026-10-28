import type { MatchResults } from '@pulse/protocol';

export interface MatchRecord {
  results: MatchResults;
  roomCode: string;
  quickPlay: boolean;
  startedAt: number;
}

/** Storage for finished matches. Gameplay never depends on it succeeding. */
export interface Persistence {
  recordMatch(record: MatchRecord): Promise<void>;
  recentMatches(limit: number): Promise<MatchRecord[]>;
  close(): Promise<void>;
}

export class MemoryPersistence implements Persistence {
  private readonly records: MatchRecord[] = [];
  constructor(private readonly keep = 200) {}

  async recordMatch(record: MatchRecord): Promise<void> {
    this.records.unshift(record);
    if (this.records.length > this.keep) this.records.length = this.keep;
  }

  async recentMatches(limit: number): Promise<MatchRecord[]> {
    return this.records.slice(0, limit);
  }

  async close(): Promise<void> {}
}

export class PostgresPersistence implements Persistence {
  private ready: Promise<void>;
  private pool: import('pg').Pool | null = null;

  constructor(url: string) {
    this.ready = this.init(url);
  }

  private async init(url: string): Promise<void> {
    const { default: pg } = await import('pg');
    this.pool = new pg.Pool({ connectionString: url, max: 5 });
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        room_code TEXT NOT NULL,
        quick_play BOOLEAN NOT NULL,
        reason TEXT NOT NULL,
        winner_id TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        duration_ms INTEGER NOT NULL,
        results JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS matches_created_at_idx ON matches (created_at DESC);
    `);
  }

  async recordMatch(r: MatchRecord): Promise<void> {
    await this.ready;
    await this.pool!.query(
      `INSERT INTO matches (id, room_code, quick_play, reason, winner_id, started_at, duration_ms, results)
       VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0), $7, $8) ON CONFLICT (id) DO NOTHING`,
      [r.results.matchId, r.roomCode, r.quickPlay, r.results.reason, r.results.winnerId, r.startedAt, r.results.durationMs, JSON.stringify(r.results)],
    );
  }

  async recentMatches(limit: number): Promise<MatchRecord[]> {
    await this.ready;
    const res = await this.pool!.query(
      'SELECT room_code, quick_play, started_at, results FROM matches ORDER BY created_at DESC LIMIT $1',
      [limit],
    );
    return res.rows.map((row) => ({
      roomCode: row.room_code,
      quickPlay: row.quick_play,
      startedAt: new Date(row.started_at).getTime(),
      results: row.results as MatchResults,
    }));
  }

  async close(): Promise<void> {
    await this.ready.catch(() => undefined);
    await this.pool?.end();
  }
}

export function createPersistence(databaseUrl: string | null): Persistence {
  return databaseUrl ? new PostgresPersistence(databaseUrl) : new MemoryPersistence();
}
