// Curriculum integrity. Skeleton Key's exercises are data, and data can name
// a device that doesn't exist, a level off the ladder, or a chord the parser
// can't read — none of which fail loudly. They'd just quietly generate the
// wrong lesson. This walks every segment and holds it to the engine.

import { describe, it, expect } from "vitest"
import { SK_CHAPTERS, SK_SEGMENTS, skTag, segmentAvailable, segmentComplete, measuresToBandBars, chordToMeasureIndex } from "../skeletonKey"
import { parseGigChord } from "../gigbook"
import { improvise, IMPROV_DEVICES, IMPROV_LEVELS, IMPROV_PROFILES } from "../improviser"
import { normalizeMeasures } from "../improviser/chartTimeline"
import { FORMS, FORM_CATEGORIES } from "../forms"

// Three kinds of segment: one that generates an exercise, one that runs in the
// Vocabulary Workbench (Chapter 9 — there is deliberately nothing to load), and
// one that isn't built yet and says what it's waiting on.
const READY = SK_SEGMENTS.filter((s) => s.ready && !s.workbench)
const WORKBENCH = SK_SEGMENTS.filter((s) => s.workbench)

// A device is either an id or { id, ...options } — Chapter 4.3 asks for a
// tritone spread, 8.3 for a borrowed hexatonic. Both forms have to be checked.
const idOf = (device) => (typeof device === "string" ? device : device?.id)

// The devices a variant actually runs with: its own if it names any, the
// segment's otherwise.
const devicesFor = (segment, variant) => variant.devices ?? segment.exercise.devices

