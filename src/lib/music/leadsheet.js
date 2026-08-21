// Lead sheet exports — Real Book handwritten style
// PDF: pure canvas 2D (no VexFlow — its stave Y has a hidden +40px offset that
//      made note placement impossible). Manual stave = exact coordinates.
// MusicXML: standard interchange for MuseScore / Sibelius / Finale.
// Both exports understand 1-chord (4-beat) and 2-chord (2-beat each) measures.

import { Note } from "@tonaljs/tonal"
import { getChord } from "./tonal"

// ─── Measure grouping ─────────────────────────────────────────────────────────
// s("Bm7b5 E7") produces [{beats:2},{beats:2}].  Group consecutive sub-4-beat
// bars until they sum to 4 beats so each group = one visual measure.
export function groupIntoMeasures(bars) {
  const measures = []
  let i = 0
  while (i < bars.length) {
    const b = bars[i].beats ?? 4
    if (b >= 4) { measures.push([bars[i]]); i++; continue }
    const group = []
    let total = 0
    while (i < bars.length && total < 4) {
      const nb = bars[i].beats ?? 4
      if (nb >= 4) break          // don't absorb a full-beat bar
      group.push(bars[i]); total += nb; i++
    }
    measures.push(group)
  }
  return measures
}

// ─── Chord helpers ────────────────────────────────────────────────────────────
function rbChord(symbol) {
  if (!symbol) return ""
  return symbol
    .replace(/maj7/g, "Δ").replace(/maj6/g, "Δ6").replace(/maj/g, "Δ")
    .replace(/min7b5|m7b5/g, "ø7").replace(/dim7/g, "°7").replace(/dim/g, "°")
    .replace(/min7|m7/g, "-7").replace(/min|m(?=[^a]|$)/g, "-")
    .replace(/7alt/g, "7alt").replace(/7sus4|sus4/g, "sus")
}

