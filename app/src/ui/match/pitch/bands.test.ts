import { describe, expect, it } from 'vitest';
import { fillBands, rgbOf } from './backdrop';

/** A context that only records the fills (the bands are flat `fillRect`s, or one gradient). */
function recorder() {
  const rects: { y: number; h: number; w: number; color: string }[] = [];
  let gradients = 0;
  const stops: [number, string][] = [];
  const ctx = {
    fillStyle: '' as unknown,
    createLinearGradient() {
      gradients++;
      return { addColorStop: (at: number, color: string) => stops.push([at, color]) };
    },
    fillRect(_x: number, y: number, w: number, h: number) {
      rects.push({ y, h, w, color: String(ctx.fillStyle) });
    },
  };
  return { ctx: ctx as never, rects, stops, gradients: () => gradients };
}

describe('rgbOf', () => {
  it('reads #rrggbb and rgb(r, g, b), and nothing else', () => {
    expect(rgbOf('#0f1a24')).toEqual([15, 26, 36]);
    expect(rgbOf('#FFFFFF')).toEqual([255, 255, 255]);
    expect(rgbOf('rgb(1, 2, 3)')).toEqual([1, 2, 3]);
    expect(rgbOf('rgba(1, 2, 3, 0.5)')).toBeUndefined();
    expect(rgbOf('#fff')).toBeUndefined();
    expect(rgbOf('red')).toBeUndefined();
  });
});

describe('fillBands', () => {
  it('covers [round(top), end) with no hole and no overlap', () => {
    for (const [top, bottom, end] of [
      [0, 79.4, 79],
      [10.6, 120.2, 120],
      [3, 4, 4],
    ] as const) {
      const { ctx, rects } = recorder();
      fillBands(ctx, '#0f1a24', '#20334a', top, bottom, end, 360);
      const start = Math.round(top);
      let at = start;
      for (const r of rects) {
        expect(r.y, `${top} ${end}`).toBe(at);
        expect(r.h).toBeGreaterThanOrEqual(0);
        expect(r.w).toBe(360);
        at += r.h;
      }
      expect(at).toBe(end);
      expect(rects.reduce((sum, r) => sum + r.h, 0)).toBe(end - start);
    }
  });

  it('starts near the first colour and ends near the last, one step per colour level', () => {
    const { ctx, rects } = recorder();
    fillBands(ctx, '#0f1a24', '#20334a', 0, 200, 200, 100);
    // The biggest difference is 0x4a − 0x24 = 38 levels.
    expect(rects).toHaveLength(38);
    // The first and last bands are within one level of the two colours.
    const near = (color: string, want: number[]) =>
      (rgbOf(color) ?? []).every((v, i) => Math.abs(v - want[i]!) <= 1);
    expect(near(rects[0]!.color, [15, 26, 36])).toBe(true);
    expect(near(rects[rects.length - 1]!.color, [32, 51, 74])).toBe(true);
  });

  it('never makes more than 64 bands, and one when the colours are equal', () => {
    const wide = recorder();
    fillBands(wide.ctx, '#000000', '#ffffff', 0, 300, 300, 10);
    expect(wide.rects).toHaveLength(64);
    const flat = recorder();
    fillBands(flat.ctx, '#102030', '#102030', 0, 50, 50, 10);
    expect(flat.rects).toHaveLength(1);
    expect(flat.rects[0]).toMatchObject({ y: 0, h: 50, color: 'rgb(16, 32, 48)' });
  });

  it('falls back to a gradient when a colour is not hex or rgb', () => {
    const { ctx, rects, stops, gradients } = recorder();
    fillBands(ctx, 'rgba(0, 0, 0, 0.5)', '#ffffff', 0, 100, 100, 50);
    expect(gradients()).toBe(1);
    expect(stops).toEqual([
      [0, 'rgba(0, 0, 0, 0.5)'],
      [1, '#ffffff'],
    ]);
    expect(rects).toHaveLength(1);
    expect(rects[0]).toMatchObject({ y: 0, h: 100, w: 50 });
  });
});
