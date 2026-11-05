import { beforeAll, describe, expect, it } from 'vitest';
import { FORMATIONS, FORMATION_SLOTS } from './formations.ts';
import { newGame, type GameState } from './game.ts';
import { bestEleven, elevenStrength } from './generation.ts';
import { FIT, type Player } from './players.ts';
import {
  FORMATION_MULTIPLIERS,
  FORMATION_SECTORS,
  POSTURE_EFFECTS,
  PRESSURE_EFFECTS,
  conditionMultiplier,
  effectiveRating,
  homeAdvantage,
  moraleMultiplier,
  postureEffect,
  sectorStrengths,
  strengthsFromRatings,
  teamFactor,
  teamStrength,
  type LineupProblem,
  type StrengthContext,
  type TeamStrengths,
} from './strength.ts';
import { syntheticClubs } from './testing/clubs.ts';
import { fixedIdentitySource } from './testing/identity.ts';
import { testParams } from './testing/params.ts';
import { testPlayer, type MutablePlayer } from './testing/players.ts';
import type { Formation, Position, Posture, Pressure } from './types.ts';

const params = testParams();

/**
 * An XI where every slot holds a player of the slot's natural position, all with the same
 * overall, morale 50 and condition 100 (so `eff = overall`), unless `change` says otherwise.
 */
function eleven(
  formation: Formation,
  overall = 70,
  change: (slot: Position, index: number) => Partial<MutablePlayer> = () => ({}),
): MutablePlayer[] {
  return FORMATION_SLOTS[formation].map((slot, i) =>
    testPlayer({
      id: `clube-teste-01#${i + 1}`,
      shirt: i + 1,
      position: slot,
      overall,
      morale: 50,
      condition: 100,
      ...change(slot, i),
    }),
  );
}

function sheetOf(
  formation: Formation,
  players: readonly Player[],
  posture: Posture = 'balanced',
  pressure: Pressure = 'medium',
) {
  return {
    lineup: { formation, starters: players.map((p) => p.id) },
    tactic: { posture, pressure },
  };
}

function strengthsOf(
  players: readonly Player[],
  formation: Formation,
  context: StrengthContext = { home: 0 },
  posture: Posture = 'balanced',
  pressure: Pressure = 'medium',
): TeamStrengths {
  const result = sectorStrengths(
    players,
    sheetOf(formation, players, posture, pressure),
    context,
    params,
  );
  if (!result.ok) throw new Error(`sectorStrengths failed: ${JSON.stringify(result.detail)}`);
  return result.value;
}

describe('effective rating (partida.md, "Nota efetiva")', () => {
  it('follows the morale and condition multipliers of the design examples', () => {
    expect(moraleMultiplier(0)).toBeCloseTo(0.95, 12);
    expect(moraleMultiplier(50)).toBeCloseTo(1.0, 12);
    expect(moraleMultiplier(100)).toBeCloseTo(1.05, 12);
    expect(conditionMultiplier(100)).toBeCloseTo(1.0, 12);
    expect(conditionMultiplier(70)).toBeCloseTo(0.94, 12);
    expect(conditionMultiplier(0)).toBeCloseTo(0.8, 12);
  });

  it('clips morale and energy outside 0..100', () => {
    expect(moraleMultiplier(-20)).toBe(moraleMultiplier(0));
    expect(moraleMultiplier(140)).toBe(moraleMultiplier(100));
    expect(conditionMultiplier(-1)).toBe(conditionMultiplier(0));
    expect(conditionMultiplier(Number.NaN)).toBe(conditionMultiplier(0));
    expect(conditionMultiplier(101)).toBe(conditionMultiplier(100));
  });

  it('is overall × fit × moraleMult × condMult, with the condition as the default energy', () => {
    const player = testPlayer({ position: 'AM', overall: 80, morale: 75, condition: 60 });
    const expected = 80 * FIT.AM.ST * moraleMultiplier(75) * conditionMultiplier(60);
    expect(effectiveRating(player, 'ST')).toBeCloseTo(expected, 12);
    expect(effectiveRating(player, 'ST', 90)).toBeCloseTo(
      80 * FIT.AM.ST * moraleMultiplier(75) * conditionMultiplier(90),
      12,
    );
    expect(effectiveRating({ ...player, morale: 50, condition: 100 }, 'AM')).toBe(80);
  });
});

