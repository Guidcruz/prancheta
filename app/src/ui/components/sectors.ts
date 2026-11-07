import type { Position } from '@engine';

/*
 * The sector of each position, for the colour of the position tag (PositionTag; design-system.md,
 * "Cor de setor"; approved by the CEO on 2026-11-07). The colour only paints the tag's background
 * and border (`sector-*-soft`, `sector-*`); the code is always written, in `ink`.
 */

/** Goalkeeper, defence, midfield, attack: the lines of the team (the engine's bench lines). */
export type Sector = 'gk' | 'def' | 'mid' | 'atk';

export const SECTORS: readonly Sector[] = ['gk', 'def', 'mid', 'atk'];

/**
 * The one map of the interface from a natural position to its sector: every screen that paints a
 * position tag reads it here, never a sector of its own. Full-backs are defence even when a
 * 3-5-2 plays them as wing-backs: the tag shows the player's natural position, not the slot.
 */
export const SECTOR_OF: { readonly [P in Position]: Sector } = {
  GK: 'gk',
  CB: 'def',
  FB: 'def',
  DM: 'mid',
  AM: 'mid',
  ST: 'atk',
};
