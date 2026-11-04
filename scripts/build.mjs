// Builds the public site (/) and the game (/jogo) into one dist/ folder for Cloudflare Pages.
import { execSync } from 'node:child_process';
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

rmSync(resolve(root, 'dist'), { recursive: true, force: true });
run('node scripts/tokens-to-css.mjs');
run('node scripts/icons.mjs');
run('npm run build -w site');
run('npm run build -w app');
mkdirSync(resolve(root, 'dist'), { recursive: true });
cpSync(resolve(root, 'site/dist'), resolve(root, 'dist'), { recursive: true });
cpSync(resolve(root, 'app/dist'), resolve(root, 'dist/jogo'), { recursive: true });
if (!existsSync(resolve(root, 'dist/jogo/index.html'))) throw new Error('game build missing');
console.log('dist/ ready: site at / and game at /jogo');