describe('formations and tactics (partida.md, "Formações" and "Táticas")', () => {
  it('assigns the sectors of the design table, wing-backs in midfield in a back three', () => {
    const counts: Record<Formation, [number, number, number]> = {
      '4-4-2': [4, 4, 2],
      '4-3-3': [4, 3, 3],
      '4-2-3-1': [4, 5, 1],
      '3-5-2': [3, 5, 2],
      '3-4-3': [3, 4, 3],
      '5-3-2': [5, 3, 2],
    };
    for (const formation of FORMATIONS) {
      const sectors = FORMATION_SECTORS[formation];
      expect(sectors).toHaveLength(FORMATION_SLOTS[formation].length);
      expect(sectors[0]).toBe('gk');
      expect(sectors.filter((s) => s === 'gk')).toHaveLength(1);
      const count = (s: string) => sectors.filter((x) => x === s).length;
      expect([count('def'), count('mid'), count('atk')], formation).toEqual(counts[formation]);
      FORMATION_SLOTS[formation].forEach((slot, i) => {
        if (slot === 'CB') expect(sectors[i]).toBe('def');
        if (slot === 'DM' || slot === 'AM') expect(sectors[i]).toBe('mid');
        if (slot === 'ST') expect(sectors[i]).toBe('atk');
        if (slot === 'FB') {
          const backThree = formation === '3-5-2' || formation === '3-4-3';
          expect(sectors[i]).toBe(backThree ? 'mid' : 'def');
        }
      });
    }
  });

  it.each(FORMATIONS)('%s multiplies a uniform XI by its def/mid/atk', (formation) => {
    const s = strengthsOf(eleven(formation, 70), formation);
    const m = FORMATION_MULTIPLIERS[formation];
    expect(s.goalkeeper).toBe(70);
    expect(s.def).toBeCloseTo(70 * m.def, 10);
    expect(s.mid).toBeCloseTo(70 * m.mid, 10);
    expect(s.atk).toBeCloseTo(70 * m.atk, 10);
    expect(s.power).toBeCloseTo(0.5 * 70 * m.mid + 0.5 * 70 * m.atk, 10);
    expect(s.defense).toBeCloseTo(70 * m.def, 10);
    expect(s.factor).toBe(1);
  });

  it('applies posture to power and defence, and pressure to the midfield only', () => {
    const players = eleven('4-4-2', 70);
    const reference = strengthsOf(players, '4-4-2');
    for (const posture of ['defensive', 'balanced', 'attacking', 'allOut'] as const) {
      const s = strengthsOf(players, '4-4-2', { home: 0 }, posture);
      const effect = postureEffect(posture, params.match);
      expect(s.power).toBeCloseTo(reference.power * effect.power, 10);
      expect(s.defense).toBeCloseTo(reference.defense * effect.def, 10);
      expect(s.def).toBe(reference.def);
    }
    for (const pressure of ['low', 'medium', 'high'] as const) {
      const s = strengthsOf(players, '4-4-2', { home: 0 }, 'balanced', pressure);
      expect(s.mid).toBeCloseTo(reference.mid * PRESSURE_EFFECTS[pressure].mid, 10);
      expect(s.def).toBe(reference.def);
      expect(s.atk).toBe(reference.atk);
    }
  });

  it('takes "tudo no ataque" from match.allOutPower and match.allOutDef (T-016)', () => {
    expect(postureEffect('allOut', params.match)).toEqual({
      power: params.match.allOutPower,
      def: params.match.allOutDef,
    });
    expect(postureEffect('attacking', params.match)).toBe(POSTURE_EFFECTS.attacking);
    const players = eleven('4-4-2', 70);
    const reference = strengthsOf(players, '4-4-2');
    const tuned = { ...params, match: { ...params.match, allOutPower: 1.3, allOutDef: 0.7 } };
    const result = sectorStrengths(
      players,
      sheetOf('4-4-2', players, 'allOut'),
      { home: 0 },
      tuned,
    );
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.power).toBeCloseTo(reference.power * 1.3, 10);
    expect(result.value.defense).toBeCloseTo(reference.defense * 0.7, 10);
    // The pre-match postures do not read the parameters.
    const attacking = sectorStrengths(
      players,
      sheetOf('4-4-2', players, 'attacking'),
      { home: 0 },
      tuned,
    );
    if (!attacking.ok) throw new Error('expected ok');
    expect(attacking.value.power).toBeCloseTo(reference.power * 1.05, 10);
  });

  it('weighs midfield and attack by match.midWeight in the power', () => {
    const players = eleven('4-3-3', 70, (slot) => (slot === 'ST' ? { overall: 80 } : {}));
    const s = strengthsOf(players, '4-3-3');
    const midWeight = 0.3;
    const r = sectorStrengths(
      players,
      sheetOf('4-3-3', players),
      { home: 0 },
      { match: { ...params.match, midWeight } },
    );
    if (!r.ok) throw new Error('unexpected');
    expect(r.value.power).toBeCloseTo(midWeight * s.mid + (1 - midWeight) * s.atk, 10);
  });
});

