import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { CareerSave, CareerService, CareerState } from '@lib/career';
import type { ErrorLog } from '@lib/errors';
import { t } from '@lib/i18n';
import { latestClubSet } from '../data/club-sets.ts';
import { testCareer } from './testing/game';
import CareerFrame from './CareerFrame.svelte';
import FatalScreen from './screens/FatalScreen.svelte';
import Banner from './components/Banner.svelte';

/*
 * The frame and the full-screen errors rendered on the server (no DOM in the tests): what the
 * player sees for each state of the CareerService. Navigation by touch, the "Mais" sheet and the
 * focus are for the E2E of T-024.
 */

const club = latestClubSet()!.clubs[0]!;
/** What the frame and the Clube tab read of a save: a real career on round 5. */
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
const service = {} as CareerService;
const log = {} as ErrorLog;

function frame(career: CareerState): string {
  return render(CareerFrame, {
    props: { career, service, log, lang: 'pt-BR', onhome: () => undefined },
  }).body;
}

const text = (key: string, vars?: Record<string, string | number>) => t(key, 'pt-BR', vars);
const escaped = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

describe('the career frame (US-015)', () => {
  it('shows the four tabs, in the bottom bar and in the sidebar, with Clube current', () => {
    const body = frame(OPEN);
    for (const key of ['nav.tab.club', 'nav.tab.squad', 'nav.tab.table', 'nav.tab.calendar']) {
      expect(body.split(text(key)).length - 1, key).toBeGreaterThanOrEqual(2);
    }
    expect(body).toContain('href="#/club" aria-current="page"');
    expect(body).not.toContain('href="#/squad" aria-current="page"');
    // The sidebar also lists the other destinations and the club.
    expect(body).toContain(text('nav.saves'));
    expect(body).toContain(escaped(club.name));
    expect(body).toContain(text('play.label'));
    expect(body).toContain(text('career.progress', { season: 2026, round: 5 }));
  });

  it('an unsaved round blocks "Jogar rodada" with the reason, and shows the banner', () => {
    const body = frame({ ...OPEN, unsaved: 'quota-exceeded' });
    expect(body).toContain('play float blocked');
    expect(body).toContain(text('play.blocked.unsaved'));
    // One live region, the band: the banner inside it has no role of its own.
    expect(body).toMatch(/class="band[^"]*" role="status"/);
    expect(body).not.toContain('role="alert"');
    expect(body).toMatch(/<section class="banner danger[^"]*">/);
    expect(body).toContain(escaped(text('save.quota-exceeded.title')));
    expect(body).toContain(text('action.retry'));
    // "Liberar espaço" opens Carreiras e backup inside the frame (T-025, saves.md).
    expect(body).toContain(text('action.free'));
    expect(body.indexOf(text('action.retry'))).toBeLessThan(body.indexOf(text('action.free')));
  });

  it('only the no-room banner offers "Liberar espaço"', () => {
    for (const unsaved of ['write-failed', 'verify-failed', 'too-large'] as const) {
      expect(frame({ ...OPEN, unsaved }), unsaved).not.toContain(text('action.free'));
    }
  });

  it('a saved round has no banner and the button is ready', () => {
    const body = frame(OPEN);
    expect(body).toContain('play float ready');
    expect(body).not.toContain('class="banner');
  });

  it('busy while the round is computed', () => {
    expect(frame({ ...OPEN, busy: true })).toContain('aria-busy="true"');
  });

  it('the rounds lost on opening are a warning with "Entendi"', () => {
    const body = frame({ ...OPEN, roundsLost: 2 });
    expect(body).toContain('banner warning');
    expect(body).toContain(text('save.roundsLost.body.other', { count: 2 }));
    expect(body).toContain(text('save.roundsLost.action.ok'));
  });

  it('an invalid save takes the content area as an unexpected error, with its code', () => {
    const body = frame({ ...OPEN, unsaved: 'invalid-save' });
    expect(body).toContain('error area');
    expect(body).toContain(text('error.code', { code: 'invalid-save' }));
    expect(body).not.toContain('class="banner');
  });

  it('a crash while playing takes the content area as an unexpected error', () => {
    const body = frame({ ...OPEN, crash: 'unexpected' });
    expect(body).toContain('error area');
    expect(body).toContain(text('error.code', { code: 'unexpected' }));
    expect(body).toContain(text('action.retry'));
    expect(body).toContain(text('action.home'));
  });

  it('a banner outside the band announces itself, with the same look', () => {
    const banner = (announce: boolean) =>
      render(Banner, { props: { tone: 'danger', title: 'T', message: 'M', announce } }).body;
    expect(banner(true)).toContain('role="alert"');
    expect(banner(false)).not.toContain('role=');
    expect(banner(false).replace(/ role="alert"/, '')).toBe(
      banner(true).replace(/ role="alert"/, ''),
    );
  });

  it('the notice band is a live region mounted even without notices', () => {
    expect(frame(OPEN)).toContain('class="band');
    expect(frame(OPEN)).toMatch(/class="band[^"]*" role="status"/);
  });

  it('season over: the button stays, blocked with the reason', () => {
    const over = { ...save, game: testCareer('full', 39) } as CareerSave;
    const body = frame({ ...OPEN, save: over });
    expect(body).toContain(text('play.blocked.seasonOver'));
    expect(body).toContain(text('career.seasonOver', { season: 2026 }));
  });
});

describe('full-screen save errors (CEO decisions 2 and 3)', () => {
  const screen = (code: 'conflict' | 'app-outdated' | 'all-corrupt', unsaved: boolean) =>
    render(FatalScreen, {
      props: { code, unsaved, lang: 'pt-BR', onretry: () => undefined, onhome: () => undefined },
    }).body;

  it('conflict: no tabs, the code, "Recarregar o jogo" first', () => {
    const body = screen('conflict', true);
    expect(body).toMatch(/^(<!--[^>]*-->)*<main/);
    expect(body).toContain('error screen');
    expect(body).toContain(text('error.code', { code: 'conflict' }));
    expect(body).not.toContain('aria-current');
    expect(body.indexOf(text('action.reload'))).toBeLessThan(body.indexOf(text('action.home')));
  });

  it('app-outdated after a write says the round of this tab was not saved', () => {
    expect(screen('app-outdated', true)).toContain(escaped(text('save.app-outdated.bodyUnsaved')));
    expect(screen('app-outdated', false)).not.toContain(
      escaped(text('save.app-outdated.bodyUnsaved')),
    );
  });

  it('all-corrupt offers to go home (the import comes with T-020)', () => {
    const body = screen('all-corrupt', false);
    expect(body).toContain(text('error.code', { code: 'all-corrupt' }));
    expect(body).toContain(text('action.home'));
  });
});
