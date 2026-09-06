// Devices and levels — the layer that lets a caller ask the improviser for a
// SPECIFIC pedagogy instead of a general style.
//
// Two mechanisms, deliberately separate:
//
//   Lenses (devices) rewrite the HARMONY the generator sees. A lens takes one
//   chord segment and returns a new one with different pitch pools — the
//   Martino conversion swaps the scale under a dominant for its related
//   minor, a tritone sub swaps the chord outright, the bebop scale adds its
//   passing tone. Nothing about rhythm, phrasing or targeting changes; the
//   generator keeps doing exactly what it already does, over different notes.
//
//   Levels rewrite the STYLE WEIGHTS — the 5-rung ladder Line Lab already
//   shows (Skeleton / Inside / Chromatic / Structures / Exotic). A level is
//   an overlay applied after blendStyle, so it wins over the sliders for the
//   fields it names and leaves the rest of the profile alone.
//
// Both are additive: with no devices and no level, applyDevices returns the
// timeline untouched and levelStyle returns the style untouched, so every
// existing caller generates byte-identical lines. Neither draws from the rng,
// so adding a device can't shift the seeded stream either.
//
// Why lenses and not more prose in the LLM route: a curriculum is drilled.
// The same exercise has to come back the same way, in any key, offline, for
// free, and — the part prose can't do — has to be assertable in a test.

import {
  barryHarrisScale, chordNotes, martinoMapper, noteAtSemitones, scaleNotes,
} from "@/lib/music/tonal"
import { guidePcsFor, toPcs } from "./chartTimeline"
import { APPROACH_FILLERS } from "./fillers"
import { bluesFor, hexatonicFor, pentatonicFor } from "./structures"

const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
const nameOf = (pc) => NOTE_NAMES[((pc % 12) + 12) % 12]

// The scale that goes with a Martino-converted shape.
const CONVERTED_SCALE = { min7: "dorian", min7b5: "locrian" }
const CONVERTED_SYMBOL = { min7: "m7", min7b5: "m7b5" }

// ─── Lenses ───────────────────────────────────────────────────────────────
//
// apply(seg, opts) → a partial segment to merge, or null for "not my chord"
// (a dominant-only lens over a maj7 leaves it alone rather than forcing
// something). Fields a lens may set:
//
//   scalePcs   — the pool stepwise material walks
//   pitchPcs   — the pool CHORD-tone material draws from (leaps, and every
//                non-anchor note at level 1). Defaults to the real chord.
//   chordPcs / thirdPc / seventhPc / symbol — only a lens that genuinely
//                reharmonizes (tritone sub) touches these; the anchors are
//                what spell the harmony, so moving them is a real change.
//   note       — one short clause for the per-bar reasoning strip.

