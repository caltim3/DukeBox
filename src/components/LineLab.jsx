"use client"

// Line Lab — generate a single-note improvised line, return it as notation + TAB with
// per-bar reasoning, step it across the fretboard, and practice it with the
// rhythm section.
//
// This is the merged lab. It used to be two panels: the Chart lab in Write
// (seeded from the chart loaded in DukeBox) and the Triad Network lab at the
// foot of Practice (seeded from a vocabulary preset, with the tutorial). They
// were the same generator behind two UIs, so they're now one panel with a
// Source switch — everything both of them could do, in one place:
//
//   Chart   — type or pull in changes, pick any stretch up to 8 bars
//   Network — triad-network presets (pairs, cells, pivots, enclosures,
//             rest-stroke triplets, Martino Mode) over a generated II-V-I,
//             blues, modal or rhythm-bridge section
//
// Generation always goes through /api/generate-line, so the key, tab rendering,
// and band/fretboard playback are identical whichever source you use.

import { useEffect, useMemo, useRef, useState } from "react"
import LineNotation from "@/components/LineNotation"
import { exportLineMusicXML } from "@/lib/music/leadsheet"
import { LICK_KEYS, transposeLine } from "@/lib/music/licktionary"
import { parseGigChord } from "@/lib/music/gigbook"
import {
  TN_TONICS, TN_CHORD_TYPES, TN_PROGRESSIONS, TN_POSITIONS,
  TN_LEVEL_RULES, TN_TUTORIAL, guessQuality,
} from "@/lib/music/triadNetwork"

const DEVICES = [
  "Chromatics", "Bebop scale", "Enclosures", "Altered",
  "Melodic cells", "Triads", "Triad pairs", "Scale choice",
  "Pivot arpeggios", "Rest-stroke triplets", "Minor conversion (Martino)",
]

// Devices whose meaning isn't obvious from the chip alone.
const DEVICE_HINTS = {
  "Rest-stroke triplets":
    "Pat Martino's rest-stroke (apoyando) flow — continuous eighth-note triplets, " +
    "picked so each stroke comes to rest on the next string. Accent the first of every three.",
  "Pivot arpeggios":
    "Edges as objects — arpeggiate off a chord tone into the next chord's arpeggio " +
    "rather than restarting from its root.",
  "Minor conversion (Martino)":
    "Play the ii minor over both the ii and the V, then flip one note on the I.",
}

