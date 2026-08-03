"use client"

// Gig Bar Strip — the full section you're currently playing, floating above
// every workspace while a chart is running.
//
// Gig Mode's full stage chart only exists on the Gig tab, so the moment you
// switched to Practice to reach for the tempo or the fretboard you lost the
// playhead. This strip follows the transport everywhere: the tune and section
// names above, every measure in that section below, measure numbers inside
// them, and the accent colour on the bar sounding now.
//
// It renders as a fixed bar plus an in-flow spacer of the same height, so it
// pins to the top of every screen without ever covering the controls beneath
// it. The spacer and fixed strip share the same calculated height.

const GRID_COLUMNS = 4

export default function GigBarStrip({ bars, title, playheadIndex, isPlaying, onStop }) {
  if (!isPlaying || playheadIndex == null || !bars?.length) return null

  // A section is the contiguous run carrying the active bar's section label.
  // Keeping it contiguous matters for forms that return to another section
  // with the same name later in the tune.
  const activeSection = bars[playheadIndex]?.section ?? null
  let start = playheadIndex
  let end = playheadIndex
  while (start > 0 && (bars[start - 1]?.section ?? null) === activeSection) start--
  while (end < bars.length - 1 && (bars[end + 1]?.section ?? null) === activeSection) end++

  const sectionBars = bars.slice(start, end + 1)
  const sectionLabel = activeSection || `Bars ${start + 1}\u2013${end + 1}`
  const rowCount = Math.ceil(sectionBars.length / GRID_COLUMNS)
  const stripHeight = 35 + rowCount * 58

  return (
    <>
      <style>{`
        @media print { .gig-strip, .gig-strip-spacer { display: none !important; } }
      `}</style>

      <div className="gig-strip-spacer" aria-hidden="true" style={{ height: stripHeight }} />

      <div
        className="gig-strip"
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 40,
          height: stripHeight,
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
        <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", maxWidth: "1460px" }}>
          <div style={{
            fontSize: "var(--db-fs-sm)", fontWeight: 700, letterSpacing: "0.06em",
            textTransform: "uppercase", color: "var(--db-accent)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {sectionLabel}
          </div>
          <div style={{
            marginLeft: "auto", fontSize: "var(--db-fs-xs)", fontWeight: 650,
            color: "var(--db-muted)", whiteSpace: "nowrap", overflow: "hidden",
            textOverflow: "ellipsis",
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
          display: "grid", gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
          gridAutoRows: "50px",
          gap: "8px", width: "100%", maxWidth: "1460px",
        }}>
          {sectionBars.map((bar, i) => {
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
