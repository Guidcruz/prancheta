import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA_VERSION } from '../schema.ts';
import { coachDraft } from './0001-coach-draft.ts';
import { secondaryPosition } from './0002-secondary-position.ts';
import { MIGRATIONS, migrateSave, schemaVersionOf, type Migration } from './index.ts';

describe('migration entry point (ADR-0006)', () => {
  it('is at format 3 with one step per older version (T-019, T-075, T-078)', () => {
    expect(SAVE_SCHEMA_VERSION).toBe(3);
    expect(MIGRATIONS).toEqual([coachDraft, secondaryPosition]);
    expect(MIGRATIONS.map((step) => step.from)).toEqual([1, 2]);
  });

  it('returns a save of the current version as it is', () => {
    const save = { schemaVersion: 3, careerId: 'x' };
    const result = migrateSave(save);
    expect(result).toEqual({ ok: true, value: save });
  });

  it('refuses a save newer than this build, and one without a valid version', () => {
    expect(migrateSave({ schemaVersion: 4 })).toEqual({
      ok: false,
      error: 'save-too-new',
      detail: { version: 4, supported: 3 },
    });
    // A build of format 2 (the chain up to 2) refuses a v3 save, unchanged (ADR-0022).
    const v3 = Object.freeze({ schemaVersion: 3, careerId: 'x' });
    expect(migrateSave(v3, [coachDraft], 2)).toEqual({
      ok: false,
      error: 'save-too-new',
      detail: { version: 3, supported: 2 },
    });
    expect(v3).toEqual({ schemaVersion: 3, careerId: 'x' });
    // A build of format 1 (an empty chain up to 1) refuses a v2 save, unchanged (ADR-0021).
    const v2 = Object.freeze({ schemaVersion: 2, careerId: 'x' });
    expect(migrateSave(v2, [], 1)).toEqual({
      ok: false,
      error: 'save-too-new',
      detail: { version: 2, supported: 1 },
    });
    expect(v2).toEqual({ schemaVersion: 2, careerId: 'x' });
    for (const raw of [null, [], 'x', {}, { schemaVersion: -1 }, { schemaVersion: 1.5 }]) {
      expect(migrateSave(raw)).toEqual({ ok: false, error: 'unknown-version' });
      expect(schemaVersionOf(raw)).toBeUndefined();
    }
  });

  it('has no step from version 0, which no build ever wrote (only the synthetic tests use it)', () => {
    expect(schemaVersionOf({ schemaVersion: 0 })).toBe(0);
    expect(migrateSave({ schemaVersion: 0 })).toEqual({
      ok: false,
      error: 'migration-failed',
      detail: { from: 0 },
    });
    const v0: Migration[] = [{ from: 0, migrate: (s) => ({ ...s, added: true }) }];
    expect(migrateSave({ schemaVersion: 0 }, v0, 1)).toEqual({
      ok: true,
      value: { schemaVersion: 1, added: true },
    });
  });

  it('finds each step by its version, whatever the order of the chain', () => {
    const chain: Migration[] = [
      { from: 2, migrate: (s) => ({ ...s, order: `${String(s.order)},2` }) },
      { from: 1, migrate: (s) => ({ ...s, order: '1' }) },
    ];
    expect(migrateSave({ schemaVersion: 1 }, chain, 3)).toEqual({
      ok: true,
      value: { schemaVersion: 3, order: '1,2' },
    });
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
