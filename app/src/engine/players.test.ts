import { describe, expect, it } from 'vitest';
import {
  AGE_RANGE,
  FACE_MAX_LENGTH,
  FIT,
  GOALKEEPER_ATTRIBUTES,
  OUTFIELD_ATTRIBUTES,
  OVERALL_WEIGHTS,
  POSITIONS,
  POTENTIAL_MAX,
  SQUAD_COMPOSITION,
  SQUAD_SIZE,
  TAKER_ATTRIBUTE,
  attributeKeysFor,
  attributeOf,
  computeOverall,
  drawGrowthCurve,
  drawPotential,
  drawTrait,
  fit,
  fitAttributesToOverall,
  fitLevel,
  isProspect,
  overallWeight,
  playerForm,
  takerValue,
  validatePlayer,
  type AttributeKey,
  type PlayerIssue,
  type PlayerResult,
} from './players.ts';
import { SOUTH_AMERICAN_NATIONALITIES } from './generation.ts';
import { PARAM_RANGES } from './params.ts';
import { Rng, seedFromString } from './rng.ts';
import { fixedIdentitySource } from './testing/identity.ts';
import {
  EXAMPLE_GOALKEEPER_ATTRIBUTES,
  EXAMPLE_STRIKER_ATTRIBUTES,
  testPlayer,
} from './testing/players.ts';
import type { Position } from './types.ts';

/** An Rng that returns the given uniforms in order and counts the draws. */
function scriptedRng(...uniforms: number[]): Rng & { draws: number } {
  const fake = {
    draws: 0,
    next() {
      const u = uniforms[fake.draws++];
      if (u === undefined) throw new Error('scripted Rng ran out of draws');
      return u;
    },
    int(min: number, max: number) {
      return min + Math.floor(fake.next() * (max - min + 1));
    },
  };
  return fake as unknown as Rng & { draws: number };
}

function issuesOf(result: PlayerResult): PlayerIssue[] {
  if (result.ok) throw new Error('expected the player to be refused');
  expect(result.error).toBe('invalid-player');
  return result.detail;
}

describe('overall', () => {
  it('reproduces the striker example of jogadores.md: 76.3 → 76', () => {
    expect(computeOverall('ST', EXAMPLE_STRIKER_ATTRIBUTES)).toBe(76);
  });

  it('rounds an exact half up, without floating point drift (72.5 → 73)', () => {
    // 0.30×78 + 0.25×74 + 0.15×70 + 0.15×66 + 0.05×60 + 0.10×72 = 72.5 exactly.
    expect(computeOverall('GK', EXAMPLE_GOALKEEPER_ATTRIBUTES)).toBe(73);
  });

  it('uses the weights of the natural position', () => {
    const a = EXAMPLE_STRIKER_ATTRIBUTES;
    // CB: 0.15×80 + 0.10×72 + 0.10×60 + 0.40×30 + 0.25×70 = 54.7 → 55
    expect(computeOverall('CB', a)).toBe(55);
    // FB: 0.30×80 + 0.10×72 + 0.20×60 + 0.25×30 + 0.15×70 = 61.2 → 61
    expect(computeOverall('FB', a)).toBe(61);
    // DM: 0.10×80 + 0.15×72 + 0.25×60 + 0.30×30 + 0.20×70 = 56.8 → 57
    expect(computeOverall('DM', a)).toBe(57);
    // AM: 0.15×80 + 0.30×72 + 0.30×60 + 0.15×81 + 0.10×70 = 70.75 → 71
    expect(computeOverall('AM', a)).toBe(71);
  });

  it('has six attributes per position whose weights add up to 1.00', () => {
    for (const position of POSITIONS) {
      const keys = attributeKeysFor(position);
      expect(keys).toHaveLength(6);
      expect(Object.keys(OVERALL_WEIGHTS[position]).sort()).toEqual([...keys].sort());
      const sum = keys.reduce(
        (s, k) => s + (OVERALL_WEIGHTS[position] as Record<string, number>)[k]!,
        0,
      );
      expect(sum, position).toBe(100);
    }
    expect(attributeKeysFor('GK')).toBe(GOALKEEPER_ATTRIBUTES);
    expect(attributeKeysFor('AM')).toBe(OUTFIELD_ATTRIBUTES);
  });

  it('copies the weight table of the design document', () => {
    expect(overallWeight('CB', 'marking')).toBe(0.4);
    expect(overallWeight('CB', 'finishing')).toBe(0);
    expect(overallWeight('FB', 'speed')).toBe(0.3);
    expect(overallWeight('DM', 'passing')).toBe(0.25);
    expect(overallWeight('AM', 'technique')).toBe(0.3);
    expect(overallWeight('AM', 'marking')).toBe(0);
    expect(overallWeight('ST', 'finishing')).toBe(0.4);
    expect(overallWeight('ST', 'passing')).toBe(0.05);
    expect(overallWeight('GK', 'reflexes')).toBe(0.3);
    expect(overallWeight('GK', 'distribution')).toBe(0.05);
    // An attribute that does not belong to the position weighs nothing.
    expect(overallWeight('GK', 'finishing')).toBe(0);
    expect(overallWeight('ST', 'reflexes')).toBe(0);
  });

  it('stays in 1..99 for attributes in 1..99', () => {
    for (const position of POSITIONS) {
      const keys = attributeKeysFor(position);
      const all = (v: number) =>
        Object.fromEntries(keys.map((k) => [k, v])) as Record<AttributeKey, number>;
      expect(computeOverall(position, all(1))).toBe(1);
      expect(computeOverall(position, all(99))).toBe(99);
    }
  });
});

