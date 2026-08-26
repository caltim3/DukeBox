"use client"

// The song library's browse-and-pick UI: setlist picker, search, and the
// song list itself (drag to reorder a setlist). One component, two homes —
// the Gig tab's sidebar (full-time, feeding its own editor) and the global
// "/" drawer (an overlay reachable from any workspace, feeding whatever
// picked the drawer). Both read the same buildCatalog() pool, so a tune
// found one way is the exact same entry found the other way.

import { useEffect, useMemo, useRef, useState } from "react"
import { buildCatalog } from "@/lib/music/songSource"
import { BUILTIN_PLAYLISTS, resolveActiveList } from "@/lib/music/playlists"

const THEME = {
  panel: "var(--surface)", ink: "var(--text)", muted: "var(--muted)",
  line: "var(--line)", accent: "var(--accent)",
}

export default function SongLibrarySidebar({
  library, setLibrary, selectedId = null, onSelect,
  autoSelectFirst = false, preferId = null, selectStyle, searchShortcutHook,
  // Two-row pill strip alongside the dropdown, one tap per built-in playlist
  // or setlist — off by default so the global "/" drawer keeps its narrower,
  // dropdown-only picker; the Gig tab turns it on.
  showPills = false,
  // "list" is the narrow column both homes started with. "grid" spreads the
  // same tunes across the full width as name cards — what the Gig tab is
  // now, where the library IS the page rather than a rail beside an editor.
  layout = "list",
  // Grid only: the card's primary action (Gig plays the tune). Given one,
  // the card body triggers it and `onSelect` still fires first, so whatever
  // tracks "which tune is open" stays in step.
  onActivate = null,
  // Grid only: a second, quieter action per card (Gig loads without playing).
  secondaryAction = null,
}) {
  const theme = THEME
  const isGrid = layout === "grid"
  const activateLabel = secondaryAction ? "click to play" : "click to open"
  // Memoized (rather than `library?.setlists ?? []` inline) so a missing
  // `setlists` array doesn't hand the resolved-list useMemo below a fresh
  // empty array reference every render.
  const setlists = useMemo(() => library?.setlists ?? [], [library?.setlists])
  const librarySongs = library?.songs
  const recentlyPlayedIds = library?.prefs?.recentlyPlayedIds

  const pool = useMemo(() => buildCatalog(librarySongs ?? []), [librarySongs])
  const poolById = useMemo(() => Object.fromEntries(pool.map(s => [s.id, s])), [pool])

  const [query, setQuery] = useState("")
  // "" (all tunes) | `playlist:<id>` (a built-in above) | `setlist:<id>` (a user setlist)
  const [activeList, setActiveList] = useState("")
  const dragIdx = useRef(null)

  const resolved = useMemo(
    () => resolveActiveList(activeList, { pool, poolById, setlists, recentlyPlayedIds }),
    [activeList, pool, poolById, setlists, recentlyPlayedIds]
  )
  const currentSetlist = resolved?.editable ? resolved.setlist : null
  const currentPlaylist = resolved && !resolved.editable ? resolved.playlist : null

  // Opens onto whatever's already loaded in the engine (`preferId`, e.g.
  // Gig Mode's activeSongId) when nothing is selected yet — which is also
  // how coming back to Gig mid-song lands on the bandstand rather than the
  // wall of cards — falling back to the first tune in the pool — so arriving at the Gig tab after loading a
  // song from the "/" drawer elsewhere shows *that* song, not always the
  // top of the list. The "/" drawer itself passes neither: opening the
  // picker shouldn't silently load a song into the engine. Fires once: after
  // the first onSelect, `selectedId` is no longer null and this goes quiet.
  useEffect(() => {
    if (!autoSelectFirst || selectedId != null) return
    const pick = (preferId && poolById[preferId]) || pool[0]
    if (pick) onSelect?.(pick)
  }, [autoSelectFirst, selectedId, preferId, pool, poolById, onSelect])

  // Searching always runs within whatever's active — the whole catalog for
  // "All tunes" or a built-in playlist, nothing for a setlist (that has its
  // own "add tunes" search further down, since a setlist is a picked set of
  // songIds rather than something to filter into).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = currentPlaylist ? resolved.songs : pool
    if (!q) return base
    return base.filter(s =>
      s.title.toLowerCase().includes(q) ||
      (s.refArtist || "").toLowerCase().includes(q) ||
      (s.source || "").toLowerCase().includes(q))
  }, [pool, query, currentPlaylist, resolved])

  const setlistSongs = currentSetlist ? resolved.songs : null
  const listForPool = setlistSongs ?? filtered

  // ── Setlist mutations (persist through the synced library) ──
  function addSetlist() {
    const name = prompt("Name this setlist:")
    if (!name?.trim()) return
    const id = `sl-${Date.now()}`
    setLibrary(lib => ({ ...lib, setlists: [...(lib.setlists || []), { id, name: name.trim(), songIds: [], updatedAt: Date.now() }] }))
    setActiveList(`setlist:${id}`)
  }
  function deleteSetlist(id) {
    setLibrary(lib => ({ ...lib, setlists: (lib.setlists || []).filter(s => s.id !== id) }))
    if (currentSetlist?.id === id) setActiveList("")
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
          value={activeList}
          onChange={e => setActiveList(e.target.value)}
          style={{ ...selectStyle, flex: 1, padding: "6px 8px", background: theme.panel, color: theme.ink, border: `1px solid ${theme.line}` }}
        >
          <option value="">All tunes ({pool.length})</option>
          <optgroup label="Playlists">
            {BUILTIN_PLAYLISTS.map(p => <option key={p.id} value={`playlist:${p.id}`}>{p.label}</option>)}
          </optgroup>
          {setlists.length > 0 && (
            <optgroup label="Your setlists">
              {setlists.map(s => <option key={s.id} value={`setlist:${s.id}`}>{s.name} ({s.songIds.length})</option>)}
            </optgroup>
          )}
        </select>
        <button onClick={addSetlist} style={ghostBtn(theme)} aria-label="Create a new playlist" title="New playlist">＋</button>
        {currentSetlist && (
          <button onClick={() => deleteSetlist(currentSetlist.id)} style={ghostBtn(theme)} aria-label={`Delete setlist ${currentSetlist.name}`} title="Delete this setlist">🗑</button>
        )}
      </div>

      {/* One tap per playlist instead of opening the dropdown — the built-ins
          first (Songbook's five FORM_CATEGORIES slices among them), then
          whatever setlists exist, then a shortcut to start a new one. Short
          labels + wrap keep this to about two rows at the sidebar's width. */}
      {showPills && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" }}>
          <PlaylistPill active={activeList === ""} onClick={() => setActiveList("")} theme={theme}>All</PlaylistPill>
          {BUILTIN_PLAYLISTS.map(p => (
            <PlaylistPill key={p.id} active={activeList === `playlist:${p.id}`} onClick={() => setActiveList(`playlist:${p.id}`)} theme={theme}>
              {p.label}
            </PlaylistPill>
          ))}
          {setlists.map(s => (
            <PlaylistPill key={s.id} active={activeList === `setlist:${s.id}`} onClick={() => setActiveList(`setlist:${s.id}`)} theme={theme}>
              {s.name}
            </PlaylistPill>
          ))}
          <PlaylistPill onClick={addSetlist} theme={theme} title="Create a new playlist">＋ New</PlaylistPill>
        </div>
      )}

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

      {listForPool.length === 0 && (
        <div style={{ fontSize: "0.78rem", color: theme.muted, padding: "10px 2px" }}>
          {currentPlaylist?.recent ? "Nothing played yet — play a tune and it'll show up here." : "No tunes in this playlist yet."}
        </div>
      )}

      <div className={isGrid ? "db-song-grid" : undefined} style={isGrid
        ? { display: "grid", gap: "8px" }
        : { maxHeight: "520px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
        {listForPool.map((song, i) => {
          const isOpen = song.id === selectedId
          return (
            <div
              key={song.id + i}
              draggable={!!currentSetlist}
              onDragStart={() => { dragIdx.current = i }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (currentSetlist && dragIdx.current != null) reorderSetlist(dragIdx.current, i); dragIdx.current = null }}
              onClick={() => { onSelect?.(song); onActivate?.(song) }}
              title={onActivate ? `${song.title} — ${activateLabel}` : undefined}
              style={{
                display: "flex", alignItems: "center", gap: "8px", padding: isGrid ? "10px 11px" : "7px 9px",
                borderRadius: isGrid ? "10px" : "8px", cursor: "pointer",
                background: isOpen ? `color-mix(in srgb, ${theme.accent} 18%, ${theme.panel})` : theme.panel,
                border: `1px solid ${isOpen ? theme.accent : theme.line}`,
              }}
            >
              {currentSetlist && <span style={{ color: theme.muted, cursor: "grab" }}>☰</span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: isGrid ? "0.95rem" : "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{song.title}</div>
                <div style={{ fontSize: "0.7rem", color: theme.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {song.source} · {song.key}{song.refArtist ? ` · ${song.refArtist}` : ""}
                </div>
              </div>
              {isGrid && secondaryAction && (
                <button
                  onClick={e => { e.stopPropagation(); onSelect?.(song); secondaryAction.onClick(song) }}
                  style={{ ...ghostBtn(theme), padding: "3px 8px", fontSize: "0.7rem" }}
                  title={secondaryAction.title}
                >
                  {secondaryAction.label}
                </button>
              )}
              {currentSetlist ? (
                <button onClick={e => { e.stopPropagation(); toggleInSetlist(song.id) }} style={ghostBtn(theme)} aria-label={`Remove ${song.title} from setlist`} title="Remove from setlist">−</button>
              ) : song.source === "My Library" && (
                <button onClick={e => { e.stopPropagation(); removeFromLibrary(song) }} style={ghostBtn(theme)} aria-label={`Delete ${song.title} from My Library`} title="Delete from My Library">🗑</button>
              )}
            </div>
          )
        })}
      </div>
      {isGrid && (
        <style>{`
          .db-song-grid { grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
          @media (max-width: 520px) { .db-song-grid { grid-template-columns: 1fr; } }
        `}</style>
      )}

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

function PlaylistPill({ active, onClick, theme, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      style={{
        font: "600 10.5px 'Instrument Sans', sans-serif", whiteSpace: "nowrap",
        padding: "4px 9px", borderRadius: "999px", cursor: "pointer",
        background: active ? theme.accent : "transparent",
        color: active ? "var(--accent-ink)" : theme.ink,
        border: `1px solid ${active ? theme.accent : theme.line}`,
      }}
    >
      {children}
    </button>
  )
}
