import * as Tone from "tone"

// Piano sample map — files live at public/samples/piano/
const PIANO_URLS = {
  "A2":  "/samples/piano/a2.mp3",
  "C3":  "/samples/piano/c3.mp3",
  "Eb3": "/samples/piano/ds3.mp3",
  "Gb3": "/samples/piano/fs3.mp3",
  "A3":  "/samples/piano/a3.mp3",
  "C4":  "/samples/piano/c4.mp3",
  "Eb4": "/samples/piano/ds4.mp3",
  "Gb4": "/samples/piano/fs4.mp3",
  "A4":  "/samples/piano/a4.mp3",
  "C5":  "/samples/piano/c5.mp3",
  "Eb5": "/samples/piano/ds5.mp3",
  "Gb5": "/samples/piano/fs5.mp3",
}

// Drum kits — files live at public/samples/drums/. Kit lineup ported from
// Bebop Blueprint (Drums / Makaya / PhillyJoe); "Standard" keeps DukeBox's
// original voices. Player keys are "<kit>:<instrument>".
// Every kit also carries a dedicated snare voice — the Rhythm Shed taps its
// generated bebop rhythms on it (Standard borrows Classic's snare since its
// own lineup never had one).
export const DRUM_KITS = {
  Standard: {
    kick:  "/samples/drums/jazzkick.mp3",
    ride:  "/samples/drums/jazzhat.mp3",
    hihat: "/samples/drums/HiHat.mp3",
    snare: "/samples/drums/Snare.mp3",
  },
  Classic: {
    kick:  "/samples/drums/Kick.mp3",
    ride:  "/samples/drums/Snare.mp3",   // snare carries the accent voice
    hihat: "/samples/drums/HiHat.mp3",
    snare: "/samples/drums/Snare.mp3",
  },
  // Second kit — sourced from the read-only tonal repo's original WAVs. The
  // mp3s previously here were placeholders byte-identical to other samples
  // (Kick2 == woodblock, Snare2 == HiHat), so the kit didn't actually differ.
  Makaya: {
    kick:  "/samples/drums/Kick2.wav",
    ride:  "/samples/drums/Snare2.wav",
    hihat: "/samples/drums/HiHat2.wav",
    snare: "/samples/drums/Snare2.wav",
  },
  PhillyJoe: {
    kick:  "/samples/drums/jazzkick.mp3",
    ride:  "/samples/drums/jazzsnare.mp3",
    hihat: "/samples/drums/jazzhat.mp3",
    snare: "/samples/drums/jazzsnare.mp3",
  },
}

export const DRUM_KIT_NAMES = Object.keys(DRUM_KITS)
export const DEFAULT_DRUM_KIT = "Standard"

const DRUM_URLS = {}
for (const [kit, insts] of Object.entries(DRUM_KITS))
  for (const [inst, url] of Object.entries(insts))
    DRUM_URLS[`${kit}:${inst}`] = url

// Bass sample map — files live at public/samples/bass/
// 21 pitches (E1–C3) × 2 velocities (soft/hard) × 2 round robins = 84 files
const BASS_PITCHES = ["E1","F1","Fs1","G1","Gs1","A1","As1","B1","C2","Cs2","D2","Ds2","E2","F2","Fs2","G2","Gs2","A2","As2","B2","C3"]
const BASS_URLS = {}
for (const p of BASS_PITCHES)
  for (const v of ["soft","hard"])
    for (const r of [1,2])
      BASS_URLS[`${p}_${v}_rr${r}`] = `/samples/bass/${p}_${v}_rr${r}.mp3`

let _piano = null
let _linePiano = null
let _drums  = null
let _bass   = null
let _loadPromise = null

/**
 * Load piano and drum samplers.
 * Both instruments are created synchronously (all URLs registered) before the
 * single Tone.loaded() call, so there's no race between the two buffers sets.
 * Assigns whichever buffers succeeded even if some files 404'd.
 * Safe to call multiple times — reuses the in-flight promise.
 */
export async function initSamplers() {
  if (_loadPromise) return _loadPromise

  _loadPromise = (async () => {
    // 1. Create both instruments synchronously — registers all URLs with Tone
    let pianoRef = null
    let linePianoRef = null
    let drumsRef = null
    let bassRef  = null

    try {
      pianoRef = new Tone.Sampler({ urls: PIANO_URLS, release: 1.2 }).toDestination()
      pianoRef.volume.value = -14
    } catch (err) {
      console.warn("DukeBox: Piano sampler creation failed.", err)
    }

    // A SECOND piano sampler, used only for Line Lab's generated lines. The
    // line and the band need independent faders, and one sampler can't hold two
    // volumes — so the line gets its own voice off the same buffers (the URLs
    // are identical, so this costs one cache hit per file, not a second
    // download).
    try {
      linePianoRef = new Tone.Sampler({ urls: PIANO_URLS, release: 1.2 }).toDestination()
      linePianoRef.volume.value = -10
    } catch (err) {
      console.warn("DukeBox: Line piano sampler creation failed.", err)
    }

    try {
      drumsRef = new Tone.Players({ urls: DRUM_URLS, fadeOut: 0.04 }).toDestination()
      drumsRef.volume.value = -10
    } catch (err) {
      console.warn("DukeBox: Drums player creation failed.", err)
    }

    try {
      bassRef = new Tone.Players({ urls: BASS_URLS, fadeOut: 0.04 }).toDestination()
      bassRef.volume.value = -8
    } catch (err) {
      console.warn("DukeBox: Bass player creation failed.", err)
    }

    // 2. Single await — waits for ALL registered buffers together
    try {
      await Tone.loaded()
    } catch (err) {
      // Some files may have 404'd; assign anyway — Sampler interpolates from neighbours
      console.warn("DukeBox: One or more sample files failed to load.", err)
    }

    // 3. Assign regardless of partial failures — null stays null if creation failed
    _piano = pianoRef
    _linePiano = linePianoRef
    _drums = drumsRef
    _bass  = bassRef
  })()

  return _loadPromise
}

/**
 * Returns { piano, linePiano, drums, bass } — null for any that failed to create.
 */
export function getSamplers() {
  return { piano: _piano, linePiano: _linePiano, drums: _drums, bass: _bass }
}

/**
 * True when THIS specific drum sample is ready to play.
 *
 * Deliberately per-player: Tone.Players' own `.loaded` flag is all-or-nothing,
 * so a single unreadable file (we shipped a 0-byte HiHat2.mp3 once) silently
 * forced every drum hit in every kit onto the quiet synth fallback. Checking
 * one buffer at a time means a bad sample can only ever cost that one voice.
 */
export function isDrumSampleReady(players, key) {
  try {
    return Boolean(players?.has?.(key) && players.player(key)?.loaded)
  } catch {
    return false
  }
}

export function disposeSamplers() {
  try { _piano?.dispose() } catch {}
  try { _linePiano?.dispose() } catch {}
  try { _drums?.dispose() } catch {}
  try { _bass?.dispose()  } catch {}
  _piano = _linePiano = _drums = _bass = null
  _loadPromise = null
}
