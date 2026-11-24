import {
  Rng,
  seedFromString,
  type Formation,
  type MatchEvent,
  ATTRIBUTE_RANGE,
  type Player,
  type PlayerId,
  type Side,
} from '@engine';
import type { MatchSpeed } from '@lib/career';
import { PITCH_LAYOUT } from '../../components/pitch-layout';
import type { MatchStep } from '../steps';
import { MATCH_TIMING, type TimingKey } from '../timing';
import { PITCH_MOTION as M, PITCH_SIZE } from './motion';

/*
 * The scene of the 2D pitch at each instant, as pure functions (docs/design/telas/partida.md,
 * "Campo 2D (T-085)": "Posições da formação", "Cena por instante", "Coreografia" and "Câmera
 * lenta"). No DOM, no clock: the screen gives the step and its progress, the MatchPitch draws.
 *
 * - `choreograph` builds, once per match, the motion of every step of the clock: the 22 discs and
 *   the ball, from where the previous step left them (nothing jumps), in metres.
 * - `sceneAt` writes the instant `progress` (0 to 1) of a step into the same `out` object, with no
 *   allocation per frame; `stillScene` is the one frame of a step with reduced motion.
 *
 * The positions are decorative and never decide anything. Every draw uses its own seed,
 * `${seed}-pitch-${label}`, with one label per draw (`m${slot}` in a minute with nothing shown,
 * `${line}-build` at the start of a play and `${line}-outcome` at its outcome), so the same match
 * always draws the same. The start of a play reads only the side, the finisher and the kind of the
 * play, never the type of the event, the score or the assist: the start of a goal and the start of
 * a chance of the same kind, side and player are the same frame by frame. The outcome is drawn only
 * in the step that reveals it.
 *
 * "Only the ball" (partida-campo-v2.md, 5; campo-lances.md, 10): in a minute with nothing shown no
 * disc is drawn. The discs appear only in the plays of the engine, each made for the `PlayerId` of
 * the event (the finisher, the taker, the scorer, the sent-off) and for the keeper who defends,
 * fading in over the first 30% of the step they appear in and out over the first 30% of the next.
 *
 * The home side is always on the left, attacking to the right, the whole match. Discs 0 to 10 are
 * the home side's and 11 to 21 the visitor's, the keeper first, in the order of the slots of the
 * formation; a substitute takes the disc of the player who left.
 */

/** Discs on the pitch: 11 a side. */
export const DISCS = 22;
/** The numbers of a pose: x and y of the 22 discs, then x and y of the ball. */
const POSE = DISCS * 2 + 2;
const BALL = DISCS * 2;
const CENTRE_X = PITCH_SIZE.length / 2;
const CENTRE_Y = PITCH_SIZE.width / 2;
/** The fraction of the advance at the end of the first half of the time, with slow motion. */
const SLOW_SPLIT = slowMotion(0.5);

/**
 * The `physical` of a player as the engine reads it (`attributeOf`, which the ui may not import:
 * it is of the tools API): his own value, or 40% of `overall` rounded and held in range.
 * `src/data/pitch-physical.test.ts` keeps the two equal.
 */
export function physicalOf(player: Pick<Player, 'attributes' | 'overall'>): number {
  const own = player.attributes.physical;
  if (own !== undefined) return own;
  const rounded = Math.floor((4 * player.overall + 5) / 10);
  return Math.min(ATTRIBUTE_RANGE.max, Math.max(ATTRIBUTE_RANGE.min, rounded));
}

/** The formation and the 11 of one side, as the match starts (`TeamSheet.lineup`). */
export interface PitchLineup {
  readonly formation: Formation;
  readonly starters: readonly PlayerId[];
  /**
   * The squad of the side: the choreography needs the `physical` of the players on the pitch to
   * follow the engine when a keeper leaves with no substitution (`fillEmptyGoal`).
   */
  readonly players: readonly Pick<Player, 'id' | 'attributes' | 'overall'>[];
}

