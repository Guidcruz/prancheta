import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { failureText, main, type BalanceIo } from './main.ts';

/*
 * The exit codes of the /balance (code review of T-016, part 1): a failure of the tool is 3, never
 * the 1 of "a target is out"; usage errors are 2. The runs here are in-process and tiny.
 */

function capture(): BalanceIo & { out: string; err: string } {
  const io = {
    out: '',
    err: '',
    stdout: (text: string) => {
      io.out += text;
    },
    stderr: (text: string) => {
      io.err += text;
    },
  };
  return io;
}

const tiny = ['--seasons', '0', '--duels', '0', '--robot', 'none', '--workers', '1'];
const dir = mkdtempSync(join(tmpdir(), 'balance-main-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('main', () => {
  it('returns 3 and writes the error to stderr when the run throws', async () => {
    const io = capture();
    const code = await main(tiny, io, async () => {
      throw new Error('worker exited with code 1');
    });
    expect(code).toBe(3);
    expect(io.err).toContain('falha da ferramenta');
    expect(io.err).toContain('worker exited with code 1');
    expect(io.out).toBe('');
  });

  it('returns 3 when a job of the run throws in a worker thread', async () => {
    const io = capture();
    // A job the planner never makes: the engine side throws on it, inside the worker.
    const code = await main([...tiny, '--workers', '2'], io, async (ctx, jobs, workers) => {
      const { runJobs } = await import('./run.ts');
      return runJobs(
        ctx,
        [
          ...jobs,
          { kind: 'calibrated', gap: 0, from: 0, to: 2, seed: 1 },
          { kind: 'tactical', variant: 'x', from: 0, to: 1, seed: 1 },
        ],
        workers,
      );
    });
    expect(code).toBe(3);
    expect(io.err).toContain('unknown tactic variant x');
  });

  it('returns 0 with nothing measured, and 2 for a usage error', async () => {
    const ok = capture();
    expect(await main(tiny, ok)).toBe(0);
    expect(ok.out).toContain('Metas obrigatórias: 0 de 0 dentro');
    expect(ok.out).toMatch(/Aviso: \d+ metas obrigatórias sem medida/);
    const bad = capture();
    expect(await main(['--seed', '1,1'], bad)).toBe(2);
    expect(bad.err).toContain('Códigos de saída');
  });

  it('warns on stderr about a "__proto__" key of the --params file', async () => {
    const file = join(dir, 'proto.json');
    writeFileSync(file, '{"__proto__": {"baseChance": 0.2}}');
    const io = capture();
    expect(await main([...tiny, '--params', file], io)).toBe(0);
    expect(io.err).toContain('"__proto__"');
    expect(io.out).toContain('sem sobrescrita');
  });

  it('describes a thrown value that is not an Error', () => {
    expect(failureText('boom')).toBe('/balance: falha da ferramenta (código 3): boom\n');
  });
});
