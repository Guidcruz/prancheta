import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CREST_PATTERNS, Rng, type ClubDef } from '../../engine/index.ts';
import forbidden from './kit.forbidden.json';
import {
  KIT_COLLARS,
  KIT_GK_PALETTE,
  KIT_MIN_DISTANCE,
  KIT_NUMBER_CONTRAST,
  KIT_PATTERNS,
  KIT_PATTERN_OF_CREST,
  KIT_PITCH_NIGHT,
  KIT_RING_CONTRAST,
  KIT_WEIGHTS,
  colorDistance,
  fieldKit,
  goalkeeperKit,
  kitConflict,
  kitSvg,
  kitsFor,
  matchKits,
  thirdKit,
  type FieldKit,
  type Kit,
  type KitClub,
  type KitPattern,
} from './kit';
import { contrastRatio } from './shield';

const clubs = JSON.parse(
  readFileSync(new URL('../../data/clubs.serie-a.json', import.meta.url), 'utf8'),
) as ClubDef[];
const DAY = '#177a42';
const NIGHT = KIT_PITCH_NIGHT;
const WHITE = '#ffffff';
const DARK = '#111417';
const INK = '#0b1118';

const pairs = clubs.flatMap((h) => clubs.filter((v) => v !== h).map((v) => [h, v] as const));
const synth = (id: string, colors: [string, string], crestPattern = 'none'): KitClub =>
  ({ id, colors, crestPattern }) as KitClub;
const allKits = (c: KitClub): Kit[] => {
  const { home, away } = kitsFor(c);
  return [home, away, thirdKit(home), goalkeeperKit(c, [home.base])];
};

