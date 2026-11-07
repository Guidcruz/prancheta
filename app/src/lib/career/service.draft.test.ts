import { describe, expect, it, vi, type MockInstance } from 'vitest';
import { get } from 'svelte/store';
import {
  draftFromSheet,
  suggestSheet,
  type DraftSheet,
  type TeamSheet,
} from '../../engine/index.ts';
import { ErrorLog } from '../errors/index.ts';
import { loadGameParams } from '../params.ts';
import {
  SAVE_FIELD_NAMES,
  parseCareerSave,
  type CareerSave,
  type DraftWriteError,
  type SaveStore,
} from '../save/index.ts';
import { flipByte, raw, store, tamper, useFreshDatabase } from '../save/testing/idb.ts';
import { SAMPLE_CAREER_ID } from '../save/testing/sample.ts';
import { reconcileDraft } from './draft.ts';
import { CareerService, type CareerSetup } from './service.ts';

/*
 * The coach's sheet in the CareerService (ADR-0021, items 2 and 3; T-075), over the real SaveStore
 * and fake-indexeddb: `setDraft` reconciles, keeps the sheet in memory and writes only it between
 * rounds (`writeDraft`, with the guard); reloading the page gives the same sheet back; the sheet
 * sent to a round becomes the draft; every write gets a reconciled sheet; an unsaved round keeps
 * the sheet for "Tentar de novo"; another tab ends the career here.
 */

useFreshDatabase();

const VERSIONS = { appVersion: '0.0.1', schemaVersion: 2, engineVersion: 1 };
const SETUP: CareerSetup = {
  coachName: 'Zeca',
  clubId: 'flamingo',
  realism: 'full',
  matchMode: 'result',
};
const params = loadGameParams();

interface Harness {
  readonly service: CareerService;
  readonly store: SaveStore;
  readonly log: ErrorLog;
  readonly snapshots: MockInstance<SaveStore['writeSnapshot']>;
  readonly drafts: MockInstance<SaveStore['writeDraft']>;
}

function harness(): Harness {
  const s = store();
  const log = new ErrorLog(VERSIONS, s, { fields: SAVE_FIELD_NAMES });
  const snapshots = vi.spyOn(s, 'writeSnapshot');
  const drafts = vi.spyOn(s, 'writeDraft');
  const service = new CareerService({
    store: s,
    log,
    appVersion: '0.0.1',
    now: () => new Date('2026-11-06T12:00:00.000Z'),
    newCareerId: () => SAMPLE_CAREER_ID,
    newSeed: () => 2026,
  });
  return { service, store: s, log, snapshots, drafts };
}

async function created(): Promise<Harness> {
  const h = harness();
  const result = await h.service.create(SETUP);
  if (!result.ok) throw new Error(`create: ${result.error}`);
  return h;
}

/** The career in memory now. */
const saveOf = (h: Harness): CareerSave => get(h.service.state).save!;

/** The engine's suggestion for the coach's club, as the screen would start from. */
function suggestion(h: Harness): TeamSheet {
  const save = saveOf(h);
  return suggestSheet(save.game, params, save.career.clubId, undefined, { controller: 'human' });
}

/** The coach's edit: the suggestion with a free slot, two captains and another tactic. */
function edited(h: Harness): DraftSheet {
  const draft = draftFromSheet(suggestion(h));
  const starters = draft.lineup.starters.map((id, i) => (i === 2 ? null : id));
  return {
    lineup: { ...draft.lineup, starters, captains: [starters[9]!, starters[10]!] },
    tactic: { posture: 'attacking', pressure: 'high' },
  };
}

/** Another club's player: out of the coach's squad. */
function stranger(h: Harness): string {
  const { game, career } = saveOf(h);
  return Object.entries(game.squads).find(([id]) => id !== career.clubId)![1][0]!;
}

/** A new service on the same database, as after reloading the page. */
async function reloaded(): Promise<Harness> {
  const h = harness();
  const opened = await h.service.open(SAMPLE_CAREER_ID);
  if (!opened.ok) throw new Error(`open: ${opened.error}`);
  return h;
}

const fail = (error: DraftWriteError, detail?: unknown) =>
  Promise.resolve({ ok: false as const, error, ...(detail === undefined ? {} : { detail }) });

