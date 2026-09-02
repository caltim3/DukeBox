// Improviser invariants + statistical behavior. These validate BEHAVIOR with
// broad tolerances — they must never freeze exact musical output, or every
// tuning pass would break them.

import { describe, it, expect } from "vitest"
import { improvise, IMPROV_PROFILES } from "../index"
import { normalizeMeasures, segmentAtBeat } from "../chartTimeline"

const II_V_I = ["Dm7", "G7", "Cmaj7", "Cmaj7"]
const SPLIT_BAR = ["Am7", "Bm7b5 E7b9", "Am7", "Am7"]
const BLUES = ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "D7", "Gm7", "C7", "F7", "C7"]

const OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 }
const midiOf = ([s, f]) => OPEN_MIDI[s] + f

function allNotes(line) {
  return (line.bars || []).flatMap((bar) => bar.n || [])
}

function stats(measures, opts = {}) {
  // Aggregate over many seeds so single-seed luck can't pass or fail a run.
  const seeds = Array.from({ length: 60 }, (_, i) => i * 7919 + 1)
  let notes = 0
  let beatsSounding = 0
  let totalBeats = 0
  let velSum = 0
  for (const seed of seeds) {
    const { line } = improvise({ measures, seed, ...opts })
    for (const bar of line.bars) {
      totalBeats += bar.beats
      for (const n of bar.n || []) {
        notes++
        beatsSounding += n[2]
        velSum += n[4]
      }
    }
  }
  return {
    notesPerBar: notes / (measures.length * seeds.length),
    restRatio: 1 - beatsSounding / totalBeats,
    meanVel: velSum / notes,
  }
}

describe("chart timeline", () => {
  it("splits a shared bar at beat 2", () => {
    const t = normalizeMeasures(SPLIT_BAR)
    expect(segmentAtBeat(t, 4).symbol).toBe("Bm7b5")
    expect(segmentAtBeat(t, 6).symbol).toBe("E7b9")
    expect(segmentAtBeat(t, 6).isDominant).toBe(true)
  })

  it("treats N.C. as harmonic silence, not a fake chord", () => {
    const t = normalizeMeasures(["Dm7", "N.C.", "Cmaj7"])
    expect(segmentAtBeat(t, 5)).toBeNull()
    expect(t.totalBeats).toBe(12)
  })
})

describe("invariants", () => {
  const cases = { II_V_I, SPLIT_BAR, BLUES }
  for (const [name, measures] of Object.entries(cases)) {
    it(`${name}: identical seed reproduces the identical line`, () => {
      const a = improvise({ measures, seed: 42 })
      const b = improvise({ measures, seed: 42 })
      expect(a.line).toEqual(b.line)
    })

    it(`${name}: every note is playable, positive, in range, in its bar`, () => {
      for (const seed of [1, 99, 4242, 987654]) {
        const { line } = improvise({ measures, seed })
        expect(line.bars.length).toBe(measures.length)
        for (const bar of line.bars) {
          let used = 0
          for (const n of bar.n) {
            const [s, f, dur, wait, vel] = n
            expect(s).toBeGreaterThanOrEqual(1)
            expect(s).toBeLessThanOrEqual(6)
            expect(f).toBeGreaterThanOrEqual(0)
            expect(f).toBeLessThanOrEqual(24)
            expect(dur).toBeGreaterThan(0)
            expect(wait).toBeGreaterThanOrEqual(0)
            expect(vel).toBeGreaterThanOrEqual(0.2)
            expect(vel).toBeLessThanOrEqual(1)
            const midi = midiOf(n)
            expect(midi).toBeGreaterThanOrEqual(40)
            expect(midi).toBeLessThanOrEqual(96)
            used += dur + wait
          }
          // Monophonic, no bar overflow.
          expect(used).toBeLessThanOrEqual(bar.beats + 1e-6)
        }
      }
    })
  }

  it("N.C. bars stay silent", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { line } = improvise({ measures: ["Dm7", "N.C.", "N.C.", "Cmaj7"], seed })
      expect(line.bars[1].n.length).toBe(0)
      expect(line.bars[2].n.length).toBe(0)
    }
  })

  it("unknown chords don't abort generation", () => {
    const { line } = improvise({ measures: ["Xyz9", "G7", "Cmaj7"], seed: 7 })
    expect(line.bars.length).toBe(3)
  })
})

