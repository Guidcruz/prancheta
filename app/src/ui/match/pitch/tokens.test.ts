import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTokens } from './tokens';

const themes = parseTokens(readFileSync(new URL('../../../tokens.css', import.meta.url), 'utf8'));
const themeToken = (theme: string, name: string) => themes[theme]?.[name];

describe('parseTokens', () => {
  it('reads the colours of each theme from tokens.css', () => {
    expect(themeToken('noite', '--surface-0')).toBe('#0f1a24');
    expect(themeToken('dia', '--surface-0')).toBe('#f3f5f7');
    expect(themeToken('noite', '--nope')).toBeUndefined();
    expect(themeToken('other', '--pitch')).toBeUndefined();
  });

  it('has every token the pitch draws with, in both themes', () => {
    for (const theme of ['noite', 'dia']) {
      for (const name of [
        '--ink',
        '--surface-0',
        '--surface-1',
        '--surface-2',
        '--line',
        '--floodlight',
        '--beam',
        '--pitch',
        '--pitch-line',
      ]) {
        expect(themeToken(theme, name), `${theme} ${name}`).toBeTruthy();
      }
    }
  });
});
