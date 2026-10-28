import { useEffect, useRef, useState } from 'react';
import { MAX_PLAYERS } from '@pulse/engine';
import { NICKNAME_MAX, ROOM_CODE_LENGTH } from '@pulse/protocol';
import { audio } from '../audio/audio';
import { BRAND } from '../brand';
import { app, go, toast } from '../lib/app';
import { settings } from '../lib/settings';
import { useStore } from '../lib/store';
import { cancelQuickPlay, createRoom, describeError, joinRoom, leaveRoom, net, startQuickPlay } from '../net/net';
import { copyText, offlineDemo, serverUrl, shareInvite } from '../native/platform';
import { IconBack, IconBook, IconCheck, IconCopy, IconCrown, IconEnter, IconPlay, IconSettings, IconShare, IconTarget, IconUsers, LogoMark } from '../ui/icons';

export const SEAT_COLORS = ['#3DE0D0', '#FFC23D', '#9B7BFF', '#FF6A3D', '#4C9DFF'];

function click(fn: () => void) {
  return () => {
    audio.ui();
    fn();
  };
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="screen-head">
      <button className="icon-btn" aria-label="Back" onClick={click(onBack)}>
        <IconBack />
      </button>
      <h1 className="screen-title" style={{ fontSize: 20 }}>
        {title}
      </h1>
      <span style={{ width: 44 }} />
    </div>
  );
}

/* ====================================================================== */

export function LoadingScreen() {
  return (
    <div className="loading">
      <div className="loading-mark">
        <LogoMark size={84} />
        <h1 className="brand-name" style={{ fontSize: 34 }}>
          {BRAND.name.split(' ')[0]} <span>{BRAND.name.split(' ').slice(1).join(' ')}</span>
        </h1>
        <div className="load-bar" />
      </div>
    </div>
  );
}

/* ====================================================================== */

function NicknameChip() {
  const nickname = useStore(settings, (s) => s.nickname);
  const [draft, setDraft] = useState(nickname);
  useEffect(() => setDraft(nickname), [nickname]);
  const commit = () => {
    const clean = draft.replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, NICKNAME_MAX);
    if (clean) {
      settings.set({ nickname: clean });
      void net.request('profile:set', { nickname: clean }).catch(() => null);
    } else setDraft(nickname);
  };
  return (
    <label className="name-chip">
      <span className="eyebrow">Playing as</span>
      <input
        aria-label="Nickname"
        value={draft}
        maxLength={NICKNAME_MAX}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}

