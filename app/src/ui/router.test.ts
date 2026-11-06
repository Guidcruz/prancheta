import { describe, expect, it } from 'vitest';
import { NAV_TABS } from './components/nav-items';
import { DESTINATIONS, HOME_DESTINATION, destinationOf, hrefOf, labelKeyOf } from './router';

describe('routing by state (navegacao.md)', () => {
  it('every destination has its own address and reads back from it', () => {
    const hrefs = DESTINATIONS.map((d) => hrefOf(d.id));
    expect(new Set(hrefs).size).toBe(DESTINATIONS.length);
    for (const d of DESTINATIONS) expect(destinationOf(hrefOf(d.id))).toBe(d.id);
  });

  it('an empty or unknown address is the Clube tab', () => {
    expect(HOME_DESTINATION).toBe('club');
    for (const hash of ['', '#', '#/', '#/market', '#/../x', '#club?x']) {
      expect(destinationOf(hash)).toBe('club');
    }
  });

  it('has the four tabs of the Etapa 1, without Mercado', () => {
    expect(NAV_TABS.map((d) => d.id)).toEqual(['club', 'squad', 'table', 'calendar']);
    expect(labelKeyOf('calendar')).toBe('nav.tab.calendar');
    expect(labelKeyOf('nowhere')).toBe('nav.tab.club');
  });
});
