// Walking-bass personalities — ported from Bebop Blueprint (BASS_STYLES +
// __bb_generateWalkingBassBar). Pure module: no Tone.js so it can be imported
// anywhere without creating an AudioContext.
//
// Each style is a set of probability dials that shape the line:
//   chromaticApproachRate — beat-4 half-step approaches to the next root
//   diatonicPassingRate   — passing tones smoothing big beat-2→3 jumps
//   enclosureRate         — beat-4 single-note enclosure hints around the target
//   fifthOnBeat3Rate      — classic root–x–5th–x bar shapes
//   anticipationsRate     — landing the next root early on beat 4
//   leapiness             — tolerance for wide intervals on beat 3
//   twoFeelRate           — bias toward omitting beats 2 & 4 at low complexity

const JAZZ_SPELLING = {
  0: "C", 1: "Db", 2: "D", 3: "Eb", 4: "E",
  5: "F", 6: "Gb", 7: "G", 8: "Ab", 9: "A", 10: "Bb", 11: "B",
}

export const BASS_STYLES = {
  "Classic DukeBox": null,   // original root–5th–3rd–approach generator in audio.js
  "Paul Chambers": {
    chromaticApproachRate: 0.55, diatonicPassingRate: 0.35, enclosureRate: 0.12,
    fifthOnBeat3Rate: 0.25, anticipationsRate: 0.05, leapiness: 0.12, twoFeelRate: 0.10,
  },
  "Ray Brown": {
    chromaticApproachRate: 0.25, diatonicPassingRate: 0.55, enclosureRate: 0.05,
    fifthOnBeat3Rate: 0.45, anticipationsRate: 0.03, leapiness: 0.10, twoFeelRate: 0.35,
  },
  "Ron Carter": {
    chromaticApproachRate: 0.45, diatonicPassingRate: 0.35, enclosureRate: 0.25,
    fifthOnBeat3Rate: 0.18, anticipationsRate: 0.18, leapiness: 0.18, twoFeelRate: 0.12,
  },
  "Charles Mingus": {
    chromaticApproachRate: 0.40, diatonicPassingRate: 0.25, enclosureRate: 0.10,
    fifthOnBeat3Rate: 0.20, anticipationsRate: 0.12, leapiness: 0.32, twoFeelRate: 0.15,
  },
  "Oscar Pettiford": {
    chromaticApproachRate: 0.30, diatonicPassingRate: 0.45, enclosureRate: 0.18,
    fifthOnBeat3Rate: 0.22, anticipationsRate: 0.08, leapiness: 0.22, twoFeelRate: 0.20,
  },
}

export const BASS_STYLE_NAMES = Object.keys(BASS_STYLES)
export const DEFAULT_BASS_STYLE = "Classic DukeBox"

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)]

const NOTE_CHROMA = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11, "B#": 0, "E#": 5, Fb: 4,
}

// DukeBox's bass sampler covers E1..C3 (midi 28..48); target that register.
const LOW = 28, HIGH = 48

function rootMidiFromPitchClass(pc) {
  const chroma = NOTE_CHROMA[pc]
  if (chroma == null) return 33   // A1 fallback
  // Candidate octaves around the register; prefer the lowest in-range placement.
  for (const oct of [1, 2]) {
    const midi = 12 * (oct + 1) + chroma
    if (midi >= LOW && midi <= HIGH) return midi
  }
  return clamp(12 * 2 + chroma, LOW, HIGH)
}

function midiToNote(midi) {
  const m = clamp(Math.round(midi), LOW, HIGH)
  return `${JAZZ_SPELLING[m % 12]}${Math.floor(m / 12) - 1}`
}

