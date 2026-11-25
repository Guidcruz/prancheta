import { describe, expect, it } from 'vitest';
import { clearOf, drawShadow, drawTrails, drawWedge, pitchDashes } from './ballview';
import { ballPlace, pitchGeometry, ringSize, shadowShift, project } from './geometry';
import { PITCH_MOTION as M } from './motion';
import { SEG, TRAIL, Z, heightAt } from './plan';
import { createScene } from './scene';

/*
 * The drawing of the ball's extras (docs/design/telas/partida-campo-v2.md, 7 and 8; criterion 13,
 * "planejador e rastros"): the shadow that the ball never covers, the trails by kind and the wedge.
 */

const SIZES = [
  [360, 240],
  [397, 265],
  [600, 400],
  [297, 198],
] as const;

describe('the shadow of the ball (7, rule against covering it)', () => {
  it('keeps the centres at least r + 0.5 r0 + 1px apart, on all four sizes, at every height above 0.15 m', () => {
    for (const [w, h] of SIZES) {
      for (const dpr of [1, 2, 3]) {
        const g = pitchGeometry(w * dpr, h * dpr, dpr);
        const place = new Float64Array(7);
        for (const y of [5, 6, 7, 20, 34, 48, 61, 63]) {
          for (const x of [20, 52.5, 85]) {
            for (let z = 0.16; z <= 11; z += 0.05) {
              ballPlace(g, x, y, z, place);
              const r = place[4]!;
              const r0 = place[5]!;
              const lift = place[6]!;
              const shift = shadowShift(g, r, r0, lift);
              expect(lift).toBeCloseTo(place[1]! - place[3]!, 9);
              const apart = place[1]! + shift - place[3]!;
              expect(apart).toBeGreaterThanOrEqual(r + 0.5 * r0 + dpr - 1e-9);
            }
          }
        }
      }
    }
  });

  it('is right under the ball (no shift) once it is high, and grows with the height up to 45%', () => {
    const g = pitchGeometry(1080, 720, 3);
    const place = new Float64Array(7);
    ballPlace(g, 52.5, 34, 11, place);
    expect(shadowShift(g, place[4]!, place[5]!, place[6]!)).toBe(0);
    expect(place[4]! / place[5]!).toBeCloseTo(1.45, 9);
    ballPlace(g, 52.5, 34, 4.5, place);
    expect(place[4]! / place[5]!).toBeCloseTo(1.225, 9);
    ballPlace(g, 52.5, 34, 0, place);
    expect(place[4]).toBe(place[5]);
    expect(place[2]).toBe(place[0]);
    expect(place[3]).toBe(place[1]);
  });

  it('draws only above 0.15 m', () => {
    const calls: string[] = [];
    const ctx = {
      beginPath: () => calls.push('begin'),
      ellipse: () => calls.push('ellipse'),
      fill: () => calls.push('fill'),
    } as unknown as CanvasRenderingContext2D;
    const g = pitchGeometry(360, 240, 1);
    const place = new Float64Array(7);
    ballPlace(g, 52.5, 34, 0.1, place);
    drawShadow(ctx, g, 0.1, place, 'rgba(0,0,0,0.38)');
    expect(calls).toEqual([]);
    ballPlace(g, 52.5, 34, 1, place);
    drawShadow(ctx, g, 1, place, 'rgba(0,0,0,0.38)');
    expect(calls).toEqual(['begin', 'ellipse', 'fill']);
  });
});

/** A context that records what the trails and the wedge do to it. */
function recorder() {
  const log: string[] = [];
  const points: [number, number][] = [];
  const ellipses: number[][] = [];
  const state = { dash: [] as readonly number[], width: 0, alpha: 1 };
  const ctx = {
    set strokeStyle(_v: string) {},
    set fillStyle(_v: unknown) {},
    set lineCap(_v: string) {},
    set lineWidth(v: number) {
      state.width = v;
    },
    set globalAlpha(v: number) {
      state.alpha = v;
    },
    setLineDash: (d: readonly number[]) => {
      state.dash = d;
    },
    beginPath: () => log.push('begin'),
    moveTo: (x: number, y: number) => {
      log.push('move');
      points.push([x, y]);
    },
    lineTo: (x: number, y: number) => {
      log.push('line');
      points.push([x, y]);
    },
    ellipse: (...a: number[]) => {
      log.push('ellipse');
      ellipses.push(a);
    },
    closePath: () => log.push('close'),
    stroke: () =>
      log.push(`stroke w${state.width} d${state.dash.join('/')} a${state.alpha.toFixed(2)}`),
    arc: () => log.push('dot'),
    fill: () => log.push('fill'),
    setTransform: (...a: number[]) => log.push(`transform ${a.length}`),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, log, points, ellipses };
}

