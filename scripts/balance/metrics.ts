import type { ClubDef, ClubId } from '../../app/src/engine/index.ts';
import { REFERENCE_VARIANT, TACTIC_VARIANTS, type AllOutTally, type DuelTally } from './duels.ts';
import {
  emptyMatchTally,
  mergeMatchTally,
  type MatchTally,
  type SeasonRecord,
  type StrengthRecord,
} from './league.ts';
import { DEFAULT_ROBOT_CLUB } from './options.ts';
import type { RunResults } from './run.ts';

/*
 * The /balance report against docs/design/balance-targets.md: each 1a target of the table (and
 * the decisions 8 to 11 measured in T-016) as a row with the measured value, the target range and
 * "dentro", "fora" or "n/a" (not measured in this run: no league, no duels or no robot).
 *
 * `required` rows are the 1a targets of balance-targets.md: one of them "fora" makes the exit code
 * 1 (for the CI, wired by devops). The other rows are references of ia-clubes.md and torcida.md
 * ("info"): shown with their target, never failing the run. The targets of later stages
 * (balance-targets.md, "futura") are listed as "n/a" and never count either.
 *
 * With several seeds (`--seed 1,2,3`), the rare table targets (RARE_TARGETS) are judged on the
 * seasons of all seeds together (balance-log.md, "Regra de medição proposta"): in each seed they
 * are shown with `verdict: 'pooled'` and do not count; the pooled rows count once.
 */

export type Status = 'dentro' | 'fora' | 'n/a';

export interface MetricRow {
  readonly id: string;
  readonly label: string;
  /** The measured number (a share is 0..1); undefined when not measured. */
  readonly value?: number;
  /** The measured value as printed (pt-BR). */
  readonly shown: string;
  readonly target: string;
  readonly status: Status;
  readonly required: boolean;
  /** Shown in each seed of a multi-seed run, judged on the seeds together (RARE_TARGETS). */
  readonly verdict?: 'pooled';
  /** Why the row is judged as it is, printed under the table. */
  readonly note?: string;
}

/**
 * "Grande rebaixado" does not count in the single season (balance-log.md, the CEO's decision 3 of
 * 2026-11-05): with the 2026 list two big clubs start among the 3 weakest, so one going down is
 * expected. It counts again in the long career, when the strength follows the revenue.
 */
export const BIG_RELEGATED_NOTE =
  'informativa na temporada única (decisão do CEO de 2026-11-05); volta a valer na carreira longa';

/**
 * The rare table targets, a few percent of 200 seasons, judged on all the seeds together when the
 * run has more than one (balance-log.md, decision 4).
 */
export const RARE_TARGETS: readonly string[] = ['smallChampion', 'weakInG4', 'z4EscapeGap'];

/**
 * Seasons of a `--chain` career that count as required targets (balance-targets.md, "Virada de
 * temporada"; docs/02-architecture.md, 4.1, T-017); from the next one on they are informative.
 */
export const CHAIN_REQUIRED_SEASONS = 3;

/** Prefix of the rows of season `k` of a `--chain` run (`chain-s2-goals`). */
export const chainPrefix = (season: number) => `chain-s${season}-`;
/** Prefix of the "Virada de temporada" rows of season `k` (`turn-s2-strengthMean`). */
export const turnPrefix = (season: number) => `turn-s${season}-`;

/** The id of a row without its `--chain` prefix. */
export const baseId = (id: string) => id.replace(/^(chain|turn)-s\d+-/, '');

/** A rare table target, of the single season or of any season of a chain (RARE_TARGETS). */
export const isRare = (id: string) => RARE_TARGETS.includes(id.replace(/^chain-s\d+-/, ''));

/** Most the league's mean strength may move from season 1 in seasons 2 and 3 (decision 11). */
export const CHAIN_STRENGTH_DRIFT = 1;

/**
 * Most the two gaps of the drift lock (big minus the other clubs; the 4 strongest minus the 4
 * weakest of season 1) may move from season 1 in seasons 2 and 3 (decision 15).
 */
export const CHAIN_GAP_DRIFT = 0.5;

/**
 * Targets required in season 1 that are informative in the turned seasons of a chain (decisions
 * 15 and 17): their rates are too noisy in 200 seasons to find a drift; the drift lock measures it.
 */
export const CHAIN_INFO_TARGETS: readonly string[] = ['bigChampion', 'smallChampion', 'weakInG4'];

