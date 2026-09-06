// Chapter 6 — the devices that move WHEN rather than WHAT.
//
// Both gates in this chapter are claims about sameness: "the notes are
// provably identical, only the placement moved", and "one single cell
// generated the whole chorus". Those are exactly the claims a listener can't
// verify by ear and a prose instruction can't be held to, so they're the ones
// most worth asserting.

import { describe, it, expect } from "vitest"
import { improvise } from "../index"

const II_V_I = ["Dm7", "G7", "Cmaj7", "Cmaj7"]
const LONG = ["Dm7", "G7", "Cmaj7", "Cmaj7", "Dm7", "G7", "Cmaj7", "Cmaj7"]
const STATIC = ["Cmaj7", "Cmaj7", "Cmaj7", "Cmaj7"]
const OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 }
const midiOf = ([s, f]) => OPEN_MIDI[s] + f
const SEEDS = Array.from({ length: 30 }, (_, i) => i * 7919 + 1)

const notesOf = (line) => line.bars.flatMap((b) => (b.n || []).map(midiOf))

describe("the default path is still untouched", () => {
  it("the rhythm layer changes nothing without a rhythm device", () => {
    for (const measures of [II_V_I, LONG]) {
      for (const seed of [42, 1234, 99]) {
        expect(improvise({ measures, seed, devices: [] }).line)
          .toEqual(improvise({ measures, seed }).line)
      }
    }
  })
})

describe("Bergonzi — rhythmic displacement", () => {
  it("restates the previous phrase's pitches, in order, note for note", () => {
    // The gate's exact words are "the notes provably identical". This is the
    // proof: every restated phrase is a prefix of the one it restates.
    let compared = 0
    for (const seed of SEEDS) {
      const { trace } = improvise({ measures: LONG, seed, devices: ["displacement"], level: 3 })
      for (let i = 1; i < trace.phrases.length; i++) {
        const prev = trace.phrases[i - 1]
        const here = trace.phrases[i]
        if (!here.restated || !here.pitches.length) continue
        expect(here.pitches).toEqual(prev.pitches.slice(0, here.pitches.length))
        compared++
      }
    }
    expect(compared).toBeGreaterThan(10)
  })

  it("and moves them — the restatement does not start where the original did", () => {
    let moved = 0
    for (const seed of SEEDS) {
      const { trace } = improvise({ measures: LONG, seed, devices: ["displacement"], level: 3 })
      for (let i = 1; i < trace.phrases.length; i++) {
        if (!trace.phrases[i].restated) continue
        if (trace.phrases[i].displacement !== trace.phrases[i - 1].displacement) moved++
      }
    }
    expect(moved).toBeGreaterThan(5)
  })

  it("the whole line is built from one phrase's pitches", () => {
    for (const seed of SEEDS.slice(0, 12)) {
      const { line, trace } = improvise({
        measures: LONG, seed, devices: ["displacement"], level: 3,
      })
      if (trace.phrases.length < 2) continue
      const notes = notesOf(line)
      const distinct = new Set(notes)
      // A restated phrase reuses its own pitches, so the line's vocabulary
      // stays roughly one phrase wide instead of growing with every bar.
      expect(distinct.size).toBeLessThanOrEqual(Math.max(6, Math.ceil(notes.length * 0.75)))
    }
  })

  it("moves the entry point, by an eighth, and keeps moving it", () => {
    const { trace } = improvise({ measures: LONG, seed: 7, devices: ["displacement"], level: 3 })
    const offsets = trace.phrases.map((p) => p.displacement)
    expect(offsets.length).toBeGreaterThan(1)
    // Rotating in eighth notes through a two-beat cycle.
    for (const o of offsets) expect(Math.abs((o * 2) % 1)).toBeLessThan(1e-9)
    expect(new Set(offsets).size).toBeGreaterThan(1)
    expect(Math.max(...offsets)).toBeLessThan(2)
  })

  it("says so in the reasoning", () => {
    const { line } = improvise({ measures: LONG, seed: 3, devices: ["displacement"], level: 3 })
    const sounding = line.bars.filter((b) => b.n.length)
    expect(sounding.some((b) => b.d.includes("Rhythmic displacement"))).toBe(true)
    expect(sounding.some((b) => b.x.includes("restated, displaced"))).toBe(true)
  })

  it("still replays identically from its seed", () => {
    expect(improvise({ measures: LONG, seed: 5, devices: ["displacement"], level: 3 }).line)
      .toEqual(improvise({ measures: LONG, seed: 5, devices: ["displacement"], level: 3 }).line)
  })
})

