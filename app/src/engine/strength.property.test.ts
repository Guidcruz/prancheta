import { describe, expect, it } from 'vitest';
import { FORMATIONS, FORMATION_SLOTS } from './formations.ts';
import { POSITIONS } from './players.ts';
import { Rng } from './rng.ts';
import {
  FORMATION_MULTIPLIERS,
  PRESSURE_EFFECTS,
  effectiveRating,
  homeAdvantage,
  postureEffect,
  sectorStrengths,
  teamStrength,
  type TeamStrengths,
} from './strength.ts';
import { testParams } from './testing/params.ts';
import { testPlayer, type MutablePlayer } from './testing/players.ts';
import type { Formation, Posture, Pressure } from './types.ts';

const params = testParams();
const POSTURES: readonly Posture[] = ['defensive', 'balanced', 'attacking', 'allOut'];
const PRESSURES: readonly Pressure[] = ['low', 'medium', 'high'];
const SEEDS = 1000;

/** A random team: any formation and tactic, any positions (so any fit), states in 0..100. */
function randomTeam(seed: number) {
  const rng = new Rng(seed);
  const formation = FORMATIONS[rng.int(0, FORMATIONS.length - 1)]!;
  const posture = POSTURES[rng.int(0, POSTURES.length - 1)]!;
  const pressure = PRESSURES[rng.int(0, PRESSURES.length - 1)]!;
  const players: MutablePlayer[] = FORMATION_SLOTS[formation].map((_slot, i) =>
    testPlayer({
      id: `clube-teste-01#${i + 1}`,
      shirt: i + 1,
      position: POSITIONS[rng.int(0, POSITIONS.length - 1)]!,
      overall: rng.int(1, 99),
      morale: rng.next() * 100,
      condition: rng.next() * 100,
    }),
  );
  return { rng, formation, posture, pressure, players };
}

function measure(
  players: readonly MutablePlayer[],
  formation: Formation,
  posture: Posture,
  pressure: Pressure,
  home = 0,
): TeamStrengths {
  const result = sectorStrengths(
    players,
    { lineup: { formation, starters: players.map((p) => p.id) }, tactic: { posture, pressure } },
    { home },
    params,
  );
  if (!result.ok) throw new Error(JSON.stringify(result.detail));
  return result.value;
}

const KEYS = ['goalkeeper', 'def', 'mid', 'atk', 'power', 'defense'] as const;

function expectNotBelow(after: TeamStrengths, before: TeamStrengths, label: string) {
  for (const key of KEYS) expect(after[key], `${label} ${key}`).toBeGreaterThanOrEqual(before[key]);
}

describe('strength (property, 1,000 seeds)', () => {
  it('is monotonic in morale: raising one player never lowers any strength', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { rng, formation, posture, pressure, players } = randomTeam(seed * 7919);
      const before = measure(players, formation, posture, pressure);
      const i = rng.int(0, players.length - 1);
      const raised = players.map((p, j) =>
        j === i ? { ...p, morale: p.morale + rng.next() * (100 - p.morale) } : p,
      );
      expectNotBelow(measure(raised, formation, posture, pressure), before, `seed ${seed}`);
    }
  });

  it('is monotonic in energy: raising one player never lowers any strength', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { rng, formation, posture, pressure, players } = randomTeam(seed * 104729);
      const before = measure(players, formation, posture, pressure);
      const i = rng.int(0, players.length - 1);
      const raised = players.map((p, j) =>
        j === i ? { ...p, condition: p.condition + rng.next() * (100 - p.condition) } : p,
      );
      expectNotBelow(measure(raised, formation, posture, pressure), before, `seed ${seed}`);
    }
  });

  it('a whole team with higher morale and energy is strictly stronger in every sector', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { formation, posture, pressure, players } = randomTeam(seed * 15485863);
      const low = players.map((p) => ({ ...p, morale: 10, condition: 30 }));
      const high = players.map((p) => ({ ...p, morale: 90, condition: 95 }));
      const a = measure(low, formation, posture, pressure);
      const b = measure(high, formation, posture, pressure);
      for (const key of KEYS) expect(b[key], `seed ${seed} ${key}`).toBeGreaterThan(a[key]);
    }
  });

  it('stays within the limits of the formulas', () => {
    // eff ∈ [0.40 × overall × 0.95 × 0.80, overall × 1.05]; sectors ∈ [0, 99 × 1.05 × the
    // largest multipliers × T]. With the home bonus at most homeBase + max + derby.
    const maxHome = homeAdvantage({ fans: 100, derby: true }, params);
    const maxEff = 99 * 1.05;
    const maxShape = Math.max(
      ...FORMATIONS.flatMap((f) => Object.values(FORMATION_MULTIPLIERS[f])),
    );
    const maxPressure = Math.max(...PRESSURES.map((p) => PRESSURE_EFFECTS[p].mid));
    const maxPosture = Math.max(
      ...POSTURES.flatMap((p) => {
        const effect = postureEffect(p, params.match);
        return [effect.power, effect.def];
      }),
    );
    const ceiling = maxEff * maxShape * maxPressure * maxPosture * (1 + maxHome);
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { rng, formation, posture, pressure, players } = randomTeam(seed * 32452843);
      FORMATION_SLOTS[formation].forEach((slot, i) => {
        const p = players[i]!;
        const eff = effectiveRating(p, slot);
        expect(eff).toBeGreaterThanOrEqual(0.4 * p.overall * 0.95 * 0.8 - 1e-9);
        expect(eff).toBeLessThanOrEqual(p.overall * 1.05 + 1e-9);
      });
      const home = homeAdvantage({ fans: rng.next() * 100, derby: rng.next() < 0.5 }, params);
      expect(home).toBeGreaterThanOrEqual(0.07 - 1e-12);
      expect(home).toBeLessThanOrEqual(maxHome);
      const s = measure(players, formation, posture, pressure, home);
      for (const key of KEYS) {
        expect(Number.isFinite(s[key]), `seed ${seed} ${key}`).toBe(true);
        expect(s[key]).toBeGreaterThan(0);
        expect(s[key]).toBeLessThanOrEqual(ceiling);
      }
    }
  });

  it('home advantage is never a disadvantage, and the derby always adds', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { rng, formation, posture, pressure, players } = randomTeam(seed * 49979687);
      const fans = rng.next() * 100;
      const home = homeAdvantage({ fans, derby: false }, params);
      const derby = homeAdvantage({ fans, derby: true }, params);
      expect(derby).toBeGreaterThan(home);
      const away = measure(players, formation, posture, pressure);
      const atHome = measure(players, formation, posture, pressure, home);
      expect(atHome.power).toBeGreaterThan(away.power);
      expect(atHome.defense).toBeGreaterThan(away.defense);
    }
  });

  it('the displayed strength of any lineup is a number in 0..100', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { formation, players } = randomTeam(seed * 67867967);
      const ids = players.map((p) => p.id);
      const state = {
        clubs: { 'clube-teste-01': {} as never },
        players: Object.fromEntries(players.map((p) => [p.id, p])),
        squads: { 'clube-teste-01': ids },
      };
      const shown = teamStrength(state, 'clube-teste-01', { formation, starters: ids });
      expect(shown, `seed ${seed}`).toBeDefined();
      expect(shown!).toBeGreaterThanOrEqual(0);
      expect(shown!).toBeLessThanOrEqual(100);
    }
  });
});
