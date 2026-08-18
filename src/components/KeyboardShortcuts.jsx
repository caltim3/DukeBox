"use client"

// The one keyboard-shortcut legend and the handler for everything it lists
// that isn't already owned by the Practice page.
//
// Two things used to make this unreliable, both fixed here:
//   · There were TWO `?` cheatsheets (this overlay and a second modal inside
//     page.js). This one listens in the capture phase and stops propagation,
//     so page.js's copy could never open — it was dead code showing a stale
//     list. page.js's modal is gone; this is the single source of truth.
//   · Jump shortcuts found their target by matching button *label text*, so
//     they broke silently every time a control was renamed. Targets now carry
//     stable `data-db-shortcut` hooks instead.
//
// Chart/playback keys (Space, arrows, copy/paste) and the two theme keys
// (; and ') are handled inside page.js, where that state lives — they are
// listed here so the legend stays complete.

import { useEffect, useState } from "react"
import { goHome as requestHome } from "@/lib/homeNav"
import { OPEN_LIBRARY_EVENT, ENTER_FOCUS_EVENT, GO_GIG_EVENT } from "@/lib/music/songSource"

const GROUPS = [
  {
    title: "Workspaces",
    items: [
      ["0", "Home — 3:2 System's Chord scales, once you're in Focus"],
      ["1", "Practice — Focus, while playing; 3:2's Blues scale, in Focus"],
      ["2", "Gig — live chart, while playing; 3:2's Minor, in Focus"],
      ["3", "Create — 3:2's Major, in Focus"],
      ["4", "Reference — 3:2's Altered, in Focus"],
      ["5", "Tonal"],
    ],
  },
  {
    title: "Jump to",
    items: [
      ["/", "Song library, from anywhere"],
      ["G", "Song library in Gig"],
      ["F", "Fretboard — Freeze, once you're in Practice"],
      ["L", "Licktionary"],
      ["B", "BeatForge Library"],
      ["Y", "5 minute practice timer"],
    ],
  },
  {
    title: "Chart & playback",
    items: [
      ["Space", "Play or stop"],
      ["←  →", "Previous or next bar"],
      ["↑  ↓", "Cycle chord quality"],
      ["⌘/Ctrl C", "Copy selected bar"],
      ["⌘/Ctrl V", "Paste selected bar"],
      ["Double-click", "Loop one chord"],
      ["F", "Freeze on / off"],
      ["I", "3:2 System on / off"],
      ["V", "Voice Leading on / off"],
    ],
  },
  {
    title: "Tempo",
    items: [
      ["P", "Slower by 10 BPM"],
      ["[", "Slower by 5 BPM"],
      ["]", "Faster by 5 BPM"],
      ["\\", "Faster by 10 BPM"],
      ["=", "Back to where you were"],
    ],
  },
  {
    title: "Views",
    items: [
      [";", "Cycle color palette"],
      ["'", "Light / dark toggle"],
      ["O", "Cockpit / Focus view"],
      ["?", "Show or hide shortcuts"],
      ["Esc", "Close the current overlay"],
    ],
  },
]

function isTyping() {
  const el = document.activeElement
  return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)
}

function hook(name) {
  return document.querySelector(`[data-db-shortcut="${name}"]`)
}

