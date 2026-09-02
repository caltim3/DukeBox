// Style profiles — documented musical tendencies, expressed as weights over
// the SAME rule set the whole engine runs. A profile never adds code paths;
// it reweights them. The live controls (space / altered / intensity) then
// bias the blended result further, so "style" and "sliders" are one
// mechanism: a point in the weight space.
//
// Every number here is a probability (0-1) or a relative weight. Controls
// are biases, not switches — space: 0.8 strongly favors rests and short
// phrases but can't force eight silent bars.

export const IMPROV_PROFILES = {
  bebop: {
    id: "bebop",
    label: "Bebop",
    description:
      "Connected eighth-note language: guide-tone targeting at every change, chromatic " +
      "enclosures into targets, offbeat entrances, phrases that breathe between arcs.",
    defaults: { space: 0.35, altered: 0.25, intensity: 0.6 },
    // Rhythm — how the line moves.
    density: 0.72, // 0 = whole notes, 1 = wall of eighths
    phraseBeats: [[4, 2], [6, 3], [8, 3], [10, 1]],
    restBeatsBase: 1.5, // scaled up by the space control
    pickupProb: 0.65, // enter off the beat / after beat 1
    cellWeights: { run8: 5, offbeat8: 3, charleston: 1.2, triplet: 1.4, quarters: 0.8, pushQuarter: 1.2, longNote: 0.4, dotted: 1 },
    // Pitch — how targets get approached.
    enclosureProb: 0.5,
    doubleEnclosureProb: 0.25,
    leapProb: 0.14,
    // Time placement against the form.
    nailOneProb: 0.5, // re-enter on (or a pickup into) the next bar's ONE
    nailChangeProb: 0.65, // guarantee an onset at a chord change the cells missed
    anticipationProb: 0.4, // speak the new chord on the "&" BEFORE the barline
    // Development — what a phrase does with the previous one.
    motifEchoProb: 0.35,
    // Register & expression.
    register: { min: 55, max: 88, center: 71 },
    contourWeights: [["arch", 3], ["descending", 2.5], ["ascending", 1.5], ["valley", 1]],
    ghostProb: 0.12,
    accentStrength: 0.7,
  },

  "sparse-lyrical": {
    id: "sparse-lyrical",
    label: "Sparse & lyrical",
    description:
      "Short singable statements with real silence between them: held notes, motifs " +
      "repeated and answered, a narrow register, almost no chromaticism.",
    defaults: { space: 0.65, altered: 0.1, intensity: 0.4 },
    density: 0.32,
    phraseBeats: [[2, 2], [3, 3], [4, 3], [6, 1.5]],
    restBeatsBase: 2.5,
    pickupProb: 0.45,
    cellWeights: { run8: 0.5, offbeat8: 1.2, charleston: 2, triplet: 0.3, quarters: 3, pushQuarter: 2.2, longNote: 3, dotted: 2 },
    enclosureProb: 0.12,
    doubleEnclosureProb: 0,
    leapProb: 0.2, // lyrical lines leap to color tones more than they run
    nailOneProb: 0.55, // singers land statements on the one
    nailChangeProb: 0.5,
    anticipationProb: 0.25,
    motifEchoProb: 0.6,
    register: { min: 60, max: 81, center: 69 },
    contourWeights: [["arch", 3], ["descending", 2], ["ascending", 2], ["valley", 0.5]],
    ghostProb: 0.04,
    accentStrength: 0.5,
  },
}

// Clamp raw control values into 0-1, filling gaps from the profile defaults.
export function sanitizeControls(profile, raw = {}) {
  const clamp = (v, fallback) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback
  }
  return {
    space: clamp(raw.space, profile.defaults.space),
    altered: clamp(raw.altered, profile.defaults.altered),
    intensity: clamp(raw.intensity, profile.defaults.intensity),
  }
}

// One immutable style object per generation — the generator never reads
// mutable slider state mid-phrase.
export function blendStyle(profileId, rawControls) {
  const profile = IMPROV_PROFILES[profileId] || IMPROV_PROFILES.bebop
  const controls = sanitizeControls(profile, rawControls)

  // space pushes density down and rests up; intensity nudges density up.
  const density = Math.min(1, Math.max(0.1,
    profile.density * (1 - controls.space * 0.55) + controls.intensity * 0.12))
  const restBeats = profile.restBeatsBase * (0.5 + controls.space * 2)

  return {
    ...profile,
    controls,
    density,
    restBeats,
    alteredProb: controls.altered,
    baseVelocity: 0.45 + controls.intensity * 0.3,
  }
}
