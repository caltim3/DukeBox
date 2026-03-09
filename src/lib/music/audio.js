import * as Tone from "tone"
import { Chord, Note } from "@tonaljs/tonal"
import { initSamplers, getSamplers } from "./samples"
import { COMPING_STYLES, DEFAULT_COMPING_STYLE, getVoiceLedVoicing } from "./comping"

const JAZZ_SPELLING = {
  0: "C", 1: "Db", 2: "D", 3: "Eb", 4: "E",
  5: "F", 6: "Gb", 7: "G", 8: "Ab", 9: "A", 10: "Bb", 11: "B",
}

// ─── Singleton synths (created once per browser session) ─────────────────────
let piano = null
let bass  = null
let lead  = null
let kick  = null
let ride  = null
let hihat = null
let audioReady = false

function ensureSynths() {
  if (audioReady) return
  audioReady = true

  piano = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.01,
    modulationIndex: 14,
    oscillator: { type: "triangle" },
    envelope: { attack: 0.002, decay: 0.5, sustain: 0.4, release: 1.2 },
    modulation: { type: "square" },
    modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0.3, release: 0.5 },
  }).toDestination()
  piano.volume.value = -14

  bass = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.005, decay: 0.5, sustain: 0.15, release: 0.6 },
  }).toDestination()
  bass.volume.value = -8

  lead = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.4 },
  }).toDestination()
  lead.volume.value = -16

  kick = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 8,
    envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.2 },
  }).toDestination()
  kick.volume.value = -12

  ride = new Tone.MetalSynth({
    frequency: 400,
    envelope: { attack: 0.001, decay: 0.3, release: 0.2 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  }).toDestination()
  ride.volume.value = -26

  hihat = new Tone.MetalSynth({
    frequency: 600,
    envelope: { attack: 0.001, decay: 0.07, release: 0.05 },
    harmonicity: 8,
    modulationIndex: 40,
    resonance: 7000,
    octaves: 1.2,
  }).toDestination()
  hihat.volume.value = -30
}

// ─── Voicings ────────────────────────────────────────────────────────────────
function assignOctaves(noteNames, baseOctave = 4) {
  const result = []
  let oct = baseOctave
  let prevChroma = -1
  for (const name of noteNames) {
    const ch = Note.chroma(name)
    if (ch == null) continue
    if (ch <= prevChroma) oct++
    result.push(`${name}${oct}`)
    prevChroma = ch
  }
  return result
}

// Shell/guide-tone voicing. rootless = true when bass is playing the root.
function chordVoicing(symbol, rootless = false) {
  const chord = Chord.get(symbol)
  if (!chord.notes?.length) return rootless ? ["E4", "Bb4"] : ["C3", "E4", "Bb4"]

  const { notes, intervals } = chord
  const voice = []

  if (!rootless) voice.push(notes[0])

  const third   = notes.find((_, i) => intervals[i] === "3M" || intervals[i] === "3m")
  const seventh = notes.find((_, i) => intervals[i] === "7M" || intervals[i] === "7m")
  const fifth   = notes.find((_, i) => intervals[i] === "5P")

  if (third)        voice.push(third)
  if (seventh)      voice.push(seventh)
  else if (fifth)   voice.push(fifth)

  if (voice.length === 0) return rootless ? ["E4", "Bb4"] : ["C3", "E4", "Bb4"]
  return assignOctaves(voice, rootless ? 4 : 3)
}

// ─── Bar timing helpers (supports 2-beat "split" bars) ───────────────────────
function computeBarTiming(bars) {
  let totalBeats = 0
  return bars.map(bar => {
    const beats   = bar.beats ?? 4
    const measure = Math.floor(totalBeats / 4)
    const beat    = totalBeats % 4
    totalBeats   += beats
    return { measure, beat, beats, time: `${measure}:${beat}:0` }
  })
}

function totalBarBeats(bars) {
  return bars.reduce((sum, bar) => sum + (bar.beats ?? 4), 0)
}

