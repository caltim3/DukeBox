// Jazz form templates for DukeBox
// Each bar: { root, quality, symbol, section }

function b(root, quality, section = "A") {
  const sym = {
    maj7: "maj7", min7: "m7", "7": "7", min7b5: "m7b5",
    dim7: "dim7", "7alt": "7alt", maj6: "6", min6: "m6",
  }
  return { root, quality, symbol: `${root}${sym[quality] ?? quality}`, section }
}

// ─── 12-Bar Jazz Blues in Bb ───────────────────────────────────────────────
const BLUES_BB = {
  keyRoot: "Bb",
  keyMode: "major",
  bars: [
    b("Bb", "7"),    b("Eb", "7"),    b("Bb", "7"),    b("Bb", "7"),
    b("Eb", "7"),    b("Eb", "7"),    b("Bb", "7"),    b("G",  "7"),
    b("C",  "min7"), b("F",  "7"),    b("Bb", "7"),    b("F",  "7"),
  ],
}

// ─── 12-Bar Bird/Bebop Blues in F ──────────────────────────────────────────
const BIRD_BLUES_F = {
  keyRoot: "F",
  keyMode: "major",
  bars: [
    b("F",  "7"),    b("Bb", "7"),    b("F",  "7"),    b("Cm", "min7"),
    b("Bb", "7"),    b("B",  "dim7"), b("F",  "7"),    b("D",  "7"),
    b("G",  "min7"), b("C",  "7"),    b("F",  "7"),    b("C",  "7"),
  ],
}

// ─── Minor Blues in D minor ─────────────────────────────────────────────────
const MINOR_BLUES_DM = {
  keyRoot: "D",
  keyMode: "minor",
  bars: [
    b("D",  "min7"), b("G",  "min7"), b("D",  "min7"), b("D",  "min7"),
    b("G",  "min7"), b("G",  "min7"), b("D",  "min7"), b("A",  "7"),
    b("E",  "min7b5"), b("A", "7"),   b("D",  "min7"), b("A",  "7"),
  ],
}

// ─── AABA Rhythm Changes in Bb (32 bars) ────────────────────────────────────
const aA = (root, quality) => b(root, quality, "A")
const aB = (root, quality) => b(root, quality, "Bridge")

const A_SECTION = [
  aA("Bb", "maj7"), aA("G",  "min7"), aA("C",  "min7"), aA("F",  "7"),
  aA("F",  "min7"), aA("Bb", "7"),    aA("Eb", "maj7"), aA("F",  "7"),
]

const RHYTHM_CHANGES_BB = {
  keyRoot: "Bb",
  keyMode: "major",
  bars: [
    ...A_SECTION,
    ...A_SECTION,
    aB("D",  "7"),    aB("D",  "7"),    aB("G",  "7"),    aB("G",  "7"),
    aB("C",  "7"),    aB("C",  "7"),    aB("F",  "7"),    aB("F",  "7"),
    ...A_SECTION.map(bar => ({ ...bar, section: "A (last)" })),
  ],
}

// ─── 16-Bar Modal (D Dorian / So What style) ────────────────────────────────
const MODAL_D = {
  keyRoot: "D",
  keyMode: "minor",
  bars: [
    b("D",  "min7", "A"), b("D",  "min7", "A"), b("D",  "min7", "A"), b("D",  "min7", "A"),
    b("D",  "min7", "A"), b("D",  "min7", "A"), b("D",  "min7", "A"), b("D",  "min7", "A"),
    b("Eb", "min7", "B"), b("Eb", "min7", "B"), b("Eb", "min7", "B"), b("Eb", "min7", "B"),
    b("D",  "min7", "A"), b("D",  "min7", "A"), b("D",  "min7", "A"), b("D",  "min7", "A"),
  ],
}

// ─── ii-V-I Etude in C (practice form) ─────────────────────────────────────
const II_V_I_C = {
  keyRoot: "C",
  keyMode: "major",
  bars: [
    b("D",  "min7"),   b("G",  "7"),    b("C",  "maj7"),  b("C",  "maj7"),
    b("E",  "min7b5"), b("A",  "7"),    b("D",  "min7"),  b("D",  "min7"),
    b("F",  "min7"),   b("Bb", "7"),    b("Eb", "maj7"),  b("Eb", "maj7"),
    b("C",  "min7"),   b("F",  "7"),    b("Bb", "maj7"),  b("Bb", "maj7"),
  ],
}

export const FORMS = {
  "Custom":                  null,
  "12-Bar Blues (Bb)":       BLUES_BB,
  "Bird Blues (F)":          BIRD_BLUES_F,
  "Minor Blues (Dm)":        MINOR_BLUES_DM,
  "Rhythm Changes (Bb)":     RHYTHM_CHANGES_BB,
  "Modal / So What (Dm)":    MODAL_D,
  "ii-V-I Etude (C)":        II_V_I_C,
}

export const FORM_NAMES = Object.keys(FORMS)
