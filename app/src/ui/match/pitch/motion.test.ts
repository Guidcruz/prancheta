import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PITCH_STAND_END } from './motion';

describe('PITCH_STAND_END', () => {
  it('is the 33% the match screen paints around the canvas before the pitch loads', () => {
    expect(PITCH_STAND_END).toBe('33.00%');
    const screen = readFileSync(
      new URL('../../screens/MatchScreen.svelte', import.meta.url),
      'utf8',
    );
    expect(screen).toContain('var(--surface-2) 33%');
  });
});
