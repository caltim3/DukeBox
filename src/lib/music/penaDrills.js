// The Peña drill deck — Richard Peña's bebop-intuition method broken into
// loopable prescriptions. Each one is a single instruction the player holds
// for a handful of loops before the deck advances. Guided mode rotates the
// deck in place; Drill mode adds the ladder (key cycle + tempo) on top.
//
// The three tools, per the method: arpeggio/scale line (chord tones on strong
// beats), chromatic enclosure (starting the line or meeting the target), and
// a guide-tone landing — the 3rd of the next chord, on beat 1.

export const PENA_DRILLS = [
  {
    id: "nail-the-third",
    title: "Nail the third",
    detail: "Start on the root of the current chord, climb the arpeggio, and land the 3rd of the NEXT chord exactly on beat 1. The 3rd names the chord — hitting it is outlining the change.",
  },
  {
    id: "nail-the-one",
    title: "Nail the one",
    detail: "Start on the 3rd, arpeggio up, then spend the last two beats on a four-eighth-note enclosure that cages the next chord's ROOT. Beat one is the door.",
  },
  {
    id: "enclosure-first",
    title: "Enclosure first",
    detail: "Flip the order: START the line with the enclosure — half step below, half step above — then release into the arpeggio. Same tools, opposite grammar.",
  },
  {
    id: "descending-ladder",
    title: "Descending ladder",
    detail: "Come DOWN the arpeggio from the 7th instead of up from the 3rd, and let the 7th fall a half step onto the next chord's 3rd. That half-step fall is the guide-tone glue.",
  },
  {
    id: "strong-beats",
    title: "Strong notes, strong beats",
    detail: "Free line, one rule: beats 1 and 3 must carry a chord tone — preferably the 3rd or 7th. Everything between the strong beats is yours.",
  },
  {
    id: "fast-lane",
    title: "The fast lane",
    detail: "Halve the portion: one tool per chord. Arpeggio on this chord, short enclosure into the next. When changes move fast the tools stay — only the portion size shrinks.",
  },
]

// Loops each prescription is held before the deck advances.
export const GUIDED_LOOPS_PER_DRILL = 4
export const DRILL_LOOPS_PER_STAGE = 8

// Cycle of 4ths, jazz direction: C → F → Bb → Eb …  (up a 4th = +5 semitones)
export const KEY_CYCLE = ["C", "F", "Bb", "Eb", "Ab", "Db", "Gb", "B", "E", "A", "D", "G"]

export function nextKeyInCycle(key) {
  const index = KEY_CYCLE.indexOf(key)
  // Unknown spelling (e.g. F#) — normalize into the cycle rather than stall.
  if (index === -1) return "C"
  return KEY_CYCLE[(index + 1) % KEY_CYCLE.length]
}

export function guidedPrescription(loopsDone) {
  return PENA_DRILLS[Math.floor(loopsDone / GUIDED_LOOPS_PER_DRILL) % PENA_DRILLS.length]
}

export function drillStage(loopsDone) {
  const stage = Math.floor(loopsDone / DRILL_LOOPS_PER_STAGE)
  return {
    stage,
    prescription: PENA_DRILLS[stage % PENA_DRILLS.length],
    // Completed full passes through the deck — each one earns a key change.
    keyCycles: Math.floor(stage / PENA_DRILLS.length),
    loopsIntoStage: loopsDone % DRILL_LOOPS_PER_STAGE,
  }
}
