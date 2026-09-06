// The Workbench's scoring. This is the part of Chapter 9 a student is
// actually graded by, so the judgement calls in it are worth pinning down —
// especially the one that separates a wrong note from a right note in the
// wrong place.

import { describe, it, expect } from "vitest"
import { compareAnswer, flattenLine, midiAt, noteName } from "../workbench"
import { improvise } from "../improviser"

const note = (midi) => ({ midi })

describe("reading a line", () => {
  it("flattens a generated line into sounding order", () => {
    const { line } = improvise({ measures: ["Dm7", "G7", "Cmaj7", "Cmaj7"], seed: 9, level: 3 })
    const notes = flattenLine(line)
    expect(notes.length).toBe(line.bars.reduce((n, b) => n + b.n.length, 0))
    for (const n of notes) expect(n.midi).toBe(midiAt(n.string, n.fret))
  })

  it("survives an empty or missing line rather than throwing mid-lesson", () => {
    expect(flattenLine(null)).toEqual([])
    expect(flattenLine({ bars: [] })).toEqual([])
    expect(flattenLine({ bars: [{ n: null }] })).toEqual([])
  })
})

describe("scoring an answer", () => {
  it("a perfect answer is all exact", () => {
    const ref = [note(60), note(62), note(64)]
    const result = compareAnswer(ref, [note(60), note(62), note(64)])
    expect(result.exact).toBe(3)
    expect(result.total).toBe(3)
    expect(result.rows.every((r) => r.verdict === "exact")).toBe(true)
  })

  it("calls the right note in the wrong octave an octave error, not a wrong note", () => {
    // The distinction the whole panel turns on: this student heard the line
    // correctly and fingered it badly. Scoring it as "wrong" would send them
    // back to ear training when the problem is on the neck.
    const result = compareAnswer([note(60)], [note(72)])
    expect(result.rows[0].verdict).toBe("octave")
    expect(result.octave).toBe(1)
    expect(result.wrong).toBe(0)
    expect(result.exact).toBe(0)
  })

  it("a genuinely wrong note is wrong", () => {
    const result = compareAnswer([note(60)], [note(61)])
    expect(result.rows[0].verdict).toBe("wrong")
    expect(result.wrong).toBe(1)
  })

  it("a short answer leaves the rest missing, and doesn't count them against the ear", () => {
    const result = compareAnswer([note(60), note(62), note(64)], [note(60)])
    expect(result.rows.map((r) => r.verdict)).toEqual(["exact", "missing", "missing"])
    expect(result.exact).toBe(1)
    expect(result.total).toBe(3)
  })

  it("a long answer marks the surplus as extra", () => {
    const result = compareAnswer([note(60)], [note(60), note(62)])
    expect(result.rows.map((r) => r.verdict)).toEqual(["exact", "extra"])
    // Extras don't inflate the score.
    expect(result.exact).toBe(1)
    expect(result.total).toBe(1)
  })

  it("an empty answer scores nothing rather than crashing", () => {
    const result = compareAnswer([note(60), note(62)], [])
    expect(result.exact).toBe(0)
    expect(result.rows.every((r) => r.verdict === "missing")).toBe(true)
  })

  it("every row carries both sides, so the UI can show what you played", () => {
    const result = compareAnswer([note(60)], [note(61)])
    expect(result.rows[0].ref.midi).toBe(60)
    expect(result.rows[0].got.midi).toBe(61)
  })

  it("names notes the way the rest of the app spells them", () => {
    expect(noteName(60)).toBe("C")
    expect(noteName(61)).toBe("Db")
    expect(noteName(midiAt(1, 0))).toBe("E")   // open high E
    expect(noteName(midiAt(6, 0))).toBe("E")   // open low E
  })

  it("scores a real generated phrase against itself as perfect", () => {
    const { line } = improvise({ measures: ["Cmaj7", "Cmaj7"], seed: 4, level: 2 })
    const notes = flattenLine(line)
    const result = compareAnswer(notes, notes)
    expect(result.exact).toBe(notes.length)
    expect(result.wrong).toBe(0)
  })
})