describe('CareerService.setDraft (ADR-0021)', () => {
  it('keeps the sheet in memory and writes only it, with the guard of the head', async () => {
    const h = await created();
    const draft = edited(h);
    expect(await h.service.setDraft(draft)).toEqual({ ok: true, value: undefined });
    expect(saveOf(h).career.draft).toEqual(draft);
    expect(h.snapshots).toHaveBeenCalledTimes(1); // only the creation
    expect(h.drafts).toHaveBeenCalledTimes(1);
    const [save, guard] = h.drafts.mock.calls[0]!;
    // The normal case: the snapshot in memory is the head.
    expect(guard).toEqual({ expectedHeadSeq: 1, snapshotSeq: 1 });
    expect(save.career.draft).toEqual(draft);
  });

  it('reloading the page gives the same sheet back (through the save layer, no screen)', async () => {
    const h = await created();
    const draft = edited(h);
    await h.service.setDraft(draft);
    const again = await reloaded();
    expect(saveOf(again).career.draft).toEqual(draft);
    expect(saveOf(again).game).toEqual(saveOf(h).game);
    // And again after a round played with no sheet: the draft stays as it was.
    const played = await again.service.playRound();
    expect(played).toMatchObject({ ok: true, value: { saved: true } });
    const third = await reloaded();
    expect(saveOf(third).career.draft).toEqual(draft);
    expect(saveOf(third).game.round).toBe(2);
  });

  it('reconciles before keeping and writing: out of the squad and repeated become free slots', async () => {
    const h = await created();
    const draft = edited(h);
    const other = stranger(h);
    const starters = [other, ...draft.lineup.starters.slice(1)];
    const bench = [draft.lineup.starters[3]!, ...draft.lineup.bench.slice(1)];
    await h.service.setDraft({
      ...draft,
      lineup: { ...draft.lineup, starters, bench, captains: [other, ...draft.lineup.captains] },
    });
    const kept = saveOf(h).career.draft!;
    expect(kept.lineup.starters[0]).toBeNull();
    expect(kept.lineup.bench[0]).toBeNull();
    expect(kept.lineup.captains).toEqual(draft.lineup.captains);
    expect(h.drafts.mock.calls[0]![0].career.draft).toEqual(kept);
    expect(saveOf(await reloaded()).career.draft).toEqual(kept);
  });

  it('after a fallback to an older version, the sheet survives reloads and the next round', async () => {
    const h = await created();
    await h.service.playRound();
    // The head N+1 = 2 is corrupted: the career opens on N = 1, with the head still 2.
    await tamper(2, flipByte);
    const back = await reloaded();
    expect(saveOf(back).game.round).toBe(1);
    const draft = edited(back);
    await back.service.setDraft(draft);
    const [, guard] = back.drafts.mock.calls[0]!;
    expect(guard).toEqual({ expectedHeadSeq: 2, snapshotSeq: 1 });
    expect(await back.drafts.mock.results[0]!.value).toEqual({ ok: true, value: { seq: 1 } });
    // Reloading again falls back to the same snapshot, and its sheet is the one written.
    const again = await reloaded();
    expect(saveOf(again).career.draft).toEqual(draft);
    // The next round is the snapshot N+2 = 3, without conflict, and the next sheet goes with it.
    expect(await again.service.playRound()).toMatchObject({ ok: true, value: { saved: true } });
    expect(await again.snapshots.mock.results[0]!.value).toMatchObject({
      ok: true,
      value: { seq: 3 },
    });
    await again.service.setDraft({ ...draft, tactic: { posture: 'defensive', pressure: 'low' } });
    expect(again.drafts.mock.calls.at(-1)![1]).toEqual({ expectedHeadSeq: 3, snapshotSeq: 3 });
    const db = await raw();
    expect((await db.get('careers', SAMPLE_CAREER_ID))?.draft?.seq).toBe(3);
    db.close();
    expect(saveOf(await reloaded()).career.draft?.tactic).toEqual({
      posture: 'defensive',
      pressure: 'low',
    });
  });

  it('writes the edits waiting once, the last', async () => {
    const h = await created();
    const base = edited(h);
    const postures = ['defensive', 'balanced', 'attacking', 'defensive'] as const;
    const all = postures.map((posture, i) =>
      h.service.setDraft({ ...base, tactic: { posture, pressure: i === 3 ? 'low' : 'medium' } }),
    );
    await Promise.all(all);
    // The first is written at once; the three after it wait, and only the last of them goes.
    expect(h.drafts).toHaveBeenCalledTimes(2);
    expect(h.drafts.mock.calls[1]![0].career.draft?.tactic).toEqual({
      posture: 'defensive',
      pressure: 'low',
    });
    expect(saveOf(await reloaded()).career.draft?.tactic).toEqual({
      posture: 'defensive',
      pressure: 'low',
    });
  });

  it('refuses before a career is open, and while a round is played', async () => {
    const h = harness();
    const sheet: DraftSheet = {
      lineup: {
        formation: '4-4-2',
        starters: Array.from({ length: 11 }, () => null),
        bench: [],
        captains: [],
        penaltyTakers: [],
        freeKickTakers: [],
      },
      tactic: { posture: 'balanced', pressure: 'medium' },
    };
    expect(await h.service.setDraft(sheet)).toEqual({ ok: false, error: 'not-open' });
    await h.service.create(SETUP);
    const playing = h.service.playRound();
    expect(await h.service.setDraft(sheet)).toEqual({ ok: false, error: 'busy' });
    await playing;
    expect(saveOf(h).career.draft).toBeUndefined();
    expect(h.drafts).not.toHaveBeenCalled();
  });

  it('with a round not stored, keeps the sheet in memory only, and "Tentar de novo" stores both', async () => {
    const h = await created();
    h.snapshots.mockImplementationOnce(() =>
      Promise.resolve({ ok: false, error: 'write-failed', detail: { name: 'AbortError' } }),
    );
    expect(await h.service.playRound()).toMatchObject({ ok: true, value: { saved: false } });
    const draft = edited(h);
    expect(await h.service.setDraft(draft)).toEqual({ ok: true, value: undefined });
    expect(h.drafts).not.toHaveBeenCalled();
    expect(saveOf(h).career.draft).toEqual(draft);
    expect(await h.service.retrySave()).toEqual({ ok: true, value: undefined });
    expect(h.snapshots.mock.calls.at(-1)![0].career.draft).toEqual(draft);
    const again = await reloaded();
    expect(saveOf(again).career.draft).toEqual(draft);
    expect(saveOf(again).game.round).toBe(2);
  });

  it('a failed write of the sheet is logged and the sheet stays for the next snapshot', async () => {
    const h = await created();
    h.drafts.mockImplementationOnce(() => fail('quota-exceeded', { name: 'QuotaExceededError' }));
    const draft = edited(h);
    expect(await h.service.setDraft(draft)).toEqual({ ok: true, value: undefined });
    expect(get(h.service.state)).toMatchObject({ status: 'open', busy: false });
    expect(get(h.service.state).unsaved).toBeUndefined();
    const entries = await h.log.list();
    expect(entries.at(-1)).toMatchObject({
      kind: 'storage',
      code: 'quota-exceeded',
      screen: 'career.draft',
    });
    expect(JSON.stringify(entries)).not.toContain(draft.lineup.starters[0]!);
    await h.service.playRound();
    expect(saveOf(await reloaded()).career.draft).toEqual(draft);
  });

  it('another tab wrote: the sheet is refused with conflict and the career ends on this tab', async () => {
    const one = await created();
    const two = await reloaded();
    expect(await one.service.playRound()).toMatchObject({ ok: true, value: { saved: true } });
    await two.service.setDraft(edited(two));
    expect(await two.drafts.mock.results[0]!.value).toMatchObject({
      ok: false,
      error: 'conflict',
    });
    expect(get(two.service.state)).toMatchObject({
      status: 'fatal',
      fatal: { code: 'conflict', unsaved: false },
    });
    expect((await two.log.list()).at(-1)).toMatchObject({
      kind: 'storage',
      code: 'conflict',
      screen: 'career.draft',
    });
    // The other tab's round stays, without this tab's sheet.
    expect(saveOf(await reloaded()).career.draft).toBeUndefined();
  });
});

