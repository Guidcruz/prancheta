import { describe, expect, it } from 'vitest';
import { getStandings, type Fixture, type GameState, type MatchGoal } from '@engine';
import { t } from '@lib/i18n';
import {
  changeLine,
  goalColumns,
  isDerby,
  minuteLabel,
  positionChange,
  resultOf,
  roundSummary,
  shortHandedClub,
  summaryRound,
  type PlayedFixture,
} from './round';
import { TEST_CLUB, testCareer } from './testing/game';

/*
 * The reads of the round summary (resumo-rodada.md, "O que a tela lê"; US-019) on real careers:
 * the last round played, the coach's match and the other nine in the order of the calendar, the
 * position and its change (up, down, the same, none in round 1), the minute with added time and
 * the goals of each side in the order of the minute. The screen is in round-screens.test.ts.
 */

const after1 = testCareer('full', 2);
const after5 = testCareer('full', 6);

const played = (game: GameState, round: number) =>
  game.fixtures.filter((f): f is PlayedFixture => f.round === round && f.result !== undefined);

describe('summaryRound: always the last round played', () => {
  it('is game.round − 1, and none before round 1', () => {
    expect(summaryRound(testCareer('full', 1))).toBeUndefined();
    expect(summaryRound(after1)).toBe(1);
    expect(summaryRound(after5)).toBe(5);
    // After round 38, game.round is 39.
    expect(summaryRound(testCareer('full', 39))).toBe(38);
  });

  it('a round with no result is not shown', () => {
    const fixtures = after1.fixtures.map((f) => (f.round === 1 ? { ...f, result: undefined } : f));
    expect(summaryRound({ ...after1, fixtures } as GameState)).toBeUndefined();
  });
});

describe('roundSummary', () => {
  it('the coach’s match, the other nine in the order of the calendar, the row of the table', () => {
    const summary = roundSummary(after5, TEST_CLUB)!;
    expect(summary.round).toBe(5);
    const round = played(after5, 5);
    const mine = round.find((f) => f.homeId === TEST_CLUB || f.awayId === TEST_CLUB)!;
    expect(summary.mine.fixture).toBe(mine);
    expect(summary.mine.venue).toBe(mine.homeId === TEST_CLUB ? 'home' : 'away');
    expect(summary.mine.result).toBe(resultOf(mine.result.score, summary.mine.venue));
    expect(summary.others).toHaveLength(9);
    expect(summary.others.map((f) => f.id)).toEqual(
      round.filter((f) => f !== mine).map((f) => f.id),
    );
    const row = getStandings(after5).find((r) => r.clubId === TEST_CLUB)!;
    expect(summary.standing).toEqual(row);
    expect(summary.change).toBe(positionChange(after5, TEST_CLUB, 5));
  });

  it('round 1: no change of position', () => {
    const summary = roundSummary(after1, TEST_CLUB)!;
    expect(summary.round).toBe(1);
    expect(summary.change).toBeUndefined();
    expect('change' in summary).toBe(false);
  });

  it('none without a round played', () => {
    expect(roundSummary(testCareer('full', 1), TEST_CLUB)).toBeUndefined();
  });
});

describe('resultOf: from the side of the coach’s club', () => {
  it('win, draw and loss from either side', () => {
    expect(resultOf([2, 1], 'home')).toBe('W');
    expect(resultOf([2, 1], 'away')).toBe('L');
    expect(resultOf([0, 3], 'away')).toBe('W');
    expect(resultOf([1, 1], 'home')).toBe('D');
    expect(resultOf([0, 0], 'away')).toBe('D');
  });
});

describe('positionChange: the table after the round against the one after the round before', () => {
  it('up, down and the same all happen, and each is the difference of getStandings', () => {
    const seen = new Set<string>();
    for (const clubId of Object.keys(after5.clubs)) {
      for (let round = 2; round <= 5; round++) {
        const change = positionChange(after5, clubId, round)!;
        const before = getStandings(after5, round - 1).find((r) => r.clubId === clubId)!;
        const now = getStandings(after5, round).find((r) => r.clubId === clubId)!;
        expect(change).toBe(before.position - now.position);
        seen.add(change > 0 ? 'up' : change < 0 ? 'down' : 'same');
      }
    }
    expect([...seen].sort()).toEqual(['down', 'same', 'up']);
  });

  it('none in round 1 (the table before it is all zeros) nor for a club not in the table', () => {
    expect(positionChange(after5, TEST_CLUB, 1)).toBeUndefined();
    expect(positionChange(after5, 'nobody', 3)).toBeUndefined();
  });

  it('the text: arrow and plural up and down, no arrow for the same', () => {
    expect(changeLine(1, 'pt-BR')).toEqual({ text: 'Subiu 1 posição', icon: 'arrow-up' });
    expect(changeLine(3, 'pt-BR')).toEqual({ text: 'Subiu 3 posições', icon: 'arrow-up' });
    expect(changeLine(-1, 'pt-BR')).toEqual({ text: 'Caiu 1 posição', icon: 'arrow-down' });
    expect(changeLine(-12, 'en')).toEqual({ text: 'Down 12 places', icon: 'arrow-down' });
    expect(changeLine(2, 'es')).toEqual({ text: 'Subió 2 puestos', icon: 'arrow-up' });
    expect(changeLine(0, 'pt-BR')).toEqual({ text: 'Mesma posição' });
  });
});

