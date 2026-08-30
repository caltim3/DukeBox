// Sanity harness for the Triad System engine (src/lib/music/triadSystem.js),
// mirroring the source guide's "pitch layer verified across all 12 roots"
// claim: every pair formula, backdrop, combo classification, auto-pair rule
// and landing target checked for all 12 roots × the four quality families.
// Not a test framework — just `node scripts/check-triads.mjs`, exit 1 on any
// miss. Same shape as check-pathways.mjs.

import { register } from "node:module"
register("./pathways-alias-loader.mjs", import.meta.url)

const { resolveTriadSystem, triadQualityFamily, buildTriadSounds } =
  await import("../src/lib/music/triadSystem.js")
const { resolveTriadRoute } = await import("../src/lib/music/triadRoutes.js")
const { analyzeProgressionContext } = await import("../src/lib/music/harmony.js")
const { noteAtSemitones } = await import("../src/lib/music/tonal.js")

const ROOTS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
let fails = 0
const ok = (cond, msg) => { if (!cond) { fails++; console.log("FAIL:", msg) } }

const chroma = (n) => ROOTS.indexOf(n)
const degOf = (note, root) => (chroma(note) - chroma(root) + 12) % 12

for (const root of ROOTS) {
  // Dominant Inside — 5·b7·9 + 13·R·3, the 13th arpeggio in two halves;
  // over Maj pent · root the union stays six notes (closed hexatonic, home).
  let r = resolveTriadSystem({ root, quality: "7", pairChoice: "inside", contextSlot: 0 })
  ok(r.family === "dominant", `${root}7 family`)
  let degs = new Set([...r.pair.t1.notes, ...r.pair.t2.notes].map((n) => degOf(n, root)))
  ok([7, 10, 2, 9, 0, 4].every((d) => degs.has(d)) && degs.size === 6, `${root}7 inside pool: ${[...degs]}`)
  ok(r.combo === "home", `${root}7 inside combo home`)
  ok(new Set(r.poolNotes).size === 6, `${root}7 inside+majpent closed hexatonic, got ${r.poolNotes.length}`)
  ok(r.rubs.length === 0, `${root}7 inside home zero rubs`)

  // Dominant Altered — #9·#11·b7 + b9·3·b13; Engine only on the Martino
  // backdrop (slot 1), Tension elsewhere.
  r = resolveTriadSystem({ root, quality: "7", pairChoice: "altered", contextSlot: 1 })
  degs = new Set([...r.pair.t1.notes, ...r.pair.t2.notes].map((n) => degOf(n, root)))
  ok([3, 6, 10, 1, 4, 8].every((d) => degs.has(d)) && degs.size === 6, `${root}7alt pool: ${[...degs]}`)
  ok(r.combo === "engine", `${root}7 altered over slot1 = engine, got ${r.combo}`)
  ok(resolveTriadSystem({ root, quality: "7", pairChoice: "altered", contextSlot: 0 }).combo === "tension", `${root}7 altered slot0 tension`)

  // Auto follows the progression: static dominant stays Inside, a resolving
  // one goes Altered and lands on the destination's 3rd (Galper).
  ok(resolveTriadSystem({ root, quality: "7", ctxEntry: { hasCadence: false } }).pair.id === "inside", `${root}7 auto static`)
  const next = { root: noteAtSemitones(root, 5), quality: "maj7" }
  r = resolveTriadSystem({ root, quality: "7", ctxEntry: { hasCadence: true, functionLabel: "dominant" }, nextBar: next })
  ok(r.pair.id === "altered", `${root}7 auto resolving → altered`)
  ok(r.landingNote === noteAtSemitones(next.root, 4), `${root}7 landing = 3rd of ${next.root}: ${r.landingNote}`)

  // Minor — the Dorian pair (1·b3·5 + 9·11·13); the 9th backdrop stays
  // fully inside Dorian.
  r = resolveTriadSystem({ root, quality: "min7", contextSlot: 2 })
  degs = new Set([...r.pair.t1.notes, ...r.pair.t2.notes].map((n) => degOf(n, root)))
  ok([0, 3, 7, 2, 5, 9].every((d) => degs.has(d)), `${root}m7 dorian pool: ${[...degs]}`)
  ok(r.poolNotes.every((n) => [0, 2, 3, 5, 7, 9, 10].includes(degOf(n, root))), `${root}m7 slot2 within Dorian`)

  // Major — Lydian pair is the maj13#11 stack (3·5·7·9·#11, five notes:
  // the triads share the 7); maj7#11 auto-picks it, plain maj7 stays Diatonic.
  r = resolveTriadSystem({ root, quality: "maj7", pairChoice: "lydian", contextSlot: 0 })
  degs = new Set([...r.pair.t1.notes, ...r.pair.t2.notes].map((n) => degOf(n, root)))
  ok([4, 7, 11, 2, 6].every((d) => degs.has(d)) && degs.size === 5, `${root}maj7 lydian pool: ${[...degs]}`)
  ok(resolveTriadSystem({ root, quality: "maj7#11" }).pair.id === "lydian", `${root}maj7#11 auto lydian`)
  ok(resolveTriadSystem({ root, quality: "maj7" }).pair.id === "diatonic", `${root}maj7 auto diatonic`)

  // Half-dim — Martino's relative conversion (b3·b5·b7 + 11·b13·R); the
  // 11th backdrop is the zero-rub home inside Locrian nat2.
  r = resolveTriadSystem({ root, quality: "min7b5", contextSlot: 0 })
  degs = new Set([...r.pair.t1.notes, ...r.pair.t2.notes].map((n) => degOf(n, root)))
  ok([3, 6, 10, 5, 8, 0].every((d) => degs.has(d)) && degs.size === 6, `${root}m7b5 pool: ${[...degs]}`)
  ok(r.rubs.length === 0, `${root}m7b5 slot0 zero rubs, got ${JSON.stringify(r.rubs)}`)

  // A manual pair choice a quality doesn't offer falls back to its own pair.
  ok(resolveTriadSystem({ root, quality: "min7", pairChoice: "altered" }).pair.id === "dorian", `${root}m7 fallback`)

  // dim7 is symmetric — no natural pair; the lens stands down.
  ok(resolveTriadSystem({ root, quality: "dim7" }) === null, `${root}dim7 null`)
}
ok(triadQualityFamily("NC") === null, "NC family null")

