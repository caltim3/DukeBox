"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ROOTS,
  QUALITIES,
  buildChordSymbol,
  chordInfo,
  scaleNotes,
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
import { guidedPrescription, drillStage, nextKeyInCycle, DRILL_LOOPS_PER_STAGE, PENA_DRILLS } from "@/lib/music/penaDrills"
import { STARTER_PRESETS, STARTER_STRIP, LOAD_STARTER_EVENT } from "@/lib/music/starters"
import Fretboard from "@/components/Fretboard"
import MetronomePanel from "@/components/MetronomePanel"
import BeatForgeLibrary from "@/components/BeatForgeLibrary"
import PracticeTimer from "@/components/PracticeTimer"
import GigBarStrip from "@/components/GigBarStrip"
import { lineToTransportEvents } from "@/lib/music/lines"
import GigMode from "@/components/GigMode"
import MelodyPaths from "@/components/MelodyPaths"
import CreateWorkspace from "@/components/CreateWorkspace"
import ReferenceGuides from "@/components/ReferenceGuides"
import { useAuth, useCloudLibrary } from "@/lib/cloud"
import { logActivity } from "@/lib/recentActivity"
import SessionStrip from "@/components/practice/SessionStrip"
import ChartRibbon from "@/components/practice/ChartRibbon"
import AnticipationStrip from "@/components/practice/AnticipationStrip"
import SongbookDrawer from "@/components/practice/SongbookDrawer"
import TimerDrawer from "@/components/practice/TimerDrawer"
import StickyTransport from "@/components/practice/StickyTransport"
import FocusGoalCard from "@/components/practice/FocusGoalCard"
import BackingBandCard from "@/components/practice/BackingBandCard"
import PowerPanel from "@/components/practice/PowerPanel"

// audio.js (Tone.js) is loaded lazily on first play so AudioContext is only
// created after a user gesture, avoiding the browser autoplay-policy warning.
let _audioMod = null
async function loadAudio() {
  if (!_audioMod) _audioMod = await import("@/lib/music/audio")
  return _audioMod
}

const PALETTES = [
  { id: "studio", name: "Studio", emoji: "🎛️" },
  { id: "regatta", name: "Regatta", emoji: "⛵" },
  { id: "ember", name: "Ember", emoji: "🔥" },
  { id: "kiln", name: "Kiln", emoji: "🏺" },
  { id: "harbor", name: "Harbor", emoji: "⚓" },
]

// What a first-time visitor gets. The no-flash boot script in app/layout.js
// paints this same pair before hydration, so the two must agree.
const DEFAULT_PALETTE = "harbor"
const DEFAULT_PALETTE_INDEX = Math.max(0, PALETTES.findIndex((p) => p.id === DEFAULT_PALETTE))

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

// ─── Workspaces ───────────────────────────────────────────────────────────────
// The app had grown into several products stacked vertically — 11 panels and ~317
// controls on one 5-screen page, all at equal weight. Modes show one workspace
// at a time; nothing was removed, it's just no longer all at once.
const MODES = [
  { id: "practice",  label: "Practice",  icon: "🎧", blurb: "Play along, loop a section, drill it slow" },
  { id: "gig",       label: "Gig",       icon: "🎤", blurb: "Stage charts and setlists" },
  { id: "create",    label: "Create",    icon: "✍️", blurb: "Build charts, compose songs, and develop melodic lines" },
  { id: "reference", label: "Reference", icon: "📖", blurb: "Circle of fifths, key chart, progressions" },
  { id: "tonal",     label: "Tonal",     icon: "🎹", blurb: "The published Tonal app, embedded as-is" },
]