function trail(entries: Record<string, number>[]) {
  const scene = createScene();
  entries.forEach((entry, n) => {
    const e = n * TRAIL.stride;
    scene.trails[e + TRAIL.kind] = entry['kind']!;
    scene.trails[e + TRAIL.alpha] = entry['alpha'] ?? 1;
    scene.trails[e + TRAIL.x0] = 40;
    scene.trails[e + TRAIL.y0] = 30;
    scene.trails[e + TRAIL.x1] = 60;
    scene.trails[e + TRAIL.y1] = 40;
    scene.trails[e + TRAIL.h] = entry['h'] ?? 0;
    scene.trails[e + TRAIL.zmode] = entry['zmode'] ?? 0;
    scene.trails[e + TRAIL.s] = entry['s'] ?? 1;
    scene.trails[e + TRAIL.vx1] = 20;
    scene.trails[e + TRAIL.vy1] = 10;
  });
  scene.trailCount = entries.length;
  return scene;
}

describe('the trails by kind (7)', () => {
  const g = pitchGeometry(360, 240, 1);
  const dashes = pitchDashes(1);

  it('a ground pass is a solid line of 2px; a shot is a thicker one of 3.5px', () => {
    const a = recorder();
    drawTrails(a.ctx, g, trail([{ kind: SEG.ground }]), '#fff', dashes);
    expect(a.log.filter((l) => l.startsWith('stroke'))).toEqual(['stroke w2 d a1.00']);
    const b = recorder();
    drawTrails(b.ctx, g, trail([{ kind: SEG.shot }]), '#fff', dashes);
    expect(b.log.filter((l) => l.startsWith('stroke'))).toEqual(['stroke w3.5 d a1.00']);
  });

  it('a carry is dotted along 8 points, 2.2px', () => {
    const a = recorder();
    drawTrails(a.ctx, g, trail([{ kind: SEG.carry }]), '#fff', dashes);
    expect(a.log.filter((l) => l === 'line' || l === 'move')).toHaveLength(8);
    expect(a.log.find((l) => l.startsWith('stroke'))).toBe('stroke w2.2 d0.1/5 a1.00');
  });

  it('a pass over the top is an arc of 19 points and the dashed trail of its shadow on the ground', () => {
    const a = recorder();
    drawTrails(a.ctx, g, trail([{ kind: SEG.air, h: 8, zmode: Z.arch }]), '#fff', dashes);
    // 19 points of the arc, the 2 of the shadow trail and the 4 starts of the ring.
    expect(a.log.filter((l) => l === 'line' || l === 'move')).toHaveLength(19 + 2 + 4);
    expect(a.log.filter((l) => l === 'ellipse')).toHaveLength(4);
    const strokes = a.log.filter((l) => l.startsWith('stroke'));
    expect(strokes).toEqual(['stroke w2 d a1.00', 'stroke w1.2 d3/4 a0.70', 'stroke w2 d a1.00']);
  });

  it('a shot over the bar is a low arc of 3px; the origin dot only on the newest action', () => {
    const a = recorder();
    drawTrails(
      a.ctx,
      g,
      trail([
        { kind: SEG.chip, h: 3.2, zmode: Z.rise },
        { kind: SEG.ground, alpha: 0.6 },
      ]),
      '#fff',
      dashes,
    );
    expect(a.log.filter((l) => l.startsWith('stroke'))).toEqual([
      'stroke w2 d a0.60',
      'stroke w3 d a1.00',
    ]);
    expect(a.log.filter((l) => l === 'dot')).toHaveLength(1);
  });

  it('draws the oldest first, skips a faded one and leaves the context clean', () => {
    const a = recorder();
    drawTrails(
      a.ctx,
      g,
      trail([
        { kind: SEG.ground, alpha: 1 },
        { kind: SEG.shot, alpha: 0.6 },
        { kind: SEG.ground, alpha: 0 },
      ]),
      '#fff',
      dashes,
    );
    expect(a.log.filter((l) => l.startsWith('stroke'))).toEqual([
      'stroke w3.5 d a0.60',
      'stroke w2 d a1.00',
    ]);
  });

  it('a pass over the top rises along an arch: 0 at the ends and `h` in the middle', () => {
    expect(heightAt(Z.arch, 8, 0)).toBe(0);
    expect(heightAt(Z.arch, 8, 0.5)).toBe(8);
    expect(heightAt(Z.arch, 8, 1)).toBe(0);
    expect(heightAt(Z.rise, 3.2, 1)).toBe(3.2);
    expect(heightAt(Z.fall, 3.2, 1)).toBe(0);
  });
});

