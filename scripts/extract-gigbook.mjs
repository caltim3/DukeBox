// One-time extraction: parse Jupiter's read-only rhino-gig-book.html into a
// DukeBox data module. Jupiter is never modified — this only reads the file.
import { readFileSync, writeFileSync } from "fs"

const SRC = "/home/user/jupiter/client/public/rhino-gig-book.html"
const OUT = "/home/user/DukeBox/src/lib/music/gigbook.js"
const html = readFileSync(SRC, "utf8")

const decode = (s) => s
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ")
  .trim()

// Reference-artist + feel lookup from the setlist table (keyed by song slug)
const refByHref = {}
const feelByHref = {}
for (const row of html.matchAll(/<tr><td>\d+<\/td><td><a href="#([^"]+)">[^<]*<\/a><\/td><td>[^<]*<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g)) {
  feelByHref[row[1]] = decode(row[2])
  refByHref[row[1]] = decode(row[3])
}

// Split out each <section class="song ..." id="slug"> … </section>
const songs = []
const sectionRe = /<section class="song[^"]*" id="([^"]+)">([\s\S]*?)<\/section>/g
let m
while ((m = sectionRe.exec(html)) !== null) {
  const id = m[1]
  const body = m[2]

  const grab = (re) => { const x = body.match(re); return x ? decode(x[1]) : "" }
  const title  = grab(/<h2[^>]*data-store="[^"]*-title"[^>]*>([\s\S]*?)<\/h2>/)
  const credit = grab(/data-store="[^"]*-credit"[^>]*>([\s\S]*?)<\/div>/)
  const key    = grab(/data-initial-key="([^"]*)"/) || grab(/data-key-store="[^"]*"[^>]*>([\s\S]*?)<\/select>/)
  const feel   = grab(/data-store="[^"]*-feel"[^>]*>([\s\S]*?)<\/span>/) || feelByHref[id] || ""
  const tempo  = grab(/data-store="[^"]*-tempo"[^>]*>([\s\S]*?)<\/span>/)
  const form   = grab(/data-store="[^"]*-form"[^>]*>([\s\S]*?)<\/span>/)
  const note   = grab(/data-store="[^"]*-note"[^>]*>([\s\S]*?)<\/div>/)
  const number = grab(/class="song-number"[^>]*>([\s\S]*?)<\/div>/)

  // Walk the grid-wrap: alternating section-label + chord-grid.
  const grid = body.match(/<div class="grid-wrap">([\s\S]*?)<\/div>\s*(?:<div class="gig-upgrades|<div class="lead-area|<\/section)/)
  const gridBody = grid ? grid[1] : body

  const sections = []
  let cur = null
  const tokenRe = /<div class="section-label([^"]*)"[^>]*>([\s\S]*?)<\/div>|<div class="chord"[^>]*>([\s\S]*?)<\/div>/g
  let t
  while ((t = tokenRe.exec(gridBody)) !== null) {
    if (t[2] !== undefined) {
      // section label (t[1] carries extra classes like " bridge")
      cur = { name: decode(t[2]) || "—", chords: [] }
      sections.push(cur)
    } else if (t[3] !== undefined) {
      if (!cur) { cur = { name: "A", chords: [] }; sections.push(cur) }
      const chord = decode(t[3])
      if (chord) cur.chords.push(chord)
    }
  }

  // Skip anything with no chords (defensive)
  const totalChords = sections.reduce((n, s) => n + s.chords.length, 0)
  if (!totalChords) continue

  songs.push({
    id, number, title, credit, key, feel, tempo, form, note,
    refArtist: refByHref[id] || "",
    sections,
  })
}

