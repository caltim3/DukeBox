// Rhythm library and phrase skeleton planner — rhythm chosen FIRST,
// independently of pitch. This is the deliberate break from Phrase Machine,
// whose vocabulary blocks fuse rhythm and pitch: here the same melodic idea
// can arrive as running eighths, a Charleston kick, or one held note,
// because the skeleton (onsets, durations, rests) exists before any pitch
// decision is made.
//
// All times are in real beats. Swing comes from the transport, so onsets
// stay on the straight grid (triplets excepted).

import { pickWeighted, chance } from "./rng"

// Each cell is a reusable chunk of rhythm. `t` = onset offset from the cell
// start, `d` = duration, both in beats. `density` ranks how busy the cell is
// (0-1) so the blended style's density control can bias selection.
export const RHYTHM_CELLS = [
  { id: "run8", beats: 2, density: 1.0, onsets: [{ t: 0, d: 0.5 }, { t: 0.5, d: 0.5 }, { t: 1, d: 0.5 }, { t: 1.5, d: 0.5 }] },
  { id: "offbeat8", beats: 2, density: 0.8, onsets: [{ t: 0.5, d: 0.5 }, { t: 1, d: 0.5 }, { t: 1.5, d: 0.5 }] },
  { id: "charleston", beats: 2, density: 0.45, onsets: [{ t: 0, d: 0.75 }, { t: 1.5, d: 0.5 }] },
  { id: "triplet", beats: 1, density: 1.0, onsets: [{ t: 0, d: 1 / 3 }, { t: 1 / 3, d: 1 / 3 }, { t: 2 / 3, d: 1 / 3 }] },
  { id: "quarters", beats: 2, density: 0.4, onsets: [{ t: 0, d: 1 }, { t: 1, d: 1 }] },
  { id: "pushQuarter", beats: 2, density: 0.3, onsets: [{ t: 0.5, d: 1.5 }] },
  { id: "longNote", beats: 2, density: 0.15, onsets: [{ t: 0, d: 2 }] },
  { id: "dotted", beats: 2, density: 0.5, onsets: [{ t: 0, d: 1.5 }, { t: 1.5, d: 0.5 }] },
]

const CELL_BY_ID = Object.fromEntries(RHYTHM_CELLS.map((c) => [c.id, c]))

// Score a cell for the current style: profile taste × density fit ×
// don't-repeat-yourself.
function cellWeight(style, cell, lastCellId) {
  const taste = style.cellWeights[cell.id] ?? 0.5
  const densityFit = 1 - Math.abs(cell.density - style.density) * 1.4
  const contrast = cell.id === lastCellId ? 0.35 : 1
  return Math.max(0.01, taste * Math.max(0.05, densityFit) * contrast)
}

// Fill one phrase span with cells. Returns { onsets: [{t, d}], cellIds }
// with t absolute. The final onset is the landing: its duration stretches
// toward (but not past) `ringUntil` so phrase endings breathe instead of
// clipping short.
export function buildPhraseSkeleton({ rng, style, startBeat, endBeat, ringUntil }) {
  const onsets = []
  const cellIds = []
  let t = startBeat
  let lastCellId = null

  while (t < endBeat - 1e-6) {
    const remaining = endBeat - t
    const candidates = RHYTHM_CELLS.filter((c) => c.beats <= remaining + 1e-6)
    let cell
    if (!candidates.length) {
      // Tail smaller than every cell — one note that fills it.
      cell = { id: "tail", beats: remaining, onsets: [{ t: 0, d: remaining }] }
    } else {
      const id = pickWeighted(rng, candidates.map((c) => [c.id, cellWeight(style, c, lastCellId)]))
      cell = CELL_BY_ID[id]
    }
    for (const o of cell.onsets) {
      if (t + o.t < endBeat - 1e-6) onsets.push({ t: t + o.t, d: o.d })
    }
    cellIds.push(cell.id)
    lastCellId = cell.id
    t += cell.beats
  }

  if (onsets.length) {
    const last = onsets[onsets.length - 1]
    const maxRing = Math.max(last.d, (ringUntil ?? endBeat) - last.t)
    last.d = Math.min(2.5, Math.max(last.d, Math.min(maxRing, 1 + rng() * 1.5)))
  }

  return { onsets, cellIds }
}

// Plan the phrase/rest alternation across the whole selection.
// Returns [{ startBeat, endBeat, gapAfter }] — phrase spans with the silence
// that follows each. Space lives here: it scales the gaps and shortens the
// phrases, measured across the whole selection rather than per bar.
export function planPhrases({ rng, style, totalBeats }) {
  const phrases = []
  // First entrance: on the beat, or the classic offbeat/late entry.
  let cursor = chance(rng, style.pickupProb)
    ? pickWeighted(rng, [[0.5, 3], [1, 2], [1.5, 2], [2, 1]])
    : 0

  while (cursor < totalBeats - 1) {
    let len = pickWeighted(rng, style.phraseBeats)
    // Space shortens phrases a little as well as widening gaps.
    len = Math.max(2, Math.round(len * (1 - style.controls.space * 0.25) * 2) / 2)
    const endBeat = Math.min(cursor + len, totalBeats)

    let gap = style.restBeats * (0.6 + rng() * 0.8)
    gap = Math.max(0.5, Math.round(gap * 2) / 2)

    phrases.push({ startBeat: cursor, endBeat, gapAfter: gap })
    cursor = endBeat + gap

    if (cursor < totalBeats - 1) {
      // Re-entries relate to the FORM, not just to elapsed time: often snap
      // to the next bar's downbeat (or an eighth-note pickup into it) so
      // phrases nail the one instead of drifting by arbitrary half-beats.
      const nextBar = Math.ceil(cursor / 4) * 4
      if (chance(rng, style.nailOneProb) && nextBar - cursor <= 2.5 && nextBar < totalBeats - 1) {
        cursor = chance(rng, 0.4) ? nextBar - 0.5 : nextBar
      } else if (chance(rng, style.pickupProb * 0.6)) {
        // Otherwise the classic offbeat re-entry keeps the time feel forward.
        cursor += 0.5
      }
    }
  }

  return phrases
}
