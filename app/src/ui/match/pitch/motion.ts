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
  /**
   * The room the ball keeps from the edge of the drawing, in metres, so it is whole in the strip
   * of grass (the MatchPitch also holds its centre inside the trapezoid, `holdBall`).
   */
  ballRoom: 1.5,
} as const;

/**
 * The view of the tilted pitch (docs/design/telas/partida-campo-v2.md, 3; ADR-0023): a fixed
 * camera on the axis of the halfway line. May be tuned by eye on the device, without changing the
 * rules.
 */
export const PITCH_VIEW = {
  /** Width of the far edge of the drawing over the width of the near edge. */
  farScale: 0.68,
  /** The share of the box height taken by the grass (the rest is the stand). */
  grassShare: 0.62,
  /** Height of the far boards in CSS px at a box 360px wide (proportional to the width). */
  boardHeight: 12,
  /** The least radius of a disc and of the ball, in CSS px. */
  discMin: 7,
  ballMin: 4,
} as const;

/**
 * Where the top of the far boards falls in a box of 1.5:1, as a share of its height (33%):
 * `1 − grassShare − boardHeight × 1.5 ÷ 360`. The MatchPitch and the MatchScreen read it for the
 * CSS variable `--pitch-stand-end`, so the stand painted around the canvas ends where the drawing's
 * does; change `grassShare` or `boardHeight` here and both follow.
 */
export const PITCH_STAND_END = `${(
  (1 - PITCH_VIEW.grassShare - (PITCH_VIEW.boardHeight * 1.5) / 360) *
  100
).toFixed(2)}%`;

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
  /**
   * Where a disc of a play appears (partida-campo-v2.md, 5): the finisher of a play of the open
   * game 6 m from the point, on the side of his own goal; a taker 2 m behind the ball; the sent-off
   * 3 m from the ball, and the share of the step a disc takes to fade in or out.
   */
  appear: { open: 6, setPiece: 2, sentOff: 3, fade: 0.3 },
  /** The penalty: the spot, the taker behind it, the area the others leave (and how far out). */
  penalty: { spot: 11, behind: 2, areaDepth: 16.5, areaWidth: 40.3, clear: 1 },
  /** The outcomes, from the goal line. */
  goal: { depth: 1.5, y: [31, 37] },
  save: { y: [30.5, 37.5], off: 1 },
  post: { halfGoal: 3.66, bounce: 6 },
  /**
   * Wide: beside the goal, and into the strip of grass no further than `PITCH_SIZE.ballRoom` from
   * the edge (3 m − 1.5 m). The MatchPitch holds the ball inside the trapezoid (`geometry.ts`).
   */
  wide: { inside: [29, 39], spread: 7, out: 1.5 },
  /** A player leaving goes this far past the nearest touchline. */
  leave: 1.5,
  /** Slow motion: the second half of the time at 40% of the speed (v = 1 / 0.7). */
  slow: 0.4,
} as const;
