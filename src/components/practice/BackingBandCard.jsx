"use client"

// Backing band mini-mixer (spec §5.1). Mirrors the exact same play/mute
// state the Band & Mix power panel edits (playChords/playBass/playDrums/
// playMelody) — this is a second, compact view of the same booleans, not a
// second source of truth.

const muteBtn = (muted) => ({
  width: "28px", height: "24px", borderRadius: "6px", cursor: "pointer",
  background: muted ? "var(--hot)" : "var(--surface2)",
  color: muted ? "#FFF" : "var(--muted)",
  border: `1px solid ${muted ? "var(--hot)" : "var(--line)"}`,
  font: "700 10px 'IBM Plex Mono', monospace",
})

const rowStyle = {
  display: "grid", gridTemplateColumns: "60px 1fr auto", gap: "8px", alignItems: "center",
  padding: "8px 0", borderTop: "1px solid var(--line)", fontSize: "12.5px",
}

export default function BackingBandCard({
  compingStyle, playChords, onToggleChords,
  bassStyle, playBass, onToggleBass,
  drumStyleLabel, playDrums, onToggleDrums,
  playMelody, onToggleMelody,
}) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", padding: "14px 16px" }}>
      <h4 style={{ font: "800 11px 'Archivo', sans-serif", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 10px" }}>
        Backing band <small style={{ color: "var(--muted)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>· change in Band &amp; Mix</small>
      </h4>

      <div style={{ ...rowStyle, borderTop: "none" }}>
        <span style={{ color: "var(--muted)", textTransform: "uppercase", fontSize: "10.5px", letterSpacing: "0.1em" }}>Piano</span>
        <span style={{ fontWeight: 600 }}>{compingStyle}</span>
        <button style={muteBtn(!playChords)} onClick={onToggleChords} title="Mute piano">M</button>
      </div>
      <div style={rowStyle}>
        <span style={{ color: "var(--muted)", textTransform: "uppercase", fontSize: "10.5px", letterSpacing: "0.1em" }}>Bass</span>
        <span style={{ fontWeight: 600 }}>{bassStyle}</span>
        <button style={muteBtn(!playBass)} onClick={onToggleBass} title="Mute bass">M</button>
      </div>
      <div style={rowStyle}>
        <span style={{ color: "var(--muted)", textTransform: "uppercase", fontSize: "10.5px", letterSpacing: "0.1em" }}>Drums</span>
        <span style={{ fontWeight: 600 }}>{drumStyleLabel}</span>
        <button style={muteBtn(!playDrums)} onClick={onToggleDrums} title="Mute drums">M</button>
      </div>
      <div style={rowStyle}>
        <span style={{ color: "var(--muted)", textTransform: "uppercase", fontSize: "10.5px", letterSpacing: "0.1em" }}>Melody</span>
        <span style={{ fontWeight: 600 }}>Play mode {playMelody ? "on" : "off"}</span>
        <span
          role="switch"
          aria-checked={playMelody}
          onClick={onToggleMelody}
          style={{
            width: "34px", height: "20px", borderRadius: "11px", position: "relative", cursor: "pointer",
            background: playMelody ? "var(--accent)" : "var(--surface2)", border: `1px solid ${playMelody ? "var(--accent)" : "var(--line)"}`,
          }}
        >
          <i style={{
            position: "absolute", top: "1px", left: playMelody ? "15px" : "1px",
            width: "16px", height: "16px", borderRadius: "50%",
            background: playMelody ? "var(--accent-ink)" : "var(--muted)", transition: "left .2s",
          }} />
        </span>
      </div>
    </div>
  )
}
