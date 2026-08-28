// Sonora Noir Songbook — 5 songs imported from sonora-noir-songs.js
//
// Written in the "explicit bar object" style (root / quality / symbol /
// section) rather than forms.js's b()/s() helpers, because several bars
// here use altered dominants and slash chords that fall outside those
// helpers' built-in suffix table. `quality` still uses the standard tokens
// ("maj", "min", "maj7", "min7", "7", "min7b5", "7alt", "maj6", "min6")
// wherever the chord fits one, and falls back to a plain descriptive token
// (e.g. "7b9", "7#5", "min#5", "minAdd9") for anything more exotic —
// `symbol` always carries the exact, correctly-accidented label for
// display, independent of `quality`.
//
// If the arpeggio/scale engine keys off `quality`, the shared suffix map in
// forms.js may want these extra tokens added:
//   "7b9": "7b9", "7#9": "7#9", "7#5": "7#5", "7#11": "7#11",
//   "min#5": "m(#5)", "minAdd9": "m(add9)"
//
// "Coyote Waltz" is written in 3/4 (every other song here is 4/4) — set via
// the song-level `meter` field audio.js's playback engine now reads (see
// JAZZ_METERS in audio.js); every other song here omits `meter` and plays
// at the engine's default of 4/4.

// ---------------------------------------------------------------------------
// 1. Coyote Waltz — Desert Noir Waltz (A minor, 3/4, ~72 bpm)
// ---------------------------------------------------------------------------

const COYOTE_WALTZ_A = [
  { root: "A", quality: "min",     symbol: "Am",          section: "A" }, // 1
  { root: "A", quality: "min#5",   symbol: "Am(#5)/G#",   section: "A" }, // 2
  { root: "A", quality: "min6",    symbol: "Am6/G",       section: "A" }, // 3
  { root: "F#", quality: "min7b5", symbol: "F#m7b5",      section: "A" }, // 4
  { root: "D", quality: "min",     symbol: "Dm/F",        section: "A" }, // 5
  { root: "E", quality: "7b9",     symbol: "E7b9",        section: "A" }, // 6
  { root: "A", quality: "min",     symbol: "Am",          section: "A" }, // 7
  { root: "A", quality: "minAdd9", symbol: "Am(add9)",    section: "A" }, // 8
]

const COYOTE_WALTZ_BRIDGE = [
  { root: "D", quality: "min7", symbol: "Dm7",    section: "Bridge" }, // 1
  { root: "G", quality: "7#5",  symbol: "G7(#5)", section: "Bridge" }, // 2
  { root: "C", quality: "maj7", symbol: "Cmaj7",  section: "Bridge" }, // 3
  { root: "C", quality: "maj7", symbol: "Cmaj7",  section: "Bridge" }, // 4
  { root: "D", quality: "min7", symbol: "Dm7",    section: "Bridge" }, // 5
  { root: "G", quality: "7alt", symbol: "G7alt",  section: "Bridge" }, // 6
  { root: "A", quality: "min7", symbol: "Am7",    section: "Bridge" }, // 7
  { root: "E", quality: "7b9",  symbol: "E7b9",   section: "Bridge" }, // 8
]

const COYOTE_WALTZ = {
  keyRoot: "A",
  keyMode: "minor",
  tempo: 72,
  meter: "3/4",

  // Form: A - A - Bridge - A
  bars: [
    ...COYOTE_WALTZ_A,
    ...COYOTE_WALTZ_A,
    ...COYOTE_WALTZ_BRIDGE,
    ...COYOTE_WALTZ_A,
  ],
}

// ---------------------------------------------------------------------------
// 2. Cumbia del Diablo — Cumbia-Noir (D minor, ~104 bpm)
// ---------------------------------------------------------------------------

