/**
 * Move search used by balance simulations, load tests and automated
 * end-to-end tests. It is never used to impersonate a player in a live match.
 */
import { canPlace, clearLines, findFullLines, stamp, type Board } from './board.js';
import { getPiece } from './pieces.js';
import type { PlayerState } from './player.js';
import { BOARD_SIZE } from './rules.js';

export interface BotMove {
  slot: number;
  col: number;
  row: number;
  score: number;
}

/** Open-space heuristic: rewards clears, penalizes isolated holes and rough edges. */
function evaluateBoard(board: Board, cleared: number): number {
  let holes = 0;
  let edges = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const v = board[r * BOARD_SIZE + c];
      const right = c + 1 < BOARD_SIZE ? board[r * BOARD_SIZE + c + 1] : 1;
      const down = r + 1 < BOARD_SIZE ? board[(r + 1) * BOARD_SIZE + c] : 1;
      if ((v === 0) !== (right === 0)) edges++;
      if ((v === 0) !== (down === 0)) edges++;
      if (v === 0) {
        let blocked = 0;
        if (c === 0 || board[r * BOARD_SIZE + c - 1] !== 0) blocked++;
        if (c === BOARD_SIZE - 1 || board[r * BOARD_SIZE + c + 1] !== 0) blocked++;
        if (r === 0 || board[(r - 1) * BOARD_SIZE + c] !== 0) blocked++;
        if (r === BOARD_SIZE - 1 || board[(r + 1) * BOARD_SIZE + c] !== 0) blocked++;
        if (blocked === 4) holes++;
      }
    }
  }
  return cleared * 40 - holes * 12 - edges * 1.5;
}

/** Best single placement by heuristic, or null when nothing fits. */
export function chooseMove(s: PlayerState, rand: () => number = Math.random, noise = 0): BotMove | null {
  let best: BotMove | null = null;
  s.tray.forEach((id, slot) => {
    if (!id) return;
    const piece = getPiece(id);
    for (let row = 0; row + piece.h <= BOARD_SIZE; row++) {
      for (let col = 0; col + piece.w <= BOARD_SIZE; col++) {
        if (!canPlace(s.board, piece, col, row)) continue;
        let b = stamp(s.board, piece, col, row);
        const full = findFullLines(b);
        const n = full.rows.length + full.cols.length;
        if (n) b = clearLines(b, full);
        const score = evaluateBoard(b, n) + (noise ? (rand() - 0.5) * noise : 0);
        if (!best || score > best.score) best = { slot, col, row, score };
      }
    }
  });
  return best;
}

/** Uniformly random legal placement, or null. Used for chaos-style tests. */
export function randomMove(s: PlayerState, rand: () => number = Math.random): BotMove | null {
  const moves: BotMove[] = [];
  s.tray.forEach((id, slot) => {
    if (!id) return;
    const piece = getPiece(id);
    for (let row = 0; row + piece.h <= BOARD_SIZE; row++)
      for (let col = 0; col + piece.w <= BOARD_SIZE; col++)
        if (canPlace(s.board, piece, col, row)) moves.push({ slot, col, row, score: 0 });
  });
  if (!moves.length) return null;
  return moves[Math.floor(rand() * moves.length)]!;
}
