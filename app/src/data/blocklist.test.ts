import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildBlocklist,
  hashName,
  NORMALIZATION,
  normalizeName,
  parseBlocklist,
} from './blocklist.ts';

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

describe('normalizeName', () => {
  it.each([
    ['Clube Teste', 'clube teste'],
    ['  CLUBE   TESTE  ', 'clube teste'],
    ['Estádio Imaginário', 'estadio imaginario'],
    ['São João\tdo  Ç', 'sao joao do c'],
    ['Ñandú Ünïcø', 'nandu unicø'], // ø is a letter, not a letter plus a mark
    ['Linha\nquebrada', 'linha quebrada'],
    ['   ', ''],
  ])('%j → %j', (input, expected) => {
    expect(normalizeName(input)).toBe(expected);
  });

  it('treats composed and decomposed accents the same', () => {
    expect(normalizeName('Grêmio Inventado')).toBe(normalizeName('Grêmio Inventado'));
  });
});

describe('hashName', () => {
  it('is the SHA-256 hex of the normalized name', () => {
    expect(hashName('Clube Teste')).toBe(sha256('clube teste'));
    expect(hashName('  CLÚBE  tésté ')).toBe(sha256('clube teste'));
    expect(hashName('Clube Teste')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('buildBlocklist', () => {
  it('sorts, removes duplicates and skips empty names', () => {
    const file = buildBlocklist(['Clube B', 'clube a', 'CLUBE B', '  ', 'Clube Á']);
    const expected = [sha256('clube a'), sha256('clube b')].sort();
    expect(file).toEqual({ algorithm: 'sha256', normalization: NORMALIZATION, hashes: expected });
  });

  it('holds no name in clear text', () => {
    expect(JSON.stringify(buildBlocklist(['Clube Inventado']))).not.toMatch(/clube|inventado/i);
  });
});

describe('parseBlocklist', () => {
  it('reads a valid file', () => {
    const result = parseBlocklist(buildBlocklist(['Clube Teste', 'Outro Teste']));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.hashes.has(hashName('clube teste'))).toBe(true);
  });

  it('accepts an empty list', () => {
    expect(parseBlocklist(buildBlocklist([])).ok).toBe(true);
  });

  it('refuses a wrong shape, never throwing', () => {
    expect(parseBlocklist(null)).toEqual({ ok: false, issues: [{ problem: 'not-an-object' }] });
    expect(parseBlocklist([])).toEqual({ ok: false, issues: [{ problem: 'not-an-object' }] });
    expect(parseBlocklist({ algorithm: 'md5', normalization: 'x', hashes: 'y' })).toEqual({
      ok: false,
      issues: [
        { problem: 'wrong-algorithm' },
        { problem: 'wrong-normalization' },
        { problem: 'not-a-list' },
      ],
    });
  });

  it('refuses invalid, unsorted and repeated hashes', () => {
    const [a, b] = [sha256('a'), sha256('b')].sort() as [string, string];
    const file = (hashes: unknown[]) => ({
      algorithm: 'sha256',
      normalization: NORMALIZATION,
      hashes,
    });
    expect(parseBlocklist(file([a, 'Clube Teste', a.toUpperCase()]))).toEqual({
      ok: false,
      issues: [
        { problem: 'invalid-hash', index: 1 },
        { problem: 'invalid-hash', index: 2 },
      ],
    });
    expect(parseBlocklist(file([b, a]))).toEqual({
      ok: false,
      issues: [{ problem: 'not-sorted', index: 1 }],
    });
    expect(parseBlocklist(file([a, a]))).toEqual({
      ok: false,
      issues: [{ problem: 'not-sorted', index: 1 }],
    });
  });
});