describe('the wedge (8)', () => {
  const g = pitchGeometry(360, 240, 1);
  const fill = {} as CanvasGradient;

  it('is drawn from the ball with one transform, clipped, and put back to the identity', () => {
    const scene = createScene();
    scene.ballX = 50;
    scene.ballY = 20;
    scene.wedgeOwner = 1;
    scene.wedgeAlpha = 1;
    const a = recorder();
    drawWedge(a.ctx, g, scene, fill);
    expect(a.log[0]).toBe('transform 6');
    expect(a.log.at(-1)).toBe('transform 6');
    expect(a.log.filter((l) => l === 'fill')).toHaveLength(1);
    const points = a.log.filter((l) => l === 'move' || l === 'line').length;
    expect(points).toBeGreaterThanOrEqual(3);
    expect(points).toBeLessThanOrEqual(7);
  });

  it('is not drawn without an owner or with nothing of it showing', () => {
    const scene = createScene();
    const a = recorder();
    drawWedge(a.ctx, g, scene, fill);
    scene.wedgeOwner = 2;
    scene.wedgeAlpha = 0;
    drawWedge(a.ctx, g, scene, fill);
    expect(a.log).toEqual([]);
  });

  it('ends its gradient in the same colour with no opacity', () => {
    expect(clearOf('rgba(4,18,10,0.45)')).toBe('rgba(4,18,10, 0)');
    expect(clearOf('rgba(255, 255, 255, 0.35)')).toBe('rgba(255, 255, 255, 0)');
    expect(clearOf('#123456')).toBe('transparent');
    expect(M.wedge.half).toBe(26);
  });
});

describe('the ring of the landing (7, planner 11)', () => {
  const dashes = pitchDashes(1);

  it('only a pass over the top has one: not a chip, a shot, a carry or a ground pass', () => {
    for (const [kind, rings] of [
      [SEG.air, 4],
      [SEG.cross, 4],
      [SEG.chip, 0],
      [SEG.shot, 0],
      [SEG.carry, 0],
      [SEG.ground, 0],
      [SEG.back, 0],
    ] as const) {
      const a = recorder();
      drawTrails(
        a.ctx,
        pitchGeometry(360, 240, 1),
        trail([{ kind, h: 5, zmode: Z.arch }]),
        '#fff',
        dashes,
      );
      expect(
        a.log.filter((l) => l === 'ellipse'),
        String(kind),
      ).toHaveLength(rings);
    }
  });

  it('fades in over the first 20% of the pass, with the weight of its entry, whole in the reduced frame', () => {
    const g = pitchGeometry(360, 240, 1);
    for (const [s, expected] of [
      [0.1, 0.5],
      [0.2, 1],
      [1, 1],
    ] as const) {
      const a = recorder();
      drawTrails(
        a.ctx,
        g,
        trail([{ kind: SEG.air, alpha: 0.6, h: 5, zmode: Z.arch, s }]),
        '#fff',
        dashes,
      );
      const ringStroke = a.log.filter((l) => l.startsWith('stroke')).at(-1)!;
      expect(ringStroke).toBe(`stroke w2 d a${(0.6 * expected).toFixed(2)}`);
    }
  });

  it('is whole inside the trapezoid and keeps the ball 2px CSS from its stroke, on the four sizes, for every target of the band', () => {
    const out = new Float64Array(2);
    const at = new Float64Array(3);
    for (const [w, h] of SIZES) {
      for (const dpr of [1, 2, 3]) {
        const g = pitchGeometry(w * dpr, h * dpr, dpr);
        for (let x = 10; x <= 95; x += 5) {
          for (const y of [5, 6, 10, 34, 58, 63]) {
            project(g, x, y, at);
            ringSize(g, at[2]!, out);
            const r0 = Math.max(1.25 * at[2]!, g.ballMin);
            // Clear of the ball: the inside of the stroke (1px CSS from the line) from its edge.
            expect(out[1]! - r0 - dpr).toBeGreaterThanOrEqual(2 * dpr - 1e-9);
            // Inside the trapezoid, exactly: every point of the ring is between the far edge and the
            // near one and inside the sides at its own depth.
            for (let deg = 0; deg < 360; deg += 5) {
              const px = at[0]! + out[0]! * Math.cos((deg * Math.PI) / 180);
              const py = at[1]! + out[1]! * Math.sin((deg * Math.PI) / 180);
              expect(py).toBeGreaterThanOrEqual(g.yFar);
              expect(py).toBeLessThanOrEqual(g.height);
              const t = g.farScale + ((py - g.yFar) / (g.height - g.yFar)) * (1 - g.farScale);
              expect(Math.abs(px - g.width / 2)).toBeLessThanOrEqual((g.width / 2) * t);
            }
          }
        }
      }
    }
  });

  it('is at least 12px CSS wide and 3 times the radius of the ball on the ground', () => {
    const g = pitchGeometry(360, 240, 1);
    const out = new Float64Array(2);
    const at = new Float64Array(3);
    project(g, 52.5, 5, at);
    ringSize(g, at[2]!, out);
    expect(out[0]).toBeGreaterThanOrEqual(12);
    expect(out[1]! / out[0]!).toBeCloseTo(0.62, 1);
  });
});

