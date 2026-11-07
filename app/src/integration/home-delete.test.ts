import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { CareerService, LAST_SETUP_KEY, type CareerSetup } from '@lib/career';
import { ErrorLog } from '@lib/errors';
import { SAVE_FIELD_NAMES } from '@lib/save';
import { onPut, snapshotSeqs, store, useFreshDatabase } from '../lib/save/testing/idb.ts';
import { careerIdOf } from '../lib/save/testing/sample.ts';
import { DeleteFlow } from '../ui/delete-flow';
import HomeView from '../ui/screens/HomeView.svelte';

/*
 * QA of T-025 with the real CareerService over fake-indexeddb (it lives outside ui/ because ui/
 * cannot import lib/save): the delete in two steps removes the career and its snapshots only after
 * the second confirmation, cancelling removes nothing, the home screen lists what is left without
 * the nickname, and a new career that does not fit is not created at all.
 */

useFreshDatabase();

const COACH = 'Professor Zeca';
const noop = () => undefined;
const A = careerIdOf('home-a');
const B = careerIdOf('home-b');

function made(ids: string[] = []) {
  const s = store();
  const log = new ErrorLog({ appVersion: '0.0.1', schemaVersion: 1, engineVersion: 1 }, s, {
    fields: SAVE_FIELD_NAMES,
  });
  const queue = [...ids];
  const service = new CareerService({
    store: s,
    log,
    appVersion: '0.0.1',
    newCareerId: () => queue.shift(),
    newSeed: () => 2026,
  });
  return { service, store: s };
}

const setup = (clubId: string): CareerSetup => ({
  coachName: COACH,
  clubId,
  realism: 'full',
  matchMode: 'result',
});

async function twoCareers(): Promise<CareerService> {
  const { service } = made([A, B]);
  expect((await service.create(setup('flamingo'))).ok).toBe(true);
  service.close();
  expect((await service.create(setup('corinto'))).ok).toBe(true);
  service.close();
  return service;
}

const ids = async (service: CareerService) => {
  const listed = await service.list();
  return listed.ok ? listed.value.map((c) => c.id) : [];
};

describe('delete on the home screen with the real service (US-034)', () => {
  it('cancelling at any step removes nothing', async () => {
    const service = await twoCareers();
    const listed = await service.list();
    const target = listed.ok ? listed.value.find((c) => c.id === A)! : undefined;
    const flow = new DeleteFlow((id) => service.remove(id));
    for (const steps of [0, 1, 2]) {
      flow.openActions(target!);
      if (steps >= 1) flow.chooseDelete();
      if (steps >= 2) flow.proceed();
      flow.cancel();
    }
    expect((await ids(service)).sort()).toEqual([A, B].sort());
    expect(await snapshotSeqs(A)).not.toEqual([]);
  });

  it('the second confirmation removes the career and its three copies; the list shows the rest', async () => {
    const service = await twoCareers();
    const listed = await service.list();
    const target = listed.ok ? listed.value.find((c) => c.id === A)! : undefined;
    const flow = new DeleteFlow((id) => service.remove(id));
    flow.openActions(target!);
    flow.chooseDelete();
    flow.proceed();
    expect(await flow.confirm()).toMatchObject({ kind: 'deleted' });
    expect(await ids(service)).toEqual([B]);
    expect(await snapshotSeqs(A)).toEqual([]);
    expect(await snapshotSeqs(B)).not.toEqual([]);

    const left = await service.list();
    const body = render(HomeView, {
      props: {
        lang: 'pt-BR',
        now: new Date(),
        careers: left.ok ? left.value : [],
        onopen: noop,
        onupdate: noop,
        onnew: noop,
        onretry: noop,
        onactions: noop,
      },
    }).body;
    expect(body).toContain('Corinto');
    expect(body).not.toContain(`data-career="${A}"`);
    // The nickname never reaches the home screen.
    expect(body).not.toContain(COACH);
  });

  it('a failed delete keeps the career and says so in step 2', async () => {
    const service = await twoCareers();
    const listed = await service.list();
    const target = listed.ok ? listed.value[0]! : undefined;
    const flow = new DeleteFlow(async () => ({ ok: false }));
    flow.openActions(target!);
    flow.chooseDelete();
    flow.proceed();
    expect(await flow.confirm()).toEqual({ kind: 'failed' });
    expect(flow.snapshot).toMatchObject({ stage: 'step2', failed: true });
    expect(await ids(service)).toHaveLength(2);
  });
});

describe('a new career that does not fit (novo-jogo.md, "Sem espaço")', () => {
  it('quota-exceeded: nothing is created and the last setup is not written', async () => {
    const { service, store: s } = made([A]);
    onPut('snapshots', () => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(await service.create(setup('flamingo'))).toMatchObject({
      ok: false,
      error: 'quota-exceeded',
    });
    vi.restoreAllMocks();
    expect(service.snapshot.status).toBe('closed');
    expect(await ids(service)).toEqual([]);
    expect(await s.readKv(LAST_SETUP_KEY)).toEqual({ ok: true, value: undefined });
  });
});
