"use client"

// Gig Bar Strip — the four bars you're actually playing, floating above every
// workspace while a chart is running.
//
// Gig Mode's full stage chart only exists on the Gig tab, so the moment you
// switched to Practice to reach for the tempo or the fretboard you lost the
// playhead. This strip follows the transport everywhere: the tune's name above,
// four measure boxes below in the current phrase, measure numbers inside them,
// and the accent colour on the bar sounding now.
//
// It renders as a fixed bar plus an in-flow spacer of the same height, so it
// pins to the top of every screen without ever covering the controls beneath
// it. The two heights are driven by one CSS class each, from one rule.

const WINDOW = 4

export default function GigBarStrip({ bars, title, playheadIndex, isPlaying, onStop }) {
  if (!isPlaying || playheadIndex == null || !bars?.length) return null

  // Lock to four-bar phrases rather than scrolling one bar at a time — the
  // window only moves when the phrase does, so the chart doesn't crawl sideways
  // underneath you while you're reading it.
  const start = Math.floor(playheadIndex / WINDOW) * WINDOW
  const phrase = bars.slice(start, start + WINDOW)

  return (
    <>
      <style>{`
        .gig-strip, .gig-strip-spacer { height: 96px; }
        @media (max-width: 560px) {
          .gig-strip, .gig-strip-spacer { height: 84px; }
        }
        @media print { .gig-strip, .gig-strip-spacer { display: none !important; } }
      `}</style>

      <div className="gig-strip-spacer" aria-hidden="true" />

      <div
        className="gig-strip"
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 40,
          boxSizing: "border-box",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: "5px",
          padding: "6px 12px",
          background: "color-mix(in srgb, var(--db-bg) 90%, transparent)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid var(--db-panel-border)",
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", maxWidth: "100%" }}>
          <div style={{
            fontSize: "var(--db-fs-sm)", fontWeight: 700, letterSpacing: "0.06em",
            textTransform: "uppercase", color: "var(--db-accent)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {title || "Now playing"}
          </div>
          {onStop && (
            <button
              onClick={onStop}
              title="Stop playback"
              aria-label="Stop playback"
              style={{
                pointerEvents: "auto",
                padding: "1px 9px", borderRadius: 999, cursor: "pointer",
                background: "transparent", color: "var(--db-muted)",
                border: "1px solid var(--db-panel-border)", fontSize: "var(--db-fs-xs)",
              }}
            >
              ⏹
            </button>
          )}
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: `repeat(${phrase.length}, minmax(56px, 132px))`,
          gap: "6px", width: "100%", maxWidth: "620px",
        }}>
          {phrase.map((bar, i) => {
            const index = start + i
            const isNow = index === playheadIndex
            return (
              <div
                key={index}
                style={{
                  position: "relative",
                  padding: "7px 4px 5px", borderRadius: "var(--db-r-md)",
                  textAlign: "center", fontWeight: 700, lineHeight: 1.1,
                  fontSize: "clamp(0.9rem, 3.2vw, 1.35rem)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  background: isNow
                    ? "color-mix(in srgb, var(--db-accent) 78%, var(--db-bg))"
                    : "var(--db-card-bg)",
                  color: isNow ? "var(--db-bg)" : "var(--db-text)",
                  border: `2px solid ${isNow ? "var(--db-accent)" : "var(--db-card-border)"}`,
                  boxShadow: isNow ? "0 0 16px color-mix(in srgb, var(--db-accent) 55%, transparent)" : "none",
                  transition: "background 0.12s, color 0.12s, box-shadow 0.12s",
                }}
              >
                <span style={{
                  position: "absolute", top: "1px", left: "5px",
                  fontSize: "var(--db-fs-xs)", fontWeight: 600,
                  opacity: isNow ? 0.75 : 0.45,
                }}>{index + 1}</span>
                {bar.symbol}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