describe('the sheet and the round (ADR-0021, item 2)', () => {
  it('a round played with a sheet keeps that sheet as the draft (draftFromSheet)', async () => {
    const h = await created();
    await h.service.setDraft(edited(h));
    const sheet = suggestion(h);
    expect(await h.service.playRound({ sheet })).toMatchObject({
      ok: true,
      value: { saved: true },
    });
    const expected = reconcileDraft(saveOf(h).game, SETUP.clubId, draftFromSheet(sheet));
    expect(saveOf(h).career.draft).toEqual(expected);
    expect(h.snapshots.mock.calls.at(-1)![0].career.draft).toEqual(expected);
    const again = await reloaded();
    expect(saveOf(again).career.draft).toEqual(expected);
    // The snapshot carries it; the career row has none (4.2).
    const db = await raw();
    expect(await db.get('careers', SAMPLE_CAREER_ID)).not.toHaveProperty('draft');
    db.close();
  });

  it('the sheet of a round is reconciled too: at most 3 names in each list', async () => {
    const h = await created();
    const sheet = suggestion(h);
    const long: TeamSheet = {
      ...sheet,
      lineup: { ...sheet.lineup, captains: sheet.lineup.starters.slice(0, 6) },
    };
    await h.service.playRound({ sheet: long });
    expect(saveOf(h).career.draft?.lineup.captains).toEqual(sheet.lineup.starters.slice(0, 3));
  });

  it('every write, of a snapshot or of the sheet, gets a reconciled sheet that passes the full schema', async () => {
    const h = await created();
    const draft = edited(h);
    const other = stranger(h);
    await h.service.setDraft({
      ...draft,
      lineup: { ...draft.lineup, bench: [other, ...draft.lineup.bench.slice(1)] },
    });
    await h.service.playRound();
    await h.service.setDraft({ ...draft, tactic: { posture: 'defensive', pressure: 'low' } });
    await h.service.playRound({ sheet: suggestion(h) });
    await h.service.setDraft({
      ...draft,
      lineup: {
        ...draft.lineup,
        penaltyTakers: [other, ...draft.lineup.starters.slice(4, 9).filter((id) => id !== null)],
      },
    });
    const saves = [
      ...h.snapshots.mock.calls.map(([save]) => save),
      ...h.drafts.mock.calls.map(([save]) => save),
    ];
    expect(h.drafts).toHaveBeenCalledTimes(3);
    expect(h.snapshots).toHaveBeenCalledTimes(3);
    for (const save of saves) {
      const sheet = save.career.draft;
      if (sheet !== undefined) {
        expect(reconcileDraft(save.game, save.career.clubId, sheet)).toEqual(sheet);
      }
      expect(parseCareerSave(JSON.parse(JSON.stringify(save))).ok).toBe(true);
    }
  });
});

