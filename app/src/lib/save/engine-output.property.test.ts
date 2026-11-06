import { describe, expect, it } from 'vitest';
import { playedCareer } from './testing/sample.ts';
import { parseCareerSave } from './validate.ts';

/*
 * The invariant of the check levels (docs/02-architecture.md, 4.2, "Níveis de conferência do
 * esquema", condition 1): what the write accepts, the opening accepts. The write reads of the
 * engine's part (`game`, `career.lastRound`) only what the store needs, so the engine's output
 * must pass the full schema; this property test is what guarantees it. Each save, with the recap
 * of its round and every sheet of the season so far, passes `full`, and the same save passes
 * `open` and `write`.
 *
 * Normal run: 3 seeds × both realisms, after rounds 1, 10, 20, 30 and 38, at the end of the
 * season and after round 1 of season 2 (42 saves). `PROPERTY_FULL=1`: 100 seeds × both
 * realisms and every round of season 1, its end and round 1 of season 2 (8,000 saves):
 * `PROPERTY_FULL=1 npm test -w app -- src/lib/save/engine-output.property.test.ts`.
 */

const FULL = process.env.PROPERTY_FULL === '1';
const SEEDS = FULL ? Array.from({ length: 100 }, (_, i) => 1 + i * 7919) : [1, 2026, 424242];
const CHECKPOINTS = new Set<number | 'end'>([1, 10, 20, 30, 38, 'end']);
const at = (season: number, round: number | 'end') =>
  season === 2 || FULL || CHECKPOINTS.has(round);

describe("the engine's output passes the strict schema (property, invariant of the levels)", () => {
  const cases = SEEDS.flatMap((seed) =>
    (['full', 'simplified'] as const).map((realism) => [seed, realism] as const),
  );

  it.each(cases)(
    'seed %i, realism %s: every save passes full, open and write',
    (seed, realism) => {
      const labels: string[] = [];
      for (const { label, save } of playedCareer({ seed, realism, club: seed % 20 }, at)) {
        labels.push(label);
        // As the store reads it back: JSON, then the levels.
        const stored: unknown = JSON.parse(JSON.stringify(save));
        for (const check of ['full', 'open', 'write'] as const) {
          const parsed = parseCareerSave(stored, { check, careerId: save.careerId });
          if (!parsed.ok) throw new Error(`${label} ${check}: ${JSON.stringify(parsed.detail)}`);
        }
        if (label !== 's1-end') expect(save.career.lastRound, label).toBeDefined();
      }
      expect(labels).toHaveLength(FULL ? 40 : 7);
    },
    FULL ? 600_000 : 60_000,
  );
});
