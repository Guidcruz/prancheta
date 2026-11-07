import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { DraftSheet, GameState, PlayerId } from '@engine';
import { ROLE_LIST_MAX } from '@lib/career';
import type { Lang } from '@lib/config';
import { t } from '@lib/i18n';
import RoleEditor from './components/RoleEditor.svelte';
import { shownStrength } from './lineup';
import Tactic from './screens/Tactic.svelte';
import TacticView from './screens/TacticView.svelte';
import { addToRole, roleSheetView, withFormation, type RoleSheetView } from './tactic';
import { TEST_CLUB, testCareer, withPlayer } from './testing/game';
import { lineupFixture } from './testing/lineup';

/*
 * QA of T-077 (US-018): the Tática and the role sheets rendered on the server (no DOM in the
 * tests), on the fixture of the E2E, for each state of tatica.md and funcoes.md, in the three
 * languages, with no raw text key. Touch, keyboard, focus, history, widths and the round are for
 * the E2E (tests/e2e/tactic.spec.ts) and the integration tests (tactic.test.ts).
 */

const LANGS: readonly Lang[] = ['pt-BR', 'es', 'en'];
const shown = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const RAW_KEY =
  /(?:^|[>\s"'])(?:nav|action|play|career|error|screen|club|squad|player|position|status|lineup|tactic|roles|attr|trait|save)\.[A-Za-z][\w.-]*(?=[<\s"'])/;
function expectNoRawKey(body: string, label: string): void {
  const text = body
    .replace(/<svg.*?<\/svg>/gs, '')
    .replace(/<style.*?<\/style>/gs, '')
    .replace(/(?:class|href|id|style|for|name|value|data-[a-z-]+)="[^"]*"/g, '');
  expect(text.match(RAW_KEY)?.[0], `${label}: raw key on screen`).toBeUndefined();
  expect(text, `${label}: unfilled {placeholder}`).not.toMatch(/\{[a-z]+\}/i);
}
const primaries = (body: string) => (body.match(/class="btn botao primary/g) ?? []).length;

const fx = lineupFixture(testCareer('full', 1));
const starterIds = fx.sheet.lineup.starters as PlayerId[];
const simplified = (g: GameState): GameState => ({
  ...g,
  rules: { ...g.rules, realism: 'simplified' },
});
const freed = (index: number): DraftSheet => ({
  ...fx.sheet,
  lineup: {
    ...fx.sheet.lineup,
    starters: fx.sheet.lineup.starters.map((id, i) => (i === index ? null : id)),
  },
});
const nobody: DraftSheet = {
  ...fx.sheet,
  lineup: { ...fx.sheet.lineup, starters: fx.sheet.lineup.starters.map(() => null) },
};

function view(
  game: GameState,
  sheet: DraftSheet,
  lang: Lang = 'pt-BR',
  extra: Record<string, unknown> = {},
): string {
  return render(TacticView, { props: { lang, game, clubId: TEST_CLUB, sheet, ...extra } }).body;
}

function editor(v: RoleSheetView, lang: Lang = 'pt-BR'): string {
  const noop = () => undefined;
  return render(RoleEditor, {
    props: {
      intro: v.intro,
      listTitle: t('roles.list', lang),
      othersTitle: t('roles.others', lang),
      emptyText: t('roles.empty', lang),
      autoText: v.autoText,
      nowText: v.nowText,
      fullText: t('roles.full', lang, { max: ROLE_LIST_MAX }),
      noStartersText: v.noStartersText,
      max: ROLE_LIST_MAX,
      list: v.list,
      others: v.others,
      onup: noop,
      ondown: noop,
      onremove: noop,
      onadd: noop,
    },
  }).body;
}

function withList(base: DraftSheet, role: 'captain' | 'penalty' | 'freeKick', ids: PlayerId[]) {
  return ids.reduce((s, id) => addToRole(s, role, id)!, base);
}

describe('the Tática (tatica.md; US-018)', () => {
  for (const lang of LANGS) {
    it(`${lang}: every state has the three groups and the roles, no raw key and no primary`, () => {
      const hurt = withPlayer(fx.game, starterIds[7]!, { injuryRounds: 2 });
      const states: Record<string, string> = {
        fixture: view(fx.game, fx.sheet, lang),
        free: view(fx.game, freed(1), lang),
        nobody: view(fx.game, nobody, lang),
        injured: view(hurt, fx.sheet, lang),
        simplified: view(simplified(fx.game), fx.sheet, lang),
        lists: view(
          fx.game,
          withList(fx.sheet, 'penalty', [starterIds[10]!, starterIds[8]!]),
          lang,
        ),
      };
      for (const [name, body] of Object.entries(states)) {
        const label = `${lang}/${name}`;
        expect(body.match(/type="radio"/g), label).toHaveLength(6 + 3 + 3);
        expect(body.match(/data-role="/g), label).toHaveLength(3);
        expectNoRawKey(body, label);
        expect(primaries(body), label).toBe(0);
        // The one live region of the view, always in the DOM; no pitch of its own (decision 2).
        expect(body.match(/role="status"/g), label).toHaveLength(1);
        expect(body, label).not.toContain('data-slot=');
      }
      const loading = view(fx.game, fx.sheet, lang, { loading: true });
      expect(loading).toContain(shown(t('tactic.loading', lang)));
      expect(loading).not.toContain('type="radio"');
      expectNoRawKey(loading, `${lang}/loading`);
    });
  }

  it('the groups: fieldsets with a visible legend, the choice checked, each effect as the description', () => {
    const body = view(fx.game, withFormation(fx.game, TEST_CLUB, fx.sheet, '4-3-3')!);
    for (const key of [
      'tactic.formation.legend',
      'tactic.posture.legend',
      'tactic.pressure.legend',
    ]) {
      expect(body).toMatch(
        new RegExp(`<legend class="body-strong[^"]*">${t(key, 'pt-BR')}</legend>`),
      );
    }
    expect(body.match(/<fieldset/g)).toHaveLength(3);
    expect(body).toMatch(/value="4-3-3"[^>]*checked/);
    expect(body).not.toMatch(/value="4-4-2"[^>]*checked/);
    expect(body).toMatch(/value="balanced"[^>]*checked/);
    expect(body).toMatch(/value="medium"[^>]*checked/);
    expect(body).toContain(shown(t('tactic.formation.note', 'pt-BR')));
    for (const key of [
      'tactic.formation.4-2-3-1.effect',
      'tactic.posture.attacking.effect',
      'tactic.pressure.high.effect',
    ]) {
      expect(body).toContain(shown(t(key, 'pt-BR')));
    }
    // Every radio has its effect as the description.
    expect(body.match(/type="radio"[^>]*aria-describedby="[^"]+"/g)).toHaveLength(12);
    // The miniatures are decorative: hidden and not focusable.
    expect(
      body.match(/<svg class="mini[^"]*"[^>]*aria-hidden="true"[^>]*focusable="false"/g),
    ).toHaveLength(6);
  });

  it('the strength of the team with the arrows after a formation change, and its help', () => {
    const next = withFormation(fx.game, TEST_CLUB, fx.sheet, '3-4-3')!;
    const before = shownStrength(fx.game, TEST_CLUB, fx.sheet);
    const now = shownStrength(fx.game, TEST_CLUB, next);
    const body = view(fx.game, next, 'pt-BR', { before });
    expect(body).toContain('class="strength');
    for (const key of ['overall', 'def', 'mid', 'atk'] as const) {
      expect(body).toContain(`<span class="numero">${now[key]}</span>`);
    }
    expect(Object.values(now).some((v, i) => v !== Object.values(before)[i])).toBe(true);
    expect(body).toMatch(/class="caption delta[^"]*(up|down)/);
    expect(body).toContain(t('lineup.strength.help.label', 'pt-BR'));
  });

  it('"Nesta formação": out of position and improvised in full; the free slot and the injured too', () => {
    const body = view(fx.game, fx.sheet);
    expect(body).toContain(t('tactic.issues.title', 'pt-BR'));
    expect(body).toContain(shown(`${fx.misplaced.name.full} (ZAG) jogando de ATA`));
    expect(body).toContain(shown(`${fx.improvised.name.full} (MEI) improvisado de VOL`));
    expect(body).not.toContain('está cansado');
    const hurt = withPlayer(fx.game, starterIds[7]!, { injuryRounds: 2 });
    const incomplete = view(hurt, freed(1));
    expect(incomplete).toContain('Vaga de ZAG sem jogador');
    expect(incomplete).toContain(
      shown(`${fx.starters[7]!.name.full} (MEI) está lesionado, 2 rodadas`),
    );
  });

  it('the roles: "Funções" and three lines; "Automático: {nome}" with the lists empty, the names with a list', () => {
    const body = view(fx.game, fx.sheet);
    expect(body).toMatch(new RegExp(`<h2[^>]*>${t('tactic.roles.title', 'pt-BR')}</h2>`));
    for (const role of ['captain', 'penalty', 'freeKick']) {
      expect(body).toMatch(new RegExp(`data-role="${role}"[^]*?${t(`roles.${role}`, 'pt-BR')}`));
    }
    expect(body.match(/class="body value[^"]*">Automático: /g)).toHaveLength(3);
    const [a, b] = [fx.game.players[starterIds[10]!]!, fx.game.players[starterIds[8]!]!];
    const listed = view(fx.game, withList(fx.sheet, 'penalty', [a.id, b.id]));
    expect(listed).toContain(shown(`${a.name.display}, ${b.name.display}`));
    expect(listed.match(/class="body value[^"]*">Automático: /g)).toHaveLength(2);
    const none = view(fx.game, nobody);
    expect(none.match(/Automático: ninguém em campo/g)).toHaveLength(3);
  });

  it('the screen renders the view and a closed role sheet', () => {
    const body = render(Tactic, {
      props: {
        lang: 'pt-BR',
        game: fx.game,
        clubId: TEST_CLUB,
        sheet: fx.sheet,
        onedit: () => undefined,
      },
    }).body;
    expect(body.match(/<fieldset/g)).toHaveLength(3);
    expect(body).toContain('<dialog');
    expect(body).not.toContain('data-role-add=');
  });
});

describe('the role sheets (funcoes.md)', () => {
  for (const lang of LANGS) {
    it(`${lang}: each sheet, empty, with a list, full and without starters, has no raw key`, () => {
      for (const role of ['captain', 'penalty', 'freeKick'] as const) {
        const sheets: Record<string, DraftSheet> = {
          empty: fx.sheet,
          two: withList(fx.sheet, role, [starterIds[10]!, starterIds[8]!]),
          full: withList(fx.sheet, role, [starterIds[10]!, starterIds[8]!, starterIds[0]!]),
          nobody,
        };
        for (const [name, sheet] of Object.entries(sheets)) {
          const v = roleSheetView(fx.game, TEST_CLUB, sheet, role, lang);
          expectNoRawKey(v.title, `${lang}/${role}/${name}/title`);
          expectNoRawKey(editor(v, lang), `${lang}/${role}/${name}`);
        }
      }
    });
  }

  it('empty: "Lista vazia", the rule, "Agora: {nome} ({atributo})", and 11 lines to put in the list', () => {
    const body = editor(roleSheetView(fx.game, TEST_CLUB, fx.sheet, 'penalty', 'pt-BR'));
    expect(body).toContain(t('roles.empty', 'pt-BR'));
    expect(body).toContain(shown(t('roles.auto.penalty', 'pt-BR')));
    expect(body).toMatch(/Agora: [^<]+ \(Finalização \d+\)/);
    expect(body.match(/data-role-add="/g)).toHaveLength(11);
    expect(body).not.toContain('<ol');
    expect(body).not.toMatch(/data-role-add="[^"]*"[^>]*disabled/);
  });

  it('a list: an ordered list with its number and three 44px buttons; Subir first and Descer last disabled', () => {
    const [a, b] = [starterIds[10]!, starterIds[8]!];
    const body = editor(
      roleSheetView(fx.game, TEST_CLUB, withList(fx.sheet, 'penalty', [a, b]), 'penalty', 'pt-BR'),
    );
    expect(body).toContain('<ol class="entries');
    expect(body.match(/data-role-entry="/g)).toHaveLength(2);
    expect(body.match(/data-role-tool="(up|down|remove)"/g)).toHaveLength(6);
    const first = /data-role-entry="[^"]+"[^]*?<\/li>/.exec(body)![0];
    expect(first).toMatch(/data-role-tool="up"[^>]*disabled/);
    expect(first).not.toMatch(/data-role-tool="down"[^>]*disabled/);
    expect(first).toContain(`aria-label="Subir ${shown(fx.game.players[a]!.name.full)}"`);
    expect(body.match(/data-role-add="/g)).toHaveLength(9);
    expect(body).not.toMatch(/Agora:/);
    // The position tag in its sector colour.
    expect(body).toMatch(/class="rotulo tag[^"]*\bsector-atk\b[^"]*">ATA</);
  });

  it('full (3): the lines to add disabled, tied to the reason', () => {
    const ids = [starterIds[10]!, starterIds[8]!, starterIds[0]!];
    const body = editor(
      roleSheetView(fx.game, TEST_CLUB, withList(fx.sheet, 'freeKick', ids), 'freeKick', 'pt-BR'),
    );
    expect(body).toContain(shown(t('roles.full', 'pt-BR', { max: 3 })));
    expect(body).toContain('no máximo 3');
    const adds = body.match(/<button[^>]*data-role-add="[^"]*"[^>]*>/g)!;
    expect(adds).toHaveLength(8);
    for (const tag of adds) {
      expect(tag).toContain('disabled');
      expect(tag).toMatch(/aria-describedby="[^"]+-full"/);
    }
  });

  it('the captain sheet: the age and the "Líder" badge; without starters, the sentence and no line', () => {
    const leader = starterIds[2]!;
    const g = withPlayer(fx.game, leader, { trait: 'leader' });
    const body = editor(roleSheetView(g, TEST_CLUB, fx.sheet, 'captain', 'pt-BR'));
    expect(body).toMatch(/\d+ anos/);
    expect(body).toContain(t('trait.leader', 'pt-BR'));
    const none = editor(roleSheetView(fx.game, TEST_CLUB, nobody, 'captain', 'pt-BR'));
    expect(none).toContain(t('roles.noStarters', 'pt-BR'));
    expect(none).not.toContain('data-role-add=');
  });
});
