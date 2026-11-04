import { describe, expect, it } from 'vitest';
import { effectiveRating } from '../strength.ts';
import { clubTeamInput, firstDerby, testGame } from '../testing/match.ts';
import { kickoffTeam } from './team.ts';

describe('team on the pitch', () => {
  const state = testGame();
  const input = clubTeamInput(state, firstDerby(state).homeId);

  it('caches the fixed part of the rating: times condMult it is effectiveRating, bit for bit', () => {
    const team = kickoffTeam('home', input, []);
    for (const energy of [100, 87.3, 61.25, 0]) {
      for (const slot of team.slots) {
        const app = slot.app!;
        const conditionPart = 0.8 + (0.2 * energy) / 100;
        expect(slot.ratingBase * conditionPart).toBe(
          effectiveRating(app.player, slot.position, energy),
        );
      }
    }
  });

  it('starts every starter at their condition, with the attributes the match reads', () => {
    const team = kickoffTeam('home', input, []);
    expect(team.appearances.map((a) => a.player.id)).toEqual(input.sheet.lineup.starters);
    for (const app of team.appearances) {
      expect(app.energy).toBe(app.player.condition);
      expect(app.physical).toBe(app.player.attributes.physical);
      // The goalkeeper has no finishing nor passing: "Atributo ausente" = round(0.4 × overall).
      if (app.player.position === 'GK') {
        expect(app.finishing).toBe(Math.round(0.4 * app.player.overall));
      } else expect(app.finishing).toBe(app.player.attributes.finishing);
    }
  });
});
