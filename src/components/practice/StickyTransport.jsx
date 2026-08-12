"use client"

// Sticky transport (spec §5.7). A synchronized *display* of state that lives
// elsewhere (Play in the old Songbook panel, Tempo/Swing in Band & Mix, Loop
// in Chart Navigation) — every control here calls the same setter the panel
// version does, so editing from either place keeps them in sync. Nothing
// here owns state; it's all lifted from Home().

function clock(totalSeconds) {
  if (totalSeconds == null) return "--:--"
  const s = Math.max(0, Math.floor(totalSeconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${String(ss).padStart(2, "0")}`
}

const arrowBtn = {
  width: "19px", height: "19px", border: "1px solid var(--line)", background: "var(--surface2)",
  color: "var(--muted)", borderRadius: "5px", font: "700 10px monospace", cursor: "pointer",
}

const BRAND_ICON = "/dukebox-jazzmaster.png"

// Home is a surface owned by PickupPracticeHome — see lib/homeNav. This used
// to fall through to clicking the Practice tab, which is workspace "1", not
// home.
import { goHome } from "@/lib/homeNav"

export default function StickyTransport({
  isPlaying,
  onTogglePlay,
  loopEnabled,
  onToggleLoop,
  tempo,
  onTempoChange,
  swingAmount,
  loopStart,
  loopEnd,
  timerState,
  onOpenSettings,
}) {
  const lo = Math.min(loopStart, loopEnd) + 1
  const hi = Math.max(loopStart, loopEnd) + 1

  return (
    <div style={{
      position: "fixed", bottom: "14px", left: "50%", transform: "translateX(-50%)", zIndex: 50,
      display: "flex", alignItems: "center", gap: "10px",
      background: "color-mix(in srgb, var(--surface) 96%, transparent)",
      border: "1px solid var(--line)", borderRadius: "14px", padding: "8px 12px",
      backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,.25)",
      maxWidth: "calc(100vw - 24px)", overflowX: "auto",
    }}>
      <button
        type="button"
        onClick={goHome}
        title="Back to DukeBox home"
        aria-label="Back to DukeBox home"
        style={{ width: "34px", height: "34px", flexShrink: 0, padding: 0, border: 0, borderRadius: "50%", background: "transparent", cursor: "pointer" }}
      >
        <img src={BRAND_ICON} alt="" aria-hidden="true" style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
      </button>
      <button
        onClick={onTogglePlay}
        aria-label={isPlaying ? "Stop playback" : "Start playback"}
        style={{ width: "48px", height: "48px", borderRadius: "11px", border: "none", background: "var(--accent)", color: "var(--accent-ink)", font: "700 20px 'Instrument Sans', sans-serif", cursor: "pointer", flexShrink: 0 }}
      >
        {isPlaying ? "⏹" : "▶"}
      </button>
      <button
        onClick={onToggleLoop}
        aria-pressed={loopEnabled}
        title="Toggle loop"
        style={{
          width: "42px", height: "42px", borderRadius: "10px", flexShrink: 0,
          border: "1px solid var(--hot)", background: loopEnabled ? "var(--hot)" : "transparent",
          color: loopEnabled ? "#FFF" : "var(--hot)", font: "800 9.5px 'IBM Plex Mono', monospace", letterSpacing: "0.06em", cursor: "pointer",
        }}
      >
        LOOP
      </button>

      <div style={{ display: "flex", gap: "8px", alignItems: "center", padding: "0 4px", borderLeft: "1px solid var(--line)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "52px" }}>
          <span style={{ font: "600 8.5px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Tempo</span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ font: "700 14px 'IBM Plex Mono', monospace" }}>{tempo}</span>
            <span style={{ display: "flex", gap: "2px" }}>
              <button style={arrowBtn} onClick={() => onTempoChange(Math.max(70, tempo - 5))}>−</button>
              <button style={arrowBtn} onClick={() => onTempoChange(Math.min(180, tempo + 5))}>+</button>
            </span>
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "52px" }}>
          <span style={{ font: "600 8.5px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Swing</span>
          <span style={{ font: "700 14px 'IBM Plex Mono', monospace" }}>{Math.round(swingAmount * 100)}%</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "52px" }}>
          <span style={{ font: "600 8.5px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Bars</span>
          <span style={{ font: "700 14px 'IBM Plex Mono', monospace" }}>{lo}–{hi}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "52px" }}>
          <span style={{ font: "600 8.5px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Timer</span>
          <span style={{ font: "700 14px 'IBM Plex Mono', monospace" }}>{timerState ? clock(timerState.seconds) : "--:--"}</span>
        </div>
      </div>

      <button
        onClick={onOpenSettings}
        title="Open Band & Mix settings"
        style={{ width: "42px", height: "42px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--muted)", font: "600 15px 'Instrument Sans', sans-serif", cursor: "pointer", flexShrink: 0 }}
      >
        ⚙
      </button>
    </div>
  )
}
