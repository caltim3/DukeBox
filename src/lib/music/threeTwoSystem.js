// The Pickup Music "3:2 System" pentatonic navigator, wired to a real chart.
//
// Ported from the standalone reference page (public/reference/pentatonic-32-
// navigator.html — the same page lives in Reference, byte-for-byte, with its
// own audio and metronome and no connection to anything below). That page's
// interval maps, its diagonal band-grouping algorithm, and its exact colors
// all come along unchanged. What's new here is the decision "which chord
// gets which shape, at which level" — the reference page hand-writes that
// for four fixed practice progressions; this module derives it from
// whatever song is actually loaded, reusing the same chord-scale logic the
// rest of DukeBox already uses to pick scales (getRecommendedScalesFromQuality
// and harmony.js's cadence/function analysis) rather than re-deriving it.
//
// Levels — a fixed "blues-thinking" ladder applied to any chart, not just
// blues ones: pick a tonal color, and hold it across every chord change
// instead of re-deriving a new scale from each chord's own quality.
//   0 — Chord scales: the full 7-note recommended scale, root/chord-tone/
//       tension colored. Same primary scale getRecommendedScalesFromQuality
//       already hands the rest of the app for this chord. Unchanged by any
//       of this — the one level that's still genuinely per-chord-quality.
//   1 — Blues scale: one minor pentatonic, off the tune's own tonic (see
//       classifySongForm's tonicBar), blanketed over the whole form — same
//       shape start to finish, no matter what the chart's own chords are.
//   2 — Minor: every chord gets a minor-family shape off its OWN root —
//       Dorian, or minor pentatonic/hexatonic with those density filters on
//       — regardless of whether that chord is actually minor. The 3rd is
//       tinted green (buildPentaBoard/buildScaleBoardFromNotes's
//       markBlueNote/markThirdDegree) whenever the real chord doesn't have
//       a minor 3rd of its own: a deliberately "worried" note to bend.
//   3 — Major: the same idea, major family — Mixolydian, or major
//       pentatonic/hexatonic.
//   4 — Altered: identical to Major, except a chord actually functioning as
//       a dominant resolution (analyzeProgressionContext's cadence read)
//       swaps in the altered scale instead, ignoring the density filter.

import { Note } from "@tonaljs/tonal"
import { fretPositions, FRETBOARD_FRETS } from "@/components/Fretboard"
import { getRecommendedScalesFromQuality, scaleNotes, chordNotes, buildChordSymbol, chordInfo, fretFlowScaleNotes } from "@/lib/music/tonal"
import { analyzeProgressionContext } from "@/lib/music/harmony"

// Exact hex from the reference page — a fixed sub-system, like the maple
// fretboard tokens in globals.css, never swapped by palette or dark/light
// mode. Consumers should reach for the CSS custom properties (--n-32-*);
// these are exported for the rare case something needs the raw value.
export const THREE_TWO_HEX = {
  blue: "#1D9BF0", blueBand: "#C4E5FB",
  red: "#E2402F", redBand: "#F8CCC5",
  tension: "#FBFAF6", tensionStroke: "#9AA0A6", tensionText: "#6B7075",
}

// Collapses DukeBox's ~20 quality strings (tonal.js QUALITIES) down to the
// handful of buckets the 3:2 trick tree actually branches on.
function bucketOf(quality) {
  const q = String(quality || "")
  if (q === "min7b5") return "halfdim"
  if (q === "dim7") return "dim"
  if (q === "7alt" || q === "7b9") return "altered"
  if (q.startsWith("min")) return "minor"
  if (q.startsWith("maj") || q === "6/9" || q === "add9") return "major"
  return "dominant" // "7", "9", sus chords, and anything unrecognized
}

// ─── Level defs ─────────────────────────────────────────────────────────────

export function getLevelDefs() {
  return [
    { id: 0, name: "Chord scales",
      note: "The full seven-note scale behind each chord — chord tones solid, tensions hollow. This is the same scale DukeBox already recommends for it." },
    { id: 1, name: "Blues scale",
      note: "One minor pentatonic — off the tune's own tonic — blanketed over every chord, start to finish. Voice Leading ghosts each chord's own notes on top of it as the bar turns over, so you can see what's \"outside\" the box and what isn't." },
    { id: 2, name: "Minor",
      note: "Every chord gets a minor-family shape off its own root — Dorian by default, or minor pentatonic / minor hexatonic with the Shape filter below set to match. The 3rd glows green wherever the chord doesn't actually have one — lean into bending it." },
    { id: 3, name: "Major",
      note: "Every chord gets a major-family shape off its own root — Mixolydian by default, or major pentatonic / major hexatonic with the Shape filter below." },
    { id: 4, name: "Altered",
      note: "Same as Major, except any chord actually functioning as a dominant resolution swaps in the altered scale instead." },
  ]
}

