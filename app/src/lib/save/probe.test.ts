import { afterEach, describe, expect, it } from 'vitest';
import { setWriteProbe, type WriteStage } from './probe.ts';
import { atRound, store, useFreshDatabase } from './testing/idb.ts';

/*
 * The probe of the save measurement (T-072): each stage of a write reaches it once, the codec's
 * with the JSON bytes of the value encoded, and with no probe nothing is reported.
 */

useFreshDatabase();

afterEach(() => setWriteProbe(undefined));

describe('write probe (T-072)', () => {
  it('reports every stage of a write, the codec ones per value with its JSON bytes', async () => {
    const s = store();
    const first = await s.writeSnapshot(atRound(1));
    if (!first.ok) throw new Error(first.error);
    const seen: [WriteStage, number, number | undefined][] = [];
    setWriteProbe((stage, ms, bytes) => seen.push([stage, ms, bytes]));
    const written = await s.writeSnapshot(atRound(2), first.value.sheets);
    setWriteProbe(undefined);
    if (!written.ok) throw new Error(written.error);
    expect(written.value.writtenRounds).toEqual([2]);

    const ofStore = seen.filter(([, , bytes]) => bytes === undefined).map(([stage]) => stage);
    expect(ofStore).toEqual(['schema', 'encode', 'transaction', 'verify', 'prune']);
    // The snapshot and the row of round 2: four stages each.
    const codec = seen.filter(([, , bytes]) => bytes !== undefined);
    const sizes = [...new Set(codec.map(([, , bytes]) => bytes))];
    expect(sizes).toHaveLength(2);
    expect(sizes).toContain(written.value.bytes);
    for (const size of sizes) {
      expect(codec.filter(([, , bytes]) => bytes === size).map(([stage]) => stage)).toEqual([
        'stringify',
        'utf8',
        'sha256',
        'gzip',
      ]);
    }
    expect(seen.every(([, ms]) => ms >= 0)).toBe(true);
  });

  it('reports nothing once the probe is removed', async () => {
    const seen: WriteStage[] = [];
    setWriteProbe((stage) => seen.push(stage));
    setWriteProbe(undefined);
    expect((await store().writeSnapshot(atRound(1))).ok).toBe(true);
    expect(seen).toEqual([]);
  });
});
