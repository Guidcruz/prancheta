import { describe, expect, it } from 'vitest';
import { attributeOf } from '@engine';
import { testMatches } from '../ui/testing/matches';
import { physicalOf } from '../ui/match/pitch/scene';

/* The pitch reads `physical` as the engine does (`fillEmptyGoal`, D5-A of campo-lances.md). */
describe('physicalOf equals the engine attributeOf', () => {
  it('for every player of the test matches, and for a player without the attribute', () => {
    for (const { match } of testMatches()) {
      for (const player of [...match.home.players, ...match.away.players]) {
        expect(physicalOf(player)).toBe(attributeOf(player, 'physical'));
      }
    }
    const base = testMatches()[0]!.match.home.players[0]!;
    for (const overall of [1, 40, 63, 77, 99]) {
      const bare = { ...base, overall, attributes: {} };
      expect(physicalOf(bare)).toBe(attributeOf(bare, 'physical'));
    }
  });
});
