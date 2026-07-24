// Importer for Bebop Blueprint user songs — parses the JSON stored under
// localStorage["userBebopProgressions"] in the Tonal app into DukeBox library
// entries. Format per song (from BB's saveCurrentProgression):
//   { displayName, defaultKey, description,
//     progression: ["Cmaj7 / G7", …],           // display strings
//     parts: [[{root, quality, scaleRoot, scaleType}, …], …],  // per measure
//     splitStatus: [bool, …] }

import { buildChordSymbol } from "./tonal"

const SHARP_TO_FLAT = {
  "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb",
  "B#": "C", "E#": "F", "Cb": "B", "Fb": "E",
}
const flat = (n) => SHARP_TO_FLAT[n] || n

// Bebop Blueprint quality value → DukeBox quality value.
// Colors DukeBox doesn't voice fall back to the nearest family so playback,
// analysis, and export all keep working (the ledger notes the coercion).
const QUALITY_MAP = {
  maj: "maj", major: "maj", maj7: "maj7", ma7: "maj7", maj6: "maj6", "6": "maj6",
  "69": "6/9", "6/9": "6/9", maj9: "maj9", "maj7#11": "maj7#11",
  min: "min", m: "min", min7: "min7", m7: "min7", min6: "min6", m6: "min6",
  min9: "min9", m9: "min9", minmaj7: "min(maj7)", mmaj7: "min(maj7)", imaj7: "min(maj7)",
  min7b5: "min7b5", m7b5: "min7b5",
  dim: "dim7", dim7: "dim7", o7: "dim7",
  dom7: "7", "7": "7", dom9: "9", "9": "9", dom13: "9", "13": "9",
  dom7sus: "7sus4", "7sus": "7sus4", "7sus4": "7sus4", sus4: "sus4", sus2: "sus4",
  dom7b9: "7b9", "7b9": "7b9",
  dom7alt: "7alt", "7alt": "7alt", alt: "7alt",
  dom7b5: "7alt", "dom7#9": "7alt", "7#9": "7alt", "7#11": "7alt", "7b13": "7alt",
  aug: "7", "+": "7",
}

// BB scaleType → Tonal.js scale name used by DukeBox's scaleNotes()
const SCALE_MAP = {
  major: "major", minor: "minor", dorian: "dorian", phrygian: "phrygian",
  lydian: "lydian", mixolydian: "mixolydian", locrian: "locrian",
  harmonicMinor: "harmonic minor", melodicMinor: "melodic minor",
  altered: "altered", lydianDominant: "lydian dominant",
  diminishedWH: "whole-half diminished", diminishedHW: "half-whole diminished",
  wholeTone: "whole tone", blues: "blues", majorBlues: "major blues",
  pentatonicMajor: "major pentatonic", pentatonicMinor: "minor pentatonic",
  bebopDominant: "bebop", bebopMajor: "bebop major", bebopDorian: "bebop minor",
  harmonicMajor: "harmonic major", doubleHarmonic: "double harmonic major",
  enigmatic: "enigmatic",
}

function mapQuality(q) {
  const key = String(q || "").trim()
  return QUALITY_MAP[key] ?? QUALITY_MAP[key.toLowerCase()] ?? "maj7"
}

function parseKey(defaultKey) {
  const k = String(defaultKey || "C").trim()
  const minor = /m$/.test(k) && !/dim$/.test(k)
  const root = flat(minor ? k.slice(0, -1) : k) || "C"
  return { keyRoot: root, keyMode: minor ? "minor" : "major" }
}

/**
 * Parse the pasted userBebopProgressions JSON.
 * @returns {{ entries: Array, warnings: string[] }}
 *   entries: DukeBox library entries { name, bars, keyRoot, keyMode, tempo }
 */
export function parseTonalUserSongs(jsonText) {
  const warnings = []
  let data
  try {
    data = JSON.parse(jsonText)
  } catch {
    throw new Error("Not valid JSON — paste the exact value of localStorage['userBebopProgressions'] from Bebop Blueprint.")
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Expected an object of saved songs keyed by name.")

  const entries = []
  for (const [name, song] of Object.entries(data)) {
    const parts = song?.parts
    if (!Array.isArray(parts) || !parts.length) {
      warnings.push(`"${name}": no measure data — skipped`)
      continue
    }
    const bars = []
    parts.forEach((measureParts, mi) => {
      const list = Array.isArray(measureParts) ? measureParts : []
      const split = song.splitStatus?.[mi] === true && list.length > 1
      list.forEach((part) => {
        const root = flat(String(part?.root || "").trim())
        if (!root) return
        const quality = mapQuality(part?.quality)
        const bar = { root, quality, symbol: buildChordSymbol(root, quality), section: "A" }
        if (split) bar.beats = 2
        // Preserve the saved per-bar scale choice when it maps cleanly
        const scale = SCALE_MAP[part?.scaleType]
        const scaleRoot = part?.scaleRoot ? flat(part.scaleRoot) : null
        if (scale) {
          bar.userScale = scale
          if (scaleRoot && scaleRoot !== root) bar.userTonic = scaleRoot
        }
        bars.push(bar)
      })
    })
    if (!bars.length) {
      warnings.push(`"${name}": no valid chords — skipped`)
      continue
    }
    const { keyRoot, keyMode } = parseKey(song.defaultKey)
    entries.push({
      name: song.displayName || name,
      bars, keyRoot, keyMode,
      tempo: Number(song.defaultTempo) || 120,
    })
  }
  if (!entries.length) throw new Error("No importable songs found." + (warnings.length ? ` (${warnings.join("; ")})` : ""))
  return { entries, warnings }
}
