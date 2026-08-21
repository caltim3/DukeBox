"use client"

// Shared slide-out drawer + scrim shell (spec §5.6). Presentational only —
// callers own everything that renders inside.

export function DrawerScrim({ open, onClose }) {
  return (
    <div
      onClick={onClose}
      aria-hidden={!open}
      style={{
        // Above PickupPracticeHome's fixed shell (z-index 10000, see
        // PickupPracticeHome.jsx) — this drawer is meant to work from
        // anywhere, Home included, not just from inside a workspace.
        position: "fixed", inset: 0, zIndex: 10080, background: "rgba(0,0,0,.5)",
        opacity: open ? 1 : 0, pointerEvents: open ? "all" : "none", transition: "opacity .25s",
      }}
    />
  )
}

export default function Drawer({ open, onClose, side = "left", title, footer, children }) {
  const isLeft = side === "left"
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed", top: 0, bottom: 0, zIndex: 10090,
        [isLeft ? "left" : "right"]: 0,
        background: "var(--bg)",
        borderLeft: isLeft ? "none" : "1px solid var(--line)",
        borderRight: isLeft ? "1px solid var(--line)" : "none",
        width: "min(440px, 88vw)",
        transform: `translateX(${open ? "0" : isLeft ? "-100%" : "100%"})`,
        transition: "transform .28s ease",
        display: "flex", flexDirection: "column",
        boxShadow: open ? "0 0 40px rgba(0,0,0,.35)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
        <h3 style={{ font: "900 15px 'Archivo', sans-serif", letterSpacing: "0.04em", flex: 1, margin: 0 }}>{title}</h3>
        <button
          onClick={onClose}
          aria-label={`Close ${title}`}
          style={{
            background: "var(--surface2)", border: "1px solid var(--line)", width: "30px", height: "30px",
            borderRadius: "7px", fontSize: "15px", cursor: "pointer", color: "var(--text)",
          }}
        >
          ×
        </button>
      </div>
      <div style={{ overflowY: "auto", flex: 1, padding: "14px 16px" }}>
        {children}
      </div>
      {footer && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", padding: "12px 16px", borderTop: "1px solid var(--line)" }}>
          {footer}
        </div>
      )}
    </div>
  )
}
