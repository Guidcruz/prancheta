import { writable, type Readable } from 'svelte/store';
import { CLUB_SETS, latestClubSet, type ClubSet } from '../../data/club-sets.ts';
import {
  SEASON_ROUNDS,
  draftFromSheet,
  matchSheet,
  playRound as playEngineRound,
  prepareRound as prepareEngineRound,
  roundRecap,
  type ClubDef,
  type ClubId,
  type DraftSheet,
  type FixtureId,
  type GameParams,
  type GameState,
  type IdentitySource,
  type MatchCommand,
  type MatchMode,
  type MatchSheet,
  type Result,
  type RoundPlan,
  type RoundReport,
  type TeamSheet,
  validateClubs,
} from '../../engine/index.ts';
import type { ErrorLog } from '../errors/index.ts';
import { gameIdentitySource } from '../generators/identity.ts';
import { loadGameParams } from '../params.ts';
import {
  SAVE_SCHEMA_VERSION,
  codecSupported,
  newCareerGame,
  type CareerSave,
  type CareerSummary,
  type DraftWriteError,
  type OpenError,
  type SaveResult,
  type SaveStore,
  type SheetIndex,
  type SkippedSnapshot,
  type StorageError,
  type WriteError,
  type WrittenSnapshot,
} from '../save/index.ts';
import { checkCoachName, type CoachNameProblem } from './coach-name.ts';
import { reconcileDraft } from './draft.ts';
import { LAST_SETUP_KEY, parseLastSetup, type LastSetup, type NewGameClub } from './new-game.ts';
import { paramsHash } from './params-hash.ts';

/*
 * The career, application layer (docs/02-architecture.md, 3, "Carreira"; 4.1 and 4.2). The only
 * code that writes a career: it joins the engine and the save, keeps the open `CareerSave` in
 * memory and gives the interface a read-only Svelte store of it. The screens never touch lib/save.
 *
 * Writes (4.2, contract of the `SaveStore`):
 * - every `writeSnapshot` carries the guard `{ expectedHeadSeq }`: 0 for a new career, then the
 *   `headSeq` the career opened with and the `seq` of each write. Another tab that wrote in the
 *   meantime makes the store refuse with `conflict`, and nothing changes;
 * - the `base` (`OpenedCareer.sheets`, then `WrittenSnapshot.sheets`) is kept and handed back as
 *   an opaque value: this file never reads inside it;
 * - a write that fails keeps the new state in memory and blocks the next round until it is
 *   stored ("rodada anterior não salva", CEO decision 1 of erros-e-avisos.md); "Tentar de novo"
 *   repeats the same write. `conflict`, `app-outdated`, `save-too-new` and `unsupported-browser`
 *   end the career on this tab instead (full screen, decision 3);
 * - the coach's sheet being edited (`career.draft`, ADR-0021) is reconciled with the squad
 *   (`reconcileDraft`) before every write, at one point: `persist` for a snapshot and `setDraft`
 *   for the sheet alone. Between rounds `setDraft` writes only the sheet (`writeDraft`, about
 *   1 KB, with the same guard); only the last of the edits waiting is written. A round played
 *   with a sheet keeps that sheet as the draft (`draftFromSheet`); the changes made during the
 *   match never reach it.
 *
 * Errors go to the local log (lib/errors) with their code and the store's flat diagnostics, and a
 * snapshot of the current format skipped by `invalid-save` when opening goes there as a
 * programming error, with only the path and the kind of the problem (4.2, "Níveis de conferência
 * do esquema", condition 2). Nothing here throws for a game or storage situation.
 */

/** The errors after which this tab cannot go on with the career (full screen). */
export type FatalCode =
  | 'conflict'
  | 'app-outdated'
  | 'save-too-new'
  | 'unsupported-browser'
  | 'all-corrupt'
  | 'read-failed';

/** A write refused by one of these ends the career on this tab (erros-e-avisos.md). */
const FATAL_ON_WRITE: ReadonlySet<WriteError> = new Set<WriteError>([
  'conflict',
  'app-outdated',
  'save-too-new',
  'unsupported-browser',
]);

