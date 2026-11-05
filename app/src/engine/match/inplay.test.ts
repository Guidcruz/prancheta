import { describe, expect, it } from 'vitest';
import { FORMATION_SLOTS } from '../formations.ts';
import { selectionValue } from '../selection.ts';
import { aiFixtureInput, aiTeamInput, testGame, testLineup } from '../testing/match.ts';
import { testParams } from '../testing/params.ts';
import { testPlayer, type MutablePlayer } from '../testing/players.ts';
import type { AiProfile, Position } from '../types.ts';
import { aiDecision, injuryReserve } from './inplay.ts';
import { IN_MATCH_AI, MAX_SUBS } from './rules.ts';
import { simulateMatch } from './simulate.ts';
import { currentEff, kickoffTeam, slotEff, substitute, type TeamState } from './team.ts';
import type { MatchEvent, MatchInput, MatchResult } from './types.ts';

/*
 * The AI during the match (docs/design/ia-clubes.md, "Durante o jogo", rules 1 to 6; US-011,
 * "substituição na partida"; T-012): the decisions of `aiDecision` on hand-made teams, then the
 * rules inside `simulateMatch`.
 */
const params = testParams();
const ai = params.ai;

/** A 4-4-2 of overall 70 (morale 60, fresh) with a bench of one of each line. */
function team(
  options: { profile?: AiProfile; bench?: readonly [Position, number][] } = {},
): TeamState {
  const starters = FORMATION_SLOTS['4-4-2'].map((position, i) =>
    testPlayer({ id: `t#${i + 1}`, clubId: 't', position, overall: 70, shirt: i + 1 }),
  );
  const benchSpec = options.bench ?? [
    ['GK', 70],
    ['CB', 70],
    ['FB', 50],
    ['DM', 70],
    ['AM', 72],
    ['ST', 74],
    ['ST', 68],
  ];
  const bench: MutablePlayer[] = benchSpec.map(([position, overall], i) =>
    testPlayer({ id: `t#${20 + i}`, clubId: 't', position, overall, shirt: 20 + i }),
  );
  return kickoffTeam(
    'home',
    {
      clubId: 't',
      controller: 'ai',
      profile: options.profile ?? 'traditional',
      fans: 50,
      players: [...starters, ...bench],
      sheet: {
        lineup: {
          ...testLineup(
            '4-4-2',
            starters.map((p) => p.id),
          ),
          bench: bench.map((p) => p.id),
        },
        tactic: { posture: 'balanced', pressure: 'medium' },
      },
    },
    [],
  );
}

describe('rule 1: injury', () => {
  it('takes the reserve with the highest selection value for the slot', () => {
    const t = team();
    for (let i = 0; i < 11; i++) {
      const position = t.slots[i]!.position;
      const best = Math.max(...t.bench.map((p) => selectionValue(p, position)));
      expect(selectionValue(injuryReserve(t, i)!, position)).toBe(best);
    }
    expect(injuryReserve(t, 0)!.position).toBe('GK');
  });

  it('has no reserve once the 5 substitutions are used, nor with an empty bench', () => {
    const t = team();
    t.subs = MAX_SUBS;
    expect(injuryReserve(t, 3)).toBeUndefined();
    expect(injuryReserve(team({ bench: [] }), 3)).toBeUndefined();
  });
});

