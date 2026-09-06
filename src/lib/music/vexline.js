// One canonical reading of a DukeBox line's rhythm.
//
// A line is { bars: [{ c, n: [[string, fret, beats, wait]], tailRest }] }. Three
// places used to re-derive note values, rests, triplets and beam groups from
// that on their own — the on-screen ABC in LineNotation, the MusicXML export in
// leadsheet.js, and the transport scheduler in lines.js. The first two now read
// this module instead, so what a guitarist sees on screen and what lands in
// MuseScore can't drift apart.
//
// Nothing here touches the DOM or VexFlow: it is a pure description of the
// rhythm, unit-testable on its own.

import { lineNoteMidi } from "@/lib/music/lines"

const EPS = 1e-6
// The generators emit 1/3 as a repeating decimal, so triplet recognition has to
// be looser than plain float tolerance. Ported unchanged from the ABC path.
const TRIPLET_EPS = 0.01

// beats -> note value, longest first. `code` is VexFlow's duration string;
// `type`/`dots`/`triplet` are MusicXML's spelling of the same value.
export const LINE_DURATIONS = [
  { beats: 4,     code: "w",  type: "whole",   dots: 0, triplet: false },
  { beats: 3,     code: "h",  type: "half",    dots: 1, triplet: false },
  { beats: 8 / 3, code: "w",  type: "whole",   dots: 0, triplet: true  },
  { beats: 2,     code: "h",  type: "half",    dots: 0, triplet: false },
  { beats: 1.5,   code: "q",  type: "quarter", dots: 1, triplet: false },
  { beats: 4 / 3, code: "h",  type: "half",    dots: 0, triplet: true  },
  { beats: 1,     code: "q",  type: "quarter", dots: 0, triplet: false },
  { beats: 0.75,  code: "8",  type: "eighth",  dots: 1, triplet: false },
  { beats: 2 / 3, code: "q",  type: "quarter", dots: 0, triplet: true  },
  { beats: 0.5,   code: "8",  type: "eighth",  dots: 0, triplet: false },
  { beats: 1 / 3, code: "8",  type: "eighth",  dots: 0, triplet: true  },
  { beats: 0.25,  code: "16", type: "16th",    dots: 0, triplet: false },
  { beats: 1 / 6, code: "16", type: "16th",    dots: 0, triplet: true  },
  { beats: 0.125, code: "32", type: "32nd",    dots: 0, triplet: false },
]

// Nearest representable note value. A duration the generators never emit still
// engraves as something rather than throwing.
export function lineDurationOf(beats) {
  let best = LINE_DURATIONS[LINE_DURATIONS.length - 1]
  let bestErr = Infinity
  for (const d of LINE_DURATIONS) {
    const err = Math.abs(d.beats - beats)
    if (err < bestErr) { best = d; bestErr = err }
  }
  return best
}

// Rests are written out, not tied: a 2.5-beat gap is a half rest plus an eighth
// rest, largest first. Values that only exist inside a triplet (1/3, 2/3) have
// no standalone rest spelling here, so they round to the nearest plain rest —
// the bar reads correctly even though the ink is a hair long.
const REST_LADDER = LINE_DURATIONS.filter((d) => !d.triplet)

export function splitRestBeats(beats) {
  const out = []
  let left = Number(beats) || 0
  // Eight pieces is far more than any real gap needs; the guard only exists so
  // a NaN or a pathological value can't spin here.
  for (let guard = 0; guard < 8 && left > 0.125 - EPS; guard += 1) {
    if (Math.abs(left - 1 / 3) < TRIPLET_EPS) { out.push(lineDurationOf(0.5)); return out }
    if (Math.abs(left - 2 / 3) < TRIPLET_EPS) { out.push(lineDurationOf(1)); return out }
    const piece = REST_LADDER.find((d) => d.beats <= left + EPS)
    if (!piece) break
    out.push(piece)
    left -= piece.beats
  }
  return out
}

const PC_FLAT = ["c", "db", "d", "eb", "e", "f", "gb", "g", "ab", "a", "bb", "b"]

// VexFlow key string, e.g. 67 -> "g/4". Flats throughout, matching the ABC
// path's PC table, because these lines are read as jazz vocabulary.
export function midiToVexKey(midi) {
  const pc = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  return `${PC_FLAT[pc]}/${octave}`
}

export function vexAccidentalOf(midi) {
  const pc = ((midi % 12) + 12) % 12
  return PC_FLAT[pc].length > 1 ? "b" : null
}

// Runs of exactly three consecutive 1/3-beat notes with nothing between them
// are a triplet cell. A lone 1/3 that isn't part of a complete run gets no
// bracket — it engraves as a plain eighth rather than a malformed tuplet.
function tupletIdsForNotes(notes) {
  const ids = new Array(notes.length).fill(-1)
  let nextId = 0
  for (let i = 0; i < notes.length; i += 1) {
    if (ids[i] >= 0) continue
    const run = notes.slice(i, i + 3)
    const isRun = run.length === 3 && run.every((n) =>
      Math.abs(Number(n[2]) - 1 / 3) < TRIPLET_EPS && Number(n[3] || 0) === 0)
    if (!isRun) continue
    ids[i] = ids[i + 1] = ids[i + 2] = nextId
    nextId += 1
    i += 2
  }
  return ids
}