describe('fit', () => {
  it('copies the out-of-position table of jogadores.md', () => {
    const table: Record<Position, number[]> = {
      GK: [1, 0.4, 0.4, 0.4, 0.4, 0.4],
      CB: [0.4, 1, 0.9, 0.9, 0.75, 0.7],
      FB: [0.4, 0.9, 1, 0.85, 0.85, 0.75],
      DM: [0.4, 0.9, 0.85, 1, 0.9, 0.75],
      AM: [0.4, 0.7, 0.8, 0.9, 1, 0.9],
      ST: [0.4, 0.65, 0.75, 0.75, 0.9, 1],
    };
    for (const natural of POSITIONS) {
      expect(
        POSITIONS.map((slot) => fit(natural, slot)),
        natural,
      ).toEqual(table[natural]);
    }
  });

  it('is read natural → slot, not symmetric', () => {
    expect(fit('CB', 'ST')).toBe(0.7);
    expect(fit('ST', 'CB')).toBe(0.65);
    expect(fit('AM', 'FB')).toBe(0.8);
    expect(fit('FB', 'AM')).toBe(0.85);
    expect(FIT.GK.GK).toBe(1);
  });

  it('labels 1.00 natural, 0.85–0.90 improvised and below 0.85 out of position', () => {
    expect(fitLevel('ST', 'ST')).toBe('natural');
    expect(fitLevel('CB', 'FB')).toBe('improvised'); // 0.90
    expect(fitLevel('FB', 'DM')).toBe('improvised'); // 0.85
    expect(fitLevel('AM', 'FB')).toBe('outOfPosition'); // 0.80
    expect(fitLevel('GK', 'ST')).toBe('outOfPosition'); // 0.40
  });
});

