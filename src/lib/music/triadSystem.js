// The Triad System — one repeatable improvisation method for every chord
// quality: a pair of minor triads (the harmony) played over a governing
// pentatonic backdrop (the connective tissue), with the pair chosen per bar
// from the chart's own harmonic analysis.
//
// Source doctrine: the "Triad System v0.9" interactive guide (Vincent's
// cells, Galper's landing rule, Martino's minor conversion). The guide only
// fully specifies dominants; the minor/major/half-diminished rows below
// complete it via the guide's own Chapter 5 "minor conversion" table, so
// every quality collapses into the same machinery:
//
//   dominant  Inside  (5th, 13th)   ·  Altered (♯9, ♭9 — travels, never vamps)
//   minor     Dorian  (root, 9th)   ·  single pair; tension comes from backdrop
//   major     Diatonic (9th, 3rd)   ·  Lydian (3rd, 7th — the 3-5-7-9-♯11 stack)
//   halfDim   Relative (♭3 up, then proceed as m7 — Martino's conversion)
//   dim7      none (symmetric — no natural pair; resolveTriadSystem returns null)
//
// Backdrops are three SLOTS per quality, not three fixed scales: the player
// picks a slot once and each bar's quality fills it with its own pentatonic,
// so the choice stays meaningful across a whole ii-V-I. Slot 0 is always the
// zero-rub "home" backdrop for the quality's inside pair.
//
// Everything here is pure pitch-class arithmetic on top of tonal.js's
// noteAtSemitones — no imports from UI, no chart state. page.js owns which
// bar/pair/slot is asked about.

import { noteAtSemitones } from "@/lib/music/tonal"

const MAJOR_PENT = [0, 2, 4, 7, 9]
const MINOR_PENT = [0, 3, 5, 7, 10]
const MINOR_TRIAD = [0, 3, 7]

// Same reading as Fretboard.js's DEGREES (b3 rather than #9 is wrong for the
// altered pair's pool, so 3 semitones reads #9 here — this table only ever
// describes tensions against a chord root, never a minor chord's own 3rd).
const DEG = ["1", "b9", "9", "#9", "3", "11", "#11", "5", "b13", "13", "b7", "7"]

// Quality buckets — the same groupings harmony.js's is*Quality helpers use
// (kept local: harmony.js doesn't export them, and this module stays pure).
const DOMINANT_QUALITIES = new Set(["7", "9", "7b9", "7alt", "7sus4", "sus4"])
const MINOR_QUALITIES = new Set(["min7", "min6", "min", "min9", "min6/9", "minadd9", "min(maj7)"])
const MAJOR_QUALITIES = new Set(["maj7", "maj6", "maj", "maj9", "6/9", "add9", "maj7#11"])

export function triadQualityFamily(quality) {
  if (DOMINANT_QUALITIES.has(quality)) return "dominant"
  if (MINOR_QUALITIES.has(quality)) return "minor"
  if (MAJOR_QUALITIES.has(quality)) return "major"
  if (quality === "min7b5") return "halfDim"
  return null // dim7 (symmetric), NC, unrecognized
}