// One bar -> the ordered events an engraver draws: rests for `wait` gaps and
// for `tailRest`, notes for everything else. `pos` is the event's start in
// beats from the top of the bar, which is what the half-bar beam seam and the
// chord-symbol anchor are measured against.
export function barToEvents(bar) {
  const notes = (bar?.n || [])
  const tupletIds = tupletIdsForNotes(notes)
  const events = []
  let pos = 0

  const pushRests = (beats) => {
    splitRestBeats(beats).forEach((d) => {
      events.push({ kind: "rest", beats: d.beats, code: d.code, type: d.type, dots: d.dots, triplet: false, pos })
      pos += d.beats
    })
  }

  notes.forEach((note, noteIndex) => {
    const [s, f, dur = 0.5, wait = 0] = note
    const waitBeats = Number(wait) || 0
    if (waitBeats > 0) pushRests(waitBeats)

    const beats = Number(dur) || 0
    const tupletId = tupletIds[noteIndex]
    // Inside a triplet the note is written as its plain value — three eighths
    // under a "3" bracket, not three 1/3-beat oddities.
    const d = tupletId >= 0 ? lineDurationOf(0.5) : lineDurationOf(beats)
    const midi = lineNoteMidi(Number(s), Number(f))
    events.push({
      kind: "note",
      beats,
      code: d.code,
      type: d.type,
      dots: d.dots,
      triplet: tupletId >= 0,
      tupletId,
      pos,
      noteIndex,
      string: Number(s),
      fret: Number(f) || 0,
      // Sounding pitch drives playback and the fretboard; guitar notation is
      // written an octave higher than it sounds.
      midi,
      midiWritten: midi + 12,
      key: midiToVexKey(midi + 12),
      accidental: vexAccidentalOf(midi + 12),
    })
    pos += beats
  })

  const tail = Number(bar?.tailRest) || 0
  if (tail > 0) pushRests(tail)

  // A bar that stops short still has to be a bar. Improviser and phrase lines
  // set tailRest themselves; generated ones sometimes just end, and the
  // remainder is silence either way.
  const beats = barBeats(bar)
  if (beats - pos > 0.125 - EPS) pushRests(beats - pos)

  return events
}

// 4/4 unless the line says otherwise — chart-driven lines carry half measures.
export function barBeats(bar) {
  const beats = Number(bar?.beats)
  return beats > 0 ? beats : 4
}

// Consecutive beamable events that start in the same half of the bar beam
// together. Beams break at a rest, at anything longer than an eighth, and at
// the half-bar seam — the same reading a guitarist would write by hand.
//
// Grouping is by where a note starts, not where it ends: a syncopated eighth
// that begins before beat 3 and rings past it still belongs to the beam it
// started in. (The old ABC path split those; the MusicXML export never did.)
//
// `eligible` decides what counts as beamable. The screen beams everything an
// eighth or shorter; MusicXML restricts itself to plain eighths, because a
// single <beam> element can't spell the second beam of a sixteenth.
export function beamGroups(events, eligible) {
  const groups = []
  let run = []
  const halfOf = (ev) => Math.floor(ev.pos / 2 + EPS)
  const close = () => {
    if (run.length >= 2) groups.push(run)
    run = []
  }
  events.forEach((ev, index) => {
    if (ev.kind !== "note" || !eligible(ev)) { close(); return }
    if (run.length && halfOf(ev) !== halfOf(events[run[run.length - 1]])) close()
    run.push(index)
  })
  close()
  return groups
}

export const BEAMABLE_ON_SCREEN = (ev) => ev.beats <= 0.5 + EPS
export const BEAMABLE_IN_MUSICXML = (ev) => Math.abs(ev.beats - 0.5) < EPS

// MusicXML wants a begin/continue/end role per note index within bar.n, not
// groups of event indices.
export function beamRolesForBar(barNotes) {
  const events = barToEvents({ n: barNotes })
  const roles = new Array((barNotes || []).length).fill(null)
  beamGroups(events, BEAMABLE_IN_MUSICXML).forEach((group) => {
    group.forEach((eventIndex, i) => {
      const { noteIndex } = events[eventIndex]
      roles[noteIndex] = i === 0 ? "begin" : i === group.length - 1 ? "end" : "continue"
    })
  })
  return roles
}

// The whole line, ready to engrave: per bar its chord symbol, its events, the
// beam groups and the triplet groups (both as event indices). `soundingIndex`
// counts notes only, across the whole line — that is what playback's
// activeIndex refers to, so rests must never consume a slot.
export function lineToVexBars(line) {
  let sounding = 0
  const bars = (line?.bars || []).map((bar) => {
    const events = barToEvents(bar)
    events.forEach((ev) => {
      if (ev.kind === "note") { ev.soundingIndex = sounding; sounding += 1 }
      else ev.soundingIndex = -1
    })
    const tuplets = []
    events.forEach((ev, index) => {
      if (ev.kind !== "note" || ev.tupletId < 0) return
      ;(tuplets[ev.tupletId] ||= []).push(index)
    })
    return {
      chord: String(bar?.c || "").trim(),
      beats: barBeats(bar),
      events,
      beams: beamGroups(events, BEAMABLE_ON_SCREEN),
      tuplets: tuplets.filter((t) => t && t.length === 3),
    }
  })
  return { bars, soundingCount: sounding }
}