describe('drawTrait', () => {
  it('splits leader 10%, hothead 15%, professional 20%, quiet the rest, in one draw', () => {
    const cases: [number, string][] = [
      [0, 'leader'],
      [0.0999, 'leader'],
      [0.1, 'hothead'],
      [0.2499, 'hothead'],
      [0.25, 'professional'],
      [0.4499, 'professional'],
      [0.45, 'quiet'],
      [0.9999, 'quiet'],
    ];
    for (const [u, trait] of cases) {
      const rng = scriptedRng(u);
      expect(drawTrait(rng), String(u)).toBe(trait);
      expect(rng.draws).toBe(1);
    }
  });

  it('matches the chances over many draws and never draws the idol', () => {
    const rng = new Rng(2026);
    const counts: Record<string, number> = { leader: 0, hothead: 0, professional: 0, quiet: 0 };
    const n = 20_000;
    for (let i = 0; i < n; i++) counts[drawTrait(rng)]!++;
    expect(Object.keys(counts)).toEqual(['leader', 'hothead', 'professional', 'quiet']);
    expect(counts.leader! / n).toBeCloseTo(0.1, 1);
    expect(counts.hothead! / n).toBeCloseTo(0.15, 1);
    expect(counts.professional! / n).toBeCloseTo(0.2, 1);
    expect(counts.quiet! / n).toBeCloseTo(0.55, 1);
  });

  it('is deterministic for the same seed', () => {
    const a = new Rng(7);
    const b = new Rng(7);
    for (let i = 0; i < 50; i++) expect(drawTrait(a)).toBe(drawTrait(b));
  });
});

describe('drawPotential', () => {
  it('gives up to 23-year-olds overall + round(U^1.5 × (30 − 2 × (age − 17)))', () => {
    // 17 years: headroom 30. U = 0.25 → 0.125 × 30 = 3.75 → +4.
    expect(drawPotential(scriptedRng(0.25), 60, 17)).toBe(64);
    // 20 years: headroom 24. U = 0.64 → 0.512 × 24 = 12.288 → +12.
    expect(drawPotential(scriptedRng(0.64), 64, 20)).toBe(76);
    // 23 years: headroom 18. U = 0.81 → 0.729 × 18 = 13.122 → +13.
    expect(drawPotential(scriptedRng(0.81), 70, 23)).toBe(83);
    // U = 0 → no headroom at all.
    expect(drawPotential(scriptedRng(0), 70, 19)).toBe(70);
  });

  it('gives 24 to 26-year-olds overall + Rng.int(0, 4)', () => {
    expect(drawPotential(scriptedRng(0), 70, 24)).toBe(70);
    expect(drawPotential(scriptedRng(0.5), 70, 25)).toBe(72);
    expect(drawPotential(scriptedRng(0.999), 70, 26)).toBe(74);
  });

  it('keeps 27 or older at the overall, without drawing', () => {
    const rng = scriptedRng();
    expect(drawPotential(rng, 81, 27)).toBe(81);
    expect(drawPotential(rng, 81, 34)).toBe(81);
    expect(rng.draws).toBe(0);
  });

  it('uses exactly one draw up to 26', () => {
    for (const age of [17, 23, 24, 26]) {
      const rng = scriptedRng(0.5);
      drawPotential(rng, 60, age);
      expect(rng.draws, String(age)).toBe(1);
    }
  });

  it('caps at 95 and never goes below the overall', () => {
    // Rule: the 95 cap applies to the draw only; an overall above 95 keeps potential = overall.
    expect(POTENTIAL_MAX).toBe(95);
    expect(drawPotential(scriptedRng(0.999), 85, 17)).toBe(95);
    expect(drawPotential(scriptedRng(0.999), 94, 25)).toBe(95);
    // An overall already above the ceiling keeps potential ≥ overall (US-004).
    expect(drawPotential(scriptedRng(0.5), 97, 20)).toBe(97);
  });

  it('is always between overall and 95 for random draws', () => {
    const rng = new Rng(99);
    for (let i = 0; i < 2_000; i++) {
      const overall = rng.int(35, 92);
      const age = rng.int(17, 34);
      const potential = drawPotential(rng, overall, age);
      expect(potential).toBeGreaterThanOrEqual(overall);
      expect(potential).toBeLessThanOrEqual(Math.max(overall, 95));
      expect(Number.isInteger(potential)).toBe(true);
    }
  });
});

