import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTokens, pitchColors } from './tokens';

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

describe('pitchColors', () => {
  it('takes every token from the file and asks the browser for none it has', () => {
    const asked: string[] = [];
    const { colors, ink } = pitchColors(
      'dia',
      (name) => (asked.push(name), 'computed'),
      themeToken,
    );
    expect(asked).toEqual([]);
    expect(ink).toBe(themeToken('dia', '--ink'));
    expect(colors.pitch).toBe(themeToken('dia', '--pitch'));
    expect(colors.night).toBe(false);
    expect(pitchColors('noite', () => 'x', themeToken).colors.night).toBe(true);
  });

  it('asks the computed style, per token, for a theme or a token the file lacks', () => {
    const asked: string[] = [];
    const read = (name: string) => (asked.push(name), `computed ${name}`);
    const { colors, ink } = pitchColors('mystery', read, themeToken);
    expect(ink).toBe('computed --ink');
    expect(colors.surface0).toBe('computed --surface-0');
    expect(colors.pitchLine).toBe('computed --pitch-line');
    expect(asked).toHaveLength(9);
    // One token missing from an otherwise known theme: only that one is asked.
    const some = (theme: string, name: string) =>
      name === '--beam' ? undefined : themeToken(theme, name);
    const asked2: string[] = [];
    pitchColors('noite', (name) => (asked2.push(name), '#000000'), some);
    expect(asked2).toEqual(['--beam']);
  });
});
