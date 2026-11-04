// Finds the name combinations that match the hashed blocklist of real athletes and writes them,
// as indices only (no text), to app/src/content/names/br.exclusions.json (US-003, T-004).
// Run it whenever app/src/content/names/br.json or app/src/data/athletes-blocklist.sha256.json
// changes. It walks the whole space (about 74M hashes, 2 to 4 minutes); the elapsed time is printed.
// Usage: npm run names:exclusions
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { parseBlocklist } from '../app/src/data/blocklist.ts';
import { computeExclusions } from '../app/src/data/name-exclusions.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const listsPath = resolve(root, 'app/src/content/names/br.json');
const blocklistPath = resolve(root, 'app/src/data/athletes-blocklist.sha256.json');
const out = resolve(root, 'app/src/content/names/br.exclusions.json');

const lists = JSON.parse(readFileSync(listsPath, 'utf8'));
const parsed = parseBlocklist(JSON.parse(readFileSync(blocklistPath, 'utf8')));
if (!parsed.ok) {
  console.error(`name-exclusions: invalid blocklist ${JSON.stringify(parsed.issues)}`);
  process.exit(1);
}

const started = Date.now();
const file = computeExclusions(lists, parsed.hashes);
const options = (await prettier.resolveConfig(out)) ?? {};
writeFileSync(out, await prettier.format(JSON.stringify(file), { ...options, filepath: out }));
const counts = Object.entries(file)
  .map(([kind, items]) => `${kind}: ${items.length}`)
  .join(', ');
console.log(`name-exclusions: ${counts} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