/** Minimal well-formedness check: balanced, properly nested tags. */
function wellFormed(svg: string): boolean {
  const stack: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g)) {
    const [, close, name, , self] = m;
    if (self) continue;
    if (close) {
      if (stack.pop() !== name) return false;
    } else stack.push(name!);
  }
  return stack.length === 0;
}
const tags = (svg: string) => (svg.match(/<[a-zA-Z]/g) ?? []).length;
const hash = (text: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

// 1
describe('kit: stability and golden (US-002)', () => {
  it('draws the same SVG twice and in any list order', () => {
    const order = new Rng(7).shuffle([...clubs]);
    for (const club of clubs) {
      const a = kitsFor(club);
      const b = kitsFor(order.find((c) => c.id === club.id)!);
      expect(kitSvg(a.home, 96)).toBe(kitSvg(a.home, 96));
      expect(kitSvg(a.home, 96)).toBe(kitSvg(b.home, 96));
      expect(kitSvg(a.away, 24)).toBe(kitSvg(b.away, 24));
    }
  });

  it('matches the golden of the 20 clubs x 2 kits (changes only with art-director review)', async () => {
    const lines = clubs.flatMap((c) => {
      const { home, away } = kitsFor(c);
      return [home, away].map(
        (k) =>
          `${c.id} ${k.slot} ${k.base} ${k.secondary} ${k.pattern} ${k.collar} ${k.shorts} svg96:${hash(kitSvg(k, 96))} svg24:${hash(kitSvg(k, 24))}`,
      );
    });
    await expect(`${lines.join('\n')}\n`).toMatchFileSnapshot('./__fixtures__/kit.golden.snap');
  });

  it('keeps one full SVG per slot as a visual golden', async () => {
    const c = clubs[0]!;
    const svgs = allKits(c).map((k) => `${k.slot}\n${kitSvg(k, 48)}`);
    await expect(`${svgs.join('\n')}\n`).toMatchFileSnapshot('./__fixtures__/kit.svg.snap');
  });
});

// 2 and 3
describe('kit: never the pattern of the crest', () => {
  it('keeps both kits of every club off the crest pattern, and different from each other', () => {
    for (const c of clubs) {
      const { home, away } = kitsFor(c);
      const banned = KIT_PATTERN_OF_CREST[c.crestPattern];
      expect(banned, c.id).not.toContain(home.pattern);
      expect(banned, c.id).not.toContain(away.pattern);
      expect(away.pattern, c.id).not.toBe(home.pattern);
    }
  });

  it('never draws hoops for a club whose crest has hoops (ids 0..2000)', () => {
    for (let i = 0; i <= 2000; i++) {
      const { home, away } = kitsFor(synth(String(i), ['#c8102e', '#111417'], 'hoops'));
      expect(home.pattern).not.toBe('hoops');
      expect(away.pattern).not.toBe('hoops');
    }
  });

  it('has a decision for every crest pattern (a new crest pattern fails here)', () => {
    for (const p of CREST_PATTERNS) {
      expect(KIT_PATTERN_OF_CREST[p], p).toBeDefined();
      expect(KIT_PATTERN_OF_CREST[p].length, p).toBeGreaterThan(0);
    }
    expect(Object.keys(KIT_PATTERN_OF_CREST).sort()).toEqual([...CREST_PATTERNS].sort());
  });
});

// 4
describe('kit: distribution', () => {
  it('uses every pattern within 30% of its weight (5,000 ids, no crest exclusion)', () => {
    const counts = new Map<KitPattern, number>();
    const n = 5000;
    for (let i = 0; i < n; i++) {
      const p = kitsFor(synth(`club-${i}`, ['#c8102e', '#111417'], 'x')).home.pattern;
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    for (const p of KIT_PATTERNS) {
      const expected = (KIT_WEIGHTS[p] / 100) * n;
      expect(counts.get(p) ?? 0, p).toBeGreaterThan(expected * 0.7);
      expect(counts.get(p) ?? 0, p).toBeLessThan(expected * 1.3);
    }
    expect(KIT_PATTERNS.reduce((s, p) => s + KIT_WEIGHTS[p], 0)).toBe(100);
  });

  it('spreads the 20 real clubs over at least 5 patterns and the 3 collars', () => {
    expect(new Set(clubs.map((c) => kitsFor(c).home.pattern)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(clubs.map((c) => kitsFor(c).home.collar)).size).toBe(KIT_COLLARS.length);
  });

  it('gives rivals and same-city clubs different (base, pattern) in kit 1', () => {
    const sig = (c: ClubDef) => `${kitsFor(c).home.base.toLowerCase()} ${kitsFor(c).home.pattern}`;
    const byId = new Map(clubs.map((c) => [c.id, c]));
    for (const c of clubs) {
      const others = clubs.filter(
        (o) => o !== c && (c.rivals.includes(o.id) || o.rivals.includes(c.id) || o.city === c.city),
      );
      for (const o of others) expect(sig(c), `${c.id} x ${o.id}`).not.toBe(sig(byId.get(o.id)!));
    }
  });
});

// 5
describe('kit: colour distance', () => {
  it('is symmetric, zero on itself and matches the measured values', () => {
    expect(colorDistance('#c8102e', '#c8102e')).toBe(0);
    expect(colorDistance('#c8102e', '#111417')).toBeCloseTo(colorDistance('#111417', '#c8102e'));
    // The design note says 94; delta E76 (D65) of white x black is 100.
    expect(colorDistance(WHITE, '#000000')).toBeGreaterThan(99);
    expect(colorDistance(WHITE, '#000000')).toBeLessThan(101);
    expect(colorDistance('#C8102E', '#E4002B')).toBeLessThan(15);
    expect(colorDistance('#C8102E', '#E5050F')).toBeLessThan(KIT_MIN_DISTANCE);
  });

  it('turns invalid input into grey, never NaN', () => {
    for (const bad of ['#xyz', '', 'url(javascript:1)', null, undefined] as unknown as string[]) {
      expect(colorDistance(bad, '#777777')).toBe(0);
      expect(Number.isFinite(colorDistance(bad, WHITE))).toBe(true);
    }
  });
});

// 6
describe('kit 2', () => {
  it('is at least 30 away from kit 1 in every real club', () => {
    for (const c of clubs) {
      const { home, away } = kitsFor(c);
      expect(colorDistance(home.base, away.base), c.id).toBeGreaterThanOrEqual(KIT_MIN_DISTANCE);
    }
  });
});

// 7
describe('kit: who changes in the 380 matches (US-002)', () => {
  const results = pairs.map(([h, v]) => ({ h, v, m: matchKits(h, v) }));

  it('never leaves a conflict; the home side always wears kit 1; the visitor follows 1, 2, 3', () => {
    expect(results).toHaveLength(380);
    for (const { h, v, m } of results) {
      const name = `${h.id} x ${v.id}`;
      expect(kitConflict(m.kits.home, m.kits.away), name).toBe(false);
      expect(m.kits.home, name).toEqual(kitsFor(h).home);
      const a1 = kitsFor(v).home;
      const a2 = kitsFor(v).away;
      if (!kitConflict(m.kits.home, a1)) expect(m.awaySlot, name).toBe('home');
      else if (!kitConflict(m.kits.home, a2)) expect(m.awaySlot, name).toBe('away');
      else expect(m.awaySlot, name).toBe('third');
    }
  });

  it('pins who needs kit 2 and kit 3 today (a change goes to the art-director)', () => {
    const away = results.filter((r) => r.m.awaySlot === 'away').length;
    const third = results
      .filter((r) => r.m.awaySlot === 'third')
      .map((r) => `${r.h.id} x ${r.v.id}`);
    expect({ away, third }).toEqual({
      away: 44,
      third: [
        'corinto x botafogueira',
        'corinto x vasconcelos',
        'corinto x santoes',
        'santoes x corinto',
        'cruzador x remador',
        'tufao x sao-paulao',
      ],
    });
  });

  it('gives kit 3 to a club against itself when kit 2 conflicts, and to equal colours', () => {
    for (const c of clubs) {
      const same = matchKits(c, c);
      expect(kitConflict(same.kits.home, same.kits.away), c.id).toBe(false);
      expect(same.awaySlot === 'third', c.id).toBe(
        kitConflict(kitsFor(c).home, kitsFor(c).home) &&
          kitConflict(kitsFor(c).home, kitsFor(c).away),
      );
    }
    expect(matchKits(clubs[1]!, clubs[1]!).awaySlot).toBe('third');
    const twinA = synth('twin-a', ['#336699', '#336699']);
    const twinB = synth('twin-b', ['#336699', '#336699']);
    const m = matchKits(twinA, twinB);
    expect(m.awaySlot).toBe('third');
    expect(m.kits.away.slot).toBe('third');
    expect(kitConflict(m.kits.home, m.kits.away)).toBe(false);
  });

  it('finds a kit 3 free of conflict against extreme colours', () => {
    const extremes = ['#000000', WHITE, '#808080', '#ffd400', '#777777', '#ff0000', '#00ff00'];
    for (const x of extremes) {
      for (const y of extremes) {
        for (let i = 0; i < 12; i++) {
          const c = synth(`ext-${i}`, [x, y]);
          const home = kitsFor(c).home;
          expect(kitConflict(home, thirdKit(home)), `${x} ${y} ${home.pattern}`).toBe(false);
        }
      }
    }
  });
});

// 8
describe('kit: goalkeepers', () => {
  it('keeps the goalkeepers apart from the line kits, the pitch and each other', () => {
    for (const pitch of [NIGHT, DAY]) {
      for (const { h, v, m } of pairs.map(([h, v]) => ({ h, v, m: matchKits(h, v, { pitch }) }))) {
        const line = [m.home.fill, m.away.fill, m.home.stripe, m.away.stripe].filter(
          (c): c is string => c !== null,
        );
        for (const gk of [m.homeGk, m.awayGk]) {
          expect(gk.slot).toBe('gk');
          expect(gk.stripe).toBeNull();
          expect(KIT_GK_PALETTE.map((c) => c.toLowerCase())).toContain(gk.fill.toLowerCase());
          for (const c of [...line, pitch, NIGHT, DAY]) {
            expect(
              colorDistance(gk.fill, c),
              `${h.id} x ${v.id} ${gk.fill} ${c}`,
            ).toBeGreaterThanOrEqual(KIT_MIN_DISTANCE);
          }
        }
        expect(colorDistance(m.homeGk.fill, m.awayGk.fill)).toBeGreaterThanOrEqual(
          KIT_MIN_DISTANCE,
        );
      }
    }
  });

  it('keeps the colour of a club when nothing conflicts, and has no green in the palette', () => {
    const c = clubs[0]!;
    const free = goalkeeperKit(c, ['#000000']);
    expect(goalkeeperKit(c, ['#000000']).base).toBe(free.base);
    for (const p of KIT_GK_PALETTE) {
      expect(colorDistance(p, NIGHT)).toBeGreaterThanOrEqual(58);
      expect(colorDistance(p, DAY)).toBeGreaterThanOrEqual(58);
    }
  });

  it('still returns a palette colour when every colour is surrounded', () => {
    const gk = goalkeeperKit(clubs[0]!, [...KIT_GK_PALETTE]);
    expect(KIT_GK_PALETTE).toContain(gk.base);
    expect(gk.pattern).toBe('plain');
  });
});

// 9
describe('kit: number and ring', () => {
  const fields = (f: FieldKit) => [f.fill, ...(f.stripe ? [f.stripe] : [])];
  const check = (f: FieldKit, pitch: string, name: string) => {
    if (f.numberPlate === null) {
      for (const c of fields(f)) {
        expect(contrastRatio(f.numberColor, c), name).toBeGreaterThanOrEqual(KIT_NUMBER_CONTRAST);
      }
    } else {
      expect(contrastRatio(f.numberColor, f.numberPlate), name).toBeGreaterThanOrEqual(
        KIT_NUMBER_CONTRAST,
      );
    }
    expect(contrastRatio(f.ring, pitch), name).toBeGreaterThanOrEqual(KIT_RING_CONTRAST);
  };

  it('reaches 4.5:1 for every real kit, kit 3 and goalkeeper, on both pitches', () => {
    for (const c of clubs) {
      for (const k of allKits(c)) {
        for (const pitch of [NIGHT, DAY]) check(fieldKit(k, pitch), pitch, `${c.id} ${k.slot}`);
      }
    }
  });

  it('needs a plate only in double-mass patterns, never in plain-mass kits or goalkeepers', () => {
    let plates = 0;
    for (const c of clubs) {
      for (const k of allKits(c)) {
        const plate = fieldKit(k).numberPlate;
        if (plate !== null) {
          plates++;
          expect(['hoops', 'vstripes', 'halves'], `${c.id} ${k.slot}`).toContain(k.pattern);
        }
      }
    }
    // measured: 14 of the 80 real kits (the design note expected none)
    expect(plates).toBe(14);
  });

  it('uses a plate when no colour reaches 4.5:1 on both colours of the dot', () => {
    const grey = '#808080';
    const k: Kit = {
      clubId: 'x',
      slot: 'home',
      base: '#000000',
      secondary: WHITE,
      pattern: 'hoops',
      collar: 'round',
      shorts: grey,
      socks: grey,
    };
    const f = fieldKit(k);
    expect(f.stripe).toBe(WHITE);
    expect(f.numberPlate).not.toBeNull();
    check(f, NIGHT, 'plate');
    for (const [a, b] of [
      ['#808080', '#808080'],
      ['#ffd400', '#808080'],
      ['#000000', '#ffffff'],
    ] as const) {
      for (const pattern of ['plain', 'hoops'] as const) {
        check(fieldKit({ ...k, base: a, secondary: b, pattern }), NIGHT, `${a} ${b} ${pattern}`);
      }
    }
  });

  it('uses a white ring on a pitch where the ink ring would vanish', () => {
    expect(fieldKit(allKits(clubs[0]!)[0]!, '#05080c').ring).toBe(WHITE);
    expect(fieldKit(allKits(clubs[0]!)[0]!, NIGHT).ring).toBe(INK);
  });
});

// 10
describe('kit: determinism and purity', () => {
  it('returns the same data 1,000 times and does not change frozen input', () => {
    const a = Object.freeze({ ...clubs[3]!, colors: Object.freeze([...clubs[3]!.colors]) });
    const b = Object.freeze({ ...clubs[4]! });
    const first = JSON.stringify(matchKits(a as unknown as KitClub, b as unknown as KitClub));
    for (let i = 0; i < 1000; i++) {
      expect(JSON.stringify(matchKits(a as unknown as KitClub, b as unknown as KitClub))).toBe(
        first,
      );
    }
    expect(a.colors).toEqual(clubs[3]!.colors);
  });
});

// 11
describe('kit: safe SVG (US-002)', () => {
  const FORBIDDEN = [
    /<script/i,
    /<foreignObject/i,
    /<image/i,
    /<text/i,
    /href/i,
    /xlink/i,
    /javascript:/i,
    /\son\w+=/i,
    /url\(http/i,
    /@import/i,
    /<style/i,
    /NaN|undefined|Infinity/,
  ];

  it('is well formed, free of forbidden content and uses only allowed colours', () => {
    for (const c of clubs) {
      for (const k of allKits(c)) {
        const allowed = new Set(
          [k.base, k.secondary, k.shorts, k.socks, INK, WHITE, DARK].map((x) => x.toLowerCase()),
        );
        for (const size of [24, 32, 48, 96]) {
          const svg = kitSvg(k, size);
          const name = `${c.id} ${k.slot} ${size}`;
          expect(svg, name).toMatch(/^<svg [^>]*viewBox="0 0 64 72"/);
          expect(wellFormed(svg), name).toBe(true);
          for (const re of FORBIDDEN) expect(svg, `${name} ${re}`).not.toMatch(re);
          for (const m of svg.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
            expect(allowed, `${name} ${m[0]}`).toContain(m[0].toLowerCase());
          }
          expect(svg.length, name).toBeLessThanOrEqual(size <= 32 ? 2200 : 3500);
        }
        expect(tags(kitSvg(k, 24)), `${c.id} ${k.slot}`).toBeLessThan(tags(kitSvg(k, 64)));
      }
    }
  });

  it('escapes the label and keeps ids unique between instances', () => {
    const k = kitsFor(clubs[0]!).home;
    const svg = kitSvg(k, 64, { label: `<b>&"'` });
    expect(svg).toContain('role="img" aria-label="&lt;b&gt;&amp;&quot;&#39;"');
    expect(svg).not.toContain('<b>');
    expect(kitSvg(k, 64)).toContain('aria-hidden="true"');
    const ids = (s: string) => [...s.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]!);
    const [a, b] = [kitSvg(k, 64, { instance: 'a' }), kitSvg(k, 64, { instance: 'b' })];
    expect(ids(a).filter((id) => ids(b).includes(id))).toEqual([]);
    expect(
      ids(kitSvg(kitsFor(clubs[0]!).away, 64)).filter((i) => ids(kitSvg(k, 64)).includes(i)),
    ).toEqual([]);
  });

  it('turns out-of-range sizes into 64', () => {
    const k = kitsFor(clubs[0]!).home;
    for (const s of [0, 8, 1000, Number.NaN, Infinity]) {
      expect(kitSvg(k, s)).toContain('width="64"');
    }
  });

  it('survives hostile colours, ids and patterns, falling back to grey', () => {
    const hostile = [
      ['url(javascript:alert(1))', '#xyz'],
      ['', ''],
      [null, undefined],
    ] as unknown as [string, string][];
    for (const colors of hostile) {
      const club = { id: '"><script>', colors, crestPattern: 'nope' } as unknown as KitClub;
      const m = matchKits(club, club);
      expect(m.home.fill).toBe('#777777');
      for (const k of Object.values(m.kits)) {
        const svg = kitSvg(k, 64, { label: 'x', instance: '"><script>' });
        expect(svg).not.toMatch(/<script|javascript|url\(j/i);
        expect(wellFormed(svg)).toBe(true);
      }
    }
    const broken = { ...kitsFor(clubs[0]!).home, pattern: 'zzz', collar: 'zzz', slot: '"<' };
    expect(wellFormed(kitSvg(broken as unknown as Kit, 64))).toBe(true);
  });
});

// 12
describe('kit: forbidden signatures (no real kit)', () => {
  type Sig = { code: string; pattern: string; base: string; secondary: string };
  const hits = (list: Sig[], kits: Kit[]) =>
    kits.filter((k) =>
      list.some(
        (s) =>
          s.pattern === k.pattern &&
          s.base.toLowerCase() === k.base.toLowerCase() &&
          s.secondary.toLowerCase() === k.secondary.toLowerCase(),
      ),
    );

  it('has no kit of the 20 clubs that matches a forbidden signature', () => {
    const list = forbidden.signatures as Sig[];
    expect(Array.isArray(list)).toBe(true);
    const kits = clubs.flatMap((c) => Object.values(kitsFor(c)));
    expect(hits(list, kits).map((k) => `${k.clubId} ${k.slot}`)).toEqual([]);
  });

  it('is alive: a synthetic signature makes the check fail', () => {
    const k = kitsFor(clubs[0]!).home;
    const sig = { code: 'TEST', pattern: k.pattern, base: k.base, secondary: k.secondary };
    expect(hits([sig], [k])).toHaveLength(1);
  });

  it('puts no text, number or brand in the SVG', () => {
    for (const c of clubs) {
      for (const k of allKits(c)) expect(kitSvg(k, 96, { label: 'x' })).not.toMatch(/<text|<tspan/);
    }
  });
});

// 13
describe('kit: the catalogue only grows', () => {
  const fixture = readFileSync(new URL('./__fixtures__/kit.catalog.snap', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '' && !l.startsWith('#'))
    .map((l) => l.trim().split(/\s+/) as [string, string]);

  it('keeps every pattern of the fixture at its index', () => {
    expect(fixture.map(([, name]) => name)).toEqual(KIT_PATTERNS.slice(0, fixture.length));
    expect(KIT_PATTERNS.length).toBeGreaterThanOrEqual(fixture.length);
  });

  it('lists the current catalogue exactly: growing it updates the fixture in the same PR', () => {
    expect(fixture.map(([i, name]) => `${i} ${name}`)).toEqual(
      KIT_PATTERNS.map((p, i) => `${i} ${p}`),
    );
    expect(Object.keys(KIT_WEIGHTS)).toEqual([...KIT_PATTERNS]);
  });
});
