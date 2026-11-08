import { describe, expect, it } from 'vitest';
import {
  FORMATIONS,
  FORMATION_SLOTS,
  completeSheet,
  fitLevel,
  prepareRound,
  reshapeLineup,
  sheetProblems,
  sheetRoles,
  takerValue,
  type DraftSheet,
  type Player,
  type PlayerId,
} from '@engine';
import { ROLE_LIST_MAX } from '@lib/career';
import type { Lang } from '@lib/config';
import { t } from '@lib/i18n';
import { loadGameParams } from '@lib/params';
import { shownStrength, swapPlaces, type RoleName } from './lineup';
import {
  ROLES,
  addToRole,
  formationMessage,
  formationOptions,
  misplacedCount,
  moveInRole,
  postureOptions,
  pressureOptions,
  removeFromRole,
  roleDetail,
  roleLineValue,
  roleList,
  roleOrderMessage,
  roleSheetView,
  roundSheet,
  tacticIssues,
  withFormation,
  withTactic,
} from './tactic';
import { TEST_CLUB, testCareer, withPlayer } from './testing/game';
import { lineupFixture } from './testing/lineup';

/*
 * The readings and changes of the Tática and the Funções (T-077; US-018; tatica.md, funcoes.md):
 * the options from the content, the formation change by the engine (nobody leaves the team), the
 * role lists (at most 3, only starters, who leaves the team leaves them), "Automático: {nome}"
 * from `sheetRoles`, and the sheet the round gets (integration, "tática é salva para a rodada"
 * and "capitão e cobradores").
 */

const LANGS: readonly Lang[] = ['pt-BR', 'es', 'en'];
const params = loadGameParams();
const fx = lineupFixture(testCareer('full', 1));
const { game, sheet } = fx;
const starterIds = sheet.lineup.starters as PlayerId[];
const player = (id: PlayerId): Player => game.players[id]!;

/** The sheet with `ids` in the list of `role`, added one by one as the screen does. */
function withList(base: DraftSheet, role: RoleName, ids: readonly PlayerId[]): DraftSheet {
  let next = base;
  for (const id of ids) {
    const added = addToRole(next, role, id);
    if (added === undefined) throw new Error(`could not add ${id}`);
    next = added;
  }
  return next;
}

describe('the options of the Tática (tatica.md, "Conteúdo")', () => {
  for (const lang of LANGS) {
    it(`${lang}: six formations, three postures and three pressures, each with its effect`, () => {
      const formations = formationOptions(lang);
      expect(formations.map((o) => o.value)).toEqual([...FORMATIONS]);
      for (const option of [...formations, ...postureOptions(lang), ...pressureOptions(lang)]) {
        expect(option.title).not.toMatch(/^tactic\./);
        expect(option.description).not.toMatch(/^tactic\./);
        expect(option.description!.length).toBeGreaterThan(0);
      }
      // No "Tudo no ataque" before the match (measure 3): exactly three postures.
      expect(postureOptions(lang).map((o) => o.value)).toEqual([
        'defensive',
        'balanced',
        'attacking',
      ]);
      expect(pressureOptions(lang).map((o) => o.value)).toEqual(['low', 'medium', 'high']);
    });
  }
});

