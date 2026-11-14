import { describe, expect, it } from 'vitest';
import type { ClubDef } from './clubs.ts';
import { FORMATIONS, FORMATION_SLOTS, PROFILE_FORMATIONS } from './formations.ts';
import { newGame, type GameState } from './game.ts';
import {
  GENERATED_OVERALL_RANGE,
  GROUP_AGE,
  IDOL_MIN_AGE,
  JEWEL_POTENTIAL_MARGIN,
  SQUAD_GROUP_SIZES,
  START_MORALE,
  STRENGTH_TOLERANCE,
  TURN_ID_STRIDE,
  bestEleven,
  checkGeneratedSquad,
  drawClubProfile,
  drawPreferredFormations,
  elevenStrength,
  generateSquad,
  shiftSquad,
  turnPlayerId,
} from './generation.ts';
import {
  POSITIONS,
  POTENTIAL_MAX,
  SQUAD_COMPOSITION,
  SQUAD_SIZE,
  validatePlayer,
  type IdentitySource,
  type Player,
} from './players.ts';
import { Rng } from './rng.ts';
import { syntheticClubs, type MutableClubDef } from './testing/clubs.ts';
import { fixedIdentitySource } from './testing/identity.ts';
import { testParams } from './testing/params.ts';
import type { AiProfile, ClubSize } from './types.ts';
import { ENGINE_VERSION } from './version.ts';

/** The single strength ladder of the Série A (jogadores.md, clubes-serie-a.md). */
const LADDER = [78, 77, 76, 75, 74, 73, 72, 72, 71, 70, 70, 69, 68, 68, 67, 66, 65, 65, 64, 64];

/** 20 synthetic clubs on the ladder, with mixed profiles (one chaotic). */
function ladderClubs(): MutableClubDef[] {
  const profiles: AiProfile[] = ['ambitious', 'academy', 'seller', 'traditional', 'chaotic'];
  return syntheticClubs(20).map((club, i) => ({
    ...club,
    strength: LADDER[i]!,
    aiProfile: profiles[i % profiles.length]!,
  }));
}

const identities = fixedIdentitySource();
const params = testParams();

function play(seed: number, clubs: readonly ClubDef[] = ladderClubs()): GameState {
  const result = newGame({ seed, year: 2026, realism: 'full' }, clubs, params, identities);
  if (!result.ok) throw new Error(`newGame failed: ${JSON.stringify(result.detail)}`);
  expect(result.warnings).toEqual([]);
  return result.value;
}

function squadOf(state: GameState, clubId: string): Player[] {
  return state.squads[clubId]!.map((id) => state.players[id]!);
}

/**
 * Every squad rule of jogadores.md, for one state: the list of broken rules (empty when valid).
 * Plain checks instead of one `expect` per field, so 200 seeds stay fast.
 */
