import type {
  ClubDef,
  ClubId,
  DraftSheet,
  FixtureId,
  GameState,
  MatchMode,
  MatchSheet,
  RoundRecap,
} from '../../engine/index.ts';

/*
 * The envelope of a career save (docs/02-architecture.md, 4.2; ADR-0006, ADR-0019). This file has
 * the TypeScript shape; the strict schema of the same format is validate.ts, and a drift between
 * the two fails to compile. Every released format is frozen: the fixtures `__fixtures__/vN.json`
 * and the shape test (fixtures.test.ts). v1 came with T-019; v2 (T-075, ADR-0021) adds the
 * coach's sheet being edited, `career.draft`. Any change to this shape or to `GameState` raises
 * `SAVE_SCHEMA_VERSION`, with a migration (migrations/) and the new fixture.
 */

/** The current format of `CareerSave` (ADR-0006); every change of the format raises it. */
export const SAVE_SCHEMA_VERSION = 2;

/** Careers kept on the device at the same time (docs/02-architecture.md, 4.2). */
export const MAX_CAREERS = 10;

/** Snapshots kept per career: the newest and the two before it (US-032). */
export const KEPT_SNAPSHOTS = 3;

/**
 * Most bytes a save may decompress to (ADR-0006, import: "para a descompressão acima de 40 MB").
 * A stored snapshot is bounded tighter, by its own `bytes`.
 */
export const MAX_SAVE_BYTES = 40 * 1024 * 1024;

/**
 * A news item kept as a reference to a template (docs/02-architecture.md, 3, "Itens guardados como
 * referência"): the text is built when shown, so changing the language keeps the career.
 */
export interface NewsRef {
  readonly factId: string;
  readonly templateId: string;
  readonly variantId: string;
  readonly vars: Readonly<Record<string, string | number>>;
}

/** A social post, kept like {@link NewsRef}. */
export type SocialRef = NewsRef;

/** The application part of a career in the format v1 (docs/02-architecture.md, 4.2). */
export interface CareerDataV1 {
  /** The only text typed by the player; stays on the device and in the exported file. */
  readonly coachName: string;
  readonly clubId: ClubId;
  readonly matchMode: MatchMode;
  readonly news: readonly NewsRef[];
  readonly social: readonly SocialRef[];
  /** At most 200 variant ids. */
  readonly phraseMemory: readonly string[];
  /** Fan decisions not yet consumed by a round (docs/02-architecture.md, 4.1, T-014). */
  readonly pendingFanDecision: number;
  readonly exportReminder: boolean;
  /** Base season of the club data used by the new game (US-066); never changes in the career. */
  readonly baseSeason: number;
  /** Lean report of the last round (ADR-0019); absent before round 1 and at the season turn. */
  readonly lastRound?: RoundRecap;
  /** Match sheets of the current season only (US-019; ADR-0019); `{}` at the season turn. */
  readonly matchSheets: Readonly<Record<FixtureId, MatchSheet>>;
}

/** The application part of a career (docs/02-architecture.md, 4.2), format v2. */
export interface CareerData extends CareerDataV1 {
  /**
   * The coach's sheet being edited (ADR-0021), free slots included; absent until the coach
   * changes it (the screen then shows the engine's suggestion). Always reconciled with the squad
   * before it is written (lib/career, `reconcileDraft`); never in the `GameState`.
   */
  readonly draft?: DraftSheet;
}

/** Version 1 of the save (docs/02-architecture.md, 4.2). */
export interface CareerSaveV1 {
  readonly schemaVersion: 1;
  /** UUID v4 made on the device. */
  readonly careerId: string;
  /** ISO 8601; the clock is outside the engine. */
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly appVersion: string;
  readonly engineVersion: number;
  readonly paramsHash: string;
  readonly career: CareerDataV1;
  readonly game: GameState;
}

/** Version 2 of the save (ADR-0021): v1 with `career.draft`. */
export interface CareerSaveV2 extends Omit<CareerSaveV1, 'schemaVersion' | 'career'> {
  readonly schemaVersion: 2;
  readonly career: CareerData;
}

/** The save in the current format. */
export type CareerSave = CareerSaveV2;

/**
 * A row of the `careers` store: what the career list shows without opening a snapshot (US-034),
 * and the pointer to the newest snapshot.
 */
export interface CareerSummary {
  readonly id: string;
  /** The coach's club as frozen in the save (name, colours and crest for the list). */
  readonly club: ClubDef;
  readonly season: number;
  /** Next round to play, as in `GameState.round` (39 = season over). */
  readonly round: number;
  readonly updatedAt: string;
  /** `seq` of the newest snapshot. */
  readonly headSeq: number;
  readonly schemaVersion: number;
}

/**
 * The coach's sheet kept between rounds in the career's row of `careers` (ADR-0021, item 3):
 * `seq` is the snapshot it was built on, and opening uses it only with that snapshot.
 */
export interface StoredDraft {
  readonly seq: number;
  readonly sheet: DraftSheet;
}

/**
 * A row of the `careers` store as stored: the summary and, between rounds, the coach's sheet
 * (`SaveStore.writeDraft`). A snapshot write stores the row without it (the sheet is in the
 * snapshot), and `listCareers` gives the summary only.
 */
export interface CareerRecord extends CareerSummary {
  readonly draft?: StoredDraft;
}

/**
 * A row of the `snapshots` store, keyed by `[careerId, seq]`. The `blob` is the save with
 * `career.matchSheets: {}`: the sheets live in the `matchSheets` store, one row per round, and
 * `sheets` says which rows this snapshot uses (docs/02-architecture.md, 4.2, "Súmulas fora do
 * snapshot").
 */
export interface SnapshotRecord {
  readonly careerId: string;
  readonly seq: number;
  readonly schemaVersion: number;
  readonly savedAt: string;
  /** `GameState.season` and `GameState.round` of the save. */
  readonly season: number;
  readonly round: number;
  /**
   * Round → SHA-256 of the row of match sheets this snapshot uses, for every round of `season`
   * with sheets. Outside the hashed JSON on purpose: a row counts only when its hash is this one.
   */
  readonly sheets: Readonly<Record<number, string>>;
  /** SHA-256, lowercase hex, of the UTF-8 JSON of the save. */
  readonly sha256: string;
  /** Length in bytes of that JSON: `blob` must have exactly this many. */
  readonly bytes: number;
  /**
   * The UTF-8 JSON itself, without gzip (ADR-0006, note of T-072: its gzip was more than half of
   * the write; the exported file keeps the gzip). Bytes, not a `Blob`: the same in every browser's
   * IndexedDB.
   */
  readonly blob: Uint8Array<ArrayBuffer>;
}

/**
 * A row of the `matchSheets` store, keyed by `[careerId, season, round]`: the gzip of the JSON of
 * `Record<FixtureId, MatchSheet>` with the sheets of the matches of that round.
 */
export interface MatchSheetRecord {
  readonly careerId: string;
  readonly season: number;
  readonly round: number;
  /** SHA-256, lowercase hex, of the JSON (the value in the snapshot's `sheets`). */
  readonly sha256: string;
  readonly bytes: number;
  readonly blob: Uint8Array<ArrayBuffer>;
}

/**
 * The index of the rows of match sheets that a snapshot uses (`SnapshotRecord.sheets` with its
 * season). The store returns it from `openCareer` and `writeSnapshot`, and the caller hands it
 * back as the `base` of the next write: rounds already in it are inherited, not written again.
 */
export interface SheetIndex {
  readonly season: number;
  readonly rounds: Readonly<Record<number, string>>;
}
