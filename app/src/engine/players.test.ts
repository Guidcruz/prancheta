import { describe, expect, it } from 'vitest';
import {
  FACE_MAX_LENGTH,
  FIT,
  GOALKEEPER_ATTRIBUTES,
  OUTFIELD_ATTRIBUTES,
  OVERALL_WEIGHTS,
  POSITIONS,
  POTENTIAL_MAX,
  SQUAD_COMPOSITION,
  SQUAD_SIZE,
  attributeKeysFor,
  computeOverall,
  drawGrowthCurve,
  drawPotential,
  drawTrait,
  fit,
  fitLevel,
  isProspect,
  overallWeight,
  validatePlayer,
  type AttributeKey,
  type PlayerIssue,
  type PlayerResult,
} from './players.ts';
import { PARAM_RANGES } from './params.ts';
import { Rng } from './rng.ts';
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
    expect(issuesOf(validatePlayer(testPlayer({ potential: 96 })))[0]).toMatchObject({
      field: 'potential',
      problem: 'out-of-range',
      range: { min: 1, max: 95 },
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
      [{ age: 0 }, 'age:out-of-range'],
      [{ shirt: 0 }, 'shirt:out-of-range'],
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

  it('accepts every trait, the idol included', () => {
    for (const trait of ['leader', 'hothead', 'professional', 'idol', 'quiet'] as const) {
      expect(validatePlayer(testPlayer({ trait })).ok, trait).toBe(true);
    }
  });
});

describe('fixed identity source of the engine tests', () => {
  const source = fixedIdentitySource();

  it('is deterministic for the same request', () => {
    const req = { seed: 42, nationality: 'BR', count: 25, existing: [] };
    expect(source.squad(req)).toEqual(source.squad(req));
    expect(source.squad({ ...req, seed: 43 })).not.toEqual(source.squad(req));
  });

  it('never repeats a name of the squad, including existing ones', () => {
    const first = source.squad({ seed: 1, nationality: 'BR', count: 3, existing: [] });
    const more = source.squad({
      seed: 2,
      nationality: 'UY',
      count: 3,
      existing: [...first, { display: 'Teste5', full: 'Jogador Teste5', family: 'Teste5' }],
    });
    const displays = [...first, ...more].map((p) => p.display);
    expect(new Set(displays).size).toBe(6);
    expect(displays).not.toContain('Teste5');
  });

  it('gives identities that make valid players', () => {
    expect(source.retiredRev).toBe(0);
    const ids = source.squad({ seed: 9, nationality: 'AR', count: 25, existing: [] });
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