const banner = `// AUTO-GENERATED from Jupiter's Rhino Gig Book (rhino-gig-book.html).
// Do not hand-edit — regenerate with scripts/extract-gigbook.mjs.
// Jupiter is read-only; this is a one-time import into DukeBox's schema.
// ${songs.length} songs, ${songs.reduce((n, s) => n + s.sections.reduce((k, x) => k + x.chords.length, 0), 0)} bars.

import { buildChordSymbol } from "./tonal"

export const GIGBOOK_SONGS = ${JSON.stringify(songs, null, 2)}

// Sharp→flat spelling to match DukeBox's flat-preferred roots.
const EH = { "C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb","B#":"C","Cb":"B","Fb":"E","E#":"F" }

// Map a written chord symbol's suffix to a DukeBox quality value.
function gigQuality(suffix) {
  const s = (suffix || "").trim()
  if (!s) return "maj"
  if (/^maj7|^ma7|^M7|^\\u0394/.test(s)) return "maj7"
  if (/^maj9/.test(s)) return "maj9"
  if (/^(6\\/9|69)/.test(s)) return "6/9"
  if (/^maj6|^6/.test(s)) return "maj6"
  if (/^m6|^min6|^-6/.test(s)) return "min6"
  if (/^(m7b5|min7b5|\\u00f8)/.test(s)) return "min7b5"
  if (/^(dim7|dim|\\u00b07|\\u00b0|o7)/.test(s)) return "dim7"
  if (/^(m\\(maj7\\)|mM7|minmaj7|mmaj7)/.test(s)) return "min(maj7)"
  if (/^m9|^min9|^-9/.test(s)) return "min9"
  if (/^m11|^m13/.test(s)) return "min9"
  if (/^(madd9|m\\(add9\\))/.test(s)) return "minadd9"
  if (/^(m7|min7|-7|m|min|-)/.test(s)) return "min7"
  if (/^(7alt|alt|7#9|7#5|7b5|7#11)/.test(s)) return "7alt"
  if (/^7b9/.test(s)) return "7b9"
  if (/^(7sus4|7sus)/.test(s)) return "7sus4"
  if (/^(sus4|sus2|sus)/.test(s)) return "sus4"
  if (/^add9/.test(s)) return "add9"
  if (/^9/.test(s)) return "9"
  if (/^(7|13|11)/.test(s)) return "7"
  return "maj7"
}

// Parse one written chord (e.g. "Am7/G", "D7/Gb", "Cmaj7") into a DukeBox bar.
export function parseGigChord(text, section = "A", beats = 4) {
  const raw = String(text || "").trim()
  if (!raw || raw === "%" || raw === "/") return null
  const slash = raw.split("/")
  const head = slash[0]
  const bassRaw = slash[1]
  const rm = head.match(/^([A-G][b#]?)/)
  if (!rm) return null
  const root = EH[rm[1]] || rm[1]
  const quality = gigQuality(head.slice(rm[1].length))
  let bass
  if (bassRaw) {
    const bm = bassRaw.match(/^([A-G][b#]?)/)
    if (bm) bass = EH[bm[1]] || bm[1]
  }
  let symbol = buildChordSymbol(root, quality)
  if (bass && bass !== root) symbol += \`/\${bass}\`
  const bar = { root, quality, symbol, section, beats }
  if (bass && bass !== root) bar.bass = bass
  return bar
}

// Convert a Gig Book song into DukeBox playback bars (one chord = one bar).
export function gigSongToBars(song) {
  const bars = []
  for (const sec of song.sections) {
    for (const chord of sec.chords) {
      const bar = parseGigChord(chord, sec.name)
      if (bar) bars.push(bar)
    }
  }
  return bars
}

export const GIGBOOK_SONG_NAMES = GIGBOOK_SONGS.map(s => s.title)
`

writeFileSync(OUT, banner)
console.log(`Wrote ${songs.length} songs to ${OUT}`)
for (const s of songs) {
  const n = s.sections.reduce((k, x) => k + x.chords.length, 0)
  console.log(`  ${s.number || "--"} ${s.title} — ${s.key} · ${s.sections.length} sections, ${n} bars`)
}
