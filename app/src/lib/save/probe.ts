/*
 * Timing of the stages of a safe write, for the save measurement (scripts/measure-save, T-072;
 * docs/02-architecture.md, 5, "Gravação da rodada no save"). Off by default: with no probe set, a
 * stage costs one comparison and nothing is recorded. The measurement page sets one, adds the
 * stages of each write up and prints them; nothing in the game sets it.
 *
 * Stages of the codec (`stringify`, `utf8`, `sha256`, `gzip`) are timed per encoded value (the
 * snapshot and each new row of sheets, encoded side by side) and come with the value's JSON bytes,
 * so the page can tell the snapshot apart. `sha256` and `gzip` of one value run side by side too:
 * each is the wall time from its start to its end. The stages of the store (`schema`, `encode`,
 * `transaction`, `verify`, `prune`) follow one another and come without bytes.
 */

export type WriteStage =
  /** `parseCareerSave` at the `write` check, the grouping of sheets and the new rows in full. */
  | 'schema'
  /** `JSON.stringify` of each value encoded. */
  | 'stringify'
  /** The JSON into UTF-8 bytes. */
  | 'utf8'
  /** `crypto.subtle.digest` of the bytes. */
  | 'sha256'
  /** `CompressionStream('gzip')`, from the first byte written to the last one read. */
  | 'gzip'
  /** Every value of the write encoded (wall time of the four stages above together). */
  | 'encode'
  /** The read-write transaction: checks, snapshot, rows, pointer. */
  | 'transaction'
  /** Reading the snapshot and the new rows back and comparing them byte by byte. */
  | 'verify'
  /** Removing the snapshots past the 3 newest and the rows of older seasons. */
  | 'prune';

/** `bytes`: the JSON bytes of the value, for the stages of the codec only. */
export type WriteProbe = (stage: WriteStage, ms: number, bytes?: number) => void;

let probe: WriteProbe | undefined;

/** Sets (or, with `undefined`, removes) the probe that receives the time of each stage. */
export function setWriteProbe(next: WriteProbe | undefined): void {
  probe = next;
}

/** The start of a stage: `performance.now()` when a probe is set, else 0 (not read). */
export function stageStart(): number {
  return probe === undefined ? 0 : performance.now();
}

/** The time since `start` (from {@link stageStart}) when a probe is set, else 0 (not read). */
export function stageTime(start: number): number {
  return probe === undefined ? 0 : performance.now() - start;
}

/** Reports a stage that took `ms` to the probe, if any. */
export function reportStage(stage: WriteStage, ms: number, bytes?: number): void {
  probe?.(stage, ms, bytes);
}

/** Reports a stage that began at `start` (from {@link stageStart}) to the probe, if any. */
export function stageEnd(stage: WriteStage, start: number): void {
  if (probe !== undefined) probe(stage, performance.now() - start);
}
