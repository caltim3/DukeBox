# Phrase Machine — Technical Documentation
### For integration into DukeBox (BeatForge + LineLab)

---

## What It Is

The Phrase Machine is a seeded bebop phrase generator built around a **block vocabulary** and a **compatibility graph**. The user assembles a formula by clicking nodes in a branching decision tree. The generator resolves that formula into a note sequence, enforces phrase length, applies voice-leading connectors, and renders notation + guitar tab via abcjs. Phrases save to localStorage and export as MusicXML.

The goal: drill 20 well-constructed bebop lines until block-chaining becomes second nature — so you stop thinking in scales and start thinking in phrases.

---

## Architecture Overview

```
User clicks node in tree
        ↓
formula[] updated (array of block type strings)
        ↓
renderTree() — rebuilds branching tree with ranked next options
        ↓
doGenerate(seed) — resolves formula into notes
    ↓               ↓               ↓
assignChordsToBlocks  makeConnector  enforcePhraseLengthAndLanding
(beat-counting)       (voice-leading) (trim/pad to target)
        ↓
notesToAbcStr() — builds ABC string with bar lines + chord symbols
        ↓
ABCJS.renderAbc() — renders notation + tab SVG
        ↓
playWithWebAudio() / ABCJS.synth — audio playback
```

---

## Core Data Structures

### Note Object
```js
{ note: "G",  dur: 2 }          // dur in eighths: 1=16th, 2=8th, 4=quarter, 8=half
{ note: "z",  dur: 4 }          // rest
{ note: "Eb", dur: 1, triplet: true, tgroup: 0 }  // triplet group
```

### Block Log Entry (produced by generator)
```js
{
  type: "pivot_3rd_up",     // block type key
  chord: "Dm7",             // chord symbol active when block starts
  cat: "pivot",             // category: opener|arp|scale|triad|cell|pivot|triplet|rhythm
  startBeat: 4              // beat position (in eighths) when block starts
}
```

### Phrase Result Object
```js
{
  abc: string,              // full ABC notation string (ready for ABCJS.renderAbc)
  notes: Note[],            // flat note array
  blockLog: BlockLogEntry[],
  targetEighths: number,    // total phrase duration (sum of prog chord beats)
  prog: ChordDef[]          // transposed progression used
}
```

### Chord Definition
```js
{
  symbol: "Dm7",
  root: "D",
  type: "m7",               // key into CHORD_DATA
  slot: "ii",               // harmonic function: ii|V|I|IV
  beats: 8                  // duration in eighths (8 = one 4/4 bar)
}
```

### Chord Data
```js
CHORD_DATA = {
  maj7:    { tones:[0,4,7,11], bop:[0,2,4,5,7,9,11,10] },
  m7:      { tones:[0,3,7,10], bop:[0,2,3,5,7,9,10,11] },
  dom7:    { tones:[0,4,7,10], bop:[0,2,4,5,7,9,10,11] },
  m7b5:    { tones:[0,3,6,10], bop:[0,2,3,5,6,9,10,11] },
  dom7alt: { tones:[0,4,6,10], bop:[0,1,3,4,6,8,10,11] }, // Ab melodic minor
  m6:      { tones:[0,3,7,9],  bop:[0,2,3,5,7,9,11]    },
}
// Intervals are semitones above root. bop = bebop scale (8 notes).
```

---

## The Block Vocabulary

70 blocks across 8 categories. Each is a pure function:

```js
blockFn(root, chord, variation, rng) → Note[]
// root: string ("D", "G", etc.)
// chord: ChordDef
// variation: "shallow"|"medium"|"deep"
// rng: seeded random function () => 0..1
```

### Category Map

| Category | Color  | Typical Duration | Role |
|----------|--------|-----------------|------|
| opener   | gold   | 2–4 eighths     | Pickup, enclosure into beat 1 |
| arp      | blue   | 8 eighths (1 bar) | Arpeggio structures |
| scale    | green  | 6–8 eighths     | Scale runs, bebop scale |
| triad    | pink   | 6–8 eighths     | Triad pairs, upper structures |
| cell     | orange | 8 eighths       | 4-note melodic cells |
| pivot    | teal   | 8 eighths       | Up 3rd arp, pivot, scale down |
| triplet  | purple | 12 eighths      | Rest-stroke triplet chains |
| rhythm   | red    | variable        | Rests, landings, holds |

### Block Duration Table (BLOCK_EIGHTH_DURATION)
Used by beat-counting and phrase enforcement:

```
enclosure_std/dbl/chrom/above: 4
pickup_scale/chrom:             2
arp_root_up/down/3rd/dim/shell: 8
scale_bop_down/up:              8
scale_major_down:               6
scale_mm_down/up:               7
scale_hw_dim/chrom_down:        7-8
scale_pent_down:                5
triad_pair_uu/sub_tt:           8
triad_mm_pair:                  6
cell_*:                         8
pivot_*:                        8
trip_triad_chain/dim_chain:     12
trip_burst_rest:                7
land_and1:                      4
land_and3:                      7
land_hold:                      6
land_beat3_late:                8
```

### Block Flavor (harmonic color)
Each block carries a fixed flavor tag independent of its score:

- `inside` — diatonic, chord tones and scale steps
- `altered` — strong tension (dim7, melodic minor, b9 cells)
- `outside` — chromatic, tritone sub, side-slip

Displayed as colored badges in the tree. Used for visual guidance, not scoring.

### Block Exit Direction (BLOCK_EXIT)
Controls voice-direction path multiplier:

- `high` — block ends above its start (ascending arps, ascending scales, triplet chains)
- `low` — block ends below its start (descending scales, descending arps, burst+rest)
- `neutral` — ends near the middle (cells, pivots, landings)
- `enc` — ends on a specific target (enclosures)

---

## The Three-Layer Ranking System

Every candidate block in the tree gets a score 0–100 via `computeScore()`.

### Layer 1: Grammar Base Score

Hand-coded `GRAMMAR[fromType][toType]` table (~200 explicit pairs). Missing pairs default to 30.

**Top pairs by score:**
```
pivot_3rd_up   → scale_bop_down   : 95  (core Parker/Vincent move)
arp_3rd_up     → scale_bop_down   : 92  (Bud Powell stack-then-walk)
arp_dim_up     → land_and3        : 95  (tension payoff)
cell_b9cell    → land_and3        : 95  (altered cell into resolution)
trip_dim_chain → land_and3        : 95  (gallop directly home)
enclosure_std  → pivot_3rd_up     : 90  (enclose root, then pivot)
scale_bop_down → arp_dim_up       : 85  (descend, then b9 arp)
triad_sub_tt   → land_and3        : 92  (tritone sub into resolution)
cell_b7R53     → land_and3        : 92  (Barry Harris outline home)
```

**Landing gate rule:** if `toType` starts with `land` and the position is not the last slot, score × 0.2. Landing blocks are buried until the final position.

### Layer 2: Slot Fitness Multiplier

```
           opener  arp   scale  triad  cell  pivot  triplet  rhythm
ii slot:   0.90   0.85   0.80  0.75   0.80  0.90    0.70    0.30
V  slot:   0.50   0.80   0.85  0.85   0.80  0.75    0.85    0.50
I  slot:   0.30   0.60   0.50  0.50   0.60  0.50    0.50    0.95
IV slot:   0.60   0.80   0.80  0.75   0.75  0.70    0.70    0.40
```

Grammar base × slot fitness = adjusted score.

### Layer 3: Personal Usage Bonus

```js
usageBonus = Math.min(useCount * 4, 20)
// Stored in localStorage as pm_usage: { "pivot_3rd_up>scale_bop_down": 5 }
```

After drilling 20 phrases, preferred pairs surface above generic alternatives. Max bonus: +20 points.

### Voice Direction Multiplier

Applied to the adjusted score based on the preceding block's exit direction and the selected path:

```
                  exits high  exits low  exits neutral/enc
ascending path:     ×1.2       ×0.6        ×1.0
descending path:    ×0.6       ×1.2        ×1.0
arch (1st half):    ×1.2       ×0.8        ×1.0
arch (2nd half):    ×0.8       ×1.2        ×1.0
valley (1st half):  ×0.8       ×1.2        ×1.0
valley (2nd half):  ×1.2       ×0.8        ×1.0
chromatic:          ×0.9       ×0.9        ×1.1
```

### Score → Display Tier

```
80–100: Hot  (gold)   — grammar strongly prefers this
65–79:  Warm (blue)   — good choice, fits harmony
45–64:  OK   (green)  — works, less idiomatic
0–44:   Out  (purple) — possible, outside the grammar
```

---

## Fix 1: Beat-Counting Chord Assignment

`assignChordsToBlocks(formula, prog)`:

1. Build a beat timeline from the progression: each chord occupies `ch.beats` eighths.
2. Walk through the formula, tracking running beat position using `BLOCK_EIGHTH_DURATION`.
3. At each block's start beat, look up the active chord in the timeline.
4. Return `{ chord, startBeat }` for each formula slot.

**Before (broken):** formula[0] → prog[0], formula[1] → prog[1], etc. regardless of duration.

**After:** a pivot block starting at beat 12 correctly receives G7, not Dm7, even though it's formula[1].

