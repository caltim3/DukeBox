import { Chord, Note } from "@tonaljs/tonal"

// ─── Pianist comping styles ───────────────────────────────────────────────────
// Each hit: { t: fraction-of-bar (0=beat1, 0.25=beat2), vel: velocity 0-1, len: length fraction }
// Source: adapted from Bebop Blueprint hit plans

export const COMPING_STYLES = {
  "Wynton Kelly":   [
    { t: 0.0,   vel: 1.0,  len: 1.0  },
    { t: 0.5,   vel: 0.85, len: 0.55 },
    { t: 0.75,  vel: 0.6,  len: 0.35 },
  ],
  "Red Garland":    [
    { t: 0.0,   vel: 1.0,  len: 1.0  },
    { t: 0.5,   vel: 0.9,  len: 0.5  },
  ],
  "Tommy Flanagan": [
    { t: 0.0,   vel: 0.95, len: 1.0  },
    { t: 0.5,   vel: 0.75, len: 0.5  },
    { t: 0.875, vel: 0.55, len: 0.25 },
  ],
  "Herbie Hancock": [
    { t: 0.0,   vel: 0.9,  len: 0.9  },
    { t: 0.375, vel: 0.7,  len: 0.35 },
    { t: 0.75,  vel: 0.65, len: 0.35 },
  ],
  "Bill Evans":     [
    { t: 0.0,   vel: 0.75, len: 0.8  },
    { t: 0.375, vel: 0.6,  len: 0.35 },
    { t: 0.625, vel: 0.55, len: 0.35 },
  ],
  "McCoy Tyner":    [
    { t: 0.0,   vel: 1.0,  len: 0.9  },
    { t: 0.5,   vel: 0.95, len: 0.6  },
  ],
  "Thelonious Monk": [
    { t: 0.0,   vel: 0.95, len: 0.55 },
    { t: 0.375, vel: 0.8,  len: 0.25 },
  ],
  "Oscar Peterson": [
    { t: 0.0,   vel: 1.0,  len: 0.9  },
    { t: 0.25,  vel: 0.7,  len: 0.25 },
    { t: 0.5,   vel: 0.85, len: 0.35 },
    { t: 0.75,  vel: 0.6,  len: 0.25 },
  ],
  "Ahmad Jamal":    [
    { t: 0.0,   vel: 0.9,  len: 0.85 },
    { t: 0.75,  vel: 0.55, len: 0.25 },
  ],
  "Brad Mehldau":   [
    { t: 0.0,   vel: 0.85, len: 0.85 },
    { t: 0.375, vel: 0.65, len: 0.30 },
    { t: 0.875, vel: 0.55, len: 0.22 },
  ],
  "Art Tatum":      [
    { t: 0.0,   vel: 1.0,  len: 0.9  },
    { t: 0.25,  vel: 0.8,  len: 0.25 },
    { t: 0.5,   vel: 0.9,  len: 0.25 },
    { t: 0.75,  vel: 0.75, len: 0.25 },
  ],
  "Keith Jarrett":  [
    { t: 0.0,   vel: 0.9,  len: 0.85 },
    { t: 0.375, vel: 0.7,  len: 0.3  },
    { t: 0.625, vel: 0.65, len: 0.25 },
  ],
}

export const COMPING_STYLE_NAMES = Object.keys(COMPING_STYLES)

export const DEFAULT_COMPING_STYLE = "Wynton Kelly"

// ─── Voice-led voicing ────────────────────────────────────────────────────────

function generateInversions(notes) {
  const voicings = [[...notes]]
  for (let i = 1; i < notes.length; i++) {
    voicings.push([...notes.slice(i), ...notes.slice(0, i)])
  }
  return voicings
}

function generateDrop2(notes) {
  if (notes.length !== 4) return null
  // Drop the second-from-top note down an octave — classic jazz piano voicing
  return [notes[0], notes[2], notes[3], notes[1]]
}

