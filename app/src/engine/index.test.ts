import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import * as engine from './index.ts';
import { ENGINE_VERSION, Rng, seedFromString } from './index.ts';
import { normal } from './math.ts';

/*
 * The runtime surface of index.ts (docs/02-architecture.md, 4.1, "Fronteira do `index.ts`";
 * T-049), pinned: a value that joins or leaves the contract or the tools API changes this list on
 * purpose, in the same PR as 4.1. The types are checked by the compiler, not here.
 */
const CONTRACT = [
  // foundations
  'ENGINE_VERSION',
  'Rng',
  'seedFromString',
  // functions
  'validateParams',
  'validateClubs',
  'validatePlayer',
  'newGame',
  'prepareRound',
  'simulateMatch',
  'playRound',
  'validateLineup',
  'suggestSheet',
  'teamStrength',
  'getStandings',
  'standingsHistory',
  'endSeason',
  'startNextSeason',
  'careerLeagueTitles',
  'strengthRank',
  'targetPosition',
  'seasonAwards',
  'roundRecap',
  'matchSheet',
  'isProspect',
  'attributeKeysFor',
  'playerForm',
  'fanMood',
  'draftFromSheet',
  'fitLevel',
  'isAvailable',
  'sheetStrength',
  'reshapeLineup',
  'completeSheet',
  'sheetRoles',
  'sheetProblems',
  'takerValue',
  'secondaryPositionFor',
  // closed lists and field ranges
  'PARAM_RANGES',
  'SEASON_ROUNDS',
  'AI_PROFILES',
  'BLOCKLIST_FIELDS',
  'CLUB_SIZES',
  'CREST_PATTERNS',
  'CREST_SHAPES',
  'CREST_SYMBOLS',
  'STRENGTH_RANGE',
  'AGE_RANGE',
  'ATTRIBUTE_RANGE',
  'CONDITION_RANGE',
  'FACE_MAX_LENGTH',
  'MORALE_RANGE',
  'POSITIONS',
  'POTENTIAL_STORED_MAX',
  'RATING_RANGE',
  'RECENT_RATINGS_MAX',
  'SHIRT_RANGE',
  'SQUAD_SIZE',
  'TAKER_ATTRIBUTE',
  'TRAITS',
  'FORMATIONS',
  'FORMATION_SLOTS',
  'POSTURES',
  'BENCH_SIZE',
  'MATCH_MODES',
  'HALFTIME_TALKS',
  'MARKERS',
  'MATCH_SHEET_EVENTS',
  'FORM_LENGTH',
  'RELEGATION_SPOTS',
  'FAN_MOODS',
];
/** Only for scripts/ (the /balance); 4.1, "API de ferramentas". */
const TOOLS = [
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
  'HALF_MINUTES',
  'IN_MATCH_AI',
  'MAX_SUBS',
  'chanceProbability',
  'energyDrain',
  'goalProbability',
];

describe('engine public API', () => {
  it('exports exactly the contract and the tools API, nothing internal', () => {
    expect(new Set([...CONTRACT, ...TOOLS]).size).toBe(CONTRACT.length + TOOLS.length);
    expect(Object.keys(engine).sort()).toEqual([...CONTRACT, ...TOOLS].sort());
    for (const internal of [
      'summarizeMatch',
      'roundFacts',
      'roundTables',
      'matchSeed',
      'fit',
      // ADR-0022, "Conformidade": the screen reads the level by fitLevel, never these.
      'FIT',
      'IMPROVISED_MIN_FIT',
      'SECONDARY_FIT',
      'secondaryNeighbours',
    ]) {
      expect(internal in engine, internal).toBe(false);
    }
  });

  it('exposes the foundations', () => {
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(1);
    expect(new Rng(seedFromString('a')).next()).toBe(new Rng(seedFromString('a')).next());
  });

  it('runs in plain Node without a build step and gives the same numbers', () => {
    const entry = JSON.stringify(new URL('./index.ts', import.meta.url).href);
    const math = JSON.stringify(new URL('./math.ts', import.meta.url).href);
    const script = [
      `const m = await import(${entry});`,
      `const { normal } = await import(${math});`,
      `const r = new m.Rng(42);`,
      `process.stdout.write(JSON.stringify({ v: m.ENGINE_VERSION, n: r.next(), z: normal(r) }));`,
    ].join('\n');
    let out: string;
    try {
      out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      const stderr = (error as { stderr?: string }).stderr ?? '';
      throw new Error(`plain Node could not run the engine:\n${stderr}`, { cause: error });
    }
    const r = new Rng(42);
    expect(JSON.parse(out)).toEqual({ v: ENGINE_VERSION, n: r.next(), z: normal(r) });
  });
});
