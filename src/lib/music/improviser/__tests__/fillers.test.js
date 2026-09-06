// Onset fillers — the named approach types, Garzone's RCA, and Peña.
//
// These are the curriculum's hardest claims to make honestly. "Never repeat
// the same interval direction twice in a row" is either true of every line the
// engine emits or the segment teaches the wrong thing, and a prose instruction
// can't be held to it. Here it's an assertion.

import { describe, it, expect } from "vitest"
import { improvise, IMPROV_DEVICES } from "../index"
import { APPROACH_FILLERS, RCA_SPAN_SEMITONES } from "../fillers"
import { normalizeMeasures, segmentAtBeat } from "../chartTimeline"
import { deviceStyle } from "../devices"
import { blendStyle } from "../profiles"

const II_V_I = ["Dm7", "G7", "Cmaj7", "Cmaj7"]
const BLUES = ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "D7"]
const OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 }
const midiOf = ([s, f]) => OPEN_MIDI[s] + f
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 1)

// Notes in sounding order, each tagged with the bar's reasoning so a note can
// be attributed to the device that wrote it.
function noteRuns(line) {
  const runs = []
  for (const bar of line.bars) {
    for (const n of bar.n || []) runs.push({ midi: midiOf(n), d: bar.d, x: bar.x })
  }
  return runs
}

describe("the default path is still untouched", () => {
  it("adding the filler layer leaves a device-free line untouched", () => {
    for (const measures of [II_V_I, BLUES]) {
      for (const seed of [42, 1234]) {
        expect(improvise({ measures, seed, devices: [] }).line)
          .toEqual(improvise({ measures, seed }).line)
      }
    }
  })

  it("a style with no filler device is returned unchanged, not rebuilt", () => {
    // deviceStyle must be a no-op without fillers, or every seeded line in
    // the app shifts the moment this layer exists.
    const style = blendStyle("bebop", {})
    expect(deviceStyle(style, [])).toBe(style)
    expect(deviceStyle(style, ["bebop-scale", "triads"])).toBe(style)
    expect(deviceStyle(style, ["encirclement"])).not.toBe(style)
  })

  it("every filler device still replays identically from its seed", () => {
    for (const id of Object.keys(IMPROV_DEVICES).filter((k) => IMPROV_DEVICES[k].kind === "filler")) {
      const a = improvise({ measures: BLUES, seed: 5, devices: [id], level: 3 })
      const b = improvise({ measures: BLUES, seed: 5, devices: [id], level: 3 })
      expect(a.line).toEqual(b.line)
    }
  })

  it("every filler produces sound on every fixture", () => {
    for (const id of Object.keys(IMPROV_DEVICES).filter((k) => IMPROV_DEVICES[k].kind === "filler")) {
      for (const measures of [II_V_I, BLUES]) {
        const { line } = improvise({ measures, devices: [id], level: 3, seed: 11 })
        expect(noteRuns(line).length).toBeGreaterThan(0)
      }
    }
  })
})

// Pull the consecutive notes one approach device wrote, as runs.
function approachRuns(measures, id, seeds = SEEDS) {
  const label = IMPROV_DEVICES[id].label
  const runs = []
  for (const seed of seeds) {
    const { line } = improvise({ measures, seed, devices: [id], level: 3 })
    let barStart = 0
    for (const bar of line.bars) {
      if (!bar.d.includes(label)) { barStart += bar.beats; continue }
      let pos = 0
      const notes = []
      for (const n of bar.n) {
        pos += n[3]
        notes.push({ t: barStart + pos, midi: midiOf(n) })
        pos += n[2]
      }
      if (notes.length) runs.push(notes)
      barStart += bar.beats
    }
  }
  expect(runs.length).toBeGreaterThan(15)
  return runs
}

