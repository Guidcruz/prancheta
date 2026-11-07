import { pickBench, pickCaptainAndTakers, pickEleven } from './ai.ts';
import { FORMATIONS, FORMATION_SLOTS } from './formations.ts';
import {
  BENCH_SIZE,
  type DraftLineup,
  type DraftSheet,
  type Lineup,
  type LineupState,
  type TeamSheet,
} from './lineup.ts';
import type { Player } from './players.ts';
import { bestForSlot, reshapeSlots } from './selection.ts';
import { STARTERS_COUNT, effectiveRating, isAvailable } from './strength.ts';
import type { ClubId, Formation, PlayerId, Position } from './types.ts';

/*
 * Readings of the coach's sheet being edited (docs/02-architecture.md, 4.1, "Ficha em edição e
 * leituras para a escalação"; ADR-0021, item 8; T-076): the formation change before the match,
 * "Completar automaticamente", who holds each role now and every problem of the sheet. They are
 * for the lineup, tactic and roles screens (T-029, T-077).
 *
 * Pure: no `Rng`, the input is never changed and nothing throws. No function of the simulation
 * (`newGame`, `prepareRound`, `simulateMatch`, `playRound`, `endSeason`, `startNextSeason`) calls
 * them, so no golden and no `ENGINE_VERSION` depend on them. In every reading an id out of the
 * club's squad counts as a free slot, and a repeated id is a problem, never an exception.
 */

/** The holder of a role now: from the coach's list (`auto: false`) or by the automatic rule. */
export interface RoleHolder {
  /** Undefined when nobody on the pitch can take the role (no available starter). */
  readonly player?: PlayerId;
  readonly auto: boolean;
}

/** Captain, penalty taker and free-kick taker of a sheet ({@link sheetRoles}). */
export type SheetRoles = Readonly<Record<'captain' | 'penalty' | 'freeKick', RoleHolder>>;

/** One problem of a sheet being edited ({@link sheetProblems}). */
export type DraftProblem =
  | { readonly part: 'starters'; readonly index: number; readonly reason: 'empty' }
  | {
      readonly part: 'starters' | 'bench';
      /** Index of the slot in the sheet. */
      readonly index: number;
      readonly reason: 'wrong-club' | 'duplicate' | 'unavailable';
      readonly player: PlayerId;
    };

/** Every problem of a sheet being edited, for the banner, the warnings and the sheet to complete. */
export interface SheetCheck {
  /** `problems` is empty: the sheet can go to the round. */
  readonly ready: boolean;
  /** Available players of the squad (the banner "Só {count} podem jogar"). */
  readonly available: number;
  /** Starters missing to reach `min(11, available)`; with nobody available, 11, as in `validateLineup`. */
  readonly missing: number;
  /** The starters in slot order, then the bench. */
  readonly problems: readonly DraftProblem[];
}

/** No rotation in {@link pickEleven}: no condition is below 0 (the selection clamps it). */
const NO_ROTATION = { rotationCondition: 0, rotationMinRatio: 1 } as const;

function isFormation(value: unknown): value is Formation {
  return typeof value === 'string' && (FORMATIONS as readonly string[]).includes(value);
}

/** A known formation; an unknown one (damaged input) reads as the first, `4-4-2`. */
function knownFormation(formation: Formation): Formation {
  return isFormation(formation) ? formation : FORMATIONS[0]!;
}

/**
 * The club's squad as the readings see it: each id of `state.squads[clubId]` with a player, and
 * the available ones in squad order. Undefined for a club with no squad in the state.
 */
function squadOf(
  state: LineupState,
  clubId: ClubId,
): { byId: Map<PlayerId, Player>; available: Player[] } | undefined {
  const ids = state.squads[clubId];
  if (ids === undefined) return undefined;
  const byId = new Map<PlayerId, Player>();
  const available: Player[] = [];
  for (const id of ids) {
    const player = state.players[id];
    if (player === undefined || byId.has(id)) continue;
    byId.set(id, player);
    if (isAvailable(player)) available.push(player);
  }
  return { byId, available };
}