// pairs[].offsets — semitone offsets from the chord root to the two minor
// triads' roots. pairs[].tension — an altered-class pair: it must travel
// (Galper's landing rule) rather than vamp; only the dominant Altered pair
// qualifies, per the guide ("only dominants resolve hard enough to pay for
// that much tension").
// contexts[] — the three backdrop slots, slot 0 = home.
const FAMILIES = {
  dominant: {
    pairs: [
      { id: "inside", label: "Inside", offsets: [7, 9], tension: false,
        blurb: "5·b7·9 + 13·R·3 — a 13th arpeggio in two halves. You can live here." },
      { id: "altered", label: "Altered", offsets: [3, 1], tension: true,
        blurb: "#9·#11·b7 + b9·3·b13 — every altered tension plus both guide tones. Travels, never vamps." },
    ],
    contexts: [
      { pent: MAJOR_PENT, off: 0, short: "Maj pent · root", blurb: "1 9 3 5 13 — global folk/pop consonance" },
      { pent: MINOR_PENT, off: 7, short: "Min pent · 5th", blurb: "5 b7 1 9 11 — Martino minor-conversion geometry" },
      { pent: MINOR_PENT, off: 0, short: "Min pent · root", blurb: "1 #9 11 5 b7 — the blues scale itself" },
    ],
  },
  minor: {
    pairs: [
      { id: "dorian", label: "Dorian", offsets: [0, 2], tension: false,
        blurb: "The classic Dorian pair — 1·b3·5 + 9·11·13. Tension comes from the backdrop, not the pair." },
    ],
    contexts: [
      { pent: MINOR_PENT, off: 0, short: "Min pent · root", blurb: "The minor home sound" },
      { pent: MINOR_PENT, off: 7, short: "Min pent · 5th", blurb: "Adds the 9 — one position up the Martino ladder" },
      { pent: MINOR_PENT, off: 2, short: "Min pent · 9th", blurb: "The full Dorian color — 9, 11, 13" },
    ],
  },
  major: {
    pairs: [
      { id: "diatonic", label: "Diatonic", offsets: [2, 4], tension: false,
        blurb: "The 9/3 pair — 9·11·13 + 3·5·7. The tame, singable default." },
      { id: "lydian", label: "Lydian", offsets: [4, 11], tension: false,
        blurb: "3·5·7 + 7·9·#11 — the maj13#11 upper structure. Bright, still home." },
    ],
    contexts: [
      { pent: MAJOR_PENT, off: 0, short: "Maj pent · root", blurb: "The major home sound" },
      { pent: MAJOR_PENT, off: 7, short: "Maj pent · 5th", blurb: "Adds the 7 and 9" },
      { pent: MAJOR_PENT, off: 2, short: "Maj pent · 9th", blurb: "The Lydian backdrop — 9, #11, 13" },
    ],
  },
  halfDim: {
    pairs: [
      { id: "relative", label: "Relative", offsets: [3, 5], tension: false,
        blurb: "Martino's conversion — the m7 a b3 up, played as its own Dorian pair. Zero new shapes." },
    ],
    contexts: [
      { pent: MINOR_PENT, off: 5, short: "Min pent · 11th", blurb: "Fully inside Locrian nat2 — the zero-rub home" },
      { pent: MINOR_PENT, off: 3, short: "Min pent · b3", blurb: "The relative minor's own pentatonic — adds the b9 color" },
      { pent: MINOR_PENT, off: 0, short: "Min pent · root", blurb: "The natural-5-vs-b5 bite — pass through, land on a guide tone" },
    ],
  },
}

// Which pair "Auto" reaches for, given the bar's role in the progression.
// ctxEntry is harmony.js's analyzeProgressionContext row for this bar — the
// same "is this dominant actually resolving" signal page.js's alteredMap and
// the 3:2 System's Level 4 already trust, so the three never disagree.
function autoPairId(family, quality, ctxEntry) {
  if (family === "dominant") {
    // hasCadence: a V-I / V-i / ii-V arrival detected around this bar (incl.
    // tritone subs). A resolving dominant earns the Altered pair; a static
    // blues I7/IV7 or modal vamp stays Inside — the Inside pair can vamp,
    // the Altered pair travels.
    return ctxEntry?.hasCadence ? "altered" : "inside"
  }
  if (family === "major") return quality === "maj7#11" ? "lydian" : "diatonic"
  return FAMILIES[family].pairs[0].id
}

// The 3rd of a chord by quality bucket — the Galper landing target. A sus
// chord's stand-in 3rd is its 4th's resolution, but for a landing hint the
// major 3rd reads right; dim7 lands on its b3.
function thirdOf(bar) {
  if (!bar?.root || bar.quality === "NC") return null
  const family = triadQualityFamily(bar.quality)
  const root = bar.userTonic ?? bar.root
  const minorish = family === "minor" || family === "halfDim" || bar.quality === "dim7"
  return noteAtSemitones(root, minorish ? 3 : 4)
}

/**
 * The one entry point. Returns null when the quality has no pair (dim7, NC),
 * otherwise everything the board and its controls need:
 *
 *   family, pair {id,label,tension,t1:{root,notes},t2:{root,notes}},
 *   autoPair (what "Auto" resolves to here), pairOptions, contextOptions,
 *   context {slot,short,tonic,notes}, poolNotes (union, degree-ordered),
 *   poolDegrees, rubs [[a,b]…], combo "home"|"tension"|"engine",
 *   landingNote/landingLabel (see landingPolicy), soloTriad, why.
 *
 * landingPolicy (routes — src/lib/music/triadRoutes.js — set it; manual use
 * always gets the default):
 *   "land"   — Galper's rule: a tension-class pair lands on the next
 *              chord's 3rd. The default, and the only policy that obeys.
 *   "rub"    — the first rub note IS the destination (Ribot: sit on it).
 *   "refuse" — stop a half step shy of the true landing and let it hang.
 * soloTriad (1|2|null) — light only that triad of the pair; the other's
 * tones fall back to backdrop coloring. The tres-style single-cell look.
 */
