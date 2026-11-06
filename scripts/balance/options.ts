import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { validateParams } from '../../app/src/engine/index.ts';
import type { ClubDef, GameParams, ParamIssue } from '../../app/src/engine/index.ts';

/*
 * Command line and inputs of the /balance (docs/02-architecture.md, 7, T-016; US-013): the flags,
 * the parameters of app/src/params/ (with the overrides of `--params <file>`, which never touch
 * the repository files) and the 20 clubs of app/src/data/clubs.serie-a.json.
 */

/** The six parameter files, under their keys of GameParams. */
export const PARAM_FILES = ['match', 'players', 'generation', 'ai', 'season', 'fans'] as const;

/** Reference club of the robot coach (balance-targets.md, decision 10: the Coritibom). */
export const DEFAULT_ROBOT_CLUB = 'coritibom';

export interface BalanceOptions {
  /** Seasons of the league (each a new career; 0 skips the league and the robot). */
  readonly seasons: number;
  /**
   * Base seeds, in the given order, without repeats: season `i` of seed `s` uses
   * `seedFromString(`balance-${s}-${i}`)`. More than one (`--seed 1,2,3`) runs each and judges
   * the rare targets on all of them together.
   */
  readonly seeds: readonly number[];
  /**
   * Seasons of each career (`--chain`, 1 to CHAIN_MAX; T-017): with 2 or more, each league season
   * is a career that goes on through the engine's season turn. 1 is the single-season run.
   */
  readonly chain: number;
  /** Matches of each duel (calibrated, tactical and "tudo no ataque"); 0 skips the duels. */
  readonly duels: number;
  /** File with parameter overrides (same shape as GameParams, any subset of it). */
  readonly paramsFile?: string;
  /** Club played by the robot coach, or undefined to skip it (`--robot none`). */
  readonly robot?: string;
  readonly json: boolean;
  /** Worker threads; the output does not depend on it. */
  readonly workers: number;
  readonly help: boolean;
}

/** Most seasons of a `--chain` career. */
export const CHAIN_MAX = 30;
/** Seasons of a `--chain` career that count as required targets; the later ones are info. */
export const CHAIN_REQUIRED = 3;

export const USAGE = `Uso: npm run balance -- [opções]

  --seasons <n>    temporadas da Série A (padrão 200; 0 pula a liga e o robô)
  --seed <n>       semente base, inteiro >= 0 (padrão 1); várias separadas por vírgula
                   (--seed 1,2,3) rodam cada uma e julgam as metas raras (campeão pequeno,
                   clube fraco no G4, fuga do Z4 de 6 a 8 pontos) na soma das temporadas
  --chain <n>      temporadas encadeadas por carreira, de 1 a ${CHAIN_MAX} (padrão 1): cada temporada
                   da liga vira uma carreira com evolução e virada do motor; as temporadas 1 a
                   ${CHAIN_REQUIRED} contam como metas obrigatórias, as seguintes são informativas,
                   exceto campeão grande, campeão pequeno e clube fraco no G4 nas temporadas 2 e 3, informativas
                   (decisões 15 e 17); trava de deriva de ±0,5 obrigatória nas temporadas 2 e 3
  --duels <n>      jogos de cada duelo calibrado e tático (padrão 20000; 0 pula os duelos)
  --params <arq>   JSON com parâmetros que sobrescrevem os de app/src/params/ (qualquer parte)
  --robot <clube>  clube do técnico-robô (padrão ${DEFAULT_ROBOT_CLUB}; "none" pula o robô;
                   "weakest" é o clube mais fraco da escada: menor força, empate pelo id, e só
                   nele vale a meta do robô no G4, obrigatória com 1.000 temporadas ou mais)
  --json           saída em JSON
  --workers <n>    threads de trabalho (padrão: até 4); o resultado não muda com elas
  --help           esta ajuda

Códigos de saída:
  0  todas as metas obrigatórias dentro (as não medidas, "n/a", não contam)
  1  alguma meta obrigatória fora
  2  erro de uso (opção, arquivo de --params ou clube do robô inválidos)
  3  falha da ferramenta (exceção ou thread de trabalho que caiu); o erro sai no stderr
O tempo gasto e os avisos saem no stderr, para a saída padrão ser idêntica entre duas execuções.`;

export type ParsedArgs = { ok: true; options: BalanceOptions } | { ok: false; error: string };

function integer(flag: string, raw: string | undefined, min: number): number | string {
  if (raw === undefined || !/^\d+$/.test(raw)) return `${flag} precisa de um inteiro >= ${min}`;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min) return `${flag} precisa de um inteiro >= ${min}`;
  return value;
}

/** `--seed`: one integer >= 0, or several separated by commas, without repeats. */
function seedList(raw: string | undefined): readonly number[] | string {
  const error = '--seed precisa de um inteiro >= 0 ou de vários separados por vírgula (1,2,3)';
  if (raw === undefined || !/^\d+(,\d+)*$/.test(raw)) return error;
  const seeds = raw.split(',').map(Number);
  if (!seeds.every(Number.isSafeInteger)) return error;
  if (new Set(seeds).size !== seeds.length) return `--seed com semente repetida: ${raw}`;
  return seeds;
}

