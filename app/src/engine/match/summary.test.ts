import { describe, expect, it } from 'vitest';
import { FORMATION_SLOTS } from '../formations.ts';
import { Rng } from '../rng.ts';
import { testPlayer } from '../testing/players.ts';
import { testLineup } from '../testing/match.ts';
import type { Side } from '../types.ts';
import {
  bestOnPitch,
  playerRatings,
  resultMarkers,
  winnerOf,
  type GoalRecord,
  type MarkerContext,
} from './summary.ts';
import { kickoffTeam, type Appearance, type TeamState } from './team.ts';

/** A 4-4-2 side of 11 hand-made players `${side}#1`..`#11`, shirts 1..11. */
function side(name: Side, overrides: { clubAppearances?: number } = {}): TeamState {
  const players = FORMATION_SLOTS['4-4-2'].map((position, i) =>
    testPlayer({
      id: `${name}#${i + 1}`,
      clubId: name,
      position,
      shirt: i + 1,
      clubAppearances: overrides.clubAppearances ?? 10,
    }),
  );
  const team = kickoffTeam(
    name,
    {
      clubId: name,
      controller: 'ai',
      profile: 'traditional',
      fans: 50,
      players,
      sheet: {
        lineup: testLineup(
          '4-4-2',
          players.map((p) => p.id),
        ),
        tactic: { posture: 'balanced', pressure: 'medium' },
      },
    },
    [],
  );
  for (const app of team.appearances) app.minutes = 90;
  return team;
}

const goal = (s: Side, scorer: string, minute: number, added?: number): GoalRecord => ({
  side: s,
  scorer,
  minute,
  ...(added === undefined ? {} : { added }),
});

function context(goals: GoalRecord[], extra: Partial<MarkerContext> = {}): MarkerContext {
  const home = goals.filter((g) => g.side === 'home').length;
  const away = goals.length - home;
  return {
    score: [home, away],
    goals,
    derby: false,
    neutral: false,
    strength: { home: 70, away: 70 },
    ...extra,
  };
}

describe('result markers (partida.md, "Marcadores do resultado")', () => {
  const teams = [side('home'), side('away')] as const;
  const kinds = (c: MarkerContext) => resultMarkers(teams, c).map((m) => m.kind);

  it('marks a comeback only for the winner who was behind', () => {
    const comeback = [
      goal('away', 'away#10', 10),
      goal('home', 'home#10', 50),
      goal('home', 'home#11', 60),
    ];
    expect(resultMarkers(teams, context(comeback))).toContainEqual({
      kind: 'virada',
      side: 'home',
    });
    const lead = [
      goal('home', 'home#10', 10),
      goal('away', 'away#10', 50),
      goal('home', 'home#11', 60),
    ];
    expect(kinds(context(lead))).not.toContain('virada');
  });

  it('marks a thrashing from a margin of 3', () => {
    const three = [
      goal('away', 'away#10', 1),
      goal('away', 'away#10', 2),
      goal('away', 'away#9', 3),
    ];
    expect(resultMarkers(teams, context(three))).toContainEqual({ kind: 'goleada', side: 'away' });
    expect(kinds(context(three.slice(0, 2)))).not.toContain('goleada');
  });

  it('marks an upset when the winner had strength + home at least 8 below the loser', () => {
    const awayWin = [goal('away', 'away#10', 30)];
    // Away 66 against home 70 + 4: gap 8 → upset; 67 → gap 7, no upset.
    expect(kinds(context(awayWin, { strength: { home: 70, away: 66 } }))).toContain('zebra');
    expect(kinds(context(awayWin, { strength: { home: 70, away: 67 } }))).not.toContain('zebra');
    // Home 66 + 4 = 70 against away 78: gap 8 → upset.
    const homeWin = [goal('home', 'home#10', 30)];
    expect(kinds(context(homeWin, { strength: { home: 66, away: 78 } }))).toContain('zebra');
    // On neutral ground nobody gets the 4 points: 62 against 70 is an upset either way.
    expect(kinds(context(awayWin, { neutral: true, strength: { home: 70, away: 62 } }))).toContain(
      'zebra',
    );
    expect(
      kinds(context(awayWin, { neutral: true, strength: { home: 70, away: 63 } })),
    ).not.toContain('zebra');
  });

  it('marks a late goal only when the goal that set the result came at 85 or later', () => {
    const winner = [
      goal('home', 'home#10', 20),
      goal('away', 'away#9', 60),
      goal('home', 'home#9', 88),
    ];
    expect(resultMarkers(teams, context(winner))).toContainEqual({
      kind: 'golNoFim',
      side: 'home',
      player: 'home#9',
      minute: 88,
    });
    const equaliser = [goal('away', 'away#9', 60), goal('home', 'home#9', 90, 3)];
    expect(resultMarkers(teams, context(equaliser))).toContainEqual({
      kind: 'golNoFim',
      side: 'home',
      player: 'home#9',
      minute: 90,
      added: 3,
    });
    const padding = [goal('home', 'home#10', 20), goal('home', 'home#9', 89)];
    expect(kinds(context(padding))).not.toContain('golNoFim');
    expect(kinds(context([goal('home', 'home#10', 84)]))).not.toContain('golNoFim');
    expect(kinds(context([goal('home', 'home#10', 85)]))).toContain('golNoFim');
  });

  it('marks hat-tricks, clean sheets, the derby and debuts in the order of the table', () => {
    const home = side('home');
    home.appearances[9]!.goals = 3;
    const away = side('away', { clubAppearances: 0 });
    const hat = [
      goal('home', 'home#10', 10),
      goal('home', 'home#10', 20),
      goal('home', 'home#10', 30),
    ];
    const markers = resultMarkers([home, away], context(hat, { derby: true }));
    expect(markers.map((m) => m.kind)).toEqual([
      'goleada',
      'hatTrick',
      'semSofrerGols',
      'classico',
      ...Array<string>(11).fill('estreia'),
    ]);
    expect(markers[1]).toEqual({ kind: 'hatTrick', side: 'home', player: 'home#10', goals: 3 });
    expect(markers[2]).toEqual({ kind: 'semSofrerGols', side: 'home' });
    expect(kinds(context([]))).toEqual(['semSofrerGols', 'semSofrerGols']);
  });
});

