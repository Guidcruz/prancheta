// Save measurement of the end of the season (T-018; docs/02-architecture.md, 5): bundles page.ts
// with Vite (PRANCHETA_ENV=test, so the store uses the database prancheta-test), serves it on
// 127.0.0.1, opens it in headless Chromium (Playwright), builds the save of a whole season, turns
// on the CPU slowdown and times the safe write (match sheets out of the snapshot), the season turn
// and the opening.
// Usage: PRANCHETA_ENV=test npm run measure:save -- [--runs 40] [--warmup 5] [--cpu 4]
//        [--chromium <path>]
// Chromium: the one of Playwright (once: npx playwright install chromium), or a local Chromium
// given by PRANCHETA_CHROMIUM=<path> or --chromium <path> (the flag wins).
// Exit codes: 0 every deciding write (after round 38, the three of the season turn) with p90
// within 150 ms; 1 over it; 2 usage error (or no PRANCHETA_ENV=test); 3 failure, or a request that
// tried to leave 127.0.0.1 (blocked and counted).
import { createServer, type Server } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatReport, withinLimit, type MeasurementLike } from './report.ts';

export interface MeasureArgs {
  runs: number;
  warmup: number;
  cpu: number;
  /** A local Chromium to launch instead of Playwright's (`executablePath`). */
  chromium?: string;
}

const USAGE =
  'Uso: PRANCHETA_ENV=test npm run measure:save -- [--runs 40] [--warmup 5] [--cpu 4] [--chromium <caminho>]';

/**
 * Parses the options; a message (pt-BR) when they are wrong. `PRANCHETA_CHROMIUM` gives the
 * Chromium when `--chromium` does not.
 */
export function parseArgs(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>> = {},
): MeasureArgs | string {
  const args: MeasureArgs = { runs: 40, warmup: 5, cpu: 4 };
  const fromEnv = env.PRANCHETA_CHROMIUM;
  if (fromEnv !== undefined && fromEnv !== '') args.chromium = fromEnv;
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (flag === '--chromium') {
      const path = argv[i + 1];
      if (path === undefined || path === '' || path.startsWith('--')) {
        return `caminho inválido para --chromium: ${String(path)}`;
      }
      args.chromium = path;
      continue;
    }
    const value = Number(argv[i + 1]);
    const key =
      flag === '--runs'
        ? 'runs'
        : flag === '--warmup'
          ? 'warmup'
          : flag === '--cpu'
            ? 'cpu'
            : undefined;
    if (key === undefined) return `opção desconhecida: ${String(flag)}`;
    if (!Number.isInteger(value) || value < (key === 'warmup' ? 0 : 1)) {
      return `valor inválido para ${flag}: ${String(argv[i + 1])}`;
    }
    args[key] = value;
  }
  return args;
}

const PAGE =
  '<!doctype html><meta charset="utf-8"><title>measure-save</title><script type="module" src="/page.js"></script>';

export async function bundle(dir: string): Promise<void> {
  const { build } = await import('vite');
  await build({
    configFile: false,
    logLevel: 'warn',
    define: { __PRANCHETA_ENV__: JSON.stringify('test') },
    build: {
      outDir: dir,
      emptyOutDir: true,
      minify: true,
      lib: {
        entry: fileURLToPath(new URL('./page.ts', import.meta.url)),
        formats: ['es'],
        fileName: () => 'page.js',
      },
    },
  });
  await writeFile(join(dir, 'index.html'), PAGE);
}

/** Serves only the page and its bundle; anything else is a 404. */
function serve(dir: string): Promise<{ server: Server; url: string }> {
  const files: Record<string, [string, string]> = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/page.js': ['page.js', 'text/javascript; charset=utf-8'],
  };
  const server = createServer((req, res) => {
    const file = files[req.url ?? ''];
    if (file === undefined) {
      res.writeHead(404).end();
      return;
    }
    readFile(join(dir, file[0])).then(
      (body) => res.writeHead(200, { 'content-type': file[1] }).end(body),
      () => res.writeHead(500).end(),
    );
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

interface MeasureWindow {
  measureSave: {
    prepare(): Promise<void>;
    measure(options: { runs: number; warmup: number }): Promise<MeasurementLike>;
  };
}

export interface ChromiumRun {
  readonly measurement: MeasurementLike;
  /** Requests to anywhere but the page's origin, aborted. */
  readonly blocked: number;
}

async function measureInChromium(url: string, args: MeasureArgs): Promise<ChromiumRun> {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    headless: true,
    // `gc()` for the page to collect the garbage of building the season before measuring.
    args: ['--js-flags=--expose-gc'],
    ...(args.chromium === undefined ? {} : { executablePath: args.chromium }),
  });
  let blocked = 0;
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const origin = new URL(url).origin;
    // Nothing leaves the machine (docs/03-test-plan.md, 3, "Rede"): blocked, and counted.
    await context.route('**/*', (route) => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      blocked++;
      return route.abort();
    });
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForFunction(() => 'measureSave' in window);
    // The save of a whole season is built at full speed; only the write is slowed down.
    await page.evaluate(() => (window as unknown as MeasureWindow).measureSave.prepare());
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: args.cpu });
    const measurement = await page.evaluate(
      (options) => (window as unknown as MeasureWindow).measureSave.measure(options),
      { runs: args.runs, warmup: args.warmup },
    );
    return { measurement, blocked };
  } finally {
    await browser.close();
  }
}

/**
 * Prints the report of a run and gives the exit code: 3 when the page used another database or
 * tried to leave 127.0.0.1 (the numbers are printed, but they do not count), else the verdict.
 */
export function finish({ measurement, blocked }: ChromiumRun, cpu: number): number {
  if (measurement.dbName !== 'prancheta-test') {
    process.stderr.write(`banco errado na página: ${measurement.dbName}\n`);
    return 3;
  }
  process.stdout.write(formatReport(measurement, cpu));
  if (blocked > 0) {
    process.stderr.write(
      `a página tentou sair de 127.0.0.1: ${blocked} requisição(ões) bloqueada(s); medição inválida\n`,
    );
    return 3;
  }
  return withinLimit(measurement) ? 0 : 1;
}

export async function main(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<number> {
  if (env.PRANCHETA_ENV !== 'test') {
    process.stderr.write(
      'A medição só roda no ambiente de teste: PRANCHETA_ENV=test npm run measure:save\n',
    );
    return 2;
  }
  const args = parseArgs(argv, env);
  if (typeof args === 'string') {
    process.stderr.write(`${args}\n${USAGE}\n`);
    return 2;
  }
  const dir = await mkdtemp(join(tmpdir(), 'prancheta-measure-save-'));
  let server: Server | undefined;
  try {
    await bundle(dir);
    const served = await serve(dir);
    server = served.server;
    return finish(await measureInChromium(served.url, args), args.cpu);
  } catch (error) {
    process.stderr.write(
      `falha na medição: ${error instanceof Error ? error.stack : String(error)}\n`,
    );
    return 3;
  } finally {
    server?.close();
    await rm(dir, { recursive: true, force: true });
  }
}
