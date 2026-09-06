// The improviser's pitch engine. Order of operations per phrase — rhythm
// first, harmony second, pitch path last:
//
//   1. phrase spans and rests come from the planner (rhythm.js);
//   2. each phrase gets a rhythm skeleton — or echoes the previous phrase's
//      rhythm with new pitches (the cheapest motif transformation, and the
//      one that most makes the line sound like it's saying something);
//   3. anchor onsets are chosen: the phrase opening, the first onset at each
//      chord change (or the "&" before it — anticipation), and the landing —
//      anchors get guide tones (3rds/7ths) so strong moments spell the
//      harmony;
//   4. the onsets between anchors are filled with scale steps walking toward
//      the next anchor, chromatic enclosures just before it, and occasional
//      chord-tone leaps — altered material on dominants at the rate the
//      Altered control asks for;
//   5. velocity and accents are generated per note, never fixed.
//
// All harmony reads go through a form view (chartTimeline.createFormView),
// so the same code serves the finite generator (one pass over a selection)
// and the continuous session (absolute beats wrapping over the form for as
// long as the band plays). Everything is seeded — see rng.js.

import { createRng, pickWeighted, chance } from "./rng"
import { normalizeMeasures, createFormView } from "./chartTimeline"
import { blendStyle } from "./profiles"
import { buildPhraseSkeleton, planPhrases } from "./rhythm"
import { eventsToLine } from "./toLine"
import { applyDevices, levelStyle, deviceStyle, IMPROV_DEVICES } from "./devices"
import { buildApproachRun } from "./fillers"
import { nearestMidi, scaleStep, clampToRegister, leapStep } from "./pitch"
import { triadPairFor } from "./structures"
import { createTcaState, tcaAdvance, TCA_INVERSION_NAMES } from "./tca"

const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

// The name a device puts in the reasoning strip, keyed by the style flag the
// generator branches on — so the branch and the label can't drift apart. They
// did once: this file said "Wide interval" while the device called itself
// "Wide interval (Thesaurus)", and nothing could match a bar to the device
// that wrote it. Same failure the approach fillers had. Read it from the
// registry and the whole class of bug is closed.
const DEVICE_LABEL = {
  triadPair: IMPROV_DEVICES["triad-pairs"].label,
  cycleCell: IMPROV_DEVICES["cyclic-quadruplets"].label,
  pitchEcho: IMPROV_DEVICES.displacement.label,
  minInterval: IMPROV_DEVICES["wide-interval"].label,
  tcaChain: IMPROV_DEVICES.tca.label,
}
const nameOfMidi = (midi) => NOTE_NAMES[((midi % 12) + 12) % 12]

// Gentle per-phrase shape: an offset (semitones) the anchors drift by as the
// phrase progresses, so lines arc instead of wandering flat.
function contourOffset(contour, progress) {
  switch (contour) {
    case "arch": return Math.sin(progress * Math.PI) * 5
    case "valley": return -Math.sin(progress * Math.PI) * 5
    case "ascending": return progress * 6
    case "descending": return -progress * 6
    default: return 0
  }
}

// ─── Anchor selection ─────────────────────────────────────────────────────

// The rhythm cells don't know where the chord changes are, so a change can
// fall in the middle of a cell with no onset on it — and the guide tone
// would land late. Insert an onset right on the change (nailChangeProb)
// when the cells left it bare. Ringing overlaps are cleaned up by the
// monophonic clip in toLine / the transport adapter.
function ensureChangeOnsets({ rng, style, form, onsets, span }) {
  if (!onsets.length) return onsets
  const out = [...onsets]
  for (const { beat: B } of form.changesIn(span.startBeat + 0.5, span.endBeat - 0.5)) {
    const near = out.some((o) => o.t > B - 0.55 && o.t < B + 0.3)
    if (!near && chance(rng, style.nailChangeProb)) out.push({ t: B, d: 0.5 })
  }
  return out.sort((a, b) => a.t - b.t)
}

