import { createRng, hashKey, Stream, weightedIndex } from './rng.js';

/**
 * Piece catalogue.
 *
 * Pieces never rotate during play; every orientation is its own catalogue entry.
 * Families are original groupings with their own color identity:
 *
 *   Mote   single cell                       (Ember)
 *   Rod    straight lines of 2 to 5          (Amber)
 *   Hook   corner shapes, 3 to 5 cells       (Lime)
 *   Slab   solid rectangles, 4 to 9 cells    (Teal)
 *   Step   offset 4-cell zigzags             (Azure)
 *   Fork   3-way junctions, 4 cells          (Violet)
 *   Spark  diagonal-only chains, 2 to 3      (Rose)
 */

export type FamilyId = 'mote' | 'rod' | 'hook' | 'slab' | 'step' | 'fork' | 'spark';

export interface PieceDef {
  /** Stable catalogue id, e.g. "rod4h". */
  readonly id: string;
  readonly family: FamilyId;
  /** Board color index (1..7). */
  readonly color: number;
  /** Cells as [col, row] offsets from the top-left of the bounding box. */
  readonly cells: ReadonlyArray<readonly [number, number]>;
  readonly w: number;
  readonly h: number;
  readonly size: number;
}

export const FAMILY_COLOR: Record<FamilyId, number> = {
  mote: 1,
  rod: 2,
  hook: 3,
  slab: 4,
  step: 5,
  fork: 6,
  spark: 7,
};

/** Color index used for Static cells dropped on idle boards. */
export const STATIC_COLOR = 8;

type Shape = Array<[number, number]>;

function parse(rows: string[]): Shape {
  const cells: Shape = [];
  rows.forEach((line, r) => {
    for (let c = 0; c < line.length; c++) if (line[c] === '#') cells.push([c, r]);
  });
  return cells;
}

function normalize(cells: Shape): Shape {
  const minC = Math.min(...cells.map((p) => p[0]));
  const minR = Math.min(...cells.map((p) => p[1]));
  return cells
    .map(([c, r]) => [c - minC, r - minR] as [number, number])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

function rotate(cells: Shape): Shape {
  return normalize(cells.map(([c, r]) => [-r, c] as [number, number]));
}

function key(cells: Shape): string {
  return cells.map(([c, r]) => `${c},${r}`).join(';');
}

/** All distinct rotations of a shape. */
function orientations(base: Shape): Shape[] {
  const out: Shape[] = [];
  const seen = new Set<string>();
  let cur = normalize(base);
  for (let i = 0; i < 4; i++) {
    const k = key(cur);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(cur);
    }
    cur = rotate(cur);
  }
  return out;
}

interface Template {
  name: string;
  family: FamilyId;
  rows: string[];
  /** Relative deal weight shared across all orientations of this template. */
  weight: number;
}

const TEMPLATES: Template[] = [
  { name: 'mote', family: 'mote', rows: ['#'], weight: 3 },
  { name: 'rod2', family: 'rod', rows: ['##'], weight: 5 },
  { name: 'rod3', family: 'rod', rows: ['###'], weight: 6 },
  { name: 'rod4', family: 'rod', rows: ['####'], weight: 5 },
  { name: 'rod5', family: 'rod', rows: ['#####'], weight: 3 },
  { name: 'hook3', family: 'hook', rows: ['#.', '##'], weight: 7 },
  { name: 'hook4', family: 'hook', rows: ['#.', '#.', '##'], weight: 4 },
  { name: 'hookj', family: 'hook', rows: ['.#', '.#', '##'], weight: 4 },
  { name: 'hook5', family: 'hook', rows: ['#..', '#..', '###'], weight: 3 },
  { name: 'slab4', family: 'slab', rows: ['##', '##'], weight: 7 },
  { name: 'slab6', family: 'slab', rows: ['###', '###'], weight: 3 },
  { name: 'slab9', family: 'slab', rows: ['###', '###', '###'], weight: 2 },
  { name: 'steps', family: 'step', rows: ['.##', '##.'], weight: 3 },
  { name: 'stepz', family: 'step', rows: ['##.', '.##'], weight: 3 },
  { name: 'fork', family: 'fork', rows: ['###', '.#.'], weight: 5 },
  { name: 'spark2', family: 'spark', rows: ['#.', '.#'], weight: 3 },
  { name: 'spark3', family: 'spark', rows: ['#..', '.#.', '..#'], weight: 2 },
];

