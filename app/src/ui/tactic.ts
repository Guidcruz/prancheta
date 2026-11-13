import {
  FORMATIONS,
  FORMATION_SLOTS,
  TAKER_ATTRIBUTE,
  completeSheet,
  fitLevel,
  reshapeLineup,
  sheetRoles,
  takerValue,
  type ClubId,
  type DraftSheet,
  type Formation,
  type GameState,
  type Player,
  type PlayerId,
  type Pressure,
  type SheetCheck,
  type Tactic,
  type TeamSheet,
} from '@engine';
import { ROLE_LIST_MAX } from '@lib/career';
import type { Lang } from '@lib/config';
import { t, tPlural } from '@lib/i18n';
import type { FormationOption } from './components/FormationPicker.svelte';
import type { LineupIssue, LineupIssueKind } from './components/LineupIssues.svelte';
import type { OptionItem } from './components/OptionGroup.svelte';
import type { RoleEntry } from './components/RoleEditor.svelte';
import type { StatusBadgeItem } from './components/StatusBadge.svelte';
import { SECTOR_OF } from './components/sectors';
import {
  ROLE_LISTS,
  lineupIssues,
  strengthChange,
  type RoleName,
  type ShownStrength,
} from './lineup';
import { playerBadges } from './squad';

/*
 * What the Tática view and the Funções sheets read of the coach's sheet and how they change it
 * (docs/design/telas/tatica.md, funcoes.md; US-018; ADR-0021). The formation change is the
 * engine's (`reshapeLineup`: nobody leaves the team), the holder of each role is the engine's
 * (`sheetRoles`), and the round gets the sheet through `completeSheet`; this file only builds the
 * texts and keeps the screen's rules: at most 3 names in a list, only starters. Pure: the sheet
 * given is never changed.
 */

/** The pre-match postures, in the order of the screen ("Tudo no ataque" is only in the match). */
export const TACTIC_POSTURES = [
  'defensive',
  'balanced',
  'attacking',
] as const satisfies readonly Tactic['posture'][];
export const TACTIC_PRESSURES = ['low', 'medium', 'high'] as const satisfies readonly Pressure[];

/** The three role sheets, in the order of the Tática's lines. */
export const ROLES: readonly RoleName[] = ['captain', 'penalty', 'freeKick'];

/** The six formations as radio cards, with the name and the effect from the content. */
export function formationOptions(lang: Lang): FormationOption[] {
  return FORMATIONS.map((value) => ({
    value,
    title: t(`tactic.formation.${value}`, lang),
    description: t(`tactic.formation.${value}.effect`, lang),
  }));
}

export function postureOptions(lang: Lang): OptionItem[] {
  return TACTIC_POSTURES.map((value) => ({
    value,
    title: t(`tactic.posture.${value}`, lang),
    description: t(`tactic.posture.${value}.effect`, lang),
  }));
}

export function pressureOptions(lang: Lang): OptionItem[] {
  return TACTIC_PRESSURES.map((value) => ({
    value,
    title: t(`tactic.pressure.${value}`, lang),
    description: t(`tactic.pressure.${value}.effect`, lang),
  }));
}

export const isPosture = (value: string): value is Tactic['posture'] =>
  (TACTIC_POSTURES as readonly string[]).includes(value);
export const isPressure = (value: string): value is Pressure =>
  (TACTIC_PRESSURES as readonly string[]).includes(value);

/**
 * The sheet in `formation` (tatica.md, "Trocar a formação"): the same 11 redistributed by the
 * position of each one (`reshapeLineup`); bench, role lists and tactic stay. `undefined` for the
 * formation the sheet already has: nothing changes.
 */
export function withFormation(
  game: GameState,
  clubId: ClubId,
  sheet: DraftSheet,
  formation: Formation,
): DraftSheet | undefined {
  if (formation === sheet.lineup.formation) return undefined;
  return { lineup: reshapeLineup(game, clubId, sheet.lineup, formation), tactic: sheet.tactic };
}

export function withTactic(sheet: DraftSheet, tactic: Partial<Tactic>): DraftSheet | undefined {
  const next = { ...sheet.tactic, ...tactic };
  if (next.posture === sheet.tactic.posture && next.pressure === sheet.tactic.pressure) {
    return undefined;
  }
  return { lineup: sheet.lineup, tactic: next };
}

/** The warnings of "Nesta formação": out of position and improvised, free slots and the unfit. */
const FORMATION_ISSUES: readonly LineupIssueKind[] = [
  'empty',
  'injured',
  'suspended',
  'outOfPosition',
  'improvised',
];

export function tacticIssues(
  game: GameState,
  clubId: ClubId,
  sheet: DraftSheet,
  check: SheetCheck,
  lang: Lang,
): LineupIssue[] {
  // No tired warning here (it is the Escalação's), so the threshold does not matter.
  return lineupIssues(game, clubId, sheet, check, 0, lang).filter((issue) =>
    FORMATION_ISSUES.includes(issue.kind),
  );
}