// Mark which onsets are anchors and what pitch class each should land.
// Returns onsets decorated with { seg, anchor: null | { pc, role, symbol } }.
function assignAnchors({ rng, style, form, onsets, prevMidi }) {
  const decorated = onsets.map((o) => ({ ...o, seg: form.segAt(o.t), anchor: null }))
  const live = decorated.filter((o) => o.seg)
  if (!live.length) return decorated

  // Phrase opening: a chord tone, not forced to a guide tone.
  const first = live[0]
  const openPc = pickWeighted(rng, first.seg.chordPcs.map((pc) => [
    pc,
    pc === first.seg.thirdPc ? 3 : pc === first.seg.rootPc ? 1 : 2,
  ]))
  first.anchor = { pc: openPc, role: roleOf(openPc, first.seg), symbol: first.seg.symbol }

  // Chord changes: the new chord's 3rd or 7th — whichever voice-leads closer
  // from the previous anchor — placed either right on the change or, with
  // anticipationProb, on the "&" BEFORE the barline so the line pushes over
  // the bar instead of always speaking exactly at it.
  const dist = (a, b) => Math.min(Math.abs(a - b), 12 - Math.abs(a - b))
  const tFirst = live[0].t
  const tLast = live[live.length - 1].t
  let refPc = openPc
  for (const { beat: B, seg } of form.changesIn(tFirst, tLast + 0.6)) {
    const before = [...live].reverse().find((o) => !o.anchor && o.t > B - 0.6 && o.t < B - 0.05)
    const atOrAfter = live.find((o) => !o.anchor && o.t >= B - 0.05 && o.t < B + seg.beats)
    let pick = atOrAfter
    let anticipated = false
    if (before && chance(rng, style.anticipationProb)) {
      pick = before
      anticipated = true
    }
    if (!pick) continue
    const pc = dist(seg.thirdPc, refPc) <= dist(seg.seventhPc, refPc) ? seg.thirdPc : seg.seventhPc
    pick.anchor = { pc, role: roleOf(pc, seg), symbol: seg.symbol, anticipated }
    refPc = pc
  }

  // Landing: the phrase's final onset resolves to a chord tone.
  const last = live[live.length - 1]
  if (!last.anchor) {
    const pc = pickWeighted(rng, last.seg.chordPcs.map((p) => [
      p,
      p === last.seg.thirdPc ? 3 : p === last.seg.seventhPc ? 2.5 : p === last.seg.rootPc ? 1.5 : 1,
    ]))
    last.anchor = { pc, role: roleOf(pc, last.seg), symbol: last.seg.symbol }
  }

  return decorated
}

// Exact interval identities first, the guide-tone slots last. thirdPc and
// seventhPc are FALLBACK-prone — guidePcsFor walks 7th → 6th → 5th, and the
// Triads lens deliberately leaves seventhPc pointing at the 5th — so testing
// them first labels a plain 5th as "the 7th of Cmaj7". The reasoning strip is
// only worth having if it says the true name.
function roleOf(pc, seg) {
  if (pc === seg.rootPc) return "root"
  if (pc === (seg.rootPc + 4) % 12 || pc === (seg.rootPc + 3) % 12) return "3rd"
  if (pc === (seg.rootPc + 7) % 12) return "5th"
  if (pc === seg.thirdPc) return "3rd"
  if (pc === seg.seventhPc) return "7th"
  return "color tone"
}

// ─── Cyclic quadruplets ───────────────────────────────────────────────────

// A cell is four offsets into whatever chord is sounding — a SHAPE, not four
// fixed pitches. Restated over a new chord it re-spells itself, which is the
// point Ligon is making: one small idea generates a chorus because it isn't
// tied to one harmony.
const CELL_SHAPES = [[0, 1, 2, 1], [0, 2, 1, 3], [0, 1, 3, 2], [0, 3, 2, 1], [0, 2, 3, 1]]

function buildCell(rng) {
  return CELL_SHAPES[Math.floor(rng() * CELL_SHAPES.length)]
}

