"use client"

// Session strip — top-of-Cockpit summary bar (spec §5.5). A new render of
// state that already exists elsewhere: the practice timer's remaining/duration
// (mirrored here as "elapsed of total"), the active song/loop/focus text, and
// a loop counter. No new state is introduced — clicking either side opens the
// same Songbook/Timer drawers the icons in the top bar already open.

function clock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${String(ss).padStart(2, "0")}`
}

export default function SessionStrip({
  timerState,
  songTitle,
  loopDescriptor,
  focusText,
  progressPct = 0,
  loopsDone = 87,
  loopsTarget = 100,
  onOpenSongbook,
  onOpenTimer,
  compact = false,
}) {
  const elapsed = timerState ? Math.max(0, (timerState.duration ?? 0) - (timerState.seconds ?? 0)) : 0
  const total = timerState ? timerState.duration ?? 0 : 0
  const running = !!timerState?.running

  if (compact) {
    return (
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "6px 4px 10px", fontSize: "12px", color: "var(--muted)", gap: "10px", flexWrap: "wrap",
      }}>
        <button onClick={onOpenTimer} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", font: "600 15px 'IBM Plex Mono', monospace" }}>
          {clock(elapsed)} <span style={{ opacity: 0.7, fontWeight: 500, fontFamily: "inherit", fontSize: "12px" }}>· session</span>
        </button>
        <div style={{ display: "flex", gap: "18px", alignItems: "center" }}>
          <span style={{ font: "800 16px 'IBM Plex Mono', monospace", color: "var(--text)" }}>
            {loopsDone}<em style={{ color: "var(--muted)", fontWeight: 500, fontStyle: "normal", fontSize: "13px" }}> / {loopsTarget}</em> loops
          </span>
          <button onClick={onOpenSongbook} style={{ background: "none", border: "none", borderBottom: "1px dashed var(--muted)", color: "var(--text)", cursor: "pointer", fontWeight: 600, padding: 0 }}>
            {songTitle}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "20px", alignItems: "center",
      background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px",
      padding: "12px 20px", marginBottom: "12px",
    }}>
      <button
        onClick={onOpenTimer}
        title="Open Timer"
        style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", background: "none", border: "none", padding: 0, color: "inherit", textAlign: "left" }}
      >
        <span style={{
          width: "8px", height: "8px", borderRadius: "50%",
          background: running ? "var(--accent)" : "var(--muted)",
          boxShadow: running ? "0 0 0 4px color-mix(in srgb, var(--accent) 30%, transparent)" : "none",
        }} />
        <span>
          <div style={{ font: "600 22px 'IBM Plex Mono', monospace", letterSpacing: "0.02em" }}>{clock(elapsed)}</div>
          <div style={{ font: "500 10.5px 'Instrument Sans', sans-serif", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Session {total > 0 && <em style={{ color: "var(--info)", fontStyle: "normal", marginLeft: "6px" }}>· of {clock(total)}</em>}
          </div>
        </span>
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
        <div style={{ font: "700 13px 'Archivo', sans-serif", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={onOpenSongbook} title="Change song" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", font: "inherit", borderBottom: "1px dashed var(--muted)", paddingBottom: "1px" }}>
            {songTitle}
          </button>
          {loopDescriptor && <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: "12px" }}>· {loopDescriptor}</span>}
        </div>
        {focusText && <div style={{ color: "var(--muted)", fontSize: "12px" }}>Focus block · {focusText}</div>}
        <div style={{ height: "5px", background: "var(--surface2)", borderRadius: "3px", overflow: "hidden" }}>
          <div style={{ display: "block", height: "100%", background: "var(--accent)", width: `${Math.max(0, Math.min(100, progressPct))}%`, transition: "width .2s" }} />
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div style={{ font: "800 24px 'IBM Plex Mono', monospace" }}>
          {loopsDone} <em style={{ color: "var(--muted)", fontStyle: "normal", fontWeight: 500 }}>/ {loopsTarget}</em>
        </div>
        <div style={{ font: "500 10.5px 'Instrument Sans', sans-serif", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.14em" }}>loops</div>
      </div>
    </div>
  )
}
