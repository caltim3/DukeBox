// Improviser — deterministic, local, rule-based jazz line generation over
// any DukeBox chart selection. The vertical slice of the Continuous
// Improviser plan: finite 4-8 bar generation, rhythm-first, guide-tone
// targeting, seeded and reproducible. No network, no LLM.
//
// Public surface — UI code imports only from here:
//   improvise({ measures, profileId, controls, seed }) → { line, trace }
//   createImproviserSession({ measures, profileId, controls, seed })
//     → the continuous plan/commit controller (Phase 2)
//   IMPROV_PROFILES — style presets for the picker

export { improvise } from "./generator"
export { createImproviserSession } from "./session"
export { IMPROV_PROFILES } from "./profiles"
