// Improv Guide markdown export — ported from Bebop Blueprint
// (buildImprovGuideMarkdown and its helpers), adapted to DukeBox's bar model.
// Produces: summary table, lead-sheet map, the 5-level system explainer,
// a chord-by-chord roadmap, and two Forward Motion drills.

import { Note } from "@tonaljs/tonal"
import { guideTones, getRecommendedScalesFromQuality, scaleNotes } from "./tonal"

const CHROMATIC = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"]

function T(root, semis) {
  const c = Note.chroma(root)
  if (c == null) return root
  return CHROMATIC[(c + semis + 12) % 12]
}

// Quality family helpers over DukeBox quality names
function isDominant(q) {
  const s = String(q || "").toLowerCase()
  return (s.includes("7") || s.includes("9") || s.includes("13") || s.includes("alt"))
    && !s.startsWith("maj") && !s.startsWith("min") && !(s.startsWith("m") && !s.startsWith("maj"))
}
function isAlteredDom(q) {
  const s = String(q || "").toLowerCase()
  return isDominant(s) && (s.includes("alt") || s.includes("b9") || s.includes("#9"))
}
function isMinor(q) {
  const s = String(q || "").toLowerCase()
  return s.startsWith("min") || (s.startsWith("m") && !s.startsWith("maj"))
}
function isMajor(q) {
  const s = String(q || "").toLowerCase()
  return s.startsWith("maj") || s === "6/9" || s === "add9" || s === "sus4" || s === ""
}

// True when `bar` is dominant-ish and resolves up a perfect 4th to `next`
function isDominantToNext(bar, next) {
  if (!bar || !next || !isDominant(bar.quality)) return false
  const a = Note.chroma(bar.root), b = Note.chroma(next.root)
  if (a == null || b == null) return false
  return (b - a + 12) % 12 === 5
}

// "Triads over the chord" suggestions (Randy Vincent-style)
function triadsForBar(bar) {
  const r = bar.root, q = bar.quality
  if (q === "min7b5") return [
    `${r} diminished triad (1-b3-b5)`,
    `${T(r, 3)} minor triad (b3-b5-b7)`,
    `${T(r, 10)} major triad (b7-9-11)`,
  ]
  if (q === "dim7") return [
    `${r} diminished triad + symmetric dim7 arpeggio`,
    `Any note in the dim7 can be treated as root (symmetry)`,
  ]
  if (isMinor(q)) return [
    `${r} minor triad (1-b3-5)`,
    `${T(r, 3)} major triad (b3-5-b7)`,
    `${T(r, 7)} minor triad (5-b7-9)`,
  ]
  if (isDominant(q)) return [
    `${r} major triad (1-3-5)`,
    `${T(r, 4)} diminished triad (3-5-b7)`,
    `${T(r, 7)} minor triad (5-b7-9)`,
    `Upper-structure: ${T(r, 1)} major (b9-3-b5) or ${T(r, 6)} major (#11-13-1)`,
  ]
  if (isMajor(q)) return [
    `${r} major triad (1-3-5)`,
    `${T(r, 4)} minor triad (3-5-7)`,
    `${T(r, 9)} minor triad (6-1-3)`,
  ]
  return []
}

// Bebop cells / licks keyed to context
function cellsForBar(bar, next) {
  const q = bar.quality
  const resolving = isDominantToNext(bar, next)
  if (q === "maj7") return [
    `3-5-7-9 cell: start on the 3rd, climb to 9 (avoid root-heavy sound)`,
    `Barry-style major 6th-dim idea: 1-6-5-#5 as passing motion`,
  ]
  if (q === "min7") return [
    `3-5-b7-9 cell (Dorian flavor)`,
    `C.E.S.H. internal motion: 1-7-b7-6 (chromatic inner voice)`,
  ]
  if (q === "min7b5") return [
    `Locrian #2 cell: 1-2-b3-5 (brightens the half-dim)`,
    `Guide-tone focus: b3 and b7 as anchors`,
  ]
  if (isAlteredDom(q) && resolving) return [
    `Altered cell from melodic minor (7th mode): b9-#9-3-b13`,
    `Tritone-slip the motive a half-step and return (side-slipping)`,
  ]
  if (isDominant(q) && resolving) return [
    `Dominant bebop fragment: 1-2-3-4-5-6-b7-7 (chord tones on downbeats)`,
    `3-to-b9 dim arpeggio: 3-5-b7-b9 (then resolve)`,
    `Enclosure on the target 3rd of the next chord, landing on beat 1`,
  ]
  if (q === "dim7") return [
    `Half-whole diminished cells (symmetry): 1-b9-#9-3 …`,
    `Resolve any dim tone by half-step into the next chord tone`,
  ]
  return [`Guide tones: aim 3rd/7th on beats 1 and 3; tensions on offbeats (Forward Motion)`]
}

