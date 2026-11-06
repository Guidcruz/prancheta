import { describe, expect, it } from 'vitest';
import clubsData from '../../data/clubs.serie-a.json';
import { newGame, type ClubDef, type GameState, type Player } from '../../engine/index.ts';
import { loadGameParams } from '../params.ts';
import { atRound, base, season, store, useFreshDatabase } from '../save/testing/idb.ts';
import { SAMPLE_CAREER_ID } from '../save/testing/sample.ts';
import { AVATAR_SMALL_SIZE, renderFace } from './avatar.ts';
import {
  FACE_COUNTS,
  HAIR_COLOR,
  HAIR_STYLE,
  decodeFace,
  encodeFace,
  faceSpecFromSeed,
} from './face.ts';
import { gameIdentitySource } from './identity.ts';

/*
 * Acceptance of US-005 (T-027, QA gate 2) end to end at the library level: a whole new game, the
 * save round trip and the league-wide safety of the drawings. The unit files already cover the
 * codec and the weights (face.test.ts), the renderer over 1,000 synthetic players (avatar.test.ts)
 * and the identity source squad by squad (identity.test.ts); here the players are the real ones
 * of newGame and of a stored career.
 */

useFreshDatabase();

const clubs = clubsData as unknown as ClubDef[];

function realGame(seed: number): GameState {
  const result = newGame(
    { seed, year: 2026, realism: 'full' },
    clubs,
    loadGameParams(),
    gameIdentitySource(),
  );
  if (!result.ok) throw new Error(`newGame failed: ${JSON.stringify(result.detail)}`);
  return result.value;
}

const everyPlayer = (state: GameState): Player[] => Object.values(state.players);

