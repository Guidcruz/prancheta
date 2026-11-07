import { describe, expect, it } from 'vitest';
import {
  BENCH_SIZE,
  Rng,
  draftFromSheet,
  endSeason,
  startNextSeason,
  suggestSheet,
  type DraftSheet,
  type GameState,
  type PlayerId,
} from '../../engine/index.ts';
import { gameIdentitySource } from '../generators/identity.ts';
import { loadGameParams } from '../params.ts';
import { parseDraft } from '../save/index.ts';
import { sampleCareerSave } from '../save/testing/sample.ts';
import { ROLE_LIST_MAX, reconcileDraft } from './draft.ts';

/*
 * The reconciliation of the coach's sheet with the squad (ADR-0021, items 2 and 5;
 * docs/02-architecture.md, 4.2, "Ficha do técnico"; T-075): who left the squad becomes a free slot
 * and leaves the lists; the injured and the suspended stay; at the season turn the sheet stays
 * (option A of the CEO), and who retired becomes a free slot.
 */

const params = loadGameParams();
const identities = gameIdentitySource();
const played = sampleCareerSave({ rounds: 38 });
const game = played.game;
const clubId = played.career.clubId;
const squad = game.squads[clubId]!;
const otherClub = Object.keys(game.squads).find((id) => id !== clubId)!;
const stranger = game.squads[otherClub]![0]!;

function draftOf(starters: (PlayerId | null)[], bench: (PlayerId | null)[] = []): DraftSheet {
  return {
    lineup: {
      formation: '4-4-2',
      starters,
      bench,
      captains: [],
      penaltyTakers: [],
      freeKickTakers: [],
    },
    tactic: { posture: 'defensive', pressure: 'low' },
  };
}

const xi = squad.slice(0, 11);
const reserves = squad.slice(11, 18);

describe('reconcileDraft (ADR-0021)', () => {
  it('keeps a coherent sheet as it is', () => {
    const draft = draftOf(xi, reserves);
    expect(reconcileDraft(game, clubId, draft)).toEqual(draft);
  });

  it('turns an id out of the squad into a free slot, in the 11 and on the bench', () => {
    const starters = [...xi];
    starters[4] = stranger;
    const bench = [...reserves];
    bench[1] = 'nobody#1';
    const out = reconcileDraft(game, clubId, draftOf(starters, bench));
    expect(out.lineup.starters[4]).toBeNull();
    expect(out.lineup.bench[1]).toBeNull();
    expect(out.lineup.starters.filter((id) => id === null)).toHaveLength(1);
  });

  it('turns the second time an id appears into a free slot (the 11 first, then the bench)', () => {
    const starters = [...xi];
    starters[9] = xi[2]!;
    const bench = [xi[0]!, ...reserves.slice(1)];
    const out = reconcileDraft(game, clubId, draftOf(starters, bench));
    expect(out.lineup.starters[2]).toBe(xi[2]);
    expect(out.lineup.starters[9]).toBeNull();
    expect(out.lineup.bench[0]).toBeNull();
  });

  it('always has 11 starters and fills the bench with null up to 7', () => {
    const out = reconcileDraft(game, clubId, draftOf(xi.slice(0, 8), reserves.slice(0, 2)));
    expect(out.lineup.starters).toEqual([...xi.slice(0, 8), null, null, null]);
    expect(out.lineup.bench).toEqual([...reserves.slice(0, 2), null, null, null, null, null]);
    expect(out.lineup.bench).toHaveLength(BENCH_SIZE);
  });

  it('keeps in the lists only starters left, without repeats, at most 3, in their order', () => {
    const starters = [...xi];
    starters[6] = stranger;
    const draft: DraftSheet = {
      ...draftOf(starters, reserves),
      lineup: {
        ...draftOf(starters, reserves).lineup,
        captains: [stranger, xi[3]!, reserves[0]!, xi[3]!, xi[1]!, xi[8]!, xi[9]!],
        penaltyTakers: [xi[10]!, xi[6]!],
        freeKickTakers: [reserves[2]!],
      },
    };
    const out = reconcileDraft(game, clubId, draft);
    expect(out.lineup.captains).toEqual([xi[3], xi[1], xi[8]]);
    expect(out.lineup.captains).toHaveLength(ROLE_LIST_MAX);
    // xi[6] was the slot of the stranger: no longer on the pitch.
    expect(out.lineup.penaltyTakers).toEqual([xi[10]]);
    expect(out.lineup.freeKickTakers).toEqual([]);
  });

  it('keeps the injured and the suspended where they are, the formation and the tactic', () => {
    const injured = xi[5]!;
    const suspended = reserves[3]!;
    const hurt: GameState = {
      ...game,
      players: {
        ...game.players,
        [injured]: { ...game.players[injured]!, injuryRounds: 4 },
        [suspended]: { ...game.players[suspended]!, suspendedGames: 2 },
      },
    };
    const draft: DraftSheet = {
      ...draftOf(xi, reserves),
      lineup: { ...draftOf(xi, reserves).lineup, formation: '3-4-3', captains: [injured] },
      tactic: { posture: 'attacking', pressure: 'high' },
    };
    const out = reconcileDraft(hurt, clubId, draft);
    expect(out).toEqual(draft);
    expect(out.lineup.starters[5]).toBe(injured);
    expect(out.lineup.bench[3]).toBe(suspended);
  });

  it('for a club without a squad, every slot is free', () => {
    const out = reconcileDraft(game, 'no-such-club', draftOf(xi, reserves));
    expect(out.lineup.starters.every((id) => id === null)).toBe(true);
    expect(out.lineup.bench.every((id) => id === null)).toBe(true);
  });

  it('is pure and idempotent, and its output always passes parseDraft (random edits)', () => {
    const rng = new Rng(75);
    const pool = [...squad, ...game.squads[otherClub]!.slice(0, 5), 'nobody#9'];
    const pick = (): PlayerId | null =>
      rng.next() < 0.2 ? null : pool[Math.floor(rng.next() * pool.length)]!;
    const list = (): PlayerId[] =>
      Array.from(
        { length: Math.floor(rng.next() * 6) },
        () => pool[Math.floor(rng.next() * pool.length)]!,
      );
    for (let k = 0; k < 300; k++) {
      const draft: DraftSheet = {
        lineup: {
          formation: '4-3-3',
          starters: Array.from({ length: 11 }, pick),
          bench: Array.from({ length: Math.floor(rng.next() * 8) }, pick),
          captains: list(),
          penaltyTakers: list(),
          freeKickTakers: list(),
        },
        tactic: { posture: 'balanced', pressure: 'medium' },
      };
      const before = structuredClone(draft);
      const once = reconcileDraft(game, clubId, draft);
      expect(draft).toEqual(before);
      expect(reconcileDraft(game, clubId, once)).toEqual(once);
      const parsed = parseDraft(JSON.parse(JSON.stringify(once)), squad);
      expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    }
  });
});

