import { beforeAll, describe, expect, it } from 'vitest';
import {
  ENGINE_VERSION,
  endSeason,
  playRound,
  startNextSeason,
  type GameState,
  type Player,
  type PlayerId,
  type SeasonSummary,
} from '../../engine/index.ts';
import { decodeFace, FACE_COUNTS } from '../generators/face.ts';
import { gameIdentitySource } from '../generators/identity.ts';
import { loadGameParams } from '../params.ts';
import { newCareerGame } from './new-career.ts';
import { SAVE_SCHEMA_VERSION, type CareerSave } from './schema.ts';
import { SAMPLE_PARAMS_HASH, careerIdOf } from './testing/sample.ts';
import { store, useFreshDatabase } from './testing/idb.ts';
import { parseCareerSave } from './validate.ts';

/*
 * QA gate 2 of T-048 (minimal renewal of the squads, variable retirement), end to end: a career of
 * several seasons played through the real path (`playRound` / `endSeason` / `startNextSeason`
 * with the game's IdentitySource, the real club data and the bundled parameters), then saved and
 * reopened. The rule-by-rule cases (the table, one draw per player, the idol pick, the order of
 * the records, the ids of the academy) are in engine/season.test.ts, engine/generation.test.ts and
 * engine/properties.test.ts; these check what a person following the career would see.
 */

useFreshDatabase();

const params = loadGameParams();
const identities = gameIdentitySource();
const SEASONS = 7;
const GROUP = { GK: 3, CB: 5, FB: 4, DM: 4, AM: 4, ST: 5 } as const;
const SQUAD = 25;
const RETIRE_AT = 40;
const ACADEMY_AGE = 17;
const BALD = 0;
const RECEDING = 11;
const CROWN = 12;
const GREY = 7;
const WHITE = 8;

interface Turn {
  /** The state at round 39 of the season. */
  readonly finished: GameState;
  /** After `endSeason`: phase seasonEnd. */
  readonly closed: GameState;
  readonly summary: SeasonSummary;
  /** After `startNextSeason`: round 1 of the next season. */
  readonly next: GameState;
}

interface Career {
  readonly human: string;
  readonly baseSeason: number;
  readonly first: GameState;
  readonly turns: Turn[];
}

function playWhole(start: GameState, human: string): GameState {
  let state = start;
  while (state.phase === 'season' && state.round <= 38) {
    const r = playRound(state, params, {
      round: state.round,
      sheets: {},
      commands: {},
      fanDecisions: {},
      coaches: { [human]: 'result' },
    });
    if (!r.ok) throw new Error(`playRound ${state.round}: ${r.error}`);
    state = r.value.state;
  }
  return state;
}

function playCareer(seed: number, seasons: number): Career {
  const created = newCareerGame({ seed, realism: 'simplified' }, params, identities);
  if (!created.ok) throw new Error(`newCareerGame: ${created.error}`);
  const human = Object.keys(created.value.game.clubs)[0]!;
  const turns: Turn[] = [];
  let state = created.value.game;
  for (let season = 1; season <= seasons; season++) {
    const finished = playWhole(state, human);
    const closed = endSeason(finished, params, [human], identities);
    if (!closed.ok) throw new Error(`endSeason ${season}: ${closed.error}`);
    const next = startNextSeason(closed.value.state, params, identities);
    if (!next.ok) throw new Error(`startNextSeason ${season}: ${next.error}`);
    turns.push({
      finished,
      closed: closed.value.state,
      summary: closed.value.summary,
      next: next.value,
    });
    state = next.value;
  }
  return { human, baseSeason: created.value.baseSeason, first: created.value.game, turns };
}

/** Every id the summaries of `pastSeasons` mention. */
function summaryIds(summary: SeasonSummary): PlayerId[] {
  const { awards } = summary;
  const ids: PlayerId[] = [
    ...awards.topScorers.map((a) => a.playerId),
    ...awards.topAssists.map((a) => a.playerId),
  ];
  for (const c of Object.values(summary.campaigns)) {
    ids.push(...c.evolved.map((e) => e.playerId), ...c.farewells, ...c.academy);
  }
  return ids;
}

