import { describe, expect, it } from 'vitest';
import { roundFacts, type Fact } from './facts.ts';
import type { Fixture } from './fixtures.ts';
import type { ClubState } from './game.ts';
import type { MatchEvent, MatchResult } from './match/types.ts';
import type { Player } from './players.ts';
import { getStandings } from './standings.ts';
import { testGame } from './testing/match.ts';

/*
 * The facts of the table and of the round (temporada.md, "Fatos da tabela para o content-writer";
 * T-013), from tables built by hand. The table does not care how many games a club played in a
 * round, so each case writes only the results it needs.
 */

const IDS = Array.from({ length: 20 }, (_, i) => `c${String(i + 1).padStart(2, '0')}`);
let serial = 0;

function game(round: number, homeId: string, awayId: string, score: [number, number]): Fixture {
  serial += 1;
  return {
    id: `f${serial}`,
    round,
    date: '2026-04-12',
    homeId,
    awayId,
    result: {
      score,
      abandoned: false,
      goals: [],
      stats: {
        home: { shots: 0, onTarget: 0, possession: 50, yellows: 0, reds: 0 },
        away: { shots: 0, onTarget: 0, possession: 50, yellows: 0, reds: 0 },
      },
      attendance: 0,
    },
  };
}

/** `n` wins of `winner` over `loser` in `round`. */
const wins = (round: number, winner: string, loser: string, n = 1) =>
  Array.from({ length: n }, () => game(round, winner, loser, [1, 0]));

function stateOf(fixtures: Fixture[], players: Record<string, Partial<Player>> = {}) {
  const club = Object.values(testGame().clubs)[0]!;
  const clubs: Record<string, ClubState> = {};
  for (const id of IDS) clubs[id] = club;
  return { seed: 1, season: 1, clubs, fixtures, players: players as Record<string, Player> };
}

const facts = (fixtures: Fixture[], round: number, results: MatchResult[] = []) =>
  roundFacts(stateOf(fixtures), round, results);
const ofKind = (list: Fact[], ...kinds: Fact['kind'][]) =>
  list.filter((f) => kinds.includes(f.kind));

describe('roundFacts: leadership', () => {
  it('round 1: the leader takes it, nobody loses it', () => {
    const list = facts(wins(1, 'c05', 'c06'), 1);
    expect(ofKind(list, 'leadership')).toEqual([
      { kind: 'leadership', clubId: 'c05', change: 'took', rounds: 1 },
    ]);
  });

  it('kept only at the milestones 5, 10, 15; a new leader takes it and the old one loses it', () => {
    const fixtures = Array.from({ length: 10 }, (_, i) => wins(i + 1, 'c05', 'c06')).flat();
    const kept = (round: number) => ofKind(facts(fixtures, round), 'leadership');
    for (const round of [2, 3, 4, 6, 9]) expect(kept(round), `round ${round}`).toEqual([]);
    expect(kept(5)).toEqual([{ kind: 'leadership', clubId: 'c05', change: 'kept', rounds: 5 }]);
    expect(kept(10)).toEqual([{ kind: 'leadership', clubId: 'c05', change: 'kept', rounds: 10 }]);
    fixtures.push(...wins(11, 'c09', 'c10', 11));
    expect(ofKind(facts(fixtures, 11), 'leadership')).toEqual([
      { kind: 'leadership', clubId: 'c09', change: 'took', rounds: 1 },
      { kind: 'leadership', clubId: 'c05', change: 'lost', rounds: 10 },
    ]);
  });
});

describe('roundFacts: Z4', () => {
  it('round 1 has no Z4 facts; from round 2, who comes in and who goes out', () => {
    const r1 = [...wins(1, 'c01', 'c02'), ...wins(1, 'c03', 'c04')];
    const zone1 = getStandings(stateOf(r1), 1)
      .slice(16)
      .map((r) => r.clubId);
    expect(ofKind(facts(r1, 1), 'enteredZ4', 'leftZ4')).toEqual([]);
    // Round 2: the four of the zone win: they leave it, and four others come in.
    const r2 = [...r1, ...zone1.map((id) => game(2, id, 'c20', [1, 0]))];
    const list = facts(r2, 2);
    const zone2 = getStandings(stateOf(r2), 2)
      .slice(16)
      .map((r) => r.clubId);
    const ids = (kind: Fact['kind']) =>
      ofKind(list, kind)
        .map((f) => (f as { clubId: string }).clubId)
        .sort();
    expect(ids('leftZ4')).toEqual(zone1.filter((id) => !zone2.includes(id)).sort());
    expect(ids('enteredZ4')).toEqual(zone2.filter((id) => !zone1.includes(id)).sort());
    expect(ids('leftZ4')).toHaveLength(4);
  });
});

