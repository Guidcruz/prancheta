import { describe, expect, it } from 'vitest';
import {
  BENCH_SIZE,
  CHAOTIC_POSTURE_WEIGHTS,
  CHAOTIC_PRESSURE_WEIGHTS,
  aiSeed,
  pickBench,
  pickCaptainAndTakers,
  pickEleven,
  profileTactic,
  strengthDelta,
  suggestSheet,
  validateLineup,
  type SuggestState,
} from './ai.ts';
import { FORMATIONS, FORMATION_SLOTS } from './formations.ts';
import type { ClubState, GameState } from './game.ts';
import type { TeamSheet } from './lineup.ts';
import { simulateMatch } from './match/simulate.ts';
import type { Player } from './players.ts';
import { Rng } from './rng.ts';
import { teamStrength } from './strength.ts';
import { syntheticClubs } from './testing/clubs.ts';
import { testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';
import { testPlayer, type MutablePlayer } from './testing/players.ts';
import type { AiProfile, Formation, Position } from './types.ts';

const params = testParams();
const AI = params.ai;

/*
 * Hand-made clubs: `c` (and `o`, the opponent) with squads given position by position, so each
 * test controls who is the best for each slot. Ids are `c#1`... in the order given; every player
 * is 27 unless the test says otherwise (ties then fall to the id number).
 */
type Spec = [Position, number, Partial<MutablePlayer>?];

function squad(clubId: string, specs: readonly Spec[]): MutablePlayer[] {
  return specs.map(([position, overall, extra], i) =>
    testPlayer({
      id: `${clubId}#${i + 1}`,
      clubId,
      shirt: i + 1,
      position,
      overall,
      age: 27,
      trait: 'quiet',
      ...extra,
    }),
  );
}

/** A full 4-4-2 XI plus a bench of 7 (one per line and a goalkeeper), all at `overall`. */
function fullSquad(clubId: string, overall = 70): Spec[] {
  const xi: Position[] = ['GK', 'CB', 'CB', 'FB', 'FB', 'DM', 'DM', 'AM', 'AM', 'ST', 'ST'];
  const reserves: Position[] = ['GK', 'CB', 'FB', 'DM', 'AM', 'ST', 'ST'];
  return [...xi.map((p): Spec => [p, overall]), ...reserves.map((p): Spec => [p, overall - 10])];
}

function clubState(
  id: string,
  profile: AiProfile,
  formations: readonly [Formation, Formation],
): ClubState {
  return {
    def: { ...syntheticClubs(1)[0]!, id },
    profile,
    strength: 70,
    preferredFormations: formations,
    fans: 60,
    idolBenchStreak: 0,
  };
}

interface Built {
  state: SuggestState;
  players: MutablePlayer[];
}

function build(
  specs: readonly Spec[],
  options: {
    profile?: AiProfile;
    formations?: readonly [Formation, Formation];
    opponent?: readonly Spec[];
    opponentProfile?: AiProfile;
    venue?: 'home' | 'away';
    round?: number;
  } = {},
): Built {
  const players = squad('c', specs);
  const opponent = squad('o', options.opponent ?? fullSquad('o'));
  const all = [...players, ...opponent];
  const fixtures =
    options.venue === undefined
      ? []
      : [
          {
            id: 'f',
            round: options.round ?? 1,
            date: '2026-04-12',
            homeId: options.venue === 'home' ? 'c' : 'o',
            awayId: options.venue === 'home' ? 'o' : 'c',
          },
        ];
  return {
    players,
    state: {
      seed: 7,
      season: 1,
      round: options.round ?? 1,
      clubs: {
        c: clubState(
          'c',
          options.profile ?? 'traditional',
          options.formations ?? ['4-4-2', '3-5-2'],
        ),
        o: clubState('o', options.opponentProfile ?? 'traditional', ['4-4-2', '3-5-2']),
      },
      players: Object.fromEntries(all.map((p) => [p.id, p])),
      squads: { c: players.map((p) => p.id), o: opponent.map((p) => p.id) },
      fixtures,
    },
  };
}

function playersOf(state: SuggestState, ids: readonly string[]): Player[] {
  return ids.map((id) => state.players[id]!);
}

describe('US-011 "escalação válida": suggestSheet', () => {
  it('gives every club 11 starters, one goalkeeper in goal, nobody unavailable, a valid formation', () => {
    const state = testGame();
    for (const clubId of Object.keys(state.clubs)) {
      const sheet = suggestSheet(state, params, clubId);
      const { formation, starters, bench } = sheet.lineup;
      expect(FORMATIONS).toContain(formation);
      expect(starters).toHaveLength(11);
      expect(new Set([...starters, ...bench]).size).toBe(starters.length + bench.length);
      const xi = playersOf(state, starters);
      expect(xi[0]!.position).toBe('GK');
      expect(xi.filter((p) => p.position === 'GK')).toHaveLength(1);
      for (const p of [...xi, ...playersOf(state, bench)]) {
        expect(p.clubId).toBe(clubId);
        expect(p.injuryRounds).toBe(0);
        expect(p.suspendedGames).toBe(0);
      }
      expect(bench).toHaveLength(BENCH_SIZE);
      expect(validateLineup(state, clubId, sheet).ok).toBe(true);
    }
  });

  it('leaves out the injured and the suspended, even the best of the squad', () => {
    const specs = fullSquad('c');
    specs[9] = ['ST', 90, { injuryRounds: 2 }];
    specs[10] = ['ST', 88, { suspendedGames: 1 }];
    specs[0] = ['GK', 85, { injuryRounds: 1 }];
    const { state } = build(specs);
    const sheet = suggestSheet(state, params, 'c');
    const all = [...sheet.lineup.starters, ...sheet.lineup.bench];
    expect(all).not.toContain('c#10');
    expect(all).not.toContain('c#11');
    expect(all).not.toContain('c#1');
    // The reserve goalkeeper (c#12) goes in goal; the bench has no goalkeeper left.
    expect(sheet.lineup.starters[0]).toBe('c#12');
    expect(validateLineup(state, 'c', sheet).ok).toBe(true);
  });

  it('fills a slot without a natural player with the best of any position (with the fit)', () => {
    // No full-back at all: the FB slots take whoever has the highest overall × fit there.
    const specs: Spec[] = [
      ['GK', 70],
      ['CB', 70],
      ['CB', 70],
      ['CB', 66],
      ['DM', 72],
      ['DM', 70],
      ['DM', 69],
      ['AM', 70],
      ['AM', 70],
      ['ST', 70],
      ['ST', 70],
      ['ST', 60],
    ];
    const { state } = build(specs, { formations: ['4-4-2', '4-4-2'] });
    const xi = playersOf(state, suggestSheet(state, params, 'c').lineup.starters);
    const slots = FORMATION_SLOTS['4-4-2'];
    // FB slots (3 and 4): DM 72 × 0.85 = 61.2 beats CB 66 × 0.90 = 59.4 for the first; for the
    // second, DM 70 × 0.85 = 59.5 beats CB 66 × 0.90 = 59.4.
    expect(slots[3]).toBe('FB');
    expect(xi[3]!.id).toBe('c#5');
    expect(xi[4]!.position).toBe('DM');
    expect(xi).toHaveLength(11);
  });
});

describe('US-011 "rotação por fadiga"', () => {
  // XI at 80 and fresh, except the first striker (c#10); the first reserve striker (c#17) is
  // fresh, the second (c#18) is too weak to matter.
  const tiredSpecs = (condition: number, reserve: number): Spec[] => {
    const specs = fullSquad('c', 80);
    specs[9] = ['ST', 80, { condition }];
    specs[16] = ['ST', reserve];
    specs[17] = ['ST', 50];
    return specs;
  };

  it('starts the fit reserve instead of a tired starter when he is worth at least 90%', () => {
    // Starter: 80 × (0.80 + 0.20 × 0.80) = 76.8; reserve 74 ≥ 0.90 × 76.8 = 69.12. The greedy
    // pick puts the fresh c#11 in the first ST slot and c#10 (76.8 > 74) in the second.
    const { state } = build(tiredSpecs(80, 74), { formations: ['4-4-2', '4-4-2'] });
    const { starters, rested } = pickEleven(playersOf(state, state.squads.c!), '4-4-2', AI);
    expect(starters[10]!.id).toBe('c#17');
    expect(rested.map((p) => p.id)).toEqual(['c#10']);
    const sheet = suggestSheet(state, params, 'c');
    expect(sheet.lineup.starters).toContain('c#17');
    expect(sheet.lineup.starters).not.toContain('c#10');
    // The rested starter stays available on the bench.
    expect(sheet.lineup.bench).toContain('c#10');
  });

  it('keeps the tired starter when the reserve is worth less than 90% of him', () => {
    // 69 < 69.12.
    const { state } = build(tiredSpecs(80, 69), { formations: ['4-4-2', '4-4-2'] });
    expect(suggestSheet(state, params, 'c').lineup.starters).toContain('c#10');
  });

  it('rotates only below ai.rotationCondition (85 is not below)', () => {
    // At 85: 80 × 0.97 = 77.6, and a reserve of 74 would be ≥ 69.84, but 85 is not tired.
    const { state } = build(tiredSpecs(85, 74), { formations: ['4-4-2', '4-4-2'] });
    expect(suggestSheet(state, params, 'c').lineup.starters).toContain('c#10');
    const lower = { ...params, ai: { ...AI, rotationCondition: 90 } };
    expect(suggestSheet(state, lower, 'c').lineup.starters).not.toContain('c#10');
  });

  it('reads ai.rotationMinRatio', () => {
    const { state } = build(tiredSpecs(80, 74), { formations: ['4-4-2', '4-4-2'] });
    const strict = { ...params, ai: { ...AI, rotationMinRatio: 1 } };
    expect(suggestSheet(state, strict, 'c').lineup.starters).toContain('c#10');
  });

  it('never picks a rested starter again for another slot', () => {
    // CB c#2 (condition 72: 75.52) gives way to the reserve CB c#13 (70 ≥ 67.97). Then FB c#4
    // (condition 70: 75.2) is tired too; the rested c#2 would be worth 80 × 0.90 × 0.944 =
    // 67.97 ≥ 0.90 × 75.2 at full-back, but he is resting, and the reserve FB (60) is not enough.
    const specs = fullSquad('c', 80);
    specs[1] = ['CB', 80, { condition: 72 }];
    specs[3] = ['FB', 80, { condition: 70 }];
    specs[13] = ['FB', 60];
    const { state } = build(specs, { formations: ['4-4-2', '4-4-2'] });
    const { starters, rested } = pickEleven(playersOf(state, state.squads.c!), '4-4-2', AI);
    expect(starters.map((p) => p.id)).toEqual([
      'c#1',
      'c#3',
      'c#13',
      'c#5',
      'c#4',
      'c#6',
      'c#7',
      'c#8',
      'c#9',
      'c#10',
      'c#11',
    ]);
    expect(rested.map((p) => p.id)).toEqual(['c#2']);
  });
});

describe('US-011 "elenco sem reservas aptos"', () => {
  it('lines up every available player when there are fewer than 11, and the match plays on', () => {
    const specs = fullSquad('c').map(([position, overall], i): Spec => [
      position,
      overall,
      i < 9 ? {} : { injuryRounds: 3 },
    ]);
    const { state } = build(specs);
    const sheet = suggestSheet(state, params, 'c');
    expect(sheet.lineup.starters).toHaveLength(9);
    expect(sheet.lineup.bench).toEqual([]);
    expect(validateLineup(state, 'c', sheet)).toMatchObject({ ok: false, error: 'wrong-count' });

    const opponent = suggestSheet(state, params, 'o');
    const input = (clubId: 'c' | 'o', s: TeamSheet) => ({
      clubId,
      sheet: s,
      controller: 'ai' as const,
      profile: 'traditional' as const,
      fans: 60,
      players: playersOf(state, state.squads[clubId]!),
    });
    const result = simulateMatch(
      {
        fixtureId: 'f',
        seed: 1,
        home: input('c', sheet),
        away: input('o', opponent),
        derby: false,
        neutral: false,
        rules: { realism: 'full' },
      },
      params,
    );
    const played = Object.keys(result.minutes).filter((id) => id.startsWith('c#'));
    expect(played.length).toBeLessThanOrEqual(9);
    expect(result.warnings.some((w) => w.code === 'lineup-wrong-count')).toBe(true);
  });

  it('with nobody available gives an empty sheet that the match still plays (abandoned)', () => {
    const specs = fullSquad('c').map(([p, o]): Spec => [p, o, { suspendedGames: 1 }]);
    const { state } = build(specs);
    const sheet = suggestSheet(state, params, 'c');
    expect(sheet.lineup.starters).toEqual([]);
    expect(sheet.lineup.captains).toEqual([]);
    expect(sheet.tactic.posture).toBeDefined();
  });

  it('with no goalkeeper available puts the best outfield player by selection value in goal', () => {
    const specs = fullSquad('c').map(([p, o]): Spec => [
      p,
      o,
      p === 'GK' ? { injuryRounds: 2 } : {},
    ]);
    specs[5] = ['DM', 82];
    const { state } = build(specs);
    const sheet = suggestSheet(state, params, 'c');
    // overall × 0.40 for everyone: the DM of 82 is the highest.
    expect(sheet.lineup.starters[0]).toBe('c#6');
    expect(sheet.lineup.starters).toHaveLength(11);
    // "Banco sem goleiro": 7 outfield players (or as many as are left).
    expect(playersOf(state, sheet.lineup.bench).every((p) => p.position !== 'GK')).toBe(true);
  });
});

describe('formation of the match', () => {
  it('takes the preferred formation whose XI has the highest sum of eff', () => {
    // Three centre-backs of 80, full-backs of 70, the rest 72 (all fresh, same morale). 4-4-2:
    // 70 + 80 + 80 + 72 (the third CB at full-back) + 70 + 6 × 72 = 804. 3-5-2: 70 + 3 × 80 +
    // 2 × 70 + 5 × 72 = 810 (the sixth 72 sits out).
    const specs: Spec[] = [
      ['GK', 70],
      ['CB', 80],
      ['CB', 80],
      ['CB', 80],
      ['FB', 70],
      ['FB', 70],
      ['DM', 72],
      ['DM', 72],
      ['AM', 72],
      ['AM', 72],
      ['ST', 72],
      ['ST', 72],
    ];
    const { state } = build(specs, { formations: ['4-4-2', '3-5-2'] });
    expect(suggestSheet(state, params, 'c').lineup.formation).toBe('3-5-2');
    const reversed = build(specs, { formations: ['3-5-2', '4-4-2'] }).state;
    expect(suggestSheet(reversed, params, 'c').lineup.formation).toBe('3-5-2');
  });

  it('keeps the first one on a tie', () => {
    const { state } = build(fullSquad('c'), { formations: ['4-4-2', '4-4-2'] });
    expect(suggestSheet(state, params, 'c').lineup.formation).toBe('4-4-2');
    const both = build(fullSquad('c'), { formations: ['4-3-3', '4-3-3'] }).state;
    expect(suggestSheet(both, params, 'c').lineup.formation).toBe('4-3-3');
  });

  it('the chaotic profile draws among the six, whatever its preferred pair', () => {
    const seen = new Set<Formation>();
    for (let round = 1; round <= 60; round++) {
      const { state } = build(fullSquad('c'), {
        profile: 'chaotic',
        formations: ['4-4-2', '4-3-3'],
        round,
      });
      const sheet = suggestSheet(state, params, 'c');
      seen.add(sheet.lineup.formation);
      const rng = new Rng(aiSeed(state, 'c'));
      expect(sheet.lineup.formation).toBe(FORMATIONS[rng.int(0, 5)]);
    }
    expect(seen.size).toBe(6);
  });
});

describe('bench (ia-clubes.md, "Escalação", step 5)', () => {
  it('has 1 goalkeeper, then the 6 of highest overall, with a defender, a midfielder and an attacker', () => {
    const rest = squad('c', [
      ['ST', 80],
      ['ST', 79],
      ['AM', 78],
      ['ST', 77],
      ['AM', 76],
      ['ST', 75],
      ['ST', 74],
      ['GK', 60],
      ['CB', 50],
      ['GK', 59],
    ]);
    const bench = pickBench(rest).map((p) => p.id);
    // GK 60 first; the defender (CB 50) forces its way in over the 6th-best overall.
    expect(bench).toEqual(['c#8', 'c#1', 'c#2', 'c#3', 'c#4', 'c#5', 'c#9']);
  });

  it('may take a second goalkeeper among the 6 of highest overall', () => {
    const rest = squad('c', [
      ['GK', 75],
      ['GK', 74],
      ['CB', 70],
      ['DM', 70],
      ['ST', 70],
      ['ST', 60],
      ['ST', 60],
      ['ST', 60],
    ]);
    expect(pickBench(rest).map((p) => p.id)).toEqual([
      'c#1',
      'c#2',
      'c#3',
      'c#4',
      'c#5',
      'c#6',
      'c#7',
    ]);
  });

  it('takes 7 outfield players without a goalkeeper, and everyone when fewer than 7 are left', () => {
    const rest = squad('c', [
      ['ST', 80],
      ['ST', 79],
      ['ST', 78],
      ['ST', 77],
      ['ST', 76],
      ['ST', 75],
      ['ST', 74],
      ['ST', 73],
      ['DM', 50],
    ]);
    const bench = pickBench(rest).map((p) => p.id);
    expect(bench).toHaveLength(7);
    expect(bench).toContain('c#9');
    expect(bench).not.toContain('c#8');
    expect(pickBench(rest.slice(0, 3))).toHaveLength(3);
    expect(pickBench([])).toEqual([]);
  });

  it('breaks overall ties by younger, then the lower id number', () => {
    const rest = squad('c', [
      ['ST', 70, { age: 30 }],
      ['ST', 70, { age: 20 }],
    ]);
    expect(pickBench(rest).map((p) => p.id)).toEqual(['c#2', 'c#1']);
  });
});

describe('captain and takers (step 6)', () => {
  const xi = (extra: Partial<MutablePlayer>[]) =>
    squad(
      'c',
      extra.map((e, i): Spec => [i === 0 ? 'GK' : 'ST', 70, e]),
    );

  it('captain: the leader of highest overall; ties keep the first in slot order', () => {
    const players = xi([
      { age: 35 },
      { trait: 'leader', overall: 72 },
      { trait: 'leader', overall: 75 },
      { trait: 'leader', overall: 75 },
    ]);
    expect(pickCaptainAndTakers(players).captains).toEqual(['c#3']);
  });

  it('captain without a leader: the oldest; ties keep the first in slot order', () => {
    const players = xi([{ age: 30 }, { age: 33 }, { age: 33, trait: 'idol' }]);
    expect(pickCaptainAndTakers(players).captains).toEqual(['c#2']);
  });

  it('penalty: highest finishing; free kick: highest technique (goalkeeper by attributeOf)', () => {
    const attrs = (finishing: number, technique: number) => ({
      speed: 60,
      technique,
      passing: 60,
      finishing,
      marking: 30,
      physical: 60,
    });
    const players = [
      testPlayer({ id: 'c#1', position: 'GK', overall: 99 }),
      testPlayer({ id: 'c#2', attributes: attrs(80, 70) }),
      testPlayer({ id: 'c#3', attributes: attrs(85, 60) }),
      testPlayer({ id: 'c#4', attributes: attrs(85, 75) }),
      testPlayer({ id: 'c#5', attributes: attrs(60, 75) }),
    ];
    // The goalkeeper of 99 finishes as round(0.4 × 99) = 40.
    const picked = pickCaptainAndTakers(players);
    expect(picked.penaltyTakers).toEqual(['c#3']);
    expect(picked.freeKickTakers).toEqual(['c#4']);
  });

  it('suggestSheet fills one captain and one taker of each kind, all starters', () => {
    const state = testGame();
    for (const clubId of Object.keys(state.clubs)) {
      const { lineup } = suggestSheet(state, params, clubId);
      for (const list of [lineup.captains, lineup.penaltyTakers, lineup.freeKickTakers]) {
        expect(list).toHaveLength(1);
        expect(lineup.starters).toContain(list[0]);
      }
    }
  });
});

describe('tactic by profile (ia-clubes.md, "Perfis na 1a")', () => {
  const fresh = 100;
  const t = (profile: AiProfile, delta: number, venue: 'home' | 'away' | 'neutral') =>
    profileTactic(profile, delta, venue, fresh, AI);

  it('Δ = own + 4 at home − opponent − 4 away (the example of the doc)', () => {
    expect(strengthDelta(76, 64, 'home')).toBe(16);
    expect(strengthDelta(76, 77, 'away')).toBe(-5);
    expect(strengthDelta(76, 77, 'neutral')).toBe(-1);
    expect(t('ambitious', 16, 'home')).toEqual({ posture: 'attacking', pressure: 'high' });
    expect(t('ambitious', -5, 'away')).toEqual({ posture: 'balanced', pressure: 'medium' });
  });

  it('ambitious: attacking from Δ −2, defensive up to Δ −10; high at home, medium elsewhere', () => {
    expect(t('ambitious', -2, 'away').posture).toBe('attacking');
    expect(t('ambitious', -2.01, 'away').posture).toBe('balanced');
    expect(t('ambitious', -9.99, 'home').posture).toBe('balanced');
    expect(t('ambitious', -10, 'home')).toEqual({ posture: 'defensive', pressure: 'high' });
    expect(t('ambitious', 0, 'neutral').pressure).toBe('medium');
  });

  it('academy: attacking from Δ 0, defensive up to Δ −8; always high', () => {
    expect(t('academy', 0, 'away')).toEqual({ posture: 'attacking', pressure: 'high' });
    expect(t('academy', -0.01, 'home')).toEqual({ posture: 'balanced', pressure: 'high' });
    expect(t('academy', -8, 'neutral')).toEqual({ posture: 'defensive', pressure: 'high' });
  });

  it('seller: balanced, defensive up to Δ −6; always medium', () => {
    expect(t('seller', 30, 'home')).toEqual({ posture: 'balanced', pressure: 'medium' });
    expect(t('seller', -5.99, 'away').posture).toBe('balanced');
    expect(t('seller', -6, 'home')).toEqual({ posture: 'defensive', pressure: 'medium' });
  });

  it('traditional: balanced, defensive only away and up to Δ −4; always medium', () => {
    expect(t('traditional', 30, 'home')).toEqual({ posture: 'balanced', pressure: 'medium' });
    expect(t('traditional', -4, 'away')).toEqual({ posture: 'defensive', pressure: 'medium' });
    expect(t('traditional', -3.99, 'away').posture).toBe('balanced');
    expect(t('traditional', -20, 'home').posture).toBe('balanced');
    expect(t('traditional', -20, 'neutral').posture).toBe('balanced');
  });

  it('an unknown profile plays as traditional', () => {
    expect(t('galáctico' as AiProfile, -4, 'away')).toEqual(t('traditional', -4, 'away'));
    expect(t('galáctico' as AiProfile, 20, 'home')).toEqual(t('traditional', 20, 'home'));
  });

  it('chaotic: posture 50/30/20 and pressure 50/30/20, whatever Δ and the venue', () => {
    const count = { attacking: 0, balanced: 0, defensive: 0, high: 0, medium: 0, low: 0 };
    const n = 20_000;
    for (let i = 0; i < n; i++) {
      const { posture, pressure } = profileTactic('chaotic', -50, 'away', fresh, AI, new Rng(i));
      count[posture] += 1;
      count[pressure] += 1;
    }
    for (const [value, weight] of [...CHAOTIC_POSTURE_WEIGHTS, ...CHAOTIC_PRESSURE_WEIGHTS]) {
      expect(count[value] / n).toBeGreaterThan(weight - 0.015);
      expect(count[value] / n).toBeLessThan(weight + 0.015);
    }
    expect(() => profileTactic('chaotic', 0, 'home', fresh, AI)).toThrow();
  });

  it('a tired XI (mean condition below ai.tiredTeamCondition) presses low, in every profile', () => {
    for (const profile of ['ambitious', 'academy', 'seller', 'traditional', 'chaotic'] as const) {
      expect(profileTactic(profile, 20, 'home', 84.99, AI, new Rng(3)).pressure).toBe('low');
    }
    for (const profile of ['ambitious', 'academy', 'seller', 'traditional'] as const) {
      expect(profileTactic(profile, 20, 'home', 85, AI).pressure).not.toBe('low');
    }
    const strict = { tiredTeamCondition: 95 };
    expect(profileTactic('academy', 0, 'home', 90, strict).pressure).toBe('low');
    // The chaotic pressure is still drawn (fixed consumption): the next draw does not move.
    const a = new Rng(9);
    profileTactic('chaotic', 0, 'home', 50, AI, a);
    const b = new Rng(9);
    profileTactic('chaotic', 0, 'home', 100, AI, b);
    expect(a.next()).toBe(b.next());
  });
});

describe('suggestSheet: tactic from the state', () => {
  it('reads the venue from the fixture of the current round and Δ from the shown strengths', () => {
    // Own XI at 80, opponent at 70: Δ = 80 + 4 − 70 = 14 at home, 80 − 70 − 4 = 6 away.
    const home = build(fullSquad('c', 80), { profile: 'ambitious', venue: 'home' }).state;
    const away = build(fullSquad('c', 80), { profile: 'ambitious', venue: 'away' }).state;
    expect(suggestSheet(home, params, 'c', 'o').tactic).toEqual({
      posture: 'attacking',
      pressure: 'high',
    });
    expect(suggestSheet(away, params, 'c', 'o').tactic).toEqual({
      posture: 'attacking',
      pressure: 'medium',
    });
    // Without opponentId, the club's fixture of the round gives the same answer.
    expect(suggestSheet(home, params, 'c')).toEqual(suggestSheet(home, params, 'c', 'o'));
  });

  it('the opponent strength is teamStrength without a lineup', () => {
    // Seller at 70 visiting a club at 80: Δ = 70 − 80 − 4 = −14 → defensive.
    const { state } = build(fullSquad('c', 70), {
      profile: 'seller',
      venue: 'away',
      opponent: fullSquad('o', 80),
    });
    expect(teamStrength(state, 'o')).toBe(80);
    expect(suggestSheet(state, params, 'c', 'o').tactic.posture).toBe('defensive');
    // Traditional at home against the same: balanced (defensive only away).
    const home = build(fullSquad('c', 70), {
      venue: 'home',
      opponent: fullSquad('o', 80),
    }).state;
    expect(suggestSheet(home, params, 'c', 'o').tactic.posture).toBe('balanced');
  });

  it('without a fixture this round it plays on neutral ground; without an opponent, Δ = 0', () => {
    const { state } = build(fullSquad('c', 70), {
      profile: 'traditional',
      opponent: fullSquad('o', 75),
    });
    // Neutral, Δ = −5: the traditional one is balanced (defensive only away).
    expect(suggestSheet(state, params, 'c', 'o').tactic.posture).toBe('balanced');
    const ambitious = build(fullSquad('c', 70), { profile: 'academy' }).state;
    // No fixture and no opponent: Δ = 0 → academy attacks.
    expect(suggestSheet(ambitious, params, 'c').tactic.posture).toBe('attacking');
  });

  it('a tired XI presses low', () => {
    const specs = fullSquad('c', 70).map(([p, o], i): Spec => [
      p,
      o,
      { condition: i < 11 ? 80 : 40 },
    ]);
    const { state } = build(specs, { profile: 'academy', venue: 'home' });
    const sheet = suggestSheet(state, params, 'c', 'o');
    expect(sheet.tactic.pressure).toBe('low');
  });

  it('an unknown club gets an empty sheet and an unknown profile plays as traditional', () => {
    const { state } = build(fullSquad('c'));
    const empty = suggestSheet(state, params, 'nobody');
    expect(empty.lineup.starters).toEqual([]);
    expect(empty.tactic).toEqual({ posture: 'balanced', pressure: 'medium' });

    const away = build(fullSquad('c', 60), { venue: 'away', profile: 'x' as AiProfile }).state;
    const traditional = build(fullSquad('c', 60), { venue: 'away' }).state;
    expect(suggestSheet(away, params, 'c', 'o')).toEqual(
      suggestSheet(traditional, params, 'c', 'o'),
    );
  });
});

describe('determinism (ia-clubes.md, "Pedido ao developer" 1)', () => {
  it('same state, club and opponent → same sheet, and the state is not changed', () => {
    const state = testGame();
    const before = JSON.stringify(state);
    const clubIds = Object.keys(state.clubs);
    const chaotic: GameState = {
      ...state,
      clubs: Object.fromEntries(
        clubIds.map((id, i) => [
          id,
          { ...state.clubs[id]!, profile: i % 2 === 1 ? 'chaotic' : 'ambitious' },
        ]),
      ),
    };
    for (const s of [state, chaotic]) {
      for (let i = 0; i < clubIds.length; i++) {
        const opponent = clubIds[(i + 1) % clubIds.length]!;
        const a = suggestSheet(s, params, clubIds[i]!, opponent);
        const b = suggestSheet(structuredClone(s), params, clubIds[i]!, opponent);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }
    }
    expect(JSON.stringify(state)).toBe(before);
  });

  it('the chaotic draw changes with the round and the club, not with the call', () => {
    const { state } = build(fullSquad('c'), { profile: 'chaotic' });
    expect(aiSeed(state, 'c')).not.toBe(aiSeed({ ...state, round: 2 }, 'c'));
    expect(aiSeed(state, 'c')).not.toBe(aiSeed(state, 'o'));
    expect(aiSeed(state, 'c')).not.toBe(aiSeed({ ...state, season: 2 }, 'c'));
    expect(suggestSheet(state, params, 'c')).toEqual(suggestSheet(state, params, 'c'));
  });
});

describe('validateLineup', () => {
  const { state } = build(fullSquad('c'));
  const good = suggestSheet(state, params, 'c');
  const withLineup = (patch: Partial<TeamSheet['lineup']>): TeamSheet => ({
    ...good,
    lineup: { ...good.lineup, ...patch },
  });
  const injured = (id: string, field: 'injuryRounds' | 'suspendedGames'): SuggestState => ({
    ...state,
    players: { ...state.players, [id]: { ...state.players[id]!, [field]: 1 } },
  });
  const starters = good.lineup.starters;

  it('returns the same sheet when it is valid', () => {
    const result = validateLineup(state, 'c', good);
    expect(result).toEqual({ ok: true, value: good, warnings: [] });
  });

  it('no-formation', () => {
    const result = validateLineup(state, 'c', withLineup({ formation: '4-6-0' as Formation }));
    expect(result).toEqual({
      ok: false,
      error: 'no-formation',
      detail: { reason: 'no-formation', formation: '4-6-0', part: 'starters' },
    });
  });

  it('wrong-count (starters and bench)', () => {
    expect(validateLineup(state, 'c', withLineup({ starters: starters.slice(0, 10) }))).toEqual({
      ok: false,
      error: 'wrong-count',
      detail: { reason: 'wrong-count', count: 10, part: 'starters' },
    });
    const bench = [...good.lineup.bench, 'c#99'];
    expect(validateLineup(state, 'c', withLineup({ bench }))).toMatchObject({
      error: 'wrong-count',
      detail: { count: 8, part: 'bench' },
    });
  });

  it('duplicate (twice in the XI, a starter on the bench, twice on the bench)', () => {
    const twice = [...starters.slice(0, 10), starters[0]!];
    expect(validateLineup(state, 'c', withLineup({ starters: twice }))).toMatchObject({
      error: 'duplicate',
      detail: { player: starters[0], part: 'starters' },
    });
    expect(validateLineup(state, 'c', withLineup({ bench: [starters[3]!] }))).toMatchObject({
      error: 'duplicate',
      detail: { player: starters[3], part: 'bench' },
    });
    const b = good.lineup.bench[0]!;
    expect(validateLineup(state, 'c', withLineup({ bench: [b, b] }))).toMatchObject({
      error: 'duplicate',
      detail: { player: b, part: 'bench' },
    });
  });

  it('wrong-club (a player of another club, an unknown id, an unknown club)', () => {
    const other = [...starters.slice(0, 10), 'o#11'];
    expect(validateLineup(state, 'c', withLineup({ starters: other }))).toMatchObject({
      error: 'wrong-club',
      detail: { player: 'o#11', part: 'starters' },
    });
    expect(validateLineup(state, 'c', withLineup({ bench: ['c#404'] }))).toMatchObject({
      error: 'wrong-club',
      detail: { player: 'c#404', part: 'bench' },
    });
    expect(validateLineup(state, 'nobody', good)).toMatchObject({
      error: 'wrong-club',
      detail: { player: starters[0], part: 'starters' },
    });
  });

  it('unavailable (injured or suspended, in the XI or on the bench)', () => {
    expect(validateLineup(injured(starters[5]!, 'injuryRounds'), 'c', good)).toMatchObject({
      error: 'unavailable',
      detail: { player: starters[5], part: 'starters' },
    });
    expect(validateLineup(injured(starters[2]!, 'suspendedGames'), 'c', good)).toMatchObject({
      error: 'unavailable',
      detail: { player: starters[2], part: 'starters' },
    });
    const b = good.lineup.bench[2]!;
    expect(validateLineup(injured(b, 'injuryRounds'), 'c', good)).toMatchObject({
      error: 'unavailable',
      detail: { player: b, part: 'bench' },
    });
  });

  it('reports the first problem: formation, count, then each starter in slot order, then the bench', () => {
    const many = withLineup({
      formation: 'x' as Formation,
      starters: starters.slice(0, 3),
      bench: ['c#404'],
    });
    expect(validateLineup(state, 'c', many)).toMatchObject({ error: 'no-formation' });
    const order = withLineup({ starters: [...starters.slice(0, 9), 'c#404', starters[0]!] });
    expect(validateLineup(state, 'c', order)).toMatchObject({
      error: 'wrong-club',
      detail: { player: 'c#404' },
    });
  });
});
