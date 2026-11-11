import { describe, expect, it } from 'vitest';
import { pickEleven } from './ai.ts';
import { FORMATIONS, FORMATION_SLOTS } from './formations.ts';
import { bestEleven, elevenStrength, generateSquad } from './generation.ts';
import { fit, POSITIONS, type Player } from './players.ts';
import { Rng, seedFromString } from './rng.ts';
import { naturalFirstEleven, selectionValue, winsTie } from './selection.ts';
import { fixedIdentitySource } from './testing/identity.ts';
import { testParams } from './testing/params.ts';
import { testPlayer, type MutablePlayer } from './testing/players.ts';
import type { Formation, Position } from './types.ts';

/*
 * T-082 (ADR-0022, item 5; docs/design/posicao-secundaria.md, "Escalação automática: natural
 * primeiro" and acceptance 5): the automatic XI puts the best of each position in its slot first,
 * and a player left out only takes a slot when he is worth strictly more there.
 *
 * `PROPERTY_FULL=1` runs the design's volume (4,000 generated squads, 10,000 random cases).
 */
const FULL = process.env.PROPERTY_FULL === '1';
const SQUADS = FULL ? 4000 : 400;
const CASES = FULL ? 10000 : 1000;

const params = testParams();
const identities = fixedIdentitySource();
const NO_ROTATION = { rotationCondition: 0, rotationMinRatio: 1 };

let nextId = 1;
function player(position: Position, overall: number, extra: Partial<MutablePlayer> = {}): Player {
  return testPlayer({ id: `c#${nextId++}`, position, overall, ...extra });
}

/** A full 4-4-2 squad of naturals at `overall`, plus `extra`. */
function squad442(overall: number, extra: readonly Player[] = []): Player[] {
  return [...FORMATION_SLOTS['4-4-2'].map((position) => player(position, overall)), ...extra];
}

const ids = (xi: readonly (Player | undefined)[]) => xi.map((p) => p?.id);

/**
 * The greedy fill of before T-082 (ia-clubes.md, step 3 as it was): slot by slot, the best of any
 * position. Only a reference to compare the new XI with; the engine no longer has it.
 */
function greedyEleven<T extends Player>(
  available: readonly T[],
  formation: Formation,
  value: (player: T, slot: Position) => number,
): T[] {
  const taken = new Set<number>();
  const eleven: T[] = [];
  for (const slot of FORMATION_SLOTS[formation]) {
    let best = -1;
    let bestValue = -1;
    available.forEach((p, i) => {
      if (taken.has(i)) return;
      const v = value(p, slot);
      if (best < 0 || v > bestValue || (v === bestValue && winsTie(p, i, available[best]!, best))) {
        best = i;
        bestValue = v;
      }
    });
    if (best < 0) break;
    taken.add(best);
    eleven.push(available[best]!);
  }
  return eleven;
}

const fresh = (p: Pick<Player, 'overall' | 'position'>, slot: Position) =>
  p.overall * fit(p.position, slot);

