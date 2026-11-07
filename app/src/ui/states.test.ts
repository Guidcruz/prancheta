import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { CareerSave, CareerService, CareerState, FatalCode, WriteError } from '@lib/career';
import type { ErrorLog } from '@lib/errors';
import { t } from '@lib/i18n';
import type { Lang } from '@lib/config';
import { latestClubSet } from '../data/club-sets.ts';
import { testCareer } from './testing/game';
import CareerFrame from './CareerFrame.svelte';
import FatalScreen from './screens/FatalScreen.svelte';

/*
 * QA of T-023 (US-015, US-045): what the player sees for each code of the save, in the three
 * languages, rendered on the server (no DOM). The shape of each error (band, content area, full
 * screen) and its code on screen; no raw text key anywhere; the current tab marked beyond colour;
 * one announcing region at a time.
 *
 * Already covered in frame.test.ts (pt-BR, one state each) and save-alerts.test.ts (every code has
 * title, body and actions in pt-BR); this file adds every code x every language. The states made by the real
 * CareerService over fake-indexeddb are in integration/career-ui.test.ts (ui/ cannot import lib/save). Touch, focus, the "Mais" sheet, breakpoints
 * and scroll are for the E2E of T-024.
 */

const LANGS: readonly Lang[] = ['pt-BR', 'es', 'en'];
const club = latestClubSet()!.clubs[0]!;
const save = {
  careerId: '00000000-0000-4000-8000-000000000023',
  career: { clubId: club.id },
  game: testCareer('full', 5),
} as unknown as CareerSave;
const OPEN: CareerState = {
  status: 'open',
  save,
  busy: false,
  roundsLost: 0,
  missingSheetRounds: [],
};
const noop = () => undefined;

const frame = (career: CareerState, lang: Lang): string =>
  render(CareerFrame, {
    props: { career, service: {} as CareerService, log: {} as ErrorLog, lang, onhome: noop },
  }).body;
const fatal = (code: FatalCode, unsaved: boolean, lang: Lang): string =>
  render(FatalScreen, {
    props: { code, unsaved, lang, onretry: noop, onhome: noop },
  }).body;

/** The same text as the page shows: HTML-escaped, as the server renders it. */
const shown = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const codeLine = (code: string, lang: Lang) => t('error.code', lang, { code });

