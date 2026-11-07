import {
  POSITIONS,
  attributeKeysFor,
  isProspect,
  playerForm,
  type ClubId,
  type GameState,
  type Player,
  type PlayerId,
} from '@engine';
import type { Lang } from '@lib/config';
import { normalizeNameKey } from '@lib/generators/names';
import { t, tPlural } from '@lib/i18n';
import type { CardAttribute, CardFact, CardMeter } from './components/PlayerCard.svelte';
import type { StatusBadgeItem } from './components/StatusBadge.svelte';
import { levelOf, type Level, type LevelMeasure } from './components/levels';

/*
 * What the Elenco screen and the player card read of the career (docs/design/telas/elenco.md and
 * jogador.md): the squad in order, its sort, the situation badges and the card's sections. The
 * "promessa" badge comes only from the engine's `isProspect` (US-016): this file, like every file
 * of ui/, never reads the potential itself (a test searches ui/ for it).
 */

export type SquadSort = 'position' | 'overall' | 'condition';

export type Realism = GameState['rules']['realism'];

/** The sorts the squad offers: no condition in Realismo simplificado (CEO, 2026-11-07). */
export function sortsFor(realism: Realism): readonly SquadSort[] {
  return realism === 'full' ? ['position', 'overall', 'condition'] : ['position', 'overall'];
}

/** The sort asked for, or the default (Posição) when this realism does not offer it. */
export function sortOrDefault(sort: SquadSort, realism: Realism): SquadSort {
  return sortsFor(realism).includes(sort) ? sort : 'position';
}

/** The club's players in squad order (`game.squads`). */
export function squadPlayers(game: GameState, clubId: ClubId): Player[] {
  const out: Player[] = [];
  for (const id of game.squads[clubId] ?? []) {
    const player = game.players[id];
    if (player !== undefined) out.push(player);
  }
  return out;
}

const positionIndex = (p: Player) => POSITIONS.indexOf(p.position);
/** Condition and morale are real numbers in the engine; the screen shows them rounded. */
export const shownCondition = (p: Player) => Math.round(p.condition);
export const shownMorale = (p: Player) => Math.round(p.morale);

/**
 * The squad in the chosen order (elenco.md, "Ordenar por"), ties by squad order:
 * - position: GOL to ATA (`POSITIONS`), then overall descending;
 * - overall: overall descending, then position;
 * - condition: the shown condition ascending (the most tired first), then overall descending.
 */
export function sortPlayers(players: readonly Player[], sort: SquadSort): Player[] {
  const order = new Map(players.map((p, i) => [p.id, i]));
  const bySquad = (a: Player, b: Player) => order.get(a.id)! - order.get(b.id)!;
  const byPosition = (a: Player, b: Player) => positionIndex(a) - positionIndex(b);
  const byOverall = (a: Player, b: Player) => b.overall - a.overall;
  const compare: Record<SquadSort, (a: Player, b: Player) => number> = {
    position: (a, b) => byPosition(a, b) || byOverall(a, b) || bySquad(a, b),
    overall: (a, b) => byOverall(a, b) || byPosition(a, b) || bySquad(a, b),
    condition: (a, b) => shownCondition(a) - shownCondition(b) || byOverall(a, b) || bySquad(a, b),
  };
  return [...players].sort(compare[sort]);
}

/**
 * The situation badges of a player, icon plus text from the content: injured with the rounds,
 * suspended, and "Promessa" when the engine says so. In Realismo simplificado nobody is out from
 * one round to the next, so only "Promessa" can show.
 */
export function playerBadges(player: Player, realism: Realism, lang: Lang): StatusBadgeItem[] {
  const out: StatusBadgeItem[] = [];
  if (realism === 'full' && player.injuryRounds > 0) {
    out.push({ kind: 'injured', label: tPlural('status.injured', player.injuryRounds, lang) });
  }
  if (realism === 'full' && player.suspendedGames > 0) {
    out.push({
      kind: 'suspended',
      label: tPlural('status.suspended', player.suspendedGames, lang),
    });
  }
  if (isProspect(player)) out.push({ kind: 'prospect', label: t('status.prospect', lang) });
  return out;
}