/** Why CHAIN_INFO_TARGETS do not count in seasons 2 and 3 of a chain. */
export const CHAIN_INFO_NOTE =
  'informativa nas temporadas 2 e 3 da cadeia, obrigatória na temporada 1; a trava de deriva mede a virada (decisões 15 e 17 do CEO, 2026-11-05 e 2026-11-06)';

/** Half-width of the points per game reference of the tactical duels (balance-log.md). */
export const PPG_TOLERANCE = 0.04;

/** The targets of later stages (balance-targets.md, "futura"): "n/a" until their stage. */
export const FUTURE_TARGETS: readonly {
  readonly id: string;
  readonly label: string;
  readonly stage: string;
}[] = [
  { id: 'future-midClubProject', label: 'Projeto do clube médio', stage: 'etapa 4' },
  { id: 'future-leagueStability', label: 'Estabilidade da liga', stage: 'etapa 4' },
  { id: 'future-wageInflation', label: 'Inflação de salários', stage: 'etapa 3' },
  { id: 'future-attendance', label: 'Público médio', stage: 'etapa 3' },
  {
    id: 'future-brasilidades',
    label: 'Frequência de eventos das Brasilidades',
    stage: 'etapas 2 a 4',
  },
];

/** Seasons from which the targets "todo clube campeão" and "robô no mais fraco" are required. */
export const LONG_RUN_SEASONS = 1000;
const LONG_RUN_SHOWN = '1.000';

/**
 * The weakest club of the ladder: the lowest `strength`, ties by the smaller id. `--robot weakest`
 * plays it, and the robot's G4 target (balance-targets.md, "Recomendação final") applies to it only.
 */
/** The engine's default strength (`DEFAULT_STRENGTH`, not exported by the engine index). */
const DEFAULT_STRENGTH = 70;

/** A club without `strength` plays at the engine's default. */
const strengthOf = (c: ClubDef) => c.strength ?? DEFAULT_STRENGTH;

export function weakestClub(clubs: readonly ClubDef[]): ClubId | undefined {
  let weakest: ClubDef | undefined;
  for (const c of clubs) {
    if (
      weakest === undefined ||
      strengthOf(c) < strengthOf(weakest) ||
      (strengthOf(c) === strengthOf(weakest) && c.id < weakest.id)
    )
      weakest = c;
  }
  return weakest?.id;
}

export interface RobotSummary {
  readonly club: ClubId;
  readonly seasons: number;
  /** Mean gain in points per season over the AI, same club and seeds, and its 95% interval. */
  readonly gain: number;
  readonly ci95: readonly [number, number];
  readonly robotPoints: number;
  readonly aiPoints: number;
  readonly robotTitles: number;
  readonly aiTitles: number;
  readonly robotG4: number;
  readonly aiG4: number;
}

export interface Report {
  readonly rows: readonly MetricRow[];
  /** Titles by club in the AI seasons, most first (ties by id). */
  readonly titles: readonly { readonly club: ClubId; readonly titles: number }[];
  /** The three most common scores, `"h×a"` with their share. */
  readonly topScores: readonly { readonly score: string; readonly share: number }[];
  /** Postures and pressures of the AI sheets by profile (shares of each profile's sheets). */
  readonly tacticsByProfile: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly robot?: RobotSummary;
}

/** pt-BR number: decimal comma. */
export function num(value: number, digits: number): string {
  return value.toFixed(digits).replace('.', ',');
}
export const pct = (share: number, digits = 1) => `${num(100 * share, digits)}%`;

type Check = { readonly min?: number; readonly max?: number };

function row(
  id: string,
  label: string,
  value: number | undefined,
  show: (v: number) => string,
  target: string,
  check: Check | ((v: number) => boolean),
  required = true,
): MetricRow {
  if (value === undefined || !Number.isFinite(value)) {
    return { id, label, shown: 'n/a', target, status: 'n/a', required };
  }
  const ok =
    typeof check === 'function'
      ? check(value)
      : (check.min === undefined || value >= check.min) &&
        (check.max === undefined || value <= check.max);
  return { id, label, value, shown: show(value), target, status: ok ? 'dentro' : 'fora', required };
}

const ratio = (n: number, d: number) => (d > 0 ? n / d : undefined);
const goalsShown = (v: number) => num(v, 2);
const rate2 = (v: number) => num(v, 2);
const rate3 = (v: number) => num(v, 3);
const share1 = (v: number) => pct(v);
const pointsShown = (v: number) => num(v, 1);
const pp = (v: number) => `${v >= 0 ? '+' : ''}${num(100 * v, 1)} p.p.`;

