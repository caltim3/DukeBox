// Scale Pathways — the ranked-ladder chord-scale engine.
//
// Spec of record: docs/SCALE_PATHWAYS.md (the Scale-Pathway Playbook). The
// idea in one line: for the loaded chart there are several coherent ways
// through the changes, ranked foundational → colorful, and the player climbs
// that ladder as ONE GLOBAL RUNG with per-bar overrides — not a per-chord
// scale puzzle re-decided every bar.
//
//   1 · Key Center   — one parent collection per harmonic window, heard as
//                      modes of the current chord (D Dorian / G Mixolydian /
//                      C Ionian are the same seven notes).
//   2 · Guide Tones  — arpeggios and 3rd/7th voice leading; a VIEW (the
//                      board's chord view), not a scale.
//   3 · Pentatonic   — the pentatonic/blues route; open, fewer avoid notes.
//   4 · Bebop        — bebop scales and chromatic-approach vocabulary.
//   5 · Color        — symbol- and resolution-specific dominant color
//                      (altered / Phrygian dominant / Lydian dominant /
//                      half-whole diminished), chosen by the decision tree.
//
// The playbook's most important rule is enforced at every rung: THE WRITTEN
// CHORD SYMBOL OUTRANKS THE GENERIC PROGRESSION. G7alt gets the altered
// scale even on the Key Center rung; maj7#11 gets Lydian everywhere. And a
// bar's own userScale/userTonic override outranks everything — that is the
// "per-chord override" half of the design, and it reuses the exact fields
// the rest of the app already honors.
//
// Deliberately NOT imported here: threeTwoSystem.js (it pulls in the
// Fretboard component, which would drag JSX into this pure-logic module) —
// the small blues/tonic form read below is re-derived from the same
// thresholds instead.

import { Note, Interval } from "@tonaljs/tonal"
import { scaleNotes, chordNotes, buildChordSymbol } from "@/lib/music/tonal"
import { detectCadenceAt } from "@/lib/music/harmony"

// ─── Rung definitions ───────────────────────────────────────────────────────

export const PATHWAY_RUNGS = [
  { id: 1, name: "Key Center",
    note: "One parent collection per harmonic window — the chords are heard through targets, not scale changes. Blues forms blanket the tonic minor-blues scale instead." },
  { id: 2, name: "Guide Tones",
    note: "Arpeggios and 3rd/7th voice leading — the changes are audible with very few notes. This rung shows chord tones, not a scale." },
  { id: 3, name: "Pentatonic",
    note: "The pentatonic/blues route — open intervals, fewer avoid-note problems. Dominants get the dominant pentatonic (1 2 3 5 b7), never the major pentatonic that omits the b7." },
  { id: 4, name: "Bebop",
    note: "Bebop scales and chromatic approaches — propulsive eighth-note language. The added chromatic is a rhythmic device, not just an eighth note." },
  { id: 5, name: "Color",
    note: "Symbol-specific dominant color — altered on resolving dominants, Phrygian dominant into minor, Lydian dominant on backdoor/tritone-sub/static dominants, chosen by the suffix and the resolution." },
]

export const DEFAULT_PATHWAY_RUNG = 1

// ─── Small quality taxonomies ───────────────────────────────────────────────
// Mirrors harmony.js's private helpers; duplicated because they're one-liners
// and harmony.js deliberately doesn't export them.

const MAJOR_QUALITIES = new Set(["maj7", "maj6", "maj", "maj9", "6/9", "add9", "maj7#11"])
const MINOR_QUALITIES = new Set(["min7", "min6", "min", "min9", "min6/9", "minadd9", "min(maj7)"])
const DOM_QUALITIES   = new Set(["7", "9", "7b9", "7alt", "sus4", "7sus4"])
const SUS_QUALITIES   = new Set(["sus4", "7sus4"])

const isMajor = (q) => MAJOR_QUALITIES.has(q)
const isMinor = (q) => MINOR_QUALITIES.has(q)
const isDom   = (q) => DOM_QUALITIES.has(q)
const isSus   = (q) => SUS_QUALITIES.has(q)

function soundingRoot(bar) {
  return bar?.userTonic ?? bar?.root ?? null
}

function isSounding(bar) {
  return !!bar && bar.quality !== "NC" && !!soundingRoot(bar)
}