function getAcc(noteName) {
  const m = (noteName || "").match(/^[A-G](bb|##|b|#)?/)
  return (m && m[1]) || ""
}

// ─── Octave assignment (E4–F5, entirely on staff) ────────────────────────────
function assignOctave(noteName, prevMidi) {
  if (!noteName) return null
  const MIN = 64, MAX = 77
  const tryRange = (target) => {
    let best = null, bestDist = Infinity
    for (const oct of [3, 4, 5, 6]) {
      const midi = Note.midi(noteName + oct)
      if (midi == null || midi < MIN || midi > MAX) continue
      const d = Math.abs(midi - target)
      if (d < bestDist) { bestDist = d; best = noteName + oct }
    }
    return best
  }
  if (prevMidi == null) {
    // prefer G4–D5 centre
    for (const oct of [4, 5]) {
      const midi = Note.midi(noteName + oct)
      if (midi != null && midi >= 67 && midi <= 74) return noteName + oct
    }
    return tryRange(71) || noteName + "5"
  }
  return tryRange(prevMidi) || tryRange(71) || noteName + "5"
}

// Get 3rd and 7th of a chord symbol as guide tones
function guideTones(symbol) {
  if (!symbol) return [null, null]
  const ch = getChord(symbol)
  if (!ch.notes || ch.notes.length < 2) return [null, null]
  const third   = ch.notes[1] ?? null
  const seventh = ch.notes[ch.notes.length - 1] ?? null
  return [third, seventh]
}

// ─── Chord voicing helpers (for MusicXML) ────────────────────────────────────
function chordTones(symbol) {
  if (!symbol) return null
  const ch = getChord(symbol)
  if (!ch.notes || ch.notes.length < 2) return null
  const notes = ch.notes.slice(0, 4)
  if (notes.length === 3) notes.push(notes[0])
  return notes.length >= 4 ? notes : null
}

function closeVoicing(notes, baseMidi) {
  const midis = []
  let floor = baseMidi
  for (const note of notes) {
    for (let oct = 2; oct <= 7; oct++) {
      const m = Note.midi(note + oct)
      if (m != null && m >= floor) { midis.push(m); floor = m + 1; break }
    }
  }
  return midis
}

function allInversions(notes, baseMidi) {
  return notes.map((_, i) => {
    const rot = [...notes.slice(i), ...notes.slice(0, i)]
    return closeVoicing(rot, baseMidi)
  })
}

function bestInversionFor(notes, targetMidis, baseMidi) {
  const invs = allInversions(notes, baseMidi - 6)
  let best = invs[0], bestDist = Infinity
  for (const inv of invs) {
    const len  = Math.min(inv.length, targetMidis.length)
    const dist = inv.slice(0, len).reduce((s, m, i) => s + Math.abs(m - targetMidis[i]), 0)
    if (dist < bestDist) { bestDist = dist; best = inv }
  }
  return best
}

// ─── XML helpers ─────────────────────────────────────────────────────────────
function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function parseChordForMXL(symbol) {
  if (!symbol) return null
  const m = symbol.match(/^([A-G](b{1,2}|#{1,2})?)/)
  if (!m) return null
  const rootNote = Note.get(m[1])
  if (!rootNote.letter) return null
  const q = symbol.slice(m[1].length)
  let kind, kindText
  if (/m7b5|min7b5/.test(q))             { kind = "half-diminished";    kindText = "ø7"  }
  else if (/dim7|°7/.test(q))            { kind = "diminished-seventh"; kindText = "°7"  }
  else if (/dim|°/.test(q))              { kind = "diminished";          kindText = "°"   }
  else if (/maj7|M7/.test(q))            { kind = "major-seventh";       kindText = "Δ7"  }
  else if (/maj|Maj/.test(q))            { kind = "major";               kindText = "Δ"   }
  else if (/m7|min7|-7/.test(q))         { kind = "minor-seventh";       kindText = "-7"  }
  else if (/m(?!a)|min|-(?!7)/.test(q))  { kind = "minor";               kindText = "-"   }
  else if (/7sus4?|sus/.test(q))         { kind = "suspended-fourth";    kindText = "sus" }
  else if (/7/.test(q))                  { kind = "dominant";            kindText = "7"   }
  else                                   { kind = "major";               kindText = ""    }
  return { step: rootNote.letter, alter: rootNote.alt ?? 0, kind, kindText }
}

function noteToMXL(noteOct) {
  const m = String(noteOct || "").match(/^([A-G])(b{1,2}|#{1,2})?(\d)$/)
  if (!m) return null
  const alter = m[2] === "bb" ? -2 : m[2] === "b" ? -1 : m[2] === "#" ? 1 : m[2] === "##" ? 2 : 0
  const acc   = m[2] === "bb" ? "double-flat" : m[2] === "b" ? "flat"
              : m[2] === "#"  ? "sharp"       : m[2] === "##" ? "double-sharp" : null
  return { step: m[1], alter, octave: parseInt(m[3]), accidental: acc }
}

function midiToMXLPitch(midi) { return noteToMXL(Note.fromMidi(midi)) }

// ─── Layout constants ─────────────────────────────────────────────────────────
const PAGE_W  = 816
const PAGE_H  = 1056
const ML      = 52
const MR      = 52
const MT1     = 116   // top margin page 1
const MTX     = 36    // top margin page 2+
const MB      = 40
const BPR     = 4     // measures per row

// No VexFlow offset! staveTop IS where the top staff line is drawn.
const ROW_H      = 108
const STAVE_Y_OFF = 40   // top staff line at rowY + 40
const CHORD_TY    = 24   // chord text baseline at rowY + 24 (16px above stave top)

const ROWS_P1 = Math.floor((PAGE_H - MT1 - MB) / ROW_H)
const ROWS_PX = Math.floor((PAGE_H - MTX - MB) / ROW_H)

// ─── Manual stave drawing (replaces VexFlow stave) ───────────────────────────
// staveTop = exact Y of the top staff line
function drawStave(c, x, staveTop, width, { showClef, showTimeSig, isLast, HW }) {
  c.save()
  c.strokeStyle = "#000"
  c.lineWidth   = 1.1

  // 5 staff lines
  for (let i = 0; i <= 4; i++) {
    c.beginPath()
    c.moveTo(x, staveTop + i * 10)
    c.lineTo(x + width, staveTop + i * 10)
    c.stroke()
  }

  // Opening bar line
  c.beginPath(); c.moveTo(x, staveTop); c.lineTo(x, staveTop + 40); c.stroke()

  // Closing bar line (double bar at final measure)
  if (isLast) {
    c.lineWidth = 1.1
    c.beginPath(); c.moveTo(x+width-4, staveTop); c.lineTo(x+width-4, staveTop+40); c.stroke()
    c.lineWidth = 3.5
    c.beginPath(); c.moveTo(x+width, staveTop); c.lineTo(x+width, staveTop+40); c.stroke()
  } else {
    c.beginPath(); c.moveTo(x+width, staveTop); c.lineTo(x+width, staveTop+40); c.stroke()
  }

  // Treble clef — 𝄞 (U+1D11E), baseline ~12px below bottom staff line
  if (showClef) {
    c.fillStyle    = "#000"
    c.font         = '56px "Times New Roman", "Georgia", serif'
    c.textAlign    = "left"
    c.textBaseline = "alphabetic"
    c.fillText("\u{1D11E}", x + 3, staveTop + 52)
  }

  // Time signature 4/4 (first bar of entire chart)
  if (showTimeSig) {
    c.font         = `bold 20px ${HW}`
    c.textAlign    = "center"
    c.textBaseline = "alphabetic"
    c.fillStyle    = "#000"
    const tsX = x + (showClef ? 36 : 10)
    c.fillText("4", tsX, staveTop + 14)
    c.fillText("4", tsX, staveTop + 32)
  }

  c.restore()
}

// Thin half-bar divider inside a measure (for 2-chord bars)
function drawHalfBarLine(c, x, staveTop) {
  c.save()
  c.strokeStyle = "#000"
  c.lineWidth   = 0.8
  c.setLineDash([2, 2])
  c.beginPath(); c.moveTo(x, staveTop); c.lineTo(x, staveTop + 40); c.stroke()
  c.setLineDash([])
  c.restore()
}

// ─── Manual note rendering ────────────────────────────────────────────────────
const DIATONIC = { C:0, D:1, E:2, F:3, G:4, A:5, B:6 }

// Pixel Y for a note, given the exact top staff line Y.
function noteY(noteOct, staveTop) {
  const m = String(noteOct || "").match(/^([A-G])(b{1,2}|#{1,2})?(\d)$/)
  if (!m) return staveTop + 20
  const steps = (parseInt(m[3]) - 4) * 7 + DIATONIC[m[1]] - 2
  return staveTop + 40 - steps * 5
}

function drawHalfNote(c, cx, staveTop, noteOct) {
  const acc  = getAcc(String(noteOct).replace(/\d$/, ""))
  const y    = noteY(noteOct, staveTop)
  const up   = y >= staveTop + 20

  c.save()
  c.strokeStyle = "#000"; c.lineWidth = 1.6

  c.beginPath()
  c.ellipse(cx, y, 5.5, 4, -0.2, 0, Math.PI * 2)
  c.fillStyle = "#fff"; c.fill(); c.stroke()

  const sx = up ? cx + 5 : cx - 5
  const dir = up ? -1 : 1
  c.beginPath()
  c.moveTo(sx, y + dir * 3)
  c.lineTo(sx, y + dir * 34)
  c.stroke()

  if (acc) {
    const g = acc === "b" ? "♭" : acc === "#" ? "♯" : acc === "bb" ? "♭♭" : "♯♯"
    c.font = "bold 12px serif"; c.textAlign = "right"; c.fillStyle = "#000"
    c.fillText(g, cx - 8, y + 4)
  }
  c.restore()
}

function drawHalfRest(c, cx, staveTop) {
  c.fillStyle = "#000"
  c.fillRect(cx - 7, staveTop + 20, 14, 5)
}

// ─── Handwritten font loader ──────────────────────────────────────────────────
async function loadHandwrittenFont() {
  try {
    if (!document.querySelector("link[data-dukebox-caveat]")) {
      const link = document.createElement("link")
      link.setAttribute("data-dukebox-caveat", "1")
      link.rel = "stylesheet"
      link.href = "https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap"
      document.head.appendChild(link)
    }
    await document.fonts.load('bold 52px "Caveat"')
  } catch { /* fall back to cursive */ }
}

// ─── Render one PDF page ──────────────────────────────────────────────────────
function renderPage({ canvas, isFirstPage, songName, tempo, measures,
                      rowStart, rowCount, HW }) {
  const BAR_W = (PAGE_W - ML - MR) / BPR
  const c     = canvas.getContext("2d")
  c.fillStyle = "#fff"
  c.fillRect(0, 0, PAGE_W, PAGE_H)

  // Title block (page 1 only)
  if (isFirstPage) {
    c.font = `bold 60px ${HW}`; c.textAlign = "center"; c.fillStyle = "#000"
    c.textBaseline = "alphabetic"
    c.fillText(songName, PAGE_W / 2, 72)

    c.font = `18px ${HW}`; c.textAlign = "left"
    c.fillText(`♩ = ${tempo}`, 56, 100)

    c.font = `italic 13px ${HW}`; c.textAlign = "right"; c.fillStyle = "#444"
    c.fillText("DukeBox Guide Tones", PAGE_W - 56, 100)

    c.strokeStyle = "#000"; c.lineWidth = 1
    c.beginPath(); c.moveTo(52, 108); c.lineTo(PAGE_W - 52, 108); c.stroke()
  }

  const MT = isFirstPage ? MT1 : MTX
  let prevSection = null

  for (let ri = 0; ri < rowCount; ri++) {
    const rowY    = MT + ri * ROW_H
    const staveTop = rowY + STAVE_Y_OFF
    const chordY  = rowY + CHORD_TY

    for (let col = 0; col < BPR; col++) {
      const mIdx = (rowStart + ri) * BPR + col
      if (mIdx >= measures.length) break
      const measure     = measures[mIdx]
      const staveX      = ML + col * BAR_W
      const isVeryFirst = mIdx === 0
      const isFirstCol  = col === 0
      const isLast      = mIdx === measures.length - 1

      // ── Draw stave (manual — no VexFlow offset surprises) ────────────────
      drawStave(c, staveX, staveTop, BAR_W, {
        showClef:     isVeryFirst || isFirstCol,
        showTimeSig:  isVeryFirst,
        isLast,
        HW,
      })

      // Space consumed by clef + time sig on left of this bar
      const clefW = isVeryFirst ? 58 : isFirstCol ? 36 : 10

      // ── Section label ────────────────────────────────────────────────────
      const firstBar = measure[0]
      if (firstBar.section && firstBar.section !== prevSection) {
        prevSection = firstBar.section
        const raw   = firstBar.section.replace(/\s*\(.*\)/g, "").trim()
        const label = raw.length > 7 ? raw[0].toUpperCase() : raw
        const lx    = staveX + clefW - 4
        c.save()
        c.font = `bold 12px ${HW}`; c.textAlign = "center"
        c.fillStyle = "#000"; c.strokeStyle = "#000"; c.lineWidth = 1.5
        const tw = c.measureText(label).width
        c.strokeRect(lx - tw/2 - 4, chordY - 13, tw + 8, 16)
        c.fillText(label, lx, chordY)
        c.restore()
      }

      if (measure.length === 1) {
        // ── Single-chord measure (4 beats) ───────────────────────────────
        const bar = measure[0]
        c.save()
        c.font = `bold 20px ${HW}`; c.textAlign = "left"; c.fillStyle = "#000"
        c.textBaseline = "alphabetic"
        c.fillText(rbChord(bar.symbol), staveX + clefW, chordY)
        c.restore()

        // Guide tones: 3rd (left) and 7th (right)
        const [g3, g7] = bar._gt || [null, null]
        const noteArea  = BAR_W - clefW - 8
        const x1 = staveX + clefW + noteArea * 0.28
        const x2 = staveX + clefW + noteArea * 0.72
        if (g3) drawHalfNote(c, x1, staveTop, g3)
        else    drawHalfRest(c, x1, staveTop)
        if (g7) drawHalfNote(c, x2, staveTop, g7)
        else    drawHalfRest(c, x2, staveTop)

      } else {
        // ── Two-chord measure (2 beats each) ─────────────────────────────
        const half = BAR_W / 2
        drawHalfBarLine(c, staveX + half, staveTop)

        measure.forEach((bar, hi) => {
          const hx       = staveX + hi * half
          const chordOff = hi === 0 ? clefW : 8

          c.save()
          c.font = `bold 18px ${HW}`; c.textAlign = "left"; c.fillStyle = "#000"
          c.textBaseline = "alphabetic"
          c.fillText(rbChord(bar.symbol), hx + chordOff, chordY)
          c.restore()

          const [g3, g7] = bar._gt || [null, null]
          // One note per half-bar (the 3rd, most important guide tone)
          const nx = hx + (hi === 0 ? clefW : 8) + (half - (hi === 0 ? clefW : 8)) * 0.5
          if (g3) drawHalfNote(c, nx, staveTop, g3)
          else    drawHalfRest(c, nx, staveTop)
        })
      }
    }
  }
}

// ─── PDF export ───────────────────────────────────────────────────────────────
export async function exportLeadSheet({ bars, title, tempo }) {
  const [, { jsPDF }] = await Promise.all([
    loadHandwrittenFont(),
    import("jspdf"),
  ])

  const HW       = `"Caveat", "Bradley Hand", cursive`
  const songName = (title || "Lead Sheet").replace(/\s*\([^)]*\)\s*$/, "").toUpperCase()

  // Assign guide tones to every bar (E4–F5 range, smooth voice leading)
  let prevMidi = null
  const enriched = bars.map(bar => {
    const [t3, t7] = guideTones(bar.symbol)
    const g3 = assignOctave(t3, prevMidi)
    if (g3) prevMidi = Note.midi(g3) ?? prevMidi
    const g7 = assignOctave(t7, prevMidi)
    if (g7) prevMidi = Note.midi(g7) ?? prevMidi
    return { ...bar, _gt: [g3, g7] }
  })

  const measures = groupIntoMeasures(enriched)
  const NROWS    = Math.ceil(measures.length / BPR)

  const pageRowCounts = []
  let rowsLeft = NROWS
  pageRowCounts.push(Math.min(rowsLeft, ROWS_P1)); rowsLeft -= ROWS_P1
  while (rowsLeft > 0) {
    pageRowCounts.push(Math.min(rowsLeft, ROWS_PX)); rowsLeft -= ROWS_PX
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" })
  let rowStart = 0

  for (let pi = 0; pi < pageRowCounts.length; pi++) {
    const canvas  = document.createElement("canvas")
    canvas.width  = PAGE_W
    canvas.height = PAGE_H
    renderPage({
      canvas, isFirstPage: pi === 0, songName,
      tempo: tempo || 120, measures, rowStart,
      rowCount: pageRowCounts[pi], HW,
    })
    if (pi > 0) pdf.addPage()
    pdf.addImage(canvas.toDataURL("image/png", 1.0), "PNG", 0, 0, 8.5, 11)
    rowStart += pageRowCounts[pi]
  }

  const safe = songName.replace(/[^A-Z0-9 ]/g, "").trim().replace(/ +/g, "_") || "lead_sheet"
  pdf.save(`${safe}.pdf`)
}

// ─── MusicXML export ──────────────────────────────────────────────────────────
// Each logical measure = one <measure>:
//   • 1-chord measure → half-note chord 1 (root pos) + half-note chord 2 (VL inversion)
//   • 2-chord measure → half-note chord 1 (root pos) + half-note chord 2 (root pos)
export function exportMusicXML({ bars, title, tempo }) {
  const songName = (title || "Lead Sheet").replace(/\s*\([^)]*\)\s*$/, "").toUpperCase()
  const bpm      = tempo || 120
  const BASE     = 60  // C4 — root voicings start here

  const measures = groupIntoMeasures(bars)

  // Pre-compute voicings for every measure
  const voicings = measures.map((measure, mi) => {
    if (measure.length === 1) {
      // Single chord: root pos + voice-leading inversion toward next measure
      const tones = chordTones(measure[0].symbol)
      if (!tones) return null
      const rootMidis = closeVoicing(tones, BASE)
      const nextMeasure = measures[mi + 1]
      let vlMidis = rootMidis
      if (nextMeasure) {
        const nextTones = chordTones(nextMeasure[0].symbol)
        if (nextTones) {
          const nextRoot = closeVoicing(nextTones, BASE)
          vlMidis = bestInversionFor(tones, nextRoot, BASE)
        }
      }
      return [rootMidis, vlMidis]
    } else {
      // Two chords: each gets its own root position voicing
      return measure.map(bar => {
        const tones = chordTones(bar.symbol)
        return tones ? closeVoicing(tones, BASE) : null
      })
    }
  })

  const x = []
  x.push('<?xml version="1.0" encoding="UTF-8"?>')
  x.push('<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">')
  x.push('<score-partwise version="4.0">')
  x.push(`  <work><work-title>${esc(songName)}</work-title></work>`)
  x.push('  <identification><encoding><software>DukeBox</software></encoding></identification>')
  x.push('  <part-list><score-part id="P1"><part-name>Chord Voicings</part-name></score-part></part-list>')
  x.push('  <part id="P1">')

  let prevSection = null

  measures.forEach((measure, mi) => {
    x.push(`    <measure number="${mi + 1}">`)

    if (mi === 0) {
      x.push('      <attributes>')
      x.push('        <divisions>2</divisions>')
      x.push('        <key><fifths>0</fifths></key>')
      x.push('        <time><beats>4</beats><beat-type>4</beat-type></time>')
      x.push('        <clef><sign>G</sign><line>2</line></clef>')
      x.push('      </attributes>')
      x.push('      <direction placement="above">')
      x.push(`        <direction-type><metronome parentheses="no"><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type>`)
      x.push(`        <sound tempo="${bpm}"/>`)
      x.push('      </direction>')
    }

    // Section label from first bar of the measure
    const firstBar = measure[0]
    if (firstBar.section && firstBar.section !== prevSection) {
      prevSection = firstBar.section
      const raw   = firstBar.section.replace(/\s*\(.*\)/g, "").trim()
      const label = raw.length > 7 ? raw[0].toUpperCase() : raw
      x.push('      <direction placement="above"><direction-type>')
      x.push(`        <rehearsal enclosure="square">${esc(label)}</rehearsal>`)
      x.push('      </direction-type></direction>')
    }

    // Harmony element(s) — one per chord in the measure
    measure.forEach((bar, bi) => {
      const ch = parseChordForMXL(bar.symbol)
      if (!ch) return
      x.push('      <harmony>')
      // offset=2 divisions (= 2 beats) tells notation software the 2nd chord starts on beat 3
      if (measure.length > 1 && bi > 0) x.push('        <offset>2</offset>')
      x.push(`        <root><root-step>${ch.step}</root-step>${ch.alter !== 0 ? `<root-alter>${ch.alter}</root-alter>` : ""}</root>`)
      x.push(`        <kind text="${esc(ch.kindText)}">${ch.kind}</kind>`)
      x.push('      </harmony>')
    })

    // Note chords
    const addChord = (midis) => {
      if (!midis || midis.length === 0) {
        x.push('      <note><rest/><duration>2</duration><type>half</type></note>')
        return
      }
      midis.forEach((midi, ni) => {
        const p = midiToMXLPitch(midi)
        if (!p) return
        x.push('      <note>')
        if (ni > 0) x.push('        <chord/>')
        x.push(`        <pitch><step>${p.step}</step>${p.alter !== 0 ? `<alter>${p.alter}</alter>` : ""}<octave>${p.octave}</octave></pitch>`)
        x.push('        <duration>2</duration><type>half</type>')
        if (p.accidental) x.push(`        <accidental>${p.accidental}</accidental>`)
        x.push('      </note>')
      })
    }

    const v = voicings[mi]
    if (v) {
      addChord(v[0])
      addChord(v[1])
    } else {
      x.push('      <note><rest/><duration>2</duration><type>half</type></note>')
      x.push('      <note><rest/><duration>2</duration><type>half</type></note>')
    }

    x.push('    </measure>')
  })

  x.push('  </part>')
  x.push('</score-partwise>')

  const blob = new Blob([x.join("\n")], { type: "application/vnd.recordare.musicxml+xml" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url
  const safe = songName.replace(/[^A-Z0-9 ]/g, "").trim().replace(/ +/g, "_") || "lead_sheet"
  a.download = `${safe}.xml`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Line Lab: a generated line as MusicXML ──────────────────────────────────
// Lines come back from /api/generate-line in the compact tab schema
// { bars: [{ c, n: [[string, fret, beats], …] }] }, which notation software
// can't read. This writes the same line as a two-staff grand staff — treble
// clef standard notation on staff 1, a real 6-line TAB clef on staff 2 — the
// same "Notation + TAB" pairing the lab shows on screen, not just fret/string
// numbers annotated onto a single staff.

const LINE_DIVISIONS = 12   // per quarter — divides cleanly by 2, 3, and 4

// beats → { type, dots, triplet }. Triplets carry a 3:2 time-modification.
const LINE_DURATIONS = [
  { beats: 4,     type: "whole",   dots: 0, triplet: false },
  { beats: 3,     type: "half",    dots: 1, triplet: false },
  { beats: 8 / 3, type: "whole",   dots: 0, triplet: true  },
  { beats: 2,     type: "half",    dots: 0, triplet: false },
  { beats: 1.5,   type: "quarter", dots: 1, triplet: false },
  { beats: 4 / 3, type: "half",    dots: 0, triplet: true  },
  { beats: 1,     type: "quarter", dots: 0, triplet: false },
  { beats: 0.75,  type: "eighth",  dots: 1, triplet: false },
  { beats: 2 / 3, type: "quarter", dots: 0, triplet: true  },
  { beats: 0.5,   type: "eighth",  dots: 0, triplet: false },
  { beats: 1 / 3, type: "eighth",  dots: 0, triplet: true  },
  { beats: 0.25,  type: "16th",    dots: 0, triplet: false },
  { beats: 1 / 6, type: "16th",    dots: 0, triplet: true  },
  { beats: 0.125, type: "32nd",    dots: 0, triplet: false },
]

function lineDurationOf(beats) {
  let best = LINE_DURATIONS[LINE_DURATIONS.length - 1]
  let bestErr = Infinity
  for (const d of LINE_DURATIONS) {
    const err = Math.abs(d.beats - beats)
    if (err < bestErr) { best = d; bestErr = err }
  }
  return best
}

const LINE_OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 }

// Two beams per 4/4 bar (first 4 eighth-note-units, then the last 4) —
// matches the beaming LineNotation.jsx's on-screen ABC view now uses, so an
// exported eighth-note line reads the same way it looked in the lab instead
// of importing as one flagged note per beam. Only plain (non-dotted,
// non-triplet) eighth notes are grouped; anything else stands alone.
function beamRolesForBar(barNotes) {
  const roles = new Array(barNotes.length).fill(null)
  let pos = 0
  let runStart = -1
  let runHalf = -1
  const closeRun = (endExclusive) => {
    if (runStart >= 0 && endExclusive - runStart >= 2) {
      roles[runStart] = "begin"
      for (let k = runStart + 1; k < endExclusive - 1; k++) roles[k] = "continue"
      roles[endExclusive - 1] = "end"
    }
    runStart = -1
  }
  barNotes.forEach(([, , dur, wait = 0], i) => {
    const d = Number(dur) || 0
    const w = Number(wait) || 0
    const start = pos + w
    const half = Math.floor(start / 2)
    const eligible = Math.abs(d - 0.5) < 1e-6
    const continues = eligible && w === 0 && runStart >= 0 && half === runHalf
    if (!continues) closeRun(i)
    if (eligible && runStart < 0) { runStart = i; runHalf = half }
    else if (!eligible) runStart = -1
    pos = start + d
  })
  closeRun(barNotes.length)
  return roles
}

export function exportLineMusicXML({ line, title, tempo, level }) {
  const lineBars = line?.bars ?? []
  if (!lineBars.length) return false

  const bpm = Math.round(tempo || 120)
  const label = [title || "Line Lab", level ? `L${level}` : null].filter(Boolean).join(" — ")
  const MEASURE_DIVS = 4 * LINE_DIVISIONS

  const x = []
  x.push('<?xml version="1.0" encoding="UTF-8"?>')
  x.push('<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">')
  x.push('<score-partwise version="4.0">')
  x.push(`  <work><work-title>${esc(label)}</work-title></work>`)
  x.push('  <identification><encoding><software>DukeBox Line Lab</software></encoding></identification>')
  x.push('  <part-list><score-part id="P1"><part-name>Line</part-name></score-part></part-list>')
  x.push('  <part id="P1">')

  lineBars.forEach((bar, mi) => {
    x.push(`    <measure number="${mi + 1}">`)

    if (mi === 0) {
      x.push('      <attributes>')
      x.push(`        <divisions>${LINE_DIVISIONS}</divisions>`)
      x.push('        <key><fifths>0</fifths></key>')
      x.push('        <time><beats>4</beats><beat-type>4</beat-type></time>')
      x.push('        <staves>2</staves>')
      x.push('        <clef number="1"><sign>G</sign><line>2</line></clef>')
      x.push('        <clef number="2"><sign>TAB</sign><line>5</line></clef>')
      x.push('        <staff-details number="2"><staff-lines>6</staff-lines></staff-details>')
      x.push('      </attributes>')
      x.push('      <direction placement="above">')
      x.push(`        <direction-type><metronome parentheses="no"><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type>`)
      x.push(`        <sound tempo="${bpm}"/>`)
      x.push('      </direction>')
    }

    // A bar's `c` may name more than one chord ("Bm7b5 E7b9"); those split the
    // bar evenly, in written order — the same reading the lab plays back.
    const syms = String(bar.c || "").trim().split(/\s+/).filter(Boolean)
    syms.forEach((sym, si) => {
      const ch = parseChordForMXL(sym)
      if (!ch) return
      x.push('      <harmony>')
      if (si > 0) x.push(`        <offset>${Math.round((si / syms.length) * 4 * LINE_DIVISIONS)}</offset>`)
      x.push(`        <root><root-step>${ch.step}</root-step>${ch.alter !== 0 ? `<root-alter>${ch.alter}</root-alter>` : ""}</root>`)
      x.push(`        <kind text="${esc(ch.kindText)}">${ch.kind}</kind>`)
      x.push('      </harmony>')
    })

    // One shared rhythm/pitch event list — staff 1 (standard notation) and
    // staff 2 (TAB) render the exact same events via <backup>, just under a
    // different <staff> number, with the string/fret technical mark (which
    // is what makes a TAB-clef staff actually show fret numbers) on staff 2
    // alone.
    const events = []
    const beamRoles = beamRolesForBar(bar.n || [])
    ;(bar.n || []).forEach(([s, f, b, wait = 0], ni) => {
      const waitDivs = Math.max(0, Math.round((Number(wait) || 0) * LINE_DIVISIONS))
      if (waitDivs) events.push({ rest: true, duration: waitDivs })
      const d = lineDurationOf(b)
      const dur = Math.max(1, Math.round(b * LINE_DIVISIONS))
      const pitch = midiToMXLPitch((LINE_OPEN_MIDI[s] ?? 64) + (Number(f) || 0))
      if (!pitch) return
      events.push({
        rest: false, duration: dur, type: d.type, dots: d.dots, triplet: d.triplet,
        pitch, string: s, fret: Number(f) || 0, beam: beamRoles[ni],
      })
    })
    const filled = events.reduce((sum, e) => sum + e.duration, 0)
    if (filled < MEASURE_DIVS) events.push({ rest: true, duration: MEASURE_DIVS - filled })

    const emitStaff = (staffNum, withTab) => {
      events.forEach((ev) => {
        if (ev.rest) {
          x.push(`      <note><rest/><duration>${ev.duration}</duration><staff>${staffNum}</staff></note>`)
          return
        }
        x.push('      <note>')
        x.push(`        <pitch><step>${ev.pitch.step}</step>${ev.pitch.alter !== 0 ? `<alter>${ev.pitch.alter}</alter>` : ""}<octave>${ev.pitch.octave}</octave></pitch>`)
        x.push(`        <duration>${ev.duration}</duration>`)
        x.push(`        <type>${ev.type}</type>`)
        for (let i = 0; i < ev.dots; i++) x.push('        <dot/>')
        if (ev.pitch.accidental) x.push(`        <accidental>${ev.pitch.accidental}</accidental>`)
        if (ev.triplet) x.push('        <time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>')
        x.push(`        <staff>${staffNum}</staff>`)
        if (ev.beam) x.push(`        <beam number="1">${ev.beam}</beam>`)
        if (withTab) {
          x.push('        <notations><technical>')
          x.push(`          <string>${ev.string}</string><fret>${ev.fret}</fret>`)
          x.push('        </technical></notations>')
        }
        x.push('      </note>')
      })
    }

    emitStaff(1, false)
    x.push(`      <backup><duration>${MEASURE_DIVS}</duration></backup>`)
    emitStaff(2, true)

    x.push('    </measure>')
  })

  x.push('  </part>')
  x.push('</score-partwise>')

  const blob = new Blob([x.join("\n")], { type: "application/vnd.recordare.musicxml+xml" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url
  const safe = String(label).replace(/[^A-Za-z0-9 ]/g, "").trim().replace(/ +/g, "_") || "line"
  a.download = `${safe}.xml`
  a.click()
  URL.revokeObjectURL(url)
  return true
}
