"use client"

// Exported so PickupPracticeHome's "Core curriculum" row can link directly
// to these same guides instead of keeping its own separate list.
export const GUIDES = [
  {
    title: "Likas: Pivots, Surrounds, Peterson & Evans",
    subtitle: "Interactive guitar reference",
    src: "/reference/likas-page-2-guitar.html",
    height: "1200px",
    color: "var(--db-c-gold)",
  },
  {
    title: "Triad Network",
    subtitle: "Interactive practice system and tutorial",
    src: "/reference/triad-network.html",
    height: "1050px",
    color: "var(--db-c-purple)",
  },
]

export default function ReferenceGuides({ panelStyle }) {
  return (
    <div style={{ display: "grid", gap: "16px", marginBottom: "20px" }}>
      {GUIDES.map((guide) => (
        <details key={guide.src} style={{ ...panelStyle, marginBottom: 0, overflow: "hidden" }}>
          <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: "10px", fontWeight: 800, flexWrap: "wrap" }}>
            <span aria-hidden="true" style={{ fontSize: "1.35rem", color: guide.color }}>＋</span>
            <span style={{ fontSize: "var(--db-fs-lg)", letterSpacing: "0.04em", color: guide.color }}>{guide.title}</span>
            <span style={{ fontSize: "var(--db-fs-sm)", color: "var(--db-muted)", fontWeight: 400 }}>{guide.subtitle}</span>
            <a
              href={guide.src}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              style={{ marginLeft: "auto", color: "var(--db-accent)", fontSize: "var(--db-fs-sm)", textDecoration: "none" }}
            >
              Open in New Tab ↗
            </a>
          </summary>
          <div style={{ marginTop: "14px", width: "100%", maxWidth: "100%", overflow: "hidden" }}>
            <iframe
              src={guide.src}
              title={guide.title}
              style={{
                width: "100%",
                minHeight: "720px",
                height: guide.height,
                border: "1px solid var(--db-panel-border)",
                borderRadius: "var(--db-r-md)",
                background: "var(--surface)",
                display: "block",
              }}
            />
          </div>
        </details>
      ))}
    </div>
  )
}
