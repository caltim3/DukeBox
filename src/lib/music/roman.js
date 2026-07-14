import { Note } from "@tonaljs/tonal"

// Scale degree: [accidentalPrefix, Roman numeral base]
const MAJOR_MAP = {
  0:  ["",  "I"],   1:  ["b", "II"],  2:  ["",  "II"],
  3:  ["b", "III"], 4:  ["",  "III"], 5:  ["",  "IV"],
  6:  ["b", "V"],   7:  ["",  "V"],   8:  ["b", "VI"],
  9:  ["",  "VI"],  10: ["b", "VII"], 11: ["",  "VII"],
}

const MINOR_MAP = {
  0:  ["",  "I"],   1:  ["b", "II"],  2:  ["",  "II"],
  3:  ["",  "III"], 4:  ["#", "III"], 5:  ["",  "IV"],
  6:  ["#", "IV"],  7:  ["",  "V"],   8:  ["",  "VI"],
  9:  ["#", "VI"],  10: ["",  "VII"], 11: ["#", "VII"],
}

const QUALITY_SUFFIX = {
  maj7:    "Δ7",
  maj6:    "6",
  min7:    "-7",
  min6:    "-6",
  "7":     "7",
  "7alt":  "7alt",
  min7b5:  "ø7",
  dim7:    "°7",
  // ── Extended / modal colors ──
  maj:       "",
  min:       "-",
  maj9:      "Δ9",
  "9":       "9",
  "6/9":     "6/9",
  add9:      "add9",
  sus4:      "sus",
  "7sus4":   "7sus",
  "7b9":     "7♭9",
  "maj7#11": "Δ7♯11",
  min9:      "-9",
  "min6/9":  "-6/9",
  minadd9:   "-add9",
  "min(maj7)": "-Δ7",
}

function isUppercase(quality) {
  return quality === "maj7" || quality === "maj6" || quality === "maj" ||
         quality === "maj9" || quality === "6/9" || quality === "add9" ||
         quality === "maj7#11" || quality === "7" || quality === "7alt" ||
         quality === "9" || quality === "7b9" || quality === "sus4" ||
         quality === "7sus4"
}

export function chordToRoman(root, quality, keyRoot, keyMode = "major") {
  if (quality === "NC" || root == null) return "N.C."
  const rootChroma = Note.chroma(root)
  const keyChroma  = Note.chroma(keyRoot)

  if (rootChroma == null || keyChroma == null) return "?"

  const semitones = (rootChroma - keyChroma + 12) % 12
  const map = keyMode === "minor" ? MINOR_MAP : MAJOR_MAP
  const [prefix, numeral] = map[semitones] ?? ["", "?"]

  const romanCase = isUppercase(quality) ? numeral : numeral.toLowerCase()
  const suffix = QUALITY_SUFFIX[quality] ?? quality

  return `${prefix}${romanCase}${suffix}`
}