export function resolveTriadSystem({ root, quality, ctxEntry = null, nextBar = null, pairChoice = "auto", contextSlot = 0, landingPolicy = "land", soloTriad = null }) {
  const family = triadQualityFamily(quality)
  if (!family || !root) return null
  const def = FAMILIES[family]

  const autoPair = autoPairId(family, quality, ctxEntry)
  // A manual choice the current quality doesn't offer (e.g. "altered" carried
  // from a dominant bar onto a minor one) falls back to Auto — the chart
  // keeps playing, the choice re-applies when a matching quality returns.
  const pairDef = (pairChoice !== "auto" && def.pairs.find((p) => p.id === pairChoice))
    || def.pairs.find((p) => p.id === autoPair)
    || def.pairs[0]
  const slot = Math.min(Math.max(contextSlot, 0), def.contexts.length - 1)
  const ctxDef = def.contexts[slot]

  // Work in semitone offsets from the chord root; spell to names at the edges.
  const t1Offs = MINOR_TRIAD.map((s) => (pairDef.offsets[0] + s) % 12)
  const t2Offs = MINOR_TRIAD.map((s) => (pairDef.offsets[1] + s) % 12)
  const ctxOffs = ctxDef.pent.map((s) => (ctxDef.off + s) % 12)
  const pairOffs = new Set([...t1Offs, ...t2Offs])
  const ctxSet = new Set(ctxOffs)

  // Rub detection, straight from the guide: a context tone outside the pair
  // sitting a semitone from a pair tone. These are the "pass through, don't
  // sit" notes.
  const rubs = []
  ctxSet.forEach((off) => {
    if (pairOffs.has(off)) return
    ;[(off + 1) % 12, (off + 11) % 12].forEach((adj) => {
      if (pairOffs.has(adj)) rubs.push([off, adj])
    })
  })

  // Home/Tension/Engine follows the guide's matrix, not raw rub count — the
  // Inside×blues combo rubs on purpose and is still home ("the b3-vs-3 rub
  // is the feature"). Tension-class pair + the Martino backdrop (slot 1) is
  // the featured Engine move; tension-class anywhere else must resolve.
  const combo = !pairDef.tension ? "home" : slot === 1 ? "engine" : "tension"

  const spell = (off) => noteAtSemitones(root, off)
  const poolOffs = [...new Set([...pairOffs, ...ctxSet])].sort((a, b) => a - b)

  // The landing, per policy. rubs[0][0] is the first rub's CONTEXT note —
  // the outsider grinding against the pair — which is the one you'd sit on.
  let landingNote = null
  let landingLabel = null
  if (landingPolicy === "rub") {
    landingNote = rubs.length ? spell(rubs[0][0]) : null
    landingLabel = landingNote ? `sit on the rub — ${landingNote}` : null
  } else if (landingPolicy === "refuse") {
    const truth = thirdOf(nextBar)
    landingNote = truth ? noteAtSemitones(truth, -1) : null
    landingLabel = landingNote ? `stop on ${landingNote} — a half step shy of ${truth}; let it hang` : null
  } else if (pairDef.tension) {
    landingNote = thirdOf(nextBar)
    landingLabel = landingNote ? `land on ${landingNote} (3rd of the next chord)` : null
  }

  const roleWord = family === "dominant"
    ? (ctxEntry?.hasCadence ? "resolving dominant" : "static dominant")
    : family === "minor"
    ? (ctxEntry?.functionLabel === "subdominant" ? "ii — headed for the V" : "minor home")
    : family === "halfDim"
    ? "iiø — headed for the V"
    : "tonic"
  const comboWord = combo === "home" ? "Home — you can live here"
    : combo === "engine" ? "Engine — full tension on Martino geometry"
    : "Tension — pass through"
  const why = `${roleWord} · ${comboWord}${landingLabel ? ` · ${landingLabel}` : ""}`

  return {
    family,
    pair: {
      id: pairDef.id, label: pairDef.label, tension: pairDef.tension, blurb: pairDef.blurb,
      t1: { root: spell(pairDef.offsets[0]), notes: t1Offs.map(spell) },
      t2: { root: spell(pairDef.offsets[1]), notes: t2Offs.map(spell) },
    },
    autoPair,
    pairOptions: def.pairs.map(({ id, label, blurb }) => ({ id, label, blurb })),
    contextOptions: def.contexts.map(({ short, blurb }, i) => ({ slot: i, short, blurb })),
    context: { slot, short: ctxDef.short, blurb: ctxDef.blurb, tonic: spell(ctxDef.off), notes: ctxOffs.map(spell) },
    poolNotes: poolOffs.map(spell),
    poolDegrees: poolOffs.map((off) => DEG[off]),
    rubs: rubs.map(([a, b]) => [spell(a), spell(b)]),
    combo,
    landingNote,
    landingLabel,
    soloTriad: soloTriad === 1 || soloTriad === 2 ? soloTriad : null,
    why,
  }
}
