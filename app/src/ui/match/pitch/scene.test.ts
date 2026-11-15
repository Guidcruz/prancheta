import { describe, expect, it } from 'vitest';
import type { ClubDef, MatchEvent, MatchInput, PlayerId, Side } from '@engine';
import type { FieldKit } from '@lib/generators/kit';
import { matchKits } from '@lib/generators/kit';
import { testMatches } from '../../testing/matches';
import { matchSteps, type MatchStep } from '../steps';
import { pitchKits, pitchKitsOf } from './kits';
import { PITCH_MOTION, PITCH_SIZE } from './motion';
import {
  DISCS,
  choreograph,
  createScene,
  formationSpot,
  sceneAt,
  slowMotion,
  stillScene,
  type Choreography,
  type PitchScene,
} from './scene';

/*
 * The scene of the 2D pitch (docs/design/telas/partida.md, "Campo 2D (T-085)" and "No Vitest
 * (T-085)", items 3 to 7) on the 60 real matches of the test career: determinism and no
 * allocation, nothing ahead of the outcome, slow motion, the kits, the sides that never depend on
 * colour, who leaves and who changes.
 */

const matches = testMatches();
const lineupsOf = (match: MatchInput) => ({
  home: match.home.sheet.lineup,
  away: match.away.sheet.lineup,
});
const choreoOf = (match: MatchInput, events: readonly MatchEvent[]) =>
  choreograph(matchSteps(events, 'full'), lineupsOf(match), match.seed);
const POINTS = Array.from({ length: 11 }, (_, i) => i / 10);

/** A plain copy of the scene, to compare. */
function snapshot(scene: PitchScene) {
  return {
    x: [...scene.x],
    y: [...scene.y],
    on: [...scene.on],
    ball: [scene.ballX, scene.ballY],
  };
}

function framesOf(choreo: Choreography, index: number, speed: 'normal' | 'fast' = 'normal') {
  const out = createScene();
  return POINTS.map((p) => snapshot(sceneAt(choreo, index, p, out, speed)));
}

const buildIndex = (steps: readonly MatchStep[], id: string) =>
  steps.findIndex((s) => s.line?.id === id && s.line.stage === 'build');

describe('the pitch scene: determinism and allocation (item 6)', () => {
  it('the same match gives the same choreography; another seed, another', () => {
    const { match, result } = matches[0]!;
    const a = choreoOf(match, result.events);
    const b = choreoOf(match, result.events);
    const c = choreograph(matchSteps(result.events, 'full'), lineupsOf(match), match.seed + 1);
    const all = (choreo: Choreography) =>
      choreo.steps.flatMap((_, i) => framesOf(choreo, i).map((f) => JSON.stringify(f)));
    expect(all(a)).toEqual(all(b));
    expect(all(c)).not.toEqual(all(a));
  });

  it('sceneAt and stillScene write into the same object, nothing new', () => {
    const { match, result } = matches[1]!;
    const choreo = choreoOf(match, result.events);
    const out = createScene();
    const { x, y, on } = out;
    for (let i = 0; i < choreo.steps.length; i++) {
      for (const p of POINTS) {
        expect(sceneAt(choreo, i, p, out)).toBe(out);
        expect(sceneAt(choreo, i, p, out, 'fast')).toBe(out);
      }
      expect(stillScene(choreo, i, out)).toBe(out);
    }
    expect(out.x).toBe(x);
    expect(out.y).toBe(y);
    expect(out.on).toBe(on);
  });

  it('nothing jumps: each step starts where the previous one ended', () => {
    for (const { match, result } of matches.slice(0, 20)) {
      const choreo = choreoOf(match, result.events);
      const out = createScene();
      for (let i = 1; i < choreo.steps.length; i++) {
        const end = snapshot(sceneAt(choreo, i - 1, 1, out));
        const start = snapshot(sceneAt(choreo, i, 0, out));
        expect(start.x).toEqual(end.x);
        expect(start.y).toEqual(end.y);
        expect(start.ball).toEqual(end.ball);
      }
    }
  });

  it('the slow-motion curve: 0.5 ÷ 0.7 at t = 0.5, 1 at t = 1, 40% of the speed after', () => {
    expect(slowMotion(0)).toBe(0);
    expect(slowMotion(0.5)).toBeCloseTo(0.5 / 0.7, 12);
    expect(slowMotion(1)).toBeCloseTo(1, 12);
    expect(slowMotion(0.25)).toBeCloseTo(0.25 / 0.7, 12);
    const fast = (slowMotion(0.5) - slowMotion(0.4)) / 0.1;
    const slow = (slowMotion(0.9) - slowMotion(0.8)) / 0.1;
    expect(slow / fast).toBeCloseTo(PITCH_MOTION.slow, 12);
  });
});

