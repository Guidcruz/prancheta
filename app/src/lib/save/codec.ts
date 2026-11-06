import { fail, ok, type SaveResult } from './result.ts';
import { reportStage, stageStart, stageTime } from './probe.ts';
import { MAX_SAVE_BYTES } from './schema.ts';

/*
 * Bytes of a save (docs/02-architecture.md, 4.2, "Gravação segura"): the UTF-8 JSON, its SHA-256
 * and, for what is stored compressed, its gzip, with the platform's `CompressionStream` and
 * `crypto.subtle` (browsers and Node 22, no dependency). The snapshot is stored on the device as
 * the UTF-8 JSON itself, without gzip ({@link encodeJson}, ADR-0006, note of T-072): its gzip was
 * more than half of the write. The rows of match sheets (one round each, "Súmulas fora do
 * snapshot") and the exported file (T-020) keep the gzip ({@link encodeSave}).
 *
 * `crypto.subtle` exists only in a secure context (HTTPS or localhost) and the compression streams
 * only from Safari 16.4: without them every encode and decode answers `unsupported-browser`
 * instead of throwing.
 */

export type Bytes = Uint8Array<ArrayBuffer>;

/** A save ready to be stored. */
export interface EncodedSave {
  /** SHA-256 of the JSON, lowercase hex. */
  readonly sha256: string;
  /** Length of the JSON in bytes. */
  readonly bytes: number;
  readonly gzip: Bytes;
}

/** A save ready to be stored without compression (the snapshot). */
export interface EncodedJson {
  /** SHA-256 of the JSON, lowercase hex. */
  readonly sha256: string;
  /** Length of the JSON in bytes: the bytes stored. */
  readonly bytes: number;
  /** The UTF-8 JSON, in a buffer of exactly its length (what IndexedDB copies). */
  readonly json: Bytes;
}

export type DecodeError = 'corrupt-gzip' | 'size-mismatch' | 'hash-mismatch' | 'corrupt-json';

/** The platform lacks `crypto.subtle` or the compression streams. */
export type UnsupportedError = 'unsupported-browser';

/** The JSON passes {@link MAX_SAVE_BYTES} (or the bound given). */
export type TooLargeError = 'too-large';

const encoder = new TextEncoder();

/** `true` when this platform has everything the codec uses. */
export function codecSupported(): boolean {
  return (
    typeof CompressionStream === 'function' &&
    typeof DecompressionStream === 'function' &&
    typeof globalThis.crypto?.subtle?.digest === 'function'
  );
}

/** Byte-by-byte equality: the check after a write compares the gzip read back with this one. */
export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false;
  return true;
}

export async function sha256Hex(data: Bytes): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  let hex = '';
  for (const byte of digest) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/** Reads a stream to the end, refusing (and cancelling it) past `maxBytes`. */
