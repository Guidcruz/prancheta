import { describe, expect, it } from 'vitest';
import { FORMATIONS, FORMATION_SLOTS } from './formations.ts';
import { FIT } from './players.ts';
import { Rng } from './rng.ts';
import {
  EMPTY_SECTOR_FIT,
  FORMATION_MULTIPLIERS,
  FORMATION_SECTORS,
  GOALKEEPER_SLOT,
  PRESSURE_EFFECTS,
  effectiveRating,
  fillEmptyGoal,
  strengthsFromRatings,
  teamFactor,
  type Sector,
  type TeamStrengths,
} from './strength.ts';
import { testParams } from './testing/params.ts';
import { testPlayer } from './testing/players.ts';
import type { Formation, Pressure } from './types.ts';

/*
 * Empty slots (docs/design/partida.md, "Vaga vazia (jogador a menos)" and item 5 of "Pedido ao
 * developer"): the mean of a sector is over its occupied slots, every empty slot counts in
 * `faltando(t)`, and a sector with nobody left plays at EMPTY_SECTOR_FIT of the outfield mean.
 */

const params = testParams();
const balanced = { posture: 'balanced', pressure: 'medium' } as const;
const neutral = { home: 0 };

function strengths(
  formation: Formation,
  ratings: readonly (number | undefined)[],
  tactic: { posture: 'balanced'; pressure: Pressure } = balanced,
): TeamStrengths {
  return strengthsFromRatings(formation, tactic, ratings, neutral, params.match);
}

describe('vaga vazia: exemplos de partida.md', () => {
  it('exemplo 1: um de dois atacantes expulso, Atk = 70 × 1,00 × 0,93 = 65,1', () => {
    // 4-4-2: GK, 4 defenders, 4 midfielders, ST 78 and ST 70.
    const before = [70, 70, 70, 70, 70, 70, 70, 70, 70, 78, 70];
    const after = [...before.slice(0, 9), undefined, 70];
    expect(strengths('4-4-2', before).atk).toBeCloseTo(74, 10);
    const s = strengths('4-4-2', after);
    expect(Math.abs(s.atk - 65.1)).toBeLessThanOrEqual(0.05);
    expect(s.factor).toBeCloseTo(0.93, 12);
    // The other sectors pay the 0.93 too.
    expect(s.def).toBeCloseTo(70 * 0.93, 10);
    expect(s.mid).toBeCloseTo(70 * 0.93, 10);
  });

  it('exemplo 2: o único ATA do 4-2-3-1 expulso, Atk 55,7 e Power 61,7', () => {
    // 4-2-3-1: GK, defence 70 70 68 72, midfield 74 70 72 66 68 (mean 70), ST 76.
    const before = [65, 70, 70, 68, 72, 74, 70, 72, 66, 68, 76];
    const after = [...before.slice(0, 10), undefined];
    const b = strengths('4-2-3-1', before);
    expect(b.mid).toBeCloseTo(72.8, 10);
    expect(b.atk).toBeCloseTo(72.2, 10);
    expect(Math.abs(b.power - 72.5)).toBeLessThanOrEqual(0.05);

    const s = strengths('4-2-3-1', after);
    expect(Math.abs(s.mid - 67.7)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(s.atk - 55.7)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(s.power - 61.7)).toBeLessThanOrEqual(0.05);
    // 70.0 = mean of the 9 outfield players: 630 / 9.
    expect(s.atk).toBeCloseTo(EMPTY_SECTOR_FIT * (630 / 9) * 0.95 * 0.93, 10);
  });

  it('exemplo 2, com o zagueiro expulso em vez do atacante: Power = 72,5 × 0,93 = 67,4', () => {
    const ratings = [65, undefined, 70, 68, 72, 74, 70, 72, 66, 68, 76];
    const s = strengths('4-2-3-1', ratings);
    expect(Math.abs(s.power - 67.4)).toBeLessThanOrEqual(0.05);
    expect(s.def).toBeCloseTo(((70 + 68 + 72) / 3) * 1.01 * 0.93, 10);
  });

  it('an empty slot never counts as 0 in the mean', () => {
    const ratings = [70, 70, 70, 70, 70, 70, 70, 70, 70, 80, undefined];
    // Not (80 + 0) / 2 = 40: the mean is over who is left.
    expect(strengths('4-4-2', ratings).atk).toBeCloseTo(80 * 0.93, 10);
  });
});

