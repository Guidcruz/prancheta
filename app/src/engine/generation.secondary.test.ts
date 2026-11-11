import { beforeAll, describe, expect, it } from 'vitest';
import type { ClubDef } from './clubs.ts';
import { newGame, type GameState } from './game.ts';
import { generateAcademy, generateSquad, turnPlayerId } from './generation.ts';
import { POSITIONS, secondaryNeighbours, secondaryPositionFor, type Player } from './players.ts';
import { syntheticClubs, type MutableClubDef } from './testing/clubs.ts';
import { fixedIdentitySource } from './testing/identity.ts';
import { testParams } from './testing/params.ts';
import type { Position } from './types.ts';

/*
 * The secondary position in the generation (docs/design/posicao-secundaria.md, "Geração" and
 * acceptance criteria 1 to 3; ADR-0022, item 3; T-078): the new game and the academy draw it with
 * `secondaryPositionFor`, from the player's own stream, before the squad shift, and the squad
 * stream does not move. The careers are those of the generator's test (generation.test.ts:
 * seeds 7919 × 1..200, the strength ladder).
 *
 * `PROPERTY_FULL=1` runs 1,000 careers instead of 200 (before a release).
 */
const FULL = process.env.PROPERTY_FULL === '1';
const CAREERS = FULL ? 1_000 : 200;

const LADDER = [78, 77, 76, 75, 74, 73, 72, 72, 71, 70, 70, 69, 68, 68, 67, 66, 65, 65, 64, 64];

function ladderClubs(): MutableClubDef[] {
  return syntheticClubs(20).map((club, i) => ({ ...club, strength: LADDER[i]! }));
}

const identities = fixedIdentitySource();
const clubs: readonly ClubDef[] = ladderClubs();
const CHANCE = 0.33;

function play(seed: number, secondaryChance = CHANCE): GameState {
  const params = testParams({ secondaryChance });
  const result = newGame({ seed, year: 2026, realism: 'full' }, clubs, params, identities);
  if (!result.ok) throw new Error(`newGame failed: ${JSON.stringify(result.detail)}`);
  return result.value;
}

/** A player without the secondary position: what the generation gave before T-078. */
function withoutSecondary(player: Player): Record<string, unknown> {
  return Object.fromEntries(Object.entries(player).filter(([key]) => key !== 'secondaryPosition'));
}

interface Share {
  all: number;
  with: number;
}

function count<K>(map: Map<K, Share>, key: K, has: boolean): void {
  const row = map.get(key) ?? { all: 0, with: 0 };
  row.all++;
  if (has) row.with++;
  map.set(key, row);
}

/** Tally of the secondaries of a list of players, by natural position and by neighbour. */
class Tally {
  outfield = 0;
  withSecondary = 0;
  readonly byPosition = new Map<Position, Share>();
  readonly byPair = new Map<string, number>();
  readonly problems: string[] = [];

  add(player: Player, seed: number): void {
    const { id, position, secondaryPosition: secondary } = player;
    if (secondary !== secondaryPositionFor(seed, id, position, CHANCE)) {
      this.problems.push(`${seed} ${id}: not the draw of secondaryPositionFor`);
    }
    if (position === 'GK') {
      if (secondary !== null) this.problems.push(`${seed} ${id}: a goalkeeper with ${secondary}`);
      return;
    }
    this.outfield++;
    const row = this.byPosition.get(position) ?? { all: 0, with: 0 };
    row.all++;
    this.byPosition.set(position, row);
    if (secondary === null) return;
    this.withSecondary++;
    row.with++;
    const pair = `${position}>${secondary}`;
    this.byPair.set(pair, (this.byPair.get(pair) ?? 0) + 1);
    if (secondary === position) this.problems.push(`${seed} ${id}: the natural as secondary`);
    if (!secondaryNeighbours(position).includes(secondary)) {
      this.problems.push(`${seed} ${id}: ${secondary} is not a neighbour of ${position}`);
    }
  }

  get share(): number {
    return this.withSecondary / this.outfield;
  }
}

describe(`the secondary position in ${CAREERS} new games (acceptance 1 and 2)`, () => {
  const tally = new Tally();
  /** Share by squad number (#1..#25) and by club, against a hash that mixes ids poorly. */
  const bySlot = new Map<number, Share>();
  const byClub = new Map<string, Share>();

  beforeAll(
    () => {
      for (let k = 1; k <= CAREERS; k++) {
        const seed = k * 7919;
        const state = play(seed);
        for (const [clubId, squad] of Object.entries(state.squads)) {
          squad.forEach((id, index) => {
            const player = state.players[id]!;
            tally.add(player, seed);
            if (player.position === 'GK') return;
            const has = player.secondaryPosition !== null;
            count(bySlot, index + 1, has);
            count(byClub, clubId, has);
          });
        }
      }
    },
    FULL ? 300_000 : 60_000,
  );

  it('is drawn by secondaryPositionFor for every player, a neighbour, never for a goalkeeper', () => {
    expect(tally.problems).toEqual([]);
    expect(tally.outfield).toBe(CAREERS * 20 * 22);
  });

  it('gives a secondary to 31% to 35% of the outfield players', () => {
    expect(tally.share).toBeGreaterThanOrEqual(0.31);
    expect(tally.share).toBeLessThanOrEqual(0.35);
  });

  it('keeps the share fair by natural position, by neighbour, by squad number and by club', () => {
    for (const position of POSITIONS) {
      if (position === 'GK') continue;
      const row = tally.byPosition.get(position)!;
      expect(row.with / row.all, position).toBeGreaterThan(0.29);
      expect(row.with / row.all, position).toBeLessThan(0.37);
      const neighbours = secondaryNeighbours(position);
      for (const s of neighbours) {
        const part = (tally.byPair.get(`${position}>${s}`) ?? 0) / row.with;
        expect(Math.abs(part - 1 / neighbours.length), `${position}>${s}`).toBeLessThan(0.05);
      }
    }
    // #1 and #12 are always goalkeepers; the third one is anywhere in the shuffled pool.
    expect(bySlot.size).toBe(23);
    expect(byClub.size).toBe(20);
    for (const [key, row] of [...bySlot, ...byClub]) {
      expect(row.with / row.all, `#${key}`).toBeGreaterThan(0.27);
      expect(row.with / row.all, `#${key}`).toBeLessThan(0.39);
    }
  });
});

