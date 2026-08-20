"use client"

// Phrase Machine's formula-building tree — click a block to extend (or, on
// an already-built column, replace-from-here) a sequence of blocks, each
// scored against the one before it by phraseEngine.js's compatibility graph.
// Ported from phrase-machine_5.html's DOM-built renderTree()/renderFormula()
// into React state + JSX; the scoring itself (computeScore/getTopN/tier) is
// untouched, imported straight from the engine.
//
// Personal usage (pm_usage in localStorage — pairs you've actually picked
// get a small score bonus over time) lives here, not in the engine: it's UI
// state a user builds by using this exact tree, same as the prototype kept
// it beside its own renderTree().

import { useEffect, useState } from "react"
import {
  BLOCK_FNS, BLOCK_CAT, BLOCK_LABELS, BLOCK_FLAVOR,
  getTopN, tier, chordAtFormulaPosition, chipColor,
} from "@/lib/music/phraseEngine"

const USAGE_KEY = "pm_usage"
const TOTAL_PHRASE_SLOTS = 5 // same as the prototype — a formula rarely runs longer than this

const SLOT_COLOR_VARS = { ii: "var(--db-accent)", V: "var(--db-c-salmon)", I: "var(--db-c-green)", IV: "var(--db-c-gold)" }
const TIER_COLOR_VARS = { hot: "var(--db-c-gold)", warm: "var(--db-accent)", ok: "var(--db-c-green)", out: "var(--db-c-purple)" }
const FLAVOR_LABELS = { inside: "inside", outside: "outside", altered: "altered", neutral: "" }

function loadUsage() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(USAGE_KEY) || "{}")
    return raw && typeof raw === "object" ? raw : {}
  } catch { return {} }
}

const DIRECTIONS = [
  { id: "ascending", label: "↑ Asc" },
  { id: "arch", label: "↑↓ Arch" },
  { id: "descending", label: "↓ Desc" },
  { id: "valley", label: "↓↑ Valley" },
  { id: "chromatic", label: "~ Chrom" },
]
const SHOW_OPTIONS = [
  { id: "3", label: "Top 3" },
  { id: "5", label: "Top 5" },
  { id: "all", label: "All" },
]

