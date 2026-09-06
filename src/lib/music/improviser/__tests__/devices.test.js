// Device lenses and the level ladder. These are the curriculum's gates
// expressed as assertions — "level 1 is chord tones only" and "the Martino
// conversion plays the related minor" are things a student is graded on, so
// they're things the engine has to be held to.
//
// Same discipline as improviser.test.js: behavior with tolerances, aggregated
// over many seeds, never a frozen transcript of one line.

import { describe, it, expect } from "vitest"
import { improvise, IMPROV_DEVICES, IMPROV_LEVELS } from "../index"
import { normalizeMeasures, segmentAtBeat, toPcs } from "../chartTimeline"
import { applyDevices } from "../devices"
import { chordNotes, scaleNotes } from "@/lib/music/tonal"

const II_V_I = ["Dm7", "G7", "Cmaj7", "Cmaj7"]
const BLUES = ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "D7", "Gm7", "C7", "F7", "C7"]

const OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 }
const midiOf = ([s, f]) => OPEN_MIDI[s] + f
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 1)

// Every note with the beat it starts on, so a note can be matched to the
// chord segment that was actually sounding under it.
function absoluteNotes(line) {
  const notes = []
  let barStart = 0
  for (const bar of line.bars) {
    let pos = 0
    for (const n of bar.n) {
      pos += n[3]
      notes.push({ t: barStart + pos, pc: ((midiOf(n) % 12) + 12) % 12 })
      pos += n[2]
    }
    barStart += bar.beats
  }
  return notes
}

// Fraction of notes whose pitch class is in the pool `pick` draws off the
// chord they belong to.
//
// "Belong to" is the subtlety: the bebop profile ANTICIPATES, landing the
// next chord's guide tone on the "&" before the barline. Such a note sounds
// over the old chord but spells the new one, on purpose — so a note in the
// half beat before a change is allowed to match either side. Attributing it
// only to the chord underneath it would report the engine's best feature as
// an impurity.
function inPoolRatio(measures, opts, pick) {
  const timeline = normalizeMeasures(measures)
  let hits = 0
  let total = 0
  for (const seed of SEEDS) {
    const { line } = improvise({ measures, seed, ...opts })
    for (const note of absoluteNotes(line)) {
      const seg = segmentAtBeat(timeline, note.t)
      if (!seg) continue
      const anticipating = timeline.segments.find(
        (s) => s.startBeat > note.t && s.startBeat <= note.t + 0.6
      )
      total++
      if (pick(seg).includes(note.pc)) hits++
      else if (anticipating && pick(anticipating).includes(note.pc)) hits++
    }
  }
  expect(total).toBeGreaterThan(200) // the sample has to be worth believing
  return hits / total
}

describe("the default path is untouched", () => {
  // The whole design rests on devices and levels drawing nothing from the
  // rng. If that ever stops being true, every saved seed in the app
  // silently replays a different line.
  it("no devices and no level reproduces the pre-device line exactly", () => {
    for (const measures of [II_V_I, BLUES]) {
      const plain = improvise({ measures, seed: 42 })
      const explicit = improvise({ measures, seed: 42, devices: [], level: null, tag: "" })
      expect(explicit.line).toEqual(plain.line)
    }
  })

  it("an unknown device id degrades to a plainer exercise instead of throwing", () => {
    const plain = improvise({ measures: II_V_I, seed: 42 })
    const bogus = improvise({ measures: II_V_I, seed: 42, devices: ["not-built-yet"] })
    expect(bogus.line).toEqual(plain.line)
  })

  it("a lens that can't read a chord leaves it alone", () => {
    // Tritone sub is dominant-only; a maj7-and-minor chart has nothing for it.
    const measures = ["Dm7", "Cmaj7"]
    const plain = improvise({ measures, seed: 9 })
    const subbed = improvise({ measures, seed: 9, devices: ["tritone-sub"] })
    expect(subbed.line).toEqual(plain.line)
  })
})

describe("levels", () => {
  it("level 1 plays chord tones and nothing else", () => {
    const ratio = inPoolRatio(BLUES, { level: 1 }, (seg) => seg.chordPcs)
    expect(ratio).toBe(1)
  })

  it("level 1 is quieter and sparser than level 3", () => {
    const count = (opts) => SEEDS.reduce((sum, seed) => {
      const { line } = improvise({ measures: BLUES, seed, ...opts })
      return sum + line.bars.reduce((n, bar) => n + bar.n.length, 0)
    }, 0)
    expect(count({ level: 1 })).toBeLessThan(count({ level: 3 }) * 0.75)
  })

  it("level 3 leaves the chord tones for chromatic approach notes", () => {
    // Level 3's whole job is notes that are deliberately outside the chord.
    const ratio = inPoolRatio(BLUES, { level: 3 }, (seg) => seg.chordPcs)
    expect(ratio).toBeLessThan(0.8)
  })

  it("every rung generates sound on every fixture", () => {
    for (const level of Object.keys(IMPROV_LEVELS).map(Number)) {
      for (const measures of [II_V_I, BLUES]) {
        const { line } = improvise({ measures, level, seed: 11 })
        expect(line.bars.flatMap((b) => b.n).length).toBeGreaterThan(0)
      }
    }
  })

  it("a level still replays identically from its seed", () => {
    const a = improvise({ measures: BLUES, seed: 7, level: 4 })
    const b = improvise({ measures: BLUES, seed: 7, level: 4 })
    expect(a.line).toEqual(b.line)
  })
})

