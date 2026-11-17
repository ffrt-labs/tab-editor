// Throwaway: node run-bench.mjs > out/bench.json
import { chromium } from 'playwright-core';
import { serve } from './serve.mjs';
const srv = await serve();
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--headless=new'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', m => m.type() === 'error' && console.error('[page]', m.text(), m.location().url));
page.on('response', r => r.status() >= 400 && console.error('[404]', r.url()));
await page.goto(`${base}/bench.html`);
await page.waitForFunction(() => window.ready);
const file = '/testdata/guitarpro5/canon.gp5';
const editBars = [5, 110, 215];
const results = [];
for (const useWorkers of [false, true]) for (const tracks of [[0], 'all']) {
  const r = await page.evaluate(cfg => window.bench(cfg), { file, tracks, useWorkers, editBars });
  console.error(JSON.stringify({ workers: useWorkers, tracks, initial: r.initial, warm: r.initialWarm, edits: r.edits.map(e => `${e.mode}@${e.bar}: ${e.medianVisible}ms`) }));
  results.push(r);
}
const tex = await page.evaluate(cfg => window.benchTex(cfg), { file, track: 0, editBars });
console.error(JSON.stringify({ tex: { bytes: tex.texBytes, lines: tex.texLines, parse: tex.parse, initial: tex.initial, loop: tex.loop.map(e => `${e.mode}@${e.bar}: ${e.medianVisible}ms (parse ${e.medianParse})`) } }));
results.push({ tex });
console.log(JSON.stringify({ chromium: browser.version(), results }, null, 1));
await browser.close(); srv.close();