```js
function assignChordsToBlocks(formula, prog) {
  const timeline = [];
  let cursor = 0;
  prog.forEach(ch => {
    timeline.push({ start: cursor, end: cursor+(ch.beats||8), chord: ch });
    cursor += (ch.beats||8);
  });
  let beat = 0;
  return formula.map(blockType => {
    let active = timeline[timeline.length-1].chord;
    for(const seg of timeline) {
      if(beat >= seg.start && beat < seg.end) { active = seg.chord; break; }
    }
    const dur = blockDur(blockType);
    const result = { chord: active, startBeat: beat };
    beat += dur;
    return result;
  });
}
```

---

## Fix 2: Phrase Length Enforcement

`enforcePhraseLengthAndLanding(allNotes, targetBeats, landingBeat, landing)`:

- `targetEighths` = sum of all `ch.beats` in the progression (e.g. 24 for a 3-bar 2-5-1).
- `landingBeat` = where the final note should fall within the last bar:
  - `and1` → offset 1 (& of beat 1)
  - `and3` → offset 5 (& of beat 3) — **default, Galper sweet spot**
  - `late3` → offset 9 (late arrival on beat 3)
  - `beat1` → offset 0
- If phrase is too long: trim notes from the tail, pad with a rest to hit exact beat.
- If phrase is too short: pad with rests to reach `landingBeat`.

The info strip below the notation shows:
```
Target: 24 eighths (3 bars) | Generated: 23 eighths
```

---

## Fix 3: Voice-Leading Connector Engine

`makeConnector(lastNote, firstNote, variation, rng, chord)` → `Note[]`

Replaces the old single-chromatic-passing-tone with a full decision tree:

| Interval (semitones up) | Action |
|------------------------|--------|
| 0 (unison/octave)      | Nothing |
| 1, 11 (half step)      | Nothing — direct connect |
| 2 (whole step up)      | 1 chromatic passing tone (skip on Shallow) |
| 10 (whole step down)   | 1 chromatic passing tone (skip on Shallow) |
| 3 (minor 3rd up)       | 1 scale step |
| 9 (minor 3rd down)     | 1 scale step |
| 4, 5 (major 3rd/4th)   | Micro-enclosure: lower chromatic approach (+ upper on Deep) |
| 6+ (tritone or larger) | 2-note chromatic approach from below (1 note on Shallow) |

Budget-aware: connector is skipped if adding it would push the phrase past `targetEighths + 4`.

---

## ABC Notation Generation

`notesToAbcStr(noteObjs, blockLog, prog, totalEighths)`:

1. Builds a `chordTimeline` from the transposed progression — maps beat positions to chord symbols.
2. Injects `"Dm7"` etc. into the ABC string at the correct beat.
3. Inserts `|` bar lines every 8 eighths.
4. Assigns octaves for guitar barrel zone (MIDI 53–75, roughly frets 3–8):
   - Picks the octave closest to the previous note (smooth voice-leading).
   - Prefers MIDI 53–75 if the nearest-note choice is out of that range.
   - Falls back to the middle octave if the jump would exceed an octave.
5. Handles triplet prefix `(3` for grouped triplet notes.

**ABC pitch notation:**
```
C → c (C4, MIDI 60)
C → C, (C3, MIDI 48)
C → c' (C5, MIDI 72)
Eb → _e (enharmonic map applied)
F# → ^f
```

---

## Supported Progressions

```js
major251:   Dm7(8) → G7(8)   → Cmaj7(8)       // 24 eighths, 3 bars
minor251:   Dm7b5(8) → G7alt(8) → Cm6(8)       // 24 eighths, 3 bars
jazz_blues: C7(8) F7(8) C7(8) G7(8) F7(4) C7(4) // 36 eighths, 4.5 bars
autumn:     Cm7(8) F7(8) BbM7(8) Am7b5(8) D7alt(8) Gm7(8) // 48 eighths, 6 bars
```

All progressions are transposable: `transposeProgression(prog, key)` offsets every root by semitone distance from C.

---

## Playback

Two-tier system:

1. **abcjs synth** — loads FluidR3 GM soundfont from `paulrosen.github.io/midi-js-soundfonts`. Program 25 (acoustic guitar). Works on any real domain.
2. **Web Audio fallback** — triangle-wave oscillator synthesizer baked into the page. No external dependencies. Works offline. Triggered automatically if the soundfont CDN is unreachable.

Both respect the Loop toggle. Stop cuts all scheduled nodes immediately.

---

## Persistence