describe("minor conversion (Martino)", () => {
  const timeline = applyDevices(normalizeMeasures(II_V_I), { devices: ["minor-conversion"] })
  const seg = (beat) => segmentAtBeat(timeline, beat)

  it("converts a dominant to the minor a fifth above", () => {
    // G7 → Dm7: the ii minor played over both the ii and the V.
    expect(seg(4).symbol).toBe("G7")            // the chord itself is untouched
    expect(seg(4).scalePcs.sort()).toEqual(toPcs(scaleNotes("dorian", "D")).sort())
    expect(seg(4).pitchPcs.sort()).toEqual(toPcs(chordNotes("Dm7")).sort())
  })

  it("converts a major chord to its relative minor", () => {
    expect(seg(8).pitchPcs.sort()).toEqual(toPcs(chordNotes("Am7")).sort())
  })

  it("leaves a minor chord at home", () => {
    expect(seg(0).pitchPcs.sort()).toEqual(toPcs(chordNotes("Dm7")).sort())
  })

  it("still lands the REAL chord's 3rd or 7th at the change", () => {
    // The point of the conversion is that the guide tones don't move — only
    // the colour around them does.
    expect(seg(4).thirdPc).toBe(11)   // B, the 3rd of G7
    expect(seg(4).seventhPc).toBe(5)  // F, its 7th
  })

  it("the line it produces really does draw on the converted minor", () => {
    const ratio = inPoolRatio(II_V_I, { devices: ["minor-conversion"], level: 2 },
      (seg) => seg.scalePcs)
    expect(ratio).toBeGreaterThan(0.85)
  })
})

describe("tritone substitution", () => {
  const timeline = applyDevices(normalizeMeasures(II_V_I), { devices: ["tritone-sub"] })

  it("swaps the dominant for the one a tritone away", () => {
    expect(segmentAtBeat(timeline, 4).symbol).toBe("Db7")
  })

  it("keeps the shared tritone, with the 3rd and 7th swapping roles", () => {
    const sub = segmentAtBeat(timeline, 4)
    // G7 is B (3rd) and F (7th); Db7 is F (3rd) and B/Cb (7th).
    expect(sub.thirdPc).toBe(5)    // F
    expect(sub.seventhPc).toBe(11) // B
  })

  it("leaves the ii and the I alone", () => {
    expect(segmentAtBeat(timeline, 0).symbol).toBe("Dm7")
    expect(segmentAtBeat(timeline, 8).symbol).toBe("Cmaj7")
  })

  it("hands the substituted chord — not the original — to the next lens", () => {
    // Chapter 7.1: convert the substituted dominant the same way as the
    // original. Db7 converts to Abm7; reading a stale root would convert the
    // G7 that is no longer there and quietly teach the wrong shape.
    const chained = applyDevices(normalizeMeasures(II_V_I),
      { devices: ["tritone-sub", "minor-conversion"] })
    const seg = segmentAtBeat(chained, 4)
    expect(seg.symbol).toBe("Db7")
    expect(seg.pitchPcs.sort()).toEqual(toPcs(chordNotes("Abm7")).sort())
    expect(seg.deviceNotes.join(" ")).toContain("Abm7 over Db7")
  })
})