describe('T(t) (partida.md, "Forças de setor")', () => {
  it('is (1 + home) × (1 − penalty × missing) × (1 + halftimeBoost), with 0 by default', () => {
    expect(teamFactor({ home: 0 }, params.match)).toBe(1);
    expect(teamFactor({ home: 0.1 }, params.match)).toBeCloseTo(1.1, 12);
    expect(teamFactor({ home: 0, missing: 1 }, params.match)).toBeCloseTo(0.93, 12);
    expect(teamFactor({ home: 0, missing: 2 }, params.match)).toBeCloseTo(0.86, 12);
    expect(teamFactor({ home: 0, halftimeBoost: 0.03 }, params.match)).toBeCloseTo(1.03, 12);
    expect(teamFactor({ home: 0, halftimeBoost: -0.03 }, params.match)).toBeCloseTo(0.97, 12);
    expect(teamFactor({ home: 0.106, missing: 1, halftimeBoost: 0.02 }, params.match)).toBeCloseTo(
      1.106 * 0.93 * 1.02,
      12,
    );
  });

  it('clips the missing players to 11 and never goes below 0', () => {
    expect(teamFactor({ home: 0.1, missing: 50 }, params.match)).toBe(
      teamFactor({ home: 0.1, missing: 11 }, params.match),
    );
    const harsh = { missingPlayerPenalty: 0.12 };
    expect(teamFactor({ home: 0, missing: 11 }, harsh)).toBe(0);
  });

  it('ignores a negative or NaN number of missing players', () => {
    expect(teamFactor({ home: 0.1, missing: -3 }, params.match)).toBe(
      teamFactor({ home: 0.1 }, params.match),
    );
    expect(teamFactor({ home: 0.1, missing: Number.NaN }, params.match)).toBe(
      teamFactor({ home: 0.1 }, params.match),
    );
  });

  it('never turns negative or NaN with a half-time boost below −100%', () => {
    expect(teamFactor({ home: 0.1, halftimeBoost: -1 }, params.match)).toBe(0);
    expect(teamFactor({ home: 0.1, halftimeBoost: -5 }, params.match)).toBe(0);
    expect(teamFactor({ home: 0.1, halftimeBoost: Number.NaN }, params.match)).toBe(0);
  });

  it('multiplies the three sectors, and the goalkeeper eff stays plain', () => {
    const players = eleven('4-2-3-1', 66);
    const plain = strengthsOf(players, '4-2-3-1');
    const context = { home: 0.08, halftimeBoost: 0.04 };
    const t = teamFactor(context, params.match);
    const s = strengthsOf(players, '4-2-3-1', context);
    expect(s.factor).toBe(t);
    expect(s.def).toBeCloseTo(plain.def * t, 10);
    expect(s.mid).toBeCloseTo(plain.mid * t, 10);
    expect(s.atk).toBeCloseTo(plain.atk * t, 10);
    expect(s.goalkeeper).toBe(plain.goalkeeper);
  });

  it('uses the in-match energy when given, the condition otherwise', () => {
    const players = eleven('4-4-2', 70);
    const tired = strengthsOf(players, '4-4-2', { home: 0, energy: { [players[9]!.id]: 40 } });
    const fresh = strengthsOf(players, '4-4-2');
    expect(tired.atk).toBeCloseTo((70 + 70 * conditionMultiplier(40)) / 2, 10);
    expect(tired.def).toBe(fresh.def);
    expect(tired.mid).toBe(fresh.mid);
  });

  it('treats a ratings list of the wrong length as a programming error', () => {
    expect(() =>
      strengthsFromRatings(
        '4-4-2',
        { posture: 'balanced', pressure: 'medium' },
        [70],
        {
          home: 0,
        },
        params.match,
      ),
    ).toThrow(RangeError);
  });
});

