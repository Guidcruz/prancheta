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
import {
  PLACEHOLDER_FACE_PREFIX,
  RETIRED_NAMES_REV,
  createIdentitySource,
  gameIdentitySource,
  placeholderFace,
} from './identity.ts';
import { namesForSquad, normalizeNameKey, type NameLists } from './names.ts';

const clubs = clubsData as unknown as ClubDef[];
const lists = brLists as NameLists;

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
          expect(p.face).toBe(placeholderFace(p.faceSeed));
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

  it('keeps the names of a saved game when the lists change (reordered br.json)', () => {
    const saved = JSON.stringify(realGame(2026));
    const reordered: NameLists = {
      ...lists,
      given: [...lists.given].reverse(),
      family: [...lists.family].reverse(),
      nicknames: [...lists.nicknames].reverse(),
    };
    // Exclusions are by index, so they do not apply to the reordered copy (test-only source).
    const changed = createIdentitySource(reordered);
    const opened = JSON.parse(saved) as GameState;
    // The lists do matter for new players...
    const fresh = realGame(2026, changed);
    expect(JSON.stringify(fresh.players)).not.toBe(JSON.stringify(opened.players));
    // ...but a saved game reads `Player.name` and never asks the source again.
    const names = (s: GameState) => Object.values(s.players).map((p) => p.name);
    expect(names(opened)).toEqual(names(JSON.parse(saved) as GameState));
    expect(names(opened)).toEqual(names(realGame(2026)));
    for (const player of Object.values(opened.players))
      expect(validatePlayer(player).ok).toBe(true);
  });

  it('respects the names already in the squad', () => {
    const source = gameIdentitySource();
    const first = source.squad({ seed: 5, nationality: 'BR', count: 20, existing: [] });
    const existing: PlayerNameText[] = first.map(({ display, full, family }) => ({
      display,
      full,
      family,
    }));
    const more = source.squad({ seed: 6, nationality: 'AR', count: 5, existing });
    const all = [...existing, ...more].map((n) => normalizeNameKey(n.display));
    expect(new Set(all).size).toBe(25);
  });

  it('draws faces from a stream of their own, as a short placeholder until T-027', () => {
    const a = createIdentitySource(lists).squad({
      seed: 9,
      nationality: 'BR',
      count: 3,
      existing: [],
    });
    const b = createIdentitySource({ ...lists, given: [...lists.given].reverse() }).squad({
      seed: 9,
      nationality: 'BR',
      count: 3,
      existing: [],
    });
    expect(b.map((i) => i.face)).toEqual(a.map((i) => i.face));
    for (const id of a) {
      expect(id.face.startsWith(PLACEHOLDER_FACE_PREFIX)).toBe(true);
      expect(id.face.length).toBeLessThanOrEqual(FACE_MAX_LENGTH);
    }
    expect(placeholderFace(0xffffffff)).toBe('p0-1z141z3');
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
