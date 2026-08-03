"use client"

import { useEffect, useState } from "react"

const GROUPS = [
  {
    title: "Navigation",
    items: [
      ["1", "Practice workspace"],
      ["2", "Gig workspace"],
      ["3", "Reference workspace"],
      ["4", "Tonal workspace"],
      ["/", "Search songs and charts"],
      ["C", "Open categories"],
      ["P", "Open projects and charts"],
    ],
  },
  {
    title: "Playback",
    items: [
      ["Space", "Play or stop"],
      ["K", "Open metronome"],
      ["Y", "Open practice timer"],
    ],
  },
  {
    title: "Chart",
    items: [
      ["←  →", "Previous or next bar"],
      ["↑  ↓", "Cycle chord quality"],
      ["⌘/Ctrl C", "Copy selected bar"],
      ["⌘/Ctrl V", "Paste selected bar"],
      ["Double-click", "Loop one chord"],
    ],
  },
  {
    title: "Views",
    items: [
      [";", "Cycle color palette"],
      ["F", "Jump to fretboard"],
      ["I", "Toggle Roman numerals"],
      ["T", "Toggle guide-tone targets"],
      ["?", "Show or hide shortcuts"],
      ["Esc", "Close the current overlay"],
    ],
  },
]

function isTyping() {
  const el = document.activeElement
  return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)
}

function buttons() {
  return Array.from(document.querySelectorAll("button"))
}

function clickButton(label) {
  const needle = label.toLowerCase()
  const button = buttons().find((el) => (el.textContent || "").trim().toLowerCase().includes(needle))
  if (!button) return false
  button.click()
  button.scrollIntoView({ behavior: "smooth", block: "center" })
  return true
}

function clickWorkspace(label) {
  const button = Array.from(document.querySelectorAll('[role="tab"]')).find(
    (el) => (el.textContent || "").toLowerCase().includes(label.toLowerCase())
  )
  if (!button) return false
  button.click()
  button.focus({ preventScroll: true })
  window.scrollTo({ top: 0, behavior: "smooth" })
  return true
}

function findRegion(text) {
  const needle = text.toLowerCase()
  const candidates = Array.from(document.querySelectorAll("section, div"))
  return candidates.find((el) => {
    const own = Array.from(el.children).slice(0, 3).map((child) => child.textContent || "").join(" ").toLowerCase()
    return own.includes(needle)
  })
}

function focusSearch() {
  const fields = Array.from(document.querySelectorAll("input, textarea"))
  const field = fields.find((el) => {
    const text = `${el.getAttribute("placeholder") || ""} ${el.getAttribute("aria-label") || ""}`.toLowerCase()
    return text.includes("search") || text.includes("find a song")
  })
  if (!field) return false
  field.focus()
  field.select?.()
  field.scrollIntoView({ behavior: "smooth", block: "center" })
  return true
}

function focusRegionControl(labels, selector = "select, input, textarea, button") {
  for (const label of labels) {
    const region = findRegion(label)
    const control = region?.querySelector(selector)
    if (control) {
      control.scrollIntoView({ behavior: "smooth", block: "center" })
      control.focus?.({ preventScroll: true })
      return true
    }
  }
  return false
}

