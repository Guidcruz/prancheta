import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  newGame,
  secondaryPositionFor,
  type ClubDef,
  type Player,
  type Position,
} from '../../../engine/index.ts';
import { gameIdentitySource } from '../../generators/identity.ts';
import { loadGameParams } from '../../params.ts';
import type { CareerSave } from '../schema.ts';
import { parseCareerSave } from '../validate.ts';
import { coachDraft } from './0001-coach-draft.ts';
import { MIGRATION_SECONDARY_CHANCE, secondaryPosition } from './0002-secondary-position.ts';
import { migrateSave } from './index.ts';

/*
 * The step v2 → v3 (ADR-0022, item 4 and "Testes"; T-078), on the frozen v2 fixture: each player
 * gains `secondaryPosition` by `secondaryPositionFor` with the step's own constant, and nothing
 * else changes. The secondaries of the migrated fixture are written below: if the output of
 * `secondaryPositionFor` (or of the neighbours, from the FIT table) changes, this test fails,
 * and the rule must be frozen inside the step first (ADR-0022, "Conformidade").
 */

type Raw = Record<string, unknown>;
type V2 = Raw & { game: Raw & { seed: number; players: Record<string, Raw> } };

const dir = new URL('../__fixtures__/', import.meta.url);
const read = (name: string) => JSON.parse(readFileSync(new URL(name, dir), 'utf8')) as unknown;
const v2 = read('v2.json') as V2;
const v3 = read('v3.json') as CareerSave;

