// Sanity harness for the Scale Pathways engine (src/lib/music/pathways.js).
// Runs the engine over the playbook's reference progressions and asserts the
// calls the spec (docs/SCALE_PATHWAYS.md) pins down. Not a test framework —
// just `node scripts/check-pathways.mjs`, exit 1 on any miss, with the full
// resolved tables printed so a musician can eyeball the rest.

import { register } from "node:module"
register("./pathways-alias-loader.mjs", import.meta.url)

const { resolvePathwayPlan, PATHWAY_RUNGS } =
  await import("../src/lib/music/pathways.js")

const bar = (root, quality) => ({ root, quality })

const CHARTS = {
  "Major ii-V-I": [bar("D", "min7"), bar("G", "7"), bar("C", "maj7")],
  "ii-V-I with G7alt": [bar("D", "min7"), bar("G", "7alt"), bar("C", "maj7")],
  "Minor ii-V-i": [bar("D", "min7b5"), bar("G", "7b9"), bar("C", "min6")],
  "Bb jazz blues": [
    bar("Bb", "7"), bar("Eb", "7"), bar("Bb", "7"), bar("Bb", "7"),
    bar("Eb", "7"), bar("Eb", "7"), bar("Bb", "7"), bar("G", "7"),
    bar("C", "min7"), bar("F", "7"), bar("Bb", "7"), bar("F", "7"),
  ],
  "Backdoor cadence": [bar("F", "min7"), bar("Bb", "7"), bar("C", "maj7")],
  "Tritone-sub ii-V-I": [bar("Ab", "min7"), bar("Db", "7"), bar("C", "maj7")],
  "Pop I-vi-ii-V": [bar("C", "maj7"), bar("A", "min7"), bar("D", "min7"), bar("G", "7")],
  "Override wins": [bar("D", "min7"), { ...bar("G", "7"), userScale: "whole tone" }, bar("C", "maj7")],
}

// chart → rung → barIndex → { label?, tonic?, view?, source? } expectations.
const EXPECT = {
  "Major ii-V-I": {
    1: { 0: { label: "dorian", tonic: "D" }, 1: { label: "mixolydian", tonic: "G" }, 2: { label: "major", tonic: "C" } },
    2: { 1: { view: "chord" } },
    3: { 0: { label: "minor pentatonic" }, 1: { label: "dominant pentatonic" }, 2: { label: "major pentatonic" } },
    4: { 0: { label: "bebop minor" }, 1: { label: "bebop" }, 2: { label: "bebop major" } },
    5: { 0: { label: "dorian" }, 1: { label: "altered" }, 2: { label: "lydian" } },
  },
  "ii-V-I with G7alt": {
    1: { 1: { label: "altered", source: "symbol" } },
    3: { 1: { label: "altered", source: "symbol" } },
  },
  "Minor ii-V-i": {
    1: { 0: { label: "locrian 6" }, 1: { label: "phrygian dominant" }, 2: { label: "melodic minor" } },
    3: { 0: { label: "minor pentatonic", tonic: "C" }, 2: { label: "minor six pentatonic" } },
  },
  "Bb jazz blues": {
    1: { 0: { label: "minor blues", tonic: "Bb" }, 7: { label: "minor blues", tonic: "Bb" }, 9: { label: "minor blues", tonic: "Bb" } },
    5: { 2: { label: "mixolydian" }, 7: { label: "phrygian dominant" }, 11: { label: "altered" } },
  },
  "Backdoor cadence": {
    1: { 0: { label: "dorian" }, 1: { label: "mixolydian" }, 2: { label: "major" } },
    5: { 1: { label: "lydian dominant" } },
  },
  "Tritone-sub ii-V-I": {
    1: { 0: { label: "dorian", tonic: "Ab" }, 1: { label: "lydian dominant", tonic: "Db" }, 2: { label: "major" } },
  },
  "Pop I-vi-ii-V": {
    1: { 0: { label: "major" }, 1: { label: "aeolian" }, 2: { label: "dorian" }, 3: { label: "mixolydian" } },
    5: { 1: { label: "dorian" }, 3: { label: "altered" } },
  },
  "Override wins": {
    1: { 1: { label: "whole tone", source: "override" } },
    5: { 1: { label: "whole tone", source: "override" } },
  },
}

let failures = 0

function checkBar(chartName, rungId, index, got, want) {
  for (const [key, val] of Object.entries(want)) {
    if (got[key] !== val) {
      failures += 1
      console.error(`  ✗ ${chartName} · rung ${rungId} · bar ${index + 1}: ${key} = ${JSON.stringify(got[key])}, expected ${JSON.stringify(val)}`)
    }
  }
}

for (const [name, bars] of Object.entries(CHARTS)) {
  // The plan's form carries the cadence-refined key, unlike a bare
  // classifyPathwayForm call.
  const form = resolvePathwayPlan(bars, 1).form
  console.log(`\n━━ ${name} (${form.label}) ━━`)
  for (const rung of PATHWAY_RUNGS) {
    const plan = resolvePathwayPlan(bars, rung.id)
    const row = plan.choices.map((c, i) => {
      const chord = `${bars[i].root}${bars[i].quality}`
      const what = c.view === "chord" ? "chord tones" : `${c.tonic} ${c.label}`
      return `${chord}→${what}`
    }).join("  |  ")
    console.log(`  ${rung.id} ${rung.name.padEnd(11)} ${row}`)
    const wants = EXPECT[name]?.[rung.id]
    if (wants) {
      for (const [idx, want] of Object.entries(wants)) {
        checkBar(name, rung.id, Number(idx), plan.choices[Number(idx)], want)
      }
    }
    for (const [i, c] of plan.choices.entries()) {
      if (c.usable && c.view === "scale" && (!c.notes || c.notes.length < 5)) {
        failures += 1
        console.error(`  ✗ ${name} · rung ${rung.id} · bar ${i + 1}: scale "${c.label}" materialized ${c.notes?.length ?? 0} notes`)
      }
    }
  }
}

console.log(failures === 0 ? "\nAll pathway checks passed." : `\n${failures} pathway check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
