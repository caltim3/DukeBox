import * as Tone from "tone"
import { Note } from "@tonaljs/tonal"
import { getChord } from "./tonal"
import { initSamplers, getSamplers, isDrumSampleReady, DEFAULT_DRUM_KIT } from "./samples"
import { COMPING_STYLES, DEFAULT_COMPING_STYLE, getVoiceLedVoicing } from "./comping"
import { DRUM_STYLES } from "./audioConstants"
import { styledWalkingBass, DEFAULT_BASS_STYLE } from "./bassStyles"
import { JAZZ_METERS, DEFAULT_METER, meterBeatsPerBar } from "./meters"
import { midiToToneNote, beatsToBBS } from "./lines"
export { DRUM_STYLES, JAZZ_METERS }

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

// ─── Band / line faders ──────────────────────────────────────────────────────
// Line Lab needs to balance a generated line against the rhythm section, so
// every voice is tagged as "band" or "line" and trimmed from its mixed-in
// resting level rather than being re-routed through a bus. The base numbers are
// the levels each voice was already set to; a fader of 1 leaves the mix exactly
// as it was before faders existed.
const BASE_DB = {
  piano: -14, drums: -10, bass: -8, kick: -10, ride: -16, hihat: -20,
  linePiano: -10, lineGuitar: -7, lead: -16,
}
let _bandLevel = 1
let _lineLevel = 1

const trimDb = (baseDb, level) =>
  level <= 0 ? -Infinity : baseDb + 20 * Math.log10(Math.min(2, level))

function applyMixLevels() {
  const { piano: pianoSampler, linePiano, lineGuitar, drums, bass } = getSamplers() ?? {}
  const set = (node, base, level) => {
    if (node) try { node.volume.value = trimDb(base, level) } catch {}
  }
  set(pianoSampler, BASE_DB.piano, _bandLevel)
  set(piano,        BASE_DB.piano, _bandLevel)
  set(drums,        BASE_DB.drums, _bandLevel)
  set(bass,         BASE_DB.bass,  _bandLevel)
  set(kick,         BASE_DB.kick,  _bandLevel)
  set(ride,         BASE_DB.ride,  _bandLevel)
  set(hihat,        BASE_DB.hihat, _bandLevel)
  set(linePiano,    BASE_DB.linePiano,  _lineLevel)
  set(lineGuitar,   BASE_DB.lineGuitar, _lineLevel)
  set(lead,         BASE_DB.lead,       _lineLevel)
}

// ─── Line voice ──────────────────────────────────────────────────────────────
// Which instrument plays Line Lab's generated single-note lines — the line
// piano (default) or the sampled electric guitar. Read at trigger time, so
// switching applies to the very next note, even mid-playback.
let _lineVoice = "piano"

export const LINE_VOICES = [
  { id: "piano", label: "Piano" },
  { id: "guitar", label: "Electric guitar" },
]

export function setLineVoice(voice) {
  _lineVoice = voice === "guitar" ? "guitar" : "piano"
}

export function getLineVoice() {
  return _lineVoice
}

// The sampler for the current line voice, falling back through the loaded
// alternatives so a missing sample set can never silence the line.
function lineSampler() {
  const { linePiano, lineGuitar } = getSamplers() ?? {}
  if (_lineVoice === "guitar") return lineGuitar || linePiano
  return linePiano
}

/**
 * Set the band and generated-line faders (0 = silent, 1 = the stock mix, 2 =
 * +6 dB). Either key may be omitted to leave that fader alone. Takes effect
 * immediately, whether or not the transport is running.
 */
export function setMixLevels({ band, line } = {}) {
  if (band != null) _bandLevel = Math.max(0, Math.min(2, band))
  if (line != null) _lineLevel = Math.max(0, Math.min(2, line))
  applyMixLevels()
}

