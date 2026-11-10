import type { Result } from './types.ts';

/*
 * Numeric parameters of the game (docs/02-architecture.md, 3 "Parâmetros" and 4.1; ADR-0007,
 * rule 4). The values live in app/src/params/*.json, one file per system, and enter every public
 * engine function as an argument; the engine never imports the JSON files. This module owns the
 * type, the valid range of every parameter and the validator that guards them.
 *
 * Names follow docs/design/*.md with the file as the first key: `match.baseChance` is
 * `match.json` › `baseChance`. The match document also owns `fatigue.*`, `injury.*` and `cards.*`;
 * they live inside match.json as nested groups (`match.fatigue.drainPerMinute`).
 */

/** app/src/params/match.json (docs/design/partida.md, "Parâmetros"). */
export interface MatchParams {
  readonly baseChance: number;
  readonly kChance: number;
  readonly conversion: number;
  readonly kFinish: number;
  readonly midWeight: number;
  readonly dayFormSd: number;
  /** Fixed home advantage on top of the fans (ADR-0011, option A: 0.05). */
  readonly homeBase: number;
  readonly missingPlayerPenalty: number;
  readonly penaltyShare: number;
  readonly freeKickShare: number;
  readonly assistShare: number;
  /**
   * "Tirar o pé" (partida.md, "Calibragem das goleadas"): a side leading by at least
   * `comfortableLeadGoals` creates chances with its `Power × comfortableLeadPower`. 1 turns it off.
   */
  readonly comfortableLeadGoals: number;
  readonly comfortableLeadPower: number;
  /**
   * "Tudo no ataque" (partida.md, "Táticas"; T-016): the `allOut` posture multiplies the attacking
   * power by `allOutPower` and the defence by `allOutDef`. The other postures are rule constants.
   */
  readonly allOutPower: number;
  readonly allOutDef: number;
  /**
   * The first minute "tudo no ataque" can be played (partida.md, "Táticas"; T-016): a command
   * that would put the side in `allOut` before it (a command of minute M plays from M + 1) is
   * ignored with `command-too-early`. 0 or 1 turns the rule off.
   */
  readonly allOutFromMinute: number;
  readonly fatigue: { readonly drainPerMinute: number; readonly recoveryPerDay: number };
  readonly injury: { readonly basePerMinute: number };
  readonly cards: {
    readonly yellowPerMinute: number;
    readonly redPerMinute: number;
    readonly derbyMult: number;
    /** A player who already has a yellow ("pendurado") gets the next one at this share of the rate. */
    readonly bookedMult: number;
  };
}

/** app/src/params/players.json (docs/design/jogadores.md, "Parâmetros"). */
export interface PlayersParams {
  readonly growthMin: number;
  readonly growthMax: number;
  /**
   * Chance of an outfield player having a secondary position when created
   * (docs/design/posicao-secundaria.md, "Parâmetros e limites"; ADR-0022).
   */
  readonly secondaryChance: number;
}

/** app/src/params/generation.json (docs/design/jogadores.md, "Parâmetros"). */
export interface GenerationParams {
  readonly clubStrengthSd: number;
}

/** app/src/params/ai.json (docs/design/ia-clubes.md, "Parâmetros"). */
export interface AiParams {
  readonly rotationCondition: number;
  readonly rotationMinRatio: number;
  readonly subEnergy: number;
  readonly tiredTeamCondition: number;
}

/** app/src/params/season.json (docs/design/temporada.md, "Parâmetros"). Weeks are 1-based. */
export interface SeasonParams {
  readonly fifaWeeks: readonly number[];
  readonly midweekWeeks: readonly number[];
}

/** app/src/params/fans.json (docs/design/torcida.md, "Parâmetros"). */
export interface FansParams {
  readonly homeBonusMin: number;
  readonly homeBonusMax: number;
  readonly derbyBonus: number;
  readonly moraleDrift: number;
  readonly start: number;
  readonly baseline: number;
  readonly resultWeight: number;
  readonly derbyResultMult: number;
  readonly reversion: number;
  readonly decisionCap: number;
  readonly baseOccupancy: number;
}

/**
 * Every numeric parameter of the game, one key per file of app/src/params/. Read-only all the
 * way down: the engine reads parameters and never changes them.
 */
export interface GameParams {
  readonly match: MatchParams;
  readonly players: PlayersParams;
  readonly generation: GenerationParams;
  readonly ai: AiParams;
  readonly season: SeasonParams;
  readonly fans: FansParams;
}

/** Valid range of a number parameter (inclusive on both ends). */
export interface NumberRange {
  kind: 'number';
  min: number;
  max: number;
  integer?: true;
}

/** Valid range of a list of integers that must be strictly increasing (week numbers). */
export interface IntListRange {
  kind: 'intList';
  min: number;
  max: number;
}

