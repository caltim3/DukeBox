// Continuous session — scheduler-facing invariants, driven with a fake
// clock (beat-by-beat collection windows, the way the audio layer pulls).

import { describe, it, expect } from "vitest"
import { createImproviserSession } from "../session"

const II_V_I = ["Dm7", "G7", "Cmaj7", "Cmaj7"] // 16-beat form

function collectInWindows(session, totalBeats, windowBeats = 1) {
  const events = []
  for (let b = windowBeats; b <= totalBeats; b += windowBeats) {
    events.push(...session.collectEvents(b))
  }
  return events
}

describe("continuous session", () => {
  it("emits each event exactly once across windows, in order", () => {
    const session = createImproviserSession({ measures: II_V_I, seed: 5 })
    const events = collectInWindows(session, 128) // 8 choruses
    expect(events.length).toBeGreaterThan(50)
    for (let i = 1; i < events.length; i++) {
      expect(events[i].t).toBeGreaterThanOrEqual(events[i - 1].t)
    }
    const keys = events.map((e) => `${e.t}`)
    expect(new Set(keys).size).toBe(keys.length) // monophonic — no duplicate onsets
  })

  it("window size doesn't change what gets played", () => {
    const a = collectInWindows(createImproviserSession({ measures: II_V_I, seed: 9 }), 64, 1)
    const b = collectInWindows(createImproviserSession({ measures: II_V_I, seed: 9 }), 64, 4)
    expect(a.map((e) => [e.t, e.midi])).toEqual(b.map((e) => [e.t, e.midi]))
  })

  it("keeps developing across the form seam — chorus 2 is not chorus 1", () => {
    const session = createImproviserSession({ measures: II_V_I, seed: 3 })
    const events = collectInWindows(session, 64)
    const chorus = (lo) => events.filter((e) => e.t >= lo && e.t < lo + 16).map((e) => [e.t - lo, e.midi])
    expect(chorus(0)).not.toEqual(chorus(16))
    // And the seam itself gets played through at least sometimes across seeds.
    let seamNotes = 0
    for (let seed = 1; seed <= 20; seed++) {
      const s = createImproviserSession({ measures: II_V_I, seed })
      const evs = collectInWindows(s, 48)
      seamNotes += evs.filter((e) => e.t >= 15 && e.t < 17.5).length
    }
    expect(seamNotes).toBeGreaterThan(5)
  })

  it("control changes preserve committed events and reshape only the future", () => {
    const seed = 11
    const base = createImproviserSession({ measures: II_V_I, seed })
    const baseline = collectInWindows(base, 64)

    const live = createImproviserSession({ measures: II_V_I, seed })
    const before = []
    for (let b = 1; b <= 24; b++) before.push(...live.collectEvents(b))
    live.updateControls({ space: 0.95 })
    const after = []
    for (let b = 25; b <= 64; b++) after.push(...live.collectEvents(b))

    // Everything already collected matches the undisturbed run exactly.
    const baseBefore = baseline.filter((e) => e.t < 24)
    expect(before.map((e) => [e.t, e.midi])).toEqual(baseBefore.map((e) => [e.t, e.midi]))
    // No event from the past is re-emitted after the change.
    for (const e of after) expect(e.t).toBeGreaterThanOrEqual(24)
  })

  it("higher space after a dial change audibly thins the line", () => {
    const notesAfterBeat32 = (mutate) => {
      let total = 0
      for (let seed = 1; seed <= 15; seed++) {
        const s = createImproviserSession({ measures: II_V_I, seed, controls: { space: 0.1 } })
        collectInWindows(s, 32)
        mutate?.(s)
        for (let b = 33; b <= 128; b++) total += s.collectEvents(b).length
      }
      return total
    }
    const dense = notesAfterBeat32(null)
    const airy = notesAfterBeat32((s) => s.updateControls({ space: 0.9 }))
    expect(airy).toBeLessThan(dense * 0.8)
  })

  it("memory stays bounded over a long performance", () => {
    const session = createImproviserSession({ measures: II_V_I, seed: 7 })
    let count = 0
    for (let b = 1; b <= 16 * 100; b++) count += session.collectEvents(b).length // 100 choruses
    expect(count).toBeGreaterThan(500)
    const snap = session.getSnapshot()
    expect(snap.plannedCount).toBeLessThan(12) // pruned, not accumulated
  })

  it("infoAt reports chorus and form position", () => {
    const session = createImproviserSession({ measures: II_V_I, seed: 2 })
    session.collectEvents(40)
    const info = session.infoAt(36) // beat 36 = chorus 3, form beat 4 → bar 2
    expect(info.chorus).toBe(3)
    expect(info.formBar).toBe(2)
  })

  it("all-N.C. charts stay silent instead of failing", () => {
    const session = createImproviserSession({ measures: ["N.C.", "N.C."], seed: 1 })
    expect(collectInWindows(session, 32).length).toBe(0)
  })
})