describe('drawGrowthCurve', () => {
  const players = { growthMin: 0.8, growthMax: 1.2 };

  it('draws peakAge in 26..29 and growth in [growthMin, growthMax), in two draws', () => {
    const low = scriptedRng(0, 0);
    expect(drawGrowthCurve(low, players)).toEqual({ peakAge: 26, growth: 0.8 });
    expect(low.draws).toBe(2);
    const high = drawGrowthCurve(scriptedRng(0.999, 0.5), players);
    expect(high.peakAge).toBe(29);
    expect(high.growth).toBeCloseTo(1, 12);
  });

  it('stays inside the ranges for many seeds', () => {
    const rng = new Rng(5);
    const peaks = new Set<number>();
    for (let i = 0; i < 1_000; i++) {
      const { peakAge, growth } = drawGrowthCurve(rng, players);
      peaks.add(peakAge);
      expect(growth).toBeGreaterThanOrEqual(0.8);
      expect(growth).toBeLessThan(1.2);
    }
    expect([...peaks].sort()).toEqual([26, 27, 28, 29]);
  });
});

describe('isProspect', () => {
  it('labels the midfielder of the evolution example (20 years, 64 → 80)', () => {
    expect(isProspect({ age: 20, overall: 64, potential: 80 })).toBe(true);
  });

  it('needs at most 23 years and a gap of at least 10', () => {
    expect(isProspect({ age: 23, overall: 60, potential: 70 })).toBe(true);
    expect(isProspect({ age: 24, overall: 60, potential: 70 })).toBe(false);
    expect(isProspect({ age: 18, overall: 60, potential: 69 })).toBe(false);
    expect(isProspect({ age: 17, overall: 55, potential: 55 })).toBe(false);
  });
});

describe('playerForm', () => {
  it('has no form without ratings (no games, also after the season turns)', () => {
    expect(playerForm({ recentRatings: [] })).toBeUndefined();
  });

  it('is the rating itself with one game', () => {
    expect(playerForm({ recentRatings: [7] })).toBe(7);
  });

  it('is the mean of the last 5 ratings', () => {
    expect(playerForm({ recentRatings: [6, 7, 8, 7, 6] })).toBe(6.8);
    expect(playerForm({ recentRatings: [10, 10, 10, 10, 10] })).toBe(10);
  });

  it('rounds the mean to one decimal', () => {
    expect(playerForm({ recentRatings: [6, 7, 7] })).toBe(6.7); // 6.666...
    expect(playerForm({ recentRatings: [6, 6, 7] })).toBe(6.3); // 6.333...
    expect(playerForm({ recentRatings: [6.5, 7] })).toBe(6.8); // 6.75, half up
  });

  it('does not change its input', () => {
    const recentRatings = Object.freeze([5, 9]);
    expect(playerForm({ recentRatings })).toBe(7);
    expect(recentRatings).toEqual([5, 9]);
  });
});

describe('attributeOf', () => {
  it('reads the own attribute of the position', () => {
    const striker = testPlayer();
    expect(attributeOf(striker, 'finishing')).toBe(81);
    expect(attributeOf(striker, 'physical')).toBe(70);
  });

  it('gives a missing attribute clamp(round(0.4 × overall), 1, 99): goalkeeper 70 finishes as 28', () => {
    const keeper = { attributes: EXAMPLE_GOALKEEPER_ATTRIBUTES, overall: 70 };
    expect(attributeOf(keeper, 'finishing')).toBe(28);
    expect(attributeOf(keeper, 'passing')).toBe(28);
    // physical exists in both lists and is always the player's own.
    expect(attributeOf(keeper, 'physical')).toBe(72);
    expect(attributeOf(testPlayer(), 'reflexes')).toBe(30); // 0.4 × 76 = 30.4
    expect(attributeOf({ attributes: {}, overall: 1 }, 'speed')).toBe(1); // 0.4 → 0 → 1
    expect(attributeOf({ attributes: {}, overall: 99 }, 'speed')).toBe(40); // 39.6
    for (let overall = 1; overall <= 99; overall++) {
      const value = attributeOf({ attributes: {}, overall }, 'marking');
      expect(value, String(overall)).toBe(Math.max(1, Math.round(0.4 * overall)));
    }
  });
});

