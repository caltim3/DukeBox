"use client"

// Focus goal card (spec §5.1/§5.2) — now the face of the Peña Bebop Gym.
// Free shows the standing method reminder; Guided rotates the drill deck as
// real loops accumulate; Drill adds the ladder (stage/key readout, with the
// key changes and tempo bumps driven from page.js). The mode picker and the
// loop count are live state owned by the page, not local placeholders.

export default function FocusGoalCard({
  mode = "free",
  onModeChange,
  focusTitle,
  focusDetail,
  stageLabel,
  loopsDone = 0,
  timerLabel = "0:00",
  chartKey = "C",
  targetNotes = [],
}) {
  const title = focusTitle || "The three tools: arpeggio · enclosure · guide tone"
  const detail = focusDetail ||
    "Chord tones on strong beats, a chromatic enclosure that starts the line or meets the target, and the 3rd of the next chord landed on beat 1. Pick Guided to have the deck coach you loop by loop."

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", padding: "16px" }}>
      <h4 style={{ font: "800 11px 'Archivo', sans-serif", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 10px", display: "flex", gap: "8px", alignItems: "baseline", flexWrap: "wrap" }}>
        <span>{mode === "free" ? "Today's focus" : "Bebop Gym"}</span>
        {stageLabel && <span style={{ fontWeight: 600, letterSpacing: "0.04em", textTransform: "none", color: "var(--info)" }}>{stageLabel}</span>}
      </h4>
      <div style={{ font: "700 18px 'Instrument Sans', sans-serif", lineHeight: 1.25, marginBottom: "8px" }}>
        {title}
      </div>
      <div style={{ fontSize: "12.5px", color: "var(--muted)", lineHeight: 1.5, marginBottom: "12px" }}>
        {detail}
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
          <div style={{ font: "700 20px 'IBM Plex Mono', monospace" }}>{loopsDone}</div>
          <div style={{ font: "500 10px 'Instrument Sans', sans-serif", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: "1px" }}>loops</div>
        </div>
        <div style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "9px", padding: "9px 11px" }}>
          <div style={{ font: "700 20px 'IBM Plex Mono', monospace" }}>{chartKey}</div>
          <div style={{ font: "500 10px 'Instrument Sans', sans-serif", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: "1px" }}>key</div>
        </div>
        <div style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "9px", padding: "9px 11px" }}>
          <div style={{ font: "700 20px 'IBM Plex Mono', monospace" }}>{timerLabel}</div>
          <div style={{ font: "500 10px 'Instrument Sans', sans-serif", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: "1px" }}>time</div>
        </div>
      </div>

      <div
        title="Free: no coaching. Guided: the Peña drill deck rotates every few loops. Drill: the deck plus key changes around the cycle and tempo bumps — the play-for-hours ladder."
        style={{ display: "flex", gap: 0, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "9px", padding: "3px", marginTop: "12px" }}
      >
        {[["free", "Free"], ["guided", "Guided"], ["drill", "Drill"]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => onModeChange?.(id)}
            aria-pressed={mode === id}
            style={{
              flex: 1, font: "700 11px 'Instrument Sans', sans-serif", padding: "7px", borderRadius: "6px",
              border: "none", letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
              background: mode === id ? "var(--accent)" : "transparent",
              color: mode === id ? "var(--accent-ink)" : "var(--muted)",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