// ─── Form classification ────────────────────────────────────────────────────

/**
 * Heuristic read of the loaded chart's form — the levels above no longer
 * branch on it, but it still names the tonic Level 1 blankets the whole
 * form with (tonicBar) and labels the song-form chip next to the level
 * buttons with something a player recognizes (blues vs standard vs a static
 * vamp), not to pin down a music-theory taxonomy. Reuses harmony.js's
 * cadence detection (the same engine driving the rest of the app's
 * chord-scale suggestions) rather than re-deriving cadence logic here.
 */
export function classifySongForm(bars) {
  const sounding = (bars || []).filter((b) => b && b.quality !== "NC")
  if (!sounding.length) {
    return { type: "modal", label: "No chart loaded", tonicBar: null }
  }

  const ctx = analyzeProgressionContext(bars)
  const cadenceCount = ctx.filter((c) => c.hasCadence).length
  const buckets = sounding.map((b) => bucketOf(b.quality))
  const tensionCount = buckets.filter((bk) => bk === "halfdim" || bk === "altered" || bk === "dim").length
  const dominantShare = buckets.filter((bk) => bk === "dominant").length / buckets.length
  const n = sounding.length
  const tonic = sounding[0]
  // "Is this thing major or minor" reads better as a vote across every major-
  // or minor-bucketed bar than as just the first bar's quality — plenty of
  // charts open on the ii (or a pickup) rather than the I.
  const majorVotes = buckets.filter((bk) => bk === "major").length
  const minorVotes = buckets.filter((bk) => bk === "minor").length
  const keyIsMinor = minorVotes > majorVotes

  // Very short dominant-only cycles — a 2- or 4-bar blues turnaround/vamp.
  if (n <= 4 && dominantShare === 1) {
    return { type: "blues-major", label: `Blues turnaround (${n}-bar)`, tonicBar: tonic }
  }

  // The blues family: mostly dominant-quality chords over a blues-typical
  // length (8-, 12-, and 16-bar forms and their common variants all land
  // here — the boundary is deliberately loose, not a strict 12-bar count).
  if (n >= 6 && n <= 16 && dominantShare >= 0.5) {
    if (tensionCount > 0 || cadenceCount >= 2) {
      return { type: "jazz-blues", label: `Jazz blues (${n}-bar)`, tonicBar: tonic }
    }
    return keyIsMinor
      ? { type: "blues-minor", label: `Minor blues (${n}-bar)`, tonicBar: tonic }
      : { type: "blues-major", label: `Blues (${n}-bar)`, tonicBar: tonic }
  }

  // Enough ii–V-family cadences relative to the chart's length to read as a
  // functional standard rather than a vamp.
  if (cadenceCount >= Math.max(2, Math.round(n / 6))) {
    return keyIsMinor
      ? { type: "standard-minor", label: "Minor standard", tonicBar: tonic }
      : { type: "standard-major", label: "Major standard", tonicBar: tonic }
  }

  return { type: "modal", label: "Modal / vamp", tonicBar: tonic }
}

// ─── Per-chord, per-level resolution ────────────────────────────────────────

// Buckets that genuinely have their own minor 3rd — nothing to bend when a
// minor-family shape lands there, so the tweakable-3rd highlight (Level 2)
// only fires outside this set (major, dominant, altered — the "worried"
// third's classic home).
const HAS_OWN_MINOR_THIRD = new Set(["minor", "halfdim"])

/**
 * Which shape (root + family + kind, or an explicit scale note list) Levels
 * 1–4 show for one bar. Level 0 doesn't call this — it always shows the
 * 7-note chord-scale board instead (see buildScaleBoard). `ctxEntry` is the
 * bars[index] entry from analyzeProgressionContext(bars) — the same
 * functional read (dominant / subdominant / tonic / cadence) already
 * driving the rest of the app. `density` is the Shape filter next to the
 * level buttons: "mode" (the level's 7-note mode) | "pentatonic" |
 * "hexatonic" — Level 1 ignores it (always minor pentatonic).
 */
