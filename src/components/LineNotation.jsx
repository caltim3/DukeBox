"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { lineToVexBars } from "@/lib/music/vexline"

// Standard notation over guitar TAB, engraved with VexFlow.
//
// This used to go through abcjs, which owns its own string choice for the TAB
// staff — there is no way to say "play that F on the D string" in ABC. So the
// old version rendered the line, then reached into the SVG and nudged each TAB
// number's y coordinate by a constant lifted from abcjs's internals to move it
// onto the string DukeBox meant. That broke the moment abcjs changed its
// spacing, and silently mis-numbered the TAB if the node order ever drifted
// from the note order. VexFlow's TabNote takes { str, fret } directly, which is
// exactly the shape a DukeBox line already stores, so the fingering a
// guitarist picked in the neck-position control is now what gets drawn — no
// post-render patching anywhere in this file.

const BARS_PER_ROW = 4
const PAD_X = 10
const PAD_TOP = 34          // room for chord symbols over the first stave
const STAVE_TO_TAB = 84     // treble stave top -> TAB stave top
const ROW_HEIGHT = 212      // one notation+TAB system, including the gap below
const CLEF_ROOM = 42        // reserved at the head of each row
const TIME_SIG_ROOM = 26    // reserved once, on the very first measure
const BAR_PADDING = 16      // breathing room between a bar's music and its barline

// Beats -> a VexFlow duration string. "qd" is a dotted quarter, "qdr" a dotted
// quarter rest; the trailing "r" is what makes it a rest.
function durationCode(ev, rest) {
  return `${ev.code}${"d".repeat(ev.dots)}${rest ? "r" : ""}`
}

// One bar's worth of drawable objects, built before any stave exists so the
// engraver can ask how much room the music actually needs before deciding how
// wide to draw it.
function buildBar(VF, bar, highlightables) {
  const { StaveNote, TabNote, GhostNote, Voice, Formatter, Beam, Tuplet, Dot, Accidental } = VF

  const staveNotes = []
  const tabNotes = []
  bar.events.forEach((ev) => {
    if (ev.kind === "rest") {
      // Whole rests hang from the line above; everything shorter sits on the
      // middle line.
      const rest = new StaveNote({ keys: [ev.code === "w" ? "d/5" : "b/4"], duration: durationCode(ev, true) })
      if (ev.dots) Dot.buildAndAttach([rest], { all: true })
      staveNotes.push(rest)
      // The TAB staff shows no rest symbols — abcjs didn't either — but it
      // still has to consume the same ticks or the two staves drift apart.
      tabNotes.push(new GhostNote({ duration: durationCode(ev, true) }))
      return
    }
    const note = new StaveNote({ keys: [ev.key], duration: durationCode(ev, false), autoStem: true })
    if (ev.dots) Dot.buildAndAttach([note], { all: true })
    const tab = new TabNote({ positions: [{ str: ev.string, fret: ev.fret }], duration: durationCode(ev, false) })
    staveNotes.push(note)
    tabNotes.push(tab)
    highlightables[ev.soundingIndex] = [note, tab]
  })

  // Beams and tuplets have to exist before formatting: a tuplet rewrites its
  // notes' tick values, and the formatter spaces from those ticks. The TAB
  // staff gets the same tuplets so both voices still add up to a bar — they're
  // just never drawn, since fret numbers carry no bracket.
  const beams = bar.beams.map((group) => new Beam(group.map((i) => staveNotes[i])))
  bar.tuplets.forEach((group) => {
    const opts = { numNotes: 3, notesOccupied: 2, bracketed: true }
    new Tuplet(group.map((i) => tabNotes[i]), opts)
    new Tuplet(group.map((i) => staveNotes[i]), opts)
  })
  const tuplets = bar.tuplets.map((group) => staveNotes[group[0]].getTuplet())

  const voice = new Voice({ numBeats: bar.beats, beatValue: 4 }).setMode(Voice.Mode.SOFT)
  const tabVoice = new Voice({ numBeats: bar.beats, beatValue: 4 }).setMode(Voice.Mode.SOFT)
  voice.addTickables(staveNotes)
  tabVoice.addTickables(tabNotes)
  Accidental.applyAccidentals([voice], "C")

  const formatter = new Formatter().joinVoices([voice]).joinVoices([tabVoice])
  // What this bar needs to be legible. Bars are sized in proportion to this,
  // so a bar of eighth notes gets more room than a bar of two half notes
  // instead of every bar being cut to the same width and colliding.
  const minWidth = formatter.preCalculateMinTotalWidth([voice, tabVoice])

  return { chord: bar.chord, voice, tabVoice, formatter, beams, tuplets, minWidth }
}