// Chord tones by quality string — matches Bebop Blueprint's matcher, extended
// for DukeBox quality names (min7b5, 7alt, maj6, min6, NC …)
function chordToneOffsets(quality) {
  const q = String(quality || "").toLowerCase()
  if (q.includes("maj7") || q.includes("maj9")) return [0, 4, 7, 11]
  if (q.includes("min7b5") || q.includes("m7b5")) return [0, 3, 6, 10]
  if (q.includes("dim7")) return [0, 3, 6, 9]
  if (q.startsWith("min") || q === "m" || q.startsWith("m7") || q.startsWith("m6") || q.startsWith("m9"))
    return q.includes("6") ? [0, 3, 7, 9] : [0, 3, 7, 10]
  if (q.includes("maj6") || q === "6" || q === "6/9") return [0, 4, 7, 9]
  if (q.includes("7") || q.includes("9") || q.includes("13") || q.includes("alt")) return [0, 4, 7, 10]
  if (q.startsWith("maj") || q === "add9" || q.includes("sus")) return [0, 4, 7, 11]
  return [0, 4, 7, 10]
}

/**
 * Generate one 4-beat bar as midi values (or null = rest beat).
 * Direct port of __bb_generateWalkingBassBar with DukeBox's register.
 */
function generateBar(style, rootPc, quality, nextRootPc, complexity) {
  const c = clamp(Number.isFinite(complexity) ? complexity : 0.5, 0, 1)
  const rootMidi = clamp(rootMidiFromPitchClass(rootPc), LOW, HIGH)
  const tones = chordToneOffsets(quality).map(o => clamp(rootMidi + o, LOW, HIGH))
  const [, third, fifth, seventh] = tones

  const bar = [null, null, null, null]
  const twoFeelBias = clamp(style.twoFeelRate ?? 0.10, 0, 0.85)

  const playBeat = (beat) => {
    if (beat === 0) return true
    if (c >= 0.85) return true
    const omitBoost = (1 - c) * (0.35 + 0.90 * twoFeelBias)
    if (beat === 1) return Math.random() > (0.55 + omitBoost)
    if (beat === 2) return Math.random() > (0.10 + omitBoost * 0.45)  // beat 3 mostly kept
    return Math.random() > (0.35 + omitBoost)
  }

  // Beat 1: root (honors slash bass upstream — rootPc already resolved).
  bar[0] = rootMidi

  // Beat 2: 3rd or 5th, root repeats at low complexity.
  if (playBeat(1)) {
    if (c < 0.28 && Math.random() < 0.65) bar[1] = rootMidi
    else {
      const opts = [third, fifth].filter(v => v != null)
      bar[1] = opts.length ? pickOne(opts) : rootMidi
    }
  }

  // Beat 3: stepwise-preferred chord tone, style-driven fifth bias, passing tones.
  if (playBeat(2)) {
    const prev = bar[1] ?? bar[0]
    const candidates = [third, fifth, seventh, rootMidi].filter(v => v != null)
    const leapiness = clamp(style.leapiness ?? 0.12, 0, 0.60)
    let best = candidates[0] ?? rootMidi
    let bestScore = Infinity
    for (const cand of candidates) {
      const dist = Math.abs(cand - prev)
      const downBonus = cand <= prev ? -0.25 : 0
      const score = dist * (1.05 - leapiness) + downBonus
      if (score < bestScore) { bestScore = score; best = cand }
    }
    const fifthRate = clamp(style.fifthOnBeat3Rate ?? 0.25, 0, 0.80)
    bar[2] = Math.random() < fifthRate * (0.35 + 0.65 * c)
      ? clamp(rootMidi + 7, LOW, HIGH)
      : best
    if (c > 0.55 && bar[1] != null) {
      const jump = Math.abs(bar[2] - bar[1])
      const passRate = clamp(style.diatonicPassingRate ?? 0.35, 0, 0.90)
      if (jump >= 4 && Math.random() < passRate * (c - 0.40)) {
        const dir = bar[2] > bar[1] ? 1 : -1
        bar[2] = clamp(bar[1] + dir * 2, LOW, HIGH)
      }
    }
  }

  // Beat 4: aim at the next chord — anticipation / enclosure / chromatic / diatonic.
  if (nextRootPc && playBeat(3)) {
    const nextRootMidi = clamp(rootMidiFromPitchClass(nextRootPc), LOW, HIGH)
    const chromRate = clamp(style.chromaticApproachRate ?? 0.55, 0, 0.95)
    const enclRate  = clamp(style.enclosureRate ?? 0.12, 0, 0.55)
    const anticip   = clamp(style.anticipationsRate ?? 0.05, 0, 0.40)

    let approach
    if (Math.random() < anticip * (0.35 + 0.65 * c)) approach = nextRootMidi
    else if (Math.random() < enclRate * (0.20 + 0.80 * c)) approach = nextRootMidi + (Math.random() < 0.5 ? -1 : 1)
    else if (Math.random() < chromRate * (0.25 + 0.75 * c)) approach = nextRootMidi + (Math.random() < 0.70 ? -1 : 1)
    else approach = nextRootMidi - (Math.random() < 0.75 ? 2 : 1)

    // Mingus octave punctuation
    if (style === BASS_STYLES["Charles Mingus"] && c > 0.45 && Math.random() < 0.14) {
      approach = clamp(nextRootMidi + (Math.random() < 0.5 ? 12 : -12), LOW, HIGH)
    }
    bar[3] = clamp(approach, LOW, HIGH)
  }

  // Fill beat 2 lightly at high complexity if it stayed empty but beat 3 exists.
  if (bar[1] == null && bar[2] != null && c > 0.82 && Math.random() < 0.42) {
    const opts = [third, rootMidi].filter(v => v != null)
    bar[1] = opts.length ? pickOne(opts) : rootMidi
  }

  return bar
}

