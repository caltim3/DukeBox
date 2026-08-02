"use client"

// Triad Network — the practice-system companion to Line Lab.
//
// A second Line Lab surface living inside the Write workspace. It carries the
// triad-network tutorial (pairs, cells, pivots, enclosures, rest-stroke triplets,
// the 5-level inside/outside system, and Martino Mode) and a line generator tuned
// to that vocabulary. Generation goes through the SAME server route as the Chart
// lab (/api/generate-line), so it inherits the server-side key, tab rendering, and
// band/fretboard playback. Nothing in the existing LineLab is touched.

import { useMemo, useRef, useState } from "react"
import { buildTab } from "@/lib/music/lines"

// ─── Vocabulary (mirrors the tutorial's tables) ───────────────────────────────
const TONICS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]

const CHORD_TYPES = {
  maj7:    { label: "maj7",        scale: "lydian",              pairs: ["C+D", "G+D"],          cells: ["1-2-3-5", "5-6-7-9", "3-5-7-9"], color: "9, #11, 13" },
  m7:      { label: "m7 (dorian)", scale: "dorian",              pairs: ["bIII+IV", "Im+IIm"],   cells: ["1-2-b3-5", "b3-5-b7-9"],          color: "9, 11, 13" },
  m_maj7:  { label: "m(maj7)",     scale: "melodic minor",       pairs: ["IV+V", "Im+V+"],       cells: ["1-2-b3-5", "b3-5-7-9"],           color: "maj7 + nat13 over minor" },
  dom7:    { label: "7 (mixo)",    scale: "mixolydian",          pairs: ["bVII+I"],              cells: ["1-2-3-5", "3-5-b7-9"],            color: "9, 13" },
  dom7s11: { label: "7#11",        scale: "lydian dominant",     pairs: ["I+II"],                cells: ["3-5-b7-9", "2-3-#4-6"],           color: "9, #11, 13" },
  alt:     { label: "7alt",        scale: "altered (mel minor)", pairs: ["bV+bVI"],              cells: ["3-#5-b7-b9", "b9-#9-3-b7"],       color: "b9, #9, b5, #5" },
  m7b5:    { label: "m7b5",        scale: "locrian nat2",        pairs: ["bVI+bVII"],            cells: ["1-b3-b5-b7", "b3-b5-b7-9"],       color: "nat 9" },
  dim7:    { label: "dim7",        scale: "whole-half dim",      pairs: ["II+IV"],               cells: ["dim7 arp + chromatic approach"],  color: "dim maj7 colors" },
}

const PROGRESSIONS = {
  static:            { label: "Static chord",              build: (t, q) => [`${t}${CHORD_TYPES[q].label}`, `${t}${CHORD_TYPES[q].label}`, `${t}${CHORD_TYPES[q].label}`, `${t}${CHORD_TYPES[q].label}`] },
  major_251:         { label: "Major II-V-I",              build: (t) => degrees251(t, "major") },
  minor_251:         { label: "Minor ii-V-i",              build: (t) => degrees251(t, "minor") },
  major_251_martino: { label: "Major II-V-I (Martino Mode)", martino: true, build: (t) => degrees251(t, "major") },
  blues:             { label: "Blues (first 4 of 12)",     build: (t) => [`${t}7`, `${t}7`, `${t}7`, `${t}7`] },
  modal:             { label: "Modal (dorian vamp)",       build: (t) => [`${t}m7`, `${t}m7`, `${t}m7`, `${t}m7`] },
  rhythm_bridge:     { label: "Rhythm bridge (dominants)", build: (t) => cycleDominants(t) },
}

