import type { Lang } from '@lib/config';
import { summarySeasonOver, type CareerSummary } from '@lib/career';
import { t } from '@lib/i18n';

/*
 * The lines of a CareerCard (docs/design/telas/inicio.md, "CareerCard: o que cada linha mostra"),
 * the same on the home screen and in Carreiras e backup. The season shows by its number, not its
 * year (CEO decision 6 of T-025: the summary has no year).
 */

/** "Temporada 1 · rodada 12", or "Temporada 1 encerrada" after round 38. */
export function progressLine(summary: Pick<CareerSummary, 'season' | 'round'>, lang: Lang): string {
  return summarySeasonOver(summary)
    ? t('home.career.seasonOver', lang, { season: summary.season })
    : t('home.career.progress', lang, { season: summary.season, round: summary.round });
}

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * "Jogada em 7 de nov." or, on the same day, "Jogada hoje, 14:05", in the device's time zone. An
 * unreadable date gives an empty line (the card still shows the club and the progress).
 */
export function lastPlayedLine(updatedAt: string, now: Date, lang: Lang): string {
  const at = new Date(updatedAt);
  if (Number.isNaN(at.getTime())) return '';
  if (sameDay(at, now)) {
    const time = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(at);
    return t('home.career.lastPlayedToday', lang, { time });
  }
  const date = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(at);
  return t('home.career.lastPlayed', lang, { date });
}
