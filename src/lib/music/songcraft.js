// Song Crafter — key tables, degree resolution, and a progression library.
//
// Chords are carried as SCALE DEGREES wherever they came from a key-aware
// source (the all-keys table, the circle, a progression). That makes
// transposition exact — vii° stays vii°, and Gb correctly spells Cb rather
// than B — instead of guessing enharmonics from semitone math.

// ─── Keys ─────────────────────────────────────────────────────────────────────
// Diatonic triads exactly as engravers spell them, including the theoretical
// keys (C#, F#, Gb) where you get E#m, B#°, Cb. Mirrors the standard
// "Chords In All Major Keys" chart.
export const KEY_TABLE = {
  "C":  { acc: "natural", chords: ["C", "Dm", "Em", "F", "G", "Am", "B°"] },
  "C#": { acc: "sharp",   chords: ["C#", "D#m", "E#m", "F#", "G#", "A#m", "B#°"] },
  "Db": { acc: "flat",    chords: ["Db", "Ebm", "Fm", "Gb", "Ab", "Bbm", "C°"] },
  "D":  { acc: "sharp",   chords: ["D", "Em", "F#m", "G", "A", "Bm", "C#°"] },
  "Eb": { acc: "flat",    chords: ["Eb", "Fm", "Gm", "Ab", "Bb", "Cm", "D°"] },
  "E":  { acc: "sharp",   chords: ["E", "F#m", "G#m", "A", "B", "C#m", "D#°"] },
  "F":  { acc: "flat",    chords: ["F", "Gm", "Am", "Bb", "C", "Dm", "E°"] },
  "F#": { acc: "sharp",   chords: ["F#", "G#m", "A#m", "B", "C#", "D#m", "E#°"] },
  "Gb": { acc: "flat",    chords: ["Gb", "Abm", "Bbm", "Cb", "Db", "Ebm", "F°"] },
  "G":  { acc: "sharp",   chords: ["G", "Am", "Bm", "C", "D", "Em", "F#°"] },
  "Ab": { acc: "flat",    chords: ["Ab", "Bbm", "Cm", "Db", "Eb", "Fm", "G°"] },
  "A":  { acc: "sharp",   chords: ["A", "Bm", "C#m", "D", "E", "F#m", "G#°"] },
  "Bb": { acc: "flat",    chords: ["Bb", "Cm", "Dm", "Eb", "F", "Gm", "A°"] },
  "B":  { acc: "sharp",   chords: ["B", "C#m", "D#m", "E", "F#", "G#m", "A#°"] },
}

export const KEY_NAMES = Object.keys(KEY_TABLE)
export const DEGREE_LABELS = ["I", "ii", "iii", "IV", "V", "vi", "vii°"]

// Circle of fifths order, starting at the top (12 o'clock).
export const CIRCLE_ORDER = ["C", "G", "D", "A", "E", "B", "Gb", "Db", "Ab", "Eb", "Bb", "F"]

// Relative minor for each circle position (vi of the major key).
export const RELATIVE_MINOR = {
  C: "Am", G: "Em", D: "Bm", A: "F#m", E: "C#m", B: "G#m",
  Gb: "Ebm", Db: "Bbm", Ab: "Fm", Eb: "Cm", Bb: "Gm", F: "Dm",
}

