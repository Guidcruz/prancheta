/**
 * Public API of the engine (docs/02-architecture.md, 4.1). Everything outside `engine/` imports
 * from here. The simulation functions are added by the tasks that implement them (T-002+).
 */
export { ENGINE_VERSION } from './version.ts';
export { Rng, seedFromString } from './rng.ts';
export { PARAM_RANGES, SEASON_ROUNDS, SEASON_WEEKS, validateParams } from './params.ts';
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
export type {
  AiProfile,
  ClubId,
  ClubSize,
  EngineWarning,
  FixtureId,
  Formation,
  PlayerId,
  Position,
  Posture,
  Pressure,
  Result,
  Side,
  Trait,
} from './types.ts';
