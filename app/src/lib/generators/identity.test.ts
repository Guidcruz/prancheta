import { describe, expect, it } from 'vitest';
import clubsData from '../../data/clubs.serie-a.json';
import brLists from '../../content/names/br.json';
import {
  FACE_MAX_LENGTH,
  SQUAD_SIZE,
  newGame,
  validatePlayer,
  type ClubDef,
  type GameState,
  type PlayerNameText,
} from '../../engine/index.ts';
import { loadGameParams } from '../params.ts';
import { HAIR_COLOR, HAIR_STYLE, decodeFace, encodeFace, faceSpecFromSeed } from './face.ts';
import { RETIRED_NAMES_REV, createIdentitySource, gameIdentitySource } from './identity.ts';
import { namesForSquad, normalizeNameKey, type NameLists } from './names.ts';

const clubs = clubsData as unknown as ClubDef[];
const lists = brLists as NameLists;
/** Ages 17 to 34, one per identity, as the engine draws them. */
const ages = (count: number) => Array.from({ length: count }, (_, k) => 17 + ((k * 5) % 18));

function realGame(seed: number, source = gameIdentitySource()): GameState {
  const result = newGame({ seed, year: 2026, realism: 'full' }, clubs, loadGameParams(), source);
  if (!result.ok) throw new Error(`newGame failed: ${JSON.stringify(result.detail)}`);
  expect(result.warnings).toEqual([]);
  return result.value;
}

