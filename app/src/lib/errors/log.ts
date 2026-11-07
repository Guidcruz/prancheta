/*
 * The local error log (US-045; docs/02-architecture.md, 3, "lib/errors"; decision P11). On the
 * device only: no request is ever made to record an error. A row has the app, save and engine
 * versions, the kind and code of the error, the screen, the type and the stack of an exception
 * reduced to function, file, line and column, and, for a save that failed the schema, the path
 * and kind of the problem. It never has the coach's nickname, the content of a save, the
 * `message` of an exception, an IP or an identifier of the device: every text that enters is cut
 * to a closed alphabet and length, and what does not fit becomes `*`.
 *
 * The ring of {@link ERROR_LOG_SIZE} lives in the `errors` store of the database (through the
 * sink the application layer passes, lib/save's `SaveStore`), and a copy of the newest rows stays
 * in memory for when IndexedDB is not available. Recording never throws and never waits on the
 * caller: a failure to store an error is not recorded again.
 */

/** Rows kept (US-045, "limite do registro local"); the oldest go first. */
export const ERROR_LOG_SIZE = 50;

/** Frames of a stack kept in a row. */
export const STACK_FRAMES = 12;

/** `storage`: a code the save layer returned. `programming`: a bug (an exception, a bad save). */
export type ErrorKind = 'storage' | 'programming';

/** A row of the log, as stored and as the support report copies it. */
export type ErrorEntry = {
  readonly kind: ErrorKind;
  /** A stable code: a `SaveStore` code, `unexpected`, `invalid-save`, an engine error... */
  readonly code: string;
  /** Where it happened: a screen id or an operation of the career (`career.play`). */
  readonly screen?: string;
  /** The `name` of the exception (`TypeError`), never its message. */
  readonly type?: string;
  /** For a save that failed the schema: the dotted path, record keys as `*`. */
  readonly path?: string;
  readonly problem?: string;
  /** Flat diagnostics: numbers, booleans and short codes only. */
  readonly detail?: Readonly<Record<string, string | number | boolean>>;
  /** `function@file:line:column`, the file without its address. */
  readonly stack?: readonly string[];
  readonly appVersion: string;
  readonly schemaVersion: number;
  readonly engineVersion: number;
};

/** What a caller reports; {@link ErrorLog.record} reduces it to an {@link ErrorEntry}. */
export interface ErrorReport {
  readonly kind: ErrorKind;
  readonly code: string;
  readonly screen?: string;
  /** The exception, read only for its `name` and its stack frames. */
  readonly error?: unknown;
  readonly path?: string;
  readonly problem?: string;
  /** Only its own flat fields that are numbers, booleans or short codes are kept. */
  readonly detail?: unknown;
}

/** Where the rows are kept: the `errors` store, through lib/save's `SaveStore`. */
export interface ErrorSink {
  appendError(entry: ErrorEntry, keep: number): Promise<{ readonly ok: boolean }>;
  listErrors(): Promise<
    { readonly ok: true; readonly value: readonly unknown[] } | { readonly ok: false }
  >;
}

export interface ErrorLogVersions {
  readonly appVersion: string;
  readonly schemaVersion: number;
  readonly engineVersion: number;
}

/** A code or a name: letters, digits and `_ . : / -`, at most 60 characters. */
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,59}$/;
/**
 * The keys of `detail` that are kept: the diagnostics the save layer (`fail(...)` of store.ts and
 * codec.ts) and the engine return. Any other key is dropped, whatever its value.
 */
export const DETAIL_KEYS: ReadonlySet<string> = new Set([
  'name',
  'problem',
  'rolledBack',
  'expectedHeadSeq',
  'headSeq',
  'bytes',
  'maxBytes',
  'atLeast',
  'got',
  'max',
  'snapshots',
  'seq',
  'fromVersion',
  'version',
  'round',
  'next',
]);
/** A string value of `detail`: a kebab-case code, or the name of a DOM or JS error. */
const DETAIL_CODE = /^[a-z][a-z0-9-]{0,59}$/;
const DETAIL_ERROR_NAME = /^[A-Z][A-Za-z]{0,55}Error$/;
const PATH_SEGMENTS = 16;

