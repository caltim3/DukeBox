// Chapters 4 and 5 — triad pairs, hexatonics, pentatonics, wide intervals.
//
// The load-bearing claim here is Vincent's: a hexatonic IS a triad pair, heard
// differently. Chapter 1.4 alternates the two triads and Chapter 4.1 fuses the
// same two into a scale, so if those ever came apart the curriculum would be
// teaching a relationship the app doesn't have. That's the first thing tested.

import { describe, it, expect } from "vitest"
import { improvise, IMPROV_DEVICES } from "../index"
import { applyDevices } from "../devices"
import { normalizeMeasures, segmentAtBeat } from "../chartTimeline"
import { hexatonicFor, pentatonicFor, triadPairFor, TRIAD_PAIR_TABLE } from "../structures"

const QUALITIES = ["Cmaj7", "Cm7", "C7", "Cm7b5", "Cdim7", "C7alt"]
const II_V_I = ["Dm7", "G7", "Cmaj7", "Cmaj7"]
const BLUES = ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "D7"]
const OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 }
const midiOf = ([s, f]) => OPEN_MIDI[s] + f
const SEEDS = Array.from({ length: 30 }, (_, i) => i * 7919 + 1)

const segOf = (symbol) => segmentAtBeat(normalizeMeasures([symbol]), 0)

describe("the triad-pair table", () => {
  it("every pair is disjoint — six distinct notes, not five", () => {
    // A pair sharing a tone fuses into a five-note scale, and then it isn't a
    // hexatonic and the two triads aren't separable by ear either.
    for (const symbol of QUALITIES) {
      const { a, b } = triadPairFor(segOf(symbol))
      const shared = a.pcs.filter((pc) => b.pcs.includes(pc))
      expect(shared, `${symbol}: ${a.name} and ${b.name} share ${shared}`).toEqual([])
    }
  })

  it("covers every quality the chart parser can produce a pair for", () => {
    for (const symbol of QUALITIES) {
      const seg = segOf(symbol)
      expect(TRIAD_PAIR_TABLE[seg.quality], `no pair for ${seg.quality}`).toBeTruthy()
    }
  })

  it("the hexatonic is exactly the pair fused — the curriculum's whole claim", () => {
    for (const symbol of QUALITIES) {
      const seg = segOf(symbol)
      const { a, b } = triadPairFor(seg)
      const hex = hexatonicFor(seg)
      expect(hex.pcs.length).toBe(6)
      expect([...hex.pcs].sort()).toEqual([...new Set([...a.pcs, ...b.pcs])].sort())
    }
  })

  it("reproduces the pairs the curriculum names by hand", () => {
    // The source outline says maj7 pairs C+D and dom7 pairs bVII+I.
    expect(triadPairFor(segOf("Cmaj7")).a.name).toBe("C major")
    expect(triadPairFor(segOf("Cmaj7")).b.name).toBe("D major")
    expect(triadPairFor(segOf("C7")).a.name).toBe("Bb major")
    expect(triadPairFor(segOf("C7")).b.name).toBe("C major")
  })

  it("a borrowed hexatonic really is transposed, and still six notes", () => {
    const seg = segOf("Cmaj7")
    const home = hexatonicFor(seg)
    for (const borrow of [1, 6]) {
      const away = hexatonicFor(seg, { shift: borrow })
      expect(away.pcs.length).toBe(6)
      expect(away.pcs).toEqual(home.pcs.map((pc) => (pc + borrow) % 12).sort((x, y) => x - y))
    }
  })

  it("a tritone spread gives a different six notes from the standard pair", () => {
    const seg = segOf("Cmaj7")
    expect(hexatonicFor(seg, { spread: 6 }).pcs).not.toEqual(hexatonicFor(seg).pcs)
  })

  it("every quality has a pentatonic, and it has five notes", () => {
    for (const symbol of QUALITIES) {
      const pent = pentatonicFor(segOf(symbol))
      expect(pent, `no pentatonic for ${symbol}`).toBeTruthy()
      expect(pent.pcs.length).toBe(5)
    }
  })
})