/** Mean and the 95% interval (normal approximation) of a list. */
export function meanCi(values: readonly number[]): { mean: number; ci95: [number, number] } {
  const n = values.length;
  const mean = values.reduce((s, x) => s + x, 0) / n;
  if (n < 2) return { mean, ci95: [mean, mean] };
  const variance = values.reduce((s, x) => s + (x - mean) * (x - mean), 0) / (n - 1);
  const half = 1.96 * Math.sqrt(variance / n);
  return { mean, ci95: [mean - half, mean + half] };
}

function sumMatches(seasons: readonly SeasonRecord[]): MatchTally {
  const total = emptyMatchTally();
  for (const s of seasons) mergeMatchTally(total, s.matches);
  return total;
}

function topScores(scores: Readonly<Record<string, number>>, matches: number) {
  return Object.entries(scores)
    .sort(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, 3)
    .map(([score, n]) => ({ score: score.replace('x', '×'), share: n / matches }));
}

function robotSummary(
  club: ClubId,
  ai: readonly SeasonRecord[],
  robot: readonly SeasonRecord[],
): RobotSummary | undefined {
  const byIndex = new Map(ai.map((s) => [s.index, s]));
  const gains: number[] = [];
  let robotPoints = 0;
  let aiPoints = 0;
  let robotTitles = 0;
  let aiTitles = 0;
  let robotG4 = 0;
  let aiG4 = 0;
  for (const r of robot) {
    const a = byIndex.get(r.index);
    if (a === undefined) continue;
    gains.push(r.points[club]! - a.points[club]!);
    robotPoints += r.points[club]!;
    aiPoints += a.points[club]!;
    if (r.table.champion === club) robotTitles += 1;
    if (a.table.champion === club) aiTitles += 1;
    if (r.positions[club]! <= 4) robotG4 += 1;
    if (a.positions[club]! <= 4) aiG4 += 1;
  }
  const n = gains.length;
  if (n === 0) return undefined;
  const { mean, ci95 } = meanCi(gains);
  return {
    club,
    seasons: n,
    gain: mean,
    ci95,
    robotPoints: robotPoints / n,
    aiPoints: aiPoints / n,
    robotTitles: robotTitles / n,
    aiTitles: aiTitles / n,
    robotG4: robotG4 / n,
    aiG4: aiG4 / n,
  };
}

