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
    const motions = []

    ;(current.guideTones || []).forEach((fromNote) => {
      ;(next.guideTones || []).forEach((toNote) => {
        const distance = semitoneDistance(fromNote, toNote)

        motions.push({
          from: fromNote,
          to: toNote,
          distance,
          smooth: distance !== null && distance <= 2,
        })
      })
    })

    // Identify 3rd and 7th roles for voice-leading priority (7→3 = bebop resolution)
    const curChord = Chord.get(current.symbol)
    const nxtChord = Chord.get(next.symbol)
    const cur7 = (curChord.notes || []).find((_, i) => curChord.intervals[i] === "7m" || curChord.intervals[i] === "7M")
    const cur3 = (curChord.notes || []).find((_, i) => curChord.intervals[i] === "3M" || curChord.intervals[i] === "3m")
    const nxt3 = (nxtChord.notes || []).find((_, i) => nxtChord.intervals[i] === "3M" || nxtChord.intervals[i] === "3m")
    const nxt7 = (nxtChord.notes || []).find((_, i) => nxtChord.intervals[i] === "7m" || nxtChord.intervals[i] === "7M")

    const motionPriority = (m) => {
      if (m.from === cur7 && m.to === nxt3) return 0  // 7→3: traditional bebop resolution
      if (m.from === cur3 && m.to === nxt7) return 1  // 3→7: secondary
      if (m.smooth) return 2
      return 3
    }

    const scored = [...motions].sort((a, b) => {
      const pa = motionPriority(a), pb = motionPriority(b)
      if (pa !== pb) return pa - pb
      return (a.distance ?? 99) - (b.distance ?? 99)
    })

    const smoothMotions = motions
      .filter((m) => m.smooth)
      .sort((a, b) => a.distance - b.distance)

    return {
      ...current,
      nextMotion: {
        nextChord: next.symbol,
        all: motions,
        smooth: smoothMotions,
        best: scored[0] || null,
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
//   Note 1 = arrival  — where we LANDED coming from the previous bar's target
//   Note 2 = departure — chromatic approach note leading INTO the next bar's landing note
//
// Chain: bar0:[arrival, →bar1] | bar1:[bar0target, →bar2] | bar2:[bar1target, →bar3] …
export function generateApproachLines(chords, approachMode = 0) {
  // approachMode: 0 = always below, 1 = always above, 2 = no approach
  const targets = melodicTargets(chords)

  return targets.map((current, index) => {
    // ── Note 1: arrival ─────────────────────────────────────────────────────
    let arrivalNote
    if (index === 0) {
      // First bar: start on the guide tone most connected to bar 1 (sourceNote),
      // fallback to 3rd then root.
      const chord = Chord.get(chords[0].symbol)
      const notes = chord.notes || []
      const ivls  = chord.intervals || []
      const third = notes.find((_, i) => ivls[i] === "3M" || ivls[i] === "3m")
      arrivalNote = current.sourceNote || third || notes[0] || null
    } else {
      // Subsequent bars: land on the target we were heading toward last bar
      arrivalNote = targets[index - 1].targetNote
        || current.currentGuideTones?.[0]
        || null
    }

    // ── Note 2: departure approach ──────────────────────────────────────────
    let departureNote = null
    let approachType  = "anchor"

    if (approachMode !== 2 && current.targetNote) {
      // Chromatic half-step into next bar's landing note; direction set by approachMode
      if (approachMode === 1) {
        departureNote = aboveHalfStep(current.targetNote)
        approachType = "chromatic-above"
      } else {
        departureNote = belowHalfStep(current.targetNote)
        approachType = "chromatic-below"
      }
    } else {
      // Last bar: settle on secondary guide tone
      departureNote = current.currentGuideTones?.[1]
        || current.currentGuideTones?.[0]
        || arrivalNote
    }

    const phrase = [arrivalNote, departureNote].filter(
      n => n && Note.chroma(n) != null
    )

    return {
      barIndex: index,
      chord: current.chord,
      phrase,
      arrivalNote: arrivalNote || null,
      departureNote: departureNote || null,
      target: current.targetNote || null,
      approach: departureNote || null,
      approachType,
      nextChord: current.nextChord || null,
    }
  })
}

export function generateContinuousPhrase(chords, approachMode = 0) {
  return generateApproachLines(chords, approachMode).flatMap((item) => item.phrase || [])
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

    case "hexatonic":
      if (["7alt","min7b5","dim7"].includes(quality))
        return buildFromSemitones(root, [0,2,3,7,9,11])  // melodic minor: 1 2 b3 5 6 7
      return buildFromSemitones(root, [0,2,4,7,9,11])    // major: 1 2 3 5 6 7

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