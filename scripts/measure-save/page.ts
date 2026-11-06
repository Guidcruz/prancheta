import {
  SaveStore,
  encodeSave,
  type CareerSave,
  type SheetIndex,
} from '../../app/src/lib/save/index.ts';
import { sampleAtRound, sampleCareerSave } from '../../app/src/lib/save/testing/sample.ts';

/*
 * Page of the write measurement (scripts/measure-save.ts; docs/02-architecture.md, 5, "Gravação
 * da rodada no save"), bundled by Vite with PRANCHETA_ENV=test and run in headless Chromium.
 * `prepare` builds the end-of-season save before the CPU slowdown is turned on; `measure` then
 * times, on the test database, the whole safe write of the store (serialise, hash, gzip,
 * transaction, read back, compare, prune) with the match sheets out of the snapshot:
 *
 * - `incremental`: the save after round 38 with the `base` of rounds 1 to 37, so only the row of
 *   round 38 is written (the normal write after a round; this one decides);
 * - `noNewRound`: the same save with the `base` of the 38 rounds, no row written;
 * - `allRounds`: no `base`, the 38 rows written (new career, import, migration);
 * - `open`: opening that career (3 snapshots, 38 rows), sheets reassembled;
 *
 * and the parts the store cannot see from outside (stringify, encode of the snapshot).
 */

export interface MeasureOptions {
  readonly runs: number;
  readonly warmup: number;
}

export interface Measurement {
  readonly dbName: string;
  readonly incremental: number[];
  readonly noNewRound: number[];
  readonly allRounds: number[];
  readonly open: number[];
  /** Serialise + hash + gzip of the snapshot (sheets apart). */
  readonly encode: number[];
  readonly stringify: number[];
  readonly snapshotJsonBytes: number;
  readonly snapshotGzipBytes: number;
  /** JSON and gzip bytes of the 38 rows of sheets together. */
  readonly sheetsJsonBytes: number;
  readonly sheetsGzipBytes: number;
}

let full: CareerSave | undefined;

async function time(run: () => unknown): Promise<number> {
  const start = performance.now();
  await run();
  return performance.now() - start;
}

function stamp(save: CareerSave, i: number): CareerSave {
  return { ...save, updatedAt: new Date(Date.UTC(2026, 10, 6, 12, 0, i)).toISOString() };
}

async function prepare(): Promise<void> {
  full = sampleCareerSave({ rounds: 38 });
  // The garbage of building a whole season at once is not the write's: collected here, before
  // the slowdown, when Chromium exposes `gc` (main.ts launches it with --expose-gc).
  (globalThis as { gc?: () => void }).gc?.();
}

async function measure(options: MeasureOptions): Promise<Measurement> {
  if (full === undefined) throw new Error('prepare() first');
  const save = full;
  const store = new SaveStore();
  const total = options.warmup + options.runs;
  const keep = (list: number[], i: number, ms: number) => {
    if (i >= options.warmup) list.push(ms);
  };
  const write = async (next: CareerSave, base: SheetIndex | undefined, rounds: number) => {
    const result = await store.writeSnapshot(next, base);
    if (!result.ok) throw new Error(`writeSnapshot: ${result.error}`);
    if (result.value.writtenRounds.length !== rounds) {
      throw new Error(`writeSnapshot wrote ${result.value.writtenRounds.length} rounds`);
    }
    return result.value;
  };

  // The snapshot after round 37 is the base of the write after round 38. The two writes of the
  // end of the season alternate, so both meet the same garbage collections.
  const before = await write(sampleAtRound(save, 37), undefined, 37);
  let last = await write(stamp(save, 0), before.sheets, 1);
  const incremental: number[] = [];
  const noNewRound: number[] = [];
  for (let i = 0; i < total; i++) {
    const after38 = stamp(save, 2 * i + 1);
    keep(incremental, i, await time(async () => (last = await write(after38, before.sheets, 1))));
    const again = stamp(save, 2 * i + 2);
    keep(noNewRound, i, await time(() => write(again, last.sheets, 0)));
  }
  const allRounds: number[] = [];
  for (let i = 0; i < total; i++) {
    const next = stamp(save, 3 * total + i);
    keep(allRounds, i, await time(() => write(next, undefined, 38)));
  }
  const open: number[] = [];
  for (let i = 0; i < total; i++) {
    const ms = await time(async () => {
      const opened = await store.openCareer(save.careerId);
      if (!opened.ok) throw new Error(`openCareer: ${opened.error}`);
      if (opened.value.missingSheetRounds.length > 0) throw new Error('openCareer: sheets missing');
      if (Object.keys(opened.value.save.career.matchSheets).length !== 380) {
        throw new Error('openCareer: not 380 sheets');
      }
    });
    keep(open, i, ms);
  }

  const snapshot: CareerSave = { ...save, career: { ...save.career, matchSheets: {} } };
  const encode: number[] = [];
  const stringify: number[] = [];
  for (let i = 0; i < total; i++) {
    const next = stamp(snapshot, i);
    keep(encode, i, await time(() => encodeSave(next)));
    keep(stringify, i, await time(() => JSON.stringify(next)));
  }
  const encoded = await encodeSave(snapshot);
  if (!encoded.ok) throw new Error(`encodeSave: ${encoded.error}`);
  let sheetsJsonBytes = 0;
  let sheetsGzipBytes = 0;
  for (let round = 1; round <= 38; round++) {
    const ids = new Set(save.game.fixtures.filter((f) => f.round === round).map((f) => f.id));
    const sheets = Object.fromEntries(
      Object.entries(save.career.matchSheets).filter(([id]) => ids.has(id)),
    );
    const row = await encodeSave(sheets);
    if (!row.ok) throw new Error(`encodeSave: ${row.error}`);
    sheetsJsonBytes += row.value.bytes;
    sheetsGzipBytes += row.value.gzip.byteLength;
  }
  await store.deleteCareer(save.careerId);
  const dbName = store.dbName;
  await store.close();
  return {
    dbName,
    incremental,
    noNewRound,
    allRounds,
    open,
    encode,
    stringify,
    snapshotJsonBytes: encoded.value.bytes,
    snapshotGzipBytes: encoded.value.gzip.byteLength,
    sheetsJsonBytes,
    sheetsGzipBytes,
  };
}

(window as unknown as { measureSave: unknown }).measureSave = { prepare, measure };
