import type { GameParams } from '../../engine/index.ts';
import { sha256Hex } from '../save/index.ts';

/*
 * `paramsHash` of the save (docs/02-architecture.md, 3, "Parâmetros", and 4.2): the SHA-256 of the
 * canonical JSON of the parameters, for diagnostics only. Canonical: object keys sorted, no
 * spaces, arrays in their order.
 */

/** The JSON of `value` with the keys of every object sorted. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.keys(value)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      );
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Lowercase hex SHA-256 of the canonical JSON of `params`; needs `crypto.subtle`. */
export function paramsHash(params: GameParams): Promise<string> {
  return sha256Hex(new TextEncoder().encode(canonicalJson(params)));
}
