import { describe, expect, it } from 'vitest';
import { aiTeamInput, fixtureInput, testGame } from '../testing/match.ts';
import { testParams } from '../testing/params.ts';
import type { Side } from '../types.ts';
import { HALFTIME_CHOICES, HALFTIME_TALKS, halftimeBoost } from './rules.ts';
import { simulateMatch } from './simulate.ts';
import type { HalftimeChoice, MatchCommand, MatchEvent, MatchInput, MatchResult } from './types.ts';

/*
 * US-022 (docs/01-requirements.md): the coach's half-time talk (partida.md, "Conversa no
 * intervalo"; T-012). The talk is a command of minute 45 that sets `halftimeBoost` of the second
 * half by the half-time score; without one, the AI's talk is used (the coach's club as
 * traditional). The chaotic side's draw happens even when the coach chose, so the choice changes
 * only the talk.
 */
const params = testParams();
const state = testGame();
const fixture = state.fixtures.find((f) => !state.clubs[f.homeId]!.def.rivals.includes(f.awayId))!;
const coached: MatchInput = {
  ...fixtureInput(state, fixture),
  home: aiTeamInput(state, fixture, fixture.homeId, 'human'),
  away: aiTeamInput(state, fixture, fixture.awayId),
};

const talk = (choice: HalftimeChoice, side: Side = 'home'): MatchCommand => ({
  minute: 45,
  side,
  kind: 'halftimeTalk',
  talk: choice,
});

const firstHalf = (r: MatchResult) =>
  r.events.filter((e) => e.half === 1 && e.type !== 'halftimeTalk');
const talkOf = (r: MatchResult, side: Side) =>
  r.events.find(
    (e): e is Extract<MatchEvent, { type: 'halftimeTalk' }> =>
      e.type === 'halftimeTalk' && e.side === side,
  )!.talk;

/** Chances created by `side` in the second half. */
function secondHalfChances(r: MatchResult, side: Side): number {
  return r.events.filter(
    (e) =>
      e.half === 2 &&
      (e.type === 'chance' || e.type === 'goal' || e.type === 'penaltyMissed') &&
      e.side === side,
  ).length;
}

describe('US-022: the coach chooses the half-time talk', () => {
  it('uses the chosen talk, with the same first half and a deterministic result for each choice', () => {
    for (let seed = 0; seed < 100; seed++) {
      const input = { ...coached, seed };
      const runs = HALFTIME_TALKS.map((choice) => simulateMatch(input, params, [talk(choice)]));
      runs.forEach((r, i) => {
        expect(talkOf(r, 'home')).toBe(HALFTIME_TALKS[i]);
        expect(JSON.stringify(firstHalf(r))).toBe(JSON.stringify(firstHalf(runs[0]!)));
        expect(JSON.stringify(simulateMatch(input, params, [talk(HALFTIME_TALKS[i]!)]))).toBe(
          JSON.stringify(r),
        );
      });
    }
  });

  it(
    'changes the second half as the rule says: losing at half time, "Cobrar" (+4%) creates more than "Acalmar" (−2%)',
    { timeout: 120_000 },
    () => {
      const created = { demand: 0, calm: 0 };
      let losing = 0;
      for (let seed = 0; losing < 600 && seed < 5_000; seed++) {
        const input = { ...coached, seed };
        const demand = simulateMatch(input, params, [talk('demand')]);
        const halftime = demand.events.find((e) => e.type === 'halftime');
        if (halftime?.type !== 'halftime' || !(halftime.score[0] < halftime.score[1])) continue;
        losing++;
        created.demand += secondHalfChances(demand, 'home');
        created.calm += secondHalfChances(simulateMatch(input, params, [talk('calm')]), 'home');
      }
      expect(losing).toBe(600);
      expect(created.demand).toBeGreaterThan(created.calm);
    },
  );

  it("without a choice, the coach's club gets the traditional talk", () => {
    for (let seed = 0; seed < 50; seed++) {
      const input = { ...coached, seed };
      const none = simulateMatch(input, params);
      const own = talkOf(none, 'home');
      // The traditional table: cobrar / motivar / acalmar by losing / drawing / winning.
      expect(JSON.stringify(simulateMatch(input, params, [talk(own)]))).toBe(JSON.stringify(none));
    }
  });

  it("never shifts the chaotic opponent's draw: the coach's choice changes only his own talk", () => {
    const chaotic: MatchInput = { ...coached, away: { ...coached.away, profile: 'chaotic' } };
    for (let seed = 0; seed < 50; seed++) {
      const input = { ...chaotic, seed };
      const none = simulateMatch(input, params);
      for (const choice of HALFTIME_CHOICES) {
        const r = simulateMatch(input, params, [talk(choice)]);
        expect(talkOf(r, 'away')).toBe(talkOf(none, 'away'));
        expect(JSON.stringify(firstHalf(r))).toBe(JSON.stringify(firstHalf(none)));
      }
    }
  });

  it('ignores a talk for the AI side, with command-ai-side', () => {
    const none = simulateMatch(coached, params);
    const r = simulateMatch(coached, params, [talk('demand', 'away')]);
    expect(JSON.stringify(r.events)).toBe(JSON.stringify(none.events));
    expect(r.warnings.map((w) => w.code)).toEqual(['command-ai-side']);
  });

  it('counts only the first talk of a side, with a warning for the others', () => {
    const r = simulateMatch(coached, params, [talk('calm'), talk('demand')]);
    expect(talkOf(r, 'home')).toBe('calm');
    expect(r.warnings).toEqual([
      {
        code: 'command-duplicate-talk',
        detail: { command: 1, side: 'home', minute: 45, kind: 'halftimeTalk' },
      },
    ]);
  });
});