describe('naturalFirstEleven: the design examples', () => {
  it('keeps the DM of 78 in midfield and the CBs of 68 in defence (acceptance 5)', () => {
    const cbs = [player('CB', 68), player('CB', 68)];
    const dm78 = player('DM', 78, { secondaryPosition: 'CB' });
    const dm66 = player('DM', 66);
    const others = ['GK', 'FB', 'FB', 'DM', 'AM', 'AM', 'ST', 'ST'].map((p) =>
      player(p as Position, 70),
    );
    const available = [...others, dm66, ...cbs, dm78];
    // The greedy fill sent him to defence: 78 × 0.90 = 70.2 > 68.
    expect(selectionValue(dm78, 'CB')).toBeGreaterThan(selectionValue(cbs[0]!, 'CB'));
    expect(greedyEleven(available, '4-4-2', selectionValue).slice(1, 3)).toContain(dm78);

    const xi = naturalFirstEleven(available, '4-4-2', selectionValue);
    const slots = FORMATION_SLOTS['4-4-2'];
    expect(xi.filter((_, i) => slots[i] === 'CB')).toEqual(cbs);
    expect(xi.filter((_, i) => slots[i] === 'DM')).toContain(dm78);
    expect(xi).not.toContain(dm66);
    // The AI (pickEleven) and the "Sugerir escalação" pick the same XI.
    expect(ids(pickEleven(available, '4-4-2', params.ai).starters)).toEqual(ids(xi));
  });

  it('never swaps the goalkeeper of pass 1, even when an outfield player is worth more there', () => {
    const tired = player('GK', 40, { condition: 0 });
    const star = player('ST', 99);
    const available = squad442(70).filter((p) => p.position !== 'GK');
    available.push(tired, star);
    // 99 × 0.40 = 39.6 > 40 × 0.80 = 32.
    expect(selectionValue(star, 'GK')).toBeGreaterThan(selectionValue(tired, 'GK'));
    expect(naturalFirstEleven(available, '4-4-2', selectionValue)[0]).toBe(tired);
    // Even with a value that makes everyone else a better goalkeeper.
    const upside = (p: Player, slot: Position) => (p.position === slot ? 1 : 100);
    expect(naturalFirstEleven(available, '4-4-2', upside)[0]).toBe(tired);
  });

  it('without an available goalkeeper fills the goal last, with the best for goal of those left', () => {
    const available = squad442(70).filter((p) => p.position !== 'GK');
    const reserveSt = player('ST', 60);
    const reserveCb = player('CB', 65);
    available.push(reserveSt, reserveCb);
    const xi = naturalFirstEleven(available, '4-4-2', fresh);
    // The outfield slots keep their naturals of 70; the goal gets the best left (65 × 0.40).
    expect(xi.slice(1).every((p) => p !== undefined && p.overall === 70)).toBe(true);
    expect(xi[0]).toBe(reserveCb);
  });

  it('swaps in pass 2 only with a strictly higher value', () => {
    // Naturals are worth their overall; off their position only the two DMs below are worth
    // anything (40 and 40.5 at any other slot), and they lose the DM slots to the DMs of 70.
    const equal = player('DM', 60);
    const better = player('DM', 61);
    const offValue = new Map([
      [equal.id, 40],
      [better.id, 40.5],
    ]);
    const value = (p: Player, slot: Position) =>
      p.position === slot ? p.overall : (offValue.get(p.id) ?? 0);
    const natural = player('CB', 40);
    const available = squad442(70);
    available.splice(2, 1, natural); // the second CB is now worth 40 (slot 2)
    const xi = naturalFirstEleven([...available, equal], '4-4-2', value);
    expect(xi[2]).toBe(natural);
    expect(xi).not.toContain(equal);

    const swapped = naturalFirstEleven([...available, equal, better], '4-4-2', value);
    expect(swapped[2]).toBe(better);
    expect(swapped).not.toContain(natural);
    expect(swapped).not.toContain(equal);
  });

  it('lets the occupant who leaves take a later slot in the same pass', () => {
    // 3-4-3 has no AM slot, so the AM of 95 is left out of pass 1. At the third CB slot he is
    // worth 95 × 0.70 = 66.5 > 60 and takes it; the CB of 60 then takes the FB slot of the FB
    // of 45 (60 × 0.90 = 54 > 45).
    const am = player('AM', 95);
    const weakCb = player('CB', 60);
    const weakFb = player('FB', 45);
    const others = ['GK', 'CB', 'CB', 'FB', 'DM', 'DM', 'ST', 'ST', 'ST'].map((p) =>
      player(p as Position, 70),
    );
    const xi = naturalFirstEleven([...others, weakCb, weakFb, am], '3-4-3', fresh);
    expect(FORMATION_SLOTS['3-4-3'][3]).toBe('CB');
    expect(xi[3]).toBe(am);
    expect(FORMATION_SLOTS['3-4-3'][5]).toBe('FB');
    expect(xi[5]).toBe(weakCb);
    expect(xi).not.toContain(weakFb);
  });

  it('with injuries: an empty position is filled by the best of the others', () => {
    // No FB available: pass 1 leaves both FB slots empty, and pass 2 gives them the best left
    // for FB: CB 60 × 0.90 = 54, then AM 66 × 0.80 = 52.8 (ST 70 × 0.75 = 52.5 stays out).
    const available = squad442(70).filter((p) => p.position !== 'FB');
    const cb = player('CB', 60);
    const am = player('AM', 66);
    const st = player('ST', 70);
    available.push(st, am, cb);
    const xi = naturalFirstEleven(available, '4-4-2', fresh);
    expect(xi[3]).toBe(cb);
    expect(xi[4]).toBe(am);
    expect(xi).not.toContain(st);
    expect(xi.every((p) => p !== undefined)).toBe(true);
  });

  it('with fewer than 11: the greedy fill, the last slots empty, the goal never empty', () => {
    const withGk = [player('GK', 60), player('ST', 80), player('CB', 70), player('DM', 66)];
    const xi = naturalFirstEleven(withGk, '4-4-2', fresh);
    expect(ids(xi)).toEqual(
      ids([...greedyEleven(withGk, '4-4-2', fresh), ...Array.from({ length: 7 }, () => undefined)]),
    );
    expect(xi.slice(4)).toEqual(Array.from({ length: 7 }, () => undefined));

    const noGk = [player('ST', 80), player('CB', 70), player('DM', 66)];
    const short = naturalFirstEleven(noGk, '4-4-2', fresh);
    // Two outfield slots first (one kept for the goal), then the goal gets the last one: CB 70
    // (ST 80 × 0.65 = 52), then DM 66 × 0.90 = 59.4 > 52, and the ST goes to goal.
    expect(short[1]).toBe(noGk[1]);
    expect(short[2]).toBe(noGk[2]);
    expect(short[0]).toBe(noGk[0]);
    expect(short.slice(3).every((p) => p === undefined)).toBe(true);
    expect(naturalFirstEleven([], '4-4-2', fresh)).toEqual(
      Array.from({ length: 11 }, () => undefined),
    );
  });

  it('breaks ties by winsTie: higher overall, then younger, then lower id number', () => {
    const value = () => 50;
    const a = player('ST', 70, { id: 'x#10', age: 25 });
    const b = player('ST', 70, { id: 'x#2', age: 25 });
    const young = player('ST', 70, { id: 'x#30', age: 19 });
    const strong = player('ST', 71, { id: 'x#40', age: 33 });
    const base = squad442(60).filter((p) => p.position !== 'ST');
    const xi = naturalFirstEleven([...base, a, b, young, strong], '4-4-2', value);
    expect(ids(xi.slice(9))).toEqual(['x#40', 'x#30']);
    const twins = naturalFirstEleven([...base, a, b], '4-4-2', value);
    expect(ids(twins.slice(9))).toEqual(['x#2', 'x#10']);
  });

  it('is deterministic: the same input gives the same XI, in any order of the squad', () => {
    const rng = new Rng(seedFromString('natural-first-order'));
    for (let n = 0; n < 50; n++) {
      const available = randomPlayers(rng, 25);
      const formation = FORMATIONS[rng.int(0, FORMATIONS.length - 1)]!;
      const xi = ids(naturalFirstEleven(available, formation, selectionValue));
      expect(ids(naturalFirstEleven(available, formation, selectionValue))).toEqual(xi);
      const shuffled = [...available];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = rng.int(0, i);
        [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
      }
      expect(ids(naturalFirstEleven(shuffled, formation, selectionValue))).toEqual(xi);
    }
  });
});

