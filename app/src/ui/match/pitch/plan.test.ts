import { describe, expect, it } from 'vitest';
import type { MatchEvent, Side } from '@engine';
import { testMatchesOf, type TestMatch } from '../../testing/matches';
import { matchSteps, type MatchStep } from '../steps';
import { MATCH_TIMING } from '../timing';
import { PITCH_MOTION as M, PITCH_SIZE } from './motion';
import {
  ACT,
  BallPlanner,
  HEAD,
  PATTERN,
  SEG,
  TRAIL,
  ballAt,
  fillTrails,
  slowMotion,
  type PlanTrace,
} from './plan';
import { possessionTrace } from './possession';
import { choreograph, createScene, discShownIn, sceneAt, stillScene, tagDiscOf } from './scene';

/*
 * The planner of the ball (docs/design/telas/partida-campo-v2.md, 6 and 13, "planejador e
 * rastros", 1 to 8) on real matches of the test careers: determinism and step by step, continuity,
 * a ball that never stops, the limits, the distribution of the actions, never two passes over the
 * top in a row, nothing ahead of the outcome and no allocation.
 */

const SEEDS_1000 = Array.from({ length: 20 }, (_, i) => 100 + i);
/** 1,000 real matches (20 careers of 5 rounds), as the criterion of distribution asks. */
const corpus: readonly TestMatch[] = SEEDS_1000.flatMap((seed) => testMatchesOf(seed, 5));
const small = corpus.slice(0, 120);

const lineupsOf = (m: TestMatch) => ({
  home: { ...m.match.home.sheet.lineup, players: m.match.home.players },
  away: { ...m.match.away.sheet.lineup, players: m.match.away.players },
});

interface Prepared {
  steps: MatchStep[];
  trace: PlanTrace;
  planner: BallPlanner;
}

function prepare(m: TestMatch, events: readonly MatchEvent[] = m.result.events): Prepared {
  const steps = matchSteps(events, 'full');
  const trace = possessionTrace(steps, m.result.stats.home.possession, m.match.seed);
  const planner = new BallPlanner(steps, trace, m.match.seed);
  planner.ensure(steps.length - 1);
  return { steps, trace, planner };
}

const ball = new Float64Array(3);
const at = (planner: BallPlanner, i: number, a: number) => {
  ballAt(planner.plans[i]!, a, ball);
  return [ball[0]!, ball[1]!, ball[2]!] as const;
};

/** The advance of a step at the real time `t` (seconds of the Normal clock) after it starts. */
const advanceAt = (step: MatchStep, t: number) => {
  const d = MATCH_TIMING.normal[step.timing!] / 1000;
  const p = Math.min(1, t / d);
  return step.timing === 'drama' ? slowMotion(p) : p;
};

const isQuota = (planner: BallPlanner, i: number) => planner.plans[i]![HEAD.pattern]! > 0;