// Transpose a root by semitones, avoiding double accidentals — pathway tonics
// (relative major, the 9 of a maj7#11, the 5 of a sus chord) should read like
// chart spellings, not like Note.transpose's F## moments.
function up(root, semitones) {
  const t = Note.simplify(Note.transpose(root, Interval.fromSemitones(semitones)))
  return t && t.length > 2 ? Note.enharmonic(t) : t
}

function motionBetween(fromRoot, toRoot) {
  const a = Note.chroma(fromRoot)
  const b = Note.chroma(toRoot)
  if (a == null || b == null) return null
  return (b - a + 12) % 12
}

// ─── Form read ──────────────────────────────────────────────────────────────

/**
 * The whole-chart read the ladder branches on: is this a blues (so rung 1
 * blankets the tonic blues scale), and what's the key center for diatonic
 * routing? Thresholds match threeTwoSystem.js's classifySongForm — a mostly-
 * dominant 6-to-16-bar form reads as blues — without importing it (see the
 * header comment).
 */
export function classifyPathwayForm(bars) {
  const sounding = (bars || []).filter(isSounding)
  if (!sounding.length) {
    return { type: "empty", isBlues: false, keyRoot: null, keyIsMinor: false, label: "No chart loaded" }
  }

  const n = sounding.length
  const dominantShare = sounding.filter((b) => isDom(b.quality)).length / n
  const minorVotes = sounding.filter((b) => isMinor(b.quality)).length
  const majorVotes = sounding.filter((b) => isMajor(b.quality)).length
  const tonic = sounding[0]
  const keyRoot = soundingRoot(tonic)
  // The opening chord is the best witness for the key's quality — a dominant
  // tonic (a blues I7) reads major, and only a chart that opens on something
  // ambiguous falls back to the majority vote.
  const keyIsMinor = isMinor(tonic.quality)
    || (!isMajor(tonic.quality) && !isDom(tonic.quality) && minorVotes > majorVotes)

  const isBlues = (n >= 2 && n <= 4 && dominantShare === 1) || (n >= 6 && n <= 16 && dominantShare >= 0.5)
  return {
    type: isBlues ? (keyIsMinor ? "blues-minor" : "blues-major") : "functional",
    isBlues, keyRoot, keyIsMinor,
    label: isBlues ? `${keyIsMinor ? "Minor blues" : "Blues"} in ${keyRoot}` : `Key of ${keyRoot}${keyIsMinor ? " minor" : ""}`,
  }
}

// ─── Cadence windows ────────────────────────────────────────────────────────
// Rung 1 thinks in windows, not bars: a local ii-V-I is ONE major collection,
// a iiø-V-i is ONE harmonic-minor collection. harmony.js's detectCadenceAt
// already finds the windows; here each member bar learns its role in one.
// Longer cadences claim their bars first, so the V of a ii-V-I doesn't get
// re-read as a bare V-I.

const CADENCE_ROLES = {
  "ii–V–I":       ["ii", "V", "I"],
  "iiø–V–i":      ["iiø", "V", "i"],
  "V–I":          ["V", "I"],
  "V–i":          ["V", "i"],
  "ii–V fragment": ["ii", "V"],
}

function buildCadenceWindows(bars) {
  const found = []
  for (let i = 0; i < bars.length; i += 1) {
    const c = detectCadenceAt(bars, i)
    if (c) found.push(c)
  }
  found.sort((a, b) => b.bars.length - a.bars.length)

  const byBar = new Array(bars.length).fill(null)
  for (const c of found) {
    if (c.bars.some((i) => byBar[i])) continue
    const roles = CADENCE_ROLES[c.type]
    if (!roles) continue
    const lastBar = bars[c.bars[c.bars.length - 1]]
    // A fragment has no I on the page — its implied tonic sits a fifth below
    // the V, which is where the parent collection comes from anyway.
    const target = c.type === "ii–V fragment"
      ? up(soundingRoot(bars[c.bars[1]]), 5)
      : soundingRoot(lastBar)
    const minorTarget = c.type === "iiø–V–i" || c.type === "V–i"
    c.bars.forEach((barIndex, k) => {
      byBar[barIndex] = { type: c.type, role: roles[k], target, minorTarget }
    })
  }
  return byBar
}

