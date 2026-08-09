"use client"

// Power panel shell (spec §5.8) — a controlled collapsible so open/closed
// state can persist in localStorage (Band & Mix open by default, the rest
// closed). Replaces the old ad hoc collapsibles (a native <details> for Lead
// Sheet Grid, the one-off PracticeExpander for BeatForge, and an always-open
// div for Band & Mix / Melody Paths) with one consistent shell. The controls
// inside are untouched — only the container around them is new.

// keepMounted: for panels whose computation feeds something else while
// collapsed (Melody Paths broadcasts its guide notes to the fretboard
// overlay even when this panel itself is closed; BeatForge Metronome keeps
// running/keeps its Rhythm Shed engine reachable so a sibling panel can load
// a pattern into it) — render children into ONE div whose visibility toggles
// via style, not unmounted. Using two separately-conditioned divs here (one
// for open, one for hidden) looks equivalent but isn't: switching which one
// renders remounts children with fresh state, which is exactly what
// keepMounted is supposed to prevent. Every other panel defaults to the
// original mount-gated behavior.
// shortcutId: stamps data-db-shortcut on the header so KeyboardShortcuts can
// find and open this panel by a stable hook instead of matching its label text.
export default function PowerPanel({ title, subtitle, open, onToggle, children, keepMounted = false, shortcutId }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px", overflow: "hidden" }}>
      <div
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        data-db-shortcut={shortcutId}
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
      {(open || keepMounted) && (
        <div style={open ? { padding: "14px 16px 16px" } : { display: "none" }}>{children}</div>
      )}
    </div>
  )
}
