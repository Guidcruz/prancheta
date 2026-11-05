import type { ClubDef } from '../../app/src/engine/index.ts';
import {
  clubName,
  exitCode,
  notMeasured,
  num,
  pct,
  type MetricRow,
  type Report,
} from './metrics.ts';

/*
 * Printing the /balance report: a table for people (pt-BR, as balance-targets.md) or JSON for
 * machines. Neither has the time spent, which goes to stderr, so two runs with the same seed and
 * parameters print the same bytes (US-013, "reprodutível").
 */

/** What the header of the report says about the run. */
export interface RunInfo {
  readonly seasons: number;
  readonly matches: number;
  readonly seed: number;
  readonly duels: number;
  readonly robot?: string;
  /** Dotted paths of the parameters `--params` changed. */
  readonly overrides: readonly string[];
  readonly paramsFile?: string;
}

const SECTIONS: readonly { readonly title: string; readonly ids: (id: string) => boolean }[] = [
  {
    title: 'Partida e resultados',
    ids: (id) =>
      [
        'goals',
        'strong20',
        'upset30',
        'draws',
        'homeWins',
        'topScores',
        'nilNil',
        'margin3',
        'margin5',
        'yellows',
        'reds',
        'injuries',
        'injuryRounds',
        'penalties',
        'penaltyGoals',
        'subs',
      ].includes(id),
  },
  { title: 'Táticas', ids: (id) => id.startsWith('tactic-') || id === 'allOut' },
  {
    title: 'Tabela e torcida',
    ids: (id) => id === 'champion' || id === 'seventeenth' || id.startsWith('fans'),
  },
  {
    title: 'Porte e zebras',
    ids: (id) =>
      [
        'bigChampion',
        'smallChampion',
        'bigRelegated',
        'strongChampion',
        'strongRelegated',
        'weakInG4',
        'z4Escape',
        'z4EscapeGap',
      ].includes(id),
  },
  { title: 'Técnico-robô', ids: (id) => id.startsWith('robot') },
  {
    title: 'Referências (não bloqueiam)',
    ids: (id) => ['strong10', 'draws0', 'highPressure', 'tiredStarter'].includes(id),
  },
  {
    title: 'Metas futuras (n/a até a etapa delas; não contam)',
    ids: (id) => id.startsWith('future-'),
  },
];

const pad = (text: string, width: number) =>
  text.length >= width ? text : text + ' '.repeat(width - text.length);

function statusText(r: MetricRow): string {
  if (r.status === 'n/a') return 'n/a';
  if (r.verdict === 'pooled') return `${r.status} (veredito no total)`;
  return r.required ? r.status : `${r.status} (info)`;
}

/** The rows as aligned lines: label, measured value, target and status. */
function rowLines(rows: readonly MetricRow[], all: readonly MetricRow[] = rows): string[] {
  const width = Math.max(...all.map((r) => r.label.length), 7);
  const shownWidth = Math.max(...all.map((r) => r.shown.length), 6);
  const targetWidth = Math.max(...all.map((r) => r.target.length), 4);
  return rows.map(
    (r) =>
      `  ${pad(r.label, width)}  ${pad(r.shown, shownWidth)}  ${pad(r.target, targetWidth)}  ${statusText(r)}`,
  );
}

/** "Metas obrigatórias: x de y dentro; fora: ..." of some rows. */
function requiredSummary(title: string, rows: readonly MetricRow[]): string {
  const required = rows.filter((r) => r.required && r.status !== 'n/a');
  const out = required.filter((r) => r.status === 'fora');
  return (
    `${title}: ${required.length - out.length} de ${required.length} dentro` +
    (out.length === 0 ? '' : `; fora: ${out.map((r) => r.label).join('; ')}`)
  );
}

/** The report as a text table. */
export function formatText(report: Report, info: RunInfo, clubs: readonly ClubDef[]): string {
  const lines: string[] = [];
  const robot = info.robot === undefined ? 'sem robô' : `robô no ${clubName(clubs, info.robot)}`;
  lines.push(
    `/balance: ${info.seasons} temporadas (${info.matches} jogos), semente ${info.seed}, duelos de ${info.duels} jogos, ${robot}`,
  );
  lines.push(
    info.overrides.length === 0
      ? 'Parâmetros: app/src/params/ sem sobrescrita'
      : `Parâmetros: app/src/params/ com ${info.paramsFile ?? '--params'} por cima (${info.overrides.join(', ')})`,
  );
  for (const section of SECTIONS) {
    const rows = report.rows.filter((r) => section.ids(r.id));
    if (rows.length === 0) continue;
    lines.push('', section.title);
    lines.push(...rowLines(rows, report.rows));
  }
  const notes = report.rows.filter((r) => r.note !== undefined);
  if (notes.length > 0) {
    lines.push('', 'Notas:');
    lines.push(...notes.map((r) => `  ${r.label}: ${r.note!}`));
  }
  lines.push('');
  lines.push(requiredSummary('Metas obrigatórias', report.rows));
  const missing = notMeasured(report);
  if (missing.length > 0) {
    lines.push(
      `Aviso: ${missing.length} metas obrigatórias sem medida nesta execução (n/a, não contam no código de saída): ` +
        missing.map((r) => r.label).join('; '),
    );
  }
  if (report.rows.some((r) => r.verdict === 'pooled')) {
    lines.push('As metas raras (veredito no total) se julgam na soma das sementes, no fim.');
  }
  if (report.titles.length > 0) {
    lines.push('');
    lines.push(
      `Títulos por clube (${info.seasons} temporadas): ` +
        report.titles.map((t) => `${clubName(clubs, t.club)} ${t.titles}`).join(', '),
    );
  }
  if (report.robot !== undefined) {
    const r = report.robot;
    const name = clubName(clubs, r.club);
    lines.push('');
    lines.push(
      `Técnico-robô no ${name} (${r.seasons} temporadas pareadas): ${num(r.robotPoints, 1)} pontos contra ${num(r.aiPoints, 1)} da IA; ` +
        `título ${pct(r.robotTitles)} contra ${pct(r.aiTitles)}; G4 ${pct(r.robotG4)} contra ${pct(r.aiG4)}`,
    );
  }
  const profiles = Object.entries(report.tacticsByProfile);
  if (profiles.length > 0) {
    lines.push('');
    lines.push('Fichas da IA por perfil (postura; pressão):');
    for (const [profile, s] of profiles.sort(([a], [b]) => (a < b ? -1 : 1))) {
      const v = (key: string) => pct(s[key] ?? 0, 0);
      lines.push(
        `  ${pad(profile, 11)}  ofensiva ${v('attacking')}, equilibrada ${v('balanced')}, defensiva ${v('defensive')}; alta ${v('pressure-high')}, média ${v('pressure-medium')}, baixa ${v('pressure-low')}`,
      );
    }
  }
  return lines.join('\n') + '\n';
}