const CUMBIA_DEL_DIABLO_A = [
  { root: "D",  quality: "min7", symbol: "Dm7",      section: "A" }, // 1
  { root: "D",  quality: "min7", symbol: "Dm7",      section: "A" }, // 2
  { root: "C",  quality: "7#11", symbol: "C7(#11)",  section: "A" }, // 3
  { root: "Bb", quality: "maj7", symbol: "Bbmaj7",   section: "A" }, // 4
  { root: "D",  quality: "min7", symbol: "Dm7",      section: "A" }, // 5
  { root: "G",  quality: "min7", symbol: "Gm7",      section: "A" }, // 6
  { root: "C",  quality: "7",    symbol: "C7",       section: "A" }, // 7
  { root: "D",  quality: "min7", symbol: "Dm7",      section: "A" }, // 8
]

const CUMBIA_DEL_DIABLO_BRIDGE = [
  { root: "G",  quality: "min7", symbol: "Gm7",     section: "Bridge" }, // 1
  { root: "C",  quality: "7",    symbol: "C7",      section: "Bridge" }, // 2
  { root: "F",  quality: "maj7", symbol: "Fmaj7",   section: "Bridge" }, // 3
  { root: "F",  quality: "maj7", symbol: "Fmaj7",   section: "Bridge" }, // 4
  { root: "Bb", quality: "maj7", symbol: "Bbmaj7",  section: "Bridge" }, // 5
  { root: "A",  quality: "7#5",  symbol: "A7(#5)",  section: "Bridge" }, // 6
  { root: "D",  quality: "min7", symbol: "Dm7",     section: "Bridge" }, // 7
  { root: "A",  quality: "7b9",  symbol: "A7b9",    section: "Bridge" }, // 8
]

const CUMBIA_DEL_DIABLO = {
  keyRoot: "D",
  keyMode: "minor",
  tempo: 104,

  // Form: 16-bar A vamp (8-bar loop x2) - 8-bar bolero bridge
  bars: [
    ...CUMBIA_DEL_DIABLO_A,
    ...CUMBIA_DEL_DIABLO_A,
    ...CUMBIA_DEL_DIABLO_BRIDGE,
  ],
}

// ---------------------------------------------------------------------------
// 3. Milonga para Fantasmas — Milonga Ballad (A minor, ~66 bpm)
// ---------------------------------------------------------------------------

const MILONGA_A = [
  { root: "A", quality: "min",  symbol: "Am",    section: "A" }, // 1
  { root: "A", quality: "min",  symbol: "Am/G",  section: "A" }, // 2
  { root: "F", quality: "maj7", symbol: "Fmaj7", section: "A" }, // 3
  { root: "E", quality: "7",    symbol: "E7",    section: "A" }, // 4
  { root: "A", quality: "min",  symbol: "Am",    section: "A" }, // 5
  { root: "D", quality: "min6", symbol: "Dm6",   section: "A" }, // 6
  { root: "E", quality: "7b9",  symbol: "E7b9",  section: "A" }, // 7
  { root: "A", quality: "min",  symbol: "Am",    section: "A" }, // 8
]

const MILONGA_BRIDGE = [
  { root: "F", quality: "maj7", symbol: "Fmaj7", section: "Bridge" }, // 1
  { root: "E", quality: "min7", symbol: "Em7",   section: "Bridge" }, // 2
  { root: "D", quality: "min7", symbol: "Dm7",   section: "Bridge" }, // 3
  { root: "G", quality: "7",    symbol: "G7",    section: "Bridge" }, // 4
  { root: "C", quality: "maj7", symbol: "Cmaj7", section: "Bridge" }, // 5
  { root: "A", quality: "7alt", symbol: "A7alt", section: "Bridge" }, // 6
  { root: "D", quality: "min7", symbol: "Dm7",   section: "Bridge" }, // 7
  { root: "E", quality: "7b9",  symbol: "E7b9",  section: "Bridge" }, // 8
]

