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
  { id: "jazz-blues-bb",  label: "Jazz Blues in Bb" },
  { id: "major-251",      label: "Major ii-V-I Cycle" },
  { id: "minor-251",      label: "Minor ii-V-I Cycle" },
  { id: "rhythm-changes", label: "Rhythm Changes" },
  { id: "autumn-leaves",  label: "Autumn Leaves (Gm)" },
  { id: "black-orpheus",  label: "Black Orpheus (Am)" },
  { id: "all-the-things", label: "All the Things (Ab)" },
]

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