// Reconstruct absolute-beat onsets from a line, with midi per note.
function absoluteNotes(line) {
  const notes = []
  let barStart = 0
  for (const bar of line.bars) {
    let pos = 0
    for (const n of bar.n) {
      pos += n[3]
      notes.push({ t: barStart + pos, d: n[2], midi: midiOf(n) })
      pos += n[2]
    }
    barStart += bar.beats
  }
  return notes
}

describe("time placement and voice leading", () => {
  const CHANGES = [4, 8] // Dm7 → G7 → Cmaj7 boundaries in II_V_I
  const CHORD_PCS = { 4: [7, 11, 2, 5], 8: [0, 4, 7, 11] } // G7, Cmaj7

  it("chord changes are spoken at or just before the barline most of the time", () => {
    let spoken = 0
    let total = 0
    let anticipated = 0
    for (let seed = 1; seed <= 80; seed++) {
      const { line } = improvise({ measures: II_V_I, seed })
      const notes = absoluteNotes(line)
      for (const B of CHANGES) {
        // Only count changes the phrasing actually plays through.
        if (!notes.some((n) => n.t > B - 1 && n.t < B + 2)) continue
        total++
        const near = notes.filter((n) => n.t > B - 0.6 && n.t < B + 0.3)
        if (near.some((n) => CHORD_PCS[B].includes(n.midi % 12))) spoken++
        if (near.some((n) => n.t < B - 0.05 && CHORD_PCS[B].includes(n.midi % 12))) anticipated++
      }
    }
    expect(spoken / total).toBeGreaterThan(0.55) // the change is heard
    expect(anticipated).toBeGreaterThan(0) // and sometimes pushed early
  })

  it("some phrases re-enter on a downbeat", () => {
    let downbeatEntries = 0
    for (let seed = 1; seed <= 40; seed++) {
      const { line } = improvise({ measures: BLUES, seed })
      const notes = absoluteNotes(line)
      for (let i = 1; i < notes.length; i++) {
        const gap = notes[i].t - (notes[i - 1].t + notes[i - 1].d)
        if (gap > 0.4 && notes[i].t % 4 < 0.01) downbeatEntries++
      }
    }
    expect(downbeatEntries).toBeGreaterThan(10)
  })

  it("lines are mostly stepwise — mean interval stays small", () => {
    let intervalSum = 0
    let count = 0
    for (let seed = 1; seed <= 40; seed++) {
      const { line } = improvise({ measures: BLUES, seed })
      const notes = absoluteNotes(line)
      for (let i = 1; i < notes.length; i++) {
        intervalSum += Math.abs(notes[i].midi - notes[i - 1].midi)
        count++
      }
    }
    expect(intervalSum / count).toBeLessThan(4)
  })
})

describe("statistical behavior of the controls", () => {
  it("more space → more rest", () => {
    const dense = stats(BLUES, { controls: { space: 0.1 } })
    const airy = stats(BLUES, { controls: { space: 0.9 } })
    expect(airy.restRatio).toBeGreaterThan(dense.restRatio + 0.05)
    expect(airy.notesPerBar).toBeLessThan(dense.notesPerBar)
  })

  it("more intensity → louder", () => {
    const soft = stats(II_V_I, { controls: { intensity: 0.1 } })
    const hot = stats(II_V_I, { controls: { intensity: 0.9 } })
    expect(hot.meanVel).toBeGreaterThan(soft.meanVel + 0.1)
  })

  it("profiles are measurably distinct", () => {
    const bebop = stats(BLUES, { profileId: "bebop" })
    const sparse = stats(BLUES, { profileId: "sparse-lyrical" })
    expect(bebop.notesPerBar).toBeGreaterThan(sparse.notesPerBar * 1.3)
    expect(sparse.restRatio).toBeGreaterThan(bebop.restRatio)
  })

  it("all shipped profiles produce sound on all fixtures", () => {
    for (const profileId of Object.keys(IMPROV_PROFILES)) {
      for (const measures of [II_V_I, SPLIT_BAR, BLUES]) {
        const { line } = improvise({ measures, profileId, seed: 11 })
        expect(allNotes(line).length).toBeGreaterThan(0)
      }
    }
  })
})
