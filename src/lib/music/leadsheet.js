// Lead sheet PDF export — Real Book handwritten style
// VexFlow (Petaluma font) draws stave + clef only.
// Notes are drawn manually on canvas for reliable, pixel-exact placement.
// jsPDF assembles pages.

import { Note } from "@tonaljs/tonal"

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
