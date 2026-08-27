// Exports chord progressions from the app's built-in catalogs — Songbook,
// Gig Book, Tavern Set — as one Markdown file. One-off tool for eyeballing
// the data, not part of the app build.
//
// My Library isn't included — those charts live in each user's browser
// storage or Supabase row, not in this repo, so there's nothing here to read.
//
// Usage:
//   node scripts/export-chord-progressions.mjs [options] [out.md]
//
//   --ids <a,b,c>   Restrict to these playlist ids (src/lib/music/
//                   playlists.js's BUILTIN_PLAYLISTS: songbook, gigbook,
//                   tavern, practice, easyjazz, gypsy, complex, rock).
//                   Default: every playlist.
//   --flat          One alphabetical list, no "## Playlist" sub-headings —
//                   for combining several playlists (e.g. the three jazz
//                   ones) into a single by-title sweep instead of grouped
//                   sections. Default: grouped, playlist order.
//   --title "..."   Custom H1. Default depends on --flat/--ids.
//
// No path (or "-") writes to stdout instead of a file.
//
// Examples:
//   node scripts/export-chord-progressions.mjs chord-progressions.md
//   node scripts/export-chord-progressions.mjs --ids easyjazz,gypsy,complex \
//     --flat --title "DukeBox Jazz Chord Progressions" jazz.md

import { register } from "node:module"
import { writeFileSync } from "node:fs"
register("./pathways-alias-loader.mjs", import.meta.url)

const { FORMS, FORM_NAMES } = await import("../src/lib/music/forms.js")
const { GIGBOOK_SONGS } = await import("../src/lib/music/gigbook.js")
const { TAVERN_SET_SONGS } = await import("../src/lib/music/tavernSet.js")
const { barsToSections } = await import("../src/lib/music/songSource.js")
const { BUILTIN_PLAYLISTS, playlistTagFor } = await import("../src/lib/music/playlists.js")

// ─── CLI ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
let idsFilter = null, flat = false, titleOverride = null, dest = null
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === "--ids") idsFilter = new Set(args[++i].split(",").map((s) => s.trim()).filter(Boolean))
  else if (a === "--flat") flat = true
  else if (a === "--title") titleOverride = args[++i]
  else if (!a.startsWith("--")) dest = a
}
if (idsFilter) {
  const known = new Set(BUILTIN_PLAYLISTS.map((p) => p.id))
  for (const id of idsFilter) {
    if (!known.has(id)) {
      console.error(`Unknown playlist id "${id}". Known: ${[...known].join(", ")}`)
      process.exit(1)
    }
  }
}

// ─── Build one flat pool, matching buildCatalog()'s entries closely enough
// for playlistTagFor (needs .id and .source) and for printing (title, key,
// tempo, sections). Gig Book / Tavern Set duplicate-title skip mirrors
// songSource.js's buildCatalog. ───────────────────────────────────────────
const gigBookTitles = new Set(GIGBOOK_SONGS.map((s) => s.title.trim().toLowerCase()))

const pool = []
for (const s of GIGBOOK_SONGS) {
  pool.push({
    id: `gig:${s.id}`, title: s.title, key: s.key, tempo: s.tempo,
    credit: s.credit, refArtist: s.refArtist, form: s.form,
    source: "Gig Book", sections: s.sections,
  })
}
for (const s of TAVERN_SET_SONGS) {
  if (gigBookTitles.has(s.title.trim().toLowerCase())) continue
  pool.push({
    id: `tavern:${s.id}`, title: s.title, key: s.key, tempo: s.tempo,
    credit: s.credit, refArtist: s.refArtist, form: s.form,
    source: "Tavern Set", sections: s.sections,
  })
}
for (const name of FORM_NAMES) {
  if (name === "Custom") continue
  const f = FORMS[name]
  if (!f?.bars?.length) continue
  pool.push({
    id: `form:${name}`, title: name, key: `${f.keyRoot} ${f.keyMode}`, tempo: f.tempo,
    source: "Songbook", sections: barsToSections(f.bars),
  })
}

