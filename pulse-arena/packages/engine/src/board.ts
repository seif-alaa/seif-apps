import { BOARD_SIZE, CELL_COUNT } from './rules.js';
import type { PieceDef } from './pieces.js';

/**
 * A board is a flat array of BOARD_SIZE * BOARD_SIZE cells, row-major.
 * 0 = empty, 1..7 = piece family colors, 8 = Static.
 */
export type Board = number[];

export function emptyBoard(): Board {
  return new Array<number>(CELL_COUNT).fill(0);
}

export function idx(col: number, row: number): number {
  return row * BOARD_SIZE + col;
}

export function canPlace(board: Board, piece: PieceDef, col: number, row: number): boolean {
  if (!Number.isInteger(col) || !Number.isInteger(row)) return false;
  if (col < 0 || row < 0 || col + piece.w > BOARD_SIZE || row + piece.h > BOARD_SIZE) return false;
  for (const [c, r] of piece.cells) {
    if (board[idx(col + c, row + r)] !== 0) return false;
  }
  return true;
}

/** True when the piece fits anywhere on the board. */
export function fitsAnywhere(board: Board, piece: PieceDef): boolean {
  for (let row = 0; row + piece.h <= BOARD_SIZE; row++) {
    for (let col = 0; col + piece.w <= BOARD_SIZE; col++) {
      if (canPlace(board, piece, col, row)) return true;
    }
  }
  return false;
}

/** Number of distinct legal positions for a piece. Used for danger estimates and bots. */
export function countPlacements(board: Board, piece: PieceDef): number {
  let n = 0;
  for (let row = 0; row + piece.h <= BOARD_SIZE; row++) {
    for (let col = 0; col + piece.w <= BOARD_SIZE; col++) {
      if (canPlace(board, piece, col, row)) n++;
    }
  }
  return n;
}

export interface ClearSet {
  rows: number[];
  cols: number[];
}

/** Rows and columns that are completely filled. */
export function findFullLines(board: Board): ClearSet {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    let full = true;
    for (let c = 0; c < BOARD_SIZE; c++) if (board[idx(c, r)] === 0) { full = false; break; }
    if (full) rows.push(r);
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true;
    for (let r = 0; r < BOARD_SIZE; r++) if (board[idx(c, r)] === 0) { full = false; break; }
    if (full) cols.push(c);
  }
  return { rows, cols };
}

/** Write a piece into a copy of the board. Caller must have checked canPlace. */
export function stamp(board: Board, piece: PieceDef, col: number, row: number): Board {
  const next = board.slice();
  for (const [c, r] of piece.cells) next[idx(col + c, row + r)] = piece.color;
  return next;
}

/** Clear the given lines in a copy of the board. Rows and columns are cleared simultaneously. */
export function clearLines(board: Board, set: ClearSet): Board {
  const next = board.slice();
  for (const r of set.rows) for (let c = 0; c < BOARD_SIZE; c++) next[idx(c, r)] = 0;
  for (const c of set.cols) for (let r = 0; r < BOARD_SIZE; r++) next[idx(c, r)] = 0;
  return next;
}

export function isEmpty(board: Board): boolean {
  return board.every((v) => v === 0);
}

export function filledCount(board: Board): number {
  let n = 0;
  for (const v of board) if (v !== 0) n++;
  return n;
}

/** Compact string encoding for the wire: one character per cell ('0'..'8'). */
export function encodeBoard(board: Board): string {
  return board.join('');
}

export function decodeBoard(s: string): Board {
  const out = emptyBoard();
  for (let i = 0; i < CELL_COUNT && i < s.length; i++) {
    const v = s.charCodeAt(i) - 48;
    out[i] = v >= 0 && v <= 8 ? v : 0;
  }
  return out;
}
