import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GameState } from './game.ts';
import { playRound } from './round.ts';
import { testParams } from './testing/params.ts';
import { ENGINE_VERSION } from './version.ts';

/*
 * A state written before T-014 (engine version 9, after 5 rounds of the 20 synthetic clubs, T-013
 * code) must load and play to the end of the season with the T-014 engine: the GameState shape did
 * not change in T-014 (only the meaning of morale, form, fans and the bench streak), so no
 * migration is needed, and nothing may throw. The save module (lib/save) does not exist yet.
 */

const params = testParams();
const legacy = JSON.parse(
  readFileSync(new URL('./__fixtures__/state-engine-v9-round-6.json', import.meta.url), 'utf8'),
) as { engineVersion: number; state: GameState };

function finish(start: GameState, realism: 'full' | 'simplified'): GameState[] {
  let state: GameState = { ...start, rules: { realism } };
  const states = [state];
  const human = Object.keys(state.clubs)[4]!;
  while (state.round <= 38) {
    const r = playRound(state, params, {
      round: state.round,
      sheets: {},
      commands: {},
      fanDecisions: { [human]: 3 },
      coaches: { [human]: 'result' },
    });
    if (!r.ok) throw new Error(`playRound round ${state.round}: ${r.error}`);
    state = r.value.state;
    states.push(state);
  }
  return states;
}

describe('a state saved by the engine before T-014', () => {
  it('is really from the older engine, in the middle of a season', () => {
    expect(legacy.engineVersion).toBe(9);
    expect(ENGINE_VERSION).toBeGreaterThan(legacy.engineVersion);
    expect(legacy.state.round).toBe(6);
  });

  it.each(['full', 'simplified'] as const)(
    'plays the 33 rounds left without throwing, in the %s realism, all values within bounds',
    (realism) => {
      const states = finish(legacy.state, realism);
      expect(states).toHaveLength(34);
      const last = states[33]!;
      expect(last.round).toBe(39);
      expect(last.engineVersion).toBe(ENGINE_VERSION);
      for (const club of Object.values(last.clubs)) {
        expect(club.fans).toBeGreaterThanOrEqual(0);
        expect(club.fans).toBeLessThanOrEqual(100);
        expect(Number.isFinite(club.idolBenchStreak)).toBe(true);
      }
      for (const p of Object.values(last.players)) {
        for (const v of [p.morale, p.condition]) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
        expect(p.recentRatings.length).toBeLessThanOrEqual(5);
        expect(Number.isInteger(p.benchStreak) && p.benchStreak >= 0).toBe(true);
      }
    },
  );

  it('is deterministic: the same old state plays the same season twice', () => {
    expect(JSON.stringify(finish(legacy.state, 'full').at(-1))).toBe(
      JSON.stringify(finish(legacy.state, 'full').at(-1)),
    );
  });
});
