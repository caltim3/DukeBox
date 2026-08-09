"use client"

// Rhythm Shed — bebop rhythm generator, integrated into BeatForge. Ported from
// the standalone beboprhythmshed.html: the weighted cell generator, the
// hand-rolled SVG manuscript renderer, and the 30-pattern rhythm library are
// all preserved verbatim. What changed in the port:
//   · Playback runs on the shared BeatForge engine (lib/music/metronome.js)
//     instead of a private WebAudio scheduler — one Start drives the click
//     cells AND the rhythm, and the phrase is tapped on the drum kit's SNARE
//     (or the original pluck tone, still available via the voice picker).
//   · The original Off / 1-2-3-4 / 2-&-4 metronome setting became one-tap
//     presets that program the BeatForge accent-cell grid (onMetPreset).
//   · Count-in = one bar of the click cells alone before the phrase enters
//     (the engine's loop skips it after the first pass).
// The parent owns Start/Stop; this component reports its phrase through
// apiRef (getRhythm / clearHighlights) and asks for play/stop/restart.

import { useEffect, useRef, useState } from "react"

/* ================= progressions (labels only, like the original) ============ */
const PROGS = {
  none:     null,
  "251":    { name: "ii V I in C",      bars: ["Dm7", "G7", "Cmaj7", "Cmaj7"] },
  blues:    { name: "F blues",          bars: ["F7", "Bb7", "F7", "Cm7 F7", "Bb7", "Bdim7", "F7", "Am7b5 D7", "Gm7", "C7", "F7 D7", "Gm7 C7"] },
  rc:       { name: "Rhythm changes A", bars: ["Bb6 G7", "Cm7 F7", "Bb6 G7", "Cm7 F7", "Fm7 Bb7", "Eb6 Ab7", "Dm7 G7", "Cm7 F7"] },
  minor251: { name: "Minor ii V i",     bars: ["Dm7b5", "G7alt", "Cm6", "Cm6"] },
}

/* ================= rhythm generation =================
   event: { d: duration in beats, rest: bool, trip: bool, tg: tripletGroupId } */
let tgSeq = 0

function pickWeighted(items) {
  let tot = 0
  for (const it of items) tot += it.w
  let r = Math.random() * tot
  for (const it of items) { r -= it.w; if (r <= 0) return it }
  return items[items.length - 1]
}

function clone(ev) {
  const tg = ++tgSeq
  return ev.map((e) => {
    const n = { d: e.d, rest: !!e.rest, trip: !!e.trip }
    if (n.trip) n.tg = tg
    return n
  })
}

function oneBeatCell({ density: d, rests, trips }) {
  const cells = []
  cells.push({ w: 16 + 30 * d, ev: [{ d: 0.5 }, { d: 0.5 }] })              // two 8ths
  cells.push({ w: 13, ev: [{ d: 1 }] })                                     // quarter
  if (rests) {
    cells.push({ w: 13, ev: [{ d: 0.5, rest: true }, { d: 0.5 }] })         // offbeat 8th
    cells.push({ w: 7,  ev: [{ d: 0.5 }, { d: 0.5, rest: true }] })         // 8th then breath
    cells.push({ w: 3 + 9 * (1 - d), ev: [{ d: 1, rest: true }] })          // full beat rest
  }
  if (trips) {
    const tw = 5 + 11 * d
    cells.push({ w: tw, ev: [{ d: 1 / 3, trip: 1 }, { d: 1 / 3, trip: 1 }, { d: 1 / 3, trip: 1 }] })
    if (rests) {
      cells.push({ w: tw * 0.4,  ev: [{ d: 1 / 3, trip: 1 }, { d: 1 / 3, trip: 1, rest: true }, { d: 1 / 3, trip: 1 }] })
      cells.push({ w: tw * 0.35, ev: [{ d: 1 / 3, trip: 1, rest: true }, { d: 1 / 3, trip: 1 }, { d: 1 / 3, trip: 1 }] })
    }
  }
  return clone(pickWeighted(cells).ev)
}