/** `value` when it is a short code, otherwise `*`. */
export function cleanToken(value: unknown): string {
  return typeof value === 'string' && TOKEN.test(value) ? value : '*';
}

/**
 * A save path with only the field names of the format (`fields`, from the save schema) and array
 * indices: every other segment (the id of a club, player or match, a key a hostile file brought,
 * `<key>`) becomes `*`. Without `fields`, every segment that is not an index does.
 */
export function cleanPath(path: unknown, fields: ReadonlySet<string> = new Set()): string {
  if (typeof path !== 'string' || path === '') return '';
  const segments = path.split('.').slice(0, PATH_SEGMENTS);
  return segments.map((s) => (/^\d{1,6}$/.test(s) || fields.has(s) ? s : '*')).join('.');
}

/**
 * The flat, safe part of a `detail`: the keys of {@link DETAIL_KEYS} whose value is a finite
 * number, a boolean, a kebab-case code or an error name (`QuotaExceededError`).
 */
export function cleanDetail(
  detail: unknown,
): Record<string, string | number | boolean> | undefined {
  if (typeof detail !== 'object' || detail === null || Array.isArray(detail)) return undefined;
  const out: Record<string, string | number | boolean> = {};
  let kept = 0;
  for (const key of Object.keys(detail)) {
    if (!DETAIL_KEYS.has(key)) continue;
    let value: unknown;
    try {
      value = (detail as Record<string, unknown>)[key];
    } catch {
      continue;
    }
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      out[key] = value;
    } else if (
      typeof value === 'string' &&
      (DETAIL_CODE.test(value) || DETAIL_ERROR_NAME.test(value))
    ) {
      out[key] = value;
    } else {
      continue;
    }
    kept++;
  }
  return kept === 0 ? undefined : out;
}

/** The `name` of an exception, when it is a short code. */
export function errorType(error: unknown): string | undefined {
  try {
    if (typeof error === 'object' && error !== null && 'name' in error) {
      const name = (error as { name: unknown }).name;
      return typeof name === 'string' && TOKEN.test(name) ? name : '*';
    }
    return error === undefined ? undefined : typeof error;
  } catch {
    return '*';
  }
}

const V8_FRAME = /^\s+at\s+(?:(\S+)\s+\()?(.*?)\)?$/;
const OTHER_FRAME = /^([^@\s]*)@(.*)$/;
const LOCATION = /([A-Za-z0-9_.-]+?\.(?:[cm]?js|ts|svelte))(?:\?[^:]*)?:(\d{1,7}):(\d{1,7})$/;
const FUNCTION = /^[A-Za-z0-9_$.<>[\]]{1,60}$/;

/**
 * The frames of a stack as `function@file:line:column`: the file name without its address or
 * query, the function only when it is an identifier. Only lines that are frames are read (V8's
 * `    at ...`, and `function@location` of Firefox and Safari), so the first line of a V8 stack,
 * which repeats the message, never enters.
 */
export function cleanStack(error: unknown): string[] | undefined {
  let stack: unknown;
  try {
    stack = (error as { stack?: unknown } | null)?.stack;
  } catch {
    return undefined;
  }
  if (typeof stack !== 'string') return undefined;
  const frames: string[] = [];
  for (const line of withoutMessage(stack, error).split('\n')) {
    if (frames.length >= STACK_FRAMES) break;
    const frame = V8_FRAME.exec(line) ?? OTHER_FRAME.exec(line.trim());
    if (frame === null) continue;
    const where = LOCATION.exec(frame[2] ?? '');
    if (where === null) continue;
    const fn = frame[1] !== undefined && FUNCTION.test(frame[1]) ? frame[1] : '';
    frames.push(`${fn}@${where[1]}:${where[2]}:${where[3]}`);
  }
  return frames.length === 0 ? undefined : frames;
}

/**
 * The stack without the `${name}: ${message}` that V8 puts first: a message of several lines
 * could hold text that looks like a frame. The message is read only to cut it, never kept.
 */
