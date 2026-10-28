/**
 * Tunable rule constants. Every balance number lives here so that the
 * design document, tests and both runtimes stay in agreement.
 */

export const BOARD_SIZE = 9;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

/** Pieces offered per cycle, and how many must be placed before the cycle ends. */
export const OFFER_SIZE = 3;
export const PLACE_PER_CYCLE = 2;

/** Points for clearing N lines in one placement (index = line count, capped at the last entry). */
export const CLEAR_POINTS = [0, 10, 30, 60, 100, 150] as const;
/** Extra points for each line beyond the table. */
export const CLEAR_POINTS_EXTRA = 60;
/** Bonus when a single placement clears at least one row and one column. */
export const CROSS_BONUS = 20;
/** Bonus when a placement leaves the board completely empty. */
export const SWEEP_BONUS = 200;

/**
 * Chain: each placement that clears raises the chain by one.
 * The chain survives one placement without a clear and breaks on the second.
 */
export const CHAIN_MISS_LIMIT = 2;
/** Multiplier step per chain level above 1, and the maximum multiplier. */
export const CHAIN_STEP = 0.5;
export const CHAIN_MAX_MULT = 4;

/** Pulse economy. Stored as integer energy. */
export const PULSE_COST = 100;
export const PULSE_MAX = 200;
export const PULSE_PER_LINE = 12;
export const PULSE_PER_CHAIN = 8;
export const PULSE_CHAIN_CAP = 5;
/** Pulse swaps allowed per cycle. */
export const PULSE_SWAPS_PER_CYCLE = 1;

/** Surge: clear points (and Pulse gain) are multiplied during Surge windows. */
export const SURGE_MULT = 2;
export const SURGE_LENGTH_MS = 10_000;
export const SURGE_WARNING_MS = 3_000;
/** Surge windows open at these fractions of the match duration. */
export const SURGE_FRACTIONS = [0.25, 0.53, 0.81] as const;

/**
 * Static: a board that sits idle accumulates Static cells. This prevents a
 * leader from simply stopping to protect a score. Static clears like any cell.
 */
export const IDLE_GRACE_MS = 10_000;
export const STATIC_INTERVAL_MS = 3_000;

/**
 * Last Chance: when no offered piece fits but a Pulse swap is affordable,
 * the player has this long to use it before elimination.
 */
export const LAST_CHANCE_MS = 8_000;

/** Match timing defaults. */
export const DEFAULT_DURATION_SEC = 180;
export const MIN_DURATION_SEC = 60;
export const MAX_DURATION_SEC = 600;
export const COUNTDOWN_MS = 3_000;
/** Final-seconds alert threshold used by clients. */
export const FINAL_SECONDS_MS = 10_000;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;

export interface SurgeWindow {
  /** Milliseconds since match start. */
  start: number;
  end: number;
}

/** Surge schedule for a match of the given duration. Fully predictable. */
export function surgeSchedule(durationMs: number): SurgeWindow[] {
  const fractions = durationMs >= 90_000 ? SURGE_FRACTIONS : ([0.5] as const);
  return fractions
    .map((f) => {
      const start = Math.round((durationMs * f) / 1000) * 1000;
      return { start, end: start + SURGE_LENGTH_MS };
    })
    .filter((w) => w.end <= durationMs);
}

export function surgeActiveAt(schedule: readonly SurgeWindow[], elapsedMs: number): boolean {
  return schedule.some((w) => elapsedMs >= w.start && elapsedMs < w.end);
}

export function clearBasePoints(lines: number): number {
  if (lines <= 0) return 0;
  const last = CLEAR_POINTS.length - 1;
  if (lines <= last) return CLEAR_POINTS[lines]!;
  return CLEAR_POINTS[last]! + (lines - last) * CLEAR_POINTS_EXTRA;
}

export function chainMultiplier(chain: number): number {
  if (chain <= 1) return 1;
  return Math.min(CHAIN_MAX_MULT, 1 + CHAIN_STEP * (chain - 1));
}
