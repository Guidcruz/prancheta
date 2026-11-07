import { describe, expect, it, vi } from 'vitest';
import { finish, main, parseArgs } from './main.ts';
import {
  OPEN_TARGET_MS,
  WRITE_ACCEPT_MS,
  WRITE_TARGET_MS,
  formatReport,
  openWithinTarget,
  restOfWrite,
  stats,
  withinLimit,
  writeVerdict,
  type MeasurementLike,
  type StageTimes,
} from './report.ts';

const stagesOf = (totals: readonly number[]): StageTimes => ({
  schema: totals.map((n) => n * 0.1),
  stringify: totals.map((n) => n * 0.15),
  utf8: totals.map((n) => n * 0.05),
  sha256: totals.map((n) => n * 0.05),
  gzip: totals.map((n) => n * 0.3),
  encode: totals.map((n) => n * 0.5),
  transaction: totals.map((n) => n * 0.2),
  verify: totals.map((n) => n * 0.1),
  prune: totals.map((n) => n * 0.05),
});

const measurement = (
  incremental: number[],
  open = [200, 210, 220],
  seasonTurn: MeasurementLike['seasonTurn'] = [
    incremental.map((n) => n - 10),
    incremental.map((n) => n - 5),
    incremental,
  ],
): MeasurementLike => ({
  dbName: 'prancheta-test',
  incremental,
  incrementalStages: stagesOf(incremental),
  noNewRound: incremental.map((n) => n - 5),
  allRounds: incremental.map((n) => n * 2),
  open,
  draft: incremental.map((n) => n / 10),
  draftJsonBytes: 640,
  seasonTurn,
  seasonTurnStages: [stagesOf(seasonTurn[0]), stagesOf(seasonTurn[1]), stagesOf(seasonTurn[2])],
  encode: incremental.map((n) => n / 2),
  stringify: incremental.map((n) => n / 4),
  snapshotJsonBytes: 700_000,
  snapshotStoredBytes: 700_000,
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

  it('decides by the p90 of the write after round 38 against the 130 ms of the acceptance', () => {
    expect(WRITE_TARGET_MS).toBe(150);
    expect(WRITE_ACCEPT_MS).toBe(130);
    const ten = (last: number) => [90, 95, 100, 100, 105, 110, 115, 120, 130, last];
    // The p90 of 10 values is the 9th: one slow write does not fail it, two do.
    expect(withinLimit(measurement(ten(400)))).toBe(true);
    expect(withinLimit(measurement([...ten(400).slice(0, 8), 131, 400]))).toBe(false);
    // A low median does not save a high p90.
    expect(withinLimit(measurement([100, 100, 100, 100, 100, 100, 100, 100, 140, 170]))).toBe(
      false,
    );
  });

  it('also decides by each of the three writes of the season turn', () => {
    const fast = [90, 100, 110];
    const slow = [120, 125, 131];
    expect(withinLimit(measurement(fast, undefined, [fast, fast, fast]))).toBe(true);
    for (const k of [0, 1, 2]) {
      const turn = [fast, fast, fast] as [number[], number[], number[]];
      turn[k] = slow;
      expect(withinLimit(measurement(fast, undefined, turn)), `write ${k + 1}`).toBe(false);
    }
  });

  it('gives the verdict in three levels: within the margin, over it, over the target', () => {
    const fast = [90, 100, 110];
    expect(writeVerdict(measurement([90, 100, 130]))).toBe(
      'Gravação DENTRO da folga: maior p90 de 130.0 ms (após a rodada 38) ≤ 130 ms em todas as gravações que decidem.',
    );
    expect(writeVerdict(measurement(fast, undefined, [fast, [100, 140, 150], fast]))).toBe(
      'Gravação ACIMA da folga de 130 ms, meta de 150 ms atendida: maior p90 de 150.0 ms (virada: 2ª gravação (rodada 1, uma linha)). Volta ao architect.',
    );
    expect(writeVerdict(measurement(fast, undefined, [fast, fast, [100, 140, 151]]))).toBe(
      'Gravação ACIMA da meta de 150 ms: maior p90 de 151.0 ms (virada: 3ª gravação (rodada 2, poda as 38 linhas)). Volta ao architect.',
    );
    const report = formatReport(measurement(fast, undefined, [fast, fast, [100, 140, 151]]), 4);
    expect(report).toContain('Gravação ACIMA da meta de 150 ms');
    expect(report).not.toContain('T-019');
  });

  it('reports the opening against its 400 ms target', () => {
    expect(OPEN_TARGET_MS).toBe(400);
    expect(openWithinTarget(measurement([100], [300, 390, 400]))).toBe(true);
    expect(openWithinTarget(measurement([100], [300, 390, 401]))).toBe(false);
  });

  it('prints every case and both verdicts', () => {
    const within = formatReport(measurement([90, 100, 110]), 4);
    expect(within).toContain('CPU 4× mais lenta, banco prancheta-test');
    expect(within).toContain(
      'Snapshot sem súmulas: 684 KB de JSON, 684 KB guardados sem gzip (98 KB em gzip no arquivo exportado)',
    );
    expect(within).toContain('Súmulas (38 linhas): 820 KB de JSON, 78 KB em gzip');
    expect(within).toContain('gravação após a rodada 38 (base 1–37, só a 38)');
    expect(within).toContain('gravação sem rodada nova (base 1–38)');
    expect(within).toContain('gravação sem base (as 38 linhas)');
    expect(within).toContain('virada: 1ª gravação da temporada 2 (sem linha)');
    expect(within).toContain('virada: 2ª gravação (rodada 1, uma linha)');
    expect(within).toContain('virada: 3ª gravação (rodada 2, poda as 38 linhas)');
    expect(within).toContain('abrir a carreira');
    expect(within).toContain('gravação da ficha entre rodadas (writeDraft)');
    expect(within).toContain('Ficha do técnico no registro da carreira: 640 bytes de JSON');
    expect(within).toContain(
      'Gravação DENTRO da folga: maior p90 de 110.0 ms (após a rodada 38) ≤ 130 ms',
    );
    expect(within).toContain(
      'Uma execução não fecha o aceite: valem três execuções seguidas, cada uma com o p90 de todas as gravações que decidem ≤ 130 ms.',
    );
    expect(within).toContain('Abertura dentro da meta: p90 de 220.0 ms');
    const over = formatReport(measurement([200, 210, 220], [500]), 4);
    expect(over).toContain('Gravação ACIMA da meta de 150 ms');
    expect(over).toContain('Abertura ACIMA da meta');
    expect(over).toContain('Não decide o código de saída');
  });
});

