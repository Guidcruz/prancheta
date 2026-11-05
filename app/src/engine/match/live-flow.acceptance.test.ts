import { describe, expect, it } from 'vitest';
import { aiTeamInput, fixtureInput, testGame } from '../testing/match.ts';
import { testParams } from '../testing/params.ts';
import { simulateMatch } from './simulate.ts';
import type { MatchCommand, MatchEvent, MatchInput, MatchResult } from './types.ts';

/*
 * QA acceptance (T-012): the live-screen flow, engine only. The screen "pauses" at a minute,
 * takes commands, and re-runs the match with the accumulated list; what was already shown must
 * not change.
 */
const params = testParams();
const state = testGame();
const plain = state.fixtures.find((f) => !state.clubs[f.homeId]!.def.rivals.includes(f.awayId))!;
const base: MatchInput = {
  ...fixtureInput(state, plain),
  home: aiTeamInput(state, plain, plain.homeId, 'human'),
  away: aiTeamInput(state, plain, plain.awayId),
};
const lineup = base.home.sheet.lineup;
const bench = lineup.bench;
const key = (e: MatchEvent): number =>
  e.minute * 100 + (e.minute >= 90 || e.minute === 45 ? (e.added ?? 0) : 0);
const upTo = (r: MatchResult, k: number) => r.events.filter((e) => key(e) <= k);
const involves = (e: MatchEvent, id: string) => JSON.stringify(e).includes(`"${id}"`);

/** A seed whose home starter (outfield, not injured/sent off before 59) is stable: pick a free one. */
function pick(seedStart: number, ok: (r: MatchResult) => boolean) {
  for (let s = seedStart; s < seedStart + 200; s++) {
    const input = { ...base, seed: s };
    const r = simulateMatch(input, params);
    if (ok(r)) return { input, r };
  }
  throw new Error('no seed');
}

describe('live flow: pause at 59, commands, re-run', () => {
  const { input, r: first } = pick(
    1000,
    (r) =>
      !r.events.some(
        (e) =>
          (e.type === 'injury' || e.type === 'red' || e.type === 'substitution') &&
          e.minute < 62 &&
          e.side === 'home',
      ) && r.events.some((e) => e.type === 'fulltime' && !e.abandoned),
  );
  const out = lineup.starters[5]!;
  const inn = bench[0]!;
  const cmds: MatchCommand[] = [
    { minute: 59, side: 'home', kind: 'substitution', out, in: inn },
    { minute: 59, side: 'home', kind: 'tactic', posture: 'attacking', pressure: 'high' },
    { minute: 59, side: 'home', kind: 'preset', preset: 'allOut' },
  ];
  const second = simulateMatch(input, params, cmds);

  it('events up to 59 are identical, no warnings', () => {
    expect(second.warnings.filter((w) => w.code.startsWith('command-'))).toEqual([]);
    expect(upTo(second, 5999)).toEqual(upTo(first, 5999));
  });
  it('substitute appears from 60 and starter never again', () => {
    const subEv = second.events.find((e) => e.type === 'substitution' && e.in === inn);
    expect(subEv?.minute).toBe(60);
    expect(subEv).toMatchObject({ side: 'home', out, reason: 'tactical' });
    const after = second.events.filter(
      (e) => key(e) > 6000 || (e !== subEv && e.minute === 60 && e.type !== 'substitution'),
    );
    expect(after.some((e) => involves(e, out))).toBe(false);
    expect(second.events.filter((e) => key(e) <= 5999).some((e) => involves(e, inn))).toBe(false);
    expect(second.minutes[out]).toBeLessThanOrEqual(60);
    expect(second.minutes[inn]).toBeGreaterThan(0);
  });
  it('tactic and shortcut events at 60, deterministic on repeat', () => {
    const t = second.events.filter(
      (e) => e.type === 'tacticChange' && e.side === 'home' && e.minute === 60,
    );
    expect(t.length).toBeGreaterThan(0);
    expect(t.some((e) => e.type === 'tacticChange' && e.preset === 'allOut')).toBe(true);
    expect(simulateMatch(input, params, cmds)).toEqual(second);
  });
  it('a second pause at 74 keeps the prefix of the first list', () => {
    const more: MatchCommand[] = [
      ...cmds,
      { minute: 74, side: 'home', kind: 'preset', preset: 'holdResult' },
    ];
    const third = simulateMatch(input, params, more);
    expect(upTo(third, 7499)).toEqual(upTo(second, 7499));
  });
});

describe('live flow: command in second-half stoppage', () => {
  const found = pick(2000, (r) => {
    const s = r.events.find((e) => e.type === 'stoppage' && e.minutes >= 3 && e.half === 2);
    return (
      !!s &&
      !r.events.some(
        (e) => (e.type === 'injury' || e.type === 'red') && e.side === 'home' && e.minute >= 85,
      ) &&
      !r.events.some((e) => e.type === 'substitution' && e.side === 'home' && e.minute > 80)
    );
  });
  const out = lineup.starters.find(
    (s) =>
      !found.r.events.some((e) => e.type === 'substitution' && e.side === 'home' && e.out === s) &&
      s !== lineup.starters[0],
  )!;
  const used = new Set(
    found.r.events.flatMap((e) => (e.type === 'substitution' && e.side === 'home' ? [e.in] : [])),
  );
  const inn = bench.find((b) => !used.has(b))!;
  it('minute 90 valid from 90+1; added 1 valid from 90+2', () => {
    const c90: MatchCommand[] = [{ minute: 90, side: 'home', kind: 'substitution', out, in: inn }];
    const r90 = simulateMatch(found.input, params, c90);
    expect(r90.warnings.filter((w) => w.code.startsWith('command-'))).toEqual([]);
    const s = r90.events.find((e) => e.type === 'substitution' && e.in === inn)!;
    expect([s.minute, s.added]).toEqual([90, 1]);
    expect(upTo(r90, 9000)).toEqual(upTo(found.r, 9000));
    expect(r90.events.filter((e) => key(e) > 9001).some((e) => involves(e, out))).toBe(false);

    const c91: MatchCommand[] = [
      { minute: 90, added: 1, side: 'home', kind: 'substitution', out, in: inn },
    ];
    const r91 = simulateMatch(found.input, params, c91);
    const s2 = r91.events.find((e) => e.type === 'substitution' && e.in === inn)!;
    expect([s2.minute, s2.added]).toEqual([90, 2]);
    expect(upTo(r91, 9001)).toEqual(upTo(found.r, 9001));
  });
});

describe('live flow: Skip at half-time', () => {
  const { input, r: first } = pick(3000, () => true);
  it('skip keeps the first half and records the skip', () => {
    const cmds: MatchCommand[] = [{ minute: 45, side: 'home', kind: 'halftimeTalk', talk: 'skip' }];
    const r = simulateMatch(input, params, cmds);
    expect(upTo(r, 4599).filter((e) => e.type !== 'halftimeTalk')).toEqual(
      upTo(first, 4599).filter((e) => e.type !== 'halftimeTalk'),
    );
    expect(r.events.find((e) => e.type === 'halftimeTalk' && e.side === 'home')).toMatchObject({
      talk: 'skip',
    });
    expect(r.warnings.filter((w) => w.code.startsWith('command-'))).toEqual([]);
    expect(simulateMatch(input, params, cmds)).toEqual(r);
  });
});
