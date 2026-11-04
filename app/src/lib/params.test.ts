import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PARAM_RANGES, validateParams } from '../engine/index.ts';
import { formatParamIssues, loadGameParams, rawParams } from './params.ts';

/*
 * The JSON files of the repository must always be valid (docs/02-architecture.md, 3): a /quick
 * that puts a value out of range breaks CI here.
 */
describe('app/src/params', () => {
  it('contains exactly the six system files', () => {
    const dir = new URL('../params/', import.meta.url);
    const files = readdirSync(dir).filter((f) => !f.startsWith('.'));
    expect(files.sort()).toEqual([
      'ai.json',
      'fans.json',
      'generation.json',
      'match.json',
      'players.json',
      'season.json',
    ]);
    expect(Object.keys(rawParams).sort()).toEqual(
      files.map((f) => f.replace(/\.json$/, '')).sort(),
    );
  });

  it('are valid', () => {
    const result = validateParams(rawParams);
    if (!result.ok) throw new Error(formatParamIssues(result.detail));
    expect(result.warnings).toEqual([]);
  });

  it('use the fixed home advantage of ADR-0011, option A', () => {
    expect(loadGameParams().match.homeBase).toBe(0.05);
  });

  it('load once and return the validated copy', () => {
    const params = loadGameParams();
    expect(loadGameParams()).toBe(params);
    expect(params).toEqual(rawParams);
    expect(params.match).not.toBe(rawParams.match);
  });
  it('are frozen all the way down, so a change fails and leaves the values intact', () => {
    const params = loadGameParams();
    expect(Object.isFrozen(params)).toBe(true);
    expect(Object.isFrozen(params.match.fatigue)).toBe(true);
    expect(Object.isFrozen(params.season.fifaWeeks)).toBe(true);
    // ES modules run in strict mode: writing to a frozen object throws.
    expect(() => {
      (params.match as { homeBase: number }).homeBase = 0.08;
    }).toThrow(TypeError);
    expect(() => {
      (params.match.fatigue as { drainPerMinute: number }).drainPerMinute = 0.6;
    }).toThrow(TypeError);
    expect(() => (params.season.fifaWeeks as number[]).push(33)).toThrow(TypeError);
    expect(loadGameParams().match.homeBase).toBe(0.05);
    expect(loadGameParams().match.fatigue.drainPerMinute).toBe(0.3);
    expect(loadGameParams().season.fifaWeeks).toEqual([9, 21, 25, 30]);
    expect(Object.isFrozen(rawParams.match)).toBe(false);
  });
});

describe('formatParamIssues', () => {
  it('names path, problem, value and range', () => {
    expect(
      formatParamIssues([
        {
          path: 'match.homeBase',
          problem: 'out-of-range',
          value: 0.1,
          range: { min: 0, max: 0.08 },
        },
        { path: '', problem: 'not-an-object', value: null },
      ]),
    ).toBe(
      'match.homeBase: out-of-range, got 0.1 (range 0..0.08)\n(root): not-an-object, got null',
    );
  });
});

/*
 * QA (T-002): the JSON files and the ranges must equal the tables of docs/design/*.md, value by
 * value. The tables are parsed straight from the documents, so a drift in either side fails here.
 */
describe('app/src/params against docs/design', () => {
  const docs = ['partida', 'jogadores', 'ia-clubes', 'temporada', 'torcida'];
  const pt = (s: string) => Number(s.replace(',', '.'));
  const rows: { name: string; value: string; range: string }[] = [];
  for (const doc of docs) {
    const text = readFileSync(new URL(`../../../docs/design/${doc}.md`, import.meta.url), 'utf8');
    for (const line of text.split('\n')) {
      const cells = line.split('|').map((c) => c.trim());
      const m =
        /^`((?:match|players|generation|ai|season|fans|fatigue|injury|cards)\.[\w.]+)`$/.exec(
          cells[1] ?? '',
        );
      if (m) rows.push({ name: m[1]!, value: cells[2]!, range: cells[3]! });
    }
  }
  const lookup = (root: unknown, path: string): unknown =>
    path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], root);
  const fullPath = (name: string) =>
    /^(fatigue|injury|cards)\./.test(name) ? `match.${name}` : name;

  it('finds every parameter of the six files in the documents', () => {
    const leaves: string[] = [];
    const walk = (o: unknown, p: string) => {
      if (typeof o === 'object' && o !== null && !Array.isArray(o)) {
        for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k);
      } else leaves.push(p);
    };
    walk(rawParams, '');
    expect(rows.map((r) => fullPath(r.name)).sort()).toEqual(leaves.sort());
  });

  it.each(rows)('$name = $value, range $range', ({ name, value, range }) => {
    const path = fullPath(name);
    const actual = lookup(rawParams, path);
    const spec = lookup(PARAM_RANGES, path) as { kind: string; min: number; max: number };
    if (value.startsWith('[')) {
      expect(actual).toEqual(JSON.parse(value));
      expect(spec).toMatchObject({ kind: 'intList', min: 1, max: 34 });
      return;
    }
    expect(actual).toBe(pt(/^[\d,]+/.exec(value)![0]));
    if (range.startsWith('fixo')) {
      expect(spec.min).toBe(spec.max);
      expect(spec.min).toBe(actual);
    } else {
      const [min, max] = range.split('–').map(pt);
      expect([spec.min, spec.max]).toEqual([min, max]);
    }
  });
});
