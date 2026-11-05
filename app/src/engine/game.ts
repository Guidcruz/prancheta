import { validateClubs, type ClubDef } from './clubs.ts';
import { generateFixtures, type Fixture } from './fixtures.ts';
import {
  drawClubProfile,
  drawPreferredFormations,
  effectiveStrength,
  generateSquad,
} from './generation.ts';
import type { GameParams } from './params.ts';
import type { TeamSheet } from './lineup.ts';
import type { IdentitySource, Player } from './players.ts';
import { fail, ok } from './result.ts';
import type { PlayerSeasonStats } from './round.ts';
import { Rng, seedFromString } from './rng.ts';
import type { SeasonSummary } from './season.ts';
import { ENGINE_VERSION } from './version.ts';
import type { AiProfile, ClubId, EngineWarning, Formation, PlayerId, Result } from './types.ts';

/*
 * Game state and `newGame` (docs/02-architecture.md, 4.1; T-006). The state grows with the tasks
 * that own each part: this file has what a new game needs to exist (clubs, squads, players and
 * the identity of the career), the calendar (`fixtures`, T-007) and what the rounds write
 * (`lastSheets`, `seasonStats`, T-013; round.ts) and the summaries of the seasons closed
 * (`pastSeasons`, T-017; season.ts). The round's report is not state: `playRound` returns it and
 * the application keeps its lean form (`roundRecap`, `matchSheet`; recap.ts, T-049). The save
 * format (T-018/T-019) is frozen only after that, so these changes need no migration.
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
  /** Fans thermometer 0..100; starts at `fans.start` and moves once per round (fans.ts). */
  readonly fans: number;
  /**
   * Rounds in a row in which the club's idol did not take the pitch while able to (not injured
   * nor suspended); from the 2nd, −1 on the thermometer per round (torcida.md; round.ts).
   */
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
  /** The 380 matches of the current season, by round (fixtures.ts), with the results played. */
  readonly fixtures: readonly Fixture[];
  /**
   * The last team sheet each club took to the pitch (`playRound`); empty before round 1. The
   * displayed strength without a lineup reads it (`teamStrength`, `shownEleven`).
   */
  readonly lastSheets: Readonly<Record<ClubId, TeamSheet>>;
  /** Season numbers of every player who took the pitch this season (round.ts). */
  readonly seasonStats: Readonly<Record<PlayerId, PlayerSeasonStats>>;
  /**
   * One lean summary per season closed by `endSeason` (season.ts; temporada.md, "O que vai para
   * pastSeasons"): ids and numbers only, never names (ADR-0012). The career's league titles are
   * derived from it (`careerLeagueTitles`).
   */
  readonly pastSeasons: readonly SeasonSummary[];
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
 * The calendar of season 1 comes from `generateFixtures` (stream `${seed}-fixtures-1`), which
 * draws nothing from the other streams. `invalid-calendar`: the year is outside YEAR_RANGE or
 * the season weeks are invalid (params not passed through `validateParams`).
 *
 * Warnings: those of `validateClubs` (`club-strength-default`) and `squad-strength-off` when a
 * squad could not be brought within 0.5 of its strength.
 */
export function newGame(
  setup: NewGameSetup,
  clubs: readonly ClubDef[],
  params: GameParams,
  identities: IdentitySource,
): Result<GameState, 'invalid-clubs' | 'invalid-calendar'> {
  const checked = validateClubs(clubs);
  if (!checked.ok) return fail('invalid-clubs', checked.detail);
  const seed = setup.seed >>> 0;
  // validateClubs already guarantees 20 distinct ids, so only the calendar can refuse here.
  const fixtures = generateFixtures(
    { seed, season: 1, year: setup.year, clubIds: checked.value.map((def) => def.id) },
    params.season,
  );
  if (!fixtures.ok) {
    return fixtures.error === 'invalid-calendar'
      ? fail('invalid-calendar', fixtures.detail)
      : fail('invalid-clubs', fixtures.detail);
  }
  const warnings: EngineWarning[] = [...checked.warnings];
  const clubStates: Record<ClubId, ClubState> = {};
  const players: Record<PlayerId, Player> = {};
  const squads: Record<ClubId, PlayerId[]> = {};

  for (const def of checked.value) {
    const profileRng = new Rng(seedFromString(`${seed}-profile-${def.id}`));
    // Drawn even when the data has a profile, so the formation draw always uses the same
    // position of the stream (fixed consumption of the Rng).
    const drawnProfile = drawClubProfile(profileRng, def.size);
    const profile = def.aiProfile ?? drawnProfile;
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
      fixtures: fixtures.value,
      lastSheets: {},
      seasonStats: {},
      pastSeasons: [],
    },
    warnings,
  );
}