function twoBeatCell({ rests }) {
  const cells = [
    { w: 10, ev: [{ d: 0.5 }, { d: 1 }, { d: 0.5 }] },   // 8 q 8 (charleston push)
    { w: 8,  ev: [{ d: 1.5 }, { d: 0.5 }] },             // q. 8
    { w: 7,  ev: [{ d: 0.5 }, { d: 1.5 }] },             // 8 q.
  ]
  if (rests) {
    cells.push({ w: 7, ev: [{ d: 0.5, rest: true }, { d: 1 }, { d: 0.5 }] })
    cells.push({ w: 4, ev: [{ d: 0.5 }, { d: 1 }, { d: 0.5, rest: true }] })
  }
  return clone(pickWeighted(cells).ev)
}

function genMeasure(opts) {
  const out = []
  let pos = 0
  while (pos < 4 - 1e-6) {
    let cell
    if (opts.sync && pos <= 2 && Number.isInteger(pos) && Math.random() < 0.32) {
      cell = twoBeatCell(opts)
    } else {
      cell = oneBeatCell(opts)
    }
    out.push(...cell)
    pos += cell.reduce((a, e) => a + e.d, 0)
  }
  // never end on a bar with no notes at all: retry once
  if (out.every((e) => e.rest)) return genMeasure(opts)
  return out
}

/* ================= notation rendering (hand rolled SVG) ================= */
const NS = "http://www.w3.org/2000/svg"
const GEO = { W: 320, H: 118, padL: 26, padR: 12, lineY: 76, stemH: 32, beamTh: 4.5 }

function el(name, attrs, parent) {
  const n = document.createElementNS(NS, name)
  for (const k in attrs) n.setAttribute(k, attrs[k])
  if (parent) parent.appendChild(n)
  return n
}

function notehead(g, x, y) {
  const e = el("ellipse", { cx: x, cy: y, rx: 5.4, ry: 4.1, class: "rs-ink" }, g)
  e.setAttribute("transform", `rotate(-18 ${x} ${y})`)
  return e
}
function stem(g, x, y, topY) {
  el("rect", { x: x + 3.9, y: topY, width: 1.7, height: y - topY - 1, class: "rs-ink" }, g)
}
function flag(g, x, topY) {
  const sx = x + 5.6
  el("path", { d: `M ${sx} ${topY} C ${sx + 7} ${topY + 5}, ${sx + 8} ${topY + 10}, ${sx + 3.5} ${topY + 17}
                 C ${sx + 7} ${topY + 10}, ${sx + 5} ${topY + 6}, ${sx} ${topY + 3} Z`, class: "rs-ink" }, g)
}
function dot(g, x, y) { el("circle", { cx: x + 9.5, cy: y - 3, r: 1.9, class: "rs-ink" }, g) }

function quarterRest(g, x, y) {
  const p = `M ${x - 2} ${y - 16} L ${x + 4.5} ${y - 8.5} C ${x + 1} ${y - 6}, ${x + 1} ${y - 4}, ${x + 4} ${y - 0.5}
             C ${x - 1.5} ${y - 1.5}, ${x - 3} ${y + 1.5}, ${x + 0.5} ${y + 6.5}
             C ${x - 5} ${y + 3}, ${x - 5.5} ${y - 1.5}, ${x - 1} ${y - 3.5} L ${x - 6} ${y - 10} Z`
  el("path", { d: p, class: "rs-ink" }, g)
}
function eighthRest(g, x, y) {
  el("circle", { cx: x - 2.2, cy: y - 7.5, r: 2.6, class: "rs-ink" }, g)
  el("path", { d: `M ${x - 1.5} ${y - 5.6} C ${x + 1} ${y - 4.5}, ${x + 3} ${y - 5}, ${x + 4.2} ${y - 7.5}
                 L ${x - 0.5} ${y + 7} L ${x - 2.2} ${y + 7} L ${x + 2.4} ${y - 6.4} Z`, class: "rs-ink" }, g)
}