describe('rule 2: fatigue, after minutes 60, 70 and 80', () => {
  /** The left-back (slot 3) and the first DM (slot 5) tired, everyone else at 90 (above 85). */
  function tired(bench?: readonly [Position, number][]): TeamState {
    const t = team(bench === undefined ? {} : { bench });
    t.slots.forEach((s) => (s.app!.energy = 90));
    t.slots[3]!.app!.energy = 60;
    t.slots[5]!.app!.energy = 70;
    return t;
  }

  it('decides only after minutes 60, 70 and 80: never after 61', () => {
    for (const minute of [59, 61, 65, 69, 71, 79, 81, 89, 90]) {
      expect(aiDecision(tired(), minute, 0, 0, ai)).toEqual({});
    }
    for (const minute of IN_MATCH_AI.fatigueMinutes) {
      expect(aiDecision(tired(), minute, 0, 0, ai).substitution?.reason).toBe('fatigue');
    }
  });

  it('with two starters below ai.subEnergy, takes off the one with the lowest energy', () => {
    const t = tired();
    // For the left-back's slot the best reserve is the CB (70 × 0.9 = 63, fresh), above 0.90 of
    // the tired left-back's eff now (70 × 0.92 = 64.4).
    const d = aiDecision(t, 60, 0, 0, ai);
    expect(d.substitution).toEqual({ index: 3, reserve: t.bench[1], reason: 'fatigue' });
    expect(d.tactic).toBeUndefined();
  });

  it('when the reserve of the most tired is worth 0.89 of him, takes off the next most tired', () => {
    // FB slot: the FB of 57 is the best reserve (57 / 64.4 = 0.885); DM slot: the DM of 66
    // beats 0.90 of the tired DM (70 × 0.94 = 65.8).
    const bench: [Position, number][] = [
      ['GK', 70],
      ['CB', 60],
      ['FB', 57],
      ['DM', 66],
      ['AM', 70],
      ['ST', 74],
      ['ST', 68],
    ];
    const t = tired(bench);
    expect(slotEff(t.bench[2]!, 'FB', 100) / currentEff(t, 3)).toBeLessThan(ai.rotationMinRatio);
    expect(aiDecision(t, 70, 0, 0, ai).substitution).toEqual({
      index: 5,
      reserve: t.bench[3],
      reason: 'fatigue',
    });
  });

  it('never takes off a substitute, even a tired one', () => {
    const t = team();
    t.slots.forEach((s) => (s.app!.energy = 90));
    substitute(t, 6, t.bench[3]!, []);
    t.slots[6]!.app!.energy = 70; // came on at 60 with condition 70
    expect(aiDecision(t, 70, 0, 0, ai)).toEqual({});
    expect(aiDecision(t, 80, 0, 0, ai)).toEqual({});
  });

  it('keeps one substitution for an injury until minute 80 (rule 6)', () => {
    const t = tired();
    t.subs = MAX_SUBS - 1;
    expect(aiDecision(t, 70, 0, 0, ai)).toEqual({});
    expect(aiDecision(t, IN_MATCH_AI.keepSubUntil, 0, 0, ai).substitution?.index).toBe(3);
    t.subs = MAX_SUBS;
    expect(aiDecision(t, 80, 0, 0, ai)).toEqual({});
  });

  it('only for energy below ai.subEnergy', () => {
    const t = tired();
    t.slots[3]!.app!.energy = ai.subEnergy;
    t.slots[5]!.app!.energy = ai.subEnergy;
    expect(aiDecision(t, 70, 0, 0, ai)).toEqual({});
  });
});

describe('rule 3: losing from minute 70 (chaotic: 60)', () => {
  /** Everyone at 90; the second forward (slot 10) is the weakest AM or ST slot now. */
  function losing(profile: AiProfile = 'traditional', bench?: readonly [Position, number][]) {
    const t = team({ profile, ...(bench === undefined ? {} : { bench }) });
    t.slots.forEach((s) => (s.app!.energy = 90));
    t.slots[10]!.app!.energy = 86;
    return t;
  }
  const attacking = { posture: 'attacking', pressure: 'medium' } as const;

  it('waits until minute 70', () => {
    expect(aiDecision(losing(), 69, 0, 1, ai)).toEqual({});
  });

  it('swaps the lowest-eff AM or ST slot for the best AM or ST of the bench, in his slot, and goes attacking', () => {
    const t = losing();
    const d = aiDecision(t, 70, 0, 1, ai);
    expect(d.substitution).toEqual({ index: 10, reserve: t.bench[5], reason: 'tactical' });
    expect(t.slots[10]!.position).toBe('ST');
    expect(d.tactic).toEqual(attacking);
    // aiDecision only reads the team: the match marks the substitution as made.
    expect(t.chased).toBe(false);
    t.chased = true;
    expect(aiDecision(t, 71, 0, 1, ai)).toEqual({ tactic: attacking });
    t.tactic = attacking;
    expect(aiDecision(t, 72, 0, 1, ai)).toEqual({});
  });

  it('goes back to attacking every minute it is losing, also after "segurar o resultado"', () => {
    const t = losing();
    t.chased = true;
    t.tactic = { posture: 'defensive', pressure: 'low' }; // was holding 1×0 from the 76th
    expect(aiDecision(t, 85, 1, 3, ai)).toEqual({
      tactic: { posture: 'attacking', pressure: 'low' },
    });
    t.tactic = { posture: 'allOut', pressure: 'high' };
    expect(aiDecision(t, 86, 1, 3, ai)).toEqual({});
  });

  it('starts at minute 60 for the chaotic profile', () => {
    expect(aiDecision(losing('chaotic'), 61, 0, 1, ai).substitution?.reason).toBe('tactical');
    expect(aiDecision(losing('ambitious'), 61, 0, 1, ai)).toEqual({});
  });

  it('only changes the posture with no AM or ST on the bench, to the end of the match', () => {
    const t = losing('traditional', [
      ['GK', 70],
      ['CB', 70],
      ['DM', 70],
    ]);
    for (const minute of [70, 75, 85, 90]) {
      t.tactic = { posture: 'balanced', pressure: 'medium' };
      expect(aiDecision(t, minute, 0, 2, ai)).toEqual({ tactic: attacking });
    }
  });

  it('with 4 substitutions made, waits for the decision of minute 80 (rule 6)', () => {
    const t = losing();
    t.subs = MAX_SUBS - 1;
    expect(aiDecision(t, 72, 0, 2, ai)).toEqual({ tactic: attacking });
    t.tactic = attacking;
    expect(aiDecision(t, 79, 0, 2, ai)).toEqual({});
    expect(aiDecision(t, 80, 0, 2, ai).substitution?.reason).toBe('tactical');
  });

  it('waits a minute when rule 2 used this one, but goes attacking at once', () => {
    const t = losing();
    t.slots[5]!.app!.energy = 60;
    const first = aiDecision(t, 70, 0, 2, ai);
    expect(first.substitution?.reason).toBe('fatigue');
    expect(first.tactic).toEqual(attacking);
    t.tactic = attacking;
    expect(aiDecision(t, 71, 0, 2, ai).substitution?.reason).toBe('tactical');
  });
});

