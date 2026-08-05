"use client"

import { useMemo } from "react"
import { lineNoteMidi } from "@/lib/music/lines"

const PC = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"]
const LETTER_STEP = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }
const STAFF_TOP = 58
const STAFF_GAP = 8
const TAB_TOP = 136
const TAB_GAP = 10
const LEFT = 58
const BAR_W = 250

function pitchInfo(midi) {
  const name = PC[((midi % 12) + 12) % 12]
  const letter = name[0]
  const octave = Math.floor(midi / 12) - 1
  const step = octave * 7 + LETTER_STEP[letter]
  const e4 = 4 * 7 + LETTER_STEP.E
  return { name, accidental: name.slice(1), y: STAFF_TOP + 4 * STAFF_GAP - (step - e4) * (STAFF_GAP / 2) }
}

function barBeats(bar) {
  if (Number(bar?.beats) > 0) return Number(bar.beats)
  const used = (bar?.n || []).reduce((sum, note) => sum + (Number(note[2]) || 0) + (Number(note[3]) || 0), 0)
  return Math.max(4, used || 4)
}

function DurationMark({ x, y, beats }) {
  const filled = beats < 2
  const stem = beats < 4
  const flagged = beats < 1
  return (
    <g>
      <ellipse cx={x} cy={y} rx={5.5} ry={4} transform={`rotate(-16 ${x} ${y})`}
        fill={filled ? "currentColor" : "var(--db-card-bg)"} stroke="currentColor" strokeWidth="1.4" />
      {stem && <line x1={x + 5} y1={y} x2={x + 5} y2={y - 30} stroke="currentColor" strokeWidth="1.4" />}
      {flagged && <path d={`M ${x + 5} ${y - 30} q 16 5 9 18`} fill="none" stroke="currentColor" strokeWidth="1.6" />}
      {Math.abs(beats - 1 / 3) < 0.03 && <text x={x + 8} y={y - 32} fontSize="8" fill="currentColor">3</text>}
    </g>
  )
}

function LedgerLines({ x, y }) {
  const lines = []
  const bottom = STAFF_TOP + STAFF_GAP * 4
  if (y > bottom + 2) {
    for (let ly = bottom + STAFF_GAP; ly <= y + 2; ly += STAFF_GAP) lines.push(ly)
  } else if (y < STAFF_TOP - 2) {
    for (let ly = STAFF_TOP - STAFF_GAP; ly >= y - 2; ly -= STAFF_GAP) lines.push(ly)
  }
  return lines.map((ly) => <line key={ly} x1={x - 8} y1={ly} x2={x + 8} y2={ly} stroke="currentColor" strokeWidth="1" />)
}

export default function LineNotation({ line, tempo = 120, activeIndex = -1, compact = false }) {
  const bars = line?.bars || []
  const width = Math.max(360, LEFT + bars.length * BAR_W + 12)
  const height = compact ? 202 : 218
  const events = useMemo(() => {
    let globalIndex = 0
    return bars.map((bar, bi) => {
      const beats = barBeats(bar)
      let pos = 0
      const notes = (bar.n || []).map(([s, f, dur, wait = 0], ni) => {
        pos += Number(wait) || 0
        const onset = pos
        pos += Number(dur) || 0
        return { s: Number(s), f: Number(f), dur: Number(dur) || 0.5, wait: Number(wait) || 0, onset, beats, bi, ni, globalIndex: globalIndex++ }
      })
      return { bar, beats, notes }
    })
  }, [line])

  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--db-panel-border)", borderRadius: "var(--db-r-md)", background: "var(--db-card-bg)" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ display: "block", width: "100%", minWidth: `${Math.min(width, 620)}px`, color: "var(--db-text)" }} role="img" aria-label="Standard notation and guitar tablature for this line">
        <text x={14} y={24} fontSize="12" fontWeight="700" fill="var(--db-muted)">♩ = {tempo}</text>
        <text x={12} y={90} fontSize="43" fontFamily="serif" fill="currentColor">𝄞</text>
        <text x={17} y={158} fontSize="18" fontWeight="800" fontFamily="serif" fontStyle="italic" fill="currentColor">TAB</text>
        <text x={43} y={68} fontSize="16" fontWeight="700" fill="currentColor">4</text>
        <text x={43} y={83} fontSize="16" fontWeight="700" fill="currentColor">4</text>

        {Array.from({ length: 5 }, (_, i) => <line key={`s${i}`} x1={LEFT - 8} y1={STAFF_TOP + i * STAFF_GAP} x2={width - 8} y2={STAFF_TOP + i * STAFF_GAP} stroke="currentColor" strokeWidth="0.8" />)}
        {Array.from({ length: 6 }, (_, i) => <line key={`t${i}`} x1={LEFT - 8} y1={TAB_TOP + i * TAB_GAP} x2={width - 8} y2={TAB_TOP + i * TAB_GAP} stroke="currentColor" strokeWidth="0.65" opacity="0.75" />)}

        {events.map(({ bar, beats, notes }, bi) => {
          const x0 = LEFT + bi * BAR_W
          const chordNames = String(bar.c || "").trim().split(/\s+/).filter(Boolean)
          return (
            <g key={bi}>
              <line x1={x0} y1={STAFF_TOP} x2={x0} y2={TAB_TOP + TAB_GAP * 5} stroke="currentColor" strokeWidth={bi ? "1" : "0"} />
              {chordNames.map((chord, ci) => <text key={ci} x={x0 + 12 + ci * (BAR_W / Math.max(1, chordNames.length))} y={45} fontSize="13" fontWeight="700" fill="currentColor">{chord}</text>)}
              {notes.map((note) => {
                const x = x0 + 18 + (note.onset / beats) * (BAR_W - 36)
                const midi = lineNoteMidi(note.s, note.f)
                const pitch = pitchInfo(midi)
                const active = note.globalIndex === activeIndex
                const color = active ? "var(--db-c-salmon, var(--db-accent))" : "currentColor"
                const restX = note.wait ? x0 + 18 + ((note.onset - note.wait / 2) / beats) * (BAR_W - 36) : null
                return (
                  <g key={note.ni} style={{ color }}>
                    {note.wait > 0 && <text x={restX} y={80} textAnchor="middle" fontSize="20" fill="var(--db-muted)">𝄽</text>}
                    <LedgerLines x={x} y={pitch.y} />
                    {pitch.accidental && <text x={x - 11} y={pitch.y + 4} textAnchor="middle" fontSize="12" fill={color}>{pitch.accidental}</text>}
                    <DurationMark x={x} y={pitch.y} beats={note.dur} />
                    <rect x={x - 7} y={TAB_TOP + (note.s - 1) * TAB_GAP - 7} width="14" height="11" rx="2" fill="var(--db-card-bg)" />
                    <text x={x} y={TAB_TOP + (note.s - 1) * TAB_GAP + 2} textAnchor="middle" fontSize="10" fontWeight={active ? "800" : "600"} fill={color}>{note.f}</text>
                  </g>
                )
              })}
              {Number(bar.tailRest) > 0 && <text x={x0 + BAR_W - 24} y={80} textAnchor="middle" fontSize="20" fill="var(--db-muted)">𝄽</text>}
            </g>
          )
        })}
        <line x1={LEFT + bars.length * BAR_W} y1={STAFF_TOP} x2={LEFT + bars.length * BAR_W} y2={TAB_TOP + TAB_GAP * 5} stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  )
}
