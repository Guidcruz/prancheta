import { PITCH_SIZE, PITCH_VIEW } from './motion';

/*
 * The tilted pitch (docs/design/telas/partida-campo-v2.md, 3; ADR-0023): a true perspective (a
 * homography) from the drawing in metres (111 × 74: the pitch of 105 × 68 and its strip of grass)
 * to the canvas, with the camera fixed on the axis of the halfway line. Verticals stay vertical
 * and straight lines stay straight, so the markings, the trails and the base of the boards are
 * drawn by projecting only their vertices. Computed once per size of the canvas, never per frame.
 */

const LENGTH = PITCH_SIZE.length + 2 * PITCH_SIZE.margin;
const WIDTH = PITCH_SIZE.width + 2 * PITCH_SIZE.margin;
const DISC = 5.5;
const BALL = 2.5;
/** The goal: 7.32 m wide, 2.44 m tall, the net 2 m deep on the ground (backdrop.ts draws it so). */
const GOAL = { half: 3.66, height: 2.44, net: 2 } as const;

export interface PitchGeometry {
  /** Canvas size in pixels and pixels per CSS pixel. */
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  /** Pixels per metre at the near edge. */
  readonly s0: number;
  /** Canvas y of the far edge of the drawing (the stand is above it). */
  readonly yFar: number;
  readonly farScale: number;
  /** Height of the far boards in pixels, and the canvas y of their top. */
  readonly boardHeight: number;
  readonly boardTop: number;
  /** Least radius of a disc and of the ball, in canvas pixels. */
  readonly discMin: number;
  readonly ballMin: number;
  /**
   * The box of each goal on the canvas, in pixels: left, top, right, bottom of the posts, the bar
   * and the net projected; the home goal's at 0 to 3, the visitor's at 4 to 7 (for `tagPlacement`).
   */
  readonly goals: Float64Array;
}

/** The sizes for a canvas of `width` × `height` pixels at `dpr` pixels per CSS pixel. */
export function pitchGeometry(width: number, height: number, dpr: number): PitchGeometry {
  const yFar = height * (1 - PITCH_VIEW.grassShare);
  const boardHeight = (PITCH_VIEW.boardHeight * width) / 360;
  const goals = new Float64Array(8);
  const g: PitchGeometry = {
    width,
    height,
    dpr,
    s0: width / LENGTH,
    yFar,
    farScale: PITCH_VIEW.farScale,
    boardHeight,
    boardTop: yFar - boardHeight,
    discMin: PITCH_VIEW.discMin * dpr,
    ballMin: PITCH_VIEW.ballMin * dpr,
    goals,
  };
  const p = new Float64Array(3);
  for (let side = 0; side < 2; side++) {
    const line = side === 0 ? 0 : PITCH_SIZE.length;
    const behind = side === 0 ? line - GOAL.net : line + GOAL.net;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const x of [line, behind]) {
      for (const y of [PITCH_SIZE.width / 2 - GOAL.half, PITCH_SIZE.width / 2 + GOAL.half]) {
        project(g, x, y, p);
        left = Math.min(left, p[0]!);
        right = Math.max(right, p[0]!);
        bottom = Math.max(bottom, p[1]!);
        // The posts and the bar stand on the line; the net lies on the ground.
        top = Math.min(top, x === line ? p[1]! - GOAL.height * p[2]! : p[1]!);
      }
    }
    goals.set([left, top, right, bottom], side * 4);
  }
  return g;
}

/** The depth scale of the drawing's `v` (0 far to 74 near): `farScale` far, 1 near. */
function depth(g: PitchGeometry, v: number): number {
  const f = g.farScale;
  return (WIDTH * f) / (WIDTH * f + (1 - f) * (WIDTH - v));
}

/**
 * Projects the point `(x, y)` in metres (of the pitch of play) into `out`: `out[0]` the canvas x,
 * `out[1]` the canvas y and `out[2]` the pixels per metre there. Pure; no allocation.
 */
export function project(g: PitchGeometry, x: number, y: number, out: Float64Array): void {
  const t = depth(g, y + PITCH_SIZE.margin);
  const k = g.s0 * t;
  out[0] = g.width / 2 + (x + PITCH_SIZE.margin - LENGTH / 2) * k;
  out[1] = g.yFar + ((g.height - g.yFar) * (t - g.farScale)) / (1 - g.farScale);
  out[2] = k;
}

/** Pixels per metre at depth `y` (metres of the pitch of play). */
export function scaleAt(g: PitchGeometry, y: number): number {
  return g.s0 * depth(g, y + PITCH_SIZE.margin);
}

/** Radius in canvas pixels of a disc where the scale is `k`. */
export const discRadius = (g: PitchGeometry, k: number): number =>
  Math.max((DISC / 2) * k, g.discMin);

/** Radius of the ball on the ground where the scale is `k`. */
export const ballRadius = (g: PitchGeometry, k: number): number =>
  Math.max((BALL / 2) * k, g.ballMin);

/** A coordinate held inside `[low, high]` (no allocation). */
export const clamp = (value: number, low: number, high: number): number =>
  value < low ? low : value > high ? high : value;
export const clampBall = clamp;

