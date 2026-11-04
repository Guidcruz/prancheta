// Content checks of the game (docs/02-architecture.md, 3 "Dados de jogo" and 6 "Conteúdo").
// Usage: node scripts/content-check.mjs   (or: npm run content:check)
// For now it runs the club data checks of app/src/data/ (US-001: 20 clubs, fields, derbies,
// shields, SHA-256 blocklist). They are Vitest suites, so the same checks run in `npm test`;
// the template checks join here when app/src/content/ gets them.
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const suites = ['src/data/'];
const result = spawnSync('npx', ['vitest', 'run', ...suites], { cwd: app, stdio: 'inherit' });
process.exit(result.status ?? 1);
