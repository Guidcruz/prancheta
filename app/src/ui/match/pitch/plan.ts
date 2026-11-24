import { Rng, seedFromString, type MatchEvent, type Side } from '@engine';
import type { MatchStep } from '../steps';
import { MATCH_TIMING } from '../timing';
import { PITCH_MOTION as M, PITCH_SIZE } from './motion';

/*
 * The planner of the ball (docs/design/telas/partida-campo-v2.md, 6 and 7; docs/design/campo-lances.md,
 * 10, item 5). No DOM, no clock, no `Math.random`: every draw is a `Rng` of the match's seed with a
 * label of its own, `${seed}-pitch-${label}`, as `possession.ts` does.
 *
 * The ball never stops: a minute with nothing shown is one or two actions of the club that has the
 * ball (a carry, a ground pass, a wall pass, a pass back, a pass over the top, a cross), chained so each
 * starts where the last ended; a play is the pass of its start, the shot and what comes after.
 *
 * Step by step: the plan of step `i + 1` is made when step `i` is revealed (`ensure`), from where
 * the ball ended in step `i`, who has it (`possession.ts`: `owners` and `after`), the step itself
 * and the seed. It reads neither the score nor the strength of the clubs, nor a step ahead; only the
 * step that reveals an outcome (`-outcome`) reads it. So making the plans one by one or all at once
 * gives the same numbers.
 *
 * The plan of a step is one `Float64Array` of fixed size (a header and up to three actions of
 * `STRIDE` numbers), written once; the scene of a frame only evaluates it.
 */

export const CENTRE_X = PITCH_SIZE.length / 2;
export const CENTRE_Y = PITCH_SIZE.width / 2;

/** The share of the advance at the end of the first half of the time, with slow motion. */
const SLOW_SPEED = 1 / (0.5 + M.slow * 0.5);
/**
 * Slow motion (partida.md, "Câmera lenta"): time `t` (0 to 1) of a dramatic pause becomes the
 * advance of the motion, at speed `v = 1 / 0.7` in the first half of the time and `0.4 v` in the
 * second: the last 600 ms of the 1.2 s in Normal, the last 250 ms of the 0.5 s in Rápido.
 */
export function slowMotion(t: number): number {
  return t <= 0.5 ? t * SLOW_SPEED : (0.5 + M.slow * (t - 0.5)) * SLOW_SPEED;
}
/** The advance at the end of the first half of the time of a dramatic pause. */
export const SLOW_SPLIT = slowMotion(0.5);

export const goalLine = (side: Side): number => (side === 'home' ? PITCH_SIZE.length : 0);
export const attack = (side: Side): number => (side === 'home' ? 1 : -1);
const within = (rng: Rng, [low, high]: readonly [number, number]) =>
  low + (high - low) * rng.next();

type Played = MatchEvent & { side: Side };

const isFreeKick = (e: MatchEvent): boolean =>
  (e.type === 'chance' || e.type === 'goal') && e.kind === 'freeKick';
const isPenalty = (e: MatchEvent): boolean =>
  e.type === 'penaltyAwarded' ||
  e.type === 'penaltyMissed' ||
  (e.type === 'goal' && e.kind === 'penalty');

/**
 * The point of a play (`rng` is the `-build` of its line): the spot of a penalty, otherwise a point
 * from the goal it attacks, and across. Reads only the side and the kind of the play.
 */
export function playPoint(event: Played, rng: Rng): readonly [number, number] {
  const dir = attack(event.side);
  const goal = goalLine(event.side);
  if (isPenalty(event)) return [goal - dir * M.penalty.spot, CENTRE_Y];
  const range = isFreeKick(event) ? M.freeKick : M.open;
  const px = goal - dir * within(rng, range.distance);
  const py = within(rng, range.y);
  return [px, py];
}

export type Outcome = 'goal' | 'saved' | 'post' | 'wide';

/** How a play ends, read only in the step that reveals it. */
export function outcomeOf(event: MatchEvent): Outcome | undefined {
  if (event.type === 'goal') return 'goal';
  if (event.type === 'chance' || event.type === 'penaltyMissed') return event.outcome;
  return undefined;
}

