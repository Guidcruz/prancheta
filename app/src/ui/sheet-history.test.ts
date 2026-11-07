import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CareerSummary } from '@lib/career';
import { latestClubSet } from '../data/club-sets.ts';
import { DeleteFlow } from './delete-flow';
import { FakeHistory } from './testing/fake-history';
import { popSheet, pushSheet, sheetOnTop } from './sheet-history';

/*
 * The sheets in the history (inicio.md): one entry for the whole delete flow, so the back gesture
 * from any step ends it without deleting; a sheet closed by a button takes its entry away.
 * The listener is the one of Home.svelte and Saves.svelte.
 */

const SHEET = 'career-actions';
const career = {
  id: '00000000-0000-4000-8000-000000000026',
  club: latestClubSet()!.clubs[0]!,
  season: 1,
  round: 3,
  updatedAt: '2026-11-07T10:00:00.000Z',
  headSeq: 1,
  schemaVersion: 1,
} as CareerSummary;

function setup() {
  const history = new FakeHistory('/jogo/#/new');
  vi.stubGlobal('history', history);
  let t = 0;
  const remove = vi.fn(async () => ({ ok: true }));
  const flow = new DeleteFlow(remove, { now: () => (t += 1000) });
  // The popstate listener of the screens.
  history.onPop(() => {
    if (flow.open && !sheetOnTop(SHEET)) flow.cancel();
  });
  const open = () => {
    if (flow.openActions(career)) pushSheet(SHEET);
  };
  return { history, flow, remove, open };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sheets in the history', () => {
  it('the whole delete flow is one entry, on the same address, keeping the state below', () => {
    const { history, flow, open } = setup();
    history.replaceState({ newGame: true }, '');
    open();
    flow.chooseDelete();
    flow.proceed();
    expect(flow.snapshot.stage).toBe('step2');
    expect(history.length).toBe(2);
    expect(history.url).toBe('/jogo/#/new');
    expect(history.state).toEqual({ newGame: true, sheet: SHEET });
    expect(sheetOnTop(SHEET)).toBe(true);
  });

  it.each([0, 1, 2])('back after %i steps ends the flow without deleting', (steps) => {
    const { history, flow, remove, open } = setup();
    open();
    if (steps >= 1) flow.chooseDelete();
    if (steps >= 2) flow.proceed();
    history.back();
    expect(flow.snapshot.stage).toBe('idle');
    expect(history.length).toBe(1);
    expect(remove).not.toHaveBeenCalled();
  });

  it('a sheet closed by a button takes its entry away; twice does nothing more', () => {
    const { history, flow, open } = setup();
    open();
    flow.cancel();
    popSheet(SHEET);
    expect(history.length).toBe(1);
    popSheet(SHEET);
    expect(history.length).toBe(1);
  });

  it('another sheet on top is not taken away', () => {
    const { history } = setup();
    pushSheet('new-game-options');
    expect(sheetOnTop(SHEET)).toBe(false);
    popSheet(SHEET);
    expect(history.length).toBe(2);
  });

  it('without a history (server rendering) no sheet is on top', () => {
    vi.stubGlobal('history', undefined);
    expect(sheetOnTop(SHEET)).toBe(false);
  });
});
