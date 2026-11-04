import { describe, expect, it } from 'vitest';
import { FORMATION_SLOTS } from '../formations.ts';
import { effectiveRating } from '../strength.ts';
import { BALANCED, clubTeamInput, firstDerby, testGame, testLineup } from '../testing/match.ts';
import { testParams } from '../testing/params.ts';
import { EXAMPLE_STRIKER_ATTRIBUTES, testPlayer } from '../testing/players.ts';
import {
  currentStrengths,
  kickoffTeam,
  occupy,
  openPlayGoalProbability,
  type TeamState,
} from './team.ts';

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

describe('home advantage at the finish (partida.md, "Mando na finalização")', () => {
  const params = testParams();
  /** A 4-4-2 side: goalkeeper of overall 66, everyone else a striker of finishing 78. */
  function side(name: 'home' | 'away') {
    const players = FORMATION_SLOTS['4-4-2'].map((position, i) =>
      i === 0
        ? testPlayer({ id: `${name}#1`, position: 'GK', overall: 66, morale: 50, shirt: 1 })
        : testPlayer({
            id: `${name}#${i + 1}`,
            position,
            morale: 50,
            shirt: i + 1,
            attributes: { ...EXAMPLE_STRIKER_ATTRIBUTES, finishing: 78 },
          }),
    );
    return kickoffTeam(
      name,
      {
        clubId: name,
        controller: 'ai',
        profile: 'traditional',
        fans: 60,
        players,
        sheet: {
          lineup: testLineup(
            '4-4-2',
            players.map((p) => p.id),
          ),
          tactic: BALANCED,
        },
      },
      [],
    );
  }
  const strikerSlot = (team: TeamState) => team.slots[9]!; // a ST slot: fit 1
  const pGoal = (team: TeamState, opponent: TeamState) =>
    openPlayGoalProbability(
      team,
      strikerSlot(team),
      opponent,
      currentStrengths(opponent, params.match),
      params.match,
    );

  it('gives the same pGoal to the same squad on both sides with home = 0', () => {
    const state = testGame();
    const input = clubTeamInput(state, firstDerby(state).homeId);
    const a = kickoffTeam('home', input, []);
    const b = kickoffTeam('away', input, []);
    const sa = currentStrengths(a, params.match);
    const sb = currentStrengths(b, params.match);
    for (let i = 1; i < a.slots.length; i++) {
      const pa = openPlayGoalProbability(a, a.slots[i]!, b, sb, params.match);
      const pb = openPlayGoalProbability(b, b.slots[i]!, a, sa, params.match);
      expect(pa).toBe(pb);
    }
  });

  it('reproduces the example: finishing 78 against eff 66 with home 0.106 → 0.180 and 0.157', () => {
    const home = side('home');
    const away = side('away');
    expect(currentStrengths(home, params.match).goalkeeper).toBe(66);
    expect(pGoal(home, away)).toBeCloseTo(0.167, 3); // neutral reference
    home.home = 0.106;
    expect(pGoal(home, away)).toBeCloseTo(0.18, 3);
    expect(pGoal(away, home)).toBeCloseTo(0.157, 3);
  });

  it('leaves shot and gkEff alone with a player short or a half-time talk (no T(t))', () => {
    const home = side('home');
    const away = side('away');
    home.home = 0.106;
    const before = { home: pGoal(home, away), away: pGoal(away, home) };
    occupy(home.slots[5]!, undefined); // a player short on each side
    occupy(away.slots[6]!, undefined);
    home.halftimeBoost = 0.04;
    away.halftimeBoost = -0.03;
    expect(currentStrengths(home, params.match).factor).not.toBe(1 + home.home);
    expect(pGoal(home, away)).toBe(before.home);
    expect(pGoal(away, home)).toBe(before.away);
  });
});
