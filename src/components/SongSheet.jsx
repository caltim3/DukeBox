"use client"

import { useMemo, useState } from "react"
import { ROOTS, QUALITIES, buildChordSymbol } from "@/lib/music/tonal"
import { parseGigChord } from "@/lib/music/gigbook"
import { exportLeadSheet, exportMusicXML } from "@/lib/music/leadsheet"

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 10px",
  borderRadius: "var(--db-r-md)",
  border: "1px solid var(--db-panel-border)",
  background: "var(--db-input-bg)",
  color: "var(--db-text)",
}

const buttonStyle = {
  minHeight: "36px",
  padding: "7px 11px",
  borderRadius: "var(--db-r-md)",
  border: "1px solid var(--db-panel-border)",
  background: "var(--db-card-bg)",
  color: "var(--db-text)",
  cursor: "pointer",
  fontWeight: 700,
}

const smallButtonStyle = { ...buttonStyle, minHeight: "28px", padding: "2px 8px", fontSize: "var(--db-fs-xs)" }

function newBar(section = "A", symbol = "Cmaj7") {
  return parseGigChord(symbol, section, 4)
}

function makeSections(bars) {
  const sections = []
  bars.forEach((bar, index) => {
    const label = bar.section || sections.at(-1)?.label || "A"
    let section = sections.at(-1)
    if (!section || section.label !== label) {
      section = { label, start: index, bars: [] }
      sections.push(section)
    }
    section.bars.push({ bar, index })
  })

  return sections.map((section) => {
    const measures = []
    let measure = []
    let beats = 0
    section.bars.forEach((item) => {
      const itemBeats = item.bar.beats ?? 4
      if (measure.length && (beats >= 4 || itemBeats >= 4)) {
        measures.push(measure)
        measure = []
        beats = 0
      }
      measure.push(item)
      beats += itemBeats
      if (beats >= 4) {
        measures.push(measure)
        measure = []
        beats = 0
      }
    })
    if (measure.length) measures.push(measure)
    return { ...section, measures }
  })
}

function nextSectionName(sections) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const unused = [...alphabet].find((letter) => !sections.some((section) => section.label === letter))
  return unused || `Section ${sections.length + 1}`
}

function sectionArrays(bars) {
  return makeSections(bars).map((section) => ({
    label: section.label,
    measures: section.measures.map((measure) => measure.map(({ bar }) => ({ ...bar }))),
  }))
}

function flattenSections(sections) {
  return sections.flatMap((section) => section.measures.flatMap((measure) =>
    measure.map((bar) => ({ ...bar, section: section.label }))))
}

