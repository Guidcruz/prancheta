import { describe, expect, it } from 'vitest';
import { FAR_BOARDS, farBoard, goalBoard } from './backdrop';
import { ballRadius, discRadius, holdBall, pitchGeometry, project, scaleAt } from './geometry';
import { PITCH_MOTION, PITCH_SIZE, PITCH_VIEW } from './motion';

/*
 * The tilted pitch (partida-campo-v2.md, 3 and 13, "Vitest, geometria"): the corners, depth,
 * straight lines, the minimums, no allocation, the boards.
 */

const SIZES: readonly (readonly [number, number])[] = [
  [360, 240],
  [397, 265],
  [600, 400],
  [297, 198],
];
const M = PITCH_SIZE.margin;
const L = PITCH_SIZE.length;
const W = PITCH_SIZE.width;

describe('project', () => {
  it('puts the four corners of the drawing where the spec says (0.5px)', () => {
    for (const [w, h] of SIZES) {
      const g = pitchGeometry(w, h, 1);
      const p = new Float64Array(3);
      const far = h * (1 - PITCH_VIEW.grassShare);
      const corners: [number, number, number, number][] = [
        [-M, W + M, 0, h],
        [L + M, W + M, w, h],
        [-M, -M, (w * (1 - PITCH_VIEW.farScale)) / 2, far],
        [L + M, -M, (w * (1 + PITCH_VIEW.farScale)) / 2, far],
      ];
      for (const [x, y, ex, ey] of corners) {
        project(g, x, y, p);
        expect(Math.abs(p[0]! - ex), `${w}x${h} x`).toBeLessThan(0.5);
        expect(Math.abs(p[1]! - ey), `${w}x${h} y`).toBeLessThan(0.5);
      }
    }
  });

  it('is monotonic in depth, and the scale grows toward the viewer', () => {
    const g = pitchGeometry(360, 240, 1);
    const p = new Float64Array(3);
    let sy = -Infinity;
    let k = 0;
    for (let y = -M; y <= W + M; y += 1) {
      project(g, 50, y, p);
      expect(p[1]!).toBeGreaterThan(sy);
      expect(p[2]!).toBeGreaterThan(k);
      expect(scaleAt(g, y)).toBeCloseTo(p[2]!, 9);
      sy = p[1]!;
      k = p[2]!;
    }
  });

  it('keeps straight lines straight', () => {
    for (const [w, h] of SIZES) {
      const g = pitchGeometry(w, h, 1);
      const a = new Float64Array(3);
      const b = new Float64Array(3);
      const c = new Float64Array(3);
      const lines: [number, number, number, number, number, number][] = [
        [0, 0, 52, 30, 105, 68],
        [10, 60, 40, 30, 80, 2],
        [105, 0, 60, 34, 0, 68],
      ];
      for (const [x0, y0, x1, , x2, y2] of lines) {
        // The middle point on the segment of the first and the last, in the scene.
        const t = (x1 - x0) / (x2 - x0);
        const mid = y0 + (y2 - y0) * t;
        project(g, x0, y0, a);
        project(g, x1, mid, b);
        project(g, x2, y2, c);
        const cross = (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!);
        expect(Math.abs(cross) / Math.hypot(c[0]! - a[0]!, c[1]! - a[1]!)).toBeLessThan(0.5);
      }
    }
  });

  it('never gives a disc under 7px CSS or a ball under 4px CSS of radius', () => {
    for (const dpr of [1, 2]) {
      for (const [w, h] of SIZES) {
        const g = pitchGeometry(w * dpr, h * dpr, dpr);
        for (let y = -M; y <= W + M; y += 2) {
          const k = scaleAt(g, y);
          expect(discRadius(g, k)).toBeGreaterThanOrEqual(7 * dpr);
          expect(ballRadius(g, k)).toBeGreaterThanOrEqual(4 * dpr);
        }
      }
    }
  });

  it('allocates nothing: it writes into the array it is given', () => {
    const g = pitchGeometry(360, 240, 1);
    const out = new Float64Array(3);
    const again = new Float64Array(3);
    project(g, 12, 34, out);
    project(g, 12, 34, again);
    expect([...out]).toEqual([...again]);
    expect(project(g, 1, 1, out)).toBeUndefined();
  });
});

describe('holdBall: the ball stays whole inside the trapezoid', () => {
  const BEYOND = Math.max(PITCH_MOTION.goal.depth, PITCH_MOTION.wide.out);
  const EXTREMES: readonly (readonly [number, number])[] = [
    [-BEYOND, W / 2],
    [L + BEYOND, W / 2],
    [-BEYOND, 0],
    [L + BEYOND, W],
    [-BEYOND, W],
    [L + BEYOND, 0],
  ];
  for (const dpr of [1, 2]) {
    for (const [w, h] of [...SIZES, [180, 120] as const]) {
      it(`at ${w}x${h} (density ${dpr})`, () => {
        const g = pitchGeometry(w * dpr, h * dpr, dpr);
        const p = new Float64Array(3);
        const held = new Float64Array(2);
        for (const [x, y] of EXTREMES) {
          project(g, x, y, p);
          const r = ballRadius(g, p[2]!);
          holdBall(g, p[0]!, p[1]!, r, held);
          expect(held[0]! - r).toBeGreaterThanOrEqual(-1e-9);
          expect(held[0]! + r).toBeLessThanOrEqual(g.width + 1e-9);
          expect(held[1]! - r).toBeGreaterThanOrEqual(g.yFar - 1e-9);
          expect(held[1]! + r).toBeLessThanOrEqual(g.height + 1e-9);
        }
      });
    }
  }
});

describe('the boards', () => {
  for (const [w, h] of SIZES) {
    it(`never reach the grass of the drawing (${w}x${h})`, () => {
      const g = pitchGeometry(w, h, 1);
      const out = new Float64Array(8);
      const p = new Float64Array(3);
      const half = (y: number) => {
        // Half width of the trapezoid at canvas y.
        const t = g.farScale + ((y - g.yFar) / (g.height - g.yFar)) * (1 - g.farScale);
        return (g.width / 2) * t;
      };
      for (const side of [0, 1] as const) {
        for (let i = 0; i < 6; i++) {
          goalBoard(g, side, i, out);
          for (let v = 0; v < 4; v++) {
            const x = out[v * 2]!;
            const y = out[v * 2 + 1]!;
            const inside = y >= g.yFar - 1e-9 && Math.abs(x - g.width / 2) < half(y) - 1e-6;
            expect(inside, `side ${side} board ${i} vertex ${v}`).toBe(false);
          }
        }
      }
      void p;
      for (let i = 0; i < FAR_BOARDS; i++) {
        farBoard(g, i, out);
        expect(out[1]!).toBeGreaterThan(out[0]!);
      }
      expect(g.boardTop + g.boardHeight).toBeCloseTo(g.yFar, 9);
      expect(g.boardTop).toBeLessThan(g.yFar);
    });
  }
});