export function resolvePentaChoice({ bar, ctxEntry, levelId, tonicBar, density = "mode" }) {
  const bucket = bucketOf(bar?.quality)
  const root = bar?.userTonic ?? bar?.root
  if (!root || bucket === "dim") {
    return {
      usable: false, kind: null, family: null, rootNote: null, scaleNoteList: null,
      why: bucket === "dim"
        ? "Diminished 7 doesn't sit in a major-or-minor pentatonic box — Level 0 shows the diminished scale instead."
        : "No chord to work from.",
      blueNote: false,
    }
  }

  // Level 1 — Blues scale: one minor pentatonic off the tune's own tonic,
  // the same shape on every single bar regardless of what that bar's own
  // chord actually is.
  if (levelId === 1) {
    if (!tonicBar) {
      return { usable: false, kind: null, family: null, rootNote: null, scaleNoteList: null, why: "No chart loaded.", blueNote: false }
    }
    const tRoot = tonicBar.userTonic ?? tonicBar.root
    return {
      usable: true, kind: "penta", family: "m", rootNote: tRoot, scaleNoteList: null,
      why: `${tRoot} minor pentatonic — blanketed over the whole form.`,
      blueNote: false,
    }
  }

  // Levels 2–4 — a forced family (minor / major) rooted at THIS chord's own
  // root, regardless of the chord's real quality. Level 4 swaps in the
  // altered scale over chords actually functioning as a dominant resolution.
  const isMinorFamily = levelId === 2
  const resolving = levelId === 4 && ctxEntry?.functionLabel === "dominant" && ctxEntry?.hasCadence
  const tweakThird = isMinorFamily && !HAS_OWN_MINOR_THIRD.has(bucket)

  if (resolving) {
    return {
      usable: true, kind: "scale", family: "M", rootNote: root,
      scaleNoteList: scaleNotes("altered", root),
      why: `${root} altered — resolving dominant.`,
      blueNote: false,
    }
  }

  if (density === "pentatonic") {
    return {
      usable: true, kind: "penta", family: isMinorFamily ? "m" : "M", rootNote: root, scaleNoteList: null,
      why: `${root} ${isMinorFamily ? "minor" : "major"} pentatonic.`,
      blueNote: tweakThird,
    }
  }
  if (density === "hexatonic") {
    return {
      usable: true, kind: "scale", family: isMinorFamily ? "m" : "M", rootNote: root,
      scaleNoteList: fretFlowScaleNotes(isMinorFamily ? "hex:minor" : "hex:major", root),
      why: `${root} ${isMinorFamily ? "minor" : "major"} hexatonic.`,
      blueNote: tweakThird,
    }
  }
  const modeName = isMinorFamily ? "dorian" : "mixolydian"
  return {
    usable: true, kind: "scale", family: isMinorFamily ? "m" : "M", rootNote: root,
    scaleNoteList: scaleNotes(modeName, root),
    why: `${root} ${isMinorFamily ? "Dorian" : "Mixolydian"}.`,
    blueNote: tweakThird,
  }
}

// ─── Voice leading into the 3:2 board ───────────────────────────────────────

/**
 * The 3rd of a chord symbol — same interval match tonal.js's guideTones()
 * and MelodyPaths.jsx's analyzeChord() use (3M/3m, or a sus chord's 2M/4P
 * stand-in), pulled out on its own because the 3:2 board's Voice Leading
 * route (Fretboard.js's threeTwo.voiceLeadTarget) aims at a single note
 * rather than the usual 3rd/7th guide-tone pair — a pentatonic shape doesn't
 * reliably contain the chord's 7th at all, so there's nothing to pair it with.
 */
export function chordThird(symbol) {
  if (!symbol) return null
  const { notes, intervals } = chordInfo(symbol)
  const idx = (intervals || []).findIndex(
    (iv) => iv === "3M" || iv === "3m" || iv === "2M" || iv === "4P"
  )
  return idx >= 0 ? (notes?.[idx] ?? null) : null
}

// ─── Fretboard geometry ─────────────────────────────────────────────────────
// Same degree/group maps as the reference page's PENTS (group "r" = the red
// pair, group "b" swapped for "blue" below to avoid clashing with the "r"/"b"
// shorthand's other meaning — colors are assigned at render time, not here).

const PENTA_IVS = {
  m: {
    0: { deg: "1", group: "red", root: true }, 3: { deg: "b3", group: "blue" },
    5: { deg: "4", group: "blue" }, 7: { deg: "5", group: "blue" }, 10: { deg: "b7", group: "red" },
  },
  M: {
    0: { deg: "1", group: "blue", root: true }, 2: { deg: "2", group: "blue" },
    4: { deg: "3", group: "blue" }, 7: { deg: "5", group: "red" }, 9: { deg: "6", group: "red" },
  },
}

export const PENTA_LEGEND = {
  m: [["red", "b7 – 1 pair"], ["blue", "b3 – 4 – 5 group"]],
  M: [["blue", "1 – 2 – 3 group"], ["red", "5 – 6 pair"]],
}

/**
 * Both the note cells and the translucent "highway" bands behind them, for
 * one pentatonic family rooted on one note — ported from the reference
 * page's buildBoard(): scan every fret on every string for scale-degree
 * matches (naturally tiling every octave, no manual position table needed),
 * then group consecutive same-color frets on a string into a band.
 */