describe('takerValue', () => {
  it('is attributeOf of finishing for penalties and technique for free kicks', () => {
    const striker = testPlayer();
    expect(TAKER_ATTRIBUTE).toEqual({ penalty: 'finishing', freeKick: 'technique' });
    expect(takerValue(striker, 'penalty')).toBe(attributeOf(striker, 'finishing'));
    expect(takerValue(striker, 'freeKick')).toBe(attributeOf(striker, 'technique'));
  });

  it('gives a goalkeeper the derived value the match uses (70 takes as 28)', () => {
    const keeper = { attributes: EXAMPLE_GOALKEEPER_ATTRIBUTES, overall: 70 };
    expect(takerValue(keeper, 'penalty')).toBe(28);
    expect(takerValue(keeper, 'freeKick')).toBe(28);
  });
});

describe('fitAttributesToOverall', () => {
  it('lands exactly on the target for 10,000 random targets, in 1..99, weight-0 untouched', () => {
    const rng = new Rng(seedFromString('fit-attributes'));
    for (let i = 0; i < 10_000; i++) {
      const position = POSITIONS[rng.int(0, POSITIONS.length - 1)]!;
      const attributes = Object.fromEntries(
        attributeKeysFor(position).map((key) => [key, rng.int(1, 99)]),
      ) as Record<AttributeKey, number>;
      const target = rng.int(1, 99);
      const fitted = fitAttributesToOverall(attributes, position, target);
      expect(computeOverall(position, fitted), `${position} → ${target}`).toBe(target);
      for (const key of attributeKeysFor(position)) {
        const value = fitted[key]!;
        expect(Number.isInteger(value) && value >= 1 && value <= 99).toBe(true);
        if (overallWeight(position, key) === 0) expect(value).toBe(attributes[key]);
      }
    }
  });

  it('shifts every weighted attribute by d, then fine-tunes the heaviest (striker +3)', () => {
    const fitted = fitAttributesToOverall(EXAMPLE_STRIKER_ATTRIBUTES, 'ST', 79);
    // 76 → 79: +3 on every attribute of weight > 0; marking (weight 0) stays 30.
    expect(fitted).toEqual({
      speed: 83,
      technique: 75,
      passing: 63,
      finishing: 84,
      marking: 30,
      physical: 73,
    });
  });

  it('uses the heaviest attribute not at the edge, ties by table order', () => {
    // AM, overall 60. technique and passing weigh 0.30; technique comes first in the table.
    const am = { speed: 60, technique: 60, passing: 60, finishing: 60, marking: 40, physical: 60 };
    // technique 99: overall 71.7 → 72. Target 75: coarse +3 (technique stays at 99) gives 73.8
    // → 74; fine: passing (heaviest not at the edge) 63 → 66 gives 74.7 → 75.
    expect(fitAttributesToOverall({ ...am, technique: 99 }, 'AM', 75)).toEqual({
      speed: 63,
      technique: 99,
      passing: 66,
      finishing: 63,
      marking: 40,
      physical: 63,
    });
    // Both free, speed clipped: speed 99 gives 65.85 → 66. Target 70: coarse +4 gives 69.25
    // → 69; fine: technique (tied with passing, first in the table) 64 → 65 gives 69.55 → 70.
    expect(fitAttributesToOverall({ ...am, speed: 99 }, 'AM', 70)).toEqual({
      speed: 99,
      technique: 65,
      passing: 64,
      finishing: 64,
      marking: 40,
      physical: 64,
    });
    // passing 99 instead: technique moves.
    expect(fitAttributesToOverall({ ...am, passing: 99 }, 'AM', 75)).toEqual({
      speed: 63,
      technique: 66,
      passing: 99,
      finishing: 63,
      marking: 40,
      physical: 63,
    });
    const bottom = fitAttributesToOverall(am, 'AM', 1);
    expect(bottom).toEqual({
      speed: 1,
      technique: 1,
      passing: 1,
      finishing: 1,
      marking: 40,
      physical: 1,
    });
  });

  it('moves the heaviest attribute first in the fine adjustment (GK reflexes)', () => {
    const flat = Object.fromEntries(GOALKEEPER_ATTRIBUTES.map((k) => [k, 50]));
    // positioning 99, the rest 50: overall 62.25 → 62. Target 70: coarse +8 (positioning stays
    // at 99) gives 68.25 → 68; fine: only reflexes moves, 58 → 63, giving 69.75 → 70.
    expect(fitAttributesToOverall({ ...flat, positioning: 99 }, 'GK', 70)).toEqual({
      reflexes: 63,
      positioning: 99,
      aerial: 58,
      rushing: 58,
      distribution: 58,
      physical: 58,
    });
  });

  it('is pure and clamps a target outside 1..99', () => {
    const input = { ...EXAMPLE_STRIKER_ATTRIBUTES };
    const fitted = fitAttributesToOverall(input, 'ST', 150);
    expect(input).toEqual(EXAMPLE_STRIKER_ATTRIBUTES);
    expect(computeOverall('ST', fitted)).toBe(99);
    expect(computeOverall('ST', fitAttributesToOverall(input, 'ST', -5))).toBe(1);
  });
});