export const IMPROV_DEVICES = {
  "minor-conversion": {
    id: "minor-conversion",
    kind: "lens",
    label: "Minor conversion (Martino)",
    description:
      "Reduce the chord to its minor equivalent and play that: maj7 becomes the relative " +
      "minor, a dominant becomes the minor a fifth above (Dm over G7 = G9), minor stays " +
      "home. The real 3rd and 7th still land at the change — only the colour around them moves.",
    apply(seg) {
      const conv = martinoMapper(seg.root, seg.quality)
      if (!conv?.displayRoot) return null
      const suffix = CONVERTED_SYMBOL[conv.displayQuality] ?? "m7"
      const symbol = `${conv.displayRoot}${suffix}`
      const scale = CONVERTED_SCALE[conv.displayQuality] ?? "dorian"
      const scalePcs = toPcs(scaleNotes(scale, conv.displayRoot))
      const pitchPcs = toPcs(chordNotes(symbol))
      if (scalePcs.length < 5 || !pitchPcs.length) return null
      const same = conv.displayRoot === seg.root
      return {
        scalePcs,
        pitchPcs,
        note: same
          ? `${symbol} stays home`
          : `${symbol} over ${seg.symbol}`,
      }
    },
  },

  "tritone-sub": {
    id: "tritone-sub",
    kind: "lens",
    label: "Tritone substitution",
    // The one lens that moves the anchors: a tritone sub really is a
    // different chord. It keeps the tritone, so the 3rd and 7th swap roles
    // rather than disappearing — which is exactly the sound, and why the
    // resolution still works.
    description:
      "Swap a dominant for the dominant a tritone away. The shared tritone stays put — " +
      "the old 3rd becomes the new 7th — so the line still resolves where it was going.",
    apply(seg) {
      if (!seg.isDominant) return null
      const subRoot = noteAtSemitones(seg.root, 6)
      if (!subRoot) return null
      const symbol = `${subRoot}7`
      const chordPcs = toPcs(chordNotes(symbol))
      if (chordPcs.length < 3) return null
      const rootPc = (seg.rootPc + 6) % 12
      const { thirdPc, seventhPc } = guidePcsFor(rootPc, chordPcs)
      // Lydian dominant is the melodic-minor mode that fits a sub — the
      // #11 is the original dominant's root, so it sounds like a colour
      // rather than an accident.
      let scalePcs = toPcs(scaleNotes("lydian dominant", subRoot))
      if (scalePcs.length < 5) scalePcs = toPcs(scaleNotes("mixolydian", subRoot))
      const alteredPcs = toPcs(scaleNotes("altered", subRoot))
      return {
        // root and quality move with the chord, not just its name: a lens
        // applied after this one (a Martino conversion of the SUB, which is
        // exactly what Chapter 7.1 asks for) has to read the substituted
        // dominant, not the one it replaced.
        symbol, root: subRoot, quality: "7",
        rootPc, chordPcs, thirdPc, seventhPc, scalePcs,
        pitchPcs: chordPcs,
        alteredPcs: alteredPcs.length >= 5 ? alteredPcs : null,
        note: `${symbol} for ${seg.symbol}, shared tritone ${nameOf(thirdPc)}/${nameOf(seventhPc)}`,
      }
    },
  },

  "bebop-scale": {
    id: "bebop-scale",
    kind: "lens",
    label: "Bebop scale",
    description:
      "The eight-note scale: one added chromatic passing tone per octave, which is what " +
      "keeps chord tones landing on strong beats through continuous eighths.",
    apply(seg) {
      const barry = barryHarrisScale(seg.root, seg.quality)
      const scalePcs = toPcs(barry?.notes)
      if (scalePcs.length < 7) return null
      return { scalePcs, note: `bebop scale, passing ${barry.passingNote}` }
    },
  },

  altered: {
    id: "altered",
    kind: "lens",
    label: "Altered",
    // Deterministic on purpose: the profile's alteredProb decides per phrase
    // whether to go altered, which is right for a solo and wrong for a drill.
    // Asking for the device means every dominant is altered, every time.
    description:
      "Every dominant reads from the altered scale — melodic minor a half step up — instead " +
      "of sometimes doing so.",
    apply(seg) {
      if (!seg.isDominant || !seg.alteredPcs?.length) return null
      return { scalePcs: seg.alteredPcs, alteredPcs: null, note: "altered scale" }
    },
  },

  "scale-choice": {
    id: "scale-choice",
    kind: "lens",
    label: "Scale choice",
    description: "Name the scale outright instead of taking the recommended one.",
    apply(seg, opts) {
      const scale = opts?.scale
      if (!scale) return null
      const scalePcs = toPcs(scaleNotes(scale, seg.root))
      if (scalePcs.length < 5) return null
      return { scalePcs, note: `${seg.root} ${scale}` }
    },
  },

  triads: {
    id: "triads",
    kind: "lens",
    label: "Triads",
    description:
      "Drop to the bare triad — root, 3rd, 5th, no 7th — so an arpeggio drill spells the " +
      "triad and nothing else.",
    apply(seg) {
      const has = (offset) => {
        const pc = (seg.rootPc + offset) % 12
        return seg.chordPcs.includes(pc) ? pc : null
      }
      const third = has(4) ?? has(3)
      const fifth = has(7) ?? has(6) ?? has(8)
      if (third == null || fifth == null) return null
      const chordPcs = [seg.rootPc, third, fifth]
      // The anchors are what land at a chord change, and they're drawn from
      // chordPcs / seventhPc — so narrowing only the fill pool would still
      // let a "triads only" drill put a 7th on the downbeat. Narrow the chord
      // itself and let guidePcsFor fall back to the 5th, which is what it
      // already does for any chord with no 7th in it.
      const { thirdPc, seventhPc } = guidePcsFor(seg.rootPc, chordPcs)
      return {
        chordPcs, pitchPcs: chordPcs, thirdPc, seventhPc,
        note: `${seg.root} triad only`,
      }
    },
  },
  // ── Fillers ─────────────────────────────────────────────────────────────
  // A lens changes which notes exist; a filler decides what happens over the
  // onsets leading into an anchor. They compose freely: a Martino conversion
  // plus an encirclement is a converted line that still cages its targets.
  //
  // `approach` names the run generator in fillers.js. `style` overrides the
  // profile/level weights this device needs to mean anything — asking for an
  // approach type and then rolling dice about whether to use it would make
  // the drill untrustworthy, so approachProb is 1 unless a level lowers it.

  "upper-neighbour": {
    id: "upper-neighbour", kind: "filler",
    description: "Approach every target from the scale tone above it, and nothing else.",
    approach: "upper-neighbour",
    style: { approachProb: 1, enclosureProb: 0 },
  },

  "lower-neighbour": {
    id: "lower-neighbour", kind: "filler",
    description: "Approach every target from a half step below it, and nothing else.",
    approach: "lower-neighbour",
    style: { approachProb: 1, enclosureProb: 0 },
  },

  "double-chromatic": {
    id: "double-chromatic", kind: "filler",
    description: "Two half steps from below into every target.",
    approach: "double-chromatic",
    style: { approachProb: 1, enclosureProb: 0 },
  },

  encirclement: {
    id: "encirclement", kind: "filler",
    description: "Cage every target from both sides before it lands.",
    approach: "encirclement",
    style: { approachProb: 1, enclosureProb: 0 },
  },

  rca: {
    id: "rca", kind: "filler",
    description:
      "Chromatic motion confined to a major 3rd around the target, alternating direction " +
      "every move. The softest door into Garzone's language.",
    approach: "rca",
    style: { approachProb: 1, enclosureProb: 0, doubleEnclosureProb: 0 },
  },

  pena: {
    id: "pena", kind: "filler",
    // Not a new shape so much as three existing behaviours locked together:
    // the engine already lands a guide tone at every change, so the formula
    // is that landing, plus an encirclement meeting it, plus chord tones
    // holding the strong beats in between.
    description:
      "Richard Peña's bebop-intuition formula — arpeggio with chord tones on strong beats, " +
      "a chromatic enclosure meeting the target, and a guide-tone landing on the next chord's " +
      "3rd, right on beat 1.",
    approach: "encirclement",
    style: { approachProb: 1, enclosureProb: 0, strongBeatChordTones: true, leapProb: 0.1 },
  },
  // ── Structures ──────────────────────────────────────────────────────────
  // Chapters 4 and 5. Hexatonics and Pentatonic are lenses — they change the
  // notes available. Triad pairs and Wide interval change how the line MOVES
  // through them, so they carry style instead.

  hexatonics: {
    id: "hexatonics", kind: "lens", label: "Hexatonics (Vincent)",
    description:
      "The chord's two triads fused into one six-note scale, played as a single line rather " +
      "than alternated. Options: spread (tritone-apart triads) and borrow (lift the whole pair " +
      "a half step or tritone away, then resolve).",
    apply(seg, opts) {
      const hex = hexatonicFor(seg, { shift: opts?.borrow ?? 0, spread: opts?.spread ?? null })
      if (hex.pcs.length < 5) return null
      const borrowed = opts?.borrow ? `, borrowed +${opts.borrow}` : ""
      return {
        scalePcs: hex.pcs,
        pitchPcs: hex.pcs,
        note: `hexatonic ${hex.a.name} + ${hex.b.name}${borrowed}`,
      }
    },
  },

  pentatonic: {
    id: "pentatonic", kind: "lens", label: "Pentatonic",
    description:
      "A pentatonic off the scale degree that gives this chord quality its colour — the 9th " +
      "over a major chord, the b7 over a dominant. Options: degree, type, and blues.",
    apply(seg, opts) {
      const pent = opts?.blues ? bluesFor(seg) : pentatonicFor(seg, opts)
      if (!pent) return null
      return { scalePcs: pent.pcs, pitchPcs: pent.pcs, note: pent.name }
    },
  },

  "triad-pairs": {
    id: "triad-pairs", kind: "structure", label: "Triad pairs",
    description:
      "The two triads played strictly in alternation — three notes of one, three of the other — " +
      "so the ear files them as two separate objects rather than one blurry scale.",
    style: { triadPair: true, enclosureProb: 0, leapProb: 0 },
  },

  tca: {
    id: "tca", kind: "structure", label: "Triadic Chromatic Approach (Garzone)",
    description:
      "Chain the four triad qualities connected only by half-step motion, never repeating an " +
      "inversion or a quality twice running. It fills the space between landings, so every " +
      "excursion still resolves onto a chord tone at the change.",
    style: { tcaChain: true, enclosureProb: 0, doubleEnclosureProb: 0, leapProb: 0 },
  },

  "wide-interval": {
    id: "wide-interval", kind: "structure", label: "Wide interval (Thesaurus)",
    description:
      "Bergonzi's thesaurus rule: no interval smaller than a 4th between consecutive notes. " +
      "The line is forbidden to step, so it has to leap and still resolve.",
    style: { minInterval: 5, enclosureProb: 0 },
  },

  turnaround: {
    id: "turnaround", kind: "lens", label: "Turnaround substitution (Baker)",
    // Scope note, because it matters pedagogically: this is the HARMONIC half
    // of Baker's turnaround chapter — the substitution that makes a I-VI-ii-V
    // descend chromatically. His actual formula vocabulary is a lick library,
    // and DukeBox already has one: the Licktionary. This device gives the
    // changes to play them over; it does not pretend to be them.
    description:
      "Substitute alternating dominants in a turnaround so the roots walk down chromatically — " +
      "the sound every I-VI-ii-V formula is built on. The formulas themselves live in the " +
      "Licktionary.",
    apply(seg, opts, ctx) {
      if (!seg.isDominant) return null
      // Alternate, so the roots descend by half steps instead of every chord
      // moving at once — substituting all of them just transposes the cycle.
      const dominants = ctx.segments.filter((s) => s.isDominant)
      const place = dominants.findIndex((s) => s.startBeat === seg.startBeat)
      if (place < 0 || place % 2 === (opts?.offset ?? 1)) return null
      const subbed = IMPROV_DEVICES["tritone-sub"].apply(seg)
      if (!subbed) return null
      return { ...subbed, note: `turnaround: ${subbed.note}` }
    },
  },

  // ── Rhythm ──────────────────────────────────────────────────────────────
  // Chapter 6's devices are the only ones that touch WHEN rather than WHAT.
  // They're a third kind because they set no approach: the engine's pitch path
  // is left exactly as it was and only the placement moves, which is the whole
  // claim the chapter makes.

  displacement: {
    id: "displacement", kind: "rhythm", label: "Rhythmic displacement",
    description:
      "Restate the phrase you just played — the identical pitches, in order — entering an " +
      "eighth note later each time. Same notes, different phrase.",
    style: {
      pitchEcho: true,
      displacementRotate: 0.5,
      // Rhythm echo would restate the previous RHYTHM with new pitches, which
      // is the exact opposite of the drill.
      motifEchoProb: 0,
      // No extra onsets inserted at chord changes: they'd shift every note
      // after them out of step with the phrase being restated, and "the same
      // notes" has to survive inspection or the drill proves nothing.
      nailChangeProb: 0,
    },
  },

  "cyclic-quadruplets": {
    id: "cyclic-quadruplets", kind: "rhythm", label: "Cyclic quadruplets",
    description:
      "One 4-note cell, restated over and over with an extra note between restatements, so the " +
      "shape stays fixed while its first note walks around the bar.",
    style: {
      cycleCell: true,
      cycleRotate: 1,   // extra notes between restatements — how fast beat 1 walks
      enclosureProb: 0,
      leapProb: 0,
    },
  },
}

