"use client"

// BeatForge — standalone metronome workspace, ported from Bebop Blueprint.
// Works with no song loaded: time signature, editable accent cells (click a
// cell to cycle accent → normal → off), click/woodblock/drums voices, drum-kit
// picker, tap tempo, volume + accent intensity. Runs on the Tone.js Transport
// via the lazily-imported metronome engine.

import { useEffect, useRef, useState } from "react"
import { DRUM_KIT_NAMES, DEFAULT_DRUM_KIT } from "@/lib/music/samples"
import RhythmShed from "@/components/RhythmShed"

let _metroMod = null
async function loadMetronome() {
  if (!_metroMod) _metroMod = await import("@/lib/music/metronome")
  return _metroMod
}

const SOUNDS = [
  ["click", "Click"],
  ["woodblock", "Woodblock"],
  ["drums", "Drums"],
]

// Default cells for a bar: accent on 1, normal on the other downbeats.
function defaultCells(beats, eighths) {
  const per = eighths ? 2 : 1
  return Array.from({ length: beats * per }, (_, i) =>
    i === 0 ? 2 : i % per === 0 ? 1 : 0
  )
}

export default function MetronomePanel({ onBeforeStart, panelStyle, eyebrowStyle, selectStyle, inlineLabelStyle }) {
  const [running, setRunning] = useState(false)
  const [tempo, setTempo] = useState(120)
  const [beats, setBeats] = useState(4)
  const [eighths, setEighths] = useState(true)
  const [cells, setCells] = useState(() => defaultCells(4, true))
  const [sound, setSound] = useState("click")
  const [kit, setKit] = useState(DEFAULT_DRUM_KIT)
  const [volume, setVolume] = useState(0.8)
  const [accentIntensity, setAccentIntensity] = useState(1.35)
  const [activeCell, setActiveCell] = useState(null)
  const tapTimesRef = useRef([])
  const shedApiRef = useRef(null)   // Rhythm Shed hands its phrase over through this

  // Push live settings into the engine while it runs
  useEffect(() => {
    _metroMod?.updateMetronome({ cells, sound, kit, volume, accentIntensity })
  }, [cells, sound, kit, volume, accentIntensity])

  useEffect(() => {
    if (running) _metroMod?.setMetronomeTempo(tempo)
  }, [tempo, running])

  useEffect(() => () => _metroMod?.stopMetronome(), [])

  function resize(nextBeats, nextEighths) {
    setBeats(nextBeats)
    setEighths(nextEighths)
    setCells(defaultCells(nextBeats, nextEighths))
  }

  function cycleCell(i) {
    setCells(prev => prev.map((c, j) => (j === i ? (c === 2 ? 1 : c === 1 ? 0 : 2) : c)))
  }

  async function start() {
    onBeforeStart?.()   // stop chart playback — Transport is shared
    const m = await loadMetronome()
    const shedRhythm = shedApiRef.current?.getRhythm?.() || null
    await m.startMetronome({
      tempo, cells, sound, kit, volume, accentIntensity,
      subdivision: eighths ? "8n" : "4n",
      onTick: setActiveCell,
      rhythm: shedRhythm
        ? { ...shedRhythm, onDone: () => { setRunning(false); setActiveCell(null); shedApiRef.current?.clearHighlights?.() } }
        : null,
    })
    setRunning(true)
  }

  function stop() {
    _metroMod?.stopMetronome()
    setRunning(false)
    setActiveCell(null)
    shedApiRef.current?.clearHighlights?.()
  }

  function restart() {
    stop()
    start().catch(console.error)
  }

  // Rhythm Shed click presets — one tap programs the cell grid (always a 4/4
  // bar of 8th cells, matching the shed's own meter).
  function applyMetPreset(preset) {
    setBeats(4)
    setEighths(true)
    if (preset === "off") setCells([0, 0, 0, 0, 0, 0, 0, 0])
    else if (preset === "all") setCells([2, 0, 1, 0, 1, 0, 1, 0])
    else if (preset === "24") setCells([0, 0, 2, 0, 0, 0, 2, 0])
  }

  function tapTempo() {
    const now = performance.now()
    const taps = tapTimesRef.current.filter(t => now - t < 3000)
    taps.push(now)
    tapTimesRef.current = taps.slice(-5)
    if (tapTimesRef.current.length >= 2) {
      const t = tapTimesRef.current
      const intervals = t.slice(1).map((v, i) => v - t[i]).slice(-4)
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const bpm = Math.round(Math.min(280, Math.max(40, 60000 / avg)))
      setTempo(bpm)
      if (running) _metroMod?.setMetronomeTempo(bpm)
    }
  }

  const per = eighths ? 2 : 1

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px", flexWrap: "wrap" }}>
        <div style={{ ...eyebrowStyle, marginBottom: 0 }}>BEATFORGE METRONOME</div>
        <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.55 }}>
          Standalone time workout — click cells to cycle accent → normal → off
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" }}>
        <button
          onClick={running ? stop : start}
          style={{
            padding: "9px 22px", borderRadius: "var(--db-r-md)", cursor: "pointer", fontWeight: 800, fontSize: "var(--db-fs-md)",
            border: `2px solid ${running ? "var(--db-c-salmon)" : "var(--db-c-green)"}`,
            background: running
              ? "color-mix(in srgb, var(--db-c-salmon) 18%, var(--db-bg))"
              : "color-mix(in srgb, var(--db-c-green) 14%, var(--db-bg))",
            color: running ? "var(--db-c-salmon)" : "var(--db-c-green)",
          }}
        >
          {running ? "⏹ Stop" : "▶ Start"}
        </button>

        <label style={inlineLabelStyle}>
          Tempo
          <input type="range" min="40" max="280" value={tempo} onChange={(e) => setTempo(Number(e.target.value))} />
          <span style={{ minWidth: "34px" }}>{tempo}</span>
        </label>

        <button onClick={tapTempo} style={{
          padding: "7px 14px", borderRadius: "var(--db-r-md)", cursor: "pointer", fontWeight: 700, fontSize: "var(--db-fs-sm)",
          border: "1px solid var(--db-c-blue)", background: "color-mix(in srgb, var(--db-c-blue) 10%, var(--db-bg))",
          color: "var(--db-c-blue)",
        }} title="Tap 2+ times — tempo is averaged over the last 4 taps">
          👆 Tap
        </button>

        <label style={inlineLabelStyle}>
          <span style={{ opacity: 0.7 }}>Beats</span>
          <select value={beats} onChange={(e) => resize(Number(e.target.value), eighths)}
            style={{ ...selectStyle, width: "auto", padding: "5px 8px" }}>
            {[2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}/4</option>)}
          </select>
        </label>

        <label style={inlineLabelStyle}>
          <input type="checkbox" checked={eighths} onChange={(e) => resize(beats, e.target.checked)} />
          8th-note cells
        </label>

        <label style={inlineLabelStyle}>
          <span style={{ opacity: 0.7 }}>Sound</span>
          <select value={sound} onChange={(e) => setSound(e.target.value)}
            style={{ ...selectStyle, width: "auto", padding: "5px 8px" }}>
            {SOUNDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>

        {sound === "drums" && (
          <label style={inlineLabelStyle}>
            <span style={{ opacity: 0.7 }}>Kit</span>
            <select value={kit} onChange={(e) => setKit(e.target.value)}
              style={{ ...selectStyle, width: "auto", padding: "5px 8px" }}>
              {DRUM_KIT_NAMES.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
        )}

        <label style={inlineLabelStyle} title="Overall metronome volume">
          Vol
          <input type="range" min="0" max="100" value={Math.round(volume * 100)}
            onChange={(e) => setVolume(Number(e.target.value) / 100)} style={{ width: "60px" }} />
        </label>

        <label style={inlineLabelStyle} title="How much louder accented cells hit">
          Accent
          <input type="range" min="100" max="200" value={Math.round(accentIntensity * 100)}
            onChange={(e) => setAccentIntensity(Number(e.target.value) / 100)} style={{ width: "60px" }} />
        </label>
      </div>

      {/* Rhythm Shed — bebop rhythm generator sharing this transport; Start
          above runs the click cells and taps the phrase on the kit snare. */}
      <RhythmShed
        apiRef={shedApiRef}
        playing={running}
        onPlay={() => { start().catch(console.error) }}
        onStop={stop}
        onRestart={restart}
        onMetPreset={applyMetPreset}
        inlineLabelStyle={inlineLabelStyle}
        selectStyle={selectStyle}
      />

      {/* Beat cells */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {cells.map((state, i) => {
          const isDownbeat = i % per === 0
          const beatNum = Math.floor(i / per) + 1
          const isActive = i === activeCell
          return (
            <button
              key={i}
              onClick={() => cycleCell(i)}
              aria-label={`${isDownbeat ? `Beat ${beatNum}` : `Off-beat after ${beatNum}`}: ${state === 2 ? "accent" : state === 1 ? "normal" : "off"} — click to change`}
              title={state === 2 ? "Accent" : state === 1 ? "Normal" : "Off"}
              style={{
                width: "44px", height: "44px", borderRadius: "var(--db-r-md)", cursor: "pointer",
                fontWeight: 700, fontSize: "var(--db-fs-sm)",
                border: isActive
                  ? "2px solid var(--db-c-amber)"
                  : state === 2 ? "2px solid var(--db-c-salmon)"
                  : state === 1 ? "1px solid var(--db-c-blue)"
                  : "1px dashed var(--db-panel-border)",
                background: isActive
                  ? "color-mix(in srgb, var(--db-c-amber) 30%, var(--db-bg))"
                  : state === 2 ? "color-mix(in srgb, var(--db-c-salmon) 18%, var(--db-bg))"
                  : state === 1 ? "color-mix(in srgb, var(--db-c-blue) 12%, var(--db-bg))"
                  : "var(--db-panel-bg)",
                color: state === 2 ? "var(--db-c-salmon)" : state === 1 ? "var(--db-c-blue)" : "var(--db-muted)",
                opacity: state === 0 && !isActive ? 0.55 : 1,
              }}
            >
              {isDownbeat ? beatNum : "&"}
            </button>
          )
        })}
      </div>
    </div>
  )
}
