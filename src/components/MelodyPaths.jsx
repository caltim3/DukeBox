"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { chordInfo } from "@/lib/music/tonal"
import SongSearch from "@/components/SongSearch"

const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const NOTES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

// Melody Paths is always dark navy — these read the constant --mp-* tokens
// (globals.css :root), never the active palette, so the panel looks identical
// no matter which of the six palettes is selected (spec §4.8).
const DEFAULT_COLOR_TOKENS = {
  root: "--mp-root",
  third: "--mp-third",
  fifth: "--mp-fifth",
  seventh: "--mp-seventh",
  alter: "--mp-alt",
  guide: "--mp-line-color",
  melody: "--mp-melody",
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

// Signed semitones from `from` up to `to`, by the shortest way round (-6..+5).
function signedTo(from, to) {
  return ((to - from + 6 + 12) % 12) - 6
}

// 3rd Hunter. The guide tone is the 3rd of THIS chord — that is the note that
// lights up, one per bar, and the line drawn through them is the 3rds moving
// through the changes.
//
// On top of that each bar carries a lead-in: the note over THIS chord that
// walks into the NEXT bar's 3rd, which is what the arrow marks. A half step
// from either side is the classic approach; a whole step is only accepted
// from above, falling into the target. (An earlier version lit the approach
// note itself and never showed the chord's own 3rd, which is why the mode
// looked wrong.)
function computeHunter3(columns, scalePcs) {
  return columns.map((column, index) => {
    const chord = column.chord
    const ownThird = chord?.tones?.third
    if (ownThird == null) return null

    const targetPc = columns[(index + 1) % columns.length]?.chord?.tones?.third

    let lead = null
    if (targetPc != null) {
      const candidates = []
      // 7th first so the classic 7→3 resolution wins an otherwise equal tie.
      for (const role of ["seventh", "third", "root", "fifth"]) {
        const pc = chord.tones[role]
        if (pc == null) continue
        const delta = signedTo(pc, targetPc)
        // +1 rises a half step into the target, -1 falls a half step onto it,
        // -2 falls a whole step. A whole step from below is too far to read
        // as a resolution, so it isn't offered.
        if (delta === 1 || delta === -1 || delta === -2) candidates.push({ role, pc, delta })
      }
      candidates.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))
      lead = candidates[0] || null
    }

    return {
      role: "third",
      pc: ownThird,
      targetPc,
      lead,
      ...nearestScaleDegree(ownThird, scalePcs),
    }
  })
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
  guideMode,
  onGuideModeChange,
  onPathChange,
  showEnclosure = false,
  onShowEnclosureChange,
}) {
  const [melodyByMeasure, setMelodyByMeasure] = useState({})
  const [colors, setColors] = useState(null)
  const [linePoints, setLinePoints] = useState({ guide: "", melody: "" })
  const chartRef = useRef(null)
  const nodeRefs = useRef(new Map())

  useEffect(() => {
    const root = document.documentElement
    const readThemeColors = () => {
      const styles = getComputedStyle(root)
      setColors(Object.fromEntries(Object.entries(DEFAULT_COLOR_TOKENS).map(
        ([key, token]) => [key, styles.getPropertyValue(token).trim()]
      )))
    }
    readThemeColors()
    const observer = new MutationObserver(readThemeColors)
    observer.observe(root, { attributes: true, attributeFilter: ["data-palette", "data-mode"] })
    return () => observer.disconnect()
  }, [])

  const scalePcs = useMemo(() => scalePitchClasses(tonic, keyMode), [tonic, keyMode])
  const measures = useMemo(() => groupMeasures(bars), [bars])
  const columns = useMemo(() => measures.flatMap((measure, measureIndex) =>
    measure.map(({ bar, barIndex }) => ({ measureIndex, barIndex, chord: analyzeChord(bar) }))
  ), [measures])

  // Candidate notes before we know which pitches need an extra row. The
  // .degree/.distance on each item here is only a rough heuristic scalePcs
  // distance (computeGuide's "smooth" mode uses it to judge how close two
  // consecutive picks are) — NOT the final row placement. Rendering degree
  // is resolved below, once every out-of-key pitch has a real row.
  const rawGuide = useMemo(() => {
    if (guideMode === "melody") return new Array(columns.length).fill(null)
    if (guideMode === "hunter3") return computeHunter3(columns, scalePcs)
    return computeGuide(columns, guideMode, scalePcs)
  }, [columns, guideMode, scalePcs])

  // Peña enclosure pitches per column — the chromatic cage (half step below
  // and above) around each 3rd Hunter target. Only computed when the toggle
  // is on, in hunter3 mode; empty arrays otherwise.
  const enclosurePcsByColumn = useMemo(() => {
    if (!showEnclosure || guideMode !== "hunter3") return rawGuide.map(() => [])
    return rawGuide.map((item) => {
      const t = item?.targetPc
      return t == null ? [] : [(t + 11) % 12, (t + 1) % 12]
    })
  }, [rawGuide, guideMode, showEnclosure])

  // A guide mode can want a pitch that isn't one of the key's 7 diatonic
  // notes (a dominant's b7 that doesn't belong to the key, say). Snapping it
  // onto the nearest existing row used to misrepresent it by up to a whole
  // step. Instead, give every such pitch its own row, appended above the 7
  // diatonic ones so existing rows never move.
  const extraPcs = useMemo(() => {
    if (guideMode === "melody") return []
    const found = new Set()
    rawGuide.forEach((item) => {
      if (!item) return
      if (!scalePcs.includes(item.pc)) found.add(item.pc)
      if (item.lead && !scalePcs.includes(item.lead.pc)) found.add(item.lead.pc)
    })
    enclosurePcsByColumn.forEach((pcs) => pcs.forEach((pc) => { if (!scalePcs.includes(pc)) found.add(pc) }))
    return Array.from(found).sort((a, b) => a - b)
  }, [rawGuide, guideMode, scalePcs, enclosurePcsByColumn])

  const allPcs = useMemo(() => [...scalePcs, ...extraPcs], [scalePcs, extraPcs])
  // Row render order, top to bottom: extras first (highest extra on top),
  // then the original 7 diatonic rows in their usual 7→1 order.
  const rowOrder = useMemo(() => {
    const extraDegrees = extraPcs.map((_, i) => scalePcs.length + i + 1).reverse()
    return [...extraDegrees, 7, 6, 5, 4, 3, 2, 1]
  }, [extraPcs, scalePcs.length])

  // Final guide with each note's degree resolved against allPcs — exact now,
  // not the nearest-diatonic approximation rawGuide's degree carried.
  const guide = useMemo(() => {
    if (guideMode === "melody") return rawGuide
    const degreeFor = (pc) => allPcs.indexOf(pc) + 1
    return rawGuide.map((item) => {
      if (!item) return null
      const next = { ...item, degree: degreeFor(item.pc) }
      if (item.lead) next.lead = { ...item.lead, degree: degreeFor(item.lead.pc) }
      return next
    })
  }, [rawGuide, guideMode, allPcs])

  // notesByBar holds the lit guide tones per bar. Both the 3rd and the 7th, at
  // equal weight: they are the pair that spells the chord and the pair that
  // voice-leads (7→3 one way, 3→7 the other), so emphasising one over the other
  // hid half of every resolution. The path modes still choose their own single
  // note for the chart line above — this is only what the fretboard lights, in
  // the current bar and, through the same map, in the ghosted next bar.
  //
  // targetsByBar and the lead-in maps are only filled by 3rd Hunter: the
  // target is the NEXT bar's 3rd, and the lead-in is the note in THIS bar that
  // walks into it, with the signed semitones it travels — that pair is what
  // the fretboard turns into an arrow. Untouched here, so the drill still works.
  const activePath = useMemo(() => {
    const notesByBar = {}
    const targetsByBar = {}
    const leadInByBar = {}
    const leadDeltaByBar = {}
    if (guideMode === "melody") {
      Object.values(melodyByMeasure).forEach((selection) => {
        const column = columns[selection.columnIndex]
        const pc = scalePcs[selection.degree - 1]
        if (column && pc != null) notesByBar[column.barIndex] = [displayNote(pc, tonic)]
      })
    } else {
      guide.forEach((item, columnIndex) => {
        const column = columns[columnIndex]
        if (!item || !column) return
        // Light the 3rd and the 7th together. Falls back to whatever the mode
        // picked when a chord has no usable third/seventh (sus, NC, power).
        const tones = column.chord?.tones
        const pair = [tones?.third, tones?.seventh].filter((pc) => pc != null)
        notesByBar[column.barIndex] = (pair.length ? pair : [item.pc])
          .map((pc) => displayNote(pc, tonic))
        if (item.targetPc != null) targetsByBar[column.barIndex] = displayNote(item.targetPc, tonic)
        if (item.lead) {
          leadInByBar[column.barIndex] = displayNote(item.lead.pc, tonic)
          leadDeltaByBar[column.barIndex] = item.lead.delta
        }
      })
    }
    return { mode: guideMode, notesByBar, targetsByBar, leadInByBar, leadDeltaByBar }
  }, [columns, guide, guideMode, melodyByMeasure, scalePcs, tonic])

  useEffect(() => {
    onPathChange?.(activePath)
  }, [activePath, onPathChange])

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
      const guidePoints = guide
        .map((item, index) => (item ? point(index, item.degree) : null))
        .filter(Boolean).join(" ")
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
    onGuideModeChange?.("melody")
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
      "--mp-root": colors?.root || "var(--mp-root)",
      "--mp-third": colors?.third || "var(--mp-third)",
      "--mp-fifth": colors?.fifth || "var(--mp-fifth)",
      "--mp-seventh": colors?.seventh || "var(--mp-seventh)",
      "--mp-alter": colors?.alter || "var(--mp-alt)",
      "--mp-guide": colors?.guide || "var(--mp-line-color)",
      "--mp-melody": colors?.melody || "var(--mp-melody)",
      background: "var(--mp-bg)", color: "var(--mp-text)",
      border: "1px solid var(--mp-line)", borderRadius: "var(--db-r-md)", padding: "14px 16px",
    }}>
      <style>{`
        .mp-root * { box-sizing: border-box; }
        .mp-top { display:grid; grid-template-columns:minmax(240px, 1.5fr) minmax(190px, 1fr) auto; gap:12px; align-items:end; }
        .mp-label { display:block; margin-bottom:5px; color:var(--mp-muted); font-size:var(--db-fs-xs); font-weight:800; letter-spacing:.06em; text-transform:uppercase; }
        .mp-mode { display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; }
        .mp-button { padding:7px 12px; border:1px solid var(--mp-line); border-radius:var(--db-r-md); background:var(--mp-surface); color:var(--mp-text); font-weight:700; cursor:pointer; }
        .mp-button.active { border-color:var(--mp-melody); background:color-mix(in srgb, var(--mp-melody) 20%, var(--mp-surface)); color:var(--mp-hdr-accent); }
        .mp-legend { display:flex; flex-wrap:wrap; gap:6px; margin-top:14px; padding-top:12px; border-top:1px solid var(--mp-line); }
        .mp-legend-item { display:inline-flex; align-items:center; gap:5px; background:var(--mp-surface); border:1px solid var(--mp-line); border-radius:20px; padding:3px 8px 3px 4px; color:var(--mp-muted); font-size:11px; }
        .mp-swatch { position:relative; width:14px; height:14px; overflow:hidden; border-radius:50%; }
        .mp-swatch input { position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; }
        .mp-scroll { overflow:auto; margin-top:12px; border:1px solid var(--mp-line); border-radius:10px; background:var(--mp-bg); }
        .mp-workspace { display:grid; grid-template-columns:38px 1fr; min-width:max-content; }
        .mp-pitches { position:sticky; left:0; z-index:5; padding:38px 4px 30px; background:var(--mp-bg); border-right:1px solid var(--mp-line); }
        .mp-pitch-stack, .mp-degree-stack { display:grid; grid-template-rows:repeat(7, 46px); align-items:center; justify-items:center; }
        .mp-pitch { font-size:12px; font-weight:800; color:var(--mp-hdr-accent); font-family:'IBM Plex Mono', monospace; }
        .mp-chart { position:relative; display:grid; align-items:stretch; min-height:392px; }
        .mp-column { position:relative; min-width:94px; padding:38px 8px 30px; border-right:1px dashed var(--mp-line); }
        .mp-column.playing { background:color-mix(in srgb, var(--mp-melody) 14%, var(--mp-bg)); box-shadow:inset 0 3px 0 var(--mp-melody), inset 0 -3px 0 var(--mp-melody); }
        .mp-column.playing .mp-chord { color:var(--mp-melody); }
        .mp-chord { position:absolute; top:8px; left:50%; transform:translateX(-50%); color:var(--mp-hdr-accent); font-size:12px; font-weight:800; white-space:nowrap; font-family:'IBM Plex Mono', monospace; }
        .mp-degree { position:relative; z-index:2; display:grid; place-items:center; width:38px; height:38px; max-width:38px; border:2px solid var(--mp-cell-border); border-radius:50%; background:var(--mp-cell); color:var(--mp-muted); font-size:11px; font-weight:700; cursor:pointer; transition:transform .12s ease; font-family:'IBM Plex Mono', monospace; }
        .mp-degree:hover { transform:scale(1.08); }
        .mp-degree.root { background:var(--mp-root); border-color:#EA580C; color:#1F1204; }
        .mp-degree.third { background:var(--mp-third); border-color:#3B82F6; color:#0B1930; }
        .mp-degree.fifth { background:var(--mp-fifth); border-color:#64748B; color:#0F172A; }
        .mp-degree.seventh { background:var(--mp-seventh); border-color:#FBBF24; color:#2A1A02; }
        .mp-degree.melody { box-shadow:0 0 0 4px color-mix(in srgb, var(--mp-melody) 40%, transparent), inset 0 0 0 2px var(--mp-melody); }
        /* The note a computed guide mode (7→3 / Smooth / 3rd Hunter) actually
           picked — a ring independent of the root/3rd/5th/7th role fill, so
           it's visible whether or not the pick happens to land on one of
           those roles. */
        .mp-degree.guide-hit { box-shadow:0 0 0 3px color-mix(in srgb, var(--mp-guide) 65%, transparent), inset 0 0 0 2px var(--mp-guide); }
        .mp-degree.guide-hit.melody { box-shadow:0 0 0 4px color-mix(in srgb, var(--mp-melody) 40%, transparent), inset 0 0 0 2px var(--mp-guide); }
        /* A row added for a pitch outside the key (see extraPcs) — dashed so
           it visually reads as "not one of the normal 7", even with no fill. */
        .mp-degree.extra { border-style:dashed; }
        /* Peña enclosure pitches — the chromatic cage around this column's
           3rd Hunter target, marked with a dashed alteration-colored outline. */
        .mp-degree.enc-hit { outline:2px dashed var(--mp-alter); outline-offset:2px; }
        /* 3rd Hunter lead-in — the note that walks into the next bar's 3rd. */
        .mp-degree.lead-hit { outline:2px dashed var(--mp-melody); outline-offset:2px; }
        .mp-lead {
          position:absolute; right:-13px; top:50%; transform:translateY(-50%);
          font-size:14px; font-weight:900; line-height:1; color:var(--mp-melody);
          text-shadow:0 0 3px var(--mp-bg);
        }
        .mp-pitch { transition: color .12s ease; }
        .mp-alter { position:absolute; left:-34px; top:2px; display:grid; place-items:center; width:30px; height:22px; border-radius:6px; background:var(--mp-alter); color:#1F0708; font-size:9px; font-weight:900; }
        .mp-alter::after { content:""; position:absolute; right:-6px; top:8px; border-left:6px solid var(--mp-alter); border-top:3px solid transparent; border-bottom:3px solid transparent; }
        .mp-lines { position:absolute; inset:0; z-index:1; width:100%; height:100%; overflow:visible; pointer-events:none; }
        .mp-guide-line { fill:none; stroke:var(--mp-guide); stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
        .mp-melody-line { fill:none; stroke:var(--mp-melody); stroke-width:2; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:9 7; }
        .mp-bracket { position:absolute; bottom:14px; height:14px; border-left:2px solid var(--mp-line); border-right:2px solid var(--mp-line); border-bottom:2px solid var(--mp-line); border-radius:0 0 6px 6px; }
        .mp-bracket span { position:absolute; top:16px; width:100%; color:var(--mp-muted); font-size:10px; text-align:center; white-space:nowrap; font-family:'IBM Plex Mono', monospace; }
        @media (max-width:760px) { .mp-top { grid-template-columns:1fr; } .mp-clear { justify-self:start; } .mp-mode { grid-template-columns:repeat(2, 1fr); } }
      `}</style>

      <div className="mp-top">
        <div>
          <span className="mp-label">Live song</span>
          <div style={{ fontSize: "var(--db-fs-lg)", fontWeight: 850, marginBottom: "6px", color: "var(--mp-hdr-accent)" }}>{title}</div>
          {/* SongSearch reads the app's --db-* custom properties for its own styling;
              scoping them to the navy melody-paths tokens here keeps the search box
              from flashing palette-colored inside an always-navy panel. */}
          <div style={{
            "--db-input-bg": "var(--mp-surface)", "--db-panel-bg": "var(--mp-surface)",
            "--db-panel-border": "var(--mp-line)", "--db-text": "var(--mp-text)",
            "--db-accent": "var(--mp-melody)", "--shadow": "rgba(0,0,0,.45)",
          }}>
            <SongSearch
              formCategories={formCategories}
              userLibrary={userLibrary}
              gigSongs={gigSongs}
              selectedForm={title}
              onPick={onPickSong}
              placeholder="Choose a different live song…"
            />
          </div>
        </div>
        <div>
          <span className="mp-label">Guide-tone path</span>
          <div className="mp-mode">
            <button className={`mp-button ${guideMode === "73" ? "active" : ""}`} onClick={() => onGuideModeChange?.("73")}>7 → 3</button>
            <button className={`mp-button ${guideMode === "smooth" ? "active" : ""}`} onClick={() => onGuideModeChange?.("smooth")}>Smooth</button>
            <button className={`mp-button ${guideMode === "melody" ? "active" : ""}`} onClick={() => onGuideModeChange?.("melody")}>Melody</button>
            <button className={`mp-button ${guideMode === "hunter3" ? "active" : ""}`} onClick={() => onGuideModeChange?.("hunter3")} title="Lights the 3rd and 7th of each chord, and marks the note that leads into the next chord's 3rd">3rd Hunter</button>
          </div>
          <div style={{ marginTop: "6px", color: "var(--mp-muted)", fontSize: "var(--db-fs-xs)", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span>Key center: {tonic} {keyMode === "minor" ? "minor" : "major"}</span>
            {guideMode === "hunter3" && (
              <label style={{ display: "inline-flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={showEnclosure}
                  onChange={(event) => onShowEnclosureChange?.(event.target.checked)}
                />
                Show enclosures
              </label>
            )}
          </div>
        </div>
        <button className="mp-button mp-clear" onClick={() => setMelodyByMeasure({})}>Clear melody</button>
      </div>

      <div className="mp-legend">
        {Object.entries(COLOR_LABELS).map(([key, label]) => (
          <label className="mp-legend-item" key={key} title={`Change ${label.toLowerCase()} color`}>
            <span className="mp-swatch" style={{ background: colors?.[key] || `var(${DEFAULT_COLOR_TOKENS[key]})` }}>
              {colors && <input type="color" value={colors[key]} onChange={(event) => setColors((previous) => ({ ...previous, [key]: event.target.value }))} />}
            </span>
            {label}
          </label>
        ))}
      </div>

      <div style={{ marginTop: "10px", color: "var(--mp-muted)", fontSize: "var(--db-fs-sm)" }}>
        The fretboard follows the selected path. Click one circle per measure to draw and select your Melody path.
      </div>

      <div className="mp-scroll">
        <div className="mp-workspace">
          <div className="mp-pitches">
            <div className="mp-pitch-stack" style={{ gridTemplateRows: `repeat(${rowOrder.length}, 46px)` }}>
              {rowOrder.map((degree) => {
                const pc = allPcs[degree - 1]
                const isExtra = degree > scalePcs.length
                return (
                  <div className="mp-pitch" key={degree} style={isExtra ? { color: "var(--mp-alter)" } : undefined} title={isExtra ? "Not in the key — added for this guide-tone path" : undefined}>
                    {displayNote(pc, tonic)}
                  </div>
                )
              })}
            </div>
          </div>
          <div ref={chartRef} className="mp-chart" style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, 94px)` }}>
            {columns.length === 0 && <div style={{ padding: "80px 30px", color: "var(--mp-muted)" }}>Load a song with chord changes to build its melody path.</div>}
            {columns.map((column, columnIndex) => {
              const guideItem = guide[columnIndex]
              const guideHitPcs = guideItem ? [guideItem.pc] : []
              const leadPc = guideItem?.lead?.pc
              const leadDelta = guideItem?.lead?.delta
              const encPcs = enclosurePcsByColumn[columnIndex] || []
              return (
              <div className={`mp-column ${playheadIndex === column.barIndex ? "playing" : ""}`} key={`${column.barIndex}:${column.chord?.symbol || "NC"}`}>
                <div className="mp-chord">{column.chord?.symbol || "N.C."}</div>
                <div className="mp-degree-stack" style={{ gridTemplateRows: `repeat(${rowOrder.length}, 46px)` }}>
                  {rowOrder.map((degree) => {
                    const pc = allPcs[degree - 1]
                    const isExtra = degree > scalePcs.length
                    const tones = column.chord?.tones
                    let role = ""
                    if (pc === tones?.root) role = "root"
                    else if (pc === tones?.third) role = "third"
                    else if (pc === tones?.fifth) role = "fifth"
                    else if (pc === tones?.seventh) role = "seventh"
                    const selected = melodyByMeasure[column.measureIndex]
                    const isSelected = selected?.columnIndex === columnIndex && selected?.degree === degree
                    // The note this guide mode actually picked for this column —
                    // a ring that's independent of the root/3rd/5th/7th role fill,
                    // so it stays visible even when it lands on a role that isn't
                    // colorful.
                    const isGuideHit = guideHitPcs.includes(pc)
                    // 3rd Hunter's lead-in: the note here that walks into the
                    // NEXT bar's 3rd. Arrow points the way it moves.
                    const isLead = !isGuideHit && pc === leadPc
                    const isEncHit = !isGuideHit && !isLead && encPcs.includes(pc)
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
                        className={`mp-degree ${role} ${isSelected ? "melody" : ""} ${isGuideHit ? "guide-hit" : ""} ${isLead ? "lead-hit" : ""} ${isEncHit ? "enc-hit" : ""} ${isExtra ? "extra" : ""}`}
                        onClick={() => chooseMelody(column.measureIndex, columnIndex, degree)}
                        aria-label={`${displayNote(pc, tonic)}, ${column.chord ? intervalName(column.chord.root, pc) : "no chord"}, measure ${column.measureIndex + 1}${isExtra ? " (not in the key)" : ""}${isGuideHit ? " — guide tone, the 3rd" : ""}${isLead ? " — leads into the next 3rd" : ""}`}
                      >
                        {column.chord ? intervalName(column.chord.root, pc) : "·"}
                        {alteration && <span className="mp-alter">{alteration.label}</span>}
                        {isLead && (
                          <span className="mp-lead" aria-hidden="true">{leadDelta > 0 ? "↑" : "↓"}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
              )
            })}

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
                  style={{ left: `${firstColumn * 94}px`, width: `${measure.length * 94}px` }}
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