/** Where an outcome leaves the ball: the end of the flight and where it rests, in metres. */
export function outcomeTarget(
  side: Side,
  outcome: Outcome,
  rng: Rng,
): { fx: number; fy: number; rx: number; ry: number } {
  const line = goalLine(side);
  const dir = attack(side);
  if (outcome === 'goal') {
    const y = within(rng, M.goal.y);
    const x = line + dir * M.goal.depth;
    return { fx: x, fy: y, rx: x, ry: y };
  }
  if (outcome === 'saved') {
    const y = within(rng, M.save.y);
    const x = line - dir * M.save.off;
    return { fx: x, fy: y, rx: x, ry: y };
  }
  if (outcome === 'post') {
    const y = CENTRE_Y + (rng.next() < 0.5 ? -1 : 1) * M.post.halfGoal;
    return { fx: line, fy: y, rx: line - dir * M.post.bounce, ry: y };
  }
  const below = rng.next() < 0.5;
  const off = M.wide.spread * rng.next();
  const y = below ? M.wide.inside[1] + off : M.wide.inside[0] - off;
  const x = line + dir * M.wide.out;
  return { fx: x, fy: y, rx: x, ry: y };
}

/** The point of a weak chance, from the goal it attacks (the first draws of its `-outcome`). */
export function weakPoint(side: Side, rng: Rng): readonly [number, number] {
  const px = goalLine(side) - attack(side) * within(rng, M.weak.distance);
  const py = within(rng, M.weak.y);
  return [px, py];
}

// ----------------------------------------------------------------------- the plan of a step

/** The kinds of action (a `cross` is an `air` that lands in the box). `loose` and `fall` leave no trail. */
export const SEG = {
  loose: 0,
  ground: 1,
  carry: 2,
  air: 3,
  shot: 4,
  chip: 5,
  fall: 6,
  cross: 7,
} as const;
/** How the height goes with the progress `u` of an action: none, an arch, a rise, a fall. */
export const Z = { flat: 0, arch: 1, rise: 2, fall: 3 } as const;

/** The fields of the header of a plan, and of each action. */
export const HEAD = {
  count: 0,
  centre: 1,
  wedge: 2,
  owner: 3,
  sx: 4,
  sy: 5,
  /** Which pattern of the quota the step is (`PATTERN`), 0 for any other step. */
  pattern: 6,
  size: 7,
} as const;
/** The patterns of the steps of the quota, in the order of the weights of `PITCH_MOTION.actions`. */
export const PATTERN = {
  none: 0,
  carryPass: 1,
  passCarry: 2,
  pass: 3,
  twoPasses: 4,
  back: 5,
  wall: 6,
  over: 7,
  cross: 8,
} as const;
export const ACT = {
  kind: 0,
  t0: 1,
  t1: 2,
  x0: 3,
  y0: 4,
  x1: 5,
  y1: 6,
  h: 7,
  zmode: 8,
  vx0: 9,
  vy0: 10,
  vx1: 11,
  vy1: 12,
  size: 13,
} as const;
const MAX_ACTIONS = 3;
const PLAN_SIZE = HEAD.size + ACT.size * MAX_ACTIONS;
const offset = (s: number) => HEAD.size + s * ACT.size;

/** An action leaves a trail unless it is a loose ball or the fall of a ball after a chip. */
export const hasTrail = (kind: number): boolean => kind !== SEG.loose && kind !== SEG.fall;

/** The share of an action's path covered at progress `u` (a ground pass slows down). */
export const extent = (kind: number, u: number): number =>
  kind === SEG.ground ? 1 - (1 - u) * (1 - u) : u;

/** The height at progress `u` of an action of height `h`. */
export function heightAt(mode: number, h: number, u: number): number {
  if (mode === Z.arch) return h * 4 * u * (1 - u);
  if (mode === Z.rise) return h * (1 - (1 - u) * (1 - u));
  if (mode === Z.fall) return h * (1 - u) * (1 - u);
  return 0;
}

/** The point of the Hermite curve of a carry at `u` (the velocities are metres per unit of `u`). */
export function hermite(p0: number, v0: number, p1: number, v1: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * v0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * v1
  );
}