describe("other lenses", () => {
  it("the bebop scale adds its passing tone to the pool", () => {
    const timeline = applyDevices(normalizeMeasures(["G7"]), { devices: ["bebop-scale"] })
    const seg = segmentAtBeat(timeline, 0)
    expect(seg.scalePcs.length).toBe(8)
    expect(seg.scalePcs).toContain(6) // F#, the major 7th over G7
  })

  it("triads drop the 7th", () => {
    const timeline = applyDevices(normalizeMeasures(["Cmaj7"]), { devices: ["triads"] })
    expect(segmentAtBeat(timeline, 0).pitchPcs.sort((a, b) => a - b)).toEqual([0, 4, 7])
  })

  it("triads narrows the anchors too, not just the fill", () => {
    // Otherwise a "triads only" drill still lands the 7th at chord changes,
    // because anchors are drawn from the chord, not the fill pool.
    const timeline = applyDevices(normalizeMeasures(["Cmaj7"]), { devices: ["triads"] })
    const seg = segmentAtBeat(timeline, 0)
    expect(seg.chordPcs).not.toContain(11) // B, the maj7
    expect(seg.seventhPc).toBe(7)          // falls back to the 5th
  })

  it("triads at level 1 plays the bare triad and nothing else", () => {
    // Fmaj7's 7th is E, which is NOT in the F triad — so this fixture would
    // catch a 7th leaking in through an anchor.
    const ratio = inPoolRatio(["Fmaj7", "Fmaj7", "Bbmaj7", "Bbmaj7"],
      { devices: ["triads"], level: 1 }, (seg) => seg.pitchPcs)
    expect(ratio).toBe(1)
  })

  it("altered forces every dominant onto the altered scale", () => {
    const timeline = applyDevices(normalizeMeasures(II_V_I), { devices: ["altered"] })
    const seg = segmentAtBeat(timeline, 4)
    expect(seg.scalePcs.sort()).toEqual(toPcs(scaleNotes("altered", "G")).sort())
    expect(seg.alteredPcs).toBeNull() // the probabilistic path is now inert
    expect(segmentAtBeat(timeline, 0).scalePcs).not.toContain(1) // ii untouched
  })

  it("scale choice names the scale outright", () => {
    const timeline = applyDevices(normalizeMeasures(["Cmaj7"]),
      { devices: [{ id: "scale-choice", scale: "lydian" }] })
    expect(segmentAtBeat(timeline, 0).scalePcs).toContain(6) // F#, the #11
  })

  it("lenses compose in the order given", () => {
    // Convert to the related minor first, then bebop THAT scale.
    const timeline = applyDevices(normalizeMeasures(["G7"]),
      { devices: ["minor-conversion", "bebop-scale"] })
    const seg = segmentAtBeat(timeline, 0)
    expect(seg.deviceLabels).toEqual([
      IMPROV_DEVICES["minor-conversion"].label,
      IMPROV_DEVICES["bebop-scale"].label,
    ])
    expect(seg.pitchPcs.sort()).toEqual(toPcs(chordNotes("Dm7")).sort())
    expect(seg.scalePcs.length).toBe(8)
  })
})

describe("per-bar attribution", () => {
  it("names the devices that actually ran, not the ones that were asked for", () => {
    const { line } = improvise({
      measures: II_V_I, seed: 3, devices: ["minor-conversion"], level: 2,
    })
    const sounding = line.bars.filter((bar) => bar.n.length)
    expect(sounding.length).toBeGreaterThan(0)
    for (const bar of sounding) {
      expect(bar.d).toContain("Minor conversion")
      expect(bar.x).toMatch(/seed 3/)
    }
  })

  it("a plain line reports the note-level devices it used", () => {
    const { line } = improvise({ measures: BLUES, seed: 5, level: 3 })
    const sounding = line.bars.filter((bar) => bar.n.length)
    const devices = new Set(sounding.flatMap((bar) => bar.d.split(" · ")))
    expect(devices.has("guide tone") || devices.has("chord tone")).toBe(true)
    expect([...devices]).not.toContain("Improviser") // every sounding bar is explained
  })

  it("a curriculum tag is stamped on every bar", () => {
    const { line, trace } = improvise({
      measures: II_V_I, seed: 8, devices: ["minor-conversion"], level: 2,
      tag: "[Ch.1 · 1.3 Martino]",
    })
    expect(trace.tag).toBe("[Ch.1 · 1.3 Martino]")
    for (const bar of line.bars) expect(bar.x.startsWith("[Ch.1 · 1.3 Martino]")).toBe(true)
  })

  it("a silent bar is still labelled, and stays silent", () => {
    const { line } = improvise({ measures: ["Dm7", "N.C.", "Cmaj7"], seed: 2, tag: "[Ch.2]" })
    expect(line.bars[1].n.length).toBe(0)
    expect(line.bars[1].x).toContain("[Ch.2]")
  })
})

describe("role naming", () => {
  it("calls a 5th a 5th, even when it's standing in as the guide tone", () => {
    // The Triads lens drops the 7th, so guidePcsFor falls back to the 5th.
    // Labelling that note "7th of Cmaj7" would be the reasoning strip lying —
    // the exact thing per-bar attribution exists to prevent.
    const { line } = improvise({
      measures: ["Cmaj7", "Cmaj7", "Cmaj7", "Cmaj7"], seed: 7974800,
      devices: ["triads"], level: 1,
    })
    const reasons = line.bars.map((bar) => bar.x).join(" ")
    expect(reasons).not.toContain("7th of Cmaj7")
  })
})
