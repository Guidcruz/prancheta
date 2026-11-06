// Save measurement of the end of the season in Chromium with 4× CPU slowdown (T-018;
// docs/02-architecture.md, 5): the write after round 38, the season turn and the opening.
// Usage: PRANCHETA_ENV=test npm run measure:save -- [--runs 40] [--warmup 5] [--cpu 4]
//        [--chromium <path>]
// Chromium: the one of Playwright (once: npx playwright install chromium), or a local Chromium
// given by PRANCHETA_CHROMIUM=<path> or --chromium <path>.
// 40 runs by default: with 15 the nearest-rank p90 is the 14th value, almost the maximum.
// Exit codes: 0 every deciding write (after round 38, the season turn) with p90 within 130 ms
// (the acceptance; the target is 150 ms); 1 over it; 2 usage error (or no PRANCHETA_ENV=test);
// 3 failure (also without gc exposed), or a blocked request.
import { main } from './measure-save/main.ts';

process.exitCode = await main(process.argv.slice(2));
