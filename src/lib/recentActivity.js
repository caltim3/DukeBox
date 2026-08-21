"use client"

// Tiny shared "what did I just do" log for the Practice Home screen's
// "Jump back in" row. Written from the real action sites in page.js
// (switching workspaces, loading a starter/song/form), read by
// PickupPracticeHome.jsx whenever it's about to show the home screen.
//
// Deliberately not React state: PickupPracticeHome is a fully decoupled,
// DOM-driven "remote control" over the app (see its own findClickableByText
// etc.), so the log lives in localStorage rather than requiring prop
// plumbing between two components that otherwise share nothing.

const KEY = "dukebox.recentActivity"
// Home's "Jump back in" row shows the last 5 (was 4) — once the log can hold
// a workspace switch, a song, a Line Lab line and a reference guide all at
// once, 4 ran out too fast.
const MAX_ENTRIES = 5

export function getRecentActivity() {
  if (typeof window === "undefined") return []
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || "[]")
    return Array.isArray(raw) ? raw.slice(0, MAX_ENTRIES) : []
  } catch {
    return []
  }
}

// entry: { label, subtitle, art, action: { type, value } }
// action.type is one of "workspace" | "starter" | "section" | "songbook" |
// "linelab" | "reference", the same vocabulary PickupPracticeHome's
// runAction() already understands.
export function logActivity(entry) {
  if (typeof window === "undefined" || !entry?.label) return
  try {
    const existing = getRecentActivity().filter((item) => item.label !== entry.label)
    const next = [{ ...entry, at: Date.now() }, ...existing].slice(0, MAX_ENTRIES)
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // localStorage unavailable (private mode, quota) — history is a nicety, not critical
  }
}

// What kind of thing a logged entry is — drives the small tag Home shows
// next to each "Jump back in" row (and the adaptive "right where you left
// off" hero, which is just entry #0 read the same way).
const KIND_BY_TYPE = {
  workspace: "Workspace",
  songbook: "Song",
  starter: "Song",
  reference: "Reference",
}
export function entryKind(entry) {
  const action = entry?.action
  // Line Lab logs through the same "create-section" action every other
  // Create panel uses (so runAction needs no dedicated case for it) — this
  // is the one place that still needs to tell it apart, for the tag.
  if (action?.type === "create-section" && action.value === "create-line-lab") return "Line Lab"
  return KIND_BY_TYPE[action?.type] || "Activity"
}