// The cell repeats every `4 + rotate` notes rather than every 4, so its first
// note lands one position later in the bar on every restatement — the shape
// holds still and the downbeat walks. The extra notes are the rotation, and
// they're labelled as such so a student can point at where beat 1 of the
// original cell now falls.
// The cell's four actual pitches over one chord. A pure function of (cell,
// chord, register) and NOT of where the line happens to be — resolving each
// note near `current` instead made the cell jump octaves between
// restatements, which spells the same shape and sounds like a different one.
// The student has to recognise it coming back; that's the whole gate.
function cellVoicing(cell, seg, register) {
  const pool = seg.pitchPcs ?? seg.chordPcs
  if (!pool.length) return null
  const out = []
  let ref = register.center
  for (const idx of cell) {
    const midi = nearestMidi(pool[idx % pool.length], ref, register)
    out.push(midi)
    ref = midi
  }
  return out
}

function cyclicPitch({ index, cell, rotate, seg, current, register }) {
  const period = 4 + rotate
  const j = index % period
  const voicing = cellVoicing(cell, seg, register)
  if (!voicing) return { midi: current, why: "rotation note" }
  if (j < 4) return { midi: voicing[j], why: `cell note ${j + 1} of 4` }
  // Rotation note — a neighbour off the cell's last note, so it reads as a
  // hinge between restatements rather than as part of the shape.
  return {
    midi: scaleStep(voicing[3], seg.scalePcs, j % 2 ? 1 : -1, register),
    why: "rotation note",
  }
}

// ─── Phrase pitch fill ────────────────────────────────────────────────────

