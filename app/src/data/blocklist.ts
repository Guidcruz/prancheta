/**
 * Blocklist of real names, kept as SHA-256 hashes (docs/02-architecture.md, 3 "Dados de jogo";
 * US-001): the repository never holds a real club, stadium or nickname in clear text.
 *
 * Node-only (node:crypto). The hashes are checked in Vitest and `npm run content:check`, never in
 * the browser, and the same functions are used by scripts/hash-blocklist.mjs, which imports this
 * file straight from Node (type stripping, Node 22.18+). Keep it to erasable syntax and relative
 * imports with ".ts" only.
 */
import { createHash } from 'node:crypto';

/** Format of app/src/data/blocklist.sha256.json. */
export interface BlocklistFile {
  algorithm: 'sha256';
  normalization: typeof NORMALIZATION;
  /** Lowercase hex, sorted, no duplicates. */
  hashes: string[];
}

/** Recorded in the file, so a change in the rule below is visible in review. */
export const NORMALIZATION = 'nfd-strip-marks-lowercase-collapse-spaces';

const HASH = /^[0-9a-f]{64}$/;

/**
 * Lowercase, no accents (canonical decomposition, then the combining marks removed), runs of
 * whitespace collapsed to one space and trimmed: "  São   PAULO " → "sao paulo". Locale-free:
 * `toLowerCase` and `normalize` give the same output on every device.
 */
export function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** SHA-256 (hex) of the normalized name. */
export function hashName(name: string): string {
  return createHash('sha256').update(normalizeName(name), 'utf8').digest('hex');
}

/** Sorted, de-duplicated hashes of the names; names that normalize to "" are skipped. */
export function buildBlocklist(names: Iterable<string>): BlocklistFile {
  const hashes = new Set<string>();
  for (const name of names) {
    if (normalizeName(name) !== '') hashes.add(hashName(name));
  }
  return { algorithm: 'sha256', normalization: NORMALIZATION, hashes: [...hashes].sort() };
}

export type BlocklistProblem =
  | 'not-an-object'
  | 'wrong-algorithm'
  | 'wrong-normalization'
  | 'not-a-list'
  | 'invalid-hash'
  | 'not-sorted';

export interface BlocklistIssue {
  problem: BlocklistProblem;
  /** Position in `hashes`, when the issue is about one item. */
  index?: number;
}

/** Reads a parsed blocklist file; never throws. */
export function parseBlocklist(
  raw: unknown,
): { ok: true; hashes: ReadonlySet<string> } | { ok: false; issues: BlocklistIssue[] } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, issues: [{ problem: 'not-an-object' }] };
  }
  const file = raw as Record<string, unknown>;
  const issues: BlocklistIssue[] = [];
  if (file.algorithm !== 'sha256') issues.push({ problem: 'wrong-algorithm' });
  if (file.normalization !== NORMALIZATION) issues.push({ problem: 'wrong-normalization' });
  if (!Array.isArray(file.hashes)) {
    issues.push({ problem: 'not-a-list' });
    return { ok: false, issues };
  }
  const list = file.hashes as unknown[];
  for (let i = 0; i < list.length; i++) {
    const hash = list[i];
    if (typeof hash !== 'string' || !HASH.test(hash)) {
      issues.push({ problem: 'invalid-hash', index: i });
    } else if (i > 0 && typeof list[i - 1] === 'string' && hash <= (list[i - 1] as string)) {
      issues.push({ problem: 'not-sorted', index: i });
    }
  }
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, hashes: new Set(list as string[]) };
}
