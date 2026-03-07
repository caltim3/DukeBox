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
}

function isUppercase(quality) {
  return quality === "maj7" || quality === "maj6" ||
         quality === "7"    || quality === "7alt"
}

export function chordToRoman(root, quality, keyRoot, keyMode = "major") {
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
