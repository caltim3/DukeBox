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
    ;(bar.n || []).forEach(([s, f, b, wait = 0], noteIdx) => {
      pos += Number(wait) || 0
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

// ─── Shared tab rendering ─────────────────────────────────────────────────────
// Extracted from LineLab so every Line Lab surface (Chart lab, Triad Network lab)
// renders identical ASCII tab. line bars are { c, d, x, n:[[string,fret,beats]] }.

const TAB_TRIPLETS = [
  { beats: 4 / 3, label: "h3" },
  { beats: 2 / 3, label: "q3" },
  { beats: 1 / 3, label: "e3" },
  { beats: 1 / 6, label: "s3" },
]

export function durLabel(b) {
  const trip = TAB_TRIPLETS.find(t => Math.abs(b - t.beats) < 0.02)
  if (trip) return trip.label
  if (b >= 4) return "w"
  if (b >= 3) return "h."
  if (b >= 2) return "h"
  if (b >= 1.5) return "q."
  if (b >= 1) return "q"
  if (b >= 0.75) return "e."
  if (b >= 0.5) return "e"
  return "s"
}

export function countLabel(posInBar) {
  const beat = Math.floor(posInBar + 1e-6)
  const frac = posInBar - beat
  const near = (x) => Math.abs(frac - x) < 0.02
  if (near(0))     return String(beat + 1)
  if (near(1 / 3)) return "trp"
  if (near(2 / 3)) return "let"
  if (near(0.5))   return "&"
  if (near(0.25))  return "e"
  if (near(0.75))  return "a"
  return "·"
}

export function buildTab(resultBars) {
  const stringLines = [[], [], [], [], [], []]
  const chordRow = []
  const countRow = []
  const durRow = []

  resultBars.forEach((bar) => {
    const notes = bar.n || []
    const syms = String(bar.c || "").trim().split(/\s+/).filter(Boolean)
    const barBeats = notes.reduce((n, ev) => n + (Number(ev[2]) || 0) + (Number(ev[3]) || 0), 0) || 4

    let pos = 0
    const cells = notes.map(([s, f, b, wait = 0]) => {
      pos += Number(wait) || 0
      const fret = String(f)
      const count = countLabel(pos)
      const ci = syms.length > 1
        ? Math.min(syms.length - 1, Math.floor((pos / barBeats) * syms.length))
        : 0
      pos += b
      return { s, fret, count, ci, dur: durLabel(b), w: Math.max(fret.length + 2, count.length + 1, 3) }
    })

    if (!cells.length) {
      const width = Math.max(String(bar.c || "").length + 1, 4)
      for (let i = 0; i < 6; i++) stringLines[i].push("-".repeat(width))
      chordRow.push(String(bar.c || "").padEnd(width, " "))
      countRow.push(" ".repeat(width))
      durRow.push(" ".repeat(width))
    } else {
      const groups = []
      for (const c of cells) {
        const last = groups[groups.length - 1]
        if (last && last.ci === c.ci) last.cells.push(c)
        else groups.push({ ci: c.ci, cells: [c] })
      }
      for (const g of groups) {
        const name = syms[g.ci] ?? ""
        const width = g.cells.reduce((n, c) => n + c.w, 0)
        if (name.length + 1 > width) g.cells[g.cells.length - 1].w += name.length + 1 - width
        chordRow.push(name.padEnd(g.cells.reduce((n, c) => n + c.w, 0), " "))
      }

      for (const c of cells) {
        for (let i = 0; i < 6; i++) {
          stringLines[i].push(i === c.s - 1 ? c.fret.padEnd(c.w, "-") : "-".repeat(c.w))
        }
        countRow.push(c.count.padEnd(c.w, " "))
        durRow.push(c.dur.padEnd(c.w, " "))
      }
    }

    for (let i = 0; i < 6; i++) stringLines[i].push("|")
    chordRow.push(" ")
    countRow.push(" ")
    durRow.push(" ")
  })

  const labels = ["e|", "B|", "G|", "D|", "A|", "E|"]
  return [
    "  " + chordRow.join("").trimEnd(),
    "  " + countRow.join("").trimEnd(),
    "  " + durRow.join("").trimEnd(),
    ...stringLines.map((c, i) => labels[i] + c.join("")),
  ].join("\n")
}
