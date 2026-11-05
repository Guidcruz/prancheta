import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { newGame, teamStrength } from '../engine/index.ts';
import { homeAdvantage, sectorStrengths } from '../engine/strength.ts';
import type { ClubDef, GameState } from '../engine/index.ts';
import { bestEleven } from '../engine/generation.ts';
import { fixedIdentitySource } from '../engine/testing/identity.ts';
import { testParams } from '../engine/testing/params.ts';

/*
 * QA of T-008 with the 20 real clubs of the game (US-007, US-026): displayed strength sanity,
 * determinism of the strengths for a seed, and the home advantage formula of partida.md.
 */
const clubs = JSON.parse(
  readFileSync(new URL('./clubs.serie-a.json', import.meta.url), 'utf8'),
) as ClubDef[];
const params = testParams();

function start(seed: number): GameState {
  const result = newGame(
    { seed, year: 2026, realism: 'full' },
    clubs,
    params,
    fixedIdentitySource(),
  );
  if (!result.ok) throw new Error('newGame failed');
  return result.value;
}

function allStrengths(state: GameState) {
  return Object.values(state.clubs).map((club) => {
    const squad = state.squads[club.def.id]!.map((id) => state.players[id]!);
    const formation = club.preferredFormations[0];
    const starters = bestEleven(squad, formation).map(({ player }) => player.id);
    const sheet = {
      lineup: { formation, starters },
      tactic: { posture: 'balanced', pressure: 'medium' },
    } as const;
    const home = sectorStrengths(
      squad,
      sheet,
      { home: homeAdvantage({ fans: club.fans, derby: false }, params) },
      params,
    );
    return { id: club.def.id, shown: teamStrength(state, club.def.id), sectors: home };
  });
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
    syy += (ys[i]! - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

describe('T-008 with the 20 real clubs', () => {
  it('displayed strength is within 55..85 and follows the strength field of the data (clubStrengthSd 1.5)', () => {
    const state = start(20261104);
    const rows = Object.values(state.clubs).map((club) => ({
      id: club.def.id,
      data: clubs.find((c) => c.id === club.def.id)!.strength!,
      shown: teamStrength(state, club.def.id)!,
    }));
    expect(rows).toHaveLength(20);
    for (const r of rows) {
      expect(r.shown, r.id).toBeGreaterThanOrEqual(55);
      expect(r.shown, r.id).toBeLessThanOrEqual(85);
      expect(Math.abs(r.shown - r.data), r.id).toBeLessThanOrEqual(4);
    }
    const r = pearson(
      rows.map((x) => x.data),
      rows.map((x) => x.shown),
    );
    expect(r).toBeGreaterThan(0.9);
    const sorted = [...rows].sort((a, b) => a.shown - b.shown);
    console.info(
      `[QA T-008] r=${r.toFixed(4)} min=${sorted[0]!.id} ${sorted[0]!.shown.toFixed(2)} (data ${sorted[0]!.data}) max=${sorted.at(-1)!.id} ${sorted.at(-1)!.shown.toFixed(2)} (data ${sorted.at(-1)!.data})`,
    );
  });

  it('is deterministic: the same seed gives the same strengths in two runs, another seed differs', () => {
    const a = allStrengths(start(777));
    const b = allStrengths(start(777));
    expect(b).toEqual(a);
    const c = allStrengths(start(778));
    expect(c).not.toEqual(a);
  });

  it('home advantage matches partida.md for thermometers 0, 50 and 100, with and without derby', () => {
    // home = homeBase + homeBonusMin + (homeBonusMax - homeBonusMin) × t / 100 (+ derbyBonus)
    const expected = (t: number, derby: boolean) =>
      0.05 + 0.02 + 0.06 * (t / 100) + (derby ? 0.02 : 0);
    for (const t of [0, 50, 100]) {
      for (const derby of [false, true]) {
        expect(homeAdvantage({ fans: t, derby }, params), `t=${t} derby=${derby}`).toBeCloseTo(
          expected(t, derby),
          12,
        );
      }
    }
    expect(homeAdvantage({ fans: 0, derby: false }, params)).toBeCloseTo(0.07, 12);
    expect(homeAdvantage({ fans: 50, derby: false }, params)).toBeCloseTo(0.1, 12);
    expect(homeAdvantage({ fans: 100, derby: false }, params)).toBeCloseTo(0.13, 12);
    expect(homeAdvantage({ fans: 100, derby: true }, params)).toBeCloseTo(0.15, 12);
  });
});
