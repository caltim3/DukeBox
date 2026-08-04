"use client"

import { useState } from "react"
import LineLab from "@/components/LineLab"
import SongCrafter from "@/components/SongCrafter"
import SongSheet from "@/components/SongSheet"

const neutralButton = {
  padding: "8px 12px",
  borderRadius: "var(--db-r-md)",
  border: "1px solid var(--db-panel-border)",
  background: "var(--db-card-bg)",
  color: "var(--db-text)",
  cursor: "pointer",
  fontWeight: 700,
}

function Section({ title, subtitle, color, panelStyle, open = false, children }) {
  const [expanded, setExpanded] = useState(open)
  return (
    <details open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)} style={panelStyle}>
      <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: "10px", fontWeight: 800, flexWrap: "wrap" }}>
        <span aria-hidden="true" style={{ fontSize: "1.35rem", color }}>＋</span>
        <span style={{ fontSize: "var(--db-fs-lg)", letterSpacing: "0.06em", color }}>{title}</span>
        <span style={{ fontSize: "var(--db-fs-sm)", color: "var(--db-muted)", fontWeight: 400 }}>{subtitle}</span>
      </summary>
      <div style={{ marginTop: "14px" }}>{children}</div>
    </details>
  )
}

function ChartGenerator({ generator, selectStyle }) {
  const {
    promptText, setPromptText, isGenerating, generationNotes, generationError,
    showGenNotes, setShowGenNotes, lastGenChart, handleGenerateChart, surpriseMe,
    saveToLibrary, promptHistory, promptTemplates,
  } = generator

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", flexWrap: "wrap" }}>
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerateChart() }}
          placeholder={'Describe the chart you want, for example: "12-bar minor blues in F with a backdoor dominant"'}
          disabled={isGenerating}
          style={{
            flex: "1 1 560px", minHeight: "76px", padding: "12px", resize: "vertical",
            borderRadius: "var(--db-r-md)", border: "1px solid var(--db-panel-border)",
            background: "var(--db-input-bg)", color: "var(--db-text)", fontSize: "var(--db-fs-md)",
            fontFamily: "Arial, sans-serif", lineHeight: 1.5,
          }}
        />
        <button type="button" onClick={() => handleGenerateChart()} disabled={isGenerating || !promptText.trim()} style={{ ...neutralButton, padding: "12px 18px", color: "var(--db-c-purple)", borderColor: "var(--db-c-purple)", opacity: isGenerating || !promptText.trim() ? 0.5 : 1 }}>
          {isGenerating ? "Generating…" : "Generate"}
        </button>
      </div>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", marginTop: "8px" }}>
        <button type="button" onClick={surpriseMe} disabled={isGenerating} style={{ ...neutralButton, padding: "5px 11px", color: "var(--db-c-purple)" }}>🎲 Surprise Me</button>
        {promptTemplates.map((template) => (
          <button type="button" key={template} onClick={() => setPromptText(template)} disabled={isGenerating} style={{ ...neutralButton, padding: "5px 10px", fontSize: "var(--db-fs-xs)" }}>
            {template.length > 38 ? `${template.slice(0, 37)}…` : template}
          </button>
        ))}
      </div>
      {promptHistory.length > 0 && (
        <select value="" onChange={(e) => { if (e.target.value) setPromptText(e.target.value) }} style={{ ...selectStyle, marginTop: "8px", width: "100%" }} aria-label="Recent chart prompts">
          <option value="">Re-use a recent prompt…</option>
          {promptHistory.map((prompt, index) => <option key={index} value={prompt}>{prompt}</option>)}
        </select>
      )}
      {generationError && <div role="alert" style={{ marginTop: "10px", color: "var(--db-c-salmon)", fontSize: "var(--db-fs-sm)" }}>{generationError}</div>}
      {(generationNotes || isGenerating) && (
        <div style={{ marginTop: "10px" }}>
          <button type="button" onClick={() => setShowGenNotes((open) => !open)} style={{ background: "none", border: 0, color: "var(--db-c-purple)", cursor: "pointer", padding: 0 }}>
            {showGenNotes ? "▼" : "▶"} Generation Notes
          </button>
          {showGenNotes && <div style={{ marginTop: "6px", padding: "10px 12px", background: "color-mix(in srgb, var(--db-c-purple) 8%, transparent)", borderRadius: "var(--db-r-md)" }}>{generationNotes || "Writing…"}</div>}
        </div>
      )}
      {lastGenChart && <button type="button" onClick={saveToLibrary} style={{ ...neutralButton, marginTop: "10px", color: "var(--db-c-green)", borderColor: "var(--db-c-green)" }}>+ Add to My Library</button>}
    </div>
  )
}

export default function CreateWorkspace({
  generator,
  songSheetDraft,
  onDraftChange,
  onDraftSave,
  onDraftOpenPractice,
  onStartDraft,
  onSongCrafted,
  originalTempo,
  stopPlayback,
  playLineSection,
  panelStyle,
  eyebrowStyle,
  selectStyle,
}) {
  const workingBars = songSheetDraft?.bars || generator.chartBars
  const workingTitle = songSheetDraft?.title || generator.chartTitle

  return (
    <div style={{ display: "grid", gap: "16px", marginBottom: "20px" }}>
      <Section title="AI CHART GENERATOR" subtitle="Build a chart from a description" color="var(--db-c-purple)" panelStyle={panelStyle} open>
        <ChartGenerator generator={generator} selectStyle={selectStyle} />
      </Section>

      <Section title="SONGCRAFTER" subtitle="Assemble progressions and send them into an editable draft" color="var(--db-c-gold)" panelStyle={panelStyle}>
        <SongCrafter
          onSendToChart={({ bars, keyRoot, keyMode, title, tempo }) => onSongCrafted({
            bars, keyRoot, keyMode, title,
            tempo: tempo || originalTempo,
          })}
          panelStyle={{ ...panelStyle, margin: 0, padding: 0, border: 0, background: "transparent" }}
          eyebrowStyle={eyebrowStyle}
          selectStyle={selectStyle}
        />
      </Section>

      <Section title="SONGSHEET" subtitle="Arrange sections and measures into a library-ready lead sheet" color="var(--db-c-amber)" panelStyle={panelStyle} open>
        <SongSheet
          draft={songSheetDraft}
          onChange={onDraftChange}
          onSave={onDraftSave}
          onOpenPractice={onDraftOpenPractice}
          onStartFromChart={onStartDraft}
        />
      </Section>

      <Section title="LINE LAB" subtitle="Develop single-note lines over the active draft" color="var(--db-c-green)" panelStyle={panelStyle}>
        <LineLab
          chartBars={workingBars}
          chartTitle={workingTitle}
          onStopPlayback={stopPlayback}
          playLineSection={playLineSection}
          panelStyle={{ ...panelStyle, margin: 0 }}
          eyebrowStyle={eyebrowStyle}
          selectStyle={selectStyle}
        />
      </Section>
    </div>
  )
}
