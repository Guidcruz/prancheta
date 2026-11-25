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
  heightAt,
  slowMotion,
  type PlanTrace,
} from './plan';
import { possessionTrace } from './possession';
import { choreograph, createScene, discShownIn, sceneAt, stillScene, tagDiscOf } from './scene';
import { ballPlace, pitchGeometry, shadowShift } from './geometry';

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
    // The 0.25 m of slack is the cubic of a carry, which may bend a hair past a limit between its
    // two ends (both inside); the ends themselves are held to the band to 1e-9 above.
    expect(reach).toBeLessThan(0.25);
  });

  it('never has the ball nearer than 10 m of a goal line in a minute with nothing shown', () => {
    for (const m of small) {
      const { steps, planner } = prepare(m);
      steps.forEach((step, i) => {
        if (step.timing !== 'minuteFull' || !isQuota(planner, i)) return;
        if (planner.plans[i]![HEAD.sx]! < 10 || planner.plans[i]![HEAD.sx]! > 95) return;
        for (let k = 0; k <= 10; k++) {
          const p = at(planner, i, k / 10);
          expect(p[0]).toBeGreaterThan(10);
          expect(p[0]).toBeLessThan(PITCH_SIZE.length - 10);
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

describe('the open V of the wall pass and the landing of a shot over the bar (13, planner 9 and 10)', () => {
  it('the V opens 20 degrees or more in 95% of the wall passes and never under 10; the first pass goes 6 m to the side or more', () => {
    const angles: number[] = [];
    for (const m of corpus) {
      const { planner } = prepare(m);
      for (const plan of planner.plans) {
        if (plan[HEAD.pattern] !== PATTERN.wall) continue;
        // The two last actions (a dispute, loose, may come before them).
        const n = plan[HEAD.count]!;
        const a = HEAD.size + (n - 2) * ACT.size;
        const b = HEAD.size + (n - 1) * ACT.size;
        const [x0, y0] = [plan[a + ACT.x0]!, plan[a + ACT.y0]!];
        const [tx, ty] = [plan[a + ACT.x1]!, plan[a + ACT.y1]!];
        const [x2, y2] = [plan[b + ACT.x1]!, plan[b + ACT.y1]!];
        expect(Math.abs(ty - y0)).toBeGreaterThanOrEqual(6 - 1e-9);
        // The angle at the point where the ball turns, between the way back to the start and the return.
        const back = Math.atan2(y0 - ty, x0 - tx);
        const out = Math.atan2(y2 - ty, x2 - tx);
        let d = Math.abs(back - out);
        if (d > Math.PI) d = 2 * Math.PI - d;
        angles.push((d * 180) / Math.PI);
      }
    }
    expect(angles.length).toBeGreaterThan(3000);
    const open = angles.filter((d) => d >= 20).length / angles.length;
    expect(open).toBeGreaterThanOrEqual(0.95);
    expect(Math.min(...angles)).toBeGreaterThanOrEqual(10);
  });

  it('no wide shot looks like a goal: it ends on the ground 5 m from the middle or more; over the bar it crosses the line between the posts, 3.2 m up, on the side it lands', () => {
    let wide = 0;
    let over = 0;
    for (const m of corpus) {
      const { steps, planner } = prepare(m);
      steps.forEach((step, i) => {
        const type = step.line?.source.type;
        const isOutcome =
          step.timing === 'afterMiss' || (type === 'chance' && step.timing === 'event');
        if (!isOutcome || steps[i - 1]?.timing === 'afterGoal' || type === 'penaltyAwarded') return;
        const plan = planner.plans[i]!;
        if (plan[HEAD.count] === 0) return;
        const end = at(planner, i, 1);
        const event = step.line!.source as Extract<MatchEvent, { side: Side }>;
        const goal = event.side === 'home' ? PITCH_SIZE.length : 0;
        const behind = (end[0] - goal) * (event.side === 'home' ? 1 : -1) > 0;
        // Nothing but a goal ends in the net.
        if (behind) expect(Math.abs(end[1] - PITCH_SIZE.width / 2)).toBeGreaterThan(3.66);
        if ('outcome' in event && event.outcome === 'wide') {
          wide++;
          expect(end[2]).toBe(0);
          expect(Math.abs(end[1] - PITCH_SIZE.width / 2)).toBeGreaterThanOrEqual(5);
        }
        for (let s = 0; s < plan[HEAD.count]!; s++) {
          const o = HEAD.size + s * ACT.size;
          if (plan[o + ACT.kind] !== SEG.chip || plan[o + ACT.zmode] !== 2) continue;
          over++;
          const y = plan[o + ACT.y1]!;
          expect(plan[o + ACT.x1]).toBe(goal);
          expect(plan[o + ACT.h]).toBe(3.2);
          expect(Math.abs(y - PITCH_SIZE.width / 2)).toBeLessThanOrEqual(3.26 + 1e-9);
          expect(
            Math.sign(y - PITCH_SIZE.width / 2) * Math.sign(end[1] - PITCH_SIZE.width / 2),
          ).toBeGreaterThanOrEqual(0);
        }
      });
    }
    expect(wide).toBeGreaterThan(500);
    expect(over).toBeGreaterThan(100);
  });
});

describe('the sent-off disc, the keeper and the shadow follow the drawn ball', () => {
  it('the sent-off appears 3 m from the ball of the planner at the start of the red card step', () => {
    let reds = 0;
    for (const m of corpus.slice(0, 600)) {
      const { steps, trace } = prepare(m);
      if (!steps.some((s) => s.line?.source.type === 'red')) continue;
      const choreo = choreograph(steps, lineupsOf(m), m.match.seed);
      const planner = new BallPlanner(steps, trace, m.match.seed);
      const out = createScene();
      steps.forEach((step, i) => {
        if (step.line?.source.type !== 'red' || step.line.stage !== 'final') return;
        const disc = tagDiscOf(choreo, i);
        // Right after a goal he comes in at his spot (tested below).
        if (disc < 0 || steps[i - 1]?.timing === 'afterGoal') return;
        reds++;
        sceneAt(choreo, i, 0, out, 'normal', planner);
        const sy = planner.plans[i]![HEAD.sy]!;
        const room = Math.abs(out.y[disc]! - sy);
        // 3 m from the ball (a ball 3 m from a touchline holds him at the line).
        const sx = planner.plans[i]![HEAD.sx]!;
        // (A restart starts the ball behind the goal line, where the disc is held at the line.)
        if (sx >= 0 && sx <= PITCH_SIZE.length) {
          expect(
            Math.hypot(out.x[disc]! - out.ballX, out.y[disc]! - out.ballY),
          ).toBeLessThanOrEqual(3 + 1e-9);
        }
        if (sy > 3 && sy < PITCH_SIZE.width - 3) expect(room).toBeCloseTo(3, 9);
        // And he walks on to the touchline at the end of the step.
        sceneAt(choreo, i, 1, out, 'normal', planner);
        expect([0, PITCH_SIZE.width]).toContain(out.y[disc]);
      });
    }
    expect(reds).toBeGreaterThan(20);
  });

  it('the keeper stands on the axis of his goal: out 2 + 0.12 × the distance of the ball (2 to 14 m), across within 6 m, never behind the line', () => {
    let checked = 0;
    for (const m of small.slice(0, 30)) {
      const { steps, trace } = prepare(m);
      const choreo = choreograph(steps, lineupsOf(m), m.match.seed);
      const planner = new BallPlanner(steps, trace, m.match.seed);
      const out = createScene();
      steps.forEach((step, i) => {
        if (step.line?.stage !== 'build' || steps[i - 1]?.timing === 'afterGoal') return;
        const event = step.line.source as Extract<MatchEvent, { side: Side }>;
        // A penalty puts the keeper on his line.
        if (event.type === 'penaltyAwarded') return;
        // The keeper who defends: the other side's, the first disc of it.
        const keeper = event.side === 'home' ? 11 : 0;
        if (!discShownIn(choreo, i, keeper)) return;
        sceneAt(choreo, i, 1, out, 'normal', planner);
        const line = keeper === 0 ? 0 : PITCH_SIZE.length;
        const depth = Math.abs(out.x[keeper]! - line);
        const distance = Math.abs(out.ballX - line);
        expect(depth).toBeCloseTo(Math.min(14, 2 + 0.12 * distance), 6);
        expect(depth).toBeGreaterThanOrEqual(2);
        expect(Math.abs(out.y[keeper]! - 34)).toBeLessThanOrEqual(6 + 1e-9);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(40);
  });

  it('the shadow keeps the ball off it at every real arc, near the far touchline included', () => {
    for (const [w, h] of [
      [360, 240],
      [397, 265],
      [600, 400],
      [297, 198],
    ] as const) {
      const g = pitchGeometry(w * 2, h * 2, 2);
      const place = new Float64Array(7);
      for (const m of small.slice(0, 40)) {
        const { planner } = prepare(m);
        for (const plan of planner.plans) {
          for (let s = 0; s < plan[HEAD.count]!; s++) {
            const o = HEAD.size + s * ACT.size;
            const mode = plan[o + ACT.zmode]!;
            if (mode === 0) continue;
            for (let k = 0; k <= 20; k++) {
              const u = k / 20;
              const z = heightAt(mode, plan[o + ACT.h]!, u);
              if (z <= M.shadowMin) continue;
              ballPlace(
                g,
                plan[o + ACT.x0]! + (plan[o + ACT.x1]! - plan[o + ACT.x0]!) * u,
                plan[o + ACT.y0]! + (plan[o + ACT.y1]! - plan[o + ACT.y0]!) * u,
                z,
                place,
              );
              const shift = shadowShift(g, place[4]!, place[5]!, place[6]!);
              const apart = place[1]! + shift - place[3]!;
              expect(apart).toBeGreaterThanOrEqual(place[4]! + 0.5 * place[5]! + 2 - 1e-9);
            }
          }
        }
      }
    }
  });
});

describe('the planner: nothing runs ahead of the outcome (13, planner 7)', () => {
  const POINTS = Array.from({ length: 11 }, (_, i) => i / 10);

  /** The goal at `index` as a chance of the same side, kind and player, or the chance as a goal. */
  function swapped(
    events: readonly MatchEvent[],
    index: number,
    outcome: 'saved' | 'post' | 'wide' = 'saved',
  ): MatchEvent[] | undefined {
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
        outcome,
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
    const snap = () =>
      JSON.stringify({
        ball: [out.ballX, out.ballY, out.ballZ],
        // The trails carry the ring of the landing: its centre is the end of the entry.
        trails: [...out.trails.slice(0, out.trailCount * TRAIL.stride)],
        wedge: [out.wedgeOwner, out.wedgeAlpha],
        discs: [...out.x, ...out.y, ...out.alpha],
        tag: tagDiscOf(choreo, index),
        shown: [...out.alpha].map((_, d) => discShownIn(choreo, index, d)),
      });
    const points = POINTS.map((p) => {
      sceneAt(choreo, index, p, out, fast ? 'fast' : 'normal', planner);
      return snap();
    });
    // The one frame of reduced motion too.
    stillScene(choreo, index, out, planner);
    return [...points, snap()];
  }

  it('the start of every goal equals the start of the same chance, in 11 points, also right after a goal', () => {
    let tried = 0;
    let afterGoal = 0;
    for (const m of corpus.slice(0, 250)) {
      const events = m.result.events;
      events.forEach((event, index) => {
        if (event.type !== 'goal' && event.type !== 'chance') return;
        // A goal against a chance that is saved, hits the post or goes wide: the same start.
        for (const outcome of ['saved', 'post', 'wide'] as const) {
          const other = swapped(events, index, outcome);
          if (other === undefined || (event.type === 'chance' && outcome !== 'saved')) continue;
          const id = `e${index}`;
          const a = matchSteps(events, 'full');
          const b = matchSteps(other, 'full');
          const at = a.findIndex((s) => s.line?.id === id && s.line.stage === 'build');
          expect(at).toBeGreaterThan(0);
          expect(b.findIndex((s) => s.line?.id === id && s.line.stage === 'build')).toBe(at);
          tried++;
          if (a[at - 1]?.timing === 'afterGoal') afterGoal++;
          expect(frames(m, events, at, false), `${id} ${outcome}`).toEqual(
            frames(m, other, at, false),
          );
          if (tried % 5 === 0)
            expect(frames(m, events, at, true), id).toEqual(frames(m, other, at, true));
        }
      });
    }
    expect(tried).toBeGreaterThan(300);
    expect(afterGoal).toBeGreaterThan(5);
  }, 60_000);

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
        let w = 0;
        for (let k = 0; k < out.trailCount; k++) {
          expect(out.trails[k * TRAIL.stride + TRAIL.s]).toBe(1);
          expect(out.trails[k * TRAIL.stride + TRAIL.alpha]).toBe(M.trail.weights[w]);
          // The way back from a post shares the weight of its shot.
          if (out.trails[k * TRAIL.stride + TRAIL.kind] !== SEG.back) w++;
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
          expect(alpha).toBeLessThanOrEqual(last + 1e-9);
          last = Math.max(alpha, 0);
        }
      });
    }
  });
});

describe('the ring of the landing, from the plan (13, planner 11)', () => {
  it('in 1,000 matches every pass over the top lands on the end of its trail, to 1 mm, on the ground; a shot or a chip is never counted as one', () => {
    const ring = new Float64Array(TRAIL.count * TRAIL.stride);
    let passes = 0;
    let crosses = 0;
    let shots = 0;
    for (const m of corpus) {
      const { steps, planner } = prepare(m);
      for (let i = 0; i < steps.length; i++) {
        const plan = planner.plans[i]!;
        const n = fillTrails(planner, i, 0, true, ring);
        const entries: { kind: number; x1: number; y1: number }[] = [];
        for (let k = 0; k < n; k++) {
          const e = k * TRAIL.stride;
          entries.push({
            kind: ring[e + TRAIL.kind]!,
            x1: ring[e + TRAIL.x1]!,
            y1: ring[e + TRAIL.y1]!,
          });
        }
        for (let s = 0; s < plan[HEAD.count]!; s++) {
          const o = HEAD.size + s * ACT.size;
          const kind = plan[o + ACT.kind]!;
          if (kind === SEG.shot || kind === SEG.chip) shots++;
          if (kind !== SEG.air && kind !== SEG.cross) continue;
          passes++;
          if (kind === SEG.cross) crosses++;
          // The ball is at the target, on the ground, when the pass ends...
          ballAt(plan, plan[o + ACT.t1]!, ball);
          expect(ball[0]!, `${m.match.seed} step ${i}: x`).toBeCloseTo(plan[o + ACT.x1]!, 3);
          expect(ball[1]!, `${m.match.seed} step ${i}: y`).toBeCloseTo(plan[o + ACT.y1]!, 3);
          expect(ball[2]!, `${m.match.seed} step ${i}: z`).toBeLessThan(0.01);
          // ...and the trail the screen draws the ring for ends at the same point.
          expect(
            entries.some(
              (e) =>
                e.kind === kind &&
                Math.abs(e.x1 - plan[o + ACT.x1]!) < 0.001 &&
                Math.abs(e.y1 - plan[o + ACT.y1]!) < 0.001,
            ),
            `${m.match.seed} step ${i}: the trail of the pass`,
          ).toBe(true);
        }
      }
    }
    expect(passes).toBeGreaterThan(1000);
    expect(crosses).toBeGreaterThan(30);
    expect(shots).toBeGreaterThan(1000);
  }, 120_000);
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
      // The expected alphas, worked out by hand: newest first, weight × (1 − age ÷ 3.2 s), the age
      // from the end of each action to the end of this step.
      const now = planner.start[i]! + planner.length[i]!;
      const expected: number[] = [];
      let w = 0;
      for (let j = i; j >= 0 && expected.length < TRAIL.count; j--) {
        const plan = planner.plans[j]!;
        for (let s = plan[HEAD.count]! - 1; s >= 0; s--) {
          const o = HEAD.size + s * ACT.size;
          const kind = plan[o + ACT.kind]!;
          if (kind === SEG.loose || kind === SEG.fall) continue;
          const age = now - (planner.start[j]! + plan[o + ACT.t1]! * planner.length[j]!);
          expected.push(M.trail.weights[w]! * Math.max(0, 1 - age / M.trail.life));
          if (kind !== SEG.back) w++;
        }
        if (plan[HEAD.centre] === 1) break;
      }
      expect(n).toBeGreaterThan(0);
      for (let k = 0; k < n; k++) {
        expect(ring[k * TRAIL.stride + TRAIL.alpha]).toBeCloseTo(expected[k]!, 9);
        seen++;
      }
      // Reduced motion: the whole step, no time passing.
      // The reduced frame holds the actions of this step only, each with its full weight.
      const plan = planner.plans[i]!;
      let made = 0;
      for (let s = 0; s < plan[HEAD.count]!; s++) {
        const kind = plan[HEAD.size + s * ACT.size + ACT.kind]!;
        if (kind !== SEG.loose && kind !== SEG.fall) made++;
      }
      expect(fillTrails(planner, i, 0, true, ring)).toBe(Math.min(made, TRAIL.count));
      if (made > 0) expect(ring[TRAIL.alpha]).toBe(M.trail.weights[0]);
    });
    expect(seen).toBeGreaterThan(50);
  });
});

