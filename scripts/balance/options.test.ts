import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_ROBOT_CLUB,
  PARAM_FILES,
  loadParams,
  mergeParams,
  parseArgs,
  repositoryParams,
  serieAClubs,
  USAGE,
} from './options.ts';

/* The command line and the inputs of the /balance (US-013, "parâmetros alternativos"). */

describe('parseArgs', () => {
  it('has the defaults of balance-targets.md: 200 seasons, seed 1, 20,000 duels, the Coritibom', () => {
    const parsed = parseArgs([]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.options).toMatchObject({
      seasons: 200,
      seeds: [1],
      duels: 20_000,
      robot: DEFAULT_ROBOT_CLUB,
      json: false,
      help: false,
    });
    expect(parsed.options.paramsFile).toBeUndefined();
    expect(parsed.options.workers).toBeGreaterThanOrEqual(1);
  });

  it('reads every flag, in both "--flag value" and "--flag=value" forms', () => {
    const parsed = parseArgs([
      '--seasons',
      '3',
      '--seed=7',
      '--duels',
      '0',
      '--params',
      'x.json',
      '--robot=none',
      '--json',
      '--workers',
      '2',
    ]);
    expect(parsed).toEqual({
      ok: true,
      options: {
        seasons: 3,
        seeds: [7],
        duels: 0,
        paramsFile: 'x.json',
        robot: undefined,
        json: true,
        workers: 2,
        help: false,
      },
    });
    const robot = parseArgs(['--robot', 'tufao']);
    expect(robot.ok && robot.options.robot).toBe('tufao');
  });

  it('reads several seeds separated by commas, in the given order', () => {
    const three = parseArgs(['--seed', '1,2,3']);
    expect(three.ok && three.options.seeds).toEqual([1, 2, 3]);
    const inline = parseArgs(['--seed=9,0']);
    expect(inline.ok && inline.options.seeds).toEqual([9, 0]);
    for (const raw of ['1,', ',1', '1,,2', '1;2', '1, 2', '1,2,1', '1,-2']) {
      expect(parseArgs(['--seed', raw]).ok, raw).toBe(false);
    }
    const repeated = parseArgs(['--seed', '1,2,1']);
    expect(!repeated.ok && repeated.error).toContain('repetida');
  });

  it('documents the four exit codes in the help', () => {
    expect(USAGE).toMatch(/^ {2}0 {2}todas as metas obrigatórias dentro/m);
    expect(USAGE).toMatch(/^ {2}1 {2}alguma meta obrigatória fora/m);
    expect(USAGE).toMatch(/^ {2}2 {2}erro de uso/m);
    expect(USAGE).toMatch(/^ {2}3 {2}falha da ferramenta/m);
  });

  it('refuses unknown flags, missing values and numbers that are not whole', () => {
    for (const argv of [
      ['--season', '3'],
      ['--seasons'],
      ['--seasons', '-1'],
      ['--seasons', '1.5'],
      ['--seed', 'abc'],
      ['--workers', '0'],
      ['--params'],
      ['--robot', ''],
    ]) {
      const parsed = parseArgs(argv);
      expect(parsed.ok, argv.join(' ')).toBe(false);
    }
  });
});

describe('mergeParams', () => {
  it('puts the patch on top, key by key, and lists what it changed', () => {
    const changed: string[] = [];
    const merged = mergeParams(
      { match: { a: 1, cards: { y: 2, r: 3 } }, season: { weeks: [1, 2] } },
      { match: { cards: { y: 5 } }, season: { weeks: [3] } },
      changed,
    );
    expect(merged).toEqual({ match: { a: 1, cards: { y: 5, r: 3 } }, season: { weeks: [3] } });
    expect(changed.sort()).toEqual(['match.cards.y', 'season.weeks']);
  });

  it('never merges a "__proto__" key: it lists it as ignored and keeps the prototype', () => {
    const changed: string[] = [];
    const ignored: string[] = [];
    const patch = JSON.parse('{"__proto__": {"x": 1}, "match": {"__proto__": {"y": 2}, "a": 4}}');
    const merged = mergeParams({ match: { a: 1 } }, patch, changed, '', ignored) as Record<
      string,
      Record<string, unknown>
    >;
    expect(merged).toEqual({ match: { a: 4 } });
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(merged.match)).toBe(Object.prototype);
    expect(ignored).toEqual(['__proto__', 'match.__proto__']);
    expect(changed).toEqual(['match.a']);
  });
});

describe('loadParams', () => {
  const dir = mkdtempSync(join(tmpdir(), 'balance-params-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const repoFiles = () =>
    PARAM_FILES.map((name) =>
      readFileSync(new URL(`../../app/src/params/${name}.json`, import.meta.url), 'utf8'),
    );

  it('without a file, gives the validated parameters of app/src/params/', () => {
    const loaded = loadParams();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.params).toEqual(repositoryParams());
    expect(loaded.overrides).toEqual([]);
  });

  it('with a file, uses its values on top and never writes to app/src/params/', () => {
    const before = repoFiles();
    const file = join(dir, 'lead.json');
    writeFileSync(file, JSON.stringify({ match: { comfortableLeadPower: 0.85 } }));
    const loaded = loadParams(file);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.params.match.comfortableLeadPower).toBe(0.85);
    const repoMatch = repositoryParams()['match'] as { baseChance: number };
    expect(loaded.params.match.baseChance).toBe(repoMatch.baseChance);
    expect(loaded.overrides).toEqual(['match.comfortableLeadPower']);
    expect(loaded.warnings).toEqual([]);
    expect(repoFiles()).toEqual(before);
  });

  it('warns about a "__proto__" key of the file and loads the rest', () => {
    const file = join(dir, 'proto.json');
    writeFileSync(file, '{"__proto__": {"x": 1}, "match": {"cards": {"bookedMult": 0.2}}}');
    const loaded = loadParams(file);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.params.match.cards.bookedMult).toBe(0.2);
    expect(loaded.overrides).toEqual(['match.cards.bookedMult']);
    expect(loaded.warnings).toHaveLength(1);
    expect(loaded.warnings[0]).toContain('"__proto__"');
  });

  it('refuses a value out of range, an unknown key and a file that is not JSON', () => {
    const out = join(dir, 'out.json');
    writeFileSync(out, JSON.stringify({ match: { comfortableLeadPower: 0.5, typo: 1 } }));
    const refused = loadParams(out);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.issues?.map((i) => [i.path, i.problem])).toEqual([
        ['match.comfortableLeadPower', 'out-of-range'],
        ['match.typo', 'unknown-key'],
      ]);
    }
    const broken = join(dir, 'broken.json');
    writeFileSync(broken, '{ match: ');
    expect(loadParams(broken).ok).toBe(false);
    expect(loadParams(join(dir, 'missing.json')).ok).toBe(false);
    writeFileSync(broken, '[1, 2]');
    expect(loadParams(broken).ok).toBe(false);
  });
});

describe('serieAClubs', () => {
  it('reads the 20 clubs, the Coritibom among them', () => {
    const clubs = serieAClubs();
    expect(clubs).toHaveLength(20);
    expect(clubs.some((c) => c.id === DEFAULT_ROBOT_CLUB)).toBe(true);
  });
});
