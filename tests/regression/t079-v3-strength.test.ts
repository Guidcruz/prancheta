import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ENGINE_VERSION,
  bestEleven,
  fitLevel,
  isAvailable,
  teamStrength,
  type Formation,
  type GameState,
  type Player,
} from '../../app/src/engine/index.ts';
import { migrateSave } from '../../app/src/lib/save/migrations/index.ts';
import type { CareerSave } from '../../app/src/lib/save/schema.ts';
import { parseCareerSave } from '../../app/src/lib/save/validate.ts';

/*
 * T-079, acceptance 7 of posicao-secundaria.md on an old save: the v3 fixture was written by an
 * engine older than this one (engineVersion 17), with secondaries already in it. It opens (no
 * migration step, it validates), and the strength it shows differs from what the old rule showed
 * ("no secondary") only for the clubs that have a starter on his secondary slot, and only upwards,
 * between overall x 0.05 / 11 and overall x 0.10 / 11 per such starter (a secondary is always a
 * neighbour, whose table fit is 0.85 or 0.90). Nothing else in the save moves.
 */

const raw = JSON.parse(
  readFileSync(new URL('../../app/src/lib/save/__fixtures__/v3.json', import.meta.url), 'utf8'),
) as unknown;

function open(): CareerSave {
  const parsed = parseCareerSave(structuredClone(raw));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

/** The old reading of the same state: nobody has a secondary position. */
function withoutSecondaries(game: GameState): GameState {
  const players: Record<string, Player> = {};
  for (const [id, p] of Object.entries(game.players)) {
    players[id] = { ...p, secondaryPosition: null };
  }
  return { ...game, players };
}

/** A fixed XI per club (the best of the available, first preferred formation), to compare on. */
function lineups(game: GameState) {
  return Object.keys(game.clubs).map((clubId, index) => {
    const formation = game.clubs[clubId]!.preferredFormations[0] as Formation;
    const available = (game.squads[clubId] ?? [])
      .map((id) => game.players[id]!)
      .filter((p) => isAvailable(p));
    const eleven = bestEleven(available, formation);
    // On every other club, puts the first benched player with a secondary on a slot of it, so the rule is exercised.
    const bench =
      index % 2 === 1
        ? undefined
        : available.find(
            (p) => p.secondaryPosition !== null && !eleven.some((e) => e.player.id === p.id),
          );
    const at = bench && eleven.findIndex((e) => e.slot === bench.secondaryPosition);
    if (bench && at !== undefined && at > 0) eleven[at] = { player: bench, slot: eleven[at]!.slot };
    return {
      clubId,
      eleven,
      lineup: { formation, starters: eleven.map(({ player }) => player.id) },
    };
  });
}

describe('T-079: an old v3 save opens and shows the new strength only where there is a secondary', () => {
  it('is older than the engine, opens as is and needs no migration step', () => {
    const save = open();
    expect(save.schemaVersion).toBe(3);
    expect(save.engineVersion).toBeLessThan(ENGINE_VERSION);
    const migrated = migrateSave(structuredClone(raw));
    expect(migrated.ok).toBe(true);
    if (migrated.ok) expect(migrated.value.game).toEqual(save.game);
  });

  it('shown strength: equal without a starter on a secondary slot, never lower with one', () => {
    const game = open().game;
    const old = withoutSecondaries(game);
    for (const clubId of Object.keys(game.clubs)) {
      const now = teamStrength(game, clubId);
      const before = teamStrength(old, clubId);
      expect(now, clubId).toBeDefined();
      expect(before, clubId).toBeDefined();
      // The shown XI is the same one under both rules only when no secondary was used.
      expect(now!, clubId).toBeGreaterThanOrEqual(before! - 1e-9);
    }
  });

  it('on a fixed XI the rise is 0 without a secondary slot and bounded by 5% to 10% with it', () => {
    const game = open().game;
    const old = withoutSecondaries(game);
    let withSecondary = 0;
    let without = 0;
    for (const { clubId, eleven, lineup } of lineups(game)) {
      const now = teamStrength(game, clubId, lineup)!;
      const before = teamStrength(old, clubId, lineup)!;
      const used = eleven.filter(({ player, slot }) => fitLevel(player, slot) === 'secondary');
      if (used.length === 0) {
        expect(now, clubId).toBe(before);
        without++;
        continue;
      }
      withSecondary += used.length;
      const base = used.reduce((sum, { player }) => sum + player.overall, 0) / 11;
      expect(now - before, clubId).toBeGreaterThanOrEqual(base * 0.05 - 1e-9);
      expect(now - before, clubId).toBeLessThanOrEqual(base * 0.1 + 1e-9);
    }
    expect(without).toBeGreaterThan(0);
    expect(withSecondary).toBeGreaterThan(0);
  });
});
