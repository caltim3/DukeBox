"use client"

// Power panel shell (spec §5.8) — a controlled collapsible so open/closed
// state can persist in localStorage (Band & Mix open by default, the rest
// closed). Replaces the old ad hoc collapsibles (a native <details> for Lead
// Sheet Grid, the one-off PracticeExpander for BeatForge, and an always-open
// div for Band & Mix / Melody Paths) with one consistent shell. The controls
// inside are untouched — only the container around them is new.

export default function PowerPanel({ title, subtitle, open, onToggle, children }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px", overflow: "hidden" }}>
      <div
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle() } }}
        style={{
          display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", cursor: "pointer", userSelect: "none",
          borderBottom: open ? "1px solid var(--line)" : "1px solid transparent",
        }}
      >
        <span aria-hidden="true" style={{
          width: "22px", height: "22px", background: "var(--surface2)", borderRadius: "6px", color: "var(--muted)",
          fontSize: "11px", display: "inline-flex", alignItems: "center", justifyContent: "center",
          transition: "transform .2s", transform: open ? "rotate(90deg)" : "none", flexShrink: 0,
        }}>▶</span>
        <span style={{ font: "800 12px 'Archivo', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", flex: 1 }}>{title}</span>
        {subtitle && <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>{subtitle}</span>}
      </div>
      {open && <div style={{ padding: "14px 16px 16px" }}>{children}</div>}
    </div>
  )
}
