import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA_VERSION } from '../schema.ts';
import { MIGRATIONS, migrateSave, schemaVersionOf, type Migration } from './index.ts';

describe('migration entry point (ADR-0006)', () => {
  it('starts at format 1 with an empty chain', () => {
    expect(SAVE_SCHEMA_VERSION).toBe(1);
    expect(MIGRATIONS).toEqual([]);
  });

  it('returns a save of the current version as it is', () => {
    const save = { schemaVersion: 1, careerId: 'x' };
    const result = migrateSave(save);
    expect(result).toEqual({ ok: true, value: save });
  });

  it('refuses a save newer than this build, and one without a valid version', () => {
    expect(migrateSave({ schemaVersion: 2 })).toEqual({
      ok: false,
      error: 'save-too-new',
      detail: { version: 2, supported: 1 },
    });
    for (const raw of [null, [], 'x', {}, { schemaVersion: 0 }, { schemaVersion: 1.5 }]) {
      expect(migrateSave(raw)).toEqual({ ok: false, error: 'unknown-version' });
      expect(schemaVersionOf(raw)).toBeUndefined();
    }
  });

  it('runs a chain in order, step by step, without changing the input', () => {
    const chain: Migration[] = [
      { from: 1, migrate: (s) => ({ ...s, a: 'added in 2' }) },
      { from: 2, migrate: (s) => ({ ...s, b: `${String(s.a)} then 3` }) },
    ];
    const v1 = Object.freeze({ schemaVersion: 1, careerId: 'x' });
    const all = migrateSave(v1, chain, 3);
    expect(all).toEqual({
      ok: true,
      value: { schemaVersion: 3, careerId: 'x', a: 'added in 2', b: 'added in 2 then 3' },
    });
    const two = migrateSave(v1, chain, 2);
    expect(two.ok && migrateSave(two.value, chain, 3)).toEqual(all);
    expect(v1).toEqual({ schemaVersion: 1, careerId: 'x' });
  });

  it('reports a step that throws or is missing', () => {
    const throwing: Migration[] = [
      {
        from: 1,
        migrate: () => {
          throw new Error('bad step');
        },
      },
    ];
    expect(migrateSave({ schemaVersion: 1 }, throwing, 2)).toEqual({
      ok: false,
      error: 'migration-failed',
      detail: { from: 1 },
    });
    expect(migrateSave({ schemaVersion: 1 }, [], 2)).toEqual({
      ok: false,
      error: 'migration-failed',
      detail: { from: 1 },
    });
  });
});
