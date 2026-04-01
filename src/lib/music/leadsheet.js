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

// Convert "Bb4" → "bb/4",  "F#5" → "f#/5",  "C4" → "c/4"
function toVFKey(noteOct) {
  const m = (noteOct || "").match(/^([A-G](?:bb|##|b|#)?)(\d)$/)
  if (!m) return "b/4"
  return m[1].toLowerCase() + "/" + m[2]
}

// ─── Octave assignment for guide-tone melody ──────────────────────────────────
// Keeps notes in C3–C6 and as close as possible to the previous note.
function assignOctave(noteName, prevMidi) {
  if (!noteName) return null
  if (prevMidi == null) {
    // First note: anchor in the middle of treble clef (B3–E5)
    for (const oct of [4, 5]) {
      const midi = Note.midi(noteName + oct)
      if (midi != null && midi >= 59 && midi <= 76) return noteName + oct
    }
    return noteName + "4"
  }
  let best = null, bestDist = Infinity
  for (const oct of [3, 4, 5, 6]) {
    const midi = Note.midi(noteName + oct)
    if (midi == null || midi < 45 || midi > 84) continue // A2–C6 safe range
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
  } catch { /* fall back to cursive system font */ }
}

// ─── Main export function ─────────────────────────────────────────────────────
export async function exportLeadSheet({ bars, approachLines, title, tempo }) {
  // Lazy-load heavy libraries — keeps page load fast
  const [VF, { jsPDF }] = await Promise.all([
    import("vexflow"),
    import("jspdf"),
  ])

  const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Barline } = VF

  // Petaluma = VexFlow's built-in handwritten music engraving font
  try { VF.Flow?.setMusicFont?.("Petaluma") } catch {}
  try { VF.setMusicFont?.("Petaluma")       } catch {}

  await loadHandwrittenFont()

  // ── Canvas (2× for crisp PDF quality) ────────────────────────────────────
  const W = 816, H = 1056, SCALE = 2
  const canvas = document.createElement("canvas")
  canvas.width  = W * SCALE
  canvas.height = H * SCALE
  const c = canvas.getContext("2d")
  c.scale(SCALE, SCALE)
  c.fillStyle = "#fff"
  c.fillRect(0, 0, W, H)

  // VexFlow renderer on the same canvas
  const renderer = new Renderer(canvas, Renderer.Backends.CANVAS)
  renderer.resize(W * SCALE, H * SCALE)
  const vf = renderer.getContext()
  vf.scale(SCALE, SCALE)

  // ── Title block ───────────────────────────────────────────────────────────
  const songName = (title || "Lead Sheet")
    .replace(/\s*\([^)]*\)\s*$/, "")   // strip "(Ab)" key suffixes
    .toUpperCase()

  const HW = `"Caveat", "Bradley Hand", "Segoe Script", cursive`

  // Large handwritten title
  c.font = `bold 60px ${HW}`
  c.textAlign = "center"
  c.fillStyle = "#000"
  c.fillText(songName, W / 2, 76)

  // Tempo (bottom-left of title block)
  c.font = `18px ${HW}`
  c.textAlign = "left"
  c.fillText(`♩ = ${tempo || 120}`, 56, 106)

  // Subtitle (bottom-right)
  c.font = `italic 13px ${HW}`
  c.textAlign = "right"
  c.fillStyle = "#444"
  c.fillText("DukeBox Guide Tones", W - 56, 106)

  // Rule under title block
  c.strokeStyle = "#000"
  c.lineWidth = 1
  c.beginPath()
  c.moveTo(52, 114); c.lineTo(W - 52, 114)
  c.stroke()

  // ── Layout ────────────────────────────────────────────────────────────────
  const ML = 52, MR = 52
  const MT = 122, MB = 40
  const BPR  = 4                        // bars per row
  const NROWS = Math.ceil(bars.length / BPR)
  const BAR_W = (W - ML - MR) / BPR
  // Scale row height so everything fits on one page
  const ROW_H = Math.min(106, Math.floor((H - MT - MB) / NROWS))
  const CHORD_ZONE  = 38   // px above stave reserved for chord symbols
  const STAVE_OFFSET = CHORD_ZONE

  // ── Assign octaves to guide-tone notes ───────────────────────────────────
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
      const barIdx = row * BPR + col
      if (barIdx >= bars.length) break
      const bar   = bars[barIdx]
      const staveX = ML + col * BAR_W
      const isFirst       = barIdx === 0
      const isFirstInRow  = col === 0
      const isLastBar     = barIdx === bars.length - 1

      // ── Stave ──────────────────────────────────────────────────────────
      const stave = new Stave(staveX, staveY, BAR_W)
      if (isFirst)      stave.addClef("treble").addTimeSignature("4/4")
      else if (isFirstInRow) stave.addClef("treble")
      if (isLastBar) stave.setEndBarType(Barline.type.END)
      stave.setContext(vf).draw()

      // ── Section label (boxed, Real Book style) ────────────────────────
      if (bar.section && bar.section !== prevSection) {
        prevSection = bar.section
        // Shorten long section names: "A (last)" → "A", "Bridge" stays
        const raw   = bar.section.replace(/\s*\(.*\)/g, "").trim()
        const label = raw.length > 7 ? raw.slice(0, 1).toUpperCase() : raw
        const lx    = staveX + (isFirstInRow ? 28 : 6)
        const ly    = rowY + CHORD_ZONE - 3

        c.save()
        c.font = `bold 13px ${HW}`
        c.textAlign = "center"
        c.fillStyle  = "#000"
        c.strokeStyle = "#000"
        c.lineWidth  = 1.5
        const tw = c.measureText(label).width
        c.strokeRect(lx - tw / 2 - 5, ly - 14, tw + 10, 17)
        c.fillText(label, lx, ly)
        c.restore()
      }

      // ── Chord symbol ──────────────────────────────────────────────────
      const chordTxt = rbChord(bar.symbol || "")
      // Offset right enough to clear clef / time sig on first bars
      const chordX = staveX + (isFirst ? 64 : isFirstInRow ? 34 : 9)
      const chordY = rowY + CHORD_ZONE - 3

      c.save()
      c.font = `bold 20px ${HW}`
      c.textAlign = "left"
      c.fillStyle = "#000"
      c.fillText(chordTxt, chordX, chordY)
      c.restore()

      // ── Guide-tone notes ──────────────────────────────────────────────
      const [an, dn] = notePairs[barIdx] || []
      const beats = bar.beats ?? 4

      const makeNote = (noteOct, dur) => {
        if (!noteOct) {
          const rd = dur === "h" ? "hr" : dur === "q" ? "qr" : "wr"
          return new StaveNote({ keys: ["b/4"], duration: rd })
        }
        const key  = toVFKey(noteOct)
        const sn   = new StaveNote({ clef: "treble", keys: [key], duration: dur })
        const acc  = getAcc(noteOct.replace(/\d$/, ""))
        if (acc) sn.addModifier(new Accidental(acc), 0)
        return sn
      }

      let notes
      if (beats >= 4) {
        notes = [makeNote(an, "h"), makeNote(dn, "h")]
      } else {
        // 2-beat bar: single half note
        notes = [makeNote(an, "h")]
      }

      const numBeats = beats >= 4 ? 4 : 2
      const voice = new Voice({ num_beats: numBeats, beat_value: 4 }).setStrict(false)
      voice.addTickables(notes)

      // Leave room for clef/time-sig on the left
      const fmtW = BAR_W - (isFirst ? 74 : isFirstInRow ? 44 : 24)
      new Formatter().joinVoices([voice]).format([voice], fmtW)
      voice.draw(vf, stave)
    }
  }

  // ── Produce PDF ───────────────────────────────────────────────────────────
  const imgData = canvas.toDataURL("image/png", 1.0)
  const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" })
  pdf.addImage(imgData, "PNG", 0, 0, 8.5, 11)

  const safeName = songName
    .replace(/[^A-Z0-9 ]/g, "")
    .trim()
    .replace(/ +/g, "_") || "lead_sheet"
  pdf.save(`${safeName}.pdf`)
}