describe('US-007: força por setor a partir de escalação e tática', () => {
  it('cenário: formação muda os setores (5-3-2 defende mais, 3-4-3 ataca mais)', () => {
    // The same XI in slot order for 5-3-2: GK, 3 CB, 2 FB, 2 DM, AM, 2 ST. In 3-4-3 the same
    // eleven plays GK, 3 CB, 2 FB (wing-backs), 2 DM, 3 ST: the full-backs move to midfield and
    // the AM becomes the third striker.
    const players = eleven('5-3-2', 70);
    const backFive = strengthsOf(players, '5-3-2');
    const frontThree = strengthsOf(players, '3-4-3');
    expect(backFive.def).toBeGreaterThan(frontThree.def);
    expect(backFive.defense).toBeGreaterThan(frontThree.defense);
    expect(frontThree.atk).toBeGreaterThan(backFive.atk);
    expect(backFive.def).toBeCloseTo(70 * 1.05, 10);
    expect(frontThree.def).toBeCloseTo(70 * 0.95, 10);
    expect(frontThree.atk).toBeCloseTo(((70 + 70 + 70 * FIT.AM.ST) / 3) * 1.1, 10);
    expect(backFive.atk).toBeCloseTo(70 * 0.97, 10);
  });

  it('cenário: formação muda os setores, também com o elenco gerado', () => {
    const state = careerState();
    for (const clubId of Object.keys(state.clubs)) {
      const squad = state.squads[clubId]!.map((id) => state.players[id]!);
      const starters = bestEleven(squad, '5-3-2').map(({ player }) => player);
      const backFive = strengthsOf(starters, '5-3-2');
      const frontThree = strengthsOf(starters, '3-4-3');
      expect(backFive.def, clubId).toBeGreaterThan(frontThree.def);
      expect(frontThree.atk, clubId).toBeGreaterThan(backFive.atk);
    }
  });

  it('cenário: jogador fora de posição perde rendimento, na proporção do fit', () => {
    // Slot 10 is a striker slot in 4-4-2. A centre-back there, with the same overall, morale and
    // condition as the striker he replaces (same rating inputs), contributes fit(CB, ST) of it.
    const strikers = eleven('4-4-2', 72);
    const withCentreBack = eleven('4-4-2', 72, (_slot, i) => (i === 10 ? { position: 'CB' } : {}));
    const striker = strikers[10]!;
    const centreBack = withCentreBack[10]!;
    const ratio = effectiveRating(centreBack, 'ST') / effectiveRating(striker, 'ST');
    expect(ratio).toBeCloseTo(FIT.CB.ST, 12);
    expect(FIT.CB.ST).toBeLessThan(1);

    const natural = strengthsOf(strikers, '4-4-2');
    const improvised = strengthsOf(withCentreBack, '4-4-2');
    expect(improvised.atk).toBeLessThan(natural.atk);
    // Each of the two strikers contributes eff / 2 × formation.atk × T to Atk.
    const lostContribution = ((1 - FIT.CB.ST) * 72) / 2;
    expect(natural.atk - improvised.atk).toBeCloseTo(lostContribution, 10);
    expect(improvised.def).toBe(natural.def);
    expect(improvised.mid).toBe(natural.mid);
  });

  it('cenário: mando, moral e fadiga', () => {
    const players = eleven('4-4-2', 70);
    const home = homeAdvantage({ fans: 60, derby: false }, params);
    const atHome = strengthsOf(players, '4-4-2', { home });
    const away = strengthsOf(players, '4-4-2', { home: 0 });
    const highMorale = strengthsOf(
      players.map((p) => ({ ...p, morale: 90 })),
      '4-4-2',
    );
    const lowMorale = strengthsOf(
      players.map((p) => ({ ...p, morale: 20 })),
      '4-4-2',
    );
    const rested = strengthsOf(
      players.map((p) => ({ ...p, condition: 95 })),
      '4-4-2',
    );
    const tired = strengthsOf(
      players.map((p) => ({ ...p, condition: 55 })),
      '4-4-2',
    );
    for (const [better, worse] of [
      [atHome, away],
      [highMorale, lowMorale],
      [rested, tired],
    ] as const) {
      expect(better.def).toBeGreaterThan(worse.def);
      expect(better.mid).toBeGreaterThan(worse.mid);
      expect(better.atk).toBeGreaterThan(worse.atk);
      expect(better.power).toBeGreaterThan(worse.power);
      expect(better.defense).toBeGreaterThan(worse.defense);
    }
  });

  describe('cenário: escalação incompleta não quebra o motor', () => {
    const run = (squad: readonly Player[], starters: readonly string[], formation = '4-4-2') =>
      sectorStrengths(
        squad,
        {
          lineup: { formation: formation as Formation, starters },
          tactic: { posture: 'balanced', pressure: 'medium' },
        },
        { home: 0 },
        params,
      );

    it('menos de 11 escalados', () => {
      const players = eleven('4-4-2');
      const ids = players.map((p) => p.id);
      for (const starters of [ids.slice(0, 10), [], ids.slice(0, 1)]) {
        let result: ReturnType<typeof run> | undefined;
        expect(() => (result = run(players, starters))).not.toThrow();
        expect(result).toEqual({
          ok: false,
          error: 'invalid-lineup',
          detail: { reason: 'wrong-count', count: starters.length },
        });
      }
    });

    it('lesionado ou suspenso entre os 11 (menos de 11 aptos)', () => {
      const injured = eleven('4-4-2', 70, (_s, i) => (i === 4 ? { injuryRounds: 2 } : {}));
      expect(
        run(
          injured,
          injured.map((p) => p.id),
        ),
      ).toEqual({
        ok: false,
        error: 'invalid-lineup',
        detail: { reason: 'unavailable', player: injured[4]!.id },
      });
      const suspended = eleven('4-4-2', 70, (_s, i) => (i === 0 ? { suspendedGames: 1 } : {}));
      expect(
        run(
          suspended,
          suspended.map((p) => p.id),
        ),
      ).toEqual({
        ok: false,
        error: 'invalid-lineup',
        detail: { reason: 'unavailable', player: suspended[0]!.id },
      });
    });

    it('jogador repetido, fora do elenco ou formação desconhecida', () => {
      const players = eleven('4-4-2');
      const ids = players.map((p) => p.id);
      expect(run(players, [...ids.slice(0, 10), ids[3]!])).toMatchObject({
        ok: false,
        error: 'invalid-lineup',
        detail: { reason: 'duplicate', player: ids[3] },
      });
      expect(run(players.slice(0, 10), ids)).toMatchObject({
        ok: false,
        error: 'invalid-lineup',
        detail: { reason: 'wrong-club', player: ids[10] },
      });
      expect(run(players, ids, '4-5-1')).toMatchObject({
        ok: false,
        error: 'invalid-lineup',
        detail: { reason: 'no-formation', formation: '4-5-1' },
      });
    });

    it('a força exibida não existe para menos de 11 aptos', () => {
      const state = careerState();
      const clubId = Object.keys(state.clubs)[0]!;
      const squad = state.squads[clubId]!;
      const players = { ...state.players };
      for (const id of squad.slice(0, 15)) players[id] = { ...players[id]!, injuryRounds: 3 };
      expect(() => teamStrength({ ...state, players }, clubId)).not.toThrow();
      expect(teamStrength({ ...state, players }, clubId)).toBeUndefined();
    });
  });
});

