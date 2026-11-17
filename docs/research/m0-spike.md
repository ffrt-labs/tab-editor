# M0 spike: alphaTab as the foundation

Issue: [#1](https://github.com/ffrt-labs/tab-editor/issues/1). Date: 2026-11-17. alphaTab **1.9.0**
(`@coderline/alphatab`, latest on npm). Spike code: `spikes/m0/` (throwaway, see "Reproduce" below).

## Verdict

**Go → start M1 (Player).** Two follow-ups:

- The TuxGuitar / Guitar Pro open check (2c) is deferred to
  [#19](https://github.com/ffrt-labs/tab-editor/issues/19). M1 only imports files, so it doesn't
  need that check. #19 blocks saving as `.gp` (#14). If the check fails, reopen PRD §3.3 before #14.
- M2 renders only the Track being edited (1). The < 100 ms target is met for one Track, not for
  every Track of a multi-track Score.

| # | Question | Result | Call |
|---|----------|--------|------|
| 1 | Re-render after a one-note change, ~200 measures | 30–80 ms for one Track (the edit pane), 200–235 ms for all 9 Tracks. Partial re-render exists (`firstChangedMasterBar`) but only helps edits late in the Score. | Pass, if the editor renders one Track |
| 2 | `.gp` (GP7) export and round-trip | Exporter exists. 345/345 files round-trip with no pitch or beat-timing changes. Some bends, automations and bar-line styling are lost. TuxGuitar check pending. | Pass inside alphaTab; TuxGuitar check deferred to #19 |
| 3 | What alphaTex cannot express | Close to lossless for notation in 1.9.0. Gaps are mostly playback and print metadata, plus one exporter bug (empty bars). | Pass |
| 4 | Editing API | None: no cursor, selection, edit commands or undo. Has hit-testing, mouse events, model mutators and an alphaTex AST with source offsets. | As assumed in PRD §6 |

Nothing here reopens PRD §3.2, §3.3 or §3.4. The constraints below go into M2's design.

---

## 1. Re-render latency

**Setup.** `canon.gp5` from alphaTab's test data: 224 measures, 9 Tracks (guitars, bass, drums,
keys). Playwright Chromium 159 at 1440×900, page layout, SVG engine, lazy loading on (the default),
player off. Hardware: **Intel Core i3-4160T (2014, 35 W, 2 cores / 4 threads)**. That is a slow
desktop, so a current machine should be faster.

**Method.** Change the fret of the first note in the guitar Track at or after bar indices 5, 110
and 215 (0-based). The first note after index 5 is in bar 8, so that column is labelled 8. Scroll that bar into
view, re-render, and stop the clock when the new fret number appears in the DOM. Median of 9 runs.
"Full" is a plain re-render. "Hinted" passes `{ firstChangedMasterBar, reuseViewport: true }`.

| Rendered Tracks | Render thread | Edit at bar 8 | bar 110 | bar 215 | first render (cold / warm) |
|---|---|---|---|---|---|
| 1 (guitar) | main | full 82 / hinted 76 ms | 59 / 58 | 79 / **31** | 417 / 170 ms |
| all 9 | main | 233 / 237 | 225 / 161 | 214 / **36** | 392 / 367 |
| 1 (guitar) | worker | 182 / 160 | 147 / 148 | 139 / 102 | 581 / 250 |
| all 9 | worker | 304 / 315 | 334 / 275 | 312 / 109 | 1086 / 574 |

**The v1 loop** (§3.4): edit a token in the alphaTex text, re-parse all of it, render. The text is
one Track exported to alphaTex: 25.7 kB, 1 753 lines, 224 bars. Rendering is on the main thread.

| Edit at bar | full render | hinted render | of which: parse whole text |
|---|---|---|---|
| 8 | 106 ms | 95 ms | 7–25 ms |
| 110 | 92 ms | 70 ms | 6–8 ms |
| 215 | 94 ms | 51 ms | 7–8 ms |

**How partial re-render works** (read from `alphaTab.core.mjs`, `doUpdateForBars`). It finds the
system holding `firstChangedMasterBar`, keeps every system above it, and lays out again from that
system to the end of the Score. Because of lazy loading, only systems in the viewport are painted.
So the saving grows the further into the Score the edit is. At bar 8 there is no saving. At bar
215 it is about 2.5× for one Track (79 → 31 ms) and about 6× for all 9 Tracks (214 → 36 ms). It only works in page layout with `enableLazyLoading` on, and it also works when the hinted
render is handed a brand-new `Score` object (the re-parse case above). The edit showed up correctly
every time.

**Constraints for M2:**
- The editor renders **only the Track being edited**. Rendering all 9 Tracks on every keystroke takes
  200+ ms on this machine.
- **Render on the main thread while editing.** With workers on, `api.render()` re-renders the
  worker's own copy of the Score, so after a change in the model you have to call `renderScore()`.
  That re-encodes the whole Score with MessagePack every time and adds about 70–100 ms. Workers stay
  a good fit for the read-only Player (M1).
- Always pass `firstChangedMasterBar` (worked out by comparing the old and new AST bar by bar) and
  debounce renders while the user types.

## 2. `.gp` export

### 2a. The exporter
alphaTab ships `alphaTab.exporter.Gp7Exporter` (writes GP7+ `.gp`) and `AlphaTexExporter`. You call
`new Gp7Exporter().export(score, settings)` and get a `Uint8Array` back.

### 2b. Round-trip through alphaTab: load → export `.gp` → re-load → compare models
The test set is the 345 GP3/4/5, `.gpx` and `.gp` files in alphaTab's test data, minus 3 files
from `exporter/` and `corrupt/` (files alphaTab wrote itself, and "healthy" controls). Most are
single-feature files; about 10 are real-world Scores. For each file the script compared every model
property (ignoring internal ids) and checked each note's sounding pitch (`realValue`) and each
beat's playback start and duration within its bar. That timing check does not look at tempo;
tempo changes are covered by the property comparison.

- 345/345 export and load again. **0 files change pitch or beat timing.** 212 files have no differences at all.
- `full-song.gpx` (11 Tracks, 96 measures, 4 452 notes), the main `.gpx` → `.gp` case: pitch and
  timing are identical. Other differences are only how the data is stored. Notes on non-fretted
  Tracks store the same pitch in a different form, and accidentals become written out explicitly
  (`accidentalMode` 0 → 2).

What is lost (files affected out of 345):

| Lost or changed | Files | Typical source |
|---|---|---|
| Per-Track "show tuning" / "chord diagrams on top" display flags | 96 / 55 | GP3–5 |
| Mid-Score volume / balance / instrument automations, linear fades | 13 | GP3–5 |
| Double bar lines | 12 | GP4–5 |
| Custom bend curves simplified or dropped (e.g. 25 of 33 bends in `canon.gp5`) | 8 | GP3–5 |
| Whammy-bar curve points | 8 | GP4–5, some `.gpx` |
| GP5 note-duration percent (staccato and palm-mute playback length) | 6 | GP5 |
| Bar display scale (layout) | 5 | `.gpx` / `.gp` |

These losses mostly hit GP3–5 imports. `.gpx` and `.gp` files come through almost untouched, and
`.gpx` → `.gp` is the case PRD §3.3 cares about.

### 2c. TuxGuitar / Guitar Pro: deferred to [#19](https://github.com/ffrt-labs/tab-editor/issues/19)
- TuxGuitar **2.1.1** (latest, 2026-10-23) includes a GP7 importer: the `tuxguitar-gpx.jar` plugin
  contains `app.tuxguitar.io.gpx.v7.GPXInputStreamPlugin`. It can open `.gp`, so PRD §6 item 3 is
  confirmed as far as the code goes. It has no GP7 exporter.
- I could not open the files in it. TuxGuitar needs Java, which this machine doesn't have, and
  installing a JDK was out of scope for the spike. Guitar Pro is not available.
- **Remaining step:** run `node roundtrip.mjs gp7 out/rt testdata/conversion/full-song.gpx
  testdata/guitarpro5/canon.gp5` in `spikes/m0`. Open `out/rt/full-song.roundtrip.gp` and
  `out/rt/canon.roundtrip.gp` in TuxGuitar 2.1.1 (and Guitar Pro if you have it). Check that the
  Tracks, tunings, notes, ties, slides and bends look right and that it plays. If TuxGuitar can't
  open them, PRD §3.3 has to be reopened.

## 3. What alphaTex cannot express

Same method as 2b, with alphaTex in place of `.gp`: load → `AlphaTexExporter` (all Tracks) →
`ScoreLoader.loadAlphaTex` → compare.

**Kept intact** (no differences in their single-feature files): multiple voices, lyrics (including
templates and placement), bends (GP6–8), whammy, harmonics (all types), slides, hammer-ons and
pull-offs, left-hand tapping, vibrato, trills, tremolo picking, grace notes, ties, dead and ghost
notes, accents, dynamics, fingering, tuplets, beaming modes, repeats and alternate endings,
directions, key and time signatures, ottava, chord diagrams, slash notation, tuning, capo and
multi-bar rests. 1 file of 345 had pitch changes (`drum-tabs.gp`, 2 of 94 notes). 0 files had beat-timing changes.

**Gaps** (files affected out of 345; the "Real-world" column is the subset of 10 real-world Scores.
It shows which gaps occur in real files, not how often they occur in downloads):

| Gap | Files | Real-world | Effect |
|---|---|---|---|
| MIDI port and channel assignment | 345 | 10/10 | Recomputed on import; playback unaffected |
| Print header/footer templates (`style.headerAndFooter`) | 244 | 5/10 | Lost; affects print/PDF only |
| Accidental spelling mode | 163 | 3/10 | Exported as "auto"; spelling can change |
| Custom drum articulation table (GP7/8 drum kits) | 17 | 5/10 | Drum hits are remapped to the default kit. Sound stays the same, but staff line and notehead can change |
| Double bar lines | 30 | 5/10 | Lost |
| **Empty bars** (a bar with no beats) at the end of a Track | 41 | 0/10 | **Exporter bug**: they export as `\| \|` and the importer drops them. Fixable upstream |
| Mid-Score instrument/bank changes; linear volume, balance and tempo fades | 25 | 7/10 | Ramps become steps; some instrument changes are lost |
| GP5 note-duration percent | 6 | 3/10 | Staccato and palm-mute playback length |
| Track hidden in the multi-track view; per-Track tuning/chord display flags | 13 / 55 | 5/10 | Display only |
| Fermata length | 1 | 0/10 | Lost |
| Layout display scale | 5 | 0 | Layout only |

Duplicate tempo markers at the same position are merged into one (96 files). The tempo itself is
the same.

**Not measurable this way.** Anything alphaTab drops when it *loads* a GP file is lost in both
formats, and a model comparison can't see it. The model has no field for RSE (Realistic Sound
Engine) settings: `PlaybackInformation` holds only volume, balance, port, program, bank, channels,
mute and solo. Amp and effect chains and backing tracks are gone the moment a file is opened. That
matches PRD §3.7, which uses SoundFont synthesis.

