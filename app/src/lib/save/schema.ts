import type {
  ClubDef,
  ClubId,
  FixtureId,
  GameState,
  MatchMode,
  MatchSheet,
  RoundRecap,
} from '../../engine/index.ts';

/*
 * The envelope of a career save (docs/02-architecture.md, 4.2; ADR-0006, ADR-0019). This file has
 * the TypeScript shape only: the format freezes in T-019, with the v1 fixture, the shape test, the
 * migration chain and the strict valibot schema. Until then a change here needs no migration,
 * because no save exists outside the tests yet.
 */

/** The current format of `CareerSave` (ADR-0006); every change after T-019 raises it. */
export const SAVE_SCHEMA_VERSION = 1;

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

/** The application part of a career (docs/02-architecture.md, 4.2). */
export interface CareerData {
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
  readonly career: CareerData;
  readonly game: GameState;
}

/** The save in the current format. */
export type CareerSave = CareerSaveV1;

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

/** A row of the `snapshots` store, keyed by `[careerId, seq]`. */
export interface SnapshotRecord {
  readonly careerId: string;
  readonly seq: number;
  readonly schemaVersion: number;
  readonly savedAt: string;
  /** SHA-256, lowercase hex, of the UTF-8 JSON of the save (before compression). */
  readonly sha256: string;
  /** Length in bytes of that JSON: decompression must give exactly this many. */
  readonly bytes: number;
  /** The gzip of the JSON. Bytes, not a `Blob`: the same in every browser's IndexedDB. */
  readonly blob: Uint8Array<ArrayBuffer>;
}
