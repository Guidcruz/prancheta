import { describe, expect, it } from 'vitest';
import { NAV_TABS } from './components/nav-items';
import {
  DESTINATIONS,
  HOME_DESTINATION,
  NEW_GAME_HASH,
  SAVES_DESTINATION,
  destinationOf,
  hrefOf,
  labelKeyOf,
} from './router';

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

  it('Carreiras e backup is a destination of the frame; the new game is outside it', () => {
    expect(destinationOf(hrefOf(SAVES_DESTINATION))).toBe(SAVES_DESTINATION);
    expect(labelKeyOf(SAVES_DESTINATION)).toBe('nav.saves');
    // The new-game address is not a frame destination: a career opened from it lands on Clube.
    expect(destinationOf(NEW_GAME_HASH)).toBe(HOME_DESTINATION);
  });
});
