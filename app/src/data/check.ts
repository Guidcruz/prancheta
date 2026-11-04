/**
 * Full check of the club data of app/src/data/ (US-001; docs/02-architecture.md, 3 "Dados de
 * jogo"): the structural validator of the engine plus the two checks that need the host, the
 * SHA-256 blocklist of real names and the shield generator of lib/.
 *
 * Node-only (it hashes with node:crypto through ./blocklist.ts). It runs in Vitest and in
 * `npm run content:check`; the game in the browser loads data that already passed it in CI.
 */
import {
  BLOCKLIST_FIELDS,
  validateClubs,
  type BlocklistField,
  type ClubDef,
  type ClubIssue,
  type ClubProblem,
  type ValidateClubsOptions,
} from '../engine/index.ts';
import { shieldSpecFor, shieldSvg } from '../lib/generators/shield.ts';
import { hashName, parseBlocklist, type BlocklistProblem } from './blocklist.ts';

export type ClubDataProblem =
  ClubProblem | 'blocked-name' | 'shield-error' | `blocklist-${BlocklistProblem}`;

/** A {@link ClubIssue} of the engine, or one of the checks of this file. */
export interface ClubDataIssue extends Omit<ClubIssue, 'problem'> {
  problem: ClubDataProblem;
}

export type ClubDataResult =
  { ok: true; clubs: ClubDef[] } | { ok: false; issues: ClubDataIssue[] };

function readField(club: Record<string, unknown>, field: BlocklistField): unknown {
  if (field === 'stadium.name') {
    const stadium = club.stadium;
    return typeof stadium === 'object' && stadium !== null
      ? (stadium as Record<string, unknown>).name
      : undefined;
  }
  return club[field];
}

function tag(index: number, club: Record<string, unknown>): Pick<ClubIssue, 'index' | 'clubId'> {
  return typeof club.id === 'string' ? { index, clubId: club.id } : { index };
}

/**
 * Real names: `name`, `shortName`, `nickname` and `stadium.name` of every club are normalized
 * and hashed; a hash in the blocklist is an issue with club and field. The value is not
 * repeated in the issue beyond what the data file already holds.
 */
function checkBlockedNames(
  clubs: readonly unknown[],
  blocked: ReadonlySet<string>,
  issues: ClubDataIssue[],
): void {
  clubs.forEach((club, index) => {
    if (typeof club !== 'object' || club === null) return;
    const record = club as Record<string, unknown>;
    for (const field of BLOCKLIST_FIELDS) {
      const value = readField(record, field);
      if (typeof value === 'string' && blocked.has(hashName(value))) {
        issues.push({ ...tag(index, record), field, problem: 'blocked-name', value });
      }
    }
  });
}

/** The shield of the game for a club (lib/generators/shield.ts). */
export function renderClubShield(club: ClubDef): string {
  return shieldSvg(shieldSpecFor(club));
}

/** Every club must render its shield without error. On a valid list, index = position. */
function checkShields(
  clubs: readonly ClubDef[],
  render: (club: ClubDef) => string,
  issues: ClubDataIssue[],
): void {
  clubs.forEach((club, index) => {
    let svg: unknown;
    try {
      svg = render(club);
    } catch (error) {
      svg = error instanceof Error ? error.message : error;
    }
    if (typeof svg !== 'string' || !svg.startsWith('<svg ') || !svg.endsWith('</svg>')) {
      issues.push({ index, clubId: club.id, field: 'shield', problem: 'shield-error', value: svg });
    }
  });
}

export interface CheckClubDataOptions extends ValidateClubsOptions {
  /** Shield renderer; default {@link renderClubShield}. Tests replace it to prove a failure. */
  renderShield?: (club: ClubDef) => string;
}

/**
 * Checks a raw club list and a raw blocklist file together, listing every issue at once.
 * Never throws.
 */
export function checkClubData(
  rawClubs: unknown,
  rawBlocklist: unknown,
  options: CheckClubDataOptions = {},
): ClubDataResult {
  const issues: ClubDataIssue[] = [];
  const structure = validateClubs(rawClubs, options);
  if (!structure.ok) issues.push(...structure.detail);

  const blocklist = parseBlocklist(rawBlocklist);
  if (!blocklist.ok) {
    for (const issue of blocklist.issues) {
      issues.push({
        field: issue.index === undefined ? 'blocklist' : `blocklist.hashes.${issue.index}`,
        problem: `blocklist-${issue.problem}`,
      });
    }
  } else if (Array.isArray(rawClubs)) {
    // Runs on the raw list, so a real name is caught even in a club that is otherwise broken.
    checkBlockedNames(rawClubs, blocklist.hashes, issues);
  }

  if (structure.ok) checkShields(structure.value, options.renderShield ?? renderClubShield, issues);

  if (!structure.ok || issues.length > 0) return { ok: false, issues };
  return { ok: true, clubs: structure.value };
}

/** Human-readable list of issues, for test output and `npm run content:check`. */
export function formatClubIssues(issues: readonly ClubDataIssue[]): string {
  return issues
    .map((issue) => {
      const club = issue.clubId ?? (issue.index === undefined ? '(list)' : `#${issue.index}`);
      const field = issue.field === '' ? '' : ` ${issue.field}`;
      const other = issue.other === undefined ? '' : ` (with ${issue.other})`;
      const value = issue.value === undefined ? '' : `, got ${JSON.stringify(issue.value)}`;
      const range = issue.range ? ` (range ${issue.range.min}..${issue.range.max})` : '';
      return `${club}${field}: ${issue.problem}${other}${value}${range}`;
    })
    .join('\n');
}
