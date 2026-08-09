"use client"

// Gig Mode — the Rhino Gig Book reborn inside DukeBox. Stage-readable charts,
// themes, setlists (drag to reorder), search, print, and — the integration
// payoff — "Play" loads any gig chart into the DukeBox engine for full-band
// playback. Setlists live in the synced library (cross-device).

import { useMemo, useRef, useState } from "react"
import { GIGBOOK_SONGS, gigSongToBars, parseGigKey, gigTempoNumber } from "@/lib/music/gigbook"
import { FORMS, FORM_NAMES } from "@/lib/music/forms"

// Gig charts consume the same app-wide semantic theme as every other workspace.
const THEME = {
  bg: "var(--bg)", panel: "var(--surface)", ink: "var(--text)", muted: "var(--muted)",
  line: "var(--line)", accent: "var(--accent)", accentInk: "var(--accent-ink)",
  chordBg: "var(--surface2)", chordBorder: "var(--line)",
}

// ─── Build a uniform {id, title, key, source, chart} for any song source ─────
function barsToSections(bars) {
  const out = []
  let cur = null
  for (const b of bars) {
    const name = b.section || "A"
    if (!cur || cur.name !== name) { cur = { name, chords: [] }; out.push(cur) }
    cur.chords.push(b.symbol)
  }
  return out
}

function buildPool() {
  const pool = []
  for (const s of GIGBOOK_SONGS) {
    pool.push({
      id: `gig:${s.id}`, title: s.title, key: s.key, feel: s.feel, tempo: s.tempo,
      credit: s.credit, refArtist: s.refArtist, note: s.note, form: s.form,
      source: "Gig Book", sections: s.sections, _gig: s,
    })
  }
  for (const name of FORM_NAMES) {
    if (name === "Custom") continue
    const f = FORMS[name]
    if (!f?.bars?.length) continue
    pool.push({
      id: `form:${name}`, title: name, key: `${f.keyRoot} ${f.keyMode}`, tempo: f.tempo,
      source: "Songbook", sections: barsToSections(f.bars), _form: f,
    })
  }
  return pool
}

