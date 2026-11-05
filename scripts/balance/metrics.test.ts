import { describe, expect, it } from 'vitest';
import type { ClubSize, MatchResult, StandingRow } from '../../app/src/engine/index.ts';
import type { AllOutTally, CalibratedGap, DuelTally } from './duels.ts';
import {
  addFans,
  addMatch,
  emptyMatchTally,
  strongestClubs,
  tableRecord,
  weakestClubs,
  type FansTally,
  type MatchTally,
  type SeasonRecord,
  type TableRecord,
} from './league.ts';
import {
  BIG_RELEGATED_NOTE,
  FUTURE_TARGETS,
  RARE_TARGETS,
  buildReport,
  exitCode,
  meanCi,
  notMeasured,
  pooledRows,
  withPooledVerdict,
  type MetricRow,
} from './metrics.ts';
import type { RunResults } from './run.ts';

/*
 * The metrics of the /balance with small inputs whose answer is known by hand: the tallies of a
 * few matches, a table, and a report built from records written in the test.
 */

type FakeResult = Pick<MatchResult, 'score' | 'stats' | 'events' | 'newInjuries'>;
const stats = (yellows: number, reds = 0) => ({
  shots: 0,
  onTarget: 0,
  possession: 50,
  yellows,
  reds,
});
const at = { minute: 10, half: 1 as const, importance: 1 as const };

function fake(score: [number, number], extra: Partial<FakeResult> = {}): FakeResult {
  return {
    score,
    stats: { home: stats(1), away: stats(1) },
    events: [],
    newInjuries: [],
    ...extra,
  };
}

describe('addMatch', () => {
  it('counts goals, draws, home wins, margins, scores, cards, injuries, penalties and subs', () => {
    const t = emptyMatchTally();
    addMatch(t, fake([1, 1]));
    addMatch(
      t,
      fake([2, 0], {
        stats: { home: stats(2, 1), away: stats(1) },
        newInjuries: [{ player: 'a#1', rounds: 3 }],
        events: [
          { ...at, type: 'penaltyAwarded', side: 'home', taker: 'a#9' },
          { ...at, type: 'goal', side: 'home', scorer: 'a#9', kind: 'penalty', score: [1, 0] },
          { ...at, type: 'red', side: 'home', player: 'a#4', reason: 'secondYellow' },
          { ...at, type: 'substitution', side: 'away', out: 'b#2', in: 'b#14', reason: 'fatigue' },
        ],
      }),
    );
    addMatch(t, fake([0, 5]));
    addMatch(t, fake([0, 0]));
    expect(t).toEqual<MatchTally>({
      matches: 4,
      goals: 9,
      nilNil: 1,
      draws: 2,
      homeWins: 1,
      margin3: 1,
      margin5: 1,
      scores: { '1x1': 1, '2x0': 1, '0x5': 1, '0x0': 1 },
      yellows: 9,
      reds: 1,
      secondYellows: 1,
      injuries: 1,
      injuryRounds: 3,
      penalties: 1,
      penaltyGoals: 1,
      subs: 1,
    });
  });
});

