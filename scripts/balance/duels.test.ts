import { describe, expect, it } from 'vitest';
import { PARAM_RANGES, seedFromString, simulateMatch } from '../../app/src/engine/index.ts';
import type { MatchCommand, MatchEvent, MatchInput, Side } from '../../app/src/engine/index.ts';
import {
  ALL_OUT_MINUTE,
  DUEL_PAIR_MATCHES,
  REFERENCE_VARIANT,
  TACTIC_VARIANTS,
  allOutCommandMinute,
  allOutDuel,
  allOutSamples,
  calibratedDuel,
  calibratedSamples,
  emptyAllOutTally,
  emptyDuelTally,
  scoreAfter,
  tacticalDuel,
  tacticalSamples,
  type AllOutTally,
  type DuelTally,
} from './duels.ts';
import { loadParams } from './options.ts';

/*
 * The duels of the /balance (code review of T-016, part 1): which side is the "first" of a tally,
 * how "tudo no ataque" picks its 0×1 matches at 75' (with the first 75 minutes the same in both
 * versions), and that a duel split into chunks sums to the same tally as in one piece.
 */

const loaded = loadParams();
if (!loaded.ok) throw new Error('the repository parameters must load');
const params = loaded.params;
const SEED = 1;

const other = (side: Side): Side => (side === 'home' ? 'away' : 'home');
const meanOverall = (input: MatchInput, side: Side) => {
  const team = input[side];
  const starters = new Set(team.sheet.lineup.starters);
  const players = team.players.filter((p) => starters.has(p.id));
  return players.reduce((s, p) => s + p.overall, 0) / players.length;
};

/** The tally of samples `from` to `to`, counted by hand from the first side's goals. */
function byHand(
  sample: (n: number) => { input: MatchInput; first: Side; commands: readonly MatchCommand[] },
  from: number,
  to: number,
): DuelTally {
  const t = emptyDuelTally();
  for (let n = from; n < to; n++) {
    const { input, first, commands } = sample(n);
    const result = simulateMatch(input, params, commands);
    const own = result.score[first === 'home' ? 0 : 1];
    const theirs = result.score[first === 'home' ? 1 : 0];
    t.matches += 1;
    t.goals += own + theirs;
    if (own > theirs) t.wins += 1;
    else if (own === theirs) t.draws += 1;
    else t.losses += 1;
  }
  return t;
}

const sumDuel = (parts: readonly DuelTally[]) =>
  parts.reduce((a, b) => {
    for (const key of Object.keys(b) as (keyof DuelTally)[]) a[key] += b[key];
    return a;
  }, emptyDuelTally());
const sumAllOut = (parts: readonly AllOutTally[]) =>
  parts.reduce((a, b) => {
    for (const key of Object.keys(b) as (keyof AllOutTally)[]) a[key] += b[key];
    return a;
  }, emptyAllOutTally());

describe('calibrated duel', () => {
  it('counts the stronger squad as the first side, home on even samples and away on odd', () => {
    const sample = calibratedSamples(params, SEED, 30);
    for (let n = 0; n < 4; n++) {
      const { input, first } = sample(n);
      expect(first).toBe(n % 2 === 0 ? 'home' : 'away');
      expect(input[first].clubId).toBe('duel-a');
      expect(input[other(first)].clubId).toBe('duel-b');
      // 85 against 55: the first side's starters are about 30 points better.
      expect(meanOverall(input, first) - meanOverall(input, other(first))).toBeGreaterThan(20);
      expect(input.neutral).toBe(true);
    }
  });

  it('tallies wins, draws and losses of the first side', () => {
    const tally = calibratedDuel(params, SEED, 30, 0, 60);
    expect(tally).toEqual(byHand(calibratedSamples(params, SEED, 30), 0, 60));
    // The stronger side by 30 points wins most and loses few.
    expect(tally.wins).toBeGreaterThan(3 * tally.losses);
  });
});