function renderMeasure(container, events, idp, chordText, compact) {
  const { W, H, padL, padR, lineY, stemH, beamTh } = GEO
  const beatW = (W - padL - padR) / 4
  const div = document.createElement("div")
  div.className = "rs-measure"
  div.dataset.m = idp
  const vb = compact ? `0 22 ${W} 74` : `0 0 ${W} ${H}`
  const svg = el("svg", { viewBox: vb, preserveAspectRatio: "xMidYMid meet" })
  div.appendChild(svg)
  container.appendChild(div)

  // rhythm line + barlines
  el("line", { x1: 6, y1: lineY, x2: W - 4, y2: lineY, class: "rs-ink-s", "stroke-width": 1.2 }, svg)
  el("line", { x1: 8, y1: lineY - 16, x2: 8, y2: lineY + 16, class: "rs-ink-s", "stroke-width": 1.4 }, svg)
  el("line", { x1: W - 6, y1: lineY - 16, x2: W - 6, y2: lineY + 16, class: "rs-ink-s", "stroke-width": 1.4 }, svg)

  if (chordText) el("text", { x: padL - 6, y: 24, class: "rs-chordlbl" }, svg).textContent = chordText

  // beat markers
  if (!compact) for (let b = 0; b < 4; b++) {
    const bx = padL + b * beatW
    el("text", { x: bx - 2, y: H - 4, class: "rs-beatnum" }, svg).textContent = (b + 1)
    el("circle", { cx: bx + 3, cy: H - 18, r: 3.2, class: "rs-beatdot", id: `rs-bd-${idp}-${b}` }, svg)
  }

  // compute positions
  let pos = 0
  const items = events.map((e, i) => {
    const it = { ...e, i, pos, x: padL + pos * beatW }
    pos += e.d
    return it
  })

  const topY = lineY - stemH

  // --- beam groups: straight 8th runs (not crossing mid-bar), triplet groups ---
  const beamed = new Set()
  const beams = []
  let run = []
  const flushRun = () => { if (run.length >= 2) beams.push(run.slice()); run = [] }
  for (const it of items) {
    const straight8 = Math.abs(it.d - 0.5) < 1e-6 && !it.trip && !it.rest
    if (straight8) {
      if (run.length) {
        const prev = run[run.length - 1]
        const contiguous = Math.abs(prev.pos + prev.d - it.pos) < 1e-6
        const sameHalf = (prev.pos < 2) === (it.pos < 2)
        if (!contiguous || !sameHalf || run.length >= 4) flushRun()
      }
      run.push(it)
    } else flushRun()
  }
  flushRun()
  // triplets: group by tg, beam adjacent non-rest members
  const tgs = {}
  for (const it of items) if (it.trip) { (tgs[it.tg] = tgs[it.tg] || []).push(it) }
  for (const tg in tgs) {
    const grp = tgs[tg]
    let r = []
    for (const it of grp) {
      if (!it.rest) r.push(it)
      else { if (r.length >= 2) beams.push(r.slice()); r = [] }
    }
    if (r.length >= 2) beams.push(r)
    // triplet bracket + 3
    const x1 = grp[0].x - 6, x2 = grp[grp.length - 1].x + 10, mid = (x1 + x2) / 2
    const by = topY - 10
    el("path", { d: `M ${x1} ${by + 5} L ${x1} ${by} L ${mid - 6} ${by} M ${mid + 6} ${by} L ${x2} ${by} L ${x2} ${by + 5}`,
                 class: "rs-ink-s", fill: "none", "stroke-width": 1.1 }, svg)
    el("text", { x: mid - 3.5, y: by + 4, class: "rs-tripnum" }, svg).textContent = "3"
  }
  for (const b of beams) for (const it of b) beamed.add(it.i)

  // --- draw events ---
  for (const it of items) {
    const g = el("g", { class: "rs-note", id: `rs-ev-${idp}-${it.i}` }, svg)
    if (it.rest) {
      if (it.d >= 0.99) quarterRest(g, it.x, lineY - 2)
      else eighthRest(g, it.x, lineY - 2)
      continue
    }
    notehead(g, it.x, lineY)
    const isBeamed = beamed.has(it.i)
    stem(g, it.x, lineY, topY)
    if (!isBeamed && (Math.abs(it.d - 0.5) < 1e-6 || it.trip)) flag(g, it.x, topY)
    if (Math.abs(it.d - 1.5) < 1e-6) dot(g, it.x, lineY)
  }
  // --- draw beams ---
  for (const b of beams) {
    const x1 = b[0].x + 3.9, x2 = b[b.length - 1].x + 5.6
    el("rect", { x: x1, y: topY, width: x2 - x1, height: beamTh, class: "rs-ink" }, svg)
  }

  return items
}

