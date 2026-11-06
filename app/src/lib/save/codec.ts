import { fail, ok, type SaveResult } from './result.ts';

/*
 * Bytes of a save (docs/02-architecture.md, 4.2, "Gravação segura"): the UTF-8 JSON, its SHA-256
 * and its gzip, with the platform's `CompressionStream` and `crypto.subtle` (browsers and Node 22,
 * no dependency). The exported file (T-020) reuses the same three steps.
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

const encoder = new TextEncoder();

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

/** Serialises, hashes and compresses a save. */
export async function encodeSave(save: unknown): Promise<EncodedSave> {
  const json = encoder.encode(JSON.stringify(save));
  const [sha256, compressed] = await Promise.all([sha256Hex(json), gzip(json)]);
  return { sha256, bytes: json.byteLength, gzip: compressed };
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
): Promise<SaveResult<unknown, DecodeError>> {
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
