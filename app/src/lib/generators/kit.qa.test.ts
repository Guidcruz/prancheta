import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ClubDef } from '../../engine/index.ts';
import { KIT_MIN_DISTANCE, colorDistance, kitSvg, kitsFor, matchKits, thirdKit } from './kit';
import { shieldSpecFor, shieldSvg } from './shield';

const clubs = JSON.parse(
  readFileSync(new URL('../../data/clubs.serie-a.json', import.meta.url), 'utf8'),
) as ClubDef[];

const hash = (text: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

describe('kit QA: US-002 acceptance on the real clubs', () => {
  it('generates identical SVG twice for every club and every slot', () => {
    for (const c of clubs) {
      const a = kitsFor(c);
      const b = kitsFor({ ...c });
      expect(kitSvg(a.home, 64, { label: 'x' })).toBe(kitSvg(b.home, 64, { label: 'x' }));
      expect(kitSvg(a.away)).toBe(kitSvg(b.away));
      expect(kitSvg(thirdKit(a.home))).toBe(kitSvg(thirdKit(b.home)));
    }
  });

  it('gives the visitor kit 2 or 3 on a conflict, and both dominant colours pass the distance rule', () => {
    let changed = 0;
    for (const h of clubs) {
      for (const v of clubs) {
        if (h === v) continue;
        const m = matchKits(h, v);
        if (m.awaySlot !== 'home') changed++;
        expect(m.kits.home.slot, `${h.id}`).toBe('home');
        expect(colorDistance(m.home.fill, m.away.fill), `${h.id}x${v.id}`).toBeGreaterThanOrEqual(
          KIT_MIN_DISTANCE,
        );
      }
    }
    expect(changed).toBeGreaterThan(0);
  });

  it('has no script, external link or event attribute in any generated SVG, at several sizes', () => {
    const bad =
      /<script|<foreignObject|<image|href|xlink|javascript:|\son\w+\s*=|url\(\s*['"]?http|@import/i;
    for (const c of clubs) {
      const { home, away } = kitsFor(c);
      for (const k of [home, away, thirdKit(home)])
        for (const size of [16, 32, 64, 512]) {
          expect(kitSvg(k, size, { label: c.name }), c.id).not.toMatch(bad);
          // hostile label: stays inside the quoted attribute, so no element or event attribute
          const svg = kitSvg(k, size, { label: `"><script>x</script><b onload="y">${c.name}` });
          expect(svg, c.id).not.toContain('<script');
          expect(svg, c.id).not.toContain('<b');
          expect(svg.replace(/"[^"]*"/g, '""'), c.id).not.toMatch(/\son\w+\s*=/i);
        }
    }
  });
});

describe('kit QA: ratified rules (CEO 2026-11-15)', () => {
  it('never gives a plain shirt to a club whose crest has no pattern (Cruzador)', () => {
    const none = clubs.filter((c) => c.crestPattern === 'none');
    expect(none.map((c) => c.id)).toContain('cruzador');
    for (const c of none) {
      const { home, away } = kitsFor(c);
      expect(home.pattern, c.id).not.toBe('plain');
      expect(away.pattern, c.id).not.toBe('plain');
    }
  });

  it('never pairs two diagonal sashes in the two kits of any club, real or synthetic', () => {
    const sash = new Set(['sash', 'sashMirror']);
    for (let i = 0; i < 3000; i++) {
      const { home, away } = kitsFor({
        id: `qa-${i}`,
        colors: ['#0033a0', '#ffffff'],
        crestPattern: 'none',
      });
      expect(sash.has(home.pattern) && sash.has(away.pattern), `qa-${i}`).toBe(false);
    }
  });
});

describe('kit QA: the shield did not change when shield.ts exported onColor and constants', () => {
  it('matches the hashes recorded from origin/main (20 clubs x 4 sizes x label on/off)', () => {
    const lines = readFileSync(new URL('./__fixtures__/shield.qa.snap', import.meta.url), 'utf8')
      .trim()
      .split('\n');
    expect(lines).toHaveLength(clubs.length * 8);
    const now: string[] = [];
    for (const c of clubs)
      for (const size of [24, 32, 64, 128])
        for (const label of [false, true])
          now.push(
            `${c.id} ${size} ${label ? 'label' : 'nolabel'} ${hash(shieldSvg(shieldSpecFor(c, { label }), size))}`,
          );
    expect(now).toEqual(lines);
  });
});