describe('the formation change (US-018, "trocar a formação reposiciona os titulares")', () => {
  it('4-4-2 to 4-3-3: the same 11, redistributed by the engine; bench, lists and tactic stay', () => {
    const roles = withList(sheet, 'penalty', [starterIds[10]!, starterIds[8]!]);
    const next = withFormation(game, TEST_CLUB, roles, '4-3-3')!;
    expect(next.lineup.formation).toBe('4-3-3');
    expect(new Set(next.lineup.starters)).toEqual(new Set(roles.lineup.starters));
    expect(next.lineup).toEqual(reshapeLineup(game, TEST_CLUB, roles.lineup, '4-3-3'));
    expect(next.lineup.bench).toEqual(roles.lineup.bench);
    expect(next.lineup.penaltyTakers).toEqual(roles.lineup.penaltyTakers);
    expect(next.tactic).toEqual(roles.tactic);
    // The one striker of a 4-4-2 who is a striker stays a striker.
    const st = FORMATION_SLOTS['4-3-3'].flatMap((p, i) => (p === 'ST' ? [i] : []));
    expect(st.map((i) => next.lineup.starters[i])).toContain(starterIds[10]);
  });

  it('every formation keeps the 11; the same formation changes nothing', () => {
    for (const formation of FORMATIONS) {
      const next = withFormation(game, TEST_CLUB, sheet, formation);
      if (formation === sheet.lineup.formation) {
        expect(next).toBeUndefined();
        continue;
      }
      expect(new Set(next!.lineup.starters)).toEqual(new Set(sheet.lineup.starters));
    }
  });

  it('a free slot stays free (nobody joins), an injured starter only changes slot', () => {
    const freed = {
      ...sheet,
      lineup: {
        ...sheet.lineup,
        starters: sheet.lineup.starters.map((id, i) => (i === 1 ? null : id)),
      },
    };
    const hurt = withPlayer(game, starterIds[7]!, { injuryRounds: 2 });
    const next = withFormation(hurt, TEST_CLUB, freed, '3-5-2')!;
    expect(next.lineup.starters.filter((id) => id === null)).toHaveLength(1);
    expect(next.lineup.starters).toContain(starterIds[7]);
  });

  it('the message of the live region: formation, the strength that changed, the misplaced', () => {
    const next = withFormation(game, TEST_CLUB, sheet, '4-3-3')!;
    const was = shownStrength(game, TEST_CLUB, sheet);
    const now = shownStrength(game, TEST_CLUB, next);
    const count = misplacedCount(game, next);
    const text = formationMessage('4-3-3', now, was, count, 'pt-BR');
    expect(text.startsWith('Formação 4-3-3.')).toBe(true);
    for (const key of ['overall', 'def', 'mid', 'atk'] as const) {
      if (now[key] !== was[key])
        expect(text).toContain(
          `, ${now[key] > was[key] ? 'subiu' : 'caiu'} ${Math.abs(now[key] - was[key])}.`,
        );
    }
    if (count === 1) expect(text.endsWith('1 jogador fora de posição.')).toBe(true);
    if (count > 1) expect(text.endsWith(`${count} jogadores fora de posição.`)).toBe(true);
    expect(formationMessage('4-3-3', was, was, 0, 'pt-BR')).toBe('Formação 4-3-3.');
    expect(formationMessage('5-3-2', was, was, 2, 'en')).toMatch(/^Formation 5-3-2\. 2 /);
  });

  it('misplacedCount counts the improvised and the out of position, by the engine', () => {
    const slots = FORMATION_SLOTS[sheet.lineup.formation];
    const expected = starterIds.filter(
      (id, i) => fitLevel(player(id).position, slots[i]!) !== 'natural',
    ).length;
    expect(misplacedCount(game, sheet)).toBe(expected);
    expect(expected).toBeGreaterThanOrEqual(2);
  });

  it('"Nesta formação": the out of position and improvised, the free slots and the unfit; no tired, no idol', () => {
    const freed = {
      ...sheet,
      lineup: {
        ...sheet.lineup,
        starters: sheet.lineup.starters.map((id, i) => (i === 1 ? null : id)),
      },
    };
    const hurt = withPlayer(game, starterIds[7]!, { injuryRounds: 2, trait: 'quiet' });
    const issues = tacticIssues(
      hurt,
      TEST_CLUB,
      freed,
      sheetProblems(hurt, TEST_CLUB, freed),
      'pt-BR',
    );
    const kinds = issues.map((i) => i.kind);
    expect(kinds).toContain('empty');
    expect(kinds).toContain('injured');
    expect(kinds).toContain('outOfPosition');
    expect(kinds).toContain('improvised');
    expect(kinds).not.toContain('tired');
    expect(kinds).not.toContain('idol');
    expect(issues.map((i) => i.text)).toContain(`${fx.misplaced.name.full} (ZAG) jogando de ATA`);
  });
});

describe('posture and pressure', () => {
  it('change only the tactic; the same value changes nothing', () => {
    const next = withTactic(sheet, { posture: 'attacking' })!;
    expect(next.tactic).toEqual({ posture: 'attacking', pressure: 'medium' });
    expect(next.lineup).toBe(sheet.lineup);
    expect(withTactic(next, { pressure: 'high' })!.tactic).toEqual({
      posture: 'attacking',
      pressure: 'high',
    });
    expect(withTactic(sheet, { posture: 'balanced' })).toBeUndefined();
  });
});