/** What the MatchPitch draws at one instant; written in place by {@link sceneAt}. */
export interface PitchScene {
  /** Metres from the home goal line, of each disc. */
  readonly x: Float64Array;
  /** Metres from the top touchline, of each disc. */
  readonly y: Float64Array;
  /** 1: the disc is on the pitch. */
  readonly on: Uint8Array;
  /** 0 to 1: how much of each disc is drawn (0 for the discs not in a play of the engine). */
  readonly alpha: Float64Array;
  ballX: number;
  ballY: number;
}

/** `ease`: cubic in-out; `linear`: the advance itself (slow motion steps); `hold`: no change. */
type Curve = 'ease' | 'linear';

interface Segment {
  /** The advance where the segment ends, in Normal and in Rápido. */
  readonly end: number;
  readonly endFast: number;
  readonly curve: Curve;
  /** The pose at its end. */
  readonly pose: Float64Array;
}

interface StepMotion {
  readonly from: Float64Array;
  readonly segments: readonly Segment[];
  /** The step is a dramatic pause: time becomes advance by the slow-motion curve. */
  readonly slow: boolean;
  /** Who is on the pitch during the step and at its end (a disc leaving goes at the end). */
  readonly on: Uint8Array;
  readonly onEnd: Uint8Array;
  /** The one frame with reduced motion: where the step leaves the discs and the ball. */
  readonly still: Float64Array;
  /** The discs of a play of the engine drawn in this step, and in the one before it. */
  readonly show: Uint8Array;
  readonly showPrev: Uint8Array;
  /** Discs that stay on the pitch (a keeper's) but are gone from sight at the end of the step. */
  readonly gone: Uint8Array;
  /** Who owns each disc as the step starts (the anchor of the discs of a play, for the tests). */
  readonly owner: readonly (PlayerId | null)[];
  /**
   * The disc the tag of this step hangs from: the one made for the `PlayerId` of the event (the
   * finisher, the taker, the scorer or the sent-off), or -1 when there is none (no tag in the
   * step, or the player is not on the pitch: then no tag either, never another's disc).
   */
  readonly tag: number;
}

/** The motion of every step of a match. */
export interface Choreography {
  readonly steps: readonly StepMotion[];
  /**
   * The players of an event who are not on the pitch (a damaged save only): no disc was made for
   * them, and the caller records it as a programming error.
   */
  readonly unknown: readonly PlayerId[];
}

/** A scene to be filled by {@link sceneAt}; one per pitch, reused for every frame. */
export function createScene(): PitchScene {
  return {
    x: new Float64Array(DISCS),
    y: new Float64Array(DISCS),
    on: new Uint8Array(DISCS),
    alpha: new Float64Array(DISCS),
    ballX: CENTRE_X,
    ballY: CENTRE_Y,
  };
}

/**
 * Slow motion (partida.md, "Câmera lenta"): time `t` (0 to 1) of a dramatic pause becomes the
 * advance of the motion, at speed `v = 1 / 0.7` in the first half of the time and `0.4 v` in the
 * second: the last 600 ms of the 1.2 s in Normal, the last 250 ms of the 0.5 s in Rápido.
 */
export function slowMotion(t: number): number {
  const v = 1 / (0.5 + M.slow * 0.5);
  return t <= 0.5 ? t * v : (0.5 + M.slow * (t - 0.5)) * v;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (2 - 2 * t) ** 3 / 2);
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
/** Exact at both ends, so a step starts exactly where the previous one ended. */
const lerp = (a: number, b: number, w: number) => (w <= 0 ? a : w >= 1 ? b : a + (b - a) * w);

/** Where slot `slot` of `formation` stands for `side` (partida.md, "Posições da formação"). */
export function formationSpot(
  side: Side,
  formation: Formation,
  slot: number,
): readonly [number, number] {
  const cell = PITCH_LAYOUT[formation][slot]!;
  const depth = (9 - cell.row) / 8;
  const x = M.formation.keeper + M.formation.depth * depth;
  const y = (PITCH_SIZE.width * cell.col) / 8;
  return side === 'home' ? [x, y] : [PITCH_SIZE.length - x, PITCH_SIZE.width - y];
}