describe('the ball stays whole in the canvas', () => {
  it('never goes further into the strip of grass than the strip less the ball (60 matches)', () => {
    const room = PITCH_SIZE.margin - PITCH_SIZE.ballRoom;
    for (const { match, result } of matches) {
      const choreo = choreoOf(match, result.events);
      const out = createScene();
      for (let i = 0; i < choreo.steps.length; i++) {
        for (const p of POINTS) {
          sceneAt(choreo, i, p, out);
          expect(out.ballX).toBeGreaterThanOrEqual(-room - 1e-9);
          expect(out.ballX).toBeLessThanOrEqual(PITCH_SIZE.length + room + 1e-9);
          expect(out.ballY).toBeGreaterThanOrEqual(-room - 1e-9);
          expect(out.ballY).toBeLessThanOrEqual(PITCH_SIZE.width + room + 1e-9);
        }
      }
    }
  });
});

describe('nothing runs ahead of the outcome (item 5)', () => {
  /** The events with the goal at `index` turned into a chance of the same kind, side and player. */
  const asChance = (events: readonly MatchEvent[], index: number): MatchEvent[] => {
    const goal = events[index] as Extract<MatchEvent, { type: 'goal' }>;
    const chance: MatchEvent = {
      minute: goal.minute,
      ...(goal.added === undefined ? {} : { added: goal.added }),
      half: goal.half,
      importance: 2,
      type: 'chance',
      side: goal.side,
      shooter: goal.scorer,
      kind: goal.kind as 'open' | 'freeKick',
      outcome: 'saved',
      pGoal: 0.3,
    };
    return events.map((e, i) => (i === index ? chance : e));
  };

  it('the start of every goal of the 60 matches equals the start of the same chance, in 11 points', () => {
    let goals = 0;
    for (const { match, result } of matches) {
      const events = result.events;
      events.forEach((event, index) => {
        if (event.type !== 'goal' || event.kind === 'penalty') return;
        goals++;
        const id = `e${index}`;
        const goalSteps = matchSteps(events, 'full');
        const other = asChance(events, index);
        const chanceSteps = matchSteps(other, 'full');
        const at = buildIndex(goalSteps, id);
        expect(buildIndex(chanceSteps, id)).toBe(at);
        const a = choreograph(goalSteps, lineupsOf(match), match.seed);
        const b = choreograph(chanceSteps, lineupsOf(match), match.seed);
        expect(framesOf(a, at), id).toEqual(framesOf(b, at));
        expect(framesOf(a, at, 'fast'), id).toEqual(framesOf(b, at, 'fast'));
      });
    }
    expect(goals).toBeGreaterThan(60);
  });

  it('a penalty scored and the same penalty missed start the same, in 11 points', () => {
    let penalties = 0;
    for (const { match, result } of matches) {
      const events = result.events;
      events.forEach((event, index) => {
        if (event.type !== 'penaltyAwarded') return;
        const next = events[index + 1];
        if (next === undefined || !('side' in next) || next.side !== event.side) return;
        let swapped: MatchEvent;
        const base = {
          minute: next.minute,
          ...(next.added === undefined ? {} : { added: next.added }),
          half: next.half,
        };
        if (next.type === 'goal' && next.kind === 'penalty') {
          swapped = {
            ...base,
            importance: 2,
            type: 'penaltyMissed',
            side: next.side,
            taker: next.scorer,
            outcome: 'saved',
          };
        } else if (next.type === 'penaltyMissed') {
          swapped = {
            ...base,
            importance: 3,
            type: 'goal',
            side: next.side,
            scorer: next.taker,
            kind: 'penalty',
            score: [0, 0],
          };
        } else return;
        penalties++;
        const other = events.map((e, i) => (i === index + 1 ? swapped : e));
        const stepsA = matchSteps(events, 'full');
        const stepsB = matchSteps(other, 'full');
        const at = buildIndex(stepsA, `e${index}`);
        expect(at).toBeGreaterThan(0);
        expect(buildIndex(stepsB, `e${index}`)).toBe(at);
        const a = choreograph(stepsA, lineupsOf(match), match.seed);
        const b = choreograph(stepsB, lineupsOf(match), match.seed);
        expect(framesOf(a, at)).toEqual(framesOf(b, at));
      });
    }
    expect(penalties).toBeGreaterThan(0);
  });

  it('the ball never leaves for the goal before the outcome: it ends the start at the point of the play', () => {
    for (const { match, result } of matches.slice(0, 30)) {
      const steps = matchSteps(result.events, 'full');
      const choreo = choreograph(steps, lineupsOf(match), match.seed);
      const out = createScene();
      steps.forEach((step, i) => {
        if (step.line?.stage !== 'build') return;
        // The step after a goal is the new kick-off, whatever it is (partida.md, "Coreografia").
        if (steps[i - 1]?.timing === 'afterGoal') return;
        const event = step.line.source as MatchEvent & { side: Side };
        const goal = event.side === 'home' ? PITCH_SIZE.length : 0;
        const at = sceneAt(choreo, i, 1, out);
        const distance = Math.abs(at.ballX - goal);
        if (event.type === 'penaltyAwarded') {
          expect(distance).toBeCloseTo(PITCH_MOTION.penalty.spot, 9);
        } else {
          expect(distance).toBeGreaterThanOrEqual(PITCH_MOTION.open.distance[0] - 1e-9);
          expect(distance).toBeLessThanOrEqual(PITCH_MOTION.open.distance[1] + 1e-9);
        }
        // The ball is still there at every point of the start: it reached it in the first half.
        for (const p of [0.5, 0.75, 1]) {
          expect(sceneAt(choreo, i, p, out).ballX).toBeCloseTo(at.ballX, 9);
        }
      });
    }
  });

  it('the slow motion is the second half of the time: the finisher reaches the ball in it', () => {
    const { match, result } = matches.find(({ result }) =>
      result.events.some((e) => e.type === 'goal' && e.kind === 'open'),
    )!;
    const steps = matchSteps(result.events, 'full');
    const choreo = choreograph(steps, lineupsOf(match), match.seed);
    const index = steps.findIndex((s) => s.line?.stage === 'build' && s.timing === 'drama');
    const out = createScene();
    const half = snapshot(sceneAt(choreo, index, 0.5, out));
    const end = snapshot(sceneAt(choreo, index, 1, out));
    // Who moved in the slow half is only the finisher, by the 1.5 m behind the ball.
    const moved = Array.from({ length: DISCS }, (_, d) => d).filter(
      (d) => Math.hypot(end.x[d]! - half.x[d]!, end.y[d]! - half.y[d]!) > 1e-9,
    );
    expect(moved).toHaveLength(1);
    const d = moved[0]!;
    expect(Math.hypot(end.x[d]! - half.x[d]!, end.y[d]! - half.y[d]!)).toBeCloseTo(
      PITCH_MOTION.behind,
      9,
    );
    expect([end.x[d], end.y[d]]).toEqual(end.ball);
  });
});