function fillPhrase({ rng, style, decorated, prevMidi, contour, phraseSpan, cell, echoPitches, cycleFrom = 0, tcaFrom = null }) {
  const { register } = style
  const events = []
  const live = decorated.filter((o) => o.seg) // silent (N.C.) onsets drop out
  // A phrase with nothing to say passes the chain along untouched rather than
  // starting one — a rest is a breath, not a reset.
  if (!live.length) {
    return { events, lastMidi: prevMidi, devices: [], approaches: [], cycleIndex: cycleFrom, tca: tcaFrom }
  }

  // The cycle carries ACROSS phrases: a rotation that restarted every phrase
  // would put beat 1 of the cell back where it began, which is the one thing
  // the device exists not to do.
  let cycleIndex = cycleFrom
  // The triad chain runs continuously through the whole line, not per phrase —
  // Garzone's chain doesn't restart because the player took a breath.
  let tca = tcaFrom ?? createTcaState(prevMidi)
  const devices = new Set()
  // Approach runs as runs, not as loose notes — the only way a caller (or a
  // test) can check a rule that's about the SHAPE, like "never the same
  // direction twice", once the notes are interleaved with anchors in a bar.
  const approaches = []
  // Altered-or-not is decided once per dominant segment per phrase, so a
  // phrase commits to a color instead of flickering note-by-note.
  const alteredBySeg = new Map()
  const useAlteredFor = (seg) => {
    if (!seg.isDominant || !seg.alteredPcs) return false
    if (!alteredBySeg.has(seg.startBeat)) alteredBySeg.set(seg.startBeat, chance(rng, style.alteredProb))
    return alteredBySeg.get(seg.startBeat)
  }

  // Resolve anchor midis in time order — voice leading first, contour
  // second. Each anchor sits as close as possible to the previous one (the
  // falling 7th→3rd guide-tone line emerges from proximity alone); the
  // contour only nudges the search point a couple of semitones, and any
  // resolution that still lands a leap wider than a 5th is re-picked purely
  // by proximity.
  const anchors = live.filter((o) => o.anchor)
  let ref = prevMidi
  for (const a of anchors) {
    const progress = (a.t - phraseSpan.startBeat) / Math.max(1, phraseSpan.endBeat - phraseSpan.startBeat)
    const drift = Math.max(-2.5, Math.min(2.5, contourOffset(contour, progress) * 0.5))
    a.midi = nearestMidi(a.anchor.pc, ref + drift, register)
    if (Math.abs(a.midi - ref) > 6) a.midi = nearestMidi(a.anchor.pc, ref, register)
    if (a.anchor.anticipated) devices.add("anticipation")
    ref = a.midi
  }

  if (style.approach) {
    // A named approach device is driving. It claims the free onsets before
    // each anchor — as many as its shape wants and the phrase can spare —
    // and writes the whole run at once, because an encirclement or a
    // Garzone walk is one gesture, not a sequence of independent choices.
    for (let i = 0; i < live.length; i++) {
      if (!live[i].anchor || i === 0) continue
      if (!chance(rng, style.approachProb ?? 1)) continue
      let free = 0
      while (
        free < 4 && i - 1 - free >= 0 &&
        !live[i - 1 - free].anchor && !live[i - 1 - free].approach &&
        // Peña's formula reserves beats 1 and 3 for chord tones, so an
        // approach may only take the offbeats leading into its target.
        // Without this the encirclements simply eat the strong beats and the
        // device produces LESS structure than leaving it off — measured.
        !(style.strongBeatChordTones && Math.abs(live[i - 1 - free].t % 2) < 1e-6)
      ) free++
      if (!free) continue
      const run = buildApproachRun({
        id: style.approach, rng, count: free,
        target: live[i].midi, seg: live[i].seg, register,
      })
      if (!run?.length) continue
      // The run ends on the note before the target, so it back-fills.
      run.forEach((note, k) => {
        const onset = live[i - run.length + k]
        if (onset) onset.approach = { ...note, target: live[i].midi }
      })
      devices.add(run[0].device)
      approaches.push({
        device: run[0].device,
        target: live[i].midi,
        notes: run.map((n) => n.midi),
      })
    }
  } else {
    // Mark enclosures: the 1-2 onsets immediately before an anchor.
    for (let i = 0; i < live.length; i++) {
      if (!live[i].anchor || i === 0) continue
      if (chance(rng, style.enclosureProb)) {
        live[i - 1].enclose = { target: live[i].midi, side: chance(rng, 0.5) ? 1 : -1 }
        devices.add("enclosure")
        if (i >= 2 && !live[i - 2].anchor && chance(rng, style.doubleEnclosureProb)) {
          live[i - 2].enclose = { target: live[i].midi, side: -live[i - 1].enclose.side }
        }
      }
    }
  }

  // Walk the onsets.
  let current = prevMidi
  for (let i = 0; i < live.length; i++) {
    const o = live[i]
    let midi

    // A restatement that runs longer than what it restates would have to
    // invent notes, and then "the same phrase, moved" is false. The phrase
    // simply stops where the original did — the onsets after it stay silent.
    if (echoPitches && i >= echoPitches.length) continue

    if (echoPitches) {
      // The 6.2 drill: the identical pitch content, in order, entering later
      // against the beat. Nothing else about the phrase may vary, or the
      // student can't prove the notes were the same.
      midi = echoPitches[i]
      o.why = "restated, displaced"
      o.device = DEVICE_LABEL.pitchEcho
      devices.add("displacement")
    } else if (style.triadPair) {
      // Three notes of one triad, three of the other, and never a blend —
      // Chapter 1.4's gate is naming the two triads by ear, which only works
      // if they arrive as two objects rather than one scale.
      const pair = triadPairFor(o.seg)
      const side = Math.floor(cycleIndex / 3) % 2 === 0 ? pair.a : pair.b
      const pc = side.pcs[cycleIndex % 3]
      midi = nearestMidi(pc, current, register)
      o.why = `${side.name} triad`
      o.device = DEVICE_LABEL.triadPair
      devices.add("triad pair")
      cycleIndex++
    } else if (style.cycleCell && cell) {
      // The cell owns every note, anchors included: "one cell, a whole
      // chorus" isn't true if the engine keeps interrupting it to spell the
      // changes. It re-spells anyway — the cell is read off the sounding
      // chord, so a chord change transposes the shape instead of breaking it.
      const picked = cyclicPitch({
        index: cycleIndex++, cell, rotate: style.cycleRotate ?? 1,
        seg: o.seg, current, register,
      })
      midi = picked.midi
      o.why = picked.why
      o.device = DEVICE_LABEL.cycleCell
      devices.add("cyclic cell")
    } else if (o.anchor) {
      midi = o.midi
      o.why = `${o.anchor.role} of ${o.anchor.symbol}`
      o.device = o.anchor.role === "3rd" || o.anchor.role === "7th" ? "guide tone" : "chord tone"
    } else if (o.approach) {
      midi = o.approach.midi
      o.why = `${o.approach.device.toLowerCase()} into ${nameOfMidi(o.approach.target)}`
      o.device = o.approach.device
    } else if (style.tcaChain) {
      // The chain takes the space BETWEEN landings, and it yields to both the
      // landing itself and to any approach leading into one. That ordering is
      // load-bearing: Chapter 8.1 asks for the chain AND a random chromatic
      // approach together, and with the chain checked first it simply ate the
      // approach and the segment quietly taught one device instead of two.
      const step = tcaAdvance(tca, rng, register)
      tca = step.state
      midi = step.midi
      o.device = DEVICE_LABEL.tcaChain
      o.why = step.position === 0
        ? `${step.quality} triad, ${TCA_INVERSION_NAMES[step.inversion]}`
        : `${step.quality} triad`
      devices.add("triad chain")
    } else if (o.enclose) {
      midi = clampToRegister(o.enclose.target + o.enclose.side, register)
      o.why = `encloses ${nameOfMidi(o.enclose.target)}`
      o.device = "enclosure"
    } else {
      // Scale material — altered on dominants when the dice said so. The
      // altered roll happens either way so the seeded stream doesn't shift
      // when a level moves the line onto the chord-tone pool.
      const useAltered = useAlteredFor(o.seg)
      // Level 1 walks chord tones rather than the scale; `pitchPcs` is the
      // real chord until a device lens (Martino conversion, Triads) has
      // replaced it, so "skeleton" means the skeleton of whatever the
      // student is actually being asked to hear.
      // Peña holds the strong beats with chord tones — beats 1 and 3 carry
      // the structure, everything else is passing motion.
      const onStrongBeat = Math.abs(o.t % 2) < 1e-6
      const chordPool = style.pitchPool === "chord" || (style.strongBeatChordTones && onStrongBeat)
      const pcs = chordPool
        ? (o.seg.pitchPcs ?? o.seg.chordPcs)
        : useAltered ? o.seg.alteredPcs : o.seg.scalePcs
      if (useAltered && !chordPool) devices.add("altered")
      o.device = chordPool ? "chord tone" : useAltered ? "altered" : "scale"

      // Direction: head for the next anchor; wander if there isn't one.
      const nextAnchor = live.slice(i + 1).find((n) => n.anchor)
      let direction
      if (nextAnchor) {
        const gap = nextAnchor.midi - current
        const stepsLeft = live.slice(i + 1, live.indexOf(nextAnchor) + 1).length
        // Too close too early? Orbit: step away, then back.
        direction = Math.abs(gap) < stepsLeft ? (chance(rng, 0.5) ? 1 : -1) : Math.sign(gap) || 1
      } else {
        direction = chance(rng, 0.5) ? 1 : -1
      }

      if (chance(rng, style.leapProb)) {
        // Chord-tone leap, answered by steps back the other way.
        const targets = (o.seg.pitchPcs ?? o.seg.chordPcs)
          .map((pc) => nearestMidi(pc, current + direction * 5, style.register))
          .filter((m) => Math.abs(m - current) >= 3 && Math.abs(m - current) <= 9)
        if (targets.length) {
          midi = targets[Math.floor(rng() * targets.length)]
          devices.add("arpeggio leap")
          o.device = "arpeggio"
          o.why = "chord-tone leap"
        }
      }
      if (midi == null) {
        midi = style.minInterval
          ? leapStep(current, pcs, direction, register, style.minInterval)
          : scaleStep(current, pcs, direction, register)
        if (midi === current) midi = scaleStep(current, pcs, -direction, register)
        if (style.minInterval && Math.abs(midi - current) >= style.minInterval) {
          o.device = DEVICE_LABEL.minInterval
          o.why = `leap of ${Math.abs(midi - current)} semitones`
          devices.add("wide interval")
        }
      }
    }

    events.push({
      t: o.t, d: o.d, midi, anchor: o.anchor || null, seg: o.seg,
      device: o.device || null, why: o.why || null,
    })
    current = midi
  }

  return { events, lastMidi: current, devices: [...devices], approaches, cycleIndex, tca }
}