function midiOf(noteWithOctave) {
  const midi = Note.midi(noteWithOctave)
  return midi ?? 0
}

function buildRealized(pcVoicing, startOctave) {
  // Assign ascending octaves so each note is strictly above the previous
  const sorted = [...pcVoicing].sort(
    (a, b) => (Note.chroma(a) ?? 0) - (Note.chroma(b) ?? 0)
  )
  const result = []
  let oct = startOctave
  let prevMidi = -1
  for (const name of sorted) {
    const chroma = Note.chroma(name)
    if (chroma == null) continue
    let noteMidi = Note.midi(`${name}${oct}`) ?? 0
    while (noteMidi <= prevMidi) {
      oct++
      noteMidi = Note.midi(`${name}${oct}`) ?? 0
    }
    // Don't jump more than an octave if we can avoid it
    if (result.length > 0 && noteMidi > prevMidi + 12) {
      const tryDown = Note.midi(`${name}${oct - 1}`) ?? 0
      if (tryDown > prevMidi) { oct--; noteMidi = tryDown }
    }
    result.push(`${name}${oct}`)
    prevMidi = noteMidi
  }
  return result
}

/**
 * Choose the best voicing for `symbol` given the previous voicing.
 * Uses inversions + drop-2, scored by voice-leading smoothness.
 *
 * @param {string}   symbol          - Chord symbol, e.g. "Cm7"
 * @param {string[]} prevVoicing     - Previous realized voicing, e.g. ["C4","Eb4","G4","Bb4"]
 * @param {boolean}  rootless        - If true, omit root (used when bass is playing)
 * @returns {string[]}               - Realized voicing with octaves
 */
export function getVoiceLedVoicing(symbol, prevVoicing = null, rootless = false) {
  const chord = Chord.get(symbol)
  let baseNotes = chord.notes ?? []
  if (baseNotes.length === 0) return prevVoicing ?? []

  if (rootless && baseNotes.length > 1) baseNotes = baseNotes.slice(1)

  const candidates = generateInversions(baseNotes)
  const drop2 = generateDrop2(baseNotes)
  if (drop2) candidates.push(drop2)

  const startOctave = 3  // rootless or not, sit in the 3–4 range (jazz comp register)

  const scored = []
  for (const pcVoicing of candidates) {
    for (const oct of [startOctave, startOctave + 1]) {
      const realized = buildRealized(pcVoicing, oct)
      if (realized.length === 0) continue

      const minMidi = midiOf(realized[0])
      const maxMidi = midiOf(realized[realized.length - 1])
      if (maxMidi - minMidi > 36) continue        // voicing too wide
      if (minMidi < 36 || maxMidi > 96) continue  // out of useful range

      let score = 0
      if (prevVoicing && prevVoicing.length === realized.length) {
        const sortedPrev = [...prevVoicing].sort((a, b) => midiOf(a) - midiOf(b))
        const sortedCurr = [...realized].sort((a, b) => midiOf(a) - midiOf(b))
        for (let k = 0; k < sortedCurr.length; k++) {
          const pm = midiOf(sortedPrev[k])
          const cm = midiOf(sortedCurr[k])
          if (pm === cm)          score += 25   // held tone
          else if (pm % 12 === cm % 12) score += 10   // common pitch class
          score -= Math.abs(cm - pm)
        }
      } else {
        score = Math.random() * -5
      }
      scored.push({ realized, score })
    }
  }

  if (scored.length === 0) {
    // Fallback: root position at octave 4
    return baseNotes.map((n, i) => `${n}${startOctave + Math.floor(i / 3)}`)
  }

  scored.sort((a, b) => b.score - a.score)
  // 80% chance best, 20% second-best (adds natural variation)
  const pick = (scored.length > 1 && Math.random() > 0.8) ? scored[1] : scored[0]
  return refineVoicingRegister(pick.realized, prevVoicing, chord.tonic ?? null)
}

