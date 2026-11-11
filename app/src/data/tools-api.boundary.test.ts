import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * QA of T-049 (docs/02-architecture.md, 4.1, "API de ferramentas"): the symbols of the tools API
 * of the engine's index.ts are for scripts/ only. Using one in lib/, ui/, main.ts or site/ is a
 * blocker; the lint cannot tell the symbols apart, so this test reads the imports.
 */
const TOOLS = new Set([
  'exp',
  'daysBetween',
  'attributeOf',
  'bestEleven',
  'generateSquad',
  'bestForSlot',
  'correctedCondition',
  'isUnavailable',
  'naturalFirstEleven',
  'pickBench',
  'pickCaptainAndTakers',
  'GOALKEEPER_SLOT',
  'effectiveRating',
  'homeAdvantage',
  'sectorStrengths',
  'strengthsFromRatings',
  'TeamStrengths',
  'HALF_MINUTES',
  'IN_MATCH_AI',
  'MAX_SUBS',
  'chanceProbability',
  'energyDrain',
  'goalProbability',
]);
const root = fileURLToPath(new URL('../../../', import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (name === 'node_modules' || name === 'dist' || name === '.astro') return [];
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|svelte|astro|mjs|js)$/.test(name) ? [path] : [];
  });
}

const IMPORT =
  /(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"](?:[^'"]*engine\/index\.ts|@engine)['"]/g;

describe('the tools API stays out of lib/, ui/, main.ts and site/', () => {
  const targets = [
    ...files(`${root}app/src/lib`),
    ...files(`${root}app/src/ui`),
    `${root}app/src/main.ts`,
    ...files(`${root}site/src`),
  ].filter((f) => !f.endsWith('tools-api.boundary.test.ts'));

  it('scans a real set of files', () => {
    expect(targets.length).toBeGreaterThan(10);
  });

  it('imports no tools symbol from the engine entry', () => {
    const offenders: string[] = [];
    for (const file of targets) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(IMPORT)) {
        for (const raw of m[1]!.split(',')) {
          const name = raw
            .trim()
            .replace(/^type\s+/, '')
            .split(/\s+as\s+/)[0]!;
          if (TOOLS.has(name)) offenders.push(`${file.replace(root, '')}: ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('would catch an import (the regex sees a multi-line import of a tools symbol)', () => {
    const sample = "import {\n  Rng,\n  type bestEleven,\n} from '../../engine/index.ts';";
    const names = [...sample.matchAll(IMPORT)].flatMap((m) => m[1]!.split(','));
    expect(names.map((n) => n.trim().replace(/^type\s+/, ''))).toContain('bestEleven');
  });
});
