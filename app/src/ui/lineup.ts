import {
  FORMATION_SLOTS,
  draftFromSheet,
  fitLevel,
  isAvailable,
  sheetRoles,
  sheetStrength,
  suggestSheet,
  type ClubId,
  type DraftSheet,
  type GameParams,
  type GameState,
  type Player,
  type PlayerId,
  type Position,
  type SheetCheck,
} from '@engine';
import { reconcileDraft } from '@lib/career';
import type { Lang } from '@lib/config';
import { t, tPlural } from '@lib/i18n';
import type { ChipMark } from './components/LineupChip.svelte';
import type { LineupIssue } from './components/LineupIssues.svelte';
import type { PitchSlot } from './components/LineupPitch.svelte';
import { SECTOR_OF } from './components/sectors';
import type { StatusBadgeItem } from './components/StatusBadge.svelte';
import type { StrengthItem } from './components/StrengthBars.svelte';
import { playerBadges, shownCondition, sortPlayers, squadPlayers, type Realism } from './squad';

/*
 * What the Escalação view reads of the coach's sheet and how a swap changes it
 * (docs/design/telas/escalacao.md; US-017; ADR-0021). Every number and every rule comes from the
 * engine's readings (T-076): the strength (`sheetStrength`), the problems that block the round
 * (`sheetProblems`), the position levels (`fitLevel`), who can play (`isAvailable`) and the
 * captain (`sheetRoles`); this file never reads the FIT table nor repeats its limits. Pure: the
 * sheet given is never changed.
 */

/**
 * A place of the lineup: a slot of the pitch, a bench place, a player left out, or "Deixar de
 * fora" (`out-free`), the one free place of the players left out (escalacao.md, "Mudar de lugar
 * sem troca").
 */
export type Place =
  | { readonly part: 'starters'; readonly index: number }
  | { readonly part: 'bench'; readonly index: number }
  | { readonly part: 'out'; readonly id: PlayerId }
  | { readonly part: 'out-free' };

/** "Deixar de fora". */
export const OUT_FREE: Place = { part: 'out-free' };

/** A stable key of a place ("starters-3", "bench-0", "out-<id>", "out-free"), for equality. */
export function placeKey(place: Place): string {
  if (place.part === 'out-free') return 'out-free';
  return place.part === 'out' ? `out-${place.id}` : `${place.part}-${place.index}`;
}

/** The place is among the players left out (one of them, or "Deixar de fora"). */
const leftOut = (place: Place) => place.part === 'out' || place.part === 'out-free';

export const samePlace = (a: Place | undefined, b: Place | undefined): boolean =>
  a !== undefined && b !== undefined && placeKey(a) === placeKey(b);

/** The player in a place, or `null` for a free slot. */
export function playerAt(sheet: DraftSheet, place: Place): PlayerId | null {
  if (place.part === 'out') return place.id;
  if (place.part === 'out-free') return null;
  const list = place.part === 'starters' ? sheet.lineup.starters : sheet.lineup.bench;
  return list[place.index] ?? null;
}

/**
 * The sheet the screen shows and edits: the coach's draft reconciled with the squad (an id that
 * left is a free slot, the bench has its 7 places), or, while the coach never touched it, the
 * engine's suggestion for the coach (`suggestSheet` with `controller: 'human'`; ADR-0021,
 * "Ausente": the round plays that same sheet) with the role lists empty (CEO decision 5 of
 * T-029: they start as "Automático"). The suggestion's lists hold one name each, the one the
 * automatic rule picks (`pickCaptainAndTakers`, the rule of `sheetRoles`), so the holders shown
 * are the ones the round plays.
 */
export function coachSheet(
  game: GameState,
  clubId: ClubId,
  draft: DraftSheet | undefined,
  params: Pick<GameParams, 'ai'>,
): DraftSheet {
  if (draft !== undefined) return reconcileDraft(game, clubId, draft);
  const suggested = draftFromSheet(
    suggestSheet(game, params, clubId, undefined, { controller: 'human' }),
  );
  return reconcileDraft(game, clubId, {
    lineup: { ...suggested.lineup, captains: [], penaltyTakers: [], freeKickTakers: [] },
    tactic: suggested.tactic,
  });
}

/**
 * "Sugerir escalação" (CEO decision 6 of T-029): the engine's XI and bench for the coach in the
 * formation of the sheet; the tactic stays, and the role lists keep only the starters left.
 */
