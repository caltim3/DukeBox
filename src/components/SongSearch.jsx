"use client"

// SongSearch — a search bar for the songbook that filters across all built-in
// forms, the Gig Book, and the user's cloud library, then loads the pick
// through the caller's handler. Additive: sits next to the Form select,
// removes nothing.

import { useMemo, useRef, useState, useEffect } from "react"

export default function SongSearch({
  formCategories = {},
  userLibrary = [],
  gigSongs = [],
  selectedForm,
  onPick,
  placeholder = "Search songs…",
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef(null)

  // Flatten every song into { name, group, artist, gig } once
  const index = useMemo(() => {
    const rows = []
    for (const e of userLibrary) rows.push({ name: e.name, group: "My Library" })
    for (const [cat, names] of Object.entries(formCategories)) {
      for (const name of names) rows.push({ name, group: cat })
    }
    // Gig Book tunes carry a reference artist, so they can be found the way you
    // remember them ("that Wes tune") rather than only by title.
    for (const s of gigSongs) {
      rows.push({ name: s.title, group: "Gig Book", artist: s.refArtist || s.credit || "", gig: s })
    }
    return rows
  }, [formCategories, userLibrary, gigSongs])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return index.slice(0, 40)
    // Rank: startsWith beats includes; word-boundary beats mid-word;
    // an artist match sits below every title match.
    const scored = index
      .map((r) => {
        const n = r.name.toLowerCase()
        let score = -1
        if (n.startsWith(q)) score = 0
        else if (n.split(/[\s(/-]+/).some((w) => w.startsWith(q))) score = 1
        else if (n.includes(q)) score = 2
        else if ((r.artist || "").toLowerCase().includes(q)) score = 3
        else if ((r.group || "").toLowerCase().includes(q)) score = 4
        return { ...r, score }
      })
      .filter((r) => r.score >= 0)
      .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
    return scored.slice(0, 40)
  }, [query, index])

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  function pick(row) {
    onPick(row.name, row)
    setQuery("")
    setOpen(false)
  }

  function onKeyDown(e) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) { setOpen(true); return }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === "Enter") { e.preventDefault(); if (results[active]) pick(results[active]) }
    else if (e.key === "Escape") { setOpen(false) }
  }

  const q = query.trim().toLowerCase()

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: "1 1 220px", minWidth: "200px" }}>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", opacity: 0.5, fontSize: "var(--db-fs-md)", pointerEvents: "none" }}>
          ⌕
        </span>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Search the songbook"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "6px 10px 6px 28px",
            borderRadius: "var(--db-r-md)",
            border: "1px solid var(--db-panel-border)",
            background: "var(--db-input-bg)",
            color: "var(--db-text)",
            fontSize: "var(--db-fs-md)",
          }}
        />
      </div>

      {open && results.length > 0 && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 40,
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            maxHeight: "320px",
            overflowY: "auto",
            borderRadius: "var(--db-r-md)",
            border: "1px solid var(--db-panel-border)",
            background: "var(--db-panel-bg)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
          }}
        >
          {results.map((r, i) => {
            const isActive = i === active
            const isCurrent = r.name === selectedForm
            const n = r.name
            const hit = q ? n.toLowerCase().indexOf(q) : -1
            return (
              <div
                key={r.group + ":" + r.name}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(r) }}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "10px",
                  padding: "7px 12px",
                  cursor: "pointer",
                  background: isActive ? "color-mix(in srgb, var(--db-accent) 16%, transparent)" : "transparent",
                  borderLeft: isCurrent ? "3px solid var(--db-accent)" : "3px solid transparent",
                }}
              >
                <span style={{ fontSize: "var(--db-fs-md)" }}>
                  {hit >= 0 ? (
                    <>
                      {n.slice(0, hit)}
                      <mark style={{ background: "transparent", color: "var(--db-accent)", fontWeight: 700 }}>
                        {n.slice(hit, hit + q.length)}
                      </mark>
                      {n.slice(hit + q.length)}
                    </>
                  ) : n}
                  {r.artist && (
                    <span style={{ fontSize: "var(--db-fs-xs)", opacity: 0.5, marginLeft: "6px" }}>{r.artist}</span>
                  )}
                </span>
                <span style={{ fontSize: "var(--db-fs-xs)", opacity: 0.5, whiteSpace: "nowrap" }}>{r.group}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
