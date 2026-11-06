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
  type CareerSave,
  type CareerSaveV1,
  type CareerSummary,
  type NewsRef,
  type SnapshotRecord,
  type SocialRef,
} from './schema.ts';
export type { SaveResult } from './result.ts';
export { decodeSave, encodeSave, gunzip, gzip, sha256Hex, type EncodedSave } from './codec.ts';
export { SAVE_DB_NAME, SAVE_DB_VERSION } from './db.ts';
export { MIGRATIONS, migrateSave, schemaVersionOf, type Migration } from './migrations/index.ts';
export {
  SaveStore,
  type OpenError,
  type OpenedCareer,
  type SaveStoreOptions,
  type SnapshotProblem,
  type StorageError,
  type WriteError,
  type WrittenSnapshot,
} from './store.ts';
