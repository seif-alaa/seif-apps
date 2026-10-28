import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { CHAIN_MISS_LIMIT, FINAL_SECONDS_MS, SURGE_WARNING_MS, dangerLevel, surgeActiveAt } from '@pulse/engine';
import { audio } from '../audio/audio';
import { app, go, matchStore, toast } from '../lib/app';
import { settings } from '../lib/settings';
import { useStore } from '../lib/store';
import { leaveRoom } from '../net/net';
import { haptic } from '../native/platform';
import { LocalController, OnlineController, type GameController } from '../game/controller';
import { AnimatedNumber, OpponentCard, ordinal, type OpponentInfo } from '../game/Opponents';
import { PlayField } from '../game/PlayField';
import { IconClose, IconExpand, IconSettings } from '../ui/icons';

/** Re-render on controller changes and return its current view. */
function useController(c: GameController | null) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => (c ? c.subscribe(force) : undefined), [c]);
  return c ? c.view() : null;
}

/** Ticks a React state at a modest rate for clocks and countdowns. */
function useNow(c: GameController | null, hz = 10): number {
  const [t, setT] = useState(() => c?.elapsed() ?? 0);
  useEffect(() => {
    if (!c) return;
    const id = setInterval(() => setT(c.elapsed()), 1000 / hz);
    return () => clearInterval(id);
  }, [c, hz]);
  return t;
}

