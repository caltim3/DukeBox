"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import NotationLane from "@/components/NotationLane"
import {
  ROOTS,
  QUALITIES,
  buildChordSymbol,
  chordInfo,
  scaleNotes,
  guideTones,
  analyzeGuideToneMotion,
  melodicTargets,
  generateMelodySkeleton,
  generateApproachLines,
  assignRhythmToBars,
  getRecommendedScalesFromQuality,
  transposeChart,
} from "@/lib/music/tonal"
import {
  analyzeProgressionContext,
  suggestContextualSubstitution,
} from "@/lib/music/harmony"
import { FORMS, FORM_CATEGORIES } from "@/lib/music/forms"
import { chordToRoman } from "@/lib/music/roman"
import { startPlayback as audioStart, stopAll as audioStop } from "@/lib/music/audio"
import { COMPING_STYLE_NAMES, DEFAULT_COMPING_STYLE, getVoiceLedVoicing } from "@/lib/music/comping"
import Fretboard from "@/components/Fretboard"

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

export default function Home() {
  const [bars, setBars] = useState(INITIAL_BARS)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dragIndex, setDragIndex] = useState(null)

  const [phraseSeed, setPhraseSeed] = useState(0)
  const [rhythmSeed, setRhythmSeed] = useState(0)

  const [tempo, setTempo] = useState(110)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playChords, setPlayChords] = useState(true)
  const [playBass, setPlayBass] = useState(true)
  const [playDrums, setPlayDrums] = useState(true)
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

  const selectedBar = bars[selectedIndex]

  const info = useMemo(() => chordInfo(selectedBar.symbol), [selectedBar])

  const guides = useMemo(() => {
    return guideTones(selectedBar.symbol)
  }, [selectedBar])

  const progression = useMemo(() => {
    return analyzeGuideToneMotion(bars)
  }, [bars])

  const harmonicContext = useMemo(() => {
    return analyzeProgressionContext(bars)
  }, [bars])

  const targets = useMemo(() => {
    return melodicTargets(bars)
  }, [bars])

  const melodySkeleton = useMemo(() => {
    return generateMelodySkeleton(bars, phraseSeed)
  }, [bars, phraseSeed])

  const approachLines = useMemo(() => {
    return generateApproachLines(bars, phraseSeed)
  }, [bars, phraseSeed])

  const phrase = useMemo(() => {
    return approachLines.flatMap(line => line.phrase)
  }, [approachLines])

  const rhythms = useMemo(() => {
    return assignRhythmToBars(bars, rhythmSeed)
  }, [bars, rhythmSeed])

  const notationBars = useMemo(() => {
    return approachLines.map((line, i) => ({
      chord: bars[i].symbol,
      arrivalNote: line.arrivalNote,
      departureNote: line.departureNote,
    }))
  }, [approachLines, bars])

  const selectedMotion = progression[selectedIndex]?.nextMotion || null
  const selectedTarget = targets[selectedIndex] || null
  const selectedMelodyNote = melodySkeleton[selectedIndex] || null
  const selectedApproachLine = approachLines[selectedIndex] || null
  const selectedRhythm = rhythms[selectedIndex] || null

  const recommendedScales = getRecommendedScalesFromQuality(selectedBar.quality)

  const currentVoicing = useMemo(() => {
    try { return getVoiceLedVoicing(selectedBar.symbol, null, playBass) } catch { return [] }
  }, [selectedBar, playBass])

  const suggestedSub = useMemo(() => {
    return suggestContextualSubstitution(bars, selectedIndex, "inside")
  }, [bars, selectedIndex])

  const scaleData = useMemo(() => {
    return recommendedScales.map((scaleName) => ({
      name: scaleName,
      notes: scaleNotes(scaleName, selectedBar.root),
    }))
  }, [selectedBar, recommendedScales])

  // Fretboard tracks the playing chord during playback, otherwise follows selection
  const fretboardBar = (isPlaying && playheadIndex !== null) ? bars[playheadIndex] : selectedBar

  const fretboardInfo = useMemo(() => chordInfo(fretboardBar.symbol), [fretboardBar])

  const fretboardScaleData = useMemo(() => {
    const scales = getRecommendedScalesFromQuality(fretboardBar.quality)
    return scales.map((scaleName) => ({
      name: scaleName,
      notes: scaleNotes(scaleName, fretboardBar.root),
    }))
  }, [fretboardBar])

  const romanNumerals = useMemo(() => {
    return bars.map((bar) => chordToRoman(bar.root, bar.quality, keyRoot, keyMode))
  }, [bars, keyRoot, keyMode])

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

  function regeneratePhrase() {
    setPhraseSeed((prev) => prev + 1)
  }

  function regenerateRhythm() {
    setRhythmSeed((prev) => prev + 1)
  }

  function regenerateSelectedBar() {
    setPhraseSeed((prev) => prev + 1)
    setRhythmSeed((prev) => prev + 1)
  }

  function applySuggestedSubstitution() {
    if (!suggestedSub) return
    updateBar(selectedIndex, {
      root: suggestedSub.root,
      quality: suggestedSub.quality,
    })
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

  function loadForm(formName) {
    setSelectedForm(formName)
    const form = FORMS[formName]
    if (form) {
      setBars(form.bars)
      setKeyRoot(form.keyRoot)
      setKeyMode(form.keyMode)
      setSelectedIndex(0)
      setLoopStart(0)
      setLoopEnd(form.bars.length - 1)
      if (form.tempo) setTempo(form.tempo)
      return
    }
    const userEntry = userLibrary.find((e) => e.name === formName)
    if (userEntry) {
      setBars(userEntry.bars)
      setKeyRoot(userEntry.keyRoot || "C")
      setKeyMode(userEntry.keyMode || "major")
      setSelectedIndex(0)
      setLoopStart(0)
      setLoopEnd(userEntry.bars.length - 1)
      if (userEntry.tempo) setTempo(userEntry.tempo)
    }
  }

  function handleTransposeChart(newKeyRoot) {
    setBars((prev) => transposeChart(prev, keyRoot, newKeyRoot))
    setKeyRoot(newKeyRoot)
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

  function stopPlayback() {
    audioStop()
    setIsPlaying(false)
    setPlayheadIndex(null)
  }

  async function startPlayback() {
    stopPlayback()
    const startIndex   = loopEnabled ? Math.min(loopStart, loopEnd) : 0
    const endIndex     = loopEnabled ? Math.max(loopStart, loopEnd) : bars.length - 1
    const slicedBars   = bars.slice(startIndex, endIndex + 1)
    const slicedLines  = approachLines.slice(startIndex, endIndex + 1)

    setIsPlaying(true)
    try {
      await audioStart({
        bars:          slicedBars,
        approachLines: slicedLines,
        tempo,
        loop:          loopEnabled,
        swing:         swingAmount,
        playChords,
        playBass,
        playDrums,
        playMelody,
        compingStyle,
        onBar:  (localIdx) => setPlayheadIndex(startIndex + localIdx),
        onStop: () => { setIsPlaying(false); setPlayheadIndex(null) },
      })
    } catch (err) {
      console.error("Audio error:", err)
      setIsPlaying(false)
    }
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem("dukebox-library")
      if (stored) setUserLibrary(JSON.parse(stored))
    } catch {}
    return () => audioStop()
  }, [])

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b0b12",
        color: "#f3efe6",
        display: "grid",
        gridTemplateColumns: "1.45fr 0.85fr",
        gap: "24px",
        padding: "32px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "8px", color: "#e0b44c" }}>
          The DukeBox
        </h1>

        <p style={{ opacity: 0.75, marginBottom: "24px" }}>
          Drag measures, edit chords, hear the phrase, regenerate ideas, and inspect harmonic context live.
        </p>

        {/* ── AI Chart Generator ────────────────────────────────── */}
        <div style={{
          ...panelStyle,
          marginBottom: "16px",
          border: "1px solid rgba(201,167,255,0.25)",
          background: "rgba(201,167,255,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <div style={{ ...eyebrowStyle, marginBottom: 0, color: "#c9a7ff" }}>AI CHART GENERATOR</div>
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
                background: "#12101f",
                color: "#f3efe6",
                fontSize: "0.95rem",
                resize: "vertical",
                minHeight: "80px",
                fontFamily: "Arial, sans-serif",
                lineHeight: 1.5,
              }}
              disabled={isGenerating}
            />
            <button
              onClick={handleGenerateChart}
              disabled={isGenerating || !promptText.trim()}
              style={{
                ...buttonStyle("#c9a7ff", "#1a1428"),
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
                  background: "none", border: "none", color: "#c9a7ff",
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
              <button onClick={saveToLibrary} style={buttonStyle("#8bd3a8", "#132018")}>
                + Add to My Library
              </button>
            </div>
          )}
        </div>

        {/* ── Song Settings ─────────────────────────────────────── */}
        <div style={{ ...panelStyle, marginBottom: "16px" }}>
          <div style={eyebrowStyle}>SONG SETTINGS</div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>

            <label style={inlineLabelStyle}>
              <span style={{ opacity: 0.7, marginRight: "4px" }}>Form</span>
              <select
                value={selectedForm}
                onChange={(e) => loadForm(e.target.value)}
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
              onClick={() => {
                const target = prompt("Transpose chart to key (e.g. G, Eb, F#):")
                if (target && ROOTS.includes(target)) handleTransposeChart(target)
              }}
              style={buttonStyle("#7fc8ff", "#10202b")}
            >
              Transpose Chart
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
          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: "12px",
            }}
          >
            <button
              onClick={isPlaying ? stopPlayback : () => startPlayback().catch(console.error)}
              style={buttonStyle("#e0b44c", "#1a1608")}
            >
              {isPlaying ? "⏹ Stop" : "▶ Play"}
            </button>

            <button onClick={regeneratePhrase} style={buttonStyle("#c9a7ff", "#171320")}>
              Regenerate Phrase
            </button>

            <button onClick={regenerateRhythm} style={buttonStyle("#8bd3a8", "#132018")}>
              Regenerate Rhythm
            </button>

            <button onClick={regenerateSelectedBar} style={buttonStyle("#7fc8ff", "#10202b")}>
              Regenerate Selected Bar
            </button>

            <label style={inlineLabelStyle}>
              Tempo
              <input
                type="range"
                min="70"
                max="180"
                value={tempo}
                onChange={(e) => setTempo(Number(e.target.value))}
              />
              <span>{tempo}</span>
            </label>

            <label style={inlineLabelStyle}>
              <input type="checkbox" checked={playChords} onChange={(e) => setPlayChords(e.target.checked)} />
              Piano
            </label>

            <label style={inlineLabelStyle}>
              <span style={{ opacity: 0.7 }}>Pianist</span>
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
              Drums
            </label>

            <label style={inlineLabelStyle}>
              <input type="checkbox" checked={playMelody} onChange={(e) => setPlayMelody(e.target.checked)} />
              Melody
            </label>

            <label style={inlineLabelStyle}>
              Swing
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(swingAmount * 100)}
                onChange={(e) => setSwingAmount(Number(e.target.value) / 100)}
                style={{ width: "70px" }}
              />
              <span style={{ minWidth: "28px", fontSize: "0.85rem", opacity: 0.8 }}>
                {Math.round(swingAmount * 100)}%
              </span>
            </label>

            <label style={inlineLabelStyle}>
              <input
                type="checkbox"
                checked={loopEnabled}
                onChange={(e) => setLoopEnabled(e.target.checked)}
              />
              Loop
            </label>

            <button onClick={() => setLoopStart(selectedIndex)} style={buttonStyle("#f0d48a", "#20180d")}>
              Set Loop Start
            </button>

            <button onClick={() => setLoopEnd(selectedIndex)} style={buttonStyle("#f0d48a", "#20180d")}>
              Set Loop End
            </button>

            <button
              onClick={() => setShowFretboard((p) => !p)}
              style={{
                ...buttonStyle(showFretboard ? "#e0b44c" : "#7fc8ff", showFretboard ? "#1a1608" : "#10202b"),
                marginLeft: "auto",
              }}
            >
              {showFretboard ? "Hide Fretboard" : "🎸 Fretboard"}
            </button>
          </div>

          <div style={eyebrowStyle}>NOTATION LANE</div>

          <NotationLane
            bars={notationBars}
            activeIndex={selectedIndex}
            onSelectBar={setSelectedIndex}
            playheadIndex={playheadIndex}
          />

          <div style={{ marginTop: "8px", fontSize: "0.9rem", opacity: 0.7 }}>
            Loop range: bars {Math.min(loopStart, loopEnd) + 1} to {Math.max(loopStart, loopEnd) + 1}
          </div>
        </div>

        {showFretboard && (
          <div style={{ ...panelStyle, marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px", flexWrap: "wrap" }}>
              <div style={{ ...eyebrowStyle, marginBottom: 0 }}>FRETBOARD</div>

              <div style={{ display: "flex", gap: "4px" }}>
                {["chord", "scale"].map((v) => (
                  <button key={v} onClick={() => setFretboardView(v)} style={{
                    padding: "4px 10px", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer",
                    background: fretboardView === v ? "rgba(224,180,76,0.18)" : "rgba(255,255,255,0.05)",
                    border: fretboardView === v ? "1px solid #e0b44c" : "1px solid rgba(255,255,255,0.12)",
                    color: fretboardView === v ? "#e0b44c" : "rgba(255,255,255,0.55)",
                    fontWeight: fretboardView === v ? 700 : 400,
                  }}>
                    {v === "chord" ? "Chord" : "Scale"}
                  </button>
                ))}
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
                {fretboardView === "scale" && fretboardScaleData[0] ? ` · ${fretboardScaleData[0].name}` : ""}
              </div>
            </div>

            <Fretboard
              chordNotes={fretboardInfo.notes || []}
              rootNote={fretboardBar.root}
              scaleNotes={fretboardScaleData[0]?.notes || []}
              view={fretboardView}
              tuningName={fretboardTuning}
            />

            <div style={{ marginTop: "8px", display: "flex", gap: "14px", fontSize: "0.78rem", opacity: 0.55 }}>
              <span><span style={{ color: "#BD2031" }}>●</span> Root</span>
              <span><span style={{ color: "#3A9C5A" }}>●</span> Chord tone</span>
              <span><span style={{ color: "#3A78C9" }}>●</span> Scale tone</span>
            </div>
          </div>
        )}

        <div style={panelStyle}>
          <div style={eyebrowStyle}>MELODY LANE</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
              gap: "8px",
            }}
          >
            {approachLines.map((item, index) => {
              const active = index === selectedIndex
              const isPlayhead = index === playheadIndex

              return (
                <div
                  key={`${item.chord}-lane-${index}`}
                  style={{
                    padding: "10px 8px",
                    borderRadius: "10px",
                    border: isPlayhead
                      ? "1px solid #8bd3a8"
                      : active
                      ? "1px solid #ff9ecb"
                      : "1px solid rgba(255,255,255,0.08)",
                    background: isPlayhead
                      ? "rgba(139,211,168,0.14)"
                      : active
                      ? "rgba(255,158,203,0.08)"
                      : "rgba(255,255,255,0.03)",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "0.72rem", opacity: 0.55, marginBottom: "6px" }}>
                    {bars[index].symbol}
                  </div>
                  <div style={{ display: "flex", gap: "4px", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "1rem", color: "#c9a7ff", fontWeight: 700 }}>
                      {item.arrivalNote || "—"}
                    </span>
                    <span style={{ opacity: 0.3, fontSize: "0.75rem" }}>→</span>
                    <span style={{ fontSize: "1rem", color: "#8bd3a8", fontWeight: 700 }}>
                      {item.departureNote || "—"}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={panelStyle}>
          <div style={eyebrowStyle}>LEAD SHEET GRID</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))",
              gap: "12px",
            }}
          >
            {bars.flatMap((bar, index) => {
              const active = index === selectedIndex
              const guide = progression[index]?.guideTones || []
              const target = targets[index]
              const melody = melodySkeleton[index]
              const approach = approachLines[index]
              const rhythm = rhythms[index]
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
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      color: "#e0b44c",
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
                      ? "1px solid #8bd3a8"
                      : active
                      ? "1px solid #e0b44c"
                      : inLoop && loopEnabled
                      ? "1px solid rgba(240,212,138,0.5)"
                      : "1px solid rgba(255,255,255,0.12)",
                    background: isPlayhead
                      ? "rgba(139,211,168,0.12)"
                      : active
                      ? "rgba(224,180,76,0.12)"
                      : inLoop && loopEnabled
                      ? "rgba(240,212,138,0.06)"
                      : "rgba(255,255,255,0.04)",
                    cursor: "pointer",
                    boxShadow: dragIndex === index ? "0 0 0 2px rgba(127,200,255,0.45)" : "none",
                    position: "relative",
                  }}
                >
                  {/* Bar header row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <div style={{ fontSize: "0.75rem", opacity: 0.5 }}>BAR {index + 1}</div>
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

                  {/* Chord symbol */}
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: showRomanNumerals ? "2px" : "8px" }}>
                    {bar.symbol}
                  </div>

                  {/* Roman numeral */}
                  {showRomanNumerals && (
                    <div style={{ fontSize: "0.9rem", color: "#f0d48a", marginBottom: "8px", opacity: 0.9 }}>
                      {roman}
                    </div>
                  )}

                  <div style={{ fontSize: "0.78rem", color: "#f0d48a", marginBottom: "4px" }}>
                    Function: {context?.functionLabel || "—"}
                  </div>

                  <div style={{ fontSize: "0.76rem", color: "#ffb3a7", marginBottom: "6px" }}>
                    Cadence: {context?.cadenceLabels?.join(", ") || "—"}
                  </div>

                  <div style={{ fontSize: "0.82rem", color: "#e0b44c", marginBottom: "6px" }}>
                    GT: {guide.length ? guide.join(" / ") : "—"}
                  </div>

                  <div style={{ fontSize: "0.8rem", color: "#7fc8ff", marginBottom: "6px" }}>
                    Target: {target?.targetNote || "—"}
                  </div>

                  <div style={{ fontSize: "0.8rem", color: "#ff9ecb", marginBottom: "6px" }}>
                    Melody: {melody?.note || "—"}
                  </div>

                  <div style={{ fontSize: "0.8rem", color: "#c9a7ff", marginBottom: "6px" }}>
                    Phrase: {approach?.phrase?.length ? approach.phrase.join(" → ") : "—"}
                  </div>

                  <div style={{ fontSize: "0.78rem", color: "#8bd3a8", marginBottom: "10px" }}>
                    Rhythm: {rhythm?.rhythm || "—"}
                  </div>

                  {/* Add bar button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); addBar(index) }}
                    style={{
                      width: "100%", padding: "4px 0",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px dashed rgba(255,255,255,0.18)",
                      borderRadius: "6px", color: "rgba(255,255,255,0.4)",
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
        </div>

        <div style={panelStyle}>
          <div style={eyebrowStyle}>CONTINUOUS PHRASE</div>
          <div style={{ fontSize: "1rem", lineHeight: 1.9, color: "#c9a7ff" }}>
            {phrase.length ? phrase.join("  →  ") : "No phrase generated"}
          </div>
        </div>

        <div style={panelStyle}>
          <div style={eyebrowStyle}>RHYTHMIC SHAPE</div>
          <div style={{ fontSize: "1rem", lineHeight: 1.9, color: "#8bd3a8" }}>
            {rhythms.map((item, index) => (
              <span key={`${item.chord}-rhythm-${index}`}>
                <strong>{bars[index].symbol}</strong> [{item.rhythm}]
                {index < rhythms.length - 1 ? "   |   " : ""}
              </span>
            ))}
          </div>
        </div>
      </section>

      <aside style={sidePanelStyle}>
        <h2 style={{ fontSize: "1.8rem", marginBottom: "12px", color: "#e0b44c" }}>
          Bar {selectedIndex + 1}: {selectedBar.symbol}
        </h2>

        <div style={{ marginBottom: "18px" }}>
          <div style={eyebrowSmallStyle}>EDIT CHORD</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <div style={miniLabelStyle}>Root</div>
              <select
                value={selectedBar.root}
                onChange={(e) => updateBar(selectedIndex, { root: e.target.value })}
                style={selectStyle}
              >
                {ROOTS.map((root) => (
                  <option key={root} value={root}>
                    {root}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={miniLabelStyle}>Quality</div>
              <select
                value={selectedBar.quality}
                onChange={(e) => updateBar(selectedIndex, { quality: e.target.value })}
                style={selectStyle}
              >
                {QUALITIES.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {suggestedSub && (
            <div style={{ marginTop: "10px" }}>
              <button onClick={applySuggestedSubstitution} style={buttonStyle("#ff9ecb", "#24141d")}>
                Suggest Substitution: {suggestedSub.symbol} ({suggestedSub.label})
              </button>

              <div style={{ marginTop: "6px", fontSize: "0.9rem", opacity: 0.75 }}>
                {suggestedSub.reason}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "0.85rem", opacity: 0.65, marginBottom: "6px" }}>
            HARMONIC ROLE
          </div>

          <div style={{ fontSize: "1rem", color: "#f0d48a", marginBottom: "6px" }}>
            {harmonicContext[selectedIndex]?.functionLabel || "—"}
          </div>

          <div style={{ fontSize: "0.95rem", color: "#ffb3a7" }}>
            {harmonicContext[selectedIndex]?.cadenceLabels?.length
              ? harmonicContext[selectedIndex].cadenceLabels.join(" · ")
              : "No cadence label"}
          </div>
        </div>

        <InfoBlock title="CHORD TONES" value={info.notes?.join("  ·  ") || "None"} />
        <InfoBlock
          title="GUIDE TONES"
          value={guides.length ? guides.join("  →  ") : "None"}
          color="#e0b44c"
        />
        <InfoBlock title="INTERVALS" value={info.intervals?.join("  ·  ") || "None"} />

        {currentVoicing.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <div style={eyebrowSmallStyle}>PIANO VOICING</div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {currentVoicing.map((note, i) => (
                <span key={i} style={{
                  padding: "4px 9px", borderRadius: "7px", fontSize: "0.95rem", fontWeight: 700,
                  background: i === 0 && !playBass ? "rgba(189,32,49,0.18)" : "rgba(201,167,255,0.12)",
                  border: i === 0 && !playBass ? "1px solid rgba(189,32,49,0.4)" : "1px solid rgba(201,167,255,0.25)",
                  color: i === 0 && !playBass ? "#ff7a7a" : "#c9a7ff",
                }}>
                  {note}
                </span>
              ))}
            </div>
            <div style={{ marginTop: "5px", fontSize: "0.75rem", opacity: 0.45 }}>
              {playBass ? "rootless voicing" : "with root"}
            </div>
          </div>
        )}

        {selectedMotion && (
          <div style={{ marginBottom: "20px" }}>
            <div style={eyebrowSmallStyle}>VOICE LEADING TO {selectedMotion.nextChord}</div>
            {selectedMotion.best ? (
              <div style={{ fontSize: "1rem", color: "#8bd3a8", marginBottom: "8px" }}>
                Best motion: {selectedMotion.best.from} → {selectedMotion.best.to} ({selectedMotion.best.distance} semitone{selectedMotion.best.distance !== 1 ? "s" : ""})
              </div>
            ) : (
              <div style={{ fontSize: "1rem", opacity: 0.7, marginBottom: "8px" }}>
                No especially smooth motion found.
              </div>
            )}
          </div>
        )}

        {selectedTarget && (
          <div style={{ marginBottom: "20px" }}>
            <div style={eyebrowSmallStyle}>MELODIC TARGET</div>
            {selectedTarget.targetNote ? (
              <div style={{ fontSize: "1rem", color: "#7fc8ff" }}>
                Aim for <strong>{selectedTarget.targetNote}</strong> in {selectedTarget.nextChord}
                {selectedTarget.sourceNote ? ` from ${selectedTarget.sourceNote}` : ""}
              </div>
            ) : (
              <div style={{ fontSize: "1rem", opacity: 0.7 }}>Final bar. No next target.</div>
            )}
          </div>
        )}

        {selectedMelodyNote && (
          <div style={{ marginBottom: "20px" }}>
            <div style={eyebrowSmallStyle}>SKELETON MELODY NOTE</div>
            <div style={{ fontSize: "1.15rem", color: "#ff9ecb" }}>
              {selectedMelodyNote.note ? (
                <>
                  Play <strong>{selectedMelodyNote.note}</strong> as the structural note for this bar.
                </>
              ) : (
                "No melody note available."
              )}
            </div>
          </div>
        )}

        {selectedApproachLine && (
          <div style={{ marginBottom: "20px" }}>
            <div style={eyebrowSmallStyle}>VOICE LEADING PHRASE</div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
              <span style={{
                padding: "4px 10px", borderRadius: "8px",
                background: "rgba(201,167,255,0.12)", border: "1px solid rgba(201,167,255,0.3)",
                fontSize: "1.1rem", color: "#c9a7ff", fontWeight: 700,
              }}>
                {selectedApproachLine.arrivalNote || "—"}
              </span>
              <span style={{ opacity: 0.4, fontSize: "0.85rem" }}>arrived</span>
              <span style={{ opacity: 0.35 }}>→</span>
              <span style={{
                padding: "4px 10px", borderRadius: "8px",
                background: "rgba(139,211,168,0.12)", border: "1px solid rgba(139,211,168,0.3)",
                fontSize: "1.1rem", color: "#8bd3a8", fontWeight: 700,
              }}>
                {selectedApproachLine.departureNote || "—"}
              </span>
              <span style={{ opacity: 0.4, fontSize: "0.85rem" }}>
                → {selectedApproachLine.nextChord || "end"}
              </span>
            </div>
            <div style={{ fontSize: "0.82rem", opacity: 0.55 }}>
              {selectedApproachLine.approachType === "chromatic-above" && "↑ half-step above target"}
              {selectedApproachLine.approachType === "chromatic-below" && "↓ half-step below target"}
              {selectedApproachLine.approachType === "anchor" && "settling on guide tone"}
            </div>
          </div>
        )}

        {selectedRhythm && (
          <div style={{ marginBottom: "20px" }}>
            <div style={eyebrowSmallStyle}>RHYTHM TAG</div>
            <div style={{ fontSize: "1.05rem", color: "#8bd3a8" }}>{selectedRhythm.rhythm}</div>
          </div>
        )}


        <div>
          <div style={eyebrowSmallStyle}>SCALE OPTIONS</div>
          <div style={{ display: "grid", gap: "10px" }}>
            {scaleData.map((scale) => (
              <div key={scale.name} style={scaleCardStyle}>
                <div style={{ fontWeight: 700, marginBottom: "4px", textTransform: "capitalize" }}>
                  {scale.name}
                </div>
                <div style={{ opacity: 0.8, fontSize: "0.95rem" }}>
                  {scale.notes?.length ? scale.notes.join("  ·  ") : "No notes found"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </main>
  )
}

function InfoBlock({ title, value, color }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={eyebrowSmallStyle}>{title}</div>
      <div style={{ fontSize: "1.1rem", color: color || "#f3efe6" }}>{value}</div>
    </div>
  )
}

const panelStyle = {
  marginBottom: "20px",
  padding: "18px",
  borderRadius: "14px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
}

const sidePanelStyle = {
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "16px",
  padding: "20px",
  background: "rgba(255,255,255,0.03)",
}

const scaleCardStyle = {
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
}

function buttonStyle(color, bg) {
  return {
    padding: "9px 12px",
    borderRadius: "10px",
    border: `1px solid ${color}55`,
    background: bg,
    color,
    cursor: "pointer",
    fontWeight: 700,
  }
}

const selectStyle = {
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  background: "#171722",
  color: "#f3efe6",
  border: "1px solid rgba(255,255,255,0.12)",
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