describe('the kits of the pitch (item 3)', () => {
  const clubsOf = (i: number) => {
    const { game, match } = matches[i]!;
    return [game.clubs[match.home.clubId]!.def, game.clubs[match.away.clubId]!.def] as [
      ClubDef,
      ClubDef,
    ];
  };

  it('are the four FieldKits of matchKits(home, away): the disc is fill, the mark only away', () => {
    for (let i = 0; i < 10; i++) {
      const [home, away] = clubsOf(i);
      const m = matchKits(home, away);
      expect(pitchKits(home, away)).toEqual({
        home: { fill: m.home.fill },
        away: { fill: m.away.fill, mark: m.away.mark },
        homeGk: { fill: m.homeGk.fill },
        awayGk: { fill: m.awayGk.fill, mark: m.awayGk.mark },
      });
    }
  });

  it('read neither ring, nor numberColor, nor stripe', () => {
    const [home, away] = clubsOf(0);
    const m = matchKits(home, away);
    const read: string[] = [];
    const watch = (kit: FieldKit) =>
      new Proxy(kit, {
        get(target, key) {
          read.push(String(key));
          return target[key as keyof FieldKit];
        },
      });
    pitchKitsOf({
      home: watch(m.home),
      away: watch(m.away),
      homeGk: watch(m.homeGk),
      awayGk: watch(m.awayGk),
    });
    expect(new Set(read)).toEqual(new Set(['fill', 'mark']));
  });
});