/**
 * A write of the coach's sheet refused by one of these ends the career on this tab, as a snapshot
 * write does (another tab wrote, or a newer build owns the career). `fatal.unsaved` stays `false`:
 * the screen's text for it speaks of a round not stored, and no round is pending when the sheet
 * is written (`busy` and `unsaved` hold it back); the edit lost is only the last ones.
 */
const FATAL_ON_DRAFT: ReadonlySet<DraftWriteError & FatalCode> = new Set<
  DraftWriteError & FatalCode
>(['conflict', 'app-outdated', 'save-too-new']);

const isFatalOnDraft = (code: DraftWriteError): code is DraftWriteError & FatalCode =>
  (FATAL_ON_DRAFT as ReadonlySet<string>).has(code);

/** Opening failures that take the whole screen; the others are shown on the home screen. */
const FATAL_ON_OPEN: ReadonlySet<OpenError> = new Set<OpenError>([
  'all-corrupt',
  'read-failed',
  'app-outdated',
]);

/** Why "Jogar rodada" cannot start now (the button shows the reason). */
export type RoundBlock = 'unsaved' | 'season-over';

export interface CareerState {
  /** `fatal`: a full-screen error; the career is no longer usable on this tab. */
  readonly status: 'closed' | 'opening' | 'open' | 'fatal';
  /** The career in memory: the last state played, stored or not (see `unsaved`). */
  readonly save?: CareerSave;
  /** Playing or writing: a second tap does nothing. */
  readonly busy: boolean;
  /** The save in memory is not stored, and why: the next round waits for it. */
  readonly unsaved?: WriteError;
  readonly fatal?: { readonly code: FatalCode; readonly unsaved: boolean };
  /**
   * A programming error thrown while playing (the engine, or this layer): the round was not
   * played, the career in memory is the one before it, and the frame shows the unexpected error
   * until "Tentar de novo" ({@link CareerService.dismissCrash}). Event handlers are outside the
   * Svelte boundaries, so the state carries it.
   */
  readonly crash?: 'unexpected';
  /** Rounds lost to a fallback when the career opened, until the notice is dismissed. */
  readonly roundsLost: number;
  /** Rounds whose match sheets were lost when opening (the round screen says so; T-030). */
  readonly missingSheetRounds: readonly number[];
  /**
   * The last write of the coach's sheet alone failed, and why (T-029): the sheet is in memory and
   * goes with the next snapshot, and the frame tells the player, with "Tentar de novo"
   * ({@link CareerService.retryDraft}). Cleared by the next write of the sheet or of a snapshot.
   */
  readonly draftUnsaved?: DraftUnsaved;
}

/** A write of the coach's sheet that failed without ending the career on this tab. */
export type DraftUnsaved = Exclude<DraftWriteError, 'conflict' | 'app-outdated' | 'save-too-new'>;

const CLOSED: CareerState = {
  status: 'closed',
  busy: false,
  roundsLost: 0,
  missingSheetRounds: [],
};

/** What the new-game screen chooses (US-014). */
export interface CareerSetup {
  readonly coachName: string;
  readonly clubId: ClubId;
  readonly realism: 'full' | 'simplified';
  readonly matchMode: MatchMode;
}

export type CreateError =
  | `coach-name-${CoachNameProblem}`
  | 'unknown-club'
  | 'no-club-set'
  | 'invalid-clubs'
  | 'invalid-calendar'
  | 'busy'
  | 'unexpected'
  | WriteError;

export type PlayError =
  'not-open' | 'busy' | RoundBlock | 'round-already-played' | 'round-not-open' | 'unexpected';

/** What the coach brings to the round (the lineup of T-029, the live commands of T-032). */
export interface PlayInput {
  readonly sheet?: TeamSheet;
  readonly commands?: Readonly<Partial<Record<FixtureId, readonly MatchCommand[]>>>;
}

export interface PlayedRound {
  readonly report: RoundReport;
  /** `false`: the round is in memory only (see `CareerState.unsaved` and `fatal`). */
  readonly saved: boolean;
}

export interface CareerServiceOptions {
  readonly store: SaveStore;
  readonly log: ErrorLog;
  readonly appVersion: string;
  readonly params?: GameParams;
  readonly identities?: IdentitySource;
  readonly clubSets?: readonly ClubSet[];
  /** The clock of `createdAt` and `updatedAt` (the engine has none). */
  readonly now?: () => Date;
  /** A UUID v4 for a new career; `undefined` when the platform has none (not a secure context). */
  readonly newCareerId?: () => string | undefined;
  /** The seed of a new career. */
  readonly newSeed?: () => number;
}