export default function GigMode({
  library, setLibrary, onLoadSong, panelStyle, eyebrowStyle, selectStyle,
  activeSongId = null, playheadIndex = null, isPlaying = false, onStop,
}) {
  const setlists = library?.setlists ?? []
  const librarySongs = library?.songs

  const pool = useMemo(() => {
    const base = buildPool()
    const user = (librarySongs ?? []).map(s => ({
      id: `user:${s.name}`, title: s.name, key: `${s.keyRoot || "C"} ${s.keyMode || "major"}`,
      tempo: s.tempo, source: "My Library", sections: barsToSections(s.bars || []), _user: s,
    }))
    return [...user, ...base]
  }, [librarySongs])

  const poolById = useMemo(() => Object.fromEntries(pool.map(s => [s.id, s])), [pool])

  const theme = THEME
  const [chordSize, setChordSize] = useState(24)
  const [query, setQuery] = useState("")
  const [activeSetlist, setActiveSetlist] = useState(null)   // setlist id or null (all songs)
  const [openId, setOpenId] = useState(pool[0]?.id ?? null)
  const dragIdx = useRef(null)

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

  const openSong = poolById[openId] || pool[0] || null

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

  function songToBars(song) {
    if (song._gig) return gigSongToBars(song._gig)
    if (song._form) return song._form.bars
    if (song._user) return song._user.bars
    return []
  }

  function loadSong(song, autoplay) {
    const bars = songToBars(song)
    if (!bars.length) return
    // Gig Book keys are written "Am" / "Gm / Bb", so they go through
    // parseGigKey rather than being split on whitespace — otherwise the Key
    // select is handed "Am", which is not a root it knows.
    const parsed = parseGigKey(song.key)
    const keyRoot = song._form?.keyRoot || song._user?.keyRoot || parsed.keyRoot
    const keyMode = song._form?.keyMode || song._user?.keyMode || parsed.keyMode
    onLoadSong?.({
      bars, keyRoot, keyMode, tempo: gigTempoNumber(song.tempo),
      title: song.title, autoplay, songId: song.id,
    })
  }

  // gigSongToBars flattens sections in order, one chord per bar, so the engine's
  // bar index maps 1:1 onto the chord cells rendered below. Precompute the flat
  // index of each cell so the playhead can light the right one.
  const flatIndexOf = useMemo(() => {
    const map = []
    let n = 0
    for (const sec of (openSong?.sections ?? [])) {
      const row = []
      for (let i = 0; i < sec.chords.length; i++) row.push(n++)
      map.push(row)
    }
    return map
  }, [openSong])

  // Only light the chart that's actually loaded into the engine
  const liveHere = openSong && activeSongId === openSong.id && playheadIndex != null

  const listForPool = setlistSongs ?? filtered

  return (
    <div style={{ ...panelStyle, background: theme.bg, color: theme.ink, border: `1px solid ${theme.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
        <div style={{ ...eyebrowStyle, marginBottom: 0, color: theme.accent }}>GIG MODE</div>
        <div style={{ fontSize: "0.78rem", color: theme.muted }}>
          Stage-ready charts · setlists · {pool.length} tunes · any chart plays with the full band
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }} className="gig-no-print">
          <label style={{ fontSize: "0.78rem", color: theme.muted, display: "flex", alignItems: "center", gap: "6px" }}>
            Size
            <input type="range" min="16" max="40" value={chordSize} onChange={e => setChordSize(Number(e.target.value))} />
          </label>
          <button onClick={() => window.print()} style={ghostBtn(theme)} aria-label="Print this chart" title="Print — uses your browser's print dialog">🖨 Print</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 300px) 1fr", gap: "16px" }} className="gig-grid">
        {/* ── Sidebar: setlists + song pool ── */}
        <div className="gig-no-print" style={{ minWidth: 0 }}>
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
              data-db-shortcut="gig-search"
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
              const inSet = currentSetlist?.songIds.includes(song.id)
              const isOpen = song.id === openId
              return (
                <div
                  key={song.id + i}
                  draggable={!!currentSetlist}
                  onDragStart={() => { dragIdx.current = i }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => { if (currentSetlist && dragIdx.current != null) reorderSetlist(dragIdx.current, i); dragIdx.current = null }}
                  onClick={() => setOpenId(song.id)}
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
                  {!currentSetlist ? (
                    setlists.length > 0 && activeSetlist === null ? null : null
                  ) : null}
                  {currentSetlist && (
                    <button onClick={e => { e.stopPropagation(); toggleInSetlist(song.id) }} style={ghostBtn(theme)} aria-label={`Remove ${song.title} from setlist`} title="Remove from setlist">−</button>
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

        {/* ── Stage chart ── */}
        <div style={{ minWidth: 0 }}>
          {openSong ? (
            <div className="gig-chart" style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: "14px", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap", marginBottom: "4px" }}>
                <h2 style={{ margin: 0, fontSize: "1.6rem", color: theme.ink }}>{openSong.title}</h2>
                {openSong.credit && <span style={{ color: theme.muted, fontStyle: "italic" }}>{openSong.credit}</span>}
                <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }} className="gig-no-print">
                  <button onClick={() => loadSong(openSong, false)} style={solidBtn(theme)} title="Load this tune into the editor">Load</button>
                  {liveHere && isPlaying ? (
                    <button onClick={() => onStop?.()} style={solidBtn(theme)} title="Stop playback">⏹ Stop</button>
                  ) : (
                    <button onClick={() => loadSong(openSong, true)} style={solidBtn(theme)} title="Load and play with the full band — the chart stays open and follows along">▶ Play</button>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "0.82rem", color: theme.muted, marginBottom: "14px" }}>
                {openSong.key && <span><b style={{ color: theme.ink }}>Key</b> {openSong.key}</span>}
                {openSong.feel && <span><b style={{ color: theme.ink }}>Feel</b> {openSong.feel}</span>}
                {openSong.tempo && <span><b style={{ color: theme.ink }}>Tempo</b> {openSong.tempo}</span>}
                {openSong.form && <span><b style={{ color: theme.ink }}>Form</b> {openSong.form}</span>}
                {openSong.refArtist && <span><b style={{ color: theme.ink }}>Ref</b> {openSong.refArtist}</span>}
              </div>
              {openSong.note && (
                <div style={{ fontSize: "0.85rem", color: theme.muted, marginBottom: "16px", paddingLeft: "10px", borderLeft: `3px solid ${theme.accent}` }}>
                  {openSong.note}
                </div>
              )}

              {openSong.sections.map((sec, si) => (
                <div key={si} style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: theme.accent, marginBottom: "6px" }}>
                    {sec.name}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }} className="gig-chord-grid">
                    {sec.chords.map((chord, ci) => {
                      const isNow = liveHere && flatIndexOf[si]?.[ci] === playheadIndex
                      return (
                        <div
                          key={ci}
                          ref={isNow ? (el) => el?.scrollIntoView({ block: "nearest", behavior: "smooth" }) : null}
                          style={{
                            background: isNow
                              ? `color-mix(in srgb, ${theme.accent} 78%, ${theme.panel})`
                              : theme.chordBg,
                            border: `2px solid ${isNow ? theme.accent : theme.chordBorder}`,
                            borderRadius: "8px",
                            padding: "10px 6px", textAlign: "center", fontWeight: 700,
                            color: isNow ? theme.accentInk : theme.ink,
                            fontSize: `${chordSize}px`, lineHeight: 1.1,
                            boxShadow: isNow ? `0 0 18px ${theme.accent}` : "none",
                            transition: "background 0.12s, color 0.12s, box-shadow 0.12s",
                          }}
                        >
                          {chord}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: theme.muted, padding: "40px", textAlign: "center" }}>No tune selected.</div>
          )}
        </div>
      </div>

      {/* Print rules: hide chrome, show only the open chart */}
      <style>{`
        @media print {
          .gig-no-print { display: none !important; }
          .gig-grid { display: block !important; }
          .gig-chart { border: none !important; }
        }
        @media (max-width: 720px) {
          .gig-grid { grid-template-columns: 1fr !important; }
          .gig-chord-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
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
function solidBtn(theme) {
  return {
    padding: "6px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem",
    background: theme.accent, color: theme.accentInk, border: `1px solid ${theme.accent}`,
  }
}
