import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GOLDEN_DIR, isGoldenUpdate } from './testing/golden.ts';
import { ENGINE_VERSION } from './version.ts';

describe('ENGINE_VERSION', () => {
  it('is a positive integer', () => {
    expect(Number.isInteger(ENGINE_VERSION)).toBe(true);
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(1);
  });

  // Skipped while `golden:update` runs, since the files are being rewritten in parallel.
  it.skipIf(isGoldenUpdate())('matches the version recorded in every golden file', () => {
    const files = readdirSync(GOLDEN_DIR).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const golden = JSON.parse(readFileSync(`${GOLDEN_DIR}${f}`, 'utf8')) as {
        engineVersion: unknown;
      };
      expect(golden.engineVersion, `${f}: run \`npm run golden:update -w app\``).toBe(
        ENGINE_VERSION,
      );
    }
  });
});