// Very small helper set so presets produce real chord symbols for the route.
const CHROMATIC = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
const ENH = { Db: "C#", "D#": "Eb", Gb: "F#", "G#": "Ab", "A#": "Bb" }
function normRoot(r) { return ENH[r] || r }
function transpose(root, semis) {
  const i = CHROMATIC.indexOf(normRoot(root))
  if (i < 0) return root
  return CHROMATIC[(i + semis + 120) % 12]
}
function degrees251(tonic, quality) {
  if (quality === "minor") {
    return [`${transpose(tonic, 2)}m7b5`, `${transpose(tonic, 7)}7alt`, `${tonic}m(maj7)`, `${tonic}m(maj7)`]
  }
  return [`${transpose(tonic, 2)}m7`, `${transpose(tonic, 7)}7`, `${tonic}maj7`, `${tonic}maj7`]
}
function cycleDominants(tonic) {
  // III7 VI7 II7 V7 style descending fourths, tonic as I
  return [`${transpose(tonic, 4)}7`, `${transpose(tonic, 9)}7`, `${transpose(tonic, 2)}7`, `${transpose(tonic, 7)}7`]
}

const DEVICES = [
  "Triad pairs", "Melodic cells", "Chromatic enclosures",
  "Pivot arpeggios", "Rest-stroke triplets", "Minor conversion (Martino)",
]

const LEVELS = [
  { id: 1, label: "L1", name: "Chord tones",      color: "#4ade80", rule: "Chord tones, diatonic cells, single chromatic approaches." },
  { id: 2, label: "L2", name: "Diatonic",         color: "#22d3ee", rule: "Triad pairs, diatonic 7th pivots. Fully inside." },
  { id: 3, label: "L3", name: "Chromatic",        color: "#3b82f6", rule: "Enclosures, passing diminished, neighbor expansion." },
  { id: 4, label: "L4", name: "Superimposition",  color: "#a78bfa", rule: "Melodic minor, quartal + dominant pivots, pentatonic." },
  { id: 5, label: "L5", name: "Outside",          color: "#f472b6", rule: "Alt pairs, planing, side-slip, symmetric dim." },
]

// Map our device labels to the route's device rules (Rest-stroke triplets has a
// dedicated server rule; others are passed through as emphasis).
function routeDevices(selected, martino) {
  const out = []
  selected.forEach((d) => {
    if (d === "Rest-stroke triplets") out.push("Rest-stroke triplets")
    else if (d === "Minor conversion (Martino)") out.push("minor conversion")
    else out.push(d.replace("Chromatic ", ""))
  })
  if (martino && !out.includes("minor conversion")) out.push("minor conversion")
  return out
}

// ─── The tutorial content (condensed, expandable) ─────────────────────────────
const TUTORIAL = [
  {
    id: "network", title: "The network model",
    body: "Nodes are triads / arpeggios / quartal + pentatonic fragments / dim7. Edges are the moves between them: enclosures, passing diminished, guide-tone steps, pentatonic connectors, chromatic slides. A raw triad pair is two nodes with no edge — that's why it sounds like an exercise. Inside vs outside is graph distance from the chord tones.",
  },
  {
    id: "skeleton", title: "The bebop skeleton",
    body: "Chord tones on strong beats, approach material on the upbeats. Guide-tone rails: b7 of the II falls to 3 of the V, b7 of the V falls to 3 of the I. Every device below decorates this rail. Short phrases first.",
  },
  {
    id: "loop", title: "The practice loop",
    body: "Every device runs the same loop: Hear (sing the target) → Isolate (one position, all inversions) → Connect (attach one edge) → Displace (start on the upbeat / mid-cell) → Apply (4 bars of a real tune, slow). End every phrase on a named resolution note.",
  },
  {
    id: "levels", title: "The 5 levels",
    body: "L1 chord tones · L2 diatonic pairs + pivots · L3 chromatic gravity (enclosures, passing dim) · L4 superimposition (melodic minor, quartal, pentatonic, dominant pivots) · L5 outside (alt pairs, planing, side-slip). Each level names its own gate — clear it before moving up.",
  },
  {
    id: "martino", title: "Martino Mode (the signature)", highlight: true,
    body: "Major II-V-I: play the ii minor (dorian) over BOTH the ii and the V — over the V it reads as a rootless G9. On the I, flip one note (F→F#) and D dorian becomes C lydian. For altered V, lift a half step into Ab melodic minor (Db+Eb, or Bbm/Abm), keep the shared B-F tritone as anchors, and slide the whole shape down a half step to resolve. The 3rd and 7th never move; only the color around them changes.",
  },
]

