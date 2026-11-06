import { SAVE_SCHEMA_VERSION, type CareerSave } from '../schema.ts';
import { fail, ok, type SaveResult } from '../result.ts';

/*
 * Entry point of the save migrations (ADR-0006; docs/02-architecture.md, 4.2, "Migração"). Each
 * migration is a pure function `vN → vN+1` in `NNNN-<slug>.ts`, applied in a chain in memory; the
 * original snapshot is replaced only after the migrated one is stored and checked (the store does
 * that, by writing a new snapshot). A save newer than this build is never opened nor changed.
 *
 * The format is frozen at v1 (T-019): the fixture `__fixtures__/v1.json`, the shape test and the
 * strict schema (validate.ts). The chain is empty while the format is v1; every format change
 * after it raises `SAVE_SCHEMA_VERSION` and adds here one step, in its own file
 * (`0001-<slug>.ts` for v1 → v2), with the fixture of the new version (fixtures.test.ts) and a
 * test of the step. The infrastructure is tested with synthetic steps, also through the store
 * (migrated.test.ts).
 */

/**
 * A step of the chain: the save in version `from`, as parsed, to version `from + 1`. A step
 * builds its output only with spread and copies (`{ ...save, career: { ...career, x } }`,
 * `Object.fromEntries`), never by assigning a key read from the save into an object: the save is
 * untrusted until the strict schema after the chain. The store (and the import of T-020) refuses
 * prototype keys before the chain runs (validate.ts, `hasForbiddenKey`).
 */
export interface Migration {
  readonly from: number;
  readonly migrate: (save: Record<string, unknown>) => Record<string, unknown>;
}

/** The chain, one step per version: the step `from: N` takes a save of version N to N + 1. */
export const MIGRATIONS: readonly Migration[] = [];

export type MigrationError = 'save-too-new' | 'unknown-version' | 'migration-failed';

/**
 * The `schemaVersion` of a parsed save (a whole number, 0 or more), or `undefined` when it has none
 * that is valid. No build ever wrote a version 0: it only exists for the synthetic step of the
 * tests, and with the real chain it has no step (`migration-failed`).
 */
export function schemaVersionOf(raw: unknown): number | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  return typeof version === 'number' && Number.isSafeInteger(version) && version >= 0
    ? version
    : undefined;
}

/**
 * Brings a parsed save to {@link SAVE_SCHEMA_VERSION}, step by step. The result still needs the
 * strict schema (validate.ts, `full`); the input is not changed. `save-too-new`: written by a
 * newer build; `unknown-version`: no valid `schemaVersion`; `migration-failed`: a step is missing
 * or threw (a bug in the step, or a save that is not what its version says), with `detail.from`.
 */
export function migrateSave(
  raw: unknown,
  chain: readonly Migration[] = MIGRATIONS,
  target: number = SAVE_SCHEMA_VERSION,
): SaveResult<CareerSave, MigrationError> {
  const version = schemaVersionOf(raw);
  if (version === undefined) return fail('unknown-version');
  if (version > target) return fail('save-too-new', { version, supported: target });
  let save = raw as Record<string, unknown>;
  for (let from = version; from < target; from++) {
    const step = chain.find((s) => s.from === from);
    if (step === undefined) return fail('migration-failed', { from });
    try {
      save = { ...step.migrate(save), schemaVersion: from + 1 };
    } catch {
      return fail('migration-failed', { from });
    }
  }
  return ok(save as unknown as CareerSave);
}
