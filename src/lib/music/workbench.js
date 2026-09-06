// The Vocabulary Workbench's comparison — what the student heard against what
// was actually played.
//
// Kept out of the component because this is the pedagogy, not the UI: whether
// a wrong answer is scored as a near-miss or a miss is the whole difference
// between a useful transcription drill and a discouraging one, and that
// judgement deserves to be tested.

const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
const OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 }

export const midiAt = (string, fret) => OPEN_MIDI[string] + fret
export const noteName = (midi) => NOTE_NAMES[((midi % 12) + 12) % 12]

// A generated line's notes in sounding order.
export function flattenLine(line) {
  const out = []
  for (const bar of line?.bars || []) {
    for (const n of bar.n || []) {
      out.push({ midi: midiAt(n[0], n[1]), string: n[0], fret: n[1] })
    }
  }
  return out
}

// Note-by-note verdicts.
//
// "octave" is its own verdict rather than being folded into "wrong" on
// purpose: playing the right note in the wrong octave means the student heard
// the line correctly and placed it badly, which is a fingering problem, not an
// ear problem. Scoring those the same would tell them to go practise the wrong
// thing.
export function compareAnswer(reference, answer) {
  const rows = []
  const length = Math.max(reference.length, answer.length)
  for (let i = 0; i < length; i++) {
    const ref = reference[i]
    const got = answer[i]
    let verdict
    if (ref && got) {
      if (ref.midi === got.midi) verdict = "exact"
      else if (noteName(ref.midi) === noteName(got.midi)) verdict = "octave"
      else verdict = "wrong"
    } else if (got) verdict = "extra"
    else verdict = "missing"
    rows.push({ i, ref: ref ?? null, got: got ?? null, verdict })
  }
  return {
    rows,
    exact: rows.filter((r) => r.verdict === "exact").length,
    octave: rows.filter((r) => r.verdict === "octave").length,
    wrong: rows.filter((r) => r.verdict === "wrong").length,
    total: reference.length,
  }
}
