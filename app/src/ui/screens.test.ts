import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { config, type Lang } from '@lib/config';
import { MAX_CAREERS, type CareerSummary, type NewGameClub } from '@lib/career';
import { t } from '@lib/i18n';
import { latestClubSet } from '../data/club-sets.ts';
import { lastPlayedLine, progressLine } from './career-lines';
import type { DeleteState } from './delete-flow';
import { clubGroups, coachNameView, type StartProblem } from './new-game';
import CareerSheets from './screens/CareerSheets.svelte';
import HomeView from './screens/HomeView.svelte';
import NewGameView from './screens/NewGameView.svelte';
import SavesView from './screens/SavesView.svelte';

/*
 * QA of T-025 (US-014, US-034): the home screen, the new-game screen, Carreiras e backup and the
 * delete sheets rendered on the server (no DOM in the tests), for each state of the specs, in the
 * three languages, with no raw text key. The focus moves (after a delete, a cancel) are the
 * DeleteFlow's (delete-flow.test.ts); here, that their targets exist and that no sheet starts on
 * the destructive button. Touch, the real dialogs and the history are for the E2E.
 */

const LANGS: readonly Lang[] = ['pt-BR', 'es', 'en'];
const clubs = latestClubSet()!.clubs;
const NOW = new Date('2026-11-07T15:00:00');
const noop = () => undefined;

