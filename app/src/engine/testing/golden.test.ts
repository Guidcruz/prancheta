import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkGolden, expectGolden, serializeGolden } from './golden.ts';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'prancheta-golden-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const data = { score: [2, 1], events: [{ minute: 12, type: 'goal' }] };

describe('golden helper', () => {
  it('fails when the golden is missing, and update mode creates it with the engine version', () => {
    expect(checkGolden('sample', data, { dir, engineVersion: 3, update: false }).status).toBe(
      'missing',
    );
    expect(checkGolden('sample', data, { dir, engineVersion: 3, update: true }).status).toBe(
      'written',
    );
    const file = JSON.parse(readFileSync(join(dir, 'sample.json'), 'utf8'));
    expect(file).toEqual({ engineVersion: 3, name: 'sample', data });
    expect(checkGolden('sample', data, { dir, engineVersion: 3, update: false }).status).toBe(
      'match',
    );
  });

  it('fails when the stored golden was written by another ENGINE_VERSION', () => {
    checkGolden('sample', data, { dir, engineVersion: 1, update: true });
    const outcome = checkGolden('sample', data, { dir, engineVersion: 2, update: false });
    expect(outcome.status).toBe('stale-version');
    expect(outcome.message).toContain('ENGINE_VERSION 1');
    // A golden from a newer engine is never downgraded, not even in update mode.
    expect(checkGolden('sample', data, { dir, engineVersion: 0, update: true }).status).toBe(
      'stale-version',
    );
  });

  it('fails when the output changes, and update refuses to overwrite without a version bump', () => {
    checkGolden('sample', data, { dir, engineVersion: 1, update: true });
    const changed = { ...data, score: [2, 2] };
    expect(checkGolden('sample', changed, { dir, engineVersion: 1, update: false }).status).toBe(
      'changed',
    );
    expect(checkGolden('sample', changed, { dir, engineVersion: 1, update: true }).status).toBe(
      'needs-bump',
    );
    expect(checkGolden('sample', data, { dir, engineVersion: 1, update: false }).status).toBe(
      'match',
    );
    // After the bump, update regenerates it and the new version passes.
    expect(checkGolden('sample', changed, { dir, engineVersion: 2, update: true }).status).toBe(
      'written',
    );
    expect(checkGolden('sample', changed, { dir, engineVersion: 2, update: false }).status).toBe(
      'match',
    );
  });

  it('treats key order as part of the output (byte-for-byte JSON)', () => {
    checkGolden('sample', { a: 1, b: 2 }, { dir, engineVersion: 1, update: true });
    expect(
      checkGolden('sample', { b: 2, a: 1 }, { dir, engineVersion: 1, update: false }).status,
    ).toBe('changed');
  });

  it('reports an unreadable file as invalid', () => {
    writeFileSync(join(dir, 'broken.json'), '{ not json', 'utf8');
    expect(checkGolden('broken', data, { dir, engineVersion: 1, update: false }).status).toBe(
      'invalid',
    );
    // A file copied under another name is rejected too.
    const copy = JSON.stringify({ engineVersion: 1, name: 'other', data });
    writeFileSync(join(dir, 'copy.json'), copy, 'utf8');
    expect(checkGolden('copy', data, { dir, engineVersion: 1, update: false }).status).toBe(
      'invalid',
    );
  });

  it('expectGolden throws on mismatch and passes on match', () => {
    checkGolden('sample', data, { dir, engineVersion: 1, update: true });
    expect(() =>
      expectGolden('sample', data, { dir, engineVersion: 1, update: false }),
    ).not.toThrow();
    expect(() =>
      expectGolden('sample', { ...data, score: [0, 0] }, { dir, engineVersion: 1, update: false }),
    ).toThrow(/bump ENGINE_VERSION/);
    expect(() => expectGolden('sample', data, { dir, engineVersion: 2, update: false })).toThrow(
      /ENGINE_VERSION 1/,
    );
  });

  it('rejects data that JSON would silently change, and bad names', () => {
    expect(() => serializeGolden({ x: Number.NaN })).toThrow(/non-finite/);
    expect(() => serializeGolden({ x: undefined })).toThrow(/undefined/);
    expect(() => checkGolden('Bad Name', data, { dir })).toThrow(/kebab-case/);
  });
});
