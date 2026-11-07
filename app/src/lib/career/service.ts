import { writable, type Readable } from 'svelte/store';
import { CLUB_SETS, latestClubSet, type ClubSet } from '../../data/club-sets.ts';
import {
  SEASON_ROUNDS,
  matchSheet,
  playRound as playEngineRound,
  prepareRound as prepareEngineRound,
  roundRecap,
  type ClubDef,
  type ClubId,
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
 *   end the career on this tab instead (full screen, decision 3).
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
}

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
  private readonly params: GameParams;
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
  /** Opaque: handed back to `writeSnapshot` as it came from the store, never read here. */
  private base: SheetIndex | undefined;
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
    const { save, headSeq, sheets, skipped, roundsLost, missingSheetRounds, fromVersion } =
      opened.value;
    this.logSkipped(skipped);
    this.headSeq = headSeq;
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
      },
    };
    const written = await this.persist(next, 'career.play');
    return { ok: true, value: { report, saved: written.ok } };
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

  /** Writes `save` with the guard and the opaque base; keeps it in memory whatever happens. */
  private async persist(save: CareerSave, screen: string): Promise<SaveResult<void, WriteError>> {
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
      this.base = written.value.sheets;
      this.set({ busy: false, unsaved: undefined });
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
