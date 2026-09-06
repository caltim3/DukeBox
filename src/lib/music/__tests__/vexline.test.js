// The rhythm reading shared by the on-screen engraving and the MusicXML export.

import { describe, it, expect } from "vitest"
import {
  barToEvents,
  beamGroups,
  beamRolesForBar,
  lineToVexBars,
  splitRestBeats,
  midiToVexKey,
  BEAMABLE_ON_SCREEN,
  BEAMABLE_IN_MUSICXML,
} from "../vexline"

const T = 1 / 3
const eighths = (n, string = 1, fret = 5) => Array.from({ length: n }, () => [string, fret, 0.5, 0])

describe("barToEvents", () => {
  it("places a wait as a rest before its note", () => {
    const events = barToEvents({ n: [[1, 5, 1, 1]], tailRest: 2, beats: 4 })
    expect(events.map((e) => [e.kind, e.beats, e.pos])).toEqual([
      ["rest", 1, 0],
      ["note", 1, 1],
      ["rest", 2, 2],
    ])
  })

  it("spells dotted values", () => {
    const events = barToEvents({ n: [[1, 5, 0.75, 0], [1, 5, 1.5, 0], [1, 5, 3, 0]] })
    expect(events.map((e) => [e.code, e.dots])).toEqual([["8", 1], ["q", 1], ["h", 1]])
  })

  it("splits an unrepresentable rest into pieces, largest first", () => {
    expect(splitRestBeats(2.5).map((d) => d.beats)).toEqual([2, 0.5])
    expect(splitRestBeats(1.75).map((d) => d.beats)).toEqual([1.5, 0.25])
    expect(splitRestBeats(4).map((d) => d.beats)).toEqual([4])
    expect(splitRestBeats(0).map((d) => d.beats)).toEqual([])
  })

  it("groups a complete run of three 1/3 notes as one triplet", () => {
    const events = barToEvents({ n: [[1, 5, T, 0], [1, 6, T, 0], [1, 7, T, 0], [1, 8, 1, 0]] })
    expect(events.filter((e) => e.triplet).map((e) => e.tupletId)).toEqual([0, 0, 0])
    // Written as three plain eighths under the bracket.
    expect(events.slice(0, 3).every((e) => e.code === "8")).toBe(true)
    expect(events[3].triplet).toBe(false)
  })

  it("does not build a tuplet from an incomplete run", () => {
    const two = barToEvents({ n: [[1, 5, T, 0], [1, 6, T, 0], [1, 7, 1, 0]] })
    expect(two.some((e) => e.triplet)).toBe(false)
  })

  it("does not build a tuplet across a rest", () => {
    const split = barToEvents({ n: [[1, 5, T, 0], [1, 6, T, 0.5], [1, 7, T, 0]] })
    expect(split.some((e) => e.triplet)).toBe(false)
  })

  it("takes two consecutive triplet cells as two tuplets", () => {
    const six = barToEvents({ n: Array.from({ length: 6 }, () => [1, 5, T, 0]) })
    expect(six.filter((e) => e.kind === "note").map((e) => e.tupletId)).toEqual([0, 0, 0, 1, 1, 1])
  })

  it("writes guitar pitch an octave above the sounding note", () => {
    const [ev] = barToEvents({ n: [[6, 0, 1, 0]] })   // low E, sounds E2
    expect(ev.midi).toBe(40)
    expect(ev.midiWritten).toBe(52)
    expect(ev.key).toBe("e/3")
    expect(midiToVexKey(61)).toBe("db/4")
  })
})

describe("beam groups", () => {
  it("beams eighths in two groups per bar, breaking at the half-bar seam", () => {
    const events = barToEvents({ n: eighths(8) })
    expect(beamGroups(events, BEAMABLE_ON_SCREEN)).toEqual([[0, 1, 2, 3], [4, 5, 6, 7]])
  })

  it("breaks a beam at a rest and at a quarter note", () => {
    const events = barToEvents({ n: [...eighths(2), [1, 5, 1, 0], ...eighths(2)] })
    // eighth eighth | quarter | eighth eighth — the quarter splits the run.
    expect(beamGroups(events, BEAMABLE_ON_SCREEN)).toEqual([[0, 1], [3, 4]])

    const gapped = barToEvents({ n: [[1, 5, 0.5, 0], [1, 5, 0.5, 0.5], [1, 5, 0.5, 0]] })
    expect(beamGroups(gapped, BEAMABLE_ON_SCREEN)).toEqual([[2, 3]])
  })

  it("beams sixteenths on screen but not into MusicXML", () => {
    const events = barToEvents({ n: [[1, 5, 0.25, 0], [1, 5, 0.25, 0], ...eighths(3)] })
    expect(beamGroups(events, BEAMABLE_ON_SCREEN)).toEqual([[0, 1, 2, 3, 4]])
    // MusicXML keeps the previous export's rule: plain eighths only, since one
    // <beam> element can't carry a sixteenth's second beam.
    expect(beamGroups(events, BEAMABLE_IN_MUSICXML)).toEqual([[2, 3, 4]])
  })

  it("reports MusicXML beam roles against note indices, not event indices", () => {
    const roles = beamRolesForBar([[1, 5, 1, 0], ...eighths(4)])
    expect(roles).toEqual([null, "begin", "end", "begin", "end"])
  })

  it("leaves a lone eighth unbeamed", () => {
    const events = barToEvents({ n: [[1, 5, 0.5, 0], [1, 5, 1, 0], [1, 5, 0.5, 0]] })
    expect(beamGroups(events, BEAMABLE_ON_SCREEN)).toEqual([])
  })
})

