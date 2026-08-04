"use client"

// Song Crafter — build progressions from the circle of fifths or the all-keys
// chart, arrange them into song sections, transpose the whole thing, and hand
// it to the DukeBox engine to hear it.
//
// Every chord source is BOTH tap-to-add and draggable: HTML5 drag-and-drop
// doesn't fire on touch, so tapping is the primary interaction and dragging is
// the desktop bonus.

import { useEffect, useRef, useState } from "react"
import {
  KEY_TABLE, KEY_NAMES, DEGREE_LABELS, CIRCLE_ORDER, RELATIVE_MINOR,
  PROGRESSIONS, PROGRESSION_GENRES, SECTION_KINDS, SECTION_GUIDE, CRAFT_TIPS,
  resolveDegree, transposeChordToKey, splitChord,
} from "@/lib/music/songcraft"
import { parseGigChord } from "@/lib/music/gigbook"

let _uid = 0
const uid = () => `sc${++_uid}`

// ─── Wall-chart styling ───────────────────────────────────────────────────────
const CHART_CELL = {
  border: "1.5px solid var(--line)",
  textAlign: "center",
  padding: "9px 3px",
}
// I, IV, V — the primary (major) triads, shaded on the classic chart
const PRIMARY_DEGREES = new Set([0, 3, 4])

// Real accidental glyphs read far better at chart size than "b" and "#"
const pretty = (s) => String(s).replace(/b/g, "♭").replace(/#/g, "♯")
const prettyKey = (k) => pretty(k)
// Only the root's accidental should become a glyph — leave m, °, maj7 alone
const prettyChord = (sym) => {
  const { root, suffix } = splitChord(sym)
  return pretty(root) + suffix
}

// ─── Circle of fifths geometry ────────────────────────────────────────────────
const CX = 150, CY = 150
const R_OUT = 144, R_MID = 98, R_IN = 56
const SWEEP = 360 / 12

const pol = (r, deg) => {
  const rad = ((deg - 90) * Math.PI) / 180
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)]
}

function wedge(rOuter, rInner, i) {
  const a0 = i * SWEEP - SWEEP / 2
  const a1 = a0 + SWEEP
  const [x0, y0] = pol(rOuter, a0), [x1, y1] = pol(rOuter, a1)
  const [x2, y2] = pol(rInner, a1), [x3, y3] = pol(rInner, a0)
  return `M ${x0} ${y0} A ${rOuter} ${rOuter} 0 0 1 ${x1} ${y1} L ${x2} ${y2} A ${rInner} ${rInner} 0 0 0 ${x3} ${y3} Z`
}