describe('the role lists (funcoes.md, "Regras das listas")', () => {
  it('at most 3, only starters, once each, in the order they were put', () => {
    const [a, b, c, d] = [starterIds[10]!, starterIds[8]!, starterIds[0]!, starterIds[3]!];
    const full = withList(sheet, 'penalty', [a, b, c]);
    expect(roleList(full, 'penalty')).toEqual([a, b, c]);
    expect(ROLE_LIST_MAX).toBe(3);
    expect(addToRole(full, 'penalty', d)).toBeUndefined();
    expect(addToRole(withList(sheet, 'penalty', [a]), 'penalty', a)).toBeUndefined();
    // A reserve or a player left out never enters a list.
    expect(addToRole(sheet, 'penalty', fx.bench[0]!.id)).toBeUndefined();
    expect(addToRole(sheet, 'captain', fx.injured.id)).toBeUndefined();
    // The same player may be in the three lists.
    const all = withList(withList(withList(sheet, 'captain', [a]), 'penalty', [a]), 'freeKick', [
      a,
    ]);
    expect(ROLES.map((role) => roleList(all, role))).toEqual([[a], [a], [a]]);
  });

  it('up, down and remove; at the edges nothing changes', () => {
    const [a, b] = [starterIds[10]!, starterIds[8]!];
    const two = withList(sheet, 'freeKick', [a, b]);
    const swapped = moveInRole(two, 'freeKick', a, 1)!;
    expect(roleList(swapped, 'freeKick')).toEqual([b, a]);
    expect(roleList(moveInRole(swapped, 'freeKick', a, -1)!, 'freeKick')).toEqual([a, b]);
    expect(moveInRole(two, 'freeKick', a, -1)).toBeUndefined();
    expect(moveInRole(two, 'freeKick', b, 1)).toBeUndefined();
    expect(roleList(removeFromRole(swapped, 'freeKick', b)!, 'freeKick')).toEqual([a]);
    expect(removeFromRole(two, 'captain', a)).toBeUndefined();
    // Only the list changes.
    expect(swapped.lineup.starters).toEqual(two.lineup.starters);
    expect(swapped.lineup.penaltyTakers).toEqual(two.lineup.penaltyTakers);
  });

  it('who leaves the team in the Escalação leaves the lists, and the line goes back to "Automático"', () => {
    const a = starterIds[10]!;
    const listed = withList(sheet, 'penalty', [a]);
    expect(roleLineValue(game, TEST_CLUB, listed, 'penalty', 'pt-BR')).toBe(player(a).name.display);
    const result = swapPlaces(
      game,
      listed,
      { part: 'starters', index: 10 },
      { part: 'bench', index: 4 },
    );
    if (result === undefined || !result.ok) throw new Error('swap');
    expect(roleList(result.sheet, 'penalty')).toEqual([]);
    expect(result.removed).toEqual([{ role: 'penalty', player: a }]);
    expect(roleLineValue(game, TEST_CLUB, result.sheet, 'penalty', 'pt-BR')).toMatch(
      /^Automático: /,
    );
  });
});

