import * as Tone from "tone"
import { Note } from "@tonaljs/tonal"
import { getChord } from "./tonal"
import { initSamplers, getSamplers, isDrumSampleReady, DEFAULT_DRUM_KIT } from "./samples"
import { COMPING_STYLES, DEFAULT_COMPING_STYLE, getVoiceLedVoicing } from "./comping"
import { DRUM_STYLES } from "./audioConstants"
import { styledWalkingBass, DEFAULT_BASS_STYLE } from "./bassStyles"
export { DRUM_STYLES }

const JAZZ_SPELLING = {
  0: "C", 1: "Db", 2: "D", 3: "Eb", 4: "E",
  5: "F", 6: "Gb", 7: "G", 8: "Ab", 9: "A", 10: "Bb", 11: "B",
}

// Bass sample helpers ─────────────────────────────────────────────────────────
// Maps flat/natural note names → sharp-file notation used in sample filenames
const FLAT_TO_BASS = {
  "C":"C","Db":"Cs","D":"D","Eb":"Ds","E":"E",
  "F":"F","Gb":"Fs","G":"G","Ab":"Gs","A":"A","Bb":"As","B":"B",
}
const BASS_MIDI_MIN = 28  // E1
const BASS_MIDI_MAX = 48  // C3

// Round-robin state: persists across play/stop to prevent machine-gun repetition
let _bassRRState = {}

// Converts a note string (e.g. "Bb2") to a sample key (e.g. "As2_soft_rr1")
function buildBassKey(noteStr) {
  const m = noteStr.match(/^([A-G][b#]?)(-?\d+)$/)
  if (!m) return null
  const [, letter, octStr] = m
  const fileLetter = FLAT_TO_BASS[letter]
  if (!fileLetter) return null
  let octave = parseInt(octStr)
  const midi = Note.midi(noteStr)
  if (midi == null) return null
  if (midi < BASS_MIDI_MIN) octave += Math.ceil((BASS_MIDI_MIN - midi) / 12)
  if (midi > BASS_MIDI_MAX) octave -= Math.ceil((midi - BASS_MIDI_MAX) / 12)
  const filePitch = `${fileLetter}${octave}`
  const vel = Math.random() < 0.6 ? "soft" : "hard"
  const rrKey = `${filePitch}_${vel}`
  const lastRR = _bassRRState[rrKey]
  const rr = lastRR === undefined ? (Math.random() < 0.5 ? 1 : 2) : lastRR === 1 ? 2 : 1
  _bassRRState[rrKey] = rr
  return `${filePitch}_${vel}_rr${rr}`
}

// ─── Singleton synths (created once per browser session) ─────────────────────
let piano = null
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
  // Fallback-kit levels sit close to the sampled kit. They used to be mixed so
  // low (-26 ride / -30 hat) that whenever the sampler failed the drums read as
  // "not playing at all" underneath piano (-14) and bass (-8).
  kick.volume.value = -10

  ride = new Tone.MetalSynth({
    frequency: 400,
    envelope: { attack: 0.001, decay: 0.3, release: 0.2 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  }).toDestination()
  ride.volume.value = -16

  hihat = new Tone.MetalSynth({
    frequency: 600,
    envelope: { attack: 0.001, decay: 0.07, release: 0.05 },
    harmonicity: 8,
    modulationIndex: 40,
    resonance: 7000,
    octaves: 1.2,
  }).toDestination()
  hihat.volume.value = -20
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
  const chord = getChord(symbol)
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
    if (bar.quality === "NC" || bar.symbol === "N.C.") return  // rest — no bass
    const chord = getChord(bar.symbol)
    const notes = chord.notes || [bar.root]
    const ivls  = chord.intervals || []

    // Slash chords (tonic pedals) sound their written bass note.
    const root    = bar.bass || notes[0] || bar.root
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
      // Place melody in right-hand register, minimum E5 (midi 76), so it sits above chord voicings
      const midi5 = Note.midi(`${noteName}5`) ?? 0
      const octave = midi5 >= 76 ? 5 : 6
      events.push({ time: `${m}:${bt}:0`, note: `${noteName}${octave}`, dur: "4n", vel: 0.55 })
    })
  })
  return events
}

