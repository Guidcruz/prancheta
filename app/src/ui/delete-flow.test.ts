import { describe, expect, it, vi } from 'vitest';
import type { CareerSummary } from '@lib/career';
import { latestClubSet } from '../data/club-sets.ts';
import { DeleteFlow } from './delete-flow';

/*
 * The delete in two steps (US-034, inicio.md): only the confirm of step 2 removes, cancelling at
 * any step removes nothing and gives the focus back to the career's "Mais ações", a failure keeps
 * step 2 open with the message, a second tap while deleting does nothing, and the career open in
 * the frame cannot be deleted from Carreiras e backup.
 */

const club = latestClubSet()!.clubs[0]!;
const career: CareerSummary = {
  id: '00000000-0000-4000-8000-000000000025',
  club,
  season: 1,
  round: 12,
  updatedAt: '2026-11-06T12:00:00.000Z',
  headSeq: 3,
  schemaVersion: 1,
};

function flow(result: { ok: boolean } = { ok: true }, protectedId?: string) {
  const remove = vi.fn<(careerId: string) => Promise<{ ok: boolean }>>(async () => result);
  return { remove, flow: new DeleteFlow(remove, () => protectedId) };
}

describe('delete with double confirmation (US-034)', () => {
  it('removes only after the second confirmation', async () => {
    const { remove, flow: f } = flow();
    expect(f.openActions(career)).toBe(true);
    expect(f.snapshot.stage).toBe('actions');
    // Confirming before step 2 does nothing.
    expect(await f.confirm()).toEqual({ kind: 'ignored' });
    f.chooseDelete();
    expect(f.snapshot.stage).toBe('step1');
    expect(await f.confirm()).toEqual({ kind: 'ignored' });
    expect(remove).not.toHaveBeenCalled();
    f.proceed();
    expect(f.snapshot).toMatchObject({ stage: 'step2', busy: false, failed: false });
    expect(remove).not.toHaveBeenCalled();
    expect(await f.confirm()).toEqual({ kind: 'deleted', career });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(career.id);
    expect(f.snapshot.stage).toBe('idle');
  });

  it.each(['actions', 'step1', 'step2'] as const)(
    'cancel at %s removes nothing and focuses the "Mais ações" button again',
    (stage) => {
      const { remove, flow: f } = flow();
      f.openActions(career);
      if (stage !== 'actions') f.chooseDelete();
      if (stage === 'step2') f.proceed();
      expect(f.snapshot.stage).toBe(stage);
      expect(f.cancel()).toEqual({ kind: 'actions', careerId: career.id });
      expect(f.snapshot.stage).toBe('idle');
      expect(remove).not.toHaveBeenCalled();
    },
  );

  it('a failure keeps step 2 open with the message, and nothing else changes', async () => {
    const { remove, flow: f } = flow({ ok: false });
    f.openActions(career);
    f.chooseDelete();
    f.proceed();
    expect(await f.confirm()).toEqual({ kind: 'failed' });
    expect(f.snapshot).toMatchObject({ stage: 'step2', busy: false, failed: true });
    // "Tentar de novo" is the same button.
    expect(await f.confirm()).toEqual({ kind: 'failed' });
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it('a service that throws counts as a failure, never a busy button forever', async () => {
    const f = new DeleteFlow(async () => {
      throw new Error('bug');
    });
    f.openActions(career);
    f.chooseDelete();
    f.proceed();
    expect(await f.confirm()).toEqual({ kind: 'failed' });
    expect(f.snapshot).toMatchObject({ busy: false, failed: true });
  });

  it('a second tap while deleting does nothing, and cancel waits for it', async () => {
    let finish: (value: { ok: boolean }) => void = () => undefined;
    const remove = vi.fn(() => new Promise<{ ok: boolean }>((resolve) => (finish = resolve)));
    const f = new DeleteFlow(remove);
    f.openActions(career);
    f.chooseDelete();
    f.proceed();
    const first = f.confirm();
    expect(f.snapshot).toMatchObject({ stage: 'step2', busy: true });
    expect(await f.confirm()).toEqual({ kind: 'ignored' });
    expect(f.cancel()).toBeUndefined();
    finish({ ok: true });
    expect(await first).toEqual({ kind: 'deleted', career });
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('one flow at a time', () => {
    const { flow: f } = flow();
    expect(f.openActions(career)).toBe(true);
    expect(f.openActions({ ...career, id: 'other' })).toBe(false);
    expect(f.snapshot).toMatchObject({ stage: 'actions', career });
  });

  it('the open career cannot be deleted from Carreiras e backup', async () => {
    const { remove, flow: f } = flow({ ok: true }, career.id);
    expect(f.canDelete(career)).toBe(false);
    f.openActions(career);
    f.chooseDelete();
    expect(f.snapshot.stage).toBe('actions');
    f.proceed();
    expect(await f.confirm()).toEqual({ kind: 'ignored' });
    expect(remove).not.toHaveBeenCalled();
    expect(f.cancel()).toEqual({ kind: 'actions', careerId: career.id });
  });
});