// ─── Group by playlist tag (exclusive — a Songbook form's category slice
// wins over the bare "Songbook" source tag, exactly like the Gig tab's card
// color). "recent" (Latest 10 Played) has no fixed membership, so it's
// always skipped — every tune it could show is already filed under its
// real tag. "mine" (My Library) is skipped too — nothing in this repo to
// tag. --ids narrows which of the rest actually make it into the doc. ────
const wantIds = new Set(
  (idsFilter ?? BUILTIN_PLAYLISTS.map((p) => p.id).filter((id) => id !== "recent" && id !== "mine"))
)
const byPlaylist = new Map([...wantIds].map((id) => [id, []]))
const unfiled = []
for (const song of pool) {
  const tag = playlistTagFor(song)
  if (tag && byPlaylist.has(tag.id)) byPlaylist.get(tag.id).push(song)
  else if (!idsFilter) unfiled.push(song) // only meaningful sweeping the whole catalog
}

// ─── Render ──────────────────────────────────────────────────────────────
function chordLine(sections) {
  return sections.map((sec) => `**${sec.name}:** ${sec.chords.join(" · ")}`).join("  \n")
}

function renderSong(s, lines) {
  const barCount = s.sections.reduce((n, sec) => n + sec.chords.length, 0)
  // s.form (Gig Book / Tavern Set only) is a free-text structure label like
  // "AABA, 32 bars" or "16 bars, folk form" — the bar count in it is
  // redundant with barCount below (computed from the actual chord data, so
  // it's the one to trust if they ever disagree), so only the structural
  // comma-segments survive here.
  const formLabel = s.form
    ?.split(",").map((seg) => seg.trim()).filter((seg) => seg && !/^\d+\s*bars?$/i.test(seg)).join(", ")
    || null
  const meta = [s.key, s.tempo ? `♩ ${s.tempo}` : null, formLabel, s.refArtist].filter(Boolean).join(" · ")
  lines.push(`### ${s.title}${s.credit ? ` — *${s.credit}*` : ""}`)
  lines.push(`*${s.source} · ${meta} · ${barCount} bars*`)
  lines.push("")
  lines.push(chordLine(s.sections))
  lines.push("")
  return barCount
}

const playlistLabel = (id) => BUILTIN_PLAYLISTS.find((p) => p.id === id)?.label ?? id
const defaultTitle = idsFilter
  ? `DukeBox Chord Progressions — ${[...wantIds].map(playlistLabel).join(", ")}`
  : "DukeBox Chord Progressions, by Playlist"

const lines = []
lines.push(`# ${titleOverride ?? defaultTitle}`)
lines.push("")
lines.push(`Generated ${new Date().toISOString().slice(0, 10)} from the app's built-in catalogs (Songbook, Gig Book, Tavern Set).`)
lines.push("My Library isn't included — those charts live per-user, not in this repo.")
lines.push("")
if (flat) {
  lines.push("Every tune from the selected playlists, alphabetical, no sub-grouping — one sweep to check " +
    "chords against what you know the tune to be. Anything that reads wrong here is wrong on the fretboard too.")
} else {
  lines.push("Grouping matches the Gig tab's colored cards: each tune is filed under the one playlist that " +
    "actually owns it (a Songbook form's category — Practice, Easy Jazz, etc. — wins over the bare " +
    "\"Songbook\" tag; a source wins when there's no category). Check chords against what you know the tune " +
    "to be — anything that reads wrong here is wrong on the fretboard too.")
}
lines.push("")

let totalSongs = 0
let totalBars = 0

if (flat) {
  const all = [...byPlaylist.values()].flat()
  all.sort((a, b) => a.title.localeCompare(b.title))
  for (const s of all) { totalSongs++; totalBars += renderSong(s, lines) }
} else {
  for (const p of BUILTIN_PLAYLISTS) {
    if (!wantIds.has(p.id)) continue
    const songs = byPlaylist.get(p.id)
    if (!songs.length) continue
    songs.sort((a, b) => a.title.localeCompare(b.title))
    lines.push(`## ${p.label} (${songs.length})`)
    lines.push("")
    for (const s of songs) { totalSongs++; totalBars += renderSong(s, lines) }
  }
}

if (unfiled.length) {
  lines.push(`## Unfiled (${unfiled.length})`)
  lines.push("")
  lines.push("_Matched no playlist above — flag if this looks like a data gap._")
  lines.push("")
  for (const s of unfiled) { totalSongs++; totalBars += renderSong(s, lines) }
}

lines.push("---")
lines.push(`*${totalSongs} songs, ${totalBars} bars total.*`)

const out = lines.join("\n") + "\n"
if (dest && dest !== "-") { writeFileSync(dest, out); console.error(`Wrote ${dest} (${totalSongs} songs, ${totalBars} bars)`) }
else process.stdout.write(out)