/** `starters` read as the 11 slots of a formation: missing entries are free slots. */
function elevenSlots(starters: readonly (PlayerId | null)[]): (PlayerId | null)[] {
  return Array.from({ length: STARTERS_COUNT }, (_, i) => starters[i] ?? null);
}

/** The available starters of a sheet, once each, in slot order: who can be on the pitch. */
function availableStarters(
  lineup: Pick<DraftLineup, 'starters'>,
  byId: ReadonlyMap<PlayerId, Player>,
): Player[] {
  const seen = new Set<PlayerId>();
  const players: Player[] = [];
  for (const id of elevenSlots(lineup.starters)) {
    if (id === null || seen.has(id)) continue;
    seen.add(id);
    const player = byId.get(id);
    if (player !== undefined && isAvailable(player)) players.push(player);
  }
  return players;
}

/**
 * The formation change before the match (partida.md, "Troca de formação durante o jogo", steps 1
 * to 3, by `reshapeSlots`, the same function as the match's `changeFormation`), with
 * `eff = effectiveRating(player, slot, player.condition)` (before the kick-off the energy is the
 * condition) and the tie-break of `winsTie`. In the CEO's words: nobody leaves the team; each
 * starter stays in the same position if it exists in the new formation, and those left over go
 * to the free slots.
 *
 * The starters, the unavailable ones included, only change slot; the free slots end where step 3
 * puts them. An id out of the club's squad becomes a free slot. The same formation (or an unknown
 * one) moves nobody. Bench and lists do not change. Pure, never throws.
 */
export function reshapeLineup(
  state: LineupState,
  clubId: ClubId,
  lineup: DraftLineup,
  formation: Formation,
): DraftLineup {
  const squad = squadOf(state, clubId);
  const occupants = elevenSlots(lineup.starters).map((id) =>
    id === null ? undefined : squad?.byId.get(id),
  );
  const current = knownFormation(lineup.formation);
  const target = isFormation(formation) ? formation : undefined;
  const placed =
    target === undefined || target === current
      ? occupants
      : reshapeSlots(
          occupants,
          FORMATION_SLOTS[current],
          FORMATION_SLOTS[target],
          (player, slot) => effectiveRating(player, slot),
          (player) => player,
        );
  return {
    formation: target ?? lineup.formation,
    starters: placed.map((player) => player?.id ?? null),
    bench: [...lineup.bench],
    captains: [...lineup.captains],
    penaltyTakers: [...lineup.penaltyTakers],
    freeKickTakers: [...lineup.freeKickTakers],
  };
}

/** The role lists of a lineup, kept only for its starters, in the order of the sheet. */
function listsFor(
  lineup: Pick<DraftLineup, 'captains' | 'penaltyTakers' | 'freeKickTakers'>,
  starters: readonly PlayerId[],
): Pick<Lineup, 'captains' | 'penaltyTakers' | 'freeKickTakers'> {
  const onPitch = new Set(starters);
  const keep = (list: readonly PlayerId[]) => list.filter((id) => onPitch.has(id));
  return {
    captains: keep(lineup.captains),
    penaltyTakers: keep(lineup.penaltyTakers),
    freeKickTakers: keep(lineup.freeKickTakers),
  };
}

