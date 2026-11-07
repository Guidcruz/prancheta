import type { Lang } from '@lib/config';
import {
  COACH_NAME_MAX,
  checkCoachName,
  type CoachNameProblem,
  type LastSetup,
  type NewGameClub,
} from '@lib/career';
import { t } from '@lib/i18n';
import type { ClubGroup } from './components/ClubPicker.svelte';
import type { OptionItem } from './components/OptionGroup.svelte';

/*
 * The rules of the new-game screen that do not need a DOM (docs/design/telas/novo-jogo.md):
 * the clubs in three strength bands, the options offered and their defaults, and what the
 * nickname field shows. The screen only binds them to the shell components.
 */

/** The difficulty bands (docs/design/temporada.md, "Força e dificuldade na escolha do clube"). */
export type Band = 'favorite' | 'mid' | 'relegation';
export const BANDS: readonly Band[] = ['favorite', 'mid', 'relegation'];

/** The band of the club at `rank` in strength (1 = the strongest): 1-6, 7-14, 15-20. */
export function bandOf(rank: number): Band {
  if (rank <= 6) return 'favorite';
  if (rank <= 14) return 'mid';
  return 'relegation';
}

/** A club with its place among the strongest. */
export interface RankedClub extends NewGameClub {
  readonly rank: number;
  readonly band: Band;
}

/** The clubs from the strongest to the weakest, ties by `id` (CEO decision 4 of T-025). */
export function rankClubs(clubs: readonly NewGameClub[]): RankedClub[] {
  return [...clubs]
    .sort((a, b) =>
      a.strength !== b.strength
        ? b.strength - a.strength
        : a.club.id < b.club.id
          ? -1
          : a.club.id > b.club.id
            ? 1
            : 0,
    )
    .map((entry, i) => ({ ...entry, rank: i + 1, band: bandOf(i + 1) }));
}

/** The title of a band's group ("Favoritos"). */
export const bandTitle = (band: Band, lang: Lang): string => t(`newGame.band.${band}`, lang);

/** The band of one club ("Favorito"), for the bar and the accessible name. */
export function bandLabel(band: Band, lang: Lang): string {
  return band === 'favorite' ? t('newGame.band.favorite.one', lang) : bandTitle(band, lang);
}

/** The groups of the ClubPicker, in band order; a band without clubs is left out. */
export function clubGroups(clubs: readonly NewGameClub[], lang: Lang): ClubGroup[] {
  const ranked = rankClubs(clubs);
  return BANDS.map((band) => ({
    id: band,
    title: bandTitle(band, lang),
    bandLabel: bandLabel(band, lang),
    clubs: ranked
      .filter((entry) => entry.band === band)
      .map((entry) => ({
        club: entry.club,
        label: entry.club.shortName,
        detail: t('newGame.clubs.place', lang, { city: entry.club.city, state: entry.club.state }),
        strength: entry.strength,
      })),
  })).filter((group) => group.clubs.length > 0);
}

/**
 * The match modes offered now (CEO decision 3 of T-025): only "Só resultado", while the animated
 * match does not exist (T-031, T-032). The other two are hidden, not disabled (P3); they come
 * back to this list, and "Animada completa" to the default, when the animated match lands.
 */
export const OFFERED_MATCH_MODES: readonly LastSetup['matchMode'][] = ['result'];

export const REALISMS: readonly LastSetup['realism'][] = ['full', 'simplified'];

/** The first-time options: realism "Completo" and the only match mode offered. */
export const DEFAULT_SETUP: LastSetup = { realism: 'full', matchMode: 'result' };

/** The options the sheet starts with: the last setup, kept only where it is still offered. */
export function initialSetup(last: LastSetup | undefined): LastSetup {
  if (last === undefined) return DEFAULT_SETUP;
  return {
    realism: REALISMS.includes(last.realism) ? last.realism : DEFAULT_SETUP.realism,
    matchMode: OFFERED_MATCH_MODES.includes(last.matchMode)
      ? last.matchMode
      : DEFAULT_SETUP.matchMode,
  };
}

export const realismOptions = (lang: Lang): OptionItem[] =>
  REALISMS.map((value) => ({
    value,
    title: t(`newGame.realism.${value}`, lang),
    description: t(`newGame.realism.${value}.body`, lang),
  }));

export const matchOptions = (lang: Lang): OptionItem[] =>
  OFFERED_MATCH_MODES.map((value) => ({
    value,
    title: t(`newGame.match.${value}`, lang),
    description: t(`newGame.match.${value}.body`, lang),
  }));

/** Why the last "Começar" did not create the career (shown above the bar). */
export type StartProblem =
  | { readonly kind: 'career-limit' }
  | { readonly kind: 'quota-exceeded' }
  | { readonly kind: 'error'; readonly code: string };

/** What the nickname field shows for what was typed. */
export interface CoachNameView {
  /** The nickname as it will be stored, when it is valid. */
  readonly value?: string;
  readonly problem?: CoachNameProblem;
  /** "16/24": code points after NFC and trim, as `checkCoachName` counts them. */
  readonly counter: string;
  readonly over: boolean;
  /** The message under the field, once the player left it (or tried to close the sheet). */
  readonly error?: string;
}

const ERROR_KEYS: Readonly<Record<CoachNameProblem, string>> = {
  empty: 'newGame.coach.error.empty',
  'too-long': 'newGame.coach.error.tooLong',
  unsafe: 'newGame.coach.error.unsafe',
};

export function coachNameView(raw: string, shown: boolean, lang: Lang): CoachNameView {
  const checked = checkCoachName(raw);
  const count = [...raw.normalize('NFC').trim()].length;
  const counter = t('newGame.coach.counter', lang, { count, max: COACH_NAME_MAX });
  if (checked.ok) return { value: checked.value, counter, over: false };
  return {
    problem: checked.error,
    counter,
    over: count > COACH_NAME_MAX,
    error: shown ? t(ERROR_KEYS[checked.error], lang, { max: COACH_NAME_MAX }) : undefined,
  };
}