/** Parses the flags after `npm run balance --`. Never throws: a bad flag is an error result. */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  let seasons = 200;
  let seeds: readonly number[] = [1];
  let duels = 20_000;
  let chain = 1;
  let paramsFile: string | undefined;
  let robot: string | undefined = DEFAULT_ROBOT_CLUB;
  let json = false;
  let workers = Math.max(1, Math.min(4, availableParallelism()));
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]!;
    const [name, inline] = flag.includes('=') ? flag.split(/=(.*)/s, 2) : [flag, undefined];
    const next = () => inline ?? argv[++i];
    switch (name) {
      case '--seasons': {
        const v = integer(name, next(), 0);
        if (typeof v === 'string') return { ok: false, error: v };
        seasons = v;
        break;
      }
      case '--seed': {
        const v = seedList(next());
        if (typeof v === 'string') return { ok: false, error: v };
        seeds = v;
        break;
      }
      case '--duels': {
        const v = integer(name, next(), 0);
        if (typeof v === 'string') return { ok: false, error: v };
        duels = v;
        break;
      }
      case '--chain': {
        const v = integer(name, next(), 1);
        if (typeof v === 'string' || v > CHAIN_MAX) {
          return { ok: false, error: `--chain precisa de um inteiro de 1 a ${CHAIN_MAX}` };
        }
        chain = v;
        break;
      }
      case '--workers': {
        const v = integer(name, next(), 1);
        if (typeof v === 'string') return { ok: false, error: v };
        workers = v;
        break;
      }
      case '--params': {
        const v = next();
        if (v === undefined || v === '')
          return { ok: false, error: '--params precisa de um arquivo' };
        paramsFile = v;
        break;
      }
      case '--robot': {
        const v = next();
        if (v === undefined || v === '') return { ok: false, error: '--robot precisa de um clube' };
        robot = v === 'none' ? undefined : v;
        break;
      }
      case '--json':
        json = true;
        break;
      case '--help':
      case '-h':
        help = true;
        break;
      default:
        return { ok: false, error: `opção desconhecida: ${flag}` };
    }
  }
  return {
    ok: true,
    options: { seasons, seeds, chain, duels, paramsFile, robot, json, workers, help },
  };
}

const repoFile = (path: string) => new URL(`../../${path}`, import.meta.url);

function readJson(url: URL | string): unknown {
  return JSON.parse(readFileSync(url, 'utf8')) as unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `base` with `patch` on top, key by key; a list or a number in the patch replaces the base value.
 * `changed` collects the dotted path of every leaf the patch sets. A `__proto__` key (JSON.parse
 * keeps it as an own key) is never merged, since assigning it would swap the object's prototype
 * and the validator would never see it; its path goes to `ignored`.
 */
export function mergeParams(
  base: unknown,
  patch: unknown,
  changed: string[] = [],
  path = '',
  ignored: string[] = [],
): unknown {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    changed.push(path);
    return patch;
  }
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const at = path ? `${path}.${key}` : key;
    if (key === '__proto__') {
      ignored.push(at);
      continue;
    }
    out[key] = mergeParams(base[key], value, changed, at, ignored);
  }
  return out;
}

export type LoadedParams =
  | {
      ok: true;
      params: GameParams;
      overrides: readonly string[];
      /** Warnings for stderr (a `__proto__` key of the `--params` file, ignored). */
      warnings: readonly string[];
    }
  | { ok: false; error: string; issues?: readonly ParamIssue[] };

/** The six JSON files of app/src/params/, under their keys, before validation. */
export function repositoryParams(): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const name of PARAM_FILES) raw[name] = readJson(repoFile(`app/src/params/${name}.json`));
  return raw;
}

/**
 * The parameters of the run: the repository files with the overrides of `paramsFile` on top,
 * through `validateParams` (an override out of range is refused with the issues).
 */
export function loadParams(paramsFile?: string): LoadedParams {
  let raw: unknown = repositoryParams();
  const overrides: string[] = [];
  const ignored: string[] = [];
  if (paramsFile !== undefined) {
    let patch: unknown;
    try {
      patch = readJson(paramsFile);
    } catch (error) {
      return { ok: false, error: `não li ${paramsFile}: ${(error as Error).message}` };
    }
    if (!isPlainObject(patch)) return { ok: false, error: `${paramsFile} não é um objeto JSON` };
    raw = mergeParams(raw, patch, overrides, '', ignored);
  }
  const result = validateParams(raw);
  if (!result.ok) return { ok: false, error: 'parâmetros inválidos', issues: result.detail };
  const warnings = ignored.map(
    (path) => `Aviso: ${paramsFile}: a chave "__proto__" (${path}) não é parâmetro e foi ignorada`,
  );
  return { ok: true, params: result.value, overrides: overrides.sort(), warnings };
}

/** One line per issue (the same text as app/src/lib/params.ts, which Node cannot load here). */
export function formatIssues(issues: readonly ParamIssue[]): string {
  return issues
    .map((issue) => {
      const range = issue.range ? ` (faixa ${issue.range.min}..${issue.range.max})` : '';
      return `${issue.path || '(raiz)'}: ${issue.problem}, valor ${String(issue.value)}${range}`;
    })
    .join('\n');
}

/** The 20 clubs of the Série A (US-001), as approved by the CEO. */
export function serieAClubs(): ClubDef[] {
  return readJson(repoFile('app/src/data/clubs.serie-a.json')) as ClubDef[];
}