describe('rules 4 and 5: the shortcuts', () => {
  it('"todo mundo no ataque" from minute 80 when losing by one', () => {
    const t = team();
    t.chased = true;
    expect(aiDecision(t, 79, 1, 2, ai)).toEqual({
      tactic: { posture: 'attacking', pressure: 'medium' },
    });
    expect(aiDecision(t, 80, 1, 2, ai)).toEqual({
      tactic: { posture: 'allOut', pressure: 'high', preset: 'allOut' },
    });
    expect(aiDecision(t, 90, 1, 2, ai).tactic?.preset).toBe('allOut');
    // Losing by 2: rule 3 only.
    expect(aiDecision(t, 85, 0, 2, ai)).toEqual({
      tactic: { posture: 'attacking', pressure: 'medium' },
    });
  });

  it('with rule 3 in the same minute: the substitution and "todo mundo no ataque"', () => {
    const t = team();
    const d = aiDecision(t, 80, 0, 1, ai);
    expect(d.substitution?.reason).toBe('tactical');
    expect(d.tactic).toEqual({ posture: 'allOut', pressure: 'high', preset: 'allOut' });
  });

  it('"segurar o resultado" from minute 75 when winning by one (ambitious: 80)', () => {
    expect(aiDecision(team(), 74, 2, 1, ai)).toEqual({});
    expect(aiDecision(team(), 75, 2, 1, ai)).toEqual({
      tactic: { posture: 'defensive', pressure: 'low', preset: 'holdResult' },
    });
    expect(aiDecision(team({ profile: 'ambitious' }), 79, 2, 1, ai)).toEqual({});
    expect(aiDecision(team({ profile: 'ambitious' }), 80, 2, 1, ai).tactic?.preset).toBe(
      'holdResult',
    );
    expect(aiDecision(team(), 85, 3, 1, ai)).toEqual({});
  });

  it('gives no tactic when the side already plays it, and keeps it when the score stops asking', () => {
    const t = team();
    t.tactic = { posture: 'defensive', pressure: 'low' };
    expect(aiDecision(t, 85, 2, 1, ai)).toEqual({});
    expect(aiDecision(t, 86, 2, 2, ai)).toEqual({}); // equalised: still defensive
  });
});

type Of<T extends MatchEvent['type']> = Extract<MatchEvent, { type: T }>;
const ofType = <T extends MatchEvent['type']>(result: MatchResult, type: T): Of<T>[] =>
  result.events.filter((e): e is Of<T> => e.type === type);
/** Match time of an event, comparable: added minutes after their regulation minute. */
const time = (e: MatchEvent) => (e.half - 1) * 1000 + e.minute * 10 + (e.added ?? 0);

