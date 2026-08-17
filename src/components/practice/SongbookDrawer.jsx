"use client"

// The song library drawer — a global "/" overlay onto the same catalog and
// picker (SongLibrarySidebar) the Gig tab uses, so a tune found here is the
// exact same entry Gig Mode would open. Renders at the app root (not gated
// to Practice), so "/" works from any workspace. Export/import stay wired
// to whatever chart is currently loaded in the engine, unrelated to the
// picker's own selection.

import { useEffect, useRef } from "react"
import Drawer, { DrawerScrim } from "./Drawer"
import SongLibrarySidebar from "@/components/SongLibrarySidebar"

const exportBtnStyle = {
  font: "600 11px 'Instrument Sans', sans-serif", padding: "6px 10px", borderRadius: "8px",
  border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text)", flex: "1 1 auto", minWidth: "80px", cursor: "pointer",
}

export default function SongbookDrawer({
  open,
  onClose,
  library,
  setLibrary,
  selectedId,
  onPick,
  selectStyle,
  onExportPdf,
  onExportMusicXml,
  onExportImprovGuide,
  onExportNotion,
  onImportClick,
  importModal,
}) {
  const searchWrapRef = useRef(null)

  // Cursor lands in the search box as soon as the drawer opens — from the
  // Practice Home "Practice a Song" card, from the 📚 icon, the "/" shortcut
  // from anywhere.
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
        title="📚 Song Library"
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
        <div ref={searchWrapRef}>
          <SongLibrarySidebar
            library={library}
            setLibrary={setLibrary}
            selectedId={selectedId}
            onSelect={onPick}
            selectStyle={selectStyle}
          />
        </div>

        {importModal}
      </Drawer>
    </>
  )
}