/**
 * "Completar automaticamente" and "Completar e jogar" of the lineup screen, and the way from a
 * ready sheet to the engine (docs/02-architecture.md, 4.1):
 * 1. starters: each slot, in formation order, that is free or holds an id out of the squad, a
 *    repeated id or an unavailable player gets, by `bestForSlot`, the best available reserve of
 *    the sheet's bench not used yet; with none left, the best available player off the sheet. The
 *    unavailable player replaced leaves the sheet. A slot held by someone who can play never
 *    changes;
 * 2. bench: the sheet's reserves who are available, in the squad, not repeated and did not go up,
 *    in sheet order; the slots left up to `BENCH_SIZE` get, in `pickBench` order, the available
 *    players left;
 * 3. lists: only the starters of the result, in sheet order. Same tactic;
 * 4. fewer than 11 available in the squad: a `Lineup` cannot hold a free slot in the middle, so
 *    the starters are all the available players, picked by `pickEleven` without rotation (the
 *    free slots at the end), and the bench is empty;
 * 5. a club with no squad in the state: the empty sheet of `suggestSheet` (first formation), with
 *    the sheet's tactic.
 * The result always passes `validateLineup` when the club has someone available. Pure.
 */
export function completeSheet(state: LineupState, clubId: ClubId, sheet: DraftSheet): TeamSheet {
  const { lineup } = sheet;
  const tactic = { posture: sheet.tactic.posture, pressure: sheet.tactic.pressure };
  const squad = squadOf(state, clubId);
  if (squad === undefined) {
    return {
      lineup: {
        formation: FORMATIONS[0]!,
        starters: [],
        bench: [],
        captains: [],
        penaltyTakers: [],
        freeKickTakers: [],
      },
      tactic,
    };
  }
  const formation = knownFormation(lineup.formation);
  const { byId, available } = squad;

  if (available.length < STARTERS_COUNT) {
    const starters = pickEleven(available, formation, NO_ROTATION).starters.map((p) => p.id);
    return {
      lineup: { formation, starters, bench: [], ...listsFor(lineup, starters) },
      tactic,
    };
  }

  const positions = FORMATION_SLOTS[formation];
  const used = new Set<PlayerId>();
  const playable = (id: PlayerId | null): Player | undefined => {
    if (id === null || used.has(id)) return undefined;
    const player = byId.get(id);
    return player !== undefined && isAvailable(player) ? player : undefined;
  };
  const placed: (Player | undefined)[] = elevenSlots(lineup.starters).map((id) => {
    const player = playable(id);
    if (player !== undefined) used.add(player.id);
    return player;
  });
  const reserves: Player[] = [];
  for (const id of lineup.bench.slice(0, BENCH_SIZE)) {
    const player = playable(id);
    if (player !== undefined && !reserves.includes(player)) reserves.push(player);
  }
  const taken = (player: Player) => used.has(player.id);
  for (let i = 0; i < positions.length; i++) {
    if (placed[i] !== undefined) continue;
    const slot: Position = positions[i]!;
    const player = bestForSlot(reserves, slot, taken) ?? bestForSlot(available, slot, taken);
    // Always found: 11 or more are available and at most 10 are used here.
    if (player === undefined) continue;
    placed[i] = player;
    used.add(player.id);
  }
  const starters = placed.filter((p): p is Player => p !== undefined).map((p) => p.id);

  const bench = reserves.filter((p) => !used.has(p.id));
  for (const player of bench) used.add(player.id);
  const rest = available.filter((p) => !used.has(p.id));
  bench.push(...pickBench(rest).slice(0, BENCH_SIZE - bench.length));

  return {
    lineup: {
      formation,
      starters,
      bench: bench.map((p) => p.id),
      ...listsFor(lineup, starters),
    },
    tactic,
  };
}

/**
 * Who holds each role now (the "C" on the pitch and the "Automático: {nome}" of the tactic
 * screen; docs/02-architecture.md, 4.1). The candidates are the sheet's starters who are in the
 * squad and available, in slot order. For each role the first id of its list among the
 * candidates holds it (`auto: false`); without one, the automatic rule of partida.md ("Capitão e
 * cobradores"), by the AI's `pickCaptainAndTakers` (`auto: true`): captain = the leader of
 * highest overall, else the oldest; penalty = highest `finishing`; free kick = highest
 * `technique`; ties by slot order. With no candidate, `{ auto: true }` without a player. It does
 * not foresee the kick-off replacement of unavailable starters (the screen blocks them). Pure.
 */
