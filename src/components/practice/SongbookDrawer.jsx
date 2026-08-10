"use client"

// Songbook drawer (spec §5.6). Every handler here is the exact same one the
// old inline "SONGBOOK" panel called — loadForm / loadSearchPick /
// removeFromLibrary / the export functions — just moved into a drawer
// container. The song data (FORM_CATEGORIES, userLibrary, GIGBOOK_SONGS)
// is not restructured, only browsed differently.

import { useEffect, useRef } from "react"
import Drawer, { DrawerScrim } from "./Drawer"
import SongSearch from "@/components/SongSearch"

const rowStyle = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "9px 12px", borderRadius: "8px", background: "transparent", border: "1px solid transparent",
  font: "500 13px 'Instrument Sans', sans-serif", cursor: "pointer", width: "100%", textAlign: "left", color: "var(--text)",
}

const exportBtnStyle = {
  font: "600 11px 'Instrument Sans', sans-serif", padding: "6px 10px", borderRadius: "8px",
  border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text)", flex: "1 1 auto", minWidth: "80px", cursor: "pointer",
}

export default function SongbookDrawer({
  open,
  onClose,
  formCategories,
  userLibrary,
  gigSongs,
  selectedForm,
  onLoadForm,
  onPickSong,
  onRemoveFromLibrary,
  onExportPdf,
  onExportMusicXml,
  onExportImprovGuide,
  onExportNotion,
  onImportClick,
  importModal,
}) {
  const searchWrapRef = useRef(null)

  // Cursor lands in the search box as soon as the drawer opens — from the
  // Practice Home "Practice a Song" card, from the 📚 icon, anywhere.
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      searchWrapRef.current?.querySelector("input")?.focus()
    }, 320)
    return () => window.clearTimeout(timer)
  }, [open])

  return (
    <>
      <DrawerScrim open={open} onClose={onClose} />
      <Drawer
        open={open}
        onClose={onClose}
        side="left"
        title="📚 Songbook"
        footer={(
          <>
            <button style={exportBtnStyle} onClick={onExportPdf} title="Export lead sheet as PDF (Real Book style)">↓ Lead Sheet PDF</button>
            <button style={exportBtnStyle} onClick={onExportMusicXml} title="Export as MusicXML">↓ MusicXML</button>
            <button style={exportBtnStyle} onClick={onExportImprovGuide} title="Export a 5-level improv guide">↓ Improv Guide</button>
            <button style={exportBtnStyle} onClick={onExportNotion} title="Export the improv map to Notion">→ Notion</button>
            <button style={exportBtnStyle} onClick={onImportClick} title="Import songs saved in Bebop Blueprint">⇪ Import BB Songs</button>
          </>
        )}
      >
        <div ref={searchWrapRef} style={{ marginBottom: "14px" }}>
          <SongSearch
            formCategories={formCategories}
            userLibrary={userLibrary}
            gigSongs={gigSongs}
            selectedForm={selectedForm}
            onPick={onPickSong}
          />
        </div>

        {userLibrary.length > 0 && (
          <div style={{ marginBottom: "14px" }}>
            <h5 style={{ font: "800 10.5px 'Archivo', sans-serif", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 8px", paddingBottom: "6px", borderBottom: "1px solid var(--line)" }}>
              My Library
            </h5>
            {userLibrary.map(({ name, key }) => {
              const isCurrent = name === selectedForm
              return (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    style={{
                      ...rowStyle,
                      background: isCurrent ? "color-mix(in srgb, var(--accent) 15%, var(--surface))" : "transparent",
                      borderColor: isCurrent ? "var(--accent)" : "transparent",
                    }}
                    onClick={() => onLoadForm(name)}
                  >
                    <span>{name}</span>
                    {key && <span style={{ color: "var(--muted)", font: "600 11px 'IBM Plex Mono', monospace", marginLeft: "8px" }}>{key}</span>}
                  </button>
                  <button
                    onClick={() => onRemoveFromLibrary(name)}
                    title="Remove this chart from your library"
                    style={{ background: "none", border: "none", color: "var(--hot)", cursor: "pointer", fontSize: "13px", padding: "4px 6px" }}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {Object.entries(formCategories).map(([category, names]) => (
          <div key={category} data-db-category={category} style={{ marginBottom: "14px" }}>
            <h5 style={{ font: "800 10.5px 'Archivo', sans-serif", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 8px", paddingBottom: "6px", borderBottom: "1px solid var(--line)" }}>
              {category}
            </h5>
            {names.map((name) => {
              const isCurrent = name === selectedForm
              return (
                <button
                  key={name}
                  style={{
                    ...rowStyle,
                    background: isCurrent ? "color-mix(in srgb, var(--accent) 15%, var(--surface))" : "transparent",
                    borderColor: isCurrent ? "var(--accent)" : "transparent",
                  }}
                  onClick={() => onLoadForm(name)}
                >
                  {name}
                </button>
              )
            })}
          </div>
        ))}

        {importModal}
      </Drawer>
    </>
  )
}
