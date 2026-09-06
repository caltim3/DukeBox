// Garzone's Triadic Chromatic Approach.
//
// Every rule here is exact — "never repeat an inversion", "only half steps
// between triads" — which makes them the rules least likely to survive being
// merely requested and most worth asserting. Tested twice over: at the state
// machine, where the shape itself is proven, and in generated lines, where it
// has to survive being interleaved with anchors and rests.

import { describe, it, expect } from "vitest"
import { improvise, IMPROV_DEVICES } from "../index"
import { createTcaState, tcaAdvance, TCA_QUALITIES } from "../tca"
import { applyDevices } from "../devices"
import { normalizeMeasures, segmentAtBeat } from "../chartTimeline"

const II_V_I = ["Dm7", "G7", "Cmaj7", "Cmaj7"]
const STATIC = ["G7", "G7", "G7", "G7"]
const BLUES = ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "D7"]
const REGISTER = { min: 55, max: 88, center: 71 }
const OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 }
const midiOf = ([s, f]) => OPEN_MIDI[s] + f
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 1)

const TRIAD_SETS = {
  major: [0, 4, 7], minor: [0, 3, 7], augmented: [0, 4, 8], diminished: [0, 3, 6],
}

// Run the chain and collect it as triads of three notes.
function chainTriads(seed, count = 40) {
  let n = seed
  const rng = () => ((n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  let state = createTcaState(71)
  const triads = []
  let current = null
  for (let i = 0; i < count; i++) {
    const step = tcaAdvance(state, rng, REGISTER)
    state = step.state
    if (step.position === 0) {
      current = { quality: step.quality, inversion: step.inversion, notes: [step.midi] }
      triads.push(current)
    } else {
      current.notes.push(step.midi)
    }
  }
  return triads.filter((t) => t.notes.length === 3)
}

describe("the chain itself", () => {
  it("emits real triads — three notes of one of the four qualities", () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const triad of chainTriads(seed)) {
        expect(TCA_QUALITIES).toContain(triad.quality)
        const pcs = triad.notes.map((m) => ((m % 12) + 12) % 12).sort((a, b) => a - b)
        expect(new Set(pcs).size, `${triad.quality} collapsed to ${pcs}`).toBe(3)
        // The three pitch classes really do spell that quality from some root.
        const intervals = TRIAD_SETS[triad.quality]
        const spelled = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].some((root) =>
          intervals.map((i) => (root + i) % 12).sort((a, b) => a - b).join() === pcs.join()
        )
        expect(spelled, `${pcs} is not a ${triad.quality} triad`).toBe(true)
      }
    }
  })

  it("never repeats an inversion twice in a row", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const triads = chainTriads(seed)
      for (let i = 1; i < triads.length; i++) {
        expect(triads[i].inversion).not.toBe(triads[i - 1].inversion)
      }
    }
  })

  it("never repeats a quality twice in a row", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const triads = chainTriads(seed)
      for (let i = 1; i < triads.length; i++) {
        expect(triads[i].quality).not.toBe(triads[i - 1].quality)
      }
    }
  })

  it("connects one triad to the next by a half step, and only a half step", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const triads = chainTriads(seed)
      for (let i = 1; i < triads.length; i++) {
        const link = Math.abs(triads[i].notes[0] - triads[i - 1].notes[2])
        expect(link, `link of ${link} semitones between triads`).toBe(1)
      }
    }
  })

  it("stays inside the register without collapsing a triad to fit", () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const triad of chainTriads(seed)) {
        for (const midi of triad.notes) {
          expect(midi).toBeGreaterThanOrEqual(REGISTER.min)
          expect(midi).toBeLessThanOrEqual(REGISTER.max)
        }
      }
    }
  })

  it("uses all four qualities and all three inversions over a long chain", () => {
    const triads = chainTriads(4242, 300)
    expect(new Set(triads.map((t) => t.quality)).size).toBe(4)
    expect(new Set(triads.map((t) => t.inversion)).size).toBe(3)
  })

  it("is a pure function of its state and rng — same seed, same chain", () => {
    expect(chainTriads(77)).toEqual(chainTriads(77))
  })
})