/**
 * Build styled walking-bass events for the whole chart in DukeBox's event
 * format ({time, note, dur, vel}), honoring split (2-beat) bars, N.C. rests,
 * slash bass, and loop wraparound for the final approach tone.
 *
 * @param {Array}  bars    chart bars ({root, quality, symbol, beats?, bass?})
 * @param {Array}  timing  from computeBarTiming (measure/beat/beats per bar)
 * @param {string} styleName  key into BASS_STYLES (not "Classic DukeBox")
 * @param {number} complexity 0..1
 */
export function styledWalkingBass(bars, timing, styleName, complexity) {
  const style = BASS_STYLES[styleName]
  if (!style) return []

  const events = []
  bars.forEach((bar, b) => {
    if (bar.quality === "NC" || bar.symbol === "N.C.") return
    const { measure, beat: startBeat, beats } = timing[b]

    // Next sounding chord's root — wraps to the top of the form like a loop.
    let nextRoot = null
    for (let j = 1; j <= bars.length; j++) {
      const nb = bars[(b + j) % bars.length]
      if (nb.quality !== "NC" && nb.symbol !== "N.C.") { nextRoot = nb.bass || nb.root; break }
    }

    const rootPc = bar.bass || bar.root
    const line = generateBar(style, rootPc, bar.quality, nextRoot, complexity)

    // 2-beat bars keep beat 1 (root) and the beat-4 approach slot.
    const beatsToPlay = beats === 2 ? [[0, line[0]], [1, line[3] ?? line[1]]] :
      line.map((m, i) => [i, m])

    beatsToPlay.forEach(([idx, midi]) => {
      if (midi == null) return
      const absbeat = startBeat + idx
      const m  = measure + Math.floor(absbeat / 4)
      const bt = absbeat % 4
      // Accent beats 2 & 4 with slight random velocity variance (BB behavior).
      const accent = idx === 1 || idx === 3 ? 0.08 : 0
      const vel = clamp(0.72 + accent + (Math.random() - 0.5) * 0.08, 0.4, 1)
      events.push({ time: `${m}:${bt}:0`, note: midiToNote(midi), dur: "4n", vel })
    })
  })
  return events
}
