"use client"

// Gig Mode — the unified song library as the whole page. Every chart
// (Songbook, Gig Book, Tavern Set, My Library) is a name card here; the
// dropdown, the playlist pills and the search box above narrow the wall
// down. Click a card and the full band plays it.
//
// The lead sheet editor used to live here in a pane beside a sidebar rail,
// which made this page half-browser and half-editor and gave the tunes a
// 300px column to live in. That editor is the same SongSheet component the
// Create tab renders — not a second one — so nothing is lost by dropping it
// here: sections and measures still drag, half-bars, exports, forking a
// built-in on save. Anything a card needs is one click away in Create, and
// Practice's chart ribbon covers quick chord edits.
//
// What stays is the part that is Gig's alone: once the tune you opened is
// the one actually sounding, the page becomes the bandstand — a locked
// stage chart with the measure you're on lit, nothing editable near it.

import { useCallback, useEffect, useMemo, useState } from "react"
import { catalogEntryToDraft } from "@/lib/music/songSource"
import SongLibrarySidebar from "@/components/SongLibrarySidebar"

// Gig charts consume the same app-wide semantic theme as every other workspace.
const THEME = {
  bg: "var(--bg)", panel: "var(--surface)", ink: "var(--text)", muted: "var(--muted)",
  line: "var(--line)", accent: "var(--accent)", accentInk: "var(--accent-ink)",
  chordBg: "var(--surface2)", chordBorder: "var(--line)",
}

