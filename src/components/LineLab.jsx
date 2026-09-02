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
//   Chart          — type or pull in changes, pick any stretch up to 8 bars
//   Network        — triad-network presets (pairs, cells, pivots, enclosures,
//                    rest-stroke triplets, Martino Mode) over a generated
//                    II-V-I, blues, modal or rhythm-bridge section
//   Licktionary    — pull a saved lick in to view, transpose, or re-edit
//   Phrase Machine — build a formula by clicking scored blocks in a
//                    compatibility-graph tree (phraseEngine.js); generates
//                    instantly and offline, no LLM round trip
//
// Chart/Network/Licktionary generation goes through /api/generate-line;
// Phrase Machine runs entirely client-side (phraseEngine.js + phraseAdapter.js).
// Either way the result lands in the same line schema, so the key, tab
// rendering, and band/fretboard playback are identical whichever source you use.

import { useEffect, useMemo, useRef, useState } from "react"
import LineNotation from "@/components/LineNotation"
import PhraseMachineTree from "@/components/PhraseMachineTree"
import { exportLineMusicXML, groupIntoMeasures } from "@/lib/music/leadsheet"
import { inferLineKey, LICK_KEYS, lineFretRange, refingerLine, transposeLine } from "@/lib/music/licktionary"
import { parseGigChord } from "@/lib/music/gigbook"
import {
  TN_TONICS, TN_CHORD_TYPES, TN_PROGRESSIONS, TN_POSITIONS,
  TN_LEVEL_RULES, TN_TUTORIAL, guessQuality,
} from "@/lib/music/triadNetwork"
import { setLastLine, getLastLine, RESUME_LAST_LINE_EVENT } from "@/lib/music/lastLine"
import { logActivity } from "@/lib/recentActivity"
import { PM_PROGRESSIONS, transposeProgression, runGenerator } from "@/lib/music/phraseEngine"
import { phraseResultToLine } from "@/lib/music/phraseAdapter"
import { improvise, IMPROV_PROFILES } from "@/lib/music/improviser"