// ─── v2.1 register re-ranker — ported from Bebop Blueprint ───────────────────
// Takes the chosen voicing, tries small octave mutations of the top/bottom
// notes, and re-scores for a preferred comping pocket: bottom in E3–C4,
// top in G4–C5. Penalizes semitone crunches, rewards compact 3rd–5th stacks
// and the presence of guide tones, and keeps smoothness vs the previous voicing.

const PREFER_BOTTOM_MIN = 52  // E3
const PREFER_BOTTOM_MAX = 60  // C4
const PREFER_TOP_MIN    = 67  // G4
const PREFER_TOP_MAX    = 72  // C5

function shiftOctave(noteWithOctave, delta) {
  const m = String(noteWithOctave).match(/^([A-G][b#]?)(-?\d+)$/)
  if (!m) return noteWithOctave
  return `${m[1]}${parseInt(m[2], 10) + delta}`
}

function refineVoicingRegister(voicing, prevVoicing, rootName) {
  if (!Array.isArray(voicing) || voicing.length < 2) return voicing

  const mutate = (v, topShift, botShift) =>
    v.map((n, i) => {
      if (i === 0 && botShift) return shiftOctave(n, botShift)
      if (i === v.length - 1 && topShift) return shiftOctave(n, topShift)
      return n
    })

  const candidates = [
    voicing,
    mutate(voicing, +1, 0), mutate(voicing, 0, +1),
    mutate(voicing, -1, 0), mutate(voicing, 0, -1),
  ]

  const rootChroma = rootName != null ? Note.chroma(rootName) : null

  function scoreVoicing(v) {
    const midis = v.map(midiOf).filter(m => m > 0).sort((a, b) => a - b)
    if (midis.length !== v.length) return -1e6
    let score = 0

    const bottom = midis[0], top = midis[midis.length - 1]
    if (bottom < PREFER_BOTTOM_MIN) score -= (PREFER_BOTTOM_MIN - bottom) * 1.5
    if (bottom > PREFER_BOTTOM_MAX) score -= (bottom - PREFER_BOTTOM_MAX) * 1.0
    if (top < PREFER_TOP_MIN)       score -= (PREFER_TOP_MIN - top) * 1.2
    if (top > PREFER_TOP_MAX)       score -= (top - PREFER_TOP_MAX) * 1.2

    // Adjacent intervals: no 1–2 semitone crunch; reward 3–7, avoid huge gaps
    for (let i = 1; i < midis.length; i++) {
      const d = midis[i] - midis[i - 1]
      if (d <= 1) score -= 28
      else if (d === 2) score -= 14
      else if (d >= 3 && d <= 7) score += 7
      else if (d >= 10) score -= (d - 9) * 2.2
    }

    // Encourage presence of guide tones (3rd and 7th; dim7's bb7 counts)
    if (rootChroma != null) {
      const pcs = midis.map(m => m % 12)
      const has3 = pcs.includes((rootChroma + 4) % 12) || pcs.includes((rootChroma + 3) % 12)
      const has7 = pcs.includes((rootChroma + 11) % 12) || pcs.includes((rootChroma + 10) % 12)
                || pcs.includes((rootChroma + 9) % 12)
      if (has3) score += 10
      if (has7) score += 10
    }

    // Smoothness vs previous voicing
    if (Array.isArray(prevVoicing) && prevVoicing.length === v.length) {
      const prev = prevVoicing.map(midiOf).sort((a, b) => a - b)
      let total = 0
      for (let i = 0; i < prev.length; i++) total += Math.abs(prev[i] - midis[i])
      score -= total * 0.5
    }
    return score
  }

  let best = voicing, bestScore = -1e9
  for (const c of candidates) {
    const s = scoreVoicing(c)
    if (s > bestScore) { bestScore = s; best = c }
  }
  return best
}
