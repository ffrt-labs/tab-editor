# tab-editor (working name)

A fully-offline browser tool for writing guitar tablature and practising from it: open or write a
Score, play it back with a synthesiser, slow it down and loop measures until they are yours.

## Language

**Score**:
The notated piece — tracks, measures, notes, tempo — as held in alphaTab's score model, which is this
app's model. Loaded from and saved to a file on disk.
_Avoid_: Song (that is Gerson's word for a recording), tab, file, document

**Track**:
One instrument part within a Score (e.g. lead guitar, bass, drums), with its own tuning and staves.
_Avoid_: Stem (Gerson's word for a separated recording), part, channel

**Playback speed**:
How fast the Score plays, as a percentage of its written BPM (25%–200%). The resulting BPM is always
shown alongside, because a Score — unlike a Gerson recording — knows its beats.
_Avoid_: Tempo (reserved for the BPM written in the Score), rate

**Measure loop**:
A range of whole measures that playback repeats. Always snapped to bar lines. At most one at a time.
_Avoid_: Loop region (Gerson's unaligned loop), selection, section

**alphaTex**:
alphaTab's plain-text notation. The v1 editing surface and one of the two save formats.
_Avoid_: LilyPond (a different language; only a future export target)

**Lossy conversion**:
Turning a Score loaded from a Guitar Pro file into alphaTex when it contains features alphaTex cannot
express. Always warned about before it happens; never silent.