// ─── Dominant resolution read ───────────────────────────────────────────────

/**
 * What THIS dominant is doing, read from where its root goes next. The chart
 * loops, so the last bar resolves into the first — that's how a blues
 * turnaround V7 knows it's a resolving dominant.
 */
function dominantContext(bars, index) {
  const bar = bars[index]
  const root = soundingRoot(bar)
  let next = null
  for (let step = 1; step <= bars.length; step += 1) {
    const candidate = bars[(index + step) % bars.length]
    if (candidate === bar && bars.length === 1) break
    if (isSounding(candidate)) { next = candidate; break }
  }
  if (!next || next === bar) return { kind: "static", next: null }

  const motion = motionBetween(root, soundingRoot(next))
  if (motion === 0) return { kind: "static", next }
  if (motion === 5 && isMinor(next.quality)) return { kind: "resolves-minor", next }
  if (motion === 5) return { kind: "resolves-major", next }
  if (motion === 11) return { kind: "tritone-sub", next }
  // The backdoor bVII7 lands a whole step up on a major tonic (Bb7 → Cmaj7).
  // (harmony.js's detectLocalFunction currently labels motion 1 "backdoor";
  // musically the backdoor is motion 2, which is what's tested for here.)
  if (motion === 2 && isMajor(next.quality)) return { kind: "backdoor", next }
  return { kind: "static", next }
}

// ─── The written symbol outranks the progression ────────────────────────────

/**
 * Symbols that demand a specific collection no matter which rung is up.
 * `hard` ones win even over a blues blanket; the tonic-minor pair (m6,
 * m(maj7)) yields to the blanket on rung 1 — the blanket IS the blues rank-1
 * identity — but wins in functional contexts.
 */
function forcedBySymbol(bar, domCtx) {
  switch (bar.quality) {
    case "7alt":
      return { hard: true, scaleName: "altered", why: "the symbol says altered — from melodic minor a half step up" }
    case "7b9":
      return domCtx?.kind === "resolves-minor"
        ? { hard: true, scaleName: "phrygian dominant", why: "b9 resolving to minor — the classic minor-key V, from the target's harmonic minor" }
        : { hard: true, scaleName: "half-whole diminished", why: "b9 with a natural 13 — half-whole diminished" }
    case "dim7":
      return { hard: true, scaleName: "diminished", why: "whole-half diminished from the chord root" }
    case "maj7#11":
      return { hard: true, scaleName: "lydian", why: "the chord explicitly wants the #11" }
    case "min6":
    case "min6/9":
      return { hard: false, scaleName: "melodic minor", why: "the natural 6 is structural — melodic minor (Dorian also works)" }
    case "min(maj7)":
      return { hard: false, scaleName: "melodic minor", why: "the maj7 is structural — melodic minor" }
    default:
      return null
  }
}

// ─── Per-rung, per-bar resolution ───────────────────────────────────────────

const MAJOR_MODE_BY_OFFSET = {
  0: "major", 2: "dorian", 4: "phrygian", 5: "lydian",
  7: "mixolydian", 9: "aeolian", 11: "locrian",
}

// 1 2 3 5 b7 — the playbook's dominant pentatonic. Tonal has no name for it,
// so it's the one collection built by hand; the major pentatonic's missing b7
// (and a guitarist's instinctive natural 7 on top of it) is exactly the trap
// the playbook warns about.
function dominantPentatonic(root) {
  return ["1P", "2M", "3M", "5P", "7m"].map((iv) => Note.simplify(Note.transpose(root, iv)))
}

function choice({ scaleName = null, label = null, tonic, notes = null, view = "scale", why, source }) {
  const resolvedNotes = notes ?? (scaleName && tonic ? scaleNotes(scaleName, tonic) : [])
  return {
    usable: resolvedNotes.length > 0 || view === "chord",
    view,
    scaleName,
    label: label ?? scaleName,
    tonic,
    notes: resolvedNotes,
    why,
    source,
  }
}

