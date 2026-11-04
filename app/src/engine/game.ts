import { validateClubs, type ClubDef } from './clubs.ts';
import {
  drawClubProfile,
  drawPreferredFormations,
  effectiveStrength,
  generateSquad,
} from './generation.ts';
import type { GameParams } from './params.ts';
import type { IdentitySource, Player } from './players.ts';
import { fail, ok } from './result.ts';
import { Rng, seedFromString } from './rng.ts';
import { ENGINE_VERSION } from './version.ts';
import type { AiProfile, ClubId, EngineWarning, Formation, PlayerId, Result } from './types.ts';

/*
 * Game state and `newGame` (docs/02-architecture.md, 4.1; T-006). The state grows with the tasks
 * that own each part: this file has what a new game needs to exist (clubs, squads, players and
 * the identity of the career). Still to come, as §4.1 assigns them:
 * - `fixtures` (the 380 matches with dates): T-007;
 * - `lastSheets`, `seasonStats`, `lastRound` (rounds, tables, cards, injuries): T-013;
 * - `pastSeasons` (end of season): T-017.
 * The save format (T-018/T-019) is frozen only after those land, so adding them needs no
 * migration yet.
 */

/** A club in the career (docs/02-architecture.md, 4.1). */
export interface ClubState {
  /** The validated definition (with `strength` filled in). */
  readonly def: ClubDef;
  /** `def.aiProfile`, or drawn by size with the career seed (ia-clubes.md). */
  readonly profile: AiProfile;
  /** Effective target strength of this career: `strength + Normal(0, clubStrengthSd)`. */
  readonly strength: number;
  /** The first is the preferred one: the squad was generated and measured in it. */
  readonly preferredFormations: readonly [Formation, Formation];
  /** Fans thermometer 0..100; starts at `fans.start`. Its dynamics are T-014. */
  readonly fans: number;
  /** Consecutive rounds with the idol on the bench (torcida.md); T-014. */
  readonly idolBenchStreak: number;
}

export interface GameRules {
  readonly realism: 'full' | 'simplified';
}

/** State of a career or league (docs/02-architecture.md, 4.1), JSON-serialisable. */
export interface GameState {
  /** ENGINE_VERSION that wrote it last (diagnostics). */
  readonly engineVersion: number;
  /** Revision of the retired names already applied (ADR-0012); the engine only copies it. */
  readonly retiredNamesRev: number;
  /** Seed of the career or league, as an unsigned 32-bit integer. */
  readonly seed: number;
  readonly year: number;
  /** Starts at 1. */
  readonly season: number;
  /** Next round to play (1..38); 39 = season over. */
  readonly round: number;
  readonly phase: 'season' | 'seasonEnd';
  readonly rules: GameRules;
  readonly clubs: Readonly<Record<ClubId, ClubState>>;
  readonly players: Readonly<Record<PlayerId, Player>>;
  /** Squad of each club in squad order: XI by slot, reserves, rotation, youth. */
  readonly squads: Readonly<Record<ClubId, readonly PlayerId[]>>;
}

export interface NewGameSetup {
  seed: number;
  year: number;
  realism: 'full' | 'simplified';
}

/**
 * Creates the state of a new career (or league): validates the clubs, then for each club, in
 * list order and each from its own seeded streams, the AI profile, the preferred formations, the
 * effective strength and the squad of 25 with names and faces from `identities` (ADR-0012).
 * Season 1, round 1. Pure: the same setup, clubs, params and identity source always give the same
 * state, and the inputs are never changed.
 *
 * Warnings: those of `validateClubs` (`club-strength-default`) and `squad-strength-off` when a
 * squad could not be brought within 0.5 of its strength.
 */
export function newGame(
  setup: NewGameSetup,
  clubs: readonly ClubDef[],
  params: GameParams,
  identities: IdentitySource,
): Result<GameState, 'invalid-clubs'> {
  const checked = validateClubs(clubs);
  if (!checked.ok) return fail('invalid-clubs', checked.detail);
  const seed = setup.seed >>> 0;
  const warnings: EngineWarning[] = [...checked.warnings];
  const clubStates: Record<ClubId, ClubState> = {};
  const players: Record<PlayerId, Player> = {};
  const squads: Record<ClubId, PlayerId[]> = {};

  for (const def of checked.value) {
    const profileRng = new Rng(seedFromString(`${seed}-profile-${def.id}`));
    const profile = def.aiProfile ?? drawClubProfile(profileRng, def.size);
    const preferredFormations = drawPreferredFormations(profileRng, profile);
    const strength = effectiveStrength(
      new Rng(seedFromString(`${seed}-strength-${def.id}`)),
      def.strength!,
      params.generation.clubStrengthSd,
    );
    const squad = generateSquad(
      { clubId: def.id, seed, strength, formation: preferredFormations[0] },
      params,
      identities,
    );
    warnings.push(...squad.warnings);
    clubStates[def.id] = {
      def,
      profile,
      strength,
      preferredFormations,
      fans: params.fans.start,
      idolBenchStreak: 0,
    };
    squads[def.id] = squad.players.map((p) => p.id);
    for (const player of squad.players) players[player.id] = player;
  }

  return ok(
    {
      engineVersion: ENGINE_VERSION,
      retiredNamesRev: identities.retiredRev,
      seed,
      year: setup.year,
      season: 1,
      round: 1,
      phase: 'season',
      rules: { realism: setup.realism },
      clubs: clubStates,
      players,
      squads,
    },
    warnings,
  );
}
