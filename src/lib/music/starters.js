// Starter charts — the "Start practicing" quick-load list.
//
// Shared because the strip lives on the Practice home screen
// (components/PickupPracticeHome.jsx) while the loader that actually swaps the
// chart lives in the Practice page (app/page.js), and those two render in
// separate React trees (home is mounted from layout.js). Home used to reach
// the loader by finding the starter button in the page and clicking it, which
// only worked while the strip was rendered inside the page. It now dispatches
// LOAD_STARTER_EVENT instead, so the strip can live anywhere.

export const STARTER_PRESETS = [
  // Plain charts — no longer shown on the strip itself (see the scenarios
  // below), but kept loadable by id: the "Your learning plan" cards in
  // PickupPracticeHome.jsx address several of these directly, and any
  // recent-activity entry logged before the strip changed still holds one
  // of these ids or labels.
  { id: "jazz-blues-bb",  label: "Jazz Blues in Bb",     stripHidden: true },
  { id: "major-251",      label: "Major ii-V-I Cycle",   stripHidden: true },
  { id: "minor-251",      label: "Minor ii-V-I Cycle",   stripHidden: true },
  { id: "rhythm-changes", label: "Rhythm Changes",       stripHidden: true },
  { id: "autumn-leaves",  label: "Autumn Leaves (Gm)",   stripHidden: true },
  { id: "black-orpheus",  label: "Black Orpheus (Am)",   stripHidden: true },
  { id: "all-the-things", label: "All the Things (Ab)",  stripHidden: true },
  { id: "minor-blues-dm", label: "Minor Blues (Dm)",     stripHidden: true },
  { id: "dark-eyes",      label: "Dark Eyes (Dm)",       stripHidden: true },

  // "Start practicing" strip — fully loaded scenarios: one of the plain
  // charts above plus a specific Fretboard/3:2 System setup (see
  // SCENARIO_CONFIG). Every one of these jumps straight to Focus and starts
  // playing behind an 8-beat woodblock count-in — see page.js's loadStarter.
  { id: "hex-black-orpheus",          label: "Hexatonics — Black Orpheus" },
  { id: "martino-jazz-blues",         label: "Martino — Jazz Blues" },
  { id: "altered-251-line",           label: "Altered ii-V-I Lines" },
  { id: "voice-leading-attya",        label: "Voice Leading — All the Things" },
  { id: "voice-leading-autumn",       label: "Voice Leading — Autumn Leaves" },
  { id: "three-two-major-hex-blues",  label: "3:2 Major Hex — Jazz Blues" },
  { id: "minor-blues-jam",            label: "Minor Blues Jam" },
]

// The strip shows the quick-load row; the full list also carries charts that
// only the learning-plan cards link to.
export const STARTER_STRIP = STARTER_PRESETS.filter((preset) => !preset.stripHidden)

// Which chart each scenario above actually loads (chartId names one of the
// stripHidden plain starters' own ids, above) and which Fretboard/3:2 System
// setup to apply once it's loaded. Read by page.js's loadStarter, which owns
// the actual state (scaleFilter/guideMode/threeTwoMode/alteredOverlay/etc.)
// these describe:
//   scaleFilter — "hexatonic" | "martino" | null (the PALETTE filter row)
//   altered     — the Altered overlay (page.js's alteredOverlay)
//   guideMode   — "voice" | "off" (the CONNECT row's Voice Leading choice)
//   threeTwo    — { level, density? } to turn the 3:2 System on at that
//                 level (and Shape filter, for Levels 2-4); omitted means
//                 3:2 stays off
// Anything a scenario doesn't mention resets to its own off state — see
// loadStarter's own doc comment for exactly what "clean slate" means.
export const SCENARIO_CONFIG = {
  "hex-black-orpheus":         { chartId: "black-orpheus",  scaleFilter: "hexatonic" },
  "martino-jazz-blues":        { chartId: "jazz-blues-bb",  scaleFilter: "martino" },
  "altered-251-line":          { chartId: "major-251",      altered: true },
  "voice-leading-attya":       { chartId: "all-the-things", guideMode: "voice" },
  "voice-leading-autumn":      { chartId: "autumn-leaves",  guideMode: "voice" },
  "three-two-major-hex-blues": { chartId: "jazz-blues-bb",  threeTwo: { level: 4, density: "hexatonic" } },
  "minor-blues-jam":           { chartId: "minor-blues-dm", threeTwo: { level: 1 }, guideMode: "voice" },
}

export const LOAD_STARTER_EVENT = "dukebox:load-starter"

export function starterLabel(id) {
  return STARTER_PRESETS.find((preset) => preset.id === id)?.label ?? null
}

// Recent-activity entries and the learning-plan cards address starters by
// their display label, so accept either form.
export function starterIdFor(idOrLabel) {
  const match = STARTER_PRESETS.find(
    (preset) => preset.id === idOrLabel || preset.label === idOrLabel
  )
  return match?.id ?? null
}

export function requestStarter(idOrLabel) {
  const id = starterIdFor(idOrLabel)
  if (!id) return false
  window.dispatchEvent(new CustomEvent(LOAD_STARTER_EVENT, { detail: id }))
  return true
}
