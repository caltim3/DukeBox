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
// Levels (matching the reference page's own "Chord scales / Inside / Color /
// Altered" ladder, generalized to any chord instead of four rehearsed ones):
//   0 — Chord scales: the full 7-note recommended scale, root/chord-tone/
//       tension colored. Same primary scale getRecommendedScalesFromQuality
//       already hands the rest of the app for this chord.
//   1 — Home base (blues forms) or Inside (everything else): one pentatonic
//       per chord, or a single blanket pentatonic over the whole form for
//       blues, where that's how the reference page teaches it.
//   2 — Chase the chord (blues) or Color (everything else): color choices —
//       the chord's own root pentatonic for blues forms that started on a
//       blanket, or the "off the 5th / off the 3rd" upper-structure trick
//       everywhere else.
//   3 — Altered: chords pulling hard into the next one (a resolving V7, a
//       half-diminished) get the b3-up pentatonic trick that spells the
//       altered/half-diminished sound in one shape; everything else keeps
//       its Level 2 color choice.

import { Note, Interval } from "@tonaljs/tonal"
import { fretPositions, FRETBOARD_FRETS } from "@/components/Fretboard"
import { getRecommendedScalesFromQuality, scaleNotes, chordNotes, buildChordSymbol } from "@/lib/music/tonal"
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