/** The ground point of the action at offset `o` of `plan` at progress `u`, into `out[0..1]`. */
export function actionAt(plan: Float64Array, o: number, u: number, out: Float64Array): void {
  const kind = plan[o + ACT.kind]!;
  const x0 = plan[o + ACT.x0]!;
  const y0 = plan[o + ACT.y0]!;
  const x1 = plan[o + ACT.x1]!;
  const y1 = plan[o + ACT.y1]!;
  if (kind === SEG.carry) {
    out[0] = hermite(x0, plan[o + ACT.vx0]!, x1, plan[o + ACT.vx1]!, u);
    out[1] = hermite(y0, plan[o + ACT.vy0]!, y1, plan[o + ACT.vy1]!, u);
    return;
  }
  const s = extent(kind, u);
  out[0] = u <= 0 ? x0 : u >= 1 ? x1 : x0 + (x1 - x0) * s;
  out[1] = u <= 0 ? y0 : u >= 1 ? y1 : y0 + (y1 - y0) * s;
}

/**
 * The ball at the advance `a` (0 to 1) of a plan, into `out`: x, y and height. Before the first
 * action and between two it stays where the last one ended. Allocates nothing.
 */
export function ballAt(plan: Float64Array, a: number, out: Float64Array): void {
  const count = plan[HEAD.count]!;
  if (count === 0) {
    out[0] = plan[HEAD.sx]!;
    out[1] = plan[HEAD.sy]!;
    out[2] = 0;
    return;
  }
  for (let s = 0; s < count; s++) {
    const o = offset(s);
    const t0 = plan[o + ACT.t0]!;
    const t1 = plan[o + ACT.t1]!;
    if (a < t0) {
      out[0] = plan[o + ACT.x0]!;
      out[1] = plan[o + ACT.y0]!;
      out[2] = 0;
      return;
    }
    if (a <= t1 || s === count - 1) {
      const u = t1 > t0 ? Math.min(1, (a - t0) / (t1 - t0)) : 1;
      actionAt(plan, o, u, out);
      out[2] = heightAt(plan[o + ACT.zmode]!, plan[o + ACT.h]!, u);
      return;
    }
  }
}

/** The trails of a frame: four entries of `TRAIL.stride` numbers, the newest first. */
export const TRAIL = {
  count: 4,
  stride: 13,
  kind: 0,
  alpha: 1,
  x0: 2,
  y0: 3,
  x1: 4,
  y1: 5,
  h: 6,
  zmode: 7,
  s: 8,
  vx0: 9,
  vy0: 10,
  vx1: 11,
  vy1: 12,
} as const;

// -------------------------------------------------------------------------------- the planner

const L = PITCH_SIZE.length;
const W = PITCH_SIZE.width;
const [XLO, XHI] = M.band.x;
const [YLO, YHI] = M.band.y;

/** `v` reflected into `[low, high]` when it passes a limit (95 + 3 becomes 92). */
function reflect(v: number, low: number, high: number): number {
  let r = v;
  if (r > high) r = high - (r - high);
  if (r < low) r = low + (low - r);
  return Math.min(high, Math.max(low, r));
}

/**
 * The target `(tx, ty)` held to at least `least` metres from `(bx, by)`: a short one walks in width,
 * to the side with the most room, until it completes the distance.
 */
function atLeast(bx: number, by: number, tx: number, ty: number, least: number): [number, number] {
  const dx = tx - bx;
  const dy = ty - by;
  if (Math.hypot(dx, dy) >= least) return [tx, ty];
  const need = Math.sqrt(Math.max(0, least * least - dx * dx));
  return [tx, by - YLO > YHI - by ? by - need : by + need];
}

const reflectX = (v: number) => reflect(v, XLO, XHI);
const reflectY = (v: number) => reflect(v, YLO, YHI);

/** What the planner needs of the possession (`possessionTrace`). */
export interface PlanTrace {
  readonly owners: Uint8Array;
  readonly after: Uint8Array;
}