function keyCenterChoice(bar, root, cadence, form) {
  // Inside a cadence window, the window's parent collection names the mode.
  if (cadence) {
    // A V sitting a half step above its target is a tritone sub — its scale
    // isn't a mode of the target's collection at all, and Lydian dominant is
    // the standard read (Db Lydian dominant into C keeps the shared tritone).
    if (cadence.role === "V" && motionBetween(root, cadence.target) === 11) {
      return choice({
        scaleName: "lydian dominant", tonic: root, source: "cadence",
        why: `tritone sub resolving to ${cadence.target} — Lydian dominant keeps the shared tritone and adds the #11`,
      })
    }
    if (cadence.minorTarget) {
      const scaleName = cadence.role === "iiø" ? "locrian 6"
        : cadence.role === "V" ? "phrygian dominant"
        : "harmonic minor"
      return choice({
        scaleName, tonic: root, source: "cadence",
        why: `${cadence.role} of ${cadence.target} minor — one ${cadence.target} harmonic-minor collection across the cadence`,
      })
    }
    const scaleName = cadence.role === "ii" ? "dorian" : cadence.role === "V" ? "mixolydian" : "major"
    return choice({
      scaleName, tonic: root, source: "cadence",
      why: `${cadence.role} of ${cadence.target} — one ${cadence.target} major collection across the cadence`,
    })
  }

  // Diatonic to the global key → the mode of that key from this root.
  if (form.keyRoot) {
    const collectionRoot = form.keyIsMinor ? up(form.keyRoot, 3) : form.keyRoot
    const collection = new Set(scaleNotes("major", collectionRoot).map((n) => Note.chroma(n)))
    const offset = motionBetween(collectionRoot, root)
    const mode = offset != null ? MAJOR_MODE_BY_OFFSET[offset] : null
    if (mode) {
      const symbol = bar.symbol || buildChordSymbol(root, bar.quality)
      const inKey = chordNotes(symbol).every((n) => collection.has(Note.chroma(n)))
      if (inKey) {
        return choice({
          scaleName: mode, tonic: root, source: "key",
          why: `diatonic to ${form.keyRoot}${form.keyIsMinor ? " minor" : ""} — same collection, this chord's mode`,
        })
      }
    }
  }

  // Off-key chord with no window: the plainest scale its own quality asks for.
  const fallback = isMajor(bar.quality) ? "major"
    : isMinor(bar.quality) ? "dorian"
    : bar.quality === "min7b5" ? "locrian #2"
    : isDom(bar.quality) ? "mixolydian"
    : "mixolydian"
  return choice({
    scaleName: fallback, tonic: root, source: "quality",
    why: "outside the key and any cadence — the chord's own plainest scale",
  })
}

function pentatonicChoice(bar, root, cadence, form) {
  const q = bar.quality
  if (q === "maj7#11") {
    const t = up(root, 2)
    return choice({
      scaleName: "major pentatonic", tonic: t, source: "symbol",
      why: `${t} major pentatonic over ${root}maj7#11 — 9, 3, #11, 13 and 7, no avoid notes`,
    })
  }
  if (q === "min6" || q === "min6/9" || q === "min(maj7)") {
    return choice({ scaleName: "minor six pentatonic", tonic: root, source: "symbol", why: "minor pentatonic with the structural natural 6" })
  }
  if (isSus(q)) {
    const t = up(root, 7)
    return choice({
      scaleName: "minor pentatonic", tonic: t, source: "quality",
      why: `${t} minor pentatonic over the sus — 5, b7, 1, 9, 11, with the 3rd left out of the way`,
    })
  }
  if (q === "min7b5") {
    if (cadence?.minorTarget) {
      return choice({
        scaleName: "minor pentatonic", tonic: cadence.target, source: "cadence",
        why: `${cadence.target} minor pentatonic across the whole minor cadence — target the b5 by ear`,
      })
    }
    return choice({ scaleName: "locrian #2", tonic: root, source: "quality", why: "no clean pentatonic for ø7 — Locrian ♮2 instead" })
  }
  if (isDom(q)) {
    // On a blues I7 the sweeter rank-2 blend leads; every other dominant
    // states its quality with the dominant pentatonic.
    if (form.isBlues && !form.keyIsMinor && Note.chroma(root) === Note.chroma(form.keyRoot)) {
      return choice({
        scaleName: "major blues", tonic: root, source: "form",
        why: "the I7 — major blues, blended with the tonic minor-blues language by ear",
      })
    }
    return choice({
      label: "dominant pentatonic", tonic: root, notes: dominantPentatonic(root), source: "quality",
      why: "1 2 3 5 b7 — the pentatonic that still states the b7 (major pentatonic omits it)",
    })
  }
  if (isMinor(q)) {
    return choice({ scaleName: "minor pentatonic", tonic: root, source: "quality", why: "the minor pentatonic — open and hard to overplay" })
  }
  if (isMajor(q)) {
    return choice({ scaleName: "major pentatonic", tonic: root, source: "quality", why: "the major pentatonic — sweet and avoid-note free" })
  }
  return keyCenterChoice(bar, root, cadence, form)
}

