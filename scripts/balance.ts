// The /balance (US-013; docs/02-architecture.md, 7, T-016; docs/design/balance-targets.md):
// simulates seasons of the Série A and the calibrated and tactical duels with the engine only,
// and compares every 1a metric with its target.
// Usage: npm run balance -- --seasons 200 --seed 1   (node scripts/balance.ts --help)
import { buildReport, exitCode } from './balance/metrics.ts';
import { formatIssues, loadParams, parseArgs, serieAClubs, USAGE } from './balance/options.ts';
import { formatJson, formatText } from './balance/report.ts';
import { collect, planJobs, runJobs } from './balance/run.ts';

const parsed = parseArgs(process.argv.slice(2));
if (!parsed.ok) {
  process.stderr.write(`${parsed.error}\n\n${USAGE}\n`);
  process.exit(2);
}
const options = parsed.options;
if (options.help) {
  process.stdout.write(`${USAGE}\n`);
  process.exit(0);
}

const loaded = loadParams(options.paramsFile);
if (!loaded.ok) {
  const issues = loaded.issues ? `\n${formatIssues(loaded.issues)}` : '';
  process.stderr.write(`${loaded.error}${issues}\n`);
  process.exit(2);
}
const clubs = serieAClubs();
if (options.robot !== undefined && !clubs.some((c) => c.id === options.robot)) {
  process.stderr.write(
    `--robot: clube desconhecido "${options.robot}" (ids: ${clubs.map((c) => c.id).join(', ')})\n`,
  );
  process.exit(2);
}

const started = process.hrtime.bigint();
const ctx = { params: loaded.params, clubs, seed: options.seed };
const jobs = planJobs(options);
const results = collect(jobs, await runJobs(ctx, jobs, options.workers));
const report = buildReport(results, { robotClub: options.robot, clubs });
const info = {
  seasons: options.seasons,
  matches: results.seasons.reduce((n, s) => n + s.matches.matches, 0),
  seed: options.seed,
  duels: options.duels,
  ...(options.robot === undefined ? {} : { robot: options.robot }),
  overrides: loaded.overrides,
  ...(options.paramsFile === undefined ? {} : { paramsFile: options.paramsFile }),
};
process.stdout.write(options.json ? formatJson(report, info) : formatText(report, info, clubs));
const seconds = Number(process.hrtime.bigint() - started) / 1e9;
process.stderr.write(
  `Tempo: ${seconds.toFixed(1).replace('.', ',')} s (${options.workers} threads, ${jobs.length} tarefas)\n`,
);
process.exitCode = exitCode(report);