// ─── Drum styles — defined in audioConstants.js, imported at top of file ──────

// Every eighth-note slot of the chart gets one event; which voices actually
// sound is decided at trigger time from the live drum style. Scheduling the
// grid rather than the hits is what lets the style change mid-chorus without
// rebuilding the transport.
function drumSlotEvents(totalBeats) {
  const events = []
  const numMeasures = Math.ceil(totalBeats / 4)
  for (let m = 0; m < numMeasures; m++) {
    for (let s = 0; s < 8; s++) {
      const beat = Math.floor(s / 2)
      const sub  = (s % 2) * 2   // sixteenth position: 0 or 2
      events.push({ time: `${m}:${beat}:${sub}`, m, slot: s })
    }
  }
  return events
}

// Velocity for one voice at one slot, under a given pattern. Patterns may span
// multiple measures (e.g. Son Clave 3:2 = 16 slots / 2 bars); they cycle as the
// chart advances.
function drumVelocity(pattern, inst, measure, slot) {
  const lane = pattern?.[inst]
  if (!lane?.length) return 0
  const patternMeasures = Math.max(1, Math.floor(lane.length / 8))
  return lane[(measure % patternMeasures) * 8 + slot] || 0
}

// ─── Reverb send (ported from Bebop Blueprint's reverb dial) ─────────────────
// A parallel send: piano + drums fan out into a gain → reverb → destination.
// The dial controls the send gain; the dry path stays untouched.
let _reverb = null
let _revSend = null
let _revConnected = false

function ensureReverbSend(amount) {
  if (!_reverb) {
    _reverb = new Tone.Reverb({ decay: 2.5, wet: 1 }).toDestination()
    _revSend = new Tone.Gain(0).connect(_reverb)
  }
  _revSend.gain.value = Math.max(0, Math.min(1, amount)) * 0.55
  if (!_revConnected) {
    const { piano: pianoSampler, drums } = getSamplers() ?? {}
    try { pianoSampler?.connect(_revSend) } catch {}
    try { drums?.connect(_revSend) } catch {}
    try { piano?.connect(_revSend) } catch {}
    _revConnected = true
  }
}

// ─── Transport management ─────────────────────────────────────────────────────
let activeParts   = []
let scheduledIds  = []

// ─── Live mix ────────────────────────────────────────────────────────────────
// Settings the UI can change WHILE the transport runs. Everything the parts
// need at trigger time is read from here rather than captured in a closure, so
// mutes, styles, kits, tempo, and swing take effect on the next beat instead of
// on the next Play. Style changes that alter which notes exist (comping hits,
// bass lines) re-scheduled through `rebuilders`.
let live = null
let rebuilders = {}

/**
 * Fire a single note through the shared piano sampler.
 * Used by Line Lab to step through a generated line without opening its own
 * AudioContext (and so the preview matches the app's timbre).
 */
export async function playSingleNote(noteWithOctave, dur = "8n", vel = 0.8) {
  await Tone.start()
  ensureSynths()
  await initSamplers()
  const { piano: pianoSampler } = getSamplers() ?? {}
  const now = Tone.now()
  try {
    if (pianoSampler) pianoSampler.triggerAttackRelease(noteWithOctave, dur, now, vel)
    else piano.triggerAttackRelease(noteWithOctave, dur, now, vel)
  } catch { /* out-of-range note — skip rather than throw */ }
}

/**
 * Sound one chord through the shared piano sampler.
 * Line Lab's solo preview steps notes on a wall-clock timer with no transport
 * of its own, so it needs a way to put the harmony under the line — otherwise
 * you're hearing an improvised line with nothing to hear it against.
 *
 * @param {string} symbol - chord symbol, e.g. "Am7", "Bm7b5", "F#7alt"
 * @param {number|string} dur - how long it rings (seconds, or a Tone duration)
 */
