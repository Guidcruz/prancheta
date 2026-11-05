import { describe, expect, it } from 'vitest';
import type { MatchCommand, MatchResult } from './match/types.ts';
import { playRound, prepareRound } from './round.ts';
import { testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';
import type { TeamSheet } from './lineup.ts';

/*
 * T-016 acceptance, at the round level (US-007/US-008 "tudo no ataque" only from minute 60;
 * US-021): the rule reaches the match played by playRound, as the live screen would give it.
 * The match-level cases are in match/commands.test.ts and match/simulate.test.ts.
 */

const params = testParams();
const COACH = 'clube-teste-05';
const played = (r: MatchResult) => JSON.stringify({ ...r, warnings: [] });

function setup() {
  const state = testGame();
  const plan = prepareRound(state, params, { coaches: { [COACH]: 'full' } });
  if (!plan.ok) throw new Error('prepareRound');
  const match = plan.value.matches.find((m) => m.home.clubId === COACH || m.away.clubId === COACH)!;
  const side = match.home.clubId === COACH ? 'home' : 'away';
  const round = (cmds: readonly MatchCommand[], sheet?: TeamSheet) => {
    const r = playRound(state, params, {
      round: state.round,
      sheets: sheet === undefined ? {} : { [COACH]: sheet },
      commands: { [match.fixtureId]: cmds },
      fanDecisions: {},
      coaches: { [COACH]: 'full' },
    });
    if (!r.ok) throw new Error(`playRound: ${r.error}`);
    return r.value.report.results.find((x) => x.fixtureId === match.fixtureId)!;
  };
  return { match, side, round };
}

describe('"tudo no ataque" through playRound (T-016)', () => {
  it("a preset or posture command at 30' is ignored with command-too-early, as without it", () => {
    const { side, round } = setup();
    const plain = round([]);
    for (const command of [
      { minute: 30, side, kind: 'preset', preset: 'allOut' },
      { minute: 30, side, kind: 'tactic', posture: 'allOut' },
    ] as MatchCommand[]) {
      const r = round([command]);
      expect(played(r)).toBe(played(plain));
      expect(r.warnings.map((w) => w.code)).toEqual(['command-too-early']);
    }
  });

  it("at 60' (screen minute 59 or 60) the command applies, with no warning", () => {
    const { side, round } = setup();
    for (const minute of [59, 60]) {
      for (const command of [
        { minute, side, kind: 'preset', preset: 'allOut' },
        { minute, side, kind: 'tactic', posture: 'allOut' },
      ] as MatchCommand[]) {
        const r = round([command]);
        expect(r.warnings).toEqual([]);
        expect(r.events).toContainEqual(
          expect.objectContaining({ type: 'tacticChange', side, posture: 'allOut' }),
        );
      }
    }
  });

  it('a human sheet with the posture allOut (damaged save) plays as balanced, with a warning', () => {
    const { match, side, round } = setup();
    const mine = (side === 'home' ? match.home : match.away).sheet;
    const damaged = {
      ...mine,
      tactic: { ...mine.tactic, posture: 'allOut' as unknown as 'balanced' },
    };
    const balanced = { ...mine, tactic: { ...mine.tactic, posture: 'balanced' as const } };
    const a = round([], damaged);
    const b = round([], balanced);
    expect(played(a)).toBe(played(b));
    expect(a.warnings.map((w) => w.code)).toContain('tactic-unknown-posture');
  });
});
