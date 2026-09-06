// Triad pairs, hexatonics and pentatonics — the tables Chapters 4 and 5 read.
//
// One table serves two devices on purpose. Vincent's whole argument is that a
// hexatonic IS a triad pair, heard differently: Chapter 1.4 alternates the two
// triads so the ear files them as two objects, and Chapter 4.1 fuses the same
// two into one six-note scale. If those came from separate tables they could
// drift apart, and the curriculum's claim that one becomes the other would
// stop being true of the app.
//
// tonal.js already has hexChoiceForChord(), but that's a different idea — a
// chord-scale with omissions — and other parts of DukeBox depend on it. It is
// deliberately left alone.

import { Note } from "@tonaljs/tonal"
import { scaleNotes } from "@/lib/music/tonal"
import { toPcs } from "./chartTimeline"

const TRIAD = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  augmented: [0, 4, 8],
  diminished: [0, 3, 6],
}

// Two triads per chord quality, as [semitones above the chord root, quality].
// Every pair here is DISJOINT — six distinct notes — which is what makes the
// fused scale a hexatonic rather than a five-note near-miss. The tests hold
// them to that.
const TRIAD_PAIRS = {
  maj7: [[0, "major"], [2, "major"]],          // C + D  → lydian colour
  maj6: [[0, "major"], [2, "major"]],
  maj: [[0, "major"], [2, "major"]],
  min7: [[10, "major"], [0, "minor"]],         // Bb + Cm → dorian
  min6: [[10, "major"], [0, "minor"]],
  min: [[10, "major"], [0, "minor"]],
  7: [[10, "major"], [0, "major"]],            // Bb + C  → mixolydian
  9: [[10, "major"], [0, "major"]],
  13: [[10, "major"], [0, "major"]],
  "7alt": [[1, "major"], [3, "major"]],        // Db + Eb → altered colour
  "7b9": [[1, "major"], [3, "major"]],
  // Locrian without the b2 — the same six notes DukeBox's own
  // hexChoiceForChord calls "Locrian Hex (no b2)", arrived at from the pair.
  min7b5: [[3, "minor"], [5, "minor"]],        // Ebm + Fm
  // Diminished reads as its half-diminished relative, which is the same lens
  // Martino Mode already applies elsewhere in the app.
  dim7: [[3, "minor"], [5, "minor"]],
}

const DEFAULT_PAIR = [[10, "major"], [0, "major"]]

// The pentatonic that gives each quality its colour, as [degree, type].
// Ligon's instruction is "off the 9th / 13th / #11 as appropriate" — so these
// lean colourful rather than landing on the root and sounding like the chord.
const PENTATONICS = {
  maj7: [2, "major pentatonic"],      // D over C → 9, #11, 13
  maj6: [2, "major pentatonic"],
  maj: [2, "major pentatonic"],
  min7: [0, "minor pentatonic"],
  min6: [0, "minor pentatonic"],
  min: [0, "minor pentatonic"],
  7: [10, "major pentatonic"],        // Bb over C7 → b7, 9, 11
  9: [10, "major pentatonic"],
  13: [10, "major pentatonic"],
  "7alt": [1, "minor pentatonic"],    // Db over C7 → b9, #9, b5, b13
  "7b9": [1, "minor pentatonic"],
  min7b5: [3, "minor pentatonic"],    // Eb over Cm7b5 → b3, b5, b7, b9
  dim7: [3, "minor pentatonic"],
}

const DEFAULT_PENTATONIC = [0, "minor pentatonic"]

const noteAt = (rootPc, semis) => ((rootPc + semis) % 12 + 12) % 12
const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

// The two triads over a chord, as pitch-class sets plus readable names.
// `shift` transposes the whole pair (a borrowed hexatonic, Chapter 8.3);
// `spread` overrides how far apart the two triads sit (Bergonzi's tritone
// extension, Chapter 4.3).
export function triadPairFor(seg, { shift = 0, spread = null } = {}) {
  const [first, second] = TRIAD_PAIRS[seg.quality] || DEFAULT_PAIR
  const rootPc = noteAt(seg.rootPc, shift)
  const aRoot = noteAt(rootPc, first[0])
  const bRoot = spread == null ? noteAt(rootPc, second[0]) : noteAt(aRoot, spread)
  const bQuality = spread == null ? second[1] : first[1]
  return {
    a: { pcs: TRIAD[first[1]].map((i) => noteAt(aRoot, i)), name: `${NOTE_NAMES[aRoot]} ${first[1]}` },
    b: { pcs: TRIAD[bQuality].map((i) => noteAt(bRoot, i)), name: `${NOTE_NAMES[bRoot]} ${bQuality}` },
  }
}

// The pair fused into one scale — the same six notes, read as a line.
export function hexatonicFor(seg, opts) {
  const { a, b } = triadPairFor(seg, opts)
  const pcs = []
  for (const pc of [...a.pcs, ...b.pcs]) if (!pcs.includes(pc)) pcs.push(pc)
  return { pcs: pcs.sort((x, y) => x - y), a, b }
}

export function pentatonicFor(seg, { degree = null, type = null } = {}) {
  const [defDegree, defType] = PENTATONICS[seg.quality] || DEFAULT_PENTATONIC
  const rootPc = noteAt(seg.rootPc, degree ?? defDegree)
  const root = NOTE_NAMES[rootPc]
  const name = type ?? defType
  const pcs = toPcs(scaleNotes(name, root))
  return pcs.length >= 5 ? { pcs, name: `${root} ${name}` } : null
}

export function bluesFor(seg) {
  const root = NOTE_NAMES[((seg.rootPc % 12) + 12) % 12]
  const pcs = toPcs(scaleNotes("minor blues", root))
  return pcs.length >= 5 ? { pcs, name: `${root} blues` } : null
}

export const TRIAD_PAIR_TABLE = TRIAD_PAIRS
export const PENTATONIC_TABLE = PENTATONICS
export { Note }
