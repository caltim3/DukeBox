// Onset fillers — the second extension point.
//
// A lens (devices.js) changes WHICH notes are available. A filler decides
// WHAT HAPPENS over a run of onsets. The generator picks its anchors first —
// the phrase opening, a guide tone at every chord change, the landing — and
// then has gaps to fill between them. A filler claims the last few onsets
// before an anchor and writes the approach into it.
//
// This is why the outside material in this curriculum can't run away: the
// anchor exists before the approach does, so an approach is bounded by
// construction rather than by a probability that usually behaves. Garzone's
// "you must always come back" is the shape of the code, not a rule the engine
// tries to remember.
//
// Every run is generated BACK-TO-FRONT conceptually — it knows its target and
// writes the notes that lead into it — and returns exactly `count` midi
// values, the last of which is the note immediately before the target.

import { clampToRegister, scaleStep } from "./pitch"

// The classic bebop four-note enclosure, in the same reading DukeBox already
// uses for the Peña device in the model route: below, chromatic above, then a
// double chromatic from below into the target.
const ENCIRCLE_4 = (t) => [t - 1, t + 1, t - 2, t - 1]
const ENCIRCLE_3 = (t) => [t + 1, t - 2, t - 1]
const ENCIRCLE_2 = (t) => [t + 1, t - 1]

export const APPROACH_FILLERS = {
  "upper-neighbour": {
    id: "upper-neighbour",
    label: "Upper neighbour",
    maxOnsets: 1,
    description: "One note, the scale tone above the target, falling into it.",
    // Diatonic above / chromatic below is the standard pairing — an upper
    // neighbour that's always a half step reads as an appoggiatura instead.
    run: ({ count, target, seg, register }) =>
      lastN(count, [scaleStep(target, seg.scalePcs, 1, register)]),
  },

  "lower-neighbour": {
    id: "lower-neighbour",
    label: "Lower neighbour",
    maxOnsets: 1,
    description: "One note, a half step below the target, pushing up into it.",
    run: ({ count, target }) => lastN(count, [target - 1]),
  },

  "double-chromatic": {
    id: "double-chromatic",
    label: "Double chromatic",
    maxOnsets: 2,
    description: "Two half steps from below — the most common bebop approach there is.",
    run: ({ count, target }) => lastN(count, [target - 2, target - 1]),
  },

  encirclement: {
    id: "encirclement",
    label: "Full encirclement",
    maxOnsets: 4,
    description: "The target caged from both sides before it arrives.",
    run: ({ count, target }) =>
      lastN(count, count >= 4 ? ENCIRCLE_4(target) : count === 3 ? ENCIRCLE_3(target) : ENCIRCLE_2(target)),
  },

  rca: {
    id: "rca",
    label: "Random Chromatic Approach",
    maxOnsets: 4,
    description:
      "Garzone's gentlest door: chromatic motion that never leaves a major 3rd around the " +
      "target and never moves the same direction twice in a row.",
    run: ({ rng, count, target, register }) => rcaRun({ rng, count, target, register }),
  },
}

function lastN(count, notes) {
  // A shape longer than the room available keeps its TAIL: the notes closest
  // to the target are the ones that make it an approach at all.
  return notes.slice(Math.max(0, notes.length - count))
}

// Garzone's Random Chromatic Approach.
//
// Two invariants, both asserted in the tests:
//   1. every note is within a major 3rd (4 semitones) of the target;
//   2. consecutive moves alternate direction — never twice the same way.
//
// The construction makes both true rather than checking them afterwards: the
// step size is chosen from the room actually left in the current direction,
// so a move can never cross the edge and never has to be cancelled.
//
// Alternation alone is NOT enough to stay inside the span — up 2, down 1, up 2
// drifts outward one semitone per pair, which is how a note landed a perfect
// 4th from its target in the first version of this. The room check is what
// makes the bound hold.
//
// Room can never reach zero: the edge is only reachable by moving outward, and
// the next move after an outward one is always inward.
const RCA_SPAN = 4

function rcaRun({ rng, count, target, register }) {
  const lo = Math.max(target - RCA_SPAN, register.min)
  const hi = Math.min(target + RCA_SPAN, register.max)
  let dir = rng() < 0.5 ? 1 : -1
  let cur = clampToRegister(target + (rng() < 0.5 ? 1 : -1) * (1 + Math.floor(rng() * 2)), { min: lo, max: hi })
  const notes = []
  for (let i = 0; i < count; i++) {
    notes.push(cur)
    const room = dir > 0 ? hi - cur : cur - lo
    const step = room >= 2 && rng() < 0.5 ? 2 : 1
    cur += dir * Math.min(step, Math.max(1, room))
    dir = -dir
  }
  return notes
}

// A profile's register says where the LINE should sit. It is not a wall an
// approach note may not lean over: a chromatic note a semitone under the
// bottom of a comfortable range is ordinary playing, and clamping it back
// inside collapsed two notes of a run onto the same pitch — which silently
// broke Garzone's alternation rule whenever a target sat near the edge.
// Approaches get a little headroom, and the run generators are bounded by it
// so the clamp below never actually has to fire.
const APPROACH_HEADROOM = 4

// Claim the onsets before an anchor and write the approach into them.
// Returns [{ midi, device }] aligned to the claimed onsets, or null when the
// filler can't say anything useful here.
export function buildApproachRun({ id, rng, count, target, seg, register }) {
  const filler = APPROACH_FILLERS[id]
  if (!filler || count < 1 || !seg) return null
  const bounds = {
    min: register.min - APPROACH_HEADROOM,
    max: register.max + APPROACH_HEADROOM,
  }
  const room = Math.min(count, filler.maxOnsets)
  const notes = filler.run({ rng, count: room, target, seg, register: bounds })
  if (!notes?.length) return null
  return notes.map((midi) => ({
    midi: clampToRegister(midi, bounds),
    device: filler.label,
  }))
}

export const RCA_SPAN_SEMITONES = RCA_SPAN
