// The unified song catalog — merges every place a chart lives (My Library,
// Gig Book, Tavern Set, Songbook forms) into one list with one shape, so
// every UI that browses songs (Gig Mode, the "/" picker, …) reads from the
// same place instead of each rolling its own pool.
//
// gigSongToBars / parseGigKey / gigTempoNumber (from gigbook.js) already
// work on any object shaped `{ sections: [{ name, chords }] }` — that's not
// Gig-Book-specific, it's just "a song written as named sections of chord
// strings" — so Tavern Set songs (same shape, see tavernSet.js) reuse them
// as-is rather than getting a parallel parser.

import { GIGBOOK_SONGS, gigSongToBars, parseGigKey, gigTempoNumber } from "./gigbook"
import { TAVERN_SET_SONGS } from "./tavernSet"
import { FORMS, FORM_NAMES } from "./forms"

// Fired to open the song library from anywhere — KeyboardShortcuts.jsx has
// no access to page.js's state, so "/" dispatches this instead of clicking
// a DOM button that may not exist on the current tab (same pattern as
// starters.js's LOAD_STARTER_EVENT).
export const OPEN_LIBRARY_EVENT = "dukebox:open-library"

// Fired by the "1" shortcut while a song is playing, to jump into Practice's
// Focus stage — same reasoning as OPEN_LIBRARY_EVENT above. Not song-catalog
// data, but colocated here rather than in a one-off file since it's fired
// and consumed by the same two places as OPEN_LIBRARY_EVENT.
export const ENTER_FOCUS_EVENT = "dukebox:enter-focus"

// Fired by the "2" shortcut to jump to Songbook (the Gig workspace).
// goWorkspace()'s usual DOM-click (find the [role="tab"] button, click it)
// can't reach it from Focus: Focus's phone-first stage renders none of the
// normal workspace chrome, so there's no tab button in the DOM to find.
// This bypasses that entirely.
export const GO_GIG_EVENT = "dukebox:go-gig"

// Fired by the "1" shortcut. Practice has two surfaces — the cockpit and the
// Focus stage — and clicking the tab lands on whichever one practiceView was
// left on, so "1" could take you INTO Focus rather than to Practice proper.
// This asks for the core view explicitly, and like GO_GIG_EVENT it works from
// inside Focus, where none of the usual tab chrome is rendered to click.
export const GO_PRACTICE_EVENT = "dukebox:go-practice"

// Leave the Focus stage without saying where to go next. Focus renders none
// of the normal workspace chrome, so a shortcut that navigates by clicking a
// [role="tab"] button finds nothing there and silently does nothing — which
// is how the Tonal and Reference digits behaved from inside Focus. Fire this
// first, then the tab exists to be clicked.
export const EXIT_FOCUS_EVENT = "dukebox:exit-focus"

// Home's "Most Popular" rail loads one specific catalog song by id — same
// cross-tree reasoning as LOAD_STARTER_EVENT, but by catalog id (any
// "user:"/"gig:"/"form:"/"tavern:" entry) instead of a fixed starter preset,
// since a most-played song can be any of those.
export const LOAD_SONG_EVENT = "dukebox:load-song"

export function requestLoadSong(id) {
  if (typeof window === "undefined" || !id) return
  window.dispatchEvent(new CustomEvent(LOAD_SONG_EVENT, { detail: id }))
}

// A Songbook form's `bars` are flat (one DukeBox bar per entry, no chord
// grouping); the catalog displays everything as named sections, so group
// consecutive bars sharing a `section` label the same way the stage chart
// does.
export function barsToSections(bars) {
  const out = []
  let cur = null
  for (const b of bars) {
    const name = b.section || "A"
    if (!cur || cur.name !== name) { cur = { name, chords: [] }; out.push(cur) }
    cur.chords.push(b.symbol)
  }
  return out
}

// Titles that exist in both the Gig Book and the Tavern Set (the latter's
// notes literally say "Carried over from the Rhino book intact") — keep the
// Gig Book copy, which carries the richer refArtist/credit metadata, and
// skip the duplicate rather than showing the same tune twice in search.
const gigBookTitles = new Set(GIGBOOK_SONGS.map((s) => s.title.trim().toLowerCase()))

// A My Library row's catalog entry — its own function (rather than inline
// in buildCatalog's loop) because GigMode also needs it right after a save,
// to reopen the fork it just created without waiting on a catalog rebuild.
export function userSongToCatalogEntry(s) {
  return {
    id: `user:${s.name}`, title: s.name, key: `${s.keyRoot || "C"} ${s.keyMode || "major"}`,
    tempo: s.tempo, source: "My Library", sections: barsToSections(s.bars || []), _user: s,
  }
}

/**
 * Build the full song catalog: one {id, title, key, tempo, source, sections,
 * bars()} entry per tune, from every source, in priority order (an entry
 * earlier in this list is what a duplicate title resolves to first).
 */
