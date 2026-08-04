"use client"

import { useMemo, useState } from "react"
import { ROOTS, QUALITIES, buildChordSymbol } from "@/lib/music/tonal"
import { parseGigChord } from "@/lib/music/gigbook"
import { exportLeadSheet, exportMusicXML, groupIntoMeasures } from "@/lib/music/leadsheet"

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
  minHeight: "38px",
  padding: "8px 12px",
  borderRadius: "var(--db-r-md)",
  border: "1px solid var(--db-panel-border)",
  background: "var(--db-card-bg)",
  color: "var(--db-text)",
  cursor: "pointer",
  fontWeight: 700,
}

function newBar(section = "A") {
  return parseGigChord("Cmaj7", section, 4)
}

export default function SongSheet({ draft, onChange, onSave, onOpenPractice, onStartFromChart }) {
  const [dragIndex, setDragIndex] = useState(null)
  const measures = useMemo(() => groupIntoMeasures(draft?.bars || []), [draft?.bars])

  if (!draft) {
    return (
      <div style={{ padding: "18px", border: "1px dashed var(--db-panel-border)", borderRadius: "var(--db-r-md)", textAlign: "center" }}>
        <div style={{ fontWeight: 800, marginBottom: "6px" }}>No SongSheet draft yet</div>
        <div style={{ color: "var(--db-muted)", marginBottom: "14px", lineHeight: 1.5 }}>
          Send a SongCrafter arrangement here, generate a chart above, or begin with the chart currently loaded in DukeBox.
        </div>
        <button type="button" onClick={onStartFromChart} style={{ ...buttonStyle, color: "var(--db-accent)", borderColor: "var(--db-accent)" }}>
          Start from Current Chart
        </button>
      </div>
    )
  }

  const update = (patch) => onChange({ ...draft, ...patch, updatedAt: Date.now() })
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

  function moveBar(from, to) {
    if (to < 0 || to >= draft.bars.length || from === to) return
    const next = [...draft.bars]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    updateBars(next)
  }

  function addBar(afterIndex = draft.bars.length - 1) {
    const section = draft.bars[afterIndex]?.section || draft.bars.at(-1)?.section || "A"
    const next = [...draft.bars]
    next.splice(afterIndex + 1, 0, newBar(section))
    updateBars(next)
  }

  function removeBar(index) {
    if (draft.bars.length <= 1) return
    updateBars(draft.bars.filter((_, i) => i !== index))
  }

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 2fr) minmax(90px, 0.7fr) minmax(110px, 0.8fr) minmax(90px, 0.6fr)", gap: "10px" }} className="songsheet-meta-grid">
        <label style={{ fontSize: "var(--db-fs-sm)", fontWeight: 700 }}>Title
          <input value={draft.title} onChange={(e) => update({ title: e.target.value })} style={{ ...fieldStyle, marginTop: "5px" }} />
        </label>
        <label style={{ fontSize: "var(--db-fs-sm)", fontWeight: 700 }}>Key
          <select value={draft.keyRoot} onChange={(e) => update({ keyRoot: e.target.value })} style={{ ...fieldStyle, marginTop: "5px" }}>
            {ROOTS.map((root) => <option key={root} value={root}>{root}</option>)}
          </select>
        </label>
        <label style={{ fontSize: "var(--db-fs-sm)", fontWeight: 700 }}>Mode
          <select value={draft.keyMode} onChange={(e) => update({ keyMode: e.target.value })} style={{ ...fieldStyle, marginTop: "5px" }}>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
          </select>
        </label>
        <label style={{ fontSize: "var(--db-fs-sm)", fontWeight: 700 }}>Tempo
          <input type="number" min="30" max="360" value={draft.tempo} onChange={(e) => update({ tempo: Math.max(30, Math.min(360, Number(e.target.value) || 30)) })} style={{ ...fieldStyle, marginTop: "5px" }} />
        </label>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
          <strong>Chart Editor</strong>
          <span style={{ color: "var(--db-muted)", fontSize: "var(--db-fs-sm)" }}>{draft.bars.length} chord events · drag cards or use arrows to reorder</span>
          <button type="button" onClick={() => addBar()} style={{ ...buttonStyle, marginLeft: "auto" }}>+ Add Bar</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "10px" }}>
          {draft.bars.map((bar, index) => (
            <div
              key={index}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragIndex != null) moveBar(dragIndex, index); setDragIndex(null) }}
              style={{ padding: "12px", borderRadius: "var(--db-r-md)", border: "1px solid var(--db-card-border)", background: "var(--db-card-bg)" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                <span style={{ color: "var(--db-muted)", fontSize: "var(--db-fs-xs)", fontWeight: 800 }}>BAR {index + 1}</span>
                <button type="button" aria-label={`Move bar ${index + 1} left`} disabled={index === 0} onClick={() => moveBar(index, index - 1)} style={{ ...buttonStyle, minHeight: "30px", padding: "2px 8px", marginLeft: "auto", opacity: index === 0 ? 0.4 : 1 }}>←</button>
                <button type="button" aria-label={`Move bar ${index + 1} right`} disabled={index === draft.bars.length - 1} onClick={() => moveBar(index, index + 1)} style={{ ...buttonStyle, minHeight: "30px", padding: "2px 8px", opacity: index === draft.bars.length - 1 ? 0.4 : 1 }}>→</button>
                <button type="button" aria-label={`Remove bar ${index + 1}`} disabled={draft.bars.length <= 1} onClick={() => removeBar(index)} style={{ ...buttonStyle, minHeight: "30px", padding: "2px 8px", color: "var(--db-c-salmon)", opacity: draft.bars.length <= 1 ? 0.4 : 1 }}>×</button>
              </div>
              <label style={{ display: "block", fontSize: "var(--db-fs-xs)", color: "var(--db-muted)" }}>Chord symbol
                <input value={bar.symbol || ""} onChange={(e) => updateChord(index, e.target.value)} style={{ ...fieldStyle, marginTop: "3px", fontWeight: 800, fontSize: "var(--db-fs-lg)" }} />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr 0.8fr", gap: "6px", marginTop: "8px" }}>
                <label style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-muted)" }}>Root
                  <select value={bar.root || "C"} onChange={(e) => updateChordParts(index, { root: e.target.value })} style={{ ...fieldStyle, marginTop: "3px" }}>
                    {ROOTS.map((root) => <option key={root} value={root}>{root}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-muted)" }}>Quality
                  <select value={bar.quality || "maj7"} onChange={(e) => updateChordParts(index, { quality: e.target.value })} style={{ ...fieldStyle, marginTop: "3px" }}>
                    {QUALITIES.map((quality) => <option key={quality.value} value={quality.value}>{quality.label}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-muted)" }}>Beats
                  <select value={bar.beats ?? 4} onChange={(e) => updateBar(index, { beats: Number(e.target.value) })} style={{ ...fieldStyle, marginTop: "3px" }}>
                    {[1, 2, 3, 4].map((beats) => <option key={beats} value={beats}>{beats}</option>)}
                  </select>
                </label>
              </div>
              <label style={{ display: "block", marginTop: "8px", fontSize: "var(--db-fs-xs)", color: "var(--db-muted)" }}>Section label
                <input value={bar.section || ""} onChange={(e) => updateBar(index, { section: e.target.value })} placeholder="A, Verse, Bridge…" style={{ ...fieldStyle, marginTop: "3px" }} />
              </label>
              <button type="button" onClick={() => addBar(index)} style={{ ...buttonStyle, minHeight: "32px", padding: "4px 9px", marginTop: "8px", fontSize: "var(--db-fs-xs)" }}>+ Insert After</button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
          <strong>Lead Sheet Preview</strong>
          <span style={{ color: "var(--db-muted)", fontSize: "var(--db-fs-sm)" }}>{measures.length} measures</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(90px, 1fr))", gap: "8px", overflowX: "auto" }}>
          {measures.map((measure, index) => (
            <div key={index} style={{ minWidth: "90px", minHeight: "76px", padding: "10px", borderRadius: "var(--db-r-md)", border: "1px solid var(--db-card-border)", background: "var(--db-card-bg)" }}>
              <div style={{ color: "var(--db-muted)", fontSize: "var(--db-fs-xs)", marginBottom: "6px" }}>{measure[0]?.section || ""} · {index + 1}</div>
              <div style={{ display: "flex", justifyContent: "space-around", gap: "8px", fontWeight: 850, fontSize: "var(--db-fs-lg)" }}>
                {measure.map((bar, i) => <span key={i}>{bar.symbol || "?"}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => exportLeadSheet({ bars: draft.bars, title: draft.title, tempo: draft.tempo }).catch(console.error)} style={buttonStyle}>Export Lead Sheet PDF</button>
        <button type="button" onClick={() => exportMusicXML({ bars: draft.bars, title: draft.title, tempo: draft.tempo })} style={buttonStyle}>Export MusicXML</button>
        <button type="button" onClick={() => onOpenPractice(draft)} style={{ ...buttonStyle, marginLeft: "auto", color: "var(--db-accent)", borderColor: "var(--db-accent)" }}>Open in Practice</button>
        <button type="button" onClick={() => onSave(draft)} disabled={!draft.title.trim() || !draft.bars.length} style={{ ...buttonStyle, color: "var(--db-c-green)", borderColor: "var(--db-c-green)", opacity: !draft.title.trim() || !draft.bars.length ? 0.45 : 1 }}>Save to My Library</button>
      </div>

      <style>{`@media (max-width: 760px) { .songsheet-meta-grid { grid-template-columns: 1fr 1fr !important; } }`}</style>
    </div>
  )
}