describe('game identity source (ADR-0012)', () => {
  it('creates the 20 real squads with valid, unique and stored names and faces', () => {
    for (const seed of [1, 2026, 99_999, 0xffffffff]) {
      const state = realGame(seed);
      expect(state.retiredNamesRev).toBe(RETIRED_NAMES_REV);
      for (const [clubId, ids] of Object.entries(state.squads)) {
        const squad = ids.map((id) => state.players[id]!);
        expect(squad).toHaveLength(SQUAD_SIZE);
        const displays = squad.map((p) => normalizeNameKey(p.name.display));
        expect(new Set(displays).size, clubId).toBe(SQUAD_SIZE);
        const perFamily = new Map<string, number>();
        for (const p of squad) {
          expect(validatePlayer(p).ok).toBe(true);
          expect(p.face.length).toBeLessThanOrEqual(FACE_MAX_LENGTH);
          // A real encoded face, drawn with the age and nationality of the player's creation.
          expect(p.face).toMatch(/^1[0-9a-z]{12}$/);
          expect(encodeFace(decodeFace(p.face))).toBe(p.face);
          expect(p.face).toBe(
            encodeFace(faceSpecFromSeed(p.faceSeed, { age: p.age, nationality: p.nationality })),
          );
          const family = normalizeNameKey(p.name.family);
          perFamily.set(family, (perFamily.get(family) ?? 0) + 1);
        }
        // At most 3 per surname, across the nationality calls too.
        expect(Math.max(...perFamily.values())).toBeLessThanOrEqual(3);
      }
    }
  });

  it('is deterministic', () => {
    expect(JSON.stringify(realGame(77))).toBe(JSON.stringify(realGame(77)));
  });

  /*
   * What this proves: the name lists decide the names of NEW players (a reordered br.json gives
   * another game), and a game state round-trips through JSON with its names and stays valid, so
   * nothing in it depends on the lists. The real ADR-0012 conformance (open a fixed save with
   * changed lists and see the same names on screen) needs the save layer: T-018/T-044.
   */
  it('stores names in the state: the lists only change new games, the state round-trips', () => {
    const game = realGame(2026);
    const reordered: NameLists = {
      ...lists,
      given: [...lists.given].reverse(),
      family: [...lists.family].reverse(),
      nicknames: [...lists.nicknames].reverse(),
    };
    // Exclusions are by index, so they do not apply to the reordered copy (test-only source).
    const fresh = realGame(2026, createIdentitySource(reordered));
    expect(JSON.stringify(fresh.players)).not.toBe(JSON.stringify(game.players));
    // Faces have a stream of their own: other name lists change names, never a face (T-027).
    for (const [id, player] of Object.entries(game.players)) {
      expect(fresh.players[id]!.face, id).toBe(player.face);
      expect(fresh.players[id]!.faceSeed, id).toBe(player.faceSeed);
    }
    const opened = JSON.parse(JSON.stringify(game)) as GameState;
    const names = (s: GameState) => Object.values(s.players).map((p) => p.name);
    expect(names(opened)).toEqual(names(game));
    for (const player of Object.values(opened.players)) {
      expect(validatePlayer(player).ok).toBe(true);
    }
  });

  it('respects the names already in the squad', () => {
    const source = gameIdentitySource();
    const first = source.squad({
      seed: 5,
      nationality: 'BR',
      count: 20,
      ages: ages(20),
      existing: [],
    });
    const existing: PlayerNameText[] = first.map(({ display, full, family }) => ({
      display,
      full,
      family,
    }));
    const more = source.squad({ seed: 6, nationality: 'AR', count: 5, ages: ages(5), existing });
    const all = [...existing, ...more].map((n) => normalizeNameKey(n.display));
    expect(new Set(all).size).toBe(25);
  });

  it('draws faces from a stream of their own: other name lists never move a face', () => {
    const req = { seed: 9, nationality: 'BR', count: 25, ages: ages(25), existing: [] };
    const a = createIdentitySource(lists).squad(req);
    const b = createIdentitySource({
      ...lists,
      given: [...lists.given].reverse(),
      family: [...lists.family].reverse(),
      nicknames: [...lists.nicknames].reverse(),
    }).squad(req);
    expect(b.map((i) => i.display)).not.toEqual(a.map((i) => i.display));
    expect(b.map((i) => i.face)).toEqual(a.map((i) => i.face));
    expect(b.map((i) => i.faceSeed)).toEqual(a.map((i) => i.faceSeed));
    for (const id of a) expect(id.face.length).toBeLessThanOrEqual(FACE_MAX_LENGTH);
  });

  it('draws each face with the age of its own player', () => {
    const source = gameIdentitySource();
    const req = { seed: 31, nationality: 'BR', count: 25, existing: [] };
    const young = source.squad({ ...req, ages: Array.from({ length: 25 }, () => 17) });
    const old = source.squad({ ...req, ages: Array.from({ length: 25 }, () => 34) });
    // Same seeds (names and faceSeed), but the age weighs hair, beard and marks.
    expect(old.map((i) => i.faceSeed)).toEqual(young.map((i) => i.faceSeed));
    expect(old.map((i) => i.face)).not.toEqual(young.map((i) => i.face));
    const mixed = source.squad({ ...req, ages: ages(25) });
    mixed.forEach((id, k) => {
      expect(id.face).toBe(
        encodeFace(faceSpecFromSeed(id.faceSeed, { age: ages(25)[k]!, nationality: 'BR' })),
      );
    });
  });

  it('never gives a young squad a bald, receding, crown, grey or white face', () => {
    const source = gameIdentitySource();
    const banned: number[] = [HAIR_STYLE.bald, HAIR_STYLE.receding, HAIR_STYLE.crown];
    let faces = 0;
    for (let seed = 0; seed < 200; seed++) {
      const squadAges = Array.from({ length: 25 }, (_, k) => 17 + ((seed + k) % 7));
      const squad = source.squad({
        seed,
        nationality: 'BR',
        count: 25,
        ages: squadAges,
        existing: [],
      });
      for (const id of squad) {
        const face = decodeFace(id.face);
        expect(banned, id.face).not.toContain(face.hairStyle);
        expect([HAIR_COLOR.grey, HAIR_COLOR.white], id.face).not.toContain(face.hairColor);
        faces++;
      }
    }
    expect(faces).toBe(5000);
  });

  it('weighs the skin of a nationality without a table by the Brazilian one', () => {
    // 'XX' never gets a table. That the nationality reaches faceSpecFromSeed can only be proved
    // once there is a second table (a country whose faces differ from the Brazilian ones).
    const source = gameIdentitySource();
    const req = { seed: 4, count: 25, ages: ages(25), existing: [] };
    const br = source.squad({ ...req, nationality: 'BR' }).map((i) => i.face);
    expect(source.squad({ ...req, nationality: 'XX' }).map((i) => i.face)).toEqual(br);
  });

  it('throws when the ages do not match the count (a programming error)', () => {
    const source = gameIdentitySource();
    const req = { seed: 4, nationality: 'BR', count: 5, existing: [] };
    expect(() => source.squad({ ...req, ages: ages(4) })).toThrow(/4 ages, expected 5/);
    expect(() => source.squad({ ...req, ages: ages(6) })).toThrow(/6 ages, expected 5/);
    expect(source.squad({ ...req, ages: ages(5) })).toHaveLength(5);
  });
});

describe('namesForSquad with existing names', () => {
  it('applies the squad rules against the names already there', () => {
    const base = namesForSquad(11, 10, lists);
    const more = namesForSquad(12, 15, lists, undefined, base);
    const displays = [...base, ...more].map((n) => normalizeNameKey(n.display));
    expect(new Set(displays).size).toBe(25);
    const perFamily = new Map<string, number>();
    for (const n of [...base, ...more]) {
      const key = normalizeNameKey(n.family);
      perFamily.set(key, (perFamily.get(key) ?? 0) + 1);
    }
    expect(Math.max(...perFamily.values())).toBeLessThanOrEqual(3);
  });

  it('gives the same result as before when there are none', () => {
    expect(namesForSquad(3, 25, lists, undefined, [])).toEqual(namesForSquad(3, 25, lists));
  });

  it('refuses a display that clashes with an existing one', () => {
    const [taken] = namesForSquad(21, 1, lists);
    const fake = { display: taken!.display, family: 'Zzzz' };
    // Seeded identically, the first candidate is `taken` itself, so it must be skipped.
    const [next] = namesForSquad(21, 1, lists, undefined, [fake]);
    expect(normalizeNameKey(next!.display)).not.toBe(normalizeNameKey(taken!.display));
  });
});