describe('the planner: determinism (13, planner 1)', () => {
  it('the same match gives the same plans, one by one or all at once; another seed, another', () => {
    for (const m of small.slice(0, 12)) {
      const all = prepare(m);
      const steps = matchSteps(m.result.events, 'full');
      const trace = possessionTrace(steps, m.result.stats.home.possession, m.match.seed);
      // Step by step, as the screen does: the plan of step i + 1 when step i is revealed.
      const one = new BallPlanner(steps, trace, m.match.seed);
      steps.forEach((_, i) => one.ensure(i + 1));
      expect(one.plans.length).toBe(all.planner.plans.length);
      one.plans.forEach((plan, i) =>
        expect([...plan], `step ${i}`).toEqual([...all.planner.plans[i]!]),
      );
      // Asked out of order, it still makes the plans in order.
      const late = new BallPlanner(steps, trace, m.match.seed);
      late.ensure(steps.length - 1);
      late.ensure(3);
      expect(late.plans.map((p) => [...p])).toEqual(all.planner.plans.map((p) => [...p]));
      const other = new BallPlanner(steps, trace, m.match.seed + 1);
      other.ensure(steps.length - 1);
      expect(other.plans.map((p) => [...p])).not.toEqual(all.planner.plans.map((p) => [...p]));
    }
  });

  it('the frames of the scene are the same too, one by one or all at once', () => {
    const m = small[0]!;
    const steps = matchSteps(m.result.events, 'full');
    const trace = possessionTrace(steps, m.result.stats.home.possession, m.match.seed);
    const choreo = choreograph(steps, lineupsOf(m), m.match.seed);
    const a = new BallPlanner(steps, trace, m.match.seed);
    const b = new BallPlanner(steps, trace, m.match.seed);
    b.ensure(steps.length - 1);
    const sa = createScene();
    const sb = createScene();
    for (let i = 0; i < steps.length; i += 3) {
      a.ensure(i + 1);
      for (const p of [0, 0.4, 1]) {
        sceneAt(choreo, i, p, sa, 'normal', a);
        sceneAt(choreo, i, p, sb, 'normal', b);
        expect(sa.ballX).toBe(sb.ballX);
        expect(sa.ballZ).toBe(sb.ballZ);
        expect([...sa.trails]).toEqual([...sb.trails]);
        expect(sa.wedgeOwner).toBe(sb.wedgeOwner);
      }
    }
  });
});

describe('the planner: continuity (13, planner 2)', () => {
  it('each step starts where the previous one ended, to 1 mm, and the ball lands at the end of each', () => {
    for (const m of small) {
      const { steps, planner } = prepare(m);
      for (let i = 1; i < steps.length; i++) {
        const end = at(planner, i - 1, 1);
        const start = at(planner, i, 0);
        expect(Math.hypot(start[0] - end[0], start[1] - end[1]), `step ${i}`).toBeLessThan(0.001);
        expect(end[2], `z at the end of ${i - 1}`).toBeLessThan(1e-9);
      }
    }
  });

  it('never moves more than 3 m in 16 ms of the Normal clock (8 m in the weak chance and the penalty without outcome)', () => {
    let worst = 0;
    let worstWeak = 0;
    for (const m of small) {
      const { steps, planner } = prepare(m);
      steps.forEach((step, i) => {
        if (step.timing === undefined) return;
        const d = MATCH_TIMING.normal[step.timing] / 1000;
        const type = step.line?.source.type;
        // The weak chance and a penalty with no outcome: the way to the point and the shot in 400 ms.
        const weak = step.timing === 'event' && (type === 'chance' || type === 'penaltyAwarded');
        const justScored = steps[i - 1]?.timing === 'afterGoal';
        let previous = at(planner, i, 0);
        for (let t = 0.016; t <= d + 0.016; t += 0.016) {
          const now = at(planner, i, advanceAt(step, Math.min(t, d)));
          const moved = Math.hypot(now[0] - previous[0], now[1] - previous[1]);
          if (weak && !justScored) worstWeak = Math.max(worstWeak, moved);
          else worst = Math.max(worst, moved);
          previous = now;
        }
      });
    }
    expect(worst).toBeLessThanOrEqual(3);
    expect(worstWeak).toBeLessThanOrEqual(8);
  });

  it('is continuous through the scene too (sceneAt with the planner)', () => {
    for (const m of small.slice(0, 10)) {
      const { steps, trace } = prepare(m);
      const choreo = choreograph(steps, lineupsOf(m), m.match.seed);
      const planner = new BallPlanner(steps, trace, m.match.seed);
      const out = createScene();
      for (let i = 1; i < steps.length; i++) {
        planner.ensure(i + 1);
        sceneAt(choreo, i - 1, 1, out, 'normal', planner);
        const end = [out.ballX, out.ballY];
        sceneAt(choreo, i, 0, out, 'normal', planner);
        expect(Math.hypot(out.ballX - end[0]!, out.ballY - end[1]!)).toBeLessThan(0.001);
      }
    }
  });
});

