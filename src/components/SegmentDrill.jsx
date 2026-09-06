"use client"

// Stage one of a Skeleton Key segment: YOU play it.
//
// The rest of the module hands you a generated line to study. This is the part
// that comes first — the changes loop with the rhythm section, the neck shows
// the notes this exercise is actually about, and a timer keeps you on it for
// five minutes instead of thirty seconds.
//
// The board is lens-aware, and that is the point of building it here rather
// than reusing Practice's. It reads its notes from the SAME device lenses that
// shape the generated line: applyDevices() over the segment's measures, so
// 1.3 shows you the Martino-converted pool, 4.1 the fused hexatonic, 7.2 the
// altered scale. One source of truth means the neck can't disagree with the
// exercise — which it would, immediately, if this recomputed chord-scales its
// own way.

import { useEffect, useMemo, useRef, useState } from "react"
import Fretboard from "@/components/Fretboard"
import PracticeTimer from "@/components/PracticeTimer"
import { applyDevices, IMPROV_DEVICES } from "@/lib/music/improviser/devices"
import { normalizeMeasures } from "@/lib/music/improviser/chartTimeline"
import { parseGigChord } from "@/lib/music/gigbook"
import { chordToMeasureIndex, measuresToBandBars } from "@/lib/music/skeletonKey"

// Flat-preferred, matching the rest of DukeBox's spelling.
const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
const nameOf = (pc) => NOTE_NAMES[((pc % 12) + 12) % 12]
const namesOf = (pcs) => (pcs || []).map(nameOf)

// Exact intervals first, guide-tone slots last — thirdPc and seventhPc are
// fallbacks (guidePcsFor walks 7th → 6th → 5th, and the Triads lens points
// seventhPc straight at the 5th), so testing them first labelled a plain G
// over Cmaj7 as "the 7th". Same ordering the generator's reasoning uses.
function roleOf(pc, seg) {
  if (pc === seg.rootPc) return "root"
  if (pc === (seg.rootPc + 4) % 12 || pc === (seg.rootPc + 3) % 12) return "3rd"
  if (pc === (seg.rootPc + 7) % 12) return "5th"
  if (pc === seg.thirdPc) return "3rd"
  if (pc === seg.seventhPc) return "7th"
  return "chord tone"
}

