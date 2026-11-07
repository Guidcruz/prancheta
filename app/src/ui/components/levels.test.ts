import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_MARGIN, attributeLevelOf, levelOf } from './levels';

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

describe('attributeLevelOf', () => {
  it('marks a strong point from overall + ATTRIBUTE_MARGIN up', () => {
    expect(ATTRIBUTE_MARGIN).toBe(5);
    expect(attributeLevelOf(75, 70)).toBe('good');
    expect(attributeLevelOf(99, 70)).toBe('good');
    expect(attributeLevelOf(74, 70)).toBeUndefined();
  });

  it('marks a weak point from overall - ATTRIBUTE_MARGIN down', () => {
    expect(attributeLevelOf(65, 70)).toBe('poor');
    expect(attributeLevelOf(1, 70)).toBe('poor');
    expect(attributeLevelOf(66, 70)).toBeUndefined();
  });

  it('leaves the attributes near the overall without colour', () => {
    expect(attributeLevelOf(70, 70)).toBeUndefined();
  });

  it('is relative to the player, not a fixed scale', () => {
    expect(attributeLevelOf(70, 62)).toBe('good');
    expect(attributeLevelOf(70, 80)).toBe('poor');
  });

  it('has no colour without a number', () => {
    expect(attributeLevelOf(Number.NaN, 70)).toBeUndefined();
    expect(attributeLevelOf(70, Number.NaN)).toBeUndefined();
  });

  it('never answers "fair": only a strong point, a weak one or nothing', () => {
    for (let overall = 1; overall <= 99; overall++)
      for (let value = 1; value <= 99; value++)
        expect(['good', 'poor', undefined]).toContain(attributeLevelOf(value, overall));
  });
});