function bebopChoice(bar, root, cadence, form) {
  const q = bar.quality
  if (isDom(q) && !isSus(q)) {
    return choice({ scaleName: "bebop", tonic: root, source: "quality", why: "dominant bebop — the natural 7 passes between root and b7" })
  }
  if (isSus(q)) {
    return choice({ scaleName: "mixolydian", tonic: root, source: "quality", why: "Mixolydian with the 4 emphasized — the 3rd stays a resolution, not a starting identity" })
  }
  if (isMajor(q)) {
    return choice({ scaleName: "bebop major", tonic: root, source: "quality", why: "major bebop — the #5 passes inside the sixth-diminished sound" })
  }
  if (q === "min6" || q === "min6/9" || q === "min(maj7)") {
    return choice({ scaleName: "melodic minor", tonic: root, source: "quality", why: "tonic-minor bebop vocabulary lives in melodic minor" })
  }
  if (isMinor(q)) {
    return choice({ scaleName: "bebop minor", tonic: root, source: "quality", why: "Dorian plus the chromatic major 3 — Barry's minor bebop sound" })
  }
  if (q === "min7b5") {
    return choice({ scaleName: "locrian #2", tonic: root, source: "quality", why: "Locrian ♮2 with chromatic approaches — or run the ø7 arpeggio" })
  }
  return keyCenterChoice(bar, root, cadence, form)
}

