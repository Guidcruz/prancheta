// The /balance (US-013; docs/02-architecture.md, 7, T-016; docs/design/balance-targets.md):
// simulates seasons of the Série A and the calibrated and tactical duels with the engine only,
// and compares every 1a metric with its target.
// Usage: npm run balance -- --seasons 200 --seed 1   (node scripts/balance.ts --help)
// Exit codes: 0 every required target in; 1 one out; 2 usage error; 3 failure of the tool.
import { failureText, main } from './balance/main.ts';

// main() never throws; anything that still escapes it (an error in an event handler) is a
// failure of the tool too, never the "target out" code 1 Node would give it.
const fail = (error: unknown) => {
  process.stderr.write(failureText(error));
  process.exit(3);
};
process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);

process.exitCode = await main(process.argv.slice(2));
