const fs = require('fs'), path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const m = await import(path.join(__dirname, 'escudos.mjs'));
  const clubs = require('/home/user/prancheta/app/src/data/clubs.serie-a.json');
  const out = path.join(__dirname, '..');
  const meta = {
    brasao: ['A', 'Brasão', 'Escudo clássico com borda dupla, padrão no campo, medalhão com símbolo e estrelas de títulos.'],
    emblema: ['B', 'Emblema circular', 'Anel com o nome curto e um ano de fundação fictício, miolo com padrão e medalhão.'],
    losango: ['C', 'Losango com faixa', 'Losango, faixa transversal com a sigla, símbolo no alto e estrelas de títulos embaixo.'],
  };
  const zoomIds = ['flamingo', 'miragol', 'remador', 'santoes'];
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1.5, viewport: { width: 900, height: 900 } });
  for (const [key, fn] of Object.entries(m.STYLES)) {
    const [letter, title, desc] = meta[key];
    const cell = (c, w) => `<div class="c"><div style="width:${w}px">${fn(c)}</div><span>${c.shortName}</span></div>`;
    const grid = clubs.map((c) => cell(c, 96)).join('');
    const zc = zoomIds.map((id) => clubs.find((c) => c.id === id));
    const big = zc.map((c) => cell(c, 104)).join('');
    const small = clubs.slice(0, 8).map((c) => `<div class="row"><div style="width:32px">${fn(c)}</div><b>${c.shortName}</b><i>${c.abbreviation}</i><em>${c.titles.league}</em></div>`).join('');
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Escudos, estilo ${letter}</title><style>
body{margin:0;background:#0f1a24;color:#f2f5f7;font-family:system-ui,Arial,sans-serif;padding:24px;width:852px}
h1{font-size:20px;margin:0 0 4px}p{color:#a3b3c0;margin:0 0 16px;font-size:13px}
#grade{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;background:#172534;padding:18px;border-radius:12px}
.c{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px}
#zoom{box-sizing:border-box;display:flex;gap:20px;background:#172534;padding:18px;border-radius:12px;margin-top:20px;align-items:flex-start}
#big{display:flex;gap:6px;flex:none}#small{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 10px;align-content:start;flex:1;min-width:0}
.row{display:flex;align-items:center;gap:8px;font-size:13px;height:38px;background:#20334a;padding:0 8px;border-radius:6px}.row b{flex:1;font-weight:500}.row i{color:#a3b3c0;font-style:normal;font-size:11px}.row em{font-style:normal;color:#f4c20d;font-size:11px}
svg{display:block;width:100%;height:auto}</style></head><body>
<h1>Estilo ${letter}: ${title}</h1><p>${desc}</p>
<div id="grade">${grid}</div>
<div id="zoom"><div id="big">${big}</div><div id="small">${small}</div></div></body></html>`;
    const f = path.join(out, `estilo-${letter.toLowerCase()}-${key}.html`);
    fs.writeFileSync(f, html);
    await page.goto('file://' + f);
    await page.locator('#grade').screenshot({ path: path.join(out, `estilo-${letter.toLowerCase()}-grade.png`) });
    await page.locator('#zoom').screenshot({ path: path.join(out, `estilo-${letter.toLowerCase()}-zoom.png`) });
    // contraste dos simbolos: relatorio
  }
  await browser.close();
})();
