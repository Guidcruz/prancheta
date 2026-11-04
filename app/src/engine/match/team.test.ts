import { describe, expect, it } from 'vitest';
import { FORMATION_SLOTS } from '../formations.ts';
import { effectiveRating } from '../strength.ts';
import { BALANCED, clubTeamInput, firstDerby, testGame, testLineup } from '../testing/match.ts';
import { testParams } from '../testing/params.ts';
import { EXAMPLE_STRIKER_ATTRIBUTES, testPlayer } from '../testing/players.ts';
import { goalProbability } from './rules.ts';
import {
  captainOnPitch,
  currentStrengths,
  freeKickGoalProbability,
  kickoffTeam,
  leavePitch,
  occupy,
  openPlayGoalProbability,
  penaltyGoalProbability,
  playersOnPitch,
  setPieceTaker,
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

describe('set pieces at the finish (partida.md, table "Tipo" and "Mando na finalização")', () => {
  const params = testParams();
  function side(name: 'home' | 'away') {
    const players = FORMATION_SLOTS['4-4-2'].map((position, i) =>
      i === 0
        ? testPlayer({ id: `${name}#1`, position: 'GK', overall: 66, morale: 50, shirt: 1 })
        : testPlayer({
            id: `${name}#${i + 1}`,
            position,
            morale: 50,
            shirt: i + 1,
            attributes: { ...EXAMPLE_STRIKER_ATTRIBUTES, finishing: 78, technique: 78 },
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
  const striker = (team: TeamState) => team.slots[9]!;

  it('reproduces the penalty example: 0.861 for the home taker, 0.800 for the away one, 0.828 neutral', () => {
    const home = side('home');
    const away = side('away');
    const penalty = (t: TeamState, o: TeamState) =>
      penaltyGoalProbability(t, striker(t), o, currentStrengths(o, params.match));
    expect(penalty(home, away)).toBeCloseTo(0.828, 12);
    home.home = 0.106;
    expect(penalty(home, away)).toBeCloseTo(0.861, 3);
    expect(penalty(away, home)).toBeCloseTo(0.8, 3);
  });

  it('takes the open-play pGoal with technique, home factor included, times 0.45 for a free kick', () => {
    const home = side('home');
    const away = side('away');
    home.home = 0.106;
    const fk = (t: TeamState, o: TeamState) =>
      freeKickGoalProbability(t, striker(t), o, currentStrengths(o, params.match), params.match);
    expect(fk(home, away)).toBeCloseTo(goalProbability(78 * 1.106, 66, params.match) * 0.45, 12);
    expect(fk(away, home)).toBeCloseTo(goalProbability(78, 66 * 1.106, params.match) * 0.45, 12);
    expect(fk(home, away)).toBeCloseTo(0.18 * 0.45, 3);
  });
});

describe('takers, captain and leaving the pitch (partida.md, "Capitão e cobradores")', () => {
  const state = testGame();
  const input = clubTeamInput(state, firstDerby(state).homeId);
  const ids = input.sheet.lineup.starters;

  it('picks the first of the list on the pitch, else the highest attribute in slot order', () => {
    const team = kickoffTeam('home', input, []);
    expect(setPieceTaker(team, ['nobody', ids[4]!, ids[2]!], 'finishing')).toBe(4);
    const best = (key: 'finishing' | 'technique') => {
      let index = 0;
      team.slots.forEach((s, i) => {
        if (s.app![key] > team.slots[index]!.app![key]) index = i;
      });
      return index;
    };
    expect(setPieceTaker(team, [], 'finishing')).toBe(best('finishing'));
    expect(setPieceTaker(team, [], 'technique')).toBe(best('technique'));
    leavePitch(team, 4);
    expect(setPieceTaker(team, [ids[4]!, ids[2]!], 'finishing')).toBe(2);
  });

  it('gives the armband to the list, else to the leader with the highest overall, else the oldest', () => {
    const players = input.players.map((p) => ({ ...p, trait: 'quiet' as const }));
    const quiet = kickoffTeam('home', { ...input, players }, []);
    const oldest = Math.max(...quiet.slots.map((s) => s.app!.player.age));
    expect(captainOnPitch(quiet)!.player.age).toBe(oldest);
    const leaders = [ids[3]!, ids[8]!];
    const withLeaders = kickoffTeam(
      'home',
      {
        ...input,
        players: players.map((p) => (leaders.includes(p.id) ? { ...p, trait: 'leader' } : p)),
      },
      [],
    );
    const captain = captainOnPitch(withLeaders)!;
    expect(captain.player.trait).toBe('leader');
    const byId = new Map(players.map((p) => [p.id, p]));
    expect(captain.player.overall).toBe(Math.max(...leaders.map((id) => byId.get(id)!.overall)));
    const listed = kickoffTeam(
      'home',
      {
        ...input,
        sheet: { ...input.sheet, lineup: { ...input.sheet.lineup, captains: [ids[6]!] } },
      },
      [],
    );
    expect(captainOnPitch(listed)!.player.id).toBe(ids[6]);
    leavePitch(listed, 6);
    expect(captainOnPitch(listed)!.player.id).not.toBe(ids[6]);
  });

  it('leaves the slot empty, and fills the goal from the outfield by the highest physical', () => {
    const team = kickoffTeam('home', input, []);
    leavePitch(team, 7);
    expect(team.slots[7]!.app).toBeUndefined();
    expect(playersOnPitch(team)).toBe(10);
    const keeper = team.slots[0]!.app!;
    let strongest = 1;
    team.slots.forEach((s, i) => {
      if (i > 0 && s.app && s.app.physical > team.slots[strongest]!.app!.physical) strongest = i;
    });
    const mover = team.slots[strongest]!.app!;
    leavePitch(team, 0);
    expect(keeper.onPitch).toBe(false);
    expect(team.slots[0]!.app).toBe(mover);
    expect(team.slots[strongest]!.app).toBeUndefined();
    expect(playersOnPitch(team)).toBe(9);
    // The outfield player in goal plays with fit 0.40 (partida.md, "Sem goleiro disponível").
    expect(currentStrengths(team, testParams().match).goalkeeper).toBeCloseTo(
      mover.player.overall *
        0.4 *
        (0.95 + (0.1 * mover.player.morale) / 100) *
        (0.8 + (0.2 * mover.energy) / 100),
      9,
    );
  });
});
