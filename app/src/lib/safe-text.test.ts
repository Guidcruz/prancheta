import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import clubsData from '../data/clubs.serie-a.json';
import { isSafeDisplayText } from './safe-text.ts';

/*
 * isSafeDisplayText (T-019, security review M2): what it refuses, and the real data passing it.
 * ASCII only on purpose: every character outside it is written as an escape (no invisible or
 * direction character in the source).
 */

describe('isSafeDisplayText', () => {
  it('accepts names with accents, apostrophes and hyphens, in NFC', () => {
    for (const text of [
      'Gr\u00eameos Futebol Porto-Alegrense',
      'Jo\u00e3o D\u2019\u00c1vila',
      'S\u00e3o Paul\u00e3o',
      '\u00d1and\u00fa',
      ' a b ',
    ]) {
      expect(isSafeDisplayText(text), text).toBe(true);
    }
  });

  it.each([
    ['a right-to-left override (RLO)', 'Treinador\u202eodanierb'],
    ['a left-to-right mark', 'Tre\u200einador'],
    ['a zero-width space', 'Trei\u200bnador'],
    ['an isolate', '\u2066Treinador\u2069'],
    ['a byte order mark', '\ufeffTreinador'],
    ['an Arabic letter mark', 'Trei\u061cnador'],
    ['a line separator', 'Trei\u2028nador'],
    ['a paragraph separator', 'Trei\u2029nador'],
    ['a soft hyphen', 'Trei\u00adnador'],
    ['a combining grapheme joiner', 'Trei\u034fnador'],
    ['a Hangul filler', 'Trei\u115fnador'],
    ['a Hangul filler (jungseong)', 'Trei\u1160nador'],
    ['a Mongolian vowel separator', 'Trei\u180enador'],
    ['a Hangul filler (compatibility)', 'Trei\u3164nador'],
    ['a halfwidth Hangul filler', 'Trei\uffa0nador'],
    ['an interlinear annotation', 'Trei\ufff9nador\ufffb'],
    ['a tag character', 'Treinador\u{e0041}'],
    ['a NUL', 'Trei\u0000nador'],
    ['a tab', 'Trei\tnador'],
    ['a line break', 'Trei\nnador'],
    ['DEL', 'Trei\u007fnador'],
    ['a C1 control', 'Trei\u0085nador'],
    ['zalgo (3 combining marks in a row)', 'Z\u0301\u0302\u0303algo'],
    ['text not in NFC', 'Joa\u0303o'],
    ['a lone surrogate', 'Trei\ud800nador'],
  ])('refuses %s', (_label, text) => {
    expect(isSafeDisplayText(text)).toBe(false);
  });

  it('accepts exactly 2 combining marks in a row that stay 2 in NFC, refuses 3', () => {
    // q has no precomposed form with these marks, so NFC keeps both after the letter.
    const two = 'q\u0301\u0302';
    expect(two.normalize('NFC')).toBe(two);
    expect(isSafeDisplayText(two)).toBe(true);
    const three = 'q\u0301\u0302\u0303';
    expect(three.normalize('NFC')).toBe(three);
    expect(isSafeDisplayText(three)).toBe(false);
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
