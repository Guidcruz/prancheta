import { fail, ok, type SaveResult } from './result.ts';
import { reportStage, stageStart, stageTime } from './probe.ts';
import { MAX_SAVE_BYTES } from './schema.ts';

/*
 * Bytes of a save (docs/02-architecture.md, 4.2, "Gravação segura"): the UTF-8 JSON, its SHA-256
 * and its gzip, with the platform's `CompressionStream` and `crypto.subtle` (browsers and Node 22,
 * no dependency). The exported file (T-020) reuses the same three steps. The same codec stores the
 * rows of match sheets (one round each, "Súmulas fora do snapshot").
 *
 * `crypto.subtle` exists only in a secure context (HTTPS or localhost) and the compression streams
 * only from Safari 16.4: without them {@link encodeSave} and {@link decodeSave} answer
 * `unsupported-browser` instead of throwing.
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

/** The bytes as a stream that the (de)compression streams accept. */
function streamOf(data: Bytes): ReadableStream<BufferSource> {
  return new Blob([data]).stream();
}

export async function gzip(data: Bytes): Promise<Bytes> {
  const out = await readAll(
    streamOf(data).pipeThrough(new CompressionStream('gzip')),
    Number.POSITIVE_INFINITY,
  );
  // Unreachable with an infinite bound; keeps the type narrow.
  if (out === 'too-large') throw new Error('gzip: unbounded read refused');
  return out;
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
    const out = await readAll(
      streamOf(data).pipeThrough(new DecompressionStream('gzip')),
      maxBytes,
    );
    return out === 'too-large' ? fail('too-large', { maxBytes }) : ok(out);
  } catch {
    return fail('corrupt-gzip');
  }
}

/**
 * Serialises, hashes and compresses a save (or a round of match sheets). A JSON past `maxBytes` is
 * refused before hashing: it could never be opened again (the bound of {@link decodeSave}).
 */
export async function encodeSave(
  save: unknown,
  maxBytes: number = MAX_SAVE_BYTES,
): Promise<SaveResult<EncodedSave, UnsupportedError | TooLargeError>> {
  if (!codecSupported()) return fail('unsupported-browser');
  let start = stageStart();
  const text = JSON.stringify(save);
  const stringified = stageTime(start);
  start = stageStart();
  const json = encoder.encode(text);
  const encoded = stageTime(start);
  if (json.byteLength > maxBytes) return fail('too-large', { bytes: json.byteLength, maxBytes });
  start = stageStart();
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
  if (raw.value.byteLength !== bytes) {
    return fail('size-mismatch', { bytes, got: raw.value.byteLength });
  }
  if ((await sha256Hex(raw.value)) !== sha256) return fail('hash-mismatch');
  try {
    return ok(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw.value)));
  } catch {
    return fail('corrupt-json');
  }
}
