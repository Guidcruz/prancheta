import { ballPlace, project, ringSize, shadowShift, type PitchGeometry } from './geometry';
import { PITCH_MOTION as M, PITCH_SIZE } from './motion';
import { heightAt, hermite, SEG, TRAIL } from './plan';
import type { PitchScene } from './scene';

/*
 * What the pitch draws for the ball besides the ball (docs/design/telas/partida-campo-v2.md, 7 and
 * 8): the wedge of the attack, the trails by kind and the shadow of the ball in the air. Plain
 * functions of the context, the geometry and the scene, with nothing allocated per frame: the
 * scratch arrays are fixed and the dash patterns are made once per size (`pitchDashes`).
 */

const TAU = Math.PI * 2;
const ARC_POINTS = 19;
const CARRY_POINTS = 8;
/** The ring of the landing fades in over this share of the pass. */
const RING_FADE = 0.2;
const RING_START = [15, 105, 195, 285].map((d) => (d * Math.PI) / 180);
const RING_SPAN = Math.PI / 3;
const RING_COS = RING_START.map((a) => Math.cos(a));
const RING_SIN = RING_START.map((a) => Math.sin(a));
/** Widths of the trails in px CSS: ground, shot, carry, shot over, shadow trail, origin. */
const WIDTH = { ground: 2, shot: 3.5, carry: 2.2, chip: 3, shadow: 1.2, origin: 2.5 } as const;

/** The dash patterns of the trails, in canvas px (they depend on the density). */
export interface PitchDashes {
  readonly dots: readonly number[];
  readonly shadow: readonly number[];
  readonly none: readonly number[];
}

export const pitchDashes = (dpr: number): PitchDashes => ({
  dots: [0.1 * dpr, 5 * dpr],
  shadow: [3 * dpr, 4 * dpr],
  none: [],
});

const here = new Float64Array(3);
const arcPlace = new Float64Array(7);
const ringSizes = new Float64Array(2);
const there = new Float64Array(3);

/** Strokes the ground line of metres `(x0, y0)` to `(x1, y1)`: both ends projected. */
function ground(
  ctx: CanvasRenderingContext2D,
  g: PitchGeometry,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  project(g, x0, y0, here);
  project(g, x1, y1, there);
  ctx.beginPath();
  ctx.moveTo(here[0]!, here[1]!);
  ctx.lineTo(there[0]!, there[1]!);
  ctx.stroke();
}

/** The arc of an action as a polyline of `ARC_POINTS` points, each projected and lifted. */
function arc(
  ctx: CanvasRenderingContext2D,
  g: PitchGeometry,
  t: Float64Array,
  e: number,
  covered: number,
): void {
  const x0 = t[e + TRAIL.x0]!;
  const y0 = t[e + TRAIL.y0]!;
  const dx = t[e + TRAIL.x1]! - x0;
  const dy = t[e + TRAIL.y1]! - y0;
  const h = t[e + TRAIL.h]!;
  const mode = t[e + TRAIL.zmode]!;
  ctx.beginPath();
  for (let k = 0; k < ARC_POINTS; k++) {
    const u = (covered * k) / (ARC_POINTS - 1);
    // The path of the centre of the ball as drawn, held in the trapezoid like it (7).
    ballPlace(g, x0 + dx * u, y0 + dy * u, heightAt(mode, h, u), arcPlace);
    if (k === 0) ctx.moveTo(arcPlace[2]!, arcPlace[3]!);
    else ctx.lineTo(arcPlace[2]!, arcPlace[3]!);
  }
  ctx.stroke();
}

/**
 * The trails of the scene, the oldest first so the action in course is on top: a ground pass is a
 * line, a carry dots on its real path, a pass over the top an arc with the dashed trail of its
 * shadow on the ground, a shot a thick line and a shot over the bar a low arc. The action in course
 * and the three before, each fainter (`scene.trails`, plan.ts); the origin of the newest is a dot.
 */
