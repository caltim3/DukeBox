// Line Lab — transport scheduling helpers.
// A generated line uses the compact schema already returned by
// /api/generate-line: { bars: [{ c, d, x, n: [[string, fret, beats], ...] }], s }
// string is 1 (high e) through 6 (low E), standard tuning.

const OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 }
const NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

export function lineNoteMidi(string, fret) {
  return (OPEN_MIDI[string] ?? 64) + fret
}

export function midiToToneNote(midi) {
  return NAMES_SHARP[midi % 12] + (Math.floor(midi / 12) - 1)
}

export function lineNoteName(string, fret) {
  return NAMES_SHARP[lineNoteMidi(string, fret) % 12]
}

// beats → BarsBeatsSixteenths duration, e.g. 0.5 → "0:0:2", 1.5 → "0:1:2".
// Sixteenths are kept fractional (Tone parses each BBS field with parseFloat)
// so triplets — 1/3 of a beat → "0:0:1.3333" — land where they belong instead
// of being rounded onto the sixteenth grid.
function trimNum(n) {
  const r = Math.round(n * 10000) / 10000
  return Number.isInteger(r) ? String(r) : r.toFixed(4).replace(/0+$/, "")
}

export function beatsToBBS(beats) {
  const whole = Math.floor(beats)
  const sixteenths = (beats - whole) * 4
  return `0:${whole}:${trimNum(sixteenths)}`
}

// Convert a line into Tone.Transport events aligned to a section's bar timing,
// so playback inherits the transport's live bpm and swing instead of wall-clock
// timing. sectionBars supplies each bar's beat count (4 full, 2 half), mirroring
// computeBarTiming in audio.js.
// Returns [{ time: "M:B:S", note: "E4", dur: "0:B:S", vel, barIdx, noteIdx }]
export function lineToTransportEvents(lineBars, sectionBars = []) {
  const events = []
  let totalBeats = 0
  lineBars.forEach((bar, barIdx) => {
    const barBeats = sectionBars[barIdx]?.beats ?? 4
    const barStart = totalBeats
    let pos = 0
    ;(bar.n || []).forEach(([s, f, b], noteIdx) => {
      if (pos >= barBeats) return
      const abs = barStart + pos
      const measure = Math.floor(abs / 4)
      const beatInM = Math.floor(abs % 4)
      const sub = (abs - Math.floor(abs)) * 4   // fractional — triplets stay in place
      events.push({
        time: `${measure}:${beatInM}:${trimNum(sub)}`,
        note: midiToToneNote(lineNoteMidi(s, f)),
        dur: beatsToBBS(Math.min(b, barBeats - pos)),
        vel: 0.72,
        barIdx,
        noteIdx,
      })
      pos += b
    })
    totalBeats += barBeats
  })
  return events
}