/** The squad checks of a `season`-phase state: 25, 3/5/4/4/4/5, one idol, a shirt each. */
function squadProblems(state: GameState): string[] {
  const out: string[] = [];
  for (const [clubId, ids] of Object.entries(state.squads)) {
    const squad = ids.map((id) => state.players[id]);
    if (squad.some((p) => p === undefined)) {
      out.push(`${clubId}: unknown player`);
      continue;
    }
    const players = squad as Player[];
    if (players.length !== SQUAD) out.push(`${clubId}: ${players.length} players`);
    for (const [position, n] of Object.entries(GROUP)) {
      const count = players.filter((p) => p.position === position).length;
      if (count !== n) out.push(`${clubId}: ${count} ${position}`);
    }
    if (players.filter((p) => p.trait === 'idol').length !== 1) out.push(`${clubId}: idols`);
    if (new Set(players.map((p) => p.shirt)).size !== players.length) out.push(`${clubId}: shirts`);
  }
  return out;
}

let career: Career;

beforeAll(() => {
  career = playCareer(4801, SEASONS);
}, 300_000);

describe('T-048: a career of several seasons through the real path', () => {
  it('runs on engine 15 or later; T-048 changed no format (v2 is the draft sheet of T-075)', () => {
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(15);
    expect(SAVE_SCHEMA_VERSION).toBe(2);
    expect(career.turns.at(-1)!.next.engineVersion).toBe(ENGINE_VERSION);
  });

  it('really renews: every season somebody leaves and the same number comes up (the campaign lists both)', () => {
    let retired = 0;
    for (const t of career.turns) {
      for (const [clubId, ids] of Object.entries(t.closed.squads)) {
        const left = t.finished.squads[clubId]!.filter((id) => !ids.includes(id));
        const came = ids.filter((id) => !t.finished.squads[clubId]!.includes(id));
        expect(came).toHaveLength(left.length);
        retired += left.length;
        const campaign = t.summary.campaigns[clubId];
        if (campaign !== undefined) {
          expect([...campaign.farewells].sort()).toEqual([...left].sort());
          expect([...campaign.academy].sort()).toEqual([...came].sort());
        }
      }
    }
    // About 1.3 per club and season in the long run; over 7 seasons of 20 clubs, well above 0.
    expect(retired).toBeGreaterThan(20);
    // The human club's own campaign is consistent in every season.
    const someone = career.turns.some(
      (t) => t.summary.campaigns[career.human]!.farewells.length > 0,
    );
    expect(someone).toBe(true);
  });

  it('nobody plays a season at 40 or more, and every squad stays 25 in 3/5/4/4/4/5 with one idol', () => {
    const problems: string[] = [];
    const states = [career.first, ...career.turns.map((t) => t.next)];
    states.forEach((state, i) => {
      for (const p of Object.values(state.players)) {
        if (p.age >= RETIRE_AT) problems.push(`season ${i + 1}: ${p.id} is ${p.age}`);
      }
      for (const p of squadProblems(state)) problems.push(`season ${i + 1}: ${p}`);
      const inSquad = Object.values(state.squads).flat();
      if (inSquad.length !== Object.keys(state.players).length) {
        problems.push(`season ${i + 1}: players outside the squads`);
      }
    });
    expect(problems).toEqual([]);
  });

  it('keeps the retired in players only until the turn (the summary screen still has name and face)', () => {
    for (const t of career.turns) {
      const inSquad = new Set(Object.values(t.closed.squads).flat());
      const gone = Object.keys(t.closed.players).filter((id) => !inSquad.has(id));
      for (const id of gone) {
        const p = t.closed.players[id]!;
        expect(p.name.display.length).toBeGreaterThan(0);
        expect(p.face.length).toBeGreaterThan(0);
        expect(p.age).toBeGreaterThanOrEqual(33);
        expect(t.next.players[id]).toBeUndefined();
      }
      expect(gone.length).toBeGreaterThan(0);
      // Closed state: the age 40 rule already applied to the squads.
      for (const id of inSquad) expect(t.closed.players[id]!.age).toBeLessThan(RETIRE_AT);
    }
  });

  it('never repeats an id, not even against pastSeasons, and a retired id never comes back', () => {
    const everCreated = new Set<PlayerId>(Object.keys(career.first.players));
    const retiredBefore = new Set<PlayerId>();
    for (const t of career.turns) {
      const created = Object.keys(t.closed.players).filter((id) => !everCreated.has(id));
      expect(created.length).toBeGreaterThan(0);
      for (const id of created) everCreated.add(id);
      for (const id of Object.keys(t.next.players)) expect(retiredBefore.has(id)).toBe(false);
      const inSquad = new Set(Object.values(t.closed.squads).flat());
      for (const id of Object.keys(t.closed.players)) if (!inSquad.has(id)) retiredBefore.add(id);
      // Every id the summaries mention is one the career created, and one name per id.
      for (const past of t.next.pastSeasons) {
        for (const id of summaryIds(past)) expect(everCreated.has(id)).toBe(true);
      }
    }
    // Ids of the academy are fresh: never in an earlier state's players.
    const seen = new Set<PlayerId>(Object.keys(career.first.players));
    for (const t of career.turns) {
      const fresh = Object.values(t.closed.squads)
        .flat()
        .filter((id) => !(id in t.finished.players));
      for (const id of fresh) expect(seen.has(id)).toBe(false);
      for (const id of Object.keys(t.closed.players)) seen.add(id);
    }
  });

  it('brings youth of 17 with a valid name and face, no bald, grey or white hair, and never regenerates them', () => {
    const youth = new Map<PlayerId, Player>();
    for (const t of career.turns) {
      for (const c of Object.values(t.summary.campaigns)) {
        for (const id of c.academy) {
          const p = t.closed.players[id]!;
          youth.set(id, p);
          expect(p.age).toBe(ACADEMY_AGE);
          expect(p.clubAppearances).toBe(0);
        }
      }
      for (const [clubId, ids] of Object.entries(t.closed.squads)) {
        for (const id of ids.filter((x) => !(x in t.finished.players))) {
          const p = t.closed.players[id]!;
          youth.set(id, p);
          expect(p.age).toBe(ACADEMY_AGE);
          expect(p.clubId).toBe(clubId);
          expect(p.name.display.trim().length).toBeGreaterThan(0);
          expect(p.name.full.trim().length).toBeGreaterThan(0);
          expect(p.face).toMatch(/^[0-9a-z]{2,32}$/);
          const spec = decodeFace(p.face);
          for (const [field, value] of Object.entries(spec)) {
            expect(value).toBeLessThan(FACE_COUNTS[field as keyof typeof FACE_COUNTS]);
          }
          expect(spec.hairStyle).not.toBe(BALD);
          expect(spec.hairStyle).not.toBe(RECEDING);
          expect(spec.hairStyle).not.toBe(CROWN);
          expect(spec.hairColor).not.toBe(GREY);
          expect(spec.hairColor).not.toBe(WHITE);
          // The name is unique in the club.
          const names = ids.map((i) => t.closed.players[i]!.name.full);
          expect(new Set(names).size).toBe(names.length);
        }
      }
    }
    expect(youth.size).toBeGreaterThan(20);
    // Once created, identity is never drawn again: name, face and seeds equal in every later state.
    for (const t of career.turns) {
      for (const state of [t.closed, t.next]) {
        for (const [id, first] of youth) {
          const later = state.players[id];
          if (later === undefined) continue;
          expect(later.name).toEqual(first.name);
          expect(later.face).toBe(first.face);
          expect(later.nameSeed).toBe(first.nameSeed);
          expect(later.faceSeed).toBe(first.faceSeed);
        }
      }
    }
    // Same for the first squads: an existing player keeps his face for the whole career.
    const last = career.turns.at(-1)!.next;
    for (const [id, p] of Object.entries(career.first.players)) {
      const later = last.players[id];
      if (later === undefined) continue;
      expect(later.face).toBe(p.face);
      expect(later.name).toEqual(p.name);
    }
  });

  it('keeps the same position for the youth who replaces a retired player, in the same club', () => {
    for (const t of career.turns) {
      for (const [clubId, ids] of Object.entries(t.closed.squads)) {
        const before = t.finished.squads[clubId]!;
        const left = before.filter((id) => !ids.includes(id));
        const came = ids.filter((id) => !before.includes(id));
        const count = (list: readonly string[], position: string) =>
          list.filter(
            (id) => (t.closed.players[id] ?? t.finished.players[id])!.position === position,
          ).length;
        for (const position of Object.keys(GROUP)) {
          expect(count(came, position)).toBe(count(left, position));
        }
      }
    }
  });

  it('gives a new idol to a club whose idol retired', () => {
    let changed = 0;
    for (const t of career.turns) {
      for (const [clubId, ids] of Object.entries(t.finished.squads)) {
        const oldIdol = ids.find((id) => t.finished.players[id]!.trait === 'idol')!;
        if (t.closed.squads[clubId]!.includes(oldIdol)) continue;
        changed++;
        const idols = t.closed.squads[clubId]!.filter(
          (id) => t.closed.players[id]!.trait === 'idol',
        );
        expect(idols).toHaveLength(1);
        expect(idols[0]).not.toBe(oldIdol);
        expect(t.closed.clubs[clubId]!.idolBenchStreak).toBe(0);
      }
    }
    // With 20 clubs over 7 seasons, an idol (29+) retiring is expected to happen at least once.
    expect(changed).toBeGreaterThan(0);
  });
});