describe('tactical duel', () => {
  const variants = [
    TACTIC_VARIANTS.find((v) => v.id === '3-5-2')!,
    TACTIC_VARIANTS.find((v) => v.id === 'attacking')!,
    TACTIC_VARIANTS.find((v) => v.id === 'pressure-high')!,
  ];

  it('counts the variant as the first side, against the 4-4-2 balanced medium', () => {
    for (const variant of variants) {
      const sample = tacticalSamples(params, SEED, variant);
      for (let n = 0; n < 2; n++) {
        const { input, first } = sample(n);
        expect(first).toBe(n % 2 === 0 ? 'home' : 'away');
        const own = input[first];
        const ref = input[other(first)];
        expect(own.clubId).toBe('duel-var');
        expect(own.sheet.lineup.formation).toBe(variant.formation);
        expect(own.sheet.tactic).toEqual({ posture: variant.posture, pressure: variant.pressure });
        expect(ref.clubId).toBe('duel-ref');
        expect(ref.sheet.lineup.formation).toBe('4-4-2');
        expect(ref.sheet.tactic).toEqual({ posture: 'balanced', pressure: 'medium' });
        // Both "human" with no commands: the tactic under test stays for the 90 minutes.
        expect([own.controller, ref.controller]).toEqual(['human', 'human']);
        expect(sample(n).commands).toEqual([]);
      }
    }
  });

  it('tallies the variant side, and the reference duel plays the reference on both sides', () => {
    const variant = variants[0]!;
    expect(tacticalDuel(params, SEED, variant, 0, 40)).toEqual(
      byHand(tacticalSamples(params, SEED, variant), 0, 40),
    );
    const { input } = tacticalSamples(params, SEED, REFERENCE_VARIANT)(0);
    expect(input.home.sheet.tactic).toEqual(input.away.sheet.tactic);
    expect(input.home.sheet.lineup.formation).toBe(input.away.sheet.lineup.formation);
  });
});

describe('"tudo no ataque" from minute 60', () => {
  const preset = TACTIC_VARIANTS.find((v) => v.id === 'allout-60')!;
  const posture = TACTIC_VARIANTS.find((v) => v.id === 'allout-60-medium')!;

  it('replaces the kick-off duel: the rule ignores "tudo no ataque" at minute 0', () => {
    expect(TACTIC_VARIANTS.some((v) => v.id === 'allout-start')).toBe(false);
    const { input, first } = tacticalSamples(params, SEED, REFERENCE_VARIANT)(0);
    const kickoff: MatchCommand = { minute: 0, side: first, kind: 'preset', preset: 'allOut' };
    const r = simulateMatch(input, params, [kickoff]);
    expect(r.warnings.map((w) => w.code)).toEqual(['command-too-early']);
    expect(r.events).toEqual(simulateMatch(input, params).events);
  });

  it('sends the command at the last minute before match.allOutFromMinute', () => {
    expect(params.match.allOutFromMinute).toBe(60);
    expect(allOutCommandMinute(params)).toBe(59);
    const at = (allOutFromMinute: number) =>
      allOutCommandMinute({ ...params, match: { ...params.match, allOutFromMinute } });
    expect([at(0), at(1), at(76)]).toEqual([0, 0, 75]);
  });

  it.each([
    [preset, { kind: 'preset', preset: 'allOut' }, 'high'],
    [posture, { kind: 'tactic', posture: 'allOut', pressure: 'medium' }, 'medium'],
  ] as const)(
    '$id: starts as the reference and goes all out from minute 60 on its own side',
    (variant, command, pressure) => {
      expect(variant).toMatchObject({
        formation: '4-4-2',
        posture: 'balanced',
        pressure: 'medium',
      });
      const sample = tacticalSamples(params, SEED, variant);
      for (let n = 0; n < 2; n++) {
        const { input, first, commands } = sample(n);
        expect(input[first].clubId).toBe('duel-var');
        expect(commands).toEqual([{ minute: 59, side: first, ...command }]);
        const result = simulateMatch(input, params, commands);
        expect(result.warnings).toEqual([]);
        // The variant plays "tudo no ataque" from minute 60 to the end; the first hour is the
        // match without the command.
        const changes = result.events.filter((e) => e.type === 'tacticChange');
        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({
          half: 2,
          minute: 60,
          side: first,
          posture: 'allOut',
          pressure,
        });
        const before = (events: readonly MatchEvent[]) =>
          events.filter((e) => e.half === 1 || e.minute < 60);
        expect(before(result.events)).toEqual(before(simulateMatch(input, params).events));
      }
    },
  );

  it('keeps the informative low-pressure variant out of the exit code', () => {
    const low = TACTIC_VARIANTS.find((v) => v.id === 'allout-60-low')!;
    expect(low).toMatchObject({ pressure: 'low', allOut: 'posture', info: true });
    expect(TACTIC_VARIANTS.filter((v) => v.info).map((v) => v.id)).toEqual(['allout-60-low']);
    const { first, commands } = tacticalSamples(params, SEED, low)(0);
    expect(commands).toEqual([
      { minute: 59, side: first, kind: 'tactic', posture: 'allOut', pressure: 'low' },
    ]);
  });

  it('tallies the variants with their command', () => {
    for (const variant of [preset, posture]) {
      const sample = tacticalSamples(params, SEED, variant);
      expect(tacticalDuel(params, SEED, variant, 0, 20)).toEqual(byHand(sample, 0, 20));
    }
  });
});

