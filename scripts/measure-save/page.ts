import { SaveStore, encodeSave, type CareerSave } from '../../app/src/lib/save/index.ts';
import { sampleCareerSave } from '../../app/src/lib/save/testing/sample.ts';

/*
 * Page of the write measurement (scripts/measure-save.ts; ADR-0019, "gatilho do store próprio"),
 * bundled by Vite with PRANCHETA_ENV=test and run in headless Chromium. `prepare` builds the
 * end-of-season save before the CPU slowdown is turned on; `measure` then times the whole safe
 * write of the store (serialise, hash, gzip, transaction, read back, check, prune) on the test
 * database, and the parts the store cannot see from outside (stringify, encode).
 */

export interface MeasureOptions {
  readonly runs: number;
  readonly warmup: number;
}

export interface Timings {
  readonly write: number[];
  readonly encode: number[];
  readonly stringify: number[];
  readonly jsonBytes: number;
  readonly gzipBytes: number;
}

export interface Measurement {
  readonly dbName: string;
  readonly full: Timings;
  /** The same save with `matchSheets: {}`: what a store of their own would leave in the snapshot. */
  readonly withoutSheets: Timings;
}

let full: CareerSave | undefined;

async function time(run: () => unknown): Promise<number> {
  const start = performance.now();
  await run();
  return performance.now() - start;
}

async function timings(save: CareerSave, options: MeasureOptions): Promise<Timings> {
  const store = new SaveStore();
  const write: number[] = [];
  const encode: number[] = [];
  const stringify: number[] = [];
  for (let i = 0; i < options.warmup + options.runs; i++) {
    const next = { ...save, updatedAt: new Date(Date.UTC(2026, 10, 6, 12, 0, i)).toISOString() };
    const w = await time(async () => {
      const result = await store.writeSnapshot(next);
      if (!result.ok) throw new Error(`writeSnapshot: ${result.error}`);
    });
    const e = await time(() => encodeSave(next));
    const s = await time(() => JSON.stringify(next));
    if (i >= options.warmup) {
      write.push(w);
      encode.push(e);
      stringify.push(s);
    }
  }
  const encoded = await encodeSave(save);
  await store.deleteCareer(save.careerId);
  await store.close();
  return {
    write,
    encode,
    stringify,
    jsonBytes: encoded.bytes,
    gzipBytes: encoded.gzip.byteLength,
  };
}

async function prepare(): Promise<void> {
  full = sampleCareerSave({ rounds: 38 });
}

async function measure(options: MeasureOptions): Promise<Measurement> {
  if (full === undefined) throw new Error('prepare() first');
  const withoutSheets: CareerSave = { ...full, career: { ...full.career, matchSheets: {} } };
  return {
    dbName: new SaveStore().dbName,
    full: await timings(full, options),
    withoutSheets: await timings(withoutSheets, options),
  };
}

(window as unknown as { measureSave: unknown }).measureSave = { prepare, measure };
