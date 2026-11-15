/*
 * A part of the game loaded on demand (docs/02-architecture.md, 4.7, "Os imports dinâmicos"): the
 * first call starts `load` and every later call gets the same promise, so a chunk is asked once
 * per session; a failure is forgotten, so the next call tries again (a chunk missing from the
 * cache, a network back). Pure: the `import()` comes in.
 */
export function lazyChunk<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    if (pending !== undefined) return pending;
    const asked = load();
    pending = asked;
    asked.catch(() => {
      if (pending === asked) pending = undefined;
    });
    return asked;
  };
}
