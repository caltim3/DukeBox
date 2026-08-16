"use client"

import { useState } from "react"

// Chart ribbon — in-flow, always-visible bar strip for the Cockpit/Focus
// canvas (spec §5.5). Distinct from <GigBarStrip>, which is a fixed overlay
// that only appears while the transport is running; this one is part of the
// page and visible whether paused or playing, with the loop-range actions
// attached. Reads/writes the exact same selection + loop state the Lead
// Sheet Grid and the fretboard already use — no new state, except the
// two-click loop-range gesture and the Freeze toggle below.

export default function ChartRibbon({
  bars,
  barLabels,
  selectedIndex,
  onSelectBar,
  loopStart,
  loopEnd,
  loopEnabled,
  onSetLoopStart,
  onSetLoopEnd,
  currentIndex,
  nextIndex,
  sectionLabel,
  onToggleLoop,
  freezeMode,
  onToggleFreeze,
  onPreviewChord,
}) {
  const lo = Math.min(loopStart, loopEnd)
  const hi = Math.max(loopStart, loopEnd)
  const selectedLabel = barLabels?.[selectedIndex] ?? selectedIndex + 1

  // Setting a range is the whole gesture — nobody picks Start and End and then
  // wants the band to keep running the full form. So the range buttons arm the
  // loop as well as setting the bound.
  const setStart = () => { setLoopAnchor(null); onSetLoopStart(selectedIndex); if (!loopEnabled) onToggleLoop?.() }
  const setEnd   = () => { setLoopAnchor(null); onSetLoopEnd(selectedIndex);   if (!loopEnabled) onToggleLoop?.() }

  // Click-the-bars-themselves loop range — a second way in besides Start
  // Here/End Here, for setting a range without selecting each end first.
  // First click on a bar while Loop is on drops an anchor and collapses the
  // range onto it; the next click on a different bar stretches the range out
  // to meet it and clears the anchor, so the third click starts a fresh
  // range rather than keeps stretching the old one.
  const [loopAnchor, setLoopAnchor] = useState(null)
  // Cleared whenever Loop goes off, so turning it back on always starts
  // clean. Compared during render against the loop state on the previous
  // render (React's own pattern for "adjust state when a prop changes")
  // rather than an effect, which would just be a slower way to notice the
  // same transition a render later.
  const [prevLoopEnabled, setPrevLoopEnabled] = useState(loopEnabled)
  if (loopEnabled !== prevLoopEnabled) {
    setPrevLoopEnabled(loopEnabled)
    if (!loopEnabled && loopAnchor !== null) setLoopAnchor(null)
  }

  const rangeBtn = {
    font: "700 10px 'IBM Plex Mono', monospace", letterSpacing: "0.06em", textTransform: "uppercase",
    padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--hot)",
    background: "var(--surface)", color: "var(--hot)", cursor: "pointer", whiteSpace: "nowrap",
  }

  function handleBarClick(index) {
    // Frozen: the ribbon is a silent practice pad. First tap on a chord just
    // selects it — puts it on the fretboard with no sound. A second tap on
    // the chord that's already selected is the "play it" gesture; loop-range
    // editing sits out entirely while frozen, since setting up a loop isn't
    // what Freeze is for.
    if (freezeMode) {
      if (index === selectedIndex) onPreviewChord?.(index)
      else onSelectBar(index)
      return
    }
    onSelectBar(index)
    if (!loopEnabled) return
    if (loopAnchor == null) {
      setLoopAnchor(index)
      onSetLoopStart(index)
      onSetLoopEnd(index)
    } else {
      onSetLoopEnd(index)
      setLoopAnchor(null)
    }
  }

  // A 36-bar tune rendered every bar at once, so the chord you were actually
  // playing was one cell in a wall of them. Show three four-bar rows instead —
  // the row you're in plus the next two — and let it scroll a row at a time as
  // the playhead crosses into the next four. Four per row is also the phrasing
  // the eye reads a lead sheet by.
  const COLS = 4
  const ROWS = 3
  const WINDOW = COLS * ROWS
  // While looping, anchor on the loop rather than the playhead: a drill range
  // that fits on screen should stay on screen, or you lose sight of the bars you
  // are repeating. Only a loop longer than the window falls back to following
  // the playhead, since it cannot all be shown at once anyway.
  const loopFits = loopEnabled && hi - lo + 1 <= WINDOW
  const anchor = loopFits ? lo : (currentIndex ?? selectedIndex ?? 0)
  const windowStart = Math.floor(anchor / COLS) * COLS
  const windowBars = bars.slice(windowStart, windowStart + WINDOW)
  const windowEnd = windowStart + windowBars.length

  return (
    <div data-db-shortcut="chart-ribbon" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px", padding: "12px 14px", marginBottom: "12px", position: "relative" }}>
      <div style={{
        font: "800 10.5px 'Archivo', sans-serif", letterSpacing: "0.14em", textTransform: "uppercase",
        color: "var(--muted)", marginBottom: "8px", display: "flex", justifyContent: "space-between",
        alignItems: "center", gap: "8px", flexWrap: "wrap",
      }}>
        <span>{sectionLabel}</span>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Freeze — stops the band and turns the ribbon into a silent
              practice pad (see handleBarClick). Its own control, not folded
              into the loop deck: freezing and looping answer different
              questions ("what am I hearing" vs. "what's repeating") and
              doing both at once isn't a state worth supporting. */}
          <button
            onClick={onToggleFreeze}
            aria-pressed={freezeMode}
            title={freezeMode
              ? "Unfreeze — picks the band back up where it left off"
              : "Freeze — stop the band, tap any chord to study it silently, tap it again to hear just that chord"}
            style={{
              font: "800 11px 'IBM Plex Mono', monospace", letterSpacing: "0.12em",
              padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--info)",
              background: freezeMode ? "var(--info)" : "var(--surface)",
              color: freezeMode ? "#FFF" : "var(--info)", cursor: "pointer",
            }}
          >
            {freezeMode ? "❄ FROZEN" : "Freeze"}
          </button>

          {/* Loop deck. The range buttons used to sit here unlabelled and unarmed:
              you could set a start and an end and nothing would ever repeat,
              because the only loop switch was in the sticky transport. Grouped
              under one LOOP header now, with the on/off beside them. */}
          <div style={{
            display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap",
            padding: "6px 10px", borderRadius: "10px",
            border: `1px solid ${loopEnabled ? "var(--hot)" : "var(--line)"}`,
            background: loopEnabled ? "var(--loop)" : "var(--surface2)",
            opacity: freezeMode ? 0.5 : 1,
          }}>
            <button
              onClick={onToggleLoop}
              disabled={freezeMode}
              aria-pressed={loopEnabled}
              title={loopEnabled ? "Loop is on — click to play the whole form" : "Loop the selected range"}
              style={{
                font: "800 11px 'IBM Plex Mono', monospace", letterSpacing: "0.12em",
                padding: "6px 12px", borderRadius: "6px", border: "1px solid var(--hot)",
                background: loopEnabled ? "var(--hot)" : "transparent",
                color: loopEnabled ? "#FFF" : "var(--hot)", cursor: freezeMode ? "not-allowed" : "pointer",
              }}
            >
              {loopEnabled ? "◼ LOOP ON" : "LOOP OFF"}
            </button>

            <button onClick={setStart} disabled={freezeMode} style={{ ...rangeBtn, cursor: freezeMode ? "not-allowed" : "pointer" }} title={`Loop from bar ${selectedLabel}`}>
              Start Here
            </button>
            <button onClick={setEnd} disabled={freezeMode} style={{ ...rangeBtn, cursor: freezeMode ? "not-allowed" : "pointer" }} title={`Loop up to bar ${selectedLabel}`}>
              End Here
            </button>

            <span style={{
              font: "800 11px 'IBM Plex Mono', monospace", letterSpacing: "0.04em",
              color: loopEnabled ? "var(--hot)" : "var(--muted)", whiteSpace: "nowrap",
            }}>
              {loopEnabled
                ? `Bars ${lo + 1}–${hi + 1} · ${hi - lo + 1} bar${hi === lo ? "" : "s"}`
                : `Bar ${selectedLabel} selected`}
            </span>
          </div>
        </div>
      </div>

      {freezeMode && (
        <div style={{
          font: "600 10.5px 'Instrument Sans', sans-serif", fontStyle: "italic", color: "var(--info)",
          marginBottom: "8px",
        }}>
          Tap a chord to study it silently · tap it again to hear it
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: "6px" }}>
        {windowBars.map((bar, offset) => {
          const index = windowStart + offset
          const inLoop = loopEnabled && index >= lo && index <= hi
          const isLoopStart = loopEnabled && index === lo
          const isLoopEnd = loopEnabled && index === hi
          const isNow = index === currentIndex
          const isNext = index === nextIndex
          const isSelected = index === selectedIndex
          const frozenSelected = freezeMode && isSelected
          // The loop bounds are drawn on the bars themselves, as brackets on the
          // outer edges of the range — you can see where the repeat turns around
          // without reading the numbers back off the header. All four sides are
          // set as longhand every render (never the `border` shorthand) so the
          // in/out edges can override just one side without React warning about
          // a shorthand and a longhand fighting over the same property.
          const baseBorder = isNow ? "1px solid var(--accent)"
            : frozenSelected ? "2px solid var(--info)"
            : isNext ? "1px solid var(--info)"
            : isSelected ? "1px solid var(--sel)"
            : "1px solid var(--line)"
          const edgeBorder = "4px solid var(--hot)"
          return (
            <button
              key={index}
              onClick={() => handleBarClick(index)}
              title={frozenSelected ? "Tap again to hear this chord" : undefined}
              style={{
                background: isNow ? "var(--accent)" : inLoop ? "var(--loop)" : "var(--surface2)",
                color: isNow ? "var(--accent-ink)" : "var(--text)",
                borderTop: baseBorder, borderBottom: baseBorder,
                borderLeft: isLoopStart ? edgeBorder : baseBorder,
                borderRight: isLoopEnd ? edgeBorder : baseBorder,
                boxShadow: isNow ? "0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent)" : frozenSelected ? "0 0 0 3px color-mix(in srgb, var(--info) 25%, transparent)" : isNext ? "inset 0 0 0 1px var(--info)" : "none",
                transform: isNow ? "scale(1.05)" : "none",
                borderRadius: "8px", padding: "8px 4px", textAlign: "center", cursor: "pointer",
                transition: "transform .12s, background .12s",
                position: "relative",
              }}
            >
              <span style={{ font: "500 9px 'IBM Plex Mono', monospace", opacity: 0.7, display: "block" }}>{barLabels?.[index] ?? index + 1}</span>
              <span style={{ font: "700 14px 'IBM Plex Mono', monospace", marginTop: "1px", display: "block" }}>{bar.symbol}</span>
              {frozenSelected && !isLoopStart && !isLoopEnd && (
                <span style={{
                  position: "absolute", top: "2px", right: "4px",
                  font: "800 10px 'IBM Plex Mono', monospace", color: "var(--info)",
                }} aria-hidden="true">
                  ♪
                </span>
              )}
              {(isLoopStart || isLoopEnd) && (
                <span style={{
                  position: "absolute", top: "2px", right: "4px",
                  font: "800 7.5px 'IBM Plex Mono', monospace", letterSpacing: "0.1em",
                  color: isNow ? "var(--accent-ink)" : "var(--hot)",
                }}>
                  {isLoopStart && isLoopEnd ? "⟲" : isLoopStart ? "IN" : "OUT"}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {/* Where this window sits in the tune. The old full-width playhead rule
          is gone with the single row it was drawn across — the current bar is
          unmistakable now (accent fill, scaled up, ringed) and a vertical line
          over three rows would mark nothing. */}
      {bars.length > WINDOW && (
        <div style={{
          marginTop: "8px", textAlign: "right",
          font: "600 9.5px 'IBM Plex Mono', monospace", letterSpacing: "0.08em",
          textTransform: "uppercase", color: "var(--muted)",
        }}>
          Bars {windowStart + 1}–{windowEnd} of {bars.length}
        </div>
      )}
    </div>
  )
}
