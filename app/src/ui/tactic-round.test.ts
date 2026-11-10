import { describe, expect, it } from 'vitest';
import { playRound, type MatchEvent, type PlayerId, type Side } from '@engine';
import { loadGameParams } from '@lib/params';
import { addToRole, removeFromRole, roundSheet, withFormation, withTactic } from './tactic';
import { TEST_CLUB, testCareer } from './testing/game';
import { lineupFixture } from './testing/lineup';

/*
 * US-018, "capitão e cobradores" and "tática é salva para a rodada", all the way through the
 * engine (T-077, QA): the round is played from the sheet the screen builds (`roundSheet`) and the
 * match report is read, not only the sheet handed to the engine. The goalkeeper heads the penalty
 * and free-kick lists: he is never the engine's own pick, so a taker that is him proves that the
 * list of the screen, in its order, decided who took it.
 */

const params = loadGameParams();
const SEEDS = Array.from({ length: 40 }, (_, i) => 3000 + i);

/** Who was taken off the pitch (red card or substituted) in `events` up to `index`, for `side`. */
function offBefore(events: readonly MatchEvent[], index: number, side: Side): Set<PlayerId> {
  const off = new Set<PlayerId>();
  for (const e of events.slice(0, index)) {
    if (!('side' in e) || e.side !== side) continue;
    if (e.type === 'red') off.add(e.player);
    if (e.type === 'substitution') off.add(e.out);
    if (e.type === 'injury') off.add(e.player); // may play on: the check below skips these
  }
  return off;
}

describe('the round is played from the sheet of the screen (US-018)', () => {
  const taken = { penalty: 0, freeKick: 0 };

  for (const seed of SEEDS) {
    it(`seed ${seed}: penalties and free kicks of the coach's club go to the first of his list`, () => {
      const fx = lineupFixture(testCareer('full', 1, seed));
      const starters = fx.sheet.lineup.starters as PlayerId[];
      const keeper = starters[0]!;
      const second = starters[10]!;
      let sheet = fx.sheet;
      for (const role of ['penalty', 'freeKick', 'captain'] as const) {
        for (const id of role === 'captain' ? [second] : [keeper, second]) {
          sheet = addToRole(sheet, role, id)!;
        }
      }
      sheet = withTactic(withFormation(fx.game, TEST_CLUB, sheet, '4-3-3')!, {
        posture: 'attacking',
        pressure: 'high',
      })!;
      const sent = roundSheet(fx.game, TEST_CLUB, sheet, false, true)!;
      expect(sent.lineup.formation).toBe('4-3-3');
      expect(sent.lineup.penaltyTakers).toEqual([keeper, second]);

      const played = playRound(fx.game, params, {
        round: fx.game.round,
        sheets: { [TEST_CLUB]: sent },
        commands: {},
        fanDecisions: {},
        coaches: { [TEST_CLUB]: 'result' },
      });
      if (!played.ok) throw new Error(played.error);
      const fixture = played.value.state.fixtures.find(
        (f) => f.round === fx.game.round && (f.homeId === TEST_CLUB || f.awayId === TEST_CLUB),
      )!;
      const side: Side = fixture.homeId === TEST_CLUB ? 'home' : 'away';
      const result = played.value.report.results.find((r) => r.fixtureId === fixture.id)!;

      // Only the 11 and the bench of the sheet took the pitch for the coach's club.
      const squad = new Set<PlayerId>([
        ...starters,
        ...(sent.lineup.bench.filter((id) => id !== null) as PlayerId[]),
      ]);
      for (const e of result.events) {
        if (e.type === 'goal' && e.side === side) expect(squad.has(e.scorer)).toBe(true);
        if (e.type === 'substitution' && e.side === side) expect(squad.has(e.in)).toBe(true);
      }

      result.events.forEach((e, i) => {
        if (!('side' in e) || e.side !== side) return;
        const off = offBefore(result.events, i, side);
        if (off.has(keeper)) return; // gone (or hurt) before: the next of the list, not asserted
        if (e.type === 'penaltyAwarded') {
          taken.penalty++;
          expect(e.taker).toBe(keeper);
        }
        if (e.type === 'chance' && e.kind === 'freeKick') {
          taken.freeKick++;
          expect(e.shooter).toBe(keeper);
        }
      });
    });
  }

  it('the 40 rounds had penalties and free kicks to check (not a vacuous pass)', () => {
    expect(taken.penalty).toBeGreaterThan(0);
    expect(taken.freeKick).toBeGreaterThan(0);
  });

  it('a list emptied on the screen goes back to the engine pick, who is not the goalkeeper', () => {
    const fx = lineupFixture(testCareer('full', 1, SEEDS[0]));
    const starters = fx.sheet.lineup.starters as PlayerId[];
    const full = addToRole(fx.sheet, 'penalty', starters[0]!)!;
    const emptied = removeFromRole(full, 'penalty', starters[0]!)!;
    expect(emptied.lineup.penaltyTakers).toEqual([]);
    expect(roundSheet(fx.game, TEST_CLUB, emptied, false, true)!.lineup.penaltyTakers).toEqual([]);
  });
});