describe('the table of a season', () => {
  const ids = Array.from({ length: 20 }, (_, i) => `c${String(i + 1).padStart(2, '0')}`);
  const rows = (points: readonly number[], order: readonly string[] = ids): StandingRow[] =>
    order.map((clubId, i) => ({ clubId, position: i + 1, points: points[i]! }) as StandingRow);

  it('reads champion, 17th, big relegated, weak club in the G4 and the Z4 escapes', () => {
    // After round 30: the 16th has 30; c17 is 2 behind, c18 6, c19 7 and c20 15.
    const after30 = rows([...Array.from({ length: 16 }, (_, i) => 60 - i * 2), 28, 24, 23, 15]);
    // Final: c18 escapes to 15th (c15 drops to 18th); the others stay where they were.
    const order = [...ids];
    [order[14], order[17]] = [order[17]!, order[14]!];
    const final = rows(
      [80, 75, 70, ...Array.from({ length: 14 }, (_, i) => 66 - i * 2), 30, 28, 20],
      order,
    );
    const sizes: Record<string, ClubSize> = {};
    for (const id of ids) sizes[id] = id === 'c17' ? 'big' : id === 'c01' ? 'medium' : 'small';
    const strongest = ['c01', 'c02', 'c03', 'c04', 'c05', 'c15'];
    const record = tableRecord(final, after30, sizes, ['c20', 'c19', 'c03', 'c06'], strongest);
    expect(record).toEqual<TableRecord>({
      champion: 'c01',
      championPoints: 80,
      championSize: 'medium',
      seventeenthPoints: 40,
      bigRelegated: true,
      weakInG4: true,
      strongChampion: true,
      strongRelegated: true,
      z4: 4,
      z4Escaped: 1,
      z4Gap: 2,
      z4GapEscaped: 1,
    });
    // No weak club in the G4 and no big club down.
    const none = tableRecord(
      final,
      after30,
      { ...sizes, c17: 'small' },
      ['c20', 'c19', 'c18', 'c06'],
      ['c02', 'c03', 'c04', 'c05', 'c06', 'c18'],
    );
    expect([none.weakInG4, none.bigRelegated]).toEqual([false, false]);
    // The 6 strongest: c01 is not among them now; c18 escaped (15th), c15 went down instead.
    expect([none.strongChampion, none.strongRelegated]).toEqual([false, false]);
  });

  it('takes the weakest clubs of the ladder at the start, ties by id', () => {
    const clubs = Object.fromEntries(
      [
        ['b', 63],
        ['a', 63],
        ['c', 70],
        ['d', 61.5],
        ['e', 64],
        ['f', 80],
      ].map(([id, strength]) => [id, { strength: strength as number }]),
    );
    expect(weakestClubs({ clubs } as never)).toEqual(['d', 'a', 'b', 'e']);
    expect(strongestClubs({ clubs } as never, 3)).toEqual(['f', 'c', 'e']);
    expect(strongestClubs({ clubs } as never, 5)).toEqual(['f', 'c', 'e', 'a', 'b']);
  });
});

describe('meanCi', () => {
  it('gives the mean and 1.96 standard errors around it', () => {
    const { mean, ci95 } = meanCi([1, 2, 3, 4]);
    expect(mean).toBe(2.5);
    const half = (1.96 * Math.sqrt(5 / 3)) / 2;
    expect(ci95[0]).toBeCloseTo(2.5 - half, 12);
    expect(ci95[1]).toBeCloseTo(2.5 + half, 12);
  });
});

/** A season record with the given matches, table, fans and points. */
function season(
  index: number,
  matches: MatchTally,
  table: Partial<TableRecord>,
  points: Record<string, number>,
  fans: readonly number[] = [55],
  robot?: string,
): SeasonRecord {
  const f: FansTally = { n: 0, sum: 0, sumSq: 0, below20: 0, above90: 0 };
  for (const v of fans) addFans(f, v);
  const positions = Object.fromEntries(
    Object.entries(points)
      .sort(([, a], [, b]) => b - a)
      .map(([id], i) => [id, i + 1]),
  );
  return {
    index,
    ...(robot ? { robot } : {}),
    matches,
    sheets: { sheets: 10, highPressure: 4, tiredStarter: 0, byProfile: {} },
    fans: f,
    table: {
      champion: 'big1',
      championPoints: 77,
      championSize: 'big',
      seventeenthPoints: 42,
      bigRelegated: true,
      weakInG4: false,
      strongChampion: true,
      strongRelegated: false,
      z4: 4,
      z4Escaped: 1,
      z4Gap: 1,
      z4GapEscaped: 0,
      ...table,
    },
    points,
    positions,
  };
}

function matches(scores: Record<string, number>): MatchTally {
  const t = emptyMatchTally();
  for (const [score, n] of Object.entries(scores)) {
    const [h, a] = score.split('x').map(Number) as [number, number];
    for (let i = 0; i < n; i++) addMatch(t, fake([h, a]));
  }
  return t;
}

const byId = (rows: readonly MetricRow[], id: string) => rows.find((r) => r.id === id)!;
const duel = (wins: number, draws: number, losses: number): DuelTally => ({
  matches: wins + draws + losses,
  wins,
  draws,
  losses,
  goals: 0,
});

