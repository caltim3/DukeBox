"use client"

// Rhythm Shed — bebop rhythm generator, integrated into BeatForge. Ported from
// the standalone beboprhythmshed.html: the weighted cell generator and the
// hand-rolled SVG manuscript renderer are preserved verbatim (the renderer
// and the 30-pattern library now live in lib/music/rhythmShed.js, shared
// with the sibling BeatForgeLibrary panel — see that file for what changed
// about how playback works). What changed in this port:
//   · Playback runs on the shared BeatForge engine (lib/music/metronome.js)
//     instead of a private WebAudio scheduler — one Start drives the click
//     cells AND the rhythm, and the phrase is tapped on the drum kit's SNARE
//     (or the original pluck tone, still available via the voice picker).
//   · The original Off / 1-2-3-4 / 2-&-4 metronome setting became one-tap
//     presets that program the BeatForge accent-cell grid (onMetPreset).
//   · Count-in = one bar of the click cells alone before the phrase enters
//     (the engine's loop skips it after the first pass).
//   · The rhythm library moved out to its own top-level power panel
//     (components/BeatForgeLibrary.jsx) so it can roll open independently;
//     it loads patterns into this component via apiRef.loadPattern.
// The parent owns Start/Stop; this component reports its phrase through
// apiRef (getRhythm / clearHighlights / loadPattern) and asks for play/stop/restart.

import { useEffect, useRef, useState } from "react"
import { PROGS, clone, renderMeasure, swungPos, SHED_CSS } from "@/lib/music/rhythmShed"

function pickWeighted(items) {
  let tot = 0
  for (const it of items) tot += it.w
  let r = Math.random() * tot
  for (const it of items) { r -= it.w; if (r <= 0) return it }
  return items[items.length - 1]
}

function oneBeatCell({ density: d, rests, trips }) {
  const cells = []
  cells.push({ w: 16 + 30 * d, ev: [{ d: 0.5 }, { d: 0.5 }] })              // two 8ths
  cells.push({ w: 13, ev: [{ d: 1 }] })                                     // quarter
  if (rests) {
    cells.push({ w: 13, ev: [{ d: 0.5, rest: true }, { d: 0.5 }] })         // offbeat 8th
    cells.push({ w: 7,  ev: [{ d: 0.5 }, { d: 0.5, rest: true }] })         // 8th then breath
    cells.push({ w: 3 + 9 * (1 - d), ev: [{ d: 1, rest: true }] })          // full beat rest
  }
  if (trips) {
    const tw = 5 + 11 * d
    cells.push({ w: tw, ev: [{ d: 1 / 3, trip: 1 }, { d: 1 / 3, trip: 1 }, { d: 1 / 3, trip: 1 }] })
    if (rests) {
      cells.push({ w: tw * 0.4,  ev: [{ d: 1 / 3, trip: 1 }, { d: 1 / 3, trip: 1, rest: true }, { d: 1 / 3, trip: 1 }] })
      cells.push({ w: tw * 0.35, ev: [{ d: 1 / 3, trip: 1, rest: true }, { d: 1 / 3, trip: 1 }, { d: 1 / 3, trip: 1 }] })
    }
  }
  return clone(pickWeighted(cells).ev)
}

function twoBeatCell({ rests }) {
  const cells = [
    { w: 10, ev: [{ d: 0.5 }, { d: 1 }, { d: 0.5 }] },   // 8 q 8 (charleston push)
    { w: 8,  ev: [{ d: 1.5 }, { d: 0.5 }] },             // q. 8
    { w: 7,  ev: [{ d: 0.5 }, { d: 1.5 }] },             // 8 q.
  ]
  if (rests) {
    cells.push({ w: 7, ev: [{ d: 0.5, rest: true }, { d: 1 }, { d: 0.5 }] })
    cells.push({ w: 4, ev: [{ d: 0.5 }, { d: 1 }, { d: 0.5, rest: true }] })
  }
  return clone(pickWeighted(cells).ev)
}

function genMeasure(opts) {
  const out = []
  let pos = 0
  while (pos < 4 - 1e-6) {
    let cell
    if (opts.sync && pos <= 2 && Number.isInteger(pos) && Math.random() < 0.32) {
      cell = twoBeatCell(opts)
    } else {
      cell = oneBeatCell(opts)
    }
    out.push(...cell)
    pos += cell.reduce((a, e) => a + e.d, 0)
  }
  // never end on a bar with no notes at all: retry once
  if (out.every((e) => e.rest)) return genMeasure(opts)
  return out
}

const segBtn = (on) => ({
  padding: "4px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
  border: on ? "1px solid var(--db-c-amber)" : "1px solid var(--db-panel-border)",
  background: on ? "color-mix(in srgb, var(--db-c-amber) 18%, var(--db-bg))" : "var(--db-panel-bg)",
  color: on ? "var(--db-c-amber)" : "var(--db-text)",
  fontWeight: on ? 700 : 400,
})

