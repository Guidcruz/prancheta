import { brandForSlot, type FictionalBrand, type SlotContext } from '../../../lib/brands';
import { project, scaleAt, type PitchGeometry } from './geometry';
import { PITCH_SIZE } from './motion';

/*
 * The background of the tilted pitch (docs/design/telas/partida-campo-v2.md, 3 and 4): the stands,
 * the low wall, the three rows of boards (only the colours of fictional brands, no text: ADR-0015),
 * the grass, the markings and the goals. Drawn once into a canvas out of the page, again only when
 * the size or the theme changes; every colour of the stands comes from a token.
 */

/** The colours (tokens read at run time) the background is drawn with. */
export interface BackdropColors {
  readonly surface0: string;
  readonly surface1: string;
  readonly surface2: string;
  readonly line: string;
  readonly floodlight: string;
  readonly beam: string;
  readonly pitch: string;
  readonly pitchLine: string;
  /** The night theme lights the floodlights; by day they are off. */
  readonly night: boolean;
}

const L = PITCH_SIZE.length;
const W = PITCH_SIZE.width;
const M = PITCH_SIZE.margin;
const TAU = Math.PI * 2;
/** The boards behind the goals: where they stand (1.5 m outside the strip of grass), how many. */
const GOAL_BOARDS = { left: -4.5, right: L + 4.5, count: 6, gap: 0.6, from: -M, to: W + M };
/** The boards of the far side. */
export const FAR_BOARDS = 7;

/** The canvas x of the left and right ends of far board `i` (a row centred, 1 CSS px apart). */
export function farBoard(g: PitchGeometry, i: number, out: Float64Array): void {
  const gap = g.dpr;
  const total = g.width * g.farScale;
  const each = (total - gap * (FAR_BOARDS - 1)) / FAR_BOARDS;
  const x0 = (g.width - total) / 2 + i * (each + gap);
  out[0] = x0;
  out[1] = x0 + each;
}

/**
 * The four vertices of board `i` behind a goal (`side` 0 left, 1 right), written into `out` as
 * x, y pairs: base near end, base far end... in the order base0, base1, top1, top0 (0 is the end at
 * the top touchline). The base follows the projected line; the sides are vertical.
 */
export function goalBoard(g: PitchGeometry, side: 0 | 1, i: number, out: Float64Array): void {
  const x = side === 0 ? GOAL_BOARDS.left : GOAL_BOARDS.right;
  const each =
    (GOAL_BOARDS.to - GOAL_BOARDS.from - GOAL_BOARDS.gap * (GOAL_BOARDS.count - 1)) /
    GOAL_BOARDS.count;
  const y0 = GOAL_BOARDS.from + i * (each + GOAL_BOARDS.gap);
  const y1 = y0 + each;
  // The far height of a board, in metres, times the scale of each end.
  const metres = g.boardHeight / (g.s0 * g.farScale);
  const p = new Float64Array(3);
  project(g, x, y0, p);
  out[0] = p[0]!;
  out[1] = p[1]!;
  out[6] = p[0]!;
  out[7] = p[1]! - metres * scaleAt(g, y0);
  project(g, x, y1, p);
  out[2] = p[0]!;
  out[3] = p[1]!;
  out[4] = p[0]!;
  out[5] = p[1]! - metres * scaleAt(g, y1);
}

type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** A board as a quadrilateral: the fill, then the stripe of the mark, with a 1px outline. */
function board(
  ctx: Context,
  ax: number,
  ay: number,
  ah: number,
  bx: number,
  by: number,
  bh: number,
  brand: FictionalBrand,
  outline: string,
  px: number,
): void {
  const at = (t: number, lo: number, hi: number, out: number[]) => {
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    const h = ah + (bh - ah) * t;
    out.push(x, y - h * lo, x, y - h * hi);
  };
  ctx.fillStyle = brand.colors[0];
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx, by - bh);
  ctx.lineTo(ax, ay - ah);
  ctx.closePath();
  ctx.fill();
  // The central stripe: 60% of the width, 26% of the height.
  const left: number[] = [];
  const right: number[] = [];
  at(0.2, 0.37, 0.63, left);
  at(0.8, 0.37, 0.63, right);
  ctx.fillStyle = brand.colors[1];
  ctx.beginPath();
  ctx.moveTo(left[0]!, left[1]!);
  ctx.lineTo(right[0]!, right[1]!);
  ctx.lineTo(right[2]!, right[3]!);
  ctx.lineTo(left[2]!, left[3]!);
  ctx.closePath();
  ctx.fill();
  // A 1px outline in `line`: the darkest boards stay apart from the stand (lot of brands, 3:1).
  ctx.lineWidth = px;
  ctx.strokeStyle = outline;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx, by - bh);
  ctx.lineTo(ax, ay - ah);
  ctx.closePath();
  ctx.stroke();
}

