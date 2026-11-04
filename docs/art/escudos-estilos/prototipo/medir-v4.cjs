// mede a caixa (getBBox) de cada simbolo e grava bbox.json
const fs = require('fs'), path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const m = await import(path.join(__dirname, 'escudos-v4.mjs'));
  const keys = Object.keys(m.CITY);
  const html = `<!doctype html><meta charset="utf-8"><svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="-30 -30 60 60">${keys.map((k) => `<g id="${k}">${m.CITY[k]('#000')}</g>`).join('')}</svg>`;
  const b = await chromium.launch(), p = await b.newPage();
  await p.setContent(html);
  const res = await p.evaluate((ks) => Object.fromEntries(ks.map((k) => { const r = document.getElementById(k).getBBox(); return [k, { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) }]; })), keys);
  fs.writeFileSync(path.join(__dirname, 'bbox.json'), JSON.stringify(res, null, 1));
  await b.close();
})();