describe('T-048: determinism of the whole path', () => {
  it('the same seed gives the same retired and the same youth (names, faces, ids), season by season', () => {
    const again = playCareer(4801, 3);
    again.turns.forEach((t, i) => {
      const o = career.turns[i]!;
      expect(t.closed.squads).toEqual(o.closed.squads);
      expect(t.summary.campaigns[again.human]!.farewells).toEqual(
        o.summary.campaigns[career.human]!.farewells,
      );
      expect(t.summary.campaigns[again.human]!.academy).toEqual(
        o.summary.campaigns[career.human]!.academy,
      );
      expect(JSON.stringify(t.next.players)).toBe(JSON.stringify(o.next.players));
    });
  }, 300_000);

  it('a different seed gives a different renewal', () => {
    const other = playCareer(4802, 2);
    const mine = career.turns.slice(0, 2).map((t) => Object.keys(t.closed.players).join());
    expect(other.turns.map((t) => Object.keys(t.closed.players).join())).not.toEqual(mine);
  }, 300_000);

  it('the order of the clubs and of the records in the state does not change who retires or who comes', () => {
    const t = career.turns[3]!;
    const reversed = <V>(rec: Record<string, V>): Record<string, V> =>
      Object.fromEntries(Object.entries(rec).reverse());
    const shuffled: GameState = {
      ...t.finished,
      clubs: reversed(t.finished.clubs),
      players: reversed(t.finished.players),
    };
    const a = endSeason(t.finished, params, [], identities);
    const b = endSeason(shuffled, params, [], identities);
    if (!a.ok || !b.ok) throw new Error('endSeason refused');
    for (const clubId of Object.keys(a.value.state.squads)) {
      expect(b.value.state.squads[clubId]).toEqual(a.value.state.squads[clubId]);
    }
    for (const [id, p] of Object.entries(a.value.state.players)) {
      expect(b.value.state.players[id]).toEqual(p);
    }
  });
});