// VexFlow draws every piece of text — fret numbers included — in Bravura by
// default, and Bravura is a music font: its digits come out as glyph rubble.
// The music glyphs still want Bravura, so only the TAB numbers get retargeted.
let tabFontPatched = false
function retargetTabNumberFont(VF) {
  if (tabFontPatched || !VF.MetricsDefaults?.TabNote?.text) return
  VF.MetricsDefaults.TabNote.text.fontFamily = "Academico, serif"
  VF.Metrics.clear()
  tabFontPatched = true
}

function engrave(VF, host, line, { width: baseWidth, scale, compact }) {
  const { Renderer, Stave, TabStave, StaveConnector } = VF
  retargetTabNumberFont(VF)

  const { bars } = lineToVexBars(line)
  const rowCount = Math.max(1, Math.ceil(bars.length / BARS_PER_ROW))

  // Sounding notes only, in playback order — rests never take a slot, because
  // activeIndex counts the notes the transport actually fires.
  const highlightables = []
  const rows = []
  for (let row = 0; row < rowCount; row += 1) {
    const rowBars = bars.slice(row * BARS_PER_ROW, (row + 1) * BARS_PER_ROW)
    rows.push({
      head: CLEF_ROOM + (row === 0 ? TIME_SIG_ROOM : 0),
      built: rowBars.map((bar) => buildBar(VF, bar, highlightables)),
    })
  }

  // Rows are as wide as the busiest one needs, never narrower than the layout
  // width. The SVG is fluid, so a row that needs more room than the card has
  // scales down to fit rather than colliding with itself.
  const needed = rows.reduce((max, row) => Math.max(max, PAD_X * 2 + row.head
    + row.built.reduce((sum, b) => sum + b.minWidth + BAR_PADDING, 0)), 0)
  const width = Math.max(baseWidth, Math.ceil(needed))
  const height = PAD_TOP + rowCount * ROW_HEIGHT

  host.innerHTML = ""
  const renderer = new Renderer(host, Renderer.Backends.SVG)
  renderer.resize(Math.round(width * scale), Math.round(height * scale))
  const ctx = renderer.getContext()
  ctx.scale(scale, scale)

  rows.forEach((row, rowIndex) => {
    const staveTop = PAD_TOP + rowIndex * ROW_HEIGHT
    const tabTop = staveTop + STAVE_TO_TAB
    const spare = width - PAD_X * 2 - row.head
    const totalMin = row.built.reduce((sum, b) => sum + b.minWidth + BAR_PADDING, 0) || 1

    let x = PAD_X
    let firstStave = null
    let firstTab = null
    let lastStave = null
    let lastTab = null

    row.built.forEach((built, indexInRow) => {
      const isFirst = indexInRow === 0
      const share = ((built.minWidth + BAR_PADDING) / totalMin) * spare
      const w = share + (isFirst ? row.head : 0)
      const stave = new Stave(x, staveTop, w)
      const tabStave = new TabStave(x, tabTop, w)
      if (isFirst) {
        stave.addClef("treble")
        tabStave.addClef("tab")
        if (rowIndex === 0) stave.addTimeSignature("4/4")
      }
      // The treble stave reserves room for a clef and time signature; the TAB
      // stave only for its own glyph. Left alone, every fret number would sit
      // to the left of the note it belongs to — so both staves start their
      // music at the same x.
      const noteStartX = Math.max(stave.getNoteStartX(), tabStave.getNoteStartX())
      stave.setNoteStartX(noteStartX)
      tabStave.setNoteStartX(noteStartX)
      stave.setContext(ctx).draw()
      tabStave.setContext(ctx).draw()

      const noteRoom = w - (noteStartX - stave.getX()) - BAR_PADDING
      built.formatter.format([built.voice, built.tabVoice], Math.max(24, noteRoom))
      built.voice.draw(ctx, stave)
      built.tabVoice.draw(ctx, tabStave)
      built.beams.forEach((beam) => beam.setContext(ctx).draw())
      built.tuplets.forEach((tuplet) => tuplet?.setContext(ctx).draw())

      // Chord symbols are drawn straight onto the context rather than hung off
      // a note, so they sit on one line across the row like a lead sheet
      // instead of riding up and down with the melody.
      if (built.chord) {
        ctx.save()
        ctx.setFont("sans-serif", compact ? 11 : 13, "bold")
        ctx.fillText(built.chord, noteStartX, stave.getYForTopText(2))
        ctx.restore()
      }

      if (isFirst) { firstStave = stave; firstTab = tabStave }
      lastStave = stave
      lastTab = tabStave
      x += w
    })

    // The line down the left edge and the one closing the right are what read
    // as "one system" rather than two unrelated staves.
    if (firstStave && firstTab) {
      new StaveConnector(firstStave, firstTab).setType("singleLeft").setContext(ctx).draw()
    }
    if (lastStave && lastTab) {
      new StaveConnector(lastStave, lastTab).setType("singleRight").setContext(ctx).draw()
    }
  })

  const svg = host.querySelector("svg")
  if (svg) {
    // Fluid like abcjs's responsive mode: the engraving keeps its aspect ratio
    // and shrinks to fit a narrow card, while the zoom control still makes it
    // bigger on a wide one.
    svg.setAttribute("viewBox", `0 0 ${Math.round(width * scale)} ${Math.round(height * scale)}`)
    svg.setAttribute("preserveAspectRatio", "xMinYMin meet")
    svg.style.width = `${Math.round(width * scale)}px`
    svg.style.maxWidth = "100%"
    svg.style.height = "auto"
  }

  return highlightables
}

