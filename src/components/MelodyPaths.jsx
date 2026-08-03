"use client"

import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { chordInfo } from "@/lib/music/tonal"
import SongSearch from "@/components/SongSearch"

const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const NOTES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

const DEFAULT_COLORS = {
  root: "#ef6f6c",
  third: "#f4b942",
  fifth: "#5fa8d3",
  seventh: "#9b6dd6",
  alter: "#d95d39",
  guide: "#2d7f5e",
  melody: "#d1498b",
}

const COLOR_LABELS = {
  root: "Chord root",
  third: "Chord third",
  fifth: "Chord fifth",
  seventh: "Chord seventh",
  alter: "Alteration marker",
  guide: "Guide-tone line",
  melody: "Melody selection",
}

function noteIndex(note) {
  const normalized = String(note || "").replace("♭", "b").replace("♯", "#").replace(/\d/g, "")
  const sharp = NOTES_SHARP.indexOf(normalized)
  return sharp >= 0 ? sharp : NOTES_FLAT.indexOf(normalized)
}

function displayNote(pc, tonic) {
  const preferFlats = /b/.test(tonic) || ["F", "Bb", "Eb", "Ab", "Db", "Gb"].includes(tonic)
  return (preferFlats ? NOTES_FLAT : NOTES_SHARP)[(pc + 12) % 12]
}

function scalePitchClasses(tonic, keyMode) {
  const root = Math.max(0, noteIndex(tonic))
  const intervals = keyMode === "minor" ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]
  return intervals.map((interval) => (root + interval) % 12)
}

function intervalName(rootPc, notePc) {
  const distance = (notePc - rootPc + 12) % 12
  return ["1", "b2", "2", "b3", "3", "4", "#4", "5", "b6", "6", "b7", "7"][distance]
}

function nearestScaleDegree(pc, scalePcs) {
  let best = { degree: 1, distance: Infinity }
  scalePcs.forEach((scalePc, index) => {
    const raw = Math.abs(pc - scalePc)
    const distance = Math.min(raw, 12 - raw)
    if (distance < best.distance) best = { degree: index + 1, distance }
  })
  return best
}