describe('vaga vazia: setor vazio em todas as formações, com 7 a 11 em campo', () => {
  /** Every subset of the 10 outfield slots with at most 4 empty (7 to 11 on the pitch). */
  function* emptySets(): Generator<number[]> {
    const outfield = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    function* choose(from: number, k: number, picked: number[]): Generator<number[]> {
      if (k === 0) {
        yield picked;
        return;
      }
      for (let i = from; i < outfield.length; i++) {
        yield* choose(i + 1, k - 1, [...picked, outfield[i]!]);
      }
    }
    for (let k = 0; k <= 4; k++) yield* choose(0, k, []);
  }

  it.each(FORMATIONS)('%s: no NaN, no division by zero, and the rule for each sector', (f) => {
    const rng = new Rng(FORMATIONS.indexOf(f) + 1);
    const sectors = FORMATION_SECTORS[f];
    const emptied = new Set<Sector>();
    let cases = 0;
    for (const empties of emptySets()) {
      const ratings: (number | undefined)[] = sectors.map(() => 30 + rng.next() * 70);
      for (const i of empties) ratings[i] = undefined;
      for (const pressure of ['low', 'medium', 'high'] as const) {
        const s = strengthsFromRatings(
          f,
          { posture: 'allOut', pressure },
          ratings,
          { home: 0.1, halftimeBoost: 0.03 },
          params.match,
        );
        for (const value of Object.values(s)) {
          expect(Number.isFinite(value), `${f} ${empties.join(',')}`).toBe(true);
          expect(value).toBeGreaterThan(0);
        }
        const t = teamFactor(
          { home: 0.1, missing: empties.length, halftimeBoost: 0.03 },
          params.match,
        );
        expect(s.factor).toBeCloseTo(t, 12);

        const outfield = ratings.filter(
          (r, i): r is number => i !== GOALKEEPER_SLOT && r !== undefined,
        );
        const outfieldMean = outfield.reduce((a, r) => a + r, 0) / outfield.length;
        for (const sector of ['def', 'mid', 'atk'] as const) {
          const own = ratings.filter(
            (r, i): r is number => sectors[i] === sector && r !== undefined,
          );
          const mean =
            own.length > 0
              ? own.reduce((a, r) => a + r, 0) / own.length
              : EMPTY_SECTOR_FIT * outfieldMean;
          if (own.length === 0) emptied.add(sector);
          const pressureMid = sector === 'mid' ? PRESSURE_EFFECTS[pressure].mid : 1;
          const expected = mean * FORMATION_MULTIPLIERS[f][sector] * pressureMid * t;
          expect(s[sector], `${f} ${sector} ${empties.join(',')}`).toBeCloseTo(expected, 9);
        }
      }
      cases++;
    }
    expect(cases).toBe(386); // C(10,0) + ... + C(10,4)
    // Every sector that fits in 4 empty slots was emptied at least once (sectors of 5, like the
    // back five of 5-3-2, can only empty below 7 on the pitch, when the match is already over).
    for (const sector of ['def', 'mid', 'atk'] as const) {
      const size = sectors.filter((x) => x === sector).length;
      expect(emptied.has(sector), `${f} ${sector}`).toBe(size <= 4);
    }
  });

  it('stays finite even with nobody on the outfield (never happens in a match)', () => {
    const ratings = [70, ...Array.from({ length: 10 }, () => undefined)];
    const s = strengths('4-4-2', ratings);
    for (const value of Object.values(s)) expect(Number.isFinite(value)).toBe(true);
    expect(s.atk).toBe(0);
  });

  it('treats an empty goalkeeper slot as a programming error', () => {
    const ratings = [undefined, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70];
    expect(() => strengths('4-4-2', ratings)).toThrow(RangeError);
  });
});

describe('fillEmptyGoal: o goleiro nunca fica vazio', () => {
  const at = (physical: number, id: number) =>
    testPlayer({
      id: `clube-teste-01#${id}`,
      position: 'CB',
      overall: 70,
      attributes: {
        speed: 60,
        technique: 60,
        passing: 60,
        finishing: 40,
        marking: 75,
        physical,
      },
    });

  it('keeps the slots as they are when the goalkeeper is there', () => {
    const slots = [testPlayer({ position: 'GK' }), at(80, 2), undefined];
    const result = fillEmptyGoal(slots);
    expect(result.slots).toEqual(slots);
    expect(result.slots).not.toBe(slots);
    expect(result.vacated).toBeUndefined();
  });

  it('moves the outfield player with the highest physical to goal and empties his slot', () => {
    const slots = [undefined, at(70, 2), at(88, 3), undefined, at(75, 4)];
    const result = fillEmptyGoal(slots);
    expect(result.vacated).toBe(2);
    expect(result.slots[GOALKEEPER_SLOT]).toBe(slots[2]);
    expect(result.slots[2]).toBeUndefined();
    expect(result.slots.filter((p) => p !== undefined)).toHaveLength(3);
    expect(slots[0]).toBeUndefined(); // the input is not changed
  });

  it('breaks a tie by slot order', () => {
    const result = fillEmptyGoal([undefined, at(80, 2), at(80, 3)]);
    expect(result.vacated).toBe(1);
  });

  it('does nothing when no one is left on the outfield', () => {
    const result = fillEmptyGoal([undefined, undefined]);
    expect(result.vacated).toBeUndefined();
    expect(result.slots).toEqual([undefined, undefined]);
  });

  it('feeds the strength: the new goalkeeper plays with fit 0.40, his slot stays empty', () => {
    // 4-4-2, the goalkeeper sent off with no substitutions left; the centre-back of slot 1 has
    // the highest physical.
    const xi = FORMATION_SLOTS['4-4-2'].map((slot, i) =>
      i === 1
        ? at(90, i + 1)
        : testPlayer({ id: `clube-teste-01#${i + 1}`, position: slot, overall: 70, morale: 50 }),
    );
    const onPitch = fillEmptyGoal([undefined, ...xi.slice(1)]);
    const ratings = onPitch.slots.map((p, i) =>
      p === undefined ? undefined : effectiveRating(p, FORMATION_SLOTS['4-4-2'][i]!),
    );
    const s = strengths('4-4-2', ratings);
    expect(s.goalkeeper).toBeCloseTo(effectiveRating(xi[1]!, 'GK'), 12);
    expect(s.goalkeeper).toBeCloseTo((70 * FIT.CB.GK * effectiveRating(xi[1]!, 'CB')) / 70, 12);
    expect(s.factor).toBeCloseTo(0.93, 12);
    expect(s.def).toBeCloseTo(70 * 0.93, 10);
  });
});
