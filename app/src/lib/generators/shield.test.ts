import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CREST_PATTERNS, CREST_SHAPES, CREST_SYMBOLS, type ClubDef } from '../../engine/clubs.ts';
import {
  contrastRatio,
  medallionColors,
  shieldSpecFor,
  shieldSvg,
  starGlyphs,
  starItems,
  type ShieldSpec,
} from './shield';

const clubs = JSON.parse(
  readFileSync(new URL('../../data/clubs.serie-a.json', import.meta.url), 'utf8'),
) as ClubDef[];
const specOf = (c: ClubDef) => shieldSpecFor(c);

const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;
/** Stars drawn: polygons of 10 points. */
const starsIn = (svg: string) => count(svg, /<polygon /g);
const idsOf = (svg: string) => [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]!);

const BASE: ShieldSpec = {
  id: 'teste',
  colors: ['#c8102e', '#111417'],
  size: 'big',
  titles: { league: 0 },
  shape: 'french',
  pattern: 'fess',
  base: 0,
  symbol: 'sol',
};

describe('shield generator', () => {
  it('is deterministic: same club, same bytes, at both sizes', () => {
    for (const club of clubs) {
      expect(shieldSvg(specOf(club), 96)).toBe(shieldSvg(specOf(club), 96));
      expect(shieldSvg(specOf(club), 24)).toBe(shieldSvg(specOf(club), 24));
    }
  });

  it('draws the 20 clubs without error, in valid SVG, from data and not by lot', () => {
    expect(clubs).toHaveLength(20);
    for (const club of clubs) {
      for (const size of [96, 32]) {
        const svg = shieldSvg(specOf(club), size);
        expect(svg, club.id).toMatch(/^<svg .*<\/svg>$/s);
        expect(svg).not.toMatch(/NaN|undefined|var\(/);
      }
    }
    expect(new Set(clubs.map((c) => c.crestSymbol)).size).toBe(20);
    expect(new Set(CREST_SYMBOLS).size).toBe(20);
    for (const c of clubs) {
      expect(CREST_SHAPES).toContain(c.crestShape);
      expect(CREST_PATTERNS).toContain(c.crestPattern);
    }
  });

  it('draws all 6 shapes, all patterns and all 20 symbols', () => {
    const shapes = new Set(CREST_SHAPES.map((shape) => shieldSvg({ ...BASE, shape }, 96)));
    expect(shapes.size).toBe(6);
    const patterns = new Set(CREST_PATTERNS.map((pattern) => shieldSvg({ ...BASE, pattern }, 96)));
    expect(patterns.size).toBe(CREST_PATTERNS.length);
    const symbols = new Set(CREST_SYMBOLS.map((symbol) => shieldSvg({ ...BASE, symbol }, 96)));
    expect(symbols.size).toBe(20);
  });

  it('never uses var(--ink) or any CSS variable', () => {
    for (const club of clubs) expect(shieldSvg(specOf(club), 96)).not.toContain('var(');
  });

  it('keeps the symbol at 3:1 or more over the medallion, for every club and odd colours', () => {
    const palettes: [string, string][] = [
      ...clubs.map((c) => [c.colors[0], c.colors[1]] as [string, string]),
      ['#777777', '#7a7a7a'],
      ['#ffffff', '#fefefe'],
      ['#000000', '#010101'],
      ['#808080', '#818181'],
    ];
    for (const colors of palettes) {
      const { fill, symbol } = medallionColors(colors);
      expect(contrastRatio(symbol, fill), colors.join()).toBeGreaterThanOrEqual(3);
    }
    // The symbol colour really is the one in the drawing.
    const svg = shieldSvg({ ...BASE, colors: ['#ffffff', '#fefefe'], symbol: 'sino' }, 96);
    expect(svg).toContain('fill="#111417"');
  });

  it('switches to the small version at 32 px or less', () => {
    const club = clubs.find((c) => c.id === 'atletico-minerio')!; // vstripes, 8 titles
    const big = shieldSvg(specOf(club), 33);
    const small = shieldSvg(specOf(club), 32);
    expect(big).toContain('linearGradient');
    expect(big).toContain('opacity=".3"');
    for (const part of ['linearGradient', 'opacity', 'url(#sh-atletico-minerio-s-gd)']) {
      expect(small, part).not.toContain(part);
    }
    // vstripes (fine) becomes split; hoops and pales disappear; coarse ones stay.
    expect(small).toContain('M32-4H70V80H32Z');
    expect(shieldSvg({ ...BASE, pattern: 'hoops' }, 20)).not.toContain('<rect x="-2" y="18"');
    expect(shieldSvg({ ...BASE, pattern: 'fess' }, 20)).toContain('<rect x="-2" y="44"');
    expect(small.length).toBeLessThan(big.length / 1.5);
  });

  it('counts the stars: 1 small each title, 1 big per 5, capped at 3 big + 4 small', () => {
    const cases: [number, number, number][] = [
      [0, 0, 0],
      [1, 0, 1],
      [4, 0, 4],
      [5, 1, 0],
      [7, 1, 2],
      [12, 2, 2],
      [19, 3, 4],
      [25, 3, 4],
    ];
    for (const [titles, big, small] of cases) {
      expect(starGlyphs(titles), String(titles)).toEqual({ big, small });
      expect(starsIn(shieldSvg({ ...BASE, titles: { league: titles } }, 96))).toBe(big + small);
    }
    expect(starGlyphs(-3)).toEqual({ big: 0, small: 0 });
    expect(starGlyphs(Number.NaN)).toEqual({ big: 0, small: 0 });
  });

  it('draws gold for Série A, silver for Série B, gold first; at most 3 stars when small', () => {
    const titles = { league: 1, leagueB: 6 };
    const items = starItems(titles, false);
    expect(items.map((i) => (i.silver ? 'B' : 'A'))).toEqual(['A', 'B', 'B']);
    const big = shieldSvg({ ...BASE, titles }, 96);
    expect(big).toContain('-gd)');
    expect(big).toContain('-sv)');
    expect(starsIn(big)).toBe(3);
    const small = shieldSvg({ ...BASE, titles: { league: 19, leagueB: 19 } }, 32);
    expect(starsIn(small)).toBe(3);
    expect(starsIn(shieldSvg({ ...BASE, titles: { league: 19 } }, 96))).toBe(7);
  });

  it('escapes the label and rejects unsafe colours', () => {
    const svg = shieldSvg(
      { ...BASE, label: '<b>"x"&', colors: ['url(javascript:x)', '#fff"'] },
      96,
    );
    expect(svg).not.toContain('url(javascript');
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('aria-label="&lt;b&gt;&quot;x&quot;&amp;"');
    expect(svg).toContain('#777777');
    // Without a label the shield is decorative.
    expect(shieldSvg(BASE, 96)).toContain('aria-hidden="true"');
    // An id with odd characters cannot break out of an attribute.
    expect(
      idsOf(shieldSvg({ ...BASE, id: 'a"><script>' }, 96)).every((i) => /^[\w-]+$/.test(i)),
    ).toBe(true);
  });

  it('survives unknown shape, pattern and symbol keys', () => {
    const svg = shieldSvg(
      {
        ...BASE,
        shape: 'constructor' as never,
        pattern: 'x' as never,
        symbol: 'toString' as never,
      },
      96,
    );
    expect(svg).toMatch(/^<svg .*<\/svg>$/s);
  });

  it('has unique ids inside one shield and across all 20 clubs on one page', () => {
    const all: string[] = [];
    for (const club of clubs) {
      for (const size of [96, 24]) {
        const ids = idsOf(shieldSvg(specOf(club), size));
        expect(new Set(ids).size, club.id).toBe(ids.length);
        all.push(...ids);
      }
    }
    expect(new Set(all).size).toBe(all.length);
    // The same club twice gets distinct ids with an instance.
    const a = idsOf(shieldSvg(specOf(clubs[0]!), 96, { instance: 'a' }));
    const b = idsOf(shieldSvg(specOf(clubs[0]!), 96, { instance: 'b' }));
    expect(a.filter((i) => b.includes(i))).toEqual([]);
    // Every url(#id) points at an id that exists.
    const svg = shieldSvg(specOf(clubs[0]!), 96);
    for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) expect(idsOf(svg)).toContain(ref);
  });

  it('keeps the average size light', () => {
    const avg = (size: number) =>
      clubs.reduce((t, c) => t + shieldSvg(specOf(c), size).length, 0) / clubs.length;
    expect(avg(96)).toBeLessThan(4500);
    expect(avg(32)).toBeLessThan(2500);
  });

  it('uses the metal of the club size on the border', () => {
    const gold = shieldSvg({ ...BASE, size: 'big' }, 96);
    const silver = shieldSvg({ ...BASE, size: 'medium' }, 96);
    const bronze = shieldSvg({ ...BASE, size: 'small' }, 96);
    expect(gold).toContain('#c59a3a');
    expect(silver).toContain('#a9b6c2');
    expect(bronze).toContain('#b9783f');
  });

  it('takes the leagueB titles from the club only when present', () => {
    const club = clubs[0]!;
    expect(specOf(club).titles).toEqual({ league: club.titles.league });
    const withB = shieldSpecFor({ ...club, titles: { league: 1, leagueB: 2 } });
    expect(withB.titles).toEqual({ league: 1, leagueB: 2 });
    expect(shieldSpecFor(club, { label: true }).label).toBe(club.shortName);
  });
});
