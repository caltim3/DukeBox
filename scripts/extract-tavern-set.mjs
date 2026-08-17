// One-time extraction: parse the standalone Tavern Set reference page
// (public/reference/tavern-set.html) into a DukeBox data module, the same
// way scripts/extract-gigbook.mjs pulled Jupiter's Rhino Gig Book in.
//
// The source page is untouched by this script — it only reads it. Run with:
//   node scripts/extract-tavern-set.mjs
import { readFileSync, writeFileSync } from "fs"

const SRC = new URL("../public/reference/tavern-set.html", import.meta.url)
const OUT = new URL("../src/lib/music/tavernSet.js", import.meta.url)
const html = readFileSync(SRC, "utf8")

const decode = (s) => s
  .replace(/&amp;amp;/g, "&").replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ")
  .replace(/<[^>]+>/g, "")   // strip any inner markup (e.g. a stray <p> in notes)
  .trim()

// Split out each <article class="song" id="slug">…</article>
const songs = []
const articleRe = /<article class="song" id="([^"]+)">([\s\S]*?)<\/article>/g
let m
while ((m = articleRe.exec(html)) !== null) {
  const id = m[1]
  const body = m[2]

  const field = (name, tag) => {
    const re = new RegExp(`<${tag}[^>]*data-store="${id}-${name}"[^>]*>([\\s\\S]*?)<\\/${tag}>`)
    const x = body.match(re)
    return x ? decode(x[1]) : ""
  }

  const title  = field("title", "h2")
  const credit = field("credit", "div")
  const key    = field("key", "span")
  const feel   = field("feel", "span")
  const tempo  = field("tempo", "span")
  const form   = field("form", "span")
  const note   = field("note", "div")
  const lyrics = field("lyrics", "div")
  const notes  = field("notes", "div")
  const numberRaw = body.match(/class="song-number"[^>]*>([\s\S]*?)<\/div>/)
  const number = numberRaw ? decode(numberRaw[1]).replace(/\D/g, "").padStart(2, "0") : ""

  // Same technique as extract-gigbook.mjs: walk section-label + chord tokens
  // in document order. This ignores the .grid-wrap/.chord-grid wrapper divs
  // around them (they don't match either alternative), so it doesn't need to
  // balance nested <div> tags to find each section's boundary.
  const sections = []
  let cur = null
  const tokenRe = /<div class="section-label[^"]*"[^>]*>([\s\S]*?)<\/div>|<div class="chord"[^>]*>([\s\S]*?)<\/div>/g
  let t
  while ((t = tokenRe.exec(body)) !== null) {
    if (t[1] !== undefined) {
      cur = { name: decode(t[1]) || "—", chords: [] }
      sections.push(cur)
    } else if (t[2] !== undefined) {
      if (!cur) { cur = { name: "A", chords: [] }; sections.push(cur) }
      const chord = decode(t[2])
      if (chord) cur.chords.push(chord)
    }
  }

  // Blank charts ("Alli Como Aya" — chart me) keep their empty sections
  // rather than being dropped: they're intentionally waiting to be filled
  // in, not extraction failures.
  songs.push({ id, number, title, credit, key, feel, tempo, form, note, refArtist: "", sections, lyrics, notes })
}

const banner = `// AUTO-GENERATED from the standalone Tavern Set reference page
// (public/reference/tavern-set.html). Do not hand-edit — regenerate with
// scripts/extract-tavern-set.mjs. That page is retired once this ships; this
// is the one-time import of its ${songs.length} tunes into DukeBox's schema.
// lyrics/notes are carried along for future display but are not consumed by
// gigSongToBars — only sections/chords feed playback.

export const TAVERN_SET_SONGS = ${JSON.stringify(songs, null, 2)}

export const TAVERN_SET_SONG_NAMES = TAVERN_SET_SONGS.map(s => s.title)
`

writeFileSync(OUT, banner)
console.log(`Wrote ${songs.length} songs to ${OUT.pathname}`)