/** The report of a run (see the header). `clubs` gives the name of the robot's club. */
export function buildReport(
  results: RunResults,
  options: {
    readonly robotClub?: ClubId;
    readonly clubs?: readonly ClubDef[];
    /** Seed of the run; "every club champion" is judged on seed 1 only (decision 16). */
    readonly seed?: number;
  } = {},
): Report {
  const { robotClub } = options;
  const { seasons } = results;
  const t = sumMatches(seasons);
  const m = t.matches;
  const n = seasons.length;
  const per = (x: number) => ratio(x, m);
  const mean = (f: (s: SeasonRecord) => number) =>
    n > 0 ? seasons.reduce((sum, s) => sum + f(s), 0) / n : undefined;
  const share = (f: (s: SeasonRecord) => boolean) =>
    n > 0 ? seasons.filter(f).length / n : undefined;
  const sumOf = (f: (s: SeasonRecord) => number) => seasons.reduce((sum, s) => sum + f(s), 0);

  const top = m > 0 ? topScores(t.scores, m) : [];
  const topKeys = top.map((s) => s.score);
  const fansN = sumOf((s) => s.fans.n);
  const fansMean = ratio(
    sumOf((s) => s.fans.sum),
    fansN,
  );
  const fansSd =
    fansMean === undefined
      ? undefined
      : Math.sqrt(Math.max(0, sumOf((s) => s.fans.sumSq) / fansN - fansMean * fansMean));
  const z4 = sumOf((s) => s.table.z4);
  const z4Gap = sumOf((s) => s.table.z4Gap);
  const sheets = sumOf((s) => s.sheets.sheets);

  const duel = (d: DuelTally | undefined, f: (d: DuelTally) => number) =>
    d === undefined || d.matches === 0 ? undefined : f(d) / d.matches;
  const d20 = results.calibrated.get(20);
  const d30 = results.calibrated.get(30);
  const d10 = results.calibrated.get(10);
  const d0 = results.calibrated.get(0);
  const ppg = (d: DuelTally | undefined) =>
    d === undefined || d.matches === 0 ? undefined : (3 * d.wins + d.draws) / d.matches;
  const referencePpg = ppg(results.tactical.get(REFERENCE_VARIANT.id));
  const allOut: AllOutTally | undefined = results.allOut;
  const allOutGain =
    allOut === undefined || allOut.samples === 0
      ? undefined
      : (allOut.allOutNotLost - allOut.keptNotLost) / allOut.samples;
  const robot =
    robotClub === undefined ? undefined : robotSummary(robotClub, seasons, results.robotSeasons);
  const robotName = robotClub === undefined ? 'clube' : clubName(options.clubs ?? [], robotClub);

  // "Todo clube campeão": only meaningful over a long run (LONG_RUN_SEASONS); shorter runs show the
  // count as information, never failing the CI.
  const allClubs = options.clubs ?? [];
  const titledClubs = new Set(seasons.map((x) => x.table.champion));
  const untitled = allClubs.filter((c) => !titledClubs.has(c.id));
  const everyChampionLong = n >= LONG_RUN_SEASONS;
  const seedJudged = options.seed === undefined || options.seed === 1;
  const everyChampionJudged = everyChampionLong && seedJudged;
  const everyChampion: MetricRow =
    allClubs.length === 0 || n === 0
      ? row(
          'everyChampion',
          'Todo clube campeão ao menos 1 vez',
          undefined,
          share1,
          '',
          () => true,
          false,
        )
      : {
          id: 'everyChampion',
          label: 'Todo clube campeão ao menos 1 vez',
          ...(everyChampionLong ? { value: untitled.length } : {}),
          shown: !everyChampionLong
            ? `n/a abaixo de ${LONG_RUN_SHOWN} temporadas`
            : untitled.length === 0
              ? `todos os ${allClubs.length}`
              : `${allClubs.length - untitled.length} de ${allClubs.length} (sem título: ${untitled
                  .map((c) => c.shortName)
                  .join(', ')})`,
          target: `todos, em ${LONG_RUN_SHOWN} temporadas ou mais`,
          status: everyChampionLong ? (untitled.length === 0 ? 'dentro' : 'fora') : 'n/a',
          required: everyChampionJudged,
        };
  // The robot's G4 target applies only to the robot on the weakest club of the ladder, and is
  // required from LONG_RUN_SEASONS paired seasons (below that it is shown, as information).
  // Decision 10's targets (gain, title) are defined for the reference club; elsewhere: info.
  const robotIsReference = robotClub === undefined || robotClub === DEFAULT_ROBOT_CLUB;
  const onWeakest = robotClub !== undefined && robotClub === weakestClub(allClubs);
  const robotWeakG4 = row(
    'robotWeakG4',
    'Robô no clube mais fraco: G4',
    onWeakest ? robot?.robotG4 : undefined,
    share1,
    'ao menos 2%',
    { min: 0.02 },
    onWeakest && robot !== undefined && robot.seasons >= LONG_RUN_SEASONS && seedJudged,
  );

  const rows: MetricRow[] = [
    // Partida e resultados
    row('goals', 'Gols por partida', per(t.goals), goalsShown, '2,65 (2,50 a 2,80)', {
      min: 2.5,
      max: 2.8,
    }),
    row(
      'strong20',
      'Vitória do time 20 pontos mais forte',
      duel(d20, (d) => d.wins),
      share1,
      '65% (62% a 68%)',
      { min: 0.62, max: 0.68 },
    ),
    row(
      'upset30',
      'Zebra: time 30 pontos mais fraco vence',
      duel(d30, (d) => d.losses),
      share1,
      '10% (8% a 12%)',
      { min: 0.08, max: 0.12 },
    ),
    row('draws', 'Empates', per(t.draws), share1, '26% (24% a 28%)', { min: 0.24, max: 0.28 }),
    row('homeWins', 'Vitórias do mandante', per(t.homeWins), share1, '47,5% (45% a 50%)', {
      min: 0.45,
      max: 0.5,
    }),
    row(
      'topScores',
      'Placar mais comum',
      m > 0 ? 1 : undefined,
      () => top.map((s) => `${s.score} ${pct(s.share)}`).join(', '),
      '1×1 e 1×0 entre os 3 mais frequentes',
      () => topKeys.includes('1×1') && topKeys.includes('1×0'),
    ),
    row('nilNil', '0×0', per(t.nilNil), share1, '7% (6% a 9%)', { min: 0.06, max: 0.09 }),
    row('margin3', 'Goleada (diferença ≥ 3)', per(t.margin3), share1, '11% (8% a 13%)', {
      min: 0.08,
      max: 0.13,
    }),
    row('margin5', 'Placar grande (diferença ≥ 5)', per(t.margin5), share1, '1% (0,5% a 2%)', {
      min: 0.005,
      max: 0.02,
    }),
    row('yellows', 'Amarelos por partida', per(t.yellows), rate2, '4,0 (3,5 a 4,5)', {
      min: 3.5,
      max: 4.5,
    }),
    row('reds', 'Vermelhos por partida', per(t.reds), rate3, '0,18 (0,11 a 0,25)', {
      min: 0.11,
      max: 0.25,
    }),
    row('injuries', 'Lesões por partida', per(t.injuries), rate3, '0,30 (0,20 a 0,40)', {
      min: 0.2,
      max: 0.4,
    }),
    row(
      'injuryRounds',
      'Duração média das lesões (rodadas)',
      ratio(t.injuryRounds, t.injuries),
      rate2,
      '2 a 3',
      { min: 2, max: 3 },
    ),
    row('penalties', 'Pênaltis por partida', per(t.penalties), rate3, '0,25 (0,17 a 0,33)', {
      min: 0.17,
      max: 0.33,
    }),
    row(
      'penaltyGoals',
      'Conversão dos pênaltis',
      ratio(t.penaltyGoals, t.penalties),
      share1,
      '72% a 82%',
      { min: 0.72, max: 0.82 },
    ),
    row(
      'subs',
      'Substituições por time',
      ratio(t.subs, 2 * m),
      rate2,
      '3 a 4 (ia-clubes.md)',
      { min: 3, max: 4 },
      false,
    ),
    // Táticas
    ...TACTIC_VARIANTS.map((v) =>
      row(
        `tactic-${v.id}`,
        `Tática ${tacticLabel(v.id)} contra 4-4-2 equilibrada média (V − D)`,
        duel(results.tactical.get(v.id), (d) => d.wins - d.losses),
        pp,
        '0 (−3 a +3 p.p.)',
        { min: -0.03, max: 0.03 },
        v.info !== true,
      ),
    ),
    row(
      'allOut',
      '"Tudo no ataque" a partir de 0×1 aos 75\' (P(não perder))',
      allOutGain,
      pp,
      'sobe ≥ 3 p.p. contra equilibrada',
      { min: 0.03 },
    ),
    row(
      'tactic-ppg-reference',
      'Pontos por jogo: 4-4-2 equilibrada média contra ela mesma',
      referencePpg,
      rate3,
      'referência dos pontos por jogo',
      () => true,
      false,
    ),
    ...TACTIC_VARIANTS.map((v) => {
      const own = ppg(results.tactical.get(v.id));
      return row(
        `tactic-ppg-${v.id}`,
        `Pontos por jogo: ${tacticLabel(v.id)} (diferença da referência)`,
        own === undefined || referencePpg === undefined ? undefined : own - referencePpg,
        (diff) => `${num(own!, 3)} (${diff >= 0 ? '+' : ''}${num(diff, 3)})`,
        `±${num(PPG_TOLERANCE, 2)} da referência`,
        { min: -PPG_TOLERANCE, max: PPG_TOLERANCE },
        false,
      );
    }),
    // Tabela
    row(
      'champion',
      'Pontos do campeão',
      mean((s) => s.table.championPoints),
      pointsShown,
      '77 (72 a 82)',
      { min: 72, max: 82 },
    ),
    row(
      'seventeenth',
      'Pontos do 17º colocado',
      mean((s) => s.table.seventeenthPoints),
      pointsShown,
      '42 (39 a 45)',
      { min: 39, max: 45 },
    ),
    row('fansMean', 'Termômetro da torcida: média', fansMean, (v) => num(v, 1), '55 (50 a 60)', {
      min: 50,
      max: 60,
    }),
    row(
      'fansBelow20',
      'Termômetro abaixo de 20',
      ratio(
        sumOf((s) => s.fans.below20),
        fansN,
      ),
      share1,
      'no máximo 5%',
      { max: 0.05 },
    ),
    row(
      'fansAbove90',
      'Termômetro acima de 90',
      ratio(
        sumOf((s) => s.fans.above90),
        fansN,
      ),
      share1,
      'no máximo 5%',
      { max: 0.05 },
    ),
    row(
      'fansSd',
      'Termômetro: desvio',
      fansSd,
      (v) => num(v, 1),
      'acima de 15 (torcida.md)',
      { min: 15 },
      false,
    ),
    // Porte e zebras
    row(
      'bigChampion',
      'Campeão grande',
      share((s) => s.table.championSize === 'big'),
      share1,
      '50% a 90%',
      { min: 0.5, max: 0.9 },
    ),
    row(
      'smallChampion',
      'Campeão pequeno',
      share((s) => s.table.championSize === 'small'),
      share1,
      '0,5% a 4%',
      { min: 0.005, max: 0.04 },
    ),
    everyChampion,
    // Informative in the single season (BIG_RELEGATED_NOTE).
    {
      ...row(
        'bigRelegated',
        'Grande rebaixado (ao menos um)',
        share((s) => s.table.bigRelegated),
        share1,
        '40% a 80% das temporadas',
        { min: 0.4, max: 0.8 },
        false,
      ),
      note: BIG_RELEGATED_NOTE,
    },
    row(
      'strongChampion',
      'Campeão entre os 6 mais fortes da escada',
      share((s) => s.table.strongChampion),
      share1,
      'referência (clubes-serie-a.md, item 4)',
      () => true,
      false,
    ),
    row(
      'strongRelegated',
      'Algum dos 6 mais fortes rebaixado',
      share((s) => s.table.strongRelegated),
      share1,
      'referência (clubes-serie-a.md, item 4)',
      () => true,
      false,
    ),
    row(
      'weakInG4',
      'Clube fraco no G4 (4 mais fracos da escada)',
      share((s) => s.table.weakInG4),
      share1,
      '10% (5% a 15%)',
      { min: 0.05, max: 0.15 },
    ),
    row(
      'z4Escape',
      'Fuga do Z4 depois da rodada 30',
      ratio(
        sumOf((s) => s.table.z4Escaped),
        z4,
      ),
      share1,
      '20% (15% a 30%)',
      { min: 0.15, max: 0.3 },
    ),
    row(
      'z4EscapeGap',
      'Fuga do Z4 de 6 a 8 pontos atrás do 16º',
      ratio(
        sumOf((s) => s.table.z4GapEscaped),
        z4Gap,
      ),
      share1,
      'ao menos 3%',
      { min: 0.03 },
    ),
    // Técnico-robô
    row(
      'robotGain',
      `Técnico-robô bom no ${robotName}: ganho por temporada`,
      robot?.gain,
      (v) =>
        `${v >= 0 ? '+' : ''}${num(v, 1)} pts (IC 95% ${num(robot!.ci95[0], 1)} a ${num(robot!.ci95[1], 1)})`,
      '+2 a +8 pontos',
      { min: 2, max: 8 },
      robotIsReference,
    ),
    row(
      'robotTitles',
      `Título do ${robotName} com o robô (temporada única)`,
      robot?.robotTitles,
      share1,
      'no máximo 5%',
      { max: 0.05 },
      robotIsReference,
    ),
    robotWeakG4,
    // Referências (info)
    row(
      'strong10',
      'Duelo de 10 pontos: mais forte vence',
      duel(d10, (d) => d.wins),
      share1,
      'referência',
      () => true,
      false,
    ),
    row(
      'draws0',
      'Duelo de forças iguais: empates',
      duel(d0, (d) => d.draws),
      share1,
      'referência',
      () => true,
      false,
    ),
    row(
      'highPressure',
      'Fichas da IA com pressão alta',
      ratio(
        sumOf((s) => s.sheets.highPressure),
        sheets,
      ),
      share1,
      'referência (cerca de 38%, ia-clubes.md)',
      () => true,
      false,
    ),
    row(
      'tiredStarter',
      'Fichas com titular abaixo de 75 de condição',
      ratio(
        sumOf((s) => s.sheets.tiredStarter),
        sheets,
      ),
      share1,
      'abaixo de 5% (ia-clubes.md)',
      { max: 0.05 },
      false,
    ),
    // Metas futuras: "n/a" until their stage, never counted.
    ...FUTURE_TARGETS.map((f) =>
      row(
        f.id,
        f.label,
        undefined,
        () => '',
        f.stage,
        () => true,
        false,
      ),
    ),
  ];

  rows.push(...chainRows(results));

  const titleCount = new Map<ClubId, number>();
  for (const s of seasons)
    titleCount.set(s.table.champion, (titleCount.get(s.table.champion) ?? 0) + 1);
  const titles = [...titleCount.entries()]
    .sort(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0))
    .map(([club, count]) => ({ club, titles: count }));

  const tacticsByProfile: Record<string, Record<string, number>> = {};
  for (const s of seasons) {
    for (const [profile, counts] of Object.entries(s.sheets.byProfile)) {
      const total = (tacticsByProfile[profile] ??= {});
      for (const [key, count] of Object.entries(counts ?? {}))
        total[key] = (total[key] ?? 0) + count;
    }
  }
  for (const counts of Object.values(tacticsByProfile)) {
    const profileSheets =
      (counts['pressure-low'] ?? 0) +
      (counts['pressure-medium'] ?? 0) +
      (counts['pressure-high'] ?? 0);
    for (const key of Object.keys(counts)) counts[key] = counts[key]! / profileSheets;
  }

  return { rows, titles, topScores: top, tacticsByProfile, ...(robot ? { robot } : {}) };
}

