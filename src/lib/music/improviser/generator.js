// The improviser's pitch engine. Order of operations per phrase — rhythm
// first, harmony second, pitch path last:
//
//   1. phrase spans and rests come from the planner (rhythm.js);
//   2. each phrase gets a rhythm skeleton — or echoes the previous phrase's
//      rhythm with new pitches (the cheapest motif transformation, and the
//      one that most makes the line sound like it's saying something);
//   3. anchor onsets are chosen: the phrase opening, the first onset at each
//      chord change, and the landing — anchors get guide tones (3rds/7ths)
//      so strong moments spell the harmony;
//   4. the onsets between anchors are filled with scale steps walking toward
//      the next anchor, chromatic enclosures just before it, and occasional
//      chord-tone leaps — altered material on dominants at the rate the
//      Altered control asks for;
//   5. velocity and accents are generated per note, never fixed.
//
// Everything is seeded — see rng.js.

import { createRng, pickWeighted, chance } from "./rng"
import { normalizeMeasures, segmentAtBeat } from "./chartTimeline"
import { blendStyle } from "./profiles"
import { buildPhraseSkeleton, planPhrases } from "./rhythm"
import { eventsToLine } from "./toLine"

// ─── Pitch helpers ────────────────────────────────────────────────────────

// Nearest MIDI instance of a pitch class to `ref`, inside the register.
function nearestMidi(pc, ref, register) {
  let best = null
  for (let midi = register.min; midi <= register.max; midi++) {
    if (midi % 12 !== pc) continue
    if (best == null || Math.abs(midi - ref) < Math.abs(best - ref)) best = midi
  }
  return best ?? Math.min(register.max, Math.max(register.min, ref))
}

// Next scale tone above/below `midi` from a pc set, staying in register.
function scaleStep(midi, pcs, direction, register) {
  for (let step = 1; step <= 12; step++) {
    const candidate = midi + step * direction
    if (candidate < register.min || candidate > register.max) break
    if (pcs.includes(((candidate % 12) + 12) % 12)) return candidate
  }
  // Walked off the register — turn around.
  for (let step = 1; step <= 12; step++) {
    const candidate = midi - step * direction
    if (candidate < register.min || candidate > register.max) break
    if (pcs.includes(((candidate % 12) + 12) % 12)) return candidate
  }
  return midi
}

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
// monophonic clip in toLine.
function ensureChangeOnsets({ rng, style, timeline, onsets, span }) {
  if (!onsets.length) return onsets
  const out = [...onsets]
  for (const seg of timeline.segments) {
    const B = seg.startBeat
    if (B < span.startBeat + 0.5 || B > span.endBeat - 0.5) continue
    const near = out.some((o) => o.t > B - 0.55 && o.t < B + 0.3)
    if (!near && chance(rng, style.nailChangeProb)) out.push({ t: B, d: 0.5 })
  }
  return out.sort((a, b) => a.t - b.t)
}