const sideOf = (disc: number): Side => (disc < 11 ? 'home' : 'away');
const firstDisc = (side: Side) => (side === 'home' ? 0 : 11);
const other = (side: Side): Side => (side === 'home' ? 'away' : 'home');
/** The x of the goal line `side` attacks, and the direction of its attack. */
const goalLine = (side: Side) => (side === 'home' ? PITCH_SIZE.length : 0);
const attack = (side: Side) => (side === 'home' ? 1 : -1);
const within = (rng: Rng, [low, high]: readonly [number, number]) =>
  low + (high - low) * rng.next();

/** The state the choreography carries from step to step. */
class Field {
  readonly pose = new Float64Array(POSE);
  readonly on = new Uint8Array(DISCS).fill(1);
  readonly owner: (PlayerId | null)[];
  readonly formation: Record<Side, Formation>;

  constructor(lineups: Readonly<Record<Side, PitchLineup>>) {
    this.formation = { home: lineups.home.formation, away: lineups.away.formation };
    this.owner = [...lineups.home.starters, ...lineups.away.starters].slice(0, DISCS);
    while (this.owner.length < DISCS) this.owner.push(null);
    this.toFormation(this.pose);
    this.pose[BALL] = CENTRE_X;
    this.pose[BALL + 1] = CENTRE_Y;
  }

  spot(disc: number): readonly [number, number] {
    const side = sideOf(disc);
    return formationSpot(side, this.formation[side], disc - firstDisc(side));
  }

  /** Every disc on the pitch at the spot of its slot. */
  toFormation(pose: Float64Array): void {
    for (let d = 0; d < DISCS; d++) {
      if (this.on[d] !== 1) continue;
      const [x, y] = this.spot(d);
      pose[d * 2] = x;
      pose[d * 2 + 1] = y;
    }
  }

  /** The blocks follow the ball at `(bx, by)`: a share of its distance to the centre. */
  follow(pose: Float64Array, bx: number, by: number, skip: readonly number[] = []): void {
    for (let d = 0; d < DISCS; d++) {
      if (this.on[d] !== 1 || skip.includes(d)) continue;
      const [x, y] = this.spot(d);
      const keeper = d === 0 || d === 11;
      const along = keeper ? M.follow.keeper : M.follow.length;
      const across = keeper ? M.follow.keeper : M.follow.width;
      pose[d * 2] = x + along * (bx - CENTRE_X);
      pose[d * 2 + 1] = y + across * (by - CENTRE_Y);
    }
  }

  /** The disc of `player` on `side`, or -1 when he is not on the pitch (never another's disc). */
  discOf(side: Side, player: PlayerId): number {
    const first = firstDisc(side);
    for (let d = first; d < first + 11; d++) {
      if (this.on[d] === 1 && this.owner[d] === player) return d;
    }
    return -1;
  }
}

const copy = (pose: Float64Array) => new Float64Array(pose);

function setDisc(pose: Float64Array, disc: number, x: number, y: number): void {
  pose[disc * 2] = x;
  pose[disc * 2 + 1] = y;
}

function setBall(pose: Float64Array, x: number, y: number): void {
  pose[BALL] = x;
  pose[BALL + 1] = y;
}

const segment = (end: number, pose: Float64Array, curve: Curve = 'ease', endFast = end) => ({
  end,
  endFast,
  curve,
  pose,
});

/** The share of an outcome step the ball flies: half of `afterMiss` at the speed. */
function flight(timing: TimingKey): readonly [number, number] {
  const share = (speed: MatchSpeed) =>
    Math.min(1, MATCH_TIMING[speed].afterMiss / 2 / MATCH_TIMING[speed][timing]);
  return [share('normal'), share('fast')];
}

/** The finisher of the start of a play: only what the start may read. */
function finisherOf(event: MatchEvent): PlayerId | undefined {
  if (event.type === 'chance') return event.shooter;
  if (event.type === 'goal') return event.scorer;
  if (event.type === 'penaltyAwarded' || event.type === 'penaltyMissed') return event.taker;
  return undefined;
}

/** How a play ends, read only in the step that reveals it. */
function outcomeOf(event: MatchEvent): 'goal' | 'saved' | 'post' | 'wide' | undefined {
  if (event.type === 'goal') return 'goal';
  if (event.type === 'chance' || event.type === 'penaltyMissed') return event.outcome;
  return undefined;
}

/**
 * The motion of the ball (and of the keeper on a save) from where it is to where an outcome
 * leaves it, as segments: the flight ends at `endAt`, then the ball stays (or comes back from the
 * post up to `restAt`).
 */
