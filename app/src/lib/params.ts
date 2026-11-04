import { validateParams, type GameParams, type ParamIssue } from '../engine/index.ts';
import match from '../params/match.json';
import players from '../params/players.json';
import generation from '../params/generation.json';
import ai from '../params/ai.json';
import season from '../params/season.json';
import fans from '../params/fans.json';

/*
 * Loads the game parameters bundled with the app (docs/02-architecture.md, 3 "Parâmetros"). The
 * engine never imports app/src/params/: the application passes the validated GameParams in.
 */

/** The six JSON files of app/src/params/, under their file names, before validation. */
export const rawParams: Readonly<Record<keyof GameParams, unknown>> = {
  match,
  players,
  generation,
  ai,
  season,
  fans,
};

/** Human-readable list of issues, for error messages and test output (not shown to players). */
export function formatParamIssues(issues: readonly ParamIssue[]): string {
  return issues
    .map((issue) => {
      const range = issue.range ? ` (range ${issue.range.min}..${issue.range.max})` : '';
      return `${issue.path || '(root)'}: ${issue.problem}, got ${String(issue.value)}${range}`;
    })
    .join('\n');
}

let cached: GameParams | undefined;

/**
 * The validated parameters of this build. The repository files are checked by a test in CI, so
 * an invalid set here is a programming error and throws.
 */
export function loadGameParams(): GameParams {
  if (cached) return cached;
  const result = validateParams(rawParams);
  if (!result.ok) {
    throw new Error(`Invalid app/src/params:\n${formatParamIssues(result.detail)}`);
  }
  cached = result.value;
  return cached;
}
