import { describe, expect, it } from 'vitest';
import {
  FORMATION_SLOTS,
  MATCH_MODES,
  completeSheet,
  draftFromSheet,
  fitLevel,
  sheetProblems,
  playRound,
  prepareRound,
  sheetStrength,
  suggestSheet,
  type DraftSheet,
  type GameState,
  type TeamSheet,
} from '@engine';
import { t } from '@lib/i18n';
import { loadGameParams } from '@lib/params';
import { SECTOR_OF } from './components/sectors';
import {
  benchLines,
  benchRows,
  cardOrder,
  coachSheet,
  incompleteMessage,
  lineupIssues,
  nameList,
  outPlayers,
  pitchSlots,
  restedPlayers,
  shownStrength,
  strengthChange,
  strengthItems,
  suggestedSheet,
  swapPlaces,
  OUT_FREE,
  benchCount,
  placeKey,
  type Place,
} from './lineup';
import { TEST_CLUB, testCareer, withPlayer } from './testing/game';
import { lineupFixture } from './testing/lineup';

/*
 * The reads and the swap of the Escalação (escalacao.md; US-017) on a real career with the
 * fixture of the E2E: the places and their order, the refusal of who cannot play, the role
 * lists, the strength from the engine rounded, the warnings by `fitLevel` and the trait, the
 * suggestion that keeps the formation and the tactic.
 */

const params = loadGameParams();
const TIRED = params.ai.rotationCondition;
const fx = lineupFixture(testCareer('full', 1));
const { game, sheet } = fx;
const slot = (index: number): Place => ({ part: 'starters', index });
const bench = (index: number): Place => ({ part: 'bench', index });
const out = (id: string): Place => ({ part: 'out', id });

function ok(result: ReturnType<typeof swapPlaces>) {
  if (result === undefined || !result.ok) throw new Error('expected a swap');
  return result;
}

describe('the sheet shown (coachSheet; ADR-0021)', () => {
  it('without a draft, the engine suggestion for the coach, as the round would play it', () => {
    const shown = coachSheet(game, TEST_CLUB, undefined, params);
    const suggestion = suggestSheet(game, params, TEST_CLUB, undefined, { controller: 'human' });
    expect(shown.lineup.starters).toEqual(suggestion.lineup.starters);
    expect(shown.lineup.bench.filter((id) => id !== null)).toEqual(suggestion.lineup.bench);
    expect(shown.lineup.bench).toHaveLength(7);
    expect(sheetProblems(game, TEST_CLUB, shown).ready).toBe(true);
  });

  it('a draft is reconciled: an id out of the squad is a free place', () => {
    const stranger = Object.entries(game.squads).find(([id]) => id !== TEST_CLUB)![1][0]!;
    const draft: DraftSheet = {
      ...sheet,
      lineup: { ...sheet.lineup, starters: [stranger, ...sheet.lineup.starters.slice(1)] },
    };
    expect(coachSheet(game, TEST_CLUB, draft, params).lineup.starters[0]).toBeNull();
  });
});

describe('the untouched sheet is the one the round plays (ADR-0021, "Ausente")', () => {
  // Without a draft the frame plays without a sheet, so the engine's own suggestion goes to the
  // match: the screen must show exactly that one, lineup and tactic.
  const asDraft = (s: TeamSheet) => draftFromSheet(s);
  for (const round of [1, 5, 20]) {
    for (const mode of MATCH_MODES) {
      it(`round ${round}, ${mode}: prepareRound's suggestion and the lastSheets of a round played`, () => {
        const state = testCareer('full', round);
        const coaches = { [TEST_CLUB]: mode };
        const shown = coachSheet(state, TEST_CLUB, undefined, params);
        const plan = prepareRound(state, params, { coaches });
        if (!plan.ok) throw new Error(plan.error);
        expect(shown).toEqual(asDraft(plan.value.suggested[TEST_CLUB]!));
        const played = playRound(state, params, {
          round: state.round,
          sheets: {},
          commands: {},
          fanDecisions: {},
          coaches,
        });
        if (!played.ok) throw new Error(played.error);
        expect(shown).toEqual(asDraft(played.value.state.lastSheets[TEST_CLUB]!));
      });
    }
  }
});

