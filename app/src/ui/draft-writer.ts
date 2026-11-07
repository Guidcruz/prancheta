import { get, writable, type Readable } from 'svelte/store';
import type { DraftSheet } from '@engine';
import type { CareerState } from '@lib/career';

/*
 * The edits of the coach's sheet on their way to the CareerService (ADR-0021; T-029). The screens
 * have no "Salvar": every swap calls `write`. While a round is played or written the service
 * answers `busy` and keeps nothing, so the edit is held here, shown by the screen as the sheet,
 * and sent again as soon as the career is free (only the last one held). It is never lost in
 * silence: it is either in the service's memory or held here. When the career closes (or ends
 * on this tab), the edit held goes with it.
 */

/** What the writer needs of the CareerService. */
export interface DraftTarget {
  readonly state: Readable<CareerState>;
  setDraft(
    draft: DraftSheet,
  ): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: 'not-open' | 'busy' }>;
}

export interface DraftWriter {
  /** The edit waiting for the career to be free, if any: the sheet the screen shows. */
  readonly held: Readable<{ readonly careerId: string; readonly sheet: DraftSheet } | undefined>;
  /** Sends an edit; resolves when the service took it (or dropped it with the career). */
  write(sheet: DraftSheet): Promise<void>;
}

export function createDraftWriter(target: DraftTarget): DraftWriter {
  const held = writable<{ careerId: string; sheet: DraftSheet } | undefined>(undefined);
  let waiting: Promise<void> | undefined;

  const careerIdOf = (state: CareerState) => state.save?.careerId;

  /** Resolves once the career is not busy any more (or not open). */
  function free(): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const unsubscribe = target.state.subscribe((state) => {
        if (done || (state.status === 'open' && state.busy)) return;
        done = true;
        // The first call may run inside `subscribe`, before `unsubscribe` exists.
        queueMicrotask(() => unsubscribe());
        resolve();
      });
    });
  }

  async function flush(): Promise<void> {
    for (;;) {
      const next = get(held);
      if (next === undefined) return;
      const state = get(target.state);
      if (state.status !== 'open' || careerIdOf(state) !== next.careerId) {
        // The career closed or changed: the edit goes with it.
        held.set(undefined);
        return;
      }
      if (state.busy) {
        await free();
        continue;
      }
      held.set(undefined);
      const sent = await target.setDraft(next.sheet);
      if (!sent.ok && sent.error === 'busy' && get(held) === undefined) {
        held.set(next);
      }
    }
  }

  return {
    held,
    async write(sheet) {
      const state = get(target.state);
      const careerId = careerIdOf(state);
      if (careerId === undefined) return;
      if (waiting === undefined) {
        const sent = await target.setDraft(sheet);
        if (sent.ok || sent.error !== 'busy') return;
      }
      held.set({ careerId, sheet });
      waiting ??= flush().finally(() => (waiting = undefined));
      await waiting;
    },
  };
}