describe('US-026 (mando): bônus de casa pelo termômetro', () => {
  const { homeBase } = params.match;
  const { homeBonusMin, homeBonusMax, derbyBonus } = params.fans;

  it('cenário: termômetro 0 e 100, e clássico soma fans.derbyBonus nos dois', () => {
    expect(homeAdvantage({ fans: 0, derby: false }, params)).toBeCloseTo(
      homeBase + homeBonusMin,
      12,
    );
    expect(homeAdvantage({ fans: 100, derby: false }, params)).toBeCloseTo(
      homeBase + homeBonusMax,
      12,
    );
    expect(homeAdvantage({ fans: 0, derby: true }, params)).toBeCloseTo(
      homeBase + homeBonusMin + derbyBonus,
      12,
    );
    expect(homeAdvantage({ fans: 100, derby: true }, params)).toBeCloseTo(
      homeBase + homeBonusMax + derbyBonus,
      12,
    );
  });

  it('cenário: o bônus entra na força calculada', () => {
    const players = eleven('4-4-2', 70);
    const away = strengthsOf(players, '4-4-2');
    for (const [fans, derby, bonus] of [
      [0, false, homeBase + homeBonusMin],
      [100, false, homeBase + homeBonusMax],
      [0, true, homeBase + homeBonusMin + derbyBonus],
      [100, true, homeBase + homeBonusMax + derbyBonus],
    ] as const) {
      const home = strengthsOf(players, '4-4-2', {
        home: homeAdvantage({ fans, derby }, params),
      });
      expect(home.factor).toBeCloseTo(1 + bonus, 12);
      expect(home.power / away.power).toBeCloseTo(1 + bonus, 12);
      expect(home.defense / away.defense).toBeCloseTo(1 + bonus, 12);
    }
  });

  it('grows linearly with the thermometer and clips it to 0..100', () => {
    expect(homeAdvantage({ fans: 50, derby: false }, params)).toBeCloseTo(0.05 + 0.02 + 0.03, 12);
    expect(homeAdvantage({ fans: 20, derby: false }, params) - homeBase).toBeCloseTo(0.032, 12);
    expect(homeAdvantage({ fans: 90, derby: false }, params) - homeBase).toBeCloseTo(0.074, 12);
    expect(homeAdvantage({ fans: -10, derby: false }, params)).toBe(
      homeAdvantage({ fans: 0, derby: false }, params),
    );
    expect(homeAdvantage({ fans: 130, derby: false }, params)).toBe(
      homeAdvantage({ fans: 100, derby: false }, params),
    );
  });

  it('reads match.homeBase from the parameters (ADR-0011)', () => {
    const noBase = { ...params, match: { ...params.match, homeBase: 0 } };
    expect(homeAdvantage({ fans: 0, derby: false }, noBase)).toBeCloseTo(homeBonusMin, 12);
  });
});

