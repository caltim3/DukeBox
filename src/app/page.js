"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  martinoMapper,
  getHexatonicBebopNotes,
  fretFlowScaleNotes,
  getRecommendedScalesFromQuality,
  transposeChart,
  applyScaleFilter,
  barryHarrisScale,
  hexChoiceForChord,
  SCALE_CATALOG,
  rankScalesForChord,
} from "@/lib/music/tonal"
import { analyzeProgressionContext } from "@/lib/music/harmony"
import { FORMS, FORM_CATEGORIES, DESERT_NOIR_META } from "@/lib/music/forms"
import { chordToRoman } from "@/lib/music/roman"
import { DRUM_STYLES } from "@/lib/music/audioConstants"
import { exportLeadSheet, exportMusicXML } from "@/lib/music/leadsheet"
import { COMPING_STYLE_NAMES, DEFAULT_COMPING_STYLE } from "@/lib/music/comping"
import { BASS_STYLE_NAMES, DEFAULT_BASS_STYLE } from "@/lib/music/bassStyles"
import { downloadImprovGuide, buildImprovMapData } from "@/lib/music/improvGuide"
import { DRUM_KIT_NAMES, DEFAULT_DRUM_KIT } from "@/lib/music/samples"
import { parseTonalUserSongs } from "@/lib/music/importTonal"
import { parseGigChord, GIGBOOK_SONGS, gigSongToBars, parseGigKey, gigTempoNumber } from "@/lib/music/gigbook"
import Fretboard from "@/components/Fretboard"
import Runway from "@/components/Runway"
import MetronomePanel from "@/components/MetronomePanel"
import PracticeTimer from "@/components/PracticeTimer"
import LineLab from "@/components/LineLab"
import SongSearch from "@/components/SongSearch"
import GigBarStrip from "@/components/GigBarStrip"
import { lineToTransportEvents } from "@/lib/music/lines"
import SongCrafter from "@/components/SongCrafter"
import GigMode from "@/components/GigMode"
import { useAuth, useCloudLibrary } from "@/lib/cloud"

// audio.js (Tone.js) is loaded lazily on first play so AudioContext is only
// created after a user gesture, avoiding the browser autoplay-policy warning.
let _audioMod = null
async function loadAudio() {
  if (!_audioMod) _audioMod = await import("@/lib/music/audio")
  return _audioMod
}

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
    // Muted text meets WCAG AA (4.5:1) against this palette's background —
    // 0.38 measured only 2.7:1. See docs/UX_UI_RECOMMENDATIONS.md Phase 7.
    muted: "rgba(0,0,0,0.60)",
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
    muted: "rgba(255,255,255,0.70)",   // 7.2:1 on #283618 (was 0.4 → 3.4:1)
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
    muted: "rgba(255,255,255,0.62)",   // 7.6:1 on #0a1128 (was 0.4 → 3.8:1)
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

// Converts Tonal.js interval notation → readable jazz shorthand
// e.g. "3m" → "m3", "5d" → "b5", "7M" → "M7", "1P" → "R"
function formatInterval(ivl) {
  const map = {
    "1P": "R",
    "2m": "m2",  "2M": "M2",  "2A": "#2",
    "3m": "m3",  "3M": "M3",
    "4P": "P4",  "4A": "#4",
    "5d": "b5",  "5P": "P5",  "5A": "#5",
    "6m": "m6",  "6M": "M6",
    "7d": "dim7","7m": "m7",  "7M": "M7",
    "8P": "R",
    "9m": "b9",  "9M": "9",   "9A": "#9",
    "11P":"P11", "11A":"#11",
    "13m":"b13", "13M":"13",
  }
  return map[ivl] ?? ivl
}

// ─── Workspaces ───────────────────────────────────────────────────────────────
// The app had grown into four products stacked vertically — 11 panels and ~317
// controls on one 5-screen page, all at equal weight. Modes show one workspace
// at a time; nothing was removed, it's just no longer all at once.
const MODES = [
  { id: "practice",  label: "Practice",  icon: "🎧", blurb: "Play along, loop a section, drill it slow" },
  { id: "write",     label: "Write",     icon: "✍️", blurb: "Generate, edit, and arrange a chart" },
  { id: "gig",       label: "Gig",       icon: "🎤", blurb: "Stage charts and setlists" },
  { id: "reference", label: "Reference", icon: "📖", blurb: "Circle of fifths, key chart, progressions" },
  { id: "tonal",     label: "Tonal",     icon: "🎹", blurb: "The published Tonal app, embedded as-is" },
]