/** The range map mirrors GameParams exactly: a missing or extra key is a compile error. */
export type ParamRanges<T> = T extends readonly number[]
  ? IntListRange
  : T extends number
    ? NumberRange
    : { readonly [K in keyof T]-?: ParamRanges<T[K]> };

const num = (min: number, max: number): NumberRange => ({ kind: 'number', min, max });
const int = (min: number, max: number): NumberRange => ({
  kind: 'number',
  min,
  max,
  integer: true,
});
/** A value fixed by an ADR: changing it is an ADR, not a parameter tweak. */
const fixed = (value: number): NumberRange => num(value, value);

/** Weeks in a Série A season (docs/design/temporada.md, "Datas"). */
export const SEASON_WEEKS = 34;
/** Rounds in a Série A season: 20 clubs, home and away. */
export const SEASON_ROUNDS = 38;

/**
 * Valid range of every parameter, copied from the "Faixa" column of the design documents.
 * Changing a range is a change in the design document first.
 */
export const PARAM_RANGES: ParamRanges<GameParams> = {
  match: {
    baseChance: num(0.03, 0.2),
    kChance: num(0.05, 0.4),
    conversion: num(0.05, 0.3),
    kFinish: num(0, 0.3),
    midWeight: num(0.3, 0.7),
    dayFormSd: num(0, 6),
    homeBase: num(0, 0.08), // ADR-0011
    missingPlayerPenalty: num(0.03, 0.12),
    penaltyShare: num(0, 0.05),
    freeKickShare: num(0, 0.15),
    assistShare: num(0, 1),
    // partida.md, "Calibragem das goleadas": the rule is for a lead of 2 or more; the factor
    // range is 0.7 to 1 (1 turns the rule off).
    comfortableLeadGoals: int(2, 5),
    comfortableLeadPower: num(0.7, 1),
    // partida.md, "Táticas": "tudo no ataque" goes further than the attacking posture (1.05 and
    // 0.95), so the power never goes below 1.05 and the defence never above 0.95.
    allOutPower: num(1.05, 1.5),
    allOutDef: num(0.6, 0.95),
    // partida.md, "Táticas": 0 (or 1) turns the rule off. At most 76: the /balance duel "0×1
    // after 75'" sends "todo mundo no ataque" at minute 75 (it plays from 76), so a later minute
    // would turn that target into an ignored command; the AI and the robot (from 80') stay after.
    allOutFromMinute: int(0, 76),
    fatigue: { drainPerMinute: num(0.1, 0.6), recoveryPerDay: num(3, 15) },
    injury: { basePerMinute: num(0, 0.0005) },
    cards: {
      yellowPerMinute: num(0, 0.005),
      redPerMinute: num(0, 0.0002),
      derbyMult: num(1, 1.5),
      bookedMult: num(0, 1), // partida.md, "Calibragem dos vermelhos" (T-016)
    },
  },
  players: { growthMin: num(0.5, 1), growthMax: num(1, 1.5), secondaryChance: num(0, 0.5) },
  generation: { clubStrengthSd: num(0, 4) },
  ai: {
    rotationCondition: num(50, 95),
    rotationMinRatio: num(0.7, 1),
    subEnergy: num(50, 100),
    tiredTeamCondition: num(60, 100),
  },
  // temporada.md gives no range column: weeks must exist in the season, and the cross checks in
  // checkSeason() keep the calendar at exactly SEASON_ROUNDS rounds.
  season: {
    fifaWeeks: { kind: 'intList', min: 1, max: SEASON_WEEKS },
    midweekWeeks: { kind: 'intList', min: 1, max: SEASON_WEEKS },
  },
  fans: {
    // The first four are decisions of ADR-0005 (torcida.md): fixed, changing them is an ADR.
    homeBonusMin: fixed(0.02),
    homeBonusMax: fixed(0.08),
    derbyBonus: fixed(0.02),
    moraleDrift: fixed(1),
    start: num(30, 80),
    baseline: num(40, 70),
    resultWeight: num(1, 8),
    derbyResultMult: num(1, 3),
    reversion: num(0, 0.2),
    decisionCap: num(0, 10),
    baseOccupancy: num(0.3, 1),
  },
};

export type ParamProblem =
  | 'missing'
  | 'unknown-key'
  | 'not-an-object'
  | 'not-a-number'
  | 'not-an-integer'
  | 'out-of-range'
  | 'not-a-list'
  | 'not-increasing'
  | 'overlap'
  | 'round-count'
  /** A getter or Proxy trap threw while reading the input. */
  | 'unreadable';

/** One reason why a parameter set was refused. `path` is dotted from the root (`match.kChance`). */
export interface ParamIssue {
  path: string;
  problem: ParamProblem;
  value: unknown;
  range?: { min: number; max: number };
}

/** Result of {@link validateParams}: a `Result<GameParams, 'invalid-params'>` with typed detail. */
type ParamsBase = Result<GameParams, 'invalid-params'>;
export type ParamsResult =
  | Extract<ParamsBase, { ok: true }>
  | (Extract<ParamsBase, { ok: false }> & { detail: ParamIssue[] });