describe('exemplo numérico de partida.md', () => {
  it('mandante 74, visitante 68, termômetro 60: home = 0.106 e Power ≈ 81.8', () => {
    const home = homeAdvantage({ fans: 60, derby: false }, params);
    expect(home).toBeCloseTo(0.106, 12);
    // 4-4-2 balanced on both sides, everyone rested, morale 50: eff = overall.
    const homeTeam = strengthsOf(eleven('4-4-2', 74), '4-4-2', { home });
    const awayTeam = strengthsOf(eleven('4-4-2', 68), '4-4-2', { home: 0 });
    expect(homeTeam.power).toBeCloseTo(74 * 1.106, 10);
    expect(homeTeam.power).toBeCloseTo(81.8, 1);
    expect(awayTeam.defense).toBeCloseTo(68, 10);
    expect(homeTeam.power - awayTeam.defense).toBeCloseTo(13.8, 1);
  });
});

let cachedState: GameState | undefined;
/** One new career with the synthetic clubs (newGame is not cheap). */
function careerState(): GameState {
  if (cachedState) return cachedState;
  const result = newGame(
    { seed: 4242, year: 2026, realism: 'full' },
    syntheticClubs(20),
    params,
    fixedIdentitySource(),
  );
  if (!result.ok) throw new Error('newGame failed');
  cachedState = result.value;
  return cachedState;
}