export function suggestedSheet(
  game: GameState,
  clubId: ClubId,
  sheet: DraftSheet,
  params: Pick<GameParams, 'ai'>,
): DraftSheet {
  const suggested = draftFromSheet(
    suggestSheet(game, params, clubId, undefined, {
      controller: 'human',
      formation: sheet.lineup.formation,
    }),
  );
  return reconcileDraft(game, clubId, {
    lineup: {
      ...suggested.lineup,
      captains: sheet.lineup.captains,
      penaltyTakers: sheet.lineup.penaltyTakers,
      freeKickTakers: sheet.lineup.freeKickTakers,
    },
    tactic: sheet.tactic,
  });
}

/** The starters of `before` who are not starters in `after` and are tired (the ones rested). */
export function restedPlayers(
  game: GameState,
  before: DraftSheet,
  after: DraftSheet,
  tiredBelow: number,
): Player[] {
  if (game.rules.realism !== 'full') return [];
  const now = new Set(after.lineup.starters);
  return before.lineup.starters.flatMap((id) => {
    const player = id === null ? undefined : game.players[id];
    return player !== undefined &&
      !now.has(player.id) &&
      isAvailable(player) &&
      shownCondition(player) < tiredBelow
      ? [player]
      : [];
  });
}

/** The players of the squad that are neither starters nor on the bench, GOL to ATA, then overall. */
export function outPlayers(game: GameState, clubId: ClubId, sheet: DraftSheet): Player[] {
  const used = new Set<PlayerId | null>([...sheet.lineup.starters, ...sheet.lineup.bench]);
  return sortPlayers(
    squadPlayers(game, clubId).filter((p) => !used.has(p.id)),
    'position',
  );
}

/** One line of the bench: a reserve (GOL to ATA, then overall) or a free place, with its index. */
export interface BenchLine {
  readonly index: number;
  readonly player?: Player;
}

/** The bench as shown: the reserves by position and overall, then the free places. */
export function benchLines(game: GameState, sheet: DraftSheet): BenchLine[] {
  const filled: BenchLine[] = [];
  const free: BenchLine[] = [];
  sheet.lineup.bench.forEach((id, index) => {
    const player = id === null ? undefined : game.players[id];
    if (player === undefined) free.push({ index });
    else filled.push({ index, player });
  });
  const order = sortPlayers(
    filled.map((line) => line.player!),
    'position',
  );
  filled.sort((a, b) => order.indexOf(a.player!) - order.indexOf(b.player!));
  return [...filled, ...free];
}

/** The players in the order of the card's "Anterior" and "Próximo": pitch, bench, then out. */
export function cardOrder(game: GameState, clubId: ClubId, sheet: DraftSheet): PlayerId[] {
  const starters = sheet.lineup.starters.filter((id): id is PlayerId => id !== null);
  const bench = benchLines(game, sheet).flatMap((line) => (line.player ? [line.player.id] : []));
  return [...starters, ...bench, ...outPlayers(game, clubId, sheet).map((p) => p.id)];
}

export type RoleName = 'captain' | 'penalty' | 'freeKick';

export const ROLE_LISTS = {
  captain: 'captains',
  penalty: 'penaltyTakers',
  freeKick: 'freeKickTakers',
} as const satisfies Record<RoleName, string>;

/** Why a swap did not happen: the player could not go where it would take him. */
export type Refusal = { readonly player: PlayerId; readonly reason: 'injured' | 'suspended' };

export type SwapResult =
  | {
      readonly ok: true;
      readonly sheet: DraftSheet;
      /** `swap`: two players changed places; `move`: one went to a free place. */
      readonly kind: 'swap' | 'move';
      /** The player of the first place (the one picked or dragged), or the only one that moved. */
      readonly moved: PlayerId;
      /** The other player of a swap. */
      readonly other?: PlayerId;
      /** Where `moved` came from. */
      readonly from: Place['part'];
      /** Where `moved` went. */
      readonly to: Place['part'];
      /** The place `moved` went to (the slot, for "foi para a vaga de ZAG"). */
      readonly arrived: Place;
      /** Who left a role list because he left the pitch (funcoes.md), in list order. */
      readonly removed: readonly { readonly role: RoleName; readonly player: PlayerId }[];
    }
  | { readonly ok: false; readonly refused: Refusal };

/**
 * An injured or suspended player never enters the pitch nor the bench (US-017; `validateLineup`):
 * from out of the sheet to either, or from the bench to the pitch. Leaving (the pitch for the
 * bench or out, the bench for out) and changing slot inside the pitch are allowed: that is how a
 * lineup is mended.
 */