export async function playChordStab(symbol, dur = 2, vel = 0.45) {
  // "alt" is a scale suggestion, not a chord type — voice it as a plain dom7,
  // the same reading the transport's comping uses.
  const cleaned = String(symbol || "").replace(/alt.*$/i, "").trim()
  if (!cleaned || !getChord(cleaned).notes?.length) return
  await Tone.start()
  ensureSynths()
  await initSamplers()
  const { piano: pianoSampler } = getSamplers() ?? {}
  const notes = chordVoicing(cleaned, false)
  const now = Tone.now()
  try {
    if (pianoSampler) pianoSampler.triggerAttackRelease(notes, dur, now, vel)
    else piano.triggerAttackRelease(notes, dur, now, vel)
  } catch { /* unvoiceable chord — stay silent rather than throw */ }
}

export function stopAll() {
  const t = Tone.getTransport()
  t.stop()
  t.cancel(0)
  scheduledIds.forEach(id => { try { t.clear(id) } catch {} })
  scheduledIds = []
  activeParts.forEach(p => { try { p.stop(0); p.dispose() } catch {} })
  activeParts = []
  live = null
  rebuilders = {}
  if (piano) piano.releaseAll()
  if (lead)  try { lead.triggerRelease() } catch {}
}

/**
 * Change playback settings without stopping the band.
 *
 * Accepts any subset of the startPlayback options that describe the mix:
 * tempo, swing, playChords/playBass/playDrums/playMelody, compingStyle,
 * bassStyle, bassComplexity, drumStyle, drumKit, reverbAmount. Anything that
 * only gates or re-reads state applies instantly; comping and bass style
 * changes re-schedule their part, so they land from the current bar onward.
 *
 * No-op when nothing is playing — the next Play picks the values up anyway.
 */
export function updatePlayback(patch = {}) {
  if (!live) return
  const prev = live
  live = { ...live, ...patch }
  const tr = Tone.getTransport()

  if (patch.tempo != null && patch.tempo !== prev.tempo) {
    // Short ramp instead of a jump — a slider drag shouldn't click.
    try { tr.bpm.rampTo(patch.tempo, 0.08) } catch { tr.bpm.value = patch.tempo }
  }
  if (patch.swing != null && patch.swing !== prev.swing) tr.swing = live.swing
  if (patch.reverbAmount != null && patch.reverbAmount !== prev.reverbAmount) {
    ensureReverbSend(live.reverbAmount)
  }
  // Voicings are rootless while the bass covers the root, so muting the bass
  // has to re-voice the piano as well as unmute it.
  if ((patch.compingStyle && patch.compingStyle !== prev.compingStyle) ||
      (patch.playBass != null && patch.playBass !== prev.playBass)) {
    rebuilders.chords?.()
  }
  if ((patch.bassStyle && patch.bassStyle !== prev.bassStyle) ||
      (patch.bassComplexity != null && patch.bassComplexity !== prev.bassComplexity)) {
    rebuilders.bass?.()
  }
}

// Synth fallback for a single drum hit — used when the sampler isn't loaded or fails mid-stream.
function playDrumSynth(inst, time, vel) {
  if      (inst === "ride")  ride.triggerAttackRelease("16n", time, vel)
  else if (inst === "kick")  kick.triggerAttackRelease("C1",  "8n", time, vel)
  else if (inst === "hihat") hihat.triggerAttackRelease("16n", time, vel)
}

function makePart(events, callback) {
  if (!events.length) return null
  const part = new Tone.Part(callback, events)
  part.start(0)
  // Do NOT loop the Part itself — the Transport loop handles seamless repeats.
  // Double-looping (Part + Transport) creates a tiny gap at the seam.
  activeParts.push(part)
  return part
}

