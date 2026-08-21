"use client"

// Shared collapsible section shell for the Create and BeatForge workspaces —
// a native <details> so panels can be addressed by element id (jump
// shortcuts, home-card actions) and opened/scrolled-to by setting .open
// and calling .scrollIntoView() directly, no controlled-state plumbing
// needed. Extracted from CreateWorkspace.jsx when Line Lab and Licktionary
// moved into BeatForgeWorkspace, so both workspaces share one definition.

import { useState } from "react"

export default function WorkspaceSection({ id, title, subtitle, color, panelStyle, open = false, children }) {
  const [expanded, setExpanded] = useState(open)
  return (
    <details id={id} open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)} style={panelStyle}>
      <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: "10px", fontWeight: 800, flexWrap: "wrap" }}>
        <span aria-hidden="true" style={{ fontSize: "1.35rem", color }}>＋</span>
        <span style={{ fontSize: "var(--db-fs-lg)", letterSpacing: "0.06em", color }}>{title}</span>
        <span style={{ fontSize: "var(--db-fs-sm)", color: "var(--db-muted)", fontWeight: 400 }}>{subtitle}</span>
      </summary>
      <div style={{ marginTop: "14px" }}>{children}</div>
    </details>
  )
}
