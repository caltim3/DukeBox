// Chart normalization — turns Line Lab's selected measures (one string per
// measure, possibly "Bm7b5 E7" for a split bar) into a flat, beat-addressed
// harmonic timeline the generator can query without re-parsing chords.
//
// Everything downstream works in pitch classes (0-11) and absolute beats
// from the start of the selection. Chord parsing rides the same helpers the
// rest of DukeBox uses — parseGigChord for root/quality, tonal.js for chord
// tones and recommended scales — so the improviser hears the chart exactly
// the way playback and the lead sheet do.

import { Note } from "@tonaljs/tonal"
import { parseGigChord } from "@/lib/music/gigbook"
import { chordNotes, getRecommendedScalesFromQuality, scaleNotes } from "@/lib/music/tonal"

const DOMINANT_QUALITIES = new Set(["7", "9", "7b9", "7alt", "7sus4", "13"])

export function toPcs(names) {
  const pcs = []
  for (const name of names || []) {
    const pc = Note.chroma(name)
    if (pc != null && !pcs.includes(pc)) pcs.push(pc)
  }
  return pcs
}

// The 3rd and 7th (falling back through 6th and 5th for triads/6-chords) are
// the notes that orient a listener to the harmony — the generator lands them
// at chord changes.
export function guidePcsFor(rootPc, chordPcs) {
  const has = (offset) => {
    const pc = (rootPc + offset) % 12
    return chordPcs.includes(pc) ? pc : null
  }
  const third = has(4) ?? has(3)
  const seventh = has(10) ?? has(11) ?? has(9) // b7, maj7, then 6th
  return {
    thirdPc: third ?? has(7) ?? rootPc,
    seventhPc: seventh ?? has(7) ?? rootPc,
  }
}

// One chord segment: everything the generator needs to know about the
// harmony over [startBeat, startBeat + beats).
function buildSegment(parsed, startBeat, beats) {
  const rootPc = Note.chroma(parsed.root) ?? 0
  const chordPcs = toPcs(chordNotes(parsed.symbol))
  if (!chordPcs.length) chordPcs.push(rootPc, (rootPc + 4) % 12, (rootPc + 7) % 12)
  const { thirdPc, seventhPc } = guidePcsFor(rootPc, chordPcs)

  const scaleName = (getRecommendedScalesFromQuality(parsed.quality) || ["mixolydian"])[0]
  let scalePcs = toPcs(scaleNotes(scaleName, parsed.root))
  if (scalePcs.length < 5) scalePcs = toPcs(scaleNotes("mixolydian", parsed.root))
  if (scalePcs.length < 5) scalePcs = chordPcs.slice()

  const isDominant = DOMINANT_QUALITIES.has(parsed.quality)
  const alteredPcs = isDominant ? toPcs(scaleNotes("altered", parsed.root)) : null

  return {
    symbol: parsed.symbol,
    quality: parsed.quality,
    // The root's NAME as well as its pitch class: the device lenses call back
    // into tonal.js (martinoMapper, barryHarrisScale, scaleNotes), all of
    // which speak note names, and re-deriving a name from a pitch class would
    // throw away the chart's own spelling.
    root: parsed.root,
    rootPc,
    startBeat,
    beats,
    chordPcs,
    thirdPc,
    seventhPc,
    scalePcs,
    // What non-anchor CHORD-tone material draws from — leaps, and every
    // non-anchor note at level 1. It's the real chord until a device lens
    // (Martino conversion, Triads) says otherwise.
    pitchPcs: chordPcs,
    alteredPcs: alteredPcs && alteredPcs.length >= 5 ? alteredPcs : null,
    isDominant,
  }
}

// measures: array of measure strings ("Dm7", "Bm7b5 E7", "N.C.", …).
// Returns { measures, segments, totalBeats }. A measure whose chords don't
// parse (N.C., garbage) contributes its beats as harmonic silence — no
// segment — and the generator rests through it rather than inventing a chord.
export function normalizeMeasures(measureStrings) {
  const measures = []
  const segments = []
  let cursor = 0

  for (const text of measureStrings || []) {
    const tokens = String(text || "").trim().split(/\s+/).filter(Boolean)
    const parsed = tokens.map((t) => parseGigChord(t)).filter(Boolean)
    const measureBeats = 4
    const label = parsed.length ? parsed.map((p) => p.symbol).join(" ") : String(text || "").trim()

    const measure = { startBeat: cursor, beats: measureBeats, label, chordCount: parsed.length }
    if (parsed.length) {
      const share = measureBeats / parsed.length
      parsed.forEach((p, i) => {
        segments.push(buildSegment(p, cursor + i * share, share))
      })
    }
    measures.push(measure)
    cursor += measureBeats
  }

  return { measures, segments, totalBeats: cursor }
}

// The chord sounding at an absolute beat, or null in harmonic silence.
export function segmentAtBeat(timeline, beat) {
  for (const seg of timeline.segments) {
    if (beat >= seg.startBeat && beat < seg.startBeat + seg.beats) return seg
  }
  return null
}

// The first chord change strictly after `beat`, or null.
export function nextSegmentAfter(timeline, beat) {
  for (const seg of timeline.segments) {
    if (seg.startBeat > beat + 1e-6) return seg
  }
  return null
}

// ─── Form view ────────────────────────────────────────────────────────────
// The generator's window onto the harmony. Finite mode reads the timeline
// once through; continuous mode wraps it, so absolute beat 67 of a 32-beat
// form reads as form beat 3 of chorus 3, and the seam (last chord → first
// chord) registers as a real chord change to target — the solo keeps
// developing across choruses instead of resetting.
export function createFormView(timeline, { wrap = false } = {}) {
  const total = timeline.totalBeats

  const segAt = (beat) => {
    if (!total) return null
    const local = wrap ? ((beat % total) + total) % total : beat
    return segmentAtBeat(timeline, local)
  }

  // Chord-change boundaries in (from, to], as absolute beats. With wrap, the
  // top of every chorus (k · total) counts as a change into the first chord.
  const changesIn = (from, to) => {
    const out = []
    if (!total) return out
    if (!wrap) {
      for (const seg of timeline.segments) {
        if (seg.startBeat > from + 1e-6 && seg.startBeat <= to + 1e-6) out.push({ beat: seg.startBeat, seg })
      }
      return out
    }
    for (let k = Math.floor(from / total); k * total <= to + 1e-6; k++) {
      for (const seg of timeline.segments) {
        const beat = seg.startBeat + k * total
        if (beat > from + 1e-6 && beat <= to + 1e-6) out.push({ beat, seg })
      }
    }
    return out
  }

  return { totalBeats: total, wrap, segAt, changesIn }
}
