"use client"

// The Vocabulary Workbench — Chapter 9's call-and-response panel.
//
// Every other segment in Skeleton Key hands you a line and explains it. This
// one refuses to show you anything: it plays a phrase, you work it out on the
// guitar, you enter what you heard, and only then does it reveal what was
// actually there and mark the difference. Bergonzi's point is that
// transcription isn't homework, it's the method — so the concealment IS the
// feature, and revealing early is the only way to fail at it.
//
// What this is NOT: there is no microphone here, and no audio-to-notation. Two
// honest reasons. Pitch detection on a polyphonic instrument is a project in
// itself, and more to the point the student is holding a guitar — the answer
// they need to give is on the fretboard, not in a waveform. Entering it by
// fret is both simpler and closer to what they'll actually be graded on.

import { useEffect, useMemo, useRef, useState } from "react"
import LineNotation from "@/components/LineNotation"
import { improvise } from "@/lib/music/improviser"
import { parseGigChord } from "@/lib/music/gigbook"
import { compareAnswer, flattenLine, midiAt, noteName } from "@/lib/music/workbench"

// Pitch maths and the answer comparison live in lib/music/workbench.js — the
// scoring rules are pedagogy, not presentation, and are tested there.
const OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 }
const midiOf = midiAt
const nameOf = noteName
const STRINGS = [1, 2, 3, 4, 5, 6]
const FRETS = Array.from({ length: 16 }, (_, i) => i)

const LOG_KEY = "dukebox.skeletonKey.workbench"

// Module scope on purpose: a fresh seed is exactly the impure thing a
// component body may not do, and the lint rule is right to say so even though
// this only ever runs from a click. Keeping it out here states the intent —
// the randomness belongs to the act of asking for a new phrase, not to
// rendering one. The seed is kept so any phrase can be replayed note for note.
function freshSeed() {
  return Math.floor(Math.random() * 0xffffff)
}

// The reference phrase is always drawn from vocabulary the curriculum has
// already taught, so Chapter 9 tests recall rather than introducing anything.
const SOURCES = [
  { id: "inside", label: "Inside (Ch. 1–2)", devices: [], level: 2,
    measures: ["Dm7", "G7", "Cmaj7", "Cmaj7"] },
  { id: "bebop", label: "Bebop scale (Ch. 3)", devices: ["bebop-scale"], level: 3,
    measures: ["Dm7", "G7", "Cmaj7", "Cmaj7"] },
  { id: "enclosed", label: "Enclosures (Ch. 3)", devices: ["encirclement"], level: 3,
    measures: ["Dm7", "G7", "Cmaj7", "Cmaj7"] },
  { id: "hexatonic", label: "Hexatonics (Ch. 4)", devices: ["hexatonics"], level: 4,
    measures: ["Cmaj7", "Cmaj7", "Cmaj7", "Cmaj7"] },
  { id: "pentatonic", label: "Pentatonic (Ch. 5)", devices: ["pentatonic"], level: 4,
    measures: ["F7", "Bb7", "F7", "F7"] },
  { id: "martino", label: "Minor conversion (Ch. 7)", devices: ["minor-conversion"], level: 3,
    measures: ["Dm7", "G7", "Cmaj7", "Cmaj7"] },
  { id: "outside", label: "Triad chain (Ch. 8)", devices: ["tca"], level: 5,
    measures: ["G7", "G7", "G7", "G7"] },
]

