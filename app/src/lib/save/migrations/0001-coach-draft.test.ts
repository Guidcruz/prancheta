import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CareerSave } from '../schema.ts';
import { sampleDraft } from '../testing/sample.ts';
import { parseCareerSave } from '../validate.ts';
import { coachDraft } from './0001-coach-draft.ts';
import { migrateSave } from './index.ts';

/*
 * The step v1 → v2 (ADR-0021, item 4; T-075), on the frozen v1 fixture: nothing changes but
 * `schemaVersion`, and a v1 save with `career.draft` (an edited file: no v1 build writes it)
 * comes out without it. The chain stops at v2 (`toV2`); the whole chain up to the current format
 * is in fixtures.test.ts and in the step v2 → v3 (0002-secondary-position.test.ts).
 */

/** The chain up to v2 only. */
const toV2 = (raw: unknown) => migrateSave(raw, [coachDraft], 2);

const v1 = JSON.parse(
  readFileSync(new URL('../__fixtures__/v1.json', import.meta.url), 'utf8'),
) as Record<string, unknown> & { career: Record<string, unknown> };

describe('migration 0001-coach-draft (v1 → v2)', () => {
  it('is the step from version 1', () => {
    expect(coachDraft.from).toBe(1);
  });

  it('changes nothing but schemaVersion, and leaves the input as it was', () => {
    const before = structuredClone(v1);
    const migrated = toV2(v1);
    if (!migrated.ok) throw new Error(migrated.error);
    expect(migrated.value).toEqual({ ...v1, schemaVersion: 2 });
    expect(Object.hasOwn(migrated.value.career, 'draft')).toBe(false);
    // The match sheets are the same (their rows are rewritten with the same content).
    expect(migrated.value.career.matchSheets).toEqual(v1.career.matchSheets);
    expect(v1).toEqual(before);
  });

  it('drops a career.draft that a v1 save should not have', () => {
    const draft = sampleDraft(v1 as unknown as CareerSave);
    const edited = { ...v1, career: { ...v1.career, draft } };
    const migrated = toV2(edited);
    if (!migrated.ok) throw new Error(migrated.error);
    expect(Object.hasOwn(migrated.value.career, 'draft')).toBe(false);
    expect(migrated.value).toEqual({ ...v1, schemaVersion: 2 });
    expect(edited.career.draft).toBe(draft);
  });

  it('drops even a draft that is not a sheet, and the result passes the full schema', () => {
    for (const draft of [null, 'x', 7, [], { lineup: 'x' }]) {
      const migrated = migrateSave({ ...v1, career: { ...v1.career, draft } });
      if (!migrated.ok) throw new Error(migrated.error);
      expect(Object.hasOwn(migrated.value.career, 'draft')).toBe(false);
      expect(parseCareerSave(migrated.value).ok).toBe(true);
    }
  });

  it('copies a save whose career is not an object, for the schema to refuse', () => {
    for (const career of [undefined, null, 'x', []]) {
      const raw = { schemaVersion: 1, career };
      const out = coachDraft.migrate(raw);
      expect(out).toEqual(raw);
      expect(out).not.toBe(raw);
    }
  });
});
