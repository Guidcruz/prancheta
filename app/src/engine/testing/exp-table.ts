import { EXP_CONSTANTS, exp } from '../math.ts';
import { Rng } from '../rng.ts';

/*
 * The table golden of the engine's exp (ADR-0020, test 3): 4,096 inputs and the bits of exp of
 * each one, the test that guarantees the portability. One place for the Vitest golden
 * (math.golden.test.ts) and for the browser page (tests/e2e/golden/page.ts, Chromium and
 * WebKit). It never compares with any Math.exp: the expected bits are frozen in
 * __golden__/exp-table.json. No node:fs or vitest here: it is bundled for the browser.
 *
 * Each entry is "<x> <exp(x)>", both as the 16 hex digits of the binary64 (big-endian), or "nan"
 * (the bits of a NaN are not fixed by the specification, so they are never compared). The inputs:
 * - the special cases (±0, ±1, ±Infinity, NaN, both thresholds and 1 ulp on each side, the
 *   subnormal results, the extreme k);
 * - the neighbours of the limits of the branches (0.5 ln 2, 1.5 ln 2 and 2^-28, both signs,
 *   ±8 ulps), and of the points where the general k = trunc(INV_LN2·x ± 0.5) changes: the first
 *   double with the new k near (m + 0.5) / INV_LN2, for m in -13..12 but -1 and 0 (those two fall
 *   in the k = 0 and k = ±1 branches), and ±2 ulps (2 inputs with the old k, 3 with the new);
 * - a seeded stratified grid on [-6, 6], the range of the game (the engine calls it with
 *   kChance·Δ/10 and kFinish·Δ/10);
 * - a seeded stratified grid on [U_THRESHOLD, O_THRESHOLD], the rest.
 */
export const EXP_TABLE_SIZE = 4096;
const GAME_GRID = 2048;
const SEED = 20261107;

const view = new DataView(new ArrayBuffer(8));
const MAGNITUDE = 0x7fffffffffffffffn;
const SIGN = -0x8000000000000000n;

/** The 16 hex digits of a double ("nan" for any NaN). */
export function doubleToHex(x: number): string {
  if (Number.isNaN(x)) return 'nan';
  view.setFloat64(0, x);
  const high = view.getUint32(0).toString(16).padStart(8, '0');
  const low = view.getUint32(4).toString(16).padStart(8, '0');
  return high + low;
}

/** The double of 16 hex digits ("nan" gives NaN). */
export function hexToDouble(hex: string): number {
  if (hex === 'nan') return Number.NaN;
  view.setUint32(0, Number.parseInt(hex.slice(0, 8), 16));
  view.setUint32(4, Number.parseInt(hex.slice(8, 16), 16));
  return view.getFloat64(0);
}

/**
 * The double `steps` ulps from a finite `x`, towards +Infinity (negative `steps`: towards
 * -Infinity). Doubles are ordered like sign-magnitude integers, so the bits become an ordered
 * integer (the magnitude, negated for a negative double), move, and come back.
 */
export function ulpStep(x: number, steps: number): number {
  view.setBigInt64(0, ordered(x) + BigInt(steps));
  const moved = view.getBigInt64(0);
  view.setBigInt64(0, moved < 0n ? -moved | SIGN : moved);
  return view.getFloat64(0);
}

/** The number of doubles between two finite doubles (0 when they are equal, ±0 included). */
export function ulpDistance(a: number, b: number): number {
  const d = ordered(a) - ordered(b);
  return Number(d < 0n ? -d : d);
}

function ordered(x: number): bigint {
  view.setFloat64(0, x);
  const bits = view.getBigInt64(0);
  return bits < 0n ? -(bits & MAGNITUDE) : bits;
}

/**
 * The k of the argument reduction of math.ts, replicated for the tests: 0 below 0.5 ln 2, ±1
 * below 1.5 ln 2, then trunc(INV_LN2·x ± 0.5). Test only: the engine has its own copy in `exp`.
 */
