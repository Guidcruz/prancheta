import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * Trava contra o ambiente de teste no build publicado (docs/03-test-plan.md, 3, item 3): o dist/
 * não pode conter o banco de teste (`prancheta-test`) nem o gancho de teste. O build de teste vai
 * para app/dist-e2e/ e nunca para dist/. Roda sobre o dist/ já montado; sem ele fica ignorado,
 * a não ser com REQUIRE_DIST=1 (CI e `npm run test:all`), quando a falta do build é falha.
 */
const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
const built = existsSync(join(dist, 'jogo', 'index.html'));
const run = built || process.env['REQUIRE_DIST'] === '1' ? describe : describe.skip;

/** Textos que só o build de teste pode ter. */
const FORBIDDEN = ['prancheta-test', '__prancheta_test__'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

run('dist/ publicado', () => {
  it('existe o jogo montado', () => {
    expect(built, 'dist/jogo/index.html não existe: rode `npm run build` antes').toBe(true);
  });

  it('não contém o banco nem o gancho de teste', () => {
    const found: string[] = [];
    for (const file of built ? walk(dist) : []) {
      if (!/\.(js|mjs|css|html|json|webmanifest|map|txt|xml)$/.test(file)) continue;
      const text = readFileSync(file, 'utf8');
      for (const word of FORBIDDEN) if (text.includes(word)) found.push(`${word} em ${file}`);
    }
    expect(found).toEqual([]);
  });
});