function jsonOf(report: Report, info: RunInfo) {
  return {
    run: info,
    exitCode: exitCode(report),
    failed: report.rows.filter((r) => r.required && r.status === 'fora').map((r) => r.id),
    notMeasured: notMeasured(report).map((r) => r.id),
    rows: report.rows,
    topScores: report.topScores,
    titles: report.titles,
    robot: report.robot ?? null,
    tacticsByProfile: report.tacticsByProfile,
  };
}

/** The report as JSON (numbers as numbers; shares 0..1). */
export function formatJson(report: Report, info: RunInfo): string {
  return JSON.stringify(jsonOf(report, info), null, 2) + '\n';
}

/** One seed of a multi-seed run. */
export interface SeedRun {
  readonly report: Report;
  readonly info: RunInfo;
}

/** The rare targets measured on the seasons of every seed together. */
export interface PooledRun {
  readonly seeds: readonly number[];
  readonly seasons: number;
  readonly rows: readonly MetricRow[];
}

/** Exit code of a multi-seed run: 1 when a required row is out in a seed or in the total. */
export function multiExitCode(runs: readonly SeedRun[], pooled: PooledRun): 0 | 1 {
  return runs.some((r) => exitCode(r.report) === 1) || exitCode(pooled) === 1 ? 1 : 0;
}

/** Ids of the required rows out, by seed and in the total (`semente 1: goals`, `total: ...`). */
function failures(runs: readonly SeedRun[], pooled: PooledRun): string[] {
  const out = (rows: readonly MetricRow[]) =>
    rows.filter((r) => r.required && r.status === 'fora').map((r) => r.id);
  return [
    ...runs.flatMap((r) => out(r.report.rows).map((x) => `semente ${r.info.seed}: ${x}`)),
    ...out(pooled.rows).map((x) => `total: ${x}`),
  ];
}

/**
 * The text of a multi-seed run (`--seed 1,2,3`): every seed's report, then the rare targets on
 * the seeds together, then one line with every required target out.
 */
export function formatMultiText(
  runs: readonly SeedRun[],
  pooled: PooledRun,
  clubs: readonly ClubDef[],
): string {
  const seeds = pooled.seeds.join(', ');
  const lines: string[] = [
    `/balance: ${pooled.seeds.length} sementes (${seeds}); cada uma abaixo, as metas raras julgadas na soma das temporadas`,
  ];
  for (const run of runs) {
    lines.push('', `=== Semente ${run.info.seed} ===`, '');
    lines.push(formatText(run.report, run.info, clubs).trimEnd());
  }
  lines.push('', `=== Soma das sementes ${seeds} (${pooled.seasons} temporadas): metas raras ===`);
  lines.push(...rowLines(pooled.rows));
  lines.push('', requiredSummary('Metas raras no total', pooled.rows));
  const outOf = (rows: readonly MetricRow[]) =>
    rows.filter((r) => r.required && r.status === 'fora').length;
  const parts = [
    ...runs.map((r) => `semente ${r.info.seed}: ${outOf(r.report.rows)}`),
    `total: ${outOf(pooled.rows)}`,
  ];
  lines.push(
    '',
    multiExitCode(runs, pooled) === 0
      ? 'Resultado: todas as metas obrigatórias dentro, em todas as sementes e no total'
      : `Resultado: metas obrigatórias fora (${parts.join('; ')}); a lista está no resumo de cada parte`,
  );
  return lines.join('\n') + '\n';
}

/** The JSON of a multi-seed run: every seed as in formatJson, and the total of the rare targets. */
export function formatMultiJson(runs: readonly SeedRun[], pooled: PooledRun): string {
  return (
    JSON.stringify(
      {
        exitCode: multiExitCode(runs, pooled),
        failed: failures(runs, pooled),
        seeds: runs.map((r) => jsonOf(r.report, r.info)),
        pooled,
      },
      null,
      2,
    ) + '\n'
  );
}