/**
 * The starters out of their position in the sheet's formation (improvised or out of position).
 * A starter in his secondary position does not count: it is a good choice, not a problem
 * (tatica.md, "Posição secundária").
 */
export function misplacedCount(game: GameState, sheet: DraftSheet): number {
  const slots = FORMATION_SLOTS[sheet.lineup.formation];
  return sheet.lineup.starters.filter((id, i) => {
    const player = id === null ? undefined : game.players[id];
    if (player === undefined) return false;
    const level = fitLevel(player, slots[i]!);
    return level === 'improvised' || level === 'outOfPosition';
  }).length;
}

/**
 * The live region after a formation change (tatica.md): "Formação 4-3-3. Ataque 67, subiu 3. 1
 * jogador fora de posição." The count of the misplaced is said only when there is one.
 */
export function formationMessage(
  formation: Formation,
  now: ShownStrength,
  before: ShownStrength,
  misplaced: number,
  lang: Lang,
): string {
  return [
    t('tactic.formation.changed', lang, { formation: t(`tactic.formation.${formation}`, lang) }),
    ...strengthChange(now, before, lang),
    ...(misplaced > 0 ? [tPlural('tactic.formation.out', misplaced, lang)] : []),
  ].join(' ');
}

// ----------------------------------------------------------------------------------- the roles

/** The starters of the sheet who are players of the state, in slot order. */
function startersOf(game: GameState, sheet: DraftSheet): Player[] {
  return sheet.lineup.starters.flatMap((id) => {
    const player = id === null ? undefined : game.players[id];
    return player === undefined ? [] : [player];
  });
}

/** The list of a role as the screen keeps it: only the starters, in the coach's order. */
export function roleList(sheet: DraftSheet, role: RoleName): PlayerId[] {
  const onPitch = new Set(sheet.lineup.starters);
  return sheet.lineup[ROLE_LISTS[role]].filter((id) => onPitch.has(id));
}

function withList(sheet: DraftSheet, role: RoleName, list: readonly PlayerId[]): DraftSheet {
  return { lineup: { ...sheet.lineup, [ROLE_LISTS[role]]: [...list] }, tactic: sheet.tactic };
}

/** `id` one place up (-1) or down (+1) in the list; `undefined` at the edge or off the list. */
export function moveInRole(
  sheet: DraftSheet,
  role: RoleName,
  id: PlayerId,
  by: -1 | 1,
): DraftSheet | undefined {
  const list = roleList(sheet, role);
  const at = list.indexOf(id);
  const to = at + by;
  if (at < 0 || to < 0 || to >= list.length) return undefined;
  const next = [...list];
  [next[at], next[to]] = [next[to]!, next[at]!];
  return withList(sheet, role, next);
}

export function removeFromRole(
  sheet: DraftSheet,
  role: RoleName,
  id: PlayerId,
): DraftSheet | undefined {
  const list = roleList(sheet, role);
  if (!list.includes(id)) return undefined;
  return withList(
    sheet,
    role,
    list.filter((other) => other !== id),
  );
}

/**
 * `id` at the end of the list: only a starter not in it yet, and only while the list has fewer
 * than {@link ROLE_LIST_MAX} names (CEO decision 1 of T-029). Else `undefined`.
 */
export function addToRole(sheet: DraftSheet, role: RoleName, id: PlayerId): DraftSheet | undefined {
  const list = roleList(sheet, role);
  if (list.length >= ROLE_LIST_MAX || list.includes(id) || !sheet.lineup.starters.includes(id)) {
    return undefined;
  }
  return withList(sheet, role, [...list, id]);
}

/**
 * The attribute that decides the role, as shown next to the name ("Finalização 84", "31 anos"):
 * for a taker, the engine's own value (`takerValue`, the derived one for a goalkeeper), the
 * number `sheetRoles` and the match decide by.
 */
export function roleDetail(player: Player, role: RoleName, lang: Lang): string {
  if (role === 'captain') return tPlural('player.age', player.age, lang);
  return t('roles.detail.attribute', lang, {
    attribute: t(`attr.${TAKER_ATTRIBUTE[role]}`, lang),
    value: takerValue(player, role),
  });
}

/**
 * The order of "Outros titulares" (funcoes.md): by the value that decides the role
 * (`takerValue`), the highest first; for the captain, the rule of `sheetRoles` (the leaders
 * first, by overall, then the oldest). Ties keep the slot order (the sort is stable).
 */
function byRole(role: RoleName): (a: Player, b: Player) => number {
  if (role === 'captain') {
    return (a, b) => {
      const leaders = Number(b.trait === 'leader') - Number(a.trait === 'leader');
      if (leaders !== 0) return leaders;
      return a.trait === 'leader' ? b.overall - a.overall : b.age - a.age;
    };
  }
  return (a, b) => takerValue(b, role) - takerValue(a, role);
}

function roleBadges(
  player: Player,
  role: RoleName,
  game: GameState,
  lang: Lang,
): StatusBadgeItem[] {
  const badges: StatusBadgeItem[] =
    role === 'captain' && player.trait === 'leader'
      ? [{ kind: 'leader', label: t('trait.leader', lang) }]
      : [];
  // The injured or suspended starter may stay in a list (funcoes.md): his line says so.
  const unfit = playerBadges(player, game.rules.realism, lang).filter(
    (b) => b.kind === 'injured' || b.kind === 'suspended',
  );
  return [...badges, ...unfit];
}

