"use client"

// Practice Timer — a countdown for the Playback & Practice bench. Pick a length
// (5 minutes by default), hit start, and drill until it chimes. Deadline-based
// rather than tick-counted, so a backgrounded tab doesn't lose minutes.

import { useCallback, useEffect, useRef, useState } from "react"

const DURATIONS = [
  { value: 60,    label: "1 min" },
  { value: 120,   label: "2 min" },
  { value: 180,   label: "3 min" },
  { value: 300,   label: "5 min" },
  { value: 600,   label: "10 min" },
  { value: 900,   label: "15 min" },
  { value: 1200,  label: "20 min" },
  { value: 1500,  label: "25 min" },
  { value: 1800,  label: "30 min" },
  { value: 2700,  label: "45 min" },
  { value: 3600,  label: "60 min" },
]

const DEFAULT_SECONDS = 300

function clock(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${String(ss).padStart(2, "0")}`
}

// A short three-note chime through the shared piano sampler — no second
// AudioContext, and it matches the app's timbre.
async function chime() {
  try {
    const { playSingleNote } = await import("@/lib/music/audio")
    const notes = ["C5", "E5", "G5"]
    notes.forEach((n, i) => setTimeout(() => playSingleNote(n, "4n", 0.7), i * 170))
  } catch { /* the visual state is the real signal — never throw over a bell */ }
}

export default function PracticeTimer({ onFinish, onState, inlineLabelStyle, selectStyle }) {
  const [duration, setDuration] = useState(DEFAULT_SECONDS)
  const [remaining, setRemaining] = useState(DEFAULT_SECONDS)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [stopBand, setStopBand] = useState(true)

  const deadlineRef = useRef(null)
  // Mirrored into refs so the countdown's interval can read the current values
  // without being torn down and restarted on every render.
  const onFinishRef = useRef(onFinish)
  const stopBandRef = useRef(stopBand)
  useEffect(() => { onFinishRef.current = onFinish }, [onFinish])
  useEffect(() => { stopBandRef.current = stopBand }, [stopBand])

  // Publish a coarse snapshot so the fretboard can mirror the clock. The
  // countdown itself ticks four times a second; this only fires when the
  // displayed second (or the run state) actually changes, so mirroring it
  // doesn't re-render the rest of the page three times for nothing.
  const onStateRef = useRef(onState)
  const lastPushRef = useRef(null)
  useEffect(() => { onStateRef.current = onState }, [onState])
  useEffect(() => {
    const seconds = Math.max(0, Math.ceil(remaining))
    const key = `${seconds}|${running}|${done}|${duration}`
    if (key === lastPushRef.current) return
    lastPushRef.current = key
    onStateRef.current?.({ seconds, running, done, duration })
  }, [remaining, running, done, duration])

  const finish = useCallback(() => {
    setRunning(false)
    setRemaining(0)
    setDone(true)
    deadlineRef.current = null
    chime()
    onFinishRef.current?.({ stopBand: stopBandRef.current })
  }, [])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const left = (deadlineRef.current - Date.now()) / 1000
      if (left <= 0) finish()
      else setRemaining(left)
    }, 250)
    return () => clearInterval(id)
  }, [running, finish])

  function start() {
    const from = remaining > 0 ? remaining : duration
    deadlineRef.current = Date.now() + from * 1000
    setRemaining(from)
    setDone(false)
    setRunning(true)
  }

  function pause() {
    setRemaining(Math.max(0, (deadlineRef.current - Date.now()) / 1000))
    setRunning(false)
  }

  function reset(seconds = duration) {
    setRunning(false)
    setDone(false)
    deadlineRef.current = null
    setRemaining(seconds)
  }

  function addMinute() {
    const next = remaining + 60
    if (running) deadlineRef.current = Date.now() + next * 1000
    setDone(false)
    setRemaining(next)
  }

  function pickDuration(seconds) {
    setDuration(seconds)
    reset(seconds)
  }

  const pct = duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 0
  const urgent = running && remaining <= 10
  const color = done ? "var(--db-c-salmon)" : urgent ? "var(--db-c-salmon)" : running ? "var(--db-c-green)" : "var(--db-c-blue)"

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
        padding: "8px 12px", borderRadius: "var(--db-r-md)",
        border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
        background: `color-mix(in srgb, ${color} 8%, var(--db-bg))`,
      }}
    >
      <span style={{ fontSize: "var(--db-fs-xs)", letterSpacing: "0.08em", opacity: 0.7 }}>⏱ TIMER</span>

      <span
        role="timer"
        aria-live={urgent || done ? "assertive" : "off"}
        aria-label={done ? "Practice timer finished" : `${clock(remaining)} remaining`}
        style={{
          fontSize: "var(--db-fs-display)", fontWeight: 800, lineHeight: 1,
          fontVariantNumeric: "tabular-nums", minWidth: "84px", textAlign: "center",
          color,
        }}
      >
        {clock(remaining)}
      </span>

      <button
        onClick={running ? pause : start}
        aria-label={running ? "Pause the practice timer" : "Start the practice timer"}
        disabled={!running && remaining <= 0 && duration <= 0}
        style={{
          padding: "7px 16px", borderRadius: "var(--db-r-md)", cursor: "pointer",
          fontWeight: 700, fontSize: "var(--db-fs-sm)",
          border: `1px solid ${color}`,
          background: `color-mix(in srgb, ${color} 14%, var(--db-bg))`,
          color,
        }}
      >
        {running ? "⏸ Pause" : done ? "↻ Again" : remaining < duration ? "▶ Resume" : "▶ Start"}
      </button>

      <button
        onClick={() => reset()}
        aria-label="Reset the practice timer"
        style={{
          padding: "7px 12px", borderRadius: "var(--db-r-md)", cursor: "pointer",
          fontSize: "var(--db-fs-sm)",
          border: "1px solid var(--db-panel-border)", background: "var(--db-panel-bg)", color: "var(--db-text)",
        }}
        title="Back to the full length"
      >
        Reset
      </button>

      <button
        onClick={addMinute}
        aria-label="Add a minute to the practice timer"
        style={{
          padding: "7px 12px", borderRadius: "var(--db-r-md)", cursor: "pointer",
          fontSize: "var(--db-fs-sm)",
          border: "1px solid var(--db-panel-border)", background: "var(--db-panel-bg)", color: "var(--db-text)",
        }}
        title="One more minute"
      >
        +1 min
      </button>

      <label style={inlineLabelStyle}>
        <span style={{ opacity: 0.7 }}>Length</span>
        <select
          value={duration}
          onChange={(e) => pickDuration(Number(e.target.value))}
          style={{ ...selectStyle, width: "auto", padding: "5px 8px", fontSize: "var(--db-fs-sm)" }}
          aria-label="Practice timer length"
        >
          {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </label>

      <label style={{ ...inlineLabelStyle, fontSize: "var(--db-fs-sm)" }} title="Stop the band when the timer reaches zero">
        <input type="checkbox" checked={stopBand} onChange={(e) => setStopBand(e.target.checked)} />
        Stop at 0:00
      </label>

      {/* Progress bar — the countdown at a glance from across the room */}
      <div
        aria-hidden="true"
        style={{
          flex: "0 1 200px", minWidth: "80px", height: "6px", borderRadius: "var(--db-r-pill)",
          background: "var(--db-panel-bg)", overflow: "hidden",
        }}
      >
        <div style={{
          width: `${pct * 100}%`, height: "100%", background: color,
          transition: "width 0.25s linear",
        }} />
      </div>

      {done && (
        <span style={{ fontSize: "var(--db-fs-sm)", fontWeight: 700, color: "var(--db-c-salmon)" }}>
          Time — take five.
        </span>
      )}
    </div>
  )
}
