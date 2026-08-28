// Built-in "smart" playlists for the Gig songbook — read-only groupings
// layered on top of the merged catalog (songSource.js's buildCatalog()),
// offered in the same dropdown/pills as the user's own hand-built setlists.
//
// Five of these don't need a new grouping at all: every Songbook form
// already carries a category in forms.js's FORM_CATEGORIES (that's the
// "list" they're identified by — the same one MelodyPaths' song picker
// already reads), so "Gypsy Jazz" etc. are just named slices of it.

import { FORM_CATEGORIES } from "./forms"

const idsFromCategories = (...cats) =>
  new Set(cats.flatMap((c) => FORM_CATEGORIES[c] || []).map((title) => `form:${title}`))

export const BUILTIN_PLAYLISTS = [
  { id: "songbook", label: "Songbook",     match: (s) => s.source === "Songbook" },
  { id: "gigbook",  label: "Gig Book",     match: (s) => s.source === "Gig Book" },
  { id: "tavern",   label: "Tavern Set",   match: (s) => s.source === "Tavern Set" },
  { id: "recent",   label: "Latest 10 Played", recent: true },
  { id: "practice", label: "Practice",     ids: () => idsFromCategories("Practice") },
  { id: "easyjazz", label: "Easy Jazz",    ids: () => idsFromCategories("Easy Standards") },
  { id: "gypsy",    label: "Gypsy Jazz",   ids: () => idsFromCategories("Gypsy Jazz") },
  { id: "complex",  label: "Complex Jazz", ids: () => idsFromCategories("Jazz Standards", "Bebop") },
  { id: "rock",     label: "Rock",         ids: () => idsFromCategories("Rock & Pop") },
  { id: "sonoranoir", label: "Sonora Noir", ids: () => idsFromCategories("Sonora Noir") },
  { id: "mine",     label: "My Songs",     match: (s) => s.source === "My Library" },
]

// Resolve one dropdown/pill value into the songs it names.
//   ""                 → null (no filter — "All tunes")
//   `playlist:<id>`     → a built-in playlist above (read-only)
//   `setlist:<id>`      → a user setlist (editable — drag to reorder, etc.)
//
// `pool`/`poolById` come from buildCatalog(); `recentlyPlayedIds` from
// library.prefs.recentlyPlayedIds (most-recent-first, written by page.js's
// loadSong whenever a catalog tune is actually played).
export function resolveActiveList(value, { pool, poolById, setlists, recentlyPlayedIds }) {
  if (!value) return null

  if (value.startsWith("setlist:")) {
    const id = value.slice("setlist:".length)
    const setlist = (setlists || []).find((s) => s.id === id)
    if (!setlist) return null
    return { editable: true, setlist, songs: setlist.songIds.map((sid) => poolById[sid]).filter(Boolean) }
  }

  if (value.startsWith("playlist:")) {
    const id = value.slice("playlist:".length)
    const playlist = BUILTIN_PLAYLISTS.find((p) => p.id === id)
    if (!playlist) return null
    let songs
    if (playlist.recent) {
      songs = (recentlyPlayedIds || []).map((sid) => poolById[sid]).filter(Boolean)
    } else if (playlist.ids) {
      const idSet = playlist.ids()
      songs = (pool || []).filter((s) => idSet.has(s.id))
    } else {
      songs = (pool || []).filter(playlist.match)
    }
    return { editable: false, playlist, songs }
  }

  return null
}

// ─── Playlist colors ────────────────────────────────────────────────────────
// A card's color says which playlist it belongs to, so "All tunes" reads as
// grouped rather than as 153 identical rectangles. The playlists above split
// into two kinds that between them cover every tune exactly once: the
// source-based ones (Gig Book / Tavern Set / My Songs) and the five category
// slices of the Songbook (a form belongs to exactly one FORM_CATEGORY). So a
// tune's color is never ambiguous. "Latest 10 Played" gets none — it cuts
// across all of them, and a tune doesn't stop being a Gig Book tune because
// you played it recently.
//
// Fixed hues rather than palette tokens, for the same reason the fretboard's
// note roles are fixed: the grouping should look the same whichever theme
// you're in. They're only ever used through color-mix at low percentages
// (see the grid cards), so they read as a tint in light mode and a wash in
// dark, never as a block of color.
const PLAYLIST_HUES = {
  practice: "#2F7D7B",
  easyjazz: "#4A7C59",
  gypsy:    "#A9732B",
  complex:  "#4C5FA8",
  rock:     "#A3503C",
  songbook: "#5C6B80",
  gigbook:  "#6E4B8E",
  tavern:   "#7A6A3A",
  mine:     "#A34A6B",
}

export function playlistHue(id) {
  return PLAYLIST_HUES[id] ?? null
}

// id → the category-slice playlists, resolved once. Module-level rather than
// per-call: FORM_CATEGORIES is static, and this runs for every card.
let _sliceIndex = null
function sliceIndex() {
  if (_sliceIndex) return _sliceIndex
  _sliceIndex = new Map()
  for (const p of BUILTIN_PLAYLISTS) {
    if (!p.ids) continue
    for (const id of p.ids()) _sliceIndex.set(id, p.id)
  }
  return _sliceIndex
}

const SOURCE_PLAYLIST = {
  "Gig Book": "gigbook",
  "Tavern Set": "tavern",
  "My Library": "mine",
  Songbook: "songbook",
}

/**
 * Which playlist owns this tune, for coloring — its Songbook category first
 * (the more specific answer), then its source. Returns {id, label, hue} or
 * null for anything unclassified.
 */
export function playlistTagFor(song) {
  if (!song) return null
  const id = sliceIndex().get(song.id) ?? SOURCE_PLAYLIST[song.source]
  if (!id) return null
  const playlist = BUILTIN_PLAYLISTS.find((p) => p.id === id)
  return { id, label: playlist?.label ?? song.source, hue: PLAYLIST_HUES[id] ?? null }
}
