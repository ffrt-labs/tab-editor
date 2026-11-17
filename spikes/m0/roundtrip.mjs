// Throwaway: GP -> alphaTab -> exporter -> alphaTab; diff models.
// Usage: node roundtrip.mjs gp7|tex outdir file...
import * as at from '@coderline/alphatab';
import fs from 'node:fs'; import path from 'node:path';
const [mode, outDir, ...files] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const settings = new at.Settings();
const load = bytes => at.importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
const toObj = s => at.model.JsonConverter.scoreToJsObject(s);
// Collect leaf paths that differ; generalise indices so counts group by property.
function diff(a, b, p, acc) {
  if (a instanceof Map) a = Object.fromEntries(a); if (b instanceof Map) b = Object.fromEntries(b);
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    if (/id$/.test(p)) return acc; // global id counters: noise
    if (a !== b && !(Number.isNaN(a) && Number.isNaN(b))) { const k = p.replace(/\[\d+\]/g, '[]'); const e = (acc[k] ??= { n: 0, ex: [] }); e.n++; if (e.ex.length < 3) e.ex.push(`${p.replace('.tracks', 't').replace(/\.staves\[0\]|\.voices|\.beats|\.notes|\.bars/g, '')}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`); }
    return acc;
  }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], Array.isArray(a) ? `${p}[${k}]` : `${p}.${k}`, acc);
  return acc;
}
const report = {};
for (const f of files) {
  try {
    const a = load(new Uint8Array(fs.readFileSync(f)));
    let b, bytes;
    if (mode === 'tex') {
      const tex = new at.exporter.AlphaTexExporter().exportToString(a);
      fs.writeFileSync(path.join(outDir, path.basename(f) + '.atex'), tex);
      b = at.importer.ScoreLoader.loadAlphaTex(tex, settings); bytes = tex.length;
    } else {
      const gp = new at.exporter.Gp7Exporter().export(a, settings);
      fs.writeFileSync(path.join(outDir, path.basename(f).replace(/\.\w+$/, '') + '.roundtrip.gp'), gp);
      b = load(gp); bytes = gp.length;
    }
    const d = diff(toObj(a), toObj(b), '', {});
    // Semantic checks: sounding pitch and beat timing per note.
    let pitch = 0, timing = 0, notes = 0;
    const barsDropped = a.masterBars.length - b.masterBars.length;
    a.tracks.forEach((t, ti) => t.staves.forEach((st, si) => st.bars.forEach((bar, bi) => bar.voices.forEach((v, vi) => v.beats.forEach((beat, ki) => {
      const ob = b.tracks[ti]?.staves[si]?.bars[bi]?.voices[vi]?.beats[ki];
      if (!ob && beat.isEmpty) return; // empty bar collapsed: counted in barsDropped
      if (!ob || ob.playbackStart !== beat.playbackStart || ob.playbackDuration !== beat.playbackDuration) timing++;
      beat.notes.forEach((n, ni) => { notes++; if (ob?.notes[ni]?.realValue !== n.realValue) pitch++; });
    })))));
    d['#semantic'] = { notes, pitchMismatches: pitch, beatTimingMismatches: timing, barsDropped };
    report[f] = { bars: a.masterBars.length, tracks: a.tracks.length, bytes, diffs: d };
  } catch (e) { report[f] = { error: String(e.stack ?? e).slice(0, 300) }; }
}
console.log(JSON.stringify(report, null, 1));
