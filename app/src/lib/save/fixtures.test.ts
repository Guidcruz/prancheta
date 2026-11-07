import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { suggestSheet } from '../../engine/index.ts';
import { loadGameParams } from '../params.ts';
import { migrateSave } from './migrations/index.ts';
import { SAVE_SCHEMA_VERSION, type CareerSave } from './schema.ts';
import { sampleCareerSave, sampleDraft } from './testing/sample.ts';
import { formatShape, shapePaths, type Shape } from './testing/shape.ts';
import { careerSaveSchema, parseCareerSave } from './validate.ts';

/*
 * The frozen format (ADR-0006, US-033; docs/02-architecture.md, 4.2, "Migração"; T-019):
 *
 * - `__fixtures__/vN.json`: a save of every format N, made once and never changed. Each one goes
 *   up the migration chain and must pass the strict schema of the current format.
 * - `__fixtures__/shape-vN.json`: the shape (testing/shape.ts) of the current format. A save made
 *   now must have it: a field added, removed or retyped in `GameState` or in the envelope, or a
 *   value added to a closed list of the schema, fails here until `SAVE_SCHEMA_VERSION` goes up
 *   with a migration (migrations/), the new fixture and the new shape. Not caught here: a value
 *   added to a closed list inside `Player` or `ClubDef` (positions, traits, crest shapes...,
 *   checked by the engine's validators, opaque in the shape) and a change of `SAVE_LIMITS` (the
 *   shape has no bounds); those go through review, and a tighter one needs a migration.
 *
 * Limit of the shape test: the players and the club definitions are opaque in the schema (the
 * engine's `validatePlayer` and `validateClubs` check them), so their shape is read from the
 * sample save, merged. A field that is optional there and present in every sample counts as
 * required: `ClubDef.aiProfile` is optional, and a set of club data with a club without it would
 * change the shape (`aiProfile?`) without a change of format. Then the shape is frozen again
 * with the new version, or the sample gets such a club.
 *
 * To freeze a new version, after raising `SAVE_SCHEMA_VERSION` and writing the step:
 * `npm run save:fixtures -w app` writes `vN.json` and `shape-vN.json` of the new version only. It
 * never overwrites a file: the fixtures of the versions already released stay as they were.
 */

const dir = new URL('./__fixtures__/', import.meta.url);
const file = (name: string) => new URL(name, dir);
const readJson = (name: string): unknown => JSON.parse(readFileSync(file(name), 'utf8'));
const WRITE = process.env.SAVE_FIXTURES_WRITE === '1';

/**
 * The career of the fixture: a whole season played and turned, and 2 rounds of the second. From
 * v2 on it carries the coach's draft sheet (ADR-0021, item 4), with free slots on the pitch and on
 * the bench, so the shape records `null` there.
 */
const FIXTURE_CAREER_ID = '00000000-0000-4000-8000-000000000019';
const played: CareerSave = sampleCareerSave({
  season: 2,
  rounds: 2,
  careerId: FIXTURE_CAREER_ID,
  club: 7,
});
const fresh: CareerSave = {
  ...played,
  career: { ...played.career, draft: sampleDraft(played) },
};
const freshShape = formatShape(careerSaveSchema, [fresh]);

if (WRITE) {
  const current = `v${SAVE_SCHEMA_VERSION}.json`;
  const shape = `shape-v${SAVE_SCHEMA_VERSION}.json`;
  if (!existsSync(file(current))) writeFileSync(file(current), `${JSON.stringify(fresh)}\n`);
  if (!existsSync(file(shape))) {
    writeFileSync(file(shape), `${JSON.stringify(freshShape, null, 2)}\n`);
  }
}

const versions = readdirSync(dir)
  .map((name) => /^v(\d+)\.json$/.exec(name)?.[1])
  .filter((n): n is string => n !== undefined)
  .map(Number)
  .sort((a, b) => a - b);