export default function VocabularyWorkbench({
  playLineSection, onStopPlayback, onSaveLick, panelStyle, eyebrowStyle, selectStyle,
}) {
  const [sourceId, setSourceId] = useState(SOURCES[0].id)
  const [reference, setReference] = useState(null)   // { line, seed, source }
  const [answer, setAnswer] = useState([])
  const [revealed, setRevealed] = useState(false)
  const [tempo, setTempo] = useState(90)
  const [playing, setPlaying] = useState(false)
  const [log, setLog] = useState([])
  const answerRef = useRef(null)

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(LOG_KEY) || "[]")
      if (Array.isArray(saved)) setLog(saved)
    } catch { /* a corrupt log should never take the panel down */ }
  }, [])

  const source = SOURCES.find((s) => s.id === sourceId) || SOURCES[0]
  const refNotes = useMemo(() => flattenLine(reference?.line), [reference])
  const answerNotes = useMemo(() => answer.map(([s, f]) => ({ midi: midiOf(s, f), string: s, fret: f })), [answer])
  const result = useMemo(
    () => (revealed ? compareAnswer(refNotes, answerNotes) : null),
    [revealed, refNotes, answerNotes]
  )

  function newPhrase() {
    const seed = freshSeed()
    const { line } = improvise({
      measures: source.measures,
      devices: source.devices,
      level: source.level,
      profileId: "bebop",
      controls: { space: 0.45, altered: 0.2, intensity: 0.55 },
      seed,
      tag: "[Ch.9 · transcription]",
    })
    if (!line?.bars?.some((b) => b.n?.length)) return
    stop()
    setReference({ line, seed, source })
    setAnswer([])
    setRevealed(false)
  }

  function play() {
    if (!reference) return
    const bars = source.measures.map(
      (sym) => parseGigChord(sym, "A") ?? { root: "C", quality: "maj7", symbol: sym, section: "A", beats: 4 }
    )
    setPlaying(true)
    playLineSection({
      line: reference.line,
      barsOverride: bars,
      startIndex: 0,
      endIndex: bars.length - 1,
      practiceTempo: tempo,
      muteLine: false,
      onDone: () => setPlaying(false),
    })
  }

  function stop() {
    onStopPlayback?.()
    setPlaying(false)
  }

  function addNote(string, fret) {
    setAnswer((prev) => [...prev, [string, fret]])
    window.setTimeout(() => answerRef.current?.scrollTo({ left: 1e6 }), 0)
  }

  function saveAttempt(verdictLabel) {
    if (!reference) return
    const entry = {
      id: `wb-${Date.now()}`,
      at: new Date().toISOString(),
      source: source.label,
      seed: reference.seed,
      notes: refNotes.length,
      answered: answerNotes.length,
      exact: result?.exact ?? 0,
      octave: result?.octave ?? 0,
      verdict: verdictLabel,
    }
    setLog((prev) => {
      const next = [entry, ...prev].slice(0, 50)
      try { window.localStorage.setItem(LOG_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  function saveToLicktionary() {
    if (!reference || !onSaveLick) return
    const suggested = `Ch.9 transcription — ${source.label}`
    const name = window.prompt("Name this phrase:", suggested)?.trim()
    if (!name) return
    onSaveLick({
      name,
      line: reference.line,
      baseKey: null,
      mode: "custom",
      device: `Workbench · ${source.label}`,
      cue: reference.line.s || "Saved from the Vocabulary Workbench",
    })
  }

  const chip = (active) => ({
    padding: "5px 12px", borderRadius: 999, fontSize: "var(--db-fs-sm)", cursor: "pointer",
    border: `1px solid ${active ? "var(--db-accent)" : "var(--db-panel-border)"}`,
    background: active ? "color-mix(in srgb, var(--db-accent) 16%, transparent)" : "transparent",
    color: active ? "var(--db-accent)" : "var(--db-text)",
    opacity: active ? 1 : 0.78,
  })
  const VERDICT_COLOR = {
    exact: "var(--db-accent)",
    octave: "var(--db-c-yellow, #d8a24a)",
    wrong: "var(--db-c-red, #c9564f)",
    missing: "var(--db-muted)",
    extra: "var(--db-c-red, #c9564f)",
  }

  return (
    <div style={{ ...panelStyle, margin: 0 }}>
      <div style={{ ...eyebrowStyle }}>VOCABULARY WORKBENCH</div>
      <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.7, marginBottom: "14px", maxWidth: "64ch" }}>
        Call and response. The phrase plays; the notation stays hidden. Work it out on the guitar,
        enter what you heard, and only then reveal it. Getting it wrong and seeing exactly where is
        the whole exercise — so don&apos;t reveal early.
      </div>

      {/* ── The reference ─────────────────────────────────────────── */}
      <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.62, margin: "0 0 7px" }}>
        Draw the phrase from
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
        {SOURCES.map((s) => (
          <button key={s.id} onClick={() => setSourceId(s.id)} aria-pressed={s.id === sourceId} style={chip(s.id === sourceId)}>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={() => newPhrase()}
          style={{
            padding: "9px 18px", borderRadius: "var(--db-r-md)", fontWeight: 700, cursor: "pointer",
            border: "1px solid var(--db-accent)", background: "var(--db-accent)", color: "var(--db-bg)",
          }}
        >
          New reference phrase
        </button>
        <button onClick={playing ? stop : play} disabled={!reference} style={{ ...chip(playing), opacity: reference ? 1 : 0.4 }}>
          {playing ? "Stop" : "Play it"}
        </button>
        <label style={{ fontSize: "var(--db-fs-xs)", opacity: 0.7, display: "flex", alignItems: "center", gap: "8px" }}>
          Tempo {tempo}
          <input
            type="range" min="50" max="160" step="5" value={tempo}
            onChange={(e) => setTempo(Number(e.target.value))}
            style={{ accentColor: "var(--db-accent)" }}
          />
        </label>
        {reference && (
          <span style={{ fontSize: "var(--db-fs-xs)", opacity: 0.55 }}>
            {refNotes.length} notes · seed {reference.seed}
          </span>
        )}
      </div>

      {!reference && (
        <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.6, marginTop: "14px" }}>
          Pick a source and generate a phrase to begin.
        </div>
      )}

      {reference && (
        <>
          {/* ── Your answer ─────────────────────────────────────────── */}
          <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.62, margin: "18px 0 7px" }}>
            What you heard — tap the frets, in order
          </div>
          <div
            ref={answerRef}
            style={{
              display: "flex", gap: "6px", overflowX: "auto", padding: "8px 0", minHeight: "38px",
              borderBottom: "1px solid var(--db-panel-border)", marginBottom: "10px",
            }}
          >
            {answerNotes.length === 0 && (
              <span style={{ fontSize: "var(--db-fs-sm)", opacity: 0.45 }}>Nothing entered yet</span>
            )}
            {answerNotes.map((n, i) => (
              <span
                key={i}
                style={{
                  padding: "3px 9px", borderRadius: "var(--db-r-md)", whiteSpace: "nowrap",
                  border: `1px solid ${result ? VERDICT_COLOR[result.rows[i]?.verdict] : "var(--db-panel-border)"}`,
                  fontSize: "var(--db-fs-xs)",
                  color: result ? VERDICT_COLOR[result.rows[i]?.verdict] : "var(--db-text)",
                }}
              >
                {nameOf(n.midi)} <span style={{ opacity: 0.55 }}>{n.string}/{n.fret}</span>
              </span>
            ))}
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
            <button onClick={() => setAnswer((p) => p.slice(0, -1))} disabled={!answer.length} style={{ ...chip(false), opacity: answer.length ? 0.78 : 0.35 }}>
              Undo note
            </button>
            <button onClick={() => setAnswer([])} disabled={!answer.length} style={{ ...chip(false), opacity: answer.length ? 0.78 : 0.35 }}>
              Clear
            </button>
            <button onClick={() => setRevealed(true)} disabled={revealed} style={{ ...chip(revealed), opacity: revealed ? 0.5 : 1 }}>
              {revealed ? "Revealed" : "Reveal and compare"}
            </button>
          </div>

          {/* A plain string × fret grid. Six rows, low E at the bottom, the
              way the neck actually looks from playing position. */}
          <div style={{ overflowX: "auto", marginBottom: "6px" }}>
            <table style={{ borderCollapse: "collapse", fontSize: "var(--db-fs-xs)" }}>
              <tbody>
                {STRINGS.map((string) => (
                  <tr key={string}>
                    <td style={{ padding: "0 8px 0 0", opacity: 0.5, textAlign: "right" }}>
                      {nameOf(OPEN_MIDI[string])}
                    </td>
                    {FRETS.map((fret) => (
                      <td key={fret} style={{ padding: "1px" }}>
                        <button
                          onClick={() => addNote(string, fret)}
                          title={`${nameOf(midiOf(string, fret))} — string ${string}, fret ${fret}`}
                          style={{
                            width: "30px", height: "22px", cursor: "pointer",
                            borderRadius: "4px", fontSize: "10px",
                            border: "1px solid var(--db-panel-border)",
                            background: fret === 0 ? "color-mix(in srgb, var(--db-accent) 8%, transparent)" : "transparent",
                            color: "var(--db-text)", opacity: 0.75,
                          }}
                        >
                          {nameOf(midiOf(string, fret))}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td />
                  {FRETS.map((fret) => (
                    <td key={fret} style={{ textAlign: "center", opacity: 0.4, fontSize: "10px" }}>{fret}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── The reveal ──────────────────────────────────────────── */}
          {revealed && result && (
            <div style={{ marginTop: "16px" }}>
              <div style={{ fontSize: "var(--db-fs-sm)", marginBottom: "10px" }}>
                <strong>{result.exact} of {result.total}</strong> exact
                {result.octave > 0 && <> · <span style={{ color: VERDICT_COLOR.octave }}>{result.octave} right note, wrong octave</span></>}
                {answerNotes.length !== result.total && (
                  <> · you entered {answerNotes.length}, the phrase had {result.total}</>
                )}
              </div>

              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
                {result.rows.map((row) => (
                  <span
                    key={row.i}
                    style={{
                      padding: "3px 9px", borderRadius: "var(--db-r-md)", fontSize: "var(--db-fs-xs)",
                      border: `1px solid ${VERDICT_COLOR[row.verdict]}`, color: VERDICT_COLOR[row.verdict],
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.ref ? nameOf(row.ref.midi) : "—"}
                    {row.verdict !== "exact" && row.got && <span style={{ opacity: 0.7 }}> (you: {nameOf(row.got.midi)})</span>}
                  </span>
                ))}
              </div>

              <LineNotation line={reference.line} scale={0.9} maxHeight={220} />

              <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.65, margin: "10px 0" }}>
                {reference.line.s}
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button onClick={() => saveAttempt("got it")} style={chip(false)}>Log — got it</button>
                <button onClick={() => saveAttempt("needs work")} style={chip(false)}>Log — needs work</button>
                <button onClick={saveToLicktionary} style={chip(false)}>Save phrase to Licktionary</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── The library ───────────────────────────────────────────── */}
      <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.62, margin: "20px 0 7px" }}>
        Your transcription log
      </div>
      {log.length === 0 ? (
        <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.55, maxWidth: "64ch" }}>
          Nothing logged yet. This library fills with your own work — phrases you transcribed and
          what you scored on them. It ships empty on purpose: the point of Chapter 9 is that the
          vocabulary becomes yours by being taken down by ear, not handed over.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "5px" }}>
          {log.map((entry) => (
            <div key={entry.id} style={{ display: "flex", gap: "12px", fontSize: "var(--db-fs-xs)", opacity: 0.8, flexWrap: "wrap" }}>
              <span style={{ opacity: 0.55 }}>{entry.at.slice(0, 10)}</span>
              <span>{entry.source}</span>
              <span>{entry.exact}/{entry.notes} exact{entry.octave ? ` · ${entry.octave} octave` : ""}</span>
              <span style={{ color: entry.verdict === "got it" ? "var(--db-accent)" : "var(--db-muted)" }}>{entry.verdict}</span>
              <span style={{ opacity: 0.45 }}>seed {entry.seed}</span>
            </div>
          ))}
          <button
            onClick={() => { setLog([]); try { window.localStorage.removeItem(LOG_KEY) } catch {} }}
            style={{ ...chip(false), justifySelf: "start", marginTop: "6px", opacity: 0.5 }}
          >
            Clear log
          </button>
        </div>
      )}
    </div>
  )
}
