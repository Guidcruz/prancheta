/*
 * The saves of the career (docs/02-architecture.md, 3 "Saves" and 4.2; ADR-0006). Only this
 * folder touches the IndexedDB of saves; ui/ reaches it only through lib/career (lint).
 */
export {
  KEPT_SNAPSHOTS,
  MAX_CAREERS,
  MAX_SAVE_BYTES,
  SAVE_SCHEMA_VERSION,
  type CareerData,
  type CareerDataV1,
  type CareerRecord,
  type CareerSave,
  type CareerSaveV1,
  type CareerSaveV2,
  type CareerSummary,
  type MatchSheetRecord,
  type NewsRef,
  type SheetIndex,
  type SnapshotRecord,
  type SocialRef,
  type StoredDraft,
} from './schema.ts';
export type { SaveResult } from './result.ts';
export {
  codecSupported,
  decodeJson,
  decodeSave,
  encodeJson,
  encodeSave,
  equalBytes,
  gunzip,
  gzip,
  sha256Hex,
  type EncodedJson,
  type EncodedSave,
} from './codec.ts';
export { SAVE_DB_NAME, SAVE_DB_VERSION, type ErrorRecord } from './db.ts';
export { SAVE_FIELD_NAMES, fieldNamesOf } from './fields.ts';
export { MIGRATIONS, migrateSave, schemaVersionOf, type Migration } from './migrations/index.ts';
export {
  SAVE_LIMITS,
  careerSaveSchema,
  draftSheetSchema,
  parseCareerSave,
  parseDraft,
  parseRoundSheets,
  roundSheetsSchema,
  type SaveCheck,
  type SaveIssue,
} from './validate.ts';
export { newCareerGame, type NewCareerError, type NewCareerGame } from './new-career.ts';
export {
  SaveStore,
  type DraftWriteError,
  type OpenError,
  type OpenedCareer,
  type SaveStoreOptions,
  type SkippedSnapshot,
  type SnapshotProblem,
  type StorageError,
  type WriteError,
  type WriteGuard,
  type WrittenSnapshot,
} from './store.ts';
