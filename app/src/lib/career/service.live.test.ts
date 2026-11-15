import { describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  MATCH_MODES,
  playRound as playEngineRound,
  type GameParams,
  type GameState,
  type MatchMode,
  type TeamSheet,
} from '../../engine/index.ts';
import { ErrorLog } from '../errors/index.ts';
import { SAVE_FIELD_NAMES, type SaveStore, type WriteError } from '../save/index.ts';
import { snapshotSeqs, store, useFreshDatabase } from '../save/testing/idb.ts';
import { SAMPLE_CAREER_ID } from '../save/testing/sample.ts';
import { CareerService, type PlayInput } from './service.ts';

/*
 * The live match through the career layer (T-032; docs/02-architecture.md, 4.1, "Partida assistida
 * pela camada de carreira", items 1 and 2): `liveMatch` gives the coach's match exactly as the
 * `playRound` that ends it records it, for every mode, with and without a sheet, in round 1 and
 * later; it writes nothing and changes nothing in memory; it refuses as `playRound` does; and the
 * mode chosen at "Jogar rodada" goes into the round's snapshot.
 */

useFreshDatabase();

const VERSIONS = { appVersion: '0.0.1', schemaVersion: 3, engineVersion: 1 };
const CLUB = 'flamingo';

interface Harness {
  readonly service: CareerService;
  readonly store: SaveStore;
  readonly log: ErrorLog;
}

function harness(options: { params?: GameParams } = {}): Harness {
  const s = store();
  const log = new ErrorLog(VERSIONS, s, { fields: SAVE_FIELD_NAMES });
  const service = new CareerService({
    store: s,
    log,
    appVersion: '0.0.1',
    now: () => new Date('2026-11-15T12:00:00.000Z'),
    newCareerId: () => SAMPLE_CAREER_ID,
    newSeed: () => 2026,
    ...(options.params === undefined ? {} : { params: options.params }),
  });
  return { service, store: s, log };
}

async function created(matchMode: MatchMode = 'highlights', h = harness()): Promise<Harness> {
  const result = await h.service.create({
    coachName: 'Zeca',
    clubId: CLUB,
    realism: 'full',
    matchMode,
  });
  if (!result.ok) throw new Error(`create: ${result.error}`);
  return h;
}

/** The coach's suggested sheet with another tactic: a sheet the engine would not pick itself. */
function changedSheet(service: CareerService): TeamSheet {
  const plan = service.prepareRound();
  if (plan === undefined || !plan.ok) throw new Error('no plan');
  const sheet = plan.value.suggested[CLUB]!;
  return { ...sheet, tactic: { posture: 'attacking', pressure: 'high' } };
}

describe('liveMatch is the match playRound records (item 1)', () => {
  const cases = MATCH_MODES.flatMap((mode) =>
    [false, true].flatMap((withSheet) =>
      [1, 4].map((round) => [mode, withSheet, round] as [MatchMode, boolean, number]),
    ),
  );

  it.each(cases)('mode %s, sheet %s, round %i', async (mode, withSheet, round) => {
    const { service } = await created(mode);
    for (let r = 1; r < round; r++) {
      const played = await service.playRound();
      if (!played.ok) throw new Error(played.error);
    }
    const input: PlayInput = withSheet ? { sheet: changedSheet(service) } : {};
    const live = service.liveMatch(input);
    if (!live.ok) throw new Error(live.error);
    const { fixtureId, side, match, result } = live.value;
    expect(result.fixtureId).toBe(fixtureId);
    expect(match.fixtureId).toBe(fixtureId);
    expect(match[side].clubId).toBe(CLUB);
    if (withSheet)
      expect(match[side].sheet.tactic).toEqual({ posture: 'attacking', pressure: 'high' });

    const played = await service.playRound(input);
    if (!played.ok) throw new Error(played.error);
    const recorded = played.value.report.results.find((r) => r.fixtureId === fixtureId);
    expect(recorded).toEqual(result);
    // The score shown is the one stored in the fixture.
    const fixture = service.snapshot.save!.game.fixtures.find((f) => f.id === fixtureId)!;
    expect(fixture.result!.score).toEqual(result.score);
  });

  it('the three modes give the same match (the assistant commands the club until T-033)', async () => {
    const { service } = await created('result');
    const results = [];
    for (const matchMode of MATCH_MODES) {
      const live = service.liveMatch({ matchMode });
      if (!live.ok) throw new Error(live.error);
      results.push(live.value.result);
    }
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });

  it('writes nothing, keeps the same save in memory, publishes nothing and gives the same twice', async () => {
    const h = await created();
    const before = h.service.snapshot;
    const write = vi.spyOn(h.store, 'writeSnapshot');
    const draft = vi.spyOn(h.store, 'writeDraft');
    const seen = vi.fn();
    const stop = h.service.state.subscribe(seen);
    seen.mockClear();
    const first = h.service.liveMatch();
    const second = h.service.liveMatch();
    stop();
    expect(first.ok && second.ok).toBe(true);
    expect(second).toEqual(first);
    expect(h.service.snapshot).toBe(before);
    expect(h.service.snapshot.save).toBe(before.save);
    expect(seen).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(draft).not.toHaveBeenCalled();
    expect(await snapshotSeqs()).toEqual([1]);
  });
});

