/**
 * Shared engine types (docs/02-architecture.md, 4.1).
 *
 * Only erasable TypeScript syntax lives in the engine (no enums, namespaces or parameter
 * properties), so the same files run in Vite, in Node 22.18+ without a build step and in the
 * Wrangler bundle (ADR-0007, rule 6). Closed sets are string-literal unions, never enums.
 *
 * This file starts with the foundations (T-001). The bigger contracts arrive with the task that
 * implements them: GameParams (T-002), ClubDef (T-003), Player (T-005), MatchInput/MatchEvent/
 * MatchResult (T-009), MatchCommand (T-012), GameState/RoundReport/Fact (T-013).
 */

/**
 * Something the engine handled on its own but the caller should know about (for example, a
 * suspended player in a lineup replaced by the best substitute). Warnings never stop the
 * simulation and are part of saved results, so `detail` stays JSON-serialisable.
 */
export interface EngineWarning {
  /** Stable kebab-case code; the application layer maps it to a key in `content/`. */
  code: string;
  detail?: Readonly<Record<string, string | number | boolean | null>>;
}

/**
 * Typed result of every public engine function: the engine never throws because of a game
 * situation. A programming error (an impossible type) may throw and is a bug.
 */
export type Result<T, E extends string> =
  { ok: true; value: T; warnings: EngineWarning[] } | { ok: false; error: E; detail?: unknown };

/** Stable slug of a club definition, e.g. "tricolor-cerrado". */
export type ClubId = string;
/** Stable for the whole career: `${clubId}#${n}`. */
export type PlayerId = string;
/** `s${season}-r${round}-${homeId}-${awayId}`. */
export type FixtureId = string;

export type Position = 'GK' | 'CB' | 'FB' | 'DM' | 'AM' | 'ST';
export type Formation = '4-4-2' | '4-3-3' | '4-2-3-1' | '3-5-2' | '3-4-3' | '5-3-2';
/** `allOut` is only reachable through a match command. */
export type Posture = 'defensive' | 'balanced' | 'attacking' | 'allOut';
export type Pressure = 'low' | 'medium' | 'high';
export type Trait = 'leader' | 'hothead' | 'professional' | 'idol' | 'quiet';
export type ClubSize = 'big' | 'medium' | 'small';
export type AiProfile = 'ambitious' | 'academy' | 'seller' | 'traditional' | 'chaotic';
export type Side = 'home' | 'away';
