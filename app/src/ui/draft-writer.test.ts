import { describe, expect, it } from 'vitest';
import { get, writable } from 'svelte/store';
import type { DraftSheet } from '@engine';
import type { CareerState } from '@lib/career';
import { createDraftWriter, type DraftTarget } from './draft-writer';

/*
 * The edits of the coach's sheet while a round is played (T-029; the review of T-075): the
 * service answers `busy` and keeps nothing, so the writer holds the edit, the screen shows it,
 * and it is sent once the career is free. Never lost in silence.
 */

const sheet = (formation: DraftSheet['lineup']['formation']): DraftSheet => ({
  lineup: {
    formation,
    starters: Array.from({ length: 11 }, () => null),
    bench: [],
    captains: [],
    penaltyTakers: [],
    freeKickTakers: [],
  },
  tactic: { posture: 'balanced', pressure: 'medium' },
});

function fake(start: Partial<CareerState> = {}) {
  const state = writable<CareerState>({
    status: 'open',
    save: { careerId: 'c1' } as CareerState['save'],
    busy: false,
    roundsLost: 0,
    missingSheetRounds: [],
    ...start,
  });
  const sent: DraftSheet[] = [];
  const target: DraftTarget = {
    state,
    async setDraft(draft) {
      const now = get(state);
      if (now.status !== 'open') return { ok: false, error: 'not-open' };
      if (now.busy) return { ok: false, error: 'busy' };
      sent.push(draft);
      return { ok: true };
    },
  };
  return { state, sent, target };
}

describe('createDraftWriter (T-029)', () => {
  it('a free career takes the edit at once; nothing is held', async () => {
    const { sent, target } = fake();
    const writer = createDraftWriter(target);
    await writer.write(sheet('4-3-3'));
    expect(sent).toEqual([sheet('4-3-3')]);
    expect(get(writer.held)).toBeUndefined();
  });

  it('while a round is played the edit is held and shown, then sent once, the last', async () => {
    const { state, sent, target } = fake({ busy: true });
    const writer = createDraftWriter(target);
    const first = writer.write(sheet('4-3-3'));
    await Promise.resolve();
    await Promise.resolve();
    expect(get(writer.held)).toEqual({ careerId: 'c1', sheet: sheet('4-3-3') });
    const second = writer.write(sheet('5-3-2'));
    expect(get(writer.held)?.sheet).toEqual(sheet('5-3-2'));
    expect(sent).toEqual([]);
    state.update((s) => ({ ...s, busy: false }));
    await Promise.all([first, second]);
    expect(sent).toEqual([sheet('5-3-2')]);
    expect(get(writer.held)).toBeUndefined();
  });

  it('the career closed while the edit was held: it goes with the career', async () => {
    const { state, sent, target } = fake({ busy: true });
    const writer = createDraftWriter(target);
    const pending = writer.write(sheet('4-3-3'));
    await Promise.resolve();
    state.set({ status: 'closed', busy: false, roundsLost: 0, missingSheetRounds: [] });
    await pending;
    expect(sent).toEqual([]);
    expect(get(writer.held)).toBeUndefined();
  });

  it('no career open: nothing is sent nor held', async () => {
    const { sent, target } = fake({ status: 'closed', save: undefined });
    const writer = createDraftWriter(target);
    await writer.write(sheet('4-3-3'));
    expect(sent).toEqual([]);
    expect(get(writer.held)).toBeUndefined();
  });
});
