/*
 * Numbers and verdict of the save measurement (scripts/measure-save.ts; docs/02-architecture.md,
 * 5, "Gravação da rodada no save" and "Abrir a carreira"). With the match sheets out of the
 * snapshot (4.2, "Súmulas fora do snapshot"), the writes that decide are the one after round 38
 * (the biggest snapshot, only the row of round 38 new) and each of the first three writes of
 * season 2 (the season turn, whose third write prunes the rows of season 1), in Chromium with 4×
 * CPU slowdown. The target is 150 ms at the 90th percentile; a change to the write path is
 * accepted with every deciding write within 130 ms in each of three runs in a row (the margin for
 * the noise between runs, T-072). One run does not close the acceptance. Opening the career has a
 * target of 400 ms that is only reported (it does not decide the exit code).
 */

import type { WriteStage } from '../../app/src/lib/save/probe.ts';

/** About a third of the 500 ms of the round (docs/02-architecture.md, 5). */
export const WRITE_TARGET_MS = 150;

/** The target less the noise measured between runs of the same code (up to 22 ms at the p90). */
export const WRITE_ACCEPT_MS = 130;

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

/** The time of each stage, one value per write. */
export type StageTimes = Readonly<Record<WriteStage, readonly number[]>>;

export interface MeasurementLike {
  readonly dbName: string;
  readonly incremental: readonly number[];
  /** The stages of each write of `incremental` (ms per write, same order). */
  readonly incrementalStages: StageTimes;
  readonly noNewRound: readonly number[];
  readonly allRounds: readonly number[];
  readonly open: readonly number[];
  /** `writeDraft` of the coach's sheet between rounds (ADR-0021); reported, it does not decide. */
  readonly draft: readonly number[];
  readonly draftJsonBytes: number;
  /** The 1st, 2nd and 3rd writes of season 2. */
  readonly seasonTurn: readonly [readonly number[], readonly number[], readonly number[]];
  /** The stages of each write of `seasonTurn` (ms per write, same order). */
  readonly seasonTurnStages: readonly [StageTimes, StageTimes, StageTimes];
  readonly encode: readonly number[];
  readonly stringify: readonly number[];
  readonly snapshotJsonBytes: number;
  /** Bytes of the snapshot in IndexedDB: its JSON, without gzip (T-072). */
  readonly snapshotStoredBytes: number;
  readonly snapshotGzipBytes: number;
  readonly sheetsJsonBytes: number;
  readonly sheetsGzipBytes: number;
}

const TURN_NAMES = [
  'virada: 1ª gravação da temporada 2 (sem linha)',
  'virada: 2ª gravação (rodada 1, uma linha)',
  'virada: 3ª gravação (rodada 2, poda as 38 linhas)',
] as const;

/** The writes that decide, with the name printed in the report. */
function deciding(m: MeasurementLike): { name: string; values: readonly number[] }[] {
  return [
    { name: 'após a rodada 38', values: m.incremental },
    ...m.seasonTurn.map((values, i) => ({ name: TURN_NAMES[i]!, values })),
  ];
}

/** The deciding write with the highest p90 (the first one on a tie). */
function worstWrite(m: MeasurementLike): { name: string; p90: number } {
  let worst = { name: '', p90: Number.NEGATIVE_INFINITY };
  for (const { name, values } of deciding(m)) {
    const { p90 } = stats(values);
    if (p90 > worst.p90) worst = { name, p90 };
  }
  return worst;
}

/**
 * `true` when the write after round 38 and each of the three writes of the season turn are within
 * `limit` at the 90th percentile (by default the 130 ms of the acceptance: the exit code).
 */
export function withinLimit(m: MeasurementLike, limit = WRITE_ACCEPT_MS): boolean {
  return worstWrite(m).p90 <= limit;
}

/** `true` when opening is within its target at the 90th percentile (reported only). */
export function openWithinTarget(m: MeasurementLike, target = OPEN_TARGET_MS): boolean {
  return stats(m.open).p90 <= target;
}

/** The stages in the order of a write, with the name printed in the report. */
const STAGE_NAMES: readonly (readonly [WriteStage, string])[] = [
  ['schema', 'esquema write + linha nova inteira'],
  ['stringify', 'serializar (JSON.stringify)'],
  ['utf8', 'UTF-8'],
  ['sha256', 'SHA-256'],
  ['encode', 'codificação inteira (de parede)'],
  ['transaction', 'transação IndexedDB'],
  ['verify', 'releitura e comparação por bytes'],
  ['prune', 'poda'],
];

/** The stages that follow one another; the rest of a write is outside them. */
const SEQUENTIAL: readonly WriteStage[] = ['schema', 'encode', 'transaction', 'verify', 'prune'];