/* ================= rhythm library ================= */
const N8 = { d: 0.5 }, Q = { d: 1 }, DQ = { d: 1.5 }, R8 = { d: 0.5, rest: 1 }, RQ = { d: 1, rest: 1 },
      T = { d: 1 / 3, trip: 1 }, TR = { d: 1 / 3, trip: 1, rest: 1 }
const T3 = [T, T, T]

const LIB = [
  /* ---- I. The rules ---- */
  { s: "A", n: "Quarter pulse",          cells: [[Q], [Q], [Q], [Q]] },
  { s: "A", n: "Quarters into 8ths",     cells: [[Q], [Q], [N8, N8], [N8, N8]] },
  { s: "A", n: "8ths into quarters",     cells: [[N8, N8], [N8, N8], [Q], [Q]] },
  { s: "A", n: "Straight 8ths",          cells: [[N8, N8], [N8, N8], [N8, N8], [N8, N8]] },
  { s: "A", n: "Quarter, 8ths trade",    cells: [[Q], [N8, N8], [Q], [N8, N8]] },
  { s: "A", n: "8ths, quarter trade",    cells: [[N8, N8], [Q], [N8, N8], [Q]] },
  { s: "A", n: "Triplet pulse",          cells: [T3, T3, T3, T3] },
  { s: "A", n: "Quarters into triplets", cells: [[Q], [Q], T3, T3] },
  { s: "A", n: "Triplets trade 8ths",    cells: [T3, [N8, N8], T3, [N8, N8]] },
  { s: "A", n: "8ths into triplets",     cells: [[N8, N8], [N8, N8], T3, T3] },
  /* ---- II. Mix it ---- */
  { s: "B", n: "Drop beat 1",            cells: [[RQ], [Q], [Q], [Q]] },
  { s: "B", n: "The ands",               cells: [[R8, N8], [R8, N8], [R8, N8], [R8, N8]] },
  { s: "B", n: "Answer on the and",      cells: [[Q], [R8, N8], [Q], [R8, N8]] },
  { s: "B", n: "Charleston, twice",      cells: [[N8, Q, N8], [N8, Q, N8]] },
  { s: "B", n: "Dotted push",            cells: [[DQ, N8], [DQ, N8]] },
  { s: "B", n: "Anticipation chain",     cells: [[N8, DQ], [N8, DQ]] },
  { s: "B", n: "Rest into pushed quarter", cells: [[R8, Q, N8], [N8, N8], [Q]] },
  { s: "B", n: "Breathe on 2",           cells: [[N8, N8], [RQ], [N8, N8], [Q]] },
  { s: "B", n: "Triplet gaps",           cells: [[T, TR, T], [T, TR, T], [N8, N8], [Q]] },
  { s: "B", n: "Late charleston",        cells: [[Q], [RQ], [N8, Q, N8]] },
  /* ---- III. Pure bebop ---- */
  { s: "C", n: "Off the and of 1",       cells: [[R8, N8], [N8, N8], [N8, N8], [N8, N8]] },
  { s: "C", n: "Run with triplet turn",  cells: [[N8, N8], [N8, N8], T3, [N8, N8]] },
  { s: "C", n: "Triplet kick into run",  cells: [T3, [N8, N8], [N8, N8], [Q]] },
  { s: "C", n: "Land early",             cells: [[N8, N8], [N8, N8], [N8, Q, N8]] },
  { s: "C", n: "Parker hiccup",          cells: [[R8, N8], [N8, Q, N8], [Q]] },
  { s: "C", n: "Push, then turn",        cells: [[DQ, N8], [N8, N8], T3] },
  { s: "C", n: "Kicked triplet",         cells: [[TR, T, T], [N8, N8], [N8, N8], [Q]] },
  { s: "C", n: "Broken run",             cells: [[N8, N8], [N8, R8], [R8, N8], [N8, N8]] },
  { s: "C", n: "Charleston into triplet", cells: [[N8, Q, N8], T3, [N8, N8]] },
  { s: "C", n: "Run out the door",       cells: [[N8, N8], [N8, N8], [N8, Q, R8]] },
]