const MILONGA_PARA_FANTASMAS = {
  keyRoot: "A",
  keyMode: "minor",
  tempo: 66,

  // Form: AABA (32 bars)
  bars: [
    ...MILONGA_A,
    ...MILONGA_A,
    ...MILONGA_BRIDGE,
    ...MILONGA_A,
  ],
}

// ---------------------------------------------------------------------------
// 4. Dub Cantina — Psychedelic Dub-Soul (E minor/dorian, ~92 bpm)
// ---------------------------------------------------------------------------

const DUB_CANTINA = {
  keyRoot: "E",
  keyMode: "minor",
  tempo: 92,

  // Form: 12-bar groove vamp, loop and build (no formal bridge)
  bars: [
    { root: "E", quality: "min7",    symbol: "Em7",   section: "A" }, // 1
    { root: "E", quality: "min7",    symbol: "Em7",   section: "A" }, // 2
    { root: "A", quality: "min7",    symbol: "Am7",   section: "A" }, // 3
    { root: "D", quality: "maj",     symbol: "D",     section: "A" }, // 4
    { root: "G", quality: "maj",     symbol: "G",     section: "A" }, // 5
    { root: "G", quality: "maj",     symbol: "G",     section: "A" }, // 6
    { root: "C", quality: "maj",     symbol: "C",     section: "A" }, // 7
    { root: "B", quality: "min7b5",  symbol: "Bm7b5", section: "A" }, // 8
    { root: "E", quality: "min7",    symbol: "Em7",   section: "A" }, // 9
    { root: "A", quality: "min7",    symbol: "Am7",   section: "A" }, // 10
    { root: "D", quality: "maj",     symbol: "D",     section: "A" }, // 11
    { root: "E", quality: "min7",    symbol: "Em7",   section: "A" }, // 12
  ],
}

// ---------------------------------------------------------------------------
// 5. Vaquero Fantasma — Spaghetti Western Noir Blues (E minor, ~132 bpm swing)
// ---------------------------------------------------------------------------
//
// A clean 12-bar minor blues (i-i-i-i / iv-iv-i-i / bVI7-V7-i-V7), the
// standard jazz minor-blues form the Waits/Ribot turnaround is built on.

const VAQUERO_FANTASMA = {
  keyRoot: "E",
  keyMode: "minor",
  tempo: 132,

  bars: [
    { root: "E", quality: "min", symbol: "Em",      section: "A" }, // 1
    { root: "E", quality: "min", symbol: "Em",      section: "A" }, // 2
    { root: "E", quality: "min", symbol: "Em",      section: "A" }, // 3
    { root: "E", quality: "min", symbol: "Em",      section: "A" }, // 4

    { root: "A", quality: "min", symbol: "Am",      section: "A" }, // 5
    { root: "A", quality: "min", symbol: "Am",      section: "A" }, // 6
    { root: "E", quality: "min", symbol: "Em",      section: "A" }, // 7
    { root: "E", quality: "min", symbol: "Em",      section: "A" }, // 8

    { root: "C", quality: "7",   symbol: "C7",      section: "A" }, // 9  - bVI7
    { root: "B", quality: "7",   symbol: "B7",      section: "A" }, // 10 - V7
    { root: "E", quality: "min", symbol: "Em",      section: "A" }, // 11
    { root: "B", quality: "7#9", symbol: "B7(#9)",  section: "A" }, // 12 - turnaround
  ],
}

// ---------------------------------------------------------------------------
// Register with forms.js
// ---------------------------------------------------------------------------

export const SONORA_NOIR_FORMS = {
  "Coyote Waltz (Sonora Noir)": COYOTE_WALTZ,
  "Cumbia del Diablo (Sonora Noir)": CUMBIA_DEL_DIABLO,
  "Milonga para Fantasmas (Sonora Noir)": MILONGA_PARA_FANTASMAS,
  "Dub Cantina (Sonora Noir)": DUB_CANTINA,
  "Vaquero Fantasma (Sonora Noir)": VAQUERO_FANTASMA,
}