// ─── Velocity & articulation ──────────────────────────────────────────────

function applyDynamics({ rng, style, events }) {
  if (!events.length) return
  const peak = events.reduce((a, b) => (b.midi > a.midi ? b : a))
  for (const e of events) {
    let vel = style.baseVelocity + (rng() - 0.5) * 0.06
    const offbeat = Math.abs((e.t % 1) - 0.5) < 0.05
    if (offbeat) vel += 0.08 * style.accentStrength
    if (e.anchor) vel += 0.1 * style.accentStrength
    if (e === peak) vel += 0.08
    if (!e.anchor && !offbeat && e.d <= 0.5 && chance(rng, style.ghostProb)) vel *= 0.55
    e.vel = Math.round(Math.min(0.98, Math.max(0.2, vel)) * 100) / 100
  }
}

// ─── One phrase, start to finish ──────────────────────────────────────────

// Shared by the finite improvise() below and the continuous session. Pure:
// all state that carries phrase-to-phrase travels in `memory`
// ({ prevMidi, prevSkeleton }), so the session can snapshot and restore it
// when live control changes force a replan.
export function generatePhrase({ rng, style, form, span, memory }) {
  // Displacement: how far into the span this phrase enters. Zero unless a
  // rhythm device asks for it, and it consumes no rng — a dial, not a dice
  // roll, because "shifted by exactly an eighth" is the thing being drilled.
  // It rotates through a two-beat cycle so the entry keeps moving rather than
  // settling into a new, equally fixed place.
  const phraseIndex = memory.phraseIndex ?? 0
  const rotate = style.displacementRotate ?? 0
  const offset = rotate
    ? ((style.displacement ?? 0) + phraseIndex * rotate) % 2
    : (style.displacement ?? 0)
  const startBeat = Math.min(span.startBeat + offset, span.endBeat - 0.5)

  // The cell survives the whole line — the Chapter 6 gate is "a full chorus
  // generated from ONE cell", so it lives in memory, not in the phrase.
  const cell = style.cycleCell ? (memory.cell ?? buildCell(rng)) : null

  // Pitch echo is the inverse of the motif echo below: that one keeps the
  // rhythm and finds new notes, this one keeps the notes and moves them.
  const echoPitches = style.pitchEcho && memory.prevPitches?.length ? memory.prevPitches : null

  // Motif echo: reuse the previous phrase's rhythm, shifted to this span.
  let skeleton = null
  let echo = false
  const prev = memory.prevSkeleton
  if (prev && chance(rng, style.motifEchoProb)) {
    const shifted = prev.onsets
      .map((o) => ({ t: o.t - prev.startBeat + startBeat, d: o.d }))
      .filter((o) => o.t < span.endBeat - 1e-6)
    if (shifted.length >= 2) {
      skeleton = { onsets: shifted }
      echo = true
    }
  }
  // A displaced restatement keeps the rhythm it is displacing — otherwise
  // "the same phrase, an eighth later" is just a different phrase.
  if (!skeleton && echoPitches && prev) {
    const shifted = prev.onsets
      .map((o) => ({ t: o.t - prev.startBeat + startBeat, d: o.d }))
      .filter((o) => o.t < span.endBeat - 1e-6)
    if (shifted.length >= 2) skeleton = { onsets: shifted }
  }
  if (!skeleton) {
    skeleton = buildPhraseSkeleton({
      rng, style,
      startBeat,
      endBeat: span.endBeat,
      ringUntil: span.endBeat + span.gapAfter,
    })
  }

  // Applied to fresh AND echoed skeletons — an echoed rhythm still has to
  // speak the changes of the bars it now sits over.
  const onsets = ensureChangeOnsets({ rng, style, form, onsets: skeleton.onsets, span })
  const contour = pickWeighted(rng, style.contourWeights)
  const decorated = assignAnchors({ rng, style, form, onsets, prevMidi: memory.prevMidi })
  const { events, lastMidi, devices, approaches, cycleIndex, tca } = fillPhrase({
    rng, style, decorated, prevMidi: memory.prevMidi, contour, phraseSpan: span,
    cell, echoPitches, cycleFrom: memory.cycleIndex ?? 0, tcaFrom: memory.tca ?? null,
  })
  applyDynamics({ rng, style, events })

  const lastAnchor = [...events].reverse().find((e) => e.anchor)
  const trace = {
    startBeat: span.startBeat,
    endBeat: span.endBeat,
    displacement: offset,
    // The pitch sequence, so "the same notes, moved" is checkable rather than
    // asserted. Chapter 6.2's gate is literally "the notes provably
    // identical" — a claim the engine should be able to substantiate.
    pitches: events.map((e) => e.midi),
    restated: !!echoPitches,
    contour,
    echo,
    devices,
    approaches,
    noteCount: events.length,
    // anchor.symbol, not seg.symbol — an anticipated landing sounds over
    // the OLD segment but spells the NEW chord.
    landing: lastAnchor ? { role: lastAnchor.anchor.role, symbol: lastAnchor.anchor.symbol } : null,
  }

  return {
    events,
    trace,
    memory: {
      prevMidi: lastMidi,
      prevSkeleton: { onsets: skeleton.onsets, startBeat: startBeat },
      prevPitches: events.map((e) => e.midi),
      phraseIndex: phraseIndex + 1,
      cell,
      cycleIndex,
      tca,
    },
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────

export function describePhrases(phraseTraces, style) {
  if (!phraseTraces.length) return ""
  const clauses = phraseTraces.map((p, i) => {
    const onbeat = Math.abs(p.startBeat % 1) < 0.01 && p.startBeat % 4 === 0
    const entry = i === 0
      ? (onbeat ? "Opens on the beat" : "Opens off the beat")
      : p.echo ? "then answers with the same rhythm on new pitches"
      : "then a new idea"
    const dev = p.devices.length ? ` (${p.devices.join(", ")})` : ""
    const landing = p.landing ? `, landing on the ${p.landing.role} of ${p.landing.symbol}` : ""
    return `${entry}${dev}${landing}`
  })
  const rung = style.levelLabel ? `L${style.level} ${style.levelLabel}, ` : ""
  return `${clauses.join(", ")}. ${rung}${style.label} profile — space ${Math.round(style.controls.space * 100)}%, altered ${Math.round(style.controls.altered * 100)}%.`
}

// ─── Public entry (finite) ────────────────────────────────────────────────

// measures: array of measure strings. Returns { line, trace } where line is
// the LineLab schema (with per-note velocity in tuple slot 4) and trace
// records every phrase-level decision for the dev drawer / tests.
//
// devices — device lens ids ("minor-conversion", or { id: "scale-choice",
//   scale: "lydian" }), applied in order to the harmony the generator reads.
// level  — 1-5 on the Skeleton→Exotic ladder; overrides the profile weights
//   it names and leaves the rest alone.
// tag    — stamped on every bar's reasoning, so a line generated for a
//   curriculum segment can always be traced back to it.
//
// All three are optional and none of them draws from the rng: omitting them
// reproduces exactly the line this function returned before they existed.
export function improvise({
  measures, profileId = "bebop", controls = {}, seed = 1,
  devices = [], level = null, tag = "",
}) {
  const rng = createRng(seed)
  const style = deviceStyle(levelStyle(blendStyle(profileId, controls), level), devices)
  const timeline = applyDevices(normalizeMeasures(measures), { devices })
  if (!timeline.totalBeats) return { line: { bars: [], s: "" }, trace: { phrases: [] } }
  const form = createFormView(timeline)

  const phrases = planPhrases({ rng, style, totalBeats: timeline.totalBeats })

  const allEvents = []
  const phraseTraces = []
  let memory = { prevMidi: style.register.center, prevSkeleton: null }

  for (const span of phrases) {
    const result = generatePhrase({ rng, style, form, span, memory })
    memory = result.memory
    allEvents.push(...result.events)
    phraseTraces.push(result.trace)
  }

  const summary = describePhrases(phraseTraces, style)
  const line = eventsToLine({ events: allEvents, timeline, summary, style, seed, tag })
  return {
    line,
    trace: {
      seed, profileId: style.id, controls: style.controls, phrases: phraseTraces,
      level: style.level ?? null, tag: tag || null,
    },
  }
}