/** The brand of board `index`; never the same as the one before it in its row. */
function brandAt(context: SlotContext, index: number, before: FictionalBrand | undefined) {
  let n = 0;
  let brand = brandForSlot('pitch-boards', { ...context, index });
  while (brand === before && n < 8)
    brand = brandForSlot('pitch-boards', { ...context, index: index + 100 * ++n });
  return brand;
}

/** Everything behind the discs, drawn into `ctx` at the size of `g`. */
export function drawBackdrop(
  ctx: Context,
  g: PitchGeometry,
  c: BackdropColors,
  boards: SlotContext,
): void {
  const { width: Wc, height: Hc } = g;
  const q = Wc / 360;
  const px = g.dpr;
  const out = new Float64Array(8);
  const p = new Float64Array(3);

  // An opaque base, so no pixel of the background is half transparent where two areas meet at a
  // fraction of a pixel (the frame is drawn over the previous one without clearing it).
  ctx.fillStyle = c.surface0;
  ctx.fillRect(0, 0, Wc, Hc);

  // The far stand: from the top of the box to the top of the boards.
  const stand = ctx.createLinearGradient(0, 0, 0, g.boardTop);
  stand.addColorStop(0, c.surface0);
  stand.addColorStop(1, c.surface2);
  ctx.fillStyle = stand;
  ctx.fillRect(0, 0, Wc, g.boardTop);
  // Rows of seats: 6px apart at the bottom to 3px at the top, from 30% to 90% opaque.
  ctx.strokeStyle = c.line;
  ctx.lineWidth = px;
  const roof = 10 * q;
  let y = g.boardTop - 3 * q;
  for (let step = 6 * q; y > roof; step = Math.max(3 * q, step - 0.4 * q)) {
    const t = Math.min(1, Math.max(0, (g.boardTop - y) / Math.max(1, g.boardTop - roof)));
    ctx.globalAlpha = 0.3 + 0.6 * t;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(Wc, y);
    ctx.stroke();
    y -= step;
  }
  ctx.globalAlpha = 1;
  // The roof and the four floodlights.
  ctx.fillStyle = c.surface0;
  ctx.fillRect(0, 0, Wc, roof);
  for (const share of [0.12, 0.37, 0.63, 0.88]) {
    const x = Wc * share;
    const top = 5 * q;
    if (c.night) {
      const halo = ctx.createRadialGradient(x, top, 0, x, top, 52 * q);
      // The beam holds to 35% of the radius and is zero at 75% (so the first lamp stays off the
      // corner pixel); it is laid twice, which gives the strength of the prototype.
      halo.addColorStop(0, c.beam);
      halo.addColorStop(0.35, c.beam);
      halo.addColorStop(0.75, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      for (let pass = 0; pass < 2; pass++) ctx.fillRect(x - 52 * q, 0, 104 * q, top + 52 * q);
    }
    ctx.fillStyle = c.night ? c.floodlight : c.line;
    ctx.fillRect(x - 9 * q, top, 18 * q, 3 * q);
  }

  // The low wall, and the grass under it, edge to edge.
  ctx.fillStyle = c.surface1;
  ctx.fillRect(0, g.boardTop, Wc, g.yFar - g.boardTop);
  ctx.fillStyle = c.pitch;
  ctx.fillRect(0, g.yFar, Wc, Hc - g.yFar);

  // The stands behind the goals, outside each row of boards.
  for (const side of [0, 1] as const) {
    goalBoard(g, side, 0, out);
    const farTopX = out[6]!;
    const farTopY = out[7]!;
    goalBoard(g, side, GOAL_BOARDS.count - 1, out);
    const nearTopX = out[4]!;
    const nearTopY = out[5]!;
    const nearBaseX = out[2]!;
    const edge = side === 0 ? 0 : Wc;
    const back = ctx.createLinearGradient(0, g.boardTop, 0, Hc);
    back.addColorStop(0, c.surface2);
    back.addColorStop(1, c.surface0);
    ctx.fillStyle = back;
    ctx.beginPath();
    ctx.moveTo(edge, g.boardTop);
    ctx.lineTo(farTopX, farTopY);
    ctx.lineTo(nearTopX, nearTopY);
    ctx.lineTo(nearBaseX, Hc);
    ctx.lineTo(edge, Hc);
    ctx.closePath();
    ctx.fill();
  }

  // The three rows of boards: colours only, no text (the lot of fictional brands).
  let before: FictionalBrand | undefined;
  for (let i = 0; i < FAR_BOARDS; i++) {
    const brand = brandAt(boards, i, before);
    before = brand;
    farBoard(g, i, out);
    board(ctx, out[0]!, g.yFar, g.boardHeight, out[1]!, g.yFar, g.boardHeight, brand, c.line, px);
  }
  for (const side of [0, 1] as const) {
    before = undefined;
    for (let i = 0; i < GOAL_BOARDS.count; i++) {
      const brand = brandAt(boards, FAR_BOARDS + side * GOAL_BOARDS.count + i, before);
      before = brand;
      goalBoard(g, side, i, out);
      const h0 = out[1]! - out[7]!;
      const h1 = out[3]! - out[5]!;
      board(ctx, out[0]!, out[1]!, h0, out[2]!, out[3]!, h1, brand, c.line, px);
    }
  }

  // The markings, projected vertex by vertex, in `pitch-line`.
  ctx.strokeStyle = c.pitchLine;
  ctx.fillStyle = c.pitchLine;
  const stroke = Math.max(1, Wc / px / 360) * px;
  ctx.lineWidth = stroke;
  ctx.lineJoin = 'round';
  const moveTo = (x: number, yy: number) => {
    project(g, x, yy, p);
    ctx.moveTo(p[0]!, p[1]!);
  };
  const lineTo = (x: number, yy: number) => {
    project(g, x, yy, p);
    ctx.lineTo(p[0]!, p[1]!);
  };
  const rect = (x: number, yy: number, w: number, h: number) => {
    ctx.beginPath();
    moveTo(x, yy);
    lineTo(x + w, yy);
    lineTo(x + w, yy + h);
    lineTo(x, yy + h);
    ctx.closePath();
    ctx.stroke();
  };
  const arc = (cx: number, cy: number, r: number, from: number, to: number) => {
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = from + ((to - from) * i) / 48;
      const x = cx + r * Math.cos(a);
      const yy = cy + r * Math.sin(a);
      if (i === 0) moveTo(x, yy);
      else lineTo(x, yy);
    }
    ctx.stroke();
  };
  const spot = (x: number, yy: number) => {
    project(g, x, yy, p);
    ctx.beginPath();
    ctx.ellipse(
      p[0]!,
      p[1]!,
      Math.max(stroke, 0.25 * p[2]!),
      Math.max(stroke, 0.25 * p[2]!) * 0.6,
      0,
      0,
      TAU,
    );
    ctx.fill();
  };
  const cy = W / 2;
  rect(0, 0, L, W);
  ctx.beginPath();
  moveTo(L / 2, 0);
  lineTo(L / 2, W);
  ctx.stroke();
  arc(L / 2, cy, 9.15, 0, TAU);
  spot(L / 2, cy);
  for (const side of [0, 1] as const) {
    const line = side === 0 ? 0 : L;
    const dir = side === 0 ? 1 : -1;
    rect(side === 0 ? 0 : L - 16.5, cy - 20.15, 16.5, 40.3);
    rect(side === 0 ? 0 : L - 5.5, cy - 9.15, 5.5, 18.3);
    spot(line + dir * 11, cy);
    const open = Math.acos((16.5 - 11) / 9.15);
    if (side === 0) arc(11, cy, 9.15, -open, open);
    else arc(L - 11, cy, 9.15, Math.PI - open, Math.PI + open);
    // The goal: the net on the ground, and the posts and bar standing (2.44 m).
    rect(side === 0 ? -2 : L, cy - 3.66, 2, 7.32);
    ctx.lineWidth = 2 * px;
    ctx.beginPath();
    for (const post of [cy - 3.66, cy + 3.66]) {
      project(g, line, post, p);
      ctx.moveTo(p[0]!, p[1]!);
      ctx.lineTo(p[0]!, p[1]! - 2.44 * p[2]!);
    }
    project(g, line, cy - 3.66, p);
    ctx.moveTo(p[0]!, p[1]! - 2.44 * p[2]!);
    project(g, line, cy + 3.66, p);
    ctx.lineTo(p[0]!, p[1]! - 2.44 * p[2]!);
    ctx.stroke();
    ctx.lineWidth = stroke;
  }
}