function reveal(el, { focus = false } = {}) {
  if (!el) return false
  el.scrollIntoView({ behavior: "smooth", block: "center" })
  if (focus) el.focus?.({ preventScroll: true })
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

// The Practice home shell is a fixed overlay above everything, so clicking a
// workspace tab underneath it changes the tab without revealing it. From home
// we go through home's own sidebar nav instead, which dismisses the shell.
const HOME_NAV = {
  Practice: "Practice center",
  Gig: "Gig mode",
  Create: "Create",
  Reference: "Reference",
  Tonal: "Tonal",
}

function homeIsOpen() {
  return document.body.classList.contains("db-pickup-home-open")
}

function goWorkspace(label) {
  if (homeIsOpen()) {
    const wanted = (HOME_NAV[label] || label).toLowerCase()
    const navButton = Array.from(document.querySelectorAll(".db-pickup-nav-button"))
      .find((el) => (el.textContent || "").trim().toLowerCase() === wanted)
    if (navButton) { navButton.click(); return true }
    document.querySelector(".db-pickup-return-home")?.click()
  }
  return clickWorkspace(label)
}

// Home's nav switches workspaces on a short delay, and panels mount as they
// come into view — so poll for the target rather than guessing one timeout.
function waitFor(get, done, tries = 25) {
  const tick = () => {
    const found = get()
    if (found) { done(found); return }
    if (--tries > 0) window.setTimeout(tick, 40)
  }
  window.setTimeout(tick, 40)
}

function goHome() {
  // PickupPracticeHome owns the home surface — see lib/homeNav. The old
  // version clicked the return-home pill, which only exists on Practice, then
  // fell back to the floating button, which fell back to the Practice tab. So
  // "0" from Gig or Create landed on Practice instead of Home.
  requestHome()
  return true
}

// Open a collapsed PowerPanel / <details> before scrolling to it, so the
// shortcut lands on visible content rather than a closed header.
function openPanel(el) {
  if (!el) return
  if (el.getAttribute?.("aria-expanded") === "false") el.click()
  const details = el.closest?.("details")
  if (details && !details.open) details.open = true
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

      // In Focus, "0"-"4" pick the 3:2 System's level instead — see page.js's
      // own keydown handler, where that state lives. Don't preventDefault/
      // stopPropagation here; let the keydown fall through to page.js's
      // bubble-phase listener untouched. "5" (Tonal) is untouched either way
      // — the 3:2 System only has levels 0-4.
      const inFocusStage = () => document.body.classList.contains("db-focus-mode")

      const workspaces = { "1": "Practice", "2": "Gig", "3": "Create", "4": "Reference", "5": "Tonal" }
      if (workspaces[event.key]) {
        if (event.key !== "5" && inFocusStage()) return
        event.preventDefault()
        event.stopPropagation()
        // While a song is playing, "1" means "back to Focus" specifically —
        // not just Practice, wherever practiceView last happened to be.
        // "2" always goes by event, not goWorkspace()'s DOM-click — Focus's
        // phone-first stage renders no [role="tab"] chrome to click, so
        // pressing "2" to leave Focus for Gig would silently no-op otherwise.
        if (event.key === "1" && document.body.dataset.dbPlaying === "true") {
          window.dispatchEvent(new CustomEvent(ENTER_FOCUS_EVENT))
        } else if (event.key === "2") {
          window.dispatchEvent(new CustomEvent(GO_GIG_EVENT))
        } else {
          goWorkspace(workspaces[event.key])
        }
        return
      }

      if (event.key === "0") {
        if (inFocusStage()) return
        event.preventDefault()
        event.stopPropagation()
        goHome()
        return
      }

      const key = event.key.toLowerCase()

      // The song library drawer renders at the app root and opens by event
      // (page.js has no props into this component), so it works from
      // wherever you are — no workspace jump needed first. It focuses its
      // own search box on open.
      if (key === "/") {
        event.preventDefault()
        event.stopPropagation()
        window.dispatchEvent(new CustomEvent(OPEN_LIBRARY_EVENT))
        return
      }

      // Gig's library moved off `\`, which now nudges the tempo up 10 (handled
      // in page.js, where the transport state lives).
      if (key === "g") {
        event.preventDefault()
        event.stopPropagation()
        goWorkspace("Gig")
        // Gig renders its library search only when no setlist is open.
        waitFor(() => hook("gig-search"), (el) => reveal(el, { focus: true }))
        return
      }

      // In Practice, "F" is Freeze instead — see page.js's own keydown
      // handler, where that state lives. Don't preventDefault/stopPropagation
      // here; let the keydown fall through to page.js's bubble-phase listener
      // untouched. Everywhere else, "F" still jumps to the fretboard.
      if (key === "f") {
        if (document.body.dataset.dbMode === "practice") return
        event.preventDefault()
        event.stopPropagation()
        goWorkspace("Practice")
        waitFor(() => hook("fretboard"), (el) => reveal(el))
        return
      }

      if (key === "l") {
        event.preventDefault()
        event.stopPropagation()
        goWorkspace("Create")
        waitFor(
          () => document.getElementById("db-licktionary"),
          (section) => { section.open = true; reveal(section) },
        )
        return
      }

      if (key === "b") {
        event.preventDefault()
        event.stopPropagation()
        goWorkspace("Practice")
        waitFor(() => hook("beatforge-library"), (header) => { openPanel(header); reveal(header) })
        return
      }

      // Arms a 5-minute countdown: open the Timer drawer, select 5 min, and
      // reset it to a full 5:00. It ticks down with the transport (the band is
      // this app's one master practice control), so it starts on play.
      if (key === "y") {
        event.preventDefault()
        event.stopPropagation()
        goWorkspace("Practice")
        waitFor(
          () => document.querySelector('[aria-label="Open Timer"]'),
          (btn) => {
            btn.click()
            waitFor(() => hook("timer-length"), (select) => {
              select.value = "300"
              select.dispatchEvent(new Event("change", { bubbles: true }))
              reveal(select)
            })
          },
        )
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
        padding: "20px", background: "var(--overlay)",
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
          boxShadow: "0 24px 80px var(--shadow)",
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