// Tonal is embedded rather than ported: the live site is loaded in a frame
// exactly as published, so it stays whatever it already is and nothing here
// has to be kept in sync with it.
const TONAL_URL = "https://caltim3.github.io/tonal/"

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

  const [chartKey, setChartKey] = useState("Bb")        // actual key the chart bars are notated in

  const [tempo, setTempo] = useState(110)
  const [originalTempo, setOriginalTempo] = useState(110)  // song's natural BPM, restored on Play Mode
  const [isPlaying, setIsPlaying] = useState(false)
  const [playChords, setPlayChords] = useState(true)
  const [playBass, setPlayBass] = useState(true)
  const [bassStyle, setBassStyle] = useState(DEFAULT_BASS_STYLE)
  const [bassComplexity, setBassComplexity] = useState(0.5)
  const [playDrums, setPlayDrums] = useState(true)
  const [drumStyleIdx, setDrumStyleIdx] = useState(0)
  const [drumKit, setDrumKit] = useState(DEFAULT_DRUM_KIT)
  const [reverbAmount, setReverbAmount] = useState(0)
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
  const [lastGenChart, setLastGenChart] = useState(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importText, setImportText] = useState("")
  const [importStatus, setImportStatus] = useState(null)
  const [mode, setMode] = useState("practice")
  const [activeGigSongId, setActiveGigSongId] = useState(null)  // which gig tune is loaded
  const [activeSongTitle, setActiveSongTitle] = useState(null)  // named on the floating bar strip
  // Panels declare which workspaces they belong to; several appear in more than one.
  const inMode = (...ids) => ids.includes(mode)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [clipboardBar, setClipboardBar] = useState(null)
  const [showBarDetails, setShowBarDetails] = useState(false)
  const [toast, setToast] = useState(null)
  const [showStickyPlay, setShowStickyPlay] = useState(false)
  // Mirrored from PracticeTimer so the fretboard can show the clock too —
  // { seconds, running, done, duration }, pushed once per displayed second.
  const [timerState, setTimerState] = useState(null)

  // Cloud-synced library (songs + setlists + prefs); auth via Supabase magic link.
  // Degrades to localStorage when signed out or Supabase isn't configured.
  const auth = useAuth()
  const { library, setLibrary, status: syncStatus } = useCloudLibrary(auth.email)
  const userLibrary = library.songs
  const promptHistory = library.prefs?.promptHistory ?? []

  // Remember the workspace across sessions (rides the Supabase sync with
  // everything else, so it follows you between devices).
  const savedMode = library.prefs?.mode
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!cancelled && savedMode && MODES.some(m => m.id === savedMode)) setMode(savedMode)
    })()
    return () => { cancelled = true }
  }, [savedMode])

  function chooseMode(id) {
    setMode(id)
    setLibrary(lib => ({ ...lib, prefs: { ...lib.prefs, mode: id } }))
  }
  const [showFretboard, setShowFretboard] = useState(false)
  const [fretboardView, setFretboardView] = useState("chord")
  const [fretboardTuning, setFretboardTuning] = useState("Standard")
  const [scaleFilter, setScaleFilter] = useState(null)  // null | "pentatonic" | "hexatonic" | "martino" | "hexchord" | "barry"
  const [bebopOverlay, setBebopOverlay] = useState(false)   // adds chromatic passing tone on top
  const [targetsOverlay, setTargetsOverlay] = useState(false) // adds guide tones (3rd/7th) on top
  const [anticipateOn, setAnticipateOn] = useState(false)   // second fretboard showing the next chord
  const [practiceMode, setPracticeMode] = useState(false)
  const [paletteIndex, setPaletteIndex] = useState(0)
  const [gridColumns, setGridColumns] = useState(4)
  const [scrollMode, setScrollMode] = useState(false)

  // FretFlow: static scale workout boards (up to 4)
  const [openControlPanels, setOpenControlPanels] = useState({
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
  const toastTimer        = useRef(null)   // auto-dismiss handle for the toast
  const transportRef      = useRef(null)   // main Play button — watched for the sticky fallback

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
    return generateApproachLines(bars)
  }, [bars])

  const phrase = useMemo(() => {
    return approachLines.flatMap(line => line.phrase)
  }, [approachLines])

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

  // When Martino mode is active, compute the remapped display root/quality for the fretboard.
  // Everything else (audio, guide tones, notation) continues to use the original fretboardBar data.
  const martinoMap = useMemo(() => {
    if (scaleFilter !== "martino") return null
    return martinoMapper(fretboardBar.root, fretboardBar.quality)
  }, [scaleFilter, fretboardBar])

  const fretboardScaleData = useMemo(() => {
    const tonic = fretboardBar.userTonic ?? fretboardBar.root
    if (fretboardBar.userScale) {
      return [{ name: fretboardBar.userScale, notes: scaleNotes(fretboardBar.userScale, tonic) }]
    }
    const scales = getRecommendedScalesFromQuality(fretboardBar.quality)
    return scales.map((scaleName) => ({ name: scaleName, notes: scaleNotes(scaleName, tonic) }))
  }, [fretboardBar])

  const displayedScaleNotes = useMemo(() => {
    // Martino mode: remap to display root/quality and apply hexatonic formula from that root.
    // The `applyScaleFilter("martino")` path also works, but using the mapper explicitly keeps
    // the fretboard rootNote and label in sync with the same computed values.
    if (martinoMap) {
      const { displayRoot, displayQuality } = martinoMap
      return applyScaleFilter([], displayRoot, displayQuality, "hexatonic")
    }
    const raw   = fretboardScaleData[0]?.notes ?? []
    const tonic = fretboardBar.userTonic ?? fretboardBar.root
    return applyScaleFilter(raw, tonic, fretboardBar.quality, scaleFilter)
  }, [fretboardScaleData, fretboardBar, scaleFilter, martinoMap])

  // Bebop: chromatic passing tones shown in green over the current scale.
  // Hexatonic and Martino modes use dedicated two-note passing tone rules
  // (M7+b9 for minorHex, b6+b7 for majorHex) instead of the standard single-note bebop.
  const bebopPassingNotes = useMemo(() => {
    if (!bebopOverlay) return []
    const effectiveRoot    = martinoMap ? martinoMap.displayRoot    : (fretboardBar.userTonic ?? fretboardBar.root)
    const effectiveQuality = martinoMap ? martinoMap.displayQuality : fretboardBar.quality

    if (scaleFilter === "hexatonic" || martinoMap) {
      const base    = applyScaleFilter([], effectiveRoot, effectiveQuality, "hexatonic")
      const baseSet = new Set(base)
      return getHexatonicBebopNotes(effectiveRoot, effectiveQuality).filter(n => n && !baseSet.has(n))
    }

    // Standard bebop: one chromatic passing tone on top of the current scale
    const base      = applyScaleFilter(fretboardScaleData[0]?.notes ?? [], effectiveRoot, effectiveQuality, scaleFilter)
    const withBebop = applyScaleFilter(base, effectiveRoot, effectiveQuality, "bebop")
    const baseSet   = new Set(base)
    return withBebop.filter(n => !baseSet.has(n))
  }, [bebopOverlay, fretboardScaleData, fretboardBar, scaleFilter, martinoMap])

  // Guide tones (3rd / 7th) overlay when targets button is active
  const guideToneDisplayNotes = useMemo(() => {
    if (!targetsOverlay) return []
    return targets[fretboardBarIndex]?.currentGuideTones ?? []
  }, [targetsOverlay, targets, fretboardBarIndex])

  // Barry Harris 6th-dim passing tone — shown green when the Barry filter is on
  const barryPassingNotes = useMemo(() => {
    if (scaleFilter !== "barry") return []
    const tonic = fretboardBar.userTonic ?? fretboardBar.root
    const p = barryHarrisScale(tonic, fretboardBar.quality).passingNote
    return p ? [p] : []
  }, [scaleFilter, fretboardBar])

  // Anticipate — the next sounding bar, wrapping inside the loop range when
  // looping (ported from Bebop Blueprint's loop-aware next-chord lookup)
  const anticipateBarIndex = useMemo(() => {
    if (!bars.length) return null
    const lo = loopEnabled ? Math.min(loopStart, loopEnd) : 0
    const hi = loopEnabled ? Math.max(loopStart, loopEnd) : bars.length - 1
    const span = hi - lo + 1
    for (let step = 1; step <= span; step++) {
      const idx = lo + ((fretboardBarIndex - lo + step) % span + span) % span
      if (bars[idx] && bars[idx].quality !== "NC") return idx
    }
    return null
  }, [bars, fretboardBarIndex, loopEnabled, loopStart, loopEnd])

  const anticipateBar = anticipateBarIndex != null ? bars[anticipateBarIndex] : null
  const anticipateInfo = useMemo(
    () => (anticipateBar ? chordInfo(anticipateBar.symbol) : { notes: [] }),
    [anticipateBar]
  )

  // How each current guide tone resolves into the next chord.
  //
  // Only motion of a semitone or a whole tone counts as a target. The previous
  // version took the cyclically nearest guide tone, which can be up to six
  // semitones away — so it would confidently mark a fourth as a "resolution".
  // A leap that size isn't voice leading, so it now yields no target at all.
  //
  // The value is the signed semitone distance (-2..+2); the fretboard draws one
  // arrow per semitone, pointing right for higher and left for lower — which
  // matches the direction you actually move on the neck.
  const guideToneDirections = useMemo(() => {
    if (!targetsOverlay || anticipateBarIndex == null) return null
    const chroma = (n) => "C Db D Eb E F Gb G Ab A Bb B".split(" ").indexOf(n)
    const cur = targets[fretboardBarIndex]?.currentGuideTones ?? []
    const nxt = targets[anticipateBarIndex]?.currentGuideTones ?? []
    if (!cur.length || !nxt.length) return null
    const dirs = {}
    for (const g of cur) {
      const gc = chroma(g)
      if (gc < 0) continue
      let best = null
      for (const t of nxt) {
        const tc = chroma(t)
        if (tc < 0) continue
        const signed = ((tc - gc + 6 + 12) % 12) - 6   // shortest cyclic path, -6..+5
        if (Math.abs(signed) > 2) continue             // not a resolution — ignore
        if (best === null || Math.abs(signed) < Math.abs(best)) {
          best = signed
          dirs[`${g}:to`] = t                          // the note it becomes
        }
      }
      if (best !== null) dirs[g] = best
    }
    return dirs
  }, [targetsOverlay, targets, fretboardBarIndex, anticipateBarIndex])

  const romanNumerals = useMemo(() => {
    return bars.map((bar) => chordToRoman(bar.root, bar.quality, keyRoot, keyMode))
  }, [bars, keyRoot, keyMode])

  // Desert Noir originals carry pedagogy + section (repeat/note) metadata.
  const dnMeta = DESERT_NOIR_META[selectedForm] || null
  const dnSectionMeta = useMemo(() => {
    const secs = FORMS[selectedForm]?.sections
    if (!secs) return null
    const map = {}
    secs.forEach((s) => { if (!(s.name in map)) map[s.name] = { repeat: s.repeat, note: s.note } })
    return map
  }, [selectedForm])

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

  // useCallback so the keyboard-shortcut effect can depend on it without
  // re-registering its listener on every render.
  const updateBar = useCallback((index, updates) => {
    setBars((prev) =>
      prev.map((bar, i) => {
        if (i !== index) return bar
        const next = { ...bar, ...updates }
        // Slash bass belongs in the symbol so copy/paste and quick-entry keep it.
        const base = buildChordSymbol(next.root, next.quality)
        return {
          ...next,
          symbol: next.bass && next.quality !== "NC" ? `${base}/${next.bass}` : base,
        }
      })
    )
  }, [])

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

  // A search hit can be a Songbook form, a library chart, or a Gig Book tune.
  // The first two are names loadForm already resolves; the third has to be
  // converted from its stage chart into playable bars.
  function loadSearchPick(name, row) {
    if (row?.gig) {
      const bars = gigSongToBars(row.gig)
      if (!bars.length) { showToast(`No changes stored for "${row.name}"`); return }
      const { keyRoot: k, keyMode: m } = parseGigKey(row.gig.key)
      loadGigSong({
        bars, keyRoot: k, keyMode: m,
        tempo: gigTempoNumber(row.gig.tempo),
        songId: `gig:${row.gig.id}`,
      })
      showToast(`Loaded ${row.name} — ${bars.length} bars`)
      return
    }
    loadForm(name, { exitPractice: true })
  }

  function handleTransposeChart() {
    if (keyRoot === chartKey) return
    setBars((prev) => transposeChart(prev, chartKey, keyRoot))
    setChartKey(keyRoot)
  }

  // Generation streams server-sent events so the model's reasoning
  // (generationNotes, which the schema emits before the long bars array) shows
  // up live instead of only after the whole chart lands.
  async function handleGenerateChart(overridePrompt = null) {
    const prompt = (typeof overridePrompt === "string" ? overridePrompt : promptText).trim()
    if (!prompt || isGenerating) return
    setIsGenerating(true)
    setGenerationError(null)
    setGenerationNotes(null)
    setShowGenNotes(true)

    const applyChart = (chart) => {
      setBars(chart.bars)
      setKeyRoot(chart.keyRoot || "C")
      setChartKey(chart.keyRoot || "C")
      setKeyMode(chart.keyMode || "major")
      setSelectedForm("Custom")
      setSelectedIndex(0)
      setLoopStart(0)
      setLoopEnd(chart.bars.length - 1)
      if (chart.generationNotes) setGenerationNotes(chart.generationNotes)
      setLastGenChart({
        bars: chart.bars,
        keyRoot: chart.keyRoot || "C",
        keyMode: chart.keyMode || "major",
        tempo: chart.tempo || tempo,
      })
      // Remember the prompt (most recent first, de-duped, capped) — rides along
      // with the synced library so history follows you across devices.
      setLibrary(lib => {
        const prev = lib.prefs?.promptHistory ?? []
        const next = [prompt, ...prev.filter(p => p !== prompt)].slice(0, 12)
        return { ...lib, prefs: { ...lib.prefs, promptHistory: next } }
      })
    }

    try {
      const res = await fetch("/api/generate-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, stream: true }),
      })
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Request failed (${res.status})`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let done = false

      while (!done) {
        const { value, done: finished } = await reader.read()
        if (finished) break
        buffer += decoder.decode(value, { stream: true })

        // SSE frames are separated by a blank line
        const frames = buffer.split("\n\n")
        buffer = frames.pop() ?? ""
        for (const frame of frames) {
          const line = frame.split("\n").find(l => l.startsWith("data:"))
          if (!line) continue
          let msg
          try { msg = JSON.parse(line.slice(5).trim()) } catch { continue }
          if (msg.type === "notes") {
            setGenerationNotes(msg.text)
          } else if (msg.type === "done") {
            applyChart(msg.chart)
            done = true
          } else if (msg.type === "error") {
            throw new Error(msg.error)
          }
        }
      }
    } catch (err) {
      setGenerationError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  // "Surprise me" — compose a random brief and generate straight from it.
  function surpriseMe() {
    const pick = (a) => a[Math.floor(Math.random() * a.length)]
    const form  = pick(SURPRISE.forms)
    const key   = pick(SURPRISE.keys)
    const mood  = pick(SURPRISE.moods)
    const device = pick(SURPRISE.devices)
    const brief = `${form} in ${key}, ${mood}, featuring ${device}`
    setPromptText(brief)
    handleGenerateChart(brief)
  }

  function saveToLibrary() {
    if (!lastGenChart) return
    const name = prompt("Name this chart:")
    if (!name?.trim()) return
    const entry = { ...lastGenChart, name: name.trim(), updatedAt: Date.now() }
    setLibrary(lib => ({ ...lib, songs: [...lib.songs.filter(e => e.name !== entry.name), entry] }))
    setSelectedForm(entry.name)
    setLastGenChart(null)
  }

  function removeFromLibrary(name) {
    setLibrary(lib => ({ ...lib, songs: lib.songs.filter(e => e.name !== name) }))
    setSelectedForm("Custom")
  }

  // Load any Gig Mode / setlist tune into the editor and engine.
  // Gig Mode deliberately STAYS OPEN so you can read the stage chart while it
  // plays — the open chart lights the current measure via activeGigSongId.
  function loadGigSong({ bars, keyRoot, keyMode, tempo, autoplay, songId, title, toMode }) {
    if (toMode) setMode(toMode)   // e.g. Song Crafter hands off into Practice
    if (playingRef.current) stopPlayback()
    practiceModeRef.current = false
    setPracticeMode(false)
    setBars(bars)
    setKeyRoot(keyRoot); setChartKey(keyRoot); setKeyMode(keyMode)
    setSelectedForm("Custom"); setSelectedIndex(0)
    setLoopStart(0); setLoopEnd(bars.length - 1)
    const t = tempo || 110
    setTempo(t); setOriginalTempo(t)
    setActiveGigSongId(songId ?? null)
    setActiveSongTitle(title ?? null)
    if (autoplay) pendingStartRef.current = true
  }

  function toggleControlPanel(panelName) {
    setOpenControlPanels((prev) => ({ ...prev, [panelName]: !prev[panelName] }))
  }

  function setPracticeModeAndTempo(enabled) {
    const newTempo = enabled ? 50 : originalTempo
    practiceModeRef.current = enabled
    setPracticeMode(enabled)
    setTempo(newTempo)
    // No stop/restart: the live-settings effect below pushes the new tempo into
    // the running transport, so switching modes mid-tune no longer drops the band.
    if (isPlaying) _audioMod?.updatePlayback({ tempo: newTempo })
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

  // Double-click a bar → loop just that chord for isolated practice.
  function loopJustThisBar(index) {
    setSelectedIndex(index)
    setLoopStart(index)
    setLoopEnd(index)
    setLoopEnabled(true)
    // Pass the range explicitly — loop state hasn't committed yet.
    startPlayback(null, { start: index, end: index }).catch(console.error)
  }

  // Copy the chart as plain text: "| Dm7 | G7 | Cmaj7 | Cmaj7 |", 4 bars a line.
  function copyChartAsText() {
    const lines = []
    for (let i = 0; i < bars.length; i += 4) {
      lines.push("| " + bars.slice(i, i + 4).map(b => b.symbol).join(" | ") + " |")
    }
    const text = lines.join("\n")
    navigator.clipboard?.writeText(text).then(
      () => showToast(`Copied ${bars.length} bars as text`),
      () => window.prompt("Copy the chart:", text)
    )
  }

  function showToast(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }

  // Line Lab practice playback: loop a chosen stretch of the chart with the
  // rhythm section and (optionally) the generated line, at a practice tempo.
  // barsOverride lets a lab play changes that aren't in the loaded chart at all
  // (Line Lab's triad-network presets), in which case the chart's own playhead
  // stays dark rather than lighting bars that aren't sounding.
  async function playLineSection({ line, startIndex, endIndex, barsOverride, practiceTempo, muteLine, onBar, onLineNote, onDone }) {
    playingRef.current = false
    stopPlayback()
    playingRef.current = true
    const source = barsOverride?.length ? barsOverride : bars
    const lo = Math.max(0, Math.min(startIndex ?? 0, source.length - 1))
    const hi = Math.max(lo, Math.min(endIndex ?? lo, source.length - 1))
    const slicedBars = source.slice(lo, hi + 1)
    const lineEvents = (line && !muteLine) ? lineToTransportEvents(line.bars, slicedBars) : null
    setIsPlaying(true)
    const { startPlayback: audioStart } = await loadAudio()
    try {
      await audioStart({
        bars:       slicedBars,
        tempo:      practiceTempo || tempo,
        loop:       true,
        swing:      swingAmount,
        playChords, playBass, playDrums,
        playMelody: false,
        compingStyle, bassStyle, bassComplexity, drumKit, reverbAmount,
        drumStyle:  drumStyleIdx,
        lineEvents,
        onLineNote,
        onBar:  (localIdx) => {
          if (!barsOverride?.length) setPlayheadIndex(lo + localIdx)
          onBar?.(localIdx)
        },
        onStop: () => { playingRef.current = false; setIsPlaying(false); setPlayheadIndex(null); onDone?.() },
      })
    } catch (err) {
      console.error("Line practice audio error:", err)
      playingRef.current = false
      setIsPlaying(false)
      onDone?.()
    }
  }

  function stopPlayback() {
    playingRef.current = false
    _audioMod?.stopAll()   // no-op if audio hasn't been loaded yet
    setIsPlaying(false)
    setPlayheadIndex(null)
  }

  // loopOverride ({start, end}) forces a loop over an explicit bar range without
  // waiting for loop state to commit — used by per-bar "loop just this chord".
  async function startPlayback(overrideTempo = null, loopOverride = null) {
    playingRef.current = false  // cancel any pending repeats from previous run
    stopPlayback()
    playingRef.current = true

    const useLoop     = loopOverride ? true : loopEnabled
    const startIndex  = loopOverride ? Math.min(loopOverride.start, loopOverride.end) : (loopEnabled ? Math.min(loopStart, loopEnd) : 0)
    const endIndex    = loopOverride ? Math.max(loopOverride.start, loopOverride.end) : (loopEnabled ? Math.max(loopStart, loopEnd) : bars.length - 1)
    const slicedBars  = bars.slice(startIndex, endIndex + 1)
    const slicedLines = approachLines.slice(startIndex, endIndex + 1)
    // overrideTempo lets callers bypass the stale React state closure (e.g. when
    // setPracticeModeAndTempo calls startPlayback before setTempo() has committed)
    const effectiveTempo = practiceModeRef.current ? 50 : (overrideTempo ?? tempo)

    setIsPlaying(true)

    // Load Tone.js lazily — AudioContext is only created here, after user gesture
    const { startPlayback: audioStart } = await loadAudio()

    if (useLoop) {
      // Infinite seamless loop
      try {
        await audioStart({
          bars:          slicedBars,
          approachLines: slicedLines,
          tempo:         effectiveTempo,
          loop:          true,
          swing:         swingAmount,
          playChords, playBass, playDrums, playMelody, compingStyle,
          bassStyle, bassComplexity, drumKit, reverbAmount,
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
      // Five choruses, scheduled as one continuous timeline. This used to
      // re-invoke audioStart() from onStop for each pass, which tore the engine
      // down and rebuilt it between choruses — audible as a gap at every repeat.
      const opts = {
        bars:          slicedBars,
        approachLines: slicedLines,
        tempo:         effectiveTempo,
        loop:          false,
        repeats:       5,
        swing:         swingAmount,
        playChords, playBass, playDrums, playMelody, compingStyle,
        bassStyle, bassComplexity, drumKit, reverbAmount,
        drumStyle:     drumStyleIdx,
        onBar:  (localIdx) => setPlayheadIndex(startIndex + localIdx),
        onStop: () => {
          playingRef.current = false
          setIsPlaying(false)
          setPlayheadIndex(null)
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

  // Workflow shortcuts — arrow navigation, chord cycling, copy/paste, cheatsheet.
  // Separate from the spacebar handler because these need live bar/selection state.
  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      const meta = e.metaKey || e.ctrlKey

      if (e.key === "?") { e.preventDefault(); setShowShortcuts(s => !s); return }
      if (e.key === "Escape") { setShowShortcuts(false); return }

      if (meta && (e.key === "c" || e.key === "C")) {
        const b = bars[selectedIndex]
        if (b) { e.preventDefault(); setClipboardBar({ root: b.root, quality: b.quality, bass: b.bass }) }
        return
      }
      if (meta && (e.key === "v" || e.key === "V")) {
        if (clipboardBar) { e.preventDefault(); updateBar(selectedIndex, clipboardBar) }
        return
      }
      if (meta) return   // leave every other browser shortcut alone

      if (e.key === "ArrowLeft") {
        e.preventDefault()
        setSelectedIndex(i => Math.max(0, i - 1))
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        setSelectedIndex(i => Math.min(bars.length - 1, i + 1))
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        // Cycle the selected bar's chord quality
        const qi = QUALITIES.findIndex(q => q.value === bars[selectedIndex]?.quality)
        if (qi === -1) return
        e.preventDefault()
        const next = e.key === "ArrowUp"
          ? (qi - 1 + QUALITIES.length) % QUALITIES.length
          : (qi + 1) % QUALITIES.length
        updateBar(selectedIndex, { quality: QUALITIES[next].value })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [bars, selectedIndex, clipboardBar, updateBar])

  // Library hydration + cloud sync is handled by useCloudLibrary; here we only
  // ensure audio stops if the component unmounts mid-playback.
  useEffect(() => {
    return () => _audioMod?.stopAll()
  }, [])

  // Show the floating transport only once the real Play button is off-screen.
  useEffect(() => {
    const el = transportRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      ([entry]) => setShowStickyPlay(!entry.isIntersecting),
      { threshold: 0 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Push mix changes into the running transport. Tempo, swing, mutes, comping
  // and bass styles, drum style/kit, and reverb all used to wait for the next
  // Play; now you can rebalance the band while the tune is going.
  useEffect(() => {
    if (!isPlaying) return
    _audioMod?.updatePlayback({
      tempo: practiceMode ? 50 : tempo,
      swing: swingAmount,
      playChords, playBass, playDrums, playMelody,
      compingStyle, bassStyle, bassComplexity,
      drumStyle: drumStyleIdx, drumKit, reverbAmount,
    })
  }, [
    isPlaying, tempo, practiceMode, swingAmount,
    playChords, playBass, playDrums, playMelody,
    compingStyle, bassStyle, bassComplexity,
    drumStyleIdx, drumKit, reverbAmount,
  ])

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

        /* ── Design tokens ────────────────────────────────────────────
           Type collapsed from 23 ad-hoc sizes to six steps, radius from
           ten values to three. Per-element sizing is what made the app
           read as assembled rather than designed. */
        --db-fs-xs:      0.72rem;   /* eyebrow labels, captions, legends */
        --db-fs-sm:      0.82rem;   /* secondary controls, helper text   */
        --db-fs-md:      0.92rem;   /* body and primary controls         */
        --db-fs-lg:      1.05rem;   /* emphasis, section values          */
        --db-fs-xl:      1.3rem;    /* chord symbols                     */
        --db-fs-display: 1.7rem;    /* headline numerals                 */

        --db-r-sm:   6px;    /* inputs, dense cells   */
        --db-r-md:   10px;   /* buttons, cards, panels */
        --db-r-pill: 999px;  /* chips and pills        */
      }

      /* ── Accessibility: visible keyboard focus ──────────────────────── */
      button:focus-visible,
      select:focus-visible,
      input:focus-visible,
      textarea:focus-visible,
      summary:focus-visible,
      [tabindex]:focus-visible {
        outline: 3px solid var(--db-accent);
        outline-offset: 2px;
        border-radius: 6px;
      }

      /* Respect a reduced-motion preference — kill transitions + animations */
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.001ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.001ms !important;
          scroll-behavior: auto !important;
        }
      }

      /* ── Mobile ─────────────────────────────────────────────────────── */
      .db-mobile-only { display: none; }

      @media (max-width: 720px) {
        .db-mobile-only { display: block; }

        /* Chord grid scrolls sideways rather than squashing to one column,
           so a 4-bar phrase still reads as a phrase on a phone. */
        .db-grid-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 6px;
        }
        .db-grid-scroll > div {
          min-width: max-content;
        }
        .db-grid-scroll .db-bar-card {
          min-width: 190px;
        }

        /* Control strips wrap tighter and stay thumb-friendly */
        .db-controls button,
        .db-controls select {
          min-height: 40px;
        }
      }

      /* Larger tap targets on any touch device, not just narrow ones */
      @media (pointer: coarse) {
        button, select { min-height: 38px; }
      }

      /* Hidden where there's no keyboard to shortcut with */
      @media (pointer: coarse), (max-width: 560px) {
        .db-pointer-fine-only { display: none !important; }
      }

      /* Workspace tabs go two-up on a phone instead of squeezing to four */
      @media (max-width: 560px) {
        .db-modebar [role="tab"] { flex: 1 1 calc(50% - 6px); min-width: 0; }
      }

      /* "Print chart" prints the all-keys reference on its own, as a clean
         sheet — everything else is hidden for that one print job. */
      @media print {
        body.db-printing-chart > * { display: none !important; }
        body.db-printing-chart .db-chartcard {
          display: block !important;
          position: absolute; left: 0; top: 0; width: 100%;
        }
        body.db-printing-chart .db-chartcard .db-noprint { display: none !important; }
        body.db-printing-chart main,
        body.db-printing-chart main > section { display: block !important; }
        body.db-printing-chart main > section > *:not(:has(.db-chartcard)) { display: none !important; }
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
        {/* The four bars sounding right now, pinned above every workspace. */}
        <GigBarStrip
          bars={bars}
          title={activeSongTitle || (selectedForm !== "Custom" ? selectedForm : null)}
          playheadIndex={playheadIndex}
          isPlaying={isPlaying}
          onStop={stopPlayback}
        />
        {/* Wraps and scales — at 390px this used to run the title onto two
            lines and push Shortcuts and the sync control off-screen entirely. */}
        <div style={{
          marginBottom: "8px", display: "flex", alignItems: "center",
          gap: "10px", rowGap: "8px", flexWrap: "wrap",
        }}>
          <h1 style={{
            fontSize: "clamp(1.5rem, 7vw, 2.5rem)", margin: 0,
            color: "var(--db-accent)", whiteSpace: "nowrap", lineHeight: 1.1,
          }}>
            The DukeBox
          </h1>
          <button
            onClick={() => setPaletteIndex((i) => (i + 1) % PALETTES.length)}
            style={{
              padding: "6px 14px", borderRadius: "var(--db-r-md)", cursor: "pointer", fontWeight: 600, fontSize: "var(--db-fs-md)",
              border: "1px solid var(--db-panel-border)",
              background: "var(--db-panel-bg)",
              color: "var(--db-accent)",
              flexShrink: 0,
            }}
            title="Cycle color palette"
          >
            🎨 {palette.name}
          </button>

          {/* Keyboard shortcuts are meaningless on a touch device — hidden there
              rather than competing for the little horizontal room a phone has. */}
          <button
            onClick={() => setShowShortcuts(true)}
            className="db-pointer-fine-only"
            style={{
              padding: "6px 12px", borderRadius: "var(--db-r-md)", cursor: "pointer", fontWeight: 700, fontSize: "var(--db-fs-sm)",
              border: "1px solid var(--db-panel-border)", background: "var(--db-panel-bg)", color: "var(--db-muted)",
              flexShrink: 0,
            }}
            title="Keyboard shortcuts (press ?)"
          >
            ⌘ Shortcuts
          </button>

          <SyncControl auth={auth} syncStatus={syncStatus} style={{ marginLeft: "auto" }} />

          <BuildStamp />
        </div>

        {/* ── Workspace switcher ─────────────────────────────────── */}
        <div
          role="tablist"
          aria-label="Workspace"
          className="db-modebar"
          style={{
            display: "flex", gap: "6px", flexWrap: "wrap",
            marginBottom: "10px", padding: "5px",
            borderRadius: "var(--db-r-md)",
            background: "var(--db-panel-bg)",
            border: "1px solid var(--db-panel-border)",
          }}
        >
          {MODES.map(m => {
            const on = mode === m.id
            return (
              <button
                key={m.id}
                role="tab"
                aria-selected={on}
                onClick={() => chooseMode(m.id)}
                title={m.blurb}
                style={{
                  flex: "1 1 auto", minWidth: "112px",
                  padding: "9px 14px", borderRadius: "var(--db-r-md)", cursor: "pointer",
                  fontWeight: 700, fontSize: "var(--db-fs-md)",
                  border: on ? "1px solid var(--db-accent)" : "1px solid transparent",
                  background: on ? "color-mix(in srgb, var(--db-accent) 16%, var(--db-bg))" : "transparent",
                  color: on ? "var(--db-accent)" : "var(--db-text)",
                  opacity: on ? 1 : 0.72,
                }}
              >
                <span aria-hidden="true" style={{ marginRight: "6px" }}>{m.icon}</span>{m.label}
              </button>
            )
          })}
        </div>
        <p style={{ opacity: 0.7, marginBottom: "20px", fontSize: "var(--db-fs-md)" }}>
          {MODES.find(m => m.id === mode)?.blurb}
        </p>

        {inMode("gig") && (
          <div style={{ marginBottom: "20px" }}>
            <GigMode
              library={library}
              setLibrary={setLibrary}
              onLoadSong={loadGigSong}
              activeSongId={activeGigSongId}
              playheadIndex={playheadIndex}
              isPlaying={isPlaying}
              onStop={stopPlayback}
              panelStyle={panelStyle}
              eyebrowStyle={eyebrowStyle}
              selectStyle={selectStyle}
            />

            {/* Song Crafter sits with the Gig Book: the book is the tunes you
                already have, the crafter is where the next one comes from.
                It still hands finished charts to Practice, where they can be
                edited — the floating bar strip keeps the playhead visible on
                the way over. */}
            <div style={{ marginTop: "16px" }}>
              <SongCrafter
                onSendToChart={({ bars, keyRoot, keyMode, title }) =>
                  // Jump to Practice — otherwise it autoplays a chart you can't see.
                  loadGigSong({ bars, keyRoot, keyMode, tempo: originalTempo, autoplay: true, songId: null, title, toMode: "practice" })
                }
                panelStyle={panelStyle}
                eyebrowStyle={eyebrowStyle}
                selectStyle={selectStyle}
              />
            </div>
          </div>
        )}

        {/* ── Tonal ─────────────────────────────────────────────────
            Embedded untouched from its own deployment. Everything inside
            the frame is Tonal's — DukeBox neither styles nor drives it. */}
        {inMode("tonal") && (
          <div style={{ ...panelStyle, marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px", flexWrap: "wrap" }}>
              <div style={{ ...eyebrowStyle, marginBottom: 0 }}>TONAL</div>
              <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.6 }}>
                The live app, exactly as published — nothing here modifies it
              </div>
              <a
                href={TONAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  marginLeft: "auto",
                  padding: "6px 12px", borderRadius: "var(--db-r-md)",
                  border: "1px solid var(--db-panel-border)", background: "var(--db-panel-bg)",
                  color: "var(--db-accent)", fontSize: "var(--db-fs-sm)", fontWeight: 600,
                  textDecoration: "none",
                }}
                title="Open Tonal in its own browser tab"
              >
                Open in a new tab ↗
              </a>
            </div>

            <iframe
              src={TONAL_URL}
              title="Tonal"
              // No sandbox attribute: Tonal needs its own storage and audio,
              // and sandboxing would break the app we're deliberately not touching.
              allow="autoplay; fullscreen; microphone"
              style={{
                width: "100%", height: "min(82vh, 900px)", minHeight: "520px",
                border: "1px solid var(--db-panel-border)",
                borderRadius: "var(--db-r-md)",
                background: "#fff",
                display: "block",
              }}
            />

            <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, marginTop: "6px" }}>
              Not loading? Some browsers and extensions block embedded pages — use “Open in a new tab”.
            </div>
          </div>
        )}

        {/* ── Start Practicing Fast ─────────────────────────────── */}
        {inMode("practice") && <div style={{
          ...panelStyle,
          marginBottom: "16px",
          border: "1px solid color-mix(in srgb, var(--db-c-green) 30%, transparent)",
          background: "color-mix(in srgb, var(--db-c-green) 5%, var(--db-bg))",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <div style={{ ...eyebrowStyle, marginBottom: 0, color: "var(--db-c-green)" }}>START PRACTICING</div>
          </div>
          <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.6, marginBottom: "12px" }}>
            Load a starter chart and begin at slow tempo — ideal for building muscle memory
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {STARTER_PRESETS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => loadStarter(id)}
                style={{
                  padding: "7px 12px", borderRadius: "var(--db-r-md)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
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
        </div>}

        {/* ── AI Chart Generator ────────────────────────────────── */}
        {inMode("write") && <div style={{
          ...panelStyle,
          marginBottom: "16px",
          border: "1px solid rgba(201,167,255,0.25)",
          background: "rgba(201,167,255,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <div style={{ ...eyebrowStyle, marginBottom: 0, color: "var(--db-c-purple)" }}>AI CHART GENERATOR</div>
            <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.62 }}>powered by Claude</div>
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
                borderRadius: "var(--db-r-md)",
                border: "1px solid rgba(201,167,255,0.2)",
                background: "var(--db-input-bg)",
                color: "var(--db-text)",
                fontSize: "var(--db-fs-md)",
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

          {/* Templates + Surprise me + prompt history */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", marginTop: "8px" }}>
            <button
              onClick={surpriseMe}
              disabled={isGenerating}
              style={{
                padding: "4px 11px", borderRadius: "var(--db-r-pill)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
                border: "1px solid var(--db-c-purple)",
                background: "color-mix(in srgb, var(--db-c-purple) 14%, var(--db-bg))",
                color: "var(--db-c-purple)", fontWeight: 700,
                opacity: isGenerating ? 0.5 : 1,
              }}
              title="Generate a chart from a random form, key, mood, and harmonic device"
            >
              🎲 Surprise me
            </button>

            {PROMPT_TEMPLATES.map((t) => (
              <button
                key={t}
                onClick={() => setPromptText(t)}
                disabled={isGenerating}
                style={{
                  padding: "4px 10px", borderRadius: "var(--db-r-pill)", fontSize: "var(--db-fs-xs)", cursor: "pointer",
                  border: "1px solid var(--db-panel-border)", background: "var(--db-panel-bg)",
                  color: "var(--db-text)", opacity: isGenerating ? 0.5 : 0.85,
                }}
                title="Use this as a starting point"
              >
                {t.length > 34 ? t.slice(0, 33) + "…" : t}
              </button>
            ))}
          </div>

          {promptHistory.length > 0 && (
            <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "8px" }}>
              <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6 }} htmlFor="prompt-history">Recent</label>
              <select
                id="prompt-history"
                value=""
                onChange={(e) => { if (e.target.value) setPromptText(e.target.value) }}
                style={{ ...selectStyle, flex: 1, padding: "5px 8px", fontSize: "var(--db-fs-sm)" }}
              >
                <option value="">Re-use a previous prompt…</option>
                {promptHistory.map((p, i) => (
                  <option key={i} value={p}>{p.length > 70 ? p.slice(0, 69) + "…" : p}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, marginTop: "6px" }}>
            ⌘ + Enter to generate
          </div>

          {generationError && (
            <div style={{
              marginTop: "10px", padding: "10px 12px", borderRadius: "var(--db-r-md)",
              background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.3)",
              color: "#ff8a8a", fontSize: "var(--db-fs-md)",
            }}>
              {generationError}
            </div>
          )}

          {(generationNotes || isGenerating) && (
            <div style={{ marginTop: "10px" }}>
              <button
                onClick={() => setShowGenNotes((p) => !p)}
                style={{
                  background: "none", border: "none", color: "var(--db-c-purple)",
                  cursor: "pointer", fontSize: "var(--db-fs-sm)", padding: "0", opacity: 0.8,
                }}
              >
                {showGenNotes ? "▼" : "▶"} Generation Notes
                {isGenerating && <span style={{ marginLeft: "6px", opacity: 0.75 }}>· writing…</span>}
              </button>
              {showGenNotes && (
                <div style={{
                  marginTop: "6px", padding: "10px 12px", borderRadius: "var(--db-r-md)",
                  background: "rgba(201,167,255,0.07)", border: "1px solid rgba(201,167,255,0.15)",
                  fontSize: "var(--db-fs-md)", lineHeight: 1.6, opacity: 0.9,
                }}>
                  {generationNotes || "…"}
                  {isGenerating && generationNotes && (
                    <span style={{ opacity: 0.6 }} aria-hidden="true"> ▍</span>
                  )}
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
        </div>}

        {/* ── Song Settings ─────────────────────────────────────── */}
        {inMode("practice","write") && <div style={{ ...panelStyle, marginBottom: "16px" }}>
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

            <SongSearch
              formCategories={FORM_CATEGORIES}
              userLibrary={userLibrary}
              gigSongs={GIGBOOK_SONGS}
              selectedForm={selectedForm}
              onPick={loadSearchPick}
            />

            {userLibrary.some((e) => e.name === selectedForm) && (
              <button
                onClick={() => removeFromLibrary(selectedForm)}
                style={{ ...buttonStyle("#ff8a8a", "#200a0a"), padding: "6px 10px", fontSize: "var(--db-fs-sm)" }}
                title="Remove this chart from your library"
              >
                × Remove
              </button>
            )}

            <button
              onClick={() => exportLeadSheet({ bars, title: selectedForm, tempo: originalTempo }).catch(console.error)}
              style={{ ...neutralButtonStyle, padding: "6px 12px", fontSize: "var(--db-fs-sm)" }}
              title="Export lead sheet as PDF (Real Book style)"
            >
              ↓ Lead Sheet PDF
            </button>

            <button
              onClick={() => exportMusicXML({ bars, approachLines, title: selectedForm, tempo: originalTempo })}
              style={{ ...neutralButtonStyle, padding: "6px 12px", fontSize: "var(--db-fs-sm)" }}
              title="Export as MusicXML — open in MuseScore, Sibelius, Finale, etc."
            >
              ↓ MusicXML
            </button>

            <button
              onClick={() => downloadImprovGuide({ bars, title: selectedForm, keyRoot, keyMode, tempo: originalTempo })}
              style={{ ...neutralButtonStyle, padding: "6px 12px", fontSize: "var(--db-fs-sm)" }}
              title="Export a 5-level improv guide as markdown — scales, triad pairs, bebop cells, voice leading per chord"
            >
              ↓ Improv Guide
            </button>

            <button
              onClick={async () => {
                const token = prompt("Notion integration token (used once, never stored):")
                if (!token?.trim()) return
                try {
                  const payload = buildImprovMapData({ bars, title: selectedForm, keyRoot, keyMode, tempo: originalTempo })
                  const res = await fetch("/api/export-notion", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: token.trim(), ...payload }),
                  })
                  const data = await res.json()
                  if (data.error) throw new Error(data.error)
                  alert(`Exported to Notion${data.url ? `:\n${data.url}` : ""}`)
                } catch (err) {
                  alert(`Notion export failed: ${err.message}`)
                }
              }}
              style={{ ...neutralButtonStyle, padding: "6px 12px", fontSize: "var(--db-fs-sm)" }}
              title="Create a Notion page with the improv map — summary table + per-bar collapsible roadmap"
            >
              → Notion
            </button>

            <button
              onClick={() => { setShowImportModal(true); setImportText(""); setImportStatus(null) }}
              style={{ ...neutralButtonStyle, padding: "6px 12px", fontSize: "var(--db-fs-sm)" }}
              title="Import songs you saved in Bebop Blueprint — paste localStorage['userBebopProgressions']"
            >
              ⇪ Import BB Songs
            </button>

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

          {/* Bebop Blueprint song importer */}
          {showImportModal && (
            <div style={{
              marginTop: "12px", padding: "14px", borderRadius: "var(--db-r-md)",
              border: "1px solid var(--db-c-blue)",
              background: "color-mix(in srgb, var(--db-c-blue) 5%, var(--db-bg))",
            }}>
              <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.75, marginBottom: "8px", lineHeight: 1.5 }}>
                In Bebop Blueprint, open DevTools → Console and run{" "}
                <code style={{ background: "var(--db-input-bg)", padding: "1px 5px", borderRadius: "var(--db-r-sm)" }}>
                  copy(localStorage.getItem(&#39;userBebopProgressions&#39;))
                </code>
                {" "}— then paste here. Your saved songs become DukeBox library entries.
              </div>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='{"My Custom Song": { "parts": [...], "splitStatus": [...], "defaultKey": "C", ... }}'
                style={{
                  width: "100%", minHeight: "90px", padding: "10px", borderRadius: "var(--db-r-md)",
                  border: "1px solid var(--db-panel-border)", background: "var(--db-input-bg)",
                  color: "var(--db-text)", fontSize: "var(--db-fs-sm)", fontFamily: "monospace",
                  boxSizing: "border-box", resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: "8px", marginTop: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={() => {
                    try {
                      const { entries, warnings } = parseTonalUserSongs(importText)
                      const stamped = entries.map(e => ({ ...e, updatedAt: Date.now() }))
                      setLibrary(lib => ({
                        ...lib,
                        songs: [...lib.songs.filter(e => !stamped.some(n => n.name === e.name)), ...stamped],
                      }))
                      setImportStatus({ ok: true, msg: `Imported ${entries.length} song${entries.length === 1 ? "" : "s"}${warnings.length ? ` · ${warnings.join("; ")}` : ""}` })
                      setImportText("")
                    } catch (err) {
                      setImportStatus({ ok: false, msg: err.message })
                    }
                  }}
                  disabled={!importText.trim()}
                  style={{ ...buttonStyle("var(--db-c-green)"), padding: "6px 14px", fontSize: "var(--db-fs-sm)", opacity: importText.trim() ? 1 : 0.5 }}
                >
                  Import
                </button>
                <button
                  onClick={() => setShowImportModal(false)}
                  style={{ ...buttonStyle("var(--db-muted)"), padding: "6px 14px", fontSize: "var(--db-fs-sm)" }}
                >
                  Close
                </button>
                {importStatus && (
                  <span style={{ fontSize: "var(--db-fs-sm)", color: importStatus.ok ? "var(--db-c-green)" : "#ff8a8a" }}>
                    {importStatus.msg}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>}

        {inMode("practice","write") && <div style={panelStyle}>
          {/* ── Section 1: Playback & Practice ─────────────────────── */}
          <div style={{ marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "8px", flexWrap: "wrap" }}>
              <div style={{ ...eyebrowStyle, marginBottom: 0 }}>PLAYBACK &amp; PRACTICE</div>
              {/* Find a tune without leaving the bench — same index as Gig Mode's
                  search, so the Gig Book is reachable from here too. */}
              <div style={{ display: "flex", flex: "1 1 240px", maxWidth: "420px", marginLeft: "auto" }}>
                <SongSearch
                  formCategories={FORM_CATEGORIES}
                  userLibrary={userLibrary}
                  gigSongs={GIGBOOK_SONGS}
                  selectedForm={selectedForm}
                  onPick={loadSearchPick}
                  placeholder="Search songs, Gig Book, your library…"
                />
              </div>
            </div>

            <div style={{ marginBottom: "10px" }}>
              <PracticeTimer
                inlineLabelStyle={inlineLabelStyle}
                selectStyle={selectStyle}
                onState={setTimerState}
                onFinish={({ stopBand }) => {
                  if (stopBand && playingRef.current) stopPlayback()
                  showToast("Practice timer finished")
                }}
              />
            </div>

            <div className="db-controls" style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  ref={transportRef}
                  onClick={isPlaying ? stopPlayback : () => startPlayback().catch(console.error)}
                  aria-label={isPlaying ? "Stop playback" : "Start playback"}
                  style={{
                    padding: "11px 28px", borderRadius: "var(--db-r-md)", cursor: "pointer",
                    fontWeight: 800, fontSize: "var(--db-fs-lg)", letterSpacing: "0.02em",
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
                    padding: "9px 16px", borderRadius: "var(--db-r-md)", cursor: "pointer", fontWeight: 700, fontSize: "var(--db-fs-md)",
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
                  <span style={{ minWidth: "28px", fontSize: "var(--db-fs-sm)", opacity: 0.8 }}>
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
                    style={{ ...selectStyle, width: "auto", padding: "5px 8px", fontSize: "var(--db-fs-sm)" }}
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
                  <span style={{ opacity: 0.7 }}>Bassist</span>
                  <select
                    value={bassStyle}
                    onChange={(e) => setBassStyle(e.target.value)}
                    style={{ ...selectStyle, width: "auto", padding: "5px 8px", fontSize: "var(--db-fs-sm)" }}
                  >
                    {BASS_STYLE_NAMES.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </label>

                {bassStyle !== "Classic DukeBox" && (
                  <label style={inlineLabelStyle} title="Line complexity — low = 2-feel, high = busy walking with passing tones">
                    <span style={{ opacity: 0.7 }}>Complexity</span>
                    <input
                      type="range" min="0" max="100"
                      value={Math.round(bassComplexity * 100)}
                      onChange={(e) => setBassComplexity(Number(e.target.value) / 100)}
                      style={{ width: "70px" }}
                    />
                    <span style={{ minWidth: "28px", fontSize: "var(--db-fs-sm)", opacity: 0.8 }}>
                      {Math.round(bassComplexity * 100)}%
                    </span>
                  </label>
                )}

                <label style={inlineLabelStyle}>
                  <input type="checkbox" checked={playDrums} onChange={(e) => setPlayDrums(e.target.checked)} />
                  {/* Named like the other instruments — this used to show only the
                      style name ("Jazz Ride"), so it didn't read as the drums toggle. */}
                  Drums
                  <button
                    onClick={() => setDrumStyleIdx(i => (i + 1) % DRUM_STYLES.length)}
                    style={{
                      ...buttonStyle(playDrums ? "var(--db-c-amber)" : "var(--db-muted)"),
                      padding: "3px 10px", fontSize: "var(--db-fs-sm)", fontWeight: 600,
                    }}
                    title="Click to cycle through drum styles"
                  >
                    🥁 {DRUM_STYLES[drumStyleIdx].name}
                  </button>
                  <select
                    value={drumKit}
                    onChange={(e) => setDrumKit(e.target.value)}
                    style={{ ...selectStyle, width: "auto", padding: "4px 6px", fontSize: "var(--db-fs-sm)" }}
                    title="Drum kit — sample set for the drum voices"
                  >
                    {DRUM_KIT_NAMES.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </label>

                <label style={inlineLabelStyle} title="Reverb send for piano and drums — takes effect on the next Play">
                  Reverb
                  <input
                    type="range" min="0" max="100"
                    value={Math.round(reverbAmount * 100)}
                    onChange={(e) => setReverbAmount(Number(e.target.value) / 100)}
                    style={{ width: "60px" }}
                  />
                  <span style={{ minWidth: "28px", fontSize: "var(--db-fs-sm)", opacity: 0.8 }}>
                    {Math.round(reverbAmount * 100)}%
                  </span>
                </label>

                <label style={inlineLabelStyle}>
                  <input type="checkbox" checked={playMelody} onChange={(e) => setPlayMelody(e.target.checked)} />
                  Melody
                </label>
              </div>

              <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.55, marginTop: "6px" }}>
                Every control here is live — tempo, swing, mutes, styles, kit, and reverb all
                take effect while the band keeps playing.
              </div>
          </div>

          {/* ── Section 2: Chart Navigation & Loop ─────────────────── */}
          <div style={{ marginBottom: "12px" }}>
            <div
              onClick={() => toggleControlPanel("chart")}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: "8px" }}
            >
              <div style={{ ...eyebrowStyle, marginBottom: 0 }}>CHART NAVIGATION & LOOP</div>
              <span style={{ fontSize: "var(--db-fs-xs)", opacity: 0.5 }}>{openControlPanels.chart ? "▼" : "▶"}</span>
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

          {/* ── Runway — color-coded chord strip with per-bar progress fill ── */}
          <div style={{ marginBottom: "12px" }}>
            <div style={{ ...eyebrowStyle, marginBottom: "4px" }}>RUNWAY</div>
            <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.55, marginBottom: "6px" }}>
              Chord timeline by function — green major · blue minor · red dominant · purple ø · gold ° · dark-red altered
            </div>
            <Runway
              bars={bars}
              playheadIndex={playheadIndex}
              tempo={practiceMode ? 50 : tempo}
              onSelectBar={setSelectedIndex}
            />
          </div>

          <div style={eyebrowStyle}>MELODY LANE</div>
          <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.55, marginBottom: "8px", marginTop: "-4px" }}>
            7→3 guide-tone voice leading — arrival note (red) and departure note (green) per bar
          </div>

          <NotationLane
            bars={notationBars}
            activeIndex={selectedIndex}
            onSelectBar={setSelectedIndex}
            playheadIndex={playheadIndex}
            barLabels={barLabels}
          />

          <div style={{ marginTop: "8px", fontSize: "var(--db-fs-md)", opacity: 0.7 }}>
            Loop range: bars {Math.min(loopStart, loopEnd) + 1} to {Math.max(loopStart, loopEnd) + 1}
          </div>
        </div>}

        {showFretboard && inMode("practice","write") && (
          <div style={{ ...panelStyle, marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px", flexWrap: "wrap" }}>
              <div style={{ ...eyebrowStyle, marginBottom: 0 }}>FRETBOARD</div>

              {/* View: Chord / Scale */}
              <div style={{ display: "flex", gap: "4px" }}>
                {["chord", "scale"].map((v) => (
                  <button key={v} onClick={() => setFretboardView(v)} style={{
                    padding: "4px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
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
                {[
                  ["pentatonic", "Pentatonic"],
                  ["hexatonic",  "Hexatonic"],
                  ["martino",    "Martino"],
                  ["hexchord",   "Hex·Chord"],
                  ["barry",      "Barry 6th"],
                ].map(([f, label]) => (
                  <button key={f} onClick={() => {
                    // Turning a filter on implies you want to see the scale, not the chord
                    setScaleFilter(prev => {
                      const next = prev === f ? null : f
                      if (next) setFretboardView("scale")
                      return next
                    })
                  }} style={{
                    padding: "4px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
                    background: scaleFilter === f ? "color-mix(in srgb, var(--db-c-blue) 20%, var(--db-bg))" : "var(--db-panel-bg)",
                    border:     scaleFilter === f ? "1px solid var(--db-c-blue)" : "1px solid var(--db-panel-border)",
                    color:      scaleFilter === f ? "var(--db-c-blue)" : "var(--db-text)",
                    fontWeight: scaleFilter === f ? 700 : 400,
                    opacity:    scaleFilter === f ? 1 : 0.7,
                  }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Additive overlays */}
              <div style={{ display: "flex", gap: "4px" }}>
                <button onClick={() => setBebopOverlay(p => !p)} style={{
                  padding: "4px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
                  background: bebopOverlay ? "rgba(86,197,104,0.22)" : "var(--db-panel-bg)",
                  border:     bebopOverlay ? "1px solid #56C568" : "1px solid var(--db-panel-border)",
                  color:      bebopOverlay ? "#56C568" : "var(--db-text)",
                  fontWeight: bebopOverlay ? 700 : 400,
                  opacity:    bebopOverlay ? 1 : 0.7,
                }}>
                  +Bebop Chromatic
                </button>
                <button onClick={() => setTargetsOverlay(p => !p)} style={{
                  padding: "4px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
                  background: targetsOverlay ? "rgba(255,213,79,0.22)" : "var(--db-panel-bg)",
                  border:     targetsOverlay ? "1px solid #FFD54F" : "1px solid var(--db-panel-border)",
                  color:      targetsOverlay ? "#c49800" : "var(--db-text)",
                  fontWeight: targetsOverlay ? 700 : 400,
                  opacity:    targetsOverlay ? 1 : 0.7,
                }}>
                  +Guide Tones
                </button>
                <button onClick={() => setAnticipateOn(p => !p)} style={{
                  padding: "4px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
                  background: anticipateOn ? "color-mix(in srgb, var(--db-c-purple) 20%, var(--db-bg))" : "var(--db-panel-bg)",
                  border:     anticipateOn ? "1px solid var(--db-c-purple)" : "1px solid var(--db-panel-border)",
                  color:      anticipateOn ? "var(--db-c-purple)" : "var(--db-text)",
                  fontWeight: anticipateOn ? 700 : 400,
                  opacity:    anticipateOn ? 1 : 0.7,
                }} title="Show a second fretboard with the NEXT chord's tones and guide tones — see the change coming">
                  Anticipate
                </button>
              </div>

              <select
                value={fretboardTuning}
                onChange={(e) => setFretboardTuning(e.target.value)}
                style={{ ...selectStyle, width: "auto", padding: "4px 8px", fontSize: "var(--db-fs-sm)" }}
              >
                {TUNING_NAMES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              {/* Now-playing readout. This used to be muted 0.92rem text tucked
                  in the corner — the one thing you actually need to read from a
                  music stand, in the smallest type on the panel. */}
              {(() => {
                const scaleLabel =
                  martinoMap
                    ? `Martino → ${martinoMap.displayRoot}m${martinoMap.displayQuality === "min7b5" ? " (melodic)" : ""}`
                    : scaleFilter === "hexchord"
                    ? hexChoiceForChord(fretboardBar.userTonic ?? fretboardBar.root, fretboardBar.quality).label
                    : scaleFilter === "barry"
                    ? `Barry 6th-Dim (${barryHarrisScale(fretboardBar.userTonic ?? fretboardBar.root, fretboardBar.quality).family})`
                    : (scaleFilter ?? fretboardScaleData[0]?.name ?? "")
                const scaleTonic = fretboardBar.userTonic ?? fretboardBar.root
                const isLive = isPlaying && playheadIndex !== null
                return (
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "stretch", gap: "10px" }}>
                  {/* Clock mirrored from the practice timer — read-only, so you
                      can watch the time without looking away from the neck.
                      Controls stay in the Playback & Practice panel. */}
                  {timerState && (() => {
                    const { seconds, running, done, duration } = timerState
                    const urgent = done || (running && seconds <= 10)
                    // "Paused" only means something once it has actually run.
                    const label = done ? "TIME" : running ? "TIMER" : seconds < duration ? "PAUSED" : "TIMER"
                    const tColor = urgent ? "var(--db-c-salmon)" : running ? "var(--db-c-green)" : "var(--db-muted)"
                    return (
                      <div
                        title="Practice timer — set it in Playback & Practice"
                        style={{
                          display: "flex", flexDirection: "column", justifyContent: "center",
                          textAlign: "right", lineHeight: 1.1,
                          padding: "8px 14px", borderRadius: "var(--db-r-md)",
                          border: `2px solid color-mix(in srgb, ${tColor} ${running || done ? "100%" : "40%"}, transparent)`,
                          background: running || done
                            ? `color-mix(in srgb, ${tColor} 12%, var(--db-bg))`
                            : "var(--db-panel-bg)",
                          opacity: running || done ? 1 : 0.7,
                        }}
                      >
                        <div style={{ fontSize: "var(--db-fs-xs)", letterSpacing: "0.12em", opacity: 0.7, marginBottom: "3px" }}>
                          {label}
                        </div>
                        <div style={{
                          fontSize: "1.8rem", fontWeight: 800, fontVariantNumeric: "tabular-nums",
                          color: tColor,
                        }}>
                          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
                        </div>
                      </div>
                    )
                  })()}
                  <div
                    aria-live="polite"
                    style={{
                      textAlign: "right", lineHeight: 1.1,
                      padding: "8px 16px", borderRadius: "var(--db-r-md)",
                      border: `2px solid ${isLive ? "var(--db-c-green)" : "var(--db-c-amber)"}`,
                      background: isLive
                        ? "color-mix(in srgb, var(--db-c-green) 14%, var(--db-bg))"
                        : "color-mix(in srgb, var(--db-c-amber) 10%, var(--db-bg))",
                      boxShadow: isLive
                        ? "0 0 16px color-mix(in srgb, var(--db-c-green) 30%, transparent)"
                        : "none",
                      minWidth: "180px",
                    }}
                  >
                    <div style={{ fontSize: "var(--db-fs-xs)", letterSpacing: "0.12em", opacity: 0.7, marginBottom: "3px" }}>
                      {isLive ? "NOW PLAYING" : "SELECTED"} · BAR {barLabels[fretboardBarIndex] ?? fretboardBarIndex + 1}
                    </div>
                    <div style={{
                      fontSize: "2.4rem", fontWeight: 800, letterSpacing: "-0.01em",
                      color: isLive ? "var(--db-c-green)" : "var(--db-c-amber)",
                    }}>
                      {fretboardBar.symbol}
                    </div>
                    <div style={{ fontSize: "var(--db-fs-lg)", fontWeight: 700, marginTop: "3px", color: "var(--db-c-blue)" }}>
                      {scaleLabel
                        ? (martinoMap || scaleFilter === "hexchord" || scaleFilter === "barry"
                            ? scaleLabel
                            : `${scaleTonic} ${scaleLabel}`)
                        : "—"}
                    </div>
                    {displayedScaleNotes.length > 0 && (
                      <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.75, marginTop: "3px", letterSpacing: "0.04em" }}>
                        {displayedScaleNotes.join(" · ")}
                      </div>
                    )}
                  </div>
                  </div>
                )
              })()}
            </div>

            <div className="db-mobile-only" style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, marginBottom: "4px" }}>
              Swipe the neck sideways to reach the upper frets · pinch to zoom
            </div>
            <div style={{ overflowX: "auto", marginBottom: "4px" }}>
              <Fretboard
                chordNotes={fretboardInfo.notes || []}
                rootNote={martinoMap ? martinoMap.displayRoot : (fretboardBar.userTonic ?? fretboardBar.root)}
                scaleNotes={displayedScaleNotes}
                targetNotes={[]}
                passingNotes={[...bebopPassingNotes, ...barryPassingNotes]}
                guideToneNotes={guideToneDisplayNotes}
                guideToneDirections={guideToneDirections}
                view={fretboardView}
                tuningName={fretboardTuning}
              />
            </div>

            {/* Anticipate — the NEXT chord on its own board (loop-aware) */}
            {anticipateOn && anticipateBar && (
              <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed var(--db-panel-border)" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "4px" }}>
                  <div style={{ fontSize: "var(--db-fs-xs)", fontWeight: 700, letterSpacing: "0.12em", color: "var(--db-c-purple)" }}>
                    NEXT · BAR {barLabels[anticipateBarIndex] ?? anticipateBarIndex + 1}
                  </div>
                  <div style={{ fontSize: "var(--db-fs-lg)", fontWeight: 700 }}>{anticipateBar.symbol}</div>
                  <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.55 }}>
                    guide tones {(targets[anticipateBarIndex]?.currentGuideTones || []).join(" / ") || "—"}
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <Fretboard
                    chordNotes={anticipateInfo.notes || []}
                    rootNote={anticipateBar.userTonic ?? anticipateBar.root}
                    scaleNotes={[]}
                    targetNotes={[]}
                    passingNotes={[]}
                    guideToneNotes={targets[anticipateBarIndex]?.currentGuideTones || []}
                    view="chord"
                    tuningName={fretboardTuning}
                  />
                </div>
              </div>
            )}

            <div style={{ marginTop: "8px", display: "flex", gap: "14px", fontSize: "var(--db-fs-sm)", flexWrap: "wrap" }} >
              <span style={{ opacity: 0.7 }}><span style={{ color: "#BD2031" }}>●</span> Root</span>
              <span style={{ opacity: 0.7 }}><span style={{ color: "#3A9C5A" }}>●</span> Chord tone</span>
              <span style={{ opacity: 0.7 }}><span style={{ color: "#3A78C9" }}>●</span> Scale tone</span>
              <span style={{ opacity: bebopOverlay || scaleFilter === "barry" ? 0.85 : 0.4 }}>
                <span style={{ color: "#56C568" }}>●</span> {scaleFilter === "barry" ? "Barry passing tone" : "Bebop passing"}
              </span>
              <span style={{ opacity: targetsOverlay ? 0.85 : 0.4 }}><span style={{ color: "#FFD54F" }}>●</span> Guide tones</span>
              {targetsOverlay && anticipateOn && (
                <span style={{ opacity: 0.85, color: "#FFD54F" }}>
                  → up a semitone · →→ up a whole tone · ← ←← down · = stays
                </span>
              )}
              <span style={{ opacity: 0.7 }}><span style={{ color: "#E09B3D" }}>●</span> Target note</span>
            </div>
          </div>
        )}

        {inMode("practice","write") && <div style={panelStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <div style={{ ...eyebrowStyle, marginBottom: 0 }}>LEAD SHEET GRID</div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <span style={{ fontSize: "var(--db-fs-sm)", opacity: 0.62, marginRight: "2px" }}>cols:</span>
              {[2, 3, 4, 6, 8].map(n => (
                <button key={n} onClick={() => setGridColumns(n)}
                  aria-label={`Show ${n} bars per row`}
                  aria-pressed={gridColumns === n}
                  style={{
                  padding: "3px 8px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
                  background: gridColumns === n ? "rgba(224,180,76,0.18)" : "var(--db-card-bg)",
                  border: gridColumns === n ? "1px solid var(--db-c-amber)" : "1px solid var(--db-card-border)",
                  color: gridColumns === n ? "var(--db-c-amber)" : "var(--db-muted)",
                  fontWeight: gridColumns === n ? 700 : 400,
                }}>{n}</button>
              ))}
              <button onClick={() => setScrollMode(p => !p)} style={{
                padding: "3px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
                background: scrollMode ? "rgba(127,200,255,0.18)" : "var(--db-card-bg)",
                border: scrollMode ? "1px solid var(--db-c-blue)" : "1px solid var(--db-card-border)",
                color: scrollMode ? "var(--db-c-blue)" : "var(--db-muted)",
                fontWeight: scrollMode ? 700 : 400,
                marginLeft: "4px",
              }}>📜 Scroll</button>
              <button
                onClick={() => setShowBarDetails(p => !p)}
                style={{
                  padding: "3px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
                  background: showBarDetails ? "rgba(201,167,255,0.18)" : "var(--db-card-bg)",
                  border: showBarDetails ? "1px solid var(--db-c-purple)" : "1px solid var(--db-card-border)",
                  color: showBarDetails ? "var(--db-c-purple)" : "var(--db-muted)",
                  fontWeight: showBarDetails ? 700 : 400,
                }}
                title="Show harmonic function, cadence, intervals, and chord spelling on every bar"
              >🔬 Details</button>
              <button
                onClick={copyChartAsText}
                style={{
                  padding: "3px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
                  background: "var(--db-card-bg)", border: "1px solid var(--db-card-border)",
                  color: "var(--db-muted)",
                }}
                title="Copy the changes as plain text: | Dm7 | G7 | Cmaj7 |"
              >⧉ Copy text</button>
              <button
                onClick={() => addBar(bars.length - 1)}
                style={{
                  padding: "3px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
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
                <div style={{ position: "relative", height: `${TELE_ROW_H}px`, overflow: "hidden", borderRadius: "var(--db-r-md)" }}>
                  <div style={{
                    position: "absolute", top: 0, zIndex: 2, pointerEvents: "none",
                    left: `calc(${(teleColIdx / gridColumns) * 100}% + 4px)`,
                    width: `calc(${(1 / gridColumns) * 100}% - 8px)`,
                    height: `${TELE_ROW_H}px`,
                    borderRadius: "var(--db-r-md)",
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
                                borderRadius: "var(--db-r-md)",
                                background: isPlayhead ? "rgba(139,211,168,0.1)" : isActive ? "rgba(224,180,76,0.08)" : "var(--db-card-bg)",
                                border: isPlayhead ? "1px solid rgba(139,211,168,0.25)" : isActive ? "1px solid rgba(224,180,76,0.25)" : "1px solid var(--db-card-border)",
                                cursor: "pointer",
                                display: "flex", flexDirection: "column",
                                justifyContent: "center", alignItems: "center", textAlign: "center",
                                gap: "4px",
                              }}
                            >
                              <div style={{ fontSize: "var(--db-fs-display)", fontWeight: 700, lineHeight: 1.1,
                                color: isPlayhead ? "var(--db-c-green)" : isActive ? "var(--db-accent)" : "var(--db-text)" }}>
                                {bar.symbol}
                              </div>
                              <div style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-c-amber)", opacity: 0.85 }}>
                                {guide.length ? guide.join(" / ") : "—"}
                              </div>
                              {target?.targetNote && (
                                <div style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-c-blue)", opacity: 0.75 }}>
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
          <div className="db-grid-scroll">
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
              const { intervals: rawIntervals = [], notes: chordNotes = [] } = chordInfo(bar.symbol)
              const isPlayhead = index === playheadIndex
              const inLoop =
                index >= Math.min(loopStart, loopEnd) && index <= Math.max(loopStart, loopEnd)
              const roman = romanNumerals[index]
              const approachPill = APPROACH_PILLS[approachLines[index]?.approachType] || null

              const prevSection = index > 0 ? bars[index - 1].section : null
              const showSectionHeader = bar.section && bar.section !== prevSection

              const elements = []

              if (showSectionHeader) {
                elements.push(
                  <div
                    key={`section-${index}`}
                    style={{
                      gridColumn: "1 / -1",
                      fontSize: "var(--db-fs-sm)",
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
                    <span>{bar.section} SECTION</span>
                    {dnSectionMeta?.[bar.section]?.repeat > 1 && (
                      <span style={{ marginLeft: "8px", padding: "1px 7px", borderRadius: "var(--db-r-pill)", border: "1px solid var(--db-accent)", fontSize: "var(--db-fs-xs)", letterSpacing: "0.05em" }}>
                        ×{dnSectionMeta[bar.section].repeat}
                      </span>
                    )}
                    {dnSectionMeta?.[bar.section]?.note && (
                      <span style={{ marginLeft: "10px", fontWeight: 400, fontStyle: "italic", opacity: 0.7, letterSpacing: "0.02em", textTransform: "none" }}>
                        {dnSectionMeta[bar.section].note}
                      </span>
                    )}
                  </div>
                )
              }

              elements.push(
                <div
                  key={index}
                  className="db-bar-card"
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  onClick={() => setSelectedIndex(index)}
                  onDoubleClick={() => loopJustThisBar(index)}
                  title="Double-click to loop just this chord"
                  style={{
                    padding: "14px 12px",
                    borderRadius: "var(--db-r-md)",
                    // Playhead reads boldest, then selection, then loop range.
                    border: isPlayhead
                      ? "2px solid var(--db-c-green)"
                      : active
                      ? "2px solid var(--db-c-amber)"
                      : inLoop && loopEnabled
                      ? "1px solid var(--db-c-gold)"
                      : "1px solid var(--db-card-border)",
                    background: isPlayhead
                      ? "color-mix(in srgb, var(--db-c-green) 22%, var(--db-bg))"
                      : active
                      ? "rgba(224,180,76,0.12)"
                      : inLoop && loopEnabled
                      ? "color-mix(in srgb, var(--db-c-gold) 12%, var(--db-bg))"
                      : "var(--db-card-bg)",
                    boxShadow: dragIndex === index
                      ? "0 0 0 2px rgba(127,200,255,0.45)"
                      : isPlayhead
                      ? "0 0 16px color-mix(in srgb, var(--db-c-green) 45%, transparent)"
                      : "none",
                    cursor: "pointer",
                    position: "relative",
                    transition: "box-shadow 0.15s, background 0.15s",
                  }}
                >
                  {/* Bar header row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.62 }}>BAR {barLabels[index]}</div>
                      {(bar.beats ?? 4) === 2 && (
                        <div style={{
                          fontSize: "var(--db-fs-xs)", fontWeight: 700, padding: "1px 4px",
                          borderRadius: "var(--db-r-sm)", background: "rgba(127,200,255,0.15)",
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
                        aria-label={(bar.beats ?? 4) === 2
                          ? `Restore bar ${barLabels[index]} to a full measure`
                          : `Split bar ${barLabels[index]} into two half-bars`}
                        style={{
                          background: (bar.beats ?? 4) === 2 ? "rgba(127,200,255,0.1)" : "none",
                          border: (bar.beats ?? 4) === 2 ? "1px solid rgba(127,200,255,0.3)" : "none",
                          color: (bar.beats ?? 4) === 2 ? "var(--db-c-blue)" : "var(--db-muted)",
                          cursor: "pointer", fontSize: "var(--db-fs-xs)", padding: "0 4px", lineHeight: 1.6,
                          borderRadius: "var(--db-r-sm)",
                        }}
                        title={(bar.beats ?? 4) === 2 ? "Restore to full bar (4 beats)" : "Split into 2-beat half-bar"}
                      >
                        {(bar.beats ?? 4) === 2 ? "×2" : "÷2"}
                      </button>
                      {bars.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeBar(index) }}
                          aria-label={`Remove bar ${barLabels[index]}`}
                          style={{
                            background: "none", border: "none", color: "rgba(255,100,100,0.6)",
                            cursor: "pointer", fontSize: "var(--db-fs-md)", padding: "0 2px", lineHeight: 1,
                          }}
                          title="Remove bar"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Chord symbol */}
                  <div style={{ fontSize: "var(--db-fs-xl)", fontWeight: 700, marginBottom: showRomanNumerals ? "2px" : "8px" }}>
                    {bar.symbol}
                  </div>

                  {/* Roman numeral */}
                  {showRomanNumerals && (
                    <div style={{ fontSize: "var(--db-fs-md)", color: "var(--db-c-gold)", marginBottom: "8px", opacity: 0.9 }}>
                      {roman}
                    </div>
                  )}

                  {/* Approach-type pill — how this bar's line reaches the next chord */}
                  {approachPill && (
                    <div style={{
                      display: "inline-block", marginBottom: "6px",
                      fontSize: "var(--db-fs-xs)", fontWeight: 700, letterSpacing: "0.04em",
                      padding: "2px 7px", borderRadius: "var(--db-r-pill)",
                      background: `color-mix(in srgb, ${approachPill.color} 16%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${approachPill.color} 40%, transparent)`,
                      color: approachPill.color,
                    }} title={approachPill.hint}>
                      {approachPill.label}
                    </div>
                  )}

                  {/* Always-on essentials: guide tones + next target */}
                  <div style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-c-amber)", marginBottom: "3px" }}>
                    <span style={{ opacity: 0.7 }}>Guide Tones </span>{guide.length ? guide.join(" / ") : "—"}
                  </div>
                  <div style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-c-green)", marginBottom: "6px" }}>
                    <span style={{ opacity: 0.7 }}>Next Target </span>{target?.targetNote || "—"}
                  </div>

                  {/* Deeper analysis — collapsed by default to reduce first-run overload */}
                  {showBarDetails && (
                    <>
                      <div style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-c-salmon)", marginBottom: "3px" }}>
                        <span style={{ opacity: 0.7 }}>Harmonic Function </span>{context?.functionLabel || "—"}
                      </div>
                      <div style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-c-salmon)", marginBottom: "3px" }}>
                        <span style={{ opacity: 0.7 }}>Cadence </span>{context?.cadenceLabels?.join(", ") || "—"}
                      </div>
                      <div style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-c-blue)", marginBottom: "3px" }}>
                        <span style={{ opacity: 0.7 }}>Intervals </span>
                        {rawIntervals.length ? rawIntervals.map(formatInterval).join("  ") : "—"}
                      </div>
                      <div style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-c-purple)", marginBottom: "6px" }}>
                        <span style={{ opacity: 0.7 }}>Spelling </span>
                        {chordNotes.length ? chordNotes.join("  ") : "—"}
                      </div>
                    </>
                  )}

                  {/* Per-bar chord editor */}
                  <div style={{
                    marginBottom: "8px", paddingTop: "6px",
                    borderTop: "1px solid var(--db-card-border)",
                  }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, marginBottom: "3px" }}>CHORD</div>
                    {/* Quick-entry: type a chord symbol and press Enter */}
                    <input
                      placeholder="type e.g. Dm7, F#7alt, Am7/G"
                      defaultValue=""
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return
                        e.preventDefault()
                        const parsed = parseGigChord(e.target.value)
                        if (!parsed) { showToast(`Couldn't read "${e.target.value}"`); return }
                        updateBar(index, { root: parsed.root, quality: parsed.quality, bass: parsed.bass })
                        setSelectedIndex(index)
                        e.target.value = ""
                      }}
                      style={{
                        width: "100%", boxSizing: "border-box", marginBottom: "3px",
                        padding: "3px 5px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-xs)",
                        background: "var(--db-input-bg)", border: "1px dashed var(--db-card-border)",
                        color: "var(--db-text)",
                      }}
                    />
                    <div style={{ display: "flex", gap: "3px" }}>
                      <select
                        value={bar.root}
                        onChange={(e) => { updateBar(index, { root: e.target.value }); setSelectedIndex(index) }}
                        style={{
                          flex: 1, padding: "2px 3px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-xs)",
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
                          flex: 2, padding: "2px 3px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-xs)",
                          background: "var(--db-input-bg)", border: "1px solid var(--db-card-border)",
                          color: "var(--db-text)",
                        }}
                      >
                        {QUALITIES.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Per-bar tonic / scale override.
                      Every key and every scale is listed: the picker used to
                      offer only the two or three scales recommended for the
                      chord quality, which meant a legitimate choice like A
                      harmonic minor over the Bm7b5 of a minor ii-V-i simply
                      wasn't on the menu. The best fits still lead — ranked by
                      how much of the chord each scale actually contains. */}
                  {(() => {
                    const scaleTonic = bar.userTonic ?? bar.root
                    const ranked = rankScalesForChord(bar.symbol, bar.quality, scaleTonic)
                    const best = ranked.slice(0, 3)
                    return (
                      <div style={{
                        marginBottom: "8px", paddingTop: "6px",
                        borderTop: "1px solid var(--db-card-border)",
                      }}>
                        <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, marginBottom: "3px" }}>KEY &amp; SCALE</div>
                        <div style={{ display: "flex", gap: "3px" }} onClick={(e) => e.stopPropagation()}>
                          <select
                            value={bar.userTonic ?? ""}
                            onChange={(e) => updateBar(index, { userTonic: e.target.value || undefined })}
                            title="Play the scale from this key instead of the chord root"
                            style={{
                              flex: 1, padding: "2px 3px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-xs)",
                              background: "var(--db-input-bg)", border: "1px solid var(--db-card-border)",
                              color: bar.userTonic ? "var(--db-accent)" : "var(--db-muted)",
                            }}
                          >
                            <option value="">root ({bar.root})</option>
                            {ROOTS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <select
                            value={bar.userScale ?? ""}
                            onChange={(e) => updateBar(index, { userScale: e.target.value || undefined })}
                            title={`Scales ranked by fit over ${bar.symbol} from ${scaleTonic}`}
                            style={{
                              flex: 2, padding: "2px 3px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-xs)",
                              background: "var(--db-input-bg)", border: "1px solid var(--db-card-border)",
                              color: bar.userScale ? "var(--db-accent)" : "var(--db-muted)",
                            }}
                          >
                            <option value="">auto</option>
                            <optgroup label={`Best over ${bar.symbol} from ${scaleTonic}`}>
                              {best.map(r => (
                                <option key={`best-${r.name}`} value={r.name}>
                                  {r.name} · {Math.round(r.fit * 100)}%
                                </option>
                              ))}
                            </optgroup>
                            {SCALE_CATALOG.map(g => (
                              <optgroup key={g.group} label={g.group}>
                                {g.scales.map(s => <option key={`${g.group}-${s}`} value={s}>{s}</option>)}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Add bar button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); addBar(index) }}
                    style={{
                      width: "100%", padding: "4px 0",
                      background: "var(--db-card-bg)",
                      border: "1px dashed var(--db-card-border)",
                      borderRadius: "var(--db-r-sm)", color: "var(--db-muted)",
                      cursor: "pointer", fontSize: "var(--db-fs-sm)",
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
          </div>
          )}
        </div>}

        {inMode("practice","write") && <div style={panelStyle}>
          <div style={eyebrowStyle}>CONTINUOUS APPROACH LINE</div>
          <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.55, marginBottom: "8px", marginTop: "-4px" }}>
            7→3 guide-tone line across the full chart — the melodic skeleton bar by bar
          </div>
          <div style={{ fontSize: "var(--db-fs-lg)", lineHeight: 1.9, color: "var(--db-c-purple)" }}>
            {phrase.length ? phrase.join("  →  ") : "No phrase generated"}
          </div>
        </div>}

        {/* ── FRET FLOW ─────────────────────────────────────────────── */}
        {inMode("practice","reference") && (() => {
          // FRET_FLOW_SCALES and TUNING_NAMES are module-level constants (defined below Home()).
          const updateFFBoard = (idx, patch) =>
            setFretFlowBoards(prev => prev.map((b, i) => i === idx ? { ...b, ...patch } : b))

          return (
            <div style={panelStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
                <div style={{ ...eyebrowStyle, marginBottom: 0 }}>FRET FLOW</div>
                <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.55 }}>Static scale workout — choose up to 4 keys to practice</div>
                <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
                  {[1, 2, 3, 4].map(n => (
                    <button key={n} onClick={() => setFretFlowCount(n)} style={{
                      padding: "3px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
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
                  const notes = fretFlowScaleNotes(board.scale, board.root)
                  return (
                    <div key={idx} style={{
                      background: "var(--db-card-bg)",
                      border: "1px solid var(--db-card-border)",
                      borderRadius: "var(--db-r-md)",
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
                        <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.62, marginLeft: "auto" }}>
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

        {inMode("practice") && <MetronomePanel
          onBeforeStart={stopPlayback}
          panelStyle={panelStyle}
          eyebrowStyle={eyebrowStyle}
          selectStyle={selectStyle}
          inlineLabelStyle={inlineLabelStyle}
        />}

        {/* Line Lab — the merged lab (chart changes or triad-network presets),
            at the foot of the Practice bench under BeatForge. It drives the
            same rhythm section, so it shares the transport with everything
            above it. */}
        {inMode("practice") && <LineLab
          chartBars={bars}
          chartTitle={selectedForm}
          onStopPlayback={stopPlayback}
          playLineSection={playLineSection}
          panelStyle={panelStyle}
          eyebrowStyle={eyebrowStyle}
          selectStyle={selectStyle}
        />}

        {dnMeta && inMode("practice","write") && <DesertNoirPanel meta={dnMeta} />}
      </section>

      {/* Keyboard shortcut cheatsheet — toggled with ? */}
      {showShortcuts && (
        <div
          onClick={() => setShowShortcuts(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--db-bg)", color: "var(--db-text)",
              border: "1px solid var(--db-accent)", borderRadius: "var(--db-r-md)",
              padding: "24px 28px", minWidth: "min(440px, 92vw)", maxWidth: "92vw",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ ...eyebrowStyle, marginBottom: 0, color: "var(--db-accent)" }}>KEYBOARD SHORTCUTS</div>
              <button
                onClick={() => setShowShortcuts(false)}
                style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--db-muted)", cursor: "pointer", fontSize: "var(--db-fs-lg)" }}
              >×</button>
            </div>
            <table style={{ width: "100%", fontSize: "var(--db-fs-md)", borderCollapse: "collapse" }}>
              <tbody>
                {[
                  ["Space", "Play / stop"],
                  ["← →", "Previous / next bar"],
                  ["↑ ↓", "Cycle the selected bar's chord quality"],
                  ["⌘/Ctrl + C", "Copy the selected bar"],
                  ["⌘/Ctrl + V", "Paste onto the selected bar"],
                  ["Double-click a bar", "Loop just that chord"],
                  ["Type in a bar's chord box", "Quick-entry, e.g. Dm7 or Am7/G — then Enter"],
                  ["?", "Show / hide this list"],
                  ["Esc", "Close this list"],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ padding: "5px 14px 5px 0", whiteSpace: "nowrap" }}>
                      <code style={{
                        background: "var(--db-input-bg)", border: "1px solid var(--db-panel-border)",
                        borderRadius: "var(--db-r-sm)", padding: "2px 7px", fontSize: "var(--db-fs-sm)", color: "var(--db-accent)",
                      }}>{k}</code>
                    </td>
                    <td style={{ padding: "5px 0", opacity: 0.85 }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sticky transport — appears once the main controls scroll out of view,
          so Play/Stop is always reachable deep in the chart (esp. on phones). */}
      {showStickyPlay && (
        <button
          onClick={isPlaying ? stopPlayback : () => startPlayback().catch(console.error)}
          aria-label={isPlaying ? "Stop playback" : "Start playback"}
          style={{
            position: "fixed", right: "20px", bottom: "20px", zIndex: 55,
            padding: "14px 22px", borderRadius: "var(--db-r-pill)", cursor: "pointer",
            fontWeight: 800, fontSize: "var(--db-fs-lg)",
            border: `2px solid ${isPlaying ? "var(--db-c-salmon)" : "var(--db-c-amber)"}`,
            background: isPlaying
              ? "color-mix(in srgb, var(--db-c-salmon) 25%, var(--db-bg))"
              : "color-mix(in srgb, var(--db-c-amber) 25%, var(--db-bg))",
            color: isPlaying ? "var(--db-c-salmon)" : "var(--db-c-amber)",
            boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
            backdropFilter: "blur(8px)",
          }}
        >
          {isPlaying ? "⏹ Stop" : "▶ Play"}
        </button>
      )}

      {/* Transient toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", zIndex: 60,
          background: "var(--db-panel-bg)", color: "var(--db-text)",
          border: "1px solid var(--db-accent)", borderRadius: "var(--db-r-md)",
          padding: "10px 18px", fontSize: "var(--db-fs-md)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.35)", backdropFilter: "blur(8px)",
        }}>
          {toast}
        </div>
      )}

    </main>
    </>
  )
}

// ─── Cloud-sync status + magic-link sign-in ──────────────────────────────────
function SyncControl({ auth, syncStatus, style }) {
  if (!auth.configured) return null

  const label = {
    local:   "Local only",
    syncing: "Syncing…",
    synced:  "Synced",
    error:   "Sync error",
  }[syncStatus] || ""

  async function signIn() {
    const email = prompt("Email for a magic sign-in link (syncs your songs & setlists across devices):")
    if (!email?.trim()) return
    const { error } = await auth.signIn(email.trim())
    alert(error ? `Sign-in failed: ${error}` : "Check your email for the sign-in link.")
  }

  if (!auth.email) {
    return (
      <button
        onClick={signIn}
        style={{
          ...style,
          padding: "6px 12px", borderRadius: "var(--db-r-md)", cursor: "pointer", fontSize: "var(--db-fs-sm)", fontWeight: 600,
          border: "1px solid var(--db-panel-border)", background: "var(--db-panel-bg)", color: "var(--db-muted)",
        }}
        title="Sign in to sync songs and setlists across devices"
      >
        ☁ Sign in to sync
      </button>
    )
  }

  const dotColor = syncStatus === "error" ? "var(--db-c-salmon)"
    : syncStatus === "syncing" ? "var(--db-c-amber)" : "var(--db-c-green)"

  return (
    <div style={{ ...style, display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--db-fs-sm)", color: "var(--db-muted)" }}>
      <span style={{ color: dotColor }}>●</span>
      <span title={auth.email}>{label}</span>
      <button
        onClick={auth.signOut}
        style={{
          padding: "4px 10px", borderRadius: "var(--db-r-md)", cursor: "pointer", fontSize: "var(--db-fs-sm)",
          border: "1px solid var(--db-panel-border)", background: "var(--db-panel-bg)", color: "var(--db-muted)",
        }}
        title={`Signed in as ${auth.email}`}
      >
        Sign out
      </button>
    </div>
  )
}

// ─── Build stamp ─────────────────────────────────────────────────────────────
// Which commit is actually running. Deploys are easy to misread — a cached page
// or an old preview URL looks exactly like a deploy that never happened — so the
// page states its own provenance instead of leaving you to infer it.
// Values are inlined at build time; see the `env` block in next.config.mjs.
function BuildStamp() {
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA || "dev"
  const builtAt = process.env.NEXT_PUBLIC_BUILD_TIME || ""
  const repo = process.env.NEXT_PUBLIC_BUILD_REPO || ""

  // Formatted in UTC rather than the viewer's locale: server and browser sit in
  // different time zones, so a localised string renders differently on each and
  // trips React's hydration check. UTC is the same everywhere.
  const stamped = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(builtAt)
    if (!m) return ""
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    const [, , mo, day, hh, mm] = m
    return `${months[Number(mo) - 1]} ${Number(day)} ${hh}:${mm}Z`
  })()

  const label = `build ${sha}${stamped ? ` · ${stamped}` : ""}`
  const title = `Running commit ${sha}${builtAt ? `, built ${builtAt}` : ""}${repo ? ` from ${repo}` : ""}`

  const style = {
    fontSize: "var(--db-fs-xs)",
    fontFamily: "var(--font-mono, monospace)",
    color: "var(--db-muted)",
    padding: "4px 9px",
    borderRadius: "var(--db-r-pill)",
    border: "1px solid var(--db-panel-border)",
    background: "var(--db-panel-bg)",
    whiteSpace: "nowrap",
    textDecoration: "none",
    flexShrink: 0,
  }

  // Public repo — link straight to the commit that's live.
  if (repo && sha !== "dev") {
    return (
      <a href={`https://github.com/${repo}/commit/${sha}`} target="_blank" rel="noopener noreferrer" style={style} title={title}>
        {label}
      </a>
    )
  }
  return <span style={style} title={title}>{label}</span>
}

function InfoBlock({ title, value, color }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={eyebrowSmallStyle}>{title}</div>
      <div style={{ fontSize: "var(--db-fs-lg)", color: color || "var(--db-text)" }}>{value}</div>
    </div>
  )
}

// ─── Desert Noir: pedagogy panel + Idea Dice ─────────────────────────────────
const DN_PROMPTS = {
  Bridge: [
    "Change only the meter, not the chords",
    "Hold 1 in the bass while upper structures move",
    "Move to the parallel mode and preserve the melody contour",
    "Remove the bass for the entire bridge",
    "Use one chromatic chord once, then never explain it",
    "Turn the groove into a slow processional",
    "Shift the melody by one eighth note",
    "Let the bridge crescendo physically while harmony barely changes",
  ],
  Melody: [
    "Use only five distinct notes",
    "Start every phrase on 9",
    "Repeat the hook three times before changing one note",
    "End each phrase on a non-chord tone",
    "Write a two-bar question and two-bar answer",
    "Reserve the widest interval for the last A section",
    "Use one repeated note as percussion",
    "Make the bridge melody a rhythmic displacement of the main hook",
  ],
  Arrangement: [
    "Bass and drums alone for eight bars",
    "Second guitar may play only harmonics",
    "No cymbals until the final return",
    "Use a dry lead tone in the wettest section",
    "Double the melody only for four bars",
    "Replace chords with two-note shells",
    "Leave one full bar of silence before the return",
    "Let delay feedback occupy the final two bars",
  ],
}

function DesertNoirPanel({ meta }) {
  const pick = (a) => a[Math.floor(Math.random() * a.length)]
  const roll = () => ({
    Bridge: pick(DN_PROMPTS.Bridge),
    Melody: pick(DN_PROMPTS.Melody),
    Arrangement: pick(DN_PROMPTS.Arrangement),
  })
  const [dice, setDice] = useState(roll)

  const cards = [
    ["Groove", meta.groove],
    ["Bridge design", meta.bridgeTechnique],
    ["Melody discipline", meta.melodyNote],
    ["Tone", meta.tone],
    ["Arrangement", meta.arrangement],
  ].filter(([, v]) => v)

  return (
    <div style={{ ...panelStyle, marginTop: "24px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap", marginBottom: "6px" }}>
        <div style={{ fontSize: "var(--db-fs-xs)", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--db-accent)" }}>
          {meta.collection} · {meta.number}
        </div>
        <div style={{ fontStyle: "italic", opacity: 0.8 }}>{meta.vibe} · {meta.modeLabel}</div>
        <div style={{ marginLeft: "auto", fontSize: "var(--db-fs-sm)", opacity: 0.65 }}>{meta.meter}</div>
      </div>
      {meta.description && <p style={{ margin: "0 0 14px", lineHeight: 1.55, fontSize: "var(--db-fs-lg)" }}>{meta.description}</p>}

      {(meta.melodyLine || meta.bassLine) && (
        <div style={{ display: "flex", gap: "22px", flexWrap: "wrap", marginBottom: "14px", fontFamily: "var(--font-mono, monospace)", fontSize: "var(--db-fs-sm)" }}>
          {meta.melodyLine && <div><span style={{ opacity: 0.6 }}>Melody </span>{meta.melodyLine}</div>}
          {meta.bassLine && <div><span style={{ opacity: 0.6 }}>Bass </span>{meta.bassLine}</div>}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "18px" }}>
        {cards.map(([title, value]) => (
          <div key={title} style={{ border: "1px solid var(--db-panel-border)", borderRadius: "var(--db-r-md)", padding: "12px 14px" }}>
            <div style={{ fontSize: "var(--db-fs-xs)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--db-accent)", marginBottom: "6px" }}>{title}</div>
            <div style={{ fontSize: "var(--db-fs-md)", lineHeight: 1.5, opacity: 0.9 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ border: "1px dashed var(--db-accent)", borderRadius: "var(--db-r-md)", padding: "14px 16px", background: "rgba(224,180,76,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <div style={{ fontSize: "var(--db-fs-xs)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--db-accent)" }}>✦ Idea Dice</div>
          <button onClick={() => setDice(roll())} style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: "var(--db-r-md)", border: "1px solid var(--db-accent)", background: "transparent", color: "var(--db-text)", cursor: "pointer", fontSize: "var(--db-fs-sm)" }}>
            Roll
          </button>
        </div>
        <div style={{ display: "grid", gap: "4px", fontSize: "var(--db-fs-md)", lineHeight: 1.5 }}>
          <div><b>Bridge:</b> {dice.Bridge}</div>
          <div><b>Melody:</b> {dice.Melody}</div>
          <div><b>Arrangement:</b> {dice.Arrangement}</div>
        </div>
        <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, marginTop: "8px" }}>Use a result as a revision constraint, not another layer to add.</div>
      </div>
    </div>
  )
}

const panelStyle = {
  marginBottom: "20px",
  padding: "18px",
  borderRadius: "var(--db-r-md)",
  border: "1px solid var(--db-panel-border)",
  background: "var(--db-panel-bg)",
}

const sidePanelStyle = {
  border: "1px solid var(--db-side-border)",
  borderRadius: "var(--db-r-md)",
  padding: "20px",
  background: "var(--db-side-bg)",
}

const scaleCardStyle = {
  padding: "12px",
  borderRadius: "var(--db-r-md)",
  border: "1px solid var(--db-panel-border)",
  background: "var(--db-panel-bg)",
}

// Actions that mean the same thing should look the same. The Songbook's five
// export/import buttons used to be five different colours, which spent the
// semantic palette on decoration — colour now signals state, not identity.
const neutralButtonStyle = {
  padding: "9px 12px",
  borderRadius: "var(--db-r-md)",
  border: "1px solid var(--db-panel-border)",
  background: "var(--db-panel-bg)",
  color: "var(--db-text)",
  cursor: "pointer",
  fontWeight: 600,
}

function buttonStyle(colorVar) {
  return {
    padding: "9px 12px",
    borderRadius: "var(--db-r-md)",
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
    borderRadius: "var(--db-r-md)",
    background: `color-mix(in srgb, ${colorVar} 12%, transparent)`,
    border: `1px solid color-mix(in srgb, ${colorVar} 30%, transparent)`,
    fontSize: "var(--db-fs-lg)",
    color: colorVar,
    fontWeight: 700,
  }
}

// ─── FretFlow static data (never changes — defined once at module scope) ──────
const FRET_FLOW_SCALES = [
  // ── Hexatonic (custom formulas — Randy Vincent / Pat Martino system) ──────
  { value: "hex:minor",             label: "Minor Hexatonic  1 2 b3 4 5 b7" },
  { value: "hex:major",             label: "Major Hexatonic  1 2 3 5 6 7" },
  { value: "hex:melodic",           label: "Melodic Minor Hexatonic  1 2 b3 5 6 7" },
  // ── Chord arpeggios ───────────────────────────────────────────────────────
  { value: "chord:maj7",            label: "Maj7 Arpeggio  1 3 5 7" },
  { value: "chord:m7",              label: "m7 Arpeggio  1 b3 5 b7" },
  { value: "chord:7",               label: "Dom7 Arpeggio  1 3 5 b7" },
  { value: "chord:m7b5",            label: "m7b5 Arpeggio  1 b3 b5 b7" },
  { value: "chord:dim7",            label: "Dim7 Arpeggio  1 b3 b5 bb7" },
  { value: "chord:6",               label: "Maj6 Arpeggio  1 3 5 6" },
  { value: "chord:m6",              label: "m6 Arpeggio  1 b3 5 6" },
  // ── Diatonic modes ────────────────────────────────────────────────────────
  { value: "major",                 label: "Major (Ionian)" },
  { value: "dorian",                label: "Dorian" },
  { value: "phrygian",              label: "Phrygian" },
  { value: "lydian",                label: "Lydian" },
  { value: "mixolydian",            label: "Mixolydian" },
  { value: "minor",                 label: "Natural Minor (Aeolian)" },
  { value: "locrian",               label: "Locrian" },
  // ── Harmonic / melodic minor family ──────────────────────────────────────
  { value: "harmonic minor",        label: "Harmonic Minor" },
  { value: "melodic minor",         label: "Melodic Minor" },
  { value: "harmonic major",        label: "Harmonic Major" },
  { value: "double harmonic major", label: "Double Harmonic Major" },
  // ── Symmetric / exotic ───────────────────────────────────────────────────
  { value: "whole tone",            label: "Whole Tone" },
  { value: "whole-half diminished", label: "Diminished (Whole-Half)" },
  { value: "half-whole diminished", label: "Diminished (Half-Whole)" },
  { value: "enigmatic",             label: "Enigmatic" },
  // ── Altered / modal jazz ─────────────────────────────────────────────────
  { value: "altered",               label: "Altered (Superlocrian)" },
  { value: "lydian dominant",       label: "Lydian Dominant" },
  // ── Bebop scales (8-note) ────────────────────────────────────────────────
  { value: "bebop",                 label: "Bebop Dominant" },
  { value: "bebop major",           label: "Bebop Major" },
  { value: "bebop minor",           label: "Bebop Dorian" },
  { value: "bebop locrian",         label: "Bebop Locrian" },
  // ── Pentatonic & blues ───────────────────────────────────────────────────
  { value: "major pentatonic",      label: "Major Pentatonic" },
  { value: "minor pentatonic",      label: "Minor Pentatonic" },
  { value: "major blues",           label: "Major Blues" },
  { value: "blues",                 label: "Blues (Minor Blues)" },
  // ── Exotic (from the Bebop Blueprint scale dictionary; explicit semitones) ─
  { value: "ints:0,1,4,5,6,8,11",   label: "Persian" },
  { value: "ints:0,2,4,5,6,8,10",   label: "Arabic (Major Locrian)" },
  { value: "ints:0,2,5,7,8",        label: "Japanese" },
  { value: "ints:0,2,5,7,10",       label: "Egyptian (Sus Pentatonic)" },
  { value: "ints:0,3,5,7,10,11",    label: "Minor Bebop (Hexatonic)" },
  { value: "ints:0,3,5,6,7,10,11",  label: "Minor Bebop Blues" },
]

const TUNING_NAMES = ["Standard", "Drop D", "Open G", "DADGAD", "Open D", "Open E"]

// Ingredients for the "Surprise me" brief — combinations lean on forms and
// devices the generator's system prompt already knows how to voice.
const SURPRISE = {
  forms: [
    "a 12-bar blues", "a 12-bar minor blues", "a Bird blues", "a 32-bar AABA standard",
    "Rhythm Changes", "a 16-bar modal tune", "a bossa nova", "a jazz waltz",
    "a ballad", "an up-tempo bebop head",
  ],
  keys: ["C", "F", "Bb", "Eb", "Ab", "Db", "G", "D", "A", "E", "Bm", "Cm", "Dm", "Fm", "Gm"],
  moods: [
    "warm and nostalgic", "dark and brooding", "bright and swinging", "spacious and modal",
    "restless and chromatic", "wistful", "gritty and blues-drenched", "elegant and understated",
  ],
  devices: [
    "a tritone substitution", "a backdoor dominant", "Coltrane changes on the bridge",
    "a Tadd Dameron turnaround", "modal interchange", "a deceptive cadence",
    "passing diminished chords", "a secondary dominant chain", "an inserted ii-V",
  ],
}

// Click-to-insert starting points for the prompt box.
const PROMPT_TEMPLATES = [
  "12-bar blues in F with a backdoor dominant",
  "32-bar AABA in Eb with Coltrane changes on the bridge",
  "Bossa nova in D minor, slow, deceptive cadence at bar 8",
  "Minor blues in C with a tritone sub in the turnaround",
  "Rhythm Changes in Bb, bebop bridge",
  "Modal tune in D dorian, 16 bars, sparse harmony",
]

// How each bar's approach line reaches the next chord (from generateApproachLines)
const APPROACH_PILLS = {
  "guide-tone-step": { label: "7→3", color: "var(--db-c-green)", hint: "Guide tone resolves by step into the next chord" },
  "chromatic-below": { label: "CHROMATIC", color: "var(--db-c-blue)", hint: "Approaches the next target from a half step below" },
  "anchor":          { label: "ANCHOR", color: "var(--db-muted)", hint: "Rests on a guide tone — no onward resolution" },
}

const selectStyle = {
  width: "100%",
  padding: "10px",
  borderRadius: "var(--db-r-md)",
  background: "var(--db-input-bg)",
  color: "var(--db-text)",
  border: "1px solid var(--db-panel-border)",
}

const inlineLabelStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "var(--db-fs-md)",
}

const eyebrowStyle = {
  fontSize: "var(--db-fs-sm)",
  opacity: 0.65,
  marginBottom: "10px",
  letterSpacing: "0.08em",
}

const eyebrowSmallStyle = {
  fontSize: "var(--db-fs-sm)",
  opacity: 0.65,
  marginBottom: "6px",
}

const miniLabelStyle = {
  fontSize: "var(--db-fs-sm)",
  opacity: 0.6,
  marginBottom: "4px",
}
