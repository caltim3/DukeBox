"use client"

// The song library's browse-and-pick UI: setlist picker, search, and the
// song list itself (drag to reorder a setlist). One component, two homes —
// the Gig tab's sidebar (full-time, feeding its own editor) and the global
// "/" drawer (an overlay reachable from any workspace, feeding whatever
// picked the drawer). Both read the same buildCatalog() pool, so a tune
// found one way is the exact same entry found the other way.

import { useEffect, useMemo, useRef, useState } from "react"
import { buildCatalog } from "@/lib/music/songSource"

const THEME = {
  panel: "var(--surface)", ink: "var(--text)", muted: "var(--muted)",
  line: "var(--line)", accent: "var(--accent)",
}

export default function SongLibrarySidebar({
  library, setLibrary, selectedId = null, onSelect,
  autoSelectFirst = false, preferId = null, selectStyle, searchShortcutHook,
}) {
  const theme = THEME
  const setlists = library?.setlists ?? []
  const librarySongs = library?.songs

  const pool = useMemo(() => buildCatalog(librarySongs ?? []), [librarySongs])
  const poolById = useMemo(() => Object.fromEntries(pool.map(s => [s.id, s])), [pool])

  const [query, setQuery] = useState("")
  const [activeSetlist, setActiveSetlist] = useState(null)   // setlist id or null (all songs)
  const dragIdx = useRef(null)

  // Opens onto whatever's already loaded in the engine (`preferId`, e.g.
  // Gig Mode's activeSongId) when nothing is selected yet, falling back to
  // the first tune in the pool — so arriving at the Gig tab after loading a
  // song from the "/" drawer elsewhere shows *that* song, not always the
  // top of the list. The "/" drawer itself passes neither: opening the
  // picker shouldn't silently load a song into the engine. Fires once: after
  // the first onSelect, `selectedId` is no longer null and this goes quiet.
  useEffect(() => {
    if (!autoSelectFirst || selectedId != null) return
    const pick = (preferId && poolById[preferId]) || pool[0]
    if (pick) onSelect?.(pick)
  }, [autoSelectFirst, selectedId, preferId, pool, poolById, onSelect])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return pool
    return pool.filter(s =>
      s.title.toLowerCase().includes(q) ||
      (s.refArtist || "").toLowerCase().includes(q) ||
      (s.source || "").toLowerCase().includes(q))
  }, [pool, query])

  const currentSetlist = setlists.find(s => s.id === activeSetlist) || null
  const setlistSongs = currentSetlist
    ? currentSetlist.songIds.map(id => poolById[id]).filter(Boolean)
    : null
  const listForPool = setlistSongs ?? filtered

  // ── Setlist mutations (persist through the synced library) ──
  function addSetlist() {
    const name = prompt("Name this setlist:")
    if (!name?.trim()) return
    const id = `sl-${Date.now()}`
    setLibrary(lib => ({ ...lib, setlists: [...(lib.setlists || []), { id, name: name.trim(), songIds: [], updatedAt: Date.now() }] }))
    setActiveSetlist(id)
  }
  function deleteSetlist(id) {
    setLibrary(lib => ({ ...lib, setlists: (lib.setlists || []).filter(s => s.id !== id) }))
    if (activeSetlist === id) setActiveSetlist(null)
  }
  function toggleInSetlist(songId) {
    if (!currentSetlist) return
    setLibrary(lib => ({
      ...lib,
      setlists: (lib.setlists || []).map(s => {
        if (s.id !== currentSetlist.id) return s
        const has = s.songIds.includes(songId)
        return { ...s, updatedAt: Date.now(), songIds: has ? s.songIds.filter(x => x !== songId) : [...s.songIds, songId] }
      }),
    }))
  }
  function reorderSetlist(from, to) {
    if (!currentSetlist || from === to) return
    setLibrary(lib => ({
      ...lib,
      setlists: (lib.setlists || []).map(s => {
        if (s.id !== currentSetlist.id) return s
        const ids = [...s.songIds]
        const [moved] = ids.splice(from, 1)
        ids.splice(to, 0, moved)
        return { ...s, songIds: ids, updatedAt: Date.now() }
      }),
    }))
  }
  // My Library entries only — built-ins aren't per-user rows, so they can't
  // be deleted, only forked (see upsertLibrarySong). Mirrors the remove
  // button the old Songbook drawer had, now available everywhere the
  // library is browsed.
  function removeFromLibrary(song) {
    if (song.source !== "My Library") return
    setLibrary(lib => ({ ...lib, songs: (lib.songs || []).filter(s => s.name !== song.title) }))
  }

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "8px" }}>
        <select
          value={activeSetlist ?? ""}
          onChange={e => setActiveSetlist(e.target.value || null)}
          style={{ ...selectStyle, flex: 1, padding: "6px 8px", background: theme.panel, color: theme.ink, border: `1px solid ${theme.line}` }}
        >
          <option value="">All tunes ({pool.length})</option>
          {setlists.map(s => <option key={s.id} value={s.id}>{s.name} ({s.songIds.length})</option>)}
        </select>
        <button onClick={addSetlist} style={ghostBtn(theme)} aria-label="Create a new setlist" title="New setlist">＋</button>
        {currentSetlist && (
          <button onClick={() => deleteSetlist(currentSetlist.id)} style={ghostBtn(theme)} aria-label={`Delete setlist ${currentSetlist.name}`} title="Delete this setlist">🗑</button>
        )}
      </div>

      {!currentSetlist && (
        <input
          data-db-shortcut={searchShortcutHook}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search title or artist…"
          style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: "8px", marginBottom: "8px",
            background: theme.panel, color: theme.ink, border: `1px solid ${theme.line}` }}
        />
      )}

      {currentSetlist && (
        <div style={{ fontSize: "0.72rem", color: theme.muted, marginBottom: "6px" }}>
          Drag to reorder tonight&apos;s set. Add tunes from “All tunes”.
        </div>
      )}

      <div style={{ maxHeight: "520px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
        {listForPool.map((song, i) => {
          const isOpen = song.id === selectedId
          return (
            <div
              key={song.id + i}
              draggable={!!currentSetlist}
              onDragStart={() => { dragIdx.current = i }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (currentSetlist && dragIdx.current != null) reorderSetlist(dragIdx.current, i); dragIdx.current = null }}
              onClick={() => onSelect?.(song)}
              style={{
                display: "flex", alignItems: "center", gap: "8px", padding: "7px 9px", borderRadius: "8px", cursor: "pointer",
                background: isOpen ? `color-mix(in srgb, ${theme.accent} 18%, ${theme.panel})` : theme.panel,
                border: `1px solid ${isOpen ? theme.accent : theme.line}`,
              }}
            >
              {currentSetlist && <span style={{ color: theme.muted, cursor: "grab" }}>☰</span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{song.title}</div>
                <div style={{ fontSize: "0.7rem", color: theme.muted }}>{song.source} · {song.key}</div>
              </div>
              {currentSetlist ? (
                <button onClick={e => { e.stopPropagation(); toggleInSetlist(song.id) }} style={ghostBtn(theme)} aria-label={`Remove ${song.title} from setlist`} title="Remove from setlist">−</button>
              ) : song.source === "My Library" && (
                <button onClick={e => { e.stopPropagation(); removeFromLibrary(song) }} style={ghostBtn(theme)} aria-label={`Delete ${song.title} from My Library`} title="Delete from My Library">🗑</button>
              )}
            </div>
          )
        })}
      </div>

      {/* Add-to-setlist picker (when a setlist is active) */}
      {currentSetlist && (
        <details style={{ marginTop: "10px" }}>
          <summary style={{ cursor: "pointer", fontSize: "0.8rem", color: theme.accent }}>＋ Add tunes to “{currentSetlist.name}”</summary>
          <input
            value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…"
            style={{ width: "100%", boxSizing: "border-box", padding: "6px 9px", borderRadius: "8px", margin: "6px 0",
              background: theme.panel, color: theme.ink, border: `1px solid ${theme.line}` }}
          />
          <div style={{ maxHeight: "220px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "3px" }}>
            {filtered.filter(s => !currentSetlist.songIds.includes(s.id)).slice(0, 60).map(s => (
              <button key={s.id} onClick={() => toggleInSetlist(s.id)}
                style={{ ...ghostBtn(theme), textAlign: "left", justifyContent: "flex-start", padding: "5px 9px" }}>
                ＋ {s.title} <span style={{ color: theme.muted, marginLeft: "auto", fontSize: "0.7rem" }}>{s.source}</span>
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function ghostBtn(theme) {
  return {
    display: "inline-flex", alignItems: "center", gap: "6px",
    padding: "5px 10px", borderRadius: "8px", cursor: "pointer", fontSize: "0.8rem",
    background: "transparent", color: theme.ink, border: `1px solid ${theme.line}`,
  }
}