function refusal(
  game: GameState,
  id: PlayerId | null,
  from: Place,
  to: Place,
): Refusal | undefined {
  if (id === null) return undefined;
  const player = game.players[id];
  if (player === undefined || isAvailable(player)) return undefined;
  const enters =
    (to.part === 'starters' && from.part !== 'starters') || (to.part === 'bench' && leftOut(from));
  if (!enters) return undefined;
  return { player: id, reason: player.injuryRounds > 0 ? 'injured' : 'suspended' };
}

/**
 * The swap of two places (escalacao.md, "Trocar lugares" and "Mudar de lugar sem troca"): the two
 * players change places; with one place free, the player only moves and his place becomes free
 * ("Deixar de fora" takes him out of the sheet, injured or not). `undefined` when nothing would
 * change: the same place, two free places, two places among the players left out, or a reserve
 * to a free bench place (the bench is shown by position). Refused, with the reason, when it would
 * take an injured or suspended player in.
 */
export function swapPlaces(
  game: GameState,
  sheet: DraftSheet,
  from: Place,
  to: Place,
): SwapResult | undefined {
  if (samePlace(from, to)) return undefined;
  const a = playerAt(sheet, from);
  const b = playerAt(sheet, to);
  if (a === null && b === null) return undefined;
  if (leftOut(from) && leftOut(to)) return undefined;
  if (from.part === 'bench' && to.part === 'bench' && (a === null || b === null)) return undefined;
  const refused = refusal(game, a, from, to) ?? refusal(game, b, to, from);
  if (refused !== undefined) return { ok: false, refused };

  const starters = [...sheet.lineup.starters];
  const bench = [...sheet.lineup.bench];
  const put = (place: Place, id: PlayerId | null) => {
    if (place.part === 'starters') starters[place.index] = id;
    else if (place.part === 'bench') bench[place.index] = id;
  };
  put(from, b);
  put(to, a);

  const onPitch = new Set(starters);
  const left = sheet.lineup.starters.filter(
    (id): id is PlayerId => id !== null && !onPitch.has(id),
  );
  const removed: { role: RoleName; player: PlayerId }[] = [];
  const lists = {} as Record<(typeof ROLE_LISTS)[RoleName], PlayerId[]>;
  for (const role of Object.keys(ROLE_LISTS) as RoleName[]) {
    const key = ROLE_LISTS[role];
    const list = sheet.lineup[key];
    for (const id of list) if (left.includes(id)) removed.push({ role, player: id });
    lists[key] = list.filter((id) => !left.includes(id));
  }
  const moved = a ?? b!;
  return {
    ok: true,
    sheet: {
      lineup: { ...sheet.lineup, starters, bench, ...lists },
      tactic: sheet.tactic,
    },
    kind: a !== null && b !== null ? 'swap' : 'move',
    moved,
    ...(a !== null && b !== null ? { other: b } : {}),
    from: a !== null ? from.part : to.part,
    to: a !== null ? to.part : from.part,
    arrived: a !== null ? to : from,
    removed,
  };
}

/** The four numbers of the strength strip, rounded as shown (decision 8; the arrows compare them). */
export interface ShownStrength {
  readonly overall: number;
  readonly def: number;
  readonly mid: number;
  readonly atk: number;
}

export const STRENGTH_KEYS = ['overall', 'def', 'mid', 'atk'] as const;

export function shownStrength(game: GameState, clubId: ClubId, sheet: DraftSheet): ShownStrength {
  const s = sheetStrength(game, clubId, sheet.lineup);
  return {
    overall: Math.round(s?.overall ?? 0),
    def: Math.round(s?.def ?? 0),
    mid: Math.round(s?.mid ?? 0),
    atk: Math.round(s?.atk ?? 0),
  };
}

const strengthLabel = (key: (typeof STRENGTH_KEYS)[number], lang: Lang) =>
  t(key === 'overall' ? 'lineup.strength.overall' : `lineup.sector.${key}`, lang);

/** The items of the StrengthBars, with the change from `before` when there is one. */
export function strengthItems(
  now: ShownStrength,
  before: ShownStrength | undefined,
  lang: Lang,
): StrengthItem[] {
  return STRENGTH_KEYS.map((id) => {
    const delta = before === undefined ? 0 : now[id] - before[id];
    return {
      id,
      label: strengthLabel(id, lang),
      value: now[id],
      ...(delta === 0
        ? {}
        : {
            delta,
            deltaLabel: t(delta > 0 ? 'lineup.strength.up' : 'lineup.strength.down', lang, {
              value: Math.abs(delta),
            }),
          }),
    };
  });
}

