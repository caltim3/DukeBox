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
}

export function buildChordSymbol(root, quality) {
  const suffix = QUALITY_TO_SYMBOL[quality] || quality || ""
  return `${root}${suffix}`
}

export function chordNotes(symbol) {
  return Chord.get(symbol).notes || []
}

export function scaleNotes(scaleName, root) {
  return Scale.get(`${root} ${scaleName}`).notes || []
}

export function transpose(note, interval) {
  return Note.transpose(note, interval)
}

export function chordInfo(symbol) {
  const chord = Chord.get(symbol)

  return {
    symbol,
    notes: chord.notes || [],
    intervals: chord.intervals || [],
    quality: chord.quality || "",
    type: chord.type || "",
  }
}

export function guideTones(symbol) {
  const chord = Chord.get(symbol)
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

    const curChord = Chord.get(current.symbol)
    const nxtChord = Chord.get(next.symbol)
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
  const ta = Chord.get(symbolA).tonic || extractRoot(symbolA)
  const tb = Chord.get(symbolB).tonic || extractRoot(symbolB)
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
      return ["major", "lydian"]
    case "min7":
    case "min6":
      return ["dorian", "aeolian", "melodic minor"]
    case "min7b5":
      return ["locrian", "locrian #2"]
    case "dim7":
      return ["diminished"]
    case "7alt":
      return ["altered", "whole tone", "lydian dominant"]
    case "7":
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
    const chordData  = Chord.get(chords[index].symbol)
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
    const rootChroma = Note.chroma(bar.root)
    if (rootChroma == null) return bar
    const newRoot = JAZZ_SPELLING[(rootChroma + semitones) % 12]
    return { ...bar, root: newRoot, symbol: buildChordSymbol(newRoot, bar.quality) }
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
 * Apply a scale filter to the given notes for fretboard display.
 *
 * "pentatonic" — replaces notes with a 5-note pentatonic based on quality:
 *   major types (maj7, maj6, 7) → major pentatonic  1 2 3 5 6
 *   all other types             → minor pentatonic  1 b3 4 5 b7
 *
 * "hexatonic" — Randy Vincent's two hexatonic families:
 *   melodic-minor family (7alt, min7b5, dim7) → 1 2 b3 5 6 7
 *   major family (maj7, m7, dom7 inside, etc.) → 1 2 3 5 6 7
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
      // Half-dim / dim: Locrian #2 without b6 = 1 2 b3 4 b5 b7
      if (q === "min7b5" || q === "dim7")
        return buildFromSemitones(root, [0,2,3,5,6,10])
      // Minor (Dorian): remove 4th = 1 2 b3 4 5 b7
      if (q.startsWith("min") || q === "m7" || q === "m6" || q === "m9")
        return buildFromSemitones(root, [0,2,3,5,7,10])
      // Dominant (Mixolydian): remove 4th = 1 2 3 5 6 b7
      if ((q.includes("7") || q.includes("9") || q.includes("13")) && !q.startsWith("maj"))
        return buildFromSemitones(root, [0,2,4,7,9,10])
      // Major (Ionian): remove 4th = 1 2 3 5 6 7
      return buildFromSemitones(root, [0,2,4,7,9,11])
    }

    case "martino": {
      // Pat Martino's minor conversion — everything becomes a minor hexatonic
      // (Dorian no 6: 1 2 b3 4 5 b7) built from a quality-dependent root.
      // Guide tones and approach notes are unaffected (chord-tone based).
      const q = quality || ""
      // Major (maj7, maj6) → minor hexatonic from relative minor (6th = 9 st up)
      if (q === "maj7" || q === "maj6") {
        const relMinor = noteAtSemitones(root, 9)
        return buildFromSemitones(relMinor, [0,2,3,5,7,10])
      }
      // Half-dim / dim → melodic minor hexatonic from root: 1 2 b3 5 6 M7
      if (q === "min7b5" || q === "dim7")
        return buildFromSemitones(root, [0,2,3,7,9,11])
      // Minor (min7, min6, etc.) → minor hexatonic from root
      if (q.startsWith("min") || q === "m7" || q === "m6" || q === "m9")
        return buildFromSemitones(root, [0,2,3,5,7,10])
      // Dominant (7, 7alt, etc.) → minor hexatonic from 5th (7 st up)
      if ((q.includes("7") || q.includes("9") || q.includes("13")) && !q.startsWith("maj")) {
        const fifth = noteAtSemitones(root, 7)
        return buildFromSemitones(fifth, [0,2,3,5,7,10])
      }
      // Fallback → minor hexatonic from root
      return buildFromSemitones(root, [0,2,3,5,7,10])
    }

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