describe('the places (escalacao.md, "Conteúdo")', () => {
  it('the bench by position (GOL to ATA) and overall, then the free places', () => {
    const lines = benchLines(game, sheet);
    expect(lines).toHaveLength(7);
    expect(lines.at(-1)).toEqual({ index: 6 });
    const positions = lines.slice(0, 6).map((l) => l.player!.position);
    expect(positions).toEqual(['GK', 'CB', 'FB', 'DM', 'ST', 'ST']);
    const [a, b] = lines.slice(4, 6).map((l) => l.player!.overall);
    expect(a).toBeGreaterThanOrEqual(b!);
  });

  it('the players left out are the rest of the squad, in the same order', () => {
    const rest = outPlayers(game, TEST_CLUB, sheet);
    expect(rest).toHaveLength(25 - 11 - 6);
    expect(rest.map((p) => p.id)).toContain(fx.injured.id);
    expect(rest.map((p) => p.id)).toContain(fx.suspended.id);
  });

  it('the card walks the pitch in slot order, then the bench, then the players left out', () => {
    const order = cardOrder(game, TEST_CLUB, sheet);
    expect(order).toHaveLength(25);
    expect(new Set(order).size).toBe(25);
    expect(order.slice(0, 11)).toEqual(sheet.lineup.starters);
    expect(order[11]).toBe(benchLines(game, sheet)[0]!.player!.id);
  });
});