/** "Ataque 64, caiu 3." for each number that changed, in the strip's order. */
export function strengthChange(now: ShownStrength, before: ShownStrength, lang: Lang): string[] {
  return STRENGTH_KEYS.flatMap((id) => {
    const delta = now[id] - before[id];
    if (delta === 0) return [];
    const change = t(delta > 0 ? 'lineup.strength.up' : 'lineup.strength.down', lang, {
      value: Math.abs(delta),
    });
    return [
      t('lineup.strength.changed', lang, {
        sector: strengthLabel(id, lang),
        value: now[id],
        change,
      }),
    ];
  });
}

const code = (position: Position, lang: Lang) => t(`position.${position}.short`, lang);
const positionName = (position: Position, lang: Lang) => t(`position.${position}`, lang);
/** A label that goes inside a sentence ("lesionado, 2 rodadas"). */
const lower = (text: string, lang: Lang) => text.toLocaleLowerCase(lang);

/** "Lesionado, 2 rodadas" or "Suspenso, 1 jogo" for an unavailable player; else undefined. */
function unavailableLabel(player: Player, lang: Lang): string | undefined {
  if (player.injuryRounds > 0) return tPlural('status.injured', player.injuryRounds, lang);
  if (player.suspendedGames > 0) return tPlural('status.suspended', player.suspendedGames, lang);
  return undefined;
}

/**
 * The one mark of a slot (escalacao.md, "Marca da vaga" and "Posição secundária"): the most
 * serious wins, in this order: injured, suspended, out of position, improvised, secondary
 * position, none. The position levels come from the engine's `fitLevel`, already in that order of
 * gravity once the player is available.
 */
function slotMark(player: Player, slot: Position, lang: Lang): ChipMark | undefined {
  const out = unavailableLabel(player, lang);
  if (out !== undefined) {
    return { kind: player.injuryRounds > 0 ? 'injured' : 'suspended', label: out };
  }
  const level = fitLevel(player, slot);
  if (level === 'natural') return undefined;
  return { kind: level, label: t(`lineup.fit.${level}`, lang) };
}

/** Every situation of a player in a slot, for the accessible name (the mark shows only one). */
function slotSituations(player: Player, slot: Position, lang: Lang): string[] {
  const out: string[] = [];
  const unavailable = unavailableLabel(player, lang);
  if (unavailable !== undefined) out.push(lower(unavailable, lang));
  const level = fitLevel(player, slot);
  if (level !== 'natural') out.push(lower(t(`lineup.fit.${level}`, lang), lang));
  return out;
}

/** The transient state of each place: picked, under the drag, its origin, or just refused. */
export interface PlaceStates {
  readonly selected?: Place;
  readonly target?: Place;
  readonly origin?: Place;
  readonly refused?: Place;
}

function stateOf(place: Place, states: PlaceStates): PitchSlot['state'] {
  if (samePlace(place, states.origin)) return 'origin';
  if (samePlace(place, states.target)) return 'target';
  if (samePlace(place, states.selected)) return 'selected';
  if (samePlace(place, states.refused)) return 'refused';
  return 'idle';
}

/**
 * The 11 slots of the pitch, in the order of the formation (the engine's). Each filled slot shows
 * the player's natural position code painted by his sector (escalacao.md, "Cor de setor no
 * LineupChip"); the slot's own position is in the accessible name and the mark.
 */
export function pitchSlots(
  game: GameState,
  clubId: ClubId,
  sheet: DraftSheet,
  states: PlaceStates,
  lang: Lang,
): PitchSlot[] {
  const realism = game.rules.realism;
  const captain = sheetRoles(game, clubId, sheet.lineup).captain.player;
  return FORMATION_SLOTS[sheet.lineup.formation].map((slot, index) => {
    const id = sheet.lineup.starters[index] ?? null;
    const player = id === null ? undefined : game.players[id];
    const place: Place = { part: 'starters', index };
    const base = { state: stateOf(place, states) };
    if (player === undefined) {
      return {
        ...base,
        a11yLabel: t('lineup.slot.emptyA11y', lang, { position: positionName(slot, lang) }),
      };
    }
    const condition = shownCondition(player);
    const isCaptain = captain === player.id;
    const vars = {
      position: positionName(slot, lang),
      name: player.name.full,
      overall: player.overall,
      condition,
    };
    const label = t(
      realism === 'full' ? 'lineup.slot.a11yCondition' : 'lineup.slot.a11y',
      lang,
      vars,
    );
    const extra = [
      ...(isCaptain ? [t('lineup.captain.a11y', lang)] : []),
      ...slotSituations(player, slot, lang),
    ];
    const mark = slotMark(player, slot, lang);
    return {
      ...base,
      positionCode: code(player.position, lang),
      sector: SECTOR_OF[player.position],
      a11yLabel: [label, ...extra].join(', '),
      name: player.name.display,
      overall: player.overall,
      ...(realism === 'full' ? { condition } : {}),
      ...(mark === undefined ? {} : { mark }),
      ...(isCaptain ? { captain: true } : {}),
    };
  });
}