describe('measure-save stages of the write', () => {
  it('prints each stage of the write after round 38 and what is left outside them', () => {
    const m = measurement([100, 200]);
    // 100 − (10 + 50 + 20 + 10 + 5) and 200 − (20 + 100 + 40 + 20 + 10).
    const rest = restOfWrite(m.incremental, m.incrementalStages);
    expect(rest.map((n) => Math.round(n * 1000) / 1000)).toEqual([5, 10]);
    const report = formatReport(m, 4);
    expect(report).toContain('Etapas da gravação após a rodada 38');
    for (const name of [
      'esquema write + linha nova inteira',
      'serializar (JSON.stringify)',
      'UTF-8',
      'SHA-256',
      'codificação inteira (de parede)',
      'transação IndexedDB',
      'releitura e comparação por bytes',
      'poda',
      'resto (conexão, fila, registro)',
    ]) {
      expect(report).toContain(name);
    }
    expect(report).toMatch(/UTF-8 +mediana +7\.5 ms +p90 +10\.0 ms/);
    expect(report).not.toContain('gzip (CompressionStream)');
    // The three writes of the season turn, with the stages that follow one another.
    for (const name of [
      'Etapas da virada: 1ª gravação da temporada 2 (sem linha):',
      'Etapas da virada: 2ª gravação (rodada 1, uma linha):',
      'Etapas da virada: 3ª gravação (rodada 2, poda as 38 linhas):',
    ]) {
      expect(report).toContain(name);
    }
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

describe('measure-save exit code', () => {
  const quiet = () => ({
    out: vi.spyOn(process.stdout, 'write').mockReturnValue(true),
    err: vi.spyOn(process.stderr, 'write').mockReturnValue(true),
  });

  it('gives the verdict when the page stayed on 127.0.0.1 and on the test database', () => {
    const { out, err } = quiet();
    expect(finish({ measurement: measurement([90, 100, 110]), blocked: 0 }, 4)).toBe(0);
    expect(finish({ measurement: measurement([200, 210, 220]), blocked: 0 }, 4)).toBe(1);
    // Over the margin of 130 ms fails the run, even within the target of 150 ms.
    expect(finish({ measurement: measurement([90, 100, 130]), blocked: 0 }, 4)).toBe(0);
    expect(finish({ measurement: measurement([90, 100, 131]), blocked: 0 }, 4)).toBe(1);
    expect(err).not.toHaveBeenCalled();
    out.mockRestore();
    err.mockRestore();
  });

  it('fails with 3 when a request tried to leave 127.0.0.1, even within the limit', () => {
    const { out, err } = quiet();
    expect(finish({ measurement: measurement([90, 100, 110]), blocked: 2 }, 4)).toBe(3);
    expect(String(err.mock.calls[0]?.[0])).toContain('2 requisição(ões) bloqueada(s)');
    out.mockRestore();
    err.mockRestore();
  });

  it('fails with 3 when the page used another database, printing no numbers', () => {
    const { out, err } = quiet();
    const other = { ...measurement([90, 100, 110]), dbName: 'prancheta' };
    expect(finish({ measurement: other, blocked: 0 }, 4)).toBe(3);
    expect(out).not.toHaveBeenCalled();
    expect(String(err.mock.calls[0]?.[0])).toContain('banco errado na página: prancheta');
    out.mockRestore();
    err.mockRestore();
  });
});
