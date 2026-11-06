import { openDB } from 'idb';
import {
  SaveStore,
  encodeJson,
  encodeSave,
  type CareerSave,
  type SheetIndex,
} from '../../app/src/lib/save/index.ts';
import { setWriteProbe, type WriteStage } from '../../app/src/lib/save/probe.ts';
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
 * - `seasonTurn`: the first three writes of season 2 after the one of round 38 of season 1, each
 *   with the `base` of the write before: the turn (sheets zeroed, no row), round 1 (one row) and
 *   round 2 (one row; the oldest kept snapshot is then of season 2, so it reads the 3 snapshots and
 *   prunes the 38 rows of season 1). Normal writes of a round: they decide with `incremental`;
 *
 * and the parts the store cannot see from outside (stringify, encode of the snapshot). Each write
 * after round 38 and of the season turn also reports the time of its stages (probe.ts, T-072): the
 * store's, and the codec's for the snapshot (a new row is encoded beside it, inside `encode`).
 *
 * `gc()` is required (main.ts launches Chromium with --expose-gc): without it the garbage of the
 * untimed preparation would fall on the timed writes and the numbers would change meaning.
 */

const WRITE_STAGES: readonly WriteStage[] = [
  'schema',
  'stringify',
  'utf8',
  'sha256',
  'gzip',
  'encode',
  'transaction',
  'verify',
  'prune',
];

type Stages = Record<WriteStage, number[]>;

const noStages = (): Stages =>
  Object.fromEntries(WRITE_STAGES.map((stage) => [stage, [] as number[]])) as Stages;

/** Collects the garbage now; refuses to measure when Chromium does not expose `gc`. */
function collectGarbage(): void {
  const gc = (globalThis as { gc?: unknown }).gc;
  if (typeof gc !== 'function') throw new Error('gc() not exposed: launch with --expose-gc');
  (gc as () => void)();
}

/**
 * Times a write with the probe on: its total, the stages of the store, and those of the codec for
 * the snapshot only (the biggest value encoded; a new row is encoded beside it).
 */
async function timedWrite(run: () => Promise<unknown>): Promise<[number, Map<WriteStage, number>]> {
  const spent = new Map<WriteStage, number>();
  let snapshotBytes = 0;
  const codec: [WriteStage, number, number][] = [];
  setWriteProbe((stage, ms, bytes) => {
    if (bytes === undefined) spent.set(stage, ms);
    else {
      codec.push([stage, ms, bytes]);
      snapshotBytes = Math.max(snapshotBytes, bytes);
    }
  });
  try {
    const ms = await time(run);
    for (const [stage, took, bytes] of codec) if (bytes === snapshotBytes) spent.set(stage, took);
    return [ms, spent];
  } finally {
    setWriteProbe(undefined);
  }
}

export interface MeasureOptions {
  readonly runs: number;
  readonly warmup: number;
}

export interface Measurement {
  readonly dbName: string;
  readonly incremental: number[];
  /** The stages of each write of `incremental`, in the same order (ms per write). */
  readonly incrementalStages: Stages;
  readonly noNewRound: number[];
  readonly allRounds: number[];
  readonly open: number[];
  /** The 1st, 2nd and 3rd writes of season 2, in this order. */
  readonly seasonTurn: [number[], number[], number[]];
  /** The stages of each write of `seasonTurn`, in the same order. */
  readonly seasonTurnStages: [Stages, Stages, Stages];
  /** Serialise + UTF-8 + hash of the snapshot (sheets apart), as it is stored (no gzip). */
  readonly encode: number[];
  readonly stringify: number[];
  readonly snapshotJsonBytes: number;
  /** Bytes the snapshot takes in IndexedDB (its JSON, no gzip) and in gzip (the exported file). */
  readonly snapshotStoredBytes: number;
  readonly snapshotGzipBytes: number;
  /** JSON and gzip bytes of the 38 rows of sheets together. */
  readonly sheetsJsonBytes: number;
  readonly sheetsGzipBytes: number;
}

