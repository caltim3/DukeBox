// One-time transform: convert explicit maj7 -> plain major triad and
// m7/min7 -> plain minor triad in chord strings, leaving dominant 7ths
// (G7, D9, etc.) and every other quality (6, m6, sus, dim, add9, alt...)
// untouched. Scoped to exactly the "Singing" set titles the user confirmed
// (the Tavern Set screenshots stopped at "The House Where Nobody Lives" —
// everything after that is the "Guitar Only" jazz-standards section and is
// deliberately NOT touched).
import { readFileSync, writeFileSync } from "fs"

const PATH = "/Users/tmac/projects/DukeBox/src/lib/music/tavernSet.js"
const src = readFileSync(PATH, "utf8")

const startMarker = "export const TAVERN_SET_SONGS = "
const start = src.indexOf(startMarker) + startMarker.length
const endMarker = "\n\nexport const TAVERN_SET_SONG_NAMES"
const end = src.indexOf(endMarker)
const banner = src.slice(0, src.indexOf(startMarker))
const jsonText = src.slice(start, end)
const tail = src.slice(end)

const songs = JSON.parse(jsonText)

const ALLOWED_TITLES = new Set([
  "Horse with No Name", "Ventura Highway", "Shambala", "Magnolia Mountain",
  "Dead Flowers", "Telephone Call from Istanbul", "Shady Grove",
  "Where Did You Sleep Last Night", "Friend of the Devil",
  "That'll Never Happen No More", "Erie Canal",
  "Nobody Knows You When You're Down and Out", "Rivers of Babylon",
  "Why Modern Radio is A-OK", "Loser", "Black Magic Woman", "Althea",
  "California Stars", "Passenger Side", "Oh My Sweet Carolina", "Acuff-Rose",
  "Let It Ride", "Faithless Street", "Key to the Highway",
  "I Hope That I Don't Fall in Love With You", "Jockey Full of Bourbon",
  "Aurora En Pekin", "The House Where Nobody Lives",
])

function convertToken(tok) {
  const slash = tok.split("/")
  const head = slash[0]
  const bassPart = slash.length > 1 ? "/" + slash.slice(1).join("/") : ""
  const m = head.match(/^([A-G][b#]?)(.*)$/)
  if (!m) return tok
  const root = m[1]
  const suffix = m[2]
  if (/^(maj7|Maj7|MAJ7|M7|ma7|Δ)$/.test(suffix)) return root + bassPart
  if (/^(m7|min7|-7|Min7|MIN7)$/.test(suffix)) return root + "m" + bassPart
  return tok
}

function convertCell(cell) {
  return cell.split(/\s+/).map(convertToken).join(" ")
}

let changedChords = 0
const changedSongs = new Set()
const seen = new Set()
for (const song of songs) {
  if (!ALLOWED_TITLES.has(song.title)) continue
  seen.add(song.title)
  for (const sec of song.sections) {
    sec.chords = sec.chords.map((c) => {
      const next = convertCell(c)
      if (next !== c) { changedChords++; changedSongs.add(song.title) }
      return next
    })
  }
}

const missing = [...ALLOWED_TITLES].filter((t) => !seen.has(t))
if (missing.length) console.log("WARNING — titles not found in data:", missing)

writeFileSync(PATH, banner + startMarker + JSON.stringify(songs, null, 2) + tail)
console.log(`Converted ${changedChords} chords across ${changedSongs.size} songs (of ${ALLOWED_TITLES.size} allowed).`)
console.log([...changedSongs].sort().join("\n"))