function stateProblems(state: GameState): string[] {
  const problems: string[] = [];
  const check = (okay: boolean, what: string) => {
    if (!okay) problems.push(what);
  };
  for (const [clubId, club] of Object.entries(state.clubs)) {
    const squad = squadOf(state, clubId);
    check(squad.length === SQUAD_SIZE, `${clubId}: size ${squad.length}`);
    for (const position of POSITIONS) {
      const n = squad.filter((p) => p.position === position).length;
      check(n === SQUAD_COMPOSITION[position], `${clubId}: ${n} ${position}`);
    }
    for (const p of squad) {
      const checked = validatePlayer(p);
      check(checked.ok, `${p.id}: ${JSON.stringify(checked.ok ? '' : checked.detail)}`);
      check(p.clubId === clubId, `${p.id}: club ${p.clubId}`);
      check(
        p.overall >= GENERATED_OVERALL_RANGE.min && p.overall <= GENERATED_OVERALL_RANGE.max,
        `${p.id}: overall ${p.overall}`,
      );
      check(p.potential >= p.overall, `${p.id}: potential ${p.potential} < ${p.overall}`);
      check(p.potential <= Math.max(POTENTIAL_MAX, p.overall), `${p.id}: potential ${p.potential}`);
      check(p.age >= 17 && p.age <= 34, `${p.id}: age ${p.age}`);
      check(p.morale >= START_MORALE.min && p.morale <= START_MORALE.max, `${p.id}: morale`);
      check(p.condition === 100, `${p.id}: condition ${p.condition}`);
    }
    check(new Set(squad.map((p) => p.shirt)).size === SQUAD_SIZE, `${clubId}: shirts`);
    const starterShirts = squad.slice(0, 11).map((p) => p.shirt);
    check(
      [...starterShirts].sort((a, b) => a - b).join() === '1,2,3,4,5,6,7,8,9,10,11',
      `${clubId}: starter shirts ${starterShirts.join()}`,
    );
    check(squad[11]!.position === 'GK' && squad[11]!.shirt === 12, `${clubId}: shirt 12`);
    check(
      squad.slice(SQUAD_SIZE - SQUAD_GROUP_SIZES.youth).every((p) => p.shirt >= 30),
      `${clubId}: youth shirts`,
    );
    check(
      squad.slice(12, SQUAD_SIZE - SQUAD_GROUP_SIZES.youth).every((p) => p.shirt >= 13),
      `${clubId}: squad shirts`,
    );
    check(new Set(squad.map((p) => p.name.display)).size === SQUAD_SIZE, `${clubId}: names`);
    const squadProblems = checkGeneratedSquad(squad, clubId, club.strength);
    check(squadProblems.length === 0, `${clubId}: ${squadProblems.join(', ')}`);

    // Joia: the youth with the highest potential reaches strength + 8 (cap 95).
    const youth = squad.slice(SQUAD_SIZE - SQUAD_GROUP_SIZES.youth);
    const floor = Math.min(POTENTIAL_MAX, Math.ceil(club.strength + JEWEL_POTENTIAL_MARGIN));
    check(Math.max(...youth.map((p) => p.potential)) >= floor, `${clubId}: no joia`);

    // Idol: exactly one, the starter of 29+ with the highest overall, or the best starter.
    const idols = squad.filter((p) => p.trait === 'idol');
    const veterans = squad.slice(0, 11).filter((p) => p.age >= IDOL_MIN_AGE);
    const pool = veterans.length > 0 ? veterans : squad.slice(0, 11);
    check(
      idols.length === 1 && idols[0]!.overall === Math.max(...pool.map((p) => p.overall)),
      `${clubId}: idol`,
    );

    // Best XI in the preferred formation within 0.5 of the effective strength.
    const xi = bestEleven(squad, club.preferredFormations[0]);
    const off = Math.abs(elevenStrength(xi) - club.strength);
    check(xi.length === 11 && off <= STRENGTH_TOLERANCE, `${clubId}: XI off by ${off}`);
  }
  return problems;
}

