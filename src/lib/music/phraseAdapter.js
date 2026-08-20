// Converts a Phrase Machine phraseEngine.js runGenerator() result into
// DukeBox's own line schema — { bars: [{ c, d, x, n: [[string, fret, beats,
// wait]], beats, tailRest }], s } — the same shape Chart, Triad Network, and
// Licktionary sources already produce. Once converted, a Phrase Machine line
// flows through Line Lab's existing pipeline unmodified: LineNotation,
// fretboard walkthrough, band-synced playback, transpose (transposeLine),
// neck-position refingering (refingerLine), MusicXML export, and
// "+ Add to Licktionary" — none of it needs to know the line came from a
// grammar-scored formula instead of the LLM.
//
// This module is the one place that knows two things phraseEngine.js
// deliberately doesn't:
//   1. Register/octave. Phrase Machine works entirely in pitch-class space
//      (mod 12) — a block's notes are letter names with no octave, and the
//      melodic contour (the whole point of its Direction/arch scoring) only
//      exists once notes are placed in a real register. The prototype
//      established that register at render time, in notesToAbcStr's octave
//      picker (nearest-to-previous-note, preferring the "barrel zone" guitar
//      range). assignMidi() below is a direct port of exactly that pass —
//      still needed here for the same reason, just producing MIDI numbers
//      instead of ABC pitch letters.
//   2. String/fret. Once notes have real MIDI values, guitarPosition() (from
//      licktionary.js — the same helper Licktionary's own built-in lines use)
//      picks a default fretting. That's a placeholder, not a final answer:
//      Line Lab already re-runs refingerLine() over whatever `result.bars` it
//      has whenever the neck-position slider moves, for every source. Phrase
//      Machine notes ride that same mechanism — this module never needs to
//      think about neck position at all.
//
// Chord-per-note comes from result.prog directly (which chord's beat range
// contains this note's nominal position), not from blockLog. blockLog's
// startBeat is a formula-position bookkeeping value assignChordsToBlocks
// computes before any connector notes exist, so it doesn't line up with
// actual positions in the rendered note stream once connectors are inserted
// — the prototype's own notesToAbcStr chord-annotation (an exact `===` match
// against beatPos) quietly misses annotations for the same reason. A range
// lookup against a position tracked through the real note stream (below)
// doesn't have that gap.

import { PM_NOTES, BLOCK_LABELS } from "@/lib/music/phraseEngine"
import { guitarPosition } from "@/lib/music/licktionary"

// ─── Register: nominal notes -> MIDI, in melodic order ────────────────────
// Direct port of notesToAbcStr's octave picker. `prev` persists across the
// whole phrase (rests don't touch it, matching the original) so contour
// stays continuous across block and bar boundaries alike.
function assignMidi(notes) {
  let prev = 62 // D4 — same seed the prototype starts from
  return notes.map((n) => {
    if (n.note === "z") return null
    const idx = PM_NOTES.indexOf(n.note)
    if (idx < 0) return null
    const midi4 = 60 + idx
    const midi3 = midi4 - 12
    const midi5 = midi4 + 12
    let tm = [midi3, midi4, midi5].reduce((a, b) => (Math.abs(b - prev) < Math.abs(a - prev) ? b : a))
    // Prefer the barrel zone (guitar frets ~3-8): nudge back to the middle
    // octave if the nearest-to-previous pick landed outside it.
    if ((tm < 53 || tm > 73) && midi4 >= 53 && midi4 <= 75) tm = midi4
    // Smooth voice-leading: a jump over an octave steps back one, same as
    // the prototype (protects against nearest-octave picking a technically-
    // closer note that reads as a register leap).
    if (Math.abs(tm - prev) > 12) {
      if (tm > prev && midi3 >= 48) tm = midi3
      else if (tm < prev && midi5 <= 84) tm = midi5
    }
    prev = tm
    return tm
  })
}

// ─── Chord per note: range lookup against result.prog's beat timeline ─────
function buildChordTimeline(prog) {
  const timeline = []
  let cursor = 0
  for (const ch of prog) {
    timeline.push({ start: cursor, end: cursor + (ch.beats || 8), symbol: ch.symbol })
    cursor += ch.beats || 8
  }
  return timeline
}

