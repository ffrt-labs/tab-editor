# tab-editor — Product Requirements

**Status:** decisions settled (grilling session, 2026-11-17). Pre-M0. Not yet a build-ready spec.

---

## 1. What it is

An open-source tab editor and practice player that runs in the browser. You open a Guitar Pro file or
write a Score from scratch, see it as notation and tab, and practise from it: slow it down, loop
measures, mute your own part and play along with the synthesised band.

## 2. Constraints (inherited from Gerson)

1. **No server, ever.** No accounts, no upload, no backend. Static hosting only.
2. **Offline after first load.** Installable PWA.
3. **Desktop-first.** Editing is a desktop job; phones and tablets are practice players.

## 3. Decided

### 3.1 Scope of v1: editor first, recordings later
v1 is a notation editor plus synth practice. Practising along to a *real recording* with a synced
Score is out of v1 — that is the bridge to Gerson (§3.12).

### 3.2 Foundation: alphaTab (MPL-2.0)
alphaTab's score model **is** this app's model. alphaTab provides import, rendering and playback
(alphaSynth); we build the editing layer on top and upstream fixes where needed. Gated by the M0
spike (§4).

### 3.3 Formats
- **Open:** GP3–5, `.gpx` (GP6), `.gp` (GP7/8), MusicXML, alphaTex — whatever alphaTab imports.
- **Save:** `.gp` (GP7/8) as the full-fidelity interchange format, and alphaTex as the text format.
- `.gpx` is import-only: it is a superseded proprietary container no current tool expects to receive.
- Later: LilyPond `.ly` export for engraved print. MusicXML export only on demand.

### 3.4 Editing in v1: alphaTex split pane
Text on the left (CodeMirror), live-rendered Score on the right, click a note to jump to its source.
Opening a Guitar Pro file for text editing checks for features alphaTex can't express and warns
before a Lossy conversion. **v2 headline:** Guitar Pro-style cursor entry on the tab staff.

### 3.5 LilyPond
Not an input language and not a renderer (GPL, no browser build, would need a server). Export target
only, post-v1.

### 3.6 Storage: files on disk
Files on disk are the source of truth, via the File System Access API (Chromium). Firefox/Safari and
phones fall back to import/download. IndexedDB holds only a recent-files list and crash-recovery
autosaves.

### 3.7 Sound
A small General MIDI SoundFont is bundled. The user can load their own `.sf2` from disk; the choice is
remembered. No large or realistic-sample fonts bundled.

### 3.8 Practice features in v1
- Play/pause with a following playback cursor
- Playback speed 25%–200%, with resulting BPM shown
- Measure loop, chosen by selecting bars
- Metronome and count-in
- Per-Track mute / solo / volume

**Out of v1:** speed trainer (first post-v1 item), play-along feedback / pitch detection, recording sync.

### 3.9 Instruments
Target: fretted instruments — 4–8 strings, any tuning, capo, guitar and bass. Multi-track scores open
and play. Drums and keys work as far as alphaTex allows, without dedicated polish.

### 3.10 Devices
Desktop: full editor. Phone/tablet: practice-only player (open via import, play, speed, loop,
mute/solo); the text pane is hidden or read-only on small screens.

### 3.11 Project
- Separate repo `ffrt-labs/tab-editor` (working name; a Gerson-style name is chosen before public launch).
- Same stack and conventions as Gerson: Vite, React, TypeScript, pnpm, Vitest, `vite-plugin-pwa`,
  static deploy on Cloudflare via Wrangler; `CONTEXT.md` + `docs/adr/`.
- GitHub Issues, as in Gerson.
- Licence: MIT (Gerson gets a matching MIT `LICENSE`).

### 3.12 Bridge to Gerson (intent only)
A Score can later be linked to a Gerson Song through a **beat map** that aligns measures to recording
time — giving a scrolling Score over real separated stems. Not designed yet. The glossaries are kept
deliberately distinct until then (see `CONTEXT.md`).

## 4. Milestones

- **M0 — Spike (go/no-go).**
  1. Re-render latency after a one-note change on a 200-measure score: target < 100 ms (or partial
     re-render available). Fail → reopen §3.2 (own model + adapter) or §3.4.
  2. alphaTab `.gp` export exists and round-trips: GPX → `.gp` → opens correctly in Guitar Pro /
     TuxGuitar.
  3. Inventory of Guitar Pro features alphaTex cannot express.
- **M1 — Player.** Open any GP file from disk, render, all §3.8 practice features. Works on phone/tablet.
- **M2 — Editor.** alphaTex split pane, new Score, click-to-source, save `.gp` + alphaTex, Lossy
  conversion warning.
- **M3 — Daily driver.** Offline PWA, recent files + crash autosave, custom `.sf2`, final name.

## 5. Definition of done (v1)

You can transcribe a song from scratch and practise it in this app without opening Guitar Pro or
TuxGuitar.

## 6. Unverified facts (checked in M0)

- alphaTab ships a GP7 `.gp` exporter.
- alphaTab has no editing API (cursor, entry, undo).
- Recent TuxGuitar versions import `.gp`.
