/**
 * Balance simulation: plays many matches with heuristic bots at different
 * skill levels and paces, then reports survival time, scores and Pulse use.
 * Usage: npx tsx scripts/simulate.ts [matches]
 */
import { canSwap, checkEnd, chooseMove, createMatch, createRng, matchPlace, matchSwap, matchTick, randomMove } from '@pulse/engine';

const MATCHES = Number(process.argv[2] ?? 200);
const profiles = [
  { name: 'careful', noise: 5, actEvery: 1800, random: 0 },
  { name: 'average', noise: 40, actEvery: 1300, random: 0.1 },
  { name: 'casual', noise: 120, actEvery: 1100, random: 0.3 },
];

for (const prof of profiles) {
  const survival: number[] = [];
  const scores: number[] = [];
  let swaps = 0;
  let statics = 0;
  let cycles = 0;
  let survivedFull = 0;
  for (let i = 0; i < MATCHES; i++) {
    const m = createMatch({ seed: i * 7919 + 1, durationMs: 180_000, players: [{ id: 'a', seat: 0 }, { id: 'b', seat: 1 }] });
    // Freeze 'b' so the match runs to time and 'a' is measured alone (b would otherwise be static-eliminated).
    const rand = createRng(i + 1);
    let next = 0;
    let now = 0;
    for (now = 0; now <= 180_000; now += 100) {
      matchTick(m, now);
      m.players.b!.nextStaticAt = Infinity;
      const s = m.players.a!;
      if (!s.alive) break;
      if (now < next) continue;
      next = now + prof.actEvery * (0.6 + rand() * 0.8);
      const mv = rand() < prof.random ? randomMove(s, rand) : chooseMove(s, rand, prof.noise);
      if (mv) matchPlace(m, 'a', mv.slot, mv.col, mv.row, now);
      else if (canSwap(s)) {
        const slot = s.tray.findIndex((p) => p !== null);
        if (matchSwap(m, 'a', slot, now).ok) swaps++;
      }
    }
    const s = m.players.a!;
    survival.push(s.alive ? 180 : (s.eliminatedAt ?? 0) / 1000);
    if (s.alive) survivedFull++;
    scores.push(s.score);
    statics += s.staticCount;
    cycles += s.cycle;
    void checkEnd;
  }
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
  console.log(
    `${prof.name.padEnd(8)} survive-full ${((survivedFull / MATCHES) * 100).toFixed(0)}%  median-survival ${med(survival).toFixed(0)}s  avg-score ${avg(scores).toFixed(0)}  cycles ${(cycles / MATCHES).toFixed(1)}  swaps/match ${(swaps / MATCHES).toFixed(2)}  static/match ${(statics / MATCHES).toFixed(1)}`,
  );
}