describe('"tudo no ataque" duel', () => {
  const minuteOf = (e: MatchEvent) => (e.half === 1 ? 0 : e.minute);
  const upTo75 = (events: readonly MatchEvent[]) =>
    JSON.stringify(events.filter((e) => e.half === 1 || minuteOf(e) <= ALL_OUT_MINUTE));
  const samples = [...allOutSamples(params, SEED, 0, 30)];

  it('takes only matches 0×1 or 1×0 after minute 75, the trailing side going all out', () => {
    expect(samples).toHaveLength(30);
    for (const sample of samples) {
      const m = sample.match!;
      expect(m, `sample ${sample.n}`).toBeDefined();
      const score = scoreAfter(m.kept.events, ALL_OUT_MINUTE);
      expect([
        [0, 1],
        [1, 0],
      ]).toContainEqual(score);
      expect(m.trailing).toBe(score[0] === 0 ? 'home' : 'away');
      expect(m.input.home.controller).toBe('human');
      // The kept match changes nothing; the other gets the all-out tactic from minute 76.
      const changes = (events: readonly MatchEvent[]) =>
        events.filter((e) => e.type === 'tacticChange' && e.side === m.trailing);
      expect(changes(m.kept.events)).toEqual([]);
      const allOut = changes(m.allOut.events);
      expect(allOut[0]).toMatchObject({ half: 2, minute: ALL_OUT_MINUTE + 1, posture: 'allOut' });
    }
  });

  it('plays the same first 75 minutes in both versions', () => {
    for (const { match: m } of samples) {
      expect(upTo75(m!.allOut.events)).toBe(upTo75(m!.kept.events));
      expect(m!.allOut.events.length).toBeGreaterThan(0);
    }
  });

  it('skips the seeds tried before, which are not 0×1 or 1×0 at 75', () => {
    const retried = samples.filter((s) => s.tries > 1);
    expect(retried.length).toBeGreaterThan(0);
    for (const sample of retried) {
      for (let t = 0; t < sample.tries - 1; t++) {
        const input = {
          ...sample.match!.input,
          fixtureId: `allout-${sample.n}-${t}`,
          seed: seedFromString(`balance-${SEED}-allout-${sample.n}-${t}`),
        };
        const [h, a] = scoreAfter(simulateMatch(input, params).events, ALL_OUT_MINUTE);
        expect((h === 0 && a === 1) || (h === 1 && a === 0), `${sample.n}-${t}`).toBe(false);
      }
    }
  });

  it('tallies P(not losing) of the trailing side in each version', () => {
    const tally = allOutDuel(params, SEED, 0, 30);
    const notLost = (score: readonly [number, number], side: Side) =>
      side === 'home' ? score[0] >= score[1] : score[1] >= score[0];
    expect(tally).toEqual({
      samples: 30,
      tries: samples.reduce((n, s) => n + s.tries, 0),
      keptNotLost: samples.filter((s) => notLost(s.match!.kept.score, s.match!.trailing)).length,
      allOutNotLost: samples.filter((s) => notLost(s.match!.allOut.score, s.match!.trailing))
        .length,
    });
  });
});

