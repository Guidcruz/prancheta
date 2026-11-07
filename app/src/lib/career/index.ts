/*
 * The career, application layer (docs/02-architecture.md, 3): the interface talks to the career
 * only through here. The types of the save it shows come re-exported, so ui/ never imports
 * lib/save (lint).
 */
export { createCareerApp, type CareerApp } from './app.ts';
export {
  COACH_NAME_MAX,
  checkCoachName,
  type CoachNameCheck,
  type CoachNameProblem,
} from './coach-name.ts';
export { LAST_SETUP_KEY, parseLastSetup, type LastSetup, type NewGameClub } from './new-game.ts';
export { canonicalJson, paramsHash } from './params-hash.ts';
export {
  CareerService,
  roundBlock,
  seasonOver,
  summarySeasonOver,
  type CareerServiceOptions,
  type CareerSetup,
  type CareerState,
  type CreateError,
  type FatalCode,
  type PlayError,
  type PlayInput,
  type PlayedRound,
  type RoundBlock,
} from './service.ts';
export { MAX_CAREERS } from '../save/index.ts';
export type {
  CareerSave,
  CareerSummary,
  OpenError,
  StorageError,
  WriteError,
} from '../save/index.ts';
