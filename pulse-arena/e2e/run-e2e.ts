/**
 * Real multi-browser end-to-end test.
 *
 * Starts the actual game server and web client, opens N independent browser
 * contexts (each with its own storage, so each is a separate guest identity),
 * creates a private room through the UI, joins it from the other browsers
 * using the room code, readies up, starts the match and then plays it by
 * dragging pieces with the mouse. Nothing is simulated on the server side.
 *
 * Verifies that every browser sees the same opponents' boards and scores as
 * the server holds them, and that all browsers agree on the final standings.
 *
 * Usage: npx tsx e2e/run-e2e.ts [players=2] [--headed] [--seconds=20]
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { chooseMove, createPlayerState, decodeBoard, getPiece } from '@pulse/engine';
import type { MatchResults, PublicPlayerState, SelfState } from '@pulse/protocol';

const root = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const players = Number(args.find((a) => /^\d+$/.test(a)) ?? 2);
const headed = args.includes('--headed');
const seconds = Number(args.find((a) => a.startsWith('--seconds='))?.split('=')[1] ?? 20);
const SERVER_PORT = 8790;
const CLIENT_PORT = 5180;
const shots = join(root, 'test-results/e2e');
mkdirSync(shots, { recursive: true });

const procs: ChildProcess[] = [];
function start(cmd: string, argv: string[], cwd: string, env: Record<string, string>, ready: RegExp): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    procs.push(p);
    const timer = setTimeout(() => reject(new Error(`${cmd} did not start`)), 30_000);
    const onData = (d: Buffer) => {
      if (ready.test(d.toString())) {
        clearTimeout(timer);
        resolve();
      }
    };
    p.stdout!.on('data', onData);
    p.stderr!.on('data', (d: Buffer) => {
      const s = d.toString();
      if (/error/i.test(s) && !/ExperimentalWarning|ws proxy/.test(s)) process.stderr.write(`[${argv[0]}] ${s}`);
      onData(d);
    });
  });
}

function cleanup() {
  for (const p of procs) p.kill('SIGTERM');
}
process.on('exit', cleanup);

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

type Snapshot = {
  playerId: string | null;
  self: SelfState | null;
  players: Record<string, PublicPlayerState>;
  results: MatchResults | null;
  phase: string | null;
  screen: string;
};

async function snap(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const h = (window as unknown as { __pulse: { app: { get(): any }; matchStore: { get(): any } } }).__pulse;
    const a = h.app.get();
    const m = h.matchStore.get();
    return { playerId: a.playerId, self: m.self, players: m.players, results: a.results, phase: a.room?.phase ?? null, screen: a.screen };
  });
}

async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, label: string, timeout = 15_000): Promise<T> {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > timeout) throw new Error(`Timed out: ${label}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** Perform one real mouse drag of the best legal move. Returns false if none. */
async function playOne(page: Page, s: SelfState, skill: number): Promise<boolean> {
  const st = createPlayerState(0);
  st.board = decodeBoard(s.board);
  st.tray = s.tray.slice();
  // Different heuristic noise per client so the players genuinely diverge.
  const mv = chooseMove(st, Math.random, skill);
  if (!mv) return false;
  const piece = getPiece(s.tray[mv.slot]!);
  const slot = page.locator('.tray-slot').nth(mv.slot);
  const sb = await slot.boundingBox();
  const board = await page.locator('.board-canvas').boundingBox();
  if (!sb || !board) return false;
  // Grab the piece at its visual center; drop so its center lands on the target cells.
  const size = board.width;
  const pad = Math.round(size * 0.024);
  const cell = (size - pad * 2) / 9;
  const fromX = sb.x + sb.width / 2;
  const fromY = sb.y + sb.height / 2;
  const toX = board.x + pad + (mv.col + piece.w / 2) * cell;
  const toY = board.y + pad + (mv.row + piece.h / 2) * cell;
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.mouse.move((fromX + toX) / 2, (fromY + toY) / 2, { steps: 4 });
  await page.mouse.move(toX, toY, { steps: 4 });
  await page.mouse.up();
  return true;
}

