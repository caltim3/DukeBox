"use client"

// BeatForge workspace — its own tab, pulled out of Practice and Create.
// Top to bottom: BeatForge Metronome, BeatForge Library, Line Lab,
// Licktionary. Metronome/Library used to live in Practice; Line Lab/
// Licktionary used to live in Create — this tab is where the rhythm and
// phrase-building tools now live together. See docs/ for the full
// integration plan (Phrase Machine joins Line Lab as a fourth source in a
// later step).

import { useEffect, useMemo, useState } from "react"
import MetronomePanel from "@/components/MetronomePanel"
import BeatForgeLibrary from "@/components/BeatForgeLibrary"
import PowerPanel from "@/components/practice/PowerPanel"
import LineLab from "@/components/LineLab"
import Licktionary from "@/components/Licktionary"
import WorkspaceSection from "@/components/WorkspaceSection"
import { inferLineKey, presetLicks } from "@/lib/music/licktionary"

const BUILT_IN_LICKS = presetLicks()
const SAVED_LICKS_KEY = "dukebox.licktionary.v1"

export default function BeatForgeWorkspace({
  beatforgeRef,
  stopPlayback,
  playLineSection,
  onUserGenerate,
  loadedLibraryNum,
  onLoadPattern,
  metronomeOpen,
  libraryOpen,
  onToggleMetronome,
  onToggleLibrary,
  chartBars,
  chartTitle,
  songSheetDraft,
  panelStyle,
  eyebrowStyle,
  selectStyle,
  inlineLabelStyle,
}) {
  const workingBars = songSheetDraft?.bars || chartBars
  const workingTitle = songSheetDraft?.title || chartTitle
  const [savedLicks, setSavedLicks] = useState([])
  const [selectedLickId, setSelectedLickId] = useState(BUILT_IN_LICKS[0]?.id || "")
  const [requestedLick, setRequestedLick] = useState(null)
  const licks = useMemo(() => [...BUILT_IN_LICKS, ...savedLicks], [savedLicks])

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(SAVED_LICKS_KEY) || "[]")
      if (Array.isArray(saved)) setSavedLicks(saved)
    } catch { /* corrupt local data should never break BeatForge */ }
  }, [])

  function saveLick(entry) {
    const lick = {
      ...entry,
      id: `line-lab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      baseKey: entry.baseKey || inferLineKey(entry.line),
      builtIn: false,
      createdAt: new Date().toISOString(),
    }
    setSavedLicks((prev) => {
      const next = [...prev, lick]
      try { window.localStorage.setItem(SAVED_LICKS_KEY, JSON.stringify(next)) } catch {}
      return next
    })
    setSelectedLickId(lick.id)
  }

  function openLickInLineLab(id, key = "C", neckPosition = null) {
    setSelectedLickId(id)
    setRequestedLick({ id, key, neckPosition, nonce: Date.now() })
    window.setTimeout(() => {
      const section = document.getElementById("beatforge-line-lab")
      if (section) {
        section.open = true
        section.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }, 0)
  }

  return (
    <div style={{ display: "grid", gap: "16px", marginBottom: "20px" }}>
      <PowerPanel
        title="BeatForge Metronome"
        subtitle="Standalone time workout with programmable accents"
        open={metronomeOpen}
        onToggle={onToggleMetronome}
        keepMounted
        shortcutId="beatforge-metronome"
      >
        <MetronomePanel
          apiRef={beatforgeRef}
          onBeforeStart={stopPlayback}
          onUserGenerate={onUserGenerate}
          panelStyle={{ ...panelStyle, margin: "0" }}
          eyebrowStyle={eyebrowStyle}
          selectStyle={selectStyle}
          inlineLabelStyle={inlineLabelStyle}
        />
      </PowerPanel>

      <PowerPanel
        title="BeatForge Library"
        subtitle="30 bebop rhythm patterns — tap to load and play"
        open={libraryOpen}
        onToggle={onToggleLibrary}
        shortcutId="beatforge-library"
      >
        <BeatForgeLibrary
          loadedNum={loadedLibraryNum}
          onLoad={onLoadPattern}
        />
      </PowerPanel>

      <WorkspaceSection id="beatforge-line-lab" title="LINE LAB" subtitle="Develop single-note lines over the active draft" color="var(--db-c-green)" panelStyle={panelStyle}>
        <LineLab
          chartBars={workingBars}
          chartTitle={workingTitle}
          onStopPlayback={stopPlayback}
          playLineSection={playLineSection}
          panelStyle={{ ...panelStyle, margin: 0 }}
          eyebrowStyle={eyebrowStyle}
          selectStyle={selectStyle}
          licks={licks}
          selectedLickId={selectedLickId}
          onSelectLick={setSelectedLickId}
          requestedLick={requestedLick}
          onSaveLick={saveLick}
        />
      </WorkspaceSection>

      <WorkspaceSection id="beatforge-licktionary" title="LICKTIONARY" subtitle="28 bebop approaches in major and minor — including the Peña set — plus your saved Line Lab licks" color="var(--db-c-pink, var(--db-c-purple))" panelStyle={panelStyle}>
        <Licktionary
          licks={licks}
          selectedLickId={selectedLickId}
          onOpenLick={openLickInLineLab}
          selectStyle={selectStyle}
        />
      </WorkspaceSection>
    </div>
  )
}