describe('US-022: "Pular" leaves the second half without a talk', () => {
  /** The match with every non-skip talk event read as `skip`, to compare the rest. */
  const asSkip = (r: MatchResult) =>
    JSON.stringify(
      r.events.map((e) =>
        e.type === 'halftimeTalk' && e.side === 'home' ? { ...e, talk: 'skip' } : e,
      ),
    );

  it('has a halftimeBoost of 0 at any score, even with a leader captain', () => {
    for (const leader of [false, true]) {
      for (const [own, other] of [
        [0, 1],
        [1, 1],
        [2, 1],
      ] as const) {
        expect(halftimeBoost('skip', own, other, leader)).toBe(0);
      }
    }
  });

  it(
    'plays the second half like a talk worth 0 and without "Acalmar"\'s yellows ×0.75, leader captain or not',
    { timeout: 120_000 },
    () => {
      // Winning, "Motivar" is worth 0; drawing, "Cobrar" is: neither is "Acalmar". So "Pular" must
      // give the same match, byte for byte, but for the talk itself.
      const starters = coached.home.sheet.lineup.starters;
      const leaderId = starters[4]!;
      const led: MatchInput = {
        ...coached,
        home: {
          ...coached.home,
          players: coached.home.players.map((p) =>
            p.id === leaderId ? { ...p, trait: 'leader' } : p,
          ),
          sheet: {
            ...coached.home.sheet,
            lineup: { ...coached.home.sheet.lineup, captains: [leaderId] },
          },
        },
      };
      let compared = 0;
      for (const base of [coached, led]) {
        for (let seed = 0; seed < 300; seed++) {
          const input = { ...base, seed };
          const skip = simulateMatch(input, params, [talk('skip')]);
          expect(talkOf(skip, 'home')).toBe('skip');
          const halftime = skip.events.find((e) => e.type === 'halftime');
          if (halftime?.type !== 'halftime') continue; // abandoned before half time
          const [h, a] = halftime.score;
          if (h < a) continue; // losing: every talk is worth something
          const zero: HalftimeChoice = h > a ? 'motivate' : 'demand';
          const same = simulateMatch(input, params, [talk(zero)]);
          expect(asSkip(same)).toBe(JSON.stringify(skip.events));
          compared++;
        }
      }
      expect(compared).toBeGreaterThan(300);
    },
  );

  it('differs from the AI\'s talk when there is no command: no command is not "Pular"', () => {
    let different = 0;
    for (let seed = 0; seed < 100; seed++) {
      const input = { ...coached, seed };
      const none = simulateMatch(input, params);
      const skip = simulateMatch(input, params, [talk('skip')]);
      // The traditional talk is never worth 0, so its event differs from "Pular" in every match;
      // a 2% to 4% effect changes the play itself only in some of them.
      expect(talkOf(none, 'home')).not.toBe('skip');
      if (asSkip(none) !== JSON.stringify(skip.events)) different++;
    }
    expect(different).toBeGreaterThan(10);
  });
});