// The route has a dedicated rule for rest-strokes and for minor conversion;
// everything else is passed through as emphasis.
function routeDevices(selected, martino) {
  const out = []
  for (const d of selected) {
    if (d === "Minor conversion (Martino)") out.push("minor conversion")
    else out.push(d)
  }
  if (martino && !out.includes("minor conversion")) out.push("minor conversion")
  return out
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

// One ladder, read two ways: the Chart lab's names on top, the practice
// system's rule underneath.
const LEVELS = [
  { n: 1, label: "Skeleton",  blurb: "Chord + guide tones" },
  { n: 2, label: "Inside",    blurb: "Recommended scale + bebop" },
  { n: 3, label: "Chromatic", blurb: "Enclosures + approaches" },
  { n: 4, label: "Structures",blurb: "Triad pairs + cells" },
  { n: 5, label: "Exotic",    blurb: "Altered + side-slip" },
]

function parseBars(text) {
  const raw = text.split(/\n|\|/).map(b => b.trim()).filter(Boolean)
  const bars = []
  for (const b of raw) {
    if (b === "%" && bars.length) bars.push(bars[bars.length - 1])
    else bars.push(b)
  }
  return bars
}

export default function LineLab({ chartBars, chartTitle, panelStyle, eyebrowStyle, selectStyle, onStopPlayback, playLineSection, licks = [], selectedLickId, onSelectLick, requestedLick, onSaveLick }) {
  // Seed the sheet from whatever chart is loaded in DukeBox
  const chartAsSheet = useMemo(
    () => (chartBars ?? []).map(b => b.symbol).join(" | "),
    [chartBars]
  )

  // ── Source: your chart, or a triad-network preset ──
  const [source, setSource] = useState("chart")
  const isNetwork = source === "network"
  const isLicktionary = source === "licktionary"
  const isChart = source === "chart"
  const [lickKey, setLickKey] = useState("C")

  useEffect(() => {
    if (!requestedLick?.id) return
    setSource("licktionary")
    setLickKey(requestedLick.key || "C")
    onSelectLick?.(requestedLick.id)
  }, [requestedLick?.nonce]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const [soundingIdx, setSoundingIdx] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const timerRef = useRef(null)
  const noteTimerRef = useRef(null)

  // ── Network preset controls ──
  const [tonic, setTonic] = useState("C")
  const [chordType, setChordType] = useState("maj7")
  const [progression, setProgression] = useState("major_251_martino")
  const [netPosition, setNetPosition] = useState("5th position (frets 3-8)")
  const [openDoc, setOpenDoc] = useState(null)

  // Complexity ladder — lines cached per level so levels can be compared
  // over the same bars without regenerating.
  const [level, setLevel] = useState(3)
  const [levelLines, setLevelLines] = useState({})

  // Practice transport: play the line in the pocket with the rhythm section
  const [withBand, setWithBand] = useState(false)
  const [withChords, setWithChords] = useState(true)
  const [muteLine, setMuteLine] = useState(false)
  const [ramp, setRamp] = useState(false)
  const [rampCap, setRampCap] = useState(160)
  const [liveTempo, setLiveTempo] = useState(120)
  const prevBarRef = useRef(-1)
  const lastChordRef = useRef(null)   // which chord the solo preview last struck
  const rampTempoRef = useRef(120)
  const rampCapRef = useRef(160)
  const RAMP_STEP = 5
  const RAMP_HEADROOM = 40   // default room above the current tempo to ramp into

  // ── Faders: the band under the line, and the line itself ──
  const [bandLevel, setBandLevel] = useState(1)
  const [lineLevel, setLineLevel] = useState(1)
  useEffect(() => {
    let cancelled = false
    import("@/lib/music/audio")
      .then((audio) => { if (!cancelled) audio.setMixLevels({ band: bandLevel, line: lineLevel }) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [bandLevel, lineLevel])

  const [exported, setExported] = useState(false)

  const prog = TN_PROGRESSIONS[progression]
  const isMartino = !!prog?.martino
  const netChords = useMemo(
    () => prog.build(tonic, chordType),
    [prog, tonic, chordType]
  )

  const chartChords = useMemo(() => parseBars(sheet), [sheet])
  const selectedLick = useMemo(
    () => licks.find((lick) => lick.id === selectedLickId) || licks[0] || null,
    [licks, selectedLickId]
  )
  const lickLine = useMemo(
    () => selectedLick ? transposeLine(selectedLick.line, selectedLick.baseKey || "C", lickKey) : null,
    [selectedLick, lickKey]
  )
  const bars = isLicktionary ? (lickLine?.bars || []).map((bar) => bar.c) : isNetwork ? netChords : chartChords

  useEffect(() => {
    if (!isChart) return
    setSelStart(0)
    setSelEnd(Math.min(3, Math.max(0, chartChords.length - 1)))
  }, [sheet, chartChords.length, isChart])

  // A new section — or a new source — invalidates every cached level
  useEffect(() => {
    setLevelLines({})
    setResult(null)
    setExported(false)
  }, [selStart, selEnd, sheet, source, progression, tonic, chordType])

  useEffect(() => {
    if (!isLicktionary) return
    stopLine()
    setWithBand(false)
    setResult(lickLine)
    setExported(false)
  }, [isLicktionary, lickLine]) // eslint-disable-line react-hooks/exhaustive-deps

  // Each note carries the chord that should be sounding under it, so the solo
  // preview can comp along. A bar's `c` may name more than one chord
  // ("Bm7b5 E7b9"); those split the bar evenly, in written order.
  const flatNotes = useMemo(() => {
    if (!result) return []
    const out = []
    let carriedRest = 0
    result.bars.forEach((bar, bi) => {
      const notes = bar.n || []
      const syms = String(bar.c || "").trim().split(/\s+/).filter(Boolean)
      const usedBeats = notes.reduce((n, ev) => n + (Number(ev[2]) || 0) + (Number(ev[3]) || 0), 0)
      const barBeats = Number(bar.beats) || usedBeats || 4
      let pos = 0
      notes.forEach(([s, f, b, wait = 0], noteIndex) => {
        const effectiveWait = (Number(wait) || 0) + (noteIndex === 0 ? carriedRest : 0)
        pos += effectiveWait
        const ci = syms.length > 1
          ? Math.min(syms.length - 1, Math.floor((pos / barBeats) * syms.length))
          : 0
        out.push({ s, f, b, wait: effectiveWait, bi, chord: syms[ci] || "", chordKey: `${bi}:${ci}` })
        pos += b
      })
      carriedRest = Number(bar.tailRest) || 0
    })
    // How long each chord rings: until the next chord change.
    const spans = {}
    for (const n of out) spans[n.chordKey] = (spans[n.chordKey] || 0) + n.b
    for (const n of out) n.chordBeats = spans[n.chordKey]
    return out
  }, [result])

  function clickBar(i) {
    if (!isChart) return
    if (selStart === selEnd && i > selStart) setSelEnd(i)
    else { setSelStart(i); setSelEnd(i) }
  }

  // Switching level swaps in that level's cached line (or clears if not generated)
  useEffect(() => {
    stopLine()
    setResult(levelLines[level] ?? null)
    setExported(false)
  }, [level])   // eslint-disable-line react-hooks/exhaustive-deps

  function toggleDevice(d) {
    setDevices(prev => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d); else next.add(d)
      return next
    })
  }

  // Reuse DukeBox's Tone.js piano samples so Line Lab doesn't spin up its own
  // AudioContext. The line plays on its own sampler voice — same timbre as the
  // band, separate fader.
  async function playNote(s, f) {
    try {
      const audio = await import("@/lib/music/audio")
      await audio.playLineNote(noteWithOctave(s, f))
    } catch { /* preview is non-essential — stay silent rather than throw */ }
  }

  async function playChord(symbol, beats) {
    try {
      const audio = await import("@/lib/music/audio")
      await audio.playChordStab(symbol, Math.max(0.4, beats * (60 / tempo)))
    } catch { /* preview is non-essential — stay silent rather than throw */ }
  }

  function stopLine() {
    setPlaying(false)
    setPlayIdx(-1)
    setSoundingIdx(-1)
    prevBarRef.current = -1
    lastChordRef.current = null
    clearTimeout(timerRef.current)
    clearTimeout(noteTimerRef.current)
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
    const next = running + noteIdx
    setPlayIdx(next)
    setSoundingIdx(next)
  }

  // Network presets aren't in the loaded chart, so the band has to be handed
  // the preset's own bars rather than a slice of the chart.
  const netBars = useMemo(
    () => netChords.map((sym) => parseGigChord(sym, "A") ?? { root: "C", quality: "maj7", symbol: sym, section: "A", beats: 4 }),
    [netChords]
  )

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
        barsOverride: isNetwork ? netBars : null,
        startIndex: isNetwork ? 0 : selStart,
        endIndex: isNetwork ? netBars.length - 1 : Math.min(selEnd, selStart + 7),
        practiceTempo: tempo,
        muteLine,
        onBar: onBandBar,
        onLineNote: onBandNote,
        onDone: () => { setPlaying(false); setPlayIdx(-1); setSoundingIdx(-1) },
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
    // Comp the harmony under the line: strike each chord as the line reaches it.
    if (withChords && note.chord && note.chordKey !== lastChordRef.current) {
      lastChordRef.current = note.chordKey
      playChord(note.chord, note.chordBeats)
    }
    const waitMs = (note.wait || 0) * (60 / tempo) * 1000
    if (waitMs) {
      setSoundingIdx(-1)
      noteTimerRef.current = setTimeout(() => { setSoundingIdx(playIdx); playNote(note.s, note.f) }, waitMs)
    } else {
      setSoundingIdx(playIdx)
      playNote(note.s, note.f)
    }
    const ms = (note.b + (note.wait || 0)) * (60 / tempo) * 1000
    timerRef.current = setTimeout(() => setPlayIdx(i => i + 1), ms)
    return () => { clearTimeout(timerRef.current); clearTimeout(noteTimerRef.current) }
  }, [playing, playIdx])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { clearTimeout(timerRef.current); clearTimeout(noteTimerRef.current) }, [])

  async function generate() {
    stopLine()
    setLoading(true); setError(null); setResult(null); setExported(false)

    const section = isNetwork
      ? netChords
      : chartChords.slice(selStart, Math.min(selEnd + 1, selStart + 8))
    const clipped = !isNetwork && selEnd - selStart + 1 > 8

    // Richer bar data (root/quality/beats) lets the route feed the model
    // DukeBox's own scale recommendations and guide tones.
    const chartSlice = isNetwork
      ? netChords.map((sym) => ({ symbol: sym, quality: guessQuality(sym), beats: 4 }))
      : (chartBars ?? []).slice(selStart, Math.min(selEnd + 1, selStart + 8))
          .map((b) => ({ symbol: b.symbol, root: b.root, quality: b.quality, beats: b.beats }))

    try {
      const res = await fetch("/api/generate-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section,
          devices: routeDevices(devices, isNetwork && isMartino),
          position: isNetwork ? netPosition : position,
          extra: (isNetwork && isMartino ? "Use the Martino minor-conversion approach throughout. " : "") + extra,
          mode: isNetwork && isMartino ? "martino" : undefined,
          level,
          chartBars: chartSlice,
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

  function exportXML() {
    const title = isLicktionary
      ? `${selectedLick?.name || "Lick"} (${selectedLick?.mode || "custom"}, ${lickKey})`
      : isNetwork
      ? `${TN_PROGRESSIONS[progression].label} in ${tonic}`
      : (chartTitle && chartTitle !== "Custom" ? chartTitle : "Line Lab")
    const ok = exportLineMusicXML({ line: result, title, tempo, level: isLicktionary ? null : level })
    setExported(ok)
  }

  function saveCurrentLick() {
    if (!result || !onSaveLick) return
    const suggested = `${chartTitle && chartTitle !== "Custom" ? chartTitle : "Line Lab"} L${level}`
    const name = window.prompt("Name this lick:", suggested)?.trim()
    if (!name) return
    onSaveLick({ name, line: result, baseKey: null, mode: "custom", device: Array.from(devices).join(" · "), cue: extra || result.s || "Saved from Line Lab" })
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

  const ct = TN_CHORD_TYPES[chordType]

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px", flexWrap: "wrap" }}>
        <div style={{ ...eyebrowStyle, marginBottom: 0 }}>LINE LAB</div>
        <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.62 }}>
              Improvised single-note lines — as notation + TAB, with per-bar reasoning, over your chart or the triad network
        </div>
      </div>

      {/* Source switch */}
      <div style={{ display: "flex", gap: "6px", marginTop: "12px", flexWrap: "wrap" }}>
        <button onClick={() => setSource("chart")} aria-pressed={!isNetwork} style={chip(!isNetwork)}>
          Chart changes
        </button>
        <button onClick={() => setSource("network")} aria-pressed={isNetwork} style={chip(isNetwork)}>
          Triad network preset
        </button>
        <button onClick={() => setSource("licktionary")} aria-pressed={isLicktionary} style={chip(isLicktionary)}>
          Licktionary
        </button>
      </div>

      {/* Triad-network tutorial — the practice system behind the presets */}
      <details style={{ marginTop: "12px" }}>
        <summary style={{ cursor: "pointer", fontSize: "var(--db-fs-sm)", color: "var(--db-c-purple, var(--db-accent))" }}>
          The practice system — pairs · cells · pivots · enclosures · rest-stroke triplets · Martino Mode
        </summary>
        <div style={{ marginTop: "8px" }}>
          {TN_TUTORIAL.map((sec) => {
            const open = openDoc === sec.id
            return (
              <div key={sec.id} style={{
                borderRadius: "var(--db-r-md)", marginBottom: "6px",
                border: `1px solid ${sec.highlight ? "color-mix(in srgb, var(--db-c-pink) 40%, transparent)" : "var(--db-card-border)"}`,
                background: sec.highlight ? "color-mix(in srgb, var(--db-c-pink) 8%, var(--db-bg))" : "var(--db-card-bg)",
              }}>
                <button
                  onClick={() => setOpenDoc(open ? null : sec.id)}
                  style={{
                    width: "100%", textAlign: "left", padding: "10px 12px", cursor: "pointer",
                    background: "transparent", border: "none", color: "var(--db-text)",
                    fontSize: "var(--db-fs-md)", fontWeight: 600,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}
                >
                  <span>{sec.highlight ? "★ " : ""}{sec.title}</span>
                  <span style={{ opacity: 0.5, fontSize: "0.8em" }}>{open ? "−" : "+"}</span>
                </button>
                {open && (
                  <div style={{ padding: "0 12px 12px", fontSize: "var(--db-fs-sm)", lineHeight: 1.6, opacity: 0.86 }}>
                    {sec.body}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </details>

      {/* ── Chart source: lead sheet + bar picker ── */}
      {isChart && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "14px" }}>
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
        </>
      )}

      {/* ── Network source: preset controls ── */}
      {isNetwork && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", marginTop: "14px" }}>
            <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7 }}>Tonic
              <select value={tonic} onChange={(e) => setTonic(e.target.value)} style={{ ...selectStyle, width: "100%", marginTop: "4px" }}>
                {TN_TONICS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7 }}>Chord type
              <select value={chordType} onChange={(e) => setChordType(e.target.value)} style={{ ...selectStyle, width: "100%", marginTop: "4px" }}>
                {Object.entries(TN_CHORD_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7 }}>Progression
              <select value={progression} onChange={(e) => setProgression(e.target.value)} style={{ ...selectStyle, width: "100%", marginTop: "4px" }}>
                {Object.entries(TN_PROGRESSIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7 }}>Position
              <select value={netPosition} onChange={(e) => setNetPosition(e.target.value)} style={{ ...selectStyle, width: "100%", marginTop: "4px" }}>
                {TN_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          </div>
          <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, margin: "10px 0 7px" }}>
            {ct.scale} · pairs {ct.pairs.join(", ")} · cells {ct.cells.join(", ")} · color {ct.color}
            {isMartino && <span style={{ color: "var(--db-c-purple, var(--db-accent))" }}> · minor conversion, F→F# on the I, altered lift on the V</span>}
          </div>
        </>
      )}

      {isLicktionary && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 2fr) minmax(120px, 1fr)", gap: "10px", marginTop: "14px" }}>
          <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7 }}>Lick
            <select
              value={selectedLick?.id || ""}
              onChange={(e) => onSelectLick?.(e.target.value)}
              style={{ ...selectStyle, width: "100%", marginTop: "4px" }}
            >
              {licks.map((lick) => (
                <option key={lick.id} value={lick.id}>
                  {lick.n ? `${lick.n}. ` : ""}{lick.name} · {lick.mode}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7 }}>Key
            <select value={lickKey} onChange={(e) => setLickKey(e.target.value)} style={{ ...selectStyle, width: "100%", marginTop: "4px" }}>
              {LICK_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
            </select>
          </label>
          {selectedLick && (
            <div style={{ gridColumn: "1 / -1", fontSize: "var(--db-fs-sm)", lineHeight: 1.5, opacity: 0.78 }}>
              <b>{selectedLick.device}</b>{selectedLick.cue ? ` · ${selectedLick.cue}` : ""}
            </div>
          )}
        </div>
      )}

      {/* Bars — clickable in Chart mode, the preset section in Network mode */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {bars.map((b, i) => {
          const inSel = !isChart ? true : (i >= selStart && i <= selEnd)
          const isNow = currentNote?.bi === i
          return (
            <button
              key={i}
              onClick={() => clickBar(i)}
              aria-pressed={inSel}
              style={{
                padding: "6px 10px", borderRadius: "var(--db-r-md)", fontSize: "var(--db-fs-sm)",
                cursor: isChart ? "pointer" : "default",
                fontFamily: "var(--font-mono, monospace)",
                border: `1px solid ${isNow ? "var(--db-c-green, var(--db-accent))" : inSel ? "var(--db-accent)" : "var(--db-card-border)"}`,
                background: isNow
                  ? "color-mix(in srgb, var(--db-c-green, var(--db-accent)) 18%, var(--db-bg))"
                  : inSel ? "color-mix(in srgb, var(--db-accent) 15%, var(--db-bg))" : "var(--db-card-bg)",
                color: inSel ? "var(--db-accent)" : "var(--db-text)",
              }}
            >
              <span style={{ opacity: 0.55, marginRight: "5px" }}>{i + 1}</span>{b}
            </button>
          )
        })}
      </div>

      {/* Devices + direction */}
      {!isLicktionary && <div style={{ marginTop: "16px" }}>
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
      </div>}

      {!isLicktionary && <div style={{ display: "flex", gap: "12px", marginTop: "14px", flexWrap: "wrap" }}>
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
        {!isNetwork && (
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
        )}
      </div>}

      {/* Complexity ladder — same bars, five readings from skeleton to exotic */}
      {!isLicktionary && <><div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.62, margin: "14px 0 7px" }}>
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
              title={`${L.blurb} — ${TN_LEVEL_RULES[L.n]}`}
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
                L{L.n}{cached ? " ●" : ""}
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
      <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, marginTop: "6px" }}>{TN_LEVEL_RULES[level]}</div>

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
      </>}
      {error && (
        <div style={{ marginTop: "10px", color: "var(--db-c-salmon)", fontSize: "var(--db-fs-md)" }}>{error}</div>
      )}

      {result && (
        <>
          {/* Export — a fresh line, straight into notation software */}
          <div style={{
            marginTop: "14px", padding: "12px 14px", borderRadius: "var(--db-r-md)",
            border: "1px solid var(--db-panel-border)", background: "var(--db-card-bg)",
            display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap",
          }}>
            <div style={{ flex: "1 1 240px" }}>
              <div style={{ fontSize: "var(--db-fs-sm)", fontWeight: 700 }}>Export this line</div>
              <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.62 }}>
                MusicXML — notation, chord symbols, and the string/fret it was written for.
                Opens in MuseScore, Sibelius, Finale, Dorico.
              </div>
            </div>
            <button
              onClick={exportXML}
              style={{
                padding: "8px 16px", borderRadius: "var(--db-r-md)", cursor: "pointer",
                border: "1px solid var(--db-accent)", background: "transparent",
                color: "var(--db-accent)", fontSize: "var(--db-fs-sm)", fontWeight: 700,
              }}
            >
              {exported ? "✓ Exported" : "⤓ MusicXML"}
            </button>
            {!isLicktionary && onSaveLick && (
              <button
                onClick={saveCurrentLick}
                style={{
                  padding: "8px 16px", borderRadius: "var(--db-r-md)", cursor: "pointer",
                  border: "1px solid var(--db-c-green)", background: "transparent",
                  color: "var(--db-c-green)", fontSize: "var(--db-fs-sm)", fontWeight: 700,
                }}
              >
                + Add to Licktionary
              </button>
            )}
          </div>

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
            {/* Solo preview only — with the band on, the piano is already comping. */}
            {!withBand && (
              <button
                onClick={() => setWithChords((v) => !v)}
                aria-pressed={withChords}
                title="Sound each chord on the piano as the line reaches it"
                style={chip(withChords)}
              >
                {withChords ? "Chords on" : "Chords off"}
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
                : withChords
                ? "Solo preview with piano chords under the line. Turn on the rhythm section to practice in the pocket."
                : "Solo preview, line only. Turn on the rhythm section to practice in the pocket."}
            </span>
          </div>

          {/* Faders — balance the line against the band */}
          <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", marginTop: "12px" }}>
            <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.75, display: "flex", alignItems: "center", gap: "8px" }}>
              Band
              <input
                type="range" min={0} max={2} step={0.05} value={bandLevel}
                onChange={(e) => setBandLevel(Number(e.target.value))}
                style={{ width: "120px" }}
                aria-label="Band volume"
              />
              <span style={{ fontFamily: "var(--font-mono, monospace)", minWidth: "34px" }}>
                {Math.round(bandLevel * 100)}%
              </span>
            </label>
            <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.75, display: "flex", alignItems: "center", gap: "8px" }}>
              Line
              <input
                type="range" min={0} max={2} step={0.05} value={lineLevel}
                onChange={(e) => setLineLevel(Number(e.target.value))}
                style={{ width: "120px" }}
                aria-label="Line melody volume"
              />
              <span style={{ fontFamily: "var(--font-mono, monospace)", minWidth: "34px" }}>
                {Math.round(lineLevel * 100)}%
              </span>
            </label>
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
                  {ramp && withBand && playing ? `${liveTempo}↑` : tempo} bpm
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
                <rect x={nutX} y={10} width={fbW - nutX - 12} height={fbH - 24} fill="var(--fretboard)" rx={4} />
                <rect x={nutX - 4} y={10} width={5} height={fbH - 24} fill="var(--text)" rx={1} />
                {Array.from({ length: fretCount }, (_, i) => (
                  <rect key={i} x={nutX + (i + 1) * fretW} y={10} width={1.6} height={fbH - 24} fill="var(--fretwire)" />
                ))}
                {[3, 5, 7, 9, 15].map(f => (
                  <circle key={f} cx={nutX + (f - 0.5) * fretW} cy={fbH / 2 - 2} r={4.5} fill="var(--marker)" />
                ))}
                <circle cx={nutX + 11.5 * fretW} cy={fbH / 2 - 21} r={4.5} fill="var(--marker)" />
                <circle cx={nutX + 11.5 * fretW} cy={fbH / 2 + 17} r={4.5} fill="var(--marker)" />
                {[1, 2, 3, 4, 5, 6].map(s => (
                  <line key={s} x1={nutX - 4} y1={stringY(s)} x2={fbW - 12} y2={stringY(s)}
                    stroke="var(--muted)" strokeWidth={0.6 + s * 0.24} />
                ))}
                {[3, 5, 7, 9, 12, 15].map(f => (
                  <text key={f} x={nutX + (f - 0.5) * fretW} y={fbH - 2} textAnchor="middle"
                    fontSize={9} fill="var(--muted)" fontFamily="Arial, sans-serif">{f}</text>
                ))}
                {flatNotes.map((n, i) => {
                  const isCurrent = currentNote && i === playIdx
                  const played = playIdx >= 0 && i < playIdx
                  return (
                    <g key={i}>
                      <circle
                        cx={noteX(n.f)} cy={stringY(n.s)} r={isCurrent ? 9 : 6}
                        fill={isCurrent ? "var(--target)" : played ? "color-mix(in srgb, var(--target) 40%, transparent)" : "color-mix(in srgb, var(--text) 30%, transparent)"}
                        stroke={isCurrent ? "var(--text)" : "none"} strokeWidth={isCurrent ? 1.5 : 0}
                      />
                      {isCurrent && (
                        <text x={noteX(n.f)} y={stringY(n.s) + 3.5} textAnchor="middle"
                          fontSize={8.5} fontWeight="bold" fill="var(--bg)" fontFamily="Arial, sans-serif">
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

          {/* Standard notation + TAB — driven by the same timed line events as playback */}
          <div style={{ marginTop: "14px", overflowX: "auto" }}>
            <label style={{ fontSize: "var(--db-fs-sm)", color: "var(--db-accent)", display: "block", marginBottom: "8px" }}>Notation + TAB</label>
            <LineNotation line={result} tempo={tempo} activeIndex={soundingIdx} />
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
