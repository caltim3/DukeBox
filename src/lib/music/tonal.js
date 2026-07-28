import { Chord, Scale, Note, Interval } from "@tonaljs/tonal"

// Preferred jazz spellings for each chromatic pitch class
const JAZZ_SPELLING = {
  0: "C", 1: "Db", 2: "D", 3: "Eb", 4: "E",
  5: "F", 6: "Gb", 7: "G", 8: "Ab", 9: "A", 10: "Bb", 11: "B",
}

export const ROOTS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

export const QUALITIES = [
  { value: "maj7", label: "maj7" },
  { value: "min7", label: "m7" },
  { value: "7", label: "7" },
  { value: "min7b5", label: "m7b5" },
  { value: "dim7", label: "dim7" },
  { value: "7alt", label: "7alt" },
  { value: "maj6", label: "6" },
  { value: "min6", label: "m6" },
  // ── Extended / modal colors (Desert Noir vocabulary) ──
  { value: "maj", label: "maj (triad)" },
  { value: "min", label: "m (triad)" },
  { value: "maj9", label: "maj9" },
  { value: "9", label: "9" },
  { value: "6/9", label: "6/9" },
  { value: "add9", label: "add9" },
  { value: "sus4", label: "sus" },
  { value: "7sus4", label: "7sus" },
  { value: "7b9", label: "7b9" },
  { value: "maj7#11", label: "maj7#11" },
  { value: "min9", label: "m9" },
  { value: "min6/9", label: "m6/9" },
  { value: "minadd9", label: "m(add9)" },
  { value: "min(maj7)", label: "m(maj7)" },
]

export const QUALITY_TO_SYMBOL = {
  maj7: "maj7",
  min7: "m7",
  "7": "7",
  min7b5: "m7b5",
  dim7: "dim7",
  "7alt": "7alt",
  maj6: "6",
  min6: "m6",
  // ── Extended / modal colors → @tonaljs-recognized symbols ──
  maj: "",            // major triad
  min: "m",           // minor triad
  maj9: "maj9",
  "9": "9",
  "6/9": "6/9",
  add9: "add9",
  sus4: "sus4",
  "7sus4": "7sus4",
  "7b9": "7b9",
  "maj7#11": "maj7#11",
  min9: "m9",
  "min6/9": "m69",
  minadd9: "madd9",
  "min(maj7)": "mMaj7",
  NC: "",             // no chord — playback rests, display handled separately
}

export function buildChordSymbol(root, quality) {
  if (quality === "NC" || root == null) return "N.C."
  const suffix = QUALITY_TO_SYMBOL[quality] ?? quality ?? ""
  return `${root}${suffix}`
}

/**
 * Strip a slash bass so @tonaljs can parse the chord.
 * Tonal's Chord.get returns an EMPTY chord for "Am7/G", "C/G", "D7/Gb" etc.,
 * which silently blanks analysis and drops voicings during playback. Every
 * Chord.get call site goes through this first; the bass note is carried
 * separately on `bar.bass` and used by the bass line.
 */