export default function SongSheet({ draft, onChange, onSave, onOpenPractice, onStartFromChart }) {
  const [draggedMeasure, setDraggedMeasure] = useState(null)
  const [draggedSection, setDraggedSection] = useState(null)
  const [newSectionLabel, setNewSectionLabel] = useState("")
  const sections = useMemo(() => makeSections(draft?.bars || []), [draft?.bars])
  const measureCount = useMemo(() => sections.reduce((sum, section) => sum + section.measures.length, 0), [sections])

  if (!draft) {
    return (
      <div style={{ padding: "18px", border: "1px dashed var(--db-panel-border)", borderRadius: "var(--db-r-md)", textAlign: "center" }}>
        <div style={{ fontWeight: 800, marginBottom: "6px" }}>No SongSheet draft yet</div>
        <div style={{ color: "var(--db-muted)", marginBottom: "14px", lineHeight: 1.5 }}>
          Generate a chart above, send in a SongCrafter arrangement, or begin with the chart currently loaded in DukeBox.
        </div>
        <button type="button" onClick={onStartFromChart} style={{ ...buttonStyle, color: "var(--db-accent)", borderColor: "var(--db-accent)" }}>
          Start from Current Chart
        </button>
      </div>
    )
  }

  const update = (patch) => onChange({ ...draft, ...patch })
  const updateBars = (bars) => update({ bars })
  const updateBar = (index, patch) => updateBars(draft.bars.map((bar, i) => i === index ? { ...bar, ...patch } : bar))

  function updateChord(index, symbol) {
    const current = draft.bars[index]
    const parsed = parseGigChord(symbol, current.section || "A", current.beats ?? 4)
    updateBar(index, parsed ? { ...parsed, section: current.section || "A", beats: current.beats ?? 4 } : { symbol })
  }

  function updateChordParts(index, patch) {
    const current = draft.bars[index]
    const root = patch.root ?? current.root ?? "C"
    const quality = patch.quality ?? current.quality ?? "maj7"
    updateBar(index, { ...patch, root, quality, symbol: buildChordSymbol(root, quality) })
  }

  function addSection() {
    const label = newSectionLabel.trim() || nextSectionName(sections)
    updateBars([...draft.bars, newBar(label)])
    setNewSectionLabel("")
  }

  function renameSection(sectionIndex, label) {
    const next = sectionArrays(draft.bars)
    next[sectionIndex].label = label || `Section ${sectionIndex + 1}`
    updateBars(flattenSections(next))
  }

  function moveSection(from, to) {
    if (from === to || to < 0 || to >= sections.length) return
    const next = sectionArrays(draft.bars)
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    updateBars(flattenSections(next))
  }

  function duplicateSection(sectionIndex) {
    const next = sectionArrays(draft.bars)
    const source = next[sectionIndex]
    const copy = {
      label: `${source.label} copy`,
      measures: source.measures.map((measure) => measure.map((bar) => ({ ...bar }))),
    }
    next.splice(sectionIndex + 1, 0, copy)
    updateBars(flattenSections(next))
  }

  function removeSection(sectionIndex) {
    if (sections.length <= 1) return
    const next = sectionArrays(draft.bars)
    next.splice(sectionIndex, 1)
    updateBars(flattenSections(next))
  }

  function addMeasure(sectionIndex, afterMeasure = null) {
    const next = sectionArrays(draft.bars)
    const section = next[sectionIndex]
    const insertAt = afterMeasure == null ? section.measures.length : afterMeasure + 1
    const previous = section.measures[Math.max(0, insertAt - 1)]?.[0]
    section.measures.splice(insertAt, 0, [newBar(section.label, previous?.symbol || "Cmaj7")])
    updateBars(flattenSections(next))
  }

  function removeMeasure(sectionIndex, measureIndex) {
    if (measureCount <= 1) return
    const next = sectionArrays(draft.bars)
    next[sectionIndex].measures.splice(measureIndex, 1)
    if (!next[sectionIndex].measures.length) next.splice(sectionIndex, 1)
    updateBars(flattenSections(next))
  }

  function addHalfBar(sectionIndex, measureIndex) {
    const next = sectionArrays(draft.bars)
    const measure = next[sectionIndex].measures[measureIndex]
    if (measure.length !== 1) return
    measure[0] = { ...measure[0], beats: 2 }
    measure.push({ ...measure[0] })
    updateBars(flattenSections(next))
  }

  function removeHalfBar(sectionIndex, measureIndex, chordIndex) {
    const next = sectionArrays(draft.bars)
    const measure = next[sectionIndex].measures[measureIndex]
    if (measure.length <= 1) return
    measure.splice(chordIndex, 1)
    measure[0] = { ...measure[0], beats: 4 }
    updateBars(flattenSections(next))
  }

  function moveMeasure(from, to) {
    if (!from || !to || (from.sectionIndex === to.sectionIndex && from.measureIndex === to.measureIndex)) return
    const next = sectionArrays(draft.bars)
    if (from.sectionIndex === to.sectionIndex) {
      const measures = next[from.sectionIndex].measures
      if (to.measureIndex >= measures.length) {
        const [moved] = measures.splice(from.measureIndex, 1)
        measures.push(moved)
      } else {
        ;[measures[from.measureIndex], measures[to.measureIndex]] = [measures[to.measureIndex], measures[from.measureIndex]]
      }
      updateBars(flattenSections(next))
      return
    }
    const source = next[from.sectionIndex]
    const target = next[to.sectionIndex]
    const [moved] = source.measures.splice(from.measureIndex, 1)
    target.measures.splice(to.measureIndex, 0, moved.map((bar) => ({ ...bar, section: target.label })))
    if (!source.measures.length) next.splice(from.sectionIndex, 1)
    updateBars(flattenSections(next))
  }

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <div className="songsheet-meta-grid" style={{ display: "grid", gridTemplateColumns: "minmax(220px, 2fr) minmax(90px, 0.7fr) minmax(110px, 0.8fr) minmax(90px, 0.6fr)", gap: "10px" }}>
        <label style={{ fontSize: "var(--db-fs-sm)", fontWeight: 700 }}>Title
          <input value={draft.title} onChange={(event) => update({ title: event.target.value })} style={{ ...fieldStyle, marginTop: "5px" }} />
        </label>
        <label style={{ fontSize: "var(--db-fs-sm)", fontWeight: 700 }}>Key
          <select value={draft.keyRoot} onChange={(event) => update({ keyRoot: event.target.value })} style={{ ...fieldStyle, marginTop: "5px" }}>
            {ROOTS.map((root) => <option key={root} value={root}>{root}</option>)}
          </select>
        </label>
        <label style={{ fontSize: "var(--db-fs-sm)", fontWeight: 700 }}>Mode
          <select value={draft.keyMode} onChange={(event) => update({ keyMode: event.target.value })} style={{ ...fieldStyle, marginTop: "5px" }}>
            <option value="major">Major</option><option value="minor">Minor</option>
          </select>
        </label>
        <label style={{ fontSize: "var(--db-fs-sm)", fontWeight: 700 }}>Tempo
          <input type="number" min="30" max="360" value={draft.tempo} onChange={(event) => update({ tempo: Math.max(30, Math.min(360, Number(event.target.value) || 30)) })} style={{ ...fieldStyle, marginTop: "5px" }} />
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <strong>Lead Sheet Editor</strong>
        <span style={{ color: "var(--db-muted)", fontSize: "var(--db-fs-sm)" }}>{sections.length} sections · {measureCount} measures · drag sections or measures to arrange</span>
        <div style={{ display: "flex", gap: "6px", marginLeft: "auto" }}>
          <input value={newSectionLabel} onChange={(event) => setNewSectionLabel(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addSection() }} placeholder={nextSectionName(sections)} aria-label="New section name" style={{ ...fieldStyle, width: "130px", padding: "7px 9px" }} />
          <button type="button" onClick={addSection} style={{ ...buttonStyle, color: "var(--db-c-green)", borderColor: "var(--db-c-green)" }}>+ Section</button>
        </div>
      </div>

      <div style={{ display: "grid", gap: "12px" }}>
        {sections.map((section, sectionIndex) => (
          <section
            key={`${section.label}-${section.start}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              if (draggedMeasure) moveMeasure(draggedMeasure, { sectionIndex, measureIndex: section.measures.length })
              else if (draggedSection != null) moveSection(draggedSection, sectionIndex)
              setDraggedMeasure(null)
              setDraggedSection(null)
            }}
            style={{ padding: "12px", borderRadius: "var(--db-r-md)", border: "1px solid var(--db-panel-border)", background: "color-mix(in srgb, var(--db-panel-bg) 88%, var(--db-accent) 12%)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "10px", flexWrap: "wrap" }}>
              <span draggable onDragStart={() => setDraggedSection(sectionIndex)} title="Drag section" aria-hidden="true" style={{ color: "var(--db-muted)", cursor: "grab", fontSize: "1.1rem" }}>⠿</span>
              <input defaultValue={section.label} onBlur={(event) => renameSection(sectionIndex, event.target.value.trim())} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur() }} aria-label={`Section ${sectionIndex + 1} name`} style={{ ...fieldStyle, width: "150px", padding: "6px 9px", color: "var(--db-accent)", fontWeight: 850 }} />
              <span style={{ color: "var(--db-muted)", fontSize: "var(--db-fs-xs)" }}>{section.measures.length} measures</span>
              <div style={{ display: "flex", gap: "4px", marginLeft: "auto" }}>
                <button type="button" disabled={sectionIndex === 0} onClick={() => moveSection(sectionIndex, sectionIndex - 1)} style={{ ...smallButtonStyle, opacity: sectionIndex === 0 ? 0.4 : 1 }} aria-label={`Move ${section.label} earlier`}>←</button>
                <button type="button" disabled={sectionIndex === sections.length - 1} onClick={() => moveSection(sectionIndex, sectionIndex + 1)} style={{ ...smallButtonStyle, opacity: sectionIndex === sections.length - 1 ? 0.4 : 1 }} aria-label={`Move ${section.label} later`}>→</button>
                <button type="button" onClick={() => duplicateSection(sectionIndex)} style={smallButtonStyle}>Duplicate</button>
                <button type="button" onClick={() => removeSection(sectionIndex)} disabled={sections.length <= 1} style={{ ...smallButtonStyle, color: "var(--db-c-salmon)", opacity: sections.length <= 1 ? 0.4 : 1 }}>Delete</button>
              </div>
            </div>

            <div className="songsheet-measure-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(210px, 1fr))", gap: "9px", overflowX: "auto" }}>
              {section.measures.map((measure, measureIndex) => (
                <div
                  key={`${section.start}-${measure[0].index}`}
                  data-measure
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => { event.stopPropagation(); event.preventDefault(); moveMeasure(draggedMeasure, { sectionIndex, measureIndex }); setDraggedMeasure(null) }}
                  style={{ minWidth: "210px", padding: "10px", borderRadius: "var(--db-r-md)", border: "1px solid var(--db-card-border)", background: "var(--db-card-bg)", boxShadow: draggedMeasure?.sectionIndex === sectionIndex && draggedMeasure?.measureIndex === measureIndex ? "0 0 0 2px var(--db-accent)" : "none" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "8px" }}>
                    <span draggable onDragStart={(event) => { event.stopPropagation(); setDraggedMeasure({ sectionIndex, measureIndex }) }} title="Drag measure" aria-hidden="true" style={{ color: "var(--db-muted)", cursor: "grab" }}>⠿</span>
                    <span style={{ color: "var(--db-muted)", fontSize: "var(--db-fs-xs)", fontWeight: 800 }}>MEASURE {measureIndex + 1}</span>
                    <button type="button" onClick={() => addMeasure(sectionIndex, measureIndex)} title="Insert a measure after this one" style={{ ...smallButtonStyle, marginLeft: "auto" }}>+</button>
                    <button type="button" onClick={() => removeMeasure(sectionIndex, measureIndex)} disabled={measureCount <= 1} title="Delete measure" style={{ ...smallButtonStyle, color: "var(--db-c-salmon)", opacity: measureCount <= 1 ? 0.4 : 1 }}>×</button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${measure.length}, minmax(0, 1fr))`, gap: "6px" }}>
                    {measure.map(({ bar, index }, chordIndex) => (
                      <div key={index} style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "5px" }}>
                          <input value={bar.symbol || ""} onChange={(event) => updateChord(index, event.target.value)} aria-label={`Measure ${measureIndex + 1} chord ${chordIndex + 1}`} style={{ ...fieldStyle, minWidth: 0, padding: "6px 7px", color: "var(--db-text)", fontWeight: 850, fontSize: "var(--db-fs-lg)" }} />
                          {measure.length > 1 && <button type="button" onClick={() => removeHalfBar(sectionIndex, measureIndex, chordIndex)} title="Remove this half-bar chord" style={{ ...smallButtonStyle, color: "var(--db-c-salmon)", padding: "2px 6px" }}>×</button>}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: "4px" }}>
                          <select value={bar.root || "C"} onChange={(event) => updateChordParts(index, { root: event.target.value })} aria-label="Chord root" style={{ ...fieldStyle, padding: "5px" }}>
                            {ROOTS.map((root) => <option key={root} value={root}>{root}</option>)}
                          </select>
                          <select value={bar.quality || "maj7"} onChange={(event) => updateChordParts(index, { quality: event.target.value })} aria-label="Chord quality" style={{ ...fieldStyle, padding: "5px" }}>
                            {QUALITIES.map((quality) => <option key={quality.value} value={quality.value}>{quality.label}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                  {measure.length === 1 && <button type="button" onClick={() => addHalfBar(sectionIndex, measureIndex)} style={{ ...smallButtonStyle, width: "100%", marginTop: "7px", borderStyle: "dashed", color: "var(--db-muted)" }}>+ second chord</button>}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => addMeasure(sectionIndex)} style={{ ...buttonStyle, width: "100%", marginTop: "9px", borderStyle: "dashed", color: "var(--db-c-green)" }}>+ Add measure to {section.label}</button>
          </section>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => exportLeadSheet({ bars: draft.bars, title: draft.title, tempo: draft.tempo }).catch(console.error)} style={buttonStyle}>Export Lead Sheet PDF</button>
        <button type="button" onClick={() => exportMusicXML({ bars: draft.bars, title: draft.title, tempo: draft.tempo })} style={buttonStyle}>Export MusicXML</button>
        <button type="button" onClick={() => onOpenPractice(draft)} style={{ ...buttonStyle, marginLeft: "auto", color: "var(--db-accent)", borderColor: "var(--db-accent)" }}>Open in Practice</button>
        <button type="button" onClick={() => onSave(draft)} disabled={!draft.title.trim() || !draft.bars.length} style={{ ...buttonStyle, color: "var(--db-c-green)", borderColor: "var(--db-c-green)", opacity: !draft.title.trim() || !draft.bars.length ? 0.45 : 1 }}>Save to Song Library</button>
      </div>

      <style>{`
        @media (max-width: 900px) { .songsheet-measure-grid { grid-template-columns: repeat(2, minmax(210px, 1fr)) !important; } }
        @media (max-width: 760px) { .songsheet-meta-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 520px) { .songsheet-measure-grid, .songsheet-meta-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