/**
 * A row measured on the league seasons: not the duels, the tactics, the robot nor the targets of
 * later stages, which do not change with `--chain`.
 */
function isLeagueRow(id: string): boolean {
  return !(
    ['strong20', 'upset30', 'allOut', 'strong10', 'draws0'].includes(id) ||
    /^(tactic-|robot|future-)/.test(id)
  );
}

/**
 * The rows of a `--chain` run (empty without one): for each season of the chain from the 2nd,
 * every 1a league target measured on that season of all careers (`chain-s<k>-<id>`, without the
 * duels and the robot, which do not change with the chain), and for every season the "Virada de
 * temporada" rows (`turn-s<k>-...`): the league's mean `strength`, within ±1.0 of season 1 from
 * season 2 on, its deviation, 3.5 to 5.5, the gap from the 1st to the 20th, 12 to 20, and the
 * drift lock (decision 15): the gap between the big clubs and the others and the one between the
 * 4 strongest and the 4 weakest of season 1, each within ±0.5 of season 1 from season 2 on.
 * Seasons up to CHAIN_REQUIRED_SEASONS are required; the later ones are informative. In seasons 2
 * to CHAIN_REQUIRED_SEASONS the CHAIN_INFO_TARGETS are informative too (CHAIN_INFO_NOTE).
 */
