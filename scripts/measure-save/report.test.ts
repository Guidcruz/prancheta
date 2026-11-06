import { describe, expect, it, vi } from 'vitest';
import { main, parseArgs } from './main.ts';
import {
  WRITE_LIMIT_MS,
  formatReport,
  stats,
  withinLimit,
  type MeasurementLike,
} from './report.ts';

const timings = (write: number[]) => ({
  write,
  encode: write.map((n) => n / 2),
  stringify: write.map((n) => n / 4),
  jsonBytes: 1_450_000,
  gzipBytes: 155_000,
});

const measurement = (write: number[]): MeasurementLike => ({
  dbName: 'prancheta-test',
  full: timings(write),
  withoutSheets: timings(write.map((n) => n / 2)),
});

describe('measure-save report', () => {
  it('computes median, p90 and max', () => {
    expect(stats([5])).toEqual({ median: 5, p90: 5, max: 5 });
    expect(stats([4, 1, 3, 2])).toEqual({ median: 2.5, p90: 4, max: 4 });
    const ten = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(stats(ten)).toEqual({ median: 55, p90: 90, max: 100 });
    expect(() => stats([])).toThrow();
  });

  it('decides by the median against the 150 ms of ADR-0019', () => {
    expect(WRITE_LIMIT_MS).toBe(150);
    expect(withinLimit(measurement([100, 150, 400]))).toBe(true);
    expect(withinLimit(measurement([140, 151, 152]))).toBe(false);
  });

  it('prints both snapshots and the verdict', () => {
    const within = formatReport(measurement([90, 100, 110]), 4);
    expect(within).toContain('CPU 4× mais lenta, banco prancheta-test');
    expect(within).toContain(
      'Snapshot completo (com matchSheets): 1416 KB de JSON, 151 KB em gzip',
    );
    expect(within).toContain('Mesmo snapshot sem matchSheets');
    expect(within).toContain('DENTRO do limite: mediana de 100.0 ms');
    expect(formatReport(measurement([200, 210, 220]), 4)).toContain('ACIMA do limite');
  });
});

describe('measure-save options', () => {
  it('has the defaults and reads the flags', () => {
    expect(parseArgs([])).toEqual({ runs: 15, warmup: 3, cpu: 4 });
    expect(parseArgs(['--runs', '5', '--cpu', '6', '--warmup', '0'])).toEqual({
      runs: 5,
      warmup: 0,
      cpu: 6,
    });
    expect(typeof parseArgs(['--runs', '0'])).toBe('string');
    expect(typeof parseArgs(['--cpu', 'x'])).toBe('string');
    expect(typeof parseArgs(['--seed', '1'])).toBe('string');
  });

  it('refuses to run outside PRANCHETA_ENV=test, before building or opening anything', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    expect(await main([], {})).toBe(2);
    expect(await main([], { PRANCHETA_ENV: 'prod' })).toBe(2);
    expect(String(stderr.mock.calls[0]?.[0])).toContain('PRANCHETA_ENV=test');
    expect(await main(['--runs', '0'], { PRANCHETA_ENV: 'test' })).toBe(2);
    stderr.mockRestore();
  });
});