describe('the frozen save format (US-033, T-019)', () => {
  it('has a fixture of every version up to the current one, and the shape of the current one', () => {
    expect(versions).toEqual(Array.from({ length: SAVE_SCHEMA_VERSION }, (_, i) => i + 1));
    expect(existsSync(file(`shape-v${SAVE_SCHEMA_VERSION}.json`))).toBe(true);
  });

  it.each(versions)(
    'the v%i fixture goes up the chain and passes the strict schema, same round, club and table',
    (version) => {
      const raw = readJson(`v${version}.json`) as {
        schemaVersion: number;
        career: { clubId: string };
        game: { season: number; round: number; fixtures: { result?: { score: unknown } }[] };
      };
      expect(raw.schemaVersion).toBe(version);
      const migrated = migrateSave(raw);
      if (!migrated.ok) throw new Error(`migrateSave v${version}: ${migrated.error}`);
      const parsed = parseCareerSave(migrated.value);
      if (!parsed.ok) throw new Error(`v${version}: ${JSON.stringify(parsed)}`);
      const save = parsed.value;
      expect([save.game.season, save.game.round, save.career.clubId]).toEqual([
        raw.game.season,
        raw.game.round,
        raw.career.clubId,
      ]);
      // The table is derived from the scores of the calendar (getStandings).
      expect(save.game.fixtures.map((f) => f.result?.score)).toEqual(
        raw.game.fixtures.map((f) => f.result?.score),
      );
      if (version === SAVE_SCHEMA_VERSION) expect(save).toEqual(raw);
      // v1 had no draft sheet, and the step to v2 never builds one (ADR-0021, item 4).
      if (version < 2) expect(save.career.draft).toBeUndefined();
    },
  );

  it('the fixture of the current version passes the three levels (full, open and write)', () => {
    const raw = readJson(`v${SAVE_SCHEMA_VERSION}.json`);
    for (const check of ['full', 'open', 'write'] as const) {
      const parsed = parseCareerSave(raw, { check });
      expect(parsed.ok, check).toBe(true);
      if (parsed.ok) expect(parsed.value, check).toEqual(raw);
    }
  });

  it('a save made now has the frozen shape (else: new schemaVersion, migration and fixture)', () => {
    const frozen = readJson(`shape-v${SAVE_SCHEMA_VERSION}.json`) as Shape;
    expect(
      freshShape,
      'the save format changed: raise SAVE_SCHEMA_VERSION, write the migration and freeze the new fixture (npm run save:fixtures -w app)',
    ).toEqual(frozen);
  });

  it('the fixtures are stored exactly as the generator writes them (compact JSON, 2-space shape)', () => {
    const text = (name: string) => readFileSync(file(name), 'utf8');
    for (const version of versions) {
      const raw = text(`v${version}.json`);
      expect(raw === `${JSON.stringify(JSON.parse(raw))}\n`, `v${version}.json`).toBe(true);
    }
    const shape = text(`shape-v${SAVE_SCHEMA_VERSION}.json`);
    expect(shape).toBe(`${JSON.stringify(JSON.parse(shape), null, 2)}\n`);
  });

  it('the fixture of the current version has the frozen shape too', () => {
    const fixture = readJson(`v${SAVE_SCHEMA_VERSION}.json`);
    expect(formatShape(careerSaveSchema, [fixture])).toEqual(
      readJson(`shape-v${SAVE_SCHEMA_VERSION}.json`),
    );
  });

  // ADR-0012 (name, face, retiredNamesRev), ADR-0019 (lastRound, matchSheets), T-017
  // (pastSeasons) and US-066 (baseSeason) are part of the frozen format.
  it.each([
    'game.players.{}.name.display',
    'game.players.{}.name.full',
    'game.players.{}.name.family',
    'game.players.{}.face',
    'game.retiredNamesRev',
    'game.pastSeasons.[].campaigns.{}.evolved',
    'game.pastSeasons.[].awards.topScorers',
    'career.lastRound?.results.[].events',
    'career.matchSheets.{}.events',
    'career.baseSeason',
    'career.draft?.lineup.starters.[].nullable',
    'career.draft?.lineup.bench.[].nullable',
    'career.draft?.lineup.captains.[]',
    'career.draft?.tactic.posture',
  ])('the shape has %s', (path) => {
    expect(shapePaths(freshShape)).toContain(path);
  });

  it('the v1 fixture has data in each of those fields', () => {
    const v1 = readJson('v1.json') as CareerSave;
    expect(v1.career.baseSeason).toBe(2026);
    expect([v1.game.season, v1.game.year, v1.game.round, v1.game.phase]).toEqual([
      2,
      2027,
      3,
      'season',
    ]);
    expect(v1.game.pastSeasons).toHaveLength(1);
    expect(Object.keys(v1.game.pastSeasons[0]!.campaigns)).toEqual([v1.career.clubId]);
    expect(v1.career.lastRound?.round).toBe(2);
    expect(Object.keys(v1.career.matchSheets)).toHaveLength(20);
    const players = Object.values(v1.game.players);
    expect(players.length).toBeGreaterThanOrEqual(500);
    expect(players.every((p) => p.name.display !== '' && p.face !== '')).toBe(true);
  });

  it('the v2 fixture has a draft sheet with free slots, a list of 2 and its own tactic', () => {
    const v2 = readJson('v2.json') as CareerSave;
    const v1 = readJson('v1.json') as CareerSave;
    // The same career as the v1 fixture: season 2, round 2 played, club 7.
    expect([v2.game.season, v2.game.round, v2.career.clubId]).toEqual([
      v1.game.season,
      v1.game.round,
      v1.career.clubId,
    ]);
    const draft = v2.career.draft!;
    expect(draft.lineup.starters).toHaveLength(11);
    expect(draft.lineup.starters.filter((id) => id === null)).toHaveLength(1);
    expect(draft.lineup.bench.filter((id) => id === null)).toHaveLength(1);
    expect(draft.lineup.captains).toHaveLength(2);
    const squad = new Set(v2.game.squads[v2.career.clubId]);
    for (const id of [...draft.lineup.starters, ...draft.lineup.bench]) {
      if (id !== null) expect(squad.has(id)).toBe(true);
    }
    const suggested = suggestSheet(v2.game, loadGameParams(), v2.career.clubId, undefined, {
      controller: 'human',
    });
    expect(draft.tactic.posture).not.toBe(suggested.tactic.posture);
    expect(draft.tactic.pressure).not.toBe(suggested.tactic.pressure);
  });
});