describe('the lines of the Tática and the role sheets', () => {
  it('an empty list reads "Automático: {nome}", the holder of sheetRoles; a list, its names with commas', () => {
    const roles = sheetRoles(game, TEST_CLUB, sheet.lineup);
    for (const role of ROLES) {
      expect(roleLineValue(game, TEST_CLUB, sheet, role, 'pt-BR')).toBe(
        `Automático: ${player(roles[role].player!).name.display}`,
      );
    }
    const [a, b] = [starterIds[10]!, starterIds[8]!];
    expect(
      roleLineValue(game, TEST_CLUB, withList(sheet, 'captain', [a, b]), 'captain', 'pt-BR'),
    ).toBe(`${player(a).name.display}, ${player(b).name.display}`);
    const nobody = {
      ...sheet,
      lineup: { ...sheet.lineup, starters: sheet.lineup.starters.map(() => null) },
    };
    expect(roleLineValue(game, TEST_CLUB, nobody, 'penalty', 'pt-BR')).toBe(
      'Automático: ninguém em campo',
    );
    for (const lang of LANGS) {
      expect(roleLineValue(game, TEST_CLUB, nobody, 'captain', lang)).toBe(
        t('tactic.roles.none', lang),
      );
    }
  });

  it('the penalty sheet: the others by finishing, the highest first; "Agora" with the list empty', () => {
    const view = roleSheetView(game, TEST_CLUB, sheet, 'penalty', 'pt-BR');
    expect(view.title).toBe('Cobrador de pênalti');
    expect(view.intro).toBe(t('roles.taker.intro', 'pt-BR'));
    expect(view.list).toEqual([]);
    expect(view.others).toHaveLength(11);
    const finishing = view.others.map((e) => takerValue(player(e.id), 'penalty'));
    expect(finishing).toEqual([...finishing].sort((x, y) => y - x));
    const holder = player(sheetRoles(game, TEST_CLUB, sheet.lineup).penalty.player!);
    expect(view.nowText).toBe(
      `Agora: ${holder.name.display} (Finalização ${takerValue(holder, 'penalty')})`,
    );
    const first = view.others[0]!;
    expect(first.detail).toBe(`Finalização ${takerValue(player(first.id), 'penalty')}`);
    expect(first.addLabel).toBe(`Pôr ${player(first.id).name.full} na lista`);
    // With a list, no "Agora", and the listed are not among the others.
    const listed = roleSheetView(
      game,
      TEST_CLUB,
      withList(sheet, 'penalty', [first.id]),
      'penalty',
      'pt-BR',
    );
    expect(listed.nowText).toBeUndefined();
    expect(listed.list.map((e) => e.id)).toEqual([first.id]);
    expect(listed.others.map((e) => e.id)).not.toContain(first.id);
    expect(listed.list[0]!.upLabel).toBe(`Subir ${player(first.id).name.full}`);
    expect(listed.list[0]!.removeLabel).toBe(`Tirar ${player(first.id).name.full} da lista`);
    // The goalkeeper shows the engine's derived value (40% of the overall), with no dash, and
    // sits where that value puts him; the first line is the holder the engine picks.
    const keeper = view.others.find((e) => player(e.id).position === 'GK')!;
    const derived = Math.max(1, Math.round(0.4 * player(keeper.id).overall));
    expect(keeper.detail).toBe(`Finalização ${derived}`);
    expect(view.others.map((e) => e.detail).join()).not.toContain('—');
    expect(first.id).toBe(holder.id);
  });

  it('the free-kick sheet reads technique; the captain sheet, the age and "Líder"', () => {
    const fk = roleSheetView(game, TEST_CLUB, sheet, 'freeKick', 'pt-BR');
    expect(fk.title).toBe('Cobrador de falta');
    const technique = fk.others.map((e) => takerValue(player(e.id), 'freeKick'));
    expect(technique).toEqual([...technique].sort((x, y) => y - x));

    let g = game;
    for (const id of starterIds) g = withPlayer(g, id, { trait: 'quiet' });
    const [leaderA, leaderB] = [starterIds[2]!, starterIds[6]!];
    g = withPlayer(g, leaderA, { trait: 'leader', overall: 60 });
    g = withPlayer(g, leaderB, { trait: 'leader', overall: 70 });
    const captain = roleSheetView(g, TEST_CLUB, sheet, 'captain', 'pt-BR');
    expect(captain.title).toBe('Capitão');
    expect(captain.intro).toBe(t('roles.captain.intro', 'pt-BR'));
    // The leaders first (by overall), then by age, the oldest first.
    expect(captain.others.slice(0, 2).map((e) => e.id)).toEqual([leaderB, leaderA]);
    const ages = captain.others.slice(2).map((e) => g.players[e.id]!.age);
    expect(ages).toEqual([...ages].sort((x, y) => y - x));
    expect(captain.others[0]!.badges).toEqual([{ kind: 'leader', label: 'Líder' }]);
    expect(captain.others[2]!.badges).toEqual([]);
    expect(captain.others[2]!.detail).toBe(
      roleDetail(g.players[captain.others[2]!.id]!, 'captain', 'pt-BR'),
    );
    expect(captain.others[2]!.detail).toMatch(/^\d+ anos?$/);
    expect(captain.nowText).toBe(
      `Agora: ${g.players[leaderB]!.name.display} (${roleDetail(g.players[leaderB]!, 'captain', 'pt-BR')})`,
    );
  });

  it('an injured starter in a list shows the injury; with no starter, "Ainda não há titulares escalados."', () => {
    const a = starterIds[7]!;
    const hurt = withPlayer(game, a, { injuryRounds: 2 });
    const view = roleSheetView(
      hurt,
      TEST_CLUB,
      withList(sheet, 'captain', [a]),
      'captain',
      'pt-BR',
    );
    expect(view.list[0]!.badges!.map((b) => b.kind)).toContain('injured');
    expect(view.noStartersText).toBeUndefined();
    const nobody = {
      ...sheet,
      lineup: { ...sheet.lineup, starters: sheet.lineup.starters.map(() => null) },
    };
    const empty = roleSheetView(game, TEST_CLUB, nobody, 'penalty', 'pt-BR');
    expect(empty.noStartersText).toBe(t('roles.noStarters', 'pt-BR'));
    expect(empty.others).toEqual([]);
    expect(empty.nowText).toBeUndefined();
  });

  it('the order said: "Pênaltis: 1 Ildo Albuquerque, 2 Zuza Ferraz." or the empty list', () => {
    const [a, b] = [starterIds[10]!, starterIds[8]!];
    expect(roleOrderMessage(game, withList(sheet, 'penalty', [a, b]), 'penalty', 'pt-BR')).toBe(
      `Pênaltis: 1 ${player(a).name.full}, 2 ${player(b).name.full}.`,
    );
    expect(roleOrderMessage(game, sheet, 'captain', 'pt-BR')).toBe(
      'Capitão: lista vazia, vale a regra automática.',
    );
  });
});