**How common the gaps are in typical downloaded files.** Not measured. The corpus is alphaTab's own
test files, which lean toward feature tests. In the 10 real-world Scores, every gap that affects what a
reader sees (double bar lines, drum noteheads, accidental spelling) appears in 3–5 of 10, and every
note and every technique survived. To get real numbers, put a sample of downloads in a folder and
run `node roundtrip.mjs tex out/x <files>` and `node aggregate.mjs out/x.json`.

**What this means for M2.** The Lossy-conversion check (§3.4) can be built from this list: inspect
the loaded Score for drum articulations outside the default kit, double bar lines, automations
that ramp or change instrument mid-Score, GP5 duration percents, fermatas and accidental spelling.
alphaTex doesn't lose techniques, which is much better than PRD §3.4 assumed.

## 4. Editing API

alphaTab 1.9.0 has **no editing layer**. There is no cursor (only a playback cursor), no
selection model, no edit commands and no undo/redo. This confirms PRD §6. What it does have:

- **Hit-testing.** `api.boundsLookup.getBeatAtPos(x, y)` and `getNoteAtPos(beat, x, y)`; events
  `beatMouseDown/Move/Up` and `noteMouseDown/Move/Up`.
- **Bar-range highlighting.** `highlightPlaybackRange(startBeat, endBeat)`,
  `applyPlaybackRangeFromHighlight()` and `playbackRange`. This fits "Measure loop, chosen by
  selecting bars" (§3.8) for M1.