describe('the planner: the ball never stops, and the limits (13, planner 3 and 4)', () => {
  it('in no 200 ms of the steps of the quota the ball goes less than 0.2 m', () => {
    let least = Infinity;
    for (const m of small) {
      const { steps, planner } = prepare(m);
      // The path on a grid of 10 ms, for the runs of steps of the quota: what the ball travels
      // in 200 ms, a wall pass that turns back included.
      let run: [number, number][] = [];
      const flush = () => {
        for (let k = 0; k + 20 < run.length; k++) {
          let travelled = 0;
          for (let j = k; j < k + 20; j++) {
            travelled += Math.hypot(run[j + 1]![0] - run[j]![0], run[j + 1]![1] - run[j]![1]);
          }
          least = Math.min(least, travelled);
        }
        run = [];
      };
      steps.forEach((step, i) => {
        if (step.timing === undefined || !isQuota(planner, i)) {
          flush();
          return;
        }
        const d = MATCH_TIMING.normal[step.timing] / 1000;
        for (let t = 0; t < d - 1e-9; t += 0.01) {
          const p = at(planner, i, t / d);
          run.push([p[0], p[1]]);
        }
      });
      flush();
    }
    expect(least).toBeGreaterThanOrEqual(0.2);
  });

  it('in the steps of the quota the ball ends every action inside 10 to 95 m by 5 to 63 m, but for the restart', () => {
    let restarts = 0;
    let reach = 0;
    for (const m of small) {
      const { steps, planner } = prepare(m);
      steps.forEach((_, i) => {
        if (!isQuota(planner, i)) return;
        const plan = planner.plans[i]!;
        const sx = plan[HEAD.sx]!;
        const outside = sx < M.band.x[0] || sx > M.band.x[1];
        if (outside) restarts++;
        for (let s = 0; s < plan[HEAD.count]!; s++) {
          const o = HEAD.size + s * ACT.size;
          const x = plan[o + ACT.x1]!;
          const y = plan[o + ACT.y1]!;
          expect(x).toBeGreaterThanOrEqual(M.band.x[0] - 1e-9);
          expect(x).toBeLessThanOrEqual(M.band.x[1] + 1e-9);
          expect(y).toBeGreaterThanOrEqual(M.band.y[0] - 1e-9);
          expect(y).toBeLessThanOrEqual(M.band.y[1] + 1e-9);
        }
        // Along the way too, a carry may only bend a little past a limit.
        for (let k = 0; k <= 20 && !outside; k++) {
          const p = at(planner, i, k / 20);
          reach = Math.max(
            reach,
            M.band.x[0] - p[0],
            p[0] - M.band.x[1],
            M.band.y[0] - p[1],
            p[1] - M.band.y[1],
          );
        }
      });
    }
    expect(restarts).toBeGreaterThan(50);
    expect(reach).toBeLessThan(2);
  });

  it('never has the ball nearer than 10 m of a goal line in a minute with nothing shown', () => {
    for (const m of small) {
      const { steps, planner } = prepare(m);
      steps.forEach((step, i) => {
        if (step.timing !== 'minuteFull' || !isQuota(planner, i)) return;
        if (planner.plans[i]![HEAD.sx]! < 10 || planner.plans[i]![HEAD.sx]! > 95) return;
        for (let k = 0; k <= 10; k++) {
          const p = at(planner, i, k / 10);
          expect(p[0]).toBeGreaterThan(8);
          expect(p[0]).toBeLessThan(PITCH_SIZE.length - 8);
        }
      });
    }
  });
});