describe("hexatonics and pentatonics as lenses", () => {
  // "Nothing else" would be wrong to assert: the anchors still spell the real
  // chord, and a hexatonic doesn't necessarily contain its chord's guide tones
  // (C+D over Cmaj7 has no B). That's correct — the pair colours the line, the
  // harmony still lands. Chromatic enclosures at L4 are the rest.
  it("a hexatonic line is built from its six notes plus the chord it lands on", () => {
    const timeline = applyDevices(normalizeMeasures(II_V_I), { devices: ["hexatonics"] })
    let inPool = 0
    let total = 0
    for (const seed of SEEDS) {
      const { line } = improvise({ measures: II_V_I, seed, devices: ["hexatonics"], level: 4 })
      let barStart = 0
      for (const bar of line.bars) {
        let pos = 0
        for (const n of bar.n) {
          pos += n[3]
          const seg = segmentAtBeat(timeline, barStart + pos)
          if (seg) {
            total++
            const pc = ((midiOf(n) % 12) + 12) % 12
            const next = timeline.segments.find((sg) => sg.startBeat > barStart + pos && sg.startBeat <= barStart + pos + 0.6)
            if (seg.scalePcs.includes(pc) || seg.chordPcs.includes(pc) || next?.chordPcs.includes(pc)) inPool++
          }
          pos += n[2]
        }
        barStart += bar.beats
      }
    }
    expect(total).toBeGreaterThan(150)
    expect(inPool / total).toBeGreaterThan(0.9)
  })

  it("and the hexatonic really is doing the colouring, not the chord", () => {
    // Guard against the lens quietly doing nothing: the six notes have to
    // account for far more of the line than the bare chord tones do.
    const timeline = applyDevices(normalizeMeasures(II_V_I), { devices: ["hexatonics"] })
    let fromHex = 0
    let chordOnly = 0
    for (const seed of SEEDS) {
      const { line } = improvise({ measures: II_V_I, seed, devices: ["hexatonics"], level: 4 })
      let barStart = 0
      for (const bar of line.bars) {
        let pos = 0
        for (const n of bar.n) {
          pos += n[3]
          const seg = segmentAtBeat(timeline, barStart + pos)
          if (seg) {
            const pc = ((midiOf(n) % 12) + 12) % 12
            if (seg.scalePcs.includes(pc)) fromHex++
            else if (seg.chordPcs.includes(pc)) chordOnly++
          }
          pos += n[2]
        }
        barStart += bar.beats
      }
    }
    expect(fromHex).toBeGreaterThan(chordOnly * 2)
  })

  it("the pentatonic lens says which pentatonic it chose", () => {
    const timeline = applyDevices(normalizeMeasures(["C7"]), { devices: ["pentatonic"] })
    const seg = segmentAtBeat(timeline, 0)
    expect(seg.scalePcs.length).toBe(5)
    expect(seg.deviceNotes.join(" ")).toContain("Bb major pentatonic")
  })

  it("the blues option is a different scale from the pentatonic", () => {
    const pent = applyDevices(normalizeMeasures(["C7"]), { devices: ["pentatonic"] })
    const blues = applyDevices(normalizeMeasures(["C7"]), { devices: [{ id: "pentatonic", blues: true }] })
    expect(segmentAtBeat(blues, 0).scalePcs).not.toEqual(segmentAtBeat(pent, 0).scalePcs)
    expect(segmentAtBeat(blues, 0).deviceNotes.join(" ")).toContain("blues")
  })
})

describe("Vincent — triad pairs alternate, and never blend", () => {
  it("plays three notes of one triad, then three of the other", () => {
    const timeline = normalizeMeasures(["Cmaj7", "Cmaj7", "Cmaj7", "Cmaj7"])
    const { line } = improvise({
      measures: ["Cmaj7", "Cmaj7", "Cmaj7", "Cmaj7"], seed: 13,
      devices: ["triad-pairs"], level: 4,
    })
    const seg = segmentAtBeat(timeline, 0)
    const { a, b } = triadPairFor(seg)
    const pcs = line.bars.flatMap((bar) => bar.n.map((n) => ((midiOf(n) % 12) + 12) % 12))
    expect(pcs.length).toBeGreaterThan(6)
    // Every note belongs to one triad or the other — nothing in between.
    for (const pc of pcs) expect(a.pcs.includes(pc) || b.pcs.includes(pc)).toBe(true)
    // And they arrive in threes, alternating.
    for (let i = 0; i < pcs.length; i++) {
      const expected = Math.floor(i / 3) % 2 === 0 ? a : b
      expect(expected.pcs, `note ${i} came from the wrong triad`).toContain(pcs[i])
    }
  })

  it("names the triad it is currently on", () => {
    const { line } = improvise({
      measures: ["Cmaj7", "Cmaj7"], seed: 13, devices: ["triad-pairs"], level: 4,
    })
    const sounding = line.bars.filter((bar) => bar.n.length)
    for (const bar of sounding) expect(bar.d).toContain("Triad pairs")
    expect(sounding.map((b) => b.x).join(" ")).toMatch(/(C major|D major) triad/)
  })
})