// A filler's display name lives on the filler, and the device borrows it.
// Two hand-written copies of one name drift — the reasoning strip claimed
// "Random Chromatic Approach" while the device called itself "Random Chromatic
// Approach (Garzone)", so nothing could match a bar to the device that wrote
// it. One source of truth, resolved once at module load.
for (const device of Object.values(IMPROV_DEVICES)) {
  if (device.approach) device.label = APPROACH_FILLERS[device.approach].label
}

// Devices arrive as "bebop-scale" or { id: "scale-choice", scale: "lydian" }.
// Unknown ids drop out rather than throwing: a curriculum segment naming a
// device from a later build stage should degrade to a plainer exercise, not
// a broken screen.
export function normalizeDevices(devices) {
  const out = []
  for (const entry of devices || []) {
    const id = typeof entry === "string" ? entry : entry?.id
    const device = IMPROV_DEVICES[id]
    if (device) out.push({ device, opts: typeof entry === "string" ? {} : entry })
  }
  return out
}

// ─── Levels ───────────────────────────────────────────────────────────────
//
// The same 1-5 ladder Line Lab labels Skeleton / Inside / Chromatic /
// Structures / Exotic, as weight overlays. `pitchPool: "chord"` is the one
// new knob — it makes non-anchor notes draw from chord tones instead of the
// scale, which is what "skeleton" actually means and what the level-1 gate
// ("name every chord tone out loud") has to be able to assert.

