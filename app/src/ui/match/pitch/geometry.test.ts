import { describe, expect, it } from 'vitest';
import { clampBall, pitchGeometry } from './geometry';
import { PITCH_MOTION, PITCH_SIZE } from './motion';

/*
 * The ball always whole in the canvas (partida.md, "Tamanhos": the ball never under 8px), down to
 * the smallest pitch the screen draws, 180 × 120 CSS px (the least height, 120px, at 1.5:1).
 */

const M = PITCH_SIZE.margin;
/** The furthest the choreography takes the ball past each goal line: in the net or wide. */
const BEYOND = Math.max(PITCH_MOTION.goal.depth, PITCH_MOTION.wide.out);
const EXTREMES: readonly (readonly [number, number])[] = [
  [-BEYOND, PITCH_SIZE.width / 2],
  [PITCH_SIZE.length + BEYOND, PITCH_SIZE.width / 2],
  [-BEYOND, 0],
  [PITCH_SIZE.length + BEYOND, PITCH_SIZE.width],
];

/** The ball's circle in canvas pixels, with the centre held as the MatchPitch holds it. */
function circle(width: number, height: number, dpr: number, [x, y]: readonly [number, number]) {
  const g = pitchGeometry(width, height, dpr);
  return {
    g,
    raw: (x + M) * g.scale,
    cx: clampBall((x + M) * g.scale, g.ballMinX, g.ballMaxX),
    cy: clampBall((y + M) * g.scale, g.ballMinY, g.ballMaxY),
  };
}

describe('pitchGeometry: the ball stays whole in the canvas', () => {
  for (const dpr of [1, 2]) {
    it(`at the smallest pitch (180 × 120 CSS px, density ${dpr}) the 8px ball is held inside`, () => {
      const [width, height] = [180 * dpr, 120 * dpr];
      let held = 0;
      for (const point of EXTREMES) {
        const { g, raw, cx, cy } = circle(width, height, dpr, point);
        expect(g.ballRadius).toBe(4 * dpr);
        expect(cx - g.ballRadius).toBeGreaterThanOrEqual(0);
        expect(cx + g.ballRadius).toBeLessThanOrEqual(width);
        expect(cy - g.ballRadius).toBeGreaterThanOrEqual(0);
        expect(cy + g.ballRadius).toBeLessThanOrEqual(height);
        // Without the limit the ball would be cut here (about 1.6px at density 1).
        if (raw - g.ballRadius < 0 || raw + g.ballRadius > width) held++;
      }
      expect(held).toBeGreaterThan(0);
    });
  }

  it('at 360 CSS px (density 2) the choreography never needs the limit', () => {
    for (const point of EXTREMES) {
      const { raw, cx } = circle(720, 480, 2, point);
      expect(cx).toBe(raw);
    }
  });

  it('a 2.5 m ball once the pitch is big enough, never under 8px CSS', () => {
    const big = pitchGeometry(1200, 800, 2);
    expect(big.ballRadius).toBeCloseTo((2.5 / 2) * big.scale, 9);
    expect(pitchGeometry(222, 148, 1).ballRadius).toBe(4);
    expect(big.discRadius).toBeCloseTo((5.5 / 2) * big.scale, 9);
  });
});