describe('minuteLabel', () => {
  it('the minute shown and read', () => {
    expect(minuteLabel({ minute: 23 }, 'pt-BR')).toEqual({ text: "23'", a11y: 'minuto 23' });
    expect(minuteLabel({ minute: 90, added: 0 }, 'en')).toEqual({ text: "90'", a11y: 'minute 90' });
  });

  it('added time: "45+2\'" and the full sentence', () => {
    expect(minuteLabel({ minute: 45, added: 2 }, 'pt-BR')).toEqual({
      text: "45+2'",
      a11y: 'minuto 45 mais 2 de acréscimo',
    });
    expect(minuteLabel({ minute: 90, added: 7 }, 'es')).toEqual({
      text: "90+7'",
      a11y: 'minuto 90 más 7 de descuento',
    });
  });
});

describe('goalColumns: the goals of each side, in the order of the minute', () => {
  const fixture = played(after1, 1)[0]!;
  const [scorer, other] = after1.squads[fixture.homeId]!;
  const [awayScorer] = after1.squads[fixture.awayId]!;
  const goal = (g: Partial<MatchGoal>): MatchGoal => ({
    side: 'home',
    scorer: scorer!,
    kind: 'open',
    minute: 10,
    ...g,
  });
  const withGoals = (goals: MatchGoal[]): PlayedFixture => ({
    ...fixture,
    result: { ...fixture.result, goals },
  });

  it('home on the left, away on the right, each sorted by minute and added time', () => {
    const [home, away] = goalColumns(
      after1,
      withGoals([
        goal({ minute: 90, added: 3 }),
        goal({ side: 'away', scorer: awayScorer!, minute: 50 }),
        goal({ minute: 46, scorer: other! }),
        goal({ minute: 45, added: 2, kind: 'penalty' }),
        goal({ minute: 90 }),
      ]),
      'pt-BR',
    );
    expect(home.label).toBe(
      t('round.goals.of', 'pt-BR', { club: after1.clubs[fixture.homeId]!.def.shortName }),
    );
    expect(home.goals.map((g) => g.minute)).toEqual(["45+2'", "46'", "90'", "90+3'"]);
    expect(home.goals[0]).toEqual({
      minute: "45+2'",
      minuteA11y: 'minuto 45 mais 2 de acréscimo',
      name: after1.players[scorer!]!.name.display,
      kind: 'pênalti',
      kindA11y: 'de pênalti',
    });
    expect(home.goals[1]!.name).toBe(after1.players[other!]!.name.display);
    expect(home.goals[1]).not.toHaveProperty('kind');
    expect(away.goals).toHaveLength(1);
    expect(away.goals[0]!.name).toBe(after1.players[awayScorer!]!.name.display);
  });

  it('a free kick in en is "FK", read as "free kick"; a scorer not in the state is "Player"', () => {
    const [home] = goalColumns(
      after1,
      withGoals([goal({ kind: 'freeKick' }), goal({ scorer: 'gone', minute: 20 })]),
      'en',
    );
    expect(home.goals[0]).toMatchObject({ kind: 'FK', kindA11y: 'free kick' });
    expect(home.goals[1]!.name).toBe('Player');
  });

  it('the real goals of the match, as many as `result.goals`', () => {
    const [home, away] = goalColumns(after1, fixture, 'pt-BR');
    expect(home.goals.length + away.goals.length).toBe(fixture.result.goals.length);
    expect(home.goals).toHaveLength(fixture.result.goals.filter((g) => g.side === 'home').length);
  });
});

describe('the abandoned match and the derby', () => {
  const fixture = played(after1, 1)[0]!;
  const abandoned = (score: [number, number]): PlayedFixture => ({
    ...fixture,
    result: { ...fixture.result, score, abandoned: true },
  });

  it('the club named is the loser by the awarded score (the one short of players)', () => {
    expect(shortHandedClub(abandoned([0, 3]))).toBe(fixture.homeId);
    expect(shortHandedClub(abandoned([5, 1]))).toBe(fixture.awayId);
    expect(shortHandedClub({ ...fixture, result: { ...fixture.result, abandoned: false } })).toBe(
      undefined,
    );
  });

  it('a derby is the away club in the rivals of the home club', () => {
    const home = after1.clubs[TEST_CLUB]!.def;
    const rival = home.rivals[0]!;
    const match = (homeId: string, awayId: string) => ({ ...fixture, homeId, awayId }) as Fixture;
    expect(isDerby(after1, match(TEST_CLUB, rival))).toBe(true);
    const stranger = Object.keys(after1.clubs).find(
      (id) => id !== TEST_CLUB && !home.rivals.includes(id),
    )!;
    expect(isDerby(after1, match(TEST_CLUB, stranger))).toBe(false);
  });
});