// Mark which onsets are anchors and what pitch class each should land.
// Returns onsets decorated with { seg, anchor: null | { pc, role, symbol } }.
function assignAnchors({ rng, style, timeline, onsets, prevMidi }) {
  const decorated = onsets.map((o) => ({ ...o, seg: segmentAtBeat(timeline, o.t), anchor: null }))
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
  for (const seg of timeline.segments) {
    const B = seg.startBeat
    if (B <= tFirst + 1e-6 || B > tLast + 0.6) continue
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

function roleOf(pc, seg) {
  if (pc === seg.thirdPc) return "3rd"
  if (pc === seg.seventhPc) return "7th"
  if (pc === seg.rootPc) return "root"
  if (pc === (seg.rootPc + 7) % 12) return "5th"
  return "color tone"
}

// ─── Phrase pitch fill ────────────────────────────────────────────────────

function fillPhrase({ rng, style, decorated, prevMidi, contour, phraseSpan, alteredSegs }) {
  const { register } = style
  const events = []
  const live = decorated.filter((o) => o.seg) // silent (N.C.) onsets drop out
  if (!live.length) return { events, lastMidi: prevMidi, devices: [] }

  const devices = new Set()

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

  // Walk the onsets.
  let current = prevMidi
  for (let i = 0; i < live.length; i++) {
    const o = live[i]
    let midi

    if (o.anchor) {
      midi = o.midi
    } else if (o.enclose) {
      midi = o.enclose.target + o.enclose.side
      midi = Math.min(register.max, Math.max(register.min, midi))
    } else {
      // Scale material — altered on dominants when the dice said so.
      const useAltered = o.seg.alteredPcs && alteredSegs.has(o.seg.startBeat)
      const pcs = useAltered ? o.seg.alteredPcs : o.seg.scalePcs
      if (useAltered) devices.add("altered")

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
        const targets = o.seg.chordPcs
          .map((pc) => nearestMidi(pc, current + direction * 5, style.register))
          .filter((m) => Math.abs(m - current) >= 3 && Math.abs(m - current) <= 9)
        if (targets.length) {
          midi = targets[Math.floor(rng() * targets.length)]
          devices.add("arpeggio leap")
        }
      }
      if (midi == null) {
        midi = scaleStep(current, pcs, direction, register)
        if (midi === current) midi = scaleStep(current, pcs, -direction, register)
      }
    }

    events.push({ t: o.t, d: o.d, midi, anchor: o.anchor || null, seg: o.seg })
    current = midi
  }

  return { events, lastMidi: current, devices: [...devices] }
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

// ─── Summary ──────────────────────────────────────────────────────────────

function describe(phraseTraces, style) {
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
  return `${clauses.join(", ")}. ${style.label} profile — space ${Math.round(style.controls.space * 100)}%, altered ${Math.round(style.controls.altered * 100)}%.`
}

// ─── Public entry ─────────────────────────────────────────────────────────

// measures: array of measure strings. Returns { line, trace } where line is
// the LineLab schema (with per-note velocity in tuple slot 4) and trace
// records every phrase-level decision for the dev drawer / tests.
export function improvise({ measures, profileId = "bebop", controls = {}, seed = 1 }) {
  const rng = createRng(seed)
  const style = blendStyle(profileId, controls)
  const timeline = normalizeMeasures(measures)
  if (!timeline.totalBeats) return { line: { bars: [], s: "" }, trace: { phrases: [] } }

  const phrases = planPhrases({ rng, style, totalBeats: timeline.totalBeats })

  const allEvents = []
  const phraseTraces = []
  let prevMidi = style.register.center
  let prevSkeleton = null

  for (const span of phrases) {
    // Motif echo: reuse the previous phrase's rhythm, shifted to this span.
    let skeleton = null
    let echo = false
    if (prevSkeleton && chance(rng, style.motifEchoProb)) {
      const shifted = prevSkeleton.onsets
        .map((o) => ({ t: o.t - prevSkeleton.startBeat + span.startBeat, d: o.d }))
        .filter((o) => o.t < span.endBeat - 1e-6)
      if (shifted.length >= 2) {
        skeleton = { onsets: shifted }
        echo = true
      }
    }
    if (!skeleton) {
      skeleton = buildPhraseSkeleton({
        rng, style,
        startBeat: span.startBeat,
        endBeat: span.endBeat,
        ringUntil: span.endBeat + span.gapAfter,
      })
    }
    prevSkeleton = { onsets: skeleton.onsets, startBeat: span.startBeat }

    // Altered-or-not is decided once per dominant segment per phrase, so a
    // phrase commits to a color instead of flickering note-by-note.
    const alteredSegs = new Set()
    for (const seg of timeline.segments) {
      if (seg.isDominant && seg.alteredPcs && chance(rng, style.alteredProb)) alteredSegs.add(seg.startBeat)
    }

    const contour = pickWeighted(rng, style.contourWeights)
    // Applied to fresh AND echoed skeletons — an echoed rhythm still has to
    // speak the changes of the bars it now sits over.
    const onsets = ensureChangeOnsets({ rng, style, timeline, onsets: skeleton.onsets, span })
    const decorated = assignAnchors({ rng, style, timeline, onsets, prevMidi })
    const { events, lastMidi, devices } = fillPhrase({
      rng, style, decorated, prevMidi, contour, phraseSpan: span, alteredSegs,
    })
    applyDynamics({ rng, style, events })

    const lastAnchor = [...events].reverse().find((e) => e.anchor)
    phraseTraces.push({
      startBeat: span.startBeat,
      endBeat: span.endBeat,
      contour,
      echo,
      devices,
      noteCount: events.length,
      // anchor.symbol, not seg.symbol — an anticipated landing sounds over
      // the OLD segment but spells the NEW chord.
      landing: lastAnchor ? { role: lastAnchor.anchor.role, symbol: lastAnchor.anchor.symbol } : null,
    })

    allEvents.push(...events)
    prevMidi = lastMidi
  }

  const summary = describe(phraseTraces, style)
  const line = eventsToLine({ events: allEvents, timeline, summary, style, seed })
  return { line, trace: { seed, profileId: style.id, controls: style.controls, phrases: phraseTraces } }
}
