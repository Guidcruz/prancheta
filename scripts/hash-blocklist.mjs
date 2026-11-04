// Hashes the list of real names (clubs, stadiums, nicknames) kept by the content-writer OUTSIDE
// the repository into app/src/data/blocklist.sha256.json (US-001; docs/02-architecture.md, 3).
// The repository only ever holds the SHA-256 of each normalized name, never the name.
//
// Usage: node scripts/hash-blocklist.mjs <names.txt> [--out <file.json>]
//   (or: npm run blocklist:hash -- <names.txt>)
// The input has one name per line; blank lines and lines starting with "#" are ignored. The
// output replaces the file: sorted, without duplicates. Normalization and hashing come from
// app/src/data/blocklist.ts (Node runs the TypeScript directly), the same code the validation
// uses, so both sides always agree.
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { buildBlocklist } from '../app/src/data/blocklist.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultOut = resolve(root, 'app/src/data/blocklist.sha256.json');

function fail(message) {
  console.error(`hash-blocklist: ${message}`);
  console.error('usage: node scripts/hash-blocklist.mjs <names.txt> [--out <file.json>]');
  process.exit(1);
}

const args = process.argv.slice(2);
let input;
let out = defaultOut;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') {
    if (!args[i + 1]) fail('--out needs a file');
    out = resolve(args[++i]);
  } else if (input === undefined) input = args[i];
  else fail(`unexpected argument "${args[i]}"`);
}
if (input === undefined) fail('missing the names file');

let real;
try {
  real = realpathSync(resolve(input));
} catch {
  fail(`cannot read "${input}"`);
}
// The names file holds real names in clear text: it must never live inside the repository.
const inside = relative(realpathSync(root), real);
if (inside === '' || (!inside.startsWith('..') && !isAbsolute(inside))) {
  fail('the names file must live outside the repository (it holds real names in clear text)');
}

const lines = readFileSync(real, 'utf8').split(/\r?\n/);
const names = lines.map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
const file = buildBlocklist(names);

// Formatted like the rest of the repository, so `prettier --check` in `npm run lint` passes.
const options = (await prettier.resolveConfig(out)) ?? {};
const json = await prettier.format(JSON.stringify(file), { ...options, filepath: out });
writeFileSync(out, json);
console.log(`hash-blocklist: ${names.length} names, ${file.hashes.length} hashes written`);
