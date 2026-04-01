// Lead sheet PDF export — Real Book handwritten style
// VexFlow (Petaluma font) draws stave + clef only.
// Notes are drawn manually on canvas for reliable, pixel-exact placement.
// jsPDF assembles pages.

import { Note, Chord } from "@tonaljs/tonal"

// ─── XML escape helper ────────────────────────────────────────────────────────
function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

// ─── Chord symbol → MusicXML kind + root ─────────────────────────────────────
function parseChordForMXL(symbol) {
  if (!symbol) return null
  const m = symbol.match(/^([A-G](b{1,2}|#{1,2})?)/)
  if (!m) return null
  const rootStr = m[1]
  const rootNote = Note.get(rootStr)
  if (!rootNote.letter) return null
  const q = symbol.slice(rootStr.length)
  let kind, kindText
  if (/m7b5|min7b5/.test(q))               { kind = "half-diminished";     kindText = "ø7"  }
  else if (/dim7|°7/.test(q))              { kind = "diminished-seventh";  kindText = "°7"  }
  else if (/dim|°/.test(q))               { kind = "diminished";           kindText = "°"   }
  else if (/maj7|M7/.test(q))             { kind = "major-seventh";        kindText = "Δ7"  }
  else if (/maj|Maj/.test(q))             { kind = "major";                kindText = "Δ"   }
  else if (/m7|min7|-7/.test(q))          { kind = "minor-seventh";        kindText = "-7"  }
  else if (/m(?!a)|min|-(?!7)/.test(q))   { kind = "minor";                kindText = "-"   }
  else if (/7sus4?|sus/.test(q))          { kind = "suspended-fourth";     kindText = "sus" }
  else if (/7/.test(q))                   { kind = "dominant";             kindText = "7"   }
  else                                    { kind = "major";                kindText = ""    }
  return { step: rootNote.letter, alter: rootNote.alt ?? 0, kind, kindText }
}

// ─── Note → MusicXML pitch ────────────────────────────────────────────────────
function noteToMXL(noteOct) {
  const m = String(noteOct || "").match(/^([A-G])(b{1,2}|#{1,2})?(\d)$/)
  if (!m) return null
  const alter = m[2] === "bb" ? -2 : m[2] === "b" ? -1 : m[2] === "#" ? 1 : m[2] === "##" ? 2 : 0
  const acc   = m[2] === "bb" ? "double-flat" : m[2] === "b" ? "flat"
              : m[2] === "#"  ? "sharp"       : m[2] === "##" ? "double-sharp" : null
  return { step: m[1], alter, octave: parseInt(m[3]), accidental: acc }
}

// ─── Chord symbol → Real Book notation ───────────────────────────────────────
function rbChord(symbol) {
  if (!symbol) return ""
  return symbol
    .replace(/maj7/g, "Δ")
    .replace(/maj6/g, "Δ6")
    .replace(/maj/g, "Δ")
    .replace(/min7b5|m7b5/g, "ø7")
    .replace(/dim7/g, "°7")
    .replace(/dim/g, "°")
    .replace(/min7|m7/g, "-7")
    .replace(/min|m(?=[^a]|$)/g, "-")
    .replace(/7alt/g, "7alt")
    .replace(/7sus4|sus4/g, "sus")
}

// ─── Accidental helper ────────────────────────────────────────────────────────
function getAcc(noteName) {
  const m = (noteName || "").match(/^[A-G](bb|##|b|#)?/)
  return (m && m[1]) || ""
}

// ─── Octave assignment ────────────────────────────────────────────────────────
// Clamp to E4–F5 (MIDI 64–77): fully within the treble clef staff.
function assignOctave(noteName, prevMidi) {
  if (!noteName) return null
  const MIDI_MIN = 64  // E4 — bottom staff line
  const MIDI_MAX = 77  // F5 — top staff line
  if (prevMidi == null) {
    for (const oct of [4, 5]) {
      const midi = Note.midi(noteName + oct)
      if (midi != null && midi >= 67 && midi <= 74) return noteName + oct
    }
    for (const oct of [4, 5]) {
      const midi = Note.midi(noteName + oct)
      if (midi != null && midi >= MIDI_MIN && midi <= MIDI_MAX) return noteName + oct
    }
    // No octave in preferred/valid range — pick closest to centre (B4=71)
    let best = null, bestDist = Infinity
    for (const oct of [3, 4, 5, 6]) {
      const midi = Note.midi(noteName + oct)
      if (midi == null) continue
      const clamped = Math.max(MIDI_MIN, Math.min(MIDI_MAX, midi))
      const d = Math.abs(clamped - 71)
      if (d < bestDist) { bestDist = d; best = noteName + oct }
    }
    return best || noteName + "5"
  }
  let best = null, bestDist = Infinity
  for (const oct of [3, 4, 5, 6]) {
    const midi = Note.midi(noteName + oct)
    if (midi == null || midi < MIDI_MIN || midi > MIDI_MAX) continue
    const d = Math.abs(midi - prevMidi)
    if (d < bestDist) { bestDist = d; best = noteName + oct }
  }
  if (best) return best
  // Fallback: find closest clamped octave
  let fallback = null, fallbackDist = Infinity
  for (const oct of [3, 4, 5, 6]) {
    const midi = Note.midi(noteName + oct)
    if (midi == null) continue
    const clamped = Math.max(MIDI_MIN, Math.min(MIDI_MAX, midi))
    const d = Math.abs(clamped - prevMidi)
    if (d < fallbackDist) { fallbackDist = d; fallback = noteName + oct }
  }
  return fallback || noteName + "5"
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

// ─── Layout constants ─────────────────────────────────────────────────────────
const PAGE_W  = 816
const PAGE_H  = 1056
const ML      = 52
const MR      = 52
const MT1     = 116   // top margin page 1 (after title block)
const MTX     = 36    // top margin page 2+
const MB      = 40
const BPR     = 4     // bars per row

const ROW_H       = 106
const CHORD_ZONE  = 44    // px above stave top reserved for chord symbols
const CHORD_GAP   = 32    // chord text baseline this many px above stave top line
const CHORD_TY    = CHORD_ZONE - CHORD_GAP   // = 12 — Y offset of chord baseline from rowY
const STAVE_Y_OFF = CHORD_ZONE               // stave top Y offset from rowY (= 44)
// stave occupies rowY+44 … rowY+84.  Below-stave clearance = ROW_H-84 = 22 px.

const ROWS_P1 = Math.floor((PAGE_H - MT1 - MB) / ROW_H)
const ROWS_PX = Math.floor((PAGE_H - MTX - MB) / ROW_H)

// ─── Manual note rendering ────────────────────────────────────────────────────
// Diatonic letter → steps above C within one octave
const DIATONIC = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }

// Y coordinate of a note's centre on the stave.
// staveTop = Y of the top staff line (= F5 in treble clef).
// Staff spans staveTop (F5) → staveTop+40 (E4), 5px per diatonic step.
function noteY(noteOct, staveTop) {
  const m = String(noteOct || "").match(/^([A-G])(b{1,2}|#{1,2})?(\d)$/)
  if (!m) return staveTop + 20  // fallback: B4 (middle line)
  const stepsAboveE4 = (parseInt(m[3]) - 4) * 7 + DIATONIC[m[1]] - 2
  return staveTop + 40 - stepsAboveE4 * 5
}

// Draw an open half-note head + stem.
function drawHalfNote(c, cx, staveTop, noteOct) {
  const acc  = getAcc(String(noteOct).replace(/\d$/, ""))
  const y    = noteY(noteOct, staveTop)
  const midY = staveTop + 20   // B4, middle staff line
  const up   = y >= midY       // stem up when note is at/below middle

  c.save()
  c.strokeStyle = "#000"
  c.lineWidth   = 1.6

  // Open ellipse (half-note head, slightly tilted)
  c.beginPath()
  c.ellipse(cx, y, 5.5, 4, -0.2, 0, Math.PI * 2)
  c.fillStyle = "#fff"
  c.fill()
  c.stroke()

  // Stem (right side when up, left when down)
  const sx  = up ? cx + 5 : cx - 5
  const dir = up ? -1 : 1
  c.beginPath()
  c.moveTo(sx, y + dir * 3)
  c.lineTo(sx, y + dir * 34)
  c.stroke()

  // Accidental glyph to the left of the head
  if (acc) {
    const glyph = acc === "b" ? "♭" : acc === "#" ? "♯"
                : acc === "bb" ? "♭♭" : "♯♯"
    c.font      = "bold 12px serif"
    c.textAlign = "right"
    c.fillStyle = "#000"
    c.fillText(glyph, cx - 8, y + 4)
  }

  c.restore()
}

// Draw a half rest (filled rectangle sitting on the middle line).
function drawHalfRest(c, cx, staveTop) {
  c.fillStyle = "#000"
  c.fillRect(cx - 7, staveTop + 20, 14, 5)
}

// ─── Render one page to a canvas ─────────────────────────────────────────────
function renderPage({
  canvas, isFirstPage, songName, tempo,
  bars, notePairs, rowStart, rowCount,
  VF, HW,
}) {
  const { Renderer, Stave, Barline } = VF
  const BAR_W = (PAGE_W - ML - MR) / BPR

  const c = canvas.getContext("2d")
  c.fillStyle = "#fff"
  c.fillRect(0, 0, PAGE_W, PAGE_H)

  const renderer = new Renderer(canvas, Renderer.Backends.CANVAS)
  renderer.resize(PAGE_W, PAGE_H)
  const vf = renderer.getContext()

  // ── Title block (page 1 only) ───────────────────────────────────────────
  if (isFirstPage) {
    c.font      = `bold 60px ${HW}`
    c.textAlign = "center"
    c.fillStyle = "#000"
    c.fillText(songName, PAGE_W / 2, 72)

    c.font      = `18px ${HW}`
    c.textAlign = "left"
    c.fillText(`♩ = ${tempo}`, 56, 100)

    c.font      = `italic 13px ${HW}`
    c.textAlign = "right"
    c.fillStyle = "#444"
    c.fillText("DukeBox Guide Tones", PAGE_W - 56, 100)

    c.strokeStyle = "#000"
    c.lineWidth   = 1
    c.beginPath()
    c.moveTo(52, 108); c.lineTo(PAGE_W - 52, 108)
    c.stroke()
  }

  const MT = isFirstPage ? MT1 : MTX
  let prevSection = null

  for (let ri = 0; ri < rowCount; ri++) {
    const rowY   = MT + ri * ROW_H
    const staveY = rowY + STAVE_Y_OFF

    for (let col = 0; col < BPR; col++) {
      const barIdx       = (rowStart + ri) * BPR + col
      if (barIdx >= bars.length) break
      const bar          = bars[barIdx]
      const staveX       = ML + col * BAR_W
      const isVeryFirst  = barIdx === 0
      const isFirstInRow = col === 0
      const isLastBar    = barIdx === bars.length - 1

      // ── Stave (VexFlow draws clef + 5 lines + barlines) ─────────────────
      const stave = new Stave(staveX, staveY, BAR_W)
      if (isVeryFirst)       stave.addClef("treble").addTimeSignature("4/4")
      else if (isFirstInRow) stave.addClef("treble")
      if (isLastBar) stave.setEndBarType(Barline.type.END)
      stave.setContext(vf).draw()

      // ── Section label ────────────────────────────────────────────────────
      if (bar.section && bar.section !== prevSection) {
        prevSection = bar.section
        const raw   = bar.section.replace(/\s*\(.*\)/g, "").trim()
        const label = raw.length > 7 ? raw.slice(0, 1).toUpperCase() : raw
        // Box sits left of chord text, vertically centred in CHORD_ZONE
        const lx = staveX + (isFirstInRow ? 26 : 5)
        const ly = rowY + CHORD_TY

        c.save()
        c.font        = `bold 12px ${HW}`
        c.textAlign   = "center"
        c.fillStyle   = "#000"
        c.strokeStyle = "#000"
        c.lineWidth   = 1.5
        const tw = c.measureText(label).width
        c.strokeRect(lx - tw / 2 - 4, ly - 13, tw + 8, 16)
        c.fillText(label, lx, ly)
        c.restore()
      }

      // ── Chord symbol ─────────────────────────────────────────────────────
      const chordTxt = rbChord(bar.symbol || "")
      const chordX   = staveX + (isVeryFirst ? 64 : isFirstInRow ? 34 : 8)
      const chordY   = rowY + CHORD_TY

      c.save()
      c.font      = `bold 20px ${HW}`
      c.textAlign = "left"
      c.fillStyle = "#000"
      c.fillText(chordTxt, chordX, chordY)
      c.restore()

      // ── Guide-tone notes (manual canvas drawing) ──────────────────────────
      const [an, dn] = notePairs[barIdx] || []
      const beats     = bar.beats ?? 4

      // Horizontal space occupied by clef/time-sig on the left of this bar
      const usedLeft  = isVeryFirst ? 72 : isFirstInRow ? 42 : 14
      const noteAreaW = BAR_W - usedLeft - 10
      const x1 = staveX + usedLeft + noteAreaW * 0.28
      const x2 = staveX + usedLeft + noteAreaW * 0.72

      if (an)       drawHalfNote(c, x1, staveY, an)
      else          drawHalfRest(c, x1, staveY)

      if (beats >= 4) {
        if (dn)     drawHalfNote(c, x2, staveY, dn)
        else        drawHalfRest(c, x2, staveY)
      }
    }
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function exportLeadSheet({ bars, approachLines, title, tempo }) {
  const [VF, { jsPDF }] = await Promise.all([
    import("vexflow"),
    import("jspdf"),
  ])

  try { VF.Flow?.setMusicFont?.("Petaluma") } catch {}
  try { VF.setMusicFont?.("Petaluma")       } catch {}

  await loadHandwrittenFont()

  const HW       = `"Caveat", "Bradley Hand", "Segoe Script", cursive`
  const songName = (title || "Lead Sheet").replace(/\s*\([^)]*\)\s*$/, "").toUpperCase()
  const NROWS    = Math.ceil(bars.length / BPR)

  // ── Assign octaves to all guide-tone notes ────────────────────────────────
  let prevMidi = null
  const notePairs = (approachLines || []).map(line => {
    const [a, d] = line.phrase || []
    const an = assignOctave(a, prevMidi)
    if (an) prevMidi = Note.midi(an) ?? prevMidi
    const dn = assignOctave(d, prevMidi)
    if (dn) prevMidi = Note.midi(dn) ?? prevMidi
    return [an, dn]
  })

  // ── Paginate ──────────────────────────────────────────────────────────────
  const pageRowCounts = []
  let rowsLeft = NROWS
  pageRowCounts.push(Math.min(rowsLeft, ROWS_P1)); rowsLeft -= ROWS_P1
  while (rowsLeft > 0) {
    pageRowCounts.push(Math.min(rowsLeft, ROWS_PX)); rowsLeft -= ROWS_PX
  }

  // ── Render each page ──────────────────────────────────────────────────────
  const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" })
  let rowStart = 0

  for (let pi = 0; pi < pageRowCounts.length; pi++) {
    const canvas   = document.createElement("canvas")
    canvas.width   = PAGE_W
    canvas.height  = PAGE_H

    renderPage({
      canvas,
      isFirstPage: pi === 0,
      songName,
      tempo: tempo || 120,
      bars,
      notePairs,
      rowStart,
      rowCount: pageRowCounts[pi],
      VF,
      HW,
    })

    if (pi > 0) pdf.addPage()
    pdf.addImage(canvas.toDataURL("image/png", 1.0), "PNG", 0, 0, 8.5, 11)
    rowStart += pageRowCounts[pi]
  }

  const safeName = songName.replace(/[^A-Z0-9 ]/g, "").trim().replace(/ +/g, "_") || "lead_sheet"
  pdf.save(`${safeName}.pdf`)
}

// ─── Chord voicing helpers ────────────────────────────────────────────────────

// Get the 4 chord tones (1-3-5-7) from a symbol. Returns note names without octave.
function chordTones(symbol) {
  if (!symbol) return null
  const ch = Chord.get(symbol)
  if (!ch.notes || ch.notes.length < 2) return null
  const notes = ch.notes.slice(0, 4)
  if (notes.length === 3) notes.push(notes[0])  // double root for triads
  return notes.length >= 4 ? notes : null
}

// Close-position voicing starting with `notes[0]` at or above `baseMidi`.
// Returns an array of MIDI numbers ascending from baseMidi.
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

// All 4 rotations (inversions) of a chord as close-position voicings.
// Each rotation starts at or above `baseMidi`.
function allInversions(notes, baseMidi) {
  return notes.map((_, i) => {
    const rotated = [...notes.slice(i), ...notes.slice(0, i)]
    return closeVoicing(rotated, baseMidi)
  })
}

// Pick the inversion of `notes` whose voicing has minimum total semitone
// distance to `targetMidis` (the next chord's root position voicing).
function bestInversionFor(notes, targetMidis, baseMidi) {
  const invs = allInversions(notes, baseMidi - 6)  // ±6 below base to allow range
  let best = invs[0], bestDist = Infinity
  for (const inv of invs) {
    const len  = Math.min(inv.length, targetMidis.length)
    const dist = inv.slice(0, len).reduce((s, m, i) => s + Math.abs(m - targetMidis[i]), 0)
    if (dist < bestDist) { bestDist = dist; best = inv }
  }
  return best
}

// Convert a MIDI number to a MusicXML pitch object.
function midiToMXLPitch(midi) {
  const name = Note.fromMidi(midi)  // e.g. "Eb4"
  return noteToMXL(name)
}

// ─── MusicXML export ──────────────────────────────────────────────────────────
// Each measure: half-note chord 1 = root position 1-3-5-7,
//               half-note chord 2 = voice-leading inversion toward next chord.
// Opens perfectly in MuseScore (free), Sibelius, Finale, Noteflight.
export function exportMusicXML({ bars, title, tempo }) {
  const songName = (title || "Lead Sheet").replace(/\s*\([^)]*\)\s*$/, "").toUpperCase()
  const bpm = tempo || 120
  const BASE_MIDI = 60  // C4 — root voicings start here

  // Pre-compute both voicings for every bar
  const voicings = bars.map((bar, i) => {
    const tones = chordTones(bar.symbol)
    if (!tones) return null

    const rootMidis = closeVoicing(tones, BASE_MIDI)

    // Voice-lead inversion: minimize distance to next bar's root position
    const nextTones = chordTones(bars[i + 1]?.symbol)
    let vlMidis = rootMidis
    if (nextTones) {
      const nextRoot = closeVoicing(nextTones, BASE_MIDI)
      vlMidis = bestInversionFor(tones, nextRoot, BASE_MIDI)
    }

    return { rootMidis, vlMidis }
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

  bars.forEach((bar, i) => {
    const beats = bar.beats ?? 4
    const v     = voicings[i]
    x.push(`    <measure number="${i + 1}">`)

    if (i === 0) {
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

    if (bar.section && bar.section !== prevSection) {
      prevSection = bar.section
      const raw   = bar.section.replace(/\s*\(.*\)/g, "").trim()
      const label = raw.length > 7 ? raw[0].toUpperCase() : raw
      x.push('      <direction placement="above"><direction-type>')
      x.push(`        <rehearsal enclosure="square">${esc(label)}</rehearsal>`)
      x.push('      </direction-type></direction>')
    }

    const ch = parseChordForMXL(bar.symbol)
    if (ch) {
      x.push('      <harmony>')
      x.push(`        <root><root-step>${ch.step}</root-step>${ch.alter !== 0 ? `<root-alter>${ch.alter}</root-alter>` : ""}</root>`)
      x.push(`        <kind text="${esc(ch.kindText)}">${ch.kind}</kind>`)
      x.push('      </harmony>')
    }

    // Emit a 4-note half-note chord from an array of MIDI numbers.
    // First note is normal; subsequent notes carry <chord/> to stack them.
    const addChord = (midis, isFirstChord) => {
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

    addChord(v?.rootMidis)
    if (beats >= 4) addChord(v?.vlMidis)
    else x.push('      <note><rest/><duration>2</duration><type>half</type></note>')

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