export const IMPROV_LEVELS = {
  1: {
    n: 1, label: "Skeleton", blurb: "Chord + guide tones",
    style: {
      pitchPool: "chord",
      enclosureProb: 0, doubleEnclosureProb: 0, alteredProb: 0,
      leapProb: 0.24, density: 0.35, motifEchoProb: 0.45,
      cellWeights: {
        run8: 0.4, offbeat8: 0.5, charleston: 1, triplet: 0.1,
        quarters: 4, pushQuarter: 1, longNote: 2, dotted: 1.5,
      },
    },
  },
  2: {
    n: 2, label: "Inside", blurb: "Recommended scale + bebop",
    style: { pitchPool: "scale", enclosureProb: 0.12, doubleEnclosureProb: 0.02, alteredProb: 0 },
  },
  3: {
    n: 3, label: "Chromatic", blurb: "Enclosures + approaches",
    style: { pitchPool: "scale", enclosureProb: 0.65, doubleEnclosureProb: 0.4, alteredProb: 0 },
  },
  4: {
    n: 4, label: "Structures", blurb: "Triad pairs + cells",
    style: { pitchPool: "scale", enclosureProb: 0.35, doubleEnclosureProb: 0.15, leapProb: 0.3, motifEchoProb: 0.55 },
  },
  5: {
    n: 5, label: "Exotic", blurb: "Altered + side-slip",
    style: { pitchPool: "scale", enclosureProb: 0.5, doubleEnclosureProb: 0.3, leapProb: 0.28, alteredProb: 0.85 },
  },
}