describe('the swap (escalacao.md, "Trocar lugares")', () => {
  it('a reserve and a starter change places', () => {
    const result = ok(swapPlaces(game, sheet, bench(4), slot(10)));
    expect(result.kind).toBe('swap');
    expect(result.sheet.lineup.starters[10]).toBe(fx.bench[4]!.id);
    expect(result.sheet.lineup.bench[4]).toBe(fx.starters[10]!.id);
    expect(result.moved).toBe(fx.bench[4]!.id);
    expect(result.other).toBe(fx.starters[10]!.id);
    expect(result.to).toBe('starters');
    // The sheet given is never changed.
    expect(sheet.lineup.starters[10]).toBe(fx.starters[10]!.id);
  });

  it('the same result whichever place comes first', () => {
    const a = ok(swapPlaces(game, sheet, bench(4), slot(10)));
    const b = ok(swapPlaces(game, sheet, slot(10), bench(4)));
    expect(a.sheet).toEqual(b.sheet);
  });

  it('to a free place the player only moves, and his place becomes free', () => {
    const result = ok(swapPlaces(game, sheet, slot(1), bench(6)));
    expect(result.kind).toBe('move');
    expect(result.to).toBe('bench');
    expect(result.sheet.lineup.starters[1]).toBeNull();
    expect(result.sheet.lineup.bench[6]).toBe(fx.starters[1]!.id);
    const back = ok(swapPlaces(game, result.sheet, bench(3), slot(1)));
    expect(back.kind).toBe('move');
    expect(back.from).toBe('bench');
    expect(back.to).toBe('starters');
    expect(back.arrived).toEqual(slot(1));
    // Inside the bench nothing changes: the bench is shown by position.
    expect(swapPlaces(game, sheet, bench(2), bench(6))).toBeUndefined();
  });

  it('"Deixar de fora" takes a starter or a reserve out, with no swap (escalacao.md)', () => {
    const fromPitch = ok(swapPlaces(game, sheet, slot(7), OUT_FREE));
    expect(fromPitch).toMatchObject({ kind: 'move', from: 'starters', to: 'out-free' });
    expect(fromPitch.sheet.lineup.starters[7]).toBeNull();
    expect(outPlayers(game, TEST_CLUB, fromPitch.sheet).map((p) => p.id)).toContain(
      fx.starters[7]!.id,
    );
    // Either order: the free place only receives.
    expect(ok(swapPlaces(game, sheet, OUT_FREE, slot(7))).sheet).toEqual(fromPitch.sheet);
    const fromBench = ok(swapPlaces(game, sheet, bench(0), OUT_FREE));
    expect(fromBench.sheet.lineup.bench[0]).toBeNull();
    // Who leaves the pitch leaves the role lists, as in a swap.
    const lists = { ...sheet, lineup: { ...sheet.lineup, captains: [fx.starters[7]!.id] } };
    expect(ok(swapPlaces(game, lists, slot(7), OUT_FREE)).removed).toEqual([
      { role: 'captain', player: fx.starters[7]!.id },
    ]);
    // An injured reserve leaves without a refusal.
    const hurt = withPlayer(game, fx.bench[0]!.id, { injuryRounds: 2 });
    expect(swapPlaces(hurt, sheet, bench(0), OUT_FREE)?.ok).toBe(true);
    // A player already left out: nothing changes.
    expect(swapPlaces(game, sheet, out(fx.injured.id), OUT_FREE)).toBeUndefined();
    expect(placeKey(OUT_FREE)).toBe('out-free');
  });

  it('the whole bench can be left out: no problem for the round (banco vazio)', () => {
    let next = sheet;
    for (let i = 0; i < 6; i++) next = ok(swapPlaces(game, next, bench(i), OUT_FREE)).sheet;
    expect(next.lineup.bench.every((id) => id === null)).toBe(true);
    expect(sheetProblems(game, TEST_CLUB, next).ready).toBe(true);
    expect(benchCount(next)).toBe(0);
  });

  it('a starter and a player left out: the starter leaves the sheet', () => {
    const other = outPlayers(game, TEST_CLUB, sheet).find((p) => p.position === 'CB')!;
    const result = ok(swapPlaces(game, sheet, slot(1), out(other.id)));
    expect(result.sheet.lineup.starters[1]).toBe(other.id);
    expect(outPlayers(game, TEST_CLUB, result.sheet).map((p) => p.id)).toContain(
      fx.starters[1]!.id,
    );
  });

  it('nothing changes: the same place, two free places, two players left out', () => {
    expect(swapPlaces(game, sheet, slot(1), slot(1))).toBeUndefined();
    const twoFree = ok(swapPlaces(game, sheet, slot(1), bench(6))).sheet;
    expect(swapPlaces(game, twoFree, slot(1), bench(1))?.ok).toBe(true);
    const freeBench = {
      ...twoFree,
      lineup: { ...twoFree.lineup, bench: twoFree.lineup.bench.map(() => null) },
    };
    expect(swapPlaces(game, freeBench, slot(1), bench(0))).toBeUndefined();
    expect(swapPlaces(game, sheet, out(fx.injured.id), out(fx.suspended.id))).toBeUndefined();
  });

  it('refuses an injured or suspended player into the pitch or the bench (US-017)', () => {
    for (const [player, reason] of [
      [fx.injured, 'injured'],
      [fx.suspended, 'suspended'],
    ] as const) {
      for (const target of [slot(5), bench(1), bench(6)]) {
        expect(swapPlaces(game, sheet, out(player.id), target)).toEqual({
          ok: false,
          refused: { player: player.id, reason },
        });
        expect(swapPlaces(game, sheet, target, out(player.id))).toEqual({
          ok: false,
          refused: { player: player.id, reason },
        });
      }
    }
  });

  it('a starter who got hurt can leave: for the bench, for the players left out, to another slot', () => {
    const hurt = withPlayer(game, fx.starters[5]!.id, { injuryRounds: 2 });
    expect(swapPlaces(hurt, sheet, slot(5), bench(3))?.ok).toBe(true);
    expect(swapPlaces(hurt, sheet, slot(5), bench(6))?.ok).toBe(true);
    const other = outPlayers(hurt, TEST_CLUB, sheet).find((p) => p.id !== fx.injured.id)!;
    expect(swapPlaces(hurt, sheet, slot(5), out(other.id))?.ok).toBe(true);
    expect(swapPlaces(hurt, sheet, slot(5), slot(6))?.ok).toBe(true);
    // A reserve who got hurt does not go up to the pitch.
    const reserve = withPlayer(game, fx.bench[3]!.id, { suspendedGames: 1 });
    expect(swapPlaces(reserve, sheet, bench(3), slot(5))).toMatchObject({
      ok: false,
      refused: { reason: 'suspended' },
    });
  });

  it('who leaves the pitch leaves the role lists; who enters does not join them (funcoes.md)', () => {
    const [a, b] = [fx.starters[10]!.id, fx.starters[9]!.id];
    const withLists: DraftSheet = {
      ...sheet,
      lineup: { ...sheet.lineup, captains: [a, b], penaltyTakers: [a], freeKickTakers: [b] },
    };
    const result = ok(swapPlaces(game, withLists, bench(4), slot(10)));
    expect(result.sheet.lineup.captains).toEqual([b]);
    expect(result.sheet.lineup.penaltyTakers).toEqual([]);
    expect(result.sheet.lineup.freeKickTakers).toEqual([b]);
    expect(result.removed).toEqual([
      { role: 'captain', player: a },
      { role: 'penalty', player: a },
    ]);
    // A move inside the pitch keeps him on the lists.
    expect(ok(swapPlaces(game, withLists, slot(10), slot(9))).removed).toEqual([]);
  });
});