/** One row of the bench or of "Não relacionados", ready for the LineupRow. */
export interface RowView {
  readonly place: Place;
  /** `data-place`: "bench-<index>" or "out-<n>" (its line in the list). */
  readonly dataPlace: string;
  readonly a11yLabel: string;
  readonly positionCode?: string;
  readonly name?: string;
  readonly badges: readonly StatusBadgeItem[];
  readonly cells: readonly number[];
  readonly state: PitchSlot['state'];
}

/**
 * The position of the pitch slot a reserve would enter (escalacao.md, "Candidato à vaga"): the
 * slot of the formation (`FORMATION_SLOTS`, not the position of its occupant) while a filled slot
 * of the pitch is the origin of a drag or is picked; else undefined. A free slot, a reserve or a
 * player left out picked gives none: the marks of the pitch are of who is there ("Reverso, não").
 */
export function candidateSlot(sheet: DraftSheet, states: PlaceStates): Position | undefined {
  const place = states.origin ?? states.selected;
  if (place?.part !== 'starters' || playerAt(sheet, place) === null) return undefined;
  return FORMATION_SLOTS[sheet.lineup.formation][place.index];
}

/**
 * One row of a reserve or of a player left out. With `candidateFor` (the slot picked or dragged,
 * {@link candidateSlot}), a player who has that slot as his secondary position gets the
 * `secondary` badge, last, and its text at the end of the accessible name: the only good option
 * that the code of his natural position does not show. Improvised and out of position are not
 * marked here (escalacao.md, "Só a secundária").
 */
function playerRow(
  player: Player,
  place: Place,
  dataPlace: string,
  realism: Realism,
  states: PlaceStates,
  candidateFor: Position | undefined,
  lang: Lang,
): RowView {
  const condition = shownCondition(player);
  const vars = {
    name: player.name.full,
    position: positionName(player.position, lang),
    overall: player.overall,
    condition,
  };
  const label = t(realism === 'full' ? 'lineup.row.a11yCondition' : 'lineup.row.a11y', lang, vars);
  const badges = [
    ...playerBadges(player, realism, lang),
    ...(candidateFor !== undefined && fitLevel(player, candidateFor) === 'secondary'
      ? [{ kind: 'secondary' as const, label: t('lineup.fit.secondary', lang) }]
      : []),
  ];
  return {
    place,
    dataPlace,
    a11yLabel: [label, ...badges.map((b) => lower(b.label, lang))].join(', '),
    positionCode: code(player.position, lang),
    name: player.name.display,
    badges,
    cells: realism === 'full' ? [player.overall, condition] : [player.overall],
    state: stateOf(place, states),
  };
}

export function benchRows(
  game: GameState,
  sheet: DraftSheet,
  states: PlaceStates,
  lang: Lang,
): RowView[] {
  const realism = game.rules.realism;
  const candidateFor = candidateSlot(sheet, states);
  return benchLines(game, sheet).map(({ index, player }) => {
    const place: Place = { part: 'bench', index };
    const dataPlace = `bench-${index}`;
    if (player === undefined) {
      return {
        place,
        dataPlace,
        a11yLabel: t('lineup.bench.emptyA11y', lang),
        badges: [],
        cells: [],
        state: stateOf(place, states),
      };
    }
    return playerRow(player, place, dataPlace, realism, states, candidateFor, lang);
  });
}

export function outRows(
  game: GameState,
  clubId: ClubId,
  sheet: DraftSheet,
  states: PlaceStates,
  lang: Lang,
): RowView[] {
  const realism = game.rules.realism;
  const candidateFor = candidateSlot(sheet, states);
  return outPlayers(game, clubId, sheet).map((player, n) =>
    playerRow(
      player,
      { part: 'out', id: player.id },
      `out-${n}`,
      realism,
      states,
      candidateFor,
      lang,
    ),
  );
}

