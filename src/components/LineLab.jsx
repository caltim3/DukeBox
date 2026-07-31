"use client"

// Line Lab — generate a single-note improvised line over a stretch of changes,
// returned as tab with per-bar reasoning, and step it across the fretboard.
//
// Integrated from the standalone Line Lab prototype with three changes:
//   1. Generation goes through /api/generate-line (server-side) — the prototype
//      called api.anthropic.com straight from the browser, which CORS blocks and
//      which would expose a key.
//   2. Seeds from the chart already loaded in DukeBox instead of a hardcoded preset.
//   3. Plays through the shared Tone.js piano sampler rather than opening a
//      second AudioContext with a raw oscillator.

import { useEffect, useMemo, useRef, useState } from "react"

const DEVICES = [
  "Chromatics", "Bebop scale", "Enclosures", "Altered",
  "Melodic cells", "Triads", "Triad pairs", "Scale choice",
  "Rest-stroke triplets",
]

// Devices whose meaning isn't obvious from the chip alone.
const DEVICE_HINTS = {
  "Rest-stroke triplets":
    "Pat Martino's rest-stroke (apoyando) flow — continuous eighth-note triplets, " +
    "picked so each stroke comes to rest on the next string. Accent the first of every three.",
}

const POSITIONS = ["Anywhere", "Open to 4th", "5th position", "7th to 9th", "10th and up"]

// Standard tuning, string 1 = high E
const OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 }
const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

const midiOf = (s, f) => OPEN_MIDI[s] + f
const noteName = (s, f) => NOTE_NAMES[midiOf(s, f) % 12]
const noteWithOctave = (s, f) => {
  const m = midiOf(s, f)
  return `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`
}

const LEVELS = [
  { n: 1, label: "Skeleton",  blurb: "Chord + guide tones" },
  { n: 2, label: "Inside",    blurb: "Recommended scale + bebop" },
  { n: 3, label: "Chromatic", blurb: "Enclosures + approaches" },
  { n: 4, label: "Structures",blurb: "Triad pairs + cells" },
  { n: 5, label: "Exotic",    blurb: "Altered + side-slip" },
]

// Triplet durations come back as thirds of a beat, so they can't be read off
// the binary grid — check them first and mark them with a 3.
const TRIPLETS = [
  { beats: 4 / 3, label: "h3" },   // half-note triplet
  { beats: 2 / 3, label: "q3" },   // quarter-note triplet
  { beats: 1 / 3, label: "e3" },   // eighth-note triplet
  { beats: 1 / 6, label: "s3" },   // sixteenth-note triplet
]

function durLabel(b) {
  const trip = TRIPLETS.find(t => Math.abs(b - t.beats) < 0.02)
  if (trip) return trip.label
  if (b >= 4) return "w"
  if (b >= 3) return "h."
  if (b >= 2) return "h"
  if (b >= 1.5) return "q."
  if (b >= 1) return "q"
  if (b >= 0.75) return "e."
  if (b >= 0.5) return "e"
  return "s"
}

function parseBars(text) {
  const raw = text.split(/\n|\|/).map(b => b.trim()).filter(Boolean)
  const bars = []
  for (const b of raw) {
    if (b === "%" && bars.length) bars.push(bars[bars.length - 1])
    else bars.push(b)
  }
  return bars
}

function buildTab(resultBars) {
  const stringLines = [[], [], [], [], [], []]
  const rhythm = []
  resultBars.forEach((bar) => {
    (bar.n || []).forEach(([s, f, b]) => {
      const fretStr = String(f)
      const w = Math.max(fretStr.length + 2, 3)
      for (let i = 0; i < 6; i++) {
        stringLines[i].push(i === s - 1 ? fretStr.padEnd(w, "-") : "-".repeat(w))
      }
      rhythm.push(durLabel(b).padEnd(w, " "))
    })
    for (let i = 0; i < 6; i++) stringLines[i].push("|")
    rhythm.push(" ")
  })
  const labels = ["e|", "B|", "G|", "D|", "A|", "E|"]
  return "  " + rhythm.join("") + "\n" + stringLines.map((c, i) => labels[i] + c.join("")).join("\n")
}