export function chordBase(symbol) {
  return String(symbol ?? "").replace(/\/[A-G][b#]?\d*$/, "")
}

// Parse a chord symbol, tolerating slash bass.
export function getChord(symbol) {
  return Chord.get(chordBase(symbol))
}

export function chordNotes(symbol) {
  return getChord(symbol).notes || []
}

export function scaleNotes(scaleName, root) {
  return Scale.get(`${root} ${scaleName}`).notes || []
}

export function transpose(note, interval) {
  return Note.transpose(note, interval)
}

export function chordInfo(symbol) {
  const chord = getChord(symbol)

  return {
    symbol,
    notes: chord.notes || [],
    intervals: chord.intervals || [],
    quality: chord.quality || "",
    type: chord.type || "",
  }
}

export function guideTones(symbol) {
  const chord = getChord(symbol)
  const intervals = chord.intervals || []
  const notes = chord.notes || []
  const guide = []

  intervals.forEach((interval, i) => {
    if (interval === "3M" || interval === "3m" || interval === "7m" || interval === "7M") {
      guide.push(notes[i])
    }
  })

  return guide
}

export function progressionGuideTones(chords) {
  return chords.map((chord) => ({
    symbol: chord.symbol,
    guideTones: guideTones(chord.symbol),
    notes: chordNotes(chord.symbol),
  }))
}

function semitoneDistance(noteA, noteB) {
  const a = Note.chroma(noteA)
  const b = Note.chroma(noteB)

  if (a === null || b === null) return null

  const diff = Math.abs(a - b)
  return Math.min(diff, 12 - diff)
}

export function analyzeGuideToneMotion(chords) {
  const progression = progressionGuideTones(chords)

  return progression.map((current, index) => {
    if (index === progression.length - 1) {
      return { ...current, nextMotion: null }
    }

    const next = progression[index + 1]

    const curChord = getChord(current.symbol)
    const nxtChord = getChord(next.symbol)
    const curNotes = current.notes || curChord.notes || []     // all chord tones
    const nxtNotes = next.notes   || nxtChord.notes || []
    const curIvls  = curChord.intervals || []
    const nxtIvls  = nxtChord.intervals || []

    // Guide-tone role extraction (3rd and 7th)
    const cur7 = curNotes.find((_, i) => curIvls[i] === "7m" || curIvls[i] === "7M")
    const cur3 = curNotes.find((_, i) => curIvls[i] === "3M" || curIvls[i] === "3m")
    const nxt3 = nxtNotes.find((_, i) => nxtIvls[i] === "3M" || nxtIvls[i] === "3m")
    const nxt7 = nxtNotes.find((_, i) => nxtIvls[i] === "7m" || nxtIvls[i] === "7M")

    // Guide-tone-only motions (kept for backward-compat smooth/all arrays)
    const motions = []
    ;(current.guideTones || []).forEach((fromNote) => {
      ;(next.guideTones || []).forEach((toNote) => {
        const distance = semitoneDistance(fromNote, toNote)
        motions.push({ from: fromNote, to: toNote, distance, smooth: distance !== null && distance <= 2 })
      })
    })

    const smoothMotions = motions.filter((m) => m.smooth).sort((a, b) => a.distance - b.distance)

    // ── Rule 1: Perfect 4th/5th root movement → force 7→3 gravity ────────────
    const p4p5 = isP4orP5Movement(current.symbol, next.symbol)
    if (p4p5 && cur7 && nxt3) {
      const dist = semitoneDistance(cur7, nxt3)
      return {
        ...current,
        nextMotion: {
          nextChord: next.symbol,
          all: motions,
          smooth: smoothMotions,
          best: { from: cur7, to: nxt3, distance: dist, smooth: dist !== null && dist <= 2, rule: "p4p5-gravity" },
          p4p5: true,
        },
      }
    }

    // ── Rule 2: Other intervals → compare ALL chord tones, guide-tone tie-break ─
    const allMotions = []
    curNotes.forEach((fromNote) => {
      nxtNotes.forEach((toNote) => {
        const distance = semitoneDistance(fromNote, toNote)
        const toIdx = nxtNotes.indexOf(toNote)
        const toIvl = nxtIvls[toIdx] || ""
        const landsOnGT = toIvl === "3M" || toIvl === "3m" || toIvl === "7m" || toIvl === "7M"
        allMotions.push({ from: fromNote, to: toNote, distance, landsOnGT,
          smooth: distance !== null && distance <= 2 })
      })
    })
    allMotions.sort((a, b) => {
      const da = a.distance ?? 99, db = b.distance ?? 99
      if (da !== db) return da - db
      return (b.landsOnGT ? 1 : 0) - (a.landsOnGT ? 1 : 0)  // prefer landing on guide tone
    })

    return {
      ...current,
      nextMotion: {
        nextChord: next.symbol,
        all: motions,
        smooth: smoothMotions,
        best: allMotions[0] || null,
        p4p5: false,
      },
    }
  })
}

export function melodicTargets(chords) {
  return analyzeGuideToneMotion(chords).map((bar, index) => {
    const best = bar.nextMotion?.best || null

    return {
      barIndex: index,
      chord: bar.symbol,
      currentGuideTones: bar.guideTones,
      targetNote: best ? best.to : null,
      sourceNote: best ? best.from : null,
      distance: best ? best.distance : null,
      nextChord: bar.nextMotion?.nextChord || null,
    }
  })
}

export function generateMelodySkeleton(chords, phraseSeed = 0) {
  const targets = melodicTargets(chords)

  return targets.map((target, index) => {
    const fallbackGuides = target.currentGuideTones || []
    const altIndex = fallbackGuides.length ? (index + phraseSeed) % fallbackGuides.length : 0

    const chosen =
      target.targetNote ||
      fallbackGuides[altIndex] ||
      fallbackGuides[0] ||
      chordNotes(target.chord)[0] ||
      null

    return {
      barIndex: index,
      chord: target.chord,
      note: chosen,
      sourceNote: target.sourceNote || null,
      targetNote: target.targetNote || null,
      nextChord: target.nextChord || null,
      role: target.targetNote ? "target" : "anchor",
    }
  })
}

function aboveHalfStep(note) {
  return Note.simplify(Note.transpose(note, Interval.fromSemitones(1)))
}

function belowHalfStep(note) {
  return Note.simplify(Note.transpose(note, Interval.fromSemitones(-1)))
}

function aboveWholeStep(note) {
  return Note.simplify(Note.transpose(note, Interval.fromSemitones(2)))
}

// Extract root letter (with accidental) from any chord symbol — fallback for non-standard symbols
function extractRoot(symbol) {
  const m = (symbol || "").match(/^([A-G][b#]?)/)
  return m ? m[1] : null
}

// Returns true if the root movement from symbolA to symbolB is a Perfect 4th (5 st) or P5 (7 st).
// P4 up = 5 semitones; P5 up = 7 semitones. In jazz ii-V-I, every step is P4 up (a "falling fifth").
function isP4orP5Movement(symbolA, symbolB) {
  const ta = getChord(symbolA).tonic || extractRoot(symbolA)
  const tb = getChord(symbolB).tonic || extractRoot(symbolB)
  if (!ta || !tb) return false
  const a = Note.chroma(ta)
  const b = Note.chroma(tb)
  if (a == null || b == null) return false
  const asc = (b - a + 12) % 12
  return asc === 5 || asc === 7
}

function belowWholeStep(note) {
  return Note.simplify(Note.transpose(note, Interval.fromSemitones(-2)))
}

export function getRecommendedScalesFromQuality(quality) {
  switch (quality) {
    case "maj7":
    case "maj6":
    case "maj":
    case "maj9":
    case "6/9":
    case "add9":
      return ["major", "lydian"]
    case "maj7#11":
      return ["lydian", "major"]
    case "min7":
    case "min6":
    case "min":
    case "min9":
    case "min6/9":
    case "minadd9":
      return ["dorian", "aeolian", "melodic minor"]
    case "min(maj7)":
      return ["melodic minor", "harmonic minor"]
    case "min7b5":
      return ["locrian", "locrian #2"]
    case "dim7":
      return ["diminished"]
    case "7alt":
    case "7b9":
      return ["altered", "whole tone", "lydian dominant"]
    case "sus4":
    case "7sus4":
      return ["mixolydian", "dorian"]
    case "7":
    case "9":
    default:
      return ["mixolydian", "lydian dominant", "altered"]
  }
}

export function suggestSubstitution(bar) {
  const { root, quality } = bar

  if (quality === "7") {
    const tritone = Note.simplify(Note.transpose(root, Interval.fromSemitones(6)))
    return {
      root: tritone,
      quality: "7",
      symbol: buildChordSymbol(tritone, "7"),
      label: "Tritone sub",
    }
  }

  if (quality === "min7") {
    return {
      root,
      quality: "min6",
      symbol: buildChordSymbol(root, "min6"),
      label: "Minor 6 color",
    }
  }

  if (quality === "maj7") {
    return {
      root,
      quality: "maj6",
      symbol: buildChordSymbol(root, "maj6"),
      label: "Major 6 color",
    }
  }

  return null
}

export function noteToFrequency(note, octave = 4) {
  const midi = Note.midi(`${note}${octave}`)
  if (midi == null) return null
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// Two-note-per-bar voice leading chain:
//   Note 1 = arrival  — the 3rd or 7th we LAND on (from previous bar's 7→3 resolution)
//   Note 2 = departure — the OTHER guide tone (7th if we arrived on 3rd, etc.) which then
//            steps smoothly (≤2 st) into the next bar's arrival; chromatic below as fallback
//
// Chain: bar0:[3rd, 7th→] | bar1:[3rd, 7th→] | bar2:[3rd, 7th→] …
export function generateApproachLines(chords) {
  const targets = melodicTargets(chords)

  // Melodic contour tracking — prevent >3 consecutive downward arrivals (Rule 3)
  let consecutiveDown = 0
  let prevArrivalNote  = null

  return targets.map((current, index) => {
    // Pre-compute chord tones and 3rd — reused for arrival, contour reset, and correction
    const chordData  = getChord(chords[index].symbol)
    const chordTones = chordData.notes || []
    const chordIvls  = chordData.intervals || []
    const chordThird = chordTones.find((_, i) => chordIvls[i] === "3M" || chordIvls[i] === "3m")

    // ── Note 1: arrival ─────────────────────────────────────────────────────
    // Always prefer the 3rd as starting / arriving note so that the OTHER guide
    // tone (7th, stored as sourceNote) is available as a distinct departure note.
    let arrivalNote
    if (index === 0) {
      arrivalNote = chordThird || current.sourceNote || chordTones[0] || null
    } else {
      arrivalNote = targets[index - 1].targetNote
        || current.currentGuideTones?.[0]
        || null
    }

    // ── Rule 3: Melodic Contour Filter ─────────────────────────────────────
    // If melody has moved DOWN for 3+ consecutive bars, jump up to nearest chord tone
    // in the P4-M6 range (4–9 semitones above) to "breathe" like a human player.
    if (index > 0 && prevArrivalNote && arrivalNote) {
      const prevC = Note.chroma(prevArrivalNote)
      const curC  = Note.chroma(arrivalNote)
      if (prevC !== null && curC !== null) {
        const movedDown = (curC - prevC + 12) % 12 > 6
        if (movedDown) {
          consecutiveDown++
          if (consecutiveDown >= 3) {
            let resetNote = null, bestUp = Infinity
            for (const tone of chordTones) {
              const tc = Note.chroma(tone)
              if (tc == null) continue
              const up = (tc - prevC + 12) % 12
              if (up >= 4 && up <= 9 && up < bestUp) { resetNote = tone; bestUp = up }
            }
            if (resetNote) { arrivalNote = resetNote; consecutiveDown = 0 }
          }
        } else {
          consecutiveDown = 0
        }
      }
    }

    // ── Guide-tone arrival correction ────────────────────────────────────────
    // If the arrival note is the same as sourceNote (the note we'll depart on),
    // the bar would show no motion: phrase = [X, X].  Swap to the 3rd so each bar
    // always demonstrates both guide tones — arrival (3rd) then departure (7th).
    if (current.sourceNote && arrivalNote === current.sourceNote
        && chordThird && chordThird !== current.sourceNote) {
      arrivalNote = chordThird
    }

    prevArrivalNote = arrivalNote

    // ── Note 2: departure ───────────────────────────────────────────────────
    // Priority 1: sourceNote (7th) resolves by ≤2 semitones to targetNote (3rd) → pure 7→3 step
    // Priority 2: no clean step resolution → chromatic half-step from below
    // Priority 3: last bar or no target → hold a guide tone
    let departureNote = null
    let approachType  = "anchor"

    const nextSymbol = index < chords.length - 1 ? chords[index + 1]?.symbol : null

    if (nextSymbol && current.sourceNote && current.targetNote) {
      const stepDist = semitoneDistance(current.sourceNote, current.targetNote)
      if (stepDist !== null && stepDist <= 2) {
        // Clean 7→3 (or guide-tone → guide-tone) step resolution — use the source note itself
        departureNote = current.sourceNote
        approachType  = "guide-tone-step"
      } else {
        // No smooth step — approach the next target from a half-step below
        departureNote = belowHalfStep(current.targetNote)
        approachType  = "chromatic-below"
      }
    } else if (nextSymbol && current.targetNote) {
      // Have a target but no clear source note — approach from below
      departureNote = belowHalfStep(current.targetNote)
      approachType  = "chromatic-below"
    } else {
      // Last bar or no next chord — rest on a guide tone
      departureNote = current.currentGuideTones?.[1]
        || current.currentGuideTones?.[0]
        || arrivalNote
      approachType  = "anchor"
    }

    const phrase = [arrivalNote, departureNote].filter(n => n && Note.chroma(n) != null)

    return {
      barIndex: index,
      chord: current.chord,
      phrase,
      arrivalNote:   arrivalNote   || null,
      departureNote: departureNote || null,
      target:        current.targetNote || null,
      approach:      departureNote || null,
      approachType,
      nextChord:     current.nextChord || null,
    }
  })
}

export function generateContinuousPhrase(chords) {
  return generateApproachLines(chords).flatMap((item) => item.phrase || [])
}

const RHYTHM_BANKS = [
  ["1 + 3", "&2 → 4", "2 + &4", "4& → 1"],
  ["1e+a", "2 + 4", "&1 → 3", "4& pickup"],
  ["1 + 2&", "3 + 4", "&2 + &4", "syncopated"],
  ["downbeat", "anticipation", "push", "release"],
]

export function assignRhythmToBars(chords, rhythmSeed = 0) {
  const bank = RHYTHM_BANKS[rhythmSeed % RHYTHM_BANKS.length]

  return chords.map((chord, index) => ({
    barIndex: index,
    chord: chord.symbol,
    rhythm: bank[index % bank.length],
  }))
}

export function transposeChart(bars, fromRoot, toRoot) {
  const fromChroma = Note.chroma(fromRoot)
  const toChroma   = Note.chroma(toRoot)
  if (fromChroma == null || toChroma == null) return bars

  const semitones = ((toChroma - fromChroma) + 12) % 12
  if (semitones === 0) return bars

  return bars.map((bar) => {
    if (bar.quality === "NC") return bar   // N.C. rest — nothing to transpose
    const rootChroma = Note.chroma(bar.root)
    if (rootChroma == null) return bar
    const newRoot = JAZZ_SPELLING[(rootChroma + semitones) % 12]
    // Carry a slash bass (tonic pedals etc.) through the transposition.
    let newBass = bar.bass
    if (bar.bass != null) {
      const bassChroma = Note.chroma(bar.bass)
      if (bassChroma != null) newBass = JAZZ_SPELLING[(bassChroma + semitones) % 12]
    }
    let symbol = buildChordSymbol(newRoot, bar.quality)
    if (newBass != null) symbol += `/${newBass}`
    return { ...bar, root: newRoot, bass: newBass, symbol }
  })
}

// ─── Scale filter utilities (pentatonic / hexatonic / bebop) ──────────────────

const CHROMATIC_NOTES = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"]

function noteAtSemitones(root, semitones) {
  const chroma = Note.chroma(root)
  if (chroma == null) return null
  return CHROMATIC_NOTES[((chroma + semitones) % 12 + 12) % 12]
}

function buildFromSemitones(root, list) {
  return list.map(s => noteAtSemitones(root, s)).filter(Boolean)
}

/**
 * Pat Martino's minor conversion: maps any chord type to the minor hexatonic
 * root and quality that represents it on the fretboard.
 *
 *   m7 / m6          → same root,          displayQuality: "min7"   (Dorian no-6)
 *   maj7 / maj6      → relative minor +9st, displayQuality: "min7"   (e.g. C → A)
 *   7 / 7alt / dom   → 5th +7st,            displayQuality: "min7"   (e.g. G → D)
 *   m7b5 / dim7      → same root,           displayQuality: "min7b5" (melodic hex)
 *
 * Only affects the fretboard scale display — guide tones, audio, and notation
 * all continue to use the original chord data.
 */
export function martinoMapper(root, quality) {
  const q = quality || ""
  const isMaj = q === "maj7" || q === "maj6" || q === "maj" || q === "maj9" ||
                q === "maj7#11" || q === "6/9" || q === "add9"
  if (isMaj)
    return { displayRoot: noteAtSemitones(root, 9), displayQuality: "min7" }
  if (q === "min7b5" || q === "dim7")
    return { displayRoot: root, displayQuality: "min7b5" }
  if (q.startsWith("min") || q === "m7" || q === "m6" || q === "m9")
    return { displayRoot: root, displayQuality: "min7" }
  if ((q.includes("7") || q.includes("9") || q.includes("13")) && !q.startsWith("maj"))
    return { displayRoot: noteAtSemitones(root, 7), displayQuality: "min7" }
  return { displayRoot: root, displayQuality: "min7" }
}

/**
 * Apply a scale filter to the given notes for fretboard display.
 *
 * "pentatonic" — replaces notes with a 5-note pentatonic based on quality:
 *   major types (maj7, maj6, 7) → major pentatonic  1 2 3 5 6
 *   all other types             → minor pentatonic  1 b3 4 5 b7
 *
 * "hexatonic" — Randy Vincent's three hexatonic families (correct root remapping):
 *   maj7 / maj6   → majorHex      1 2 3 5 6 7   from root
 *   min7 / m7     → minorHex      1 2 b3 4 5 b7 from root
 *   7 / dom       → melodicMinHex 1 2 b3 5 6 7  from root+1 (e.g. G7 → Ab hex)
 *   min7b5 / dim7 → melodicMinHex 1 2 b3 5 6 7  from root+3 (e.g. Dm7b5 → F hex)
 *
 * "bebop" — adds one chromatic passing tone to the existing scale:
 *   dominant (7, 7alt)             → add M7 (between b7 and root)
 *   major (maj7, maj6)             → add #5 (between P5 and M6)
 *   minor (min7, min6, m7b5, dim7) → add M7 (between b7 and root)
 *
 * @param {string[]} notes   - current scale notes (used only by bebop)
 * @param {string}   root    - tonic root
 * @param {string}   quality - chord quality
 * @param {string|null} filter
 * @returns {string[]}
 */
export function applyScaleFilter(notes, root, quality, filter) {
  if (!filter) return notes

  switch (filter) {
    case "pentatonic":
      if (["maj7","maj6","7"].includes(quality))
        return buildFromSemitones(root, [0,2,4,7,9])    // major pentatonic: 1 2 3 5 6
      return buildFromSemitones(root, [0,3,5,7,10])      // minor pentatonic: 1 b3 4 5 b7

    case "hexatonic": {
      const q = quality || ""
      // Half-dim / dim: melodicMinorHex from the minor 3rd above root
      // e.g. Dm7b5 (root=D) → F melodicMinorHex: F G Ab C D E
      if (q === "min7b5" || q === "dim7")
        return buildFromSemitones(noteAtSemitones(root, 3), [0,2,3,7,9,11])
      // Minor: minorHex from root (Dorian minus 6): 1 2 b3 4 5 b7
      // e.g. Dm7 → D E F G A C
      if (q.startsWith("min") || q === "m7" || q === "m6" || q === "m9")
        return buildFromSemitones(root, [0,2,3,5,7,10])
      // Dominant: melodicMinorHex from half step above root (altered family)
      // e.g. G7 → Ab melodicMinorHex: Ab Bb B Eb F G
      if ((q.includes("7") || q.includes("9") || q.includes("13")) && !q.startsWith("maj"))
        return buildFromSemitones(noteAtSemitones(root, 1), [0,2,3,7,9,11])
      // Major: majorHex from root: 1 2 3 5 6 7
      // e.g. Cmaj7 → C D E G A B
      return buildFromSemitones(root, [0,2,4,7,9,11])
    }

    case "martino": {
      // Delegate root/quality remapping to martinoMapper, then apply the
      // appropriate hexatonic formula from the display root.
      const { displayRoot, displayQuality } = martinoMapper(root, quality)
      if (displayQuality === "min7b5")
        return buildFromSemitones(displayRoot, [0,2,3,7,9,11])  // melodic hex: 1 2 b3 5 6 M7
      return buildFromSemitones(displayRoot, [0,2,3,5,7,10])    // standard hex: 1 2 b3 4 5 b7
    }

    case "barry":
      // Barry Harris 6th-diminished — 8-note scale from the chord root
      return barryHarrisScale(root, quality).notes

    case "hexchord":
      // Chord-aware hexatonic (Bebop Blueprint Hex mode) — built from the root
      return hexChoiceForChord(root, quality).notes

    case "bebop": {
      if (!notes.length) return notes
      const rootChroma = Note.chroma(root)
      if (rootChroma == null) return notes
      const chromas = new Set(notes.map(n => Note.chroma(n)))
      let passing = null
      if (["7","7alt"].includes(quality))                         passing = 11  // M7
      else if (["maj7","maj6"].includes(quality))                 passing = 8   // #5
      else if (["min7","min6","min7b5","dim7"].includes(quality)) passing = 11  // M7
      if (passing != null) {
        const pChroma = (rootChroma + passing) % 12
        if (!chromas.has(pChroma)) return [...notes, CHROMATIC_NOTES[pChroma]]
      }
      return notes
    }

    default:
      return notes
  }
}

// ─── Barry Harris 6th-diminished scales — ported from Bebop Blueprint ────────
// 8-note "sixth diminished" families keyed to the chord quality:
//   major:    major scale + #5 passing tone       1 2 3 4 5 #5 6 7
//   minor:    melodic minor + b7 passing tone     1 2 b3 4 5 6 b7 7
//   dominant: mixolydian + maj7 passing tone      1 2 3 4 5 6 b7 7
function barryFamily(quality) {
  const q = String(quality || "").toLowerCase()
  if (q.startsWith("min") || (q.startsWith("m") && !q.startsWith("maj"))) return "minor"
  if (q.includes("7") || q.includes("9") || q.includes("13") || q.includes("alt")) {
    if (q.startsWith("maj")) return "major"
    return "dominant"
  }
  return "major"
}

const BARRY_OFFSETS = {
  minor:    { scale: [0, 2, 3, 5, 7, 9, 10, 11], passing: 10 },  // b7
  dominant: { scale: [0, 2, 4, 5, 7, 9, 10, 11], passing: 11 },  // maj7
  major:    { scale: [0, 2, 4, 5, 7, 8, 9, 11],  passing: 8  },  // #5
}

/**
 * Barry Harris 6th-diminished scale for a chord.
 * @returns {{ notes: string[], passingNote: string|null, family: string }}
 */
export function barryHarrisScale(root, quality) {
  const family = barryFamily(quality)
  const { scale, passing } = BARRY_OFFSETS[family]
  return {
    notes: buildFromSemitones(root, scale),
    passingNote: noteAtSemitones(root, passing),
    family,
  }
}

// ─── Chord-aware hexatonic choice — ported from Bebop Blueprint Hex mode ─────
// Unlike the Randy Vincent "hexatonic" filter (which remaps roots), this picks
// a six-note scale built FROM the chord root, tuned to the chord's function.
const HEX_INTERVALS = {
  major:     [0, 2, 4, 7, 9, 11],   // Major minus 4
  dominant:  [0, 2, 4, 7, 9, 10],   // Mixolydian minus 4
  minor7:    [0, 2, 3, 5, 7, 10],   // Dorian minus 6
  halfDim:   [0, 3, 5, 6, 8, 10],   // Locrian minus b2
  wholeTone: [0, 2, 4, 6, 8, 10],
  altered:   [0, 1, 4, 6, 9, 10],   // Curated altered tensions
}

export function hexChoiceForChord(root, quality) {
  const q = String(quality || "").toLowerCase()
  const isDom = (q.includes("7") || q.includes("9") || q.includes("13") || q.includes("alt"))
             && !q.startsWith("maj") && !q.startsWith("min") && !q.startsWith("m")
  if (q.includes("m7b5") || q.includes("min7b5"))
    return { label: "Locrian Hex (no b2)", notes: buildFromSemitones(root, HEX_INTERVALS.halfDim) }
  if (isDom && (q.includes("alt") || q.includes("b9") || q.includes("#9") || q.includes("#11") || q.includes("b13")))
    return { label: "Altered Hex", notes: buildFromSemitones(root, HEX_INTERVALS.altered) }
  if (isDom && (q.includes("aug") || q.includes("+") || q.includes("#5")))
    return { label: "Whole Tone Hex", notes: buildFromSemitones(root, HEX_INTERVALS.wholeTone) }
  if (isDom)
    return { label: "Mixolydian Hex (no 4)", notes: buildFromSemitones(root, HEX_INTERVALS.dominant) }
  if (q.startsWith("min") || (q.startsWith("m") && !q.startsWith("maj")))
    return { label: "Dorian Hex (no 6)", notes: buildFromSemitones(root, HEX_INTERVALS.minor7) }
  return { label: "Major Hex (no 4)", notes: buildFromSemitones(root, HEX_INTERVALS.major) }
}

/**
 * Chromatic passing tones to layer on top of a hexatonic scale (bebop overlay).
 *
 * minorHex + bebop → add M7 (between b7 and root) and b9 (between root and M2)
 *   e.g. D minorHex → add C# and Eb
 *
 * majorHex + bebop → add the relative minor's two chromatic passing tones
 *   = b6 (relative minor's M7) and b7 (relative minor's b9)
 *   e.g. C majorHex (rel. minor = A) → add Ab and Bb
 *
 * melodicMinorHex chords (dom7, min7b5): no additions defined, returns [].
 */
export function getHexatonicBebopNotes(root, quality) {
  const q = quality || ""
  const rChroma = Note.chroma(root)
  if (rChroma == null) return []

  // minorHex: add M7 (root+11) and b9 (root+1)
  if (q.startsWith("min") || q === "m7" || q === "m6" || q === "m9")
    return [
      CHROMATIC_NOTES[(rChroma + 11) % 12],  // M7
      CHROMATIC_NOTES[(rChroma +  1) % 12],  // b9
    ]

  // majorHex: add b6 (root+8) and b7 (root+10) — relative minor's chromatic tones
  if (q === "maj7" || q === "maj6")
    return [
      CHROMATIC_NOTES[(rChroma +  8) % 12],  // b6 (rel. minor's M7)
      CHROMATIC_NOTES[(rChroma + 10) % 12],  // b7 (rel. minor's b9)
    ]

  return []
}

/**
 * Resolve scale notes for FretFlow boards.
 * Handles three namespaces:
 *   "hex:minor"   → minorHex      [0,2,3,5,7,10]  from root
 *   "hex:major"   → majorHex      [0,2,4,7,9,11]  from root
 *   "hex:melodic" → melodicMinHex [0,2,3,7,9,11]  from root
 *   "chord:<sfx>" → chord arpeggio notes via Tonal chord lookup
 *   anything else → Tonal.js Scale.get fallback
 *
 * Bypasses Tonal.js's built-in "minor hexatonic" (which uses M7 not b7).
 */
export function fretFlowScaleNotes(scaleValue, root) {
  if (scaleValue === "hex:minor")   return buildFromSemitones(root, [0,2,3,5,7,10])
  if (scaleValue === "hex:major")   return buildFromSemitones(root, [0,2,4,7,9,11])
  if (scaleValue === "hex:melodic") return buildFromSemitones(root, [0,2,3,7,9,11])
  if (scaleValue.startsWith("chord:")) {
    const suffix = scaleValue.slice(6)   // e.g. "maj7", "m7", "7", "m7b5", "dim7", "6", "m6"
    return Chord.get(`${root}${suffix}`).notes || []
  }
  // Explicit semitone lists ("ints:0,1,4,…") for scales Tonal.js doesn't name
  // the same way — used for the Bebop Blueprint exotic-scale dictionary.
  if (scaleValue.startsWith("ints:")) {
    const semis = scaleValue.slice(5).split(",").map(Number).filter(Number.isFinite)
    return buildFromSemitones(root, semis)
  }
  return Scale.get(`${root} ${scaleValue}`).notes || []
}

export function phraseToNotationData(approachLines) {
  return approachLines.map((item, index) => {
    const phrase = item.phrase || []

    if (phrase.length === 3) {
      return {
        barIndex: index,
        notes: [
          { note: phrase[0], dur: "8" },
          { note: phrase[1], dur: "8" },
          { note: phrase[2], dur: "q" },
        ],
      }
    }

    if (phrase.length === 2) {
      return {
        barIndex: index,
        notes: [
          { note: phrase[0], dur: "8" },
          { note: phrase[1], dur: "8" },
          { note: phrase[1], dur: "q" },
        ],
      }
    }

    if (phrase.length === 1) {
      return {
        barIndex: index,
        notes: [{ note: phrase[0], dur: "q" }],
      }
    }

    return { barIndex: index, notes: [] }
  })
}
