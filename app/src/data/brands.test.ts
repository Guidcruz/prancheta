import { describe, expect, it } from 'vitest';
import { FICTIONAL_BRANDS, brandForSlot } from '../lib/brands';
import { contrastRatio } from '../lib/generators/shield';

/* The lot of fictional brands (T-040; ADR-0015): unique names, valid hex, background × mark ≥ 3:1. */
describe('the fictional brands', () => {
  it('are the 22 of the approved lot, with the renamed açaí', () => {
    expect(FICTIONAL_BRANDS).toHaveLength(22);
    const names = FICTIONAL_BRANDS.map((b) => b.name);
    expect(names).toContain('Açaí Língua Roxa');
    expect(names).not.toContain('Açaí Beiço Roxo');
  });
  it('have unique ids and names', () => {
    expect(new Set(FICTIONAL_BRANDS.map((b) => b.id)).size).toBe(22);
    expect(new Set(FICTIONAL_BRANDS.map((b) => b.name.toLowerCase())).size).toBe(22);
  });
  it('have valid hex colours, at least 3:1 between background and mark', () => {
    for (const b of FICTIONAL_BRANDS) {
      for (const c of b.colors) expect(c, b.name).toMatch(/^#[0-9a-f]{6}$/);
      expect(contrastRatio(b.colors[0], b.colors[1]), b.name).toBeGreaterThanOrEqual(3);
    }
  });
  it('are picked by brandForSlot deterministically, from the context only', () => {
    const ctx = { round: 3, clubId: 'c1', stadiumId: 's1' };
    expect(brandForSlot('pitch-boards', ctx)).toBe(brandForSlot('pitch-boards', { ...ctx }));
    const picked = new Set(
      Array.from({ length: 12 }, (_, i) => brandForSlot('pitch-boards', { ...ctx, index: i }).id),
    );
    expect(picked.size).toBeGreaterThan(4);
  });
});
