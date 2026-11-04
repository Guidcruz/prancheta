import { contrast, onColor } from './escudos.mjs';
import { createRequire } from 'module';
const clubs = createRequire(import.meta.url)('../../../../app/src/data/clubs.serie-a.json');
let min = 99;
for (const c of clubs)
  for (const bg of c.colors) {
    const f = onColor(bg, c.colors);
    min = Math.min(min, contrast(f, bg));
  }
console.log('menor contraste simbolo/fundo:', min.toFixed(2));
