// Lead sheet PDF export — Real Book handwritten style
// Uses VexFlow (Petaluma font) for notation + jsPDF for output.
// Both are loaded dynamically so Tone.js / bundle size are unaffected.

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

// "Bb4" → "bb/4",  "F#5" → "f#/5",  "C4" → "c/4"
function toVFKey(noteOct) {
  const m = (noteOct || "").match(/^([A-G](?:bb|##|b|#)?)(\d)$/)
  if (!m) return "b/4"
  return m[1].toLowerCase() + "/" + m[2]
}

// ─── Octave assignment ────────────────────────────────────────────────────────
// Hard-clamps to C4–G5 (MIDI 60–79) so notes always stay within/near the
// treble clef staff (E4 bottom line – F5 top line, max 1 ledger line).
function assignOctave(noteName, prevMidi) {
  if (!noteName) return null
  // E4 (bottom staff line) → G5 (one space above top line).
  // Nothing below the staff — note heads would overflow into the next row's chord zone.
  const MIDI_MIN = 64  // E4 — bottom staff line, no ledger lines needed
  const MIDI_MAX = 79  // G5 — one space above top line
  if (prevMidi == null) {
    // First note: prefer middle of the staff (G4–D5, MIDI 67–74)
    for (const oct of [4, 5]) {
      const midi = Note.midi(noteName + oct)
      if (midi != null && midi >= 67 && midi <= 74) return noteName + oct
    }
    // Fallback: anywhere in hard bounds
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

// ─── Load Caveat (handwritten) font ───────────────────────────────────────────
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

// ─── Main export ──────────────────────────────────────────────────────────────
export async function exportLeadSheet({ bars, approachLines, title, tempo }) {
  const [VF, { jsPDF }] = await Promise.all([
    import("vexflow"),
    import("jspdf"),
  ])

  const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Barline } = VF

  // Petaluma = VexFlow's handwritten music engraving font (Real Book look)
  try { VF.Flow?.setMusicFont?.("Petaluma") } catch {}
  try { VF.setMusicFont?.("Petaluma")       } catch {}

  await loadHandwrittenFont()

  // ── Canvas ────────────────────────────────────────────────────────────────
  // No SCALE multiplier. c and vf share the SAME canvas 2D context; applying
  // scale transforms to both would compound them (2× × 2× = 4×), causing
  // VexFlow stave/note coordinates to mismatch raw canvas text coordinates.
  // 816×1056 at 96 DPI = 8.5×11" — fine quality for a practice PDF.
  const W = 816, H = 1056
  const canvas = document.createElement("canvas")
  canvas.width  = W
  canvas.height = H

  // Raw 2D context for title, chord text, section boxes
  const c = canvas.getContext("2d")
  c.fillStyle = "#fff"
  c.fillRect(0, 0, W, H)

  // VexFlow renderer — shares the same underlying 2D context as c
  const renderer = new Renderer(canvas, Renderer.Backends.CANVAS)
  renderer.resize(W, H)
  const vf = renderer.getContext()
  // Do NOT call vf.scale() — c and vf are the same context; scaling one
  // already affects the other.

  // ── Title block ───────────────────────────────────────────────────────────
  const songName = (title || "Lead Sheet")
    .replace(/\s*\([^)]*\)\s*$/, "")  // strip "(Ab)" / "(Gm)" key suffixes
    .toUpperCase()

  const HW = `"Caveat", "Bradley Hand", "Segoe Script", cursive`

  c.font = `bold 60px ${HW}`
  c.textAlign = "center"
  c.fillStyle = "#000"
  c.fillText(songName, W / 2, 72)

  c.font = `18px ${HW}`
  c.textAlign = "left"
  c.fillText(`♩ = ${tempo || 120}`, 56, 100)

  c.font = `italic 13px ${HW}`
  c.textAlign = "right"
  c.fillStyle = "#444"
  c.fillText("DukeBox Guide Tones", W - 56, 100)

  c.strokeStyle = "#000"
  c.lineWidth = 1
  c.beginPath()
  c.moveTo(52, 108); c.lineTo(W - 52, 108)
  c.stroke()

  // ── Layout constants ──────────────────────────────────────────────────────
  const ML = 52, MR = 52
  const MT = 116, MB = 40
  const BPR   = 4
  const NROWS = Math.ceil(bars.length / BPR)
  const BAR_W = (W - ML - MR) / BPR

  // Row height: divide available space evenly across all rows
  const ROW_H = Math.floor((H - MT - MB) / NROWS)

  // Chord zone = space reserved above the stave top for chord symbols.
  // Stave is 40 px tall. With notes clamped to E4–G5 (on or above the bottom
  // staff line), note heads never fall below staveY+40, so we only need a small
  // clearance below the stave (≥ 6 px).
  // CHORD_TY is the chord-text baseline offset from rowY.  We keep 26 px between
  // the chord text baseline and the stave top so text sits clearly above the staff.
  const STAVE_BELOW  = 8                            // px clearance below stave bottom
  const CHORD_ABOVE  = 26                           // px gap: chord-text baseline → stave top
  const CHORD_FONT   = 22                           // approx chord text cap-height px
  const CHORD_ZONE   = Math.max(40, ROW_H - 40 - STAVE_BELOW) // space above stave
  const STAVE_OFFSET = CHORD_ZONE                   // staveY = rowY + CHORD_ZONE
  const CHORD_TY     = CHORD_ZONE - CHORD_ABOVE    // chord-text baseline: 26 px above stave

  // ── Assign octaves ────────────────────────────────────────────────────────
  let prevMidi = null
  const notePairs = (approachLines || []).map(line => {
    const [a, d] = line.phrase || []
    const an = assignOctave(a, prevMidi)
    if (an) prevMidi = Note.midi(an)
    const dn = assignOctave(d, prevMidi)
    if (dn) prevMidi = Note.midi(dn)
    return [an, dn]
  })

  // ── Render rows ───────────────────────────────────────────────────────────
  let prevSection = null

  for (let row = 0; row < NROWS; row++) {
    const rowY   = MT + row * ROW_H
    const staveY = rowY + STAVE_OFFSET

    for (let col = 0; col < BPR; col++) {
      const barIdx       = row * BPR + col
      if (barIdx >= bars.length) break
      const bar          = bars[barIdx]
      const staveX       = ML + col * BAR_W
      const isFirst      = barIdx === 0
      const isFirstInRow = col === 0
      const isLastBar    = barIdx === bars.length - 1

      // ── Stave ─────────────────────────────────────────────────────────
      const stave = new Stave(staveX, staveY, BAR_W)
      if (isFirst)           stave.addClef("treble").addTimeSignature("4/4")
      else if (isFirstInRow) stave.addClef("treble")
      if (isLastBar) stave.setEndBarType(Barline.type.END)
      stave.setContext(vf).draw()

      // ── Section label — boxed, Real Book style ─────────────────────────
      if (bar.section && bar.section !== prevSection) {
        prevSection = bar.section
        const raw   = bar.section.replace(/\s*\(.*\)/g, "").trim()
        const label = raw.length > 7 ? raw.slice(0, 1).toUpperCase() : raw
        const lx    = staveX + (isFirstInRow ? 28 : 6)
        const ly    = rowY + CHORD_TY

        c.save()
        c.font        = `bold 13px ${HW}`
        c.textAlign   = "center"
        c.fillStyle   = "#000"
        c.strokeStyle = "#000"
        c.lineWidth   = 1.5
        const tw = c.measureText(label).width
        c.strokeRect(lx - tw / 2 - 5, ly - 14, tw + 10, 17)
        c.fillText(label, lx, ly)
        c.restore()
      }

      // ── Chord symbol ──────────────────────────────────────────────────
      const chordTxt = rbChord(bar.symbol || "")
      const chordX   = staveX + (isFirst ? 64 : isFirstInRow ? 34 : 8)
      const chordY   = rowY + CHORD_TY

      c.save()
      c.font      = `bold 20px ${HW}`
      c.textAlign = "left"
      c.fillStyle = "#000"
      c.fillText(chordTxt, chordX, chordY)
      c.restore()

      // ── Guide-tone notes ──────────────────────────────────────────────
      const [an, dn] = notePairs[barIdx] || []
      const beats    = bar.beats ?? 4

      const makeNote = (noteOct, dur) => {
        if (!noteOct) {
          const rd = dur === "h" ? "hr" : "wr"
          return new StaveNote({ keys: ["b/4"], duration: rd })
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

      const fmtW = BAR_W - (isFirst ? 74 : isFirstInRow ? 44 : 24)
      new Formatter().joinVoices([voice]).format([voice], fmtW)
      voice.draw(vf, stave)
    }
  }

  // ── Export PDF ────────────────────────────────────────────────────────────
  const imgData  = canvas.toDataURL("image/png", 1.0)
  const pdf      = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" })
  pdf.addImage(imgData, "PNG", 0, 0, 8.5, 11)

  const safeName = songName.replace(/[^A-Z0-9 ]/g, "").trim().replace(/ +/g, "_") || "lead_sheet"
  pdf.save(`${safeName}.pdf`)
}
