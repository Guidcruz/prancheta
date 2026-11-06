/*
 * Numbers and verdict of the save measurement (scripts/measure-save.ts; docs/02-architecture.md,
 * 5, "Gravação da rodada no save" and "Abrir a carreira"). With the match sheets out of the
 * snapshot (4.2, "Súmulas fora do snapshot"), the write after round 38 (the biggest snapshot, only
 * the row of round 38 new) must stay within 150 ms at the 90th percentile in Chromium with 4× CPU
 * slowdown; above it the design goes back to the architect before T-019. Opening the career has a
 * target of 400 ms that is only reported (it does not decide the exit code).
 */

/** About a third of the 500 ms of the round (docs/02-architecture.md, 5). */
export const WRITE_LIMIT_MS = 150;

/** Opening happens once per session, behind the loading screen. */
export const OPEN_TARGET_MS = 400;

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

export interface MeasurementLike {
  readonly dbName: string;
  readonly incremental: readonly number[];
  readonly noNewRound: readonly number[];
  readonly allRounds: readonly number[];
  readonly open: readonly number[];
  readonly encode: readonly number[];
  readonly stringify: readonly number[];
  readonly snapshotJsonBytes: number;
  readonly snapshotGzipBytes: number;
  readonly sheetsJsonBytes: number;
  readonly sheetsGzipBytes: number;
}

/** `true` when the write after round 38 is within the limit at the 90th percentile. */
export function withinLimit(m: MeasurementLike, limit = WRITE_LIMIT_MS): boolean {
  return stats(m.incremental).p90 <= limit;
}

/** `true` when opening is within its target at the 90th percentile (reported only). */
export function openWithinTarget(m: MeasurementLike, target = OPEN_TARGET_MS): boolean {
  return stats(m.open).p90 <= target;
}

const ms = (n: number) => `${n.toFixed(1)} ms`;
const kb = (n: number) => `${Math.round(n / 1024)} KB`;

function row(name: string, values: readonly number[]): string {
  const s = stats(values);
  return `  ${name.padEnd(44)} mediana ${ms(s.median).padStart(9)}  p90 ${ms(s.p90).padStart(9)}  máx ${ms(s.max).padStart(9)}`;
}

/** The report printed by the script, in pt-BR (it is read by the CEO). */
export function formatReport(
  m: MeasurementLike,
  cpu: number,
  limit = WRITE_LIMIT_MS,
  target = OPEN_TARGET_MS,
): string {
  const write = stats(m.incremental).p90;
  const open = stats(m.open).p90;
  const verdict = withinLimit(m, limit)
    ? `Gravação DENTRO do limite: p90 de ${ms(write)} ≤ ${limit} ms.`
    : `Gravação ACIMA do limite: p90 de ${ms(write)} > ${limit} ms. Volta ao architect antes da T-019.`;
  const openVerdict = openWithinTarget(m, target)
    ? `Abertura dentro da meta: p90 de ${ms(open)} ≤ ${target} ms.`
    : `Abertura ACIMA da meta: p90 de ${ms(open)} > ${target} ms. Não bloqueia; volta ao architect.`;
  return [
    `Save do fim da temporada no Chromium, CPU ${cpu}× mais lenta, banco ${m.dbName}`,
    `${m.incremental.length} medições por caso`,
    `Snapshot sem súmulas: ${kb(m.snapshotJsonBytes)} de JSON, ${kb(m.snapshotGzipBytes)} em gzip`,
    `Súmulas (38 linhas): ${kb(m.sheetsJsonBytes)} de JSON, ${kb(m.sheetsGzipBytes)} em gzip`,
    '',
    row('gravação após a rodada 38 (base 1–37, só a 38)', m.incremental),
    row('gravação sem rodada nova (base 1–38)', m.noNewRound),
    row('gravação sem base (as 38 linhas)', m.allRounds),
    row('abrir a carreira (38 linhas remontadas)', m.open),
    row('snapshot: serializar + hash + gzip', m.encode),
    row('snapshot: só JSON.stringify', m.stringify),
    '',
    verdict,
    openVerdict,
    '',
  ].join('\n');
}