const SUFFIX = ['a', 'b', 'c', 'd'];

function build(): { pieces: PieceDef[]; weights: number[] } {
  const pieces: PieceDef[] = [];
  const weights: number[] = [];
  for (const t of TEMPLATES) {
    const variants = orientations(parse(t.rows));
    variants.forEach((cells, i) => {
      const w = Math.max(...cells.map((p) => p[0])) + 1;
      const h = Math.max(...cells.map((p) => p[1])) + 1;
      pieces.push({
        id: variants.length === 1 ? t.name : `${t.name}${SUFFIX[i]}`,
        family: t.family,
        color: FAMILY_COLOR[t.family],
        cells,
        w,
        h,
        size: cells.length,
      });
      weights.push(t.weight / variants.length);
    });
  }
  return { pieces, weights };
}

const built = build();

export const PIECES: readonly PieceDef[] = built.pieces;
const BASE_WEIGHTS: readonly number[] = built.weights;
const BY_ID = new Map(PIECES.map((p) => [p.id, p]));

export function getPiece(id: string): PieceDef {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`Unknown piece: ${id}`);
  return p;
}

export function isPieceId(id: unknown): id is string {
  return typeof id === 'string' && BY_ID.has(id);
}

/** Pieces with five or more cells count as "large". */
export const LARGE_SIZE = 5;

/** Cycles at the start of a match deal no large pieces, to ease everyone in. */
export const WARMUP_CYCLES = 2;

/**
 * Escalation: large and awkward pieces become more common as a player's cycle
 * count rises. Keyed only by cycle number, so it is identical for everyone.
 */
export const ESCALATION_CYCLES = 10;
/** From this cycle on, a deal may contain two large pieces. */
export const DOUBLE_LARGE_CYCLE = 20;

function dealWeights(cycle: number): number[] {
  const ramp = 1 + Math.max(0, cycle - WARMUP_CYCLES) / ESCALATION_CYCLES;
  return PIECES.map((p, i) => {
    const base = BASE_WEIGHTS[i]!;
    if (p.size >= LARGE_SIZE) return cycle < WARMUP_CYCLES ? 0 : base * ramp;
    if (p.family === 'spark' || p.family === 'step') return base * Math.sqrt(ramp);
    return base;
  });
}

export function maxLargePerDeal(cycle: number): number {
  return cycle >= DOUBLE_LARGE_CYCLE ? 2 : 1;
}

/**
 * Deterministically deal the three pieces offered in a cycle.
 * Every player in a match receives the same deal for the same cycle number.
 * Large pieces are capped per deal (see maxLargePerDeal).
 */
export function dealCycle(seed: number, cycle: number): [string, string, string] {
  const rng = createRng(hashKey(seed, Stream.Deal, cycle));
  const weights = dealWeights(cycle);
  const out: string[] = [];
  let large = 0;
  while (out.length < 3) {
    const p = PIECES[weightedIndex(weights, rng())]!;
    if (p.size >= LARGE_SIZE) {
      if (large >= maxLargePerDeal(cycle)) continue;
      large++;
    }
    out.push(p.id);
  }
  return out as [string, string, string];
}

/** Replacement pool for Pulse: compact, flexible shapes (4 cells or fewer). */
const REROLL_WEIGHTS: readonly number[] = PIECES.map((p, i) => (p.size <= 4 ? BASE_WEIGHTS[i]! : 0));

/**
 * Deterministically pick the replacement for a Pulse swap.
 * Keyed by cycle, the swap number within that cycle and the piece being
 * replaced, so equal decisions always yield equal outcomes for every player.
 */
export function rerollPiece(seed: number, cycle: number, swapIndex: number, replacing: string): string {
  const replacingIdx = PIECES.findIndex((p) => p.id === replacing);
  const rng = createRng(hashKey(seed, Stream.Reroll, cycle, swapIndex, replacingIdx));
  for (let attempt = 0; attempt < 8; attempt++) {
    const p = PIECES[weightedIndex(REROLL_WEIGHTS, rng())]!;
    if (p.id !== replacing) return p.id;
  }
  return replacing === 'mote' ? 'rod2a' : 'mote';
}