const shown = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/** A key of the text tables left on the screen (the fallback of `t` is the key itself). */
const RAW_KEY =
  /(?:^|[>\s"'])(?:nav|save|saves|action|play|career|error|screen|home|delete|newGame)\.[A-Za-z][\w.-]*(?=[<\s"'])/;
function expectNoRawKey(body: string, label: string): void {
  const text = body
    .replace(/<svg.*?<\/svg>/gs, '')
    .replace(/<style.*?<\/style>/gs, '')
    .replace(/(?:class|href|id|style|for|name|value|data-[a-z]+)="[^"]*"/g, '');
  expect(text.match(RAW_KEY)?.[0], `${label}: raw key on screen`).toBeUndefined();
  expect(text, `${label}: unfilled {placeholder}`).not.toMatch(/\{[a-z]+\}/i);
}

const primaries = (body: string) => (body.match(/class="btn botao primary/g) ?? []).length;

function summary(i: number): CareerSummary {
  return {
    id: `00000000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`,
    club: clubs[i % clubs.length]!,
    season: 1 + (i % 2),
    round: i === 1 ? 39 : 12 + i,
    // The most recent first, as the store lists them.
    updatedAt: new Date(NOW.getTime() - i * 36 * 3600_000).toISOString(),
    headSeq: 1,
    schemaVersion: 1,
  };
}
const careers = (n: number) => Array.from({ length: n }, (_, i) => summary(i));

type HomeProps = Parameters<typeof HomeView>[1];
const home = (props: Partial<HomeProps>, lang: Lang = 'pt-BR'): string =>
  render(HomeView, {
    props: {
      lang,
      now: NOW,
      onopen: noop,
      onupdate: noop,
      onnew: noop,
      onretry: noop,
      onactions: noop,
      ...props,
    },
  }).body;

describe('the checks of this file can fail', () => {
  it('see a raw key and an unfilled placeholder', () => {
    expect(() => expectNoRawKey('<p>home.empty.title</p>', 'x')).toThrow();
    expect(() => expectNoRawKey('<p>newGame.start</p>', 'x')).toThrow();
    expect(() => expectNoRawKey('<p>{club}</p>', 'x')).toThrow();
    expect(() => expectNoRawKey('<p>Começar</p>', 'x')).not.toThrow();
  });
});

describe('the home screen (inicio.md, US-034, US-043)', () => {
  for (const lang of LANGS) {
    it(`${lang}: every state has the brand, the slogan and the fiction notice, and no raw key`, () => {
      const states: Record<string, Partial<HomeProps>> = {
        loading: {},
        empty: { careers: [] },
        list: { careers: careers(3) },
        full: { careers: careers(MAX_CAREERS) },
        opening: { careers: careers(3), openingId: summary(1).id },
        tooNew: { careers: careers(2), tooNew: [summary(0).id] },
        notFound: { careers: careers(1), notFound: true },
        unexpected: { careers: careers(1), openError: 'unexpected' },
        listError: { listError: 'read-failed' },
        outdated: { listError: 'app-outdated' },
        noStorage: { noStorage: 'unsupported-browser' },
        storageUnavailable: { noStorage: 'storage-unavailable' },
        deleted: { careers: careers(1), announcement: t('home.deleted', lang, { club: 'X' }) },
      };
      for (const [name, props] of Object.entries(states)) {
        const body = home(props, lang);
        expect(body, name).toContain(`>${shown(config.name)}<`);
        expect(body, name).toContain(shown(config.slogan[lang]));
        expect(body, name).toContain(shown(t('home.fiction', lang)));
        expectNoRawKey(body, `${lang}/${name}`);
        // At most one primary button on the screen.
        expect(primaries(body), `${lang}/${name}`).toBeLessThanOrEqual(1);
      }
    });
  }

  it('loading: the skeleton with the text for screen readers, no list nor empty state', () => {
    const body = home({});
    // One status announces the wait; the filler rows are hidden from screen readers (NIT 14).
    const at = body.indexOf('<div aria-hidden="true">');
    expect(at).toBeGreaterThan(0);
    expect((body.slice(0, at).match(/role="status"/g) ?? []).length).toBe(1);
    expect(body.slice(at)).toContain('role="status"');
    expect(body).toContain('class="skeleton');
    expect(body).toContain(t('home.loading', 'pt-BR'));
    expect(body).not.toContain(t('home.empty.title', 'pt-BR'));
    expect(body).not.toContain(t('home.new', 'pt-BR'));
  });

  it('no careers: the empty state with "Nova carreira" as the primary', () => {
    const body = home({ careers: [] });
    expect(body).toContain(shown(t('home.empty.title', 'pt-BR')));
    expect(body).toContain(shown(t('home.empty.body', 'pt-BR')));
    expect(primaries(body)).toBe(1);
    expect(body).toMatch(/class="btn botao primary[^"]*"[^>]*>.*?Nova carreira/s);
    // The focus target after deleting the last career.
    expect(body).toContain('data-focus="list"');
  });

  it('the list: the most recent featured with "Continuar", the others as rows, count and dates', () => {
    const list = careers(3);
    const body = home({ careers: list });
    expect(body).toContain(shown(t('home.careers.title', 'pt-BR')));
    expect(body).toContain(t('home.careers.count', 'pt-BR', { count: 3, max: 10 }));
    expect(body).toContain('card featured');
    expect((body.match(/class="card row/g) ?? []).length).toBe(2);
    // The featured card is the first one, and "Continuar" is the only primary.
    expect(body.indexOf('card featured')).toBeLessThan(body.indexOf('card row'));
    expect(primaries(body)).toBe(1);
    // The order of the store, most recent first.
    const positions = list.map((c) => body.indexOf(`data-career="${c.id}"`));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    for (const c of list) {
      expect(body).toContain(shown(c.club.shortName));
      expect(body).toContain(shown(progressLine(c, 'pt-BR')));
      expect(body).toContain(shown(lastPlayedLine(c.updatedAt, NOW, 'pt-BR')));
      expect(body).toContain(
        `aria-label="${shown(t('home.career.actions', 'pt-BR', { club: c.club.shortName }))}"`,
      );
    }
    // A row continues by its accessible name; the heading takes the focus after a delete.
    expect(body).toContain(
      `aria-label="${shown(t('home.career.continueA11y', 'pt-BR', { club: list[1]!.club.shortName }))}"`,
    );
    expect(body).toMatch(/<h2[^>]*tabindex="-1"[^>]*data-focus="list"/);
    // A row's name is the action; its season, round and date describe it (SHOULD 2).
    const row = body.match(/<button[^>]*class="hit[^"]*"[^>]*>/)?.[0] ?? '';
    const described = row.match(/aria-describedby="([^"]+)"/)?.[1]?.split(' ') ?? [];
    expect(described.length).toBeGreaterThanOrEqual(2);
    const textOf = (id: string) =>
      body.match(new RegExp(`id="${id}"[^>]*>([^<]*)<`))?.[1] ?? '(missing)';
    expect(described.map(textOf)).toEqual(
      expect.arrayContaining([
        shown(progressLine(list[1]!, 'pt-BR')),
        shown(lastPlayedLine(list[1]!.updatedAt, NOW, 'pt-BR')),
      ]),
    );
    // Round 39: the season is over (career 1).
    expect(body).toContain(shown(t('home.career.seasonOver', 'pt-BR', { season: 2 })));
    expect(body).toContain(t('home.new', 'pt-BR'));
    // The live region for the delete is there before it is needed.
    expect(body).toMatch(/aria-live="polite"/);
  });

  it('full (10): the banner with what to do, and no "Nova carreira"', () => {
    const body = home({ careers: careers(MAX_CAREERS) });
    expect(body).toContain('banner warning');
    expect(body).toContain(shown(t('save.career-limit.title', 'pt-BR')));
    expect(body).toContain(shown(t('home.limit.body', 'pt-BR')));
    expect(body).not.toContain(t('home.new', 'pt-BR'));
    expect(body).toContain(t('home.careers.count', 'pt-BR', { count: 10, max: 10 }));
  });

  it('opening: the card being opened is busy, with the text for screen readers', () => {
    for (const opening of [summary(0).id, summary(1).id]) {
      const body = home({ careers: careers(3), openingId: opening });
      expect((body.match(/aria-busy="true"/g) ?? []).length).toBe(1);
      expect(body).toContain(shown(t('home.career.opening', 'pt-BR')));
    }
  });

  it('a newer build wrote the career: badge and line in text, and the card updates the game', () => {
    const body = home({ careers: careers(2), tooNew: [summary(0).id] });
    expect(body).toContain(shown(t('home.badge.tooNew', 'pt-BR')));
    expect(body).toContain(shown(t('save.save-too-new.title', 'pt-BR')));
    expect(body).toContain(shown(t('action.update', 'pt-BR')));
    expect(body).toContain('badge rotulo warning');
    // On a row the badge sits under the text (SHOULD 7) and describes the row.
    const rows = home({ careers: careers(2), tooNew: [summary(1).id] });
    const badgeId = rows.match(/<span class="badge rotulo warning[^"]*" id="([^"]+)"/)?.[1];
    expect(badgeId).toBeTruthy();
    expect(rows).toMatch(new RegExp(`aria-describedby="[^"]*${badgeId}`));
    const badgeAt = rows.indexOf(`id="${badgeId}"`);
    const lastAt = rows.indexOf(`id="${badgeId!.replace(/-badge$/, '-last')}"`);
    expect(lastAt).toBeGreaterThan(0);
    expect(badgeAt).toBeGreaterThan(lastAt);
    // Still inside the text column, before the chevron.
    expect(badgeAt).toBeLessThan(rows.indexOf('class="chev', lastAt));
  });

  it('not-found: the band says the career is gone', () => {
    const body = home({ careers: careers(1), notFound: true });
    expect(body).toContain(shown(t('save.not-found.title', 'pt-BR')));
  });

  it('an error listing: the block with "Tentar de novo", and "Nova carreira" stays', () => {
    const body = home({ listError: 'read-failed' });
    expect(body).toContain('error block');
    expect(body).toContain(shown(t('save.read-failed.title', 'pt-BR')));
    expect(body).toContain(t('action.retry', 'pt-BR'));
    expect(body).toContain(t('error.code', 'pt-BR', { code: 'read-failed' }));
    expect(body).toContain(t('home.new', 'pt-BR'));
    expect(home({ listError: 'app-outdated' })).toContain(t('action.reload', 'pt-BR'));
  });

  it('a browser that cannot save: the block with the help link, no "Nova carreira" nor "Continuar"', () => {
    for (const code of ['unsupported-browser', 'storage-unavailable'] as const) {
      for (const lang of LANGS) {
        // Even with careers listed before: nothing could be saved.
        const body = home({ noStorage: code, careers: careers(2) }, lang);
        expect(body, code).toContain('error block');
        expect(body, code).toContain(shown(t(`save.${code}.title`, lang)));
        expect(body, code).toContain(`href="${config.contacts.supportUrl}"`);
        expect(body, code).not.toContain(shown(t('home.new', lang)));
        expect(body, code).not.toContain(shown(t('home.continue', lang)));
        expect(body, code).not.toContain('card featured');
        expect(primaries(body), code).toBe(0);
      }
    }
  });
});

describe('the delete sheets (US-034)', () => {
  const career = summary(0);
  const club = career.club.shortName;
  const sheets = (flow: DeleteState, lang: Lang = 'pt-BR', currentId?: string) =>
    render(CareerSheets, {
      props: {
        lang,
        flow,
        currentId,
        onchoose: noop,
        onproceed: noop,
        onconfirm: noop,
        oncancel: noop,
      },
    }).body;
  /** The position of a button by its text, and of the sheet's close button. */
  const closeAt = (body: string, lang: Lang) =>
    body.indexOf(`aria-label="${shown(t('nav.close', lang))}"`);

  it('idle: nothing', () => {
    expect(sheets({ stage: 'idle' })).not.toContain('<dialog');
  });

  for (const lang of LANGS) {
    it(`${lang}: actions, step 1 and step 2, each with cancel last and no raw key`, () => {
      const actions = sheets({ stage: 'actions', career }, lang);
      expect(actions).toContain(shown(t('home.career.actionsTitle', lang, { club })));
      expect(actions).toContain(shown(t('delete.action', lang)));
      expect(actions.lastIndexOf(shown(t('delete.cancel', lang)))).toBeGreaterThan(
        actions.indexOf(shown(t('delete.action', lang))),
      );
      expectNoRawKey(actions, `${lang}/actions`);

      const step1 = sheets({ stage: 'step1', career }, lang);
      expect(step1).toContain(shown(t('delete.step1.title', lang, { club })));
      expect(step1).toContain(shown(t('delete.step1.body.noExport', lang)));
      expect(step1).toContain(shown(t('delete.step1.continue', lang)));
      // Step 1 destroys nothing: no danger button; no export before T-020 (CEO decision 5).
      expect(step1).not.toContain('btn botao danger');
      expect(step1).not.toContain(shown(t('action.export', lang)));
      expect(step1).toContain(shown(progressLine(career, lang)));
      expectNoRawKey(step1, `${lang}/step1`);

      const step2 = sheets({ stage: 'step2', career, busy: false, failed: false }, lang);
      expect(step2).toContain(shown(t('delete.step2.title', lang, { club })));
      expect(step2).toContain(shown(t('delete.step2.body', lang)));
      expect(step2).toMatch(/class="btn botao danger/);
      expectNoRawKey(step2, `${lang}/step2`);
    });
  }

  it('the focus starts on the close button, before any confirm (showModal focuses the first)', () => {
    for (const flow of [
      { stage: 'actions', career },
      { stage: 'step1', career },
      { stage: 'step2', career, busy: false, failed: false },
    ] as const) {
      const body = sheets(flow);
      const firstButton = body.indexOf('<button');
      expect(firstButton, flow.stage).toBe(body.indexOf('<button type="button" class="close'));
      expect(closeAt(body, 'pt-BR'), flow.stage).toBeLessThan(body.indexOf('class="btn botao'));
    }
  });

  it('cancel is always last; only the final step sets it apart, lifting the delete (BLOCKER)', () => {
    const step1 = sheets({ stage: 'step1', career });
    const step2 = sheets({ stage: 'step2', career, busy: false, failed: false });
    const actions = sheets({ stage: 'actions', career });
    const cancel = shown(t('delete.cancel', 'pt-BR'));
    // The same order in every sheet of the flow: the step button, then cancel.
    expect(step1.indexOf(shown(t('delete.step1.continue', 'pt-BR')))).toBeLessThan(
      step1.lastIndexOf(cancel),
    );
    expect(step2.indexOf('btn botao danger')).toBeLessThan(step2.lastIndexOf(cancel));
    expect(actions.indexOf('btn botao danger')).toBeLessThan(actions.lastIndexOf(cancel));
    // Only step 2 (the destructive one) has cancel set apart below the divider.
    expect(step2).toMatch(/class="cancel[^"]*apart/);
    expect(step1).not.toMatch(/class="cancel[^"]*apart/);
  });

  it('the live region of the failure is always in the tree, even empty (SHOULD 3)', () => {
    const body = sheets({ stage: 'step2', career, busy: false, failed: false });
    expect(body).toMatch(/<p class="body error[^"]*" aria-live="polite">/);
  });

  it('step 2 deleting: busy with its text, cancel disabled; failed: the message, in text', () => {
    const busy = sheets({ stage: 'step2', career, busy: true, failed: false });
    expect(busy).toContain('aria-busy="true"');
    expect(busy).toContain(t('delete.busy', 'pt-BR'));
    expect(busy).toMatch(/<button[^>]*disabled[^>]*>.*?Cancelar/s);
    const failed = sheets({ stage: 'step2', career, busy: false, failed: true });
    expect(failed).toContain(shown(t('delete.failed', 'pt-BR')));
    expect(failed).toContain('aria-live="polite"');
  });

  it('the open career (Carreiras e backup): no delete, the sentence saying why', () => {
    const body = sheets({ stage: 'actions', career }, 'pt-BR', career.id);
    expect(body).toContain(shown(t('saves.current.noDelete', 'pt-BR')));
    expect(body).not.toContain(shown(t('delete.action', 'pt-BR')));
  });
});

describe('Carreiras e backup inside the frame (saves.md)', () => {
  const saves = (props: Partial<Parameters<typeof SavesView>[1]>, lang: Lang = 'pt-BR') =>
    render(SavesView, {
      props: {
        lang,
        now: NOW,
        currentId: summary(0).id,
        onretry: noop,
        onactions: noop,
        ...props,
      },
    }).body;

  for (const lang of LANGS) {
    it(`${lang}: the open career first with "Atual" in text; rows do not open a career`, () => {
      const body = saves({ careers: careers(3) }, lang);
      expect((body.match(/class="card row/g) ?? []).length).toBe(3);
      const badge = body.search(
        new RegExp(
          `class="badge rotulo neutral[^>]*>(?:<!--[^>]*-->|\\s)*${shown(t('saves.current', lang))}<`,
        ),
      );
      expect(badge).toBeGreaterThan(body.indexOf(`data-career="${summary(0).id}"`));
      expect(badge).toBeLessThan(body.indexOf(`data-career="${summary(1).id}"`));
      // A row opens nothing from here: plain content without the chevron, not a disabled button;
      // only its "Mais ações" acts (review NIT 12).
      expect((body.match(/<div class="hit static/g) ?? []).length).toBe(3);
      expect(body).not.toMatch(/<button[^>]*class="hit/);
      expect(body).not.toMatch(/<button[^>]*disabled/);
      expect(body).not.toContain('class="chev');
      expect(body).not.toContain(shown(t('saves.onlyCurrent', lang)));
      expectNoRawKey(body, `${lang}/saves`);
      expect(primaries(body)).toBe(0);
    });
  }

  it('only the open career: the sentence under the list', () => {
    expect(saves({ careers: careers(1) })).toContain(shown(t('saves.onlyCurrent', 'pt-BR')));
  });

  it('loading and an error listing', () => {
    expect(saves({})).toContain('class="skeleton');
    const error = saves({ listError: 'read-failed' });
    expect(error).toContain('error block');
    expect(error).toContain(t('action.retry', 'pt-BR'));
  });
});

describe('the new-game screen (novo-jogo.md, US-014)', () => {
  const choices: NewGameClub[] = clubs.map((club) => ({ club, strength: club.strength! }));
  type Props = Parameters<typeof NewGameView>[1];
  const view = (props: Partial<Props>, lang: Lang = 'pt-BR'): string => {
    const coachName = props.coachName ?? t('career.coachDefault', lang);
    return render(NewGameView, {
      props: {
        lang,
        groups: clubGroups(choices, lang),
        coachName,
        coach: coachNameView(coachName, true, lang),
        setup: { realism: 'full', matchMode: 'result' },
        optionsOpen: false,
        creating: false,
        slow: false,
        onback: noop,
        onselect: noop,
        onoptions: noop,
        onclose: noop,
        onname: noop,
        onnameleave: noop,
        onrealism: noop,
        onmatch: noop,
        onstart: noop,
        onlist: noop,
        ...props,
      },
    }).body;
  };
  const flamingo = clubs.find((c) => c.id === 'flamingo')!;
  const chosen = { club: flamingo, strength: flamingo.strength!, band: 'Favorito' };
  /** The start button: its tag. */
  const startTag = (body: string) =>
    body.match(/<button[^>]*>(?:(?!<\/button>).)*?Começar/s)?.[0] ?? '';

  for (const lang of LANGS) {
    it(`${lang}: three bands, the 20 clubs in one radio group, the summary and no raw key`, () => {
      const body = view({}, lang);
      for (const band of ['favorite', 'mid', 'relegation']) {
        expect(body).toContain(shown(t(`newGame.band.${band}`, lang)));
      }
      expect((body.match(/type="radio" name="club"/g) ?? []).length).toBe(20);
      expect(body).toContain(shown(t('newGame.clubs.hint', lang)));
      expect(body).toContain(shown(t('newGame.options.title', lang)));
      expect(body).toContain(shown(t('newGame.realism.full', lang)));
      expect(body).toContain(shown(t('newGame.match.result', lang)));
      expect(body).toContain(shown(t('career.coachDefault', lang)));
      expectNoRawKey(body, `${lang}/new-game`);
      expect(primaries(body)).toBe(1);
    });

    it(`${lang}: P3, no option of later stages, and only "Só resultado" (CEO decision 3)`, () => {
      const body = view({ optionsOpen: true }, lang);
      expect(body).not.toContain(shown(t('newGame.match.full', lang)));
      expect(body).not.toContain(shown(t('newGame.match.highlights', lang)));
      expect((body.match(/type="radio" name="match"/g) ?? []).length).toBe(1);
      expect((body.match(/type="radio" name="realism"/g) ?? []).length).toBe(2);
      // Nothing to change the mode to yet: no "Dá para trocar depois" (SHOULD 4).
      expect(body).not.toContain(shown(t('newGame.match.note', lang)));
      expect(body).toContain(shown(t('newGame.realism.note', lang)));
      // The club's whole label is its name; nothing repeated by aria-describedby (NIT 11).
      expect(body).not.toMatch(/name="club"[^>]*aria-describedby/);
    });
  }

  it('no club text of a later stage (ritmo, desempregado, América do Sul, nuvem)', () => {
    const body = view({ optionsOpen: true }).toLowerCase();
    for (const word of [
      'tempo real',
      'desempregado',
      'livre',
      'américa do sul',
      'nuvem',
      'em breve',
    ]) {
      expect(body, word).not.toContain(word);
    }
  });

  it('without a club: "Começar" disabled and tied to the reason in the bar', () => {
    const body = view({});
    const tag = startTag(body);
    expect(tag).toContain('disabled');
    const id = tag.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(body).toMatch(
      new RegExp(`id="${id}"[^>]*>(?:(?!</div>).)*${shown(t('newGame.bar.noClub', 'pt-BR'))}`, 's'),
    );
  });

  it('with a club: the bar shows it with strength and band, and "Começar" is ready', () => {
    const body = view({ selected: 'flamingo', chosen });
    expect(body).toContain(
      shown(t('newGame.bar.club', 'pt-BR', { strength: flamingo.strength!, band: 'Favorito' })),
    );
    expect(startTag(body)).not.toContain('disabled');
    expect(startTag(body)).not.toContain('aria-describedby');
    // The chosen club is checked.
    expect(body).toMatch(/value="flamingo"[^>]*checked/);
  });

  it('an invalid nickname: the field, the summary and the bar say so, and "Começar" is disabled', () => {
    for (const coachName of ['', '   ', 'A'.repeat(25)]) {
      const body = view({ selected: 'flamingo', chosen, coachName, optionsOpen: true });
      expect(body).toContain(shown(t('newGame.options.problem', 'pt-BR')));
      expect(body).toContain(shown(t('newGame.bar.invalidName', 'pt-BR')));
      expect(body).toContain('aria-invalid="true"');
      expect(body).toContain('role="alert"');
      expect(startTag(body)).toContain('disabled');
    }
  });

  it('the nickname field: 17px text, no native maxlength, the keyboard hints of the spec', () => {
    const body = view({ optionsOpen: true });
    const input = body.match(/<input[^>]*type="text"[^>]*>/)?.[0] ?? '';
    expect(input).toContain('body-lg');
    expect(input).not.toContain('maxlength');
    expect(input).toContain('autocapitalize="words"');
    expect(input).toContain('spellcheck="false"');
    expect(input).toContain('autocomplete="off"');
    expect(input).toContain('enterkeyhint="done"');
    expect(body).toContain(shown(t('newGame.coach.hint', 'pt-BR')));
    expect(body).toContain(t('newGame.coach.counter', 'pt-BR', { count: 7, max: 24 }));
  });

  it('creating: "Começar" busy with its text; after a second, the loading screen', () => {
    const busy = view({ selected: 'flamingo', chosen, creating: true });
    expect(busy).toContain('aria-busy="true"');
    expect(busy).toContain(shown(t('newGame.start.busy', 'pt-BR')));
    expect(busy).not.toContain(shown(t('newGame.loading', 'pt-BR')));
    // The list and the summary do nothing while creating.
    expect(busy).toMatch(/class="content[^"]*"[^>]*inert/);
    const slow = view({ selected: 'flamingo', chosen, creating: true, slow: true });
    expect(slow).toContain(shown(t('newGame.loading', 'pt-BR')));
  });

  it('the start problems: limit, no room and another error, each with its way out', () => {
    const at = (problem: StartProblem) => view({ selected: 'flamingo', chosen, problem });
    const limit = at({ kind: 'career-limit' });
    expect(limit).toContain('banner warning');
    expect(limit).toContain(shown(t('newGame.limit.action', 'pt-BR')));
    const quota = at({ kind: 'quota-exceeded' });
    expect(quota).toContain('banner danger');
    expect(quota).toContain(shown(t('save.quota-exceeded.title', 'pt-BR')));
    expect(quota).toContain(shown(t('action.free', 'pt-BR')));
    // "Começar" works again to try once more.
    expect(startTag(quota)).not.toContain('disabled');
    const other = at({ kind: 'error', code: 'write-failed' });
    expect(other).toContain('error block');
    expect(other).toContain(t('action.retry', 'pt-BR'));
    expect(other).toContain(t('error.code', 'pt-BR', { code: 'write-failed' }));
    const bug = at({ kind: 'error', code: 'unexpected' });
    expect(bug).toContain(shown(t('error.unexpected.title', 'pt-BR')));
    for (const body of [limit, quota, other, bug]) expectNoRawKey(body, 'problem');
  });

  it('no clubs (data that does not pass the check): an error block, "Começar" disabled', () => {
    const body = view({ groups: [] });
    expect(body).toContain('error block');
    expect(body).toContain(t('error.code', 'pt-BR', { code: 'invalid-clubs' }));
    expect(startTag(body)).toContain('disabled');
  });
});
