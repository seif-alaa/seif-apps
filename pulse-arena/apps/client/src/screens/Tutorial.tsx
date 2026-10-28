import { useEffect, useMemo, useReducer, useState } from 'react';
import { PULSE_COST, emptyBoard, idx } from '@pulse/engine';
import { audio } from '../audio/audio';
import { go } from '../lib/app';
import { settings } from '../lib/settings';
import { LocalController } from '../game/controller';
import { PlayField } from '../game/PlayField';
import { IconClose } from '../ui/icons';

interface Step {
  title: string;
  body: string;
  setup: (c: LocalController) => void;
  done: (c: LocalController) => boolean;
}

function rowBoard(row: number, gaps: number[]): number[] {
  const b = emptyBoard();
  for (let c = 0; c < 9; c++) if (!gaps.includes(c)) b[idx(c, row)] = 5;
  return b;
}

const STEPS: Step[] = [
  {
    title: 'Drag to place',
    body: 'Drag a piece onto the board. Fill a whole row or column to clear it.',
    setup: (c) => c.setup(rowBoard(7, [3, 4, 5]), ['hook3a', 'rod3a', 'mote']),
    done: (c) => c.state.lines >= 1,
  },
  {
    title: 'Place two of three',
    body: 'Each round offers three pieces. Place any two and the third is discarded. Choose the one to skip.',
    setup: () => undefined,
    done: (c) => c.state.cycle >= 1,
  },
  {
    title: 'Chains and Pulse',
    body: 'Clearing on back-to-back moves builds a chain for bonus points and charges Pulse. Tap Pulse, then a piece, to replace it.',
    setup: (c) => {
      const b = rowBoard(4, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
      for (let r = 0; r < 9; r++) for (let col = 0; col < 9; col++) if ((r + col) % 3 === 0) b[idx(col, r)] = 8;
      c.setup(b, ['slab9', 'rod5a', 'mote'], { pulse: PULSE_COST, swapsThisCycle: 0, placedThisCycle: 0 });
    },
    done: (c) => c.state.swapsThisCycle >= 1,
  },
  {
    title: 'Survive and score',
    body: 'When no piece fits, you are out. When time runs out, the highest score among players still in wins. Surge windows double clear points. Idle boards collect Static.',
    setup: () => undefined,
    done: () => false,
  },
];

export function TutorialScreen() {
  const controller = useMemo(() => new LocalController({ kind: 'tutorial', durationMs: 3_600_000, timers: false, seed: 4242 }), []);
  const [step, setStep] = useState(0);
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => controller.subscribe(force), [controller]);
  useEffect(() => () => controller.dispose(), [controller]);
  useEffect(() => {
    STEPS[step]!.setup(controller);
  }, [step, controller]);
  useEffect(() => {
    if (step < STEPS.length - 1 && STEPS[step]!.done(controller)) {
      const t = setTimeout(() => {
        audio.pulseReady();
        setStep((s) => s + 1);
      }, 650);
      return () => clearTimeout(t);
    }
    return undefined;
  });

  const finish = () => {
    settings.set({ tutorialDone: true });
    audio.ui();
    go('home');
  };

  const s = STEPS[step]!;
  const view = controller.view();
  return (
    <div className="game solo">
      <header className="hud" style={{ gridTemplateColumns: '1fr auto' }}>
        <div className="coach" role="status" aria-live="polite">
          <span className="step">
            {step + 1} / {STEPS.length}
          </span>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
        </div>
        <button className="icon-btn" aria-label="Close tutorial" onClick={finish}>
          <IconClose />
        </button>
      </header>
      <main className="main">
        <PlayField controller={controller} view={view} mode={{ surge: false, danger: 0, eliminated: false }} allowSwap={step >= 2} />
        {step === STEPS.length - 1 && (
          <button className="btn btn-primary btn-block" style={{ maxWidth: 420 }} onClick={finish}>
            Got It
          </button>
        )}
      </main>
    </div>
  );
}
