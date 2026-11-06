import { describe, expect, it, vi } from 'vitest';
import { main, parseArgs } from './main.ts';
import {
  OPEN_TARGET_MS,
  WRITE_LIMIT_MS,
  formatReport,
  openWithinTarget,
  stats,
  withinLimit,
  type MeasurementLike,
} from './report.ts';

const measurement = (incremental: number[], open = [200, 210, 220]): MeasurementLike => ({
  dbName: 'prancheta-test',
  incremental,
  noNewRound: incremental.map((n) => n - 5),
  allRounds: incremental.map((n) => n * 2),
  open,
  encode: incremental.map((n) => n / 2),
  stringify: incremental.map((n) => n / 4),
  snapshotJsonBytes: 700_000,
  snapshotGzipBytes: 100_000,
  sheetsJsonBytes: 840_000,
  sheetsGzipBytes: 80_000,
});

describe('measure-save report', () => {
  it('computes median, p90 and max', () => {
    expect(stats([5])).toEqual({ median: 5, p90: 5, max: 5 });
    expect(stats([4, 1, 3, 2])).toEqual({ median: 2.5, p90: 4, max: 4 });
    const ten = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(stats(ten)).toEqual({ median: 55, p90: 90, max: 100 });
    expect(() => stats([])).toThrow();
  });

  it('decides by the p90 of the write after round 38 against 150 ms', () => {
    expect(WRITE_LIMIT_MS).toBe(150);
    const ten = (last: number) => [90, 95, 100, 100, 105, 110, 115, 120, 150, last];
    // The p90 of 10 values is the 9th: one slow write does not fail it, two do.
    expect(withinLimit(measurement(ten(400)))).toBe(true);
    expect(withinLimit(measurement([...ten(400).slice(0, 8), 151, 400]))).toBe(false);
    // A low median does not save a high p90.
    expect(withinLimit(measurement([100, 100, 100, 100, 100, 100, 100, 100, 160, 170]))).toBe(
      false,
    );
  });

  it('reports the opening against its 400 ms target', () => {
    expect(OPEN_TARGET_MS).toBe(400);
    expect(openWithinTarget(measurement([100], [300, 390, 400]))).toBe(true);
    expect(openWithinTarget(measurement([100], [300, 390, 401]))).toBe(false);
  });

  it('prints every case and both verdicts', () => {
    const within = formatReport(measurement([90, 100, 110]), 4);
    expect(within).toContain('CPU 4× mais lenta, banco prancheta-test');
    expect(within).toContain('Snapshot sem súmulas: 684 KB de JSON, 98 KB em gzip');
    expect(within).toContain('Súmulas (38 linhas): 820 KB de JSON, 78 KB em gzip');
    expect(within).toContain('gravação após a rodada 38 (base 1–37, só a 38)');
    expect(within).toContain('gravação sem rodada nova (base 1–38)');
    expect(within).toContain('gravação sem base (as 38 linhas)');
    expect(within).toContain('abrir a carreira');
    expect(within).toContain('Gravação DENTRO do limite: p90 de 110.0 ms');
    expect(within).toContain('Abertura dentro da meta: p90 de 220.0 ms');
    const over = formatReport(measurement([200, 210, 220], [500]), 4);
    expect(over).toContain('Gravação ACIMA do limite');
    expect(over).toContain('Abertura ACIMA da meta');
  });
});

describe('measure-save options', () => {
  it('has the defaults and reads the flags', () => {
    expect(parseArgs([])).toEqual({ runs: 40, warmup: 5, cpu: 4 });
    expect(parseArgs(['--runs', '5', '--cpu', '6', '--warmup', '0'])).toEqual({
      runs: 5,
      warmup: 0,
      cpu: 6,
    });
    expect(typeof parseArgs(['--runs', '0'])).toBe('string');
    expect(typeof parseArgs(['--cpu', 'x'])).toBe('string');
    expect(typeof parseArgs(['--seed', '1'])).toBe('string');
  });

  it('takes a local Chromium from PRANCHETA_CHROMIUM or --chromium (the flag wins)', () => {
    const env = { PRANCHETA_CHROMIUM: '/opt/chrome/headless' };
    expect(parseArgs([], env)).toMatchObject({ chromium: '/opt/chrome/headless' });
    expect(parseArgs(['--chromium', '/usr/bin/chromium'], env)).toMatchObject({
      chromium: '/usr/bin/chromium',
    });
    expect(parseArgs(['--chromium', '/x', '--runs', '4'])).toEqual({
      runs: 4,
      warmup: 5,
      cpu: 4,
      chromium: '/x',
    });
    expect(parseArgs([], { PRANCHETA_CHROMIUM: '' })).toEqual({ runs: 40, warmup: 5, cpu: 4 });
    expect(typeof parseArgs(['--chromium'])).toBe('string');
    expect(typeof parseArgs(['--chromium', '--runs', '4'])).toBe('string');
  });

  it('refuses to run outside PRANCHETA_ENV=test, before building or opening anything', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    expect(await main([], {})).toBe(2);
    expect(await main([], { PRANCHETA_ENV: 'prod' })).toBe(2);
    expect(String(stderr.mock.calls[0]?.[0])).toContain('PRANCHETA_ENV=test');
    expect(await main(['--runs', '0'], { PRANCHETA_ENV: 'test' })).toBe(2);
    expect(await main(['--chromium'], { PRANCHETA_ENV: 'test' })).toBe(2);
    stderr.mockRestore();
  });
});
