// Voice-lead path — ONE landing note per chord change, plus (only when needed)
// ONE chromatic bridge that springboards into it.
//
// The old voice-leading board lit both guide tones of the current chord all
// bar and ghosted both guide tones of the next chord everywhere on the neck.
// The player's actual weighting is the opposite: while a chord sounds, any
// chord tone is as good as any other — the only moment that carries weight is
// beat 1 of the transition. So the display collapses to a single per-transition
// path: { target, bridge?, held }, and the board never shows more than two
// future marks.
//
// Target selection (the note to land on at the next downbeat):
//   "nearest"  — of the next chord's 3rd / root / 7th, whichever is reachable
//                by the smallest REAL motion from a current chord tone: a half
//                step beats a whole step beats a common tone beats a leap
//                (ties: 3rd, root, 7th). A common tone ranks below actual
//                motion on purpose — a ii–V shares tones constantly, and if
//                "hold that note" won every time, the mode would never teach
//                the 7→3 move it exists for.
//   "third" | "root" | "seventh" — pinned to that role, falling back through
//                the same order when the chord lacks it (a sus has no 3rd).
//   "random"   — seeded per transition, so a loop pass keeps its choices but
//                the second chorus can't be played from memory.
//
// Bridge rule (replaces the old "give up beyond a whole step"):
//   target is a current chord tone            → held, no bridge.
//   a current chord tone is a half step away  → no bridge; the move is direct.
//   anything farther                          → bridge = the chromatic note a
//     half step from the target, on the side facing the nearest current chord
//     tone (so the gesture flows one way), defaulting to below — the classic
//     bebop approach — when there's nothing to face.

import { chordInfo } from "./tonal"

const NOTES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
const NAME_TO_PC = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, "E#": 5, F: 5, "F#": 6,
  Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11, "B#": 0,
}

function pcOf(note) {
  return NAME_TO_PC[String(note || "").replace("♭", "b").replace("♯", "#")] ?? null
}

// Shortest signed way round the circle, -6..+5 (positive = up).
function signedTo(from, to) {
  return ((to - from + 6 + 12) % 12) - 6
}

// Deterministic tiny PRNG so "random" stays stable for a given bar + session.
function seededPick(seed, n) {
  let h = (seed ^ 0x9e3779b9) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) % n
}

// The next chord's role tones by pitch class. Same interval reading as
// MelodyPaths' analyzeChord: sus2/sus4 stand in for the 3rd, a 6th for the 7th.
function roleTones(symbol, rootName) {
  const info = chordInfo(symbol)
  const tones = { root: pcOf(rootName), third: null, seventh: null }
  ;(info.intervals || []).forEach((interval, i) => {
    const pc = pcOf(info.notes?.[i])
    if (pc == null) return
    if (interval === "3M" || interval === "3m" || interval === "2M" || interval === "4P") tones.third = pc
    if (interval === "7M" || interval === "7m" || interval === "6M") tones.seventh = pc
  })
  return tones
}

const ROLE_ORDER = ["third", "root", "seventh"]

/**
 * @param currentNotes  note names of the chord sounding now
 * @param nextBar       { symbol, root } of the next sounding bar
 * @param preference    "nearest" | "third" | "root" | "seventh" | "random"
 * @param seed          number; only read by "random"
 * @returns { target, targetRole, bridge, held } with flat note names,
 *          or null when there's nothing to aim at.
 */
export function computeVoiceLeadPath(currentNotes, nextBar, preference = "nearest", seed = 0) {
  if (!nextBar?.symbol) return null
  const currentPcs = (currentNotes || []).map(pcOf).filter((pc) => pc != null)
  const tones = roleTones(nextBar.symbol, nextBar.root)
  const candidates = ROLE_ORDER
    .map((role) => ({ role, pc: tones[role] }))
    .filter((c) => c.pc != null)
  if (!candidates.length) return null

  let chosen
  if (preference === "random") {
    chosen = candidates[seededPick(seed, candidates.length)]
  } else if (preference === "third" || preference === "root" || preference === "seventh") {
    chosen = candidates.find((c) => c.role === preference) || candidates[0]
  } else {
    // "nearest": smallest REAL motion from any current chord tone. Half step
    // (weight 0) beats whole step (1) beats common tone (2) beats leaps (3+).
    // Candidates are already in tie-break order, so a plain < keeps
    // 3rd > root > 7th on ties.
    const weightOf = (pc) => {
      if (!currentPcs.length) return 0
      const d = Math.min(...currentPcs.map((cur) => Math.abs(signedTo(cur, pc))))
      return d === 1 ? 0 : d === 2 ? 1 : d === 0 ? 2 : d
    }
    chosen = candidates.reduce((best, c) => (weightOf(c.pc) < weightOf(best.pc) ? c : best))
  }

  const target = NOTES_FLAT[chosen.pc]
  if (currentPcs.includes(chosen.pc)) {
    return { target, targetRole: chosen.role, bridge: null, held: true }
  }

  // Signed distance from the nearest current chord tone, to pick the bridge's side.
  let nearest = null
  for (const cur of currentPcs) {
    const s = signedTo(cur, chosen.pc)
    if (nearest === null || Math.abs(s) < Math.abs(nearest)) nearest = s
  }
  if (nearest !== null && Math.abs(nearest) === 1) {
    return { target, targetRole: chosen.role, bridge: null, held: false }
  }

  // nearest > 0 means the line rises into the target → approach from below.
  const fromBelow = nearest == null || nearest > 0
  const bridgePc = (chosen.pc + (fromBelow ? 11 : 1)) % 12
  return { target, targetRole: chosen.role, bridge: NOTES_FLAT[bridgePc], held: false }
}

export const TARGET_ROLE_LABELS = { third: "3rd", root: "root", seventh: "7th" }