describe('the AI in the match, AI against AI with its sheets', () => {
  const state = testGame();
  const inputs = state.fixtures.map((f) => aiFixtureInput(state, f));
  const MATCHES = 2_000;
  const inputFor = (seed: number): MatchInput => ({ ...inputs[seed % inputs.length]!, seed });
  const results = Array.from({ length: MATCHES }, (_, seed) => {
    const input = inputFor(seed);
    return { input, r: simulateMatch(input, params) };
  });

  it('US-011: replaces an injured player in the same minute, by the best reserve for the slot', () => {
    let injuries = 0;
    let withSame = 0;
    let samePosition = 0;
    for (const { input, r } of results) {
      r.events.forEach((e, i) => {
        if (e.type !== 'injury') return;
        const next = r.events[i + 1];
        const before = r.events.slice(0, i);
        const used = before.filter((s) => s.type === 'substitution' && s.side === e.side).length;
        if (used >= MAX_SUBS) return;
        const players = new Map(input[e.side].players.map((p) => [p.id, p] as const));
        // Reserves still on the bench when he got injured.
        const cameOn = new Set(before.flatMap((s) => (s.type === 'substitution' ? [s.in] : [])));
        if (input[e.side].sheet.lineup.bench.every((id) => cameOn.has(id))) return;
        injuries++;
        expect(next).toMatchObject({
          type: 'substitution',
          side: e.side,
          out: e.player,
          reason: 'injury',
          minute: e.minute,
        });
        if (next?.type !== 'substitution') return;
        // With a reserve of his position still on the bench, he is nearly always the one.
        const position = players.get(e.player)!.position;
        const left = input[e.side].sheet.lineup.bench.filter((id) => !cameOn.has(id));
        if (!left.some((id) => players.get(id)!.position === position)) return;
        withSame++;
        if (players.get(next.in)!.position === position) samePosition++;
      });
    }
    expect(injuries).toBeGreaterThan(100);
    // ia-clubes.md picks by selection value: almost always the same position (about 97%).
    expect(samePosition / withSame).toBeGreaterThan(0.9);
  });

  it('never makes more than 5 substitutions, at most one tactical per minute, and keeps one until 80', () => {
    for (const { r } of results) {
      for (const side of ['home', 'away'] as const) {
        const subs = ofType(r, 'substitution').filter((e) => e.side === side);
        expect(subs.length).toBeLessThanOrEqual(MAX_SUBS);
        const tactical = subs.filter((e) => e.reason !== 'injury');
        const moments = tactical.map(time);
        expect(new Set(moments).size).toBe(moments.length);
        subs.forEach((e, k) => {
          if (e.reason !== 'injury' && e.minute <= IN_MATCH_AI.keepSubUntil) {
            expect(k + 1).toBeLessThanOrEqual(MAX_SUBS - 1);
          }
        });
        for (const e of tactical) expect(e.minute).toBeGreaterThan(IN_MATCH_AI.chaoticChaseFrom);
      }
    }
  });

  it('rule 2: starters below ai.subEnergy go off only at 61, 71 and 81', () => {
    let fatigue = 0;
    for (const { input, r } of results) {
      for (const e of ofType(r, 'substitution')) {
        if (e.reason !== 'fatigue') continue;
        fatigue++;
        expect([61, 71, 81]).toContain(e.minute);
        expect(e.added).toBeUndefined();
        expect(input[e.side].sheet.lineup.starters).toContain(e.out);
        expect(r.finalEnergy[e.out]!).toBeLessThan(ai.subEnergy);
      }
    }
    expect(fatigue / MATCHES).toBeGreaterThan(2);
  });

  it('rule 3: once a match, an AM or ST of the bench, never in a DM or CB slot', () => {
    for (const { input, r } of results) {
      for (const side of ['home', 'away'] as const) {
        const players = new Map(input[side].players.map((p) => [p.id, p] as const));
        const chase = ofType(r, 'substitution').filter(
          (e) => e.side === side && e.reason === 'tactical',
        );
        expect(chase.length).toBeLessThanOrEqual(1);
        for (const e of chase) {
          expect(['AM', 'ST']).toContain(players.get(e.in)!.position);
          // The AI never changes formation: the player who left was in an AM or ST slot of the
          // kick-off formation, which is still the formation.
          const slot = input[side].sheet.lineup.starters.indexOf(e.out);
          if (slot >= 0) {
            const position = FORMATION_SLOTS[input[side].sheet.lineup.formation][slot];
            expect(['AM', 'ST']).toContain(position);
          }
        }
      }
    }
  });

  it('rules 3 to 5: the tactics follow the score, also in the added time of the second half', () => {
    let addedTime = 0;
    for (const { r } of results) {
      for (const e of ofType(r, 'tacticChange')) {
        // The score after the minute before the change (the AI decided then).
        const last = r.events.filter((x) => x.type === 'goal' && time(x) < time(e)).at(-1);
        const [h, a] = last?.type === 'goal' ? last.score : [0, 0];
        const own = e.side === 'home' ? h : a;
        const theirs = e.side === 'home' ? a : h;
        if (e.added !== undefined) addedTime++;
        if (e.preset === 'allOut') {
          expect(theirs - own).toBe(1);
          expect(e.minute).toBeGreaterThan(IN_MATCH_AI.allOutFrom);
        } else if (e.preset === 'holdResult') {
          expect(own - theirs).toBe(1);
          expect(e.minute).toBeGreaterThan(IN_MATCH_AI.holdFrom);
        } else {
          expect(e.posture).toBe('attacking');
          expect(own).toBeLessThan(theirs);
        }
      }
    }
    expect(addedTime).toBeGreaterThan(20);
  });

  it('a goal in 90+k that leaves the AI losing by one gives "todo mundo no ataque" in 90+(k+1)', () => {
    let checked = 0;
    for (const { input, r } of results) {
      const stoppage = ofType(r, 'stoppage')[1]?.minutes ?? 0;
      const tactic = {
        home: { ...input.home.sheet.tactic } as { posture: string; pressure: string },
        away: { ...input.away.sheet.tactic } as { posture: string; pressure: string },
      };
      for (const e of r.events) {
        if (e.type === 'tacticChange')
          tactic[e.side] = { posture: e.posture, pressure: e.pressure };
        if (e.type !== 'goal' || e.half !== 2 || e.added === undefined || e.added >= stoppage) {
          continue;
        }
        const loser = e.side === 'home' ? 'away' : 'home';
        const [h, a] = e.score;
        if ((loser === 'home' ? a - h : h - a) !== 1) continue;
        if (tactic[loser].posture === 'allOut' && tactic[loser].pressure === 'high') continue;
        // Nothing else may change the score before the next minute.
        const sameMinute = r.events.filter((x) => x.type === 'goal' && time(x) === time(e));
        if (sameMinute.at(-1) !== e) continue;
        checked++;
        const next = r.events.find(
          (x) =>
            x.type === 'tacticChange' &&
            x.side === loser &&
            x.minute === 90 &&
            x.added === (e.added ?? 0) + 1,
        );
        expect(next).toMatchObject({ preset: 'allOut', posture: 'allOut', pressure: 'high' });
      }
    }
    expect(checked).toBeGreaterThan(5);
  });
});