describe("lineToVexBars", () => {
  it("numbers sounding notes across the whole line, skipping rests", () => {
    const line = { bars: [
      { c: "Dm7", n: [[1, 5, 1, 1], [1, 7, 1, 0]], tailRest: 1 },
      { c: "G7", n: [[2, 5, 2, 0], [2, 7, 2, 0]] },
    ] }
    const { bars, soundingCount } = lineToVexBars(line)
    expect(soundingCount).toBe(4)
    expect(bars[0].events.map((e) => e.soundingIndex)).toEqual([-1, 0, 1, -1])
    expect(bars[1].events.map((e) => e.soundingIndex)).toEqual([2, 3])
    expect(bars.map((b) => b.chord)).toEqual(["Dm7", "G7"])
  })

  it("fills four beats per bar across a four-bar line", () => {
    const line = { bars: [
      { c: "Cmaj7", n: eighths(8) },
      { c: "A7", n: [[1, 5, T, 0], [1, 6, T, 0], [1, 7, T, 0], [1, 5, 1, 0], ...eighths(4)] },
      { c: "Dm7", n: [[1, 5, 1.5, 0], [1, 7, 0.5, 0]], tailRest: 2 },
      { c: "G7", n: [[1, 5, 0.5, 3.5]] },
    ] }
    const { bars } = lineToVexBars(line)
    bars.forEach((bar) => {
      const total = bar.events.reduce((sum, e) => sum + (e.triplet ? 1 / 3 : e.beats), 0)
      expect(total).toBeCloseTo(4, 5)
    })
    expect(bars[1].tuplets).toEqual([[0, 1, 2]])
    // 3.5 beats of rest is written largest-first: a dotted half plus an eighth.
    expect(bars[3].events.map((e) => [e.kind, e.code, e.dots])).toEqual([
      ["rest", "h", 1], ["rest", "8", 0], ["note", "8", 0],
    ])
  })

  it("survives an empty or malformed line", () => {
    expect(lineToVexBars(null).bars).toEqual([])
    // An empty bar is still a bar: it fills with a whole rest rather than
    // engraving as blank staff.
    const empty = lineToVexBars({ bars: [{}] }).bars[0]
    expect(empty.events.map((e) => [e.kind, e.code])).toEqual([["rest", "w"]])
    expect(empty.beats).toBe(4)
  })
})

// The MusicXML export used to carry its own beam-grouping loop. This is that
// loop, frozen, as an oracle: the shared grouper must keep writing the same
// beams into an exported line as the old exporter did.
function legacyMusicXmlBeamRoles(barNotes) {
  const roles = new Array(barNotes.length).fill(null)
  let pos = 0
  let runStart = -1
  let runHalf = -1
  const closeRun = (endExclusive) => {
    if (runStart >= 0 && endExclusive - runStart >= 2) {
      roles[runStart] = "begin"
      for (let k = runStart + 1; k < endExclusive - 1; k++) roles[k] = "continue"
      roles[endExclusive - 1] = "end"
    }
    runStart = -1
  }
  barNotes.forEach(([, , dur, wait = 0], i) => {
    const d = Number(dur) || 0
    const w = Number(wait) || 0
    const start = pos + w
    const half = Math.floor(start / 2)
    const eligible = Math.abs(d - 0.5) < 1e-6
    const continues = eligible && w === 0 && runStart >= 0 && half === runHalf
    if (!continues) closeRun(i)
    if (eligible && runStart < 0) { runStart = i; runHalf = half }
    else if (!eligible) runStart = -1
    pos = start + d
  })
  closeRun(barNotes.length)
  return roles
}

describe("MusicXML beam parity", () => {
  it("writes the same beams as the exporter's own grouping loop did", () => {
    const DURS = [0.25, 1 / 3, 0.5, 0.75, 1, 1.5, 2]
    const bad = []
    let seed = 7
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    for (let t = 0; t < 3000; t++) {
      const n = []
      let beats = 0
      while (beats < 4) {
        const d = DURS[Math.floor(rnd() * DURS.length)]
        const w = rnd() < 0.25 ? [0.25, 0.5, 1][Math.floor(rnd() * 3)] : 0
        if (beats + w + d > 4) break
        n.push([1, 5, d, w])
        beats += w + d
      }
      if (!n.length) continue
      const mine = JSON.stringify(beamRolesForBar(n))
      const legacy = JSON.stringify(legacyMusicXmlBeamRoles(n))
      if (mine !== legacy) bad.push([JSON.stringify(n), mine, legacy])
    }
    expect(bad.slice(0, 3)).toEqual([])
  })
})
