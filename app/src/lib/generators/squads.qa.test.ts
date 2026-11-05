import { describe, expect, it } from 'vitest';
import clubsData from '../../data/clubs.serie-a.json';
import {
  bestEleven,
  elevenStrength,
  newGame,
  validatePlayer,
  type ClubDef,
  type GameState,
  type Player,
} from '../../engine/index.ts';
import { loadGameParams } from '../params.ts';
import { gameIdentitySource } from './identity.ts';

/*
 * QA property test for T-006 (US-004): real 20 clubs, real identity source, many seeds. Written
 * independently of the developer's tests; checks the rules of docs/design/jogadores.md.
 */
const clubs = clubsData as unknown as ClubDef[];
const SEEDS = Array.from({ length: 300 }, (_, i) => 1 + i * 104729);
const COMPOSITION = { GK: 3, CB: 5, FB: 4, DM: 4, AM: 4, ST: 5 } as const;
const AGE = [
  [22, 33],
  [19, 34],
  [23, 33],
  [17, 20],
] as const;
const GROUPS = [
  [0, 11],
  [11, 18],
  [18, 22],
  [22, 25],
] as const;
const STARTER_LISTS: Record<string, number[]> = {
  GK: [1],
  FB: [2, 6],
  CB: [3, 4],
  DM: [5, 8],
  AM: [10, 8, 7],
  ST: [9, 11, 7],
};

function game(seed: number): GameState {
  const r = newGame(
    { seed, year: 2026, realism: 'full' },
    clubs,
    loadGameParams(),
    gameIdentitySource(),
  );
  if (!r.ok) throw new Error('newGame failed');
  expect(r.warnings).toEqual([]);
  return r.value;
}

function squadOf(state: GameState, id: string): Player[] {
  return state.squads[id]!.map((pid) => state.players[pid]!);
}