export function sheetRoles(state: LineupState, clubId: ClubId, lineup: DraftLineup): SheetRoles {
  const squad = squadOf(state, clubId);
  const candidates = squad === undefined ? [] : availableStarters(lineup, squad.byId);
  const ids = new Set(candidates.map((p) => p.id));
  const automatic = pickCaptainAndTakers(candidates);
  const holder = (list: readonly PlayerId[], auto: readonly PlayerId[]): RoleHolder => {
    const chosen = list.find((id) => ids.has(id));
    if (chosen !== undefined) return { player: chosen, auto: false };
    const fallback = auto[0];
    return fallback === undefined ? { auto: true } : { player: fallback, auto: true };
  };
  return {
    captain: holder(lineup.captains, automatic.captains),
    penalty: holder(lineup.penaltyTakers, automatic.penaltyTakers),
    freeKick: holder(lineup.freeKickTakers, automatic.freeKickTakers),
  };
}

/**
 * Every problem of a sheet being edited (docs/02-architecture.md, 4.1), for the banner, the
 * warnings and the sheet "Escalação incompleta". The reasons and their order are those of
 * `validateLineup`, with every problem instead of the first:
 * - each starter, in slot order: an id already seen is `duplicate`, then an id out of the squad
 *   is `wrong-club`, then an injured or suspended player is `unavailable`;
 * - `missing` = `min(11, available)` (11 with nobody available) minus the starters without a
 *   problem. With `missing > 0` each free slot of the pitch is `empty`; with `missing` 0 the free
 *   slots left are those of players who do not exist (fewer than 11 available) and do not block;
 * - each bench entry, in order: a free slot is not a problem; an id already used on the pitch or
 *   the bench is `duplicate`, then `wrong-club` and `unavailable`.
 * The warnings that do not block (out of position, improvised, idol out of the team) are not
 * here: the screen builds them from `fitLevel` and the player's trait. Pure.
 */
export function sheetProblems(state: LineupState, clubId: ClubId, sheet: DraftSheet): SheetCheck {
  const squad = squadOf(state, clubId);
  const byId = squad?.byId ?? new Map<PlayerId, Player>();
  const available = squad?.available.length ?? 0;
  const problems: DraftProblem[] = [];
  const seen = new Set<PlayerId>();
  const check = (part: 'starters' | 'bench', index: number, id: PlayerId): boolean => {
    if (seen.has(id)) {
      problems.push({ part, index, reason: 'duplicate', player: id });
      return false;
    }
    seen.add(id);
    const player = byId.get(id);
    if (player === undefined) {
      problems.push({ part, index, reason: 'wrong-club', player: id });
      return false;
    }
    if (!isAvailable(player)) {
      problems.push({ part, index, reason: 'unavailable', player: id });
      return false;
    }
    return true;
  };

  const starters = elevenSlots(sheet.lineup.starters);
  let good = 0;
  for (let i = 0; i < starters.length; i++) {
    const id = starters[i]!;
    // A free slot goes in its place in the slot order; it is dropped below when nothing is missing.
    if (id === null) problems.push({ part: 'starters', index: i, reason: 'empty' });
    else if (check('starters', i, id)) good += 1;
  }
  const target = available === 0 ? STARTERS_COUNT : Math.min(STARTERS_COUNT, available);
  const missing = Math.max(0, target - good);
  if (missing === 0) {
    const blocking = problems.filter((p) => p.reason !== 'empty');
    problems.splice(0, problems.length, ...blocking);
  }

  // The bench a sheet can hold (BENCH_SIZE); entries past it are not read, as in completeSheet.
  const bench = sheet.lineup.bench.slice(0, BENCH_SIZE);
  for (let i = 0; i < bench.length; i++) {
    const id = bench[i] ?? null;
    if (id !== null) check('bench', i, id);
  }
  return { ready: problems.length === 0, available, missing, problems };
}
