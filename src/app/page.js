"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import NotationLane from "@/components/NotationLane"
import {
  ROOTS,
  QUALITIES,
  buildChordSymbol,
  chordInfo,
  scaleNotes,
  analyzeGuideToneMotion,
  melodicTargets,
  generateApproachLines,
  assignRhythmToBars,
  getRecommendedScalesFromQuality,
  transposeChart,
  applyScaleFilter,
} from "@/lib/music/tonal"
import { analyzeProgressionContext } from "@/lib/music/harmony"
import { FORMS, FORM_CATEGORIES } from "@/lib/music/forms"
import { chordToRoman } from "@/lib/music/roman"
import { startPlayback as audioStart, stopAll as audioStop, DRUM_STYLES } from "@/lib/music/audio"
import { COMPING_STYLE_NAMES, DEFAULT_COMPING_STYLE } from "@/lib/music/comping"
import Fretboard from "@/components/Fretboard"

const PALETTES = [
  {
    // Lady Day — crisp white daylight, vivid blues & greens (DEFAULT)
    name: "Lady Day",
    bg: "#ffffff",          text: "#111827",
    accent: "#1d4ed8",
    panelBg: "rgba(0,0,0,0.025)",       panelBorder: "rgba(0,0,0,0.10)",
    sideBg:  "rgba(29,78,216,0.04)",    sideBorder:  "rgba(29,78,216,0.14)",
    inputBg: "#f3f4f6",
    cardBg: "rgba(0,0,0,0.03)",         cardBorder: "rgba(0,0,0,0.11)",
    muted: "rgba(0,0,0,0.38)",
    // Vivid semantic colors — high contrast on white
    cPurple: "#7c3aed",  cGreen: "#16a34a",  cBlue: "#2563eb",
    cAmber:  "#b45309",  cGold:  "#a16207",  cSalmon: "#dc2626",
    cPink:   "#be185d",
  },
  {
    // Grant Green — deep forest green + gold
    name: "Grant Green",
    bg: "#283618",          text: "#fefae0",
    accent: "#dda15e",
    panelBg: "rgba(221,161,94,0.07)",  panelBorder: "rgba(221,161,94,0.22)",
    sideBg:  "rgba(221,161,94,0.05)",  sideBorder:  "rgba(221,161,94,0.3)",
    inputBg: "#2c3e1a",
    cardBg: "rgba(255,255,255,0.04)",  cardBorder: "rgba(255,255,255,0.1)",
    muted: "rgba(255,255,255,0.4)",
    cPurple: "var(--db-c-purple)",  cGreen: "var(--db-c-green)",  cBlue: "var(--db-c-blue)",
    cAmber:  "var(--db-c-amber)",  cGold:  "var(--db-c-gold)",  cSalmon: "var(--db-c-salmon)",
    cPink:   "var(--db-c-pink)",
  },
  {
    // Bird's Blues — deep navy + cyan
    name: "Bird's Blues",
    bg: "#0a1128",          text: "#fefcfb",
    accent: "#61dafb",
    panelBg: "rgba(18,130,162,0.08)",  panelBorder: "rgba(18,130,162,0.28)",
    sideBg:  "rgba(18,130,162,0.06)",  sideBorder:  "rgba(18,130,162,0.38)",
    inputBg: "#001844",
    cardBg: "rgba(255,255,255,0.04)",  cardBorder: "rgba(255,255,255,0.1)",
    muted: "rgba(255,255,255,0.4)",
    cPurple: "var(--db-c-purple)",  cGreen: "var(--db-c-green)",  cBlue: "var(--db-c-blue)",
    cAmber:  "var(--db-c-amber)",  cGold:  "var(--db-c-gold)",  cSalmon: "var(--db-c-salmon)",
    cPink:   "var(--db-c-pink)",
  },
]

const INITIAL_BARS = [
  { root: "Bb", quality: "7", symbol: "Bb7",  section: "A" },
  { root: "Eb", quality: "7", symbol: "Eb7",  section: "A" },
  { root: "Bb", quality: "7", symbol: "Bb7",  section: "A" },
  { root: "G",  quality: "7", symbol: "G7",   section: "A" },
  { root: "C",  quality: "min7", symbol: "Cm7", section: "A" },
  { root: "F",  quality: "7", symbol: "F7",   section: "A" },
  { root: "Bb", quality: "7", symbol: "Bb7",  section: "A" },
  { root: "F",  quality: "7", symbol: "F7",   section: "A" },
]

const STARTER_PRESETS = [
  { id: "jazz-blues-bb",  label: "Jazz Blues in Bb" },
  { id: "major-251",      label: "Major ii-V-I Cycle" },
  { id: "minor-251",      label: "Minor ii-V-I Cycle" },
  { id: "rhythm-changes", label: "Rhythm Changes" },
  { id: "autumn-leaves",  label: "Autumn Leaves (Gm)" },
  { id: "black-orpheus",  label: "Black Orpheus (Am)" },
  { id: "all-the-things", label: "All the Things (Ab)" },
]