describe('naturalFirstEleven: the callers use it with their own value', () => {
  it('pickEleven without rotation and bestEleven give its XI', () => {
    const rng = new Rng(seedFromString('natural-first-callers'));
    for (let n = 0; n < 200; n++) {
      const available = randomPlayers(rng, rng.int(0, 25));
      const formation = FORMATIONS[rng.int(0, FORMATIONS.length - 1)]!;
      const byValue = naturalFirstEleven(available, formation, selectionValue).filter(
        (p) => p !== undefined,
      );
      expect(ids(pickEleven(available, formation, NO_ROTATION).starters)).toEqual(ids(byValue));
      const byFresh = naturalFirstEleven(available, formation, fresh);
      const slots = FORMATION_SLOTS[formation];
      expect(bestEleven(available, formation)).toEqual(
        byFresh.flatMap((p, i) => (p === undefined ? [] : [{ player: p, slot: slots[i]! }])),
      );
    }
  });
});

/** `count` random players with distinct ids: any position, overall, age and condition. */
function randomPlayers(rng: Rng, count: number): Player[] {
  return Array.from({ length: count }, () =>
    player(POSITIONS[rng.int(0, POSITIONS.length - 1)]!, rng.int(40, 90), {
      age: rng.int(17, 38),
      condition: rng.int(0, 100),
    }),
  );
}

