// Triad System routes — curated, named ways through a progression for the
// Triads lens (src/lib/music/triadSystem.js). A route is a schedule of
// (pair, backdrop slot, landing policy) over the chart's functional
// skeleton: the same per-bar tuple the lens's manual controls set, resolved
// automatically from each bar's role instead. "Wes" obeys the system's
// doctrine (tension only where the harmony pulls, every landing a guide
// tone); "Ribot" schedules deliberate violations of it (the rub as the
// destination, refused landings, one triad re-attacked tres-style). The
// routes ladder is really an obedience axis, and these are its two ends.
//
// Function tags come from the same analysis the rest of the app trusts —
// harmony.js's analyzeProgressionContext rows (ctxEntry) — plus two
// blues-specific reads computed here from the bars themselves, because
// detectCadenceAt deliberately ignores dominant→dominant motion:
//   dom_V_of_IV  — a tonic-root dominant about to become the IV for real
//                  (the bar AFTER the IV isn't the tonic again — a
//                  quick-change bar 1 stays plain dom_I).
//   wrap-resolve — the turnaround dominant whose resolution is bar 1 of
//                  the next chorus; no next bar exists in the array, so
//                  hasCadence can't see it.
//
// Pure data + one resolver. No UI, no chart state.

import { triadQualityFamily } from "@/lib/music/triadSystem"
import { noteAtSemitones } from "@/lib/music/tonal"

export const TRIAD_ROUTES = [
  {
    id: "wes",
    label: "Wes",
    blurb: "Melodic obedience — sweet Inside 9/13 sound at home, the key's own blues scale on the IV, the Altered pair spent only where the harmony truly pulls, every landing a 3rd.",
  },
  {
    id: "ribot",
    label: "Ribot",
    blurb: "Scheduled disobedience — Inside triads over the blues backdrop with the rub as the destination, one triad re-attacked tres-style on the IV, refused landings on the cadences. The wrong note held with conviction.",
  },
]

// Per-tag tuples. slot indexes the quality's own backdrop ladder in
// triadSystem.js (0 home · 1 fifth/Martino · 2 color). landing:
// "land" (Galper default) | "rub" (sit on the first rub) | "refuse" (stop a
// half step shy of the true landing). soloTriad 1 lights only the pair's
// first triad — the tres-style single-cell statement.
const ROUTE_TABLES = {
  wes: {
    dom_I:        { pair: "inside",  slot: 0, landing: "land",   note: "home — the sweet 9/13 sound, sing it" },
    dom_IV:       { pair: "inside",  slot: 1, landing: "land",   note: "the IV wears the key's own blues scale — Martino slot and home blues are the same five notes" },
    dom_static:   { pair: "inside",  slot: 0, landing: "land",   note: "static dominant — live in the Inside pair" },
    dom_V_of_IV:  { pair: "altered", slot: 1, landing: "land",   note: "one pulse of tension into the IV — the b7 pulls down a half step" },
    dom_resolving:{ pair: "altered", slot: 1, landing: "land",   note: "spend the Altered pair here — this is what it's for" },
    minor_ii:     { pair: "auto",    slot: 0, landing: "land",   note: "ii — aim the line at the V" },
    minor:        { pair: "auto",    slot: 0, landing: "land",   note: "minor home — Dorian pair, no hurry" },
    major:        { pair: "diatonic",slot: 0, landing: "land",   note: "tonic — arrive and mean it" },
    halfDim:      { pair: "auto",    slot: 0, landing: "land",   note: "iiø — relative-minor shapes, headed for the V" },
  },
  ribot: {
    dom_I:        { pair: "inside",  slot: 2, landing: "rub",    note: "repeat the cell past comfort — the rub is the destination" },
    dom_IV:       { pair: "inside",  slot: 2, landing: "rub",    soloTriad: 1, note: "one broken triad, tres-style — re-attack, don't develop" },
    dom_static:   { pair: "inside",  slot: 2, landing: "rub",    note: "three notes and a scowl" },
    dom_V_of_IV:  { pair: "inside",  slot: 2, landing: "rub",    note: "ignore the sophistication — restate bar 1, louder" },
    dom_resolving:{ pair: "altered", slot: 0, landing: "refuse", note: "the wrong note held with conviction" },
    minor_ii:     { pair: "auto",    slot: 0, landing: "land",   note: "played straight — the inside bar is the surprise" },
    minor:        { pair: "auto",    slot: 0, landing: "land",   note: "played straight — the inside bar is the surprise" },
    major:        { pair: "diatonic",slot: 0, landing: "land",   note: "plain triads, mostly rests" },
    halfDim:      { pair: "auto",    slot: 0, landing: "land",   note: "relative shapes, no comment" },
  },
}