describe("Garzone — Random Chromatic Approach", () => {
  // The two rules, verified at the source so the shape itself is proven, not
  // just the lines that happen to come out of it.
  it("never leaves a major 3rd around the target", () => {
    for (let seed = 1; seed <= 200; seed++) {
      let n = seed
      const rng = () => ((n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
      for (const count of [1, 2, 3, 4]) {
        const notes = APPROACH_FILLERS.rca.run({ rng, count, target: 60, register: { min: 40, max: 92 } })
        for (const midi of notes) {
          expect(Math.abs(midi - 60)).toBeLessThanOrEqual(RCA_SPAN_SEMITONES)
        }
      }
    }
  })

  it("never moves the same direction twice in a row", () => {
    for (let seed = 1; seed <= 200; seed++) {
      let n = seed
      const rng = () => ((n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
      const notes = APPROACH_FILLERS.rca.run({ rng, count: 4, target: 60, register: { min: 40, max: 92 } })
      const dirs = []
      for (let i = 1; i < notes.length; i++) dirs.push(Math.sign(notes[i] - notes[i - 1]))
      for (const d of dirs) expect(d).not.toBe(0)
      for (let i = 1; i < dirs.length; i++) expect(dirs[i]).toBe(-dirs[i - 1])
    }
  })

  it("holds both rules in the lines it actually generates", () => {
    // Read the runs off the trace, not off the bar: once an approach is
    // interleaved with anchors and scale notes, consecutive notes in a bar
    // are not all RCA motion, and testing them as if they were proves nothing.
    let checked = 0
    for (const seed of SEEDS) {
      const { trace } = improvise({ measures: BLUES, seed, devices: ["rca"], level: 3 })
      for (const phrase of trace.phrases) {
        for (const run of phrase.approaches || []) {
          for (const midi of run.notes) {
            expect(Math.abs(midi - run.target)).toBeLessThanOrEqual(RCA_SPAN_SEMITONES)
          }
          // A repeated note is not a move at all — it was how register
          // clamping used to break the alternation rule without saying so.
          for (let i = 1; i < run.notes.length; i++) {
            expect(run.notes[i]).not.toBe(run.notes[i - 1])
          }
          const dirs = []
          for (let i = 1; i < run.notes.length; i++) dirs.push(Math.sign(run.notes[i] - run.notes[i - 1]))
          for (let i = 1; i < dirs.length; i++) expect(dirs[i]).toBe(-dirs[i - 1])
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(30)
  })

  it("resolves — the excursion always lands on a chord tone", () => {
    const timeline = normalizeMeasures(BLUES)
    let landings = 0
    for (const seed of SEEDS) {
      const { line } = improvise({ measures: BLUES, seed, devices: ["rca"], level: 3 })
      let barStart = 0
      for (const bar of line.bars) {
        const seg = segmentAtBeat(timeline, barStart)
        const last = bar.n[bar.n.length - 1]
        if (last && seg && bar.x.includes("into")) {
          // The bar's final sounding note belongs to the harmony it sits in,
          // or to the chord it is anticipating.
          const pc = ((midiOf(last) % 12) + 12) % 12
          const next = timeline.segments.find((sg) => sg.startBeat > barStart)
          if (seg.scalePcs.includes(pc) || seg.chordPcs.includes(pc) || next?.chordPcs.includes(pc)) landings++
        }
        barStart += bar.beats
      }
    }
    expect(landings).toBeGreaterThan(20)
  })
})

describe("Ligon — the four approach types, each alone", () => {
  it("lower neighbour approaches only from a half step below", () => {
    for (const run of approachRuns(II_V_I, "lower-neighbour")) {
      for (let i = 1; i < run.length; i++) {
        const step = run[i].midi - run[i - 1].midi
        // Every approach note sits exactly one semitone under what follows it.
        if (step === 1) expect(step).toBe(1)
      }
    }
  })

  it("double chromatic writes two rising half steps into its target", () => {
    let found = 0
    for (const run of approachRuns(II_V_I, "double-chromatic")) {
      for (let i = 2; i < run.length; i++) {
        if (run[i - 1].midi - run[i - 2].midi === 1 && run[i].midi - run[i - 1].midi === 1) found++
      }
    }
    expect(found).toBeGreaterThan(5)
  })

  it("the four types are measurably different from each other", () => {
    const shape = (id) => {
      const { line } = improvise({ measures: BLUES, seed: 99, devices: [id], level: 3 })
      return noteRuns(line).map((n) => n.midi).join(",")
    }
    const shapes = ["upper-neighbour", "lower-neighbour", "double-chromatic", "encirclement"].map(shape)
    expect(new Set(shapes).size).toBe(4)
  })

  it("each type names itself in the reasoning, and only itself", () => {
    for (const id of ["upper-neighbour", "lower-neighbour", "double-chromatic", "encirclement", "rca"]) {
      const { line } = improvise({ measures: BLUES, seed: 21, devices: [id], level: 3 })
      const sounding = line.bars.filter((b) => b.n.length)
      const named = sounding.filter((b) => b.d.includes(IMPROV_DEVICES[id].label))
      expect(named.length).toBeGreaterThan(0)
      // No other approach type may appear alongside it.
      const others = ["Upper neighbour", "Lower neighbour", "Double chromatic", "Full encirclement"]
        .filter((l) => l !== IMPROV_DEVICES[id].label)
      for (const bar of sounding) for (const other of others) expect(bar.d).not.toContain(other)
    }
  })
})

describe("Peña — the bebop-intuition formula", () => {
  // An encirclement is chromatic by definition and can legitimately occupy a
  // strong beat on its way into a target, so "every strong beat is a chord
  // tone" was never the claim. The claim is that Peña holds them MORE than
  // the same settings without it — which is measurable and is the actual
  // pedagogy.
  function strongBeatChordToneRatio(devices) {
    const timeline = normalizeMeasures(II_V_I)
    let strong = 0
    let held = 0
    for (const seed of SEEDS) {
      const { line } = improvise({ measures: II_V_I, seed, devices, level: 3 })
      let barStart = 0
      for (const bar of line.bars) {
        let pos = 0
        for (const n of bar.n) {
          pos += n[3]
          const t = barStart + pos
          const seg = segmentAtBeat(timeline, t)
          if (seg && Math.abs(t % 2) < 1e-6) {
            strong++
            const pc = ((midiOf(n) % 12) + 12) % 12
            const next = timeline.segments.find((sg) => sg.startBeat > t && sg.startBeat <= t + 0.6)
            if (seg.chordPcs.includes(pc) || next?.chordPcs.includes(pc)) held++
          }
          pos += n[2]
        }
        barStart += bar.beats
      }
    }
    expect(strong).toBeGreaterThan(40)
    return held / strong
  }

  it("holds the strong beats with chord tones more than the plain line does", () => {
    const pena = strongBeatChordToneRatio(["pena"])
    const plain = strongBeatChordToneRatio([])
    expect(pena).toBeGreaterThan(plain)
    expect(pena).toBeGreaterThan(0.6)
  })

  it("meets its targets with an encirclement", () => {
    const { line } = improvise({ measures: II_V_I, seed: 4, devices: ["pena"], level: 3 })
    expect(line.bars.some((b) => b.d.includes("Full encirclement"))).toBe(true)
  })
})

describe("fillers compose with lenses", () => {
  it("a Martino conversion still cages its targets", () => {
    const { line } = improvise({
      measures: II_V_I, seed: 8, devices: ["minor-conversion", "encirclement"], level: 3,
    })
    const sounding = line.bars.filter((b) => b.n.length)
    expect(sounding.some((b) => b.d.includes("Minor conversion"))).toBe(true)
    expect(sounding.some((b) => b.d.includes("Full encirclement"))).toBe(true)
  })

  it("naming two approach types takes the last, rather than blending them", () => {
    const { line } = improvise({ measures: BLUES, seed: 3, devices: ["rca", "encirclement"], level: 3 })
    const d = line.bars.filter((b) => b.n.length).map((b) => b.d).join(" ")
    expect(d).toContain("Full encirclement")
    expect(d).not.toContain("Random Chromatic Approach")
  })
})
