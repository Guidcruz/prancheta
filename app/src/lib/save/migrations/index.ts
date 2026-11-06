import { SAVE_SCHEMA_VERSION, type CareerSave } from '../schema.ts';
import { fail, ok, type SaveResult } from '../result.ts';

/*
 * Entry point of the save migrations (ADR-0006; docs/02-architecture.md, 4.2, "Migração"). Each
 * migration is a pure function `vN → vN+1` in `NNNN-<slug>.ts`, applied in a chain in memory; the
 * original snapshot is replaced only after the migrated one is stored and checked (the store does
 * that, by writing a new snapshot). A save newer than this build is never opened nor changed.
 *
 * The chain is empty while the format is v1. T-019 freezes v1 (fixture, shape test, valibot) and
 * every format change after it adds one step here, with its fixture and test.
 */

/** A step of the chain: the save in version `from`, as parsed, to version `from + 1`. */
export interface Migration {
  readonly from: number;
  readonly migrate: (save: Record<string, unknown>) => Record<string, unknown>;
}

/** The chain, in order: `MIGRATIONS[i].from === i + 1`. */
export const MIGRATIONS: readonly Migration[] = [];

export type MigrationError = 'save-too-new' | 'unknown-version' | 'migration-failed';

/** The `schemaVersion` of a parsed save, or `undefined` when it has none that is valid. */
export function schemaVersionOf(raw: unknown): number | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  return typeof version === 'number' && Number.isInteger(version) && version >= 1
    ? version
    : undefined;
}

/**
 * Brings a parsed save to {@link SAVE_SCHEMA_VERSION}. The result still needs validation (the
 * schema of T-019); the input is not changed. `save-too-new`: written by a newer build;
 * `unknown-version`: no valid `schemaVersion`; `migration-failed`: a step threw (a bug in the
 * step or a save that is not what its version says).
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
    const step = chain[from - 1];
    if (step === undefined || step.from !== from) return fail('migration-failed', { from });
    try {
      save = { ...step.migrate(save), schemaVersion: from + 1 };
    } catch {
      return fail('migration-failed', { from });
    }
  }
  return ok(save as unknown as CareerSave);
}