function up(note, semitones) {
  return Note.simplify(Note.transpose(note, Interval.fromSemitones(semitones)))
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

const BLUES_TYPES = new Set(["blues-major", "blues-minor", "jazz-blues"])

export function getLevelDefs(formType) {
  const bluesy = BLUES_TYPES.has(formType)
  return [
    { id: 0, name: "Chord scales",
      note: "The full seven-note scale behind each chord — chord tones solid, tensions hollow. This is the same scale DukeBox already recommends for it; Levels 1–3 are the five-note heart of it, moved around." },
    { id: 1, name: bluesy ? "Home base" : "Inside",
      note: bluesy
        ? "One pentatonic — the I chord's own — blanketed over the whole form. Simple, and it always works; everything past this level is optional color."
        : "Each chord gets its own matching pentatonic. Through a diatonic run like a ii–V–I these are usually the same five notes anyway, so the shape barely moves." },
    { id: 2, name: bluesy ? "Chase the chord" : "Color",
      note: bluesy
        ? "Each chord's own root pentatonic instead of the blanket — same fingering, sliding to meet the chord as it changes."
        : "Pentatonic off the 5th (dominants and minors) or off the 3rd (major 7ths) instead of the root — same shape, aimed at the chord's upper structure." },
    { id: 3, name: bluesy ? "Altered turnarounds" : "Altered",
      note: "Chords pulling hard into the next one — a resolving V7, a half-diminished — get the b3-up pentatonic trick, which spells the altered/half-diminished sound in one shape. Everything else keeps its Level 2 color." },
  ]
}

// ─── Form classification ────────────────────────────────────────────────────

/**
 * Heuristic read of the loaded chart's form — enough to pick which of the
 * four levels above is "home base" vs "color," and to label the toggle with
 * something a player recognizes (blues vs standard vs a static vamp), not to
 * pin down a music-theory taxonomy. Reuses harmony.js's cadence detection
 * (the same engine driving the rest of the app's chord-scale suggestions)
 * rather than re-deriving cadence logic here.
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

/**
 * Which pentatonic (root + family) Levels 1–3 show for one bar. Level 0
 * doesn't call this — it always shows the 7-note chord-scale board instead
 * (see buildScaleBoard). `ctxEntry` is the bars[index] entry from
 * analyzeProgressionContext(bars) — the same functional read (dominant /
 * subdominant / tonic / cadence) already driving the rest of the app.
 */
export function resolvePentaChoice({ bar, ctxEntry, levelId, formType, tonicBar }) {
  const bucket = bucketOf(bar?.quality)
  const root = bar?.userTonic ?? bar?.root
  if (!root || bucket === "dim") {
    return {
      usable: false, family: null, rootNote: null,
      why: bucket === "dim"
        ? "Diminished 7 doesn't sit in a major-or-minor pentatonic box — Level 0 shows the diminished scale instead."
        : "No chord to work from.",
    }
  }

  const bluesy = BLUES_TYPES.has(formType)

  function chase() {
    if (bucket === "major") {
      return { family: "M", rootNote: root, why: `${root} major pentatonic — the chord's own shape.` }
    }
    if (bucket === "halfdim" || bucket === "altered") {
      const r = up(root, 3)
      return {
        family: "m", rootNote: r,
        why: `${r} minor pentatonic, a b3 above ${root} — spells the ${bucket === "halfdim" ? "half-diminished" : "altered"} sound in one shape.`,
      }
    }
    return { family: "m", rootNote: root, why: `${root} minor pentatonic — the chord's own shape.` }
  }

  function color() {
    if (bucket === "major") {
      const r = up(root, 4)
      return { family: "m", rootNote: r, why: `${r} minor pentatonic, a 3rd above ${root} — upper-structure color (3 5 6 7 9).` }
    }
    const r = up(root, 7)
    return { family: "m", rootNote: r, why: `${r} minor pentatonic, a 5th above ${root} — upper-structure color (5 b7 1 9 11).` }
  }

  function altered() {
    const resolving = ctxEntry?.functionLabel === "dominant" && ctxEntry?.hasCadence
    if (resolving || bucket === "halfdim" || bucket === "altered") {
      const r = up(root, 3)
      return { family: "m", rootNote: r, why: `${r} minor pentatonic, a b3 above ${root} — the altered/half-diminished trick.` }
    }
    return color()
  }

  if (levelId === 1 && bluesy && tonicBar) {
    const tb = bucketOf(tonicBar.quality)
    const tRoot = tonicBar.userTonic ?? tonicBar.root
    const family = tb === "major" ? "M" : "m"
    return {
      usable: true, family, rootNote: tRoot,
      why: `${tRoot} ${family === "M" ? "major" : "minor"} pentatonic — the I chord's shape, blanketed over the whole form.`,
    }
  }

  let choice
  if (levelId === 1) choice = chase()
  else if (levelId === 2) choice = bluesy ? chase() : color()
  else choice = altered()

  return { usable: true, ...choice }
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
export function buildPentaBoard({ rootNote, family, tuningName = "Standard", labelMode = "names", fretCount = FRETBOARD_FRETS }) {
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
 * Level 0's 7-note board: the chord's recommended parent scale (the same
 * pick getRecommendedScalesFromQuality already hands the rest of the app),
 * with root / chord-tone / tension tiers for the reference page's red / blue
 * / white-outline coloring.
 */
export function buildScaleBoard({ rootNote, quality, tuningName = "Standard", labelMode = "names", fretCount = FRETBOARD_FRETS }) {
  const rootChroma = Note.chroma(rootNote)
  const scaleName = getRecommendedScalesFromQuality(quality)[0]
  if (rootChroma == null || !scaleName) return { scaleName, cells: [] }

  const scaleChromas = new Set(scaleNotes(scaleName, rootNote).map((n) => Note.chroma(n)).filter((c) => c != null))
  const chordChromas = new Set(
    chordNotes(buildChordSymbol(rootNote, quality)).map((n) => Note.chroma(n)).filter((c) => c != null)
  )

  const cells = []
  fretPositions(tuningName).forEach((p) => {
    if (p.f > fretCount) return
    const c = Note.chroma(p.note)
    if (c == null || !scaleChromas.has(c)) return
    const tier = c === rootChroma ? "root" : chordChromas.has(c) ? "chord" : "tension"
    const degree = DEGREE_NAMES[((c - rootChroma) % 12 + 12) % 12]
    cells.push({ si: p.si, f: p.f, tier, noteName: p.note, text: labelMode === "degrees" ? degree : p.note })
  })

  return { scaleName, cells }
}