export function chainRows(results: Pick<RunResults, 'chain'>): MetricRow[] {
  const chain = results.chain ?? [];
  if (chain.length < 2) return [];
  const rows: MetricRow[] = [];
  const meanOf = (records: readonly SeasonRecord[], f: (s: StrengthRecord) => number) => {
    const values = records.flatMap((r) => (r.strength === undefined ? [] : [f(r.strength)]));
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
  };
  const first = meanOf(chain[0]!, (s) => s.mean);
  const gaps = [
    {
      key: 'sizeGap',
      label: 'Força: grandes − não grandes',
      drift: 'Deriva da força: grandes − não grandes',
    },
    {
      key: 'ladderGap',
      label: 'Força: 4 mais fortes − 4 mais fracos',
      drift: 'Deriva da força: 4 mais fortes − 4 mais fracos da temporada 1',
    },
  ] as const;
  const firstGap = Object.fromEntries(
    gaps.map((g) => [g.key, meanOf(chain[0]!, (s) => s[g.key])]),
  ) as Record<(typeof gaps)[number]['key'], number | undefined>;
  const signed = (v: number) => `${v >= 0 ? '+' : ''}${num(v, 2)}`;
  chain.forEach((records, i) => {
    const season = i + 1;
    const required = season <= CHAIN_REQUIRED_SEASONS;
    const label = (text: string) => `${text}, temporada ${season}`;
    const mean = meanOf(records, (s) => s.mean);
    rows.push(
      season === 1
        ? row(
            `${turnPrefix(season)}strengthMean`,
            label('Força média da liga'),
            mean,
            (v) => num(v, 2),
            'referência das temporadas seguintes',
            () => true,
            false,
          )
        : row(
            `${turnPrefix(season)}strengthMean`,
            label('Força média da liga'),
            mean,
            (v) => `${num(v, 2)} (${v - first! >= 0 ? '+' : ''}${num(v - first!, 2)})`,
            `±${num(CHAIN_STRENGTH_DRIFT, 1)} da temporada 1`,
            (v) => first !== undefined && Math.abs(v - first) <= CHAIN_STRENGTH_DRIFT,
            required,
          ),
      row(
        `${turnPrefix(season)}strengthSd`,
        label('Desvio da força'),
        meanOf(records, (s) => s.sd),
        (v) => num(v, 2),
        '3,5 a 5,5',
        { min: 3.5, max: 5.5 },
        required,
      ),
      row(
        `${turnPrefix(season)}strengthRange`,
        label('1º − 20º em força'),
        meanOf(records, (s) => s.range),
        (v) => num(v, 1),
        '12 a 20',
        { min: 12, max: 20 },
        required,
      ),
      ...gaps.map((g) => {
        const id = `${turnPrefix(season)}${g.key}`;
        const value = meanOf(records, (s) => s[g.key]);
        const base = firstGap[g.key];
        if (season === 1) {
          return row(
            id,
            label(g.label),
            value,
            (v) => num(v, 2),
            'referência da trava de deriva',
            () => true,
            false,
          );
        }
        // The drift lock: the gap of this season minus that of season 1 (decision 15).
        return row(
          id,
          label(g.drift),
          value === undefined || base === undefined ? undefined : value - base,
          (d) => `${signed(d)} (${num(value!, 2)})`,
          `±${num(CHAIN_GAP_DRIFT, 1)} da temporada 1 (decisão 15)`,
          { min: -CHAIN_GAP_DRIFT, max: CHAIN_GAP_DRIFT },
          required,
        );
      }),
    );
  });
  chain.forEach((records, i) => {
    const season = i + 1;
    if (season === 1) return;
    const report = buildReport({
      seasons: records,
      robotSeasons: [],
      calibrated: new Map(),
      tactical: new Map(),
    });
    for (const r of report.rows) {
      if (!isLeagueRow(r.id)) continue;
      const rest: MetricRow = { ...r };
      delete (rest as { note?: string }).note;
      const required = season <= CHAIN_REQUIRED_SEASONS;
      const info = required && CHAIN_INFO_TARGETS.includes(r.id);
      rows.push({
        ...rest,
        id: `${chainPrefix(season)}${r.id}`,
        label: `${r.label}, temporada ${season}`,
        required: r.required && required && !info,
        ...(info ? { note: CHAIN_INFO_NOTE } : {}),
      });
    }
  });
  return rows;
}

