import { describe, expect, it } from 'vitest';
import { suggestSheet, validateLineup } from './ai.ts';
import { completeSheet, reshapeLineup, sheetProblems, sheetRoles } from './draft.ts';
import { FORMATIONS } from './formations.ts';
import { draftFromSheet, type DraftLineup } from './lineup.ts';
import { changeFormation, kickoffTeam } from './match/team.ts';
import { Rng, seedFromString } from './rng.ts';
import { GOALKEEPER_SLOT, isAvailable } from './strength.ts';
import { drawnDraft, drawnState, drawnTeamSheet } from './testing/draft.ts';
import { teamInputFrom, testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';
import type { PlayerId } from './types.ts';

/*
 * Properties of the readings of the sheet being edited (docs/02-architecture.md, 4.1, "Ficha em
 * edição e leituras para a escalação"; T-076):
 * - reshapeLineup, for each of the 6 × 6 pairs and 0 to 11 occupied slots: never throws, keeps the
 *   same ids, the goalkeeper stays in goal, 11 − occupied free slots, deterministic; and the same
 *   slots as the match's changeFormation at kick-off (the shared rule);
 * - sheetProblems agrees with validateLineup for every team sheet with up to 11 starters and up
 *   to 7 reserves, and `ready` implies that completeSheet passes validateLineup;
 * - completeSheet always passes validateLineup when someone is available, never moves a player
 *   who can play, and keeps a ready sheet; deterministic;
 * - sheetRoles always names an available starter of the sheet, from the list when it says so.
 *
 * `PROPERTY_FULL=1` runs ten times more cases (before a release).
 */
const FULL = process.env.PROPERTY_FULL === '1';
const CASES = FULL ? 20_000 : 2_000;
const params = testParams();
const base = testGame();
const clubIds = Object.keys(base.clubs);

function caseRng(name: string, n: number): Rng {
  return new Rng(seedFromString(`draft-property-${name}-${n}`));
}

describe('reshapeLineup properties', () => {
  it('for every pair of formations and 0 to 11 occupied slots', () => {
    const failures: string[] = [];
    const rounds = FULL ? 20 : 3;
    for (let n = 0; n < rounds; n++) {
      const clubId = clubIds[n % clubIds.length]!;
      const rng = caseRng('reshape', n);
      const state = drawnState(base, clubId, rng, 0.3);
      for (const from of FORMATIONS) {
        const full = suggestSheet(state, params, clubId, undefined, {
          controller: 'human',
          formation: from,
        });
        const draft = draftFromSheet(full).lineup;
        for (let occupied = 0; occupied <= 11; occupied++) {
          // Free 11 − occupied random slots (the goal too, sometimes).
          const order = Array.from({ length: 11 }, (_, i) => i);
          for (let i = order.length - 1; i > 0; i--) {
            const j = rng.int(0, i);
            [order[i], order[j]] = [order[j]!, order[i]!];
          }
          const freed = new Set(order.slice(occupied));
          const lineup: DraftLineup = {
            ...draft,
            starters: draft.starters.map((id, i) => (freed.has(i) ? null : id)),
          };
          const ids = lineup.starters.filter((id): id is PlayerId => id !== null).sort();
          for (const to of FORMATIONS) {
            const label = `${clubId} ${from}->${to} occupied ${occupied}`;
            let result: DraftLineup;
            try {
              result = reshapeLineup(state, clubId, lineup, to);
            } catch (error) {
              failures.push(`${label}: threw ${String(error)}`);
              continue;
            }
            const after = result.starters.filter((id): id is PlayerId => id !== null).sort();
            if (JSON.stringify(after) !== JSON.stringify(ids)) failures.push(`${label}: ids`);
            if (result.starters.length !== 11) failures.push(`${label}: length`);
            if (result.starters.filter((id) => id === null).length !== 11 - occupied) {
              failures.push(`${label}: free slots`);
            }
            const keeper = lineup.starters[GOALKEEPER_SLOT];
            if (keeper !== null && result.starters[GOALKEEPER_SLOT] !== keeper) {
              failures.push(`${label}: goalkeeper`);
            }
            if (result.formation !== to) failures.push(`${label}: formation`);
            if (JSON.stringify(result.bench) !== JSON.stringify(lineup.bench)) {
              failures.push(`${label}: bench`);
            }
            const again = reshapeLineup(state, clubId, lineup, to);
            if (JSON.stringify(again) !== JSON.stringify(result)) failures.push(`${label}: det`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("moves players to the same slots as the match's changeFormation at kick-off", () => {
    const failures: string[] = [];
    for (let n = 0; n < (FULL ? 200 : 20); n++) {
      const clubId = clubIds[n % clubIds.length]!;
      const rng = caseRng('match', n);
      // Everyone available: the kick-off then replaces nobody, and the energy is the condition.
      const state = drawnState(base, clubId, rng, 0);
      const squad = state.squads[clubId]!.map((id) => state.players[id]!);
      for (const from of FORMATIONS) {
        const { lineup } = suggestSheet(state, params, clubId, undefined, {
          controller: 'human',
          formation: from,
        });
        // The match leaves the last slots empty for a shorter list (7 to 11 on the pitch).
        const onPitch = rng.int(7, 11);
        const starters = lineup.starters.slice(0, onPitch);
        const draft = draftFromSheet({
          lineup: { ...lineup, starters, bench: [] },
          tactic: { posture: 'balanced', pressure: 'medium' },
        }).lineup;
        for (const to of FORMATIONS) {
          if (to === from) continue;
          const team = kickoffTeam(
            'home',
            teamInputFrom(clubId, squad, { formation: from, starters, bench: [] }),
            [],
          );
          changeFormation(team, to);
          const inMatch = team.slots.map((slot) => slot.app?.player.id ?? null);
          const before = reshapeLineup(state, clubId, draft, to).starters;
          if (JSON.stringify(inMatch) !== JSON.stringify(before)) {
            failures.push(`${clubId} ${from}->${to} with ${onPitch}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('sheetProblems and validateLineup', () => {
  it(`agree on every team sheet, and ready completes to a valid sheet (${CASES} cases)`, () => {
    const failures: string[] = [];
    let ready = 0;
    for (let n = 0; n < CASES; n++) {
      const rng = caseRng('agree', n);
      const clubId = clubIds[rng.int(0, clubIds.length - 1)]!;
      // Sometimes nobody, often fewer than 11 available.
      const state = drawnState(base, clubId, rng, rng.next() < 0.1 ? 1.2 : 0.6);
      const sheet = drawnTeamSheet(state, clubId, rng);
      const valid = validateLineup(state, clubId, sheet).ok;
      const draft = draftFromSheet(sheet);
      const check = sheetProblems(state, clubId, draft);
      if (valid !== check.ready) {
        failures.push(`case ${n}: validateLineup ${valid}, ready ${check.ready}`);
      }
      if (check.ready) {
        ready += 1;
        const completed = completeSheet(state, clubId, draft);
        if (!validateLineup(state, clubId, completed).ok) failures.push(`case ${n}: completed`);
      }
      if (check.ready !== (check.problems.length === 0)) failures.push(`case ${n}: ready`);
      const available = state.squads[clubId]!.filter((id) => isAvailable(state.players[id]!));
      if (check.available !== available.length) failures.push(`case ${n}: available`);
    }
    expect(failures).toEqual([]);
    // Both sides of the equivalence are exercised.
    expect(ready).toBeGreaterThan(CASES / 10);
    expect(ready).toBeLessThan(CASES - CASES / 10);
  });
});

describe('completeSheet properties', () => {
  it(`passes validateLineup, keeps who can play and a ready sheet (${CASES} drafts)`, () => {
    const failures: string[] = [];
    for (let n = 0; n < CASES; n++) {
      const rng = caseRng('complete', n);
      const clubId = clubIds[rng.int(0, clubIds.length - 1)]!;
      const state = drawnState(base, clubId, rng, rng.next() < 0.1 ? 1.2 : 0.6);
      const sheet = drawnDraft(state, clubId, rng);
      const result = completeSheet(state, clubId, sheet);
      const available = state.squads[clubId]!.filter((id) => isAvailable(state.players[id]!));
      const label = `case ${n} (${available.length} available)`;
      if (available.length > 0 && !validateLineup(state, clubId, result).ok) {
        failures.push(`${label}: ${JSON.stringify(validateLineup(state, clubId, result))}`);
      }
      if (JSON.stringify(completeSheet(state, clubId, sheet)) !== JSON.stringify(result)) {
        failures.push(`${label}: not deterministic`);
      }
      const onPitch = new Set(result.lineup.starters);
      for (const list of ['captains', 'penaltyTakers', 'freeKickTakers'] as const) {
        if (!result.lineup[list].every((id) => onPitch.has(id))) failures.push(`${label}: ${list}`);
      }
      if (JSON.stringify(result.tactic) !== JSON.stringify(sheet.tactic)) {
        failures.push(`${label}: tactic`);
      }
      if (available.length < 11) {
        if (result.lineup.starters.length !== available.length) failures.push(`${label}: few`);
        continue;
      }
      // Nobody who can play moves: each first occurrence of an available player of the squad.
      const seen = new Set<PlayerId>();
      sheet.lineup.starters.forEach((id, i) => {
        if (id === null || seen.has(id)) return;
        seen.add(id);
        if (available.includes(id) && result.lineup.starters[i] !== id) {
          failures.push(`${label}: slot ${i} moved`);
        }
      });
      const benchSize = Math.min(7, available.length - 11);
      if (result.lineup.bench.length !== benchSize) failures.push(`${label}: bench size`);
      if (sheetProblems(state, clubId, sheet).ready) {
        if (JSON.stringify(result.lineup.starters) !== JSON.stringify(sheet.lineup.starters)) {
          failures.push(`${label}: ready starters`);
        }
        const kept = sheet.lineup.bench.filter((id): id is PlayerId => id !== null);
        const prefix = result.lineup.bench.slice(0, kept.length);
        if (JSON.stringify(prefix) !== JSON.stringify(kept)) failures.push(`${label}: ready bench`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('sheetRoles properties', () => {
  it(`names an available starter of the sheet, from the list when not automatic (${CASES} drafts)`, () => {
    const failures: string[] = [];
    for (let n = 0; n < CASES; n++) {
      const rng = caseRng('roles', n);
      const clubId = clubIds[rng.int(0, clubIds.length - 1)]!;
      const state = drawnState(base, clubId, rng);
      const { lineup } = drawnDraft(state, clubId, rng);
      const squad = new Set(state.squads[clubId]);
      const candidates = lineup.starters.filter(
        (id): id is PlayerId => id !== null && squad.has(id) && isAvailable(state.players[id]!),
      );
      const roles = sheetRoles(state, clubId, lineup);
      const lists = {
        captain: lineup.captains,
        penalty: lineup.penaltyTakers,
        freeKick: lineup.freeKickTakers,
      } as const;
      for (const role of ['captain', 'penalty', 'freeKick'] as const) {
        const holder = roles[role];
        const label = `case ${n} ${role}`;
        if (candidates.length === 0) {
          if (holder.player !== undefined || !holder.auto) failures.push(`${label}: no one`);
          continue;
        }
        if (holder.player === undefined || !candidates.includes(holder.player)) {
          failures.push(`${label}: not a candidate`);
        }
        const first = lists[role].find((id) => candidates.includes(id));
        if (holder.auto !== (first === undefined)) failures.push(`${label}: auto`);
        if (first !== undefined && holder.player !== first) failures.push(`${label}: first`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('is the formation-free reading: same roles for every formation of the same starters', () => {
    const state = drawnState(base, clubIds[4]!, new Rng(23), 0);
    const { lineup } = drawnDraft(state, clubIds[4]!, new Rng(29));
    const roles = FORMATIONS.map((formation) =>
      sheetRoles(state, clubIds[4]!, { ...lineup, formation }),
    );
    for (const r of roles) expect(r).toEqual(roles[0]);
  });
});