describe('the squad stream does not move (acceptance 3)', () => {
  it('with secondaryChance 0, nobody has a secondary and the rest is the same as with 0.33', () => {
    for (const seed of [7919, 2026, 20261104]) {
      const without = play(seed, 0);
      const withIt = play(seed, CHANCE);
      const players = Object.values(without.players);
      expect(players.every((p) => p.secondaryPosition === null)).toBe(true);
      expect(Object.values(withIt.players).some((p) => p.secondaryPosition !== null)).toBe(true);
      // Ages, attributes, overalls (the shift does not read the secondary yet), traits, curves,
      // nationalities, names, faces, morale, potentials, shirts, strengths and the calendar.
      expect({ ...withIt, players: {} }).toEqual({ ...without, players: {} });
      for (const [id, player] of Object.entries(withIt.players)) {
        expect(withoutSecondary(player), id).toEqual(withoutSecondary(without.players[id]!));
      }
    }
  });

  it('a higher chance (0.33 → 0.40) never removes nor changes a secondary', () => {
    for (const seed of [7919, 2026]) {
      const low = play(seed, CHANCE);
      const high = play(seed, 0.4);
      let gained = 0;
      for (const [id, player] of Object.entries(low.players)) {
        const after = high.players[id]!.secondaryPosition;
        if (player.secondaryPosition !== null) expect(after, id).toBe(player.secondaryPosition);
        else if (after !== null) gained++;
      }
      expect(gained).toBeGreaterThan(0);
    }
  });

  it('the same seed gives the same secondaries', () => {
    const a = play(4242);
    const b = play(4242);
    for (const [id, player] of Object.entries(a.players)) {
      expect(b.players[id]!.secondaryPosition, id).toBe(player.secondaryPosition);
    }
  });
});

describe('a squad of a later season and the academy (acceptance 2)', () => {
  const params = testParams();

  it('a squad generated for season 2 draws by the ids of the turn', () => {
    const club = clubs[3]!;
    const squad = generateSquad(
      { clubId: club.id, seed: 777, strength: club.strength ?? 70, formation: '4-4-2', season: 2 },
      params,
      identities,
    );
    squad.players.forEach((p, i) => {
      expect(p.id).toBe(turnPlayerId(club.id, 2, i + 1));
      expect(p.secondaryPosition, p.id).toBe(secondaryPositionFor(777, p.id, p.position, CHANCE));
    });
  });

  it('the academy youth draws by his own id, 31% to 35% of the outfield ones', () => {
    const tally = new Tally();
    const positions: Position[] = ['GK', 'CB', 'FB', 'DM', 'AM', 'ST', 'CB', 'ST'];
    const seeds = FULL ? 1_000 : 200;
    for (let k = 1; k <= seeds; k++) {
      const seed = k * 7919;
      for (const club of clubs) {
        for (const season of [1, 2]) {
          const youth = generateAcademy(
            { clubId: club.id, seed, season, strength: club.strength ?? 70, positions, squad: [] },
            params,
            identities,
          );
          youth.forEach((p, i) => {
            expect(p.id).toBe(turnPlayerId(club.id, season + 1, i + 1));
            tally.add(p, seed);
          });
        }
      }
    }
    expect(tally.problems).toEqual([]);
    expect(tally.share).toBeGreaterThanOrEqual(0.31);
    expect(tally.share).toBeLessThanOrEqual(0.35);
  });

  it('the youth keeps the rest of his draws: secondaryChance 0 changes only the new field', () => {
    const club = clubs[0]!;
    const request = {
      clubId: club.id,
      seed: 99,
      season: 1,
      strength: club.strength ?? 70,
      positions: ['CB', 'FB', 'DM', 'AM', 'ST'] as Position[],
      squad: [],
    };
    const withIt = generateAcademy(request, params, identities);
    const without = generateAcademy(request, testParams({ secondaryChance: 0 }), identities);
    expect(without.every((p) => p.secondaryPosition === null)).toBe(true);
    expect(withIt.map(withoutSecondary)).toEqual(without.map(withoutSecondary));
  });
});
