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
import { OPEN_LIBRARY_EVENT, GO_GIG_EVENT, GO_PRACTICE_EVENT, EXIT_FOCUS_EVENT } from "@/lib/music/songSource"

// Grouped by what you're trying to do, not by loose technical category —
// the old split had Tempo sitting oddly apart from Chart & Playback even
// though you reach for both mid-performance, hands already busy at the
// fretboard. They're one group now: "While you're playing". No key in this
// file changed meaning anywhere in this pass — this array only changed
// which section each one is filed under.
const GROUPS = [
  {
    title: "Get around",
    items: [
      ["0", "Home, from anywhere"],
      ["1", "Practice — 3:2's Blues scale, in Focus"],
      ["2", "Songbook — 3:2's Minor, in Focus"],
      ["3", "Compose — 3:2's Major, in Focus"],
      ["4", "BeatForge — 3:2's Altered, in Focus"],
      ["5", "Skeleton Key — Pathways' Color rung, in Focus"],
      ["6", "Tonal"],
      ["7", "Reference"],
      ["/", "Song library, from anywhere"],
      ["?", "Show or hide this sheet"],
    ],
  },
  {
    title: "Open a tool",
    items: [
      ["G", "Song library in Songbook"],
      ["F", "Fretboard — Freeze, once you're in Practice"],
      ["L", "Line Lab"],
      ["B", "BeatForge Library"],
      ["Y", "5 minute practice timer"],
    ],
  },
  {
    title: "While you're playing",
    items: [
      ["Space", "Play or stop"],
      ["←  →", "Previous or next bar"],
      ["↑  ↓", "Cycle chord quality"],
      ["⌘/Ctrl C", "Copy selected bar"],
      ["⌘/Ctrl V", "Paste selected bar"],
      ["Double-click", "Loop one chord"],
      ["[", "Tempo slower by 5"],
      ["]", "Tempo faster by 5"],
      ["P", "Tempo slower by 10"],
      ["\\", "Tempo faster by 10"],
      ["=", "Tempo back to where you were"],
      ["F", "Freeze on / off"],
      ["I", "3:2 System on / off"],
      ["V", "Voice Leading on / off"],
    ],
  },
  {
    title: "Look & feel",
    items: [
      [";", "Cycle color palette"],
      ["'", "Light / dark toggle"],
      ["O", "Cockpit / Focus view"],
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
// we go through home's own nav pills instead, which dismiss the shell. Those
// pills are labelled with the plain workspace names, so the lookup is by
// label directly — an older map here still spelled two of them "Practice
// center" and "Gig mode", which matched nothing and quietly fell back.
function homeIsOpen() {
  return document.body.classList.contains("db-pickup-home-open")
}

function goWorkspace(label) {
  if (homeIsOpen()) {
    const wanted = label.toLowerCase()
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

      // In Focus, "1"-"4" pick the 3:2 System's level instead — see page.js's
      // own keydown handler, where that state lives. Don't preventDefault/
      // stopPropagation here; let the keydown fall through to page.js's
      // bubble-phase listener untouched. "6" (Tonal) is untouched either way,
      // and "5" (Reference) yields only while Scale Pathways is on
      // (body.dataset.dbPathways, stamped by page.js) — its rung ladder runs
      // 1-5, one past the 3:2 System's levels.
      const inFocusStage = () => document.body.classList.contains("db-focus-mode")
      const pathwaysOn = () => document.body.dataset.dbPathways === "true"

      // "0" is the one digit that means the same thing everywhere, Focus
      // included: go Home. It used to stand down inside Focus so the 3:2
      // System could have a level 0, which made the way out of Focus depend
      // on which system happened to be up.
      if (event.key === "0") {
        event.preventDefault()
        event.stopPropagation()
        goHome()
        return
      }

      // The numbering matches the order the tabs sit in, left to right after
      // Home: Practice, Songbook, Compose, BeatForge, Skeleton Key, Tonal,
      // Reference.
      const workspaces = {
        "1": "Practice", "2": "Songbook", "3": "Compose", "4": "BeatForge",
        "5": "Skeleton Key", "6": "Tonal", "7": "Reference",
      }
      if (workspaces[event.key]) {
        // Focus keeps the low digits for its own ladders: 3:2's levels run
        // 1-4, and Scale Pathways' rungs run 1-5. So 1-4 always stand down
        // there, 5 stands down only while Pathways is up, and 6-7 are past
        // the end of both ladders and work everywhere.
        const focusOwnsThisDigit =
          inFocusStage() && !["6", "7"].includes(event.key) &&
          (event.key !== "5" || pathwaysOn())
        if (focusOwnsThisDigit) return
        event.preventDefault()
        event.stopPropagation()
        // Practice and Songbook go by event rather than goWorkspace()'s
        // DOM-click: Focus's phone-first stage renders no [role="tab"] chrome
        // to click, so pressing either to leave Focus would silently no-op.
        // "1" asks for Practice's CORE view specifically — clicking the tab
        // lands on whichever surface practiceView was left on, which could be
        // Focus, and "go to Practice" should not mean "go deeper into Focus".
        if (event.key === "1") {
          window.dispatchEvent(new CustomEvent(GO_PRACTICE_EVENT))
        } else if (event.key === "2") {
          window.dispatchEvent(new CustomEvent(GO_GIG_EVENT))
        } else if (inFocusStage()) {
          // The digits Focus doesn't claim still have to get out of it. Focus
          // renders no [role="tab"] chrome, so clicking a tab finds nothing;
          // leave the stage first, then wait for the tabs to mount and click.
          window.dispatchEvent(new CustomEvent(EXIT_FOCUS_EVENT))
          const wanted = workspaces[event.key]
          waitFor(
            () => Array.from(document.querySelectorAll('[role="tab"]'))
              .find((el) => (el.textContent || "").trim().toLowerCase().includes(wanted.toLowerCase())),
            (el) => el.click()
          )
        } else {
          goWorkspace(workspaces[event.key])
        }
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

      // Songbook's library moved off `\`, which now nudges the tempo up 10
      // (handled in page.js, where the transport state lives).
      if (key === "g") {
        event.preventDefault()
        event.stopPropagation()
        goWorkspace("Songbook")
        // Songbook renders its library search only when no setlist is open.
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
        goWorkspace("BeatForge")
        waitFor(
          () => document.getElementById("beatforge-line-lab"),
          (section) => { section.open = true; reveal(section) },
        )
        return
      }

      if (key === "b") {
        event.preventDefault()
        event.stopPropagation()
        goWorkspace("BeatForge")
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
        // Above PickupPracticeHome's fixed shell (z-index 10000) and its
        // drawers (10080/10090, see practice/Drawer.jsx) — "?" is meant to
        // work from anywhere, Home included.
        position: "fixed", inset: 0, zIndex: 10100,
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