describe('the planner: the actions (13, planner 5 and 6)', () => {
  const trailKinds: number[] = [SEG.ground, SEG.carry, SEG.air, SEG.cross];

  it('in 1,000 matches: ground passes 60 to 70%, carries 17 to 25%, walls 3 to 8%, over the top 4 to 8%, crosses up to 3%', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(1000);
    const counts = { ground: 0, carry: 0, wall: 0, over: 0, cross: 0 };
    let crossesOutside = 0;
    for (const m of corpus) {
      const { steps, planner } = prepare(m);
      steps.forEach((_, i) => {
        const plan = planner.plans[i]!;
        const pattern = plan[HEAD.pattern]!;
        const owner = plan[HEAD.owner]!;
        for (let s = 0; s < plan[HEAD.count]!; s++) {
          const o = HEAD.size + s * ACT.size;
          const kind = plan[o + ACT.kind]!;
          // Every cross, also the one of the start of a play, comes from the open ball in the final third.
          if (kind === SEG.cross) {
            const dir = owner === 1 ? 1 : -1;
            const bx = plan[o + ACT.x0]!;
            const by = plan[o + ACT.y0]!;
            const open =
              dir * (bx - PITCH_SIZE.length / 2) > M.cross.from &&
              Math.abs(by - PITCH_SIZE.width / 2) > M.cross.wide;
            if (!open) crossesOutside++;
          }
        }
        if (pattern === 0) return;
        if (pattern === PATTERN.wall) {
          counts.wall++;
          return;
        }
        for (let s = 0; s < plan[HEAD.count]!; s++) {
          const kind = plan[HEAD.size + s * ACT.size + ACT.kind]!;
          if (kind === SEG.ground) counts.ground++;
          else if (kind === SEG.carry) counts.carry++;
          else if (kind === SEG.air) counts.over++;
          else if (kind === SEG.cross) counts.cross++;
        }
      });
    }
    const total = counts.ground + counts.carry + counts.wall + counts.over + counts.cross;
    const share = (n: number) => (100 * n) / total;
    expect(share(counts.ground)).toBeGreaterThanOrEqual(60);
    expect(share(counts.ground)).toBeLessThanOrEqual(70);
    expect(share(counts.carry)).toBeGreaterThanOrEqual(17);
    expect(share(counts.carry)).toBeLessThanOrEqual(25);
    expect(share(counts.wall)).toBeGreaterThanOrEqual(3);
    expect(share(counts.wall)).toBeLessThanOrEqual(8);
    expect(share(counts.over)).toBeGreaterThanOrEqual(4);
    expect(share(counts.over)).toBeLessThanOrEqual(8);
    expect(share(counts.cross)).toBeLessThanOrEqual(3);
    expect(crossesOutside).toBe(0);
  });

  it('never two passes over the top in a row, the start of a play included', () => {
    let overs = 0;
    for (const m of corpus.slice(0, 400)) {
      const { planner } = prepare(m);
      let last = false;
      planner.plans.forEach((plan) => {
        if (plan[HEAD.centre] === 1) last = false;
        for (let s = 0; s < plan[HEAD.count]!; s++) {
          const kind = plan[HEAD.size + s * ACT.size + ACT.kind]!;
          const over = kind === SEG.air || kind === SEG.cross;
          if (over) {
            overs++;
            expect(last).toBe(false);
          }
          // The shot zeroes the count; a loose ball and the fall do not touch it.
          if (kind === SEG.shot || kind === SEG.chip) last = false;
          else if (trailKinds.includes(kind)) last = over;
        }
      });
    }
    expect(overs).toBeGreaterThan(1000);
  });

  it('an air pass flies higher with the distance: min(11, 2.5 + 0.17 d), a cross from 4 to 6 m', () => {
    for (const m of small.slice(0, 40)) {
      const { planner } = prepare(m);
      for (const plan of planner.plans) {
        for (let s = 0; s < plan[HEAD.count]!; s++) {
          const o = HEAD.size + s * ACT.size;
          const kind = plan[o + ACT.kind]!;
          const h = plan[o + ACT.h]!;
          if (kind === SEG.air) {
            const d = Math.hypot(
              plan[o + ACT.x1]! - plan[o + ACT.x0]!,
              plan[o + ACT.y1]! - plan[o + ACT.y0]!,
            );
            expect(h).toBeCloseTo(Math.min(11, 2.5 + 0.17 * d), 9);
          } else if (kind === SEG.cross) {
            expect(h).toBeGreaterThanOrEqual(4);
            expect(h).toBeLessThanOrEqual(6);
          }
        }
      }
    }
  });
});