const FORBIDDEN = [
  /<script/i,
  /<foreignObject/i,
  /<image/i,
  /<use\b/i,
  /<style/i,
  /\son[a-z]+\s*=/i,
  /javascript:/i,
  /(?:https?:)?\/\/(?!www\.w3\.org\/2000\/svg)/i,
  /href\s*=/i,
  /url\(/i,
];

describe('US-005: every player of a new game has a valid face', () => {
  it('decodes, re-encodes to the same code and draws, for all players of the league', () => {
    for (const seed of [1, 2026, 424242]) {
      const players = everyPlayer(realGame(seed));
      expect(players.length).toBeGreaterThanOrEqual(500);
      for (const p of players) {
        expect(p.face, p.id).toMatch(/^1[0-9a-z]{12}$/);
        const spec = decodeFace(p.face);
        expect(encodeFace(spec), p.id).toBe(p.face);
        for (const [field, count] of Object.entries(FACE_COUNTS)) {
          expect(spec[field as keyof typeof spec], `${p.id} ${field}`).toBeLessThan(count);
        }
      }
    }
  });
});

describe('US-005: stable avatar (same player, different sessions)', () => {
  it('gives the same faces and the same SVGs for the same seed, from newGame and from face.ts alone', () => {
    const a = everyPlayer(realGame(77));
    const b = everyPlayer(realGame(77));
    expect(b.map((p) => p.face)).toEqual(a.map((p) => p.face));
    for (const p of a) {
      // What a server would do: only face.ts, from the stored seed, age and nationality.
      const again = encodeFace(
        faceSpecFromSeed(p.faceSeed, { age: p.age, nationality: p.nationality }),
      );
      expect(again, p.id).toBe(p.face);
    }
    const pa = a.map((p) => renderFace(p.face, 96, { label: p.name.display }));
    const pb = b.map((p) => renderFace(p.face, 96, { label: p.name.display }));
    expect(pb).toEqual(pa);
  });

  it('gives different faces to a different seed', () => {
    const a = everyPlayer(realGame(1)).map((p) => p.face);
    const b = everyPlayer(realGame(2)).map((p) => p.face);
    expect(a.filter((f, i) => f === b[i]).length).toBeLessThan(a.length / 20);
  });

  it('keeps face and drawing identical when the career is written and reopened', async () => {
    const s = store();
    const written = await s.writeSnapshot(base, undefined, { expectedHeadSeq: 0 });
    if (!written.ok) throw new Error(written.error);
    const reopened = await store().openCareer(SAMPLE_CAREER_ID);
    if (!reopened.ok) throw new Error(reopened.error);
    const before = everyPlayer(base.game);
    const after = reopened.value.save.game.players;
    expect(Object.keys(after)).toHaveLength(before.length);
    for (const p of before) {
      const q = after[p.id]!;
      expect(q.face, p.id).toBe(p.face);
      expect(q.faceSeed, p.id).toBe(p.faceSeed);
      expect(renderFace(q.face, 96, { label: q.name.display }), p.id).toBe(
        renderFace(p.face, 96, { label: p.name.display }),
      );
    }
  });

  it('never re-draws a face as the season is played (ages move, faces do not)', async () => {
    const s = store();
    const written = await s.writeSnapshot(atRound(38), undefined, { expectedHeadSeq: 0 });
    if (!written.ok) throw new Error(written.error);
    const reopened = await store().openCareer(SAMPLE_CAREER_ID);
    if (!reopened.ok) throw new Error(reopened.error);
    const start = base.game.players;
    const end = reopened.value.save.game.players;
    expect(season.game.round).toBeGreaterThan(base.game.round);
    for (const p of Object.values(start)) {
      expect(end[p.id]?.face, p.id).toBe(p.face);
    }
  });
});

describe('US-005: age rules on the real squads', () => {
  it('keeps the young without baldness, grey or white hair and without expression marks', () => {
    const young: number[] = [HAIR_STYLE.bald, HAIR_STYLE.receding, HAIR_STYLE.crown];
    let checked = 0;
    for (const seed of [3, 4, 5, 6]) {
      for (const p of everyPlayer(realGame(seed))) {
        const face = decodeFace(p.face);
        if (p.age <= 23) expect(young, p.id).not.toContain(face.hairStyle);
        if (p.age < 30) expect(face.hairColor, p.id).not.toBe(HAIR_COLOR.grey);
        if (p.age < 33) expect(face.hairColor, p.id).not.toBe(HAIR_COLOR.white);
        if (p.age < 28) expect(face.marks, p.id).toBe(0);
        checked++;
      }
    }
    expect(checked).toBe(2000);
  });
});

describe('US-005: variety in a squad of 30 from the identity source', () => {
  it('has many skins, styles and combinations, and no repeated face', () => {
    const source = gameIdentitySource();
    let minSkins = 99;
    let minStyles = 99;
    let repeats = 0;
    for (let seed = 0; seed < 100; seed++) {
      const ages = Array.from({ length: 30 }, (_, k) => 17 + ((seed + k * 5) % 18));
      const squad = source.squad({ seed, nationality: 'BR', count: 30, ages, existing: [] });
      const specs = squad.map((i) => decodeFace(i.face));
      minSkins = Math.min(minSkins, new Set(specs.map((s) => s.skin)).size);
      minStyles = Math.min(minStyles, new Set(specs.map((s) => s.hairStyle)).size);
      repeats += 30 - new Set(squad.map((i) => i.face)).size;
    }
    expect(minSkins).toBeGreaterThanOrEqual(6);
    expect(minStyles).toBeGreaterThanOrEqual(7);
    expect(repeats).toBe(0);
  });
});

describe('US-005: safe and light avatar for every player of a league', () => {
  it('has no script, link or event attribute and stays within the byte limits', () => {
    const players = everyPlayer(realGame(2026));
    for (const p of players) {
      for (const size of [24, AVATAR_SMALL_SIZE, 48, 96, 256]) {
        const svg = renderFace(p.face, size, { shirt: '#c1272d', label: p.name.display });
        expect(svg.length, p.id).toBeLessThanOrEqual(size <= AVATAR_SMALL_SIZE ? 2400 : 3200);
        for (const re of FORBIDDEN) expect(svg, `${p.id} ${re}`).not.toMatch(re);
        expect(svg.startsWith('<svg'), p.id).toBe(true);
        expect(svg.endsWith('</svg>'), p.id).toBe(true);
      }
    }
  });

  it('escapes a hostile name used as the accessible label', () => {
    const p = everyPlayer(realGame(9))[0]!;
    const svg = renderFace(p.face, 48, { label: '"><script>alert(1)</script>' });
    expect(svg).not.toMatch(/<script/i);
  });
});