describe('buildReport', () => {
  // 20 matches, 52 goals (2.6 a match), 5 draws (25%), 10 home wins (50%).
  const m = matches({ '1x1': 4, '1x0': 4, '2x1': 3, '0x0': 1, '3x1': 3, '0x2': 2, '2x3': 3 });
  const seasons = [
    season(
      1,
      m,
      { championPoints: 76, seventeenthPoints: 41 },
      { big1: 76, coritibom: 50 },
      [50, 60],
    ),
    season(
      2,
      m,
      { championPoints: 80, seventeenthPoints: 44, champion: 'coritibom', championSize: 'medium' },
      { big1: 70, coritibom: 52 },
      [10, 95],
    ),
  ];
  const robotSeasons = [
    season(1, m, {}, { big1: 76, coritibom: 55 }, [55], 'coritibom'),
    season(2, m, {}, { big1: 70, coritibom: 58 }, [55], 'coritibom'),
  ];
  const results: RunResults = {
    seasons,
    robotSeasons,
    calibrated: new Map<CalibratedGap, DuelTally>([
      [20, duel(65, 20, 15)],
      [30, duel(80, 13, 7)],
    ]),
    tactical: new Map([
      ['4-3-3', duel(40, 21, 39)],
      ['attacking', duel(45, 20, 35)],
      ['reference', duel(36, 28, 36)],
    ]),
    allOut: { samples: 100, tries: 400, keptNotLost: 40, allOutNotLost: 44 } satisfies AllOutTally,
  };
  const report = buildReport(results, { robotClub: 'coritibom' });

  it('measures the matches against the targets', () => {
    expect(byId(report.rows, 'goals')).toMatchObject({ value: 2.6, status: 'dentro' });
    expect(byId(report.rows, 'draws')).toMatchObject({ value: 0.25, status: 'dentro' });
    expect(byId(report.rows, 'homeWins')).toMatchObject({ value: 0.5, status: 'dentro' });
    expect(byId(report.rows, 'nilNil')).toMatchObject({ value: 0.05, status: 'fora' });
    expect(byId(report.rows, 'margin3').value).toBe(0);
    expect(report.topScores.map((s) => s.score)).toEqual(['1×0', '1×1', '2×1']);
    expect(byId(report.rows, 'topScores').status).toBe('dentro');
  });

  it('reads the duels: 20 points, the upset of 30, the tactics and "tudo no ataque"', () => {
    expect(byId(report.rows, 'strong20')).toMatchObject({ value: 0.65, status: 'dentro' });
    expect(byId(report.rows, 'upset30')).toMatchObject({ value: 0.07, status: 'fora' });
    expect(byId(report.rows, 'tactic-4-3-3').value).toBeCloseTo(0.01, 12);
    expect(byId(report.rows, 'tactic-4-3-3').status).toBe('dentro');
    expect(byId(report.rows, 'tactic-attacking')).toMatchObject({ value: 0.1, status: 'fora' });
    // A variant that did not run is "n/a", never "fora".
    expect(byId(report.rows, 'tactic-5-3-2').status).toBe('n/a');
    // "Tudo no ataque" from minute 60 (the shortcut and the posture) is a tactic like the others:
    // required, within ±3 p.p.; the kick-off duel is gone (the rule ignores the command).
    expect(report.rows.some((r) => r.id === 'tactic-allout-start')).toBe(false);
    for (const id of ['tactic-allout-60', 'tactic-allout-60-medium']) {
      expect(byId(report.rows, id)).toMatchObject({ status: 'n/a', required: true });
    }
    const allOut60 = buildReport({
      ...results,
      tactical: new Map([
        ['allout-60', duel(38, 22, 40)],
        ['allout-60-medium', duel(42, 20, 38)],
      ]),
    });
    expect(byId(allOut60.rows, 'tactic-allout-60').value).toBeCloseTo(-0.02, 12);
    expect(byId(allOut60.rows, 'tactic-allout-60')).toMatchObject({
      status: 'dentro',
      label:
        'Tática "tudo no ataque" desde o minuto 60 (atalho, pressão alta) contra 4-4-2 equilibrada média (V − D)',
    });
    expect(byId(allOut60.rows, 'tactic-allout-60-medium').value).toBeCloseTo(0.04, 12);
    expect(byId(allOut60.rows, 'tactic-allout-60-medium')).toMatchObject({
      status: 'fora',
      label:
        'Tática "tudo no ataque" desde o minuto 60 (postura, pressão média) contra 4-4-2 equilibrada média (V − D)',
    });
    expect(byId(report.rows, 'allOut').value).toBeCloseTo(0.04, 12);
    expect(byId(report.rows, 'allOut').status).toBe('dentro');
  });

  it('gives the points per game of each tactic against the reference, as information', () => {
    // Reference against itself: (3 × 36 + 28) / 100 = 1.36; 4-3-3: (3 × 40 + 21) / 100 = 1.41.
    const reference = byId(report.rows, 'tactic-ppg-reference');
    expect(reference).toMatchObject({ value: 1.36, shown: '1,360', required: false });
    const t433 = byId(report.rows, 'tactic-ppg-4-3-3');
    expect(t433.value).toBeCloseTo(0.05, 12);
    expect(t433).toMatchObject({ shown: '1,410 (+0,050)', status: 'fora', required: false });
    expect(byId(report.rows, 'tactic-ppg-5-3-2').status).toBe('n/a');
    expect(exitCode({ rows: report.rows.filter((r) => r.id.startsWith('tactic-ppg-')) })).toBe(0);
    // Without the reference duel there is nothing to compare with.
    const noRef = buildReport({ ...results, tactical: new Map([['4-3-3', duel(40, 21, 39)]]) });
    expect(byId(noRef.rows, 'tactic-ppg-4-3-3').status).toBe('n/a');
  });

  it('reads the table, the fans, the sizes and the Z4', () => {
    expect(byId(report.rows, 'champion')).toMatchObject({ value: 78, status: 'dentro' });
    expect(byId(report.rows, 'seventeenth')).toMatchObject({ value: 42.5, status: 'dentro' });
    expect(byId(report.rows, 'fansMean').value).toBeCloseTo(53.75, 12);
    expect(byId(report.rows, 'fansBelow20')).toMatchObject({ value: 0.25, status: 'fora' });
    expect(byId(report.rows, 'fansAbove90')).toMatchObject({ value: 0.25, status: 'fora' });
    const sd = Math.sqrt((50 ** 2 + 60 ** 2 + 10 ** 2 + 95 ** 2) / 4 - 53.75 ** 2);
    expect(byId(report.rows, 'fansSd').value).toBeCloseTo(sd, 9);
    expect(byId(report.rows, 'bigChampion').value).toBe(0.5);
    // Informative in the single season (CEO, 2026-11-05): out of 40% to 80%, but not required.
    expect(byId(report.rows, 'bigRelegated')).toMatchObject({
      value: 1,
      status: 'fora',
      required: false,
      note: BIG_RELEGATED_NOTE,
    });
    expect(exitCode({ rows: [byId(report.rows, 'bigRelegated')] })).toBe(0);
    // The 6 strongest of the ladder: the champion of season 2 was not one of them.
    seasons[1]!.table.strongChampion = false;
    const strong = buildReport(results);
    seasons[1]!.table.strongChampion = true;
    expect(byId(strong.rows, 'strongChampion')).toMatchObject({ value: 0.5, required: false });
    expect(byId(strong.rows, 'strongRelegated')).toMatchObject({ value: 0, required: false });
    expect(byId(report.rows, 'weakInG4').value).toBe(0);
    expect(byId(report.rows, 'z4Escape').value).toBe(0.25);
    expect(byId(report.rows, 'z4EscapeGap')).toMatchObject({ value: 0, status: 'fora' });
    expect(report.titles).toEqual([
      { club: 'big1', titles: 1 },
      { club: 'coritibom', titles: 1 },
    ]);
  });

  it('pairs the robot seasons with the AI ones: gain per season and its interval', () => {
    expect(report.robot).toMatchObject({
      club: 'coritibom',
      seasons: 2,
      gain: 5.5,
      robotPoints: 56.5,
      aiPoints: 51,
      robotTitles: 0,
      aiTitles: 0.5,
    });
    expect(report.robot!.ci95[0]).toBeCloseTo(5.5 - 0.98, 9);
    expect(byId(report.rows, 'robotGain')).toMatchObject({ value: 5.5, status: 'dentro' });
    expect(byId(report.rows, 'robotTitles')).toMatchObject({ value: 0, status: 'dentro' });
  });

  it('marks every metric as n/a when nothing ran', () => {
    const empty = buildReport({
      seasons: [],
      robotSeasons: [],
      calibrated: new Map(),
      tactical: new Map(),
    });
    expect(empty.rows.every((r) => r.status === 'n/a')).toBe(true);
    expect(exitCode(empty)).toBe(0);
    expect(notMeasured(empty).map((r) => r.id)).toContain('goals');
    const measured = notMeasured(report).map((r) => r.id);
    expect(measured).not.toContain('goals');
    expect(measured).toContain('injuryRounds'); // no injury in the fake matches
    expect(notMeasured(report).every((r) => r.required)).toBe(true);
  });

  it('lists the targets of later stages as n/a, never required', () => {
    const future = report.rows.filter((r) => r.id.startsWith('future-'));
    expect(future.map((r) => r.label)).toEqual([
      'Projeto do clube médio',
      'Estabilidade da liga',
      'Inflação de salários',
      'Público médio',
      'Frequência de eventos das Brasilidades',
    ]);
    expect(future).toHaveLength(FUTURE_TARGETS.length);
    for (const r of future) expect(r).toMatchObject({ status: 'n/a', required: false });
    expect(notMeasured(report).some((r) => r.id.startsWith('future-'))).toBe(false);
  });
});