describe('the planner: nothing runs ahead of the outcome (13, planner 7)', () => {
  const POINTS = Array.from({ length: 11 }, (_, i) => i / 10);

  /** The goal at `index` as a chance of the same side, kind and player, or the chance as a goal. */
  function swapped(events: readonly MatchEvent[], index: number): MatchEvent[] | undefined {
    const event = events[index]!;
    const base = {
      minute: event.minute,
      ...(event.added === undefined ? {} : { added: event.added }),
      half: event.half,
    };
    let other: MatchEvent;
    if (event.type === 'goal' && event.kind !== 'penalty') {
      other = {
        ...base,
        importance: 2,
        type: 'chance',
        side: event.side,
        shooter: event.scorer,
        kind: event.kind,
        outcome: 'saved',
        pGoal: 0.3,
      };
    } else if (event.type === 'chance' && event.importance >= 2) {
      other = {
        ...base,
        importance: 3,
        type: 'goal',
        side: event.side,
        scorer: event.shooter,
        kind: event.kind,
        score: [0, 0],
      };
    } else return undefined;
    return events.map((e, i) => (i === index ? other : e));
  }

  /** What the screen draws in the 11 points of a step: ball, height, trails, wedge, discs, tag. */
  function frames(m: TestMatch, events: readonly MatchEvent[], index: number, fast: boolean) {
    const { steps, planner } = prepare(m, events);
    const choreo = choreograph(steps, lineupsOf(m), m.match.seed);
    const out = createScene();
    return POINTS.map((p) => {
      sceneAt(choreo, index, p, out, fast ? 'fast' : 'normal', planner);
      return JSON.stringify({
        ball: [out.ballX, out.ballY, out.ballZ],
        trails: [...out.trails.slice(0, out.trailCount * TRAIL.stride)],
        wedge: [out.wedgeOwner, out.wedgeAlpha],
        discs: [...out.x, ...out.y, ...out.alpha],
        tag: tagDiscOf(choreo, index),
        shown: [...out.alpha].map((_, d) => discShownIn(choreo, index, d)),
      });
    });
  }

  it('the start of every goal equals the start of the same chance, in 11 points, also right after a goal', () => {
    let tried = 0;
    let afterGoal = 0;
    for (const m of corpus.slice(0, 250)) {
      const events = m.result.events;
      events.forEach((event, index) => {
        if (event.type !== 'goal' && event.type !== 'chance') return;
        const other = swapped(events, index);
        if (other === undefined) return;
        const id = `e${index}`;
        const a = matchSteps(events, 'full');
        const b = matchSteps(other, 'full');
        const at = a.findIndex((s) => s.line?.id === id && s.line.stage === 'build');
        expect(at).toBeGreaterThan(0);
        expect(b.findIndex((s) => s.line?.id === id && s.line.stage === 'build')).toBe(at);
        tried++;
        if (a[at - 1]?.timing === 'afterGoal') afterGoal++;
        expect(frames(m, events, at, false), id).toEqual(frames(m, other, at, false));
        if (tried % 5 === 0)
          expect(frames(m, events, at, true), id).toEqual(frames(m, other, at, true));
      });
    }
    expect(tried).toBeGreaterThan(300);
    expect(afterGoal).toBeGreaterThan(5);
  });

  it('a penalty scored and the same penalty missed start the same', () => {
    let penalties = 0;
    for (const m of corpus) {
      const events = m.result.events;
      events.forEach((event, index) => {
        if (event.type !== 'penaltyAwarded') return;
        const next = events[index + 1];
        if (next === undefined || !('side' in next) || next.side !== event.side) return;
        const base = {
          minute: next.minute,
          ...(next.added === undefined ? {} : { added: next.added }),
          half: next.half,
        };
        let swap: MatchEvent;
        if (next.type === 'goal' && next.kind === 'penalty') {
          swap = {
            ...base,
            importance: 2,
            type: 'penaltyMissed',
            side: next.side,
            taker: next.scorer,
            outcome: 'saved',
          };
        } else if (next.type === 'penaltyMissed') {
          swap = {
            ...base,
            importance: 3,
            type: 'goal',
            side: next.side,
            scorer: next.taker,
            kind: 'penalty',
            score: [0, 0],
          };
        } else return;
        const other = events.map((e, i) => (i === index + 1 ? swap : e));
        const a = matchSteps(events, 'full');
        const at = a.findIndex((s) => s.line?.id === `e${index}` && s.line.stage === 'build');
        expect(at).toBeGreaterThan(0);
        penalties++;
        expect(frames(m, events, at, false)).toEqual(frames(m, other, at, false));
      });
    }
    expect(penalties).toBeGreaterThan(3);
  });

  it('only the step of the outcome reads it: the start ends at the point and the shot leaves from there', () => {
    for (const m of small.slice(0, 40)) {
      const { steps, planner } = prepare(m);
      steps.forEach((step, i) => {
        if (step.line?.stage !== 'build' || steps[i - 1]?.timing === 'afterGoal') return;
        const end = at(planner, i, 1);
        const next = at(planner, i + 1, 0);
        expect(Math.hypot(next[0] - end[0], next[1] - end[1])).toBeLessThan(0.001);
        // The ball is at the point of the play for the whole second half of the start.
        for (const a of [0.8, 0.9, 1]) {
          const p = at(planner, i, a);
          expect(Math.hypot(p[0] - end[0], p[1] - end[1])).toBeLessThan(1e-9);
        }
      });
    }
  });
});

