// Write measurement of the end-of-season save in Chromium with 4× CPU slowdown (T-018; ADR-0019).
// Usage: PRANCHETA_ENV=test npm run measure:save -- [--runs 15] [--warmup 3] [--cpu 4]
// Needs the Chromium of Playwright once: npx playwright install chromium
// Exit codes: 0 within 150 ms; 1 over it; 2 usage error (or no PRANCHETA_ENV=test); 3 failure.
import { main } from './measure-save/main.ts';

process.exitCode = await main(process.argv.slice(2));