/**
 * What each write spent outside its sequential stages (opening the connection, the queue, building
 * the record): `totals` are the writes, `stages` their stages in the same order.
 */
export function restOfWrite(totals: readonly number[], stages: StageTimes): number[] {
  return totals.map(
    (total, i) => total - SEQUENTIAL.reduce((sum, stage) => sum + stages[stage][i]!, 0),
  );
}

const ms = (n: number) => `${n.toFixed(1)} ms`;
const kb = (n: number) => `${Math.round(n / 1024)} KB`;

function row(name: string, values: readonly number[]): string {
  const s = stats(values);
  return `  ${name.padEnd(51)} mediana ${ms(s.median).padStart(9)}  p90 ${ms(s.p90).padStart(9)}  máx ${ms(s.max).padStart(9)}`;
}

/** The verdict of the writes in three levels: within the margin, over it, over the target. */
export function writeVerdict(
  m: MeasurementLike,
  accept = WRITE_ACCEPT_MS,
  target = WRITE_TARGET_MS,
): string {
  const worst = worstWrite(m);
  const at = `maior p90 de ${ms(worst.p90)} (${worst.name})`;
  if (worst.p90 <= accept) {
    return `Gravação DENTRO da folga: ${at} ≤ ${accept} ms em todas as gravações que decidem.`;
  }
  if (worst.p90 <= target) {
    return `Gravação ACIMA da folga de ${accept} ms, meta de ${target} ms atendida: ${at}. Volta ao architect.`;
  }
  return `Gravação ACIMA da meta de ${target} ms: ${at}. Volta ao architect.`;
}

/** The report printed by the script, in pt-BR (it is read by the CEO). */
export function formatReport(
  m: MeasurementLike,
  cpu: number,
  accept = WRITE_ACCEPT_MS,
  target = OPEN_TARGET_MS,
): string {
  const open = stats(m.open).p90;
  const openVerdict = openWithinTarget(m, target)
    ? `Abertura dentro da meta: p90 de ${ms(open)} ≤ ${target} ms.`
    : `Abertura ACIMA da meta: p90 de ${ms(open)} > ${target} ms. Não decide o código de saída; volta ao architect.`;
  const sequential = STAGE_NAMES.filter(([stage]) => SEQUENTIAL.includes(stage));
  return [
    `Save do fim da temporada no Chromium, CPU ${cpu}× mais lenta, banco ${m.dbName}`,
    `${m.incremental.length} medições por caso`,
    `Snapshot sem súmulas: ${kb(m.snapshotJsonBytes)} de JSON, ${kb(m.snapshotStoredBytes)} guardados sem gzip (${kb(m.snapshotGzipBytes)} em gzip no arquivo exportado)`,
    `Súmulas (38 linhas): ${kb(m.sheetsJsonBytes)} de JSON, ${kb(m.sheetsGzipBytes)} em gzip`,
    `Ficha do técnico no registro da carreira: ${m.draftJsonBytes} bytes de JSON`,
    '',
    row('gravação após a rodada 38 (base 1–37, só a 38)', m.incremental),
    row('gravação sem rodada nova (base 1–38)', m.noNewRound),
    row('gravação sem base (as 38 linhas)', m.allRounds),
    ...m.seasonTurn.map((values, i) => row(TURN_NAMES[i]!, values)),
    row('abrir a carreira (38 linhas remontadas)', m.open),
    row('gravação da ficha entre rodadas (writeDraft)', m.draft),
    row('snapshot: serializar + UTF-8 + hash (sem gzip)', m.encode),
    row('snapshot: só JSON.stringify', m.stringify),
    '',
    'Etapas da gravação após a rodada 38 (por gravação; as do codec são as do snapshot, guardado sem gzip e codificado ao lado da linha da 38, em gzip):',
    ...STAGE_NAMES.map(([stage, name]) => row(`  ${name}`, m.incrementalStages[stage])),
    row('  resto (conexão, fila, registro)', restOfWrite(m.incremental, m.incrementalStages)),
    ...m.seasonTurn.flatMap((values, i) => {
      const stages = m.seasonTurnStages[i]!;
      return [
        '',
        `Etapas da ${TURN_NAMES[i]!}:`,
        ...sequential.map(([stage, name]) => row(`  ${name}`, stages[stage])),
        row('  resto (conexão, fila, registro)', restOfWrite(values, stages)),
      ];
    }),
    '',
    writeVerdict(m, accept),
    openVerdict,
    `Uma execução não fecha o aceite: valem três execuções seguidas, cada uma com o p90 de todas as gravações que decidem ≤ ${accept} ms.`,
    '',
  ].join('\n');
}