/**
 * The plans of the steps of a match, made in order on demand: `ensure(i)` makes every plan up to
 * the step `i` (the screen asks for the one after the step it reveals).
 */
export class BallPlanner {
  /** The plan of each step made so far. */
  readonly plans: Float64Array[] = [];
  /** Where each step starts on the Normal clock, in seconds, and how long it lasts. */
  readonly start: Float64Array;
  readonly length: Float64Array;
  private x = CENTRE_X;
  private y = CENTRE_Y;
  /** The speed the ball leaves the last action with, in metres per second. */
  private vx = 0;
  private vy = 0;
  /** The last action was over the top (never two in a row). */
  private over = false;
  private scored = false;
  /** The line whose start was only the way back to the centre after a goal. */
  private centred = '';

  private readonly steps: readonly MatchStep[];
  private readonly trace: PlanTrace;
  private readonly seed: number | string;

  constructor(steps: readonly MatchStep[], trace: PlanTrace, seed: number | string) {
    this.steps = steps;
    this.trace = trace;
    this.seed = seed;
    this.start = new Float64Array(steps.length);
    this.length = new Float64Array(steps.length);
    let at = 0;
    steps.forEach((step, i) => {
      this.start[i] = at;
      const d = step.timing === undefined ? 0 : MATCH_TIMING.normal[step.timing] / 1000;
      this.length[i] = d;
      at += d;
    });
  }

  /** Plans every step up to `index` (the ones already made are kept). */
  ensure(index: number): void {
    const last = Math.min(index, this.steps.length - 1);
    while (this.plans.length <= last) this.plans.push(this.make(this.plans.length));
  }

  private rng(label: string): Rng {
    return new Rng(seedFromString(`${this.seed}-pitch-${label}`));
  }

  /** Adds an action from where the ball is to `(tx, ty)`, leaving it there. */
  private add(
    plan: Float64Array,
    kind: number,
    t0: number,
    t1: number,
    tx: number,
    ty: number,
    seconds: number,
    h = 0,
    zmode: number = Z.flat,
  ): void {
    const n = plan[HEAD.count]!;
    const o = offset(n);
    plan[HEAD.count] = n + 1;
    plan[o + ACT.kind] = kind;
    plan[o + ACT.t0] = t0;
    plan[o + ACT.t1] = t1;
    plan[o + ACT.x0] = this.x;
    plan[o + ACT.y0] = this.y;
    plan[o + ACT.x1] = tx;
    plan[o + ACT.y1] = ty;
    plan[o + ACT.h] = h;
    plan[o + ACT.zmode] = zmode;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const average = seconds > 0 ? 1 / seconds : 0;
    if (kind === SEG.carry) {
      // A cubic that leaves with the speed the ball had (held to the distance, so it does not
      // overshoot) and arrives with its average speed, so the ball does not stop at the end.
      let ux = this.vx * seconds;
      let uy = this.vy * seconds;
      const reach = Math.hypot(dx, dy);
      const had = Math.hypot(ux, uy);
      if (had > reach && had > 0) {
        ux *= reach / had;
        uy *= reach / had;
      }
      plan[o + ACT.vx0] = ux;
      plan[o + ACT.vy0] = uy;
      plan[o + ACT.vx1] = dx;
      plan[o + ACT.vy1] = dy;
      this.vx = dx * average;
      this.vy = dy * average;
    } else if (kind === SEG.ground || kind === SEG.fall) {
      this.vx = 0;
      this.vy = 0;
    } else {
      this.vx = dx * average;
      this.vy = dy * average;
    }
    this.x = tx;
    this.y = ty;
    if (kind === SEG.ground || kind === SEG.carry) this.over = false;
    else if (kind === SEG.air || kind === SEG.cross) this.over = true;
    else if (kind === SEG.shot || kind === SEG.chip) this.over = false;
  }

  /** The way back to the centre, with no trail, over the whole step. */
  private toCentre(plan: Float64Array, d: number): void {
    plan[HEAD.centre] = 1;
    this.add(plan, SEG.loose, 0, 1, CENTRE_X, CENTRE_Y, d);
    this.over = false;
  }