export default function LineNotation({ line, activeIndex = -1, compact = false, scale = 1, maxHeight = null }) {
  const hostRef = useRef(null)
  const notesRef = useRef([])
  const [vf, setVf] = useState(null)
  const [renderError, setRenderError] = useState(false)
  // Engraving depends on the notes, not the clock: unlike the old ABC header,
  // nothing here changes when the tempo does.
  const bars = line?.bars
  const engraved = useMemo(() => ({ bars }), [bars])

  useEffect(() => {
    let cancelled = false
    // Client-only: VexFlow measures glyphs against the DOM, so it can never be
    // pulled in at module scope under SSR. The module namespace goes through
    // the lazy-initializer form because a bare value would be mistaken for a
    // state updater and called.
    import("vexflow")
      // VexFlow starts loading Bravura and Academico on import and measures
      // glyphs against them. Engraving before they land gives a score full of
      // fallback boxes, so wait for the browser to finish with its fonts.
      .then(async (mod) => {
        try { await document.fonts?.ready } catch { /* no font API — draw anyway */ }
        if (!cancelled) setVf(() => mod)
      })
      .catch(() => { if (!cancelled) setRenderError(true) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!vf || !host) return
    try {
      notesRef.current = engrave(vf, host, { bars: engraved.bars }, {
        width: compact ? 440 : 760,
        scale: Number(scale) || 1,
        compact,
      })
      setRenderError(false)
    } catch {
      host.innerHTML = ""
      notesRef.current = []
      setRenderError(true)
    }
  }, [vf, engraved, compact, scale])

  useEffect(() => {
    // Highlighting is just a class on already-drawn SVG groups — playback flips
    // it once per note at tempo, so it must never re-engrave the score.
    notesRef.current.forEach((pair, index) => {
      pair?.forEach((note) => {
        const el = note.getSVGElement?.()
        if (el) el.classList.toggle("db-vf-active", index === activeIndex)
      })
    })
  }, [activeIndex, vf, engraved, compact, scale, renderError])

  return (
    <div className="db-line-notation" style={{
      overflowX: "auto",
      overflowY: maxHeight ? "auto" : "visible",
      maxHeight: maxHeight || undefined,
      border: "1px solid var(--db-panel-border)",
      borderRadius: "var(--db-r-md)",
      background: "var(--db-card-bg)",
      minHeight: compact ? "150px" : "180px",
    }}>
      <div ref={hostRef} role="img" aria-label="Standard notation and guitar tablature for this line" />
      {!vf && !renderError && <div style={{ padding: "18px", color: "var(--db-muted)", fontSize: "var(--db-fs-xs)" }}>Loading notation...</div>}
      {renderError && <div style={{ padding: "18px", color: "var(--db-muted)", fontSize: "var(--db-fs-xs)" }}>Notation could not be rendered.</div>}
      <style jsx global>{`
        /* VexFlow paints in its own black. Setting the root's fill and stroke
           to the theme colour recolours everything that didn't ask for a
           colour of its own, and leaves the ones that did (fill="none" on
           stave lines) alone. */
        .db-line-notation svg {
          color: var(--db-text);
          fill: currentColor;
          stroke: currentColor;
          display: block;
        }
        /* Each TAB fret number sits on a mask that hides the string line
           behind it. VexFlow paints that mask white; on a dark card it has to
           be the card's own colour or the numbers sit in white boxes. */
        .db-line-notation svg [fill="white"] { fill: var(--db-card-bg); }
        .db-line-notation .db-vf-active,
        .db-line-notation .db-vf-active * {
          fill: var(--db-c-salmon, var(--db-accent)) !important;
          stroke: var(--db-c-salmon, var(--db-accent)) !important;
        }
      `}</style>
    </div>
  )
}
