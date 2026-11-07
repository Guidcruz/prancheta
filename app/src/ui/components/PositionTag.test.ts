import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { POSITIONS } from '@engine';
import PositionTag from './PositionTag.svelte';
import { SECTORS, SECTOR_OF } from './sectors';

const tokens = readFileSync(new URL('../../tokens.css', import.meta.url), 'utf8');

describe('SECTOR_OF', () => {
  it('gives every position of the engine a sector', () => {
    for (const position of POSITIONS) expect(SECTORS).toContain(SECTOR_OF[position]);
    expect(Object.keys(SECTOR_OF).sort()).toEqual([...POSITIONS].sort());
  });

  it('follows the lines of the team: GK, CB and FB, DM and AM, ST', () => {
    expect(SECTOR_OF).toEqual({
      GK: 'gk',
      CB: 'def',
      FB: 'def',
      DM: 'mid',
      AM: 'mid',
      ST: 'atk',
    });
  });

  it('has every sector in use and both tokens of each in tokens.css', () => {
    for (const sector of SECTORS) {
      expect(Object.values(SECTOR_OF)).toContain(sector);
      expect(tokens).toContain(`--sector-${sector}:`);
      expect(tokens).toContain(`--sector-${sector}-soft:`);
    }
  });
});

describe('PositionTag', () => {
  it('writes the code and takes the class of its sector', () => {
    for (const sector of SECTORS) {
      const { body } = render(PositionTag, { props: { code: 'ATA', sector } });
      expect(body).toContain('>ATA</span>');
      expect(body).toMatch(new RegExp(`class="[^"]*\\bsector-${sector}\\b`));
      for (const other of SECTORS.filter((s) => s !== sector))
        expect(body).not.toMatch(new RegExp(`\\bsector-${other}\\b`));
    }
  });

  it('is neutral without a sector', () => {
    const { body } = render(PositionTag, { props: { code: 'MEI' } });
    expect(body).toContain('>MEI</span>');
    expect(body).not.toMatch(/\bsector-/);
  });

  it('is read by screen readers unless hidden', () => {
    const shown = render(PositionTag, { props: { code: 'GOL', sector: 'gk' } }).body;
    expect(shown).not.toContain('aria-hidden');
    const hidden = render(PositionTag, { props: { code: 'GOL', sector: 'gk', hidden: true } }).body;
    expect(hidden).toContain('aria-hidden="true"');
  });

  it('paints the sector only on the background and the border, the code in ink', () => {
    const source = readFileSync(new URL('./PositionTag.svelte', import.meta.url), 'utf8');
    for (const sector of SECTORS) {
      const rule = source.match(new RegExp(`\\.sector-${sector} \\{([^}]*)\\}`))?.[1] ?? '';
      expect(rule, sector).toContain(`border-color: var(--sector-${sector});`);
      expect(rule, sector).toContain(`background: var(--sector-${sector}-soft);`);
      expect(rule, sector).toContain('color: var(--ink);');
    }
  });
});