describe('teamStrength: força exibida', () => {
  let state: GameState;
  beforeAll(() => {
    state = careerState();
  });

  it('without a lineup is the best XI of the preferred formation, near the club strength', () => {
    for (const [clubId, club] of Object.entries(state.clubs)) {
      const squad = state.squads[clubId]!.map((id) => state.players[id]!);
      const expected = elevenStrength(bestEleven(squad, club.preferredFormations[0]));
      const shown = teamStrength(state, clubId);
      expect(shown, clubId).toBe(expected);
      expect(Math.abs(shown! - club.strength), clubId).toBeLessThanOrEqual(0.5);
    }
  });

  it('with a lineup is the mean of overall × fit of its 11, ignoring morale and condition', () => {
    const clubId = Object.keys(state.clubs)[1]!;
    const squad = state.squads[clubId]!;
    const starters = squad.slice(0, 11);
    const lineup = { formation: '4-3-3' as const, starters };
    const slots = FORMATION_SLOTS['4-3-3'];
    let sum = 0;
    starters.forEach((id, i) => {
      const p = state.players[id]!;
      sum += p.overall * FIT[p.position][slots[i]!];
    });
    expect(teamStrength(state, clubId, lineup)).toBeCloseTo(sum / 11, 12);

    const players = { ...state.players };
    for (const id of starters) players[id] = { ...players[id]!, morale: 0, condition: 10 };
    expect(teamStrength({ ...state, players }, clubId, lineup)).toBe(
      teamStrength(state, clubId, lineup),
    );
  });

  it('drops injured and suspended players from the default XI', () => {
    const clubId = Object.keys(state.clubs)[2]!;
    const club = state.clubs[clubId]!;
    const squad = state.squads[clubId]!.map((id) => state.players[id]!);
    const best = bestEleven(squad, club.preferredFormations[0]);
    const out = best[best.length - 1]!.player;
    const players = { ...state.players, [out.id]: { ...out, injuryRounds: 1 } };
    const rest = squad.filter((p) => p.id !== out.id);
    expect(teamStrength({ ...state, players }, clubId)).toBe(
      elevenStrength(bestEleven(rest, club.preferredFormations[0])),
    );
  });

  it('has no answer for an unknown club or a lineup that is not 11 of the club', () => {
    const [clubA, clubB] = Object.keys(state.clubs) as [string, string];
    const squadA = state.squads[clubA]!;
    const squadB = state.squads[clubB]!;
    expect(teamStrength(state, 'nao-existe')).toBeUndefined();
    const cases: { formation: string; starters: string[] }[] = [
      { formation: '4-4-2', starters: squadA.slice(0, 10) },
      { formation: '4-4-2', starters: [...squadA.slice(0, 10), squadA[0]!] },
      { formation: '4-4-2', starters: [...squadA.slice(0, 10), squadB[0]!] },
      { formation: '4-4-2', starters: [...squadA.slice(0, 10), 'clube-teste-01#999'] },
      { formation: '2-3-5', starters: squadA.slice(0, 11) },
    ];
    for (const lineup of cases) {
      expect(
        teamStrength(state, clubA, lineup as { formation: Formation; starters: string[] }),
      ).toBeUndefined();
    }
  });
});

describe('invalid-lineup com detail tipado', () => {
  it('exposes the reason without a cast', () => {
    const player = testPlayer();
    const result = sectorStrengths(
      [player],
      {
        lineup: { formation: '4-4-2', starters: [player.id] },
        tactic: { posture: 'balanced', pressure: 'medium' },
      },
      { home: 0 },
      params,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const problem: LineupProblem = result.detail;
    expect(problem).toEqual({ reason: 'wrong-count', count: 1 });
  });
});
