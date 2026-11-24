import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import pitchTokens from './pitch-tokens.generated.json';
import { pitchColors, themeToken } from './tokens';

/** The themes of a `tokens.css` text, token by token. */
function parseTokens(css: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const block of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const names = [...block[1]!.matchAll(/\[data-theme="(\w+)"\]/g)].map((m) => m[1]!);
    if (names.length === 0) continue;
    const values: Record<string, string> = {};
    for (const decl of block[2]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      values[decl[1]!] = decl[2]!.trim();
    }
    for (const name of names) out[name] = { ...out[name], ...values };
  }
  return out;
}

const css = parseTokens(readFileSync(new URL('../../../tokens.css', import.meta.url), 'utf8'));
const NEEDED = [
  '--ink',
  '--surface-0',
  '--surface-1',
  '--surface-2',
  '--line',
  '--floodlight',
  '--beam',
  '--pitch',
  '--pitch-line',
];

describe('pitch-tokens.generated.json', () => {
  it('has the same values as the generated tokens.css, in both themes', () => {
    expect(Object.keys(pitchTokens).sort()).toEqual(['dia', 'noite']);
    for (const [theme, tokens] of Object.entries(pitchTokens)) {
      for (const [name, value] of Object.entries(tokens)) {
        expect(css[theme]?.[name], `${theme} ${name}`).toBe(value);
      }
    }
  });

  it('has every token the pitch draws with, in both themes', () => {
    for (const theme of ['noite', 'dia']) {
      for (const name of NEEDED) expect(themeToken(theme, name), `${theme} ${name}`).toBeTruthy();
    }
    expect(themeToken('noite', '--surface-0')).toBe('#0f1a24');
    expect(themeToken('dia', '--surface-0')).toBe('#f3f5f7');
    expect(themeToken('noite', '--nope')).toBeUndefined();
    expect(themeToken('other', '--pitch')).toBeUndefined();
  });
});

describe('pitchColors', () => {
  it('takes every token from the file and asks the browser for none it has', () => {
    const asked: string[] = [];
    const { colors, ink } = pitchColors('dia', (name) => (asked.push(name), 'computed'));
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
