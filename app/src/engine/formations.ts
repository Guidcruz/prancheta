import type { AiProfile, Formation, Position } from './types.ts';

/*
 * Formation tables (docs/design/partida.md, "Formações"; docs/design/ia-clubes.md, "Perfis na
 * 1a"). Rule constants, not /balance knobs. The sector of each slot and the sector multipliers
 * (`def`, `mid`, `atk`) belong to the strength calculation, in strength.ts (T-008).
 */

export const FORMATIONS: readonly Formation[] = [
  '4-4-2',
  '4-3-3',
  '4-2-3-1',
  '3-5-2',
  '3-4-3',
  '5-3-2',
];

/**
 * A known formation (one of {@link FORMATIONS}): the one check of a formation read from a sheet,
 * a command or a save, shared by the whole engine.
 */
export function isFormation(value: unknown): value is Formation {
  return typeof value === 'string' && (FORMATIONS as readonly string[]).includes(value);
}

/**
 * Natural position of each of the 11 slots, in the order of `Lineup.starters`: always 1 GK, then
 * the defence, midfield and attack positions in the order GK, CB, FB, DM, AM, ST. The full-backs
 * of a back three (3-5-2, 3-4-3) are wing-backs and count in midfield (T-008), but keep the `FB`
 * position here (strength.ts, FORMATION_SECTORS).
 */
export const FORMATION_SLOTS: { readonly [F in Formation]: readonly Position[] } = {
  '4-4-2': ['GK', 'CB', 'CB', 'FB', 'FB', 'DM', 'DM', 'AM', 'AM', 'ST', 'ST'],
  '4-3-3': ['GK', 'CB', 'CB', 'FB', 'FB', 'DM', 'AM', 'AM', 'ST', 'ST', 'ST'],
  '4-2-3-1': ['GK', 'CB', 'CB', 'FB', 'FB', 'DM', 'DM', 'AM', 'AM', 'AM', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'FB', 'FB', 'DM', 'DM', 'AM', 'ST', 'ST'],
  '3-4-3': ['GK', 'CB', 'CB', 'CB', 'FB', 'FB', 'DM', 'DM', 'ST', 'ST', 'ST'],
  '5-3-2': ['GK', 'CB', 'CB', 'CB', 'FB', 'FB', 'DM', 'DM', 'AM', 'ST', 'ST'],
};

/**
 * The two preferred formations of each AI profile, in the order of the table (the first wins a
 * tie in ia-clubes.md). The chaotic profile draws among all six every match, so it has no fixed
 * pair: `newGame` draws two distinct formations for it (see generation.ts).
 */
export const PROFILE_FORMATIONS: {
  readonly [P in Exclude<AiProfile, 'chaotic'>]: readonly [Formation, Formation];
} = {
  ambitious: ['4-3-3', '4-2-3-1'],
  academy: ['4-3-3', '3-4-3'],
  seller: ['4-4-2', '4-2-3-1'],
  traditional: ['4-4-2', '3-5-2'],
};