export function getMixLevels() {
  return { band: _bandLevel, line: _lineLevel }
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
function computeBarTiming(bars, beatsPerBar = 4) {
  let totalBeats = 0
  return bars.map(bar => {
    const beats   = bar.beats ?? beatsPerBar
    const measure = Math.floor(totalBeats / beatsPerBar)
    const beat    = totalBeats % beatsPerBar
    totalBeats   += beats
    return { measure, beat, beats, time: `${measure}:${beat}:0` }
  })
}

function totalBarBeats(bars, beatsPerBar = 4) {
  return bars.reduce((sum, bar) => sum + (bar.beats ?? beatsPerBar), 0)
}

// A full-length bar's walking-bass note sequence, generalized from the
// original fixed 4-beat root–5th–3rd–approach line to any bar length: always
// starts on the root and ends on the chromatic approach tone into the next
// chord, filling whatever's between with alternating 5th/3rd chord tones.
// beats===4 reproduces the original [root, fifth, third, approach] exactly.
const WALK_FILLERS = ["fifth", "third"]
function walkNoteSeq(root, fifth, third, approach, beats) {
  if (beats <= 1) return [root]
  if (beats === 2) return [root, approach]
  const tones = { root, fifth, third }
  const seq = [root]
  for (let i = 1; i < beats - 1; i++) seq.push(tones[WALK_FILLERS[(i - 1) % WALK_FILLERS.length]])
  seq.push(approach)
  return seq
}
const WALK_VEL_MID = [0.65, 0.70]
function walkVelSeq(beats) {
  if (beats <= 1) return [0.80]
  if (beats === 2) return [0.80, 0.75]
  const seq = [0.80]
  for (let i = 1; i < beats - 1; i++) seq.push(WALK_VEL_MID[(i - 1) % WALK_VEL_MID.length])
  seq.push(0.75)
  return seq
}

// ─── Walking bass ─────────────────────────────────────────────────────────────
function walkingBass(bars, timing, beatsPerBar = 4) {
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

    const noteSeq = walkNoteSeq(`${root}2`, `${fifth}2`, `${third}2`, `${approach}2`, beats)
    const velSeq  = walkVelSeq(beats)

    noteSeq.forEach((note, idx) => {
      const absbeat = startBeat + idx
      const m  = measure + Math.floor(absbeat / beatsPerBar)
      const bt = absbeat % beatsPerBar
      events.push({ time: `${m}:${bt}:0`, note, dur: "4n", vel: velSeq[idx] })
    })
  })
  return events
}

