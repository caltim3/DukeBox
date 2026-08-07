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
const MAX_ENTRIES = 4

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
// action.type is one of "workspace" | "starter" | "section" | "songbook",
// the same vocabulary PickupPracticeHome's runAction() already understands.
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