function saveOf(state: GameState, label: string): CareerSave {
  const stamp = '2026-11-06T12:00:00.000Z';
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    careerId: careerIdOf(label),
    createdAt: stamp,
    updatedAt: stamp,
    appVersion: '0.0.1',
    engineVersion: state.engineVersion,
    paramsHash: SAMPLE_PARAMS_HASH,
    career: {
      coachName: 'Treinador',
      clubId: career.human,
      matchMode: 'result',
      news: [],
      social: [],
      phraseMemory: [],
      pendingFanDecision: 0,
      exportReminder: true,
      baseSeason: career.baseSeason,
      matchSheets: {},
    },
    game: state,
  };
}

describe('T-048: the save of a career that crossed two turns', () => {
  it('writes and reopens equal, with farewells and academy kept, and passes the full schema', async () => {
    const state = career.turns[1]!.next;
    expect(state.season).toBe(3);
    const save = saveOf(state, 'renewal-two-turns');
    expect(parseCareerSave(save, { check: 'full' }).ok).toBe(true);

    const s = store();
    const written = await s.writeSnapshot(save);
    expect(written.ok).toBe(true);
    const opened = await store().openCareer(save.careerId);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value.skipped).toEqual([]);
    expect(opened.value.save).toEqual(save);
    const past = opened.value.save.game.pastSeasons;
    expect(past).toHaveLength(2);
    for (const [i, summary] of past.entries()) {
      const c = summary.campaigns[career.human]!;
      const original = career.turns[i]!.summary.campaigns[career.human]!;
      expect(c.farewells).toEqual(original.farewells);
      expect(c.academy).toEqual(original.academy);
    }
    expect(past.some((p) => p.campaigns[career.human]!.farewells.length > 0)).toBe(true);
    expect(parseCareerSave(opened.value.save, { check: 'full' }).ok).toBe(true);
  });

  it('also saves and reopens at the seasonEnd phase, when the retired are only in players', async () => {
    const t = career.turns[1]!;
    expect(t.closed.phase).toBe('seasonEnd');
    const save = saveOf(t.closed, 'renewal-season-end');
    expect(parseCareerSave(save, { check: 'full' }).ok).toBe(true);
    const written = await store().writeSnapshot(save);
    expect(written.ok).toBe(true);
    const opened = await store().openCareer(save.careerId);
    expect(opened.ok && opened.value.save).toEqual(save);
    // The turn can still be done from the reopened state, with the same result as without saving.
    if (!opened.ok) return;
    const turned = startNextSeason(opened.value.save.game, params, identities);
    expect(turned.ok && JSON.stringify(turned.value)).toBe(JSON.stringify(t.next));
  });
});