export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onClick(event) {
      const shortcutButton = event.target.closest?.('button[title*="Keyboard shortcuts"], button[title*="keyboard shortcuts"]')
      if (!shortcutButton) return
      event.preventDefault()
      event.stopPropagation()
      setOpen(true)
    }

    function onKey(event) {
      if (event.key === "Escape" && open) {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        return
      }

      if (event.key === "?" && !isTyping()) {
        event.preventDefault()
        event.stopPropagation()
        setOpen((value) => !value)
        return
      }

      if (open || isTyping() || event.metaKey || event.ctrlKey || event.altKey) return

      const workspaces = { "1": "Practice", "2": "Gig", "3": "Reference", "4": "Tonal" }
      if (workspaces[event.key]) {
        event.preventDefault()
        event.stopPropagation()
        clickWorkspace(workspaces[event.key])
        return
      }

      const key = event.key.toLowerCase()
      if (key === "/") {
        event.preventDefault()
        event.stopPropagation()
        if (!focusSearch()) {
          clickWorkspace("Gig")
          requestAnimationFrame(focusSearch)
        }
      } else if (key === "c") {
        event.preventDefault()
        event.stopPropagation()
        clickWorkspace("Practice")
        requestAnimationFrame(() => focusRegionControl(["songbook", "category"], "select, button"))
      } else if (key === "p") {
        event.preventDefault()
        event.stopPropagation()
        clickWorkspace("Practice")
        requestAnimationFrame(() => focusRegionControl(["songbook", "chart generator", "projects"], "select, input, textarea, button"))
      } else if (key === "f") {
        event.preventDefault()
        event.stopPropagation()
        clickButton("fretboard")
      } else if (key === "i") {
        event.preventDefault()
        event.stopPropagation()
        clickButton("roman")
      } else if (key === "t") {
        event.preventDefault()
        event.stopPropagation()
        clickButton("targets") || clickButton("guide tones")
      } else if (key === "k") {
        event.preventDefault()
        event.stopPropagation()
        clickWorkspace("Practice")
        requestAnimationFrame(() => focusRegionControl(["metronome"], "button, input, select"))
      } else if (key === "y") {
        event.preventDefault()
        event.stopPropagation()
        clickWorkspace("Practice")
        requestAnimationFrame(() => focusRegionControl(["practice timer", "timer"], "button, input, select"))
      }
    }

    document.addEventListener("click", onClick, true)
    window.addEventListener("keydown", onKey, true)
    return () => {
      document.removeEventListener("click", onClick, true)
      window.removeEventListener("keydown", onKey, true)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="presentation"
      onMouseDown={() => setOpen(false)}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "grid", placeItems: "center",
        padding: "20px", background: "rgba(0,0,0,0.62)",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="dukebox-shortcuts-title"
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          width: "min(760px, 96vw)", maxHeight: "88vh", overflow: "auto",
          padding: "24px", borderRadius: "14px",
          border: "1px solid var(--db-accent)",
          background: "var(--db-bg)", color: "var(--db-text)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
        }}
      >
        <header style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "18px" }}>
          <div>
            <div id="dukebox-shortcuts-title" style={{ fontWeight: 800, letterSpacing: "0.12em", color: "var(--db-accent)" }}>
              KEYBOARD SHORTCUTS
            </div>
            <div style={{ marginTop: "5px", fontSize: "0.85rem", color: "var(--db-muted)" }}>
              Navigate DukeBox without leaving the keyboard
            </div>
          </div>
          <button
            autoFocus
            onClick={() => setOpen(false)}
            aria-label="Close shortcuts"
            style={{
              marginLeft: "auto", width: "38px", height: "38px", borderRadius: "10px",
              border: "1px solid var(--db-panel-border)", background: "var(--db-panel-bg)",
              color: "var(--db-text)", cursor: "pointer", fontSize: "1.2rem",
            }}
          >
            ×
          </button>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
          {GROUPS.map((group) => (
            <div key={group.title} style={{ border: "1px solid var(--db-panel-border)", borderRadius: "12px", padding: "14px" }}>
              <div style={{ marginBottom: "9px", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--db-accent)" }}>
                {group.title}
              </div>
              <div style={{ display: "grid", gap: "7px" }}>
                {group.items.map(([key, action]) => (
                  <div key={`${group.title}-${key}`} style={{ display: "grid", gridTemplateColumns: "112px 1fr", alignItems: "center", gap: "10px" }}>
                    <kbd style={{
                      justifySelf: "start", padding: "3px 8px", borderRadius: "6px",
                      border: "1px solid var(--db-panel-border)", background: "var(--db-input-bg)",
                      color: "var(--db-accent)", font: "600 0.78rem var(--font-geist-mono), monospace",
                    }}>
                      {key}
                    </kbd>
                    <span style={{ fontSize: "0.88rem", color: "var(--db-text)", opacity: 0.88 }}>{action}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