// Swap a running part for one built from new events. Starting at 0 while the
// transport is mid-chorus is deliberate: events already behind the playhead sit
// out this pass and come back around on the next repeat.
function replacePart(oldPart, events, callback) {
  if (oldPart) {
    try { oldPart.stop(0); oldPart.dispose() } catch {}
    activeParts = activeParts.filter(p => p !== oldPart)
  }
  return makePart(events, callback)
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
  drumStyle     = 0,
  compingStyle  = DEFAULT_COMPING_STYLE,
  bassStyle     = DEFAULT_BASS_STYLE,
  bassComplexity = 0.5,
  drumKit       = DEFAULT_DRUM_KIT,
  reverbAmount  = 0,
  repeats       = 1,
  onBar         = null,
  onStop        = null,
  lineEvents    = null,   // Line Lab: generated single-note line, played on the lead synth
  onLineNote    = null,   // Line Lab: fires (barIdx, noteIdx) per line note for UI sync
}) {
  await Tone.start()
  stopAll()
  ensureSynths()
  await initSamplers()
  ensureReverbSend(reverbAmount)

  // Multiple passes are laid end-to-end on ONE timeline rather than restarting
  // playback per pass. Restarting meant a full stopAll() + rebuild between
  // choruses, which was audible as a gap at the top of each repeat. As a bonus
  // the piano's voice leading now carries across the seam instead of resetting.
  // (loop=true needs no help — the Transport loops seamlessly on its own.)
  const passes    = loop ? 1 : Math.max(1, Math.floor(repeats))
  const srcLen    = bars.length
  const playBars  = passes > 1 ? Array.from({ length: passes }, () => bars).flat() : bars
  const playLines = passes > 1 && approachLines?.length
    ? Array.from({ length: passes }, () => approachLines).flat()
    : approachLines

  const timing   = computeBarTiming(playBars)
  const totalBts = totalBarBeats(playBars)
  const endM     = Math.floor(totalBts / 4)
  const endB     = totalBts % 4
  const end      = endB === 0 ? `${endM}:0:0` : `${endM}:${endB}:0`
  const tr       = Tone.getTransport()
  const draw = Tone.getDraw()

  // Snapshot every mix setting so updatePlayback() has something to patch.
  live = {
    tempo, swing, playChords, playBass, playDrums, playMelody,
    drumStyle, compingStyle, bassStyle, bassComplexity, drumKit, reverbAmount,
  }
  rebuilders = {}

  tr.bpm.value        = tempo
  tr.swing            = swing
  tr.swingSubdivision = "8n"
  tr.position         = 0
  tr.loop             = loop
  if (loop) { tr.loopStart = 0; tr.loopEnd = end }

  // Bar-change UI callbacks
  timing.forEach((t, i) => {
    const id = tr.schedule(time => draw.schedule(() => onBar?.(i % srcLen), time), t.time)
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

  // Piano chords — voice-led, pianist comping style (rootless when bass is playing).
  // Always scheduled; the Piano switch mutes at trigger time so it can be
  // flipped mid-tune. Changing the comping style re-scheduled via rebuilders.
  {
    const buildChordEvents = (styleName) => {
      const hitPlan = COMPING_STYLES[styleName] ?? COMPING_STYLES[DEFAULT_COMPING_STYLE]
      const events = []
      let prevVoicing = null

      playBars.forEach((bar, i) => {
        const { measure, beat: barBeat, beats } = timing[i]
        // N.C. — silence for the bar (prevVoicing carries so the next chord voice-leads).
        if (bar.quality === "NC" || bar.symbol === "N.C.") return
        // Alt chords voice as plain dom7 — "alt" is a scale/tension suggestion, not a chord type
        const isAlt = bar.quality?.toLowerCase().includes("alt") || bar.symbol?.toLowerCase().includes("alt")
        const voicingSymbol = isAlt ? `${bar.root}7` : bar.symbol
        const voicing = getVoiceLedVoicing(voicingSymbol, prevVoicing, live.playBass)
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
      return events
    }

    // Cache sampler references once — they're singletons that don't change during playback.
    const samplers = getSamplers()
    const playChord = (time, ev) => {
      if (!live?.playChords) return
      if (samplers?.piano) {
        samplers.piano.triggerAttackRelease(ev.notes, ev.dur, time, ev.vel)
      } else {
        piano.triggerAttackRelease(ev.notes, ev.dur, time, ev.vel)
      }
    }

    let chordPart = makePart(buildChordEvents(compingStyle), playChord)
    rebuilders.chords = () => {
      chordPart = replacePart(chordPart, buildChordEvents(live.compingStyle), playChord)
    }
  }

  // Walking bass — upright bass sampler with velocity, jitter, and round-robin humanization.
  // "Classic DukeBox" uses the original root–5th–3rd–approach generator; the
  // bassist personalities (Chambers, Brown, Carter, Mingus, Pettiford) use the
  // Bebop Blueprint line generator with the complexity dial.
  {
    const { bass: bassPlayers } = getSamplers()
    const buildBassEvents = (styleName, complexity) => {
      const styled = styledWalkingBass(playBars, timing, styleName, complexity)
      return styled.length ? styled : walkingBass(playBars, timing)
    }
    const playBassNote = (time, ev) => {
      if (!live?.playBass) return
      if (!bassPlayers) return
      const key = buildBassKey(ev.note)
      if (!key) return
      const player = bassPlayers.player(key)
      if (!player) return
      player.volume.value = (Math.random() - 0.5) * 4   // ±2 dB gain variation
      player.start(time + (Math.random() - 0.5) * 0.02) // ±10 ms timing jitter
    }

    let bassPart = makePart(buildBassEvents(bassStyle, bassComplexity), playBassNote)
    rebuilders.bass = () => {
      bassPart = replacePart(bassPart, buildBassEvents(live.bassStyle, live.bassComplexity), playBassNote)
    }
  }

  // Melody lead — use piano sampler when available so timbre matches the chords
  if (playLines?.length) {
    const { piano: pianoSampler } = getSamplers() ?? {}
    makePart(melodyEvents(playLines, timing), (time, ev) => {
      if (!live?.playMelody) return
      if (pianoSampler) {
        pianoSampler.triggerAttackRelease(ev.note, ev.dur, time, ev.vel)
      } else {
        lead.triggerAttackRelease(ev.note, ev.dur, time, ev.vel)
      }
    })
  }

  // Line Lab — generated single-note line on the lead synth, in the pocket with
  // the rhythm section. Additive: only runs when lineEvents are passed in.
  if (lineEvents?.length) {
    makePart(lineEvents, (time, ev) => {
      lead.triggerAttackRelease(ev.note, ev.dur, time, ev.vel ?? 0.72)
      if (onLineNote) draw.schedule(() => onLineNote(ev.barIdx, ev.noteIdx), time)
    })
  }

  // Drums — use sampler if loaded, fall back to synth synthesis.
  // The eighth-note grid is scheduled once; style and kit are read live, so
  // both can be changed mid-chorus.
  {
    const { drums: drumSampler } = getSamplers() ?? {}

    // Resolve each voice per kit, with a three-step fallback:
    //   selected kit → Standard kit → synth.
    // Checked per-sample (not via Players.loaded, which is all-or-nothing) so a
    // single unreadable file can't silence the whole kit. Cached per playback,
    // since the samplers may still have been loading when we started.
    const voiceCache = {}
    const resolveVoice = (kitName, inst) => {
      const cacheKey = `${kitName}:${inst}`
      if (cacheKey in voiceCache) return voiceCache[cacheKey]
      const std = `${DEFAULT_DRUM_KIT}:${inst}`
      const key = isDrumSampleReady(drumSampler, cacheKey) ? cacheKey
                : isDrumSampleReady(drumSampler, std) ? std
                : null
      if (!key) console.warn(`DukeBox: no drum sample for "${inst}" — using synth fallback.`)
      voiceCache[cacheKey] = key
      return key
    }

    makePart(drumSlotEvents(totalBts), (time, ev) => {
      if (!live?.playDrums) return
      const pattern = DRUM_STYLES[live.drumStyle] ?? DRUM_STYLES[0]
      for (const inst of ["ride", "kick", "hihat"]) {
        const vel = drumVelocity(pattern, inst, ev.m, ev.slot)
        if (!vel) continue
        const key = resolveVoice(live.drumKit, inst)
        if (key) {
          try { drumSampler.player(key).start(time); continue } catch { /* fall through */ }
        }
        playDrumSynth(inst, time, vel)
      }
    })
  }

  tr.start()
}
