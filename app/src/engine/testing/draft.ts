/**
 * Sheets being edited for the tests of the lineup readings (T-076; docs/02-architecture.md, 4.1,
 * "Ficha em edição e leituras para a escalação"): a state with random availability, condition
 * and morale for one club, and random drafts and team sheets of that club.
 *
 * Test-only code: never imported by `index.ts`.
 */
import { suggestSheet } from '../ai.ts';
import { FORMATIONS } from '../formations.ts';
import type { GameState } from '../game.ts';
import { BENCH_SIZE, type DraftSheet, type TeamSheet } from '../lineup.ts';
import type { Player } from '../players.ts';
import type { Rng } from '../rng.ts';
import type { ClubId, Formation, PlayerId } from '../types.ts';
import { testParams } from './params.ts';

const params = testParams();

/**
 * `base` with the players of `clubId` drawn again: up to `maxOut` of the squad injured or
 * suspended (from a full XI to nobody available), condition 40..100 and morale 0..100.
 */
export function drawnState(base: GameState, clubId: ClubId, rng: Rng, maxOut = 0.6): GameState {
  const outRate = rng.next() * maxOut;
  const players: Record<PlayerId, Player> = { ...base.players };
  for (const id of base.squads[clubId]!) {
    const u = rng.next();
    players[id] = {
      ...base.players[id]!,
      injuryRounds: u < outRate * 0.6 ? rng.int(1, 6) : 0,
      suspendedGames: u >= outRate * 0.6 && u < outRate ? rng.int(1, 2) : 0,
      condition: 40 + rng.next() * 60,
      morale: rng.next() * 100,
    };
  }
  return { ...base, players };
}

/** A random formation. */
export function drawnFormation(rng: Rng): Formation {
  return FORMATIONS[rng.int(0, FORMATIONS.length - 1)]!;
}

export interface DraftOptions {
  /** Ids out of the club's squad may appear (another club's players). Default true. */
  readonly foreign?: boolean;
  /** An id may appear twice. Default true. */
  readonly repeats?: boolean;
}

/**
 * A random draft of `clubId`: each slot free, a player of the squad (available or not), and, when
 * allowed, a player of another club or an id already used. Lists of up to 3 ids of the squad.
 */
export function drawnDraft(
  state: GameState,
  clubId: ClubId,
  rng: Rng,
  options: DraftOptions = {},
): DraftSheet {
  const squad = state.squads[clubId]!;
  const others = Object.keys(state.squads).filter((id) => id !== clubId);
  const foreignSquad = state.squads[others[rng.int(0, others.length - 1)]!]!;
  const used: PlayerId[] = [];
  const freeRate = rng.next() * 0.5;
  const pick = (): PlayerId | null => {
    const u = rng.next();
    if (u < freeRate) return null;
    if (options.foreign !== false && u < freeRate + 0.05) {
      return foreignSquad[rng.int(0, foreignSquad.length - 1)]!;
    }
    if (options.repeats !== false && used.length > 0 && u < freeRate + 0.1) {
      return used[rng.int(0, used.length - 1)]!;
    }
    for (let tries = 0; tries < 50; tries++) {
      const id = squad[rng.int(0, squad.length - 1)]!;
      if (!used.includes(id)) {
        used.push(id);
        return id;
      }
    }
    return null;
  };
  const starters = Array.from({ length: 11 }, pick);
  const bench = Array.from({ length: rng.int(0, BENCH_SIZE) }, pick);
  const list = () =>
    Array.from({ length: rng.int(0, 3) }, () => squad[rng.int(0, squad.length - 1)]!);
  return {
    lineup: {
      formation: drawnFormation(rng),
      starters,
      bench,
      captains: [...new Set(list())],
      penaltyTakers: [...new Set(list())],
      freeKickTakers: [...new Set(list())],
    },
    tactic: { posture: 'balanced', pressure: 'medium' },
  };
}

/**
 * A random team sheet of `clubId` with up to 11 starters and up to 7 reserves: a third the
 * suggestion as it is (mostly valid), a third the suggestion with one change, a third random ids
 * of the squad, of another club or repeated.
 */
export function drawnTeamSheet(state: GameState, clubId: ClubId, rng: Rng): TeamSheet {
  const suggested = suggestSheet(state, params, clubId, undefined, {
    controller: 'human',
    formation: drawnFormation(rng),
  });
  const kind = rng.int(0, 2);
  if (kind === 0) return suggested;
  const squad = state.squads[clubId]!;
  const others = Object.keys(state.squads).filter((id) => id !== clubId);
  const foreign = state.squads[others[rng.int(0, others.length - 1)]!]!;
  const anyId = (): PlayerId => {
    const u = rng.next();
    if (u < 0.08) return foreign[rng.int(0, foreign.length - 1)]!;
    return squad[rng.int(0, squad.length - 1)]!;
  };
  if (kind === 1) {
    const starters = [...suggested.lineup.starters];
    const bench = [...suggested.lineup.bench];
    const change = rng.int(0, 3);
    if (change === 0 && starters.length > 0) starters[rng.int(0, starters.length - 1)] = anyId();
    else if (change === 1 && bench.length > 0) bench[rng.int(0, bench.length - 1)] = anyId();
    else if (change === 2 && starters.length > 0) starters.pop();
    else if (bench.length > 0) bench.pop();
    return { ...suggested, lineup: { ...suggested.lineup, starters, bench } };
  }
  return {
    lineup: {
      formation: drawnFormation(rng),
      starters: Array.from({ length: rng.int(0, 11) }, anyId),
      bench: Array.from({ length: rng.int(0, BENCH_SIZE) }, anyId),
      captains: [],
      penaltyTakers: [],
      freeKickTakers: [],
    },
    tactic: { posture: 'balanced', pressure: 'medium' },
  };
}

/** A deep copy of `value` with every object frozen: a write throws in strict mode. */
export function deepFrozen<T>(value: T): T {
  const copy = structuredClone(value);
  const freeze = (v: unknown): void => {
    if (v === null || typeof v !== 'object' || Object.isFrozen(v)) return;
    Object.freeze(v);
    for (const child of Object.values(v)) freeze(child);
  };
  freeze(copy);
  return copy;
}
