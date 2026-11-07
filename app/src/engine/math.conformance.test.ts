import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from './version.ts';

/*
 * ADR-0020, "Conformidade": the body of exp in math.ts uses only + - * /, comparisons,
 * Math.trunc/Math.floor and Math.E, and keeps the fdlibm notice. Read as text, comments removed.
 */
const source = readFileSync(new URL('./math.ts', import.meta.url), 'utf8');
const start = source.indexOf('export function exp(');
const end = source.indexOf('\nexport function normal(');
const body = source
  .slice(start, end)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

describe('exp: conformance with ADR-0020', () => {
  it('finds the function body', () => {
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
  });

  it('does not read bits: no Float64Array, DataView, BigInt, Uint32Array or ArrayBuffer', () => {
    expect(body).not.toMatch(
      /Float64Array|Float32Array|DataView|BigInt|Uint32Array|ArrayBuffer|\d+n\b/,
    );
  });

  it('uses from Math only trunc, floor and E', () => {
    const used = [...body.matchAll(/Math\s*\.\s*(\w+)/g)].map((m) => m[1]);
    for (const name of used) expect(['trunc', 'floor', 'E']).toContain(name);
    expect(body).not.toMatch(/Math\s*\[/);
    expect(body).not.toMatch(/\*\*/);
  });

  it('keeps the Sun notice on top of the function, as a legal comment', () => {
    const header = source.slice(0, start);
    expect(header).toContain('Sun Microsystems');
    expect(header).toContain('Permission to use, copy, modify, and distribute this');
    expect(header).toMatch(/\/\*!\s*@license/);
  });

  it('is on an engine version that promises engine-independent bits (>= 16)', () => {
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(16);
  });
});