function colorChoice(bar, root, cadence, form, domCtx) {
  const q = bar.quality
  if (isDom(q) && !isSus(q)) {
    switch (domCtx.kind) {
      case "resolves-major":
        return choice({ scaleName: "altered", tonic: root, source: "resolution", why: "a resolving dominant — maximum V-to-I tension, released into the next bar" })
      case "resolves-minor":
        return choice({ scaleName: "phrygian dominant", tonic: root, source: "resolution", why: "resolving to minor — b9 and b13 from the target's harmonic minor" })
      case "backdoor":
        return choice({ scaleName: "lydian dominant", tonic: root, source: "resolution", why: "backdoor bVII7 — the #11 is the smooth modern color into the major tonic" })
      case "tritone-sub":
        return choice({ scaleName: "lydian dominant", tonic: root, source: "resolution", why: "tritone sub — Lydian dominant keeps the shared tritone and adds the #11" })
      default:
        // A blues' non-resolving dominants keep the blues identity even on
        // the color rung — state the 3rd, save the alterations for the
        // dominants that actually go somewhere (the playbook's rank 5).
        return form.isBlues
          ? choice({ scaleName: "mixolydian", tonic: root, source: "form", why: "a blues dominant that isn't resolving — state the 3rd, keep the blues language, save the color for the turnaround" })
          : choice({ scaleName: "lydian dominant", tonic: root, source: "resolution", why: "a non-resolving dominant — the #11 colors without demanding resolution" })
    }
  }
  if (isSus(q)) {
    return choice({ scaleName: "mixolydian", tonic: root, source: "quality", why: "sus stays sus — color it with quartal cells, not alterations" })
  }
  if (isMajor(q)) {
    return choice({ scaleName: "lydian", tonic: root, source: "quality", why: "the #11 as deliberate tonic color — drop back to Ionian if the melody insists on the natural 4" })
  }
  if (isMinor(q)) {
    const isTonicMinor = form.keyIsMinor && form.keyRoot && Note.chroma(root) === Note.chroma(form.keyRoot)
    return isTonicMinor
      ? choice({ scaleName: "melodic minor", tonic: root, source: "quality", why: "modern tonic-minor color — natural 6 and 7 over the minor tonic" })
      : choice({ scaleName: "dorian", tonic: root, source: "quality", why: "a ii stays Dorian — the color belongs to the dominant next door" })
  }
  if (q === "min7b5") {
    return choice({ scaleName: "locrian #2", tonic: root, source: "quality", why: "Locrian ♮2 — the natural 9 is the modern ø7 color" })
  }
  return keyCenterChoice(bar, root, cadence, form)
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * The whole chart, resolved at one global rung. Per-bar precedence:
 *
 *   userScale/userTonic override  >  written-symbol demand  >
 *   blues blanket (rung 1)        >  the rung's own logic
 *
 * @param {Array} bars    the chart's bars ({root, quality, symbol?, userScale?, userTonic?})
 * @param {number} rungId 1–5, see PATHWAY_RUNGS
 * @returns {{ rung, form, choices }} choices[i] = {usable, view, scaleName,
 *   label, tonic, notes, why, source} — notes are always materialized, view
 *   is "chord" on the Guide Tones rung, source says which rule fired.
 */
export function resolvePathwayPlan(bars, rungId = DEFAULT_PATHWAY_RUNG) {
  const rung = PATHWAY_RUNGS.find((r) => r.id === rungId) ?? PATHWAY_RUNGS[0]
  const form = classifyPathwayForm(bars)
  const windows = buildCadenceWindows(bars || [])

  // A chart that ENDS by cadencing somewhere knows its key better than the
  // opening-bar guess does — a bare ii-V-I snippet opens on the ii, and
  // reading it as "key of D minor" would poison the diatonic fallback and
  // the tonic-minor checks.
  for (let i = (bars?.length ?? 0) - 1; i >= 0; i -= 1) {
    if (!isSounding(bars[i])) continue
    const w = windows[i]
    if (w && (w.role === "I" || w.role === "i")) {
      form.keyRoot = w.target
      form.keyIsMinor = w.minorTarget
      if (!form.isBlues) form.label = `Key of ${form.keyRoot}${form.keyIsMinor ? " minor" : ""}`
    }
    break
  }

  const choices = (bars || []).map((bar, index) => {
    if (!isSounding(bar)) {
      return { usable: false, view: "scale", scaleName: null, label: null, tonic: null, notes: [], why: "No chord in this bar.", source: "none" }
    }
    const root = soundingRoot(bar)

    // The player's own pick for this bar beats every rule on every rung.
    if (bar.userScale) {
      return choice({
        scaleName: bar.userScale, tonic: bar.userTonic ?? bar.root, source: "override",
        why: "your pick for this bar",
      })
    }

    // Guide Tones is a view, not a scale — every bar shows its own arpeggio.
    if (rung.id === 2) {
      const symbol = bar.symbol || buildChordSymbol(root, bar.quality)
      return choice({
        view: "chord", label: "chord tones", tonic: root, notes: chordNotes(symbol), source: "quality",
        why: "arpeggio and guide tones — aim for the 3rd and 7th",
      })
    }

    const cadence = windows[index]
    const domCtx = isDom(bar.quality) ? dominantContext(bars, index) : null

    // Written tensions outrank the generic progression — with two carve-outs:
    // the blues blanket on rung 1 absorbs the soft (tonic-minor) demands but
    // never the hard ones (alt / b9 / dim7 / #11), and the Pentatonic rung
    // supplies its own five-note answers to the soft symbols (minor-six
    // pentatonic, the maj7#11 trick) so only hard demands pierce it.
    const forced = forcedBySymbol(bar, domCtx)
    const softYields = (rung.id === 1 && form.isBlues) || rung.id === 3
    if (forced && (forced.hard || !softYields)) {
      return choice({ scaleName: forced.scaleName, tonic: root, source: "symbol", why: forced.why })
    }

    if (rung.id === 1 && form.isBlues) {
      return choice({
        scaleName: "minor blues", tonic: form.keyRoot, source: "form",
        why: `${form.keyRoot} minor blues, blanketed over the whole form — the b3 against the I7's natural 3 is the central blues tension`,
      })
    }

    switch (rung.id) {
      case 3: return pentatonicChoice(bar, root, cadence, form)
      case 4: return bebopChoice(bar, root, cadence, form)
      case 5: return colorChoice(bar, root, cadence, form, domCtx)
      case 1:
      default: return keyCenterChoice(bar, root, cadence, form)
    }
  })

  return { rung, form, choices }
}
