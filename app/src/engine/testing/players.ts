/**
 * Hand-made players for tests: a valid player that a test can break one field at a time.
 *
 * Test-only code: never imported by `index.ts`.
 */
import { computeOverall, type Player, type PlayerAttributes } from '../players.ts';
import type { Position } from '../types.ts';

/** A mutable copy of Player, so tests can break one field at a time. */
export type MutablePlayer = { -readonly [K in keyof Player]: Player[K] };

/** The attacker of the example in docs/design/jogadores.md: overall 76.3 → 76. */
export const EXAMPLE_STRIKER_ATTRIBUTES: PlayerAttributes = {
  speed: 80,
  technique: 72,
  passing: 60,
  finishing: 81,
  marking: 30,
  physical: 70,
};

export const EXAMPLE_GOALKEEPER_ATTRIBUTES: PlayerAttributes = {
  reflexes: 78,
  positioning: 74,
  aerial: 70,
  rushing: 66,
  distribution: 60,
  physical: 72,
};

/**
 * A valid player of `clube-teste-01` (the striker of the design example, or a goalkeeper when
 * `position` is `GK`). `overall` follows the attributes unless overridden.
 */
export function testPlayer(overrides: Partial<MutablePlayer> = {}): MutablePlayer {
  const position: Position = overrides.position ?? 'ST';
  const attributes =
    overrides.attributes ??
    (position === 'GK' ? EXAMPLE_GOALKEEPER_ATTRIBUTES : EXAMPLE_STRIKER_ATTRIBUTES);
  const overall = overrides.overall ?? computeOverall(position, attributes);
  return {
    id: 'clube-teste-01#9',
    clubId: 'clube-teste-01',
    nameSeed: 123456,
    faceSeed: 654321,
    name: { display: 'Teste9', full: 'Jogador Teste9', family: 'Teste9' },
    face: 't-br-abc',
    nationality: 'BR',
    position,
    secondaryPosition: null,
    attributes: { ...attributes },
    overall,
    potential: overall + 2,
    age: 27,
    peakAge: 28,
    growth: 1,
    trait: 'quiet',
    shirt: 9,
    condition: 100,
    morale: 60,
    injuryRounds: 0,
    suspendedGames: 0,
    yellowCount: 0,
    recentRatings: [],
    benchStreak: 0,
    clubAppearances: 0,
    ...overrides,
  };
}
