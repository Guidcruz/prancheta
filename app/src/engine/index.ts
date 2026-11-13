/**
 * Public API of the engine (docs/02-architecture.md, 4.1, "Fronteira do `index.ts`"; T-049).
 * Everything outside `engine/` (lib/, ui/, scripts/, site/ and, from Etapa 1b, server/) imports
 * the engine only from here, and the lint enforces it (app/eslint.config.js, `engineEntryOnly`).
 *
 * Two blocks:
 * - the contract: the types, functions, closed lists and field ranges that 4.1 signs. A rename
 *   inside the engine never breaks a caller as long as this block holds;
 * - the tools API, at the end: what only scripts/ (the /balance) needs and the contract does not
 *   have. Its list is written symbol by symbol in 4.1; a new symbol there goes through the
 *   architect, and using one of them in lib/, ui/, server/ or site/ is a BLOCKER in review.
 *
 * Everything else is internal: the engine's own files and tests import it by its file path.
 */

// ---------------------------------------------------------------- contract: foundations

export { ENGINE_VERSION } from './version.ts';
export { Rng, seedFromString } from './rng.ts';
export type { EngineWarning, Result } from './types.ts';

// ---------------------------------------------------------------- contract: functions

export { validateParams } from './params.ts';
export { validateClubs } from './clubs.ts';
export {
  attributeKeysFor,
  fitLevel,
  isProspect,
  playerForm,
  secondaryPositionFor,
  takerValue,
  validatePlayer,
} from './players.ts';
export { newGame } from './game.ts';
export { playRound, prepareRound } from './round.ts';
export { simulateMatch } from './match/simulate.ts';
export { suggestSheet, validateLineup } from './ai.ts';
export { isAvailable, sheetStrength, teamStrength } from './strength.ts';
export { getStandings, standingsHistory } from './standings.ts';
export {
  careerLeagueTitles,
  endSeason,
  seasonAwards,
  startNextSeason,
  strengthRank,
  targetPosition,
} from './season.ts';
export { matchSheet, roundRecap } from './recap.ts';
export { fanMood } from './fans.ts';
export { draftFromSheet } from './lineup.ts';
export { completeSheet, reshapeLineup, sheetProblems, sheetRoles } from './draft.ts';

// ---------------------------------------------------------------- contract: closed lists and ranges
// What the interface and the save schema (valibot, T-019) read instead of retyping them.

export { PARAM_RANGES, SEASON_ROUNDS } from './params.ts';
export {
  AI_PROFILES,
  BLOCKLIST_FIELDS,
  CLUB_SIZES,
  CREST_PATTERNS,
  CREST_SHAPES,
  CREST_SYMBOLS,
  STRENGTH_RANGE,
} from './clubs.ts';
export {
  AGE_RANGE,
  ATTRIBUTE_RANGE,
  CONDITION_RANGE,
  FACE_MAX_LENGTH,
  MORALE_RANGE,
  POSITIONS,
  POTENTIAL_STORED_MAX,
  RATING_RANGE,
  RECENT_RATINGS_MAX,
  SHIRT_RANGE,
  SQUAD_SIZE,
  TAKER_ATTRIBUTE,
  TRAITS,
} from './players.ts';
export { FORMATIONS, FORMATION_SLOTS } from './formations.ts';
export { POSTURES } from './strength.ts';
export { BENCH_SIZE } from './lineup.ts';
export { MATCH_MODES } from './round.ts';
export { HALFTIME_TALKS, MARKERS } from './match/rules.ts';
export { MATCH_SHEET_EVENTS } from './recap.ts';
export { FORM_LENGTH, RELEGATION_SPOTS } from './standings.ts';
export { FAN_MOODS } from './fans.ts';

// ---------------------------------------------------------------- contract: types

export type {
  AiProfile,
  ClubId,
  ClubSize,
  FixtureId,
  Formation,
  PlayerId,
  Position,
  Posture,
  Pressure,
  Side,
  Trait,
} from './types.ts';
export type {
  BlocklistField,
  ClubDef,
  ClubIssue,
  ClubProblem,
  ClubsResult,
  ClubTitles,
  CrestPattern,
  CrestShape,
  CrestSymbol,
  ValidateClubsOptions,
} from './clubs.ts';
export type {
  AttributeKey,
  FitLevel,
  GoalkeeperAttributeKey,
  IdentitySource,
  OutfieldAttributeKey,
  Player,
  PlayerAttributes,
  PlayerIdentity,
  PlayerIssue,
  PlayerNameText,
  PlayerProblem,
  PlayerResult,
  TakerRole,
} from './players.ts';
export type {
  AiParams,
  FansParams,
  GameParams,
  GenerationParams,
  IntListRange,
  MatchParams,
  NumberRange,
  ParamIssue,
  ParamProblem,
  ParamRanges,
  ParamsResult,
  PlayersParams,
  SeasonParams,
} from './params.ts';
export type { ClubState, GameRules, GameState, NewGameSetup } from './game.ts';
export type { Fixture } from './fixtures.ts';
export type { DraftLineup, DraftSheet, Lineup, LineupState, Tactic, TeamSheet } from './lineup.ts';
export type { DraftProblem, RoleHolder, SheetCheck, SheetRoles } from './draft.ts';
export type { SheetProblem, SuggestOptions, SuggestState, ValidateLineupResult } from './ai.ts';
export type { SheetStrength, ShownState } from './strength.ts';
export type {
  ChanceKind,
  HalftimeChoice,
  HalftimeTalk,
  InjurySeverity,
  MatchCommand,
  MatchEvent,
  MatchGoal,
  MatchInput,
  MatchMarker,
  MatchResult,
  MatchStats,
  MatchSummary,
  MissOutcome,
  TacticPreset,
  TeamInput,
} from './match/types.ts';
export type {
  MatchMode,
  PlayerSeasonStats,
  RoundInput,
  RoundPlan,
  RoundReport,
  RoundSetup,
} from './round.ts';
export type { MatchRecap, MatchSheet, MatchSheetEvent, RoundRecap } from './recap.ts';
export type { Fact } from './facts.ts';
export type { FanMood } from './fans.ts';
export type { StandingResult, StandingRow, StandingsState } from './standings.ts';
export type {
  AssistAward,
  CampaignMatch,
  ClubCampaign,
  GoalkeeperAward,
  RatingAward,
  ScorerAward,
  SeasonAwards,
  SeasonSummary,
  TeamOfSeasonSlot,
} from './season.ts';

// ---------------------------------------------------------------- tools API (scripts/ only)
// The /balance (scripts/balance/) rebuilds the engine's formulas for its coach robot and its
// duels. Only scripts/ may use this block (docs/02-architecture.md, 4.1, "API de ferramentas");
// the list there is the reference, and a new symbol here goes through the architect.

export { exp } from './math.ts';
export { daysBetween } from './fixtures.ts';
export { attributeOf } from './players.ts';
export { bestEleven, generateSquad } from './generation.ts';
export { bestForSlot, correctedCondition, isUnavailable, naturalFirstEleven } from './selection.ts';
export { pickBench, pickCaptainAndTakers } from './ai.ts';
export {
  GOALKEEPER_SLOT,
  effectiveRating,
  homeAdvantage,
  sectorStrengths,
  strengthsFromRatings,
} from './strength.ts';
export type { TeamStrengths } from './strength.ts';
export {
  HALF_MINUTES,
  IN_MATCH_AI,
  MAX_SUBS,
  chanceProbability,
  energyDrain,
  goalProbability,
} from './match/rules.ts';
