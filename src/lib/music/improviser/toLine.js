// Adapter: improviser events (absolute beats + MIDI + velocity) → the
// LineLab line schema { bars: [{ c, d, x, n, beats, tailRest }], s }, so a
// generated line flows through the existing notation, TAB, fretboard
// walkthrough, band playback, transpose, refinger, MusicXML export, and
// Licktionary save — none of which need to know it came from the improviser.
//
// Tuple convention: [string, fret, durationBeats, waitBeats, velocity].
// The 5th slot is new and optional — every existing reader destructures the
// first four and tolerates extras; lineToTransportEvents reads it when
// present. Same wait/tailRest bookkeeping as phraseAdapter.js: a first
// note's wait positions it from the bar start (what the transport needs),
// and tailRest mirrors the rest that crossed out of the bar.

import { guitarPosition } from "@/lib/music/licktionary"

export function eventsToLine({ events, timeline, summary, style, seed }) {
  const sorted = [...events].sort((a, b) => a.t - b.t)

  // Monophonic guarantee: an event never rings past the next onset.
  for (let i = 0; i < sorted.length - 1; i++) {
    sorted[i].d = Math.min(sorted[i].d, sorted[i + 1].t - sorted[i].t)
  }

  const chip = `${style.label} · seed ${seed}`
  const bars = timeline.measures.map((m) => ({
    c: m.label,
    d: "Improviser",
    x: chip,
    n: [],
    beats: m.beats,
    tailRest: 0,
    _start: m.startBeat,
    _end: m.startBeat + m.beats,
  }))

  for (const e of sorted) {
    const bar = bars.find((b) => e.t >= b._start - 1e-6 && e.t < b._end - 1e-6)
    if (!bar || e.d <= 1e-3) continue
    // Clip at the bar line (no tie support in the schema) — landings that
    // ring across a barline just ring to it.
    const dur = Math.min(e.d, bar._end - e.t)
    const prevEnd = bar.n.length
      ? bar._start + bar.n.reduce((sum, n) => sum + n[2] + n[3], 0)
      : bar._start
    const wait = Math.max(0, round4(e.t - prevEnd))
    const [s, f] = guitarPosition(e.midi)
    bar.n.push([s, f, round4(dur), wait, e.vel ?? 0.72])
  }

  // tailRest: the silence between a bar's last sounding moment and the next
  // note — mirrored from the following bar's first-note wait, exactly as
  // phraseAdapter.js does it.
  for (let i = 0; i < bars.length; i++) {
    const next = bars[i + 1]
    if (next?.n?.length && next.n[0][3] > 0) {
      bars[i].tailRest = next.n[0][3]
    } else if (bars[i].n.length) {
      const used = bars[i].n.reduce((sum, n) => sum + n[2] + n[3], 0)
      bars[i].tailRest = Math.max(0, round4(bars[i].beats - used))
    }
  }

  return {
    bars: bars.map(({ _start, _end, ...bar }) => bar),
    s: summary,
  }
}

function round4(n) {
  return Math.round(n * 10000) / 10000
}
