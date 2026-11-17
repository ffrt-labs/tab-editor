# M0 spike: validate alphaTab as the foundation (go/no-go)

## Why

`PRD.md` §3.2 makes alphaTab's score model the app's model and §3.4 makes alphaTex the v1 editing
surface. Both rest on facts nobody has measured yet. This spike settles them before any app code.

## What to find out

1. **Re-render latency.** Load a ~200-measure multi-track GP file, change one note in the model,
   re-render. Measure wall time on a desktop Chromium. Check whether alphaTab can re-render only the
   changed measure/system.
   - Pass: < 100 ms, or partial re-render available.
2. **`.gp` export.** Confirm alphaTab ships a GP7 exporter. Round-trip: `.gpx` → load → export `.gp`
   → open in TuxGuitar (and Guitar Pro if available). Note anything lost.
3. **alphaTex gaps.** List Guitar Pro features alphaTex cannot express (techniques, effects,
   multi-voice, lyrics, RSE settings, etc.), and how common each is in typical downloaded GP files.
4. **Editing API.** Confirm whether alphaTab offers any cursor/selection/edit/undo API.

## Output

A findings note in `docs/research/m0-spike.md` with numbers, plus a go / no-go call:
- Go → start M1 (Player).
- No-go on 1 → reopen PRD §3.2 (own model + adapter).
- No-go on 2 or 3 → reopen PRD §3.3 / §3.4.

Throwaway code; don't build app scaffolding here.
