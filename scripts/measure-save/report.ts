/*
 * Numbers and verdict of the write measurement (scripts/measure-save.ts). The trigger is ADR-0019
 * ("gatilho do store próprio"): if writing the end-of-season snapshot in Chromium with 4× CPU
 * slowdown takes more than 150 ms, `matchSheets` moves to a store of its own before T-019 freezes
 * the format. The median of the measured writes decides; p90 and the maximum are reported too.
 */

/** ADR-0019: about a third of the 500 ms of the round (docs/02-architecture.md, 5). */
export const WRITE_LIMIT_MS = 150;

export interface Stats {
  readonly median: number;
  readonly p90: number;
  readonly max: number;
}

/** Median, 90th percentile (nearest rank) and maximum of a non-empty list. */
export function stats(values: readonly number[]): Stats {
  if (values.length === 0) throw new Error('stats of an empty list');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median = sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  const p90 = sorted[Math.min(sorted.length - 1, Math.ceil(0.9 * sorted.length) - 1)]!;
  return { median, p90, max: sorted[sorted.length - 1]! };
}

export interface TimingsLike {
  readonly write: readonly number[];
  readonly encode: readonly number[];
  readonly stringify: readonly number[];
  readonly jsonBytes: number;
  readonly gzipBytes: number;
}

export interface MeasurementLike {
  readonly dbName: string;
  readonly full: TimingsLike;
  readonly withoutSheets: TimingsLike;
}

/** `true` when the snapshot keeps `matchSheets` (the median write is within the limit). */
export function withinLimit(m: MeasurementLike, limit = WRITE_LIMIT_MS): boolean {
  return stats(m.full.write).median <= limit;
}

const ms = (n: number) => `${n.toFixed(1)} ms`;
const kb = (n: number) => `${Math.round(n / 1024)} KB`;

function lines(label: string, t: TimingsLike): string[] {
  const row = (name: string, values: readonly number[]) => {
    const s = stats(values);
    return `  ${name.padEnd(28)} mediana ${ms(s.median).padStart(9)}  p90 ${ms(s.p90).padStart(9)}  máx ${ms(s.max).padStart(9)}`;
  };
  return [
    `${label}: ${kb(t.jsonBytes)} de JSON, ${kb(t.gzipBytes)} em gzip`,
    row('gravação segura completa', t.write),
    row('serializar + hash + gzip', t.encode),
    row('só JSON.stringify', t.stringify),
  ];
}

/** The report printed by the script, in pt-BR (it is read by the CEO). */
export function formatReport(m: MeasurementLike, cpu: number, limit = WRITE_LIMIT_MS): string {
  const full = stats(m.full.write).median;
  const verdict = withinLimit(m, limit)
    ? `DENTRO do limite: mediana de ${ms(full)} ≤ ${limit} ms. O matchSheets fica no snapshot.`
    : `ACIMA do limite: mediana de ${ms(full)} > ${limit} ms. O matchSheets vai para um store próprio, gravado na mesma transação do snapshot, antes da T-019 (ADR-0019).`;
  return [
    `Gravação do snapshot do fim da temporada no Chromium, CPU ${cpu}× mais lenta, banco ${m.dbName}`,
    `${m.full.write.length} gravações medidas`,
    '',
    ...lines('Snapshot completo (com matchSheets)', m.full),
    '',
    ...lines('Mesmo snapshot sem matchSheets', m.withoutSheets),
    '',
    verdict,
    '',
  ].join('\n');
}
