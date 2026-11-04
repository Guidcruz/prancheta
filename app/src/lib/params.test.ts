import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateParams } from '../engine/index.ts';
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
