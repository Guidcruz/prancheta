import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * The zoom rule of the CEO (componentes.md, "Zoom no celular", T-025): pinch zoom stays, no zoom
 * by double tap, no zoom on focusing a field. Read from the files, since the tests have no DOM.
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('zoom on the phone', () => {
  it('pinch zoom stays: the viewport neither caps the scale nor disables it', () => {
    const viewport = read('../../index.html').match(/<meta name="viewport"[^>]*>/)?.[0] ?? '';
    expect(viewport).toContain('width=device-width');
    expect(viewport).not.toMatch(/maximum-scale|user-scalable/);
  });

  it('no zoom by double tap: touch-action manipulation on the html element', () => {
    const html = read('../app.css').match(/(?:^|\n)html\s*\{[^}]*\}/)?.[0] ?? '';
    expect(html).toMatch(/touch-action:\s*manipulation;/);
  });

  it('no zoom on focus: the text field is body-lg (17px), never under 16px', () => {
    expect(read('./components/TextField.svelte')).toMatch(/class="input body-lg"/);
    const size = read('../tokens.css').match(/\.body-lg\s*\{[^}]*font-size:\s*(\d+)px/)?.[1];
    expect(Number(size)).toBeGreaterThanOrEqual(16);
  });
});