  private make(i: number): Float64Array {
    const plan = new Float64Array(PLAN_SIZE);
    const step = this.steps[i]!;
    const timing = step.timing;
    const source = step.line?.source;
    const type = source?.type;
    const justScored = this.scored;
    this.scored = timing === 'afterGoal';
    plan[HEAD.sx] = this.x;
    plan[HEAD.sy] = this.y;
    plan[HEAD.owner] = this.trace.owners[i] ?? 0;
    if (timing === undefined || type === 'fulltime') return plan;
    const d = MATCH_TIMING.normal[timing] / 1000;
    const stage = step.line?.stage;
    const played =
      type === 'chance' || type === 'goal' || type === 'penaltyAwarded' || type === 'penaltyMissed';

    if (justScored) {
      // After a goal the play wins over the kick-off: only the way back to the centre (a weak
      // chance is just that); the shot comes in the step of the outcome (partida-campo-v2.md, 6).
      this.toCentre(plan, d);
      if (played && stage === 'build') this.centred = step.line!.id;
      else if (played && type === 'penaltyAwarded') this.centred = step.line!.id;
      return plan;
    }
    if (type === 'kickoff' || type === 'halftime' || type === 'secondHalf') {
      this.toCentre(plan, d);
      return plan;
    }
    if (played && (stage === 'build' || type === 'penaltyAwarded')) {
      this.begin(plan, i, step, source as Played, d);
    } else if (played && (timing === 'afterGoal' || timing === 'afterMiss')) {
      this.outcome(plan, step, source as Played, d);
    } else if (type === 'chance') {
      this.weak(plan, step, source as Played, d);
    } else {
      this.quota(plan, i, step, d);
    }
    return plan;
  }

  /** The start of a play: a pass to the point of the play (D3-B), or the ball taken there. */
  private begin(plan: Float64Array, i: number, step: MatchStep, event: Played, d: number): void {
    const side = event.side;
    const dir = attack(side);
    const goal = goalLine(side);
    const slow = step.timing === 'drama';
    const split = slow ? SLOW_SPLIT : 0.5;
    // The time of the first half in seconds: in slow motion 0.7 of the advance (partida.md).
    const seconds = split * d * (slow ? 1 / SLOW_SPEED : 1);
    const [px, py] = playPoint(event, this.rng(`${step.line!.id}-build`));
    plan[HEAD.owner] = side === 'home' ? 1 : 2;
    plan[HEAD.wedge] = 1;
    const reach = Math.hypot(px - this.x, py - this.y);
    const mine = this.trace.after[i - 1] === plan[HEAD.owner];
    // A pass only from a ball of the play's side, near, and the speed of a pass under the limit.
    if (!isPenalty(event) && !isFreeKick(event) && mine && reach <= M.passReach) {
      const open =
        dir * (this.x - CENTRE_X) > M.cross.from && Math.abs(this.y - CENTRE_Y) > M.cross.wide;
      const area = Math.abs(px - goal) <= M.penalty.areaDepth && Math.abs(py - CENTRE_Y) <= 20.16;
      if (open && area && !this.over) {
        const rng = this.rng(`${step.line!.id}-play`);
        const h = within(rng, M.cross.height);
        this.add(plan, SEG.cross, 0, split, px, py, seconds, h, Z.arch);
      } else {
        this.add(plan, SEG.ground, 0, split, px, py, seconds);
      }
    } else {
      this.add(plan, SEG.loose, 0, split, px, py, seconds);
    }
  }

  /** The outcome: the shot from the point of the play, the post's bounce, and nothing else. */
  private outcome(plan: Float64Array, step: MatchStep, event: Played, d: number): void {
    const id = step.line!.id;
    const rng = this.rng(`${id}-outcome`);
    const target = outcomeTarget(event.side, outcomeOf(event)!, rng);
    const flight = MATCH_TIMING.normal.afterMiss / 2 / 1000;
    let t = 0;
    if (this.centred === id) {
      // The ball and the finisher go together from the centre to the point of the play.
      const [px, py] = playPoint(event, this.rng(`${id}-build`));
      t = Math.min(1, M.approach / d);
      this.add(plan, SEG.loose, 0, t, px, py, M.approach);
    }
    this.centred = '';
    this.shoot(
      plan,
      event,
      rng,
      target,
      t,
      Math.min(1, t + flight / d),
      1,
      flight,
      outcomeOf(event)!,
    );
    plan[HEAD.owner] = event.side === 'home' ? 1 : 2;
  }