/** The form with one decimal in the language ("6,8"), or `undefined` with no game. */
export function formText(player: Player, lang: Lang): string | undefined {
  const form = playerForm(player);
  if (form === undefined) return undefined;
  return new Intl.NumberFormat(lang, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(form);
}

/**
 * The band of a state as shown (elenco.md, "Cores por faixa"): the `level` that paints the
 * number and the reading for screen readers ("82, boa"); nothing with no number (form "—").
 */
export function stateLevel(
  measure: LevelMeasure,
  shown: number | undefined,
  text: string,
  lang: Lang,
): { readonly level: Level; readonly sr: string } | undefined {
  const level = levelOf(measure, shown);
  if (level === undefined) return undefined;
  return { level, sr: t('level.reading', lang, { value: text, level: t(`level.${level}`, lang) }) };
}

/** One position group of the squad table (only with the "Posição" sort). */
export interface SquadGroup {
  /** `undefined`: a list with no group rows (the "Nota" and "Condição" sorts). */
  readonly label?: string;
  readonly players: readonly Player[];
}

/** The rows of the table: one group per position with "Posição", a single list otherwise. */
export function squadGroups(sorted: readonly Player[], sort: SquadSort, lang: Lang): SquadGroup[] {
  if (sort !== 'position') return [{ players: sorted }];
  const groups: SquadGroup[] = [];
  for (const position of POSITIONS) {
    const players = sorted.filter((p) => p.position === position);
    if (players.length > 0) groups.push({ label: t(`position.${position}.group`, lang), players });
  }
  return groups;
}

/** The sections of the full player card (jogador.md, "Conteúdo"), already translated. */
export interface PlayerCardView {
  /** The name the squad row shows (`name.display`): the sheet's title. */
  readonly title: string;
  /** The full name, only when it differs from the title (accents, case, hyphens and extra spaces ignored). */
  readonly fullName: string | undefined;
  readonly face: string;
  readonly shirt: string | undefined;
  readonly positionLabel: string;
  readonly facts: readonly CardFact[];
  readonly overall: number;
  readonly badges: readonly StatusBadgeItem[];
  readonly states: readonly CardMeter[];
  readonly attributes: readonly CardAttribute[];
  readonly trait: { readonly name: string; readonly description: string };
  readonly season: readonly CardFact[];
}

/**
 * The card of a player of the career; `undefined` when the id is no longer in the squad. A
 * player without one of the 6 attributes of his position is a programming error (a validated
 * save always has them): it throws, and the sheet shows its ErrorState instead of a made-up 0.
 */
export function playerCard(
  game: GameState,
  clubId: ClubId,
  id: PlayerId,
  lang: Lang,
): PlayerCardView | undefined {
  const player = game.players[id];
  if (player === undefined || !(game.squads[clubId] ?? []).includes(id)) return undefined;
  const realism = game.rules.realism;
  const age = tPlural('player.age', player.age, lang);
  const shirtNumber = t('player.shirt', lang, { number: player.shirt });
  const form = playerForm(player);
  const states: CardMeter[] = [];
  const banded = (measure: LevelMeasure, shown: number | undefined, text: string | undefined) => {
    const band = text === undefined ? undefined : stateLevel(measure, shown, text, lang);
    return band === undefined ? {} : { level: band.level, srText: band.sr };
  };
  if (realism === 'full') {
    const condition = shownCondition(player);
    states.push({
      id: 'condition',
      label: t('player.condition', lang),
      value: condition,
      max: 100,
      ...banded('condition', condition, String(condition)),
    });
  }
  const morale = shownMorale(player);
  const formShown = formText(player, lang);
  states.push(
    {
      id: 'morale',
      label: t('player.morale', lang),
      value: morale,
      max: 100,
      ...banded('morale', morale, String(morale)),
    },
    {
      id: 'form',
      label: t('player.form', lang),
      value: form,
      max: 10,
      valueText: formShown,
      emptyText: t('player.form.none', lang),
      ...banded('form', form, formShown),
    },
  );
  const stats = game.seasonStats[id];
  return {
    title: player.name.display,
    fullName:
      normalizeNameKey(player.name.full) === normalizeNameKey(player.name.display)
        ? undefined
        : player.name.full,
    face: player.face,
    shirt: game.clubs[clubId]?.def.colors[0],
    positionLabel: t(`position.${player.position}`, lang),
    // The label names the fact ("Idade", "Camisa"); the card shows only the value.
    facts: [
      { label: t('squad.col.age', lang), value: age },
      { label: t('player.shirt', lang, { number: '' }).trim(), value: shirtNumber },
    ],
    overall: player.overall,
    badges: playerBadges(player, realism, lang),
    states,
    attributes: attributeKeysFor(player.position).map((key) => {
      const value = player.attributes[key];
      if (value === undefined) throw new Error(`player without the attribute ${key}`);
      return { id: key, label: t(`attr.${key}`, lang), value };
    }),
    trait: {
      name: t(`trait.${player.trait}`, lang),
      description: t(`trait.${player.trait}.body`, lang),
    },
    season: [
      { label: t('player.season.games', lang), value: String(stats?.games ?? 0) },
      { label: t('player.season.goals', lang), value: String(stats?.goals ?? 0) },
    ],
  };
}