describe('the arc is held in the trapezoid like the ball (7, planner 12)', () => {
  it('every point of the arc is where the ball is drawn at that progress, inside the trapezoid with its radius', () => {
    for (const [w, h] of SIZES) {
      const g = pitchGeometry(w, h, 1);
      for (const [x0, y0, x1, y1, h0] of [
        [30, 6, 60, 5, 11],
        [20, 34, 80, 34, 11],
        [95, 8, 100, 10, 6],
        [10, 63, 70, 60, 9],
      ] as const) {
        const a = recorder();
        drawTrails(
          a.ctx,
          g,
          (() => {
            const scene = trail([{ kind: SEG.air, h: h0, zmode: Z.arch }]);
            scene.trails.set([x0, y0, x1, y1], TRAIL.x0);
            return scene;
          })(),
          '#fff',
          pitchDashes(1),
        );
        const arc = a.points.slice(0, 19);
        const place = new Float64Array(7);
        arc.forEach(([px, py], k) => {
          const u = k / 18;
          ballPlace(g, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, h0 * 4 * u * (1 - u), place);
          expect(Math.hypot(px - place[2]!, py - place[3]!)).toBeLessThanOrEqual(0.5);
          const r = place[4]!;
          expect(py).toBeGreaterThanOrEqual(g.yFar + r - 1e-9);
          expect(py).toBeLessThanOrEqual(g.height - r + 1e-9);
          const t = g.farScale + ((py - g.yFar) / (g.height - g.yFar)) * (1 - g.farScale);
          expect(Math.abs(px - g.width / 2)).toBeLessThanOrEqual((g.width / 2) * t - r + 1e-9);
        });
      }
    }
  });
});

describe('the ring is centred on the landing (planner 11)', () => {
  it('four arcs on the projected target, to a thousandth of a pixel, with the semi-axes of ringSize', () => {
    for (const [w, h] of SIZES) {
      const g = pitchGeometry(w * 2, h * 2, 2);
      const out = new Float64Array(2);
      const at = new Float64Array(3);
      for (const [x1, y1] of [
        [60, 20],
        [95, 63],
        [12, 5],
      ] as const) {
        const scene = trail([{ kind: SEG.cross, h: 5, zmode: Z.arch }]);
        scene.trails.set([x1, y1], TRAIL.x1);
        const a = recorder();
        drawTrails(a.ctx, g, scene, '#fff', pitchDashes(2));
        project(g, x1, y1, at);
        ringSize(g, at[2]!, out);
        expect(a.ellipses).toHaveLength(4);
        a.ellipses.forEach(([cx, cy, rx, ry]) => {
          expect(cx).toBeCloseTo(at[0]!, 3);
          expect(cy).toBeCloseTo(at[1]!, 3);
          expect(rx).toBeCloseTo(out[0]!, 9);
          expect(ry).toBeCloseTo(out[1]!, 9);
        });
      }
    }
  });
});
