import { useState } from 'react';
import type { MatchResults, ResultRow } from '@pulse/protocol';
import { audio } from '../audio/audio';
import { BRAND } from '../brand';
import { app, go, matchStore, toast } from '../lib/app';
import { useStore } from '../lib/store';
import { describeError, leaveRoom, net, startQuickPlay } from '../net/net';
import { shareImage, shareInvite } from '../native/platform';
import { BLOCK_COLORS, UI } from '../game/theme';
import { ordinal } from '../game/Opponents';
import { decodeBoard } from '@pulse/engine';
import { IconHome, IconImage, IconRefresh, IconShare } from '../ui/icons';
import { SEAT_COLORS } from './Menus';

function formatTime(ms: number | null): string {
  if (ms === null) return '';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function outcomeText(r: MatchResults, meId: string | null): string {
  const winner = r.rows.find((x) => x.id === r.winnerId);
  const name = r.winnerId === meId ? 'You' : (winner?.nickname ?? 'The winner');
  switch (r.reason) {
    case 'last-standing':
      return `${name} ${r.winnerId === meId ? 'were' : 'was'} the last player standing.`;
    case 'all-eliminated':
      return `Every player was eliminated. ${name} lasted the longest.`;
    case 'time': {
      const survivors = r.rows.filter((x) => x.alive).length;
      const note = survivors < r.rows.length ? ' Players who were eliminated rank below everyone who survived.' : '';
      return `Time ran out. ${name} had the highest score among players still in the match.${note}`;
    }
  }
}

function rowDetail(row: ResultRow): string {
  if (row.alive) return `Survived, ${row.lines} lines, best chain ${row.bestChain}`;
  const why = row.eliminationReason === 'disconnected' ? 'Disconnected' : row.eliminationReason === 'left' ? 'Left' : 'Eliminated';
  return `${why} at ${formatTime(row.eliminatedAt)}, ${row.lines} lines`;
}

export function ResultsScreen() {
  const results = useStore(app, (s) => s.results);
  const room = useStore(app, (s) => s.room);
  const playerId = useStore(app, (s) => s.playerId);
  const start = useStore(matchStore, (s) => s.start);
  const [error, setError] = useState('');
  if (!results) {
    return (
      <div className="loading">
        <div className="load-bar" />
      </div>
    );
  }
  const me = results.rows.find((r) => r.id === playerId);
  const won = results.winnerId === playerId;
  const seatOf = new Map((start?.players ?? []).map((p) => [p.id, p.seat]));

  const rematch = async () => {
    audio.ui();
    try {
      const r = await net.request('room:rematch', {});
      if (!r.ok) setError(describeError(r));
      else go('lobby');
    } catch (e) {
      setError(describeError(e));
    }
  };

  const playAgain = async () => {
    audio.ui();
    await net.request('room:leave', {}).catch(() => null);
    app.set({ room: null, results: null });
    const err = await startQuickPlay();
    if (err) setError(err);
  };

  const share = async () => {
    audio.ui();
    const blob = await renderResultImage(results, playerId, matchStore.get().self?.board ?? null);
    if (!blob) return;
    const text = me ? `I finished ${ordinal(me.rank)} of ${results.rows.length} with ${me.score.toLocaleString('en-US')} points in ${BRAND.name}.` : `${BRAND.name} match result`;
    const r = await shareImage(blob, 'match-result.png', text);
    if (r === 'saved') toast('Result image saved', 'good', 1600);
  };

  return (
    <div className="screen">
      <div className="screen-inner">
        <div className={`result-hero${won ? ' win' : ''}`}>
          <span className="eyebrow">Final Standings</span>
          <h1>{me ? (won ? 'Victory' : `${ordinal(me.rank)} Place`) : 'Match Over'}</h1>
          {me && (
            <span className="num" style={{ fontSize: 22, fontWeight: 800 }}>
              {me.score.toLocaleString('en-US')} points
            </span>
          )}
        </div>
        <p className="reason">{outcomeText(results, playerId)}</p>
        <div className="standings" role="list">
          {results.rows.map((row, i) => (
            <div
              key={row.id}
              role="listitem"
              className={`standing${row.id === playerId ? ' me' : ''}${i === 0 ? ' first' : ''}`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span className="place">{row.rank}</span>
              <span className="who">
                <b>
                  <span className="avatar" style={{ display: 'inline-grid', width: 18, height: 18, fontSize: 10, borderRadius: 5, marginRight: 8, verticalAlign: -3, background: SEAT_COLORS[(seatOf.get(row.id) ?? i) % SEAT_COLORS.length] }}>
                    {row.nickname.slice(0, 1).toUpperCase()}
                  </span>
                  {row.nickname}
                  {row.id === playerId ? ' (you)' : ''}
                </b>
                <span>{rowDetail(row)}</span>
              </span>
              <span className="pts">{row.score.toLocaleString('en-US')}</span>
            </div>
          ))}
        </div>
        <button className="btn btn-primary btn-lg btn-block" onClick={() => void (room?.quickPlay ? playAgain() : rematch())}>
          <IconRefresh /> {room?.quickPlay ? 'Play Again' : 'Rematch'}
        </button>
        <div className="btn-row">
          {room && !room.quickPlay ? (
            <button
              className="btn"
              onClick={async () => {
                audio.ui();
                const r = await shareInvite(room.code);
                if (r === 'copied') toast('Invite link copied', 'good', 1400);
              }}
            >
              <IconShare size={20} /> Invite Friends
            </button>
          ) : (
            <button className="btn" onClick={() => void rematch()}>
              Rematch Group
            </button>
          )}
          <button className="btn" onClick={() => void share()}>
            <IconImage size={20} /> Share Result
          </button>
        </div>
        <button className="btn btn-ghost btn-block" onClick={() => void leaveRoom()}>
          <IconHome size={20} /> Home
        </button>
        <div className="error-text" role="alert" style={{ textAlign: 'center' }}>
          {error}
        </div>
      </div>
    </div>
  );
}

/** Draw a shareable result card locally. Nothing is uploaded. */
async function renderResultImage(r: MatchResults, meId: string | null, board: string | null): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  await document.fonts?.ready;
  const display = '"Oxanium Variable", Oxanium, system-ui, sans-serif';
  const ui = '"Manrope Variable", Manrope, system-ui, sans-serif';

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0C1220');
  bg.addColorStop(1, '#07090D');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  for (let x = 0; x < W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  const me = r.rows.find((x) => x.id === meId);
  ctx.fillStyle = UI.pulse;
  ctx.font = `800 40px ${display}`;
  ctx.fillText(BRAND.name.toUpperCase(), 80, 120);
  ctx.fillStyle = '#A9B3C4';
  ctx.font = `600 30px ${ui}`;
  ctx.fillText(`${r.rows.length}-player match, ${Math.round(r.durationMs / 60000)} minutes`, 80, 170);

  ctx.fillStyle = me && r.winnerId === me.id ? UI.surge : '#EEF2F8';
  ctx.font = `800 120px ${display}`;
  ctx.fillText(me ? (r.winnerId === me.id ? 'VICTORY' : `${ordinal(me.rank).toUpperCase()} PLACE`) : 'FINAL', 80, 320);
  if (me) {
    ctx.fillStyle = '#EEF2F8';
    ctx.font = `700 56px ${display}`;
    ctx.fillText(`${me.score.toLocaleString('en-US')} points`, 80, 400);
  }

  if (board) {
    const cells = decodeBoard(board);
    const size = 300;
    const x0 = W - 80 - size;
    const y0 = 90;
    const cell = size / 9;
    ctx.fillStyle = UI.boardBg;
    ctx.fillRect(x0 - 10, y0 - 10, size + 20, size + 20);
    for (let i = 0; i < 81; i++) {
      const v = cells[i]!;
      ctx.fillStyle = v ? BLOCK_COLORS[v]!.base : UI.slot;
      ctx.fillRect(x0 + (i % 9) * cell + 2, y0 + Math.floor(i / 9) * cell + 2, cell - 4, cell - 4);
    }
  }

  let y = 520;
  r.rows.forEach((row) => {
    const mine = row.id === meId;
    ctx.fillStyle = mine ? 'rgba(61,224,208,0.12)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(80, y - 60, W - 160, 100);
    ctx.fillStyle = row.rank === 1 ? UI.surge : '#A9B3C4';
    ctx.font = `800 48px ${display}`;
    ctx.fillText(String(row.rank), 110, y + 8);
    ctx.fillStyle = '#EEF2F8';
    ctx.font = `700 42px ${ui}`;
    ctx.fillText(row.nickname, 190, y + 6);
    ctx.textAlign = 'right';
    ctx.font = `800 48px ${display}`;
    ctx.fillText(row.score.toLocaleString('en-US'), W - 110, y + 8);
    ctx.textAlign = 'left';
    y += 120;
  });

  ctx.fillStyle = '#6C778B';
  ctx.font = `600 30px ${ui}`;
  ctx.fillText('Live block survival for up to five players', 80, H - 80);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}
