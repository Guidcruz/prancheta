import { describe, expect, it } from 'vitest';
import { FORMATIONS, FORMATION_SLOTS } from '../formations.ts';
import { generateSquad } from '../generation.ts';
import { PARAM_RANGES, type GameParams } from '../params.ts';
import { FORMATION_SECTORS, GOALKEEPER_SLOT, homeAdvantage } from '../strength.ts';
import { fixedIdentitySource } from '../testing/identity.ts';
import {
  clubTeamInput,
  firstDerby,
  fixtureInput,
  teamInputFrom,
  testGame,
} from '../testing/match.ts';
import { testParams } from '../testing/params.ts';
import type { Side } from '../types.ts';
import { AI_HALFTIME_TALK, GOAL_BOUNDS, RATING, STOPPAGE, scoreState } from './rules.ts';
import { simulateMatch } from './simulate.ts';
import type { MatchEvent, MatchInput, MatchResult, TeamInput } from './types.ts';

const params = testParams();
const state = testGame();
const derby = firstDerby(state);
const derbyInput = fixtureInput(state, derby);
const nonDerby = state.fixtures.find((f) => !state.clubs[f.homeId]!.def.rivals.includes(f.awayId))!;

function withSeed(input: MatchInput, seed: number): MatchInput {
  return { ...input, seed, fixtureId: `${input.fixtureId}-${seed}` };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

type Of<T extends MatchEvent['type']> = Extract<MatchEvent, { type: T }>;
const ofType = <T extends MatchEvent['type']>(result: MatchResult, type: T): Of<T>[] =>
  result.events.filter((e): e is Of<T> => e.type === type);

/** Starters of a side, as given in the sheet (there are no substitutions in T-009). */
const startersOf = (input: MatchInput, side: Side) => new Set(input[side].sheet.lineup.starters);

describe('simulateMatch: determinism (US-008)', () => {
  it('gives the same events and result, byte for byte, in two runs', () => {
    const a = simulateMatch(derbyInput, params);
    const b = simulateMatch(derbyInput, params);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('gives different matches in at least 95 of 100 different seeds', () => {
    let different = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const a = simulateMatch(withSeed(derbyInput, seed), params);
      const b = simulateMatch(withSeed(derbyInput, seed + 100_000), params);
      if (JSON.stringify(a.events) !== JSON.stringify(b.events)) different++;
    }
    expect(different).toBeGreaterThanOrEqual(95);
  });

  it('never changes its input', () => {
    const input = deepFreeze(structuredClone(derbyInput));
    const before = JSON.stringify(input);
    expect(() => simulateMatch(input, deepFreeze(testParams()))).not.toThrow();
    expect(JSON.stringify(input)).toBe(before);
  });

  it('does not depend on the order of the squad list', () => {
    const shuffled: MatchInput = {
      ...derbyInput,
      home: { ...derbyInput.home, players: [...derbyInput.home.players].reverse() },
      away: { ...derbyInput.away, players: [...derbyInput.away.players].reverse() },
    };
    expect(JSON.stringify(simulateMatch(shuffled, params))).toBe(
      JSON.stringify(simulateMatch(derbyInput, params)),
    );
  });
});

describe('simulateMatch: structure of the match (US-008)', () => {
  const results = Array.from({ length: 200 }, (_, seed) => ({
    input: withSeed(derbyInput, seed),
    result: simulateMatch(withSeed(derbyInput, seed), params),
  }));

  it('has a kick-off, two halves with added time within the limits, half time and full time', () => {
    for (const { result } of results) {
      const types = result.events.map((e) => e.type);
      expect(types[0]).toBe('kickoff');
      expect(types.at(-1)).toBe('fulltime');
      const stoppages = ofType(result, 'stoppage');
      expect(stoppages.map((e) => [e.minute, e.half])).toEqual([
        [45, 1],
        [90, 2],
      ]);
      const [first, second] = stoppages.map((e) => e.minutes);
      expect(first).toBeGreaterThanOrEqual(STOPPAGE[1].min);
      expect(first).toBeLessThanOrEqual(STOPPAGE[1].max);
      expect(second).toBeGreaterThanOrEqual(STOPPAGE[2].min);
      expect(second).toBeLessThanOrEqual(STOPPAGE[2].max);
      expect(types.filter((t) => t === 'halftime')).toHaveLength(1);
      const halftime = ofType(result, 'halftime')[0]!;
      expect(halftime.added ?? 0).toBe(first);
      expect(ofType(result, 'fulltime')[0]!.added ?? 0).toBe(second);
      expect(ofType(result, 'fulltime')[0]!.abandoned).toBe(false);
    }
  });

  it('keeps every event in its half and in chronological order', () => {
    for (const { result } of results) {
      const stoppage = ofType(result, 'stoppage').map((e) => e.minutes);
      let previous = -1;
      for (const event of result.events) {
        const time = event.minute + (event.added ?? 0) / 100 + (event.half - 1) * 1000;
        expect(time).toBeGreaterThanOrEqual(previous);
        previous = time;
        if (event.type === 'chance' || event.type === 'goal') {
          const [from, to] = event.half === 1 ? [1, 45] : [46, 90];
          expect(event.minute).toBeGreaterThanOrEqual(from);
          expect(event.minute).toBeLessThanOrEqual(to);
          if (event.added !== undefined) {
            expect(event.minute).toBe(to);
            expect(event.added).toBeGreaterThanOrEqual(1);
            expect(event.added).toBeLessThanOrEqual(stoppage[event.half - 1]!);
          }
        }
      }
    }
  });

  it('ends every chance in exactly one of goal, save, post or wide, shot by a player on the pitch', () => {
    for (const { input, result } of results) {
      for (const side of ['home', 'away'] as const) {
        const onPitch = startersOf(input, side);
        const chances = ofType(result, 'chance').filter((e) => e.side === side);
        const goals = ofType(result, 'goal').filter((e) => e.side === side);
        const stats = result.stats[side];
        expect(stats.shots).toBe(chances.length + goals.length);
        expect(stats.onTarget).toBe(
          goals.length + chances.filter((c) => c.outcome === 'saved').length,
        );
        expect(result.score[side === 'home' ? 0 : 1]).toBe(goals.length);
        for (const chance of chances) {
          expect(onPitch.has(chance.shooter)).toBe(true);
          expect(['saved', 'post', 'wide']).toContain(chance.outcome);
          expect(chance.kind).toBe('open');
          expect(chance.pGoal).toBeGreaterThanOrEqual(GOAL_BOUNDS.min);
          expect(chance.pGoal).toBeLessThanOrEqual(GOAL_BOUNDS.max);
          const big = chance.pGoal >= 0.25 || chance.outcome === 'post';
          expect(chance.importance).toBe(big ? 2 : 1);
        }
        for (const goal of goals) {
          expect(onPitch.has(goal.scorer)).toBe(true);
          expect(goal.kind).toBe('open');
          expect(goal.importance).toBe(3);
          if (goal.assist !== undefined) {
            expect(onPitch.has(goal.assist)).toBe(true);
            expect(goal.assist).not.toBe(goal.scorer);
          }
        }
      }
    }
  });

  it('splits the misses into about 7% post, 48% saved and 45% wide', () => {
    const misses = results.flatMap(({ result }) => ofType(result, 'chance'));
    const share = (o: string) => misses.filter((c) => c.outcome === o).length / misses.length;
    expect(misses.length).toBeGreaterThan(2500);
    expect(share('post')).toBeGreaterThan(0.05);
    expect(share('post')).toBeLessThan(0.09);
    expect(share('saved')).toBeGreaterThan(0.44);
    expect(share('saved')).toBeLessThan(0.52);
  });

  it('never lets the player in goal shoot, and keeps the running score in the goal events', () => {
    for (const { input, result } of results) {
      const keepers = new Set(
        (['home', 'away'] as const).map((s) => input[s].sheet.lineup.starters[GOALKEEPER_SLOT]),
      );
      let home = 0;
      let away = 0;
      for (const event of result.events) {
        if (event.type === 'chance') expect(keepers.has(event.shooter)).toBe(false);
        if (event.type !== 'goal') continue;
        expect(keepers.has(event.scorer)).toBe(false);
        if (event.side === 'home') home++;
        else away++;
        expect(event.score).toEqual([home, away]);
      }
      expect(result.score).toEqual([home, away]);
      expect(ofType(result, 'halftime')[0]!.score[0]).toBeLessThanOrEqual(home);
    }
  });

  it('gives assists in about 70% of the open-play goals (match.assistShare)', () => {
    const goals = results.flatMap(({ result }) => ofType(result, 'goal'));
    const share = goals.filter((g) => g.assist !== undefined).length / goals.length;
    expect(goals.length).toBeGreaterThan(300);
    expect(share).toBeGreaterThan(0.62);
    expect(share).toBeLessThan(0.78);
  });

  it('has the AI half-time talk of each side, for its half-time score', () => {
    for (const { input, result } of results) {
      const [h, a] = ofType(result, 'halftime')[0]!.score;
      const talks = ofType(result, 'halftimeTalk');
      expect(talks.map((t) => t.side)).toEqual(['home', 'away']);
      for (const talk of talks) {
        const profile = input[talk.side].profile;
        if (profile === 'chaotic') continue;
        const [own, other] = talk.side === 'home' ? [h, a] : [a, h];
        expect(talk.talk).toBe(AI_HALFTIME_TALK[profile][scoreState(own, other)]);
      }
    }
  });
});

describe('simulateMatch: half-time talk', () => {
  it('changes only the second half: the first half is identical, byte for byte', () => {
    // Traditional "demands" when losing at half time (+4%), the seller "motivates" (+3%).
    const as = (profile: 'traditional' | 'seller', seed: number) =>
      simulateMatch(
        { ...withSeed(derbyInput, seed), home: { ...derbyInput.home, profile } },
        params,
      );
    let losing = 0;
    let secondHalfChanged = 0;
    for (let seed = 0; seed < 400 && losing < 40; seed++) {
      const a = as('traditional', seed);
      const [h, aw] = ofType(a, 'halftime')[0]!.score;
      if (h >= aw) continue;
      losing++;
      const b = as('seller', seed);
      const firstHalf = (r: MatchResult) =>
        JSON.stringify(r.events.filter((e) => e.half === 1 && e.type !== 'halftimeTalk'));
      expect(firstHalf(b)).toBe(firstHalf(a));
      const talk = (r: MatchResult) => ofType(r, 'halftimeTalk').find((t) => t.side === 'home')!;
      expect(talk(a).talk).toBe('demand');
      expect(talk(b).talk).toBe('motivate');
      const secondHalf = (r: MatchResult) => JSON.stringify(r.events.filter((e) => e.half === 2));
      if (secondHalf(a) !== secondHalf(b)) secondHalfChanged++;
    }
    expect(losing).toBe(40);
    expect(secondHalfChanged).toBeGreaterThan(0);
  });
});

describe('simulateMatch: statistics, ratings and markers', () => {
  const result = simulateMatch(derbyInput, params);
  const many = Array.from({ length: 300 }, (_, seed) =>
    simulateMatch(withSeed(derbyInput, seed), params),
  );

  it('splits the possession into two integers that add up to 100, within 30..70', () => {
    for (const r of many) {
      expect(Number.isInteger(r.stats.home.possession)).toBe(true);
      expect(r.stats.home.possession + r.stats.away.possession).toBe(100);
      expect(r.stats.home.possession).toBeGreaterThanOrEqual(30);
      expect(r.stats.home.possession).toBeLessThanOrEqual(70);
    }
  });

  it('rates the 22 starters, who played the 90 regulation minutes, between 3.0 and 10.0', () => {
    const starters = [...startersOf(derbyInput, 'home'), ...startersOf(derbyInput, 'away')];
    for (const r of many) {
      expect(Object.keys(r.ratings).sort()).toEqual([...starters].sort());
      for (const id of starters) {
        expect(r.minutes[id]).toBe(90);
        const rating = r.ratings[id]!;
        expect(rating).toBeGreaterThanOrEqual(RATING.min);
        expect(rating).toBeLessThanOrEqual(RATING.max);
        expect(Math.round(rating * 10) / 10).toBe(rating);
      }
      expect(r.motm).toBeDefined();
      const best = Math.max(...Object.values(r.ratings).map((v) => v ?? 0));
      expect(r.ratings[r.motm!]).toBe(best);
    }
  });

  it('rates scorers higher on average, and the winners above the losers', () => {
    let scorers = 0;
    let scorerSum = 0;
    let others = 0;
    let otherSum = 0;
    for (const r of many) {
      const scored = new Set(ofType(r, 'goal').map((g) => g.scorer));
      for (const [id, value] of Object.entries(r.ratings)) {
        if (scored.has(id)) {
          scorers++;
          scorerSum += value!;
        } else {
          others++;
          otherSum += value!;
        }
      }
    }
    expect(scorerSum / scorers).toBeGreaterThan(otherSum / others + 0.8);
  });

  it('drains energy: everyone ends below the start, the player in goal less than the others', () => {
    for (const side of ['home', 'away'] as const) {
      const starters = derbyInput[side].sheet.lineup.starters;
      const byId = new Map(derbyInput[side].players.map((p) => [p.id, p]));
      const keeper = starters[GOALKEEPER_SLOT]!;
      const keeperLoss = byId.get(keeper)!.condition - result.finalEnergy[keeper]!;
      for (const id of starters) {
        const energy = result.finalEnergy[id]!;
        expect(energy).toBeLessThan(byId.get(id)!.condition);
        expect(energy).toBeGreaterThan(55);
        if (id !== keeper) expect(byId.get(id)!.condition - energy).toBeGreaterThan(keeperLoss);
      }
    }
  });

  it('has no cards, injuries nor penalties yet (T-010)', () => {
    for (const r of many) {
      expect(r.newInjuries).toEqual([]);
      for (const side of ['home', 'away'] as const) {
        expect(r.stats[side].yellows).toBe(0);
        expect(r.stats[side].reds).toBe(0);
      }
      const types = new Set(r.events.map((e) => e.type));
      for (const t of ['yellow', 'red', 'injury', 'penaltyAwarded', 'penaltyMissed'] as const) {
        expect(types.has(t)).toBe(false);
      }
    }
  });

  it('marks the derby, the clean sheets, the thrashings, the hat-tricks and the debuts', () => {
    for (const r of many) {
      const [h, a] = r.score;
      const kinds = r.markers.map((m) => m.kind);
      expect(kinds.includes('classico')).toBe(true);
      const clean = r.markers.filter((m) => m.kind === 'semSofrerGols').map((m) => m.side);
      expect(clean).toEqual([...(a === 0 ? ['home'] : []), ...(h === 0 ? ['away'] : [])]);
      expect(kinds.includes('goleada')).toBe(Math.abs(h - a) >= 3);
      const goalsBy = new Map<string, number>();
      for (const g of ofType(r, 'goal')) goalsBy.set(g.scorer, (goalsBy.get(g.scorer) ?? 0) + 1);
      const hatTricks = r.markers.filter((m) => m.kind === 'hatTrick');
      expect(hatTricks.map((m) => m.player).sort()).toEqual(
        [...goalsBy]
          .filter(([, n]) => n >= 3)
          .map(([id]) => id)
          .sort(),
      );
      // A new game: nobody has played for the club yet, so all 22 debut.
      expect(kinds.filter((k) => k === 'estreia')).toHaveLength(22);
    }
    const plain = simulateMatch(fixtureInput(state, nonDerby), params);
    expect(plain.markers.some((m) => m.kind === 'classico')).toBe(false);
  });

  it('computes the attendance from the home stadium and fans (torcida.md)', () => {
    const fans = derbyInput.home.fans;
    const demand = 0.6 + (0.7 * fans) / 100;
    const expected = Math.round(derbyInput.capacity! * Math.min(1, 0.62 * demand * 1.25));
    expect(result.attendance).toBe(expected);
    expect(simulateMatch({ ...derbyInput, capacity: undefined }, params).attendance).toBe(0);
  });
});

describe('simulateMatch: home advantage and neutral ground', () => {
  const exact = testParams({ clubStrengthSd: 0 });
  const squads = new Map<string, TeamInput>();
  const team = (id: string, seed: number): TeamInput => {
    const key = `${id}-${seed}`;
    let input = squads.get(key);
    if (input === undefined) {
      const players = generateSquad(
        { clubId: id, seed, strength: 70, formation: '4-4-2' },
        exact,
        fixedIdentitySource(),
      ).players;
      input = teamInputFrom(id, players, { formation: '4-4-2' });
      squads.set(key, input);
    }
    return input;
  };

  function rate(neutral: boolean): { home: number; away: number } {
    let home = 0;
    let away = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const input: MatchInput = {
        fixtureId: `even-${i}`,
        seed: 1_000 + i,
        home: team('even-a', i % 20),
        away: team('even-b', 100 + (i % 20)),
        derby: false,
        neutral,
        rules: { realism: 'full' },
      };
      const [h, a] = simulateMatch(input, params).score;
      if (h > a) home++;
      if (a > h) away++;
    }
    return { home: home / n, away: away / n };
  }

  it('favours the home side, and nobody on neutral ground', () => {
    expect(homeAdvantage({ fans: 60, derby: false }, params)).toBeGreaterThan(0);
    const home = rate(false);
    expect(home.home - home.away).toBeGreaterThan(0.08);
    const neutral = rate(true);
    expect(Math.abs(neutral.home - neutral.away)).toBeLessThan(0.05);
  });
});

describe('simulateMatch: edge cases never throw (partida.md, "Casos de borda")', () => {
  const home = clubTeamInput(state, derby.homeId);
  const away = clubTeamInput(state, derby.awayId);

  function shortHanded(
    team: typeof home,
    keep: (slot: number) => boolean,
    formation = team.sheet.lineup.formation,
  ) {
    const squad = team.players;
    const full = teamInputFrom(team.clubId, squad, { formation });
    const starters = full.sheet.lineup.starters.map((id, i) =>
      keep(i) ? id : `${team.clubId}#ghost`,
    );
    return teamInputFrom(team.clubId, squad, { formation, starters });
  }

  /** Every number in the result is finite (JSON would silently turn NaN into null). */
  function expectSane(result: MatchResult): void {
    const walk = (value: unknown, path: string): void => {
      if (typeof value === 'number') expect(Number.isFinite(value), path).toBe(true);
      else if (typeof value === 'object' && value !== null) {
        for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`);
      }
    };
    walk(result, 'result');
    for (const energy of Object.values(result.finalEnergy)) {
      expect(energy).toBeGreaterThanOrEqual(0);
      expect(energy).toBeLessThanOrEqual(100);
    }
  }

  it('plays with 7 to 10 in every formation, emptying each sector, without NaN', () => {
    for (const formation of FORMATIONS) {
      const sectors = FORMATION_SECTORS[formation];
      for (const sector of ['def', 'mid', 'atk'] as const) {
        const emptied = shortHanded(home, (i) => sectors[i] !== sector, formation);
        const onPitch = emptied.sheet.lineup.starters.filter((id) => !id.endsWith('#ghost'));
        if (onPitch.length < 7) continue; // fewer than 7 ends the match (T-010)
        const result = simulateMatch({ ...derbyInput, home: emptied, away }, params);
        expectSane(result);
        expect(Object.keys(result.minutes)).toHaveLength(onPitch.length + 11);
        expect(result.warnings.some((w) => w.code === 'lineup-unknown-player')).toBe(true);
      }
      for (let missing = 1; missing <= 4; missing++) {
        const team = shortHanded(home, (i) => i === 0 || i > missing, formation);
        expectSane(simulateMatch({ ...derbyInput, home: team, away }, params));
      }
    }
  });

  it('sends the outfield player with the highest physical to goal when the goalkeeper is missing', () => {
    const noKeeper = shortHanded(home, (i) => i !== GOALKEEPER_SLOT);
    const result = simulateMatch({ ...derbyInput, home: noKeeper, away }, params);
    expectSane(result);
    const warning = result.warnings.find((w) => w.code === 'goalkeeper-from-outfield');
    expect(warning?.detail?.side).toBe('home');
    const keeper = warning!.detail!.player as string;
    for (const e of result.events) if (e.type === 'chance') expect(e.shooter).not.toBe(keeper);
  });

  it('plays a team with nobody at all, and reports an unknown formation, posture or pressure', () => {
    const empty = { ...home, players: [] };
    expectSane(simulateMatch({ ...derbyInput, home: empty, away }, params));
    const strange = {
      ...home,
      sheet: {
        lineup: { ...home.sheet.lineup, formation: '1-1-8' as never, starters: ['x', 'x'] },
        tactic: { posture: 'crazy' as never, pressure: 'max' as never },
      },
    };
    const result = simulateMatch({ ...derbyInput, home: strange, away }, params);
    expectSane(result);
    expect(result.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining([
        'lineup-unknown-formation',
        'tactic-unknown-posture',
        'tactic-unknown-pressure',
        'lineup-wrong-count',
        'lineup-unknown-player',
      ]),
    );
    const dup = {
      ...home,
      sheet: {
        ...home.sheet,
        lineup: {
          ...home.sheet.lineup,
          starters: [...home.sheet.lineup.starters.slice(0, 10), home.sheet.lineup.starters[1]!],
        },
      },
    };
    expect(
      simulateMatch({ ...derbyInput, home: dup, away }, params).warnings.map((w) => w.code),
    ).toContain('lineup-duplicate-player');
  });

  it('stays within the probability bounds at the edges of every match parameter range', () => {
    const ranges = PARAM_RANGES.match;
    const keys = [
      'baseChance',
      'kChance',
      'conversion',
      'kFinish',
      'midWeight',
      'dayFormSd',
      'homeBase',
      'missingPlayerPenalty',
      'assistShare',
    ] as const;
    for (const edge of ['min', 'max'] as const) {
      const match = { ...params.match } as Record<string, unknown>;
      for (const key of keys) match[key] = ranges[key][edge];
      match.fatigue = {
        ...params.match.fatigue,
        drainPerMinute: ranges.fatigue.drainPerMinute[edge],
      };
      const edgeParams = { ...params, match } as unknown as GameParams;
      for (let seed = 0; seed < 30; seed++) {
        const result = simulateMatch(withSeed(derbyInput, seed), edgeParams);
        expectSane(result);
      }
    }
  });

  it('accepts every formation and tactic on both sides', () => {
    for (const formation of FORMATIONS) {
      expect(FORMATION_SLOTS[formation]).toHaveLength(11);
      for (const posture of ['defensive', 'balanced', 'attacking', 'allOut'] as const) {
        for (const pressure of ['low', 'medium', 'high'] as const) {
          const team = teamInputFrom(home.clubId, home.players, {
            formation,
            tactic: { posture: posture as 'balanced', pressure },
          });
          const other = teamInputFrom(away.clubId, away.players, {
            formation,
            tactic: { posture: posture as 'balanced', pressure },
          });
          expectSane(simulateMatch({ ...derbyInput, home: team, away: other }, params));
        }
      }
    }
  });
});
