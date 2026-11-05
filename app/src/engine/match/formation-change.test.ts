import { describe, expect, it } from 'vitest';
import { FORMATIONS, FORMATION_SLOTS } from '../formations.ts';
import { Rng } from '../rng.ts';
import { FORMATION_SECTORS, GOALKEEPER_SLOT } from '../strength.ts';
import { clubTeamInput, firstDerby, testGame, testLineup } from '../testing/match.ts';
import { testParams } from '../testing/params.ts';
import { testPlayer } from '../testing/players.ts';
import type { Formation, Position } from '../types.ts';
import {
  changeFormation,
  currentStrengths,
  kickoffTeam,
  leavePitch,
  playersOnPitch,
  type TeamState,
} from './team.ts';

/*
 * Formation change during the match (docs/design/partida.md, "Troca de formação durante o jogo";
 * "Pedido ao developer" 6): the example (61.9 with a tolerance of 0.05) and, for each of the
 * 6 × 6 pairs and N from 7 to 11, never throws, leaves exactly 11 − N empty slots, keeps the
 * goalkeeper in goal and is deterministic; the same formation changes no slot.
 */
const match = testParams().match;

/** A 4-4-2 of the example: everyone at morale 50 and energy 100, with the given overalls. */
function exampleTeam(): TeamState {
  const overalls: Record<number, number> = { 5: 70, 6: 66, 9: 76, 10: 78 };
  const players = FORMATION_SLOTS['4-4-2'].map((position: Position, i) =>
    testPlayer({
      id: `ex#${i + 1}`,
      clubId: 'ex',
      position,
      overall: overalls[i] ?? 70,
      morale: 50,
      condition: 100,
      shirt: i + 1,
    }),
  );
  return kickoffTeam(
    'away',
    {
      clubId: 'ex',
      controller: 'ai',
      profile: 'traditional',
      fans: 50,
      players,
      sheet: {
        lineup: testLineup(
          '4-4-2',
          players.map((p) => p.id),
        ),
        tactic: { posture: 'balanced', pressure: 'medium' },
      },
    },
    [],
  );
}

describe('the example of partida.md (4-4-2 with 10 to 4-3-3)', () => {
  it('stays at Atk 70.7 in the 4-4-2 and goes to 61.9 in the 4-3-3', () => {
    const team = exampleTeam();
    leavePitch(team, 10); // the forward of 78 is sent off
    expect(currentStrengths(team, match).atk).toBeCloseTo(70.68, 1);

    expect(changeFormation(team, '4-3-3')).toBe(true);
    const ids = team.slots.map((s) => s.app?.player.id);
    // Step 1: the two CB, the two FB and the two AM stay; the DM of 70 takes the only DM slot;
    // the forward the first ST slot. Step 2: the DM of 66 goes up front. Step 3: the last ST is empty.
    expect(ids).toEqual([
      'ex#1',
      'ex#2',
      'ex#3',
      'ex#4',
      'ex#5',
      'ex#6',
      'ex#8',
      'ex#9',
      'ex#10',
      'ex#7',
      undefined,
    ]);
    expect(team.slots[9]!.ratingBase).toBeCloseTo(66 * 0.75, 10);
    const atk = currentStrengths(team, match).atk;
    expect(Math.abs(atk - 61.9)).toBeLessThanOrEqual(0.05);
  });

  it('changes nothing for the formation the team is already in, not even the empty slot', () => {
    const team = exampleTeam();
    leavePitch(team, 9);
    const before = team.slots.map((s) => s);
    expect(changeFormation(team, '4-4-2')).toBe(false);
    expect(team.slots).toEqual(before);
    team.slots.forEach((slot, i) => expect(slot).toBe(before[i]));
  });
});

describe('every pair of formations with 7 to 11 on the pitch', () => {
  const state = testGame();
  const derby = firstDerby(state);
  const input = clubTeamInput(state, derby.homeId);

  /** The club's best XI in `from`, with `11 − n` outfield players taken off (seeded). */
  function teamWith(from: Formation, n: number, seed: number): TeamState {
    const squad = input.players;
    const starters = FORMATION_SLOTS[from].map((position, i) => {
      const pool = squad.filter((p) => p.position === position);
      return (pool[i % pool.length] ?? squad[i]!).id;
    });
    const unique = [...new Set(starters)];
    const rest = squad.filter((p) => !unique.includes(p.id)).map((p) => p.id);
    const eleven = [...unique, ...rest].slice(0, 11);
    const team = kickoffTeam(
      'home',
      {
        ...input,
        sheet: { ...input.sheet, lineup: testLineup(from, eleven) },
      },
      [],
    );
    const rng = new Rng(seed);
    while (playersOnPitch(team) > n) {
      const outfield = team.slots.map((s, i) => i).filter((i) => i > 0 && team.slots[i]!.app);
      leavePitch(team, outfield[rng.int(0, outfield.length - 1)]!);
    }
    // Energies of the moment differ, so step 2 is not a plain overall order.
    team.slots.forEach((s, i) => {
      if (s.app !== undefined) s.app.energy = 55 + ((i * 7 + seed) % 45);
    });
    return team;
  }

  it('never throws, leaves exactly 11 − N empty, keeps the goalkeeper and is deterministic', () => {
    for (const from of FORMATIONS) {
      for (const to of FORMATIONS) {
        for (let n = 7; n <= 11; n++) {
          for (const seed of [1, 2, 3]) {
            const a = teamWith(from, n, seed);
            const b = teamWith(from, n, seed);
            const keeper = a.slots[GOALKEEPER_SLOT]!.app;
            const onPitch = new Set(a.slots.flatMap((s) => (s.app ? [s.app.player.id] : [])));
            expect(() => changeFormation(a, to)).not.toThrow();
            changeFormation(b, to);
            expect(a.formation).toBe(to);
            expect(a.slots.map((s) => s.position)).toEqual(FORMATION_SLOTS[to]);
            expect(a.slots.map((s) => s.sector)).toEqual(FORMATION_SECTORS[to]);
            expect(a.slots.filter((s) => s.app === undefined)).toHaveLength(11 - n);
            expect(a.slots[GOALKEEPER_SLOT]!.app).toBe(keeper);
            expect(new Set(a.slots.flatMap((s) => (s.app ? [s.app.player.id] : [])))).toEqual(
              onPitch,
            );
            expect(a.slots.map((s) => s.app?.player.id)).toEqual(
              b.slots.map((s) => s.app?.player.id),
            );
            const strengths = currentStrengths(a, match);
            for (const value of Object.values(strengths)) expect(Number.isNaN(value)).toBe(false);
            if (from === to) expect(changeFormation(a, to)).toBe(false);
          }
        }
      }
    }
  });

  it('keeps an outfield player who went in goal in goal', () => {
    const team = teamWith('4-3-3', 10, 4);
    leavePitch(team, GOALKEEPER_SLOT); // the outfield player with the highest physical goes in goal
    const keeper = team.slots[GOALKEEPER_SLOT]!.app!;
    expect(keeper.player.position).not.toBe('GK');
    changeFormation(team, '5-3-2');
    expect(team.slots[GOALKEEPER_SLOT]!.app).toBe(keeper);
    expect(team.slots.filter((s) => s.app === undefined)).toHaveLength(2);
  });
});
