import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getStandings, newGame, playRound } from '../engine/index.ts';
import type { ClubDef, GameState } from '../engine/index.ts';
import { fixedIdentitySource } from '../engine/testing/identity.ts';
import { testParams } from '../engine/testing/params.ts';

/*
 * Report of the fans thermometer and of the season with the morale between rounds (T-014),
 * against docs/design/torcida.md ("Simulação": mean 50 to 60, at most 5% of the rounds below 20
 * and at most 5% above 90) and the season targets of balance-targets.md (champion 72 to 82
 * points, 17th 39 to 45 since the CEO's decision of 2026-11-05, 2.5 to 2.8 goals per match).
 * It only REPORTS: tuning is the /balance's (T-016), so the assertions are sanity bounds far
 * outside the targets.
 *
 * The full report (100 seasons: careers with seeds 1..100, season 1 each, the 20 real clubs, the
 * 38 rounds by the AI through playRound) runs only with `FANS_METRICS=1`:
 * `FANS_METRICS=1 npm test -w app -- --silent=false src/data/fans-metrics.test.ts`. Without it,
 * 2 seasons check the same bounds. Every club's thermometer after every round is one sample.
 */
const clubs = JSON.parse(
  readFileSync(new URL('./clubs.serie-a.json', import.meta.url), 'utf8'),
) as ClubDef[];
const params = testParams();
const FULL = process.env.FANS_METRICS === '1';
const SEASONS = FULL ? 100 : 2;

function season(seed: number) {
  const created = newGame(
    { seed, year: 2026, realism: 'full' },
    clubs,
    params,
    fixedIdentitySource(),
  );
  if (!created.ok) throw new Error('newGame failed');
  let state: GameState = created.value;
  const fans: number[] = [];
  let goals = 0;
  for (let round = 1; round <= 38; round++) {
    const played = playRound(state, params, { round, sheets: {}, commands: {}, fanDecisions: {} });
    if (!played.ok) throw new Error(`playRound ${round}: ${played.error}`);
    state = played.value.state;
    for (const club of Object.values(state.clubs)) fans.push(club.fans);
    for (const r of played.value.report.results) goals += r.score[0] + r.score[1];
  }
  const table = getStandings(state);
  const morale = Object.values(state.players).map((p) => p.morale);
  return {
    fans,
    goals,
    champion: table[0]!.points,
    seventeenth: table[16]!.points,
    finalFans: Object.values(state.clubs).map((c) => c.fans),
    morale,
  };
}

const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const sd = (xs: readonly number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
};
const pct = (n: number, of: number) => `${((100 * n) / of).toFixed(1)}%`;

describe('T-014 report: the fans thermometer and the season with the morale', () => {
  it(`${SEASONS} seasons with the 20 real clubs`, { timeout: 900_000 }, () => {
    const fans: number[] = [];
    const finalFans: number[] = [];
    const morale: number[] = [];
    const champions: number[] = [];
    const seventeenths: number[] = [];
    let goals = 0;
    for (let seed = 1; seed <= SEASONS; seed++) {
      const r = season(seed);
      fans.push(...r.fans);
      finalFans.push(...r.finalFans);
      morale.push(...r.morale);
      champions.push(r.champion);
      seventeenths.push(r.seventeenth);
      goals += r.goals;
    }
    const below20 = fans.filter((f) => f < 20).length;
    const above90 = fans.filter((f) => f > 90).length;
    const matches = SEASONS * 380;
    console.info(
      `[T-014 fans] ${SEASONS} seasons, ${fans.length} club-rounds: mean ${mean(fans).toFixed(1)}, sd ${sd(fans).toFixed(1)}, below 20 ${pct(below20, fans.length)}, above 90 ${pct(above90, fans.length)} (torcida.md: mean 50 to 60, at most 5% each); at the end of the season mean ${mean(finalFans).toFixed(1)}, min ${Math.min(...finalFans).toFixed(1)}, max ${Math.max(...finalFans).toFixed(1)}\n` +
        `[T-014 season] goals per match ${(goals / matches).toFixed(3)} (2.5 to 2.8); champion ${mean(champions).toFixed(1)} pts (${Math.min(...champions)} to ${Math.max(...champions)}; 72 to 82); 17th ${mean(seventeenths).toFixed(1)} pts (${Math.min(...seventeenths)} to ${Math.max(...seventeenths)}; 39 to 45); final morale mean ${mean(morale).toFixed(1)}, sd ${sd(morale).toFixed(1)}`,
    );
    for (const f of fans) {
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(100);
    }
    expect(mean(fans)).toBeGreaterThan(35);
    expect(mean(fans)).toBeLessThan(75);
    expect(below20 / fans.length).toBeLessThan(0.2);
    expect(above90 / fans.length).toBeLessThan(0.2);
    expect(goals / matches).toBeGreaterThan(2);
    expect(goals / matches).toBeLessThan(3.3);
  });
});