const defaultCareerId = (): string | undefined =>
  typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : undefined;

const defaultSeed = (): number => globalThis.crypto.getRandomValues(new Uint32Array(1))[0]!;

/** The season is over for the engine: round 38 played, or the season already closed. */
export function seasonOver(game: GameState): boolean {
  return game.phase !== 'season' || game.round > SEASON_ROUNDS;
}

/** The season of a career on the device is over (its next round is past the last one). */
export function summarySeasonOver(summary: Pick<CareerSummary, 'round'>): boolean {
  return summary.round > SEASON_ROUNDS;
}

/** Why the round cannot be played from this state, or `undefined` when it can. */
export function roundBlock(state: CareerState): RoundBlock | undefined {
  if (state.unsaved !== undefined) return 'unsaved';
  if (state.save !== undefined && seasonOver(state.save.game)) return 'season-over';
  return undefined;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The `{ path, problem }` of an `invalid-save` detail, when it has one. */
function issueOf(detail: unknown): { path?: string; problem?: string } {
  if (!isObject(detail)) return {};
  return {
    ...(typeof detail.path === 'string' ? { path: detail.path } : {}),
    ...(typeof detail.problem === 'string' ? { problem: detail.problem } : {}),
  };
}

export class CareerService {
  private readonly store: SaveStore;
  private readonly log: ErrorLog;
  private readonly appVersion: string;
  /**
   * The game parameters of this career layer: the ones every round is played with, also read by
   * the screens that show the engine's suggestion (T-029), so both use the same values.
   */
  readonly params: GameParams;
  /** Only a new career needs it: the name lists are compiled on first use. */
  private readonly identities: IdentitySource | undefined;
  private readonly clubSets: readonly ClubSet[];
  private readonly now: () => Date;
  private readonly newCareerId: () => string | undefined;
  private readonly newSeed: () => number;
  private readonly writableState = writable<CareerState>(CLOSED);
  private current: CareerState = CLOSED;
  /** The `expectedHeadSeq` of the next write of the open career. */
  private headSeq = 0;
  /**
   * `seq` of the snapshot the career in memory came from (ADR-0021, item 3, clarified): the one
   * that opened, then each one written. The same as `headSeq` except after a fallback to an older
   * version; the coach's sheet is stored with it.
   */
  private snapshotSeq = 0;
  /** Opaque: handed back to `writeSnapshot` as it came from the store, never read here. */
  private base: SheetIndex | undefined;
  /** A sheet edit waits to be written (only the last one is). */
  private draftQueued = false;
  /** The loop of {@link writeDrafts} is running, and its promise. */
  private draftLoop = false;
  private draftDone: Promise<void> = Promise.resolve();
  private hash: Promise<string> | undefined;

  /** The open career, for the screens (read-only). */
  readonly state: Readable<CareerState> = { subscribe: this.writableState.subscribe };

  constructor(options: CareerServiceOptions) {
    this.store = options.store;
    this.log = options.log;
    this.appVersion = options.appVersion;
    this.params = options.params ?? loadGameParams();
    this.identities = options.identities;
    this.clubSets = options.clubSets ?? CLUB_SETS;
    this.now = options.now ?? (() => new Date());
    this.newCareerId = options.newCareerId ?? defaultCareerId;
    this.newSeed = options.newSeed ?? defaultSeed;
  }

  /** The state now (the same value the store gives its subscribers). */
  get snapshot(): CareerState {
    return this.current;
  }

  /** The clubs a new career can choose: those of the latest set of club data (US-066). */
  clubs(): readonly ClubDef[] {
    return latestClubSet(this.clubSets)?.clubs ?? [];
  }

  /**
   * The clubs of the new-game screen with the strength the engine will play them with: the
   * data's, or the engine's default when a club has none (`validateClubs` fills it in, with a
   * warning). Empty when the data does not pass the check: `create` would refuse it as well.
   */
  newGameClubs(): readonly NewGameClub[] {
    const checked = validateClubs(this.clubs());
    if (!checked.ok) {
      this.logProgramming(checked.error, 'newGame.clubs', checked.detail);
      return [];
    }
    return checked.value.flatMap((club) =>
      typeof club.strength === 'number' ? [{ club, strength: club.strength }] : [],
    );
  }

  /**
   * The last new-game setup kept on the device (US-014, "última configuração"), or `undefined`
   * the first time, after a failed read or when the stored value is not one (the screen then uses
   * its defaults).
   */
  async lastSetup(): Promise<LastSetup | undefined> {
    try {
      const read = await this.store.readKv(LAST_SETUP_KEY);
      if (!read.ok) {
        this.logStorage(read.error, 'newGame.last', read.detail);
        return undefined;
      }
      return parseLastSetup(read.value);
    } catch (error) {
      this.logException('newGame.last', error);
      return undefined;
    }
  }

  /**
   * Keeps the realism and the match mode of a career just created as the next "última
   * configuração". Only those two fields are written, whatever else `setup` carries: never the
   * club nor the nickname (CEO decision 2 of T-025). A failure is only logged: the career is
   * already created.
   */
  async rememberSetup(setup: LastSetup): Promise<void> {
    const value: LastSetup = { realism: setup.realism, matchMode: setup.matchMode };
    try {
      const written = await this.store.writeKv(LAST_SETUP_KEY, value);
      if (!written.ok) this.logStorage(written.error, 'newGame.last', written.detail);
    } catch (error) {
      this.logException('newGame.last', error);
    }
  }

  /** The careers on the device, the most recent first (US-034). */
  async list(): Promise<SaveResult<CareerSummary[], StorageError>> {
    const listed = await this.store.listCareers();
    if (!listed.ok) this.logStorage(listed.error, 'career.list', listed.detail);
    return listed;
  }

  /** Creates, stores and opens a new career (US-014). */
  async create(setup: CareerSetup): Promise<SaveResult<void, CreateError>> {
    if (this.current.busy) return { ok: false, error: 'busy' };
    const name = checkCoachName(setup.coachName);
    if (!name.ok) return { ok: false, error: `coach-name-${name.error}` };
    if (!this.clubs().some((club) => club.id === setup.clubId)) {
      return { ok: false, error: 'unknown-club' };
    }
    const careerId = this.newCareerId();
    if (!codecSupported() || careerId === undefined) {
      this.logStorage('unsupported-browser', 'career.create');
      return { ok: false, error: 'unsupported-browser' };
    }
    // Busy before the first await: a second tap while this one runs is refused.
    this.reset();
    this.set({ busy: true });
    try {
      return await this.createStored(setup, name.value, careerId);
    } catch (error) {
      this.logException('career.create', error);
      this.current = CLOSED;
      this.set({});
      return { ok: false, error: 'unexpected' };
    }
  }

  private async createStored(
    setup: CareerSetup,
    coachName: string,
    careerId: string,
  ): Promise<SaveResult<void, CreateError>> {
    const created = newCareerGame(
      { seed: this.newSeed(), realism: setup.realism },
      this.params,
      this.identities ?? gameIdentitySource(),
      this.clubSets,
    );
    if (!created.ok) {
      this.logProgramming(created.error, 'career.create', created.detail);
      this.current = CLOSED;
      this.set({});
      return { ok: false, error: created.error };
    }
    const at = this.now().toISOString();
    const save: CareerSave = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      careerId,
      createdAt: at,
      updatedAt: at,
      appVersion: this.appVersion,
      engineVersion: created.value.game.engineVersion,
      paramsHash: await this.paramsHashOnce(),
      career: {
        coachName,
        clubId: setup.clubId,
        matchMode: setup.matchMode,
        news: [],
        social: [],
        phraseMemory: [],
        pendingFanDecision: 0,
        exportReminder: true,
        baseSeason: created.value.baseSeason,
        matchSheets: {},
      },
      game: created.value.game,
    };
    // A new career: no base (every round is written) and the guard of a career not yet stored.
    const written = await this.store.writeSnapshot(save, undefined, { expectedHeadSeq: 0 });
    if (!written.ok) {
      this.recordWriteError(written.error, 'career.create', written.detail);
      this.current = CLOSED;
      if (FATAL_ON_WRITE.has(written.error)) {
        this.set({
          status: 'fatal',
          fatal: { code: written.error as FatalCode, unsaved: false },
        });
      } else {
        this.set({});
      }
      return written;
    }
    this.headSeq = written.value.seq;
    this.snapshotSeq = written.value.seq;
    this.base = written.value.sheets;
    this.set({ status: 'open', save, busy: false });
    return { ok: true, value: undefined };
  }

  /** The `paramsHash` of this build, computed once; a failed attempt is not kept. */
  private paramsHashOnce(): Promise<string> {
    const pending = this.hash ?? paramsHash(this.params);
    this.hash = pending;
    pending.catch(() => {
      if (this.hash === pending) this.hash = undefined;
    });
    return pending;
  }

  /** Opens a career from the device (US-032), writing it again first if it was migrated. */
  async open(careerId: string): Promise<SaveResult<void, OpenError | 'busy' | 'unexpected'>> {
    if (this.current.busy) return { ok: false, error: 'busy' };
    this.reset();
    this.set({ status: 'opening', busy: true });
    try {
      return await this.openStored(careerId);
    } catch (error) {
      this.logException('career.open', error);
      this.reset();
      this.set({});
      return { ok: false, error: 'unexpected' };
    }
  }

  private async openStored(careerId: string): Promise<SaveResult<void, OpenError>> {
    const opened = await this.store.openCareer(careerId);
    if (!opened.ok) {
      if (opened.error === 'all-corrupt' && isObject(opened.detail)) {
        const skipped = Array.isArray(opened.detail.skipped) ? opened.detail.skipped : [];
        this.logSkipped(skipped as SkippedSnapshot[]);
        this.logStorage('all-corrupt', 'career.open', { snapshots: opened.detail.snapshots });
      } else {
        this.logStorage(opened.error, 'career.open', opened.detail);
      }
      this.current = CLOSED;
      if (FATAL_ON_OPEN.has(opened.error)) {
        this.set({ status: 'fatal', fatal: { code: opened.error as FatalCode, unsaved: false } });
      } else {
        this.set({});
      }
      return opened;
    }
    const {
      save,
      seq,
      headSeq,
      sheets,
      skipped,
      roundsLost,
      missingSheetRounds,
      fromVersion,
      draftSkipped,
    } = opened.value;
    this.logSkipped(skipped);
    // The row's sheet did not pass its check: the snapshot's own is used. Only the code, never the
    // sheet. `stale` (built on another snapshot, as after a fallback) is not an error.
    if (draftSkipped === 'invalid') this.logStorage('draft-skipped', 'career.open');
    this.headSeq = headSeq;
    this.snapshotSeq = seq;
    this.base = sheets;
    this.set({ status: 'open', save, busy: false, roundsLost, missingSheetRounds });
    // A migrated save becomes a snapshot of the current format (4.2, "Migração"): the original is
    // kept until this one is checked. A failure here is shown like any unsaved round.
    if (fromVersion < SAVE_SCHEMA_VERSION) await this.persist(save, 'career.migrate');
    return { ok: true, value: undefined };
  }

  /**
   * The plan of the next round (the live match replays it): always with the coach's mode, the
   * same input `playRound` will give the engine (4.1).
   */
  prepareRound(input: PlayInput = {}): Result<RoundPlan, 'season-over'> | undefined {
    const save = this.current.save;
    if (this.current.status !== 'open' || save === undefined) return undefined;
    const clubId = save.career.clubId;
    return prepareEngineRound(save.game, this.params, {
      sheets: input.sheet === undefined ? {} : { [clubId]: input.sheet },
      coaches: { [clubId]: save.career.matchMode },
    });
  }

  /**
   * Plays the next round and stores it with the round's recap and sheets. The pending fan
   * decision goes into the round and is cleared in the same snapshot (4.1, `fanDecisions`).
   */
  async playRound(input: PlayInput = {}): Promise<SaveResult<PlayedRound, PlayError>> {
    const state = this.current;
    const save = state.save;
    if (state.status !== 'open' || save === undefined) return { ok: false, error: 'not-open' };
    if (state.busy) return { ok: false, error: 'busy' };
    if (state.crash !== undefined) return { ok: false, error: 'unexpected' };
    const blocked = roundBlock(state);
    if (blocked !== undefined) return { ok: false, error: blocked };
    this.set({ busy: true });
    const headSeq = this.headSeq;
    try {
      return await this.playAndStore(save, input);
    } catch (error) {
      this.logException('career.play', error);
      // A bug before the round was stored: the career in memory goes back to the one before it.
      // After it was stored (the head moved), the stored round stays: going back would make the
      // next write repeat a round already on the device.
      if (this.headSeq === headSeq) this.set({ save, busy: false, crash: 'unexpected' });
      else this.set({ busy: false, crash: 'unexpected' });
      return { ok: false, error: 'unexpected' };
    }
  }

  private async playAndStore(
    save: CareerSave,
    input: PlayInput,
  ): Promise<SaveResult<PlayedRound, PlayError>> {
    // Let the screen show "Calculando a rodada..." before the engine takes the thread.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const clubId = save.career.clubId;
    const pending = save.career.pendingFanDecision;
    const played = playEngineRound(save.game, this.params, {
      round: save.game.round,
      sheets: input.sheet === undefined ? {} : { [clubId]: input.sheet },
      commands: input.commands ?? {},
      fanDecisions: pending === 0 ? {} : { [clubId]: pending },
      coaches: { [clubId]: save.career.matchMode },
    });
    if (!played.ok) {
      this.set({ busy: false });
      // The round was checked above: the engine refusing it is a bug of this layer.
      this.logProgramming(played.error, 'career.play', played.detail);
      return { ok: false, error: played.error };
    }
    const { report } = played.value;
    const matchSheets: Record<FixtureId, MatchSheet> = { ...save.career.matchSheets };
    for (const result of report.results) matchSheets[result.fixtureId] = matchSheet(result);
    const next: CareerSave = {
      ...save,
      updatedAt: this.now().toISOString(),
      game: played.value.state,
      career: {
        ...save.career,
        pendingFanDecision: 0,
        lastRound: roundRecap(report),
        matchSheets,
        // The sheet sent is kept as it was played (ADR-0021); without one, the draft stays.
        ...(input.sheet === undefined ? {} : { draft: draftFromSheet(input.sheet) }),
      },
    };
    const written = await this.persist(next, 'career.play');
    return { ok: true, value: { report, saved: written.ok } };
  }

  /**
   * The coach changed the sheet (ADR-0021; the Escalação, Tática and Funções screens, which have no
   * "Salvar"): reconciled with the squad, kept in memory at once and written between rounds as the
   * sheet alone (`writeDraft`). Edits that arrive while one is being written are written once,
   * the last. With a round in memory not yet stored (`unsaved`) nothing is written: the sheet goes
   * with "Tentar de novo". While a round is played or written (`busy`) the sheet does not change.
   * A failed write is logged, kept in `draftUnsaved` for the frame's notice ("Tentar de novo":
   * {@link retryDraft}) and the sheet stays in memory (the next snapshot takes it); a
   * `conflict` (another tab), `app-outdated` or `save-too-new` ends the career on this tab, as a
   * snapshot write does. Resolves when the write is done.
   */
  async setDraft(draft: DraftSheet): Promise<SaveResult<void, 'not-open' | 'busy'>> {
    const { status, save, busy } = this.current;
    if (status !== 'open' || save === undefined) return { ok: false, error: 'not-open' };
    if (busy) return { ok: false, error: 'busy' };
    const sheet = reconcileDraft(save.game, save.career.clubId, draft);
    this.set({ save: { ...save, career: { ...save.career, draft: sheet } } });
    if (this.current.unsaved === undefined) await this.flushDraft();
    return { ok: true, value: undefined };
  }

  /**
   * "Tentar de novo" of a failed write of the coach's sheet (`draftUnsaved`): writes the sheet in
   * memory again. With a round not stored (`unsaved`) the sheet goes with {@link retrySave}.
   */
  async retryDraft(): Promise<SaveResult<void, 'nothing-to-save' | 'busy'>> {
    const { status, save, busy, unsaved, draftUnsaved } = this.current;
    if (busy) return { ok: false, error: 'busy' };
    if (status !== 'open' || save === undefined || draftUnsaved === undefined) {
      return { ok: false, error: 'nothing-to-save' };
    }
    if (unsaved !== undefined) return { ok: false, error: 'nothing-to-save' };
    await this.flushDraft();
    return { ok: true, value: undefined };
  }

  /** "Tentar de novo": repeats the write of the save in memory that is not stored yet. */
  async retrySave(): Promise<SaveResult<void, WriteError | 'nothing-to-save' | 'busy'>> {
    const { status, save, unsaved, busy } = this.current;
    if (busy) return { ok: false, error: 'busy' };
    if (status !== 'open' || save === undefined || unsaved === undefined) {
      return { ok: false, error: 'nothing-to-save' };
    }
    return this.persist(save, 'career.retry');
  }

  /** "Tentar de novo" after a crash while playing: the frame goes back to the screen. */
  dismissCrash(): void {
    if (this.current.crash !== undefined) this.set({ crash: undefined });
  }

  /** Closes the "rodadas perdidas" notice for good (it does not come back for this opening). */
  dismissRoundsLost(): void {
    if (this.current.roundsLost !== 0) this.set({ roundsLost: 0 });
  }

  /** "Voltar ao início": drops the career from memory, without writing. */
  close(): void {
    this.reset();
    this.set({});
  }

  /** Deletes a career from the device (the double confirmation is the screen's, US-034). */
  async remove(careerId: string): Promise<SaveResult<void, StorageError | 'write-failed'>> {
    const removed = await this.store.deleteCareer(careerId);
    if (!removed.ok) this.logStorage(removed.error, 'career.delete', removed.detail);
    else if (this.current.save?.careerId === careerId) this.close();
    return removed;
  }

  // ------------------------------------------------------------------------------- internals

  /** `save` with its draft sheet reconciled with its squad (ADR-0021), before any write. */
  private reconciled(save: CareerSave): CareerSave {
    const draft = save.career.draft;
    if (draft === undefined) return save;
    return {
      ...save,
      career: { ...save.career, draft: reconcileDraft(save.game, save.career.clubId, draft) },
    };
  }

  /**
   * Asks for the sheet in memory to be written, and gives the promise of the loop that writes it:
   * one loop at a time, each turn writing the sheet in memory then, so the edits waiting are
   * written once, the last.
   */
  private flushDraft(): Promise<void> {
    this.draftQueued = true;
    if (!this.draftLoop) {
      this.draftLoop = true;
      this.draftDone = this.writeDrafts();
    }
    return this.draftDone;
  }

  private async writeDrafts(): Promise<void> {
    try {
      while (this.draftQueued) {
        this.draftQueued = false;
        const { status, save, busy, unsaved } = this.current;
        // A snapshot being written (or waiting for "Tentar de novo") carries the sheet in memory:
        // an edit that waited here is not written alone. It stays in memory and goes with that
        // snapshot (a round played with a sheet replaces it by the sheet sent, ADR-0021).
        if (status !== 'open' || save === undefined || busy || unsaved !== undefined) return;
        await this.writeDraft(save);
      }
    } finally {
      this.draftLoop = false;
    }
  }

  private async writeDraft(save: CareerSave): Promise<void> {
    let written: SaveResult<unknown, DraftWriteError>;
    let thrown = false;
    try {
      written = await this.store.writeDraft(save, {
        expectedHeadSeq: this.headSeq,
        snapshotSeq: this.snapshotSeq,
      });
    } catch (error) {
      // The store never throws for a storage situation: a bug, logged with its stack, and shown
      // to the player as a write that failed.
      this.logException('career.draft', error);
      written = { ok: false, error: 'write-failed' };
      thrown = true;
    }
    // The career may have been closed or changed while the sheet was written.
    const same = this.current.status === 'open' && this.current.save?.careerId === save.careerId;
    if (written.ok) {
      if (same && this.current.draftUnsaved !== undefined) this.set({ draftUnsaved: undefined });
      return;
    }
    if (written.error === 'invalid-save') {
      void this.log.record({
        kind: 'programming',
        code: written.error,
        screen: 'career.draft',
        ...issueOf(written.detail),
      });
    } else if (!thrown) {
      this.logStorage(written.error, 'career.draft', written.detail);
    }
    if (!same) return;
    if (isFatalOnDraft(written.error)) {
      this.set({ status: 'fatal', fatal: { code: written.error, unsaved: false } });
    } else {
      // Never silent (T-029): the frame shows the notice; the sheet stays in memory and goes with
      // the next snapshot.
      this.set({ draftUnsaved: written.error });
    }
  }

  /** Writes `save` with the guard and the opaque base; keeps it in memory whatever happens. */
  private async persist(
    unreconciled: CareerSave,
    screen: string,
  ): Promise<SaveResult<void, WriteError>> {
    // The one point where a snapshot's draft sheet is reconciled (ADR-0021): a player who left
    // the squad (retired at the season turn) is a free slot already in the snapshot written.
    const save = this.reconciled(unreconciled);
    this.set({ save, busy: true });
    let written: SaveResult<WrittenSnapshot, WriteError>;
    try {
      written = await this.store.writeSnapshot(save, this.base, {
        expectedHeadSeq: this.headSeq,
      });
    } catch (error) {
      // The store never throws for a storage situation: this is a bug, kept as an unsaved round
      // so "Tentar de novo" can still store it.
      this.logException(screen, error);
      written = { ok: false, error: 'write-failed' };
    }
    if (written.ok) {
      this.headSeq = written.value.seq;
      this.snapshotSeq = written.value.seq;
      this.base = written.value.sheets;
      // The snapshot carries the sheet in memory: a failed write of the sheet alone is behind.
      this.set({ busy: false, unsaved: undefined, draftUnsaved: undefined });
      return { ok: true, value: undefined };
    }
    this.recordWriteError(written.error, screen, written.detail);
    // The undo of a failed check itself failed: the new snapshot stayed the head (4.2), so the
    // retry must expect it, or it would be refused as a conflict with another tab.
    if (
      written.error === 'verify-failed' &&
      isObject(written.detail) &&
      written.detail.rolledBack === false
    ) {
      this.headSeq += 1;
    }
    if (FATAL_ON_WRITE.has(written.error)) {
      this.set({
        status: 'fatal',
        busy: false,
        unsaved: written.error,
        fatal: { code: written.error as FatalCode, unsaved: true },
      });
    } else {
      this.set({ busy: false, unsaved: written.error });
    }
    return written;
  }

  private recordWriteError(code: WriteError, screen: string, detail: unknown): void {
    if (code === 'career-limit') return; // the player's situation, not an error
    if (code === 'invalid-save') {
      void this.log.record({ kind: 'programming', code, screen, ...issueOf(detail) });
    } else {
      this.logStorage(code, screen, detail);
    }
  }

  /** Skipped snapshots: corruption is a storage event; the current format failing is a bug. */
  private logSkipped(skipped: readonly SkippedSnapshot[]): void {
    for (const entry of skipped) {
      if (!isObject(entry)) continue;
      if (entry.problem === 'invalid-save' && entry.fromVersion === SAVE_SCHEMA_VERSION) {
        void this.log.record({
          kind: 'programming',
          code: 'invalid-save',
          screen: 'career.open',
          path: entry.issue.path,
          problem: entry.issue.problem,
          detail: { seq: entry.seq, fromVersion: entry.fromVersion },
        });
      } else {
        void this.log.record({
          kind: 'storage',
          code: 'snapshot-skipped',
          screen: 'career.open',
          problem: entry.problem,
          detail: {
            seq: entry.seq,
            ...('fromVersion' in entry ? { fromVersion: entry.fromVersion } : {}),
          },
        });
      }
    }
  }

  private logStorage(code: string, screen: string, detail?: unknown): void {
    void this.log.record({ kind: 'storage', code, screen, detail });
  }

  private logException(screen: string, error: unknown): void {
    void this.log.record({ kind: 'programming', code: 'unexpected', screen, error });
  }

  private logProgramming(code: string, screen: string, detail?: unknown): void {
    void this.log.record({ kind: 'programming', code, screen, detail });
  }

  private reset(): void {
    this.current = CLOSED;
    this.headSeq = 0;
    this.snapshotSeq = 0;
    this.base = undefined;
  }

  private set(change: Partial<CareerState>): void {
    const next: Record<string, unknown> = { ...this.current, ...change };
    // A field set to `undefined` is removed, so the state never has `key: undefined`.
    for (const key of Object.keys(change)) if (next[key] === undefined) delete next[key];
    this.current = next as unknown as CareerState;
    this.writableState.set(this.current);
  }
}