/**
 * Holds the centre of the ball, in canvas pixels, inside the trapezoid of the drawing with its
 * radius `r`, so it never enters the stand or leaves the canvas. Written into `out[0]`, `out[1]`.
 */
export function holdBall(
  g: PitchGeometry,
  cx: number,
  cy: number,
  r: number,
  out: Float64Array,
): void {
  const y = clamp(cy, g.yFar + r, g.height - r);
  const t = g.farScale + ((y - g.yFar) / (g.height - g.yFar)) * (1 - g.farScale);
  const half = (g.width / 2) * t - r;
  out[0] = clamp(cx, g.width / 2 - half, g.width / 2 + half);
  out[1] = y;
}

export const TAG_GAP = 12;
export const TAG_TOP = 4;
export const TAG_SIDE = 8;
export const TAG_GOAL_MARGIN = 6;
export const TAG_TIP_EDGE = 20;
/** The thread of the shirt over the ball may lean this far from the ball (px CSS, 16, item 14). */
export const TEAM_TIP_MAX = 12;
/** Once hidden for leaning too far, the shirt over the ball is back under this (no flicker). */
export const TEAM_TIP_BACK = 9;
/**
 * The tip under the pill, in px CSS (partida-campo-v2.md, §9): 12 wide, 7 tall. The thread of 5px
 * from the tip to the top of the disc (or of the ball) is drawn by the pitch, not by the component.
 */
export const PITCH_TAG_TIP = { width: 12, height: 7 } as const;

/** Where the tip is from the middle of a pill of width `w` whose tip is `tip` from its left edge. */
export const tipShift = (tip: number, w: number): number => tip - w / 2;

/**
 * Whether the shirt over the ball is drawn, with a hysteresis around the {@link TEAM_TIP_MAX}: it
 * goes when the tip leans more than that from the ball and comes back only under
 * {@link TEAM_TIP_BACK}, so it does not blink at the limit. `shown` is how it was last frame.
 */
export const teamShirtShown = (shown: boolean, offset: number): boolean =>
  shown ? offset <= TEAM_TIP_MAX : offset < TEAM_TIP_BACK;

/** `x` held in `[TAG_SIDE, box − TAG_SIDE − w]` (the left edge of a pill of width `w`). */
function holdSide(x: number, box: number, w: number): number {
  return clamp(x, TAG_SIDE, Math.max(TAG_SIDE, box - TAG_SIDE - w));
}

/**
 * Where a tag of the pitch goes (partida-campo-v2.md, 9), written into `out` in CSS pixels of the
 * box: `out[0]`, `out[1]` the top-left corner of the pill and `out[2]` the centre of its tip, from
 * the pill's left edge. `px`, `py` and `r` are the centre and the radius of the disc or the ball
 * in canvas pixels (what `project` and `discRadius` give); `w` and `h` the pill's size in CSS
 * pixels, without the tip. Pure; no allocation.
 *
 * 1. Over the player, centred on his x: the base of the pill {@link TAG_GAP} px above the top of
 *    the disc (7 of tip and 5 of thread).
 * 2. Held in the box: x from `space-2` ({@link TAG_SIDE}) to `space-2` of the right edge; the top
 *    never above {@link TAG_TOP}.
 * 3. Never over a goal: if it crosses, in height, the box of a goal with a margin of
 *    {@link TAG_GOAL_MARGIN}, it is pushed inwards to the side clear of it, and held again.
 * 4. The tip stays at the x of the player, but at least {@link TAG_TIP_EDGE} px from the ends of
 *    the pill (the thread then leans).
 */
export function tagPlacement(
  g: PitchGeometry,
  px: number,
  py: number,
  r: number,
  w: number,
  h: number,
  out: Float64Array,
): void {
  const boxW = g.width / g.dpr;
  const cx = px / g.dpr;
  const top = (py - r) / g.dpr;
  const y = Math.max(top - TAG_GAP - h, TAG_TOP);
  const reach = h + PITCH_TAG_TIP.height;
  let x = holdSide(cx - w / 2, boxW, w);
  const centre = boxW / 2;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < 8; i += 4) {
      const left = g.goals[i]! / g.dpr - TAG_GOAL_MARGIN;
      const right = g.goals[i + 2]! / g.dpr + TAG_GOAL_MARGIN;
      const above = g.goals[i + 1]! / g.dpr - TAG_GOAL_MARGIN;
      const below = g.goals[i + 3]! / g.dpr + TAG_GOAL_MARGIN;
      if (y + reach <= above || y >= below || x + w <= left || x >= right) continue;
      x = holdSide(x + w / 2 < centre ? right : left - w, boxW, w);
    }
  }
  const edge = Math.min(TAG_TIP_EDGE, w / 2);
  out[0] = x;
  out[1] = y;
  out[2] = clamp(cx - x, edge, w - edge);
}

/**
 * How far, in px CSS, the tip placed in `out` (by `tagPlacement`) is from the x of the anchor at
 * `px` canvas px. The shirt over the ball is not drawn when it passes {@link TEAM_TIP_MAX}: the
 * thread would cross the mouth of a goal.
 */
export function tagTipOffset(g: PitchGeometry, px: number, out: Float64Array): number {
  return Math.abs(out[0]! + out[2]! - px / g.dpr);
}
