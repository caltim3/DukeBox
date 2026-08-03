// Triad Network — the vocabulary and tutorial content behind Line Lab's
// network presets (pairs, cells, pivots, enclosures, rest-stroke triplets, the
// 5-level inside/outside system, and Martino Mode).
//
// This was the data half of the standalone TriadNetwork panel. It moved here
// when the two Line Labs merged, so the single lab can offer both sources —
// your loaded chart, or a network preset — off one generator.

export const TN_TONICS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]

export const TN_CHORD_TYPES = {
  maj7:    { label: "maj7",        scale: "lydian",              pairs: ["C+D", "G+D"],          cells: ["1-2-3-5", "5-6-7-9", "3-5-7-9"], color: "9, #11, 13" },
  m7:      { label: "m7 (dorian)", scale: "dorian",              pairs: ["bIII+IV", "Im+IIm"],   cells: ["1-2-b3-5", "b3-5-b7-9"],          color: "9, 11, 13" },
  m_maj7:  { label: "m(maj7)",     scale: "melodic minor",       pairs: ["IV+V", "Im+V+"],       cells: ["1-2-b3-5", "b3-5-7-9"],           color: "maj7 + nat13 over minor" },
  dom7:    { label: "7 (mixo)",    scale: "mixolydian",          pairs: ["bVII+I"],              cells: ["1-2-3-5", "3-5-b7-9"],            color: "9, 13" },
  dom7s11: { label: "7#11",        scale: "lydian dominant",     pairs: ["I+II"],                cells: ["3-5-b7-9", "2-3-#4-6"],           color: "9, #11, 13" },
  alt:     { label: "7alt",        scale: "altered (mel minor)", pairs: ["bV+bVI"],              cells: ["3-#5-b7-b9", "b9-#9-3-b7"],       color: "b9, #9, b5, #5" },
  m7b5:    { label: "m7b5",        scale: "locrian nat2",        pairs: ["bVI+bVII"],            cells: ["1-b3-b5-b7", "b3-b5-b7-9"],       color: "nat 9" },
  dim7:    { label: "dim7",        scale: "whole-half dim",      pairs: ["II+IV"],               cells: ["dim7 arp + chromatic approach"],  color: "dim maj7 colors" },
}

// Very small helper set so presets produce real chord symbols for the route.
const CHROMATIC = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
const ENH = { Db: "C#", "D#": "Eb", Gb: "F#", "G#": "Ab", "A#": "Bb" }
const normRoot = (r) => ENH[r] || r

function transposeRoot(root, semis) {
  const i = CHROMATIC.indexOf(normRoot(root))
  if (i < 0) return root
  return CHROMATIC[(i + semis + 120) % 12]
}

function degrees251(tonic, quality) {
  if (quality === "minor") {
    return [`${transposeRoot(tonic, 2)}m7b5`, `${transposeRoot(tonic, 7)}7alt`, `${tonic}m(maj7)`, `${tonic}m(maj7)`]
  }
  return [`${transposeRoot(tonic, 2)}m7`, `${transposeRoot(tonic, 7)}7`, `${tonic}maj7`, `${tonic}maj7`]
}

function cycleDominants(tonic) {
  // III7 VI7 II7 V7 style descending fourths, tonic as I
  return [`${transposeRoot(tonic, 4)}7`, `${transposeRoot(tonic, 9)}7`, `${transposeRoot(tonic, 2)}7`, `${transposeRoot(tonic, 7)}7`]
}

export const TN_PROGRESSIONS = {
  static:            { label: "Static chord",              build: (t, q) => Array(4).fill(`${t}${TN_CHORD_TYPES[q].label}`) },
  major_251:         { label: "Major II-V-I",              build: (t) => degrees251(t, "major") },
  minor_251:         { label: "Minor ii-V-i",              build: (t) => degrees251(t, "minor") },
  major_251_martino: { label: "Major II-V-I (Martino Mode)", martino: true, build: (t) => degrees251(t, "major") },
  blues:             { label: "Blues (first 4 of 12)",     build: (t) => Array(4).fill(`${t}7`) },
  modal:             { label: "Modal (dorian vamp)",       build: (t) => Array(4).fill(`${t}m7`) },
  rhythm_bridge:     { label: "Rhythm bridge (dominants)", build: (t) => cycleDominants(t) },
}

export const TN_POSITIONS = [
  "Anywhere", "Open position", "5th position (frets 3-8)",
  "7th position", "9th position", "12th position",
]

// What each rung of the ladder licenses. The route takes the same 1–5 level,
// so these are the practice-system reading of the numbers the lab sends.
export const TN_LEVEL_RULES = {
  1: "Chord tones, diatonic cells, single chromatic approaches.",
  2: "Triad pairs, diatonic 7th pivots. Fully inside.",
  3: "Enclosures, passing diminished, neighbor expansion.",
  4: "Melodic minor, quartal + dominant pivots, pentatonic.",
  5: "Alt pairs, planing, side-slip, symmetric dim.",
}

export const TN_TUTORIAL = [
  {
    id: "network", title: "The network model",
    body: "Nodes are triads / arpeggios / quartal + pentatonic fragments / dim7. Edges are the moves between them: enclosures, passing diminished, guide-tone steps, pentatonic connectors, chromatic slides. A raw triad pair is two nodes with no edge — that's why it sounds like an exercise. Inside vs outside is graph distance from the chord tones.",
  },
  {
    id: "skeleton", title: "The bebop skeleton",
    body: "Chord tones on strong beats, approach material on the upbeats. Guide-tone rails: b7 of the II falls to 3 of the V, b7 of the V falls to 3 of the I. Every device below decorates this rail. Short phrases first.",
  },
  {
    id: "loop", title: "The practice loop",
    body: "Every device runs the same loop: Hear (sing the target) → Isolate (one position, all inversions) → Connect (attach one edge) → Displace (start on the upbeat / mid-cell) → Apply (4 bars of a real tune, slow). End every phrase on a named resolution note.",
  },
  {
    id: "levels", title: "The 5 levels",
    body: "L1 chord tones · L2 diatonic pairs + pivots · L3 chromatic gravity (enclosures, passing dim) · L4 superimposition (melodic minor, quartal, pentatonic, dominant pivots) · L5 outside (alt pairs, planing, side-slip). Each level names its own gate — clear it before moving up.",
  },
  {
    id: "martino", title: "Martino Mode (the signature)", highlight: true,
    body: "Major II-V-I: play the ii minor (dorian) over BOTH the ii and the V — over the V it reads as a rootless G9. On the I, flip one note (F→F#) and D dorian becomes C lydian. For altered V, lift a half step into Ab melodic minor (Db+Eb, or Bbm/Abm), keep the shared B-F tritone as anchors, and slide the whole shape down a half step to resolve. The 3rd and 7th never move; only the color around them changes.",
  },
]

/**
 * Rough quality inference for a written symbol, for the route's scale and
 * guide-tone helpers. Presets build their own symbols, so this only has to
 * cover what TN_PROGRESSIONS can produce.
 */
export function guessQuality(sym) {
  const s = String(sym || "").toLowerCase()
  if (s.includes("m7b5") || s.includes("ø")) return "m7b5"
  if (s.includes("m(maj7)")) return "mMaj7"
  if (s.includes("maj7") || s.includes("maj9")) return "maj7"
  if (s.includes("dim") || s.includes("°")) return "dim7"
  if (s.includes("alt")) return "7alt"
  if (s.match(/m\d|m7|m9|min/)) return "m7"
  if (s.match(/7|9|13/)) return "7"
  return "maj7"
}
