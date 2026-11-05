import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

/*
 * QA acceptance of T-016 / US-013 that the other balance tests leave to chance: exit code 1 with a
 * target forced out, identical output across thread counts with several seeds, and the --params
 * run leaving app/src/params/ exactly as it was (files, sizes and modification times).
 */

const script = fileURLToPath(new URL('../balance.ts', import.meta.url));
const paramsDir = fileURLToPath(new URL('../../app/src/params/', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'balance-qa-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const run = (args: readonly string[]) => {
  const out = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
};
const small = ['--seasons', '1', '--duels', '0', '--robot', 'none'];

const snapshot = () =>
  readdirSync(paramsDir)
    .sort()
    .map((name) => {
      const s = statSync(join(paramsDir, name));
      return [name, s.size, s.mtimeMs];
    });

describe('npm run balance, QA acceptance', { timeout: 120_000 }, () => {
  it('exits with 1 (not 0, 2 or 3) when a required target is forced out', () => {
    const file = join(dir, 'few-goals.json');
    writeFileSync(file, JSON.stringify({ match: { baseChance: 0.03 } }));
    const r = run([...small, '--json', '--params', file, '--workers', '2']);
    const parsed = JSON.parse(r.stdout) as { exitCode: number; failed: string[] };
    expect(parsed.failed).toContain('goals');
    expect(parsed.exitCode).toBe(1);
    expect(r.status).toBe(1);
  });

  it('exits with 2 for usage errors and a missing --params file', () => {
    expect(run(['--bogus']).status).toBe(2);
    expect(run(['--params', join(dir, 'does-not-exist.json')]).status).toBe(2);
  });

  it('gives the same output with 1 and 3 workers on several seeds', () => {
    const args = [...small, '--seed', '1,2', '--json'];
    expect(run([...args, '--workers', '3']).stdout).toBe(run([...args, '--workers', '1']).stdout);
  });

  it('a --params run leaves app/src/params/ untouched (names, sizes, mtimes)', () => {
    const before = snapshot();
    const file = join(dir, 'other.json');
    writeFileSync(file, JSON.stringify({ match: { baseChance: 0.07, allOutFromMinute: 70 } }));
    const r = run([...small, '--json', '--params', file, '--workers', '2']);
    expect(JSON.parse(r.stdout).run.overrides).toEqual([
      'match.allOutFromMinute',
      'match.baseChance',
    ]);
    expect(snapshot()).toEqual(before);
  });
});