function roleEntry(player: Player, role: RoleName, game: GameState, lang: Lang): RoleEntry {
  const name = player.name.full;
  return {
    id: player.id,
    name: player.name.display,
    positionCode: t(`position.${player.position}.short`, lang),
    sector: SECTOR_OF[player.position],
    detail: roleDetail(player, role, lang),
    badges: roleBadges(player, role, game, lang),
    upLabel: t('roles.up', lang, { name }),
    downLabel: t('roles.down', lang, { name }),
    removeLabel: t('roles.remove', lang, { name }),
    addLabel: t('roles.add', lang, { name }),
  };
}

const ROLE_TITLES: Readonly<Record<RoleName, string>> = {
  captain: 'roles.captain',
  penalty: 'roles.penalty.title',
  freeKick: 'roles.freeKick.title',
};

/** Everything the role sheet shows (funcoes.md, "Conteúdo da folha"). */
export interface RoleSheetView {
  readonly title: string;
  readonly intro: string;
  readonly autoText: string;
  /** "Agora: Ildo (Finalização 84)", with the list empty and someone on the pitch. */
  readonly nowText?: string;
  /** "Ainda não há titulares escalados.", with no starter at all. */
  readonly noStartersText?: string;
  readonly list: readonly RoleEntry[];
  readonly others: readonly RoleEntry[];
}

export function roleSheetView(
  game: GameState,
  clubId: ClubId,
  sheet: DraftSheet,
  role: RoleName,
  lang: Lang,
): RoleSheetView {
  const starters = startersOf(game, sheet);
  const listed = roleList(sheet, role);
  const list = listed.flatMap((id) => {
    const player = game.players[id];
    return player === undefined ? [] : [roleEntry(player, role, game, lang)];
  });
  const others = starters
    .filter((p) => !listed.includes(p.id))
    .sort(byRole(role))
    .map((p) => roleEntry(p, role, game, lang));
  const holder = sheetRoles(game, clubId, sheet.lineup)[role];
  const now = holder.player === undefined ? undefined : game.players[holder.player];
  return {
    title: t(ROLE_TITLES[role], lang),
    intro: t(role === 'captain' ? 'roles.captain.intro' : 'roles.taker.intro', lang),
    autoText: t(`roles.auto.${role}`, lang),
    ...(list.length === 0 && now !== undefined
      ? {
          nowText: t('roles.now', lang, {
            name: now.name.display,
            detail: roleDetail(now, role, lang),
          }),
        }
      : {}),
    ...(starters.length === 0 ? { noStartersText: t('roles.noStarters', lang) } : {}),
    list,
    others,
  };
}

/**
 * The value of a role's line in the Tática: the list ("Ildo, Zuza", display names with a comma,
 * as tatica.md writes it), or with the list empty "Automático: {nome}", who the rule picks now,
 * or "Automático: ninguém em campo".
 */
export function roleLineValue(
  game: GameState,
  clubId: ClubId,
  sheet: DraftSheet,
  role: RoleName,
  lang: Lang,
): string {
  const names = roleList(sheet, role).flatMap((id) => {
    const player = game.players[id];
    return player === undefined ? [] : [player.name.display];
  });
  if (names.length > 0) return t('tactic.roles.list', lang, { names: names.join(', ') });
  const holder = sheetRoles(game, clubId, sheet.lineup)[role];
  const player = holder.player === undefined ? undefined : game.players[holder.player];
  return player === undefined
    ? t('tactic.roles.none', lang)
    : t('tactic.roles.auto', lang, { name: player.name.display });
}

/**
 * The new order said in the sheet's live region: "Pênaltis: 1 Ildo Albuquerque, 2 Zuza Ferraz."
 */
export function roleOrderMessage(
  game: GameState,
  sheet: DraftSheet,
  role: RoleName,
  lang: Lang,
): string {
  const label = t(`roles.${role}`, lang);
  const list = roleList(sheet, role).flatMap((id, i) => {
    const player = game.players[id];
    return player === undefined ? [] : [`${i + 1} ${player.name.full}`];
  });
  return list.length === 0
    ? t('roles.order.empty', lang, { role: label })
    : t('roles.order', lang, { role: label, list: list.join(', ') });
}

/**
 * The sheet "Jogar rodada" sends to the round (ADR-0021, item 2): untouched and ready, none (the
 * engine plays its own suggestion, the draft stays absent); else the sheet shown through
 * `completeSheet` (a ready sheet passes as it is, with its formation, tactic and lists; an
 * incomplete one gets only what is missing: "Completar e jogar").
 */
export function roundSheet(
  game: GameState,
  clubId: ClubId,
  sheet: DraftSheet,
  untouched: boolean,
  ready: boolean,
): TeamSheet | undefined {
  if (untouched && ready) return undefined;
  return completeSheet(game, clubId, sheet);
}
