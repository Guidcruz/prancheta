import { describe, expect, it } from 'vitest';
import {
  PARAM_RANGES,
  SEASON_ROUNDS,
  SEASON_WEEKS,
  validateParams,
  type GameParams,
  type ParamIssue,
} from './params.ts';

/*
 * The engine cannot import app/src/params/ (lint), so these tests build their own valid set with
 * the initial values of the design documents. app/src/lib/params.test.ts checks the real files.
 */
function validParams(): GameParams {
  return {
    match: {
      baseChance: 0.09,
      kChance: 0.14,
      conversion: 0.15,
      kFinish: 0.09,
      midWeight: 0.5,
      dayFormSd: 3,
      homeBase: 0.05,
      missingPlayerPenalty: 0.07,
      penaltyShare: 0.015,
      freeKickShare: 0.06,
      assistShare: 0.7,
      fatigue: { drainPerMinute: 0.3, recoveryPerDay: 7 },
      injury: { basePerMinute: 0.00012 },
      cards: { yellowPerMinute: 0.002, redPerMinute: 0.00003, derbyMult: 1.2 },
    },
    players: { growthMin: 0.8, growthMax: 1.2 },
    generation: { clubStrengthSd: 1.5, squadSize: 25 },
    ai: { rotationCondition: 85, rotationMinRatio: 0.9, subEnergy: 65, tiredTeamCondition: 85 },
    season: { fifaWeeks: [9, 21, 25, 30], midweekWeeks: [3, 7, 12, 16, 19, 23, 28, 32] },
    fans: {
      homeBonusMin: 0.02,
      homeBonusMax: 0.08,
      derbyBonus: 0.02,
      moraleDrift: 1,
      start: 60,
      baseline: 55,
      resultWeight: 4,
      derbyResultMult: 1.5,
      reversion: 0.08,
      decisionCap: 4,
      baseOccupancy: 0.62,
    },
  };
}

type Json = Record<string, unknown>;

/** Sets `path` (dotted) on a fresh valid set; `undefined` deletes the key. */
function withValue(path: string, value: unknown): Json {
  const root = validParams() as unknown as Json;
  const keys = path.split('.');
  const last = keys.pop()!;
  let node = root;
  for (const key of keys) node = node[key] as Json;
  if (value === undefined) delete node[last];
  else node[last] = value;
  return root;
}

function issuesOf(raw: unknown): ParamIssue[] {
  const result = validateParams(raw);
  if (result.ok) return [];
  expect(result.error).toBe('invalid-params');
  return result.detail;
}

/** Every number leaf of PARAM_RANGES as [path, min, max, integer]. */
function numberLeaves(): [string, number, number, boolean][] {
  const out: [string, number, number, boolean][] = [];
  const walk = (node: Json, prefix: string) => {
    for (const [key, child] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const spec = child as Json;
      if (spec.kind === 'number') {
        out.push([path, spec.min as number, spec.max as number, spec.integer === true]);
      } else if (spec.kind === undefined) {
        walk(spec, path);
      }
    }
  };
  walk(PARAM_RANGES as unknown as Json, '');
  return out;
}