describe('the sides never depend on colour (item 4)', () => {
  it('every away disc has the mark and no home disc has one', () => {
    const { game, match } = matches[2]!;
    const kits = pitchKits(game.clubs[match.home.clubId]!.def, game.clubs[match.away.clubId]!.def);
    expect(kits.home.mark).toBeUndefined();
    expect(kits.homeGk.mark).toBeUndefined();
    expect(kits.away.mark).toMatch(/^#[0-9a-f]{6}$/);
    expect(kits.awayGk.mark).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('at the kick-off and at the second half, the 11 of home left and the 11 away right', () => {
    for (const { match, result } of matches) {
      const steps = matchSteps(result.events, 'full');
      const choreo = choreograph(steps, lineupsOf(match), match.seed);
      const out = createScene();
      const second = steps.findIndex((s) => s.line?.id === 'second-half');
      for (const i of [0, second]) {
        sceneAt(choreo, i, 1, out);
        for (let d = 0; d < DISCS; d++) {
          if (out.on[d] !== 1) continue;
          if (d < 11) expect(out.x[d]).toBeLessThan(PITCH_SIZE.length / 2);
          else expect(out.x[d]).toBeGreaterThan(PITCH_SIZE.length / 2);
        }
      }
    }
  });

  it('the spots of the formation: keeper 4 m off its line, the last line at the halfway line', () => {
    expect(formationSpot('home', '4-4-2', 0)).toEqual([4, 34]);
    expect(formationSpot('away', '4-4-2', 0)).toEqual([101, 34]);
    expect(formationSpot('home', '4-4-2', 9)).toEqual([50, (68 * 3) / 8]);
    expect(formationSpot('away', '4-4-2', 9)).toEqual([55, 68 - (68 * 3) / 8]);
  });
});

describe('who leaves and who changes (item 7)', () => {
  const { match, result } = matches[3]!;
  const homeStarters = match.home.sheet.lineup.starters;
  const at = (minute: number) => ({ minute, half: minute <= 45 ? 1 : 2 }) as const;
  /** The real events with `extra` added in the minutes they say (after the events of that minute). */
  function withEvents(extra: readonly MatchEvent[]): MatchEvent[] {
    const events = [...result.events];
    for (const event of extra) {
      const last = events.findLastIndex(
        (e) => e.half === event.half && e.added === undefined && e.minute <= event.minute,
      );
      events.splice(last + 1, 0, event);
    }
    return events;
  }
  const stepOf = (steps: readonly MatchStep[], event: MatchEvent, events: readonly MatchEvent[]) =>
    steps.findIndex((s) => s.line?.id === `e${events.indexOf(event)}`);
  const onCount = (scene: PitchScene, side: Side) =>
    [...scene.on.slice(side === 'home' ? 0 : 11, side === 'home' ? 11 : 22)].filter((v) => v === 1)
      .length;

  it('after a red, the disc of who left is off from the end of that step', () => {
    const player: PlayerId = homeStarters[6]!;
    const red: MatchEvent = {
      ...at(33),
      importance: 3,
      type: 'red',
      side: 'home',
      player,
      reason: 'direct',
    };
    const events = withEvents([red]);
    const steps = matchSteps(events, 'full');
    const choreo = choreograph(steps, lineupsOf(match), match.seed);
    const index = stepOf(steps, red, events);
    const out = createScene();
    expect(sceneAt(choreo, index, 0.5, out).on[6]).toBe(1);
    expect(sceneAt(choreo, index, 1, out).on[6]).toBe(0);
    expect(Math.min(out.y[6]!, PITCH_SIZE.width - out.y[6]!)).toBeLessThanOrEqual(0);
    expect(onCount(sceneAt(choreo, steps.length - 1, 1, out), 'home')).toBe(10);
    expect(onCount(stillScene(choreo, index, out), 'home')).toBe(10);
  });

  it('an injury followed by a substitution in the same minute keeps the 11', () => {
    const player = homeStarters[4]!;
    const injury: MatchEvent = {
      ...at(20),
      importance: 2,
      type: 'injury',
      side: 'home',
      player,
      severity: 'light',
    };
    const sub: MatchEvent = {
      ...at(20),
      importance: 1,
      type: 'substitution',
      side: 'home',
      out: player,
      in: 'bench-player' as PlayerId,
      reason: 'injury',
    };
    const events = withEvents([injury, sub]);
    const steps = matchSteps(events, 'full');
    const choreo = choreograph(steps, lineupsOf(match), match.seed);
    const out = createScene();
    for (let i = 0; i < steps.length; i++)
      expect(onCount(sceneAt(choreo, i, 1, out), 'home')).toBe(11);
    // The same injury alone takes the disc off.
    const alone = withEvents([injury]);
    const aloneSteps = matchSteps(alone, 'full');
    const aloneChoreo = choreograph(aloneSteps, lineupsOf(match), match.seed);
    const index = stepOf(aloneSteps, injury, alone);
    expect(onCount(sceneAt(aloneChoreo, index, 1, out), 'home')).toBe(10);
    expect(sceneAt(aloneChoreo, index, 1, out).on[4]).toBe(0);
  });

  it("a keeper off with no substitution keeps the keeper's disc and takes off the last outfield slot", () => {
    const red: MatchEvent = {
      ...at(40),
      importance: 3,
      type: 'red',
      side: 'home',
      player: homeStarters[0]!,
      reason: 'direct',
    };
    const events = withEvents([red]);
    const steps = matchSteps(events, 'full');
    const choreo = choreograph(steps, lineupsOf(match), match.seed);
    const index = stepOf(steps, red, events);
    const out = sceneAt(choreo, index, 1, createScene());
    expect(out.on[0]).toBe(1);
    expect(out.on[10]).toBe(0);
    expect(onCount(out, 'home')).toBe(10);
  });

  it('a new formation takes the discs to the slots of the new formation', () => {
    const current = match.away.sheet.lineup.formation;
    const formation = current === '3-5-2' ? '4-4-2' : '3-5-2';
    const change: MatchEvent = {
      ...at(60),
      importance: 1,
      type: 'tacticChange',
      side: 'away',
      formation,
      posture: 'balanced',
      pressure: 'medium',
    } as MatchEvent;
    const events = withEvents([change]);
    const steps = matchSteps(events, 'full');
    const choreo = choreograph(steps, lineupsOf(match), match.seed);
    const index = stepOf(steps, change, events);
    const out = sceneAt(choreo, index, 1, createScene());
    for (let slot = 0; slot < 11; slot++) {
      if (out.on[11 + slot] !== 1) continue;
      expect([out.x[11 + slot], out.y[11 + slot]]).toEqual([
        ...formationSpot('away', formation, slot),
      ]);
    }
  });

  it('the step after a goal ends with the 22 at their formation spots and the ball at the centre', () => {
    let checked = 0;
    for (const { match, result } of matches.slice(0, 20)) {
      const steps = matchSteps(result.events, 'full');
      const choreo = choreograph(steps, lineupsOf(match), match.seed);
      const out = createScene();
      steps.forEach((step, i) => {
        if (step.timing !== 'afterGoal') return;
        const next = steps[i + 1];
        if (next === undefined || next.timing === undefined) return;
        if (next.line?.source.type === 'fulltime') return;
        checked++;
        sceneAt(choreo, i + 1, 1, out);
        expect([out.ballX, out.ballY]).toEqual([PITCH_SIZE.length / 2, PITCH_SIZE.width / 2]);
        const still = stillScene(choreo, i + 1, createScene());
        for (let d = 0; d < DISCS; d++) {
          if (out.on[d] !== 1) continue;
          expect([out.x[d], out.y[d]]).toEqual([still.x[d], still.y[d]]);
        }
      });
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('the final whistle moves nothing', () => {
    const steps = matchSteps(result.events, 'full');
    const choreo = choreograph(steps, lineupsOf(match), match.seed);
    const last = steps.length - 1;
    expect(snapshot(sceneAt(choreo, last, 0, createScene()))).toEqual(
      snapshot(sceneAt(choreo, last, 1, createScene())),
    );
    expect(snapshot(sceneAt(choreo, last, 0, createScene()))).toEqual(
      snapshot(sceneAt(choreo, last - 1, 1, createScene())),
    );
  });
});

describe('reduced motion: one frame per step', () => {
  it('the sides at their formation, the ball where the step leaves it (in the net on a goal)', () => {
    const { match, result } = matches.find(({ result }) =>
      result.events.some((e) => e.type === 'goal'),
    )!;
    const steps = matchSteps(result.events, 'full');
    const choreo = choreograph(steps, lineupsOf(match), match.seed);
    const index = steps.findIndex((s) => s.timing === 'afterGoal');
    const goal = steps[index]!.line!.source as Extract<MatchEvent, { type: 'goal' }>;
    const still = stillScene(choreo, index, createScene());
    const line = goal.side === 'home' ? PITCH_SIZE.length : 0;
    expect(Math.abs(still.ballX - line)).toBeCloseTo(PITCH_MOTION.goal.depth, 9);
    const moving = sceneAt(choreo, index, 1, createScene());
    expect([still.ballX, still.ballY]).toEqual([moving.ballX, moving.ballY]);
    expect([still.x[0], still.y[0]]).toEqual([
      ...formationSpot('home', match.home.sheet.lineup.formation, 0),
    ]);
  });
});