describe('liveMatch refuses as playRound does before playing', () => {
  it('not-open without a career', () => {
    expect(harness().service.liveMatch()).toEqual({ ok: false, error: 'not-open' });
  });

  it('busy while a round is played and written', async () => {
    const { service } = await created();
    const playing = service.playRound();
    expect(service.liveMatch()).toEqual({ ok: false, error: 'busy' });
    await playing;
    expect(service.liveMatch().ok).toBe(true);
  });

  it('unsaved while the last round waits for "Tentar de novo"', async () => {
    const h = await created();
    vi.spyOn(h.store, 'writeSnapshot').mockResolvedValueOnce({
      ok: false,
      error: 'quota-exceeded' as WriteError,
    });
    await h.service.playRound();
    expect(h.service.liveMatch()).toEqual({ ok: false, error: 'unsaved' });
  });

  it('season-over after round 38', async () => {
    const h = await created();
    const save = h.service.snapshot.save!;
    let game: GameState = save.game;
    while (game.round <= 38) {
      const played = playEngineRound(game, h.service.params, {
        round: game.round,
        sheets: {},
        commands: {},
        fanDecisions: {},
        coaches: { [CLUB]: 'result' },
      });
      if (!played.ok) throw new Error(played.error);
      game = played.value.state;
    }
    const written = await h.store.writeSnapshot({ ...save, game }, undefined, {
      expectedHeadSeq: 1,
    });
    expect(written.ok).toBe(true);
    await h.service.open(SAMPLE_CAREER_ID);
    expect(h.service.liveMatch()).toEqual({ ok: false, error: 'season-over' });
  });

  it('unexpected after a crash, until "Tentar de novo"', async () => {
    const h = await created();
    const broken = new CareerService({
      store: h.store,
      log: h.log,
      appVersion: '0.0.1',
      params: {} as GameParams,
    });
    await broken.open(SAMPLE_CAREER_ID);
    expect(await broken.playRound()).toEqual({ ok: false, error: 'unexpected' });
    expect(broken.liveMatch()).toEqual({ ok: false, error: 'unexpected' });
  });

  it('an exception of the engine is unexpected, logged as career.live, with no crash', async () => {
    const h = await created();
    const broken = new CareerService({
      store: h.store,
      log: h.log,
      appVersion: '0.0.1',
      params: {} as GameParams,
    });
    await broken.open(SAMPLE_CAREER_ID);
    expect(broken.liveMatch()).toEqual({ ok: false, error: 'unexpected' });
    expect(get(broken.state)).toMatchObject({ status: 'open', busy: false });
    expect(get(broken.state).crash).toBeUndefined();
    await vi.waitFor(async () =>
      expect((await h.log.list()).at(-1)).toMatchObject({
        kind: 'programming',
        code: 'unexpected',
        screen: 'career.live',
      }),
    );
  });

  it('a mode outside MATCH_MODES is a bug: unexpected, logged, nothing played', async () => {
    const h = await created();
    const odd = { matchMode: 'replay' as MatchMode };
    expect(h.service.liveMatch(odd)).toEqual({ ok: false, error: 'unexpected' });
    expect(await h.service.playRound(odd)).toEqual({ ok: false, error: 'unexpected' });
    expect(h.service.snapshot.save!.game.round).toBe(1);
    expect(h.service.snapshot.busy).toBe(false);
    await vi.waitFor(async () => {
      const codes = (await h.log.list()).map((e) => [e.kind, e.code, e.screen]);
      expect(codes).toContainEqual(['programming', 'unknown-match-mode', 'career.live']);
      expect(codes).toContainEqual(['programming', 'unknown-match-mode', 'career.play']);
    });
  });
});

describe('the mode chosen at "Jogar rodada" goes with the round (item 2)', () => {
  it("a career in 'highlights' played with 'result' stores 'result' in the round's snapshot", async () => {
    const h = await created('highlights');
    const write = vi.spyOn(h.store, 'writeSnapshot');
    const played = await h.service.playRound({ matchMode: 'result' });
    expect(played).toMatchObject({ ok: true, value: { saved: true } });
    expect(write.mock.calls.at(-1)![0].career.matchMode).toBe('result');
    expect(h.service.snapshot.save!.career.matchMode).toBe('result');
    // Reopened from the device: the next rounds use it.
    await h.service.open(SAMPLE_CAREER_ID);
    expect(h.service.snapshot.save!.career.matchMode).toBe('result');
  });

  it('without a mode in the input, the save keeps its own', async () => {
    const h = await created('highlights');
    await h.service.playRound();
    expect(h.service.snapshot.save!.career.matchMode).toBe('highlights');
  });

  it('a refused write keeps the new mode in memory, and "Tentar de novo" stores it', async () => {
    const h = await created('result');
    const write = vi.spyOn(h.store, 'writeSnapshot');
    write.mockResolvedValueOnce({ ok: false, error: 'quota-exceeded' as WriteError });
    const played = await h.service.playRound({ matchMode: 'highlights' });
    expect(played).toMatchObject({ ok: true, value: { saved: false } });
    expect(h.service.snapshot.save!.career.matchMode).toBe('highlights');
    expect(await h.service.retrySave()).toEqual({ ok: true, value: undefined });
    expect(write.mock.calls.at(-1)![0].career.matchMode).toBe('highlights');
  });

  it('a round not applied loses the mode with it (closing the game after the live match)', async () => {
    const h = await created('result');
    expect(h.service.liveMatch({ matchMode: 'highlights' }).ok).toBe(true);
    await h.service.open(SAMPLE_CAREER_ID);
    expect(h.service.snapshot.save!.career.matchMode).toBe('result');
    expect(h.service.snapshot.save!.game.round).toBe(1);
  });
});