describe('several seeds', () => {
  const m = matches({ '1x1': 1 });
  const run = (tables: Partial<TableRecord>[]): RunResults => ({
    seasons: tables.map((t, i) => season(i + 1, m, t, { big1: 70 })),
    robotSeasons: [],
    calibrated: new Map(),
    tactical: new Map(),
  });
  // 100 seasons per seed: 1 small champion in seed 1, none in seed 2, 2 in seed 3.
  const seeds = [1, 0, 2].map((small) =>
    run(
      Array.from({ length: 100 }, (_, i) => ({
        championSize: i < small ? ('small' as const) : ('big' as const),
        weakInG4: i < 6,
        z4Gap: 2,
        z4GapEscaped: i < 3 ? 1 : 0,
      })),
    ),
  );

  it('judges the rare targets on the seasons of every seed together', () => {
    const rows = pooledRows(seeds);
    expect(rows.map((r) => r.id)).toEqual([...RARE_TARGETS]);
    expect(rows[0]).toMatchObject({ value: 0.01, status: 'dentro', required: true });
    expect(rows[1]).toMatchObject({ value: 0.06, status: 'dentro' });
    expect(rows[2]).toMatchObject({ value: 0.015, status: 'fora' });
  });

  it('stops counting the rare targets in each seed, and only those', () => {
    const one = buildReport(seeds[1]!);
    expect(byId(one.rows, 'smallChampion')).toMatchObject({ status: 'fora', required: true });
    const judged = withPooledVerdict(one);
    for (const id of RARE_TARGETS) {
      expect(byId(judged.rows, id)).toMatchObject({ required: false, verdict: 'pooled' });
    }
    expect(byId(judged.rows, 'goals')).toMatchObject({ required: true });
    expect(byId(judged.rows, 'goals').verdict).toBeUndefined();
    expect(judged.rows.filter((r) => r.verdict === 'pooled')).toHaveLength(RARE_TARGETS.length);
  });
});

describe('exitCode', () => {
  const r = (required: boolean, status: MetricRow['status']): MetricRow => ({
    id: 'x',
    label: 'x',
    shown: '',
    target: '',
    required,
    status,
  });

  it('is 1 only when a required metric is out', () => {
    expect(exitCode({ rows: [r(true, 'dentro'), r(false, 'fora'), r(true, 'n/a')] })).toBe(0);
    expect(exitCode({ rows: [r(true, 'dentro'), r(true, 'fora')] })).toBe(1);
  });
});