describe('the strength (escalacao.md, "Força do time"; decision 8)', () => {
  it('the four numbers of sheetStrength, rounded', () => {
    const exact = sheetStrength(game, TEST_CLUB, sheet.lineup)!;
    expect(shownStrength(game, TEST_CLUB, sheet)).toEqual({
      overall: Math.round(exact.overall),
      def: Math.round(exact.def),
      mid: Math.round(exact.mid),
      atk: Math.round(exact.atk),
    });
  });

  it('the arrows and the message compare the rounded numbers', () => {
    const before = { overall: 70, def: 68, mid: 71, atk: 64 };
    const now = { overall: 70, def: 68, mid: 72, atk: 61 };
    const items = strengthItems(now, before, 'pt-BR');
    expect(items.map((i) => i.delta)).toEqual([undefined, undefined, 1, -3]);
    expect(items[3]!.deltaLabel).toBe('caiu 3');
    expect(items[2]!.deltaLabel).toBe('subiu 1');
    expect(strengthChange(now, before, 'pt-BR')).toEqual([
      'Meio 72, subiu 1.',
      'Ataque 61, caiu 3.',
    ]);
    expect(strengthItems(now, undefined, 'pt-BR').every((i) => i.delta === undefined)).toBe(true);
  });

  it('leaving a slot free never raises a number', () => {
    const before = shownStrength(game, TEST_CLUB, sheet);
    for (let i = 0; i < 11; i++) {
      const free = ok(swapPlaces(game, sheet, slot(i), bench(6))).sheet;
      const after = shownStrength(game, TEST_CLUB, free);
      for (const key of ['overall', 'def', 'mid', 'atk'] as const) {
        expect(after[key], `${i} ${key}`).toBeLessThanOrEqual(before[key]);
      }
    }
  });
});