- **Phrases:** `localStorage: pm_phrases` — array of saved phrase objects with formula, key, prog, tempo, variation, seed, abc string, created timestamp.
- **Usage stats:** `localStorage: pm_usage` — `{ "blockA>blockB": count }` pairs for personal ranking.
- **Export:** MusicXML 3.1 download — standard `score-partwise` with note pitch, duration, and tempo. Compatible with MuseScore, Dorico, Guitar Pro, Sibelius.

---

## Integration Points for DukeBox

### LineLab integration

The core generator is five pure functions with no DOM dependencies:

```js
transposeProgression(rawProg, key)       // → ChordDef[]
assignChordsToBlocks(formula, prog)      // → { chord, startBeat }[]
makeConnector(lastNote, first, v, rng)   // → Note[]
enforcePhraseLengthAndLanding(notes, target, beat, landing) // → Note[]
runGenerator(formula, key, progType, tempo, variation, seed) // → PhraseResult
```

These can be extracted into a standalone `phrase-engine.js` module and imported into LineLab. The only browser dependency is `document.getElementById('sel-land')` inside `runGenerator`, which should be refactored to accept `landing` as a parameter.

### BeatForge integration

The `BLOCK_EIGHTH_DURATION` table gives exact beat counts for each block type, which BeatForge can use to:
- Place blocks on a timeline grid
- Compute where each block falls relative to the drum pattern
- Enforce rhythmic alignment between the phrase and the beat

The `blockLog[i].startBeat` value is the hook — it tells BeatForge exactly when each block starts in eighths from the top of the phrase.

### Shared vocabulary

The block type strings (`pivot_3rd_up`, `scale_bop_down`, etc.) are the shared vocabulary between the Phrase Machine, LineLab, and BeatForge. A phrase saved from the Phrase Machine can be loaded in LineLab by passing its `formula[]` array and `blockLog[]` to the same generator. BeatForge sees the same `startBeat` values for rhythmic alignment.

### Suggested refactor for module extraction

```js
// phrase-engine.js — no DOM, no ABCJS, no audio
export {
  NOTES, CHORD_DATA, PROGRESSIONS, BLOCK_EIGHTH_DURATION,
  BLOCK_FNS, BLOCK_CAT, BLOCK_FLAVOR, BLOCK_EXIT,
  GRAMMAR, SLOT_FIT, PATH_BONUS,
  seededRand, transposeProgression, getChordTones, getBopScale, getDimNotes,
  blockDur, makeConnector, assignChordsToBlocks,
  enforcePhraseLengthAndLanding, runGenerator,
  computeScore, getTopN, tier,
};

// phrase-renderer.js — ABCJS + DOM
import { runGenerator } from './phrase-engine.js';
export { notesToAbcStr, renderPhrase };

// phrase-audio.js — Web Audio + ABCJS synth
export { doPlay, stopAudio, playWithWebAudio };
```

---

## Key Musical Rules Encoded

| Rule | Where |
|------|-------|
| Land on & of 1 or & of 3 (Galper forward motion) | `enforcePhraseLengthAndLanding`, landing offset map |
| Chord tones on downbeats (bebop scale machine) | `scale_bop_down` — 8 notes, chord tones on beats |
| Ascending on ii, descending on V (arch path) | `PATH_BONUS`, arch dynamic halving |
| Enclosure → arpeggio is the strongest opener pair | `GRAMMAR[enclosure_std][pivot_3rd_up] = 90` |
| Dim7 arp exits demand resolution | `GRAMMAR[arp_dim_up][land_and3] = 95` |
| Landing blocks only appear at end | gate: score × 0.2 if not final slot |
| Micro-enclosure between distant blocks | `makeConnector` interval table |
| Personal vocabulary surfaces over time | `pm_usage` localStorage + usageBonus |
| Inside/altered/outside visible at a glance | `BLOCK_FLAVOR` + flavor badges |
| Barrel zone fingering (frets 3–8) | octave selection in `notesToAbcStr` |

---

## Open Items / Next Steps

1. **Refactor `runGenerator` to accept `landing` as parameter** (remove `document.getElementById` call from the pure engine).
2. **Extract `phrase-engine.js`** as a standalone ES module for DukeBox import.
3. **Add `startBeat` to connector notes** so BeatForge knows their exact position.
4. **Autumn Leaves / Jazz Blues chord labels** — multi-bar progressions need the chord symbol injection tested against longer phrases.
5. **Barrel-zone fret assignment** — current system prefers the zone but doesn't enforce specific string/fret pairs. AlphaTab with alphaTex `fret.string` notation would give exact fingerings (works on your own domain, not in Claude sandbox).
6. **Practice queue** — a simple drill mode that loads saved phrases one at a time, hides the formula, and prompts you to play it before revealing the block structure.

---

*Built for Timo — DevEngine / DukeBox — August 2026*