const DEVICES = [
  "Chromatics", "Bebop scale", "Enclosures", "Altered",
  "Melodic cells", "Triads", "Triad pairs", "Scale choice",
  "Pivot arpeggios", "Rest-stroke triplets", "Minor conversion (Martino)",
  "Peña method",
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
  "Peña method":
    "Richard Peña's bebop-intuition formula — arpeggio with chord tones on strong " +
    "beats, a chromatic enclosure that starts the line or meets the target, and a " +
    "guide-tone landing on the 3rd of the next chord, on beat 1.",
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

const PM_LANDING_BLOCK = { and1: "land_and1", and3: "land_and3", late3: "land_beat3_late" }

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
  // `chartBars` is one entry per CHORD, not per measure — a bar split
  // between two chords (e.g. Bm7b5 | E7b9 sharing one measure) is two
  // consecutive entries, each with its own beats:2. Practice mode already
  // groups those back into one measure for display (groupIntoMeasures, also
  // used by the lead-sheet export); Line Lab needs the same grouping so its
  // "Changes" strip shows real measures — one box per bar, multiple chords
  // space-joined inside it — instead of one box per chord, which both
  // inflated the apparent bar count and threw off the "max 8 bars" cap.
  const chartMeasures = useMemo(() => groupIntoMeasures(chartBars ?? []), [chartBars])

  // Seed the sheet from whatever chart is loaded in DukeBox
  const chartAsSheet = useMemo(
    () => chartMeasures.map((group) => group.map((b) => b.symbol).join(" ")).join(" | "),
    [chartMeasures]
  )

  // ── Source: your chart, a triad-network preset, a saved lick, or Phrase Machine ──
  const [source, setSource] = useState("chart")
  const isNetwork = source === "network"
  const isLicktionary = source === "licktionary"
  const isChart = source === "chart"
  const isPhraseMachine = source === "phrase"
  const isImprov = source === "improviser"
  // Improviser and Chart share the same sheet + bar-picker UI and the same
  // band-playback slicing; this flag gates everything they have in common.
  const usesChartSheet = isChart || isImprov
  const [lickKey, setLickKey] = useState("C")
  // Defaults into the "middle of the barrel" — frets 3-7, away from the open
  // strings and the dusty end alike — instead of whatever guitarPosition()'s
  // highest-string-available rule happens to land on. "Original" is still
  // one click away via the neck-position control's own reset button.
  const [neckPosition, setNeckPosition] = useState(3)
  const [resultTransposeKey, setResultTransposeKey] = useState("")

  useEffect(() => {
    if (!requestedLick?.id) return
    setSource("licktionary")
    setLickKey(requestedLick.key || "C")
    setNeckPosition(requestedLick.neckPosition ?? null)
    setResultTransposeKey("")
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

  // ── Improviser controls ── local rule-based generation over the chart
  // selection (src/lib/music/improviser). Style + sliders are one mechanism:
  // a profile is a point in the weight space, the sliders move it. Seed is
  // kept so "Same seed" can prove determinism / replay a keeper.
  const [imStyle, setImStyle] = useState("bebop")
  const [imSpace, setImSpace] = useState(35)        // 0-100, → controls.space
  const [imAltered, setImAltered] = useState(25)    // 0-100, → controls.altered
  const [imIntensity, setImIntensity] = useState(60)// 0-100, → controls.intensity
  const [imSeed, setImSeed] = useState(null)

  // ── Phrase Machine controls ── its own self-contained progression/key
  // preset (like Network above), plus the tree-builder's own formula and
  // generation settings. pmLastGen mirrors whatever produced the current
  // `result` so a saved lick can carry enough to regenerate the exact phrase.
  const [pmProgType, setPmProgType] = useState("major251")
  const [pmKey, setPmKey] = useState("C")
  const [pmVariation, setPmVariation] = useState("medium")
  const [pmLanding, setPmLanding] = useState("and3")
  const [pmVoicePath, setPmVoicePath] = useState("arch")
  const [pmShowN, setPmShowN] = useState("3")
  const [pmFormula, setPmFormula] = useState([])
  const [pmLastGen, setPmLastGen] = useState(null)

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

  // ── Notation window sizing — the engraving has no natural size limit of
  // its own (a long line at 4 measures/row can still run to several rows),
  // so give it its own collapse + zoom controls rather than letting it grow
  // to dominate the panel. "Fit" caps the row height and scrolls; "Full"
  // removes the cap for printing/screenshotting the whole thing.
  const [notationOpen, setNotationOpen] = useState(true)
  const [notationZoom, setNotationZoom] = useState("md")   // "sm" | "md" | "lg"
  const [notationFit, setNotationFit] = useState(true)      // capped height + scroll, vs. full height
  const NOTATION_SCALES = { sm: 0.72, md: 1, lg: 1.35 }

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
  // Phrase Machine's own progression preset, transposed — the tree scores
  // candidates against this (chordAtFormulaPosition needs the harmonic slot
  // per chord), and it doubles as the bar strip below like Network's netChords.
  const pmProg = useMemo(
    () => transposeProgression(PM_PROGRESSIONS[pmProgType].chords, pmKey),
    [pmProgType, pmKey]
  )
  const pmBars = useMemo(() => pmProg.map((ch) => ch.symbol), [pmProg])
  const bars = isLicktionary ? (lickLine?.bars || []).map((bar) => bar.c) : isNetwork ? netChords : isPhraseMachine ? pmBars : chartChords

  useEffect(() => {
    if (!usesChartSheet) return
    setSelStart(0)
    setSelEnd(Math.min(3, Math.max(0, chartChords.length - 1)))
  }, [sheet, chartChords.length, usesChartSheet])

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

  const resultBaseKey = useMemo(
    () => result ? (isLicktionary ? lickKey : inferLineKey(result)) : "C",
    [result, isLicktionary, lickKey]
  )
  const keyedResult = useMemo(() => {
    if (!result || isLicktionary || !resultTransposeKey || resultTransposeKey === resultBaseKey) return result
    return transposeLine(result, resultBaseKey, resultTransposeKey)
  }, [result, isLicktionary, resultTransposeKey, resultBaseKey])
  const workingResult = useMemo(
    () => keyedResult && neckPosition != null ? refingerLine(keyedResult, neckPosition) : keyedResult,
    [keyedResult, neckPosition]
  )
  const workingFretRange = useMemo(() => lineFretRange(workingResult), [workingResult])

  // Set by the resume handler below, immediately before it hands `result`
  // the resumed line — tells the persist effect just below to skip that one
  // cycle rather than re-derive a label from whatever source/selection
  // happen to be currently active (which weren't touched by the resume, and
  // so don't necessarily describe the line that just landed).
  const resumingRef = useRef(false)

  // Whatever line is currently showing — generated, transposed, refingered,
  // or a Licktionary pick — is "the last thing you did in Line Lab" as far
  // as Home is concerned. Persist it so the "Practice this lick" card has a
  // real line to draw, and log it so Line Lab shows up in "Jump back in"
  // like any other last-touched thing. Cross-tree, same pattern as
  // recentActivity.js — Home is a decoupled remote control with no props in.
  useEffect(() => {
    if (!workingResult?.bars?.length) return
    if (resumingRef.current) { resumingRef.current = false; return }
    const label = isLicktionary
      ? (selectedLick?.name ? `Licktionary — ${selectedLick.name}` : "Licktionary lick")
      : isNetwork
      ? `${TN_CHORD_TYPES[chordType]?.label || chordType} — ${TN_PROGRESSIONS[progression]?.label || progression}`
      : isPhraseMachine
      ? `Phrase Machine — ${PM_PROGRESSIONS[pmProgType]?.label || pmProgType}`
      : isImprov
      ? `Improviser — ${chartTitle && chartTitle !== "Custom" ? chartTitle : "Line Lab"}`
      : (chartTitle && chartTitle !== "Custom" ? chartTitle : "Line Lab")
    const context = usesChartSheet ? `Bars ${selStart + 1}–${selEnd + 1}` : isPhraseMachine ? pmKey : null
    setLastLine({ line: workingResult, label, context, keyRoot: resultTransposeKey || resultBaseKey })
    logActivity({
      label,
      subtitle: context || "Line Lab",
      art: "create",
      action: { type: "create-section", value: "create-line-lab" },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingResult])

  // Home's "Practice this lick" button — reload the exact saved line. Does
  // NOT touch source/sheet/selStart/selEnd/progression/tonic/chordType:
  // those are exactly the deps that invalidate the cache below ("A new
  // section — or a new source — invalidates every cached level"), so
  // changing any of them here would wipe `result` right back out on the
  // very next render. The line resumes fully playable either way — only
  // the Source tab selector may not match, if it wasn't "Chart" already.
  useEffect(() => {
    function onResume() {
      const snap = getLastLine()
      if (!snap?.line?.bars?.length) return
      resumingRef.current = true
      stopLine()
      setWithBand(false)
      setNeckPosition(null)
      setResultTransposeKey("")
      setExported(false)
      setResult(snap.line)
    }
    window.addEventListener(RESUME_LAST_LINE_EVENT, onResume)
    return () => window.removeEventListener(RESUME_LAST_LINE_EVENT, onResume)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Each note carries the chord that should be sounding under it, so the solo
  // preview can comp along. A bar's `c` may name more than one chord
  // ("Bm7b5 E7b9"); those split the bar evenly, in written order.
  const flatNotes = useMemo(() => {
    if (!workingResult) return []
    const out = []
    let carriedRest = 0
    workingResult.bars.forEach((bar, bi) => {
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
  }, [workingResult])

  function clickBar(i) {
    if (!usesChartSheet) return
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
    for (let b = 0; b < barIdx; b++) running += (workingResult?.bars?.[b]?.n || []).length
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

  // Same idea for Phrase Machine — a generated line is written over ITS OWN
  // progression (e.g. Dm7-G7-Cmaj7), never the chart currently loaded
  // elsewhere in DukeBox, so the band needs pmProg's own bars too. Every
  // Phrase Machine chord symbol parses cleanly through parseGigChord (same
  // "m7"/"7"/"maj7"/"m7b5"/"7alt"/"m6" suffixes gigQuality already handles),
  // so this reuses the exact parser Network does rather than hand-mapping
  // phraseEngine's own chord `type` keys to DukeBox's quality vocabulary.
  const pmBandBars = useMemo(
    () => pmProg.map((ch) => {
      const beats = (ch.beats || 8) / 2 // nominal eighth-units -> real DukeBox beats
      return parseGigChord(ch.symbol, "A", beats) ?? { root: ch.root, quality: "maj7", symbol: ch.symbol, section: "A", beats }
    }),
    [pmProg]
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
        line: workingResult,
        barsOverride: isNetwork ? netBars : isPhraseMachine ? pmBandBars : null,
        startIndex: (isNetwork || isPhraseMachine) ? 0 : selStart,
        endIndex: isNetwork ? netBars.length - 1 : isPhraseMachine ? pmBandBars.length - 1 : Math.min(selEnd, selStart + 7),
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
    // DukeBox's own scale recommendations and guide tones. Sliced from
    // chartMeasures (real measures), matching `section` above index-for-
    // index — a measure with more than one chord carries all of them in
    // `chords`, so the route's per-bar context can speak to each one, not
    // just the first.
    const chartSlice = isNetwork
      ? netChords.map((sym) => ({ symbol: sym, quality: guessQuality(sym), beats: 4 }))
      : chartMeasures.slice(selStart, Math.min(selEnd + 1, selStart + 8))
          .map((group) => ({
            symbol: group.map((b) => b.symbol).join(" "),
            root: group[0]?.root,
            quality: group[0]?.quality,
            beats: group.reduce((sum, b) => sum + (Number(b.beats) || 4), 0),
            chords: group.map((b) => ({ symbol: b.symbol, root: b.root, quality: b.quality, beats: b.beats })),
          }))

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

  // Runs the rule-based improviser directly — no network round trip. A
  // fresh seed each press unless `reuseSeed` (the "Same seed" button, which
  // proves determinism: identical chart + style + sliders + seed replays
  // the identical line).
  function runImproviser(reuseSeed = false) {
    const measures = chartChords.slice(selStart, Math.min(selEnd + 1, selStart + 8))
    if (!measures.length) return
    const seed = reuseSeed && imSeed != null ? imSeed : Math.floor(Math.random() * 0xffffff)
    try {
      const { line } = improvise({
        measures,
        profileId: imStyle,
        controls: { space: imSpace / 100, altered: imAltered / 100, intensity: imIntensity / 100 },
        seed,
      })
      if (!line?.bars?.some((bar) => bar.n?.length)) {
        setError("Couldn't hear any changes in those bars — check the chord symbols.")
        return
      }
      stopLine()
      setError(null)
      setImSeed(seed)
      setResult(line)
      setExported(false)
    } catch (e) {
      setError(e.message || "Couldn't improvise over those bars.")
    }
  }

  // Runs the block-grammar generator directly — no network round trip.
  // Appends a landing block to a COPY of the formula for generation only
  // (same as the prototype's doGenerate) if the tree hasn't ended on one
  // itself; the formula shown in the tree/chip strip stays exactly what
  // was clicked. A fresh random seed every call, matching how the
  // prototype re-rolled on every node click and Regenerate press alike.
  //
  // Strips any trailing landing block(s) first — however they got there
  // (a saved lick's older formula, PhraseMachineTree's own now-closed
  // landing→landing path) — then appends exactly one, matching the current
  // Landing selector, so generation never stacks two landing notes back to
  // back.
  function runPhraseMachine(base) {
    if (!base?.length) return
    let core = base
    while (core.length > 1 && core[core.length - 1]?.startsWith("land")) core = core.slice(0, -1)
    const eff = core[core.length - 1]?.startsWith("land") ? core : [...core, PM_LANDING_BLOCK[pmLanding] || "land_and3"]
    const seed = Math.floor(Math.random() * 0xffffff)
    try {
      const genResult = runGenerator(eff, pmKey, pmProgType, pmVariation, seed, pmLanding)
      stopLine()
      setError(null)
      setPmLastGen({ formula: base, progType: pmProgType, key: pmKey, variation: pmVariation, landing: pmLanding, seed })
      setResult(phraseResultToLine(genResult))
      setExported(false)
    } catch (e) {
      setError(e.message || "Couldn't generate that phrase.")
    }
  }

  // Auto-generate once the formula reaches 3 blocks — the same threshold
  // and live-building feel the prototype had. `source` is a dependency too
  // so switching into Phrase Machine with an already-built formula (from an
  // earlier visit) generates immediately rather than showing a stale null
  // result left over from the source-change reset below.
  useEffect(() => {
    if (!isPhraseMachine || pmFormula.length < 3) return
    runPhraseMachine(pmFormula)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pmFormula, pmProgType, pmKey, pmVariation, pmLanding, source])

  function exportXML() {
    const title = isLicktionary
      ? `${selectedLick?.name || "Lick"} (${selectedLick?.mode || "custom"}, ${lickKey})`
      : isNetwork
      ? `${TN_PROGRESSIONS[progression].label} in ${tonic}`
      : isPhraseMachine
      ? `${PM_PROGRESSIONS[pmProgType].label} in ${pmKey} (Phrase Machine)`
      : (chartTitle && chartTitle !== "Custom" ? chartTitle : "Line Lab")
    const ok = exportLineMusicXML({ line: workingResult, title, tempo, level: (isLicktionary || isPhraseMachine || isImprov) ? null : level })
    setExported(ok)
  }

  function saveCurrentLick() {
    if (!result || !onSaveLick) return
    const suggested = isPhraseMachine
      ? `Phrase Machine — ${PM_PROGRESSIONS[pmProgType].label} in ${pmKey}`
      : isImprov
      ? `Improviser — ${chartTitle && chartTitle !== "Custom" ? chartTitle : "Line Lab"} bars ${selStart + 1}–${selEnd + 1}`
      : `${chartTitle && chartTitle !== "Custom" ? chartTitle : "Line Lab"} L${level}`
    const name = window.prompt("Name this lick:", suggested)?.trim()
    if (!name) return
    onSaveLick({
      name, line: workingResult, baseKey: null, mode: "custom",
      device: isPhraseMachine ? "Phrase Machine" : isImprov ? `Improviser · ${IMPROV_PROFILES[imStyle]?.label || imStyle}` : Array.from(devices).join(" · "),
      cue: (isPhraseMachine || isImprov) ? (result.s || "Saved from Line Lab") : (extra || result.s || "Saved from Line Lab"),
      phraseMachine: isPhraseMachine ? pmLastGen : undefined,
      improviser: isImprov ? { profileId: imStyle, space: imSpace, altered: imAltered, intensity: imIntensity, seed: imSeed, bars: [selStart, selEnd] } : undefined,
    })
  }

  // ─── Fretboard geometry ───────────────────────────────────────────────────
  const fretCount = 20
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
              Improvised single-note lines — as notation + TAB, with per-bar reasoning, over your chart, the triad network, a Phrase Machine formula, or the rule-based Improviser
        </div>
      </div>

      {/* Source switch */}
      <div style={{ display: "flex", gap: "6px", marginTop: "12px", flexWrap: "wrap" }}>
        <button onClick={() => setSource("chart")} aria-pressed={isChart} style={chip(isChart)}>
          Chart changes
        </button>
        <button onClick={() => setSource("network")} aria-pressed={isNetwork} style={chip(isNetwork)}>
          Triad network preset
        </button>
        <button onClick={() => setSource("licktionary")} aria-pressed={isLicktionary} style={chip(isLicktionary)}>
          Licktionary
        </button>
        <button onClick={() => setSource("phrase")} aria-pressed={isPhraseMachine} style={chip(isPhraseMachine)}>
          Phrase Machine
        </button>
        <button onClick={() => setSource("improviser")} aria-pressed={isImprov} style={chip(isImprov)}>
          Improviser
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

      {/* ── Chart + Improviser sources: lead sheet + bar picker ── */}
      {usesChartSheet && (
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

      {/* ── Phrase Machine source: its own progression preset ── */}
      {isPhraseMachine && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", marginTop: "14px" }}>
            <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7 }}>Progression
              <select value={pmProgType} onChange={(e) => setPmProgType(e.target.value)} style={{ ...selectStyle, width: "100%", marginTop: "4px" }}>
                {Object.entries(PM_PROGRESSIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7 }}>Key
              <select value={pmKey} onChange={(e) => setPmKey(e.target.value)} style={{ ...selectStyle, width: "100%", marginTop: "4px" }}>
                {LICK_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
              </select>
            </label>
            <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7 }}>Landing
              <select value={pmLanding} onChange={(e) => setPmLanding(e.target.value)} style={{ ...selectStyle, width: "100%", marginTop: "4px" }}>
                <option value="and1">&amp; of 1</option>
                <option value="and3">&amp; of 3 (Galper)</option>
                <option value="late3">Late (beat 3)</option>
              </select>
            </label>
            <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7 }}>Variation
              <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                {["shallow", "medium", "deep"].map((v) => (
                  <button
                    key={v} type="button" onClick={() => setPmVariation(v)} aria-pressed={pmVariation === v}
                    style={{ ...chip(pmVariation === v), padding: "6px 10px", flex: 1, textTransform: "capitalize" }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, margin: "10px 0 7px" }}>
            Click a block below to start a phrase — it generates automatically once you have three. Click a built
            column again to replace the phrase from there on.
          </div>
        </>
      )}

      {/* Bars — clickable in Chart mode, the preset section otherwise */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {bars.map((b, i) => {
          const inSel = !usesChartSheet ? true : (i >= selStart && i <= selEnd)
          const isNow = currentNote?.bi === i
          return (
            <button
              key={i}
              onClick={() => clickBar(i)}
              aria-pressed={inSel}
              style={{
                padding: "6px 10px", borderRadius: "var(--db-r-md)", fontSize: "var(--db-fs-sm)",
                cursor: usesChartSheet ? "pointer" : "default",
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

      {/* ── Improviser source: style + sliders over the rule engine ── */}
      {isImprov && (
        <div style={{ marginTop: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "14px" }}>
            <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7 }}>Style
              <select value={imStyle} onChange={(e) => setImStyle(e.target.value)} style={{ ...selectStyle, width: "100%", marginTop: "4px" }}>
                {Object.values(IMPROV_PROFILES).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7 }} htmlFor="im-space">
              Space — {imSpace}%
              <input
                id="im-space" type="range" min="0" max="100" step="5" value={imSpace}
                onChange={(e) => setImSpace(Number(e.target.value))}
                style={{ width: "100%", marginTop: "8px", accentColor: "var(--db-accent)" }}
              />
              <span style={{ display: "flex", justifyContent: "space-between", opacity: 0.6 }}><span>dense</span><span>breathing</span></span>
            </label>
            <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7 }} htmlFor="im-altered">
              Harmony — {imAltered}%
              <input
                id="im-altered" type="range" min="0" max="100" step="5" value={imAltered}
                onChange={(e) => setImAltered(Number(e.target.value))}
                style={{ width: "100%", marginTop: "8px", accentColor: "var(--db-accent)" }}
              />
              <span style={{ display: "flex", justifyContent: "space-between", opacity: 0.6 }}><span>diatonic</span><span>altered</span></span>
            </label>
            <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7 }} htmlFor="im-intensity">
              Intensity — {imIntensity}%
              <input
                id="im-intensity" type="range" min="0" max="100" step="5" value={imIntensity}
                onChange={(e) => setImIntensity(Number(e.target.value))}
                style={{ width: "100%", marginTop: "8px", accentColor: "var(--db-accent)" }}
              />
              <span style={{ display: "flex", justifyContent: "space-between", opacity: 0.6 }}><span>soft</span><span>forceful</span></span>
            </label>
          </div>
          <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.62, marginTop: "10px" }}>
            {IMPROV_PROFILES[imStyle]?.description} Rule-based and instant — no model call. Same seed + same settings replays the identical line.
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => runImproviser(false)}
              disabled={!bars.length}
              style={{
                flex: "1 1 220px", padding: "12px 0", borderRadius: "var(--db-r-md)",
                border: "1px solid var(--db-accent)",
                background: "color-mix(in srgb, var(--db-accent) 35%, var(--db-bg))",
                color: "var(--db-accent)", fontSize: "var(--db-fs-md)", fontWeight: 700,
                cursor: bars.length ? "pointer" : "default", opacity: bars.length ? 1 : 0.5,
              }}
            >
              {result ? "↻ New line" : "Improvise"}
            </button>
            <button
              onClick={() => runImproviser(true)}
              disabled={imSeed == null}
              title="Regenerate with the same seed — identical settings replay the identical line"
              style={{ ...chip(false), opacity: imSeed != null ? 1 : 0.5, cursor: imSeed != null ? "pointer" : "default" }}
            >
              Same seed{imSeed != null ? ` (${imSeed})` : ""}
            </button>
          </div>
        </div>
      )}

      {/* Devices + direction */}
      {!isLicktionary && !isPhraseMachine && !isImprov && <div style={{ marginTop: "16px" }}>
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

      {!isLicktionary && !isPhraseMachine && !isImprov && <div style={{ display: "flex", gap: "12px", marginTop: "14px", flexWrap: "wrap" }}>
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
      {!isLicktionary && !isPhraseMachine && !isImprov && <><div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.62, margin: "14px 0 7px" }}>
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

      {isPhraseMachine && (
        <>
          <PhraseMachineTree
            formula={pmFormula}
            onFormulaChange={setPmFormula}
            prog={pmProg}
            voicePath={pmVoicePath}
            onVoicePathChange={setPmVoicePath}
            showN={pmShowN}
            onShowNChange={setPmShowN}
          />
          <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
            <button
              type="button"
              onClick={() => runPhraseMachine(pmFormula)}
              disabled={!pmFormula.length}
              style={{ ...chip(false), opacity: pmFormula.length ? 1 : 0.5, cursor: pmFormula.length ? "pointer" : "default" }}
            >
              ↻ Regenerate
            </button>
            <button
              type="button"
              onClick={() => { setPmFormula([]); setResult(null); setError(null) }}
              disabled={!pmFormula.length}
              style={{ ...chip(false), opacity: pmFormula.length ? 1 : 0.5, cursor: pmFormula.length ? "pointer" : "default" }}
            >
              Clear
            </button>
          </div>
        </>
      )}

      {error && (
        <div style={{ marginTop: "10px", color: "var(--db-c-salmon)", fontSize: "var(--db-fs-md)" }}>{error}</div>
      )}

      {result && (
        <>
          {/* One pitch layer for the entire result: transpose first, then choose
              equivalent guitar locations inside a five-fret hand position. */}
          <div style={{
            marginTop: "14px", padding: "11px 14px", borderRadius: "var(--db-r-md)",
            border: "1px solid var(--db-panel-border)", background: "var(--db-input-bg)",
            display: "flex", gap: "16px", alignItems: "end", flexWrap: "wrap",
          }}>
            {!isLicktionary && (
              <label style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-muted)" }}>Transpose line
                <select
                  value={resultTransposeKey}
                  onChange={(e) => setResultTransposeKey(e.target.value)}
                  style={{ ...selectStyle, display: "block", width: "145px", marginTop: "4px" }}
                >
                  <option value="">Original ({resultBaseKey})</option>
                  {LICK_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
                </select>
              </label>
            )}
            <div style={{ flex: "0 1 255px", minWidth: "210px" }}>
              <div style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-muted)", display: "flex", gap: "7px", alignItems: "center", flexWrap: "wrap" }}>
                <span>{neckPosition == null ? `Neck: Original · frets ${workingFretRange[0]}–${workingFretRange[1]}` : `Neck: target ${neckPosition}–${neckPosition + 4} · actual ${workingFretRange[0]}–${workingFretRange[1]}`}</span>
                {neckPosition != null && (
                  <button type="button" onClick={() => setNeckPosition(null)} style={{ ...chip(false), padding: "2px 7px", fontSize: "10px" }}>Original</button>
                )}
              </div>
              <input
                type="range" min="1" max="15" step="1" value={neckPosition ?? 5}
                onChange={(e) => setNeckPosition(Number(e.target.value))}
                aria-label="Preferred five-fret guitar neck position"
                style={{ display: "block", width: "100%", marginTop: "8px" }}
              />
            </div>
            <div style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-muted)", maxWidth: "330px", lineHeight: 1.4 }}>
              Five-fret box. Notes, intervals, and rhythm stay fixed; a distant position may move the whole lick by octave.
            </div>
          </div>

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

            {/* Phrase design note — a plain-language reading of the line
                (per-bar reasoning for Chart/Network, the block-chain sentence
                for Phrase Machine, the guide's cue for Licktionary), next to
                the title rather than buried after the per-bar breakdown. */}
            {result.s && (
              <p style={{
                margin: "8px 0 0", fontSize: "var(--db-fs-md)", paddingLeft: "12px",
                borderLeft: "3px solid var(--db-accent)", fontStyle: "italic", opacity: 0.9,
              }}>{result.s}</p>
            )}

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
                {currentNote.bi + 1}: {workingResult.bars[currentNote.bi]?.c}
              </div>
            )}
          </div>

          {/* Standard notation + TAB — driven by the same timed line events as playback */}
          <div style={{ marginTop: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
              <button
                type="button"
                onClick={() => setNotationOpen((v) => !v)}
                aria-expanded={notationOpen}
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                  display: "flex", alignItems: "center", gap: "6px",
                  fontSize: "var(--db-fs-sm)", color: "var(--db-accent)", fontWeight: 700,
                }}
              >
                <span style={{ opacity: 0.6, fontSize: "0.8em", width: "0.9em", display: "inline-block" }}>{notationOpen ? "▾" : "▸"}</span>
                Notation + TAB
              </button>
              {notationOpen && (
                <>
                  <span style={{ width: "1px", height: "14px", background: "var(--db-panel-border)" }} />
                  <span style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6 }}>Size</span>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {[["sm", "S"], ["md", "M"], ["lg", "L"]].map(([id, label]) => (
                      <button
                        key={id} type="button" onClick={() => setNotationZoom(id)} aria-pressed={notationZoom === id}
                        style={{ ...chip(notationZoom === id), padding: "3px 9px" }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotationFit((v) => !v)}
                    aria-pressed={!notationFit}
                    title={notationFit ? "Capped height, scrolls if the line runs long" : "Uncapped — shows every row at once"}
                    style={chip(!notationFit)}
                  >
                    {notationFit ? "Fit" : "Full height"}
                  </button>
                </>
              )}
            </div>
            {notationOpen && (
              <LineNotation
                line={workingResult} tempo={tempo} activeIndex={soundingIdx}
                scale={NOTATION_SCALES[notationZoom]}
                maxHeight={notationFit ? "360px" : null}
              />
            )}
          </div>

          {/* Per-bar reasoning */}
          <div style={{ display: "grid", gap: "8px", marginTop: "14px" }}>
            {workingResult.bars.map((bar, i) => (
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