export function buildPentaBoard({ rootNote, family, tuningName = "Standard", labelMode = "names", fretCount = FRETBOARD_FRETS, markBlueNote = false }) {
  const ivs = PENTA_IVS[family]
  const rootChroma = Note.chroma(rootNote)
  if (!ivs || rootChroma == null) return { cells: [], bandRuns: [] }

  const bySt = new Map()
  fretPositions(tuningName).forEach((p) => {
    if (p.f > fretCount) return
    if (!bySt.has(p.si)) bySt.set(p.si, [])
    bySt.get(p.si).push(p)
  })

  const cells = [], bandRuns = []
  bySt.forEach((positions, si) => {
    positions.sort((a, b) => a.f - b.f)
    let run = null
    positions.forEach((p) => {
      const iv = ((Note.chroma(p.note) - rootChroma) % 12 + 12) % 12
      const def = ivs[iv]
      if (!def) return
      cells.push({
        si, f: p.f, group: def.group, isRoot: !!def.root,
        noteName: p.note, text: labelMode === "degrees" ? def.deg : p.note,
        // The b3 of a minor pentatonic chased onto a dominant chord's own
        // root — the blue note, called out so the player leans into
        // bending/tweaking it rather than reading it as a plain color tone.
        isBlueNote: markBlueNote && family === "m" && iv === 3,
      })
      if (run && run.group === def.group && p.f - run.lastF <= 4) {
        run.toF = p.f; run.lastF = p.f
      } else {
        run = { si, group: def.group, fromF: p.f, toF: p.f, lastF: p.f }
        bandRuns.push(run)
      }
    })
  })

  return { cells, bandRuns: bandRuns.map(({ si, group, fromF, toF }) => ({ si, group, fromF, toF })) }
}

// Transposition-invariant degree labels, same table Fretboard.js uses for its
// own "degrees" label mode — duplicated locally rather than exported from
// there, since it's three lines and pulling it across the module boundary
// isn't worth the coupling.
const DEGREE_NAMES = ["1", "b9", "9", "b3", "3", "11", "#11", "5", "b13", "13", "b7", "7"]

/**
 * A tiered board — root / chord-tone / tension, the reference page's red /
 * blue / white-outline coloring — for an EXPLICIT scale note list draped
 * over an explicit chord. Generalizes what used to be buildScaleBoard's own
 * body: Level 0 still picks its scale straight from the chord's own quality
 * (see buildScaleBoard below), but Levels 2–4's Mode/Hexatonic density drape
 * a forced-family scale (Dorian, Mixolydian, altered, a hexatonic reduction)
 * over a chord that doesn't necessarily belong to that family at all, so
 * they need to pass their own note list in rather than have one derived
 * from the chord's real quality.
 *
 * `markThirdDegree`, when set, colors the b3 (3 semitones above root) green
 * instead of its usual tier — Level 2's tweakable 3rd, a deliberately bent
 * note against a chord that doesn't actually have a minor 3rd. Level 0 never
 * sets this.
 */
export function buildScaleBoardFromNotes({ rootNote, scaleNoteList, chordSymbol, tuningName = "Standard", labelMode = "names", fretCount = FRETBOARD_FRETS, markThirdDegree = false }) {
  const rootChroma = Note.chroma(rootNote)
  if (rootChroma == null || !scaleNoteList?.length) return { cells: [] }

  const scaleChromas = new Set(scaleNoteList.map((n) => Note.chroma(n)).filter((c) => c != null))
  const chordChromas = new Set(
    (chordSymbol ? chordNotes(chordSymbol) : []).map((n) => Note.chroma(n)).filter((c) => c != null)
  )
  const thirdChroma = (rootChroma + 3) % 12

  const cells = []
  fretPositions(tuningName).forEach((p) => {
    if (p.f > fretCount) return
    const c = Note.chroma(p.note)
    if (c == null || !scaleChromas.has(c)) return
    const tier = c === rootChroma ? "root" : chordChromas.has(c) ? "chord" : "tension"
    const degree = DEGREE_NAMES[((c - rootChroma) % 12 + 12) % 12]
    cells.push({
      si: p.si, f: p.f, tier, noteName: p.note, text: labelMode === "degrees" ? degree : p.note,
      isTweakThird: markThirdDegree && c === thirdChroma,
    })
  })

  return { cells }
}

/**
 * Level 0's 7-note board: the chord's recommended parent scale (the same
 * pick getRecommendedScalesFromQuality already hands the rest of the app),
 * tiered by buildScaleBoardFromNotes above.
 */
export function buildScaleBoard({ rootNote, quality, tuningName = "Standard", labelMode = "names", fretCount = FRETBOARD_FRETS }) {
  const scaleName = getRecommendedScalesFromQuality(quality)[0]
  if (!scaleName) return { scaleName, cells: [] }
  const { cells } = buildScaleBoardFromNotes({
    rootNote, scaleNoteList: scaleNotes(scaleName, rootNote),
    chordSymbol: buildChordSymbol(rootNote, quality),
    tuningName, labelMode, fretCount,
  })
  return { scaleName, cells }
}
