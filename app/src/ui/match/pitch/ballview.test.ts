import { describe, expect, it } from 'vitest';
import { clearOf, drawShadow, drawTrails, drawWedge, pitchDashes } from './ballview';
import { ballPlace, pitchGeometry, shadowShift } from './geometry';
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
        for (const y of [20, 34, 48]) {
          for (const x of [20, 52.5, 85]) {
            for (let z = 0.16; z <= 11; z += 0.05) {
              ballPlace(g, x, y, z, place);
              const r = place[4]!;
              const r0 = place[5]!;
              const lift = place[6]!;
              const shift = shadowShift(g, r, r0, lift);
              // Away from the edges the ball is not held: the centre is the ground point lifted.
              expect(place[3]).toBeCloseTo(place[1]! - lift, 6);
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
    moveTo: () => log.push('move'),
    lineTo: () => log.push('line'),
    closePath: () => log.push('close'),
    stroke: () =>
      log.push(`stroke w${state.width} d${state.dash.join('/')} a${state.alpha.toFixed(2)}`),
    arc: () => log.push('dot'),
    fill: () => log.push('fill'),
    setTransform: (...a: number[]) => log.push(`transform ${a.length}`),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, log };
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
    expect(a.log.filter((l) => l === 'line' || l === 'move')).toHaveLength(19 + 2);
    const strokes = a.log.filter((l) => l.startsWith('stroke'));
    expect(strokes).toEqual(['stroke w2 d a1.00', 'stroke w1.2 d3/4 a0.70']);
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