describe('the planner: the ball and the finisher (anchor 4)', () => {
  it('at the end of the start of a play the ball is at the finisher; after a goal, after the 250 ms of the way to the point', () => {
    let starts = 0;
    let afterGoal = 0;
    for (const m of small.slice(0, 80)) {
      const { steps, trace } = prepare(m);
      const choreo = choreograph(steps, lineupsOf(m), m.match.seed);
      const planner = new BallPlanner(steps, trace, m.match.seed);
      planner.ensure(steps.length - 1);
      const out = createScene();
      steps.forEach((step, i) => {
        const disc = tagDiscOf(choreo, i);
        const play = step.line?.stage === 'build' || step.line?.source.type === 'penaltyAwarded';
        if (!play || disc < 0) return;
        const justScored = steps[i - 1]?.timing === 'afterGoal';
        if (!justScored) {
          sceneAt(choreo, i, 1, out, 'normal', planner);
          starts++;
          expect(
            Math.hypot(out.x[disc]! - out.ballX, out.y[disc]! - out.ballY),
          ).toBeLessThanOrEqual(0.1);
        } else if (steps[i + 1] !== undefined) {
          // The ball goes back to the centre; the disc waits at its spot; the outcome brings both.
          sceneAt(choreo, i, 1, out, 'normal', planner);
          expect([out.ballX, out.ballY]).toEqual([PITCH_SIZE.length / 2, PITCH_SIZE.width / 2]);
          const d = MATCH_TIMING.normal[steps[i + 1]!.timing!] / 1000;
          sceneAt(choreo, i + 1, 0.25 / d, out, 'normal', planner);
          afterGoal++;
          expect(
            Math.hypot(out.x[disc]! - out.ballX, out.y[disc]! - out.ballY),
          ).toBeLessThanOrEqual(0.1);
        }
      });
    }
    expect(starts).toBeGreaterThan(200);
    expect(afterGoal).toBeGreaterThan(0);
  });
});