// ─── Walking bass ─────────────────────────────────────────────────────────────
function walkingBass(bars, timing) {
  const events = []
  bars.forEach((bar, b) => {
    const { measure, beat: startBeat, beats } = timing[b]
    const chord = Chord.get(bar.symbol)
    const notes = chord.notes || [bar.root]
    const ivls  = chord.intervals || []

    const root    = notes[0] || bar.root
    const fifth   = notes.find((_, i) => ivls[i] === "5P")          || root
    const third   = notes.find((_, i) => ivls[i]?.startsWith("3"))  || root

    const nextRoot = bars[b + 1]?.root ?? root
    const nc = Note.chroma(nextRoot)
    const approach = nc != null ? JAZZ_SPELLING[((nc - 1) + 12) % 12] : root

    const noteSeq = beats === 2
      ? [`${root}2`, `${approach}2`]
      : [`${root}2`, `${fifth}2`, `${third}2`, `${approach}2`]
    const velSeq  = beats === 2
      ? [0.80, 0.75]
      : [0.80, 0.65, 0.70, 0.75]

    noteSeq.forEach((note, idx) => {
      const absbeat = startBeat + idx
      const m  = measure + Math.floor(absbeat / 4)
      const bt = absbeat % 4
      events.push({ time: `${m}:${bt}:0`, note, dur: "4n", vel: velSeq[idx] })
    })
  })
  return events
}

// ─── Melody (approach lines) ──────────────────────────────────────────────────
function melodyEvents(approachLines, timing) {
  const events = []
  approachLines.forEach((line, b) => {
    const phrase = line?.phrase || []
    if (!phrase.length) return
    const { measure, beat: startBeat, beats } = timing[b]
    // 2-beat bar: 1 note→beat0, 2 notes→beats 0&1
    // 4-beat bar: 1 note→beat0, 2 notes→beats 0&2, 3 notes→beats 0,1,2
    const positions = beats === 2
      ? phrase.length === 1 ? [0] : [0, 1]
      : phrase.length === 1 ? [0] : phrase.length === 2 ? [0, 2] : [0, 1, 2]
    phrase.forEach((noteName, idx) => {
      if (Note.chroma(noteName) == null) return
      const absbeat = startBeat + (positions[idx] ?? 0)
      const m  = measure + Math.floor(absbeat / 4)
      const bt = absbeat % 4
      events.push({ time: `${m}:${bt}:0`, note: `${noteName}5`, dur: "4n", vel: 0.55 })
    })
  })
  return events
}

// ─── Drum pattern (8th-note grid) ─────────────────────────────────────────────
// 8 steps per bar:  [beat1, +1, beat2, +2, beat3, +3, beat4, +4]
const RIDE_V  = [0.55, 0.30, 0.55, 0,    0.55, 0.30, 0.55, 0   ]
const KICK_V  = [0.75, 0,    0,    0,    0,    0,    0,    0   ]
const HIHAT_V = [0,    0,    0.60, 0,    0,    0,    0.60, 0   ]

function drumEvents(totalBeats) {
  const events = []
  const numMeasures = Math.ceil(totalBeats / 4)
  for (let b = 0; b < numMeasures; b++) {
    for (let s = 0; s < 8; s++) {
      const beat = Math.floor(s / 2)
      const sub  = (s % 2) * 2   // sixteenth position: 0 or 2
      const t    = `${b}:${beat}:${sub}`
      if (RIDE_V[s])  events.push({ time: t, inst: "ride",  vel: RIDE_V[s] })
      if (KICK_V[s])  events.push({ time: t, inst: "kick",  vel: KICK_V[s] })
      if (HIHAT_V[s]) events.push({ time: t, inst: "hihat", vel: HIHAT_V[s] })
    }
  }
  return events
}

// ─── Transport management ─────────────────────────────────────────────────────
let activeParts   = []
let scheduledIds  = []

export function stopAll() {
  const t = Tone.getTransport()
  t.stop()
  t.cancel(0)
  scheduledIds.forEach(id => { try { t.clear(id) } catch {} })
  scheduledIds = []
  activeParts.forEach(p => { try { p.stop(0); p.dispose() } catch {} })
  activeParts = []
  if (piano) piano.releaseAll()
  if (lead)  try { lead.triggerRelease() } catch {}
}

function makePart(events, callback, loop, loopEnd) {
  if (!events.length) return
  const part = new Tone.Part(callback, events)
  part.start(0)
  if (loop) {
    part.loop    = true
    part.loopEnd = loopEnd
  }
  activeParts.push(part)
}