export function reductionK(x: number): number {
  const { HALF_LN2, THREE_HALVES_LN2, INV_LN2 } = EXP_CONSTANTS;
  const ax = x < 0 ? -x : x;
  if (ax < HALF_LN2) return 0;
  if (ax < THREE_HALVES_LN2) return x < 0 ? -1 : 1;
  return Math.trunc(INV_LN2 * x + (x < 0 ? -0.5 : 0.5));
}

/** How far (in ulps) {@link kSwitch} looks for the change of k around its estimate. */
const K_SWITCH_SEARCH = 64;

/**
 * The first double, going towards +Infinity, whose k differs from the k of the double before it,
 * near (m + 0.5) / INV_LN2, where INV_LN2·x ± 0.5 crosses an integer (for m >= 1, from k = m to
 * m + 1; for m <= -2, from k = m to m + 1 as well, since k grows with x). Throws (a test bug) if
 * there is not exactly one change within ±64 ulps of the estimate.
 */
export function kSwitch(m: number): number {
  const estimate = (m + 0.5) / EXP_CONSTANTS.INV_LN2;
  const found: number[] = [];
  let previous = reductionK(ulpStep(estimate, -K_SWITCH_SEARCH - 1));
  for (let d = -K_SWITCH_SEARCH; d <= K_SWITCH_SEARCH; d++) {
    const x = ulpStep(estimate, d);
    const k = reductionK(x);
    if (k !== previous) found.push(x);
    previous = k;
  }
  if (found.length !== 1) {
    throw new Error(`k changes ${found.length} times near (${m} + 0.5) / INV_LN2`);
  }
  return found[0]!;
}

/** The special inputs and the neighbours of the limits of k (see the header). */
function edgeInputs(): number[] {
  const { O_THRESHOLD, U_THRESHOLD, TINY, HALF_LN2, THREE_HALVES_LN2 } = EXP_CONSTANTS;
  const out: number[] = [
    0,
    -0,
    1,
    -1,
    Infinity,
    -Infinity,
    Number.NaN,
    Number.MIN_VALUE,
    -Number.MIN_VALUE,
    2.2250738585072014e-308,
    Number.MAX_VALUE,
    -Number.MAX_VALUE,
    -708.3964185322641, // e^x near the smallest normal
    -740, // a subnormal result
    -745, // the smallest subnormals
    709.7, // k = 1024
  ];
  for (const limit of [O_THRESHOLD, U_THRESHOLD]) {
    for (let d = -1; d <= 1; d++) out.push(ulpStep(limit, d));
  }
  for (const limit of [TINY, HALF_LN2, THREE_HALVES_LN2]) {
    for (let d = -8; d <= 8; d++) {
      const x = ulpStep(limit, d);
      out.push(x, -x);
    }
  }
  for (let m = -13; m <= 12; m++) {
    if (m === -1 || m === 0) continue;
    const point = kSwitch(m);
    for (let d = -2; d <= 2; d++) out.push(ulpStep(point, d));
  }
  return out;
}

/** A seeded stratified grid of `n` points on [a, b]: one point in each of n equal cells. */
function grid(rng: Rng, n: number, a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = rng.next() + rng.next() / 4294967296;
    out.push(a + ((b - a) * (i + u)) / n);
  }
  return out;
}

/** The 4,096 inputs of the table, always the same. */
export function expTableInputs(): number[] {
  const rng = new Rng(SEED);
  const edges = edgeInputs();
  const game = grid(rng, GAME_GRID, -6, 6);
  const wide = grid(
    rng,
    EXP_TABLE_SIZE - GAME_GRID - edges.length,
    EXP_CONSTANTS.U_THRESHOLD,
    EXP_CONSTANTS.O_THRESHOLD,
  );
  return [...edges, ...game, ...wide];
}

/** The data of the exp-table golden: "<x> <exp(x)>" per input. */
export function expTable(): string[] {
  return expTableInputs().map((x) => `${doubleToHex(x)} ${doubleToHex(exp(x))}`);
}
