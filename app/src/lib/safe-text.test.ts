import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import clubsData from '../data/clubs.serie-a.json';
import { isSafeDisplayText } from './safe-text.ts';

/* isSafeDisplayText (T-019, security review M2): what it refuses, and the real data passing it. */

describe('isSafeDisplayText', () => {
  it('accepts names with accents, apostrophes and hyphens, in NFC', () => {
    for (const text of [
      'Grêmeos Futebol Porto-Alegrense',
      'João D’Ávila',
      'São Paulão',
      'Ñandú',
      ' a b ',
    ]) {
      expect(isSafeDisplayText(text), text).toBe(true);
    }
  });

  it.each([
    ['a right-to-left override (RLO)', 'Treinador‮odanierb'],
    ['a left-to-right mark', 'Tre‎inador'],
    ['a zero-width space', 'Trei​nador'],
    ['an isolate', '⁦Treinador⁩'],
    ['a byte order mark', '﻿Treinador'],
    ['a NUL', 'Trei\u0000nador'],
    ['a tab', 'Trei\tnador'],
    ['a line break', 'Trei\nnador'],
    ['DEL', 'Trei\u007Fnador'],
    ['a C1 control', 'Trei\u0085nador'],
    ['zalgo (3 combining marks in a row)', 'Ź̂̃algo'],
    ['text not in NFC', 'João'],
    ['a lone surrogate', 'Trei\uD800nador'],
  ])('refuses %s', (_label, text) => {
    expect(isSafeDisplayText(text)).toBe(false);
  });

  it('accepts up to 2 combining marks in a row (when NFC keeps them apart)', () => {
    expect(isSafeDisplayText('ậ'.normalize('NFC'))).toBe(true);
  });

  it('passes every text of the club data and of the name lists', () => {
    const clubs = clubsData as unknown as Record<string, unknown>[];
    for (const club of clubs) {
      const stadium = club.stadium as { name: string };
      for (const text of [club.name, club.shortName, club.nickname, club.city, stadium.name]) {
        expect(isSafeDisplayText(text as string), String(text)).toBe(true);
      }
    }
    const lists = readFileSync(new URL('../content/names/br.json', import.meta.url), 'utf8');
    const strings = [...lists.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(
      (m) => JSON.parse(`"${m[1]}"`) as string,
    );
    expect(strings.length).toBeGreaterThan(1000);
    expect(strings.filter((text) => !isSafeDisplayText(text))).toEqual([]);
  });
});
