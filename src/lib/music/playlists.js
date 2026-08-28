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