async function readAll(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Bytes | 'too-large'> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return 'too-large';
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * The bytes written straight into a (de)compression stream while its output is read (T-072: no
 * `Blob.stream()` in between, which cost about 9 ms per snapshot with 4× CPU slowdown). Throws
 * when the stream refuses the input (not a gzip, or truncated).
 */
async function transform(
  stream: CompressionStream | DecompressionStream,
  data: Bytes,
  maxBytes: number,
): Promise<Bytes | 'too-large'> {
  const writer = stream.writable.getWriter();
  // Read while writing: the stream holds back the writer until its output is taken. A failure of
  // the input also errors the output, which `readAll` rethrows; past `maxBytes` the reader is
  // cancelled and the writer fails, on purpose.
  const written = writer.write(data).then(() => writer.close());
  written.catch(() => undefined);
  const out = await readAll(stream.readable, maxBytes);
  if (out !== 'too-large') await written;
  return out;
}

export async function gzip(data: Bytes): Promise<Bytes> {
  const out = await transform(new CompressionStream('gzip'), data, Number.POSITIVE_INFINITY);
  // Unreachable with an infinite bound; keeps the type narrow.
  if (out === 'too-large') throw new Error('gzip: unbounded read refused');
  return out;
}

/**
 * The JSON as UTF-8, encoded once (T-072): straight into a buffer, without the copy and the garbage
 * of `TextEncoder.encode`. A save is almost all ASCII (one byte per UTF-16 code unit; accents take
 * two), so the buffer has an eighth of slack; a text that does not fit goes on in a buffer big
 * enough for the rest (at most 3 bytes per code unit; a surrogate pair takes 4 for its 2, and is
 * never split). The bytes are a view of that buffer: hashed, compressed and counted as they are.
 */
export function toUtf8(text: string): Bytes {
  let out = new Uint8Array(text.length + (text.length >> 3) + 16);
  const first = encoder.encodeInto(text, out);
  let written = first.written;
  if (first.read < text.length) {
    const head = out.subarray(0, written);
    out = new Uint8Array(written + (text.length - first.read) * 3);
    out.set(head);
    written += encoder.encodeInto(text.slice(first.read), out.subarray(written)).written;
  }
  return out.subarray(0, written);
}

/**
 * Decompresses a gzip, stopping as soon as the output passes `maxBytes` (the guard against a gzip
 * bomb). `corrupt-gzip`: not a gzip, or truncated.
 */
export async function gunzip(
  data: Bytes,
  maxBytes: number,
): Promise<SaveResult<Bytes, 'corrupt-gzip' | 'too-large'>> {
  try {
    const out = await transform(new DecompressionStream('gzip'), data, maxBytes);
    return out === 'too-large' ? fail('too-large', { maxBytes }) : ok(out);
  } catch {
    return fail('corrupt-gzip');
  }
}

/** A view as bytes of their own buffer: IndexedDB stores the whole buffer of a view. */
function tight(view: Bytes): Bytes {
  if (view.byteOffset === 0 && view.byteLength === view.buffer.byteLength) return view;
  const buffer = view.buffer as ArrayBuffer & { transfer?: (length: number) => ArrayBuffer };
  // `transfer` (where there is one) shrinks the buffer without a second copy.
  return view.byteOffset === 0 && typeof buffer.transfer === 'function'
    ? new Uint8Array(buffer.transfer(view.byteLength))
    : view.slice();
}

/**
 * The JSON of a value as UTF-8, with the time of each step. A JSON past `maxBytes` is refused
 * before hashing: it could never be opened again (the bound of the decoders).
 */
function jsonBytes(
  value: unknown,
  maxBytes: number,
): SaveResult<{ json: Bytes; stringified: number; encoded: number }, TooLargeError> {
  let start = stageStart();
  const text = JSON.stringify(value);
  const stringified = stageTime(start);
  // Every UTF-16 code unit takes at least one byte: a text this long is refused before the
  // buffer of `toUtf8` is sized for it, and without encoding it (`atLeast`, not `bytes`).
  if (text.length > maxBytes) return fail('too-large', { atLeast: text.length, maxBytes });
  start = stageStart();
  const json = toUtf8(text);
  const encoded = stageTime(start);
  if (json.byteLength > maxBytes) return fail('too-large', { bytes: json.byteLength, maxBytes });
  return ok({ json, stringified, encoded });
}

/**
 * Serialises and hashes a save to be stored as it is, without compression (the snapshot, T-072):
 * the JSON becomes bytes once, and the same bytes are hashed, counted and stored. `maxBytes`
 * bounds the bytes stored.
 */
export async function encodeJson(
  value: unknown,
  maxBytes: number = MAX_SAVE_BYTES,
): Promise<SaveResult<EncodedJson, UnsupportedError | TooLargeError>> {
  if (!codecSupported()) return fail('unsupported-browser');
  const utf8 = jsonBytes(value, maxBytes);
  if (!utf8.ok) return utf8;
  let start = stageStart();
  const json = tight(utf8.value.json);
  const encoded = utf8.value.encoded + stageTime(start);
  start = stageStart();
  const sha256 = await sha256Hex(json);
  const hashed = stageTime(start);
  reportStage('stringify', utf8.value.stringified, json.byteLength);
  reportStage('utf8', encoded, json.byteLength);
  reportStage('sha256', hashed, json.byteLength);
  return ok({ sha256, bytes: json.byteLength, json });
}

/**
 * Serialises, hashes and compresses a save (a round of match sheets, the exported file). The JSON
 * becomes bytes once, and the same bytes are hashed, compressed and counted (T-072). A JSON past
 * `maxBytes` is refused before hashing.
 */
export async function encodeSave(
  save: unknown,
  maxBytes: number = MAX_SAVE_BYTES,
): Promise<SaveResult<EncodedSave, UnsupportedError | TooLargeError>> {
  if (!codecSupported()) return fail('unsupported-browser');
  const utf8 = jsonBytes(save, maxBytes);
  if (!utf8.ok) return utf8;
  const { json, stringified, encoded } = utf8.value;
  const start = stageStart();
  let hashed = 0;
  let compressedIn = 0;
  const [sha256, compressed] = await Promise.all([
    sha256Hex(json).finally(() => (hashed = stageTime(start))),
    gzip(json).finally(() => (compressedIn = stageTime(start))),
  ]);
  reportStage('stringify', stringified, json.byteLength);
  reportStage('utf8', encoded, json.byteLength);
  reportStage('sha256', hashed, json.byteLength);
  reportStage('gzip', compressedIn, json.byteLength);
  return ok({ sha256, bytes: json.byteLength, gzip: compressed });
}

/**
 * The inverse of {@link encodeSave}, checked: the gzip must give exactly `bytes` bytes, their
 * SHA-256 must be `sha256`, and they must be UTF-8 JSON. The value is not validated here (that is
 * the schema's job, after the migration).
 */
export async function decodeSave(
  data: Bytes,
  sha256: string,
  bytes: number,
): Promise<SaveResult<unknown, DecodeError | UnsupportedError>> {
  if (!codecSupported()) return fail('unsupported-browser');
  const raw = await gunzip(data, bytes);
  // Inflating past `bytes` is a wrong size, found without inflating the rest.
  if (!raw.ok) {
    return raw.error === 'too-large' ? fail('size-mismatch', { bytes }) : fail('corrupt-gzip');
  }
  return parseChecked(raw.value, sha256, bytes);
}

/**
 * The inverse of {@link encodeJson}, checked: exactly `bytes` bytes (else refused before hashing,
 * so a record past the bound is never read), whose SHA-256 is `sha256`, and UTF-8 JSON. The value
 * is not validated here.
 */
export async function decodeJson(
  data: Bytes,
  sha256: string,
  bytes: number,
): Promise<SaveResult<unknown, DecodeError | UnsupportedError>> {
  if (!codecSupported()) return fail('unsupported-browser');
  return parseChecked(data, sha256, bytes);
}

async function parseChecked(
  json: Bytes,
  sha256: string,
  bytes: number,
): Promise<SaveResult<unknown, DecodeError>> {
  if (json.byteLength !== bytes) return fail('size-mismatch', { bytes, got: json.byteLength });
  if ((await sha256Hex(json)) !== sha256) return fail('hash-mismatch');
  try {
    return ok(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(json)));
  } catch {
    return fail('corrupt-json');
  }
}
