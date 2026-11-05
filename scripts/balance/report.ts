import type { ClubDef } from '../../app/src/engine/index.ts';
import { clubName, exitCode, num, pct, type MetricRow, type Report } from './metrics.ts';

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
];

const pad = (text: string, width: number) =>
  text.length >= width ? text : text + ' '.repeat(width - text.length);

function statusText(r: MetricRow): string {
  if (r.status === 'n/a') return 'n/a';
  return r.required ? r.status : `${r.status} (info)`;
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
  const width = Math.max(...report.rows.map((r) => r.label.length), 7);
  const shownWidth = Math.max(...report.rows.map((r) => r.shown.length), 6);
  const targetWidth = Math.max(...report.rows.map((r) => r.target.length), 4);
  for (const section of SECTIONS) {
    const rows = report.rows.filter((r) => section.ids(r.id));
    if (rows.length === 0) continue;
    lines.push('', section.title);
    for (const r of rows) {
      lines.push(
        `  ${pad(r.label, width)}  ${pad(r.shown, shownWidth)}  ${pad(r.target, targetWidth)}  ${statusText(r)}`,
      );
    }
  }
  const required = report.rows.filter((r) => r.required && r.status !== 'n/a');
  const out = required.filter((r) => r.status === 'fora');
  lines.push('');
  lines.push(
    `Metas obrigatórias: ${required.length - out.length} de ${required.length} dentro` +
      (out.length === 0 ? '' : `; fora: ${out.map((r) => r.label).join('; ')}`),
  );
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

/** The report as JSON (numbers as numbers; shares 0..1). */
export function formatJson(report: Report, info: RunInfo): string {
  return (
    JSON.stringify(
      {
        run: info,
        exitCode: exitCode(report),
        failed: report.rows.filter((r) => r.required && r.status === 'fora').map((r) => r.id),
        rows: report.rows,
        topScores: report.topScores,
        titles: report.titles,
        robot: report.robot ?? null,
        tacticsByProfile: report.tacticsByProfile,
      },
      null,
      2,
    ) + '\n'
  );
}
