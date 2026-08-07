"use client"

// Chart ribbon — in-flow, always-visible bar strip for the Cockpit/Focus
// canvas (spec §5.5). Distinct from <GigBarStrip>, which is a fixed overlay
// that only appears while the transport is running; this one is part of the
// page and visible whether paused or playing, with the loop-range actions
// attached. Reads/writes the exact same selection + loop state the Lead
// Sheet Grid and the fretboard already use — no new state.

export default function ChartRibbon({
  bars,
  barLabels,
  selectedIndex,
  onSelectBar,
  loopStart,
  loopEnd,
  loopEnabled,
  onSetLoopStart,
  onSetLoopEnd,
  currentIndex,
  nextIndex,
  sectionLabel,
  showPlayhead = false,
}) {
  const lo = Math.min(loopStart, loopEnd)
  const hi = Math.max(loopStart, loopEnd)

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px", padding: "12px 14px", marginBottom: "12px", position: "relative" }}>
      <div style={{
        font: "800 10.5px 'Archivo', sans-serif", letterSpacing: "0.14em", textTransform: "uppercase",
        color: "var(--muted)", marginBottom: "8px", display: "flex", justifyContent: "space-between",
        alignItems: "center", gap: "8px", flexWrap: "wrap",
      }}>
        <span>{sectionLabel}</span>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => onSetLoopStart(selectedIndex)}
            title="Set Start at Selected Bar"
            style={{
              font: "700 9.5px 'IBM Plex Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase",
              padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--line)",
              background: "var(--surface2)", color: "var(--muted)", cursor: "pointer",
            }}
          >
            Start Here
          </button>
          <button
            onClick={() => onSetLoopEnd(selectedIndex)}
            title="Set End at Selected Bar"
            style={{
              font: "700 9.5px 'IBM Plex Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase",
              padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--line)",
              background: "var(--surface2)", color: "var(--muted)", cursor: "pointer",
            }}
          >
            End Here
          </button>
          {loopEnabled && (
            <b style={{ color: "var(--hot)", fontWeight: 800, fontSize: "10.5px" }}>■ LOOP {lo + 1}–{hi + 1}</b>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(bars.length, 12) || 1}, 1fr)`, gap: "6px" }}>
        {bars.map((bar, index) => {
          const inLoop = loopEnabled && index >= lo && index <= hi
          const isNow = index === currentIndex
          const isNext = index === nextIndex
          const isSelected = index === selectedIndex
          return (
            <button
              key={index}
              onClick={() => onSelectBar(index)}
              style={{
                background: isNow ? "var(--accent)" : inLoop ? "var(--loop)" : "var(--surface2)",
                color: isNow ? "var(--accent-ink)" : "var(--text)",
                border: isNow ? "1px solid var(--accent)" : isNext ? "1px solid var(--info)" : isSelected ? "1px solid var(--sel)" : "1px solid var(--line)",
                boxShadow: isNow ? "0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent)" : isNext ? "inset 0 0 0 1px var(--info)" : "none",
                transform: isNow ? "scale(1.05)" : "none",
                borderRadius: "8px", padding: "8px 4px", textAlign: "center", cursor: "pointer",
                transition: "transform .12s, background .12s",
              }}
            >
              <span style={{ font: "500 9px 'IBM Plex Mono', monospace", opacity: 0.7, display: "block" }}>{barLabels?.[index] ?? index + 1}</span>
              <span style={{ font: "700 14px 'IBM Plex Mono', monospace", marginTop: "1px", display: "block" }}>{bar.symbol}</span>
            </button>
          )
        })}
      </div>
      {showPlayhead && bars.length > 0 && currentIndex != null && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute", top: "34px", bottom: "10px",
            left: `${(currentIndex / bars.length) * 100}%`,
            width: "2px", background: "var(--info)", boxShadow: "0 0 8px var(--glow)", pointerEvents: "none",
          }}
        />
      )}
    </div>
  )
}
