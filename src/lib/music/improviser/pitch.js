// Pitch helpers shared by the generator and the onset fillers.
//
// These lived inside generator.js until fillers needed them too. Nothing here
// imports anything, so both can depend on it without a cycle.

// Nearest MIDI instance of a pitch class to `ref`, inside the register.
export function nearestMidi(pc, ref, register) {
  let best = null
  for (let midi = register.min; midi <= register.max; midi++) {
    if (midi % 12 !== pc) continue
    if (best == null || Math.abs(midi - ref) < Math.abs(best - ref)) best = midi
  }
  return best ?? Math.min(register.max, Math.max(register.min, ref))
}

// Next scale tone above/below `midi` from a pc set, staying in register.
export function scaleStep(midi, pcs, direction, register) {
  for (let step = 1; step <= 12; step++) {
    const candidate = midi + step * direction
    if (candidate < register.min || candidate > register.max) break
    if (pcs.includes(((candidate % 12) + 12) % 12)) return candidate
  }
  // Walked off the register — turn around.
  for (let step = 1; step <= 12; step++) {
    const candidate = midi - step * direction
    if (candidate < register.min || candidate > register.max) break
    if (pcs.includes(((candidate % 12) + 12) % 12)) return candidate
  }
  return midi
}

export function clampToRegister(midi, register) {
  return Math.min(register.max, Math.max(register.min, midi))
}

// The next pool tone at least `minInterval` semitones away in `direction` —
// Bergonzi's thesaurus rule, where the line is forbidden to step. Falls back
// to the other direction, then to an ordinary step, so a narrow register can
// never leave the walk with nowhere to go.
export function leapStep(midi, pcs, direction, register, minInterval) {
  for (const dir of [direction, -direction]) {
    for (let step = minInterval; step <= 14; step++) {
      const candidate = midi + step * dir
      if (candidate < register.min || candidate > register.max) break
      if (pcs.includes(((candidate % 12) + 12) % 12)) return candidate
    }
  }
  return scaleStep(midi, pcs, direction, register)
}
