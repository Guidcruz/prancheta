const fs = require('fs'), path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const m = await import(path.join(__dirname, 'escudos-v4.mjs'));
  const clubs = require('/home/user/prancheta/app/src/data/clubs.serie-a.json');
  const out = path.join(__dirname, '..');
  const shapes = Object.fromEntries(Object.entries(m.CLUB_CREST).map(([k, v]) => [k, v.shape]));
  const sv = (c, s) => m.brasaoV4(c, s);
  // confere conflitos
  let bad = 0;
  for (const a of clubs) for (const b of clubs) if (a.id < b.id && shapes[a.id] === shapes[b.id] && (a.city === b.city || a.rivals.includes(b.id) || b.rivals.includes(a.id))) bad++;
  const cnt = {}; Object.values(shapes).forEach((s) => (cnt[s] = (cnt[s] || 0) + 1));
  const avg = (s) => Math.round(clubs.reduce((t, c) => t + sv(c, s).length, 0) / clubs.length);
  console.log('conflitos', bad, JSON.stringify(cnt), 'bytes medios grande/pequeno', avg(64), avg(32));
  const cell = (c, w) => `<div class="c"><div style="width:${w}px">${sv(c, w)}</div><span>${c.shortName}</span></div>`;
  const grid = clubs.map((c) => cell(c, 96)).join('');
  const demo = { ...clubs.find((c) => c.id === 'bragantao'), titles: { league: 2, leagueB: 6 } };
  const big = ['atletico-minerio', 'vasconcelos', 'santoes'].map((id) => cell(clubs.find((c) => c.id === id), 104)).join('') + cell({ ...demo, shortName: 'Ex.: A+B' }, 104);
  const small = clubs.slice(0, 8).map((c) => `<div class="row"><div style="width:32px">${sv(c, 32)}</div><b>${c.shortName}</b><i>${c.abbreviation}</i><em>${c.titles.league}</em></div>`).join('');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Escudos, estilo A v4</title><style>
body{margin:0;background:#0f1a24;color:#f2f5f7;font-family:system-ui,Arial,sans-serif;padding:24px;width:852px}
h1{font-size:20px;margin:0 0 4px}p{color:#a3b3c0;margin:0 0 16px;font-size:13px}
#grade{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;background:#172534;padding:18px;border-radius:12px}
.c{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px}
#zoom{box-sizing:border-box;display:flex;gap:20px;background:#172534;padding:18px;border-radius:12px;margin-top:20px;align-items:flex-start}
#big{display:flex;gap:6px;flex:none}#small{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 10px;align-content:start;flex:1;min-width:0}
.row{display:flex;align-items:center;gap:8px;font-size:13px;height:38px;background:#20334a;padding:0 8px;border-radius:6px}.row b{flex:1;font-weight:500}.row i{color:#a3b3c0;font-style:normal;font-size:11px}.row em{font-style:normal;color:#f4c20d;font-size:11px}
svg{display:block;width:100%;height:auto}</style></head><body>
<h1>Estilo A v4: Brasão com brilho e variedade de formato</h1><p>Formato, padrão e símbolo fixos por clube; símbolos da cidade, estrelas de ouro (Série A) e prata (Série B, exemplo ao lado), estrela grande = 5 títulos.</p>
<div id="grade">${grid}</div><div id="zoom"><div id="big">${big}</div><div id="small">${small}</div></div></body></html>`;
  const f = path.join(out, 'estilo-a-brasao-v4.html');
  fs.writeFileSync(f, html);
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1.5, viewport: { width: 900, height: 900 } });
  await page.goto('file://' + f);
  await page.locator('#grade').screenshot({ path: path.join(out, 'estilo-a-grade-v4.png') });
  await page.locator('#zoom').screenshot({ path: path.join(out, 'estilo-a-zoom-v4.png') });
  await browser.close();
})();