export default function RhythmShed({
  apiRef,
  playing,
  onPlay,
  onStop,
  onRestart,
  onMetPreset,
  onUserGenerate,
  inlineLabelStyle,
  selectStyle,
}) {
  const [enabled, setEnabled] = useState(true)
  const [measures, setMeasures] = useState(4)
  const [density, setDensity] = useState(62)
  const [trips, setTrips] = useState(true)
  const [rests, setRests] = useState(true)
  const [sync, setSync] = useState(true)
  const [swing, setSwing] = useState(true)
  const [countIn, setCountIn] = useState(true)
  const [loop, setLoop] = useState(true)
  const [voice, setVoice] = useState("snare")
  const [chords, setChords] = useState("251")
  const [rhythm, setRhythm] = useState([])
  const [loadedName, setLoadedName] = useState(null)

  const sheetRef = useRef(null)
  const layoutRef = useRef([])
  const pendingPlayRef = useRef(false)

  // Live copies so getRhythm (called by the parent at Start) always reads
  // current values without re-registering the api object.
  const live = useRef({})
  live.current = { enabled, swing, countIn, loop, voice, measures, playing }

  function generate(opts = {}) {
    const cfg = { density: density / 100, trips, rests, sync, measures, ...opts }
    const next = []
    for (let m = 0; m < cfg.measures; m++) next.push(genMeasure(cfg))
    setLoadedName(null)
    setRhythm(next)
  }

  function regen(opts = {}) {
    onUserGenerate?.()
    if (live.current.playing) onStop?.()
    generate(opts)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { generate() }, [])

  // Render the manuscript whenever the phrase or chord labels change
  useEffect(() => {
    const cont = sheetRef.current
    if (!cont) return
    cont.innerHTML = ""
    layoutRef.current = []
    const prog = PROGS[chords]
    for (let m = 0; m < rhythm.length; m++) {
      const chord = prog ? prog.bars[m % prog.bars.length] : null
      layoutRef.current.push(renderMeasure(cont, rhythm[m], m, chord))
    }
    if (pendingPlayRef.current) {
      pendingPlayRef.current = false
      onPlay?.()
    }
  }, [rhythm, chords]) // eslint-disable-line react-hooks/exhaustive-deps

  function clearHighlights() {
    document.querySelectorAll(".rs-note.active").forEach((n) => n.classList.remove("active"))
    document.querySelectorAll(".rs-beatdot.on").forEach((d) => d.classList.remove("on"))
    document.querySelectorAll(".rs-measure.live").forEach((d) => d.classList.remove("live"))
  }

  function highlightEvent(m, i) {
    document.querySelectorAll(".rs-note.active").forEach((n) => n.classList.remove("active"))
    const g = document.getElementById(`rs-ev-${m}-${i}`)
    if (g) g.classList.add("active")
  }

  function highlightBeat(m, b) {
    document.querySelectorAll(".rs-beatdot.on").forEach((d) => d.classList.remove("on"))
    document.querySelectorAll(".rs-measure.live").forEach((d) => d.classList.remove("live"))
    const mEl = sheetRef.current?.querySelector(`.rs-measure[data-m="${m}"]`)
    if (mEl) mEl.classList.add("live")
    const dEl = document.getElementById(`rs-bd-${m}-${b}`)
    if (dEl) dEl.classList.add("on")
  }

  // Load a pattern from the BeatForge Library panel (or anywhere else that
  // holds an apiRef) — repeats it across the current bar count and autoplays
  // once the sheet re-renders, same as generating a fresh phrase.
  function loadPattern(p) {
    if (live.current.playing) onStop?.()
    const next = []
    for (let m = 0; m < live.current.measures; m++) {
      const meas = []
      for (const c of p.cells) meas.push(...clone(c))
      next.push(meas)
    }
    setLoadedName(`#${p.num} ${p.n}`)
    pendingPlayRef.current = true
    setRhythm(next)
  }

  // The parent's Start reads the phrase through this
  useEffect(() => {
    if (!apiRef) return
    apiRef.current = {
      getRhythm() {
        const s = live.current
        if (!s.enabled || !layoutRef.current.length) return null
        const events = []
        layoutRef.current.forEach((items, m) => {
          for (const it of items) {
            events.push({ beat: m * 4 + swungPos(it.pos, it.trip, s.swing), m, i: it.i, rest: !!it.rest })
          }
        })
        return {
          events,
          leadBeats: s.countIn ? 4 : 0,
          totalBeats: layoutRef.current.length * 4,
          loop: s.loop,
          voice: s.voice,
          onEvent: highlightEvent,
          onBeat: highlightBeat,
        }
      },
      clearHighlights,
      loadPattern,
    }
    return () => { if (apiRef) apiRef.current = null }
  }, [apiRef]) // eslint-disable-line react-hooks/exhaustive-deps

  const prog = PROGS[chords]
  const title = `${measures} bar${measures > 1 ? "s" : ""}${prog ? " · " + prog.name : ""}${loadedName ? " · " + loadedName : ""}`
  const restartIfPlaying = () => { if (live.current.playing) onRestart?.() }

  return (
    <div style={{ marginBottom: "14px" }}>
      <style>{SHED_CSS}</style>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
        <span style={{ font: "800 11px 'IBM Plex Mono', monospace", letterSpacing: "0.14em", color: "var(--db-c-amber)" }}>RHYTHM SHED</span>
        <span style={{ fontSize: "var(--db-fs-sm)", opacity: 0.55 }}>Bebop rhythm generator — the phrase is tapped on the kit snare over your click cells</span>
        <label style={{ ...inlineLabelStyle, marginLeft: "auto" }} title="Off = Start runs the classic metronome alone">
          <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); if (live.current.playing) onRestart?.() }} />
          Rhythm
        </label>
      </div>

      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "10px" }}>
        <button onClick={() => regen()} style={{
          padding: "6px 14px", borderRadius: "var(--db-r-md)", cursor: "pointer", fontWeight: 700, fontSize: "var(--db-fs-sm)",
          border: "1px solid var(--db-c-amber)", background: "color-mix(in srgb, var(--db-c-amber) 12%, var(--db-bg))", color: "var(--db-c-amber)",
        }}>
          ↻ New rhythm
        </button>

        <label style={inlineLabelStyle}>
          <span style={{ opacity: 0.7 }}>Bars</span>
          {[1, 2, 4].map((n) => (
            <button key={n} onClick={() => { setMeasures(n); regen({ measures: n }) }} style={segBtn(measures === n)}>{n}</button>
          ))}
        </label>

        <label style={inlineLabelStyle}>
          <span style={{ opacity: 0.7 }}>Changes</span>
          <select value={chords} onChange={(e) => setChords(e.target.value)} style={{ ...selectStyle, width: "auto", padding: "5px 8px" }}>
            <option value="none">No chords</option>
            <option value="251">ii V I in C</option>
            <option value="blues">F blues</option>
            <option value="rc">Rhythm changes A</option>
            <option value="minor251">Minor ii V i</option>
          </select>
        </label>

        <label style={inlineLabelStyle} title="How busy the generated phrase is">
          Density
          <input type="range" min="0" max="100" value={density}
            onChange={(e) => setDensity(Number(e.target.value))}
            onMouseUp={() => regen()} onTouchEnd={() => regen()} onKeyUp={() => regen()}
            style={{ width: "90px" }} />
        </label>

        <label style={inlineLabelStyle}>
          <input type="checkbox" checked={trips} onChange={(e) => { setTrips(e.target.checked); regen({ trips: e.target.checked }) }} />
          Triplets
        </label>
        <label style={inlineLabelStyle}>
          <input type="checkbox" checked={rests} onChange={(e) => { setRests(e.target.checked); regen({ rests: e.target.checked }) }} />
          Rests
        </label>
        <label style={inlineLabelStyle} title="Over-the-bar two-beat cells">
          <input type="checkbox" checked={sync} onChange={(e) => { setSync(e.target.checked); regen({ sync: e.target.checked }) }} />
          Syncopation
        </label>
      </div>

      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "10px" }}>
        <label style={inlineLabelStyle}>
          <input type="checkbox" checked={swing} onChange={(e) => { setSwing(e.target.checked); restartIfPlaying() }} />
          Swing 8ths
        </label>
        <label style={inlineLabelStyle} title="One bar of click cells alone before the phrase enters (first pass only)">
          <input type="checkbox" checked={countIn} onChange={(e) => setCountIn(e.target.checked)} />
          Count-in bar
        </label>
        <label style={inlineLabelStyle}>
          <input type="checkbox" checked={loop} onChange={(e) => { setLoop(e.target.checked); restartIfPlaying() }} />
          Loop
        </label>
        <label style={inlineLabelStyle}>
          <span style={{ opacity: 0.7 }}>Voice</span>
          <select value={voice} onChange={(e) => { setVoice(e.target.value); restartIfPlaying() }} style={{ ...selectStyle, width: "auto", padding: "5px 8px" }}>
            <option value="snare">Kit snare</option>
            <option value="pluck">Pluck</option>
          </select>
        </label>
        <label style={inlineLabelStyle} title="One-tap presets that program the click cells below">
          <span style={{ opacity: 0.7 }}>Click preset</span>
          {[["off", "Off"], ["all", "1 2 3 4"], ["24", "2 & 4"]].map(([v, l]) => (
            <button key={v} onClick={() => { onMetPreset?.(v); restartIfPlaying() }} style={segBtn(false)}>{l}</button>
          ))}
        </label>
      </div>

      <div className="rs-sheet">
        <div className="rs-sheet-top">
          <div className="rs-t">{title}</div>
          <div className="rs-swingtag">{swing ? "swing 8ths" : "straight 8ths"}</div>
        </div>
        <div className="rs-measures" ref={sheetRef} />
      </div>

      <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, margin: "8px 2px 0", lineHeight: 1.5 }}>
        <b>How to shed it:</b> generate a phrase, clap or scat it with the click first, then play it on one
        note, then run it through the changes with your own lines. The <b>2 &amp; 4</b> click is the honest one.
        Push density up and swing off to check your triplet subdivision is real, not faked. The BeatForge
        Library panel below has 30 ready-made patterns that play through this same engine.
      </div>
    </div>
  )
}
