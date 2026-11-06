import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  codecSupported,
  decodeSave,
  encodeSave,
  equalBytes,
  gunzip,
  gzip,
  sha256Hex,
  type Bytes,
  type EncodedSave,
} from './codec.ts';

const utf8 = (text: string): Bytes => new TextEncoder().encode(text);

async function encode(value: unknown): Promise<EncodedSave> {
  const result = await encodeSave(value);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('save codec', () => {
  it('hashes with SHA-256 in lowercase hex', async () => {
    expect(await sha256Hex(utf8('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('round-trips a save through JSON, hash and gzip', async () => {
    const save = { careerId: 'x', text: 'Pressão alta, 3×1 ⚽', list: [1, 2, 3] };
    const encoded = await encode(save);
    const json = utf8(JSON.stringify(save));
    expect(encoded.bytes).toBe(json.byteLength);
    expect(encoded.sha256).toBe(await sha256Hex(json));
    // A real gzip: Node's zlib reads it.
    expect(encoded.gzip[0]).toBe(0x1f);
    expect(encoded.gzip[1]).toBe(0x8b);
    const decoded = await decodeSave(encoded.gzip, encoded.sha256, encoded.bytes);
    expect(decoded).toEqual({ ok: true, value: save });
  });

  it('refuses what is not a gzip, and a truncated gzip', async () => {
    const encoded = await encode({ a: 'b'.repeat(5000) });
    expect(await decodeSave(utf8('not a gzip'), encoded.sha256, encoded.bytes)).toEqual({
      ok: false,
      error: 'corrupt-gzip',
    });
    const truncated = encoded.gzip.slice(0, encoded.gzip.byteLength - 12);
    const result = await decodeSave(truncated, encoded.sha256, encoded.bytes);
    expect(result.ok).toBe(false);
  });

  it('refuses a size or a hash that does not match', async () => {
    const encoded = await encode({ a: 1 });
    const short = await decodeSave(encoded.gzip, encoded.sha256, encoded.bytes - 1);
    expect(short.ok === false && short.error).toBe('size-mismatch');
    const long = await decodeSave(encoded.gzip, encoded.sha256, encoded.bytes + 1);
    expect(long.ok === false && long.error).toBe('size-mismatch');
    const other = await decodeSave(encoded.gzip, '0'.repeat(64), encoded.bytes);
    expect(other.ok === false && other.error).toBe('hash-mismatch');
  });

  it('refuses bytes that hash right but are not JSON (a save truncated before hashing)', async () => {
    const text = utf8('{"careerId":"x","game":{');
    const result = await decodeSave(await gzip(text), await sha256Hex(text), text.byteLength);
    expect(result.ok === false && result.error).toBe('corrupt-json');
    const notUtf8 = new Uint8Array([0x22, 0xff, 0x22]);
    const bad = await decodeSave(await gzip(notUtf8), await sha256Hex(notUtf8), 3);
    expect(bad.ok === false && bad.error).toBe('corrupt-json');
  });

  it('stops a gzip bomb at the limit instead of inflating it', async () => {
    const bomb = new Uint8Array(gzipSync(Buffer.alloc(8 * 1024 * 1024)));
    expect(bomb.byteLength).toBeLessThan(16 * 1024);
    const result = await gunzip(bomb, 1024 * 1024);
    expect(result.ok === false && result.error).toBe('too-large');
    expect((await gunzip(bomb, 8 * 1024 * 1024)).ok).toBe(true);
  });

  it('refuses a JSON past the size bound before hashing it', async () => {
    const result = await encodeSave({ a: 'x'.repeat(100) }, 50);
    expect(result).toEqual({ ok: false, error: 'too-large', detail: { bytes: 108, maxBytes: 50 } });
    expect((await encodeSave({ a: 'x' }, 50)).ok).toBe(true);
  });

  it('compares bytes one by one', () => {
    expect(equalBytes(utf8('abc'), utf8('abc'))).toBe(true);
    expect(equalBytes(utf8('abc'), utf8('abd'))).toBe(false);
    expect(equalBytes(utf8('abc'), utf8('ab'))).toBe(false);
    expect(equalBytes(new Uint8Array(0), new Uint8Array(0))).toBe(true);
  });

  it.each([
    ['crypto.subtle (HTTP outside localhost)', 'crypto', {}],
    ['CompressionStream (Safari < 16.4)', 'CompressionStream', undefined],
    ['DecompressionStream (Safari < 16.4)', 'DecompressionStream', undefined],
  ])('answers unsupported-browser without %s, instead of throwing', async (_label, name, value) => {
    const encoded = await encode({ a: 1 });
    vi.stubGlobal(name, value);
    expect(codecSupported()).toBe(false);
    expect(await encodeSave({ a: 1 })).toEqual({ ok: false, error: 'unsupported-browser' });
    expect(await decodeSave(encoded.gzip, encoded.sha256, encoded.bytes)).toEqual({
      ok: false,
      error: 'unsupported-browser',
    });
    vi.unstubAllGlobals();
    expect(codecSupported()).toBe(true);
  });
});