  /** A weak chance (400 ms): to the point of the chance, then the shot. */
  private weak(plan: Float64Array, step: MatchStep, event: Played, d: number): void {
    const id = step.line!.id;
    const rng = this.rng(`${id}-outcome`);
    const [px, py] = weakPoint(event.side, rng);
    const outcome = outcomeOf(event)!;
    const target = outcomeTarget(event.side, outcome, rng);
    this.add(plan, SEG.loose, 0, 0.5, px, py, 0.5 * d);
    const end = outcome === 'post' ? 0.75 : 1;
    this.shoot(plan, event, rng, target, 0.5, end, 1, (end - 0.5) * d, outcome);
    plan[HEAD.owner] = event.side === 'home' ? 1 : 2;
  }

  /**
   * The shot from `[t0, t1]` of the step (then the bounce of a post, or the fall of a ball over the
   * bar, up to `last`): straight, or an arc over the wall in a free kick and over the bar in half
   * of the wide ones (campo-lances.md and partida-campo-v2.md, 6 and 7).
   */
  private shoot(
    plan: Float64Array,
    event: Played,
    rng: Rng,
    target: { fx: number; fy: number; rx: number; ry: number },
    t0: number,
    t1: number,
    last: number,
    seconds: number,
    outcome: Outcome,
  ): void {
    const dir = attack(event.side);
    const line = goalLine(event.side);
    const fk = isFreeKick(event);
    // Half of the wide shots go over the bar, inside the width of the goal (the draw comes last, so
    // the other draws of the outcome do not change).
    const over = outcome === 'wide' && !fk && rng.next() < 0.5;
    if (over) {
      const y = CENTRE_Y + (rng.next() * 2 - 1) * (M.post.halfGoal - 0.4);
      const mid = t0 + (t1 - t0) * 0.7;
      this.add(plan, SEG.chip, t0, mid, line + dir * 0.3, y, seconds * 0.7, M.height.chip, Z.rise);
      this.add(plan, SEG.fall, mid, last, target.fx, y, seconds * 0.3, M.height.chip, Z.fall);
    } else if (fk) {
      this.add(plan, SEG.chip, t0, t1, target.fx, target.fy, seconds, M.height.freeKick, Z.arch);
    } else {
      this.add(plan, SEG.shot, t0, t1, target.fx, target.fy, seconds);
    }
    if (outcome === 'post' && t1 < last) {
      this.add(plan, SEG.shot, t1, last, target.rx, target.ry, (last - t1) * (seconds / (t1 - t0)));
    }
    this.over = false;
  }