describe('player ratings and best on the pitch (partida.md, "Estatísticas e notas")', () => {
  it('follows the rating formula within the noise of ±0.5', () => {
    const home = side('home');
    const away = side('away');
    const striker = home.appearances[10]!;
    striker.goals = 2;
    const keeper = away.appearances[0]!;
    keeper.saves = 3;
    keeper.conceded = 2;
    const ratings = playerRatings([home, away], [2, 0], new Rng(7));
    // 6.0 + 2 × 1.0 + 0.4 (win) = 8.4; 6.0 + 3 × 0.3 − 2 × 0.25 − 0.4 (loss) = 6.0.
    expect(Math.abs(ratings.get(striker)! - 8.4)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(ratings.get(keeper)! - 6.0)).toBeLessThanOrEqual(0.5);
  });

  it('leaves players with fewer than 15 minutes without a rating, and without a draw', () => {
    const home = side('home');
    const away = side('away');
    home.appearances[10]!.minutes = 14;
    const used = new Rng(3);
    const a = playerRatings([home, away], [0, 0], used);
    expect(a.get(home.appearances[10]!)).toBeNull();
    expect(a.size).toBe(22);
    const reference = new Rng(3);
    for (let i = 0; i < 21; i++) reference.next();
    expect(used.getState()).toBe(reference.getState());
    home.appearances[10]!.minutes = 15;
    expect(
      playerRatings([home, away], [0, 0], new Rng(3)).get(home.appearances[10]!),
    ).not.toBeNull();
  });

  it('clips the rating to 3.0..10.0', () => {
    const home = side('home');
    const away = side('away');
    home.appearances[10]!.goals = 9;
    away.appearances[0]!.conceded = 30;
    const ratings = playerRatings([home, away], [9, 0], new Rng(1));
    expect(ratings.get(home.appearances[10]!)).toBe(10);
    expect(ratings.get(away.appearances[0]!)).toBe(3);
  });

  it('breaks ties by goals, then the winning side, then the lower shirt, then home', () => {
    const home = side('home');
    const away = side('away');
    const everyone = [...home.appearances, ...away.appearances];
    /** Everyone rated 5, except the two given players, rated 8. */
    const tied = (a: Appearance, b: Appearance) =>
      new Map<Appearance, number | null>(
        everyone.map((app) => [app, app === a || app === b ? 8 : 5]),
      );
    const [h2, h9, h10] = [home.appearances[1]!, home.appearances[9]!, home.appearances[10]!];
    const [a2, a10] = [away.appearances[1]!, away.appearances[9]!];
    h10.goals = 1;
    expect(bestOnPitch(tied(h9, h10), 'home')).toBe(h10); // more goals
    expect(bestOnPitch(tied(h9, a10), 'away')).toBe(a10); // the winning side
    expect(bestOnPitch(tied(h9, a2), undefined)).toBe(a2); // lower shirt (2 against 10)
    expect(bestOnPitch(tied(h2, a2), undefined)).toBe(h2); // same shirt: home first
    expect(bestOnPitch(new Map([[h9, null]]), 'home')).toBeUndefined();
    expect(winnerOf([1, 1])).toBeUndefined();
    expect(winnerOf([0, 2])).toBe('away');
  });
});