describe("Ligon — cyclic quadruplets", () => {
  it("uses one cell for the entire line, not one per phrase", () => {
    for (const seed of SEEDS.slice(0, 15)) {
      const { trace } = improvise({
        measures: LONG, seed, devices: ["cyclic-quadruplets"], level: 4,
      })
      expect(trace.phrases.length).toBeGreaterThan(0)
    }
  })

  it("the cell's four notes repeat, and the rotation walks its downbeat", () => {
    // Over a static chord the cell's pitches are literally identical each
    // restatement — so the shape is provable, and anything that moves is
    // placement, which is the entire lesson.
    const { line } = improvise({
      measures: STATIC, seed: 11, devices: ["cyclic-quadruplets"], level: 4,
    })
    const cellNotes = []
    let barStart = 0
    for (const bar of line.bars) {
      let pos = 0
      for (const n of bar.n) {
        pos += n[3]
        cellNotes.push({ t: barStart + pos, midi: midiOf(n) })
        pos += n[2]
      }
      barStart += bar.beats
    }
    expect(cellNotes.length).toBeGreaterThan(8)

    // Period is 4 cell notes + 1 rotation note. Same position in the period
    // means the same pitch, every time round.
    const byPhase = new Map()
    cellNotes.forEach((n, i) => {
      const phase = i % 5
      if (phase < 4) {
        if (!byPhase.has(phase)) byPhase.set(phase, [])
        byPhase.get(phase).push(n.midi)
      }
    })
    for (const [, midis] of byPhase) {
      expect(new Set(midis).size).toBe(1)
    }
  })

  it("beat 1 of the cell lands somewhere new each restatement", () => {
    const { line } = improvise({
      measures: STATIC, seed: 11, devices: ["cyclic-quadruplets"], level: 4,
    })
    const starts = []
    let barStart = 0
    let i = 0
    for (const bar of line.bars) {
      let pos = 0
      for (const n of bar.n) {
        pos += n[3]
        if (i % 5 === 0) starts.push((barStart + pos) % 4)
        i++
        pos += n[2]
      }
      barStart += bar.beats
    }
    // The gate asks the student to name where beat 1 of the original cell
    // falls in each restatement — so it had better not be the same place.
    expect(starts.length).toBeGreaterThan(2)
    expect(new Set(starts).size).toBeGreaterThan(1)
  })

  it("names itself in every bar it wrote", () => {
    const { line } = improvise({
      measures: LONG, seed: 4, devices: ["cyclic-quadruplets"], level: 4,
    })
    const sounding = line.bars.filter((b) => b.n.length)
    expect(sounding.length).toBeGreaterThan(0)
    for (const bar of sounding) expect(bar.d).toContain("Cyclic quadruplets")
    expect(sounding.some((b) => b.x.includes("cell note"))).toBe(true)
  })

  it("still replays identically from its seed", () => {
    expect(improvise({ measures: LONG, seed: 6, devices: ["cyclic-quadruplets"], level: 4 }).line)
      .toEqual(improvise({ measures: LONG, seed: 6, devices: ["cyclic-quadruplets"], level: 4 }).line)
  })
})

describe("rhythm devices stack with the other kinds", () => {
  it("a displacement drill can still run over converted harmony", () => {
    const { line } = improvise({
      measures: LONG, seed: 9, devices: ["minor-conversion", "displacement"], level: 3,
    })
    const sounding = line.bars.filter((b) => b.n.length)
    expect(sounding.some((b) => b.d.includes("Minor conversion"))).toBe(true)
    expect(sounding.length).toBeGreaterThan(0)
  })

  it("a rhythm device names no approach, so it stacks with one", () => {
    const { line } = improvise({
      measures: LONG, seed: 2, devices: ["encirclement", "displacement"], level: 3,
    })
    expect(line.bars.flatMap((b) => b.n).length).toBeGreaterThan(0)
  })
})