describe('the warnings (escalacao.md, "Avisos" and "Estados")', () => {
  const issues = (g: GameState, s: DraftSheet) =>
    lineupIssues(g, TEST_CLUB, s, sheetProblems(g, TEST_CLUB, s), TIRED, 'pt-BR');
  const code = (index: number) => FORMATION_SLOTS['4-4-2'][index]!;

  it('out of position and improvised from fitLevel, with both positions in short codes', () => {
    expect(fitLevel(fx.misplaced.position, code(9))).toBe('outOfPosition');
    expect(fitLevel(fx.improvised.position, code(6))).toBe('improvised');
    const list = issues(game, sheet);
    expect(list).toContainEqual({
      kind: 'outOfPosition',
      text: `${fx.misplaced.name.full} (ZAG) jogando de ATA`,
    });
    expect(list).toContainEqual({
      kind: 'improvised',
      text: `${fx.improvised.name.full} (MEI) improvisado de VOL`,
    });
  });

  it('a starter below the rotation condition (85) is tired, in Realismo completo only', () => {
    expect(TIRED).toBe(85);
    const list = issues(game, sheet);
    expect(list.filter((i) => i.kind === 'tired')).toEqual([
      {
        kind: 'tired',
        text: `${fx.tired.name.full} está cansado (condição 79): rende menos e se machuca mais.`,
      },
    ]);
    const at85 = withPlayer(game, fx.tired.id, { condition: 85 });
    expect(issues(at85, sheet).some((i) => i.kind === 'tired')).toBe(false);
    const simplified = { ...game, rules: { ...game.rules, realism: 'simplified' as const } };
    expect(issues(simplified, sheet).some((i) => i.kind === 'tired')).toBe(false);
  });

  it('the blocking ones first: a free slot and an injured starter, with the engine check', () => {
    const free = ok(swapPlaces(game, sheet, slot(1), bench(6))).sheet;
    const hurt = withPlayer(game, fx.starters[7]!.id, { injuryRounds: 2 });
    const list = issues(hurt, free);
    expect(list[0]).toEqual({ kind: 'empty', text: 'Vaga de ZAG sem jogador' });
    expect(list[1]).toEqual({
      kind: 'injured',
      text: `${fx.starters[7]!.name.full} (MEI) está lesionado, 2 rodadas`,
    });
    const check = sheetProblems(hurt, TEST_CLUB, free);
    expect(incompleteMessage(check, 'pt-BR')).toBe('Falta 1 titular. 1 escalado não pode jogar.');
  });

  it('the idol out of the team, when he can play', () => {
    const idol = outPlayers(game, TEST_CLUB, sheet).find((p) => p.id !== fx.injured.id)!;
    let g = game;
    for (const id of g.squads[TEST_CLUB]!) g = withPlayer(g, id, { trait: 'quiet' });
    g = withPlayer(g, idol.id, { trait: 'idol' });
    expect(issues(g, sheet).filter((i) => i.kind === 'idol')).toEqual([
      {
        kind: 'idol',
        text: `${idol.name.full} é ídolo da torcida. Se passar duas rodadas seguidas sem entrar em campo, ela esfria.`,
      },
    ]);
    const onPitch = withPlayer(g, idol.id, { trait: 'quiet' });
    expect(
      issues(withPlayer(onPitch, fx.starters[0]!.id, { trait: 'idol' }), sheet).some(
        (i) => i.kind === 'idol',
      ),
    ).toBe(false);
  });
});

describe('the slots and rows read by screen readers (CEO: positions in full)', () => {
  it('a slot says the position in full, the name, the overall, the condition and its situation', () => {
    const slots = pitchSlots(game, TEST_CLUB, sheet, {}, 'pt-BR');
    expect(slots).toHaveLength(11);
    const misplaced = slots[9]!;
    // The tag is the player's natural position and sector, not the slot's (escalacao.md, "Cor de
    // setor no LineupChip"): a centre-back on the striker's slot keeps ZAG, in the defence colour.
    expect(misplaced.positionCode).toBe('ZAG');
    expect(misplaced.sector).toBe('def');
    expect(misplaced.a11yLabel).toBe(
      `Atacante: ${fx.misplaced.name.full}, nota ${fx.misplaced.overall}, condição 100, fora de posição`,
    );
    expect(misplaced.mark).toEqual({ kind: 'outOfPosition', label: 'Fora de posição' });
    // The captain by the engine's rule, once.
    expect(slots.filter((s) => s.captain)).toHaveLength(1);
    expect(slots.find((s) => s.captain)!.a11yLabel).toMatch(/, capitão/);
  });

  it('every filled slot has the code and sector of its player; an empty slot has neither', () => {
    const slots = pitchSlots(game, TEST_CLUB, sheet, {}, 'pt-BR');
    slots.forEach((s, i) => {
      const player = game.players[sheet.lineup.starters[i]!]!;
      expect(s.positionCode).toBe(t(`position.${player.position}.short`, 'pt-BR'));
      expect(s.sector).toBe(SECTOR_OF[player.position]);
    });
    const empty: DraftSheet = {
      ...sheet,
      lineup: {
        ...sheet.lineup,
        starters: sheet.lineup.starters.map((id, i) => (i === 1 ? null : id)),
      },
    };
    const free = pitchSlots(game, TEST_CLUB, empty, {}, 'pt-BR')[1]!;
    expect(free).not.toHaveProperty('positionCode');
    expect(free).not.toHaveProperty('sector');
  });

  it('an injured starter: the mark of the injury wins, and the name says both', () => {
    const hurt = withPlayer(game, fx.misplaced.id, { injuryRounds: 2 });
    const s = pitchSlots(hurt, TEST_CLUB, sheet, {}, 'pt-BR')[9]!;
    expect(s.mark).toEqual({ kind: 'injured', label: 'Lesionado, 2 rodadas' });
    expect(s.a11yLabel).toMatch(/lesionado, 2 rodadas, fora de posição$/);
  });

  it('a free slot and a free bench place have their own names', () => {
    const free = ok(swapPlaces(game, sheet, slot(1), bench(6))).sheet;
    expect(pitchSlots(game, TEST_CLUB, free, {}, 'pt-BR')[1]!.a11yLabel).toBe(
      'Zagueiro: vaga livre',
    );
    const rows = benchRows(game, sheet, {}, 'pt-BR');
    expect(rows.at(-1)!.a11yLabel).toBe('Vaga no banco, livre');
    expect(rows.at(-1)!.dataPlace).toBe('bench-6');
    expect(rows[0]!.a11yLabel).toMatch(/^.+, Goleiro, nota \d+, condição 100$/);
  });

  it('Realismo simplificado: no condition in the names nor in the slots', () => {
    const simplified = { ...game, rules: { ...game.rules, realism: 'simplified' as const } };
    const slots = pitchSlots(simplified, TEST_CLUB, sheet, {}, 'pt-BR');
    expect(slots.every((s) => s.condition === undefined && !/condição/.test(s.a11yLabel))).toBe(
      true,
    );
    expect(benchRows(simplified, sheet, {}, 'pt-BR')[0]!.cells).toHaveLength(1);
  });

  it('the states of the places: picked, target, origin, refused', () => {
    const slots = pitchSlots(
      game,
      TEST_CLUB,
      sheet,
      { selected: slot(0), target: slot(1), origin: slot(2), refused: slot(3) },
      'pt-BR',
    );
    expect(slots.slice(0, 5).map((s) => s.state)).toEqual([
      'selected',
      'target',
      'origin',
      'refused',
      'idle',
    ]);
  });
});