// Hexatonic recommendation per chord (BB improv-map version)
function hexForBar(bar) {
  const majorHex = [0, 2, 4, 5, 7, 9], minorHex = [0, 2, 3, 5, 7, 9]
  const notes = (root, ints) => ints.map(s => T(root, s)).join(" ")
  const r = bar.root, q = bar.quality
  if (q === "min7b5") return { name: `${T(r, 3)} Minor Hex`, notes: notes(T(r, 3), minorHex) }
  if (q === "7alt" || q === "7b9") return { name: `${T(r, 1)} Major Hex`, notes: notes(T(r, 1), majorHex) }
  if (isDominant(q)) return { name: `${T(r, 5)} Major Hex`, notes: notes(T(r, 5), majorHex) }
  if (isMinor(q)) return { name: `${r} Minor Hex`, notes: notes(r, minorHex) }
  return { name: `${r} Major Hex`, notes: notes(r, majorHex) }
}

// Guide-tone voice-leading hint: 7th of current → 3rd of next
function voiceLeadingHint(bar, next) {
  if (!next) return "Resolve guide tones into the final chord."
  const g1 = guideTones(bar.symbol)
  const g2 = guideTones(next.symbol)
  if (g1.length < 2 || g2.length < 1) return "Guide tones: 7→3 or 3→7."
  return `${g1[1]} → ${g2[0]} (7→3) or ${g1[0]} → ${g2[1] ?? g2[0]} (3→7)`
}

function sectionLabel(bar, index, total) {
  if (bar.section) return `${bar.section}`
  const barNum = index + 1
  if (total >= 32) {
    if (barNum <= 8) return "A"
    if (barNum <= 16) return "A2"
    if (barNum <= 24) return "Bridge"
    return "A3"
  }
  if (total === 12) return "Blues"
  return ""
}

function levelsForBar(bar, next) {
  const q = bar.quality
  const resolving = isDominantToNext(bar, next)
  const scale = getRecommendedScalesFromQuality(q)[0]
  const sNotes = scaleNotes(scale, bar.root).join(" ")

  const level1 = `**Inside scale/mode:** ${bar.root} ${scale} (${sNotes}). Keep chord tones on beats 1 and 3.`
  const level2 = `**Triads + guide tones:** ${triadsForBar(bar).slice(0, 3).join("; ")}. Guide-tone line: 7→3 or 3→7 into **${next?.symbol || "next chord"}**.`
  const level3 = `**Bebop + chromatic:** Use enclosures into 3rd/7th. Add a passing tone so 8th-note runs land chord tones on downbeats. ${cellsForBar(bar, next).slice(0, 2).join(" ")}`

  let level4 = `**Harmonic/melodic minor color:** `
  if (q === "min7b5") level4 += `Try Locrian #2 (melodic minor a minor third up from the root).`
  else if (isAlteredDom(q) && resolving) level4 += `Altered scale (melodic minor a half-step above the dominant root).`
  else if (isDominant(q) && resolving) level4 += `Phrygian dominant (harmonic minor from the resolution key) or half-whole diminished.`
  else if (q === "maj7") level4 += `Lydian (major with #11) for lift; melodic minor tonic color for maj7(#5/#11) moods.`
  else if (q === "min7") level4 += `Melodic minor on tonic minor for i- color, or Dorian with 6 as a bright target.`
  else level4 += `Choose a parent minor (harmonic or melodic) that voice-leads into the next chord.`

  let level5 = `**Superimposition + HFM:** `
  if (resolving) level5 += `Start implying **${next.symbol}** 1.5 beats early (Harmonic Forward Motion). Try a tritone-sub line or an upper-structure triad to spell b9/#9/b13, then resolve cleanly.`
  else level5 += `Side-slip a motif up a half-step for one beat, then return. Use octave displacement to break scalar shapes while keeping guide-tone targets.`

  return [level1, level2, level3, level4, level5]
}