const chromaOf = (note) => {
  // noteAtSemitones normalizes any spelling onto one chromatic table, so
  // equality across Gb/F# style differences is just name equality after it.
  return note ? noteAtSemitones(note, 0) : null
}

function motionUp(fromRoot, toRoot) {
  const a = chromaOf(fromRoot)
  const b = chromaOf(toRoot)
  if (a == null || b == null) return null
  const ALL = Array.from({ length: 12 }, (_, i) => noteAtSemitones("C", i))
  return (ALL.indexOf(b) - ALL.indexOf(a) + 12) % 12
}

// The bar's functional tag, from ctxEntry plus the blues-specific reads.
function tagFor({ bars, index, ctxEntry, tonicRoot }) {
  const bar = bars[index]
  const family = triadQualityFamily(bar?.quality)
  if (!family) return null
  const root = bar.userTonic ?? bar.root

  if (family === "minor") return ctxEntry?.functionLabel === "subdominant" ? "minor_ii" : "minor"
  if (family === "major") return "major"
  if (family === "halfDim") return "halfDim"

  // Dominants. Wrap-aware next sounding bar — the turnaround's resolution
  // lives at the top of the next chorus.
  let next = null
  for (let step = 1; step <= bars.length; step++) {
    const b = bars[(index + step) % bars.length]
    if (b && b.quality !== "NC") { next = b; break }
  }
  const nextRoot = next ? (next.userTonic ?? next.root) : null
  const nextFamily = next ? triadQualityFamily(next.quality) : null
  const up = nextRoot ? motionUp(root, nextRoot) : null
  const isTonicRoot = tonicRoot && chromaOf(root) === chromaOf(tonicRoot)
  const nextIsTonicRoot = tonicRoot && nextRoot && chromaOf(nextRoot) === chromaOf(tonicRoot)

  // Resolving: harmony's own cadence read, or the wrap case it can't see —
  // a 4th-up/tritone move into a non-dominant, or into the tonic itself
  // (blues turnaround: V7 → I7, both dominants).
  if (ctxEntry?.hasCadence) return "dom_resolving"
  if ((up === 5 || up === 11) && (nextFamily !== "dominant" || nextIsTonicRoot)) return "dom_resolving"

  // V-of-IV: tonic-root dominant moving up a 4th to another dominant, where
  // the IV then sticks (the bar after it isn't the tonic again). A
  // quick-change bar 1 fails the stick test and stays dom_I.
  if (isTonicRoot && up === 5 && nextFamily === "dominant" && !nextIsTonicRoot) {
    let afterNext = null
    for (let step = 2; step <= bars.length + 1; step++) {
      const b = bars[(index + step) % bars.length]
      if (b && b.quality !== "NC") { afterNext = b; break }
    }
    const afterRoot = afterNext ? (afterNext.userTonic ?? afterNext.root) : null
    if (!(afterRoot && tonicRoot && chromaOf(afterRoot) === chromaOf(tonicRoot))) return "dom_V_of_IV"
  }

  if (isTonicRoot) return "dom_I"
  if (tonicRoot && chromaOf(root) === chromaOf(noteAtSemitones(tonicRoot, 5))) return "dom_IV"
  return "dom_static"
}

/**
 * Resolve a route's tuple for one bar. Returns null when the route id is
 * unknown or the bar has no triad family (dim7/NC — the lens stands down
 * there anyway); otherwise { id, label, tag, pairChoice, contextSlot,
 * landingPolicy, soloTriad, styleNote } ready to feed resolveTriadSystem.
 */
export function resolveTriadRoute({ bars, index, ctxEntry = null, tonicRoot = null, routeId }) {
  const table = ROUTE_TABLES[routeId]
  const meta = TRIAD_ROUTES.find((r) => r.id === routeId)
  if (!table || !meta) return null
  const tag = tagFor({ bars, index, ctxEntry, tonicRoot })
  if (!tag) return null
  const row = table[tag]
  return {
    id: meta.id,
    label: meta.label,
    tag,
    pairChoice: row.pair,
    contextSlot: row.slot,
    landingPolicy: row.landing,
    soloTriad: row.soloTriad ?? null,
    styleNote: row.note,
  }
}