  /** A step of the quota: what the club with the ball does (partida-campo-v2.md, 6). */
  private quota(plan: Float64Array, i: number, step: MatchStep, d: number): void {
    const owner = this.trace.owners[i] === 2 ? 'away' : 'home';
    const dir = attack(owner);
    plan[HEAD.wedge] = 1;
    const rng = this.rng(step.line === undefined ? `m${step.slot}-play` : `${step.line.id}-play`);
    const U = (low: number, high: number) => low + (high - low) * rng.next();
    const go = (kind: number, t0: number, t1: number, t: [number, number], h = 0) =>
      this.add(
        plan,
        kind,
        t0,
        t1,
        t[0],
        t[1],
        (t1 - t0) * d,
        h,
        kind === SEG.air || kind === SEG.cross ? Z.arch : Z.flat,
      );
    const hOf = (t: [number, number]) =>
      Math.min(
        M.height.max,
        M.height.base + M.height.perMetre * Math.hypot(t[0] - this.x, t[1] - this.y),
      );
    // A pass of 5 to 18 m ahead and up to 14 m across; a carry; a short pass of a step of 400 ms.
    const pass = (): [number, number] =>
      atLeast(
        this.x,
        this.y,
        reflectX(this.x + dir * U(5, 18)),
        reflectY(this.y + U(-14, 14)),
        M.least.pass,
      );
    const carry = (from: number, to: number, across: number): [number, number] =>
      atLeast(
        this.x,
        this.y,
        reflectX(this.x + dir * U(from, to)),
        reflectY(this.y + U(-across, across)),
        M.least.carry,
      );
    const bx = this.x;
    if (bx < XLO || bx > XHI) {
      // The restart after an outcome: one ground pass, back into the band (no dispute, no draw).
      const near = bx < CENTRE_X ? 0 : L;
      const into = near === 0 ? 1 : -1;
      const tx = near + into * U(12, 20);
      plan[HEAD.pattern] = PATTERN.pass;
      go(SEG.ground, 0, 1, [tx, reflectY(this.y + U(-10, 10))]);
      return;
    }
    let from = 0;
    if (this.trace.after[i - 1] !== this.trace.owners[i] && i > 0) {
      // The ball is loose first (3 to 6 m, any way), and then the new owner plays.
      const angle = U(0, 2 * Math.PI);
      const far = U(3, 6);
      from = M.loose;
      go(SEG.loose, 0, from, [
        reflectX(this.x + far * Math.cos(angle)),
        reflectY(this.y + far * Math.sin(angle)),
      ]);
    }
    const left = 1 - from;
    if (d < 0.5) {
      // A step of 400 ms: one short ground pass, half the distances.
      const t = atLeast(
        this.x,
        this.y,
        reflectX(this.x + dir * U(2.5, 9)),
        reflectY(this.y + U(-7, 7)),
        M.least.short,
      );
      plan[HEAD.pattern] = PATTERN.pass;
      go(SEG.ground, from, 1, t);
      return;
    }
    const open =
      dir * (this.x - CENTRE_X) > M.cross.from && Math.abs(this.y - CENTRE_Y) > M.cross.wide;
    const w = M.actions;
    const keys: [string, number][] = [
      ['carryPass', w.carryPass],
      ['passCarry', w.passCarry],
      ['pass', w.pass],
      ['twoPasses', w.twoPasses],
      ['back', w.back],
      ['wall', w.wall],
      ['over', this.over ? 0 : w.over],
    ];
    const total = keys.reduce((sum, [, weight]) => sum + weight, 0);
    let u = rng.next() * total;
    let pick = 'pass';
    for (const [key, weight] of keys) {
      u -= weight;
      if (u <= 0 && weight > 0) {
        pick = key;
        break;
      }
    }
    const cross = rng.next();
    if (!this.over && open && cross < M.cross.chance) {
      const line = owner === 'home' ? L : 0;
      const target: [number, number] = [
        line - dir * U(M.cross.near[0], M.cross.near[1]),
        CENTRE_Y + U(-M.cross.across, M.cross.across),
      ];
      plan[HEAD.pattern] = PATTERN.cross;
      go(SEG.cross, from, 1, target, U(M.cross.height[0], M.cross.height[1]));
      return;
    }
    const mid = from + left / 2;
    plan[HEAD.pattern] = PATTERN[pick as keyof typeof PATTERN];
    if (pick === 'carryPass') {
      const f = from + left * U(0.3, 0.45);
      go(SEG.carry, from, f, carry(3, 6, 3));
      go(SEG.ground, f, 1, pass());
    } else if (pick === 'passCarry') {
      const f = from + left * 0.55;
      go(SEG.ground, from, f, pass());
      go(SEG.carry, f, 1, carry(2, 5, 2.5));
    } else if (pick === 'pass') {
      go(SEG.ground, from, 1, pass());
    } else if (pick === 'twoPasses') {
      go(SEG.ground, from, mid, pass());
      go(SEG.ground, mid, 1, pass());
    } else if (pick === 'back') {
      const deep = dir * (this.x - CENTRE_X) <= -8;
      if (deep && rng.next() < 0.5) {
        const ownLine = owner === 'home' ? 0 : L;
        const t = atLeast(
          this.x,
          this.y,
          ownLine + dir * U(10, 14),
          CENTRE_Y + U(-8, 8),
          M.least.pass,
        );
        go(SEG.ground, from, 1, t);
      } else {
        const t = atLeast(
          this.x,
          this.y,
          reflectX(this.x - dir * U(8, 15)),
          reflectY(this.y + U(-8, 8)),
          M.least.pass,
        );
        go(SEG.ground, from, mid, t);
        go(SEG.carry, mid, 1, carry(2, 4, 2));
      }
    } else if (pick === 'wall') {
      const x0 = this.x;
      const y0 = this.y;
      go(SEG.ground, from, mid, pass());
      // The second pass of the wall: 6 m ahead of where the ball started, in a "V".
      const t = atLeast(
        this.x,
        this.y,
        reflectX(x0 + dir * 6),
        reflectY(y0 + U(-4, 4)),
        M.least.pass,
      );
      go(SEG.ground, mid, 1, t);
    } else {
      const long = rng.next() < 0.5;
      const t = atLeast(
        this.x,
        this.y,
        long ? reflectX(this.x + dir * U(18, 30)) : reflectX(this.x + dir * U(-4, 10)),
        long ? reflectY(this.y + U(-12, 12)) : reflectY(W - this.y + U(-6, 6)),
        M.least.pass,
      );
      go(SEG.air, from, 1, t, hOf(t));
    }
  }
}

