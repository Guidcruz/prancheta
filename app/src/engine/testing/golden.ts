/**
 * Golden test helper for the engine (ADR-0007, rule 7; docs/03-test-plan.md).
 *
 * Test-only code: never imported by `index.ts`, so it is free to use `node:fs`.
 *
 * A golden file is `__golden__/<name>.json` = `{ engineVersion, name, data }`. Rules:
 * - check mode (`npm test`): the file must exist, must have been written by the current
 *   ENGINE_VERSION and its data must be byte-identical (as JSON) to the new output;
 * - update mode (`npm run golden:update -w app`): writes new and outdated files, but refuses to
 *   overwrite a file whose data changed while ENGINE_VERSION stayed the same. Changing a golden
 *   therefore always means bumping ENGINE_VERSION in the same PR.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import { ENGINE_VERSION } from '../version.ts';

export const GOLDEN_DIR = fileURLToPath(new URL('../__golden__/', import.meta.url));

export interface GoldenFile {
  engineVersion: number;
  name: string;
  data: unknown;
}

export type GoldenStatus =
  'match' | 'written' | 'missing' | 'invalid' | 'stale-version' | 'changed' | 'needs-bump';

export interface GoldenOutcome {
  status: GoldenStatus;
  file: string;
  message: string;
  /** Stored data, when the file could be read (for a readable diff). */
  stored?: unknown;
}

export interface GoldenOptions {
  dir?: string;
  update?: boolean;
  engineVersion?: number;
}

const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UPDATE_HINT = 'run `npm run golden:update -w app`';

/** True when vitest runs with `--mode golden` (the `golden:update` script). */
export function isGoldenUpdate(): boolean {
  return import.meta.env.MODE === 'golden';
}

/**
 * Canonical JSON of the golden data. Non-finite numbers and `undefined` values would be silently
 * changed by JSON, so they are rejected (a test bug, hence the throw).
 */
export function serializeGolden(data: unknown): string {
  return JSON.stringify(data, (key, value: unknown) => {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new TypeError(`golden data has a non-finite number at "${key}"`);
    }
    if (value === undefined && key !== '') {
      throw new TypeError(`golden data has undefined at "${key}"; omit the key instead`);
    }
    return value;
  });
}

function readGolden(file: string): GoldenFile | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'engineVersion' in parsed &&
      'data' in parsed &&
      Number.isInteger(parsed.engineVersion)
    ) {
      return parsed as GoldenFile;
    }
  } catch {
    // Fall through: unreadable or not JSON.
  }
  return undefined;
}

function writeGolden(file: string, dir: string, golden: GoldenFile): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, `${JSON.stringify(golden, null, 2)}\n`, 'utf8');
}

/** Compares (or, in update mode, writes) a golden file and reports what happened. */
export function checkGolden(
  name: string,
  data: unknown,
  options: GoldenOptions = {},
): GoldenOutcome {
  if (!NAME.test(name)) throw new TypeError(`invalid golden name "${name}" (use kebab-case)`);
  const dir = options.dir ?? GOLDEN_DIR;
  const update = options.update ?? isGoldenUpdate();
  const version = options.engineVersion ?? ENGINE_VERSION;
  const file = join(dir, `${name}.json`);
  const actual = serializeGolden(data);
  const fresh: GoldenFile = { engineVersion: version, name, data: JSON.parse(actual) };

  if (!existsSync(file)) {
    if (!update)
      return {
        status: 'missing',
        file,
        message: `golden "${name}" does not exist; ${UPDATE_HINT}`,
      };
    writeGolden(file, dir, fresh);
    return { status: 'written', file, message: `golden "${name}" created` };
  }

  const stored = readGolden(file);
  if (stored === undefined) {
    return { status: 'invalid', file, message: `golden "${name}" is not a valid golden file` };
  }
  const same = serializeGolden(stored.data) === actual;

  if (stored.engineVersion !== version) {
    if (update && stored.engineVersion < version) {
      writeGolden(file, dir, fresh);
      return { status: 'written', file, message: `golden "${name}" regenerated for v${version}` };
    }
    return {
      status: 'stale-version',
      file,
      stored: stored.data,
      message:
        `golden "${name}" was written by ENGINE_VERSION ${stored.engineVersion}, ` +
        `the engine is ${version}; ${UPDATE_HINT}`,
    };
  }

  if (same) return { status: 'match', file, message: `golden "${name}" matches` };

  if (update) {
    return {
      status: 'needs-bump',
      file,
      stored: stored.data,
      message:
        `golden "${name}" changed but ENGINE_VERSION is still ${version}; ` +
        `bump it in app/src/engine/version.ts, then ${UPDATE_HINT}`,
    };
  }
  return {
    status: 'changed',
    file,
    stored: stored.data,
    message:
      `golden "${name}" changed: the engine output is different. If intended, bump ENGINE_VERSION ` +
      `in app/src/engine/version.ts and ${UPDATE_HINT}`,
  };
}

/** Vitest assertion: passes on `match` or `written`, fails with a diff otherwise. */
export function expectGolden(name: string, data: unknown, options: GoldenOptions = {}): void {
  const outcome = checkGolden(name, data, options);
  if (outcome.status === 'match' || outcome.status === 'written') return;
  if (
    outcome.stored !== undefined &&
    (outcome.status === 'changed' || outcome.status === 'needs-bump')
  ) {
    expect(JSON.parse(serializeGolden(data)), outcome.message).toStrictEqual(outcome.stored);
  }
  expect.fail(outcome.message);
}
