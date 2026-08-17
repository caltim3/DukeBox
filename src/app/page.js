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
import { upsertLibrarySong, catalogEntryToPlayable, OPEN_LIBRARY_EVENT, ENTER_FOCUS_EVENT, GO_GIG_EVENT } from "@/lib/music/songSource"
import { guidedPrescription, drillStage, nextKeyInCycle, DRILL_LOOPS_PER_STAGE, PENA_DRILLS } from "@/lib/music/penaDrills"
import { STARTER_PRESETS, STARTER_STRIP, LOAD_STARTER_EVENT } from "@/lib/music/starters"
import Fretboard, { fretPositions, FRETBOARD_FRETS } from "@/components/Fretboard"
import { classifySongForm, getLevelDefs, resolvePentaChoice, buildPentaBoard, buildScaleBoard, PENTA_LEGEND } from "@/lib/music/threeTwoSystem"
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

// Tempo range shared by the slider and the keyboard nudges, so the two can
// never disagree about how slow or fast the band is allowed to go. The floor
// sits under Practice Mode's 50 BPM — you have to be able to nudge down from
// there without the number pinning above where you already are.
const TEMPO_MIN = 40
const TEMPO_MAX = 300

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

  // Freeze — the band stops, and the floating chart ribbon becomes a silent
  // practice pad: click a chord to put it on the fretboard with no rhythm or
  // chord sound behind it, click the same (already-selected) chord again to
  // hear just that one chord at the song's tempo. Unfreezing picks the
  // transport back up exactly where freezing left it — same tempo, same loop
  // range, only running again if it was running before.
  const [freezeMode, setFreezeMode] = useState(false)
  const freezeWasPlayingRef = useRef(false)

  const [keyRoot, setKeyRoot] = useState("Bb")
  const [keyMode, setKeyMode] = useState("major")
  // The toggle for this lived in the Fretboard settings drawer; removed to
  // narrow that panel (more fretboard, less chrome, in Focus especially).
  // The Lead Sheet Grid's own roman-numeral row (below) is left in place,
  // just permanently off — nothing else in the app currently offers a way
  // to turn it back on.
  const showRomanNumerals = false
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
  // Labels: note names to study with, degrees to play with. Degrees are
  // transposition-invariant, so they survive the key changes Bebop Gym makes.
  const [labelMode, setLabelMode] = useState("names")
  // Fret focus: off | manual | auto. Off by default — the whole neck stays live
  // so you can roam; this is for when you want to drill one position.
  const [focusMode, setFocusMode] = useState("off")
  const [focusStart, setFocusStart] = useState(5)
  const [focusSpan, setFocusSpan] = useState(4)
  // The "3:2 System" — the leveled, song-aware pentatonic navigator
  // (src/lib/music/threeTwoSystem.js). A toggle that sits beside
  // Off/Manual/Auto rather than a fourth Fret-focus option among them: it
  // swaps which notes the board draws (the reference page's Chord-scales /
  // Home-base-or-Inside / Chase-or-Color / Altered ladder instead of
  // chord/scale tones), not whether a fret window narrows the neck. It has
  // no window of its own, though — the reference page draws every fret
  // evenly at full opacity, no dimming, no windowing — so it doesn't touch
  // focusMode at all; Fretboard.js ignores the focus window outright while
  // it's active regardless, belt-and-suspenders.
  const [threeTwoMode, setThreeTwoMode] = useState(false)
  const [threeTwoLevel, setThreeTwoLevel] = useState(1)
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

  // Focus is the phone mode. Top to bottom and nothing else: the chord you're
  // on with the clock and what's coming, the neck edge to edge, the transport
  // sat under it rather than floating across it.
  const focusStage = inMode("practice") && practiceView === "focus"

  // Entering asks the phone for landscape — a 12-fret neck wants the long side
  // of the screen. The lock only holds inside fullscreen on Android and isn't
  // offered at all on iOS, so both calls are attempts, not requirements; the
  // layout stands up either way and just reads smaller in portrait.
  const enterFocusMode = useCallback(async () => {
    choosePracticeView("focus")
    try {
      const el = document.documentElement
      if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen()
      await window.screen?.orientation?.lock?.("landscape")
    } catch { /* orientation lock is a nicety, not a requirement */ }
  }, [choosePracticeView])

  // Stamped on <body> so fixed furniture belonging to other surfaces (the
  // return-home badge, which sits exactly where Focus's title bar goes) can
  // stand down while the stage is up.
  useEffect(() => {
    document.body.classList.toggle("db-focus-mode", focusStage)
    return () => document.body.classList.remove("db-focus-mode")
  }, [focusStage])

  // Stamped on <body> so KeyboardShortcuts.jsx — a standalone component with
  // no props into this one — can tell whether "1" should jump into Focus
  // (playing) or behave as a plain workspace switch (not playing).
  useEffect(() => {
    document.body.dataset.dbPlaying = isPlaying ? "true" : "false"
  }, [isPlaying])

  const exitFocusMode = useCallback(() => {
    choosePracticeView("cockpit")
    try {
      window.screen?.orientation?.unlock?.()
      if (document.fullscreenElement) document.exitFullscreen?.()
    } catch { /* ignore — we're leaving either way */ }
  }, [choosePracticeView])

  // The stage scrolls (see .db-focus-stage in the CSS below): the title bar
  // and its settings drawer sit ABOVE the pinned chord/board/transport, so
  // "scroll up" is the whole affordance for reaching them — no second panel,
  // no modal. focusStageRef is the scrolling element; focusTopbarRef is what
  // the pinned view scrolls *to*, both on entry and any time settings close.
  const focusStageRef = useRef(null)
  const focusTopbarRef = useRef(null)
  const scrollFocusToPlay = useCallback(() => {
    focusTopbarRef.current?.scrollIntoView({ block: "start" })
  }, [])
  useEffect(() => {
    if (!focusStage) return
    const id = requestAnimationFrame(scrollFocusToPlay)
    return () => cancelAnimationFrame(id)
  }, [focusStage, scrollFocusToPlay])

  // The transport's gear used to flip a boolean on a panel most of a page
  // below the fold, which from the transport looked exactly like nothing
  // happening. Open it *and* go to it.
  const openBandPanel = useCallback(() => {
    setOpenControlPanels((prev) => ({ ...prev, band: true }))
    requestAnimationFrame(() => {
      document.querySelector('[data-db-shortcut="band-mix"]')
        ?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
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
  const loopSigRef        = useRef(null)   // last loop range the transport was started with
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

  // "3:2 System" — form classification runs off the whole chart (not just
  // the current bar), so it only needs to recompute when the chart or key
  // actually changes, not on every chord change during playback.
  const songForm = useMemo(() => classifySongForm(bars), [bars])
  const threeTwoLevelDefs = useMemo(() => getLevelDefs(songForm.type), [songForm.type])
  // Per-bar pentatonic pick for Levels 1-3, reusing harmonicContext — the
  // same cadence/function read (analyzeProgressionContext) that already
  // drives the rest of the app's chord-scale suggestions — so "is this
  // dominant actually resolving" isn't answered twice, two different ways.
  const threeTwoChoice = useMemo(() => {
    if (!threeTwoMode || threeTwoLevel === 0) return { usable: false, family: null, rootNote: null, why: "" }
    return resolvePentaChoice({
      bar: fretboardBar,
      ctxEntry: harmonicContext[fretboardBarIndex] || null,
      levelId: threeTwoLevel,
      formType: songForm.type,
      tonicBar: songForm.tonicBar,
    })
  }, [threeTwoMode, threeTwoLevel, fretboardBar, fretboardBarIndex, harmonicContext, songForm])
  const threeTwoBoard = useMemo(() => {
    if (!threeTwoMode) return { kind: null, cells: [], bandRuns: [] }
    if (threeTwoLevel === 0) {
      if (fretboardBar.quality === "NC") return { kind: "scale", cells: [] }
      const { cells, scaleName } = buildScaleBoard({
        rootNote: fretboardBar.userTonic ?? fretboardBar.root,
        quality: fretboardBar.quality,
        tuningName: fretboardTuning,
        labelMode,
      })
      return { kind: "scale", cells, scaleName }
    }
    if (!threeTwoChoice.usable) return { kind: "penta", cells: [], bandRuns: [] }
    const { cells, bandRuns } = buildPentaBoard({
      rootNote: threeTwoChoice.rootNote, family: threeTwoChoice.family,
      tuningName: fretboardTuning, labelMode,
      markBlueNote: threeTwoChoice.blueNote,
    })
    return { kind: "penta", cells, bandRuns }
  }, [threeTwoMode, threeTwoLevel, fretboardBar, threeTwoChoice, fretboardTuning, labelMode])
  const threeTwoActiveOnBoard = threeTwoMode && fretboardTuning === "Standard" && threeTwoBoard.cells.length > 0

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
  // Hexatonic, Hex·Chord and Martino modes use dedicated two-note passing
  // tone rules (M7+b9 for minorHex, b6+b7 for majorHex) instead of the
  // standard single-note bebop. Hex·Chord shares Hexatonic's rule (not its
  // own) because its major/minor-7 formulas are the identical semitone sets
  // — "Major minus 4" / "Dorian minus 6" in HEX_INTERVALS is majorHex/
  // minorHex by another name — so the same two added tones are correct
  // there too. (Previously Hex·Chord fell through to the standard one-note
  // rule instead, which doesn't match a six-note scale the way it matches a
  // seven-note one — see docs/FRETBOARD_CHORD_SCALE_CONTROLS.md.)
  const bebopPassingNotes = useMemo(() => {
    if (!bebopOverlay) return []
    const effectiveRoot    = martinoMap ? martinoMap.displayRoot    : (fretboardBar.userTonic ?? fretboardBar.root)
    const effectiveQuality = martinoMap ? martinoMap.displayQuality : fretboardBar.quality

    if (scaleFilter === "hexatonic" || scaleFilter === "hexchord" || martinoMap) {
      const base    = applyScaleFilter([], effectiveRoot, effectiveQuality, scaleFilter === "hexchord" ? "hexchord" : "hexatonic")
      const baseSet = new Set(base)
      return getHexatonicBebopNotes(effectiveRoot, effectiveQuality).filter(n => n && !baseSet.has(n))
    }

    // Standard bebop: one chromatic passing tone on top of the current scale
    const base      = applyScaleFilter(fretboardScaleData[0]?.notes ?? [], effectiveRoot, effectiveQuality, scaleFilter)
    const withBebop = applyScaleFilter(base, effectiveRoot, effectiveQuality, "bebop")
    const baseSet   = new Set(base)
    return withBebop.filter(n => !baseSet.has(n))
  }, [bebopOverlay, fretboardScaleData, fretboardBar, scaleFilter, martinoMap])

  // One concept, three states. The board used to expose 7→3, Smooth, Melody,
  // 3rd Hunter, Enclosure and Anticipate as six separate switches you had to
  // combine correctly to see anything useful. Voice Leading IS that
  // combination — guide tones, ghosts of the next chord and the routes into
  // them — so it is one choice now, and the default.
  const guideMode = !targetsOverlay
    ? "off"
    : melodyPathMode === "melody" ? "melody" : "voice"

  const chooseGuideMode = useCallback((mode) => {
    if (mode === "off") {
      setTargetsOverlay(false)
      setAnticipateOn(false)
      setEnclosureOn(false)
      return
    }
    setTargetsOverlay(true)
    setEnclosureOn(false)
    if (mode === "melody") {
      setMelodyPathMode("melody")
      setAnticipateOn(false)          // a drawn melody has no next-chord target
    } else {
      setMelodyPathMode("73")
      setAnticipateOn(true)           // anticipation is part of voice leading, not a separate switch
    }
  }, [])


  // The fretboard consumes Melody Paths' selected line directly. This keeps
  // every present and future path mode in sync without reimplementing its
  // note-selection rules here. notesByBar entries are always arrays — one
  // note normally, two for a 3rd Hunter bracket (no half-step approach, so
  // both whole tones around the target get shown).
  const guideToneDisplayNotes = useMemo(() => {
    if (!targetsOverlay) return []
    return melodyPathState.notesByBar[fretboardBarIndex] || []
  }, [targetsOverlay, melodyPathState, fretboardBarIndex])

  // Which of those lit notes is the 7th — the board draws it gold at the same
  // size as the 3rd, so the pair reads as a pair without merging into one note.
  const seventhDisplayNotes = useMemo(() => {
    if (!targetsOverlay) return []
    return melodyPathState.seventhsByBar?.[fretboardBarIndex] || []
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
  // Checked first, ahead of every other branch: once the 3:2 System is
  // actually driving the board, none of scaleFilter/martinoMap describes
  // what's showing anymore — this label used to keep quoting the plain
  // recommended scale the whole time 3:2 was on, the one place in the app
  // that still lied about what was on the neck (see
  // docs/FRETBOARD_CHORD_SCALE_CONTROLS.md, "one live sentence" item).
  const scaleLabel = threeTwoActiveOnBoard
    ? (threeTwoLevel === 0
        ? `3:2 System · Level 0 · ${threeTwoBoard.scaleName ?? ""}`
        : `3:2 System · Level ${threeTwoLevel}${threeTwoChoice.why ? ` · ${threeTwoChoice.why}` : ""}`)
    : martinoMap
    ? `Martino → ${martinoMap.displayRoot}m${martinoMap.displayQuality === "min7b5" ? " (melodic)" : ""}`
    : scaleFilter === "hexchord"
    ? hexChoiceForChord(fretboardBar.userTonic ?? fretboardBar.root, fretboardBar.quality).label
    : scaleFilter === "barry"
    ? `Barry 6th-Dim (${barryHarrisScale(fretboardBar.userTonic ?? fretboardBar.root, fretboardBar.quality).family})`
    : (scaleFilter ?? fretboardScaleData[0]?.name ?? "")
  const scaleTonic = fretboardBar.userTonic ?? fretboardBar.root
  const scaleLabelFull = scaleLabel
    ? (threeTwoActiveOnBoard || martinoMap || scaleFilter === "hexchord" || scaleFilter === "barry" ? scaleLabel : `${scaleTonic} ${scaleLabel}`)
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
  // next 4 sounding bars — purely a display list for the Anticipation strip
  // (spec §5.5), not a second source of truth for the fretboard's Anticipate
  // overlay (which keeps using anticipateBarIndex, unchanged).
  const upcomingBarIndices = useMemo(() => {
    if (!bars.length) return []
    const lo = loopEnabled ? Math.min(loopStart, loopEnd) : 0
    const hi = loopEnabled ? Math.max(loopStart, loopEnd) : bars.length - 1
    const span = hi - lo + 1
    const found = []
    for (let step = 1; step <= span && found.length < 4; step++) {
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

  // Sets activeGigSongId to the same `form:`/`user:` id buildCatalog() would
  // give this tune, rather than always nulling it — otherwise a chart
  // loaded here (Songbook forms, the starter strip's named presets) doesn't
  // show as loaded when you switch to Gig, even though it's in the catalog.
  function loadForm(formName, { exitPractice = false } = {}) {
    setSelectedForm(formName)
    if (exitPractice) {
      practiceModeRef.current = false
      setPracticeMode(false)
    }
    const form = FORMS[formName]
    if (form) {
      setActiveGigSongId(`form:${formName}`)
      setActiveSongTitle(formName)
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
      setActiveGigSongId(`user:${formName}`)
      setActiveSongTitle(formName)
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
      return
    }
    // Neither a known Songbook form nor a saved song (e.g. "Custom") —
    // nothing catalog-backed is loaded.
    setActiveGigSongId(null)
    setActiveSongTitle(null)
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
      loadSong({
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

  // The unified library's pick handler (SongLibrarySidebar, via the "/"
  // drawer) — same job as loadSearchPick above, but for a catalog entry
  // (My Library / Gig Book / Tavern Set / Songbook, whichever it came from)
  // instead of a Songbook-form name + Gig Book row pair.
  function loadCatalogEntry(entry, opts) {
    const { bars, keyRoot, keyMode, tempo } = catalogEntryToPlayable(entry)
    if (!bars.length) { showToast(`No changes stored for "${entry.title}"`); return }
    logActivity({ label: entry.title, subtitle: entry.source, art: "changes", action: { type: "songbook" } })
    loadSong({ bars, keyRoot, keyMode, tempo, title: entry.title, songId: entry.id, ...opts })
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
    const entry = upsertLibrarySong(setLibrary, draft)
    if (!entry) return
    setSelectedForm(entry.name)
    setSongSheetDraft((current) => current ? { ...current, updatedAt: entry.updatedAt } : current)
    showToast(`Saved ${entry.name} to My Library`)
  }

  function openSongSheetInPractice(draft) {
    loadSong({
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

  // The one path every song load funnels through — Practice's loadForm/
  // loadSearchPick, the "/" library's loadCatalogEntry, Gig Mode's Load/
  // Play/Save-and-reopen, SongSheet's "Open in Practice" — so
  // activeGigSongId/activeSongTitle are always set consistently and Gig
  // Mode's live-measure highlight (which keys off activeGigSongId) lights up
  // no matter which tab the song was loaded from.
  //
  // Gig Mode deliberately STAYS OPEN so you can read the stage chart while it
  // plays — the open chart lights the current measure via activeGigSongId.
  //
  // toFocus: true is how "hit Play" becomes "Focus mode begins" — the
  // library's Play action passes it (from Gig Mode included — Play always
  // drops you into Focus, even when Play was clicked from the Gig tab
  // itself), landing on Practice's Focus stage on the tune you just started.
  // Implies toMode "practice": a caller asking for Focus by definition wants
  // to be on Practice, so it can't forget to ask for both and end up with
  // practiceView flipped to "focus" while mode is still stuck elsewhere.
  // Space/the sticky transport resuming whatever's already loaded don't go
  // through here, so they don't fight it.
  function loadSong({ bars, keyRoot, keyMode, tempo, autoplay, songId, title, toMode, toFocus }) {
    if (toFocus) { chooseMode("practice"); enterFocusMode() }
    else if (toMode) chooseMode(toMode)
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

  // Keyboard tempo nudges — p (−10), [ (−5), ] (+5), \ (+10), = to go back.
  //
  // The first nudge of a run snapshots what you were doing (Practice Mode's
  // pinned 50 BPM, or your own Play Mode tempo) so `=` can put it back. A nudge
  // always leaves Practice Mode, because that mode forces the band to 50 and
  // would swallow the change — the number would move while the band didn't.
  const tempoBeforeNudgeRef = useRef(null)

  const nudgeTempo = useCallback((delta) => {
    const current = practiceModeRef.current ? 50 : tempo
    if (!tempoBeforeNudgeRef.current) {
      tempoBeforeNudgeRef.current = { practiceMode: practiceModeRef.current, tempo }
    }
    const next = Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, current + delta))
    practiceModeRef.current = false
    setPracticeMode(false)
    setTempo(next)
    if (playingRef.current) _audioMod?.updatePlayback({ tempo: next })
  }, [tempo])

  // `=` returns to whatever was live before the nudging started. With nothing
  // to go back to it falls through to the plain Practice/Play toggle, so the
  // key does the same job either way: back to the mode you were practicing in.
  const restoreTempo = useCallback(() => {
    const saved = tempoBeforeNudgeRef.current
    if (!saved) {
      const enabled = !practiceModeRef.current
      const newTempo = enabled ? 50 : originalTempo
      practiceModeRef.current = enabled
      setPracticeMode(enabled)
      setTempo(newTempo)
      if (playingRef.current) _audioMod?.updatePlayback({ tempo: newTempo })
      return
    }
    tempoBeforeNudgeRef.current = null
    practiceModeRef.current = saved.practiceMode
    setPracticeMode(saved.practiceMode)
    setTempo(saved.tempo)
    if (playingRef.current) _audioMod?.updatePlayback({ tempo: saved.practiceMode ? 50 : saved.tempo })
  }, [originalTempo])

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
    // The loop-change effect keys off this signature. Seed it with the range we
    // are about to start, or the state committing a tick later reads as a change
    // and restarts the transport a second time — an audible stutter on a gesture
    // that already started exactly the loop it wanted.
    loopSigRef.current = `${index}-${index}`
    // Pass the range explicitly — loop state hasn't committed yet.
    startPlayback(null, { start: index, end: index }).catch(console.error)
  }

  // Freeze toggle (ChartRibbon's "Freeze" button). Entering stops the
  // transport but remembers whether it was running; leaving resumes it if it
  // was — same tempo, same loop range, both untouched the whole time. Doesn't
  // reuse stopPlayback's own bookkeeping for "was playing," because Freeze
  // needs to remember that answer across the whole frozen session, not just
  // the instant playback stopped.
  function toggleFreeze() {
    if (!freezeMode) {
      freezeWasPlayingRef.current = isPlaying
      if (isPlaying) stopPlayback()
      setFreezeMode(true)
    } else {
      setFreezeMode(false)
      if (freezeWasPlayingRef.current) {
        freezeWasPlayingRef.current = false
        startPlayback().catch(console.error)
      }
    }
  }

  // Freeze's "tap the selected chord again to hear it" — one stab through the
  // shared piano sampler, no transport, no loop, no rhythm section. Sized to
  // the bar's own beat count at the song's current tempo so a whole-note bar
  // rings longer than a half-note one, same math Line Lab's solo preview uses.
  async function previewChordAt(index) {
    const bar = bars[index]
    if (!bar || bar.quality === "NC") return
    const { playChordStab } = await loadAudio()
    const beats = bar.beats ?? 4
    playChordStab(bar.symbol, Math.max(0.4, beats * (60 / tempo))).catch(() => {})
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

  // Deliberately touches nothing about mode/practiceView: Stop must leave
  // you exactly where you were — the editable sheet if that's Gig (its
  // live-measure highlight just turns off with isPlaying), the Focus
  // fretboard if that's where Focus mode had you. Don't add navigation here.
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

  // "/" opens the song library from anywhere the same way — KeyboardShortcuts
  // has no access to this component's state, so it asks by event too.
  useEffect(() => {
    function onOpenLibrary() { setSongbookOpen(true) }
    window.addEventListener(OPEN_LIBRARY_EVENT, onOpenLibrary)
    return () => window.removeEventListener(OPEN_LIBRARY_EVENT, onOpenLibrary)
  }, [])

  // "1" while playing asks for Focus the same way (see loadSong's toFocus,
  // which fires this same jump from the library's Play button).
  useEffect(() => {
    function onEnterFocus() { chooseMode("practice"); enterFocusMode() }
    window.addEventListener(ENTER_FOCUS_EVENT, onEnterFocus)
    return () => window.removeEventListener(ENTER_FOCUS_EVENT, onEnterFocus)
  }, [enterFocusMode]) // eslint-disable-line react-hooks/exhaustive-deps -- chooseMode closes over only stable setters

  // "2" asks for Gig the same way, always (not just while playing) — see
  // GO_GIG_EVENT's doc comment for why goWorkspace()'s DOM-click can't be
  // trusted to work here.
  useEffect(() => {
    function onGoGig() { chooseMode("gig") }
    window.addEventListener(GO_GIG_EVENT, onGoGig)
    return () => window.removeEventListener(GO_GIG_EVENT, onGoGig)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- chooseMode closes over only stable setters

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
      // Tempo from the keyboard, so you can find the speed you can actually
      // play the line at without letting go of the guitar.
      if (!meta && !e.altKey) {
        const bump = { p: -10, P: -10, "[": -5, "]": 5, "\\": 10 }[e.key]
        if (bump != null) {
          e.preventDefault()
          nudgeTempo(bump)
          return
        }
        if (e.key === "=") {
          e.preventDefault()
          restoreTempo()
          return
        }
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
  }, [bars, selectedIndex, clipboardBar, updateBar, cyclePalette, toggleColorMode, mode, practiceView, choosePracticeView, nudgeTempo, restoreTempo])

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

  // Auto focus. Score every candidate window by how much of the next four bars
  // it can actually reach — guide tones weighted over plain chord tones, and
  // nearer bars over later ones — then subtract a penalty for moving, so the
  // window doesn't twitch a fret every bar chasing a marginally better score.
  const autoFocusStart = useMemo(() => {
    if (focusMode !== "auto" || !bars.length) return null
    const positions = fretPositions(fretboardTuning)
    const lookahead = []
    for (let step = 0; step < 4; step++) {
      const bar = bars[(fretboardBarIndex + step) % bars.length]
      if (!bar || bar.quality === "NC") continue
      const info = chordInfo(bar.symbol)
      const guides = melodyPathState.notesByBar[(fretboardBarIndex + step) % bars.length] || []
      lookahead.push({ weight: 1 / (step + 1), guides: new Set(guides), tones: new Set(info.notes || []) })
    }
    if (!lookahead.length) return null

    let best = focusStart, bestScore = -Infinity
    for (let start = 0; start <= FRETBOARD_FRETS - focusSpan; start++) {
      let score = 0
      for (const { weight, guides, tones } of lookahead) {
        for (const pos of positions) {
          if (pos.f < start || pos.f > start + focusSpan) continue
          if (guides.has(pos.note)) score += 2 * weight
          else if (tones.has(pos.note)) score += 0.5 * weight
        }
      }
      score -= Math.abs(start - focusStart) * 0.12   // hysteresis
      if (score > bestScore) { bestScore = score; best = start }
    }
    return best
  }, [focusMode, bars, fretboardBarIndex, fretboardTuning, focusSpan, focusStart, melodyPathState])

  useEffect(() => {
    if (autoFocusStart != null && autoFocusStart !== focusStart) setFocusStart(autoFocusStart)
  }, [autoFocusStart]) // eslint-disable-line react-hooks/exhaustive-deps

  // What the board is actually given: null means no window at all.
  const activeFocusStart = focusMode === "off" ? null : focusStart

  // Changing the loop while the band is running has to restart it. startPlayback
  // slices `bars` to the range once, at call time, so a running transport keeps
  // looping whatever range it started with — hitting Start/End Here mid-take
  // changed the highlight and nothing else, which is what made the looper feel
  // disconnected. startPlayback stops itself first, so this is just a re-call.
  useEffect(() => {
    const signature = loopEnabled
      ? `${Math.min(loopStart, loopEnd)}-${Math.max(loopStart, loopEnd)}`
      : "off"
    const previous = loopSigRef.current
    loopSigRef.current = signature
    if (previous === null || previous === signature) return  // first commit, or no real change
    if (!playingRef.current) return
    startPlaybackRef.current?.().catch(console.error)
  }, [loopEnabled, loopStart, loopEnd])

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

      /* ── Focus stage ────────────────────────────────────────────────
         Focus is the "super mobile" app mode, on a phone or a desktop
         window alike: a fixed full-screen pane over the whole page — not
         just a full-bleed card in the page's own scroll — so it snaps to
         the screen the instant it opens, on any device, whether or not
         the browser's own Fullscreen/orientation-lock calls in
         enterFocusMode() actually take (iOS grants neither).
         Three fixed windows, top to bottom:
           - .db-focus-topbar  — the chord you're on, pinned to the top,
             scaled down from Cockpit's version since here it's permanent
             chrome, not one row in a tall page.
           - .db-focus-board   — the neck, edge to edge, taking every pixel
             the other two don't need.
           - .db-transport-embedded — tempo/loop/play, pinned to the bottom.
         The title bar and its settings drawer (.db-fret-header,
         .db-fret-settings) render ABOVE .db-focus-topbar in normal flow,
         inside the stage's own scroll — off-screen by default (see the
         scroll-to-topbar effect in Home()), one swipe/scroll up away. */
      .db-focus-stage {
        position: fixed; inset: 0; z-index: 500;
        height: 100dvh; width: 100vw;
        box-sizing: border-box;
        display: flex; flex-direction: column;
        overflow-y: auto; overscroll-behavior-y: contain;
        background: var(--surface);
        margin: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        padding: 0 !important;
      }
      .db-focus-stage > * { flex: 0 0 auto; }
      .db-focus-stage .db-fret-header,
      .db-focus-stage .db-fret-settings,
      .db-focus-stage .db-focus-topbar {
        padding-left: 12px; padding-right: 12px; box-sizing: border-box;
      }
      .db-focus-stage .db-fret-header { padding-top: 10px; }
      .db-focus-stage .db-fret-settings { margin-left: 12px; margin-right: 12px; }

      /* The pinned chord readout. Sticky (not the whole stage's own fixed
         positioning) so it scrolls out of the way while the title bar and
         settings drawer above it are being reached, then locks back to the
         top the moment they scroll past. */
      .db-focus-stage .db-focus-topbar {
        position: sticky; top: 0; z-index: 2;
        background: var(--surface);
        padding-top: 8px; padding-bottom: 6px; margin-bottom: 0 !important;
        gap: 6px !important;
      }
      .db-focus-stage .db-focus-chord { font-size: clamp(30px, 6.5vh, 44px) !important; }
      .db-focus-stage .db-focus-clock { font-size: clamp(1rem, 4vh, 1.5rem) !important; }
      /* The scale spelled out in letters, and the next chord's guide tones
         written under the board, are both things the board itself already
         shows — here they're extra height the pinned bar can't spare. */
      .db-focus-stage .db-focus-spelling,
      .db-focus-stage .db-anticipate-readout { display: none !important; }

      /* The neck: everything the topbar and transport don't need, edge to
         edge — no zoom trick, no fixed aspect box, just full width and
         whatever height that leaves. */
      .db-focus-board { zoom: 1; }
      .db-focus-stage .db-focus-board {
        flex: 1 1 auto; min-height: 0;
        display: flex; align-items: center; justify-content: center;
        overflow: hidden !important;
        margin: 0 !important; padding: 0 4px !important;
      }
      .db-focus-stage .db-focus-board svg {
        width: 100% !important; height: auto !important; max-height: 100%;
      }

      /* The legend, the swipe hint and the settings summary are reference,
         not instrument — Focus never has the height to spare for them. */
      .db-focus-stage .db-fret-legend,
      .db-focus-stage .fret-foot,
      .db-focus-stage .db-mobile-only,
      .db-focus-stage .db-fret-summary { display: none !important; }

      /* Tempo/loop/play, pinned to the bottom the same way the topbar pins
         to the top — sticky within the stage's own scroll. */
      .db-focus-stage .db-transport-embedded {
        position: sticky; bottom: 0; z-index: 2;
        margin-top: 0 !important;
        border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; border-bottom: 0 !important;
        padding-top: 6px !important; padding-bottom: max(6px, env(safe-area-inset-bottom)) !important;
      }

      /* Focus owns the screen — the practice-home badge and the normal
         floating transport (hidden anyway once .db-focus-stage covers them,
         but this keeps them from fighting its z-index while transitioning). */
      body.db-focus-mode .db-pickup-return-home,
      body.db-focus-mode .db-transport:not(.db-transport-embedded) { display: none !important; }

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
        // Focus embeds its transport under the neck instead, so it neither
        // needs that clearance nor wants the full side gutter.
        padding: focusStage ? "10px 10px 24px" : inMode("practice") ? "24px 24px 96px" : "24px",
        // Read back by .db-focus-stage to bleed the board out to the edges.
        "--db-page-gutter": focusStage ? "10px" : "24px",
        fontFamily: "Arial, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* overflow stays hidden everywhere but Focus, where the board bleeds
          out past this box on purpose. */}
      <section style={{ minWidth: 0, overflow: focusStage ? "visible" : "hidden" }}>
        {/* Up to 16 bars from the active section, pinned above every workspace.
            Not in Focus: a fixed strip of the lead sheet hanging over the top
            of the screen is exactly the thing covering the neck on a phone,
            and Focus already shows the current bar and the next three. */}
        {!focusStage && (
          <GigBarStrip
            bars={bars}
            title={activeSongTitle || (selectedForm !== "Custom" ? selectedForm : null)}
            playheadIndex={playheadIndex}
            isPlaying={isPlaying}
            onStop={stopPlayback}
          />
        )}
        {/* Chrome — title, theme, workspace tabs, starters. Focus hides the
            lot: on a landscape phone every row above the neck is a row the
            neck doesn't get, and the ✕ chip is the way back to all of it. */}
        {!focusStage && (
        <>
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
                  and the sticky transport are shared by both views. Routed through
                  enter/exitFocusMode rather than choosePracticeView directly — this
                  is the second way into Focus (the dedicated CTA near the transport
                  is the other), and both need the same fullscreen/landscape-lock
                  attempt on the way in and the same release on the way out, or a
                  visitor who uses this toggle to leave Focus would still be stuck
                  in a fullscreen window showing Cockpit underneath it. */}
              <div style={{ display: "flex", gap: 0, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "9px", padding: "3px" }}>
                {[["cockpit", "Cockpit"], ["focus", "Focus"]].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => { if (id === "focus") enterFocusMode(); else exitFocusMode() }}
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
                  onClick={() => { (starterView === "focus" ? enterFocusMode : () => choosePracticeView(starterView))(); loadStarter(preset.id) }}
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
        </>
        )}

        {inMode("gig") && (
          <div style={{ marginBottom: "20px" }}>
            <GigMode
              library={library}
              setLibrary={setLibrary}
              onLoadSong={loadSong}
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


        {/* ── Song library drawer ("/" from anywhere) + Timer drawer ──────
            Renders unconditionally (not gated to Practice) so "/" opens the
            same picker Gig Mode uses no matter which tab you're on. */}
        <SongbookDrawer
            open={songbookOpen}
            onClose={() => setSongbookOpen(false)}
            library={library}
            setLibrary={setLibrary}
            selectedId={activeGigSongId}
            selectStyle={selectStyle}
            onPick={(entry) => { loadCatalogEntry(entry); setSongbookOpen(false) }}
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
              onToggleLoop={() => setLoopEnabled(v => !v)}
              currentIndex={fretboardBarIndex}
              nextIndex={upcomingBarIndices[0]?.index}
              sectionLabel={`${fretboardBar.section ? `${fretboardBar.section} section` : "Chart"}${chartKey ? ` · ${chartKey} concert` : ""}`}
              freezeMode={freezeMode}
              onToggleFreeze={toggleFreeze}
              onPreviewChord={previewChordAt}
              chartKey={chartKey}
              keyRoot={keyRoot}
              keyMode={keyMode}
              onKeyRootChange={setKeyRoot}
              onKeyModeChange={setKeyMode}
              onTranspose={handleTransposeChart}
            />

          </>
        )}

        {/* Focus used to stack a session strip, a twelve-bar ribbon and a 96px
            chord above the board — on a phone that is the whole screen before
            the neck starts. The chord, the clock and what's coming next all
            already live in the fretboard card's readout, so Focus renders that
            card and nothing else. Everything dropped here is one tap away in
            Cockpit, and ✕ CORE in the card's header is that tap. */}

        {inMode("practice") && (
          <div
            ref={focusStage ? focusStageRef : null}
            data-db-shortcut="fretboard"
            className={focusStage ? "db-focus-stage" : undefined}
            style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", padding: "14px 14px 12px", marginBottom: "16px" }}
          >
            {/* Header (spec §5.3): title + one-line settings summary + caret that
                opens the settings drawer folded inside the card. In Focus it
                doubles as the stage's own title bar — the chord is spelled out
                in 52px an inch below, so the title says which tune you're on
                instead, and carries the way back out. In Focus, this header
                (and the settings drawer it opens) sit above the pinned chord/
                board/transport view — see focusStageRef/focusTopbarRef above —
                so opening it scrolls the stage up to show it, and closing it
                scrolls back down to the pinned view. */}
            <div
              className="db-fret-header"
              onClick={() => {
                const opening = !openControlPanels.fretSettings
                toggleControlPanel("fretSettings")
                if (focusStage) requestAnimationFrame(() => {
                  if (opening) focusStageRef.current?.scrollTo({ top: 0, behavior: "smooth" })
                  else scrollFocusToPlay()
                })
              }}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.currentTarget.click() ; e.preventDefault() } }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: focusStage ? "6px" : "10px", cursor: "pointer" }}
            >
              <div style={{ font: "800 12px 'Archivo', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {focusStage ? (
                  <>Focus · <em style={{ color: "var(--text)", fontStyle: "normal", fontWeight: 900, letterSpacing: "0.02em", textTransform: "none" }}>
                    {activeSongTitle || (selectedForm !== "Custom" ? selectedForm : "Custom chart")}
                  </em></>
                ) : (
                  <>Fretboard · <em style={{ color: "var(--text)", fontStyle: "normal", fontWeight: 900, letterSpacing: "0.02em", textTransform: "none" }}>
                    {fretboardBar.symbol}{scaleLabel ? ` · ${scaleLabelFull}` : ""}
                  </em></>
                )}
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <span className="db-fret-summary" style={{ font: "700 10.5px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.06em" }}>
                  {fretboardView === "chord" ? "Chord" : "Scale"}{scaleFilter ? ` + ${scaleFilter}` : ""}
                  {bebopOverlay ? " · +Bebop" : ""}{guideMode === "voice" ? " · Voice Leading" : guideMode === "melody" ? " · Melody" : ""}
                  {" · "}{fretboardTuning}
                </span>
                <span aria-hidden="true" style={{
                  width: "26px", height: "26px", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "6px",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: "10px",
                  transition: "transform .2s", transform: openControlPanels.fretSettings ? "rotate(180deg)" : "none",
                }}>▼</span>
                {focusStage && (
                  <button
                    onClick={(e) => { e.stopPropagation(); exitFocusMode() }}
                    title="Leave Focus and go back to the full practice view"
                    aria-label="Exit Focus mode"
                    style={{
                      flexShrink: 0, font: "800 10px 'IBM Plex Mono', monospace", letterSpacing: "0.12em",
                      padding: "6px 12px", borderRadius: "999px", cursor: "pointer",
                      border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--muted)",
                    }}
                  >
                    ✕ CORE
                  </button>
                )}
              </div>
            </div>

            {/* Collapsible settings (spec §5.3) — revamped per
                docs/FRETBOARD_CHORD_SCALE_CONTROLS.md into two labeled groups
                instead of one flat grid, because they answer two genuinely
                different questions for a player working on connecting lines
                across changes:
                  PALETTE — what's available over THIS chord (Chord/Scale,
                    the five filters, the 3:2 System, Tuning, Labels).
                  CONNECT — how this chord leads into the NEXT one (Voice
                    Leading/Melody/Off, Fret Focus's window).
                Three fixes from that doc's audit land here too: the eight
                PALETTE choices (Chord/Scale/5 filters/3:2 System) are now a
                true mutually-exclusive set — picking any one turns the
                others off, including clearing a still-highlighted filter
                when you click back to Chord, which used to leave it lit
                with no effect. +Bebop Chromatic disables itself over Barry
                6th, which already carries its own passing tone (verified:
                every Barry family's built-in passing chroma is exactly the
                chroma the bebop overlay would otherwise add — it was a
                silent no-op before). And CONNECT says so, in one line, on
                the rare occasion it doesn't apply either. */}
            {openControlPanels.fretSettings && (
              <div className="db-fret-settings" style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px", alignItems: "start",
              }}>
                {/* Side by side, not stacked — the two groups rarely both run
                    tall at once (CONNECT is usually two short rows), so
                    stacking them spent a whole extra screen's worth of height
                    saying two labels instead of one. Collapses back to a
                    single column under 760px, where side-by-side would just
                    wrap every row into an unreadable stack anyway. */}
                <style>{`
                  @media (max-width: 760px) {
                    .db-fret-settings { grid-template-columns: 1fr !important; }
                  }
                `}</style>
                {/* ── PALETTE ──────────────────────────────────────────── */}
                <div style={{ padding: "10px 12px", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "10px" }}>
                  <span style={{ font: "800 10px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px", display: "block" }}>
                    Palette <span style={{ fontWeight: 400, opacity: 0.7, textTransform: "none", letterSpacing: "0" }}>· what&apos;s available over this chord</span>
                  </span>

                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {["chord", "scale"].map((v) => (
                      <button key={v} onClick={() => {
                        setFretboardView(v)
                        setThreeTwoMode(false)
                        if (v === "chord") setScaleFilter(null)   // was left lit with no effect — see doc
                      }} style={{
                        padding: "4px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
                        background: fretboardView === v && !threeTwoMode ? "color-mix(in srgb, var(--db-c-amber) 20%, var(--db-bg))" : "var(--db-panel-bg)",
                        border:     fretboardView === v && !threeTwoMode ? "1px solid var(--db-c-amber)" : "1px solid var(--db-panel-border)",
                        color:      fretboardView === v && !threeTwoMode ? "var(--db-c-amber)" : "var(--db-text)",
                        fontWeight: fretboardView === v && !threeTwoMode ? 700 : 400,
                        opacity:    fretboardView === v && !threeTwoMode ? 1 : 0.7,
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
                        setThreeTwoMode(false)
                        setScaleFilter(prev => {
                          const next = prev === f ? null : f
                          if (next) setFretboardView("scale")
                          return next
                        })
                      }} style={{
                        padding: "4px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
                        background: scaleFilter === f && !threeTwoMode ? "color-mix(in srgb, var(--db-c-blue) 20%, var(--db-bg))" : "var(--db-panel-bg)",
                        border:     scaleFilter === f && !threeTwoMode ? "1px solid var(--db-c-blue)" : "1px solid var(--db-panel-border)",
                        color:      scaleFilter === f && !threeTwoMode ? "var(--db-c-blue)" : "var(--db-text)",
                        fontWeight: scaleFilter === f && !threeTwoMode ? 700 : 400,
                        opacity:    scaleFilter === f && !threeTwoMode ? 1 : 0.7,
                      }}>
                        {label}
                      </button>
                    ))}
                    {/* The "3:2 System" — the Pickup Music 3:2 system, leveled and
                        wired to the loaded song (src/lib/music/threeTwoSystem.js).
                        Lives here now, as the 8th palette choice, rather than
                        beside Fret Focus's Off/Manual/Auto: it isn't a window —
                        it replaces the note-selection pipeline the same way
                        Pentatonic or Barry do, just with its own visual system
                        (exact reference-page colors, diagonal highway bands)
                        instead of the maple board's usual root/chord/scale
                        palette. Turning it on clears scaleFilter (and vice
                        versa) so the highlighted button always matches what's
                        actually on the board — no more all-eight-look-equally-
                        live state while only one of them is doing anything.
                        Reads the loaded chart (bars), classifies its form (blues /
                        jazz blues / standard / modal), and offers that form's own
                        Chord-scales / Home-base-or-Inside / Chase-or-Color /
                        Altered ladder. Colors are the reference page's exact hex
                        (--n-32-* in globals.css), not the app's usual note-role
                        palette — see Fretboard.js's threeTwo prop. */}
                    <button
                      onClick={() => setThreeTwoMode(v => {
                        const next = !v
                        if (next) setScaleFilter(null)
                        return next
                      })}
                      disabled={fretboardTuning !== "Standard"}
                      aria-pressed={threeTwoMode}
                      title={fretboardTuning !== "Standard"
                        ? "3:2 shapes are built for standard tuning only"
                        : "The full leveled 3:2 System, matched to this song's chords"}
                      style={{
                        padding: "4px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)",
                        cursor: fretboardTuning === "Standard" ? "pointer" : "not-allowed",
                        background: threeTwoMode ? "color-mix(in srgb, var(--n-32-blue) 22%, var(--db-bg))" : "var(--db-panel-bg)",
                        border:     threeTwoMode ? "1px solid var(--n-32-blue)" : "1px solid var(--db-panel-border)",
                        color:      threeTwoMode ? "var(--n-32-blue)" : "var(--db-text)",
                        fontWeight: threeTwoMode ? 700 : 400,
                        opacity:    fretboardTuning !== "Standard" ? 0.4 : threeTwoMode ? 1 : 0.7,
                      }}
                    >
                      3:2 System
                    </button>
                  </div>

                  {threeTwoMode && fretboardTuning !== "Standard" && (
                    <span style={{ font: "600 10.5px 'Instrument Sans', sans-serif", color: "var(--muted)", fontStyle: "italic", display: "block", marginTop: "6px" }}>
                      no 3:2 shape for this chord
                    </span>
                  )}
                  {threeTwoMode && fretboardTuning === "Standard" && (
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginTop: "8px" }}>
                      <span style={{ font: "700 10px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        {songForm.label}
                      </span>
                      <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: "7px", overflow: "hidden" }}>
                        {threeTwoLevelDefs.map((lv) => (
                          <button key={lv.id} onClick={() => setThreeTwoLevel(lv.id)} aria-pressed={threeTwoLevel === lv.id}
                            title={lv.note}
                            style={{
                              font: "700 11px 'Instrument Sans', sans-serif", padding: "5px 10px", border: "none", cursor: "pointer",
                              background: threeTwoLevel === lv.id ? "var(--accent)" : "var(--surface)",
                              color: threeTwoLevel === lv.id ? "var(--accent-ink)" : "var(--muted)",
                            }}>
                            {lv.id} · {lv.name}
                          </button>
                        ))}
                      </div>
                      {threeTwoLevel > 0 && !threeTwoChoice.usable && threeTwoChoice.why && (
                        <span style={{ font: "600 10.5px 'Instrument Sans', sans-serif", color: "var(--muted)", fontStyle: "italic" }}>
                          {threeTwoChoice.why}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Tuning isn't a chord-scale decision at all — it's the one
                      instrument setting that ended up in this drawer because it
                      shared a row with Labels, not because it belongs with
                      Systems conceptually. Kept here (moving it elsewhere is a
                      bigger change than this pass), but set apart below a rule
                      so it doesn't read as an 8th SYSTEMS choice. */}
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "10px", paddingTop: "8px", borderTop: "1px dashed var(--line)" }}>
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

                    {/* Labels — note names to study with, degrees to play with. */}
                    <div>
                      <span style={{ font: "700 10px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "5px", display: "block" }}>Labels</span>
                      <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: "7px", overflow: "hidden" }}>
                        {[["names", "Names"], ["degrees", "Degrees"]].map(([id, label]) => (
                          <button key={id} onClick={() => setLabelMode(id)} aria-pressed={labelMode === id}
                            title={id === "degrees" ? "Scale degrees — transposition-invariant, and what you think in mid-solo" : "Note names — the study view"}
                            style={{
                              font: "700 11px 'Instrument Sans', sans-serif", padding: "5px 11px", border: "none", cursor: "pointer",
                              background: labelMode === id ? "var(--accent)" : "var(--surface)",
                              color: labelMode === id ? "var(--accent-ink)" : "var(--muted)",
                            }}>{label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── CONNECT ──────────────────────────────────────────── */}
                <div style={{ padding: "10px 12px", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "10px" }}>
                  <span style={{ font: "800 10px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px", display: "block" }}>
                    Connect <span style={{ fontWeight: 400, opacity: 0.7, textTransform: "none", letterSpacing: "0" }}>· how this chord leads into the next one</span>
                  </span>
                  {threeTwoMode && fretboardTuning === "Standard" && (
                    <div style={{ font: "600 10.5px 'Instrument Sans', sans-serif", color: "var(--muted)", fontStyle: "italic", marginBottom: "8px" }}>
                      The 3:2 System is drawing its own connections right now — Voice Leading and Fret Focus apply again once it&apos;s off.
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "10px" }}>
                    <button onClick={() => setBebopOverlay(p => !p)} disabled={scaleFilter === "barry"}
                      title={scaleFilter === "barry" ? "Barry 6th already includes its own passing tone" : undefined}
                      style={{
                        padding: "4px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)",
                        cursor: scaleFilter === "barry" ? "not-allowed" : "pointer",
                        background: bebopOverlay ? "color-mix(in srgb, var(--passing) 22%, transparent)" : "var(--surface)",
                        border:     bebopOverlay ? "1px solid var(--passing)" : "1px solid var(--line)",
                        color:      bebopOverlay ? "var(--passing)" : "var(--text)",
                        fontWeight: bebopOverlay ? 700 : 400,
                        opacity:    scaleFilter === "barry" ? 0.35 : (bebopOverlay ? 1 : 0.7),
                      }}>
                      +Bebop Chromatic
                    </button>
                    {[
                      ["voice",  "Voice Leading", "3rds and 7ths lit, the next chord ghosted onto the neck, and the route into it drawn as the bar turns over"],
                      ["melody", "Melody",        "Light the melody you drew in Melody Paths below"],
                      ["off",    "Off",           "Chord and scale tones only"],
                    ].map(([id, label, hint]) => (
                      <button key={id} onClick={() => chooseGuideMode(id)} aria-pressed={guideMode === id} title={hint} style={{
                        padding: "4px 12px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
                        background: guideMode === id ? "color-mix(in srgb, var(--target) 22%, transparent)" : "var(--surface)",
                        border:     guideMode === id ? "1px solid var(--target)" : "1px solid var(--line)",
                        color:      guideMode === id ? "var(--target)" : "var(--text)",
                        fontWeight: guideMode === id ? 700 : 400,
                        opacity:    guideMode === id ? 1 : 0.7,
                      }}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Fret focus — off by default so the whole neck stays live. */}
                  <div>
                    <span style={{ font: "700 10px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "5px", display: "block" }}>Fret focus</span>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: "7px", overflow: "hidden" }}>
                        {[["off", "Off"], ["manual", "Manual"], ["auto", "Auto"]].map(([id, label]) => (
                          <button key={id} onClick={() => setFocusMode(id)} aria-pressed={focusMode === id}
                            title={id === "auto" ? "Follow the position that costs the least hand travel over the next four bars" : id === "manual" ? "Pin a window and dim the rest of the neck" : "Whole neck live"}
                            style={{
                              font: "700 11px 'Instrument Sans', sans-serif", padding: "5px 11px", border: "none", cursor: "pointer",
                              background: focusMode === id ? "var(--accent)" : "var(--surface)",
                              color: focusMode === id ? "var(--accent-ink)" : "var(--muted)",
                            }}>{label}</button>
                        ))}
                      </div>
                      {focusMode !== "off" && (
                        <div style={{ display: "inline-flex", gap: "4px", alignItems: "center" }}>
                          <button onClick={() => setFocusStart(v => Math.max(0, v - 1))} disabled={focusMode === "auto"}
                            aria-label="Move the focus window towards the nut"
                            style={{ font: "700 11px 'IBM Plex Mono', monospace", padding: "5px 9px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--muted)", cursor: focusMode === "auto" ? "default" : "pointer", opacity: focusMode === "auto" ? 0.4 : 1 }}>◀</button>
                          <span style={{ font: "700 11px 'IBM Plex Mono', monospace", minWidth: "46px", textAlign: "center", color: "var(--text)" }}>
                            {focusStart}–{focusStart + focusSpan}
                          </span>
                          <button onClick={() => setFocusStart(v => Math.min(FRETBOARD_FRETS - focusSpan, v + 1))} disabled={focusMode === "auto"}
                            aria-label="Move the focus window towards the body"
                            style={{ font: "700 11px 'IBM Plex Mono', monospace", padding: "5px 9px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--muted)", cursor: focusMode === "auto" ? "default" : "pointer", opacity: focusMode === "auto" ? 0.4 : 1 }}>▶</button>
                          <button onClick={() => setFocusSpan(v => (v >= 6 ? 3 : v + 1))}
                            aria-label="Change how many frets the focus window spans"
                            title="Window width"
                            style={{ font: "700 11px 'IBM Plex Mono', monospace", padding: "5px 9px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer" }}>{focusSpan + 1} fr</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Now-playing readout — always visible, not folded behind settings.
                Centred over the neck: it's the thing you glance up at while
                playing, so it sits above the middle of the board rather than
                off in the left margin. Core and Focus share the same markup
                and tile layout — only Focus pins it (.db-focus-topbar, sticky
                to the top of the scrolling stage) and scales it down, since
                there it's permanent chrome competing with the neck for height
                rather than one row in an already-tall page. */}
            <div ref={focusStage ? focusTopbarRef : null} className={focusStage ? "db-focus-topbar" : undefined} style={{
              display: "flex", alignItems: "stretch", justifyContent: "center",
              gap: "10px", flexWrap: "wrap", marginBottom: "10px",
            }}>
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
                      textAlign: "center", lineHeight: 1.1, flexShrink: 0,
                      padding: "8px 14px", borderRadius: "var(--db-r-md)",
                      border: `2px solid color-mix(in srgb, ${tColor} ${running || done ? "100%" : "40%"}, transparent)`,
                      background: running || done ? `color-mix(in srgb, ${tColor} 12%, var(--db-bg))` : "var(--db-panel-bg)",
                      opacity: running || done ? 1 : 0.7,
                    }}
                  >
                    <div style={{ fontSize: "var(--db-fs-xs)", letterSpacing: "0.12em", opacity: 0.7, marginBottom: "3px" }}>{label}</div>
                    <div className="db-focus-clock" style={{ fontSize: "1.8rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: tColor }}>
                      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
                    </div>
                  </div>
                )
              })()}
              <div
                aria-live="polite"
                style={{
                  textAlign: "center", lineHeight: 1.1,
                  padding: "10px 18px", borderRadius: "var(--db-r-md)",
                  border: `2px solid ${(isPlaying && playheadIndex !== null) ? "var(--n-root)" : "var(--line)"}`,
                  background: "var(--surface)",
                  minWidth: "200px",
                  flexShrink: 0,
                }}
              >
                <div style={{ font: "700 10.5px 'IBM Plex Mono', monospace", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "2px" }}>
                  {(isPlaying && playheadIndex !== null) ? "Now" : "Selected"} · Bar {barLabels[fretboardBarIndex] ?? fretboardBarIndex + 1}
                </div>
                {/* Burnt red, the same --n-root the board draws the root with, so
                    the chord you are on reads as one thing across both. */}
                <div className="db-focus-chord" style={{
                  font: "800 52px 'IBM Plex Mono', monospace",
                  lineHeight: 1, margin: "4px 0 2px", letterSpacing: "-0.02em", color: "var(--n-root)",
                }}>
                  {fretboardBar.symbol}
                </div>
                <div style={{ fontSize: "var(--db-fs-sm)", fontWeight: 700, color: "var(--db-c-blue)" }}>{scaleLabelFull}</div>
                {displayedScaleNotes.length > 0 && (
                  <div className="db-focus-spelling" style={{ fontSize: "var(--db-fs-xs)", opacity: 0.75, marginTop: "2px", letterSpacing: "0.04em" }}>
                    {displayedScaleNotes.join(" · ")}
                  </div>
                )}
                {/* The beat meter that used to live only in the strip above.
                    Current beat solid and taller, beats gone dimmer but filled,
                    beats to come hollow — it marches rather than blinking. */}
                <div
                  style={{ display: "flex", gap: "4px", marginTop: "9px", alignItems: "flex-end", height: "11px" }}
                  role="img"
                  aria-label={(isPlaying && beatInBar != null) ? `Beat ${beatInBar + 1} of ${fretboardBar.beats ?? 4}` : `${fretboardBar.beats ?? 4} beats per bar`}
                >
                  {Array.from({ length: Math.max(1, Math.round(fretboardBar.beats ?? 4) || 4) }, (_, i) => {
                    const live = isPlaying && beatInBar != null
                    const isCurrent = live && i === beatInBar
                    const isPast = live && i < beatInBar
                    return (
                      <i key={i} style={{
                        flex: 1,
                        height: isCurrent ? "11px" : "6px",
                        borderRadius: "2px",
                        background: isCurrent || isPast ? "var(--n-root)" : "transparent",
                        boxShadow: isCurrent || isPast ? "none" : "inset 0 0 0 1px var(--n-root)",
                        opacity: isCurrent ? 1 : isPast ? 0.45 : 0.3,
                        transition: "height 70ms ease, opacity 70ms ease, background 70ms ease",
                      }} />
                    )
                  })}
                </div>
              </div>

              {/* Coming up — moved out of the Focus header so it sits beside the
                  chord you're on rather than across the page from it. Same
                  lookahead the ghosts use, four bars deep instead of one.
                  Each tile is smaller and fainter than the one before it, so
                  the row reads as distance: the chord you're about to play is
                  nearly as loud as NOW, and the one four bars out is a hint you
                  can take in without looking straight at it. */}
              {upcomingBarIndices.length > 0 && (
                <div style={{
                  background: "var(--surface)", border: "1px solid var(--line)",
                  borderRadius: "var(--db-r-md)", padding: "8px 12px",
                  display: "flex", flexDirection: "column", justifyContent: "center",
                  minWidth: 0, flexShrink: 0, overflow: "hidden",
                }}>
                  <div style={{ font: "800 9.5px 'Archivo', sans-serif", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "6px" }}>
                    Coming up
                  </div>
                  <div style={{ display: "flex", gap: "5px", alignItems: "stretch" }}>
                    {upcomingBarIndices.map(({ index, stepsAway }, i) => {
                      // One ramp drives size, weight and fade together — mixing
                      // separate per-tile values drifts out of step the moment
                      // the count changes.
                      const near = 1 - i * 0.22        // 1 · .78 · .56 · .34
                      return (
                        <div key={i} style={{
                          background: "var(--surface2)",
                          border: `1px solid ${i === 0 ? "var(--info)" : "var(--line)"}`,
                          borderRadius: "8px",
                          padding: `${4 + Math.round(near * 3)}px ${4 + Math.round(near * 6)}px`,
                          textAlign: "center",
                          minWidth: `${46 + Math.round(near * 26)}px`,
                          alignSelf: "center",
                          opacity: 0.5 + near * 0.5,
                        }}>
                          <span style={{
                            font: `600 ${(7 + near * 1.5).toFixed(1)}px 'IBM Plex Mono', monospace`,
                            color: i === 0 ? "var(--info)" : "var(--muted)",
                            letterSpacing: "0.14em", textTransform: "uppercase", display: "block",
                          }}>
                            {i === 0 ? "Next" : "Then"}
                          </span>
                          <div style={{ font: `800 ${(11 + near * 8).toFixed(1)}px 'IBM Plex Mono', monospace`, marginTop: "2px", letterSpacing: "-0.01em" }}>
                            {bars[index]?.symbol}
                          </div>
                          <div style={{ fontSize: `${(8 + near * 1.5).toFixed(1)}px`, color: "var(--muted)", marginTop: "1px" }}>
                            {stepsAway === 1 ? "next bar" : `in ${stepsAway}`}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* What you're playing, named, immediately above the neck. The
                stage header carries the same title, but that's a settings
                toggle at the top of the card — by the time you're looking at
                the board mid-tune it's out of your eyeline. Left-aligned over
                the nut, above the legend, so it reads as a label on the
                instrument rather than another readout competing with the
                chord. Focus only: Core still has the chart and the song strip
                on screen to tell you the same thing. */}
            {focusStage && (
              <div style={{
                font: "800 13px 'Instrument Sans', sans-serif", color: "var(--text)",
                letterSpacing: "0.01em", marginBottom: "6px", minWidth: 0,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {activeSongTitle || (selectedForm !== "Custom" ? selectedForm : "Custom chart")}
                <span style={{ font: "700 10.5px 'IBM Plex Mono', monospace", color: "var(--muted)", letterSpacing: "0.12em", marginLeft: "8px" }}>
                  {chartKey} {keyMode === "minor" ? "MINOR" : "MAJOR"}
                </span>
              </div>
            )}

            {/* Legend (spec §5.3) — always the same maple note-role colors, never the
                palette. The 3:2 System swaps this for its own key: every other
                overlay is sitting out while it's on (Fretboard.js), so their legend
                entries would just be describing colors that aren't on the board. */}
            {threeTwoActiveOnBoard ? (
              <div className="db-fret-legend" style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginBottom: "12px", fontSize: "12px", color: "var(--muted)" }}>
                {threeTwoLevel === 0 ? (
                  <>
                    <span><span style={{ color: "var(--n-32-red)" }}>●</span> Root</span>
                    <span><span style={{ color: "var(--n-32-blue)" }}>●</span> Chord tone</span>
                    <span><span style={{ color: "var(--n-32-tension)", WebkitTextStroke: "1px var(--n-32-tension-stroke)" }}>●</span> Tension</span>
                  </>
                ) : (
                  (PENTA_LEGEND[threeTwoChoice.family] || []).map(([group, label]) => (
                    <span key={group}>
                      <span style={{ color: group === "red" ? "var(--n-32-red)" : "var(--n-32-blue)" }}>●</span> {label}
                    </span>
                  ))
                )}
                <span style={{ fontStyle: "italic" }}>{threeTwoChoice.why || "3:2 System"}</span>
              </div>
            ) : (
              <div className="db-fret-legend" style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginBottom: "12px", fontSize: "12px", color: "var(--muted)" }}>
                <span><span style={{ color: "var(--n-root)" }}>●</span> Root</span>
                <span><span style={{ color: "var(--n-chord)" }}>●</span> Chord tone</span>
                <span><span style={{ color: "var(--n-scale)" }}>●</span> Scale tone</span>
                <span style={{ opacity: bebopOverlay || scaleFilter === "barry" ? 1 : 0.5 }}>
                  <span style={{ color: "var(--n-passing)" }}>●</span> {scaleFilter === "barry" ? "Barry passing tone" : "Bebop passing"}
                </span>
                <span style={{ opacity: targetsOverlay ? 1 : 0.5 }}>
                  <span style={{ color: "var(--n-target)" }}>●</span>{" "}
                  {guideMode === "melody" ? "Melody note" : "3rd of this chord"}
                </span>
                <span style={{ opacity: targetsOverlay ? 1 : 0.5 }}>
                  <span style={{ color: "var(--n-seventh)" }}>●</span> 7th of this chord
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
            )}

            {/* THE MAPLE BOARD — always the same wood/note colors (spec §4.7),
                untouched click-to-hear / swipe / pinch handlers. */}
            <div className="db-mobile-only" style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, marginBottom: "4px" }}>
              Swipe the neck sideways to reach the upper frets · pinch to zoom
            </div>
            {/* Focus view gets a bigger board (spec §5.2). It used to get there
                by zooming 1.18, which on a phone just pushed the top frets off
                the side; now the card itself runs to the screen edges and the
                board takes the width it's given, so nothing overflows. */}
            <div className={focusStage ? "db-focus-board" : undefined} style={{ overflowX: "auto", marginBottom: "4px" }}>
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
                seventhNotes={seventhDisplayNotes}
                labelMode={labelMode}
                ghostRootNote={anticipateBar?.userTonic ?? anticipateBar?.root ?? null}
                focusStart={activeFocusStart}
                focusSpan={focusSpan}
                animate={isPlaying && playheadIndex !== null}
                barSeconds={fretboardBarSeconds}
                phaseKey={playheadIndex}
                view={fretboardView}
                tuningName={fretboardTuning}
                threeTwo={{
                  on: threeTwoActiveOnBoard,
                  kind: threeTwoBoard.kind,
                  cells: threeTwoBoard.cells,
                  bandRuns: threeTwoBoard.bandRuns,
                }}
              />
            </div>

            {/* Focus's transport: the same controls as the floating one, sat in
                the flow directly under the neck instead of hovering over the
                bottom three strings. */}
            {focusStage && (
              <StickyTransport
                embedded
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
                practiceMode={practiceMode}
                onTogglePracticeMode={setPracticeModeAndTempo}
                originalTempo={originalTempo}
                onOpenSettings={openBandPanel}
              />
            )}

            {/* Anticipate — when the ghosts are on the board above they already
                say where the next chord is, so this collapses to a readout.
                3rd Hunter (which the ghosts skip) keeps the full second maple
                board, dimmed to read as "coming up" rather than "now". */}
            {anticipateOn && anticipateBar && ghostGuideTones.length > 0 && (
              <div className="db-anticipate-readout" style={{
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
                  guide tones {ghostGuideTones.join(" / ") || "—"}
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
                    guide tones {(melodyPathState.notesByBar[anticipateBarIndex] || []).join(" / ") || "—"}
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
              compingOptions={COMPING_STYLE_NAMES}
              onCompingChange={setCompingStyle}
              playChords={playChords}
              onToggleChords={() => setPlayChords((v) => !v)}
              bassStyle={bassStyle}
              bassOptions={BASS_STYLE_NAMES}
              onBassChange={setBassStyle}
              playBass={playBass}
              onToggleBass={() => setPlayBass((v) => !v)}
              drumStyleLabel={DRUM_STYLES[drumStyleIdx].name}
              drumOptions={DRUM_STYLES.map((d) => d.name)}
              onDrumChange={(name) => setDrumStyleIdx(Math.max(0, DRUM_STYLES.findIndex((d) => d.name === name)))}
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
            shortcutId="band-mix"
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
                  <input type="range" min={TEMPO_MIN} max={TEMPO_MAX} value={tempo} onChange={(e) => setTempo(Number(e.target.value))} />
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
      {inMode("practice") && !focusStage && (
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
          practiceMode={practiceMode}
          onTogglePracticeMode={setPracticeModeAndTempo}
          originalTempo={originalTempo}
          onOpenSettings={openBandPanel}
        />
      )}

      {/* Focus, one tap away from anywhere in Practice. Takes the phone into
          landscape where it can and drops everything but chord, neck and
          transport. Hidden while Focus is on — the ✕ CORE chip up in the
          stage header is the way back. */}
      {inMode("practice") && !focusStage && (
        <button
          onClick={enterFocusMode}
          title="Focus mode — full-width neck, landscape on a phone"
          aria-label="Enter Focus mode"
          style={{
            position: "fixed", right: "14px", bottom: "76px", zIndex: 51,
            width: "48px", height: "48px", borderRadius: "50%", cursor: "pointer",
            border: "1px solid var(--line)",
            background: "color-mix(in srgb, var(--surface) 96%, transparent)",
            color: "var(--accent)", fontSize: "20px", lineHeight: 1,
            backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,.25)",
          }}
        >
          👁
        </button>
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
