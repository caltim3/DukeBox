import { playbookGuide } from "@/lib/music/lickGuides"

export const LICK_CHARTS = [
  // SET ONE
  {
    n:1, name:'The Doorbell', dev:'enclosures',
    cue:'Ring the bell on the 3rd.',
    major: '"Dm7"F,A,CE C_B, |"G7"=B,2F,2 F^D |"Cmaj7"E4 z4 |]',
    minor: '"Dm7b5"F,_A,C_E _B,G, |"G7alt"_A,2=B,2 FD |"Cm6"_E4 z4 |]'
  },
  {
    n:2, name:'The Escalator', dev:'bebop scales',
    cue:'Downbeats own the chord tones.',
    major: '"Dm7"GA "G7"^FE DC B,A, |"Cmaj7"G,8 |]',
    minor: '"Dm7b5"G^F "G7alt"F_E DC B,_A, |"Cm6"G,8 |]'
  },
  {
    n:3, name:'The Quote', dev:'stock language',
    cue:'Sing the words in your head.',
    major: '"Dm7"FED^C DFAc |"G7"BAG^F GFED |"Cmaj7"E8 |]',
    minor: '"Dm7b5"F_EDC DF_Ac |"G7alt"_AGF_E DCB,D |"Cm6"_E8 |]'
  },
  {
    n:4, name:'The Slingshot', dev:'forward motion',
    cue:'The line ends on 1. It does not start there.',
    major: '"G7"z6 F^D |"Cmaj7"E8 ||\n"G7"z4 AGF^D |"Cmaj7"E8 ||\n"G7"FEDCB,A,G,D, |"Cmaj7"E,8 |]',
    minor: '"G7alt"z6 FD |"Cm6"_E8 ||\n"G7alt"z4 _AGFD |"Cm6"_E8 ||\n"G7alt"_AGF_E DCB,D, |"Cm6"_E,8 |]'
  },
  {
    n:5, name:'The Gallop', dev:'rest-stroke triplets',
    cue:'One beat, one triad, rest stroke on the button.',
    major: '"Dm7"(3D,F,A, (3F,A,C (3A,CE (3CEG |"G7"(3B,DF (3DF_A (3F_AB (3_ABd |"Cmaj7"C8 |]',
    minor: '"Dm7b5"(3D,F,_A, (3F,_A,C (3_A,C_E (3C_EG |"G7alt"(3B,DF (3DF_A (3F_AB (3_ABd |"Cm6"_E8 |]'
  },
  {
    n:6, name:'Two Coins', dev:'triad pairs',
    cue:'Flip the two coins, cash out a half step from home.',
    major: '"Dm7"(3F,A,C (3CA,F, (3G,B,D (3DB,G, |"G7alt"(3_DF_A (3_AF_D (3_EG_B (3_BG_E |"Cmaj7"E4 z4 |]',
    minor: '"Dm7b5"(3_B,DF (3FD_B, (3CEG (3GEC |"G7alt"(3_DF_A (3_AF_D (3_EG_B (3_BG_E |"Cm6"G,4 z4 |]'
  },
  {
    n:7, name:'The Cell Chain', dev:'four-note cells',
    cue:'Four notes. The first one owns the beat.',
    major: '"Dm7"D,E,F,A, F,G,A,C |"G7"G,A,B,D "Cmaj7"B,CDF |E4 z4 |]',
    minor: '"Dm7b5"D,_E,F,_A, F,G,_A,C |"G7alt"G,_A,B,D F,_A,B,D |"Cm6"_E4 z4 |]'
  },
  {
    n:8, name:'The Pivot', dev:'pivot arpeggios',
    cue:'Up the 3rd arpeggio, turn at the top, come home a different road.',
    major: '"Dm7"F,A,CE DCB,A, |"G7"B,DFA _AGFD |"Cmaj7"E8 |]',
    minor: '"Dm7b5"F,_A,C_E DC_B,_A, |"G7alt"B,DF_A GF_ED |"Cm6"_E8 |]'
  },
  {
    n:9, name:'One Ladder', dev:'scale choices',
    cue:'One scale until the V. The V is a decision you already made.',
    major: '"Dm7"D,E,F,G, A,B,CD |"G7alt"_DCB,_A, G,F,_E,D, |"Cmaj7"C,8 |]',
    minor: '"Dm7b5"D,_E,F,G, _A,=B,CD |"G7alt"DC=B,_A, G,F,_E,D, |"Cm6"G,8 |]'
  },
  {
    n:10, name:'The Stack', dev:'3-to-9 arpeggios',
    cue:'Play the chord that lives on the 3rd.',
    major: '"Dm7"F,2A,2C2E2 |"G7"B,2D2F2A2 |"Cmaj7"E2G2B2d2 |]',
    minor: '"Dm7b5"F,2_A,2C2_E2 |"G7alt"B,2D2F2_A2 |"Cm6"_E2G2_B2d2 |]'
  },

  // SET TWO
  {
    n:11, name:'The Bullseye', dev:'enclosure + release', set2:true,
    cue:'One target, surrounded, then let the flat 7 fall home.',
    major: '"Dm7"F,A,CA, "G7"C_B,=B,F |"Cmaj7"E4 z4 |]',
    minor: '"Dm7b5"F,_A,C_A, "G7alt"=B,_E^CD |"Cm6"_E4 z4 |]'
  },
  {
    n:12, name:'The Ligon Step', dev:'guide-tone outlines',
    cue:'Three, down to the seven, half step to the next three.',
    major: '"Dm7"FEDC "G7"B,A,G,F, |"Cmaj7"E,8 |]',
    minor: '"Dm7b5"F_EDC "G7alt"B,_A,G,F, |"Cm6"_E,8 |]'
  },
  {
    n:13, name:'The Barry Ladder', dev:'movable half steps',
    cue:'Start anywhere on the chord. The spacer moves so the downbeats do not.',
    major: '"Dm7"DEF^F "G7"G=FE_E |D_DC=B, A,G,E,z |"Cmaj7"C,8 |]',
    minor: '"Dm7b5"D,F,_A,C "G7alt"=B,_A,G,F, |E_EG=B c=B_AG |"Cm6"_E4 z4 |]'
  },
  {
    n:14, name:'The Arpeggio Relay', dev:'structure handoffs',
    cue:'Pass the baton to the nearest hand.',
    major: '"Dm7"D,F,A,C |"G7"B,DFA |"Cmaj7"GEC=B, A,G,E,C, |]',
    minor: '"Dm7b5"D,F,_A,C |"G7alt"B,DF_A |"Cm6"G_ECB, _A,G,_E,C, |]'
  },
  {
    n:15, name:'The Flat-9 Reset', dev:'dim arp to the 5th',
    cue:'Climb the diminished ladder, step off at the top.',
    major: '"Dm7"D,F,A,C |"G7"B,DF_A |"Cmaj7"G4 z4 |]',
    minor: '"Dm7b5"D,F,_A,C |"G7alt"B,DF_A |"Cm6"G,4 z4 |]'
  },
  {
    n:16, name:'The Chromatic Bridge', dev:'half-step roads',
    cue:'Clear posts, blurry road, clean arrival.',
    major: '"Dm7"D_EE =F^F "G7"G_AA =B_B=B |"Cmaj7"C4 EG |]',
    minor: '"Dm7b5"D_EE =F^F "G7alt"G_AA =B_B=B C |"Cm6"_E4 GF_ED |]'
  },
  {
    n:17, name:'The Language Patch', dev:'modular vocabulary',
    cue:'Reusable middle, context-sensitive front and back.',
    major: '"Dm7"F,G,A,C "G7"B,DF_A GFED |"Cmaj7"E8 |]',
    minor: '"Dm7b5"F,G,_A,C "G7alt"B,DF_A GFED |"Cm6"_E8 |]'
  },
  {
    n:18, name:'The Nine Landing', dev:'color-tone targets',
    cue:'Aim past the obvious notes. Park on the 9.',
    major: '"Dm7"F,A,CE |"G7alt"_A_B=B_E |"Cmaj7"D4 z4 |]',
    minor: '"Dm7b5"D,F,_A,C |"G7alt"_A_B=B_E |"Cm6"D4 z4 |]'
  },
  {
    n:19, name:'The Rule of Thirds', dev:'melodic minor planing',
    cue:'Same fingers, up a minor 3rd, up a major 3rd, home.',
    major: '"Dm7"F,A,CE |"G7alt"_A_B=BD |"Cmaj7"E4 z4 |]',
    minor: '"Dm7b5"D,E,F,_A, |"G7alt"F,G,_A,=B, |"Cm6"A,=B,C_E |]'
  },
  {
    n:20, name:'The Side-Slip', dev:'half-step planing',
    cue:'Copy, paste a half step up, slide back home.',
    major: '"Dm7"D,F,A,C |"G7alt"_E,_G,_B,_D |"Cmaj7"C,E,G, z |]',
    minor: '"Dm7b5"D,F,_A,C |"G7alt"_E,_G,A,_D |"Cm6"C,_E,G, z |]'
  },
  {
    n:21, name:'The Anticipation', dev:'harmonic forward motion',
    cue:'Play tomorrow chord today, prove it on the downbeat.',
    major: '"Dm7"F,A,CE _A_G_E_D |"G7"=BDF_A GFED |"Cmaj7"E8 |]',
    minor: '"Dm7b5"F,_A,C_E _A_G_E_D |"G7alt"=BDF_A GFED |"Cm6"_E8 |]'
  },
  {
    n:22, name:'The Motif Squeeze', dev:'motive development',
    cue:'Say it, sharpen it, answer it, breathe.',
    major: '"Dm7"DEFA |"G7"GA_BD |"Cmaj7"CDEG EDC=B, |]',
    minor: '"Dm7b5"DF_AF |"G7alt"G_B_d_B |"Cm6"C_EG_E DC=B,C |]'
  },
  {
    n:23, name:'The Victory Lap', dev:'tonic-bar moves',
    cue:'You already won. Take the lap, park on a color tone.',
    major: '"Cmaj7"CEG^G ABG E4 |]',
    minor: '"Cm6"CG =BG _BG AG z4 |]'
  },
  {
    n:24, name:'The Half-Time Lens', dev:'rhythmic perception',
    cue:'Half speed in the head, long line in the hands, land late.',
    major: '"Dm7"F,A,CE DCB,A, |"G7"B,DFA _AGFD |"Cmaj7"z4 E4 |]',
    minor: '"Dm7b5"F,_E,D,C, =B,,A,,G,,F,, |"G7alt"_E,D,C,=B,, A,,G,,F,,D,, |"Cm6"z4 _E,4 |]'
  },

  // THE PEÑA SET — Richard Peña's bebop-intuition method: arpeggio or scale
  // line, chromatic enclosure, guide-tone landing. Strong notes on strong
  // beats; the enclosure either starts the line or meets the target.
  {
    n:25, name:'Nail the One', dev:'Peña: enclosure into the 1',
    cue:'Start on the 3rd. Four eighth notes cage the root. Beat one is the door.',
    major: '"Dm7"F,A,CE DCB,A, |"G7"=B,DF_A =B,_D_B,=B, |"Cmaj7"C4 z4 |]',
    minor: '"Dm7b5"F,_A,C_E DC_B,_A, |"G7alt"=B,DF_A =B,_D_B,=B, |"Cm6"C4 z4 |]'
  },
  {
    n:26, name:'Nail the Third', dev:'Peña: enclosure into the 3rd',
    cue:'Start on the one. The 3rd of the next chord is where the line was always going.',
    major: '"G7"G,=B,DF GFD^D |"Cmaj7"E4 z4 |]',
    minor: '"G7alt"G,=B,DF GFD=E |"Cm6"_E4 z4 |]'
  },
  {
    n:27, name:'The Peña Ladder', dev:'Peña: arpeggio + enclosure + guide tone',
    cue:'Arpeggio up, enclosure down, guide tone through the door. All three tools in one line.',
    major: '"Dm7"F,A,CE DCA,_B, |"G7"=B,2DF _A=FD_D |"Cmaj7"C8 |]',
    minor: '"Dm7b5"F,_A,C_E DC_A,_B, |"G7alt"=B,2DF _A=FD_D |"Cm6"C8 |]'
  },
  {
    n:28, name:'The Fast Lane', dev:'Peña: two chords per bar',
    cue:'Half the room, same tools. One arpeggio, one enclosure, no waiting.',
    major: '"Dm7"F,A,CE "G7"=B,DF^D |"Cmaj7"E8 |]',
    minor: '"Dm7b5"F,_A,C_E "G7alt"=B,DF=D |"Cm6"_E8 |]'
  }
];

