// Throwaway: summarise a roundtrip.mjs report. Usage: node aggregate.mjs report.json [filter-regex]
import fs from 'node:fs';
const [file, filter] = process.argv.slice(2);
const r = JSON.parse(fs.readFileSync(file, 'utf8'));
const agg = {}; let ok = 0, err = 0, clean = 0, pm = 0, tm = 0, bd = 0; const pmFiles = [];
for (const [f, v] of Object.entries(r)) {
  if (filter && !new RegExp(filter).test(f)) continue;
  if (v.error) { err++; console.log('ERR', f, v.error.split('\n')[0]); continue; }
  ok++;
  const ks = Object.keys(v.diffs).filter(k => k !== '#semantic' && !(v.diffs['#semantic'].barsDropped && /^\.masterbars\[\]$|bars\[\]$/.test(k)));
  if (!ks.length) clean++;
  if (v.diffs['#semantic'].pitchMismatches) { pm++; pmFiles.push(`${f} (${v.diffs['#semantic'].pitchMismatches}/${v.diffs['#semantic'].notes})`); }
  if (v.diffs['#semantic'].barsDropped) bd++;
  if (v.diffs['#semantic'].beatTimingMismatches) tm++;
  for (const k of ks) {
    const key = k.replace(/^\.tracks\[\]\.staves\[\]\.bars\[\]\.voices\[\]\.beats\[\]/, 'beat').replace(/^beat\.notes\[\]/, 'note');
    const e = (agg[key] ??= { files: [], n: 0, ex: v.diffs[k].ex[0] });
    e.files.push(f); e.n += v.diffs[k].n;
  }
}
console.log({ ok, err, clean, filesWithPitchMismatch: pm, filesWithTimingMismatch: tm, filesWithBarsDropped: bd, pmFiles });
for (const [k, v] of Object.entries(agg).sort((a, b) => b[1].files.length - a[1].files.length))
  console.log(String(v.files.length).padStart(4), String(v.n).padStart(7), k.padEnd(55), '|', v.ex.slice(0, 110));