describe('the row sheet when the career opens (ADR-0021, item 3)', () => {
  it('a sheet that does not pass is logged as draft-skipped, without content; the snapshot one is used', async () => {
    const h = await created();
    await h.service.setDraft(edited(h));
    const db = await raw();
    const row = await db.get('careers', SAMPLE_CAREER_ID);
    await db.put('careers', {
      ...row!,
      draft: { seq: 1, sheet: { ...row!.draft!.sheet, tactic: { posture: 'allOut' } } },
    } as never);
    db.close();
    const again = await reloaded();
    expect(saveOf(again).career.draft).toBeUndefined();
    const entries = await again.log.list();
    expect(entries.at(-1)).toMatchObject({
      kind: 'storage',
      code: 'draft-skipped',
      screen: 'career.open',
    });
    expect(JSON.stringify(entries)).not.toContain('allOut');
  });

  it('a stale sheet (of another snapshot) is not an error', async () => {
    const h = await created();
    await h.service.setDraft(edited(h));
    const db = await raw();
    const row = await db.get('careers', SAMPLE_CAREER_ID);
    await db.put('careers', { ...row!, draft: { ...row!.draft!, seq: 9 } });
    db.close();
    const again = await reloaded();
    expect(saveOf(again).career.draft).toBeUndefined();
    expect((await again.log.list()).some((e) => e.code === 'draft-skipped')).toBe(false);
  });
});