// ─── Melody (approach lines) ──────────────────────────────────────────────────
function melodyEvents(approachLines, timing, beatsPerBar = 4) {
  const events = []
  approachLines.forEach((line, b) => {
    const phrase = line?.phrase || []
    if (!phrase.length) return
    const { measure, beat: startBeat, beats } = timing[b]
    // 2-beat bar: 1 note→beat0, 2 notes→beats 0&1
    // Full bar: 1 note→beat0, 2 notes→beats 0&2, 3 notes→beats 0,1,2
    // (max position used is 2, which fits every supported meter's full bar)
    const positions = beats === 2
      ? phrase.length === 1 ? [0] : [0, 1]
      : phrase.length === 1 ? [0] : phrase.length === 2 ? [0, 2] : [0, 1, 2]
    phrase.forEach((noteName, idx) => {
      if (Note.chroma(noteName) == null) return
      const absbeat = startBeat + (positions[idx] ?? 0)
      const m  = measure + Math.floor(absbeat / beatsPerBar)
      const bt = absbeat % beatsPerBar
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
function drumSlotEvents(totalBeats, beatsPerBar = 4) {
  const events = []
  const slotsPerBar = beatsPerBar * 2   // eighth-note grid
  const numMeasures = Math.ceil(totalBeats / beatsPerBar)
  for (let m = 0; m < numMeasures; m++) {
    for (let s = 0; s < slotsPerBar; s++) {
      const beat = Math.floor(s / 2)
      const sub  = (s % 2) * 2   // sixteenth position: 0 or 2
      events.push({ time: `${m}:${beat}:${sub}`, m, slot: s })
    }
  }
  return events
}

// Every DRUM_STYLES lane is authored as an 8-slot (eighth-note) 4/4 bar (or a
// multiple of 8 for a pattern that spans several bars, e.g. Son Clave 3:2 =
// 16 slots / 2 bars); they cycle as the chart advances. At any other meter
// the bar has a different number of eighth-note slots (beatsPerBar*2), so
// each slot maps proportionally onto the pattern's own 8-slot bar instead of
// indexing past the end of it — the groove keeps its shape (kick on 1, ride
// swing, …) shrunk or stretched to fit, rather than running off the pattern.
const PATTERN_SLOTS_PER_BAR = 8
function drumVelocity(pattern, inst, measure, slot, beatsPerBar = 4) {
  const lane = pattern?.[inst]
  if (!lane?.length) return 0
  const slotsPerBar = beatsPerBar * 2
  const patternMeasures = Math.max(1, Math.floor(lane.length / PATTERN_SLOTS_PER_BAR))
  const mappedSlot = slotsPerBar === PATTERN_SLOTS_PER_BAR
    ? slot
    : Math.round((slot / slotsPerBar) * PATTERN_SLOTS_PER_BAR) % PATTERN_SLOTS_PER_BAR
  return lane[(measure % patternMeasures) * PATTERN_SLOTS_PER_BAR + mappedSlot] || 0
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
 * Resumes/creates the shared AudioContext, standalone from starting any
 * sound. Exists so callers that schedule audio elsewhere first — page.js's
 * startPlayback runs a count-in on Tone's own Transport before it ever calls
 * startPlayback() below — can guarantee the context is actually running
 * before that happens. Tone's Transport clock doesn't advance while the
 * context is suspended, so scheduling anything on it beforehand (a count-in,
 * say) would otherwise schedule against a clock that's stuck at zero: not
 * just silent, but a promise (playCountIn's) that never resolves either.
 */
export async function unlockAudio() {
  await Tone.start()
}

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
 * Fire one note of a generated line through the current LINE voice sampler
 * (piano or electric guitar, per the Line voice picker). Its own voice so the
 * Line Lab fader can balance the line against the rhythm section.
 */
export async function playLineNote(noteWithOctave, dur = "8n", vel = 0.8) {
  await Tone.start()
  ensureSynths()
  await initSamplers()
  applyMixLevels()
  const { piano: pianoSampler } = getSamplers() ?? {}
  const voice = lineSampler() || pianoSampler
  const now = Tone.now()
  try {
    if (voice) voice.triggerAttackRelease(noteWithOctave, dur, now, vel)
    else lead.triggerAttackRelease(noteWithOctave, dur, now, vel)
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
  applyMixLevels()
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
  const { linePiano, lineGuitar } = getSamplers() ?? {}
  if (linePiano) try { linePiano.releaseAll() } catch {}
  if (lineGuitar) try { lineGuitar.releaseAll() } catch {}
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
  meter         = DEFAULT_METER,   // one of JAZZ_METERS — "4/4", "3/4", "5/4", "6/8"
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
  onBeat        = null,   // fires (barIdx, beatInBar) on every beat, for beat-level UI
  onStop        = null,
  lineEvents    = null,   // Line Lab: generated single-note line, played on the lead synth
  onLineNote    = null,   // Line Lab: fires (barIdx, noteIdx) per line note for UI sync
  continuousLine = null,  // Line Lab Improviser: { session, onPhrase } — rolling improvised solo
}) {
  await Tone.start()
  stopAll()
  ensureSynths()
  await initSamplers()
  ensureReverbSend(reverbAmount)
  applyMixLevels()   // faders survive a stop/start

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

  const beatsPerBar = meterBeatsPerBar(meter)
  const timing   = computeBarTiming(playBars, beatsPerBar)
  const totalBts = totalBarBeats(playBars, beatsPerBar)
  const endM     = Math.floor(totalBts / beatsPerBar)
  const endB     = totalBts % beatsPerBar
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
  tr.timeSignature    = beatsPerBar   // makes "measure:beat:sixteenth" below convert to real time correctly at this meter
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

  // Beat-change UI callbacks — one per beat inside each bar, so the display
  // can march through a measure rather than only flipping at the barline.
  // Half-bars (beats: 2) fire twice, which is what their meter is.
  if (onBeat) {
    timing.forEach((t, i) => {
      const barStart = t.measure * beatsPerBar + t.beat
      for (let b = 0; b < t.beats; b++) {
        const abs = barStart + b
        const at = `${Math.floor(abs / beatsPerBar)}:${abs % beatsPerBar}:0`
        const id = tr.schedule(time => draw.schedule(() => onBeat(i % srcLen, b), time), at)
        scheduledIds.push(id)
      }
    })
  }

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
            // hit.t is a fraction of the whole bar (0..1), so scaling by
            // beatsPerBar rather than a fixed 4 keeps the hit plan's shape
            // (e.g. "on 1 and the & of 2") at any meter.
            const beatFrac = hit.t * beatsPerBar
            const beat = Math.floor(beatFrac)
            const sub  = Math.round((beatFrac - beat) * 4)
            const absbeat = barBeat + beat
            const m  = measure + Math.floor(absbeat / beatsPerBar)
            const bt = absbeat % beatsPerBar
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
    // The bassist-personality generator (Chambers, Brown, Carter, Mingus,
    // Pettiford) builds each line as 4 fixed beat-slots — it only makes
    // sense at 4/4. Any other meter falls back to the plain generalized
    // walker below, which adapts its note count to the bar's own length.
    const buildBassEvents = (styleName, complexity) => {
      if (beatsPerBar !== 4) return walkingBass(playBars, timing, beatsPerBar)
      const styled = styledWalkingBass(playBars, timing, styleName, complexity)
      return styled.length ? styled : walkingBass(playBars, timing, beatsPerBar)
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
    makePart(melodyEvents(playLines, timing, beatsPerBar), (time, ev) => {
      if (!live?.playMelody) return
      if (pianoSampler) {
        pianoSampler.triggerAttackRelease(ev.note, ev.dur, time, ev.vel)
      } else {
        lead.triggerAttackRelease(ev.note, ev.dur, time, ev.vel)
      }
    })
  }

  // Line Lab — the generated single-note line, in the pocket with the rhythm
  // section. Plays on the dedicated line piano so it shares the band's timbre
  // while keeping its own fader; the sine lead is the fallback if the samples
  // never loaded. Additive: only runs when lineEvents are passed in.
  if (lineEvents?.length) {
    makePart(lineEvents, (time, ev) => {
      const vel = ev.vel ?? 0.72
      const voice = lineSampler()   // read per note — the picker can switch mid-tune
      if (voice) voice.triggerAttackRelease(ev.note, ev.dur, time, vel)
      else lead.triggerAttackRelease(ev.note, ev.dur, time, vel)
      if (onLineNote) draw.schedule(() => onLineNote(ev.barIdx, ev.noteIdx), time)
    })
  }

  // Line Lab Improviser — continuous mode. A rolling scheduler pulls freshly
  // generated notes from the session a couple of bars ahead of the playhead
  // and schedules them on the transport grid (so they inherit live tempo and
  // swing, like every other voice). The transport loops the FORM while the
  // solo keeps developing: the session thinks in absolute beats, and this
  // block maintains the absolute counter by watching the looped transport
  // position for wraps — scheduling a note at its form-local position lands
  // it in the current pass if it's still ahead of the playhead, or in the
  // next pass if it wrapped, which is exactly the seam behavior wanted.
  // Every scheduled note self-clears after firing; without that, the looping
  // transport would replay it at the same form position every chorus.
  if (continuousLine?.session && loop) {
    const session = continuousLine.session
    const onPhrase = continuousLine.onPhrase
    // How far ahead notes are committed to the transport. Small enough that
    // dial changes reach the ear within a couple of bars, large enough that
    // a slow main-thread frame can't starve the playhead. Clamped below the
    // form length so a form-local position is never ambiguous.
    const LEAD = Math.max(2, Math.min(beatsPerBar * 2, totalBts - 1))

    const scheduleNote = (ev) => {
      const local = ((ev.t % totalBts) + totalBts) % totalBts
      const m = Math.floor(local / beatsPerBar)
      const bt = Math.floor(local % beatsPerBar)
      const sub = Math.round((local - Math.floor(local)) * 4 * 1000) / 1000
      const id = tr.schedule((time) => {
        try { tr.clear(id) } catch {} // one-shot on a looping transport
        const note = midiToToneNote(ev.midi)
        const dur = beatsToBBS(ev.d)
        const vel = ev.vel ?? 0.72
        const voice = lineSampler()   // read per note — the picker can switch mid-solo
        if (voice) voice.triggerAttackRelease(note, dur, time, vel)
        else lead.triggerAttackRelease(note, dur, time, vel)
      }, `${m}:${bt}:${sub}`)
      scheduledIds.push(id)
    }

    // Opening window goes in before the transport starts, so the first notes
    // aren't racing the playhead.
    for (const ev of session.collectEvents(LEAD)) scheduleNote(ev)

    let lastLocal = -1
    let wrapCount = 0
    let lastInfoKey = ""
    const refillId = tr.scheduleRepeat((time) => {
      // Absolute beat from looped ticks + observed wraps — self-correcting
      // even if a repeat tick lands oddly at the loop seam.
      const ticks = tr.getTicksAtTime(time)
      const local = ticks / tr.PPQ
      if (local < lastLocal - 0.5) wrapCount++
      lastLocal = local
      const absBeat = wrapCount * totalBts + local

      for (const ev of session.collectEvents(absBeat + LEAD)) scheduleNote(ev)

      if (onPhrase) {
        const info = session.infoAt(absBeat)
        const key = `${info.chorus}:${info.formBar}:${info.phrase}:${info.resting}`
        if (key !== lastInfoKey) {
          lastInfoKey = key
          draw.schedule(() => onPhrase(info), time)
        }
      }
    }, "4n", 0)
    scheduledIds.push(refillId)
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

    makePart(drumSlotEvents(totalBts, beatsPerBar), (time, ev) => {
      if (!live?.playDrums) return
      const pattern = DRUM_STYLES[live.drumStyle] ?? DRUM_STYLES[0]
      for (const inst of ["ride", "kick", "hihat"]) {
        const vel = drumVelocity(pattern, inst, ev.m, ev.slot, beatsPerBar)
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