function tacticLabel(id: string): string {
  const labels: Record<string, string> = {
    defensive: 'postura defensiva',
    attacking: 'postura ofensiva',
    'pressure-low': 'pressão baixa',
    'pressure-high': 'pressão alta',
    'allout-60': '"tudo no ataque" desde o minuto 60 (atalho, pressão alta)',
    'allout-60-medium': '"tudo no ataque" desde o minuto 60 (postura, pressão média)',
    'allout-60-low': '"tudo no ataque" desde o minuto 60 (postura, pressão baixa)',
  };
  return labels[id] ?? id;
}

/**
 * The rows of a multi-seed run's seed: the RARE_TARGETS stop counting there (`verdict: 'pooled'`),
 * since they are judged on the seeds together ({@link pooledRows}).
 * The rare rows already informative are left as they are.
 */
export function withPooledVerdict(report: Report): Report {
  return {
    ...report,
    rows: report.rows.map((r) =>
      // An informative rare row (CHAIN_INFO_TARGETS, a season past CHAIN_REQUIRED_SEASONS) stays
      // informative: it does not count in the total either.
      isRare(r.id) && r.required ? { ...r, required: false, verdict: 'pooled' as const } : r,
    ),
  };
}

/**
 * The RARE_TARGETS rows measured on the seasons of every seed together; in a `--chain` run, also
 * those of each season of the chain (its seasons of every seed together).
 */
export function pooledRows(runs: readonly RunResults[]): MetricRow[] {
  const length = Math.max(0, ...runs.map((r) => r.chain?.length ?? 0));
  const chain = Array.from({ length }, (_, k) => runs.flatMap((r) => r.chain?.[k] ?? []));
  const all: RunResults = {
    seasons: runs.flatMap((r) => r.seasons),
    ...(length > 0 ? { chain } : {}),
    robotSeasons: [],
    calibrated: new Map(),
    tactical: new Map(),
  };
  return buildReport(all).rows.filter((r) => isRare(r.id));
}

/** Required rows that were not measured in this run ("n/a": no league, duels or robot). */
export function notMeasured(report: Pick<Report, 'rows'>): MetricRow[] {
  return report.rows.filter((r) => r.required && r.status === 'n/a');
}

/** Exit code of a run: 1 when a required row is "fora". */
export function exitCode(report: Pick<Report, 'rows'>): 0 | 1 {
  return report.rows.some((r) => r.required && r.status === 'fora') ? 1 : 0;
}

/** Name of a club for the report (its short name), or the id. */
export function clubName(clubs: readonly ClubDef[], id: ClubId): string {
  return clubs.find((c) => c.id === id)?.shortName ?? id;
}
