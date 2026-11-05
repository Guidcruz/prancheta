import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PARAM_FILES } from './options.ts';

/*
 * `npm run balance` end to end, in plain Node as the CI runs it (US-013): reproducible, the
 * `--params` file never touches app/src/params/, `--seed` changes the run (and takes several
 * seeds), and the exit code follows the required targets. Small runs (1 season, 100 duel matches) keep it to seconds.
 */

const script = fileURLToPath(new URL('../balance.ts', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'balance-cli-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function run(args: readonly string[]) {
  const out = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

const small = ['--seasons', '1', '--duels', '100', '--robot', 'none'];

describe('npm run balance', { timeout: 120_000 }, () => {
  type Parsed = {
    exitCode: number;
    failed: string[];
    rows: { id: string; status: string; value?: number; required: boolean }[];
    run: { seasons: number; matches: number; seed: number; overrides: string[] };
  };
  let first: ReturnType<typeof run>;
  let report: Parsed;
  beforeAll(() => {
    first = run([...small, '--json', '--workers', '1']);
    report = JSON.parse(first.stdout) as Parsed;
  }, 60_000);

  it('prints every 1a metric with its status and the time on stderr', () => {
    expect(report.run).toMatchObject({ seasons: 1, matches: 380, seed: 1, overrides: [] });
    for (const id of [
      'goals',
      'strong20',
      'upset30',
      'draws',
      'homeWins',
      'champion',
      'seventeenth',
    ]) {
      const row = report.rows.find((r) => r.id === id);
      expect(row?.status, id).toMatch(/^(dentro|fora)$/);
    }
    // No robot in this run: its rows are not measured.
    expect(report.rows.find((r) => r.id === 'robotGain')?.status).toBe('n/a');
    expect(first.stderr).toMatch(/^Tempo: \d+,\d s/m);
  });

  it('exits with 1 exactly when a required target is out', () => {
    const out = report.rows.filter((r) => r.required && r.status === 'fora').map((r) => r.id);
    expect(report.failed).toEqual(out);
    expect(first.status).toBe(out.length > 0 ? 1 : 0);
    expect(report.exitCode).toBe(first.status);
  });

  it('gives the same output twice, with any number of workers', () => {
    expect(run([...small, '--json', '--workers', '1']).stdout).toBe(first.stdout);
    expect(run([...small, '--json', '--workers', '3']).stdout).toBe(first.stdout);
  });

  it('gives another run with another seed', () => {
    const other = run([...small, '--json', '--seed', '2', '--workers', '2']);
    expect(other.stdout).not.toBe(first.stdout);
    expect(JSON.parse(other.stdout).run.seed).toBe(2);
  });

  it('uses the --params file on top of app/src/params/ without changing it', () => {
    const repo = () =>
      PARAM_FILES.map((name) =>
        readFileSync(new URL(`../../app/src/params/${name}.json`, import.meta.url), 'utf8'),
      );
    const before = repo();
    const file = join(dir, 'chance.json');
    writeFileSync(file, JSON.stringify({ match: { baseChance: 0.07 } }));
    const changed = run([...small, '--json', '--params', file, '--workers', '2']);
    const parsed = JSON.parse(changed.stdout);
    expect(parsed.run.overrides).toEqual(['match.baseChance']);
    const goals = (r: { rows: { id: string; value?: number }[] }) =>
      r.rows.find((x) => x.id === 'goals')!.value!;
    expect(goals(parsed)).toBeLessThan(goals(report));
    expect(repo()).toEqual(before);
  });

  it('prints the table for people by default', () => {
    const text = run(['--seasons', '1', '--duels', '0', '--robot', 'none', '--workers', '2']);
    expect(text.stdout).toContain('Gols por partida');
    expect(text.stdout).toMatch(/Metas obrigatórias: \d+ de \d+ dentro/);
    expect(text.stdout).toContain(
      'Notas:\n  Grande rebaixado (ao menos um): informativa na temporada única (decisão do CEO de 2026-11-05); volta a valer na carreira longa',
    );
  });

  it('runs several seeds, each as alone, and judges the rare targets on their sum', () => {
    const args = ['--seasons', '1', '--duels', '0', '--robot', 'none', '--workers', '2'];
    const multi = run([...args, '--seed', '1,2', '--json']);
    const parsed = JSON.parse(multi.stdout) as {
      exitCode: number;
      seeds: Parsed[];
      pooled: { seeds: number[]; seasons: number; rows: { id: string; required: boolean }[] };
    };
    expect(parsed.seeds.map((s) => s.run.seed)).toEqual([1, 2]);
    expect(parsed.pooled).toMatchObject({ seeds: [1, 2], seasons: 2 });
    expect(parsed.pooled.rows.map((r) => [r.id, r.required])).toEqual([
      ['smallChampion', true],
      ['weakInG4', true],
      ['z4EscapeGap', true],
    ]);
    const alone = JSON.parse(run([...args, '--seed', '2', '--json']).stdout) as Parsed;
    const value = (r: Parsed, id: string) => r.rows.find((x) => x.id === id)!.value;
    expect(value(parsed.seeds[1]!, 'goals')).toBe(value(alone, 'goals'));
    expect(parsed.seeds[1]!.rows.find((x) => x.id === 'smallChampion')!.required).toBe(false);
    expect(multi.status).toBe(parsed.exitCode);
    const text = run([...args, '--seed', '1,2']).stdout;
    expect(text).toContain('=== Semente 2 ===');
    expect(text).toContain('=== Soma das sementes 1, 2 (2 temporadas): metas raras ===');
    expect(text).toMatch(/^Resultado: /m);
  });

  it('refuses a bad flag, a bad --params file and an unknown robot club with exit code 2', () => {
    expect(run(['--seasons', 'x']).status).toBe(2);
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, JSON.stringify({ match: { comfortableLeadPower: 2 } }));
    const refused = run(['--params', bad]);
    expect(refused.status).toBe(2);
    expect(refused.stderr).toContain('match.comfortableLeadPower: out-of-range');
    expect(run(['--robot', 'clube-que-nao-existe']).status).toBe(2);
  });
});
