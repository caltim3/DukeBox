// Runway — chord-anticipation strip, ported from Bebop Blueprint.
// A horizontal row of color-coded chord pills; the current pill fills with a
// progress bar timed to the bar's duration so you can see the change coming.

const CATEGORY_COLORS = {
  minor:              "#2f6fed",
  dominant:           "#d32f2f",
  major:              "#00c853",
  "half-diminished":  "#7b1fa2",
  augmented:          "#111111",
  "fully-diminished": "#f9a825",
  altered:            "#7f0000",
  rest:               "#666666",
}

export function runwayCategory(quality) {
  const q = String(quality || "").toLowerCase()
  if (q === "nc") return "rest"
  if (q.includes("alt") || q.includes("b9") || q.includes("#9")) return "altered"
  if (q.includes("min7b5") || q.includes("m7b5")) return "half-diminished"
  if (q.includes("dim")) return "fully-diminished"
  if (q.includes("aug") || q.includes("+")) return "augmented"
  if (q.startsWith("maj") || q === "6/9" || q === "add9" || q === "sus4") return "major"
  if (q.startsWith("min") || (q.startsWith("m") && !q.startsWith("maj"))) return "minor"
  if (q.includes("7") || q.includes("9") || q.includes("13")) return "dominant"
  return "major"
}

export default function Runway({ bars, playheadIndex, tempo, onSelectBar }) {
  return (
    <div style={{ overflowX: "auto", padding: "4px 0" }}>
      <div style={{ display: "flex", gap: "6px", minWidth: "min-content" }}>
        {bars.map((bar, i) => {
          const category = runwayCategory(bar.quality)
          const color = CATEGORY_COLORS[category]
          const isCurrent = i === playheadIndex
          const barSec = ((bar.beats ?? 4) * 60) / (tempo || 120)
          return (
            <div
              key={i}
              onClick={() => onSelectBar?.(i)}
              title={`${bar.symbol} — ${category}`}
              style={{
                position: "relative",
                overflow: "hidden",
                flexShrink: 0,
                padding: "5px 12px",
                borderRadius: "var(--db-r-pill)",
                fontSize: "var(--db-fs-sm)",
                fontWeight: 700,
                cursor: onSelectBar ? "pointer" : "default",
                color: "#fff",
                background: `color-mix(in srgb, ${color} ${isCurrent ? 92 : 55}%, transparent)`,
                border: isCurrent ? "2px solid #fff" : "2px solid transparent",
                boxShadow: isCurrent ? `0 0 10px ${color}` : "none",
                transition: "background 0.15s, box-shadow 0.15s",
              }}
            >
              {isCurrent && (
                <div
                  // Remount per playhead move so the fill animation restarts each bar
                  key={`fill-${playheadIndex}`}
                  style={{
                    position: "absolute", left: 0, top: 0, bottom: 0, width: "100%",
                    transformOrigin: "left",
                    background: "rgba(255,255,255,0.28)",
                    animation: `dbRunwayFill ${barSec}s linear forwards`,
                  }}
                />
              )}
              <span style={{ position: "relative" }}>{bar.symbol}</span>
            </div>
          )
        })}
      </div>
      <style>{`@keyframes dbRunwayFill { from { transform: scaleX(0) } to { transform: scaleX(1) } }`}</style>
    </div>
  )
}
