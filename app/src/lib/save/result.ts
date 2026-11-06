/**
 * Typed result of the save layer: a game or storage situation (corruption, a full disk, the
 * career limit) is never thrown, it comes back as a stable error code that the application maps
 * to a key in `content/` (docs/02-architecture.md, 5, "Erros"). `detail` is for diagnostics and
 * never carries the content of a save nor the coach's name.
 */
export type SaveResult<T, E extends string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E; readonly detail?: unknown };

export function ok<T>(value: T): SaveResult<T, never> {
  return { ok: true, value };
}

export function fail<E extends string>(error: E, detail?: unknown): SaveResult<never, E> {
  return detail === undefined ? { ok: false, error } : { ok: false, error, detail };
}