export default function GigMode({
  library, setLibrary, onLoadSong, panelStyle, eyebrowStyle, selectStyle,
  activeSongId = null, playheadIndex = null, isPlaying = false, onStop,
}) {
  const theme = THEME

  // Which tune is open, held as the catalog entry itself (not just its id) —
  // SongLibrarySidebar hands back the resolved object on pick, so Gig Mode
  // never needs its own copy of buildCatalog() just to look one up. With the
  // editor gone this only decides which card reads as current and which
  // chart the stage view draws.
  const [openSong, setOpenSong] = useState(null)

  // The playable chart for whatever is open. Derived, not state: nothing on
  // this page edits it any more, so there is no draft to keep in step.
  const draft = useMemo(() => (openSong ? catalogEntryToDraft(openSong) : null), [openSong])

  // Where a card takes you. The two are genuinely different jobs, so this is
  // a choice rather than a default with a workaround:
  //   stage    — stay here and play. The page becomes the lead sheet with
  //              the measure you're on lit: all you need on a gig is to know
  //              where you are.
  //   practice — hand off to Practice's Focus stage, where the fretboard,
  //              the scale and the voice leading are.
  // Sticky, because which one you want is a mode you're in for a whole
  // session — a set, or an evening of woodshedding — not a per-song call.
  const [openIn, setOpenIn] = useState("stage")
  // Restored on mount rather than in a lazy initializer: this page is
  // prerendered, so reading localStorage during the first render would make
  // the server's markup and the client's disagree. One read, once.
  useEffect(() => {
    const saved = window.localStorage.getItem("dukebox.gigOpenIn")
    if (saved === "stage" || saved === "practice") setOpenIn(saved) // eslint-disable-line react-hooks/set-state-in-effect -- one-shot restore of persisted UI state, not a render cascade
  }, [])
  const chooseOpenIn = useCallback((value) => {
    setOpenIn(value)
    window.localStorage.setItem("dukebox.gigOpenIn", value)
  }, [])

  // Straight from the card's own entry rather than from `draft` — a click
  // sets `openSong` and plays in the same tick, and the derived draft above
  // would still be the previous tune's at that point.
  function playEntry(entry, where = openIn) {
    const d = catalogEntryToDraft(entry)
    if (!d?.bars?.length) return
    setOpenSong(entry)
    onLoadSong?.({
      ...d,
      autoplay: true,
      // Only "practice" leaves the tab; "stage" plays right here, which is
      // what turns this page into the bandstand below.
      toFocus: where === "practice",
      songId: entry?.id ?? null,
    })
  }

  // Only light the chart that's actually loaded into the engine
  const liveHere = openSong && activeSongId === openSong.id && playheadIndex != null

  // While *this* tune is the one playing, the sheet collapses into a clean,
  // locked stage chart — tight pills, moving highlight, nothing to
  // accidentally edit mid-song. Stop (or opening a different tune) brings
  // the full editor back. This is what "hit Play in Gig, hit 2" should look
  // like: the bandstand view, not the editor.
  const stageMode = liveHere && isPlaying

  return (
    <div style={{ ...panelStyle, background: theme.bg, color: theme.ink, border: `1px solid ${theme.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
        <div style={{ ...eyebrowStyle, marginBottom: 0, color: theme.accent }}>GIG MODE</div>
        <div style={{ fontSize: "0.78rem", color: theme.muted }}>
          Stage-ready charts · setlists · any chart plays with the full band
        </div>
        {!stageMode && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ font: "700 10px 'IBM Plex Mono', monospace", letterSpacing: "0.12em", textTransform: "uppercase", color: theme.muted }}>
              A card opens in
            </span>
            <div style={{ display: "inline-flex", border: `1px solid ${theme.line}`, borderRadius: "8px", overflow: "hidden" }}>
              {[
                ["stage", "Stage", "Play it here — the lead sheet, with the measure you're on lit"],
                ["practice", "Practice", "Play it in Focus — fretboard, scale and voice leading"],
              ].map(([id, label, hint]) => (
                <button key={id} onClick={() => chooseOpenIn(id)} aria-pressed={openIn === id} title={hint}
                  style={{
                    font: "700 11px 'Instrument Sans', sans-serif", padding: "5px 11px", border: "none", cursor: "pointer",
                    background: openIn === id ? theme.accent : theme.panel,
                    color: openIn === id ? theme.accentInk : theme.muted,
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {stageMode ? (
        /* ── On the bandstand ─────────────────────────────────────────
           The tune you opened is the one sounding: the wall of cards gets
           out of the way and the chart takes the page, measure you're on
           lit. Stop brings the library back. */
        <div style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: "14px", padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap", marginBottom: "4px" }}>
            <h2 style={{ margin: 0, fontSize: "1.6rem", color: theme.ink }}>{draft.title}</h2>
            {openSong.credit && <span style={{ color: theme.muted, fontStyle: "italic" }}>{openSong.credit}</span>}
            <button onClick={() => onStop?.()} style={{ ...solidBtn(theme), marginLeft: "auto" }} title="Stop playback">⏹ Stop</button>
          </div>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "0.82rem", color: theme.muted, marginBottom: "10px" }}>
            <span><b style={{ color: theme.ink }}>Key</b> {draft.keyRoot} {draft.keyMode}</span>
            {openSong.feel && <span><b style={{ color: theme.ink }}>Feel</b> {openSong.feel}</span>}
            <span><b style={{ color: theme.ink }}>Tempo</b> {draft.tempo}</span>
            {openSong.form && <span><b style={{ color: theme.ink }}>Form</b> {openSong.form}</span>}
            {openSong.refArtist && <span><b style={{ color: theme.ink }}>Ref</b> {openSong.refArtist}</span>}
          </div>
          {openSong.note && (
            <div style={{ fontSize: "0.85rem", color: theme.muted, marginBottom: "16px", paddingLeft: "10px", borderLeft: `3px solid ${theme.accent}` }}>
              {openSong.note}
            </div>
          )}
          <StageChart draft={draft} activeIndex={playheadIndex} theme={theme} />
        </div>
      ) : (
        /* ── The wall ─────────────────────────────────────────────────
           Every tune as a name card, full width, "All" to begin with. The
           dropdown, pills and search above narrow it; a card plays. */
        <SongLibrarySidebar
          library={library}
          setLibrary={setLibrary}
          selectedId={openSong?.id ?? null}
          onSelect={setOpenSong}
          onActivate={(song) => playEntry(song)}
          activateLabel={openIn === "stage" ? "click to play on the stage" : "click to play in Practice"}
          secondaryAction={{
            // Always the destination you didn't pick, so the exception is
            // one click too — no going back to the toggle for one tune.
            label: openIn === "stage" ? "Practice" : "Stage",
            title: openIn === "stage"
              ? "Play this one in Practice's Focus stage instead"
              : "Play this one here on the stage instead",
            onClick: (song) => playEntry(song, openIn === "stage" ? "practice" : "stage"),
          }}
          autoSelectFirst
          preferId={activeSongId}
          selectStyle={selectStyle}
          searchShortcutHook="gig-search"
          showPills
          layout="grid"
        />
      )}

      <style>{`
        @media (max-width: 480px) {
          .gig-stage-chord-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}

// The read-only "on the bandstand" chart shown while the open tune is the
// one actually playing — tight pills, moving highlight, nothing to
// accidentally edit mid-song. Reads draft.bars (not the catalog original),
// so an unsaved edit you just made is exactly what's on the stand.
function StageChart({ draft, activeIndex, theme }) {
  const sections = []
  let cur = null
  let index = 0
  for (const bar of draft.bars) {
    const name = bar.section || "A"
    if (!cur || cur.name !== name) { cur = { name, bars: [] }; sections.push(cur) }
    cur.bars.push({ symbol: bar.symbol, index })
    index++
  }

  return (
    <div>
      {sections.map((sec, si) => (
        <div key={si} style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: theme.accent, marginBottom: "6px" }}>
            {sec.name}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }} className="gig-stage-chord-grid">
            {sec.bars.map(({ symbol, index: i }) => {
              const isNow = i === activeIndex
              return (
                <div
                  key={i}
                  ref={isNow ? (el) => el?.scrollIntoView({ block: "nearest", behavior: "smooth" }) : null}
                  style={{
                    background: isNow ? `color-mix(in srgb, ${theme.accent} 78%, ${theme.panel})` : theme.chordBg,
                    border: `2px solid ${isNow ? theme.accent : theme.chordBorder}`,
                    borderRadius: "8px",
                    padding: "14px 8px", textAlign: "center", fontWeight: 700,
                    color: isNow ? theme.accentInk : theme.ink,
                    fontSize: "1.3rem", lineHeight: 1.1,
                    boxShadow: isNow ? `0 0 18px ${theme.accent}` : "none",
                    transition: "background 0.12s, color 0.12s, box-shadow 0.12s",
                  }}
                >
                  {symbol}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function solidBtn(theme) {
  return {
    padding: "6px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem",
    background: theme.accent, color: theme.accentInk, border: `1px solid ${theme.accent}`,
  }
}