const LIB_SECTIONS = [
  { s: "A", rn: "I.",   title: "The rules",  desc: "The raw subdivisions. Own each of these cold, at every tempo, before mixing." },
  { s: "B", rn: "II.",  title: "Mix it",     desc: "The same rules with air and displacement. Rests are notes. Feel where beat 1 went." },
  { s: "C", rn: "III.", title: "Pure bebop", desc: "Phrase shapes straight out of the language: offbeat entries, triplet turns, anticipated landings. Sing them before you play them." },
]

/* ================= component ================= */
const SHED_CSS = `
  .rs-sheet{background:#f3ecdc;border-radius:10px;padding:16px 12px 10px;
    box-shadow:0 6px 20px rgba(0,0,0,.25), inset 0 0 60px rgba(120,95,40,.07);
    background-image:repeating-linear-gradient(0deg,transparent 0 30px,rgba(140,120,80,.05) 30px 31px)}
  .rs-sheet-top{display:flex;justify-content:space-between;align-items:baseline;padding:0 6px 8px;color:#6d6350}
  .rs-sheet-top .rs-t{font-family:Palatino,Georgia,serif;font-size:14px;font-weight:700;letter-spacing:.05em;color:#3c342a}
  .rs-sheet-top .rs-swingtag{font-size:12px;font-style:italic}
  .rs-measures{display:flex;flex-wrap:wrap;gap:2px 0}
  .rs-measure{position:relative;flex:1 1 220px;min-width:220px;border-radius:6px;transition:background .12s}
  .rs-measure.live{background:rgba(200,150,60,.16)}
  .rs-measure svg{display:block;width:100%;height:auto}
  .rs-ink{fill:#1b1712}
  .rs-ink-s{stroke:#1b1712}
  .rs-chordlbl{font-family:Palatino,Georgia,serif;font-weight:700;font-size:19px;fill:#3c342a}
  .rs-tripnum{font-family:Georgia,serif;font-style:italic;font-weight:700;font-size:13px;fill:#3c342a}
  .rs-beatnum{font-family:Georgia,serif;font-size:11px;fill:#a09272}
  .rs-beatdot{fill:#cfc2a3}
  .rs-beatdot.on{fill:#b8542b}
  .rs-note path,.rs-note ellipse,.rs-note rect,.rs-note circle{transition:fill .05s}
  .rs-note.active .rs-ink{fill:#b8542b}
  .rs-note.active .rs-ink-s{stroke:#b8542b}
  .rs-libgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
  .rs-libcard{background:#f3ecdc;border-radius:8px;padding:6px 6px 4px;cursor:pointer;
    border:2px solid transparent;box-shadow:0 3px 10px rgba(0,0,0,.22);transition:transform .1s,border-color .1s}
  .rs-libcard:hover{transform:translateY(-2px)}
  .rs-libcard:active{transform:translateY(0)}
  .rs-libcard.loaded{border-color:var(--db-c-amber)}
  .rs-libcard .rs-measure{min-width:0;flex:none}
  .rs-libcard .rs-cap{display:flex;gap:8px;align-items:baseline;padding:2px 8px 3px;color:#3c342a;font-size:13px;font-weight:600}
  .rs-libcard .rs-cap .rs-num{font-family:Georgia,serif;font-style:italic;color:#a08040;font-size:12px}
  @media (max-width:560px){ .rs-measure{min-width:100%} }
`

function swungPos(pos, trip, swing) {
  if (!swing || trip) return pos
  const frac = pos - Math.floor(pos)
  if (Math.abs(frac - 0.5) < 1e-6) return Math.floor(pos) + 2 / 3
  return pos
}