let full: CareerSave | undefined;

/**
 * After the third write of season 2 no row of season 1 is left: the case did measure the prune.
 * Read with plain IndexedDB, outside the timing.
 */
async function checkTurnPruned(dbName: string, careerId: string): Promise<void> {
  const db = await openDB(dbName);
  try {
    const left = await db.count(
      'matchSheets',
      IDBKeyRange.bound([careerId], [careerId, 2], false, true),
    );
    if (left !== 0) throw new Error(`season turn: ${left} rows of season 1 left`);
  } finally {
    db.close();
  }
}

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
  // the slowdown.
  collectGarbage();
}

async function measure(options: MeasureOptions): Promise<Measurement> {
  if (full === undefined) throw new Error('prepare() first');
  const save = full;
  const store = new SaveStore();
  const total = options.warmup + options.runs;
  const keep = (list: number[], i: number, ms: number) => {
    if (i >= options.warmup) list.push(ms);
  };
  const keepStages = (into: Stages, i: number, spent: Map<WriteStage, number>) => {
    for (const stage of WRITE_STAGES) keep(into[stage], i, spent.get(stage) ?? 0);
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
  const incrementalStages = noStages();
  const noNewRound: number[] = [];
  for (let i = 0; i < total; i++) {
    const after38 = stamp(save, 2 * i + 1);
    const [ms, spent] = await timedWrite(
      async () => (last = await write(after38, before.sheets, 1)),
    );
    keep(incremental, i, ms);
    keepStages(incrementalStages, i, spent);
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

  // Each run starts the same: a clean career with season 1 written up to round 38 (untimed).
  const seasonTurn: [number[], number[], number[]] = [[], [], []];
  const seasonTurnStages: [Stages, Stages, Stages] = [noStages(), noStages(), noStages()];
  const turn = [0, 1, 2].map((played) => sampleAtRound(save, played, 2));
  for (let i = 0; i < total; i++) {
    const cleared = await store.deleteCareer(save.careerId);
    if (!cleared.ok) throw new Error(`deleteCareer: ${cleared.error}`);
    const at37 = await write(sampleAtRound(save, 37), undefined, 37);
    // The garbage of the preparation (deleting the career, writing 37 rows at once) is not the
    // turn's: on the device the write before the turn is a normal write of a round. Collected here;
    // the write of round 38 below is a normal write, and its garbage stays in the measurement.
    collectGarbage();
    let previous = await write(stamp(save, 4 * total + i), at37.sheets, 1);
    for (const [k, next] of turn.entries()) {
      const [ms, spent] = await timedWrite(
        async () => (previous = await write(next, previous.sheets, k === 0 ? 0 : 1)),
      );
      keep(seasonTurn[k]!, i, ms);
      keepStages(seasonTurnStages[k]!, i, spent);
    }
    if (i === 0) await checkTurnPruned(store.dbName, save.careerId);
  }

  const snapshot: CareerSave = { ...save, career: { ...save.career, matchSheets: {} } };
  const encode: number[] = [];
  const stringify: number[] = [];
  for (let i = 0; i < total; i++) {
    const next = stamp(snapshot, i);
    keep(encode, i, await time(() => encodeJson(next)));
    keep(stringify, i, await time(() => JSON.stringify(next)));
  }
  // Stored without gzip (T-072); its gzip is the size it takes in the exported file.
  const stored = await encodeJson(snapshot);
  if (!stored.ok) throw new Error(`encodeJson: ${stored.error}`);
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
    incrementalStages,
    noNewRound,
    allRounds,
    open,
    seasonTurn,
    seasonTurnStages,
    encode,
    stringify,
    snapshotJsonBytes: encoded.value.bytes,
    snapshotStoredBytes: stored.value.json.byteLength,
    snapshotGzipBytes: encoded.value.gzip.byteLength,
    sheetsJsonBytes,
    sheetsGzipBytes,
  };
}

(window as unknown as { measureSave: unknown }).measureSave = { prepare, measure };