export type { Side };

describe('the sent-off disc stays on the pitch (5)', () => {
  it('never behind a goal line, ends on the touchline, and right after a goal comes in at his spot', () => {
    let reds = 0;
    let afterGoal = 0;
    let restart = 0;
    for (const m of corpus) {
      const { steps, trace } = prepare(m);
      if (!steps.some((s) => s.line?.source.type === 'red')) continue;
      const choreo = choreograph(steps, lineupsOf(m), m.match.seed);
      const planner = new BallPlanner(steps, trace, m.match.seed);
      const out = createScene();
      const still = createScene();
      steps.forEach((step, i) => {
        if (step.line?.source.type !== 'red' || step.line.stage !== 'final') return;
        const disc = tagDiscOf(choreo, i);
        if (disc < 0) return;
        reds++;
        const just = steps[i - 1]?.timing === 'afterGoal';
        if (just) afterGoal++;
        planner.ensure(i);
        if (planner.plans[i]![HEAD.sx]! > 95 || planner.plans[i]![HEAD.sx]! < 10) restart++;
        for (const p of [0, 0.25, 0.5, 0.75, 1]) {
          sceneAt(choreo, i, p, out, 'normal', planner);
          expect(out.x[disc]!, `x at ${p}`).toBeGreaterThanOrEqual(0);
          expect(out.x[disc]!).toBeLessThanOrEqual(PITCH_SIZE.length);
          expect(out.y[disc]!).toBeGreaterThanOrEqual(0);
          expect(out.y[disc]!).toBeLessThanOrEqual(PITCH_SIZE.width);
        }
        // The end of the step, moving and in the reduced frame: on the touchline, not past it.
        stillScene(choreo, i, still, planner);
        sceneAt(choreo, i, 1, out, 'normal', planner);
        for (const y of [out.y[disc]!, still.y[disc]!]) {
          expect([0, PITCH_SIZE.width]).toContain(y);
        }
        if (just) {
          // Standing at his spot of the formation from the first frame.
          sceneAt(choreo, i, 0, out, 'normal', planner);
          const spot = choreo.steps[i]!;
          expect(spot.from[disc * 2]).toBe(out.x[disc]);
          expect(spot.from[disc * 2 + 1]).toBe(out.y[disc]);
        }
      });
    }
    expect(reds).toBeGreaterThan(100);
    expect(afterGoal).toBeGreaterThan(3);
    expect(restart).toBeGreaterThan(5);
  });
});