export default function Home() {
  const [bars, setBars] = useState(INITIAL_BARS)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dragIndex, setDragIndex] = useState(null)

  const [approachMode, setApproachMode] = useState(0)  // 0=below, 1=above, 2=off
  const [alteredMode, setAlteredMode] = useState(false) // dominant V7 departs via b13/b9 altered extension
  const [chartKey, setChartKey] = useState("Bb")        // actual key the chart bars are notated in

  const [tempo, setTempo] = useState(110)
  const [originalTempo, setOriginalTempo] = useState(110)  // song's natural BPM, restored on Play Mode
  const [isPlaying, setIsPlaying] = useState(false)
  const [playChords, setPlayChords] = useState(true)
  const [playBass, setPlayBass] = useState(true)
  const [playDrums, setPlayDrums] = useState(true)
  const [drumStyleIdx, setDrumStyleIdx] = useState(0)
  const [playMelody, setPlayMelody] = useState(false)
  const [swingAmount, setSwingAmount] = useState(0.5)
  const [playheadIndex, setPlayheadIndex] = useState(null)

  const [loopStart, setLoopStart] = useState(0)
  const [loopEnd, setLoopEnd] = useState(INITIAL_BARS.length - 1)
  const [loopEnabled, setLoopEnabled] = useState(false)

  const [keyRoot, setKeyRoot] = useState("Bb")
  const [keyMode, setKeyMode] = useState("major")
  const [showRomanNumerals, setShowRomanNumerals] = useState(false)
  const [selectedForm, setSelectedForm] = useState("Custom")

  const [promptText, setPromptText] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationNotes, setGenerationNotes] = useState(null)
  const [generationError, setGenerationError] = useState(null)
  const [showGenNotes, setShowGenNotes] = useState(false)
  const [compingStyle, setCompingStyle] = useState(DEFAULT_COMPING_STYLE)
  const [userLibrary, setUserLibrary] = useState([])
  const [lastGenChart, setLastGenChart] = useState(null)
  const [showFretboard, setShowFretboard] = useState(false)
  const [fretboardView, setFretboardView] = useState("chord")
  const [fretboardTuning, setFretboardTuning] = useState("Standard")
  const [scaleFilter, setScaleFilter] = useState(null)  // null | "pentatonic" | "hexatonic"
  const [bebopOverlay, setBebopOverlay] = useState(false)   // adds chromatic passing tone on top
  const [targetsOverlay, setTargetsOverlay] = useState(false) // adds guide tones (3rd/7th) on top
  const [practiceMode, setPracticeMode] = useState(false)
  const [paletteIndex, setPaletteIndex] = useState(0)
  const [gridColumns, setGridColumns] = useState(4)
  const [scrollMode, setScrollMode] = useState(false)

  // FretFlow: static scale workout boards (up to 4)
  const [openControlPanels, setOpenControlPanels] = useState({
    harmony: false,
    chart: true,
  })

  const [fretFlowCount, setFretFlowCount] = useState(1)
  const [fretFlowBoards, setFretFlowBoards] = useState([
    { root: "C", scale: "major",    tuning: "Standard" },
    { root: "F", scale: "major",    tuning: "Standard" },
    { root: "A", scale: "minor",    tuning: "Standard" },
    { root: "D", scale: "dorian",   tuning: "Standard" },
  ])

  // Refs for stable playback control (avoid stale closure issues)
  const playingRef        = useRef(false)  // true while repeats should continue
  const practiceModeRef   = useRef(false)  // mirrors practiceMode for immediate reads
  const startPlaybackRef  = useRef(null)   // always points to latest startPlayback
  const stopPlaybackRef   = useRef(null)   // always points to latest stopPlayback
  const pendingStartRef   = useRef(false)  // set by loadStarter → fires after bars state commits

  const palette = PALETTES[paletteIndex]

  const selectedBar = bars[selectedIndex]

  const progression = useMemo(() => {
    return analyzeGuideToneMotion(bars)
  }, [bars])

  const harmonicContext = useMemo(() => {
    return analyzeProgressionContext(bars)
  }, [bars])

  const targets = useMemo(() => {
    return melodicTargets(bars)
  }, [bars])

  const approachLines = useMemo(() => {
    return generateApproachLines(bars, approachMode, alteredMode)
  }, [bars, approachMode, alteredMode])

  const phrase = useMemo(() => {
    return approachLines.flatMap(line => line.phrase)
  }, [approachLines])

  const rhythms = useMemo(() => {
    return assignRhythmToBars(bars, 0)
  }, [bars])

  const notationBars = useMemo(() => {
    return approachLines.map((line, i) => ({
      chord: bars[i].symbol,
      arrivalNote: line.arrivalNote,
      departureNote: line.departureNote,
    }))
  }, [approachLines, bars])

  const recommendedScales = getRecommendedScalesFromQuality(selectedBar.quality)

  const scaleData = useMemo(() => {
    const tonic = selectedBar.userTonic ?? selectedBar.root
    if (selectedBar.userScale) {
      return [{ name: selectedBar.userScale, notes: scaleNotes(selectedBar.userScale, tonic) }]
    }
    return recommendedScales.map((scaleName) => ({
      name: scaleName,
      notes: scaleNotes(scaleName, tonic),
    }))
  }, [selectedBar, recommendedScales])

  // Fretboard tracks the playing chord during playback, otherwise follows selection
  const fretboardBarIndex = (isPlaying && playheadIndex !== null) ? playheadIndex : selectedIndex
  const fretboardBar = bars[fretboardBarIndex] ?? selectedBar


  const fretboardInfo = useMemo(() => chordInfo(fretboardBar.symbol), [fretboardBar])

  const fretboardScaleData = useMemo(() => {
    const tonic = fretboardBar.userTonic ?? fretboardBar.root
    if (fretboardBar.userScale) {
      return [{ name: fretboardBar.userScale, notes: scaleNotes(fretboardBar.userScale, tonic) }]
    }
    const scales = getRecommendedScalesFromQuality(fretboardBar.quality)
    return scales.map((scaleName) => ({ name: scaleName, notes: scaleNotes(scaleName, tonic) }))
  }, [fretboardBar])

  const displayedScaleNotes = useMemo(() => {
    const raw   = fretboardScaleData[0]?.notes ?? []
    const tonic = fretboardBar.userTonic ?? fretboardBar.root
    return applyScaleFilter(raw, tonic, fretboardBar.quality, scaleFilter) // null | penta | hexa
  }, [fretboardScaleData, fretboardBar, scaleFilter])

  // Bebop: the extra chromatic passing tone on top of the current base scale
  const bebopPassingNotes = useMemo(() => {
    if (!bebopOverlay) return []
    const raw   = fretboardScaleData[0]?.notes ?? []
    const tonic = fretboardBar.userTonic ?? fretboardBar.root
    const base  = applyScaleFilter(raw, tonic, fretboardBar.quality, scaleFilter)
    const withBebop = applyScaleFilter(base, tonic, fretboardBar.quality, "bebop")
    const baseSet   = new Set(base)
    return withBebop.filter(n => !baseSet.has(n))
  }, [bebopOverlay, fretboardScaleData, fretboardBar, scaleFilter])

  // Guide tones (3rd / 7th) overlay when targets button is active
  const guideToneDisplayNotes = useMemo(() => {
    if (!targetsOverlay) return []
    return targets[fretboardBarIndex]?.currentGuideTones ?? []
  }, [targetsOverlay, targets, fretboardBarIndex])

  const romanNumerals = useMemo(() => {
    return bars.map((bar) => chordToRoman(bar.root, bar.quality, keyRoot, keyMode))
  }, [bars, keyRoot, keyMode])

  // Human-readable bar labels that account for splits: 1, 2.1, 2.2, 3 …
  // Consecutive bars sharing the same sub-beat value are grouped into one logical measure.
  const barLabels = useMemo(() => {
    const labels = []
    let logical = 0
    let i = 0
    while (i < bars.length) {
      const beats = bars[i].beats ?? 4
      if (beats >= 4) {
        // Full-measure bar — label on its own
        logical++
        labels.push(`${logical}`)
        i++
      } else {
        // Short bar — collect all consecutive bars with the same beat value
        const start = i
        while (i < bars.length && (bars[i].beats ?? 4) === beats) i++
        const count = i - start
        logical++
        if (count === 1) {
          labels.push(`${logical}`)
        } else {
          for (let k = 1; k <= count; k++) labels.push(`${logical}.${k}`)
        }
      }
    }
    return labels
  }, [bars])

  function updateBar(index, updates) {
    setBars((prev) =>
      prev.map((bar, i) => {
        if (i !== index) return bar
        const next = { ...bar, ...updates }
        return {
          ...next,
          symbol: buildChordSymbol(next.root, next.quality),
        }
      })
    )
  }

  function handleDragStart(index) {
    setDragIndex(index)
  }

  function handleDrop(targetIndex) {
    if (dragIndex === null || dragIndex === targetIndex) return

    setBars((prev) => {
      const next = [...prev]
      const temp = next[dragIndex]
      next[dragIndex] = next[targetIndex]
      next[targetIndex] = temp
      return next
    })

    if (selectedIndex === dragIndex) setSelectedIndex(targetIndex)
    else if (selectedIndex === targetIndex) setSelectedIndex(dragIndex)

    setDragIndex(null)
  }

  function handleDragEnd() {
    setDragIndex(null)
  }

  function addBar(afterIndex) {
    const src = bars[afterIndex]
    const newBar = { root: src.root, quality: src.quality, symbol: src.symbol, section: src.section }
    setBars((prev) => [...prev.slice(0, afterIndex + 1), newBar, ...prev.slice(afterIndex + 1)])
    setLoopEnd((prev) => prev + 1)
  }

  function removeBar(index) {
    if (bars.length <= 1) return
    setBars((prev) => prev.filter((_, i) => i !== index))
    if (selectedIndex >= index && selectedIndex > 0) setSelectedIndex((s) => s - 1)
    setLoopEnd((prev) => Math.max(0, prev - 1))
  }

  function splitBar(index) {
    const bar = bars[index]
    if ((bar.beats ?? 4) === 2) {
      // Already split — restore to full bar
      updateBar(index, { beats: 4 })
      return
    }
    // Split into two 2-beat half-bars
    const half1 = { ...bar, beats: 2 }
    const half2 = { root: bar.root, quality: bar.quality, symbol: bar.symbol, section: bar.section, beats: 2 }
    setBars((prev) => [...prev.slice(0, index), half1, half2, ...prev.slice(index + 1)])
    setLoopEnd((prev) => prev + 1)
    if (selectedIndex > index) setSelectedIndex((s) => s + 1)
  }

  function loadForm(formName, { exitPractice = false } = {}) {
    setSelectedForm(formName)
    if (exitPractice) {
      practiceModeRef.current = false
      setPracticeMode(false)
    }
    const form = FORMS[formName]
    if (form) {
      setBars(form.bars)
      setKeyRoot(form.keyRoot)
      setChartKey(form.keyRoot)
      setKeyMode(form.keyMode)
      setSelectedIndex(0)
      setLoopStart(0)
      setLoopEnd(form.bars.length - 1)
      const t = form.tempo || 110
      setTempo(t)
      setOriginalTempo(t)
      return
    }
    const userEntry = userLibrary.find((e) => e.name === formName)
    if (userEntry) {
      setBars(userEntry.bars)
      setKeyRoot(userEntry.keyRoot || "C")
      setChartKey(userEntry.keyRoot || "C")
      setKeyMode(userEntry.keyMode || "major")
      setSelectedIndex(0)
      setLoopStart(0)
      setLoopEnd(userEntry.bars.length - 1)
      const t = userEntry.tempo || 110
      setTempo(t)
      setOriginalTempo(t)
    }
  }

  function handleTransposeChart() {
    if (keyRoot === chartKey) return
    setBars((prev) => transposeChart(prev, chartKey, keyRoot))
    setChartKey(keyRoot)
  }

  async function handleGenerateChart() {
    if (!promptText.trim() || isGenerating) return
    setIsGenerating(true)
    setGenerationError(null)
    setGenerationNotes(null)

    try {
      const res = await fetch("/api/generate-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const { chart } = data
      setBars(chart.bars)
      setKeyRoot(chart.keyRoot || "C")
      setChartKey(chart.keyRoot || "C")
      setKeyMode(chart.keyMode || "major")
      setSelectedForm("Custom")
      setSelectedIndex(0)
      setLoopStart(0)
      setLoopEnd(chart.bars.length - 1)
      if (chart.generationNotes) {
        setGenerationNotes(chart.generationNotes)
        setShowGenNotes(true)
      }
      setLastGenChart({ bars: chart.bars, keyRoot: chart.keyRoot || "C", keyMode: chart.keyMode || "major", tempo: chart.tempo || tempo })
    } catch (err) {
      setGenerationError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  function saveToLibrary() {
    if (!lastGenChart) return
    const name = prompt("Name this chart:")
    if (!name?.trim()) return
    const entry = { ...lastGenChart, name: name.trim() }
    const next = [...userLibrary.filter((e) => e.name !== entry.name), entry]
    setUserLibrary(next)
    try { localStorage.setItem("dukebox-library", JSON.stringify(next)) } catch {}
    setSelectedForm(entry.name)
    setLastGenChart(null)
  }

  function removeFromLibrary(name) {
    const next = userLibrary.filter((e) => e.name !== name)
    setUserLibrary(next)
    try { localStorage.setItem("dukebox-library", JSON.stringify(next)) } catch {}
    setSelectedForm("Custom")
  }

  function toggleControlPanel(panelName) {
    setOpenControlPanels((prev) => ({ ...prev, [panelName]: !prev[panelName] }))
  }

  function setPracticeModeAndTempo(enabled) {
    const newTempo = enabled ? 50 : originalTempo
    practiceModeRef.current = enabled
    setPracticeMode(enabled)
    setTempo(newTempo)
    if (isPlaying) {
      stopPlayback()
      // Pass newTempo directly — setTempo() is async and the closure would
      // still read the old value if we let startPlayback() capture it
      startPlayback(newTempo).catch(console.error)
    }
  }

  function loadStarter(starterId) {
    // Stop any current playback before loading
    if (playingRef.current) stopPlayback()

    switch (starterId) {
      case "jazz-blues-bb":
        loadForm("12-Bar Jazz Blues (Bb)")
        break
      case "rhythm-changes":
        loadForm("Rhythm Changes (Bb)")
        break
      case "autumn-leaves":
        loadForm("Autumn Leaves (Gm)")
        break
      case "black-orpheus":
        loadForm("Black Orpheus (Am)")
        break
      case "all-the-things": {
        // All the Things You Are — simplified 32-bar AABA in Ab major
        const s = (r, q) => ({ root: r, quality: q, symbol: buildChordSymbol(r, q) })
        const attya = [
          // A1
          s("F","min7"), s("Bb","min7"), s("Eb","7"),    s("Ab","maj7"),
          s("Db","maj7"), s("G","7"),    s("C","maj7"),  s("C","maj7"),
          // A2
          s("C","min7"), s("F","min7"),  s("Bb","7"),    s("Eb","maj7"),
          s("Ab","maj7"), s("D","7"),    s("G","maj7"),  s("G","maj7"),
          // B
          s("A","min7"), s("D","7"),     s("G","maj7"),  s("G","maj7"),
          s("Gb","min7"), s("B","7"),    s("E","maj7"),  s("C","7"),
          // A3
          s("F","min7"), s("Bb","min7"), s("Eb","7"),    s("Ab","maj7"),
          s("Db","maj7"), s("C","min7"), s("Bb","min7"), s("Eb","7"),
        ]
        setBars(attya)
        setKeyRoot("Ab"); setChartKey("Ab"); setKeyMode("major")
        setSelectedForm("Custom"); setSelectedIndex(0)
        setLoopStart(0); setLoopEnd(attya.length - 1)
        setOriginalTempo(120)
        break
      }
      case "major-251": {
        // Major ii-V-I through all 12 keys — circle of fourths: C F Bb Eb Ab Db Gb B E A D G
        const s = (r, q) => ({ root: r, quality: q, symbol: buildChordSymbol(r, q) })
        const cycle = [
          s("D","min7"),  s("G","7"),  s("C","maj7"),   // C
          s("G","min7"),  s("C","7"),  s("F","maj7"),   // F
          s("C","min7"),  s("F","7"),  s("Bb","maj7"),  // Bb
          s("F","min7"),  s("Bb","7"), s("Eb","maj7"),  // Eb
          s("Bb","min7"), s("Eb","7"), s("Ab","maj7"),  // Ab
          s("Eb","min7"), s("Ab","7"), s("Db","maj7"),  // Db
          s("Ab","min7"), s("Db","7"), s("Gb","maj7"),  // Gb
          s("Db","min7"), s("Gb","7"), s("B","maj7"),   // B  (C#m7 / F#7)
          s("Gb","min7"), s("B","7"),  s("E","maj7"),   // E  (F#m7 / B7)
          s("B","min7"),  s("E","7"),  s("A","maj7"),   // A
          s("E","min7"),  s("A","7"),  s("D","maj7"),   // D
          s("A","min7"),  s("D","7"),  s("G","maj7"),   // G
        ]
        setBars(cycle)
        setKeyRoot("C"); setChartKey("C"); setKeyMode("major")
        setSelectedForm("Custom"); setSelectedIndex(0)
        setLoopStart(0); setLoopEnd(cycle.length - 1)
        setOriginalTempo(120)
        break
      }
      case "minor-251": {
        // Minor iiø-V7-im through all 12 keys — circle of fourths: Am Dm Gm Cm Fm Bbm Ebm Abm Dbm Gbm Bm Em
        const s = (r, q) => ({ root: r, quality: q, symbol: buildChordSymbol(r, q) })
        const cycle = [
          s("B","min7b5"),  s("E","7"),  s("A","min7"),   // Am
          s("E","min7b5"),  s("A","7"),  s("D","min7"),   // Dm
          s("A","min7b5"),  s("D","7"),  s("G","min7"),   // Gm
          s("D","min7b5"),  s("G","7"),  s("C","min7"),   // Cm
          s("G","min7b5"),  s("C","7"),  s("F","min7"),   // Fm
          s("C","min7b5"),  s("F","7"),  s("Bb","min7"),  // Bbm
          s("F","min7b5"),  s("Bb","7"), s("Eb","min7"),  // Ebm
          s("Bb","min7b5"), s("Eb","7"), s("Ab","min7"),  // Abm
          s("Eb","min7b5"), s("Ab","7"), s("Db","min7"),  // Dbm (C#m)
          s("Ab","min7b5"), s("Db","7"), s("Gb","min7"),  // Gbm (F#m)
          s("Db","min7b5"), s("Gb","7"), s("B","min7"),   // Bm  (C#m7b5 / F#7)
          s("Gb","min7b5"), s("B","7"),  s("E","min7"),   // Em  (F#m7b5 / B7)
        ]
        setBars(cycle)
        setKeyRoot("A"); setChartKey("A"); setKeyMode("minor")
        setSelectedForm("Custom"); setSelectedIndex(0)
        setLoopStart(0); setLoopEnd(cycle.length - 1)
        setOriginalTempo(120)
        break
      }
      default:
        break
    }

    // Set practice mode at 50 BPM AFTER loadForm so our tempo always wins
    // (originalTempo was already set above — either by loadForm or setOriginalTempo(120))
    practiceModeRef.current = true
    setPracticeMode(true)
    setTempo(50)

    // Trigger auto-play after React commits the new bars to state
    pendingStartRef.current = true
  }

  function stopPlayback() {
    playingRef.current = false
    audioStop()
    setIsPlaying(false)
    setPlayheadIndex(null)
  }

  async function startPlayback(overrideTempo = null) {
    playingRef.current = false  // cancel any pending repeats from previous run
    stopPlayback()
    playingRef.current = true

    const startIndex  = loopEnabled ? Math.min(loopStart, loopEnd) : 0
    const endIndex    = loopEnabled ? Math.max(loopStart, loopEnd) : bars.length - 1
    const slicedBars  = bars.slice(startIndex, endIndex + 1)
    const slicedLines = approachLines.slice(startIndex, endIndex + 1)
    // overrideTempo lets callers bypass the stale React state closure (e.g. when
    // setPracticeModeAndTempo calls startPlayback before setTempo() has committed)
    const effectiveTempo = practiceModeRef.current ? 50 : (overrideTempo ?? tempo)

    setIsPlaying(true)

    if (loopEnabled) {
      // Infinite seamless loop
      try {
        await audioStart({
          bars:          slicedBars,
          approachLines: slicedLines,
          tempo:         effectiveTempo,
          loop:          true,
          swing:         swingAmount,
          playChords, playBass, playDrums, playMelody, compingStyle,
          drumStyle:     drumStyleIdx,
          onBar:  (localIdx) => setPlayheadIndex(startIndex + localIdx),
          onStop: () => { playingRef.current = false; setIsPlaying(false); setPlayheadIndex(null) },
        })
      } catch (err) {
        console.error("Audio error:", err)
        playingRef.current = false
        setIsPlaying(false)
      }
    } else {
      // Play 5 times through the form, then stop
      let playsLeft = 5
      const opts = {
        bars:          slicedBars,
        approachLines: slicedLines,
        tempo:         effectiveTempo,
        loop:          false,
        swing:         swingAmount,
        playChords, playBass, playDrums, playMelody, compingStyle,
        drumStyle:     drumStyleIdx,
        onBar:  (localIdx) => setPlayheadIndex(startIndex + localIdx),
        onStop: () => {
          playsLeft--
          if (playingRef.current && playsLeft > 0) {
            audioStart(opts).catch(console.error)
          } else {
            playingRef.current = false
            setIsPlaying(false)
            setPlayheadIndex(null)
          }
        },
      }
      try {
        await audioStart(opts)
      } catch (err) {
        console.error("Audio error:", err)
        playingRef.current = false
        setIsPlaying(false)
      }
    }
  }

  // Keep function refs current every render so keyboard handler never goes stale
  startPlaybackRef.current = startPlayback
  stopPlaybackRef.current  = stopPlayback

  // Spacebar = universal play / stop
  useEffect(() => {
    function handleKeyDown(e) {
      const tag = document.activeElement?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if (e.code === "Space") {
        e.preventDefault()
        if (playingRef.current) {
          stopPlaybackRef.current()
        } else {
          startPlaybackRef.current().catch(console.error)
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, []) // intentionally empty — state accessed via refs

  useEffect(() => {
    try {
      const stored = localStorage.getItem("dukebox-library")
      if (stored) setUserLibrary(JSON.parse(stored))
    } catch {}
    return () => audioStop()
  }, [])

  // Auto-play after loadStarter commits new bars to state
  // (startPlaybackRef always points to latest startPlayback, which captures current bars)
  useEffect(() => {
    if (pendingStartRef.current) {
      pendingStartRef.current = false
      startPlaybackRef.current().catch(console.error)
    }
  }, [bars])

  return (
    <>
    <style>{`
      :root {
        --db-bg: ${palette.bg};
        --db-text: ${palette.text};
        --db-accent: ${palette.accent};
        --db-panel-bg: ${palette.panelBg};
        --db-panel-border: ${palette.panelBorder};
        --db-side-bg: ${palette.sideBg};
        --db-side-border: ${palette.sideBorder};
        --db-input-bg: ${palette.inputBg};
        --db-card-bg: ${palette.cardBg};
        --db-card-border: ${palette.cardBorder};
        --db-muted: ${palette.muted};
        --db-c-purple: ${palette.cPurple};
        --db-c-green:  ${palette.cGreen};
        --db-c-blue:   ${palette.cBlue};
        --db-c-amber:  ${palette.cAmber};
        --db-c-gold:   ${palette.cGold};
        --db-c-salmon: ${palette.cSalmon};
        --db-c-pink:   ${palette.cPink};
      }
    `}</style>
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "var(--db-bg)",
        color: "var(--db-text)",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: "24px",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <section style={{ minWidth: 0, overflow: "hidden" }}>
        <div style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "14px" }}>
          <h1 style={{ fontSize: "2.5rem", margin: 0, color: "var(--db-accent)" }}>
            The DukeBox
          </h1>
          <button
            onClick={() => setPaletteIndex((i) => (i + 1) % PALETTES.length)}
            style={{
              padding: "6px 14px", borderRadius: "10px", cursor: "pointer", fontWeight: 600, fontSize: "0.9rem",
              border: "1px solid var(--db-panel-border)",
              background: "var(--db-panel-bg)",
              color: "var(--db-accent)",
              flexShrink: 0,
            }}
            title="Cycle color palette"
          >
            🎨 {palette.name}
          </button>
        </div>

        <p style={{ opacity: 0.75, marginBottom: "24px" }}>
          Drag measures, edit chords, hear the phrase, regenerate ideas, and inspect harmonic context live.
        </p>

        {/* ── Start Practicing Fast ─────────────────────────────── */}
        <div style={{
          ...panelStyle,
          marginBottom: "16px",
          border: "1px solid color-mix(in srgb, var(--db-c-green) 30%, transparent)",
          background: "color-mix(in srgb, var(--db-c-green) 5%, var(--db-bg))",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <div style={{ ...eyebrowStyle, marginBottom: 0, color: "var(--db-c-green)" }}>START PRACTICING</div>
          </div>
          <div style={{ fontSize: "0.78rem", opacity: 0.6, marginBottom: "12px" }}>
            Load a starter chart and begin at slow tempo — ideal for building muscle memory
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {STARTER_PRESETS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => loadStarter(id)}
                style={{
                  padding: "7px 12px", borderRadius: "8px", fontSize: "0.85rem", cursor: "pointer",
                  background: "var(--db-panel-bg)",
                  border: "1px solid var(--db-panel-border)",
                  color: "var(--db-text)",
                  fontWeight: 500,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── AI Chart Generator ────────────────────────────────── */}
        <div style={{
          ...panelStyle,
          marginBottom: "16px",
          border: "1px solid rgba(201,167,255,0.25)",
          background: "rgba(201,167,255,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <div style={{ ...eyebrowStyle, marginBottom: 0, color: "var(--db-c-purple)" }}>AI CHART GENERATOR</div>
            <div style={{ fontSize: "0.72rem", opacity: 0.5 }}>powered by Claude</div>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerateChart() }}
              placeholder={
                "Describe the chart you want — e.g.:\n" +
                "\"12-bar minor blues in F with a backdoor dominant\"\n" +
                "\"32-bar AABA in Eb with Coltrane changes on the bridge\"\n" +
                "\"Bossa nova tune in D minor, slow, deceptive cadence at bar 8\""
              }
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid rgba(201,167,255,0.2)",
                background: "var(--db-input-bg)",
                color: "var(--db-text)",
                fontSize: "0.95rem",
                resize: "vertical",
                minHeight: "58px",
                fontFamily: "Arial, sans-serif",
                lineHeight: 1.5,
              }}
              disabled={isGenerating}
            />
            <button
              onClick={handleGenerateChart}
              disabled={isGenerating || !promptText.trim()}
              style={{
                ...buttonStyle("var(--db-c-purple)"),
                minWidth: "110px",
                padding: "12px 16px",
                opacity: isGenerating || !promptText.trim() ? 0.5 : 1,
                flexShrink: 0,
              }}
            >
              {isGenerating ? "Generating…" : "Generate"}
            </button>
          </div>

          <div style={{ fontSize: "0.75rem", opacity: 0.45, marginTop: "6px" }}>
            ⌘ + Enter to generate
          </div>

          {generationError && (
            <div style={{
              marginTop: "10px", padding: "10px 12px", borderRadius: "8px",
              background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.3)",
              color: "#ff8a8a", fontSize: "0.88rem",
            }}>
              {generationError}
            </div>
          )}

          {generationNotes && (
            <div style={{ marginTop: "10px" }}>
              <button
                onClick={() => setShowGenNotes((p) => !p)}
                style={{
                  background: "none", border: "none", color: "var(--db-c-purple)",
                  cursor: "pointer", fontSize: "0.82rem", padding: "0", opacity: 0.8,
                }}
              >
                {showGenNotes ? "▼" : "▶"} Generation Notes
              </button>
              {showGenNotes && (
                <div style={{
                  marginTop: "6px", padding: "10px 12px", borderRadius: "8px",
                  background: "rgba(201,167,255,0.07)", border: "1px solid rgba(201,167,255,0.15)",
                  fontSize: "0.88rem", lineHeight: 1.6, opacity: 0.9,
                }}>
                  {generationNotes}
                </div>
              )}
            </div>
          )}

          {lastGenChart && (
            <div style={{ marginTop: "10px" }}>
              <button onClick={saveToLibrary} style={buttonStyle("var(--db-c-green)")}>
                + Add to My Library
              </button>
            </div>
          )}
        </div>

        {/* ── Song Settings ─────────────────────────────────────── */}
        <div style={{ ...panelStyle, marginBottom: "16px" }}>
          <div style={eyebrowStyle}>SONGBOOK</div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>

            <label style={inlineLabelStyle}>
              <span style={{ opacity: 0.7, marginRight: "4px" }}>Form</span>
              <select
                value={selectedForm}
                onChange={(e) => loadForm(e.target.value, { exitPractice: true })}
                style={{ ...selectStyle, width: "auto", padding: "6px 10px" }}
              >
                <option value="Custom">Custom</option>
                {Object.entries(FORM_CATEGORIES).map(([cat, names]) => (
                  <optgroup key={cat} label={cat}>
                    {names.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </optgroup>
                ))}
                {userLibrary.length > 0 && (
                  <optgroup label="My Library">
                    {userLibrary.map(({ name }) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>

            {userLibrary.some((e) => e.name === selectedForm) && (
              <button
                onClick={() => removeFromLibrary(selectedForm)}
                style={{ ...buttonStyle("#ff8a8a", "#200a0a"), padding: "6px 10px", fontSize: "0.82rem" }}
                title="Remove this chart from your library"
              >
                × Remove
              </button>
            )}

            <label style={inlineLabelStyle}>
              <span style={{ opacity: 0.7, marginRight: "4px" }}>Key</span>
              <select
                value={keyRoot}
                onChange={(e) => setKeyRoot(e.target.value)}
                style={{ ...selectStyle, width: "auto", padding: "6px 10px" }}
              >
                {ROOTS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                value={keyMode}
                onChange={(e) => setKeyMode(e.target.value)}
                style={{ ...selectStyle, width: "auto", padding: "6px 10px", marginLeft: "4px" }}
              >
                <option value="major">Major</option>
                <option value="minor">Minor</option>
              </select>
            </label>

            <button
              onClick={handleTransposeChart}
              style={buttonStyle(keyRoot !== chartKey ? "var(--db-c-amber)" : "var(--db-muted)")}
            >
              Transpose Part
            </button>

            <label style={inlineLabelStyle}>
              <input
                type="checkbox"
                checked={showRomanNumerals}
                onChange={(e) => setShowRomanNumerals(e.target.checked)}
              />
              Roman Numerals
            </label>
          </div>
        </div>

        <div style={panelStyle}>
          {/* ── Section 1: Playback & Practice ─────────────────────── */}
          <div style={{ marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ ...eyebrowStyle, marginBottom: 0 }}>PLAYBACK & PRACTICE</div>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={isPlaying ? stopPlayback : () => startPlayback().catch(console.error)}
                  style={{
                    padding: "11px 28px", borderRadius: "10px", cursor: "pointer",
                    fontWeight: 800, fontSize: "1.05rem", letterSpacing: "0.02em",
                    border: `2px solid ${isPlaying ? "var(--db-c-salmon)" : "var(--db-c-amber)"}`,
                    background: isPlaying
                      ? "color-mix(in srgb, var(--db-c-salmon) 18%, var(--db-bg))"
                      : "color-mix(in srgb, var(--db-c-amber) 18%, var(--db-bg))",
                    color: isPlaying ? "var(--db-c-salmon)" : "var(--db-c-amber)",
                    boxShadow: isPlaying
                      ? "0 0 12px color-mix(in srgb, var(--db-c-salmon) 30%, transparent)"
                      : "0 0 12px color-mix(in srgb, var(--db-c-amber) 30%, transparent)",
                  }}
                >
                  {isPlaying ? "⏹ Stop" : "▶ Play"}
                </button>

                <button
                  onClick={() => setPracticeModeAndTempo(!practiceMode)}
                  style={{
                    padding: "9px 16px", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "0.88rem",
                    border: practiceMode
                      ? "1px solid var(--db-c-green)"
                      : "1px solid var(--db-c-blue)",
                    background: practiceMode
                      ? "color-mix(in srgb, var(--db-c-green) 12%, var(--db-bg))"
                      : "color-mix(in srgb, var(--db-c-blue) 10%, var(--db-bg))",
                    color: practiceMode ? "var(--db-c-green)" : "var(--db-c-blue)",
                  }}
                  title={practiceMode
                    ? `Click to switch to Play Mode — restores ${originalTempo} BPM`
                    : "Click to switch to Practice Mode — slows to 50 BPM"}
                >
                  {practiceMode ? "📖 Practice Mode" : "🎷 Play Mode"}
                </button>

                <label style={inlineLabelStyle}>
                  Tempo
                  <input type="range" min="70" max="180" value={tempo} onChange={(e) => setTempo(Number(e.target.value))} />
                  <span>{tempo}</span>
                </label>

                <label style={inlineLabelStyle}>
                  Swing
                  <input
                    type="range" min="0" max="100"
                    value={Math.round(swingAmount * 100)}
                    onChange={(e) => setSwingAmount(Number(e.target.value) / 100)}
                    style={{ width: "70px" }}
                  />
                  <span style={{ minWidth: "28px", fontSize: "0.85rem", opacity: 0.8 }}>
                    {Math.round(swingAmount * 100)}%
                  </span>
                </label>

                <label style={inlineLabelStyle}>
                  <input type="checkbox" checked={playChords} onChange={(e) => setPlayChords(e.target.checked)} />
                  Piano
                </label>

                <label style={inlineLabelStyle}>
                  <span style={{ opacity: 0.7 }}>Comping Style</span>
                  <select
                    value={compingStyle}
                    onChange={(e) => setCompingStyle(e.target.value)}
                    style={{ ...selectStyle, width: "auto", padding: "5px 8px", fontSize: "0.85rem" }}
                  >
                    {COMPING_STYLE_NAMES.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </label>

                <label style={inlineLabelStyle}>
                  <input type="checkbox" checked={playBass} onChange={(e) => setPlayBass(e.target.checked)} />
                  Bass
                </label>

                <label style={inlineLabelStyle}>
                  <input type="checkbox" checked={playDrums} onChange={(e) => setPlayDrums(e.target.checked)} />
                  <button
                    onClick={() => setDrumStyleIdx(i => (i + 1) % DRUM_STYLES.length)}
                    style={{
                      ...buttonStyle(playDrums ? "var(--db-c-amber)" : "var(--db-muted)"),
                      padding: "3px 10px", fontSize: "0.82rem", fontWeight: 600,
                    }}
                    title="Click to cycle through drum styles"
                  >
                    🥁 {DRUM_STYLES[drumStyleIdx].name}
                  </button>
                </label>

                <label style={inlineLabelStyle}>
                  <input type="checkbox" checked={playMelody} onChange={(e) => setPlayMelody(e.target.checked)} />
                  Melody
                </label>
              </div>
          </div>

          {/* ── Section 2: Chart Navigation & Loop ─────────────────── */}
          <div style={{ marginBottom: "12px" }}>
            <div
              onClick={() => toggleControlPanel("chart")}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: "8px" }}
            >
              <div style={{ ...eyebrowStyle, marginBottom: 0 }}>CHART NAVIGATION & LOOP</div>
              <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>{openControlPanels.chart ? "▼" : "▶"}</span>
            </div>
            {openControlPanels.chart && (
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <label style={inlineLabelStyle}>
                  <input type="checkbox" checked={loopEnabled} onChange={(e) => setLoopEnabled(e.target.checked)} />
                  Loop
                </label>
                <button onClick={() => setLoopStart(selectedIndex)} style={buttonStyle("var(--db-c-gold)")}>
                  Set Start at Selected Bar
                </button>
                <button onClick={() => setLoopEnd(selectedIndex)} style={buttonStyle("var(--db-c-gold)")}>
                  Set End at Selected Bar
                </button>
                <button
                  onClick={() => setShowFretboard((p) => !p)}
                  style={buttonStyle(showFretboard ? "var(--db-c-amber)" : "var(--db-c-blue)")}
                >
                  {showFretboard ? "Hide Fretboard" : "🎸 Fretboard"}
                </button>
              </div>
            )}
          </div>

          {/* ── Section 3: Harmony Tools ────────────────────────────── */}
          <div style={{ marginBottom: "12px" }}>
            <div
              onClick={() => toggleControlPanel("harmony")}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: "8px" }}
            >
              <div style={{ ...eyebrowStyle, marginBottom: 0 }}>HARMONY TOOLS</div>
              <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>{openControlPanels.harmony ? "▼" : "▶"}</span>
            </div>
            {openControlPanels.harmony && (
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={() => setApproachMode(m => (m + 1) % 3)}
                  style={buttonStyle(
                    approachMode === 0 ? "var(--db-c-blue)"
                    : approachMode === 1 ? "var(--db-c-purple)"
                    : "var(--db-muted)"
                  )}
                >
                  {approachMode === 0 ? "Approach Tone: ↓ Below"
                   : approachMode === 1 ? "Approach Tone: ↑ Above"
                   : "Approach Tone: ○ Off"}
                </button>
              </div>
            )}
          </div>

          <div style={eyebrowStyle}>MELODY LANE</div>
          <div style={{ fontSize: "0.78rem", opacity: 0.55, marginBottom: "8px", marginTop: "-4px" }}>
            Guide-tone skeleton — arrival (red) and departure (green) notes across the chart
          </div>

          <NotationLane
            bars={notationBars}
            activeIndex={selectedIndex}
            onSelectBar={setSelectedIndex}
            playheadIndex={playheadIndex}
            barLabels={barLabels}
          />

          <div style={{ marginTop: "8px", fontSize: "0.9rem", opacity: 0.7 }}>
            Loop range: bars {Math.min(loopStart, loopEnd) + 1} to {Math.max(loopStart, loopEnd) + 1}
          </div>
        </div>

        {showFretboard && (
          <div style={{ ...panelStyle, marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px", flexWrap: "wrap" }}>
              <div style={{ ...eyebrowStyle, marginBottom: 0 }}>FRETBOARD</div>

              {/* View: Chord / Scale */}
              <div style={{ display: "flex", gap: "4px" }}>
                {["chord", "scale"].map((v) => (
                  <button key={v} onClick={() => setFretboardView(v)} style={{
                    padding: "4px 10px", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer",
                    background: fretboardView === v ? "color-mix(in srgb, var(--db-c-amber) 20%, var(--db-bg))" : "var(--db-panel-bg)",
                    border:     fretboardView === v ? "1px solid var(--db-c-amber)" : "1px solid var(--db-panel-border)",
                    color:      fretboardView === v ? "var(--db-c-amber)" : "var(--db-text)",
                    fontWeight: fretboardView === v ? 700 : 400,
                    opacity:    fretboardView === v ? 1 : 0.7,
                  }}>
                    {v === "chord" ? "Chord" : "Scale"}
                  </button>
                ))}
              </div>

              {/* Base scale shape — mutually exclusive */}
              <div style={{ display: "flex", gap: "4px" }}>
                {["pentatonic","hexatonic","martino"].map((f) => (
                  <button key={f} onClick={() => setScaleFilter(prev => prev === f ? null : f)} style={{
                    padding: "4px 10px", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer",
                    background: scaleFilter === f ? "color-mix(in srgb, var(--db-c-blue) 20%, var(--db-bg))" : "var(--db-panel-bg)",
                    border:     scaleFilter === f ? "1px solid var(--db-c-blue)" : "1px solid var(--db-panel-border)",
                    color:      scaleFilter === f ? "var(--db-c-blue)" : "var(--db-text)",
                    fontWeight: scaleFilter === f ? 700 : 400,
                    opacity:    scaleFilter === f ? 1 : 0.7,
                    textTransform: "capitalize",
                  }}>
                    {f === "martino" ? "Martino" : f}
                  </button>
                ))}
              </div>

              {/* Additive overlays */}
              <div style={{ display: "flex", gap: "4px" }}>
                <button onClick={() => setBebopOverlay(p => !p)} style={{
                  padding: "4px 10px", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer",
                  background: bebopOverlay ? "rgba(86,197,104,0.22)" : "var(--db-panel-bg)",
                  border:     bebopOverlay ? "1px solid #56C568" : "1px solid var(--db-panel-border)",
                  color:      bebopOverlay ? "#56C568" : "var(--db-text)",
                  fontWeight: bebopOverlay ? 700 : 400,
                  opacity:    bebopOverlay ? 1 : 0.7,
                }}>
                  +Bebop
                </button>
                <button onClick={() => setTargetsOverlay(p => !p)} style={{
                  padding: "4px 10px", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer",
                  background: targetsOverlay ? "rgba(255,213,79,0.22)" : "var(--db-panel-bg)",
                  border:     targetsOverlay ? "1px solid #FFD54F" : "1px solid var(--db-panel-border)",
                  color:      targetsOverlay ? "#c49800" : "var(--db-text)",
                  fontWeight: targetsOverlay ? 700 : 400,
                  opacity:    targetsOverlay ? 1 : 0.7,
                }}>
                  +Guide Tones
                </button>
              </div>

              <select
                value={fretboardTuning}
                onChange={(e) => setFretboardTuning(e.target.value)}
                style={{ ...selectStyle, width: "auto", padding: "4px 8px", fontSize: "0.82rem" }}
              >
                {["Standard", "Drop D", "Open G", "DADGAD"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <div style={{ fontSize: "0.88rem", opacity: 0.6, marginLeft: "auto" }}>
                {fretboardBar.symbol}
                {fretboardBar.userTonic && fretboardBar.userTonic !== fretboardBar.root
                  ? ` (${fretboardBar.userTonic})` : ""}
                {fretboardView === "scale"
                  ? ` · ${scaleFilter === "martino" ? "Martino" : (scaleFilter ?? fretboardScaleData[0]?.name ?? "")}`
                  : ""}
              </div>
            </div>

            <div style={{ overflowX: "auto", marginBottom: "4px" }}>
              <Fretboard
                chordNotes={fretboardInfo.notes || []}
                rootNote={fretboardBar.userTonic ?? fretboardBar.root}
                scaleNotes={displayedScaleNotes}
                targetNotes={[]}
                passingNotes={bebopPassingNotes}
                guideToneNotes={guideToneDisplayNotes}
                view={fretboardView}
                tuningName={fretboardTuning}
              />
            </div>

            <div style={{ marginTop: "8px", display: "flex", gap: "14px", fontSize: "0.78rem", flexWrap: "wrap" }} >
              <span style={{ opacity: 0.55 }}><span style={{ color: "#BD2031" }}>●</span> Root</span>
              <span style={{ opacity: 0.55 }}><span style={{ color: "#3A9C5A" }}>●</span> Chord tone</span>
              <span style={{ opacity: 0.55 }}><span style={{ color: "#3A78C9" }}>●</span> Scale tone</span>
              {bebopOverlay   && <span style={{ opacity: 0.85 }}><span style={{ color: "#56C568" }}>●</span> Bebop passing</span>}
              {targetsOverlay && <span style={{ opacity: 0.85 }}><span style={{ color: "#FFD54F" }}>●</span> Guide tones</span>}
              <span style={{ opacity: 0.55 }}><span style={{ color: "#E09B3D" }}>●</span> Target note</span>
            </div>
          </div>
        )}

        <div style={panelStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <div style={{ ...eyebrowStyle, marginBottom: 0 }}>LEAD SHEET GRID</div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <span style={{ fontSize: "0.78rem", opacity: 0.5, marginRight: "2px" }}>cols:</span>
              {[2, 3, 4, 6, 8].map(n => (
                <button key={n} onClick={() => setGridColumns(n)} style={{
                  padding: "3px 8px", borderRadius: "5px", fontSize: "0.78rem", cursor: "pointer",
                  background: gridColumns === n ? "rgba(224,180,76,0.18)" : "var(--db-card-bg)",
                  border: gridColumns === n ? "1px solid var(--db-c-amber)" : "1px solid var(--db-card-border)",
                  color: gridColumns === n ? "var(--db-c-amber)" : "var(--db-muted)",
                  fontWeight: gridColumns === n ? 700 : 400,
                }}>{n}</button>
              ))}
              <button onClick={() => setScrollMode(p => !p)} style={{
                padding: "3px 10px", borderRadius: "5px", fontSize: "0.78rem", cursor: "pointer",
                background: scrollMode ? "rgba(127,200,255,0.18)" : "var(--db-card-bg)",
                border: scrollMode ? "1px solid var(--db-c-blue)" : "1px solid var(--db-card-border)",
                color: scrollMode ? "var(--db-c-blue)" : "var(--db-muted)",
                fontWeight: scrollMode ? 700 : 400,
                marginLeft: "4px",
              }}>📜 Scroll</button>
              <button
                onClick={() => addBar(bars.length - 1)}
                style={{
                  padding: "3px 10px", borderRadius: "5px", fontSize: "0.78rem", cursor: "pointer",
                  background: "var(--db-card-bg)",
                  border: "1px solid var(--db-c-green)",
                  color: "var(--db-c-green)",
                  fontWeight: 600, marginLeft: "8px",
                }}
                title="Add a new measure at the end"
              >+ Measure</button>
            </div>
          </div>

          {scrollMode ? (
            (() => {
              const TELE_ROW_H = 140
              const teleActive = playheadIndex ?? selectedIndex
              const teleRowIdx = Math.floor(teleActive / gridColumns)
              const teleColIdx = teleActive % gridColumns
              const teleAllRows = []
              for (let r = 0; r * gridColumns < bars.length; r++) {
                teleAllRows.push(bars.slice(r * gridColumns, (r + 1) * gridColumns))
              }
              return (
                <div style={{ position: "relative", height: `${TELE_ROW_H}px`, overflow: "hidden", borderRadius: "10px" }}>
                  <div style={{
                    position: "absolute", top: 0, zIndex: 2, pointerEvents: "none",
                    left: `calc(${(teleColIdx / gridColumns) * 100}% + 4px)`,
                    width: `calc(${(1 / gridColumns) * 100}% - 8px)`,
                    height: `${TELE_ROW_H}px`,
                    borderRadius: "10px",
                    border: "2px solid rgba(224,180,76,0.65)",
                    boxShadow: "0 0 28px rgba(224,180,76,0.22)",
                    transition: "left 0.3s ease-in-out",
                  }} />
                  <div style={{
                    transform: `translateY(-${teleRowIdx * TELE_ROW_H}px)`,
                    transition: "transform 0.45s cubic-bezier(0.4,0,0.2,1)",
                  }}>
                    {teleAllRows.map((rowBars, rowIdx) => (
                      <div key={rowIdx} style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                        gap: "8px",
                        height: `${TELE_ROW_H}px`,
                        alignItems: "stretch",
                      }}>
                        {rowBars.map((bar, colIdx) => {
                          const globalIdx = rowIdx * gridColumns + colIdx
                          const isActive = globalIdx === teleActive
                          const isPlayhead = globalIdx === playheadIndex
                          const guide = progression[globalIdx]?.guideTones || []
                          const target = targets[globalIdx]
                          return (
                            <div
                              key={globalIdx}
                              onClick={() => setSelectedIndex(globalIdx)}
                              style={{
                                padding: "10px",
                                borderRadius: "10px",
                                background: isPlayhead ? "rgba(139,211,168,0.1)" : isActive ? "rgba(224,180,76,0.08)" : "var(--db-card-bg)",
                                border: isPlayhead ? "1px solid rgba(139,211,168,0.25)" : isActive ? "1px solid rgba(224,180,76,0.25)" : "1px solid var(--db-card-border)",
                                cursor: "pointer",
                                display: "flex", flexDirection: "column",
                                justifyContent: "center", alignItems: "center", textAlign: "center",
                                gap: "4px",
                              }}
                            >
                              <div style={{ fontSize: "1.7rem", fontWeight: 700, lineHeight: 1.1,
                                color: isPlayhead ? "var(--db-c-green)" : isActive ? "var(--db-accent)" : "var(--db-text)" }}>
                                {bar.symbol}
                              </div>
                              <div style={{ fontSize: "0.72rem", color: "var(--db-c-amber)", opacity: 0.85 }}>
                                {guide.length ? guide.join(" / ") : "—"}
                              </div>
                              {target?.targetNote && (
                                <div style={{ fontSize: "0.7rem", color: "var(--db-c-blue)", opacity: 0.75 }}>
                                  → {target.targetNote}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()
          ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
              gap: "12px",
            }}
          >
            {bars.flatMap((bar, index) => {
              const active = index === selectedIndex
              const guide = progression[index]?.guideTones || []
              const target = targets[index]
              const context = harmonicContext[index]
              const intervals = chordInfo(bar.symbol).intervals || []
              const isPlayhead = index === playheadIndex
              const inLoop =
                index >= Math.min(loopStart, loopEnd) && index <= Math.max(loopStart, loopEnd)
              const roman = romanNumerals[index]

              const prevSection = index > 0 ? bars[index - 1].section : null
              const showSectionHeader = bar.section && bar.section !== prevSection

              const elements = []

              if (showSectionHeader) {
                elements.push(
                  <div
                    key={`section-${index}`}
                    style={{
                      gridColumn: "1 / -1",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      color: "var(--db-accent)",
                      opacity: 0.85,
                      paddingTop: index > 0 ? "10px" : "0",
                      paddingBottom: "4px",
                      borderBottom: "1px solid rgba(224,180,76,0.2)",
                      marginBottom: "2px",
                    }}
                  >
                    {bar.section} SECTION
                  </div>
                )
              }

              elements.push(
                <div
                  key={index}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  onClick={() => setSelectedIndex(index)}
                  style={{
                    padding: "14px 12px",
                    borderRadius: "12px",
                    border: isPlayhead
                      ? "1px solid var(--db-c-green)"
                      : active
                      ? "1px solid var(--db-c-amber)"
                      : inLoop && loopEnabled
                      ? "1px solid rgba(240,212,138,0.5)"
                      : "1px solid var(--db-card-border)",
                    background: isPlayhead
                      ? "rgba(139,211,168,0.12)"
                      : active
                      ? "rgba(224,180,76,0.12)"
                      : inLoop && loopEnabled
                      ? "rgba(240,212,138,0.06)"
                      : "var(--db-card-bg)",
                    cursor: "pointer",
                    boxShadow: dragIndex === index ? "0 0 0 2px rgba(127,200,255,0.45)" : "none",
                    position: "relative",
                  }}
                >
                  {/* Bar header row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <div style={{ fontSize: "0.75rem", opacity: 0.5 }}>BAR {barLabels[index]}</div>
                      {(bar.beats ?? 4) === 2 && (
                        <div style={{
                          fontSize: "0.6rem", fontWeight: 700, padding: "1px 4px",
                          borderRadius: "4px", background: "rgba(127,200,255,0.15)",
                          border: "1px solid rgba(127,200,255,0.3)", color: "var(--db-c-blue)",
                          lineHeight: 1.4,
                        }}>
                          ½
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); splitBar(index) }}
                        style={{
                          background: (bar.beats ?? 4) === 2 ? "rgba(127,200,255,0.1)" : "none",
                          border: (bar.beats ?? 4) === 2 ? "1px solid rgba(127,200,255,0.3)" : "none",
                          color: (bar.beats ?? 4) === 2 ? "var(--db-c-blue)" : "var(--db-muted)",
                          cursor: "pointer", fontSize: "0.75rem", padding: "0 4px", lineHeight: 1.6,
                          borderRadius: "4px",
                        }}
                        title={(bar.beats ?? 4) === 2 ? "Restore to full bar (4 beats)" : "Split into 2-beat half-bar"}
                      >
                        {(bar.beats ?? 4) === 2 ? "×2" : "÷2"}
                      </button>
                      {bars.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeBar(index) }}
                          style={{
                            background: "none", border: "none", color: "rgba(255,100,100,0.6)",
                            cursor: "pointer", fontSize: "0.9rem", padding: "0 2px", lineHeight: 1,
                          }}
                          title="Remove bar"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Chord symbol */}
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: showRomanNumerals ? "2px" : "8px" }}>
                    {bar.symbol}
                  </div>

                  {/* Roman numeral */}
                  {showRomanNumerals && (
                    <div style={{ fontSize: "0.9rem", color: "var(--db-c-gold)", marginBottom: "8px", opacity: 0.9 }}>
                      {roman}
                    </div>
                  )}

                  <div style={{ fontSize: "0.76rem", color: "var(--db-c-salmon)", marginBottom: "4px" }}>
                    Cadence: {context?.cadenceLabels?.join(", ") || "—"}
                  </div>

                  <div style={{ fontSize: "0.76rem", color: "var(--db-c-amber)", marginBottom: "4px" }}>
                    Guide Tones: {guide.length ? guide.join(" / ") : "—"}
                  </div>

                  <div style={{ fontSize: "0.76rem", color: "var(--db-c-blue)", marginBottom: "4px" }}>
                    Intervals: {intervals.length ? intervals.join(" · ") : "—"}
                  </div>

                  <div style={{ fontSize: "0.76rem", color: "var(--db-c-green)", marginBottom: "6px" }}>
                    Target: {target?.targetNote || "—"}
                  </div>

                  {/* Per-bar chord editor */}
                  <div style={{
                    marginBottom: "8px", paddingTop: "6px",
                    borderTop: "1px solid var(--db-card-border)",
                  }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ fontSize: "0.66rem", opacity: 0.45, marginBottom: "3px" }}>CHORD</div>
                    <div style={{ display: "flex", gap: "3px" }}>
                      <select
                        value={bar.root}
                        onChange={(e) => { updateBar(index, { root: e.target.value }); setSelectedIndex(index) }}
                        style={{
                          flex: 1, padding: "2px 3px", borderRadius: "4px", fontSize: "0.72rem",
                          background: "var(--db-input-bg)", border: "1px solid var(--db-card-border)",
                          color: "var(--db-accent)", fontWeight: 700,
                        }}
                      >
                        {ROOTS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <select
                        value={bar.quality}
                        onChange={(e) => { updateBar(index, { quality: e.target.value }); setSelectedIndex(index) }}
                        style={{
                          flex: 2, padding: "2px 3px", borderRadius: "4px", fontSize: "0.72rem",
                          background: "var(--db-input-bg)", border: "1px solid var(--db-card-border)",
                          color: "var(--db-text)",
                        }}
                      >
                        {QUALITIES.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Per-bar tonic / scale override */}
                  <div style={{
                    marginBottom: "8px", paddingTop: "6px",
                    borderTop: "1px solid var(--db-card-border)",
                  }}>
                    <div style={{ fontSize: "0.66rem", opacity: 0.45, marginBottom: "3px" }}>SCALE</div>
                    <div style={{ display: "flex", gap: "3px" }} onClick={(e) => e.stopPropagation()}>
                      <select
                        value={bar.userTonic ?? ""}
                        onChange={(e) => updateBar(index, { userTonic: e.target.value || undefined })}
                        style={{
                          flex: 1, padding: "2px 3px", borderRadius: "4px", fontSize: "0.72rem",
                          background: "var(--db-input-bg)", border: "1px solid var(--db-card-border)",
                          color: bar.userTonic ? "var(--db-accent)" : "var(--db-muted)",
                        }}
                      >
                        <option value="">root</option>
                        {ROOTS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <select
                        value={bar.userScale ?? ""}
                        onChange={(e) => updateBar(index, { userScale: e.target.value || undefined })}
                        style={{
                          flex: 2, padding: "2px 3px", borderRadius: "4px", fontSize: "0.72rem",
                          background: "var(--db-input-bg)", border: "1px solid var(--db-card-border)",
                          color: bar.userScale ? "var(--db-accent)" : "var(--db-muted)",
                        }}
                      >
                        <option value="">auto</option>
                        {getRecommendedScalesFromQuality(bar.quality).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Add bar button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); addBar(index) }}
                    style={{
                      width: "100%", padding: "4px 0",
                      background: "var(--db-card-bg)",
                      border: "1px dashed var(--db-card-border)",
                      borderRadius: "6px", color: "var(--db-muted)",
                      cursor: "pointer", fontSize: "0.78rem",
                    }}
                    title="Insert bar after"
                  >
                    + bar
                  </button>
                </div>
              )

              return elements
            })}
          </div>
          )}
        </div>

        <div style={panelStyle}>
          <div style={eyebrowStyle}>CONTINUOUS PHRASE</div>
          <div style={{ fontSize: "0.78rem", opacity: 0.55, marginBottom: "8px", marginTop: "-4px" }}>
            All approach notes stitched together — the full improvised line across every bar as one phrase
          </div>
          <div style={{ fontSize: "1rem", lineHeight: 1.9, color: "var(--db-c-purple)" }}>
            {phrase.length ? phrase.join("  →  ") : "No phrase generated"}
          </div>
        </div>

        <div style={panelStyle}>
          <div style={eyebrowStyle}>RHYTHMIC SHAPE</div>
          <div style={{ fontSize: "0.78rem", opacity: 0.55, marginBottom: "8px", marginTop: "-4px" }}>
            When to play each chord's key note — the rhythmic skeleton of the phrase (beat placement per bar)
          </div>
          <div style={{ fontSize: "1rem", lineHeight: 1.9, color: "var(--db-c-green)" }}>
            {rhythms.map((item, index) => (
              <span key={`${item.chord}-rhythm-${index}`}>
                <strong>{bars[index].symbol}</strong> [{item.rhythm}]
                {index < rhythms.length - 1 ? "   |   " : ""}
              </span>
            ))}
          </div>
        </div>

        {/* ── FRET FLOW ─────────────────────────────────────────────── */}
        {(() => {
          // FRET_FLOW_SCALES and TUNING_NAMES are module-level constants (defined below Home()).
          const updateFFBoard = (idx, patch) =>
            setFretFlowBoards(prev => prev.map((b, i) => i === idx ? { ...b, ...patch } : b))

          return (
            <div style={panelStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
                <div style={{ ...eyebrowStyle, marginBottom: 0 }}>FRET FLOW</div>
                <div style={{ fontSize: "0.78rem", opacity: 0.55 }}>Static scale workout — choose up to 4 keys to practice</div>
                <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
                  {[1, 2, 3, 4].map(n => (
                    <button key={n} onClick={() => setFretFlowCount(n)} style={{
                      padding: "3px 10px", borderRadius: "5px", fontSize: "0.8rem", cursor: "pointer",
                      background: fretFlowCount === n
                        ? "color-mix(in srgb, var(--db-c-purple) 20%, var(--db-bg))"
                        : "var(--db-panel-bg)",
                      border: fretFlowCount === n
                        ? "1px solid var(--db-c-purple)"
                        : "1px solid var(--db-panel-border)",
                      color: fretFlowCount === n ? "var(--db-c-purple)" : "var(--db-text)",
                      fontWeight: fretFlowCount === n ? 700 : 400,
                    }}>{n} board{n > 1 ? "s" : ""}</button>
                  ))}
                </div>
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(${Math.min(fretFlowCount, 2)}, 1fr)`,
                gap: "16px",
              }}>
                {fretFlowBoards.slice(0, fretFlowCount).map((board, idx) => {
                  const notes = scaleNotes(board.scale, board.root)
                  return (
                    <div key={idx} style={{
                      background: "var(--db-card-bg)",
                      border: "1px solid var(--db-card-border)",
                      borderRadius: "10px",
                      padding: "12px",
                    }}>
                      {/* Board header: root + scale + tuning selectors */}
                      <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap", alignItems: "center" }}>
                        <select
                          value={board.root}
                          onChange={e => updateFFBoard(idx, { root: e.target.value })}
                          style={{ ...selectStyle, flex: "0 0 auto", width: "72px", fontWeight: 700, color: "var(--db-accent)" }}
                        >
                          {ROOTS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select
                          value={board.scale}
                          onChange={e => updateFFBoard(idx, { scale: e.target.value })}
                          style={{ ...selectStyle, flex: 1, minWidth: "160px" }}
                        >
                          {FRET_FLOW_SCALES.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                        <select
                          value={board.tuning}
                          onChange={e => updateFFBoard(idx, { tuning: e.target.value })}
                          style={{ ...selectStyle, flex: "0 0 auto", width: "96px" }}
                        >
                          {TUNING_NAMES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <div style={{ fontSize: "0.72rem", opacity: 0.5, marginLeft: "auto" }}>
                          {notes.join("  ")}
                        </div>
                      </div>
                      <Fretboard
                        chordNotes={[]}
                        rootNote={board.root}
                        scaleNotes={notes}
                        view="scale"
                        tuningName={board.tuning}
                        targetNotes={[]}
                        passingNotes={[]}
                        guideToneNotes={[]}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </section>

    </main>
    </>
  )
}

function InfoBlock({ title, value, color }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={eyebrowSmallStyle}>{title}</div>
      <div style={{ fontSize: "1.1rem", color: color || "var(--db-text)" }}>{value}</div>
    </div>
  )
}

const panelStyle = {
  marginBottom: "20px",
  padding: "18px",
  borderRadius: "14px",
  border: "1px solid var(--db-panel-border)",
  background: "var(--db-panel-bg)",
}

const sidePanelStyle = {
  border: "1px solid var(--db-side-border)",
  borderRadius: "16px",
  padding: "20px",
  background: "var(--db-side-bg)",
}

const scaleCardStyle = {
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid var(--db-panel-border)",
  background: "var(--db-panel-bg)",
}

function buttonStyle(colorVar) {
  return {
    padding: "9px 12px",
    borderRadius: "10px",
    border: `1px solid color-mix(in srgb, ${colorVar} 45%, transparent)`,
    background: `color-mix(in srgb, ${colorVar} 10%, var(--db-bg))`,
    color: colorVar,
    cursor: "pointer",
    fontWeight: 700,
  }
}

// Note pill — used in voice-leading phrase and melody lane displays.
function notePillStyle(colorVar) {
  return {
    padding: "4px 10px",
    borderRadius: "8px",
    background: `color-mix(in srgb, ${colorVar} 12%, transparent)`,
    border: `1px solid color-mix(in srgb, ${colorVar} 30%, transparent)`,
    fontSize: "1.1rem",
    color: colorVar,
    fontWeight: 700,
  }
}

// ─── FretFlow static data (never changes — defined once at module scope) ──────
const FRET_FLOW_SCALES = [
  // Diatonic modes
  { value: "major",                 label: "Major (Ionian)" },
  { value: "dorian",                label: "Dorian" },
  { value: "phrygian",              label: "Phrygian" },
  { value: "lydian",                label: "Lydian" },
  { value: "mixolydian",            label: "Mixolydian" },
  { value: "minor",                 label: "Natural Minor (Aeolian)" },
  { value: "locrian",               label: "Locrian" },
  // Harmonic / melodic minor family
  { value: "harmonic minor",        label: "Harmonic Minor" },
  { value: "melodic minor",         label: "Melodic Minor" },
  { value: "harmonic major",        label: "Harmonic Major" },
  { value: "double harmonic major", label: "Double Harmonic Major" },
  // Symmetric / exotic
  { value: "whole tone",            label: "Whole Tone" },
  { value: "whole-half diminished", label: "Diminished (Whole-Half)" },
  { value: "half-whole diminished", label: "Diminished (Half-Whole)" },
  { value: "enigmatic",             label: "Enigmatic" },
  // Altered / modal jazz
  { value: "altered",               label: "Altered (Superlocrian)" },
  { value: "lydian dominant",       label: "Lydian Dominant" },
  // Bebop scales (8-note)
  { value: "bebop",                 label: "Bebop Dominant" },
  { value: "bebop major",           label: "Bebop Major" },
  { value: "bebop minor",           label: "Bebop Dorian" },
  { value: "bebop locrian",         label: "Bebop Locrian" },
  // Pentatonic & blues
  { value: "major pentatonic",      label: "Major Pentatonic" },
  { value: "minor pentatonic",      label: "Minor Pentatonic" },
  { value: "major blues",           label: "Major Blues" },
  { value: "blues",                 label: "Blues (Minor Blues)" },
  { value: "minor hexatonic",       label: "Minor Hexatonic" },
]

const TUNING_NAMES = ["Standard", "Drop D", "Open G", "DADGAD"]

const selectStyle = {
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  background: "var(--db-input-bg)",
  color: "var(--db-text)",
  border: "1px solid var(--db-panel-border)",
}

const inlineLabelStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "0.9rem",
}

const eyebrowStyle = {
  fontSize: "0.85rem",
  opacity: 0.65,
  marginBottom: "10px",
  letterSpacing: "0.08em",
}

const eyebrowSmallStyle = {
  fontSize: "0.85rem",
  opacity: 0.65,
  marginBottom: "6px",
}

const miniLabelStyle = {
  fontSize: "0.78rem",
  opacity: 0.6,
  marginBottom: "4px",
}
