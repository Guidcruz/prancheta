import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { hashName, NORMALIZATION } from './blocklist.ts';

/*
 * scripts/hash-blocklist.mjs, run in plain Node with invented names. The names file lives in the
 * system temp folder, as the real one must live outside the repository.
 */
const script = fileURLToPath(new URL('../../../scripts/hash-blocklist.mjs', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'prancheta-blocklist-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function run(args: string[]): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? -1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

describe('scripts/hash-blocklist.mjs', () => {
  it('writes sorted, unique hashes of the normalized names and no name in clear text', () => {
    const input = join(dir, 'names.txt');
    const out = join(dir, 'blocklist.json');
    writeFileSync(
      input,
      [
        '# invented names for the test',
        'Clube Inventado',
        '',
        '  CLUBE   inventado  ',
        'Estádio Imaginário',
        'Estadio Imaginario',
        'Torcida Fictícia\r',
      ].join('\n'),
    );
    const result = run([input, '--out', out]);
    expect(result).toMatchObject({ code: 0, stderr: '' });
    expect(result.stdout).toBe('hash-blocklist: 5 names, 3 hashes written\n');
    expect(result.stdout).not.toMatch(/inventado|imaginario|ficticia/i);

    const text = readFileSync(out, 'utf8');
    expect(text).not.toMatch(/inventado|imagin|fict/i);
    const expected = ['Clube Inventado', 'Estádio Imaginário', 'Torcida Fictícia']
      .map(hashName)
      .sort();
    expect(JSON.parse(text)).toEqual({
      algorithm: 'sha256',
      normalization: NORMALIZATION,
      hashes: expected,
    });
    // Formatted by Prettier like the rest of the repository.
    expect(text).toBe(`${JSON.stringify(JSON.parse(text), null, 2)}\n`);
  });

  it('writes an empty list for a file without names', () => {
    const input = join(dir, 'empty.txt');
    const out = join(dir, 'empty.json');
    writeFileSync(input, '# nothing yet\n\n');
    expect(run([input, '--out', out]).code).toBe(0);
    expect(JSON.parse(readFileSync(out, 'utf8')).hashes).toEqual([]);
  });

  it('refuses a names file inside the repository', () => {
    const inside = fileURLToPath(new URL('../../../docs/PROJETO.md', import.meta.url));
    const result = run([inside, '--out', join(dir, 'never.json')]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('outside the repository');
  });

  it('refuses a missing argument or file', () => {
    expect(run([]).stderr).toContain('missing the names file');
    expect(run([join(dir, 'nope.txt')]).stderr).toContain('cannot read');
    expect(run([join(dir, 'nope.txt'), 'extra']).code).toBe(1);
  });
});
