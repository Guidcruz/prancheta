/*
 * The numbers of the decorative choreography of the 2D pitch (docs/design/telas/partida.md,
 * "Campo 2D (T-085)", "Coreografia (decorativa), por passo" and "Câmera lenta"). The rules are the
 * spec's; these values may be tuned by eye without changing them. Everything in metres, on the
 * pitch of 105 × 68 (x from the home goal line, y from the top touchline).
 */

/** The pitch of play and the strip of grass around it, in metres. */
export const PITCH_SIZE = {
  length: 105,
  width: 68,
  /** The strip of grass around the pitch (the drawing is 111 × 74). */
  margin: 3,
} as const;

export const PITCH_MOTION = {
  /** Where the formation sits: the keeper 4 m off the line, the most advanced line 46 m ahead. */
  formation: { keeper: 4, depth: 46 },
  /** A minute with nothing shown: the ball walks to a point of the midfield, at most 20 m away. */
  minute: { x: [35, 70], y: [10, 58], maxStep: 20 },
  /** How much of the ball's distance to the centre the blocks follow (the keeper less). */
  follow: { length: 0.35, width: 0.2, keeper: 0.1 },
  /** The point of a play, from the goal it attacks, and across. */
  open: { distance: [11, 30], y: [20, 48] },
  freeKick: { distance: [20, 28], y: [16, 52] },
  weak: { distance: [25, 35], y: [14, 54] },
  /** The finisher waits this far behind the ball until the slow motion. */
  behind: 1.5,
  /** The penalty: the spot, the taker behind it, the area the others leave (and how far out). */
  penalty: { spot: 11, behind: 2, areaDepth: 16.5, areaWidth: 40.3, clear: 1 },
  /** The outcomes, from the goal line. */
  goal: { depth: 1.5, y: [31, 37] },
  save: { y: [30.5, 37.5], off: 1 },
  post: { halfGoal: 3.66, bounce: 6 },
  wide: { inside: [29, 39], spread: 7, out: 2 },
  /** A player leaving goes this far past the nearest touchline. */
  leave: 1.5,
  /** Slow motion: the second half of the time at 40% of the speed (v = 1 / 0.7). */
  slow: 0.4,
} as const;