export async function startPlayback({
  bars,
  approachLines = null,
  tempo         = 120,
  loop          = false,
  swing         = 0.5,
  playChords    = true,
  playBass      = true,
  playDrums     = true,
  playMelody    = false,
  compingStyle  = DEFAULT_COMPING_STYLE,
  onBar         = null,
  onStop        = null,
}) {
  await Tone.start()
  stopAll()
  ensureSynths()
  await initSamplers()

  const timing   = computeBarTiming(bars)
  const totalBts = totalBarBeats(bars)
  const endM     = Math.floor(totalBts / 4)
  const endB     = totalBts % 4
  const end      = endB === 0 ? `${endM}:0:0` : `${endM}:${endB}:0`
  const tr       = Tone.getTransport()
  const draw = Tone.getDraw()

  tr.bpm.value        = tempo
  tr.swing            = swing
  tr.swingSubdivision = "8n"
  tr.position         = 0
  tr.loop             = loop
  if (loop) { tr.loopStart = 0; tr.loopEnd = end }

  // Bar-change UI callbacks
  timing.forEach((t, i) => {
    const id = tr.schedule(time => draw.schedule(() => onBar?.(i), time), t.time)
    scheduledIds.push(id)
  })

  // Auto-stop at end (non-loop)
  if (!loop) {
    const id = tr.schedule(time => draw.schedule(() => {
      stopAll()
      onStop?.()
    }, time), end)
    scheduledIds.push(id)
  }

  // Piano chords — voice-led, pianist comping style (rootless when bass is playing)
  if (playChords) {
    const hitPlan = COMPING_STYLES[compingStyle] ?? COMPING_STYLES[DEFAULT_COMPING_STYLE]
    const events = []
    let prevVoicing = null

    bars.forEach((bar, i) => {
      // Skip altered chords — "alt" is a scale suggestion only, not a piano voicing
      if (bar.quality?.toLowerCase().includes("alt") || bar.symbol?.toLowerCase().includes("alt")) return
      const { measure, beat: barBeat, beats } = timing[i]
      const voicing = getVoiceLedVoicing(bar.symbol, prevVoicing, playBass)
      prevVoicing = voicing
      if (beats === 2) {
        // Half-bar: single hit covering the whole 2-beat span
        events.push({ time: `${measure}:${barBeat}:0`, notes: voicing, vel: 0.65, dur: "2n" })
      } else {
        hitPlan.forEach(hit => {
          const beatFrac = hit.t * 4
          const beat = Math.floor(beatFrac)
          const sub  = Math.round((beatFrac - beat) * 4)
          const absbeat = barBeat + beat
          const m  = measure + Math.floor(absbeat / 4)
          const bt = absbeat % 4
          events.push({ time: `${m}:${bt}:${sub}`, notes: voicing, vel: hit.vel, dur: `${hit.len}m` })
        })
      }
    })

    makePart(events, (time, ev) => {
      const s = getSamplers()
      if (s?.piano) {
        s.piano.triggerAttackRelease(ev.notes, ev.dur, time, ev.vel)
      } else {
        piano.triggerAttackRelease(ev.notes, ev.dur, time, ev.vel)
      }
    }, loop, end)
  }

  // Walking bass (always uses synth — no bass samples)
  if (playBass) {
    makePart(walkingBass(bars, timing), (time, ev) => {
      bass.triggerAttackRelease(ev.note, ev.dur, time, ev.vel)
    }, loop, end)
  }

  // Melody lead
  if (playMelody && approachLines?.length) {
    makePart(melodyEvents(approachLines, timing), (time, ev) => {
      lead.triggerAttackRelease(ev.note, ev.dur, time, ev.vel)
    }, loop, end)
  }

  // Drums
  if (playDrums) {
    makePart(drumEvents(totalBts), (time, ev) => {
      const s = getSamplers()
      if (s?.drums) {
        try { s.drums.player(ev.inst).start(time) } catch {}
      } else {
        if (ev.inst === "ride")  ride.triggerAttackRelease("16n", time, ev.vel)
        if (ev.inst === "kick")  kick.triggerAttackRelease("C1",  "8n", time, ev.vel)
        if (ev.inst === "hihat") hihat.triggerAttackRelease("16n", time, ev.vel)
      }
    }, loop, end)
  }

  tr.start()
}