function outcomeSegments(
  field: Field,
  from: Float64Array,
  side: Side,
  outcome: 'goal' | 'saved' | 'post' | 'wide',
  rng: Rng,
  endAt: readonly [number, number],
  restAt: readonly [number, number],
): Segment[] {
  const line = goalLine(side);
  const dir = attack(side);
  const flown = copy(from);
  const rest = copy(from);
  if (outcome === 'goal') {
    const y = within(rng, M.goal.y);
    setBall(flown, line + dir * M.goal.depth, y);
    setBall(rest, line + dir * M.goal.depth, y);
  } else if (outcome === 'saved') {
    const y = within(rng, M.save.y);
    const x = line - dir * M.save.off;
    setBall(flown, x, y);
    setBall(rest, x, y);
    const keeper = firstDisc(other(side));
    if (field.on[keeper] === 1) {
      setDisc(flown, keeper, x, y);
      setDisc(rest, keeper, x, y);
    }
  } else if (outcome === 'post') {
    const y = CENTRE_Y + (rng.next() < 0.5 ? -1 : 1) * M.post.halfGoal;
    setBall(flown, line, y);
    setBall(rest, line - dir * M.post.bounce, y);
  } else {
    const below = rng.next() < 0.5;
    const off = M.wide.spread * rng.next();
    const y = below ? M.wide.inside[1] + off : M.wide.inside[0] - off;
    setBall(flown, line + dir * M.wide.out, y);
    setBall(rest, line + dir * M.wide.out, y);
  }
  return [segment(endAt[0], flown, 'ease', endAt[1]), segment(restAt[0], rest, 'ease', restAt[1])];
}

/** The steps of the same minute after `index` substitute `player` of `side` (the injury exits). */
function substitutedSoon(
  steps: readonly MatchStep[],
  index: number,
  side: Side,
  player: PlayerId,
): boolean {
  const slot = steps[index]!.slot;
  for (let k = index + 1; k < steps.length && steps[k]!.slot === slot; k++) {
    const source = steps[k]!.line?.source;
    if (source?.type === 'substitution' && source.side === side && source.out === player) {
      return true;
    }
  }
  return false;
}

/**
 * The motion of every step of `steps` (`matchSteps(events, 'full')`), from the lineups of the
 * kick-off and the match's seed. Pure: the same match always gives the same choreography.
 */
