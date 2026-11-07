import { describe, expect, it } from 'vitest';
import {
  FORMATIONS,
  Rng,
  draftFromSheet,
  suggestSheet,
  type DraftSheet,
  type GameState,
  type PlayerId,
  type Tactic,
} from '../../engine/index.ts';
import { reconcileDraft } from '../career/draft.ts';
import { loadGameParams } from '../params.ts';
import type { CareerSave } from './schema.ts';
import { playedCareer } from './testing/sample.ts';
import { parseCareerSave, parseDraft } from './validate.ts';

/*
 * The invariant of the check levels (docs/02-architecture.md, 4.2, "Níveis de conferência do
 * esquema", condition 1): what the write accepts, the opening accepts. The write reads of the
 * engine's part (`game`, `career.lastRound`) only what the store needs, so the engine's output
 * must pass the full schema; this property test is what guarantees it. Each save, with the recap
 * of its round and every sheet of the season so far, passes `full`, and the same save passes
 * `open` and `write`.
 *
 * With the coach's draft sheet (format v2, ADR-0021, item 7; T-075): at every point the sheet of
 * the point before is reconciled with the new state (so a player who retired at the turn is a free
 * slot by the end of the season) and checked, then edited at random (free slots, injured and
 * suspended players, other clubs' players, repeats, lists, formation, tactic), reconciled as the
 * `CareerService` does before every write, and checked again: each save in the three levels and
 * each sheet in `parseDraft` against the coach's squad.
 *
 * Normal run: 3 seeds × both realisms, after rounds 1, 10, 20, 30 and 38, at the end of the
 * season and after round 1 of season 2 (42 saves). `PROPERTY_FULL=1`: 100 seeds × both
 * realisms and every round of season 1, its end and round 1 of season 2 (8,000 saves):
 * `PROPERTY_FULL=1 npm test -w app -- src/lib/save/engine-output.property.test.ts`.
 */

const FULL = process.env.PROPERTY_FULL === '1';
const SEEDS = FULL ? Array.from({ length: 100 }, (_, i) => 1 + i * 7919) : [1, 2026, 424242];
const CHECKPOINTS = new Set<number | 'end'>([1, 10, 20, 30, 38, 'end']);
const at = (season: number, round: number | 'end') =>
  season === 2 || FULL || CHECKPOINTS.has(round);

const params = loadGameParams();
const TACTICS: readonly Tactic[] = (['defensive', 'balanced', 'attacking'] as const).flatMap(
  (posture) => (['low', 'medium', 'high'] as const).map((pressure) => ({ posture, pressure })),
);

/** Random edits of the coach on `draft` (the suggestion when there is none), not reconciled. */
function edit(rng: Rng, game: GameState, clubId: string, draft: DraftSheet | undefined) {
  const squad = game.squads[clubId]!;
  const others = Object.entries(game.squads).flatMap(([id, ids]) => (id === clubId ? [] : ids));
  const start =
    draft ?? draftFromSheet(suggestSheet(game, params, clubId, undefined, { controller: 'human' }));
  const starters = [...start.lineup.starters];
  const bench = [...start.lineup.bench];
  let { formation } = start.lineup;
  let tactic = start.tactic;
  const lists = {
    captains: [...start.lineup.captains],
    penaltyTakers: [...start.lineup.penaltyTakers],
    freeKickTakers: [...start.lineup.freeKickTakers],
  };
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rng.next() * items.length)]!;
  const player = (): PlayerId => (rng.next() < 0.15 ? pick(others) : pick(squad));
  const slot = (size: number) => Math.floor(rng.next() * size);
  for (let k = 1 + Math.floor(rng.next() * 6); k > 0; k--) {
    const op = Math.floor(rng.next() * 7);
    if (op === 0) starters[slot(11)] = null;
    else if (op === 1) bench[slot(7)] = null;
    else if (op === 2) starters[slot(11)] = player();
    else if (op === 3) bench[slot(7)] = player();
    else if (op === 4) formation = pick(FORMATIONS);
    else if (op === 5) tactic = pick(TACTICS);
    else {
      const list = pick(['captains', 'penaltyTakers', 'freeKickTakers'] as const);
      lists[list] = Array.from({ length: Math.floor(rng.next() * 6) }, player);
    }
  }
  return { lineup: { formation, starters, bench, ...lists }, tactic };
}

/** The save with its sheet in the three levels, and the sheet in `parseDraft`. */
function check(label: string, save: CareerSave): void {
  // As the store reads it back: JSON, then the levels.
  const stored: unknown = JSON.parse(JSON.stringify(save));
  for (const level of ['full', 'open', 'write'] as const) {
    const parsed = parseCareerSave(stored, { check: level, careerId: save.careerId });
    if (!parsed.ok) throw new Error(`${label} ${level}: ${JSON.stringify(parsed.detail)}`);
  }
  const sheet = parseDraft((stored as CareerSave).career.draft, save.game, save.career.clubId);
  if (!sheet.ok) throw new Error(`${label} parseDraft: ${JSON.stringify(sheet.detail)}`);
}

describe("the engine's output passes the strict schema (property, invariant of the levels)", () => {
  const cases = SEEDS.flatMap((seed) =>
    (['full', 'simplified'] as const).map((realism) => [seed, realism] as const),
  );

  it.each(cases)(
    'seed %i, realism %s: every save passes full, open and write',
    (seed, realism) => {
      const labels: string[] = [];
      const rng = new Rng(seed);
      let draft: DraftSheet | undefined;
      let free = 0;
      for (const { label, save } of playedCareer({ seed, realism, club: seed % 20 }, at)) {
        labels.push(label);
        const { game, career } = save;
        const withDraft = (sheet: DraftSheet): CareerSave => ({
          ...save,
          career: { ...career, draft: reconcileDraft(game, career.clubId, sheet) },
        });
        // The sheet of the point before, on this state (the squad may have changed at the turn).
        if (draft !== undefined) check(`${label} kept`, withDraft(draft));
        const next = withDraft(edit(rng, game, career.clubId, draft));
        check(label, next);
        draft = next.career.draft;
        free += draft!.lineup.starters.filter((id) => id === null).length;
        if (label !== 's1-end') expect(save.career.lastRound, label).toBeDefined();
      }
      expect(labels).toHaveLength(FULL ? 40 : 7);
      // The edits did leave free slots on the pitch along the way.
      expect(free).toBeGreaterThan(0);
    },
    FULL ? 600_000 : 60_000,
  );
});
