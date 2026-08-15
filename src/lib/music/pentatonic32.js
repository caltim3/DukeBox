// ZorroMode — the Pickup Music "3:2 System" as a fretboard overlay.
//
// Major pentatonic laid out three notes on one string, two on the next,
// alternating up the neck. Minor pentatonic is the same physical shape
// borrowed from the relative major (root + 3 semitones), relabelled. Each
// family has exactly two positions; everything else is an octave copy of
// one of them. See the Pickup Music "3:2 System" chart.
//
// ZorroMode shows BOTH positions at once — "two highways" running the
// length of the neck — so unlike Focus Mode's single fret window, there is
// no position picker here. When it's on, it takes the fretboard over
// completely (Fretboard.js draws only these cells); turning it off touches
// nothing else, so whatever Focus Mode / scale view was showing underneath
// is exactly as the player left it.

import { Note } from "@tonaljs/tonal"
import { fretPositions, FRETBOARD_FRETS } from "@/components/Fretboard"

// Chord qualities with no clean 3:2 shape — a half-diminished or altered
// dominant doesn't sit still in a major-or-minor pentatonic box. v1 leaves
// them out rather than drawing a shape that lies against the chord.
// TODO v2: m7b5/dim substitutions.
const NO_SHAPE_QUALITIES = new Set(["min7b5", "dim7", "7alt", "7b9"])

export function pentaFamilyForQuality(quality) {
  const q = String(quality || "")
  if (NO_SHAPE_QUALITIES.has(q)) return null
  if (q.startsWith("min")) return "minor"   // min7, min6, min9, min6/9, minadd9, min(maj7), min triad
  return "major"                             // maj7, maj6, maj9, 6/9, add9, maj (triad), 7, 9, sus4, 7sus4, …
}

// Physical shapes for STANDARD tuning only (non-standard tunings are out of
// scope v1 — the offsets below are the fixed intervals between standard's
// strings, not derived per-tuning). Row order is S6 → S1 (si 0 → 5), which
// is exactly TUNINGS.Standard's low-to-high order in Fretboard.js.
// Each row: which group the string carries, and [degree label, semitone
// offset from r] pairs — r being the fret of the root pitch class on S6.
const MAJOR_POS1 = [
  { group: "A", degs: [["1", 0], ["2", 2], ["3", 4]] },     // S6
  { group: "B", degs: [["5", 2], ["6", 4]] },                // S5
  { group: "A", degs: [["1", 2], ["2", 4], ["3", 6]] },     // S4
  { group: "B", degs: [["5", 4], ["6", 6]] },                // S3
  { group: "A", degs: [["1", 5], ["2", 7], ["3", 9]] },     // S2
  { group: "B", degs: [["5", 7], ["6", 9]] },                // S1
]
const MAJOR_POS2 = [
  { group: "B", degs: [["5", 7], ["6", 9]] },                 // S6
  { group: "A", degs: [["1", 7], ["2", 9], ["3", 11]] },     // S5
  { group: "B", degs: [["5", 9], ["6", 11]] },                // S4
  { group: "A", degs: [["1", 9], ["2", 11], ["3", 13]] },    // S3
  { group: "B", degs: [["5", 12], ["6", 14]] },               // S2
  { group: "A", degs: [["1", 12], ["2", 14], ["3", 16]] },   // S1
]

// Minor pentatonic relabels the relative major's degrees: 1→b3, 2→4, 3→5,
// 5→b7, 6→1 (the minor root — "ring finger on the root" in the chart).
const MINOR_RELABEL = { "1": "b3", "2": "4", "3": "5", "5": "b7", "6": "1" }

// UI calls the shape with b7/root on S6 "Position 1" for minor — that's the
// relative major's Position 2. Mapped once, here, with the reason on record.
function tableForUiPosition(uiPosition, family) {
  const internal = family === "minor" ? (uiPosition === 1 ? 2 : 1) : uiPosition
  return internal === 1 ? MAJOR_POS1 : MAJOR_POS2
}

/**
 * Both 3:2-system highways for the chord currently sounding, tiled across
 * the whole rendered neck (octave copies clipped to the fretboard range).
 *
 * @returns {{ usable: boolean, family: "major"|"minor"|null, cells: Array }}
 *   Each cell: { si, f, group: "A"|"B", uiPosition: 1|2, degreeLabel,
 *   noteName, text, isRingRoot }
 */
export function getZorroHighways({ rootNote, quality, tuningName = "Standard", labelMode = "names", fretCount = FRETBOARD_FRETS }) {
  const family = pentaFamilyForQuality(quality)
  if (!family || tuningName !== "Standard" || !rootNote) {
    return { usable: false, family, cells: [] }
  }

  const rootChroma = Note.chroma(family === "minor" ? Note.transpose(rootNote, "3m") : rootNote)
  if (rootChroma == null) return { usable: false, family, cells: [] }

  const board = fretPositions(tuningName)
  const noteAt = new Map(board.map((p) => [`${p.si}:${p.f}`, p.note]))

  // Fret of the root pitch class on S6 (si 0), lowest octave: 0–11.
  let r = null
  for (let f = 0; f <= 11; f++) {
    if (Note.chroma(noteAt.get(`0:${f}`)) === rootChroma) { r = f; break }
  }
  if (r == null) return { usable: false, family, cells: [] }

  const cells = []
  const seen = new Set()
  ;[1, 2].forEach((uiPosition) => {
    const table = tableForUiPosition(uiPosition, family)
    table.forEach((row, si) => {
      row.degs.forEach(([degLabel, offset]) => {
        const base = r + offset
        ;[-12, 0, 12].forEach((shift) => {
          const f = base + shift
          if (f < 0 || f > fretCount) return
          const key = `${si}:${f}`
          if (seen.has(key)) return
          seen.add(key)
          const degreeLabel = family === "minor" ? MINOR_RELABEL[degLabel] : degLabel
          const noteName = noteAt.get(key)
          cells.push({
            si, f, group: row.group, uiPosition, degreeLabel, noteName,
            text: labelMode === "degrees" ? degreeLabel : (noteName || degreeLabel),
            isRingRoot: family === "minor" && degLabel === "6",
          })
        })
      })
    })
  })

  return { usable: true, family, cells }
}