export function choreograph(
  steps: readonly MatchStep[],
  lineups: Readonly<Record<Side, PitchLineup>>,
  seed: number | string,
): Choreography {
  const field = new Field(lineups);
  const rngOf = (label: string) => new Rng(seedFromString(`${seed}-pitch-${label}`));
  const out: StepMotion[] = [];
  const unknown: PlayerId[] = [];
  const squad = new Map<PlayerId, Pick<Player, 'id' | 'attributes' | 'overall'>>();
  for (const side of ['home', 'away'] as const) {
    for (const player of lineups[side].players) squad.set(player.id, player);
  }
  let afterGoal = false;
  let prevShow = new Uint8Array(DISCS);
  /** The disc of the player of an event; none (and a record) when he is not on the pitch. */
  const discFor = (side: Side, player: PlayerId): number => {
    const disc = field.discOf(side, player);
    if (disc === -1) unknown.push(player);
    return disc;
  };

  steps.forEach((step, index) => {
    const from = copy(field.pose);
    const on = new Uint8Array(field.on);
    const show = new Uint8Array(DISCS);
    const gone = new Uint8Array(DISCS);
    const owner = [...field.owner];
    const line = step.line;
    const source = line?.source;
    let segments: Segment[] = [];
    let slow = false;
    /** Discs that leave the pitch at the end of the step. */
    const leaving: number[] = [];
    /** The sent-off disc of a red card, whose player walks to the touchline. */
    let expelled = -1;
    /** The disc of the player the tag of the step names (see `StepMotion.tag`). */
    let tag = -1;

    // The roster first: who leaves, who comes in, the formation.
    if (source !== undefined && line!.stage === 'final') {
      if (source.type === 'substitution') {
        const first = firstDisc(source.side);
        for (let d = first; d < first + 11; d++) {
          if (field.owner[d] === source.out && field.on[d] === 1) field.owner[d] = source.in;
        }
      } else if (
        source.type === 'red' ||
        (source.type === 'injury' && !substitutedSoon(steps, index, source.side, source.player))
      ) {
        const first = firstDisc(source.side);
        let disc = -1;
        for (let d = first; d < first + 11; d++) {
          if (field.on[d] === 1 && field.owner[d] === source.player) disc = d;
        }
        if (source.type === 'red') {
          expelled = disc;
          if (disc === -1) unknown.push(source.player);
        }
        if (disc === first) {
          // The keeper's disc stays (whoever goes in goal wears the keeper's shirt). As the engine
          // does (`fillEmptyGoal`, D5-A of campo-lances.md), the outfield player on the pitch with
          // the highest `physical` goes to goal (a tie keeps the first slot); his disc leaves.
          let best = -1;
          let bestPhysical = -1;
          let last = -1;
          for (let d = first + 1; d < first + 11; d++) {
            if (field.on[d] !== 1) continue;
            last = d;
            const player = squad.get(field.owner[d]!);
            const physical = player === undefined ? -1 : physicalOf(player);
            if (physical > bestPhysical) {
              best = d;
              bestPhysical = physical;
            }
          }
          if (best === -1) best = last;
          if (best !== -1) {
            field.owner[first] = field.owner[best]!;
            field.owner[best] = null;
            leaving.push(best);
          }
        } else if (disc !== -1) {
          field.owner[disc] = null;
          leaving.push(disc);
        }
      } else if (
        source.type === 'tacticChange' &&
        source.formation !== field.formation[source.side]
      ) {
        field.formation[source.side] = source.formation;
        if (!afterGoal) {
          const to = copy(from);
          const first = firstDisc(source.side);
          for (let d = first; d < first + 11; d++) {
            if (field.on[d] !== 1) continue;
            const [x, y] = field.spot(d);
            setDisc(to, d, x, y);
          }
          segments = [segment(1, to)];
        }
      }
    }

    /** The discs that go to the touchline: who leaves and, with a red, the sent-off keeper. */
    const toLine = leaving.slice();
    if (expelled !== -1 && !toLine.includes(expelled)) {
      // A sent-off keeper: his disc stays (the new keeper wears it) but is not seen again.
      toLine.push(expelled);
      gone[expelled] = 1;
    }
    const toTouchline = (pose: Float64Array) => {
      for (const d of toLine) {
        const y = from[d * 2 + 1]! < CENTRE_Y ? -M.leave : PITCH_SIZE.width + M.leave;
        setDisc(pose, d, from[d * 2]!, y);
      }
    };

    if (step.timing === undefined || source?.type === 'fulltime') {
      // The final whistle: nothing moves, and no frame is asked after it.
      segments = [];
    } else if (afterGoal) {
      // After a goal, whatever the step: the new kick-off (formation and the ball at the centre).
      const to = copy(from);
      field.toFormation(to);
      setBall(to, CENTRE_X, CENTRE_Y);
      toTouchline(to);
      // A play or a red card right after a goal wins over the kick-off: its discs fade in as in
      // any play (still at their spots of the formation), while the ball goes back to the centre.
      const event = source as (MatchEvent & { side: Side }) | undefined;
      const player = event === undefined ? undefined : finisherOf(event);
      const play =
        player !== undefined &&
        (line!.stage === 'build' ||
          event!.type === 'penaltyAwarded' ||
          (event!.type === 'chance' && step.timing === 'event'));
      if (play) {
        const disc = discFor(event!.side, player);
        tag = disc;
        const keeper = firstDisc(other(event!.side));
        for (const d of disc === -1 ? [keeper] : [disc, keeper]) {
          if (field.on[d] !== 1) continue;
          show[d] = 1;
          if (prevShow[d] !== 1) setDisc(from, d, to[d * 2]!, to[d * 2 + 1]!);
        }
      } else if (source?.type === 'red' && expelled !== -1) {
        const by = from[BALL + 1]!;
        const y = by < CENTRE_Y ? by - M.appear.sentOff : by + M.appear.sentOff;
        setDisc(from, expelled, from[BALL]!, Math.min(PITCH_SIZE.width, Math.max(0, y)));
        toTouchline(to);
        show[expelled] = 1;
        tag = expelled;
      }
      segments = [segment(1, to)];
    } else if (line === undefined) {
      // A minute with nothing shown: the ball walks the midfield; the blocks follow it.
      const rng = rngOf(`m${step.slot}`);
      const cx = within(rng, M.minute.x);
      const cy = within(rng, M.minute.y);
      const bx = from[BALL]!;
      const by = from[BALL + 1]!;
      const far = Math.hypot(cx - bx, cy - by);
      const share = far > M.minute.maxStep ? M.minute.maxStep / far : 1;
      const tx = bx + (cx - bx) * share;
      const ty = by + (cy - by) * share;
      const to = copy(from);
      field.follow(to, tx, ty);
      setBall(to, tx, ty);
      segments = [segment(1, to)];
    } else if (
      line.stage === 'build' ||
      (source!.type === 'penaltyAwarded' && line.stage === 'final')
    ) {
      // The start of a play: only its side, its finisher and its kind (never its outcome).
      const event = source as MatchEvent & { side: Side };
      const side = event.side;
      const dir = attack(side);
      const goal = goalLine(side);
      const disc = discFor(side, finisherOf(event)!);
      tag = disc;
      const keeper = firstDisc(other(side));
      const reach = copy(from);
      const contact = copy(from);
      // Where the finisher appears (his disc is not in the step before).
      let appear: readonly [number, number] | undefined;
      if (event.type === 'penaltyAwarded') {
        const px = goal - dir * M.penalty.spot;
        const front = goal - dir * M.penalty.areaDepth;
        const top = CENTRE_Y - M.penalty.areaWidth / 2;
        const bottom = CENTRE_Y + M.penalty.areaWidth / 2;
        for (let d = 0; d < DISCS; d++) {
          if (field.on[d] !== 1 || d === disc || d === keeper) continue;
          const x = from[d * 2]!;
          const y = from[d * 2 + 1]!;
          const inside = (x - front) * dir > 0 && y > top && y < bottom;
          if (!inside) continue;
          // Out of the area by the nearest edge.
          const toFront = Math.abs(x - front);
          const toTop = y - top;
          const toBottom = bottom - y;
          const least = Math.min(toFront, toTop, toBottom);
          if (least === toFront) setDisc(reach, d, front - dir * M.penalty.clear, y);
          else if (least === toTop) setDisc(reach, d, x, top - M.penalty.clear);
          else setDisc(reach, d, x, bottom + M.penalty.clear);
        }
        if (field.on[keeper] === 1) setDisc(reach, keeper, goal, CENTRE_Y);
        if (disc !== -1) setDisc(reach, disc, px - dir * M.penalty.behind, CENTRE_Y);
        setBall(reach, px, CENTRE_Y);
        contact.set(reach);
        if (disc !== -1) setDisc(contact, disc, px, CENTRE_Y);
        appear = [px - dir * M.penalty.behind, CENTRE_Y];
      } else {
        const rng = rngOf(`${line.id}-build`);
        const freeKick =
          (event.type === 'chance' || event.type === 'goal') && event.kind === 'freeKick';
        const range = freeKick ? M.freeKick : M.open;
        const px = goal - dir * within(rng, range.distance);
        const py = within(rng, range.y);
        // Behind the ball, on the line from the goal it attacks.
        const gx = px - goal;
        const gy = py - CENTRE_Y;
        const length = Math.hypot(gx, gy) || 1;
        field.follow(reach, px, py, [disc]);
        if (disc !== -1) {
          setDisc(reach, disc, px + (gx / length) * M.behind, py + (gy / length) * M.behind);
        }
        setBall(reach, px, py);
        contact.set(reach);
        if (disc !== -1) setDisc(contact, disc, px, py);
        const away = freeKick ? M.appear.setPiece : M.appear.open;
        appear = [px + (gx / length) * away, py + (gy / length) * away];
      }
      if (disc !== -1) {
        show[disc] = 1;
        if (prevShow[disc] !== 1 && appear !== undefined) setDisc(from, disc, appear[0], appear[1]);
      }
      if (field.on[keeper] === 1) {
        show[keeper] = 1;
        if (prevShow[keeper] !== 1)
          setDisc(from, keeper, reach[keeper * 2]!, reach[keeper * 2 + 1]!);
      }
      slow = step.timing === 'drama';
      const split = slow ? SLOW_SPLIT : 0.5;
      const curve: Curve = slow ? 'linear' : 'ease';
      segments = [segment(split, reach, curve), segment(1, contact, curve)];
    } else if (step.timing === 'afterGoal' || step.timing === 'afterMiss') {
      // The outcome of a play: the ball flies from the point of the play; then it stays.
      const event = source as MatchEvent & { side: Side };
      const rng = rngOf(`${line.id}-outcome`);
      const at = flight(step.timing);
      const shooter = discFor(event.side, finisherOf(event)!);
      tag = shooter;
      if (shooter !== -1) show[shooter] = 1;
      const keeper = firstDisc(other(event.side));
      if (field.on[keeper] === 1) show[keeper] = 1;
      segments = outcomeSegments(field, from, event.side, outcomeOf(event)!, rng, at, [1, 1]);
    } else if (source!.type === 'chance') {
      // A weak chance (no pause): to the point of the play, then the flight, in the same step.
      const event = source as Extract<MatchEvent, { type: 'chance' }>;
      const rng = rngOf(`${line.id}-outcome`);
      const dir = attack(event.side);
      const px = goalLine(event.side) - dir * within(rng, M.weak.distance);
      const py = within(rng, M.weak.y);
      const reach = copy(from);
      const shooter = discFor(event.side, event.shooter);
      tag = shooter;
      field.follow(reach, px, py, [shooter]);
      if (shooter !== -1) setDisc(reach, shooter, px, py);
      setBall(reach, px, py);
      const keeper = firstDisc(other(event.side));
      if (shooter !== -1) {
        show[shooter] = 1;
        const gx = px - goalLine(event.side);
        const gy = py - CENTRE_Y;
        const length = Math.hypot(gx, gy) || 1;
        const away = M.appear.open;
        if (prevShow[shooter] !== 1)
          setDisc(from, shooter, px + (gx / length) * away, py + (gy / length) * away);
      }
      if (field.on[keeper] === 1) {
        show[keeper] = 1;
        if (prevShow[keeper] !== 1)
          setDisc(from, keeper, reach[keeper * 2]!, reach[keeper * 2 + 1]!);
      }
      const flightEnd = event.outcome === 'post' ? 0.75 : 1;
      segments = [
        segment(0.5, reach),
        ...outcomeSegments(
          field,
          reach,
          event.side,
          event.outcome,
          rng,
          [flightEnd, flightEnd],
          [1, 1],
        ),
      ];
    } else if (
      source!.type === 'kickoff' ||
      source!.type === 'halftime' ||
      source!.type === 'secondHalf'
    ) {
      const to = copy(from);
      field.toFormation(to);
      setBall(to, CENTRE_X, CENTRE_Y);
      segments = [segment(1, to)];
    } else if (toLine.length > 0) {
      // A red card, or an injury with no substitution in the same minute: off by the touchline.
      // The sent-off appears 3 m from the ball, on the side of the touchline he walks to.
      if (expelled !== -1) {
        const by = from[BALL + 1]!;
        const y = by < CENTRE_Y ? by - M.appear.sentOff : by + M.appear.sentOff;
        setDisc(from, expelled, from[BALL]!, Math.min(PITCH_SIZE.width, Math.max(0, y)));
        show[expelled] = 1;
        tag = expelled;
      }
      const to = copy(from);
      toTouchline(to);
      segments = [segment(1, to)];
    }

    if (step.timing === undefined || source?.type === 'fulltime') afterGoal = false;
    else afterGoal = step.timing === 'afterGoal';

    const end = segments.length === 0 ? from : segments[segments.length - 1]!.pose;
    field.pose.set(end);
    for (const d of leaving) field.on[d] = 0;
    out.push({
      from,
      segments,
      slow,
      on,
      onEnd: new Uint8Array(field.on),
      still: copy(end),
      show,
      showPrev: prevShow,
      gone,
      owner,
      tag,
    });
    // What the next step sees as shown before it: not the gone discs (the new keeper appears).
    prevShow = show.map((v, d) => (gone[d] === 1 ? 0 : v));
  });
  return { steps: out, unknown };
}

