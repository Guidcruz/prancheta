import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ClubDef } from '../../engine/clubs.ts';
import { shieldSpecFor, shieldSvg, starGlyphs } from './shield';

const clubs = JSON.parse(
  readFileSync(new URL('../../data/clubs.serie-a.json', import.meta.url), 'utf8'),
) as ClubDef[];

/** Minimal well-formedness check: balanced, properly nested tags. */
function wellFormed(svg: string): boolean {
  const stack: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g)) {
    const [, close, name, , self] = m;
    if (self) continue;
    if (close) {
      if (stack.pop() !== name) return false;
    } else stack.push(name!);
  }
  return stack.length === 0;
}

describe('shield QA: 20 Serie A clubs x 3 sizes', () => {
  for (const size of [24, 64, 128]) {
    it(`valid SVG, symbol clipped inside the medallion, stars follow the rule at ${size}px`, () => {
      for (const club of clubs) {
        const svg = shieldSvg(shieldSpecFor(club), size);
        expect(svg, club.id).toMatch(/^<svg [^>]*viewBox="0 0 64 72"/);
        expect(wellFormed(svg), `${club.id} well-formed`).toBe(true);
        expect(svg).not.toMatch(/NaN|undefined|Infinity/);
        // the symbol group is always wrapped by the medallion clip-path (cannot leak out)
        expect(svg, club.id).toMatch(
          /<clipPath id="[^"]+-c"><circle[^>]*\/><\/clipPath><g clip-path="url\(#[^"]+-c\)">/,
        );
        const titles = club.titles?.league ?? 0;
        const { big, small } = starGlyphs(titles);
        const cap = size <= 32 ? 3 : 7;
        expect((svg.match(/<polygon /g) ?? []).length, `${club.id} stars`).toBe(
          Math.min(big + small, cap),
        );
      }
    });
  }
});