// Tonal is embedded rather than ported: the live site is loaded in a frame
// exactly as published, so it stays whatever it already is and nothing here
// has to be kept in sync with it.
const TONAL_URL = "https://caltim3.github.io/tonal/"

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
  // Which beat of the current bar is sounding (0-based); null when stopped.
  // Drives the beat meter on the NOW card.
  const [beatInBar, setBeatInBar] = useState(null)

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
  const [songSheetDraft, setSongSheetDraft] = useState(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importText, setImportText] = useState("")
  const [importStatus, setImportStatus] = useState(null)
  const [mode, setMode] = useState("practice")
  const [activeGigSongId, setActiveGigSongId] = useState(null)  // which gig tune is loaded
  const [activeSongTitle, setActiveSongTitle] = useState(null)  // named on the floating bar strip
  // Panels declare which workspaces they belong to; several appear in more than one.
  const inMode = (...ids) => ids.includes(mode)
  const [clipboardBar, setClipboardBar] = useState(null)
  const [toast, setToast] = useState(null)
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
      if (!cancelled && savedMode) {
        setMode(savedMode === "write" ? "practice" : (MODES.some(m => m.id === savedMode) ? savedMode : "practice"))
      }
    })()
    return () => { cancelled = true }
  }, [savedMode])

  function chooseMode(id) {
    setMode(id)
    setLibrary(lib => ({ ...lib, prefs: { ...lib.prefs, mode: id } }))
    // "Practice" is home base, not a destination worth resurfacing in
    // "Jump back in" — only log the other workspaces.
    if (id !== "practice") {
      const m = MODES.find((entry) => entry.id === id)
      if (m) logActivity({ label: m.label, subtitle: m.blurb, art: id, action: { type: "workspace", value: id } })
    }
  }
  const [fretboardView, setFretboardView] = useState("scale")
  const [fretboardTuning, setFretboardTuning] = useState("Standard")
  const [scaleFilter, setScaleFilter] = useState(null)  // null | "pentatonic" | "hexatonic" | "martino" | "hexchord" | "barry"
  const [bebopOverlay, setBebopOverlay] = useState(false)   // adds chromatic passing tone on top
  const [targetsOverlay, setTargetsOverlay] = useState(true) // guide tones are the default practice view
  const [melodyPathMode, setMelodyPathMode] = useState("73")
  const [melodyPathState, setMelodyPathState] = useState({ mode: "73", notesByBar: {}, targetsByBar: {} })
  // On by default: the ghosts and routes are the point of the board, and they
  // are inert without it. Pairs with targetsOverlay above, which is already on.
  const [anticipateOn, setAnticipateOn] = useState(true)   // ghost the next chord onto the neck
  const [enclosureOn, setEnclosureOn] = useState(false)     // chromatic cage around the 3rd Hunter target
  const [loadedLibraryNum, setLoadedLibraryNum] = useState(null)  // which BeatForge Library card is loaded, if any
  const [practiceMode, setPracticeMode] = useState(false)
  const [paletteIndex, setPaletteIndex] = useState(DEFAULT_PALETTE_INDEX)
  const [colorMode, setColorMode] = useState("dark")
  const [themePickerOpen, setThemePickerOpen] = useState(false)
  const [gridColumns, setGridColumns] = useState(4)
  const [scrollMode, setScrollMode] = useState(false)

  // Practice tab redesign v3 (docs/PRACTICE_REDESIGN_V3.md) — the one new
  // piece of client state the spec allows (§6): which top-canvas layout is
  // showing. Persisted so a reload keeps your last choice.
  const [practiceView, setPracticeView] = useState("cockpit")
  // Which view the Start-practicing starter buttons open into. Separate from
  // practiceView so arming it does not yank you out of the view you are in.
  const [starterView, setStarterView] = useState("cockpit")
  useEffect(() => {
    const saved = window.localStorage.getItem("dukebox.practiceView")
    if (saved === "cockpit" || saved === "focus") setPracticeView(saved)
  }, [])
  const choosePracticeView = useCallback((view) => {
    setPracticeView(view)
    window.localStorage.setItem("dukebox.practiceView", view)
  }, [])

  // Songbook / Timer drawers (spec §5.6) — simple open/closed UI state, not
  // persisted; they always start closed.
  const [songbookOpen, setSongbookOpen] = useState(false)
  const [timerOpen, setTimerOpen] = useState(false)

  // Peña Bebop Gym — the Free/Guided/Drill picker on the focus card, now real.
  // Guided rotates the drill deck as loops accumulate; Drill adds the ladder
  // (key cycle + tempo bumps) on top. loopsDone counts actual playhead wraps.
  const [drillMode, setDrillMode] = useState("free")
  const [loopsDone, setLoopsDone] = useState(0)
  const prevPlayheadRef = useRef(null)
  const drillKeyCyclesRef = useRef(0)

  // Power panels (spec §5.8): Band & Mix open by default, the rest closed.
  // Persisted per the "Preserve" note on state persisting in localStorage.
  const [openControlPanels, setOpenControlPanels] = useState({
    band: true, melody: false, leadsheet: false, metronome: false, fretSettings: false, beatforgeLibrary: false,
  })
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("dukebox.practicePanels") || "null")
      if (saved && typeof saved === "object") setOpenControlPanels((prev) => ({ ...prev, ...saved }))
    } catch { /* ignore malformed storage */ }
  }, [])
  useEffect(() => {
    window.localStorage.setItem("dukebox.practicePanels", JSON.stringify(openControlPanels))
  }, [openControlPanels])

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
  const loadStarterRef    = useRef(null)   // latest loadStarter, for the cross-tree starter event
  const toastTimer        = useRef(null)   // auto-dismiss handle for the toast
  const themePickerRef    = useRef(null)   // wraps the palette/mode dropdown, for click-outside close
  const beatforgeRef      = useRef(null)   // BeatForge Metronome's loadPattern — bridges the sibling Library panel

  const palette = PALETTES[paletteIndex]

  const setTheme = useCallback((paletteId, mode) => {
    const root = document.documentElement
    if (paletteId && PALETTES.some(({ id }) => id === paletteId)) {
      root.dataset.palette = paletteId
      window.localStorage.setItem("dukebox-palette", paletteId)
      setPaletteIndex(PALETTES.findIndex(({ id }) => id === paletteId))
    }
    if (mode === "light" || mode === "dark") {
      root.dataset.mode = mode
      root.style.colorScheme = mode
      window.localStorage.setItem("dukebox-mode", mode)
      setColorMode(mode)
    }
  }, [])

  // Cycling goes through setTheme rather than nudging the index and letting an
  // effect chase it. That effect used to fire on mount too, writing the
  // DEFAULT palette over whatever the boot script had just painted — and,
  // because setTheme also persists, overwriting the visitor's saved palette in
  // localStorage. setTheme is now the only writer, so nothing touches the
  // theme until the player actually asks for a change.
  const cyclePalette = useCallback(() => {
    setTheme(PALETTES[(paletteIndex + 1) % PALETTES.length].id, null)
  }, [paletteIndex, setTheme])

  // The blocking head script has already painted the stored theme. This only
  // synchronizes the controls with the attributes it selected — it reads, and
  // never writes, so re-running it (as StrictMode does) is harmless.
  useEffect(() => {
    const root = document.documentElement
    const savedIndex = PALETTES.findIndex(({ id }) => id === root.dataset.palette)
    if (savedIndex >= 0) setPaletteIndex(savedIndex)
    setColorMode(root.dataset.mode === "light" ? "light" : "dark")
  }, [])

  const toggleColorMode = useCallback(() => {
    setTheme(null, colorMode === "dark" ? "light" : "dark")
  }, [colorMode, setTheme])

  // Close the palette/mode dropdown on an outside click — it used to stay
  // open until a control inside it was clicked, which read as stuck.
  useEffect(() => {
    if (!themePickerOpen) return
    function onOutsideClick(e) {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target)) {
        setThemePickerOpen(false)
      }
    }
    document.addEventListener("mousedown", onOutsideClick)
    return () => document.removeEventListener("mousedown", onOutsideClick)
  }, [themePickerOpen])

  const selectedBar = bars[selectedIndex]

  const harmonicContext = useMemo(() => {
    return analyzeProgressionContext(bars)
  }, [bars])

  const approachLines = useMemo(() => {
    return generateApproachLines(bars)
  }, [bars])

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

  const melodyPathModeLabel = melodyPathMode === "73"
    ? "7→3"
    : melodyPathMode === "smooth"
      ? "Smooth"
      : melodyPathMode === "melody"
        ? "Melody"
        : melodyPathMode === "hunter3"
          ? "3rd Hunter"
          : melodyPathMode

  // The fretboard consumes Melody Paths' selected line directly. This keeps
  // every present and future path mode in sync without reimplementing its
  // note-selection rules here. notesByBar entries are always arrays — one
  // note normally, two for a 3rd Hunter bracket (no half-step approach, so
  // both whole tones around the target get shown).
  const guideToneDisplayNotes = useMemo(() => {
    if (!targetsOverlay) return []
    return melodyPathState.notesByBar[fretboardBarIndex] || []
  }, [targetsOverlay, melodyPathState, fretboardBarIndex])

  // Peña enclosure overlay — the chromatic cage (half step below and above)
  // around the 3rd Hunter target, plus the target itself, both shown on the
  // CURRENT bar's board so the cage is visible before the chord arrives.
  // Two things share the fretboard's approach-note layer, both drawn in the
  // enclosure colour so the only note lit as a GUIDE TONE stays the chord's
  // own 3rd: 3rd Hunter's lead-in (the note that walks into the next bar's
  // 3rd — this is the one carrying the arrow), and, when +Enclosure is on,
  // the chromatic cage a half step either side of that target.
  const enclosureDisplay = useMemo(() => {
    if (!targetsOverlay) return { notes: [], target: [] }
    const target = melodyPathState.targetsByBar?.[fretboardBarIndex]
    const notes = []

    if (melodyPathMode === "hunter3") {
      const lead = melodyPathState.leadInByBar?.[fretboardBarIndex]
      if (lead) notes.push(lead)
    }

    if (enclosureOn && target) {
      const NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
      const SHARP = { "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb" }
      const pc = NOTES.indexOf(SHARP[target] || target)
      if (pc >= 0) notes.push(NOTES[(pc + 11) % 12], NOTES[(pc + 1) % 12])
    }

    return {
      notes: Array.from(new Set(notes)),
      // The next bar's 3rd, previewed on this board so the arrow has
      // somewhere to point.
      target: enclosureOn && target ? [target] : [],
    }
  }, [enclosureOn, targetsOverlay, melodyPathMode, melodyPathState, fretboardBarIndex])

  // Barry Harris 6th-dim passing tone — shown green when the Barry filter is on
  const barryPassingNotes = useMemo(() => {
    if (scaleFilter !== "barry") return []
    const tonic = fretboardBar.userTonic ?? fretboardBar.root
    const p = barryHarrisScale(tonic, fretboardBar.quality).passingNote
    return p ? [p] : []
  }, [scaleFilter, fretboardBar])

  // Fretboard's "now playing" scale label — hoisted out of the old inline
  // render IIFE so both the fretboard card header and the readout can use it.
  const scaleLabel = martinoMap
    ? `Martino → ${martinoMap.displayRoot}m${martinoMap.displayQuality === "min7b5" ? " (melodic)" : ""}`
    : scaleFilter === "hexchord"
    ? hexChoiceForChord(fretboardBar.userTonic ?? fretboardBar.root, fretboardBar.quality).label
    : scaleFilter === "barry"
    ? `Barry 6th-Dim (${barryHarrisScale(fretboardBar.userTonic ?? fretboardBar.root, fretboardBar.quality).family})`
    : (scaleFilter ?? fretboardScaleData[0]?.name ?? "")
  const scaleTonic = fretboardBar.userTonic ?? fretboardBar.root
  const scaleLabelFull = scaleLabel
    ? (martinoMap || scaleFilter === "hexchord" || scaleFilter === "barry" ? scaleLabel : `${scaleTonic} ${scaleLabel}`)
    : "—"

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

  // Same loop-aware lookahead as anticipateBarIndex above, generalized to the
  // next 3 sounding bars — purely a display list for the Anticipation strip
  // (spec §5.5), not a second source of truth for the fretboard's Anticipate
  // overlay (which keeps using anticipateBarIndex, unchanged).
  const upcomingBarIndices = useMemo(() => {
    if (!bars.length) return []
    const lo = loopEnabled ? Math.min(loopStart, loopEnd) : 0
    const hi = loopEnabled ? Math.max(loopStart, loopEnd) : bars.length - 1
    const span = hi - lo + 1
    const found = []
    for (let step = 1; step <= span && found.length < 3; step++) {
      const idx = lo + ((fretboardBarIndex - lo + step) % span + span) % span
      if (bars[idx] && bars[idx].quality !== "NC") found.push({ index: idx, stepsAway: found.length + 1 })
    }
    return found
  }, [bars, fretboardBarIndex, loopEnabled, loopStart, loopEnd])

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
    if (!targetsOverlay) return null
    const chroma = (n) => ({ C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 })[n]

    // 3rd Hunter: the lit note is this chord's own 3rd and carries no arrow.
    // The arrow belongs to the lead-in — the note in THIS bar that walks into
    // the NEXT bar's 3rd — which Melody Paths has already chosen, along with
    // the signed distance it travels.
    if (melodyPathMode === "hunter3") {
      const lead = melodyPathState.leadInByBar?.[fretboardBarIndex]
      const delta = melodyPathState.leadDeltaByBar?.[fretboardBarIndex]
      const target = melodyPathState.targetsByBar?.[fretboardBarIndex]
      if (!lead || delta == null) return null
      return { [lead]: delta, [`${lead}:to`]: target }
    }

    // Only motion of a semitone or a whole tone counts as a target. The previous
    // version took the cyclically nearest guide tone, which can be up to six
    // semitones away — so it would confidently mark a fourth as a "resolution".
    // A leap that size isn't voice leading, so it now yields no target at all.
    //
    // The value is the signed semitone distance (-2..+2); the fretboard draws one
    // arrow per semitone, pointing right for higher and left for lower — which
    // matches the direction you actually move on the neck.
    if (anticipateBarIndex == null) return null
    const cur = melodyPathState.notesByBar[fretboardBarIndex] || []
    const nxt = melodyPathState.notesByBar[anticipateBarIndex] || []
    if (!cur.length || !nxt.length) return null
    const dirs = {}
    for (const g of cur) {
      const gc = chroma(g)
      if (gc == null) continue
      let best = null
      for (const t of nxt) {
        const tc = chroma(t)
        if (tc == null) continue
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
  }, [targetsOverlay, melodyPathMode, melodyPathState, fretboardBarIndex, anticipateBarIndex])

  // The next chord's path notes, ghosted onto the maple board itself when
  // Anticipate is on, with a route drawn into each. Seeing "here" and "there"
  // on one board removes the register-mapping between two graphics at tempo.
  //
  // 3rd Hunter is excluded on purpose: there the arrow already belongs to the
  // lead-in note rather than to a guide tone, so it keeps its own second board
  // and its own marking untouched.
  const ghostGuideTones = useMemo(() => {
    if (!anticipateOn || !targetsOverlay) return []
    if (melodyPathMode === "hunter3" || anticipateBarIndex == null) return []
    return melodyPathState.notesByBar[anticipateBarIndex] || []
  }, [anticipateOn, targetsOverlay, melodyPathMode, melodyPathState, anticipateBarIndex])

  // How long the bar under the playhead lasts, so the fretboard's phase
  // animation runs on the same clock as the audio. Matches Runway's tempo
  // handling, including the practice-mode override.
  const fretboardBarSeconds = useMemo(() => {
    const bpm = (practiceMode ? 50 : tempo) || 120
    return ((fretboardBar.beats ?? 4) * 60) / bpm
  }, [fretboardBar, practiceMode, tempo])

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
    setActiveGigSongId(null)
    setActiveSongTitle(null)
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
    logActivity({ label: name, subtitle: row?.gig ? "Gig Book" : "Songbook", art: "changes", action: { type: "songbook" } })
    if (row?.gig) {
      const bars = gigSongToBars(row.gig)
      if (!bars.length) { showToast(`No changes stored for "${row.name}"`); return }
      const { keyRoot: k, keyMode: m } = parseGigKey(row.gig.key)
      loadGigSong({
        bars, keyRoot: k, keyMode: m,
        tempo: gigTempoNumber(row.gig.tempo),
        songId: `gig:${row.gig.id}`,
        title: row.name,
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
      setSongSheetDraft({
        title: chart.title || "AI Chart",
        bars: chart.bars.map((bar) => ({ ...bar })),
        keyRoot: chart.keyRoot || "C",
        keyMode: chart.keyMode || "major",
        tempo: chart.tempo || tempo,
        updatedAt: Date.now(),
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
    showToast(`Saved ${entry.name} to My Library`)
  }

  function createSongSheetDraft({ title, bars: draftBars, keyRoot: draftRoot, keyMode: draftMode, tempo: draftTempo }) {
    setSongSheetDraft({
      title: title?.trim() || "Untitled Song",
      bars: (draftBars || []).map((bar) => ({ ...bar })),
      keyRoot: draftRoot || "C",
      keyMode: draftMode || "major",
      tempo: draftTempo || originalTempo || 110,
      updatedAt: Date.now(),
    })
  }

  function startSongSheetFromCurrentChart() {
    createSongSheetDraft({
      title: selectedForm && selectedForm !== "Custom" ? selectedForm : "Untitled Song",
      bars,
      keyRoot,
      keyMode,
      tempo: originalTempo,
    })
  }

  function saveSongSheetToLibrary(draft) {
    const name = draft.title.trim()
    if (!name || !draft.bars.length) return
    const entry = {
      name,
      bars: draft.bars.map((bar) => ({ ...bar })),
      keyRoot: draft.keyRoot,
      keyMode: draft.keyMode,
      tempo: draft.tempo,
      updatedAt: Date.now(),
    }
    setLibrary((lib) => ({
      ...lib,
      songs: [...(lib.songs || []).filter((song) => song.name !== entry.name), entry],
    }))
    setSelectedForm(entry.name)
    setSongSheetDraft((current) => current ? { ...current, updatedAt: entry.updatedAt } : current)
    showToast(`Saved ${entry.name} to My Library`)
  }

  function openSongSheetInPractice(draft) {
    loadGigSong({
      bars: draft.bars.map((bar) => ({ ...bar })),
      keyRoot: draft.keyRoot,
      keyMode: draft.keyMode,
      tempo: draft.tempo,
      autoplay: false,
      songId: null,
      title: draft.title,
      toMode: "practice",
    })
  }

  function removeFromLibrary(name) {
    setLibrary(lib => ({ ...lib, songs: lib.songs.filter(e => e.name !== name) }))
    setSelectedForm("Custom")
  }

  // Load any Gig Mode / setlist tune into the editor and engine.
  // Gig Mode deliberately STAYS OPEN so you can read the stage chart while it
  // plays — the open chart lights the current measure via activeGigSongId.
  function loadGigSong({ bars, keyRoot, keyMode, tempo, autoplay, songId, title, toMode }) {
    if (toMode) chooseMode(toMode)
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
      case "dark-eyes":
        loadForm("Dark Eyes (Dm)")
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
    setActiveGigSongId(null)
    const starterLabel = STARTER_PRESETS.find((preset) => preset.id === starterId)?.label ?? null
    setActiveSongTitle(starterLabel)
    if (starterLabel) logActivity({ label: starterLabel, subtitle: "Starter chart", art: "changes", action: { type: "starter", value: starterLabel } })
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
        onBeat: (_localIdx, beat) => setBeatInBar(beat),
        onStop: () => { playingRef.current = false; setIsPlaying(false); setPlayheadIndex(null); setBeatInBar(null); onDone?.() },
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
    setBeatInBar(null)
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
          onBeat: (_localIdx, beat) => setBeatInBar(beat),
          onStop: () => { playingRef.current = false; setIsPlaying(false); setPlayheadIndex(null); setBeatInBar(null) },
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
        onBeat: (_localIdx, beat) => setBeatInBar(beat),
        onStop: () => {
          playingRef.current = false
          setIsPlaying(false)
          setPlayheadIndex(null)
          setBeatInBar(null)
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
  loadStarterRef.current   = loadStarter

  // The starter strip lives on the Practice home screen, which renders in a
  // separate tree (mounted from layout.js), so it asks for a chart by event
  // rather than by reaching into this component.
  useEffect(() => {
    function onLoadStarter(event) {
      const id = event.detail
      if (id) loadStarterRef.current?.(id)
    }
    window.addEventListener(LOAD_STARTER_EVENT, onLoadStarter)
    return () => window.removeEventListener(LOAD_STARTER_EVENT, onLoadStarter)
  }, [])

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
      const activeElement = document.activeElement
      const tag = activeElement?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if (activeElement?.isContentEditable || activeElement?.closest?.("[contenteditable='true']")) return
      const meta = e.metaKey || e.ctrlKey

      // `?` belongs to KeyboardShortcuts (the single legend) — it handles the
      // key in the capture phase, so this page never sees it.
      if (e.key === "Escape") { setThemePickerOpen(false); return }

      if (!meta && !e.altKey && e.key === ";") {
        e.preventDefault()
        cyclePalette()
        return
      }
      if (!meta && !e.altKey && e.key === "'") {
        e.preventDefault()
        toggleColorMode()
        return
      }
      if (!meta && !e.altKey && (e.key === "o" || e.key === "O") && mode === "practice") {
        e.preventDefault()
        choosePracticeView(practiceView === "focus" ? "cockpit" : "focus")
        return
      }

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
  }, [bars, selectedIndex, clipboardBar, updateBar, cyclePalette, toggleColorMode, mode, practiceView, choosePracticeView])

  // Library hydration + cloud sync is handled by useCloudLibrary; here we only
  // ensure audio stops if the component unmounts mid-playback.
  useEffect(() => {
    return () => _audioMod?.stopAll()
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

  // Count real loops: the playhead wrapping backwards means a pass finished.
  // Counts both loop-range wraps and full-form wraps; resets with the chart.
  useEffect(() => {
    const prev = prevPlayheadRef.current
    prevPlayheadRef.current = playheadIndex
    if (prev != null && playheadIndex != null && playheadIndex < prev) {
      setLoopsDone((count) => count + 1)
    }
  }, [playheadIndex])
  useEffect(() => {
    setLoopsDone(0)
    drillKeyCyclesRef.current = 0
  }, [activeSongTitle, selectedForm])

  // The Bebop Gym ladder. In Drill mode, every full pass through the drill
  // deck earns a key change: transpose the whole chart up a 4th (the jazz
  // cycle), nudge the tempo, and — because playback snapshots bars when it
  // starts — restart the band via the same pendingStartRef handshake the
  // starters use. Guided mode rotates prescriptions only; no key changes.
  useEffect(() => {
    if (drillMode !== "drill" || loopsDone === 0) return
    const { keyCycles } = drillStage(loopsDone)
    if (keyCycles <= drillKeyCyclesRef.current) return
    drillKeyCyclesRef.current = keyCycles
    const toKey = nextKeyInCycle(chartKey)
    const wasPlaying = playingRef.current
    if (wasPlaying) stopPlayback()
    setBars((prev) => transposeChart(prev, chartKey, toKey))
    setChartKey(toKey)
    setKeyRoot(toKey)
    setTempo((current) => Math.min(current + 4, 240))
    showToast(`Bebop Gym: new key — ${toKey}`)
    if (wasPlaying) pendingStartRef.current = true
  }, [loopsDone]) // eslint-disable-line react-hooks/exhaustive-deps

  // Entering Guided or Drill arms the overlays the method needs: 3rd Hunter
  // targets plus the enclosure cage. Leaving for Free turns nothing off —
  // the player keeps whatever view they had.
  const chooseDrillMode = useCallback((mode) => {
    setDrillMode(mode)
    if (mode === "guided" || mode === "drill") {
      setMelodyPathMode("hunter3")
      setTargetsOverlay(true)
      setEnclosureOn(true)
    }
  }, [])

  // What the focus card preaches right now, per mode.
  const drillFocus = useMemo(() => {
    if (drillMode === "guided") {
      const rx = guidedPrescription(loopsDone)
      return { title: rx.title, detail: rx.detail, stageLabel: null }
    }
    if (drillMode === "drill") {
      const { stage, prescription, loopsIntoStage } = drillStage(loopsDone)
      return {
        title: prescription.title,
        detail: prescription.detail,
        stageLabel: `Stage ${stage + 1} · drill ${(stage % PENA_DRILLS.length) + 1}/${PENA_DRILLS.length} · loop ${loopsIntoStage + 1}/${DRILL_LOOPS_PER_STAGE} · key ${chartKey}`,
      }
    }
    return null
  }, [drillMode, loopsDone, chartKey])

  return (
    <>
    <style>{`
      :root {
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
        // Extra bottom clearance in Practice mode so the sticky transport
        // (fixed to the viewport bottom) never sits on top of real content.
        padding: inMode("practice") ? "24px 24px 96px" : "24px",
        fontFamily: "Arial, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <section style={{ minWidth: 0, overflow: "hidden" }}>
        {/* Up to 16 bars from the active section, pinned above every workspace. */}
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
          <div ref={themePickerRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setThemePickerOpen((open) => !open)}
              aria-expanded={themePickerOpen}
              aria-haspopup="dialog"
              style={{
                padding: "6px 14px", borderRadius: "var(--db-r-md)", cursor: "pointer", fontWeight: 600, fontSize: "var(--db-fs-md)",
                border: "1px solid var(--line)", background: "var(--surface)", color: "var(--accent)",
              }}
              title="Choose palette and light or dark mode (; cycles palettes, ' toggles dark/light)"
            >
              {palette.emoji} {palette.name} · {colorMode === "dark" ? "Dark" : "Light"}
            </button>
            {themePickerOpen && (
              <div role="dialog" aria-label="Color theme" style={{
                position: "absolute", zIndex: 40, top: "calc(100% + 7px)", left: 0,
                width: "230px", padding: "10px", borderRadius: "var(--db-r-md)",
                background: "var(--surface)", border: "1px solid var(--line)",
                boxShadow: "0 12px 36px var(--shadow)", display: "grid", gap: "8px",
              }}>
                <label style={{ display: "grid", gap: "4px", color: "var(--muted)", fontSize: "var(--db-fs-xs)" }}>
                  PALETTE
                  <select value={palette.id} onChange={(event) => setTheme(event.target.value, null)} style={{
                    padding: "7px 9px", borderRadius: "var(--db-r-sm)", background: "var(--surface2)",
                    color: "var(--text)", border: "1px solid var(--line)",
                  }}>
                    {PALETTES.map((item) => <option key={item.id} value={item.id}>{item.emoji} {item.name}</option>)}
                  </select>
                </label>
                <div role="group" aria-label="Color mode" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  {["dark", "light"].map((modeName) => (
                    <button key={modeName} onClick={() => setTheme(null, modeName)} style={{
                      padding: "7px 8px", borderRadius: "var(--db-r-sm)", cursor: "pointer", textTransform: "capitalize",
                      background: colorMode === modeName ? "var(--accent)" : "var(--surface2)",
                      color: colorMode === modeName ? "var(--accent-ink)" : "var(--text)",
                      border: `1px solid ${colorMode === modeName ? "var(--accent)" : "var(--line)"}`,
                    }}>{modeName}</button>
                  ))}
                </div>
                <div style={{ color: "var(--muted)", fontSize: "var(--db-fs-xs)" }}>Press ; to cycle palettes · &apos; to toggle dark/light</div>
              </div>
            )}
          </div>

          {inMode("practice") && (
            <>
              {/* Cockpit / Focus — the one new bit of client state the v3 redesign
                  adds (spec §6). Swaps the top canvas only; power panels, drawers,
                  and the sticky transport are shared by both views. */}
              <div style={{ display: "flex", gap: 0, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "9px", padding: "3px" }}>
                {[["cockpit", "Cockpit"], ["focus", "Focus"]].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => choosePracticeView(id)}
                    aria-pressed={practiceView === id}
                    style={{
                      font: "700 11.5px 'Instrument Sans', sans-serif", padding: "6px 12px", borderRadius: "6px",
                      border: "none", letterSpacing: "0.02em", cursor: "pointer",
                      background: practiceView === id ? "var(--accent)" : "transparent",
                      color: practiceView === id ? "var(--accent-ink)" : "var(--muted)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setSongbookOpen(true)}
                className="db-icon-btn"
                title="Songbook"
                aria-label="Open Songbook"
                style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface)", fontSize: "14px", cursor: "pointer" }}
              >
                📚
              </button>
              <button
                onClick={() => setTimerOpen(true)}
                className="db-icon-btn"
                title="Timer"
                aria-label="Open Timer"
                style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface)", fontSize: "14px", cursor: "pointer" }}
              >
                ⏱
              </button>
            </>
          )}

          {/* Keyboard shortcuts are meaningless on a touch device — hidden there
              rather than competing for the little horizontal room a phone has.
              KeyboardShortcuts opens the legend off this button's title. */}
          <button
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
                  background: on ? "var(--accent)" : "transparent",
                  color: on ? "var(--accent-ink)" : "var(--text)",
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

        {/* Start practicing — the same starter charts as the Home strip, but
            reachable without going home first. Each button loads the chart,
            drops to practice tempo and starts the band (loadStarter already
            does all three), after switching to whichever view is armed. */}
        {inMode("practice") && (
          <div style={{
            marginBottom: "20px", padding: "12px 14px",
            background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap", marginBottom: "9px" }}>
              <span style={{ font: "700 11px 'IBM Plex Mono', monospace", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)" }}>
                Start practicing
              </span>
              <span style={{ fontSize: "var(--db-fs-xs)", color: "var(--muted)" }}>
                Loads at 50 BPM and starts the band — pick the view first
              </span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 0, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "9px", padding: "3px" }}>
                {[["cockpit", "Practice"], ["focus", "Focus"]].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setStarterView(id)}
                    aria-pressed={starterView === id}
                    title={`Starter charts open in ${label} view`}
                    style={{
                      font: "700 11.5px 'Instrument Sans', sans-serif", padding: "5px 11px", borderRadius: "6px",
                      border: "none", letterSpacing: "0.02em", cursor: "pointer",
                      background: starterView === id ? "var(--accent)" : "transparent",
                      color: starterView === id ? "var(--accent-ink)" : "var(--muted)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
              {STARTER_STRIP.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => { choosePracticeView(starterView); loadStarter(preset.id) }}
                  title={`Load ${preset.label} and start playing in ${starterView === "focus" ? "Focus" : "Practice"} view`}
                  style={{
                    padding: "7px 14px", borderRadius: "999px", cursor: "pointer",
                    font: "600 13px 'Instrument Sans', sans-serif",
                    background: "var(--surface2)", color: "var(--text)",
                    border: "1px solid var(--line)",
                  }}
                >
                  ▶ {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

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
          </div>
        )}

        {inMode("create") && (
          <CreateWorkspace
            generator={{
              promptText,
              setPromptText,
              isGenerating,
              generationNotes,
              generationError,
              showGenNotes,
              setShowGenNotes,
              lastGenChart,
              handleGenerateChart,
              surpriseMe,
              saveToLibrary,
              promptHistory,
              promptTemplates: PROMPT_TEMPLATES,
              chartBars: bars,
              chartTitle: selectedForm,
            }}
            songSheetDraft={songSheetDraft}
            onDraftChange={setSongSheetDraft}
            onDraftSave={saveSongSheetToLibrary}
            onDraftOpenPractice={openSongSheetInPractice}
            onStartDraft={startSongSheetFromCurrentChart}
            onSongCrafted={(result) => {
              createSongSheetDraft(result)
              chooseMode("create")
              showToast("SongCrafter sent the arrangement to SongSheet")
            }}
            originalTempo={originalTempo}
            stopPlayback={stopPlayback}
            playLineSection={playLineSection}
            panelStyle={panelStyle}
            eyebrowStyle={eyebrowStyle}
            selectStyle={selectStyle}
          />
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
                background: "var(--surface)",
                display: "block",
              }}
            />

            <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, marginTop: "6px" }}>
              Not loading? Some browsers and extensions block embedded pages — use “Open in a new tab”.
            </div>
          </div>
        )}

        {/* The "Start practicing" starter strip now lives on the Practice
            home screen (PickupPracticeHome); it reaches loadStarter here
            through LOAD_STARTER_EVENT, wired up below. */}


        {/* ── Songbook + Timer drawers (spec §5.6) ────────────────
            Every handler below is the exact one the old inline "SONGBOOK"
            panel called — nothing here was reimplemented, only re-housed. */}
        {inMode("practice") && (
          <SongbookDrawer
            open={songbookOpen}
            onClose={() => setSongbookOpen(false)}
            formCategories={FORM_CATEGORIES}
            userLibrary={userLibrary}
            gigSongs={GIGBOOK_SONGS}
            selectedForm={selectedForm}
            onLoadForm={(name) => {
              loadForm(name, { exitPractice: true })
              setSongbookOpen(false)
              if (name !== "Custom") logActivity({ label: name, subtitle: "Songbook", art: "changes", action: { type: "songbook" } })
            }}
            onPickSong={(name, row) => { loadSearchPick(name, row); setSongbookOpen(false) }}
            onRemoveFromLibrary={removeFromLibrary}
            onExportPdf={() => exportLeadSheet({ bars, title: selectedForm, tempo: originalTempo }).catch(console.error)}
            onExportMusicXml={() => exportMusicXML({ bars, approachLines, title: selectedForm, tempo: originalTempo })}
            onExportImprovGuide={() => downloadImprovGuide({ bars, title: selectedForm, keyRoot, keyMode, tempo: originalTempo })}
            onExportNotion={async () => {
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
            onImportClick={() => { setShowImportModal(true); setImportText(""); setImportStatus(null) }}
            importModal={showImportModal && (
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
                    <span style={{ fontSize: "var(--db-fs-sm)", color: importStatus.ok ? "var(--passing)" : "var(--hot)" }}>
                      {importStatus.msg}
                    </span>
                  )}
                </div>
              </div>
            )}
          />
        )}

        {inMode("practice") && (
          <TimerDrawer
            open={timerOpen}
            onClose={() => setTimerOpen(false)}
            transportRunning={isPlaying}
            onState={setTimerState}
            onFinish={({ stopBand }) => {
              if (stopBand && playingRef.current) stopPlayback()
              showToast("Practice timer finished")
            }}
          />
        )}

        {/* ── Cockpit / Focus top canvas (spec §5.1/§5.2) ──────────────
            New renders of state that already exists (bar/loop/chord/timer);
            no mechanics live here. Band & Mix and the other power panels
            move below the fretboard card, grouped with Melody Paths / Lead
            Sheet Grid / Metronome. */}
        {inMode("practice") && practiceView === "cockpit" && (
          <>
            <SessionStrip
              timerState={timerState}
              songTitle={activeSongTitle || (selectedForm !== "Custom" ? selectedForm : "Custom chart")}
              loopDescriptor={loopEnabled ? `Loop bars ${Math.min(loopStart, loopEnd) + 1}–${Math.max(loopStart, loopEnd) + 1}${fretboardBar.section ? ` · ${fretboardBar.section} section` : ""}` : (fretboardBar.section ? `${fretboardBar.section} section` : null)}
              focusText={drillFocus ? drillFocus.title : "Bebop scale approach from below"}
              progressPct={loopEnabled
                ? ((fretboardBarIndex - Math.min(loopStart, loopEnd)) / Math.max(1, Math.max(loopStart, loopEnd) - Math.min(loopStart, loopEnd) + 1)) * 100
                : ((selectedIndex + 1) / Math.max(1, bars.length)) * 100}
              loopsDone={loopsDone}
              loopsTarget={100}
              onOpenSongbook={() => setSongbookOpen(true)}
              onOpenTimer={() => setTimerOpen(true)}
            />

            <ChartRibbon
              bars={bars}
              barLabels={barLabels}
              selectedIndex={selectedIndex}
              onSelectBar={setSelectedIndex}
              loopStart={loopStart}
              loopEnd={loopEnd}
              loopEnabled={loopEnabled}
              onSetLoopStart={setLoopStart}
              onSetLoopEnd={setLoopEnd}
              currentIndex={fretboardBarIndex}
              nextIndex={upcomingBarIndices[0]?.index}
              sectionLabel={`${fretboardBar.section ? `${fretboardBar.section} section` : "Chart"}${chartKey ? ` · ${chartKey} concert` : ""}`}
            />

            <AnticipationStrip
              isPlaying={isPlaying && playheadIndex !== null}
              beat={beatInBar}
              beats={fretboardBar.beats ?? 4}
              now={{
                barLabel: barLabels[fretboardBarIndex] ?? fretboardBarIndex + 1,
                symbol: fretboardBar.symbol,
                modeInfo: displayedScaleNotes.length ? `${scaleLabelFull} · ${displayedScaleNotes.join(" ")}` : scaleLabelFull,
              }}
              upcoming={upcomingBarIndices.map(({ index, stepsAway }) => ({
                barLabel: barLabels[index] ?? index + 1,
                symbol: bars[index]?.symbol,
                stepsAway,
              }))}
            />
          </>
        )}

        {inMode("practice") && practiceView === "focus" && (
          <>
            <SessionStrip
              compact
              timerState={timerState}
              songTitle={activeSongTitle || (selectedForm !== "Custom" ? selectedForm : "Custom chart")}
              loopsDone={loopsDone}
              loopsTarget={100}
              onOpenSongbook={() => setSongbookOpen(true)}
              onOpenTimer={() => setTimerOpen(true)}
            />

            <ChartRibbon
              bars={bars}
              barLabels={barLabels}
              selectedIndex={selectedIndex}
              onSelectBar={setSelectedIndex}
              loopStart={loopStart}
              loopEnd={loopEnd}
              loopEnabled={loopEnabled}
              onSetLoopStart={setLoopStart}
              onSetLoopEnd={setLoopEnd}
              currentIndex={fretboardBarIndex}
              nextIndex={upcomingBarIndices[0]?.index}
              sectionLabel={fretboardBar.section ? `${fretboardBar.section} section` : "Chart"}
              showPlayhead
            />

            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "14px", alignItems: "end", marginBottom: "16px" }}>
              <div>
                <div style={{ font: "600 11px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "4px" }}>
                  Bar {barLabels[fretboardBarIndex] ?? fretboardBarIndex + 1} · {scaleLabelFull}
                </div>
                <div style={{ font: "800 96px 'IBM Plex Mono', monospace", lineHeight: 0.85, letterSpacing: "-0.03em", color: "var(--accent)" }}>
                  {fretboardBar.symbol}
                </div>
                {displayedScaleNotes.length > 0 && (
                  <div style={{ color: "var(--muted)", fontSize: "14px", marginTop: "8px" }}>{displayedScaleNotes.join(" ")}</div>
                )}
              </div>
              <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px", padding: "12px 14px" }}>
                <h5 style={{ font: "800 10px 'Archivo', sans-serif", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 8px" }}>Coming up · next 3</h5>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
                  {upcomingBarIndices.map(({ index, stepsAway }, i) => (
                    <div key={i} style={{
                      background: "var(--surface2)", border: `1px solid ${i === 0 ? "var(--info)" : "var(--line)"}`,
                      borderRadius: "8px", padding: "8px 8px", textAlign: "center",
                    }}>
                      <span style={{ font: "600 9px 'IBM Plex Mono', monospace", color: i === 0 ? "var(--info)" : "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", display: "block" }}>
                        {i === 0 ? "Next" : "Then"}
                      </span>
                      <div style={{ font: "800 22px 'IBM Plex Mono', monospace", marginTop: "2px", letterSpacing: "-0.01em" }}>{bars[index]?.symbol}</div>
                      <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "2px" }}>{stepsAway === 1 ? "next bar" : `in ${stepsAway} bars`}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {inMode("practice") && (
          <div data-db-shortcut="fretboard" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", padding: "14px 14px 12px", marginBottom: "16px" }}>
            {/* Header (spec §5.3): title + one-line settings summary + caret that
                opens the settings drawer folded inside the card. */}
            <div
              onClick={() => toggleControlPanel("fretSettings")}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleControlPanel("fretSettings") } }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "10px", cursor: "pointer" }}
            >
              <div style={{ font: "800 12px 'Archivo', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>
                Fretboard · <em style={{ color: "var(--text)", fontStyle: "normal", fontWeight: 900, letterSpacing: "0.02em", textTransform: "none" }}>
                  {fretboardBar.symbol}{scaleLabel ? ` · ${scaleLabelFull}` : ""}
                </em>
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <span style={{ font: "700 10.5px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.06em" }}>
                  {fretboardView === "chord" ? "Chord" : "Scale"}{scaleFilter ? ` + ${scaleFilter}` : ""}
                  {bebopOverlay ? " · +Bebop" : ""}{targetsOverlay ? ` · +${melodyPathModeLabel}` : ""}{anticipateOn ? " · Anticipate" : ""}
                  {" · "}{fretboardTuning}
                </span>
                <span aria-hidden="true" style={{
                  width: "26px", height: "26px", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "6px",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: "10px",
                  transition: "transform .2s", transform: openControlPanels.fretSettings ? "rotate(180deg)" : "none",
                }}>▼</span>
              </div>
            </div>

            {/* Collapsible settings (spec §5.3) — same controls as before, just
                folded inside the card instead of always shown. */}
            {openControlPanels.fretSettings && (
              <div style={{ padding: "12px", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "10px", marginBottom: "12px", display: "grid", gap: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                  <div>
                    <span style={{ font: "700 10px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "5px", display: "block" }}>Systems</span>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
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
                  </div>

                  <div>
                    <span style={{ font: "700 10px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "5px", display: "block" }}>Overlays</span>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      <button onClick={() => setBebopOverlay(p => !p)} style={{
                        padding: "4px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
                        background: bebopOverlay ? "color-mix(in srgb, var(--passing) 22%, transparent)" : "var(--surface)",
                        border:     bebopOverlay ? "1px solid var(--passing)" : "1px solid var(--line)",
                        color:      bebopOverlay ? "var(--passing)" : "var(--text)",
                        fontWeight: bebopOverlay ? 700 : 400,
                        opacity:    bebopOverlay ? 1 : 0.7,
                      }}>
                        +Bebop Chromatic
                      </button>
                      <button onClick={() => setTargetsOverlay(p => !p)} style={{
                        padding: "4px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
                        background: targetsOverlay ? "color-mix(in srgb, var(--target) 22%, transparent)" : "var(--surface)",
                        border:     targetsOverlay ? "1px solid var(--target)" : "1px solid var(--line)",
                        color:      targetsOverlay ? "var(--target)" : "var(--text)",
                        fontWeight: targetsOverlay ? 700 : 400,
                        opacity:    targetsOverlay ? 1 : 0.7,
                      }}>
                        +{melodyPathModeLabel} Path
                      </button>
                      <button onClick={() => { setMelodyPathMode("hunter3"); setTargetsOverlay(true) }} style={{
                        padding: "4px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
                        background: (targetsOverlay && melodyPathMode === "hunter3") ? "color-mix(in srgb, var(--target) 22%, transparent)" : "var(--surface)",
                        border:     (targetsOverlay && melodyPathMode === "hunter3") ? "1px solid var(--target)" : "1px solid var(--line)",
                        color:      (targetsOverlay && melodyPathMode === "hunter3") ? "var(--target)" : "var(--text)",
                        fontWeight: (targetsOverlay && melodyPathMode === "hunter3") ? 700 : 400,
                        opacity:    (targetsOverlay && melodyPathMode === "hunter3") ? 1 : 0.7,
                      }} title="Target the 3rd of the NEXT chord — half-step approach when there is one, or bracket it from both whole tones">
                        +3rd Hunter
                      </button>
                      <button onClick={() => {
                        setEnclosureOn((p) => {
                          const next = !p
                          // The cage needs a target — turning it on implies 3rd Hunter.
                          if (next) { setMelodyPathMode("hunter3"); setTargetsOverlay(true) }
                          return next
                        })
                      }} style={{
                        padding: "4px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
                        background: enclosureOn ? "color-mix(in srgb, var(--n-enclosure) 22%, transparent)" : "var(--surface)",
                        border:     enclosureOn ? "1px solid var(--n-enclosure)" : "1px solid var(--line)",
                        color:      enclosureOn ? "var(--n-enclosure)" : "var(--text)",
                        fontWeight: enclosureOn ? 700 : 400,
                        opacity:    enclosureOn ? 1 : 0.7,
                      }} title="Peña enclosure — show the chromatic cage (half step below and above) around the 3rd Hunter target, plus the target itself, before the chord arrives">
                        +Enclosure
                      </button>
                      <button onClick={() => {
                        // Anticipate is inert without guide tones — there is
                        // nothing for the routes to start from — so turning it
                        // on turns them on too. Turning it off leaves them
                        // alone; you may still want the guide tones by
                        // themselves.
                        const next = !anticipateOn
                        setAnticipateOn(next)
                        if (next) setTargetsOverlay(true)
                      }} style={{
                        padding: "4px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
                        background: anticipateOn ? "color-mix(in srgb, var(--db-c-purple) 20%, var(--db-bg))" : "var(--db-panel-bg)",
                        border:     anticipateOn ? "1px solid var(--db-c-purple)" : "1px solid var(--db-panel-border)",
                        color:      anticipateOn ? "var(--db-c-purple)" : "var(--db-text)",
                        fontWeight: anticipateOn ? 700 : 400,
                        opacity:    anticipateOn ? 1 : 0.7,
                      }} title="Ghost the NEXT chord's guide tones onto this neck and draw the route into them — see the change coming. Turns on Guide Tones, which it needs.">
                        Anticipate
                      </button>
                    </div>
                  </div>

                  <div>
                    <span style={{ font: "700 10px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "5px", display: "block" }}>Tuning</span>
                    <select
                      value={fretboardTuning}
                      onChange={(e) => setFretboardTuning(e.target.value)}
                      style={{ ...selectStyle, width: "auto", padding: "4px 8px", fontSize: "var(--db-fs-sm)" }}
                    >
                      {TUNING_NAMES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Transpose Song (moved from the old Songbook panel — spec §7).
                    Transposes every bar in the chart (bars), not just one part —
                    "part" here was a legacy label, not a scope limit. */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px", paddingTop: "10px", borderTop: "1px dashed var(--line)" }}>
                  <div>
                    <span style={{ font: "700 10px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "5px", display: "block" }}>
                      Current key: {chartKey} {keyMode === "minor" ? "minor" : "major"}
                    </span>
                    <span style={{ font: "700 10px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "5px", display: "block" }}>Transpose song to</span>
                    <label style={inlineLabelStyle}>
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
                  </div>
                  <div>
                    <span style={{ font: "700 10px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "5px", display: "block" }}>Apply</span>
                    <button
                      onClick={handleTransposeChart}
                      style={buttonStyle(keyRoot !== chartKey ? "var(--db-c-amber)" : "var(--db-muted)")}
                      title="Shifts every chord in the chart from the current key to the key picked above"
                    >
                      Transpose Song
                    </button>
                    <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, marginTop: "4px" }}>
                      {keyRoot === chartKey
                        ? "Chart is already in this key."
                        : `Shifts every chord from ${chartKey} to ${keyRoot}.`}
                    </div>
                  </div>
                  <div>
                    <span style={{ font: "700 10px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "5px", display: "block" }}>Chord display</span>
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
              </div>
            )}

            {/* Now-playing readout — always visible, not folded behind settings.
                Centred over the neck: it's the thing you glance up at while
                playing, so it sits above the middle of the board rather than
                off in the left margin. */}
            <div style={{ display: "flex", alignItems: "stretch", justifyContent: "center", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
              {timerState && (() => {
                const { seconds, running, done, duration } = timerState
                const urgent = done || (running && seconds <= 10)
                const label = done ? "TIME" : running ? "TIMER" : seconds < duration ? "PAUSED" : "TIMER"
                const tColor = urgent ? "var(--db-c-salmon)" : running ? "var(--db-c-green)" : "var(--db-muted)"
                return (
                  <div
                    title="Practice timer — set it in the Timer drawer"
                    style={{
                      display: "flex", flexDirection: "column", justifyContent: "center",
                      textAlign: "center", lineHeight: 1.1,
                      padding: "8px 14px", borderRadius: "var(--db-r-md)",
                      border: `2px solid color-mix(in srgb, ${tColor} ${running || done ? "100%" : "40%"}, transparent)`,
                      background: running || done ? `color-mix(in srgb, ${tColor} 12%, var(--db-bg))` : "var(--db-panel-bg)",
                      opacity: running || done ? 1 : 0.7,
                    }}
                  >
                    <div style={{ fontSize: "var(--db-fs-xs)", letterSpacing: "0.12em", opacity: 0.7, marginBottom: "3px" }}>{label}</div>
                    <div style={{ fontSize: "1.8rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: tColor }}>
                      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
                    </div>
                  </div>
                )
              })()}
              <div
                aria-live="polite"
                style={{
                  textAlign: "center", lineHeight: 1.1,
                  padding: "8px 16px", borderRadius: "var(--db-r-md)",
                  border: `2px solid ${(isPlaying && playheadIndex !== null) ? "var(--db-c-green)" : "var(--db-c-amber)"}`,
                  background: (isPlaying && playheadIndex !== null)
                    ? "color-mix(in srgb, var(--db-c-green) 14%, var(--db-bg))"
                    : "color-mix(in srgb, var(--db-c-amber) 10%, var(--db-bg))",
                  boxShadow: (isPlaying && playheadIndex !== null) ? "0 0 16px color-mix(in srgb, var(--db-c-green) 30%, transparent)" : "none",
                  minWidth: "180px",
                }}
              >
                <div style={{ fontSize: "var(--db-fs-xs)", letterSpacing: "0.12em", opacity: 0.7, marginBottom: "3px" }}>
                  {(isPlaying && playheadIndex !== null) ? "NOW PLAYING" : "SELECTED"} · BAR {barLabels[fretboardBarIndex] ?? fretboardBarIndex + 1}
                </div>
                <div style={{ fontSize: "2.4rem", fontWeight: 800, letterSpacing: "-0.01em", color: (isPlaying && playheadIndex !== null) ? "var(--db-c-green)" : "var(--db-c-amber)" }}>
                  {fretboardBar.symbol}
                </div>
                <div style={{ fontSize: "var(--db-fs-lg)", fontWeight: 700, marginTop: "3px", color: "var(--db-c-blue)" }}>{scaleLabelFull}</div>
                {displayedScaleNotes.length > 0 && (
                  <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.75, marginTop: "3px", letterSpacing: "0.04em" }}>
                    {displayedScaleNotes.join(" · ")}
                  </div>
                )}
              </div>
            </div>

            {/* Legend (spec §5.3) — always the same maple note-role colors, never the palette */}
            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginBottom: "12px", fontSize: "12px", color: "var(--muted)" }}>
              <span><span style={{ color: "var(--n-root)" }}>●</span> Root</span>
              <span><span style={{ color: "var(--n-chord)" }}>●</span> Chord tone</span>
              <span><span style={{ color: "var(--n-scale)" }}>●</span> Scale tone</span>
              <span style={{ opacity: bebopOverlay || scaleFilter === "barry" ? 1 : 0.5 }}>
                <span style={{ color: "var(--n-passing)" }}>●</span> {scaleFilter === "barry" ? "Barry passing tone" : "Bebop passing"}
              </span>
              <span style={{ opacity: targetsOverlay ? 1 : 0.5 }}>
                <span style={{ color: "var(--n-target)" }}>●</span>{" "}
                {melodyPathMode === "hunter3" ? "3rd & 7th of this chord (guide tones)" : `${melodyPathModeLabel} path · 3rd & 7th`}
              </span>
              {targetsOverlay && melodyPathMode === "hunter3" && (
                <span><span style={{ color: "var(--n-enclosure)" }}>◌</span> Leads into the next 3rd →</span>
              )}
              {enclosureOn && (
                <span><span style={{ color: "var(--n-enclosure)" }}>◌</span> Enclosure (½ step around next target)</span>
              )}
              {ghostGuideTones.length > 0 && (
                <span style={{ color: "var(--n-next)" }}>○ next chord · ⌒ route in · ◎ held tone, stay put</span>
              )}
              {targetsOverlay && (anticipateOn || melodyPathMode === "hunter3") && ghostGuideTones.length === 0 && (
                <span style={{ color: "var(--n-target)" }}>→ up a semitone · →→ up a whole tone · ← ←← down · = stays</span>
              )}
            </div>

            {/* THE MAPLE BOARD — always the same wood/note colors (spec §4.7),
                untouched click-to-hear / swipe / pinch handlers. */}
            <div className="db-mobile-only" style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, marginBottom: "4px" }}>
              Swipe the neck sideways to reach the upper frets · pinch to zoom
            </div>
            {/* Focus view gets a bigger board (spec §5.2) — same component and
                props, just scaled up; Cockpit stays at 1x. */}
            <div style={{ overflowX: "auto", marginBottom: "4px", zoom: practiceView === "focus" ? 1.18 : 1 }}>
              <Fretboard
                chordNotes={fretboardInfo.notes || []}
                rootNote={martinoMap ? martinoMap.displayRoot : (fretboardBar.userTonic ?? fretboardBar.root)}
                scaleNotes={displayedScaleNotes}
                targetNotes={enclosureDisplay.target}
                passingNotes={[...bebopPassingNotes, ...barryPassingNotes]}
                guideToneNotes={guideToneDisplayNotes}
                guideToneDirections={guideToneDirections}
                enclosureNotes={enclosureDisplay.notes}
                ghostNotes={ghostGuideTones}
                animate={isPlaying && playheadIndex !== null}
                barSeconds={fretboardBarSeconds}
                phaseKey={playheadIndex}
                view={fretboardView}
                tuningName={fretboardTuning}
              />
            </div>

            {/* Anticipate — when the ghosts are on the board above they already
                say where the next chord is, so this collapses to a readout.
                3rd Hunter (which the ghosts skip) keeps the full second maple
                board, dimmed to read as "coming up" rather than "now". */}
            {anticipateOn && anticipateBar && ghostGuideTones.length > 0 && (
              <div style={{
                marginTop: "6px", padding: "6px 10px",
                borderRadius: "var(--db-r-sm)",
                border: "1px solid color-mix(in srgb, var(--n-next) 45%, transparent)",
                background: "color-mix(in srgb, var(--n-next) 8%, transparent)",
                display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap",
              }}>
                <div style={{ fontSize: "var(--db-fs-xs)", fontWeight: 700, letterSpacing: "0.12em", color: "var(--n-next)", textTransform: "uppercase" }}>
                  Next · Bar {barLabels[anticipateBarIndex] ?? anticipateBarIndex + 1}
                </div>
                <div style={{ fontSize: "var(--db-fs-lg)", fontWeight: 700 }}>{anticipateBar.symbol}</div>
                <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.75 }}>
                  {melodyPathModeLabel} path {ghostGuideTones.join(" / ") || "—"}
                </div>
              </div>
            )}
            {anticipateOn && anticipateBar && ghostGuideTones.length === 0 && (
              <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed var(--db-panel-border)", opacity: 0.6 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "4px" }}>
                  <div style={{ fontSize: "var(--db-fs-xs)", fontWeight: 700, letterSpacing: "0.12em", color: "var(--muted)", textTransform: "uppercase" }}>
                    Next · Bar {barLabels[anticipateBarIndex] ?? anticipateBarIndex + 1}
                  </div>
                  <div style={{ fontSize: "var(--db-fs-lg)", fontWeight: 700 }}>{anticipateBar.symbol}</div>
                  <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.75 }}>
                    {melodyPathModeLabel} path {(melodyPathState.notesByBar[anticipateBarIndex] || []).join(" / ") || "—"}
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <Fretboard
                    chordNotes={anticipateInfo.notes || []}
                    rootNote={anticipateBar.userTonic ?? anticipateBar.root}
                    scaleNotes={[]}
                    targetNotes={[]}
                    passingNotes={[]}
                    guideToneNotes={melodyPathState.notesByBar[anticipateBarIndex] || []}
                    view="chord"
                    tuningName={fretboardTuning}
                  />
                </div>
              </div>
            )}

            <div className="fret-foot" style={{ fontSize: "11px", color: "var(--muted)", marginTop: "8px", textAlign: "center", fontStyle: "italic" }}>
              Swipe the neck sideways to reach the upper frets · pinch to zoom
            </div>
          </div>
        )}

        {/* Below-row (spec §5.1) — Cockpit only; Focus skips straight to a
            practice-line card, see below. */}
        {inMode("practice") && practiceView === "cockpit" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <FocusGoalCard
              mode={drillMode}
              onModeChange={chooseDrillMode}
              focusTitle={drillFocus?.title}
              focusDetail={drillFocus?.detail}
              stageLabel={drillFocus?.stageLabel}
              chartKey={chartKey}
              loopsDone={loopsDone}
              timerLabel={timerState ? `${Math.floor(Math.max(0, (timerState.duration ?? 0) - (timerState.seconds ?? 0)) / 60)}:${String(Math.floor(Math.max(0, (timerState.duration ?? 0) - (timerState.seconds ?? 0)) % 60)).padStart(2, "0")}` : "0:00"}
              targetNotes={loopEnabled
                ? Array.from({ length: Math.max(loopStart, loopEnd) - Math.min(loopStart, loopEnd) + 1 }, (_, i) => melodyPathState.notesByBar[Math.min(loopStart, loopEnd) + i]).filter(Boolean).flat()
                : []}
            />
            <BackingBandCard
              compingStyle={compingStyle}
              playChords={playChords}
              onToggleChords={() => setPlayChords((v) => !v)}
              bassStyle={bassStyle}
              playBass={playBass}
              onToggleBass={() => setPlayBass((v) => !v)}
              drumStyleLabel={DRUM_STYLES[drumStyleIdx].name}
              playDrums={playDrums}
              onToggleDrums={() => setPlayDrums((v) => !v)}
              playMelody={playMelody}
              onToggleMelody={() => setPlayMelody((v) => !v)}
            />
          </div>
        )}

        {inMode("practice") && practiceView === "focus" && (
          <div style={{ textAlign: "center", padding: "16px 20px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px", marginBottom: "16px" }}>
            <div style={{ font: "800 10.5px 'Archivo', sans-serif", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted)" }}>Practicing</div>
            <div style={{ font: "700 20px 'Instrument Sans', sans-serif", marginTop: "5px", lineHeight: 1.3 }}>
              Approach the <em style={{ color: "var(--info)", fontStyle: "normal" }}>3rd</em> of every dominant chord from a half-step below
            </div>
          </div>
        )}

        {inMode("practice") && (
          <PowerPanel
            title="Band &amp; Mix"
            subtitle="Tempo, swing, comping, bass, drums, melody — live while playing"
            open={openControlPanels.band}
            onToggle={() => toggleControlPanel("band")}
          >
            <div className="db-controls" style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
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
                take effect while the band keeps playing. Loop range and Start/End Here now live
                on the chart ribbon above; Loop on/off is on the sticky transport below.
              </div>
          </PowerPanel>
        )}

        {inMode("practice") && (
          <PowerPanel
            title="Melody Paths"
            subtitle="Guide-tone skeletons and one-note-per-measure melody mapping"
            open={openControlPanels.melody}
            onToggle={() => toggleControlPanel("melody")}
            keepMounted
          >
          <MelodyPaths
            key={`${activeSongTitle || selectedForm}:${keyRoot}:${keyMode}:${bars.map(bar => `${bar.symbol}:${bar.beats || 4}`).join("|")}`}
            bars={bars}
            tonic={keyRoot}
            keyMode={keyMode}
            title={activeSongTitle || (selectedForm !== "Custom" ? selectedForm : "Custom chart")}
            formCategories={FORM_CATEGORIES}
            userLibrary={userLibrary}
            gigSongs={GIGBOOK_SONGS}
            onPickSong={loadSearchPick}
            playheadIndex={playheadIndex}
            guideMode={melodyPathMode}
            onGuideModeChange={setMelodyPathMode}
            onPathChange={setMelodyPathState}
            showEnclosure={enclosureOn}
            onShowEnclosureChange={setEnclosureOn}
          />
          </PowerPanel>
        )}

        {inMode("practice") && (
          <PowerPanel
            title="Lead Sheet Grid"
            subtitle="Edit, arrange, transpose, and inspect every bar"
            open={openControlPanels.leadsheet}
            onToggle={() => toggleControlPanel("leadsheet")}
          >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", margin: "0 0 10px" }}>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <span style={{ fontSize: "var(--db-fs-sm)", opacity: 0.62, marginRight: "2px" }}>cols:</span>
              {[2, 3, 4, 6, 8].map(n => (
                <button key={n} onClick={() => setGridColumns(n)}
                  aria-label={`Show ${n} bars per row`}
                  aria-pressed={gridColumns === n}
                  style={{
                  padding: "3px 8px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
                  background: gridColumns === n ? "var(--sel)" : "var(--surface)",
                  border: gridColumns === n ? "1px solid var(--db-c-amber)" : "1px solid var(--db-card-border)",
                  color: gridColumns === n ? "var(--db-c-amber)" : "var(--db-muted)",
                  fontWeight: gridColumns === n ? 700 : 400,
                }}>{n}</button>
              ))}
              <button onClick={() => setScrollMode(p => !p)} style={{
                padding: "3px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
                background: scrollMode ? "var(--sel)" : "var(--surface)",
                border: scrollMode ? "1px solid var(--db-c-blue)" : "1px solid var(--db-card-border)",
                color: scrollMode ? "var(--db-c-blue)" : "var(--db-muted)",
                fontWeight: scrollMode ? 700 : 400,
                marginLeft: "4px",
              }}>📜 Scroll</button>
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
                    border: "2px solid var(--accent)",
                    boxShadow: "0 0 28px var(--sel)",
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
                          const functionLabel = harmonicContext[globalIdx]?.functionLabel || "color"
                          return (
                            <div
                              key={globalIdx}
                              onClick={() => setSelectedIndex(globalIdx)}
                              style={{
                                padding: "10px",
                                borderRadius: "var(--db-r-md)",
                                background: isPlayhead ? "var(--loop)" : isActive ? "var(--sel)" : "var(--surface)",
                                border: isPlayhead ? "1px solid var(--hot)" : isActive ? "1px solid var(--chord)" : "1px solid var(--line)",
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
                              <div style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-c-salmon)", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                {functionLabel}
                              </div>
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
              const context = harmonicContext[index]
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
                      fontSize: "var(--db-fs-sm)",
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      color: "var(--db-accent)",
                      opacity: 0.85,
                      paddingTop: index > 0 ? "10px" : "0",
                      paddingBottom: "4px",
                      borderBottom: "1px solid var(--line)",
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
                      ? "2px solid var(--accent)"
                      : active
                      ? "2px solid var(--chord)"
                      : inLoop && loopEnabled
                      ? "1px solid var(--hot)"
                      : "1px solid var(--db-card-border)",
                    background: isPlayhead
                      ? "color-mix(in srgb, var(--accent) 22%, var(--bg))"
                      : active
                      ? "var(--sel)"
                      : inLoop && loopEnabled
                      ? "var(--loop)"
                      : "var(--db-card-bg)",
                    boxShadow: dragIndex === index
                      ? "0 0 0 2px var(--chord)"
                      : isPlayhead
                      ? "0 0 16px color-mix(in srgb, var(--accent) 45%, transparent)"
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
                          borderRadius: "var(--db-r-sm)", background: "var(--sel)",
                          border: "1px solid var(--chord)", color: "var(--chord)",
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
                          background: (bar.beats ?? 4) === 2 ? "var(--sel)" : "none",
                          border: (bar.beats ?? 4) === 2 ? "1px solid var(--chord)" : "none",
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
                            background: "none", border: "none", color: "var(--hot)", opacity: 0.65,
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

                  {/* One compact harmonic role. Melody Paths owns the note-level guidance. */}
                  <div style={{
                    display: "inline-block", marginBottom: "8px",
                    fontSize: "var(--db-fs-xs)", fontWeight: 800, letterSpacing: "0.06em",
                    textTransform: "uppercase", color: "var(--db-c-salmon)",
                  }}>
                    {context?.functionLabel || "color"}
                  </div>

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
          </PowerPanel>
        )}

        {inMode("reference") && <ReferenceGuides panelStyle={panelStyle} />}

        {/* ── FRET FLOW ─────────────────────────────────────────────── */}
        {inMode("reference") && (() => {
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

        {inMode("practice") && (
          <PowerPanel
            title="BeatForge Metronome"
            subtitle="Standalone time workout with programmable accents"
            open={openControlPanels.metronome}
            onToggle={() => toggleControlPanel("metronome")}
            keepMounted
            shortcutId="beatforge-metronome"
          >
            <MetronomePanel
              apiRef={beatforgeRef}
              onBeforeStart={stopPlayback}
              onUserGenerate={() => setLoadedLibraryNum(null)}
              panelStyle={{ ...panelStyle, margin: "0" }}
              eyebrowStyle={eyebrowStyle}
              selectStyle={selectStyle}
              inlineLabelStyle={inlineLabelStyle}
            />
          </PowerPanel>
        )}

        {inMode("practice") && (
          <PowerPanel
            title="BeatForge Library"
            subtitle="30 bebop rhythm patterns — tap to load and play"
            open={openControlPanels.beatforgeLibrary}
            onToggle={() => toggleControlPanel("beatforgeLibrary")}
            shortcutId="beatforge-library"
          >
            <BeatForgeLibrary
              loadedNum={loadedLibraryNum}
              onLoad={(pattern) => {
                setLoadedLibraryNum(pattern.num)
                // Reveal the Metronome panel too — that's where the loaded
                // sheet and Start/Stop live.
                setOpenControlPanels((prev) => ({ ...prev, metronome: true }))
                beatforgeRef.current?.loadPattern?.(pattern)
              }}
            />
          </PowerPanel>
        )}

        {dnMeta && inMode("practice") && <DesertNoirPanel meta={dnMeta} />}
      </section>

      {/* Sticky transport (spec §5.7) — always reachable in Practice mode,
          synced display of the same play/loop/tempo/swing/timer state the
          Band & Mix panel and chart ribbon edit. */}
      {inMode("practice") && (
        <StickyTransport
          isPlaying={isPlaying}
          onTogglePlay={isPlaying ? stopPlayback : () => startPlayback().catch(console.error)}
          loopEnabled={loopEnabled}
          onToggleLoop={() => setLoopEnabled((v) => !v)}
          tempo={tempo}
          onTempoChange={setTempo}
          swingAmount={swingAmount}
          loopStart={loopStart}
          loopEnd={loopEnd}
          timerState={timerState}
          onOpenSettings={() => setOpenControlPanels((prev) => ({ ...prev, band: true }))}
        />
      )}

      {/* Transient toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", zIndex: 60,
          background: "var(--db-panel-bg)", color: "var(--db-text)",
          border: "1px solid var(--db-accent)", borderRadius: "var(--db-r-md)",
          padding: "10px 18px", fontSize: "var(--db-fs-md)",
          boxShadow: "0 8px 30px var(--shadow)", backdropFilter: "blur(8px)",
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

      <div style={{ border: "1px dashed var(--accent)", borderRadius: "var(--db-r-md)", padding: "14px 16px", background: "var(--sel)" }}>
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