describe('"Sugerir escalação" and "Completar" (decisions 4 and 6)', () => {
  it('keeps the formation and the tactic; the lists keep only the starters left', () => {
    const other: DraftSheet = {
      lineup: { ...sheet.lineup, formation: '3-5-2', captains: [fx.starters[0]!.id] },
      tactic: { posture: 'attacking', pressure: 'high' },
    };
    const next = suggestedSheet(game, TEST_CLUB, other, params);
    expect(next.lineup.formation).toBe('3-5-2');
    expect(next.tactic).toEqual({ posture: 'attacking', pressure: 'high' });
    const engine = suggestSheet(game, params, TEST_CLUB, undefined, {
      controller: 'human',
      formation: '3-5-2',
    });
    expect(next.lineup.starters).toEqual(engine.lineup.starters);
    for (const id of next.lineup.captains) expect(next.lineup.starters).toContain(id);
  });

  it('the tired starters left out are named, in a list of the language', () => {
    const next = suggestedSheet(game, TEST_CLUB, sheet, params);
    const rested = restedPlayers(game, sheet, next, TIRED);
    expect(rested.map((p) => p.id)).toEqual(
      next.lineup.starters.includes(fx.tired.id) ? [] : [fx.tired.id],
    );
    expect(nameList(['Ildo', 'Zuza', 'Reinor'], 'pt-BR')).toBe('Ildo, Zuza e Reinor');
    expect(nameList(['Ildo', 'Zuza'], 'es')).toBe('Ildo y Zuza');
    expect(nameList(['Ildo', 'Zuza', 'Reinor'], 'en')).toBe('Ildo, Zuza, and Reinor');
  });

  it('a ready sheet passes completeSheet as it is', () => {
    const ready = ok(swapPlaces(game, sheet, bench(4), slot(10))).sheet;
    expect(sheetProblems(game, TEST_CLUB, ready).ready).toBe(true);
    const completed = completeSheet(game, TEST_CLUB, ready);
    expect(completed.lineup.starters).toEqual(ready.lineup.starters);
    expect(completed.lineup.bench).toEqual(ready.lineup.bench.filter((id) => id !== null));
    expect(draftFromSheet(completed).lineup.bench).toEqual(ready.lineup.bench);
  });
});
