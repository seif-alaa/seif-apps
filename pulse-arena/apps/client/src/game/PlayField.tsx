import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  BOARD_SIZE,
  PULSE_COST,
  PULSE_MAX,
  PULSE_SWAPS_PER_CYCLE,
  findFullLines,
  fitsAnywhere,
  getPiece,
  idx,
  stamp,
} from '@pulse/engine';
import { audio } from '../audio/audio';
import { haptic } from '../native/platform';
import { BoardRenderer, type BoardMode } from './boardRenderer';
import type { FxEvent, GameController, GameView } from './controller';
import { drawPiece } from './theme';

interface Drag {
  slot: number;
  piece: string;
  pointerId: number;
  touch: boolean;
  /** Grab point inside the piece, in cell units (mouse only). */
  grabX: number;
  grabY: number;
  x: number;
  y: number;
  /** Scale animation start for the pickup. */
  born: number;
  /** Where the piece started in the tray, for the return animation. */
  homeX: number;
  homeY: number;
}

const LABELS: Record<number, string> = { 2: 'Double', 3: 'Triple', 4: 'Quad' };

export function fxLabel(e: Extract<FxEvent, { kind: 'place' }>): { label: string; sub: string } {
  const lines = e.rows.length + e.cols.length;
  let label = LABELS[lines] ?? (lines >= 5 ? 'Overload' : `+${e.points}`);
  if (e.sweep) label = 'Clean Sweep';
  else if (e.cross && lines === 2) label = 'Cross';
  const parts: string[] = [];
  if (lines >= 2 || e.sweep) parts.push(`+${e.points}`);
  if (e.chain >= 2) parts.push(`Chain ${e.chain}`);
  if (e.surge) parts.push('Surge x2');
  return { label, sub: parts.join('   ') };
}