/** The share of each disc drawn at `progress` (0 to 1): the fade of the discs of a play. */
function fade(out: PitchScene, step: StepMotion, p: number): void {
  const k = ease(clamp01(p / M.appear.fade));
  for (let d = 0; d < DISCS; d++) {
    const now = step.show[d]!;
    const before = step.showPrev[d]!;
    const a = now === before ? now : now === 1 ? k : 1 - k;
    // A disc that left the pitch is gone (a sent-off, at the end of his step); so is a sent-off
    // keeper's, which stays on the pitch for the one who replaces him.
    out.alpha[d] = out.on[d] === 1 && !(p >= 1 && step.gone[d] === 1) ? a : 0;
  }
}

function write(out: PitchScene, pose: Float64Array, on: Uint8Array): void {
  for (let d = 0; d < DISCS; d++) {
    out.x[d] = pose[d * 2]!;
    out.y[d] = pose[d * 2 + 1]!;
    out.on[d] = on[d]!;
  }
  out.ballX = pose[BALL]!;
  out.ballY = pose[BALL + 1]!;
}

/**
 * Writes into `out` the scene at `progress` (0 to 1) of step `index`, at the speed the step was
 * shown at (only the flight of an outcome depends on it). Returns `out`; allocates nothing.
 */
export function sceneAt(
  choreography: Choreography,
  index: number,
  progress: number,
  out: PitchScene,
  speed: MatchSpeed = 'normal',
): PitchScene {
  const steps = choreography.steps;
  if (steps.length === 0) return out;
  const step = steps[index < 0 ? 0 : index >= steps.length ? steps.length - 1 : index]!;
  const p = clamp01(progress);
  const advance = step.slow ? slowMotion(p) : p;
  const on = p >= 1 ? step.onEnd : step.on;
  let start = 0;
  let from = step.from;
  const segments = step.segments;
  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s]!;
    const end = speed === 'fast' ? seg.endFast : seg.end;
    if (advance <= end || s === segments.length - 1) {
      const local = end > start ? clamp01((advance - start) / (end - start)) : 1;
      const w = seg.curve === 'ease' ? ease(local) : local;
      const to = seg.pose;
      for (let d = 0; d < DISCS; d++) {
        out.x[d] = lerp(from[d * 2]!, to[d * 2]!, w);
        out.y[d] = lerp(from[d * 2 + 1]!, to[d * 2 + 1]!, w);
        out.on[d] = on[d]!;
      }
      out.ballX = lerp(from[BALL]!, to[BALL]!, w);
      out.ballY = lerp(from[BALL + 1]!, to[BALL + 1]!, w);
      fade(out, step, p);
      return out;
    }
    start = end;
    from = seg.pose;
  }
  write(out, from, on);
  fade(out, step, p);
  return out;
}

/**
 * The one frame of step `index` with reduced motion (partida-campo-v2.md, 11): the discs of the play
 * and the ball where the step leaves them. Returns
 * `out`; allocates nothing.
 */
export function stillScene(choreography: Choreography, index: number, out: PitchScene): PitchScene {
  const steps = choreography.steps;
  if (steps.length === 0) return out;
  const step = steps[index < 0 ? 0 : index >= steps.length ? steps.length - 1 : index]!;
  write(out, step.still, step.onEnd);
  // No fade with reduced motion: the discs of the play, where the step leaves them (also the
  // sent-off, at the touchline).
  for (let d = 0; d < DISCS; d++) out.alpha[d] = step.show[d]!;
  return out;
}

/**
 * The disc the tag of step `index` hangs from (the one made for the `PlayerId` of its event), or
 * -1 when the step has no disc for it. Never another player's disc.
 */
export function tagDiscOf(choreography: Choreography, index: number): number {
  return choreography.steps[index]?.tag ?? -1;
}

/** Whether the disc `disc` is one of the discs of a play drawn in step `index`. */
export function discShownIn(choreography: Choreography, index: number, disc: number): boolean {
  return choreography.steps[index]?.show[disc] === 1;
}
