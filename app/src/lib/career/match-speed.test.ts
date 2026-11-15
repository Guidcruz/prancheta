import { describe, expect, it, vi } from 'vitest';
import { ErrorLog } from '../errors/index.ts';
import { SAVE_FIELD_NAMES } from '../save/index.ts';
import { store, useFreshDatabase } from '../save/testing/idb.ts';
import { MATCH_SPEEDS, MATCH_SPEED_KEY, parseMatchSpeed } from './match-speed.ts';
import { CareerService } from './service.ts';

/*
 * The speed of the match clock in the `kv` store (T-032; docs/02-architecture.md, 4.1, "Partida
 * assistida pela camada de carreira", item 4): both values go and come back; absent, unknown or
 * a failed read give `'normal'`; a failed write is only logged. No career needs to be open.
 */

useFreshDatabase();

const VERSIONS = { appVersion: '0.0.1', schemaVersion: 3, engineVersion: 1 };

function harness() {
  const s = store();
  const log = new ErrorLog(VERSIONS, s, { fields: SAVE_FIELD_NAMES });
  return { s, log, service: new CareerService({ store: s, log, appVersion: '0.0.1' }) };
}

describe('parseMatchSpeed', () => {
  it('knows the two speeds and nothing else', () => {
    expect(MATCH_SPEEDS).toEqual(['normal', 'fast']);
    for (const speed of MATCH_SPEEDS) expect(parseMatchSpeed(speed)).toBe(speed);
    for (const other of [undefined, null, '', 'turbo', 1, { speed: 'fast' }]) {
      expect(parseMatchSpeed(other)).toBeUndefined();
    }
  });
});

describe('matchSpeed and rememberMatchSpeed', () => {
  it('without a value the speed is normal; each value written comes back', async () => {
    const { service } = harness();
    expect(await service.matchSpeed()).toBe('normal');
    await service.rememberMatchSpeed('fast');
    expect(await service.matchSpeed()).toBe('fast');
    await service.rememberMatchSpeed('normal');
    expect(await service.matchSpeed()).toBe('normal');
  });

  it('the value stored is the string itself, under match.speed', async () => {
    const { s, service } = harness();
    await service.rememberMatchSpeed('fast');
    expect(await s.readKv(MATCH_SPEED_KEY)).toEqual({ ok: true, value: 'fast' });
  });

  it('an unknown value (a newer build) is normal, with nothing logged', async () => {
    const { s, log, service } = harness();
    await s.writeKv(MATCH_SPEED_KEY, 'turbo');
    expect(await service.matchSpeed()).toBe('normal');
    expect(await log.list()).toEqual([]);
  });

  it('a failed read is normal and logged as storage', async () => {
    const { s, log, service } = harness();
    vi.spyOn(s, 'readKv').mockResolvedValueOnce({ ok: false, error: 'read-failed' });
    expect(await service.matchSpeed()).toBe('normal');
    expect((await log.list()).at(-1)).toMatchObject({
      kind: 'storage',
      code: 'read-failed',
      screen: MATCH_SPEED_KEY,
    });
  });

  it('a failed write is only logged', async () => {
    const { s, log, service } = harness();
    vi.spyOn(s, 'writeKv').mockResolvedValueOnce({ ok: false, error: 'quota-exceeded' });
    await expect(service.rememberMatchSpeed('fast')).resolves.toBeUndefined();
    expect((await log.list()).at(-1)).toMatchObject({
      kind: 'storage',
      code: 'quota-exceeded',
      screen: MATCH_SPEED_KEY,
    });
    expect(await service.matchSpeed()).toBe('normal');
  });
});
