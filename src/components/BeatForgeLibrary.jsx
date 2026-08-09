"use client"

// BeatForge Library — the Rhythm Shed's 30-pattern library, split out into
// its own collapsible panel (a sibling of BeatForge Metronome) so it can roll
// open independently. Tapping a card hands the pattern to the SAME playback
// engine the generator uses (via onLoad → MetronomePanel → RhythmShed's
// apiRef.loadPattern) — beats can come from either the creation engine or a
// selected library pattern, both playing through one Start/Stop.

import { useEffect, useRef } from "react"
import { LIB, LIB_SECTIONS, clone, renderMeasure, SHED_CSS } from "@/lib/music/rhythmShed"

export default function BeatForgeLibrary({ loadedNum, onLoad }) {
  const gridRefs = useRef({})

  // Build the manuscript cards once
  useEffect(() => {
    Object.values(gridRefs.current).forEach((grid) => { if (grid) grid.innerHTML = "" })
    LIB.forEach((p, k) => {
      const num = k + 1
      const grid = gridRefs.current[p.s]
      if (!grid) return
      const card = document.createElement("div")
      card.className = "rs-libcard"
      card.dataset.num = num
      const flat = p.cells.flatMap((c) => clone(c))
      renderMeasure(card, flat, "BL" + k, null, true)
      const cap = document.createElement("div")
      cap.className = "rs-cap"
      cap.innerHTML = `<span class="rs-num">${num}</span><span>${p.n}</span>`
      card.appendChild(cap)
      card.addEventListener("click", () => onLoad?.({ ...p, num }))
      grid.appendChild(card)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Loaded-card outline follows state
  useEffect(() => {
    document.querySelectorAll(".rs-libcard.loaded").forEach((x) => x.classList.remove("loaded"))
    if (loadedNum != null) {
      const card = document.querySelector(`.rs-libcard[data-num="${loadedNum}"]`)
      if (card) card.classList.add("loaded")
    }
  }, [loadedNum])

  return (
    <div>
      <style>{SHED_CSS}</style>
      <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.6, marginBottom: "12px" }}>
        Tap any card to load it into the Rhythm Shed engine — it repeats across the current bar count and
        changes, and starts playing with your tempo, swing, and click settings.
      </div>
      {LIB_SECTIONS.map((sec) => (
        <div key={sec.s} style={{ marginBottom: "14px" }}>
          <div style={{ fontWeight: 800, fontSize: "var(--db-fs-md)", margin: "0 2px 2px" }}>
            <span style={{ color: "var(--db-c-amber)", marginRight: "6px" }}>{sec.rn}</span>{sec.title}
          </div>
          <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, margin: "0 2px 8px" }}>{sec.desc}</div>
          <div className="rs-libgrid" ref={(node) => { gridRefs.current[sec.s] = node }} />
        </div>
      ))}
    </div>
  )
}