export default function PhraseMachineTree({ formula, onFormulaChange, prog, voicePath, onVoicePathChange, showN, onShowNChange }) {
  const [usage, setUsage] = useState({})
  useEffect(() => { setUsage(loadUsage()) }, [])

  function recordUsage(pair) {
    setUsage((prev) => {
      const next = { ...prev, [pair]: (prev[pair] || 0) + 1 }
      try { window.localStorage.setItem(USAGE_KEY, JSON.stringify(next)) } catch { /* usage bonus is a nicety, not required */ }
      return next
    })
  }

  function pickNode(col, type, isBuilt) {
    if (col > 0) recordUsage(`${formula[col - 1]}>${type}`)
    onFormulaChange(isBuilt ? [...formula.slice(0, col), type] : [...formula, type])
  }

  function removeChip(i) {
    onFormulaChange(formula.filter((_, idx) => idx !== i))
  }

  const chipStyle = (color) => ({
    display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 10px",
    borderRadius: 999, fontSize: "var(--db-fs-xs)", fontWeight: 700, cursor: "default",
    border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
    background: `color-mix(in srgb, ${color} 15%, transparent)`, color,
  })

  const toggleStyle = (active) => ({
    padding: "5px 11px", borderRadius: "var(--db-r-md)", fontSize: "var(--db-fs-xs)", cursor: "pointer",
    border: `1px solid ${active ? "var(--db-accent)" : "var(--db-panel-border)"}`,
    background: active ? "color-mix(in srgb, var(--db-accent) 18%, transparent)" : "transparent",
    color: active ? "var(--db-accent)" : "var(--db-text)", fontWeight: active ? 700 : 500,
  })

  const maxCols = Math.min(formula.length + 1, TOTAL_PHRASE_SLOTS + 1)
  const columns = Array.from({ length: maxCols }, (_, col) => {
    const fromType = col > 0 ? formula[col - 1] : null
    const chordData = chordAtFormulaPosition(prog, formula, col)
    const slot = chordData.slot || "ii"
    const symbol = chordData.symbol || slot
    const isBuilt = col < formula.length
    const isPast = col > formula.length

    let candidates
    if (col === 0) {
      candidates = Object.keys(BLOCK_FNS)
        .filter((k) => !k.startsWith("land"))
        .map((k) => ({ type: k, score: BLOCK_CAT[k] === "opener" ? 80 : 50, flavor: BLOCK_FLAVOR[k] || "neutral" }))
        .sort((a, b) => b.score - a.score)
      if (showN !== "all") candidates = candidates.slice(0, parseInt(showN, 10))
    } else {
      candidates = getTopN(fromType, slot, voicePath, col, TOTAL_PHRASE_SLOTS, usage, showN, false)
    }

    return { col, slot, symbol, isBuilt, isPast, candidates }
  })

  return (
    <div>
      {/* Direction + candidate count */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", marginTop: "12px" }}>
        <span style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, marginRight: "2px" }}>Direction</span>
        {DIRECTIONS.map((d) => (
          <button key={d.id} type="button" onClick={() => onVoicePathChange(d.id)} aria-pressed={voicePath === d.id} style={toggleStyle(voicePath === d.id)}>
            {d.label}
          </button>
        ))}
        <span style={{ width: "1px", height: "16px", background: "var(--db-panel-border)", margin: "0 4px" }} />
        <span style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, marginRight: "2px" }}>Show</span>
        {SHOW_OPTIONS.map((o) => (
          <button key={o.id} type="button" onClick={() => onShowNChange(o.id)} aria-pressed={showN === o.id} style={toggleStyle(showN === o.id)}>
            {o.label}
          </button>
        ))}
      </div>

      {/* Formula chip strip */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", marginTop: "10px", minHeight: "30px" }}>
        {formula.length === 0 && (
          <span style={{ fontSize: "var(--db-fs-sm)", opacity: 0.55 }}>Click a node below to start building your phrase</span>
        )}
        {formula.map((type, i) => {
          const color = chipColor(type)
          return (
            <span key={i} style={chipStyle(color)}>
              {BLOCK_LABELS[type] || type}
              <span
                onClick={() => removeChip(i)}
                role="button"
                tabIndex={0}
                aria-label={`Remove ${BLOCK_LABELS[type] || type}`}
                style={{ opacity: 0.6, cursor: "pointer", fontSize: "13px", lineHeight: 1 }}
              >×</span>
            </span>
          )
        })}
        {formula.length > 0 && (
          <span style={{ fontSize: "var(--db-fs-xs)", opacity: 0.5 }}>→ click the next node below</span>
        )}
      </div>

      {/* Tree columns */}
      <div style={{ display: "flex", gap: "10px", overflowX: "auto", marginTop: "14px", paddingBottom: "6px" }}>
        {columns.map(({ col, slot, symbol, isBuilt, isPast, candidates }) => (
          <div key={col} style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "0 0 auto", width: "126px", opacity: isPast ? 0.35 : 1, pointerEvents: isPast ? "none" : "auto" }}>
            <div style={{
              fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700,
              textAlign: "center", color: SLOT_COLOR_VARS[slot] || "var(--db-muted)", marginBottom: "2px",
            }}>
              {symbol} ({slot})
            </div>
            {candidates.map((c) => {
              const color = TIER_COLOR_VARS[tier(c.score)] || "var(--db-muted)"
              const selected = isBuilt && formula[col] === c.type
              const flavorLabel = FLAVOR_LABELS[c.flavor] || ""
              return (
                <button
                  key={c.type}
                  type="button"
                  onClick={() => pickNode(col, c.type, isBuilt)}
                  disabled={isPast}
                  style={{
                    textAlign: "left", padding: "7px 9px", borderRadius: "var(--db-r-md)", cursor: "pointer",
                    border: `2px solid ${selected ? "var(--db-text)" : `color-mix(in srgb, ${color} 45%, transparent)`}`,
                    background: `color-mix(in srgb, ${color} ${selected ? 22 : 14}%, var(--db-card-bg))`,
                    color: "var(--db-text)",
                  }}
                >
                  <div style={{ fontSize: "var(--db-fs-xs)", fontWeight: 700, lineHeight: 1.2 }}>{BLOCK_LABELS[c.type] || c.type}</div>
                  {flavorLabel && (
                    <div style={{ fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color, marginTop: "2px" }}>
                      {flavorLabel}
                    </div>
                  )}
                  <div style={{ fontSize: "9px", opacity: 0.55, marginTop: "2px" }}>{c.score}</div>
                  <div style={{ height: "3px", borderRadius: "2px", marginTop: "4px", background: color, width: `${c.score}%` }} />
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