function useServerStats() {
  const [stats, setStats] = useState<{ online: number; matchesInProgress: number } | null>(null);
  useEffect(() => {
    if (offlineDemo) return;
    let alive = true;
    const load = () =>
      fetch(`${serverUrl()}/api/stats`)
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => alive && s && setStats(s))
        .catch(() => undefined);
    void load();
    const id = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return stats;
}

export function HomeScreen() {
  const conn = useStore(app, (s) => s.conn);
  const stats = useServerStats();
  const best = useStore(settings, (s) => s.bestPractice);
  const tutorialDone = useStore(settings, (s) => s.tutorialDone);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const online = conn === 'online';

  const play = async () => {
    audio.ui();
    setError('');
    const err = await startQuickPlay();
    if (err) {
      setError(err);
      go('home');
    }
  };

  return (
    <div className="screen">
      <div className="screen-head">
        <span />
        <button className="icon-btn" aria-label="Settings" onClick={click(() => app.set({ settingsOpen: true }))}>
          <IconSettings />
        </button>
      </div>
      <div className="screen-inner">
        <div className="brand">
          <LogoMark size={72} />
          <h1 className="brand-name">
            {BRAND.name.split(' ')[0]} <span>{BRAND.name.split(' ').slice(1).join(' ')}</span>
          </h1>
          <p className="brand-tag">{BRAND.tagline}</p>
        </div>
        <NicknameChip />
        <button className="btn btn-primary btn-lg btn-block" disabled={!online} onClick={() => void play()}>
          <IconPlay size={22} /> Play
        </button>
        <div className="btn-row">
          <button
            className="btn"
            disabled={!online || busy}
            onClick={async () => {
              audio.ui();
              setBusy(true);
              const err = await createRoom();
              setBusy(false);
              if (err) setError(err);
            }}
          >
            <IconUsers /> Private Match
          </button>
          <button className="btn" disabled={!online} onClick={click(() => go('join'))}>
            <IconEnter /> Join Room
          </button>
        </div>
        <div className="error-text" role="alert">
          {error || (offlineDemo ? 'Solo preview. Online matches need the game server running.' : conn === 'offline' ? 'Cannot reach the game server. Practice is available offline.' : '')}
        </div>
        <div className="stats-line" aria-live="polite">
          {stats && online ? (
            <>
              <span>
                <i className="dot" />
                <b>{stats.online}</b> online
              </span>
              <span>
                <b>{stats.matchesInProgress}</b> {stats.matchesInProgress === 1 ? 'match' : 'matches'} live
              </span>
            </>
          ) : (
            <span>{conn === 'online' ? ' ' : conn === 'offline' ? 'Offline' : 'Connecting'}</span>
          )}
        </div>
        <div className="home-footer">
          <button className="btn btn-ghost btn-sm" onClick={click(() => go('tutorial'))}>
            <IconBook size={18} /> {tutorialDone ? 'How to Play' : 'Learn in 30 Seconds'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={click(() => go('practice'))}>
            <IconTarget size={18} /> Practice{best ? ` (best ${best.toLocaleString('en-US')})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ====================================================================== */

export function QuickPlayScreen() {
  const queue = useStore(app, (s) => s.queue);
  const [now, setNow] = useState(net.serverNow());
  useEffect(() => {
    const id = setInterval(() => setNow(net.serverNow()), 250);
    return () => clearInterval(id);
  }, []);
  const waiting = queue?.waiting ?? 1;
  const timedOut = queue?.status === 'timeout';

  return (
    <div className="screen">
      <BackHeader title="Quick Play" onBack={() => void cancelQuickPlay()} />
      <div className="screen-inner" style={{ textAlign: 'center' }}>
        {timedOut ? (
          <>
            <h2 className="screen-title">No match found</h2>
            <p className="muted">
              Not enough players are searching right now. Try again, or start a private match and invite friends with a code.
            </p>
            <button className="btn btn-primary btn-lg btn-block" onClick={() => void startQuickPlay()}>
              Search Again
            </button>
            <button
              className="btn btn-block"
              onClick={async () => {
                audio.ui();
                const err = await createRoom();
                if (err) toast(err, 'bad');
              }}
            >
              <IconUsers /> Private Match
            </button>
          </>
        ) : queue?.status === 'matched' ? (
          <>
            <div className="radar">
              <div className="radar-count">
                <IconCheck size={56} />
              </div>
            </div>
            <h2 className="screen-title">Match found</h2>
            <p className="muted">Starting with {waiting} players.</p>
          </>
        ) : (
          <>
            <div className="radar" aria-hidden="true">
              <div className="radar-count">{waiting}</div>
            </div>
            <h2 className="screen-title">{queue?.status === 'filling' ? 'Filling the match' : 'Finding players'}</h2>
            <div className="pips" aria-label={`${waiting} of ${MAX_PLAYERS} players found`}>
              {Array.from({ length: MAX_PLAYERS }, (_, i) => (
                <span key={i} className={`pip${i < waiting ? ' on' : ''}`} />
              ))}
            </div>
            <p className="muted" aria-live="polite">
              {queue?.status === 'filling' && queue.fillEndsAt
                ? `${waiting} players ready. Starting in ${Math.max(0, Math.ceil((queue.fillEndsAt - now) / 1000))}s unless the match fills first.`
                : `${waiting === 1 ? 'You are the only player searching.' : `${waiting} players searching.`} A match starts as soon as two real players are found.`}
            </p>
            {queue?.searchEndsAt && queue.status === 'searching' && (
              <p className="eyebrow">Search ends in {Math.max(0, Math.ceil((queue.searchEndsAt - now) / 1000))}s</p>
            )}
            <button className="btn btn-block" onClick={() => void cancelQuickPlay()}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ====================================================================== */

function CodeInput({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="code code-input" onClick={() => ref.current?.focus()}>
      {Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => (
        <div key={i} className={`code-cell${focused && i === Math.min(value.length, ROOM_CODE_LENGTH - 1) ? ' active' : ''}`}>
          {value[i] ?? ''}
        </div>
      ))}
      <input
        ref={ref}
        aria-label="Room code"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH))}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
      />
    </div>
  );
}

export function JoinScreen() {
  const pending = useStore(app, (s) => s.pendingCode);
  const [code, setCode] = useState(pending);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (code.length !== ROOM_CODE_LENGTH || busy) return;
    audio.ui();
    setBusy(true);
    setError('');
    const err = await joinRoom(code);
    setBusy(false);
    if (err) setError(err);
  };
  return (
    <div className="screen">
      <BackHeader title="Join Room" onBack={() => go('home')} />
      <div className="screen-inner">
        <p className="muted" style={{ textAlign: 'center', margin: 0 }}>
          Enter the five-character code from your host.
        </p>
        <CodeInput value={code} onChange={setCode} onSubmit={() => void submit()} />
        <NicknameChip />
        <button className="btn btn-primary btn-lg btn-block" disabled={code.length !== ROOM_CODE_LENGTH || busy} onClick={() => void submit()}>
          {busy ? <span className="spinner" /> : 'Join'}
        </button>
        <div className="error-text" role="alert" style={{ textAlign: 'center' }}>
          {error}
        </div>
      </div>
    </div>
  );
}

/* ====================================================================== */

const DURATIONS = [
  { sec: 120, label: '2 min' },
  { sec: 180, label: '3 min' },
  { sec: 300, label: '5 min' },
];

export function LobbyScreen() {
  const room = useStore(app, (s) => s.room);
  const playerId = useStore(app, (s) => s.playerId);
  const [error, setError] = useState('');
  if (!room) {
    return (
      <div className="loading">
        <div className="load-bar" />
      </div>
    );
  }
  const me = room.members.find((m) => m.id === playerId);
  const isHost = room.hostId === playerId;
  const readyCount = room.members.filter((m) => m.connected && (m.ready || m.id === room.hostId)).length;
  const canStart = isHost && readyCount >= room.minPlayers;

  const act = async (fn: () => Promise<{ ok: boolean; error?: string } | unknown>) => {
    audio.ui();
    setError('');
    try {
      const r = (await fn()) as { ok: boolean };
      if (!r.ok) setError(describeError(r));
    } catch (e) {
      setError(describeError(e));
    }
  };

  return (
    <div className="screen">
      <BackHeader title={room.quickPlay ? 'Match Lobby' : 'Private Match'} onBack={() => void leaveRoom()} />
      <div className="screen-inner">
        {!room.quickPlay && (
          <div className="panel" style={{ textAlign: 'center' }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Room Code
            </div>
            <div className="code" aria-label={`Room code ${room.code.split('').join(' ')}`}>
              {room.code.split('').map((ch, i) => (
                <div key={i} className="code-cell">
                  {ch}
                </div>
              ))}
            </div>
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  audio.ui();
                  toast((await copyText(room.code)) ? 'Code copied' : 'Could not copy', 'good', 1400);
                }}
              >
                <IconCopy size={18} /> Copy Code
              </button>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  audio.ui();
                  const r = await shareInvite(room.code);
                  if (r === 'copied') toast('Invite link copied', 'good', 1400);
                }}
              >
                <IconShare size={18} /> Invite Friends
              </button>
            </div>
          </div>
        )}

        <div className="seats" role="list" aria-label="Players">
          {room.members.map((m) => (
            <div className="seat" role="listitem" key={m.id}>
              <span className="avatar" style={{ background: SEAT_COLORS[m.seat % SEAT_COLORS.length] }}>
                {m.nickname.slice(0, 1).toUpperCase()}
              </span>
              <span className="seat-name">
                {m.nickname}
                {m.id === playerId ? <span className="muted"> (you)</span> : null}
              </span>
              {m.isHost && (
                <span className="badge host">
                  <IconCrown size={12} /> Host
                </span>
              )}
              {!m.connected ? <span className="badge away">Away</span> : m.ready || m.isHost ? <span className="badge ready">Ready</span> : <span className="badge">Not ready</span>}
            </div>
          ))}
          {Array.from({ length: Math.max(0, room.maxPlayers - room.members.length) }, (_, i) => (
            <div className="seat empty" key={`e${i}`}>
              <span className="avatar" style={{ background: 'var(--bg-3)', color: 'var(--text-2)' }}>
                {room.members.length + i + 1}
              </span>
              <span className="seat-name" style={{ fontWeight: 600 }}>
                Open seat
              </span>
            </div>
          ))}
        </div>

        {isHost ? (
          <div className="field">
            <label>Match Length</label>
            <div className="segmented" role="group" aria-label="Match length">
              {DURATIONS.map((d) => (
                <button key={d.sec} aria-pressed={room.durationSec === d.sec} onClick={() => void act(() => net.request('room:settings', { durationSec: d.sec }))}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="muted" style={{ textAlign: 'center', margin: 0 }}>
            Match length {Math.round(room.durationSec / 60)} min. The host starts the match.
          </p>
        )}

        {isHost ? (
          <button className="btn btn-primary btn-lg btn-block" disabled={!canStart} onClick={() => void act(() => net.request('room:start', {}))}>
            Start Match
          </button>
        ) : (
          <button
            className={`btn btn-lg btn-block${me?.ready ? '' : ' btn-primary'}`}
            onClick={() => void act(() => net.request('room:ready', { ready: !me?.ready }))}
          >
            {me?.ready ? 'Not Ready' : 'Ready'}
          </button>
        )}
        <p className="muted" style={{ textAlign: 'center', margin: 0, fontSize: 13 }} aria-live="polite">
          {readyCount < room.minPlayers
            ? room.members.length < 2
              ? 'Waiting for at least one more player. Share the code to invite friends.'
              : 'Waiting for players to get ready.'
            : `${readyCount} players will play. Players who are not ready can watch.`}
        </p>
        <div className="error-text" role="alert" style={{ textAlign: 'center' }}>
          {error}
        </div>
      </div>
    </div>
  );
}

/* ====================================================================== */

export function UnreachableScreen({ replaced }: { replaced?: boolean }) {
  return (
    <div className="screen">
      <div className="screen-inner" style={{ textAlign: 'center' }}>
        <LogoMark size={56} />
        <h1 className="screen-title">{replaced ? 'Opened elsewhere' : 'Server unreachable'}</h1>
        <p className="muted">
          {replaced
            ? 'Your session is now active in another tab or device. Only one connection per player is allowed during a match.'
            : 'The game server is not responding. Check your connection. Your progress in a running match is kept for a short time.'}
        </p>
        <button
          className="btn btn-primary btn-block"
          onClick={click(() => {
            net.reclaim();
            go('home');
          })}
        >
          {replaced ? 'Use This Device' : 'Try Again'}
        </button>
        <button className="btn btn-block" onClick={click(() => go('practice'))}>
          <IconTarget /> Practice Offline
        </button>
      </div>
    </div>
  );
}