// ── Routes over a Bb jazz blues (the worked chorus from the design pass) ────
// 1 Bb7 | 2 Eb7 | 3 Bb7 | 4 Bb7 | 5 Eb7 | 6 Eb7 | 7 Bb7 | 8 G7 | 9 Cm7
// | 10 F7 | 11 Bb7 | 12 F7 (turnaround, resolving across the wrap)
const bar = (root, quality) => ({ root, quality, symbol: root + quality })
const BLUES = [
  bar("Bb", "7"), bar("Eb", "7"), bar("Bb", "7"), bar("Bb", "7"),
  bar("Eb", "7"), bar("Eb", "7"), bar("Bb", "7"), bar("G", "7"),
  bar("C", "min7"), bar("F", "7"), bar("Bb", "7"), bar("F", "7"),
]
const CTX = analyzeProgressionContext(BLUES)
const routeAt = (routeId, index) =>
  resolveTriadRoute({ bars: BLUES, index, ctxEntry: CTX[index], tonicRoot: "Bb", routeId })

// Wes — the obedient schedule.
let w = routeAt("wes", 0)
ok(w.tag === "dom_I" && w.pairChoice === "inside" && w.contextSlot === 0, `wes bar1 quick-change stays home, got ${w.tag}`)
w = routeAt("wes", 3)
ok(w.tag === "dom_V_of_IV" && w.pairChoice === "altered" && w.contextSlot === 1, `wes bar4 V-of-IV altered, got ${w.tag}`)
w = routeAt("wes", 4)
ok(w.tag === "dom_IV" && w.contextSlot === 1, `wes bar5 IV wears the key blues slot, got ${w.tag}/${w.contextSlot}`)
w = routeAt("wes", 7)
ok(w.tag === "dom_resolving" && w.pairChoice === "altered", `wes bar8 G7 resolving, got ${w.tag}`)
w = routeAt("wes", 8)
ok(w.tag === "minor_ii", `wes bar9 Cm7 is the ii, got ${w.tag}`)
w = routeAt("wes", 10)
ok(w.tag === "dom_I", `wes bar11 breathes at home, got ${w.tag}`)
w = routeAt("wes", 11)
ok(w.tag === "dom_resolving", `wes bar12 turnaround resolves across the wrap, got ${w.tag}`)

// Wes bar 8, fully resolved: Engine, landing on Eb (3rd of Cm7).
let sys = resolveTriadSystem({
  root: "G", quality: "7", ctxEntry: CTX[7], nextBar: BLUES[8],
  pairChoice: routeAt("wes", 7).pairChoice, contextSlot: routeAt("wes", 7).contextSlot,
})
ok(sys.combo === "engine" && sys.landingNote === "Eb", `wes bar8 engine lands Eb, got ${sys.combo}/${sys.landingNote}`)