- **Model mutators.** `Beat.addNote/removeNote`, `Bar.addVoice`, `Voice.addBeat`, then
  `finish(settings)`. Changing a field directly (e.g. `note.fret`) and re-rendering works on the
  main thread (measured in section 1).
- **alphaTex AST with source positions (new in 1.9.0).** `AlphaTexImporter.scoreNode.bars[i].beats[j]`
  has `start`/`end` `{line, col, offset}`. For the 224-bar text, every bar's AST beat count matched
  the model (0 mismatches), and bar 110, beat 0 pointed at exactly `12.2.8`. **Click-to-source (§3.4)
  is a lookup:** clicked beat → (bar, beat index) → AST node → offset in the text. Beat multipliers
  (`*4`) need handling, and multi-Track and multi-voice text wasn't tested.

## Reproduce

```sh
cd spikes/m0 && npm install
# test data: sparse clone of CoderLine/alphaTab, packages/alphatab/test-data, symlinked as ./testdata
node roundtrip.mjs gp7 out/rt-all  $(find -L testdata -name '*.gp*' -not -path '*/exporter/*' -not -path '*/corrupt/*') > out/rt-all.json  && node aggregate.mjs out/rt-all.json
node roundtrip.mjs tex out/tex-all $(find -L testdata -name '*.gp*' -not -path '*/exporter/*' -not -path '*/corrupt/*') > out/tex-all.json && node aggregate.mjs out/tex-all.json
CHROME=/path/to/chromium node run-bench.mjs > out/bench.json   # timings on stderr
```
