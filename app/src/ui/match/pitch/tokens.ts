import type { BackdropColors } from './backdrop';
import pitchTokens from './pitch-tokens.generated.json';

/*
 * The tokens the pitch draws with, for a theme, read from `pitch-tokens.generated.json` (written
 * with `tokens.css` by `npm run tokens`, same values) instead of `getComputedStyle`: after a theme
 * change the style of the whole page is stale, and asking the browser for a computed value forces
 * that recalculation inside the redraw's task (about 20 ms at CPU 4×, partida-campo-v2.md, 12).
 * `undefined` for a theme or a token the file does not have, and the caller asks the browser.
 */

const themes: Record<string, Record<string, string>> = pitchTokens;

/** The value of `--name` in `theme`, or `undefined`. */
export function themeToken(theme: string, name: string): string | undefined {
  return themes[theme]?.[name];
}

/** The colours the pitch draws with in `theme`, and the `ink` of the discs and the ball. */
export function pitchColors(
  theme: string,
  /** Asked for a token the file does not have (the caller reads the computed style). */
  fallback: (name: string) => string,
  lookup: (theme: string, name: string) => string | undefined = themeToken,
): { colors: BackdropColors; ink: string } {
  const token = (name: string) => lookup(theme, name) ?? fallback(name);
  return {
    ink: token('--ink'),
    colors: {
      surface0: token('--surface-0'),
      surface1: token('--surface-1'),
      surface2: token('--surface-2'),
      line: token('--line'),
      floodlight: token('--floodlight'),
      beam: token('--beam'),
      pitch: token('--pitch'),
      pitchLine: token('--pitch-line'),
      night: theme !== 'dia',
    },
  };
}
