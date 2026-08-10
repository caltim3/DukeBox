"use client"

// Anticipation strip — NOW + next 3 sounding chords (spec §5.5). Pure render
// of the fretboard's existing chord/scale computation and the loop-aware
// "next sounding bar" lookahead (same algorithm the Fretboard's Anticipate
// overlay already uses, just called for 3 steps instead of 1). No new state.

// beat is the 0-based beat of the current bar that's sounding (null when
// stopped); beats is how many this bar has, so a half-bar shows two segments
// rather than four empty ones.
export default function AnticipationStrip({ now, upcoming = [], isPlaying, beat = null, beats = 4 }) {
  if (!now) return null
  const beatCount = Math.max(1, Math.round(beats) || 4)
  return (
    <>
      <style>{`
        @media (max-width: 900px) {
          .db-antic-strip { grid-template-columns: 1fr 1fr !important; }
          .db-antic-now { grid-column: 1 / -1 !important; }
          .db-antic-now .db-antic-chord { font-size: 48px !important; }
        }
      `}</style>
      <div className="db-antic-strip" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "8px", marginBottom: "12px" }}>
        <div className="db-antic-now" style={{
          background: "color-mix(in srgb, var(--accent) 10%, var(--surface))",
          border: "1px solid var(--accent)", borderRadius: "12px", padding: "14px 16px", position: "relative", overflow: "hidden",
        }}>
          <div style={{ font: "700 10.5px 'IBM Plex Mono', monospace", color: "var(--accent)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "2px" }}>
            Now · Bar {now.barLabel}
          </div>
          <div className="db-antic-chord" style={{ font: "800 64px 'IBM Plex Mono', monospace", lineHeight: 1, margin: "6px 0 4px", letterSpacing: "-0.01em", color: "var(--accent)" }}>
            {now.symbol}
          </div>
          {now.modeInfo && (
            <div style={{ fontSize: "12.5px", color: "var(--text)" }}>{now.modeInfo}</div>
          )}
          {/* Beat meter: one segment per beat of this bar, filling left to
              right as the measure plays. The beat that's sounding is solid and
              slightly taller; beats already gone stay filled but dimmer, so the
              bar reads as a progress meter rather than a row of blinking lights. */}
          <div
            style={{ display: "flex", gap: "4px", marginTop: "10px", alignItems: "flex-end", height: "9px" }}
            role="img"
            aria-label={isPlaying && beat != null ? `Beat ${beat + 1} of ${beatCount}` : `${beatCount} beats per bar`}
          >
            {Array.from({ length: beatCount }, (_, i) => {
              const live = isPlaying && beat != null
              const isCurrent = live && i === beat
              const isPast = live && i < beat
              return (
                <i key={i} style={{
                  flex: 1,
                  height: isCurrent ? "9px" : "6px",
                  borderRadius: "2px",
                  background: live
                    ? (isCurrent || isPast ? "var(--accent)" : "var(--surface2)")
                    : "var(--surface2)",
                  opacity: live ? (isCurrent ? 1 : isPast ? 0.55 : 0.35) : 0.5,
                  transition: "height 80ms ease, opacity 80ms ease, background 80ms ease",
                }} />
              )
            })}
          </div>
        </div>

        {upcoming.map((tile, i) => (
          <div key={i} style={{
            background: "var(--surface)", border: `1px solid ${i === 0 ? "var(--info)" : "var(--line)"}`,
            borderRadius: "12px", padding: "14px 16px",
            boxShadow: i === 0 ? "inset 0 0 0 1px var(--info)" : "none",
          }}>
            <div style={{ font: "700 10.5px 'IBM Plex Mono', monospace", color: i === 0 ? "var(--info)" : "var(--muted)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "2px" }}>
              {i === 0 ? "Next" : "Then"}
            </div>
            <div style={{ font: "500 11px 'Instrument Sans', sans-serif", color: "var(--muted)" }}>Bar {tile.barLabel}</div>
            <div style={{ font: "800 42px 'IBM Plex Mono', monospace", lineHeight: 1, margin: "6px 0 4px", letterSpacing: "-0.01em" }}>{tile.symbol}</div>
            {tile.modeInfo && <div style={{ fontSize: "11.5px", color: "var(--muted)" }}>{tile.modeInfo}</div>}
            <div style={{ color: "var(--muted)", fontSize: "11px", marginTop: "6px" }}>
              {tile.stepsAway === 1 ? "next bar" : `in ${tile.stepsAway} bars`}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
