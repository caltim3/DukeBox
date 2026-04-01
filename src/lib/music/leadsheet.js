// Lead sheet PDF export — Real Book handwritten style
// VexFlow (Petaluma font) for notation, jsPDF for output.
// Both are lazy-loaded so they don't affect page-load bundle size.

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

// ─── Accidental / key helpers ─────────────────────────────────────────────────
function getAcc(noteName) {
  const m = (noteName || "").match(/^[A-G](bb|##|b|#)?/)
  return (m && m[1]) || ""
}

function toVFKey(noteOct) {
  const m = (noteOct || "").match(/^([A-G](?:bb|##|b|#)?)(\d)$/)
  if (!m) return "b/4"
  return m[1].toLowerCase() + "/" + m[2]
}

// ─── Octave assignment ────────────────────────────────────────────────────────
// Clamp to E4–F5 (MIDI 64–77): fully within the treble clef staff.
// This prevents note heads from straying into the chord-symbol zone above
// or past the staff bottom into the next row.
function assignOctave(noteName, prevMidi) {
  if (!noteName) return null
  const MIDI_MIN = 64  // E4 — bottom staff line
  const MIDI_MAX = 77  // F5 — top staff line
  if (prevMidi == null) {
    for (const oct of [4, 5]) {
      const midi = Note.midi(noteName + oct)
      if (midi != null && midi >= 67 && midi <= 74) return noteName + oct // G4–D5 centre
    }
    for (const oct of [4, 5]) {
      const midi = Note.midi(noteName + oct)
      if (midi != null && midi >= MIDI_MIN && midi <= MIDI_MAX) return noteName + oct
    }
    return noteName + "4"
  }
  let best = null, bestDist = Infinity
  for (const oct of [3, 4, 5, 6]) {
    const midi = Note.midi(noteName + oct)
    if (midi == null || midi < MIDI_MIN || midi > MIDI_MAX) continue
    const d = Math.abs(midi - prevMidi)
    if (d < bestDist) { bestDist = d; best = noteName + oct }
  }
  return best || noteName + "4"
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

// ─── Layout constants (fixed, not dynamic) ───────────────────────────────────
// Fixed row height ensures chord symbols always have room above the stave.
// Charts that don't fit on one page flow onto additional pages automatically.
const PAGE_W  = 816
const PAGE_H  = 1056
const ML      = 52    // left margin
const MR      = 52    // right margin
const MT1     = 116   // top margin page 1 (after title block)
const MTX     = 36    // top margin page 2+
const MB      = 40    // bottom margin
const BPR     = 4     // bars per row

const ROW_H       = 106   // px — total height allocated per row
const CHORD_ZONE  = 44    // px above stave top line for chord symbols
// Chord text baseline sits CHORD_GAP px above the stave top line.
// The treble clef extends ~28 px above the top staff line; 32 px clears it.
const CHORD_GAP   = 32
const CHORD_TY    = CHORD_ZONE - CHORD_GAP  // baseline Y offset from rowY  (= 12)
const STAVE_Y_OFF = CHORD_ZONE              // stave top Y offset from rowY  (= 44)
// stave occupies [rowY+44 … rowY+84].  Below-stave clearance = ROW_H - 84 = 22 px.

const ROWS_P1 = Math.floor((PAGE_H - MT1 - MB) / ROW_H)   // rows on page 1
const ROWS_PX = Math.floor((PAGE_H - MTX - MB) / ROW_H)   // rows on page 2+

// ─── Render one page to a canvas ─────────────────────────────────────────────
function renderPage({
  canvas, isFirstPage, songName, tempo,
  bars, notePairs, rowStart, rowCount,
  VF, HW,
}) {
  const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Barline } = VF
  const BAR_W = (PAGE_W - ML - MR) / BPR

  const c = canvas.getContext("2d")
  c.fillStyle = "#fff"
  c.fillRect(0, 0, PAGE_W, PAGE_H)

  const renderer = new Renderer(canvas, Renderer.Backends.CANVAS)
  renderer.resize(PAGE_W, PAGE_H)
  const vf = renderer.getContext()
  // Do NOT call vf.scale() — c and vf share the same 2D context;
  // scaling one would compound on the other.

  // ── Title block (page 1 only) ───────────────────────────────────────────
  if (isFirstPage) {
    c.font = `bold 60px ${HW}`
    c.textAlign = "center"
    c.fillStyle = "#000"
    c.fillText(songName, PAGE_W / 2, 72)

    c.font = `18px ${HW}`
    c.textAlign = "left"
    c.fillText(`♩ = ${tempo}`, 56, 100)

    c.font = `italic 13px ${HW}`
    c.textAlign = "right"
    c.fillStyle = "#444"
    c.fillText("DukeBox Guide Tones", PAGE_W - 56, 100)

    c.strokeStyle = "#000"
    c.lineWidth = 1
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

      // ── Stave ───────────────────────────────────────────────────────────
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
        // Place box to the left of the chord symbol, vertically centred in CHORD_ZONE
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
      // Start chord text after clef/time-sig on first bars
      const chordX = staveX + (isVeryFirst ? 64 : isFirstInRow ? 34 : 8)
      const chordY = rowY + CHORD_TY

      c.save()
      c.font      = `bold 20px ${HW}`
      c.textAlign = "left"
      c.fillStyle = "#000"
      c.fillText(chordTxt, chordX, chordY)
      c.restore()

      // ── Guide-tone notes ──────────────────────────────────────────────────
      const [an, dn] = notePairs[barIdx] || []
      const beats    = bar.beats ?? 4

      const makeNote = (noteOct, dur) => {
        if (!noteOct) {
          return new StaveNote({ keys: ["b/4"], duration: dur === "h" ? "hr" : "wr" })
        }
        const sn  = new StaveNote({ clef: "treble", keys: [toVFKey(noteOct)], duration: dur })
        const acc = getAcc(noteOct.replace(/\d$/, ""))
        if (acc) sn.addModifier(new Accidental(acc), 0)
        return sn
      }

      const notes    = beats >= 4
        ? [makeNote(an, "h"), makeNote(dn, "h")]
        : [makeNote(an, "h")]
      const numBeats = beats >= 4 ? 4 : 2

      const voice = new Voice({ num_beats: numBeats, beat_value: 4 }).setStrict(false)
      voice.addTickables(notes)
      const fmtW = BAR_W - (isVeryFirst ? 74 : isFirstInRow ? 44 : 24)
      new Formatter().joinVoices([voice]).format([voice], fmtW)
      voice.draw(vf, stave)
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

  // ── Assign octaves to all guide-tone notes up front ───────────────────────
  let prevMidi = null
  const notePairs = (approachLines || []).map(line => {
    const [a, d] = line.phrase || []
    const an = assignOctave(a, prevMidi)
    if (an) prevMidi = Note.midi(an)
    const dn = assignOctave(d, prevMidi)
    if (dn) prevMidi = Note.midi(dn)
    return [an, dn]
  })

  // ── Paginate ──────────────────────────────────────────────────────────────
  // Page 1 gets ROWS_P1 rows; subsequent pages get ROWS_PX rows each.
  const pageRowCounts = []
  let rowsLeft = NROWS
  pageRowCounts.push(Math.min(rowsLeft, ROWS_P1)); rowsLeft -= ROWS_P1
  while (rowsLeft > 0) {
    pageRowCounts.push(Math.min(rowsLeft, ROWS_PX)); rowsLeft -= ROWS_PX
  }

  // ── Render each page to a canvas and collect images ───────────────────────
  const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" })
  let rowStart = 0

  for (let pi = 0; pi < pageRowCounts.length; pi++) {
    const canvas = document.createElement("canvas")
    canvas.width  = PAGE_W
    canvas.height = PAGE_H

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
