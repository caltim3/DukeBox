"use client"

// BeatForge workspace — its own tab, pulled out of Practice (step 1 of the
// restructure). Top to bottom: BeatForge Metronome, BeatForge Library. Line
// Lab and Licktionary land here too in a later step; this one only moves the
// two panels that already existed in Practice, unchanged, into their own
// place. See docs/ for the full integration plan.

import MetronomePanel from "@/components/MetronomePanel"
import BeatForgeLibrary from "@/components/BeatForgeLibrary"
import PowerPanel from "@/components/practice/PowerPanel"

export default function BeatForgeWorkspace({
  beatforgeRef,
  stopPlayback,
  onUserGenerate,
  loadedLibraryNum,
  onLoadPattern,
  metronomeOpen,
  libraryOpen,
  onToggleMetronome,
  onToggleLibrary,
  panelStyle,
  eyebrowStyle,
  selectStyle,
  inlineLabelStyle,
}) {
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
    </div>
  )
}
