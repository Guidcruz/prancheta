import { describe, expect, it } from 'vitest';
import { shieldSpecFor, shieldSvg } from './shield';

describe('shield generator', () => {
  it('is stable for the same club id (golden)', () => {
    expect(shieldSpecFor('flamingo', '#b3001b', '#111111')).toMatchInlineSnapshot(`
      {
        "color1": "#b3001b",
        "color2": "#111111",
        "letter": "FLA",
        "shape": "diagonal",
        "symbol": "star",
      }
    `);
  });

  it('uses the club abbreviation as the letter and keeps the rest of the spec', () => {
    const byId = shieldSpecFor('flamingo', '#b3001b', '#111111');
    expect(shieldSpecFor('flamingo', '#b3001b', '#111111', 'FLG')).toEqual({
      ...byId,
      letter: 'FLG',
    });
  });

  it('escapes text and rejects unsafe colors', () => {
    const svg = shieldSvg({
      shape: 'classic',
      color1: 'url(javascript:x)',
      color2: '#fff"',
      symbol: 'letter',
      letter: '<b>',
    });
    expect(svg).not.toContain('url(');
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&lt;b&gt;');
  });
});
