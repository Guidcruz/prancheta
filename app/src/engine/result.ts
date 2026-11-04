import type { EngineWarning, Result } from './types.ts';

/** Successful result, optionally carrying warnings about what the engine resolved on its own. */
export function ok<T>(value: T, warnings: EngineWarning[] = []): Result<T, never> {
  return { ok: true, value, warnings };
}

/** Failed result with a typed error code; `detail` is for diagnostics only. */
export function fail<E extends string>(error: E, detail?: unknown): Result<never, E> {
  return detail === undefined ? { ok: false, error } : { ok: false, error, detail };
}
