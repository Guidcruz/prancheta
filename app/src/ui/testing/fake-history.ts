/*
 * A History in memory for the tests (they have no DOM): a stack of entries with their state and
 * address, `back()` moving down one entry and calling the `popstate` listeners, as the browser
 * does (here synchronously).
 */

interface Entry {
  readonly state: unknown;
  readonly url: string;
}

export class FakeHistory {
  private entries: Entry[];
  private index = 0;
  private readonly listeners = new Set<() => void>();

  constructor(url = '/jogo/') {
    this.entries = [{ state: null, url }];
  }

  get state(): unknown {
    return this.entries[this.index]!.state;
  }

  get length(): number {
    return this.index + 1;
  }

  get url(): string {
    return this.entries[this.index]!.url;
  }

  /** The `Location` parts read by the moves: hash, pathname and search of the current entry. */
  get location(): { hash: string; pathname: string; search: string } {
    const url = new URL(this.url, 'https://example.test');
    return { hash: url.hash, pathname: url.pathname, search: url.search };
  }

  pushState(state: unknown, _unused: string, url?: string | URL | null): void {
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push({ state, url: this.resolve(url) });
    this.index++;
  }

  replaceState(state: unknown, _unused: string, url?: string | URL | null): void {
    this.entries[this.index] = { state, url: this.resolve(url) };
  }

  back(): void {
    this.go(-1);
  }

  /** Moves `delta` entries (only within the stack) and calls the `popstate` listeners once. */
  go(delta = 0): void {
    const to = Math.min(Math.max(this.index + delta, 0), this.entries.length - 1);
    if (to === this.index) return;
    this.index = to;
    for (const listener of this.listeners) listener();
  }

  onPop(listener: () => void): void {
    this.listeners.add(listener);
  }

  private resolve(url: string | URL | null | undefined): string {
    if (url === undefined || url === null) return this.url;
    return new URL(String(url), new URL(this.url, 'https://example.test')).href.replace(
      'https://example.test',
      '',
    );
  }
}
