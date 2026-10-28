import { memo, useEffect, useRef, useState } from 'react';
import { BOARD_SIZE, decodeBoard } from '@pulse/engine';
import type { ActivitySummary, PublicPlayerState } from '@pulse/protocol';
import { BLOCK_COLORS, UI } from './theme';

export interface OpponentInfo {
  state: PublicPlayerState;
  nickname: string;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export { ordinal };

/** Tiny live board. Redraws only when the board string or activity changes. */
export const MiniBoard = memo(function MiniBoard({ board, activity, size = 96 }: { board: string; activity: ActivitySummary | null; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(size * dpr);
    if (canvas.width !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    const ctx = canvas.getContext('2d')!;
    const cells = decodeBoard(board);
    const pad = px * 0.04;
    const cell = (px - pad * 2) / BOARD_SIZE;
    const gap = Math.max(0.5, cell * 0.1);
    const highlight = new Set(activity?.cells ?? []);
    const cleared = new Set<number>();
    if (activity?.kind === 'clear') {
      for (const r of activity.rows ?? []) for (let c = 0; c < BOARD_SIZE; c++) cleared.add(r * BOARD_SIZE + c);
      for (const c of activity.cols ?? []) for (let r = 0; r < BOARD_SIZE; r++) cleared.add(r * BOARD_SIZE + c);
    }
    const start = performance.now();
    let raf = 0;
    const draw = () => {
      const t = Math.min(1, (performance.now() - start) / 700);
      ctx.clearRect(0, 0, px, px);
      ctx.fillStyle = UI.boardBg;
      ctx.fillRect(0, 0, px, px);
      for (let i = 0; i < 81; i++) {
        const x = pad + (i % BOARD_SIZE) * cell;
        const y = pad + Math.floor(i / BOARD_SIZE) * cell;
        const v = cells[i]!;
        if (v) {
          const col = BLOCK_COLORS[v]!;
          ctx.fillStyle = col.base;
          ctx.fillRect(x + gap / 2, y + gap / 2, cell - gap, cell - gap);
          ctx.fillStyle = col.light;
          ctx.fillRect(x + gap / 2, y + gap / 2, cell - gap, Math.max(0.7, (cell - gap) * 0.22));
          if (highlight.has(i) && t < 1) {
            ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - t)})`;
            ctx.fillRect(x, y, cell, cell);
          }
        } else {
          ctx.fillStyle = UI.slot;
          ctx.fillRect(x + gap / 2, y + gap / 2, cell - gap, cell - gap);
          if (cleared.has(i) && t < 1) {
            ctx.fillStyle = activity?.surge ? `rgba(255,178,62,${0.85 * (1 - t)})` : `rgba(170,240,255,${0.8 * (1 - t)})`;
            ctx.fillRect(x, y, cell, cell);
          }
        }
      }
      if (t < 1) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [board, activity, size]);
  return <canvas ref={ref} className="mini" style={{ aspectRatio: '1 / 1' }} aria-hidden="true" />;
});

function activityText(p: PublicPlayerState): { text: string; tone: '' | 'hot' | 'surge' | 'bad' } {
  if (!p.alive) return { text: p.eliminationReason === 'disconnected' ? 'Disconnected' : p.eliminationReason === 'left' ? 'Left the match' : 'Eliminated', tone: 'bad' };
  if (!p.connected) return { text: 'Reconnecting', tone: 'bad' };
  if (p.danger === 2) return { text: 'Almost out of space', tone: 'bad' };
  const a = p.activity;
  if (!a) return { text: 'Ready', tone: '' };
  switch (a.kind) {
    case 'clear': {
      const lines = a.lines ?? 1;
      const base = lines === 1 ? 'Cleared a line' : `Cleared ${lines} lines`;
      const chain = (a.chain ?? 0) >= 2 ? `, chain ${a.chain}` : '';
      return { text: `${base}${chain}`, tone: a.surge ? 'surge' : 'hot' };
    }
    case 'swap':
      return { text: 'Used Pulse', tone: 'hot' };
    case 'static':
      return { text: 'Idle, taking Static', tone: 'bad' };
    case 'place':
      return { text: `Placed, +${a.points ?? 0}`, tone: '' };
    default:
      return { text: '', tone: '' };
  }
}

export function OpponentCard({ info, compact }: { info: OpponentInfo; compact?: boolean }) {
  const p = info.state;
  const [flash, setFlash] = useState(false);
  const [eliminating, setEliminating] = useState(false);
  const lastAt = useRef<number | null>(p.activity?.at ?? null);
  const wasAlive = useRef(p.alive);

  useEffect(() => {
    if (p.activity && p.activity.at !== lastAt.current) {
      lastAt.current = p.activity.at;
      if (p.activity.kind === 'clear') {
        setFlash(true);
        const t = setTimeout(() => setFlash(false), 620);
        return () => clearTimeout(t);
      }
    }
    return undefined;
  }, [p.activity]);

  useEffect(() => {
    if (wasAlive.current && !p.alive) {
      setEliminating(true);
      const t = setTimeout(() => setEliminating(false), 950);
      wasAlive.current = false;
      return () => clearTimeout(t);
    }
    wasAlive.current = p.alive;
    return undefined;
  }, [p.alive]);

  const act = activityText(p);
  const cls = ['opp', !p.alive && 'out', p.alive && p.danger === 2 && 'danger', flash && 'flash', eliminating && 'eliminating'].filter(Boolean).join(' ');
  return (
    <div className={cls} role="listitem" aria-label={`${info.nickname}, rank ${p.rank}, ${p.score} points, ${act.text}`}>
      <MiniBoard board={p.board} activity={p.activity} size={compact ? 64 : 96} />
      <div className="opp-head">
        <span className="opp-rank">{ordinal(p.rank)}</span>
        <span className="opp-name">{info.nickname}</span>
      </div>
      <AnimatedNumber className="opp-score" value={p.score} />
      <div className={`opp-activity ${act.tone}`}>{act.text}</div>
      {!p.alive && <span className="opp-stamp">Out</span>}
    </div>
  );
}

/** Counts smoothly toward the latest value. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = value;
    if (a === b) return;
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / 380);
      const v = Math.round(a + (b - a) * (1 - Math.pow(1 - t, 3)));
      setShown(v);
      from.current = v;
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{shown.toLocaleString('en-US')}</span>;
}