describe('scoreAfter', () => {
  const goal = (half: 1 | 2, minute: number, side: Side, added?: number): MatchEvent =>
    ({
      type: 'goal',
      half,
      minute,
      side,
      importance: 3,
      scorer: 'x#9',
      kind: 'open',
      score: [0, 0],
      ...(added === undefined ? {} : { added }),
    }) as unknown as MatchEvent;

  it('counts the first half with its added time and the second half up to the minute', () => {
    const events = [
      goal(1, 10, 'home'),
      goal(1, 45, 'away', 2),
      goal(2, 75, 'away'),
      goal(2, 76, 'home'),
      goal(2, 90, 'home', 3),
    ];
    expect(scoreAfter(events, 75)).toEqual([1, 2]);
    expect(scoreAfter(events, 76)).toEqual([2, 2]);
    expect(scoreAfter(events, 74)).toEqual([1, 1]);
  });
});

describe('a duel split into chunks', () => {
  // Chunk edges inside a pair of squads (DUEL_PAIR_MATCHES) and across one.
  const edges = [0, 25, DUEL_PAIR_MATCHES + 5, DUEL_PAIR_MATCHES + 10];
  const pieces = <T>(run: (from: number, to: number) => T) =>
    edges.slice(1).map((to, i) => run(edges[i]!, to));
  const end = edges[edges.length - 1]!;

  it('sums to the same tally as in one piece', () => {
    expect(sumDuel(pieces((f, t) => calibratedDuel(params, SEED, 20, f, t)))).toEqual(
      calibratedDuel(params, SEED, 20, 0, end),
    );
    const variant = TACTIC_VARIANTS.find((v) => v.id === '4-3-3')!;
    expect(sumDuel(pieces((f, t) => tacticalDuel(params, SEED, variant, f, t)))).toEqual(
      tacticalDuel(params, SEED, variant, 0, end),
    );
    expect(sumAllOut([allOutDuel(params, SEED, 0, 12), allOutDuel(params, SEED, 12, 30)])).toEqual(
      allOutDuel(params, SEED, 0, 30),
    );
  });
});

describe('a duel command the engine ignores is an error of the tool (review of T-016)', () => {
  const late = (allOutFromMinute: number) => ({
    ...params,
    match: { ...params.match, allOutFromMinute },
  });

  it('caps match.allOutFromMinute at the minute the 0×1 duel plays "tudo no ataque" from', () => {
    expect(PARAM_RANGES.match.allOutFromMinute).toMatchObject({ min: 0, max: ALL_OUT_MINUTE + 1 });
    // At the top of the range every duel still plays its command.
    const top = late(PARAM_RANGES.match.allOutFromMinute.max);
    expect(allOutDuel(top, SEED, 0, 3).samples).toBe(3);
    for (const variant of TACTIC_VARIANTS.filter((v) => v.allOut !== undefined)) {
      expect(tacticalDuel(top, SEED, variant, 0, 2).matches).toBe(2);
    }
  });

  it('throws (exit code 3) instead of measuring the match without the command', () => {
    // Beyond the range (only a bug gets here: the validator refuses 77).
    expect(() => allOutDuel(late(77), SEED, 0, 3)).toThrow(/command-too-early/);
  });
});