export const LICK_KEYS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

const NOTE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 }
const CHORD_ROOT_RE = /^([A-G])([#b]?)(.*)$/

function keyPc(key) {
  const m = /^([A-G])([#b]?)$/.exec(key || "C")
  if (!m) return 0
  return (NOTE_PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12
}

function signedTranspose(fromKey, toKey) {
  let n = keyPc(toKey) - keyPc(fromKey)
  if (n > 6) n -= 12
  if (n < -6) n += 12
  return n
}

function transposeChord(symbol, semitones) {
  const m = CHORD_ROOT_RE.exec(symbol || "")
  if (!m) return symbol
  const root = (NOTE_PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + semitones + 120) % 12
  return `${LICK_KEYS[root]}${m[3]}`
}

export function guitarPosition(midi) {
  const choices = []
  for (let s = 1; s <= 6; s++) {
    const fret = midi - OPEN_MIDI[s]
    if (fret >= 0 && fret <= 24) choices.push({ s, fret })
  }
  if (!choices.length) return guitarPosition(midi < 40 ? midi + 12 : midi - 12)
  // ABCJS's guitar tablature takes the highest-pitched string on which a
  // single note is available. Mirroring that rule here keeps the compact line
  // data, playback, and MusicXML technical marks aligned with the original
  // Ways In tablature when no custom neck position has been requested.
  return [choices[0].s, choices[0].fret]
}

function abcMidi(letter, marks, accidental, accidentalState) {
  const upper = letter.toUpperCase()
  // ABCJS's string-tab pitch convention maps uppercase C to 48 and its guitar
  // tuning E,/A,/D/G/B/e to standard sounding guitar MIDI 40/45/50/55/59/64.
  // Using the same octave here makes the notes we play agree with its TAB.
  let midi = 48 + NOTE_PC[upper]
  if (letter === letter.toLowerCase()) midi += 12
  for (const mark of marks || "") midi += mark === "," ? -12 : mark === "'" ? 12 : 0
  const stateKey = `${letter}${marks || ""}`
  if (accidental) accidentalState.set(stateKey, accidental === "_" ? -1 : accidental === "^" ? 1 : 0)
  midi += accidentalState.get(stateKey) || 0
  return midi
}

// The source page uses a deliberately small ABC subset. Converting it here
// keeps the original vocabulary intact while letting DukeBox use its native
// fretboard player and MusicXML exporter instead of loading a second notation app.
export function abcToLine(abc, { cue = "", device = "" } = {}) {
  const bars = []
  let notes = []
  let chords = []
  let currentChord = ""
  let tupletLeft = 0
  let pendingRestBeats = 0
  let measureBeats = 0
  let accidentalState = new Map()

  const flush = () => {
    if (!notes.length && !chords.length) return
    bars.push({
      c: chords.join(" ") || currentChord,
      n: notes,
      d: device,
      x: cue,
      beats: Math.max(4, measureBeats || 4),
      tailRest: pendingRestBeats,
    })
    notes = []
    chords = []
    pendingRestBeats = 0
    measureBeats = 0
    accidentalState = new Map()
  }

  const tokenRe = /"([^"]+)"|\(3|([_=^]?)([A-Ga-gz])([,']*)(\d*)|(\|+)/g
  let m
  while ((m = tokenRe.exec(abc || ""))) {
    if (m[1]) {
      currentChord = m[1]
      if (!chords.includes(currentChord)) chords.push(currentChord)
      continue
    }
    if (m[0] === "(3") { tupletLeft = 3; continue }
    if (m[6]) { flush(); continue }
    const letter = m[3]
    if (!letter) continue
    const units = Number(m[5] || 1)
    const beats = units * 0.5 * (tupletLeft > 0 ? 2 / 3 : 1)
    if (tupletLeft > 0) tupletLeft -= 1
    measureBeats += beats
    if (letter.toLowerCase() === "z") { pendingRestBeats += beats; continue }
    const midi = abcMidi(letter, m[4], m[2], accidentalState)
    const [s, f] = guitarPosition(midi)
    notes.push([s, f, beats, pendingRestBeats])
    pendingRestBeats = 0
  }
  flush()
  // notationAbc is kept as provenance — the source text a lick was typed in —
  // not as something that gets rendered. Notation is engraved from `bars` now,
  // so the two can't disagree.
  return { bars, s: cue, notationAbc: abc, notationTranspose: 0 }
}

export function presetLicks() {
  return LICK_CHARTS.flatMap((chart) => {
    const guide = playbookGuide(chart.n)
    const name = guide?.name || chart.name
    const cue = guide?.cue || chart.cue
    return ["major", "minor"].map((mode) => ({
      id: `playbook-${chart.n}-${mode}`,
      n: chart.n,
      name,
      mode,
      device: chart.dev,
      cue,
      baseKey: "C",
      builtIn: true,
      guide,
      line: abcToLine(guide?.notation?.[mode] || chart[mode], { cue, device: chart.dev }),
    }))
  })
}

export function inferLineKey(line) {
  const chord = line?.bars?.[line.bars.length - 1]?.c?.trim().split(/\s+/).pop() || "C"
  const m = CHORD_ROOT_RE.exec(chord)
  return m ? `${m[1]}${m[2]}` : "C"
}

export function transposeLine(line, fromKey = "C", toKey = "C") {
  const semitones = signedTranspose(fromKey, toKey)
  if (!semitones) return line
  return {
    ...line,
    notationTranspose: (Number(line?.notationTranspose) || 0) + semitones,
    bars: (line?.bars || []).map((bar) => ({
      ...bar,
      c: String(bar.c || "").split(/\s+/).map((chord) => transposeChord(chord, semitones)).join(" "),
      n: (bar.n || []).map(([s, f, beats, wait = 0, ...rest]) => {
        const midi = (OPEN_MIDI[s] ?? 64) + Number(f || 0) + semitones
        const [nextS, nextF] = guitarPosition(midi)
        // ...rest preserves optional trailing fields (velocity etc.) so a
        // transposed improviser line keeps its dynamics.
        return [nextS, nextF, beats, wait, ...rest]
      }),
    })),
  }
}

function positionsForMidi(midi, maxString = 6) {
  const out = []
  for (let s = 1; s <= maxString; s++) {
    const fret = midi - OPEN_MIDI[s]
    if (fret >= 0 && fret <= 24) out.push({ s, fret })
  }
  return out
}

// Re-finger a line without changing its notes or intervals. The dynamic-
// programming pass looks at the complete phrase instead of greedily choosing
// each note, so it strongly prefers the requested five-fret box while avoiding
// gratuitous string/fret jumps. It may move the complete lick by octave when a
// distant neck position cannot contain the original register.
export function refingerLine(line, positionFret, span = 5) {
  const start = Math.max(1, Math.min(19, Math.round(Number(positionFret) || 1)))
  const end = Math.min(24, start + Math.max(4, Math.round(Number(span) || 5)) - 1)
  const events = []

  ;(line?.bars || []).forEach((bar, barIndex) => {
    ;(bar.n || []).forEach(([s, f], noteIndex) => {
      events.push({ barIndex, noteIndex, midi: (OPEN_MIDI[s] ?? 64) + Number(f || 0) })
    })
  })
  if (!events.length) return line

  const center = (start + end) / 2

  // A given fret window reads a full octave-plus higher on the top strings
  // than on the wound bass ones (frets 3-7 span roughly F3-B4 across strings
  // 1-4 alone), but the cost below only ever scored fret-window fit and
  // note-to-note motion — nothing preferred a treble string over a bass one
  // for an equally-in-window fret. That let a whole improvised line land on
  // strings 5-6 whenever that happened to minimize fret jumps, which reads
  // as "the wrong octave" even though the fret numbers were correct. `solve`
  // now takes a string ceiling; the caller below tries strings 1-4 (the
  // register a single-note lead line actually lives in) across every octave
  // shift first, and only opens up strings 5-6 if nothing in that set can
  // hold the whole phrase.
  function solve(octaveShift, maxString) {
    const candidates = events.map((event) => positionsForMidi(event.midi + octaveShift, maxString))
    if (candidates.some((options) => !options.length)) return null
    const costs = []
    const back = []

    candidates.forEach((options, index) => {
      costs[index] = []
      back[index] = []
      options.forEach((pos, optionIndex) => {
        const outside = pos.fret < start ? start - pos.fret : pos.fret > end ? pos.fret - end : 0
        const local = outside * outside * 40 + Math.abs(pos.fret - center) * 0.18
        if (index === 0) {
          costs[index][optionIndex] = local
          back[index][optionIndex] = -1
          return
        }
        let best = Infinity
        let bestPrev = 0
        candidates[index - 1].forEach((prev, prevIndex) => {
          const transition = Math.abs(pos.fret - prev.fret) * 0.42 + Math.abs(pos.s - prev.s) * 0.28
          const score = costs[index - 1][prevIndex] + local + transition
          if (score < best) { best = score; bestPrev = prevIndex }
        })
        costs[index][optionIndex] = best
        back[index][optionIndex] = bestPrev
      })
    })

    let chosen = costs[costs.length - 1].reduce((best, cost, index, arr) => cost < arr[best] ? index : best, 0)
    const score = costs[costs.length - 1][chosen] + Math.abs(octaveShift / 12) * 2
    const path = new Array(events.length)
    for (let index = events.length - 1; index >= 0; index--) {
      path[index] = candidates[index][chosen]
      chosen = back[index][chosen]
    }
    return { path, score, octaveShift }
  }

  // Moving a lick a long way up or down the guitar sometimes requires the
  // whole phrase to change octave. Treat that as one global displacement, not
  // per-note octave hopping, so the melodic contour remains intact. Try every
  // octave shift restricted to strings 1-4 first; only widen to the full
  // 1-6 set (for every shift) if nothing in that pass could hold the phrase
  // — e.g. a genuinely low target position where strings 1-4 can't reach.
  const OCTAVE_SHIFTS = [0, 12, -12, 24, -24]
  const trebleSolutions = OCTAVE_SHIFTS.map((o) => solve(o, 4)).filter(Boolean)
  const solutions = trebleSolutions.length ? trebleSolutions : OCTAVE_SHIFTS.map((o) => solve(o, 6)).filter(Boolean)
  const bestSolution = solutions.reduce((best, next) => !best || next.score < best.score ? next : best, null)
  if (!bestSolution) return line
  const { path, octaveShift } = bestSolution

  const bars = (line?.bars || []).map((bar) => ({ ...bar, n: (bar.n || []).map((note) => [...note]) }))
  events.forEach((event, index) => {
    const old = bars[event.barIndex].n[event.noteIndex]
    // Keep optional trailing fields (velocity etc.) beyond the four the
    // refingering itself touches.
    bars[event.barIndex].n[event.noteIndex] = [path[index].s, path[index].fret, old[2], old[3] || 0, ...old.slice(4)]
  })

  return {
    ...line,
    bars,
    // Once the guitarist chooses a different position, rebuild the ABC from
    // the actual events so staff, TAB, playback, and export remain one object.
    notationAbc: null,
    notationTranspose: 0,
    tabFingeringOverride: true,
    neckPosition: start,
    neckSpan: end - start + 1,
    neckOctaveShift: octaveShift,
  }
}

export function lineFretRange(line) {
  const frets = (line?.bars || []).flatMap((bar) => (bar.n || []).map((note) => Number(note[1]) || 0))
  return frets.length ? [Math.min(...frets), Math.max(...frets)] : [0, 0]
}
