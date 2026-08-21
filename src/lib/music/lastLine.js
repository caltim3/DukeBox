"use client"

// The single most recent Line Lab line, kept around so Home's "Practice this
// lick" card has something real to draw a tab strip from — same cross-tree
// pattern as recentActivity.js: LineLab writes to localStorage, Home reads it
// whenever it's about to show, no props between two components that
// otherwise share nothing.
//
// The stored `line` is whatever LineLab's own `workingResult` looks like at
// the moment it's saved — { bars: [{ n: [[string, fret, beats, wait], ...],
// c: "chord symbols" }, ...] } — kept in that exact shape so nothing has to
// reshape it to draw from it.

const KEY = "dukebox.lastLine"

export function getLastLine() {
  if (typeof window === "undefined") return null
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || "null")
    return raw?.line?.bars?.length ? raw : null
  } catch {
    return null
  }
}

// snapshot: { line, label, context, keyRoot }
//   line    — the bars/notes, as described above
//   label   — what to call it ("Enclosures over Autumn Leaves", "Licktionary: ...")
//   context — one line of "why", e.g. "bars 3–4, Bb"
export function setLastLine(snapshot) {
  if (typeof window === "undefined" || !snapshot?.line?.bars?.length) return
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...snapshot, at: Date.now() }))
  } catch {
    // storage unavailable (private mode, quota) — the preview is a nicety, not critical
  }
}

// Home's "Practice this lick" button asks Line Lab to actually load the
// line back in, not just navigate there. Line Lab is unmounted whenever
// you're not on Create (page.js only renders it under inMode("create")),
// and Home has no props into it either way — a window event is the only
// channel that reaches a component that may not exist yet. Line Lab reads
// the snapshot itself via getLastLine() once it hears this; the event
// carries no payload.
export const RESUME_LAST_LINE_EVENT = "dukebox:resume-last-line"

export function requestResumeLastLine() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(RESUME_LAST_LINE_EVENT))
}
