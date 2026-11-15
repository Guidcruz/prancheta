import { describe, expect, it } from 'vitest';
import { MATCH_MODES } from '../../engine/index.ts';
import { engineMatchMode } from './match-mode.ts';

/* Until T-033, the assistant commands the coach's club in every mode (CEO decision 2, T-032). */
describe('engineMatchMode', () => {
  it.each(MATCH_MODES)("%s goes to the engine as 'result'", (mode) => {
    expect(engineMatchMode(mode)).toBe('result');
  });
});