describe('QA: generated squads with the real clubs and real names (300 seeds)', () => {
  it(
    'satisfies every squad rule on every club of every seed',
    { timeout: 60_000 },
    () => {
      const problems: string[] = [];
      const bad = (msg: string) => problems.length < 30 && problems.push(msg);
      for (const seed of SEEDS) {
        const state = game(seed);
        for (const def of clubs) {
          const tag = `seed ${seed} ${def.id}`;
          const squad = squadOf(state, def.id);
          const cs = state.clubs[def.id]!;
          if (squad.length !== 25) bad(`${tag}: size ${squad.length}`);
          const counts: Record<string, number> = {};
          for (const p of squad) counts[p.position] = (counts[p.position] ?? 0) + 1;
          for (const [pos, n] of Object.entries(COMPOSITION))
            if (counts[pos] !== n) bad(`${tag}: ${pos} x${counts[pos]}`);
          for (const p of squad) {
            if (!validatePlayer(p).ok) bad(`${tag}: invalid ${p.id}`);
            if (p.clubId !== def.id) bad(`${tag}: clubId`);
            if (p.morale < 50 || p.morale > 70) bad(`${tag}: morale ${p.morale}`);
            if (p.overall < 35 || p.overall > 92) bad(`${tag}: overall ${p.overall}`);
            if (p.potential < p.overall || p.potential > 95) bad(`${tag}: potential`);
            if (p.condition !== 100) bad(`${tag}: condition`);
            if (p.name.display.trim() === '' || /undefined|NaN/.test(p.name.full))
              bad(`${tag}: name`);
          }
          // groups: ages and shirts
          GROUPS.forEach(([a, b], g) => {
            for (const p of squad.slice(a, b))
              if (p.age < AGE[g]![0] || p.age > AGE[g]![1]) bad(`${tag}: group ${g} age ${p.age}`);
          });
          const shirts = squad.map((p) => p.shirt);
          if (new Set(shirts).size !== 25) bad(`${tag}: duplicate shirts ${shirts}`);
          const starterShirts = squad
            .slice(0, 11)
            .map((p) => p.shirt)
            .sort((x, y) => x - y);
          if (starterShirts.join() !== '1,2,3,4,5,6,7,8,9,10,11')
            bad(`${tag}: starters ${starterShirts}`);
          const reserves = squad.slice(11, 18);
          const rg = reserves.filter((p) => p.position === 'GK');
          if (rg.length < 1 || !rg.some((p) => p.shirt === 12)) bad(`${tag}: reserve GK shirt`);
          if (squad.some((p) => p.shirt === 12 && p.position !== 'GK')) bad(`${tag}: 12 not GK`);
          for (const p of reserves.concat(squad.slice(18, 22)))
            if (p.position !== 'GK' && p.shirt < 13) bad(`${tag}: bench shirt ${p.shirt}`);
          for (const p of squad.slice(22)) if (p.shirt < 30) bad(`${tag}: youth shirt ${p.shirt}`);
          for (const p of squad.slice(0, 11)) {
            // a starter's shirt is from the list of his position, or the smallest free 2..11
            const inList = STARTER_LISTS[p.position]!.includes(p.shirt);
            if (!inList && (p.shirt < 2 || p.shirt > 11)) bad(`${tag}: starter shirt`);
            if (p.position === 'GK' && p.shirt !== 1) bad(`${tag}: GK shirt ${p.shirt}`);
          }
          // names
          const displays = squad.map((p) => p.name.display);
          if (new Set(displays).size !== 25) bad(`${tag}: duplicate display`);
          const fam: Record<string, number> = {};
          for (const p of squad) fam[p.name.family] = (fam[p.name.family] ?? 0) + 1;
          for (const [f, n] of Object.entries(fam)) if (n > 3) bad(`${tag}: surname ${f} x${n}`);
          // jewel and idol
          const idols = squad.filter((p) => p.trait === 'idol');
          if (idols.length !== 1) bad(`${tag}: idols ${idols.length}`);
          else {
            const vets = squad.filter((p) => p.age >= 29);
            const pool = vets.length > 0 ? vets : squad.slice(0, 11);
            const top = Math.max(...pool.map((p) => p.overall));
            if (!pool.includes(idols[0]!) || idols[0]!.overall !== top)
              bad(`${tag}: idol not best veteran`);
          }
          const floor = Math.min(95, Math.ceil(cs.strength + 8));
          const youth = squad.slice(22);
          const jewel = Math.max(...youth.map((p) => p.potential));
          if (jewel < floor && jewel < Math.max(...youth.map((p) => p.overall)))
            bad(`${tag}: jewel`);
          if (jewel < Math.min(floor, 95)) bad(`${tag}: jewel ${jewel} < ${floor}`);
          // force of best XI within 0.5 of the effective strength
          const xi = bestEleven(squad, cs.preferredFormations[0]);
          const force = elevenStrength(xi);
          if (Math.abs(force - cs.strength) > 0.5 + 1e-9)
            bad(`${tag}: force ${force.toFixed(2)} vs ${cs.strength.toFixed(2)}`);
          if (cs.preferredFormations[0] === cs.preferredFormations[1])
            bad(`${tag}: same formations`);
        }
      }
      expect(problems).toEqual([]);
    },
    120_000,
  );

  it(
    'orders the clubs by the ladder (per seed top > bottom; on average by strength)',
    { timeout: 30_000 },
    () => {
      const sum: Record<string, number> = {};
      const top = clubs.reduce((a, b) => (b.strength! > a.strength! ? b : a));
      const low = clubs.reduce((a, b) => (b.strength! < a.strength! ? b : a));
      for (const seed of SEEDS.slice(0, 100)) {
        const state = game(seed);
        const mean = (id: string) =>
          elevenStrength(bestEleven(squadOf(state, id), state.clubs[id]!.preferredFormations[0]));
        expect(mean(top.id), `seed ${seed}`).toBeGreaterThan(mean(low.id));
        for (const def of clubs) sum[def.id] = (sum[def.id] ?? 0) + mean(def.id);
      }
      const sorted = [...clubs].sort((a, b) => b.strength! - a.strength!);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i]!.strength! < sorted[i - 1]!.strength!)
          expect(
            sum[sorted[i - 1]!.id]!,
            `${sorted[i - 1]!.id} vs ${sorted[i]!.id}`,
          ).toBeGreaterThan(sum[sorted[i]!.id]!);
      }
    },
  );

  it('is deterministic and does not mutate its inputs', () => {
    const before = JSON.stringify(clubs);
    const a = JSON.stringify(game(777));
    expect(JSON.stringify(game(777))).toBe(a);
    expect(JSON.stringify(game(778))).not.toBe(a);
    expect(JSON.stringify(clubs)).toBe(before);
  });
});
