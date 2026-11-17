// Throwaway M0 re-render latency bench. Driven by run-bench.mjs via window.bench(cfg).
import * as alphaTab from './node_modules/@coderline/alphatab/dist/alphaTab.mjs';
const el = document.getElementById('at');
const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

function makeApi({ useWorkers, engine }) {
  el.innerHTML = '';
  return new alphaTab.AlphaTabApi(el, {
    core: { useWorkers, fontDirectory: './node_modules/@coderline/alphatab/dist/font/', logLevel: 'warning' },
    display: { layoutMode: 'page', staveProfile: 'default', ...(engine ? { renderEngine: engine } : {}) },
    player: { enablePlayer: false },
  });
}

// Resolves with {layout, painted} ms measured from call of fn().
function timed(api, fn) {
  return new Promise(resolve => {
    let layout;
    const offR = api.renderFinished.on(() => { layout = performance.now() - t0; });
    const offP = api.postRenderFinished.on(async () => {
      offR(); offP();
      await frame();
      resolve({ layout: +layout?.toFixed(1), painted: +(performance.now() - t0).toFixed(1) });
    });
    const t0 = performance.now();
    fn();
  });
}

// Count rendered SVG <text> nodes showing a given fret number.
const countText = v => { let n = 0; for (const t of el.querySelectorAll('text')) if (t.textContent === String(v)) n++; return n; };

// Time from fn() until the DOM shows `want` occurrences of `value` (i.e. the edit is visible on screen).
function timedVisible(api, fn, value, want, other, otherWant) {
  return new Promise((resolve, reject) => {
    let post;
    const offP = api.postRenderFinished.on(() => { post = performance.now() - t0; });
    const t0 = performance.now();
    fn();
    const poll = () => {
      const dt = performance.now() - t0;
      if (countText(value) === want && countText(other) === otherWant && post !== undefined) { offP(); return resolve({ painted: +dt.toFixed(1), post: +post.toFixed(1) }); }
      if (dt > 10000) { offP(); return reject(new Error(`edit never became visible (${value}: ${countText(value)}/${want}, ${other}: ${countText(other)}/${otherWant}, post=${post})`)); }
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });
}

async function scrollToBar(api, bar) {
  const b = api.boundsLookup?.findMasterBarByIndex(bar);
  window.scrollTo(0, Math.max(0, el.offsetTop + b.visualBounds.y - 200));
  await frame(); await new Promise(r => setTimeout(r, 300)); await frame();
}

function firstNote(score, trackIdx, barIdx) {
  for (let b = barIdx; b < score.masterBars.length; b++) {
    const bar = score.tracks[trackIdx].staves[0].bars[b];
    for (const beat of bar.voices[0].beats) if (beat.notes.length) return { note: beat.notes[0], bar: b };
  }
  throw new Error('no note');
}

async function loadScore(url) {
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  return alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, new alphaTab.Settings());
}

window.bench = async (cfg) => {
  const { file, tracks, useWorkers, engine, editBars, reps = 9 } = cfg;
  const score = await loadScore(file);
  const trackIdx = tracks === 'all' ? score.tracks.map((_, i) => i) : tracks;
  const api = makeApi({ useWorkers, engine });
  const out = { cfg, masterBars: score.masterBars.length, initial: null, edits: [] };
  out.initial = await timed(api, () => api.renderScore(score, trackIdx));
  out.initialWarm = await timed(api, () => api.renderScore(score, trackIdx));
  const A = 22, B = 23; // marker frets, rare in the file
  for (const target of editBars) {
    const { note, bar } = firstNote(score, trackIdx[0], target);
    const orig = note.fret;
    await scrollToBar(api, bar);
    note.fret = B; await timed(api, () => useWorkers ? api.renderScore(score, trackIdx) : api.render());
    await new Promise(r => setTimeout(r, 800)); await frame();
    const baseA = countText(A), baseB = countText(B) - 1;
    for (const mode of ['full', 'hinted']) {
      const runs = [];
      for (let i = 0; i < reps; i++) {
        const [now, prev] = note.fret === A ? [B, A] : [A, B];
        note.fret = now; // one-note change in the model
        const base = v => (v === A ? baseA : baseB);
        const hints = mode === 'hinted' ? { firstChangedMasterBar: bar, reuseViewport: true } : undefined;
        // render() re-renders the API's score; with workers the worker holds its own copy, so re-send it.
        runs.push(await timedVisible(api, () => useWorkers ? api.renderScore(score, trackIdx, hints) : api.render(hints), now, base(now) + 1, prev, base(prev)));
      }
      runs.sort((a, b) => a.painted - b.painted);
      out.edits.push({ bar, mode, medianVisible: runs[runs.length >> 1].painted, all: runs.map(r => r.painted) });
    }
    note.fret = orig;
  }
  api.destroy();
  return out;
};

// alphaTex loop: one-token text edit -> parse whole text -> render (the PRD §3.4 v1 editing loop).
window.benchTex = async ({ file, track = 0, editBars, reps = 9 }) => {
  const single = await loadScore(file);
  single.tracks = [single.tracks[track]];
  single.tracks[0].index = 0;
  const tex = new alphaTab.exporter.AlphaTexExporter().exportToString(single);
  const SEP = '\n    |\n';
  const segs = tex.split(SEP);
  const noteRe = /^(\s+)(\d+)(\.\d)/m;
  const api = makeApi({ useWorkers: false });
  const parse = t => alphaTab.importer.ScoreLoader.loadAlphaTex(t, new alphaTab.Settings());
  const out = { texBytes: tex.length, texLines: tex.split('\n').length, bars: segs.length, parse: [], loop: [] };
  for (let i = 0; i < reps; i++) { const t0 = performance.now(); parse(tex); out.parse.push(+(performance.now() - t0).toFixed(1)); }
  out.initial = await timed(api, () => api.renderScore(parse(tex), [0]));
  const A = 22, B = 23;
  const withFret = (bar, v) => { const c = segs.slice(); c[bar] = c[bar].replace(noteRe, `$1${v}$3`); return c.join(SEP); };
  for (const target of editBars) {
    let bar = target; while (!noteRe.test(segs[bar])) bar++;
    await scrollToBar(api, bar);
    await timed(api, () => api.renderScore(parse(withFret(bar, B)), [0]));
    await new Promise(r => setTimeout(r, 800)); await frame();
    const baseA = countText(A), baseB = countText(B) - 1;
    let cur = B;
    for (const mode of ['full', 'hinted']) {
      const runs = [];
      for (let i = 0; i < reps; i++) {
        const [now, prev] = cur === A ? [B, A] : [A, B]; cur = now;
        const text = withFret(bar, now); // the user's keystroke result
        const base = v => (v === A ? baseA : baseB);
        let parseMs;
        runs.push(await timedVisible(api, () => {
          const t0 = performance.now(); const sc = parse(text); parseMs = performance.now() - t0;
          api.renderScore(sc, [0], mode === 'hinted' ? { firstChangedMasterBar: bar, reuseViewport: true } : undefined);
        }, now, base(now) + 1, prev, base(prev)));
        runs[runs.length - 1].parse = +parseMs.toFixed(1);
      }
      runs.sort((a, b) => a.painted - b.painted);
      const m = runs[runs.length >> 1];
      out.loop.push({ bar, mode, medianVisible: m.painted, medianParse: m.parse, all: runs.map(r => r.painted) });
    }
  }
  api.destroy();
  return out;
};
window.ready = true;