export default function SegmentDrill({
  segment, measures, devices, tempo: initialTempo,
  playLineSection, onStopPlayback,
  panelStyle, eyebrowStyle, inlineLabelStyle, selectStyle,
}) {
  // Every piece of state here belongs to ONE exercise — which bar is sounding,
  // the tempo it was written for, whether the band is running. Rather than
  // syncing those back out of props whenever the segment changes, the caller
  // keys this component per exercise so it remounts with the right state
  // already in place. Fewer effects, and no window where the transport is
  // running against changes that are no longer on screen.
  const [barIndex, setBarIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [tempo, setTempo] = useState(initialTempo || 100)
  const [showBoard, setShowBoard] = useState(true)
  const playingRef = useRef(false)

  // Leaving the segment, the tab, or the app must not leave a band playing.
  useEffect(() => () => { if (playingRef.current) onStopPlayback?.() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // One measure per entry, with the device lenses already applied.
  const timeline = useMemo(
    () => applyDevices(normalizeMeasures(measures), { devices }),
    [measures, devices]
  )
  const segments = timeline.segments
  const bandBars = useMemo(() => measuresToBandBars(measures, parseGigChord), [measures])
  const chordToMeasure = useMemo(() => chordToMeasureIndex(measures), [measures])

  // The chord sounding now, and the one being aimed at.
  const here = segments[Math.min(barIndex, segments.length - 1)] ?? segments[0]
  const next = segments[(Math.min(barIndex, segments.length - 1) + 1) % segments.length] ?? here

  const scaleNames = useMemo(() => namesOf(here?.scalePcs), [here])
  const chordNames = useMemo(() => namesOf(here?.pitchPcs ?? here?.chordPcs), [here])
  const guideNames = useMemo(
    () => (here ? [...new Set([nameOf(here.thirdPc), nameOf(here.seventhPc)])] : []),
    [here]
  )
  // The next chord's 3rd, lit on the board as the note to arrive on. That is
  // Chapter 2's entire lesson, so it belongs on the neck rather than only in
  // the prose.
  // Only a real change is worth pointing at. On a static progression every bar
  // is a separate segment carrying the same chord, so comparing objects said
  // "next: Cmaj7" four times over four bars of Cmaj7.
  const changes = !!next && !!here && next.symbol !== here.symbol
  const landing = changes ? nameOf(next.thirdPc) : null

  const lensNote = here?.deviceNotes?.join(" · ") || null

  // Not every device changes which notes exist. A triad chain or a wide-
  // interval rule generates its own motion through the ordinary harmony, so
  // the neck correctly shows the home chord and scale — but a student looking
  // at a plain major scale on a segment titled "Triadic Chromatic Approach"
  // deserves to be told that is the right board, not a broken one.
  const nonPoolDevices = useMemo(() => {
    if (lensNote) return []
    return (devices || [])
      .map((d) => IMPROV_DEVICES[typeof d === "string" ? d : d?.id])
      .filter((d) => d && typeof d.apply !== "function")
      .map((d) => d.label)
  }, [devices, lensNote])

  function play() {
    if (!segments.length) return
    playingRef.current = true
    setPlaying(true)
    playLineSection({
      line: null,                       // band only — the notes are yours to find
      barsOverride: bandBars,
      startIndex: 0,
      endIndex: bandBars.length - 1,
      practiceTempo: tempo,
      // onBar counts CHORDS; the ribbon counts measures.
      onBar: (i) => setBarIndex(Math.min(chordToMeasure[i] ?? i, measures.length - 1)),
      onDone: () => { playingRef.current = false; setPlaying(false); setBarIndex(0) },
    })
  }

  function stop() {
    onStopPlayback?.()
    playingRef.current = false
    setPlaying(false)
  }

  const chip = (active) => ({
    padding: "5px 12px", borderRadius: 999, fontSize: "var(--db-fs-sm)", cursor: "pointer",
    border: `1px solid ${active ? "var(--db-accent)" : "var(--db-panel-border)"}`,
    background: active ? "color-mix(in srgb, var(--db-accent) 16%, transparent)" : "transparent",
    color: active ? "var(--db-accent)" : "var(--db-text)",
    opacity: active ? 1 : 0.78,
  })

  return (
    <div style={{ ...panelStyle, margin: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ ...eyebrowStyle, marginBottom: 0 }}>FIRST — PLAY IT YOURSELF</div>
        <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.62 }}>
          Loop the changes and drill the exercise for five minutes before you look at a generated line
        </div>
      </div>

      {/* ── The changes ─────────────────────────────────────────────── */}
      <div style={{
        display: "grid", gap: "6px", marginTop: "14px",
        gridTemplateColumns: `repeat(${Math.min(measures.length, 4)}, minmax(0, 1fr))`,
      }}>
        {measures.map((sym, i) => {
          const active = playing && i === barIndex
          return (
            <div
              key={i}
              style={{
                padding: "9px 6px", borderRadius: "var(--db-r-md)", textAlign: "center",
                border: `1px solid ${active ? "var(--db-accent)" : "var(--db-panel-border)"}`,
                background: active ? "color-mix(in srgb, var(--db-accent) 18%, transparent)" : "transparent",
                fontWeight: active ? 800 : 600,
              }}
            >
              <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.5 }}>{i + 1}</div>
              <div style={{ fontSize: "var(--db-fs-md)" }}>{sym}</div>
            </div>
          )
        })}
      </div>

      {/* ── Transport ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginTop: "14px" }}>
        <button
          onClick={playing ? stop : play}
          style={{
            padding: "9px 18px", borderRadius: "var(--db-r-md)", fontWeight: 700, cursor: "pointer",
            border: "1px solid var(--db-accent)",
            background: playing ? "transparent" : "var(--db-accent)",
            color: playing ? "var(--db-accent)" : "var(--db-bg)",
          }}
        >
          {playing ? "Stop the band" : "Loop the changes"}
        </button>
        <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7, display: "flex", alignItems: "center", gap: "8px" }}>
          Tempo {tempo}
          <input
            type="range" min="50" max="220" step="2" value={tempo}
            onChange={(e) => setTempo(Number(e.target.value))}
            style={{ accentColor: "var(--db-accent)" }}
          />
        </label>
        <button onClick={() => setShowBoard((v) => !v)} style={chip(!showBoard)}>
          {showBoard ? "Hide the neck" : "Show the neck"}
        </button>
        {!showBoard && (
          <span style={{ fontSize: "var(--db-fs-xs)", opacity: 0.55 }}>
            Chords only — find the notes without being shown them
          </span>
        )}
      </div>

      {/* ── The neck ────────────────────────────────────────────────── */}
      {showBoard && here && (
        <div style={{ marginTop: "16px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap", marginBottom: "8px" }}>
            <strong style={{ fontSize: "var(--db-fs-lg)" }}>{here.symbol}</strong>
            <span style={{ fontSize: "var(--db-fs-sm)", opacity: 0.75 }}>{scaleNames.join(" · ")}</span>
            {lensNote && (
              <span style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-accent)" }}>{lensNote}</span>
            )}
          </div>

          {nonPoolDevices.length > 0 && (
            <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, marginBottom: "8px", maxWidth: "64ch" }}>
              The neck shows the home harmony — {nonPoolDevices.join(" and ")}{" "}
              {nonPoolDevices.length > 1 ? "generate their" : "generates its"} own motion rather than
              drawing from a pool, so what you see here is what you are departing from and coming back to.
            </div>
          )}

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "var(--db-fs-xs)", opacity: 0.7, marginBottom: "8px" }}>
            <span>● Root</span><span>● 3rd &amp; 7th</span><span>● Chord tone</span>
            <span>● Scale tone</span>{landing && <span>● Land here on beat 1</span>}
          </div>

          <Fretboard
            chordNotes={chordNames}
            rootNote={here.root}
            scaleNotes={scaleNames}
            view="scale"
            guideToneNotes={guideNames}
            targetNotes={landing ? [landing] : []}
            labelMode="names"
            stretch
          />

          {changes && (
            <div style={{
              marginTop: "10px", padding: "8px 12px", borderRadius: "var(--db-r-md)",
              border: "1px solid var(--db-panel-border)", fontSize: "var(--db-fs-sm)",
            }}>
              <strong>Next · {next.symbol}</strong> — land on {nameOf(next.thirdPc)} ({roleOf(next.thirdPc, next)})
              {" "}on beat 1. From {nameOf(here.seventhPc)}, the {roleOf(here.seventhPc, here)} you are on
              {" "}now, that is{" "}
              {(() => {
                const d = Math.min(
                  ((next.thirdPc - here.seventhPc) % 12 + 12) % 12,
                  ((here.seventhPc - next.thirdPc) % 12 + 12) % 12
                )
                return d === 0 ? "the same note — hold it" : d === 1 ? "a half step away — slide in" : `${d} semitones away`
              })()}.
            </div>
          )}
        </div>
      )}

      {/* ── The clock ───────────────────────────────────────────────── */}
      <div style={{ marginTop: "18px" }}>
        <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.62, marginBottom: "7px" }}>
          Drill it — five minutes on one idea beats thirty seconds on six
        </div>
        <PracticeTimer
          onFinish={({ stopBand }) => { if (stopBand) stop() }}
          inlineLabelStyle={inlineLabelStyle}
          selectStyle={selectStyle}
          transportRunning={playing}
        />
      </div>
    </div>
  )
}