describe("shape", () => {
  it("every segment has an id, a voice, a pedagogue and a gate", () => {
    for (const seg of SK_SEGMENTS) {
      expect(seg.id).toMatch(/^\d+\.\d+$/)
      expect(seg.voice.length).toBeGreaterThan(40)
      expect(seg.pedagogue).toBeTruthy()
      expect(seg.gate.length).toBeGreaterThan(0)
    }
  })

  it("every segment briefs the student on what to actually do", () => {
    // The pedagogue's quote says why the device matters; the brief says what
    // you do about it in the next twenty minutes. A segment with only the
    // quote leaves the student to infer the exercise from a device chip.
    for (const seg of SK_SEGMENTS) {
      expect(seg.brief, `${seg.id} has no brief`).toBeTruthy()
      expect(seg.brief.length, `${seg.id}'s brief is too thin to instruct`).toBeGreaterThan(150)
      expect(seg.brief, `${seg.id} never states the exercise`).toMatch(/Today's exercise/)
    }
  })

  it("briefs name real notes, not just abstractions", () => {
    // A worked example in a named key is what makes the difference between
    // "superimpose a triad" and something a player can pick up and do.
    const withExample = SK_SEGMENTS.filter((s) => /\b[A-G](b|#)?(maj7|m7b5|m7|7alt|7|dim7)?\b/.test(s.brief))
    // Not quite all of them: a couple of Chapter 9 segments are deliberately
    // device-free — "play a chorus and try to notice nothing" is the
    // instruction — and naming a chord there would be inventing specificity
    // the exercise doesn't have.
    expect(withExample.length / SK_SEGMENTS.length).toBeGreaterThan(0.9)
  })

  it("segment ids are unique and match their chapter", () => {
    const ids = SK_SEGMENTS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const seg of SK_SEGMENTS) {
      expect(seg.id.split(".")[0]).toBe(String(seg.chapter))
    }
  })

  it("a segment either generates an exercise, runs in the Workbench, or says what it needs", () => {
    for (const seg of SK_SEGMENTS) {
      if (seg.workbench) {
        expect(seg.ready, `${seg.id} is a workbench segment but not ready`).toBe(true)
        expect(seg.exercise, `${seg.id} should have no exercise to load`).toBeUndefined()
      } else if (seg.ready) {
        expect(seg.exercise?.variants?.length, `${seg.id} has no variants`).toBeGreaterThan(0)
      } else {
        expect(seg.needs?.length, `${seg.id} is unbuilt but says nothing about why`).toBeGreaterThan(10)
      }
    }
  })

  it("the Workbench segments are the transcription chapter, and only those", () => {
    expect(WORKBENCH.map((s) => s.id)).toEqual(["9.1", "9.4"])
  })

  it("chapters are numbered in order and none is empty", () => {
    expect(SK_CHAPTERS.map((c) => c.n)).toEqual(SK_CHAPTERS.map((_, i) => i + 1))
    for (const chapter of SK_CHAPTERS) expect(chapter.segments.length).toBeGreaterThan(0)
  })
})

describe("every ready exercise is one the engine can actually run", () => {
  it("names only devices that exist", () => {
    for (const seg of READY) {
      const named = [
        ...seg.exercise.devices,
        ...seg.exercise.variants.flatMap((v) => v.devices || []),
      ].map(idOf)
      for (const id of named) {
        expect(IMPROV_DEVICES[id], `${seg.id} names unknown device "${id}"`).toBeTruthy()
      }
    }
  })

  it("names a level on the ladder and a profile that exists", () => {
    for (const seg of READY) {
      expect(IMPROV_LEVELS[seg.exercise.level], `${seg.id} level`).toBeTruthy()
      expect(IMPROV_PROFILES[seg.exercise.profileId], `${seg.id} profile`).toBeTruthy()
    }
  })

  it("uses chord symbols the parser understands", () => {
    for (const seg of READY) {
      for (const variant of seg.exercise.variants) {
        const timeline = normalizeMeasures(variant.measures)
        expect(timeline.segments.length, `${seg.id}/${variant.label} parsed no chords`)
          .toBeGreaterThan(0)
        // Every measure must contribute harmony — a typo'd symbol becomes
        // silence, which reads as "the exercise is broken".
        expect(timeline.measures.length).toBe(variant.measures.length)
      }
    }
  })

  it("stays inside Line Lab's 8-bar generation cap", () => {
    for (const seg of READY) {
      for (const variant of seg.exercise.variants) {
        expect(variant.measures.length, `${seg.id}/${variant.label}`).toBeLessThanOrEqual(8)
      }
    }
  })

  it("generates real notes, in every variant, tagged with its segment", () => {
    for (const seg of READY) {
      for (const variant of seg.exercise.variants) {
        const { line } = improvise({
          measures: variant.measures,
          devices: devicesFor(seg, variant),
          level: seg.exercise.level,
          profileId: seg.exercise.profileId,
          controls: {
            space: seg.exercise.controls.space / 100,
            altered: seg.exercise.controls.altered / 100,
            intensity: seg.exercise.controls.intensity / 100,
          },
          seed: 4242,
          tag: skTag(seg),
        })
        const notes = line.bars.flatMap((b) => b.n)
        expect(notes.length, `${seg.id}/${variant.label} was silent`).toBeGreaterThan(3)
        for (const bar of line.bars) expect(bar.x).toContain(skTag(seg))
      }
    }
  })

  it("a segment that names a device says so in the bars it produces", () => {
    for (const seg of READY) {
      for (const variant of seg.exercise.variants) {
        const devices = devicesFor(seg, variant)
        if (!devices.length) continue
        const { line } = improvise({
          measures: variant.measures, devices, level: seg.exercise.level,
          profileId: seg.exercise.profileId, seed: 4242, tag: skTag(seg),
        })
        const sounding = line.bars.filter((b) => b.n.length)
        const labels = devices.map((d) => IMPROV_DEVICES[idOf(d)].label)
        expect(
          sounding.some((bar) => labels.some((l) => bar.d.includes(l))),
          `${seg.id}/${variant.label} never mentions ${labels.join("/")}`
        ).toBe(true)
      }
    }
  })
})

describe("gating", () => {
  it("the first segment is open and the second is not", () => {
    expect(segmentAvailable(SK_SEGMENTS[0], {})).toBe(true)
    expect(segmentAvailable(SK_SEGMENTS[1], {})).toBe(false)
  })

  it("ticking every box on a segment opens the next one", () => {
    const first = SK_SEGMENTS[0]
    const progress = { [first.id]: first.gate.map((_, i) => i) }
    expect(segmentComplete(first, progress)).toBe(true)
    expect(segmentAvailable(SK_SEGMENTS[1], progress)).toBe(true)
    expect(segmentAvailable(SK_SEGMENTS[2], progress)).toBe(false)
  })

  it("unlockAll opens everything, including the last segment", () => {
    expect(segmentAvailable(SK_SEGMENTS[SK_SEGMENTS.length - 1], {}, true)).toBe(true)
  })

  it("a partly ticked gate does not count as drilled", () => {
    const first = SK_SEGMENTS[0]
    expect(segmentComplete(first, { [first.id]: [0] })).toBe(first.gate.length === 1)
  })
})


// Chapter 10's repertoire arc needs two tunes the library didn't have. They go
// into forms.js proper, not just into the curriculum, so they're playable with
// the band from the Songbook like any other tune.
describe("the Chapter 10 additions", () => {
  const ADDED = ["Tune Up (D)", "Have You Met Miss Jones (F)"]

  it("are in the form library", () => {
    for (const name of ADDED) expect(FORMS[name], `${name} missing`).toBeTruthy()
  })

  it("parse cleanly — every bar has a root, a quality and a symbol", () => {
    for (const name of ADDED) {
      const form = FORMS[name]
      expect(form.bars.length).toBeGreaterThan(24)
      for (const bar of form.bars) {
        expect(bar.root, `${name}: bar with no root`).toBeTruthy()
        expect(bar.quality).toBeTruthy()
        expect(bar.symbol).toBeTruthy()
        expect(bar.beats).toBeGreaterThan(0)
      }
    }
  })

  it("are browsable, not just addressable", () => {
    const listed = Object.values(FORM_CATEGORIES ?? {}).flat()
    for (const name of ADDED) expect(listed).toContain(name)
  })

  it("Tune Up really is a string of descending ii-V-Is", () => {
    const symbols = FORMS["Tune Up (D)"].bars.map((b) => b.symbol)
    expect(symbols.slice(0, 12).join(" "))
      .toBe("Em7 A7 Dmaj7 Dmaj7 Dm7 G7 Cmaj7 Cmaj7 Cm7 F7 Bbmaj7 Bbmaj7")
  })

  it("Miss Jones's bridge drops through key centres a major third apart", () => {
    const bridge = FORMS["Have You Met Miss Jones (F)"].bars.filter((b) => b.section === "B")
    const centres = bridge.filter((b) => b.quality === "maj7").map((b) => b.root)
    // Bb → Gb → D — the reason this tune is in the curriculum at all.
    expect(centres).toContain("Bb")
    expect(centres).toContain("Gb")
    expect(centres).toContain("D")
  })

  it("the improviser can actually play over them", () => {
    for (const name of ADDED) {
      const measures = FORMS[name].bars.slice(0, 8).map((b) => b.symbol)
      const { line } = improvise({ measures, seed: 31, level: 4 })
      expect(line.bars.flatMap((b) => b.n).length, `${name} generated nothing`).toBeGreaterThan(3)
    }
  })
})

// The drill stage hands these bars to the rhythm section. A split measure is
// the case that fails silently — the band sits on the first chord for a whole
// bar while the neck and the line move on, and nothing errors.
describe("measures the band can play", () => {
  it("splits a two-chord measure into two half-bar entries", () => {
    const bars = measuresToBandBars(["Am7 D7", "Gm7 C7"], parseGigChord)
    expect(bars.map((b) => b.symbol)).toEqual(["Am7", "D7", "Gm7", "C7"])
    for (const bar of bars) expect(bar.beats).toBe(2)
  })

  it("leaves a single-chord measure as one full bar", () => {
    const bars = measuresToBandBars(["Dm7", "G7"], parseGigChord)
    expect(bars.map((b) => b.beats)).toEqual([4, 4])
  })

  it("maps each chord back to the measure it came from", () => {
    expect(chordToMeasureIndex(["Am7 D7", "Gm7", "Bb7 Eb7"])).toEqual([0, 0, 1, 2, 2])
  })

  it("never drops a chord from any segment in the curriculum", () => {
    for (const seg of READY) {
      for (const variant of seg.exercise.variants) {
        const chords = variant.measures.join(" ").trim().split(/\s+/).length
        const bars = measuresToBandBars(variant.measures, parseGigChord)
        expect(bars.length, `${seg.id}/${variant.label} lost a chord`).toBe(chords)
        // Every bar the band plays must be a chord it can sound.
        for (const bar of bars) expect(bar.root).toBeTruthy()
      }
    }
  })

  it("a bar's chords add up to the bar", () => {
    for (const seg of READY) {
      for (const variant of seg.exercise.variants) {
        const idx = chordToMeasureIndex(variant.measures)
        const bars = measuresToBandBars(variant.measures, parseGigChord)
        for (let m = 0; m < variant.measures.length; m++) {
          const inBar = bars.filter((_, i) => idx[i] === m)
          expect(inBar.reduce((n, b) => n + b.beats, 0), `${seg.id} bar ${m + 1}`).toBe(4)
        }
      }
    }
  })
})