describe('newGame (US-004)', () => {
  it('gives identical squads for the same seed and different ones for another seed', () => {
    const a = play(2026);
    const b = play(2026);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(b).toStrictEqual(a);
    const c = play(2027);
    expect(JSON.stringify(c.players)).not.toBe(JSON.stringify(a.players));
  });

  it('starts season 1, round 1, with the identity revision and the engine version', () => {
    const state = play(7);
    expect(state).toMatchObject({
      engineVersion: ENGINE_VERSION,
      retiredNamesRev: identities.retiredRev,
      seed: 7,
      year: 2026,
      season: 1,
      round: 1,
      phase: 'season',
      rules: { realism: 'full' },
    });
    expect(Object.keys(state.clubs)).toHaveLength(20);
    expect(Object.keys(state.players)).toHaveLength(20 * SQUAD_SIZE);
    for (const club of Object.values(state.clubs)) {
      expect(club.fans).toBe(params.fans.start);
      expect(club.idolBenchStreak).toBe(0);
    }
  });

  it('keeps every squad rule in 200 seeds', { timeout: 30_000 }, () => {
    const problems: string[] = [];
    let idols = 0;
    let startingIdols = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const state = play(seed * 7919);
      problems.push(...stateProblems(state).map((p) => `seed ${seed * 7919}: ${p}`));
      for (const squad of Object.values(state.squads)) {
        const at = squad.findIndex((id) => state.players[id]!.trait === 'idol');
        idols++;
        if (at >= 0 && at < 11) startingIdols++;
      }
    }
    expect(problems).toEqual([]);
    // 200 careers × 20 clubs: every idol is one of the 11 generated starters.
    expect(idols).toBe(4000);
    expect(startingIdols).toBe(idols);
  });

  it('lays the squad out as XI by slot, 7 reserves, 4 rotation, 3 youth', () => {
    const state = play(99);
    for (const [clubId, club] of Object.entries(state.clubs)) {
      const squad = squadOf(state, clubId);
      expect(squad.slice(0, 11).map((p) => p.position)).toEqual(
        FORMATION_SLOTS[club.preferredFormations[0]],
      );
      expect(squad.map((p) => p.id)).toEqual(squad.map((_, i) => `${clubId}#${i + 1}`));
      // Reserves: one of each position first, the second goalkeeper wearing 12.
      expect(squad.slice(11, 17).map((p) => p.position)).toEqual([...POSITIONS]);
      const ranges = [
        [0, 11, GROUP_AGE.starters],
        [11, 18, GROUP_AGE.reserves],
        [18, 22, GROUP_AGE.rotation],
        [22, 25, GROUP_AGE.youth],
      ] as const;
      for (const [from, to, range] of ranges) {
        for (const p of squad.slice(from, to)) {
          expect(p.age).toBeGreaterThanOrEqual(range.min);
          expect(p.age).toBeLessThanOrEqual(range.max);
        }
      }
    }
  });

  it(
    'draws starters most often at 27, only Brazilians and the trait chances',
    { timeout: 30_000 },
    () => {
      const ages = new Map<number, number>();
      let total = 0;
      let brazilians = 0;
      const traits = new Map<string, number>();
      for (let seed = 1; seed <= 40; seed++) {
        const state = play(seed);
        for (const squad of Object.values(state.squads)) {
          squad.slice(0, 11).forEach((id) => {
            const age = state.players[id]!.age;
            ages.set(age, (ages.get(age) ?? 0) + 1);
          });
          for (const id of squad) {
            const p = state.players[id]!;
            total++;
            expect(p.nationality, `${id} (seed ${seed})`).toBe('BR');
            if (p.nationality === 'BR') brazilians++;
            traits.set(p.trait, (traits.get(p.trait) ?? 0) + 1);
          }
        }
      }
      const mode = [...ages.entries()].sort((a, b) => b[1] - a[1])[0]![0];
      expect(mode).toBe(27);
      // Etapa 1: every generated player is Brazilian (T-069, jogadores.md "Nacionalidade").
      expect(total).toBe(40 * 20 * 25);
      expect(brazilians).toBe(total);
      expect(traits.get('idol')).toBe(40 * 20);
      expect(traits.get('quiet')! / total).toBeGreaterThan(0.5);
      expect(traits.get('quiet')! / total).toBeLessThan(0.58);
    },
  );

  it(
    'orders the clubs by strength through their probable starters (US-004)',
    { timeout: 30_000 },
    () => {
      const sums = new Array<number>(20).fill(0);
      for (let seed = 1; seed <= 100; seed++) {
        const state = play(seed * 104729);
        const xi = ladderClubs().map((club) => {
          const c = state.clubs[club.id]!;
          return elevenStrength(bestEleven(squadOf(state, club.id), c.preferredFormations[0]));
        });
        expect(xi[0]!).toBeGreaterThan(xi[19]!);
        xi.forEach((value, i) => (sums[i] = sums[i]! + value));
      }
      for (let i = 1; i < 20; i++) {
        if (LADDER[i] === LADDER[i - 1]) continue;
        expect(sums[i - 1]!).toBeGreaterThan(sums[i]!);
      }
    },
  );

  it('refuses an invalid club list and never changes its inputs', () => {
    const clubs = ladderClubs();
    const broken = newGame(
      { seed: 1, year: 2026, realism: 'full' },
      clubs.slice(0, 19),
      params,
      identities,
    );
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.error).toBe('invalid-clubs');

    const frozen = structuredClone(clubs);
    const before = JSON.stringify(frozen);
    const frozenParams = structuredClone(params);
    play(1, frozen);
    expect(JSON.stringify(frozen)).toBe(before);
    expect(frozenParams).toStrictEqual(params);
  });

  it('fills a missing strength with 70 and a missing profile by size, with the warning', () => {
    const clubs = ladderClubs();
    delete clubs[0]!.strength;
    delete clubs[1]!.aiProfile;
    const result = newGame(
      { seed: 5, year: 2026, realism: 'simplified' },
      clubs,
      params,
      identities,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([
      { code: 'club-strength-default', detail: { clubId: clubs[0]!.id } },
    ]);
    expect(result.value.clubs[clubs[0]!.id]!.def.strength).toBe(70);
    expect(['ambitious', 'traditional', 'academy', 'seller']).toContain(
      result.value.clubs[clubs[1]!.id]!.profile,
    );
    expect(result.value.rules.realism).toBe('simplified');
    expect(stateProblems(result.value)).toEqual([]);
  });

  it('uses the exact strength when clubStrengthSd is 0', () => {
    const result = newGame(
      { seed: 3, year: 2026, realism: 'full' },
      ladderClubs(),
      testParams({ clubStrengthSd: 0 }),
      identities,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    ladderClubs().forEach((club, i) => {
      expect(result.value.clubs[club.id]!.strength).toBe(LADDER[i]);
    });
  });

  it('passes the names already given to the identity source, one call per nationality', () => {
    const calls: { nationality: string; count: number; existing: number; ages: number[] }[] = [];
    const faceAges = new Map<string, number>();
    const spy: IdentitySource = {
      retiredRev: 3,
      squad(req) {
        calls.push({
          nationality: req.nationality,
          count: req.count,
          existing: req.existing.length,
          ages: [...req.ages],
        });
        const ids = identities.squad(req);
        // Tag each face with the age asked for it, to check the order against the players.
        return ids.map((id, k) => {
          const face = `age-${k}-${id.faceSeed}`;
          faceAges.set(face, req.ages[k]!);
          return { ...id, face };
        });
      },
    };
    const result = newGame({ seed: 11, year: 2026, realism: 'full' }, ladderClubs(), params, spy);
    expect(result.ok && result.value.retiredNamesRev).toBe(3);
    // One age per identity, in order: each player got the face asked with its own age (T-027).
    for (const call of calls) expect(call.ages).toHaveLength(call.count);
    if (!result.ok) throw new Error('newGame failed');
    const players = Object.values(result.value.players);
    expect(faceAges.size).toBe(players.length);
    for (const player of players) expect(faceAges.get(player.face), player.id).toBe(player.age);
    // Per club the calls add up to 25 and each sees the names of the calls before it.
    let seen = 0;
    for (const call of calls) {
      if (call.existing === 0) seen = 0;
      expect(call.existing).toBe(seen);
      seen += call.count;
      expect(seen).toBeLessThanOrEqual(SQUAD_SIZE);
    }
    expect(calls.reduce((sum, c) => sum + c.count, 0)).toBe(20 * SQUAD_SIZE);
  });

  it('treats a broken identity source as a programming error', () => {
    const short: IdentitySource = { retiredRev: 0, squad: () => [] };
    expect(() =>
      newGame({ seed: 1, year: 2026, realism: 'full' }, ladderClubs(), params, short),
    ).toThrow(/IdentitySource/);
    const longFace: IdentitySource = {
      retiredRev: 0,
      squad: (req) => identities.squad(req).map((id) => ({ ...id, face: 'x'.repeat(33) })),
    };
    expect(() =>
      newGame({ seed: 1, year: 2026, realism: 'full' }, ladderClubs(), params, longFace),
    ).toThrow(/invalid/);
  });
});

