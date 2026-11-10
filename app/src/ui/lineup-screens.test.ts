import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import {
  FORMATION_SLOTS,
  completeSheet,
  draftFromSheet,
  sheetProblems,
  type DraftSheet,
  type GameState,
} from '@engine';
import type { CareerSave, CareerService, CareerState } from '@lib/career';
import type { Lang } from '@lib/config';
import type { ErrorLog } from '@lib/errors';
import { loadGameParams } from '@lib/params';
import { t } from '@lib/i18n';
import CareerFrame from './CareerFrame.svelte';
import { SECTOR_OF } from './components/sectors';
import { swapPlaces } from './lineup';
import LineupView from './screens/LineupView.svelte';
import SquadTab, { type SquadViewId } from './screens/SquadTab.svelte';
import { TEST_CLUB, testCareer, withPlayer } from './testing/game';
import { lineupFixture } from './testing/lineup';

/*
 * QA of T-029 (US-017): the Escalação rendered on the server (no DOM in the tests), on a real
 * career with the fixture of the E2E, for each state of escalacao.md, in the three languages,
 * with no raw text key; the selector of the Elenco tab; and what the frame does with the
 * coach's sheet ("Jogar rodada" blocked with its reason, the notice of a sheet not saved). Touch,
 * drag, keyboard, focus, history, widths and motion are for the E2E (tests/e2e/lineup.spec.ts).
 */