function chordAtNominal(timeline, nominalPos) {
  for (const seg of timeline) {
    if (nominalPos >= seg.start && nominalPos < seg.end) return seg.symbol
  }
  return timeline[timeline.length - 1]?.symbol || ""
}

// ─── Bars: bucket the flat note stream into DukeBox's 4-real-beat bars ────
// Real beat = nominal eighth-units / 2 for straight notes, /3 for
// triplet-flagged ones (a triplet group's 3 notes fill one beat, not 2/3 of
// one — see phraseEngine.js's own module comment on BLOCK_EIGHTH_DURATION
// for why the nominal accounting differs). A note that would straddle a bar
// boundary is kept whole in the bar it starts in, rather than split — the
// same level of rigor the prototype's own bar-line insertion had (ABC bar
// lines land at fixed nominal offsets regardless of whether a note's
// duration runs past them).
function buildBars(notes, midis, timeline) {
  // Pass 1: each note's real start position and bar index, tracked as two
  // independent running totals — nominal (for chord lookup, matching
  // phraseEngine.js's own accounting) and real (for bar bucketing). They
  // don't scale together once a triplet block is in play (nominal/2 for
  // straight notes, nominal/3 for triplet ones), so real position has to be
  // its own accumulation, not derived from nominal after the fact.
  let nominalPos = 0
  let realPos = 0
  const positioned = notes.map((note, i) => {
    const durReal = note.triplet ? (note.dur || 1) / 3 : (note.dur || 1) / 2
    const entry = { note, midi: midis[i], nominalStart: nominalPos, durReal, barIndex: Math.floor(realPos / 4) }
    nominalPos += note.dur || 1
    realPos += durReal
    return entry
  })

  // Bars array is sized to the last note's bar index up front, so an
  // all-rest gap spanning a whole bar still gets a (silent) bar entry
  // instead of collapsing the count — no bar is ever silently dropped.
  const barCount = positioned.length ? positioned[positioned.length - 1].barIndex + 1 : 0
  const bars = Array.from({ length: barCount }, () => ({ chords: [], n: [], measureBeats: 0, tailRest: 0 }))

  let pendingRestReal = 0
  positioned.forEach(({ note, midi, nominalStart, durReal, barIndex }) => {
    const bar = bars[barIndex]
    const symbol = chordAtNominal(timeline, nominalStart)
    if (symbol && !bar.chords.includes(symbol)) bar.chords.push(symbol)
    bar.measureBeats += durReal

    if (note.note === "z") {
      pendingRestReal += durReal
    } else {
      const [s, f] = guitarPosition(midi)
      bar.n.push([s, f, durReal, pendingRestReal])
      pendingRestReal = 0
    }
  })
  // A rest still pending after the last note (nothing left to carry it into)
  // becomes the final bar's own tailRest.
  if (pendingRestReal > 0 && bars.length) bars[bars.length - 1].tailRest += pendingRestReal

  // Pass 2: tailRest for every other bar — whatever wait its neighbor's
  // first note carries is the rest that crossed the boundary out of this
  // bar (mirrors LineLab's own carriedRest reading of tailRest on playback).
  for (let i = 0; i < bars.length - 1; i++) {
    const carried = bars[i + 1].n[0]?.[3]
    if (carried) bars[i].tailRest = carried
  }

  return bars.map((b) => ({
    c: b.chords.join(" "),
    n: b.n,
    beats: Math.max(4, b.measureBeats || 4),
    tailRest: b.tailRest,
  }))
}

// ─── Summary: the block sequence, in plain language ────────────────────────
function summarize(blockLog) {
  return blockLog.map((b) => BLOCK_LABELS[b.type] || b.type).join(" → ")
}

// result: phraseEngine.js's runGenerator() return value,
// { notes, blockLog, targetEighths, prog }.
export function phraseResultToLine(result) {
  const { notes, blockLog, prog } = result
  const midis = assignMidi(notes)
  const timeline = buildChordTimeline(prog)
  const bars = buildBars(notes, midis, timeline)
  const summary = summarize(blockLog)

  return {
    bars: bars.map((bar) => ({ ...bar, d: "Phrase Machine", x: summary })),
    s: summary,
  }
}