describe('ai.subEnergy 85 (CEO approval, ia-clubes.md "Parâmetros")', () => {
  it(
    'gives 3 to 4 substitutions per team, AI against AI, everyone fresh',
    { timeout: 120_000 },
    () => {
      const state = testGame();
      const inputs = state.fixtures.map((f) => aiFixtureInput(state, f));
      const p85 = { ...params, ai: { ...params.ai, subEnergy: 85 } };
      const p65 = { ...params, ai: { ...params.ai, subEnergy: 65 } };
      const perTeam = (p: typeof params) => {
        let subs = 0;
        for (let seed = 0; seed < 1_000; seed++) {
          const r = simulateMatch({ ...inputs[seed % inputs.length]!, seed }, p);
          subs += ofType(r, 'substitution').length;
        }
        return subs / 2_000;
      };
      const with85 = perTeam(p85);
      expect(with85).toBeGreaterThanOrEqual(3);
      expect(with85).toBeLessThanOrEqual(4);
      // With the old 65 the fatigue rule almost never fires.
      expect(perTeam(p65)).toBeLessThan(2);
    },
  );
});

describe('the coach\'s club is read as traditional (ia-clubes.md, "Clube do técnico humano")', () => {
  const state = testGame();
  const fixture = state.fixtures[5]!;
  const base = aiFixtureInput(state, fixture);
  const human = aiTeamInput(state, fixture, fixture.homeId, 'human');

  it('never gets rules 2 to 6, only the substitution of an injured player (rule 1)', () => {
    let injuries = 0;
    for (let seed = 0; seed < 500; seed++) {
      const r = simulateMatch({ ...base, seed, home: human }, params);
      expect(ofType(r, 'tacticChange').filter((e) => e.side === 'home')).toEqual([]);
      for (const e of ofType(r, 'substitution')) {
        if (e.side === 'home') expect(e.reason).toBe('injury');
      }
      injuries += ofType(r, 'substitution').filter((e) => e.side === 'home').length;
    }
    expect(injuries).toBeGreaterThan(10);
  });

  it("plays the same match whatever the club's profile", () => {
    for (let seed = 0; seed < 100; seed++) {
      const as = (profile: AiProfile) =>
        JSON.stringify(simulateMatch({ ...base, seed, home: { ...human, profile } }, params));
      expect(as('chaotic')).toBe(as('traditional'));
      expect(as('ambitious')).toBe(as('traditional'));
    }
  });
});
