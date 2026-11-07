import { describe, expect, it } from 'vitest';
import { levelOf } from './levels';

describe('levelOf', () => {
  it('puts each limit in the band above it', () => {
    expect(levelOf('condition', 85)).toBe('good');
    expect(levelOf('condition', 84)).toBe('fair');
    expect(levelOf('condition', 75)).toBe('fair');
    expect(levelOf('condition', 74)).toBe('poor');
    expect(levelOf('morale', 60)).toBe('good');
    expect(levelOf('morale', 59)).toBe('fair');
    expect(levelOf('morale', 40)).toBe('fair');
    expect(levelOf('morale', 39)).toBe('poor');
    expect(levelOf('form', 7)).toBe('good');
    expect(levelOf('form', 6.9)).toBe('fair');
    expect(levelOf('form', 5.5)).toBe('fair');
    expect(levelOf('form', 5.4)).toBe('poor');
  });

  it('covers the ends of every scale', () => {
    expect(levelOf('condition', 0)).toBe('poor');
    expect(levelOf('condition', 100)).toBe('good');
    expect(levelOf('form', 3)).toBe('poor');
    expect(levelOf('form', 10)).toBe('good');
  });

  it('has no band without a number (form "—")', () => {
    expect(levelOf('form', undefined)).toBeUndefined();
    expect(levelOf('morale', Number.NaN)).toBeUndefined();
  });
});
