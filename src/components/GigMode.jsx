"use client"

// Gig Mode — the unified song library. Every chart (Songbook, Gig Book,
// Tavern Set, My Library) lives here, editable in place via SongSheet:
// drag sections/measures, edit chords/key/tempo, transpose, save. Editing a
// built-in forks it into My Library on save (see upsertLibrarySong). Setlists
// (drag to reorder) live in the synced library. "Play" loads the on-screen
// draft into the DukeBox engine for full-band playback; the chart stays open
// and follows along, measure by measure, while it plays.

import { useState } from "react"
import { catalogEntryToDraft, upsertLibrarySong, userSongToCatalogEntry } from "@/lib/music/songSource"
import { ROOTS, transposeChart } from "@/lib/music/tonal"
import SongSheet from "@/components/SongSheet"
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
  // never needs its own copy of buildCatalog() just to look one up.
  const [openSong, setOpenSong] = useState(null)

  // The editable draft for whichever tune is open. Reseeded only when the
  // *selected song* changes (keyed on its id), not on every catalog rebuild
  // — otherwise saving a fork (which rebuilds the catalog) would stomp the
  // in-progress edit it was just made from. Adjusted during render (React's
  // documented pattern for "reset state when a key changes") rather than in
  // an effect, so there's no extra render before the draft catches up.
  const [draft, setDraft] = useState(null)
  const [draftForId, setDraftForId] = useState(null)
  if ((openSong?.id ?? null) !== draftForId) {
    setDraftForId(openSong?.id ?? null)
    setDraft(openSong ? catalogEntryToDraft(openSong) : null)
  }

  // Play/Load act on the draft on screen (including unsaved edits), not the
  // catalog original — otherwise editing a chord and hitting Play would
  // play the old chart. songId still ties back to the catalog entry so
  // Practice/Gig agree on what's loaded even for an unsaved edit. Play (not
  // Load) also asks for Focus — "hit Play, Focus mode begins."
  function loadDraft(autoplay, toFocus = false) {
    if (!draft?.bars?.length) return
    onLoadSong?.({ ...draft, autoplay, toFocus, songId: openSong?.id ?? null })
  }

  function transposeDraft(step) {
    if (!draft) return
    const from = ROOTS.indexOf(draft.keyRoot)
    const to = ROOTS[(((from < 0 ? 0 : from) + step) % ROOTS.length + ROOTS.length) % ROOTS.length]
    setDraft((d) => ({ ...d, bars: transposeChart(d.bars, d.keyRoot, to), keyRoot: to }))
  }

  // Save always writes/overwrites a My Library entry by title — see
  // upsertLibrarySong's doc comment for why that's also how built-ins fork.
  // Re-opening the saved entry (rather than leaving `openSong` pointed at
  // the built-in) makes the fork visible immediately: source badge flips to
  // "My Library" and that's what search/playback pick up from here on.
  function saveDraft(d) {
    const entry = upsertLibrarySong(setLibrary, d)
    if (entry) setOpenSong(userSongToCatalogEntry(entry))
  }

  function openDraftInPractice(d) {
    onLoadSong?.({ ...d, autoplay: false, songId: null, toMode: "practice" })
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
      </div>

      {/* The picker (dropdowns, playlist pills, search, setlists) is chrome —
          the moment this tune is actually playing, gig mode goes bandstand:
          nothing but the locked lead sheet. It comes back the instant Stop
          is hit or a different tune is opened. */}
      <div style={{ display: "grid", gridTemplateColumns: stageMode ? "1fr" : "minmax(220px, 320px) 1fr", gap: "16px" }} className="gig-grid">
        {!stageMode && (
          <SongLibrarySidebar
            library={library}
            setLibrary={setLibrary}
            selectedId={openSong?.id ?? null}
            onSelect={setOpenSong}
            autoSelectFirst
            preferId={activeSongId}
            selectStyle={selectStyle}
            searchShortcutHook="gig-search"
            showPills
          />
        )}

        {/* ── Lead sheet: locked stage chart while playing, full editor otherwise ── */}
        <div style={{ minWidth: 0 }}>
          {openSong && draft ? (
            <div className={stageMode ? "gig-stage" : "gig-song-editor"} style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: "14px", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap", marginBottom: "4px" }}>
                {stageMode && <h2 style={{ margin: 0, fontSize: "1.6rem", color: theme.ink }}>{draft.title}</h2>}
                {openSong.credit && <span style={{ color: theme.muted, fontStyle: "italic" }}>{openSong.credit}</span>}
                {!stageMode && <span style={{ color: theme.muted, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{openSong.source}</span>}
                <div style={{ marginLeft: "auto", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {!stageMode && (
                    <>
                      <button onClick={() => transposeDraft(-1)} style={ghostBtn(theme)} title="Transpose the draft down a half step">Transpose −1</button>
                      <button onClick={() => transposeDraft(1)} style={ghostBtn(theme)} title="Transpose the draft up a half step">Transpose +1</button>
                      <button onClick={() => loadDraft(false)} style={solidBtn(theme)} title="Load this draft into the engine, without playing">Load</button>
                    </>
                  )}
                  {liveHere && isPlaying ? (
                    <button onClick={() => onStop?.()} style={solidBtn(theme)} title="Stop playback">⏹ Stop</button>
                  ) : (
                    <button onClick={() => loadDraft(true, true)} style={solidBtn(theme)} title="Load and play with the full band — drops into Practice's Focus stage">▶ Play</button>
                  )}
                </div>
              </div>
              {(stageMode || openSong.feel) && (
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "0.82rem", color: theme.muted, marginBottom: "10px" }}>
                  {stageMode && <span><b style={{ color: theme.ink }}>Key</b> {draft.keyRoot} {draft.keyMode}</span>}
                  {openSong.feel && <span><b style={{ color: theme.ink }}>Feel</b> {openSong.feel}</span>}
                  {stageMode && <span><b style={{ color: theme.ink }}>Tempo</b> {draft.tempo}</span>}
                  {openSong.form && <span><b style={{ color: theme.ink }}>Form</b> {openSong.form}</span>}
                  {openSong.refArtist && <span><b style={{ color: theme.ink }}>Ref</b> {openSong.refArtist}</span>}
                </div>
              )}
              {openSong.note && (
                <div style={{ fontSize: "0.85rem", color: theme.muted, marginBottom: "16px", paddingLeft: "10px", borderLeft: `3px solid ${theme.accent}` }}>
                  {openSong.note}
                </div>
              )}

              {stageMode ? (
                <StageChart draft={draft} activeIndex={playheadIndex} theme={theme} />
              ) : (
                <SongSheet
                  draft={draft}
                  onChange={setDraft}
                  onSave={saveDraft}
                  onOpenPractice={openDraftInPractice}
                  onStartFromChart={() => {}}
                />
              )}
            </div>
          ) : (
            <div style={{ color: theme.muted, padding: "40px", textAlign: "center" }}>No tune selected.</div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .gig-grid { grid-template-columns: 1fr !important; }
        }
        /* SongSheet's own 4/2/1-column breakpoints key off *window* width,
           tuned for Create's full-width layout. Gig always has a sidebar
           eating 220-300px beside it, so the same window width leaves less
           room here — pin to 2 columns (SongSheet's own <520px rule still
           drops to 1) so measures never get clipped by the narrower shell. */
        .gig-song-editor .songsheet-measure-grid { grid-template-columns: repeat(2, minmax(210px, 1fr)) !important; }
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

function ghostBtn(theme) {
  return {
    display: "inline-flex", alignItems: "center", gap: "6px",
    padding: "5px 10px", borderRadius: "8px", cursor: "pointer", fontSize: "0.8rem",
    background: "transparent", color: theme.ink, border: `1px solid ${theme.line}`,
  }
}
function solidBtn(theme) {
  return {
    padding: "6px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem",
    background: theme.accent, color: theme.accentInk, border: `1px solid ${theme.accent}`,
  }
}
