import { describe, expect, it } from 'vitest';
import { COACH_NAME_MAX, type NewGameClub } from '@lib/career';
import { t } from '@lib/i18n';
import { latestClubSet } from '../data/club-sets.ts';
import {
  DEFAULT_SETUP,
  OFFERED_MATCH_MODES,
  bandOf,
  clubGroups,
  coachNameView,
  initialSetup,
  matchOptions,
  rankClubs,
} from './new-game';

/*
 * The rules of the new-game screen (T-025, novo-jogo.md) without a DOM: the three strength bands
 * (CEO decision 4), the match modes offered and the defaults (decision 3), the nickname field
 * (decision 1: 24 code points, as `checkCoachName` counts them).
 */

const clubs: NewGameClub[] = latestClubSet()!.clubs.map((club) => ({
  club,
  strength: club.strength!,
}));

describe('clubs in three strength bands (temporada.md)', () => {
  it('1st to 6th, 7th to 14th, 15th to 20th', () => {
    expect([1, 6, 7, 14, 15, 20].map(bandOf)).toEqual([
      'favorite',
      'favorite',
      'mid',
      'mid',
      'relegation',
      'relegation',
    ]);
  });

  it('groups the 20 clubs 6 / 8 / 6, each from the strongest to the weakest', () => {
    const groups = clubGroups(clubs, 'pt-BR');
    expect(groups.map((g) => g.id)).toEqual(['favorite', 'mid', 'relegation']);
    expect(groups.map((g) => g.clubs.length)).toEqual([6, 8, 6]);
    expect(groups.map((g) => g.title)).toEqual([
      t('newGame.band.favorite', 'pt-BR'),
      t('newGame.band.mid', 'pt-BR'),
      t('newGame.band.relegation', 'pt-BR'),
    ]);
    expect(groups[0]!.bandLabel).toBe(t('newGame.band.favorite.one', 'pt-BR'));
    const all = groups.flatMap((g) => g.clubs.map((c) => c.strength));
    expect(all).toEqual([...all].sort((a, b) => b - a));
    // Each club once, with its short name and "city (state)".
    expect(new Set(groups.flatMap((g) => g.clubs.map((c) => c.club.id))).size).toBe(20);
    const first = groups[0]!.clubs[0]!;
    expect(first.label).toBe((first.club as { shortName: string }).shortName);
    expect(first.detail).toMatch(/^.+ \([A-Z]{2}\)$/);
  });

  it('breaks a tie in strength by id', () => {
    const tied = clubs.map((c) => ({ ...c, strength: 70 }));
    const ids = rankClubs(tied).map((r) => r.club.id);
    expect(ids).toEqual([...ids].sort());
  });

  it('a band with no clubs is left out (a list shorter than 20)', () => {
    expect(clubGroups(clubs.slice(0, 5), 'en').map((g) => g.id)).toEqual(['favorite']);
  });
});

describe('the options and their defaults (CEO decision 3)', () => {
  it('offers only "Só resultado" while the animated match does not exist (P3)', () => {
    expect(OFFERED_MATCH_MODES).toEqual(['result']);
    expect(matchOptions('pt-BR').map((o) => o.value)).toEqual(['result']);
  });

  it('the first time: realism "Completo" and "Só resultado"', () => {
    expect(initialSetup(undefined)).toEqual({ realism: 'full', matchMode: 'result' });
    expect(DEFAULT_SETUP).toEqual({ realism: 'full', matchMode: 'result' });
  });

  it('the last setup comes back, with a mode no longer offered replaced by the default', () => {
    expect(initialSetup({ realism: 'simplified', matchMode: 'result' })).toEqual({
      realism: 'simplified',
      matchMode: 'result',
    });
    expect(initialSetup({ realism: 'simplified', matchMode: 'full' })).toEqual({
      realism: 'simplified',
      matchMode: 'result',
    });
  });
});

describe('the nickname field (CEO decision 1)', () => {
  it('counts code points after NFC and trim, against the limit of 24', () => {
    expect(COACH_NAME_MAX).toBe(24);
    expect(coachNameView('  Zeca  ', false, 'pt-BR').counter).toBe('4/24');
    // An emoji is one code point (two UTF-16 units); "é" decomposed is one after NFC.
    expect(coachNameView('Ze\u0301 \u{1F3C6}', false, 'pt-BR').counter).toBe('4/24');
    const ok = coachNameView('A'.repeat(24), true, 'pt-BR');
    expect(ok).toMatchObject({ value: 'A'.repeat(24), over: false });
    expect(ok.error).toBeUndefined();
  });

  it('shows the error only once the player left the field, with the text of the problem', () => {
    const long = 'A'.repeat(25);
    expect(coachNameView(long, false, 'pt-BR')).toMatchObject({
      problem: 'too-long',
      over: true,
      counter: '25/24',
    });
    expect(coachNameView(long, false, 'pt-BR').error).toBeUndefined();
    expect(coachNameView(long, true, 'pt-BR').error).toBe(
      t('newGame.coach.error.tooLong', 'pt-BR', { max: 24 }),
    );
    for (const raw of ['', '   ']) {
      expect(coachNameView(raw, true, 'pt-BR')).toMatchObject({
        problem: 'empty',
        error: t('newGame.coach.error.empty', 'pt-BR'),
      });
    }
    expect(coachNameView('Zeca\u202E', true, 'pt-BR')).toMatchObject({
      problem: 'unsafe',
      error: t('newGame.coach.error.unsafe', 'pt-BR'),
    });
  });
});
