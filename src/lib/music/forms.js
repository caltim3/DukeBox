// Jazz form library for DukeBox
// Original 6 forms + ~65 songs organized by category

// ─── bar helpers ──────────────────────────────────────────────────────────────
function b(root, quality, section = "A") {
  const sym = {
    maj7: "maj7", min7: "m7", "7": "7", min7b5: "m7b5",
    dim7: "dim7", "7alt": "7alt", maj6: "6", min6: "m6",
  }
  return { root, quality, symbol: `${root}${sym[quality] ?? quality}`, section }
}

// Enharmonic sharp→flat (DukeBox uses flat-preferred spelling)
const EH = {
  "F#":"Gb","C#":"Db","G#":"Ab","D#":"Eb","A#":"Bb","B#":"C",
  "Cb":"B","Fb":"E","E#":"F",
}

const QSYM = {
  maj7:"maj7", min7:"m7", "7":"7", min7b5:"m7b5",
  dim7:"dim7", "7alt":"7alt", maj6:"6", min6:"m6",
}

function qual(suffix) {
  const s = suffix
    .replace(/\([^)]*\)/g, "")       // strip (parenthetical) annotations
    .replace(/\/[A-G][b#]?\d*$/, "") // strip slash bass like /G or /Eb
    .trim()

  if (!s || s === "maj" || s === "sus" || s === "sus4" || s === "sus2"
         || s === "add9" || s === "add2") return "maj7"
  if (s === "6" || s === "maj6" || s === "6/9") return "maj6"
  if (s === "m6" || s === "min6") return "min6"
  if (s.startsWith("maj") || s === "Δ" || s === "M7") return "maj7"
  if (s === "dim7" || s === "dim" || s === "o" || s === "o7") return "dim7"
  if (s === "+" || s === "aug") return "7"
  if ((s.includes("m") || s.startsWith("-")) && (s.includes("b5") || s.includes("ø"))) return "min7b5"
  if (s.includes("alt") || (s.includes("7") && s.includes("#9"))
      || (s.includes("7") && s.includes("#5"))) return "7alt"
  if (s === "m" || s === "min" || s === "-") return "min7"
  if (s.startsWith("m") && !s.startsWith("ma")) return "min7"
  if (s.startsWith("min")) return "min7"
  if (s.includes("7") || s.includes("9") || s.includes("11") || s.includes("13")) return "7"
  return "maj7"
}

// Parse one BB-style chord string (e.g. "Cm7 F7") → array of bar objects
function s(str, section = "A") {
  const cleaned = str.replace(/\([^)]*\)/g, "").trim()
  if (!cleaned) return []
  return cleaned.split(/\s+/).filter(Boolean).flatMap(token => {
    const t = token.replace(/\/[A-G][b#]?(\d+)?$/, "")
    const m = t.match(/^([A-G][b#]?)/)
    if (!m) return []
    const root = EH[m[1]] || m[1]
    const quality = qual(t.slice(m[1].length))
    return [{ root, quality, symbol: `${root}${QSYM[quality]}`, section }]
  })
}

// ─── Original DukeBox forms (kept verbatim) ───────────────────────────────────
const BLUES_BB = {
  keyRoot: "Bb", keyMode: "major", tempo: 140,
  bars: [
    b("Bb","7"),  b("Eb","7"),  b("Bb","7"),  b("Bb","7"),
    b("Eb","7"),  b("Eb","7"),  b("Bb","7"),  b("G","7"),
    b("C","min7"),b("F","7"),   b("Bb","7"),  b("F","7"),
  ],
}

const BIRD_BLUES_F = {
  keyRoot: "F", keyMode: "major", tempo: 190,
  bars: [
    b("F","7"),    b("Bb","7"),   b("F","7"),    b("C","min7"),
    b("Bb","7"),   b("B","dim7"), b("F","7"),    b("D","7"),
    b("G","min7"), b("C","7"),    b("F","7"),    b("C","7"),
  ],
}

const MINOR_BLUES_DM = {
  keyRoot: "D", keyMode: "minor", tempo: 110,
  bars: [
    b("D","min7"),  b("G","min7"),   b("D","min7"),  b("D","min7"),
    b("G","min7"),  b("G","min7"),   b("D","min7"),  b("A","7"),
    b("E","min7b5"),b("A","7"),      b("D","min7"),  b("A","7"),
  ],
}

const aA = (root, quality) => b(root, quality, "A")
const aB = (root, quality) => b(root, quality, "Bridge")
const A_SECTION = [
  aA("Bb","maj7"), aA("G","min7"),  aA("C","min7"),  aA("F","7"),
  aA("F","min7"),  aA("Bb","7"),    aA("Eb","maj7"), aA("F","7"),
]
const RHYTHM_CHANGES_BB = {
  keyRoot: "Bb", keyMode: "major", tempo: 200,
  bars: [
    ...A_SECTION, ...A_SECTION,
    aB("D","7"), aB("D","7"), aB("G","7"), aB("G","7"),
    aB("C","7"), aB("C","7"), aB("F","7"), aB("F","7"),
    ...A_SECTION.map(bar => ({ ...bar, section: "A (last)" })),
  ],
}

const MODAL_D = {
  keyRoot: "D", keyMode: "minor", tempo: 135,
  bars: [
    b("D","min7","A"),  b("D","min7","A"),  b("D","min7","A"),  b("D","min7","A"),
    b("D","min7","A"),  b("D","min7","A"),  b("D","min7","A"),  b("D","min7","A"),
    b("Eb","min7","B"), b("Eb","min7","B"), b("Eb","min7","B"), b("Eb","min7","B"),
    b("D","min7","A"),  b("D","min7","A"),  b("D","min7","A"),  b("D","min7","A"),
  ],
}

const II_V_I_C = {
  keyRoot: "C", keyMode: "major", tempo: 120,
  bars: [
    b("D","min7"),    b("G","7"),      b("C","maj7"),   b("C","maj7"),
    b("E","min7b5"),  b("A","7"),      b("D","min7"),   b("D","min7"),
    b("F","min7"),    b("Bb","7"),     b("Eb","maj7"),  b("Eb","maj7"),
    b("C","min7"),    b("F","7"),      b("Bb","maj7"),  b("Bb","maj7"),
  ],
}

// ─── Blues ────────────────────────────────────────────────────────────────────
const MINOR_BLUES_CM = {
  keyRoot: "C", keyMode: "minor", tempo: 110,
  bars: [
    ...s("Cm7"),  ...s("Cm7"),  ...s("Cm7"),  ...s("Cm7"),
    ...s("Fm7"),  ...s("Fm7"),  ...s("Cm7"),  ...s("Cm7"),
    ...s("G7alt"),...s("G7alt"),...s("Cm7"),  ...s("G7alt"),
  ],
}

const KEY_TO_HIGHWAY = {
  keyRoot: "A", keyMode: "major", tempo: 115,
  bars: [
    ...s("A7"),  ...s("E7"),  ...s("D7"),  ...s("D7"),
    ...s("A7"),  ...s("E7"),  ...s("A7"),  ...s("E7"),
  ],
}

const NOWS_THE_TIME = {
  keyRoot: "F", keyMode: "major", tempo: 145,
  bars: [
    ...s("F7"),  ...s("Bb7"), ...s("F7"),     ...s("F7"),
    ...s("Bb7"), ...s("Bb7"), ...s("F7"),     ...s("D7alt"),
    ...s("Gm7"), ...s("C7"),  ...s("F7"),     ...s("Gm7 C7"),
  ],
}

const TENOR_MADNESS = {
  keyRoot: "Bb", keyMode: "major", tempo: 155,
  bars: [
    ...s("Bb7"), ...s("Eb7"), ...s("Bb7"),    ...s("Bb7"),
    ...s("Eb7"), ...s("Eb7"), ...s("Bb7"),    ...s("G7alt"),
    ...s("Cm7"), ...s("F7"),  ...s("Bb7"),    ...s("Cm7 F7"),
  ],
}

const BLUE_MONK = {
  keyRoot: "Bb", keyMode: "major", tempo: 110,
  bars: [
    ...s("Bb7"),       ...s("Eb7"),      ...s("Bb7"),       ...s("Bb7"),
    ...s("Eb7"),       ...s("Edim7"),    ...s("Bb7 G7alt"),  ...s("Cm7 F7alt"),
    ...s("Bb7 Eb7"),   ...s("Bb7 F7alt"),...s("Bb7"),       ...s("Bb7"),
  ],
}

const STRAIGHT_NO_CHASER = {
  keyRoot: "F", keyMode: "major", tempo: 130,
  bars: [
    ...s("F7"),  ...s("Bb7"), ...s("F7"),     ...s("F7"),
    ...s("Bb7"), ...s("Bdim7"),...s("F7 D7alt"),...s("Gm7 C7alt"),
    ...s("F7"),  ...s("Gm7 C7alt"),...s("F7"), ...s("F7"),
  ],
}

// ─── Easy Standards ───────────────────────────────────────────────────────────
const ALL_OF_ME = {
  keyRoot: "C", keyMode: "major", tempo: 160,
  bars: [
    ...s("Cmaj7"),...s("E7"),   ...s("A7"),    ...s("Dm7"),
    ...s("E7"),   ...s("Am7"),  ...s("D7"),    ...s("Dm7 G7"),
    ...s("Cmaj7"),...s("E7"),   ...s("A7"),    ...s("Dm7"),
    ...s("Fmaj7"),...s("Fm6"),  ...s("Cmaj7"), ...s("G7"),
    ...s("C6"),   ...s("A7"),   ...s("Dm7"),   ...s("G7"),
  ],
}

const AUTUMN_LEAVES = {
  keyRoot: "G", keyMode: "minor", tempo: 130,
  bars: [
    ...s("Cm7 F7"),     ...s("Bbmaj7 Ebmaj7"),
    ...s("Am7b5 D7alt"), ...s("Gm7"),
    ...s("Cm7 F7"),     ...s("Bbmaj7 Ebmaj7"),
    ...s("Am7b5 D7alt"), ...s("Gm7 G7alt"),
    ...s("Cm7 F7"),
  ],
}

const SUMMERTIME = {
  keyRoot: "A", keyMode: "minor", tempo: 75,
  bars: [
    ...s("Am7"), ...s("Am7"), ...s("E7"),  ...s("E7"),
    ...s("Am7"), ...s("Am7"), ...s("Dm7"), ...s("Am7"),
    ...s("Dm7"), ...s("Am7"), ...s("E7"),  ...s("Am7"),
    ...s("Am7"),
  ],
}

const BLUE_BOSSA = {
  keyRoot: "C", keyMode: "minor", tempo: 150,
  bars: [
    ...s("Cm7"), ...s("Cm7"), ...s("Fm7"), ...s("Fm7"),
    ...s("Dm7b5 G7alt"), ...s("Cm7"),
    ...s("Ebm7 Ab7"), ...s("Dbmaj7"), ...s("Dbmaj7"),
    ...s("Dm7b5 G7alt"), ...s("Cm7"),
  ],
}

const FOOTPRINTS = {
  keyRoot: "C", keyMode: "minor", tempo: 138,
  bars: [
    ...s("Cm7"),   ...s("Cm7"),   ...s("Cm7"),   ...s("Cm7"),
    ...s("Fm7"),   ...s("Fm7"),   ...s("Cm7"),   ...s("Cm7"),
    ...s("D7alt"), ...s("D7alt"), ...s("Cm7"),   ...s("G7alt"),
  ],
}

const MISTY = {
  keyRoot: "Eb", keyMode: "major", tempo: 70,
  bars: [
    ...s("Ebmaj7"), ...s("Bbm7 Eb7"),  ...s("Abmaj7"),
    ...s("Abm7 Db7"),  ...s("Ebmaj7 Cm7"),
    ...s("Fm7 Bb7"),   ...s("Gm7 C7alt"),
    ...s("Fm7 Bb7"),   ...s("Ebmaj7"),
  ],
}

const TAKE_THE_A_TRAIN = {
  keyRoot: "C", keyMode: "major", tempo: 175,
  bars: [
    ...s("Cmaj7"), ...s("Cmaj7"), ...s("D7"),     ...s("D7"),
    ...s("Dm7 G7"),...s("Cmaj7 A7"),...s("Dm7 G7"),...s("C6"),
    ...s("Cmaj7"), ...s("Cmaj7"), ...s("D7"),     ...s("D7"),
    ...s("Dm7 G7"),...s("Cmaj7 A7"),...s("Dm7 G7"),...s("C6"),
    ...s("Fmaj7"), ...s("Fmaj7"), ...s("Fmaj7"),  ...s("Fmaj7"),
    ...s("D7"),    ...s("G7"),    ...s("Cmaj7"),   ...s("Dm7 G7"),
    ...s("Cmaj7"), ...s("Cmaj7"), ...s("D7"),     ...s("D7"),
    ...s("Dm7 G7"),...s("Cmaj7 A7"),...s("Dm7 G7"),...s("C6"),
  ],
}

const RECORDA_ME = {
  keyRoot: "A", keyMode: "minor", tempo: 140,
  bars: [
    ...s("Am7"),     ...s("Am7"),     ...s("Cm7 F7"),
    ...s("Bbmaj7"),  ...s("Bbmaj7"),  ...s("Ebm7 Ab7"),
    ...s("Am7"),     ...s("Am7"),     ...s("Cm7 F7"),
    ...s("Bbmaj7"),  ...s("Ebm7 Ab7"),...s("Dm7 G7"), ...s("Cmaj7 Fmaj7"),
  ],
}

const IN_A_SENTIMENTAL_MOOD = {
  keyRoot: "D", keyMode: "minor", tempo: 70,
  bars: [
    ...s("Dm7 G7"),    ...s("Cmaj7 Fmaj7"), ...s("Dm7 G7"),    ...s("Cmaj7 A7alt"),
    ...s("Dm7 G7"),    ...s("Cmaj7 Fmaj7"), ...s("Bbmaj7 E7alt"), ...s("A7alt"),
    ...s("Dm7 G7"),    ...s("Cmaj7 Fmaj7"), ...s("Dm7 G7"),    ...s("Cmaj7 A7alt"),
    ...s("Dm7 G7"),    ...s("Cmaj7 Fmaj7"), ...s("Bbmaj7 Gm7 C7"), ...s("F6"),
    ...s("Gm7 C7"),    ...s("Fmaj7"),       ...s("Fmaj7"),
    ...s("Ebm7 Ab7"),  ...s("Dbmaj7"),      ...s("Gm7 C7"),
    ...s("Dm7 G7"),    ...s("Cmaj7 Fmaj7"), ...s("Dm7 G7"),    ...s("Cmaj7 A7alt"),
    ...s("Dm7 G7"),    ...s("Cmaj7 Fmaj7"), ...s("Bbmaj7 E7alt"), ...s("A7alt"),
  ],
}

const HOW_HIGH_THE_MOON = {
  keyRoot: "G", keyMode: "major", tempo: 180,
  bars: [
    ...s("Gmaj7"), ...s("Gmaj7"), ...s("Gm7 C7"),
    ...s("Fmaj7"), ...s("Fmaj7"), ...s("Fm7 Bb7"),
    ...s("Ebmaj7"), ...s("Am7b5 D7"), ...s("Gmaj7"),
    ...s("Gmaj7"),  ...s("Gm7 C7"),   ...s("Fmaj7"),
    ...s("Fmaj7"),  ...s("Fm7 Bb7"),  ...s("Ebmaj7"),
    ...s("Am7b5 D7alt"), ...s("Gmaj7"),
  ],
}

// ─── Jazz Standards ───────────────────────────────────────────────────────────
const ALL_THE_THINGS_YOU_ARE = {
  keyRoot: "Ab", keyMode: "major", tempo: 135,
  bars: [
    ...s("Fm7"),    ...s("Bbm7"),  ...s("Eb7"),    ...s("Abmaj7"),
    ...s("Dbmaj7"), ...s("Dm7b5"), ...s("G7"),     ...s("Cmaj7"),
    ...s("Cm7"),    ...s("Fm7"),   ...s("Bb7"),    ...s("Ebmaj7"),
    ...s("Abmaj7"), ...s("Am7b5"), ...s("D7"),     ...s("Gmaj7"),
    ...s("Gmaj7"),  ...s("Am7"),   ...s("D7"),     ...s("Gmaj7"),
    ...s("Gmaj7"),  ...s("Gbm7b5"),...s("B7"),     ...s("Emaj7"),
    ...s("Emaj7"),  ...s("Am7 D7"),...s("Gmaj7 C7"),...s("Fm7 Bb7"),
    ...s("Ebmaj7 Abmaj7"),...s("Dbmaj7 G7"),...s("Cmaj7"),
  ],
}

const STELLA_BY_STARLIGHT = {
  keyRoot: "Bb", keyMode: "major", tempo: 85,
  bars: [
    ...s("Em7b5 A7alt"),   ...s("Cm7 F7"),
    ...s("Fm7 Bb7"),       ...s("Ebmaj7 Ab7"),
    ...s("Dm7b5 G7alt"),   ...s("Cmaj7 Am7 D7"),
    ...s("Gm7 C7"),        ...s("Fm7 Bb7"),
    ...s("Ebmaj7 Ebdim7"), ...s("Dm7 G7alt"),
    ...s("Cm7 F7"),        ...s("Bbmaj7"),
  ],
}

const BODY_AND_SOUL = {
  keyRoot: "Db", keyMode: "major", tempo: 80,
  bars: [
    ...s("Ebm7 Ab7"), ...s("Dbmaj7"), ...s("Ebm7 A7"),  ...s("Dbmaj7"),
    ...s("Ebm7 Ab7"), ...s("Dbmaj7"), ...s("Bbm7"),     ...s("Eb7 Ab7"),
    ...s("Ebm7 Ab7"), ...s("Dbmaj7"), ...s("Ebm7 A7"),  ...s("Dbmaj7"),
    ...s("Ebm7 Ab7"), ...s("Dbmaj7"), ...s("Bbm7"),     ...s("Eb7 Ab7"),
    ...s("Dm7"),      ...s("Dm7"),    ...s("G7"),        ...s("G7"),
    ...s("Cmaj7"),    ...s("Cmaj7"),  ...s("Cm7 F7"),    ...s("Bb7 Eb7"),
    ...s("Ebm7 Ab7"), ...s("Dbmaj7"), ...s("Ebm7 A7"),  ...s("Dbmaj7"),
    ...s("Ebm7 Ab7"), ...s("Dbmaj7"), ...s("Bbm7"),     ...s("Dbmaj7"),
  ],
}

const MY_FUNNY_VALENTINE = {
  keyRoot: "C", keyMode: "minor", tempo: 60,
  bars: [
    ...s("Cm7"),       ...s("Cm7"),    ...s("Cm7"),     ...s("C7alt"),
    ...s("Fm7 Bb7"),   ...s("Ebmaj7"), ...s("Abmaj7"),  ...s("Dm7b5 G7alt"),
    ...s("Cm7"),       ...s("Cm7"),    ...s("Cm7"),     ...s("C7alt"),
    ...s("Fm7 Bb7"),   ...s("Ebmaj7"), ...s("Abmaj7"),  ...s("Dm7b5 G7alt"),
    ...s("Cm7"),       ...s("Cm7"),    ...s("Fm7"),     ...s("Fm7"),
    ...s("Bb7"),       ...s("Bb7"),    ...s("Ebmaj7"),  ...s("Abmaj7"),
    ...s("Dm7b5 G7alt"),...s("Cm7"),   ...s("Fm7"),
    ...s("Cm7 G7alt"), ...s("Cm7"),
  ],
}

const SOMEDAY_MY_PRINCE = {
  keyRoot: "Bb", keyMode: "major", tempo: 125,
  bars: [
    ...s("Bbmaj7"),        ...s("Gm7"),       ...s("Cm7 F7"),
    ...s("Ebmaj7 Edim7"),  ...s("Dm7 G7"),    ...s("Cm7 F7"),
    ...s("Bbmaj7"),        ...s("Gm7"),        ...s("Cm7 F7"),
    ...s("Ebmaj7 Edim7"),  ...s("Dm7 G7"),    ...s("Cm7 F7"),
    ...s("Am7 D7"),        ...s("Gm7 C7"),    ...s("Fmaj7 A7"), ...s("Dm7 G7"),
    ...s("Cm7 F7"),        ...s("Bbmaj7 D7"), ...s("Gm7 C7"),   ...s("F7 Bbmaj7"),
    ...s("Bbmaj7"),        ...s("Gm7"),        ...s("Cm7 F7"),
    ...s("Ebmaj7 Edim7"),  ...s("Dm7 G7"),    ...s("Cm7 F7"),
  ],
}

const GIRL_FROM_IPANEMA = {
  keyRoot: "F", keyMode: "major", tempo: 128,
  bars: [
    ...s("Fmaj7"),   ...s("Fmaj7"),   ...s("G7"),      ...s("G7"),
    ...s("Gm7"),     ...s("Gb7"),     ...s("Fmaj7"),   ...s("Gb7"),
    ...s("Fmaj7"),   ...s("Fmaj7"),   ...s("G7"),      ...s("G7"),
    ...s("Gm7"),     ...s("C7"),      ...s("Fmaj7"),   ...s("Fmaj7"),
    ...s("Gbmaj7"),  ...s("Gbmaj7"),  ...s("B7"),      ...s("B7"),
    ...s("Bbm7"),    ...s("E7"),      ...s("Abmaj7"),  ...s("Abmaj7"),
    ...s("Abm7"),    ...s("Db7"),     ...s("Gbmaj7"),  ...s("Gbmaj7"),
    ...s("Gm7"),     ...s("C7"),      ...s("Fmaj7"),   ...s("Fmaj7"),
  ],
}

const BLACK_ORPHEUS = {
  keyRoot: "A", keyMode: "minor", tempo: 95,
  bars: [
    ...s("Am7"),     ...s("Am7"),     ...s("Bm7b5 E7"), ...s("Am7"),
    ...s("Dm7"),     ...s("G7"),      ...s("Cmaj7"),
    ...s("Fmaj7"),   ...s("Bm7b5"),   ...s("E7"),        ...s("Am7"),
    ...s("Am7"),     ...s("A7"),      ...s("Dm7"),       ...s("G7"),
    ...s("Cmaj7"),   ...s("Fmaj7"),   ...s("Bm7b5 E7"),  ...s("Am7"),
    ...s("E7"),      ...s("Am7"),
  ],
}

const BLUE_IN_GREEN = {
  keyRoot: "D", keyMode: "minor", tempo: 86,
  bars: [
    ...s("Gm7"),      ...s("A7alt"),  ...s("Dm7 Db7"),   ...s("Cm7 F7"),
    ...s("Bbm7"),     ...s("A7alt"),  ...s("Dm7"),
    ...s("E7alt"),    ...s("Am7"),    ...s("Dm7"),
  ],
}

const ON_GREEN_DOLPHIN_STREET = {
  keyRoot: "Eb", keyMode: "major", tempo: 145,
  bars: [
    ...s("Ebmaj7"), ...s("Ebmaj7"), ...s("Ebm7 Ab7"),
    ...s("Dbmaj7"), ...s("Dbmaj7"), ...s("Dm7b5 G7alt"),
    ...s("Cm7"),    ...s("Cm7"),    ...s("Fm7 Bb7"),
    ...s("Ebmaj7"), ...s("Am7b5 D7"), ...s("Gm7 C7alt"),
    ...s("Fm7 Bb7"), ...s("Ebmaj7"),
  ],
}

const SOLAR = {
  keyRoot: "C", keyMode: "minor", tempo: 140,
  bars: [
    ...s("Cm7"),    ...s("Cm7"),    ...s("Gm7b5 C7alt"),
    ...s("Fmaj7"),  ...s("Fmaj7"),  ...s("Fm7 Bb7"),
    ...s("Ebmaj7"), ...s("Ebmaj7"), ...s("Am7b5 D7alt"),
    ...s("Gm7 C7alt"), ...s("Fmaj7"),
  ],
}

const DOLPHIN_DANCE = {
  keyRoot: "Eb", keyMode: "major", tempo: 130,
  bars: [
    ...s("Eb7"),    ...s("Ab7alt"), ...s("Dm7b5"),  ...s("G7alt"),
    ...s("Cm7"),    ...s("F7"),     ...s("Bbmaj7"), ...s("Bb7"),
    ...s("Ebm7"),   ...s("Ab7"),    ...s("Dbmaj7"), ...s("Am7 D7"),
    ...s("Gm7"),    ...s("C7"),     ...s("Fm7 Bb7"),...s("Ebmaj7"),
  ],
}

const JUST_FRIENDS = {
  keyRoot: "F", keyMode: "major", tempo: 170,
  bars: [
    ...s("Fmaj7"), ...s("A7"),    ...s("Dm7"),  ...s("G7"),
    ...s("Gm7"),   ...s("C7"),    ...s("Fmaj7"),...s("C7"),
    ...s("Fmaj7"), ...s("A7"),    ...s("Dm7"),  ...s("G7"),
    ...s("Gm7"),   ...s("C7"),    ...s("Fmaj7"),...s("Fmaj7"),
    ...s("Bbmaj7"),...s("Bbm7"),  ...s("Fmaj7"),...s("D7"),
    ...s("Gm7"),   ...s("C7"),    ...s("Am7 D7"),...s("Gm7 C7"),
    ...s("Fmaj7"), ...s("A7"),    ...s("Dm7"),  ...s("G7"),
    ...s("Gm7"),   ...s("C7"),    ...s("Fmaj7"),...s("Fmaj7"),
  ],
}

const EMBRACEABLE_YOU = {
  keyRoot: "G", keyMode: "major", tempo: 65,
  bars: [
    ...s("Gmaj7"),     ...s("Gmaj7"),  ...s("Em7 A7"),    ...s("Am7 D7"),
    ...s("Gmaj7"),     ...s("Gmaj7"),  ...s("Em7 A7"),    ...s("G6 D7alt"),
    ...s("Gmaj7"),     ...s("Gmaj7"),  ...s("Em7 A7"),    ...s("Am7 D7"),
    ...s("Gmaj7"),     ...s("Gmaj7"),  ...s("Em7 A7"),    ...s("G6"),
    ...s("Gm7 C7"),    ...s("Fmaj7"),  ...s("Fmaj7"),
    ...s("Bb7"),       ...s("Bb7"),    ...s("Ebmaj7 D7"), ...s("Gmaj7 E7"),
    ...s("Am7 D7"),    ...s("Gmaj7"),  ...s("Gmaj7"),
    ...s("Gmaj7 E7"),  ...s("Am7 D7"), ...s("G6"),
  ],
}

const THERE_WILL_NEVER = {
  keyRoot: "Eb", keyMode: "major", tempo: 155,
  bars: [
    ...s("Ebmaj7"),     ...s("Ebmaj7"),    ...s("Fm7 Bb7"),
    ...s("Ebmaj7 Cm7"), ...s("F7 Bb7"),
    ...s("Ebmaj7"),     ...s("Ebmaj7"),    ...s("Fm7 Bb7"),
    ...s("Ebmaj7 Cm7"), ...s("Fm7 Bb7"),   ...s("Ebmaj7"),
    ...s("Ebm7 Ab7"),   ...s("Dbmaj7"),    ...s("Dbmaj7"),
    ...s("Dbm7 Gb7"),   ...s("Bmaj7"),     ...s("Bb7"),
    ...s("Ebmaj7"),     ...s("Ebmaj7"),    ...s("Fm7 Bb7"),
    ...s("Ebmaj7 Cm7"), ...s("Fm7 Bb7"),   ...s("Ebmaj7"),
  ],
}

const DAYS_OF_WINE_AND_ROSES = {
  keyRoot: "F", keyMode: "major", tempo: 110,
  bars: [
    ...s("Fmaj7"),     ...s("Eb7"),       ...s("Dm7 G7"),
    ...s("Cm7 F7"),    ...s("Bbmaj7"),    ...s("Bbm7 Eb7"),
    ...s("Am7 D7"),    ...s("Gm7 C7"),
    ...s("Fmaj7"),     ...s("Dm7 Gm7"),   ...s("C7"),  ...s("F6"),
  ],
}

// ─── Bebop ────────────────────────────────────────────────────────────────────
const RHYTHM_CHANGES_BEBOP = {
  keyRoot: "Bb", keyMode: "major", tempo: 220,
  bars: [
    ...s("Bbmaj7 Bdim7"),...s("Cm7 F7"),  ...s("Dm7 G7"),  ...s("Cm7 F7"),
    ...s("Bbmaj7 Bdim7"),...s("Cm7 F7"),  ...s("Dm7 Db7"), ...s("Cm7 F7"),
    ...s("D7"),          ...s("D7"),       ...s("G7"),      ...s("G7"),
    ...s("C7"),          ...s("C7"),       ...s("F7"),      ...s("F7"),
    ...s("Bbmaj7 Bdim7"),...s("Cm7 F7"),  ...s("Dm7 G7"),  ...s("Cm7 F7"),
  ],
}

const OLEO = {
  keyRoot: "Bb", keyMode: "major", tempo: 210,
  bars: [
    ...s("Bbmaj7 G7"),...s("Cm7 F7"),...s("Bbmaj7 G7"),...s("Cm7 F7"),
    ...s("Dm7 G7"),   ...s("Cm7 F7"),...s("Bbmaj7"),    ...s("Cm7 F7"),
    ...s("Bbmaj7 G7"),...s("Cm7 F7"),...s("Bbmaj7 G7"),...s("Cm7 F7"),
    ...s("Dm7 G7"),   ...s("Cm7 F7"),...s("Bbmaj7"),    ...s("Bb7"),
    ...s("D7"),       ...s("D7"),     ...s("G7"),        ...s("G7"),
    ...s("C7"),       ...s("C7"),     ...s("F7"),        ...s("F7"),
    ...s("Bbmaj7 G7"),...s("Cm7 F7"),...s("Bbmaj7 G7"),...s("Cm7 F7"),
    ...s("Dm7 G7"),   ...s("Cm7 F7"),...s("Bbmaj7"),    ...s("F7"),
  ],
}

const CONFIRMATION = {
  keyRoot: "F", keyMode: "major", tempo: 195,
  bars: [
    ...s("Fmaj7"),    ...s("Em7b5 A7alt"), ...s("Dm7 G7alt"),...s("Cm7 F7"),
    ...s("Bbmaj7"),   ...s("Am7 Dm7"),     ...s("Gm7 C7"),   ...s("Fmaj7"),
    ...s("Fmaj7"),    ...s("Em7b5 A7alt"), ...s("Dm7 G7alt"),...s("Cm7 F7"),
    ...s("Bbmaj7"),   ...s("Am7 Dm7"),     ...s("Gm7 C7"),   ...s("Fmaj7"),
    ...s("Em7b5 A7alt"),...s("Dm7"),       ...s("Dbm7 Gb7"), ...s("Bmaj7"),
    ...s("Bbm7 Eb7"), ...s("Abmaj7"),      ...s("Gm7 C7"),   ...s("Fmaj7"),
    ...s("Fmaj7"),    ...s("Em7b5 A7alt"), ...s("Dm7 G7alt"),...s("Cm7 F7"),
    ...s("Bbmaj7"),   ...s("Am7 Dm7"),     ...s("Gm7 C7"),   ...s("Fmaj7"),
  ],
}

const DONNA_LEE = {
  keyRoot: "Ab", keyMode: "major", tempo: 215,
  bars: [
    ...s("Abmaj7"),   ...s("Abmaj7"),  ...s("Fm7 Bb7"),  ...s("Eb7"),
    ...s("Abmaj7"),   ...s("F7"),      ...s("Bbm7"),     ...s("Eb7"),
    ...s("Abmaj7"),   ...s("Abmaj7"),  ...s("Fm7 Bb7"),  ...s("Eb7"),
    ...s("Abmaj7"),   ...s("F7"),      ...s("Bbm7"),     ...s("Abmaj7"),
    ...s("Dbmaj7"),   ...s("Dbmaj7"),  ...s("Dbm7 Gb7"), ...s("Bmaj7"),
    ...s("Bbm7 Eb7"), ...s("Abmaj7"),  ...s("F7"),       ...s("Bbm7 Eb7"),
    ...s("Abmaj7"),   ...s("Abmaj7"),  ...s("Fm7 Bb7"),  ...s("Eb7"),
    ...s("Abmaj7"),   ...s("F7"),      ...s("Bbm7"),     ...s("Abmaj7"),
  ],
}

const CHEROKEE = {
  keyRoot: "Bb", keyMode: "major", tempo: 220,
  bars: [
    ...s("Bbmaj7"),...s("Bbmaj7"),...s("Bbmaj7"),...s("Bbmaj7"),
    ...s("Cm7 F7"),...s("Bbmaj7"),...s("Bbmaj7"),
    ...s("Bbmaj7"),...s("Bbmaj7"),...s("Bbmaj7"),...s("Bbmaj7"),
    ...s("Cm7 F7"),...s("Bbmaj7"),...s("Bb7"),
    ...s("Bmaj7"), ...s("Bmaj7"), ...s("Emaj7"), ...s("Emaj7"),
    ...s("Amaj7"), ...s("Amaj7"), ...s("Dmaj7"), ...s("Dmaj7"),
    ...s("Gmaj7"), ...s("Gmaj7"), ...s("Cmaj7"), ...s("Cmaj7"),
    ...s("Fmaj7"), ...s("Fmaj7"), ...s("Bb7"),   ...s("Bb7"),
    ...s("Bbmaj7"),...s("Bbmaj7"),...s("Bbmaj7"),...s("Bbmaj7"),
    ...s("Cm7 F7"),...s("Bbmaj7"),...s("Bbmaj7"),
  ],
}

const A_NIGHT_IN_TUNISIA = {
  keyRoot: "D", keyMode: "minor", tempo: 185,
  bars: [
    ...s("Eb7 Dm7"), ...s("Eb7 Dm7"),
    ...s("Eb7 Dm7"), ...s("Eb7 Dm7"),
    ...s("Gm7 C7"),  ...s("Fmaj7"),   ...s("Fmaj7"),
    ...s("Em7b5 A7alt"), ...s("Dm7"), ...s("A7alt"),
  ],
}

const COLTRANE_CHANGES = {
  keyRoot: "Bb", keyMode: "major", tempo: 210,
  bars: [
    ...s("Bbmaj7 D7"),  ...s("Gmaj7 Bb7"),
    ...s("Ebmaj7 Gb7"), ...s("Bmaj7 E7"),
    ...s("Amaj7 C7"),   ...s("Fmaj7 Ab7"),
    ...s("Dbmaj7 E7"),  ...s("Amaj7 C7"),
  ],
}

const MOMENTS_NOTICE = {
  keyRoot: "Eb", keyMode: "major", tempo: 205,
  bars: [
    ...s("Ebm7 Ab7"),  ...s("Dbmaj7 Gb7"),
    ...s("Bmaj7"),     ...s("Am7b5 D7"),   ...s("Gm7 C7"),
    ...s("Fm7 Bb7"),   ...s("Ebmaj7 A7"),
    ...s("Dmaj7"),     ...s("Am7 D7"),     ...s("Gm7 C7alt"), ...s("Fm7 Bb7"),
  ],
}

const CARAVAN = {
  keyRoot: "F", keyMode: "minor", tempo: 190,
  bars: [
    ...s("Fm7"), ...s("Fm7"), ...s("Fm7"), ...s("C7"), ...s("Fm7"),
    ...s("Fm7"), ...s("C7"),  ...s("Fm7"),
    ...s("Abmaj7"), ...s("Abmaj7"), ...s("Dbmaj7"), ...s("Dbmaj7"),
    ...s("Gm7b5 C7"), ...s("Fm7"),  ...s("Fm7"),
  ],
}

// ─── Gypsy Jazz ───────────────────────────────────────────────────────────────
const DARK_EYES = {
  keyRoot: "D", keyMode: "minor", tempo: 190,
  bars: [
    ...s("Dm"), ...s("Dm"), ...s("A7"),    ...s("A7"),
    ...s("A7"), ...s("A7"), ...s("Bbmaj7"),...s("Bbmaj7"),
    ...s("Gm"), ...s("Gm"), ...s("Dm"),    ...s("Dm"),
    ...s("A7"), ...s("A7"), ...s("Dm"),    ...s("Dm"),
  ],
}

const ILL_SEE_YOU_DJANGO = {
  keyRoot: "F", keyMode: "major", tempo: 180,
  bars: [
    ...s("F6"),  ...s("F6"),  ...s("Fm6"), ...s("Fm6"),
    ...s("C6"),  ...s("B7"),  ...s("C6"),  ...s("C6"),
    ...s("A7"),  ...s("A7"),  ...s("D7"),  ...s("D7"),
    ...s("G7"),  ...s("G7"),  ...s("C7"),  ...s("C7"),
    ...s("F6"),  ...s("F6"),  ...s("Fm6"), ...s("Fm6"),
    ...s("C6"),  ...s("B7"),  ...s("F6"),  ...s("D7"),
    ...s("Gm7"), ...s("C7"),  ...s("F6"),  ...s("F6"),
  ],
}

const ROSE_ROOM_DJANGO = {
  keyRoot: "Ab", keyMode: "major", tempo: 170,
  bars: [
    ...s("Ab6"),  ...s("Eb7"),  ...s("Ab6"), ...s("Ab6"),
    ...s("Bbm6"), ...s("Eb7"),  ...s("Ab6"), ...s("Ab6"),
    ...s("Ab6"),  ...s("C7"),   ...s("Fm6"), ...s("Fm6"),
    ...s("Bbm7"), ...s("Eb7"),  ...s("Ab6"), ...s("Eb7"),
    ...s("Db6"),  ...s("Dbm6"), ...s("Ab6"), ...s("F7"),
    ...s("Bbm7"), ...s("Eb7"),  ...s("Ab6"), ...s("Eb7"),
    ...s("Ab6"),  ...s("C7"),   ...s("Fm6"), ...s("Bb7"),
    ...s("Bbm7"), ...s("Eb7"),  ...s("Ab6"), ...s("Ab6"),
  ],
}

const MINOR_SWING = {
  keyRoot: "A", keyMode: "minor", tempo: 200,
  bars: [
    ...s("Am6"), ...s("Am6"), ...s("Dm6"), ...s("Dm6"),
    ...s("E7"),  ...s("E7"),  ...s("Am6"), ...s("Am6"),
    ...s("Dm6"), ...s("Dm6"), ...s("Am6"), ...s("Am6"),
    ...s("E7"),  ...s("E7"),  ...s("Am6"), ...s("E7"),
    ...s("Am6"), ...s("Am6"), ...s("Dm6"), ...s("Dm6"),
    ...s("E7"),  ...s("E7"),  ...s("Am6"), ...s("Am6"),
    ...s("Dm6"), ...s("Dm6"), ...s("Am6"), ...s("Am6"),
    ...s("E7"),  ...s("E7"),  ...s("Am6"), ...s("Am6"),
  ],
}

const NUAGES = {
  keyRoot: "G", keyMode: "major", tempo: 90,
  bars: [
    ...s("G6"),  ...s("G6"),  ...s("Cm6"), ...s("Cm6"),
    ...s("G6"),  ...s("D7"),  ...s("G6"),  ...s("Gdim7"),
    ...s("G6"),  ...s("G6"),  ...s("Cm6"), ...s("Cm6"),
    ...s("G6"),  ...s("D7"),  ...s("G6"),  ...s("D7"),
    ...s("Eb6"), ...s("Eb6"), ...s("Bbm6"),...s("Bbm6"),
    ...s("G6"),  ...s("E7"),  ...s("Am7 D7"),
    ...s("G6"),  ...s("G6"),  ...s("Cm6"), ...s("Cm6"),
    ...s("G6"),  ...s("D7"),  ...s("G6"),  ...s("G6"),
  ],
}

const DJANGOLOGY = {
  keyRoot: "G", keyMode: "major", tempo: 165,
  bars: [
    ...s("G6"),  ...s("G6"),  ...s("C6"),  ...s("C6"),
    ...s("G6"),  ...s("D7"),  ...s("G6"),  ...s("D7"),
    ...s("G6"),  ...s("G6"),  ...s("C6"),  ...s("C6"),
    ...s("G6"),  ...s("D7"),  ...s("G6"),  ...s("G6"),
    ...s("Am7 D7"),...s("G6 E7"),...s("Am7 D7"),...s("G6 D7"),
    ...s("G6"),  ...s("G6"),  ...s("C6"),  ...s("C6"),
    ...s("G6"),  ...s("D7"),  ...s("G6"),  ...s("G6"),
  ],
}

const SWEET_GEORGIA_BROWN = {
  keyRoot: "Ab", keyMode: "major", tempo: 210,
  bars: [
    ...s("Eb7"), ...s("Eb7"), ...s("Ab6"), ...s("Ab6"),
    ...s("Eb7"), ...s("Eb7"), ...s("Ab6"), ...s("Ab6"),
    ...s("Eb7"), ...s("Eb7"), ...s("Ab6"), ...s("Ab6"),
    ...s("C7"),  ...s("C7"),  ...s("F6"),  ...s("F6"),
    ...s("C7"),  ...s("C7"),  ...s("F6"),  ...s("F6"),
    ...s("C7"),  ...s("C7"),  ...s("F6"),  ...s("F6"),
    ...s("C7"),  ...s("C7"),  ...s("F6"),  ...s("F6"),
    ...s("C7"),  ...s("C7"),  ...s("F6"),  ...s("F6"),
  ],
}

const AFTER_YOUVE_GONE = {
  keyRoot: "C", keyMode: "major", tempo: 195,
  bars: [
    ...s("C6"),  ...s("C6"),  ...s("G7"),  ...s("G7"),
    ...s("C6"),  ...s("C6"),  ...s("G7"),  ...s("G7"),
    ...s("E7"),  ...s("E7"),  ...s("Am"),  ...s("Am"),
    ...s("D7"),  ...s("D7"),  ...s("G7"),  ...s("G7"),
    ...s("C6"),  ...s("C6"),  ...s("G7"),  ...s("G7"),
    ...s("C6"),  ...s("C6"),  ...s("G7"),  ...s("G7"),
    ...s("F6"),  ...s("Gbdim7"),...s("C6 A7"),...s("Dm7 G7"),
    ...s("C6 Fm6"),...s("C6 G7"),...s("C6"),
  ],
}

const BELLEVILLE = {
  keyRoot: "D", keyMode: "major", tempo: 180,
  bars: [
    ...s("D6"),  ...s("D6"),  ...s("G6"),  ...s("G6"),
    ...s("D6"),  ...s("A7"),  ...s("D6"),  ...s("A7"),
    ...s("D6"),  ...s("D6"),  ...s("G6"),  ...s("G6"),
    ...s("D6"),  ...s("A7"),  ...s("D6"),  ...s("D6"),
    ...s("Em7 A7"),...s("D6 B7"),...s("Em7 A7"),...s("D6 A7"),
    ...s("D6"),  ...s("D6"),  ...s("G6"),  ...s("G6"),
    ...s("D6"),  ...s("A7"),  ...s("D6"),  ...s("D6"),
  ],
}

const DOUCE_AMBIANCE = {
  keyRoot: "A", keyMode: "minor", tempo: 115,
  bars: [
    ...s("Am6"), ...s("Dm6"), ...s("Am6"), ...s("E7"),
    ...s("Am6"), ...s("Dm6"), ...s("Am6 E7"), ...s("Am6"),
    ...s("Am6"), ...s("Dm6"), ...s("Am6"), ...s("E7"),
    ...s("Am6"), ...s("Dm6"), ...s("Am6 E7"), ...s("Am6"),
    ...s("Dm6 G7"),...s("Cmaj7 Fmaj7"),...s("Bm7b5 E7"),...s("Am6 E7"),
    ...s("Am6"), ...s("Dm6"), ...s("Am6"), ...s("E7"),
    ...s("Am6"), ...s("Dm6"), ...s("Am6 E7"), ...s("Am6"),
  ],
}

const JATTENDRAI = {
  keyRoot: "C", keyMode: "major", tempo: 130,
  bars: [
    ...s("Cmaj7"), ...s("Cmaj7"), ...s("G7"), ...s("G7"),
    ...s("G7"),    ...s("G7"),    ...s("Cmaj7"),...s("Cmaj7"),
    ...s("Cmaj7"), ...s("Cmaj7"), ...s("G7"), ...s("G7"),
    ...s("G7"),    ...s("G7"),    ...s("Cmaj7"),...s("Cmaj7"),
    ...s("Fmaj7"), ...s("Fmaj7"), ...s("Cmaj7"),...s("Cmaj7"),
    ...s("Dm7 G7"),...s("Cmaj7 G7"),...s("Cmaj7"),
    ...s("Cmaj7"), ...s("Cmaj7"), ...s("G7"), ...s("G7"),
    ...s("G7"),    ...s("G7"),    ...s("Cmaj7"),...s("Cmaj7"),
  ],
}

const SWING_42 = {
  keyRoot: "C", keyMode: "major", tempo: 190,
  bars: [
    ...s("C6"), ...s("C6"), ...s("G7"), ...s("G7"),
    ...s("G7"), ...s("G7"), ...s("C6"), ...s("C6"),
    ...s("C6"), ...s("C6"), ...s("G7"), ...s("G7"),
    ...s("G7"), ...s("G7"), ...s("C6"), ...s("C6"),
    ...s("F6"), ...s("F6"), ...s("C6"), ...s("C6"),
    ...s("D7"), ...s("D7"), ...s("G7"), ...s("G7"),
    ...s("C6"), ...s("C6"), ...s("G7"), ...s("G7"),
    ...s("G7"), ...s("G7"), ...s("C6"), ...s("C6"),
  ],
}

const LIMEHOUSE_BLUES = {
  keyRoot: "G", keyMode: "major", tempo: 220,
  bars: [
    ...s("G"),  ...s("G"),  ...s("C"),  ...s("G"),
    ...s("D7"), ...s("D7"), ...s("G"),  ...s("D7"),
    ...s("G"),  ...s("G"),  ...s("C"),  ...s("G"),
    ...s("D7"), ...s("D7"), ...s("G"),  ...s("G"),
    ...s("F"),  ...s("F"),  ...s("Bb"), ...s("F"),
    ...s("C7"), ...s("C7"), ...s("F"),  ...s("C7"),
    ...s("G"),  ...s("G"),  ...s("C"),  ...s("G"),
    ...s("D7"), ...s("D7"), ...s("G"),  ...s("G"),
  ],
}

// ─── Rock & Pop ───────────────────────────────────────────────────────────────
const SOMETHING_BEATLES = {
  keyRoot: "C", keyMode: "major", tempo: 66,
  bars: [
    ...s("C"),    ...s("Cmaj7"),...s("C7"),   ...s("F"),
    ...s("D7"),   ...s("G"),    ...s("Am"),   ...s("Am7"),
    ...s("Am7"),  ...s("D7"),   ...s("F"),    ...s("Eb G"),
  ],
}

const LET_IT_BE = {
  keyRoot: "C", keyMode: "major", tempo: 143,
  bars: [
    ...s("C"),  ...s("G"),    ...s("Am Am7"), ...s("Fmaj7 F6"),
    ...s("C"),  ...s("G"),    ...s("F"),      ...s("C"),
    ...s("C"),  ...s("G"),    ...s("Am Am7"), ...s("Fmaj7 F6"),
    ...s("C"),  ...s("G"),    ...s("F"),      ...s("C"),
    ...s("Am"), ...s("G"),    ...s("F"),      ...s("C"),
    ...s("C"),  ...s("G"),    ...s("F"),      ...s("C"),
  ],
}

const HERE_COMES_THE_SUN = {
  keyRoot: "A", keyMode: "major", tempo: 129,
  bars: [
    ...s("A"),  ...s("E"),   ...s("Gbm"), ...s("D"),
    ...s("Bm"), ...s("G"),   ...s("Dbm"), ...s("A7"),
  ],
}

const HEY_JUDE = {
  keyRoot: "F", keyMode: "major", tempo: 74,
  bars: [
    ...s("F"),  ...s("C"),  ...s("C7"), ...s("Bb"),
    ...s("Eb"), ...s("Dm"), ...s("Gm"), ...s("F7"),
  ],
}

const BLACK_MAGIC_WOMAN = {
  keyRoot: "D", keyMode: "minor", tempo: 120,
  bars: [
    ...s("Dm7"), ...s("Am7"), ...s("Dm7"), ...s("Gm"),
    ...s("Dm7"), ...s("A7"),  ...s("Dm7"),
  ],
}

const HONKY_TONK_WOMEN = {
  keyRoot: "G", keyMode: "major", tempo: 125,
  bars: [
    ...s("G"), ...s("C"), ...s("G"), ...s("A"),
    ...s("D"), ...s("G"), ...s("C"), ...s("G"),
    ...s("D"), ...s("G"),
    ...s("G"), ...s("D"), ...s("G"), ...s("G"),
    ...s("D"), ...s("G"),
  ],
}

const SWEET_DREAMS = {
  keyRoot: "G", keyMode: "major", tempo: 80,
  bars: [
    ...s("G"),  ...s("G"),  ...s("A7"), ...s("A7"),
    ...s("D7"), ...s("D7"), ...s("G"),  ...s("G"),
    ...s("A7"), ...s("A7"), ...s("D7"), ...s("D7"),
    ...s("G"),  ...s("G"),  ...s("C"),  ...s("G"),
    ...s("G"),  ...s("Em"), ...s("Em"), ...s("G"),
    ...s("C"),  ...s("D7"), ...s("G"),  ...s("C"), ...s("D7"),
  ],
}

const BITTERSWEET = {
  keyRoot: "A", keyMode: "major", tempo: 92,
  bars: [
    ...s("G"), ...s("D"), ...s("Am"), ...s("C"),
  ],
}

// ─── Form catalog ─────────────────────────────────────────────────────────────
export const FORM_CATEGORIES = {
  "Practice": [
    "Custom",
    "12-Bar Jazz Blues (Bb)",
    "Bird Blues (F)",
    "Minor Blues (Dm)",
    "Minor Blues (Cm)",
    "Rhythm Changes (Bb)",
    "Modal / So What (Dm)",
    "ii-V-I Etude (C)",
  ],
  "Blues": [
    "Key to the Highway (A)",
    "Now's The Time (F)",
    "Tenor Madness (Bb)",
    "Blue Monk (Bb)",
    "Straight No Chaser (F)",
  ],
  "Easy Standards": [
    "All of Me (C)",
    "Autumn Leaves (Gm)",
    "Summertime (Am)",
    "Blue Bossa (Cm)",
    "Footprints (Cm)",
    "Misty (Eb)",
    "Recorda Me (Am)",
    "Take the A Train (C)",
    "In a Sentimental Mood (Dm)",
    "How High the Moon (G)",
  ],
  "Jazz Standards": [
    "All The Things You Are (Ab)",
    "Stella By Starlight (Bb)",
    "Body and Soul (Db)",
    "My Funny Valentine (Cm)",
    "Someday My Prince Will Come (Bb)",
    "Girl From Ipanema (F)",
    "Black Orpheus (Am)",
    "Blue in Green (Dm)",
    "On Green Dolphin Street (Eb)",
    "Solar (Cm)",
    "Dolphin Dance (Eb)",
    "Just Friends (F)",
    "Embraceable You (G)",
    "There Will Never Be Another You (Eb)",
    "Days of Wine and Roses (F)",
  ],
  "Bebop": [
    "Rhythm Changes (Standard)",
    "Rhythm Changes (Bebop)",
    "Oleo (Bb)",
    "Confirmation (F)",
    "Donna Lee (Ab)",
    "Cherokee (Bb)",
    "A Night in Tunisia (Dm)",
    "Coltrane Changes (Bb)",
    "Moment's Notice (Eb)",
    "Caravan (Fm)",
  ],
  "Gypsy Jazz": [
    "Dark Eyes (Dm)",
    "Minor Swing (Am)",
    "Nuages (G)",
    "Djangology (G)",
    "I'll See You in My Dreams (F)",
    "Rose Room (Ab)",
    "Sweet Georgia Brown (Ab)",
    "After You've Gone (C)",
    "Belleville (D)",
    "Douce Ambiance (Am)",
    "J'attendrai (C)",
    "Swing 42 (C)",
    "Limehouse Blues (G)",
  ],
  "Rock & Pop": [
    "Something – Beatles (C)",
    "Let It Be – Beatles (C)",
    "Here Comes the Sun – Beatles (A)",
    "Hey Jude – Beatles (F)",
    "Black Magic Woman – Santana (Dm)",
    "Honky Tonk Women – Stones (G)",
    "Sweet Dreams – Patsy Cline (G)",
    "Bittersweet – BHTM (A)",
  ],
}

export const FORMS = {
  // ── Custom / AI ──────────────────────────────────────────
  "Custom":                            null,
  // ── Practice ─────────────────────────────────────────────
  "12-Bar Jazz Blues (Bb)":            BLUES_BB,
  "Bird Blues (F)":                    BIRD_BLUES_F,
  "Minor Blues (Dm)":                  MINOR_BLUES_DM,
  "Minor Blues (Cm)":                  MINOR_BLUES_CM,
  "Rhythm Changes (Bb)":               RHYTHM_CHANGES_BB,
  "Modal / So What (Dm)":              MODAL_D,
  "ii-V-I Etude (C)":                  II_V_I_C,
  // ── Blues ─────────────────────────────────────────────────
  "Key to the Highway (A)":            KEY_TO_HIGHWAY,
  "Now's The Time (F)":                NOWS_THE_TIME,
  "Tenor Madness (Bb)":                TENOR_MADNESS,
  "Blue Monk (Bb)":                    BLUE_MONK,
  "Straight No Chaser (F)":            STRAIGHT_NO_CHASER,
  // ── Easy Standards ────────────────────────────────────────
  "All of Me (C)":                     ALL_OF_ME,
  "Autumn Leaves (Gm)":                AUTUMN_LEAVES,
  "Summertime (Am)":                   SUMMERTIME,
  "Blue Bossa (Cm)":                   BLUE_BOSSA,
  "Footprints (Cm)":                   FOOTPRINTS,
  "Misty (Eb)":                        MISTY,
  "Recorda Me (Am)":                   RECORDA_ME,
  "Take the A Train (C)":              TAKE_THE_A_TRAIN,
  "In a Sentimental Mood (Dm)":        IN_A_SENTIMENTAL_MOOD,
  "How High the Moon (G)":             HOW_HIGH_THE_MOON,
  // ── Jazz Standards ────────────────────────────────────────
  "All The Things You Are (Ab)":       ALL_THE_THINGS_YOU_ARE,
  "Stella By Starlight (Bb)":          STELLA_BY_STARLIGHT,
  "Body and Soul (Db)":                BODY_AND_SOUL,
  "My Funny Valentine (Cm)":           MY_FUNNY_VALENTINE,
  "Someday My Prince Will Come (Bb)":  SOMEDAY_MY_PRINCE,
  "Girl From Ipanema (F)":             GIRL_FROM_IPANEMA,
  "Black Orpheus (Am)":                BLACK_ORPHEUS,
  "Blue in Green (Dm)":                BLUE_IN_GREEN,
  "On Green Dolphin Street (Eb)":      ON_GREEN_DOLPHIN_STREET,
  "Solar (Cm)":                        SOLAR,
  "Dolphin Dance (Eb)":                DOLPHIN_DANCE,
  "Just Friends (F)":                  JUST_FRIENDS,
  "Embraceable You (G)":               EMBRACEABLE_YOU,
  "There Will Never Be Another You (Eb)": THERE_WILL_NEVER,
  "Days of Wine and Roses (F)":        DAYS_OF_WINE_AND_ROSES,
  // ── Bebop ─────────────────────────────────────────────────
  "Rhythm Changes (Standard)":         RHYTHM_CHANGES_BB,
  "Rhythm Changes (Bebop)":            RHYTHM_CHANGES_BEBOP,
  "Oleo (Bb)":                         OLEO,
  "Confirmation (F)":                  CONFIRMATION,
  "Donna Lee (Ab)":                    DONNA_LEE,
  "Cherokee (Bb)":                     CHEROKEE,
  "A Night in Tunisia (Dm)":           A_NIGHT_IN_TUNISIA,
  "Coltrane Changes (Bb)":             COLTRANE_CHANGES,
  "Moment's Notice (Eb)":              MOMENTS_NOTICE,
  "Caravan (Fm)":                      CARAVAN,
  // ── Gypsy Jazz ────────────────────────────────────────────
  "Dark Eyes (Dm)":                    DARK_EYES,
  "Minor Swing (Am)":                  MINOR_SWING,
  "Nuages (G)":                        NUAGES,
  "Djangology (G)":                    DJANGOLOGY,
  "I'll See You in My Dreams (F)":     ILL_SEE_YOU_DJANGO,
  "Rose Room (Ab)":                    ROSE_ROOM_DJANGO,
  "Sweet Georgia Brown (Ab)":          SWEET_GEORGIA_BROWN,
  "After You've Gone (C)":             AFTER_YOUVE_GONE,
  "Belleville (D)":                    BELLEVILLE,
  "Douce Ambiance (Am)":               DOUCE_AMBIANCE,
  "J'attendrai (C)":                   JATTENDRAI,
  "Swing 42 (C)":                      SWING_42,
  "Limehouse Blues (G)":               LIMEHOUSE_BLUES,
  // ── Rock & Pop ────────────────────────────────────────────
  "Something – Beatles (C)":           SOMETHING_BEATLES,
  "Let It Be – Beatles (C)":           LET_IT_BE,
  "Here Comes the Sun – Beatles (A)":  HERE_COMES_THE_SUN,
  "Hey Jude – Beatles (F)":            HEY_JUDE,
  "Black Magic Woman – Santana (Dm)":  BLACK_MAGIC_WOMAN,
  "Honky Tonk Women – Stones (G)":     HONKY_TONK_WOMEN,
  "Sweet Dreams – Patsy Cline (G)":    SWEET_DREAMS,
  "Bittersweet – BHTM (A)":            BITTERSWEET,
}

export const FORM_NAMES = Object.keys(FORMS)