describe('roundFacts: runs', () => {
  /** c01 against c20, one game a round, with the results from c01's side. */
  const run = (results: string) =>
    [...results].map((r, i) =>
      game(i + 1, 'c01', 'c20', r === 'W' ? [1, 0] : r === 'D' ? [0, 0] : [0, 1]),
    );
  const mine = (results: string) =>
    facts(run(results), results.length).filter(
      (f) =>
        'clubId' in f && f.clubId === 'c01' && f.kind !== 'leadership' && !f.kind.endsWith('Z4'),
    );

  it('unbeaten at the milestones 5, 10, 15 games without losing', () => {
    expect(mine('WWWW')).toEqual([]);
    expect(mine('WWWWW')).toEqual([{ kind: 'unbeaten', clubId: 'c01', games: 5 }]);
    expect(mine('WWWWWW')).toEqual([]);
    expect(mine('WWWWWWWWW')).toEqual([]);
    expect(mine('WWWWWWWWWW')).toEqual([{ kind: 'unbeaten', clubId: 'c01', games: 10 }]);
    expect(mine('W'.repeat(15))).toEqual([{ kind: 'unbeaten', clubId: 'c01', games: 15 }]);
  });

  it('winless at the milestones 4, 9, 14 games without winning', () => {
    expect(mine('LLL')).toEqual([]);
    expect(mine('LLLL')).toEqual([{ kind: 'winless', clubId: 'c01', games: 4 }]);
    expect(mine('LLLLLL')).toEqual([]);
    expect(mine('L'.repeat(10))).toEqual([]);
    expect(mine('L'.repeat(9))).toEqual([{ kind: 'winless', clubId: 'c01', games: 9 }]);
    expect(mine('L'.repeat(14))).toEqual([{ kind: 'winless', clubId: 'c01', games: 14 }]);
  });

  it('unbeatenEnded: a defeat after at least 5 without losing, with the run, round and opponent', () => {
    expect(mine('WWWWWL')).toEqual([
      { kind: 'unbeatenEnded', clubId: 'c01', games: 5, round: 6, opponentId: 'c20' },
    ]);
    expect(mine('WWDWWDWL')).toEqual([
      { kind: 'unbeatenEnded', clubId: 'c01', games: 7, round: 8, opponentId: 'c20' },
    ]);
    expect(mine('WWWWL')).toEqual([]);
  });

  it('winlessEnded: a win after at least 4 without winning', () => {
    expect(mine('LLDLW')).toEqual([
      { kind: 'winlessEnded', clubId: 'c01', games: 4, round: 5, opponentId: 'c20' },
    ]);
    expect(mine('LDLW')).toEqual([]);
    // The opponent who lost it is the one who ended the run of the other side.
    const both = facts(run('WWWWWL'), 6).filter((f) => f.kind === 'winlessEnded');
    expect(both).toEqual([
      { kind: 'winlessEnded', clubId: 'c20', games: 5, round: 6, opponentId: 'c01' },
    ]);
  });

  it('the end has priority over the milestones of the same club', () => {
    // W, W, D, D, D, L: 5 without losing end, and 4 without winning would be a milestone.
    expect(mine('WWDDDL')).toEqual([
      { kind: 'unbeatenEnded', clubId: 'c01', games: 5, round: 6, opponentId: 'c20' },
    ]);
  });

  it('counts the awarded score of an abandoned match', () => {
    const fixtures = run('WWWWW');
    const last = game(6, 'c01', 'c20', [0, 3]);
    fixtures.push({ ...last, result: { ...last.result!, abandoned: true } });
    expect(roundFacts(stateOf(fixtures), 6, []).filter((f) => f.kind === 'unbeatenEnded')).toEqual([
      { kind: 'unbeatenEnded', clubId: 'c01', games: 5, round: 6, opponentId: 'c20' },
    ]);
  });
});