describe('the wedge and the reduced frame (8, 11)', () => {
  it('shows in every step with an owner but not in an outcome, a weak chance or the way back to the centre', () => {
    let wedges = 0;
    let none = 0;
    for (const m of small.slice(0, 40)) {
      const { steps, trace, planner } = prepare(m);
      const choreo = choreograph(steps, lineupsOf(m), m.match.seed);
      const out = createScene();
      steps.forEach((step, i) => {
        if (step.timing === undefined) return;
        sceneAt(choreo, i, 0.5, out, 'normal', planner);
        const type = step.line?.source.type;
        const justScored = steps[i - 1]?.timing === 'afterGoal';
        const outcome = step.timing === 'afterGoal' || step.timing === 'afterMiss';
        const weak = type === 'chance' && step.timing === 'event';
        const phase = type === 'kickoff' || type === 'halftime' || type === 'secondHalf';
        if (justScored || outcome || weak || phase) {
          expect(out.wedgeOwner, `step ${i}`).toBe(0);
          none++;
        } else if (out.wedgeOwner !== 0) {
          // Whoever has the ball attacks: the owner of the step, unless the ball is at the goal.
          expect(out.wedgeOwner).toBe(trace.owners[i]);
          wedges++;
        }
      });
    }
    expect(wedges).toBeGreaterThan(1000);
    expect(none).toBeGreaterThan(100);
  });

  it('a new owner comes in over 200 ms; the same owner as the step before is whole at once', () => {
    let changed = 0;
    let kept = 0;
    for (const m of small.slice(0, 40)) {
      const { steps, trace, planner } = prepare(m);
      const choreo = choreograph(steps, lineupsOf(m), m.match.seed);
      const out = createScene();
      steps.forEach((step, i) => {
        if (step.timing !== 'minuteFull' || i === 0) return;
        sceneAt(choreo, i, 0, out, 'normal', planner);
        if (out.wedgeOwner === 0) return;
        const before = planner.plans[i - 1]!;
        if (before[HEAD.wedge] === 1 && before[HEAD.owner] === trace.owners[i]) {
          kept++;
          expect(out.wedgeAlpha).toBe(1);
        } else {
          changed++;
          expect(out.wedgeAlpha).toBe(0);
          sceneAt(choreo, i, 0.1 / 0.8, out, 'normal', planner);
          expect(out.wedgeAlpha).toBeCloseTo(0.5, 9);
          sceneAt(choreo, i, 1, out, 'normal', planner);
          expect(out.wedgeAlpha).toBe(1);
        }
      });
    }
    expect(changed).toBeGreaterThan(20);
    expect(kept).toBeGreaterThan(200);
  });

  it('is not drawn with the ball under 3 m from the goal it attacks', () => {
    for (const m of small.slice(0, 40)) {
      const { steps, planner } = prepare(m);
      const choreo = choreograph(steps, lineupsOf(m), m.match.seed);
      const out = createScene();
      steps.forEach((_, i) => {
        for (const p of [0, 0.5, 1]) {
          sceneAt(choreo, i, p, out, 'normal', planner);
          if (out.wedgeOwner === 0) continue;
          const goal = out.wedgeOwner === 1 ? PITCH_SIZE.length : 0;
          expect(Math.abs(out.ballX - goal)).toBeGreaterThanOrEqual(M.wedge.near);
        }
      });
    }
  });

  it('with reduced motion the frame is the end of the step: the ball on the ground, its trails whole, its wedge', () => {
    let trails = 0;
    for (const m of small.slice(0, 30)) {
      const { steps, planner } = prepare(m);
      const choreo = choreograph(steps, lineupsOf(m), m.match.seed);
      const out = createScene();
      steps.forEach((_, i) => {
        stillScene(choreo, i, out, planner);
        const end = at(planner, i, 1);
        expect([out.ballX, out.ballY, out.ballZ]).toEqual([end[0], end[1], 0]);
        expect(out.wedgeAlpha === 1 || out.wedgeOwner === 0).toBe(true);
        // Whole and still: the actions of this step only, with no time taken off them.
        const plan = planner.plans[i]!;
        let made = 0;
        for (let s = 0; s < plan[HEAD.count]!; s++) {
          if (
            plan[HEAD.size + s * ACT.size + ACT.kind]! !== SEG.loose &&
            plan[HEAD.size + s * ACT.size + ACT.kind]! !== SEG.fall
          )
            made++;
        }
        expect(out.trailCount).toBe(made);
        for (let k = 0; k < out.trailCount; k++) {
          expect(out.trails[k * TRAIL.stride + TRAIL.s]).toBe(1);
          expect(out.trails[k * TRAIL.stride + TRAIL.alpha]).toBe(M.trail.weights[k]);
        }
        trails += out.trailCount;
      });
    }
    expect(trails).toBeGreaterThan(500);
  });

  it('the chain starts again at the way back to the centre and fades with the age of the actions', () => {
    for (const m of small.slice(0, 40)) {
      const { steps, planner } = prepare(m);
      const ring = new Float64Array(TRAIL.count * TRAIL.stride);
      steps.forEach((step, i) => {
        if (steps[i - 1]?.timing === 'afterGoal' && step.timing !== undefined) {
          // The step of the centre has no trail of its own and the chain does not reach before it.
          expect(fillTrails(planner, i, 1, false, ring)).toBe(0);
        }
        if (step.timing === undefined) return;
        const n = fillTrails(planner, i, 1, false, ring);
        let last = Infinity;
        for (let k = 0; k < n; k++) {
          const alpha = ring[k * TRAIL.stride + TRAIL.alpha]!;
          // Newest first, weights 1, 0.6, 0.38, 0.22, each less than the one before (older).
          expect(alpha / M.trail.weights[k]!).toBeLessThanOrEqual(1);
          expect(alpha).toBeLessThanOrEqual(last + 1e-9);
          last = Math.max(alpha, 0);
        }
      });
    }
  });
});

