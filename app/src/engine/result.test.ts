import { describe, expect, it } from 'vitest';
import { fail, ok } from './result.ts';
import type { Result } from './types.ts';

describe('Result helpers', () => {
  it('ok() wraps the value with an empty warning list by default', () => {
    expect(ok(3)).toEqual({ ok: true, value: 3, warnings: [] });
    const warnings = [{ code: 'lineup-replaced', detail: { player: 'clube-teste-01#4' } }];
    expect(ok('x', warnings)).toEqual({ ok: true, value: 'x', warnings });
  });

  it('fail() carries the typed error and only includes detail when given', () => {
    expect(fail('season-over')).toEqual({ ok: false, error: 'season-over' });
    expect('detail' in fail('season-over')).toBe(false);
    expect(fail('invalid-clubs', { count: 19 })).toEqual({
      ok: false,
      error: 'invalid-clubs',
      detail: { count: 19 },
    });
  });

  it('narrows on ok', () => {
    const r: Result<number, 'round-not-open'> = Math.abs(-1) > 0 ? ok(1) : fail('round-not-open');
    expect(r.ok ? r.value + 1 : r.error).toBe(2);
  });
});