const mdSafe = (s) => String(s || "").replace(/\|/g, "\\|")

/**
 * Build the full Improv Guide markdown for a DukeBox chart.
 */
export function buildImprovGuideMarkdown({ bars, title = "Current Song", keyRoot = "C", keyMode = "major", tempo }) {
  const sounding = bars.filter(b => b.quality !== "NC")

  let md = `# DukeBox Improv Guide\n\n## ${title}\n\n`
  md += `**Key:** ${keyRoot} ${keyMode}${tempo ? `  |  **Tempo:** ${tempo}` : ""}\n\n`

  // Summary table
  md += `## Improv Map Table\n\n`
  md += `| Section | Bar | Chord | Hexatonic Scale | Triad Pairs | Voice leading (start → end) |\n`
  md += `|---|---:|---|---|---|---|\n`
  bars.forEach((bar, i) => {
    if (bar.quality === "NC") return
    const next = bars.slice(i + 1).find(b => b.quality !== "NC") || null
    const hx = hexForBar(bar)
    const triads = triadsForBar(bar).slice(0, 2)
      .map(t => t.replace(/\s*\(.+\)\s*$/, ""))
      .join(" & ")
    md += `| ${mdSafe(sectionLabel(bar, i, bars.length))} | ${i + 1} | ${mdSafe(bar.symbol)} | ${mdSafe(`${hx.name} (${hx.notes})`)} | ${mdSafe(triads || "—")} | ${mdSafe(voiceLeadingHint(bar, next))} |\n`
  })

  // Lead-sheet map, 4 bars per row
  md += `\n---\n\n## Lead Sheet Map\n\n| 1 | 2 | 3 | 4 |\n|---|---|---|---|\n`
  for (let i = 0; i < bars.length; i += 4) {
    const row = bars.slice(i, i + 4).map(b => b.symbol)
    while (row.length < 4) row.push("")
    md += `| ${row.join(" | ")} |\n`
  }

  md += `\n---\n\n## How to Read the 5 Levels\n\n`
  md += `- **Level 1:** stay diatonic, spell changes with guide tones (3rd and 7th)\n`
  md += `- **Level 2:** triads over chords, smooth voice leading (7→3 / 3→7)\n`
  md += `- **Level 3:** bebop scales, enclosures, chromatic approach notes, C.E.S.H.\n`
  md += `- **Level 4:** harmonic minor and melodic minor modes for functional minor and altered dominants\n`
  md += `- **Level 5:** superimposition, side-slipping, tritone subs, Harmonic Forward Motion (anticipate 1.5 beats)\n`

  md += `\n---\n\n## Chord-by-Chord Roadmap\n\n`
  bars.forEach((bar, i) => {
    if (bar.quality === "NC") return
    const next = bars.slice(i + 1).find(b => b.quality !== "NC") || null
    md += `### Bar ${i + 1}: **${bar.symbol}**\n\n`
    levelsForBar(bar, next).forEach(l => { md += `- ${l}\n` })
    md += `\n`
  })

  md += `---\n\n## Two tiny Forward Motion drills (fast payoff)\n\n`
  md += `1. **Guide-tone song:** play only 3rds and 7ths as half-notes through the form. Then add an eighth-note pickup into each target.\n`
  md += `2. **Everything is a pickup:** start every idea on an upbeat and aim to land a chord tone on the next bar's beat 1.\n`

  return md
}

/** Build the guide and trigger a browser download. */
export function downloadImprovGuide(opts) {
  const md = buildImprovGuideMarkdown(opts)
  const safeName = String(opts.title || "song").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_")
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${safeName}_${opts.keyRoot || "C"}_improv_guide.md`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