/** A key of the text tables left on the screen (the fallback of `t` is the key itself). */
const RAW_KEY =
  /(?:^|[>\s"'])(?:nav|save|action|play|career|error|screen)\.[A-Za-z][\w.-]*(?=[<\s"'])/;
function expectNoRawKey(body: string, label: string): void {
  const text = body
    .replace(/<svg.*?<\/svg>/gs, '')
    // Drop the attribute values that are addresses or class lists, keep texts and aria-labels.
    .replace(/(?:class|href|id|style|for)="[^"]*"/g, '');
  expect(text.match(RAW_KEY)?.[0], `${label}: raw key on screen`).toBeUndefined();
  expect(text, `${label}: unfilled {placeholder}`).not.toMatch(/\{[a-z]+\}/i);
}

/** Inner HTML of the element that opens at `start` (balanced by tag name). */
function innerOf(html: string, start: number, tag: string): string {
  const open = new RegExp(`<${tag}[\\s>]|</${tag}>`, 'g');
  open.lastIndex = html.indexOf('>', start) + 1;
  const from = open.lastIndex;
  let depth = 1;
  for (let m = open.exec(html); m; m = open.exec(html)) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(from, m.index);
  }
  return html.slice(from);
}

/** Live regions that carry text (an empty one announces nothing). */
function announcing(body: string): number {
  const html = body.replace(/<!--.*?-->/gs, '').replace(/<svg.*?<\/svg>/gs, '');
  let count = 0;
  for (const m of html.matchAll(/<([a-z]+)\s[^>]*role="(?:alert|status)"[^>]*>/g)) {
    const text = innerOf(html, m.index, m[1]!).replace(/<[^>]*>/g, ' ');
    if (/[A-Za-zÀ-ú]{3}/.test(text)) count++;
  }
  return count;
}

const FATAL_CODES: readonly FatalCode[] = [
  'conflict',
  'app-outdated',
  'save-too-new',
  'unsupported-browser',
  'all-corrupt',
  'read-failed',
];
const BANNER_CODES: readonly WriteError[] = [
  'quota-exceeded',
  'verify-failed',
  'too-large',
  'write-failed',
  'read-failed',
  'storage-unavailable',
];

describe('the checks of this file can fail', () => {
  it('see a raw key, an unfilled placeholder and a populated live region', () => {
    expect(() => expectNoRawKey('<p>save.conflict.title</p>', 'x')).toThrow();
    expect(() => expectNoRawKey('<p>{code}</p>', 'x')).toThrow();
    expect(() => expectNoRawKey('<p>Sem espaço</p>', 'x')).not.toThrow();
    expect(announcing('<div role="status"><p>Olá mundo</p></div><div role="alert"></div>')).toBe(1);
    expect(announcing('<div role="status"><p>Um aviso</p></div><p role="alert">Outro</p>')).toBe(2);
  });
});

describe('full-screen errors: every code, every language (CEO decisions 2 and 3)', () => {
  for (const lang of LANGS) {
    it.each(FATAL_CODES)(
      `${lang}: %s is a full screen with its code, title and a way out`,
      (code) => {
        for (const unsaved of [false, true]) {
          const body = fatal(code, unsaved, lang);
          expect(body).toMatch(/^(<!--[^>]*-->)*<main/);
          expect(body).toContain('error screen');
          expect(body).toContain(shown(codeLine(code, lang)));
          expect(body).toContain(shown(t(`save.${code}.title`, lang)));
          expect(body).toContain(shown(t(`save.${code}.body`, lang)));
          // Full screen: no tabs, no "Jogar rodada".
          expect(body).not.toContain('aria-current');
          expect(body).not.toContain(shown(t('play.label', lang)));
          expect(body).toContain('<button');
          expectNoRawKey(body, `${lang}/${code}`);
          // The code line is the player's reference for support: never a stack or a path.
          expect(body).not.toMatch(/\.ts:\d+|node_modules|at .*\(/);
        }
      },
    );
  }

  it('the code line is the same in the three languages (one code for support)', () => {
    for (const code of FATAL_CODES) {
      const lines = LANGS.map((lang) => codeLine(code, lang).replace(/^[^:]*:\s*/, ''));
      expect(new Set(lines).size, code).toBe(1);
      expect(lines[0]).toBe(code);
    }
  });

  it('the two-tab errors put "Recarregar" before "Voltar ao início" in every language', () => {
    for (const lang of LANGS) {
      for (const code of ['conflict', 'app-outdated'] as const) {
        const body = fatal(code, true, lang);
        expect(body.indexOf(shown(t('action.reload', lang))), `${lang}/${code}`).toBeGreaterThan(0);
        if (code === 'conflict') {
          expect(body.indexOf(shown(t('action.reload', lang)))).toBeLessThan(
            body.indexOf(shown(t('action.home', lang))),
          );
        }
      }
    }
  });

  it('app-outdated says the round of this tab was not saved only after a write, in every language', () => {
    for (const lang of LANGS) {
      const line = shown(t('save.app-outdated.bodyUnsaved', lang));
      expect(line).not.toBe('save.app-outdated.bodyUnsaved');
      expect(fatal('app-outdated', true, lang)).toContain(line);
      expect(fatal('app-outdated', false, lang)).not.toContain(line);
    }
  });
});

describe('a round not saved: the band, never a full screen (CEO decision 1)', () => {
  for (const lang of LANGS) {
    it.each(BANNER_CODES)(
      `${lang}: %s is a danger banner in the band, with the reason on the blocked button`,
      (code) => {
        const body = frame({ ...OPEN, unsaved: code }, lang);
        expect(body).toMatch(/<section class="banner danger[^"]*">/);
        expect(body).toContain(shown(t(`save.${code}.title`, lang)));
        expect(body).toContain(shown(t(`save.${code}.body`, lang)));
        expect(body).toContain('play float blocked');
        expect(body).toContain(shown(t('play.blocked.unsaved', lang)));
        // The tabs stay (the player can still look around), no full-screen error.
        expect(body).toContain('href="#/squad"');
        expect(body).not.toContain('error screen');
        expectNoRawKey(body, `${lang}/${code}`);
        expect(announcing(body), `${lang}/${code}: announcing regions`).toBe(1);
      },
    );
  }

  it('the banner also offers a way out in every language (retry or export or home)', () => {
    for (const lang of LANGS) {
      const body = frame({ ...OPEN, unsaved: 'quota-exceeded' }, lang);
      expect(body).toContain(shown(t('action.retry', lang)));
    }
  });
});

describe('errors inside the content area and the rounds lost notice', () => {
  for (const lang of LANGS) {
    it(`${lang}: a bug (crash or invalid-save) takes the area with its code; tabs stay`, () => {
      for (const [state, code] of [
        [{ ...OPEN, crash: 'unexpected' as const }, 'unexpected'],
        [{ ...OPEN, unsaved: 'invalid-save' as const }, 'invalid-save'],
      ] as const) {
        const body = frame(state, lang);
        expect(body).toContain('error area');
        expect(body).toContain(shown(codeLine(code, lang)));
        expect(body).toContain(shown(t('error.unexpected.title', lang)));
        expect(body).toContain(shown(t('action.retry', lang)));
        expect(body).toContain(shown(t('action.home', lang)));
        expect(body).toContain('href="#/table"');
        expect(body).not.toContain('class="banner');
        expectNoRawKey(body, `${lang}/${code}`);
        expect(announcing(body), `${lang}/${code}`).toBe(1);
      }
    });

    it(`${lang}: rounds lost is a warning, singular and plural, dismissible`, () => {
      for (const count of [1, 3]) {
        const body = frame({ ...OPEN, roundsLost: count }, lang);
        expect(body).toContain('banner warning');
        expect(body).toContain(shown(t('save.roundsLost.title', lang)));
        expect(body).toContain(shown(t('save.roundsLost.action.ok', lang)));
        expect(body).toContain(String(count));
        expect(body).not.toContain('play float blocked');
        expectNoRawKey(body, `${lang}/lost${count}`);
        expect(announcing(body)).toBe(1);
      }
    });
  }

  it('a danger notice goes above a warning, and at most two show', () => {
    const body = frame({ ...OPEN, unsaved: 'quota-exceeded', roundsLost: 2 }, 'pt-BR');
    expect(body.indexOf('banner danger')).toBeGreaterThan(0);
    expect(body.indexOf('banner danger')).toBeLessThan(body.indexOf('banner warning'));
    expect((body.match(/class="banner /g) ?? []).length).toBe(2);
    // Both are in one band, so one live region (the band) announces them.
    expect(body).not.toContain('role="alert"');
  });
});

describe('navigation (US-015)', () => {
  for (const lang of LANGS) {
    it(`${lang}: four tabs with text and icon in the bottom bar and the sidebar, current marked`, () => {
      const body = frame(OPEN, lang);
      for (const key of ['nav.tab.club', 'nav.tab.squad', 'nav.tab.table', 'nav.tab.calendar']) {
        const anchors = (body.match(/<a class="tab[^>]*>.*?<\/a>/gs) ?? []).filter((a) =>
          a.includes(`>${shown(t(key, lang))}<`),
        );
        expect(anchors, `${lang}/${key}`).toHaveLength(2);
        // An icon (the Icon component's svg) comes with the text.
        for (const a of anchors) expect(a, `${lang}/${key} icon`).toContain('<svg');
      }
      // Mercado is not in the Etapa 1.
      expect(body).not.toMatch(/href="#\/market"/);
      // Beyond colour: aria-current on the current tab (and only on it), in both bars.
      const currents = body.match(/<a [^>]*aria-current="page"[^>]*>/g) ?? [];
      expect(currents).toHaveLength(2);
      for (const a of currents) expect(a).toContain('href="#/club"');
      // The menu icon button has an accessible name in the language.
      expect(body).toContain(`aria-label="${shown(t('nav.more', lang))}"`);
      expect(body).toContain(`aria-label="${shown(t('nav.label', lang))}"`);
      expectNoRawKey(body, `${lang}/nav`);
    });
  }

  it('"Jogar rodada" is in the sidebar and in the dock, ready when nothing blocks it', () => {
    const body = frame(OPEN, 'pt-BR');
    expect((body.match(/class="play (?:side|float) ready/g) ?? []).length).toBe(2);
    expect(body).not.toContain('aria-disabled="true"');
  });

  it('with a round computing there is one announcement text, and the button is marked busy', () => {
    const body = frame({ ...OPEN, busy: true }, 'pt-BR');
    expect(body).toContain('aria-busy="true"');
    expect(body).toContain(shown(t('play.busy', 'pt-BR')));
  });

  it('the footer of the club screen has the same entries as the "Mais" menu', () => {
    // The "Mais" sheet is closed on the server; its entries are the nav items of the sidebar.
    const body = frame(OPEN, 'pt-BR');
    for (const key of ['nav.saves', 'nav.preferences', 'nav.about']) {
      expect(body, key).toContain(`>${shown(t(key, 'pt-BR'))}<`);
    }
  });
});
