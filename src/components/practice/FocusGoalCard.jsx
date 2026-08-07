"use client"

// Focus goal card (spec §5.1/§5.2). The focus text is display-only for v3
// per spec §6 — hardcoded, not backed by Supabase or any new state. The
// Free/Guided/Drill picker is the same: a visual placeholder for a future
// drill-mode feature, purely local, not wired to playback.

import { useState } from "react"

export default function FocusGoalCard({ loopsDone = 87, timerLabel = "0:00", hits = 42, targetNotes = [] }) {
  const [drillMode, setDrillMode] = useState("Free")

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", padding: "16px" }}>
      <h4 style={{ font: "800 11px 'Archivo', sans-serif", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 10px" }}>
        Today&rsquo;s focus
      </h4>
      <div style={{ font: "700 18px 'Instrument Sans', sans-serif", lineHeight: 1.25, marginBottom: "8px" }}>
        Approach the <em style={{ color: "var(--info)", fontStyle: "normal" }}>3rd</em> of every dominant chord from a half-step below
      </div>
      <div style={{ fontSize: "12.5px", color: "var(--muted)", lineHeight: 1.5, marginBottom: "12px" }}>
        Land the target tone on beat 1, approached chromatically from below. Keep the phrase eighth-note driven — no rest until the target lands.
      </div>

      {targetNotes.length > 0 && (
        <div style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "9px", padding: "10px 12px", marginBottom: "10px" }}>
          <div style={{ font: "600 10px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "7px" }}>
            Target notes this loop
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {targetNotes.map((note, i) => (
              <div key={i} style={{
                width: "30px", height: "30px", borderRadius: "50%", background: "var(--n-target)", color: "#FFFFFF",
                font: "700 11px 'IBM Plex Mono', monospace", display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 0 2px var(--n-target-glow)",
              }}>
                {note}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
        <div style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "9px", padding: "9px 11px" }}>
          <div style={{ font: "700 20px 'IBM Plex Mono', monospace" }}>{hits}</div>
          <div style={{ font: "500 10px 'Instrument Sans', sans-serif", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: "1px" }}>hits</div>
        </div>
        <div style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "9px", padding: "9px 11px" }}>
          <div style={{ font: "700 20px 'IBM Plex Mono', monospace" }}>{loopsDone}</div>
          <div style={{ font: "500 10px 'Instrument Sans', sans-serif", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: "1px" }}>loops</div>
        </div>
        <div style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "9px", padding: "9px 11px" }}>
          <div style={{ font: "700 20px 'IBM Plex Mono', monospace" }}>{timerLabel}</div>
          <div style={{ font: "500 10px 'Instrument Sans', sans-serif", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: "1px" }}>time</div>
        </div>
      </div>

      <div
        title="Drill modes — coming soon"
        style={{ display: "flex", gap: 0, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "9px", padding: "3px", marginTop: "12px" }}
      >
        {["Free", "Guided", "Drill"].map((m) => (
          <button
            key={m}
            onClick={() => setDrillMode(m)}
            style={{
              flex: 1, font: "700 11px 'Instrument Sans', sans-serif", padding: "7px", borderRadius: "6px",
              border: "none", letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
              background: drillMode === m ? "var(--accent)" : "transparent",
              color: drillMode === m ? "var(--accent-ink)" : "var(--muted)",
            }}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  )
}