// ─── Pitch helpers ────────────────────────────────────────────────────────────
const SHARP_PC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const FLAT_PC  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export function pitchClass(root) {
  const m = String(root || "").match(/^([A-G])(bb|##|b|#)?/)
  if (!m) return null
  let pc = LETTER_PC[m[1]]
  if (m[2] === "b") pc -= 1
  else if (m[2] === "bb") pc -= 2
  else if (m[2] === "#") pc += 1
  else if (m[2] === "##") pc += 2
  return ((pc % 12) + 12) % 12
}

// Split "C#m7" / "Bbm" / "F°" into { root, suffix }
export function splitChord(sym) {
  const m = String(sym || "").match(/^([A-G](?:bb|##|b|#)?)(.*)$/)
  return m ? { root: m[1], suffix: m[2] } : { root: String(sym || ""), suffix: "" }
}

// Spell a pitch class using the target key's accidental preference.
function spell(pc, keyName) {
  const acc = KEY_TABLE[keyName]?.acc ?? "flat"
  return (acc === "sharp" ? SHARP_PC : FLAT_PC)[((pc % 12) + 12) % 12]
}

// ─── Degree resolution ────────────────────────────────────────────────────────
// Handles chromatic degrees (bVII, bVI, bIII, #IV) plus quality suffixes, so a
// progression can be written the way musicians actually write it.
const DEGREE_SEMITONES = { I: 0, II: 2, III: 4, IV: 5, V: 7, VI: 9, VII: 11 }

/**
 * Resolve a Roman-numeral token in a key.
 *   "V7"    → { root: "G",  suffix: "7",  symbol: "G7" }   in C
 *   "bVII"  → { root: "Bb", suffix: "",   symbol: "Bb" }   in C
 *   "vii°"  → { root: "B",  suffix: "°",  symbol: "B°" }   in C
 * Diatonic triads route through KEY_TABLE so spelling matches the chart exactly.
 */
export function resolveDegree(token, keyName) {
  const raw = String(token || "").trim()
  const m = raw.match(/^([b#]*)([iIvV]+)(.*)$/)
  if (!m) return null
  const [, accidental, numeral, restRaw] = m

  const upper = numeral.toUpperCase()
  if (!(upper in DEGREE_SEMITONES)) return null
  const isMinorNumeral = numeral === numeral.toLowerCase()

  let rest = restRaw.trim()
  let semis = DEGREE_SEMITONES[upper]
  for (const ch of accidental) semis += ch === "b" ? -1 : 1

  // Plain diatonic triad → take the chart's spelling verbatim
  const degreeIndex = DEGREE_LABELS.findIndex(d => d === raw)
  if (degreeIndex !== -1) {
    const sym = KEY_TABLE[keyName].chords[degreeIndex]
    const { root, suffix } = splitChord(sym)
    return { root, suffix, symbol: sym, degree: raw }
  }

  const pc = (((semis % 12) + 12) % 12 + pitchClass(keyName)) % 12
  const root = spell(pc, keyName)

  // Infer quality from numeral case when no explicit suffix is given
  let suffix = rest
  if (!suffix) suffix = isMinorNumeral ? "m" : ""
  else if (isMinorNumeral && !/^(m|min|-|°|dim|ø)/.test(suffix)) suffix = `m${suffix}`

  return { root, suffix, symbol: `${root}${suffix}`, degree: raw }
}

/**
 * Re-spell a chord into a new key.
 * If we know the scale degree it came from, re-derive it (exact). Otherwise
 * shift by interval and spell with the new key's accidental preference.
 */
export function transposeChordToKey(chord, fromKey, toKey) {
  if (chord.degree) {
    const r = resolveDegree(chord.degree, toKey)
    if (r) return { ...chord, root: r.root, suffix: r.suffix, symbol: r.symbol }
  }
  const fromPc = pitchClass(fromKey), toPc = pitchClass(toKey), rootPc = pitchClass(chord.root)
  if (fromPc == null || toPc == null || rootPc == null) return chord
  const shifted = (rootPc + (toPc - fromPc) + 144) % 12
  const root = spell(shifted, toKey)
  return { ...chord, root, symbol: `${root}${chord.suffix ?? ""}` }
}

// ─── Progression library ──────────────────────────────────────────────────────
// Written as degree tokens so every entry renders correctly in any key.
export const PROGRESSIONS = {
  Pop: [
    { name: "I–V–vi–IV (the four chords)", degrees: ["I", "V", "vi", "IV"], note: "The most-used loop in modern pop. Endlessly singable." },
    { name: "vi–IV–I–V", degrees: ["vi", "IV", "I", "V"], note: "Same four chords starting on the minor — instantly moodier." },
    { name: "I–vi–IV–V (50s)", degrees: ["I", "vi", "IV", "V"], note: "Doo-wop. Warm, nostalgic, resolves hard." },
    { name: "IV–I–V–vi", degrees: ["IV", "I", "V", "vi"], note: "Starts away from home — good for a lifted chorus." },
    { name: "I–iii–IV–V", degrees: ["I", "iii", "IV", "V"], note: "The iii softens the climb to IV." },
  ],
  Rock: [
    { name: "I–bVII–IV", degrees: ["I", "bVII", "IV"], note: "Mixolydian rock. The bVII is the whole sound." },
    { name: "i–bVII–bVI–bVII", degrees: ["i", "bVII", "bVI", "bVII"], note: "Aeolian vamp — brooding, doesn't resolve." },
    { name: "I–IV–V", degrees: ["I", "IV", "V"], note: "Three chords and the truth." },
    { name: "i–bVI–bIII–bVII", degrees: ["i", "bVI", "bIII", "bVII"], note: "Epic minor loop, huge in stadium rock." },
    { name: "I–bIII–IV", degrees: ["I", "bIII", "IV"], note: "Blues-rock lift from the flat third." },
  ],
  "Jazz — standards": [
    { name: "ii–V–I", degrees: ["ii7", "V7", "Imaj7"], note: "The atom of jazz harmony. Learn it in all twelve." },
    { name: "I–vi–ii–V (turnaround)", degrees: ["Imaj7", "vi7", "ii7", "V7"], note: "The classic turnaround — loops forever." },
    { name: "iii–vi–ii–V", degrees: ["iii7", "vi7", "ii7", "V7"], note: "Longer descent by fifths into the tonic." },
    { name: "I–VI7–ii–V (rhythm changes A)", degrees: ["Imaj7", "VI7", "ii7", "V7"], note: "Secondary dominant on VI brightens the turn." },
    { name: "iii–biii°–ii–V", degrees: ["iii7", "biii°", "ii7", "V7"], note: "Passing diminished walks the bass down chromatically." },
  ],
  "Jazz — minor": [
    { name: "ii ø–V7–i", degrees: ["iiø", "V7", "i"], note: "Minor ii–V–i. The V is usually altered." },
    { name: "i–ivm–V7", degrees: ["i", "iv", "V7"], note: "Harmonic-minor colour from the major V." },
    { name: "i–bVI–ii ø–V7", degrees: ["i", "bVImaj7", "iiø", "V7"], note: "Wide, cinematic minor turnaround." },
  ],
  "Jazz — modal": [
    { name: "i (8) – bii (8) (So What)", degrees: ["i7", "bii7"], note: "Two chords, eight bars each. Space is the point." },
    { name: "Coltrane cycle", degrees: ["Imaj7", "bVI7", "bVImaj7", "III7"], note: "Major thirds cycle — Giant Steps motion." },
  ],
  "Gypsy jazz": [
    { name: "i–VI7–ii ø–V7 (Minor Swing)", degrees: ["i", "VI7", "iiø", "V7"], note: "The Django turnaround." },
    { name: "i–iv–i–V7", degrees: ["i", "iv", "i", "V7"], note: "Simple minor waltz shape — Dark Eyes territory." },
    { name: "I–VI7–II7–V7", degrees: ["I6", "VI7", "II7", "V7"], note: "All-dominant cycle. Very swing-era." },
  ],
  Blues: [
    { name: "12-bar (quick change)", degrees: ["I7", "IV7", "I7", "I7", "IV7", "IV7", "I7", "I7", "V7", "IV7", "I7", "V7"], note: "The standard 12-bar with the bar-2 quick change." },
    { name: "Minor blues", degrees: ["i7", "i7", "i7", "i7", "iv7", "iv7", "i7", "i7", "bVI7", "V7", "i7", "V7"], note: "Minor 12-bar — the bVI–V is the payoff." },
  ],
  "Folk / Country": [
    { name: "I–IV–I–V", degrees: ["I", "IV", "I", "V"], note: "Front-porch simple, leaves room for the story." },
    { name: "I–V–vi–iii–IV", degrees: ["I", "V", "vi", "iii", "IV"], note: "Pachelbel descent — works in any tempo." },
  ],
}

export const PROGRESSION_GENRES = Object.keys(PROGRESSIONS)

// ─── Song structure guidance ──────────────────────────────────────────────────
export const SECTION_KINDS = ["Intro", "Verse", "Pre-Chorus", "Chorus", "Bridge", "Solo", "Outro"]

export const SECTION_GUIDE = {
  Intro:      "Set the key and the groove. Often just the chorus loop with the melody stripped out — four or eight bars is plenty.",
  Verse:      "Stay lower and leave space; this is where the story goes. Keep harmony steady so the lyric carries. Ending on V pulls forward.",
  "Pre-Chorus": "Build tension and deny resolution. Climb stepwise, or sit on IV or ii and refuse to land on I until the chorus does.",
  Chorus:     "The payoff. Hit I early and often, widen the melody, raise the register. Simplest harmony of the whole song usually wins.",
  Bridge:     "Go somewhere the song hasn't been — relative minor, the parallel mode, or start on IV. Change one thing, not everything.",
  Solo:       "Reuse the verse or chorus changes so the ear stays oriented. If you must add a form, keep it a multiple of four bars.",
  Outro:      "Either loop the chorus and fade, or resolve firmly on I. Repetition beats new material this late.",
}

export const CRAFT_TIPS = [
  "Write the chorus first — then make the verse make it feel inevitable.",
  "If a progression feels flat, try starting it on a different chord rather than replacing chords.",
  "One borrowed chord (bVII, iv, bVI) is usually worth more than three diatonic ones.",
  "Contrast register, not just chords: a chorus that sits higher feels bigger even on the same loop.",
  "Repetition is the hook. Change the lyric before you change the harmony.",
  "A pre-chorus that never resolves makes an ordinary chorus feel earned.",
  "Secondary dominants (V7 of anything) tighten motion without leaving the key.",
  "If the bridge fights the song, cut it — a second chorus is often stronger.",
]
