"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { lineNoteMidi } from "@/lib/music/lines"

const TAB_TUNING = ["E,", "A,", "D", "G", "B", "e"]
const PC_ABC = ["C", "_D", "D", "_E", "E", "F", "_G", "G", "_A", "A", "_B", "B"]
const OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 }
const TAB_STRING_STEP = 3 * (30 * 93 / 720) // ABCJS: linePitch 3 × spacing.STEP

function midiToAbc(midi) {
  const pc = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  const pitch = PC_ABC[pc]
  const accidental = pitch.length > 1 ? pitch[0] : ""
  const letter = pitch[pitch.length - 1]
  if (octave >= 5) return `${accidental}${letter.toLowerCase()}${"'".repeat(Math.max(0, octave - 5))}`
  return `${accidental}${letter}${",".repeat(Math.max(0, 4 - octave))}`
}

function durationUnits(beats) {
  const units = Math.max(0, Number(beats) || 0) * 2
  if (Math.abs(units - 1) < 0.001) return ""
  if (Math.abs(units - Math.round(units)) < 0.001) return String(Math.round(units))
  const thirds = Math.round(units * 3)
  if (Math.abs(units - thirds / 3) < 0.001) return `${thirds}/3`
  const halves = Math.round(units * 2)
  if (Math.abs(units - halves / 2) < 0.001) return halves === 1 ? "/" : `${halves}/2`
  return `*${units.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}`
}

function lineToAbcNotes(line) {
  return (line?.bars || []).map((bar) => {
    const chord = String(bar.c || "").trim()
    const chordToken = chord ? `"${chord.replaceAll('"', "")}"` : ""
    const notes = bar.n || []
    const tokens = []
    let tripletLeft = 0

    notes.forEach((note, index) => {
      const [s, f, dur = 0.5, wait = 0] = note
      if (Number(wait) > 0) tokens.push(`z${durationUnits(wait)}`)

      const isTriplet = Math.abs(Number(dur) - 1 / 3) < 0.01
      if (!tripletLeft && isTriplet) {
        const next = notes.slice(index, index + 3)
        if (next.length === 3 && next.every((n) => Math.abs(Number(n[2]) - 1 / 3) < 0.01 && Number(n[3] || 0) === 0)) {
          tokens.push("(3")
          tripletLeft = 3
        }
      }

      const midi = lineNoteMidi(Number(s), Number(f))
      // Guitar notation sounds an octave below written pitch. ABCJS's guitar
      // TAB follows that convention, so write generated line events +12 here.
      tokens.push(`${midiToAbc(midi + 12)}${tripletLeft ? "" : durationUnits(dur)}`)
      if (tripletLeft) tripletLeft -= 1
    })

    if (Number(bar.tailRest) > 0) tokens.push(`z${durationUnits(bar.tailRest)}`)
    return `${chordToken}${tokens.join(" ")} |`
  }).join("\n") + "]"
}

function fullAbc(line, tempo) {
  const body = line?.notationAbc || lineToAbcNotes(line)
  return `X:1\nM:4/4\nL:1/8\nQ:1/4=${tempo}\nK:C\n${body}\n`
}

export default function LineNotation({ line, tempo = 120, activeIndex = -1, compact = false }) {
  const hostRef = useRef(null)
  const [abcjs, setAbcjs] = useState(null)
  const [renderError, setRenderError] = useState(false)
  const abc = useMemo(() => fullAbc(line, tempo), [line, tempo])
  const explicitTab = useMemo(
    () => (!line?.notationAbc || line?.tabFingeringOverride)
      ? (line?.bars || []).flatMap((bar) => (bar.n || []).map(([s, f]) => ({ s: Number(s), f: Number(f) })))
      : null,
    [line]
  )

  useEffect(() => {
    let cancelled = false
    import("abcjs")
      .then((mod) => { if (!cancelled) setAbcjs(mod.default || mod) })
      .catch(() => { if (!cancelled) setRenderError(true) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!abcjs || !hostRef.current) return
    setRenderError(false)
    try {
      hostRef.current.innerHTML = ""
      abcjs.renderAbc(hostRef.current, abc, {
        responsive: "resize",
        staffwidth: compact ? 390 : 760,
        paddingtop: 4,
        paddingbottom: 4,
        paddingleft: 4,
        paddingright: 6,
        add_classes: true,
        visualTranspose: Number(line?.notationTranspose) || 0,
        tablature: [{ instrument: "guitar", tuning: TAB_TUNING }],
      })

      // ABCJS owns the engraving, spacing, rhythm, and TAB staff. For lines
      // with an explicit DukeBox fingering, replace only each generated TAB
      // number's string/fret placement. This is what makes a neck-position
      // choice visible without changing the musical pitch.
      if (explicitTab?.length) {
        const tabNotes = Array.from(hostRef.current.querySelectorAll(".abcjs-tab-number"))
        tabNotes.forEach((node, index) => {
          const target = explicitTab[index]
          if (!target) return
          const midi = lineNoteMidi(target.s, target.f)
          let autoString = 6
          for (let s = 1; s <= 6; s++) {
            if (midi >= OPEN_MIDI[s]) { autoString = s; break }
          }
          const originalY = Number(node.getAttribute("y"))
          if (Number.isFinite(originalY)) node.setAttribute("y", String(originalY + (target.s - autoString) * TAB_STRING_STEP))
          node.textContent = String(target.f)
        })
      }
    } catch {
      setRenderError(true)
    }
  }, [abcjs, abc, compact, line?.notationTranspose, explicitTab])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const staffNotes = Array.from(host.querySelectorAll(".abcjs-note"))
    staffNotes.forEach((node, index) => node.classList.toggle("db-abc-active", index === activeIndex))
    const tabNotes = Array.from(host.querySelectorAll(".abcjs-tab-number"))
    tabNotes.forEach((node, index) => node.classList.toggle("db-abc-active", index === activeIndex))
  }, [activeIndex, abcjs, abc])

  return (
    <div className="db-line-notation" style={{
      overflowX: "auto",
      border: "1px solid var(--db-panel-border)",
      borderRadius: "var(--db-r-md)",
      background: "var(--db-card-bg)",
      minHeight: compact ? "150px" : "180px",
    }}>
      <div ref={hostRef} role="img" aria-label="Standard notation and guitar tablature for this line" />
      {!abcjs && !renderError && <div style={{ padding: "18px", color: "var(--db-muted)", fontSize: "var(--db-fs-xs)" }}>Loading notation...</div>}
      {renderError && <div style={{ padding: "18px", color: "var(--db-muted)", fontSize: "var(--db-fs-xs)" }}>Notation could not be rendered.</div>}
      <style jsx global>{`
        .db-line-notation svg { color: var(--db-text); }
        .db-line-notation .abcjs-note.db-abc-active,
        .db-line-notation .abcjs-note.db-abc-active *,
        .db-line-notation .abcjs-tab-number.db-abc-active,
        .db-line-notation .abcjs-tab-number.db-abc-active * {
          fill: var(--db-c-salmon, var(--db-accent)) !important;
          stroke: var(--db-c-salmon, var(--db-accent)) !important;
        }
      `}</style>
    </div>
  )
}