const segBtn = (on) => ({
  padding: "4px 10px", borderRadius: "var(--db-r-sm)", fontSize: "var(--db-fs-sm)", cursor: "pointer",
  border: on ? "1px solid var(--db-c-amber)" : "1px solid var(--db-panel-border)",
  background: on ? "color-mix(in srgb, var(--db-c-amber) 18%, var(--db-bg))" : "var(--db-panel-bg)",
  color: on ? "var(--db-c-amber)" : "var(--db-text)",
  fontWeight: on ? 700 : 400,
})

export default function RhythmShed({
  apiRef,
  playing,
  onPlay,
  onStop,
  onRestart,
  onMetPreset,
  inlineLabelStyle,
  selectStyle,
}) {
  const [enabled, setEnabled] = useState(true)
  const [measures, setMeasures] = useState(4)
  const [density, setDensity] = useState(62)
  const [trips, setTrips] = useState(true)
  const [rests, setRests] = useState(true)
  const [sync, setSync] = useState(true)
  const [swing, setSwing] = useState(true)
  const [countIn, setCountIn] = useState(true)
  const [loop, setLoop] = useState(true)
  const [voice, setVoice] = useState("snare")
  const [chords, setChords] = useState("251")
  const [rhythm, setRhythm] = useState([])
  const [loadedName, setLoadedName] = useState(null)
  const [loadedNum, setLoadedNum] = useState(null)

  const sheetRef = useRef(null)
  const libRefs = useRef({})
  const layoutRef = useRef([])
  const pendingPlayRef = useRef(false)

  // Live copies so getRhythm (called by the parent at Start) always reads
  // current values without re-registering the api object.
  const live = useRef({})
  live.current = { enabled, swing, countIn, loop, voice, measures, playing }

  function generate(opts = {}) {
    const cfg = { density: density / 100, trips, rests, sync, measures, ...opts }
    const next = []
    for (let m = 0; m < cfg.measures; m++) next.push(genMeasure(cfg))
    setLoadedName(null)
    setLoadedNum(null)
    setRhythm(next)
  }

  function regen(opts = {}) {
    if (live.current.playing) onStop?.()
    generate(opts)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { generate() }, [])

  // Render the manuscript whenever the phrase or chord labels change
  useEffect(() => {
    const cont = sheetRef.current
    if (!cont) return
    cont.innerHTML = ""
    layoutRef.current = []
    const prog = PROGS[chords]
    for (let m = 0; m < rhythm.length; m++) {
      const chord = prog ? prog.bars[m % prog.bars.length] : null
      layoutRef.current.push(renderMeasure(cont, rhythm[m], m, chord))
    }
    if (pendingPlayRef.current) {
      pendingPlayRef.current = false
      onPlay?.()
    }
  }, [rhythm, chords]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build the library once (clear first — StrictMode runs effects twice in dev)
  useEffect(() => {
    Object.values(libRefs.current).forEach((grid) => { if (grid) grid.innerHTML = "" })
    LIB.forEach((p, k) => {
      const grid = libRefs.current[p.s]
      if (!grid) return
      const card = document.createElement("div")
      card.className = "rs-libcard"
      card.dataset.num = k + 1
      const flat = p.cells.flatMap((c) => clone(c))
      renderMeasure(card, flat, "L" + k, null, true)
      const cap = document.createElement("div")
      cap.className = "rs-cap"
      cap.innerHTML = `<span class="rs-num">${k + 1}</span><span>${p.n}</span>`
      card.appendChild(cap)
      card.addEventListener("click", () => loadPattern(p, k + 1))
      grid.appendChild(card)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Loaded-card outline follows state
  useEffect(() => {
    document.querySelectorAll(".rs-libcard.loaded").forEach((x) => x.classList.remove("loaded"))
    if (loadedNum != null) {
      const card = document.querySelector(`.rs-libcard[data-num="${loadedNum}"]`)
      if (card) card.classList.add("loaded")
    }
  }, [loadedNum])

  function loadPattern(p, num) {
    if (live.current.playing) onStop?.()
    const next = []
    for (let m = 0; m < live.current.measures; m++) {
      const meas = []
      for (const c of p.cells) meas.push(...clone(c))
      next.push(meas)
    }
    setLoadedName(`#${num} ${p.n}`)
    setLoadedNum(num)
    pendingPlayRef.current = true   // autoplay once the sheet re-renders
    setRhythm(next)
  }

  function clearHighlights() {
    document.querySelectorAll(".rs-note.active").forEach((n) => n.classList.remove("active"))
    document.querySelectorAll(".rs-beatdot.on").forEach((d) => d.classList.remove("on"))
    document.querySelectorAll(".rs-measure.live").forEach((d) => d.classList.remove("live"))
  }

  function highlightEvent(m, i) {
    document.querySelectorAll(".rs-note.active").forEach((n) => n.classList.remove("active"))
    const g = document.getElementById(`rs-ev-${m}-${i}`)
    if (g) g.classList.add("active")
  }

  function highlightBeat(m, b) {
    document.querySelectorAll(".rs-beatdot.on").forEach((d) => d.classList.remove("on"))
    document.querySelectorAll(".rs-measure.live").forEach((d) => d.classList.remove("live"))
    const mEl = sheetRef.current?.querySelector(`.rs-measure[data-m="${m}"]`)
    if (mEl) mEl.classList.add("live")
    const dEl = document.getElementById(`rs-bd-${m}-${b}`)
    if (dEl) dEl.classList.add("on")
  }

  // The parent's Start reads the phrase through this
  useEffect(() => {
    if (!apiRef) return
    apiRef.current = {
      getRhythm() {
        const s = live.current
        if (!s.enabled || !layoutRef.current.length) return null
        const events = []
        layoutRef.current.forEach((items, m) => {
          for (const it of items) {
            events.push({ beat: m * 4 + swungPos(it.pos, it.trip, s.swing), m, i: it.i, rest: !!it.rest })
          }
        })
        return {
          events,
          leadBeats: s.countIn ? 4 : 0,
          totalBeats: layoutRef.current.length * 4,
          loop: s.loop,
          voice: s.voice,
          onEvent: highlightEvent,
          onBeat: highlightBeat,
        }
      },
      clearHighlights,
    }
    return () => { if (apiRef) apiRef.current = null }
  }, [apiRef])

  const prog = PROGS[chords]
  const title = `${measures} bar${measures > 1 ? "s" : ""}${prog ? " · " + prog.name : ""}${loadedName ? " · " + loadedName : ""}`
  const restartIfPlaying = () => { if (live.current.playing) onRestart?.() }

  return (
    <div style={{ marginBottom: "14px" }}>
      <style>{SHED_CSS}</style>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
        <span style={{ font: "800 11px 'IBM Plex Mono', monospace", letterSpacing: "0.14em", color: "var(--db-c-amber)" }}>RHYTHM SHED</span>
        <span style={{ fontSize: "var(--db-fs-sm)", opacity: 0.55 }}>Bebop rhythm generator — the phrase is tapped on the kit snare over your click cells</span>
        <label style={{ ...inlineLabelStyle, marginLeft: "auto" }} title="Off = Start runs the classic metronome alone">
          <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); if (live.current.playing) onRestart?.() }} />
          Rhythm
        </label>
      </div>

      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "10px" }}>
        <button onClick={() => regen()} style={{
          padding: "6px 14px", borderRadius: "var(--db-r-md)", cursor: "pointer", fontWeight: 700, fontSize: "var(--db-fs-sm)",
          border: "1px solid var(--db-c-amber)", background: "color-mix(in srgb, var(--db-c-amber) 12%, var(--db-bg))", color: "var(--db-c-amber)",
        }}>
          ↻ New rhythm
        </button>

        <label style={inlineLabelStyle}>
          <span style={{ opacity: 0.7 }}>Bars</span>
          {[1, 2, 4].map((n) => (
            <button key={n} onClick={() => { setMeasures(n); regen({ measures: n }) }} style={segBtn(measures === n)}>{n}</button>
          ))}
        </label>

        <label style={inlineLabelStyle}>
          <span style={{ opacity: 0.7 }}>Changes</span>
          <select value={chords} onChange={(e) => setChords(e.target.value)} style={{ ...selectStyle, width: "auto", padding: "5px 8px" }}>
            <option value="none">No chords</option>
            <option value="251">ii V I in C</option>
            <option value="blues">F blues</option>
            <option value="rc">Rhythm changes A</option>
            <option value="minor251">Minor ii V i</option>
          </select>
        </label>

        <label style={inlineLabelStyle} title="How busy the generated phrase is">
          Density
          <input type="range" min="0" max="100" value={density}
            onChange={(e) => setDensity(Number(e.target.value))}
            onMouseUp={() => regen()} onTouchEnd={() => regen()} onKeyUp={() => regen()}
            style={{ width: "90px" }} />
        </label>

        <label style={inlineLabelStyle}>
          <input type="checkbox" checked={trips} onChange={(e) => { setTrips(e.target.checked); regen({ trips: e.target.checked }) }} />
          Triplets
        </label>
        <label style={inlineLabelStyle}>
          <input type="checkbox" checked={rests} onChange={(e) => { setRests(e.target.checked); regen({ rests: e.target.checked }) }} />
          Rests
        </label>
        <label style={inlineLabelStyle} title="Over-the-bar two-beat cells">
          <input type="checkbox" checked={sync} onChange={(e) => { setSync(e.target.checked); regen({ sync: e.target.checked }) }} />
          Syncopation
        </label>
      </div>

      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "10px" }}>
        <label style={inlineLabelStyle}>
          <input type="checkbox" checked={swing} onChange={(e) => { setSwing(e.target.checked); restartIfPlaying() }} />
          Swing 8ths
        </label>
        <label style={inlineLabelStyle} title="One bar of click cells alone before the phrase enters (first pass only)">
          <input type="checkbox" checked={countIn} onChange={(e) => setCountIn(e.target.checked)} />
          Count-in bar
        </label>
        <label style={inlineLabelStyle}>
          <input type="checkbox" checked={loop} onChange={(e) => { setLoop(e.target.checked); restartIfPlaying() }} />
          Loop
        </label>
        <label style={inlineLabelStyle}>
          <span style={{ opacity: 0.7 }}>Voice</span>
          <select value={voice} onChange={(e) => { setVoice(e.target.value); restartIfPlaying() }} style={{ ...selectStyle, width: "auto", padding: "5px 8px" }}>
            <option value="snare">Kit snare</option>
            <option value="pluck">Pluck</option>
          </select>
        </label>
        <label style={inlineLabelStyle} title="One-tap presets that program the click cells below">
          <span style={{ opacity: 0.7 }}>Click preset</span>
          {[["off", "Off"], ["all", "1 2 3 4"], ["24", "2 & 4"]].map(([v, l]) => (
            <button key={v} onClick={() => { onMetPreset?.(v); restartIfPlaying() }} style={segBtn(false)}>{l}</button>
          ))}
        </label>
      </div>

      <div className="rs-sheet">
        <div className="rs-sheet-top">
          <div className="rs-t">{title}</div>
          <div className="rs-swingtag">{swing ? "swing 8ths" : "straight 8ths"}</div>
        </div>
        <div className="rs-measures" ref={sheetRef} />
      </div>

      <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, margin: "8px 2px 0", lineHeight: 1.5 }}>
        <b>How to shed it:</b> generate a phrase, clap or scat it with the click first, then play it on one
        note, then run it through the changes with your own lines. The <b>2 &amp; 4</b> click is the honest one.
        Push density up and swing off to check your triplet subdivision is real, not faked.
      </div>

      <details style={{ marginTop: "10px" }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "var(--db-fs-sm)", color: "var(--db-c-amber)" }}>
          Rhythm library — 30 patterns, tap any card to load and play it
        </summary>
        <div style={{ marginTop: "8px" }}>
          {LIB_SECTIONS.map((sec) => (
            <div key={sec.s} style={{ marginBottom: "14px" }}>
              <div style={{ fontWeight: 800, fontSize: "var(--db-fs-md)", margin: "10px 2px 2px" }}>
                <span style={{ color: "var(--db-c-amber)", marginRight: "6px" }}>{sec.rn}</span>{sec.title}
              </div>
              <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, margin: "0 2px 8px" }}>{sec.desc}</div>
              <div className="rs-libgrid" ref={(node) => { libRefs.current[sec.s] = node }} />
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
