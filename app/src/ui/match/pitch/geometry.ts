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
}

/** The sizes for a canvas of `width` × `height` pixels at `dpr` pixels per CSS pixel. */
export function pitchGeometry(width: number, height: number, dpr: number): PitchGeometry {
  const yFar = height * (1 - PITCH_VIEW.grassShare);
  const boardHeight = (PITCH_VIEW.boardHeight * width) / 360;
  return {
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
  };
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
export const clampBall = (value: number, low: number, high: number): number =>
  value < low ? low : value > high ? high : value;

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
  const y = clampBall(cy, g.yFar + r, g.height - r);
  const t = g.farScale + ((y - g.yFar) / (g.height - g.yFar)) * (1 - g.farScale);
  const half = (g.width / 2) * t - r;
  out[0] = clampBall(cx, g.width / 2 - half, g.width / 2 + half);
  out[1] = y;
}