async function main() {
  console.log(`E2E: ${players} real browser clients, ${seconds}s match`);
  const node = process.execPath;
  await start(node, [join(root, 'node_modules/tsx/dist/cli.mjs'), 'src/index.ts'], join(root, 'apps/server'), { PORT: String(SERVER_PORT), MATCH_DURATION_SEC: String(seconds), CORS_ORIGINS: '*' }, /server\.listening/);
  await start(node, [join(root, 'node_modules/vite/bin/vite.js'), '--port', String(CLIENT_PORT), '--strictPort'], join(root, 'apps/client'), { PULSE_SERVER: `http://localhost:${SERVER_PORT}` }, /ready in/);

  const browser = await chromium.launch({ headless: !headed });
  const pages: Page[] = [];
  const errors: string[] = [];
  for (let i = 0; i < players; i++) {
    const ctx = await browser.newContext({ viewport: i % 2 ? { width: 420, height: 860 } : { width: 1280, height: 800 }, hasTouch: false });
    await ctx.addInitScript((name: string) => {
      localStorage.setItem('pulse.settings.v1', JSON.stringify({ tutorialDone: true, nickname: name, muted: true }));
    }, ['Ana', 'Ben', 'Cleo', 'Dev', 'Eli'][i]!);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`page ${i}: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`console ${i}: ${m.text()}`));
    await page.goto(`http://localhost:${CLIENT_PORT}/`);
    pages.push(page);
  }
  for (const p of pages) await p.getByRole('button', { name: 'Private Match' }).waitFor();

  // Host creates a room through the UI.
  const host = pages[0]!;
  await host.getByRole('button', { name: 'Private Match' }).click();
  await host.locator('.code .code-cell').first().waitFor();
  const code = (await host.locator('.panel .code .code-cell').allInnerTexts()).join('');
  assert(/^[A-Z0-9]{5}$/.test(code), `room code ${code}`);
  console.log(`Room created: ${code}`);

  // Everyone else joins by typing the code.
  for (const p of pages.slice(1)) {
    await p.getByRole('button', { name: 'Join Room' }).click();
    await p.getByLabel('Room code').fill(code);
    await p.getByRole('button', { name: 'Join', exact: true }).click();
    await p.getByRole('button', { name: 'Ready' }).click();
  }
  await waitFor(async () => (await host.locator('.badge.ready').count()) === players, 'all ready');
  await host.screenshot({ path: join(shots, `lobby-${players}p.png`) });
  await host.getByRole('button', { name: 'Start Match' }).click();

  // Countdown, then everyone plays.
  await Promise.all(pages.map((p) => waitFor(async () => (await snap(p)).phase === 'playing', 'playing', 10_000)));
  console.log('Match started on all clients');
  let moves = 0;
  let midShot = false;
  const t0 = Date.now();
  while (Date.now() - t0 < (seconds + 8) * 1000) {
    const snaps = await Promise.all(pages.map(snap));
    if (snaps.every((s) => s.results)) break;
    await Promise.all(
      pages.map(async (p, i) => {
        const s = snaps[i]!;
        if (!s.self?.alive || s.results || s.self.tray.every((t) => !t)) return;
        if (await playOne(p, s.self, i * 45)) moves++;
      }),
    );
    if (!midShot && Date.now() - t0 > (seconds * 1000) / 2) {
      midShot = true;
      await Promise.all(pages.map((p, i) => p.screenshot({ path: join(shots, `match-${players}p-client${i}.png`) })));
      // Live sync check: what each browser shows for every opponent equals that opponent's own state.
      await new Promise((r) => setTimeout(r, 400));
      const now = await Promise.all(pages.map(snap));
      for (const viewer of now) {
        for (const other of now) {
          if (other.playerId === viewer.playerId) continue;
          const shown = viewer.players[other.playerId!];
          assert(shown, 'opponent visible');
          assert(shown.board === other.self!.board, `board of ${other.playerId} synced to ${viewer.playerId}`);
          assert(shown.score === other.self!.score, 'score synced');
        }
      }
      console.log('Mid-match sync verified: every client sees identical opponent boards and scores');
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  const finals = await Promise.all(pages.map((p) => waitFor(async () => (await snap(p)).results, 'results', 20_000)));
  const order = finals[0]!.rows.map((r) => r.id).join(',');
  for (const f of finals) assert(f.rows.map((r) => r.id).join(',') === order, 'all clients agree on standings');
  assert(finals[0]!.winnerId === finals[0]!.rows[0]!.id, 'winner ranks first');
  const survivors = finals[0]!.rows.filter((r) => r.alive);
  if (finals[0]!.reason === 'time' && survivors.length) {
    const best = Math.max(...survivors.map((r) => r.score));
    assert(finals[0]!.rows[0]!.score === best, 'highest surviving score wins');
  }
  await Promise.all(pages.map((p) => waitFor(async () => (await snap(p)).screen === 'results', 'results screen', 8000)));
  await Promise.all(pages.map((p, i) => p.screenshot({ path: join(shots, `results-${players}p-client${i}.png`) })));

  console.log(`Moves played through the UI: ${moves}`);
  console.log(`Outcome: ${finals[0]!.reason}, winner ${finals[0]!.rows[0]!.nickname} with ${finals[0]!.rows[0]!.score}`);
  for (const r of finals[0]!.rows) console.log(`  ${r.rank}. ${r.nickname.padEnd(6)} ${String(r.score).padStart(5)}  ${r.alive ? 'survived' : `out (${r.eliminationReason})`}`);

  // Rematch flow: everyone returns to the lobby with fresh state.
  await pages[1]!.getByRole('button', { name: 'Rematch' }).click();
  await waitFor(async () => (await snap(host)).phase === 'lobby', 'rematch lobby');
  console.log('Rematch returned the room to the lobby');

  const relevant = errors.filter((e) => !/favicon|DevTools|Download the React/.test(e));
  if (relevant.length) {
    console.log('Browser errors:');
    for (const e of relevant) console.log(`  ${e}`);
    throw new Error('Browser reported errors');
  }
  await browser.close();
  console.log(`PASS: ${players}-player synchronized match through real browsers`);
}

main()
  .then(() => {
    cleanup();
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    cleanup();
    process.exit(1);
  });