type AnyRange = NumberRange | IntListRange | { readonly [key: string]: AnyRange };

function isRange(spec: AnyRange): spec is NumberRange | IntListRange {
  return typeof spec.kind === 'string';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkNumber(
  path: string,
  value: unknown,
  range: NumberRange,
  issues: ParamIssue[],
): number | undefined {
  const bounds = { min: range.min, max: range.max };
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issues.push({ path, problem: 'not-a-number', value, range: bounds });
    return undefined;
  }
  if (range.integer && !Number.isInteger(value)) {
    issues.push({ path, problem: 'not-an-integer', value, range: bounds });
    return undefined;
  }
  if (value < range.min || value > range.max) {
    issues.push({ path, problem: 'out-of-range', value, range: bounds });
    return undefined;
  }
  return value;
}

function checkIntList(
  path: string,
  value: unknown,
  range: IntListRange,
  issues: ParamIssue[],
): number[] | undefined {
  if (!Array.isArray(value)) {
    issues.push({ path, problem: 'not-a-list', value });
    return undefined;
  }
  const before = issues.length;
  const item: NumberRange = { kind: 'number', min: range.min, max: range.max, integer: true };
  const list: number[] = [];
  // Indexed loop, so holes of a sparse array are checked (as undefined) instead of skipped.
  for (let i = 0; i < value.length; i++) {
    const checked = checkNumber(`${path}.${i}`, value[i] as unknown, item, issues);
    if (checked !== undefined) list.push(checked);
  }
  if (issues.length > before) return undefined;
  for (let i = 1; i < list.length; i++) {
    if (list[i]! <= list[i - 1]!) {
      issues.push({ path: `${path}.${i}`, problem: 'not-increasing', value: list[i] });
      return undefined;
    }
  }
  return list;
}

function checkNode(
  path: string,
  value: unknown,
  spec: AnyRange,
  issues: ParamIssue[],
): unknown | undefined {
  if (isRange(spec)) {
    return spec.kind === 'number'
      ? checkNumber(path, value, spec, issues)
      : checkIntList(path, value, spec, issues);
  }
  if (!isPlainObject(value)) {
    issues.push({ path, problem: 'not-an-object', value });
    return undefined;
  }
  const prefix = path === '' ? '' : `${path}.`;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(spec)) {
    const childPath = `${prefix}${key}`;
    if (!Object.hasOwn(value, key)) {
      issues.push({ path: childPath, problem: 'missing', value: undefined });
      continue;
    }
    out[key] = checkNode(childPath, value[key], spec[key]!, issues);
  }
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(spec, key)) {
      issues.push({ path: `${prefix}${key}`, problem: 'unknown-key', value: value[key] });
    }
  }
  return out;
}

/**
 * Calendar rules that cross two parameters (docs/design/temporada.md, "Datas"): a FIFA week has
 * no midweek round, and the weekend rounds plus the midweek rounds make exactly SEASON_ROUNDS.
 */
function checkSeason(season: SeasonParams, issues: ParamIssue[]): void {
  const fifa = new Set(season.fifaWeeks);
  const clash = season.midweekWeeks.find((week) => fifa.has(week));
  if (clash !== undefined) {
    issues.push({ path: 'season.midweekWeeks', problem: 'overlap', value: clash });
  }
  const rounds = SEASON_WEEKS - season.fifaWeeks.length + season.midweekWeeks.length;
  if (rounds !== SEASON_ROUNDS) {
    issues.push({
      path: 'season',
      problem: 'round-count',
      value: rounds,
      range: { min: SEASON_ROUNDS, max: SEASON_ROUNDS },
    });
  }
}

/**
 * Checks a raw parameter set (the six JSON files under their file names) against
 * {@link PARAM_RANGES}. Refuses missing keys, unknown keys, non-finite numbers (NaN, Infinity),
 * non-integers where an integer is expected and anything out of range, listing every issue at
 * once. Never throws; on success returns a fresh copy that shares nothing with `raw`.
 */
export function validateParams(raw: unknown): ParamsResult {
  // A getter or Proxy trap that throws is input, not a programming error: never let it escape.
  try {
    return checkParams(raw);
  } catch {
    const detail: ParamIssue[] = [{ path: '', problem: 'unreadable', value: undefined }];
    return { ok: false, error: 'invalid-params', detail };
  }
}

function checkParams(raw: unknown): ParamsResult {
  const issues: ParamIssue[] = [];
  const value = checkNode('', raw, PARAM_RANGES as AnyRange, issues);
  const seasonShapeOk = !issues.some((i) => i.path === 'season' || i.path.startsWith('season.'));
  if (isPlainObject(value) && seasonShapeOk) checkSeason(value.season as SeasonParams, issues);
  if (issues.length > 0) return { ok: false, error: 'invalid-params', detail: issues };
  return { ok: true, value: value as GameParams, warnings: [] };
}
