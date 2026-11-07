import { NAV_EXTRA, NAV_SETTINGS, NAV_TABS, NAV_TUTORIAL } from './components/nav-items';

/*
 * Routing by simple state (docs/02-architecture.md, 3, "Interface"): each destination of the
 * career frame has an address in the history (`#/club`), so the phone's back gesture moves
 * between them, and the frame reads the destination back from the address. No routing library.
 */

/** Every destination of the frame, in the order of navegacao.md. */
export const DESTINATIONS = [...NAV_TABS, ...NAV_EXTRA, ...NAV_SETTINGS, NAV_TUTORIAL] as const;

export type DestinationId = string;

/** Where the career opens (US-015: the Clube tab). */
export const HOME_DESTINATION: DestinationId = NAV_TABS[0]!.id;

/** Carreiras e backup: also where "Liberar espaço" leads (saves.md). */
export const SAVES_DESTINATION: DestinationId = 'saves';

/** The address of the new-game screen, outside the frame (its own entry: back returns home). */
export const NEW_GAME_HASH = '#/new';

const ids = new Set(DESTINATIONS.map((d) => d.id));

/** The address of a destination. */
export function hrefOf(id: DestinationId): string {
  return `#/${id}`;
}

/** The destination of an address (`location.hash`); an unknown or empty one is the Clube tab. */
export function destinationOf(hash: string): DestinationId {
  const id = hash.replace(/^#\/?/, '');
  return ids.has(id) ? id : HOME_DESTINATION;
}

/** The text key of a destination's label. */
export function labelKeyOf(id: DestinationId): string {
  return DESTINATIONS.find((d) => d.id === id)?.labelKey ?? NAV_TABS[0]!.labelKey;
}