const LANGS: readonly Lang[] = ['pt-BR', 'es', 'en'];
const params = loadGameParams();
const TIRED = params.ai.rotationCondition;
const shown = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const RAW_KEY =
  /(?:^|[>\s"'])(?:nav|action|play|career|error|screen|club|squad|player|position|status|lineup|tactic|roles|save)\.[A-Za-z][\w.-]*(?=[<\s"'])/;
function expectNoRawKey(body: string, label: string): void {
  const text = body
    .replace(/<svg.*?<\/svg>/gs, '')
    .replace(/<style.*?<\/style>/gs, '')
    .replace(/(?:class|href|id|style|for|name|value|data-[a-z]+)="[^"]*"/g, '');
  expect(text.match(RAW_KEY)?.[0], `${label}: raw key on screen`).toBeUndefined();
  expect(text, `${label}: unfilled {placeholder}`).not.toMatch(/\{[a-z]+\}/i);
}
const primaries = (body: string) => (body.match(/class="btn botao primary/g) ?? []).length;

const fx = lineupFixture(testCareer('full', 1));
const simplifiedGame = (g: GameState): GameState => ({
  ...g,
  rules: { ...g.rules, realism: 'simplified' },
});

function view(
  game: GameState,
  sheet: DraftSheet,
  lang: Lang = 'pt-BR',
  extra: Record<string, unknown> = {},
): string {
  return render(LineupView, {
    props: { lang, game, clubId: TEST_CLUB, sheet, tiredBelow: TIRED, ...extra },
  }).body;
}

/** The fixture with slot `index` moved to the free bench place. */
function freed(index: number): DraftSheet {
  const result = swapPlaces(
    fx.game,
    fx.sheet,
    { part: 'starters', index },
    { part: 'bench', index: 6 },
  );
  if (result === undefined || !result.ok) throw new Error('swap');
  return result.sheet;
}

describe('the Escalação (escalacao.md; US-017)', () => {
  for (const lang of LANGS) {
    it(`${lang}: every state has the pitch, no raw key and no primary button of its own`, () => {
      const emptySheet: DraftSheet = {
        ...fx.sheet,
        lineup: { ...fx.sheet.lineup, starters: fx.sheet.lineup.starters.map(() => null) },
      };
      const hurt = withPlayer(fx.game, fx.starters[7]!.id, { injuryRounds: 2 });
      let short = fx.game;
      for (const id of fx.game.squads[TEST_CLUB]!.slice(0, 16)) {
        short = withPlayer(short, id, { injuryRounds: 1 });
      }
      const states: Record<string, string> = {
        fixture: view(fx.game, fx.sheet, lang),
        free: view(fx.game, freed(1), lang),
        empty: view(fx.game, emptySheet, lang),
        injured: view(hurt, fx.sheet, lang),
        short: view(short, fx.sheet, lang),
        simplified: view(simplifiedGame(fx.game), fx.sheet, lang),
        selected: view(fx.game, fx.sheet, lang, {
          states: { selected: { part: 'bench', index: 0 } },
          status: {
            message: t('lineup.select.selected', lang, { name: 'X' }),
            detail: t('lineup.select.hint', lang),
          },
        }),
      };
      for (const [name, body] of Object.entries(states)) {
        expect(body.match(/data-slot="\d+"/g), `${lang}/${name}`).toHaveLength(11);
        expectNoRawKey(body, `${lang}/${name}`);
        expect(primaries(body), `${lang}/${name}`).toBe(0);
        // The one live region of the screen, always in the DOM.
        expect(body.match(/role="status"/g), `${lang}/${name}`).toHaveLength(1);
      }
      const loading = view(fx.game, fx.sheet, lang, { loading: true });
      expect(loading).toContain(shown(t('lineup.loading', lang)));
      expect(loading).not.toContain('data-slot=');
      expectNoRawKey(loading, `${lang}/loading`);
    });
  }

  it('the pitch: a named group and an ordered list in the slot order of the engine', () => {
    const body = view(fx.game, fx.sheet);
    expect(body).toContain('role="group" aria-label="Campo, formação 4-4-2"');
    expect(body).toMatch(/<ol class="slots/);
    // The slot order, read from each slot's accessible name (the position of the slot in full).
    const order = [...body.matchAll(/data-slot="(\d+)"[^>]*aria-label="([^":]+):/g)];
    expect(order.map((m) => Number(m[1]))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(order.map((m) => m[2])).toEqual(
      FORMATION_SLOTS['4-4-2'].map((p) => t(`position.${p}`, 'pt-BR')),
    );
    // Each chip's tag is its player's natural position, painted by his sector (escalacao.md, "Cor
    // de setor no LineupChip"), hidden from screen readers: the centre-back on the striker's slot
    // keeps ZAG in the defence colour, the attacking midfielder on a defensive one keeps MEI.
    const tags = [
      ...body.matchAll(
        /data-slot="(\d+)"[^]*?<span class="code[^"]*"><span class="rotulo tag ([^"]*)" aria-hidden="true">(\w+)</g,
      ),
    ];
    expect(tags).toHaveLength(11);
    tags.forEach((m, i) => {
      const player = fx.starters[i]!;
      expect(m[1]).toBe(String(i));
      expect(m[3]).toBe(t(`position.${player.position}.short`, 'pt-BR'));
      expect(m[2]).toContain(`sector-${SECTOR_OF[player.position]}`);
    });
    expect(tags[9]![3]).toBe('ZAG');
    expect(tags[6]![3]).toBe('MEI');
    expect(body).toContain('Formação <strong');
    expect(body).toContain(t('lineup.formation.change', 'pt-BR'));
    expect(body).toContain(t('lineup.suggest', 'pt-BR'));
  });

  it('the marks: "Fora de posição" with its icon, "Improvisado"; the warnings in full', () => {
    const body = view(fx.game, fx.sheet);
    expect(body).toMatch(/class="caption mark outOfPosition[^"]*"><svg[^]*?Fora de posição/);
    expect(body).toMatch(/class="caption mark improvised[^"]*"><svg[^]*?Improvisado/);
    expect(body).toContain(shown(`${fx.misplaced.name.full} (ZAG) jogando de ATA`));
    expect(body).toContain(shown(`${fx.tired.name.full} está cansado (condição 79)`));
  });

  it('a ready sheet: no banner; the bench "6 de 7" with a free place, Nota and Cond.', () => {
    expect(sheetProblems(fx.game, TEST_CLUB, fx.sheet).ready).toBe(true);
    const body = view(fx.game, fx.sheet);
    expect(body).not.toContain('class="banner');
    expect(body).toContain(t('lineup.bench.count', 'pt-BR', { count: 6, max: 7 }));
    expect(body).toContain(t('lineup.bench.empty', 'pt-BR'));
    expect(body).toContain('data-place="bench-6"');
    expect(body.match(/data-place="out-\d+"/g)).toHaveLength(8);
    expect(body).toContain('>Cond.<');
    expect(body.match(/class="cond/g)).toHaveLength(11);
  });

  it('"Deixar de fora": the first line of the players left out, free, never pressed', () => {
    const body = view(fx.game, fx.sheet);
    const group = body.slice(body.indexOf(t('lineup.out.title', 'pt-BR')));
    const first = /data-place="([^"]+)"/.exec(group)![1];
    expect(first).toBe('out-free');
    expect(body).toContain(`aria-label="${shown(t('lineup.out.freeA11y', 'pt-BR'))}"`);
    expect(body).toContain(t('lineup.out.free', 'pt-BR'));
    // Free places (a free slot and "Deixar de fora"; the bench is full again) have no aria-pressed.
    const free = view(fx.game, freed(1));
    for (const tag of free.match(/<button[^>]*class="(?:row|chip)[^"]*empty[^"]*"[^>]*>/g)!) {
      expect(tag).not.toContain('aria-pressed');
    }
    expect(free.match(/<button[^>]*class="(?:row|chip)[^"]*empty/g)).toHaveLength(2);
    // A squad of 18 or fewer: the section has only that line.
    const ids = [...fx.starters, ...fx.bench].map((p) => p.id);
    const small = { ...fx.game, squads: { ...fx.game.squads, [TEST_CLUB]: ids } };
    const smallBody = view(small, fx.sheet);
    expect(smallBody).toContain('data-place="out-free"');
    expect(smallBody).not.toMatch(/data-place="out-\d+"/);
  });

  it('a bench with free places only says so: no banner, the count goes down', () => {
    const empty: DraftSheet = {
      ...fx.sheet,
      lineup: { ...fx.sheet.lineup, bench: fx.sheet.lineup.bench.map(() => null) },
    };
    const body = view(fx.game, empty);
    expect(body).toContain(t('lineup.bench.count', 'pt-BR', { count: 0, max: 7 }));
    expect(body.match(/data-place="bench-\d"/g)).toHaveLength(7);
    expect(body).not.toContain('class="banner');
  });

  it('a free slot: "Vaga livre", the warning banner with "Completar automaticamente" and the issue', () => {
    const body = view(fx.game, freed(1));
    expect(body).toContain(t('lineup.slot.empty', 'pt-BR'));
    expect(body).toContain('aria-label="Zagueiro: vaga livre"');
    // An empty slot has no tag and no sector colour.
    const freeChip = /<button[^>]*data-slot="1"[^]*?<\/button>/.exec(body)![0];
    expect(freeChip).not.toContain('class="code');
    expect(freeChip).not.toMatch(/sector-/);
    expect(body).toMatch(/<section class="banner warning/);
    expect(body).toContain(t('lineup.invalid.title', 'pt-BR'));
    expect(body).toContain('Falta 1 titular.');
    expect(body).toContain(t('lineup.complete', 'pt-BR'));
    expect(body).toContain('Vaga de ZAG sem jogador');
    // The banner is not a live region of its own: the status bar is the only one.
    expect(body).not.toContain('role="alert"');
  });

  it('an injured starter: the mark on the slot, the issue and the banner', () => {
    const hurt = withPlayer(fx.game, fx.starters[7]!.id, { injuryRounds: 2 });
    const body = view(hurt, fx.sheet);
    expect(body).toMatch(/class="caption mark injured[^"]*"><svg[^]*?Lesionado, 2 rodadas/);
    expect(body).toContain(shown(`${fx.starters[7]!.name.full} (MEI) está lesionado, 2 rodadas`));
    expect(body).toContain('1 escalado não pode jogar.');
  });

  it('fewer than 11 who can play: the info banner, without blocking', () => {
    let short = fx.game;
    const ids = fx.game.squads[TEST_CLUB]!;
    for (const id of ids.slice(0, 16)) short = withPlayer(short, id, { injuryRounds: 1 });
    const check = sheetProblems(short, TEST_CLUB, fx.sheet);
    expect(check.available).toBeLessThan(11);
    const body = view(short, fx.sheet);
    expect(body).toContain(t('lineup.issue.short.other', 'pt-BR', { count: check.available }));
    expect(body).toMatch(/<section class="banner info/);
  });

  it('Realismo simplificado: no "Cond.", no condition bar, the help without tiredness', () => {
    const body = view(simplifiedGame(fx.game), fx.sheet);
    expect(body).not.toContain('>Cond.<');
    expect(body).not.toContain('class="cond');
    expect(body).toContain(shown(t('lineup.strength.help.simplified', 'pt-BR')));
    expect(body).not.toContain('está cansado');
  });

  it('a picked player: aria-pressed and the hint of the bar on every place', () => {
    const body = view(fx.game, fx.sheet, 'pt-BR', {
      states: { selected: { part: 'bench', index: 0 } },
      status: { message: 'Fulano selecionado', detail: t('lineup.select.hint', 'pt-BR') },
    });
    expect(body.match(/aria-pressed="true"/g)).toHaveLength(1);
    const hint = /<span class="caption detail[^"]*" id="([^"]+)"/.exec(body)![1]!;
    expect(
      body.match(new RegExp(`aria-describedby="${hint}"`, 'g'))!.length,
    ).toBeGreaterThanOrEqual(11);
  });

  it("a refusal: the reason under the athlete's row", () => {
    const message = t('lineup.refuse.injured.short', 'pt-BR');
    const body = view(fx.game, fx.sheet, 'pt-BR', {
      refusal: { place: { part: 'out', id: fx.injured.id }, message },
      states: { refused: { part: 'out', id: fx.injured.id } },
    });
    expect(body).toContain(shown(message));
    expect(body).toMatch(/class="row refused/);
  });
});

describe('the selector of the Elenco tab (escalacao.md, "Navegação")', () => {
  const tab = (v: SquadViewId) =>
    render(SquadTab, {
      props: {
        lang: 'pt-BR',
        game: fx.game,
        clubId: TEST_CLUB,
        view: v,
        onview: () => undefined,
        sort: 'position',
        onsort: () => undefined,
        sheet: fx.sheet,
        params,
        onedit: () => undefined,
      },
    }).body;

  it('Elenco | Escalação | Tática, the legend hidden; each view in its place', () => {
    const squad = tab('squad');
    for (const key of ['squad.view.squad', 'squad.view.lineup', 'squad.view.tactic']) {
      expect(squad).toContain(t(key, 'pt-BR'));
    }
    expect(squad).toMatch(/class="caption legend[^"]*visually-hidden/);
    expect(squad).toContain('<table');
    expect(squad).not.toContain('data-slot=');
    expect(tab('lineup')).toContain('data-slot="10"');
    // The Tática (T-077): the formations, no pitch of its own (CEO decision 2).
    const tactic = tab('tactic');
    expect(tactic).not.toContain(t('screen.soon', 'pt-BR'));
    expect(tactic).toContain(t('tactic.formation.legend', 'pt-BR'));
    expect(tactic).not.toContain('data-slot=');
  });
});

describe("the frame and the coach's sheet (US-017; ADR-0021)", () => {
  const careerOf = (game: GameState, draft?: DraftSheet): CareerState => ({
    status: 'open',
    save: {
      careerId: '00000000-0000-4000-8000-000000000029',
      career: { clubId: TEST_CLUB, ...(draft === undefined ? {} : { draft }) },
      game,
    } as unknown as CareerSave,
    busy: false,
    roundsLost: 0,
    missingSheetRounds: [],
  });
  const frame = (career: CareerState) =>
    render(CareerFrame, {
      props: {
        career,
        service: { params } as unknown as CareerService,
        log: {} as ErrorLog,
        lang: 'pt-BR',
        onhome: () => undefined,
      },
    }).body;

  it('untouched, the engine suggestion is ready: "Jogar rodada" ready', () => {
    const body = frame(careerOf(fx.game));
    expect(body).toContain('play float ready');
    expect(body).not.toContain('play float blocked');
  });

  it('a sheet that cannot go: "Jogar rodada" stays tappable, with the reason', () => {
    const body = frame(careerOf(fx.game, freed(1)));
    expect(body).toContain('play float blocked');
    expect(body).toContain(t('play.blocked.lineup', 'pt-BR'));
    // The sheet "Escalação incompleta" is in the DOM, closed.
    expect(body).toContain(t('lineup.check.play', 'pt-BR'));
  });

  it('a sheet that did not reach the device: the save notice with "Tentar de novo"', () => {
    const body = frame({ ...careerOf(fx.game), draftUnsaved: 'quota-exceeded' });
    expect(body).toMatch(/<section class="banner danger/);
    expect(body).toContain(shown(t('save.quota-exceeded.title', 'pt-BR')));
    expect(body).toContain(t('action.retry', 'pt-BR'));
    expect(body).toContain(t('action.free', 'pt-BR'));
    // The round is not blocked: the sheet goes with the next snapshot.
    expect(body).toContain('play float ready');
    // A code without its own text reads as "Não deu para salvar".
    const invalid = frame({ ...careerOf(fx.game), draftUnsaved: 'invalid-save' });
    expect(invalid).toContain(shown(t('save.write-failed.title', 'pt-BR')));
    // With a round unsaved, its banner covers both.
    const both = frame({
      ...careerOf(fx.game),
      unsaved: 'write-failed',
      draftUnsaved: 'write-failed',
    });
    expect(both.match(/<section class="banner danger/g)).toHaveLength(1);
  });

  it('the draft a round leaves (draftFromSheet of the sheet sent) is ready', () => {
    const draft = draftFromSheet(completeSheet(fx.game, TEST_CLUB, freed(1)));
    expect(frame(careerOf(fx.game, draft))).toContain('play float ready');
  });
});