describe('the season turn (ADR-0021, item 5; option A of the CEO)', () => {
  const ended = endSeason(game, params, [clubId], identities);
  if (!ended.ok) throw new Error(ended.error);
  const atEnd = ended.value.state;
  // The club with the most players gone: the test needs at least one who retired.
  const club = Object.keys(game.squads)
    .map((id) => ({
      id,
      gone: game.squads[id]!.filter((p) => !atEnd.squads[id]!.includes(p)),
    }))
    .sort((a, b) => b.gone.length - a.gone.length)[0]!;
  const before = game.squads[club.id]!;

  /** A sheet with every retiree of the club in it: on the pitch, on the bench and in the lists. */
  function sheetWithRetirees(): DraftSheet {
    const suggested = draftFromSheet(
      suggestSheet(game, params, club.id, undefined, { controller: 'human' }),
    );
    const starters = [...suggested.lineup.starters];
    const bench = [...suggested.lineup.bench];
    const placed = new Set([...starters, ...bench]);
    const missing = club.gone.filter((p) => !placed.has(p));
    // The ones not chosen go to the first starters' slots and to the bench.
    missing.forEach((p, i) => {
      if (i % 2 === 0) starters[i] = p;
      else bench[i] = p;
    });
    const onPitch = starters.filter((p): p is PlayerId => p !== null);
    const retiredOnPitch = club.gone.filter((p) => onPitch.includes(p));
    return {
      lineup: {
        ...suggested.lineup,
        starters,
        bench,
        captains: [...retiredOnPitch, ...onPitch].slice(0, 3),
        penaltyTakers: [...retiredOnPitch.slice(0, 1), ...onPitch.slice(-2)],
        freeKickTakers: onPitch.slice(0, 2),
      },
      tactic: { posture: 'attacking', pressure: 'low' },
    };
  }

  it('the club has retirees, out of the squad at the end of the season but still players', () => {
    expect(club.gone.length).toBeGreaterThan(0);
    const campaign = ended.value.summary.campaigns[club.id];
    for (const id of club.gone) {
      expect(atEnd.squads[club.id]).not.toContain(id);
      if (campaign !== undefined) expect(campaign.farewells).toContain(id);
    }
  });

  it('who retired becomes a free slot and leaves the lists, in the snapshot of the season end', () => {
    const draft = sheetWithRetirees();
    const out = reconcileDraft(atEnd, club.id, draft);
    const gone = new Set(club.gone);
    for (const [part, ids] of [
      ['starters', draft.lineup.starters],
      ['bench', draft.lineup.bench],
    ] as const) {
      ids.forEach((id, i) => {
        const kept = out.lineup[part][i];
        if (id !== null && gone.has(id)) expect(kept, `${part} ${i}`).toBeNull();
        else expect(kept, `${part} ${i}`).toBe(id);
      });
    }
    for (const list of [out.lineup.captains, out.lineup.penaltyTakers, out.lineup.freeKickTakers]) {
      expect(list.some((id) => gone.has(id))).toBe(false);
    }
    // The formation and the tactic stay; who is still in the squad stays where he was.
    expect(out.lineup.formation).toBe(draft.lineup.formation);
    expect(out.tactic).toEqual(draft.tactic);
    expect(parseDraft(out, atEnd.squads[club.id]!).ok).toBe(true);
    expect(parseDraft(draft, atEnd.squads[club.id]!).ok).toBe(false);
  });

  it('startNextSeason keeps the sheet (option A): no change, and no youngster enters by himself', () => {
    const atEndSheet = reconcileDraft(atEnd, club.id, sheetWithRetirees());
    const next = startNextSeason(atEnd, params, identities);
    if (!next.ok) throw new Error(next.error);
    const season2 = next.value;
    const promoted = season2.squads[club.id]!.filter((p) => !before.includes(p));
    expect(promoted.length).toBeGreaterThan(0);
    const out = reconcileDraft(season2, club.id, atEndSheet);
    expect(out).toEqual(atEndSheet);
    const ids = new Set([...out.lineup.starters, ...out.lineup.bench]);
    for (const p of promoted) expect(ids.has(p)).toBe(false);
    // The free slots are those of who retired: "Escalação incompleta" on the first screen.
    expect(out.lineup.starters.filter((id) => id === null).length).toBeGreaterThan(0);
    expect(parseDraft(out, season2.squads[club.id]!).ok).toBe(true);
  });
});