describe('shirts (jogadores.md, "Camisas")', () => {
  const shirtsOf = (formation: (typeof FORMATIONS)[number]) =>
    generateSquad(
      { clubId: 'clube-teste-01', seed: 8, strength: 70, formation },
      params,
      identities,
    ).players;

  it('numbers a 4-3-3 the Brazilian way', () => {
    const squad = shirtsOf('4-3-3');
    const byPosition = (position: string) =>
      squad.slice(0, 11).flatMap((p) => (p.position === position ? [p.shirt] : []));
    expect(byPosition('GK')).toEqual([1]);
    expect(byPosition('FB')).toEqual([2, 6]);
    expect(byPosition('CB')).toEqual([3, 4]);
    expect(byPosition('DM')).toEqual([5]);
    expect(byPosition('AM')).toEqual([10, 8]);
    expect(byPosition('ST')).toEqual([9, 11, 7]);
    expect(squad[11]!.shirt).toBe(12);
  });

  it('gives the reserves and rotation the lowest free from 13 and the youth from 30', () => {
    const squad = shirtsOf('4-4-2');
    const rest = squad.slice(11, 22);
    const reserveGk = rest.findIndex((p) => p.position === 'GK');
    expect(rest[reserveGk]!.shirt).toBe(12);
    expect(rest.filter((_, i) => i !== reserveGk).map((p) => p.shirt)).toEqual([
      13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
    ]);
    expect(squad.slice(22).map((p) => p.shirt)).toEqual([30, 31, 32]);
  });
});