/**
 * Fills `out` (the four entries of the trails, `TRAIL.stride` numbers each) with the action in
 * course and the three before it, the newest first, and returns how many. `a` is the advance in the
 * step `index`; `still` is the one frame of reduced motion: the whole step, no time passing.
 */
export function fillTrails(
  planner: BallPlanner,
  index: number,
  a: number,
  still: boolean,
  out: Float64Array,
): number {
  const here = planner.plans[index];
  if (here === undefined) return 0;
  const tau = planner.start[index]! + a * planner.length[index]!;
  let n = 0;
  for (let j = index; j >= 0 && n < TRAIL.count; j--) {
    const plan = planner.plans[j]!;
    const end = planner.start[j]! + planner.length[j]!;
    if (!still && j < index && tau - end > M.trail.life) break;
    for (let s = plan[HEAD.count]! - 1; s >= 0 && n < TRAIL.count; s--) {
      const o = offset(s);
      const kind = plan[o + ACT.kind]!;
      if (!hasTrail(kind)) continue;
      const t0 = plan[o + ACT.t0]!;
      const t1 = plan[o + ACT.t1]!;
      let covered = 1;
      let age = 0;
      if (j === index && !still) {
        if (a <= t0) continue;
        const u = a >= t1 ? 1 : (a - t0) / (t1 - t0);
        covered = kind === SEG.carry ? u : extent(kind, u);
        age = a > t1 ? (a - t1) * planner.length[j]! : 0;
      } else if (!still) {
        age = tau - (planner.start[j]! + t1 * planner.length[j]!);
      }
      const e = n * TRAIL.stride;
      out[e + TRAIL.kind] = kind;
      out[e + TRAIL.alpha] = M.trail.weights[n]! * Math.max(0, 1 - age / M.trail.life);
      out[e + TRAIL.x0] = plan[o + ACT.x0]!;
      out[e + TRAIL.y0] = plan[o + ACT.y0]!;
      out[e + TRAIL.x1] = plan[o + ACT.x1]!;
      out[e + TRAIL.y1] = plan[o + ACT.y1]!;
      out[e + TRAIL.h] = plan[o + ACT.h]!;
      out[e + TRAIL.zmode] = plan[o + ACT.zmode]!;
      out[e + TRAIL.s] = covered;
      out[e + TRAIL.vx0] = plan[o + ACT.vx0]!;
      out[e + TRAIL.vy0] = plan[o + ACT.vy0]!;
      out[e + TRAIL.vx1] = plan[o + ACT.vx1]!;
      out[e + TRAIL.vy1] = plan[o + ACT.vy1]!;
      n++;
    }
    // The chain starts again at the way back to the centre; the reduced frame is the step alone.
    if (plan[HEAD.centre] === 1 || still) break;
  }
  return n;
}