/** The step alone, on a v2 save (the chain from 2: `migrateSave` sets `schemaVersion: 3`). */
function migrated(raw: unknown): CareerSave {
  const result = migrateSave(raw);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

/** A save without the new key in each player: what the step must leave as it was. */
function withoutSecondary(save: { game: { players: Record<string, unknown> } }): unknown {
  const players = Object.fromEntries(
    Object.entries(save.game.players).map(([id, p]) => [
      id,
      Object.fromEntries(Object.entries(p as Raw).filter(([key]) => key !== 'secondaryPosition')),
    ]),
  );
  return { ...save, game: { ...save.game, players } };
}

/**
 * The secondaries of the migrated v2 fixture, by club: `N:POS` for each player `${club}#N` that
 * has one; every other player of the fixture has `null`. Frozen: never edit to make it pass.
 */
const FROZEN: Readonly<Record<string, string>> = {
  'atletico-minerio': '3:DM 5:CB 6:CB 7:CB 9:ST 17:AM 18:DM 20:AM 22:CB 24:AM',
  baiao: '2:FB 7:FB 8:AM 10:AM 22:AM',
  botafogueira: '2:FB 9:ST 13:FB 16:ST 19:FB 21:CB 22:AM 23:AM 201:CB',
  bragantao: '4:DM 5:CB 6:AM 7:FB 8:DM 9:ST 10:AM 16:ST 20:FB 23:DM 24:AM',
  chapecao: '4:FB 5:CB 6:AM 14:CB 15:AM 21:DM 22:AM',
  corinto: '2:DM 5:AM 6:FB 8:ST 9:AM 11:AM 22:FB 25:CB',
  coritibom: '4:DM 6:CB 7:FB 18:DM 20:AM 23:DM',
  cruzador: '5:CB 7:AM 8:AM 11:AM 19:ST 20:DM 21:DM 23:AM 24:AM 25:ST',
  flamingo: '10:DM 13:DM 17:AM 19:AM 24:AM',
  fluminario: '2:DM 3:FB 5:CB 6:CB 9:AM 10:AM 24:FB 25:FB',
  gremeos: '2:DM 7:FB 10:AM 16:ST 17:AM 19:AM 23:FB 24:AM',
  'inter-regional': '3:DM 6:AM 10:AM 15:CB 22:DM 24:ST',
  miragol: '4:DM 7:FB 17:AM 18:AM 20:AM 22:AM 25:DM',
  palmeral: '2:DM 3:FB 4:CB 8:ST 10:AM 11:AM 19:FB 22:DM 201:DM',
  remador: '5:CB 7:ST 8:DM 11:AM 14:CB 18:DM 201:AM',
  santoes: '3:FB 6:CB 7:ST 10:AM 11:AM 13:DM 14:CB 17:AM',
  'sao-paulao': '2:DM 3:DM 4:FB 5:AM 7:FB 11:AM 14:AM 16:DM 19:CB 22:AM 23:FB',
  tufao: '7:FB 14:CB 18:AM 21:FB 22:AM 24:FB',
  vasconcelos: '3:FB 4:AM 5:AM 13:FB 14:DM 15:CB 19:AM 21:AM 23:FB',
  vitorioso: '3:FB 14:DM 18:ST 19:ST 25:DM 201:DM',
};

/** The frozen list as `[id, secondary]` for every player of the fixture. */
function frozenPairs(): [string, Position | null][] {
  const given = new Map<string, Position>();
  for (const [club, list] of Object.entries(FROZEN)) {
    for (const entry of list.split(' ')) {
      const [n, position] = entry.split(':');
      given.set(`${club}#${n}`, position as Position);
    }
  }
  return Object.keys(v2.game.players).map((id) => [id, given.get(id) ?? null]);
}

const secondaries = (save: CareerSave) =>
  Object.entries(save.game.players).map(([id, p]): [string, Position | null] => [
    id,
    p.secondaryPosition,
  ]);

describe('migration 0002-secondary-position (v2 → v3)', () => {
  it('is the step from version 2, with the chance frozen at 0.33', () => {
    expect(secondaryPosition.from).toBe(2);
    expect(MIGRATION_SECONDARY_CHANCE).toBe(0.33);
  });

  it('gives the v2 fixture the frozen secondaries (fails if the rule changes)', () => {
    const save = migrated(v2);
    expect(secondaries(save)).toEqual(frozenPairs());
    // The list has 156 secondaries among the 440 outfield players, and no goalkeeper has one.
    const players = Object.values(save.game.players);
    expect(players.filter((p) => p.secondaryPosition !== null)).toHaveLength(156);
    expect(players.filter((p) => p.position !== 'GK')).toHaveLength(440);
    const goalkeepers = players.filter((p) => p.position === 'GK');
    expect(goalkeepers.every((p) => p.secondaryPosition === null)).toBe(true);
  });

  it('never reads the parameters: a /balance tuning cannot change it (its own constant)', () => {
    const source = readFileSync(new URL('./0002-secondary-position.ts', import.meta.url), 'utf8');
    const imports = source.split('\n').filter((line) => line.startsWith('import'));
    expect(imports.join('\n')).not.toMatch(/params/);
    expect(source).not.toMatch(/\.secondaryChance\b(?!`)/);
  });

  it('changes nothing but schemaVersion and the new key, and leaves the input as it was', () => {
    const before = structuredClone(v2);
    const save = migrated(v2);
    expect(withoutSecondary(save)).toEqual({ ...v2, schemaVersion: 3 });
    expect(save.career).toEqual(v2.career);
    expect(save.game.clubs).toEqual(v2.game.clubs);
    expect(v2).toEqual(before);
    for (const p of Object.values(save.game.players)) {
      expect(Object.hasOwn(p, 'secondaryPosition'), p.id).toBe(true);
    }
  });

  it('passes the full schema; every secondary is a neighbour, never the natural nor the goal', () => {
    const parsed = parseCareerSave(migrated(v2));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed));
    const neighbours: Record<Position, readonly Position[]> = {
      GK: [],
      CB: ['FB', 'DM'],
      FB: ['CB', 'DM', 'AM'],
      DM: ['CB', 'FB', 'AM'],
      AM: ['DM', 'ST'],
      ST: ['AM'],
    };
    for (const p of Object.values(parsed.value.game.players)) {
      if (p.secondaryPosition === null) continue;
      expect(neighbours[p.position], p.id).toContain(p.secondaryPosition);
    }
  });

  it('is idempotent: the step twice gives the same as once', () => {
    const once = secondaryPosition.migrate(v2);
    const twice = secondaryPosition.migrate(once);
    expect(twice).toEqual(once);
  });

  it('does not depend on the order of the players, nor on how many times the save is opened', () => {
    const ids = Object.keys(v2.game.players);
    const reversed = Object.fromEntries(ids.reverse().map((id) => [id, v2.game.players[id]]));
    const shuffled = { ...v2, game: { ...v2.game, players: reversed } };
    const a = migrated(v2);
    const b = migrated(shuffled);
    for (const [id, p] of Object.entries(a.game.players)) {
      expect(b.game.players[id]!.secondaryPosition, id).toBe(p.secondaryPosition);
    }
    // Opening the same save twice (acceptance 7 of the design).
    expect(secondaries(migrated(v2))).toEqual(secondaries(a));
  });

  it('gives the same secondaries as the v3 fixture of the same career (generation and academy)', () => {
    // The v3 fixture is the same career made again by the engine with the secondary position:
    // its new game's players (#1 to #25) and its academy youths (#201...) drew theirs in the
    // generation, the migrated v2 ones in this step, by the same function and id.
    const save = migrated(v2);
    expect(Object.keys(save.game.players)).toEqual(Object.keys(v3.game.players));
    expect(secondaries(save)).toEqual(secondaries(v3));
    expect(Object.keys(v3.game.players).some((id) => /#2\d\d$/.test(id))).toBe(true);
  });

  it('matches the new game of the same seed for the players #1 to #25', () => {
    const params = loadGameParams();
    expect(params.players.secondaryChance).toBe(MIGRATION_SECONDARY_CHANCE);
    const save = migrated(v2);
    const defs = Object.values(save.game.clubs).map((c) => c.def as ClubDef);
    const fresh = newGame(
      { seed: save.game.seed, year: save.career.baseSeason, realism: save.game.rules.realism },
      defs,
      params,
      gameIdentitySource(),
    );
    if (!fresh.ok) throw new Error(fresh.error);
    let compared = 0;
    for (const [id, p] of Object.entries(save.game.players)) {
      const n = Number(id.slice(id.lastIndexOf('#') + 1));
      if (n > 25) continue;
      const created: Player | undefined = fresh.value.players[id];
      expect(created, id).toBeDefined();
      expect(created!.position, id).toBe(p.position);
      expect(created!.secondaryPosition, id).toBe(p.secondaryPosition);
      compared++;
    }
    expect(compared).toBeGreaterThan(480);
  });

  it('replaces a secondaryPosition that a v2 save should not have (an edited file)', () => {
    const [id, player] = Object.entries(v2.game.players).find(([, p]) => p.position === 'ST')!;
    const expected = secondaryPositionFor(v2.game.seed, id, 'ST', MIGRATION_SECONDARY_CHANCE);
    for (const edited of ['GK', 'CB', 'ST', null, 7, 'xx']) {
      const raw = {
        ...v2,
        game: {
          ...v2.game,
          players: { ...v2.game.players, [id]: { ...player, secondaryPosition: edited } },
        },
      };
      expect(migrated(raw).game.players[id]!.secondaryPosition, String(edited)).toBe(expected);
    }
  });

  it('copies a game, a seed or a player it cannot read, for the full schema to refuse', () => {
    const [id, player] = Object.entries(v2.game.players)[0]!;
    const cases: [string, unknown][] = [
      ['a game that is not an object', { ...v2, game: 'x' }],
      ['no game', { ...v2, game: undefined }],
      ['a seed that is not an integer', { ...v2, game: { ...v2.game, seed: 1.5 } }],
      ['a negative seed', { ...v2, game: { ...v2.game, seed: -1 } }],
      ['a seed past 32 bits', { ...v2, game: { ...v2.game, seed: 2 ** 32 } }],
      ['a seed in text', { ...v2, game: { ...v2.game, seed: '2026' } }],
      ['players that are a list', { ...v2, game: { ...v2.game, players: [player] } }],
      ['players that are null', { ...v2, game: { ...v2.game, players: null } }],
    ];
    for (const [label, raw] of cases) {
      const out = secondaryPosition.migrate(raw as Raw);
      expect(out, label).toEqual(raw);
      expect(out, label).not.toBe(raw);
      const result = migrateSave(raw);
      expect(result.ok, label).toBe(true);
      if (result.ok) expect(parseCareerSave(result.value).ok, label).toBe(false);
    }
    // A player it cannot read is copied as it came, without the key; the others get theirs.
    for (const bad of [
      'x',
      null,
      [],
      { ...player, position: 'LW' },
      { ...player, position: undefined },
      { ...player, id: 7 },
    ]) {
      const raw = { ...v2, game: { ...v2.game, players: { ...v2.game.players, [id]: bad } } };
      const out = migrated(raw);
      expect(out.game.players[id], JSON.stringify(bad)).toEqual(bad);
      const other = Object.values(out.game.players).filter((p) => p !== out.game.players[id]);
      expect(other.every((p) => Object.hasOwn(p, 'secondaryPosition'))).toBe(true);
      expect(parseCareerSave(out).ok).toBe(false);
    }
  });

  it('runs after 0001: a v1 save goes up the whole chain to v3', () => {
    const v1 = read('v1.json') as V2;
    const throughV2 = migrateSave(v1, [coachDraft], 2);
    if (!throughV2.ok) throw new Error(throughV2.error);
    expect(secondaries(migrated(v1))).toEqual(secondaries(migrated(throughV2.value)));
    expect(parseCareerSave(migrated(v1)).ok).toBe(true);
  });
});