describe('bestEleven', () => {
  it('breaks a full tie by the number of the id, not its text', () => {
    const twin = { position: 'ST' as const, secondaryPosition: null, overall: 70, age: 25 };
    const squad = [
      { ...twin, id: 'c#10' },
      { ...twin, id: 'c#2' },
    ];
    // Identical players, no goalkeeper: the goal is filled last, so the first outfield slot (CB)
    // takes the lower id, c#2, and the goal the other one.
    expect(bestEleven(squad, '4-4-2').map(({ player, slot }) => [player.id, slot])).toEqual([
      ['c#10', 'GK'],
      ['c#2', 'CB'],
    ]);
  });
});

describe('squad shift fallback', () => {
  it('reaches the window by single-point moves when no common shift does (clipped starters)', () => {
    // With the "natural primeiro" best XI no generated squad needs the fallback (T-082), so the
    // squad is made by hand: ten starters at the cap and one at 72. A common shift only moves
    // the one at 72 (1/11 per point), so no d in the search lands within 0.5 of a target 1.0
    // above; the single-point moves raise him until it does.
    const { max } = GENERATED_OVERALL_RANGE;
    const squad = generateSquad(
      { clubId: 'clube-teste-01', seed: 81, strength: 70, formation: '4-4-2' },
      params,
      identities,
    ).players.map((p, i) => ({
      ...p,
      attributes: { ...p.attributes },
      overall: i < 10 ? max : i === 10 ? 72 : Math.min(p.overall, 60),
    }));
    const target = elevenStrength(bestEleven(squad, '4-4-2')) + 1;
    const result = shiftSquad(squad, '4-4-2', target);
    expect(result.fineSteps).toBeGreaterThan(0);
    expect(Math.abs(result.diff)).toBeLessThanOrEqual(STRENGTH_TOLERANCE);
    expect(Math.abs(target - elevenStrength(bestEleven(squad, '4-4-2')))).toBeLessThanOrEqual(
      STRENGTH_TOLERANCE,
    );
  });
});

describe('club profile and formations', () => {
  it('draws the default profile by size with the ia-clubes.md weights', () => {
    const rng = new Rng(1);
    const sizes: ClubSize[] = ['big', 'medium', 'small'];
    const allowed: Record<ClubSize, AiProfile[]> = {
      big: ['ambitious', 'traditional', 'academy', 'seller'],
      medium: ['academy', 'traditional', 'seller', 'chaotic'],
      small: ['seller', 'traditional'],
    };
    for (const size of sizes) {
      const counts = new Map<AiProfile, number>();
      for (let i = 0; i < 12_000; i++) {
        const p = drawClubProfile(rng, size);
        counts.set(p, (counts.get(p) ?? 0) + 1);
      }
      expect([...counts.keys()].sort()).toEqual([...allowed[size]].sort());
      if (size === 'small') expect(counts.get('seller')! / 12_000).toBeCloseTo(2 / 3, 1);
      if (size === 'big') expect(counts.get('seller')! / 12_000).toBeCloseTo(1 / 12, 1);
    }
  });

  it('puts the drawn preferred formation first, from the profile pair or two distinct ones', () => {
    const rng = new Rng(2);
    for (const profile of ['ambitious', 'academy', 'seller', 'traditional'] as const) {
      const firsts = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const pair = drawPreferredFormations(rng, profile);
        expect([...pair].sort()).toEqual([...PROFILE_FORMATIONS[profile]].sort());
        firsts.add(pair[0]);
      }
      expect(firsts.size).toBe(2);
    }
    for (let i = 0; i < 100; i++) {
      const [a, b] = drawPreferredFormations(rng, 'chaotic');
      expect(FORMATIONS).toContain(a);
      expect(FORMATIONS).toContain(b);
      expect(a).not.toBe(b);
    }
  });
});