describe('validateParams', () => {
  it('accepts the initial values of the design documents', () => {
    const result = validateParams(validParams());
    expect(result).toEqual({ ok: true, value: validParams(), warnings: [] });
  });

  it('returns a copy that shares nothing with the input', () => {
    const raw = validParams();
    const result = validateParams(raw);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value).not.toBe(raw);
    expect(result.value.match).not.toBe(raw.match);
    expect(result.value.season.fifaWeeks).not.toBe(raw.season.fifaWeeks);
    raw.match.fatigue.drainPerMinute = 0.5;
    raw.season.fifaWeeks.push(33);
    expect(result.value.match.fatigue.drainPerMinute).toBe(0.3);
    expect(result.value.season.fifaWeeks).toEqual([9, 21, 25, 30]);
  });

  it('does not change the input', () => {
    const raw = withValue('match.extra', 1);
    const before = structuredClone(raw);
    validateParams(raw);
    expect(raw).toEqual(before);
  });

  describe('match.homeBase (ADR-0011, option A)', () => {
    it('accepts 0 to 0.08', () => {
      for (const value of [0, 0.05, 0.08]) {
        expect(validateParams(withValue('match.homeBase', value)).ok).toBe(true);
      }
    });

    it('refuses values out of 0..0.08 with path, value and range', () => {
      expect(issuesOf(withValue('match.homeBase', 0.081))).toEqual([
        {
          path: 'match.homeBase',
          problem: 'out-of-range',
          value: 0.081,
          range: { min: 0, max: 0.08 },
        },
      ]);
      expect(issuesOf(withValue('match.homeBase', -0.01))[0]?.problem).toBe('out-of-range');
    });
  });

  it.each(numberLeaves())('checks the range of %s (%s..%s)', (path, min, max, integer) => {
    expect(validateParams(withValue(path, min)).ok).toBe(true);
    expect(validateParams(withValue(path, max)).ok).toBe(true);
    const step = integer ? 1 : Math.max(Math.abs(max - min), 1e-6) / 1000 + 1e-9;
    for (const bad of [min - step, max + step]) {
      expect(issuesOf(withValue(path, bad))).toEqual([
        { path, problem: 'out-of-range', value: bad, range: { min, max } },
      ]);
    }
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['a numeric string', '0.14'],
    ['null', null],
    ['a boolean', true],
    ['an object', { value: 0.14 }],
  ])('refuses %s as a number', (_label, value) => {
    expect(issuesOf(withValue('match.kChance', value))).toEqual([
      { path: 'match.kChance', problem: 'not-a-number', value, range: { min: 0.05, max: 0.4 } },
    ]);
  });

  it('refuses a fraction where an integer is expected', () => {
    expect(issuesOf(withValue('generation.squadSize', 25.5))).toEqual([
      {
        path: 'generation.squadSize',
        problem: 'not-an-integer',
        value: 25.5,
        range: { min: 22, max: 30 },
      },
    ]);
  });

  it('keeps the ADR-0005 fan bonuses fixed', () => {
    expect(issuesOf(withValue('fans.homeBonusMin', 0.03))).toEqual([
      {
        path: 'fans.homeBonusMin',
        problem: 'out-of-range',
        value: 0.03,
        range: { min: 0.02, max: 0.02 },
      },
    ]);
    expect(issuesOf(withValue('fans.moraleDrift', 2))[0]?.path).toBe('fans.moraleDrift');
  });

  it.each([
    'match.baseChance',
    'match.fatigue.recoveryPerDay',
    'match.fatigue',
    'season.fifaWeeks',
    'fans',
  ])('refuses a missing %s', (path) => {
    expect(issuesOf(withValue(path, undefined))).toEqual([
      { path, problem: 'missing', value: undefined },
    ]);
  });

  it.each(['economy', 'match.homeBonus', 'match.cards.blue', 'ai.extra'])(
    'refuses the unknown key %s',
    (path) => {
      expect(issuesOf(withValue(path, 1))).toEqual([{ path, problem: 'unknown-key', value: 1 }]);
    },
  );

  it('treats an inherited key as missing', () => {
    const raw = withValue('players', Object.create({ growthMin: 0.8, growthMax: 1.2 }));
    expect(issuesOf(raw).map((i) => i.path)).toEqual(['players.growthMin', 'players.growthMax']);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 1],
    ['a string', '{}'],
    ['an array', []],
  ])('refuses %s as the parameter set without throwing', (_label, raw) => {
    expect(issuesOf(raw)).toEqual([{ path: '', problem: 'not-an-object', value: raw }]);
  });

  it('refuses a group that is not an object', () => {
    expect(issuesOf(withValue('match.cards', [1, 2]))).toEqual([
      { path: 'match.cards', problem: 'not-an-object', value: [1, 2] },
    ]);
  });

  it('lists every issue at once', () => {
    const raw = withValue('match.kChance', Number.NaN);
    (raw.ai as Json).subEnergy = 200;
    delete (raw.fans as Json).start;
    (raw.players as Json).growthMid = 1;
    expect(issuesOf(raw).map((i) => `${i.path}:${i.problem}`)).toEqual([
      'match.kChance:not-a-number',
      'players.growthMid:unknown-key',
      'ai.subEnergy:out-of-range',
      'fans.start:missing',
    ]);
  });

  describe('season calendar', () => {
    it('has 34 weeks and 38 rounds with the design values', () => {
      expect(SEASON_WEEKS).toBe(34);
      expect(SEASON_ROUNDS).toBe(38);
    });

    it('refuses a list that is not a list', () => {
      expect(issuesOf(withValue('season.fifaWeeks', 9))).toEqual([
        { path: 'season.fifaWeeks', problem: 'not-a-list', value: 9 },
      ]);
    });

    it('refuses weeks outside the season or not integer', () => {
      const raw = withValue('season.fifaWeeks', [0, 21, 25, 35]);
      expect(issuesOf(raw)).toEqual([
        {
          path: 'season.fifaWeeks.0',
          problem: 'out-of-range',
          value: 0,
          range: { min: 1, max: 34 },
        },
        {
          path: 'season.fifaWeeks.3',
          problem: 'out-of-range',
          value: 35,
          range: { min: 1, max: 34 },
        },
      ]);
      expect(issuesOf(withValue('season.fifaWeeks', [9, 21.5, 25, 30]))[0]).toMatchObject({
        path: 'season.fifaWeeks.1',
        problem: 'not-an-integer',
      });
      expect(issuesOf(withValue('season.fifaWeeks', [9, Number.NaN, 25, 30]))[0]).toMatchObject({
        path: 'season.fifaWeeks.1',
        problem: 'not-a-number',
      });
    });

    it('refuses unsorted or repeated weeks', () => {
      expect(issuesOf(withValue('season.fifaWeeks', [9, 25, 21, 30]))).toEqual([
        { path: 'season.fifaWeeks.2', problem: 'not-increasing', value: 21 },
      ]);
      expect(issuesOf(withValue('season.fifaWeeks', [9, 21, 21, 30]))[0]?.problem).toBe(
        'not-increasing',
      );
    });

    it('refuses a midweek round in a FIFA week', () => {
      const raw = withValue('season.midweekWeeks', [3, 7, 9, 16, 19, 23, 28, 32]);
      expect(issuesOf(raw)).toEqual([
        { path: 'season.midweekWeeks', problem: 'overlap', value: 9 },
      ]);
    });

    it('refuses a calendar that does not make 38 rounds', () => {
      const raw = withValue('season.midweekWeeks', [3, 7, 12, 16, 19, 23, 28]);
      expect(issuesOf(raw)).toEqual([
        { path: 'season', problem: 'round-count', value: 37, range: { min: 38, max: 38 } },
      ]);
      // One FIFA week fewer and one midweek round fewer keeps 38 rounds.
      const shifted = withValue('season.fifaWeeks', [9, 21, 25]);
      (shifted.season as Json).midweekWeeks = [3, 7, 12, 16, 19, 23, 28];
      expect(validateParams(shifted).ok).toBe(true);
    });

    it('skips the calendar checks while a season list is itself invalid', () => {
      expect(issuesOf(withValue('season.midweekWeeks', 'x'))).toEqual([
        { path: 'season.midweekWeeks', problem: 'not-a-list', value: 'x' },
      ]);
    });
  });
});