describe('squad composition', () => {
  it('is 3 GK, 5 CB, 4 FB, 4 DM, 4 AM, 5 ST = 25', () => {
    expect(SQUAD_COMPOSITION).toEqual({ GK: 3, CB: 5, FB: 4, DM: 4, AM: 4, ST: 5 });
    expect(SQUAD_SIZE).toBe(25);
  });
});

describe('validatePlayer', () => {
  it('accepts a valid striker and a valid goalkeeper, returning fresh copies', () => {
    for (const raw of [testPlayer(), testPlayer({ position: 'GK' })]) {
      const result = validatePlayer(raw);
      if (!result.ok) throw new Error(JSON.stringify(result.detail, null, 2));
      expect(result.value).toEqual(raw);
      expect(result.value).not.toBe(raw);
      expect(result.value.attributes).not.toBe(raw.attributes);
      expect(result.value.name).not.toBe(raw.name);
      expect(result.value.recentRatings).not.toBe(raw.recentRatings);
      expect(result.warnings).toEqual([]);
    }
  });

  it('never throws on garbage', () => {
    for (const raw of [undefined, null, 3, 'x', [], [testPlayer()]]) {
      expect(issuesOf(validatePlayer(raw))).toEqual([
        { field: '', problem: 'not-an-object', value: raw },
      ]);
    }
  });

  it('reports missing and unknown keys', () => {
    const raw: Record<string, unknown> = { ...testPlayer(), extra: 1 };
    delete raw.morale;
    expect(issuesOf(validatePlayer(raw))).toEqual([
      { field: 'morale', problem: 'missing' },
      { field: 'extra', problem: 'unknown-key', value: 1 },
    ]);
  });

  it('demands exactly the six attributes of the position', () => {
    const gkWithOutfield = testPlayer({ position: 'GK', attributes: EXAMPLE_STRIKER_ATTRIBUTES });
    const fields = issuesOf(validatePlayer(gkWithOutfield)).map((i) => `${i.field}:${i.problem}`);
    expect(fields).toContain('attributes.reflexes:missing');
    expect(fields).toContain('attributes.finishing:unknown-key');
    expect(fields).not.toContain('attributes.physical:missing');
  });

  it('keeps every attribute an integer in 1..99', () => {
    const cases: [unknown, string][] = [
      [0, 'out-of-range'],
      [100, 'out-of-range'],
      [70.5, 'not-an-integer'],
      ['70', 'not-a-number'],
      [Number.NaN, 'not-a-number'],
    ];
    for (const [value, problem] of cases) {
      const raw = testPlayer({
        attributes: { ...EXAMPLE_STRIKER_ATTRIBUTES, speed: value as number },
      });
      const issue = issuesOf(validatePlayer(raw)).find((i) => i.field === 'attributes.speed');
      expect(issue?.problem, String(value)).toBe(problem);
    }
  });

  it('requires overall to be the formula of the attributes', () => {
    const issues = issuesOf(validatePlayer(testPlayer({ overall: 77, potential: 80 })));
    expect(issues).toEqual([
      { field: 'overall', problem: 'overall-mismatch', value: 77, range: { min: 76, max: 76 } },
    ]);
  });

  it('requires overall ≤ potential ≤ 95', () => {
    expect(issuesOf(validatePlayer(testPlayer({ potential: 75 })))).toEqual([
      { field: 'potential', problem: 'potential-below-overall', value: 75 },
    ]);
    expect(issuesOf(validatePlayer(testPlayer({ potential: 100 })))[0]).toMatchObject({
      field: 'potential',
      problem: 'out-of-range',
      range: { min: 1, max: 99 },
    });
  });

  it('checks ids, nationality, position, trait, name and face', () => {
    const raw = testPlayer({
      id: 'clube-teste-01-9',
      clubId: 'Clube Teste',
      nationality: 'bra',
      trait: 'lazy' as never,
      name: { display: ' ', full: 'Jogador Teste9', family: 3 as never },
      face: 'x'.repeat(FACE_MAX_LENGTH + 1),
    });
    const fields = issuesOf(validatePlayer(raw)).map((i) => `${i.field}:${i.problem}`);
    expect(fields).toEqual([
      'clubId:invalid-id',
      'id:invalid-id',
      'name.display:empty',
      'name.family:not-a-string',
      'face:too-long',
      'nationality:invalid-nationality',
      'trait:invalid-trait',
    ]);
    const badPosition = issuesOf(validatePlayer({ ...testPlayer(), position: 'LW' }));
    expect(badPosition.map((i) => `${i.field}:${i.problem}`)).toEqual([
      'position:invalid-position',
    ]);
  });

  it('refuses a name part past 60 characters (a 1 MB name too)', () => {
    const raw = testPlayer({
      name: { display: 'x'.repeat(1 << 20), full: 'y'.repeat(61), family: 'z'.repeat(60) },
    });
    const fields = issuesOf(validatePlayer(raw)).map((i) => `${i.field}:${i.problem}`);
    expect(fields).toEqual(['name.display:too-long', 'name.full:too-long']);
  });

  it('still accepts the South American nationalities of older saves (T-069)', () => {
    // Etapa 1 generates only BR, but saves from before kept a few AR, UY and other CONMEBOL
    // players; they must stay valid with no migration.
    for (const nationality of SOUTH_AMERICAN_NATIONALITIES) {
      const checked = validatePlayer(testPlayer({ nationality }));
      expect(checked.ok, nationality).toBe(true);
      if (checked.ok) expect(checked.value.nationality).toBe(nationality);
    }
  });

  it('accepts a face of exactly 32 characters and ids with large numbers', () => {
    const raw = testPlayer({ face: 'f'.repeat(FACE_MAX_LENGTH), id: 'clube-teste-20#1024' });
    expect(validatePlayer(raw).ok).toBe(true);
    expect(validatePlayer(testPlayer({ id: 'clube-teste-01#09' })).ok).toBe(false);
  });

  it('checks the ranges of the changing states', () => {
    const cases: [Partial<Record<string, unknown>>, string][] = [
      [{ condition: -1 }, 'condition:out-of-range'],
      [{ condition: 100.5 }, 'condition:out-of-range'],
      [{ morale: 101 }, 'morale:out-of-range'],
      [{ yellowCount: 3 }, 'yellowCount:out-of-range'],
      [{ injuryRounds: -1 }, 'injuryRounds:out-of-range'],
      [{ suspendedGames: 1.5 }, 'suspendedGames:not-an-integer'],
      [{ peakAge: 30 }, 'peakAge:out-of-range'],
      [{ growth: 1.6 }, 'growth:out-of-range'],
      [{ age: 14 }, 'age:out-of-range'],
      [{ age: 100 }, 'age:out-of-range'],
      [{ shirt: 0 }, 'shirt:out-of-range'],
      [{ shirt: 100 }, 'shirt:out-of-range'],
      [{ nameSeed: -1 }, 'nameSeed:out-of-range'],
      [{ faceSeed: 2 ** 32 }, 'faceSeed:out-of-range'],
      [{ recentRatings: [6, 7, 8, 9, 10, 6] }, 'recentRatings:out-of-range'],
      [{ recentRatings: [6, 2.9] }, 'recentRatings.1:out-of-range'],
      [{ recentRatings: 'boa' }, 'recentRatings:not-a-list'],
      [{ benchStreak: Number.POSITIVE_INFINITY }, 'benchStreak:not-a-number'],
    ];
    for (const [override, expected] of cases) {
      const raw = { ...testPlayer(), ...override };
      const fields = issuesOf(validatePlayer(raw)).map((i) => `${i.field}:${i.problem}`);
      expect(fields, expected).toEqual([expected]);
    }
    // Fractional morale and condition are fine (professional halves the drops; fatigue drains).
    const ok = validatePlayer(testPlayer({ morale: 58.5, condition: 72.3, recentRatings: [6.4] }));
    expect(ok.ok).toBe(true);
  });

  it('checks growth against the widest valid parameter bounds, not the current values', () => {
    expect(PARAM_RANGES.players.growthMin.min).toBe(0.5);
    expect(PARAM_RANGES.players.growthMax.max).toBe(1.5);
    expect(validatePlayer(testPlayer({ growth: 0.5 })).ok).toBe(true);
    expect(validatePlayer(testPlayer({ growth: 1.5 })).ok).toBe(true);
    expect(validatePlayer(testPlayer({ growth: 0.49 })).ok).toBe(false);
  });

  it('accepts the ages of a long career up to 99 (AGE_RANGE 15..99, T-017)', () => {
    expect(AGE_RANGE).toEqual({ min: 15, max: 99 });
    for (const age of [15, 60, 61, 99]) {
      expect(validatePlayer(testPlayer({ age })).ok, String(age)).toBe(true);
    }
    expect(validatePlayer(testPlayer({ age: 99.5 })).ok).toBe(false);
  });

  it('accepts every trait, the idol included', () => {
    for (const trait of ['leader', 'hothead', 'professional', 'idol', 'quiet'] as const) {
      expect(validatePlayer(testPlayer({ trait })).ok, trait).toBe(true);
    }
  });
});