export function drawTrails(
  ctx: CanvasRenderingContext2D,
  g: PitchGeometry,
  scene: PitchScene,
  ink: string,
  dashes: PitchDashes,
): void {
  const t = scene.trails;
  const dpr = g.dpr;
  ctx.strokeStyle = ink;
  ctx.lineCap = 'butt';
  for (let n = scene.trailCount - 1; n >= 0; n--) {
    const e = n * TRAIL.stride;
    const alpha = t[e + TRAIL.alpha]!;
    if (alpha <= 0.01) continue;
    const kind = t[e + TRAIL.kind]!;
    const x0 = t[e + TRAIL.x0]!;
    const y0 = t[e + TRAIL.y0]!;
    const x1 = t[e + TRAIL.x1]!;
    const y1 = t[e + TRAIL.y1]!;
    const covered = t[e + TRAIL.s]!;
    ctx.globalAlpha = alpha;
    ctx.setLineDash(dashes.none as number[]);
    if (kind === SEG.ground || kind === SEG.shot || kind === SEG.back) {
      ctx.lineWidth = (kind === SEG.ground ? WIDTH.ground : WIDTH.shot) * dpr;
      ground(ctx, g, x0, y0, x0 + (x1 - x0) * covered, y0 + (y1 - y0) * covered);
    } else if (kind === SEG.carry) {
      // The real path of the ball, in dots, close to the ground.
      ctx.lineWidth = WIDTH.carry * dpr;
      ctx.lineCap = 'round';
      ctx.setLineDash(dashes.dots as number[]);
      ctx.beginPath();
      for (let k = 0; k < CARRY_POINTS; k++) {
        const u = (covered * k) / (CARRY_POINTS - 1);
        project(
          g,
          hermite(x0, t[e + TRAIL.vx0]!, x1, t[e + TRAIL.vx1]!, u),
          hermite(y0, t[e + TRAIL.vy0]!, y1, t[e + TRAIL.vy1]!, u),
          here,
        );
        if (k === 0) ctx.moveTo(here[0]!, here[1]!);
        else ctx.lineTo(here[0]!, here[1]!);
      }
      ctx.stroke();
      ctx.lineCap = 'butt';
    } else if (kind === SEG.air || kind === SEG.cross) {
      ctx.lineWidth = WIDTH.ground * dpr;
      arc(ctx, g, t, e, covered);
      // The trail of its shadow on the ground, dashed and fainter.
      ctx.globalAlpha = alpha * 0.7;
      ctx.lineWidth = WIDTH.shadow * dpr;
      ctx.setLineDash(dashes.shadow as number[]);
      ground(ctx, g, x0, y0, x0 + (x1 - x0) * covered, y0 + (y1 - y0) * covered);
      // The ring where it will land, from the start of the pass: faint for the first 20% of it.
      ctx.globalAlpha = alpha * Math.min(1, covered / RING_FADE);
      ctx.lineWidth = WIDTH.ground * dpr;
      ctx.setLineDash(dashes.none as number[]);
      ring(ctx, g, x1, y1);
    } else if (kind === SEG.chip) {
      ctx.lineWidth = WIDTH.chip * dpr;
      arc(ctx, g, t, e, covered);
    } else continue;
    if ((n === 0 && kind !== SEG.back) || (n === 1 && t[TRAIL.kind] === SEG.back)) {
      // The origin of the newest action.
      ctx.globalAlpha = alpha;
      ctx.setLineDash(dashes.none as number[]);
      project(g, x0, y0, here);
      ctx.beginPath();
      ctx.arc(here[0]!, here[1]!, WIDTH.origin * dpr, 0, TAU);
      ctx.fillStyle = ink;
      ctx.fill();
    }
  }
  ctx.setLineDash(dashes.none as number[]);
  ctx.globalAlpha = 1;
}

/**
 * The ring of the landing: an ellipse lying on the grass, only stroked, in four arcs of 60 degrees
 * with gaps of 30 at the cardinal points, `3 × r0` wide (12px CSS at least), centred on the spot.
 */
function ring(ctx: CanvasRenderingContext2D, g: PitchGeometry, x: number, y: number): void {
  project(g, x, y, here);
  const cx = here[0]!;
  const cy = here[1]!;
  ringSize(g, here[2]!, ringSizes);
  ctx.beginPath();
  for (let a = 0; a < RING_START.length; a++) {
    ctx.moveTo(cx + ringSizes[0]! * RING_COS[a]!, cy + ringSizes[1]! * RING_SIN[a]!);
    ctx.ellipse(
      cx,
      cy,
      ringSizes[0]!,
      ringSizes[1]!,
      0,
      RING_START[a]!,
      RING_START[a]! + RING_SPAN,
    );
  }
  ctx.stroke();
}

// -------------------------------------------------------------------------------- the wedge

/** The colour of the wedge with no opacity, for the end of its gradient. */
export function clearOf(colour: string): string {
  return /^rgba\(/.test(colour) ? colour.replace(/,\s*[\d.]+\s*\)$/, ', 0)') : 'transparent';
}

/**
 * The gradient of the wedge on a local axis (0 at the vertex, 1 at the goal): made once per size
 * and theme; each frame only the transformation changes.
 */
export function wedgeGradient(ctx: CanvasRenderingContext2D, colour: string): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, 0, 1, 0);
  gradient.addColorStop(0, colour);
  gradient.addColorStop(1, clearOf(colour));
  return gradient;
}

const HALF = (M.wedge.half * Math.PI) / 180;
const LENGTH = PITCH_SIZE.length;
const WIDTH_M = PITCH_SIZE.width;
// The cone clipped to the pitch of play, in metres: at most 7 vertices, in two scratch arrays.
const polyA = new Float64Array(16);
const polyB = new Float64Array(16);