describe('the sheet the round gets (US-018; integration with the engine)', () => {
  it('"tática é salva para a rodada": posture and pressure reach the match of the coach\'s club', () => {
    const edited = withTactic(sheet, { posture: 'attacking', pressure: 'high' })!;
    const sent = roundSheet(game, TEST_CLUB, edited, false, true)!;
    expect(sent.tactic).toEqual({ posture: 'attacking', pressure: 'high' });
    const plan = prepareRound(game, params, {
      sheets: { [TEST_CLUB]: sent },
      coaches: { [TEST_CLUB]: 'result' },
    });
    if (!plan.ok) throw new Error(plan.error);
    const match = plan.value.matches.find(
      (m) => m.home.clubId === TEST_CLUB || m.away.clubId === TEST_CLUB,
    )!;
    const team = match.home.clubId === TEST_CLUB ? match.home : match.away;
    expect(team.sheet.tactic).toEqual({ posture: 'attacking', pressure: 'high' });
  });

  it('"capitão e cobradores": the three lists go in the order of the screen', () => {
    const [a, b, c] = [starterIds[10]!, starterIds[8]!, starterIds[0]!];
    const edited = withList(
      withList(withList(sheet, 'captain', [c, a]), 'penalty', [a, b, c]),
      'freeKick',
      [b],
    );
    const sent = roundSheet(game, TEST_CLUB, edited, false, true)!;
    expect(sent.lineup.captains).toEqual([c, a]);
    expect(sent.lineup.penaltyTakers).toEqual([a, b, c]);
    expect(sent.lineup.freeKickTakers).toEqual([b]);
    const plan = prepareRound(game, params, {
      sheets: { [TEST_CLUB]: sent },
      coaches: { [TEST_CLUB]: 'result' },
    });
    if (!plan.ok) throw new Error(plan.error);
    const match = plan.value.matches.find(
      (m) => m.home.clubId === TEST_CLUB || m.away.clubId === TEST_CLUB,
    )!;
    const team = match.home.clubId === TEST_CLUB ? match.home : match.away;
    expect(team.sheet.lineup.penaltyTakers).toEqual([a, b, c]);
    expect(team.sheet.lineup.captains).toEqual([c, a]);
  });

  it('untouched and ready: no sheet (the engine plays its own suggestion); else completeSheet', () => {
    expect(roundSheet(game, TEST_CLUB, sheet, true, true)).toBeUndefined();
    expect(roundSheet(game, TEST_CLUB, sheet, false, true)).toEqual(
      completeSheet(game, TEST_CLUB, sheet),
    );
    const freed = {
      ...sheet,
      lineup: {
        ...sheet.lineup,
        starters: sheet.lineup.starters.map((id, i) => (i === 1 ? null : id)),
      },
    };
    const completed = roundSheet(game, TEST_CLUB, freed, true, false)!;
    expect(completed.lineup.starters).toHaveLength(11);
  });
});
