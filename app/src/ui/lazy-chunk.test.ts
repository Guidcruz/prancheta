import { describe, expect, it } from 'vitest';
import { lazyChunk } from './lazy-chunk';

/* The loader of the chunks of the match (docs/02-architecture.md, 4.7). */

describe('lazyChunk', () => {
  it('asks once and gives every caller the same promise', async () => {
    let calls = 0;
    const load = lazyChunk(() => {
      calls++;
      return Promise.resolve({ value: calls });
    });
    const a = load();
    const b = load();
    expect(a).toBe(b);
    expect(await a).toEqual({ value: 1 });
    expect(await load()).toEqual({ value: 1 });
    expect(calls).toBe(1);
  });

  it('forgets a failure: the next call asks again', async () => {
    let calls = 0;
    const load = lazyChunk(() => {
      calls++;
      return calls === 1 ? Promise.reject(new Error('offline')) : Promise.resolve('module');
    });
    const first = load();
    expect(load()).toBe(first);
    await expect(first).rejects.toThrow('offline');
    await expect(load()).resolves.toBe('module');
    await expect(load()).resolves.toBe('module');
    expect(calls).toBe(2);
  });

  it('does not ask before the first call', () => {
    let calls = 0;
    lazyChunk(() => {
      calls++;
      return Promise.resolve();
    });
    expect(calls).toBe(0);
  });
});