describe('the planner: no allocation (13, planner 8)', () => {
  it('sceneAt and stillScene write into the same scene and the same ring of four trails', () => {
    const m = small[3]!;
    const { steps, trace } = prepare(m);
    const choreo = choreograph(steps, lineupsOf(m), m.match.seed);
    const planner = new BallPlanner(steps, trace, m.match.seed);
    const out = createScene();
    const { trails } = out;
    expect(trails.length).toBe(TRAIL.count * TRAIL.stride);
    expect(TRAIL.count).toBe(4);
    for (let i = 0; i < steps.length; i++) {
      for (const p of [0, 0.3, 0.7, 1]) {
        expect(sceneAt(choreo, i, p, out, 'normal', planner)).toBe(out);
        expect(out.trailCount).toBeLessThanOrEqual(4);
      }
      expect(stillScene(choreo, i, out, planner)).toBe(out);
    }
    expect(out.trails).toBe(trails);
    // The plan of a step is a fixed-size array.
    expect(new Set(planner.plans.map((plan) => plan.length)).size).toBe(1);
  });

  it('the trails fade: the action in course whole, the ones before at 0.6, 0.38 and 0.22 less their age', () => {
    const m = small[0]!;
    const { steps, planner } = prepare(m);
    const ring = new Float64Array(TRAIL.count * TRAIL.stride);
    let seen = 0;
    steps.forEach((step, i) => {
      if (!isQuota(planner, i) || step.timing !== 'minuteFull') return;
      const n = fillTrails(planner, i, 1, false, ring);
      for (let k = 0; k < n; k++) {
        const alpha = ring[k * TRAIL.stride + TRAIL.alpha]!;
        expect(alpha).toBeLessThanOrEqual(M.trail.weights[k]! + 1e-9);
        expect(alpha).toBeGreaterThanOrEqual(0);
        seen++;
      }
      // Reduced motion: the whole step, no time passing.
      const still = fillTrails(planner, i, 0, true, ring);
      expect(still).toBe(planner.plans[i]![HEAD.count]! > 0 ? still : 0);
      for (let k = 0; k < still; k++)
        expect(ring[k * TRAIL.stride + TRAIL.alpha]).toBe(M.trail.weights[k]);
    });
    expect(seen).toBeGreaterThan(50);
  });
});

export type { Side };