describe('roundFacts: clinched', () => {
  it('champion when the lead is greater than 3 × rounds left, once', () => {
    // Round 29: lead 27 = 3 × 9 (a tie in the count decides nothing); round 30: 30 > 24.
    const r29 = wins(29, 'c01', 'c20', 9);
    expect(ofKind(facts(r29, 29), 'championClinched')).toEqual([]);
    const r30 = [...r29, ...wins(30, 'c01', 'c20')];
    expect(ofKind(facts(r30, 30), 'championClinched')).toEqual([
      { kind: 'championClinched', clubId: 'c01' },
    ]);
    expect(ofKind(facts([...r30, ...wins(31, 'c01', 'c20')], 31), 'championClinched')).toEqual([]);
  });

  it('at the last round the table decides even a tie on points', () => {
    const level = [...wins(38, 'c01', 'c20'), ...wins(38, 'c02', 'c19')];
    expect(ofKind(facts(level, 38), 'championClinched')).toHaveLength(1);
  });

  it('relegated when the 16th is more than 3 × rounds left ahead; at the end the last four', () => {
    const top16 = IDS.slice(0, 16);
    const r29 = top16.flatMap((id) => wins(29, id, 'c20', 8));
    expect(ofKind(facts(r29, 29), 'relegatedClinched')).toEqual([]);
    const r30 = [...r29, ...top16.flatMap((id) => wins(30, id, 'c20'))];
    const list = ofKind(facts(r30, 30), 'relegatedClinched');
    expect(list.map((f) => (f as { clubId: string }).clubId).sort()).toEqual([
      'c17',
      'c18',
      'c19',
      'c20',
    ]);
    // Already relegated: not again.
    expect(ofKind(facts([...r30, ...wins(31, 'c01', 'c02')], 31), 'relegatedClinched')).toEqual([]);
    // Round 38 with nothing decided before: the last four.
    const end = ofKind(facts(wins(38, 'c01', 'c02'), 38), 'relegatedClinched');
    expect(end).toHaveLength(4);
  });

  it('round 37 reports a decisive last round for what is still open', () => {
    expect(ofKind(facts(wins(37, 'c01', 'c02'), 37), 'decisiveLastRound')).toEqual([
      { kind: 'decisiveLastRound', stakes: 'title' },
      { kind: 'decisiveLastRound', stakes: 'relegation' },
    ]);
    // Title decided, relegation decided: nothing at stake.
    const top16 = IDS.slice(0, 16);
    const decided = [
      ...wins(36, 'c01', 'c20', 10),
      ...top16.flatMap((id) => wins(36, id, 'c20', 2)),
    ];
    expect(ofKind(facts(decided, 37), 'decisiveLastRound')).toEqual([]);
    expect(ofKind(facts(wins(36, 'c01', 'c02'), 36), 'decisiveLastRound')).toEqual([]);
  });
});

describe('roundFacts: players', () => {
  const at = { minute: 10, half: 1, importance: 3 } as const;
  const goal = (scorer: string): MatchEvent => ({
    ...at,
    type: 'goal',
    side: 'home',
    scorer,
    kind: 'open',
    score: [1, 0],
  });
  const result = (events: MatchEvent[], extra: Partial<MatchResult> = {}) =>
    ({ events, newSuspensions: [], newInjuries: [], ...extra }) as unknown as MatchResult;

  it('top scorers of the round: everyone with the most goals', () => {
    const results = [result([goal('x'), goal('y'), goal('x')]), result([goal('z'), goal('z')])];
    expect(ofKind(facts([], 1, results), 'topScorerOfRound')).toEqual([
      { kind: 'topScorerOfRound', playerId: 'x', goals: 2 },
      { kind: 'topScorerOfRound', playerId: 'z', goals: 2 },
    ]);
    expect(ofKind(facts([], 1, [result([])]), 'topScorerOfRound')).toEqual([]);
    // A round whose most is 1 goal has no top scorer.
    expect(ofKind(facts([], 1, [result([goal('x'), goal('y')])]), 'topScorerOfRound')).toEqual([]);
  });

  it('suspended and injured with the games they will miss, in match order', () => {
    const results = [
      result([], {
        newSuspensions: [{ player: 's', games: 2 }],
        newInjuries: [{ player: 'i', rounds: 4 }],
      }),
    ];
    const list = roundFacts(
      stateOf([], { s: { suspendedGames: 2 }, i: { injuryRounds: 4 } }),
      1,
      results,
    );
    expect(ofKind(list, 'suspended', 'injured')).toEqual([
      { kind: 'suspended', playerId: 's', games: 2 },
      { kind: 'injured', playerId: 'i', games: 4 },
    ]);
  });
});
