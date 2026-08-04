"use client"

const GUIDES = [
  {
    title: "Likas Page 2 for Guitar",
    subtitle: "Pivots, surrounds, Peterson and Evans examples",
    src: "/reference/likas-page-2-guitar.html",
    color: "var(--db-c-gold)",
  },
  {
    title: "The Triad Network",
    subtitle: "Pairs, cells, pivots, enclosures and Line Lab practice system",
    src: "/reference/triad-network-practice-system.html",
    color: "var(--db-c-purple)",
  },
]

export default function ReferenceGuides({ panelStyle }) {
  return (
    <div style={{ display: "grid", gap: "16px", marginTop: "16px" }}>
      {GUIDES.map((guide) => (
        <details key={guide.src} style={panelStyle}>
          <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: "10px", fontWeight: 800 }}>
            <span aria-hidden="true" style={{ fontSize: "1.35rem", color: guide.color }}>＋</span>
            <span style={{ fontSize: "var(--db-fs-lg)", letterSpacing: "0.04em", color: guide.color }}>{guide.title}</span>
            <span style={{ fontSize: "var(--db-fs-sm)", opacity: 0.55, fontWeight: 400 }}>{guide.subtitle}</span>
          </summary>
          <div style={{ marginTop: "14px" }}>
            <iframe
              src={guide.src}
              title={guide.title}
              style={{
                width: "100%",
                minHeight: "760px",
                height: "82vh",
                border: "1px solid var(--db-panel-border)",
                borderRadius: "var(--db-r-md)",
                background: "#fff",
                display: "block",
              }}
            />
          </div>
        </details>
      ))}
    </div>
  )
}