function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function OnlineGameScreen() {
  const start = useStore(matchStore, (s) => s.start);
  const hasSelf = useStore(matchStore, (s) => s.self !== null);
  const [controller, setController] = useState<OnlineController | null>(null);

  useEffect(() => {
    if (!start || !hasSelf) return;
    const c = new OnlineController(start.startAt, start.durationMs, start.surges, matchStore.get().self!);
    setController(c);
    return () => c.dispose();
    // A new controller per match; self updates flow through the controller itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start?.matchId, hasSelf]);

  if (!start) {
    return (
      <div className="loading">
        <div className="loading-mark">
          <div className="load-bar" />
          <span className="muted">Joining match</span>
        </div>
      </div>
    );
  }
  return <GameLayout controller={controller} online />;
}

export function PracticeScreen() {
  const [round, setRound] = useState(0);
  const controller = useMemo(() => new LocalController({ kind: 'practice', durationMs: 180_000 }), [round]);
  useEffect(() => () => controller.dispose(), [controller]);
  return <GameLayout key={round} controller={controller} online={false} onRestart={() => setRound((r) => r + 1)} />;
}

function GameLayout({ controller, online, onRestart }: { controller: GameController | null; online: boolean; onRestart?: () => void }) {
  const view = useController(controller);
  const elapsed = useNow(controller, 10);
  const playerId = useStore(app, (s) => s.playerId);
  const players = useStore(matchStore, (s) => s.players);
  const start = useStore(matchStore, (s) => s.start);
  const results = useStore(app, (s) => s.results);
  const [scoreBump, setScoreBump] = useState(false);
  const [rankUp, setRankUp] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [menu, setMenu] = useState(false);
  const durationMs = controller?.durationMs ?? start?.durationMs ?? 180_000;
  const surges = controller?.surges ?? start?.surges ?? [];
  const remaining = durationMs - Math.max(0, elapsed);
  const surge = surgeActiveAt(surges, Math.max(0, elapsed));
  const nextSurge = surges.find((w) => w.start > elapsed);
  const surgeWarning = !surge && nextSurge && nextSurge.start - elapsed <= SURGE_WARNING_MS && elapsed >= 0;

  const names = useMemo(() => new Map((start?.players ?? []).map((p) => [p.id, p.nickname])), [start]);
  const me = playerId ? players[playerId] : undefined;
  const opponents: OpponentInfo[] = useMemo(
    () =>
      Object.values(players)
        .filter((p) => p.id !== playerId)
        .sort((a, b) => a.rank - b.rank)
        .map((p) => ({ state: p, nickname: names.get(p.id) ?? 'Player' })),
    [players, playerId, names],
  );
  const spectatorOnly = online && !view && !!start;

  /* ---------- Audio and feedback driven by match state ---------- */

  const prevSecond = useRef<number | null>(null);
  useEffect(() => {
    if (!controller) return;
    if (elapsed < 0) {
      const n = Math.ceil(-elapsed / 1000);
      if (n !== prevSecond.current && n <= 3) {
        prevSecond.current = n;
        audio.countdown(false);
        haptic('tap');
      }
      return;
    }
    if (prevSecond.current !== null && prevSecond.current > 0 && elapsed >= 0 && elapsed < 1000) {
      prevSecond.current = 0;
      audio.countdown(true);
      haptic('place');
    }
    const secLeft = Math.ceil(remaining / 1000);
    if (remaining <= FINAL_SECONDS_MS && remaining > 0 && secLeft !== prevSecond.current) {
      prevSecond.current = secLeft;
      audio.tick(secLeft <= 3);
    }
  }, [elapsed, remaining, controller]);

  const prevSurge = useRef(false);
  const prevWarn = useRef(false);
  useEffect(() => {
    if (surge && !prevSurge.current) {
      audio.surgeStart();
      haptic('big');
    }
    if (!surge && prevSurge.current) audio.surgeEnd();
    prevSurge.current = surge;
    if (surgeWarning && !prevWarn.current) audio.surgeWarning();
    prevWarn.current = !!surgeWarning;
    audio.setIntensity(surge ? 1 : remaining < 30_000 && elapsed > 0 ? 0.6 : 0.2);
  }, [surge, surgeWarning, remaining, elapsed]);

  const prevScore = useRef(0);
  useEffect(() => {
    if (!view) return;
    if (view.score > prevScore.current) {
      setScoreBump(true);
      const t = setTimeout(() => setScoreBump(false), 340);
      prevScore.current = view.score;
      return () => clearTimeout(t);
    }
    prevScore.current = view.score;
    return undefined;
  }, [view?.score]);

  // Rank changes: overtakes and being passed.
  const prevRank = useRef<number | null>(null);
  useEffect(() => {
    if (!me || !online) return;
    const r = me.rank;
    if (prevRank.current !== null && elapsed > 0 && me.alive) {
      // Only climbing is announced; the rank chip already shows drops.
      if (r < prevRank.current) {
        audio.overtake();
        setRankUp(true);
        setTimeout(() => setRankUp(false), 650);
        if (r === 1) toast('You took the lead', 'good', 1500);
      }
    }
    prevRank.current = r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.rank]);

  // Opponent eliminations.
  const aliveMap = useRef(new Map<string, boolean>());
  useEffect(() => {
    for (const o of opponents) {
      const was = aliveMap.current.get(o.state.id);
      if (was === true && !o.state.alive) {
        audio.opponentOut();
        haptic('warn');
        const why = o.state.eliminationReason === 'disconnected' ? 'disconnected' : o.state.eliminationReason === 'left' ? 'left the match' : 'was eliminated';
        toast(`${o.nickname} ${why}`, 'warn');
      }
      aliveMap.current.set(o.state.id, o.state.alive);
    }
  }, [opponents]);

  // Danger heartbeat during Last Chance.
  const lastChance = view?.lastChanceUntil ?? null;
  useEffect(() => {
    if (lastChance === null || !view?.alive) return;
    audio.danger();
    haptic('warn');
    const id = setInterval(() => audio.danger(), 1000);
    return () => clearInterval(id);
  }, [lastChance, view?.alive]);

  // Leave the game screen for results shortly after the match ends.
  useEffect(() => {
    if (!online || !results) return;
    const won = results.winnerId === playerId;
    if (results.rows.some((r) => r.id === playerId)) {
      if (won) {
        audio.victory();
        haptic('win');
      } else audio.defeat();
    }
    const t = setTimeout(() => go('results'), 1800);
    return () => clearTimeout(t);
  }, [results, online, playerId]);

  // Practice end.
  const [practiceOver, setPracticeOver] = useState(false);
  useEffect(() => {
    if (!(controller instanceof LocalController)) return;
    controller.onEnd = () => {
      setPracticeOver(true);
      const s = controller.state.score;
      if (s > settings.get().bestPractice) settings.set({ bestPractice: s });
    };
  }, [controller]);

  const danger = view ? dangerLevel({ ...emptyState, board: view.board, tray: view.tray, alive: view.alive, lastChanceUntil: view.lastChanceUntil }) : 0;
  const mode = useMemo(() => ({ surge: surge && !!view?.alive, danger, eliminated: !!view && !view.alive }), [surge, danger, view?.alive]);

  const timerClass = ['timer', remaining <= FINAL_SECONDS_MS && elapsed >= 0 && remaining > 0 && 'final'].filter(Boolean).join(' ');
  const solo = !online;
  const rank = me?.rank ?? 1;
  const total = Object.keys(players).length;

  const leave = async () => {
    setMenu(false);
    if (online) await leaveRoom();
    else go('home');
  };

  return (
    <div className={`game${solo ? ' solo' : ''}`}>
      <header className="hud">
        <div className="hud-left">
          <div className="score-block">
            <span className="eyebrow">{solo ? 'Practice' : 'Score'}</span>
            <AnimatedNumber className={`score-value${scoreBump ? ' bump' : ''}`} value={view?.score ?? me?.score ?? 0} />
          </div>
          {online && total > 1 && (
            <span className={`rank-chip${rankUp ? ' up' : ''}`} aria-label={`Rank ${rank} of ${total}`}>
              {rank}
              <small>/{total}</small>
            </span>
          )}
        </div>
        <div className={timerClass} role="timer" aria-label={`${formatClock(remaining)} remaining`}>
          <span className="timer-value">{elapsed < 0 ? formatClock(durationMs) : formatClock(remaining)}</span>
          <div className="surge-track" aria-hidden="true">
            <div className="elapsed" style={{ width: `${Math.min(100, (Math.max(0, elapsed) / durationMs) * 100)}%` }} />
            {surges.map((w) => (
              <div key={w.start} className="window" style={{ left: `${(w.start / durationMs) * 100}%`, width: `${((w.end - w.start) / durationMs) * 100}%` }} />
            ))}
          </div>
        </div>
        <div className="hud-right">
          <button className="icon-btn" aria-label="Menu" onClick={() => setMenu(true)}>
            <IconSettings />
          </button>
        </div>
      </header>

      <main className="main">
        <div className="status-row">
          <span className={`chain${(view?.chain ?? 0) >= 1 ? ' live' : ''}`} aria-live="polite">
            {(view?.chain ?? 0) >= 1 ? `Chain ${view!.chain}` : 'No chain'}
            {(view?.chain ?? 0) >= 1 && (
              <span className="misses" aria-label={`${CHAIN_MISS_LIMIT - (view?.misses ?? 0)} misses left`}>
                {Array.from({ length: CHAIN_MISS_LIMIT - 1 }, (_, i) => (
                  <i key={i} className={(view?.misses ?? 0) > i ? 'used' : ''} />
                ))}
              </span>
            )}
          </span>
          {(surge || surgeWarning) && view?.alive && (
            <span className={`surge-pill${surge ? '' : ' warning'}`} role="status">
              {surge ? 'Surge x2' : `Surge in ${Math.ceil(((nextSurge?.start ?? 0) - elapsed) / 1000)}`}
            </span>
          )}
          <span className="cycle-pips" aria-label={`${view?.placedThisCycle ?? 0} of 2 placed this round`}>
            <span className="pips-label">Place 2 of 3</span>
            <i className={(view?.placedThisCycle ?? 0) >= 1 ? 'on' : ''} />
            <i className={(view?.placedThisCycle ?? 0) >= 2 ? 'on' : ''} />
          </span>
        </div>

        {controller && view ? (
          <PlayField controller={controller} view={view} mode={mode} />
        ) : spectatorOnly ? (
          <div className="board-wrap">
            <div className="state-card">
              <h2>Spectating</h2>
              <p className="muted">You are watching this match. You can join the next one from the lobby.</p>
            </div>
          </div>
        ) : (
          <div className="board-wrap">
            <div className="load-bar" />
          </div>
        )}

        <div className="board-overlay" aria-live="assertive">
          {elapsed < 0 && controller && (
            <div className="countdown-num" key={Math.ceil(-elapsed / 1000)}>
              {Math.ceil(-elapsed / 1000)}
            </div>
          )}
          {elapsed >= 0 && elapsed < 700 && controller && <div className="countdown-num">Go</div>}
          {view && !view.alive && !results && !practiceOver && (
            <div className="state-card out">
              <h2>Eliminated</h2>
              <p className="muted">
                No piece fits. Final score <b className="num">{view.score.toLocaleString('en-US')}</b>
                {online && total > 1 ? `, currently ${ordinal(rank)} of ${total}.` : '.'}
              </p>
              {online && opponents.some((o) => o.state.alive) && <p className="muted">Watch the rest of the match on the right.</p>}
              {!online && (
                <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={onRestart}>
                  Play Again
                </button>
              )}
            </div>
          )}
          {online && results && (
            <div className="state-card">
              <h2>{results.reason === 'time' ? 'Time' : 'Match Over'}</h2>
              <p className="muted">{results.winnerId === playerId ? 'You won.' : `${names.get(results.winnerId) ?? 'A player'} won.`}</p>
            </div>
          )}
          {practiceOver && (
            <div className="state-card">
              <h2>{view?.alive ? 'Time' : 'Eliminated'}</h2>
              <p className="muted">
                Score <b className="num">{(view?.score ?? 0).toLocaleString('en-US')}</b>. Best <b className="num">{settings.get().bestPractice.toLocaleString('en-US')}</b>.
              </p>
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button className="btn" onClick={() => go('home')}>
                  Home
                </button>
                <button className="btn btn-primary" onClick={onRestart}>
                  Play Again
                </button>
              </div>
            </div>
          )}
        </div>
        {view?.alive && view.lastChanceUntil !== null && (
          <div className="last-chance" role="alert">
            No piece fits. Use Pulse within {Math.max(0, Math.ceil((view.lastChanceUntil - elapsed) / 1000))}s
          </div>
        )}
      </main>

      {online && (
        <aside className="rail" role="list" aria-label="Opponents">
          <span className="eyebrow panel-title">Opponents</span>
          {opponents.map((o) => (
            <div key={o.state.id} onClick={() => setSheet(true)}>
              <OpponentCard info={o} compact />
            </div>
          ))}
          {opponents.length > 0 && (
            <button className="rail-expand" aria-label="Expand opponents" onClick={() => setSheet(true)}>
              <IconExpand size={18} />
            </button>
          )}
        </aside>
      )}

      {sheet && (
        <div className="overlay" onClick={() => setSheet(false)}>
          <div className="sheet panel" onClick={(e) => e.stopPropagation()}>
            <div className="screen-head" style={{ marginBottom: 8 }}>
              <h2 className="screen-title" style={{ fontSize: 20 }}>
                Opponents
              </h2>
              <button className="icon-btn" aria-label="Close" onClick={() => setSheet(false)}>
                <IconClose />
              </button>
            </div>
            <div className="opp-sheet" role="list">
              {opponents.map((o) => (
                <OpponentCard key={o.state.id} info={o} />
              ))}
            </div>
          </div>
        </div>
      )}

      {menu && (
        <div className="overlay" onClick={() => setMenu(false)}>
          <div className="sheet panel" onClick={(e) => e.stopPropagation()}>
            <div className="screen-head">
              <h2 className="screen-title" style={{ fontSize: 20 }}>
                {online ? 'Match' : 'Practice'}
              </h2>
              <button className="icon-btn" aria-label="Close" onClick={() => setMenu(false)}>
                <IconClose />
              </button>
            </div>
            <p className="muted" style={{ marginTop: 4 }}>
              {online ? 'The match keeps running while this menu is open. Leaving now counts as a forfeit.' : 'Practice is solo and offline. Scores here are not ranked.'}
            </p>
            <div className="seats">
              <button
                className="btn btn-block"
                onClick={() => {
                  setMenu(false);
                  app.set({ settingsOpen: true });
                }}
              >
                Settings
              </button>
              <button className="btn btn-danger btn-block" onClick={() => void leave()}>
                {online ? 'Leave Match' : 'Quit Practice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const emptyState = {
  board: [] as number[],
  tray: [] as (string | null)[],
  cycle: 0,
  placedThisCycle: 0,
  swapsThisCycle: 0,
  score: 0,
  lines: 0,
  placements: 0,
  chain: 0,
  bestChain: 0,
  misses: 0,
  pulse: 0,
  pulseSpent: 0,
  staticCount: 0,
  lastActionAt: 0,
  nextStaticAt: 0,
  lastChanceUntil: null as number | null,
  alive: true,
  eliminatedAt: null,
  eliminationReason: null,
  scoreReachedAt: 0,
};

