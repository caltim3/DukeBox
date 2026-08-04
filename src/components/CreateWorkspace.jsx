"use client"

import LineLab from "@/components/LineLab"
import SongCrafter from "@/components/SongCrafter"

export default function CreateWorkspace({
  bars,
  selectedForm,
  originalTempo,
  onLoadSong,
  stopPlayback,
  playLineSection,
  panelStyle,
  eyebrowStyle,
  selectStyle,
}) {
  return (
    <div style={{ display: "grid", gap: "16px", marginBottom: "20px" }}>
      <details open style={panelStyle}>
        <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: "10px", fontWeight: 800 }}>
          <span aria-hidden="true" style={{ fontSize: "1.35rem", color: "var(--db-c-purple)" }}>＋</span>
          <span style={{ fontSize: "var(--db-fs-lg)", letterSpacing: "0.06em", color: "var(--db-c-purple)" }}>AI CHART GENERATOR</span>
          <span style={{ fontSize: "var(--db-fs-sm)", opacity: 0.55, fontWeight: 400 }}>Build a new chart from a description in Practice, then return here to develop it</span>
        </summary>
        <div style={{ marginTop: "14px", fontSize: "var(--db-fs-sm)", opacity: 0.7, lineHeight: 1.5 }}>
          The live AI chart generator remains connected to the current chart and library. Open Practice to generate, edit, and save a chart, then use Create for SongCrafter, SongSheet, and Line Lab development.
        </div>
      </details>

      <SongCrafter
        onSendToChart={({ bars: craftedBars, keyRoot, keyMode, title }) =>
          onLoadSong({
            bars: craftedBars,
            keyRoot,
            keyMode,
            tempo: originalTempo,
            autoplay: false,
            songId: null,
            title,
            toMode: "create",
          })
        }
        panelStyle={panelStyle}
        eyebrowStyle={eyebrowStyle}
        selectStyle={selectStyle}
      />

      <details open style={panelStyle}>
        <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: "10px", fontWeight: 800 }}>
          <span aria-hidden="true" style={{ fontSize: "1.35rem", color: "var(--db-c-amber)" }}>＋</span>
          <span style={{ fontSize: "var(--db-fs-lg)", letterSpacing: "0.06em", color: "var(--db-c-amber)" }}>SONGSHEET</span>
          <span style={{ fontSize: "var(--db-fs-sm)", opacity: 0.55, fontWeight: 400 }}>Develop the current chart into a lead sheet and library-ready song</span>
        </summary>
        <div style={{ marginTop: "14px" }}>
          <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.7, marginBottom: "10px" }}>
            Current draft: <strong>{selectedForm || "Custom"}</strong> · {bars.length} bars. SongSheet is the staging area for melody, lyrics, form notes, lead-sheet preview, and final JSON-library export.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px" }}>
            {bars.map((bar, index) => (
              <div key={index} style={{ padding: "10px", borderRadius: "var(--db-r-md)", border: "1px solid var(--db-card-border)", background: "var(--db-card-bg)" }}>
                <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.55 }}>BAR {index + 1}</div>
                <div style={{ fontSize: "var(--db-fs-lg)", fontWeight: 800 }}>{bar.symbol}</div>
                <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.65 }}>{bar.section || "Section"}</div>
              </div>
            ))}
          </div>
        </div>
      </details>

      <details style={panelStyle}>
        <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: "10px", fontWeight: 800 }}>
          <span aria-hidden="true" style={{ fontSize: "1.35rem", color: "var(--db-c-green)" }}>＋</span>
          <span style={{ fontSize: "var(--db-fs-lg)", letterSpacing: "0.06em", color: "var(--db-c-green)" }}>LINE LAB</span>
          <span style={{ fontSize: "var(--db-fs-sm)", opacity: 0.55, fontWeight: 400 }}>Generate and practice single-note lines over the draft</span>
        </summary>
        <LineLab
          chartBars={bars}
          chartTitle={selectedForm}
          onStopPlayback={stopPlayback}
          playLineSection={playLineSection}
          panelStyle={{ ...panelStyle, margin: "14px 0 0" }}
          eyebrowStyle={eyebrowStyle}
          selectStyle={selectStyle}
        />
      </details>
    </div>
  )
}
