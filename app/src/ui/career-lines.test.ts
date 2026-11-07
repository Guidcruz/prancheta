import { describe, expect, it } from 'vitest';
import { t } from '@lib/i18n';
import { lastPlayedLine, progressLine } from './career-lines';

/* The lines of a CareerCard (inicio.md): the season by its number (CEO decision 6), the date. */

describe('career card lines', () => {
  it('season by number and next round; round 39 is the season over', () => {
    expect(progressLine({ season: 2, round: 12 }, 'pt-BR')).toBe('Temporada 2 · rodada 12');
    expect(progressLine({ season: 1, round: 38 }, 'pt-BR')).toBe('Temporada 1 · rodada 38');
    expect(progressLine({ season: 1, round: 39 }, 'pt-BR')).toBe(
      t('home.career.seasonOver', 'pt-BR', { season: 1 }),
    );
    // Never the year.
    expect(progressLine({ season: 1, round: 5 }, 'pt-BR')).not.toMatch(/20\d\d/);
  });

  it('today with the time, another day with the date, an unreadable date empty', () => {
    const now = new Date(2026, 10, 7, 18, 30);
    const today = new Date(2026, 10, 7, 9, 5).toISOString();
    const before = new Date(2026, 10, 2, 23, 0).toISOString();
    expect(lastPlayedLine(today, now, 'pt-BR')).toBe(
      t('home.career.lastPlayedToday', 'pt-BR', { time: '09:05' }),
    );
    const date = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(
      new Date(before),
    );
    expect(lastPlayedLine(before, now, 'pt-BR')).toBe(
      t('home.career.lastPlayed', 'pt-BR', { date }),
    );
    expect(lastPlayedLine('not a date', now, 'pt-BR')).toBe('');
  });
});