/** "Deixar de fora": the free place on top of the players left out, always there. */
export function outFreeRow(states: PlaceStates, lang: Lang): RowView {
  return {
    place: OUT_FREE,
    dataPlace: 'out-free',
    a11yLabel: t('lineup.out.freeA11y', lang),
    badges: [],
    cells: [],
    state: stateOf(OUT_FREE, states),
  };
}

/** The players that count as "o time inteiro": the bench count shown next to "Banco". */
export function benchCount(sheet: DraftSheet): number {
  return sheet.lineup.bench.filter((id) => id !== null).length;
}

/**
 * The warnings of the lineup (escalacao.md, "Avisos da escalação" and "Estados"), in this order:
 * what blocks the round, as `sheetProblems` gives it (free slots, injured or suspended starters
 * and reserves); then, for the starters in slot order, out of position and improvised (from
 * `fitLevel`; never the secondary position); the tired starters (condition shown below `tiredBelow`, Realismo completo only);
 * and the club's idol out of the team. Positions are the short codes the player reads on the
 * pitch ("(ZAG) jogando de ATA").
 */
export function lineupIssues(
  game: GameState,
  clubId: ClubId,
  sheet: DraftSheet,
  check: SheetCheck,
  tiredBelow: number,
  lang: Lang,
): LineupIssue[] {
  const slots = FORMATION_SLOTS[sheet.lineup.formation];
  const issues: LineupIssue[] = [];
  for (const problem of check.problems) {
    if (problem.reason === 'empty') {
      issues.push({
        kind: 'empty',
        text: t('lineup.issue.empty', lang, { position: code(slots[problem.index]!, lang) }),
      });
      continue;
    }
    const player = game.players[problem.player];
    if (problem.reason !== 'unavailable' || player === undefined) continue;
    const status = unavailableLabel(player, lang) ?? '';
    const kind = player.injuryRounds > 0 ? 'injured' : 'suspended';
    issues.push({
      kind,
      text: t(`lineup.issue.${kind}`, lang, {
        name: player.name.full,
        position: code(player.position, lang),
        status: lower(status, lang),
      }),
    });
  }
  const starters: Player[] = [];
  sheet.lineup.starters.forEach((id, index) => {
    const player = id === null ? undefined : game.players[id];
    if (player === undefined) return;
    starters.push(player);
    const slot = slots[index]!;
    const level = fitLevel(player, slot);
    // The secondary position is a good choice, not a warning (escalacao.md, "Não é aviso").
    if (level !== 'improvised' && level !== 'outOfPosition') return;
    issues.push({
      kind: level,
      text: t(`lineup.issue.${level}`, lang, {
        name: player.name.full,
        natural: code(player.position, lang),
        position: code(slot, lang),
      }),
    });
  });
  if (game.rules.realism === 'full') {
    for (const player of starters) {
      const condition = shownCondition(player);
      if (isAvailable(player) && condition < tiredBelow) {
        issues.push({
          kind: 'tired',
          text: t('lineup.issue.tired', lang, { name: player.name.full, condition }),
        });
      }
    }
  }
  const onPitch = new Set(starters.map((p) => p.id));
  for (const player of squadPlayers(game, clubId)) {
    if (player.trait === 'idol' && !onPitch.has(player.id) && isAvailable(player)) {
      issues.push({ kind: 'idol', text: t('lineup.issue.idol', lang, { name: player.name.full }) });
    }
  }
  return issues;
}

/**
 * The text of the "Escalação incompleta" banner: the free slots that block, then who cannot play
 * (on the pitch or the bench). Each problem counted once: an injured starter is not also "missing".
 */
export function incompleteMessage(check: SheetCheck, lang: Lang): string {
  const empty = check.problems.filter((p) => p.reason === 'empty').length;
  const unavailable = check.problems.filter((p) => p.reason === 'unavailable').length;
  return [
    ...(empty > 0 ? [tPlural('lineup.invalid.missing', empty, lang)] : []),
    ...(unavailable > 0 ? [tPlural('lineup.invalid.unavailable', unavailable, lang)] : []),
  ].join(' ');
}

/** "Ildo, Zuza e Reinor" in the language (`Intl.ListFormat`, long conjunction). */
export function nameList(names: readonly string[], lang: Lang): string {
  return new Intl.ListFormat(lang, { style: 'long', type: 'conjunction' }).format(names);
}
