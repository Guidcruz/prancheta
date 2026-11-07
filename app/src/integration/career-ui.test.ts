import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { get } from 'svelte/store';
import { CareerService, type FatalCode } from '@lib/career';
import { ErrorLog } from '@lib/errors';
import { t } from '@lib/i18n';
import type { Lang } from '@lib/config';
import { SAVE_FIELD_NAMES } from '@lib/save';
import { DB, onPut, store, useFreshDatabase } from '../lib/save/testing/idb.ts';
import { SAMPLE_CAREER_ID } from '../lib/save/testing/sample.ts';
import CareerFrame from '../ui/CareerFrame.svelte';
import FatalScreen from '../ui/screens/FatalScreen.svelte';

/*
 * QA of T-023: the states made by the real CareerService over fake-indexeddb, rendered by the real
 * components on the server. It lives outside ui/ and lib/ because ui/ cannot import lib/save (lint)
 * and lib/ cannot import ui/. The codes x languages matrix is in ui/states.test.ts; the journeys
 * and the privacy of the log are in lib/career/journey.test.ts.
 */

useFreshDatabase();

const LANGS: readonly Lang[] = ['pt-BR', 'es', 'en'];
const COACH = 'Zeca';
const noop = () => undefined;
const shown = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const codeLine = (code: string, lang: Lang) => t('error.code', lang, { code });

const frame = (
  career: CareerService['snapshot'],
  service: CareerService,
  log: ErrorLog,
  lang: Lang,
) => render(CareerFrame, { props: { career, service, log, lang, onhome: noop } }).body;
const fatal = (code: FatalCode, unsaved: boolean, lang: Lang) =>
  render(FatalScreen, { props: { code, unsaved, lang, onretry: noop, onhome: noop } }).body;

function made(): { service: CareerService; log: ErrorLog } {
  const s = store();
  const log = new ErrorLog({ appVersion: '0.0.1', schemaVersion: 1, engineVersion: 1 }, s, {
    fields: SAVE_FIELD_NAMES,
  });
  const service = new CareerService({
    store: s,
    log,
    appVersion: '0.0.1',
    newCareerId: () => SAMPLE_CAREER_ID,
    newSeed: () => 2026,
  });
  return { service, log };
}

const SETUP = {
  coachName: COACH,
  clubId: 'flamingo',
  realism: 'full',
  matchMode: 'result',
} as const;

describe('states of the real CareerService on screen', () => {
  it('two tabs: the second one gets the conflict screen, with the code, in every language', async () => {
    const a = made();
    await a.service.create(SETUP);
    const b = made();
    await b.service.open(SAMPLE_CAREER_ID);
    await a.service.playRound();
    await b.service.playRound();
    const state = get(b.service.state);
    expect(state.status).toBe('fatal');
    expect(state.fatal).toEqual({ code: 'conflict', unsaved: true });
    for (const lang of LANGS) {
      const body = fatal(state.fatal!.code, state.fatal!.unsaved, lang);
      expect(body).toContain(shown(codeLine('conflict', lang)));
      expect(body).toContain('error screen');
      expect(body).not.toContain(COACH);
      expect(body).not.toContain(SAMPLE_CAREER_ID);
    }
  });

  it('an unsaved round: the frame blocks the button with the reason; after the retry it is ready', async () => {
    const a = made();
    await a.service.create(SETUP);
    onPut('snapshots', () => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    await a.service.playRound();
    vi.restoreAllMocks();

    const blocked = frame(get(a.service.state), a.service, a.log, 'pt-BR');
    expect(blocked).toContain('play float blocked');
    expect(blocked).toContain(shown(t('play.blocked.unsaved', 'pt-BR')));
    expect(blocked).toContain(shown(t('save.quota-exceeded.title', 'pt-BR')));
    expect(blocked).toContain(shown(t('action.retry', 'pt-BR')));
    expect(blocked).not.toContain(COACH);

    await a.service.retrySave();
    const ready = frame(get(a.service.state), a.service, a.log, 'pt-BR');
    expect(ready).toContain('play float ready');
    expect(ready).not.toContain('class="banner');
  });

  it('a crash while playing: the area shows the unexpected error until "Tentar de novo"', async () => {
    const a = made();
    await a.service.create(SETUP);
    const broken = new CareerService({
      store: store(),
      log: a.log,
      appVersion: '0.0.1',
      params: {} as never,
    });
    await broken.open(SAMPLE_CAREER_ID);
    await broken.playRound();
    const crashed = frame(get(broken.state), broken, a.log, 'en');
    expect(crashed).toContain('error area');
    expect(crashed).toContain(shown(codeLine('unexpected', 'en')));
    broken.dismissCrash();
    expect(frame(get(broken.state), broken, a.log, 'en')).not.toContain('error area');
  });

  it('a newer build in another tab: opening gives the app-outdated full screen', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB, 9999);
      request.onupgradeneeded = () => request.result.createObjectStore('future');
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
    const a = made();
    await a.service.open(SAMPLE_CAREER_ID);
    const state = get(a.service.state);
    expect(state.fatal).toEqual({ code: 'app-outdated', unsaved: false });
    for (const lang of LANGS) {
      const body = fatal(state.fatal!.code, state.fatal!.unsaved, lang);
      expect(body).toContain(shown(codeLine('app-outdated', lang)));
      expect(body).not.toContain(shown(t('save.app-outdated.bodyUnsaved', lang)));
    }
  });
});