describe("Bergonzi — wide intervals", () => {
  it("mostly refuses to step", () => {
    let wide = 0
    let total = 0
    for (const seed of SEEDS) {
      const { line } = improvise({ measures: BLUES, seed, devices: ["wide-interval"], level: 4 })
      const notes = line.bars.flatMap((bar) => bar.n.map(midiOf))
      for (let i = 1; i < notes.length; i++) {
        const leap = Math.abs(notes[i] - notes[i - 1])
        if (leap === 0) continue
        total++
        if (leap >= 5) wide++
      }
    }
    expect(total).toBeGreaterThan(100)
    // Anchors and landings are still placed by voice leading, so this can't be
    // 100% — but the plain line is heavily stepwise, so the contrast is stark.
    expect(wide / total).toBeGreaterThan(0.55)
  })

  it("leaps much more than the same settings without it", () => {
    const meanLeap = (devices) => {
      let sum = 0
      let count = 0
      for (const seed of SEEDS) {
        const { line } = improvise({ measures: BLUES, seed, devices, level: 4 })
        const notes = line.bars.flatMap((bar) => bar.n.map(midiOf))
        for (let i = 1; i < notes.length; i++) { sum += Math.abs(notes[i] - notes[i - 1]); count++ }
      }
      return sum / count
    }
    expect(meanLeap(["wide-interval"])).toBeGreaterThan(meanLeap([]) * 1.5)
  })
})

describe("structures compose", () => {
  it("a pentatonic can be played in wide intervals", () => {
    const { line } = improvise({
      measures: BLUES, seed: 5, devices: ["pentatonic", "wide-interval"], level: 4,
    })
    const sounding = line.bars.filter((b) => b.n.length)
    expect(sounding.some((b) => b.d.includes("Pentatonic"))).toBe(true)
    expect(sounding.length).toBeGreaterThan(0)
  })

  it("every structure device replays identically and makes sound", () => {
    for (const id of ["hexatonics", "pentatonic", "triad-pairs", "wide-interval"]) {
      for (const measures of [II_V_I, BLUES]) {
        const a = improvise({ measures, seed: 8, devices: [id], level: 4 })
        const b = improvise({ measures, seed: 8, devices: [id], level: 4 })
        expect(a.line).toEqual(b.line)
        expect(a.line.bars.flatMap((x) => x.n).length, `${id} silent on ${measures[0]}`).toBeGreaterThan(0)
      }
    }
  })

  it("every device names itself in the strip, exactly as the registry labels it", () => {
    // This invariant exists because the same bug happened twice: the engine
    // wrote "Random Chromatic Approach" while the device was called "Random
    // Chromatic Approach (Garzone)", and later wrote "Wide interval" against
    // "Wide interval (Thesaurus)". Both times nothing could match a bar to the
    // device that produced it, and both times every other test passed. One
    // check over the whole registry closes the class.
    const NEEDS_OPTIONS = { "scale-choice": { id: "scale-choice", scale: "lydian" } }
    for (const [id, device] of Object.entries(IMPROV_DEVICES)) {
      const spec = NEEDS_OPTIONS[id] ?? id
      let named = false
      for (const seed of [1, 7, 21, 42, 99, 4242]) {
        const { line } = improvise({ measures: BLUES, seed, devices: [spec], level: 3 })
        if (line.bars.some((b) => b.n.length && b.d.includes(device.label))) { named = true; break }
      }
      expect(named, `${id} never printed its own label "${device.label}"`).toBe(true)
    }
  })

  it("every device in the registry is reachable and labelled", () => {
    for (const [id, device] of Object.entries(IMPROV_DEVICES)) {
      expect(device.label, `${id} has no label`).toBeTruthy()
      expect(device.description.length, `${id} has no description`).toBeGreaterThan(20)
      expect(device.kind).toMatch(/^(lens|filler|rhythm|structure)$/)
    }
  })
})
