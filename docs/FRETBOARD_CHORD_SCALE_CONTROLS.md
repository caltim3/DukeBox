# Fretboard Card — Chord/Scale Strategy Controls

What every button in the Fretboard card's settings drawer (SYSTEMS / OVERLAYS
/ TUNING / LABELS / FRET FOCUS) actually does, how they interact with each
other, and a revamp proposal aimed at one goal: **practicing improvised lines
that connect across a chord progression**, not just picking a scale for one
chord in isolation.

This is a reference for the code as it stands after the Focus-mode/3:2-System/
Transpose work (`src/app/page.js`'s settings drawer, `src/lib/music/tonal.js`,
`src/lib/music/threeTwoSystem.js`). Every claim below is traced to a specific
function or code path, not guessed from the screenshot.

---

## Part 1 — What each control does

### SYSTEMS row

**Chord / Scale** — the base display mode. `fretboardView` is either `"chord"`
(only the current chord's own tones lit — root, 3rd, 5th, 7th) or `"scale"`
(the full recommended scale for the chord, computed by
`getRecommendedScalesFromQuality(quality)` — e.g. `maj7` → major/Lydian,
plain `7` → Mixolydian/Lydian-dominant/altered, `min7b5` → Locrian/Locrian
♮2). This is the single most load-bearing toggle in the panel: everything
below it (the five filter buttons, Bebop, Barry's passing tone) only has
something to draw when `view === "scale"`.

**Pentatonic / Hexatonic / Martino / Hex·Chord / Barry 6th** — five
mutually-exclusive filters (`scaleFilter`) that each *replace* the
recommended scale with a differently-organized subset, via
`applyScaleFilter()` in `tonal.js`:

| Filter | Formula | What it's for |
|---|---|---|
| **Pentatonic** | Major quality → 1 2 3 5 6; everything else → 1 ♭3 4 5 ♭7 | The blues/rock five-note vocabulary — fewest notes, most forgiving under tempo. |
| **Hexatonic** | Randy Vincent's three hex families, root-remapped per quality (dominant chords borrow from a half-step *above* the root, half-diminished from a minor 3rd above; a minor-7 chord gets the Dorian-flavored minorHex from its own root when it's read as a ii resolving into a following dominant — harmony.js's `functionLabel === "subdominant"` — and the melodicMinorHex a minor ii-V-i actually resolves to otherwise, e.g. the i) | Six-note shapes that stay inside one hand position better than a full seven-note scale. |
| **Martino** | Pat Martino's "everything is minor" reharmonization — `martinoMapper()` remaps *any* chord to a minor-7 (or minor-7♭5) shape from a different root (maj7 → the relative minor a 6th up; dominant → minor a half step up, e.g. G7 → Ab), then applies the standard minor hexatonic to that | One fingering system for the whole neck, at the cost of an extra mental remap step per chord. |
| **Hex·Chord** | `hexChoiceForChord()` — six notes built *from the chord's own root*, function-aware (major/dominant/minor7/half-dim/whole-tone/altered) | Same six-note idea as Hexatonic, but without Martino's or Vincent's root-shifting — what you see is rooted where you're already anchored. |
| **Barry 6th** | `barryHarrisScale()` — an 8-note "6th-diminished" scale (major/minor/dominant family) with one built-in chromatic passing tone | Barry Harris's bebop vocabulary — deliberately *not* minimal; it's the scale bebop lines are built from. |

Clicking any of the five **also forces `view` to `"scale"`** (`if (next)
setFretboardView("scale")` in `page.js`) — you don't have to remember to
switch off Chord view first. Clicking the *same* filter again turns it off
(back to the plain recommended scale).

### OVERLAYS row

**+Bebop Chromatic** (`bebopOverlay`) — adds one chromatic passing tone to
whatever scale is currently showing, via `applyScaleFilter(notes, root,
quality, "bebop")`: a major 7th between ♭7 and root for dominants and minor
chords, a ♯5 between 5 and 6 for major chords. Under Hexatonic or Martino it
switches to a *different*, two-note passing-tone rule
(`getHexatonicBebopNotes()`) instead of the single-note one — see Part 2 for
why that matters.

**Voice Leading / Melody / Off** (`guideMode`, chosen via `chooseGuideMode()`)
— a three-way, mutually exclusive choice for what the board's "connection"
layer shows:
- **Voice Leading** (the default): the current chord's 3rd and 7th lit as
  guide tones, the *next* chord's guide tones ghosted onto the same neck, and
  a drawn route between them — literally the shortest voice-leading path from
  this chord into the next one.
- **Melody**: instead of the automatic guide-tone pairing, it lights whatever
  line you drew in the Melody Paths panel.
- **Off**: chord/scale tones only, no target notes, no ghosting.

This is computed from `melodyPathState` (driven by `MelodyPaths`), which is
**independent of `scaleFilter`** — Voice Leading's ghost-and-route overlay
draws on top of *any* of the seven SYSTEMS choices without conflict. This is
the one piece of the panel that's actually about connecting chord to chord
rather than describing one chord in isolation.

### TUNING

A plain instrument setting (`fretboardTuning` — Standard / Drop D / Open G /
DADGAD / Open D / Open E). Doesn't affect *which* notes are recommended, only
*where* they fall on the neck. The 3:2 System requires Standard tuning and
disables itself otherwise.

### LABELS

**Names / Degrees** (`labelMode`) — note names (`Bb`, `D`, `F`) vs. scale
degrees (`1`, `3`, `5`) on every dot, in every mode including the 3:2 System.
Degrees are transposition-invariant — the same shape reads the same in every
key, which is closer to what you're actually thinking about mid-solo; Names
is the study view for learning what's actually sounding.

### FRET FOCUS

**Off / Manual / Auto** (`focusMode`) — a *window*, not a note-selection
control: the neck stays fully lit either way, but everything outside the
window dims. Auto recomputes the window every few bars to "follow the
position that costs the least hand travel over the next four bars"
(`autoFocusStart`) — i.e. it's reading the same upcoming-chords data the
Voice Leading ghost uses, but turning it into a *physical* recommendation
(where to put your hand) instead of a note-selection one.

**3:2 System** (`threeTwoMode` + `threeTwoLevel`) — the Pickup Music 3:2
pentatonic system, wired to the loaded chart
(`src/lib/music/threeTwoSystem.js`). This is **not a window** like
Off/Manual/Auto next to it — it replaces the note-selection pipeline
entirely, the same way `scaleFilter` does, just with its own visual system
(exact reference-page colors, diagonal highway bands) instead of the maple
board's usual root/chord/scale palette. It:
1. Classifies the loaded chart's form (`classifySongForm()`) — blues, minor
   blues, jazz blues, major/minor standard, or a static modal vamp — reusing
   `analyzeProgressionContext()`, the same cadence/function analysis that
   already drives `getRecommendedScalesFromQuality`.
2. Offers that form's own 4-level ladder (`getLevelDefs()`):
   - **0 · Chord scales** — the same 7-note scale Level 0 of SYSTEMS would
     show, just drawn in the 3:2 System's own colors (root/chord-tone/
     tension) instead of the maple board's.
   - **1 · Home base** (blues) **/ Inside** (everything else) — one blanket
     pentatonic for the whole blues form, or each chord's own matching
     pentatonic elsewhere.
   - **2 · Chase the chord** (blues) **/ Color** (everything else) — the
     chord's own root pentatonic instead of the blanket, or a pentatonic off
     the 5th/3rd for upper-structure color.
   - **3 · Altered turnarounds / Altered** — chords that pull hard into the
     next one (a resolving V7, a half-diminished) get the ♭3-up pentatonic
     trick; everything else keeps its Level 2 choice.

---

## Part 2 — How they actually relate to each other

Two genuinely independent axes are doing all the work here:

- **"What can I play over this one chord"** — SYSTEMS (Chord/Scale + the five
  filters), Barry, Martino, Hex·Chord: all palette questions, answered fresh
  for whichever bar is selected.
- **"How do I get from this chord to the next one"** — Voice Leading's
  ghost-and-route, and Fret Focus Auto's hand-position recommendation: both
  read the *upcoming* chord, not just the current one.

That split is real and it's good architecture — Voice Leading doesn't care
what `scaleFilter` is set to, so any palette choice can be practiced *with*
the connection overlay on top. But the panel doesn't communicate that split
at all right now; all eleven controls sit in one flat, equally-weighted grid,
so a player has no way to know which ones are about *this* chord and which
are about the *seam* between chords — which is the actual skill "practicing
connections" is asking them to build.

On top of that, a few concrete interaction gaps, all verified against the
current code:

1. **3:2 System silently overrides everything above it, with no visual
   sign.** Once `threeTwoMode` is on, `Fretboard.js` short-circuits the
   entire normal dot pipeline — SYSTEMS, +Bebop, Voice Leading's ghosts and
   routes all stop affecting the board. Labels (Names/Degrees) still works,
   because it's passed straight into the 3:2 board builder. But SYSTEMS and
   OVERLAYS stay fully lit and clickable, as if they still mattered. A player
   can spend a minute toggling Hexatonic and Voice Leading, wondering why
   nothing changes, before realizing 3:2 is the reason.

2. **Turning "Chord" back on doesn't clear the filter that's still
   highlighted.** Click Pentatonic (forces `view` to `"scale"`), then click
   "Chord" — the board correctly shows chord tones only, but the Pentatonic
   button stays lit blue, implying it's still in effect. It isn't; it's just
   waiting for you to click "Scale" again.

3. **Hex·Chord doesn't get the two-note bebop treatment Hexatonic does.**
   `bebopPassingNotes` special-cases `scaleFilter === "hexatonic"` (and
   Martino) for a two-note passing-tone rule tuned to six-note scales, but
   Hex·Chord — also a six-note family — falls through to the *standard*
   single-note bebop rule instead. Two conceptually similar filters, two
   different bebop behaviors, no indication why.

4. **+Bebop Chromatic is very likely a no-op over Barry 6th.** Barry's scale
   is already an 8-note bebop scale with its own built-in chromatic passing
   tone; the standard bebop overlay adds a passing tone only if the chroma
   isn't already present in the base scale, and Barry's family tables were
   *designed* to already include it. The control doesn't say so — it just
   quietly does nothing.

5. **Tuning is the only control in this drawer that isn't a chord/scale
   decision at all.** It's grouped here purely because it lives on the same
   `<select>` row, not because it belongs with SYSTEMS/OVERLAYS/FRET FOCUS
   conceptually.

---

## Part 3 — Revamp proposal

The goal to design toward: a player has a chart loaded and wants to practice
improvising lines that *connect* across the changes — not memorize one scale
per chord in isolation. Three concrete moves:

### 1. Split the drawer into two visibly distinct groups

**PALETTE** (what's available over this chord): Chord/Scale, the five
filters, Barry, Martino, Hex·Chord, Labels. **CONNECT** (how this chord leads
into the next one): Voice Leading/Melody/Off, Fret Focus (Off/Manual/Auto),
and — moved here from Fret Focus, see below — the 3:2 System's own level
ladder, since Levels 1–3 are fundamentally about the *shape* carrying you
from one chord to the next, which is a connection question, not a window
question. Two labeled panels instead of one flat grid tells a player
immediately which controls answer which of the two questions "practicing
connections" actually requires.

### 2. Move the 3:2 System out of Fret Focus and into SYSTEMS, as an 8th
palette choice

It was placed next to Off/Manual/Auto because — like them — it takes over the
neck. But it isn't a window; it's a whole alternate note-selection system,
exactly like Pentatonic or Barry are. Making it the 8th button in the SYSTEMS
row (with its own level sub-row appearing directly under it, the way it does
now) puts it where a player would actually look for "a different set of notes
to play," and makes its mutual exclusivity with the other seven SYSTEMS
choices structurally obvious — clicking it turns them off the same way
clicking Pentatonic turns off Hexatonic, instead of leaving them lit and
inert.

### 3. Fix the three quiet inconsistencies

- Clicking "Chord" clears the active filter's highlighted state (not just
  its effect) — `setScaleFilter(null)` alongside `setFretboardView("chord")`.
- Give Hex·Chord the same two-note bebop passing-tone treatment as
  Hexatonic in `bebopPassingNotes`, or explicitly document why it shouldn't
  have one.
- Either suppress +Bebop Chromatic while Barry is active (it has nothing to
  add), or swap its label/tooltip to say so, so a player isn't left
  wondering why the button did nothing.

### 4. One live sentence under the board, always

The board already computes `scaleLabel`/`scaleLabelFull` and the 3:2 System's
own `why` text — both explain *why* the current shape is what it is
("altered — a5th above root, upper-structure color" etc.), but only the 3:2
System's version is actually surfaced as prose today. Promoting one
always-visible line — "You're seeing: G Mixolydian (recommended for G7)" or
"You're seeing: 3:2 System · Level 2 · F minor pentatonic, a 5th above Bb" —
turns eleven buttons' worth of state into one sentence a player can check
without reverse-engineering which toggles are currently active.

### 5. Consider a per-chord "Smart" default for PALETTE

The 3:2 System already proves the pattern: classify the chord's function
against the surrounding progression and pick a sensible default rather than
asking for a manual choice every bar. The same read (`analyzeProgressionContext`)
already exists for `getRecommendedScalesFromQuality`'s primary pick. A
"Smart" toggle at the top of PALETTE that auto-selects (recommended scale on
a static chord, altered/color per the 3:2 logic on a resolving dominant,
pentatonic-off-the-5th on a ii in a diatonic run) — with every manual button
still available underneath for a player who wants to override it — would
mean a beginner never has to *think* about which of eight systems to reach
for, while an advanced player can still hand-pick one per bar exactly as
today.

---

*Everything above describes `src/app/page.js`'s Fretboard settings drawer as
of the Focus-mode/3:2-System work; line numbers will drift as the file
changes, but the function names (`applyScaleFilter`, `chooseGuideMode`,
`martinoMapper`, `barryHarrisScale`, `hexChoiceForChord`, `classifySongForm`,
`getLevelDefs`) are stable anchors for finding the current code.*
