// Seeded RNG for the improviser. Every random decision in the engine draws
// from one of these — never Math.random() — so a (chart, profile, controls,
// seed) tuple reproduces the identical line, which is what makes invariant
// and statistical tests possible and lets a generated line be regenerated
// exactly from its saved metadata.

// mulberry32 — small, fast, good-enough distribution for musical weighting.
export function createRng(seed) {
  let a = (Number(seed) >>> 0) || 1
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Weighted pick from [[value, weight], ...]. Zero/negative weights drop out.
export function pickWeighted(rng, entries) {
  const live = entries.filter(([, w]) => w > 0)
  if (!live.length) return entries[0]?.[0]
  const total = live.reduce((sum, [, w]) => sum + w, 0)
  let roll = rng() * total
  for (const [value, weight] of live) {
    roll -= weight
    if (roll <= 0) return value
  }
  return live[live.length - 1][0]
}

export function chance(rng, p) {
  return rng() < p
}