export default function TriadNetwork({
  chartBars, chartTitle, panelStyle, eyebrowStyle, selectStyle,
  onStopPlayback, playLineSection,
}) {
  const [tonic, setTonic] = useState("C")
  const [chordType, setChordType] = useState("maj7")
  const [progression, setProgression] = useState("major_251_martino")
  const [selectedDevices, setSelectedDevices] = useState(new Set(["Triad pairs", "Minor conversion (Martino)"]))
  const [level, setLevel] = useState(2)
  const [position, setPosition] = useState("5th position (frets 3-8)")
  const [extra, setExtra] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [playIdx, setPlayIdx] = useState(-1)
  const [openDoc, setOpenDoc] = useState("martino")
  const abortRef = useRef(null)

  const prog = PROGRESSIONS[progression]
  const isMartino = !!prog.martino
  const sectionChords = useMemo(
    () => prog.build(tonic, chordType),
    [progression, tonic, chordType] // eslint-disable-line react-hooks/exhaustive-deps
  )

  function toggleDevice(d) {
    setSelectedDevices((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d); else next.add(d)
      return next
    })
  }

  async function generate() {
    setLoading(true); setError(null); setResult(null); setPlayIdx(-1)
    try {
      const resp = await fetch("/api/generate-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: sectionChords,
          devices: routeDevices(selectedDevices, isMartino),
          position,
          level,
          extra: (isMartino ? "Use the Martino minor-conversion approach throughout. " : "") + extra,
          mode: isMartino ? "martino" : undefined,
          // Give the route real quality/beats context per bar where we can.
          chartBars: sectionChords.map((sym) => ({ symbol: sym, quality: guessQuality(sym), beats: 4 })),
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || `Server error ${resp.status}`)
      setResult(data.line)
    } catch (e) {
      setError(e.message || "Generation failed")
    } finally {
      setLoading(false)
    }
  }

  async function play() {
    if (!result || !playLineSection) return
    setPlaying(true)
    try {
      await playLineSection({
        line: result,
        startIndex: 0,
        endIndex: Math.max(0, result.bars.length - 1),
        practiceTempo: 96,
        muteLine: false,
        onLineNote: (bi) => setPlayIdx(bi),
        onDone: () => { setPlaying(false); setPlayIdx(-1) },
      })
    } catch {
      setPlaying(false)
    }
  }

  function stop() {
    onStopPlayback?.()
    setPlaying(false); setPlayIdx(-1)
  }

  const ct = CHORD_TYPES[chordType]

  // ─── styles derived from the passed-in panel tokens ─────────────────────────
  const chip = (on, color) => ({
    padding: "6px 12px", borderRadius: "999px", fontSize: "var(--db-fs-sm)",
    cursor: "pointer", userSelect: "none", border: `1px solid ${on ? (color || "var(--db-c-purple)") : "var(--db-panel-border)"}`,
    background: on ? (color ? `color-mix(in srgb, ${color} 16%, var(--db-bg))` : "color-mix(in srgb, var(--db-c-purple) 14%, var(--db-bg))") : "var(--db-panel-bg)",
    color: on ? "var(--db-text)" : "var(--db-muted)",
  })

  return (
    <div style={{ ...panelStyle, border: "1px solid color-mix(in srgb, var(--db-c-purple) 30%, transparent)", background: "color-mix(in srgb, var(--db-c-purple) 5%, var(--db-bg))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
        <div style={{ ...eyebrowStyle, marginBottom: 0, color: "var(--db-c-purple)" }}>TRIAD NETWORK · PRACTICE SYSTEM</div>
        <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.62 }}>pairs · cells · pivots · enclosures · rest-stroke triplets · Martino Mode</div>
      </div>

      {/* Tutorial accordion */}
      <div style={{ marginBottom: "16px" }}>
        {TUTORIAL.map((sec) => {
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
                  fontSize: "var(--db-fs-md)", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center",
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

      {/* Controls */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", marginBottom: "12px" }}>
        <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7 }}>Tonic
          <select value={tonic} onChange={(e) => setTonic(e.target.value)} style={{ ...selectStyle, width: "100%", marginTop: "4px" }}>
            {TONICS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7 }}>Chord type
          <select value={chordType} onChange={(e) => setChordType(e.target.value)} style={{ ...selectStyle, width: "100%", marginTop: "4px" }}>
            {Object.entries(CHORD_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7 }}>Progression
          <select value={progression} onChange={(e) => setProgression(e.target.value)} style={{ ...selectStyle, width: "100%", marginTop: "4px" }}>
            {Object.entries(PROGRESSIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7 }}>Position
          <select value={position} onChange={(e) => setPosition(e.target.value)} style={{ ...selectStyle, width: "100%", marginTop: "4px" }}>
            {["Anywhere", "Open position", "5th position (frets 3-8)", "7th position", "9th position", "12th position"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>

      {/* Chord readout + context */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginBottom: "12px", fontSize: "var(--db-fs-sm)" }}>
        <span style={{ opacity: 0.6 }}>Section:</span>
        {sectionChords.map((c, i) => (
          <span key={i} style={{
            fontFamily: "var(--db-font-mono, monospace)", padding: "3px 8px", borderRadius: "6px",
            background: playIdx === i ? "color-mix(in srgb, var(--db-c-green) 25%, var(--db-bg))" : "var(--db-card-bg)",
            border: `1px solid ${playIdx === i ? "var(--db-c-green)" : "var(--db-card-border)"}`,
          }}>{c}</span>
        ))}
        {isMartino && <span style={{ marginLeft: "6px", fontSize: "var(--db-fs-xs)", color: "var(--db-c-purple)" }}>· minor conversion, F→F# on the I, altered lift on the V</span>}
      </div>
      <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, marginBottom: "12px" }}>
        {ct.scale} · pairs {ct.pairs.join(", ")} · cells {ct.cells.join(", ")} · color {ct.color}
      </div>

      {/* Devices */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
        {DEVICES.map((d) => (
          <span key={d} onClick={() => toggleDevice(d)} style={chip(selectedDevices.has(d))}>{d}</span>
        ))}
      </div>

      {/* Levels */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "6px", flexWrap: "wrap" }}>
        {LEVELS.map((l) => {
          const on = level === l.id
          return (
            <button key={l.id} onClick={() => setLevel(l.id)} style={{
              padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontWeight: 700,
              fontFamily: "var(--db-font-mono, monospace)", fontSize: "var(--db-fs-sm)",
              border: `1px solid ${on ? l.color : "var(--db-panel-border)"}`,
              background: on ? `color-mix(in srgb, ${l.color} 22%, var(--db-bg))` : "var(--db-panel-bg)",
              color: on ? l.color : "var(--db-muted)",
            }}>{l.label}<span style={{ display: "block", fontSize: "0.7em", fontWeight: 400, fontFamily: "Arial" }}>{l.name}</span></button>
          )
        })}
      </div>
      <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, marginBottom: "12px" }}>{LEVELS[level - 1].rule}</div>

      {/* Direction */}
      <input
        value={extra} onChange={(e) => setExtra(e.target.value)}
        placeholder="Optional direction — e.g. 'phrase across the barline', 'start on the 5th string'"
        style={{
          width: "100%", padding: "10px 12px", borderRadius: "var(--db-r-md)",
          border: "1px solid color-mix(in srgb, var(--db-c-purple) 25%, transparent)", background: "var(--db-input-bg)",
          color: "var(--db-text)", fontSize: "var(--db-fs-sm)", marginBottom: "12px",
          fontFamily: "Arial, sans-serif",
        }}
      />

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
        <button onClick={generate} disabled={loading} style={{
          padding: "10px 24px", borderRadius: "var(--db-r-md)", border: "1px solid var(--db-c-purple)", cursor: loading ? "wait" : "pointer",
          background: "color-mix(in srgb, var(--db-c-purple) 16%, var(--db-bg))", color: "var(--db-c-purple)", fontWeight: 700, fontSize: "var(--db-fs-md)", opacity: loading ? 0.6 : 1,
        }}>{loading ? "Generating…" : "Generate Line"}</button>
        {result && (
          <>
            <button onClick={playing ? stop : play} disabled={!playLineSection} style={{
              padding: "10px 20px", borderRadius: "var(--db-r-md)", cursor: "pointer",
              border: "1px solid var(--db-panel-border)", background: "var(--db-panel-bg)", color: "var(--db-text)", fontSize: "var(--db-fs-sm)",
            }}>{playing ? "■ Stop" : "▶ Play with band"}</button>
          </>
        )}
      </div>

      {error && (
        <div style={{ padding: "10px 12px", borderRadius: "var(--db-r-md)", background: "color-mix(in srgb, var(--db-c-salmon) 12%, var(--db-bg))", border: "1px solid color-mix(in srgb, var(--db-c-salmon) 40%, transparent)", color: "var(--db-c-salmon)", fontSize: "var(--db-fs-sm)", marginBottom: "12px" }}>
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div>
          <pre style={{
            overflowX: "auto", padding: "12px", borderRadius: "var(--db-r-md)",
            background: "var(--db-input-bg)", border: "1px solid var(--db-card-border)",
            fontFamily: "var(--db-font-mono, monospace)", fontSize: "13px", lineHeight: 1.5, margin: 0,
          }}>{buildTab(result.bars)}</pre>
          {result.s && <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.75, marginTop: "8px", lineHeight: 1.5 }}>{result.s}</div>}
          <div style={{ marginTop: "10px", display: "grid", gap: "6px" }}>
            {result.bars.map((b, i) => (
              <div key={i} style={{
                display: "flex", gap: "10px", alignItems: "baseline", fontSize: "var(--db-fs-sm)",
                padding: "6px 8px", borderRadius: "6px",
                background: playIdx === i ? "color-mix(in srgb, var(--db-c-green) 14%, var(--db-bg))" : "transparent",
              }}>
                <span style={{ fontFamily: "var(--db-font-mono, monospace)", fontWeight: 700, minWidth: "72px" }}>{b.c}</span>
                <span style={{ opacity: 0.85 }}><strong>{b.d}</strong>{b.x ? ` — ${b.x}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!result && !loading && (
        <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.55, lineHeight: 1.6 }}>
          Pick a tonic, chord type, and progression, choose devices and a level, then Generate.
          The Martino preset plays the ii minor over the ii and V, flips F→F# on the I, and offers the altered lift on the dominant.
          Lines render as tab and play back through the rhythm section.
        </div>
      )}
    </div>
  )
}

// Rough quality inference for the route's scale/guide-tone helpers.
function guessQuality(sym) {
  const s = sym.toLowerCase()
  if (s.includes("m7b5") || s.includes("ø")) return "m7b5"
  if (s.includes("maj7") || s.includes("maj9")) return "maj7"
  if (s.includes("m(maj7)")) return "mMaj7"
  if (s.includes("dim") || s.includes("°")) return "dim7"
  if (s.includes("alt")) return "7alt"
  if (s.match(/m\d|m7|m9|min/)) return "m7"
  if (s.match(/7|9|13/)) return "7"
  return "maj7"
}
