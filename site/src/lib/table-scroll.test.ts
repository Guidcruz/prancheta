import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), 'utf8');

describe('table scroll', () => {
  it('devlog tables do not force a minimum width', () => {
    expect(read('hast-table-scroll.mjs')).not.toMatch(/--table-min/);
  });
  it('css falls back to no minimum when --table-min is unset', () => {
    expect(read('table-scroll.css')).toMatch(/min-width:\s*var\(--table-min,\s*0\)/);
  });
  it('TableScroll.astro keeps its own minimum width', () => {
    expect(read('components/TableScroll.astro')).toMatch(/--table-min: \$\{minWidth\}/);
  });
});