describe('naturalFirstEleven: properties', () => {
  it('always gives a valid XI with nobody repeated and no natural left out for a worse player', () => {
    const rng = new Rng(seedFromString('natural-first-property'));
    const failures: string[] = [];
    for (let n = 0; n < CASES && failures.length < 5; n++) {
      // Squads of 0 to 25, with up to 3 goalkeepers or none, as injuries leave them.
      const available = randomPlayers(rng, rng.int(0, 25));
      const formation = FORMATIONS[rng.int(0, FORMATIONS.length - 1)]!;
      const slots = FORMATION_SLOTS[formation];
      const xi = naturalFirstEleven(available, formation, selectionValue);
      const where = `case ${n} (${formation}, ${available.length} available)`;
      const placed = xi.filter((p): p is Player => p !== undefined);
      if (xi.length !== slots.length) failures.push(`${where}: ${xi.length} slots`);
      if (new Set(placed).size !== placed.length) failures.push(`${where}: repeated player`);
      if (placed.some((p) => !available.includes(p))) failures.push(`${where}: not available`);
      // Filled slots: all 11 with 11 or more; else the first ones, never leaving the goal empty.
      const filled = Math.min(slots.length, available.length);
      if (xi.some((p, i) => (p !== undefined) !== i < filled)) {
        failures.push(`${where}: empty slots out of place`);
      }
      if (available.length < slots.length) continue;
      const unused = available.filter((p) => !placed.includes(p));
      const goalkeepers = available.filter((p) => p.position === 'GK');
      if (goalkeepers.length > 0 && xi[0]!.position !== 'GK') {
        failures.push(`${where}: an outfield player in goal with a goalkeeper available`);
      }
      // Nobody out of his natural position while a natural of the slot left out is worth more.
      xi.forEach((p, i) => {
        const slot = slots[i]!;
        if (p!.position === slot) return;
        const worse = unused.find(
          (u) => u.position === slot && selectionValue(u, slot) > selectionValue(p!, slot),
        );
        if (worse !== undefined) {
          failures.push(`${where}: ${p!.id} at ${slot} with the natural ${worse.id} left out`);
        }
      });
      // No player left out is worth strictly more than an outfield starter of his own position.
      for (const u of unused) {
        xi.forEach((p, i) => {
          const slot = slots[i]!;
          if (i === 0 || u.position !== slot || p!.position !== slot) return;
          if (selectionValue(u, slot) > selectionValue(p!, slot)) {
            failures.push(`${where}: ${u.id} left out for the worse natural ${p!.id} at ${slot}`);
          }
        });
      }
    }
    expect(failures).toEqual([]);
  });

  it('with equal overall and condition, nobody plays out of position while a natural is left out', () => {
    const rng = new Rng(seedFromString('natural-first-equal'));
    const failures: string[] = [];
    for (let n = 0; n < CASES / 10 && failures.length < 5; n++) {
      const available = Array.from({ length: rng.int(11, 25) }, () =>
        player(POSITIONS[rng.int(0, POSITIONS.length - 1)]!, 70, { age: rng.int(17, 38) }),
      );
      const formation = FORMATIONS[rng.int(0, FORMATIONS.length - 1)]!;
      const slots = FORMATION_SLOTS[formation];
      const xi = naturalFirstEleven(available, formation, selectionValue);
      xi.forEach((p, i) => {
        const slot = slots[i]!;
        if (p!.position === slot) return;
        if (available.some((u) => !xi.includes(u) && u.position === slot)) {
          failures.push(`case ${n}: ${p!.id} at ${slot} with a natural left out`);
        }
      });
    }
    expect(failures).toEqual([]);
  });
});

describe('natural first on generated squads (acceptance 5)', () => {
  /** Generated squads on the 1a ladder, formations varied, as the design measured them. */
  function* squads(): Generator<{ players: Player[]; formation: Formation }> {
    for (let n = 0; n < SQUADS; n++) {
      const formation = FORMATIONS[n % FORMATIONS.length]!;
      const squad = generateSquad(
        {
          clubId: `clube-teste-${String((n % 20) + 1).padStart(2, '0')}`,
          seed: Math.floor(n / 20) + 1,
          strength: 64 + (n % 15),
          formation,
        },
        params,
        identities,
      );
      yield { players: squad.players, formation };
    }
  }

  it('full squads: fewer than 0.05 starters off their natural position per XI', () => {
    let off = 0;
    let count = 0;
    for (const { players, formation } of squads()) {
      const slots = FORMATION_SLOTS[formation];
      const xi = naturalFirstEleven(players, formation, fresh);
      off += xi.filter((p, i) => p!.position !== slots[i]).length;
      count++;
    }
    expect(off / count).toBeLessThan(0.05);
  });

  it('three starters out: the XI is at least as strong, on average, as the greedy fill', () => {
    const rng = new Rng(seedFromString('natural-first-three-out'));
    let natural = 0;
    let greedy = 0;
    for (const { players, formation } of squads()) {
      const slots = FORMATION_SLOTS[formation];
      const starters = naturalFirstEleven(players, formation, fresh);
      const out = new Set<Player>();
      while (out.size < 3) out.add(starters[rng.int(0, starters.length - 1)]!);
      const available = players.filter((p) => !out.has(p));
      const strength = (xi: readonly (Player | undefined)[]) =>
        elevenStrength(xi.map((p, i) => ({ player: p!, slot: slots[i]! })));
      natural += strength(naturalFirstEleven(available, formation, fresh));
      greedy += strength(greedyEleven(available, formation, fresh));
    }
    expect(natural).toBeGreaterThanOrEqual(greedy);
  });
});
