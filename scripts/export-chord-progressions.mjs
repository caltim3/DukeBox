// Exports every chord progression in the app's built-in catalogs — Songbook,
// Gig Book, Tavern Set — as one Markdown file, organized the same way the
// Gig tab's colored cards are: by the playlist that owns the tune (see
// src/lib/music/playlists.js's playlistTagFor). One-off tool for eyeballing
// the data, not part of the app build.
//
// My Library isn't included — those charts live in each user's browser
// storage or Supabase row, not in this repo, so there's nothing here to read.
//
// Usage: node scripts/export-chord-progressions.mjs > out.md
//    or: node scripts/export-chord-progressions.mjs path/to/out.md

import { register } from "node:module"
import { writeFileSync } from "node:fs"
register("./pathways-alias-loader.mjs", import.meta.url)

const { FORMS, FORM_NAMES, FORM_CATEGORIES } = await import("../src/lib/music/forms.js")
const { GIGBOOK_SONGS } = await import("../src/lib/music/gigbook.js")
const { TAVERN_SET_SONGS } = await import("../src/lib/music/tavernSet.js")
const { barsToSections } = await import("../src/lib/music/songSource.js")
const { BUILTIN_PLAYLISTS, playlistTagFor } = await import("../src/lib/music/playlists.js")

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
// color). Order follows BUILTIN_PLAYLISTS, i.e. the same order as the Gig
// tab's pill row. "recent" (Latest 10 Played) has no fixed membership, so
// it's skipped — every tune it could show is already filed under its real
// tag below. ─────────────────────────────────────────────────────────────
const sections = new Map(BUILTIN_PLAYLISTS.filter((p) => !p.recent && p.id !== "mine").map((p) => [p.id, []]))
const unfiled = []
for (const song of pool) {
  const tag = playlistTagFor(song)
  if (tag && sections.has(tag.id)) sections.get(tag.id).push(song)
  else unfiled.push(song)
}

// ─── Render ──────────────────────────────────────────────────────────────
function chordLine(sections) {
  return sections.map((sec) => `**${sec.name}:** ${sec.chords.join(" · ")}`).join("  \n")
}

const lines = []
lines.push("# DukeBox Chord Progressions, by Playlist")
lines.push("")
lines.push(`Generated ${new Date().toISOString().slice(0, 10)} from the app's built-in catalogs (Songbook, Gig Book, Tavern Set).`)
lines.push("My Library isn't included — those charts live per-user, not in this repo.")
lines.push("")
lines.push("Grouping matches the Gig tab's colored cards: each tune is filed under the one playlist that " +
  "actually owns it (a Songbook form's category — Practice, Easy Jazz, etc. — wins over the bare " +
  "\"Songbook\" tag; a source wins when there's no category). Check chords against what you know the tune " +
  "to be — anything that reads wrong here is wrong on the fretboard too.")
lines.push("")

let totalSongs = 0
let totalBars = 0
for (const p of BUILTIN_PLAYLISTS) {
  if (p.recent || p.id === "mine") continue
  const songs = sections.get(p.id)
  if (!songs.length) continue
  songs.sort((a, b) => a.title.localeCompare(b.title))
  lines.push(`## ${p.label} (${songs.length})`)
  lines.push("")
  for (const s of songs) {
    const barCount = s.sections.reduce((n, sec) => n + sec.chords.length, 0)
    totalSongs++; totalBars += barCount
    // s.form (Gig Book / Tavern Set only) is a free-text structure label like
    // "AABA, 32 bars" or "16 bars, folk form" — the bar count in it is
    // redundant with barCount below (computed from the actual chord data,
    // so it's the one to trust if they ever disagree), so only the
    // structural comma-segments survive here.
    const formLabel = s.form
      ?.split(",").map((seg) => seg.trim()).filter((seg) => seg && !/^\d+\s*bars?$/i.test(seg)).join(", ")
      || null
    const meta = [s.key, s.tempo ? `♩ ${s.tempo}` : null, formLabel, s.refArtist].filter(Boolean).join(" · ")
    lines.push(`### ${s.title}${s.credit ? ` — *${s.credit}*` : ""}`)
    lines.push(`*${s.source} · ${meta} · ${barCount} bars*`)
    lines.push("")
    lines.push(chordLine(s.sections))
    lines.push("")
  }
}

if (unfiled.length) {
  lines.push(`## Unfiled (${unfiled.length})`)
  lines.push("")
  lines.push("_Matched no playlist above — flag if this looks like a data gap._")
  lines.push("")
  for (const s of unfiled) {
    const barCount = s.sections.reduce((n, sec) => n + sec.chords.length, 0)
    totalSongs++; totalBars += barCount
    lines.push(`### ${s.title}`)
    lines.push(`*${s.source} · ${s.key} · ${barCount} bars*`)
    lines.push("")
    lines.push(chordLine(s.sections))
    lines.push("")
  }
}

lines.push("---")
lines.push(`*${totalSongs} songs, ${totalBars} bars total.*`)

const out = lines.join("\n") + "\n"
const dest = process.argv[2]
if (dest) { writeFileSync(dest, out); console.error(`Wrote ${dest} (${totalSongs} songs, ${totalBars} bars)`) }
else process.stdout.write(out)
