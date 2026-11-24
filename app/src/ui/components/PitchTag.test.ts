import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { t } from '@lib/i18n';
import PitchTag, { PITCH_TAG_MOTION, PITCH_TAG_TIP } from './PitchTag.svelte';

/*
 * The PitchTag (partida-campo-v2.md, §9, §11 and §16). The shirt here is a stand-in for the SVG of
 * `shirtSvg` (viewBox 0 0 64 42).
 */
const shirtSvg = '<svg viewBox="0 0 64 42" aria-hidden="true"><path d="M0 0H64V42H0Z"/></svg>';
const source = readFileSync(new URL('./PitchTag.svelte', import.meta.url), 'utf8');
const style = source.slice(source.indexOf('<style>'));

function body(props: Record<string, unknown>): string {
  return render(PitchTag, { props: { kitSvg: shirtSvg, ...props } as never }).body;
}

describe('PitchTag', () => {
  it('is hidden from screen readers in every tone', () => {
    for (const tone of ['play', 'goal', 'team'])
      expect(body({ tone, kind: 'x', name: 'y', shirt: 9 })).toMatch(
        /<div[^>]*class="place[^"]*"[^>]*aria-hidden="true"/,
      );
  });

  it('writes the kind, the name and the number of a play', () => {
    const html = body({
      tone: 'play',
      kind: t('match.live.shot', 'pt-BR'),
      name: 'Tavinho Brasa',
      shirt: 9,
      number: { color: '#ffffff', plate: null, fill: '#123456' },
    });
    expect(html).toMatch(/class="rotulo kind[^"]*">Finalização</);
    expect(html).toMatch(/class="body-strong name[^"]*">Tavinho Brasa</);
    // Always on a plate: with no `numberPlate`, the `fill` of the kit.
    expect(html).toMatch(/class="numero number[^"]*\bplate\b[^"]*"/);
    expect(html).toContain('color: #ffffff;');
    expect(html).toContain('background: #123456');
    expect(html).toContain(shirtSvg);
  });

  it('puts the number on the plate of the kit when it has one, in every size', () => {
    const html = body({
      tone: 'play',
      kind: t('report.event.red', 'pt-BR'),
      name: 'Zé',
      shirt: 4,
      number: { color: '#111417', plate: '#ffffff', fill: '#123456' },
    });
    expect(html).toMatch(/class="numero number[^"]*\bplate\b/);
    expect(html).toContain('background: #ffffff');
    expect(html).not.toContain('#123456');
    const compact = body({
      tone: 'play',
      kind: 'x',
      name: 'Zé',
      shirt: 4,
      compact: true,
      number: { color: '#111417', plate: null, fill: '#123456' },
    });
    expect(compact).toMatch(/\bplate\b/);
    expect(compact).toContain('background: #123456');
  });

  it('keeps only the shirt and the name when compact', () => {
    const html = body({
      tone: 'play',
      kind: t('match.live.penalty', 'pt-BR'),
      name: 'Zé',
      shirt: 10,
      compact: true,
    });
    expect(html).toMatch(/class="tag play[^"]*\bcompact\b/);
    expect(html).not.toContain('Pênalti');
    expect(html).toContain('>Zé<');
  });

  it('dims the name while waiting, only in a play', () => {
    expect(body({ tone: 'play', name: 'Zé', waiting: true })).toMatch(
      /class="tag play[^"]*\bwaiting\b/,
    );
    expect(body({ tone: 'goal', name: 'Zé', waiting: true })).not.toMatch(/\bwaiting\b/);
  });

  it('is the goal tag: title in numero, scorer, assist; the title alone when compact', () => {
    const title = t('match.celebration.title', 'pt-BR');
    const html = body({ tone: 'goal', kind: title, name: 'Tavinho Brasa', assist: 'A', shirt: 9 });
    expect(html).toMatch(/class="tag goal/);
    expect(html).toMatch(/class="numero title[^"]*">Gol!</);
    expect(html).toContain('>Tavinho Brasa<');
    expect(html).toMatch(/class="caption assist[^"]*">A</);
    const compact = body({
      tone: 'goal',
      kind: title,
      name: 'Tavinho Brasa',
      assist: 'A',
      compact: true,
    });
    expect(compact).toContain('>Gol!<');
    expect(compact).not.toContain('Tavinho Brasa');
    expect(compact).not.toContain('assist');
  });

  it('shows only the shirt with the team tone, never a number or a text', () => {
    const html = body({ tone: 'team', kind: 'Finalização', name: 'Zé', shirt: 9, compact: true });
    expect(html).toMatch(/class="tag team/);
    expect(html).not.toMatch(/\bcompact\b/);
    for (const text of ['Finalização', 'Zé', '>9<', 'class="text'])
      expect(html).not.toContain(text);
  });

  it('takes a smaller type for two digits, and a hairline on the shirt only at night', () => {
    const n = { color: '#fff', plate: null, fill: '#123456' };
    expect(body({ tone: 'play', name: 'Zé', shirt: 7, number: n })).not.toMatch(
      /number[^"]*\btwo\b/,
    );
    expect(body({ tone: 'play', name: 'Zé', shirt: 10, number: n })).toMatch(/number[^"]*\btwo\b/);
    expect(style).toContain('filter: drop-shadow(0 0 1px var(--line))');
    expect(style).toMatch(/\[data-theme='dia'\]\) \.shirt[^{]*\{\s*filter: none/);
  });

  it('is placed from outside: no position props, the tip moves by transform only', () => {
    expect(body({ tone: 'play', name: 'Zé' })).not.toMatch(/translate3d|--tip/);
    expect(style).toContain('translateX(var(--tip-shift, 0px))');
    expect(style).not.toMatch(/left:\s*calc\(var\(--tip/);
  });

  it('has the sizes and the times of §9', () => {
    expect(PITCH_TAG_TIP).toEqual({ width: 12, height: 7 });
    expect(PITCH_TAG_MOTION).toEqual({ playIn: 160, goalIn: 200, out: 120 });
    expect(style).toContain('animation: tag-in 160ms ease-out');
    expect(style).toContain('animation: tag-in 200ms ease-out');
    expect(style).toContain('transition: opacity 120ms');
    for (const h of ['--tag-h: 48px', '--tag-h: 50px', '--tag-h: 40px']) expect(style).toContain(h);
  });

  it('moves only outside reduced motion and uses no literal colour', () => {
    const motion = style.slice(style.indexOf('@media (prefers-reduced-motion: no-preference)'));
    const before = style.slice(0, style.indexOf('@media'));
    expect(before).not.toMatch(/animation:|transition:/);
    expect(motion).toMatch(/animation:/);
    expect(style).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
});
