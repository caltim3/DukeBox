// Rhythm Shed — shared data + manuscript renderer, used by both the
// generator (components/RhythmShed.jsx) and the pattern library
// (components/BeatForgeLibrary.jsx) so the two surfaces draw identical
// notation and can hand a pattern to the same playback engine.

export const PROGS = {
  none:     null,
  "251":    { name: "ii V I in C",      bars: ["Dm7", "G7", "Cmaj7", "Cmaj7"] },
  blues:    { name: "F blues",          bars: ["F7", "Bb7", "F7", "Cm7 F7", "Bb7", "Bdim7", "F7", "Am7b5 D7", "Gm7", "C7", "F7 D7", "Gm7 C7"] },
  rc:       { name: "Rhythm changes A", bars: ["Bb6 G7", "Cm7 F7", "Bb6 G7", "Cm7 F7", "Fm7 Bb7", "Eb6 Ab7", "Dm7 G7", "Cm7 F7"] },
  minor251: { name: "Minor ii V i",     bars: ["Dm7b5", "G7alt", "Cm6", "Cm6"] },
}

/* event: { d: duration in beats, rest: bool, trip: bool, tg: tripletGroupId } */
let tgSeq = 0

export function clone(ev) {
  const tg = ++tgSeq
  return ev.map((e) => {
    const n = { d: e.d, rest: !!e.rest, trip: !!e.trip }
    if (n.trip) n.tg = tg
    return n
  })
}

export function swungPos(pos, trip, swing) {
  if (!swing || trip) return pos
  const frac = pos - Math.floor(pos)
  if (Math.abs(frac - 0.5) < 1e-6) return Math.floor(pos) + 2 / 3
  return pos
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

export function renderMeasure(container, events, idp, chordText, compact) {
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

export const LIB = [
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

export const LIB_SECTIONS = [
  { s: "A", rn: "I.",   title: "The rules",  desc: "The raw subdivisions. Own each of these cold, at every tempo, before mixing." },
  { s: "B", rn: "II.",  title: "Mix it",     desc: "The same rules with air and displacement. Rests are notes. Feel where beat 1 went." },
  { s: "C", rn: "III.", title: "Pure bebop", desc: "Phrase shapes straight out of the language: offbeat entries, triplet turns, anticipated landings. Sing them before you play them." },
]

// Shared manuscript-paper CSS — injected once by whichever component mounts
// first (RhythmShed and BeatForgeLibrary both inject it; duplicate <style>
// tags with identical rules are harmless).
export const SHED_CSS = `
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