describe('fixed identity source of the engine tests', () => {
  const source = fixedIdentitySource();

  it('is deterministic for the same request', () => {
    const ages = Array.from({ length: 25 }, (_, i) => 17 + (i % 18));
    const req = { seed: 42, nationality: 'BR', count: 25, ages, existing: [] };
    expect(source.squad(req)).toEqual(source.squad(req));
    expect(source.squad({ ...req, seed: 43 })).not.toEqual(source.squad(req));
    // The ages only matter to the game's face generator; this source ignores them.
    expect(source.squad({ ...req, ages: ages.map(() => 30) })).toEqual(source.squad(req));
  });

  it('never repeats a name of the squad, including existing ones', () => {
    const first = source.squad({
      seed: 1,
      nationality: 'BR',
      count: 3,
      ages: [20, 21, 22],
      existing: [],
    });
    const more = source.squad({
      seed: 2,
      nationality: 'UY',
      count: 3,
      ages: [25, 26, 27],
      existing: [...first, { display: 'Teste5', full: 'Jogador Teste5', family: 'Teste5' }],
    });
    const displays = [...first, ...more].map((p) => p.display);
    expect(new Set(displays).size).toBe(6);
    expect(displays).not.toContain('Teste5');
  });

  it('gives identities that make valid players', () => {
    expect(source.retiredRev).toBe(0);
    const ids = source.squad({
      seed: 9,
      nationality: 'AR',
      count: 25,
      ages: Array.from({ length: 25 }, () => 24),
      existing: [],
    });
    expect(ids).toHaveLength(25);
    ids.forEach((identity, i) => {
      const { nameSeed, faceSeed, face, display, full, family } = identity;
      const player = testPlayer({
        id: `clube-teste-01#${i}`,
        nameSeed,
        faceSeed,
        face,
        name: { display, full, family },
        nationality: 'AR',
      });
      const result = validatePlayer(player);
      if (!result.ok) throw new Error(JSON.stringify(result.detail));
    });
  });
});