export function PlayField({
  controller,
  view,
  mode,
  onFx,
  allowSwap = true,
  highlightSlot = null,
}: {
  controller: GameController;
  view: GameView;
  mode: BoardMode;
  onFx?: (e: FxEvent) => void;
  allowSwap?: boolean;
  highlightSlot?: number | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ghostRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BoardRenderer | null>(null);
  const slotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const dragRef = useRef<Drag | null>(null);
  const [dragSlot, setDragSlot] = useState<number | null>(null);
  const [kbSlot, setKbSlot] = useState<number | null>(null);
  const [swapArmed, setSwapArmed] = useState(false);
  const [pulseFlash, setPulseFlash] = useState(false);
  const [dealKey, setDealKey] = useState(0);
  const viewRef = useRef(view);
  viewRef.current = view;
  const ghostRaf = useRef(0);
  const returning = useRef<{ from: { x: number; y: number }; to: { x: number; y: number }; piece: string; born: number } | null>(null);

  /* ---------- Renderer lifecycle ---------- */

  useLayoutEffect(() => {
    const canvas = canvasRef.current!;
    const r = new BoardRenderer(canvas);
    rendererRef.current = r;
    const wrap = wrapRef.current!;
    const ro = new ResizeObserver(() => {
      const size = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight));
      if (size > 0 && size !== r.size) r.resize(size);
    });
    ro.observe(wrap);
    r.start();
    return () => {
      ro.disconnect();
      r.stop();
    };
  }, []);

  useEffect(() => {
    const r = rendererRef.current;
    if (r) r.board = view.board;
  }, [view.board]);

  useEffect(() => {
    if (rendererRef.current) rendererRef.current.mode = mode;
  }, [mode]);

  useEffect(() => {
    setDealKey((k) => k + 1);
  }, [view.cycle]);

  /* ---------- Effects from the controller ---------- */

  useEffect(() => {
    return controller.onFx((e) => {
      const r = rendererRef.current;
      if (!r) return;
      switch (e.kind) {
        case 'place': {
          const lines = e.rows.length + e.cols.length;
          r.placed(e.cells);
          if (lines > 0) {
            const { label, sub } = fxLabel(e);
            r.cleared(e.before, e.rows, e.cols, e.cells, { points: e.points, label, sub, surge: e.surge, lines });
            audio.place(e.cells.length);
            audio.clear(lines, e.chain, e.surge);
            audio.chain(e.chain);
            if (e.pulseGain > 0) {
              audio.pulseGain();
              setPulseFlash(true);
              setTimeout(() => setPulseFlash(false), 540);
            }
            haptic(lines >= 2 ? 'big' : 'clear');
          } else {
            audio.place(e.cells.length);
            haptic('place');
          }
          break;
        }
        case 'rejected':
          r.invalid();
          audio.invalid();
          haptic('error');
          break;
        case 'static':
          r.staticDrop(e.cell);
          audio.staticDrop();
          break;
        case 'swap':
          audio.pulseSpend();
          haptic('big');
          r.floatText('Pulse', 'Piece replaced', '#3DE0D0');
          break;
        case 'eliminated':
          audio.eliminated();
          haptic('error');
          break;
      }
      onFx?.(e);
    });
  }, [controller, onFx]);

  /* ---------- Placement geometry ---------- */

  const computeTarget = useCallback((d: Drag) => {
    const r = rendererRef.current!;
    const piece = getPiece(d.piece);
    const { left, top } = ghostOrigin(d, r.cell, piece.w, piece.h);
    const b = r.toBoard(left, top);
    const col = Math.round(b.x);
    const row = Math.round(b.y);
    const near = b.x > -piece.w + 0.3 && b.y > -piece.h + 0.3 && b.x < BOARD_SIZE - 0.3 && b.y < BOARD_SIZE - 0.3;
    return { col, row, near };
  }, []);

  const updatePreview = useCallback(
    (slot: number | null, col: number, row: number, near: boolean) => {
      const r = rendererRef.current;
      if (!r) return;
      const v = viewRef.current;
      const id = slot !== null ? v.tray[slot] : null;
      if (!id || !near) {
        r.preview = null;
        return;
      }
      const piece = getPiece(id);
      const valid = controller.canPlaceAt(slot!, col, row);
      const cells: number[] = [];
      for (const [c, rr] of piece.cells) {
        const cc = col + c;
        const r2 = row + rr;
        if (cc >= 0 && r2 >= 0 && cc < BOARD_SIZE && r2 < BOARD_SIZE) cells.push(idx(cc, r2));
      }
      let rows: number[] = [];
      let cols: number[] = [];
      if (valid) {
        const full = findFullLines(stamp(v.board, piece, col, row));
        rows = full.rows;
        cols = full.cols;
      }
      r.preview = { cells, color: piece.color, valid, rows, cols };
    },
    [controller],
  );

  /* ---------- Ghost drawing ---------- */

  const drawGhost = useCallback(() => {
    const canvas = ghostRef.current;
    const r = rendererRef.current;
    if (!canvas || !r) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const d = dragRef.current;
    const ret = returning.current;
    if (d) {
      const piece = getPiece(d.piece);
      const t = Math.min(1, (performance.now() - d.born) / 120);
      const scale = 0.62 + 0.38 * (1 - Math.pow(1 - t, 3));
      const cell = r.cell * scale * 1.0;
      const o = ghostOrigin(d, r.cell, piece.w, piece.h);
      // Shadow then piece, lifted slightly for depth.
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#000';
      for (const [c, rr] of piece.cells) ctx.fillRect(o.left + c * cell + 4, o.top + rr * cell + 8, cell - 4, cell - 4);
      ctx.restore();
      drawPiece(ctx, piece.cells, piece.color, o.left, o.top, cell, dpr);
      ghostRaf.current = requestAnimationFrame(drawGhost);
    } else if (ret) {
      const piece = getPiece(ret.piece);
      const t = Math.min(1, (performance.now() - ret.born) / 180);
      const e = 1 - Math.pow(1 - t, 3);
      const cell = r.cell * (1 - 0.4 * e);
      const x = ret.from.x + (ret.to.x - ret.from.x) * e;
      const y = ret.from.y + (ret.to.y - ret.from.y) * e;
      ctx.globalAlpha = 1 - e * 0.3;
      drawPiece(ctx, piece.cells, piece.color, x - (piece.w * cell) / 2, y - (piece.h * cell) / 2, cell, dpr);
      if (t < 1) ghostRaf.current = requestAnimationFrame(drawGhost);
      else {
        returning.current = null;
        ctx.clearRect(0, 0, w, h);
        setDragSlot(null);
      }
    }
  }, []);

  /* ---------- Pointer handling ---------- */

  const startDrag = useCallback(
    (slot: number, e: React.PointerEvent<HTMLButtonElement>) => {
      const v = viewRef.current;
      const id = v.tray[slot];
      if (!id || !v.alive || v.awaitingDeal) return;
      if (swapArmed) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      const piece = getPiece(id);
      const rect = e.currentTarget.getBoundingClientRect();
      // Grab offset relative to the piece's drawn bounds in the tray.
      const trayCell = trayCellSize(rect.width, rect.height);
      const pw = piece.w * trayCell;
      const ph = piece.h * trayCell;
      const px0 = rect.left + (rect.width - pw) / 2;
      const py0 = rect.top + (rect.height - ph) / 2;
      const grabX = Math.min(piece.w, Math.max(0, (e.clientX - px0) / trayCell));
      const grabY = Math.min(piece.h, Math.max(0, (e.clientY - py0) / trayCell));
      returning.current = null;
      dragRef.current = {
        slot,
        piece: id,
        pointerId: e.pointerId,
        touch: e.pointerType !== 'mouse',
        grabX,
        grabY,
        x: e.clientX,
        y: e.clientY,
        born: performance.now(),
        homeX: rect.left + rect.width / 2,
        homeY: rect.top + rect.height / 2,
      };
      setKbSlot(null);
      setDragSlot(slot);
      audio.pickup();
      haptic('tap');
      cancelAnimationFrame(ghostRaf.current);
      ghostRaf.current = requestAnimationFrame(drawGhost);
      const t = computeTarget(dragRef.current);
      updatePreview(slot, t.col, t.row, t.near);
    },
    [computeTarget, drawGhost, updatePreview, swapArmed],
  );

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      d.x = e.clientX;
      d.y = e.clientY;
      const t = computeTarget(d);
      updatePreview(d.slot, t.col, t.row, t.near);
    };
    const end = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
      const r = rendererRef.current!;
      r.preview = null;
      const t = computeTarget(d);
      const ok = e.type === 'pointerup' && t.near && controller.place(d.slot, t.col, t.row);
      if (ok) {
        setDragSlot(null);
        cancelAnimationFrame(ghostRaf.current);
        const g = ghostRef.current;
        g?.getContext('2d')?.clearRect(0, 0, g.width, g.height);
        return;
      }
      if (t.near && e.type === 'pointerup') {
        r.invalid();
        audio.invalid();
        haptic('warn');
      }
      const piece = getPiece(d.piece);
      const o = ghostOrigin(d, r.cell, piece.w, piece.h);
      returning.current = {
        piece: d.piece,
        from: { x: o.left + (piece.w * r.cell) / 2, y: o.top + (piece.h * r.cell) / 2 },
        to: { x: d.homeX, y: d.homeY },
        born: performance.now(),
      };
      cancelAnimationFrame(ghostRaf.current);
      ghostRaf.current = requestAnimationFrame(drawGhost);
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [computeTarget, controller, drawGhost, updatePreview]);

  // Drop any drag if the tray changes underneath us (e.g. server reconciliation).
  useEffect(() => {
    const d = dragRef.current;
    if (d && view.tray[d.slot] !== d.piece) {
      dragRef.current = null;
      if (rendererRef.current) rendererRef.current.preview = null;
      setDragSlot(null);
    }
    if (kbSlot !== null && !view.tray[kbSlot]) setKbSlot(null);
  }, [view.tray, kbSlot]);

  /* ---------- Keyboard placement ---------- */

  const cursor = useRef({ col: 3, row: 3 });

  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    if (kbSlot === null) {
      r.cursor = null;
      if (!dragRef.current) r.preview = null;
      return;
    }
    const sync = () => {
      updatePreview(kbSlot, cursor.current.col, cursor.current.row, true);
    };
    sync();
    const onKey = (e: KeyboardEvent) => {
      const id = viewRef.current.tray[kbSlot];
      if (!id) return;
      const piece = getPiece(id);
      const c = cursor.current;
      let handled = true;
      if (e.key === 'ArrowLeft') c.col = Math.max(0, c.col - 1);
      else if (e.key === 'ArrowRight') c.col = Math.min(BOARD_SIZE - piece.w, c.col + 1);
      else if (e.key === 'ArrowUp') c.row = Math.max(0, c.row - 1);
      else if (e.key === 'ArrowDown') c.row = Math.min(BOARD_SIZE - piece.h, c.row + 1);
      else if (e.key === 'Enter' || e.key === ' ') {
        if (controller.place(kbSlot, c.col, c.row)) {
          setKbSlot(null);
          slotRefs.current[kbSlot]?.focus();
        } else {
          r.invalid();
          audio.invalid();
        }
      } else if (e.key === 'Escape') {
        setKbSlot(null);
        slotRefs.current[kbSlot]?.focus();
      } else handled = false;
      if (handled) {
        e.preventDefault();
        sync();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kbSlot, controller, updatePreview]);

  /* ---------- Pulse swap ---------- */

  const canSwap = allowSwap && view.alive && view.pulse >= PULSE_COST && view.swapsThisCycle < PULSE_SWAPS_PER_CYCLE && !view.awaitingDeal;
  const prevCanSwap = useRef(canSwap);
  useEffect(() => {
    if (canSwap && !prevCanSwap.current) audio.pulseReady();
    prevCanSwap.current = canSwap;
    if (!canSwap) setSwapArmed(false);
  }, [canSwap]);

  const onSlotClick = (slot: number) => {
    if (swapArmed) {
      if (view.tray[slot]) {
        controller.swap(slot);
        setSwapArmed(false);
      }
    }
  };

  const onSlotKey = (slot: number, e: React.KeyboardEvent) => {
    // While a piece is already selected, Enter confirms the placement (handled on window).
    if (kbSlot === slot) return;
    if ((e.key === 'Enter' || e.key === ' ') && !swapArmed && view.tray[slot] && view.alive) {
      e.preventDefault();
      // The placement listener is attached synchronously; keep this keystroke from reaching it.
      e.stopPropagation();
      cursor.current = { col: 3, row: 3 };
      setKbSlot(slot);
      audio.pickup();
    }
  };

  const fits = view.tray.map((id) => (id ? fitsAnywhere(view.board, getPiece(id)) : true));
  const charges = [0, 1].map((i) => Math.max(0, Math.min(1, (view.pulse - i * PULSE_COST) / PULSE_COST)));

  return (
    <>
      <div className="board-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="board-canvas"
          role="img"
          aria-label={`Your board. ${view.board.filter((v) => v).length} of 81 cells filled.`}
        />
      </div>
      <div className="tray" role="group" aria-label="Pieces">
        {view.tray.map((id, slot) => (
          <button
            key={`${slot}-${dealKey}`}
            ref={(el) => {
              slotRefs.current[slot] = el;
            }}
            type="button"
            className={[
              'tray-slot',
              !id && (view.awaitingDeal ? 'waiting' : 'used'),
              id && 'deal',
              dragSlot === slot && 'dragging',
              kbSlot === slot && 'selected',
              swapArmed && id && 'swap-target',
              id && !fits[slot] && 'no-fit',
              highlightSlot === slot && 'selected',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={id ? `${describePiece(id)}${fits[slot] ? '' : ', does not fit'}. Press Enter to place with arrow keys.` : 'Placed'}
            disabled={!id && !view.awaitingDeal}
            onPointerDown={(e) => startDrag(slot, e)}
            onClick={() => onSlotClick(slot)}
            onKeyDown={(e) => onSlotKey(slot, e)}
          >
            {id && <TrayPiece id={id} />}
          </button>
        ))}
        {allowSwap && (
          <button
            type="button"
            className={['pulse-btn', canSwap && 'ready', swapArmed && 'armed', pulseFlash && 'gain'].filter(Boolean).join(' ')}
            disabled={!canSwap}
            aria-pressed={swapArmed}
            aria-label={`Pulse ${Math.floor(view.pulse)} of ${PULSE_MAX}. ${canSwap ? 'Select to replace a piece.' : 'Clear lines to charge.'}`}
            onClick={() => {
              audio.ui();
              setSwapArmed((a) => !a);
            }}
          >
            <span className="cells">
              {charges.map((c, i) => (
                <span className="cell" key={i}>
                  <i style={{ width: `${c * 100}%` }} />
                </span>
              ))}
            </span>
            <span className="label">{swapArmed ? 'Pick' : 'Pulse'}</span>
          </button>
        )}
      </div>
      <canvas ref={ghostRef} className="drag-layer" aria-hidden="true" />
    </>
  );
}

/** Where the ghost's top-left sits for a pointer position. */
function ghostOrigin(d: Drag, cell: number, w: number, h: number): { left: number; top: number } {
  if (d.touch) {
    // Lift the piece above the finger so it stays visible while dragging.
    const lift = cell * 1.1 + 22;
    return { left: d.x - (w * cell) / 2, top: d.y - h * cell - lift };
  }
  return { left: d.x - d.grabX * cell, top: d.y - d.grabY * cell };
}

function trayCellSize(w: number, h: number): number {
  return Math.min(w / 5.6, h / 4.4);
}

function describePiece(id: string): string {
  const p = getPiece(id);
  return `${p.family} piece, ${p.size} cell${p.size === 1 ? '' : 's'}, ${p.w} wide by ${p.h} tall`;
}

function TrayPiece({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const draw = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const piece = getPiece(id);
      const cell = trayCellSize(rect.width, rect.height);
      const w = piece.w * cell;
      const h = piece.h * cell;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawPiece(ctx, piece.cells, piece.color, 0, 0, cell, dpr);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [id]);
  return <canvas ref={ref} />;
}