export function buildCatalog(userLibrarySongs = []) {
  const pool = []

  for (const s of userLibrarySongs) pool.push(userSongToCatalogEntry(s))

  for (const s of GIGBOOK_SONGS) {
    pool.push({
      id: `gig:${s.id}`, title: s.title, key: s.key, feel: s.feel, tempo: s.tempo,
      credit: s.credit, refArtist: s.refArtist, note: s.note, form: s.form,
      source: "Gig Book", sections: s.sections, _gig: s,
    })
  }

  for (const s of TAVERN_SET_SONGS) {
    if (gigBookTitles.has(s.title.trim().toLowerCase())) continue
    pool.push({
      id: `tavern:${s.id}`, title: s.title, key: s.key, feel: s.feel, tempo: s.tempo,
      credit: s.credit, refArtist: s.refArtist, note: s.note, form: s.form,
      lyrics: s.lyrics, songNotes: s.notes,
      source: "Tavern Set", sections: s.sections, _gig: s,
    })
  }

  for (const name of FORM_NAMES) {
    if (name === "Custom") continue
    const f = FORMS[name]
    if (!f?.bars?.length) continue
    pool.push({
      id: `form:${name}`, title: name, key: `${f.keyRoot} ${f.keyMode}`, tempo: f.tempo,
      source: "Songbook", sections: barsToSections(f.bars), _form: f,
    })
  }

  return pool
}

// Convert a catalog entry into DukeBox playback bars, regardless of which
// source it came from. Gig Book and Tavern Set entries share `_gig` because
// they share the same {sections} shape and the same conversion.
export function catalogEntryToBars(entry) {
  if (entry._gig) return gigSongToBars(entry._gig)
  if (entry._form) return entry._form.bars
  if (entry._user) return entry._user.bars
  return []
}

// Resolve a catalog entry's key/tempo into the fields the player state
// wants, same fallback order GigMode used inline before the catalog existed.
export function catalogEntryToPlayable(entry) {
  const bars = catalogEntryToBars(entry)
  const parsed = parseGigKey(entry.key)
  const keyRoot = entry._form?.keyRoot || entry._user?.keyRoot || parsed.keyRoot
  const keyMode = entry._form?.keyMode || entry._user?.keyMode || parsed.keyMode
  // A saved "treatment" (docs/SCALE_PATHWAYS.md): which Scale Pathways rung
  // this tune was saved at. Only My Library entries can carry one — the
  // built-in catalogs are shared data, not per-user rows — and the per-bar
  // scale picks that go with it ride along inside the bars themselves
  // (bar.userScale/userTonic), so they need nothing here.
  const meter = entry._form?.meter || entry._user?.meter || "4/4"
  return { bars, keyRoot, keyMode, tempo: gigTempoNumber(entry.tempo), meter, pathway: entry._user?.pathway ?? null }
}

// A SongSheet-shaped draft (title/bars/keyRoot/keyMode/tempo) seeded from any
// catalog entry — the starting point for editing a tune, whichever source it
// came from.
export function catalogEntryToDraft(entry) {
  const { bars, keyRoot, keyMode, tempo, meter } = catalogEntryToPlayable(entry)
  return { title: entry.title, bars, keyRoot, keyMode, tempo, meter, updatedAt: Date.now() }
}

/**
 * Write a SongSheet draft into My Library, keyed by title — the one save
 * path both the Create tab and the Gig library editor use. Built-in
 * catalog entries (Songbook/Gig Book/Tavern Set) aren't per-user rows, so
 * editing one can't update it in place: saving always writes/overwrites a
 * My Library entry with the draft's title, which is what "forks" a built-in
 * the first time you save an edit to it — buildCatalog()'s merge order (My
 * Library first) means that fork is what search and playback pick up next.
 * Returns the saved entry, or null if the draft has no title or no bars.
 */
export function upsertLibrarySong(setLibrary, draft) {
  const name = draft.title.trim()
  if (!name || !draft.bars?.length) return null
  const entry = {
    name,
    bars: draft.bars.map((bar) => ({ ...bar })),
    keyRoot: draft.keyRoot,
    keyMode: draft.keyMode,
    tempo: draft.tempo,
    meter: draft.meter || "4/4",
    updatedAt: Date.now(),
  }
  // Saving a "treatment" (docs/SCALE_PATHWAYS.md) stamps the Pathways rung
  // the tune was practised at; the per-bar overrides that complete it are
  // already inside draft.bars. Omitted entirely for an ordinary save, so
  // untouched entries keep their existing shape.
  if (draft.pathway) entry.pathway = { ...draft.pathway }
  setLibrary((lib) => ({ ...lib, songs: [...(lib.songs || []).filter((s) => s.name !== entry.name), entry] }))
  return entry
}
