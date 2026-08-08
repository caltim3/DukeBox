"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import LineNotation from "@/components/LineNotation"
import { lineNoteMidi, midiToToneNote } from "@/lib/music/lines"
import { LICK_KEYS, refingerLine, transposeLine } from "@/lib/music/licktionary"

const actionStyle = {
  padding: "6px 10px", borderRadius: "var(--db-r-md)", cursor: "pointer",
  border: "1px solid var(--db-panel-border)", background: "transparent",
  color: "var(--db-text)", fontSize: "var(--db-fs-xs)", fontWeight: 700,
}

function timedEvents(line) {
  const events = []
  let elapsed = 0
  let globalIndex = 0
  for (const bar of line?.bars || []) {
    let pos = 0
    for (const [s, f, dur, wait = 0] of bar.n || []) {
      pos += Number(wait) || 0
      events.push({ at: elapsed + pos, s, f, globalIndex: globalIndex++ })
      pos += Number(dur) || 0
    }
    elapsed += Math.max(Number(bar.beats) || 0, pos, 4)
  }
  return { events, totalBeats: elapsed }
}

function LickPanel({ lick, targetKey, neckPosition, tempo, onOpen }) {
  const timers = useRef([])
  const [playing, setPlaying] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [panelKey, setPanelKey] = useState(targetKey)
  const [panelNeck, setPanelNeck] = useState(neckPosition)

  useEffect(() => setPanelKey(targetKey), [targetKey])
  useEffect(() => setPanelNeck(neckPosition), [neckPosition])

  const line = useMemo(() => {
    if (!lick) return { bars: [] }
    const transposed = transposeLine(lick.line, lick.baseKey || "C", panelKey)
    return panelNeck == null ? transposed : refingerLine(transposed, panelNeck)
  }, [lick, panelKey, panelNeck])

  function stop() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setPlaying(false)
    setActiveIndex(-1)
  }

  async function play() {
    stop()
    const { events, totalBeats } = timedEvents(line)
    if (!events.length) return
    setPlaying(true)
    const beatMs = 60000 / tempo
    try {
      const audio = await import("@/lib/music/audio")
      events.forEach((event) => {
        timers.current.push(window.setTimeout(() => {
          setActiveIndex(event.globalIndex)
          Promise.resolve(audio.playLineNote(midiToToneNote(lineNoteMidi(event.s, event.f)))).catch(() => {})
        }, event.at * beatMs))
      })
      timers.current.push(window.setTimeout(stop, totalBeats * beatMs + 120))
    } catch { stop() }
  }

  useEffect(() => stop, [])

  if (!lick) return null

  const modeNotes = lick.guide?.notes?.[lick.mode] || []
  return (
    <div style={{
      minWidth: 0, border: "1px solid var(--db-panel-border)", borderRadius: "var(--db-r-md)",
      background: "var(--db-card-bg)", padding: "12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
        <span style={{
          fontSize: "var(--db-fs-xs)", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
          color: lick.mode === "minor" ? "var(--db-c-blue, var(--db-accent))" : "var(--db-c-salmon, var(--db-accent))",
        }}>{lick.mode === "minor" ? "Minor ii-V-i" : lick.mode === "major" ? "Major ii-V-I" : "Saved lick"}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button type="button" onClick={playing ? stop : play} style={{ ...actionStyle, color: "var(--db-c-green, var(--db-accent))", borderColor: "var(--db-c-green, var(--db-accent))" }}>
            {playing ? "■ Stop" : "▶ Play"}
          </button>
          <button type="button" onClick={() => onOpen(lick.id, panelKey, panelNeck)} style={{ ...actionStyle, color: "var(--db-accent)", borderColor: "var(--db-accent)" }}>
            Open in Line Lab
          </button>
        </div>
      </div>
      <div style={{
        display: "flex", alignItems: "end", gap: "14px", flexWrap: "wrap",
        marginBottom: "10px", padding: "9px 10px", borderRadius: "var(--db-r-md)",
        border: "1px solid var(--db-panel-border)", background: "var(--db-input-bg)",
      }}>
        <label style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-muted)", fontWeight: 700 }}>
          KEY
          <select
            value={panelKey}
            onChange={(e) => setPanelKey(e.target.value)}
            style={{ display: "block", width: "76px", marginTop: "4px", padding: "5px 7px", borderRadius: "var(--db-r-sm, 6px)", border: "1px solid var(--db-panel-border)", background: "var(--db-card-bg)", color: "var(--db-text)" }}
          >
            {LICK_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
          </select>
        </label>
        <div style={{ flex: "1 1 220px", minWidth: "190px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "var(--db-fs-xs)", color: "var(--db-muted)", fontWeight: 700 }}>
            <span>NECK POSITION: {panelNeck == null ? "Original" : `${panelNeck}–${panelNeck + 4}`}</span>
            {panelNeck != null && (
              <button type="button" onClick={() => setPanelNeck(null)} style={{ ...actionStyle, padding: "2px 6px", fontSize: "10px" }}>Original</button>
            )}
          </div>
          <input
            type="range" min="1" max="15" step="1" value={panelNeck ?? 5}
            onChange={(e) => setPanelNeck(Number(e.target.value))}
            aria-label={`${lick.name} preferred five-fret guitar neck position`}
            style={{ display: "block", width: "100%", marginTop: "7px" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1px", fontSize: "10px", color: "var(--db-muted)" }}>
            <span>1st fret</span><span>15th fret</span>
          </div>
        </div>
      </div>
      <LineNotation line={line} tempo={tempo} activeIndex={activeIndex} compact />
      {modeNotes.length > 0 && (
        <div style={{ marginTop: "10px", display: "grid", gap: "5px", fontSize: "var(--db-fs-sm)", lineHeight: 1.45 }}>
          {modeNotes.map((note, index) => (
            <div key={index} style={index === 1 ? {
              fontFamily: "var(--font-mono, monospace)", padding: "4px 7px", borderRadius: "var(--db-r-sm, 6px)",
              background: "color-mix(in srgb, var(--db-accent) 7%, transparent)",
            } : undefined}>{note}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function BeforeBeatOne({ steps = [] }) {
  if (!steps.length) return null
  return (
    <div style={{ margin: "10px 0 12px", padding: "10px 12px", borderLeft: "3px solid var(--db-accent)", background: "color-mix(in srgb, var(--db-accent) 5%, transparent)" }}>
      <div style={{ fontSize: "var(--db-fs-xs)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 800, color: "var(--db-accent)", marginBottom: "7px" }}>Before beat one</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "8px" }}>
        {steps.map((step, i) => {
          const split = step.indexOf(". ")
          const lead = split > 0 ? step.slice(0, split + 1) : step
          const rest = split > 0 ? step.slice(split + 2) : ""
          return (
            <div key={i} style={{ display: "flex", gap: "8px", fontSize: "var(--db-fs-sm)", lineHeight: 1.4 }}>
              <span style={{ flex: "0 0 25px", height: "25px", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--db-accent)", borderRadius: "50%", color: "var(--db-accent)", fontWeight: 800 }}>{i + 1}</span>
              <span><b>{lead}</b>{rest ? ` ${rest}` : ""}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Licktionary({ licks, selectedLickId, onOpenLick, selectStyle }) {
  const [targetKey, setTargetKey] = useState("C")
  const [neckPosition, setNeckPosition] = useState(null)
  const [tempo, setTempo] = useState(160)
  const [query, setQuery] = useState("")
  const builtIns = useMemo(() => licks.filter((lick) => lick.builtIn), [licks])
  const custom = useMemo(() => licks.filter((lick) => !lick.builtIn), [licks])
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const byNumber = new Map()
    for (const lick of builtIns) {
      const searchable = `${lick.name} ${lick.device} ${lick.cue} ${lick.guide?.credit || ""} ${lick.guide?.style || ""} ${lick.guide?.shape || ""} ${(lick.guide?.steps || []).join(" ")}`.toLowerCase()
      if (q && !searchable.includes(q)) continue
      const group = byNumber.get(lick.n) || { n: lick.n, name: lick.name, device: lick.device, cue: lick.cue, guide: lick.guide }
      group[lick.mode] = lick
      byNumber.set(lick.n, group)
    }
    return Array.from(byNumber.values()).sort((a, b) => a.n - b.n)
  }, [builtIns, query])

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "end", gap: "10px", flexWrap: "wrap",
        paddingBottom: "14px", marginBottom: "16px", borderBottom: "1px solid var(--db-panel-border)",
      }}>
        <div style={{ flex: "1 1 360px" }}>
          <div style={{ fontSize: "var(--db-fs-lg)", fontWeight: 800 }}>Twenty-Eight Ways In</div>
          <div style={{ fontSize: "var(--db-fs-sm)", color: "var(--db-muted)", marginTop: "3px" }}>
            The full bebop line playbook: plan the line, see standard notation + TAB, hear it in time, transpose it, then open it in Line Lab.
          </div>
        </div>
        <label style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-muted)" }}>Transpose all to
          <select value={targetKey} onChange={(e) => setTargetKey(e.target.value)} style={{ ...selectStyle, width: "90px", marginTop: "4px" }}>
            {LICK_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
          </select>
        </label>
        <div style={{ minWidth: "190px" }}>
          <div style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>{neckPosition == null ? "Neck: Original (Ways In)" : `Neck: frets ${neckPosition}–${neckPosition + 4}`}</span>
            {neckPosition != null && (
              <button type="button" onClick={() => setNeckPosition(null)} style={{ ...actionStyle, padding: "2px 6px", fontSize: "10px" }}>Original</button>
            )}
          </div>
          <input
            type="range" min="1" max="15" step="1" value={neckPosition ?? 5}
            onChange={(e) => setNeckPosition(Number(e.target.value))}
            aria-label="Preferred five-fret guitar neck position"
            style={{ display: "block", width: "190px", marginTop: "7px" }}
          />
        </div>
        <label style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-muted)" }}>Playback {tempo} bpm
          <input type="range" min="70" max="220" step="5" value={tempo} onChange={(e) => setTempo(Number(e.target.value))} style={{ display: "block", width: "130px", marginTop: "7px" }} />
        </label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find enclosure, pivot, Martino…"
          style={{
            width: "240px", padding: "9px 10px", borderRadius: "var(--db-r-md)",
            border: "1px solid var(--db-panel-border)", background: "var(--db-input-bg)", color: "var(--db-text)",
          }}
        />
      </div>

      <div style={{ display: "grid", gap: "22px" }}>
        {groups.map((group) => (
          <article key={group.n} style={{ borderTop: "3px solid var(--db-text)", paddingTop: "10px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "var(--db-fs-xs)", color: "var(--db-muted)" }}>No. {group.n}</span>
              <strong style={{ fontSize: "var(--db-fs-lg)" }}>{group.name}</strong>
              {group.guide?.credit && <span style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-muted)", fontStyle: "italic" }}>{group.guide.credit}</span>}
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono, monospace)", fontSize: "var(--db-fs-xs)", color: "var(--db-muted)" }}>{group.device}</span>
            </div>
            {group.guide?.style && <div style={{ marginTop: "4px", fontSize: "var(--db-fs-xs)", color: "var(--db-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{group.guide.style}</div>}
            {group.guide?.shape && (
              <div style={{ marginTop: "8px", padding: "7px 10px", borderRadius: "var(--db-r-md)", background: "var(--db-input-bg)", fontFamily: "var(--font-mono, monospace)", fontSize: "var(--db-fs-sm)", color: "var(--db-accent)" }}>
                {group.guide.shape}
              </div>
            )}
            <BeforeBeatOne steps={group.guide?.steps} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "10px" }}>
              <LickPanel lick={group.major} targetKey={targetKey} neckPosition={neckPosition} tempo={tempo} onOpen={onOpenLick} />
              <LickPanel lick={group.minor} targetKey={targetKey} neckPosition={neckPosition} tempo={tempo} onOpen={onOpenLick} />
            </div>
            <div style={{ marginTop: "9px", paddingLeft: "10px", borderLeft: "3px solid var(--db-c-gold, var(--db-accent))", fontSize: "var(--db-fs-sm)", fontStyle: "italic", color: "var(--db-muted)" }}>{group.cue}</div>
          </article>
        ))}
      </div>

      {custom.length > 0 && (
        <div style={{ marginTop: "24px", borderTop: "4px double var(--db-text)", paddingTop: "14px" }}>
          <div style={{ fontSize: "var(--db-fs-lg)", fontWeight: 800, marginBottom: "4px" }}>My Line Lab Licks</div>
          <div style={{ fontSize: "var(--db-fs-sm)", color: "var(--db-muted)", marginBottom: "10px" }}>Anything you save from Line Lab gets the same notation, TAB, transposition, timed playback, and MusicXML path as the built-in playbook.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "10px" }}>
            {custom.map((lick) => (
              <div key={lick.id} style={{ outline: lick.id === selectedLickId ? "2px solid var(--db-accent)" : "none", borderRadius: "var(--db-r-md)" }}>
                <div style={{ fontSize: "var(--db-fs-sm)", fontWeight: 800, marginBottom: "5px" }}>{lick.name}</div>
                <LickPanel lick={lick} targetKey={targetKey} neckPosition={neckPosition} tempo={tempo} onOpen={onOpenLick} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
