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
import { currentEff, kickoffTeam, slotEff, type TeamState } from './team.ts';
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

describe('rule 2: fatigue, minutes 60 to 80', () => {
  /** The left-back (slot 3) and the first DM (slot 5) tired, everyone else at 90. */
  function tired(): TeamState {
    const t = team();
    t.slots.forEach((s) => (s.app!.energy = 90));
    t.slots[3]!.app!.energy = 60;
    t.slots[5]!.app!.energy = 60;
    return t;
  }

  it('does nothing before minute 60 nor after 80', () => {
    expect(aiDecision(tired(), 59, 0, 0, ai)).toEqual({});
    expect(aiDecision(tired(), 81, 0, 0, ai)).toEqual({});
  });

  it('skips a tired player whose best reserve is not better now, and takes the next in slot order', () => {
    const t = tired();
    // For the left-back's slot the best reserve is the CB (70 × 0.9 = 63, fresh), below the
    // tired left-back's eff now (70 × 0.92 × 1.01 = 65.0): no. The DM of the bench beats the DM.
    expect(currentEff(t, 3)).toBeGreaterThan(slotEff(t.bench[1]!, 'FB', 100));
    const d = aiDecision(t, 60, 0, 0, ai);
    expect(d.substitution).toEqual({ index: 5, reserve: t.bench[3], reason: 'fatigue' });
    expect(d.tactic).toBeUndefined();
    expect(aiDecision(tired(), 80, 0, 0, ai).substitution?.index).toBe(5);
  });

  it('keeps one substitution for an injury until minute 80 (rule 6)', () => {
    const t = tired();
    t.subs = MAX_SUBS - 1;
    expect(aiDecision(t, 79, 0, 0, ai)).toEqual({});
    expect(aiDecision(t, IN_MATCH_AI.keepSubUntil, 0, 0, ai).substitution?.index).toBe(5);
    t.subs = MAX_SUBS;
    expect(aiDecision(t, 80, 0, 0, ai)).toEqual({});
  });

  it('only for energy below ai.subEnergy', () => {
    const t = tired();
    t.slots[5]!.app!.energy = ai.subEnergy;
    expect(aiDecision(t, 70, 0, 0, ai)).toEqual({});
  });
});

describe('rule 3: losing from minute 70 (chaotic: 60)', () => {
  /** Fresh, but the second centre-back is the weakest DM/CB slot now. */
  function losing(profile: AiProfile = 'traditional'): TeamState {
    const t = team({ profile });
    t.slots.forEach((s) => (s.app!.energy = 90));
    t.slots[2]!.app!.energy = 70;
    return t;
  }

  it('waits until minute 70', () => {
    expect(aiDecision(losing(), 69, 0, 1, ai)).toEqual({});
  });

  it('swaps the lowest-eff DM or CB for the best AM or ST of the bench and goes attacking, once', () => {
    const t = losing();
    const d = aiDecision(t, 70, 0, 1, ai);
    // For a CB slot: AM 72 × 0.70 = 50.4 beats ST 74 × 0.65 = 48.1.
    expect(d.substitution).toEqual({ index: 2, reserve: t.bench[4], reason: 'tactical' });
    expect(d.tactic).toEqual({ posture: 'attacking', pressure: 'medium' });
    expect(t.chased).toBe(true);
    t.tactic = { posture: 'attacking', pressure: 'medium' };
    expect(aiDecision(t, 71, 0, 1, ai)).toEqual({});
  });

  it('starts at minute 60 for the chaotic profile', () => {
    expect(aiDecision(losing('chaotic'), 60, 0, 1, ai).substitution?.reason).toBe('tactical');
    expect(aiDecision(losing('ambitious'), 60, 0, 1, ai)).toEqual({});
  });

  it('only changes the posture without an AM or ST on the bench, or without a substitution to spare', () => {
    const noForwards = team({
      bench: [
        ['GK', 70],
        ['CB', 70],
      ],
    });
    expect(aiDecision(noForwards, 70, 0, 1, ai)).toEqual({
      tactic: { posture: 'attacking', pressure: 'medium' },
    });
    const kept = losing();
    kept.subs = MAX_SUBS - 1;
    expect(aiDecision(kept, 70, 0, 1, ai)).toEqual({
      tactic: { posture: 'attacking', pressure: 'medium' },
    });
  });

  it('waits a minute when rule 2 used this one', () => {
    const t = losing();
    t.slots[5]!.app!.energy = 60;
    const first = aiDecision(t, 70, 0, 2, ai);
    expect(first.substitution?.reason).toBe('fatigue');
    expect(first.tactic).toBeUndefined();
    expect(t.chased).toBe(false);
  });
});

