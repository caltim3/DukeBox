// Garzone's Triadic Chromatic Approach.
//
// Chain triads of any quality — major, minor, augmented, diminished —
// connected ONLY by half-step motion, never repeating the same inversion twice
// in a row. That's the whole system, and it's the largest single piece of new
// logic the curriculum asks for.
//
// Three rules, all enforced by construction rather than checked afterwards:
//
//   1. Every triad is a real triad: three notes, one of the four qualities,
//      in one of the three inversions, played straight up or straight down.
//   2. Consecutive triads never share an inversion, and never share a quality.
//   3. The only interval BETWEEN triads is a half step — the last note of one
//      triad and the first note of the next are always a semitone apart.
//
// The chain is a pure state machine: `tcaAdvance(state, rng, register)` hands
// back one note and the next state. Pure because the state has to survive
// across phrases (the chain is continuous through a whole chorus) and because
// a rule this exact deserves to be testable without generating a line.
//
// Resolution is NOT this module's job and deliberately so. The generator picks
// its guide-tone anchors before it fills anything, and the chain only ever
// gets the gaps between them — so an excursion physically cannot run past the
// next chord tone. Garzone's "you must always come back" is the shape of the
// surrounding code, which is why this file can be pure chromaticism.

const QUALITIES = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  augmented: [0, 4, 8],
  diminished: [0, 3, 6],
}

const QUALITY_IDS = Object.keys(QUALITIES)

// The three notes of a triad in playing order, as offsets from its root.
// Inversions raise the lower notes an octave rather than reordering in place,
// so every inversion is still an ascending shape.
function inversionOffsets(intervals, inversion) {
  const [root, third, fifth] = intervals
  if (inversion === 0) return [root, third, fifth]
  if (inversion === 1) return [third, fifth, root + 12]
  return [fifth, root + 12, third + 12]
}

// One triad whose FIRST sounding note is exactly `startMidi` — that's what
// makes the half-step connection to the previous triad exact rather than
// approximate.
function triadFrom({ startMidi, quality, inversion, descending }) {
  const offsets = inversionOffsets(QUALITIES[quality], inversion)
  const order = descending ? [...offsets].reverse() : offsets
  const base = startMidi - order[0]
  return order.map((o) => base + o)
}

export function createTcaState(startMidi) {
  return {
    pending: [],
    lastMidi: startMidi,
    quality: null,
    inversion: null,
    triadIndex: 0,
  }
}

// One note of the chain, plus the state that follows it.
export function tcaAdvance(state, rng, register) {
  if (state.pending.length) {
    const [midi, ...rest] = state.pending
    return {
      midi,
      quality: state.quality,
      inversion: state.inversion,
      position: 3 - state.pending.length,
      state: { ...state, pending: rest, lastMidi: midi },
    }
  }

  // A new triad begins a half step from where the last one ended. This is the
  // ONLY interval permitted between triads.
  const linkUp = rng() < 0.5 ? 1 : -1
  let startMidi = state.quality == null ? state.lastMidi : state.lastMidi + linkUp

  // Never the same quality or the same inversion twice running.
  const qualities = QUALITY_IDS.filter((q) => q !== state.quality)
  const quality = qualities[Math.floor(rng() * qualities.length)]
  const inversions = [0, 1, 2].filter((i) => i !== state.inversion)
  const inversion = inversions[Math.floor(rng() * inversions.length)]

  // Direction is chosen to stay in the register rather than clamped into it —
  // clamping would collapse two notes of the triad onto one pitch and quietly
  // stop it being a triad at all.
  let descending = rng() < 0.5
  let notes = triadFrom({ startMidi, quality, inversion, descending })
  if (notes.some((m) => m < register.min || m > register.max)) {
    descending = !descending
    notes = triadFrom({ startMidi, quality, inversion, descending })
  }
  if (notes.some((m) => m < register.min || m > register.max)) {
    // Both directions leave the register: step the link the other way, which
    // is still a half step, and try once more.
    startMidi = state.lastMidi - linkUp
    notes = triadFrom({ startMidi, quality, inversion, descending })
    if (notes.some((m) => m < register.min || m > register.max)) {
      descending = !descending
      notes = triadFrom({ startMidi, quality, inversion, descending })
    }
  }

  const [midi, ...rest] = notes
  return {
    midi,
    quality,
    inversion,
    position: 0,
    state: {
      pending: rest,
      lastMidi: midi,
      quality,
      inversion,
      triadIndex: state.triadIndex + 1,
    },
  }
}

export const TCA_QUALITIES = QUALITY_IDS
export const TCA_INVERSION_NAMES = ["root position", "1st inversion", "2nd inversion"]
