// Throwaway: print shape of GP files. Usage: node inspect.mjs file...
import * as alphaTab from '@coderline/alphatab';
import fs from 'node:fs';
for (const f of process.argv.slice(2)) {
  try {
    const s = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(fs.readFileSync(f)), new alphaTab.Settings());
    console.log(`${f}\n  ${s.masterBars.length} masterbars, ${s.tracks.length} tracks: ${s.tracks.map(t=>t.name).join(' | ')}`);
  } catch (e) { console.log(f, 'ERR', e.message); }
}