export default function SongCrafter({ onSendToChart, panelStyle, eyebrowStyle, selectStyle }) {
  const [keyName, setKeyName] = useState("C")
  const [genre, setGenre] = useState("Pop")
  // Deterministic on first render — picking randomly during render makes the
  // server and client markup disagree (React hydration error #418). The shuffle
  // happens in an async task after mount so it isn't a synchronous setState.
  const [tip, setTip] = useState(CRAFT_TIPS[0])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!cancelled) setTip(CRAFT_TIPS[Math.floor(Math.random() * CRAFT_TIPS.length)])
    })()
    return () => { cancelled = true }
  }, [])
  const [sections, setSections] = useState(() => [
    { id: uid(), kind: "Verse", slots: [] },
    { id: uid(), kind: "Chorus", slots: [] },
  ])
  const [activeId, setActiveId] = useState(null)
  const dragRef = useRef(null)

  const activeSection = sections.find(s => s.id === activeId) || sections[0]
  const activeSectionId = activeSection?.id

  const table = KEY_TABLE[keyName]

  // ── Mutations ──────────────────────────────────────────────────────────────
  function addChord(chord, sectionId = activeSectionId) {
    if (!sectionId) return
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, slots: [...s.slots, { ...chord, id: uid() }] } : s
    ))
  }

  function addMany(chords, sectionId = activeSectionId) {
    if (!sectionId) return
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, slots: [...s.slots, ...chords.map(c => ({ ...c, id: uid() }))] }
        : s
    ))
  }

  function removeSlot(sectionId, slotId) {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, slots: s.slots.filter(x => x.id !== slotId) } : s
    ))
  }

  function addSection(kind) {
    const s = { id: uid(), kind, slots: [] }
    setSections(prev => [...prev, s])
    setActiveId(s.id)
  }

  function removeSection(id) {
    setSections(prev => (prev.length > 1 ? prev.filter(s => s.id !== id) : prev))
  }

  function setSectionKind(id, kind) {
    setSections(prev => prev.map(s => (s.id === id ? { ...s, kind } : s)))
  }

  // Whole-song transposition. Degree-tagged chords are re-derived in the new key
  // (exact spelling); anything hand-added shifts by interval.
  function transposeTo(nextKey) {
    setSections(prev => prev.map(s => ({
      ...s,
      slots: s.slots.map(c => transposeChordToKey(c, keyName, nextKey)),
    })))
    setKeyName(nextKey)
  }

  // Reorder within a section (desktop drag)
  function onDropSlot(sectionId, targetIdx) {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    if (d.kind === "new") { addChord(d.chord, sectionId); return }
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId || d.sectionId !== sectionId) return s
      const slots = [...s.slots]
      const from = slots.findIndex(x => x.id === d.slotId)
      if (from === -1) return s
      const [moved] = slots.splice(from, 1)
      slots.splice(targetIdx > from ? targetIdx - 1 : targetIdx, 0, moved)
      return { ...s, slots }
    }))
  }

  const totalBars = sections.reduce((n, s) => n + s.slots.length, 0)

  // Hand the craft sheet to the DukeBox engine so it can be played and edited.
  function sendToChart() {
    const bars = []
    for (const s of sections) {
      for (const c of s.slots) {
        const bar = parseGigChord(c.symbol, s.kind)
        if (bar) bars.push(bar)
      }
    }
    if (!bars.length) return
    onSendToChart?.({ bars, keyRoot: splitChord(keyName).root, keyMode: "major", title: "Song Crafter" })
  }

  // ── Shared chip renderer: tap to add, drag on desktop ──────────────────────
  const chordChip = (chord, label, extraStyle = {}) => (
    <button
      key={label + chord.symbol}
      draggable
      onDragStart={() => { dragRef.current = { kind: "new", chord } }}
      onClick={() => addChord(chord)}
      title={`Add ${chord.symbol} to ${activeSection?.kind ?? "the sheet"}`}
      style={{
        padding: "7px 4px", borderRadius: "7px", cursor: "pointer",
        fontSize: "0.86rem", fontWeight: 700,
        background: "var(--db-card-bg)", border: "1px solid var(--db-card-border)",
        color: "var(--db-text)", ...extraStyle,
      }}
    >
      {chord.symbol}
    </button>
  )

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px", flexWrap: "wrap" }}>
        <div style={{ ...eyebrowStyle, marginBottom: 0 }}>SONG CRAFTER</div>
        <div style={{ fontSize: "0.78rem", opacity: 0.62 }}>
          Grab chords from the circle or the chart, arrange them into sections, transpose the lot
        </div>
        {/* Both controls live up here beside the chord sources: when you're
            tapping chords the sheet is scrolled off, so the target section has
            to be visible and changeable right where you're working. */}
        <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}>
          <span style={{ opacity: 0.7 }}>Adding to</span>
          <select
            value={activeSectionId ?? ""}
            onChange={(e) => setActiveId(e.target.value)}
            style={{ ...selectStyle, width: "auto", padding: "5px 8px", color: "var(--db-accent)", fontWeight: 700 }}
            title="Which section new chords land in"
          >
            {sections.map((s, i) => (
              <option key={s.id} value={s.id}>{i + 1}. {s.kind}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}>
          <span style={{ opacity: 0.7 }}>Key</span>
          <select
            value={keyName}
            onChange={(e) => transposeTo(e.target.value)}
            style={{ ...selectStyle, width: "auto", padding: "5px 8px" }}
            title="Changing the key transposes everything already on the sheet"
          >
            {KEY_NAMES.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginTop: "12px" }}>
        {/* ── Circle of fifths ── */}
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "var(--db-accent)", marginBottom: "6px" }}>
            CIRCLE OF FIFTHS
          </div>
          <div style={{ fontSize: "0.74rem", opacity: 0.62, marginBottom: "6px" }}>
            Outer ring sets the key · tap any wedge to add that chord
          </div>
          <svg viewBox="0 0 300 300" style={{ width: "100%", maxWidth: "340px", display: "block" }} role="img" aria-label="Circle of fifths">
            {CIRCLE_ORDER.map((k, i) => {
              const isKey = k === keyName
              const relMinor = RELATIVE_MINOR[k]
              const [lx, ly] = pol((R_OUT + R_MID) / 2, i * SWEEP)
              const [mx, my] = pol((R_MID + R_IN) / 2, i * SWEEP)
              return (
                <g key={k}>
                  {/* major ring */}
                  <path
                    d={wedge(R_OUT, R_MID, i)}
                    fill={isKey ? "var(--db-accent)" : "var(--db-card-bg)"}
                    stroke="var(--db-panel-border)"
                    strokeWidth="1"
                    style={{ cursor: "pointer" }}
                    onClick={() => transposeTo(k)}
                  >
                    <title>{`${k} major — set as key`}</title>
                  </path>
                  <text x={lx} y={ly + 5} textAnchor="middle" fontSize="15" fontWeight="700"
                    fill={isKey ? "var(--db-bg)" : "var(--db-text)"} style={{ pointerEvents: "none" }}>
                    {k}
                  </text>

                  {/* relative minor ring */}
                  <path
                    d={wedge(R_MID, R_IN, i)}
                    fill="var(--db-panel-bg)"
                    stroke="var(--db-panel-border)"
                    strokeWidth="1"
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      const { root, suffix } = splitChord(relMinor)
                      addChord({ root, suffix, symbol: relMinor, degree: k === keyName ? "vi" : null })
                    }}
                  >
                    <title>{`${relMinor} — add to sheet`}</title>
                  </path>
                  <text x={mx} y={my + 4} textAnchor="middle" fontSize="11"
                    fill="var(--db-muted)" style={{ pointerEvents: "none" }}>
                    {relMinor}
                  </text>
                </g>
              )
            })}
            <circle cx={CX} cy={CY} r={R_IN} fill="var(--db-panel-bg)" stroke="var(--db-panel-border)" />
            <text x={CX} y={CY - 4} textAnchor="middle" fontSize="13" fill="var(--db-muted)">key of</text>
            <text x={CX} y={CY + 18} textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--db-accent)">{keyName}</text>
          </svg>

          {/* Diatonic chords for the selected key */}
          <div style={{ marginTop: "10px" }}>
            <div style={{ fontSize: "0.72rem", opacity: 0.62, marginBottom: "5px" }}>
              Chords in {keyName} — tap to add
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
              {DEGREE_LABELS.map((d, i) => (
                <div key={d} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "0.62rem", opacity: 0.55, marginBottom: "2px" }}>{d}</div>
                  {chordChip(
                    { ...splitChord(table.chords[i]), symbol: table.chords[i], degree: d },
                    `dia${i}`,
                    { width: "100%", borderColor: "var(--db-accent)" }
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Progressions ── */}
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "var(--db-accent)", marginBottom: "6px" }}>
            COMMON PROGRESSIONS
          </div>
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            style={{ ...selectStyle, padding: "6px 9px", marginBottom: "8px" }}
            aria-label="Progression genre"
          >
            {PROGRESSION_GENRES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          <div style={{ display: "grid", gap: "7px", maxHeight: "420px", overflowY: "auto" }}>
            {PROGRESSIONS[genre].map(p => {
              const chords = p.degrees.map(d => ({ ...resolveDegree(d, keyName), degree: d }))
              return (
                <div key={p.name} style={{
                  border: "1px solid var(--db-card-border)", borderRadius: "9px",
                  padding: "9px 11px", background: "var(--db-card-bg)",
                }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.86rem" }}>{p.name}</span>
                    <button
                      onClick={() => addMany(chords)}
                      style={{
                        marginLeft: "auto", padding: "3px 10px", borderRadius: "20px",
                        fontSize: "0.72rem", cursor: "pointer", fontWeight: 700,
                        border: "1px solid var(--db-accent)",
                        background: "color-mix(in srgb, var(--db-accent) 15%, var(--db-bg))",
                        color: "var(--db-accent)",
                      }}
                      title={`Add all ${chords.length} chords to ${activeSection?.kind ?? "the sheet"}`}
                    >
                      + Add all
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", margin: "7px 0 5px" }}>
                    {chords.map((c, i) => chordChip(c, `p${p.name}${i}`, { padding: "5px 9px", fontSize: "0.8rem" }))}
                  </div>
                  <div style={{ fontSize: "0.74rem", opacity: 0.65, lineHeight: 1.45 }}>{p.note}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── All keys chart ──────────────────────────────────────────────── */}
      <div style={{ marginTop: "20px" }} className="db-chartcard">
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "7px" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "var(--db-accent)" }}>
            CHORDS IN ALL MAJOR KEYS
          </div>
          <div style={{ fontSize: "0.74rem", opacity: 0.62 }}>
            Tap a chord to add it · tap a key to switch key
          </div>
          <button
            onClick={() => {
              document.body.classList.add("db-printing-chart")
              const after = () => {
                document.body.classList.remove("db-printing-chart")
                window.removeEventListener("afterprint", after)
              }
              window.addEventListener("afterprint", after)
              window.print()
            }}
            className="db-noprint"
            style={{
              marginLeft: "auto", padding: "4px 11px", borderRadius: "8px", cursor: "pointer",
              fontSize: "0.78rem", border: "1px solid var(--db-panel-border)",
              background: "var(--db-panel-bg)", color: "var(--db-text)",
            }}
            title="Print just this chart — makes a clean reference sheet"
          >🖨 Print chart</button>
        </div>

        <div style={{
          overflowX: "auto", background: "var(--surface)", borderRadius: "10px",
          padding: "12px", border: "1px solid var(--db-panel-border)",
        }}>
          <h3 style={{
            margin: "2px 0 10px", textAlign: "center", color: "var(--text)",
            fontSize: "1.15rem", fontWeight: 800, letterSpacing: "0.01em",
          }}>Chords In All Major Keys</h3>

          <table style={{
            borderCollapse: "collapse", width: "100%", minWidth: "560px",
            fontFamily: "Georgia, 'Times New Roman', serif",
          }}>
            <thead>
              <tr>
                <th style={{ ...CHART_CELL, background: "var(--surface)", color: "var(--text)", fontSize: "0.72rem", lineHeight: 1.15, width: "68px" }}>
                  Major<br />Keys
                </th>
                {DEGREE_LABELS.map((d, i) => (
                  <th key={d} style={{
                    ...CHART_CELL, background: "var(--accent)", color: "var(--accent-ink)",
                    fontSize: "1.05rem", fontWeight: 700,
                  }}
                    title={PRIMARY_DEGREES.has(i) ? `${d} — primary (major) triad` : `${d}`}
                  >{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {KEY_NAMES.map(k => {
                const isKey = k === keyName
                return (
                  <tr key={k}>
                    <th scope="row" style={{ ...CHART_CELL, padding: 0 }}>
                      <button
                        onClick={() => transposeTo(k)}
                        style={{
                          width: "100%", height: "100%", padding: "9px 4px", cursor: "pointer",
                          border: "none", fontWeight: 800, fontSize: "1.02rem",
                          fontFamily: "inherit",
                          background: isKey ? "var(--hot)" : "var(--target)",
                          color: "var(--accent-ink)",
                          outline: isKey ? "3px solid var(--accent)" : "none",
                          outlineOffset: "-3px",
                        }}
                        title={`Switch to ${k} — transposes the sheet`}
                      >{prettyKey(k)}</button>
                    </th>
                    {KEY_TABLE[k].chords.map((sym, i) => (
                      <td key={i} style={{ ...CHART_CELL, padding: 0 }}>
                        <button
                          draggable
                          onDragStart={() => { dragRef.current = { kind: "new", chord: { ...splitChord(sym), symbol: sym, degree: isKey ? DEGREE_LABELS[i] : null } } }}
                          onClick={() => addChord({ ...splitChord(sym), symbol: sym, degree: isKey ? DEGREE_LABELS[i] : null })}
                          title={`Add ${sym} to ${activeSection?.kind ?? "the sheet"}`}
                          style={{
                            width: "100%", height: "100%", padding: "9px 3px", cursor: "pointer",
                            border: "none", fontFamily: "inherit",
                            fontWeight: 700, fontSize: "1rem", color: "var(--text)",
                            background: isKey
                              ? "var(--sel)"
                              : PRIMARY_DEGREES.has(i) ? "var(--loop)" : "var(--surface)",
                          }}
                        >{prettyChord(sym)}</button>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>

          <p style={{ margin: "10px 2px 2px", textAlign: "center", color: "var(--muted)", fontSize: "0.72rem", lineHeight: 1.5 }}>
            All the common triads belonging to each key. Roman numerals give each chord&apos;s position in the scale;
            the blue columns are the primary triads (I, IV, V).
          </p>
        </div>
      </div>

      {/* ── The craft sheet ── */}
      <div style={{ marginTop: "20px", paddingTop: "14px", borderTop: "1px solid var(--db-panel-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "var(--db-accent)" }}>
            SONG SHEET
          </div>
          <span style={{ fontSize: "0.74rem", opacity: 0.62 }}>
            {totalBars} bar{totalBars === 1 ? "" : "s"} in {keyName}
            {activeSection ? ` · adding to ${activeSection.kind}` : ""}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <select
              onChange={(e) => { if (e.target.value) { addSection(e.target.value); e.target.value = "" } }}
              value=""
              style={{ ...selectStyle, width: "auto", padding: "5px 8px", fontSize: "0.8rem" }}
              aria-label="Add a section"
            >
              <option value="">+ Add section…</option>
              {SECTION_KINDS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={sendToChart}
              disabled={!totalBars}
              style={{
                padding: "6px 13px", borderRadius: "8px", cursor: totalBars ? "pointer" : "default",
                fontWeight: 700, fontSize: "0.82rem",
                border: "1px solid var(--db-c-green)",
                background: "color-mix(in srgb, var(--db-c-green) 15%, var(--db-bg))",
                color: "var(--db-c-green)", opacity: totalBars ? 1 : 0.45,
              }}
              title="Load this song into the DukeBox chart so you can hear it"
            >
              ♪ Hear it in DukeBox
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: "10px" }}>
          {sections.map(sec => {
            const isActive = sec.id === activeSectionId
            return (
              <div
                key={sec.id}
                onClick={() => setActiveId(sec.id)}
                style={{
                  border: `1px solid ${isActive ? "var(--db-accent)" : "var(--db-card-border)"}`,
                  background: isActive ? "color-mix(in srgb, var(--db-accent) 6%, var(--db-card-bg))" : "var(--db-card-bg)",
                  borderRadius: "10px", padding: "10px 12px", cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "6px" }}>
                  <select
                    value={sec.kind}
                    onChange={(e) => setSectionKind(sec.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ ...selectStyle, width: "auto", padding: "3px 7px", fontSize: "0.8rem", fontWeight: 700, color: "var(--db-accent)" }}
                  >
                    {SECTION_KINDS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span style={{ fontSize: "0.72rem", opacity: 0.6 }}>{sec.slots.length} bars</span>
                  {isActive && <span style={{ fontSize: "0.68rem", color: "var(--db-accent)", fontWeight: 700 }}>← adding here</span>}
                  {sections.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSection(sec.id) }}
                      aria-label={`Remove ${sec.kind} section`}
                      style={{
                        marginLeft: "auto", background: "none", border: "none",
                        color: "var(--db-c-salmon)", cursor: "pointer", fontSize: "0.95rem",
                      }}
                    >×</button>
                  )}
                </div>

                <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", alignItems: "center", minHeight: "40px" }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDropSlot(sec.id, sec.slots.length)}
                >
                  {sec.slots.map((c, i) => (
                    <button
                      key={c.id}
                      draggable
                      onDragStart={() => { dragRef.current = { kind: "move", sectionId: sec.id, slotId: c.id } }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.stopPropagation(); onDropSlot(sec.id, i) }}
                      onClick={(e) => { e.stopPropagation(); removeSlot(sec.id, c.id) }}
                      title={`${c.symbol}${c.degree ? ` (${c.degree})` : ""} — click to remove`}
                      style={{
                        padding: "8px 12px", borderRadius: "8px", cursor: "pointer",
                        fontWeight: 700, fontSize: "0.95rem",
                        background: "var(--db-panel-bg)",
                        border: "1px solid var(--db-panel-border)",
                        color: "var(--db-text)",
                      }}
                    >
                      {c.symbol}
                      {c.degree && <span style={{ fontSize: "0.62rem", opacity: 0.55, marginLeft: "5px" }}>{c.degree}</span>}
                    </button>
                  ))}
                  {!sec.slots.length && (
                    <span style={{ fontSize: "0.78rem", opacity: 0.5 }}>
                      Tap chords above to build this section
                    </span>
                  )}
                </div>

                <div style={{ fontSize: "0.74rem", opacity: 0.66, marginTop: "7px", lineHeight: 1.45 }}>
                  {SECTION_GUIDE[sec.kind]}
                </div>
              </div>
            )
          })}
        </div>

        {/* Craft tip */}
        <div style={{
          marginTop: "12px", padding: "10px 13px", borderRadius: "10px",
          border: "1px dashed var(--db-accent)",
          background: "color-mix(in srgb, var(--db-accent) 5%, transparent)",
          display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
        }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", color: "var(--db-accent)" }}>✎ CRAFT</span>
          <span style={{ fontSize: "0.88rem", flex: 1, minWidth: "220px" }}>{tip}</span>
          <button
            onClick={() => setTip(CRAFT_TIPS[Math.floor(Math.random() * CRAFT_TIPS.length)])}
            style={{
              padding: "4px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "0.78rem",
              border: "1px solid var(--db-accent)", background: "transparent", color: "var(--db-text)",
            }}
          >Another</button>
        </div>
      </div>
    </div>
  )
}