describe('rules 4 and 5: the shortcuts', () => {
  it('"todo mundo no ataque" from minute 80 when losing by one', () => {
    const t = team();
    t.chased = true;
    expect(aiDecision(t, 79, 1, 2, ai)).toEqual({});
    expect(aiDecision(t, 80, 1, 2, ai)).toEqual({
      tactic: { posture: 'allOut', pressure: 'high', preset: 'allOut' },
    });
    expect(aiDecision(t, 85, 0, 2, ai)).toEqual({});
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

  it('gives no tactic when the side already plays it', () => {
    const t = team();
    t.tactic = { posture: 'defensive', pressure: 'low' };
    expect(aiDecision(t, 85, 2, 1, ai)).toEqual({});
  });
});

type Of<T extends MatchEvent['type']> = Extract<MatchEvent, { type: T }>;
const ofType = <T extends MatchEvent['type']>(result: MatchResult, type: T): Of<T>[] =>
  result.events.filter((e): e is Of<T> => e.type === type);

describe('the AI in the match, AI against AI with its sheets', () => {
  const state = testGame();
  const inputs = state.fixtures.map((f) => aiFixtureInput(state, f));
  const MATCHES = 2_000;
  const inputFor = (seed: number): MatchInput => ({ ...inputs[seed % inputs.length]!, seed });

  it(
    'US-011: replaces an injured player in the same minute, by a reserve of the same position when he is the best',
    { timeout: 120_000 },
    () => {
      let injuries = 0;
      let samePosition = 0;
      for (let seed = 0; seed < MATCHES; seed++) {
        const input = inputFor(seed);
        const r = simulateMatch(input, params);
        r.events.forEach((e, i) => {
          if (e.type !== 'injury') return;
          const next = r.events[i + 1];
          const used = ofType(r, 'substitution').filter(
            (s) => s.side === e.side && r.events.indexOf(s) < i,
          ).length;
          if (used >= MAX_SUBS) return;
          const players = new Map(input[e.side].players.map((p) => [p.id, p] as const));
          // Reserves still on the bench when he got injured.
          const cameOn = new Set(
            r.events.slice(0, i).flatMap((s) => (s.type === 'substitution' ? [s.in] : [])),
          );
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
          const injured = players.get(e.player)!;
          const incoming = players.get(next.in)!;
          if (incoming.position === injured.position) samePosition++;
        });
      }
      expect(injuries).toBeGreaterThan(100);
      // ia-clubes.md picks by selection value; with the AI's bench (one per line) that is a
      // reserve of the same position most of the time.
      expect(samePosition / injuries).toBeGreaterThan(0.5);
    },
  );

  it(
    'never makes more than 5 substitutions, at most one tactical per minute, and keeps one until 80',
    { timeout: 120_000 },
    () => {
      for (let seed = 0; seed < MATCHES; seed++) {
        const r = simulateMatch(inputFor(seed), params);
        for (const side of ['home', 'away'] as const) {
          const subs = ofType(r, 'substitution').filter((e) => e.side === side);
          expect(subs.length).toBeLessThanOrEqual(MAX_SUBS);
          const tactical = subs.filter((e) => e.reason !== 'injury');
          const minutes = tactical.map((e) => `${e.half}-${e.minute}`);
          expect(new Set(minutes).size).toBe(minutes.length);
          subs.forEach((e, k) => {
            if (e.reason !== 'injury' && e.minute <= IN_MATCH_AI.keepSubUntil) {
              expect(k + 1).toBeLessThanOrEqual(MAX_SUBS - 1);
            }
          });
          for (const e of tactical) {
            expect(e.minute).toBeGreaterThanOrEqual(IN_MATCH_AI.chaoticChaseFrom + 1);
            expect(e.added).toBeUndefined();
          }
        }
      }
    },
  );

  it('rule 2 in a match: tired players go off between minutes 61 and 81, below ai.subEnergy', () => {
    let fatigue = 0;
    for (let seed = 0; seed < 300; seed++) {
      const base = inputFor(seed);
      // Starters back from a hard week (condition 80): they cross 65 in the second half.
      const starters = new Set(base.home.sheet.lineup.starters);
      const home = {
        ...base.home,
        players: base.home.players.map((p) => (starters.has(p.id) ? { ...p, condition: 80 } : p)),
      };
      const r = simulateMatch({ ...base, home }, params);
      for (const e of ofType(r, 'substitution')) {
        if (e.reason !== 'fatigue') continue;
        fatigue++;
        expect(e.minute).toBeGreaterThanOrEqual(IN_MATCH_AI.fatigueFrom + 1);
        expect(e.minute).toBeLessThanOrEqual(IN_MATCH_AI.fatigueTo + 1);
        expect(r.finalEnergy[e.out]!).toBeLessThan(ai.subEnergy);
      }
    }
    expect(fatigue).toBeGreaterThan(100);
  });

  it('rules 3 to 5 in a match: the tactics follow the score', () => {
    for (let seed = 0; seed < 500; seed++) {
      const r = simulateMatch(inputFor(seed), params);
      for (const e of ofType(r, 'tacticChange')) {
        // The score after the minute before the change (the AI decided then).
        const before = r.events.filter(
          (x) => x.type === 'goal' && (x.half < e.half || x.minute < e.minute),
        );
        const last = before.at(-1);
        const [h, a] = last?.type === 'goal' ? last.score : [0, 0];
        const own = e.side === 'home' ? h : a;
        const theirs = e.side === 'home' ? a : h;
        if (e.preset === 'allOut') {
          expect(theirs - own).toBe(1);
          expect(e.minute).toBeGreaterThanOrEqual(IN_MATCH_AI.allOutFrom + 1);
        } else if (e.preset === 'holdResult') {
          expect(own - theirs).toBe(1);
          expect(e.minute).toBeGreaterThanOrEqual(IN_MATCH_AI.holdFrom + 1);
        } else {
          expect(e.posture).toBe('attacking');
          expect(own).toBeLessThan(theirs);
        }
      }
    }
  });
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
