// One name, one thing.
//
// The triad lens and the curriculum workspace were both called "Skeleton Key"
// for a while — a fretboard lens and a module that puts a fretboard in front
// of you, sharing a name. Everything worked; it was purely a comprehension
// trap, which is exactly the sort of thing that survives a green test run and
// costs somebody an afternoon. This is the guard.

import { describe, it, expect } from "vitest"
import { TWIN_TRIADS_LABEL } from "../triadSystem"
import { SK_CHAPTERS } from "../skeletonKey"

describe("the two features keep separate names", () => {
  it("the triad lens is not called Skeleton Key", () => {
    expect(TWIN_TRIADS_LABEL).toBe("Twin Triads")
    expect(TWIN_TRIADS_LABEL.toLowerCase()).not.toContain("skeleton")
  })

  it("the lens name is short enough to sit in the fretboard's mode row", () => {
    // Its neighbours are Chord, Scale, 3:2 and Pathways.
    expect(TWIN_TRIADS_LABEL.length).toBeLessThanOrEqual(12)
  })

  it("no chapter title borrows the lens's name either", () => {
    for (const chapter of SK_CHAPTERS) {
      expect(chapter.title.toLowerCase()).not.toContain("twin triads")
    }
  })
})