describe('generateSquad', () => {
  it('builds a valid squad for every formation and strengths at both ends', () => {
    for (const formation of FORMATIONS) {
      for (const strength of [52, 55, 70, 85, 88]) {
        const squad = generateSquad(
          { clubId: 'clube-teste-01', seed: 42, strength, formation },
          params,
          identities,
        );
        expect(squad.warnings).toEqual([]);
        expect(checkGeneratedSquad(squad.players, 'clube-teste-01', strength)).toEqual([]);
        expect(Math.abs(squad.elevenStrength - strength)).toBeLessThanOrEqual(STRENGTH_TOLERANCE);
      }
    }
  });

  it('reports what checkGeneratedSquad finds', () => {
    const squad = generateSquad(
      { clubId: 'clube-teste-01', seed: 1, strength: 70, formation: '4-4-2' },
      params,
      identities,
    ).players;
    const broken = squad.map((p, i) => ({
      ...p,
      trait: 'quiet' as const,
      ...(i === 1 ? { shirt: 1, position: 'GK' as const } : {}),
    }));
    expect(checkGeneratedSquad(broken, 'clube-teste-01', 70).sort()).toEqual(
      ['composition', 'duplicate-shirt', 'idol-count'].sort(),
    );
    // The idol must be one of the 11 starters (jogadores.md, revised on 2026-11-05).
    const benchIdol = squad.map((p, i) => ({
      ...p,
      trait: i === 15 ? ('idol' as const) : p.trait === 'idol' ? ('quiet' as const) : p.trait,
    }));
    expect(checkGeneratedSquad(benchIdol, 'clube-teste-01', 70)).toEqual(['idol-not-starter']);
    expect(checkGeneratedSquad(squad.slice(1), 'clube-teste-02', 99)).toEqual(
      expect.arrayContaining(['size', 'wrong-club', 'no-jewel']),
    );
  });
});

describe('generateSquad with the season (T-048; docs/02-architecture.md, 4.1)', () => {
  const request = { clubId: 'clube-teste-01', seed: 42, strength: 70, formation: '4-3-3' as const };

  it('gives the squad of the new game with season 1 (labels and ids unchanged)', () => {
    const plain = generateSquad(request, params, identities);
    expect(generateSquad({ ...request, season: 1 }, params, identities)).toEqual(plain);
    expect(plain.players.map((p) => p.id)).toEqual(
      Array.from({ length: SQUAD_SIZE }, (_, i) => `clube-teste-01#${i + 1}`),
    );
  });

  it('gives another squad from season 2, with ids that never meet those of season 1', () => {
    const first = generateSquad(request, params, identities).players;
    const second = generateSquad({ ...request, season: 2 }, params, identities).players;
    expect(TURN_ID_STRIDE).toBe(100);
    expect(second.map((p) => p.id)).toEqual(
      Array.from({ length: SQUAD_SIZE }, (_, i) => `clube-teste-01#${201 + i}`),
    );
    expect(second.map((p) => p.id)).toEqual(
      Array.from({ length: SQUAD_SIZE }, (_, i) => turnPlayerId('clube-teste-01', 2, i + 1)),
    );
    const ids = new Set(first.map((p) => p.id));
    expect(second.some((p) => ids.has(p.id))).toBe(false);
    // Another draw: the overalls, ages and identity seeds of the squad are not the same.
    expect(second.map((p) => [p.overall, p.age])).not.toEqual(first.map((p) => [p.overall, p.age]));
    expect(second.map((p) => p.nameSeed)).not.toEqual(first.map((p) => p.nameSeed));
    expect(checkGeneratedSquad(second, 'clube-teste-01', 70)).toEqual([]);
    // Season 3 is another squad again.
    const third = generateSquad({ ...request, season: 3 }, params, identities).players;
    expect(third[0]!.id).toBe('clube-teste-01#301');
    expect(third.map((p) => p.overall)).not.toEqual(second.map((p) => p.overall));
  });
});
