import { PITCH_SIZE } from './motion';

/*
 * The sizes of the 2D pitch in canvas pixels (docs/design/telas/partida.md, "Desenho" and
 * "Tamanhos"; design-system.md, "Campo da partida"): the drawing is 111 × 74 m (the pitch and its
 * strip of grass), the disc 5.5 m, the ball 2.5 m and never under 8px CSS. Computed once per size
 * of the canvas by the MatchPitch, never per frame.
 */

const LENGTH = PITCH_SIZE.length + 2 * PITCH_SIZE.margin;
const DISC = 5.5;
const BALL = 2.5;
const BALL_MIN_PX = 8;

export interface PitchGeometry {
  /** Canvas pixels per metre. */
  readonly scale: number;
  readonly discRadius: number;
  readonly ballRadius: number;
  /** Where the centre of the ball may be, so it is always whole in the canvas. */
  readonly ballMinX: number;
  readonly ballMaxX: number;
  readonly ballMinY: number;
  readonly ballMaxY: number;
}

/** The sizes for a canvas of `width` × `height` pixels at `dpr` pixels per CSS pixel. */
export function pitchGeometry(width: number, height: number, dpr: number): PitchGeometry {
  const scale = width / LENGTH;
  const ballRadius = Math.max((BALL / 2) * scale, (BALL_MIN_PX / 2) * dpr);
  return {
    scale,
    discRadius: (DISC / 2) * scale,
    ballRadius,
    ballMinX: ballRadius,
    ballMaxX: width - ballRadius,
    ballMinY: ballRadius,
    ballMaxY: height - ballRadius,
  };
}

/** A coordinate of the ball's centre held inside `[low, high]` (no allocation). */
export const clampBall = (value: number, low: number, high: number): number =>
  value < low ? low : value > high ? high : value;
