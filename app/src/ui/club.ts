import {
  fanMood,
  getStandings,
  type ClubId,
  type FanMood,
  type Fixture,
  type GameState,
  type StandingResult,
  type StandingRow,
} from '@engine';
import type { Lang } from '@lib/config';
import { t, tPlural } from '@lib/i18n';
import type { StatusBadgeItem } from './components/StatusBadge.svelte';

/*
 * What the Clube screen reads of the career (docs/design/telas/clube.md, "O que a tela lê"): the
 * next match, the absences, the thermometer and the standings near the coach's club. Pure reads
 * of the GameState through the engine's contract; nothing here computes a rule of the game (the
 * mood band is `fanMood`, the table is `getStandings`).
 */

/** The coach's next match: the fixture of `game.round` with the club. */
export interface NextMatch {
  readonly fixture: Fixture;
  /** The coach's venue. */
  readonly venue: 'home' | 'away';
  readonly opponentId: ClubId;
  /** The opponent is in the club's `rivals`. */
  readonly derby: boolean;
}

/** The next match, or `undefined` when the season is over (round 39, or the season closed). */
export function nextMatch(game: GameState, clubId: ClubId): NextMatch | undefined {
  if (game.phase !== 'season') return undefined;
  const fixture = game.fixtures.find(
    (f) => f.round === game.round && (f.homeId === clubId || f.awayId === clubId),
  );
  if (fixture === undefined) return undefined;
  const venue = fixture.homeId === clubId ? 'home' : 'away';
  const opponentId = venue === 'home' ? fixture.awayId : fixture.homeId;
  const rivals = game.clubs[clubId]?.def.rivals ?? [];
  return { fixture, venue, opponentId, derby: rivals.includes(opponentId) };
}

export interface Absences {
  readonly injured: number;
  readonly suspended: number;
}

/**
 * The players out of the next match: injured (`injuryRounds > 0`) or suspended
 * (`suspendedGames > 0`); one with both counts only as injured (clube.md, "Desfalques"). Only in
 * Realismo completo and only while there is a next match; `undefined` when the line is not shown.
 */
export function absences(game: GameState, clubId: ClubId): Absences | undefined {
  if (game.rules.realism !== 'full' || nextMatch(game, clubId) === undefined) return undefined;
  let injured = 0;
  let suspended = 0;
  for (const id of game.squads[clubId] ?? []) {
    const player = game.players[id];
    if (player === undefined) continue;
    if (player.injuryRounds > 0) injured++;
    else if (player.suspendedGames > 0) suspended++;
  }
  return injured + suspended === 0 ? undefined : { injured, suspended };
}

/** "Desfalques: 1 lesionado, 1 suspenso" (club.absences), in the language. */
export function absencesLine(found: Absences, lang: Lang): string {
  const parts: string[] = [];
  if (found.injured > 0) parts.push(tPlural('club.absences.injured', found.injured, lang));
  if (found.suspended > 0) parts.push(tPlural('club.absences.suspended', found.suspended, lang));
  const list =
    parts.length === 2
      ? t('club.absences.join', lang, { first: parts[0]!, second: parts[1]! })
      : parts[0]!;
  return t('club.absences', lang, { list });
}

/** The thermometer as the screen shows it: the rounded number and its mood band. */
export function fanReading(fans: number): { readonly value: number; readonly mood: FanMood } {
  const value = Number.isFinite(fans) ? Math.round(Math.min(100, Math.max(0, fans))) : 0;
  return { value, mood: fanMood(fans) };
}

/** "dom., 10 de mai." of a fixture date ("YYYY-MM-DD"), in the language; the date has no zone. */
export function matchDate(date: string, lang: Lang): string {
  const [y, m, d] = date.split('-').map(Number);
  const at = new Date(Date.UTC(y!, m! - 1, d!));
  return new Intl.DateTimeFormat(lang, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(at);
}

/** Before round 1 of the season: no match played yet (clube.md, "Vazio (pré-temporada)"). */
export function preseason(game: GameState): boolean {
  return game.phase === 'season' && game.round === 1;
}

/** The standings and the coach's row in them. */
export interface ClubStanding {
  readonly rows: readonly StandingRow[];
  readonly mine: StandingRow;
  /** The three rows of the mini table: above, mine, below (the first three, the last three). */
  readonly window: readonly StandingRow[];
}

/** The rows of the mini table around `clubId`: one above and one below, clipped at the ends. */
export function tableWindow(rows: readonly StandingRow[], clubId: ClubId): StandingRow[] {
  const at = rows.findIndex((r) => r.clubId === clubId);
  if (at < 0) return [];
  const start = Math.max(0, Math.min(at - 1, rows.length - 3));
  return rows.slice(start, start + 3);
}

/** The standings of the season near the coach's club; `undefined` for a club not in the table. */
export function clubStanding(game: GameState, clubId: ClubId): ClubStanding | undefined {
  const rows = getStandings(game);
  const mine = rows.find((r) => r.clubId === clubId);
  if (mine === undefined) return undefined;
  return { rows, mine, window: tableWindow(rows, clubId) };
}

/** The goal difference with its sign ("+3", "0", "−2"), in the language. */
export function signed(n: number, lang: Lang): string {
  return new Intl.NumberFormat(lang, { signDisplay: 'exceptZero' }).format(n);
}

/** The V/E/D badges of the last results, oldest first: the letter shown, the word read. */
export function formBadges(form: readonly StandingResult[], lang: Lang): StatusBadgeItem[] {
  const KIND = { W: 'win', D: 'draw', L: 'loss' } as const;
  return form.map((r) => ({
    kind: KIND[r],
    label: t(`result.${r}`, lang),
    short: t(`result.${r}.short`, lang),
  }));
}

/** A read of one block of the screen: its value, or the programming error it threw. */
export type BlockRead<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown };

/**
 * Runs the reads of one block so a bug in them fails only that block (clube.md, "Erro num
 * bloco"): the screen shows the block's ErrorState and logs the error, and the others stay.
 */
export function readBlock<T>(read: () => T): BlockRead<T> {
  try {
    return { ok: true, value: read() };
  } catch (error) {
    return { ok: false, error };
  }
}