// Overlay a level onto an already-blended style. Returns the same object
// when there's no level, so the default path is untouched.
export function levelStyle(style, level) {
  const rung = IMPROV_LEVELS[level]
  if (!rung) return style
  const { cellWeights, ...rest } = rung.style
  return {
    ...style,
    ...rest,
    cellWeights: cellWeights ? { ...style.cellWeights, ...cellWeights } : style.cellWeights,
    level: rung.n,
    levelLabel: rung.label,
  }
}

// ─── Applying lenses to a timeline ────────────────────────────────────────

// Returns a new timeline whose segments have been through every lens, in the
// order given — so `["minor-conversion", "bebop-scale"]` converts first and
// then bebops the converted scale, which is the order a player would learn
// them. Each segment collects the notes of the lenses that touched it in
// `deviceNotes`, for the per-bar reasoning strip.
export function applyDevices(timeline, { devices } = {}) {
  const list = normalizeDevices(devices).filter(({ device }) => typeof device.apply === "function")
  if (!list.length) return timeline

  const segments = timeline.segments.map((original, index) => {
    let seg = original
    const notes = []
    const used = []
    for (const { device, opts } of list) {
      let patch = null
      try {
        // Context, because some lenses are about a chord's PLACE, not just
        // its quality: a turnaround substitution has to know which dominant
        // in the cycle this is.
        patch = device.apply(seg, opts, { index, segments: timeline.segments })
      } catch {
        patch = null // a lens that can't read this chord simply doesn't apply
      }
      if (!patch) continue
      const { note, ...fields } = patch
      seg = { ...seg, ...fields }
      if (note) notes.push(note)
      used.push(device.label)
    }
    return used.length ? { ...seg, deviceNotes: notes, deviceLabels: used } : original
  })

  return { ...timeline, segments }
}

// ─── Fillers on the style ─────────────────────────────────────────────────

// Attach the chosen approach filler and its weight overrides. Applied AFTER
// the level, so naming a device beats the level's generic idea of how much
// chromaticism belongs here — you asked for encirclements, you get them.
//
// Returns the same object when no filler device is present, keeping the
// default path (and its seeded stream) untouched.
export function deviceStyle(style, devices) {
  const shaping = normalizeDevices(devices).filter(({ device }) => device.style || device.approach)
  if (!shaping.length) return style

  let next = { ...style }
  // Last approach named wins the slot — two approach types over one target
  // isn't a thing, and silently blending them would teach neither. A rhythm
  // device names no approach, so it stacks freely with one.
  const approaches = shaping.filter(({ device }) => device.approach)
  if (approaches.length) {
    const chosen = approaches[approaches.length - 1].device
    next.approach = chosen.approach
    next.approachLabel = chosen.label
  }
  for (const { device } of shaping) next = { ...next, ...(device.style || {}) }
  return next
}