/**
 * Clips the polygon `src` (`n` points) to one side of the line `axis = bound` (`keep` is 1 for the
 * side above it, -1 below), into `dst`; returns the new count.
 */
function clip(
  src: Float64Array,
  n: number,
  dst: Float64Array,
  axis: 0 | 1,
  bound: number,
  keep: 1 | -1,
): number {
  let m = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = src[i * 2]!;
    const ay = src[i * 2 + 1]!;
    const bx = src[j * 2]!;
    const by = src[j * 2 + 1]!;
    const a = (axis === 0 ? ax : ay) - bound;
    const b = (axis === 0 ? bx : by) - bound;
    const ina = a * keep >= 0;
    const inb = b * keep >= 0;
    if (ina) {
      dst[m * 2] = ax;
      dst[m * 2 + 1] = ay;
      m++;
    }
    if (ina !== inb) {
      const w = a / (a - b);
      dst[m * 2] = ax + (bx - ax) * w;
      dst[m * 2 + 1] = ay + (by - ay) * w;
      m++;
    }
  }
  return m;
}

/**
 * The wedge of the attack: a translucent triangle from the ball (on the ground) to the goal the
 * owner attacks, half-opening 26 degrees, clipped to the pitch of play and filled with the
 * gradient `fill` (its axis runs from the ball to the middle of the goal on the screen).
 */
export function drawWedge(
  ctx: CanvasRenderingContext2D,
  g: PitchGeometry,
  scene: PitchScene,
  fill: CanvasGradient,
): void {
  const owner = scene.wedgeOwner;
  if (owner === 0 || scene.wedgeAlpha <= 0) return;
  const goalX = owner === 1 ? LENGTH : 0;
  const bx = scene.ballX;
  const by = Math.min(WIDTH_M, Math.max(0, scene.ballY));
  const gx = goalX - bx;
  const gy = WIDTH_M / 2 - by;
  const far = Math.hypot(gx, gy);
  if (far < 1e-6) return;
  // The far edge is square to the axis, at the goal's middle; the clip cuts it at the goal line.
  const reach = far / Math.cos(HALF);
  const angle = Math.atan2(gy, gx);
  polyA[0] = bx;
  polyA[1] = by;
  polyA[2] = bx + reach * Math.cos(angle - HALF);
  polyA[3] = by + reach * Math.sin(angle - HALF);
  polyA[4] = bx + reach * Math.cos(angle + HALF);
  polyA[5] = by + reach * Math.sin(angle + HALF);
  let n = clip(polyA, 3, polyB, 0, 0, 1);
  n = clip(polyB, n, polyA, 0, LENGTH, -1);
  n = clip(polyA, n, polyB, 1, 0, 1);
  n = clip(polyB, n, polyA, 1, WIDTH_M, -1);
  if (n < 3) return;
  project(g, bx, by, here);
  project(g, goalX, WIDTH_M / 2, there);
  const vx = here[0]!;
  const vy = here[1]!;
  const ax = there[0]! - vx;
  const ay = there[1]! - vy;
  const norm = ax * ax + ay * ay;
  if (norm < 1) return;
  // The polygon in the local axis: (0, 0) the vertex, (1, 0) the goal, so the gradient is the same
  // object whatever the size; only this transform moves.
  ctx.setTransform(ax, ay, -ay, ax, vx, vy);
  ctx.globalAlpha = scene.wedgeAlpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    project(g, polyA[i * 2]!, polyA[i * 2 + 1]!, there);
    const px = there[0]! - vx;
    const py = there[1]! - vy;
    const lx = (px * ax + py * ay) / norm;
    const ly = (-px * ay + py * ax) / norm;
    if (i === 0) ctx.moveTo(lx, ly);
    else ctx.lineTo(lx, ly);
  }
  ctx.closePath();
  ctx.fill();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
}

// -------------------------------------------------------------------------------- the shadow

/**
 * The shadow of the ball in the air (7): an ellipse of `1.05 r0 × 0.5 r0` on the ground, drawn only
 * above `shadowMin` metres, lowered while the ball is low so the ball never covers it.
 * `place` is what `ballPlace` wrote.
 */
export function drawShadow(
  ctx: CanvasRenderingContext2D,
  g: PitchGeometry,
  z: number,
  place: Float64Array,
  colour: string,
): void {
  if (z <= M.shadowMin) return;
  const r0 = place[5]!;
  const shift = shadowShift(g, place[4]!, r0, place[6]!);
  ctx.beginPath();
  ctx.ellipse(place[0]!, place[1]! + shift, 1.05 * r0, 0.5 * r0, 0, 0, TAU);
  ctx.fillStyle = colour;
  ctx.fill();
}