function analyzeChord(bar) {
  if (!bar || bar.quality === "NC") return null
  const info = chordInfo(bar.symbol)
  const tones = { root: noteIndex(bar.root), third: null, fifth: null, seventh: null }
  ;(info.intervals || []).forEach((interval, index) => {
    const pc = noteIndex(info.notes?.[index])
    if (interval === "3M" || interval === "3m" || interval === "2M" || interval === "4P") tones.third = pc
    if (interval === "5P" || interval === "5d" || interval === "5A") tones.fifth = pc
    if (interval === "7M" || interval === "7m" || interval === "6M") tones.seventh = pc
  })

  const alterations = []
  const suffix = String(bar.symbol || "").replace(/^([A-G](?:#|b)?)/, "").replace(/\/[A-G](?:#|b)?$/, "")
  const regex = /([b#])(5|9|11|13)/g
  let match
  while ((match = regex.exec(suffix)) !== null) {
    const base = { 5: 7, 9: 2, 11: 5, 13: 9 }[match[2]]
    const delta = match[1] === "b" ? -1 : 1
    alterations.push({ label: `${match[1]}${match[2]}`, pc: (tones.root + base + delta + 12) % 12 })
  }
  if (suffix.toLowerCase().includes("alt") && alterations.length === 0) {
    alterations.push({ label: "alt", pc: (tones.root + 1) % 12 })
  }
  return { symbol: bar.symbol, root: tones.root, tones, alterations }
}

function groupMeasures(bars) {
  const measures = []
  let current = []
  let beats = 0
  bars.forEach((bar, barIndex) => {
    const duration = Number(bar.beats) || 4
    if (duration >= 4) {
      if (current.length) measures.push(current)
      measures.push([{ bar, barIndex }])
      current = []
      beats = 0
      return
    }
    current.push({ bar, barIndex })
    beats += duration
    if (beats >= 4) {
      measures.push(current)
      current = []
      beats = 0
    }
  })
  if (current.length) measures.push(current)
  return measures
}

function computeGuide(columns, mode, scalePcs) {
  const choices = columns.map((column) => {
    if (!column.chord) return []
    return ["third", "seventh"].flatMap((role) => {
      const pc = column.chord.tones[role]
      if (pc == null || pc < 0) return []
      return [{ role, pc, ...nearestScaleDegree(pc, scalePcs) }]
    })
  })

  if (mode === "73") {
    return choices.map((candidates, index) => {
      const preferred = index % 2 === 0 ? "seventh" : "third"
      return candidates.find((candidate) => candidate.role === preferred) || candidates[0] || null
    })
  }

  const output = new Array(columns.length).fill(null)
  let previous = null
  choices.forEach((candidates, index) => {
    if (!candidates.length) return
    const selected = previous == null
      ? candidates[0]
      : [...candidates].sort((a, b) => {
          const aCost = Math.abs(a.degree - previous.degree) - (previous.role === "seventh" && a.role === "third" ? 0.35 : 0)
          const bCost = Math.abs(b.degree - previous.degree) - (previous.role === "seventh" && b.role === "third" ? 0.35 : 0)
          return aCost - bCost
        })[0]
    output[index] = selected
    previous = selected
  })
  return output
}

export default function MelodyPaths({
  bars,
  tonic,
  keyMode,
  title,
  formCategories,
  userLibrary,
  gigSongs,
  onPickSong,
  playheadIndex,
}) {
  const [guideMode, setGuideMode] = useState("73")
  const [melodyByMeasure, setMelodyByMeasure] = useState({})
  const [colors, setColors] = useState(DEFAULT_COLORS)
  const [linePoints, setLinePoints] = useState({ guide: "", melody: "" })
  const chartRef = useRef(null)
  const nodeRefs = useRef(new Map())

  const scalePcs = useMemo(() => scalePitchClasses(tonic, keyMode), [tonic, keyMode])
  const measures = useMemo(() => groupMeasures(bars), [bars])
  const columns = useMemo(() => measures.flatMap((measure, measureIndex) =>
    measure.map(({ bar, barIndex }) => ({ measureIndex, barIndex, chord: analyzeChord(bar) }))
  ), [measures])
  const guide = useMemo(() => computeGuide(columns, guideMode, scalePcs), [columns, guideMode, scalePcs])

  useLayoutEffect(() => {
    const chart = chartRef.current
    if (!chart) return undefined

    const draw = () => {
      const chartRect = chart.getBoundingClientRect()
      const point = (columnIndex, degree) => {
        const node = nodeRefs.current.get(`${columnIndex}:${degree}`)
        if (!node) return null
        const rect = node.getBoundingClientRect()
        return `${rect.left - chartRect.left + rect.width / 2},${rect.top - chartRect.top + rect.height / 2}`
      }
      const guidePoints = guide.map((item, index) => item ? point(index, item.degree) : null).filter(Boolean).join(" ")
      const melodyPoints = Object.values(melodyByMeasure)
        .sort((a, b) => a.measureIndex - b.measureIndex)
        .map((item) => point(item.columnIndex, item.degree))
        .filter(Boolean)
        .join(" ")
      setLinePoints({ guide: guidePoints, melody: melodyPoints })
    }

    const frame = requestAnimationFrame(draw)
    const observer = new ResizeObserver(draw)
    observer.observe(chart)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [columns, guide, melodyByMeasure])

  function chooseMelody(measureIndex, columnIndex, degree) {
    setMelodyByMeasure((previous) => {
      const selected = previous[measureIndex]
      if (selected?.columnIndex === columnIndex && selected?.degree === degree) {
        const next = { ...previous }
        delete next[measureIndex]
        return next
      }
      return { ...previous, [measureIndex]: { measureIndex, columnIndex, degree } }
    })
  }

  return (
    <div className="mp-root" style={{
      "--mp-root": colors.root,
      "--mp-third": colors.third,
      "--mp-fifth": colors.fifth,
      "--mp-seventh": colors.seventh,
      "--mp-alter": colors.alter,
      "--mp-guide": colors.guide,
      "--mp-melody": colors.melody,
    }}>
      <style>{`
        .mp-root * { box-sizing: border-box; }
        .mp-top { display:grid; grid-template-columns:minmax(240px, 1.5fr) minmax(190px, 1fr) auto; gap:12px; align-items:end; }
        .mp-label { display:block; margin-bottom:5px; color:var(--db-muted); font-size:var(--db-fs-xs); font-weight:800; letter-spacing:.06em; text-transform:uppercase; }
        .mp-mode { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .mp-button { padding:7px 12px; border:1px solid var(--db-card-border); border-radius:var(--db-r-md); background:var(--db-card-bg); color:var(--db-text); font-weight:700; cursor:pointer; }
        .mp-button.active { border-color:var(--db-accent); background:color-mix(in srgb, var(--db-accent) 16%, var(--db-bg)); color:var(--db-accent); }
        .mp-legend { display:flex; flex-wrap:wrap; gap:6px 12px; margin-top:14px; padding-top:12px; border-top:1px solid var(--db-card-border); }
        .mp-legend-item { display:flex; align-items:center; gap:6px; color:var(--db-muted); font-size:var(--db-fs-xs); }
        .mp-swatch { position:relative; width:19px; height:19px; overflow:hidden; border:1px solid color-mix(in srgb, var(--db-text) 28%, transparent); border-radius:5px; }
        .mp-swatch input { position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; }
        .mp-scroll { overflow:auto; margin-top:14px; border:1px solid var(--db-card-border); border-radius:var(--db-r-lg); background:var(--db-card-bg); }
        .mp-workspace { display:grid; grid-template-columns:72px 1fr; min-width:max-content; }
        .mp-pitches { position:sticky; left:0; z-index:5; padding:46px 7px 56px; background:var(--db-card-bg); border-right:1px solid var(--db-card-border); box-shadow:5px 0 12px color-mix(in srgb, var(--db-bg) 55%, transparent); }
        .mp-pitch-stack, .mp-degree-stack { display:grid; grid-template-rows:repeat(7, 58px); align-items:center; justify-items:center; }
        .mp-pitch { font-size:20px; font-weight:900; color:var(--db-text); }
        .mp-chart { position:relative; display:grid; align-items:stretch; min-height:508px; }
        .mp-column { position:relative; min-width:112px; padding:46px 10px 56px; border-right:1px dashed var(--db-card-border); }
        .mp-column.playing { background:color-mix(in srgb, var(--db-c-green) 16%, var(--db-bg)); box-shadow:inset 0 3px 0 var(--db-c-green), inset 0 -3px 0 var(--db-c-green); }
        .mp-column.playing .mp-chord { color:var(--db-c-green); }
        .mp-chord { position:absolute; top:12px; left:50%; transform:translateX(-50%); color:var(--db-text); font-size:var(--db-fs-md); font-weight:800; white-space:nowrap; }
        .mp-degree { position:relative; z-index:2; display:grid; place-items:center; width:44px; height:44px; border:2px solid var(--db-text); border-radius:50%; background:var(--db-bg); color:var(--db-text); font-size:var(--db-fs-sm); font-weight:900; cursor:pointer; transition:transform .12s ease; }
        .mp-degree:hover { transform:scale(1.08); }
        .mp-degree.root { background:var(--mp-root); }
        .mp-degree.third { background:var(--mp-third); }
        .mp-degree.fifth { background:var(--mp-fifth); }
        .mp-degree.seventh { background:var(--mp-seventh); color:white; }
        .mp-degree.melody { box-shadow:0 0 0 5px color-mix(in srgb, var(--mp-melody) 30%, transparent), inset 0 0 0 3px var(--mp-melody); }
        .mp-alter { position:absolute; left:-44px; top:6px; display:grid; place-items:center; width:37px; height:28px; border-radius:7px; background:var(--mp-alter); color:white; font-size:10px; font-weight:900; }
        .mp-alter::after { content:""; position:absolute; right:-7px; top:10px; border-left:7px solid var(--mp-alter); border-top:4px solid transparent; border-bottom:4px solid transparent; }
        .mp-lines { position:absolute; inset:0; z-index:1; width:100%; height:100%; overflow:visible; pointer-events:none; }
        .mp-guide-line { fill:none; stroke:var(--mp-guide); stroke-width:4; stroke-linecap:round; stroke-linejoin:round; }
        .mp-melody-line { fill:none; stroke:var(--mp-melody); stroke-width:4; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:9 7; }
        .mp-bracket { position:absolute; bottom:30px; height:17px; border-left:2px solid var(--db-muted); border-right:2px solid var(--db-muted); border-bottom:2px solid var(--db-muted); border-radius:0 0 6px 6px; }
        .mp-bracket span { position:absolute; top:19px; width:100%; color:var(--db-muted); font-size:10px; text-align:center; white-space:nowrap; }
        @media (max-width:760px) { .mp-top { grid-template-columns:1fr; } .mp-clear { justify-self:start; } }
      `}</style>

      <div className="mp-top">
        <div>
          <span className="mp-label">Live song</span>
          <div style={{ fontSize: "var(--db-fs-lg)", fontWeight: 850, marginBottom: "6px", color: "var(--db-accent)" }}>{title}</div>
          <SongSearch
            formCategories={formCategories}
            userLibrary={userLibrary}
            gigSongs={gigSongs}
            selectedForm={title}
            onPick={onPickSong}
            placeholder="Choose a different live song…"
          />
        </div>
        <div>
          <span className="mp-label">Guide-tone path</span>
          <div className="mp-mode">
            <button className={`mp-button ${guideMode === "73" ? "active" : ""}`} onClick={() => setGuideMode("73")}>7 → 3</button>
            <button className={`mp-button ${guideMode === "smooth" ? "active" : ""}`} onClick={() => setGuideMode("smooth")}>Smooth</button>
          </div>
          <div style={{ marginTop: "6px", color: "var(--db-muted)", fontSize: "var(--db-fs-xs)" }}>
            Key center: {tonic} {keyMode === "minor" ? "minor" : "major"}
          </div>
        </div>
        <button className="mp-button mp-clear" onClick={() => setMelodyByMeasure({})}>Clear melody</button>
      </div>

      <div className="mp-legend">
        {Object.entries(COLOR_LABELS).map(([key, label]) => (
          <label className="mp-legend-item" key={key} title={`Change ${label.toLowerCase()} color`}>
            <span className="mp-swatch" style={{ background: colors[key] }}>
              <input type="color" value={colors[key]} onChange={(event) => setColors((previous) => ({ ...previous, [key]: event.target.value }))} />
            </span>
            {label}
          </label>
        ))}
      </div>

      <div style={{ marginTop: "10px", color: "var(--db-muted)", fontSize: "var(--db-fs-sm)" }}>
        The solid line is the generated guide-tone path. Click one circle per measure to draw your melody skeleton.
      </div>

      <div className="mp-scroll">
        <div className="mp-workspace">
          <div className="mp-pitches">
            <div className="mp-pitch-stack">
              {[...scalePcs].reverse().map((pc) => <div className="mp-pitch" key={pc}>{displayNote(pc, tonic)}</div>)}
            </div>
          </div>
          <div ref={chartRef} className="mp-chart" style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, 112px)` }}>
            {columns.length === 0 && <div style={{ padding: "80px 30px", color: "var(--db-muted)" }}>Load a song with chord changes to build its melody path.</div>}
            {columns.map((column, columnIndex) => (
              <div className={`mp-column ${playheadIndex === column.barIndex ? "playing" : ""}`} key={`${column.barIndex}:${column.chord?.symbol || "NC"}`}>
                <div className="mp-chord">{column.chord?.symbol || "N.C."}</div>
                <div className="mp-degree-stack">
                  {[7, 6, 5, 4, 3, 2, 1].map((degree) => {
                    const pc = scalePcs[degree - 1]
                    const tones = column.chord?.tones
                    let role = ""
                    if (pc === tones?.root) role = "root"
                    else if (pc === tones?.third) role = "third"
                    else if (pc === tones?.fifth) role = "fifth"
                    else if (pc === tones?.seventh) role = "seventh"
                    const selected = melodyByMeasure[column.measureIndex]
                    const isSelected = selected?.columnIndex === columnIndex && selected?.degree === degree
                    const alteration = column.chord?.alterations.find((item) => nearestScaleDegree(item.pc, scalePcs).degree === degree)
                    return (
                      <button
                        type="button"
                        key={degree}
                        ref={(node) => {
                          const refKey = `${columnIndex}:${degree}`
                          if (node) nodeRefs.current.set(refKey, node)
                          else nodeRefs.current.delete(refKey)
                        }}
                        className={`mp-degree ${role} ${isSelected ? "melody" : ""}`}
                        onClick={() => chooseMelody(column.measureIndex, columnIndex, degree)}
                        aria-label={`${displayNote(pc, tonic)}, ${column.chord ? intervalName(column.chord.root, pc) : "no chord"}, measure ${column.measureIndex + 1}`}
                      >
                        {column.chord ? intervalName(column.chord.root, pc) : "·"}
                        {alteration && <span className="mp-alter">{alteration.label}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {columns.length > 0 && (
              <svg className="mp-lines" aria-hidden="true">
                <polyline className="mp-guide-line" points={linePoints.guide} />
                <polyline className="mp-melody-line" points={linePoints.melody} />
              </svg>
            )}

            {measures.map((measure, measureIndex) => {
              const firstColumn = columns.findIndex((column) => column.measureIndex === measureIndex)
              return (
                <div
                  className="mp-bracket"
                  key={measureIndex}
                  style={{ left: `${firstColumn * 112}px`, width: `${measure.length * 112}px` }}
                >
                  <span>measure {measureIndex + 1}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
