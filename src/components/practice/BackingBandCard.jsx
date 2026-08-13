"use client"

// Backing band mini-mixer (spec §5.1). Mirrors the exact same state the Band &
// Mix power panel edits (playChords/playBass/playDrums/playMelody plus the
// three style choices) — a second, compact view of the same values, not a
// second source of truth. The styles used to be read-only text pointing you at
// another panel; they're editable here now, since this card is already where
// you look when you want to change who's playing.

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

const pickStyle = {
  width: "100%", minWidth: 0, padding: "4px 6px", borderRadius: "6px",
  border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--text)",
  font: "600 12px 'Instrument Sans', sans-serif", cursor: "pointer",
}

export default function BackingBandCard({
  compingStyle, compingOptions = [], onCompingChange,
  playChords, onToggleChords,
  bassStyle, bassOptions = [], onBassChange,
  playBass, onToggleBass,
  drumStyleLabel, drumOptions = [], onDrumChange,
  playDrums, onToggleDrums,
  playMelody, onToggleMelody,
}) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", padding: "14px 16px" }}>
      <h4 style={{ font: "800 11px 'Archivo', sans-serif", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 10px" }}>
        Backing band
      </h4>

      <div style={{ ...rowStyle, borderTop: "none" }}>
        <span style={{ color: "var(--muted)", textTransform: "uppercase", fontSize: "10.5px", letterSpacing: "0.1em" }}>Piano</span>
        <select value={compingStyle} onChange={(e) => onCompingChange?.(e.target.value)} style={pickStyle} aria-label="Piano style">
          {compingOptions.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <button style={muteBtn(!playChords)} onClick={onToggleChords} title="Mute piano">M</button>
      </div>
      <div style={rowStyle}>
        <span style={{ color: "var(--muted)", textTransform: "uppercase", fontSize: "10.5px", letterSpacing: "0.1em" }}>Bass</span>
        <select value={bassStyle} onChange={(e) => onBassChange?.(e.target.value)} style={pickStyle} aria-label="Bass style">
          {bassOptions.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <button style={muteBtn(!playBass)} onClick={onToggleBass} title="Mute bass">M</button>
      </div>
      <div style={rowStyle}>
        <span style={{ color: "var(--muted)", textTransform: "uppercase", fontSize: "10.5px", letterSpacing: "0.1em" }}>Drums</span>
        <select value={drumStyleLabel} onChange={(e) => onDrumChange?.(e.target.value)} style={pickStyle} aria-label="Drums style">
          {drumOptions.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
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