export default function LineLab({ chartBars, chartTitle, panelStyle, eyebrowStyle, selectStyle, onStopPlayback, playLineSection }) {
  // Seed the sheet from whatever chart is loaded in DukeBox
  const chartAsSheet = useMemo(
    () => (chartBars ?? []).map(b => b.symbol).join(" | "),
    [chartBars]
  )

  const [sheet, setSheet] = useState(chartAsSheet)
  const [selStart, setSelStart] = useState(0)
  const [selEnd, setSelEnd] = useState(3)
  const [devices, setDevices] = useState(new Set(["Triad pairs", "Melodic cells", "Enclosures"]))
  const [extra, setExtra] = useState("")
  const [position, setPosition] = useState("5th position")
  const [tempo, setTempo] = useState(120)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [playIdx, setPlayIdx] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const timerRef = useRef(null)

  // Complexity ladder — lines cached per level so levels can be compared
  // over the same bars without regenerating.
  const [level, setLevel] = useState(3)
  const [levelLines, setLevelLines] = useState({})

  // Practice transport: play the line in the pocket with the rhythm section
  const [withBand, setWithBand] = useState(false)
  const [muteLine, setMuteLine] = useState(false)
  const [ramp, setRamp] = useState(false)
  const [rampCap, setRampCap] = useState(160)
  const [liveTempo, setLiveTempo] = useState(120)
  const prevBarRef = useRef(-1)
  const rampTempoRef = useRef(120)
  const rampCapRef = useRef(160)
  const RAMP_STEP = 5
  const RAMP_HEADROOM = 40   // default room above the current tempo to ramp into

  const bars = useMemo(() => parseBars(sheet), [sheet])

  useEffect(() => {
    setSelStart(0)
    setSelEnd(Math.min(3, Math.max(0, bars.length - 1)))
  }, [sheet, bars.length])

  // A new section invalidates every cached level
  useEffect(() => {
    setLevelLines({})
    setResult(null)
  }, [selStart, selEnd, sheet])

  const flatNotes = useMemo(() => {
    if (!result) return []
    const out = []
    result.bars.forEach((bar, bi) => (bar.n || []).forEach(([s, f, b]) => out.push({ s, f, b, bi })))
    return out
  }, [result])

  function clickBar(i) {
    if (selStart === selEnd && i > selStart) setSelEnd(i)
    else { setSelStart(i); setSelEnd(i) }
  }

  // Switching level swaps in that level's cached line (or clears if not generated)
  useEffect(() => {
    stopLine()
    setResult(levelLines[level] ?? null)
  }, [level])   // eslint-disable-line react-hooks/exhaustive-deps

  function toggleDevice(d) {
    setDevices(prev => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d); else next.add(d)
      return next
    })
  }

  // Reuse DukeBox's Tone.js piano sampler so Line Lab doesn't spin up its own
  // AudioContext (and so the line matches the app's timbre).
  async function playNote(s, f) {
    try {
      const audio = await import("@/lib/music/audio")
      await audio.playSingleNote(noteWithOctave(s, f))
    } catch { /* preview is non-essential — stay silent rather than throw */ }
  }

  function stopLine() {
    setPlaying(false)
    setPlayIdx(-1)
    prevBarRef.current = -1
    clearTimeout(timerRef.current)
    if (withBand) onStopPlayback?.()
  }

  // Drive the tempo ramp: each time the loop wraps back to an earlier bar,
  // step the transport bpm up until the cap.
  function onBandBar(localBarIdx) {
    if (prevBarRef.current > localBarIdx && ramp) {
      const next = Math.min(rampCapRef.current, rampTempoRef.current + RAMP_STEP)
      rampTempoRef.current = next
      setLiveTempo(next)
      import("tone").then((Tone) => {
        try { Tone.getTransport().bpm.value = next } catch {}
      }).catch(() => {})
    }
    prevBarRef.current = localBarIdx
  }

  function onBandNote(barIdx, noteIdx) {
    let running = 0
    for (let b = 0; b < barIdx; b++) running += (result?.bars?.[b]?.n || []).length
    setPlayIdx(running + noteIdx)
  }

  function startLine() {
    if (!flatNotes.length) return
    onStopPlayback?.()      // Line Lab and the band share one Transport

    if (withBand && playLineSection) {
      prevBarRef.current = -1
      rampTempoRef.current = tempo
      setLiveTempo(tempo)
      // The tempo slider may have been pushed past the cap since the ramp was
      // switched on. Seed the effective cap in a ref: the onBar callback below
      // is handed to the audio engine now and would close over a stale value.
      const cap = rampCap > tempo ? rampCap : tempo + RAMP_HEADROOM
      rampCapRef.current = cap
      if (cap !== rampCap) setRampCap(cap)
      setPlaying(true)
      playLineSection({
        line: result,
        startIndex: selStart,
        endIndex: Math.min(selEnd, selStart + 7),
        practiceTempo: tempo,
        muteLine,
        onBar: onBandBar,
        onLineNote: onBandNote,
        onDone: () => { setPlaying(false); setPlayIdx(-1) },
      })
      return
    }

    setPlaying(true)
    setPlayIdx(0)
  }

  useEffect(() => {
    if (!playing || playIdx < 0) return
    if (withBand && playLineSection) return   // band mode is driven by the transport
    if (playIdx >= flatNotes.length) { stopLine(); return }
    const note = flatNotes[playIdx]
    playNote(note.s, note.f)
    const ms = note.b * (60 / tempo) * 1000
    timerRef.current = setTimeout(() => setPlayIdx(i => i + 1), ms)
    return () => clearTimeout(timerRef.current)
  }, [playing, playIdx])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(timerRef.current), [])

  async function generate() {
    stopLine()
    setLoading(true); setError(null); setResult(null)
    const section = bars.slice(selStart, Math.min(selEnd + 1, selStart + 8))
    const clipped = selEnd - selStart + 1 > 8
    // Richer bar data (root/quality/beats) lets the route feed the model
    // DukeBox's own scale recommendations and guide tones.
    const chartSlice = (chartBars ?? []).slice(selStart, Math.min(selEnd + 1, selStart + 8))
      .map((b) => ({ symbol: b.symbol, root: b.root, quality: b.quality, beats: b.beats }))
    try {
      const res = await fetch("/api/generate-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section, devices: Array.from(devices), position, extra,
          level, chartBars: chartSlice,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const line = { ...data.line, clipped }
      setLevelLines((prev) => ({ ...prev, [level]: line }))
      setResult(line)
    } catch (e) {
      setError(e.message || "Couldn't get a clean line back. Try again, or select fewer bars.")
    }
    setLoading(false)
  }

  // ─── Fretboard geometry ───────────────────────────────────────────────────
  const fretCount = 15
  const fbW = 640, fbH = 132, nutX = 36
  const fretW = (fbW - nutX - 12) / fretCount
  const stringY = (s) => 18 + (s - 1) * 19
  const noteX = (f) => (f === 0 ? nutX - 14 : nutX + (f - 0.5) * fretW)
  const currentNote = playIdx >= 0 && playIdx < flatNotes.length ? flatNotes[playIdx] : null

  const chip = (active) => ({
    padding: "5px 12px", borderRadius: 999, fontSize: "var(--db-fs-sm)", cursor: "pointer",
    border: `1px solid ${active ? "var(--db-accent)" : "var(--db-panel-border)"}`,
    background: active ? "color-mix(in srgb, var(--db-accent) 16%, transparent)" : "transparent",
    color: active ? "var(--db-accent)" : "var(--db-text)",
    opacity: active ? 1 : 0.75,
  })

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px", flexWrap: "wrap" }}>
        <div style={{ ...eyebrowStyle, marginBottom: 0 }}>LINE LAB</div>
        <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.62 }}>
          Improvised single-note lines over your changes — as tab, with per-bar reasoning
        </div>
      </div>

      {/* Lead sheet */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "10px" }}>
        <label style={{ fontSize: "var(--db-fs-sm)", color: "var(--db-accent)" }} htmlFor="ll-sheet">Changes</label>
        <button
          onClick={() => setSheet(chartAsSheet)}
          disabled={!chartAsSheet}
          style={{
            background: "none", border: "none", color: "var(--db-muted)",
            fontSize: "var(--db-fs-xs)", cursor: "pointer", textDecoration: "underline",
          }}
          title="Replace with the chart currently loaded in DukeBox"
        >
          Use current chart{chartTitle && chartTitle !== "Custom" ? ` (${chartTitle})` : ""}
        </button>
      </div>
      <textarea
        id="ll-sheet"
        value={sheet}
        onChange={(e) => setSheet(e.target.value)}
        rows={2}
        placeholder="Am7 | Bm7b5 E7b9 | Am7 | % …"
        style={{
          width: "100%", boxSizing: "border-box", marginTop: "8px",
          background: "var(--db-input-bg)", color: "var(--db-text)",
          border: "1px solid var(--db-panel-border)", borderRadius: "var(--db-r-md)",
          padding: "9px 11px", fontFamily: "var(--font-mono, monospace)",
          fontSize: "var(--db-fs-md)", resize: "vertical",
        }}
      />
      <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.62, margin: "10px 0 7px" }}>
        Tap a bar, then another, to set the section. Max 8 bars per generation.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {bars.map((b, i) => {
          const inSel = i >= selStart && i <= selEnd
          return (
            <button
              key={i}
              onClick={() => clickBar(i)}
              aria-pressed={inSel}
              style={{
                padding: "6px 10px", borderRadius: "var(--db-r-md)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
                fontFamily: "var(--font-mono, monospace)",
                border: `1px solid ${inSel ? "var(--db-accent)" : "var(--db-card-border)"}`,
                background: inSel ? "color-mix(in srgb, var(--db-accent) 15%, var(--db-bg))" : "var(--db-card-bg)",
                color: inSel ? "var(--db-accent)" : "var(--db-text)",
              }}
            >
              <span style={{ opacity: 0.55, marginRight: "5px" }}>{i + 1}</span>{b}
            </button>
          )
        })}
      </div>

      {/* Devices + direction */}
      <div style={{ marginTop: "16px" }}>
        <label style={{ fontSize: "var(--db-fs-sm)", color: "var(--db-accent)" }}>Devices</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
          {DEVICES.map(d => (
            <button
              key={d}
              onClick={() => toggleDevice(d)}
              aria-pressed={devices.has(d)}
              title={DEVICE_HINTS[d]}
              style={chip(devices.has(d))}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px", marginTop: "14px", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px" }}>
          <label style={{ fontSize: "var(--db-fs-sm)", color: "var(--db-accent)" }} htmlFor="ll-extra">Direction (optional)</label>
          <input
            id="ll-extra"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="e.g. more Martino, start on the 3rd, leave space in bar 3"
            style={{
              width: "100%", boxSizing: "border-box", marginTop: "6px",
              background: "var(--db-input-bg)", color: "var(--db-text)",
              border: "1px solid var(--db-panel-border)", borderRadius: "var(--db-r-md)",
              padding: "8px 11px", fontSize: "var(--db-fs-md)",
            }}
          />
        </div>
        <div style={{ flex: "0 0 170px" }}>
          <label style={{ fontSize: "var(--db-fs-sm)", color: "var(--db-accent)" }} htmlFor="ll-pos">Position</label>
          <select
            id="ll-pos"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            style={{ ...selectStyle, marginTop: "6px", padding: "8px 10px", fontSize: "var(--db-fs-md)" }}
          >
            {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Complexity ladder — same bars, five readings from skeleton to exotic */}
      <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.62, margin: "14px 0 7px" }}>
        Complexity — generate the same bars at any level, then compare
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {LEVELS.map((L) => {
          const active = level === L.n
          const cached = !!levelLines[L.n]
          return (
            <button
              key={L.n}
              onClick={() => setLevel(L.n)}
              aria-pressed={active}
              title={L.blurb}
              style={{
                flex: "1 1 116px", minWidth: "108px", textAlign: "left",
                padding: "7px 10px", borderRadius: "var(--db-r-md)", cursor: "pointer",
                border: `1px solid ${active ? "var(--db-accent)" : "var(--db-panel-border)"}`,
                background: active
                  ? "color-mix(in srgb, var(--db-accent) 14%, transparent)"
                  : "var(--db-input-bg)",
                color: "var(--db-text)",
              }}
            >
              <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6 }}>
                L{L.n}{cached ? " \u25CF" : ""}
              </div>
              <div style={{
                fontSize: "var(--db-fs-sm)", fontWeight: 700,
                color: active ? "var(--db-accent)" : "var(--db-text)",
              }}>{L.label}</div>
              <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6 }}>{L.blurb}</div>
            </button>
          )
        })}
      </div>

      <button
        onClick={generate}
        disabled={loading || !bars.length}
        style={{
          marginTop: "16px", width: "100%", padding: "12px 0", borderRadius: "var(--db-r-md)",
          border: "1px solid var(--db-accent)",
          background: loading
            ? "color-mix(in srgb, var(--db-accent) 20%, var(--db-bg))"
            : "color-mix(in srgb, var(--db-accent) 35%, var(--db-bg))",
          color: "var(--db-accent)", fontSize: "var(--db-fs-md)", fontWeight: 700,
          cursor: loading ? "default" : "pointer",
          opacity: bars.length ? 1 : 0.5,
        }}
      >
        {loading ? "Comping…" : result ? `Regenerate L${level}` : `Generate L${level}`}
      </button>
      {error && (
        <div style={{ marginTop: "10px", color: "var(--db-c-salmon)", fontSize: "var(--db-fs-md)" }}>{error}</div>
      )}

      {result && (
        <>
          {/* Practice transport — loop the section with the rhythm section */}
          <div style={{
            marginTop: "16px", paddingTop: "14px",
            borderTop: "1px solid var(--db-panel-border)",
            display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center",
          }}>
            <button
              onClick={() => setWithBand((v) => !v)}
              aria-pressed={withBand}
              disabled={!playLineSection}
              title={playLineSection
                ? "Loop these bars with bass, drums, and comping"
                : "Rhythm section unavailable in this view"}
              style={{ ...chip(withBand), opacity: playLineSection ? (withBand ? 1 : 0.75) : 0.4 }}
            >
              Rhythm section
            </button>
            {withBand && (
              <button onClick={() => setMuteLine((v) => !v)} aria-pressed={muteLine} style={chip(muteLine)}>
                {muteLine ? "Line muted" : "Line on"}
              </button>
            )}
            {/* Ramp only means something with the band: the solo preview plays
                through once and stops, so it never wraps to step the tempo. */}
            {withBand && (
              <button
                onClick={() => {
                  const next = !ramp
                  // A cap at or below the current tempo would pin the ramp in
                  // place, so lift it clear when switching on.
                  if (next && rampCap <= tempo) setRampCap(tempo + RAMP_HEADROOM)
                  setRamp(next)
                }}
                aria-pressed={ramp}
                title={`Step the tempo up ${RAMP_STEP} bpm each time the loop comes around`}
                style={chip(ramp)}
              >
                Ramp +{RAMP_STEP}
              </button>
            )}
            {withBand && ramp && (
              <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7, display: "flex", alignItems: "center", gap: "4px" }}>
                to
                <input
                  type="number" min={tempo + RAMP_STEP} max={320} value={rampCap}
                  onChange={(e) => setRampCap(Number(e.target.value))}
                  title="Stop speeding up once you reach this tempo"
                  style={{
                    width: "62px", padding: "3px 6px", borderRadius: "var(--db-r-sm, 6px)",
                    background: "var(--db-input-bg)", color: "var(--db-text)",
                    border: "1px solid var(--db-panel-border)", fontSize: "var(--db-fs-xs)",
                  }}
                />
              </label>
            )}
            <span style={{ fontSize: "var(--db-fs-xs)", opacity: 0.55, flex: "1 1 220px" }}>
              {withBand
                ? "Loops your selected bars with the band. Mute the line and play it yourself."
                : "Solo preview. Turn on the rhythm section to practice in the pocket."}
            </span>
          </div>

          {/* Fretboard walkthrough */}
          <div style={{
            marginTop: "18px", paddingTop: "14px",
            borderTop: "1px solid var(--db-panel-border)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <label style={{ fontSize: "var(--db-fs-sm)", color: "var(--db-accent)" }}>The line</label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "var(--db-fs-xs)", opacity: 0.62 }}>
                  {ramp && withBand && playing ? `${liveTempo}\u2191` : tempo} bpm
                </span>
                <input
                  type="range" min={60} max={220} value={tempo}
                  onChange={(e) => setTempo(Number(e.target.value))}
                  style={{ width: "110px" }}
                  aria-label="Line playback tempo"
                />
                <button
                  onClick={playing ? stopLine : startLine}
                  style={{
                    padding: "6px 16px", borderRadius: "var(--db-r-md)", cursor: "pointer",
                    border: "1px solid var(--db-accent)",
                    background: playing ? "color-mix(in srgb, var(--db-accent) 20%, var(--db-bg))" : "transparent",
                    color: "var(--db-accent)", fontSize: "var(--db-fs-sm)", fontWeight: 700,
                  }}
                >
                  {playing ? "⏹ Stop" : "▶ Play line"}
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <svg
                viewBox={`0 0 ${fbW} ${fbH}`}
                style={{ width: "100%", minWidth: "480px", marginTop: "12px", display: "block" }}
                role="img"
                aria-label="Fretboard showing the generated line, current note highlighted during playback"
              >
                <rect x={nutX} y={10} width={fbW - nutX - 12} height={fbH - 24} fill="#18100A" rx={4} />
                <rect x={nutX - 4} y={10} width={5} height={fbH - 24} fill="#E8DFC8" rx={1} />
                {Array.from({ length: fretCount }, (_, i) => (
                  <rect key={i} x={nutX + (i + 1) * fretW} y={10} width={1.6} height={fbH - 24} fill="#5a5348" />
                ))}
                {[3, 5, 7, 9, 15].map(f => (
                  <circle key={f} cx={nutX + (f - 0.5) * fretW} cy={fbH / 2 - 2} r={4.5} fill="#3A2E20" />
                ))}
                <circle cx={nutX + 11.5 * fretW} cy={fbH / 2 - 21} r={4.5} fill="#3A2E20" />
                <circle cx={nutX + 11.5 * fretW} cy={fbH / 2 + 17} r={4.5} fill="#3A2E20" />
                {[1, 2, 3, 4, 5, 6].map(s => (
                  <line key={s} x1={nutX - 4} y1={stringY(s)} x2={fbW - 12} y2={stringY(s)}
                    stroke="#8A7850" strokeWidth={0.6 + s * 0.24} />
                ))}
                {[3, 5, 7, 9, 12, 15].map(f => (
                  <text key={f} x={nutX + (f - 0.5) * fretW} y={fbH - 2} textAnchor="middle"
                    fontSize={9} fill="#888" fontFamily="Arial, sans-serif">{f}</text>
                ))}
                {flatNotes.map((n, i) => {
                  const isCurrent = currentNote && i === playIdx
                  const played = playIdx >= 0 && i < playIdx
                  return (
                    <g key={i}>
                      <circle
                        cx={noteX(n.f)} cy={stringY(n.s)} r={isCurrent ? 9 : 6}
                        fill={isCurrent ? "#E09B3D" : played ? "rgba(224,155,61,0.4)" : "rgba(255,255,255,0.3)"}
                        stroke={isCurrent ? "#FFF3D6" : "none"} strokeWidth={isCurrent ? 1.5 : 0}
                      />
                      {isCurrent && (
                        <text x={noteX(n.f)} y={stringY(n.s) + 3.5} textAnchor="middle"
                          fontSize={8.5} fontWeight="bold" fill="#1B1608" fontFamily="Arial, sans-serif">
                          {noteName(n.s, n.f)}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>
            </div>

            {currentNote && (
              <div style={{ fontSize: "var(--db-fs-sm)", color: "var(--db-accent)", marginTop: "4px", fontFamily: "var(--font-mono, monospace)" }}>
                {noteName(currentNote.s, currentNote.f)} — string {currentNote.s}, fret {currentNote.f} — bar{" "}
                {currentNote.bi + 1}: {result.bars[currentNote.bi]?.c}
              </div>
            )}
          </div>

          {/* Tab */}
          <div style={{ marginTop: "14px", overflowX: "auto" }}>
            <label style={{ fontSize: "var(--db-fs-sm)", color: "var(--db-accent)" }}>Tab</label>
            <pre style={{
              fontFamily: "var(--font-mono, monospace)", fontSize: "var(--db-fs-sm)", lineHeight: 1.5,
              color: "var(--db-text)", marginTop: "8px", whiteSpace: "pre",
            }}>{buildTab(result.bars)}</pre>
          </div>

          {/* Per-bar reasoning */}
          <div style={{ display: "grid", gap: "8px", marginTop: "14px" }}>
            {result.bars.map((bar, i) => (
              <div key={i} style={{
                background: currentNote && currentNote.bi === i
                  ? "color-mix(in srgb, var(--db-accent) 12%, var(--db-card-bg))"
                  : "var(--db-card-bg)",
                border: `1px solid ${currentNote && currentNote.bi === i ? "var(--db-accent)" : "var(--db-card-border)"}`,
                borderRadius: "var(--db-r-md)", padding: "11px 14px",
                display: "flex", gap: "14px", alignItems: "baseline", flexWrap: "wrap",
              }}>
                <span style={{ fontFamily: "var(--font-mono, monospace)", color: "var(--db-accent)", fontSize: "var(--db-fs-md)", minWidth: "86px" }}>
                  {i + 1}. {bar.c}
                </span>
                <span style={{
                  fontSize: "var(--db-fs-xs)", padding: "2px 9px", borderRadius: 999,
                  background: "var(--db-panel-bg)", border: "1px solid var(--db-panel-border)",
                }}>{bar.d}</span>
                <span style={{ fontSize: "var(--db-fs-sm)", opacity: 0.8, flex: 1, minWidth: "200px" }}>{bar.x}</span>
              </div>
            ))}
          </div>

          {result.s && (
            <p style={{
              fontSize: "var(--db-fs-md)", marginTop: "14px", paddingLeft: "12px",
              borderLeft: "3px solid var(--db-accent)", fontStyle: "italic", opacity: 0.9,
            }}>{result.s}</p>
          )}
          {result.clipped && (
            <p style={{ fontSize: "var(--db-fs-sm)", opacity: 0.62, marginTop: "8px" }}>
              Section was longer than 8 bars, so only the first 8 were generated. Select the next
              stretch and run it again to continue the chorus.
            </p>
          )}
        </>
      )}
    </div>
  )
}