function withoutMessage(stack: string, error: unknown): string {
  try {
    const { name, message } = error as { name?: unknown; message?: unknown };
    if (typeof message !== 'string' || message === '') return stack;
    const head = `${typeof name === 'string' ? name : 'Error'}: ${message}`;
    if (stack.startsWith(head)) return stack.slice(head.length);
    // A message of several lines elsewhere in the stack: keep only what comes after it.
    const at = message.includes('\n') ? stack.lastIndexOf(message) : -1;
    return at === -1 ? stack : stack.slice(at + message.length);
  } catch {
    return '';
  }
}

/** A stored row read back, when it has the shape of an {@link ErrorEntry}. */
function asEntry(row: unknown): ErrorEntry | undefined {
  if (typeof row !== 'object' || row === null) return undefined;
  const r = row as Record<string, unknown>;
  if (typeof r.code !== 'string' || (r.kind !== 'storage' && r.kind !== 'programming')) return;
  const { id: _id, ...entry } = r;
  void _id;
  return entry as unknown as ErrorEntry;
}

export class ErrorLog {
  private readonly memory: ErrorEntry[] = [];
  private pending: Promise<unknown> = Promise.resolve();
  private readonly versions: ErrorLogVersions;
  private readonly sink: ErrorSink | undefined;
  private readonly fields: ReadonlySet<string>;

  /**
   * `fields`: the field names of the save format, kept in a path (lib/save's
   * `SAVE_FIELD_NAMES`); every other segment of a path is logged as `*`.
   */
  constructor(
    versions: ErrorLogVersions,
    sink?: ErrorSink,
    options: { readonly fields?: ReadonlySet<string> } = {},
  ) {
    this.versions = versions;
    this.sink = sink;
    this.fields = options.fields ?? new Set();
  }

  /** The row a report becomes (exposed for the tests and the support report). */
  entryOf(report: ErrorReport): ErrorEntry {
    const type = report.error === undefined ? undefined : errorType(report.error);
    const stack = report.error === undefined ? undefined : cleanStack(report.error);
    const path = report.path === undefined ? undefined : cleanPath(report.path, this.fields);
    const detail = cleanDetail(report.detail);
    return {
      kind: report.kind,
      code: cleanToken(report.code),
      ...(report.screen === undefined ? {} : { screen: cleanToken(report.screen) }),
      ...(type === undefined ? {} : { type }),
      ...(path === undefined ? {} : { path }),
      ...(report.problem === undefined ? {} : { problem: cleanToken(report.problem) }),
      ...(detail === undefined ? {} : { detail }),
      ...(stack === undefined ? {} : { stack }),
      appVersion: cleanToken(this.versions.appVersion),
      schemaVersion: this.versions.schemaVersion,
      engineVersion: this.versions.engineVersion,
    };
  }

  /** Records a report; resolves when it is stored (or could not be). Never throws. */
  record(report: ErrorReport): Promise<void> {
    let entry: ErrorEntry;
    try {
      entry = this.entryOf(report);
    } catch {
      return Promise.resolve();
    }
    this.memory.push(entry);
    if (this.memory.length > ERROR_LOG_SIZE)
      this.memory.splice(0, this.memory.length - ERROR_LOG_SIZE);
    const sink = this.sink;
    if (sink === undefined) return Promise.resolve();
    const next = this.pending
      .then(() => sink.appendError(entry, ERROR_LOG_SIZE))
      .catch(() => undefined);
    this.pending = next;
    return next.then(() => undefined);
  }

  /**
   * The rows, the oldest first: the stored ring, or the ones of this session when the database
   * cannot be read.
   */
  async list(): Promise<ErrorEntry[]> {
    await this.pending;
    if (this.sink !== undefined) {
      try {
        const stored = await this.sink.listErrors();
        if (stored.ok) {
          return stored.value.map(asEntry).filter((e): e is ErrorEntry => e !== undefined);
        }
      } catch {
        // Fall back to this session's rows.
      }
    }
    return [...this.memory];
  }
}
