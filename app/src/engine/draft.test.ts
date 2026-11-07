import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pickBench, pickCaptainAndTakers, pickEleven, suggestSheet, validateLineup } from './ai.ts';
import { completeSheet, reshapeLineup, sheetProblems, sheetRoles } from './draft.ts';
import { FORMATION_SLOTS } from './formations.ts';
import type { GameState } from './game.ts';
import { BENCH_SIZE, type DraftLineup, type DraftSheet } from './lineup.ts';
import type { Player } from './players.ts';
import { Rng } from './rng.ts';
import { bestForSlot } from './selection.ts';
import { isAvailable } from './strength.ts';
import { deepFrozen, drawnDraft, drawnState } from './testing/draft.ts';
import { testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';
import { testPlayer } from './testing/players.ts';
import type { Formation, PlayerId, Position } from './types.ts';

/*
 * Readings of the sheet being edited (docs/02-architecture.md, 4.1, "Ficha em edição e leituras
 * para a escalação"; ADR-0021, item 8; T-076): reshapeLineup, completeSheet, sheetRoles and
 * sheetProblems, case by case. The properties are in draft.property.test.ts.
 */
const params = testParams();
const base = testGame();
const clubId = Object.keys(base.clubs)[0]!;
const otherId = Object.keys(base.clubs)[1]!;
const TACTIC = { posture: 'attacking', pressure: 'high' } as const;

/** `base` with everyone of the club fresh and available, and the given changes. */
function stateWith(changes: Record<PlayerId, Partial<Player>> = {}): GameState {
  const players = { ...base.players };
  for (const id of base.squads[clubId]!) {
    players[id] = {
      ...base.players[id]!,
      condition: 100,
      morale: 50,
      injuryRounds: 0,
      suspendedGames: 0,
      ...changes[id],
    };
  }
  return { ...base, players };
}

function draftOf(lineup: Partial<DraftLineup> & Pick<DraftLineup, 'starters'>): DraftLineup {
  return {
    formation: '4-4-2',
    bench: [],
    captains: [],
    penaltyTakers: [],
    freeKickTakers: [],
    ...lineup,
  };
}

/** The coach's suggestion in `formation` as a draft (11 starters, 7 reserves). */
function suggested(state: GameState, formation: Formation = '4-4-2'): DraftLineup {
  const { lineup } = suggestSheet(state, params, clubId, undefined, {
    controller: 'human',
    formation,
  });
  return draftOf({ ...lineup });
}

describe('reshapeLineup', () => {
  /** The example of partida.md, before the match: 4-4-2 with one forward missing, to 4-3-3. */
  function exampleState(): { state: GameState; lineup: DraftLineup } {
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
    const state = {
      players: Object.fromEntries(players.map((p) => [p.id, p])),
      squads: { ex: players.map((p) => p.id) },
    } as unknown as GameState;
    const starters = players.map((p) => p.id as PlayerId | null);
    starters[10] = null; // the forward of 78 is not there
    return { state, lineup: draftOf({ starters, captains: ['ex#4'], bench: [null] }) };
  }

  it('follows the example of partida.md: nobody leaves, the last free slot stays free', () => {
    const { state, lineup } = exampleState();
    const result = reshapeLineup(state, 'ex', lineup, '4-3-3');
    expect(result.formation).toBe('4-3-3');
    expect(result.starters).toEqual([
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
      null,
    ]);
    expect(result.bench).toEqual(lineup.bench);
    expect(result.captains).toEqual(lineup.captains);
  });

  it('moves an unavailable starter like anyone else and turns an id out of the squad into a free slot', () => {
    const { state, lineup } = exampleState();
    const injured = {
      ...state,
      players: { ...state.players, 'ex#6': { ...state.players['ex#6']!, injuryRounds: 3 } },
    };
    const starters = [...lineup.starters];
    starters[2] = 'outro#1';
    const result = reshapeLineup(injured, 'ex', { ...lineup, starters }, '4-3-3');
    expect(result.starters).toContain('ex#6');
    expect(result.starters).not.toContain('outro#1');
    expect(result.starters.filter((id) => id === null)).toHaveLength(2);
  });

  it('returns the same lineup for the formation it is already in', () => {
    const state = stateWith();
    const lineup = suggested(state, '3-5-2');
    const free = { ...lineup, starters: lineup.starters.map((id, i) => (i === 4 ? null : id)) };
    expect(reshapeLineup(state, clubId, free, '3-5-2')).toEqual(free);
    expect(reshapeLineup(state, clubId, free, 'x' as Formation)).toEqual(free);
  });
});

describe('completeSheet', () => {
  it('fills a free slot with the best reserve of the bench for it, then from the rest', () => {
    const state = stateWith();
    const full = suggested(state);
    const players = (ids: readonly (PlayerId | null)[]) =>
      ids.filter((id): id is PlayerId => id !== null).map((id) => state.players[id]!);
    // Slot 9 (ST) free: the best ST of the bench for the slot.
    const starters = full.starters.map((id, i) => (i === 9 ? null : id));
    const draft: DraftSheet = { lineup: { ...full, starters }, tactic: TACTIC };
    const result = completeSheet(state, clubId, draft);
    const expected = bestForSlot(players(full.bench), 'ST')!;
    expect(result.lineup.starters[9]).toBe(expected.id);
    expect(result.lineup.starters.filter((_, i) => i !== 9)).toEqual(
      full.starters.filter((_, i) => i !== 9),
    );
    expect(result.lineup.bench).toHaveLength(BENCH_SIZE);
    expect(result.lineup.bench).not.toContain(expected.id);
    expect(result.tactic).toEqual(TACTIC);
    expect(validateLineup(state, clubId, result).ok).toBe(true);

    // Empty bench: the best player off the sheet.
    const noBench = completeSheet(state, clubId, {
      lineup: { ...full, starters, bench: [] },
      tactic: TACTIC,
    });
    const used = new Set(starters);
    const rest = state.squads[clubId]!.map((id) => state.players[id]!).filter(
      (p) => !used.has(p.id),
    );
    expect(noBench.lineup.starters[9]).toBe(bestForSlot(rest, 'ST')!.id);
    expect(validateLineup(state, clubId, noBench).ok).toBe(true);
  });

  it('replaces an unavailable or repeated starter, drops him from the sheet and refills the bench', () => {
    const full = suggested(stateWith());
    const injured = full.starters[5]!;
    const benchInjured = full.bench[2]!;
    const state = stateWith({
      [injured]: { injuryRounds: 2 },
      [benchInjured]: { suspendedGames: 1 },
    });
    const starters = [...full.starters];
    starters[7] = starters[1]!; // repeated
    const draft: DraftSheet = {
      lineup: {
        ...full,
        starters,
        captains: [injured, full.starters[3]!],
        penaltyTakers: [injured],
      },
      tactic: TACTIC,
    };
    const result = completeSheet(state, clubId, draft);
    expect(validateLineup(state, clubId, result).ok).toBe(true);
    expect(result.lineup.starters).not.toContain(injured);
    expect(result.lineup.bench).not.toContain(injured);
    expect(result.lineup.bench).not.toContain(benchInjured);
    expect(result.lineup.bench).toHaveLength(BENCH_SIZE);
    expect(result.lineup.starters[1]).toBe(full.starters[1]);
    expect(new Set(result.lineup.starters).size).toBe(11);
    expect(result.lineup.captains).toEqual([full.starters[3]]);
    expect(result.lineup.penaltyTakers).toEqual([]);
    // The kept reserves first, in sheet order; then pickBench of what is left.
    const kept = full.bench.filter(
      (id) => id !== benchInjured && !result.lineup.starters.includes(id!),
    );
    expect(result.lineup.bench.slice(0, kept.length)).toEqual(kept);
  });

  it('with fewer than 11 available: all of them by pickEleven without rotation, empty bench', () => {
    const squad = base.squads[clubId]!;
    const out = Object.fromEntries(squad.slice(9).map((id) => [id, { injuryRounds: 1 }]));
    const state = stateWith(out);
    const available = squad.map((id) => state.players[id]!).filter(isAvailable);
    expect(available).toHaveLength(9);
    const draft = drawnDraft(state, clubId, new Rng(3));
    const result = completeSheet(state, clubId, draft);
    const formation = draft.lineup.formation;
    const xi = pickEleven(available, formation, { rotationCondition: 0, rotationMinRatio: 1 });
    expect(result.lineup.starters).toEqual(xi.starters.map((p) => p.id));
    expect(result.lineup.bench).toEqual([]);
    expect(validateLineup(state, clubId, result).ok).toBe(true);
  });

  it('gives the empty sheet of suggestSheet for a club with no squad, with the sheet tactic', () => {
    const draft = drawnDraft(base, clubId, new Rng(5));
    const result = completeSheet(base, 'nao-existe', { ...draft, tactic: TACTIC });
    const empty = suggestSheet(base, params, 'nao-existe');
    expect(result).toEqual({ lineup: empty.lineup, tactic: TACTIC });
  });

  it('fills the bench in pickBench order from an empty bench', () => {
    const state = stateWith();
    const full = suggested(state);
    const result = completeSheet(state, clubId, {
      lineup: { ...full, bench: [null, null] },
      tactic: TACTIC,
    });
    const rest = state.squads[clubId]!.map((id) => state.players[id]!).filter(
      (p) => !full.starters.includes(p.id),
    );
    expect(result.lineup.bench).toEqual(pickBench(rest).map((p) => p.id));
  });
});

describe('sheetRoles', () => {
  it('takes the first of each list who is an available starter', () => {
    const full = suggested(stateWith());
    const [a, b, c] = [full.starters[2]!, full.starters[4]!, full.starters[6]!];
    const benchId = full.bench[0]!;
    const state = stateWith({ [b]: { injuryRounds: 1 } });
    const roles = sheetRoles(state, clubId, {
      ...full,
      captains: [benchId, b, a],
      penaltyTakers: [c],
      freeKickTakers: ['outro#1', a],
    });
    expect(roles.captain).toEqual({ player: a, auto: false });
    expect(roles.penalty).toEqual({ player: c, auto: false });
    expect(roles.freeKick).toEqual({ player: a, auto: false });
  });

  it('falls back to the automatic rule of the AI on the available starters', () => {
    const full = suggested(stateWith());
    const out = full.starters[0]!;
    const state = stateWith({ [out]: { suspendedGames: 1 } });
    const lineup = { ...full, captains: [], penaltyTakers: [], freeKickTakers: [] };
    const candidates = full.starters.slice(1).map((id) => state.players[id!]!);
    const auto = pickCaptainAndTakers(candidates);
    const roles = sheetRoles(state, clubId, lineup);
    expect(roles.captain).toEqual({ player: auto.captains[0], auto: true });
    expect(roles.penalty).toEqual({ player: auto.penaltyTakers[0], auto: true });
    expect(roles.freeKick).toEqual({ player: auto.freeKickTakers[0], auto: true });
  });

  it('picks the leader of highest overall, else the oldest', () => {
    const players = (['GK', 'CB', 'ST'] as const).map((position, i) =>
      testPlayer({ id: `r#${i + 1}`, clubId: 'r', position, overall: 60 + i, age: 30 - i }),
    );
    const state = {
      players: Object.fromEntries(players.map((p) => [p.id, p])),
      squads: { r: players.map((p) => p.id) },
    } as unknown as GameState;
    const lineup = draftOf({ starters: ['r#1', 'r#2', 'r#3'] });
    expect(sheetRoles(state, 'r', lineup).captain).toEqual({ player: 'r#1', auto: true });
    const leaders = {
      ...state,
      players: {
        ...state.players,
        'r#2': { ...state.players['r#2']!, trait: 'leader' },
        'r#3': { ...state.players['r#3']!, trait: 'leader' },
      },
    } as GameState;
    expect(sheetRoles(leaders, 'r', lineup).captain).toEqual({ player: 'r#3', auto: true });
  });

  it('has no holder without an available starter', () => {
    const empty = draftOf({ starters: Array.from({ length: 11 }, () => null), captains: ['x'] });
    const roles = sheetRoles(base, clubId, empty);
    expect(roles).toEqual({
      captain: { auto: true },
      penalty: { auto: true },
      freeKick: { auto: true },
    });
    expect(sheetRoles(base, 'nao-existe', suggested(stateWith())).captain).toEqual({
      auto: true,
    });
  });
});

describe('sheetProblems', () => {
  it('is ready for the suggestion and lists every problem otherwise, starters before bench', () => {
    const full = suggested(stateWith());
    const ok = sheetProblems(stateWith(), clubId, { lineup: full, tactic: TACTIC });
    expect(ok).toEqual({ ready: true, available: 25, missing: 0, problems: [] });

    const injured = full.starters[3]!;
    const state = stateWith({ [injured]: { injuryRounds: 1 } });
    const foreign = base.squads[otherId]![0]!;
    const starters = [...full.starters];
    starters[1] = null;
    starters[6] = foreign;
    starters[8] = starters[2]!;
    const foreignBench = base.squads[otherId]![1]!;
    const bench = [full.bench[0]!, null, starters[2]!, foreignBench, injured];
    const check = sheetProblems(state, clubId, {
      lineup: { ...full, starters, bench },
      tactic: TACTIC,
    });
    expect(check.ready).toBe(false);
    expect(check.available).toBe(24);
    expect(check.missing).toBe(4);
    expect(check.problems).toEqual([
      { part: 'starters', index: 1, reason: 'empty' },
      { part: 'starters', index: 3, reason: 'unavailable', player: injured },
      { part: 'starters', index: 6, reason: 'wrong-club', player: foreign },
      { part: 'starters', index: 8, reason: 'duplicate', player: starters[2] },
      { part: 'bench', index: 2, reason: 'duplicate', player: starters[2] },
      { part: 'bench', index: 3, reason: 'wrong-club', player: foreignBench },
      { part: 'bench', index: 4, reason: 'duplicate', player: injured },
    ]);
  });

  it('does not block on the free slots of players who do not exist (fewer than 11 available)', () => {
    const squad = base.squads[clubId]!;
    const state = stateWith(
      Object.fromEntries(squad.slice(9).map((id) => [id, { injuryRounds: 1 }])),
    );
    const nine = squad.slice(0, 9);
    const starters = [null, ...nine, null];
    const ready = sheetProblems(state, clubId, {
      lineup: draftOf({ starters }),
      tactic: TACTIC,
    });
    expect(ready).toEqual({ ready: true, available: 9, missing: 0, problems: [] });
    const eight = sheetProblems(state, clubId, {
      lineup: draftOf({ starters: [null, ...nine.slice(1), null, null] }),
      tactic: TACTIC,
    });
    expect(eight.missing).toBe(1);
    expect(eight.problems.map((p) => p.index)).toEqual([0, 9, 10]);
  });

  it('counts 11 missing with nobody available, as validateLineup', () => {
    const squad = base.squads[clubId]!;
    const state = stateWith(Object.fromEntries(squad.map((id) => [id, { suspendedGames: 1 }])));
    const check = sheetProblems(state, clubId, {
      lineup: draftOf({ starters: Array.from({ length: 11 }, () => null) }),
      tactic: TACTIC,
    });
    expect(check).toMatchObject({ ready: false, available: 0, missing: 11 });
    expect(check.problems).toHaveLength(11);
    const unknown = sheetProblems(base, 'nao-existe', {
      lineup: suggested(stateWith()),
      tactic: TACTIC,
    });
    expect(unknown.ready).toBe(false);
    expect(
      unknown.problems.every((p) => p.reason === 'wrong-club' || p.reason === 'duplicate'),
    ).toBe(true);
  });
});

describe('purity (no Rng, input unchanged, same answer)', () => {
  it('never imports the Rng', () => {
    const source = readFileSync(new URL('./draft.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/^import .*rng\.ts/m);
    expect(source).not.toMatch(/new Rng\(|Math\.random|Date\.now/);
  });

  it('changes no input and answers the same twice', () => {
    const rng = new Rng(17);
    const state = deepFrozen(drawnState(base, clubId, rng));
    const sheet = deepFrozen(drawnDraft(state, clubId, rng));
    const run = () => ({
      reshape: reshapeLineup(state, clubId, sheet.lineup, '5-3-2'),
      complete: completeSheet(state, clubId, sheet),
      roles: sheetRoles(state, clubId, sheet.lineup),
      problems: sheetProblems(state, clubId, sheet),
    });
    expect(run()).toEqual(run());
  });
});