describe("the chain in generated lines", () => {
  it("makes sound and replays identically", () => {
    for (const measures of [II_V_I, STATIC, BLUES]) {
      const a = improvise({ measures, seed: 5, devices: ["tca"], level: 5 })
      const b = improvise({ measures, seed: 5, devices: ["tca"], level: 5 })
      expect(a.line).toEqual(b.line)
      expect(a.line.bars.flatMap((x) => x.n).length).toBeGreaterThan(3)
    }
  })

  it("names itself, and names the triad it is on", () => {
    const { line } = improvise({ measures: STATIC, seed: 3, devices: ["tca"], level: 5 })
    const sounding = line.bars.filter((b) => b.n.length)
    expect(sounding.some((b) => b.d.includes(IMPROV_DEVICES.tca.label))).toBe(true)
    expect(sounding.map((b) => b.x).join(" ")).toMatch(/(major|minor|augmented|diminished) triad/)
  })

  it("still lands — every excursion resolves onto a chord tone at the change", () => {
    // The Chapter 8 rule. The chain only ever gets the gaps BETWEEN anchors,
    // so however far outside it wanders it cannot run past the next landing.
    const timeline = normalizeMeasures(BLUES)
    let changes = 0
    let landed = 0
    for (const seed of SEEDS) {
      const { line } = improvise({ measures: BLUES, seed, devices: ["tca"], level: 5 })
      let barStart = 0
      const notes = []
      for (const bar of line.bars) {
        let pos = 0
        for (const n of bar.n) {
          pos += n[3]
          notes.push({ t: barStart + pos, pc: ((midiOf(n) % 12) + 12) % 12 })
          pos += n[2]
        }
        barStart += bar.beats
      }
      for (const seg of timeline.segments) {
        const near = notes.filter((n) => n.t >= seg.startBeat - 0.6 && n.t <= seg.startBeat + 1)
        if (!near.length) continue
        changes++
        if (near.some((n) => seg.chordPcs.includes(n.pc))) landed++
      }
    }
    expect(changes).toBeGreaterThan(150)
    expect(landed / changes).toBeGreaterThan(0.85)
  })

  it("is genuinely outside — it leaves the chord far more than a plain line", () => {
    // Measured over a MAJOR chord on purpose. Over a dominant at level 5 the
    // plain line already reads from the altered scale, so it scores as
    // "outside" for a reason that has nothing to do with this device — the
    // first version of this test compared TCA against that and learned
    // nothing. A maj7 has no altered pool, so the difference here is the
    // chain and only the chain.
    const MAJOR = ["Cmaj7", "Cmaj7", "Cmaj7", "Cmaj7"]
    const outsideRatio = (devices) => {
      const timeline = normalizeMeasures(MAJOR)
      let out = 0
      let total = 0
      for (const seed of SEEDS) {
        const { line } = improvise({ measures: MAJOR, seed, devices, level: 5 })
        let barStart = 0
        for (const bar of line.bars) {
          let pos = 0
          for (const n of bar.n) {
            pos += n[3]
            const seg = segmentAtBeat(timeline, barStart + pos)
            if (seg) {
              total++
              const pc = ((midiOf(n) % 12) + 12) % 12
              if (!seg.scalePcs.includes(pc) && !seg.chordPcs.includes(pc)) out++
            }
            pos += n[2]
          }
          barStart += bar.beats
        }
      }
      return out / total
    }
    expect(outsideRatio(["tca"])).toBeGreaterThan(outsideRatio([]) + 0.1)
  })

  it("yields to an approach, so Chapter 8.1 really is two devices", () => {
    // With the chain checked before approaches it swallowed them whole, and
    // the segment that asks for "TCA combined with RCA" silently taught only
    // TCA. Both have to show up in the same line.
    let sawChain = false
    let sawApproach = false
    for (const seed of SEEDS) {
      const { line } = improvise({ measures: BLUES, seed, devices: ["tca", "rca"], level: 5 })
      const d = line.bars.filter((b) => b.n.length).map((b) => b.d).join(" ")
      if (d.includes(IMPROV_DEVICES.tca.label)) sawChain = true
      if (d.includes(IMPROV_DEVICES.rca.label)) sawApproach = true
      if (sawChain && sawApproach) break
    }
    expect(sawChain).toBe(true)
    expect(sawApproach).toBe(true)
  })

  it("the chain carries across phrases instead of restarting each one", () => {
    const { trace } = improvise({ measures: BLUES, seed: 12, devices: ["tca"], level: 5 })
    expect(trace.phrases.length).toBeGreaterThan(1)
    expect(trace.phrases.some((p) => p.devices.includes("triad chain"))).toBe(true)
  })
})

describe("Baker — turnaround substitution", () => {
  it("substitutes alternating dominants so the roots walk down chromatically", () => {
    const TURNAROUND = ["Cmaj7", "A7", "Dm7", "G7"]
    const timeline = applyDevices(normalizeMeasures(TURNAROUND), { devices: ["turnaround"] })
    const symbols = timeline.segments.map((s) => s.symbol)
    // One of the two dominants is substituted, not both — substituting every
    // one just transposes the cycle instead of making it descend.
    const changed = symbols.filter((sym, i) => sym !== normalizeMeasures(TURNAROUND).segments[i].symbol)
    expect(changed.length).toBe(1)
    expect(symbols.join(" ")).toContain("Eb7")
  })

  it("leaves non-dominants alone", () => {
    const timeline = applyDevices(normalizeMeasures(["Cmaj7", "A7", "Dm7", "G7"]), { devices: ["turnaround"] })
    expect(segmentAtBeat(timeline, 0).symbol).toBe("Cmaj7")
    expect(segmentAtBeat(timeline, 8).symbol).toBe("Dm7")
  })

  it("says it was a turnaround substitution, not a bare tritone sub", () => {
    const timeline = applyDevices(normalizeMeasures(["Cmaj7", "A7", "Dm7", "G7"]), { devices: ["turnaround"] })
    const notes = timeline.segments.flatMap((s) => s.deviceNotes || [])
    expect(notes.join(" ")).toContain("turnaround:")
  })
})