// Ribot — the scheduled violations.
let rb = routeAt("ribot", 0)
ok(rb.landingPolicy === "rub", `ribot bar1 sits on the rub`)
sys = resolveTriadSystem({
  root: "Bb", quality: "7", ctxEntry: CTX[0], nextBar: BLUES[1],
  pairChoice: rb.pairChoice, contextSlot: rb.contextSlot, landingPolicy: rb.landingPolicy,
})
ok(sys.landingNote === "Db", `ribot bar1 rub destination is Db, got ${sys.landingNote}`)
rb = routeAt("ribot", 3)
ok(rb.tag === "dom_V_of_IV" && rb.pairChoice === "inside", `ribot bar4 ignores the sophistication, got ${rb.tag}/${rb.pairChoice}`)
rb = routeAt("ribot", 4)
ok(rb.soloTriad === 1, `ribot bar5 one triad tres-style`)
rb = routeAt("ribot", 9)
ok(rb.landingPolicy === "refuse", `ribot bar10 refuses the landing`)
sys = resolveTriadSystem({
  root: "F", quality: "7", ctxEntry: CTX[9], nextBar: BLUES[10],
  pairChoice: rb.pairChoice, contextSlot: rb.contextSlot, landingPolicy: rb.landingPolicy,
})
ok(sys.landingNote === "Db", `ribot bar10 stops on Db, a half step shy of D, got ${sys.landingNote}`)
rb = routeAt("ribot", 8)
ok(rb.landingPolicy === "land", `ribot Cm7 played straight — the inside bar is the surprise`)

// ── The sound palette (buildTriadSounds) ────────────────────────────────────
// The canonical example: over G7 resolving to Cmaj7, the Inside line must
// prescribe the D minor arp inverted to deliver E, the 3rd of the next chord
// (via F, a half step above).
const nextC = { root: "C", quality: "maj7", symbol: "Cmaj7" }
sys = resolveTriadSystem({ root: "G", quality: "7", pairChoice: "inside", contextSlot: 0, nextBar: nextC })
let sounds = buildTriadSounds({ root: "G", quality: "7", sys, nextBar: nextC })
const byId = (id) => sounds.find((s) => s.id === id)
ok(byId("inside")?.text.startsWith("Dm arp (5·b7·9)"), `G7 inside sound is the Dm arp, got: ${byId("inside")?.text}`)
ok(byId("inside")?.text.includes("end on F") && byId("inside")?.text.includes("onto E"), `G7 inside inverts to F → E, got: ${byId("inside")?.text}`)
ok(byId("color")?.text.includes("holds E"), `G7 color (Em) already holds the landing, got: ${byId("color")?.text}`)
ok(byId("outside")?.text.includes("Bbm") && byId("outside")?.text.includes("Abm") && byId("outside")?.text.includes("aim E"), `G7 outside names the altered pair and the aim, got: ${byId("outside")?.text}`)
ok(byId("target")?.text.includes("E") && byId("target")?.text.includes("Cmaj7"), `G7 target names E into Cmaj7, got: ${byId("target")?.text}`)

// Every supported family yields a palette; a route's rub policy rewrites the Rub line.
for (const q of ["min7", "maj7", "min7b5"]) {
  const s2 = resolveTriadSystem({ root: "C", quality: q })
  ok(buildTriadSounds({ root: "C", quality: q, sys: s2 }).length >= 2, `${q} palette non-empty`)
}
// A minor chord's own triad spells b3, not the altered pool's #9 (and the
// half-dim's b5, not #11).
sys = resolveTriadSystem({ root: "C", quality: "min7" })
ok(buildTriadSounds({ root: "C", quality: "min7", sys }).find((s) => s.id === "inside")?.text.includes("(1·b3·5)"), "m7 inside spells 1·b3·5")
sys = resolveTriadSystem({ root: "C", quality: "min7b5" })
ok(buildTriadSounds({ root: "C", quality: "min7b5", sys }).find((s) => s.id === "inside")?.text.includes("(b3·b5·b7)"), "m7b5 inside spells b3·b5·b7")
const rbRoute = routeAt("ribot", 0)
sys = resolveTriadSystem({ root: "Bb", quality: "7", pairChoice: rbRoute.pairChoice, contextSlot: rbRoute.contextSlot, landingPolicy: rbRoute.landingPolicy, nextBar: BLUES[1] })
sounds = buildTriadSounds({ root: "Bb", quality: "7", sys: { ...sys, route: rbRoute }, nextBar: BLUES[1] })
ok(sounds.find((s) => s.id === "rub")?.text.includes("sit on Db"), `ribot rub line says sit on Db, got: ${sounds.find((s) => s.id === "rub")?.text}`)

console.log(fails === 0 ? "ALL CHECKS PASSED (12 roots × families + Wes/Ribot routes + sound palette)" : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
